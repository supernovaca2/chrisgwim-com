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

test('the shell becomes a two-track grid on wide viewports', () => {
  const css = textFiles()
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const inline = readFileSync(dist('index.html'), 'utf8');
  const all = css + inline;
  // Lightning CSS (Astro's build minifier) rewrites `min-width: 1100px` to
  // `width>=1100px`, so accept either spelling of the same breakpoint.
  assert.match(all, /min-width:\s*1100px|width\s*>=\s*1100px/, 'expected a 1100px breakpoint');
  assert.match(all, /grid-template-columns:\s*var\(--console-w\)\s+var\(--rail-w\)/,
    'expected the console + rail grid');
});
