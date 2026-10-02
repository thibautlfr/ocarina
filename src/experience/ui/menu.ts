import Experience from "../experience.ts";
import { hasModifier } from "../input/keyboard.ts";
import { BUTTON_LABELS, type OcarinaButton } from "../ocarina-buttons.ts";
import { query, queryAll, trackHover } from "./dom.ts";
import crossGlyph from "./pixel/glyphs/cross.svg?raw";
import { pixelButton } from "./pixel-button.ts";

// Sits in the corner, over the button that opened the menu
export const CLOSE_BUTTON = /* html */ `
<button class="pixel-button pixel-button--close menu__close" type="button" aria-label="Close" title="Close (Esc)">
	${pixelButton(crossGlyph)}
</button>`;

export type MenuAction = "up" | "down" | "left" | "right" | "confirm" | "back";

// The ocarina keys: the C buttons move the cursor, A confirms
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

// Volume of each menu sound, by resource name
const MENU_SOUND_VOLUME = {
	menuOpen: 0.55,
	menuClose: 0.55,
	menuSelect: 0.4,
} as const;
type MenuSound = keyof typeof MENU_SOUND_VOLUME;

// Silent until the sampler exists, i.e. until resources are loaded
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

// Round N64 button: blue A, or yellow C with an arrow
export const n64Icon = (button: OcarinaButton, label = BUTTON_LABELS[button]) =>
	`<span class="n64 ${N64_CLASSES[button]}" role="img" aria-label="${label}">${button === "A" ? "A" : ""}</span>`;

// A full-screen <dialog> with a cursor over its `data-row` slabs, driven by
// the ocarina keys or the mouse. It closes with its close button, Esc,
// Backspace or a click outside the panel. The keyboard is locked while open.
export default abstract class Menu {
	protected readonly toggle: HTMLButtonElement;
	private readonly toggles: HTMLButtonElement[] = [];
	protected readonly dialog: HTMLDialogElement;
	private readonly closeButton: HTMLButtonElement;
	protected readonly rows: HTMLElement[];
	// Kept between openings
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
		trackHover(this.closeButton, signal);
		// The dialog covers the screen, so a click outside the panel targets it
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

	// Another button that opens the menu
	protected addToggle(button: HTMLButtonElement) {
		this.toggles.push(button);
		const { signal } = this.listeners;
		button.addEventListener(
			"click",
			() => {
				// Otherwise the dialog gives focus back to it on close, and Space
				// would reopen the menu
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

	// "back" is handled here: it closes the menu
	protected abstract handleAction(action: Exclude<MenuAction, "back">): void;

	protected onClose() {}

	// The toggle and the close button swap places in the same corner: the one
	// appearing under the cursor shouldn't look hovered until the pointer moves
	private resetHover() {
		for (const toggle of this.toggles) toggle.classList.remove("is-hovered");
		this.closeButton.classList.remove("is-hovered");
	}

	private handleKeydown = (e: KeyboardEvent) => {
		if (hasModifier(e)) return;
		const action = MENU_KEYS[e.code];
		if (!action) return;
		// Let the close button handle its own click
		if (action === "confirm" && e.target === this.closeButton) return;

		e.preventDefault();
		// Otherwise the settings menu's window listener reopens it on Esc
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
		// Focus goes back to the toggle, where Space would reopen the menu
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
