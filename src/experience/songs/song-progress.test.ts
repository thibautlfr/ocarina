import mitt from "mitt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SongProgress from "./song-progress.ts";
import { type Song, songs } from "./songs.ts";

const experience = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock("../experience.ts", () => ({
	default: { getInstance: () => experience },
}));

const STORAGE_KEY = "ocarina:songs";

describe("SongProgress", () => {
	let songDetector: { emitter: ReturnType<typeof mitt<{ songPlayed: Song }>> };
	let progress: SongProgress;

	const create = () => {
		progress = new SongProgress();
		return progress;
	};
	const playSong = (song: Song) =>
		songDetector.emitter.emit("songPlayed", song);

	beforeEach(() => {
		localStorage.clear();
		songDetector = { emitter: mitt() };
		Object.assign(experience, {
			songDetector,
			debug: { addFolder: () => null },
		});
	});

	afterEach(() => progress?.destroy());

	it("learns a song the first time it's played", () => {
		create();
		const learned = vi.fn();
		progress.emitter.on("learn", learned);
		playSong(songs[0]);
		playSong(songs[0]);
		expect(learned).toHaveBeenCalledTimes(1);
		expect(progress.isLearned(songs[0])).toBe(true);
		expect(progress.isUnseen(songs[0])).toBe(true);
		expect(progress.learnedCount).toBe(1);
	});

	it("persists learned and unseen songs", () => {
		create();
		playSong(songs[0]);
		playSong(songs[1]);
		progress.markSeen([songs[0]]);
		progress.destroy();

		create();
		expect(progress.learnedCount).toBe(2);
		expect(progress.isUnseen(songs[0])).toBe(false);
		expect(progress.isUnseen(songs[1])).toBe(true);
	});

	it("ignores unknown or malformed stored values", () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				learned: [songs[0].name, "Not a song", 3],
				unseen: "x",
			}),
		);
		create();
		expect(progress.learnedCount).toBe(1);
		expect(progress.hasUnseen).toBe(false);
	});

	it("completes once every song is learned", () => {
		create();
		const complete = vi.fn();
		progress.emitter.on("complete", complete);
		for (const song of songs.slice(0, -1)) playSong(song);
		expect(complete).not.toHaveBeenCalled();
		playSong(songs[songs.length - 1]);
		expect(complete).toHaveBeenCalledTimes(1);
		expect(progress.isComplete).toBe(true);
	});

	it("forgets everything on reset", () => {
		create();
		playSong(songs[0]);
		progress.reset();
		expect(progress.learnedCount).toBe(0);
		expect(progress.hasUnseen).toBe(false);
		expect(localStorage.getItem(STORAGE_KEY)).toBe(
			JSON.stringify({ learned: [], unseen: [] }),
		);
	});
});
