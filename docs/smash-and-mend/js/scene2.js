/* ============================================================
   scene2.js — scaffold, drainpipes, the repairs, falling things,
   the crane, the wrecking ball, and the new buildings.
   ============================================================ */
'use strict';

Object.assign(Scene, {
  scaffold(ctx, L) {
    const H = L.house;
    for (let s = 1; s <= H.storeys; s++) {
      const y = L.floorY(s), x0 = (H.x0 - 1) * CELL, x1 = (H.x0 + H.w + 1) * CELL;
      ctx.fillStyle = '#8a9aa8'; for (let x = x0 + 4; x <= x1 - 4; x += CELL * 3) ctx.fillRect(x - 2, y, 4, L.floorY(s - 1) - y);
      ctx.fillStyle = '#c89a5a'; ctx.fillRect(x0, y, x1 - x0, 9);
      if (painted()) Painted.wood(ctx, x0, y, x1 - x0, 9);
      ctx.fillStyle = '#e8bf7a'; ctx.fillRect(x0, y, x1 - x0, 2.5);
      ctx.fillStyle = '#9a6a3a'; for (let x = x0; x < x1; x += 46) ctx.fillRect(x, y + 2, 1.5, 7);
      ctx.strokeStyle = '#8a9aa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y - 26); ctx.lineTo(x1, y - 26); ctx.stroke();
    }
  },
  pipes(ctx, L, t) {
    const H = L.house;
    for (const lc of L.def.ladders) {
      const x = (H.x0 + lc + .5) * CELL;
      ctx.fillStyle = '#5a6a7a'; ctx.fillRect(x - 6, H.topY - 6, 12, GROUND_Y - H.topY + 6);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x - 4, H.topY - 6, 3, GROUND_Y - H.topY + 6);
      ctx.fillStyle = '#4a5a6a'; for (let y = H.topY + 8; y < GROUND_Y; y += 24) { ctx.fillRect(x - 12, y, 24, 5); }
    }
  },
  fixable(ctx, f, L, t) {
    const x = f.x, y = f.y, broken = !f.fixed;
    ctx.save();
    if (f.t === 'window' && broken) {
      ctx.fillStyle = 'rgba(40,50,70,.55)'; ctx.fillRect(x - 15, y - 19, 30, 38);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(x - 4, y - 4); ctx.lineTo(x - 14, y - 16); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 12, y - 12); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 6, y + 16); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x - 13, y + 10); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + 4, y - 18); ctx.lineTo(x + 14, y - 18); ctx.lineTo(x + 14, y - 4); ctx.fill();
    } else if (f.t === 'shutter') {
      const swing = broken ? Math.sin(t * 5 + x) * .35 + .6 : 0;
      ctx.translate(x + 15, y - 19); ctx.rotate(swing);
      ctx.fillStyle = L.def.trim; ctx.fillRect(0, 0, 12, 38); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; for (let k = 6; k < 38; k += 6) { ctx.beginPath(); ctx.moveTo(1, k); ctx.lineTo(11, k); ctx.stroke(); }
      ctx.setTransform(ctx.getTransform()); ctx.restore(); ctx.save();
      if (!broken) { ctx.fillStyle = L.def.trim; ctx.fillRect(x - 27, y - 19, 12, 38); }
    } else if (f.t === 'pipe' && broken) {
      ctx.fillStyle = '#3a4a5a'; ctx.fillRect(x - 9, y - 3, 18, 6);
      for (let k = 0; k < 3; k++) { const p = ((t * 1.6 + k / 3) % 1); ctx.fillStyle = `rgba(110,180,255,${1 - p})`; ctx.beginPath(); ctx.arc(x + 9, y + 2 + p * 40, 3 - p, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(110,180,255,.8)'; ctx.beginPath(); ctx.ellipse(x + 12, y, 5, 3, 0, 0, TAU); ctx.fill();
    } else if (f.t === 'shingle' && broken) {
      ctx.fillStyle = '#2a2026'; ctx.fillRect(x - 16, y - 8, 32, 16);
      ctx.save(); ctx.translate(x + 8, y + 10); ctx.rotate(.5 + Math.sin(t * 6) * .1); ctx.fillStyle = shade(L.def.roofColor, 1.1); ctx.fillRect(-14, -6, 28, 12); ctx.restore();
    } else if (f.t === 'gutter') {
      ctx.translate(x, y); if (broken) ctx.rotate(.35 + Math.sin(t * 3) * .05);
      ctx.fillStyle = '#7a8a9a'; ctx.fillRect(-26, -4, 52, 8); ctx.fillStyle = '#5a6a7a'; ctx.fillRect(-26, 2, 52, 2);
      if (broken) { const p = (t * 1.3) % 1; ctx.fillStyle = `rgba(110,180,255,${1 - p})`; ctx.beginPath(); ctx.arc(24, 6 + p * 30, 3, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    /* a soft pulse ring says "fix me!"; a glint says "mended!" */
    if (broken) Render.glow(x, y, 50, [1, .85, .35], (SKIES[L.def.tod] || {}).night ? .9 : .3);
    if (broken) { const p = (t * 1.2 + x * .01) % 1; ctx.strokeStyle = `rgba(255,220,80,${.9 - p * .9})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 18 + p * 16, 0, TAU); ctx.stroke(); }
    if (f.glint > 0) { const a = Math.min(1, f.glint); ctx.fillStyle = `rgba(255,255,220,${a})`; for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2 + t * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * 26 * a, y + Math.sin(an) * 26 * a); ctx.lineTo(x + Math.cos(an + .3) * 8, y + Math.sin(an + .3) * 8); ctx.fill(); } }
    if (broken && f.taps > 0) { ctx.fillStyle = '#ffffff'; for (let k = 0; k < f.need; k++) { ctx.beginPath(); ctx.arc(x - (f.need - 1) * 6 + k * 12, y - 28, 4, 0, TAU); ctx.fillStyle = k < f.taps ? '#5ad06a' : 'rgba(255,255,255,.7)'; ctx.fill(); } }
  },
  thing(ctx, th) {
    ctx.save(); ctx.translate(th.x, th.y); ctx.rotate(th.rot); ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    const k = th.kind;
    if (k === 'acorn') { ctx.fillStyle = '#b8803a'; ctx.beginPath(); ctx.ellipse(0, 2, 6, 7, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.arc(0, -3, 7, Math.PI, TAU); ctx.fill(); ctx.fillRect(-1, -12, 2, 4); }
    else if (k === 'twig') { ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(2, 0); ctx.lineTo(7, -6); ctx.moveTo(-4, 0); ctx.lineTo(-8, 5); ctx.stroke(); ctx.fillStyle = '#6aaa4a'; ctx.beginPath(); ctx.ellipse(8, -7, 3, 1.6, -.6, 0, TAU); ctx.fill(); }
    else if (k === 'feather') { ctx.fillStyle = '#f0f4fa'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, .4, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a0a8b8'; ctx.beginPath(); ctx.moveTo(-3, 9); ctx.lineTo(3, -9); ctx.stroke(); }
    else if (k === 'pot') { ctx.fillStyle = '#d0703a'; ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(9, -4); ctx.lineTo(6, 10); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#5aaa4a'; ctx.beginPath(); ctx.arc(-3, -8, 5, 0, TAU); ctx.arc(4, -9, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff6a8a'; ctx.beginPath(); ctx.arc(0, -12, 3, 0, TAU); ctx.fill(); }
    else if (k === 'leafball') { for (let q = 0; q < 6; q++) { ctx.fillStyle = ['#d8902a', '#c0602a', '#e8c040'][q % 3]; ctx.beginPath(); ctx.ellipse(Math.cos(q) * 6, Math.sin(q * 2) * 6, 6, 3, q, 0, TAU); ctx.fill(); } }
    else if (k === 'bucket') Chars.bucket(ctx, 0, 4, '#8a9aa8');
    else if (k === 'paint') { ctx.fillStyle = '#e8e8f0'; rr(ctx, -8, -8, 16, 16, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = ['#3a8ad8', '#e84a6a', '#5ac04a'][(th.x | 0) % 3]; ctx.fillRect(-8, -8, 16, 5); ctx.beginPath(); ctx.arc(4, -3, 3, 0, Math.PI); ctx.fill(); }
    else if (k === 'bolt') { ctx.fillStyle = '#9aa4b0'; ctx.fillRect(-2.5, -8, 5, 14); ctx.fillRect(-6, -10, 12, 4); ctx.stroke(); }
    else if (k === 'sandbag') { ctx.fillStyle = '#d8c090'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#a89060'; ctx.fillRect(-2, -10, 4, 5); }
    ctx.restore();
  },
  /* where a thing will land: a dashed drop line and a little shadow (Easy and Normal) */
  marker(ctx, L, th) {
    const a = L.players.find(p => p.type === 'pip'); if (!a) return;
    const lx = L.landingX(th, a.y - a.h);
    ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.beginPath(); ctx.ellipse(lx, GROUND_Y, 10, 3, 0, 0, TAU); ctx.fill();
    for (let s = 1; s <= L.house.storeys; s++) { const fy = L.floorY(s); if (fy > th.y) { ctx.beginPath(); ctx.ellipse(lx, fy, 9, 2.5, 0, 0, TAU); ctx.fill(); } }
  },
  crane(ctx, L, t) {
    const C = L.crane, H = L.house, mastX = (H.x0 + H.w + 4) * CELL, top = H.topY - 6 * CELL;
    ctx.strokeStyle = '#e8a020'; ctx.lineWidth = 3;
    for (let y = GROUND_Y; y > top; y -= 30) { ctx.beginPath(); ctx.moveTo(mastX - 12, y); ctx.lineTo(mastX + 12, y - 30); ctx.moveTo(mastX + 12, y); ctx.lineTo(mastX - 12, y - 30); ctx.stroke(); }
    ctx.fillStyle = '#f0b030'; ctx.fillRect(mastX - 14, top, 4, GROUND_Y - top); ctx.fillRect(mastX + 10, top, 4, GROUND_Y - top);
    const jib0 = H.x0 * CELL - 60; ctx.fillRect(jib0, top - 10, mastX + 80 - jib0, 10);
    for (let x = jib0; x < mastX + 80; x += 24) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 12, top - 10); ctx.stroke(); }
    ctx.fillStyle = '#5a6a7a'; ctx.fillRect(mastX + 40, top - 4, 40, 26);
    ctx.fillStyle = '#3a8ad8'; rr(ctx, mastX - 26, top + 6, 30, 26, 4); ctx.fill(); ctx.fillStyle = '#bfe0f4'; ctx.fillRect(mastX - 22, top + 10, 14, 12);
    const hy = top + 40 + Math.sin(t * 2) * 4;
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(C.x, top); ctx.lineTo(C.x, hy); ctx.stroke();
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(C.x - 8, top - 2, 16, 8);
    ctx.strokeStyle = '#d8a020'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(C.x, hy + 8, 7, -Math.PI / 2, Math.PI * .8); ctx.stroke();
  },
  ball(ctx, L, t) {
    const B = L.ball, mast = B.ax + 70;
    ctx.fillStyle = '#e8a020'; ctx.fillRect(mast - 10, B.ay - 20, 20, GROUND_Y - B.ay + 20);
    ctx.strokeStyle = '#b87810'; ctx.lineWidth = 2; for (let y = GROUND_Y; y > B.ay; y -= 26) { ctx.beginPath(); ctx.moveTo(mast - 10, y); ctx.lineTo(mast + 10, y - 26); ctx.stroke(); }
    ctx.fillStyle = '#f0b030'; ctx.fillRect(B.ax - 30, B.ay - 24, mast - B.ax + 60, 12);
    ctx.fillStyle = '#3a8ad8'; rr(ctx, mast - 22, B.ay - 12, 34, 28, 5); ctx.fill(); ctx.fillStyle = '#bfe0f4'; ctx.fillRect(mast - 18, B.ay - 8, 16, 12);
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(B.ax, B.ay - 12); ctx.lineTo(B.x, B.y); ctx.stroke();
    const g = ctx.createRadialGradient(B.x - 12, B.y - 12, 4, B.x, B.y, B.r); g.addColorStop(0, '#8a9098'); g.addColorStop(1, '#2a2e34');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(B.x, B.y, B.r, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    if (!B.calm) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(B.x - 9, B.y - 4, 6, 0, TAU); ctx.arc(B.x + 9, B.y - 4, 6, 0, TAU); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(B.x - 8 + Math.sign(B.w) * 2, B.y - 4, 2.6, 0, TAU); ctx.arc(B.x + 10 + Math.sign(B.w) * 2, B.y - 4, 2.6, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(B.x, B.y + 10, 6, .2, Math.PI - .2); ctx.stroke(); }
  },
  /* a new building where an old one stood; p 0..1 grows it up from the street */
  newBuilding(ctx, style, x0, x1, p, night) {
    const w = x1 - x0, h = { bakery: 200, playground: 120, library: 260, garden: 80, pool: 60, firestation: 230, cinema: 240, school: 250 }[style] || 200;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 40, GROUND_Y - h * p - 80, w + 80, h * p + 80); ctx.clip();
    const y0 = GROUND_Y - h, dk = night ? .65 : 1;
    const box = (col, roof, label) => {
      ctx.fillStyle = shade(col, dk); ctx.fillRect(x0, y0, w, h); ctx.fillStyle = shade(roof, dk); ctx.fillRect(x0 - 8, y0 - 14, w + 16, 16);
      for (let x = x0 + 18; x < x1 - 40; x += 56) for (let y = y0 + 30; y < GROUND_Y - 70; y += 60) { ctx.fillStyle = night ? '#ffd880' : '#bfe0f4'; ctx.fillRect(x, y, 30, 34); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x, y, 30, 34); }
      ctx.fillStyle = shade(roof, dk); rr(ctx, x0 + w / 2 - 70, y0 + 6, 140, 26, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `900 16px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x0 + w / 2, y0 + 19);
      ctx.fillStyle = '#6a3a2a'; rr(ctx, x0 + w / 2 - 18, GROUND_Y - 60, 36, 60, 5); ctx.fill();
    };
    if (style === 'bakery') { box('#f6d8b0', '#d86a8a', 'BAKERY'); for (let x = x0; x < x1; x += 30) { ctx.fillStyle = (x / 30) % 2 ? '#ffffff' : '#e86a8a'; ctx.fillRect(x, y0 + 40, 30, 14); } }
    else if (style === 'library') box('#c8b8e0', '#5a4a8a', 'LIBRARY');
    else if (style === 'firestation') { box('#e86a5a', '#8a2a2a', 'FIRE STATION'); ctx.fillStyle = '#f6efe0'; ctx.fillRect(x0 + 20, GROUND_Y - 90, w - 40, 90); ctx.strokeStyle = '#c8c0b0'; for (let y = GROUND_Y - 80; y < GROUND_Y; y += 14) { ctx.beginPath(); ctx.moveTo(x0 + 20, y); ctx.lineTo(x1 - 20, y); ctx.stroke(); } }
    else if (style === 'cinema') { box('#3a3a6a', '#e8b040', 'CINEMA'); for (let x = x0 + 6; x < x1; x += 16) { ctx.fillStyle = '#ffe080'; ctx.beginPath(); ctx.arc(x, y0 + 40, 3, 0, TAU); ctx.fill(); } }
    else if (style === 'school') { box('#f0e0a0', '#3a7aa8', 'SCHOOL'); ctx.fillStyle = '#d8a020'; ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + 50, 14, 0, TAU); ctx.fill(); }
    else if (style === 'playground') {
      ctx.strokeStyle = '#d84a3a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0 + 20, GROUND_Y); ctx.lineTo(x0 + 50, GROUND_Y - 110); ctx.lineTo(x0 + 80, GROUND_Y); ctx.moveTo(x0 + 50, GROUND_Y - 110); ctx.lineTo(x0 + 150, GROUND_Y - 110); ctx.moveTo(x0 + 120, GROUND_Y); ctx.lineTo(x0 + 150, GROUND_Y - 110); ctx.lineTo(x0 + 180, GROUND_Y); ctx.stroke();
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; const sw = Math.sin(performance.now() / 500) * 12; for (const sx of [x0 + 80, x0 + 120]) { ctx.beginPath(); ctx.moveTo(sx, GROUND_Y - 110); ctx.lineTo(sx + sw, GROUND_Y - 30); ctx.stroke(); ctx.fillStyle = '#3a8ad8'; ctx.fillRect(sx + sw - 10, GROUND_Y - 32, 20, 5); }
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(x1 - 120, GROUND_Y - 100); ctx.lineTo(x1 - 20, GROUND_Y); ctx.lineTo(x1 - 40, GROUND_Y); ctx.lineTo(x1 - 130, GROUND_Y - 90); ctx.fill(); ctx.fillStyle = '#5ab04a'; ctx.fillRect(x1 - 140, GROUND_Y - 100, 12, 100);
    } else if (style === 'garden') {
      for (let k = 0; k < Math.floor(w / 18); k++) { const fx = x0 + 9 + k * 18, fh = 30 + Sprites.hash(k, 9) * 40; ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx, GROUND_Y); ctx.lineTo(fx, GROUND_Y - fh); ctx.stroke(); ctx.fillStyle = ['#ff6a8a', '#ffd24a', '#a070e0', '#ff9a3a'][k % 4]; ctx.beginPath(); ctx.arc(fx, GROUND_Y - fh, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(fx, GROUND_Y - fh, 3, 0, TAU); ctx.fill(); }
    } else if (style === 'pool') {
      ctx.fillStyle = '#e8e2d4'; rr(ctx, x0 + 10, GROUND_Y - 50, w - 20, 50, 10); ctx.fill(); ctx.fillStyle = '#5ac0f0'; rr(ctx, x0 + 20, GROUND_Y - 40, w - 40, 36, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; for (let x = x0 + 30; x < x1 - 40; x += 40) { ctx.beginPath(); ctx.arc(x, GROUND_Y - 24, 10, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(x0 + w / 2, GROUND_Y - 26, 14, 8, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
});
