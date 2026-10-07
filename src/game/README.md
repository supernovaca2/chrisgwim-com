# Wave Invasion (the home page)

The catalog as an arcade invader shooter. Seven waves of voxel invaders, one
per lane (bus A is wave 1), march toward Earth on the beat of a synthesized
track whose tempo climbs as they fall. Each wave sends Record Ships across the
sky carrying that lane's releases: shoot one down, catch the falling record
with the cannon, and the track unlocks (a card with its cover, title and links
slides in without stopping play). The finale is the Mothership, whose hull
panels are cover art; every panel broken drops its record. three.js, no other
runtime dependency, nothing fetched but images.

It replaced Overworld (the open world, home page 2026-10-05 to 2026-10-07),
which is in the git history. Wave Invasion was built as one of three concepts
on 2026-10-07; the concept-era prototype, its design brief and QA tools are in
`C:\projects\gwim\music\Reference\chrisgwim-com-game-concepts-2026-10-07\`
(not part of this repo, and no longer the source of truth).

## How the source is put together

`invasion.js` is the entry. It holds the imports and an empty async function.
The nine numbered parts are spliced into that function, in order, by the
`game-parts` plugin in `astro.config.mjs`. They share one scope, so a name
declared in one part is visible in every later one, and their order matters.

| Part | What it holds |
|---|---|
| `01_core.js` | The catalog (read from the page), helpers, seeded random, the save game, catalog by lane, links, the Records list builder, the WebGL 2 check |
| `02_scene.js` | Field constants, renderer, bloom, sky shader (nebula, ringed giant, Earth's limb), stars, floor shader (grid, ripples, lights, rails, invasion line), glow pools, the cover atlas, cover panel material, voxel material, camera fitting |
| `03_voxels.js` | Invader bitmaps (two frames each), the instanced invader batch, the debris pool, bunkers (erosion, crushing, hot edges) |
| `04_audio.js` | Lane music styles, synth voices, the conductor (a look-ahead scheduler that owns time), sound effects. No audio files |
| `05_entities.js` | Game state, sparks, rings, popups, toasts, shake, the cannon, shots and bombs, quakes, the Record Ship, falling records, power-ups, scoring |
| `06_waves.js` | Formation layouts, the wave table (`WAVES`, one per lane), the march, each lane's twist, enemy fire, beat events, divers, the Mothership |
| `07_play.js` | Which release a ship carries, the play loop: cannon, collisions, bombs, ship, catching, power-ups, wave flow, tempo; the autopilot (attract mode and tests) |
| `08_ui.js` | HUD, banner, unlock card, title, Records, pause, results, menus, keyboard, gamepad, touch, links, the docked SoundCloud player |
| `09_main.js` | Drawing each frame, camera, resize, adaptive resolution, the loop, boot, deep links, the development test handle |

`shell.js` is the page before, and without, the game. It is separate on purpose
and imports nothing, so Astro writes it into the page itself and it runs even
when the game's own file never arrives. It paints the lane colors of the
server-rendered track list, and it turns the page into that track list when the
game cannot run: no WebGL 2, the game threw while starting, or its script
failed to load. The game does not import it. They talk through the page: the
page's script sets `<html data-game>` the moment the game's file runs, and
`game:failed` is dispatched on `document` (the sentence to show is
`event.detail`) when it cannot run.

The markup is in `src/pages/index.astro`, the styles in
`src/styles/invasion.css`, and the catalog data the game reads is built by
`src/lib/game-data.ts` and inlined in the page as JSON.

## The music is the clock

The march is the beat. The conductor in `04_audio.js` walks sixteenth notes
on `AudioContext` time and owns the schedule; a march step is one of its
events, so the formation's step and its bass note cannot drift apart. Tempo
runs from about 90 BPM at full formation to about 180 near the end. Each lane
has its own style of music; the finale and the title have theirs.

The music bed's level is the menu duck (title, pause) times the outside duck:
while SoundCloud's docked player is playing, the bed fades out and the effects
drop back (`audio.external`).

## Loading

`<body class="booting">` is in the markup, so a cover is up from the first
paint: the ground color and a bar in the seven lane colors. The game lifts it
(`ready` in `09_main.js`) once the cover art is in and the fonts have loaded,
or after 2.5 seconds, whichever comes first.

What holds without the game's script:

- After four seconds the cover offers the catalog. CSS only.
- With scripting off there is no cover, the title shows the artist, the game's
  name and a note pointing to the catalog, and the menu stays hidden (it would
  be dead buttons).
- If the script fails to load, `shell.js` shows the track list at once.
- As a last resort the cover lifts by itself after 25 seconds.

## Screens and touch

Three layouts, never applied together (the media queries at the end of
`invasion.css`): wide, upright phone (aspect at most 4:5) and short (a phone on
its side). On the wide title the camera fits the attract formation into the
space right of the logo, measured from the page (`frameTitle`).

Touch controls (`.touch` on the body, `#touchpad`) are on from the start when
the main pointer is a finger, and switch on at the first real touch anywhere
else. Drag anywhere in the lower part of the screen: the cannon follows the
finger and fires while it is down. The HUD lets touches through, so anything in
it that takes a touch needs `pointer-events: auto` (the pause button has it; a
test checks).

