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
    experience.ts      # the singleton root
    camera.ts, renderer.ts, sources.ts, settings.ts, ocarina-buttons.ts
    audio/             # the ocarina sampler
    input/             # keyboard (touch controls play through it too)
    songs/             # the songs, their detection, progress and playback
    ui/                # menus, song book, title screen, touch controls
      pixel/           # pixel-art SVGs exported from Figma
    utils/             # debug, events, resources, sizes, storage, time
    world/             # the house, the ocarina, the fairies
  styles/
```

See `ASSETS.md` for why `public/models/` and `public/sounds/` aren't in this
repo, and how to pull them in if you have access.

## Credits

- Ocarina model: [pau_alma_3D](https://sketchfab.com/3d-models/ocarina-of-time-40ab5c7438374647b1c86245019f73aa), CC BY 4.0
- Navi's wings: [darkewne](https://sketchfab.com/3d-models/navi-fairy-of-link-zelda-724f7dbdbc8440edb7cfddb1abfd0a71), CC BY 4.0
- Link's house: [BrittanyOfKoppai](https://models.spriters-resource.com/3ds/thelegendofzeldaocarinaoftime3d/asset/325223/), ripped from the original game
- Ocarina sounds: [HelpTheWretched](https://noproblo.dayjo.org/zeldasounds/), extracted from the original game
- Menu sounds: extracted from the original game
- Font: [Jersey 10](https://fonts.google.com/specimen/Jersey+10) (Google Fonts)

*The Legend of Zelda: Ocarina of Time* and all related characters, designs and
sounds are property of Nintendo. This is an unofficial, non-commercial fan
project.
