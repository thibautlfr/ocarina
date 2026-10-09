import * as THREE from "three";

const DURATION = 6;
// So a fairy at the far wall reaches the ring in time
const SPEED_BOOST = 2.2;
const PEAK_FLARE = 2.4;
// The ring: turns around the ocarina, radius from wide to tight and back,
// and how high it rises above the ocarina
const TURNS = 1.5;
const RADIUS = { wide: 1.4, tight: 0.7 };
const RISE = 0.6;

// Once every song is learned: the fairies gather in a ring turning around the
// ocarina, which tightens then widens again as it rises, glowing brighter
export default class Celebration {
	// Seconds since it started, null when there's none
	private elapsed: number | null = null;
	private readonly center: THREE.Vector3;

	constructor(center: THREE.Vector3) {
		this.center = center;
	}

	get active(): boolean {
		return this.elapsed !== null;
	}

	get speedBoost(): number {
		return this.active ? SPEED_BOOST : 1;
	}

	// Brightness multiplier of the fairies
	get flare(): number {
		return this.active ? 1 + (PEAK_FLARE - 1) * this.swell : 1;
	}

	start() {
		this.elapsed = 0;
	}

	// True on the frame it ends
	advance(dt: number): boolean {
		if (this.elapsed === null) return false;
		this.elapsed += dt;
		if (this.elapsed < DURATION) return false;
		this.elapsed = null;
		return true;
	}

	// The place of the fairy `share` (0 to 1) of the way around the ring
	ringPoint(share: number, out: THREE.Vector3): THREE.Vector3 {
		const angle = (share + this.progress * TURNS) * Math.PI * 2;
		const radius = THREE.MathUtils.lerp(RADIUS.wide, RADIUS.tight, this.swell);
		return out
			.set(
				Math.cos(angle) * radius,
				this.progress * RISE,
				Math.sin(angle) * radius,
			)
			.add(this.center);
	}

	// From 0 to 1
	private get progress(): number {
		return (this.elapsed ?? 0) / DURATION;
	}

	// 0 at both ends, 1 halfway through
	private get swell(): number {
		return Math.sin(this.progress * Math.PI);
	}
}
