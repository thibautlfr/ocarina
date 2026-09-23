import "../../styles/menu.css";
import "../../styles/toast.css";
import "../../styles/song-note.css";
import "../../styles/song-learned.css";
import Experience from "../experience.ts";
import type { Song } from "../songs/songs.ts";
import { listen } from "../utils/events.ts";
import { fragment, query } from "./dom.ts";
import { songNoteIcon } from "./pixel-icons.ts";

// How long the message stays, in ms
const VISIBLE_DURATION = 3600;

const TEMPLATE = /* html */ `
<div class="slab toast song-learned" role="status" aria-live="polite" aria-atomic="true">
	<span class="song-note song-learned__note">${songNoteIcon}</span>
	<p class="song-learned__text oot-text"><span>You learned</span> <span><strong></strong>!</span></p>
</div>
`;

// "You learned Zelda's Lullaby!", shown while the jingle plays
export default class SongLearned {
	private readonly root: HTMLElement;
	private readonly note: HTMLElement;
	private readonly name: HTMLElement;
	private hideTimeout = 0;
	private readonly unsubscribe: () => void;

	constructor() {
		const content = fragment(TEMPLATE);
		this.root = query(content, ".song-learned");
		this.note = query(this.root, ".song-learned__note");
		this.name = query(this.root, "strong");
		document.body.append(content);

		const { songProgress } = Experience.getInstance();
		this.unsubscribe = listen(songProgress.emitter, "learn", (song) =>
			this.show(song),
		);
	}

	private show(song: Song) {
		this.note.className = `song-note song-learned__note song-note--${song.color}`;
		this.name.textContent = song.name;

		// Restart the entrance animation when a message is already showing
		this.root.classList.remove("is-visible");
		void this.root.offsetWidth;
		this.root.classList.add("is-visible");
		window.clearTimeout(this.hideTimeout);
		this.hideTimeout = window.setTimeout(() => this.hide(), VISIBLE_DURATION);
	}

	hide() {
		window.clearTimeout(this.hideTimeout);
		this.root.classList.remove("is-visible");
	}

	destroy() {
		this.unsubscribe();
		window.clearTimeout(this.hideTimeout);
		this.root.remove();
	}
}
