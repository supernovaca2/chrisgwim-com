# chrisgwim.com — Studio Console refresh

**Date:** 2026-09-01
**Repo:** `supernovaca2/chrisgwim-com`
**Branch:** `design/refresh`
**Status:** awaiting review

## Goal

Give the site visible new energy without changing what it says. Three changes:

1. Move the accent decisively off amber, keeping the one-accent rule.
2. Break the uniform single-column stack into a console-with-rack layout.
3. Add a Lunthra cross-promotion rail in the gutter that layout creates.

Content, copy, and release data are untouched.

## Why the page feels flat

Every section — hero, `ChannelStrip`, `TrackList`, `Outputs`, `Promo` — renders at the
same 760px width with the same visual weight. The page has no dynamic range, so nothing
leads and the eye has no reason to stop. A mixing console does not look like that: it has
a wide mixer area and narrow outboard strips. The layout should say that.

## Change 1 — Accent

### Amending a locked decision

`Reference/chrisgwim-brand.md` fixes the palette as of 2026-07-13: graphite base, amber
`#e2a33f` as the single accent, red `#c0453d` semantic-only. That decision was reached by
mockup iteration and is the declared source of truth.

Magnus authorised amending it on 2026-09-01, asking for a change obvious at a glance
rather than a refinement. **The rule survives; only the value changes.** Still one accent,
still spent deliberately, red still semantic-only and untouched.

### The move: amber → phosphor green

| Token | Was | Becomes |
|---|---|---|
| `--accent` (was `--amber`) | `#e2a33f` | `#9ece6a` |
| `--accent-dim` (was `--amber-dim`) | `#7a5a29` | `#4a6130` |

Phosphor green is maximally distant from amber perceptually — no one will mistake this for
a tune-up — while staying native to the console metaphor: oscilloscope traces, tape-machine
bargraphs, terminal phosphor. It is yellow-leaning rather than pure green, which keeps it
from reading as a Matrix cliché and retains a thread back to the amber lineage.

It also does not collide with semantic red the way a deeper ember or orange would, so the
live/rec indicator keeps its meaning.

**Verify before merge.** These values are chosen on reasoning, not observation. Build and
screenshot both `/` and a release page, and look, before claiming this works. If green
reads cheap against the graphite, the fallback is ice-cyan `#5ec8d8` — same argument,
different temperature.

### Rename the tokens

`--amber` / `--amber-dim` become `--accent` / `--accent-dim`. A token named `--amber`
holding a green is a lie that costs the next reader real time. 16 usages across 8 files.

### The hardcoded-amber trap

Six places bypass the token and will stay amber unless changed explicitly. Missing any one
leaves the page half-repainted:

| File | Line | Value |
|---|---|---|
| `src/components/ChannelStrip.astro` | 8 | `&color=%23e2a33f` — the SoundCloud embed's own UI |
| `src/components/Promo.astro` | 57 | `rgba(226, 163, 63, 0.08)` |
| `src/pages/index.astro` | 64 | `rgba(226, 163, 63, 0.08)` |
| `src/pages/index.astro` | 73 | `rgba(226, 163, 63, 0.07)` |
| `src/pages/index.astro` | 80 | `rgba(226, 163, 63, 0.06)` |
| `src/pages/index.astro` | 85 | `rgba(226, 163, 63, 0.10)` conic gradient |

The `ChannelStrip` one matters most — it colors the embedded player, which is above the
fold and not ours to restyle after the fact.

Replace the rgba values with `color-mix(in srgb, var(--accent) N%, transparent)` so they
track the token from now on. The SoundCloud URL needs a literal hex; derive it from the
same constant rather than typing it twice.

## Change 2 — Console + rack layout

At `≥1100px` the page becomes a two-track grid:

```
┌─────────────────────────────┬──────────┐
│  console column (760px)     │  rail    │
│  hero, ChannelStrip,        │  (200px) │
│  TrackList, Outputs, Promo  │  Lunthra │
└─────────────────────────────┴──────────┘
```

- The console column keeps its current 760px width and content order. No reflow of
  existing sections.
- The rail occupies gutter that is currently dead space.
- Below 1100px the grid collapses to one column and rail contents move inline — see
  Change 3.

Secondary, same change: `TrackList` extends to the full 760px console width while the rack
panels — `ChannelStrip`, `Outputs`, `Promo` — inset to 620px and centre within it. That
70px inset on each side is what gives the console a wide mixer area and narrow strips, and
it is the part that creates dynamic range. Below 1100px the inset drops to zero and
everything returns to a single flush column.

`.site-nav` and `.footer` in `Base.astro` are also hardcoded to `max-width: 760px` and must
move with the grid, or the header and footer will visibly misalign against the shifted
console column.

## Change 3 — Lunthra rail

One evergreen unit. No featured collection, no rotating products, nothing that goes stale.

**Content:** Lunthra wordmark, one line of copy, link to `https://lunthra.com`.

**Chrome:** the rail unit is built from this site's own tokens — graphite panel, steel
border, mono label — exactly like `Promo`. Only the wordmark and any artwork carry Lunthra
identity. Lunthra's palette is cool-only by hard rule and would fight the accent if applied
to the whole unit; keeping Lunthra to the content layer avoids that collision entirely.

**Responsive:** at `≥1100px` it sits in the rail. Below, it renders inline in the console
column directly after `Promo`, styled as a sibling rack unit. It must not disappear on
mobile — that is where most music traffic is.

**New component:** `src/components/Rail.astro`, holding the unit and owning its own
responsive behaviour, so `Base.astro` stays a layout file.

**Link hygiene:** `rel="noopener"`. No UTM parameters — Lunthra's own standing rule is that
UTM tagging strips rich pins and clean links are preferred; there is no analytics on this
site to receive the campaign data anyway.

## Out of scope

- Any copy or content change
- `chrisgwim-links` (separate property, separate cosmic chrome, deliberately not unified)
- Adding analytics or email capture — both previously declined
- Release art, `/music` data, the 19 release JSON files

## Testing

This repo has **no test infrastructure** — no `test` script, no `tests/` directory. The
sibling repo `gwimentertainment-com` has a working pattern worth copying: `node --test`
plus `tests/build-output.test.js`, which asserts against the built `dist/` output.

Adopt it here as part of this work. The motivation is concrete rather than hygienic: the
single largest risk in this change is missing one of the six hardcoded amber values, and a
test asserting zero `e2a33f` in `dist/` catches that mechanically instead of by eye. The
same file should guard `CNAME` surviving the build, since losing it drops the custom domain
on the next Pages deploy and chrisgwim.com stops resolving.

- `npm run build` clean
- New `npm test` passes
- Screenshot `/`, `/music/`, and one release page at 1440px and 390px
- Confirm zero remaining `e2a33f` / `226, 163, 63` in `src/`
- Confirm the SoundCloud embed renders in the new accent
- Confirm the Lunthra unit is visible and correctly placed at both widths
- Confirm nav and footer align with the console column at 1440px

## Follow-up

`Reference/chrisgwim-brand.md` lives outside this repo, in `C:\projects\gwim\music\`, which
is not under version control. Its palette table and decision log need the 2026-09-01
amendment recorded, or the declared source of truth silently goes stale — the exact failure
the project-structure rule warns about. Do this as part of the work, not later.
