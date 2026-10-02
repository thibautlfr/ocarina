import type { OcarinaButton } from "../ocarina-buttons.ts";
import type { Song } from "../songs/songs.ts";
import { query } from "./dom.ts";
import { n64Icon } from "./menu.ts";
import { trebleClefIcon } from "./pixel-icons.ts";

// Staff position of each button's pitch, in lines and spaces above the bottom
// line (E4): A (D4) hangs under it, C▲ (D5) sits on the fourth line
const STAFF_STEPS: Record<OcarinaButton, number> = {
	A: -1,
	CDown: 1,
	CRight: 3,
	CLeft: 4,
	CUp: 6,
};

export const STAFF_TEMPLATE = /* html */ `
<p class="song-book__name oot-text" aria-live="polite"></p>
<div class="staff">
	<span class="staff__lines"></span>
	<span class="staff__clef">${trebleClefIcon}</span>
	<ol class="staff__notes"></ol>
</div>`;

// A song's name and its notes written on a staff, lit one by one while it plays
export default class SongStaff {
	private readonly name: HTMLElement;
	private readonly notes: HTMLElement;
	// Bumped on every render, so a demo of the previous song stops lighting it
	private version = 0;

	// `root` holds the STAFF_TEMPLATE markup
	constructor(root: ParentNode) {
		this.name = query(root, ".song-book__name");
		this.notes = query(root, ".staff__notes");
	}

	render(song: Song) {
		this.version++;
		this.name.textContent = song.name;
		this.notes.setAttribute("aria-label", song.name);
		this.notes.innerHTML = song.buttons
			.map(
				(button) =>
					`<li class="staff__note" style="--step: ${STAFF_STEPS[button]}">${n64Icon(button)}</li>`,
			)
			.join("");
	}

	// Lights the note at `index`, or none with -1
	light(index: number) {
		[...this.notes.children].forEach((element, i) => {
			element.classList.toggle("is-playing", i === index);
		});
	}

	// A light() for the song shown now, which does nothing once another is
	lighter(): (index: number) => void {
		const version = this.version;
		return (index) => {
			if (version === this.version) this.light(index);
		};
	}
}
