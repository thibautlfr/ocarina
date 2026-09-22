import mitt from "mitt";
import Experience from "../experience.ts";
import { listen } from "../utils/events.ts";
import { OCARINA_BUTTONS, type OcarinaButton } from "../utils/keyboard.ts";
import type Settings from "../utils/settings.ts";

// Resource names of each button's sample (see sources.ts)
const BUTTON_SAMPLES: Record<OcarinaButton, string> = {
	A: "ocarinaD4",
	CDown: "ocarinaF4",
	CRight: "ocarinaA4",
	CLeft: "ocarinaB4",
	CUp: "ocarinaD5",
};

// Time constant of volume changes, in seconds
const VOLUME_SMOOTHING = 0.02;
// A note needs to last this long past the vibrato delay to get a vibrato
const MIN_VIBRATO_LENGTH = 0.15;
const VIBRATO_FADE_IN = 0.2;
// A fading voice is stopped after twice its fade, once inaudible
const STOP_AFTER_FADES = 2;

// Freeze a param at its current value, dropping later automation. Plain
// cancelScheduledValues would snap back mid-ramp and cause clicks.
const holdAt = (param: AudioParam, time: number) => {
	if (typeof param.cancelAndHoldAtTime === "function") {
		param.cancelAndHoldAtTime(time);
	} else {
		param.cancelScheduledValues(time);
		param.setValueAtTime(param.value, time);
	}
};

// One looping sample with its own envelope
type Voice = {
	source: AudioBufferSourceNode;
	gain: GainNode;
};

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

// A sequence being played. `end` is when its last note has faded.
export type Sequence = {
	end: number;
	// Fades out the note sounding and drops the ones still to come
	stop: (fade?: number) => void;
};

// What the ocarina actually sounds, whether played live or replayed
type SamplerEvents = {
	noteOn: OcarinaButton;
	noteOff: undefined;
};

export default class OcarinaSampler {
	readonly emitter = mitt<SamplerEvents>();

	private ctx: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private voice: Voice | null = null;
	private readonly buffers: Record<OcarinaButton, AudioBuffer>;
	private readonly timers = new Set<number>();
	private readonly settings: Settings;
	private readonly unsubscribes: (() => void)[];

	private readonly params = {
		// Output level with the volume setting at its maximum
		level: 0.9,
		attack: 0.03,
		release: 0.25,
		// Fade between two notes played legato
		crossfade: 0.02,
		// Vibrato on the longer notes of a replay
		vibratoDelay: 0.25,
		vibratoRate: 5.5,
		// In cents
		vibratoDepth: 15,
	};

	constructor() {
		const { resources, keyboard, settings, debug } = Experience.getInstance();
		this.settings = settings;

		this.buffers = Object.fromEntries(
			OCARINA_BUTTONS.map((button) => [
				button,
				resources.get<AudioBuffer>(BUTTON_SAMPLES[button]),
			]),
		) as Record<OcarinaButton, AudioBuffer>;

		const folder = debug.addFolder("Sound");
		if (folder) {
			folder
				.add(this.params, "level", 0, 1, 0.01)
				.onChange(() => this.applyVolume());
			folder.add(this.params, "attack", 0.005, 0.5, 0.005);
			folder.add(this.params, "release", 0.01, 1, 0.01);
			folder.add(this.params, "crossfade", 0.005, 0.2, 0.005);
			folder.add(this.params, "vibratoDelay", 0, 1, 0.01);
			folder.add(this.params, "vibratoRate", 0, 12, 0.1);
			folder.add(this.params, "vibratoDepth", 0, 50, 1);
		}

		this.unsubscribes = [
			listen(keyboard.emitter, "noteDown", (button) => this.play(button)),
			// The released button is already out of `held`, whose insertion order
			// makes the last entry the most recently pressed button still down
			listen(keyboard.emitter, "noteUp", () => {
				const last = [...keyboard.held].at(-1);
				if (last) this.play(last);
				else this.release();
			}),
			listen(settings.emitter, "change", ({ key }) => {
				if (key === "volume") this.applyVolume();
			}),
		];
	}

	// Squared, so each step of the volume gauge sounds about as big to the ear
	private get outputGain(): number {
		return this.params.level * this.settings.values.volume ** 2;
	}

	private applyVolume() {
		if (!this.ctx || !this.masterGain) return;
		this.masterGain.gain.setTargetAtTime(
			this.outputGain,
			this.ctx.currentTime,
			VOLUME_SMOOTHING,
		);
	}

	// Created on the first note: browsers only allow audio after a user gesture
	private getContext(): { ctx: AudioContext; masterGain: GainNode } {
		if (!this.ctx || !this.masterGain) {
			this.ctx = new AudioContext();
			this.masterGain = new GainNode(this.ctx, { gain: this.outputGain });
			this.masterGain.connect(this.ctx.destination);
		}
		return { ctx: this.ctx, masterGain: this.masterGain };
	}

	// Starts audio from a user gesture. iOS only allows it on some events
	// (touchend, click), so on-screen controls call this on release too.
	// Chrome and Safari also auto-suspend an idle context to save power: a
	// sound played after a quiet stretch would be scheduled but never heard.
	unlock() {
		const { ctx } = this.getContext();
		if (ctx.state === "suspended") ctx.resume();
	}

	get currentTime(): number {
		return this.getContext().ctx.currentTime;
	}

	// Run a callback when the audio clock reaches `time`. Returns a cancel.
	at(time: number, callback: () => void): () => void {
		const delay = Math.max(0, (time - this.currentTime) * 1000);
		const timer = window.setTimeout(() => {
			this.timers.delete(timer);
			callback();
		}, delay);
		this.timers.add(timer);
		return () => {
			window.clearTimeout(timer);
			this.timers.delete(timer);
		};
	}

