import "../../styles/menu.css";
import "../../styles/completion.css";
import Experience from "../experience.ts";
import { songs } from "../songs.ts";
import { listen } from "../utils/events.ts";
import { fragment, query, trackHover } from "./dom.ts";
import { TRIFORCE_ICON } from "./pixel-icons.ts";
import { shareOcarina } from "./share.ts";

// The banner comes in this long before the end of the celebration, in
// seconds, on the last held note: the scene has the moment to itself first
const BANNER_LEAD = 0.9;
// How long the banner stays, and how long it lingers once the pointer leaves
// it, in milliseconds. It's the only thing in the experience asking for
// something back, so it waits while the cursor is on it.
const VISIBLE_DURATION = 11000;
const LINGER_DURATION = 3500;
// How long "Link copied!" stays, in milliseconds
const COPIED_DURATION = 2400;

const TEMPLATE = /* html */ `
<div class="slab completion" role="status" aria-live="polite" aria-atomic="true">
	<span class="completion__triforce">${TRIFORCE_ICON}</span>
	<div class="completion__body">
		<p class="completion__text oot-text">All ${songs.length} songs learned!</p>
		<button class="completion__share cursor-frame oot-text" type="button" data-link="share">Share this ocarina</button>
	</div>
</div>
`;

// What happens once every song has been learned: the fairies gather around the
// ocarina and it plays its five notes (the scene's part, in `World`), then a
// golden slab says so and offers to share the experience. The About menu and
// the first song learned are the only other places that offer it: everywhere
// else it would be a prompt pushed at the player.
export default class Completion {
	private readonly banner: HTMLElement;
	private readonly shareButton: HTMLButtonElement;
	private readonly shareLabel: string;
	private hideTimeout = 0;
	private showTimeout = 0;
	private copiedTimeout = 0;
	private unwaitLock: (() => void) | null = null;
	private readonly listeners = new AbortController();
	private readonly unsubscribe: () => void;

	constructor() {
		const content = fragment(TEMPLATE);
		this.banner = query(content, ".completion");
		this.shareButton = query(content, ".completion__share");
		this.shareLabel = this.shareButton.textContent ?? "";
		document.body.append(content);

		const { signal } = this.listeners;
		this.shareButton.addEventListener("click", () => this.share(), { signal });
		// The golden corners only take it once the pointer moves on it
		trackHover(this.shareButton, signal);
		// It can't vanish while it's being read or reached for
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

	// The last song is still being replayed when it's learned: the celebration
	// takes over from it, once the keyboard is the player's again
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

	// Leaves after `delay`, unless something holds it back
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

	private async share() {
		this.hold();
		const answer = await shareOcarina();
		if (answer) {
			window.clearTimeout(this.copiedTimeout);
			this.shareButton.textContent = answer;
			this.shareButton.classList.add("is-copied");
			this.copiedTimeout = window.setTimeout(() => {
				this.shareButton.textContent = this.shareLabel;
				this.shareButton.classList.remove("is-copied");
			}, COPIED_DURATION);
		}
		// Said its piece: it leaves on its own from here
		this.hide(VISIBLE_DURATION);
	}

	destroy() {
		this.unsubscribe();
		this.unwaitLock?.();
		this.listeners.abort();
		window.clearTimeout(this.showTimeout);
		window.clearTimeout(this.hideTimeout);
		window.clearTimeout(this.copiedTimeout);
		this.banner.remove();
	}
}
