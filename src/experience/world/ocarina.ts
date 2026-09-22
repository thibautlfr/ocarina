import gsap from "gsap";
import * as THREE from "three";
import type { GLTF } from "three/addons";
import type OcarinaSampler from "../audio/ocarina-sampler.ts";
import Experience from "../experience.ts";
import { listen } from "../utils/events.ts";
import type { OcarinaButton } from "../utils/keyboard.ts";

// Float animation: a slow up and down bob, no rotation
const FLOAT_SPEED = 1.5;
const FLOAT_INTENSITY = 0.1;
// Gap kept between the stump and the ocarina at the lowest point of the float
const FLOAT_CLEARANCE = 0.1;
// Multiplies the metallic texture of the model
const METALNESS = 0.5;
const MIN_ROUGHNESS = 0.6;
// How fast the ocarina turns to keep facing the camera (higher = snappier)
const FOLLOW_SPEED = 6;
// Camera azimuth (THREE.Spherical convention) from which the unrotated model
// shows its front: holes and Triforce (the model's +Z face) toward the viewer
const FRONT_AZIMUTH = 0;
// Float and press offsets are tuned for an ocarina this long
const REFERENCE_SIZE = 2;
// Each hold swing lasts this much longer than the previous one
const SWING_SLOWDOWN = 0.15;

// Press reaction — small offsets applied on top of the float
type Pose = {
	y: number;
	rotX: number;
	rotY: number;
	rotZ: number;
	scale: number;
};

const REST: Pose = { y: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };

// Each button leans the ocarina its own way, as if a different finger were pressing.
// The C buttons tilt toward their controller direction.
const NOTE_POSES: Record<OcarinaButton, Pose> = {
	A: { y: -0.05, rotX: 0.04, rotY: 0, rotZ: 0, scale: 0.98 },
	CDown: { y: -0.03, rotX: 0.13, rotY: 0, rotZ: 0, scale: 0.99 },
	CRight: { y: -0.03, rotX: 0, rotY: 0.18, rotZ: -0.05, scale: 0.99 },
	CLeft: { y: -0.03, rotX: 0, rotY: -0.18, rotZ: 0.05, scale: 0.99 },
	CUp: { y: -0.03, rotX: -0.13, rotY: 0, rotZ: 0, scale: 0.99 },
};

export default class Ocarina {
	private readonly model: GLTF;
	private readonly anchor: THREE.Vector3;
	private baseY = 0;
	// The model's size relative to REFERENCE_SIZE
	private unit = 1;

	private readonly floatGroup = new THREE.Group();
	// Turns with the camera around the anchor, so the ocarina always shows its front
	private readonly facingGroup = new THREE.Group();
	private readonly pressGroup = new THREE.Group();
	private readonly press: Pose = { ...REST };
	private pressTimeline: gsap.core.Timeline | null = null;
	private readonly unsubscribes: (() => void)[];

	private readonly params = {
		front: FRONT_AZIMUTH,
		metalness: METALNESS,
	};

	private readonly pressParams = {
		amplitude: 1,
		attack: 0.32,
		duration: 0.42,
		// How far back toward rest the first hold swing goes (0 = stays on pose, 1 = full rest)
		holdReturn: 0.4,
		// Number of back-and-forth swings before settling on the pose
		holdCycles: 3,
		// Each swing keeps this fraction of the previous one's amplitude
		holdDecay: 0.5,
		release: 0.55,
	};

	// Follows what the sampler sounds, so live notes and song replays both animate.
	// Rests on `anchor` (its lowest float point touches it), longest side `size`.
	constructor(sampler: OcarinaSampler, anchor: THREE.Vector3, size: number) {
		const { resources, scene, debug } = Experience.getInstance();
		this.model = resources.get<GLTF>("ocarina");
		this.anchor = anchor.clone();

		this.facingGroup.add(this.pressGroup);
		this.floatGroup.add(this.facingGroup);
		this.floatGroup.position.set(this.anchor.x, 0, this.anchor.z);
		scene.add(this.floatGroup);
		this.fit(size);
		this.facingGroup.rotation.y = this.facingTarget();

		this.model.scene.traverse((child) => {
			child.castShadow = true;
			child.receiveShadow = true;
		});
		this.forEachMaterial((material) => {
			material.roughness = Math.max(material.roughness, MIN_ROUGHNESS);
		});
		this.applyMetalness();

		const folder = debug.addFolder("Ocarina");
		if (folder) {
			folder.add(this.params, "front", -Math.PI, Math.PI, 0.01);
			folder
				.add({ size }, "size", 0.2, 5, 0.01)
				.onChange((v: number) => this.fit(v));
			folder
				.add(this.params, "metalness", 0, 1, 0.01)
				.onChange(() => this.applyMetalness());

			const pressFolder = folder.addFolder("Press");
			pressFolder.add(this.pressParams, "amplitude", 0, 3, 0.01);
			pressFolder.add(this.pressParams, "attack", 0.02, 1, 0.01);
			pressFolder.add(this.pressParams, "duration", 0.05, 2, 0.01);
			pressFolder.add(this.pressParams, "holdReturn", 0, 1, 0.01);
			pressFolder.add(this.pressParams, "holdCycles", 0, 8, 1);
			pressFolder.add(this.pressParams, "holdDecay", 0, 1, 0.01);
			pressFolder.add(this.pressParams, "release", 0.05, 2, 0.01);
		}

		this.unsubscribes = [
			listen(sampler.emitter, "noteOn", (button) => this.playPress(button)),
			listen(sampler.emitter, "noteOff", () => this.releasePress()),
		];
	}

