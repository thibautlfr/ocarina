import type { OcarinaButton } from "../ocarina-buttons.ts";

export interface SongNote {
	readonly button: OcarinaButton;
	// Length in beats (1 = quarter note)
	readonly beats: number;
}

// The color of the song's note in the games' quest screens
export type NoteColor =
	| "white"
	| "green"
	| "red"
	| "blue"
	| "orange"
	| "purple"
	| "yellow"
	| "pink";

export interface Song {
	readonly name: string;
	// Quarter notes per minute of the replay
	readonly bpm: number;
	readonly notes: readonly SongNote[];
	readonly buttons: readonly OcarinaButton[];
	readonly color: NoteColor;
}

export const GAMES = ["Ocarina of Time", "Majora's Mask"] as const;
export type Game = (typeof GAMES)[number];

// Controller notation: A = A, v = C▼, > = C▶, < = C◀, ^ = C▲
const NOTATION: Record<string, OcarinaButton> = {
	A: "A",
	v: "CDown",
	">": "CRight",
	"<": "CLeft",
	"^": "CUp",
};

// Each note of `score` is a button symbol followed by its length in beats:
// "<2 ^1 >3"
export const song = ({
	name,
	bpm,
	score,
	color = "white",
}: {
	name: string;
	bpm: number;
	score: string;
	color?: NoteColor;
}): Song => {
	const notes = score.split(" ").map((token) => {
		const button = NOTATION[token[0]];
		const beats = Number(token.slice(1));
		if (!button || !(beats > 0)) {
			throw new Error(`Invalid note "${token}" in ${name}`);
		}
		return { button, beats };
	});
	return {
		name,
		bpm,
		notes,
		buttons: notes.map((n) => n.button),
		color,
	};
};

// The notes with their duration in seconds, `tempo` multiplying the bpm
export const noteDurations = (song: Song, tempo = 1) => {
	const secondsPerBeat = 60 / (song.bpm * tempo);
	return song.notes.map(({ button, beats }) => ({
		button,
		duration: beats * secondsPerBeat,
	}));
};

// Every song, laid out shelf by shelf as in the games' quest screens.
// Rhythms are approximate, written from memory: check them against the games.
// biome-ignore format: one song per line reads as a table
export const SHELVES: Record<Game, Song[][]> = {
	"Ocarina of Time": [
		[
			song({ name: "Zelda's Lullaby",       bpm: 110, score: "<2 ^1 >3 <2 ^1 >3" }),
			song({ name: "Epona's Song",          bpm: 140, score: "^1 <1 >4 ^1 <1 >4" }),
			song({ name: "Saria's Song",          bpm: 140, score: "v.5 >.5 <1 v.5 >.5 <2" }),
			song({ name: "Sun's Song",            bpm: 150, score: ">.5 v.5 ^1 >.5 v.5 ^2" }),
			song({ name: "Song of Time",          bpm: 100, score: ">1 A2 v1 >1 A2 v2" }),
			song({ name: "Song of Storms",        bpm: 170, score: "A.5 v.5 ^2 A.5 v.5 ^3" }),
		],
		[
			song({ name: "Minuet of Forest",      bpm: 130, score: "A1 ^2 <.5 >.5 <1 >3",             color: "green" }),
			song({ name: "Bolero of Fire",        bpm: 150, score: "v.5 A.5 v.5 A.5 >.5 v.5 >.5 v2", color: "red" }),
			song({ name: "Serenade of Water",     bpm: 110, score: "A1 v1 >2 >1 <3",                  color: "blue" }),
			song({ name: "Requiem of Spirit",     bpm: 120, score: "A2 v1 A3 >2 v1 A3",               color: "orange" }),
			song({ name: "Nocturne of Shadow",    bpm: 100, score: "<1 >1 >1 A2 <1 >1 v3",            color: "purple" }),
			song({ name: "Prelude of Light",      bpm: 130, score: "^1 >.5 ^1 >.5 <.5 ^2.5",          color: "yellow" }),
		],
	],
	"Majora's Mask": [
		[
			song({ name: "Song of Healing",       bpm: 100, score: "<1 >1 v2 <1 >1 v3",               color: "pink" }),
			song({ name: "Song of Soaring",       bpm: 150, score: "v.5 <.5 ^1 v.5 <.5 ^2" }),
			song({ name: "Inverted Song of Time", bpm: 100, score: "v1 A2 >1 v1 A2 >2" }),
			song({ name: "Song of Double Time",   bpm: 140, score: ">.5 >1 A.5 A1 v.5 v1.5" }),
		],
		[
			song({ name: "Sonata of Awakening",   bpm: 150, score: "^.5 <.5 ^.5 <.5 A1 >.5 A2",       color: "green" }),
			song({ name: "Goron Lullaby",         bpm: 90,  score: "A1 >1 <2 A1 >1 <1 >1 A3",         color: "red" }),
			song({ name: "New Wave Bossa Nova",   bpm: 120, score: "<1.5 ^.5 <1 >1.5 v.5 <1 >2",      color: "blue" }),
			song({ name: "Elegy of Emptiness",    bpm: 90,  score: ">1 <.5 >.5 v2 >1 ^1 <3",          color: "orange" }),
			song({ name: "Oath to Order",         bpm: 110, score: ">1 v1 A2 v1 >1 ^3" }),
		],
	],
};

// No song ends another one (see songs.test.ts), so matching the end of the
// notes played is unambiguous and the order here doesn't matter
export const songs: Song[] = GAMES.flatMap((game) => SHELVES[game].flat());
