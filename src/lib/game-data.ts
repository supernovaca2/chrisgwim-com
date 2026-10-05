// Everything Overworld (the home page) needs to know about the catalog, worked
// out at build time and inlined into the page as one JSON block. The game never
// fetches anything but images.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getReleases, LANES, PLATFORMS, ACCENT_HEX } from './releases';
import { coverPoster } from './images';
import { CONTACT_EMAIL, LUNTHRA_URL, REFERRAL_URL } from './site';
import { sameArt, castColor } from './cover-art.mjs';

// Pages are bundled before they run, so import.meta.url no longer points into
// src/. The build always runs from the repo root.
const covers = join(process.cwd(), 'public', 'covers');

export async function gameData(base: string) {
  const all = await getReleases();
  const releases = await Promise.all(
    all.map(async (r) => {
      const file = r.data.cover.replace(/^\/?covers\//, '');
      const cover = join(covers, file);
      const hd = join(covers, 'hd', file);
      // Up close a monolith shows the original upload, but only while it is
      // still the same art as the cover (see sameArt).
      const hiRes = existsSync(hd) && (await sameArt(cover, hd));
      return {
        slug: r.id,
        title: r.data.title,
        date: r.data.datePublished,
        genre: r.data.genre,
        lane: r.data.lane,
        ms: r.data.durationMs,
        sc: r.data.soundcloudUrl,
        scId: r.data.soundcloudId,
        primary: r.data.primaryUrl,
        notes: r.data.description ?? '',
        tint: await castColor(cover),
        card: coverPoster(r.data.cover, base),
        large: `${base}covers/${hiRes ? 'hd/' : ''}${file}`,
        page: `${base}music/${r.id}/`,
      };
    })
  );
  return {
    accent: ACCENT_HEX,
    contact: CONTACT_EMAIL,
    portrait: `${base}artist-portrait.jpg`,
    links: { catalog: `${base}music/`, story: `${base}story/`, lunthra: LUNTHRA_URL, referral: REFERRAL_URL },
    platforms: PLATFORMS.map((p) => ({ name: p.name, url: p.url })),
    lanes: LANES.map((l) => ({ name: l.name, bus: l.bus, blurb: l.blurb, color: l.color })),
    releases,
  };
}
