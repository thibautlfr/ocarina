import * as THREE from "three";
import type { GLTF } from "three/addons";
import Experience from "../experience.ts";

const { randFloat } = THREE.MathUtils;

// Navi, Tatl, Tael, a Great Fairy pink and a forest green
const FAIRY_COLORS = ["#7fd4ff", "#fff1a0", "#c49bff", "#ff9fd8", "#9dffb4"];
const FAIRY_COUNT = 4;
// Radius of the glowing ball, in world units (the ocarina is about 1.2 long)
const BODY_RADIUS = 0.05;
// How much the core and the wings are whitened from the fairy's color
const CORE_WHITENESS = 0.6;
const WING_WHITENESS = 0.4;
const WING_OPACITY = 0.45;
// Reach of the light tinting the ocarina
const LIGHT_DISTANCE = 3;

// Flight area inside the room (the stump top is at y 1.05, walls reach ~5)
const BOUNDS = new THREE.Box3(
	new THREE.Vector3(-5, 1.5, -5),
	new THREE.Vector3(5, 3.8, 5),
);
// No target is picked this close to the stump, horizontally
const STUMP_CLEARANCE = 1.6;
// Fairies steer away from the ocarina and the camera within these radii
const OCARINA_AVOID_RADIUS = 1.1;
const CAMERA_AVOID_RADIUS = 1;
const REPEL_STRENGTH = 12;

// A target this close counts as reached
const ARRIVE_DISTANCE = 0.3;
// Fairies start slowing down this far from their target
const SLOW_DOWN_DISTANCE = 1.2;
const STEER_STRENGTH = 1.5;
const HOVER_BRAKE = 2;
// Chance of hovering a moment on reaching a target, and for how long, in seconds
const HOVER_CHANCE = 0.35;
const HOVER_TIME = [0.8, 2.5] as const;
// Seconds before a new target is picked, even if this one isn't reached
const FIRST_RETARGET_TIME = [3, 7] as const;
const RETARGET_TIME = [4, 8] as const;
// How fast a fairy turns toward where it flies
const TURN_SPEED = 5;
// Clamped so a background tab doesn't send fairies flying on return
const MAX_DELTA = 0.05;

// Celebration: the fairies gather in a ring around the ocarina and spiral up,
// glowing brighter. Duration in seconds.
const CELEBRATE_TIME = 6;
// Turns around the ocarina, ring radius at the start and at the tightest,
// and how high they end up above it, in world units
const CELEBRATE_TURNS = 1.5;
const CELEBRATE_RADIUS = [1.4, 0.7] as const;
const CELEBRATE_RISE = 0.6;
// How much brighter they burn at the peak of the celebration
const CELEBRATE_GLOW = 2.4;
// Speed multiplier, so a fairy at the far wall reaches the ring in time
const CELEBRATE_SPEED = 2.2;

type Fairy = {
	// Its place in the ring of the celebration
	index: number;
	group: THREE.Group;
	// Faces the direction of travel (+Z forward)
	body: THREE.Group;
	wings: { pivot: THREE.Group; side: number }[];
	halo: THREE.Sprite;
	light: THREE.PointLight;
	position: THREE.Vector3;
	velocity: THREE.Vector3;
	target: THREE.Vector3;
	// Seconds before a new target is picked
	retargetIn: number;
	// Seconds left hovering in place
	hoverFor: number;
	// Random offsets so fairies don't wobble, flap or twinkle in sync
	phase: number;
	speed: number;
};

// Soft radial gradient: bright center fading to nothing. Computed rather
// than drawn on a canvas: WebKit dithers canvas gradients, and the noise in
// the faint edge showed as colored and black dots once added to the scene.
const createHaloTexture = (): THREE.DataTexture => {
	const size = 128;
	const half = size / 2;
	// Opacity along the radius, as [position, alpha] stops
	const stops = [
		[0, 1],
		[0.15, 0.6],
		[0.45, 0.15],
		[1, 0],
	];
	const alphaAt = (r: number) => {
		for (let i = 1; i < stops.length; i++) {
			const [from, fromAlpha] = stops[i - 1];
			const [to, toAlpha] = stops[i];
			if (r <= to) {
				return THREE.MathUtils.mapLinear(r, from, to, fromAlpha, toAlpha);
			}
		}
		return 0;
	};

	// Always white: only the alpha fades, so no stray color at the edge
	const data = new Uint8Array(size * size * 4).fill(255);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const r = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
			data[(y * size + x) * 4 + 3] = Math.round(alphaAt(r) * 255);
		}
	}

	const texture = new THREE.DataTexture(data, size, size);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.generateMipmaps = true;
	texture.needsUpdate = true;
	return texture;
};

