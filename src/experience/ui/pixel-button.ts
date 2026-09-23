// A pixel button from Figma: a cap resting on a base, with a glyph from
// pixel/glyphs/ on the cap. Colors come from the button's variant class (see
// ui.css). The glyph is scaled to fit a band 57.67 units high, centered, and
// drawn twice: a lighter copy offset underneath engraves it into the cap.
export const pixelButton = (glyph: string) => /* html */ `
<svg class="pixel-art" viewBox="0 0 136 132" aria-hidden="true">
	<path d="M13.5333 26.3727H121.8V32.9658H128.567V39.559H135.333V118.677H128.567V125.27H121.8V131.863H13.5333V125.27H6.76667V118.677H0V39.559H6.76667V32.9658H13.5333V26.3727Z" fill="var(--edge)"/>
	<path d="M13.5333 32.9658H121.8V39.559H128.567V118.677H121.8V125.27H13.5333V118.677H6.76666V39.559H13.5333V32.9658Z" fill="var(--shade)"/>
	<g class="pixel-button__cap">
		<path d="M13.5333 5H121.8V11.5932H128.567V18.1863H135.333V97.3043H128.567V103.897H121.8V110.491H13.5333V103.897H6.76667V97.3043H0V18.1863H6.76667V11.5932H13.5333V5Z" fill="var(--edge)"/>
		<path d="M13.6871 11.9402H121.954V18.5333H128.72V97.6513H121.954V104.244H13.6871V97.6513H6.92046V18.5333H13.6871V11.9402Z" fill="var(--face)"/>
		<path d="M20.3 18.1863H108.267V24.7795H20.3V18.1863ZM13.5333 24.7795H20.3V57.7453H13.5333V24.7795Z" fill="var(--light)"/>
		<g class="pixel-button__glyph-shade">
			<svg class="pixel-button__glyph" y="32" width="136" height="57.67">${glyph}</svg>
		</g>
		<svg class="pixel-button__glyph" y="32" width="136" height="57.67">${glyph}</svg>
	</g>
</svg>`;
