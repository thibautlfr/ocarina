import "../../styles/menu.css";
import "../../styles/about-menu.css";
import { closest, fragment, query, queryAll } from "./dom.ts";
import Menu, { type MenuAction, playMenuSound } from "./menu.ts";
import {
	CROSS,
	GITHUB,
	type Glyph,
	LETTER_I,
	LINKEDIN,
	pixelButton,
	pixelIcon,
	X_LOGO,
} from "./pixel-art.ts";

const AUTHOR = "Thibaut Lefrançois";
const WEBSITE = "https://thibaut-lefrancois.com";
// The feedback repository: the code stays private, this is the public door to
// it. Straight to the issue chooser, which also links the discussions.
const FEEDBACK =
	"https://github.com/thibautlfr/ocarina-3d-feedback/issues/new/choose";

const SOCIALS: { name: string; url: string; glyph: Glyph }[] = [
	{ name: "GitHub", url: "https://github.com/thibautlfr", glyph: GITHUB },
	{ name: "X", url: "https://x.com/thibautlfr", glyph: X_LOGO },
	{
		name: "LinkedIn",
		url: "https://www.linkedin.com/in/thibaut-lefrancois/",
		glyph: LINKEDIN,
	},
];

// What the experience borrows, and from whom (the licenses are in the README)
const CREDITS: { what: string; who: string; url: string }[] = [
	{
		what: "Ocarina model",
		who: "pau_alma_3D · CC BY 4.0",
		url: "https://sketchfab.com/3d-models/ocarina-of-time-40ab5c7438374647b1c86245019f73aa",
	},
	{
		what: "Navi's wings",
		who: "darkewne · CC BY 4.0",
		url: "https://sketchfab.com/3d-models/navi-fairy-of-link-zelda-724f7dbdbc8440edb7cfddb1abfd0a71",
	},
	{
		what: "Link's house",
		who: "BrittanyOfKoppai",
		url: "https://models.spriters-resource.com/3ds/thelegendofzeldaocarinaoftime3d/asset/325223/",
	},
	{
		what: "Ocarina sounds",
		who: "HelpTheWretched",
		url: "https://noproblo.dayjo.org/zeldasounds/",
	},
	{
		what: "Pixel font",
		who: "Jersey 10",
		url: "https://fonts.google.com/specimen/Jersey+10",
	},
];

// Opens in a new tab: the experience keeps playing behind. `cursor-frame` is
// left to the caller: a link sitting among others in a slab takes its own small
// corners, one filling its slab lets the slab's own corners say it is picked.
const link = (
	url: string,
	content: string,
	className: string,
	name: string,
	label = "",
) =>
	`<a class="${className}" href="${url}" target="_blank" rel="noopener"${label ? ` aria-label="${label}" title="${label}"` : ""} data-item data-link="${name}">${content}</a>`;

const TEMPLATE = /* html */ `
<button class="about-toggle cursor-frame oot-text" type="button" title="About" aria-haspopup="dialog" aria-controls="about-menu" data-source="signature">
	<span class="about-toggle__label"><span class="about-toggle__by">by</span> ${AUTHOR}</span>
</button>
<button class="pixel-button pixel-button--about about-button" type="button" aria-label="About" title="About" aria-haspopup="dialog" aria-controls="about-menu" data-source="button">
	${pixelButton(LETTER_I, 7, 3)}
</button>
<dialog class="menu about" id="about-menu" aria-labelledby="about-title">
	<div class="menu__panel">
		<h2 class="menu__title" id="about-title">About</h2>
		<ul class="menu__rows">
			<li class="slab about__author" data-row="author" data-axis="x">
				<p class="about__made-by oot-text">
					<span>Made by</span>
					${link(WEBSITE, AUTHOR, "about__name cursor-frame", "website")}
				</p>
				<span class="about__socials">
					${SOCIALS.map(({ name, url, glyph }) =>
						link(
							url,
							pixelIcon(glyph),
							"about__social cursor-frame",
							name,
							name,
						),
					).join("")}
				</span>
			</li>
			<li class="slab about__feedback" data-row="feedback" data-axis="x">
				${link(FEEDBACK, "Leave feedback", "about__action oot-text", "feedback")}
			</li>
			<li class="slab about__credits" data-row="credits" data-axis="y">
				<span class="slab__label oot-text" id="about-credits-label">Credits</span>
				<ul class="about__credit-list" aria-labelledby="about-credits-label">
					${CREDITS.map(
						({ what, who, url }) => `
					<li>${link(
						url,
						`<span class="about__what">${what}</span><span class="about__who">${who}</span>`,
						"about__credit oot-text cursor-frame",
						what,
					)}</li>`,
					).join("")}
				</ul>
			</li>
			<li class="about__footer">
				<p class="about__disclaimer oot-text">
					A fan tribute, not affiliated with Nintendo.
					<span>The Legend of Zelda is a trademark of Nintendo.</span>
				</p>
			</li>
		</ul>
	</div>
	<button class="pixel-button pixel-button--close menu__close" type="button" aria-label="Close" title="Close (Esc)">
		${pixelButton(CROSS, 6, 4)}
	</button>
</dialog>
`;

