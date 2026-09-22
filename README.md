# Ocarina

A Three.js + TypeScript + Vite fan tribute to *The Legend of Zelda: Ocarina of
Time* — pick up the ocarina on the stump in Link's house and play it.

Not affiliated with or endorsed by Nintendo.

## Getting started

```bash
pnpm install
pnpm assets   # pulls the 3D models/sounds — see ASSETS.md, private access required for now
pnpm dev
```

`pnpm build` type-checks and builds for production; `pnpm preview` serves that
build locally.

## Architecture

A singleton `Experience` pattern (`src/experience/experience.ts`): every class
retrieves the shared instance via `Experience.getInstance()` instead of having
things passed down to it. It owns `scene`, `camera`, `renderer`, `world`,
`resources`, `sizes` and `time`, and builds everything else — audio, UI, world
objects — on top of them in a fixed init order.

```
src/
  main.ts
  experience/
    experience.ts       # the singleton root
    camera.ts, renderer.ts, sources.ts, songs.ts
    audio/               # the ocarina sampler, song playback/detection
    ui/                  # settings menu, song book, about menu, title screen, touch controls
    utils/                # debug, keyboard, resources, settings, sizes, time, storage
    world/               # the house, the ocarina, the fairies
  styles/
```

See `ASSETS.md` for why `public/models/` and `public/sounds/` aren't in this
repo, and how to pull them in if you have access.

## Credits

- Link's house model: ripped from the original game, via [The Models Resource](https://www.models-resource.com/)
- Ocarina and Navi models: [Sketchfab](https://sketchfab.com/), CC BY 4.0
- Sound effects: extracted from the original game
- Font: [Jersey 10](https://fonts.google.com/specimen/Jersey+10) (Google Fonts)

*The Legend of Zelda: Ocarina of Time* and all related characters, designs and
sounds are property of Nintendo. This is an unofficial, non-commercial fan
project.
