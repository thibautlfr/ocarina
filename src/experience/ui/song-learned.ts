import "../../styles/menu.css";
import "../../styles/toast.css";
import "../../styles/song-note.css";
import "../../styles/song-learned.css";
import Experience from "../experience.ts";
import type { Song } from "../songs/songs.ts";
import { listen } from "../utils/events.ts";
import { fragment, query } from "./dom.ts";
import songNoteIcon from "./pixel/icons/song-note.svg?raw";
import { ShareButton } from "./share.ts";

// How long the message stays, in ms. The first one carries the share button,
// so it stays longer, and a while after the pointer leaves that button.
const VISIBLE_DURATION = 3600;
const SHARE_VISIBLE_DURATION = 9000;
const LINGER_DURATION = 3000;

const TEMPLATE = /* html */ `
<div class="slab toast song-learned" role="status" aria-live="polite" aria-atomic="true">
	<span class="song-note song-learned__note">${songNoteIcon}</span>
	<div class="toast__body">
		<p class="song-learned__text oot-text"><span>You learned</span> <span><strong></strong>!</span></p>
		<button class="toast__share cursor-frame oot-text" type="button" hidden>Share this ocarina</button>
	</div>
</div>
`;

// "You learned Zelda's Lullaby!", shown while the jingle plays. Only the first
// song learned offers to share the experience.
export default class SongLearned {
	private readonly root: HTMLElement;
	private readonly note: HTMLElement;
	private readonly name: HTMLElement;
	private readonly shareElement: HTMLButtonElement;
	private readonly shareButton: ShareButton;
	private hideTimeout = 0;
	private readonly listeners = new AbortController();
	private readonly unsubscribe: () => void;

	constructor() {
		const content = fragment(TEMPLATE);
		this.root = query(content, ".song-learned");
		this.note = query(this.root, ".song-learned__note");
		this.name = query(this.root, "strong");
		this.shareElement = query(this.root, ".toast__share");
		this.shareButton = new ShareButton(this.shareElement, {
			onStart: () => this.hold(),
			onEnd: () => this.hideIn(SHARE_VISIBLE_DURATION),
		});
		document.body.append(content);

		const { signal } = this.listeners;
		const hideSoon = () => this.hideIn(LINGER_DURATION);
		this.shareElement.addEventListener("pointerenter", () => this.hold(), {
			signal,
		});
		this.shareElement.addEventListener("focus", () => this.hold(), { signal });
		this.shareElement.addEventListener("pointerleave", hideSoon, { signal });
		this.shareElement.addEventListener("blur", hideSoon, { signal });

		const { songProgress } = Experience.getInstance();
		this.unsubscribe = listen(songProgress.emitter, "learn", (song) =>
			this.show(song),
		);
	}

	private show(song: Song) {
		this.note.className = `song-note song-learned__note song-note--${song.color}`;
		this.name.textContent = song.name;

		const first = Experience.getInstance().songProgress.learnedCount === 1;
		this.shareButton.reset();
		this.shareElement.hidden = !first;
		this.root.classList.toggle("song-learned--share", first);

		// Restart the entrance animation when a message is already showing
		this.root.classList.remove("is-visible");
		void this.root.offsetWidth;
		this.root.classList.add("is-visible");
		this.hideIn(first ? SHARE_VISIBLE_DURATION : VISIBLE_DURATION);
	}

	private hideIn(delay: number) {
		window.clearTimeout(this.hideTimeout);
		this.hideTimeout = window.setTimeout(() => this.hide(), delay);
	}

	private hold() {
		window.clearTimeout(this.hideTimeout);
	}

	hide() {
		window.clearTimeout(this.hideTimeout);
		this.root.classList.remove("is-visible");
	}

	destroy() {
		this.unsubscribe();
		this.listeners.abort();
		this.shareButton.destroy();
		window.clearTimeout(this.hideTimeout);
		this.root.remove();
	}
}
