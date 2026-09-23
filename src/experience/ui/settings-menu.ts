import "../../styles/menu.css";
import "../../styles/settings-menu.css";
import Experience from "../experience.ts";
import { songs } from "../songs.ts";
import { listen } from "../utils/events.ts";
import type { OcarinaButton } from "../utils/keyboard.ts";
import { closest, fragment, query, queryAll } from "./dom.ts";
import Menu, { type MenuAction, n64Icon, playMenuSound } from "./menu.ts";
import { CLOSE_BUTTON, GEAR_BUTTON } from "./pixel-buttons.ts";

// The volume setting goes from 0 to 1 in this many steps
const VOLUME_LEVELS = 5;
// Minimum time between two select sounds while the volume changes, in ms
const VOLUME_SOUND_INTERVAL = 150;

// Chromium only: the characters printed on the keys, e.g. ZQSD on AZERTY
type LayoutNavigator = Navigator & {
	keyboard?: { getLayoutMap(): Promise<Map<string, string>> };
};

// A key cap. Letters carry their `code`, relabeled with the player's layout.
const key = (label: string, code?: string) =>
	`<kbd class="oot-key"${code ? ` data-code="${code}"` : ""}>${label}</kbd>`;

// Each ocarina button and its keys, in the order players expect: Space, then W A S D
const CONTROLS: { button: OcarinaButton; label?: string; keys: string[] }[] = [
	{ button: "A", label: "A button", keys: [key("Space")] },
	{ button: "CUp", keys: [key("W", "KeyW"), key("↑")] },
	{ button: "CLeft", keys: [key("A", "KeyA"), key("←")] },
	{ button: "CDown", keys: [key("S", "KeyS"), key("↓")] },
	{ button: "CRight", keys: [key("D", "KeyD"), key("→")] },
];

const TEMPLATE = /* html */ `
<button class="pixel-button menu-toggle" type="button" aria-label="Settings" title="Settings (Esc)" aria-haspopup="dialog" aria-controls="settings-menu">
	${GEAR_BUTTON}
</button>
<dialog class="menu" id="settings-menu" aria-labelledby="menu-title">
	<div class="menu__panel">
		<h2 class="menu__title" id="menu-title">Settings</h2>
		<ul class="menu__rows">
			<li class="slab" data-row="volume">
				<span class="slab__label oot-text" id="menu-volume-label">Volume</span>
				<div class="volume" role="slider" tabindex="0" aria-labelledby="menu-volume-label" aria-valuemin="0" aria-valuemax="${VOLUME_LEVELS}" data-focus>
					${Array.from(
						{ length: VOLUME_LEVELS },
						(_, i) =>
							`<span class="volume__bar" data-level="${i + 1}" style="--level: ${i}"></span>`,
					).join("")}
				</div>
			</li>
			<li class="slab" data-row="songRecognition">
				<span class="slab__label oot-text" id="menu-recognition-label">Song recognition</span>
				<button class="switch recognition" type="button" role="switch" aria-labelledby="menu-recognition-label" data-focus>
					<span class="switch__choice oot-text" data-choice="on">On</span>
					<span class="switch__choice oot-text" data-choice="off">Off</span>
				</button>
			</li>
			<li class="slab" data-row="songProgress">
				<span class="slab__label oot-text" id="menu-progress-label"></span>
				<button class="switch progress-erase" type="button" aria-labelledby="menu-progress-label" data-focus>
					<span class="switch__choice oot-text" data-choice="erase">Erase</span>
					<span class="switch__choice oot-text" data-choice="yes">Yes</span>
					<span class="switch__choice oot-text" data-choice="no">No</span>
				</button>
			</li>
			<li class="slab slab--controls">
				<span class="slab__label oot-text" id="menu-controls-label">Controls</span>
				<ul class="note-keys" aria-labelledby="menu-controls-label">
					${CONTROLS.map(
						({ button, label, keys }) => `
					<li class="note-keys__item">
						${n64Icon(button, label)}
						<span class="note-keys__keys">${keys.join("")}</span>
					</li>`,
					).join("")}
				</ul>
			</li>
		</ul>
	</div>
	<button class="pixel-button pixel-button--close menu__close" type="button" aria-label="Close" title="Close (Esc)">
		${CLOSE_BUTTON}
	</button>
</dialog>
`;