const whitened = (color: THREE.Color, amount: number) =>
	color.clone().lerp(new THREE.Color("#ffffff"), amount);

// A few fairies wandering around Link's house: glowing balls with flapping wings,
// steering toward random points, hovering now and then, with a small wobble
export default class Fairies {
	private readonly fairies: Fairy[] = [];
	private readonly avoidOcarina: THREE.Vector3;
	private readonly haloTexture = createHaloTexture();
	private readonly bodyGeometry = new THREE.SphereGeometry(1, 16, 12);
	private readonly materials: THREE.Material[] = [];

	private readonly params = {
		speed: 1.1,
		wobble: 0.04,
		flapSpeed: 28,
		glow: 18,
		light: 1.5,
	};

	// Seconds left in the celebration of every song learned, 0 the rest of
	// the time, and how far along it is (-1 while there is none)
	private celebrateFor = 0;
	private celebration = -1;

	// Reused every frame
	private readonly steer = new THREE.Vector3();
	private readonly away = new THREE.Vector3();
	private readonly lookTarget = new THREE.Vector3();
	private readonly heading = new THREE.Quaternion();
	private readonly lookMatrix = new THREE.Matrix4();

	// `ocarinaCenter` is kept clear, so fairies circle around it
	constructor(ocarinaCenter: THREE.Vector3) {
		const { resources, scene, debug } = Experience.getInstance();
		this.avoidOcarina = ocarinaCenter.clone();

		const model = resources.get<GLTF>("naviFairy");
		for (let i = 0; i < FAIRY_COUNT; i++) {
			const fairy = this.createFairy(
				i,
				model,
				FAIRY_COLORS[i % FAIRY_COLORS.length],
			);
			scene.add(fairy.group);
			this.fairies.push(fairy);
		}

		const folder = debug.addFolder("Fairies");
		if (folder) {
			folder.add(this.params, "speed", 0, 4, 0.01);
			folder.add(this.params, "wobble", 0, 0.2, 0.001);
			folder.add(this.params, "flapSpeed", 0, 60, 0.1).name("flap speed");
			folder.add(this.params, "glow", 0, 30, 0.1);
			folder.add(this.params, "light", 0, 10, 0.01);
		}
	}

	private createFairy(index: number, model: GLTF, color: string): Fairy {
		const tint = new THREE.Color(color);

		const body = new THREE.Group();
		const coreMaterial = this.track(
			new THREE.MeshBasicMaterial({ color: whitened(tint, CORE_WHITENESS) }),
		);
		body.add(new THREE.Mesh(this.bodyGeometry, coreMaterial));

		const wings = this.createWings(model, body, tint);
		body.scale.setScalar(BODY_RADIUS);

		const halo = new THREE.Sprite(
			this.track(
				new THREE.SpriteMaterial({
					map: this.haloTexture,
					color: tint,
					blending: THREE.AdditiveBlending,
					depthWrite: false,
				}),
			),
		);

		// Lights the ocarina when passing close; the house itself is unlit
		const light = new THREE.PointLight(
			tint,
			this.params.light,
			LIGHT_DISTANCE,
			2,
		);

		const group = new THREE.Group();
		group.add(body, halo, light);

		const position = this.randomTarget(new THREE.Vector3());
		group.position.copy(position);

		return {
			index,
			group,
			body,
			wings,
			halo,
			light,
			position,
			velocity: new THREE.Vector3(),
			target: this.randomTarget(new THREE.Vector3()),
			retargetIn: randFloat(...FIRST_RETARGET_TIME),
			hoverFor: 0,
			phase: Math.random() * 100,
			speed: randFloat(0.8, 1.2),
		};
	}

