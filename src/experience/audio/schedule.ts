import type { OcarinaButton } from "../ocarina-buttons.ts";

export type ScheduledNote = {
	button: OcarinaButton;
	// AudioContext time, in seconds
	time: number;
	duration: number;
};

// Places notes back to back, the first one at `start`
export const schedule = (
	notes: readonly Omit<ScheduledNote, "time">[],
	start: number,
): ScheduledNote[] => {
	let time = start;
	return notes.map((note) => {
		const scheduled = { ...note, time };
		time += note.duration;
		return scheduled;
	});
};
