import "../../styles/menu.css";
import "../../styles/song-book.css";
import {
	type ScheduledNote,
	type Sequence,
	schedule,
} from "../audio/ocarina-sampler.ts";
import Experience from "../experience.ts";
import { noteDurations, type Song, songs } from "../songs.ts";
import { listen } from "../utils/events.ts";
import type { OcarinaButton } from "../utils/keyboard.ts";
import { closest, fragment, query, queryAll } from "./dom.ts";
import Menu, { type MenuAction, n64Icon, playMenuSound } from "./menu.ts";
import { CLOSE_BUTTON, SONG_BUTTON } from "./pixel-buttons.ts";
import { SONG_NOTE_ICON, TREBLE_CLEF_ICON } from "./pixel-icons.ts";
import { shareOcarina } from "./share.ts";

type Game = Song["game"];
const GAMES: Game[] = ["Ocarina of Time", "Majora's Mask"];

// The notes as the games' quest screens lay them out, shelf by shelf
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

// The notes' colors (see song-book.css). Unlisted songs are white.
const NOTE_COLORS: Record<string, string> = {
	"Minuet of Forest": "green",
	"Bolero of Fire": "red",
	"Serenade of Water": "blue",
	"Requiem of Spirit": "orange",
	"Nocturne of Shadow": "purple",
	"Prelude of Light": "yellow",
	"Song of Healing": "pink",
	"Sonata of Awakening": "green",
	"Goron Lullaby": "red",
	"New Wave Bossa Nova": "blue",
	"Elegy of Emptiness": "orange",
};

// Staff position of each button's pitch, in steps (a line or a space) above
// the bottom line, E4: A D4 hangs under it, C▲ D5 sits on the fourth line
const STAFF_STEPS: Record<OcarinaButton, number> = {
	A: -1,
	CDown: 1,
	CRight: 3,
	CLeft: 4,
	CUp: 6,
};

// Time from the click to the first note of a demo, in seconds
const DEMO_DELAY = 0.08;
// Fade of a demo cut by another one, which starts once it's done
const DEMO_CUT_FADE = 0.15;
// How long the message for a newly learned song stays, in milliseconds
const LEARNED_DURATION = 3600;
// The first one carries the share line and waits to be read, like the banner
// of the completion, and lingers once the pointer leaves it
const LEARNED_SHARE_DURATION = 9000;
const LEARNED_LINGER_DURATION = 3000;
// How long "Link copied!" stays, in milliseconds
const COPIED_DURATION = 2400;
// A player making notes for this long without a song being recognized is
// shown where the songs are, in milliseconds. Short: someone free-playing
// their way through the five buttons has already had their moment with them.
const HINT_DELAY = 8000;
// The hint says its piece and leaves: it's a nudge, not a nag
const HINT_DURATION = 18000;
// Between the reveals of several new notes, in seconds
const REVEAL_STAGGER = 0.12;

const noteColorClass = (song: Song) =>
	`song-note--${NOTE_COLORS[song.name] ?? "white"}`;

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
	${SONG_BUTTON}
	<span class="song-book-toggle__badge" hidden></span>
</button>
<button class="slab song-hint" type="button" data-source="hint" aria-haspopup="dialog" aria-controls="song-book">
	<span class="song-hint__text oot-text">Learn a song</span>
</button>
<div class="slab song-learned" role="status" aria-live="polite" aria-atomic="true">
	<span class="song-note song-learned__note">${SONG_NOTE_ICON}</span>
	<div class="song-learned__body">
		<p class="song-learned__text oot-text"><span>You learned</span> <span><strong></strong>!</span></p>
		<button class="song-learned__share cursor-frame oot-text" type="button" data-link="share" hidden>Share this ocarina</button>
	</div>
</div>
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
					<span class="staff__clef">${TREBLE_CLEF_ICON}</span>
					<ol class="staff__notes"></ol>
				</div>
			</li>
		</ul>
	</div>
	<button class="pixel-button pixel-button--close menu__close" type="button" aria-label="Close" title="Close (Esc)">
		${CLOSE_BUTTON}
	</button>
