/* ============================================================
   scene.js — the town: sky, hills, the street, the neighbours'
   houses, the lived-in house with its scaffold and drainpipes,
   the things to fix, the folk at the windows, the crane, and the
   new buildings that go up where an old one came down.
   ============================================================ */
'use strict';

const Scene = {
  sky(ctx, W, H, key, camX, t, flash) {
    const S = SKIES[key] || SKIES.noon;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, S.top); g.addColorStop(.55, S.mid); g.addColorStop(1, S.low);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const sx = W * .78 - camX * .02, sy = H * (S.night ? .16 : key === 'sunset' ? .42 : .18);
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90); sg.addColorStop(0, S.sun); sg.addColorStop(.3, withAlpha(S.sun, .5)); sg.addColorStop(1, withAlpha(S.sun, 0));
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 90, 0, TAU); ctx.fill();
    ctx.fillStyle = S.sun; ctx.beginPath(); ctx.arc(sx, sy, S.night ? 22 : 30, 0, TAU); ctx.fill();
    if (S.night) { ctx.fillStyle = S.top; ctx.beginPath(); ctx.arc(sx + 10, sy - 6, 20, 0, TAU); ctx.fill(); }
    /* clouds drift */
    for (let k = 0; k < 7; k++) {
      const cw = 90 + Sprites.hash(k, 3) * 110, x = ((Sprites.hash(k, 1) * (W + 400) + t * (6 + k * 2) - camX * .08) % (W + 400) + W + 400) % (W + 400) - 200, y = H * (.08 + Sprites.hash(k, 2) * .3);
      ctx.fillStyle = S.night ? 'rgba(60,70,100,.75)' : 'rgba(255,255,255,.85)';
      for (let b = 0; b < 4; b++) { ctx.beginPath(); ctx.arc(x + b * cw / 4, y - Math.sin(b * 1.7) * 10, cw / 5 + b % 2 * 6, 0, TAU); ctx.fill(); }
    }
    if (flash > 0) { ctx.fillStyle = `rgba(230,240,255,${flash * .7})`; ctx.fillRect(0, 0, W, H); }
  },
  hills(ctx, W, H, key, cam) {
    const S = SKIES[key] || SKIES.noon, base = cam.toScreen(0, GROUND_Y)[1];
    for (let k = 0; k < 3; k++) {
      const par = .15 + k * .15, off = cam.x * par;
      ctx.fillStyle = S.hill[k]; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 20) {
        const wx = x + off;
        let y = base - 150 + k * 45 - Math.sin(wx * .004 + k) * 40 - Math.sin(wx * .011 + k * 3) * 16;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      if (k === 1) for (let x = -((off) % 140); x < W + 140; x += 140) { const wx = x + off, y = base - 105 - Math.sin(wx * .004 + 1) * 40 - Math.sin(wx * .011 + 3) * 16; this.roofline(ctx, x, y, Sprites.hash(Math.floor(wx / 140), 5), S); }
    }
  },
  roofline(ctx, x, y, h, S) {
    ctx.fillStyle = shade(S.hill[2], .8); const w = 26 + h * 20, hh = 20 + h * 24;
    ctx.fillRect(x, y - hh, w, hh + 30); ctx.beginPath(); ctx.moveTo(x - 4, y - hh); ctx.lineTo(x + w / 2, y - hh - 14); ctx.lineTo(x + w + 4, y - hh); ctx.fill();
    if (S.night) { ctx.fillStyle = 'rgba(255,220,130,.8)'; ctx.fillRect(x + 6, y - hh + 8, 5, 6); }
  },
  street(ctx, L, view) {
    const x0 = view.l - 50, x1 = view.r + 50, night = (SKIES[L.def.tod] || {}).night;
    ctx.fillStyle = night ? '#4a5a4a' : '#7ab85a'; ctx.fillRect(x0, GROUND_Y - 6, x1 - x0, 12);
    ctx.fillStyle = night ? '#6a6a72' : '#c8c0b0'; ctx.fillRect(x0, GROUND_Y + 4, x1 - x0, 26);
    ctx.fillStyle = night ? '#5a5a62' : '#b0a898'; for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) ctx.fillRect(x, GROUND_Y + 4, 2, 26);
    ctx.fillStyle = night ? '#8a8a90' : '#e8e2d4'; ctx.fillRect(x0, GROUND_Y + 30, x1 - x0, 6);
    ctx.fillStyle = night ? '#2a2c34' : '#5a5c64'; ctx.fillRect(x0, GROUND_Y + 36, x1 - x0, 400);
    ctx.fillStyle = night ? '#8a8a6a' : '#f0e8c0'; for (let x = Math.floor(x0 / 160) * 160; x < x1; x += 160) ctx.fillRect(x, GROUND_Y + 80, 70, 6);
  },
  lamp(ctx, x, night) {
    ctx.fillStyle = '#3a4a4a'; ctx.fillRect(x - 3, GROUND_Y - 150, 6, 152); ctx.beginPath(); ctx.arc(x + 12, GROUND_Y - 150, 12, Math.PI, TAU); ctx.fillRect(x, GROUND_Y - 154, 14, 5); ctx.fill();
    ctx.fillStyle = night ? '#fff0a0' : '#f6efd0'; ctx.beginPath(); ctx.arc(x + 12, GROUND_Y - 146, 6, 0, TAU); ctx.fill();
    if (night) { const g = ctx.createRadialGradient(x + 12, GROUND_Y - 140, 4, x + 12, GROUND_Y - 120, 110); g.addColorStop(0, 'rgba(255,230,140,.35)'); g.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 12, GROUND_Y - 120, 110, 0, TAU); ctx.fill(); }
  },
  tree(ctx, x, s, t, night) {
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 10 * s, GROUND_Y - 120 * s, 20 * s, 122 * s);
    const sway = Math.sin(t * .8) * 4;
    for (const [dx, dy, r, c] of [[-40, -150, 48, 0], [30, -160, 52, 1], [-5, -200, 56, 2], [0, -130, 44, 1]]) {
      ctx.fillStyle = night ? ['#1e3a2a', '#244232', '#2a4a36'][c] : ['#4a8a3a', '#5a9a44', '#6aaa4a'][c];
      ctx.beginPath(); ctx.arc(x + (dx + sway) * s, GROUND_Y + dy * s, r * s, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = night ? 'rgba(80,120,90,.4)' : 'rgba(200,240,150,.35)'; ctx.beginPath(); ctx.arc(x + (-20 + sway) * s, GROUND_Y - 215 * s, 22 * s, 0, TAU); ctx.fill();
  },
  /* a neighbour's house: decorative, with a garden, a fence and flowers */
  neighbour(ctx, x, w, storeys, seed, night, dusty) {
    const cols = ['#f2d7a6', '#a8cfe8', '#f6c8c8', '#c8e8c0', '#e8d0f0', '#f0e0a0'], col = cols[seed % cols.length], h = storeys * 3 * CELL - 20;
    const y0 = GROUND_Y - h;
    ctx.fillStyle = shade(col, night ? .55 : 1); ctx.fillRect(x, y0, w, h);
    ctx.fillStyle = shade(col, night ? .45 : .85); ctx.fillRect(x, y0, w, 6);
    ctx.fillStyle = night ? '#3a2a3a' : ['#a8553a', '#4a5a7a', '#7a3a3a'][seed % 3];
    ctx.beginPath(); ctx.moveTo(x - 12, y0 + 2); ctx.lineTo(x + w / 2, y0 - 70); ctx.lineTo(x + w + 12, y0 + 2); ctx.closePath(); ctx.fill();
    for (let s = 0; s < storeys; s++) for (let k = 0; k < Math.floor(w / 70); k++) {
      const wx = x + 22 + k * 70, wy = GROUND_Y - (s * 3 + 2.2) * CELL;
      ctx.fillStyle = night ? (Sprites.hash(seed + k, s) > .4 ? '#ffd880' : '#2a3040') : '#bfe0f4'; ctx.fillRect(wx, wy, 30, 36);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.strokeRect(wx, wy, 30, 36); ctx.beginPath(); ctx.moveTo(wx + 15, wy); ctx.lineTo(wx + 15, wy + 36); ctx.stroke();
    }
    ctx.fillStyle = '#7a4a2a'; rr(ctx, x + w / 2 - 14, GROUND_Y - 64, 28, 64, 4); ctx.fill();
    ctx.fillStyle = '#f6efe0'; for (let fx = x - 20; fx < x + w + 20; fx += 12) ctx.fillRect(fx, GROUND_Y - 24, 7, 24);
    ctx.fillRect(x - 20, GROUND_Y - 18, w + 40, 4);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = ['#ff6a8a', '#ffd24a', '#a070e0'][k % 3]; ctx.beginPath(); ctx.arc(x - 10 + k * (w + 20) / 6, GROUND_Y - 30, 5, 0, TAU); ctx.fill(); }
    if (dusty > 0) { ctx.fillStyle = `rgba(150,120,90,${Math.min(.45, dusty * .02)})`; ctx.fillRect(x - 20, y0 - 20, w + 40, h + 20); }
  },

  /* ---------- the lived-in house ---------- */
  house(ctx, L, t) {
    const H = L.house, d = L.def, x0 = H.x0 * CELL, w = H.w * CELL, top = H.topY, night = (SKIES[d.tod] || {}).night;
    const wall = shade(d.color, night ? .62 : 1), trim = d.trim;
    ctx.fillStyle = wall; ctx.fillRect(x0, top, w, GROUND_Y - top);
    for (let s = 1; s < H.storeys; s++) { ctx.fillStyle = shade(d.color, night ? .5 : .86); ctx.fillRect(x0, L.floorY(s) - 4, w, 8); }
    /* the roof */
    const rh = 3 * CELL;
    ctx.fillStyle = shade(d.roofColor, night ? .7 : 1); ctx.beginPath(); ctx.moveTo(x0 - 16, top); ctx.lineTo(x0 + 34, top - rh); ctx.lineTo(x0 + w - 34, top - rh); ctx.lineTo(x0 + w + 16, top); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(d.roofColor, .7); ctx.lineWidth = 2;
    for (let k = 1; k < 6; k++) { const yy = top - k * rh / 6; ctx.beginPath(); ctx.moveTo(x0 - 16 + k * 50 / 6, yy); ctx.lineTo(x0 + w + 16 - k * 50 / 6, yy); ctx.stroke(); }
    ctx.fillStyle = shade(d.roofColor, .8); ctx.fillRect(x0 + w - 90, top - rh - 30, 34, 40);
    ctx.fillStyle = '#7a4a3a'; ctx.fillRect(x0 + w - 94, top - rh - 36, 42, 8);
    /* windows: the ones on the to-fix list, plus homely ones elsewhere */
    const isFix = new Set(H.fixes.filter(f => f.t === 'window' || f.t === 'shutter').map(f => f.c + ':' + f.s));
    for (let s = 0; s < H.storeys; s++) for (let c = H.x0 + 1; c < H.x0 + H.w - 1; c++) {
      const rel = c - H.x0, here = isFix.has(c + ':' + s), deco = (rel % 3 === 2) && !d.ladders.includes(rel);
      if (!here && !deco) continue;
      this.window(ctx, (c + .5) * CELL, L.floorY(s) - 1.5 * CELL, trim, night, H.folk.find(p => p.c === rel && p.s === s), t);
    }
    /* front door */
    const dx = x0 + Math.floor(H.w / 2) * CELL - (d.ladders.includes(Math.floor(H.w / 2)) ? CELL : 0);
    ctx.fillStyle = shade(trim, .9); rr(ctx, dx + 6, GROUND_Y - 72, 28, 72, 6); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(dx + 28, GROUND_Y - 36, 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = night ? 'rgba(255,220,120,.9)' : '#f6e8a0'; ctx.beginPath(); ctx.arc(dx + 20, GROUND_Y - 82, 6, 0, TAU); ctx.fill();
  },
  window(ctx, cx, cy, trim, night, folk, t) {
    const w = 30, h = 38, x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = night ? '#ffd27a' : '#cfe8f8'; ctx.fillRect(x, y, w, h);
    if (folk) this.folk(ctx, cx, y + h, folk.who, t);
    ctx.fillStyle = night ? 'rgba(255,200,120,.25)' : 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#e86a6a'; ctx.fillRect(x, y, 6, h); ctx.fillRect(x + w - 6, y, 6, h);
    ctx.strokeStyle = trim; ctx.lineWidth = 3.5; ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke();
    ctx.fillStyle = '#8a5a3a'; ctx.fillRect(x - 4, y + h, w + 8, 6);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = ['#ff6a8a', '#ffd24a', '#a070e0', '#6ac0ff'][k]; ctx.beginPath(); ctx.arc(x + 3 + k * 8, y + h - 1, 3.4, 0, TAU); ctx.fill(); }
  },
  folk(ctx, cx, by, who, t) {
    const b = Math.sin(t * 2 + cx) * 1.5;
    ctx.save(); ctx.translate(cx, by - 4 + b);
    if (who === 'dog') { ctx.fillStyle = '#c89a5a'; ctx.beginPath(); ctx.arc(0, -10, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.ellipse(-7, -11, 3, 6, .3, 0, TAU); ctx.ellipse(7, -11, 3, 6, -.3, 0, TAU); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, -7, 2, 0, TAU); ctx.fill(); }
    else if (who === 'cat') { ctx.fillStyle = '#7a7a8a'; ctx.beginPath(); ctx.arc(0, -9, 7, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6, -13); ctx.lineTo(-5, -19); ctx.lineTo(-1, -15); ctx.moveTo(6, -13); ctx.lineTo(5, -19); ctx.lineTo(1, -15); ctx.fill(); }
    else {
      const hair = { granny: '#e8e8f0', dad: '#5a3a1a', kid: '#e8a03a', baby: '#f0c890' }[who] || '#5a3a1a';
      const r = who === 'baby' ? 6 : 8, shirt = { granny: '#a070c0', dad: '#3a8a6a', kid: '#e84a4a', baby: '#8ad0f0' }[who] || '#888';
      ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(0, -2, r + 4, 7, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#f2c09a'; ctx.beginPath(); ctx.arc(0, -8 - r, r, 0, TAU); ctx.fill();
      ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -10 - r, r, Math.PI, TAU); ctx.fill(); if (who === 'granny') { ctx.beginPath(); ctx.arc(0, -10 - r * 2, 4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-3, -8 - r, 1.2, 0, TAU); ctx.arc(3, -8 - r, 1.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -6 - r, 2.5, .3, Math.PI - .3); ctx.stroke();
      if (who === 'granny') { ctx.fillStyle = '#fff'; ctx.fillRect(r + 1, -10, 6, 6); }
    }
    ctx.restore();
  }
};
