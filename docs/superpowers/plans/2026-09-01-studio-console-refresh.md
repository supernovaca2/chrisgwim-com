# Studio Console Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move chrisgwim.com's single accent from amber to phosphor green, break the uniform single-column stack into a console-plus-rack layout, and add a Lunthra cross-promotion rail in the gutter that layout creates.

**Architecture:** Astro 7 static site, no framework components, scoped `<style>` blocks per `.astro` file with shared custom properties in `src/styles/tokens.css`. The layout change is expressed entirely in custom properties and one grid container in `Base.astro`, so section components stay unaware of it. A new build-output test suite guards the recolor mechanically.

**Tech Stack:** Astro 7.0.7, Node >=22.12, `node --test` (added by this plan), GitHub Pages via Actions.

## Global Constraints

- **Node >=22.12** — `package.json` `engines`. The Pages workflow pins `node-version: 24`; Astro 7 fails on the action's default 20.
- **One accent, spent deliberately.** After this change the single accent is `#9ece6a`. Do not introduce a second decorative accent.
- **`--red` `#c0453d` is semantic-only** — live/rec indicators. Never decorative. Untouched by this plan.
- **No UTM parameters** on the Lunthra link. Clean URLs only.
- **No analytics, no email capture.** Both previously declined; do not add either.
- **Content is frozen.** No copy changes, no release-data changes, no touching the 19 files in `src/content/releases/`.
- **`BASE_URL` has no trailing slash** under a base path — the existing `base` helper in each page normalises it. Reuse that pattern, never concatenate `BASE_URL` directly.
- Two-space indentation for `.astro`, `.css`, `.js`.

---

### Task 1: Test harness and accent recolor

Adds the repo's first tests, then repaints. The test comes first because the single largest risk in this change is missing one of six hardcoded amber values, and a build-output assertion catches that mechanically rather than by eye.

**Files:**
- Create: `tests/build-output.test.js`
- Modify: `package.json` (add `test` script)
- Modify: `src/styles/tokens.css:11-12`
- Modify: `src/components/ChannelStrip.astro:6-9`
- Modify: `src/components/Promo.astro:57`
- Modify: `src/pages/index.astro:64,73,80,85`
- Modify (mechanical rename): `src/components/Outputs.astro`, `src/components/TrackList.astro`, `src/layouts/Base.astro`, `src/pages/music/index.astro`, `src/pages/music/[slug].astro`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--accent` (`#9ece6a`) and `--accent-dim` (`#4a6130`), replacing `--amber` / `--amber-dim`. Tasks 2 and 3 use `var(--accent)`. Also produces `tests/build-output.test.js` with an exported-by-convention `walk()`/`textFiles()` pair that later tasks add assertions beside.

- [ ] **Step 1: Add the test script**

In `package.json`, add to `scripts`:

```json
    "test": "node --test"
```

Final `scripts` block:

```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "node --test"
  },
```

- [ ] **Step 2: Write the failing tests**

Create `tests/build-output.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const distRoot = fileURLToPath(new URL('../dist', import.meta.url));
const dist = (file) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// Every text asset the browser will actually receive.
const textFiles = () => walk(distRoot).filter((f) => /\.(html|css|js)$/.test(f));

test('the homepage is generated', () => {
  assert.ok(existsSync(dist('index.html')), 'dist/index.html should exist');
});

// Without this file in the published output, GitHub Pages drops the custom
// domain on every deploy and chrisgwim.com stops resolving to the site.
test('CNAME survives the build into dist', () => {
  assert.equal(readFileSync(dist('CNAME'), 'utf8').trim(), 'chrisgwim.com');
});

test('the new accent reaches the build', () => {
  const found = textFiles().some((f) => /9ece6a/i.test(readFileSync(f, 'utf8')));
  assert.ok(found, 'expected accent #9ece6a somewhere in dist');
});

// Six places bypassed the --amber token, including the SoundCloud embed's own
// color param. Any survivor leaves the page visibly half-repainted.
test('no legacy amber survives anywhere in the build', () => {
  const offenders = textFiles().filter((f) => {
    const body = readFileSync(f, 'utf8');
    return /e2a33f/i.test(body) || /226,\s*163,\s*63/.test(body);
  });
  assert.deepEqual(
    offenders.map((f) => f.replace(distRoot, 'dist')),
    [],
    'legacy amber found in built output'
  );
});
```

