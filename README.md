# chrisgwim-com

Chris Gwim's artist site, chrisgwim.com. Astro static site in the **Premiere** design
(2026-10-04): the catalog as a run of film premieres. Black ground, Big Shoulders Display over
Instrument Sans, the cover art carries the colour, one red accent. Deployed to GitHub Pages
via Actions on push to `main` (tests gate the deploy).

Design tokens and the shared building blocks (buttons, chips, section heads) live in
`src/styles/tokens.css`. The approved concept is the "2 · Premiere" artboard in the
redesign canvas (claude.ai artifact, 2026-10-04).

## Pages

| Route | What it is |
|---|---|
| `/` | Letterbox premiere of the newest release with its player, the next four as posters, the classical series, the full poster wall, credits |
| `/music/` | The catalogue: every release as a poster, with a lane filter (`#<lane-slug>` deep-links a filter) |
| `/music/<slug>/` | Release page: letterbox, player, notes and details, more from the lane, prev/next, MusicRecording JSON-LD |
| `/story/` | Bio, the facts, every lane and its tracks, press note |

Every page ends with the studio band (Lunthra; the SoundCloud referral on the home page)
and the footer billing block, which carries the contact address as visible text.

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
  | `primaryUrl` | Spotify album if one exists, else Deezer album, else the SoundCloud track URL |
  | `soundcloudId`, `soundcloudUrl` | Numeric track id (from the SoundCloud API) and permalink; the id drives the embedded player |
  | `genre` | SoundCloud's genre label, shown as-is |
  | `lane` | One of the buses in `src/lib/releases.ts` (`LANES`); the schema rejects anything else |
  | `durationMs` | From the SoundCloud API |
  | `description`, `tags`, `series` | Optional |

  The poster wall, counts, the premiere, the classical series, sitemap and structured data all
  derive from the collection.
- **Remove a release:** delete the JSON, the cover and any `hd/` copy. `npm test` fails if a
  page in `dist/music/` has no release file.
- **Cover sizes:** the build writes 132px thumbnails, 360px posters and 2.39:1 letterbox crops
  to `dist/covers/` (the `cover-images` integration in `astro.config.mjs`). The letterbox uses
  the hi-res file only while it still matches the 500px cover, so a cover replaced by hand
  never shows stale art; it falls back to the 500px one.
- **Pull the live list:** open `https://soundcloud.com/chrisgwim/tracks`, read `client_id`
  and the user id from `window.__sc_hydration`, then call
  `https://api-v2.soundcloud.com/users/<id>/tracks?client_id=<id>&limit=100&linked_partitioning=1`.
- **Design tokens:** `src/styles/tokens.css`. The SoundCloud embed colour is the `ACCENT_HEX`
  constant in `src/lib/releases.ts`; keep it in sync with `--accent`.
- **Fonts:** Big Shoulders Display and Instrument Sans (both OFL), self-hosted through
  Fontsource packages. No Google Fonts request leaves the page; `npm test` guards this.

## Commands

```sh
npm run dev       # dev server at localhost:4321
npm run build     # static build to dist/
npm run preview   # serve the built site locally
npm test          # build, then assert against dist/ (catalog integrity, players, covers, fonts, CNAME)
```
