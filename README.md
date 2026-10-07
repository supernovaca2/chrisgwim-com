# chrisgwim-com

Chris Gwim's artist site, chrisgwim.com. An Astro static site, deployed to GitHub Pages via
Actions on push to `main` (tests gate the deploy).

The home page is **Wave Invasion** (2026-10-07): the catalog as an arcade invader shooter. It
replaced Overworld, the open world that was the home page from 2026-10-05 (its source is in the
git history). Behind it are the pages of the **Premiere** design (2026-10-04): the catalog as a
run of film premieres.
Black ground, Big Shoulders Display over Instrument Sans, the cover art carries the color, one
red accent.

## Pages

| Route | What it is |
|---|---|
| `/` | Wave Invasion. Seven waves of voxel invaders, one per lane, march on the beat of synthesized music that speeds up as they fall, then the Mothership, whose hull panels are cover art. Each wave sends Record Ships carrying that lane's releases: shoot one down and catch the record it drops to unlock the track. Records lists the whole catalog with links; Play here opens a release in SoundCloud's own player, docked in the corner. The whole catalog is also in the page as plain links (the track list), which is what a crawler reads and what the page becomes without WebGL or when the game's script cannot load. A cover hides the page until the game is ready to be seen |
| `/music/` | The catalog: every release as a poster, with a lane filter (`#<lane-slug>` deep-links a filter), then the classical series (`#series`) |
| `/music/<slug>/` | Release page: letterbox, player, notes and details, more from the lane, prev/next, MusicRecording JSON-LD |
| `/story/` | Bio, the facts, every lane and its tracks, press note |

The home page deep-links too: `/#play` skips the title and `/#records` opens the catalog
(`/#tracks` still works).

Wave Invasion's source, how it is put together and the rules it keeps are in
[`src/game/README.md`](src/game/README.md). Its markup is `src/pages/index.astro`, its styles
`src/styles/invasion.css`. The other pages share `src/layouts/Base.astro` and the tokens and
building blocks in `src/styles/tokens.css`.

Every page shows the contact address as visible text and links to Lunthra; the home page also
carries the SoundCloud referral. On the home page all three are on the title screen.

**The classical series** is derived, not tagged: a release joins when its title starts with a
composer's name in `COMPOSERS` (`src/lib/releases.ts`). Add a name there for a new composer.

## Editing content

**SoundCloud is the source of truth for what is public.** The `Sync catalog from
SoundCloud` workflow (`.github/workflows/sync-soundcloud.yml`) runs every 3 hours: it adds
new uploads, removes tracks gone from SoundCloud, refreshes permalinks and durations,
runs `npm test`, commits to `main` and dispatches the deploy. Run it now from the Actions
tab, or locally with `node scripts/sync-soundcloud.mjs [--dry-run]`.

The sync never overwrites hand edits on an existing release (title and description copy,
`lane`, `genre`, `tags`, `series`, cover art, a store `primaryUrl`). A new upload gets its
lane from keyword rules in the script (`LANE_RULES`); fix it by editing the JSON, and the
edit sticks.

- **Add a release:** one JSON file in `src/content/releases/<slug>.json` and a 500×500 JPG at
  `public/covers/<slug>.jpg` (SoundCloud serves it at
  `https://i1.sndcdn.com/<hash>-t500x500.jpg`), plus, optionally, the original upload at
  `public/covers/hd/<slug>.jpg` (`-original.jpg`, stored as JPEG, at most 1200px). The sync
  fetches both. Fields:

  | Field | Notes |
  |---|---|
  | `title`, `datePublished` | `YYYY-MM-DD` |
  | `cover` | `/covers/<slug>.jpg` |
  | `primaryUrl` | Spotify album if one exists, else Deezer album, else the SoundCloud track URL. Must be `https://` |
  | `soundcloudId`, `soundcloudUrl` | Numeric track id (from the SoundCloud API) and permalink; the id drives every player |
  | `genre` | SoundCloud's genre label, shown as-is |
  | `lane` | One of the buses in `src/lib/releases.ts` (`LANES`); the schema rejects anything else |
  | `durationMs` | From the SoundCloud API |
  | `description`, `tags`, `series` | Optional |

  The poster wall, counts, the classical series, sitemap, structured data and Wave Invasion (a
  new release rides its lane's Record Ships and the Mothership's panels; the newest is the
  premiere on the title screen) all derive from the collection.
