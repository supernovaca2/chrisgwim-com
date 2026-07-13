import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const releases = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/releases' }),
  schema: z.object({
    title: z.string(),
    datePublished: z.string(),
    cover: z.string(),
    primaryUrl: z.string().url(),
    series: z.string().optional(),
  }),
});

export const collections = { releases };
