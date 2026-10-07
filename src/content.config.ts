import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// SoundCloud is the source of truth for what is public. One JSON file per
// track; the site derives counts, lanes, the featured release, per-track
// players, and structured data from these files alone.
// Release links are written into pages and into the game. z.string().url()
// alone would accept a javascript: URL, and these files are written by an
// unattended sync as well as by hand.
const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), 'must be an https:// URL');

const releases = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/releases' }),
  schema: z.object({
    title: z.string(),
    datePublished: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cover: z.string(),
    // Spotify album when one exists, else Deezer album, else the SoundCloud track.
    primaryUrl: httpsUrl,
    soundcloudId: z.number().int().positive(),
    soundcloudUrl: httpsUrl,
    genre: z.string(),
    lane: z.enum([
      'Classical Fusion',
      'Techno & Trance',
      'House & EDM',
      'Bass',
      'Piano',
      'Punk & Rock',
      'World & Pop',
    ]),
    durationMs: z.number().int().positive(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),
  }),
});

export const collections = { releases };