	private startVoice(
		button: OcarinaButton,
		time: number,
		fadeIn: number,
	): Voice {
		const { ctx, masterGain } = this.getContext();

		const gain = new GainNode(ctx, { gain: 0 });
		gain.connect(masterGain);
		const source = new AudioBufferSourceNode(ctx, {
			buffer: this.buffers[button],
			loop: true,
		});
		source.connect(gain);
		source.start(time);

		gain.gain.setValueAtTime(0, time);
		gain.gain.linearRampToValueAtTime(1, time + fadeIn);

		return { source, gain };
	}

	private play(button: OcarinaButton) {
		this.unlock();
		const { attack, crossfade } = this.params;

		// Legato: fade the previous note out while the new one comes in quickly
		const legato = this.voice !== null;
		if (this.voice) this.fadeOut(this.voice, crossfade);

		this.voice = this.startVoice(
			button,
			this.currentTime,
			legato ? crossfade : attack,
		);
		this.emitter.emit("noteOn", button);
	}

	private release() {
		if (!this.voice) return;
		this.fadeOut(this.voice, this.params.release);
		this.voice = null;
		this.emitter.emit("noteOff");
	}

	// Let the live note ring for `hold` seconds, then fade it out. It's detached
	// right away, so later keyboard events can't cut or retrigger it.
	ringOut(hold: number, fade: number) {
		if (!this.voice || !this.ctx) return;
		const end = this.ctx.currentTime + hold;
		this.fadeOut(this.voice, fade, end);
		this.voice = null;
		this.at(end, () => this.emitter.emit("noteOff"));
	}

	// Plays the notes back to back, legato
	playSequence(notes: readonly ScheduledNote[]): Sequence {
		const { attack, crossfade, release } = this.params;
		let previous: Voice | null = null;
		let end = this.currentTime;
		// What stop() has to silence: voices not ended yet, vibratos, callbacks
		const voices = new Set<Voice>();
		const vibratos: OscillatorNode[] = [];
		const cancels: (() => void)[] = [];

		for (const note of notes) {
			if (previous) this.fadeOut(previous, crossfade, note.time);
			const voice = this.startVoice(
				note.button,
				note.time,
				previous ? crossfade : attack,
			);
			voices.add(voice);
			voice.source.addEventListener("ended", () => voices.delete(voice));
			const vibrato = this.addVibrato(voice, note);
			if (vibrato) vibratos.push(vibrato);
			cancels.push(
				this.at(note.time, () => this.emitter.emit("noteOn", note.button)),
			);

			previous = voice;
			end = note.time + note.duration;
		}

		if (previous) {
			this.fadeOut(previous, release, end);
			cancels.push(this.at(end, () => this.emitter.emit("noteOff")));
		}

		let stopped = false;
		const stop = (fade = release) => {
			if (stopped || !this.ctx) return;
			stopped = true;
			const now = this.ctx.currentTime;
			for (const cancel of cancels) cancel();
			// Notes still to come are stopped before they start
			for (const voice of voices) this.fadeOut(voice, fade);
			for (const vibrato of vibratos) {
				vibrato.stop(now + fade * STOP_AFTER_FADES);
			}
			if (notes.length > 0 && now >= notes[0].time && now < end) {
				this.emitter.emit("noteOff");
			}
		};

		return { end: end + release, stop };
	}

	// Plays a sample once. Returns when it ends.
	playOneShot(buffer: AudioBuffer, time: number, volume: number): number {
		this.unlock();
		const { ctx, masterGain } = this.getContext();
		const gain = new GainNode(ctx, { gain: volume });
		gain.connect(masterGain);
		const source = new AudioBufferSourceNode(ctx, { buffer });
		source.connect(gain);
		source.onended = () => gain.disconnect();
		source.start(time);
		return time + buffer.duration;
	}

	// Delayed vibrato fading in, only on notes long enough to hear it
	private addVibrato(voice: Voice, note: ScheduledNote): OscillatorNode | null {
		const { ctx } = this.getContext();
		const { vibratoDelay, vibratoRate, vibratoDepth, release } = this.params;
		if (
			vibratoDepth === 0 ||
			note.duration < vibratoDelay + MIN_VIBRATO_LENGTH
		) {
			return null;
		}

		const start = note.time + vibratoDelay;
		const lfo = new OscillatorNode(ctx, { frequency: vibratoRate });
		const depth = new GainNode(ctx, { gain: 0 });
		lfo.connect(depth).connect(voice.source.detune);

		depth.gain.setValueAtTime(0, start);
		depth.gain.linearRampToValueAtTime(vibratoDepth, start + VIBRATO_FADE_IN);

		lfo.start(start);
		lfo.stop(note.time + note.duration + release * STOP_AFTER_FADES);
		lfo.onended = () => depth.disconnect();
		return lfo;
	}

	private fadeOut(voice: Voice, duration: number, startTime?: number) {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		const start = Math.max(startTime ?? now, now);

		if (start > now) {
			// Delayed fade: let the attack finish, then fade from the level at `start`
			voice.gain.gain.cancelScheduledValues(start);
		} else {
			holdAt(voice.gain.gain, now);
		}
		// setTargetAtTime reaches ~95% after 3 time constants
		voice.gain.gain.setTargetAtTime(0, start, duration / 3);

		voice.source.stop(start + duration * STOP_AFTER_FADES);
		voice.source.onended = () => voice.gain.disconnect();
	}

	destroy() {
		for (const unsubscribe of this.unsubscribes) unsubscribe();
		for (const timer of this.timers) window.clearTimeout(timer);
		this.timers.clear();
		this.emitter.all.clear();
		this.ctx?.close();
		this.ctx = null;
		this.masterGain = null;
		this.voice = null;
	}
}
