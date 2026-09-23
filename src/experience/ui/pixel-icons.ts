// The icons from pixel/icons/, outlined in ink: a copy of each icon's shapes,
// stroked, is drawn underneath it (see .pixel-icon__outline in ui.css). Cheaper
// than stacking drop-shadow filters, and shapes that touch keep no seam.
import githubSvg from "./pixel/icons/github.svg?raw";
import headphonesSvg from "./pixel/icons/headphones.svg?raw";
import linkedinSvg from "./pixel/icons/linkedin.svg?raw";
import songNoteSvg from "./pixel/icons/song-note.svg?raw";
import trebleClefSvg from "./pixel/icons/treble-clef.svg?raw";
import triforceSvg from "./pixel/icons/triforce.svg?raw";
import xLogoSvg from "./pixel/icons/x-logo.svg?raw";

const outlined = (svg: string) => {
	const open = svg.indexOf(">") + 1;
	const close = svg.lastIndexOf("</svg>");
	const shapes = svg.slice(open, close);
	return `${svg.slice(0, open)}<g class="pixel-icon__outline">${shapes}</g>${shapes}</svg>`;
};

export const githubIcon = outlined(githubSvg);
export const headphonesIcon = outlined(headphonesSvg);
export const linkedinIcon = outlined(linkedinSvg);
export const songNoteIcon = outlined(songNoteSvg);
export const trebleClefIcon = outlined(trebleClefSvg);
export const triforceIcon = outlined(triforceSvg);
export const xLogoIcon = outlined(xLogoSvg);
