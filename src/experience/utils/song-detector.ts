import mitt from "mitt";
import Experience from "../experience.ts";
import { type Song, songs } from "../songs.ts";
import { listen } from "./events.ts";
import type { OcarinaButton } from "./keyboard.ts";

type SongDetectorEvents = {
	songPlayed: Song;
};

const HISTORY_LENGTH = Math.max(...songs.map((song) => song.buttons.length));

const endsWith = (
	history: readonly OcarinaButton[],
	buttons: readonly OcarinaButton[],
) =>
	history.length >= buttons.length &&
	buttons.every(
		(button, i) => history[history.length - buttons.length + i] === button,
	);

// Watches the notes played and emits `songPlayed` when they end with a known
// song. Does nothing while the `songRecognition` setting is off.
export default class SongDetector {
	readonly emitter = mitt<SongDetectorEvents>();
	private history: OcarinaButton[] = [];
	private readonly unsubscribes: (() => void)[];

	constructor() {
		const { keyboard, settings } = Experience.getInstance();

		const onNoteDown = (button: OcarinaButton) => {
			if (!settings.values.songRecognition) return;

			this.history.push(button);
			if (this.history.length > HISTORY_LENGTH) this.history.shift();

			const song = songs.find((s) => endsWith(this.history, s.buttons));
			if (!song) return;

			this.history = [];
			// Let every other noteDown listener handle the song's last note first
			queueMicrotask(() => this.emitter.emit("songPlayed", song));
		};

		// Notes played while disabled must not complete a song once re-enabled
		const onSettingsChange = () => {
			if (!settings.values.songRecognition) this.history = [];
		};

		this.unsubscribes = [
			listen(keyboard.emitter, "noteDown", onNoteDown),
			listen(settings.emitter, "change", onSettingsChange),
		];
	}

	destroy() {
		for (const unsubscribe of this.unsubscribes) unsubscribe();
		this.emitter.all.clear();
	}
}
