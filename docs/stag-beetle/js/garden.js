/* ============================================================
   garden.js — the things in the garden, world space
   ============================================================
   back(): the house and hedge far behind, the fence, the washing
   line, the street lamp and its moths, the path, the pond, the
   compost, the log pile.  air(): warm-air shimmer and the scent
   trail.  The ground under all of it is the Wood's cut-away.
   ============================================================ */
'use strict';

const Garden = (function () {
  const bean = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); };
  const vis = (view, x, r) => x + r > view.l && x - r < view.r;
  function house(c, x, y, night) {
    const W = 420, H = 210;
    c.fillStyle = '#c9a98a'; c.fillRect(x, y - H, W, H);
    c.fillStyle = 'rgba(120,80,60,.16)'; for (let r = 0; r < 18; r++) for (let k = 0; k < 24; k++) { if ((r * 5 + k * 3) % 4) c.fillRect(x + k * 18 + (r % 2) * 9, y - H + r * 12, 16, 1.2); }
    c.fillStyle = '#8c4a34'; c.beginPath(); c.moveTo(x - 24, y - H); c.lineTo(x + W / 2, y - H - 120); c.lineTo(x + W + 24, y - H); c.fill();
    c.fillStyle = '#6f4a38'; c.fillRect(x + W - 90, y - H - 110, 38, 90);
    const lit = clamp((night - .1) * 2 + .55, 0, 1);
    for (const [wx, wy, ww, wh] of [[46, -180, 76, 70], [298, -180, 76, 70], [46, -84, 96, 72], [298, -84, 96, 72]]) {
      c.fillStyle = `rgb(${lerp(120, 255, lit) | 0},${lerp(150, 214, lit) | 0},${lerp(170, 130, lit) | 0})`; c.fillRect(x + wx, y + wy, ww, wh);
      c.strokeStyle = '#f2ece0'; c.lineWidth = 5; c.strokeRect(x + wx, y + wy, ww, wh); c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + wx + ww / 2, y + wy); c.lineTo(x + wx + ww / 2, y + wy + wh); c.moveTo(x + wx, y + wy + wh / 2); c.lineTo(x + wx + ww, y + wy + wh / 2); c.stroke();
    }
    c.fillStyle = '#3f6a5a'; c.fillRect(x + 190, y - 92, 48, 92);
  }
  function fence(c, x, h, S) {
    for (let k = -3; k <= 3; k++) { const px = x + k * 15, y = S.groundAt(px); c.fillStyle = k % 2 ? '#a07a50' : '#8e6a44'; c.beginPath(); c.moveTo(px - 7, y + 2); c.lineTo(px - 7, y - h); c.lineTo(px, y - h - 6); c.lineTo(px + 7, y - h); c.lineTo(px + 7, y + 2); c.fill(); }
    c.fillStyle = '#6e5234'; c.fillRect(x - 56, S.groundAt(x) - h * .3, 112, 5); c.fillRect(x - 56, S.groundAt(x) - h * .8, 112, 5);
  }
  /* baked once: painted in code, so they sit in the scene like the trees do */
  const baked = {};
  function bake(key, w, h, draw) {
    if (baked[key]) return baked[key];
    const k = 2.5, cv = document.createElement('canvas'); cv.width = w * k; cv.height = h * k;
    const g = cv.getContext('2d'); g.scale(k, k); g.translate(w / 2, h / 2); draw(g, mulberry32(key.length * 97 + w));
    return baked[key] = cv;
  }
  /* a log's sawn end: rough bark, sapwood, wobbly rings, cracks running out from the heart, a little moss */
  function logEnd(v) {
    return bake('log' + v, 70, 70, (g, R0) => {
      const R = mulberry32(31 + v * 17), r = 29, wob = (a) => 1 + Math.sin(a * 3 + v) * .035 + Math.sin(a * 7 + v * 2) * .02;
      const ring = (k) => { g.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, q = r * k * wob(a); i ? g.lineTo(Math.cos(a) * q, Math.sin(a) * q) : g.moveTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); };
      g.fillStyle = '#3a2a1e'; ring(1.08); g.fill();
      for (let i = 0; i < 70; i++) { const a = R() * TAU, q = r * (1 + R() * .1); g.fillStyle = R() < .5 ? '#5a4432' : '#2a1e14'; g.beginPath(); g.ellipse(Math.cos(a) * q, Math.sin(a) * q, 2.4 + R() * 3, 1 + R(), a + 1.57, 0, TAU); g.fill(); }
      const fg = g.createRadialGradient(-5, -6, 2, 0, 0, r); fg.addColorStop(0, '#a87a4a'); fg.addColorStop(.55, '#c49a64'); fg.addColorStop(.9, '#d4b080'); fg.addColorStop(1, '#a88458');
      g.fillStyle = fg; ring(.94); g.fill();
      g.save(); ring(.94); g.clip();
      for (let k = .1; k < .94; k += .055 + R() * .05) { g.strokeStyle = `rgba(92,58,30,${.22 + R() * .3})`; g.lineWidth = .4 + R() * .6; ring(k); g.stroke(); }
      for (let i = 0; i < 8; i++) { const a = R() * TAU, q0 = R() * 5, q1 = r * (.45 + R() * .5); g.strokeStyle = 'rgba(40,24,12,.8)'; g.lineWidth = .5 + R() * 1.1; g.beginPath(); g.moveTo(Math.cos(a) * q0, Math.sin(a) * q0); g.lineTo(Math.cos(a + .06) * q1 * .6, Math.sin(a + .06) * q1 * .6); g.lineTo(Math.cos(a - .03) * q1, Math.sin(a - .03) * q1); g.stroke(); }
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(60,36,18,${R() * .14})`; g.fillRect((R() - .5) * 60, (R() - .5) * 60, 1.4, .5); }
      const sh = g.createLinearGradient(-20, -24, 20, 28); sh.addColorStop(0, 'rgba(255,240,210,.14)'); sh.addColorStop(1, 'rgba(30,14,6,.42)'); g.fillStyle = sh; g.fillRect(-35, -35, 70, 70);
      g.restore();
      for (let i = 0; i < 26; i++) { const a = -1.2 - R() * 1.1, q = r * (.92 + R() * .2); g.fillStyle = R() < .5 ? '#3f6a2c' : '#55803a'; g.beginPath(); g.ellipse(Math.cos(a) * q, Math.sin(a) * q, 2 + R() * 3, 1.4 + R() * 1.6, R(), 0, TAU); g.fill(); }
    });
  }
  function compost(c, x, S) {
    const y = S.groundAt(x), img = bake('compost', 170, 96, (g) => {
      const R = mulberry32(9), plank = (px, py, w, h, col) => { g.fillStyle = col; g.fillRect(px, py, w, h); g.strokeStyle = 'rgba(40,24,12,.35)'; g.lineWidth = .6; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(px + 2, py + (k + .5) * h / 4); g.lineTo(px + w - 2, py + (k + .5) * h / 4 + (R() - .5) * 2); g.stroke(); } };
      for (const py of [-40, -28, -16]) plank(-76, py, 152, 9, '#6e5238');
      const hp = new Path2D(); hp.moveTo(-68, 42); hp.bezierCurveTo(-60, 4, -34, -22, -4, -26); hp.bezierCurveTo(30, -30, 56, -6, 68, 42); hp.closePath();
      const hg = g.createLinearGradient(0, -28, 0, 42); hg.addColorStop(0, '#4e3a26'); hg.addColorStop(1, '#2a1c12'); g.fillStyle = hg; g.fill(hp);
      g.save(); g.clip(hp);
      for (let i = 0; i < 700; i++) { const px = (R() - .5) * 136, py = -28 + R() * 70, v = R(); g.fillStyle = v < .4 ? '#3a2818' : v < .7 ? '#5a4228' : v < .86 ? '#6a7a34' : '#7a5a30'; g.beginPath(); g.ellipse(px, py, 1 + R() * 3, .7 + R() * 1.6, R() * 3, 0, TAU); g.fill(); }
      for (let i = 0; i < 90; i++) { g.strokeStyle = R() < .6 ? '#8fa24a' : '#b0a04a'; g.lineWidth = .8; const px = (R() - .5) * 110, py = -24 + R() * 44; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 4, py - 3, px + 9 * (R() - .3), py + 2); g.stroke(); }
      g.restore();
      /* peelings: orange curls, a banana skin, an apple core, eggshell */
      for (const [px, py, rot] of [[-30, 2, .4], [22, -8, 2], [44, 18, 1.2]]) { g.save(); g.translate(px, py); g.rotate(rot); g.strokeStyle = '#e8862a'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, 6, .4, 4); g.stroke(); g.strokeStyle = '#f7c98a'; g.lineWidth = 1; g.beginPath(); g.arc(0, 1, 5, .6, 3.6); g.stroke(); g.restore(); }
      g.save(); g.translate(-6, -12); g.rotate(-.3); g.strokeStyle = '#d9b83a'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10, 2); g.quadraticCurveTo(0, -6, 12, 3); g.stroke(); g.strokeStyle = '#4a3a1e'; g.lineWidth = 1; g.beginPath(); g.moveTo(-11, 3); g.lineTo(-13, 5); g.stroke(); g.restore();
      g.fillStyle = '#e8d8b8'; g.beginPath(); g.ellipse(6, 12, 3.4, 6, .2, 0, TAU); g.fill(); g.fillStyle = '#b84a3a'; g.beginPath(); g.arc(6, 6, 3.6, Math.PI, 0); g.fill(); g.beginPath(); g.arc(6, 18, 3.4, 0, Math.PI); g.fill();
      g.fillStyle = '#f3ece0'; for (const [px, py] of [[-44, 22], [34, -2]]) { g.beginPath(); g.moveTo(px - 4, py); g.lineTo(px - 1, py - 4); g.lineTo(px + 2, py - 1); g.lineTo(px + 5, py - 3); g.lineTo(px + 4, py + 3); g.quadraticCurveTo(px, py + 5, px - 4, py); g.fill(); }
      for (const q of [-1, 1]) plank(q * 76 - 5, -46, 10, 92, '#5e4630');
      plank(-76, 30, 152, 9, '#7a5c40');
    });
    c.drawImage(img, x - 85, y - 90, 170, 96);
  }
  /* the log pile the child builds: more logs each evening, up to six, sitting in the long grass */
  function pile(c, n, S) {
    const x0 = WORLD.pileX, y = S.groundAt(x0);
    if (n <= 0) return;
    const spots = [[-52, -24], [-4, -26], [44, -23], [-29, -64], [20, -65], [-5, -102]];
    for (let k = 0; k < Math.min(n, 6); k++) { const [dx, dy] = spots[k], rr = 27 - (k % 3) * 1.6; c.fillStyle = 'rgba(20,12,6,.5)'; bean(c, x0 + dx + 3, y + dy + 4, rr + 2, rr + 2); }
    for (let k = 0; k < Math.min(n, 6); k++) { const [dx, dy] = spots[k], rr = 27 - (k % 3) * 1.6; c.drawImage(logEnd(k % 6), x0 + dx - rr * 1.25, y + dy - rr * 1.25, rr * 2.5, rr * 2.5); }
  }
  function lamp(c, G, S, view) {
    const x = WORLD.lampX, y = S.groundAt(x), t = G.time, on = clamp((G.tod - .74) * 12, 0, 1);
    c.fillStyle = '#2e3138'; c.fillRect(x - 5, y - 196, 10, 198); c.fillRect(x - 8, y - 16, 16, 18);
    c.fillStyle = '#23262c'; bean(c, x, y - 204, 26, 11);
    c.fillStyle = on ? '#fff0b0' : '#b8b4a0'; bean(c, x, y - 196, 19, 8);
    if (on) { const g = c.createRadialGradient(x, y - 190, 4, x, y - 190, 150); g.addColorStop(0, `rgba(255,230,150,${.55 * on})`); g.addColorStop(1, 'rgba(255,220,130,0)'); c.fillStyle = g; c.fillRect(x - 150, y - 340, 300, 300); }
    /* moths, round and round */
    for (let k = 0; k < 7; k++) { const a = t * (1.6 + k * .22) + k * 1.7, r = 28 + k * 7, mx = x + Math.cos(a) * r, my = y - 188 + Math.sin(a * 1.3) * r * .55; c.save(); c.translate(mx, my); Critters.moth(c, .8, t * 22 + k); c.restore(); }
  }
  function line(c, G, S) {
    const L = WORLD.lineL, R = WORLD.lineR, t = G.time, y = -124, wind = G.forest.weather.gust;
    c.fillStyle = '#d8d4c8'; for (const x of [L - 8, R + 8]) { c.fillRect(x - 3, y - 6, 6, -S.groundAt(x) * 0 + 132); }
    c.strokeStyle = '#ece8dc'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(L - 8, y); c.quadraticCurveTo((L + R) / 2, y + 12, R + 8, y); c.stroke();
    const items = [[L + 14, 62, '#f3efe6'], [L + 84, 44, '#7fb4dc'], [L + 136, 52, '#f2d8e0'], [L + 196, 58, '#f3efe6'], [L + 262, 36, '#e8c84a']];
    for (const [x, w, col] of items) {
      const lift = Math.sin(t * 1.3 + x) * (3 + wind * 7), h = 58;
      c.fillStyle = col; c.beginPath(); c.moveTo(x, y + 5); c.lineTo(x + w, y + 5); c.quadraticCurveTo(x + w + lift, y + h * .5, x + w + lift * 1.4, y + h); c.quadraticCurveTo(x + w * .5 + lift, y + h + 4, x + lift * 1.2, y + h); c.quadraticCurveTo(x + lift * .5, y + h * .5, x, y + 5); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.08)'; c.stroke();
      c.fillStyle = '#a07a50'; c.fillRect(x + 3, y + 1, 3, 8); c.fillRect(x + w - 6, y + 1, 3, 8);
    }
  }
  function back(c, G, S, view) {
    const n = G.night;
    if (vis(view, 180, 320)) house(c, -30, S.groundAt(180) + 2, n);
    /* the path */
    c.fillStyle = '#b0a998'; for (let x = WORLD.pathL; x < WORLD.pathR; x += 44) { c.fillRect(x + 2, S.groundAt(x) - 4, 40, 6); }
    if (vis(view, WORLD.pondX, WORLD.pondW + 40)) {
      const x = WORLD.pondX, y = S.groundAt(x), g = c.createLinearGradient(0, y - 8, 0, y + 12); g.addColorStop(0, '#7fb8cc'); g.addColorStop(1, '#2f5a6a');
      c.fillStyle = '#6a7060'; bean(c, x, y + 2, WORLD.pondW + 10, 15); c.fillStyle = g; bean(c, x, y + 1, WORLD.pondW, 11);
      c.fillStyle = '#4f8a3a'; for (const [dx, r] of [[-90, 13], [-30, 11], [60, 14], [110, 9]]) bean(c, x + dx, y - 1, r, 3.4);
      c.fillStyle = '#f4d0dc'; bean(c, x - 28, y - 4, 4, 3);
      c.fillStyle = '#3f6a2a'; for (const [dx, h] of [[-170, 62], [-160, 48], [172, 54], [160, 66]]) { c.fillRect(x + dx, y - h, 2.4, h); c.fillStyle = '#5a3a22'; bean(c, x + dx + 1, y - h, 3, 8); c.fillStyle = '#3f6a2a'; }
    }
    if (vis(view, -470, 110)) compost(c, -470, S);
    if (vis(view, WORLD.pileX, 110)) pile(c, G.forest.pile, S);
    if (vis(view, (WORLD.lineL + WORLD.lineR) / 2, 200)) line(c, G, S);
    if (vis(view, WORLD.lampX, 170)) lamp(c, G, S, view);
    if (vis(view, WORLD.fenceX, 70)) fence(c, WORLD.fenceX, 70, S);
  }
  /* the turf along the top of the soil: mown lawn in the garden, leaf mould at the wood's edge */
  function lawn(c, G, S, view) {
    const x0 = Math.max(view.l, WORLD.left), x1 = Math.min(view.r, WORLD.right);
    const seg = (a, b, col, w, dy = 2) => { if (b < x0 || a > x1) return; c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); const s = Math.max(a, x0), e = Math.min(b, x1); for (let x = s; x <= e; x += 12) { const y = S.groundAt(x) + dy; x === s ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); };
    const pond = WORLD.pondX - WORLD.pondW - 6, pondR = WORLD.pondX + WORLD.pondW + 6;
    for (const [a, b] of [[-880, pond], [pondR, WORLD.pathL], [WORLD.pathR, WORLD.fenceX + 60]]) { seg(a, b, '#3f6a2c', 9, 3); seg(a, b, '#6a9e42', 4.5, 0); }
    for (const [a, b] of [[WORLD.left, WORLD.stumpX - 300], [WORLD.fenceX + 60, WORLD.right]]) seg(a, b, '#4a4a26', 6, 1);
    c.fillStyle = '#b6ae9c'; for (let x = WORLD.pathL; x < WORLD.pathR; x += 44) { const y = S.groundAt(x); if (x > x0 - 44 && x < x1) { rr(c, x + 2, y - 3, 40, 7, 3); c.fill(); } }
    /* mown stripes of blades */
    c.strokeStyle = '#7aae4a'; c.lineWidth = 1.2; c.beginPath();
    for (let x = Math.floor(x0 / 7) * 7; x < x1; x += 7) { if (x < -880 || x > WORLD.fenceX + 60 || (x > pond && x < pondR) || (x > WORLD.pathL && x < WORLD.pathR)) continue; const y = S.groundAt(x), h = 4 + ((x * 13) % 5 + 5) % 5; c.moveTo(x, y); c.lineTo(x + 1.5, y - h); }
    c.stroke();
  }
  /* the sawn top of the stump, drawn over the cut-away: rings, a crack, moss; gone once it has crumbled */
  function stumpTop(c, G, S) {
    if (G.year >= 6 && G.player.stage !== 'egg') return;
    const x = WORLD.stumpX, y = WORLD.stumpTop - 2, W2 = 146, k = clamp((G.forest.wood.year - 1) / 4, 0, 1);
    c.fillStyle = '#4a3626'; bean(c, x, y + 5, W2 + 3, 19);
    const g = c.createRadialGradient(x - 30, y - 4, 10, x, y, W2); g.addColorStop(0, mixHex('#e0b880', '#a88a60', k)); g.addColorStop(1, mixHex('#b88a58', '#7a6044', k));
    c.fillStyle = g; bean(c, x, y, W2, 15);
    c.strokeStyle = 'rgba(110,70,40,.55)'; c.lineWidth = 1.2; for (let r = .16; r < 1; r += .15) { c.beginPath(); c.ellipse(x + 8 * (1 - r), y, W2 * r, 15 * r, 0, 0, TAU); c.stroke(); }
    c.strokeStyle = 'rgba(60,36,20,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 20, y - 1); c.lineTo(x + 34, y + 5); c.lineTo(x + 70, y + 2); c.stroke();
    c.fillStyle = 'rgba(95,138,58,.7)'; bean(c, x - 100, y + 3, 30, 6); bean(c, x + 96, y - 3, 22, 5);
  }
  function air(c, G, view) {
    const F = G.forest, t = G.time, p = G.player;
    if (p.stage !== 'adult' || p.mode === 'tunnel') return;
    /* warm air: a soft rising shimmer */
    if (p.mode === 'fly' || p.mode === 'warmup') for (const w of F.warm) {
      if (!vis(view, w.x, w.w)) continue;
      for (let k = 0; k < 6; k++) { const u = ((t * .18 + k / 6 + w.ph) % 1), y = lerp(w.y1, w.y0, u), a = Math.sin(u * Math.PI) * .22, dx = Math.sin(u * 7 + w.ph) * w.w * .4; c.strokeStyle = `rgba(255,214,150,${a})`; c.lineWidth = 3; c.beginPath(); c.moveTo(w.x + dx - 13, y); c.quadraticCurveTo(w.x + dx, y - 16, w.x + dx + 13, y); c.stroke(); }
    }
    /* the scent trail: golden puffs, and a dotted drift between them */
    for (const q of F.puffs) {
      if (q.got || !vis(view, q.x, 40)) continue;
      const r = 12 + Math.sin(t * 3 + q.x) * 3, g = c.createRadialGradient(q.x, q.y, 1, q.x, q.y, r * 2.2);
      g.addColorStop(0, 'rgba(255,240,170,.95)'); g.addColorStop(.4, 'rgba(255,205,90,.6)'); g.addColorStop(1, 'rgba(255,190,60,0)');
      c.fillStyle = g; c.fillRect(q.x - r * 2.2, q.y - r * 2.2, r * 4.4, r * 4.4);
    }
    const g = F.scentTo;
    if (g && (p.mode === 'fly' || p.mode === 'ground')) { const a = .55 + .3 * Math.sin(t * 4); c.strokeStyle = `rgba(255,230,140,${a})`; c.lineWidth = 2.5; c.beginPath(); c.arc(g.x, g.y, 20 + Math.sin(t * 4) * 4, 0, TAU); c.stroke(); }
  }
  return { back, air, stumpTop, lawn };
})();
