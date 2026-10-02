import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Keyboard from "./keyboard.ts";

const key = (type: "keydown" | "keyup", code: string, init = {}) =>
	window.dispatchEvent(new KeyboardEvent(type, { code, ...init }));

describe("Keyboard", () => {
	let keyboard: Keyboard;
	let events: string[];

	beforeEach(() => {
		keyboard = new Keyboard();
		events = [];
		keyboard.emitter.on("noteDown", (b) => events.push(`down:${b}`));
		keyboard.emitter.on("noteUp", (b) => events.push(`up:${b}`));
		keyboard.emitter.on("lockChange", (l) => events.push(`lock:${l}`));
	});

	afterEach(() => keyboard.destroy());

	it("maps physical keys to ocarina buttons", () => {
		key("keydown", "KeyW");
		key("keydown", "ArrowLeft");
		key("keyup", "KeyW");
		expect(events).toEqual(["down:CUp", "down:CLeft", "up:CUp"]);
	});

	it("ignores repeats, unknown keys and shortcuts", () => {
		key("keydown", "Space", { repeat: true });
		key("keydown", "KeyQ");
		key("keydown", "KeyS", { ctrlKey: true });
		expect(events).toEqual([]);
	});

	it("keeps a button held while any input holds it", () => {
		keyboard.press("KeyW", "CUp");
		keyboard.press("ArrowUp", "CUp");
		keyboard.release("KeyW");
		expect(keyboard.held.has("CUp")).toBe(true);
		keyboard.release("ArrowUp");
		expect(events).toEqual(["down:CUp", "up:CUp"]);
	});

	it("keeps the held buttons in press order", () => {
		keyboard.press("a", "CDown");
		keyboard.press("b", "A");
		keyboard.press("c", "CRight");
		keyboard.release("b");
		expect([...keyboard.held]).toEqual(["CDown", "CRight"]);
	});

	it("stays locked until every owner unlocks", () => {
		const replay = {};
		const menu = {};
		keyboard.press("KeyW", "CUp");
		keyboard.lock(replay);
		keyboard.lock(menu);
		keyboard.press("KeyA", "CLeft");
		keyboard.unlock(replay);
		expect(keyboard.locked).toBe(true);
		keyboard.unlock(menu);
		expect(keyboard.locked).toBe(false);
		expect(events).toEqual(["down:CUp", "up:CUp", "lock:true", "lock:false"]);
	});

	it("releases everything when the window loses focus", () => {
		keyboard.press("KeyW", "CUp");
		keyboard.press("Space", "A");
		window.dispatchEvent(new Event("blur"));
		expect(keyboard.held.size).toBe(0);
		expect(events).toEqual(["down:CUp", "down:A", "up:CUp", "up:A"]);
	});

	it("lets editable fields keep their keys", () => {
		const input = document.createElement("input");
		document.body.append(input);
		const spy = vi.fn();
		keyboard.emitter.on("noteDown", spy);
		input.dispatchEvent(
			new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }),
		);
		expect(spy).not.toHaveBeenCalled();
		input.remove();
	});
});
