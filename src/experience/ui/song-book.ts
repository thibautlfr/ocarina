import "../../styles/menu.css";
import "../../styles/song-note.css";
import "../../styles/song-book.css";
import {
	type ScheduledNote,
	type Sequence,
	schedule,
} from "../audio/ocarina-sampler.ts";
import Experience from "../experience.ts";
import type { OcarinaButton } from "../ocarina-buttons.ts";
import { noteDurations, type Song, songs } from "../songs/songs.ts";
import { listen } from "../utils/events.ts";
import { closest, fragment, query, queryAll } from "./dom.ts";
import Menu, {
	CLOSE_BUTTON,
	type MenuAction,
	n64Icon,
	playMenuSound,
} from "./menu.ts";
import eighthNoteGlyph from "./pixel/glyphs/eighth-note.svg?raw";
import songNoteIcon from "./pixel/icons/song-note.svg?raw";
import trebleClefIcon from "./pixel/icons/treble-clef.svg?raw";
import { pixelButton } from "./pixel-button.ts";
import SongHint from "./song-hint.ts";
import SongLearned from "./song-learned.ts";

type Game = Song["game"];
const GAMES: Game[] = ["Ocarina of Time", "Majora's Mask"];

// The songs as the games' quest screens lay them out, shelf by shelf
const SHELVES: Record<Game, string[][]> = {
	"Ocarina of Time": [
		[
			"Zelda's Lullaby",
			"Epona's Song",
			"Saria's Song",
			"Sun's Song",
			"Song of Time",
			"Song of Storms",
		],
		[
			"Minuet of Forest",
			"Bolero of Fire",
			"Serenade of Water",
			"Requiem of Spirit",
			"Nocturne of Shadow",
			"Prelude of Light",
		],
	],
	"Majora's Mask": [
		[
			"Song of Healing",
			"Song of Soaring",
			"Inverted Song of Time",
			"Song of Double Time",
		],
		[
			"Sonata of Awakening",
			"Goron Lullaby",
			"New Wave Bossa Nova",
			"Elegy of Emptiness",
			"Oath to Order",
		],
	],
};

// Staff position of each button's pitch, in lines and spaces above the bottom
// line (E4): A (D4) hangs under it, C▲ (D5) sits on the fourth line
const STAFF_STEPS: Record<OcarinaButton, number> = {
	A: -1,
	CDown: 1,
	CRight: 3,
	CLeft: 4,
	CUp: 6,
};

// Delay before a demo's first note, and fade of a demo cut by another, in s
const DEMO_DELAY = 0.08;
const DEMO_CUT_FADE = 0.15;
// Delay between the reveals of several new notes, in s
const REVEAL_STAGGER = 0.12;

const findSong = (name: string): Song => {
	const song = songs.find((s) => s.name === name);
	if (!song) throw new Error(`Song not found: ${name}`);
	return song;
};

const BOOK = Object.fromEntries(
	GAMES.map((game) => [game, SHELVES[game].map((row) => row.map(findSong))]),
) as Record<Game, Song[][]>;

const noteId = (shelf: number, note: number) => `song-note-${shelf}-${note}`;

type Cursor = { shelf: number; note: number };

const TEMPLATE = /* html */ `
<button class="pixel-button song-book-toggle" type="button" aria-label="Songs" title="Songs" aria-haspopup="dialog" aria-controls="song-book">
	${pixelButton(eighthNoteGlyph)}
	<span class="song-book-toggle__badge" hidden></span>
</button>
<dialog class="menu song-book" id="song-book" aria-labelledby="song-book-title">
	<div class="menu__panel">
		<h2 class="menu__title" id="song-book-title">Songs</h2>
		<ul class="menu__rows">
			<li class="slab slab--centered" data-row="game">
				<button class="switch song-book__games" type="button" aria-label="Game" data-focus>
					${GAMES.map(
						(game) =>
							`<span class="switch__choice oot-text" data-game="${game}">${game}</span>`,
					).join("")}
				</button>
			</li>
			<li class="slab song-book__book" data-row="songs">
				<div class="song-book__shelves" role="listbox" tabindex="0" aria-label="Songs" data-focus></div>
				<p class="song-book__name oot-text" aria-live="polite"></p>
				<div class="staff">
					<span class="staff__lines"></span>
					<span class="staff__clef">${trebleClefIcon}</span>
					<ol class="staff__notes"></ol>
				</div>
			</li>
		</ul>
	</div>
	${CLOSE_BUTTON}
</dialog>
`;

