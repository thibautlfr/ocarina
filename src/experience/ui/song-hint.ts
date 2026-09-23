import "../../styles/menu.css";
import "../../styles/song-hint.css";
import Experience from "../experience.ts";
import { listen } from "../utils/events.ts";
import { fragment, query } from "./dom.ts";

// Time without a recognized song after the first note before the hint shows,
// and how long it stays, in ms
const HINT_DELAY = 8000;
const HINT_DURATION = 18000;

const TEMPLATE = /* html */ `
<button class="slab song-hint" type="button" aria-haspopup="dialog" aria-controls="song-book">
	<span class="song-hint__text oot-text">Learn a song</span>
</button>
`;

// "Learn a song", next to the song book's button, for a player who plays notes
// without finding a song. Shown at most once per visit.
export default class SongHint {
	readonly button: HTMLButtonElement;
	private readonly bookToggle: HTMLElement;
	private showTimeout = 0;
	private hideTimeout = 0;
	private done = false;
	private unwaitNote: (() => void) | null = null;
	private readonly unsubscribe: () => void;

	constructor(bookToggle: HTMLElement) {
		this.bookToggle = bookToggle;
		const content = fragment(TEMPLATE);
		this.button = query(content, ".song-hint");
		document.body.append(content);

		const { keyboard, songProgress } = Experience.getInstance();
		this.unsubscribe = listen(songProgress.emitter, "learn", () => this.hide());
		if (songProgress.learnedCount > 0) {
			this.done = true;
			return;
		}
		this.unwaitNote = listen(keyboard.emitter, "noteDown", () => {
			this.stopWaitingForNote();
			this.showTimeout = window.setTimeout(() => this.show(), HINT_DELAY);
		});
	}

	private stopWaitingForNote() {
		this.unwaitNote?.();
		this.unwaitNote = null;
	}

	private show() {
		const { songProgress, settings, songBook } = Experience.getInstance();
		const canShow =
			!this.done &&
			songProgress.learnedCount === 0 &&
			settings.values.songRecognition &&
			!songBook.isOpen;
		if (!canShow) return;

		this.done = true;
		this.button.classList.add("is-visible");
		this.bookToggle.classList.add("is-nudging");
		this.hideTimeout = window.setTimeout(() => this.hide(), HINT_DURATION);
	}

	hide() {
		this.done = true;
		this.stopWaitingForNote();
		window.clearTimeout(this.showTimeout);
		window.clearTimeout(this.hideTimeout);
		this.button.classList.remove("is-visible");
		this.bookToggle.classList.remove("is-nudging");
	}

	destroy() {
		this.unsubscribe();
		this.stopWaitingForNote();
		window.clearTimeout(this.showTimeout);
		window.clearTimeout(this.hideTimeout);
		this.button.remove();
	}
}
