import { SteeringHelper } from "steerkit/three";
import * as THREE from "three";
import type { GLTF } from "three/addons";
import Experience from "../../experience.ts";
import Celebration from "./celebration.ts";
import Fairy, { drawZones, type FairyParams } from "./fairy.ts";
import { FairyParts } from "./fairy-visual.ts";

// One fairy each: Navi, Tatl, Tael and a Great Fairy pink
const COLORS = ["#7fd4ff", "#fff1a0", "#c49bff", "#ff9fd8"];
// So a background tab doesn't send the fairies flying on return
const MAX_DELTA = 0.05;

// A few fairies wandering around Link's house, gathering around the ocarina
// to celebrate
export default class Fairies {
	private readonly params: FairyParams = {
		speed: 1.1,
		maxForce: 6,
		wobble: 0.04,
		flapSpeed: 28,
		glow: 18,
		light: 1.5,
	};
	private readonly parts: FairyParts;
	private readonly fairies: Fairy[];
	private readonly celebration: Celebration;
	private readonly ringPoint = new THREE.Vector3();
	private readonly ocarina: THREE.Vector3;
	// The steering forces and zones drawn over the scene, in debug mode only
	private readonly helper: SteeringHelper | null = null;

	// `ocarinaCenter` is kept clear, so the fairies circle around it
	constructor(ocarinaCenter: THREE.Vector3) {
		const { resources, scene, debug } = Experience.getInstance();
		const ocarina = ocarinaCenter.clone();
		this.ocarina = ocarina;

		this.parts = new FairyParts(resources.get<GLTF>("naviFairy"));
		this.celebration = new Celebration(ocarina);
		this.fairies = COLORS.map(
			(color) => new Fairy(color, this.parts, ocarina, this.params),
		);
		for (const fairy of this.fairies) scene.add(fairy.object);

		const folder = debug.addControls("Fairies", this.params, {
			speed: [0, 4, 0.01],
			maxForce: [0, 20, 0.01, "max force"],
			wobble: [0, 0.2, 0.001],
			flapSpeed: [0, 60, 0.1, "flap speed"],
			glow: [0, 30, 0.1],
			light: [0, 10, 0.01],
		});
		if (folder) {
			const helper = new SteeringHelper();
			// Seen through the house and the stump
			helper.material.depthTest = false;
			helper.visible = false;
			scene.add(helper);
			folder.add(helper, "visible").name("forces");
			this.helper = helper;
		}
	}

	celebrate() {
		this.celebration.start();
	}

	update() {
		const { time, camera } = Experience.getInstance();
		const { celebration, fairies } = this;
		const t = time.elapsed / 1000;
		const dt = Math.min(time.delta / 1000, MAX_DELTA);

		// Once over, they scatter again
		if (celebration.advance(dt)) {
			for (const fairy of fairies) fairy.retarget();
		}

		fairies.forEach((fairy, i) => {
			if (celebration.active) {
				fairy.chase(celebration.ringPoint(i / fairies.length, this.ringPoint));
			} else {
				fairy.wander(dt);
			}
			fairy.fly(dt, camera.instance.position, celebration);
			fairy.animate(t, dt, celebration.flare);
		});
		this.drawForces();
	}

	private drawForces() {
		const { helper } = this;
		if (!helper?.visible) return;
		helper.reset();
		drawZones(helper, this.ocarina, this.celebration.active);
		for (const fairy of this.fairies) fairy.drawForces(helper);
	}

	destroy() {
		for (const fairy of this.fairies) fairy.dispose();
		this.helper?.removeFromParent();
		this.helper?.dispose();
		this.parts.dispose();
	}
}
