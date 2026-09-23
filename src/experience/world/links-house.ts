import * as THREE from "three";
import type { GLTF } from "three/addons";
import Experience from "../experience.ts";

// The model is in N64 units / 100: the stump is 0.4 wide, the room about 3
const HOUSE_SCALE = 5;
const SHADOW_OPACITY = 0.25;
// Lifts the shadow disc off the stump to avoid z-fighting
const SHADOW_LIFT = 0.002;

// Link's house from OoT: unlit, lighting is baked in the vertex colors
export default class LinksHouse {
	private readonly model: GLTF;
	private readonly stump: THREE.Object3D;
	// Empty node on the stump top, where the ocarina rests
	private readonly ocarinaAnchor: THREE.Object3D;
	private readonly shadowCatcher: THREE.Mesh<
		THREE.CircleGeometry,
		THREE.ShadowMaterial
	>;

	constructor() {
		const { resources, scene, debug } = Experience.getInstance();
		this.model = resources.get<GLTF>("linksHouse");
		this.model.scene.scale.setScalar(HOUSE_SCALE);
		this.model.scene.updateMatrixWorld(true);
		scene.add(this.model.scene);

		// Nearest filtering keeps the low-res N64 textures sharp
		this.model.scene.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			const { map } = child.material as THREE.MeshBasicMaterial;
			if (!map) return;
			map.magFilter = THREE.NearestFilter;
			map.minFilter = THREE.NearestFilter;
			map.generateMipmaps = false;
			map.needsUpdate = true;
		});

		const stump = this.model.scene.getObjectByName("stump");
		if (!stump) throw new Error('Link\'s House model has no "stump" node');
		this.stump = stump;

		const anchor = this.model.scene.getObjectByName("ocarina_anchor");
		if (!anchor) throw new Error('Link\'s House model has no "ocarina_anchor"');
		this.ocarinaAnchor = anchor;

		// The house is unlit, so the ocarina's shadow lands on this invisible disc
		this.shadowCatcher = new THREE.Mesh(
			new THREE.CircleGeometry(this.getStumpRadius(), 32),
			new THREE.ShadowMaterial({ opacity: SHADOW_OPACITY }),
		);
		this.shadowCatcher.rotation.x = -Math.PI / 2;
		this.shadowCatcher.position.copy(this.getStumpTop());
		this.shadowCatcher.position.y += SHADOW_LIFT;
		this.shadowCatcher.receiveShadow = true;
		scene.add(this.shadowCatcher);

		const folder = debug.addFolder("Link's House");
		if (folder) {
			folder.add(this.shadowCatcher, "visible").name("stump shadow");
			folder
				.add(this.shadowCatcher.material, "opacity", 0, 1, 0.01)
				.name("shadow opacity");
		}
	}

	private getStumpBox(): THREE.Box3 {
		return new THREE.Box3().setFromObject(this.stump);
	}

	getStumpTop(): THREE.Vector3 {
		return this.ocarinaAnchor.getWorldPosition(new THREE.Vector3());
	}

	getStumpRadius(): number {
		const size = this.getStumpBox().getSize(new THREE.Vector3());
		return Math.min(size.x, size.z) / 2;
	}

	destroy() {
		this.model.scene.removeFromParent();
		this.shadowCatcher.removeFromParent();
	}
}
