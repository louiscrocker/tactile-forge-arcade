/* ============================================================
   render.js — the rainforest, back to front
   ============================================================
     sky (time of day, weather) · stars · moon / sun
     three far layers of rainforest silhouettes with mist between
     the climbable trees (trunks, buttresses, branches, vines,
     leaf clumps)
     THE LOG AND THE SOIL, cut away like an ant farm: the inside
     of every tunnel shows the dark wood behind it, and the solid
     cells are painted at 3x with smooth, round edges (Ant
     Kingdom's method: each pixel blends its four nearest smoothed
     cells, the edge sharpened from the blend; deterministic, so a
     repainted chunk never shows a seam)
     moss, ferns, leaf litter, mushrooms · shed skins · fruit ·
     sticks · critters · the coati · other beetles · YOU
     particles · rain · foreground leaves
     night (a moonlit multiply) · glowing fungus and fireflies
     (additive) · a soft light around you underground · vignette
     overlays: the wrestling ring and meter, pointers, name tags
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
  const stars = [];
  let layers = [];                         /* far forest silhouettes */
  let lo = null, loImg = null, hi = null, hiCtx = null, back = null, backCtx = null, smooth = null;
  let buf = null, bufCtx = null, grainPat = null, grain = null;
  let builtFor = null;
  let decor = null, glowSpots = [], clumpCache = new Map();
  const fore = [];

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    for (let i = 0; i < 220; i++) stars.push([Math.random(), Math.random() * .8, Math.random(), Math.random() * TAU]);
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
    /* long wood fibres, wrapped so the tile is seamless */
    for (let i = 0; i < 260; i++) {
      const y = R() * 256, x = R() * 256, L = 30 + R() * 120, dark = R() < .6;
      g.strokeStyle = dark ? `rgba(30,14,4,${.08 + R() * .14})` : `rgba(255,236,200,${.05 + R() * .09})`; g.lineWidth = .6 + R() * 1.2;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.bezierCurveTo(x + ox + L * .3, y + oy + (R() - .5) * 3, x + ox + L * .7, y + oy + (R() - .5) * 3, x + ox + L, y + oy + (R() - .5) * 2); g.stroke(); }
    }
    for (let i = 0; i < 3000; i++) { const v = R(); g.fillStyle = v < .55 ? `rgba(0,0,0,${R() * .2})` : `rgba(255,240,210,${R() * .12})`; g.fillRect(R() * 256, R() * 256, 1 + (R() < .3), 1); }
  }
  /* three tileable bands of rainforest silhouettes */
  function buildLayers() {
    layers = [];
    const specs = [{ h: 520, base: '#7fa89a', crowns: 22, par: .12, y: 0 }, { h: 560, base: '#4f7d6a', crowns: 18, par: .24, y: 40 }, { h: 600, base: '#2f5a48', crowns: 14, par: .4, y: 90 }];
    specs.forEach((sp, li) => {
      const c = document.createElement('canvas'), w = 2048; c.width = w; c.height = sp.h;
      const g = c.getContext('2d'), R = mulberry32(31 + li * 7);
      g.fillStyle = sp.base;
      const crown = (x, y, r) => { for (let k = 0; k < 7; k++) { const a = R() * Math.PI - Math.PI, d = r * .55; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .6, r * (.5 + R() * .35), 0, TAU); g.fill(); } };
      for (let k = 0; k < sp.crowns; k++) {
        const x = (k + R() * .6) / sp.crowns * w, top = sp.h * (.12 + R() * .35), r = 50 + R() * 70;
        g.fillRect(x - 5 - li * 2, top, 10 + li * 4, sp.h - top);
        for (const dx of [-w, 0, w]) crown(x + dx, top, r);
        if (R() < .4) { /* a palm */ const px = x + 60, pt = sp.h * (.3 + R() * .2); g.fillRect(px - 3, pt, 6, sp.h - pt); g.save(); g.translate(px, pt); for (let j = 0; j < 7; j++) { g.rotate(TAU / 7); g.beginPath(); g.ellipse(34, 0, 36, 7, .3, 0, TAU); g.fill(); } g.restore(); }
      }
      g.fillRect(0, sp.h * .78, w, sp.h * .22);
      /* hanging vines */
      g.strokeStyle = sp.base; g.lineWidth = 2;
      for (let k = 0; k < 20; k++) { const x = R() * w, y = sp.h * (.25 + R() * .2); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y + 60, x - 4, y + 90 + R() * 120); g.stroke(); }
      layers.push({ img: c, par: sp.par, y: sp.y, h: sp.h });
    });
  }

  /* ---------- the log and the soil ---------- */
  function cellColour(S, i, c, r, out, backWall) {
    const m = backWall ? S.orig[i] : S.mat[i];
    if (m === MAT.AIR) { out[0] = out[1] = out[2] = out[3] = 0; return; }
    const info = MAT_INFO[m], t = S.tex[i] / 255, x = S.cx(c), y = S.cy(r);
    let R = lerp(info.col[0], info.col2[0], t), Gc = lerp(info.col[1], info.col2[1], t), B = lerp(info.col[2], info.col2[2], t);
    let f = 1;
    const lr = S.radAt(x), axis = S.logAxis(x), d = lr > 0 ? Math.abs(y - axis) / lr : 9;
    if (m === MAT.HEART) f *= 1 + Math.sin(d * 40) * .07;                         /* growth rings */
    if (m === MAT.ROT || m === MAT.PUNK || m === MAT.HEART) { const band = Math.sin(y * .9 + Math.sin(x * .013) * 6 + t * 2.2); f *= 1 + band * .07; if (Math.abs(Math.sin(y * .23 + Math.sin(x * .02) * 3)) < .05) f *= .82; }
    if (m === MAT.ROT) f *= 1 + Math.sin(d * 34 + t * 2) * .04;
    if (m === MAT.PUNK) { const thread = Math.sin(x * .9 + Math.sin(y * .3) * 4) > .8 ? 1.12 : 1; f *= thread; }
    if (m === MAT.BARK) {
      /* moss and lichen on the top of the log */
      if (y < axis - lr * .55) { const moss = smoothstep(-.55, -.85, (y - axis) / lr) * (.6 + t * .4); R = lerp(R, 70, moss); Gc = lerp(Gc, 112, moss); B = lerp(B, 52, moss); }
      if (t > .86) { R = 160; Gc = 168; B = 130; }
      f *= .9 + ((c * 7 + r * 3) % 5) * .02;
    }
    if (m === MAT.SOIL || m === MAT.CLAY || m === MAT.ROOT) { const depth = y - S.groundAt(x); f *= 1 - clamp(depth / 700, 0, 1) * .35; if (depth < 14 && m === MAT.SOIL) { R *= .8; Gc *= .78; B *= .72; } }
    const dmg = S.dmg[i]; if (dmg > 0 && !backWall) f *= 1 - dmg * .3;
    if (backWall) {
      /* the far side of an eaten tunnel: dark, warm wood or soil */
      const wood = m === MAT.ROT || m === MAT.PUNK || m === MAT.HEART || m === MAT.BARK;
      R = wood ? 44 + t * 16 : 32 + t * 10; Gc = wood ? 25 + t * 9 : 21 + t * 7; B = wood ? 14 + t * 5 : 14 + t * 5;
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
  function buildWood(S) {
    lo = document.createElement('canvas'); lo.width = S.cols; lo.height = S.rows; loImg = lo.getContext('2d').createImageData(S.cols, S.rows);
    hi = document.createElement('canvas'); hi.width = S.cols * HI; hi.height = S.rows * HI; hiCtx = hi.getContext('2d');
    back = document.createElement('canvas'); back.width = S.cols * HI; back.height = S.rows * HI; backCtx = back.getContext('2d');
    grainPat = ctx.createPattern(grain, 'repeat');
    if (grainPat.setTransform) grainPat.setTransform(new DOMMatrix().scale(.5, .5));
    for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, true);
    /* frass speckles and a few old tunnels' texture on the back wall */
    const R = mulberry32(S.seed + 5);
    backCtx.fillStyle = 'rgba(190,140,90,.16)';
    for (let k = 0; k < 9000; k++) { const x = R() * back.width, y = R() * back.height; backCtx.fillRect(x, y, 1.5, 1.2); }
    S.dirtyAll = false; S.paint.fill(0);
    for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, false);
    builtFor = S;
    buildDecor(S);
  }
  function updateWood(S) {
    if (builtFor !== S) buildWood(S);
    if (S.dirtyAll) { S.dirtyAll = false; S.paint.fill(0); for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, false); }
    for (let k = 0; k < S.paint.length; k++) if (S.paint[k]) {
      S.paint[k] = 0;
      const kc = k % S.ccols, kr = (k / S.ccols) | 0;
      paintCells(S, kc * WOOD_CH - 2, kr * WOOD_CH - 2, kc * WOOD_CH + WOOD_CH + 1, kr * WOOD_CH + WOOD_CH + 1, false);
    }
  }
  /* things that sit on the surface: moss tufts, ferns, mushrooms, leaf litter; glowing fungus spots */
  function buildDecor(S) {
    const R = mulberry32(S.seed + 9);
    decor = { litter: [], ferns: [], shrooms: [], vines: [] };
    for (let x = WORLD.left; x < WORLD.right; x += 7 + R() * 9) decor.litter.push({ x, a: R() * TAU, s: .5 + R() * .7, col: pick(['#7a4a24', '#9a5a2a', '#6a5a2a', '#a8742e', '#5a3a1a', '#4a6a2a']) });
    for (let k = 0; k < 46; k++) { const x = lerp(WORLD.left, WORLD.right, R()); if (x > WORLD.logL - 20 && x < WORLD.logR + 20 && R() < .7) continue; decor.ferns.push({ x, s: .7 + R() * .9, kind: R() < .55 ? 'fern' : R() < .5 ? 'broad' : 'palm', flip: R() < .5 ? -1 : 1, ph: R() * TAU }); }
    for (let k = 0; k < 26; k++) { const x = lerp(WORLD.logL + 40, WORLD.logR - 20, R()); decor.shrooms.push({ x, s: .8 + R() * 1.2, kind: R() < .45 ? 'bracket' : 'cap', side: R() }); }
    for (let k = 0; k < 10; k++) { const x = lerp(WORLD.left + 100, WORLD.right - 100, R()); decor.shrooms.push({ x, s: .7 + R(), kind: 'cap', side: 0, ground: true }); }
    /* glowing spots where there is fungus wood (sampled) */
    glowSpots = [];
    for (let r = 0; r < S.rows; r += 3) for (let c = 0; c < S.cols; c += 3) { const i = r * S.cols + c; if (S.orig[i] === MAT.PUNK && R() < .7) {
      /* a little branching strand of mycelium */
      const x0 = S.cx(c) + (R() - .5) * 6, y0 = S.cy(r) + (R() - .5) * 6, pts = [[x0, y0]];
      let a = R() * TAU, x = x0, y = y0;
      for (let k = 0; k < 5; k++) { a += (R() - .5) * 1.4; x += Math.cos(a) * (3 + R() * 4); y += Math.sin(a) * (2 + R() * 3); pts.push([x, y]); }
      const bi = 1 + ((R() * 3) | 0), bp = pts[bi], ba = a + (R() < .5 ? 1.2 : -1.2), br = [[bp[0], bp[1]], [bp[0] + Math.cos(ba) * 5, bp[1] + Math.sin(ba) * 4], [bp[0] + Math.cos(ba + .4) * 9, bp[1] + Math.sin(ba + .4) * 7]];
      glowSpots.push({ i, x: x0, y: y0, ph: R() * TAU, pts, br });
    } }
  }

  /* ---------- trees ---------- */
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
      g.fillStyle = cols[(R() * cols.length) | 0];
      g.globalAlpha = .95;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * .3, -L * .3, L * .8, -L * .2, L, 0); g.bezierCurveTo(L * .8, L * .2, L * .3, L * .3, 0, 0); g.fill();
      g.fillStyle = `rgba(255,255,220,${Math.max(0, sh) * .4})`; g.fill();
      g.restore();
    }
    clumpCache.set(key, c);
    return c;
  }
  function pathPoly(c, path, steps) {
    const L = [], Rr = [];
    for (let k = 0; k <= steps; k++) { const p = path.at_(k / steps * path.len), nx = -Math.sin(p.ang), ny = Math.cos(p.ang); L.push([p.x + nx * p.w / 2, p.y + ny * p.w / 2]); Rr.push([p.x - nx * p.w / 2, p.y - ny * p.w / 2]); }
    c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (const p of L) c.lineTo(p[0], p[1]); for (let k = Rr.length - 1; k >= 0; k--) c.lineTo(Rr[k][0], Rr[k][1]); c.closePath();
  }
  function drawTree(G, T, view, night, back) {
    const tr = T.trunk, base = tr.pts[0];
    if (T.x + 500 < view.l || T.x - 500 > view.r) return;
    const time = G.time, wind = G.forest.weather.gust;
    if (back) {
      /* leaf clumps behind the branches */
      for (const cl of T.leafClusters) { const img = clump(cl.r, (cl.ph * 1000) | 0, T.kind); const sway = Math.sin(time * .7 + cl.ph) * (3 + wind * 8); ctx.drawImage(img, cl.x - img.width / 2 + sway, cl.y - img.height / 2); }
      return;
    }
    /* buttress roots */
    ctx.fillStyle = '#5a4430';
    if (T.kind === 'ceiba') for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(base.x + s * 20, base.y - 160); ctx.quadraticCurveTo(base.x + s * 40, base.y - 30, base.x + s * 110, base.y + 6); ctx.lineTo(base.x + s * 20, base.y + 10); ctx.closePath(); ctx.fill(); }
    /* branches, then the trunk on top */
    for (const p of T.paths.slice(1)) {
      pathPoly(ctx, p, 12);
      const g = ctx.createLinearGradient(p.pts[0].x, p.pts[0].y - 10, p.pts[0].x, p.pts[0].y + 10);
      g.addColorStop(0, '#8a6a4a'); g.addColorStop(1, '#4a3424');
      ctx.fillStyle = g; ctx.fill();
      /* moss on top, and a hanging vine */
      ctx.strokeStyle = 'rgba(90,140,60,.7)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let k = 0; k <= 10; k++) { const q = p.at_(k / 10 * p.len); k ? ctx.lineTo(q.x, q.y - q.w / 2) : ctx.moveTo(q.x, q.y - q.w / 2); } ctx.stroke();
      const v = p.at_(p.len * .55), sw = Math.sin(time * .8 + p.at) * 6;
      ctx.strokeStyle = '#3f6a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(v.x, v.y); ctx.quadraticCurveTo(v.x + sw, v.y + 80, v.x + sw * 1.5, v.y + 150); ctx.stroke();
      ctx.fillStyle = '#4f8a36'; for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.ellipse(v.x + sw * k / 4, v.y + k * 26, 5, 2.5, .6 * (k % 2 ? 1 : -1), 0, TAU); ctx.fill(); }
    }
    pathPoly(ctx, tr, 16);
    const tg = ctx.createLinearGradient(base.x - tr.w0 / 2, 0, base.x + tr.w0 / 2, 0);
    tg.addColorStop(0, '#3e2c1e'); tg.addColorStop(.35, T.kind === 'ceiba' ? '#9a8a74' : '#7a5a3e'); tg.addColorStop(1, '#3a2a1c');
    ctx.fillStyle = tg; ctx.fill();
    /* bark: long vertical cracks, and spikes on a ceiba */
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(30,20,12,.35)'; ctx.lineWidth = 2;
    const R = mulberry32(T.seed);
    for (let k = 0; k < 26; k++) { const s0 = R() * tr.len, p = tr.at_(s0), off = (R() - .5) * p.w * .8; ctx.beginPath(); ctx.moveTo(p.x + off, p.y); ctx.lineTo(p.x + off + (R() - .5) * 4, p.y - 40 - R() * 80); ctx.stroke(); }
    ctx.restore();
    if (T.kind === 'ceiba') { ctx.fillStyle = '#6a5a48'; const R2 = mulberry32(T.seed + 1); for (let k = 0; k < 30; k++) { const p = tr.at_(R2() * tr.len * .8), side = R2() < .5 ? -1 : 1, x = p.x + side * p.w / 2; ctx.beginPath(); ctx.moveTo(x, p.y - 4); ctx.lineTo(x + side * 7, p.y); ctx.lineTo(x, p.y + 4); ctx.fill(); } }
    /* a bromeliad perched on a branch fork */
    if (T.paths[2]) { const p = T.paths[2].at_(T.paths[2].len * .3); ctx.fillStyle = '#c8442a'; ctx.beginPath(); ctx.ellipse(p.x, p.y - p.w / 2 - 6, 4, 9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#4f8a36'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(p.x + k * 5, p.y - p.w / 2 - 4, 3, 12, k * .35, 0, TAU); ctx.fill(); } }
  }

  /* ---------- the frame ---------- */
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  function frame(G, dt, clean) {
    const { cam, forest: F, tod, time } = G, S = F.wood, weather = F.weather, p = G.player;
    const night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    updateWood(S);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    const horizonY = (0 - cam.y) * cam.zoom + H / 2;

    /* --- sky --- */
    let [top, bot] = skyColours(tod);
    if (weather.cloud > .01) { top = mixHex(top, '#3a4450', weather.cloud * .6); bot = mixHex(bot, '#7a8a90', weather.cloud * .55); }
    const sky = ctx.createLinearGradient(0, Math.min(0, horizonY - H * 1.4), 0, Math.max(horizonY, 10));
    sky.addColorStop(0, top); sky.addColorStop(1, bot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (night > .05 && weather.cloud < .85) {
      for (const [sx, sy, r, ph] of stars) {
        const y = sy * Math.max(200, horizonY) - (cam.y < -600 ? (cam.y + 600) * .02 : 0); if (y > horizonY - 30) continue;
        ctx.globalAlpha = night * (0.3 + .7 * (.5 + .5 * Math.sin(time * 2 + ph * 6))) * (1 - weather.cloud);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * W, y, .5 + r * 1.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawSunMoon(tod, night, horizonY, weather.cloud, cam);
    /* far forest + mist */
    layers.forEach((L, li) => {
      const z = Math.min(1.2, cam.zoom) * (.55 + li * .15);
      const w = L.img.width * z, h = L.img.height * z;
      const y = horizonY - h + (L.y + 40) * z + (cam.y < 0 ? -cam.y * cam.zoom * (1 - L.par) * .25 : 0);
      let x0 = (-(cam.x * cam.zoom * L.par) % w) - w; while (x0 > -w) x0 -= w;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.filter = quality === 'low' ? 'none' : `brightness(${lerp(1, .35 + li * .05, night)})`;
      for (let x = x0; x < W; x += w) ctx.drawImage(L.img, x, y, w, h);
      ctx.restore();
      const mist = ctx.createLinearGradient(0, y + h * .5, 0, y + h);
      const mc = night > .5 ? '40,60,90' : '220,235,230';
      mist.addColorStop(0, `rgba(${mc},0)`); mist.addColorStop(1, `rgba(${mc},${.35 + G.forest.humid * .2})`);
      ctx.fillStyle = mist; ctx.fillRect(0, y + h * .5, W, h * .5 + 2);
    });
    ctx.filter = 'none';
    if (horizonY < H) { ctx.fillStyle = '#1c120a'; ctx.fillRect(0, Math.max(0, horizonY), W, H); }

    /* ---------------- world space ---------------- */
    ctx.save();
    cam.apply(ctx);
    const view = cam.viewRect(120);
    for (const T of F.trees) drawTree(G, T, view, night, true);
    for (const T of F.trees) drawTree(G, T, view, night, false);
    /* hanging fruit draws behind the leaves' front edge but in front of branches */
    for (const f of F.fruits) if (f.hanging && f.x > view.l && f.x < view.r) { ctx.save(); ctx.translate(f.x, f.y); Sprites.drawFruit(ctx, f.kind, f.bites, FRUIT_KINDS[f.kind].bites, Math.sin(time + f.s) * .1); ctx.restore(); }
    ctx.restore();

    /* the inside of the log and the holes in the soil, then the solid wood/soil with a shadow */
    drawWoodLayer(G, S, view);

    ctx.save();
    cam.apply(ctx);
    drawSurfaceDecor(G, S, view, night);
    drawThreads(S, view, night, time, false);
    /* shed skins and the egg chamber's leftovers, inside the tunnels */
    for (const e of F.exuviae || []) { ctx.save(); ctx.translate(e.x, e.y); Sprites.drawExuvia(ctx, e.r, e.ang); ctx.restore(); }
    if (p.stage !== 'egg') { ctx.save(); ctx.translate(WORLD.nestX, WORLD.nestY + 2); ctx.globalAlpha = .7; ctx.fillStyle = 'rgba(240,232,210,.7)'; ctx.beginPath(); ctx.ellipse(-2, 1, 4, 2, .3, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.ellipse(3, 0, 3, 2, -.4, Math.PI, TAU); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
    for (const g of F.grubs) { const pts = Sprites.grubShape(g.r, .55 + Math.sin(g.t * .7) * .25, g.t); ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.ang + Math.PI / 2); Sprites.drawGrub(ctx, pts, g.r, { phase: g.t * 3, instar: g.r < 5 ? 1 : 2 }); ctx.restore(); }
    for (const f of F.fruits) if (!f.hanging && f.x > view.l && f.x < view.r) { ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = f.gone ? clamp(1 - f.gone / 6, 0, 1) : 1; Sprites.drawFruit(ctx, f.kind, f.bites, FRUIT_KINDS[f.kind].bites, f.falling ? f.rot : 0); ctx.restore(); }
    ctx.globalAlpha = 1;
    for (const s of F.sticks) { if (s.x < view.l || s.x > view.r) continue; const y = S.walkTop(s.x, 10) - 4; ctx.save(); ctx.translate(s.x, y - (s.lift || 0) * 18); ctx.rotate(s.ang + (s.flipped ? Math.PI * .04 : 0)); if (s.flipped) ctx.scale(1, -1); Sprites.drawStick(ctx, s.len, s.lift || 0, (s.kind * 1e6) | 0); ctx.restore(); }
    for (const c of F.critters) { ctx.save(); ctx.translate(c.x, c.y); if (c.what === 'beetle') { ctx.scale(.12 * c.dir, .12); Sprites.drawBeetle(ctx, { s: 1, male: false, form: 'lichyi', wet: .6, moving: true, walk: c.ph }); } else { ctx.scale(c.kind === 'scuttle' ? 1 : .9, .9); Sprites.drawMillipede(ctx, c.ph, c.dir); } ctx.restore(); }
    drawCoati(G, F);
    for (const n of F.npcs) drawNPC(G, n);
    drawPlayer(G, p, time);
    G.particles.draw(ctx, cam);
    drawRain(G, view, weather, time);
    ctx.restore();

    /* ---------------- light ---------------- */
    const dark = Math.max(night * .78, weather.cloud * .3) * (p.underground ? .55 : 1);
    if (dark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      const nb = dark;
      ctx.fillStyle = `rgb(${lerp(255, 70, nb) | 0},${lerp(255, 92, nb) | 0},${lerp(255, 150, nb) | 0})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    /* the warm glow of dusk and dawn */
    const warm = (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - weather.cloud);
    if (warm > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,70,${warm * .55})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    /* glowing things, added on top of the dark */
    ctx.save(); cam.apply(ctx);
    if (night > .2) drawGlows(G, S, view, night, time);
    G.particles.ensureAmbient(quality === 'low' ? 24 : 50, view);
    if (weather.rain < .5) G.particles.drawAmbient(ctx, view, time, night, dt, (x, y) => S.origAt(x, y) === MAT.AIR && S.matAt(x, y) === MAT.AIR);
    ctx.restore();
    /* underground: a soft pool of light around you */
    if (p.underground) {
      const [sx, sy] = cam.toScreen(p.x, p.y);
      const rad = Math.max(W, H) * .5;
      const lg = ctx.createRadialGradient(sx, sy, rad * .18, sx, sy, rad);
      lg.addColorStop(0, 'rgba(10,5,2,0)'); lg.addColorStop(1, `rgba(10,5,2,${.45 + night * .2})`);
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    }
    drawForeground(G, cam, night, time);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(4,10,8,${.32 + night * .18})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (!clean) drawOverlays(G, night, time);
    Cinematic.draw(ctx, W, H);
  }

  function drawWoodLayer(G, S, view) {
    const cam = G.cam, b = bufCtx;
    const sx0 = clamp(Math.floor((view.l - S.X0) / S.C) - 1, 0, S.cols), sy0 = clamp(Math.floor((view.t - S.Y0) / S.C) - 1, 0, S.rows);
    const sx1 = clamp(Math.ceil((view.r - S.X0) / S.C) + 1, 0, S.cols), sy1 = clamp(Math.ceil((view.b - S.Y0) / S.C) + 1, 0, S.rows);
    if (sx1 <= sx0 || sy1 <= sy0) return;
    const src = [sx0 * HI, sy0 * HI, (sx1 - sx0) * HI, (sy1 - sy0) * HI], dst = [S.X0 + sx0 * S.C, S.Y0 + sy0 * S.C, (sx1 - sx0) * S.C, (sy1 - sy0) * S.C];
    /* the back wall, straight onto the screen */
    ctx.save(); cam.apply(ctx);
    ctx.drawImage(back, ...src, ...dst);
    if (view.b > WORLD.bottom) { ctx.fillStyle = '#1a110a'; ctx.fillRect(view.l, WORLD.bottom - 1, view.r - view.l, view.b - WORLD.bottom + 1); }
    ctx.restore();
    /* the solid layer, via a buffer: grain, then a shadow onto the back wall */
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, buf.width, buf.height);
    b.setTransform(DPR, 0, 0, DPR, 0, 0);
    b.save(); cam.apply(b);
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    b.drawImage(hi, ...src, ...dst);
    b.globalCompositeOperation = 'source-atop';
    b.globalAlpha = quality === 'low' ? .5 : .9; b.fillStyle = grainPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    b.globalAlpha = 1;
    b.restore(); b.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (quality !== 'low') { ctx.shadowColor = 'rgba(6,3,0,.85)'; ctx.shadowBlur = 10 * DPR * Math.min(2, cam.zoom); ctx.shadowOffsetX = 2 * DPR * cam.zoom; ctx.shadowOffsetY = 3 * DPR * cam.zoom; }
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  }

  function drawSunMoon(tod, night, horizonY, cloud, cam) {
    const skyTop = Math.min(horizonY, H) * .85;
    if (tod > .22 && tod < .82) {
      const t = invLerp(.22, .82, tod), x = W * (.1 + .8 * t), y = horizonY - Math.sin(Math.PI * t) * Math.max(160, skyTop) - 20;
      ctx.globalAlpha = 1 - cloud * .7;
      const g = ctx.createRadialGradient(x, y, 8, x, y, 220); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(.12, 'rgba(255,230,160,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, y - 220, 440, 440);
      ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const t = tod > .5 ? invLerp(.78, 1.28, tod) : invLerp(-.22, .28, tod), x = W * (.15 + .7 * t), y = horizonY - Math.sin(Math.PI * clamp(t, 0, 1)) * Math.max(160, skyTop) * .9 - 30;
      ctx.globalAlpha = night * (1 - cloud * .8);
      const g = ctx.createRadialGradient(x, y, 10, x, y, 260); g.addColorStop(0, 'rgba(220,235,255,.55)'); g.addColorStop(.2, 'rgba(160,190,255,.18)'); g.addColorStop(1, 'rgba(120,150,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 260, y - 260, 520, 520);
      const mg = ctx.createRadialGradient(x - 10, y - 10, 4, x, y, 40); mg.addColorStop(0, '#fffdf0'); mg.addColorStop(1, '#d9dcc8');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(x, y, 38, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(150,150,130,.35)'; for (const [dx, dy, r] of [[-12, -8, 8], [10, 6, 6], [4, -16, 4], [-6, 14, 5]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }

  function drawSurfaceDecor(G, S, view, night) {
    if (!decor) return;
    const time = G.time, wind = G.forest.weather.gust;
    for (const l of decor.litter) {
      if (l.x < view.l || l.x > view.r) continue;
      const y = S.topAt(l.x); if (y > S.groundAt(l.x) + 30) continue;
      ctx.save(); ctx.translate(l.x, y + 1); ctx.rotate(l.a * .3); ctx.fillStyle = l.col; ctx.beginPath(); ctx.ellipse(0, 0, 6 * l.s, 2.2 * l.s, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    for (const f of decor.ferns) {
      if (f.x < view.l - 80 || f.x > view.r + 80) continue;
      const y = S.walkTop(f.x, 6) + 2, sw = Math.sin(time * .9 + f.ph) * (.04 + wind * .08);
      ctx.save(); ctx.translate(f.x, y); ctx.scale(f.s * f.flip, f.s);
      if (f.kind === 'fern') { for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * .33 + sw; ctx.save(); ctx.rotate(a + Math.PI / 2); ctx.strokeStyle = '#3f7a32'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -30, 4, -60); ctx.stroke(); ctx.fillStyle = k % 2 ? '#4f9a3a' : '#3f8a30'; for (let j = 1; j < 9; j++) { const t = j / 9, x = lerp(0, 6, t) + Math.sin(t * 3) * 4, yy = -t * 58; ctx.beginPath(); ctx.ellipse(x - 5, yy, 5 * (1 - t * .6), 1.8, -.5, 0, TAU); ctx.ellipse(x + 5, yy, 5 * (1 - t * .6), 1.8, .5, 0, TAU); ctx.fill(); } ctx.restore(); } }
      else if (f.kind === 'broad') { for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(-1.2 + k * .7 + sw); Sprites.drawLeaf(ctx, 46, -Math.PI / 2 + .2, k % 2 ? '#3f8a3a' : '#2f7a32'); ctx.restore(); } }
      else { ctx.strokeStyle = '#4a6a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sw * 30, -50); ctx.stroke(); for (let k = 0; k < 7; k++) { ctx.save(); ctx.translate(sw * 30, -50); ctx.rotate(k / 7 * TAU + sw); Sprites.drawLeaf(ctx, 34, 0, '#4a8a3a'); ctx.restore(); } }
      ctx.restore();
    }
    for (const m of decor.shrooms) {
      if (m.x < view.l || m.x > view.r) continue;
      const x = m.x, y = S.topAt(x) + (m.kind === 'bracket' ? 3 + m.side * 6 : 1);
      ctx.save(); ctx.translate(x, y); Sprites.drawMushroom(ctx, m.s, 0, m.kind); ctx.restore();
    }
  }
  /* white fungus threads (mycelium) in the fungus wood, still there until eaten */
  function drawThreads(S, view, night, time, glow) {
    ctx.lineCap = 'round';
    for (const g of glowSpots) {
      if (g.x < view.l || g.x > view.r || g.y < view.t || g.y > view.b) continue;
      if (S.mat[g.i] !== MAT.PUNK) continue;
      const a = glow ? night * (.25 + .2 * Math.sin(time * 1.3 + g.ph)) : .5;
      ctx.strokeStyle = glow ? `rgba(150,255,170,${a})` : `rgba(250,244,226,${a * .8})`; ctx.lineWidth = glow ? 1.1 : .6; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const line of [g.pts, g.br]) { ctx.moveTo(line[0][0], line[0][1]); for (let k = 1; k < line.length; k++) ctx.lineTo(line[k][0], line[k][1]); }
      ctx.stroke();
    }
  }
  function drawGlows(G, S, view, night, time) {
    drawThreads(S, view, night, time, true);
    ctx.globalCompositeOperation = 'lighter';
    /* fungus wood glows a faint green (only where it has not been eaten) */
    if (decor) for (const m of decor.shrooms) {
      if (m.x < view.l || m.x > view.r) continue;
      const y = S.topAt(m.x) - (m.kind === 'cap' ? 6 * m.s : -3 - m.side * 6);
      const gl = ctx.createRadialGradient(m.x, y, 1, m.x, y, 22 * m.s);
      gl.addColorStop(0, `rgba(150,255,170,${.5 * night})`); gl.addColorStop(1, 'rgba(150,255,170,0)');
      ctx.fillStyle = gl; ctx.fillRect(m.x - 22 * m.s, y - 22 * m.s, 44 * m.s, 44 * m.s);
      ctx.save(); ctx.translate(m.x, y + (m.kind === 'cap' ? 6 * m.s : 0)); Sprites.drawMushroom(ctx, m.s, night, m.kind); ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawCoati(G, F) {
    const c = F.coati; if (c.state === 'away') return;
    ctx.save(); ctx.translate(c.x, c.y + 1);
    Sprites.drawCoati(ctx, { s: 1.15, dir: c.dir, legs: c.state === 'sniff' ? c.t * 2 : c.legs, sniff: c.state === 'sniff' ? .6 + Math.sin(c.t * 6) * .3 : 0 });
    ctx.restore();
  }
  function drawNPC(G, n) {
    ctx.save(); ctx.translate(n.x, n.y);
    if (n.spin) ctx.rotate(n.spin * (n.face || 1));
    ctx.scale(n.face < 0 ? -1 : 1, 1);
    const s = n.lengthMM * .38 / 150;
    const flying = n.mode === 'fly' || n.mode === 'tossed';
    if (flying) ctx.rotate(-.15);
    Sprites.drawBeetle(ctx, { s, male: n.male, form: n.form, wet: n.wet, walk: n.walk + G.time * (n.mode === 'wrestle' ? 6 : 0), moving: n.mode === 'wrestle' || (n.mode === 'ground' && n.walk > 0 && G.time % 3 < 2), open: flying ? 1 : 0, flap: n.flap, lengthMM: n.lengthMM, seed: (n.lengthMM * 7) | 0, lift: n.mode === 'wrestle' ? .3 + Math.sin(G.time * 5) * .2 : 0, pinch: n.mode === 'wrestle' ? .5 : 0 });
    ctx.restore();
  }

  function drawPlayer(G, p, time) {
    ctx.save();
    /* a soft glow so you never lose yourself */
    const glowR = p.stage === 'adult' ? 50 * p.size + 20 : p.r * 3 + 8;
    const gg = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, glowR);
    gg.addColorStop(0, `rgba(255,240,190,${.16 + G.night * .16})`); gg.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = gg; ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
    if (p.stage === 'egg') { ctx.translate(p.x, p.y); ctx.rotate(Math.sin(time * 9) * p.crack * .2); Sprites.drawEgg(ctx, { s: 1.5, grow: Math.min(1, p.eggT / 4), crack: p.crack }); ctx.restore(); return; }
    if (p.stage === 'grub' || p.stage === 'chamber') {
      const r = p.r;
      let pts;
      if (p.stage === 'chamber' || (!p.input.x && !p.input.y && !p.molting)) {
        /* resting: curled up, facing the way it last went */
        const curl = Sprites.grubShape(r, .75 + Math.sin(time * 1.2) * .08, time);
        const a = p.ang; pts = curl.map(q => ({ x: p.x + q.x * Math.cos(a) - q.y * Math.sin(a) + Math.cos(a) * r * .8, y: p.y + q.x * Math.sin(a) + q.y * Math.cos(a) + Math.sin(a) * r * .8 }));
        const off = { x: pts[0].x - p.x, y: pts[0].y - p.y }; pts = pts.map(q => ({ x: q.x - off.x, y: q.y - off.y }));
        if (p.stage === 'chamber') { const sp = p.build * 1.3 + time * .4; pts = curl.map(q => ({ x: p.room.x + q.x * Math.cos(sp) - q.y * Math.sin(sp), y: p.room.y + q.x * Math.sin(sp) + q.y * Math.cos(sp) })); }
      } else pts = p.trail;
      Sprites.drawGrub(ctx, pts, r, { phase: p.phase * 1.6, instar: p.instar, shed: p.molting > 0 ? 1 - p.molting / MOLT_T : 0, pale: p.molting > 0 });
      if (p.tight > 0 && !p.molting) { ctx.strokeStyle = `rgba(255,220,120,${.4 + .4 * Math.sin(time * 8)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.8, 0, TAU); ctx.stroke(); }
      ctx.restore(); return;
    }
    if (p.stage === 'pupa') {
      ctx.translate(p.x, p.y);
      Sprites.drawPupa(ctx, { s: p.size * .9, lengthMM: p.lengthMM, progress: clamp(p.pupaT / PUPA_T, 0, 1), t: time, wiggle: p.input.x || p.input.y ? 1 : .3 });
      ctx.restore(); return;
    }
    /* the adult */
    ctx.translate(p.x, p.y);
    let a = p.ang;
    if (p.mode === 'tunnel') { a = p.ang + (p.face < 0 ? Math.PI : 0); if (p.hardT < HARDEN_T) a = 0; }
    if (p.mode === 'climb' && p.perch && !p.perch.path.parent) { ctx.rotate(p.perch.dir >= 0 ? -Math.PI / 2 : Math.PI / 2); }
    else { ctx.rotate(p.mode === 'tossed' ? p.ang : (p.mode === 'ground' || p.mode === 'climb' ? p.ang : (p.mode === 'tunnel' ? (p.face < 0 ? p.ang - Math.PI : p.ang) * (p.hardT < HARDEN_T ? 0 : 1) : p.ang))); if (p.face < 0) ctx.scale(-1, 1); }
    const s = p.size;
    Sprites.drawBeetle(ctx, { s, male: true, form: p.form, wet: p.wet, pale: p.pale, walk: p.walk, moving: p.moving || (p.mode === 'tunnel' && (p.input.x || p.input.y)), open: p.open, flap: p.flap, lift: p.lift, pinch: p.pinch, lengthMM: p.lengthMM, seed: 11, eat: p.eatAnim || 0 });
    ctx.restore();
  }

  function drawRain(G, view, weather, time) {
    if (weather.rain < .03) return;
    const n = Math.floor(weather.rain * (quality === 'low' ? 140 : 300));
    ctx.strokeStyle = `rgba(190,215,240,${.4 * weather.rain})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const seed = k * 97.13, x = view.l + ((seed * 13.7 + time * 40) % (view.r - view.l)), yy = view.t + ((seed * 7.3 + time * 900) % (view.b - view.t));
      if (yy > G.forest.wood.topAt(x)) continue;
      ctx.moveTo(x, yy); ctx.lineTo(x - 3, yy + 16);
    }
    ctx.stroke();
  }
  /* big dark leaves very close to the camera, above ground only */
  function drawForeground(G, cam, night, time) {
    if (cam.y > 120 || quality === 'low' || G.player.underground) return;
    const k = clamp((120 - cam.y) / 200, 0, 1);
    ctx.save();
    ctx.globalAlpha = k * .9;
    for (const f of fore) {
      const x = ((f.x * W * 1.6 - cam.x * cam.zoom * 1.25) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * .3;
      const y = H + 30 - (f.side ? 40 : 0);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2 + (f.side ? -.5 : .5) + Math.sin(time * .5 + f.a) * .05); ctx.scale(f.s, f.s);
      Sprites.drawLeaf(ctx, 220, 0, night > .5 ? '#0c1a14' : '#1e3a24');
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- overlays: the wrestle, pointers, labels ---------- */
  function drawOverlays(G, night, time) {
    const p = G.player, cam = G.cam, F = G.forest;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (p.mode === 'wrestle' && p.wr) {
      const w = p.wr, [sx, sy] = cam.toScreen(w.mid, p.y);
      /* the timing ring: it shrinks round and round; green means LIFT */
      const u = (w.ring % 1.8) / 1.8, R0 = 110, rr2 = lerp(R0, 26, u);
      const ok = p.wrestleWindow();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(sx, sy - 10, 30, 0, TAU); ctx.stroke();
      ctx.strokeStyle = ok ? '#7dff7a' : 'rgba(255,230,140,.9)'; ctx.lineWidth = ok ? 8 : 5; ctx.beginPath(); ctx.arc(sx, sy - 10, rr2, 0, TAU); ctx.stroke();
      if (w.flash > 0) { ctx.strokeStyle = `rgba(255,255,200,${w.flash})`; ctx.lineWidth = 14 * w.flash; ctx.beginPath(); ctx.arc(sx, sy - 10, 40 + (1 - w.flash) * 80, 0, TAU); ctx.stroke(); }
      /* the tug-of-war meter */
      const bw = Math.min(520, W * .6), bx = W / 2 - bw / 2, by = H - 190;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, bx - 8, by - 8, bw + 16, 40, 20); ctx.fill();
      const half = bw / 2, mk = W / 2 + w.p * half * (p.face > 0 ? 1 : -1);
      const lg = ctx.createLinearGradient(bx, 0, bx + bw, 0); lg.addColorStop(0, p.face > 0 ? '#ff7a5a' : '#7ad35a'); lg.addColorStop(.5, '#ffe27a'); lg.addColorStop(1, p.face > 0 ? '#7ad35a' : '#ff7a5a');
      ctx.fillStyle = lg; rr(ctx, bx, by, bw, 24, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mk, by + 12, 16, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(mk, by + 14); ctx.scale(p.face, 1); ctx.scale(.13, .13); Sprites.drawBeetle(ctx, { s: 1, form: p.form, wet: p.wet, lengthMM: 160 }); ctx.restore();
      ctx.font = `900 ${Math.round(Math.min(26, W * .03))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = ok ? '#7dff7a' : '#fff3c0';
      const txt = w.done === 'win' ? 'YOU WIN!' : w.done === 'lose' ? 'WHOOPS!' : ok ? 'LIFT!  (E / ▲)' : 'PUSH!  (Space)';
      ctx.strokeText(txt, W / 2, by + 56); ctx.fillText(txt, W / 2, by + 56);
    }
    /* pointers to the things that matter, when they are off screen */
    const targets = [];
    if (p.stage === 'adult' && p.mode !== 'tunnel') {
      const riv = F.rival(); if (riv && riv.mode !== 'fly') targets.push([riv.x, riv.y, '#ff9a6a', 'rival']);
      const fem = F.female(); if (fem) targets.push([fem.x, fem.y, '#ff9ad0', 'female']);
      if (p.energy < .35) { const f = F.groundFruits().sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; if (f) targets.push([f.x, f.y, '#ffd23f', 'fruit']); }
    }
    for (const [x, y, col] of targets) {
      const [sx, sy] = cam.toScreen(x, y);
      if (sx > 40 && sx < W - 40 && sy > 110 && sy < H - 60) continue;
      const cx = clamp(sx, 50, W - 50), cy = clamp(sy, 130, H - 80), a = Math.atan2(sy - cy, sx - cx);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    /* the grub's sniffed-out food */
    if (p.foodHint && (p.stage === 'grub')) {
      const [sx, sy] = cam.toScreen(p.foodHint.x, p.foodHint.y), [px, py] = cam.toScreen(p.x, p.y);
      const a = Math.atan2(sy - py, sx - px), d = Math.min(Math.hypot(sx - px, sy - py) - 10, 70 + Math.sin(time * 5) * 10);
      if (d > 20) { ctx.save(); ctx.translate(px + Math.cos(a) * d, py + Math.sin(a) * d); ctx.rotate(a); ctx.globalAlpha = .75 + .25 * Math.sin(time * 5); ctx.fillStyle = '#ffe9a0'; ctx.strokeStyle = 'rgba(60,30,0,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
    if (G.settings.labels) drawLabels(G);
  }
  function drawLabels(G) {
    const cam = G.cam, S = G.forest.wood, p = G.player;
    ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, t) => { const [sx, sy] = cam.toScreen(x, y); if (sx < 0 || sx > W || sy < 100 || sy > H) return; const w = ctx.measureText(t).width + 14; ctx.fillStyle = 'rgba(255,252,240,.85)'; rr(ctx, sx - w / 2, sy - 11, w, 22, 11); ctx.fill(); ctx.fillStyle = '#2a2016'; ctx.fillText(t, sx, sy); };
    const seen = new Set();
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * TAU, d = 60 + (k % 3) * 40, x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, m = S.matAt(x, y);
      if (m === MAT.AIR || seen.has(m)) continue; seen.add(m); tag(x, y, MAT_INFO[m].name);
    }
    tag(p.x, p.y - (p.stage === 'adult' ? 40 * p.size + 20 : p.r * 2 + 14), STAGES[STAGE_INDEX[p.stageKey()]].name);
    for (const f of G.forest.fruits) if (Math.abs(f.x - p.x) < 600 && f.bites > 0) tag(f.x, f.y - 20, FRUIT_KINDS[f.kind].name);
    const riv = G.forest.rival(); if (riv) tag(riv.x, riv.y - 40, 'rival male');
    const fem = G.forest.female(); if (fem) tag(fem.x, fem.y - 34, 'female');
  }

  function snapshot(G) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    frame(G, 0, true);
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }
  function invalidate() { builtFor = null; }

  return { init, resize, setQuality, getFps, frame, snapshot, invalidate, skyColours };
})();
