import type { Sequence } from "../audio/ocarina-sampler.ts";
import { schedule } from "../audio/schedule.ts";
import Experience from "../experience.ts";
import { noteDurations, type Song } from "../songs/songs.ts";
import type SongStaff from "./song-staff.ts";

// Delay before a demo's first note, and fade of a demo cut by another, in s
const DEMO_DELAY = 0.08;
const DEMO_CUT_FADE = 0.15;

// Plays a song in rhythm, lighting each of its notes on the staff. Playing
// another one cuts the one playing.
export default class SongDemo {
	private readonly staff: SongStaff;
	private sequence: Sequence | null = null;
	private cancels: (() => void)[] = [];

	constructor(staff: SongStaff) {
		this.staff = staff;
	}

	play(song: Song) {
		const { sampler } = Experience.getInstance();
		sampler.unlock();
		const cut = this.stop();

		const start = sampler.currentTime + (cut ? DEMO_CUT_FADE : DEMO_DELAY);
		const notes = schedule(noteDurations(song), start);
		const last = notes[notes.length - 1];
		this.sequence = sampler.playSequence(notes);

		const light = this.staff.lighter();
		this.cancels = [
			...notes.map((note, index) => sampler.at(note.time, () => light(index))),
			sampler.at(last.time + last.duration, () => light(-1)),
		];
	}

	// Fades out the demo if one is playing, and returns whether one was
	stop(): boolean {
		const { sampler } = Experience.getInstance();
		const playing =
			this.sequence !== null && sampler.currentTime < this.sequence.end;
		this.sequence?.stop(DEMO_CUT_FADE);
		this.sequence = null;
		for (const cancel of this.cancels) cancel();
		this.cancels = [];
		this.staff.light(-1);
		return playing;
	}
}
