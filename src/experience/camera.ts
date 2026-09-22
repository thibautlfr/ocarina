import gsap from "gsap";
import * as THREE from "three";
import { OrbitControls } from "three/addons";
import Experience from "./experience.ts";

// Vertical field of view, in degrees, on screens wide enough
const BASE_FOV = 35;
// Below this aspect ratio (portrait phones), the field of view widens so the
// horizontal framing stays the same as at this ratio, instead of the stump
// and the ocarina filling the whole width
const MIN_FRAMED_ASPECT = 0.68;
// Far and low near the door: table on the left, sign and bed behind the stump
const START_POSITION = new THREE.Vector3(-3.29, 2.32, -4.61);
// The top of the stump in Link's house (HOUSE_SCALE 5)
const ORBIT_TARGET = new THREE.Vector3(0, 1.05, 0);
// Keeps the camera inside the room, and the ocarina from filling the screen
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 6;
// Measured from straight above, in radians
const MIN_POLAR_ANGLE = 1.15;
const MAX_POLAR_ANGLE = 1.4;

// One slow swing around the stump when the experience starts: nothing else
// tells the player the view can be taken hold of. It drops the moment they
// take it, and never plays again. The camera waits this far short of
// START_POSITION and swings onto it, so the drift lands on the framing the
// scene was built around instead of leaving the player beside it.
const DRIFT_ANGLE = THREE.MathUtils.degToRad(10);
const DRIFT_DURATION = 2;
// Long enough for the title screen to be out of the way
const DRIFT_DELAY = 0.4;
const UP = new THREE.Vector3(0, 1, 0);

// A camera that moves on its own is what a player sensitive to motion asked
// not to have: they start on the framing, and nothing swings
const reducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default class Camera {
	readonly instance = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 100);
	readonly controls: OrbitControls;
	private readonly experience = Experience.getInstance();
	private driftTween: gsap.core.Tween | null = null;
	// How far the camera still is from START_POSITION, in radians
	private driftFrom = 0;
	private readonly params = {
		baseFov: BASE_FOV,
		minFramedAspect: MIN_FRAMED_ASPECT,
	};

	constructor() {
		this.fitToScreen();
		this.instance.position.copy(START_POSITION);
		this.experience.scene.add(this.instance);

		this.controls = new OrbitControls(this.instance, this.experience.canvas);
		this.controls.enableDamping = true;
		this.controls.enablePan = false;
		this.controls.target.copy(ORBIT_TARGET);
		this.controls.minDistance = MIN_DISTANCE;
		this.controls.maxDistance = MAX_DISTANCE;
		this.controls.minPolarAngle = MIN_POLAR_ANGLE;
		this.controls.maxPolarAngle = MAX_POLAR_ANGLE;

		// Set before the first frame, so the title screen already shows the
		// scene from where the swing begins: nothing jumps on Start
		if (!reducedMotion()) {
			this.driftFrom = -DRIFT_ANGLE;
			this.orbitBy(this.driftFrom);
		}
		this.controls.update();

		const folder = this.experience.debug.addFolder("Camera");
		if (folder) {
			folder.add(this.controls, "minDistance", 0, 20, 0.01);
			folder.add(this.controls, "maxDistance", 0, 20, 0.01);
			folder.add(this.controls, "minPolarAngle", 0, Math.PI, 0.01);
			folder.add(this.controls, "maxPolarAngle", 0, Math.PI, 0.01);
			folder
				.add(this.params, "baseFov", 15, 90, 1)
				.onChange(() => this.fitToScreen());
			folder
				.add(this.params, "minFramedAspect", 0.3, 2, 0.01)
				.onChange(() => this.fitToScreen());
		}
	}

	// Played once, on Start: the camera swings the last few degrees onto its
	// framing, and the player sees that the view moves before wondering.
	drift() {
		if (this.driftFrom === 0) return;

		// The tween holds the angle left to cover; the camera is turned by what
		// changed each frame, so a player taking over isn't fought
		const swing = { angle: this.driftFrom };
		let applied = this.driftFrom;
		this.driftFrom = 0;
		this.controls.addEventListener("start", this.stopDrift);
		this.driftTween = gsap.to(swing, {
			angle: 0,
			duration: DRIFT_DURATION,
			delay: DRIFT_DELAY,
			ease: "sine.inOut",
			onUpdate: () => {
				this.orbitBy(swing.angle - applied);
				applied = swing.angle;
			},
			onComplete: this.stopDrift,
		});
	}

	// The player has taken the view: it's theirs from here
	private stopDrift = () => {
		this.controls.removeEventListener("start", this.stopDrift);
		this.driftTween?.kill();
		this.driftTween = null;
	};

	// Turns the camera around the orbit target, keeping its distance and height.
	// `controls.update()` reads the position back every frame, so damping and
	// the limits go on working.
	private orbitBy(angle: number) {
		const offset = this.instance.position
			.clone()
			.sub(this.controls.target)
			.applyAxisAngle(UP, angle);
		this.instance.position.copy(this.controls.target).add(offset);
	}

	resize() {
		this.fitToScreen();
	}

	private fitToScreen() {
		const { width, height } = this.experience.sizes;
		const { baseFov, minFramedAspect } = this.params;
		const aspect = width / height;

		let fov = baseFov;
		if (aspect < minFramedAspect) {
			// Same horizontal extent as the base fov at minFramedAspect
			const halfTan =
				(Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * minFramedAspect) /
				aspect;
			fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfTan));
		}

		this.instance.aspect = aspect;
		this.instance.fov = fov;
		this.instance.updateProjectionMatrix();
	}

	update() {
		this.controls.update();
	}

	destroy() {
		this.stopDrift();
		this.controls.dispose();
	}
}
