import type { GLTF } from "three/addons";

export interface Source {
	readonly name: string;
	readonly type: "gltfModel" | "audio";
	// From the site root
	readonly path: string;
}

export type LoadedAsset = GLTF | AudioBuffer;

export const sources: Source[] = [
	{
		name: "ocarina",
		type: "gltfModel",
		path: "/models/ocarina_of_time.glb",
	},
	{
		name: "linksHouse",
		type: "gltfModel",
		path: "/models/links_house.glb",
	},
	// Wings only: the original 31k-vertex body sphere was stripped
	{
		name: "naviFairy",
		type: "gltfModel",
		path: "/models/navi_fairy.glb",
	},
	// Seamless sustain loops of the 5 OoT ocarina notes
	{ name: "ocarinaD4", type: "audio", path: "/sounds/ocarina/d4.wav" },
	{ name: "ocarinaF4", type: "audio", path: "/sounds/ocarina/f4.wav" },
	{ name: "ocarinaA4", type: "audio", path: "/sounds/ocarina/a4.wav" },
	{ name: "ocarinaB4", type: "audio", path: "/sounds/ocarina/b4.wav" },
	{ name: "ocarinaD5", type: "audio", path: "/sounds/ocarina/d5.wav" },
	// Jingle played when a known song is recognized
	{
		name: "songCorrect",
		type: "audio",
		path: "/sounds/ocarina/song-correct.wav",
	},
	{ name: "menuOpen", type: "audio", path: "/sounds/ui/menu-open.wav" },
	{ name: "menuClose", type: "audio", path: "/sounds/ui/menu-close.wav" },
	{ name: "menuSelect", type: "audio", path: "/sounds/ui/menu-select.wav" },
];