	// Wings taken from the model, centered and scaled on its (removed) body,
	// then added to `body`
	private createWings(
		model: GLTF,
		body: THREE.Group,
		tint: THREE.Color,
	): Fairy["wings"] {
		const source = model.scene;
		source.updateMatrixWorld(true);
		const bodyNode = source.getObjectByName("body");
		if (!bodyNode) throw new Error('Fairy model has no "body" node');
		const bodyCenter = bodyNode.getWorldPosition(new THREE.Vector3());
		const modelRadius = bodyNode.getWorldScale(new THREE.Vector3()).x;

		const material = this.track(
			new THREE.MeshBasicMaterial({
				color: whitened(tint, WING_WHITENESS),
				transparent: true,
				opacity: WING_OPACITY,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.DoubleSide,
			}),
		);

		const meshes: THREE.Mesh[] = [];
		source.traverse((child) => {
			if (child instanceof THREE.Mesh) meshes.push(child);
		});

		return meshes.map((mesh) => {
			// Hinged on the body, so the wings fold back like a book
			const pivot = new THREE.Group();
			const wing = new THREE.Mesh(mesh.geometry, material);
			mesh.matrixWorld.decompose(wing.position, wing.quaternion, wing.scale);
			wing.position.sub(bodyCenter);
			pivot.add(wing);
			// Sized relative to the model's body, which BODY_RADIUS then scales
			pivot.scale.setScalar(1 / modelRadius);
			body.add(pivot);

			const wingCenter = new THREE.Box3()
				.setFromObject(mesh)
				.getCenter(new THREE.Vector3());
			return { pivot, side: Math.sign(wingCenter.x - bodyCenter.x) || 1 };
		});
	}

	private track<T extends THREE.Material>(material: T): T {
		this.materials.push(material);
		return material;
	}

	private randomTarget(out: THREE.Vector3): THREE.Vector3 {
		const { min, max } = BOUNDS;
		do {
			out.set(
				randFloat(min.x, max.x),
				randFloat(min.y, max.y),
				randFloat(min.z, max.z),
			);
		} while (
			Math.hypot(out.x - this.avoidOcarina.x, out.z - this.avoidOcarina.z) <
			STUMP_CLEARANCE
		);
		return out;
	}

	// Pushes `fairy` out of a sphere around `center`, harder the deeper it is
	private repel(fairy: Fairy, center: THREE.Vector3, radius: number) {
		this.away.subVectors(fairy.position, center);
		const distance = this.away.length();
		if (distance >= radius || distance === 0) return;
		const strength = (1 - distance / radius) * REPEL_STRENGTH;
		this.steer.addScaledVector(this.away.divideScalar(distance), strength);
	}