// The song book, after Ocarina of Time's quest status screen: a note per song,
// the selected one written on a staff. Confirming a song plays it.
export default class SongBook extends Menu {
	private readonly badge: HTMLElement;
	private readonly hint: SongHint;
	private readonly learned: SongLearned;
	private readonly gameSwitch: HTMLButtonElement;
	private readonly shelves: HTMLElement;
	private readonly name: HTMLElement;
	private readonly staffNotes: HTMLElement;
	private noteElements: HTMLElement[] = [];
	private game: Game = GAMES[0];
	// Kept between openings, one per game
	private readonly cursors = Object.fromEntries(
		GAMES.map((game) => [game, { shelf: 0, note: 0 }]),
	) as Record<Game, Cursor>;
	private demo: Sequence | null = null;
	private demoCancels: (() => void)[] = [];
	// Bumped whenever the staff is redrawn, so a playing demo stops lighting it
	private staffVersion = 0;
	private readonly unsubscribe: () => void;

	constructor() {
		const content = fragment(TEMPLATE);
		// The cursor starts on the songs row
		super(query(content, ".song-book-toggle"), query(content, ".song-book"), 1);
		this.badge = query(this.toggle, ".song-book-toggle__badge");
		this.gameSwitch = query(this.dialog, ".song-book__games");
		this.shelves = query(this.dialog, ".song-book__shelves");
		this.name = query(this.dialog, ".song-book__name");
		this.staffNotes = query(this.dialog, ".staff__notes");
		document.body.append(content);

		this.hint = new SongHint(this.toggle);
		this.addToggle(this.hint.button);
		this.learned = new SongLearned();

		const { signal } = this.listeners;
		this.gameSwitch.addEventListener(
			"click",
			(e) => {
				const choice = closest(e.target, "[data-game]");
				playMenuSound("menuSelect");
				this.setGame(choice ? (choice.dataset.game as Game) : this.otherGame);
			},
			{ signal },
		);
		this.shelves.addEventListener(
			"pointerover",
			(e) => {
				const note = closest(e.target, "[data-note]");
				if (e.pointerType === "mouse" && note) this.selectNoteElement(note);
			},
			{ signal },
		);
		this.shelves.addEventListener(
			"click",
			(e) => {
				const note = closest(e.target, "[data-note]");
				if (!note) return;
				// No select sound: the song itself plays
				this.selectNoteElement(note);
				this.playSong();
			},
			{ signal },
		);

		const { songProgress } = Experience.getInstance();
		this.unsubscribe = listen(songProgress.emitter, "change", () =>
			this.renderProgress(),
		);

		this.renderGame();
	}

	override open() {
		if (this.dialog.open) return;
		this.hint.hide();
		this.learned.hide();
		// Open on the game with new songs
		if (!this.hasUnseen(this.game) && this.hasUnseen(this.otherGame)) {
			this.game = this.otherGame;
		}
		super.open();
		// Rendered after opening, so new notes are revealed in front of the player
		this.renderGame();
	}

	protected override onClose() {
		this.stopDemo(DEMO_CUT_FADE);
		this.renderProgress();
	}

	protected handleAction(action: Exclude<MenuAction, "back">) {
		const onGame = this.row === "game";
		const { shelf, note } = this.cursor;
		switch (action) {
			case "up":
				if (onGame || shelf === 0) this.selectRow(this.selectedRow - 1);
				else this.selectNote(shelf - 1, note);
				break;
			case "down":
				if (!onGame && shelf < this.book.length - 1) {
					this.selectNote(shelf + 1, note);
				} else {
					this.selectRow(this.selectedRow + 1);
				}
				break;
			case "left":
			case "right": {
				const direction = action === "left" ? -1 : 1;
				if (onGame) {
					const index = GAMES.indexOf(this.game) + direction;
					this.setGame(GAMES[Math.min(GAMES.length - 1, Math.max(0, index))]);
				} else {
					this.stepNote(direction);
				}
				break;
			}
			case "confirm":
				if (onGame) {
					playMenuSound("menuSelect");
					this.setGame(this.otherGame);
				} else {
					this.playSong();
				}
				break;
		}
	}

	private get book(): Song[][] {
		return BOOK[this.game];
	}

	private get cursor(): Cursor {
		return this.cursors[this.game];
	}

	private get song(): Song {
		const { shelf, note } = this.cursor;
		return this.book[shelf][note];
	}

	private get otherGame(): Game {
		return GAMES[(GAMES.indexOf(this.game) + 1) % GAMES.length];
	}

	private hasUnseen(game: Game) {
		const { songProgress } = Experience.getInstance();
		return BOOK[game].flat().some((song) => songProgress.isUnseen(song));
	}

	private setGame(game: Game) {
		if (game === this.game) return;
		this.game = game;
		this.renderGame();
	}

	// Left and right go through every note, wrapping from one shelf to the next
	private stepNote(direction: number) {
		const all = this.book.flatMap((row, shelf) =>
			row.map((_, note) => ({ shelf, note })),
		);
		const { shelf, note } = this.cursor;
		const index = all.findIndex((c) => c.shelf === shelf && c.note === note);
		const next = all[(index + direction + all.length) % all.length];
		this.selectNote(next.shelf, next.note);
	}

	private selectNoteElement(element: HTMLElement) {
		this.selectNote(
			Number(element.dataset.shelf),
			Number(element.dataset.note),
		);
	}

