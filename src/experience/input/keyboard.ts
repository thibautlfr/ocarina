import mitt from "mitt";
import type { OcarinaButton } from "../ocarina-buttons.ts";

// Physical key positions (KeyboardEvent.code), so the layout doesn't matter:
// ZQSD on AZERTY and WASD on QWERTY are the same keys. The C buttons follow
// their controller direction, on both ZQSD/WASD and the arrow keys.
const KEY_BUTTONS: Record<string, OcarinaButton> = {
	Space: "A",
	KeyW: "CUp",
	KeyA: "CLeft",
	KeyS: "CDown",
	KeyD: "CRight",
	ArrowUp: "CUp",
	ArrowLeft: "CLeft",
	ArrowDown: "CDown",
	ArrowRight: "CRight",
};

type KeyboardEvents = {
	noteDown: OcarinaButton;
	noteUp: OcarinaButton;
	// Whether input is now ignored, sent when that changes
	lockChange: boolean;
};

// Shortcuts (Ctrl, Cmd, Alt) belong to the browser, not the ocarina
export const hasModifier = (e: KeyboardEvent) =>
	e.ctrlKey || e.metaKey || e.altKey;

const isEditable = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement);

export default class Keyboard {
	readonly emitter = mitt<KeyboardEvents>();
	// Insertion order: the last entry is the most recently pressed button
	readonly held = new Set<OcarinaButton>();
	// What holds each button: key codes, or on-screen buttons' pointers. Two
	// inputs can hold the same button, which stays held until both are up.
	private readonly inputs = new Map<string, OcarinaButton>();
	// Whoever locked the keyboard (a song replay, the menu): input stays ignored
	// until every one of them has unlocked it
	private readonly lockOwners = new Set<object>();

	constructor() {
		window.addEventListener("keydown", this.handleKeydown);
		window.addEventListener("keyup", this.handleKeyup);
		window.addEventListener("blur", this.releaseAll);
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
	}

	get locked(): boolean {
		return this.lockOwners.size > 0;
	}

	// Holds `button` down for `input`, a key code or any other input id (e.g.
	// an on-screen button's touch), until release(input)
	press(input: string, button: OcarinaButton) {
		if (this.locked || this.inputs.has(input)) return;

		this.inputs.set(input, button);
		if (this.held.has(button)) return;

		this.held.add(button);
		this.emitter.emit("noteDown", button);
	}

	release(input: string) {
		const button = this.inputs.get(input);
		if (!button) return;

		this.inputs.delete(input);
		if ([...this.inputs.values()].includes(button)) return;

		this.held.delete(button);
		this.emitter.emit("noteUp", button);
	}

	// Releases every note and ignores input until `owner` calls unlock(). Keys
	// still down when unlocking don't play: they have to be pressed again.
	lock(owner: object) {
		const wasLocked = this.locked;
		this.lockOwners.add(owner);
		this.releaseAll();
		if (!wasLocked) this.emitter.emit("lockChange", true);
	}

	unlock(owner: object) {
		if (!this.lockOwners.delete(owner) || this.locked) return;
		this.emitter.emit("lockChange", false);
	}

	private handleKeydown = (e: KeyboardEvent) => {
		if (hasModifier(e) || isEditable(e.target)) return;

		const button = KEY_BUTTONS[e.code];
		if (!button) return;

		// Space and arrows would otherwise scroll the page
		e.preventDefault();
		if (e.repeat) return;
		this.press(e.code, button);
	};

	private handleKeyup = (e: KeyboardEvent) => {
		this.release(e.code);
	};

	// Release everything when focus is lost, otherwise keyup never fires
	private releaseAll = () => {
		this.inputs.clear();
		for (const button of this.held) {
			this.held.delete(button);
			this.emitter.emit("noteUp", button);
		}
	};

	private handleVisibilityChange = () => {
		if (document.hidden) this.releaseAll();
	};

	destroy() {
		window.removeEventListener("keydown", this.handleKeydown);
		window.removeEventListener("keyup", this.handleKeyup);
		window.removeEventListener("blur", this.releaseAll);
		document.removeEventListener(
			"visibilitychange",
			this.handleVisibilityChange,
		);
		this.emitter.all.clear();
	}
}