- [ ] **Step 3: Run to verify they fail**

```bash
npm run build && npm test
```

Expected: `the new accent reaches the build` FAILS (`expected accent #9ece6a somewhere in dist`) and `no legacy amber survives` FAILS listing `dist/index.html` and the built CSS. The `homepage` and `CNAME` tests should already PASS.

- [ ] **Step 4: Rename the tokens and set new values**

In `src/styles/tokens.css`, replace lines 11-12:

```css
  --amber: #e2a33f;
  --amber-dim: #7a5a29;
```

with:

```css
  --accent: #9ece6a;
  --accent-dim: #4a6130;
```

- [ ] **Step 5: Propagate the rename across all remaining usages**

A token named `--amber` holding a green is a lie that costs the next reader real time. 16 usages across 8 files:

```bash
grep -rl -- '--amber' src/ | xargs sed -i 's/--amber-dim/--accent-dim/g; s/--amber/--accent/g'
```

Verify nothing was missed:

```bash
grep -rn -- '--amber' src/ ; echo "exit=$?"
```

Expected: no output, `exit=1`.

- [ ] **Step 6: Fix the SoundCloud embed's hardcoded hex**

The embed takes a literal hex in its query string and cannot read a custom property, so it needs the value duplicated — but named, not scattered. In `src/components/ChannelStrip.astro`, replace lines 6-9:

```astro
const playerSrc =
  'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fchrisgwim' +
  '&color=%23e2a33f&auto_play=false&hide_related=true&show_comments=false' +
  '&show_user=true&show_reposts=false&show_teaser=false&visual=false';
```

with:

```astro
// Keep in sync with --accent in src/styles/tokens.css. The SoundCloud embed
// takes a literal hex in its query string and cannot read a custom property.
const ACCENT_HEX = '9ece6a';
const playerSrc =
  'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fchrisgwim' +
  `&color=%23${ACCENT_HEX}&auto_play=false&hide_related=true&show_comments=false` +
  '&show_user=true&show_reposts=false&show_teaser=false&visual=false';
```

Note the middle line becomes a template literal — backticks, not quotes.

- [ ] **Step 7: Replace the hardcoded rgba values so they track the token**

In `src/components/Promo.astro`, line 57:

```css
    background: rgba(226, 163, 63, 0.08);
```

becomes:

```css
    background: color-mix(in srgb, var(--accent) 8%, transparent);
```

In `src/pages/index.astro`, the four `.dial` values:

Line 64 — `border: 1px solid rgba(226, 163, 63, 0.08);` becomes:

```css
    border: 1px solid color-mix(in srgb, var(--accent) 8%, transparent);
```

Line 73 — `border: 1px solid rgba(226, 163, 63, 0.07);` becomes:

```css
    border: 1px solid color-mix(in srgb, var(--accent) 7%, transparent);
```

Line 80 — `border: 1px solid rgba(226, 163, 63, 0.06);` becomes:

```css
    border: 1px solid color-mix(in srgb, var(--accent) 6%, transparent);
```

Line 85 — the conic gradient becomes:

```css
    background: repeating-conic-gradient(color-mix(in srgb, var(--accent) 10%, transparent) 0deg 1deg, transparent 1deg 15deg);
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npm run build && npm test
```

Expected: all four tests PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json tests/ src/
git commit -m "feat: accent moves amber to phosphor green, add build-output tests

Renames --amber/--amber-dim to --accent/--accent-dim and sets #9ece6a/#4a6130,
amending the 2026-07-13 palette decision as authorised 2026-09-01. The one-accent
rule is unchanged and --red stays semantic-only.

