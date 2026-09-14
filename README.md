# chrisgwim-com

Chris Gwim's artist site, chrisgwim.com. Astro static site in the Studio Console design
system, deployed to GitHub Pages via Actions on push to `main` (tests gate the deploy).

Design source of truth lives in the Claude project folder (`C:\projects\gwim\music\Reference\`):
`chrisgwim-brand.md` (tokens, identity, decision log) and
`chrisgwim-com-DESIGN.md` / `-BUILD.md` / `-BACKEND.md` (system, stack, platform).

## Pages

| Route | What it is |
|---|---|
| `/` | Hero, featured latest release with its own player, buses (lane cards), latest 10 tracks, outputs, promo |
| `/music/` | Full catalog as a numbered track list with a bus filter (`#<lane-slug>` deep-links a filter) |
| `/music/<slug>/` | Release page: cover, meta, notes, per-track SoundCloud player, prev/next, MusicRecording JSON-LD |
| `/story/` | Bio, signal chain, routing (every bus and its tracks), press note |

## Editing content

**SoundCloud is the source of truth for what is public.** When tracks are added or
removed there, mirror it here; nothing else on the site needs editing.

- **Add a release:** one JSON file in `src/content/releases/<slug>.json` and a 500×500 JPG at
  `public/covers/<slug>.jpg` (SoundCloud serves it at
  `https://i1.sndcdn.com/<hash>-t500x500.jpg`). Fields:

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

  Track list, counts, the featured release, bus cards, sitemap and structured data all derive
  from the collection.
- **Remove a release:** delete the JSON and the cover. `npm test` fails if a known-removed
  slug ever reappears as a page.
- **Pull the live list:** open `https://soundcloud.com/chrisgwim/tracks`, read `client_id`
  and the user id from `window.__sc_hydration`, then call
  `https://api-v2.soundcloud.com/users/<id>/tracks?client_id=<id>&limit=100&linked_partitioning=1`.
- **Design tokens:** `src/styles/tokens.css`. Mirror any change back to
  `Reference/chrisgwim-brand.md` in the Claude project. The SoundCloud embed colour is the
  `ACCENT_HEX` constant in `src/lib/releases.ts`; keep it in sync with `--accent`.
- **Display font:** Barlow Condensed (OFL), self-hosted from `public/fonts/`. No Google Fonts
  request leaves the page; `npm test` guards this.

## Commands

```sh
npm run dev       # dev server at localhost:4321
npm run build     # static build to dist/
npm run preview   # serve the built site locally
npm test          # build, then assert against dist/ (catalog integrity, players, fonts, CNAME)
```
