# chrisgwim-com

Chris Gwim's full artist site — the "Studio Console" redesign of chrisgwim.com.
Astro static site, deployed to GitHub Pages via Actions on push to `main`.

Design source of truth lives in the Claude project folder:
`Reference/chrisgwim-brand.md` (tokens, identity) and
`Reference/chrisgwim-com-DESIGN.md` / `-BUILD.md` / `-BACKEND.md` (system, stack, platform).

**Not yet serving chrisgwim.com.** The live domain is still served by the
`chrisgwim-links` repo. This site deploys to the GitHub Pages project URL until the
domain cutover is explicitly approved. At cutover: set `site: 'https://chrisgwim.com'`
and remove `base` in `astro.config.mjs`, add a `CNAME` file, and move the apex domain
off `chrisgwim-links` (whose `links.chrisgwim.com` subdomain stays).

## Editing content

- **Add a release:** one JSON file in `src/content/releases/` (title, datePublished,
  cover, primaryUrl, optional series). Cover JPG (500×500) goes in `public/covers/`.
  That's it — the track list, counts, and "latest" badge all derive from the collection.
- **Design tokens:** `src/styles/tokens.css` — mirror any change back to
  `Reference/chrisgwim-brand.md` in the Claude project.

## Commands

```sh
npm run dev       # dev server at localhost:4321
npm run build     # static build to dist/
npm run preview   # serve the built site locally
```
