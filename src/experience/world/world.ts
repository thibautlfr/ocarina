import * as THREE from "three";
import OcarinaSampler, {
	type ScheduledNote,
	schedule,
} from "../audio/ocarina-sampler.ts";
import Experience from "../experience.ts";
import SongPlayback from "../songs/song-playback.ts";
import Fairies from "./fairies.ts";
import LinksHouse from "./links-house.ts";
import Ocarina from "./ocarina.ts";

// Longest side of the ocarina relative to the stump diameter
const OCARINA_STUMP_RATIO = 0.6;
// Resolution of each face of the house capture used for reflections
const ENVIRONMENT_SIZE = 256;
// Height of that capture above the stump, in stump radii
const ENVIRONMENT_HEIGHT = 0.5;
// Where the sun shines from, relative to the stump top
const SUN_OFFSET = new THREE.Vector3(2, 6, -1.5);
// Half-size of the shadow camera, in stump radii
const SHADOW_EXTENT = 1.5;

// The celebration fanfare: the five notes, up to a held D5
const FANFARE_DELAY = 0.15;
const FANFARE: readonly Omit<ScheduledNote, "time">[] = [
	{ button: "A", duration: 0.18 },
	{ button: "CDown", duration: 0.18 },
	{ button: "CRight", duration: 0.18 },
	{ button: "CLeft", duration: 0.18 },
	{ button: "CUp", duration: 1.4 },
];
// The fanfare plus time for its last note to ring out, in seconds
const CELEBRATION_TIME = 3.4;

export default class World {
	// Created once resources are ready
	sampler: OcarinaSampler | null = null;
	private house: LinksHouse | null = null;
	private ocarina: Ocarina | null = null;
	private fairies: Fairies | null = null;
	private songPlayback: SongPlayback | null = null;
	private environment: THREE.Texture | null = null;
	private readonly sun = new THREE.DirectionalLight("#fff0d6", 2.5);
	private readonly experience = Experience.getInstance();

	constructor() {
		const { scene, resources, debug } = this.experience;

		// Only the ocarina is lit: the house carries its own baked lighting
		// and is captured as the ocarina's reflections once loaded
		scene.environmentIntensity = 1.5;

		const ambientLight = new THREE.AmbientLight("#ffe2b8", 0.6);
		scene.add(ambientLight);

		// Warm light falling on the stump, like the sun through the window
		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(1024, 1024);
		this.sun.shadow.bias = -0.0005;
		scene.add(this.sun, this.sun.target);

		const folder = debug.addFolder("Lights");
		if (folder) {
			folder.add(scene, "environmentIntensity", 0, 2, 0.01);
			folder.add(ambientLight, "intensity", 0, 3, 0.01).name("ambient");
			folder.addColor(ambientLight, "color").name("ambient color");
			folder.add(this.sun, "intensity", 0, 10, 0.01).name("sun");
			folder.addColor(this.sun, "color").name("sun color");
			folder.add(this.sun.position, "x", -10, 10, 0.01);
			folder.add(this.sun.position, "y", 0, 15, 0.01);
			folder.add(this.sun.position, "z", -10, 10, 0.01);
		}

		resources.emitter.on("ready", this.build);
	}

	private build = () => {
		this.house = new LinksHouse();
		const stumpTop = this.house.getStumpTop();
		const stumpRadius = this.house.getStumpRadius();
		const aboveStump = (height: number) =>
			stumpTop.clone().setY(stumpTop.y + height);

		this.aimSun(stumpTop, stumpRadius);
		// Captured before the ocarina exists, so it doesn't reflect itself
		this.captureEnvironment(aboveStump(stumpRadius * ENVIRONMENT_HEIGHT));

		this.sampler = new OcarinaSampler();
		this.songPlayback = new SongPlayback(this.sampler);
		this.ocarina = new Ocarina(
			this.sampler,
			stumpTop,
			stumpRadius * 2 * OCARINA_STUMP_RATIO,
		);
		this.fairies = new Fairies(aboveStump(stumpRadius * OCARINA_STUMP_RATIO));
	};

	// Once every song is learned. Returns how long it lasts, in seconds (the
	// fairies take longer to scatter again).
	celebrate(): number {
		this.fairies?.celebrate();
		if (this.sampler) {
			this.sampler.unlock();
			this.sampler.playSequence(
				schedule(FANFARE, this.sampler.currentTime + FANFARE_DELAY),
			);
		}
		return CELEBRATION_TIME;
	}

	// Renders the house around `position` into a prefiltered environment map.
	// The scene is static, so a single capture is enough.
	private captureEnvironment(position: THREE.Vector3) {
		const { scene, renderer } = this.experience;

		const cubeTarget = new THREE.WebGLCubeRenderTarget(ENVIRONMENT_SIZE, {
			type: THREE.HalfFloatType,
		});
		const cubeCamera = new THREE.CubeCamera(0.05, 100, cubeTarget);
		cubeCamera.position.copy(position);
		cubeCamera.update(renderer.instance, scene);

		const pmrem = new THREE.PMREMGenerator(renderer.instance);
		this.environment = pmrem.fromCubemap(cubeTarget.texture).texture;
		scene.environment = this.environment;
		pmrem.dispose();
		cubeTarget.dispose();
	}

	// Shadow camera tight around the stump so the ocarina's shadow stays sharp
	private aimSun(target: THREE.Vector3, radius: number) {
		this.sun.target.position.copy(target);
		this.sun.position.copy(target).add(SUN_OFFSET);

		const camera = this.sun.shadow.camera;
		const extent = radius * SHADOW_EXTENT;
		camera.left = -extent;
		camera.right = extent;
		camera.top = extent;
		camera.bottom = -extent;
		camera.near = 0.1;
		camera.far = 20;
		camera.updateProjectionMatrix();
	}

	update() {
		this.ocarina?.update();
		this.fairies?.update();
	}

	destroy() {
		this.experience.resources.emitter.off("ready", this.build);
		this.ocarina?.destroy();
		this.fairies?.destroy();
		this.songPlayback?.destroy();
		this.sampler?.destroy();
		this.house?.destroy();
		this.environment?.dispose();
	}
}