// Who made the experience, where to follow them, where to say what broke, and
// the credits for what it borrows. Opened by the gold "i" button next to the
// game's buttons, or by the signature in the corner opposite them.
// Every link takes the cursor: the rows laid out in a line (`data-axis` x) go
// left and right, the credits up and down. The source code isn't linked while
// the repository is private.
export default class AboutMenu extends Menu {
	// The links and buttons of each row, and the one under the cursor in each
	private readonly items: HTMLElement[][];
	private readonly selectedItems: number[];

	constructor() {
		const content = fragment(TEMPLATE);
		super(query(content, ".about-toggle"), query(content, ".about"));
		// The signature reads as part of the scene, not as a button: the gold "i"
		// among the game's buttons is the way in nobody has to guess
		this.addToggle(query(content, ".about-button"));
		this.items = this.rows.map((row) => queryAll(row, "[data-item]"));
		this.selectedItems = this.rows.map(() => 0);
		document.body.append(content);

		const { signal } = this.listeners;
		this.items.forEach((links, row) => {
			links.forEach((item, index) => {
				item.addEventListener(
					"pointerenter",
					(e) => {
						if (e.pointerType === "mouse") this.selectItem(row, index);
					},
					{ signal },
				);
				item.addEventListener(
					"focusin",
					() => this.selectItem(row, index, false),
					{ signal },
				);
			});
		});
		this.dialog.addEventListener(
			"click",
			(e) => {
				const item = closest(e.target, "[data-item]");
				if (!item) return;
				playMenuSound("menuSelect");
			},
			{ signal },
		);
	}

	private get vertical(): boolean {
		return this.rows[this.selectedRow].dataset.axis === "y";
	}

	private get item(): HTMLElement {
		return this.items[this.selectedRow][this.selectedItems[this.selectedRow]];
	}

	protected handleAction(action: Exclude<MenuAction, "back">) {
		switch (action) {
			case "up":
			case "down": {
				const step = action === "up" ? -1 : 1;
				const next = this.selectedItems[this.selectedRow] + step;
				const count = this.items[this.selectedRow].length;
				if (this.vertical && next >= 0 && next < count) {
					this.selectItem(this.selectedRow, next);
					break;
				}
				// Past the end of the credits, or across a row: the next row. Entering
				// the credits from below starts at their last link.
				const row =
					(this.selectedRow + step + this.rows.length) % this.rows.length;
				if (this.rows[row].dataset.axis === "y") {
					this.selectedItems[row] = step < 0 ? this.items[row].length - 1 : 0;
				}
				this.selectRow(row);
				break;
			}
			case "left":
			case "right": {
				if (this.vertical) break;
				const count = this.items[this.selectedRow].length;
				const step = action === "left" ? -1 : 1;
				this.selectItem(
					this.selectedRow,
					(this.selectedItems[this.selectedRow] + step + count) % count,
				);
				break;
			}
			case "confirm":
				this.item.click();
				break;
		}
	}

	private selectItem(row: number, index: number, focus = true) {
		this.selectedItems[row] = index;
		if (row !== this.selectedRow) super.selectRow(row, false);
		this.renderItems();
		if (focus) this.item.focus({ preventScroll: true });
	}

	protected override selectRow(index: number, focus = true) {
		super.selectRow(index, false);
		this.renderItems();
		if (focus) this.item.focus({ preventScroll: true });
	}

	private renderItems() {
		this.items.forEach((links, row) => {
			links.forEach((item, index) => {
				item.classList.toggle(
					"is-selected",
					row === this.selectedRow && index === this.selectedItems[row],
				);
			});
		});
	}
}
