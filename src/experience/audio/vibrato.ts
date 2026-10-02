import type { ScheduledNote } from "./schedule.ts";

// A note needs to last this long past the vibrato delay to get a vibrato
const MIN_VIBRATO_LENGTH = 0.15;
const VIBRATO_FADE_IN = 0.2;

export type VibratoParams = {
	// From the start of the note, in seconds
	delay: number;
	// In Hz
	rate: number;
	// In cents
	depth: number;
};

// Delayed vibrato fading in on `detune`, only on notes long enough to hear it.
// The oscillator stops at `stopAt`; null when the note gets no vibrato.
export const addVibrato = (
	ctx: BaseAudioContext,
	detune: AudioParam,
	note: ScheduledNote,
	{ delay, rate, depth }: VibratoParams,
	stopAt: number,
): OscillatorNode | null => {
	if (depth === 0 || note.duration < delay + MIN_VIBRATO_LENGTH) return null;

	const start = note.time + delay;
	const lfo = new OscillatorNode(ctx, { frequency: rate });
	const gain = new GainNode(ctx, { gain: 0 });
	lfo.connect(gain).connect(detune);

	gain.gain.setValueAtTime(0, start);
	gain.gain.linearRampToValueAtTime(depth, start + VIBRATO_FADE_IN);

	lfo.start(start);
	lfo.stop(stopAt);
	lfo.onended = () => gain.disconnect();
	return lfo;
};
