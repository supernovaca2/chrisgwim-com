# chrisgwim.com — remove the exposed address, build /contact

**Date:** 2026-09-01
**Repos:** `supernovaca2/chrisgwim-com` (primary), `supernovaca2/chrisgwim-links` (one line)
**Branch:** `design/refresh` — this work stacks on top of the Studio Console refresh
**Status:** awaiting review

## Why

`chrisgwim@chrisgwim.com` is rendered in plaintext in the site footer, which lives in
`Base.astro` and therefore ships on **all 21 pages**, twice per page (the `href` and the
link text). It is also in `chrisgwim-links/index.html`. Magnus is receiving phishing and
spam. This is the same failure the Lunthra rule already names: `care@lunthra.com` is real
but must never appear on the site — forms only. The Gwim properties never got that
treatment.

## What this fixes, and what it does not

**Fixes:** the harvesting vector. After this, no email address appears in any HTML on
chrisgwim.com or links.chrisgwim.com.

**Does not fix:** the spam already arriving. That address is on resold lists and removal
does nothing about existing traffic. Quieting the current inbox is a separate job —
ProtonMail-side filtering, or eventually a new address. Do not expect this change to
reduce today's volume.

## Not a new decision

`Reference/chrisgwim-com-DESIGN.md` already puts `/contact` in the v1 IA, specified as
*"Email + one message field, nothing more."* `Reference/chrisgwim-com-BACKEND.md` already
records "Contact form (`/contact`) → managed form endpoint (Formspree or equivalent)" as
**Ready to spec**. This builds a deferred decision; it does not make a new one.

## Design

### The `/contact` page

New route `src/pages/contact.astro`, in Studio Console chrome. It is a rack unit — same
panel, steel border, and mono label as `Promo` and `Rail` — so it reads as part of the
console rather than a bolted-on web form.

Two fields, per the DESIGN doc, plus a honeypot:

| Field | Type | Notes |
|---|---|---|
| Email | `email`, required | The reply-to |
| Message | `textarea`, required | One field. A subject line is friction that buys nothing here. |
| Honeypot | `text`, visually hidden, `tabindex="-1"`, `autocomplete="off"` | Not `display: none` — some bots skip those. Position it off-screen. |

### Spam protection comes from the provider

**GitHub Pages is static; there is no server to verify a Cloudflare Turnstile token.**
Lunthra's Turnstile guard works only because Oxygen runs server code holding
`TURNSTILE_SECRET_KEY`. Putting a Turnstile widget on a static page with nobody checking
the token is decoration, not protection.

So: filtering is whatever the managed provider gives us, plus the honeypot. If form spam
later becomes the new door — the recurring pattern in
`reference_lunthra_email_spam_doors` — the documented upgrade is a small Cloudflare
Worker that verifies a real Turnstile token and forwards the message. That is out of
scope here and should stay out until it is actually needed.

### Provider-agnostic by construction

The provider is not chosen yet; Magnus selects one at signup. All provider knowledge
lives in one module, `src/config/contact.ts`:

```ts
// The managed form endpoint. Swap provider by editing this file and nothing else.
export const FORM_ENDPOINT = '';

// Provider-specific hidden inputs (e.g. Web3Forms' access_key). Empty for providers
// that encode everything in the endpoint URL, such as Formspree.
export const FORM_HIDDEN_FIELDS: Record<string, string> = {};
```

`contact.astro` renders `FORM_HIDDEN_FIELDS` as hidden inputs and posts to
`FORM_ENDPOINT`. Neither Formspree nor Web3Forms needs anything else.

### Progressive enhancement

The form is a native `<form method="POST">` and works with JavaScript disabled — the
visitor lands on the provider's confirmation page. A small inline script upgrades it to
`fetch()` so success and failure render in place. On failure the message the visitor
typed is never cleared.

### Sitewide changes in `Base.astro`

- Footer: the `mailto` anchor becomes `<a href="/contact/">Contact</a>`.
- Nav: gains a third item, `CONTACT`, beside `INDEX` and `TRACK LIST`.

### Cross-repo: `chrisgwim-links`

One line in `index.html`. The `.email` anchor becomes a link to
`https://chrisgwim.com/contact/` with its visible text changed from the address to
`Contact`. No form — it is a link-in-bio whose whole job is routing people onward, and a
second contact path would be a second thing to maintain. The `.email` CSS class can stay;
only the `href` and text change.

## Testing

`tests/build-output.test.js` gains the guard that actually matters:

```js
test('no email address survives anywhere in the build', () => {
  const offenders = textFiles().filter((f) =>
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(readFileSync(f, 'utf8'))
  );
  assert.deepEqual(offenders.map((f) => f.replace(distRoot, 'dist')), []);
});
```

**One trap in that regex:** it also matches retina asset filenames. In `logo@2x.png`,
`2x` reads as the domain and `png` as a valid TLD, so the sweep would fail on a perfectly
innocent image. Exclude matches whose trailing segment is a known asset extension
(`png|jpg|jpeg|webp|svg|gif|avif|woff|woff2|css|js|map`) rather than weakening the
address pattern itself. Pair the sweep with two narrower assertions that cannot
false-positive: no `mailto:` anywhere in the build, and neither known address present by
exact string.

That sweeps every built page, so an address reintroduced in any template fails the build
rather than shipping. Additionally:

- `/contact/` builds and contains a `<form>` with a `POST` method
- the honeypot input is present and is not `display: none`
- `FORM_ENDPOINT` is non-empty — this is what prevents shipping a dead form
- the footer and nav link to `/contact/`, and no `mailto:` remains

## Sequencing — do not merge early

Merging with an empty `FORM_ENDPOINT` would remove the contact path and ship a broken
form, which is strictly worse than today.

1. Build everything. `FORM_ENDPOINT` stays empty; the endpoint test fails by design.
2. Magnus creates the provider account and supplies the endpoint.
3. Fill it in, then **send a real message and confirm it arrives.** Not a mocked test —
   an actual submission landing in the actual inbox.
4. Only then merge.

## Out of scope

- Quieting the existing spam (ProtonMail filtering, address rotation)
- A Cloudflare Worker / real Turnstile verification — the documented upgrade, not now
- Klaviyo mailing-list capture. `BACKEND.md` specs it, Magnus said "no klaviyo yet," and
  that stands. This form is contact only; it must not subscribe anyone to anything.
- Any change to release data, copy elsewhere, or the Studio Console refresh already on
  this branch
