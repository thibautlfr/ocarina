import Experience from "../experience.ts";
import { noteDurations, type Song } from "../songs.ts";
import { listen } from "../utils/events.ts";
import type OcarinaSampler from "./ocarina-sampler.ts";
import { schedule } from "./ocarina-sampler.ts";

// What happens once a song is recognized: the last note rings out, the jingle
// plays, then the ocarina replays the song in rhythm. The keyboard stays
// locked from the recognition until the replay has faded.
export default class SongPlayback {
	private readonly sampler: OcarinaSampler;
	private readonly jingle: AudioBuffer;
	private playing = false;
	private readonly unsubscribe: () => void;

	private readonly params = {
		// The song's last note rings this long, then fades under the jingle
		lastNoteHold: 0.25,
		lastNoteFade: 0.4,
		// From the song's last note to the jingle
		jingleDelay: 0.2,
		jingleVolume: 0.8,
		// From the end of the jingle to the replay
		replayDelay: 0.35,
		// Multiplies every song's bpm
		tempo: 1,
	};

	constructor(sampler: OcarinaSampler) {
		const { songDetector, resources, debug } = Experience.getInstance();
		this.sampler = sampler;
		this.jingle = resources.get<AudioBuffer>("songCorrect");

		const folder = debug.addFolder("Song playback");
		if (folder) {
			folder.add(this.params, "lastNoteHold", 0, 1, 0.01);
			folder.add(this.params, "lastNoteFade", 0.01, 1, 0.01);
			folder.add(this.params, "jingleDelay", 0, 1, 0.01);
			folder.add(this.params, "jingleVolume", 0, 1, 0.01);
			folder.add(this.params, "replayDelay", 0, 2, 0.01);
			folder.add(this.params, "tempo", 0.5, 2, 0.05);
		}

		this.unsubscribe = listen(songDetector.emitter, "songPlayed", (song) =>
			this.perform(song),
		);
	}

	private perform(song: Song) {
		if (this.playing) return;
		this.playing = true;

		const { keyboard } = Experience.getInstance();
		const { params, sampler } = this;
		const now = sampler.currentTime;

		// Detach the last note first, so the noteUp sent by lock() doesn't cut it
		sampler.ringOut(params.lastNoteHold, params.lastNoteFade);
		keyboard.lock(this);

		const jingleEnd = sampler.playOneShot(
			this.jingle,
			now + params.jingleDelay,
			params.jingleVolume,
		);
		const replay = sampler.playSequence(
			schedule(
				noteDurations(song, params.tempo),
				jingleEnd + params.replayDelay,
			),
		);

		sampler.at(replay.end, () => {
			this.playing = false;
			keyboard.unlock(this);
		});
	}

	destroy() {
		this.unsubscribe();
		// The sampler cancels its pending callbacks, so unlock here
		Experience.getInstance().keyboard.unlock(this);
	}
}