	private forEachMaterial(
		callback: (material: THREE.MeshStandardMaterial) => void,
	) {
		this.model.scene.traverse((child) => {
			if (
				child instanceof THREE.Mesh &&
				child.material instanceof THREE.MeshStandardMaterial
			) {
				callback(child.material);
			}
		});
	}

	// Fully metallic, the blue only shows in reflections, and the brown house
	// has almost no blue to reflect: keep some diffuse color
	private applyMetalness() {
		this.forEachMaterial((material) => {
			material.metalness = this.params.metalness;
		});
	}

	// Scales the model so its longest side is `size`, centered on the float group
	private fit(size: number) {
		// Measured detached, so the float and press transforms don't skew the box
		const scene = this.model.scene;
		scene.removeFromParent();
		scene.position.set(0, 0, 0);
		scene.scale.setScalar(1);
		scene.updateMatrixWorld(true);

		const box = new THREE.Box3().setFromObject(scene);
		const dims = box.getSize(new THREE.Vector3());
		const scale = size / Math.max(dims.x, dims.y, dims.z);
		const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
		scene.scale.setScalar(scale);
		scene.position.sub(center);
		this.pressGroup.add(scene);

		this.unit = size / REFERENCE_SIZE;
		// At sin = -1 the bottom of the model stays FLOAT_CLEARANCE above the anchor
		this.baseY =
			this.anchor.y +
			(dims.y * scale) / 2 +
			(FLOAT_CLEARANCE + FLOAT_INTENSITY) * this.unit;
	}

	// The pose for `button`, at `factor` of its full amplitude
	private scaledPose(button: OcarinaButton, factor: number): Pose {
		const pose = NOTE_POSES[button];
		const k = factor * this.pressParams.amplitude;
		return {
			y: pose.y * k * this.unit,
			rotX: pose.rotX * k,
			rotY: pose.rotY * k,
			rotZ: pose.rotZ * k,
			scale: 1 + (pose.scale - 1) * k,
		};
	}

	private stopPress() {
		this.pressTimeline?.kill();
		this.pressTimeline = null;
		gsap.killTweensOf(this.press);
	}

	// Gentle ease into the pose, then a few damped swings that settle and hold
	private playPress(button: OcarinaButton) {
		this.stopPress();

		const { attack, duration, holdReturn, holdCycles, holdDecay } =
			this.pressParams;
		const pose = this.scaledPose(button, 1);

		this.pressTimeline = gsap
			.timeline()
			.to(this.press, { ...pose, duration: attack, ease: "sine.out" });

		let swing = holdReturn;
		for (let i = 0; i < holdCycles; i++) {
			// Swings get smaller and slightly slower, like a motion losing energy
			const swingDuration = duration * (1 + i * SWING_SLOWDOWN);
			this.pressTimeline
				.to(this.press, {
					...this.scaledPose(button, 1 - swing),
					duration: swingDuration,
					ease: "sine.inOut",
				})
				.to(this.press, {
					...pose,
					duration: swingDuration,
					ease: "sine.inOut",
				});
			swing *= holdDecay;
		}
	}

	// Ease back to rest from wherever the loop currently is, with a tiny overshoot
	private releasePress() {
		this.stopPress();

		gsap.to(this.press, {
			...REST,
			duration: this.pressParams.release,
			ease: "back.out(1.4)",
		});
	}

	// Angle of the camera around the anchor, in the same convention as THREE.Spherical
	private cameraAzimuth(): number {
		const { position } = Experience.getInstance().camera.instance;
		return Math.atan2(position.x - this.anchor.x, position.z - this.anchor.z);
	}

	private facingTarget(): number {
		return this.cameraAzimuth() - this.params.front;
	}

	private followCamera(deltaSeconds: number) {
		const current = this.facingGroup.rotation.y;
		// Shortest way around, so crossing ±π doesn't spin the ocarina
		const diff =
			THREE.MathUtils.euclideanModulo(
				this.facingTarget() - current + Math.PI,
				Math.PI * 2,
			) - Math.PI;
		const smoothing = 1 - Math.exp(-FOLLOW_SPEED * deltaSeconds);
		this.facingGroup.rotation.y = current + diff * smoothing;
	}

	update() {
		const { elapsed, delta } = Experience.getInstance().time;

		this.followCamera(delta / 1000);

		this.floatGroup.position.y =
			this.baseY +
			Math.sin((elapsed / 1000) * FLOAT_SPEED) * FLOAT_INTENSITY * this.unit;

		this.pressGroup.position.y = this.press.y;
		this.pressGroup.rotation.set(
			this.press.rotX,
			this.press.rotY,
			this.press.rotZ,
		);
		this.pressGroup.scale.setScalar(this.press.scale);
	}

	destroy() {
		for (const unsubscribe of this.unsubscribes) unsubscribe();
		this.stopPress();
		this.floatGroup.removeFromParent();
	}
}
