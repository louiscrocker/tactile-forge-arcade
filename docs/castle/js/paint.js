/* ============================================================
   paint.js — the painted look: textures baked by code
   ============================================================
   With the painted look on (the default where WebGL2 works), the
   stone, the roof tiles, the planks, the plaster, the grass and
   the earth are seamless textures painted once on canvases at
   load (noise, grain, mortar, moss) and laid as patterns in world
   units.  The classic look (?gfx=classic, or the O key) draws the
   same shapes flat, so nothing in the game's logic reads from
   here.  Painted.on() is the switch render.js and sprites.js ask.
   ============================================================ */
'use strict';

const Painted = (function () {
  const tex = {}, pats = new Map();
  let ctxFor = null, enabled = true, baked = false;
  const S = 128;   /* a texture covers 4 × 4 cells */

  function canvas() { const c = document.createElement('canvas'); c.width = c.height = S; return c; }
  function noiseFill(g, R, base, grainAmp, n = 2600) {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < n; i++) { const v = R(); g.fillStyle = v < .5 ? `rgba(0,0,0,${R() * grainAmp})` : `rgba(255,250,235,${R() * grainAmp * .8})`; g.fillRect(R() * S, R() * S, 1 + (R() < .3 ? 1 : 0), 1 + (R() < .3 ? 1 : 0)); }
  }
  function blotches(g, R, col, n, rmin, rmax, alpha) { for (let i = 0; i < n; i++) { g.fillStyle = col.replace('A', (alpha * (.5 + R() * .5)).toFixed(3)); g.beginPath(); g.ellipse(R() * S, R() * S, rmin + R() * (rmax - rmin), rmin + R() * (rmax - rmin), R() * 3, 0, TAU); g.fill(); } }
  function wrapDraw(g, fn) { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } }

  function bake() {
    if (baked) return; baked = true;
    const C2 = CELL;
    /* stone: running-bond blocks, each with its own tint, soft mortar, grain and a little moss */
    for (const [name, round] of [['stone', false], ['tower', true]]) {
      const c = canvas(), g = c.getContext('2d'), R = mulberry32(round ? 7 : 3);
      noiseFill(g, R, '#8c877e', .18, 1200);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? C2 / 2 : 0;
        for (let k = -1; k < 5; k++) {
          const x = k * C2 + off, y = row * C2, tint = 72 + R() * 46, warm = R() * 12;
          g.fillStyle = `rgb(${tint + 70 + warm | 0},${tint + 64 + warm * .5 | 0},${tint + 54 | 0})`;
          g.beginPath(); g.moveTo(x + 1.5, y + 1.5); g.lineTo(x + C2 - 1.5, y + 1.2); g.lineTo(x + C2 - 1.2, y + C2 - 1.8); g.lineTo(x + 1.8, y + C2 - 1.4); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x + 2, y + 2, C2 - 4, 2);
          g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + 2, y + C2 - 4, C2 - 4, 2.5); g.fillRect(x + C2 - 4, y + 2, 2, C2 - 4);
          for (let i = 0; i < 14; i++) { g.fillStyle = R() < .5 ? `rgba(0,0,0,${R() * .12})` : `rgba(255,255,240,${R() * .12})`; g.beginPath(); g.ellipse(x + 3 + R() * (C2 - 6), y + 3 + R() * (C2 - 6), 1 + R() * 3, .6 + R() * 1.5, R() * 3, 0, TAU); g.fill(); }
          if (R() < .18) { g.fillStyle = 'rgba(0,0,0,.1)'; g.beginPath(); g.moveTo(x + 6 + R() * 10, y + 4); g.lineTo(x + 10 + R() * 10, y + 14 + R() * 10); g.lineTo(x + 12 + R() * 10, y + 28); g.strokeStyle = 'rgba(40,35,30,.3)'; g.lineWidth = .8; g.stroke(); }
        }
      }
      blotches(g, R, 'rgba(90,120,50,A)', 6, 6, 14, .18);
      tex[name] = c;
    }
    /* red roof tiles in overlapping rows */
    { const c = canvas(), g = c.getContext('2d'), R = mulberry32(11); g.fillStyle = '#7a2a20'; g.fillRect(0, 0, S, S);
      const rows = 12, th = S / rows, tw = 16;
      wrapDraw(g, () => { for (let r = 0; r < rows; r++) { const off = (r % 2) * tw / 2; for (let k = -1; k < S / tw + 1; k++) { const x = k * tw + off, y = r * th, v = R(); g.fillStyle = `rgb(${165 + v * 40 | 0},${70 + v * 25 | 0},${50 + v * 15 | 0})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + tw, y); g.lineTo(x + tw, y + th + 3); g.arc(x + tw / 2, y + th + 3, tw / 2, 0, Math.PI); g.lineTo(x, y); g.fill(); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y + th + 1, tw, 2.5); g.fillStyle = 'rgba(255,230,200,.16)'; g.fillRect(x + 2, y + 2, tw - 4, 1.5); } } });
      blotches(g, R, 'rgba(40,20,10,A)', 30, 1, 3, .25); blotches(g, R, 'rgba(120,140,60,A)', 5, 3, 7, .2);
      tex.tiles = c; }
    /* planks and beams */
    for (const [name, base, dark] of [['plank', '#8a5a30', '#5a361a'], ['beam', '#5e3a1c', '#3a2210']]) {
      const c = canvas(), g = c.getContext('2d'), R = mulberry32(name === 'plank' ? 5 : 9);
      noiseFill(g, R, base, .1, 800);
      const n = name === 'plank' ? 5 : 3;
      for (let r = 0; r < n; r++) { const y = r * S / n; g.fillStyle = `rgba(0,0,0,.28)`; g.fillRect(0, y, S, 2); g.fillStyle = 'rgba(255,220,170,.14)'; g.fillRect(0, y + 2, S, 1.5); for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(40,20,5,${.12 + R() * .18})`; g.lineWidth = .8 + R(); g.beginPath(); const yy = y + 4 + R() * (S / n - 6); g.moveTo(0, yy); for (let x = 0; x <= S; x += 16) g.lineTo(x, yy + Math.sin(x * .05 + k) * 1.5); g.stroke(); } if (R() < .7) { g.fillStyle = 'rgba(30,15,5,.4)'; g.beginPath(); g.ellipse(R() * S, y + S / n / 2, 2.5, 1.6, 0, 0, TAU); g.fill(); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(((r * 53) % S), y, 1.5, S / n); }
      tex[name] = c;
    }
    /* plaster for the stairwells and interior walls */
    { const c = canvas(), g = c.getContext('2d'), R = mulberry32(13); noiseFill(g, R, '#d8ccb0', .07, 1800); blotches(g, R, 'rgba(120,100,70,A)', 24, 4, 12, .08); tex.plaster = c; }
    /* earth with pebbles, and grass with blades */
    { const c = canvas(), g = c.getContext('2d'), R = mulberry32(17); noiseFill(g, R, '#5c4028', .16, 2200); blotches(g, R, 'rgba(0,0,0,A)', 30, 2, 5, .25); blotches(g, R, 'rgba(160,140,110,A)', 24, 1.5, 3.5, .35); tex.earth = c; }
    { const c = canvas(), g = c.getContext('2d'), R = mulberry32(19); noiseFill(g, R, '#4e9436', .12, 1200); for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${40 + R() * 60 | 0},${110 + R() * 70 | 0},${30 + R() * 30 | 0},.85)`; g.lineWidth = 1.2; const x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y + 3); g.lineTo(x + (R() - .5) * 3, y - 2 - R() * 4); g.stroke(); } tex.grass = c; }
  }

  function on() { return enabled && typeof GFX !== 'undefined' && GFX.active(); }
  function setEnabled(v) { enabled = v; }
  /* a repeating pattern for the current canvas (patterns are per context) */
  function pattern(name) {
    if (!baked) bake();
    const c = tex[name]; if (!c || !ctxFor) return null;
    const key = name; let p = pats.get(key);
    if (!p) { p = ctxFor.createPattern(c, 'repeat'); pats.set(key, p); }
    return p;
  }
  function useContext(ctx) { if (ctx !== ctxFor) { ctxFor = ctx; pats.clear(); } }
  function texture(name) { if (!baked) bake(); return tex[name]; }

  return { bake, on, setEnabled, pattern, useContext, texture };
})();
