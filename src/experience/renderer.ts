import * as THREE from "three";
import Experience from "./experience.ts";

export default class Renderer {
	readonly instance: THREE.WebGLRenderer;
	private readonly experience = Experience.getInstance();

	constructor() {
		this.instance = new THREE.WebGLRenderer({
			canvas: this.experience.canvas,
			antialias: true,
		});
		this.instance.shadowMap.enabled = true;
		this.instance.shadowMap.type = THREE.PCFShadowMap;
		this.instance.setClearColor("#000000");
		this.resize();
	}

	resize() {
		const { width, height, pixelRatio } = this.experience.sizes;
		this.instance.setSize(width, height);
		this.instance.setPixelRatio(pixelRatio);
	}

	update() {
		this.instance.render(
			this.experience.scene,
			this.experience.camera.instance,
		);
	}

	destroy() {
		this.instance.dispose();
	}
}
