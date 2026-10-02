import "../../styles/menu.css";
import "../../styles/toast.css";
import "../../styles/completion.css";
import Experience from "../experience.ts";
import { songs } from "../songs/songs.ts";
import { listen } from "../utils/events.ts";
import { fragment, query } from "./dom.ts";
import { triforceIcon } from "./pixel-icons.ts";
import { ShareButton } from "./share.ts";

// The banner shows up this long before the celebration ends, in seconds
const BANNER_LEAD = 0.9;
// How long the banner stays, and how long once the pointer leaves it, in ms
const VISIBLE_DURATION = 11000;
const LINGER_DURATION = 3500;

const TEMPLATE = /* html */ `
<div class="slab toast completion" role="status" aria-live="polite" aria-atomic="true">
	<span class="completion__triforce">${triforceIcon}</span>
	<div class="toast__body">
		<p class="completion__text oot-text">All ${songs.length} songs learned!</p>
		<button class="toast__share cursor-frame oot-text" type="button">Share this ocarina</button>
	</div>
</div>
`;

// Once every song is learned: the world plays its celebration, then this
// banner offers to share the experience
export default class Completion {
	private readonly banner: HTMLElement;
	private readonly shareButton: ShareButton;
	private hideTimeout = 0;
	private showTimeout = 0;
	private unwaitLock: (() => void) | null = null;
	private readonly listeners = new AbortController();
	private readonly unsubscribe: () => void;

	constructor() {
		const content = fragment(TEMPLATE);
		this.banner = query(content, ".completion");
		this.shareButton = new ShareButton(query(content, ".toast__share"), {
			onStart: () => this.hold(),
			onEnd: () => this.hide(VISIBLE_DURATION),
		});
		document.body.append(content);

		const { signal } = this.listeners;
		this.banner.addEventListener("pointerenter", () => this.hold(), { signal });
		this.banner.addEventListener("focusin", () => this.hold(), { signal });
		this.banner.addEventListener(
			"pointerleave",
			() => this.hide(LINGER_DURATION),
			{ signal },
		);
		this.banner.addEventListener("focusout", () => this.hide(LINGER_DURATION), {
			signal,
		});

		const { songProgress } = Experience.getInstance();
		this.unsubscribe = listen(songProgress.emitter, "complete", () =>
			this.start(),
		);
	}

	// The last song is still being replayed when it's learned: wait for the
	// replay to release the keyboard
	private start() {
		const { keyboard } = Experience.getInstance();
		if (!keyboard.locked) {
			this.celebrate();
			return;
		}
		this.unwaitLock = listen(keyboard.emitter, "lockChange", (locked) => {
			if (locked) return;
			this.unwaitLock?.();
			this.unwaitLock = null;
			this.celebrate();
		});
	}

	private celebrate() {
		const duration = Experience.getInstance().world.celebrate();
		window.clearTimeout(this.showTimeout);
		this.showTimeout = window.setTimeout(
			() => this.show(),
			Math.max(0, duration - BANNER_LEAD) * 1000,
		);
	}

	private show() {
		this.banner.classList.add("is-visible");
		this.hide(VISIBLE_DURATION);
	}

	private hide(delay: number) {
		window.clearTimeout(this.hideTimeout);
		this.hideTimeout = window.setTimeout(
			() => this.banner.classList.remove("is-visible"),
			delay,
		);
	}

	private hold() {
		window.clearTimeout(this.hideTimeout);
	}

	destroy() {
		this.unsubscribe();
		this.unwaitLock?.();
		this.listeners.abort();
		this.shareButton.destroy();
		window.clearTimeout(this.showTimeout);
		window.clearTimeout(this.hideTimeout);
		this.banner.remove();
	}
}
