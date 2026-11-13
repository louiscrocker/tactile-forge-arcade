/* ============================================================
   scene.js — the back yard, painted in code
   ============================================================
   Each thing is filled from its own outline in yard.js (OBJECTS),
   so what you see is exactly what you can walk on, then given its
   detail: board fence, log ends, the tin-roofed shed, a slatted
   crate, terracotta pots and an agave, the old boot, the prickly
   pear on its rock, the porch with its post, door and light.
   ============================================================ */
'use strict';

const Scene = (function () {
  const R = mulberry32(4242), rnds = []; for (let i = 0; i < 400; i++) rnds.push(R());
  const rv = (i) => rnds[((i % 400) + 400) % 400];
  const P = (key) => OBJECTS.find(o => o.key === key).pts;
  function outline(ctx, pts, close) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (close) ctx.closePath(); }
  const grad = (ctx, x0, y0, x1, y1, a, b) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const bean = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };

  /* behind everything: the house wall, the door, the lit window */
  function back(ctx, G, view, night) {
    if (view.r < 1000) return;
    ctx.fillStyle = grad(ctx, 0, -340, 0, 0, '#d9b98a', '#c09a6a'); ctx.fillRect(1196, -336, 640, 296);
    ctx.strokeStyle = 'rgba(120,84,50,.35)'; ctx.lineWidth = 1.5; for (let y = -316; y < -40; y += 22) { ctx.beginPath(); ctx.moveTo(1196, y); ctx.lineTo(1840, y); ctx.stroke(); }
    ctx.fillStyle = '#6a4630'; rr(ctx, 1360, -250, 110, 210, 4); ctx.fill(); ctx.fillStyle = '#7a5438'; rr(ctx, 1372, -238, 86, 90, 3); ctx.fill(); rr(ctx, 1372, -138, 86, 88, 3); ctx.fill(); ctx.fillStyle = '#e0c060'; bean(ctx, 1378, -140, 5, 5);
    ctx.fillStyle = '#4a3424'; rr(ctx, 1226, -246, 100, 96, 3); ctx.fill();
    ctx.fillStyle = night > .4 ? '#ffd98a' : '#a8c8d8'; ctx.fillRect(1234, -238, 40, 80); ctx.fillRect(1278, -238, 40, 80);
    ctx.fillStyle = '#8a6a48'; ctx.fillRect(1050, -40, 800, 40);
  }
  function fence(ctx) {
    for (let k = 0; k < 6; k++) { const x = -1500 - (k + 1) * 34, h = 430 - rv(k) * 8; ctx.fillStyle = grad(ctx, x, 0, x + 34, 0, k % 2 ? '#9a7850' : '#8a6a44', k % 2 ? '#7a5c3a' : '#6e5234'); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -h); ctx.lineTo(x + 17, -h - 12); ctx.lineTo(x + 33, -h); ctx.lineTo(x + 33, 0); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#6a5030'; ctx.fillRect(-1710, -330, 210, 14); ctx.fillRect(-1710, -110, 210, 14);
    ctx.fillStyle = 'rgba(40,26,14,.5)'; for (const y of [-323, -103]) for (let k = 0; k < 6; k++) bean(ctx, -1517 - k * 34, y, 2, 2);
  }
  function woodpile(ctx) {
    const pts = P('woodpile');
    ctx.save(); outline(ctx, pts, true); ctx.fillStyle = '#4a3220'; ctx.fill(); ctx.clip();
    let i = 0;
    for (let row = 0; row < 4; row++) for (let x = -1350 + (row % 2) * 20; x < -1040; x += 40) {
      const r = 19 + rv(i) * 4, y = -20 - row * 37 + rv(i + 7) * 5; i++;
      ctx.fillStyle = '#6e4c2e'; bean(ctx, x, y, r + 2, r + 2);
      ctx.fillStyle = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, r); ctx.fillStyle.addColorStop(0, '#f0d2a0'); ctx.fillStyle.addColorStop(1, '#c08e56'); bean(ctx, x, y, r, r);
      ctx.strokeStyle = 'rgba(120,80,40,.5)'; ctx.lineWidth = 1; for (let q = 1; q < 4; q++) { ctx.beginPath(); ctx.arc(x + 1, y + 1, r * q / 4.4, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(70,40,16,.55)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(i) * r, y + Math.sin(i) * r); ctx.stroke();
    }
    ctx.restore();
  }
  function shed(ctx) {
    ctx.fillStyle = grad(ctx, -820, 0, -420, 0, '#a8b0a4', '#7e8a80'); ctx.fillRect(-820, -250, 400, 250);
    ctx.strokeStyle = 'rgba(40,50,46,.3)'; ctx.lineWidth = 2; for (let x = -800; x < -420; x += 24) { ctx.beginPath(); ctx.moveTo(x, -250); ctx.lineTo(x, 0); ctx.stroke(); }
    ctx.fillStyle = '#5a6660'; rr(ctx, -700, -190, 110, 190, 3); ctx.fill(); ctx.fillStyle = '#48524e'; ctx.fillRect(-648, -190, 4, 190); ctx.fillStyle = '#c8b060'; bean(ctx, -660, -100, 4, 4);
    ctx.fillStyle = '#2e3a44'; rr(ctx, -540, -200, 70, 60, 3); ctx.fill(); ctx.fillStyle = 'rgba(160,200,230,.35)'; ctx.fillRect(-536, -196, 30, 52);
    ctx.fillStyle = grad(ctx, 0, -362, 0, -235, '#b0503a', '#7a3426'); ctx.beginPath(); ctx.moveTo(-880, -235); ctx.lineTo(-886, -250); ctx.lineTo(-620, -362); ctx.lineTo(-354, -250); ctx.lineTo(-360, -235); ctx.lineTo(-420, -250); ctx.lineTo(-820, -250); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,14,8,.35)'; ctx.lineWidth = 2; for (let k = 1; k < 11; k++) { const u = k / 11; ctx.beginPath(); ctx.moveTo(lerp(-886, -620, u), lerp(-250, -362, u)); ctx.lineTo(lerp(-886, -620, u) + 4, lerp(-250, -362, u) + 15); ctx.moveTo(lerp(-620, -354, u), lerp(-362, -250, u)); ctx.lineTo(lerp(-620, -354, u) - 4, lerp(-362, -250, u) + 15); ctx.stroke(); }
    ctx.fillStyle = 'rgba(20,24,22,.35)'; ctx.beginPath(); ctx.moveTo(-420, -250); ctx.lineTo(-360, -235); ctx.lineTo(-420, -228); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-820, -250); ctx.lineTo(-880, -235); ctx.lineTo(-820, -228); ctx.closePath(); ctx.fill();
  }
  function crate(ctx) {
    ctx.fillStyle = '#5a4026'; ctx.fillRect(-335, -70, 100, 70);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#c09a62' : '#b08a54'; ctx.fillRect(-335, -70 + k * 18, 100, 14); }
    ctx.fillStyle = '#8a6a40'; ctx.fillRect(-335, -70, 9, 70); ctx.fillRect(-244, -70, 9, 70);
  }
  function pots(ctx, t) {
    /* the agave in the standing pot */
    for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * .28, L = 70 - Math.abs(k - 4) * 7; ctx.fillStyle = k % 2 ? '#6a9a7a' : '#5a8a6e'; ctx.beginPath(); ctx.moveTo(-27 - 9, -98); ctx.quadraticCurveTo(-27 + Math.cos(a) * L * .6 - 6, -98 + Math.sin(a) * L * .6, -27 + Math.cos(a) * L, -98 + Math.sin(a) * L); ctx.quadraticCurveTo(-27 + Math.cos(a) * L * .5 + 8, -98 + Math.sin(a) * L * .5, -27 + 9, -98); ctx.fill(); }
    outline(ctx, P('pot'), true); ctx.fillStyle = grad(ctx, -80, 0, 26, 0, '#d98a52', '#a85a30'); ctx.fill();
    ctx.fillStyle = grad(ctx, -80, 0, 26, 0, '#e89a60', '#b86a3a'); ctx.fillRect(-80, -98, 106, 12);
    ctx.fillStyle = 'rgba(60,24,10,.25)'; ctx.fillRect(-74, -86, 94, 4);
    outline(ctx, P('pot2'), true); ctx.fillStyle = grad(ctx, 0, -80, 0, 0, '#d08650', '#9a5630'); ctx.fill();
    ctx.fillStyle = '#3a2014'; bean(ctx, 112, -40, 9, 34); ctx.fillStyle = '#c87a48'; ctx.beginPath(); ctx.ellipse(112, -40, 12, 38, 0, Math.PI * .5, Math.PI * 1.5); ctx.fill(); ctx.fillStyle = '#2a160c'; bean(ctx, 113, -40, 7, 30);
  }
  function boot(ctx) {
    outline(ctx, P('boot'), true); ctx.fillStyle = grad(ctx, 324, -126, 480, 0, '#8a623e', '#5a3c24'); ctx.fill();
    ctx.fillStyle = '#2e2018'; ctx.fillRect(326, -8, 156, 8); ctx.fillStyle = '#3a2a1e'; rr(ctx, 328, -130, 60, 10, 4); ctx.fill();
    ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(372, -112 + k * 13); ctx.lineTo(392, -106 + k * 13); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(30,18,10,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(390, -66); ctx.quadraticCurveTo(430, -40, 478, -28); ctx.stroke();
  }
  function pear(ctx) {
    ctx.fillStyle = grad(ctx, 0, -56, 0, 0, '#a89a88', '#6a5e52'); ctx.beginPath(); ctx.moveTo(610, 0); ctx.lineTo(622, -34); ctx.lineTo(668, -48); ctx.lineTo(700, -52); ctx.lineTo(786, -56); ctx.lineTo(830, -40); ctx.lineTo(850, 0); ctx.closePath(); ctx.fill();
    const pads = [[744, -100, 56, 52, 0], [722, -196, 36, 56, .1], [770, -190, 30, 50, -.25]];
    for (const [x, y, rx, ry, rot] of pads) { const g = ctx.createRadialGradient(x - rx * .3, y - ry * .3, 4, x, y, Math.max(rx, ry)); g.addColorStop(0, '#9cc47a'); g.addColorStop(1, '#4e7e48'); ctx.fillStyle = g; bean(ctx, x, y, rx, ry, rot); }
    ctx.fillStyle = 'rgba(250,246,220,.85)'; let i = 0; for (const [x, y, rx, ry] of pads) for (let k = 0; k < 16; k++) { const a = rv(i) * TAU, d = Math.sqrt(rv(i + 3)) * .8; i += 2; bean(ctx, x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, 1.4, 1.4); }
    ctx.fillStyle = '#c8407a'; for (const [x, y] of [[705, -246], [742, -258], [778, -238]]) bean(ctx, x, y, 8, 11);
  }
  function porch(ctx, G, night) {
    ctx.fillStyle = grad(ctx, 0, -40, 0, 0, '#a08058', '#6e5436'); ctx.fillRect(1050, -40, 800, 40); ctx.fillStyle = 'rgba(40,26,14,.3)'; ctx.fillRect(1050, -40, 800, 5);
    ctx.fillStyle = grad(ctx, 1180, 0, 1200, 0, '#e8dcc4', '#b8a888'); ctx.fillRect(1180, -320, 20, 280);
    ctx.fillStyle = grad(ctx, 0, -352, 0, -320, '#8a5a40', '#5a3828'); ctx.beginPath(); ctx.moveTo(1085, -320); ctx.lineTo(1078, -336); ctx.lineTo(1840, -404); ctx.lineTo(1840, -320); ctx.closePath(); ctx.fill();
    /* the porch light */
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(WORLD.lampX, -320); ctx.lineTo(WORLD.lampX, WORLD.lampY - 10); ctx.stroke();
    ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.moveTo(WORLD.lampX - 11, WORLD.lampY - 2); ctx.lineTo(WORLD.lampX, WORLD.lampY - 12); ctx.lineTo(WORLD.lampX + 11, WORLD.lampY - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = night > .3 ? '#fff0b0' : '#e8e4d8'; bean(ctx, WORLD.lampX, WORLD.lampY + 4, 7, 8);
  }
  /* the dry ground, in front of everything that stands on it */
  function ground(ctx, view) {
    ctx.fillStyle = grad(ctx, 0, 0, 0, 150, '#c9a877', '#8a6a44'); ctx.fillRect(view.l, 0, view.r - view.l, Math.max(0, view.b) + 2);
    ctx.fillStyle = 'rgba(255,240,210,.35)'; ctx.fillRect(view.l, 0, view.r - view.l, 2.5);
    const x0 = Math.floor(view.l / 46) * 46;
    for (let x = x0; x < view.r; x += 46) {
      const i = Math.round(x / 46), px = x + rv(i) * 40, py = 10 + rv(i + 50) * 90, r = 2 + rv(i + 9) * 5;
      ctx.fillStyle = i % 3 ? 'rgba(90,66,40,.35)' : 'rgba(230,214,180,.5)'; bean(ctx, px, py, r, r * .6);
      if (i % 5 === 0) { ctx.strokeStyle = '#b8a05a'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(px, 1); ctx.quadraticCurveTo(px + k * 3, -9, px + k * 6, -15 - rv(i + k) * 8); ctx.stroke(); } }
    }
    /* the hose, lying where it was left */
    ctx.strokeStyle = '#3a8a4e'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(1086, 30); ctx.bezierCurveTo(1036, 4, 976, 60, 956, 26); ctx.bezierCurveTo(944, 6, 1006, 2, 1020, 22); ctx.stroke();
    ctx.strokeStyle = 'rgba(180,230,190,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1086, 28); ctx.bezierCurveTo(1036, 2, 976, 58, 956, 24); ctx.stroke(); ctx.fillStyle = '#c8a040'; bean(ctx, 1022, 23, 6, 5);
  }
  const DRAW = { fence, woodpile, shed, crate, pot: pots, boot, pear, porch };
  const SPAN = { fence: [-1720, -1490], woodpile: [-1360, -1030], shed: [-900, -340], crate: [-340, -230], pot: [-110, 250], boot: [320, 490], pear: [600, 860], porch: [1040, 1860] };
  function objects(ctx, G, view, night) { for (const k in DRAW) if (SPAN[k][1] > view.l && SPAN[k][0] < view.r) DRAW[k](ctx, G, night); }
  /* what glows at night: the porch light, the window */
  function glow(ctx, night) {
    const g = ctx.createRadialGradient(WORLD.lampX, WORLD.lampY + 4, 2, WORLD.lampX, WORLD.lampY + 4, 190);
    g.addColorStop(0, `rgba(255,236,170,${.9 * night})`); g.addColorStop(.15, `rgba(255,220,140,${.4 * night})`); g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g; ctx.fillRect(WORLD.lampX - 190, WORLD.lampY - 186, 380, 380);
    ctx.fillStyle = `rgba(255,214,130,${.55 * night})`; ctx.fillRect(1234, -238, 40, 80); ctx.fillRect(1278, -238, 40, 80);
  }
  return { back, objects, ground, glow };
})();
