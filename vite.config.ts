import { defineConfig } from "vite";

// Served from the root of ocarina.thibaut-lefrancois.com (public/CNAME); set
// VITE_BASE_PATH to build for a subpath, like https://<user>.github.io/<repo>/
export default defineConfig({
	base: process.env.VITE_BASE_PATH ?? "/",
	build: {
		assetsInlineLimit: 8192,
	},
	server: {
		open: true,
	},
});
