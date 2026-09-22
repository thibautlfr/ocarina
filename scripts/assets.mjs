// Pulls the binary assets (3D models, ocarina/UI sounds) from the private
// `ocarina-assets` repo into public/. Those files are extracted or derived
// from Nintendo's Ocarina of Time and aren't redistributable — they live
// outside this repo (see ASSETS.md), gitignored under public/models and
// public/sounds.
//
// Usage: `pnpm assets`
//
// Resolves the source in this order:
//   1. OCARINA_ASSETS_PATH env var, if set
//   2. ../ocarina-assets (sibling checkout — the default local dev layout)
//   3. a fresh clone of OCARINA_ASSETS_REPO (defaults to
//      git@github.com:thibautlfr/ocarina-assets.git) into .assets/
//
// Every file is checked against the source's manifest.json (sha256) before
// being copied. There's no fallback experience without these assets: this
// script fails loudly if the source can't be found or a hash doesn't match.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const DEFAULT_SIBLING = join(ROOT, "..", "ocarina-assets");
const CLONE_CACHE = join(ROOT, ".assets");
const DEFAULT_REPO = "git@github.com:thibautlfr/ocarina-assets.git";

// Files this project actually needs from the assets repo (models + sounds
// only — og-image.jpg/preview.jpg are committed directly in this repo).
const FILES = [
	"models/links_house.glb",
	"models/navi_fairy.glb",
	"models/ocarina_of_time.glb",
	"sounds/ocarina/a4.wav",
	"sounds/ocarina/b4.wav",
	"sounds/ocarina/d4.wav",
	"sounds/ocarina/d5.wav",
	"sounds/ocarina/f4.wav",
	"sounds/ocarina/song-correct.wav",
	"sounds/ui/menu-close.wav",
	"sounds/ui/menu-open.wav",
	"sounds/ui/menu-select.wav",
];

function fail(message) {
	console.error(`\n✖ ${message}\n`);
	process.exit(1);
}

function resolveSource() {
	const fromEnv = process.env.OCARINA_ASSETS_PATH;
	if (fromEnv) {
		if (!existsSync(join(fromEnv, "manifest.json"))) {
			fail(
				`OCARINA_ASSETS_PATH is set to "${fromEnv}" but no manifest.json was found there.`,
			);
		}
		return fromEnv;
	}

	if (existsSync(join(DEFAULT_SIBLING, "manifest.json")))
		return DEFAULT_SIBLING;

	if (existsSync(join(CLONE_CACHE, "manifest.json"))) return CLONE_CACHE;

	const repo = process.env.OCARINA_ASSETS_REPO ?? DEFAULT_REPO;
	console.log(
		`No local ocarina-assets checkout found, cloning ${repo} into .assets/ ...`,
	);
	try {
		execFileSync("git", ["clone", "--depth", "1", repo, CLONE_CACHE], {
			stdio: "inherit",
		});
	} catch {
		fail(
			`Couldn't find or clone ocarina-assets.\n` +
				`  Expected a sibling checkout at "${DEFAULT_SIBLING}",\n` +
				`  or set OCARINA_ASSETS_PATH to an existing checkout,\n` +
				`  or make sure you have access to ${repo}.\n` +
				`  See ASSETS.md — these files are private, not redistributable.`,
		);
	}
	if (!existsSync(join(CLONE_CACHE, "manifest.json"))) {
		fail(`Cloned ${repo} but no manifest.json was found in it.`);
	}
	return CLONE_CACHE;
}

function sha256(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function main() {
	const source = resolveSource();
	const manifest = JSON.parse(
		readFileSync(join(source, "manifest.json"), "utf8"),
	);

	let copied = 0;
	for (const file of FILES) {
		const srcPath = join(source, file);
		const entry = manifest.files?.[file];

		if (!existsSync(srcPath)) fail(`Missing "${file}" in ${source}.`);
		if (!entry) fail(`"${file}" isn't listed in ${source}/manifest.json.`);

		const hash = sha256(srcPath);
		if (hash !== entry.sha256) {
			fail(
				`Hash mismatch for "${file}": expected ${entry.sha256}, got ${hash}.\n` +
					`  The source checkout may be stale or corrupted.`,
			);
		}

		const destPath = join(ROOT, "public", file);
		mkdirSync(dirname(destPath), { recursive: true });
		copyFileSync(srcPath, destPath);
		copied++;
	}

	console.log(
		`✓ Copied and verified ${copied} asset files from ${source} into public/.`,
	);
}

main();