Six hardcoded values bypassed the token, including the SoundCloud embed's color
param; a new build-output test asserts none survive.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Console and rack layout

Turns the single centered column into a two-track grid, and gives the console a wide mixer area with narrow outboard strips.

**Files:**
- Modify: `src/styles/tokens.css` (add width custom properties, adjust `.page`, add `.rack`)
- Modify: `src/layouts/Base.astro` (wrap main in `.shell`, align nav and footer)
- Modify: `src/pages/index.astro` (wrap rack panels)
- Modify: `tests/build-output.test.js` (add layout assertion)

**Interfaces:**
- Consumes: `--accent` from Task 1.
- Produces: custom properties `--console-w` (760px), `--rail-w` (200px), `--rail-gap` (28px), `--shell-w`; a `.shell` grid container in `Base.astro` whose second grid cell Task 3 fills; and a `.rack` inset utility.

- [ ] **Step 1: Write the failing test**

Append to `tests/build-output.test.js`:

```js
test('the shell becomes a two-track grid on wide viewports', () => {
  const css = textFiles()
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const inline = readFileSync(dist('index.html'), 'utf8');
  const all = css + inline;
  assert.match(all, /min-width:\s*1100px/, 'expected a 1100px breakpoint');
  assert.match(all, /grid-template-columns:\s*var\(--console-w\)\s+var\(--rail-w\)/,
    'expected the console + rail grid');
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run build && npm test
```

Expected: FAIL — `expected a 1100px breakpoint`.

- [ ] **Step 3: Add width custom properties and layout utilities**

In `src/styles/tokens.css`, add inside the `:root` block after `--red`:

```css
  --console-w: 760px;
  --rail-w: 200px;
  --rail-gap: 28px;
  --shell-w: var(--console-w);
```

Replace the existing `.page` rule (currently `max-width: 760px`):

```css
.page {
  max-width: var(--console-w);
  margin: 0 auto;
  padding: 0 20px;
}
```

Then add, after `.page`:

```css
/* The shell is the only thing that knows about the rail. Section components
   stay unaware of the two-track layout. */
.shell {
  max-width: var(--shell-w);
  margin: 0 auto;
}

/* Outboard rack strips inset inside the console column so TrackList reads as
   the wide mixer area. Below the rail breakpoint everything sits flush. */
.rack {
  max-width: 620px;
  margin-inline: auto;
}

@media (min-width: 1100px) {
  :root {
    --shell-w: calc(var(--console-w) + var(--rail-gap) + var(--rail-w));
  }
  .shell {
    display: grid;
    grid-template-columns: var(--console-w) var(--rail-w);
    gap: var(--rail-gap);
    align-items: start;
  }
}

@media (max-width: 1099px) {
  .rack { max-width: none; }
}
```

- [ ] **Step 4: Wrap main in the shell and align nav and footer**

In `src/layouts/Base.astro`, replace the `<main>` element:

```astro
    <main class="page">
      <slot />
    </main>
```

with:

```astro
    <div class="shell">
      <main class="page">
        <slot />
      </main>
    </div>
```

Then in the same file's `<style>` block, change `.site-nav` and `.footer` from the hardcoded `max-width: 760px` to the shared width, or they will visibly misalign against the widened shell:

```css
  .site-nav {
    display: flex;
    gap: 18px;
    max-width: var(--shell-w);
    margin: 0 auto;
    padding: 10px 20px 0;
  }
```

```css
  .footer {
    max-width: var(--shell-w);
    margin: 0 auto;
    padding: 16px 20px 22px;
    border-top: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--text-dimmer);
    letter-spacing: 0.04em;
  }
```

- [ ] **Step 5: Inset the rack panels**

In `src/pages/index.astro`, replace:

```astro
  <ChannelStrip />
  <TrackList />
  <Outputs />
  <Promo />
```

with:

```astro
  <div class="rack"><ChannelStrip /></div>
  <TrackList />
  <div class="rack"><Outputs /></div>
  <div class="rack"><Promo /></div>
```