- **Remove a release:** delete the JSON, the cover and any `hd/` copy. `npm test` fails if a
  page in `dist/music/` has no release file.
- **Add a lane:** a name, letter, blurb and color in `LANES`, and the name in the schema
  (`src/content.config.ts`). Wave Invasion has one wave per lane, written by hand in `WAVES`
  (`src/game/06_waves.js`); a new lane needs a wave there (`npm test` says so).
- **Cover sizes:** the build writes 132px thumbnails, 360px posters and 2.39:1 letterbox crops
  to `dist/covers/` (the `cover-images` integration in `astro.config.mjs`). Wave Invasion draws
  the posters on its Record Ships and Mothership panels and the thumbnails in its Records list.
  The hi-res file is used only while it still matches the 500px cover, so a cover replaced by
  hand never shows stale art.
- **Pull the live list:** open `https://soundcloud.com/chrisgwim/tracks`, read `client_id`
  and the user id from `window.__sc_hydration`, then call
  `https://api-v2.soundcloud.com/users/<id>/tracks?client_id=<id>&limit=100&linked_partitioning=1`.
- **Design tokens:** `src/styles/tokens.css`. The home page has its own, at the top of
  `src/styles/invasion.css`, and shares no stylesheet with the other pages. The SoundCloud
  embed color is the `ACCENT_HEX` constant in `src/lib/releases.ts`; keep it in sync with
  `--accent`.
- **Fonts:** Big Shoulders Display and Instrument Sans on the pages, Bungee, Bungee Inline and
  Chakra Petch in the game (all OFL), self-hosted through Fontsource packages. No Google Fonts
  request leaves the page, and no font is inlined as a `data:` URL (the policy refuses those);
  `npm test` guards both.
- **Copy is American English**, dates included ("October 5, 2026").

## Security

GitHub Pages cannot send response headers, so the content security policy ships as a `<meta>`
element on every page (`security.csp` in `astro.config.mjs`; Astro adds a hash for each script
and style it emits). The policy allows this origin and one frame source, the SoundCloud player.

- **Nothing loads from another origin** but that player. three.js is an npm dependency bundled
  into the site, pinned to an exact version; the fonts are self-hosted.
- **No inline style attributes and no inline event handlers.** The policy refuses both. Set
  styles from a stylesheet or, in script, through `element.style`.
- **Catalog text is treated as untrusted.** Titles and descriptions arrive from SoundCloud on
  a timer with nobody reviewing them. Astro escapes them in markup; `safeJson`
  (`src/lib/site.ts`) keeps them from ending a JSON data block early; the game only ever puts
  them in through `textContent`; release links must be `https://` (schema and game both check).
- **The SoundCloud players are sandboxed frames.** They can run their own scripts and open
  soundcloud.com in a new tab; they cannot navigate this site.
- **No audio is served from this origin**, and no visitor data is collected or sent anywhere.
  Wave Invasion's save game (found releases, hi-score, sound on or off) is in the visitor's own
  `localStorage`.

What a `<meta>` policy cannot do: `frame-ancestors` (so the site cannot forbid being framed by
another site) and HSTS need real headers, which GitHub Pages does not offer.

`npm test` holds all of this: the policy on every page, no page needing anything the policy
refuses, no third-party host in the build, no debug handle in production code.

## GitHub Pages limits

Published site 1 GB, source repository 1 GB (recommended), bandwidth 100 GB a month (soft),
10 builds an hour (soft), 10 minutes per deployment. The site is about 9 MB; a first visit to
the home page is about 0.9 MB on a phone and 1 MB on a desktop (measured 2026-10-05: 160 KB
of script, 90 KB of fonts, the rest cover art). `npm test` fails long before any limit: `dist/` and `public/`
over 250 MB, any single file over 5 MB, the home page's code over 300 KB gzipped.

## Commands

```sh
npm run dev       # dev server at localhost:4321 (no content security policy in dev)
npm run build     # static build to dist/
npm run preview   # serve the built site locally, policy and all
npm test          # build, then assert against dist/
```
