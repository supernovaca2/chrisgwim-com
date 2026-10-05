# Overworld (the home page)

The catalog as a playable open world: a hover glider, a dusk desert, the newest
release premiering at the hub, one district per lane, one monolith per release.
Driving up to a monolith lights its beacon. three.js, no other runtime
dependency, nothing fetched but images.

## How the source is put together

`overworld.js` is the entry. It holds the imports and an empty async function.
The seven numbered parts are spliced into that function, in order, by the
`overworld-parts` plugin in `astro.config.mjs`. They share one scope, so a name
declared in one part is visible in every later one, and their order matters.

| Part | What it holds |
|---|---|
| `01_core.js` | Catalog data, save game, track list wiring, noise, the plan of the world, the height grid |
| `02_scene.js` | Renderer, bloom, sky, stars, sun and shadows, time-of-day palettes, terrain mesh |
| `03_world.js` | Monoliths, hub steles, gates, road studs, ground markings, rocks, the seven district landmarks |
| `04_player.js` | Glider model, hover physics, collisions, trails, dust, chase and inspect camera |
| `05_audio.js` | Sound effects, synthesized with Web Audio. No audio files |
| `06_game.js` | Progress, banners, proximity, overlays, travel, compass, radar, map, menus, input, the docked SoundCloud player |
| `07_main.js` | HUD per frame, resize, adaptive resolution, the loop, boot, deep links |

`fallback.js` is separate on purpose: it turns the page into a plain track list
when WebGL 2 is missing or the game throws while starting.

The markup is in `src/pages/index.astro`, the styles in
`src/styles/overworld.css`, and the catalog data the game reads is built by
`src/lib/game-data.ts` and inlined in the page as JSON.

## The catalog drives the world

Nothing here names a release. A new SoundCloud upload becomes a new monolith in
its lane's district on the next build; a lane that outgrows its ring of
monoliths gets a wider ring and plaza. A lane with no releases gets no district.
A new lane needs a color in `LANES` (`src/lib/releases.ts`) and, if it should
have a landmark, a builder in `MONUMENTS` (`03_world.js`).

## Deep links

`/#play` skips the title. `/#map` and `/#tracks` open those screens.
`/#lane-a` to `/#lane-g` start at a district gate. `/#<release-slug>` starts in
front of that release with its panel open, which is also what the browser's Back
button returns to after visiting a release page.

## Rules this code keeps

- **No inline style attributes.** The site ships a content security policy that
  refuses them. Set styles through `element.style`, never in an HTML string.
- **Everything from the catalog is escaped** (`esc`) before it reaches
  `innerHTML`, and every link is checked to be https (`https`). Titles and
  descriptions arrive from SoundCloud with nobody reviewing them.
- **Clamp before `pow()` in shaders, and never reverse `smoothstep` edges.** One
  invalid pixel is smeared by the bloom pass into a black rectangle.
- **One shared point light for the districts.** The number of lights is compiled
  into every lit shader; a light per landmark would tax every pixel of terrain.
- **Physics reads the same height grid the terrain mesh is built from**, with the
  same triangle split, so the glider and the ground cannot disagree.
- **Menu focus follows the arrow-key selection**, so Enter activates the item
  that is highlighted.

## Testing by hand

`npm run dev` exposes `window.__ow` (development builds only):
`__ow.advance(seconds, { throttle: 1, steer: 0.3, boost: true })` steps the
simulation without a screen, and `__ow.advance(seconds, null)` reads the real
keyboard state. The production build has no such handle; drive it with real key
events and the deep links above.
