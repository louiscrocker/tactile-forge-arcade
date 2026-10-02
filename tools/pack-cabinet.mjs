// =====================================================
// Tactile Forge Arcade · Build the downloadable "Cabinet Edition" of a Go game
//   node tools/pack-cabinet.mjs --dir <goRepoOrWorktree> --origin <C:\Development\REPO>
//        --cmd ./cmd/<name> --slug <slug> --name "<Public Name>" --version 1.0.0
//
// Cross-compiles (CGO_ENABLED=0; Ebitengine 2.10 needs no C toolchain) for
// Windows x64/ARM64, macOS Apple Silicon/Intel and Linux x64, and writes
// release/<version>/<slug>-<platform>.zip:
//   windows  <Name>/<Name>.exe + README.txt
//   macos    <Name>.app (Info.plist + binary, 0755) + README.txt
//   linux    <slug>/<slug> (0755) + README.txt
// Asset names don't carry the version, so the site can link to
// releases/latest/download/<asset> and always get the newest build.
// --origin is where the repo normally lives: go.mod's relative `replace`
// paths (../TACTILE_FORGE_VECTORFX …) are resolved from there into a
// temporary copy passed with -modfile, so a worktree elsewhere builds without
// editing go.mod.
// =====================================================

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { writeZip } from './zipwriter.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) =>
  (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
for (const k of ['dir', 'cmd', 'slug', 'name', 'version']) {
  if (!args[k]) { console.error(`missing --${k}`); process.exit(2); }
}
const DIR = resolve(args.dir), ORIGIN = resolve(args.origin || args.dir);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'release', args.version);
mkdirSync(OUT, { recursive: true });
const exeName = args.cmd.split('/').pop();

// ---- a temporary go.mod (via -modfile) with absolute replace paths ----
// (go.work would be the natural tool, but on Windows it refused to recognise
// the module directory; -modfile leaves the real go.mod untouched just as well.)
const gomod = readFileSync(join(DIR, 'go.mod'), 'utf8');
const module = gomod.match(/^module\s+(\S+)/m)[1];
const tmp = mkdtempSync(join(tmpdir(), 'tf-cabinet-'));
const modfile = join(tmp, 'go.mod');
writeFileSync(modfile, gomod.replace(/(=>\s+)(\.\.?[\/\\][^\s]+)/g,
  (_, arrow, p) => arrow + resolve(ORIGIN, p).replace(/\\/g, '/')));
if (existsSync(join(DIR, 'go.sum'))) writeFileSync(join(tmp, 'go.sum'), readFileSync(join(DIR, 'go.sum')));

// ---- version stamp, if the game exposes ui.Version ----
let versionFlag = '';
try {
  const ui = execFileSync('git', ['-C', DIR, 'grep', '-l', '^var Version', '--', 'internal/ui'], { encoding: 'utf8' }).trim();
  if (ui) versionFlag = `-X ${module}/internal/ui.Version=${args.version}`;
} catch {}
const commit = execFileSync('git', ['-C', DIR, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['-C', DIR, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
if (dirty) { console.error(`FAIL — ${DIR} has uncommitted changes; release builds come from commits only.`); process.exit(1); }

const TARGETS = [
  { os: 'windows', arch: 'amd64', label: 'windows-x64' },
  { os: 'windows', arch: 'arm64', label: 'windows-arm64' },
  { os: 'darwin',  arch: 'arm64', label: 'macos-apple-silicon' },
  { os: 'darwin',  arch: 'amd64', label: 'macos-intel' },
  { os: 'linux',   arch: 'amd64', label: 'linux-x64' },
];

const readme = (platform) => `${args.name} — Tactile Forge Cabinet Edition ${args.version}
Free to play. More games: https://louiscrocker.github.io/tactile-forge-arcade/

${{
  windows: `RUN: unzip, open the "${args.name}" folder, double-click "${args.name}.exe".
Windows may say "Windows protected your PC" because this free game isn't code-signed
yet. Click "More info", then "Run anyway".`,
  darwin: `RUN: unzip, then drag "${args.name}.app" to Applications (or anywhere).
The first time, macOS will refuse to open it because this free game isn't signed with
an Apple Developer ID yet. Open it once, close the warning, then go to
System Settings > Privacy & Security and click "Open Anyway" next to "${args.name}".
(Advanced: xattr -dr com.apple.quarantine "/Applications/${args.name}.app")`,
  linux: `RUN: unzip, then run ./${args.slug}/${args.slug}
Needs an X11 or Wayland desktop with OpenGL (Mesa is fine) and an ALSA/PulseAudio
sound device. If it doesn't start, run it from a terminal to see the error.`,
}[platform]}

Saves, settings and high scores stay on this computer. Nothing is sent anywhere.
Source commit: ${commit}
`;

const sums = [];
for (const t of TARGETS) {
  const bin = join(tmp, `${t.label}${t.os === 'windows' ? '.exe' : ''}`);
  const ld = ['-s', '-w', versionFlag, t.os === 'windows' ? '-H=windowsgui' : ''].filter(Boolean).join(' ');
  execFileSync('go', ['build', '-trimpath', `-modfile=${modfile}`, '-ldflags', ld, '-o', bin, args.cmd], {
    cwd: DIR, stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, CGO_ENABLED: '0', GOOS: t.os, GOARCH: t.arch, GOWORK: 'off' },
  });
  const data = readFileSync(bin);
  const entries = [];
  if (t.os === 'windows') {
    entries.push({ name: `${args.name}/${args.name}.exe`, data, mode: 0o755 });
    entries.push({ name: `${args.name}/README.txt`, data: Buffer.from(readme('windows').replace(/\n/g, '\r\n')), mode: 0o644 });
  } else if (t.os === 'darwin') {
    const app = `${args.name}.app/Contents`;
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>${args.name}</string>
  <key>CFBundleDisplayName</key><string>${args.name}</string>
  <key>CFBundleIdentifier</key><string>io.github.louiscrocker.tactileforge.${args.slug}</string>
  <key>CFBundleExecutable</key><string>${exeName}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${args.version}</string>
  <key>CFBundleVersion</key><string>${args.version}</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.arcade-games</string>
</dict></plist>
`;
    entries.push({ name: `${app}/Info.plist`, data: Buffer.from(plist), mode: 0o644 });
    entries.push({ name: `${app}/MacOS/${exeName}`, data, mode: 0o755 });
    entries.push({ name: 'README.txt', data: Buffer.from(readme('darwin')), mode: 0o644 });
  } else {
    entries.push({ name: `${args.slug}/${args.slug}`, data, mode: 0o755 });
    entries.push({ name: `${args.slug}/README.txt`, data: Buffer.from(readme('linux')), mode: 0o644 });
  }
  const zipName = `${args.slug}-${t.label}.zip`;
  writeZip(join(OUT, zipName), entries);
  const z = readFileSync(join(OUT, zipName));
  sums.push(`${createHash('sha256').update(z).digest('hex')}  ${zipName}`);
  console.log(`OK  ${zipName}  ${(z.length / 1048576).toFixed(1)} MB`);
}
writeFileSync(join(OUT, `${args.slug}.sha256`), sums.join('\n') + '\n');
writeFileSync(join(OUT, `${args.slug}.json`), JSON.stringify({ slug: args.slug, name: args.name, version: args.version, commit, assets: sums.map((s) => s.split('  ')[1]) }, null, 2) + '\n');
rmSync(tmp, { recursive: true, force: true });
console.log(`built ${args.slug} ${args.version} from ${commit}`);
