import "../../styles/menu.css";
import "../../styles/song-note.css";
import "../../styles/song-book.css";
import { playMenuSound } from "../audio/menu-sounds.ts";
import Experience from "../experience.ts";
import { GAMES, type Game, SHELVES, type Song } from "../songs/songs.ts";
import { listen } from "../utils/events.ts";
import { closest, fragment, query, queryAll } from "./dom.ts";
import Menu, { CLOSE_BUTTON, type MenuAction } from "./menu.ts";
import eighthNoteGlyph from "./pixel/glyphs/eighth-note.svg?raw";
import { pixelButton } from "./pixel-button.ts";
import { songNoteIcon } from "./pixel-icons.ts";
import SongDemo from "./song-demo.ts";
import SongHint from "./song-hint.ts";
import SongLearned from "./song-learned.ts";
import SongStaff, { STAFF_TEMPLATE } from "./song-staff.ts";

// Delay between the reveals of several new notes, in s
const REVEAL_STAGGER = 0.12;

const noteId = (shelf: number, note: number) => `song-note-${shelf}-${note}`;

type Cursor = { shelf: number; note: number };

// A song of the shown game, its place on the shelves and its element
type BookNote = Cursor & { song: Song; element: HTMLElement };

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
				${STAFF_TEMPLATE}
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
	private readonly staff: SongStaff;
	private readonly demo: SongDemo;
	// The notes of the shown game, shelf by shelf
	private notes: BookNote[] = [];
	private game: Game = GAMES[0];
	// Kept between openings, one per game
	private readonly cursors = Object.fromEntries(
		GAMES.map((game) => [game, { shelf: 0, note: 0 }]),
	) as Record<Game, Cursor>;

	constructor() {
		const content = fragment(TEMPLATE);
		super(
			query(content, ".song-book-toggle"),
			query(content, ".song-book"),
			"songs",
		);
		this.badge = query(this.toggle, ".song-book-toggle__badge");
		this.gameSwitch = query(this.dialog, ".song-book__games");
		this.shelves = query(this.dialog, ".song-book__shelves");
		this.staff = new SongStaff(this.dialog);
		this.demo = new SongDemo(this.staff);
		document.body.append(content);

		this.hint = new SongHint(this.toggle, () => this.isOpen);
		this.addToggle(this.hint.button);
		this.learned = new SongLearned();

		const { signal } = this.disposables;
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
				if (e.pointerType === "mouse" && note) this.selectElement(note);
			},
			{ signal },
		);
		this.shelves.addEventListener(
			"click",
			(e) => {
				const note = closest(e.target, "[data-note]");
				if (!note) return;
				// No select sound: the song itself plays
				this.selectElement(note);
				this.demo.play(this.song);
			},
			{ signal },
		);

		const { songProgress } = Experience.getInstance();
		this.disposables.add(
			listen(songProgress.emitter, "change", () => this.renderProgress()),
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
		this.demo.stop();
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
					this.demo.play(this.song);
				}
				break;
		}
	}

	private get book(): Song[][] {
		return SHELVES[this.game];
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
		return SHELVES[game].flat().some((song) => songProgress.isUnseen(song));
	}

	private setGame(game: Game) {
		if (game === this.game) return;
		this.game = game;
		this.renderGame();
	}

	// Left and right go through every note, wrapping from one shelf to the next
	private stepNote(direction: number) {
		const { notes } = this;
		const { shelf, note } = this.cursor;
		const index = notes.findIndex((n) => n.shelf === shelf && n.note === note);
		const next = notes[(index + direction + notes.length) % notes.length];
		this.selectNote(next.shelf, next.note);
	}

	private selectElement(element: HTMLElement) {
		const note = this.notes.find((n) => n.element === element);
		if (note) this.selectNote(note.shelf, note.note);
	}

	// A shelf can be shorter than the one above: the cursor stops at its end
	private selectNote(shelf: number, note: number) {
		const clamped = Math.min(note, this.book[shelf].length - 1);
		if (this.dialog.open && this.row !== "songs") {
			this.selectRow(this.rowIndex("songs"));
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
				<span class="song-note song-note--${song.color} cursor-frame${newClass}"${style} role="option" id="${noteId(shelf, note)}" data-note>
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
		this.notes = this.book.flatMap((row, shelf) =>
			row.map((song, note) => ({
				song,
				shelf,
				note,
				element: query(this.shelves, `#${noteId(shelf, note)}`),
			})),
		);

		this.renderProgress();
		this.renderSelection();
		if (this.dialog.open) songProgress.markSeen(this.book.flat());
	}

	private renderProgress() {
		const { songProgress } = Experience.getInstance();
		for (const { song, element } of this.notes) {
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
		for (const { element } of this.notes) {
			const selected = element.id === id;
			element.classList.toggle("is-selected", selected);
			element.setAttribute("aria-selected", String(selected));
		}
		this.shelves.setAttribute("aria-activedescendant", id);

		this.staff.render(this.song);
	}

	override destroy() {
		super.destroy();
		this.hint.destroy();
		this.learned.destroy();
	}
}
