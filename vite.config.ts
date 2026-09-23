import { defineConfig } from "vite";

// VITE_BASE_PATH builds for a subpath, like /ocarina/ on GitHub Pages (see
// .github/workflows/deploy.yml)
export default defineConfig({
	base: process.env.VITE_BASE_PATH ?? "/",
	build: {
		assetsInlineLimit: 8192,
	},
	server: {
		open: true,
	},
});
