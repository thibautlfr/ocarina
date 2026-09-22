import * as THREE from "three";
import Camera from "./camera.ts";
import Renderer from "./renderer.ts";
import { sources } from "./sources.ts";
import AboutMenu from "./ui/about-menu.ts";
import Completion from "./ui/completion.ts";
import SettingsMenu from "./ui/settings-menu.ts";
import SongBook from "./ui/song-book.ts";
import TitleScreen from "./ui/title-screen.ts";
import TouchControls from "./ui/touch-controls.ts";
import Debug from "./utils/debug.ts";
import Keyboard from "./utils/keyboard.ts";
import Resources from "./utils/resources.ts";
import Settings from "./utils/settings.ts";
import Sizes from "./utils/sizes.ts";
import SongDetector from "./utils/song-detector.ts";
import SongProgress from "./utils/song-progress.ts";
import Time from "./utils/time.ts";
import World from "./world/world.ts";

declare global {
	interface Window {
		experience: Experience;
	}
}

export default class Experience {
	private static instance: Experience | null = null;

	canvas: HTMLCanvasElement;
	sizes: Sizes;
	scene: THREE.Scene;
	camera: Camera;
	renderer: Renderer;
	world: World;
	settingsMenu: SettingsMenu;
	songBook: SongBook;
	aboutMenu: AboutMenu;
	completion: Completion;
	touchControls: TouchControls;
	titleScreen: TitleScreen;
	debug: Debug;
	settings: Settings;
	time: Time;
	keyboard: Keyboard;
	songDetector: SongDetector;
	songProgress: SongProgress;
	resources: Resources;

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
