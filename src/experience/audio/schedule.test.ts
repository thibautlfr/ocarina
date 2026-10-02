import { describe, expect, it } from "vitest";
import { schedule } from "./schedule.ts";

describe("schedule", () => {
	it("places notes back to back from the start time", () => {
		expect(
			schedule(
				[
					{ button: "A", duration: 0.5 },
					{ button: "CUp", duration: 0.25 },
					{ button: "CDown", duration: 1 },
				],
				10,
			),
		).toEqual([
			{ button: "A", duration: 0.5, time: 10 },
			{ button: "CUp", duration: 0.25, time: 10.5 },
			{ button: "CDown", duration: 1, time: 10.75 },
		]);
	});

	it("returns nothing for no notes", () => {
		expect(schedule([], 3)).toEqual([]);
	});
});
