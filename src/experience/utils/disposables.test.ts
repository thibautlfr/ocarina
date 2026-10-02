import { describe, expect, it, vi } from "vitest";
import Disposables from "./disposables.ts";

describe("Disposables", () => {
	it("runs every cleanup once", () => {
		const disposables = new Disposables();
		const a = vi.fn();
		const b = vi.fn();
		disposables.add(a);
		disposables.add(b);
		disposables.dispose();
		disposables.dispose();
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
	});

	it("removes the listeners added with its signal", () => {
		const disposables = new Disposables();
		const target = new EventTarget();
		const listener = vi.fn();
		target.addEventListener("ping", listener, { signal: disposables.signal });
		target.dispatchEvent(new Event("ping"));
		disposables.dispose();
		target.dispatchEvent(new Event("ping"));
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