// The settings menu, styled after Ocarina of Time's file select: stone slabs
// and a golden cursor. Opens with Esc (the Start button) or the corner button.
export default class SettingsMenu extends Menu {
	private readonly volume: HTMLElement;
	private readonly volumeBars: HTMLElement[];
	private readonly recognitionSwitch: HTMLButtonElement;
	private readonly progressLabel: HTMLElement;
	private readonly eraseButton: HTMLButtonElement;
	// Erasing the songs learned asks first, like erasing a file: Yes or No
	private erase: "yes" | "no" | null = null;
	private lastVolumeSound = 0;
	private readonly unsubscribes: (() => void)[];

	constructor() {
		const content = fragment(TEMPLATE);
		super(query(content, ".menu-toggle"), query(content, ".menu"));
		this.volume = query(this.dialog, ".volume");
		this.volumeBars = queryAll(this.volume, ".volume__bar");
		this.recognitionSwitch = query(this.dialog, ".recognition");
		this.progressLabel = query(this.dialog, "#menu-progress-label");
		this.eraseButton = query(this.dialog, ".progress-erase");
		document.body.append(content);

		const { signal } = this.listeners;
		window.addEventListener("keydown", this.handleWindowKeydown, { signal });

		this.volume.addEventListener(
			"click",
			(e) => {
				const bar = closest(e.target, "[data-level]");
				if (!bar) return;
				// Clicking the highest lit bar turns it off, down to mute
				const level = Number(bar.dataset.level);
				this.setVolumeLevel(level === this.volumeLevel ? level - 1 : level);
			},
			{ signal },
		);
		this.recognitionSwitch.addEventListener(
			"click",
			(e) => {
				playMenuSound("menuSelect");
				const choice = closest(e.target, "[data-choice]")?.dataset.choice;
				this.setSongRecognition(
					choice ? choice === "on" : !this.settings.values.songRecognition,
				);
			},
			{ signal },
		);
		this.eraseButton.addEventListener(
			"click",
			(e) => {
				playMenuSound("menuSelect");
				const choice = closest(e.target, "[data-choice]")?.dataset.choice;
				if (choice === "yes" || choice === "no") this.erase = choice;
				this.confirmErase();
			},
			{ signal },
		);

		const { settings, songProgress } = Experience.getInstance();
		this.unsubscribes = [
			listen(settings.emitter, "change", () => this.render()),
			listen(songProgress.emitter, "change", () => this.render()),
		];

		this.render();
		this.showLayoutKeys();
	}

	private get settings() {
		return Experience.getInstance().settings;
	}

	override open() {
		this.render();
		super.open();
	}

	protected override onClose() {
		this.cancelErase();
	}

	// Esc is the Start button
	private handleWindowKeydown = (e: KeyboardEvent) => {
		if (e.code !== "Escape" || e.repeat || this.dialog.open) return;
		if (e.target instanceof HTMLElement && e.target.closest("input, textarea"))
			return;
		e.preventDefault();
		this.open();
	};

	protected handleAction(action: Exclude<MenuAction, "back">) {
		const { row } = this;
		switch (action) {
			case "up":
				this.selectRow(this.selectedRow - 1);
				break;
			case "down":
				this.selectRow(this.selectedRow + 1);
				break;
			case "left":
			case "right": {
				// The left choice is On, and Yes
				const left = action === "left";
				if (row === "volume")
					this.setVolumeLevel(this.volumeLevel + (left ? -1 : 1));
				if (row === "songRecognition") this.setSongRecognition(left);
				if (row === "songProgress" && this.erase) {
					this.erase = left ? "yes" : "no";
					this.render();
				}
				break;
			}
			case "confirm":
				if (row === "songRecognition") {
					playMenuSound("menuSelect");
					this.setSongRecognition(!this.settings.values.songRecognition);
				}
				if (row === "songProgress") {
					playMenuSound("menuSelect");
					this.confirmErase();
				}
				break;
		}
	}

