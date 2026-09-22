import mitt from "mitt";

type SizesEvents = {
	resize: undefined;
};

// Higher ratios cost a lot of fill rate for little visible gain
const MAX_PIXEL_RATIO = 2;

export default class Sizes {
	width = 0;
	height = 0;
	pixelRatio = 1;
	readonly emitter = mitt<SizesEvents>();

	private handleResize = () => {
		this.measure();
		this.emitter.emit("resize");
	};

	constructor() {
		this.measure();
		window.addEventListener("resize", this.handleResize);
	}

	private measure() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
	}

	destroy() {
		window.removeEventListener("resize", this.handleResize);
	}
}
