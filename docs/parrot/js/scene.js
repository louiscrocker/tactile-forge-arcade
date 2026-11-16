/* ============================================================
   scene.js — the rainforest, painted from the same shapes you fly through
   ============================================================
   back      a row of far trunks and crowns, so it is a forest
   objects   the river · the clay cliff · every tree: trunk,
             buttresses, branches (the Lines you sit on), crown ·
             the hollows (a cutaway shows who is inside) · the box
   ground    the forest floor and its ferns
   front     a thin layer of leaves over the crowns, drawn after the
             birds: in the leaves you are hard to see
   Crowns are painted once into their own canvases and reused.
   ============================================================ */
'use strict';

const Scene = (function () {
  const bean = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
  const BARK = { iron: ['#6f5238', '#4a3524'], tree: ['#7a6048', '#544030'], fig: ['#8a7a66', '#5e5244'], kapok: ['#8f8672', '#625a4a'], palm: ['#8a7450', '#5e4e34'], dead: ['#9a8c78', '#6a5e4e'] };
  const LEAF = { iron: ['#1d4f2a', '#2c7036', '#479040', '#7cbc58'], tree: ['#21552a', '#33783a', '#4f9a46', '#86c460'], fig: ['#1f5a30', '#2f8040', '#52a44a', '#8fd06a'], kapok: ['#245a34', '#3a8444', '#5ca654', '#98d274'] };
  const crownCache = new Map();
  const S = 1.5;
  /* a crown, painted once: 0 = the body of leaves, 1 = the thin front layer */
  function crown(t, layer) {
    const id = t.key + layer; let c = crownCache.get(id); if (c) return c;
    const r = t.crown[2], w = Math.ceil((r * 2 + 80) * S), h = Math.ceil((r * 1.7 + 80) * S), R = mulberry32(t.x * 7 + layer * 13 + 5), cols = LEAF[t.kind] || LEAF.tree;
    c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.scale(S, S); g.translate(r + 40, r * .85 + 40);
    const blob = (n, col, rmin, rmax, spread, lift) => { g.fillStyle = col; for (let k = 0; k < n; k++) { const a = R() * TAU, d = Math.sqrt(R()) * spread, x = Math.cos(a) * d * r, y = Math.sin(a) * d * r * .72 - lift * r; bean(g, x, y, r * (rmin + R() * (rmax - rmin)), r * (rmin + R() * (rmax - rmin)) * .7, R() * 3); } };
    if (layer === 0) {
      blob(26, cols[0], .2, .34, .86, 0); blob(34, cols[1], .13, .24, .9, .05); blob(44, cols[2], .07, .15, .92, .12); blob(30, cols[3], .03, .07, .8, .3);
      /* single leaves round the rim */
      for (let k = 0; k < 60; k++) { const a = R() * TAU, x = Math.cos(a) * r * .96, y = Math.sin(a) * r * .7; g.save(); g.translate(x, y); g.rotate(a + R() - .5); Sprites.drawLeaf(g, 7 + R() * 6, 0, cols[1 + ((R() * 3) | 0)]); g.restore(); }
      if (t.kind === 'iron') { g.fillStyle = '#e88ac0'; for (let k = 0; k < 40; k++) { const a = R() * TAU, d = Math.sqrt(R()) * .8; bean(g, Math.cos(a) * d * r, Math.sin(a) * d * r * .6 - r * .2, 2.4, 2.4); } }
      if (t.kind === 'fig') { g.fillStyle = '#8a4a9a'; for (let k = 0; k < 30; k++) { const a = R() * TAU, d = Math.sqrt(R()) * .85; bean(g, Math.cos(a) * d * r, Math.sin(a) * d * r * .65, 3, 3.4); } }
    } else { for (let k = 0; k < 16; k++) { const a = R() * TAU, d = (.45 + .55 * Math.sqrt(R())) * .92, x = Math.cos(a) * d * r, y = Math.sin(a) * d * r * .7; g.save(); g.translate(x, y); g.rotate(R() * 6); Sprites.drawLeaf(g, 9 + R() * 9, 0, cols[1 + ((R() * 3) | 0)]); g.restore(); } }
    crownCache.set(id, c); return c;
  }
  function drawCrown(ctx, t, layer, alpha = 1) { const c = crown(t, layer), r = t.crown[2]; ctx.globalAlpha = alpha; ctx.drawImage(c, t.crown[0] - r - 40, t.crown[1] - r * .85 - 40, c.width / S, c.height / S); ctx.globalAlpha = 1; }

  /* half the width of a trunk at height y (y is negative: up) */
  const halfW = (t, y) => { const k = clamp(-y / t.h, 0, 1), flare = t.kind === 'kapok' || t.kind === 'iron' ? Math.pow(Math.max(0, 1 + y / 150), 2) * t.w * .7 : t.kind === 'palm' || t.kind === 'dead' ? 0 : Math.pow(Math.max(0, 1 + y / 80), 2) * t.w * .4; return t.w / 2 * (1 - k * (t.kind === 'palm' || t.kind === 'dead' ? .25 : .45)) + flare; };
  const lean = (t, y) => t.kind === 'palm' ? Math.sin(-y / t.h * 1.6) * 18 * (t.key === 'palm2' ? -1 : 1) - (t.key === 'palm2' ? -18 : 18) * Math.sin(1.6) * 0 : 0;
  function trunk(ctx, t) {
    const [c0, c1] = BARK[t.kind] || BARK.tree, top = -t.h;
    const g = ctx.createLinearGradient(t.x - t.w / 2, 0, t.x + t.w / 2, 0); g.addColorStop(0, c1); g.addColorStop(.35, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(t.x - halfW(t, 0), 4);
    for (let y = 0; y >= top; y -= 20) ctx.lineTo(t.x + lean(t, y) - halfW(t, y), y);
    ctx.lineTo(t.x + lean(t, top) - halfW(t, top), top); ctx.lineTo(t.x + lean(t, top) + halfW(t, top), top);
    for (let y = top; y <= 0; y += 20) ctx.lineTo(t.x + lean(t, y) + halfW(t, y), y);
    ctx.lineTo(t.x + halfW(t, 0), 4); ctx.closePath(); ctx.fill();
    /* bark */
    ctx.strokeStyle = 'rgba(30,20,10,.22)'; ctx.lineWidth = 1.6; const R = mulberry32(t.x | 0);
    if (t.kind === 'palm' || t.kind === 'dead') for (let y = -12; y > top; y -= 13) { ctx.beginPath(); ctx.moveTo(t.x + lean(t, y) - halfW(t, y), y); ctx.quadraticCurveTo(t.x + lean(t, y), y + 4, t.x + lean(t, y) + halfW(t, y), y); ctx.stroke(); }
    else for (let k = 0; k < 9; k++) { const u = R() * 1.6 - .8, y0 = -R() * t.h * .9, len = 40 + R() * 120; ctx.beginPath(); ctx.moveTo(t.x + u * halfW(t, y0), y0); ctx.quadraticCurveTo(t.x + u * halfW(t, y0) + 4, y0 - len / 2, t.x + u * halfW(t, y0 - len), y0 - len); ctx.stroke(); }
    /* moss and a liana */
    if (t.kind !== 'palm' && t.kind !== 'dead') { ctx.fillStyle = 'rgba(90,150,70,.35)'; for (let k = 0; k < 5; k++) { const y = -40 - R() * t.h * .7; bean(ctx, t.x - halfW(t, y) * .6, y, 7 + R() * 6, 16 + R() * 20); }
      ctx.strokeStyle = '#3f5a2a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(t.x + halfW(t, -t.h * .9) + 30, -t.h * .92); ctx.bezierCurveTo(t.x + t.w, -t.h * .6, t.x + t.w * .2, -t.h * .4, t.x + halfW(t, -60) + 8, -30); ctx.stroke(); }
  }
  function fronds(ctx, t, time) {
    const top = -t.h, x = t.x + lean(t, top), dead = t.kind === 'dead';
    if (dead) { ctx.fillStyle = '#2a1c12'; bean(ctx, x, top + 3, halfW(t, top) - 3, 5); return; }
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * .42 + Math.sin(time * .7 + k) * .03, L = 150 - Math.abs(k - 4) * 12, ex = x + Math.cos(a) * L, ey = top + Math.sin(a) * L + Math.abs(k - 4) * 16;
      ctx.strokeStyle = '#5a7a34'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, top); ctx.quadraticCurveTo(x + Math.cos(a) * L * .6, top + Math.sin(a) * L * .7, ex, ey); ctx.stroke();
      ctx.strokeStyle = k % 2 ? '#3f8a3a' : '#57a046'; ctx.lineWidth = 2.2;
      for (let j = 1; j <= 9; j++) { const u = j / 9.5, px = lerp(x, ex, u) + Math.cos(a) * L * .1 * Math.sin(u * 3), py = lerp(top, ey, u) + Math.sin(a) * L * .25 * Math.sin(u * 3); for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a + sgn * 1.25) * 26 * (1 - u * .5), py + Math.sin(a + sgn * 1.25) * 26 * (1 - u * .5) + 8); ctx.stroke(); } }
    }
  }
  /* a branch: from the trunk out along its Line, with twigs and leaves */
  function branch(ctx, L, t) {
    const [a, b] = L.pts, palm = t.kind === 'palm' || t.kind === 'dead', R = mulberry32((a[0] * 3 + a[1]) | 0);
    if (t.kind === 'dead') return;
    const near = Math.abs(a[0] - t.x) < Math.abs(b[0] - t.x) ? a : b, far = near === a ? b : a, rootX = t.x + lean(t, near[1]) + sign(far[0] - t.x) * halfW(t, near[1]) * .5;
    ctx.strokeStyle = palm ? '#7a8a44' : (BARK[t.kind] || BARK.tree)[0]; ctx.lineCap = 'round';
    ctx.lineWidth = palm ? 6 : 11; ctx.beginPath(); ctx.moveTo(rootX, near[1] + (palm ? 0 : 26)); ctx.quadraticCurveTo(near[0], near[1] + 6, (near[0] + far[0]) / 2, (near[1] + far[1]) / 2 + 4); ctx.stroke();
    ctx.lineWidth = palm ? 5 : 8; ctx.beginPath(); ctx.moveTo(near[0], near[1] + 4); ctx.lineTo(far[0], far[1] + 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,190,.5)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(a[0], a[1] + 1.5); ctx.lineTo(b[0], b[1] + 1.5); ctx.stroke();
    if (palm) return;
    const cols = LEAF[t.kind] || LEAF.tree, dir = sign(far[0] - near[0]);
    for (let k = 0; k < 5; k++) { const x = far[0] + dir * (6 + R() * 22), y = far[1] - 14 + R() * 30; ctx.save(); ctx.translate(x, y); ctx.rotate(R() * 6); Sprites.drawLeaf(ctx, 9 + R() * 6, 0, cols[1 + ((R() * 3) | 0)]); ctx.restore(); }
  }
  /* a hollow: the door, and a cutaway when it is yours (or your parents') */
  function hollow(ctx, G, h, time) {
    const p = G.player, mine = h.key === 'home' ? p.stage === 'egg' || p.stage === 'chick' || !G.started : p.flags.nest === h.key, [dx, dy] = h.door, [ix, iy] = h.inside;
    if (h.key === 'box') { ctx.fillStyle = '#c79a58'; rr(ctx, ix - 22, iy - 46, 44, 62, 3); ctx.fill(); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#a87a40'; ctx.fillRect(ix - 26, iy - 50, 52, 7); }
    if (mine || h.pop > 0) {
      ctx.fillStyle = '#2c1c10'; rr(ctx, ix - 30, iy - 42, 60, 52, 14); ctx.fill();
      const g = ctx.createRadialGradient(dx, dy, 4, ix, iy - 14, 46); g.addColorStop(0, 'rgba(255,214,150,.5)'); g.addColorStop(1, 'rgba(255,214,150,0)'); ctx.fillStyle = g; rr(ctx, ix - 30, iy - 42, 60, 52, 14); ctx.fill();
      ctx.fillStyle = '#7a5a34'; bean(ctx, ix, iy + 5, 28, 5); ctx.fillStyle = '#a88450'; for (let k = 0; k < 7; k++) bean(ctx, ix - 22 + k * 7.4, iy + 4 + (k % 2), 4, 1.6, k);
    }
    ctx.fillStyle = '#1c120a'; bean(ctx, dx - sign(dx - ix) * 3, dy, h.key === 'dead' ? 13 : 9, h.key === 'dead' ? 6 : 13);
    ctx.strokeStyle = 'rgba(255,230,180,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(dx - sign(dx - ix) * 3, dy, h.key === 'dead' ? 13 : 9, h.key === 'dead' ? 6 : 13, 0, 0, TAU); ctx.stroke();
    /* who is home, when you look in */
    if (h.pop > 0 && h.who !== 'free' && h.who !== 'home') {
      const k = Math.min(1, h.pop * 2), fx = sign(dx - ix) || 1;
      ctx.save(); ctx.translate(dx, dy + 6); ctx.globalAlpha = k;
      if (h.who === 'toucan') { ctx.scale(fx * .8, .8); ctx.translate(-10, 24); Critters.toucan(ctx, 1, time); }
      else if (h.who === 'pair') { ctx.scale(fx * .7, .7); ctx.translate(-8, 30); Sprites.drawParrot(ctx, { r: 16, open: true }); }
      else Critters.bees(ctx, time, 9, 30);
      ctx.restore();
    }
    if (h.who === 'bees' && h.seen) { ctx.save(); ctx.translate(dx, dy); Critters.bees(ctx, time, 4, 16); ctx.restore(); }
  }
  return { bean, crown, drawCrown, trunk, fronds, branch, hollow, halfW, BARK, LEAF };
})();
