// =====================================================
// Tactile Forge Arcade · Package a game's committed files for the site
//   node tools/package-game.mjs <gameRepoOrWorktree> <slug>
//
// Copies every git-tracked file at HEAD except notes, tooling and dev files into
// docs/<slug>/, writes build.json (commit + SHA-256 per file), and fails if any
// shipped HTML/CSS/JS uses a root-absolute path (breaks under /<repo>/<slug>/)
// or still loads Google Fonts.
// =====================================================

import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC  = resolve(process.argv[2] || '');
const SLUG = process.argv[3];
if (!process.argv[2] || !/^[a-z0-9-]+$/.test(SLUG || '')) {
  console.error('usage: node tools/package-game.mjs <gameRepo> <slug>');
  process.exit(2);
}
const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const OUT  = join(SITE, SLUG);

const git = (...a) => execFileSync('git', ['-C', SRC, ...a], { encoding: 'buffer', maxBuffer: 1 << 28 });
const commit = git('rev-parse', '--short', 'HEAD').toString().trim();
const tracked = git('ls-files', '-z').toString().split('\0').filter(Boolean);

// Never shipped: notes, dev servers, tooling, tests, screenshots, debug pages.
const DENY = [
  /^tools\//, /^docs\//, /^tests?\//, /^shots\//, /^\.claude\//, /^node_modules\//,
  /^[^/]+\.md$/i, /^package(-lock)?\.json$/, /^server\.js$/, /^smoke\.js$/,
  /^\.gitignore$/, /^\.gitattributes$/, /^_[^/]*\.html$/, /^[^/]+\.png$/i,
];
const ship = tracked.filter(f => !DENY.some(re => re.test(f)));
if (!ship.includes('index.html')) { console.error('FAIL — no index.html at the repo root'); process.exit(1); }

await rm(OUT, { recursive: true, force: true });
const manifest = { slug: SLUG, commit, builtAt: new Date().toISOString(), files: {} };
const problems = [];
let bytes = 0;
for (const f of ship) {
  const buf = git('show', `HEAD:${f}`);         // committed content, never the working tree
  await mkdir(dirname(join(OUT, f)), { recursive: true });
  await writeFile(join(OUT, f), buf);
  bytes += buf.length;
  manifest.files[f] = createHash('sha256').update(buf).digest('hex');
  if (/\.(html|css|m?js)$/i.test(f)) {
    const t = buf.toString('utf8');
    if (/fonts\.(googleapis|gstatic)\.com/.test(t)) problems.push(`${f}: still loads Google Fonts`);
    for (const m of t.matchAll(/(?:src|href)=["'](\/[^/"'][^"']*)["']|(?:from|import\()\s*["'](\/[^"']+)["']|url\(\s*["']?(\/[^/)"'][^)"']*)/g)) {
      problems.push(`${f}: root-absolute path ${m[1] || m[2] || m[3]}`);
    }
  }
}
await writeFile(join(OUT, 'build.json'), JSON.stringify(manifest, null, 2) + '\n');
if (problems.length) {
  console.error(`FAIL — ${problems.length} problem(s):\n` + problems.map(p => '  • ' + p).join('\n'));
  process.exit(1);
}
console.log(`OK — ${SLUG}: ${ship.length} files, ${(bytes / 1024).toFixed(0)} KiB from ${commit} → docs/${SLUG}/`);
