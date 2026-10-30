/* ============================================================
   render.js — the open Pacific and the California coast, back to front
   ============================================================
     the sky above the surface (time of day, weather, stars, the
     sun, the moon in its real phase), the far coast (golden hills,
     Monterey cypress, a lighthouse) when you are near it, the sea
     body (bright blue at the top, black in the deep), sun rays,
     far kelp; the coast's cells, rim and floor decor; giant kelp
     behind; the cleaning station; plankton, food (jellies, salps,
     krill), the school, the anchovies, comb jellies, visitors, the
     boat and the net, the other sunfish, the mother, you, particles,
     kelp in front, the gull; light (night, the deep's darkness, a
     warm low sun), glows, marine snow; overlays (warm and itchy
     meters, the swell meter, arrows, labels, the scale bar).
     With the painted look (gfx.js), the sea, sky and light are
     painted on the GPU and this draws the world layer only.
   ============================================================ */
'use strict';
const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1, quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  const HI = 4;
  const SKY = [
    [0.00, '#070b22', '#14234a'], [0.19, '#141a44', '#5a3a62'], [0.25, '#7a8fc8', '#ffb98a'],
    [0.36, '#2a7cd2', '#6cb4e2'], [0.55, '#2474cc', '#62afe0'], [0.70, '#4a8ad0', '#ffc890'],
    [0.79, '#3d3f8c', '#ff8a5c'], [0.86, '#121a48', '#3a2f5c'], [1.00, '#070b22', '#14234a']
  ];
  const stars = [], snow = [], flakes = [];
  let layers = [];
  let lo = null, loImg = null, hi = null, hiCtx = null, back = null, backCtx = null, smooth = null;
  let buf = null, bufCtx = null, grainPat = null, grain = null;
  let builtFor = null, decor = null;
  /* the painted art goes with the WebGL look; the classic sprites everywhere else */
  const noPaint = (() => { try { return new URLSearchParams(location.search).get('paint') === '0'; } catch (e) { return false; } })();
  const painting = () => !noPaint && typeof Painted !== 'undefined' && typeof GFX !== 'undefined' && GFX.active();
  const art = () => (painting() ? Painted : Sprites);

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    if (typeof GFX !== 'undefined' && GFX.init(c)) GFX.setQualitySource(() => quality);
    for (let i = 0; i < 220; i++) stars.push([Math.random(), Math.random() * .8, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 90; i++) snow.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, ph: Math.random() * TAU });
    for (let i = 0; i < 120; i++) flakes.push({ x: Math.random(), y: Math.random(), z: .4 + Math.random() * .6, ph: Math.random() * TAU });
    buildGrain();
    buildLayers();
  }
  function resize(w, h, dpr) {
    W = w; H = h; DPR = quality === 'low' ? 1 : dpr;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    buf = document.createElement('canvas'); buf.width = canvas.width; buf.height = canvas.height; bufCtx = buf.getContext('2d');
    if (typeof GFX !== 'undefined') GFX.resize(w, h, DPR, canvas.width, canvas.height);
  }
  function setQuality(q) { if (q !== quality) { quality = q; resize(W, H, Math.min(2, devicePixelRatio || 1)); } }
  function getFps() { return fps; }

  /* ---------- textures ---------- */
  function buildGrain() {
    grain = document.createElement('canvas'); grain.width = grain.height = 256;
    const g = grain.getContext('2d'), R = mulberry32(99);
    for (let i = 0; i < 5000; i++) { const v = R(); g.fillStyle = v < .55 ? `rgba(0,0,0,${R() * .22})` : `rgba(255,245,225,${R() * .14})`; g.fillRect(R() * 256, R() * 256, 1 + (R() < .3), 1 + (R() < .3)); }
    for (let i = 0; i < 140; i++) { const x = R() * 256, y = R() * 256, r = .6 + R() * 1.8; g.fillStyle = `rgba(0,0,0,${.1 + R() * .15})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = `rgba(255,250,235,${.08 + R() * .1})`; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .5, 0, TAU); g.fill(); }
  }
  /* three tileable bands of far boulders and kelp silhouettes, blue with distance, for behind the sea floor */
  function buildLayers() {
    layers = [];
    const specs = [{ h: 300, base: 'rgba(40,90,140,.55)', n: 14, par: .12, kelp: 10 }, { h: 340, base: 'rgba(24,64,110,.7)', n: 12, par: .24, kelp: 14 }, { h: 380, base: 'rgba(12,40,80,.85)', n: 10, par: .4, kelp: 18 }];
    specs.forEach((sp, li) => {
      const c = document.createElement('canvas'), w = 2048; c.width = w; c.height = sp.h;
      const g = c.getContext('2d'), R = mulberry32(31 + li * 7);
      g.fillStyle = sp.base;
      for (let k = 0; k < sp.n; k++) { const x = (k + R() * .6) / sp.n * w, r = 40 + R() * 90; for (const dx of [-w, 0, w]) { g.beginPath(); g.ellipse(x + dx, sp.h * .85, r, r * (.4 + R() * .3), 0, Math.PI, TAU); g.fill(); } }
      for (let k = 0; k < sp.kelp; k++) { const x = R() * w, h = sp.h * (.4 + R() * .55); for (const dx of [-w, 0, w]) { g.beginPath(); g.moveTo(x + dx, sp.h); for (let j = 0; j <= 8; j++) { const u = j / 8; g.lineTo(x + dx + Math.sin(u * 6 + k) * 14 + 4 * (1 - u), sp.h - h * u); } g.lineTo(x + dx + Math.sin(6 + k) * 14, sp.h - h - 10); for (let j = 8; j >= 0; j--) { const u = j / 8; g.lineTo(x + dx + Math.sin(u * 6 + k) * 14 - 4 * (1 - u), sp.h - h * u); } g.fill(); } }
      g.fillRect(0, sp.h * .9, w, sp.h * .1);
      layers.push({ img: c, par: sp.par, h: sp.h });
    });
  }

  /* ---------- the sea floor's cells ---------- */
  function cellColour(S, i, c, r, out, backWall) {
    const m = backWall ? S.orig[i] : S.mat[i];
    if (m === MAT.AIR) { out[0] = out[1] = out[2] = out[3] = 0; return; }
    const info = MAT_INFO[m], t = S.tex[i] / 255, x = S.cx(c), y = S.cy(r);
    let R = lerp(info.col[0], info.col2[0], t), Gc = lerp(info.col[1], info.col2[1], t), B = lerp(info.col[2], info.col2[2], t);
    let f = 1;
    const depth = y - S.surfaceAt(x);
    if (m === MAT.ROCK) { f *= 1 + Math.sin(x * .31 + Math.sin(y * .2) * 2) * .05 - (((c * 7 + r * 13) % 11) === 0 ? .18 : 0); if (depth > 30) f *= 1 - clamp((depth - 30) / 300, 0, .45); if (depth < 10 && x > WORLD.slopeL && x < WORLD.kelpR) { const pink = smoothstep(.55, .85, t) * .45; R = lerp(R, 190, pink); Gc = lerp(Gc, 120, pink); B = lerp(B, 150, pink); } }
    if (m === MAT.BOULDER) { f *= .92 + Math.sin(x * .7 + y * .5) * .08; const pink = smoothstep(.5, .8, t) * .5; R = lerp(R, 190, pink); Gc = lerp(Gc, 120, pink); B = lerp(B, 140, pink); }
    if (m === MAT.SAND || m === MAT.MUD || m === MAT.CLAY || m === MAT.GRAVEL) { f *= 1 - clamp(depth / 300, 0, 1) * .4; if (m === MAT.SAND && depth < 7) { R = lerp(R, 150, .4); Gc = lerp(Gc, 150, .4); B = lerp(B, 120, .4); } }
    if (m === MAT.SHELL) { f *= 1 + Math.sin(x * 1.1 + y * .9) * .12; }
    const dmg = S.dmg[i]; if (dmg > 0 && !backWall) f *= 1 - dmg * .3;
    if (backWall) { const sandy = m === MAT.SAND; R = sandy ? 70 + t * 14 : 34 + t * 12; Gc = sandy ? 58 + t * 10 : 30 + t * 7; B = sandy ? 40 + t * 6 : 24 + t * 4; f = 1; }
    out[0] = clamp(R * f, 0, 255); out[1] = clamp(Gc * f, 0, 255); out[2] = clamp(B * f, 0, 255); out[3] = 255;
  }
  function paintCells(S, c0, r0, c1, r1, backWall) {
    c0 = Math.max(0, c0); r0 = Math.max(0, r0); c1 = Math.min(S.cols - 1, c1); r1 = Math.min(S.rows - 1, r1);
    if (c1 < c0 || r1 < r0) return;
    const d = loImg.data, px = [0, 0, 0, 0], cols = S.cols, rows = S.rows;
    if (!smooth || smooth.length !== S.n * 4) smooth = new Float32Array(S.n * 4);
    for (let r = Math.max(0, r0 - 3); r <= Math.min(rows - 1, r1 + 3); r++) for (let c = Math.max(0, c0 - 3); c <= Math.min(cols - 1, c1 + 3); c++) {
      const i = r * cols + c; cellColour(S, i, c, r, px, backWall);
      const o = i * 4; d[o] = px[0]; d[o + 1] = px[1]; d[o + 2] = px[2]; d[o + 3] = px[3];
    }
    for (let r = Math.max(0, r0 - 1); r <= Math.min(rows - 1, r1 + 1); r++) for (let c = Math.max(0, c0 - 1); c <= Math.min(cols - 1, c1 + 1); c++) {
      let a = 0, R = 0, Gc = 0, B = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cc = clamp(c + dx, 0, cols - 1), rr2 = clamp(r + dy, 0, rows - 1), o = (rr2 * cols + cc) * 4;
        const wgt = (dx ? 1 : 2) * (dy ? 1 : 2) * d[o + 3] / 255;
        a += wgt; R += d[o] * wgt; Gc += d[o + 1] * wgt; B += d[o + 2] * wgt;
      }
      const o = (r * cols + c) * 4;
      smooth[o] = a ? R / a : 0; smooth[o + 1] = a ? Gc / a : 0; smooth[o + 2] = a ? B / a : 0; smooth[o + 3] = a / 16;
    }
    const w = (c1 - c0 + 1) * HI, h = (r1 - r0 + 1) * HI;
    const g = backWall ? backCtx : hiCtx;
    const img = g.createImageData(w, h), q = img.data, sm = smooth;
    for (let y = 0; y < h; y++) {
      const v = (r0 * HI + y + .5) / HI - .5, rA = Math.floor(v), fy = v - rA;
      const ra = clamp(rA, 0, rows - 1), rb = clamp(rA + 1, 0, rows - 1);
      for (let x = 0; x < w; x++) {
        const u = (c0 * HI + x + .5) / HI - .5, cA = Math.floor(u), fx = u - cA;
        const ca = clamp(cA, 0, cols - 1), cb = clamp(cA + 1, 0, cols - 1);
        const o1 = (ra * cols + ca) * 4, o2 = (ra * cols + cb) * 4, o3 = (rb * cols + ca) * 4, o4 = (rb * cols + cb) * 4;
        const w1 = (1 - fx) * (1 - fy) * sm[o1 + 3], w2 = fx * (1 - fy) * sm[o2 + 3], w3 = (1 - fx) * fy * sm[o3 + 3], w4 = fx * fy * sm[o4 + 3];
        const occ = w1 + w2 + w3 + w4;
        const A = clamp((occ - .5) * 5 + .5, 0, 1);
        const k = (y * w + x) * 4;
        if (A <= 0) { q[k + 3] = 0; continue; }
        q[k] = (sm[o1] * w1 + sm[o2] * w2 + sm[o3] * w3 + sm[o4] * w4) / occ;
        q[k + 1] = (sm[o1 + 1] * w1 + sm[o2 + 1] * w2 + sm[o3 + 1] * w3 + sm[o4 + 1] * w4) / occ;
        q[k + 2] = (sm[o1 + 2] * w1 + sm[o2 + 2] * w2 + sm[o3 + 2] * w3 + sm[o4 + 2] * w4) / occ;
        q[k + 3] = A * 255;
      }
    }
    g.putImageData(img, c0 * HI, r0 * HI);
  }
  function buildCells(S) {
    lo = document.createElement('canvas'); lo.width = S.cols; lo.height = S.rows; loImg = lo.getContext('2d').createImageData(S.cols, S.rows);
    hi = document.createElement('canvas'); hi.width = S.cols * HI; hi.height = S.rows * HI; hiCtx = hi.getContext('2d');
    back = document.createElement('canvas'); back.width = S.cols * HI; back.height = S.rows * HI; backCtx = back.getContext('2d');
    grainPat = ctx.createPattern(grain, 'repeat');
    if (grainPat.setTransform) grainPat.setTransform(new DOMMatrix().scale(.5, .5));
    for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, true);
    S.dirtyAll = false; S.paint.fill(0);
    for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, false);
    builtFor = S;
    buildDecor(S);
  }
  function updateCells(S) {
    if (builtFor !== S) buildCells(S);
    if (S.dirtyAll) { S.dirtyAll = false; S.paint.fill(0); for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, false); }
    for (let k = 0; k < S.paint.length; k++) if (S.paint[k]) {
      S.paint[k] = 0;
      const kc = k % S.ccols, kr = (k / S.ccols) | 0;
      paintCells(S, kc * CELL_CH - 2, kr * CELL_CH - 2, kc * CELL_CH + CELL_CH + 1, kr * CELL_CH + CELL_CH + 1, false);
    }
  }
  /* things growing on the sea floor, made once per world */
  /* things growing on the kelp reef, made once per world */
  function buildDecor(S) {
    const R = mulberry32(S.seed + 9);
    decor = { stars: [], anem: [], weed: [], shells: [], urchins: [] };
    const xs = () => lerp(WORLD.kelpL - 300, WORLD.beachX - 100, R());
    for (let k = 0; k < 30; k++) decor.stars.push({ x: xs(), s: .6 + R() * .8, col: pick(['#e07a3a', '#c85a8a', '#d8a040', '#8a4ab0']), a: R() * TAU });
    for (let k = 0; k < 30; k++) decor.anem.push({ x: xs(), s: .6 + R() * .9, col: pick(['#f0e8e0', '#ffd8c0', '#e8c0d8', '#f4a060']), ph: R() * TAU });
    for (let k = 0; k < 90; k++) decor.weed.push({ x: xs(), s: .5 + R() * 1, ph: R() * TAU, col: R() < .5 ? '#a04a4a' : '#7a6a2a' });
    for (let k = 0; k < 40; k++) decor.shells.push({ x: xs(), s: .5 + R() * .8, a: R() * TAU, col: pick(['#e8e0d0', '#d0c0b0', '#f0e8f0', '#c8b8a0']) });
    for (let k = 0; k < 24; k++) decor.urchins.push({ x: lerp(WORLD.kelpL, WORLD.kelpR, R()), s: .7 + R() * .6 });
  }
  function drawFloorDecor(G, Wd, S, view) {
    if (!decor || view.r < WORLD.kelpL - 400) return;
    const time = G.time;
    for (const w of decor.weed) { if (w.x < view.l - 20 || w.x > view.r + 20) continue; const y = S.topAt(w.x); ctx.strokeStyle = w.col; ctx.lineWidth = 1.4 * w.s; ctx.lineCap = 'round'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(w.x + k * 2, y + 2); ctx.quadraticCurveTo(w.x + k * 3 + Math.sin(time * 1.2 + w.ph + k) * 4, y - 8 * w.s, w.x + k * 2 + Math.sin(time + w.ph) * 6, y - 16 * w.s); ctx.stroke(); } }
    for (const sh of decor.shells) { if (sh.x < view.l || sh.x > view.r) continue; const y = S.topAt(sh.x); ctx.save(); ctx.translate(sh.x, y); ctx.rotate(sh.a * .2); ctx.fillStyle = sh.col; ctx.beginPath(); ctx.ellipse(0, 0, 3 * sh.s, 1.4 * sh.s, 0, Math.PI, TAU); ctx.fill(); ctx.restore(); }
    for (const u of decor.urchins) { if (u.x < view.l || u.x > view.r) continue; const y = S.topAt(u.x); ctx.save(); ctx.translate(u.x, y - 2 * u.s); ctx.scale(u.s * .8, u.s * .8); ctx.strokeStyle = '#6a3a8a'; ctx.lineWidth = .7; for (let i = 0; i < 20; i++) { const a = Math.PI + i / 20 * Math.PI * 1.1 - .05; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 3.2); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 6.4); ctx.stroke(); } ctx.fillStyle = '#4a2a6a'; ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 3.6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    for (const st of decor.stars) { if (st.x < view.l || st.x > view.r) continue; const y = S.topAt(st.x); ctx.save(); ctx.translate(st.x, y); ctx.rotate(st.a); ctx.scale(st.s, st.s * .55); ctx.fillStyle = st.col; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.6 : 7, a = i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
    for (const a of decor.anem) {
      if (a.x < view.l || a.x > view.r) continue; const y = S.topAt(a.x);
      ctx.fillStyle = a.col; ctx.beginPath(); ctx.ellipse(a.x, y - 2 * a.s, 3 * a.s, 3 * a.s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = a.col; ctx.lineWidth = 1 * a.s; ctx.lineCap = 'round';
      for (let k = 0; k < 12; k++) { const ang = -Math.PI + k / 11 * Math.PI; ctx.beginPath(); ctx.moveTo(a.x, y - 3 * a.s); ctx.lineTo(a.x + Math.cos(ang) * 8 * a.s + Math.sin(time * 1.5 + k + a.ph) * 2.5, y - 3 * a.s + Math.sin(ang) * 8 * a.s); ctx.stroke(); }
    }
  }
  /* the far coast: golden hills, Monterey cypress and a lighthouse, seen from out at sea near the shore */
  let shoreImg = null;
  function drawFarShore(G, seaSY, night) {
    const cam = G.cam, k = smoothstep(WORLD.slopeL - 900, WORLD.kelpL, cam.x);
    if (k < .02 || seaSY < 10) return;
    if (!shoreImg) {
      shoreImg = document.createElement('canvas'); shoreImg.width = 1400; shoreImg.height = 240;
      const g = shoreImg.getContext('2d'), R = mulberry32(44);
      const per = TAU / 1400; g.fillStyle = '#8a9aa0'; g.beginPath(); g.moveTo(0, 240); for (let x = 0; x <= 1400; x += 35) g.lineTo(x, 110 + Math.sin(x * per * 2) * 30 + Math.sin(x * per * 7 + 1) * 12); g.lineTo(1400, 240); g.fill();
      g.fillStyle = '#c8a860'; g.beginPath(); g.moveTo(0, 240); for (let x = 0; x <= 1400; x += 35) g.lineTo(x, 168 + Math.sin(x * per * 3 + 1) * 16 + Math.sin(x * per * 9) * 6); g.lineTo(1400, 240); g.fill();
      g.fillStyle = '#2a3a2a'; for (let x = 30; x < 1340; x += 40 + R() * 70) { const y = 176 + Math.sin(x * per * 3 + 1) * 16 + Math.sin(x * per * 9) * 6, w = 22 + R() * 26; g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x, y - 14); g.ellipse(x + 4, y - 18, w * .5, 7, -.15, 0, TAU); g.fill(); }
      g.fillStyle = '#f0f0f0'; g.fillRect(1180, 120, 14, 64); g.fillStyle = '#c02a20'; g.fillRect(1176, 112, 22, 10); g.fillStyle = '#ffe080'; g.fillRect(1181, 102, 12, 10);
      g.fillStyle = '#d8c8a0'; g.beginPath(); g.moveTo(0, 240); g.lineTo(0, 214); g.quadraticCurveTo(400, 206, 800, 212); g.quadraticCurveTo(1100, 206, 1400, 210); g.lineTo(1400, 240); g.fill();
    }
    const s = Math.max(.5, Math.min(1.1, cam.zoom * .5)), w = shoreImg.width * s, h = shoreImg.height * s;
    const x0 = W * .3 - (cam.x - WORLD.kelpL) * cam.zoom * .12, y0 = seaSY - h + 8 * s;
    ctx.save(); ctx.globalAlpha = k;
    ctx.filter = quality === 'low' ? 'none' : `brightness(${lerp(1, .3, night)})`;
    let xs = x0; while (xs > 0) xs -= w;
    for (let x = xs; x < W; x += w) ctx.drawImage(shoreImg, x, y0, w, h);
    ctx.restore(); ctx.filter = 'none';
    if (night > .3) { ctx.save(); ctx.globalAlpha = night * k * .35; ctx.fillStyle = '#ffe9a0'; const bx = x0 + 1187 * s, by = y0 + 107 * s, a = (G.time * .8) % TAU; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * 400, by + Math.sin(a) * 60 - 10); ctx.lineTo(bx + Math.cos(a + .25) * 400, by + Math.sin(a + .25) * 60 + 10); ctx.closePath(); ctx.fill(); ctx.restore(); }
  }
  /* which picture of the sunfish to draw for the player (or anyone at that stage) */
  function playerLook(p) {
    if (p.stage === 'larva') return { stage: p.zinstar === 1 ? 'larva' : 'star', spiky: p.zinstar === 1 ? 0 : p.zinstar === 2 ? .9 : 1.1 };
    if (p.stage === 'juvenile') return { stage: 'juvenile', spiky: p.jsize === 1 ? .55 : .2 };
    return { stage: 'mola', spiky: 0 };
  }
  /* a soft pulsing ring round a small you, so a child can find themselves among their brothers and sisters */
  function youRing(x, y, r, time) {
    ctx.save(); ctx.strokeStyle = `rgba(255,236,140,${.45 + .3 * Math.sin(time * 4)})`; ctx.lineWidth = Math.max(.25, r * .08);
    ctx.setLineDash([r * .35, r * .25]); ctx.beginPath(); ctx.arc(x, y, r * (1 + .06 * Math.sin(time * 4)), 0, TAU); ctx.stroke(); ctx.restore();
  }
  function drawPlayer(G, p, time) {
    if (p.stage === 'egg') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(time * 6) * p.crack * .3); Sprites.drawEgg(ctx, { s: .45, eye: p.flags.eggReady }); ctx.restore(); youRing(p.x, p.y, 9, time); return; }
    const L = playerLook(p), s = p.len / 100;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.face, 1); ctx.rotate(p.ang * p.face + p.spin);
    if (p.growing > 0) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.len * .9); g.addColorStop(0, `rgba(255,245,200,${.5 * Math.sin(p.growing / GROW_T * Math.PI)})`); g.addColorStop(1, 'rgba(255,245,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.len * .9, 0, TAU); ctx.fill(); }
    if (p.stage !== 'mola') { ctx.restore(); youRing(p.x, p.y, p.len * .95, time); ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.face, 1); ctx.rotate(p.ang * p.face + p.spin); }
    art().drawSunfish(ctx, { s, form: p.form, stage: L.stage, spiky: L.spiky, flap: p.flap, roll: p.roll, dark: p.dark, spots: p.mode === 'clean' ? .9 : p.mode === 'bask' ? .25 : 0, lice: p.stage === 'mola' ? p.itch : 0, eat: p.eatAnim, seed: 3 });
    ctx.restore();
  }
  function drawMolaAt(x, y, cm, form, face, flap, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(face, 1); if (o.ang) ctx.rotate(o.ang);
    art().drawSunfish(ctx, Object.assign({ s: molaUnits(cm) / 100, form, stage: 'mola', flap, seed: 5 }, o));
    ctx.restore();
  }
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  const SEA_STOPS = [[0, [70, 176, 222]], [80, [34, 128, 198]], [220, [14, 76, 146]], [420, [6, 36, 84]], [650, [3, 14, 38]], [950, [1, 5, 14]]];
  function seaCol(y) { let i = 0; while (i < SEA_STOPS.length - 2 && SEA_STOPS[i + 1][0] <= y) i++; const a = SEA_STOPS[i], b = SEA_STOPS[i + 1]; return mixRgb(a[1], b[1], clamp((y - a[0]) / (b[0] - a[0]), 0, 1)); }
  function sunMoonPos(tod, night, horizon, cloud) {
    const skyTop = horizon * .85, out = { sun: { x: W * .5, y: -H, vis: 0 }, moon: { x: W * .5, y: -H, vis: 0 } };
    if (tod > .22 && tod < .82) { const t = invLerp(.22, .82, tod); out.sun = { x: W * (.1 + .8 * t), y: horizon - Math.sin(Math.PI * t) * Math.max(80, skyTop) + 10, vis: (1 - cloud * .7) * clamp(Math.sin(Math.PI * t) * 4, 0, 1) }; }
    if (night > .05) { const t = tod > .5 ? invLerp(.78, 1.28, tod) : invLerp(-.22, .28, tod); out.moon = { x: W * (.15 + .7 * t), y: horizon - Math.sin(Math.PI * clamp(t, 0, 1)) * Math.max(80, skyTop) * .9 - 10, vis: night * (1 - cloud * .8) }; }
    return out;
  }
  /* the far shore above the surface: a dark line of firs, a lighthouse, a ferry's lights, seen when you are near the coast */
  function drawFarLayers(G, S, view, night) {
    const cam = G.cam;
    if (cam.x < WORLD.slopeL - 900) return;
    layers.forEach((L, li) => {
      const z = Math.min(1, cam.zoom) * (.6 + li * .15);
      const w = L.img.width * z, h = L.img.height * z;
      const floorSY = cam.toScreen(0, S.surfaceAt(cam.x) + 40 - li * 30)[1];
      const y = floorSY - h * .9;
      let x0 = (-(cam.x * cam.zoom * L.par) % w) - w; while (x0 > -w) x0 -= w;
      ctx.save(); ctx.globalAlpha = (1 - night * .5) * .9;
      for (let x = x0; x < W; x += w) ctx.drawImage(L.img, x, y, w, h);
      ctx.restore();
    });
  }
  function drawCellLayer(G, S, view) {
    const cam = G.cam, b = bufCtx;
    const sx0 = clamp(Math.floor((view.l - S.X0) / S.C) - 1, 0, S.cols), sy0 = clamp(Math.floor((view.t - S.Y0) / S.C) - 1, 0, S.rows);
    const sx1 = clamp(Math.ceil((view.r - S.X0) / S.C) + 1, 0, S.cols), sy1 = clamp(Math.ceil((view.b - S.Y0) / S.C) + 1, 0, S.rows);
    if (sx1 <= sx0 || sy1 <= sy0) return;
    const src = [sx0 * HI, sy0 * HI, (sx1 - sx0) * HI, (sy1 - sy0) * HI], dst = [S.X0 + sx0 * S.C, S.Y0 + sy0 * S.C, (sx1 - sx0) * S.C, (sy1 - sy0) * S.C];
    ctx.save(); cam.apply(ctx);
    ctx.drawImage(back, ...src, ...dst);
    if (view.b > WORLD.gridB && view.r > WORLD.gridL) { ctx.fillStyle = '#2a2622'; ctx.fillRect(Math.max(view.l, WORLD.gridL), WORLD.gridB - 1, view.r - Math.max(view.l, WORLD.gridL), view.b - WORLD.gridB + 1); }
    ctx.restore();
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, buf.width, buf.height);
    b.setTransform(DPR, 0, 0, DPR, 0, 0);
    b.save(); cam.apply(b);
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    b.drawImage(hi, ...src, ...dst);
    b.globalCompositeOperation = 'source-atop';
    b.globalAlpha = quality === 'low' ? .5 : .85; b.fillStyle = grainPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    b.globalAlpha = 1;
    const fp = painting() && Painted.floorPattern && Painted.floorPattern(b);
    if (fp) { b.fillStyle = fp; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t); }
    b.restore(); b.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (quality !== 'low') { ctx.shadowColor = 'rgba(2,6,14,.7)'; ctx.shadowBlur = 8 * DPR * Math.min(2, cam.zoom); ctx.shadowOffsetX = 1.5 * DPR * cam.zoom; ctx.shadowOffsetY = 2.5 * DPR * cam.zoom; }
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  }

  function drawSunMoon(G, tod, night, horizon, cloud) {
    const skyTop = horizon * .85;
    if (tod > .22 && tod < .82) {
      const t = invLerp(.22, .82, tod), x = W * (.1 + .8 * t), y = horizon - Math.sin(Math.PI * t) * Math.max(80, skyTop) + 10;
      ctx.globalAlpha = 1 - cloud * .7;
      const g = ctx.createRadialGradient(x, y, 8, x, y, 220); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(.12, 'rgba(255,230,160,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, y - 220, 440, 440);
      ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const t = tod > .5 ? invLerp(.78, 1.28, tod) : invLerp(-.22, .28, tod), x = W * (.15 + .7 * t), y = horizon - Math.sin(Math.PI * clamp(t, 0, 1)) * Math.max(80, skyTop) * .9 - 10;
      ctx.globalAlpha = night * (1 - cloud * .8);
      const g = ctx.createRadialGradient(x, y, 10, x, y, 220); g.addColorStop(0, 'rgba(220,235,255,.4)'); g.addColorStop(.2, 'rgba(160,190,255,.14)'); g.addColorStop(1, 'rgba(120,150,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, y - 220, 440, 440);
      drawMoonDisc(ctx, x, y, 28, G.moon);
      ctx.fillStyle = `rgba(230,240,255,${.22 * night * (1 - cloud)})`;
      for (let k = 0; k < 30; k++) { const yy = horizon + 4 + k * 6, ww = 30 + k * 10; ctx.fillRect(x - ww / 2 + Math.sin(G.time * 2 + k) * 8, yy, ww * (.4 + .3 * Math.sin(k * 1.7 + G.time)), 1.6); }
      ctx.globalAlpha = 1;
    }
  }
  function drawMoonDisc(c, x, y, r, phase) {
    const p = ((phase % 1) + 1) % 1, k = Math.cos(p * TAU), right = p < .5;
    c.fillStyle = 'rgba(60,70,100,.55)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (p > .02 && p < .98) {
      const mg = c.createRadialGradient(x - r * .3, y - r * .3, 2, x, y, r); mg.addColorStop(0, '#fffdf0'); mg.addColorStop(1, '#d9dcc8');
      c.fillStyle = mg;
      c.beginPath(); c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !right);
      c.ellipse(x, y, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, right === (k > 0));
      c.closePath(); c.fill();
    }
    c.fillStyle = 'rgba(150,150,130,.25)'; for (const [dx, dy, rr2] of [[-.3, -.2, .2], [.25, .15, .16], [.1, -.4, .1], [-.15, .35, .13]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, rr2 * r, 0, TAU); c.fill(); }
  }

  /* a crisp edge along the top of the floor, coloured by what it is made of */
  const RIM = {};
  RIM[MAT.SAND] = ['rgba(110,96,60,.5)', 'rgba(236,226,196,.9)']; RIM[MAT.MUD] = ['rgba(30,26,20,.55)', 'rgba(130,120,100,.9)']; RIM[MAT.CLAY] = RIM[MAT.MUD];
  RIM[MAT.ROCK] = ['rgba(40,38,34,.5)', 'rgba(190,186,176,.85)']; RIM[MAT.BOULDER] = ['rgba(60,56,50,.5)', 'rgba(220,210,200,.9)'];
  RIM[MAT.GRAVEL] = ['rgba(80,70,50,.5)', 'rgba(210,196,160,.85)']; RIM[MAT.SHELL] = ['rgba(90,80,70,.5)', 'rgba(240,232,220,.9)'];
  function drawRim(G, S, view) {
    const x0 = Math.max(view.l, WORLD.gridL), x1 = Math.min(view.r, WORLD.gridR), step = Math.max(1.5, 6 / G.cam.zoom);
    if (x1 <= x0) return;
    const lw = 2.2 / G.cam.zoom;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      let cur = null;
      for (let x = x0; x <= x1; x += step) {
        const t0 = S.topAt(x);
        if (t0 > S.surfaceAt(x) + 8) { if (cur) { ctx.stroke(); cur = null; } continue; }
        const y = (S.topAt(x - 8) + S.topAt(x - 4) + t0 * 2 + S.topAt(x + 4) + S.topAt(x + 8)) / 6, m = S.matAt(x, t0 + 2), col = (RIM[m] || RIM[MAT.ROCK])[pass], yy = y + (pass ? 0 : lw * 1.6);
        if (col !== cur) { if (cur) { ctx.lineTo(x, yy); ctx.stroke(); } cur = col; ctx.strokeStyle = col; ctx.lineWidth = pass ? lw : lw * 2.6; ctx.beginPath(); ctx.moveTo(x, yy); }
        else ctx.lineTo(x, yy);
      }
      if (cur) ctx.stroke();
    }
  }
  const shoals = Array.from({ length: 3 }, (_, i) => ({ ph: i * 2.1, y: .2 + i * .27, n: 26 + i * 6, dir: i % 2 ? -1 : 1, sp: .006 + i * .003 }));
  const twinkles = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * TAU, sp: .5 + Math.random() * 2 }));
  function drawDeepLife(G, night, time, shoalsOnly) {
    ctx.save();
    for (const sh of shoals) {
      const cx = (((sh.ph * .17 + time * sh.sp * sh.dir - G.cam.x * .00012) % 1.4) + 1.4) % 1.4 * W - W * .2, cy = sh.y * H + Math.sin(time * .2 + sh.ph) * 20 - G.cam.y * .02;
      ctx.fillStyle = `rgba(150,190,220,${.08 * (1 - night * .7)})`;
      for (let k = 0; k < sh.n; k++) { const a = k * 2.399 + time * .3 * sh.dir, r = Math.sqrt(k) * 9; const x = cx + Math.cos(a) * r * 1.8, y = cy + Math.sin(a) * r * .7; ctx.beginPath(); ctx.ellipse(x, y, 5, 1.6, sh.dir * .1, 0, TAU); ctx.fill(); }
    }
    if (night > .3 && !shoalsOnly) {
      ctx.globalCompositeOperation = 'lighter';
      for (const t of twinkles) { const b = Math.max(0, Math.sin(time * t.sp + t.ph)); if (b < .6) continue; const x = ((t.x - G.cam.x * .0004) % 1 + 1) % 1 * W, y = ((t.y - G.cam.y * .0004) % 1 + 1) % 1 * H; ctx.fillStyle = `rgba(110,220,255,${(b - .6) * 2 * night * .5})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + b, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  function drawSnow(G, time, dt, deep) {
    ctx.fillStyle = 'rgba(230,245,255,.55)';
    const n = quality === 'low' ? 40 : 60 + Math.round(deep * 30);
    for (let i = 0; i < n; i++) {
      const s = snow[i];
      s.y += dt * .01 * s.z; s.x += Math.sin(time * .3 + s.ph) * dt * .004;
      if (s.y > 1) s.y = 0;
      const x = ((s.x - G.cam.x * .0006 * s.z) % 1 + 1) % 1 * W, y = ((s.y - G.cam.y * .0006 * s.z) % 1 + 1) % 1 * H;
      ctx.globalAlpha = .2 + s.z * .4; ctx.fillRect(x, y, 1 + s.z * 1.4, 1 + s.z * 1.4);
    }
    ctx.globalAlpha = 1;
  }

  function arrow(x, y, a, col, alpha = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function pointTo(G, tx, ty, col, time) {
    const cam = G.cam, p = G.player, [sx, sy] = cam.toScreen(tx, ty), [px, py] = cam.toScreen(p.x, p.y);
    const a = Math.atan2(sy - py, sx - px), d = Math.min(Math.hypot(sx - px, sy - py) - 10, 70 + Math.sin(time * 5) * 10);
    if (d > 24) arrow(px + Math.cos(a) * d, py + Math.sin(a) * d, a, col, .75 + .25 * Math.sin(time * 5));
  }
  function ringMeter(G, cx, cy, u, ok, flash) {
    const R0 = 110, rr2 = lerp(R0, 26, u);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ok ? '#7dff7a' : 'rgba(255,230,140,.9)'; ctx.lineWidth = ok ? 8 : 5; ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, TAU); ctx.stroke();
    if (flash > 0) { ctx.strokeStyle = `rgba(255,255,200,${flash})`; ctx.lineWidth = 14 * flash; ctx.beginPath(); ctx.arc(cx, cy, 40 + (1 - flash) * 80, 0, TAU); ctx.stroke(); }
  }
  function drawSeaLife(G, Wd, view, night, time) {
    const A = art(), p = G.player, inView = (x, y, m = 80) => x > view.l - m && x < view.r + m && y > view.t - m && y < view.b + m;
    for (const f of Wd.smallFish) { if (!inView(f.x, f.y)) continue; ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir, 1); A.drawFish(ctx, { s: f.s * .5, ph: f.ph, col: f.col, col2: f.col2 }); ctx.restore(); }
    for (const c of Wd.cleaners) { if (!inView(c.x, c.y)) continue; ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.dir, 1); A.drawCleaner(ctx, c.kind, { s: c.s * (p.stage === 'mola' ? 1 : .7), ph: c.ph }); ctx.restore(); }
    for (const q of Wd.plankton) { if (inView(q.x, q.y, 10)) A.drawPlankton(ctx, q, night, time); }
    for (const j of Wd.combs) if (inView(j.x, j.y)) A.drawCombJelly(ctx, j, time);
    for (const f of Wd.food) {
      if (!inView(f.x, f.y, f.r * 4)) continue;
      ctx.save(); ctx.translate(f.x, f.y); if (f.eaten) { const k = 1 - f.gone / .6; ctx.globalAlpha = clamp(k, 0, 1); ctx.scale(k, k); }
      A.drawFood(ctx, f, time + f.ph); ctx.restore();
    }
    for (const e of Wd.babies) { if (!inView(e.x, e.y, 10)) continue; ctx.fillStyle = `rgba(240,250,255,${clamp(1.4 - e.t / 7, 0, .9)})`; ctx.beginPath(); ctx.arc(e.x, e.y, .9, 0, TAU); ctx.fill(); }
    for (const s of Wd.sibs) { if (!inView(s.x, s.y, 10)) continue; ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.vx < 0 ? -1 : 1, 1); A.drawSunfish(ctx, { s: p.len * .7 / 100, stage: s.z > 1 ? 'star' : 'larva', flap: s.ph, spiky: 1 }); ctx.restore(); }
    const sc = Wd.school;
    if (sc) for (const f of sc.fish) { const x = sc.x + f.dx, y = sc.y + f.dy + Math.sin(sc.t * 2 + f.ph) * 6; if (!inView(x, y)) continue; ctx.save(); ctx.translate(x, y); ctx.scale(sc.dir, 1); A.drawFish(ctx, { s: f.s * .36, ph: f.ph, col: '#c8d8e8', col2: '#3a5a7a' }); ctx.restore(); }
    for (const j of Wd.juvs) { if (!inView(j.x, j.y)) continue; ctx.save(); ctx.translate(j.x, j.y); ctx.scale(j.face, 1); A.drawSunfish(ctx, { s: p.len * j.s * .9 / 100, form: j.form, stage: 'juvenile', flap: j.ph, spiky: .3, seed: 9 }); ctx.restore(); }
    const m = Wd.mum;
    if (m) { ctx.save(); ctx.globalAlpha = 1 - m.fade; drawMolaAt(m.x, m.y, m.cm, m.form, m.face, m.ph * 3); ctx.restore(); }
    for (const o of Wd.mates) {
      if (!inView(o.x, o.y, 200)) continue;
      drawMolaAt(o.x, o.y, o.cm, o.form, o.face, o.ph * 1.2, { spots: o.heart ? .2 : 0 });
      if (o.heart && !o.met) { ctx.fillStyle = '#ff6a98'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; for (let k = 0; k < 3; k++) ctx.fillText('♥', o.x + (k - 1) * 22, o.y - molaUnits(o.cm) * .9 - Math.sin(time * 2 + k) * 6); }
    }
    for (const v of Wd.visitors) {
      if (!inView(v.x, v.y, 300)) continue;
      ctx.save(); ctx.translate(v.x, v.y); ctx.scale(v.dir, 1); if (v.state === 'lunge') ctx.rotate(Math.sin(v.t * 8) * .05);
      A.drawVisitor(ctx, v.kind, { s: v.len / 100, ph: v.ph });
      for (const q of v.pod) { ctx.save(); ctx.translate(q.dx * v.dir, q.dy); A.drawVisitor(ctx, v.kind, { s: v.len / 100 * q.s, ph: v.ph + q.ph }); ctx.restore(); }
      ctx.restore();
    }
  }
  function drawSurfaceThings(G, Wd, view, time) {
    const A = art(), b = Wd.boat, n = Wd.net, lvl = Wd.seaLevel();
    if (b.state !== 'away' && b.x > view.l - 300 && b.x < view.r + 300) { ctx.save(); ctx.translate(b.x, lvl + 2); ctx.scale(b.dir * .8, .8); A.drawBoat(ctx, { s: 1, ph: time }); ctx.restore(); if (b.slow < .5) { ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(b.x - b.dir * (100 + k * 18), lvl + 1, 10 - k, 2, 0, 0, TAU); ctx.fill(); } } }
    if (n.state === 'set' || n.state === 'haul' || n.state === 'lift') {
      const lift = n.lift || 0, h = n.h * (1 - lift * .75), x0 = n.x - n.w / 2 * (1 - lift * .5), x1 = n.x + n.w / 2 * (1 - lift * .5);
      ctx.save(); ctx.translate(n.x + 170, lvl + 2); ctx.scale(-.7, .7); A.drawBoat(ctx, { s: 1, ph: time, fishing: true }); ctx.restore();
      ctx.strokeStyle = 'rgba(235,235,215,.55)'; ctx.lineWidth = .8;
      for (let x = x0; x <= x1; x += 7) { ctx.beginPath(); ctx.moveTo(x, lvl); ctx.lineTo(x + Math.sin(time + x) * 3, lvl + h); ctx.stroke(); }
      for (let y = lvl; y <= lvl + h; y += 7) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y + Math.sin(time * .7 + y) * 2); ctx.stroke(); }
      ctx.fillStyle = '#f0a020'; for (let x = x0; x <= x1; x += 18) { ctx.beginPath(); ctx.ellipse(x, lvl - 1, 4, 2.6, 0, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(60,60,60,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, lvl + h); ctx.lineTo(x1, lvl + h); ctx.stroke();
    }
  }
  function drawGull(G, Wd) {
    const b = Wd.gull, p = G.player;
    if (b.state === 'hover' && (p.y > 160 || nightAmount(G.tod) > .6)) return;
    ctx.save(); ctx.translate(b.x, b.y);
    if (b.state === 'peck') { art().drawGullStand(ctx, { s: clamp(p.len / 150, .25, .7), ph: b.t * 3 }); ctx.restore(); return; }
    if (b.state === 'dive') ctx.rotate(.4 * Math.cos(b.t * 2));
    if (b.state === 'leave' || b.state === 'land') ctx.scale(b.state === 'leave' ? 1 : -1, 1);
    art().drawGull(ctx, { s: p.stage === 'mola' ? clamp(p.len / 300, .12, .3) : b.state === 'dive' ? .4 : .32, ph: b.ph * 4 });
    ctx.restore();
    if (b.state === 'dive' && b.y > Wd.seaLevel() - 6) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(b.x, Wd.seaLevel(), 10, 2, 0, 0, TAU); ctx.fill(); }
  }
  function drawKelpLayer(G, Wd, view, front) {
    if (view.r < WORLD.kelpL - 200) return;
    Wd.kelp.forEach((k, i) => { if ((i % 3 === 0) !== front || k.x < view.l - 60 || k.x > view.r + 60) return; art().drawKelp(ctx, k, G.time); });
  }
  /* glows on top of the light: glowing plankton at night, the eggs, the swell while letting eggs go */
  function drawGlows(G, Wd, view, night, time) {
    const p = G.player;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of Wd.plankton) { if (q.kind !== 'dino') continue; const gl = night * .25 + q.glow; if (gl < .05) continue; const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 6); g.addColorStop(0, `rgba(120,230,255,${Math.min(.9, gl)})`); g.addColorStop(1, 'rgba(120,230,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, TAU); ctx.fill(); }
    if (Wd.babies.length) { ctx.fillStyle = 'rgba(220,240,255,.18)'; for (const e of Wd.babies) { ctx.beginPath(); ctx.arc(e.x, e.y, 2.2, 0, TAU); ctx.fill(); } }
    /* deep jellies give off a faint blue light in the dark */
    const deepK = clamp((G.cam.y - 250) / 300, 0, 1);
    if (deepK > .05) for (const f of Wd.food) { if (f.eaten || (f.kind !== 'comb' && f.kind !== 'salp')) continue; const r = f.r * 1.6, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); g.addColorStop(0, `rgba(110,200,255,${.22 * deepK})`); g.addColorStop(1, 'rgba(110,200,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill(); }
    if (p.mode === 'release') { const sw = Wd.swash(), r = p.len * (1 + sw * .6), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(255,240,200,${.35 * sw})`); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); }
    if (p.mode === 'bask' && night < .5) { const r = p.len * .9, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, 'rgba(255,220,140,.25)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function frame(G, dt, clean) {
    const { cam, world: Wd, tod, time } = G, S = Wd.ground, weather = Wd.weather, p = G.player;
    const night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    updateCells(S);
    const gx = typeof GFX !== 'undefined' && GFX.active(), mainCtx = ctx;
    if (gx && typeof Painted !== 'undefined') Painted.beginFrame();
    if (gx) { ctx = GFX.worldCtx(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    const view = cam.viewRect(80);
    const seaSY = cam.toScreen(0, Wd.seaLevel())[1];
    const warmK = smoothstep(WORLD.warmR + 600, WORLD.warmR - 400, cam.x);
    /* --- the sea: bright blue at the top, black in the deep (turquoise in the warm sea) --- */
    if (!gx) {
      const top = Math.max(0, view.t), bot = Math.max(top + 10, view.b);
      const sea = ctx.createLinearGradient(0, cam.toScreen(0, top)[1], 0, cam.toScreen(0, bot)[1]);
      for (let k = 0; k <= 6; k++) { const d = lerp(top, bot, k / 6); sea.addColorStop(k / 6, rgbStr(mixRgb(mixRgb(seaCol(d), [40, 190, 200], warmK * .35 * (1 - clamp(d / 500, 0, 1))), [6, 14, 34], night * .62))); }
      ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
    }
    let [skyT, skyB] = skyColours(tod);
    if (weather.cloud > .01) { skyT = mixHex(skyT, '#3a4450', weather.cloud * .6); skyB = mixHex(skyB, '#7a8a90', weather.cloud * .55); }
    if (seaSY > -40) {
      if (!gx) {
        const sky = ctx.createLinearGradient(0, 0, 0, Math.max(60, seaSY)); sky.addColorStop(0, skyT); sky.addColorStop(1, skyB);
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, Math.max(0, seaSY));
        if (night > .05 && weather.cloud < .85) { for (const [sx, sy, r, ph] of stars) { const y = sy * seaSY; if (y > seaSY - 10) continue; ctx.globalAlpha = night * (0.3 + .7 * (.5 + .5 * Math.sin(time * 2 + ph * 6))) * (1 - weather.cloud); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * W, y, .5 + r * 1.2, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
        drawSunMoon(G, tod, night, seaSY, weather.cloud);
      }
      drawFarShore(G, seaSY, night);
      ctx.save(); cam.apply(ctx);
      if (!gx) {
        ctx.strokeStyle = `rgba(240,250,255,${.8 - night * .4})`; ctx.lineWidth = 2 / Math.max(.6, cam.zoom) * 2;
        ctx.beginPath(); for (let x = view.l; x <= view.r; x += 5) { const y = Wd.surfaceY(x); x === view.l ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      }
      if (weather.storm > .05) { ctx.fillStyle = `rgba(255,255,255,${.35 * weather.storm})`; for (let x = view.l; x <= view.r; x += 40) { const y = Wd.surfaceY(x); ctx.beginPath(); ctx.ellipse(x + Math.sin(time * 2 + x) * 6, y - 1, 12, 2.5, 0, 0, TAU); ctx.fill(); } }
      ctx.restore();
    }
    const day = 1 - night;
    if (!gx && day > .05 && seaSY < H) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fade = 1 - clamp(Math.max(0, view.t) / 500, 0, .9);
      for (let k = 0; k < 10; k++) {
        const bx = (k / 10 + ((time * .01 + k * .37) % .1)) * W, len = Math.max(60, cam.toScreen(0, Wd.seaLevel() + 520)[1] - seaSY);
        const lg = ctx.createLinearGradient(0, Math.max(0, seaSY), 0, Math.max(0, seaSY) + len);
        lg.addColorStop(0, `rgba(210,245,255,${.16 * day * (1 - weather.cloud * .7) * fade})`); lg.addColorStop(1, 'rgba(210,245,255,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(bx, seaSY); ctx.lineTo(bx + 34 + Math.sin(time * .5 + k) * 10, seaSY); ctx.lineTo(bx + 170, seaSY + len); ctx.lineTo(bx + 80, seaSY + len); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    if (!gx) drawFarLayers(G, S, view, night);
    drawDeepLife(G, night, time, true);
    /* ---------------- world space ---------------- */
    ctx.save(); cam.apply(ctx); drawKelpLayer(G, Wd, view, false); ctx.restore();
    drawCellLayer(G, S, view);
    ctx.save(); cam.apply(ctx);
    drawRim(G, S, view);
    drawFloorDecor(G, Wd, S, view);
    drawSeaLife(G, Wd, view, night, time);
    drawSurfaceThings(G, Wd, view, time);
    drawPlayer(G, p, time);
    G.particles.draw(ctx, cam);
    drawKelpLayer(G, Wd, view, true);
    drawGull(G, Wd);
    ctx.restore();
    /* ---------------- light ---------------- */
    const deep = clamp((cam.y - 150) / 600, 0, 1);
    const warmLight = (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - weather.cloud) * (1 - deep);
    if (gx) {
      const sm = sunMoonPos(tod, night, seaSY, weather.cloud);
      GFX.render(G, { night, warm: warmLight, deep, top: skyT, bot: skyB, sun: sm.sun, moon: sm.moon, seaLevel: Wd.seaLevel(), surf: (sx) => cam.toScreen(0, Wd.surfaceY((sx - W / 2) / cam.zoom + cam.x))[1],
        floorY: Math.min(Wd.floorAt(cam.x), 1600), farK: clamp((cam.x - (WORLD.slopeL - 500)) / 400, 0, 1), winter: false, underground: false });
      ctx = mainCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.save(); cam.apply(ctx); drawGlows(G, Wd, view, night, time); ctx.restore();
      if (!clean) drawOverlays(G, night, time);
      Cinematic.draw(ctx, W, H);
      return;
    }
    /* the deep is dark: a multiply that grows with depth down the screen, and the night over it all */
    const y100 = cam.toScreen(0, 120)[1], y900 = cam.toScreen(0, 900)[1];
    if (y900 > 0 && y100 < H) {
      ctx.globalCompositeOperation = 'multiply';
      const dg = ctx.createLinearGradient(0, y100, 0, y900); dg.addColorStop(0, 'rgb(255,255,255)'); dg.addColorStop(.45, 'rgb(120,150,200)'); dg.addColorStop(1, 'rgb(22,34,70)');
      ctx.fillStyle = dg; ctx.fillRect(0, Math.max(0, y100), W, H - Math.max(0, y100));
      ctx.globalCompositeOperation = 'source-over';
    }
    const dark = Math.max(night * .7, weather.cloud * .22);
    if (dark > .01) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${lerp(255, 60, dark) | 0},${lerp(255, 90, dark) | 0},${lerp(255, 150, dark) | 0})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (warmLight > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,70,${warmLight * .4})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    ctx.save(); cam.apply(ctx); drawGlows(G, Wd, view, night, time); ctx.restore();
    drawDeepLife(G, night, time);
    drawSnow(G, time, dt, deep);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(2,14,34,${.35 + night * .2})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (!clean) drawOverlays(G, night, time);
    Cinematic.draw(ctx, W, H);
  }
  function bar(x, y, w, h, u, col, icon) {
    ctx.fillStyle = 'rgba(10,20,40,.55)'; rr(ctx, x - 3, y - 3, w + 6, h + 6, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(ctx, x, y, w, h, 4); ctx.fill();
    const fh = h * clamp(u, 0, 1); ctx.fillStyle = col; rr(ctx, x, y + h - fh, w, fh, 4); ctx.fill();
    ctx.font = `16px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(icon, x + w / 2, y - 4);
  }
  function drawOverlays(G, night, time) {
    const p = G.player, Wd = G.world, cam = G.cam;
    if (p.stage === 'egg') { if (G.settings.labels) drawLabels(G); return; }
    const [px, py] = cam.toScreen(p.x, p.y), rad = Math.max(18, p.len * cam.zoom * .55);
    if (p.homeHint) pointTo(G, p.homeHint.x, p.homeHint.y, '#ffd23f', time);
    else if (p.stage === 'juvenile' && !p.inSchool && Wd.schoolC) pointTo(G, Wd.schoolC.x, Wd.schoolC.y, '#9fe0ff', time);
    else if (p.flags.arrived && !p.flags.met) { const m = Wd.mates.find(o => o.heart && !o.met); if (m) pointTo(G, m.x, m.y, '#ff8ab0', time); }
    const ctxv = p.context ? p.context() : null;
    if (ctxv === 'eat') { const mo = p.mouth(), f = Wd.foodNear(mo.x, mo.y, p.len * .35 + 6); if (f) { const [fx, fy] = cam.toScreen(f.x, f.y); ctx.strokeStyle = `rgba(255,240,140,${.6 + .4 * Math.sin(time * 6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx, fy, f.r * cam.zoom + 8, 0, TAU); ctx.stroke(); } }
    if (ctxv === 'bask' && p.warm < .9) { ctx.font = `900 22px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('☀️', px, py - rad - 18 + Math.sin(time * 4) * 4); }
    if (p.stage === 'mola' && p.mode !== 'release' && !p.flags.journey) {
      const x = Math.max(16, px - rad - 30), y = py - 34;
      bar(x, y, 12, 64, p.warm, p.warm < .3 ? '#5ab0ff' : rgbStr(mixRgb([90, 170, 255], [255, 150, 60], p.warm)), '🌡️');
      if (p.itch > .25) bar(x - 26, y, 12, 64, p.itch, '#b08060', '🐛');
    }
    if (p.mode === 'clean' || p.mode === 'bask') {
      const u = p.mode === 'clean' ? p.cleanT / CLEAN_T : p.warm;
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(px, py - rad - 30, 16, 0, TAU); ctx.stroke();
      ctx.strokeStyle = p.mode === 'clean' ? '#ffe070' : '#ffb050'; ctx.beginPath(); ctx.arc(px, py - rad - 30, 16, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(u, 0, 1)); ctx.stroke();
    }
    if (p.mode === 'release') {
      ringMeter(G, px, py - rad - 60, Wd.swash(), p.releaseWindow(), 0);
      ctx.font = `900 18px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff8e0'; ctx.fillText(`${fmtInt(p.stats.eggsOut)} eggs`, px, py + rad + 26);
    }
    if (G.settings.labels) drawLabels(G);
    drawScale(G);
  }
  /* a ruler in the corner at the world's own scale, with something to compare with: a grain of rice, a hand, a child */
  function drawScale(G) {
    const p = G.player, cam = G.cam; if (p.stage === 'egg') return;
    const pxPerM = cam.zoom * p.len / (p.cm / 100);
    const ref = p.cm < 2.5 ? { m: .005, name: 'a grain of rice', key: 'rice' } : p.cm < 40 ? { m: .18, name: 'a grown-up\'s hand', key: 'hand' } : { m: 1.2, name: 'a child', key: 'child' };
    const h = ref.m * pxPerM; if (h < 6 || h > H * .45) return;
    const pad = document.body.classList.contains('pad-on'), x = 22, y = H - (pad ? (W < 700 ? 250 : 200) : 40);   /* clear of the hint and the touch pad */
    ctx.save(); ctx.globalAlpha = .85;
    ctx.fillStyle = 'rgba(255,250,235,.9)'; ctx.strokeStyle = 'rgba(20,30,40,.6)'; ctx.lineWidth = 1.5;
    if (ref.key === 'rice') { ctx.beginPath(); ctx.ellipse(x + h * .5, y - h * .2, h * .5, h * .2, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (ref.key === 'hand') { const R2 = (...q) => { rr(ctx, ...q); ctx.fill(); ctx.stroke(); }; for (let k = 0; k < 4; k++) { const fx = x + h * (.09 + k * .085), top = y - h * (.86 + (k === 1 || k === 2 ? .1 : 0)) + (k === 3 ? h * .12 : 0); R2(fx - h * .035, top, h * .07, h * .45, h * .035); } R2(x + h * .05, y - h * .48, h * .36, h * .48, h * .1); ctx.save(); ctx.translate(x + h * .38, y - h * .3); ctx.rotate(-.7); R2(0, -h * .04, h * .26, h * .08, h * .04); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(x + h * .15, y - h * .9, h * .1, 0, TAU); ctx.fill(); ctx.stroke(); rr(ctx, x + h * .05, y - h * .78, h * .2, h * .42, h * .06); ctx.fill(); ctx.stroke(); ctx.fillRect(x + h * .07, y - h * .38, h * .07, h * .38); ctx.fillRect(x + h * .16, y - h * .38, h * .07, h * .38); }
    ctx.font = `800 12px ${UI_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#fffbea';
    const sz = p.cm < 1 ? `${(p.cm * 10).toFixed(1)} mm` : p.cm < 100 ? `${p.cm.toFixed(0)} cm` : `${(p.cm / 100).toFixed(1)} m`;
    ctx.fillText(`Me: ${sz} · beside ${ref.name}`, x, y + 16);
    ctx.restore();
  }
  function drawLabels(G) {
    const cam = G.cam, Wd = G.world, p = G.player;
    ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, t) => { const [sx, sy] = cam.toScreen(x, y); if (sx < 0 || sx > W || sy < 100 || sy > H) return; const w = ctx.measureText(t).width + 14; ctx.fillStyle = 'rgba(255,252,240,.85)'; rr(ctx, sx - w / 2, sy - 11, w, 22, 11); ctx.fill(); ctx.fillStyle = '#2a2016'; ctx.fillText(t, sx, sy); };
    const seen = new Set();
    for (const q of Wd.plankton) { if (seen.has(q.kind) || Math.hypot(q.x - p.x, q.y - p.y) > 60) continue; seen.add(q.kind); tag(q.x, q.y - 6, { copepod: 'copepod', krill: 'krill', dino: 'glowing plankton' }[q.kind]); }
    for (const f of Wd.food) { if (f.eaten || seen.has(f.kind) || Math.hypot(f.x - p.x, f.y - p.y) > 400) continue; seen.add(f.kind); tag(f.x, f.y - f.r - 10, FOOD_KINDS[f.kind].name); }
    for (const j of Wd.combs) if (Math.abs(j.x - p.x) < 300) { tag(j.x, j.y - j.r - 12, 'comb jelly'); break; }
    if (Wd.school) tag(Wd.school.x, Wd.school.y - 40, 'anchovies');
    for (const v of Wd.visitors) tag(v.x, v.y - v.len * .3, VISITOR_KINDS[v.kind].name);
    if (Math.abs(Wd.station.x - p.x) < 900) tag(Wd.station.x, Wd.station.floor - 150, 'cleaning station');
    for (const c of Wd.cleaners) if (!seen.has(c.kind) && Math.abs(c.x - p.x) < 300) { seen.add(c.kind); tag(c.x, c.y - 12, c.kind === 'senorita' ? 'señorita' : 'halfmoon'); }
    for (const k of Wd.kelp) if (Math.abs(k.x - p.x) < 150) { tag(k.x, k.root - k.h * .6, 'giant kelp'); break; }
    if (Wd.boat.state !== 'away') tag(Wd.boat.x, Wd.seaLevel() - 70, 'a boat');
    if (Wd.net.state === 'set') tag(Wd.net.x, Wd.seaLevel() + Wd.net.h + 14, 'fishing net');
    for (const m of Wd.mates) if (Math.abs(m.x - p.x) < 600) tag(m.x, m.y - molaUnits(m.cm) * .8, m.sex === 'girl' ? 'girl sunfish' : 'boy sunfish');
    tag(p.x, p.y - Math.max(p.len * .7, 8) - 10, STAGES[STAGE_INDEX[p.stageKey()]].name);
  }
  function snapshot(G) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    frame(G, 0, true);
    if (typeof GFX !== 'undefined' && GFX.active()) c.getContext('2d').drawImage(GFX.canvas(), 0, 0, c.width, c.height);
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }
  function invalidate() { builtFor = null; }

  return { init, resize, setQuality, getFps, frame, snapshot, invalidate, skyColours, drawMoonDisc };
})();
