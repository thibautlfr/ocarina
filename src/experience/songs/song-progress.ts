import mitt from "mitt";
import Experience from "../experience.ts";
import { listen } from "../utils/events.ts";
import { loadJson, saveJson } from "../utils/storage.ts";
import { type Song, songs } from "./songs.ts";

type SongProgressEvents = {
	// A song played for the first time
	learn: Song;
	// The last song was just learned: every song is now known. Emitted once,
	// right after its `learn`, and never again on a later visit.
	complete: undefined;
	// The learned or unseen songs changed
	change: undefined;
};

const STORAGE_KEY = "ocarina-3d:songs";

const KNOWN = new Set(songs.map((song) => song.name));

// The known song names in a stored value, which may be anything
const songNames = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((name) => KNOWN.has(name)) : [];

// The songs the player has played, persisted in localStorage. A song is
// learned the first time it's recognized, and stays unseen until the song
// book has shown it.
export default class SongProgress {
	readonly emitter = mitt<SongProgressEvents>();
	private readonly learned: Set<string>;
	private readonly unseen: Set<string>;
	// Whether the celebration of every song learned has already played
	private celebrated: boolean;
	private readonly unsubscribe: () => void;

	constructor() {
		const { songDetector, debug } = Experience.getInstance();
		const stored = loadJson(STORAGE_KEY);
		this.learned = new Set(songNames(stored.learned));
		this.unseen = new Set(songNames(stored.unseen));
		// Players who finished before the celebration existed don't get one out
		// of nowhere on their next visit
		this.celebrated = stored.celebrated === true || this.isComplete;

		this.unsubscribe = listen(songDetector.emitter, "songPlayed", this.learn);

		const folder = debug.addFolder("Song progress");
		if (folder) {
			folder.add({ learnAll: () => songs.forEach(this.learn) }, "learnAll");
			folder.add({ reset: () => this.reset() }, "reset");
		}
	}

	isLearned(song: Song) {
		return this.learned.has(song.name);
	}

	isUnseen(song: Song) {
		return this.unseen.has(song.name);
	}

	get learnedCount() {
		return this.learned.size;
	}

	get hasUnseen() {
		return this.unseen.size > 0;
	}

	get isComplete() {
		return this.learned.size === songs.length;
	}

	private learn = (song: Song) => {
		if (this.learned.has(song.name)) return;
		this.learned.add(song.name);
		this.unseen.add(song.name);
		this.emitter.emit("learn", song);
		// After the song's own event: the last one is learned, then celebrated
		if (this.isComplete && !this.celebrated) {
			this.celebrated = true;
			this.emitter.emit("complete");
		}
		this.save();
	};

	markSeen(seen: readonly Song[]) {
		const removed = seen.filter((song) => this.unseen.delete(song.name));
		if (removed.length > 0) this.save();
	}

	reset() {
		this.learned.clear();
		this.unseen.clear();
		this.celebrated = false;
		this.save();
	}

	// Every change is saved, then announced
	private save() {
		saveJson(STORAGE_KEY, {
			learned: [...this.learned],
			unseen: [...this.unseen],
			celebrated: this.celebrated,
		});
		this.emitter.emit("change");
	}

	destroy() {
		this.unsubscribe();
		this.emitter.all.clear();
	}
}
