// =====================================================
// Tactile Forge Arcade · Build itch.io HTML5 uploads
//   node tools/itch-zips.mjs [slug ...]      (default: every game in docs/)
// Writes itch/<slug>.zip with index.html at the zip root, as itch.io requires,
// from the packaged copy in docs/<slug>/. Upload by hand on the game's itch page,
// or with butler:  butler push itch/<slug>.zip <user>/<slug>:html5
// =====================================================

import { readdir, mkdir, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const OUT  = join(ROOT, 'itch');
await mkdir(OUT, { recursive: true });

const all = (await readdir(DOCS, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && !['assets', 'downloads'].includes(e.name)).map((e) => e.name);
const slugs = process.argv.length > 2 ? process.argv.slice(2) : all;

for (const slug of slugs) {
  const dir = join(DOCS, slug);
  const entries = (await readdir(dir)).filter((n) => n !== 'build.json');
  if (!entries.includes('index.html')) { console.error(`SKIP ${slug}: no index.html`); continue; }
  const zip = join(OUT, `${slug}.zip`);
  await rm(zip, { force: true });
  // bsdtar (Windows 10+, macOS) writes a zip when the name ends in .zip with -a.
  execFileSync('tar', ['-a', '-c', '-f', zip, '-C', dir, ...entries]);
  const listing = execFileSync('tar', ['-t', '-f', zip], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  const files = listing.filter((l) => !l.endsWith('/'));
  const ok = listing.includes('index.html');
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${slug}.zip  ${files.length} files  ${((await stat(zip)).size / 1024).toFixed(0)} KiB`);
  if (!ok) process.exitCode = 1;
}
