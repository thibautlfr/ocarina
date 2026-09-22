import GUI from "lil-gui";
import Stats from "stats-gl";
import type * as THREE from "three";

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
