import "../../styles/menu.css";
import "../../styles/title-screen.css";
import { type ScheduledNote, schedule } from "../audio/schedule.ts";
import Experience from "../experience.ts";
import { hasModifier } from "../input/keyboard.ts";
import { CONTROL_ORDER, type OcarinaButton } from "../ocarina-buttons.ts";
import Disposables from "../utils/disposables.ts";
import { listen } from "../utils/events.ts";
import Timeout from "../utils/timeout.ts";
import { fragment, query } from "./dom.ts";
import { controlLabel, MENU_KEYS, n64Icon } from "./menu.ts";
import { headphonesIcon, triforceIcon } from "./pixel-icons.ts";

const START_KEYS = new Set(["Space", "Enter", "NumpadEnter", "Escape"]);
// Matches the fade out in title-screen.css, in ms
const FADE_OUT = 600;
// Longest wait for the pixel font before showing the text anyway, in ms
const FONT_TIMEOUT = 2000;
// Played on Start, so the player hears that the sound is on: D4 A4 D5
const MOTIF_DELAY = 0.05;
const START_MOTIF: readonly Omit<ScheduledNote, "time">[] = [
	{ button: "A", duration: 0.11 },
	{ button: "CRight", duration: 0.11 },
	{ button: "CUp", duration: 0.4 },
];

// Only the keys that are the same on every layout. WASD (ZQSD on AZERTY) is
// shown in the settings menu, which can relabel it.
const BUTTON_KEYS: Record<OcarinaButton, string> = {
	A: "Space",
	CUp: "↑",
	CLeft: "←",
	CDown: "↓",
	CRight: "→",
};

const TEMPLATE = /* html */ `
<div class="title-screen" role="dialog" aria-modal="true" aria-labelledby="title-screen-title">
	<div class="title-screen__logo">
		<span class="title-screen__triforce">${triforceIcon}</span>
		<h1 class="menu__title title-screen__title" id="title-screen-title">Ocarina</h1>
		<p class="title-screen__subtitle oot-text">Songs of Hyrule</p>
	</div>
	<div class="title-screen__action">
		<div class="title-screen__gauge" role="progressbar" aria-label="Loading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
			<span class="title-screen__gauge-fill"></span>
		</div>
		<button class="title-screen__start oot-text" type="button" disabled>
			<span class="title-screen__start-label--pointer">Press Start</span>
			<span class="title-screen__start-label--touch">Tap to start</span>
		</button>
	</div>
	<div class="title-screen__controls">
		<p class="title-screen__controls-label oot-text">Play with</p>
		<ul class="title-screen__keys">
			${CONTROL_ORDER.map(
				(button) => `
			<li class="title-screen__key">
				${n64Icon(button, controlLabel(button))}
				<kbd class="oot-key">${BUTTON_KEYS[button]}</kbd>
			</li>`,
			).join("")}
		</ul>
	</div>
	<p class="title-screen__sound oot-text">
		<span class="title-screen__headphones">${headphonesIcon}</span>
		<span>Sound on</span>
	</p>
</div>
`;

// A loading gauge, then "Press Start". Browsers only allow audio after a user
// gesture, so the rest of the UI and the keyboard wait for this click or key.
export default class TitleScreen {
	private readonly root: HTMLElement;
	private readonly gauge: HTMLElement;
	private readonly startButton: HTMLButtonElement;
	private ready = false;
	private started = false;
	private readonly removeTimeout = new Timeout();
	private readonly disposables = new Disposables();

	constructor() {
		const { resources, keyboard } = Experience.getInstance();

		const content = fragment(TEMPLATE);
		this.root = query(content, ".title-screen");
		this.gauge = query(this.root, ".title-screen__gauge");
		this.startButton = query(this.root, ".title-screen__start");
		document.body.append(content);
		document.documentElement.classList.add("is-title-screen");
		keyboard.lock(this);

		const { signal } = this.disposables;
		this.root.addEventListener("click", this.start, { signal });
		// Capture phase, so the ocarina and the menus don't get the keys
		window.addEventListener("keydown", this.handleKeydown, {
			capture: true,
			signal,
		});

		// Wait for the pixel font rather than flash a fallback
		Promise.race([
			document.fonts.load('1em "Jersey 10"'),
			new Promise((resolve) => window.setTimeout(resolve, FONT_TIMEOUT)),
		]).then(() => this.root.classList.add("is-font-ready"));

		this.disposables.add(
			listen(resources.emitter, "progress", ({ loaded, total }) =>
				this.setProgress(loaded / total),
			),
			listen(resources.emitter, "ready", () => {
				this.setProgress(1);
				this.ready = true;
				this.startButton.disabled = false;
				this.root.classList.add("is-ready");
			}),
		);
	}

	private setProgress(progress: number) {
		this.gauge.style.setProperty("--progress", String(progress));
		this.gauge.setAttribute(
			"aria-valuenow",
			String(Math.round(progress * 100)),
		);
	}

	private handleKeydown = (e: KeyboardEvent) => {
		if (hasModifier(e) || !MENU_KEYS[e.code]) return;
		e.preventDefault();
		e.stopImmediatePropagation();
		if (!e.repeat && START_KEYS.has(e.code)) this.start();
	};

	// Must run inside the gesture's event: iOS only starts audio there
	private start = () => {
		if (!this.ready || this.started) return;
		this.started = true;

		const { sampler, keyboard, camera } = Experience.getInstance();
		sampler.unlock();
		sampler.playSequence(
			schedule(START_MOTIF, sampler.currentTime + MOTIF_DELAY),
		);

		camera.drift();

		this.disposables.dispose();
		keyboard.unlock(this);
		document.documentElement.classList.remove("is-title-screen");
		this.root.classList.add("is-started");
		this.removeTimeout.set(() => this.root.remove(), FADE_OUT);
	};

	destroy() {
		this.removeTimeout.clear();
		this.disposables.dispose();
		Experience.getInstance().keyboard.unlock(this);
		document.documentElement.classList.remove("is-title-screen");
		this.root.remove();
	}
}