	// A shelf can be shorter than the one above: the cursor stops at its end
	private selectNote(shelf: number, note: number) {
		const clamped = Math.min(note, this.book[shelf].length - 1);
		if (this.dialog.open && this.row !== "songs") {
			this.selectRow(this.rows.findIndex((r) => r.dataset.row === "songs"));
		}
		if (shelf === this.cursor.shelf && clamped === this.cursor.note) return;
		this.cursors[this.game] = { shelf, note: clamped };
		this.renderSelection();
	}

	private renderGame() {
		this.gameSwitch.setAttribute("aria-label", `Game: ${this.game}`);
		for (const choice of queryAll(this.gameSwitch, "[data-game]")) {
			choice.classList.toggle("is-active", choice.dataset.game === this.game);
		}

		const { songProgress } = Experience.getInstance();
		let reveals = 0;
		const noteHtml = (song: Song, shelf: number, note: number) => {
			const isNew = this.dialog.open && songProgress.isUnseen(song);
			const newClass = isNew ? " is-new" : "";
			const style = isNew
				? ` style="--reveal-delay: ${reveals++ * REVEAL_STAGGER}s"`
				: "";
			return `
				<span class="song-note song-note--${song.color} cursor-frame${newClass}"${style} role="option" id="${noteId(shelf, note)}" data-shelf="${shelf}" data-note="${note}">
					${songNoteIcon}
				</span>`;
		};
		this.shelves.innerHTML = this.book
			.map(
				(row, shelf) => `
				<div class="song-book__shelf" role="presentation">
					${row.map((song, note) => noteHtml(song, shelf, note)).join("")}
				</div>`,
			)
			.join("");
		this.noteElements = queryAll(this.shelves, "[data-note]");

		this.renderProgress();
		this.renderSelection();
		if (this.dialog.open) songProgress.markSeen(this.book.flat());
	}

	private renderProgress() {
		const { songProgress } = Experience.getInstance();
		for (const element of this.noteElements) {
			const song =
				this.book[Number(element.dataset.shelf)][Number(element.dataset.note)];
			const learned = songProgress.isLearned(song);
			element.classList.toggle("is-locked", !learned);
			if (!learned) element.classList.remove("is-new");
			element.setAttribute(
				"aria-label",
				learned ? song.name : `${song.name}, not learned yet`,
			);
		}
		this.badge.hidden = !songProgress.hasUnseen;
		this.toggle.setAttribute(
			"aria-label",
			songProgress.hasUnseen ? "Songs, new song learned" : "Songs",
		);
	}

	private renderSelection() {
		const { shelf, note } = this.cursor;
		const id = noteId(shelf, note);
		for (const element of this.noteElements) {
			const selected = element.id === id;
			element.classList.toggle("is-selected", selected);
			element.setAttribute("aria-selected", String(selected));
		}
		this.shelves.setAttribute("aria-activedescendant", id);

		const { song } = this;
		this.staffVersion++;
		this.name.textContent = song.name;
		this.staffNotes.setAttribute("aria-label", song.name);
		this.staffNotes.innerHTML = song.buttons
			.map(
				(button) =>
					`<li class="staff__note" style="--step: ${STAFF_STEPS[button]}">${n64Icon(button)}</li>`,
			)
			.join("");
	}

	// Plays the selected song in rhythm, lighting each note on the staff
	private playSong() {
		const sampler = Experience.getInstance().world.sampler;
		if (!sampler) return;
		sampler.unlock();
		const cut = this.stopDemo(DEMO_CUT_FADE);

		const start = sampler.currentTime + (cut ? DEMO_CUT_FADE : DEMO_DELAY);
		const notes: ScheduledNote[] = schedule(noteDurations(this.song), start);
		const last = notes[notes.length - 1];
		this.demo = sampler.playSequence(notes);

		const version = this.staffVersion;
		const light = (index: number) => {
			if (version === this.staffVersion) this.lightStaff(index);
		};
		this.demoCancels = [
			...notes.map((note, index) => sampler.at(note.time, () => light(index))),
			sampler.at(last.time + last.duration, () => light(-1)),
		];
	}

	// Fades out the demo if one is playing, and returns whether one was
	private stopDemo(fade: number): boolean {
		const sampler = Experience.getInstance().world.sampler;
		const playing =
			this.demo !== null &&
			sampler !== null &&
			sampler.currentTime < this.demo.end;
		this.demo?.stop(fade);
		this.demo = null;
		for (const cancel of this.demoCancels) cancel();
		this.demoCancels = [];
		this.lightStaff(-1);
		return playing;
	}

	// Lights the staff note at `index`, or none with -1
	private lightStaff(index: number) {
		[...this.staffNotes.children].forEach((element, i) => {
			element.classList.toggle("is-playing", i === index);
		});
	}

	override destroy() {
		super.destroy();
		this.hint.destroy();
		this.learned.destroy();
		this.unsubscribe();
	}
}
