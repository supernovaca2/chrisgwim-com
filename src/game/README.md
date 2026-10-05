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

`shell.js` is the page before, and without, the game. It is separate on purpose
and imports nothing, so Astro writes it into the page itself and it runs even
when the game's own file never arrives. It paints the lane colors of the
server-rendered track list, and it turns the page into that track list when the
world cannot run: no WebGL 2, the game threw while starting, or its script
failed to load. The game does not import it. They talk through the page: the
game sets `<html data-game>` the moment it starts, and dispatches
`overworld:failed` on `document` (the sentence to show is `event.detail`) when
it cannot run.

The markup is in `src/pages/index.astro`, the styles in
`src/styles/overworld.css`, and the catalog data the game reads is built by
`src/lib/game-data.ts` and inlined in the page as JSON.

## Loading

`<body class="booting">` is in the markup, so a cover is up from the first
paint: the ground color and a thin progress bar. The game lifts it (`ready` in
`07_main.js`) once the world is built, its cover art is in and the fonts have
loaded. Without the cover a visitor saw the bare title on black for a second,
then a world of untextured slabs popping in behind it.

What holds without the game's script, because that script is the thing most
likely to be slow or missing:

- After four seconds the cover offers the catalog. CSS only.
- With scripting off there is no cover (`@media (scripting: none)`, and a
  `:has(noscript ...)` rule for browsers that do not know that media feature).
- If the script fails to load, `shell.js` shows the track list at once.
- As a last resort the cover lifts by itself after 25 seconds.

## Screens and touch

Three layouts, chosen by the shape of the screen and never applied together
(the end of `overworld.css`): wide, upright phone, and short (a phone on its
side). Script asks the same questions through `sheetLayout()` and `upright()`
in `01_core.js`, each time it needs to know, because a phone can be turned
mid-game.

Touch controls (`.touch` on the body) are on from the start when the main
pointer is a finger, and switch on at the first real touch anywhere else (a
laptop with a touch screen). The HUD lets touches through to the world, so
anything in it that should take a touch needs `pointer-events: auto`: the stick
and the two thumb buttons are not `<button>` elements, and without it Boost and
Drift never received a touch. Everything held is let go when the window loses
focus, the tab is hidden, a menu opens or the system cancels the touch
(`releaseAll` in `06_game.js`).

On a phone held sideways the page runs under the notch (`viewport-fit=cover`),
so the side gutter, the stick and the thumb buttons all add the safe-area
insets (`--safe-l`, `--safe-r`, and `--gut` built from them).

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
- **The ending runs on the game clock, not on timers** (`game.finale` in
  `updateWorld`), so starting a new game calls it off and its closing card
  waits for a moment when no menu is open.
- **Center with auto margins, not `left: 50%` and a transform**, wherever the
  width should fit the content: the transform version caps the width at half
  the screen, which wrapped every Open prompt on a phone.

## Testing by hand

`npm run dev` exposes `window.__ow` (development builds only):
`__ow.advance(seconds, { throttle: 1, steer: 0.3, boost: true })` steps the
simulation without a screen, and `__ow.advance(seconds, null)` reads the real
keyboard state. The production build has no such handle; drive it with real key
events and the deep links above.

Things a desktop browser will not show you, each of which has been a real bug
here: touches (the HUD swallowing them), a phone's notch (emulate safe-area
insets), a slow or failed script download (throttle or block the game's file),
and the viewport of a phone browser with its bars showing (an iPhone SE is 375
by 548, not 375 by 667).