`TrackList` stays at full console width — that contrast is the point.

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm run build && npm test
```

Expected: all five tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ tests/
git commit -m "feat: console + rack layout replaces the uniform single column

Introduces --console-w/--rail-w/--rail-gap and a .shell grid that opens a
200px rail at >=1100px. Rack strips inset to 620px so TrackList reads as the
wide mixer area. Nav and footer move to the shared shell width so they stay
aligned with the console column.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Lunthra rail

One evergreen unit — no featured collection, no rotating products, nothing that goes stale.

**Files:**
- Create: `src/components/Rail.astro`
- Modify: `src/layouts/Base.astro`
- Modify: `tests/build-output.test.js`

**Interfaces:**
- Consumes: `.shell` grid and `--accent` from Tasks 1-2.
- Produces: `Rail.astro`, a default-export Astro component taking no props, rendered as the second grid cell of `.shell`.

- [ ] **Step 1: Write the failing test**

Append to `tests/build-output.test.js`:

```js
test('the Lunthra rail is present and links out cleanly', () => {
  const home = readFileSync(dist('index.html'), 'utf8');
  assert.match(home, /https:\/\/lunthra\.com/, 'expected a lunthra.com link');
  assert.match(home, /rel="noopener"/, 'expected rel=noopener on the outbound link');
  assert.doesNotMatch(home, /utm_/, 'UTM parameters are not allowed on the Lunthra link');
});

test('the rail also renders for narrow viewports', () => {
  const home = readFileSync(dist('index.html'), 'utf8');
  // The rail must be in the document at every width, not display:none'd away
  // on mobile - most music traffic is phones.
  assert.match(home, /class="rail"/, 'expected the rail markup in the document');
  assert.doesNotMatch(
    home,
    /\.rail\s*\{[^}]*display:\s*none/,
    'the rail must reflow on mobile, not disappear'
  );
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run build && npm test
```

Expected: FAIL — `expected a lunthra.com link`.

- [ ] **Step 3: Create the Rail component**

Create `src/components/Rail.astro`:

```astro
---
// Cross-promotion for the sibling brand. Deliberately one evergreen unit:
// no featured collection and no product feed, so it never goes stale.
// Lunthra's own palette is cool-only and would fight --accent, so the unit
// wears this site's chrome and only the wordmark carries Lunthra identity.
const LUNTHRA_URL = 'https://lunthra.com';
---
<aside class="rail" aria-label="Also from the studio">
  <div class="rail-unit">
    <div class="rail-label">
      <span>ALSO FROM THE STUDIO</span>
    </div>
    <div class="rail-body">
      <p class="rail-mark">LUNTHRA</p>
      <p class="rail-copy">Science and sci-fi apparel, printed to order.</p>
      <a class="rail-link" href={LUNTHRA_URL} target="_blank" rel="noopener">
        Visit the store ↗
      </a>
    </div>
  </div>
</aside>

<style>
  /* Below the rail breakpoint this sits in normal flow after the console
     column, styled as a sibling rack unit. It is never display:none. */
  .rail {
    padding: 0 20px 28px;
  }
  .rail-unit {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 4px;
  }
  .rail-label {
    padding: 9px 12px;
    border-bottom: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dimmer);
  }
  .rail-body {
    padding: 14px 12px;
  }
  .rail-mark {
    margin: 0 0 8px;
    font-family: var(--display);
    font-weight: 800;
    font-size: 18px;
    letter-spacing: 0.14em;
    color: var(--text);
  }
  .rail-copy {
    margin: 0 0 14px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-dim);
  }
  .rail-link {
    display: inline-block;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    text-decoration: none;
    border: 1px solid var(--accent-dim);
    border-radius: 3px;
    padding: 7px 12px;
  }
  .rail-link:hover,
  .rail-link:focus-visible {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border-color: var(--accent);
  }

  @media (min-width: 1100px) {
    .rail {
      position: sticky;
      top: 84px;
      padding: 0 0 28px;
    }
  }
