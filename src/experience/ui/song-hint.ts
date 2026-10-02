import "../../styles/menu.css";
import "../../styles/song-hint.css";
import Experience from "../experience.ts";
import Disposables from "../utils/disposables.ts";
import { listen } from "../utils/events.ts";
import Timeout from "../utils/timeout.ts";
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
	private readonly isBookOpen: () => boolean;
	private readonly showTimeout = new Timeout();
	private readonly hideTimeout = new Timeout();
	private done = false;
	private unwaitNote: (() => void) | null = null;
	private readonly disposables = new Disposables();

	constructor(bookToggle: HTMLElement, isBookOpen: () => boolean) {
		this.bookToggle = bookToggle;
		this.isBookOpen = isBookOpen;
		const content = fragment(TEMPLATE);
		this.button = query(content, ".song-hint");
		document.body.append(content);

		const { keyboard, songProgress } = Experience.getInstance();
		this.disposables.add(
			listen(songProgress.emitter, "learn", () => this.hide()),
		);
		if (songProgress.learnedCount > 0) {
			this.done = true;
			return;
		}
		this.unwaitNote = listen(keyboard.emitter, "noteDown", () => {
			this.stopWaitingForNote();
			this.showTimeout.set(() => this.show(), HINT_DELAY);
		});
	}

	private stopWaitingForNote() {
		this.unwaitNote?.();
		this.unwaitNote = null;
	}

	private show() {
		const { songProgress, settings } = Experience.getInstance();
		const canShow =
			!this.done &&
			songProgress.learnedCount === 0 &&
			settings.values.songRecognition &&
			!this.isBookOpen();
		if (!canShow) return;

		this.done = true;
		this.button.classList.add("is-visible");
		this.bookToggle.classList.add("is-nudging");
		this.hideTimeout.set(() => this.hide(), HINT_DURATION);
	}

	hide() {
		this.done = true;
		this.stopWaitingForNote();
		this.showTimeout.clear();
		this.hideTimeout.clear();
		this.button.classList.remove("is-visible");
		this.bookToggle.classList.remove("is-nudging");
	}

	destroy() {
		this.disposables.dispose();
		this.stopWaitingForNote();
		this.showTimeout.clear();
		this.hideTimeout.clear();
		this.button.remove();
	}
}
