/* ============================================================
   render.js — the sea and the island, back to front
   ============================================================
     sky (time of day, weather) · stars · the sun · the moon in
     its real phase
     the far ocean to the horizon, with the sun's glitter on it;
     far rainforest hills behind the plateau
     THE SEA you are in: blue getting darker with depth, light
     rays from the surface by day, specks of marine snow
     trees: their trunks, buttress roots and the canopy far above
     THE ISLAND in cross-section (reef, rock, sand, red soil, the
     road and the bridge), painted from cells at 4x with smooth
     edges (Ant Kingdom's method), burrows showing dark soil
     behind them
     coral, sea grass, rock pools, leaf litter, ferns, the ranger
     food, shed shells, the crab crowds, other crabs, YOU
     plankton, jellies, fish, the whale shark, the manta
     the water's tint over everything under the surface · foam
     the rocks you hide under (in front of you) · rain
     night (a moonlit multiply) · glowing plankton (additive)
     overlays: the pushing ring and meter, the wave meter for the
     eggs, arrows to where you are going, name tags
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1, quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  const HI = 4;
  const SKY = [
    [0.00, '#070b22', '#14234a'], [0.19, '#141a44', '#5a3a62'], [0.25, '#7a8fc8', '#ffb98a'],
    [0.36, '#58a8e0', '#cfeee6'], [0.55, '#4b9ce0', '#c9eadf'], [0.70, '#6aa0d8', '#ffd2a0'],
    [0.79, '#3d3f8c', '#ff8a5c'], [0.86, '#121a48', '#3a2f5c'], [1.00, '#070b22', '#14234a']
  ];
  const stars = [], snow = [];
  let layers = [];
  let lo = null, loImg = null, hi = null, hiCtx = null, back = null, backCtx = null, smooth = null;
  let buf = null, bufCtx = null, grainPat = null, grain = null;
  let builtFor = null, decor = null;
  const fore = [];
  const crowdCache = new Map();

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    for (let i = 0; i < 220; i++) stars.push([Math.random(), Math.random() * .8, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 90; i++) snow.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, ph: Math.random() * TAU });
    buildGrain();
    buildLayers();
    for (let i = 0; i < 7; i++) fore.push({ x: i / 7 + Math.random() * .08, s: .8 + Math.random() * .7, a: Math.random() * TAU, side: i % 2 });
  }
  function resize(w, h, dpr) {
    W = w; H = h; DPR = quality === 'low' ? 1 : dpr;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    buf = document.createElement('canvas'); buf.width = canvas.width; buf.height = canvas.height; bufCtx = buf.getContext('2d');
  }
  function setQuality(q) { if (q !== quality) { quality = q; resize(W, H, Math.min(2, devicePixelRatio || 1)); } }
  function getFps() { return fps; }

  /* ---------- textures ---------- */
  function buildGrain() {
    grain = document.createElement('canvas'); grain.width = grain.height = 256;
    const g = grain.getContext('2d'), R = mulberry32(99);
    for (let i = 0; i < 5000; i++) { const v = R(); g.fillStyle = v < .55 ? `rgba(0,0,0,${R() * .22})` : `rgba(255,245,225,${R() * .14})`; g.fillRect(R() * 256, R() * 256, 1 + (R() < .3), 1 + (R() < .3)); }
    /* little pits and pebbles */
    for (let i = 0; i < 140; i++) { const x = R() * 256, y = R() * 256, r = .6 + R() * 1.8; g.fillStyle = `rgba(0,0,0,${.1 + R() * .15})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = `rgba(255,250,235,${.08 + R() * .1})`; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .5, 0, TAU); g.fill(); }
  }
  /* three tileable bands of rainforest silhouettes for behind the plateau */
  function buildLayers() {
    layers = [];
    const specs = [{ h: 420, base: '#7fa89a', crowns: 22, par: .12, y: 0 }, { h: 460, base: '#4f7d6a', crowns: 18, par: .24, y: 40 }, { h: 500, base: '#2f5a48', crowns: 14, par: .4, y: 90 }];
    specs.forEach((sp, li) => {
      const c = document.createElement('canvas'), w = 2048; c.width = w; c.height = sp.h;
      const g = c.getContext('2d'), R = mulberry32(31 + li * 7);
      g.fillStyle = sp.base;
      const crown = (x, y, r) => { for (let k = 0; k < 7; k++) { const a = R() * Math.PI - Math.PI, d = r * .55; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .6, r * (.5 + R() * .35), 0, TAU); g.fill(); } };
      for (let k = 0; k < sp.crowns; k++) {
        const x = (k + R() * .6) / sp.crowns * w, top = sp.h * (.12 + R() * .35), r = 50 + R() * 70;
        g.fillRect(x - 5 - li * 2, top, 10 + li * 4, sp.h - top);
        for (const dx of [-w, 0, w]) crown(x + dx, top, r);
      }
      g.fillRect(0, sp.h * .78, w, sp.h * .22);
      layers.push({ img: c, par: sp.par, y: sp.y, h: sp.h });
    });
  }

  /* ---------- the island's cells ---------- */
  const CORAL_COLS = [[236, 108, 120], [246, 156, 80], [178, 104, 210], [200, 214, 96], [240, 200, 210], [98, 196, 186]];
  function cellColour(S, i, c, r, out, backWall) {
    const m = backWall ? S.orig[i] : S.mat[i];
    if (m === MAT.AIR || m === MAT.BRIDGE || m === MAT.FENCE) { out[0] = out[1] = out[2] = out[3] = 0; return; }
    const info = MAT_INFO[m], t = S.tex[i] / 255, x = S.cx(c), y = S.cy(r);
    let R = lerp(info.col[0], info.col2[0], t), Gc = lerp(info.col[1], info.col2[1], t), B = lerp(info.col[2], info.col2[2], t);
    let f = 1;
    const depth = y - S.surfaceAt(x);
    if (m === MAT.ROCK) {
      /* weathered limestone: pale, pitted, with dark streaks down the cliff */
      f *= 1 + Math.sin(x * .31 + Math.sin(y * .2) * 2) * .05 - (((c * 7 + r * 13) % 11) === 0 ? .18 : 0);
      if (x > WORLD.cliffL && x < WORLD.cliffR) f *= .92 + Math.sin(x * .9) * .06;
      if (depth > 30) f *= 1 - clamp((depth - 30) / 300, 0, .45);
      /* limestone lumps in the forest soil: stained brown */
      if (x > WORLD.cliffR + 20) { R = lerp(R, 118, .55); Gc = lerp(Gc, 92, .55); B = lerp(B, 76, .55); }
    }
    if (m === MAT.CORAL) {
      /* old coral rock: rose-grey, with a living tint in patches */
      const k = CORAL_COLS[((c / 7 | 0) * 3 + (r / 5 | 0) * 5) % CORAL_COLS.length], live = smoothstep(.45, .8, t) * .35;
      R = lerp(168, k[0], live); Gc = lerp(140, k[1], live); B = lerp(138, k[2], live); f *= .8 + t * .3;
    }
    if (m === MAT.SAND || m === MAT.SOIL || m === MAT.ROOT) {
      f *= 1 - clamp(depth / 300, 0, 1) * .4;
      if (m === MAT.SOIL && depth < 9) { R = lerp(R, 74, .5); Gc = lerp(Gc, 50, .5); B = lerp(B, 30, .5); }     /* a dark leafy topsoil */
      if (x < -150 && m === MAT.SAND) { R = 226; Gc = 210; B = 170; }                                   /* white reef sand */
    }
    if (m === MAT.ROAD) f *= .95 + t * .1;
    if (m === MAT.PLUG) { R = lerp(170, 120, t); Gc = lerp(130, 90, t); B = lerp(60, 40, t); }
    const dmg = S.dmg[i]; if (dmg > 0 && !backWall) f *= 1 - dmg * .3;
    if (backWall) {
      /* the far side of a dug burrow: dark, damp soil */
      const sandy = m === MAT.SAND;
      R = sandy ? 62 + t * 14 : 34 + t * 12; Gc = sandy ? 44 + t * 10 : 18 + t * 7; B = sandy ? 28 + t * 6 : 12 + t * 4;
      f = 1;
    }
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
  /* things growing on the surface, made once per world */
  function buildDecor(S) {
    const R = mulberry32(S.seed + 9);
    decor = { litter: [], ferns: [], grass: [], weed: [], fans: [], anem: [], pools: [], vines: [] };
    for (let x = 960; x < WORLD.right; x += 3 + R() * 5) { if (x > WORLD.roadL - 4 && x < WORLD.roadR + 4) continue; decor.litter.push({ x, a: R() * TAU, s: .5 + R() * .8, col: pick(['#7a4a24', '#9a5a2a', '#a8742e', '#5a3a1a', '#b8903a', '#6a5a2a', '#c8a050']) }); }
    for (let k = 0; k < 70; k++) { const x = lerp(980, WORLD.right - 40, R()); if (x > WORLD.bridgeL - 40 && x < WORLD.bridgeR + 40) continue; decor.ferns.push({ x, s: .6 + R() * .8, kind: R() < .6 ? 'fern' : 'broad', flip: R() < .5 ? -1 : 1, ph: R() * TAU }); }
    for (let x = WORLD.terraceL - 40; x < WORLD.cliffL + 10; x += 6 + R() * 10) decor.grass.push({ x, s: .5 + R() * .7, ph: R() * TAU, col: R() < .5 ? '#7a9a3a' : '#9aaa4a' });
    for (const [x0, x1] of [[700, 730], [762, 794], [840, 905]]) for (let k = 0; k < 4; k++) decor.ferns.push({ x: lerp(x0, x1, R()), s: .35 + R() * .3, kind: 'fern', flip: R() < .5 ? -1 : 1, ph: R() * TAU, cliff: true });
    for (let k = 0; k < 80; k++) { const x = lerp(-1080, -30, R()); decor.weed.push({ x, s: .6 + R() * 1.1, ph: R() * TAU, col: R() < .5 ? '#3a8a5a' : '#6aa04a' }); }
    for (let k = 0; k < 22; k++) decor.fans.push({ x: lerp(-1050, -200, R()), s: .7 + R() * .9, col: pick(['#c84a8a', '#e86a4a', '#a85ad0', '#f0a040']), ph: R() * TAU });
    for (let k = 0; k < 16; k++) decor.anem.push({ x: lerp(-720, -180, R()), s: .7 + R() * .6, col: pick(['#ff8aa0', '#ffd27a', '#b8f0a0']), ph: R() * TAU });
    decor.brain = []; for (let k = 0; k < 18; k++) decor.brain.push({ x: lerp(-1080, -190, R()), s: .7 + R() * .9, col: pick(['#d8a070', '#c8b070', '#e09090', '#a8c080']), kind: R() < .55 ? 'brain' : 'table' });
    for (const x of [24, 70, 112]) decor.pools.push({ x: x + R() * 10, w: 14 + R() * 10 });
  }

  /* a crowd crab, pre-drawn for speed (form, size, sex, walking frame) */
  function crowdSprite(form, px, male, frame) {
    const key = `${form}|${px}|${male}|${frame}`;
    let c = crowdCache.get(key); if (c) return c;
    /* wide enough for the legs' full splay: about three shells across */
    c = document.createElement('canvas'); const w = Math.ceil(px * 3.1), h = Math.ceil(px * 1.05); c.width = w * 2; c.height = h * 2;
    const g = c.getContext('2d'); g.scale(2, 2); g.translate(w / 2, px * .5);
    Sprites.drawCrab(g, { s: px / 100, form, sex: male ? 'boy' : 'girl', walk: frame / 6 * TAU, moving: true, seed: frame + 2 });
    crowdCache.set(key, c);
    if (crowdCache.size > 400) crowdCache.delete(crowdCache.keys().next().value);
    return c;
  }
  function drawCrowdCrab(x, y, w, form, male, ph) {
    const px = Math.max(4, Math.round(w)), frame = ((Math.floor(ph) % 6) + 6) % 6, img = crowdSprite(form, px, male, frame);
    const iw = img.width / 2, ih = img.height / 2;
    ctx.drawImage(img, x - iw / 2, y - px * .5, iw, ih);
  }

  /* ---------- trees ---------- */
  const clumpCache = new Map();
  function clump(r, seed, tint) {
    const key = `${Math.round(r)}|${seed}|${tint}`;
    let c = clumpCache.get(key); if (c) return c;
    c = document.createElement('canvas'); const s = Math.ceil(r * 2.6); c.width = c.height = s;
    const g = c.getContext('2d'), R = mulberry32(seed);
    g.translate(s / 2, s / 2);
    const cols = tint === 'fig' ? ['#2f6a2a', '#3f8a36', '#4f9a3e', '#5aa848', '#2a5a28'] : ['#2a6a3a', '#3a8a46', '#4aa052', '#2f7a3e', '#5ab060'];
    for (let k = 0; k < 90; k++) {
      const a = R() * TAU, d = Math.sqrt(R()) * r, x = Math.cos(a) * d, y = Math.sin(a) * d * .75;
      g.save(); g.translate(x, y); g.rotate(R() * TAU);
      const L = 14 + R() * 18, sh = (1 - d / r) * .4 + (y < 0 ? .1 : -.1);
      g.fillStyle = cols[(R() * cols.length) | 0]; g.globalAlpha = .95;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * .3, -L * .3, L * .8, -L * .2, L, 0); g.bezierCurveTo(L * .8, L * .2, L * .3, L * .3, 0, 0); g.fill();
      g.fillStyle = `rgba(255,255,220,${Math.max(0, sh) * .4})`; g.fill();
      g.restore();
    }
    clumpCache.set(key, c);
    return c;
  }
  function drawTree(G, T, view, S, part) {
    const g = S.surfaceAt(T.x), time = G.time, wind = G.world.weather.gust;
    if (T.x + 400 < view.l || T.x - 400 > view.r) return;
    if (T.kind === 'palm' || T.kind === 'pandanus') {
      if (part !== 'front') return;
      const h = T.kind === 'palm' ? 230 : 120, lean = T.lean;
      const topX = T.x + Math.sin(lean) * h, topY = g - h;
      if (T.kind === 'pandanus') {
        ctx.strokeStyle = '#7a6a4a'; ctx.lineWidth = 2;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(T.x + k * 3, g - 30); ctx.lineTo(T.x + k * 9, g + 2); ctx.stroke(); }
      }
      ctx.strokeStyle = T.kind === 'palm' ? '#8a7a5a' : '#6a5a3a'; ctx.lineWidth = T.w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(T.x, g + 4); ctx.quadraticCurveTo(T.x + Math.sin(lean) * h * .2, g - h * .6, topX, topY); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,30,20,.3)'; ctx.lineWidth = 1;
      for (let k = 1; k < 14; k++) { const t = k / 14, x = lerp(T.x, topX, t * t), y = lerp(g, topY, t); ctx.beginPath(); ctx.moveTo(x - T.w / 2, y); ctx.lineTo(x + T.w / 2, y + 2); ctx.stroke(); }
      const n = T.kind === 'palm' ? 9 : 14;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + Math.sin(time * .6 + k) * (.05 + wind * .08);
        ctx.save(); ctx.translate(topX, topY); ctx.rotate(a);
        if (T.kind === 'palm') {
          ctx.strokeStyle = '#3a6a2a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(50, -18, 92, 20); ctx.stroke();
          ctx.strokeStyle = '#4a8a32'; ctx.lineWidth = 1.4;
          for (let j = 1; j < 14; j++) { const t = j / 14, x = 92 * t, y = -18 * Math.sin(t * Math.PI) * 1.4 + t * t * 20; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y + 14 - t * 6); ctx.stroke(); }
        } else { ctx.fillStyle = k % 2 ? '#4a7a2a' : '#5a8a32'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(30, -12, 62, 6); ctx.quadraticCurveTo(30, 0, 0, 2); ctx.fill(); }
        ctx.restore();
      }
      if (T.kind === 'palm') { ctx.fillStyle = '#6a5a2a'; for (const [dx, dy] of [[-6, 6], [4, 8], [0, 12]]) { ctx.beginPath(); ctx.arc(topX + dx, topY + dy, 5, 0, TAU); ctx.fill(); } }
      else { ctx.fillStyle = '#e8902a'; ctx.beginPath(); ctx.ellipse(topX + 6, topY + 14, 9, 12, 0, 0, TAU); ctx.fill(); }
      return;
    }
    /* the big rainforest trees: buttressed trunks up out of sight, a canopy high above */
    const h = T.kind === 'tall' ? 1050 : T.kind === 'chestnut' ? 820 : 900, w = T.w, top = g - h;
    if (part === 'canopy') {
      for (let k = 0; k < 5; k++) { const R = mulberry32(T.seed + k), cx = T.x + (R() - .5) * 360, cy = top - 30 + R() * 120, r = 90 + R() * 70; const img = clump(r, (T.seed + k) % 997, T.kind === 'fig' ? 'fig' : 'rain'); ctx.drawImage(img, cx - img.width / 2 + Math.sin(time * .5 + k) * (3 + wind * 6), cy - img.height / 2); }
      return;
    }
    if (part !== 'trunk') return;
    const tg = ctx.createLinearGradient(T.x - w / 2, 0, T.x + w / 2, 0);
    const bark = T.kind === 'tall' ? ['#5a5448', '#b8b0a0', '#4a443a'] : T.kind === 'chestnut' ? ['#4a3a2a', '#8a7a62', '#3a2c1e'] : ['#4a4a3a', '#8a8a6a', '#3a3a2a'];
    tg.addColorStop(0, bark[0]); tg.addColorStop(.35, bark[1]); tg.addColorStop(1, bark[2]);
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.moveTo(T.x - w / 2, g + 6); ctx.lineTo(T.x - w * .32 + T.lean * h, top); ctx.lineTo(T.x + w * .32 + T.lean * h, top); ctx.lineTo(T.x + w / 2, g + 6); ctx.closePath(); ctx.fill();
    /* buttress roots flaring out across the floor */
    ctx.fillStyle = bark[0];
    const fl = T.kind === 'chestnut' ? 1.4 : 1;
    for (const s of [-1, 1]) for (const k of [1, .6]) { ctx.beginPath(); ctx.moveTo(T.x + s * w * .3, g - 90 * k * fl); ctx.quadraticCurveTo(T.x + s * w * .5, g - 14 * k, T.x + s * (w * .5 + 60 * k * fl), g + 4); ctx.lineTo(T.x + s * w * .2, g + 6); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = bark[1]; ctx.globalAlpha = .4;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(T.x + s * w * .3, g - 80 * fl); ctx.quadraticCurveTo(T.x + s * w * .45, g - 18, T.x + s * (w * .5 + 50 * fl), g + 2); ctx.lineTo(T.x + s * (w * .5 + 40 * fl), g + 2); ctx.quadraticCurveTo(T.x + s * w * .4, g - 18, T.x + s * w * .32, g - 70 * fl); ctx.fill(); }
    ctx.globalAlpha = 1;
    /* bark texture, a strangler fig's net of roots, moss and a hanging vine */
    ctx.strokeStyle = 'rgba(30,20,12,.3)'; ctx.lineWidth = 2;
    const R = mulberry32(T.seed);
    for (let k = 0; k < 16; k++) { const y = g - R() * h * .9, x = T.x + (R() - .5) * w * .7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (R() - .5) * 4, y - 40 - R() * 70); ctx.stroke(); }
    if (T.kind === 'fig') { ctx.strokeStyle = '#6a6a4a'; ctx.lineWidth = 3; for (let k = 0; k < 7; k++) { const x0 = T.x + (R() - .5) * w; ctx.beginPath(); ctx.moveTo(x0, g - h * .8); for (let y = g - h * .8; y < g; y += 40) ctx.lineTo(T.x + Math.sin(y * .02 + k) * w * .55, y); ctx.stroke(); } }
    ctx.strokeStyle = 'rgba(70,120,50,.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(T.x - w * .3, g - 20); ctx.lineTo(T.x - w * .25, g - 260); ctx.stroke();
    const vx = T.x + w * .25, sw = Math.sin(time * .7 + T.seed) * 8;
    ctx.strokeStyle = '#3f6a2a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(vx, top + 80); ctx.quadraticCurveTo(vx + 30 + sw, g - 400, vx + 20 + sw * 1.5, g - 140); ctx.stroke();
  }

  /* a tile of dense leaves, drawn once, for the canopy wall */
  let canopyTile = null;
  function drawCanopyWall(G, k, night, horizon) {
    if (!canopyTile) {
      canopyTile = document.createElement('canvas'); canopyTile.width = 1024; canopyTile.height = 640;
      const g = canopyTile.getContext('2d'), R = mulberry32(55);
      const grad = g.createLinearGradient(0, 0, 0, 640); grad.addColorStop(0, '#12301e'); grad.addColorStop(.7, '#1e4a2c'); grad.addColorStop(1, '#2a5a36');
      g.fillStyle = grad; g.fillRect(0, 0, 1024, 640);
      for (let i = 0; i < 70; i++) { const r = 40 + R() * 70, img = clump(r, (R() * 997) | 0, R() < .5 ? 'fig' : 'rain'); const x = R() * 1024, y = R() * 600; g.globalAlpha = .35 + R() * .45; for (const dx of [-1024, 0, 1024]) g.drawImage(img, x + dx - img.width / 2, y - img.height / 2); }
      /* flecks of sunlight through the leaves */
      g.globalAlpha = 1; g.fillStyle = 'rgba(220,255,180,.18)';
      for (let i = 0; i < 160; i++) { g.beginPath(); g.arc(R() * 1024, R() * 640, 1 + R() * 3, 0, TAU); g.fill(); }
    }
    const cam = G.cam, s = Math.max(.6, Math.min(1.2, cam.zoom * .5)), tw = canopyTile.width * s, th = canopyTile.height * s;
    const bottom = cam.toScreen(0, WORLD.plateau + 20)[1];
    const y0 = Math.min(bottom - th, -th * .2) - (cam.y + 500) * .05;
    let x0 = (-(cam.x * cam.zoom * .3) % tw) - tw; while (x0 > -tw) x0 -= tw;
    ctx.save(); ctx.globalAlpha = k * (1 - night * .3);
    for (let x = x0; x < W; x += tw) for (let y = y0; y < bottom; y += th) ctx.drawImage(canopyTile, x, y, tw, th);
    ctx.restore();
  }
  /* the understory: saplings, palms and vines between the big trunks, so the forest floor feels enclosed */
  let under = null;
  function drawUnderstory(G, S, view, night) {
    if (view.r < 960) return;
    if (!under || under.seed !== S.seed) {
      const R = mulberry32(S.seed + 21); under = { seed: S.seed, list: [] };
      for (let x = 980; x < WORLD.right; x += 40 + R() * 60) { if (x > WORLD.bridgeL - 160 && x < WORLD.bridgeR + 160) continue; under.list.push({ x, h: 70 + R() * 170, r: 45 + R() * 55, seed: (R() * 997) | 0, kind: R() < .25 ? 'palm' : 'sap', lean: (R() - .5) * .3 }); }
    }
    const time = G.time;
    for (const u of under.list) {
      if (u.x + 140 < view.l || u.x - 140 > view.r) continue;
      const g = S.surfaceAt(u.x), top = g - u.h, tx = u.x + u.lean * u.h;
      ctx.strokeStyle = '#3a3226'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(u.x, g + 4); ctx.quadraticCurveTo(u.x, g - u.h * .5, tx, top); ctx.stroke();
      if (u.kind === 'palm') {
        ctx.save(); ctx.translate(tx, top);
        for (let k = 0; k < 8; k++) { ctx.save(); ctx.rotate(k / 8 * TAU + Math.sin(time * .5 + u.seed) * .05); ctx.fillStyle = k % 2 ? '#24502e' : '#2c5e34'; ctx.beginPath(); ctx.moveTo(0, -3); ctx.quadraticCurveTo(40, -20, 80, 10); ctx.quadraticCurveTo(40, -4, 0, 3); ctx.fill(); ctx.restore(); }
        ctx.restore();
      } else {
        const img = clump(u.r, u.seed, 'rain');
        ctx.save(); ctx.globalAlpha = .96; ctx.filter = 'brightness(.72)';
        ctx.drawImage(img, tx - img.width / 2 + Math.sin(time * .4 + u.seed) * 2, top - img.height / 2);
        ctx.drawImage(img, tx - img.width / 2 - u.r * .5, top - img.height / 2 + u.r * .6, img.width * .8, img.height * .8);
        ctx.restore();
      }
    }
  }

  /* ---------- the frame ---------- */
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  const SEA_STOPS = [[0, [64, 186, 214]], [90, [30, 132, 186]], [260, [14, 74, 140]], [480, [6, 34, 82]], [760, [2, 12, 34]]];
  function seaCol(y) { let i = 0; while (i < SEA_STOPS.length - 2 && SEA_STOPS[i + 1][0] <= y) i++; const a = SEA_STOPS[i], b = SEA_STOPS[i + 1]; return mixRgb(a[1], b[1], clamp((y - a[0]) / (b[0] - a[0]), 0, 1)); }
  function frame(G, dt, clean) {
    const { cam, world: Wd, tod, time } = G, S = Wd.ground, weather = Wd.weather, p = G.player;
    const night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    updateCells(S);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    const view = cam.viewRect(80);
    const seaSY = cam.toScreen(0, Wd.seaLevel())[1];

    /* --- sky --- */
    let [top, bot] = skyColours(tod);
    if (weather.cloud > .01) { top = mixHex(top, '#3a4450', weather.cloud * .6); bot = mixHex(bot, '#7a8a90', weather.cloud * .55); }
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, top); sky.addColorStop(1, bot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    /* the horizon: the far ocean sits a little below the middle of the sky */
    const horizon = clamp(H * .5 - (cam.y + 120) * cam.zoom * .06, H * .25, H * .8);
    if (night > .05 && weather.cloud < .85) {
      for (const [sx, sy, r, ph] of stars) {
        const y = sy * horizon; if (y > horizon - 10) continue;
        ctx.globalAlpha = night * (0.3 + .7 * (.5 + .5 * Math.sin(time * 2 + ph * 6))) * (1 - weather.cloud);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * W, y, .5 + r * 1.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawSunMoon(G, tod, night, horizon, weather.cloud);
    /* the far ocean, with glitter under the sun or the moon */
    const og = ctx.createLinearGradient(0, horizon, 0, H);
    og.addColorStop(0, mixHex('#5aa8d0', '#0a1830', night)); og.addColorStop(1, mixHex('#1a5a8a', '#040a18', night));
    ctx.fillStyle = og; ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = `rgba(255,250,220,${.25 * (1 - weather.cloud) * (night > .5 ? .4 : 1)})`;
    for (let k = 0; k < 40; k++) { const x = W * (.3 + .4 * ((k * 0.618) % 1)) + Math.sin(time + k) * 10, y = horizon + 4 + ((k * 7) % 30) * (1 + k * .05); ctx.fillRect(x, y, 10 + (k % 5) * 4, 1.4); }
    /* far rainforest hills behind the plateau (they fade in as you go inland) */
    const inland = smoothstep(200, 1000, cam.x);
    /* in the forest the canopy closes in overhead: a wall of leaves where the sky was */
    const canopyK = smoothstep(860, 1100, cam.x) * (Wd.inClearing(cam.x) ? .35 : 1);
    if (canopyK > .02) drawCanopyWall(G, canopyK, night, horizon);
    if (inland > .02) {
      layers.forEach((L, li) => {
        const z = Math.min(1, cam.zoom) * (.5 + li * .14);
        const w = L.img.width * z, h = L.img.height * z;
        const y = horizon - h * .55 + li * 22 * z + Math.max(0, (cam.y + 300)) * cam.zoom * .1 * (li + 1) * .2;
        let x0 = (-(cam.x * cam.zoom * L.par) % w) - w; while (x0 > -w) x0 -= w;
        ctx.save(); ctx.globalAlpha = inland;
        ctx.filter = quality === 'low' ? 'none' : `brightness(${lerp(1, .35 + li * .05, night)})`;
        for (let x = x0; x < W; x += w) ctx.drawImage(L.img, x, y, w, h);
        ctx.restore();
      });
      ctx.filter = 'none';
    }

    /* ---------------- world space ---------------- */
    ctx.save();
    cam.apply(ctx);
    drawSea(G, Wd, S, view, night, time);
    for (const T of Wd.trees) drawTree(G, T, view, S, 'canopy');
    drawUnderstory(G, S, view, night);
    for (const T of Wd.trees) drawTree(G, T, view, S, 'trunk');
    drawSeabedFar(S, view);
    ctx.restore();

    drawCellLayer(G, S, view);

    ctx.save();
    cam.apply(ctx);
    drawRim(G, S, view);
    drawSurfaceDecor(G, Wd, S, view, night);
    for (const T of Wd.trees) drawTree(G, T, view, S, 'front');
    drawRoad(G, Wd, S, view);
    for (const e of Wd.exuviae) { if (e.x < view.l || e.x > view.r) continue; ctx.save(); ctx.translate(e.x, e.y); Sprites.drawExuvia(ctx, e.s, e.form); ctx.restore(); }
    for (const it of Wd.items) { if (it.x < view.l || it.x > view.r) continue; ctx.save(); ctx.translate(it.x, it.fy !== null ? it.fy : it.y - 1); ctx.globalAlpha = it.gone ? clamp(1 - it.gone / 3, 0, 1) : 1; if (it.fy !== null) ctx.rotate(Math.sin(time * 3 + it.col * 9) * .8); Sprites.drawFood(ctx, it, time); ctx.restore(); }
    ctx.globalAlpha = 1;
    drawCrowds(G, Wd, S, view);
    drawRobber(G, Wd);
    for (const n of Wd.npcs) drawNPC(G, n);
    if (Wd.mum) drawMum(G, Wd.mum);
    drawSeaLife(G, Wd, view, night, time);
    drawPlayer(G, p, time);
    G.particles.draw(ctx, cam);
    drawWaterTint(G, Wd, S, view, night, time);
    drawShelters(G, Wd, view, night);
    if (G.player.stage === 'crab' && G.player.shade === 'shelter') { ctx.save(); ctx.globalAlpha = .45; drawPlayer(G, G.player, time); ctx.restore(); }
    drawBird(G, Wd);
    drawRain(G, Wd, view, weather, time);
    ctx.restore();

    /* ---------------- light ---------------- */
    const under = p.swimming && p.y > Wd.seaLevel() + 2;
    const dark = Math.max(night * .78, weather.cloud * .3) * (p.underground ? .55 : 1);
    if (dark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${lerp(255, 70, dark) | 0},${lerp(255, 92, dark) | 0},${lerp(255, 150, dark) | 0})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    /* the forest floor is shady under the canopy */
    const forest = smoothstep(900, 1050, cam.x) * (Wd.inClearing(cam.x) ? .4 : 1);
    if (forest > .01 && !under) { ctx.fillStyle = `rgba(10,30,14,${forest * .18 * (1 - night * .5)})`; ctx.fillRect(0, 0, W, H); }
    const warm = (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - weather.cloud);
    if (warm > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,70,${warm * .55})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    /* glowing plankton, sunbeams in the forest */
    ctx.save(); cam.apply(ctx);
    drawGlows(G, Wd, view, night, time);
    if (!under && night < .6 && forest > .1) drawSunbeams(G, Wd, view, night, time);
    ctx.restore();
    if (under) { drawDeepLife(G, night, time); drawSnow(G, time, dt); }
    if (p.underground) {
      const [sx, sy] = cam.toScreen(p.x, p.y), rad = Math.max(W, H) * .5;
      const lg = ctx.createRadialGradient(sx, sy, rad * .18, sx, sy, rad);
      lg.addColorStop(0, 'rgba(10,5,2,0)'); lg.addColorStop(1, `rgba(10,5,2,${.45 + night * .2})`);
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, under ? `rgba(2,14,34,${.45 + night * .2})` : `rgba(4,10,8,${.3 + night * .18})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (!clean) drawOverlays(G, night, time);
    Cinematic.draw(ctx, W, H);
  }

  /* the sea itself: a body of water from the wavy surface down, getting darker with depth */
  function drawSea(G, Wd, S, view, night, time) {
    const x0 = view.l, x1 = Math.min(view.r, 220);
    if (x1 <= x0) return;
    const y0 = Wd.seaLevel() - 6;
    if (view.b < y0) return;
    const yb = Math.max(view.b, y0 + 10);
    const g = ctx.createLinearGradient(0, y0, 0, Math.min(yb, 800));
    for (const [d] of SEA_STOPS) { if (d > yb + 40) break; g.addColorStop(clamp((d - y0) / (Math.min(yb, 800) - y0), 0, 1), rgbStr(seaCol(d))); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0, yb);
    for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, Wd.surfaceY(x));
    ctx.lineTo(x1, yb); ctx.closePath(); ctx.fill();
    /* light rays from the surface, by day */
    const day = 1 - night;
    if (day > .05 && view.b > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) {
        const bx = Math.floor(view.l / 160) * 160 + k * 160 + Math.sin(time * .3 + k) * 30;
        if (bx > x1) break;
        const lg = ctx.createLinearGradient(0, Wd.seaLevel(), 0, 520);
        lg.addColorStop(0, `rgba(200,240,255,${.16 * day * (1 - G.world.weather.cloud * .6)})`); lg.addColorStop(1, 'rgba(200,240,255,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(bx, Wd.seaLevel()); ctx.lineTo(bx + 34 + Math.sin(time * .5 + k) * 8, Wd.seaLevel()); ctx.lineTo(bx + 150, 520); ctx.lineTo(bx + 70, 520); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
  /* the open-ocean floor beyond the reef (no cells there) */
  function drawSeabedFar(S, view) {
    if (view.l > WORLD.gridL || view.b < 300) return;
    ctx.fillStyle = '#0a1c30';
    ctx.beginPath(); ctx.moveTo(view.l, view.b + 10);
    for (let x = view.l; x <= Math.min(view.r, WORLD.gridL + 12); x += 12) ctx.lineTo(x, S.surfaceAt(x));
    ctx.lineTo(Math.min(view.r, WORLD.gridL + 12), view.b + 10); ctx.closePath(); ctx.fill();
  }
  function drawCellLayer(G, S, view) {
    const cam = G.cam, b = bufCtx;
    const sx0 = clamp(Math.floor((view.l - S.X0) / S.C) - 1, 0, S.cols), sy0 = clamp(Math.floor((view.t - S.Y0) / S.C) - 1, 0, S.rows);
    const sx1 = clamp(Math.ceil((view.r - S.X0) / S.C) + 1, 0, S.cols), sy1 = clamp(Math.ceil((view.b - S.Y0) / S.C) + 1, 0, S.rows);
    if (sx1 <= sx0 || sy1 <= sy0) return;
    const src = [sx0 * HI, sy0 * HI, (sx1 - sx0) * HI, (sy1 - sy0) * HI], dst = [S.X0 + sx0 * S.C, S.Y0 + sy0 * S.C, (sx1 - sx0) * S.C, (sy1 - sy0) * S.C];
    ctx.save(); cam.apply(ctx);
    ctx.drawImage(back, ...src, ...dst);
    if (view.b > WORLD.gridB && view.r > WORLD.gridL) { ctx.fillStyle = '#4a4438'; ctx.fillRect(Math.max(view.l, WORLD.gridL), WORLD.gridB - 1, view.r - Math.max(view.l, WORLD.gridL), view.b - WORLD.gridB + 1); }
    ctx.restore();
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, buf.width, buf.height);
    b.setTransform(DPR, 0, 0, DPR, 0, 0);
    b.save(); cam.apply(b);
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    b.drawImage(hi, ...src, ...dst);
    b.globalCompositeOperation = 'source-atop';
    b.globalAlpha = quality === 'low' ? .5 : .85; b.fillStyle = grainPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    b.globalAlpha = 1;
    b.restore(); b.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (quality !== 'low') { ctx.shadowColor = 'rgba(6,3,0,.75)'; ctx.shadowBlur = 8 * DPR * Math.min(2, cam.zoom); ctx.shadowOffsetX = 1.5 * DPR * cam.zoom; ctx.shadowOffsetY = 2.5 * DPR * cam.zoom; }
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  }

  function drawSunMoon(G, tod, night, horizon, cloud) {
    const skyTop = horizon * .85;
    if (tod > .22 && tod < .82) {
      const t = invLerp(.22, .82, tod), x = W * (.1 + .8 * t), y = horizon - Math.sin(Math.PI * t) * Math.max(120, skyTop) + 10;
      ctx.globalAlpha = 1 - cloud * .7;
      const g = ctx.createRadialGradient(x, y, 8, x, y, 220); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(.12, 'rgba(255,230,160,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, y - 220, 440, 440);
      ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(x, y, 28, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const t = tod > .5 ? invLerp(.78, 1.28, tod) : invLerp(-.22, .28, tod), x = W * (.15 + .7 * t), y = horizon - Math.sin(Math.PI * clamp(t, 0, 1)) * Math.max(120, skyTop) * .9 - 10;
      ctx.globalAlpha = night * (1 - cloud * .8);
      const g = ctx.createRadialGradient(x, y, 10, x, y, 220); g.addColorStop(0, 'rgba(220,235,255,.4)'); g.addColorStop(.2, 'rgba(160,190,255,.14)'); g.addColorStop(1, 'rgba(120,150,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, y - 220, 440, 440);
      drawMoonDisc(ctx, x, y, 30, G.moon);
      ctx.globalAlpha = 1;
    }
  }
  /* the moon in its real phase: 0 new · .25 first quarter · .5 full · .75 last quarter */
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

  /* a crisp edge along the top of the ground, coloured by what it is made of */
  const RIM = {};
  RIM[MAT.SAND] = ['rgba(150,110,60,.5)', 'rgba(255,236,196,.9)']; RIM[MAT.SOIL] = ['rgba(40,24,12,.55)', 'rgba(120,84,50,.9)'];
  RIM[MAT.ROCK] = ['rgba(90,84,74,.5)', 'rgba(240,234,222,.85)']; RIM[MAT.CORAL] = ['rgba(120,70,80,.45)', 'rgba(255,190,190,.8)'];
  RIM[MAT.ROOT] = RIM[MAT.SOIL]; RIM[MAT.ROAD] = ['rgba(20,20,22,.6)', 'rgba(120,124,128,.9)'];
  RIM[MAT.BRIDGE] = ['rgba(60,66,72,.6)', 'rgba(220,228,236,.9)']; RIM[MAT.FENCE] = ['rgba(30,80,40,.6)', 'rgba(140,220,140,.9)']; RIM[MAT.PLUG] = ['rgba(80,60,20,.6)', 'rgba(200,160,80,.9)'];
  function drawRim(G, S, view) {
    const x0 = Math.max(view.l, WORLD.gridL), x1 = Math.min(view.r, WORLD.gridR), step = Math.max(1.5, 6 / G.cam.zoom);
    if (x1 <= x0) return;
    const lw = 2.2 / G.cam.zoom;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      let cur = null;
      for (let x = x0; x <= x1; x += step) {
        const t0 = S.topAt(x);
        if (x > -40 && t0 > S.surfaceAt(x) + 8) { if (cur) { ctx.stroke(); cur = null; } continue; }   /* an open burrow door */
        const y = (S.topAt(x - 8) + S.topAt(x - 4) + t0 * 2 + S.topAt(x + 4) + S.topAt(x + 8)) / 6, m = S.matAt(x, t0 + 2), col = (RIM[m] || RIM[MAT.ROCK])[pass], yy = y + (pass ? 0 : lw * 1.6);
        if (col !== cur) { if (cur) { ctx.lineTo(x, yy); ctx.stroke(); } cur = col; ctx.strokeStyle = col; ctx.lineWidth = pass ? lw : lw * 2.6; ctx.beginPath(); ctx.moveTo(x, yy); }
        else ctx.lineTo(x, yy);
      }
      if (cur) ctx.stroke();
    }
  }
  function drawSurfaceDecor(G, Wd, S, view, night) {
    if (!decor) return;
    const time = G.time, wind = Wd.weather.gust;
    /* under the sea: sea grass, sea fans, anemones */
    for (const w of decor.weed) { if (w.x < view.l - 20 || w.x > view.r + 20) continue; const y = S.topAt(w.x); ctx.strokeStyle = w.col; ctx.lineWidth = 1.6 * w.s; ctx.lineCap = 'round'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(w.x + k * 2, y + 2); ctx.quadraticCurveTo(w.x + k * 3 + Math.sin(time * 1.2 + w.ph + k) * 5, y - 10 * w.s, w.x + k * 2 + Math.sin(time + w.ph) * 8, y - 22 * w.s); ctx.stroke(); } }
    for (const f of decor.fans) {
      if (f.x < view.l - 40 || f.x > view.r + 40) continue;
      const y = S.topAt(f.x); ctx.save(); ctx.translate(f.x, y + 2); ctx.rotate(Math.sin(time * .8 + f.ph) * .08); ctx.scale(f.s, f.s);
      ctx.strokeStyle = f.col; ctx.lineWidth = 1.4;
      const branch = (x, y2, a, L, d) => { if (d > 4) return; const ex = x + Math.cos(a) * L, ey = y2 + Math.sin(a) * L; ctx.beginPath(); ctx.moveTo(x, y2); ctx.lineTo(ex, ey); ctx.stroke(); branch(ex, ey, a - .45, L * .72, d + 1); branch(ex, ey, a + .45, L * .72, d + 1); };
      branch(0, 0, -Math.PI / 2, 12, 0); ctx.restore();
    }
    for (const b of decor.brain) {
      if (b.x < view.l - 40 || b.x > view.r + 40) continue;
      const y = S.topAt(b.x) + 1; ctx.save(); ctx.translate(b.x, y); ctx.scale(b.s, b.s);
      if (b.kind === 'brain') {
        const g = ctx.createRadialGradient(-3, -9, 1, 0, -4, 12); g.addColorStop(0, '#fff0d8'); g.addColorStop(.4, b.col); g.addColorStop(1, shade(b.col, .6));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, Math.PI, TAU); ctx.fill();
        ctx.strokeStyle = shade(b.col, .55); ctx.lineWidth = .7; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(0, 0, 10 - k * 2.4, 8.4 - k * 2, 0, Math.PI + .2, TAU - .2); ctx.stroke(); }
      } else {
        ctx.fillStyle = shade(b.col, .7); ctx.fillRect(-1.5, -9, 3, 9);
        const g = ctx.createLinearGradient(0, -12, 0, -8); g.addColorStop(0, '#ffe6c8'); g.addColorStop(1, b.col);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -10, 16, 3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let k = -12; k <= 12; k += 3) { ctx.beginPath(); ctx.arc(k, -11.5, .6, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    }
    for (const a of decor.anem) {
      if (a.x < view.l || a.x > view.r) continue;
      const y = S.topAt(a.x); ctx.strokeStyle = a.col; ctx.lineWidth = 1.4 * a.s; ctx.lineCap = 'round';
      for (let k = 0; k < 9; k++) { const ang = -Math.PI / 2 + (k - 4) * .28; ctx.beginPath(); ctx.moveTo(a.x, y); ctx.quadraticCurveTo(a.x + Math.cos(ang) * 5 * a.s + Math.sin(time * 1.5 + k + a.ph) * 2, y + Math.sin(ang) * 5 * a.s, a.x + Math.cos(ang) * 9 * a.s + Math.sin(time * 1.5 + k + a.ph) * 3, y + Math.sin(ang) * 9 * a.s); ctx.stroke(); }
    }
    /* rock pools on the shore */
    for (const pl of decor.pools) { if (pl.x < view.l || pl.x > view.r) continue; const y = S.topAt(pl.x); ctx.fillStyle = 'rgba(80,170,210,.75)'; ctx.beginPath(); ctx.ellipse(pl.x, y + 1.5, pl.w / 2, 3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(pl.x - pl.w * .3, y, pl.w * .25, .8); }
    /* grass on the terrace */
    for (const g2 of decor.grass) { if (g2.x < view.l || g2.x > view.r) continue; const y = S.walkTop(g2.x, 3) + 1; ctx.strokeStyle = g2.col; ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(g2.x + k, y); ctx.quadraticCurveTo(g2.x + k * 2 + Math.sin(time * 1.4 + g2.ph) * 2, y - 6 * g2.s, g2.x + k * 3.4 + Math.sin(time * 1.2 + g2.ph) * 3 * (1 + wind), y - 11 * g2.s); ctx.stroke(); } }
    /* leaf litter carpets the forest floor */
    for (const l of decor.litter) {
      if (l.x < view.l || l.x > view.r) continue;
      const y = S.topAt(l.x); if (y > S.surfaceAt(l.x) + 6) continue;
      ctx.save(); ctx.translate(l.x, y + .5); ctx.rotate(l.a * .3); ctx.fillStyle = l.col; ctx.beginPath(); ctx.ellipse(0, 0, 4 * l.s, 1.4 * l.s, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    for (const f of decor.ferns) {
      if (f.x < view.l - 80 || f.x > view.r + 80) continue;
      const y = S.walkTop(f.x, 4) + 2, sw = Math.sin(time * .9 + f.ph) * (.04 + wind * .08);
      ctx.save(); ctx.translate(f.x, y); ctx.scale(f.s * f.flip, f.s);
      if (f.kind === 'fern') { for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * .33 + sw; ctx.save(); ctx.rotate(a + Math.PI / 2); ctx.strokeStyle = '#3f7a32'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -30, 4, -60); ctx.stroke(); ctx.fillStyle = k % 2 ? '#4f9a3a' : '#3f8a30'; for (let j = 1; j < 9; j++) { const t = j / 9, x = lerp(0, 6, t) + Math.sin(t * 3) * 4, yy = -t * 58; ctx.beginPath(); ctx.ellipse(x - 5, yy, 5 * (1 - t * .6), 1.8, -.5, 0, TAU); ctx.ellipse(x + 5, yy, 5 * (1 - t * .6), 1.8, .5, 0, TAU); ctx.fill(); } ctx.restore(); } }
      else { for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(-1.2 + k * .7 + sw); Sprites.drawLeaf(ctx, 46, -Math.PI / 2 + .2, k % 2 ? '#3f8a3a' : '#2f7a32'); ctx.restore(); } }
      ctx.restore();
    }
  }
  /* the road: tarmac lines, the crab fences' mesh, the bridge's railings, the ranger and the sign */
  function drawRoad(G, Wd, S, view) {
    if (view.r < WORLD.bridgeL - 200 || view.l > WORLD.bridgeR + 200) return;
    const gy = S.surfaceAt(WORLD.roadL + 50);
    ctx.strokeStyle = '#f0f0e0'; ctx.lineWidth = 1.2; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(WORLD.roadL, gy + 1); ctx.lineTo(WORLD.roadR, gy + 1); ctx.stroke(); ctx.setLineDash([]);
    /* the crab fence along the road: low green mesh on posts */
    for (const fx of [WORLD.roadL - 12, WORLD.roadR + 12]) {
      const g = S.surfaceAt(fx);
      ctx.fillStyle = 'rgba(70,160,80,.55)'; ctx.fillRect(fx - 2, g - 30, 4, 30);
      ctx.strokeStyle = 'rgba(40,110,50,.9)'; ctx.lineWidth = .6;
      for (let y = g - 30; y < g; y += 4) { ctx.beginPath(); ctx.moveTo(fx - 2, y); ctx.lineTo(fx + 2, y + 4); ctx.moveTo(fx + 2, y); ctx.lineTo(fx - 2, y + 4); ctx.stroke(); }
      ctx.fillStyle = '#5a5a52'; ctx.fillRect(fx - 1, g - 34, 2, 34);
    }
    /* the crab bridge: two steel legs, a mesh deck on the ramps and the span, railings */
    const deck = []; for (let x = WORLD.bridgeL; x <= WORLD.bridgeR; x += 3) { const y = S.topAt(x); if (y < S.surfaceAt(x) - 2) deck.push([x, y]); }
    if (deck.length > 2) {
      ctx.fillStyle = '#6a737c';
      for (const lx of [WORLD.roadL - 26, WORLD.roadR + 26]) { const top = S.topAt(lx), g = S.surfaceAt(lx); ctx.fillRect(lx - 3, top + 3, 6, g - top - 3); ctx.fillStyle = '#4a5258'; ctx.fillRect(lx - 3, top + 3, 2, g - top - 3); ctx.fillStyle = '#6a737c'; }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#3e464c'; ctx.lineWidth = 6; ctx.beginPath(); deck.forEach(([x, y], k) => k ? ctx.lineTo(x, y + 3) : ctx.moveTo(x, y + 3)); ctx.stroke();
      ctx.strokeStyle = '#a8b4be'; ctx.lineWidth = 3.4; ctx.beginPath(); deck.forEach(([x, y], k) => k ? ctx.lineTo(x, y + 1.5) : ctx.moveTo(x, y + 1.5)); ctx.stroke();
      ctx.strokeStyle = 'rgba(60,70,80,.5)'; ctx.lineWidth = .5;
      for (let k = 0; k < deck.length; k += 2) { const [x, y] = deck[k]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + 4); ctx.stroke(); }
      /* railings */
      ctx.strokeStyle = 'rgba(210,220,228,.9)'; ctx.lineWidth = .9;
      for (let k = 0; k < deck.length; k += 4) { const [x, y] = deck[k]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke(); }
      ctx.lineWidth = 1.6; ctx.beginPath(); deck.forEach(([x, y], k) => k ? ctx.lineTo(x, y - 14) : ctx.moveTo(x, y - 14)); ctx.stroke();
      ctx.strokeStyle = 'rgba(210,220,228,.4)'; ctx.lineWidth = .7; ctx.beginPath(); deck.forEach(([x, y], k) => k ? ctx.lineTo(x, y - 7) : ctx.moveTo(x, y - 7)); ctx.stroke();
    }
    /* the ranger and the sign */
    const r = Wd.ranger, ry = S.surfaceAt(r.x) + 1;
    ctx.save(); ctx.translate(r.x, ry); Sprites.drawRanger(ctx, { s: 1.5, wave: r.wave }); ctx.restore();
    const sx = WORLD.roadR - 16, sy = S.surfaceAt(sx);
    ctx.fillStyle = '#6a6a6a'; ctx.fillRect(sx - 1.5, sy - 70, 3, 70);
    ctx.save(); ctx.translate(sx, sy - 82); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 2; ctx.fillRect(-15, -15, 30, 30); ctx.strokeRect(-15, -15, 30, 30); ctx.rotate(-Math.PI / 4); ctx.scale(.12, .12); Sprites.drawCrab(ctx, { s: 1, form: 'red' }); ctx.restore();
    ctx.fillStyle = '#c0301a'; rr(ctx, sx - 30, sy - 60, 60, 14, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `900 8px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ROAD CLOSED', sx, sy - 53);
    /* the crazy-ant bait station, far east */
    const ax = (Wd.ants.x0 + Wd.ants.x1) / 2;
    if (ax > view.l - 100 && ax < view.r + 100) {
      const ay = S.walkTop(Wd.ants.x0 - 15, 4);
      ctx.fillStyle = 'rgba(230,200,40,.9)';
      for (let k = 0; k < 50; k++) { const x = lerp(Wd.ants.x0, Wd.ants.x1, (k * .618 + G.time * .05 * (k % 3 + 1)) % 1), y = S.walkTop(x, 3) - .6; ctx.fillRect(x, y, 1.6, .8); }
      ctx.fillStyle = '#6a6a6a'; ctx.fillRect(Wd.ants.x0 - 16, ay - 30, 2, 30);
      ctx.fillStyle = '#ffd23f'; rr(ctx, Wd.ants.x0 - 28, ay - 42, 26, 14, 2); ctx.fill();
      ctx.fillStyle = '#2a2016'; ctx.font = `900 6px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('ANTS!', Wd.ants.x0 - 15, ay - 35);
    }
  }
  /* rocks and cracks you hide under: drawn in front of the crabs */
  function drawShelters(G, Wd, view, night) {
    for (const sh of Wd.shelters) {
      if (sh.x + sh.w < view.l || sh.x - sh.w > view.r) continue;
      const y = sh.y;
      if (sh.kind === 'log') {
        const g = ctx.createLinearGradient(0, y - 22, 0, y); g.addColorStop(0, '#7a5a3a'); g.addColorStop(1, '#3a2a1a');
        ctx.fillStyle = g; rr(ctx, sh.x - sh.w / 2, y - 20, sh.w, 16, 8); ctx.fill();
        ctx.fillStyle = '#a07a50'; ctx.beginPath(); ctx.ellipse(sh.x + sh.w / 2, y - 12, 4, 8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(90,140,60,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sh.x - sh.w / 2 + 6, y - 20); ctx.lineTo(sh.x + sh.w / 2 - 8, y - 20); ctx.stroke();
      } else if (sh.kind === 'crack') {
        /* a ledge of the cliff with a dark crevice behind it */
        const w = sh.w, hg = ctx.createRadialGradient(sh.x, y, 1, sh.x, y - 4, w * .6);
        hg.addColorStop(0, 'rgba(12,10,8,.9)'); hg.addColorStop(1, 'rgba(12,10,8,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(sh.x, y - 4, w * .6, 11, 0, 0, TAU); ctx.fill();
        const g = ctx.createLinearGradient(0, y - 18, 0, y - 10); g.addColorStop(0, '#d8d0c0'); g.addColorStop(1, '#8a8274');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sh.x - w * .7, y - 12); ctx.quadraticCurveTo(sh.x - w * .2, y - 19, sh.x + w * .3, y - 16); ctx.lineTo(sh.x + w * .75, y - 13); ctx.quadraticCurveTo(sh.x + w * .2, y - 10, sh.x - w * .7, y - 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4f8a36'; ctx.lineWidth = .8; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(sh.x - w * .5 + k * 4, y - 15); ctx.quadraticCurveTo(sh.x - w * .55 + k * 4, y - 22, sh.x - w * .62 + k * 5, y - 26); ctx.stroke(); }
      } else {
        /* a weathered limestone boulder sitting on the ground, a dark hollow under its overhanging side to hide in */
        const w = sh.w, R = mulberry32((sh.x * 13) | 0), base = y + 2, top = y - 24;
        const g = ctx.createLinearGradient(0, top, 0, base);
        g.addColorStop(0, '#e6dece'); g.addColorStop(.55, '#b0a796'); g.addColorStop(1, '#6e665a');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(sh.x - w * .58, base);
        const pts = 10; for (let k = 0; k <= pts; k++) { const a = Math.PI + k / pts * Math.PI, r = 1 + (R() - .5) * .14; ctx.lineTo(sh.x + Math.cos(a) * w * .56 * r, base - 6 + Math.sin(a) * (base - top - 6) * r); }
        ctx.lineTo(sh.x + w * .58, base); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(60,50,40,.4)'; ctx.lineWidth = .8; ctx.stroke();
        /* the hollow underneath: where a crab tucks in, out of the sun */
        const hg = ctx.createRadialGradient(sh.x + w * .05, base, 1, sh.x + w * .05, base, w * .4);
        hg.addColorStop(0, 'rgba(14,10,6,.85)'); hg.addColorStop(1, 'rgba(14,10,6,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(sh.x + w * .05, base, w * .4, 8, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(70,60,50,.3)'; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(sh.x + (R() - .5) * w * .8, top + 5 + R() * 9, .7 + R() * 1.3, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = 'rgba(60,50,40,.35)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(sh.x - w * .2, top + 3); ctx.quadraticCurveTo(sh.x - w * .1, top + 10, sh.x - w * .22, base - 8); ctx.stroke();
        ctx.fillStyle = 'rgba(110,150,80,.65)'; ctx.beginPath(); ctx.ellipse(sh.x - w * .12, top + 1.5, w * .2, 2.2, -.1, 0, TAU); ctx.fill();
      }
    }
  }

  function drawCrowds(G, Wd, S, view) {
    for (const b of Wd.babies) { if (b.x < view.l || b.x > view.r) continue; const w = 4.4 * b.s, y = S.walkTop(b.x, 3) - w * .42; drawCrowdCrab(b.x, y, w, b.col < .9 ? 'red' : b.col < .97 ? 'orange' : 'purple', true, b.wait > 0 ? 0 : b.ph); }
    const p = G.player, busy = p.mode === 'shove' || p.mode === 'release' || p.busy > 0 || (p.flags.dipped && !p.flags.met);
    for (const m of Wd.marchers) {
      if (m.x < view.l || m.x > view.r || m.gone) continue;
      const w = crabUnits(m.cm), y = S.walkTop(m.x, 6) - w * .42 + (m.sink || 0) * w, near = Math.abs(m.x - p.x) < (busy ? 120 : 40);
      ctx.globalAlpha = (near ? .3 : .9) * (1 - (m.sink || 0));
      drawCrowdCrab(m.x, y, w, m.form, m.male, m.pause > 0 || m.arrived ? 0 : m.ph);
    }
    ctx.globalAlpha = 1;
  }
  function drawRobber(G, Wd) {
    const r = Wd.robber; if (r.state === 'away') return;
    const w = 66;
    ctx.save(); ctx.translate(r.x, r.y - w * .5); Sprites.drawCrab(ctx, { s: w / 100, robber: true, walk: r.legs, moving: r.state !== 'sniff', up: r.state === 'sniff' ? .3 + Math.sin(r.t * 3) * .2 : 0, pinch: r.state === 'sniff' ? .5 : 0, seed: 7 }); ctx.restore();
  }
  function drawNPC(G, n) {
    ctx.save(); ctx.translate(n.x, n.y);
    if (n.spin) ctx.rotate(n.spin);
    if (n.mode === 'door') { ctx.beginPath(); ctx.rect(-n.w, -n.w, n.w * 2, n.w * 1.14); ctx.clip(); }
    if (n.mode === 'enter') ctx.globalAlpha = clamp(1 - (n.sink || 0), 0, 1);
    Sprites.drawCrab(ctx, { s: n.w / 100, form: n.form, sex: n.sex, walk: n.walk, moving: n.mode === 'walk' || n.mode === 'leave' || n.mode === 'shove', up: n.mode === 'shove' ? .5 + Math.sin(G.time * 9) * .2 : n.mode === 'door' ? .2 + Math.sin(G.time * 2 + n.x) * .15 : 0, pinch: n.mode === 'shove' ? .6 : 0, eggs: n.role === 'female' && n.eggs ? n.eggs : 0, seed: (n.cm * 13) | 0, face: n.face });
    ctx.restore();
  }
  function drawMum(G, m) {
    ctx.save(); ctx.translate(m.x, m.y);
    Sprites.drawCrab(ctx, { s: m.w / 100, form: m.form, sex: 'girl', walk: m.ph * 4, moving: m.shake > 0, eggs: m.eggs, up: m.shake > 0 ? .3 + Math.sin(m.ph * 20) * .2 : .1, seed: 5 });
    ctx.restore();
  }
  function drawSeaLife(G, Wd, view, night, time) {
    const mt = Wd.manta; if (mt) { ctx.save(); ctx.translate(mt.x, mt.y); ctx.scale(mt.dir, 1); ctx.globalAlpha = .85; Sprites.drawManta(ctx, { s: 1.4, t: mt.t }); ctx.restore(); ctx.globalAlpha = 1; }
    const w = Wd.whale; if (w) { ctx.save(); ctx.translate(w.x, w.y); ctx.scale(w.dir, 1); Sprites.drawWhaleShark(ctx, { s: .62, t: w.t, gulp: w.gulp, seed: 5 }); ctx.restore(); }
    for (const f of Wd.reefFish) { if (f.x < view.l - 20 || f.x > view.r + 20) continue; ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir * f.s * .5, f.s * .5); Sprites.drawFish(ctx, { col: f.col, col2: f.col2, ph: f.ph, stripe: f.col2 === '#ffffff' ? '#ffffff' : null }); ctx.restore(); }
    const tu = Wd.turtle; if (tu.x > view.l - 60 && tu.x < view.r + 60) { ctx.save(); ctx.translate(tu.x, tu.y); ctx.scale(tu.dir, 1); Sprites.drawTurtle(ctx, { s: 1.2, ph: tu.ph }); ctx.restore(); }
    for (const j of Wd.jellies) if (j.x > view.l - 80 && j.x < view.r + 80) Sprites.drawJelly(ctx, j, time);
    for (const q of Wd.plankton) if (q.x > view.l && q.x < view.r && q.y > view.t && q.y < view.b) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1.5, 1.5); ctx.translate(-q.x, -q.y); Sprites.drawPlankton(ctx, q, night, time); ctx.restore(); }
    for (const s of Wd.sibs) { if (s.x < view.l || s.x > view.r) continue; ctx.save(); ctx.translate(s.x, s.y); ctx.scale(Math.cos(s.a) < 0 ? -1 : 1, 1); ctx.globalAlpha = .75; if (s.mega) Sprites.drawMegalopa(ctx, { s: .3, ph: s.ph, form: 'red' }); else Sprites.drawZoea(ctx, { s: .28, ph: s.ph, form: 'red', instar: 1 }); ctx.restore(); }
    ctx.globalAlpha = 1;
    const sc = Wd.school;
    if (sc) for (const f of sc.fish) { const x = sc.x + f.dx, y = sc.y + f.dy + Math.sin(sc.t * 2 + f.ph) * 6; if (x < view.l - 40 || x > view.r + 40) continue; ctx.save(); ctx.translate(x, y); ctx.scale(sc.dir * f.s, f.s); Sprites.drawFish(ctx, { ph: f.ph, col: '#d8e4ee', col2: '#4a6a8a' }); ctx.restore(); }
    for (const e of Wd.eggCloud) {
      if (e.t < e.pop) { ctx.save(); ctx.translate(e.x, e.y); Sprites.drawEgg(ctx, { s: .9 }); ctx.restore(); }
      else { ctx.save(); ctx.translate(e.x, e.y); ctx.globalAlpha = clamp(4 - e.t, 0, 1) * .8; ctx.scale(-1, 1); Sprites.drawZoea(ctx, { s: .2, ph: e.t * 10, form: 'red', instar: 1 }); ctx.restore(); ctx.globalAlpha = 1; }
    }
  }
  /* the tint of the water over everything under the surface, the bright underside of the waves, foam on the rocks */
  function drawWaterTint(G, Wd, S, view, night, time) {
    const x0 = view.l, x1 = Math.min(view.r, 220); if (x1 <= x0) return;
    const lvl = Wd.seaLevel();
    if (view.b < lvl - 10) return;
    ctx.fillStyle = `rgba(30,120,180,${.16 + night * .1})`;
    ctx.beginPath();
    const pts = [];
    for (let x = x0; x <= x1; x += 6) { const top = Wd.surfaceY(x), ground = S.topAt(x), bot = ground <= top ? top : Math.max(top, Math.min(view.b + 10, ground + 30)); pts.push([x, top, bot]); }
    ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]);
    for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k][0], pts[k][2]);
    ctx.closePath(); ctx.fill();
    /* the surface: a bright line, seen from above or below */
    ctx.strokeStyle = `rgba(230,250,255,${.75 - night * .4})`; ctx.lineWidth = 1.4 / Math.max(.6, G.cam.zoom) * 2;
    ctx.beginPath(); let started = false;
    for (let x = x0; x <= x1; x += 4) { const y = Wd.surfaceY(x); if (S.topAt(x) < y - 1) { started = false; continue; } started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; }
    ctx.stroke();
    /* foam where the waves run up the rocks */
    const edge = Wd.waterEdge(), sw = Wd.swash();
    if (edge > view.l - 40 && edge < view.r + 40) {
      /* a frothy line of foam along the wave's edge, thinning as it runs back */
      ctx.strokeStyle = `rgba(255,255,255,${.55 + sw * .35})`; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.lineWidth = (1.4 - k * .35) * (.7 + sw * .5); ctx.beginPath();
        for (let x = edge - 60 + k * 6; x <= edge; x += 2) { const y = Math.min(Wd.surfaceY(x), S.walkTop(x, 2)) - .6 + Math.sin(x * .7 + time * 4 + k) * .5; x === edge - 60 + k * 6 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,255,255,${.6 * sw})`;
      for (let k = 0; k < 10; k++) { const x = edge - k * 5 + Math.sin(time * 3 + k) * 1.5, y = S.walkTop(x, 2) - .8; ctx.beginPath(); ctx.ellipse(x, y, 1.6 + (k % 3) * .5, .7, 0, 0, TAU); ctx.fill(); }
    }
  }
  function drawGlows(G, Wd, view, night, time) {
    ctx.globalCompositeOperation = 'lighter';
    for (const q of Wd.plankton) {
      if (q.kind !== 'dino' || q.x < view.l || q.x > view.r) continue;
      const a = Math.min(1, night * .45 + q.glow);
      if (a < .05) continue;
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 3 + q.glow * 4);
      g.addColorStop(0, `rgba(120,230,255,${a})`); g.addColorStop(1, 'rgba(120,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 3 + q.glow * 4, 0, TAU); ctx.fill();
    }
    /* each egg sparkles as it pops open into a zoea */
    for (const e of Wd.eggCloud) {
      const k = e.t - e.pop; if (k < 0 || k > 1.2) continue;
      const a = (1 - k / 1.2) * (.5 + night * .5), r = 1.5 + k * 5;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      g.addColorStop(0, `rgba(170,240,255,${a})`); g.addColorStop(1, 'rgba(170,240,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
    }
    /* night waves sparkle blue at the shore */
    if (night > .4) { const edge = Wd.waterEdge(); for (let k = 0; k < 10; k++) { const x = edge - 4 - k * 9 + Math.sin(time * 2 + k) * 3, y = Wd.surfaceY(x) + 1; ctx.fillStyle = `rgba(110,220,255,${(night - .4) * .6 * Wd.swash()})`; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill(); } }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawSunbeams(G, Wd, view, night, time) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const day = 1 - night;
    for (let k = 0; k < 6; k++) {
      const bx = Math.floor(view.l / 300) * 300 + k * 300 + 80;
      const top = view.t - 50, bot = WORLD.plateau - 34;
      const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, `rgba(255,250,210,${.06 * day})`); g.addColorStop(1, `rgba(255,250,210,${.02 * day})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx + 40 + Math.sin(time * .2 + k) * 10, top); ctx.lineTo(bx + 160, bot); ctx.lineTo(bx + 90, bot); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  /* far away in the blue: shoals of little fish turning, and on dark nights the sea twinkles */
  const shoals = Array.from({ length: 3 }, (_, i) => ({ ph: i * 2.1, y: .2 + i * .27, n: 26 + i * 6, dir: i % 2 ? -1 : 1, sp: .006 + i * .003 }));
  const twinkles = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * TAU, sp: .5 + Math.random() * 2 }));
  function drawDeepLife(G, night, time) {
    ctx.save();
    for (const sh of shoals) {
      const cx = (((sh.ph * .17 + time * sh.sp * sh.dir - G.cam.x * .00012) % 1.4) + 1.4) % 1.4 * W - W * .2, cy = sh.y * H + Math.sin(time * .2 + sh.ph) * 20 - G.cam.y * .02;
      ctx.fillStyle = `rgba(150,190,220,${.10 * (1 - night * .7)})`;
      for (let k = 0; k < sh.n; k++) { const a = k * 2.399 + time * .3 * sh.dir, r = Math.sqrt(k) * 9; const x = cx + Math.cos(a) * r * 1.8, y = cy + Math.sin(a) * r * .7; ctx.beginPath(); ctx.ellipse(x, y, 5, 1.6, sh.dir * .1, 0, TAU); ctx.fill(); }
    }
    if (night > .3) {
      ctx.globalCompositeOperation = 'lighter';
      for (const t of twinkles) { const b = Math.max(0, Math.sin(time * t.sp + t.ph)); if (b < .6) continue; const x = ((t.x - G.cam.x * .0004) % 1 + 1) % 1 * W, y = ((t.y - G.cam.y * .0004) % 1 + 1) % 1 * H; ctx.fillStyle = `rgba(110,220,255,${(b - .6) * 2 * night * .7})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + b, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  /* specks of marine snow drifting past the camera */
  function drawSnow(G, time, dt) {
    ctx.fillStyle = 'rgba(230,245,255,.55)';
    for (const s of snow) {
      s.y += dt * .01 * s.z; s.x += Math.sin(time * .3 + s.ph) * dt * .004;
      if (s.y > 1) s.y = 0;
      const x = ((s.x - G.cam.x * .0006 * s.z) % 1 + 1) % 1 * W, y = ((s.y - G.cam.y * .0006 * s.z) % 1 + 1) % 1 * H;
      ctx.globalAlpha = .25 + s.z * .45; ctx.fillRect(x, y, 1 + s.z * 1.4, 1 + s.z * 1.4);
    }
    ctx.globalAlpha = 1;
  }

  function drawBird(G, Wd) {
    const b = Wd.bird, p = G.player;
    if (p.swimming) return;
    ctx.save(); ctx.translate(b.x, b.y);
    if (b.state === 'dive') ctx.rotate(.3 * Math.cos(b.t * 2));
    Sprites.drawBird(ctx, { s: b.state === 'dive' ? .6 : .45, ph: b.ph * 3 });
    ctx.restore();
    /* its shadow on the ground when it swoops low */
    if (b.state === 'dive') { const gy = Wd.ground.walkTop(b.x, 4); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(b.x, gy, 30, 4, 0, 0, TAU); ctx.fill(); }
  }

  function drawPlayer(G, p, time) {
    ctx.save();
    const glowR = p.stage === 'crab' ? p.w * .9 + 6 : p.r * 4 + 4;
    const gg = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, glowR);
    gg.addColorStop(0, `rgba(255,240,190,${.18 + G.night * .16})`); gg.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = gg; ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
    if (p.stage === 'egg') {
      ctx.translate(p.x, p.y); ctx.rotate(Math.sin(time * 9) * p.crack * .4);
      ctx.strokeStyle = `rgba(255,240,150,${.5 + .4 * Math.sin(time * 4)})`; ctx.lineWidth = .4; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.stroke();
      Sprites.drawEgg(ctx, { s: 1.4, eye: true }); ctx.restore(); return;
    }
    if (p.swimming) {
      ctx.translate(p.x, p.y);
      if (p.tumble > 0) ctx.rotate(p.spin);
      ctx.scale(p.face, 1); ctx.rotate(p.ang * p.face);
      if (p.molting > 0) { ctx.globalAlpha = .6 + .4 * Math.sin(time * 20); }
      if (p.stage === 'zoea') Sprites.drawZoea(ctx, { s: p.r / 3.2, ph: p.phase * (p.moving ? 2.2 : 1), form: p.form, instar: p.zinstar });
      else Sprites.drawMegalopa(ctx, { s: p.r / 4, ph: p.phase * (p.moving ? 2.2 : 1), form: p.form });
      ctx.restore(); return;
    }
    /* the crab */
    ctx.translate(p.x, p.y);
    if (p.mode === 'tossed') ctx.rotate(p.spin);
    else if (p.mode === 'burrow' || p.mode === 'moult' || p.mode === 'harden' || p.mode === 'brood') ctx.rotate(clamp(Math.sin(p.ang) * 0, -1, 1));
    else ctx.rotate(p.ang);
    const inBurrow = p.underground;
    if (p.mode === 'moult') { const k = 1 - p.molting / MOLT_T; ctx.globalAlpha = .5; Sprites.drawCrab(ctx, { s: p.w / 100 * .97, form: p.form, sex: p.sex, pale: .9, tuck: .5, eyes: .2 }); ctx.globalAlpha = 1; ctx.translate(0, -k * p.w * .25); }
    Sprites.drawCrab(ctx, { s: p.w / 100, form: p.form, sex: p.sex, walk: p.walk, moving: p.moving, pale: p.pale, wet: p.water > .8 ? (p.water - .8) * 5 : 0, up: p.up, pinch: p.pinch, eat: p.eatAnim, eyes: p.mode === 'rest' ? .1 : inBurrow ? .7 : 1, tuck: p.mode === 'rest' ? .8 : inBurrow ? .6 : 0, eggs: p.sex === 'girl' ? p.eggs : 0, face: p.face, seed: 11 });
    ctx.restore();
  }

  function drawRain(G, Wd, view, weather, time) {
    if (weather.rain < .03) return;
    const n = Math.floor(weather.rain * (quality === 'low' ? 140 : 300));
    ctx.strokeStyle = `rgba(190,215,240,${.4 * weather.rain})`; ctx.lineWidth = 1.2 / G.cam.zoom * 1.4;
    ctx.beginPath();
    const len = 16 / G.cam.zoom * 1.5;
    for (let k = 0; k < n; k++) {
      const seed = k * 97.13, x = view.l + ((seed * 13.7 + time * 40) % (view.r - view.l)), yy = view.t + ((seed * 7.3 + time * 900 / G.cam.zoom) % (view.b - view.t));
      if (yy > Wd.ground.topAt(x) || (x < 100 && yy > Wd.seaLevel())) continue;
      ctx.moveTo(x, yy); ctx.lineTo(x - len * .2, yy + len);
    }
    ctx.stroke();
  }
  function drawForeground(G, cam, night, time) {
    if (quality === 'low' || G.player.underground) return;
    ctx.save(); ctx.globalAlpha = .9;
    for (const f of fore) {
      const x = ((f.x * W * 1.6 - cam.x * cam.zoom * 1.25) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * .3;
      const y = H + 30 - (f.side ? 40 : 0);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2 + (f.side ? -.5 : .5) + Math.sin(time * .5 + f.a) * .05); ctx.scale(f.s, f.s);
      Sprites.drawLeaf(ctx, 200, 0, night > .5 ? '#0c1a14' : '#1e3a24');
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- overlays: pushing, the eggs' waves, arrows, labels ---------- */
  function arrow(x, y, a, col, alpha = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  /* a pulsing arrow beside the player pointing at a world point */
  function pointTo(G, tx, ty, col, time) {
    const cam = G.cam, p = G.player, [sx, sy] = cam.toScreen(tx, ty), [px, py] = cam.toScreen(p.x, p.y);
    const a = Math.atan2(sy - py, sx - px), d = Math.min(Math.hypot(sx - px, sy - py) - 10, 70 + Math.sin(time * 5) * 10);
    if (d > 24) arrow(px + Math.cos(a) * d, py + Math.sin(a) * d, a, col, .75 + .25 * Math.sin(time * 5));
  }
  function ringMeter(G, cx, cy, u, ok, flash, label, okLabel) {
    const R0 = 110, rr2 = lerp(R0, 26, u);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ok ? '#7dff7a' : 'rgba(255,230,140,.9)'; ctx.lineWidth = ok ? 8 : 5; ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, TAU); ctx.stroke();
    if (flash > 0) { ctx.strokeStyle = `rgba(255,255,200,${flash})`; ctx.lineWidth = 14 * flash; ctx.beginPath(); ctx.arc(cx, cy, 40 + (1 - flash) * 80, 0, TAU); ctx.stroke(); }
  }
  function drawOverlays(G, night, time) {
    const p = G.player, cam = G.cam, Wd = G.world;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (p.mode === 'shove' && p.wr) {
      const w = p.wr, [sx, sy] = cam.toScreen(w.mid, p.y - p.w * .3);
      const ok = p.shoveWindow();
      ringMeter(G, sx, sy, (w.ring % 1.8) / 1.8, ok, w.flash);
      const bw = Math.min(520, W * .6), bx = W / 2 - bw / 2, by = H - 190;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, bx - 8, by - 8, bw + 16, 40, 20); ctx.fill();
      const half = bw / 2, mk = W / 2 + w.p * half * (p.face > 0 ? 1 : -1);
      const lg = ctx.createLinearGradient(bx, 0, bx + bw, 0); lg.addColorStop(0, p.face > 0 ? '#ff7a5a' : '#7ad35a'); lg.addColorStop(.5, '#ffe27a'); lg.addColorStop(1, p.face > 0 ? '#7ad35a' : '#ff7a5a');
      ctx.fillStyle = lg; rr(ctx, bx, by, bw, 24, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mk, by + 12, 16, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(mk, by + 11); ctx.scale(.22, .22); Sprites.drawCrab(ctx, { s: 1, form: p.form, sex: p.sex }); ctx.restore();
      ctx.font = `900 ${Math.round(Math.min(26, W * .03))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = ok ? '#7dff7a' : '#fff3c0';
      const txt = w.done === 'win' ? 'YOU WIN!' : w.done === 'lose' ? 'WHOOPS!' : ok ? 'BIG SHOVE!  (E / ▲)' : 'PUSH!  (Space)';
      ctx.strokeText(txt, W / 2, by + 56); ctx.fillText(txt, W / 2, by + 56);
    }
    if (p.mode === 'release' && p.rel) {
      /* the wave meter: when the wave washes over you, shake! */
      const sw = Wd.swash(), ok = p.releaseWindow(), [sx, sy] = cam.toScreen(p.x, p.y);
      ringMeter(G, sx, sy, sw, ok, p.rel.flash);
      const bw = Math.min(420, W * .5), bx = W / 2 - bw / 2, by = H - 180;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, bx - 8, by - 8, bw + 16, 40, 20); ctx.fill();
      ctx.fillStyle = '#1a6ab0'; rr(ctx, bx, by, bw, 24, 12); ctx.fill();
      ctx.fillStyle = ok ? '#7dff7a' : '#8fd6ff'; rr(ctx, bx, by, bw * sw, 24, 12); ctx.fill();
      const need = G.diff().shakes;
      for (let k = 0; k < need; k++) { ctx.fillStyle = k < p.rel.good ? '#ffd23f' : 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(W / 2 - (need - 1) * 14 + k * 28, by - 22, 9, 0, TAU); ctx.fill(); }
      ctx.font = `900 ${Math.round(Math.min(26, W * .03))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = ok ? '#7dff7a' : '#fff3c0';
      const txt = ok ? 'SHAKE!  (Space)' : 'Wait for the wave…';
      ctx.strokeText(txt, W / 2, by + 56); ctx.fillText(txt, W / 2, by + 56);
    }
    /* arrows to where you are going */
    if (p.stage === 'megalopa' && p.homeHint && p.x < -260) pointTo(G, p.homeHint.x, p.homeHint.y, '#7fe0ff', time);
    if (p.stage === 'crab' && p.mode === 'walk') {
      if (p.flags.migrating && !p.flags.dipped && p.x > 60) pointTo(G, 0, Wd.seaLevel(), '#7fe0ff', time);
      else if (p.water < .3 && p.shade === 'sun') { const sh = Wd.nearestShelter(p.x); if (sh) pointTo(G, sh.x, sh.y - 6, '#a8e0ff', time); }
      else if (p.instar === 1 && !p.flags.forest) pointTo(G, WORLD.cliffR + 80, WORLD.plateau - 10, '#b7f07a', time);
      else if (p.foodHint) pointTo(G, p.foodHint.x, p.foodHint.y, '#ffe9a0', time);
      else if (p.flags.broodDone && !p.flags.released) pointTo(G, Wd.waterEdge(true), Wd.seaLevel(), '#7fe0ff', time);
      else if (p.sex === 'girl' && p.flags.dipped && !p.flags.met) { const h = Wd.hosts().sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; if (h && Math.abs(h.x - p.x) > 40) pointTo(G, h.x, h.y, '#ff9ad0', time); }
      else if (p.sex === 'boy' && p.flags.dipped && !p.flags.burrowDug && (p.x < WORLD.terraceL || p.x > WORLD.terraceR)) pointTo(G, 380, -36, '#ffe9a0', time);
      else if (p.full && !p.burrow) { /* a full crab with no burrow yet: nothing to point at, just the hint */ }
      else if (p.full && p.burrow && Math.abs(p.burrow.x - p.x) > 30) pointTo(G, p.burrow.x, p.burrow.y, '#ffe9a0', time);
    }
    /* off-screen things that matter */
    const targets = [];
    const riv = Wd.rival(); if (riv && p.stage === 'crab') targets.push([riv.x, riv.y, '#ff9a6a']);
    const fem = Wd.female(); if (fem && p.stage === 'crab' && !p.flags.met) targets.push([fem.x, fem.y, '#ff9ad0']);
    for (const [x, y, col] of targets) {
      const [sx, sy] = cam.toScreen(x, y);
      if (sx > 40 && sx < W - 40 && sy > 110 && sy < H - 60) continue;
      const cx = clamp(sx, 50, W - 50), cy = clamp(sy, 130, H - 80);
      arrow(cx, cy, Math.atan2(sy - cy, sx - cx), col);
    }
    if (G.settings.labels) drawLabels(G);
  }
  function drawLabels(G) {
    const cam = G.cam, Wd = G.world, S = Wd.ground, p = G.player;
    ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, t) => { const [sx, sy] = cam.toScreen(x, y); if (sx < 0 || sx > W || sy < 100 || sy > H) return; const w = ctx.measureText(t).width + 14; ctx.fillStyle = 'rgba(255,252,240,.85)'; rr(ctx, sx - w / 2, sy - 11, w, 22, 11); ctx.fill(); ctx.fillStyle = '#2a2016'; ctx.fillText(t, sx, sy); };
    const v = cam.viewRect(0);
    if (!p.swimming) {
      const seen = new Set();
      for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, d = 50 + (k % 3) * 40, x = p.x + Math.cos(a) * d, y = p.y + Math.abs(Math.sin(a)) * d * .8 + 20, m = S.matAt(x, y); if (m === MAT.AIR || seen.has(m)) continue; seen.add(m); tag(x, y, MAT_INFO[m].name); }
    } else {
      const seen = new Set();
      for (const q of Wd.plankton) { if (seen.has(q.kind) || Math.hypot(q.x - p.x, q.y - p.y) > 80) continue; seen.add(q.kind); tag(q.x, q.y - 6, { diatom: 'diatom', chain: 'diatom chain', dino: 'glowing plankton', copepod: 'copepod' }[q.kind]); }
      for (const j of Wd.jellies) if (j.x > v.l && j.x < v.r) tag(j.x, j.y - j.r - 8, 'moon jellyfish');
      if (Wd.whale) tag(Wd.whale.x, Wd.whale.y - 120, 'whale shark');
    }
    tag(p.x, p.y - (p.stage === 'crab' ? p.w * .6 + 12 : p.r * 3 + 8), STAGES[STAGE_INDEX[p.stageKey()]].name);
    for (const it of Wd.items) if (Math.abs(it.x - p.x) < 300 && it.bites > 0 && it.fy === null) tag(it.x, it.y - 12, FOOD_KINDS[it.kind].name);
    const r = Wd.robber; if (r.state !== 'away') tag(r.x, r.y - 80, 'robber crab');
    for (const n of Wd.npcs) tag(n.x, n.y - n.w * .6 - 8, n.role === 'rival' ? 'rival boy' : n.sex === 'girl' ? 'girl crab' : 'boy crab');
    if (Math.abs(Wd.ranger.x - p.x) < 600) tag(Wd.ranger.x, S.surfaceAt(Wd.ranger.x) - 110, 'park ranger');
  }

  function snapshot(G) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    frame(G, 0, true);
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }
  function invalidate() { builtFor = null; }

  return { init, resize, setQuality, getFps, frame, snapshot, invalidate, skyColours, drawMoonDisc };
})();
