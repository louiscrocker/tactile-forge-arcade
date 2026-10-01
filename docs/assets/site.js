// =====================================================
// Tactile Forge Arcade · cards + starfield
// The game list lives in assets/games.js. No network requests beyond this site.
// =====================================================

import { GAMES } from './games.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function card(g) {
  const shots = `
      <img src="assets/shots/${g.slug}-game.webp" alt="${esc(g.name)} gameplay" loading="lazy" width="960" height="600">
      ${g.titleShot === false ? '' : `<img class="alt" src="assets/shots/${g.slug}-title.webp" alt="" aria-hidden="true" loading="lazy" width="960" height="600">`}`;
  return `
  <article class="card glass" style="--accent:${g.accent};--accent-glow:${g.glow}">
    <a class="shot" href="${g.slug}/" tabindex="-1" aria-hidden="true">
      <span class="badge">${esc(g.badge)}</span>${shots}
    </a>
    <div class="card-body">
      <h3>${esc(g.name)}</h3>
      <p class="tagline">${esc(g.tagline)}</p>
      <p class="desc">${esc(g.description)}</p>
      <ul class="feats">${g.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="card-foot">
        <span class="meta">${esc(g.meta)}</span>
        <a class="play" href="${g.slug}/">Play <span aria-hidden="true">▶</span><span class="sr"> ${esc(g.name)}</span></a>
      </div>
    </div>
  </article>`;
}

for (const shelf of ['arcade', 'nature']) {
  const list = GAMES.filter((g) => g.shelf === shelf);
  document.getElementById(`grid-${shelf}`).innerHTML = list.map(card).join('');
  const count = document.getElementById(`count-${shelf}`);
  if (count) count.textContent = list.length;
}
document.getElementById('count-all').textContent = GAMES.length;
document.getElementById('year').textContent = new Date().getFullYear();

// ---------- Starfield (paused when reduced motion is preferred or tab hidden) ----------
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
const still = window.matchMedia('(prefers-reduced-motion: reduce)');
let stars = [], w = 0, h = 0, last = performance.now();
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = window.innerWidth; h = window.innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stars = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
    x: Math.random() * w, y: Math.random() * h, z: Math.random(), t: Math.random() * 6.28,
  }));
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  ctx.clearRect(0, 0, w, h);
  for (const s of stars) {
    if (!still.matches) { s.y += dt * (4 + s.z * 10); s.t += dt * (0.8 + s.z); if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; } }
    ctx.globalAlpha = (0.25 + 0.35 * Math.sin(s.t) * 0.5 + 0.35) * (0.35 + s.z * 0.65);
    ctx.fillStyle = s.z > 0.85 ? '#ffe6b8' : '#cffff0';
    ctx.fillRect(s.x, s.y, 1 + s.z, 1 + s.z);
  }
  if (!document.hidden) requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
window.addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(frame);