</style>
```

- [ ] **Step 4: Render it as the second grid cell**

In `src/layouts/Base.astro`, add the import beside the existing `Transport` import:

```astro
import Transport from '../components/Transport.astro';
import Rail from '../components/Rail.astro';
import '../styles/tokens.css';
```

Then add `<Rail />` inside `.shell`, after `</main>`:

```astro
    <div class="shell">
      <main class="page">
        <slot />
      </main>
      <Rail />
    </div>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run build && npm test
```

Expected: all seven tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat: Lunthra rail in the console gutter

One evergreen unit in this site's own chrome; only the wordmark carries
Lunthra identity, since Lunthra's cool-only palette would fight --accent.
Sticky in the rail at >=1100px, reflows inline below it rather than
disappearing - most music traffic is mobile. No UTM on the outbound link.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Visual verification and brand-doc amendment

The accent values were chosen by argument, not observation. This task is where that gets checked, and where the declared source of truth stops being stale.

**Files:**
- Modify: `C:\projects\gwim\music\Reference\chrisgwim-brand (# Name clash 2026-07-19 8v05wiC #).md`

**Interfaces:**
- Consumes: the completed build from Tasks 1-3.
- Produces: nothing code depends on.

- [ ] **Step 1: Build and serve**

```bash
npm run build && npm run preview
```

- [ ] **Step 2: Screenshot and actually look**

Capture `/`, `/music/`, and one release page at 1440px and 390px. Confirm by eye, not by assertion:

- The phosphor green reads considered against the graphite, not cheap or Matrix-ish. **If it reads cheap, stop and switch to the named fallback `#5ec8d8` ice-cyan** — same argument, different temperature — then re-run Tasks 1 and 4.
- The SoundCloud embed is drawing in the new accent, not amber.
- At 1440px: nav, console column, and footer share a left edge; the rail sits in the gutter; `TrackList` is visibly wider than the rack strips.
- At 390px: single flush column, rail visible after `Promo`, no horizontal scroll.
- `● LIVE` indicators are still red and still read as semantic.

- [ ] **Step 3: Record the amendment in the brand doc**

This file is the declared source of truth and lives outside version control. Update the palette table, replacing the `--amber` / `--amber-dim` rows:

```markdown
| `--accent` | `#9ece6a` | The one accent — phosphor green (oscilloscope / tape bargraph) |
| `--accent-dim` | `#4a6130` | Accent gradient base, low-emphasis accent |
```

And append to the decision log:

```markdown
- **2026-09-01** — Amended the palette: the single accent moves from amber `#e2a33f`
  to phosphor green `#9ece6a` (`--amber`/`--amber-dim` renamed to
  `--accent`/`--accent-dim`). Magnus asked for a change obvious at a glance rather
  than a refinement, so this is a hue move, not a value tweak. **The one-accent rule
  from 2026-07-13 is unchanged** — still one accent spent deliberately, and `--red`
  `#c0453d` remains semantic-only for live/rec. Phosphor green was chosen over a
  deeper ember because ember collides with that semantic red. Fallback if it ever
  reads cheap: ice-cyan `#5ec8d8`. Shipped alongside a console+rack layout and a
  Lunthra cross-promotion rail.
```

- [ ] **Step 4: Commit the code side**

The brand doc is not in this repo and not in any repo — it has no version history. Commit only what lives here:

```bash
git add -A
git commit -m "docs: note the 2026-09-01 palette amendment

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

If nothing in this repo changed during this task, skip the commit rather than creating an empty one.

- [ ] **Step 5: Report before merging**

Do not push to `main`. Report to Magnus with the screenshots and an explicit statement of whether the green survived visual inspection or the fallback was used.

---

## Notes

- `src/pages/music/index.astro` and `src/pages/music/[slug].astro` receive the rail automatically through `Base.astro`. Check both at 1440px in Task 4 — a release page's full-bleed cover art beside a rail is the layout most likely to look wrong.
- `Transport.astro` is fixed-position and sits outside `.shell`; the rail's `top: 84px` sticky offset clears it. If `Transport`'s height changes, that number needs to change with it.
