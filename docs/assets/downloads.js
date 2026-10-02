// =====================================================
// Tactile Forge Arcade · downloads page
// One panel per Cabinet Edition with every platform, the visitor's own
// platform highlighted, checksums and a link to play in the browser instead.
// =====================================================

import { GAMES } from './games.js';
import { PLATFORMS, RELEASES, assetURL, detectOS } from './cabinet.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OS = detectOS();

const list = GAMES.filter((g) => g.cabinet);
document.getElementById('dl-list').innerHTML = list.map((g) => `
  <article class="dl-game glass" id="${g.slug}" style="--accent:${g.accent};--accent-glow:${g.glow}">
    <a class="shot" href="../${g.slug}/" aria-label="Play ${esc(g.name)} in the browser">
      <span class="badge">${esc(g.badge)}</span>
      <img src="../assets/shots/${g.slug}-game.webp" alt="${esc(g.name)} gameplay" loading="lazy" width="960" height="600">
    </a>
    <div>
      <h3>${esc(g.name)}</h3>
      <p class="tagline">${esc(g.tagline)}</p>
      <div class="plat-grid">
        ${PLATFORMS.map((p) => `
          <a class="plat${p.os === OS && (p.label === 'windows-x64' || p.label === 'macos-apple-silicon' || p.label === 'linux-x64') ? ' mine' : ''}" href="${assetURL(g.slug, p.label)}">
            <b>⤓ ${esc(p.name)}</b><span>${esc(p.sub)}</span>
          </a>`).join('')}
      </div>
      <div class="dl-extra">
        <a href="../${g.slug}/">▶ Play in the browser instead</a>
        <a href="${RELEASES}/latest/download/${g.slug}.sha256">SHA-256 checksums</a>
        <a href="${RELEASES}/latest">Release notes</a>
      </div>
    </div>
  </article>`).join('');

if (OS === 'mobile') document.getElementById('mobile-note').hidden = false;
const cnt = document.getElementById('count-cabinet');
if (cnt) cnt.textContent = list.length;
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
