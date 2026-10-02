import * as THREE from "three";
import type { GLTF } from "three/addons";
import Experience from "../experience.ts";
import { createHaloTexture } from "./halo-texture.ts";

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

// Quick jitter on top of the smooth path: sine waves on each axis, as
// [rate in rad/s, share of the wobble param], at rates that never line up
const WOBBLE_WAVES = {
	x: [
		[3.1, 1],
		[7.3, 0.3],
	],
	y: [[4.3, 1.2]],
	z: [
		[2.7, 1],
		[6.1, 0.3],
	],
} as const;
// Wing angle around the body, in radians: the wings swing FLAP_RANGE either
// side of FLAP_REST when hovering, FLAP_EFFORT more at full speed
const FLAP_REST = 0.35;
const FLAP_RANGE = 0.3;
const FLAP_EFFORT = 0.15;
// The glow dips by up to TWINKLE_DEPTH, two waves beating together, in rad/s
const TWINKLE_DEPTH = 0.15;
const TWINKLE_RATES = [5, 2.3] as const;

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

	// Seconds into the celebration of every song learned, null the rest of
	// the time
	private celebrationTime: number | null = null;

	// Reused every frame
	private readonly steering = new THREE.Vector3();
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
		this.steering.addScaledVector(this.away.divideScalar(distance), strength);
	}

	// How far along the celebration is, from 0 to 1, or null when there's none
	private get celebrationProgress(): number | null {
		return this.celebrationTime === null
			? null
			: this.celebrationTime / CELEBRATE_TIME;
	}

	celebrate() {
		this.celebrationTime = 0;
	}

	// The fairies scatter again, each toward a new place to wander
	private endCelebration() {
		this.celebrationTime = null;
		for (const fairy of this.fairies) this.retarget(fairy);
	}

	private updateFairy(
		fairy: Fairy,
		t: number,
		dt: number,
		camera: THREE.Vector3,
	) {
		const progress = this.celebrationProgress;
		const celebrating = progress !== null;
		const maxSpeed =
			this.params.speed * fairy.speed * (celebrating ? CELEBRATE_SPEED : 1);

		if (celebrating) {
			// The ring moves on: the arrive steering chases it
			this.celebrateTarget(fairy, progress);
			fairy.hoverFor = 0;
		} else {
			this.wander(fairy, dt);
		}
		this.fly(fairy, dt, maxSpeed, camera, celebrating);
		this.place(fairy, t);
		this.orient(fairy, dt);
		this.animate(fairy, t, maxSpeed, progress);
	}

	// A new target once this one is reached or taking too long, unless hovering
	private wander(fairy: Fairy, dt: number) {
		fairy.retargetIn -= dt;
		fairy.hoverFor -= dt;
		const arrived = fairy.position.distanceTo(fairy.target) < ARRIVE_DISTANCE;
		if (fairy.hoverFor <= 0 && (arrived || fairy.retargetIn <= 0)) {
			this.retarget(fairy);
		}
	}

	private retarget(fairy: Fairy) {
		this.randomTarget(fairy.target);
		fairy.retargetIn = randFloat(...RETARGET_TIME);
		// Now and then, stay a moment where it arrived
		fairy.hoverFor =
			Math.random() < HOVER_CHANCE ? randFloat(...HOVER_TIME) : 0;
	}

	// Arrive: full speed far away, slowing down near the target; stop to hover.
	// Steers clear of the camera, and of the ocarina unless celebrating.
	private fly(
		fairy: Fairy,
		dt: number,
		maxSpeed: number,
		camera: THREE.Vector3,
		celebrating: boolean,
	) {
		if (fairy.hoverFor > 0) {
			this.steering.copy(fairy.velocity).multiplyScalar(-HOVER_BRAKE);
		} else {
			const distance = fairy.position.distanceTo(fairy.target);
			this.steering
				.subVectors(fairy.target, fairy.position)
				.setLength(maxSpeed * Math.min(1, distance / SLOW_DOWN_DISTANCE))
				.sub(fairy.velocity)
				.multiplyScalar(STEER_STRENGTH);
		}
		// The celebration ring is inside the avoid radius
		if (!celebrating) {
			this.repel(fairy, this.avoidOcarina, OCARINA_AVOID_RADIUS);
		}
		this.repel(fairy, camera, CAMERA_AVOID_RADIUS);

		fairy.velocity.addScaledVector(this.steering, dt);
		fairy.position.addScaledVector(fairy.velocity, dt);
		// The ring hangs lower than the flight area allows
		if (!celebrating) fairy.position.clamp(BOUNDS.min, BOUNDS.max);
	}

	// Shown at its position, plus the wobble
	private place(fairy: Fairy, t: number) {
		const wobble = (waves: readonly (readonly [number, number])[]) =>
			waves.reduce(
				(sum, [rate, share]) =>
					sum + Math.sin(t * rate + fairy.phase) * share * this.params.wobble,
				0,
			);
		fairy.group.position.set(
			fairy.position.x + wobble(WOBBLE_WAVES.x),
			fairy.position.y + wobble(WOBBLE_WAVES.y),
			fairy.position.z + wobble(WOBBLE_WAVES.z),
		);
	}

	// Turn smoothly toward where it's flying; keep the last heading when hovering
	private orient(fairy: Fairy, dt: number) {
		if (fairy.velocity.lengthSq() <= 0.01) return;
		this.lookTarget.copy(fairy.group.position).add(fairy.velocity);
		this.lookMatrix.lookAt(
			this.lookTarget,
			fairy.group.position,
			fairy.group.up,
		);
		this.heading.setFromRotationMatrix(this.lookMatrix);
		fairy.body.quaternion.slerp(this.heading, 1 - Math.exp(-TURN_SPEED * dt));
	}

	// Wings flapping faster and wider when flying, and a twinkling glow that
	// flares up at the height of the celebration
	private animate(
		fairy: Fairy,
		t: number,
		maxSpeed: number,
		celebration: number | null,
	) {
		const { params } = this;
		const p = fairy.phase;

		const effort = Math.min(1, fairy.velocity.length() / maxSpeed || 0);
		const flap =
			FLAP_REST +
			(FLAP_RANGE + effort * FLAP_EFFORT) * Math.sin(t * params.flapSpeed + p);
		for (const { pivot, side } of fairy.wings) pivot.rotation.y = side * flap;

		const [rateA, rateB] = TWINKLE_RATES;
		const twinkle =
			1 -
			TWINKLE_DEPTH +
			TWINKLE_DEPTH * Math.sin(t * rateA + p) * Math.sin(t * rateB + p);
		const flare =
			celebration === null
				? 1
				: 1 + (CELEBRATE_GLOW - 1) * Math.sin(celebration * Math.PI);
		fairy.halo.scale.setScalar(BODY_RADIUS * params.glow * twinkle * flare);
		fairy.light.intensity = params.light * twinkle * flare;
	}

	// The fairy's place on a ring that turns around the ocarina, tightens, then
	// widens again as it rises
	private celebrateTarget(fairy: Fairy, progress: number) {
		const angle =
			(fairy.index / FAIRY_COUNT + progress * CELEBRATE_TURNS) * Math.PI * 2;
		const [wide, tight] = CELEBRATE_RADIUS;
		const radius = THREE.MathUtils.lerp(
			wide,
			tight,
			Math.sin(progress * Math.PI),
		);
		fairy.target.set(
			this.avoidOcarina.x + Math.cos(angle) * radius,
			this.avoidOcarina.y + progress * CELEBRATE_RISE,
			this.avoidOcarina.z + Math.sin(angle) * radius,
		);
	}

	update() {
		const { time, camera } = Experience.getInstance();
		const t = time.elapsed / 1000;
		const dt = Math.min(time.delta / 1000, MAX_DELTA);
		if (this.celebrationTime !== null) {
			this.celebrationTime += dt;
			if (this.celebrationTime >= CELEBRATE_TIME) this.endCelebration();
		}
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
