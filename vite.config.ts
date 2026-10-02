/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// VITE_BASE_PATH builds for a subpath (e.g. a project page on GitHub Pages);
// unset, the site is served from the root, as on the custom domain
export default defineConfig({
	base: process.env.VITE_BASE_PATH ?? "/",
	build: {
		assetsInlineLimit: 8192,
	},
	server: {
		open: true,
	},
	test: {
		environment: "happy-dom",
	},
});
