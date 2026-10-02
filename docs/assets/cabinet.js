// =====================================================
// Tactile Forge Arcade · Cabinet Edition downloads
// Desktop builds live on the repo's GitHub Releases. "latest/download/<asset>"
// always resolves to the newest release, so these links never need editing.
// =====================================================

export const RELEASES = 'https://github.com/louiscrocker/tactile-forge-arcade/releases';
export const assetURL = (slug, label) => `${RELEASES}/latest/download/${slug}-${label}.zip`;

export const PLATFORMS = [
  { label: 'windows-x64',          os: 'windows', name: 'Windows',              sub: 'x64 · also runs on Windows on ARM' },
  { label: 'windows-arm64',        os: 'windows', name: 'Windows on ARM',       sub: 'Snapdragon / ARM64' },
  { label: 'macos-apple-silicon',  os: 'mac',     name: 'Mac (Apple Silicon)',  sub: 'M1 and newer' },
  { label: 'macos-intel',          os: 'mac',     name: 'Mac (Intel)',          sub: 'Intel Macs' },
  { label: 'linux-x64',            os: 'linux',   name: 'Linux',                sub: 'x64 · X11 or Wayland' },
];

/** Best guess at the visitor's OS; 'mobile' when desktop builds won't help. */
export function detectOS() {
  const ua = navigator.userAgent || '';
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (/Android|iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(plat) && navigator.maxTouchPoints > 1)) return 'mobile';
  if (/Win/i.test(plat) || /Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(plat) || /Mac OS X/i.test(ua)) return 'mac';
  if (/Linux|X11|CrOS/i.test(plat + ua)) return 'linux';
  return 'unknown';
}

/** The download that best fits this visitor, or null on phones/tablets. */
export function primaryFor(os) {
  return { windows: PLATFORMS[0], mac: PLATFORMS[2], linux: PLATFORMS[4] }[os] || null;
}
