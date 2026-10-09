import { add, arrive, brake, keepAway, step, type Vec3, zero } from "steerkit";
import * as THREE from "three";
import type Celebration from "./celebration.ts";
import FairyVisual, {
	type FairyParts,
	type LookParams,
} from "./fairy-visual.ts";

const { randFloat } = THREE.MathUtils;

// Inside the room, above the stump (its top is at y 1.05)
const FLIGHT_AREA = new THREE.Box3(
	new THREE.Vector3(-5, 1.5, -5),
	new THREE.Vector3(5, 3.8, 5),
);
// No target is picked this close to the stump, horizontally
const STUMP_CLEARANCE = 1.6;

// A new target once this one is within `reach`, or after `retargetTime`
// seconds; on retargeting, a `hoverChance` of first hovering a moment
const WANDER = {
	reach: 0.3,
	firstRetargetTime: [3, 7],
	retargetTime: [4, 8],
	hoverChance: 0.35,
	hoverTime: [0.8, 2.5],
} as const;

// Behavior options and weights. The sum is bounded by maxForce, so keeping
// away only wins over arriving by weighing more.
const ARRIVE = { slowingDistance: 1.2, weight: 1.5 };
const BRAKE = { weight: 2 };
const AVOID_OCARINA = { radius: 1.1, weight: 10 };
const AVOID_CAMERA = { radius: 1, weight: 10 };
// Seconds for the celebration's extra speed to fade out
const STEP = { overspeedDamping: 0.6 };

export type FairyParams = LookParams & { speed: number; maxForce: number };

// Reused every frame
const force = new THREE.Vector3();
const behavior = new THREE.Vector3();

// A steerkit agent wandering between random targets, clear of the ocarina
// and the camera
export default class Fairy {
	readonly position: THREE.Vector3;
	readonly velocity = new THREE.Vector3();
	maxSpeed = 0;
	maxForce = 0;

	private readonly target: THREE.Vector3;
	private retargetIn = randFloat(...WANDER.firstRetargetTime);
	private hoverFor = 0;
	// So they don't all fly at the same speed
	private readonly pace = randFloat(0.8, 1.2);

	private readonly ocarina: THREE.Vector3;
	private readonly params: FairyParams;
	private readonly visual: FairyVisual;

	constructor(
		color: string,
		parts: FairyParts,
		ocarina: THREE.Vector3,
		params: FairyParams,
	) {
		this.ocarina = ocarina;
		this.params = params;
		this.visual = new FairyVisual(color, parts, params);
		this.position = this.randomTarget(new THREE.Vector3());
		this.target = this.randomTarget(new THREE.Vector3());
	}

	get object(): THREE.Object3D {
		return this.visual.group;
	}

	wander(dt: number) {
		this.retargetIn -= dt;
		this.hoverFor -= dt;
		const reached = this.position.distanceTo(this.target) < WANDER.reach;
		if (this.hoverFor <= 0 && (reached || this.retargetIn <= 0)) {
			this.retarget();
		}
	}

	retarget() {
		this.randomTarget(this.target);
		this.retargetIn = randFloat(...WANDER.retargetTime);
		this.hoverFor =
			Math.random() < WANDER.hoverChance ? randFloat(...WANDER.hoverTime) : 0;
	}

	// Follows a moving `point`, without hovering
	chase(point: THREE.Vector3) {
		this.target.copy(point);
		this.hoverFor = 0;
	}

	// While celebrating, faster, and free to come close to the ocarina and to
	// leave the flight area, as the ring does
	fly(dt: number, camera: Vec3, celebration: Celebration) {
		const { active: celebrating, speedBoost } = celebration;
		this.maxSpeed = this.params.speed * this.pace * speedBoost;
		// As agile as it is fast, so it keeps up with the ring
		this.maxForce = this.params.maxForce * speedBoost;

		zero(force);
		if (this.hoverFor > 0) {
			add(force, brake(this, behavior), BRAKE.weight);
		} else {
			add(force, arrive(this, this.target, ARRIVE, behavior), ARRIVE.weight);
		}
		if (!celebrating) {
			add(
				force,
				keepAway(this, this.ocarina, AVOID_OCARINA, behavior),
				AVOID_OCARINA.weight,
			);
		}
		add(
			force,
			keepAway(this, camera, AVOID_CAMERA, behavior),
			AVOID_CAMERA.weight,
		);
		step(this, force, dt, STEP);

		if (!celebrating) this.position.clamp(FLIGHT_AREA.min, FLIGHT_AREA.max);
	}

	animate(t: number, dt: number, flare: number) {
		this.visual.update(this, t, dt, flare);
	}

	dispose() {
		this.visual.dispose();
	}

	private randomTarget(out: THREE.Vector3): THREE.Vector3 {
		const { min, max } = FLIGHT_AREA;
		do {
			out.set(
				randFloat(min.x, max.x),
				randFloat(min.y, max.y),
				randFloat(min.z, max.z),
			);
		} while (
			Math.hypot(out.x - this.ocarina.x, out.z - this.ocarina.z) <
			STUMP_CLEARANCE
		);
		return out;
	}
}
