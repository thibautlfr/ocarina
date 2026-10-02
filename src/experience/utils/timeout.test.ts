import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Timeout from "./timeout.ts";

describe("Timeout", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("calls back after the delay", () => {
		const timeout = new Timeout();
		const callback = vi.fn();
		timeout.set(callback, 100);
		vi.advanceTimersByTime(99);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("replaces the pending callback when set again", () => {
		const timeout = new Timeout();
		const first = vi.fn();
		const second = vi.fn();
		timeout.set(first, 100);
		timeout.set(second, 100);
		vi.advanceTimersByTime(100);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("cancels on clear", () => {
		const timeout = new Timeout();
		const callback = vi.fn();
		timeout.set(callback, 100);
		timeout.clear();
		vi.advanceTimersByTime(100);
		expect(callback).not.toHaveBeenCalled();
	});
});
