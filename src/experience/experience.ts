import * as THREE from "three";
import OcarinaSampler from "./audio/ocarina-sampler.ts";
import Camera from "./camera.ts";
import Keyboard from "./input/keyboard.ts";
import Renderer from "./renderer.ts";
import Settings from "./settings.ts";
import SongDetector from "./songs/song-detector.ts";
import SongProgress from "./songs/song-progress.ts";
import { sources } from "./sources.ts";
import AboutMenu from "./ui/about-menu.ts";
import Completion from "./ui/completion.ts";
import SettingsMenu from "./ui/settings-menu.ts";
import SongBook from "./ui/song-book.ts";
import TitleScreen from "./ui/title-screen.ts";
import TouchControls from "./ui/touch-controls.ts";
import Debug from "./utils/debug.ts";
import Resources from "./utils/resources.ts";
import Sizes from "./utils/sizes.ts";
import Time from "./utils/time.ts";
import World from "./world/world.ts";

declare global {
	interface Window {
		experience: Experience;
	}
}

export default class Experience {
	private static instance: Experience | null = null;

	readonly canvas: HTMLCanvasElement;
	readonly sizes: Sizes;
	readonly scene: THREE.Scene;
	readonly camera: Camera;
	readonly renderer: Renderer;
	readonly world: World;
	readonly settingsMenu: SettingsMenu;
	readonly songBook: SongBook;
	readonly aboutMenu: AboutMenu;
	readonly completion: Completion;
	readonly touchControls: TouchControls;
	readonly titleScreen: TitleScreen;
	readonly debug: Debug;
	readonly settings: Settings;
	readonly time: Time;
	readonly keyboard: Keyboard;
	readonly songDetector: SongDetector;
	readonly songProgress: SongProgress;
	readonly resources: Resources;
	readonly sampler: OcarinaSampler;

	static getInstance(canvas?: HTMLCanvasElement): Experience {
		if (Experience.instance) return Experience.instance;
		if (!canvas) throw new Error("Canvas is required to initialize Experience");
		// The constructor registers the instance first: the classes it creates
		// call getInstance() themselves
		return new Experience(canvas);
	}

	private constructor(canvas: HTMLCanvasElement) {
		Experience.instance = this;
		this.canvas = canvas;

		this.debug = new Debug();
		this.settings = new Settings();
		this.sizes = new Sizes();
		this.time = new Time();
		this.keyboard = new Keyboard();
		this.songDetector = new SongDetector();
		this.songProgress = new SongProgress();
		this.scene = new THREE.Scene();
		this.resources = new Resources(sources);
		this.sampler = new OcarinaSampler();
		this.camera = new Camera();
		this.renderer = new Renderer();
		this.world = new World();
		this.settingsMenu = new SettingsMenu();
		this.songBook = new SongBook();
		this.aboutMenu = new AboutMenu();
		this.completion = new Completion();
		this.touchControls = new TouchControls();
		// Last: it hides the UI above until Start, and tracks the loading
		this.titleScreen = new TitleScreen();

		this.debug.initStats(this.renderer.instance);

		this.sizes.emitter.on("resize", () => this.resize());
		this.time.emitter.on("tick", () => this.update());

		window.experience = this;
	}

	private resize() {
		this.camera.resize();
		this.renderer.resize();
	}

	private update() {
		this.debug.begin();

		this.camera.update();
		this.world.update();
		this.renderer.update();

		this.debug.end();
	}

	destroy() {
		this.titleScreen.destroy();
		this.touchControls.destroy();
		this.completion.destroy();
		this.aboutMenu.destroy();
		this.songBook.destroy();
		this.settingsMenu.destroy();
		this.time.destroy();
		this.songProgress.destroy();
		this.songDetector.destroy();
		this.keyboard.destroy();
		this.sizes.destroy();
		this.world.destroy();
		this.sampler.destroy();
		this.camera.destroy();
		this.renderer.destroy();
		this.settings.destroy();
		this.debug.destroy();
		this.resources.destroy();

		this.scene.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			child.geometry.dispose();
			for (const material of [child.material].flat()) material.dispose();
		});

		Experience.instance = null;
	}
}
