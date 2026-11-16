/* ============================================================
   scene2.js — the layers of the forest, back to front
   ============================================================
   Scene.back     far trunks and crowns (dim), mist at the floor
   Scene.objects  the river, the clay cliff, the trees and hollows
   Scene.ground   the forest floor, ferns, leaf litter
   Scene.front    leaves over the birds, the river's near bank
   ============================================================ */
'use strict';

(function () {
  const bean = Scene.bean;
  const BACK = (function () { const R = mulberry32(99), a = []; for (let x = WORLD.left - 200; x < WORLD.right + 300; x += 120 + R() * 150) { if (x > WORLD.riverX0 - 60 && x < 1450) continue; a.push({ x, h: 380 + R() * 420, w: 20 + R() * 34, r: 90 + R() * 90, c: R() }); } return a; })();
  const FERNS = (function () { const R = mulberry32(41), a = []; for (let x = WORLD.left; x < WORLD.right; x += 30 + R() * 60) { if (x > WORLD.riverX0 - 30 && x < 1430) continue; a.push({ x, s: 14 + R() * 26, k: R() }); } return a; })();

  function back(ctx, G, view, night) {
    /* far trunks: flat, dim, bluish with distance */
    for (const b of BACK) {
      if (b.x + b.r < view.l || b.x - b.r > view.r) continue;
      const tc = mixHex('#7f9a8c', '#93ad9e', b.c), lc = mixHex('#6fa586', '#86b89a', b.c), lc2 = mixHex('#86b89a', '#a0cbb0', b.c);
      ctx.fillStyle = tc; ctx.beginPath(); ctx.moveTo(b.x - b.w * .7, 4); ctx.lineTo(b.x - b.w * .32, -b.h); ctx.lineTo(b.x + b.w * .32, -b.h); ctx.lineTo(b.x + b.w * .7, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lc; bean(ctx, b.x, -b.h - b.r * .2, b.r, b.r * .6); bean(ctx, b.x - b.r * .55, -b.h + b.r * .12, b.r * .6, b.r * .4); bean(ctx, b.x + b.r * .6, -b.h + b.r * .05, b.r * .55, b.r * .38);
      ctx.fillStyle = lc2; bean(ctx, b.x - b.r * .25, -b.h - b.r * .42, b.r * .5, b.r * .26); bean(ctx, b.x + b.r * .4, -b.h - b.r * .2, b.r * .34, b.r * .2);
    }
    /* the far bank of forest behind the cliff and the river */
    ctx.fillStyle = '#6f9f80'; ctx.beginPath(); ctx.moveTo(300, 0);
    for (let x = 300; x <= 1500; x += 40) ctx.lineTo(x, -150 - 60 * Math.sin(x * .013) - 40 * Math.sin(x * .041) - (x > 760 && x < 1420 ? 250 * Math.sin((x - 760) / 660 * Math.PI) : 0));
    ctx.lineTo(1500, 0); ctx.closePath(); ctx.fill();
    /* a veil of haze so the back row sits back */
    const g = ctx.createLinearGradient(0, -700, 0, 0); g.addColorStop(0, 'rgba(190,220,210,0)'); g.addColorStop(1, 'rgba(190,220,210,.38)');
    ctx.fillStyle = g; ctx.fillRect(view.l, -900, view.r - view.l, 904);
  }

  function river(ctx, G, view) {
    const t = G.time, x0 = WORLD.riverX0, x1 = WORLD.riverX1;
    const g = ctx.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#7fb8b0'); g.addColorStop(.3, '#4f8f96'); g.addColorStop(1, '#2f5f70');
    ctx.fillStyle = g; ctx.fillRect(x0 - 6, 0, x1 - x0 + 12, 160);
    /* the cliff, upside down in the water */
    ctx.fillStyle = 'rgba(200,110,70,.28)'; ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1 - 70, 60); ctx.lineTo(x1 - 150, 90); ctx.lineTo(x1, 110); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(235,250,255,.5)'; ctx.lineWidth = 2;
    for (let k = 0; k < 16; k++) { const y = 10 + (k * 37 % 120), x = x0 + ((k * 97 + t * (14 + k % 5 * 4)) % (x1 - x0 - 40)); ctx.globalAlpha = .25 + .5 * Math.abs(Math.sin(t + k)); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 12, y - 3, x + 26, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function cliff(ctx, G) {
    const T = TERRAIN, g = ctx.createLinearGradient(0, -340, 0, 20); g.addColorStop(0, '#d8845a'); g.addColorStop(.55, '#c8663e'); g.addColorStop(1, '#9c4a2c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(T[2][0], 30); for (let i = 2; i <= 11; i++) ctx.lineTo(T[i][0], T[i][1]); ctx.lineTo(T[11][0], 30); ctx.closePath(); ctx.fill();
    /* strata, and the pale scrapes where beaks have been */
    ctx.strokeStyle = 'rgba(110,40,20,.28)'; ctx.lineWidth = 3;
    for (const y of [-50, -150, -245]) { ctx.beginPath(); ctx.moveTo(groundXLeft(y) + 6, y); ctx.bezierCurveTo(1000, y - 10, 1200, y + 8, 1420 + y * .353 - 10, y + 4); ctx.stroke(); }
    const R = mulberry32(8); ctx.fillStyle = 'rgba(246,200,160,.5)';
    for (let k = 0; k < 40; k++) { const x = 790 + R() * 440, y = groundY(x) + 8 + R() * 60; if (y < -4) bean(ctx, x, y, 5 + R() * 8, 2 + R() * 3, R() - .5); }
    /* the lips of the ledges */
    ctx.strokeStyle = '#f0b890'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const [, i, j] of FLATS.slice(1, 5)) { ctx.beginPath(); ctx.moveTo(T[i][0], T[i][1] + 1); ctx.lineTo(T[j][0], T[j][1] + 1); ctx.stroke(); }
    /* forest on top, and all down the back */
    const R2 = mulberry32(21), cols = ['#2f7a3a', '#3f8a3a', '#57a046', '#2a6a34'];
    ctx.fillStyle = '#2f7a3a'; ctx.beginPath(); ctx.moveTo(1248, -338); ctx.lineTo(1300, -344); ctx.lineTo(1430, 4); ctx.lineTo(1340, 4); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 70; k++) { const u = R2(), x = lerp(1246, 1424, u) + (R2() - .5) * 26, y = groundY(clamp(x, 1246, 1420)) - 4 - R2() * 14 + (x < 1300 ? 0 : R2() * 30); ctx.fillStyle = cols[(R2() * 4) | 0]; bean(ctx, x, y, 9 + R2() * 12, 7 + R2() * 9, R2() * 3); }
    for (let k = 0; k < 12; k++) { const x = 1250 + R2() * 60, y = groundY(x) - 14 - R2() * 10; ctx.save(); ctx.translate(x, y); ctx.rotate(R2() * 6); Sprites.drawLeaf(ctx, 8 + R2() * 5, 0, cols[1 + ((R2() * 2) | 0)]); ctx.restore(); }
  }
  const groundXLeft = (y) => { const T = TERRAIN; for (let i = 3; i <= 9; i++) if (T[i][1] <= y) { const a = T[i - 1], b = T[i]; return a[0] + (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) || 1); } return 1252; };

  function objects(ctx, G, view, night) {
    const F = G.forest, t = G.time;
    river(ctx, G, view); cliff(ctx, G);
    for (const tr of F.trees) {
      const r = tr.crown ? tr.crown[2] + 60 : 190;
      if (tr.x + r + 200 < view.l || tr.x - r - 200 > view.r) continue;
      Scene.trunk(ctx, tr);
      if (tr.crown) Scene.drawCrown(ctx, tr, 0); else Scene.fronds(ctx, tr, t);
      for (const L of F.lines) if (L.tree === tr.key) Scene.branch(ctx, L, tr);
    }
    for (const h of F.hollows) if (h.door[0] > view.l - 80 && h.door[0] < view.r + 80) Scene.hollow(ctx, G, h, t);
  }
  function ground(ctx, view) {
    const g = ctx.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#4a5a2c'); g.addColorStop(.12, '#5a4a2a'); g.addColorStop(1, '#2e2416');
    ctx.fillStyle = g;
    ctx.fillRect(view.l - 20, 0, WORLD.riverX0 - view.l + 20, 170); ctx.fillRect(1420, 0, view.r - 1420 + 20, 170);
    /* the banks */
    ctx.fillStyle = '#6a5a34'; ctx.beginPath(); ctx.moveTo(WORLD.riverX0 - 40, 0); ctx.quadraticCurveTo(WORLD.riverX0, 2, WORLD.riverX0 + 8, 26); ctx.lineTo(WORLD.riverX0 - 40, 26); ctx.closePath(); ctx.fill();
    for (const f of FERNS) {
      if (f.x < view.l - 40 || f.x > view.r + 40) continue;
      ctx.strokeStyle = f.k < .5 ? '#3f8a3a' : '#2f6f34'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      for (let k = -3; k <= 3; k++) { const a = -Math.PI / 2 + k * .32; ctx.beginPath(); ctx.moveTo(f.x, 2); ctx.quadraticCurveTo(f.x + Math.cos(a) * f.s * .7, 2 + Math.sin(a) * f.s, f.x + Math.cos(a) * f.s * 1.3, 2 + Math.sin(a) * f.s * .7); ctx.stroke(); }
      if (f.k > .8) { ctx.fillStyle = f.k > .9 ? '#ff7ab0' : '#ffd23f'; bean(ctx, f.x + 6, -f.s * .7, 3, 3); }
    }
  }
  /* leaves in front of the birds; the food hangs in front too */
  function front(ctx, G, view) {
    for (const tr of G.forest.trees) { if (!tr.crown) continue; const r = tr.crown[2] + 60; if (tr.x + r < view.l || tr.x - r > view.r) continue; Scene.drawCrown(ctx, tr, 1, .8); }
    /* mist, when you are lost in it */
    const fog = G.forest.weather.fog;
    if (fog > .02) { for (let k = 0; k < 14; k++) { const x = view.l + ((k * 271 + G.time * 18) % (view.r - view.l + 400)) - 200, y = view.t + ((k * 173) % Math.max(1, view.b - view.t)); ctx.fillStyle = `rgba(232,240,244,${.2 * fog})`; bean(ctx, x, y, 260, 70); } ctx.fillStyle = `rgba(226,236,240,${.42 * fog})`; ctx.fillRect(view.l, view.t, view.r - view.l, view.b - view.t); }
  }
  Object.assign(Scene, { back, objects, ground, front });
})();