## Play here

Every release in Records, on the unlock card, on the results and as the
premiere has Play here: it docks SoundCloud's own player (a sandboxed frame,
created only on that press, so nothing is requested from SoundCloud before).
In play it sits in the corner of the field; on the title and in menus, top
right, with the menus keeping a column clear for it. On an upright phone it
docks along the bottom edge and the drag area moves up above it.

A link to a release page opens in this tab, except during a run, when it opens
a new one so the run is still there afterward (the game pauses itself when its
tab is hidden).

## The catalog drives the game

Nothing here names a release. A new SoundCloud upload rides its lane's Record
Ships on the next build, and Mothership panels refill with releases not yet
found, so every release stays reachable. A lane needs a wave of its own in
`WAVES` (`06_waves.js`); the tests fail if a lane is added without one.

## Deep links

`/#play` skips the title. `/#records` (and the older `/#tracks`) opens the
Records screen. `/#series` sends the visitor on to the classical series on the
catalog page.

## Rules this code keeps

- **No inline style attributes.** The site ships a content security policy that
  refuses them. Set styles through `element.style`, never in an HTML string.
- **Catalog text only ever goes in through `textContent`.** Titles and
  descriptions arrive from SoundCloud with nobody reviewing them. Links to
  SoundCloud are checked to start with `https://soundcloud.com/`.
- **Clamp before `pow()` in shaders, and never reverse `smoothstep` edges.** One
  invalid pixel is smeared by the bloom pass into a black rectangle.
- **Everything that repeats is instanced** (invaders, bunkers, debris, shots,
  bombs, glow pools), and debris comes from a fixed pool. About 30 draw calls.
- **Size is synced every frame**, not only on resize events: a hidden tab can
  report a zero or tiny window.
- **Gains are ramped, never jumped**, and the master runs through a compressor
  and a limiter, so nothing clicks or clips.

## Testing by hand

`npm run dev` exposes `window.__game` (development builds only; a test checks
the production build has none):

- `__game.advance(seconds, input)` steps the simulation at 60 Hz without a
  screen. `input` is `{ left, right, fire, x }`, `'auto'` for the autopilot,
  or `null` to read the real keyboard.
- `__game.autoUntil((s) => s.wave === 3, 120)` plays with the autopilot until
  the condition holds.
- `__game.state()` returns mode, wave, score, lives, the march count against
  the conductor's, the Record Ship, falling records, the Mothership and
  renderer stats. `wave(n)`, `skipIntro()`, `ship()`, `shootShip()`,
  `catchAll()`, `unlock(slug)`, `records()`, `over()` and `victory()` jump to
  any moment.

The production build has no such handle; drive it with real key events and the
deep links above (the content security policy is only active in `npm run
preview`, not in `astro dev`). Things a desktop browser will not show you: real
touches, a phone's notch, a slow or failed script download, and the sound
(nobody has listened to it yet: it was built by construction and measured,
not heard).
