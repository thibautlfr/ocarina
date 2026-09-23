// Shared by the menus (settings, song book): keys, sounds, N64 icons and the
// dialog behavior itself

import Experience from "../experience.ts";
import { hasModifier } from "../input/keyboard.ts";
import { BUTTON_LABELS, type OcarinaButton } from "../ocarina-buttons.ts";
import { query, queryAll, trackHover } from "./dom.ts";
import closeIcon from "./pixel/buttons/close.svg?raw";

// Placed in each menu's dialog, over the corner button that opened it
export const CLOSE_BUTTON = /* html */ `
<button class="pixel-button menu__close" type="button" aria-label="Close" title="Close (Esc)">
	${closeIcon}
</button>`;

export type MenuAction = "up" | "down" | "left" | "right" | "confirm" | "back";

// Same physical keys as the ocarina: the C buttons move the cursor, A confirms
export const MENU_KEYS: Record<string, MenuAction> = {
	ArrowUp: "up",
	KeyW: "up",
	ArrowDown: "down",
	KeyS: "down",
	ArrowLeft: "left",
	KeyA: "left",
	ArrowRight: "right",
	KeyD: "right",
	Space: "confirm",
	Enter: "confirm",
	NumpadEnter: "confirm",
	Escape: "back",
	Backspace: "back",
};

// Resource name of each menu sound, and how loud it plays
const MENU_SOUND_VOLUME = {
	menuOpen: 0.55,
	menuClose: 0.55,
	menuSelect: 0.4,
} as const;
type MenuSound = keyof typeof MENU_SOUND_VOLUME;

// Opening/closing a dialog, or clicking or confirming something in it. Silent
// until the sampler exists (i.e. resources are ready), which in practice is
// always true by the time a menu can be opened.
export const playMenuSound = (name: MenuSound) => {
	const { world, resources } = Experience.getInstance();
	const sampler = world.sampler;
	if (!sampler) return;
	sampler.playOneShot(
		resources.get<AudioBuffer>(name),
		sampler.currentTime,
		MENU_SOUND_VOLUME[name],
	);
};

const N64_CLASSES: Record<OcarinaButton, string> = {
	A: "n64--a",
	CDown: "n64--c n64--c-down",
	CRight: "n64--c n64--c-right",
	CLeft: "n64--c n64--c-left",
	CUp: "n64--c",
};

// Round N64 button icon: A blue with its letter, C yellow with an arrow
export const n64Icon = (button: OcarinaButton, label = BUTTON_LABELS[button]) =>
	`<span class="n64 ${N64_CLASSES[button]}" role="img" aria-label="${label}">${button === "A" ? "A" : ""}</span>`;

// A full-screen <dialog> opened by a corner toggle and closed by the close
// button in the same corner, Esc/Backspace or a click outside the panel. Its
// slabs with a `data-row` take a golden cursor, moved by the ocarina keys or
// the mouse. The ocarina stays silent while it's open.
export default abstract class Menu {
	protected readonly toggle: HTMLButtonElement;
	// Every button that opens the menu: the about has two
	private readonly toggles: HTMLButtonElement[] = [];
	protected readonly dialog: HTMLDialogElement;
	private readonly closeButton: HTMLButtonElement;
	protected readonly rows: HTMLElement[];
	// Kept between openings, like the game's cursor
	protected selectedRow: number;
	protected readonly listeners = new AbortController();

	constructor(
		toggle: HTMLButtonElement,
		dialog: HTMLDialogElement,
		selectedRow = 0,
	) {
		this.toggle = toggle;
		this.dialog = dialog;
		this.closeButton = query(dialog, ".menu__close");
		this.rows = queryAll(dialog, "[data-row]");
		this.selectedRow = selectedRow;

		const { signal } = this.listeners;

		this.addToggle(toggle);
		this.closeButton.addEventListener("click", () => dialog.close(), {
			signal,
		});
		// Both buttons sit in the same corner: after a click, the other one shows
		// up under the cursor. It only looks pushed once the pointer moves on it.
		trackHover(this.closeButton, signal);
		// The dialog covers the screen: a click outside the panel lands on it
		dialog.addEventListener(
			"click",
			(e) => {
				if (e.target === dialog) dialog.close();
			},
			{ signal },
		);
		dialog.addEventListener("keydown", this.handleKeydown, { signal });
		dialog.addEventListener("close", this.handleClose, { signal });

		this.rows.forEach((row, index) => {
			row.addEventListener(
				"pointerenter",
				(e) => {
					if (e.pointerType === "mouse") this.selectRow(index);
				},
				{ signal },
			);
			row.addEventListener("focusin", () => this.selectRow(index, false), {
				signal,
			});
		});
	}

	// One more way in: a menu worth finding can be opened from several buttons
	protected addToggle(button: HTMLButtonElement) {
		this.toggles.push(button);
		const { signal } = this.listeners;
		button.addEventListener(
			"click",
			() => {
				// The dialog gives focus back on close: Space would then reopen it
				button.blur();
				this.open();
			},
			{ signal },
		);
		trackHover(button, signal);
	}

	get isOpen(): boolean {
		return this.dialog.open;
	}

	open() {
		if (this.dialog.open) return;
		playMenuSound("menuOpen");
		const { keyboard } = Experience.getInstance();
		keyboard.lock(this);
		this.resetHover();
		// showModal() focuses the first row, which would select it
		const row = this.selectedRow;
		this.dialog.showModal();
		this.selectRow(row);
	}

	// The `data-row` of the slab under the cursor
	protected get row(): string | undefined {
		return this.rows[this.selectedRow].dataset.row;
	}

	// Moving the cursor is silent: only clicks and confirms play the select sound
	protected selectRow(index: number, focus = true) {
		const count = this.rows.length;
		this.selectedRow = (index + count) % count;
		const row = this.rows[this.selectedRow];
		for (const other of this.rows) {
			other.classList.toggle("is-selected", other === row);
		}
		if (focus) {
			const target = row.querySelector<HTMLElement>("[data-focus]") ?? row;
			target.focus({ preventScroll: true });
		}
	}

	// Every key but back, which closes the menu
	protected abstract handleAction(action: Exclude<MenuAction, "back">): void;

	protected onClose() {}

	// The corner button that shows up next waits for the pointer to move
	private resetHover() {
		for (const toggle of this.toggles) toggle.classList.remove("is-hovered");
		this.closeButton.classList.remove("is-hovered");
	}

	private handleKeydown = (e: KeyboardEvent) => {
		if (hasModifier(e)) return;
		const action = MENU_KEYS[e.code];
		if (!action) return;
		// Let the Close button be clicked natively
		if (action === "confirm" && e.target === this.closeButton) return;

		e.preventDefault();
		// Otherwise the window's Esc would reopen the settings menu this key closed
		e.stopPropagation();
		if (e.repeat && (action === "confirm" || action === "back")) return;

		if (action === "back") this.dialog.close();
		else this.handleAction(action);
	};

	private handleClose = () => {
		playMenuSound("menuClose");
		this.resetHover();
		this.onClose();
		Experience.getInstance().keyboard.unlock(this);
		// Focus goes back to the button that opened the menu: Space would reopen it
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	};

	destroy() {
		if (this.dialog.open) this.dialog.close();
		this.listeners.abort();
		Experience.getInstance().keyboard.unlock(this);
		for (const toggle of this.toggles) toggle.remove();
		this.dialog.remove();
	}
}
