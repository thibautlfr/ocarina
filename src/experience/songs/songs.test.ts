import { describe, expect, it } from "vitest";
import { OCARINA_BUTTONS } from "../ocarina-buttons.ts";
import { noteDurations, song, songs } from "./songs.ts";

const isSuffix = (
	longer: readonly string[],
	shorter: readonly string[],
): boolean =>
	shorter.length <= longer.length &&
	shorter.every((b, i) => longer[longer.length - shorter.length + i] === b);

describe("songs", () => {
	it("have unique names", () => {
		const names = songs.map((song) => song.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it.each(songs)("$name has valid notes", (song) => {
		expect(song.notes.length).toBeGreaterThan(0);
		for (const note of song.notes) {
			expect(OCARINA_BUTTONS).toContain(note.button);
			expect(Number.isFinite(note.beats)).toBe(true);
			expect(note.beats).toBeGreaterThan(0);
		}
		expect(song.buttons).toEqual(song.notes.map((n) => n.button));
	});

	// SongDetector matches the end of the notes played: a song ending another
	// one would never be recognized, or be recognized instead of it
	it("never end with another song", () => {
		for (const a of songs) {
			for (const b of songs) {
				if (a === b) continue;
				expect(isSuffix(a.buttons, b.buttons), `${b.name} ends ${a.name}`).toBe(
					false,
				);
			}
		}
	});
});

describe("song", () => {
	it("parses a score into notes", () => {
		const parsed = song({ name: "Test", bpm: 120, score: "A1 v.5 >2 <1.5 ^3" });
		expect(parsed.notes).toEqual([
			{ button: "A", beats: 1 },
			{ button: "CDown", beats: 0.5 },
			{ button: "CRight", beats: 2 },
			{ button: "CLeft", beats: 1.5 },
			{ button: "CUp", beats: 3 },
		]);
		expect(parsed.color).toBe("white");
	});

	it.each([
		"x1",
		"A",
		"A0",
		"Aa",
		"A-1",
		"A1  v1",
	])('rejects the score "%s"', (score) => {
		expect(() => song({ name: "Test", bpm: 120, score })).toThrow();
	});
});

describe("noteDurations", () => {
	const [song] = songs;

	it("converts beats to seconds at the song's bpm", () => {
		const secondsPerBeat = 60 / song.bpm;
		expect(noteDurations(song)).toEqual(
			song.notes.map(({ button, beats }) => ({
				button,
				duration: beats * secondsPerBeat,
			})),
		);
	});

	it("speeds up with the tempo", () => {
		const normal = noteDurations(song);
		const twice = noteDurations(song, 2);
		twice.forEach((note, i) => {
			expect(note.duration).toBeCloseTo(normal[i].duration / 2);
		});
	});
});
