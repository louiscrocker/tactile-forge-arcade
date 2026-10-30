/* ============================================================
   sprites.js — all the art, drawn by code (no image files).
   A painted-cartoon look: soft gradients, warm outlines, round
   shapes.  Blocks are painted once into small canvases and
   reused.  Characters are drawn each frame from their state,
   origin at the feet, +y down.
   ============================================================ */
'use strict';

const INK = '#3a2418';
/* is the painted look on? (paint.js + gfx.js; false in smoke and the classic look) */
const painted = () => typeof Painted !== 'undefined' && Painted.on();
const Sprites = {
  cache: new Map(),
  hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },

  /* ---------- the old building's blocks ---------- */
  block(code, variant) {
    const key = code + ':' + variant;
    if (this.cache.has(key)) return this.cache.get(key);
    const S = 2, cv = this.canvas(CELL * S, CELL * S), g = cv.getContext('2d');
    g.scale(S, S);
    const m = matOf(code), v = this.hash(code, variant) - .5;
    const base = shade(m.color, 1 + v * .16);
    if (m.key === 'steel') this.paintSteel(g, base, variant);
    else if (m.key === 'stone') this.paintStone(g, base, variant);
    else { this.paintBricks(g, m.key === 'crumbly' ? shade('#b88a5a', 1 + v * .2) : shade('#c4643e', 1 + v * .14), variant, m.key === 'crumbly'); }
    if (m.key === 'window' || m.key === 'nest' || m.key === 'catnap') this.paintWindow(g, m.key);
    if (m.key === 'bell') this.paintBell(g);
    this.cache.set(key, cv);
    return cv;
  },
  paintBricks(g, col, variant, crumbly) {
    g.fillStyle = '#8a6a52'; g.fillRect(0, 0, CELL, CELL);
    for (let row = 0; row < 3; row++) {
      const y = row * 13.4, off = (row + variant) % 2 ? -10 : 0;
      for (let x = off; x < CELL; x += 20) {
        const t = this.hash(variant * 7 + row, x + 50) - .5;
        g.fillStyle = shade(col, 1 + t * .25);
        const bx = x + 1.2, bw = 17.6, by = y + 1.2, bh = 11;
        if (crumbly && t > .3) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw - 5, by); g.lineTo(bx + bw, by + 5); g.lineTo(bx + bw, by + bh); g.lineTo(bx, by + bh); g.fill(); }
        else g.fillRect(bx, by, bw, bh);
        g.fillStyle = 'rgba(255,240,210,.22)'; g.fillRect(bx, by, bw, 2.2);
        g.fillStyle = 'rgba(60,20,10,.18)'; g.fillRect(bx, by + bh - 2, bw, 2);
      }
    }
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, CELL, 3);
    g.fillStyle = 'rgba(40,20,10,.16)'; g.fillRect(0, CELL - 3, CELL, 3);
  },
  paintStone(g, col, variant) {
    g.fillStyle = shade(col, .7); g.fillRect(0, 0, CELL, CELL);
    const split = variant % 2 ? 22 : 18;
    for (const [x, y, w, h] of [[1, 1, split - 2, 18], [split + 1, 1, CELL - split - 2, 18], [1, 21, CELL - 2, 18]]) {
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, shade(col, 1.12)); gr.addColorStop(1, shade(col, .9));
      g.fillStyle = gr; rr(g, x, y, w, h, 3); g.fill();
    }
    for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(80,70,60,${.12 + this.hash(variant, k) * .15})`; g.fillRect(this.hash(k, variant) * 36 + 2, this.hash(variant + 3, k) * 36 + 2, 2, 2); }
  },
  paintSteel(g, col, variant) {
    const gr = g.createLinearGradient(0, 0, CELL, CELL); gr.addColorStop(0, shade(col, 1.25)); gr.addColorStop(.5, col); gr.addColorStop(1, shade(col, .8));
    g.fillStyle = gr; g.fillRect(0, 0, CELL, CELL);
    g.strokeStyle = shade(col, .6); g.lineWidth = 2; g.strokeRect(1, 1, CELL - 2, CELL - 2);
    g.fillStyle = shade(col, .55); g.fillRect(0, 17, CELL, 6);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 17, CELL, 1.5);
    for (const [x, y] of [[6, 6], [34, 6], [6, 34], [34, 34]]) { g.fillStyle = shade(col, .5); g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - .8, y - .8, 1, 0, TAU); g.fill(); }
  },
  paintWindow(g, kind) {
    g.fillStyle = '#e8dcc0'; rr(g, 5, 4, 30, 32, 3); g.fill();
    g.fillStyle = '#2a2230'; g.fillRect(8, 7, 24, 26);
    if (kind === 'window') {
      /* boarded up: the building is empty */
      g.save(); g.translate(20, 20);
      for (const a of [-.5, .45]) { g.save(); g.rotate(a); g.fillStyle = '#b08850'; g.fillRect(-17, -4, 34, 8); g.fillStyle = 'rgba(255,230,180,.35)'; g.fillRect(-17, -4, 34, 2); g.fillStyle = '#4a3020'; g.fillRect(-14, -1, 2, 2); g.fillRect(12, -1, 2, 2); g.restore(); }
      g.restore();
    } else if (kind === 'nest') {
      g.fillStyle = '#8a6a3a'; g.beginPath(); g.ellipse(20, 30, 11, 4, 0, 0, TAU); g.fill();
      g.strokeStyle = '#6a4a2a'; g.lineWidth = 1; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(10 + k * 3.5, 28); g.lineTo(13 + k * 3, 33); g.stroke(); }
      this.pigeon(g, 20, 26, 1, 0, true);
    } else {
      g.fillStyle = '#e89a4a'; g.beginPath(); g.ellipse(20, 27, 11, 6, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(13, 24, 5, 0, TAU); g.fill();
      g.fillStyle = '#c87a3a'; g.beginPath(); g.moveTo(10, 20); g.lineTo(11, 15); g.lineTo(14, 19); g.fill(); g.beginPath(); g.moveTo(15, 19); g.lineTo(17, 15); g.lineTo(18, 20); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.arc(11.5, 24, 1.3, .2, Math.PI - .2); g.stroke(); g.beginPath(); g.arc(15, 24, 1.3, .2, Math.PI - .2); g.stroke();
      g.strokeStyle = '#c87a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, 28); g.quadraticCurveTo(34, 20, 29, 16); g.stroke();
      g.fillStyle = '#ffffff'; g.font = `900 7px ${UI_FONT}`; g.fillText('z', 24, 14); g.font = `900 5px ${UI_FONT}`; g.fillText('z', 29, 10);
    }
    g.strokeStyle = 'rgba(40,20,10,.5)'; g.lineWidth = 1.2; g.strokeRect(8, 7, 24, 26);
  },
  paintBell(g) {
    g.fillStyle = '#4a3a3a'; g.fillRect(0, 0, CELL, CELL);
    const gr = g.createLinearGradient(8, 0, 32, 0); gr.addColorStop(0, '#9a6a20'); gr.addColorStop(.4, '#f0c860'); gr.addColorStop(1, '#8a5a18');
    g.fillStyle = gr; g.beginPath(); g.moveTo(20, 6); g.bezierCurveTo(30, 6, 28, 22, 34, 32); g.lineTo(6, 32); g.bezierCurveTo(12, 22, 10, 6, 20, 6); g.fill();
    g.fillStyle = '#6a4a18'; g.beginPath(); g.arc(20, 34, 3, 0, TAU); g.fill();
  },
  /* cracks on a block that has been hit but not broken */
  cracks(ctx, x, y, frac, seed) {
    ctx.strokeStyle = 'rgba(30,15,8,.75)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    const n = frac < .5 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      let px = x + 8 + this.hash(seed, k) * 24, py = y + 3; ctx.beginPath(); ctx.moveTo(px, py);
      for (let s = 0; s < 4; s++) { px += (this.hash(seed + s, k + 9) - .5) * 14; py += 8; ctx.lineTo(px, py); }
      ctx.stroke();
    }
  },

  /* ---------- a pigeon (used in windows, on roofs, flying) ---------- */
  pigeon(g, x, y, s, flap, sitting) {
    g.save(); g.translate(x, y); g.scale(s, Math.abs(s));
    g.fillStyle = '#8a94a8'; g.beginPath(); g.ellipse(0, 0, 8, 5.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#9aa4b8'; g.beginPath(); g.arc(-6, -4, 4, 0, TAU); g.fill();
    g.fillStyle = '#6aa08a'; g.beginPath(); g.ellipse(-5, -1, 3, 2, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8a040'; g.beginPath(); g.moveTo(-10, -4); g.lineTo(-13, -3); g.lineTo(-10, -2.5); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(-7, -5, .9, 0, TAU); g.fill();
    if (!sitting) { g.fillStyle = '#7a849a'; g.beginPath(); g.ellipse(2, -3 - Math.sin(flap) * 5, 7, 3, -.3 - Math.sin(flap) * .6, 0, TAU); g.fill(); }
    g.fillStyle = '#6a7488'; g.beginPath(); g.moveTo(7, 0); g.lineTo(12, -2); g.lineTo(12, 2); g.fill();
    g.restore();
  }
};
