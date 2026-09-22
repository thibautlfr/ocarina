import mitt from "mitt";

type TimeEvents = {
	tick: undefined;
};

// The frame loop. Times are in milliseconds.
export default class Time {
	readonly start = performance.now();
	current = this.start;
	elapsed = 0;
	// A 60 fps frame until the first tick
	delta = 16;
	readonly emitter = mitt<TimeEvents>();
	private frame = 0;

	constructor() {
		this.frame = window.requestAnimationFrame(this.tick);
	}

	private tick = (timestamp: number) => {
		this.delta = timestamp - this.current;
		this.current = timestamp;
		this.elapsed = this.current - this.start;

		this.emitter.emit("tick");

		this.frame = window.requestAnimationFrame(this.tick);
	};

	destroy() {
		window.cancelAnimationFrame(this.frame);
	}
}
