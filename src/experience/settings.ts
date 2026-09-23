import mitt from "mitt";
import Experience from "./experience.ts";
import { loadJson, saveJson } from "./utils/storage.ts";

// User preferences, persisted in localStorage. Read them from `values` and
// write them with `set()` so listeners and storage stay in sync.
export type SettingsValues = {
	// Ocarina volume, from 0 (muted) to 1
	volume: number;
	// Recognize played songs: jingle, then the ocarina replays the song
	songRecognition: boolean;
};

type SettingsEvents = {
	change: { key: keyof SettingsValues; values: SettingsValues };
};

const STORAGE_KEY = "ocarina-3d:settings";

const DEFAULTS: SettingsValues = {
	volume: 0.8,
	songRecognition: true,
};

export default class Settings {
	readonly emitter = mitt<SettingsEvents>();
	readonly values: SettingsValues = { ...DEFAULTS, ...loadJson(STORAGE_KEY) };

	constructor() {
		const folder = Experience.getInstance().debug.addFolder("Settings");
		if (folder) {
			// listen(): the menu changes them too
			folder
				.add(this.values, "volume", 0, 1, 0.01)
				.listen()
				.onChange((v: number) => this.set("volume", v));
			folder
				.add(this.values, "songRecognition")
				.listen()
				.onChange((v: boolean) => this.set("songRecognition", v));
		}
	}

	set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
		this.values[key] = value;
		saveJson(STORAGE_KEY, this.values);
		this.emitter.emit("change", { key, values: this.values });
	}

	destroy() {
		this.emitter.all.clear();
	}
}
