// Sharing the experience, from the message of the first song learned and from
// the banner that celebrates the last one. Those two moments only: a prompt
// after every song would push the experience at the player instead of letting
// them find it, and asking from the About menu read as begging next to the
// credits.

import { isTouchScreen } from "./dom.ts";

// What a share carries
const SHARE_TEXT = "Play the Ocarina of Time in your browser 🎵";

// The canonical address (index.html), not the current one: a share carries the
// site, not a localhost port or a #debug hash
export const shareUrl = () =>
	document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
	window.location.origin + import.meta.env.BASE_URL;

// The phone's own share sheet, where sharing a link is what people do; on a
// desktop it would open a clunky system panel, so the link is copied instead.
// Returns what to answer the player, or nothing when the share sheet already
// answered.
export const shareOcarina = async (): Promise<string | null> => {
	const url = shareUrl();
	if (navigator.share && isTouchScreen()) {
		try {
			await navigator.share({ title: document.title, text: SHARE_TEXT, url });
		} catch {
			// Cancelled from the share sheet, or not allowed here
		}
		return null;
	}
	try {
		await navigator.clipboard.writeText(url);
		return "Link copied!";
	} catch {
		// Clipboard refused (an old browser, or no permission): show the address
		// instead, so it can still be read and typed
		return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
	}
};
