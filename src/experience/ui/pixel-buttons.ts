// Pixel buttons: a cap (edge, face, highlight, glyph) on a base, one static
// SVG per button, designed in Figma (../../../../styles/buttons at the repo
// root) and exported as-is. Colors are CSS variables (tokens.css) so the same
// button can be recolored per context (.pixel-button--close, --about, --a,
// --c). Hovering and pressing push the cap down: see .pixel-button__cap in
// ui.css.

import a from "./pixel/buttons/a.svg?raw";
import about from "./pixel/buttons/about.svg?raw";
import arrow from "./pixel/buttons/arrow.svg?raw";
import close from "./pixel/buttons/close.svg?raw";
import gear from "./pixel/buttons/gear.svg?raw";
import song from "./pixel/buttons/song.svg?raw";

export const GEAR_BUTTON = gear;
export const SONG_BUTTON = song;
export const ABOUT_BUTTON = about;
export const CLOSE_BUTTON = close;
export const A_BUTTON = a;

// One arrow button, pointing down; the other directions only rotate its glyph
// (around its own center), so the cap's lit edge stays top-left on all four.
const rotateArrow = (degrees: number) =>
	arrow.replace("rotate(0 ", `rotate(${degrees} `);

export const ARROW_DOWN_BUTTON = arrow;
export const ARROW_LEFT_BUTTON = rotateArrow(90);
export const ARROW_UP_BUTTON = rotateArrow(180);
export const ARROW_RIGHT_BUTTON = rotateArrow(270);
