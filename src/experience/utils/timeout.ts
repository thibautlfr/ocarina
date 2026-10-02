// A single pending setTimeout: setting it again replaces the one pending
export default class Timeout {
	private id = 0;

	set(callback: () => void, ms: number) {
		this.clear();
		this.id = window.setTimeout(callback, ms);
	}

	clear() {
		window.clearTimeout(this.id);
	}
}