</dialog>
`;

// The song book, after the songs of Ocarina of Time's quest status screen: a
// note per song, the selected one written on a staff with the N64 buttons.
// Confirming a song has the ocarina play it. Driven like the settings menu.
export default class SongBook extends Menu {
	private readonly badge: HTMLElement;
	private readonly learned: HTMLElement;
	private readonly shareButton: HTMLButtonElement;
	private readonly shareLabel: string;
	private learnedTimeout = 0;
	private copiedTimeout = 0;
	// The nudge toward the book, for a player who hasn't found a song yet
	private readonly hint: HTMLButtonElement;
	private hintTimeout = 0;
	private hintHideTimeout = 0;
	// It's shown once, and never comes back in the same visit
	private hintDone = false;
	private unwaitNote: (() => void) | null = null;
	private readonly gameSwitch: HTMLButtonElement;
	private readonly shelves: HTMLElement;
	private readonly name: HTMLElement;
	private readonly staffNotes: HTMLElement;
	// The note elements of the game shown
	private noteElements: HTMLElement[] = [];
	private game: Game = GAMES[0];
	// The selected note of each game, kept between openings like the game's cursor
	private readonly cursors = Object.fromEntries(
		GAMES.map((game) => [game, { shelf: 0, note: 0 }]),
	) as Record<Game, Cursor>;
	// The demo playing, and its staff lighting callbacks
	private demo: Sequence | null = null;
	private demoCancels: (() => void)[] = [];
	// Bumped whenever the staff changes, so a demo stops lighting its notes
	private staffVersion = 0;
	private readonly unsubscribes: (() => void)[];

	constructor() {
		const content = fragment(TEMPLATE);
		// The cursor starts on the songs
		super(query(content, ".song-book-toggle"), query(content, ".song-book"), 1);
		this.badge = query(this.toggle, ".song-book-toggle__badge");
		this.learned = query(content, ".song-learned");
		this.shareButton = query(this.learned, ".song-learned__share");
		this.shareLabel = this.shareButton.textContent ?? "";
		this.hint = query(content, ".song-hint");
		this.gameSwitch = query(this.dialog, ".song-book__games");
		this.shelves = query(this.dialog, ".song-book__shelves");
		this.name = query(this.dialog, ".song-book__name");
		this.staffNotes = query(this.dialog, ".staff__notes");
		document.body.append(content);

		const { signal } = this.listeners;

		// One more way into the book, and the one a lost player is handed
		this.addToggle(this.hint);

		this.shareButton.addEventListener("click", () => this.share(), { signal });
		// The message can't leave while the share line is being reached for
		this.shareButton.addEventListener(
			"pointerenter",
			() => this.holdLearned(),
			{
				signal,
			},
		);
		this.shareButton.addEventListener("focus", () => this.holdLearned(), {
			signal,
		});
		this.shareButton.addEventListener(
			"pointerleave",
			() => this.hideLearnedIn(LEARNED_LINGER_DURATION),
			{ signal },
		);
		this.shareButton.addEventListener(
			"blur",
			() => this.hideLearnedIn(LEARNED_LINGER_DURATION),
			{ signal },
		);

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
				// No select sound: the song playing is the feedback
				this.selectNoteElement(note);
				this.playSong();
			},
			{ signal },
		);

		const { songProgress } = Experience.getInstance();
		this.unsubscribes = [
			listen(songProgress.emitter, "learn", (song) => this.showLearned(song)),
			listen(songProgress.emitter, "change", () => this.renderProgress()),
		];

		this.waitForFirstNote();
		this.renderGame();
	}

	override open() {
		if (this.dialog.open) return;
		this.hideHint();
		this.hideLearned();
		// Straight to the game with new songs
		if (!this.hasUnseen(this.game) && this.hasUnseen(this.otherGame)) {
			this.game = this.otherGame;
		}
		super.open();
		// Rendered once open, so new notes are revealed in front of the player
		this.renderGame();
	}

	protected override onClose() {
		// The song being played stops with the book
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

	// Left and right go through every note, from one shelf to the next
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

	// A shelf may be shorter than the one above: the cursor stops at its end
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
		// New notes are only revealed while the book is open, one after the other
		let reveals = 0;
		const noteHtml = (song: Song, shelf: number, note: number) => {
			const isNew = this.dialog.open && songProgress.isUnseen(song);
			const newClass = isNew ? " is-new" : "";
			const style = isNew
				? ` style="--reveal-delay: ${reveals++ * REVEAL_STAGGER}s"`
				: "";
			return `
				<span class="song-note cursor-frame ${noteColorClass(song)}${newClass}"${style} role="option" id="${noteId(shelf, note)}" data-shelf="${shelf}" data-note="${note}">
					${SONG_NOTE_ICON}
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

	// Songs not played yet are empty slots, carved in the stone
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

	// "You learned Zelda's Lullaby!", while the jingle plays
	private showLearned(song: Song) {
		this.hideHint();
		query(this.learned, ".song-learned__note").className =
			`song-note song-learned__note ${noteColorClass(song)}`;
		query(this.learned, "strong").textContent = song.name;

		// The very first song is the moment the experience clicks, and the only
		// one that carries the offer to share it: past that it would be a prompt
		// pushed at a player who is busy learning the rest
		const first = Experience.getInstance().songProgress.learnedCount === 1;
		this.resetShare();
		this.shareButton.hidden = !first;
		this.learned.classList.toggle("song-learned--share", first);

		// Restarts the entrance when a message is still showing
		this.learned.classList.remove("is-visible");
		void this.learned.offsetWidth;
		this.learned.classList.add("is-visible");
		this.hideLearnedIn(first ? LEARNED_SHARE_DURATION : LEARNED_DURATION);
	}

	private hideLearnedIn(delay: number) {
		window.clearTimeout(this.learnedTimeout);
		this.learnedTimeout = window.setTimeout(() => this.hideLearned(), delay);
	}

	private holdLearned() {
		window.clearTimeout(this.learnedTimeout);
	}

	private hideLearned() {
		window.clearTimeout(this.learnedTimeout);
		this.learned.classList.remove("is-visible");
	}

	private async share() {
		this.holdLearned();
		const answer = await shareOcarina();
		if (answer) {
			window.clearTimeout(this.copiedTimeout);
			this.shareButton.textContent = answer;
			this.shareButton.classList.add("is-copied");
			this.copiedTimeout = window.setTimeout(
				() => this.resetShare(),
				COPIED_DURATION,
			);
		}
		// Said its piece: the message leaves on its own from here
		this.hideLearnedIn(LEARNED_SHARE_DURATION);
	}

	private resetShare() {
		window.clearTimeout(this.copiedTimeout);
		this.shareButton.textContent = this.shareLabel;
		this.shareButton.classList.remove("is-copied");
	}

	// A player can press the ocarina keys for a while without ever stumbling on
	// a song: the book teaches them, but nothing says it's there. After a first
	// note and a stretch with nothing recognized, the book's button asks to be
	// opened. Only ever for a player who hasn't learned anything yet.
	private waitForFirstNote() {
		const { keyboard, songProgress } = Experience.getInstance();
		// The one thing that can't change during the visit
		if (songProgress.learnedCount > 0) return;
		this.unwaitNote = listen(keyboard.emitter, "noteDown", () => {
			this.stopWaitingForNote();
			this.hintTimeout = window.setTimeout(() => this.showHint(), HINT_DELAY);
		});
	}

	private stopWaitingForNote() {
		this.unwaitNote?.();
		this.unwaitNote = null;
	}

	// Nothing to nudge toward with recognition off, and nothing to teach a
	// player who already knows a song
	private canHint(): boolean {
		const { songProgress, settings } = Experience.getInstance();
		return (
			!this.hintDone &&
			songProgress.learnedCount === 0 &&
			settings.values.songRecognition
		);
	}

	private showHint() {
		if (!this.canHint() || this.dialog.open) return;
		this.hintDone = true;
		this.hint.classList.add("is-visible");
		this.toggle.classList.add("is-nudging");
		this.hintHideTimeout = window.setTimeout(
			() => this.hideHint(),
			HINT_DURATION,
		);
	}

	private hideHint() {
		this.hintDone = true;
		this.stopWaitingForNote();
		window.clearTimeout(this.hintTimeout);
		window.clearTimeout(this.hintHideTimeout);
		this.hint.classList.remove("is-visible");
		this.toggle.classList.remove("is-nudging");
	}

	// The ocarina plays the selected song in rhythm, each note lighting up on
	// the staff as it sounds
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

	// Fades out the demo still playing, if any. Returns whether there was one.
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
		this.stopWaitingForNote();
		window.clearTimeout(this.learnedTimeout);
		window.clearTimeout(this.copiedTimeout);
		window.clearTimeout(this.hintTimeout);
		window.clearTimeout(this.hintHideTimeout);
		for (const unsubscribe of this.unsubscribes) unsubscribe();
		this.learned.remove();
	}
}
