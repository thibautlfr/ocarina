import type { OcarinaButton } from "./utils/keyboard.ts";

export interface SongNote {
	readonly button: OcarinaButton;
	// Length in beats (1 = quarter note)
	readonly beats: number;
}

export interface Song {
	readonly name: string;
	readonly game: "Ocarina of Time" | "Majora's Mask";
	// Quarter notes per minute of the replay
	readonly bpm: number;
	readonly notes: readonly SongNote[];
	readonly buttons: readonly OcarinaButton[];
}

// Controller notation: A = A, v = C▼, > = C▶, < = C◀, ^ = C▲ (see SONGS.md)
const NOTATION: Record<string, OcarinaButton> = {
	A: "A",
	v: "CDown",
	">": "CRight",
	"<": "CLeft",
	"^": "CUp",
};

// Each note is a button symbol followed by its length in beats: "<2 ^1 >3"
const song = (
	name: string,
	game: Song["game"],
	bpm: number,
	score: string,
): Song => {
	const notes = score.split(" ").map((token) => ({
		button: NOTATION[token[0]],
		beats: Number(token.slice(1)),
	}));
	return { name, game, bpm, notes, buttons: notes.map((n) => n.button) };
};

// The notes with their duration in seconds, `tempo` multiplying the bpm
export const noteDurations = (song: Song, tempo = 1) => {
	const secondsPerBeat = 60 / (song.bpm * tempo);
	return song.notes.map(({ button, beats }) => ({
		button,
		duration: beats * secondsPerBeat,
	}));
};

// Rhythms are approximate, written from memory: check them against the games.
// No song is contained in another, so matching the end of the history is unambiguous.
export const songs: Song[] = [
	song("Zelda's Lullaby", "Ocarina of Time", 110, "<2 ^1 >3 <2 ^1 >3"),
	song("Epona's Song", "Ocarina of Time", 140, "^1 <1 >4 ^1 <1 >4"),
	song("Saria's Song", "Ocarina of Time", 140, "v.5 >.5 <1 v.5 >.5 <2"),
	song("Sun's Song", "Ocarina of Time", 150, ">.5 v.5 ^1 >.5 v.5 ^2"),
	song("Song of Time", "Ocarina of Time", 100, ">1 A2 v1 >1 A2 v2"),
	song("Song of Storms", "Ocarina of Time", 170, "A.5 v.5 ^2 A.5 v.5 ^3"),
	song("Minuet of Forest", "Ocarina of Time", 130, "A1 ^2 <.5 >.5 <1 >3"),
	song(
		"Bolero of Fire",
		"Ocarina of Time",
		150,
		"v.5 A.5 v.5 A.5 >.5 v.5 >.5 v2",
	),
	song("Serenade of Water", "Ocarina of Time", 110, "A1 v1 >2 >1 <3"),
	song("Nocturne of Shadow", "Ocarina of Time", 100, "<1 >1 >1 A2 <1 >1 v3"),
	song("Requiem of Spirit", "Ocarina of Time", 120, "A2 v1 A3 >2 v1 A3"),
	song("Prelude of Light", "Ocarina of Time", 130, "^1 >.5 ^1 >.5 <.5 ^2.5"),
	song("Song of Healing", "Majora's Mask", 100, "<1 >1 v2 <1 >1 v3"),
	song("Song of Soaring", "Majora's Mask", 150, "v.5 <.5 ^1 v.5 <.5 ^2"),
	song("Inverted Song of Time", "Majora's Mask", 100, "v1 A2 >1 v1 A2 >2"),
	song("Song of Double Time", "Majora's Mask", 140, ">.5 >1 A.5 A1 v.5 v1.5"),
	song(
		"Sonata of Awakening",
		"Majora's Mask",
		150,
		"^.5 <.5 ^.5 <.5 A1 >.5 A2",
	),
	song("Goron Lullaby", "Majora's Mask", 90, "A1 >1 <2 A1 >1 <1 >1 A3"),
	song(
		"New Wave Bossa Nova",
		"Majora's Mask",
		120,
		"<1.5 ^.5 <1 >1.5 v.5 <1 >2",
	),
	song("Elegy of Emptiness", "Majora's Mask", 90, ">1 <.5 >.5 v2 >1 ^1 <3"),
	song("Oath to Order", "Majora's Mask", 110, ">1 v1 A2 v1 >1 ^3"),
];
