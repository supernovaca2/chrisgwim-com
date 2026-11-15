// Everything Wave Invasion (/play/) needs to know about the catalog, worked out
// at build time and inlined into the page as one JSON block. The game never
// fetches anything but images.
import { getReleases, LANES, PLATFORMS, ACCENT_HEX } from './releases';
import { coverPoster, coverThumb } from './images';
import { coverLarge } from './cover-large';
import { CONTACT_EMAIL, LUNTHRA_URL, REFERRAL_URL } from './site';

export async function gameData(base: string) {
  const all = await getReleases();
  const releases = await Promise.all(
    all.map(async (r) => ({
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
      thumb: coverThumb(r.data.cover, base),
      card: coverPoster(r.data.cover, base),
      // The original upload, but only while it is still the same art as the cover.
      large: await coverLarge(r.data.cover, base),
      page: `${base}music/${r.id}/`,
    }))
  );
  return {
    accent: ACCENT_HEX,
    contact: CONTACT_EMAIL,
    portrait: `${base}artist-portrait.jpg`,
    links: { home: base, catalog: `${base}music/`, story: `${base}story/`, lunthra: LUNTHRA_URL, referral: REFERRAL_URL },
    platforms: PLATFORMS.map((p) => ({ name: p.name, url: p.url })),
    lanes: LANES.map((l) => ({ name: l.name, bus: l.bus, blurb: l.blurb, color: l.color })),
    releases,
  };
}
