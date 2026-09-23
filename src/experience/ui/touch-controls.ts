import "../../styles/touch-controls.css";
import Experience from "../experience.ts";
import { listen } from "../utils/events.ts";
import { BUTTON_LABELS, type OcarinaButton } from "../utils/keyboard.ts";
import { fragment, query, queryAll } from "./dom.ts";
import {
	A_BUTTON,
	ARROW_DOWN_BUTTON,
	ARROW_LEFT_BUTTON,
	ARROW_RIGHT_BUTTON,
	ARROW_UP_BUTTON,
} from "./pixel-buttons.ts";

// Each button's drawing
const DRAWINGS: Record<OcarinaButton, string> = {
	A: A_BUTTON,
	CUp: ARROW_UP_BUTTON,
	CLeft: ARROW_LEFT_BUTTON,
	CDown: ARROW_DOWN_BUTTON,
	CRight: ARROW_RIGHT_BUTTON,
};

// In the order of their arrow-key layout: up above left, down, right
const C_BUTTONS: OcarinaButton[] = ["CUp", "CLeft", "CDown", "CRight"];

const HAPTIC_MS = 8;

// The touch area, larger than the pixel button drawn in it (see the CSS)
const touchButton = (button: OcarinaButton) => `
<div class="touch-controls__button" role="button" aria-label="${BUTTON_LABELS[button]}" data-button="${button}">
	<span class="pixel-button pixel-button--${button === "A" ? "a" : "c"}" aria-hidden="true">${DRAWINGS[button]}</span>
</div>`;

const TEMPLATE = /* html */ `
<div class="touch-controls" role="group" aria-label="Ocarina buttons">
	<div class="touch-controls__pad touch-controls__pad--a">
		${touchButton("A")}
	</div>
	<div class="touch-controls__pad touch-controls__pad--c">
		${C_BUTTONS.map(touchButton).join("")}
	</div>
</div>
`;

const inputId = (pointerId: number) => `touch:${pointerId}`;

// On-screen ocarina buttons for touch screens (shown by CSS only there), pixel
// buttons in the N64 colors: A under the left thumb, the C buttons under the
// right, laid out like arrow keys. They play through the keyboard like keys
// do, so locks, songs and the sampler behave the same. A finger can slide
// from one button to another to play legato, and several fingers can hold
// buttons at once.
export default class TouchControls {
	private readonly root: HTMLElement;
	private readonly buttons: Record<OcarinaButton, HTMLElement>;
	// The button each finger is on, by pointer id
	private readonly fingers = new Map<number, HTMLElement>();
	private readonly listeners = new AbortController();
	private readonly unsubscribes: (() => void)[];

	constructor() {
		const { keyboard } = Experience.getInstance();

		const content = fragment(TEMPLATE);
		this.root = query(content, ".touch-controls");
		this.buttons = Object.fromEntries(
			queryAll(this.root, "[data-button]").map((element) => [
				element.dataset.button,
				element,
			]),
		) as Record<OcarinaButton, HTMLElement>;
		document.body.append(content);

		const { signal } = this.listeners;
		const on = <K extends keyof HTMLElementEventMap>(
			type: K,
			handler: (e: HTMLElementEventMap[K]) => void,
			options: AddEventListenerOptions = {},
		) => this.root.addEventListener(type, handler, { ...options, signal });

		on("pointerdown", this.handlePointerDown);
		on("pointermove", this.handlePointerMove);
		on("pointerup", this.handlePointerEnd);
		on("pointercancel", this.handlePointerEnd);
		// Long presses would open the callout menu on some browsers
		on("contextmenu", (e) => e.preventDefault());
		// iOS Safari zooms on quick taps despite touch-action: cancelling the
		// touch end stops its double-tap zoom, pointer events still fire
		on("touchend", (e) => e.preventDefault(), { passive: false });

		this.unsubscribes = [
			// Pressed look follows what the keyboard holds, whatever the input
			listen(keyboard.emitter, "noteDown", (button) => {
				this.buttons[button].classList.add("is-pressed");
				if (this.fingers.size > 0) navigator.vibrate?.(HAPTIC_MS);
			}),
			listen(keyboard.emitter, "noteUp", (button) => {
				this.buttons[button].classList.remove("is-pressed");
			}),
			// Greyed out while the keyboard ignores input, e.g. from a recognized
			// song until its replay has faded
			listen(keyboard.emitter, "lockChange", (locked) => {
				this.root.classList.toggle("is-disabled", locked);
				for (const button of Object.values(this.buttons)) {
					button.setAttribute("aria-disabled", String(locked));
				}
			}),
		];
	}

	private handlePointerDown = (e: PointerEvent) => {
		e.preventDefault();
		// Keep receiving this finger's moves once it slides off the buttons
		this.root.setPointerCapture(e.pointerId);
		Experience.getInstance().world.sampler?.unlock();
		this.follow(e);
	};

	private handlePointerMove = (e: PointerEvent) => {
		if (this.root.hasPointerCapture(e.pointerId)) this.follow(e);
	};

	private handlePointerEnd = (e: PointerEvent) => {
		const { world, keyboard } = Experience.getInstance();
		world.sampler?.unlock();
		this.fingers.delete(e.pointerId);
		keyboard.release(inputId(e.pointerId));
	};

	// Presses the button under the finger, releasing the one it left
	private follow(e: PointerEvent) {
		const under = document
			.elementFromPoint(e.clientX, e.clientY)
			?.closest<HTMLElement>("[data-button]");
		const target = under && this.root.contains(under) ? under : undefined;
		if (target === this.fingers.get(e.pointerId)) return;

		const { keyboard } = Experience.getInstance();
		const input = inputId(e.pointerId);
		keyboard.release(input);

		if (target) {
			this.fingers.set(e.pointerId, target);
			keyboard.press(input, target.dataset.button as OcarinaButton);
		} else {
			this.fingers.delete(e.pointerId);
		}
	}

	destroy() {
		const { keyboard } = Experience.getInstance();
		for (const pointerId of this.fingers.keys()) {
			keyboard.release(inputId(pointerId));
		}
		this.fingers.clear();
		this.listeners.abort();
		for (const unsubscribe of this.unsubscribes) unsubscribe();
		this.root.remove();
	}
}
