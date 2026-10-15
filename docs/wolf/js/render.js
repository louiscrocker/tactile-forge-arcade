/* ============================================================
   render.js — the valley, back to front
   ============================================================
     sky (time of day, season, weather) · stars · the sun · the
     moon in its real phase · far snow-capped mountains and
     forested hills, three parallax bands
     trees behind the ground (so their roots are hidden): pines,
     aspens (green, gold, bare), willows, the big meadow tree
     THE VALLEY in cross-section (earth, rock, roots, gravel,
     snow, ice), painted from cells at 4x with smooth edges
     (Ant Kingdom's method), dens showing dark earth behind them
     the river (ripples; a sheet of ice in winter) · the rim along
     the ground · grass, sagebrush, wildflowers, leaf litter,
     boulders · the road on its embankment with the wildlife
     tunnel · tracks · scent posts · the meal
     the herds, ravens, grasshoppers and voles, the biologist,
     the pack, the pups, scents on the breeze, YOU · particles
     rain, snowfall, lightning · night (a moonlit multiply) · the
     dark of the den · vignette
     overlays: the play-fight ring and meter, the howl ring, the
     chase's puff bar, arrows, name tags
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1, quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  const HI = 4;
  const SKY = [
    [0.00, '#070b22', '#14234a'], [0.19, '#141a44', '#5a3a62'], [0.25, '#7a8fc8', '#ffb98a'],
    [0.36, '#58a8e0', '#d8eef8'], [0.55, '#4b9ce0', '#cfe8f4'], [0.70, '#6aa0d8', '#ffd2a0'],
    [0.79, '#3d3f8c', '#ff8a5c'], [0.86, '#121a48', '#3a2f5c'], [1.00, '#070b22', '#14234a']
  ];
  const stars = [], flakes = [];
  let layers = [];
  let lo = null, loImg = null, hi = null, hiCtx = null, back = null, backCtx = null, smooth = null;
  let buf = null, bufCtx = null, grainPat = null, grain = null;
  let builtFor = null, decor = null;
  const crowdCache = new Map();
  /* the painted wolf goes with the WebGL look; the classic one everywhere else */
  const wolfArt = () => (typeof Painted !== 'undefined' && typeof GFX !== 'undefined' && GFX.active() ? Painted : Sprites);

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    if (typeof GFX !== 'undefined') GFX.init(c);
    for (let i = 0; i < 220; i++) stars.push([Math.random(), Math.random() * .8, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 160; i++) flakes.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, ph: Math.random() * TAU });
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
    for (let i = 0; i < 5000; i++) { const v = R(); g.fillStyle = v < .55 ? `rgba(0,0,0,${R() * .2})` : `rgba(255,245,225,${R() * .14})`; g.fillRect(R() * 256, R() * 256, 1 + (R() < .3), 1 + (R() < .3)); }
    for (let i = 0; i < 140; i++) { const x = R() * 256, y = R() * 256, r = .6 + R() * 1.8; g.fillStyle = `rgba(0,0,0,${.1 + R() * .15})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = `rgba(255,250,235,${.08 + R() * .1})`; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .5, 0, TAU); g.fill(); }
  }
  /* three tileable bands: far snow-capped peaks, mid mountains, near forested hills */
  function buildLayers() {
    layers = [];
    const specs = [{ h: 420, par: .08, y: 0, kind: 'peaks' }, { h: 440, par: .16, y: 60, kind: 'mountains' }, { h: 460, par: .3, y: 130, kind: 'hills' }];
    specs.forEach((sp, li) => {
      const c = document.createElement('canvas'), w = 2048; c.width = w; c.height = sp.h;
      const g = c.getContext('2d'), R = mulberry32(31 + li * 7), n1 = makeNoise1D(41 + li);
      /* the skyline */
      const pts = [];
      for (let x = 0; x <= w; x += 16) {
        const u = x / w;
        let y = sp.h * .45;
        if (sp.kind === 'peaks') y = sp.h * (.22 + .25 * Math.abs(Math.sin(u * 7.3 + 1)) + .14 * n1(x * .03) - .1 * Math.abs(Math.sin(u * 19)));
        else if (sp.kind === 'mountains') y = sp.h * (.34 + .18 * Math.abs(Math.sin(u * 5.1 + 2)) + .14 * n1(x * .02 + 5));
        else y = sp.h * (.42 + .1 * Math.sin(u * 9 + 1) + .14 * n1(x * .025 + 9));
        pts.push([x, y]);
      }
      pts[pts.length - 1][1] = pts[0][1];
      const base = sp.kind === 'peaks' ? '#8ea2bc' : sp.kind === 'mountains' ? '#6a8296' : '#4a6a52';
      g.fillStyle = base; g.beginPath(); g.moveTo(0, sp.h); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(w, sp.h); g.closePath(); g.fill();
      if (sp.kind !== 'hills') {
        /* snowcaps: everything above a ragged snowline, clipped to the skyline; a shaded flank on each slope */
        g.save(); g.beginPath(); g.moveTo(0, sp.h); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(w, sp.h); g.closePath(); g.clip();
        const line = (x) => sp.h * (sp.kind === 'peaks' ? .4 : .46) + (n1(x * .05 + 20) - .5) * 40 + Math.sin(x * .09) * 6;
        const sg = g.createLinearGradient(0, 0, 0, sp.h * .5); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, sp.kind === 'peaks' ? '#dfe8f6' : '#cfdbe8');
        g.fillStyle = sg; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); for (let x = w; x >= 0; x -= 8) g.lineTo(x, line(x)); g.closePath(); g.fill();
        /* the shady side of each peak: from every summit, darken the slope to its right */
        g.fillStyle = 'rgba(40,60,100,.16)';
        for (let k = 1; k < pts.length - 1; k++) { const [x, y] = pts[k]; if (y < pts[k - 1][1] && y <= pts[k + 1][1]) { g.beginPath(); g.moveTo(x, y); let j = k; while (j < pts.length - 1 && pts[j + 1][1] >= pts[j][1]) j++; for (let m = k; m <= j; m++) g.lineTo(pts[m][0], pts[m][1]); g.lineTo(pts[j][0] - (pts[j][0] - x) * .3, sp.h); g.lineTo(x, sp.h); g.closePath(); g.fill(); } }
        g.restore();
        /* a dusting of pines along the lower slopes */
        g.fillStyle = sp.kind === 'peaks' ? '#6a7e96' : '#44605a';
        for (let k = 0; k < 220; k++) { const x = R() * w, y = sp.h * (.62 + R() * .35), s = 3 + R() * 6; g.beginPath(); g.moveTo(x, y - s * 2.4); g.lineTo(x + s, y); g.lineTo(x - s, y); g.closePath(); g.fill(); }
      } else {
        const crown = (x, y, r) => { for (let k = 0; k < 5; k++) { const a = R() * Math.PI - Math.PI, d = r * .5; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .6, r * (.5 + R() * .35), 0, TAU); g.fill(); } };
        g.fillStyle = '#3c5a44';
        for (let k = 0; k < 160; k++) { const x = R() * w, y = sp.h * (.46 + R() * .5), s = 5 + R() * 9; g.beginPath(); g.moveTo(x, y - s * 3); g.lineTo(x + s, y); g.lineTo(x - s, y); g.closePath(); g.fill(); }
        g.fillStyle = '#5a7a4a'; for (let k = 0; k < 20; k++) crown(R() * w, sp.h * (.5 + R() * .4), 20 + R() * 20);
      }
      layers.push({ img: c, par: sp.par, y: sp.y, h: sp.h, kind: sp.kind });
    });
  }

  /* ---------- the valley's cells ---------- */
  function cellColour(S, i, c, r, out, backWall) {
    const m = backWall ? S.orig[i] : S.mat[i];
    if (m === MAT.AIR) { out[0] = out[1] = out[2] = out[3] = 0; return; }
    const info = MAT_INFO[m], t = S.tex[i] / 255, x = S.cx(c), y = S.cy(r);
    let R = lerp(info.col[0], info.col2[0], t), Gc = lerp(info.col[1], info.col2[1], t), B = lerp(info.col[2], info.col2[2], t);
    let f = 1;
    const depth = y - S.surfaceAt(x);
    if (m === MAT.ROCK) {
      f *= 1 + Math.sin(x * .31 + Math.sin(y * .2) * 2) * .05 - (((c * 7 + r * 13) % 11) === 0 ? .18 : 0);
      if (depth > 30) f *= 1 - clamp((depth - 30) / 300, 0, .45);
      if (x > WORLD.ridgeL && x < WORLD.ridgeR) { R = lerp(R, 150, .3); Gc = lerp(Gc, 140, .3); B = lerp(B, 120, .3); }
    }
    if (m === MAT.SOIL || m === MAT.ROOT) {
      f *= 1 - clamp(depth / 300, 0, 1) * .4;
      if (m === MAT.SOIL && depth < 9) { R = lerp(R, 70, .45); Gc = lerp(Gc, 50, .45); B = lerp(B, 30, .45); }     /* a dark topsoil */
      if (x > WORLD.flatL && x < WORLD.flatR && depth < 20) { R = lerp(R, 160, .3); Gc = lerp(Gc, 130, .3); B = lerp(B, 90, .3); }   /* the drier valley floor */
    }
    if (m === MAT.SNOW) { const sh = Math.sin(x * .05 + y * .3) * .04; f *= .96 + sh; if (depth < -6) { R = 255; Gc = 255; B = 255; } }
    if (m === MAT.ICE) { f *= 1 + Math.sin(x * .2) * .05; }
    if (m === MAT.GRAVEL) f *= .9 + t * .2;
    const dmg = S.dmg[i]; if (dmg > 0 && !backWall) f *= 1 - dmg * .3;
    if (backWall) {
      /* the far side of a dug den: dark, damp earth */
      R = 42 + t * 14; Gc = 28 + t * 10; B = 16 + t * 6; f = 1;
      if (m === MAT.SNOW || m === MAT.ICE) { out[0] = out[1] = out[2] = out[3] = 0; return; }
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
    const R = mulberry32(S.seed + 9), W = WORLD;
    decor = { grass: [], sage: [], flowers: [], litter: [], stones: [], logs: [] };
    for (let x = W.left + 20; x < W.right - 20; x += 5 + R() * 9) { if ((x > W.riverL && x < W.riverR) || (x > W.tunnelL - 10 && x < W.tunnelR + 10)) continue; decor.grass.push({ x, s: .5 + R() * .8, ph: R() * TAU, k: R() }); }
    for (let x = W.flatL - 100; x < W.ridgeL + 100; x += 26 + R() * 40) decor.sage.push({ x, s: .7 + R() * .9, seed: (R() * 997) | 0 });
    for (let x = W.valleyL + 60; x < W.newDenL; x += 40 + R() * 60) decor.sage.push({ x, s: .6 + R() * .7, seed: (R() * 997) | 0 });
    for (let x = W.meadowL - 80; x < W.meadowR + 120; x += 10 + R() * 18) decor.flowers.push({ x, s: .6 + R() * .8, col: pick(['#ffd23f', '#ff7a9a', '#b48aff', '#ffffff', '#ff9a3a']), ph: R() * TAU });
    for (let x = W.valleyL; x < W.newDenL; x += 24 + R() * 30) decor.flowers.push({ x, s: .5 + R() * .7, col: pick(['#ffd23f', '#b48aff', '#ffffff']), ph: R() * TAU });
    for (let x = W.meadowR; x < W.flatL + 200; x += 4 + R() * 7) decor.litter.push({ x, a: R() * TAU, s: .5 + R() * .8, col: pick(['#e8b030', '#d89a28', '#f0c850', '#c88a20']) });
    for (let x = W.valleyL; x < W.newDenL; x += 6 + R() * 9) decor.litter.push({ x, a: R() * TAU, s: .5 + R() * .8, col: pick(['#e8b030', '#d89a28', '#f0c850']) });
    for (let k = 0; k < 60; k++) { const x = lerp(W.left, W.right, R()); if (x > W.riverL - 20 && x < W.riverR + 20) continue; decor.stones.push({ x, s: .4 + R() * 1.2, seed: (R() * 997) | 0 }); }
    for (let k = 0; k < 40; k++) { const x = lerp(W.riverL - 60, W.riverR + 60, R()); decor.stones.push({ x, s: .3 + R() * .8, seed: (R() * 997) | 0, wet: true }); }
    for (const x of [-230, 620, 1420, 2680, 3420, 5340, 5620]) decor.logs.push({ x: x + (R() - .5) * 40, w: 50 + R() * 40, seed: (R() * 997) | 0 });
  }

  /* ---------- trees ---------- */
  const SEASON_LEAF = { spring: ['#a8d868', '#7ab848', '#c8e880'], summer: ['#6aa84a', '#4f9a3a', '#8ac858'], autumn: ['#f0c030', '#e8a020', '#f8d850'], winter: null };
  const clumpCache = new Map();
  function clump(r, seed, cols) {
    const key = `${Math.round(r)}|${seed}|${cols.join()}`;
    let c = clumpCache.get(key); if (c) return c;
    c = document.createElement('canvas'); const s = Math.ceil(r * 2.6); c.width = c.height = s;
    const g = c.getContext('2d'), R = mulberry32(seed);
    g.translate(s / 2, s / 2);
    for (let k = 0; k < 60; k++) {
      const a = R() * TAU, d = Math.sqrt(R()) * r, x = Math.cos(a) * d, y = Math.sin(a) * d * .8;
      g.fillStyle = cols[(R() * cols.length) | 0]; g.globalAlpha = .9;
      g.beginPath(); g.arc(x, y, 3 + R() * 5, 0, TAU); g.fill();
    }
    clumpCache.set(key, c);
    if (clumpCache.size > 300) clumpCache.delete(clumpCache.keys().next().value);
    return c;
  }
  function drawTree(G, T, view, season, night) {
    if (T.x + 160 < view.l || T.x - 160 > view.r) return;
    const g = T.y, time = G.time, wind = G.world.weather.gust, sw = Math.sin(time * .7 + T.seed) * (.01 + wind * .03), snow = T.snow || 0;
    if (wolfArt() === Painted && Painted.drawTree(ctx, T, season, time, wind)) return;
    if (T.kind === 'pine' || T.kind === 'bigtree') {
      const h = T.h, big = T.kind === 'bigtree', w = big ? 90 : 36 + T.w * 2;
      ctx.fillStyle = big ? '#4a3220' : '#5a3a22'; ctx.fillRect(T.x - T.w * .5, g - h * .55, T.w, h * .55 + 6);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(T.x + T.w * .1, g - h * .55, T.w * .4, h * .55 + 6);
      const tiers = big ? 7 : 5;
      for (let k = 0; k < tiers; k++) {
        const u = k / tiers, y = g - h * (.15 + u * .85), tw = w * (1 - u * .8) * (1 + Math.sin(k * 2.1) * .06), th = h * .3;
        ctx.save(); ctx.translate(T.x + T.lean * (y - g), y); ctx.rotate(sw);
        const col = night > .5 ? '#1c3a28' : k % 2 ? '#2f6a3e' : '#3a7a48';
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -th * .5); ctx.lineTo(tw * .5, th * .5); ctx.lineTo(tw * .15, th * .42); ctx.lineTo(0, th * .55); ctx.lineTo(-tw * .15, th * .42); ctx.lineTo(-tw * .5, th * .5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,220,.1)'; ctx.beginPath(); ctx.moveTo(0, -th * .5); ctx.lineTo(-tw * .5, th * .5); ctx.lineTo(-tw * .15, th * .42); ctx.closePath(); ctx.fill();
        if (snow > 0) { ctx.fillStyle = `rgba(250,252,255,${.85 * snow})`; ctx.beginPath(); ctx.moveTo(0, -th * .5); ctx.lineTo(tw * .5, th * .5); ctx.lineTo(tw * .38, th * .5); ctx.lineTo(0, -th * .25); ctx.lineTo(-tw * .38, th * .5); ctx.lineTo(-tw * .5, th * .5); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      return;
    }
    if (T.kind === 'willow') {
      ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = T.w; ctx.lineCap = 'round';
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(T.x, g + 2); ctx.quadraticCurveTo(T.x + k * 8, g - T.h * .5, T.x + k * 14 + sw * 60, g - T.h); ctx.stroke(); }
      const cols = SEASON_LEAF[season] || null;
      if (cols) { const img = clump(T.h * .5, T.seed, ['#8ab060', '#6a9a48', '#a8c870']); ctx.drawImage(img, T.x - img.width / 2 + sw * 40, g - T.h - img.height / 2 + 10); }
      return;
    }
    /* aspen: a white trunk with black knots, a round crown of leaves that change with the season */
    const h = T.h;
    ctx.fillStyle = '#e8e4d8'; ctx.beginPath(); ctx.moveTo(T.x - T.w * .6, g + 4); ctx.lineTo(T.x + T.w * .6, g + 4); ctx.lineTo(T.x + T.w * .3 + T.lean * h, g - h); ctx.lineTo(T.x - T.w * .3 + T.lean * h, g - h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(60,60,60,.35)'; ctx.fillRect(T.x + T.w * .1, g - h * .9, T.w * .3, h * .9);
    const R = mulberry32(T.seed); ctx.fillStyle = '#2a2420';
    for (let k = 0; k < 6; k++) { const y = g - R() * h * .85; ctx.beginPath(); ctx.ellipse(T.x + (R() - .5) * T.w * .6 + T.lean * (y - g), y, 2.2, 1, .3, 0, TAU); ctx.fill(); }
    const cols = SEASON_LEAF[season];
    if (cols) {
      for (let k = 0; k < 3; k++) { const RR = mulberry32(T.seed + k), cx = T.x + T.lean * h + (RR() - .5) * 40, cy = g - h + 10 + (RR() - .5) * 50, r = 26 + RR() * 22; const img = clump(r, (T.seed + k) % 997, cols); ctx.drawImage(img, cx - img.width / 2 + Math.sin(time * .8 + k + T.seed) * (2 + wind * 5), cy - img.height / 2); }
    } else {
      /* bare winter branches */
      ctx.strokeStyle = '#c8c4b8'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * .42, y0 = g - h * (.55 + k * .06), L = 22 + (k % 3) * 8; ctx.beginPath(); ctx.moveTo(T.x + T.lean * (y0 - g), y0); ctx.lineTo(T.x + Math.cos(a) * L, y0 + Math.sin(a) * L); ctx.stroke(); }
    }
  }

  /* ---------- the frame ---------- */
  function skyColours(tod, season) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    let top = mixHex(a[1], b[1], t), bot = mixHex(a[2], b[2], t);
    if (season === 'winter') { top = mixHex(top, '#9ab8d8', .25); bot = mixHex(bot, '#e8f0f8', .3); }
    if (season === 'autumn') bot = mixHex(bot, '#ffd8a0', .15);
    return [top, bot];
  }
  function frame(G, dt, clean) {
    const { cam, world: Wd, tod, time } = G, S = Wd.ground, weather = Wd.weather, p = G.player, season = Wd.season;
    const night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    updateCells(S);
    /* the WebGL look (?gfx=gl): the world is drawn as usual into a transparent layer; GFX paints the sky,
       the mountains and the light, and only the overlays stay on this canvas */
    const gx = typeof GFX !== 'undefined' && GFX.active(), mainCtx = ctx;
    if (gx && typeof Painted !== 'undefined') Painted.beginFrame();
    if (gx) { ctx = GFX.worldCtx(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    const view = cam.viewRect(80);

    /* --- sky --- */
    let [top, bot] = skyColours(tod, season);
    if (weather.cloud > .01) { top = mixHex(top, '#3a4450', weather.cloud * .6); bot = mixHex(bot, '#8a949a', weather.cloud * .55); }
    const horizon = clamp(H * .52 - (cam.y + 60) * cam.zoom * .08, H * .25, H * .85);
    if (!gx) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, top); sky.addColorStop(1, bot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (night > .05 && weather.cloud < .85) {
      for (const [sx, sy, r, ph] of stars) {
        const y = sy * horizon; if (y > horizon - 10) continue;
        ctx.globalAlpha = night * (0.3 + .7 * (.5 + .5 * Math.sin(time * 2 + ph * 6))) * (1 - weather.cloud);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * W, y, .5 + r * 1.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawSunMoon(G, tod, night, horizon, weather.cloud);
    /* the far mountains and hills (parallax), tinted by the time of day and the season */
    layers.forEach((L, li) => {
      const z = Math.min(1, cam.zoom) * (.5 + li * .14);
      const w = L.img.width * z, h = L.img.height * z;
      const y = horizon - h * .62 + li * 30 * z + Math.max(0, (cam.y + 300)) * cam.zoom * .06 * (li + 1) * .2;
      let x0 = (-(cam.x * cam.zoom * L.par) % w) - w; while (x0 > -w) x0 -= w;
      ctx.save();
      ctx.filter = quality === 'low' ? 'none' : `brightness(${lerp(1, .32 + li * .04, night)}) saturate(${season === 'winter' ? .6 : 1})`;
      for (let x = x0; x < W; x += w) ctx.drawImage(L.img, x, y, w, h);
      ctx.restore();
      /* haze between the bands */
      ctx.fillStyle = `rgba(${season === 'winter' ? '230,238,248' : '200,220,240'},${.14 * (1 - night * .6)})`; ctx.fillRect(0, y + h * .5, W, H);
    });
    ctx.filter = 'none';
    /* a base colour under everything on screen below the hills */
    ctx.fillStyle = night > .5 ? '#0c1410' : season === 'winter' ? '#c8d4e0' : '#3a5a3a'; ctx.fillRect(0, horizon + 80, W, H);
    }

    /* ---------------- world space ---------------- */
    ctx.save();
    cam.apply(ctx);
    for (const T of Wd.trees) drawTree(G, T, view, season, night);
    drawRiverBack(G, Wd, S, view, night, time);
    drawRoadBack(G, Wd, S, view, night);
    ctx.restore();

    drawCellLayer(G, S, view);

    ctx.save();
    cam.apply(ctx);
    drawRim(G, S, view);
    drawRiverFront(G, Wd, S, view, night, time);
    drawSurfaceDecor(G, Wd, S, view, night, season);
    for (const t of Wd.tracks) { if (t.x < view.l || t.x > view.r) continue; const y = S.walkTop(t.x, 4) + .5; ctx.save(); ctx.translate(t.x, y); ctx.scale(1.1, .55); Sprites.drawTracks(ctx, t.kind, t.dir, t.seen ? 'rgba(40,28,16,.3)' : S.snowOn ? 'rgba(120,150,190,.6)' : 'rgba(40,28,16,.55)'); ctx.restore(); }
    for (const q of Wd.posts) { if (q.x < view.l - 40 || q.x > view.r + 40) continue; ctx.save(); ctx.translate(q.x, S.walkTop(q.x, 6) + 1); wolfArt().drawPost(ctx, q, time); ctx.restore(); }
    if (Wd.meal && !Wd.meal.taken) { const m = Wd.meal; ctx.save(); ctx.translate(m.x, m.y); Sprites.drawMeal(ctx, 1.1); ctx.restore(); }
    drawHerd(G, Wd, view);
    for (const b of Wd.ravens) if (b.state === 'ground' && b.x > view.l - 40 && b.x < view.r + 40) { ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.dir, 1); wolfArt().drawRaven(ctx, { s: .9, ph: b.ph, hop: b.hop }); ctx.restore(); }
    for (const h of Wd.hoppers) if (h.x > view.l && h.x < view.r) Sprites.drawHopper(ctx, h, time);
    if (Wd.biologist) { const b = Wd.biologist; ctx.save(); ctx.translate(b.x, b.y + 1); wolfArt().drawBiologist(ctx, { s: 1.1, wave: b.wave }); ctx.restore(); }
    drawTunnelMid(G, Wd, S, view);
    for (const n of Wd.pack) drawNPC(G, n, view);
    drawScents(G, Wd, view, time);
    drawPlayer(G, p, time);
    /* pups in front, so a mother never hides her litter */
    for (const q of Wd.pups) drawNPC(G, q, view);
    G.particles.draw(ctx, cam);
    drawWaterOver(G, Wd, S, view, night, time);
    drawRoadFront(G, Wd, S, view, night);
    for (const b of Wd.ravens) if (b.state !== 'ground') { ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.dir, 1); wolfArt().drawRaven(ctx, { s: .9, ph: b.ph * 8, fly: true }); ctx.restore(); }
    drawWeather(G, Wd, view, weather, time);
    ctx.restore();

    /* ---------------- light ---------------- */
    const dark = Math.max(night * .78, weather.cloud * .3) * (p.underground ? .5 : 1);
    const warm = (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - weather.cloud);
    if (gx) {
      if (p.underground) drawDenDark(G, p, night);
      GFX.render(G, { night, dark, warm, horizon, top, bot, sun: sunPos(tod, horizon, weather.cloud), moon: moonPos(tod, horizon, night, weather.cloud), bolt: weather.bolt, underground: p.underground });
      ctx = mainCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (!clean) drawOverlays(G, night, time);
      Cinematic.draw(ctx, W, H);
      return;
    }
    if (dark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${lerp(255, 70, dark) | 0},${lerp(255, 92, dark) | 0},${lerp(255, 150, dark) | 0})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (weather.bolt > .01) { ctx.fillStyle = `rgba(240,245,255,${weather.bolt * .7})`; ctx.fillRect(0, 0, W, H); }
    if (warm > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,70,${warm * .55})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (p.underground) drawDenDark(G, p, night);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(4,10,8,${.3 + night * .18})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (!clean) drawOverlays(G, night, time);
    Cinematic.draw(ctx, W, H);
  }

  function drawCellLayer(G, S, view) {
    const cam = G.cam, b = bufCtx;
    const sx0 = clamp(Math.floor((view.l - S.X0) / S.C) - 1, 0, S.cols), sy0 = clamp(Math.floor((view.t - S.Y0) / S.C) - 1, 0, S.rows);
    const sx1 = clamp(Math.ceil((view.r - S.X0) / S.C) + 1, 0, S.cols), sy1 = clamp(Math.ceil((view.b - S.Y0) / S.C) + 1, 0, S.rows);
    if (sx1 <= sx0 || sy1 <= sy0) return;
    const src = [sx0 * HI, sy0 * HI, (sx1 - sx0) * HI, (sy1 - sy0) * HI], dst = [S.X0 + sx0 * S.C, S.Y0 + sy0 * S.C, (sx1 - sx0) * S.C, (sy1 - sy0) * S.C];
    ctx.save(); cam.apply(ctx);
    ctx.drawImage(back, ...src, ...dst);
    /* below the grid: solid rock; beyond its ends: the valley's shape as plain earth */
    if (view.b > WORLD.gridB) { ctx.fillStyle = '#3a3028'; ctx.fillRect(view.l, WORLD.gridB - 1, view.r - view.l, view.b - WORLD.gridB + 1); }
    for (const [x0, x1] of [[view.l, WORLD.gridL], [WORLD.gridR, view.r]]) if (x1 > x0) { ctx.fillStyle = '#5a4a38'; ctx.beginPath(); ctx.moveTo(x0, view.b + 10); for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, S.surfaceAt(x)); ctx.lineTo(x1, view.b + 10); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, buf.width, buf.height);
    b.setTransform(DPR, 0, 0, DPR, 0, 0);
    b.save(); cam.apply(b);
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    b.drawImage(hi, ...src, ...dst);
    b.globalCompositeOperation = 'source-atop';
    b.globalAlpha = quality === 'low' ? .5 : .8; b.fillStyle = grainPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    b.globalAlpha = 1;
    const ep = wolfArt() === Painted && Painted.earthPattern(b);
    if (ep) { b.fillStyle = ep; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t); }
    b.restore(); b.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (quality !== 'low') { ctx.shadowColor = 'rgba(6,3,0,.7)'; ctx.shadowBlur = 8 * DPR * Math.min(2, cam.zoom); ctx.shadowOffsetX = 1.5 * DPR * cam.zoom; ctx.shadowOffsetY = 2.5 * DPR * cam.zoom; }
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  }

  function drawDenDark(G, p, night) {
    const [sx, sy] = G.cam.toScreen(p.x, p.y), rad = Math.max(W, H) * .5 * (p.age <= 1 && !p.flags.eyesOpen ? .5 : 1);
    const lg = ctx.createRadialGradient(sx, sy, rad * .14, sx, sy, rad);
    lg.addColorStop(0, 'rgba(10,5,2,0)'); lg.addColorStop(1, `rgba(10,5,2,${.5 + night * .2})`);
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    if (p.age <= 1 && !p.flags.eyesOpen) { ctx.fillStyle = 'rgba(20,10,30,.35)'; ctx.fillRect(0, 0, W, H); }
  }
  /* where the sun and the moon are on screen (CSS px); vis 0 when below the horizon or not up */
  function sunPos(tod, horizon, cloud) {
    if (!(tod > .22 && tod < .82)) return { x: W / 2, y: H * 2, vis: 0 };
    const t = invLerp(.22, .82, tod);
    return { x: W * (.1 + .8 * t), y: horizon - Math.sin(Math.PI * t) * Math.max(120, horizon * .85) + 10, vis: 1 - cloud * .7, t };
  }
  function moonPos(tod, horizon, night, cloud) {
    if (!(night > .05)) return { x: W / 2, y: H * 2, vis: 0 };
    const t = tod > .5 ? invLerp(.78, 1.28, tod) : invLerp(-.22, .28, tod);
    return { x: W * (.15 + .7 * t), y: horizon - Math.sin(Math.PI * clamp(t, 0, 1)) * Math.max(120, horizon * .85) * .9 - 10, vis: night * (1 - cloud * .8) };
  }
  function drawSunMoon(G, tod, night, horizon, cloud) {
    if (tod > .22 && tod < .82) {
      const { x, y } = sunPos(tod, horizon, cloud);
      ctx.globalAlpha = 1 - cloud * .7;
      const g = ctx.createRadialGradient(x, y, 8, x, y, 220); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(.12, 'rgba(255,230,160,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, y - 220, 440, 440);
      ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(x, y, 28, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const { x, y } = moonPos(tod, horizon, night, cloud);
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
  RIM[MAT.SOIL] = ['rgba(40,24,12,.5)', 'rgba(150,120,70,.9)']; RIM[MAT.ROCK] = ['rgba(60,54,48,.5)', 'rgba(220,214,202,.85)'];
  RIM[MAT.ROOT] = RIM[MAT.SOIL]; RIM[MAT.GRAVEL] = ['rgba(60,60,56,.5)', 'rgba(200,196,186,.85)'];
  RIM[MAT.SNOW] = ['rgba(150,180,220,.45)', 'rgba(255,255,255,.95)']; RIM[MAT.ICE] = ['rgba(100,150,200,.5)', 'rgba(230,245,255,.95)'];
  function drawRim(G, S, view) {
    const x0 = Math.max(view.l, WORLD.gridL), x1 = Math.min(view.r, WORLD.gridR), step = Math.max(1.5, 6 / G.cam.zoom);
    if (x1 <= x0) return;
    const lw = 2.2 / G.cam.zoom;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      let cur = null;
      for (let x = x0; x <= x1; x += step) {
        const t0 = S.topAt(x);
        if (t0 > S.surfaceAt(x) + 8) { if (cur) { ctx.stroke(); cur = null; } continue; }   /* an open den mouth */
        const y = (S.topAt(x - 8) + S.topAt(x - 4) + t0 * 2 + S.topAt(x + 4) + S.topAt(x + 8)) / 6, m = S.matAt(x, t0 + 2), col = (RIM[m] || RIM[MAT.ROCK])[pass], yy = y + (pass ? 0 : lw * 1.6);
        if (col !== cur) { if (cur) { ctx.lineTo(x, yy); ctx.stroke(); } cur = col; ctx.strokeStyle = col; ctx.lineWidth = pass ? lw : lw * 2.6; ctx.beginPath(); ctx.moveTo(x, yy); }
        else ctx.lineTo(x, yy);
      }
      if (cur) ctx.stroke();
    }
  }
  /* the river: the water body behind the cells (so the bed shows through), ripples in front */
  function drawRiverBack(G, Wd, S, view, night, time) {
    if (view.r < WORLD.riverL || view.l > WORLD.riverR || S.snowOn) return;
    const y0 = WORLD.riverY, painted = wolfArt() === Painted;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 50);
    if (painted) { g.addColorStop(0, 'rgba(118,170,184,.8)'); g.addColorStop(.12, 'rgba(58,118,138,.82)'); g.addColorStop(.5, 'rgba(30,78,96,.9)'); g.addColorStop(1, 'rgba(12,36,48,.95)'); }
    else { g.addColorStop(0, `rgba(70,140,190,${.75})`); g.addColorStop(1, 'rgba(20,60,110,.9)'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(WORLD.riverL, y0);
    for (let x = WORLD.riverL; x <= WORLD.riverR; x += 6) ctx.lineTo(x, y0 + Math.sin(x * .09 + time * 2.4) * 1.2);
    ctx.lineTo(WORLD.riverR, 60); ctx.lineTo(WORLD.riverL, 60); ctx.closePath(); ctx.fill();
    if (painted) {
      /* light through the water: soft drifting bands that wobble with the current */
      ctx.save(); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) {
        const y = y0 + 4 + k * 4.5, a = (.07 - k * .006) * (1 - night * .7);
        ctx.strokeStyle = `rgba(150,210,220,${a})`; ctx.lineWidth = 1.6 - k * .1; ctx.beginPath();
        for (let x = WORLD.riverL; x <= WORLD.riverR; x += 5) { const yy = y + Math.sin(x * .05 + time * (1.2 + k * .2) + k) * 1.4 + Math.sin(x * .13 - time * 2) * .6; x === WORLD.riverL ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawRiverFront(G, Wd, S, view, night, time) {
    if (view.r < WORLD.riverL || view.l > WORLD.riverR || S.snowOn) return;
    const y0 = WORLD.riverY;
    ctx.strokeStyle = `rgba(230,250,255,${.6 - night * .3})`; ctx.lineWidth = 1.2 / Math.max(.6, G.cam.zoom) * 2;
    ctx.beginPath(); for (let x = WORLD.riverL + 4; x <= WORLD.riverR - 4; x += 4) { const y = y0 + Math.sin(x * .09 + time * 2.4) * 1.2; x === WORLD.riverL + 4 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    if (wolfArt() === Painted) {
      /* glints riding the current: tapered, brightest at the surface, fading with depth */
      for (let k = 0; k < 22; k++) {
        const span = WORLD.riverR - WORLD.riverL - 20, x = WORLD.riverL + 10 + ((k * 53 + time * (22 + (k % 5) * 6)) % span), d = (k % 5) / 5, y = y0 + 1.5 + d * 14 + Math.sin(time * 2 + k) * .6;
        const len = 5 + (k % 3) * 4, a = (.45 - d * .35) * (1 - night * .6) * (.6 + .4 * Math.sin(time * 3 + k * 1.7));
        ctx.fillStyle = `rgba(240,250,255,${Math.max(0, a)})`; ctx.beginPath(); ctx.ellipse(x, y, len, .55 - d * .25, 0, 0, TAU); ctx.fill();
      }
    } else {
      ctx.fillStyle = `rgba(255,255,255,${.35 - night * .2})`;
      for (let k = 0; k < 14; k++) { const x = WORLD.riverL + 10 + ((k * 37 + time * 30) % (WORLD.riverR - WORLD.riverL - 20)), y = y0 + 3 + (k % 4) * 5; ctx.fillRect(x, y, 8 + (k % 3) * 4, 1); }
    }
  }
  /* the water's tint over anything standing in the river */
  function drawWaterOver(G, Wd, S, view, night, time) {
    if (view.r < WORLD.riverL || view.l > WORLD.riverR || S.snowOn) return;
    const y0 = WORLD.riverY;
    ctx.fillStyle = wolfArt() === Painted ? `rgba(36,96,116,${.42 + night * .1})` : `rgba(40,110,170,${.4 + night * .1})`;
    ctx.beginPath(); ctx.moveTo(WORLD.riverL, y0);
    for (let x = WORLD.riverL; x <= WORLD.riverR; x += 6) ctx.lineTo(x, y0 + Math.sin(x * .09 + time * 2.4) * 1.2);
    for (let x = WORLD.riverR; x >= WORLD.riverL; x -= 6) ctx.lineTo(x, S.topAt(x) + 2);
    ctx.closePath(); ctx.fill();
  }
  /* the road on its embankment: the back wall, the tunnel's dark inside, then (in front) the arch */
  function drawRoadBack(G, Wd, S, view, night) {
    if (view.r < WORLD.tunnelL - 200 || view.l > WORLD.tunnelR + 200) return;
    const W2 = WORLD, g = S.surfaceAt(W2.roadL + 50), top = g - W2.roadH;
    const eg = ctx.createLinearGradient(0, top, 0, g); eg.addColorStop(0, '#9a8a6a'); eg.addColorStop(1, '#6a5a44');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.moveTo(W2.tunnelL - 120, g + 6); ctx.lineTo(W2.tunnelL - 10, top); ctx.lineTo(W2.tunnelR + 10, top); ctx.lineTo(W2.tunnelR + 120, g + 6); ctx.closePath(); ctx.fill();
    if (S.snowOn) { ctx.fillStyle = 'rgba(245,250,255,.85)'; ctx.beginPath(); ctx.moveTo(W2.tunnelL - 120, g + 6); ctx.lineTo(W2.tunnelL - 10, top); ctx.lineTo(W2.tunnelL - 2, top + 6); ctx.lineTo(W2.tunnelL - 110, g + 6); ctx.fill(); ctx.beginPath(); ctx.moveTo(W2.tunnelR + 120, g + 6); ctx.lineTo(W2.tunnelR + 10, top); ctx.lineTo(W2.tunnelR + 2, top + 6); ctx.lineTo(W2.tunnelR + 110, g + 6); ctx.fill(); }
    /* the tunnel: a box through the embankment, dark inside */
    const tl = W2.tunnelL + 10, tr = W2.tunnelR - 10, th = 46;
    const tg = ctx.createLinearGradient(tl, 0, tr, 0); tg.addColorStop(0, '#2a2420'); tg.addColorStop(.5, '#0c0a08'); tg.addColorStop(1, '#2a2420');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(tl - 8, g + 4); ctx.lineTo(tl - 8, g - th + 12); ctx.quadraticCurveTo(tl - 8, g - th, tl + 4, g - th); ctx.lineTo(tr - 4, g - th); ctx.quadraticCurveTo(tr + 8, g - th, tr + 8, g - th + 12); ctx.lineTo(tr + 8, g + 4); ctx.closePath(); ctx.fill();
    /* the tarmac on top, with its lines, and the fence that keeps animals off the road */
    ctx.fillStyle = '#4a4a4e'; ctx.fillRect(W2.tunnelL - 10, top - 6, W2.tunnelR - W2.tunnelL + 20, 8);
    ctx.strokeStyle = '#f0e8c0'; ctx.setLineDash([10, 8]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(W2.tunnelL - 10, top - 2); ctx.lineTo(W2.tunnelR + 10, top - 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#8a8a86'; ctx.lineWidth = .8;
    for (const fx of [W2.tunnelL - 40, W2.tunnelR + 40]) { for (let k = 0; k < 4; k++) { const x = fx + (fx < W2.roadL ? -k * 20 : k * 20), gy = S.surfaceAt(x) + (fx < W2.roadL ? lerp(0, -W2.roadH, 1 - k / 4) * 0 : 0); const y = lerp(top, S.surfaceAt(x) + 6, k / 4); ctx.fillStyle = '#6a6a62'; ctx.fillRect(x - 1, y - 24, 2, 24); } }
    for (const side of [-1, 1]) { const xa = side < 0 ? W2.tunnelL - 100 : W2.tunnelR + 10, xb = side < 0 ? W2.tunnelL - 10 : W2.tunnelR + 100; ctx.strokeStyle = 'rgba(200,200,196,.8)'; ctx.lineWidth = .8; for (const dy of [-22, -14, -6]) { ctx.beginPath(); ctx.moveTo(xa, (side < 0 ? lerp(S.surfaceAt(xa) + 6, top, 1) : top) + dy); ctx.lineTo(xb, (side < 0 ? top : S.surfaceAt(xb) + 6) + dy); ctx.stroke(); } }
    /* a sign: a wolf crossing */
    const sx = W2.tunnelR + 60, sy = S.surfaceAt(sx);
    ctx.fillStyle = '#6a6a6a'; ctx.fillRect(sx - 1.5, sy - 60, 3, 60);
    ctx.save(); ctx.translate(sx, sy - 72); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 2; ctx.fillRect(-14, -14, 28, 28); ctx.strokeRect(-14, -14, 28, 28); ctx.rotate(-Math.PI / 4); ctx.scale(.16, .16); ctx.translate(-10, 20); Sprites.drawWolf(ctx, { s: 1, form: 'black', age: 1, moving: true, walk: 1 }); ctx.restore();
  }
  function drawTunnelMid(G, Wd, S, view) { /* nothing between the tunnel and the wolf: the wolf is seen inside it */ }
  function drawRoadFront(G, Wd, S, view, night) {
    if (view.r < WORLD.tunnelL - 60 || view.l > WORLD.tunnelR + 60) return;
    const W2 = WORLD, g = S.surfaceAt(W2.roadL + 50), tl = W2.tunnelL + 10, tr = W2.tunnelR - 10, th = 46;
    /* the concrete arch of the tunnel's mouths, in front */
    ctx.strokeStyle = '#b8b4a8'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (const [a, b] of [[tl - 8, tl + 4], [tr - 4, tr + 8]]) { ctx.beginPath(); ctx.moveTo(a < tr - 20 ? tl - 10 : tr + 10, g + 2); ctx.lineTo(a < tr - 20 ? tl - 10 : tr + 10, g - th + 12); ctx.stroke(); }
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(tl, g - th + 10); ctx.quadraticCurveTo(tl, g - th - 2, tl + 12, g - th - 2); ctx.lineTo(tr - 12, g - th - 2); ctx.quadraticCurveTo(tr, g - th - 2, tr, g - th + 10); ctx.stroke();
  }
  function drawSurfaceDecor(G, Wd, S, view, night, season) {
    if (!decor) return;
    const time = G.time, wind = Wd.weather.gust, snowOn = S.snowOn;
    const painted = wolfArt() === Painted;
    const gcol = season === 'spring' ? ['#7fb34a', '#9ac85a'] : season === 'summer' ? ['#9ab85a', '#b8c060'] : season === 'autumn' ? ['#c8a84a', '#d8b860'] : ['#c8c0a0', '#d8d0b0'];
    for (const st of decor.stones) {
      if (st.x < view.l - 20 || st.x > view.r + 20 || S.topAt(st.x) > S.surfaceAt(st.x) + 8) continue;
      const y = S.walkTop(st.x, 3) + 1, R = mulberry32(st.seed), r = 4 + R() * 7 * st.s;
      if (painted && Painted.drawStone(ctx, st.x, y + r * .15, r, st.seed, st.wet, snowOn)) continue;
      const g = ctx.createLinearGradient(0, y - r, 0, y); g.addColorStop(0, st.wet ? '#a8a8a0' : '#b8b2a4'); g.addColorStop(1, st.wet ? '#58605a' : '#6a645a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(st.x, y, r, r * .6, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(st.x - r * .3, y - r * .4, r * .3, r * .12, -.2, 0, TAU); ctx.fill();
      if (snowOn) { ctx.fillStyle = 'rgba(250,252,255,.9)'; ctx.beginPath(); ctx.ellipse(st.x, y - r * .55, r * .8, r * .2, 0, Math.PI, TAU); ctx.fill(); }
    }
    for (const lg of decor.logs) {
      if (lg.x + lg.w < view.l || lg.x - lg.w > view.r) continue;
      const y = S.walkTop(lg.x, 6) + 1;
      if (painted && Painted.drawLog(ctx, lg.x, y + 1, lg.w, lg.seed, snowOn)) continue;
      const g = ctx.createLinearGradient(0, y - 16, 0, y); g.addColorStop(0, '#8a6a46'); g.addColorStop(1, '#3a2a1a');
      ctx.fillStyle = g; rr(ctx, lg.x - lg.w / 2, y - 14, lg.w, 14, 7); ctx.fill();
      ctx.fillStyle = '#c8a070'; ctx.beginPath(); ctx.ellipse(lg.x + lg.w / 2, y - 7, 4, 7, 0, 0, TAU); ctx.fill();
      if (snowOn) { ctx.fillStyle = 'rgba(250,252,255,.9)'; rr(ctx, lg.x - lg.w / 2 + 2, y - 18, lg.w - 4, 6, 3); ctx.fill(); }
    }
    if (!snowOn) {
      for (const sg of decor.sage) {
        if (sg.x < view.l - 20 || sg.x > view.r + 20) continue;
        const y = S.walkTop(sg.x, 4) + 1, R = mulberry32(sg.seed);
        if (painted && Painted.drawSage(ctx, sg.x, y + 1, sg.s, sg.seed)) continue;
        /* a sagebrush: a woody base and a rounded silver-green mound of little leaves */
        const bw = 13 * sg.s, bh = 10 * sg.s;
        ctx.strokeStyle = '#6a5a42'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(sg.x + k * 2, y); ctx.lineTo(sg.x + k * bw * .45, y - bh * .7); ctx.stroke(); }
        const sgc = ['#8fa58f', '#a3b8a0', '#7d947e', '#b4c6ae'];
        for (let k = 0; k < 16; k++) { const a = R() * Math.PI, r = Math.sqrt(R()); ctx.fillStyle = sgc[k % 4]; ctx.beginPath(); ctx.ellipse(sg.x + Math.cos(a) * bw * r, y - bh * .55 - Math.sin(a) * bh * r * .8, 3.2 * sg.s, 2.4 * sg.s, 0, 0, TAU); ctx.fill(); }
      }
      for (const g2 of decor.grass) {
        if (g2.x < view.l || g2.x > view.r) continue;
        if (S.topAt(g2.x) > S.surfaceAt(g2.x) + 8) continue;
        const y = S.walkTop(g2.x, 3) + 1;
        if (painted && Painted.drawGrass(ctx, g2.x, y + .5, g2.s, season, Math.sin(time * 1.3 + g2.ph) * (1 + wind), (g2.ph * 10) | 0)) continue;
        ctx.strokeStyle = gcol[g2.k < .5 ? 0 : 1]; ctx.lineWidth = 1;
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(g2.x + k * 1.5, y); ctx.quadraticCurveTo(g2.x + k * 2.5 + Math.sin(time * 1.4 + g2.ph) * 2, y - 6 * g2.s, g2.x + k * 3.5 + Math.sin(time * 1.2 + g2.ph) * 3 * (1 + wind), y - 11 * g2.s); ctx.stroke(); }
      }
      if (season === 'summer' || season === 'spring') for (const f of decor.flowers) {
        if (f.x < view.l || f.x > view.r || S.topAt(f.x) > S.surfaceAt(f.x) + 8) continue;
        if (painted && Painted.drawFlower(ctx, f.x, S.walkTop(f.x, 3) + 1, f.s, f.col, Math.sin(time * 1.1 + f.ph) * (1 + wind), (f.ph * 7) | 0)) continue;
        const y = S.walkTop(f.x, 3) - 8 * f.s + Math.sin(time + f.ph) * .5; ctx.strokeStyle = '#5a8a3a'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(f.x, y + 8 * f.s); ctx.lineTo(f.x, y); ctx.stroke();
        ctx.fillStyle = f.col; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 1.8 * f.s, y + Math.sin(a) * 1.8 * f.s, 1.2 * f.s, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.arc(f.x, y, .9 * f.s, 0, TAU); ctx.fill();
      }
      if (season === 'autumn') for (const l of decor.litter) {
        if (l.x < view.l || l.x > view.r) continue;
        const y = S.topAt(l.x); if (y > S.surfaceAt(l.x) + 6) continue;
        ctx.save(); ctx.translate(l.x, y + .5); ctx.rotate(l.a * .3); ctx.fillStyle = l.col; ctx.beginPath(); ctx.ellipse(0, 0, 3 * l.s, 1.2 * l.s, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    } else {
      /* dead grass poking through the snow */
      for (const g2 of decor.grass) { if (g2.x < view.l || g2.x > view.r || g2.k > .25) continue; const y = S.walkTop(g2.x, 3); ctx.strokeStyle = '#b8a878'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g2.x, y + 1); ctx.lineTo(g2.x + 2, y - 5 * g2.s); ctx.stroke(); }
    }
  }
  function drawScents(G, Wd, view, time) {
    for (const s of Wd.scents) {
      if (s.x < view.l - 40 || s.x > view.r + 40) continue;
      const k = SCENT_KINDS[s.kind], a = s.sniffed ? clamp(1 - (s.t - s.sniffedAt) / 1.5, 0, 1) : clamp(s.t * .5, 0, 1) * clamp((s.life - s.t) / 4, 0, 1);
      ctx.strokeStyle = k.col; ctx.lineCap = 'round'; ctx.globalAlpha = a * .75;
      for (let j = 0; j < 3; j++) { ctx.lineWidth = 2.2 - j * .5; ctx.beginPath(); const x0 = s.x + (j - 1) * 6, ph = s.ph + j; ctx.moveTo(x0, s.y + 8); ctx.bezierCurveTo(x0 - 6 + Math.sin(time * 1.5 + ph) * 4, s.y, x0 + 6 + Math.sin(time * 1.2 + ph) * 4, s.y - 8, x0 + Math.sin(time + ph) * 5, s.y - 18 - j * 3); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
  function drawHerd(G, Wd, view) {
    for (const e of Wd.herd.concat(Wd.bison)) {
      if (e.x < view.l - 80 || e.x > view.r + 80) continue;
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.dir * e.s * .62, e.s * .62);
      if (e.kind === 'bison') { ctx.translate(0, -52); wolfArt().drawBison(ctx, { s: 1, ph: e.ph, vx: e.vx }); }
      else { ctx.translate(0, -60); wolfArt().drawElk(ctx, { s: 1, ph: e.ph, vx: e.vx, bull: e.bull }); }
      ctx.restore();
    }
  }
  function drawNPC(G, n, view) {
    if (n.gone || n.carried || n.x < view.l - 80 || n.x > view.r + 80) return;
    ctx.save(); ctx.translate(n.x, n.y);
    if (n.spin) ctx.rotate(n.spin);
    if (n.mode === 'enter') ctx.globalAlpha = clamp(1 - (n.sink || 0), 0, 1);
    ctx.scale(n.face, 1);
    const age = Sprites.ageOf(n.kg);
    wolfArt().drawWolf(ctx, { s: n.len / 100, form: n.form, age, sex: n.sex, walk: n.walk, moving: n.mode === 'walk' || n.mode === 'run' || n.mode === 'leave' || n.mode === 'play', run: n.mode === 'run', sit: n.mode === 'sit', lie: n.mode === 'lie', curl: n.mode === 'lie' && n.inDen === false && n.role !== 'mum', howl: n.mode === 'howl' ? 1 : 0, bow: n.playT > 0 ? 1 : n.mode === 'play' ? .5 + Math.sin(G.time * 9) * .2 : 0, pant: n.pant > 0 ? 1 : 0, wag: n.wag > 0 || n.playT > 0 ? 1 : 0, eyes: n.inDen && n.role === 'sib' ? 0 : n.mode === 'lie' && n.inDen ? .4 : 1, collar: n.collar, carry: n.meal ? 'meal' : null, snow: G.world.ground.snowOn && n.mode !== 'lie' ? .3 : 0, seed: (n.kg * 13) | 0, t: G.time });
    ctx.restore();
  }
  function drawPlayer(G, p, time) {
    ctx.save();
    const glowR = p.w * .9 + 6;
    const gg = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, glowR);
    gg.addColorStop(0, `rgba(255,240,190,${.16 + G.night * .16})`); gg.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = gg; ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
    ctx.translate(p.x, p.y);
    if (p.mode === 'tossed') ctx.rotate(p.spin);
    else if (p.mode === 'walk') ctx.rotate(p.ang * p.face);
    else if (p.mode === 'burrow') { const tilt = clamp(Math.atan2(Math.sin(p.ang), Math.abs(Math.cos(p.ang))), -.9, .9) * (p.moving ? 1 : .5); ctx.rotate(p.face * tilt); }
    ctx.scale(p.face, 1);
    if (p.mode === 'sleep') ctx.globalAlpha = .9;
    const rest = p.mode === 'rest' || p.mode === 'sleep';
    wolfArt().drawWolf(ctx, { s: p.w / 100, form: p.form, age: p.age01, sex: p.sex, walk: p.walk, moving: p.moving, run: p.run, lie: rest || (p.mode === 'den' && !p.moving), curl: rest, howl: p.howlT, bow: p.bowT > 0 ? 1 : 0, pounce: p.busyKind === 'pounce' && p.busy > 0 ? 1 : 0, pant: p.pant, wag: p.busyKind === 'play' || p.busyKind === 'meet' ? 1 : 0, eyes: p.age <= 1 && !p.flags.eyesOpen ? 0 : rest ? 0 : 1, snow: p.snowy, wet: p.wet, swim: p.swimming, sniff: p.busyKind === 'sniff' || p.busyKind === 'look' ? 1 : 0, carry: p.carrying, carryForm: p.carryForm, seed: 11, t: time, earsBack: p.busyKind === 'drink' ? .5 : 0 });
    ctx.restore();
  }
  function drawWeather(G, Wd, view, weather, time) {
    if (weather.rain > .03) {
      const n = Math.floor(weather.rain * (quality === 'low' ? 140 : 300));
      ctx.strokeStyle = `rgba(190,215,240,${.4 * weather.rain})`; ctx.lineWidth = 1.2 / G.cam.zoom * 1.4;
      ctx.beginPath();
      const len = 16 / G.cam.zoom * 1.5;
      for (let k = 0; k < n; k++) {
        const seed = k * 97.13, x = view.l + ((seed * 13.7 + time * 40) % (view.r - view.l)), yy = view.t + ((seed * 7.3 + time * 900 / G.cam.zoom) % (view.b - view.t));
        if (yy > Wd.ground.topAt(x)) continue;
        ctx.moveTo(x, yy); ctx.lineTo(x - len * .2, yy + len);
      }
      ctx.stroke();
    }
    if (weather.snow > .03) {
      ctx.fillStyle = `rgba(255,255,255,${.85 * weather.snow})`;
      const n = quality === 'low' ? 80 : 160;
      for (let k = 0; k < n; k++) {
        const f = flakes[k], x = view.l + ((f.x * 1.3 + Math.sin(time * .6 + f.ph) * .02 + time * .01 * f.z) % 1 + 1) % 1 * (view.r - view.l), yy = view.t + ((f.y + time * .05 * f.z) % 1 + 1) % 1 * (view.b - view.t);
        if (yy > Wd.ground.topAt(x)) continue;
        ctx.beginPath(); ctx.arc(x, yy, (1 + f.z * 1.6) / Math.max(.8, G.cam.zoom * .6), 0, TAU); ctx.fill();
      }
    }
    if (weather.bolt > .5) {
      const x = view.l + ((time * 13.7) % 1) * (view.r - view.l);
      ctx.strokeStyle = 'rgba(255,255,230,.95)'; ctx.lineWidth = 2 / G.cam.zoom * 2; ctx.beginPath(); let y = view.t - 50, xx = x; ctx.moveTo(xx, y); for (let k = 0; k < 8; k++) { xx += (Math.sin(k * 7.1 + time) * 30); y += (view.b - view.t) / 9; ctx.lineTo(xx, y); } ctx.stroke();
    }
  }

  /* ---------- overlays: play-fights, howls, the chase, arrows, labels ---------- */
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
  function bigText(txt, x, y, ok) {
    ctx.font = `900 ${Math.round(Math.min(26, W * .03))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = ok ? '#7dff7a' : '#fff3c0';
    ctx.strokeText(txt, x, y); ctx.fillText(txt, x, y);
  }
  function drawOverlays(G, night, time) {
    const p = G.player, cam = G.cam, Wd = G.world;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (p.mode === 'play' && p.wr) {
      const w = p.wr, [sx, sy] = cam.toScreen(w.mid, p.y - p.h);
      const ok = p.shoveWindow();
      ringMeter(G, sx, sy, (w.ring % 1.8) / 1.8, ok, w.flash);
      const bw = Math.min(520, W * .6), bx = W / 2 - bw / 2, by = H - 190;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, bx - 8, by - 8, bw + 16, 40, 20); ctx.fill();
      const half = bw / 2, mk = W / 2 + w.p * half * (p.face > 0 ? 1 : -1);
      const lg = ctx.createLinearGradient(bx, 0, bx + bw, 0); lg.addColorStop(0, p.face > 0 ? '#ff7a5a' : '#7ad35a'); lg.addColorStop(.5, '#ffe27a'); lg.addColorStop(1, p.face > 0 ? '#7ad35a' : '#ff7a5a');
      ctx.fillStyle = lg; rr(ctx, bx, by, bw, 24, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mk, by + 12, 16, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(mk - 2, by + 14); ctx.scale(.2, .2); Sprites.drawWolf(ctx, { s: 1, form: p.form, age: p.age01 }); ctx.restore();
      bigText(w.done === 'win' ? 'YOU WIN!' : w.done === 'lose' ? 'WHOOPS!' : ok ? 'BIG POUNCE!  (E / ▲)' : 'PUSH!  (Space)', W / 2, by + 56, ok);
    }
    if (p.mode === 'howl' && p.hw) {
      const h = p.hw, [sx, sy] = cam.toScreen(p.x, p.y - p.h * 1.4), ok = p.howlWindow();
      ringMeter(G, sx, sy, h.held ? (h.ring % HOWL_RING) / HOWL_RING : 0, ok && h.held, h.flash);
      const need = G.diff().howls, by = H - 160;
      for (let k = 0; k < need; k++) { ctx.fillStyle = k < h.good ? '#ffd23f' : 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(W / 2 - (need - 1) * 14 + k * 28, by - 22, 9, 0, TAU); ctx.fill(); }
      bigText(h.held ? (ok ? 'LET GO NOW!' : 'Hold… hold…') : 'HOLD E TO HOWL', W / 2, by + 20, ok && h.held);
      /* the chorus's answer: little howl arcs from the edge of the screen */
      if (h.flash > 0) { ctx.strokeStyle = `rgba(255,240,180,${h.flash})`; ctx.lineWidth = 3; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(W - 60, H * .4, k * 18 + (1 - h.flash) * 30, Math.PI * .6, Math.PI * 1.4); ctx.stroke(); } }
    }
    if (p.mode === 'chase') {
      const bw = Math.min(420, W * .5), bx = W / 2 - bw / 2, by = H - 180;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, bx - 8, by - 8, bw + 16, 40, 20); ctx.fill();
      ctx.fillStyle = '#5a3a2a'; rr(ctx, bx, by, bw, 24, 12); ctx.fill();
      ctx.fillStyle = p.stamina > .3 ? '#ff9a4a' : '#ff5a5a'; rr(ctx, bx, by, bw * p.stamina, 24, 12); ctx.fill();
      ctx.font = `900 12px ${UI_FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PUFF', W / 2, by + 12);
      bigText(p.stamina > .2 ? 'RUN!  (hold ▶)' : 'Puffed! Let go to catch your breath', W / 2, by + 56, p.stamina > .2);
    }
    /* arrows to where you are going */
    if (p.mode === 'den' && Wd.mum() && Math.hypot(Wd.mum().x - p.x, Wd.mum().y - p.y) > 30) pointTo(G, Wd.mum().x, Wd.mum().y, '#ffd0e0', time);
    if (p.mode === 'walk') {
      const S = Wd.ground;
      if (p.flags.lone && !p.flags.met && Wd.mate()) pointTo(G, Wd.mate().x, Wd.mate().y, '#ff9ad0', time);
      else if (p.carrying === 'meal' && Wd.newDen) pointTo(G, Wd.newDen.x, Wd.newDen.y, '#ffe9a0', time);
      else if (Wd.meal && !Wd.meal.taken && p.flags.denMade) pointTo(G, Wd.meal.x, Wd.meal.y, '#ffe9a0', time);
      else if ((Wd.phase === 'travel' || Wd.phase === 'winter') && Wd.packHead() !== null && Wd.packHead() - p.x > 200 && !p.flags.lostPack) pointTo(G, Wd.packHead(), S.walkTop(Wd.packHead(), 6) - 20, '#b7f07a', time);
      else if (p.warmth < .3 && Wd.season === 'winter' && !p.flags.lone) { const T = Wd.nearestTree(p.x); if (T) pointTo(G, T.x, T.y - 20, '#a8e0ff', time); }
      else if (p.flags.met && !p.flags.marksDone) { const q = Wd.posts.filter(q => !q.home && !q.marked).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; if (q && Math.abs(q.x - p.x) > 40) pointTo(G, q.x, q.y - 10, '#ffe9a0', time); }
      else if (p.flags.claimed && !p.flags.denMade && p.age >= 5 && (p.x < WORLD.newDenL || p.x > WORLD.newDenR)) pointTo(G, (WORLD.newDenL + WORLD.newDenR) / 2, S.surfaceAt((WORLD.newDenL + WORLD.newDenR) / 2) - 10, '#ffe9a0', time);
      else if (p.flags.lone && !p.flags.newValley) pointTo(G, WORLD.tunnelL + 40, S.surfaceAt(WORLD.tunnelL + 40) - 10, '#7fe0ff', time);
      else if (p.age === 2 && Wd.pack.some(n => n.meal)) { const n = Wd.pack.find(n => n.meal); pointTo(G, n.x, n.y, '#ffe9a0', time); }
      else if (p.sex === 'girl' && p.flags.pupsBorn && Wd.pups.some(q => q.wandered && !q.inDen)) { const q = Wd.pups.find(q => q.wandered); pointTo(G, q.x, q.y, '#ffd0e0', time); }
    }
    if (G.settings.labels) drawLabels(G);
  }
  function drawLabels(G) {
    const cam = G.cam, Wd = G.world, S = Wd.ground, p = G.player;
    ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, t) => { const [sx, sy] = cam.toScreen(x, y); if (sx < 0 || sx > W || sy < 100 || sy > H) return; const w = ctx.measureText(t).width + 14; ctx.fillStyle = 'rgba(255,252,240,.85)'; rr(ctx, sx - w / 2, sy - 11, w, 22, 11); ctx.fill(); ctx.fillStyle = '#2a2016'; ctx.fillText(t, sx, sy); };
    const seen = new Set();
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, d = 50 + (k % 3) * 40, x = p.x + Math.cos(a) * d, y = p.y + Math.abs(Math.sin(a)) * d * .8 + 20, m = S.matAt(x, y); if (m === MAT.AIR || seen.has(m)) continue; seen.add(m); tag(x, y, MAT_INFO[m].name); }
    tag(p.x, p.y - p.h - 12, STAGES[STAGE_INDEX[p.stageKey()]].name);
    for (const n of Wd.pack) if (!n.inDen && Math.abs(n.x - p.x) < 500) tag(n.x, n.y - n.h - 8, { mum: 'mum', dad: 'dad', yearling: n.collar ? 'yearling (collared)' : 'yearling', sitter: 'babysitter', sib: n.sex === 'girl' ? 'sister' : 'brother', mate: 'your mate', newpup: 'new pup' }[n.role] || 'wolf');
    for (const q of Wd.pups) if (!q.inDen && Math.abs(q.x - p.x) < 400) tag(q.x, q.y - q.h - 8, 'pup');
    for (const e of Wd.herd.concat(Wd.bison)) if (Math.abs(e.x - p.x) < 500) tag(e.x, e.y - 50, e.kind);
    for (const b of Wd.ravens) if (Math.abs(b.x - p.x) < 300) tag(b.x, b.y - 24, 'raven');
    for (const h of Wd.hoppers) if (Math.abs(h.x - p.x) < 120) tag(h.x, h.y - 12, h.kind);
    for (const s of Wd.scents) if (Math.abs(s.x - p.x) < 300 && !s.sniffed) tag(s.x, s.y - 24, SCENT_KINDS[s.kind].name + ' scent');
    for (const t of Wd.tracks) if (Math.abs(t.x - p.x) < 300) tag(t.x, S.walkTop(t.x, 4) - 10, t.seen ? TRACK_KINDS[t.kind].name + ' tracks' : 'tracks');
    for (const q of Wd.posts) if (Math.abs(q.x - p.x) < 300) tag(q.x, q.y - 34, 'scent post');
    if (Wd.biologist && Math.abs(Wd.biologist.x - p.x) < 400) tag(Wd.biologist.x, Wd.biologist.y - 120, 'wolf biologist');
    if (Math.abs(WORLD.roadL + 50 - p.x) < 400) tag(WORLD.roadL + 50, S.surfaceAt(WORLD.roadL + 50) - WORLD.roadH - 20, 'road');
    if (Math.abs(WORLD.riverL + 100 - p.x) < 400) tag(WORLD.riverL + 100, WORLD.riverY - 20, S.snowOn ? 'frozen river' : 'river');
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
