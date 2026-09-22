import mitt from "mitt";
import * as THREE from "three";
import { GLTFLoader } from "three/addons";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { LoadedAsset, Source } from "../sources.ts";

type ResourcesEvents = {
	ready: undefined;
	progress: { loaded: number; total: number };
};

// Asset paths are relative to the site root, which is a subfolder on GitHub Pages
const resolvePath = (path: string) =>
	`${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

export default class Resources {
	readonly emitter = mitt<ResourcesEvents>();
	private readonly items = new Map<string, LoadedAsset>();
	private readonly total: number;
	private loaded = 0;

	// The models' geometry is Meshopt-compressed (see README): a few hundred
	// kilobytes instead of megabytes, decoded by this 32 kB module
	private readonly gltfLoader = new GLTFLoader().setMeshoptDecoder(
		MeshoptDecoder,
	);
	private readonly textureLoader = new THREE.TextureLoader();
	private readonly cubeTextureLoader = new THREE.CubeTextureLoader();
	// Decodes without a real AudioContext, which browsers only allow after a user
	// gesture. The buffers stay playable in any context, resampled if needed.
	private readonly audioDecoder = new OfflineAudioContext(1, 1, 44100);

	constructor(sources: readonly Source[]) {
		this.total = sources.length;

		if (this.total === 0) {
			queueMicrotask(() => this.emitter.emit("ready"));
			return;
		}

		for (const source of sources) this.load(source);
	}

	// The asset named `name` in sources.ts, as the type its loader produces
	get<T extends LoadedAsset>(name: string): T {
		const item = this.items.get(name);
		if (item === undefined) {
			throw new Error(`Resource "${name}" is not loaded yet`);
		}
		return item as T;
	}

	private load(source: Source) {
		const done = (asset: LoadedAsset) => this.add(source.name, asset);

		switch (source.type) {
			case "gltfModel":
				this.gltfLoader.load(resolvePath(source.path), done);
				break;
			case "texture":
				this.textureLoader.load(resolvePath(source.path), done);
				break;
			case "cubeTexture":
				this.cubeTextureLoader.load(source.path.map(resolvePath), done);
				break;
			case "audio":
				fetch(resolvePath(source.path))
					.then((response) => response.arrayBuffer())
					.then((data) => this.audioDecoder.decodeAudioData(data))
					.then(done);
				break;
		}
	}

	private add(name: string, asset: LoadedAsset) {
		this.items.set(name, asset);
		this.loaded++;

		this.emitter.emit("progress", { loaded: this.loaded, total: this.total });
		if (this.loaded === this.total) this.emitter.emit("ready");
	}

	destroy() {
		this.items.clear();
	}
}
