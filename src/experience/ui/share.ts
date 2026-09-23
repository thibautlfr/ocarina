import { isTouchScreen, trackHover } from "./dom.ts";

const SHARE_TEXT = "Play the Ocarina of Time in your browser 🎵";
// How long the answer ("Link copied!") replaces the label, in ms
const ANSWER_DURATION = 2400;

// The canonical address from index.html, so a share never carries localhost
// or a #debug hash
export const shareUrl = () =>
	document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
	window.location.origin + import.meta.env.BASE_URL;

// Opens the share sheet on phones and copies the link on desktop, where the
// system share panel is clunky. Returns what to tell the player, or null when
// the share sheet did.
export const shareOcarina = async (): Promise<string | null> => {
	const url = shareUrl();
	if (navigator.share && isTouchScreen()) {
		try {
			await navigator.share({ title: document.title, text: SHARE_TEXT, url });
		} catch {
			// Cancelled, or not allowed here
		}
		return null;
	}
	try {
		await navigator.clipboard.writeText(url);
		return "Link copied!";
	} catch {
		// No clipboard access: show the address so it can be typed
		return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
	}
};

type ShareButtonOptions = {
	onStart: () => void;
	onEnd: () => void;
};

// A "Share this ocarina" button that shows the answer in place of its label
// for a moment
export class ShareButton {
	private readonly button: HTMLButtonElement;
	private readonly label: string;
	private resetTimeout = 0;
	private readonly listeners = new AbortController();

	constructor(
		button: HTMLButtonElement,
		{ onStart, onEnd }: ShareButtonOptions,
	) {
		this.button = button;
		this.label = button.textContent ?? "";

		const { signal } = this.listeners;
		trackHover(button, signal);
		button.addEventListener(
			"click",
			async () => {
				onStart();
				const answer = await shareOcarina();
				if (answer) this.showAnswer(answer);
				onEnd();
			},
			{ signal },
		);
	}

	private showAnswer(answer: string) {
		window.clearTimeout(this.resetTimeout);
		this.button.textContent = answer;
		this.button.classList.add("is-copied");
		this.resetTimeout = window.setTimeout(() => this.reset(), ANSWER_DURATION);
	}

	reset() {
		window.clearTimeout(this.resetTimeout);
		this.button.textContent = this.label;
		this.button.classList.remove("is-copied");
	}

	destroy() {
		window.clearTimeout(this.resetTimeout);
		this.listeners.abort();
	}
}
