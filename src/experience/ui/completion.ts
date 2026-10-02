import "../../styles/menu.css";
import "../../styles/toast.css";
import "../../styles/completion.css";
import Experience from "../experience.ts";
import { songs } from "../songs/songs.ts";
import Disposables from "../utils/disposables.ts";
import { listen } from "../utils/events.ts";
import Timeout from "../utils/timeout.ts";
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
	private readonly showTimeout = new Timeout();
	private readonly hideTimeout = new Timeout();
	private unwaitLock: (() => void) | null = null;
	private readonly disposables = new Disposables();

	constructor() {
		const content = fragment(TEMPLATE);
		this.banner = query(content, ".completion");
		this.shareButton = new ShareButton(query(content, ".toast__share"), {
			onStart: () => this.hold(),
			onEnd: () => this.hide(VISIBLE_DURATION),
		});
		document.body.append(content);

		const { signal } = this.disposables;
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
		this.disposables.add(
			listen(songProgress.emitter, "complete", () => this.start()),
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
		this.showTimeout.set(
			() => this.show(),
			Math.max(0, duration - BANNER_LEAD) * 1000,
		);
	}

	private show() {
		this.banner.classList.add("is-visible");
		this.hide(VISIBLE_DURATION);
	}

	private hide(delay: number) {
		this.hideTimeout.set(
			() => this.banner.classList.remove("is-visible"),
			delay,
		);
	}

	private hold() {
		this.hideTimeout.clear();
	}

	destroy() {
		this.disposables.dispose();
		this.unwaitLock?.();
		this.shareButton.destroy();
		this.showTimeout.clear();
		this.hideTimeout.clear();
		this.banner.remove();
	}
}
