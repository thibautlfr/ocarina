# Assets

This repo has the code, not the binaries. `public/models/` and `public/sounds/`
are gitignored and **not included** here: the 3D models and sound samples are
extracted or derived from Nintendo's *The Legend of Zelda: Ocarina of Time*, and
aren't redistributable — crediting the source isn't a license.

**There is currently no fallback experience without them.** Running `pnpm dev`
or `pnpm build` without these files in place will fail (404s on the model/sound
fetches).

## What's needed

| Path | What | Source |
|---|---|---|
| `public/models/links_house.glb` | Link's house interior | [The Models Resource](https://www.models-resource.com/), COLLADA export converted to glTF |
| `public/models/ocarina_of_time.glb` | The ocarina | [Sketchfab](https://sketchfab.com/), CC BY 4.0, modeled after Nintendo's design |
| `public/models/navi_fairy.glb` | Navi (wings only) | [Sketchfab](https://sketchfab.com/), CC BY 4.0, modeled after Nintendo's design |
| `public/sounds/ocarina/*.wav` | Ocarina note samples + the "song correct" jingle | extracted from the original game (fan archive) |
| `public/sounds/ui/*.wav` | Menu open/close/select sounds | extracted from the original game (fan archive) |

Models are Meshopt-compressed with WebP textures. If you're regenerating them
from source, compress with `webp` then `meshopt`, never `gltf-transform
optimize` — it flattens and joins the nodes the code looks up by name (`stump`,
`body`, `wing0`, `wing1`).

## Pulling them in

If you have access to the private `ocarina-assets` repo:

```bash
pnpm assets
```

This copies the files listed above from a checkout of `ocarina-assets` into
`public/`, verifying each one against its `manifest.json` sha256 first. It
looks for a sibling checkout at `../ocarina-assets` by default; see
[`scripts/assets.mjs`](scripts/assets.mjs) for the other ways to point it at a
checkout (`OCARINA_ASSETS_PATH`) or let it clone one (`OCARINA_ASSETS_REPO`).

If you don't have access, you won't be able to run the experience locally —
that's expected for now.
