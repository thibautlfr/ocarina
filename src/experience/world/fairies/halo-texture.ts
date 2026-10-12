import * as THREE from "three";

// Opacity along the radius, as [position, alpha] stops
const STOPS = [
	[0, 1],
	[0.15, 0.6],
	[0.45, 0.15],
	[1, 0],
] as const;

const alphaAt = (r: number) => {
	for (let i = 1; i < STOPS.length; i++) {
		const [from, fromAlpha] = STOPS[i - 1];
		const [to, toAlpha] = STOPS[i];
		if (r <= to) {
			return THREE.MathUtils.mapLinear(r, from, to, fromAlpha, toAlpha);
		}
	}
	return 0;
};

// Soft radial gradient: bright center fading to nothing. Computed rather
// than drawn on a canvas: WebKit dithers canvas gradients, and the noise in
// the faint edge showed as colored and black dots once added to the scene.
export const createHaloTexture = (size = 128): THREE.DataTexture => {
	const half = size / 2;

	// Always white: only the alpha fades, so no stray color at the edge
	const data = new Uint8Array(size * size * 4).fill(255);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const r = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
			data[(y * size + x) * 4 + 3] = Math.round(alphaAt(r) * 255);
		}
	}

	const texture = new THREE.DataTexture(data, size, size);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.generateMipmaps = true;
	texture.needsUpdate = true;
	return texture;
};
