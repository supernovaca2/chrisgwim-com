// The largest copy of a cover the site may show: the original upload in
// public/covers/hd while it is still the same art as the 500px cover (see
// sameArt), else the 500px cover itself. Build-time only: it reads the disk.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { sameArt } from './cover-art.mjs';

// Pages are bundled before they run, so import.meta.url no longer points into
// src/. The build always runs from the repo root.
const covers = join(process.cwd(), 'public', 'covers');

export async function coverLarge(cover: string, base: string): Promise<string> {
  const file = cover.replace(/^\/?covers\//, '');
  const hd = join(covers, 'hd', file);
  const hiRes = existsSync(hd) && (await sameArt(join(covers, file), hd));
  return `${base}covers/${hiRes ? 'hd/' : ''}${file}`;
}
