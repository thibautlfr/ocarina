// Pixel art drawn as crisp SVG from grids of cells: "X" is filled, anything
// else empty. Used by the pixel buttons (see DESIGN.md).

export type Glyph = readonly string[];

export const GEAR: Glyph = [
	"....XX....",
	".XX.XX.XX.",
	".XXXXXXXX.",
	"..XX..XX..",
	"XXX....XXX",
	"XXX....XXX",
	"..XX..XX..",
	".XXXXXXXX.",
	".XX.XX.XX.",
	"....XX....",
];

export const CROSS: Glyph = [
	"XX....XX",
	"XXX..XXX",
	".XXXXXX.",
	"..XXXX..",
	"..XXXX..",
	".XXXXXX.",
	"XXX..XXX",
	"XX....XX",
];

export const EIGHTH_NOTE: Glyph = [
	"....XX....",
	"....XXXX..",
	"....XX.XX.",
	"....XX..XX",
	"....XX...X",
	"....XX....",
	".XXXXX....",
	"XXXXXX....",
	"XXXXXX....",
	".XXXX.....",
];

// Serif "i", like the information icons: the About button
export const LETTER_I: Glyph = [
	"..XX..",
	"..XX..",
	"......",
	".XXX..",
	"..XX..",
	"..XX..",
	"..XX..",
	"..XX..",
	"..XX..",
	"XXXXXX",
];

// The ocarina buttons' glyphs: A's letter and the C buttons' arrows
export const LETTER_A: Glyph = [
	".XXXX.",
	"XX..XX",
	"XX..XX",
	"XXXXXX",
	"XXXXXX",
	"XX..XX",
	"XX..XX",
	"XX..XX",
];

export const ARROW_UP: Glyph = [
	"....XX....",
	"...XXXX...",
	"..XXXXXX..",
	".XXXXXXXX.",
	"XXXXXXXXXX",
];

export const ARROW_DOWN: Glyph = [...ARROW_UP].reverse();

// Columns of the up arrow read as rows
const transpose = (glyph: Glyph): Glyph =>
	[...glyph[0]].map((_, x) => glyph.map((row) => row[x]).join(""));

export const ARROW_LEFT: Glyph = transpose(ARROW_UP);

export const ARROW_RIGHT: Glyph = transpose(ARROW_DOWN);

// Pixel icons, drawn with pixelIcon()
export const SONG_NOTE: Glyph = [
	"......XX....",
	"......XXX...",
	"......XXXX..",
	"......XX.XX.",
	"......XX..XX",
	"......XX...X",
	"......XX...X",
	"......XX....",
	"......XX....",
	"......XX....",
	"..XXXXXX....",
	".XXXXXXX....",
	"XXXXXXXX....",
	"XXXXXXXX....",
	".XXXXXX.....",
	"..XXXX......",
];

// Its spiral winds around the G line, 21 rows from the top
export const TREBLE_CLEF: Glyph = [
	"......XX....",
	".....XXXX...",
	".....XX.XX..",
	"....XX..XX..",
	"....XX..XX..",
	"....XX.XX...",
	"....XX.XX...",
	"....XXXX....",
	"....XXX.....",
	"...XXX......",
	"..XXXX......",
	".XXXXX......",
	".XX.XX......",
	"XX..XX......",
	"XX..XXXXX...",
	"XX.XXXXXXX..",
	"XXXX.XX..XX.",
	"XXX..XX...XX",
	"XX...XX...XX",
	"XX...XX...XX",
	"XX....XX..XX",
	".XX...XX.XX.",
	"..XXX.XXXX..",
	"...XXXXXX...",
	"......XX....",
	".......XX...",
	".......XX...",
	".......XX...",
	".......XX...",
	"..XX...XX...",
	".XXXX..XX...",
	".XXXX.XX....",
	"..XXXXX.....",
];

export const HEADPHONES: Glyph = [
	"....XXXXXX....",
	"..XXXXXXXXXX..",
	".XXX......XXX.",
	".XX........XX.",
	"XX..........XX",
	"XX..........XX",
	"XX..........XX",
	"XXXX......XXXX",
	"XXXXX....XXXXX",
	"XXXXX....XXXXX",
	"XXXXX....XXXXX",
	"XXXXX....XXXXX",
	".XXXX....XXXX.",
];

// Social links, drawn with pixelIcon(): the holes show the outline color
export const GITHUB: Glyph = [
	".....XXXXX.....",
	"...XXXXXXXXX...",
	"..XXXXXXXXXXX..",
	".XXX.XXXXX.XXX.",
	".XXX.......XXX.",
	"XXX.........XXX",
	"XXX.........XXX",
	"XXX.........XXX",
	"XXXX.......XXXX",
	"XXXXX.....XXXXX",
	".X..XX...XXXXX.",
	".XX.....XXXXXX.",
	"..XXX...XXXXX..",
	"...XX...XXXX...",
	".....X...X.....",
];

export const X_LOGO: Glyph = [
	"XXXX.......XX",
	".XXXX.....XX.",
	"..XXXX...XX..",
	"...XXXX.XX...",
	"....XXXXX....",
	".....XXX.....",
	"....XXXXX....",
	"...XX.XXXX...",
	"..XX...XXXX..",
	".XX.....XXXX.",
	"XX.......XXXX",
];