	protected override selectRow(index: number, focus = true) {
		super.selectRow(index, focus);
		if (this.row !== "songProgress") this.cancelErase();
	}

	// The stored volume can be anything from 0 to 1 (e.g. set from the debug
	// panel): it shows as the nearest level
	private get volumeLevel(): number {
		return Math.round(this.settings.values.volume * VOLUME_LEVELS);
	}

	private setVolumeLevel(level: number) {
		const clamped = Math.min(VOLUME_LEVELS, Math.max(0, level));
		if (clamped === this.volumeLevel) return;
		this.settings.set("volume", clamped / VOLUME_LEVELS);
		this.playVolumeSound();
	}

	private setSongRecognition(enabled: boolean) {
		if (this.settings.values.songRecognition !== enabled) {
			this.settings.set("songRecognition", enabled);
		}
	}

	// Erase asks Yes or No (No first); confirming the answer applies it
	private confirmErase() {
		const { songProgress } = Experience.getInstance();
		if (this.erase === null) {
			if (songProgress.learnedCount > 0) this.erase = "no";
		} else {
			if (this.erase === "yes") songProgress.reset();
			this.erase = null;
		}
		this.render();
	}

	private cancelErase() {
		if (this.erase === null) return;
		this.erase = null;
		this.render();
	}

	// The select sound, played at the new volume so it can be heard, from a
	// click or ◀ ▶ alike
	private playVolumeSound() {
		const now = performance.now();
		if (now - this.lastVolumeSound < VOLUME_SOUND_INTERVAL) return;
		this.lastVolumeSound = now;
		playMenuSound("menuSelect");
	}

	private render() {
		const { songRecognition } = this.settings.values;
		const { learnedCount } = Experience.getInstance().songProgress;
		const level = this.volumeLevel;
		const confirming = this.erase !== null;

		this.volume.setAttribute("aria-valuenow", String(level));
		this.volume.setAttribute(
			"aria-valuetext",
			level === 0 ? "Muted" : `${level} of ${VOLUME_LEVELS}`,
		);
		this.volumeBars.forEach((bar, i) => {
			bar.classList.toggle("is-lit", i < level);
		});

		this.recognitionSwitch.setAttribute(
			"aria-checked",
			String(songRecognition),
		);
		this.toggleChoices(
			this.recognitionSwitch,
			(choice) => (choice === "on") === songRecognition,
		);

		this.progressLabel.textContent = confirming
			? "Erase all songs?"
			: `Songs learned ${learnedCount}/${songs.length}`;
		this.eraseButton.classList.toggle("is-confirming", confirming);
		this.eraseButton.setAttribute(
			"aria-disabled",
			String(!confirming && learnedCount === 0),
		);
		this.toggleChoices(this.eraseButton, (choice) =>
			choice === "erase" ? learnedCount > 0 : choice === this.erase,
		);
	}

	// Lights the choices of a switch for which `isActive` is true
	private toggleChoices(
		button: HTMLElement,
		isActive: (choice: string | undefined) => boolean,
	) {
		for (const choice of queryAll(button, "[data-choice]")) {
			choice.classList.toggle("is-active", isActive(choice.dataset.choice));
		}
	}

	// Show the letters actually printed on the keys (ZQSD on AZERTY) when the
	// browser can tell, WASD otherwise
	private async showLayoutKeys() {
		try {
			const layout = await (
				navigator as LayoutNavigator
			).keyboard?.getLayoutMap();
			if (!layout) return;
			for (const key of queryAll(this.dialog, "[data-code]")) {
				const label = layout.get(key.dataset.code ?? "");
				if (label) key.textContent = label.toUpperCase();
			}
		} catch {
			// Not allowed here (e.g. in an iframe): keep WASD
		}
	}

	override destroy() {
		super.destroy();
		for (const unsubscribe of this.unsubscribes) unsubscribe();
	}
}