	private updateFairy(
		fairy: Fairy,
		t: number,
		dt: number,
		camera: THREE.Vector3,
	) {
		const { params } = this;
		const celebrating = this.celebration >= 0;
		const maxSpeed =
			params.speed * fairy.speed * (celebrating ? CELEBRATE_SPEED : 1);

		if (celebrating) {
			// The ring moves on: the arrive steering below chases it
			this.celebrateTarget(fairy);
			fairy.hoverFor = 0;
			// Zero, so a new place to wander is picked the frame it ends
			fairy.retargetIn = 0;
		} else {
			fairy.retargetIn -= dt;
			fairy.hoverFor -= dt;
			if (
				fairy.hoverFor <= 0 &&
				(fairy.position.distanceTo(fairy.target) < ARRIVE_DISTANCE ||
					fairy.retargetIn <= 0)
			) {
				this.randomTarget(fairy.target);
				fairy.retargetIn = randFloat(...RETARGET_TIME);
				// Now and then, stay a moment where it arrived
				if (Math.random() < HOVER_CHANCE)
					fairy.hoverFor = randFloat(...HOVER_TIME);
			}
		}
		const distance = fairy.position.distanceTo(fairy.target);

		// Arrive: full speed far away, slowing down near the target; stop to hover
		if (fairy.hoverFor > 0) {
			this.steer.copy(fairy.velocity).multiplyScalar(-HOVER_BRAKE);
		} else {
			this.steer
				.subVectors(fairy.target, fairy.position)
				.setLength(maxSpeed * Math.min(1, distance / SLOW_DOWN_DISTANCE))
				.sub(fairy.velocity)
				.multiplyScalar(STEER_STRENGTH);
		}
		// The celebration ring is inside the avoid radius
		if (!celebrating)
			this.repel(fairy, this.avoidOcarina, OCARINA_AVOID_RADIUS);
		this.repel(fairy, camera, CAMERA_AVOID_RADIUS);

		fairy.velocity.addScaledVector(this.steer, dt);
		fairy.position.addScaledVector(fairy.velocity, dt);
		// The ring hangs lower than the flight area allows
		if (!celebrating) fairy.position.clamp(BOUNDS.min, BOUNDS.max);

		// Quick jittery wobble on top of the smooth path
		const p = fairy.phase;
		const w = params.wobble;
		fairy.group.position.set(
			fairy.position.x +
				Math.sin(t * 3.1 + p) * w +
				Math.sin(t * 7.3 + p) * w * 0.3,
			fairy.position.y + Math.sin(t * 4.3 + p * 2) * w * 1.2,
			fairy.position.z +
				Math.cos(t * 2.7 + p) * w +
				Math.cos(t * 6.1 + p) * w * 0.3,
		);

		// Turn smoothly toward where it's flying; keep the last heading when hovering
		if (fairy.velocity.lengthSq() > 0.01) {
			this.lookTarget.copy(fairy.group.position).add(fairy.velocity);
			this.lookMatrix.lookAt(
				this.lookTarget,
				fairy.group.position,
				fairy.group.up,
			);
			this.heading.setFromRotationMatrix(this.lookMatrix);
			fairy.body.quaternion.slerp(this.heading, 1 - Math.exp(-TURN_SPEED * dt));
		}

		// Wings fold back and forth, faster and wider when flying
		const effort = Math.min(1, fairy.velocity.length() / maxSpeed || 0);
		const flap =
			0.35 + (0.3 + effort * 0.15) * Math.sin(t * params.flapSpeed + p);
		for (const { pivot, side } of fairy.wings) pivot.rotation.y = side * flap;

		// Gentle twinkle, flaring up at the height of the celebration
		const twinkle = 0.85 + 0.15 * Math.sin(t * 5 + p) * Math.sin(t * 2.3 + p);
		const flare = celebrating
			? 1 + (CELEBRATE_GLOW - 1) * Math.sin(this.celebration * Math.PI)
			: 1;
		fairy.halo.scale.setScalar(BODY_RADIUS * params.glow * twinkle * flare);
		fairy.light.intensity = params.light * twinkle * flare;
	}

	celebrate() {
		this.celebrateFor = CELEBRATE_TIME;
	}

	// The fairy's place on a ring that turns around the ocarina, tightens, then
	// widens again as it rises
	private celebrateTarget(fairy: Fairy) {
		const phase = this.celebration;
		const angle =
			(fairy.index / FAIRY_COUNT + phase * CELEBRATE_TURNS) * Math.PI * 2;
		const [wide, tight] = CELEBRATE_RADIUS;
		const radius = THREE.MathUtils.lerp(wide, tight, Math.sin(phase * Math.PI));
		fairy.target.set(
			this.avoidOcarina.x + Math.cos(angle) * radius,
			this.avoidOcarina.y + phase * CELEBRATE_RISE,
			this.avoidOcarina.z + Math.sin(angle) * radius,
		);
	}

	update() {
		const { time, camera } = Experience.getInstance();
		const t = time.elapsed / 1000;
		const dt = Math.min(time.delta / 1000, MAX_DELTA);
		this.celebrateFor = Math.max(0, this.celebrateFor - dt);
		this.celebration =
			this.celebrateFor > 0 ? 1 - this.celebrateFor / CELEBRATE_TIME : -1;
		for (const fairy of this.fairies) {
			this.updateFairy(fairy, t, dt, camera.instance.position);
		}
	}

	destroy() {
		for (const fairy of this.fairies) {
			fairy.group.removeFromParent();
			fairy.light.dispose();
		}
		this.bodyGeometry.dispose();
		this.haloTexture.dispose();
		for (const material of this.materials) material.dispose();
	}
}
