import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Keyboard from "../input/keyboard.ts";
import type { OcarinaButton } from "../ocarina-buttons.ts";
import Settings from "../settings.ts";
import SongDetector from "./song-detector.ts";
import { type Song, songs } from "./songs.ts";

const experience = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock("../experience.ts", () => ({
	default: { getInstance: () => experience },
}));

const zeldasLullaby = songs.find((s) => s.name === "Zelda's Lullaby") as Song;

describe("SongDetector", () => {
	let keyboard: Keyboard;
	let settings: Settings;
	let detector: SongDetector;
	let played: string[];

	const play = (buttons: readonly OcarinaButton[]) => {
		for (const button of buttons) {
			keyboard.press("test", button);
			keyboard.release("test");
		}
	};
	// songPlayed is emitted in a microtask
	const flush = () => Promise.resolve();

	beforeEach(() => {
		localStorage.clear();
		experience.debug = { addFolder: () => null };
		keyboard = new Keyboard();
		settings = new Settings();
		Object.assign(experience, { keyboard, settings });
		detector = new SongDetector();
		played = [];
		detector.emitter.on("songPlayed", (song) => played.push(song.name));
	});

	afterEach(() => {
		detector.destroy();
		keyboard.destroy();
	});

	it("recognizes a song at the end of the notes played", async () => {
		play(["A", "CUp", "CDown", ...zeldasLullaby.buttons]);
		await flush();
		expect(played).toEqual(["Zelda's Lullaby"]);
	});

	it("starts over after a song", async () => {
		play(zeldasLullaby.buttons);
		play(zeldasLullaby.buttons.slice(-3));
		await flush();
		expect(played).toEqual(["Zelda's Lullaby"]);
	});

	it("ignores notes while song recognition is off", async () => {
		const half = zeldasLullaby.buttons.length / 2;
		play(zeldasLullaby.buttons.slice(0, half));
		settings.set("songRecognition", false);
		settings.set("songRecognition", true);
		play(zeldasLullaby.buttons.slice(half));
		await flush();
		expect(played).toEqual([]);
	});
});
