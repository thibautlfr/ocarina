import GUI from "lil-gui";
import Stats from "stats-gl";
import type * as THREE from "three";

// A slider's [min, max, step] for each number of a debug target, and an
// optional label replacing the property name
export type ControlRanges<T> = Partial<
	Record<keyof T & string, readonly [number, number, number, string?]>
>;

// lil-gui panel and stats, only with #debug in the URL. `h` toggles them.
export default class Debug {
	readonly active = window.location.hash === "#debug";
	private readonly ui = this.active ? new GUI() : null;
	private readonly stats = this.active ? new Stats({ trackGPU: true }) : null;

	private handleKeydown = (e: KeyboardEvent) => {
		if (e.key === "h") this.toggle();
	};

	constructor() {
		window.addEventListener("keydown", this.handleKeydown);
	}

	// A panel folder, or null outside debug mode
	addFolder(title: string): GUI | null {
		return this.ui?.addFolder(title) ?? null;
	}

	// A folder of sliders for the numbers of `target`, inside `parent` if given.
	// Null outside debug mode.
	addControls<T extends object>(
		title: string,
		target: T,
		ranges: ControlRanges<T>,
		parent?: GUI | null,
	): GUI | null {
		const folder =
			parent === undefined ? this.addFolder(title) : parent?.addFolder(title);
		if (!folder) return null;
		for (const property of Object.keys(ranges) as (keyof T & string)[]) {
			const range = ranges[property];
			if (!range) continue;
			const [min, max, step, label] = range;
			const controller = folder.add(target, property, min, max, step);
			if (label) controller.name(label);
		}
		return folder;
	}

	initStats(renderer: THREE.WebGLRenderer) {
		if (!this.stats) return;
		document.body.appendChild(this.stats.dom);
		this.stats.init(renderer);
	}

	private toggle() {
		if (!this.ui || !this.stats) return;
		const show = this.ui._hidden;
		this.ui.show(show);
		this.stats.dom.style.display = show ? "" : "none";
	}

	begin() {
		this.stats?.begin();
	}

	end() {
		this.stats?.end();
		this.stats?.update();
	}

	destroy() {
		window.removeEventListener("keydown", this.handleKeydown);
		this.ui?.destroy();
		this.stats?.dom.remove();
	}
}
