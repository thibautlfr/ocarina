// Small DOM helpers shared by the UI

export const query = <T extends Element = HTMLElement>(
	root: ParentNode,
	selector: string,
): T => {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Element not found: ${selector}`);
	return element;
};

export const queryAll = <T extends Element = HTMLElement>(
	root: ParentNode,
	selector: string,
): T[] => [...root.querySelectorAll<T>(selector)];

// The nodes of an HTML template, to query then append to the page
export const fragment = (html: string): DocumentFragment => {
	const template = document.createElement("template");
	template.innerHTML = html;
	return template.content;
};

// A phone or a tablet: a finger, no pointer to hover with
export const isTouchScreen = () =>
	window.matchMedia("(hover: none) and (pointer: coarse)").matches;

// The element matching `selector` at or above an event's target
export const closest = (target: EventTarget | null, selector: string) =>
	target instanceof Element ? target.closest<HTMLElement>(selector) : null;

// Hover is a class set on pointermove, not :hover: a corner button showing up
// under a still cursor (after a click swaps them) mustn't look pushed
export const trackHover = (button: HTMLElement, signal: AbortSignal) => {
	button.addEventListener(
		"pointermove",
		() => button.classList.add("is-hovered"),
		{ signal },
	);
	button.addEventListener(
		"pointerleave",
		() => button.classList.remove("is-hovered"),
		{ signal },
	);
};