export const LINKEDIN: Glyph = [
	"XXXXXXXXXXXXX",
	"X..XXXXXXXXXX",
	"X..XXXXXXXXXX",
	"XXXXXXXXXXXXX",
	"X..X....XXXXX",
	"X..X.....XXXX",
	"X..X..X...XXX",
	"X..X..XX..XXX",
	"X..X..XX..XXX",
	"X..X..XX..XXX",
	"XXXXXXXXXXXXX",
];

// A row of a triangle `width` cells wide and `height` rows tall: it widens
// by two cells at a time, every row or two, so its sides lean at 60°
const triangleRow = (width: number, height: number, row: number) => {
	const filled = 2 * Math.ceil((((row + 1) / height) * width) / 2);
	const side = ".".repeat((width - filled) / 2);
	return `${side}${"X".repeat(filled)}${side}`;
};

// Three equilateral triangles around an empty one, for the title screen
const TRIFORCE_WIDTH = 16;
const TRIFORCE_HEIGHT = 14;
export const TRIFORCE: Glyph = Array.from(
	{ length: 2 * TRIFORCE_HEIGHT },
	(_, y) =>
		y < TRIFORCE_HEIGHT
			? `${".".repeat(TRIFORCE_WIDTH / 2)}${triangleRow(TRIFORCE_WIDTH, TRIFORCE_HEIGHT, y)}${".".repeat(TRIFORCE_WIDTH / 2)}`
			: triangleRow(
					TRIFORCE_WIDTH,
					TRIFORCE_HEIGHT,
					y - TRIFORCE_HEIGHT,
				).repeat(2),
);

// SVG path of a grid's filled cells at (x, y), one rectangle per run
export const pixelPath = (glyph: Glyph, x = 0, y = 0) =>
	glyph
		.flatMap((row, dy) =>
			[...row.matchAll(/X+/g)].map(
				(run) =>
					`M${x + (run.index ?? 0)} ${y + dy}h${run[0].length}v1h-${run[0].length}z`,
			),
		)
		.join("");

const glyphPaths = (glyph: Glyph, x: number, y: number) => `
		<path fill="var(--glyph-shade, var(--light))" d="${pixelPath(glyph, x, y + 1)}" />
		<path fill="var(--glyph)" d="${pixelPath(glyph, x, y)}" />`;

// A square 20×20 pixel button: a cap (edge, face, highlight, engraved glyph)
// resting on a base whose shaded side shows below it. CSS pushes the cap down
// into the base. Colors come from the .pixel-button CSS variables.
export const pixelButton = (glyph: Glyph, x: number, y: number) => `
<svg class="pixel-art" viewBox="0 0 20 20" aria-hidden="true">
	<path fill="var(--edge)" d="M2 4h16v1h1v1h1v12h-1v1h-1v1H2v-1H1v-1H0V6h1V5h1z" />
	<path fill="var(--shade)" d="M2 5h16v1h1v12h-1v1H2v-1H1V6h1z" />
	<g class="pixel-button__cap">
		<path fill="var(--edge)" d="M2 0h16v1h1v1h1v12h-1v1h-1v1H2v-1H1v-1H0V2h1V1h1z" />
		<path fill="var(--face)" d="M2 1h16v1h1v12h-1v1H2v-1H1V2h1z" />
		<path fill="var(--light)" d="M3 2h13v1H3zM2 3h1v5H2z" />${glyphPaths(glyph, x, y)}
	</g>
</svg>`;

const cellAt = (glyph: Glyph, x: number, y: number) => glyph[y]?.[x] === "X";

// A standalone pixel icon: the glyph in --face, lit on its top cells and
// shaded on its bottom ones, with a one-cell --edge outline dropping one cell
export const pixelIcon = (glyph: Glyph) => {
	const width = glyph[0].length + 2;
	const height = glyph.length + 3;
	const cells = (keep: (x: number, y: number) => boolean): Glyph =>
		glyph.map((row, y) =>
			[...row]
				.map((_, x) => (cellAt(glyph, x, y) && keep(x, y) ? "X" : "."))
				.join(""),
		);
	// The glyph grown by one cell in every direction, on the padded grid
	const outline: Glyph = Array.from({ length: height - 1 }, (_, y) =>
		Array.from({ length: width }, (_, x) =>
			[-1, 0, 1].some((dy) =>
				[-1, 0, 1].some((dx) => cellAt(glyph, x - 1 + dx, y - 1 + dy)),
			)
				? "X"
				: ".",
		).join(""),
	);
	const light = cells((x, y) => !cellAt(glyph, x, y - 1));
	const shade = cells(
		(x, y) => cellAt(glyph, x, y - 1) && !cellAt(glyph, x, y + 1),
	);

	return `
<svg class="pixel-art" viewBox="0 0 ${width} ${height}" aria-hidden="true">
	<path fill="var(--edge)" d="${pixelPath(outline, 0, 1)}${pixelPath(outline)}" />
	<path fill="var(--face)" d="${pixelPath(glyph, 1, 1)}" />
	<path fill="var(--shade)" d="${pixelPath(shade, 1, 1)}" />
	<path fill="var(--light)" d="${pixelPath(light, 1, 1)}" />
</svg>`;
};
