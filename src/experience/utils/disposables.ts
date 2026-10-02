// Everything a class has to undo when destroyed: DOM listeners added with
// `signal`, and cleanups such as the unsubscribes returned by listen().
// dispose() runs them all, once.
export default class Disposables {
	private readonly controller = new AbortController();
	private readonly cleanups: (() => void)[] = [];

	get signal(): AbortSignal {
		return this.controller.signal;
	}

	add(...cleanups: (() => void)[]) {
		this.cleanups.push(...cleanups);
	}

	dispose() {
		this.controller.abort();
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}
}
