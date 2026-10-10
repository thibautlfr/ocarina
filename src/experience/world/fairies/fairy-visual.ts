import { faceVelocity } from "steerkit/three";
import * as THREE from "three";
import type { GLTF } from "three/addons";
import { createHaloTexture } from "./halo-texture.ts";

// Radius of the glowing ball (the ocarina is about 1.2 long)
const BODY_RADIUS = 0.05;
// How much the core and the wings are whitened from the fairy's color
const CORE_WHITENESS = 0.6;
const WING_WHITENESS = 0.4;
const WING_OPACITY = 0.45;
const LIGHT_DISTANCE = 3;
// How fast a fairy turns toward where it flies, and the speed below which
// it keeps its heading, when hovering
const TURN = { turnRate: 5, minSpeed: 0.1 };
// Wing angle around the body, in radians: `range` either side of `rest`
// when hovering, `effort` more at full speed
const FLAP = { rest: 0.35, range: 0.3, effort: 0.15 };
// How much the glow dips when twinkling
const TWINKLE = 0.15;

export type LookParams = {
	wobble: number;
	flapSpeed: number;
	glow: number;
	light: number;
};

type Wing = { mesh: THREE.Mesh; side: number };

// Shared by every fairy: the core's sphere, the halo, and the wings of the
// model, placed around its body and sized on it (its body itself is dropped)
export class FairyParts {
	readonly core = new THREE.SphereGeometry(1, 16, 12);
	readonly halo = createHaloTexture();
	readonly wings: Wing[] = [];

	constructor(model: GLTF) {
		const source = model.scene;
		source.updateMatrixWorld(true);
		const body = source.getObjectByName("body");
		if (!body) throw new Error('Fairy model has no "body" node');
		const center = body.getWorldPosition(new THREE.Vector3());
		const radius = body.getWorldScale(new THREE.Vector3()).x;

		source.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			const mesh = new THREE.Mesh(child.geometry);
			child.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
			mesh.position.sub(center).divideScalar(radius);
			mesh.scale.divideScalar(radius);
			const wingCenter = new THREE.Box3()
				.setFromObject(child)
				.getCenter(new THREE.Vector3());
			this.wings.push({ mesh, side: Math.sign(wingCenter.x - center.x) || 1 });
		});
	}

	dispose() {
		this.core.dispose();
		this.halo.dispose();
	}
}

// A glowing ball with flapping wings, a halo, and a light that tints the
// ocarina when passing close (the house itself is unlit)
export default class FairyVisual {
	readonly group = new THREE.Group();
	// Faces where it flies, +Z forward
	private readonly body = new THREE.Group();
	private readonly wings: { pivot: THREE.Group; side: number }[];
	private readonly halo: THREE.Sprite;
	private readonly light: THREE.PointLight;
	private readonly materials: THREE.Material[];
	private readonly params: LookParams;
	// So fairies don't wobble, flap or twinkle in sync
	private readonly phase = Math.random() * 100;

	constructor(color: string, parts: FairyParts, params: LookParams) {
		this.params = params;
		const tint = new THREE.Color(color);
		const whitened = (amount: number) =>
			tint.clone().lerp(new THREE.Color("#ffffff"), amount);

		const core = new THREE.MeshBasicMaterial({
			color: whitened(CORE_WHITENESS),
		});
		const wing = new THREE.MeshBasicMaterial({
			color: whitened(WING_WHITENESS),
			transparent: true,
			opacity: WING_OPACITY,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			side: THREE.DoubleSide,
		});
		const halo = new THREE.SpriteMaterial({
			map: parts.halo,
			color: tint,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		});
		this.materials = [core, wing, halo];

		this.body.add(new THREE.Mesh(parts.core, core));
		// Hinged on the body's center, so the wings fold back like a book
		this.wings = parts.wings.map(({ mesh, side }) => {
			const wingMesh = mesh.clone();
			wingMesh.material = wing;
			const pivot = new THREE.Group().add(wingMesh);
			this.body.add(pivot);
			return { pivot, side };
		});
		this.body.scale.setScalar(BODY_RADIUS);

		this.halo = new THREE.Sprite(halo);
		this.light = new THREE.PointLight(tint, params.light, LIGHT_DISTANCE, 2);
		this.group.add(this.body, this.halo, this.light);
	}

	// Wobbling around `position`, turning toward `velocity`, flapping harder
	// the closer to `maxSpeed`, and twinkling
	update(
		{
			position,
			velocity,
			maxSpeed,
		}: { position: THREE.Vector3; velocity: THREE.Vector3; maxSpeed: number },
		t: number,
		dt: number,
		flare: number,
	) {
		const { params } = this;
		const wave = (rate: number) => Math.sin(t * rate + this.phase);

		// Rates that never line up
		this.group.position
			.set(
				wave(3.1) + 0.3 * wave(7.3),
				1.2 * wave(4.3),
				wave(2.7) + 0.3 * wave(6.1),
			)
			.multiplyScalar(params.wobble)
			.add(position);

		faceVelocity(this.body, velocity, dt, TURN);

		const effort = Math.min(1, velocity.length() / maxSpeed || 0);
		const flap =
			FLAP.rest + (FLAP.range + effort * FLAP.effort) * wave(params.flapSpeed);
		for (const { pivot, side } of this.wings) pivot.rotation.y = side * flap;

		const twinkle = 1 - TWINKLE + TWINKLE * wave(5) * wave(2.3);
		this.halo.scale.setScalar(BODY_RADIUS * params.glow * twinkle * flare);
		this.light.intensity = params.light * twinkle * flare;
	}

	dispose() {
		this.group.removeFromParent();
		this.light.dispose();
		for (const material of this.materials) material.dispose();
	}
}
