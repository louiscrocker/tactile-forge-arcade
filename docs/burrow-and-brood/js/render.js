/* ============================================================
   render.js — composing the kingdom
   ============================================================
   Back to front:
     sky (time of day, weather), sun/moon, stars, clouds, rainbow,
     far hills  →  the back wall of the ant farm (dark soil behind
     every tunnel)  →  THE SOIL (see below)  →  water  →  grass,
     plants, flowers  →  the nest: food piles, scent trail, brood,
     the queen, the crowd, every ant, food, aphids, the ladybug,
     the worm, the player  →  rain and snow (above ground only) →
     particles  →  day/night light above ground  →  vignette,
     labels, arrows, letterbox.

   THE SOIL is painted one cell per pixel into a small canvas,
   then scaled up 3× with smoothing and its alpha sharpened, so a
   tunnel edge comes out smooth and crisp instead of blocky (a
   poor man's marching squares).  Only cells that changed are
   repainted.  Each frame the visible part goes into a screen
   buffer, gets a grain texture (world-anchored, so it never
   swims) and casts a soft shadow onto the back wall.
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1;
  let quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  const SKY = [
    [0.00, '#0a1030', '#1a2a55'], [0.19, '#1a1e4a', '#8a4a5a'], [0.26, '#6f9ede', '#ffc38f'],
    [0.38, '#6ab2f0', '#dcf1ff'], [0.55, '#4b9ce8', '#cfe9ff'], [0.70, '#6ba6e3', '#ffd9a3'],
    [0.79, '#4a4d9c', '#ff9a5c'], [0.86, '#1a2050', '#5c3d6c'], [1.00, '#0a1030', '#1a2a55']
  ];
  const stars = [], clouds = [];
  /* soil layers */
  let lo = null, loCtx = null, loImg = null, hi = null, hiCtx = null, scratch = null, scratchCtx = null;
  let water = null, waterCtx = null, waterImg = null, waterHad = false, waterClock = 0;
  let buf = null, bufCtx = null, grain = null, grainPat = null, wallPat = null, clods = null, clodPat = null;
  let builtFor = null;
  const HI = 3;
  /* surface decoration */
  const grass = [], pebbles = [], daisies = [];

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    for (let i = 0; i < 140; i++) stars.push([Math.random(), Math.random() * .7, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 9; i++) clouds.push(makeCloud());
    buildTextures();
  }
  function resize(w, h, dpr) {
    W = w; H = h; DPR = quality === 'low' ? 1 : dpr;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    buf = document.createElement('canvas'); buf.width = canvas.width; buf.height = canvas.height; bufCtx = buf.getContext('2d');
  }
  function setQuality(q) { if (q !== quality) { quality = q; resize(W, H, devicePixelRatio || 1); } }
  function getQuality() { return quality; }
  function getFps() { return fps; }

  function makeCloud() {
    const c = document.createElement('canvas'), w = 560, h = 320;
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const n = 7 + (Math.random() * 5 | 0);
    for (let k = 0; k < n; k++) {
      const x = 120 + Math.random() * (w - 240), y = 130 + Math.random() * 60, r = 40 + Math.random() * 55;
      const rg = g.createRadialGradient(x, y, r * .1, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(.6, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return { img: c, x: Math.random(), y: .05 + Math.random() * .3, s: .6 + Math.random() * .9, sp: 4 + Math.random() * 8, a: .5 + Math.random() * .5 };
  }

  /* fine grain (sand sparkle, specks, tiny pebbles) and big soft clods, both tiling */
  function buildTextures() {
    grain = document.createElement('canvas'); grain.width = grain.height = 256;
    const g = grain.getContext('2d'), R = mulberry32(99);
    for (let i = 0; i < 2600; i++) {
      const x = R() * 256, y = R() * 256, r = .4 + R() * 1.1, light = R() < .45;
      g.fillStyle = light ? `rgba(255,240,210,${.1 + R() * .22})` : `rgba(20,10,0,${.1 + R() * .25})`;
      for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); }
    }
    for (let i = 0; i < 60; i++) {
      const x = R() * 256, y = R() * 256, r = 1.4 + R() * 2.6;
      g.fillStyle = `rgba(${R() < .5 ? '255,245,225' : '40,25,12'},${.12 + R() * .15})`;
      g.beginPath(); g.ellipse(x, y, r, r * (.6 + R() * .4), R() * TAU, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = .5; g.stroke();
    }
    clods = document.createElement('canvas'); clods.width = clods.height = 512;
    const k = clods.getContext('2d');
    for (let i = 0; i < 90; i++) {
      const x = R() * 512, y = R() * 512, r = 20 + R() * 60;
      for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {   /* all nine copies: the tile wraps seamlessly */
        const rg = k.createRadialGradient(x + dx, y + dy, 1, x + dx, y + dy, r);
        const light = R() < .5;
        rg.addColorStop(0, light ? 'rgba(255,230,190,.10)' : 'rgba(0,0,0,.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        k.fillStyle = rg; k.beginPath(); k.arc(x + dx, y + dy, r, 0, TAU); k.fill();
      }
    }
  }

  /* ---------- the soil canvases ---------- */
  function buildSoil(S) {
    lo = document.createElement('canvas'); lo.width = S.cols; lo.height = S.rows; loCtx = lo.getContext('2d');
    loImg = loCtx.createImageData(S.cols, S.rows);
    hi = document.createElement('canvas'); hi.width = S.cols * HI; hi.height = S.rows * HI; hiCtx = hi.getContext('2d');
    water = document.createElement('canvas'); water.width = S.cols; water.height = S.rows; waterCtx = water.getContext('2d');
    waterImg = waterCtx.createImageData(S.cols, S.rows);
    grainPat = ctx.createPattern(grain, 'repeat'); clodPat = ctx.createPattern(clods, 'repeat');
    const wall = document.createElement('canvas'); wall.width = wall.height = 256;
    const wg = wall.getContext('2d'); wg.fillStyle = '#2b1b10'; wg.fillRect(0, 0, 256, 256); wg.drawImage(clods, 0, 0, 256, 256); wg.globalAlpha = .7; wg.drawImage(grain, 0, 0);
    wallPat = ctx.createPattern(wall, 'repeat');
    S.dirtyAll = false; S.paint.fill(0);
    /* the whole map goes through the same tile-sized path as later repaints, so it all matches */
    findStones(S);
    for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39);
    buildSurface(S);
    builtFor = S;
  }
  function cellColour(S, i, c, r, out) {
    const m = S.mat[i];
    if (!isSolidMat(m)) { out[0] = out[1] = out[2] = out[3] = 0; return; }
    const info = MAT_INFO[m], t = S.tex[i] / 255;
    const x = S.cx(c), y = S.cy(r), depth = y - S.surf0[c];
    let k = t;
    if (m === MAT.ROOT) k = ((c + r * 3) % 4) / 4 * .6 + t * .4;
    if (m === MAT.ROCK) {
      /* round pebbles: dark at the rim, a highlight on the upper left */
      let n = 0;
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const cc = c + x, rr2 = r + y; if (cc >= 0 && rr2 >= 0 && cc < S.cols && rr2 < S.rows && S.mat[rr2 * S.cols + cc] === MAT.ROCK) n++; }
      const up = r > 1 && c > 1 && S.mat[(r - 2) * S.cols + c - 1] !== MAT.ROCK;
      k = clamp(.15 + n / 25 * .55 + (up ? .35 : 0) + (t - .5) * .15, 0, 1);
    }
    let R = lerp(info.col[0], info.col2[0], k), Gc = lerp(info.col[1], info.col2[1], k), B = lerp(info.col[2], info.col2[2], k);
    let f = 1 - clamp(depth / 1500, 0, 1) * .3;
    if (m === MAT.LOAM) {
      f *= 1 + Math.sin(y * .045 + Math.sin(x * .004) * 3) * .05;
      if (depth > 200) { R *= .88; Gc *= .86; B *= .84; }                 /* the subsoil is paler, the topsoil richer */
      if (depth < 26) f *= .82 + depth / 26 * .18;
    }
    if (m === MAT.SAND) { f *= 1 + Math.sin(y * .07 + Math.sin(x * .006) * 4) * .045; if (S.packed[i]) f *= .93; }
    if (m === MAT.MOUND) f *= .95 + (t > .7 ? .12 : 0);
    const wet = S.wet[i];
    if (wet > 0) { f *= 1 - wet * .4; B += wet * 12; }
    const dmg = S.dmg[i];
    if (dmg > 0) f *= 1 - dmg * .35;
    out[0] = clamp(R * f, 0, 255); out[1] = clamp(Gc * f, 0, 255); out[2] = clamp(B * f, 0, 255); out[3] = 255;
  }
  /* Repaint a block of cells into the 3x image.  Each pixel blends its four
     nearest cells (colour from the solid ones only) and the solid/air edge is
     sharpened from that blend: smooth, round tunnel walls, and exactly the same
     result whichever block a pixel is painted in, so no seams. */
  function paintCells(S, c0, r0, c1, r1) {
    c0 = Math.max(0, c0); r0 = Math.max(0, r0); c1 = Math.min(S.cols - 1, c1); r1 = Math.min(S.rows - 1, r1);
    if (c1 < c0 || r1 < r0) return;
    const d = loImg.data, px = [0, 0, 0, 0], cols = S.cols, rows = S.rows;
    if (!smooth || smooth.length !== S.n * 4) smooth = new Float32Array(S.n * 4);
    /* 1. the colour of each cell (with a margin of two for the smoothing) */
    for (let r = Math.max(0, r0 - 3); r <= Math.min(rows - 1, r1 + 3); r++) for (let c = Math.max(0, c0 - 3); c <= Math.min(cols - 1, c1 + 3); c++) {
      const i = r * cols + c;
      cellColour(S, i, c, r, px);
      const o = i * 4; d[o] = px[0]; d[o + 1] = px[1]; d[o + 2] = px[2]; d[o + 3] = px[3];
    }
    /* 2. smooth each cell over its 3x3 neighbours (1-2-1 weights): round contours */
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
    /* 3. each pixel blends the four nearest smoothed cells; the edge is sharpened from the blend */
    const w = (c1 - c0 + 1) * HI, h = (r1 - r0 + 1) * HI;
    const img = hiCtx.createImageData(w, h), q = img.data, sm = smooth;
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
    hiCtx.putImageData(img, c0 * HI, r0 * HI);
    drawStones(c0, r0, c1, r1);
  }
  let smooth = null;
  /* stones never change, so each one is painted as a proper pebble: a union of
     round cells with one shading gradient across the whole stone */
  let stones = [];
  function findStones(S) {
    stones = [];
    const seen = new Uint8Array(S.n);
    for (let i = 0; i < S.n; i++) {
      if (seen[i] || S.mat[i] !== MAT.ROCK) continue;
      const cells = [], q = [i]; seen[i] = 1;
      while (q.length) {
        const j = q.pop(), c = j % S.cols, r = (j / S.cols) | 0; cells.push([c, r]);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = c + dc, rr2 = r + dr; if (cc < 0 || rr2 < 0 || cc >= S.cols || rr2 >= S.rows) continue; const k = rr2 * S.cols + cc; if (!seen[k] && S.mat[k] === MAT.ROCK) { seen[k] = 1; q.push(k); } }
      }
      let c0 = 1e9, c1 = -1, r0 = 1e9, r1 = -1, sx = 0, sy = 0;
      for (const [c, r] of cells) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); sx += c; sy += r; }
      const R = mulberry32(i);
      stones.push({ cells, c0, c1, r0, r1, cx: sx / cells.length, cy: sy / cells.length, rad: Math.max(c1 - c0, r1 - r0) / 2 + 1, hue: R(), R: R() });
    }
  }
  function drawStones(c0, r0, c1, r1) {
    const g = hiCtx;
    g.save();
    g.beginPath(); g.rect(c0 * HI, r0 * HI, (c1 - c0 + 1) * HI, (r1 - r0 + 1) * HI); g.clip();
    for (const st of stones) {
      if (st.c1 < c0 - 1 || st.c0 > c1 + 1 || st.r1 < r0 - 1 || st.r0 > r1 + 1) continue;
      const cx = (st.cx + .5) * HI, cy = (st.cy + .5) * HI, rad = st.rad * HI;
      const base = st.hue < .33 ? [128, 124, 118] : st.hue < .66 ? [140, 128, 112] : [112, 116, 122];
      const gr = g.createRadialGradient(cx - rad * .35, cy - rad * .45, rad * .1, cx, cy, rad * 1.25);
      gr.addColorStop(0, rgbStr(base.map(v => Math.min(255, v * 1.45)))); gr.addColorStop(.55, rgbStr(base)); gr.addColorStop(1, rgbStr(base.map(v => v * .55)));
      g.fillStyle = gr;
      g.beginPath();
      for (const [c, r] of st.cells) { g.moveTo((c + .5) * HI + HI * .95, (r + .5) * HI); g.arc((c + .5) * HI, (r + .5) * HI, HI * .95, 0, TAU); }
      g.fill();
      /* a few flecks */
      const R = mulberry32((st.R * 1e6) | 0);
      g.fillStyle = 'rgba(255,255,255,.18)';
      for (let k = 0; k < Math.min(30, st.cells.length); k++) { const [c, r] = st.cells[(R() * st.cells.length) | 0]; g.fillRect((c + R()) * HI, (r + R()) * HI, 1, 1); }
    }
    g.restore();
  }
  function updateSoil(S) {
    if (builtFor !== S) buildSoil(S);
    if (S.dirtyAll) { S.dirtyAll = false; S.paint.fill(0); for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39); }
    /* soil that changed: its chunks, widened by two cells (a pixel blends cells up to two away) */
    for (let k = 0; k < S.paint.length; k++) if (S.paint[k]) {
      S.paint[k] = 0; S.recolor[k] = 0;
      const kc = k % S.ccols, kr = (k / S.ccols) | 0;
      paintCells(S, kc * SOIL_CH - 2, kr * SOIL_CH - 2, kc * SOIL_CH + SOIL_CH + 1, kr * SOIL_CH + SOIL_CH + 1);
    }
    /* wet soil darkens and dries: repaint a few chunks a frame */
    let n = 0;
    for (let k = 0; k < S.recolor.length && n < 5; k++) if (S.recolor[k]) {
      S.recolor[k] = 0; n++;
      const kc = k % S.ccols, kr = (k / S.ccols) | 0;
      paintCells(S, kc * SOIL_CH - 2, kr * SOIL_CH - 2, kc * SOIL_CH + SOIL_CH + 1, kr * SOIL_CH + SOIL_CH + 1);
    }
    /* water */
    waterClock--;
    if ((S.waterCount > 0 || waterHad) && waterClock <= 0) {
      waterClock = 2;
      const d = waterImg.data;
      for (let i = 0; i < S.n; i++) { const o = i * 4; if (S.mat[i] === MAT.WATER) { d[o] = 70; d[o + 1] = 150; d[o + 2] = 225; d[o + 3] = 200; } else d[o + 3] = 0; }
      waterCtx.putImageData(waterImg, 0, 0);
      waterHad = S.waterCount > 0;
    }
  }
  function buildSurface(S) {
    grass.length = 0; pebbles.length = 0; daisies.length = 0;
    const R = mulberry32(S.seed ^ 0x5151);
    for (let x = S.X0 + 4; x < S.X1 - 4; x += 5 + R() * 4) grass.push({ x, h: 14 + R() * 38, lean: (R() - .5) * .9, w: 1.8 + R() * 2.2, c: (R() * 4) | 0, ph: R() * TAU });
    for (let i = 0; i < 70; i++) daisies.push({ x: lerp(S.X0, S.X1, R()), h: 22 + R() * 30, r: 5 + R() * 4, ph: R() * TAU, pink: R() < .3 });
    for (let i = 0; i < 120; i++) pebbles.push({ x: lerp(S.X0, S.X1, R()), r: 2 + R() * 4, k: R() });
  }

  /* ---------- helpers ---------- */
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  function nightAmount(tod) {
    if (tod < .2) return 1;
    if (tod < .3) return 1 - smoothstep(.2, .3, tod);
    if (tod > .78) return smoothstep(.78, .9, tod);
    return 0;
  }
  function seasonTint(world) {
    const s = world.season, t = world.seasonT, info = SEASON_INFO[s];
    let amount = info.leafTint[1];
    if (s === 'autumn') amount *= smoothstep(0, .8, t) + .2;
    if (s === 'spring') amount *= 1 - smoothstep(0, .7, t);
    return { key: s, tint: info.leafTint[0], amount: clamp(amount, 0, 1) };
  }
  /* the current ground line as a path (for clipping rain, the night tint, the back wall) */
  function surfacePath(c, S, view, below, original) {
    const c0 = clamp(S.col(view.l) - 1, 0, S.cols - 1), c1 = clamp(S.col(view.r) + 1, 0, S.cols - 1);
    c.beginPath();
    c.moveTo(view.l - 50, below ? view.b + 50 : view.t - 50);
    c.lineTo(view.l - 50, original ? S.surf0[c0] : S.Y0 + S.top[c0] * S.C);
    for (let col = c0; col <= c1; col++) c.lineTo(S.cx(col), original ? S.surf0[col] : S.Y0 + S.top[col] * S.C);
    c.lineTo(view.r + 50, original ? S.surf0[c1] : S.Y0 + S.top[c1] * S.C);
    c.lineTo(view.r + 50, below ? view.b + 50 : view.t - 50);
    c.closePath();
  }

  /* ============================================================
     THE FRAME
     ============================================================ */
  function frame(G, dt, clean) {
    const { cam, world, tod, time } = G;
    const S = world.soil, weather = world.weather;
    const night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    updateSoil(S);
    const season = seasonTint(world), cold = weather.snow;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    const horizonY = (0 - cam.y) * cam.zoom + H / 2;

    /* --- sky --- */
    if (horizonY > -40) {
      let [top, bot] = skyColours(tod);
      if (weather.cloud > .01) { top = mixHex(top, '#7d8794', weather.cloud * .75); bot = mixHex(bot, '#b9bfc6', weather.cloud * .7); }
      if (cold > .01) { top = mixHex(top, '#9fb4cc', cold * .35); bot = mixHex(bot, '#e6eef6', cold * .45); }
      const sky = ctx.createLinearGradient(0, Math.min(0, horizonY - H), 0, Math.max(horizonY, 10));
      sky.addColorStop(0, top); sky.addColorStop(1, bot);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, Math.min(H, horizonY + 40));
      const skyH = Math.max(80, horizonY);
      if (night > .05 && weather.cloud < .8) {
        for (const [sx, sy, r, ph] of stars) {
          const y = sy * skyH; if (y > horizonY) continue;
          ctx.globalAlpha = night * (0.35 + .65 * (.5 + .5 * Math.sin(time * 2 + ph * 6))) * (1 - weather.cloud);
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * W, y, .6 + r * 1.3, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      drawSunMoon(tod, night, horizonY, weather.cloud);
      for (const c of clouds) {
        const cx = ((c.x * W * 1.5 + time * c.sp * (1 + weather.gust * 4) - cam.x * .05) % (W * 1.5 + 600)) - 300;
        const cy = horizonY - H * .75 + c.y * H * .5 - 120;
        ctx.globalAlpha = c.a * (1 - night * .75) * (1 - weather.cloud * .5);
        ctx.drawImage(c.img, cx, cy, c.img.width * c.s, c.img.height * c.s);
        if (weather.cloud > .3) { ctx.globalAlpha = weather.cloud * .8; ctx.filter = quality === 'low' ? 'none' : 'brightness(.75)'; ctx.drawImage(c.img, cx + 140, cy + 60, c.img.width * c.s * 1.3, c.img.height * c.s * 1.1); ctx.filter = 'none'; }
      }
      ctx.globalAlpha = 1;
      if (weather.rainbow > .02) drawRainbow(horizonY, weather.rainbow, cam);
      /* far hills and a hedge */
      for (let i = 2; i >= 0; i--) {
        const par = .06 + i * .05;
        let col = mixHex(['#8ec279', '#6fae62', '#57984f'][i], '#1b2a3c', night * .8);
        if (season.key === 'autumn') col = mixHex(col, '#c9a04a', season.amount * .5);
        if (cold > 0) col = mixHex(col, '#e9eef4', cold * .85);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(0, H);
        const amp = (18 + i * 14) * Math.min(1.2, cam.zoom), yb = horizonY - (26 + i * 30) * Math.min(1.2, cam.zoom);
        for (let x = 0; x <= W; x += 20) { const wx = x + cam.x * par; ctx.lineTo(x, yb + Math.sin(wx * .0025 + i) * amp + Math.sin(wx * .007 + i * 2) * amp * .3); }
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      }
    } else { ctx.fillStyle = '#1e140c'; ctx.fillRect(0, 0, W, H); }

    /* ---------------- world space ---------------- */
    ctx.save();
    cam.apply(ctx);
    const view = cam.viewRect(80);

    /* the back of the ant farm: dark soil behind every hole */
    ctx.save();
    surfacePath(ctx, S, view, true, true);
    ctx.fillStyle = '#2a1a0f'; ctx.fill();
    ctx.clip();
    ctx.globalAlpha = .9; ctx.fillStyle = wallPat; ctx.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    const dg = ctx.createLinearGradient(0, 0, 0, 1500); dg.addColorStop(0, 'rgba(60,35,15,0)'); dg.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.globalAlpha = 1; ctx.fillStyle = dg; ctx.fillRect(view.l, Math.max(0, view.t), view.r - view.l, view.b - Math.max(0, view.t));
    ctx.restore();
    ctx.restore();

    /* the soil itself, via the buffer: grain + a shadow onto the back wall */
    drawSoilLayer(G, S, view, night);

    ctx.save();
    cam.apply(ctx);
    /* water in the tunnels */
    if (S.waterCount > 0 || waterHad) {
      ctx.globalAlpha = .78;
      ctx.drawImage(water, S.X0, S.Y0, S.cols * S.C, S.rows * S.C);
      ctx.globalAlpha = .25 + .1 * Math.sin(time * 3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(water, S.X0, S.Y0 - 2, S.cols * S.C, S.rows * S.C);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    drawSurfaceDecor(G, S, view, night, cold, season);
    for (const P of world.plants) drawPlant(G, P, view, season, cold);
    drawNest(G, view, time);
    drawOutside(G, view, time);
    for (const p of G.players) drawPlayer(G, p, time);
    drawFlight(G, view, time);
    drawPrecipitation(G, view, weather, time, dt, S);
    G.particles.draw(ctx, cam);
    ctx.restore();

    /* ---------------- light ---------------- */
    const dark = Math.max(night, weather.cloud * .35);
    if (dark > .01 && horizonY > -40) {
      ctx.save(); cam.apply(ctx); surfacePath(ctx, S, view, false, false); ctx.restore();
      ctx.save(); ctx.clip();
      ctx.globalCompositeOperation = 'multiply';
      const nb = night, cb = weather.cloud * .35 * (1 - night);
      ctx.fillStyle = `rgba(${lerp(255, 95, nb) - cb * 60 | 0},${lerp(255, 115, nb) - cb * 50 | 0},${lerp(255, 190, nb) - cb * 30 | 0},1)`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const warm = (Math.max(0, 1 - Math.abs(tod - .78) / .09) + Math.max(0, 1 - Math.abs(tod - .26) / .07)) * (1 - weather.cloud);
    if (warm > .01 && horizonY > 0) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = `rgba(255,150,70,${warm * .5})`; ctx.fillRect(0, 0, W, Math.min(H, horizonY));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save(); cam.apply(ctx);
    G.particles.ensureAmbient(quality === 'low' ? 30 : 60, view);
    if (weather.rain < .5 && cold < .5) G.particles.drawAmbient(ctx, view, time, night, dt, -6);
    ctx.restore();

    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    const alarm = world.ladybug.onPlant && G.colony.phase === 'growing' ? .5 + .5 * Math.sin(time * 5) : 0;
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(${20 + alarm * 60 | 0},12,6,${.34 + night * .15})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    if (!clean) drawOverlays(G, night, time);
    Cinematic.draw(ctx, W, H);
    /* debug (?showhi=x,y): the raw soil image, 1:1, to check the painting */
    if (G.showHi) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#f0f'; ctx.fillRect(0, 0, W, H); ctx.drawImage(hi, -G.showHi[0], -G.showHi[1]); }
  }

  function drawSoilLayer(G, S, view, night) {
    const cam = G.cam, b = bufCtx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, buf.width, buf.height);
    b.setTransform(DPR, 0, 0, DPR, 0, 0);
    b.save();
    cam.apply(b);
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    /* only the visible part of the hi-res soil */
    const sx0 = clamp(Math.floor((view.l - S.X0) / S.C) - 1, 0, S.cols), sy0 = clamp(Math.floor((view.t - S.Y0) / S.C) - 1, 0, S.rows);
    const sx1 = clamp(Math.ceil((view.r - S.X0) / S.C) + 1, 0, S.cols), sy1 = clamp(Math.ceil((view.b - S.Y0) / S.C) + 1, 0, S.rows);
    if (sx1 > sx0 && sy1 > sy0) b.drawImage(hi, sx0 * HI, sy0 * HI, (sx1 - sx0) * HI, (sy1 - sy0) * HI, S.X0 + sx0 * S.C, S.Y0 + sy0 * S.C, (sx1 - sx0) * S.C, (sy1 - sy0) * S.C);
    /* grain and clods on the soil only */
    b.globalCompositeOperation = 'source-atop';
    b.fillStyle = clodPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    b.globalAlpha = quality === 'low' ? .5 : .85; b.fillStyle = grainPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    b.globalAlpha = 1;
    /* a rim of light on the top of every surface, from above */
    b.restore();
    b.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (quality !== 'low') {
      ctx.shadowColor = 'rgba(8,4,0,.8)'; ctx.shadowBlur = 12 * DPR * Math.min(1.6, cam.zoom); ctx.shadowOffsetX = 2 * DPR * cam.zoom; ctx.shadowOffsetY = 4 * DPR * cam.zoom;
    }
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  }

  function drawSunMoon(tod, night, horizonY, cloud) {
    const sunT = invLerp(.22, .82, tod);
    const arc = Math.min(horizonY * .9, H * .8);
    if (tod > .2 && tod < .84) {
      const a = Math.PI * sunT, x = W * (0.08 + .84 * sunT), y = horizonY - Math.sin(a) * arc - 10, r = 42;
      ctx.globalAlpha = 1 - cloud * .7;
      const g = ctx.createRadialGradient(x, y, r * .2, x, y, r * 5);
      g.addColorStop(0, 'rgba(255,250,220,.9)'); g.addColorStop(.15, 'rgba(255,230,150,.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = mixHex('#fff6d0', '#ff9a4a', Math.pow(Math.abs(sunT - .5) * 2, 3));
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const moonT = tod < .5 ? tod + .5 : tod - .5, mT = invLerp(.22, .82, moonT), a = Math.PI * clamp(mT, 0, 1);
      const x = W * (0.08 + .84 * mT), y = horizonY - Math.sin(a) * arc * .95 - 10;
      ctx.globalAlpha = night * (1 - cloud * .8);
      const g = ctx.createRadialGradient(x, y, 20, x, y, 140);
      g.addColorStop(0, 'rgba(220,230,255,.35)'); g.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 140, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f2f4ff'; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(180,190,220,.5)';
      for (const [dx, dy, rr2] of [[-9, -6, 6], [8, 9, 4], [10, -12, 3]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, rr2, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  function drawRainbow(horizonY, k, cam) {
    const cx = W * .5 - cam.x * .05, cy = horizonY + 60, R = Math.max(W, H) * .62;
    const cols = ['#ff4b4b', '#ff9a2e', '#ffe14b', '#5ad36a', '#3fb9ff', '#5d5dff', '#b45cff'];
    ctx.save(); ctx.globalAlpha = k * .32; ctx.lineWidth = R * .022;
    cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, R - i * R * .022, Math.PI, TAU); ctx.stroke(); });
    ctx.restore();
  }

  /* grass, daisies and pebbles along the ground, where the ground is still where it started */
  function drawSurfaceDecor(G, S, view, night, cold, season) {
    if (view.t > 60) return;
    const time = G.time, gust = G.world.weather.gust;
    const intact = (x) => { const c = S.col(x); if (c < 0 || c >= S.cols) return false; const t = S.top[c]; return Math.abs(t - S.surfRow0[c]) <= 1 && S.mat[t * S.cols + c] === MAT.LOAM; };
    for (const p of pebbles) {
      if (p.x < view.l || p.x > view.r || !intact(p.x)) continue;
      ctx.fillStyle = mixHex('#8a7a6a', '#c9bfae', p.k);
      ctx.beginPath(); ctx.ellipse(p.x, S.surfaceAt(p.x) - p.r * .4, p.r, p.r * .7, 0, 0, TAU); ctx.fill();
    }
    const cols = ['#4f9a3a', '#5fae43', '#3f8a2e', '#74c24f'];
    const step = quality === 'low' ? 2 : 1;
    ctx.lineCap = 'round';
    for (let i = 0; i < grass.length; i += step) {
      const b = grass[i];
      if (b.x < view.l || b.x > view.r || !intact(b.x)) continue;
      const base = S.surfaceAt(b.x) + 2;
      const sw = Math.sin(time * 1.8 + b.ph) * .25 + b.lean + gust * .9;
      let col = cols[b.c];
      if (season.key === 'autumn') col = mixHex(col, '#c9a04a', season.amount * .5);
      if (cold > 0) col = mixHex(col, '#dfe7ee', cold * .8);
      ctx.strokeStyle = col; ctx.lineWidth = b.w;
      ctx.beginPath(); ctx.moveTo(b.x, base); ctx.quadraticCurveTo(b.x + sw * b.h * .3, base - b.h * .55, b.x + sw * b.h, base - b.h); ctx.stroke();
    }
    if (season.key === 'spring' || season.key === 'summer') for (const d of daisies) {
      if (d.x < view.l || d.x > view.r || !intact(d.x)) continue;
      const base = S.surfaceAt(d.x), sw = Math.sin(time * 1.4 + d.ph) * 4 + gust * 10;
      ctx.strokeStyle = '#4a9a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(d.x, base); ctx.quadraticCurveTo(d.x + sw * .5, base - d.h * .5, d.x + sw, base - d.h); ctx.stroke();
      ctx.fillStyle = d.pink ? '#f7a8c4' : '#fff';
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; ctx.beginPath(); ctx.ellipse(d.x + sw + Math.cos(a) * d.r * .8, base - d.h + Math.sin(a) * d.r * .8, d.r * .5, d.r * .3, a, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#f5c531'; ctx.beginPath(); ctx.arc(d.x + sw, base - d.h, d.r * .38, 0, TAU); ctx.fill();
    }
    if (cold > .02) {
      ctx.fillStyle = `rgba(245,250,255,${cold * .95})`;
      ctx.beginPath();
      const c0 = clamp(S.col(view.l), 0, S.cols - 1), c1 = clamp(S.col(view.r), 0, S.cols - 1);
      /* snow lies on the ground and the ant hill, not down the holes */
      const snowTop = (c) => S.top[c] > S.surfRow0[c] + 2 ? S.surf0[c] : S.Y0 + S.top[c] * S.C;
      ctx.moveTo(S.cx(c0), snowTop(c0) + 4);
      for (let c = c0; c <= c1; c++) ctx.lineTo(S.cx(c), snowTop(c) - 3 * cold - Math.sin(c * .7) * 1.5 * cold);
      for (let c = c1; c >= c0; c--) ctx.lineTo(S.cx(c), snowTop(c) + 3);
      ctx.closePath(); ctx.fill();
    }
  }

  /* ---------- the plants (as in Ladybug Life) ---------- */
  function segPoly(plant, s) {
    const L = [], R = [];
    for (let i = 0; i <= SEG_SAMPLES; i++) {
      const p = s.pts[i], q = s.pts[Math.min(SEG_SAMPLES, i + 1)], o = s.pts[Math.max(0, i - 1)];
      let tx = q[0] - o[0], ty = q[1] - o[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const w = lerp(s.w0, s.w1, s.cum[i] / s.len) * .5, sx = p[0] + plant.sway(p[0], p[1]);
      L.push([sx - ty * w, p[1] + tx * w]); R.push([sx + ty * w, p[1] - tx * w]);
    }
    return [L, R];
  }
  function drawPlant(G, plant, view, season, cold) {
    const time = G.time, bare = G.world.bareness();
    const inView = (x, y, pad) => x > view.l - pad && x < view.r + pad && y > view.t - pad && y < view.b + pad;
    if (!inView((plant.bounds.left + plant.bounds.right) / 2, plant.bounds.top / 2, (plant.bounds.right - plant.bounds.left) / 2 + 100 - plant.bounds.top / 2)) return;
    const T = plant.type, leafVisible = (lf) => lf.fall >= bare;
    for (const lf of plant.leaves) { if (lf.z >= 0 || !leafVisible(lf)) continue; const p = plant.posOn(lf.seg, lf.t); if (!inView(p.x, p.y, lf.size * 1.6)) continue; Sprites.drawLeaf(ctx, lf, p.x, p.y, time, false, season); }
    const segs = plant.segs.slice().sort((a, b) => a.depth - b.depth);
    for (const s of segs) {
      const n0 = plant.nodes[s.a], n1 = plant.nodes[s.b];
      if (!inView((n0.x + n1.x) / 2, (n0.y + n1.y) / 2, s.len * .6 + 40)) continue;
      const [L, R] = segPoly(plant, s);
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath();
      let base = T.stemCol[1];
      if (season.key === 'autumn' || season.key === 'winter') base = mixHex(base, '#7a6a3a', season.amount * .5);
      const g = ctx.createLinearGradient(L[0][0], L[0][1], R[0][0], R[0][1]);
      g.addColorStop(0, shade(T.stemCol[0], 1.15 + s.hueShift * .01)); g.addColorStop(.5, base); g.addColorStop(1, shade(T.stemCol[2], .8));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,220,.25)'; ctx.lineWidth = Math.max(1, s.w0 * .12);
      ctx.beginPath(); for (let i = 0; i < L.length; i++) { const x = lerp(L[i][0], R[i][0], .18), y = lerp(L[i][1], R[i][1], .18); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      if (cold > .3) {
        ctx.fillStyle = `rgba(245,250,255,${(cold - .3) / .7 * .9})`;
        for (let i = 1; i < SEG_SAMPLES; i += 2) {
          const p0 = s.pts[i - 1], p1 = s.pts[i + 1], tx = p1[0] - p0[0], ty = p1[1] - p0[1], tl = Math.hypot(tx, ty) || 1, flat = Math.abs(tx / tl);
          if (flat < .55) continue;
          const l = L[i], r = R[i], up = l[1] < r[1] ? l : r, w = Math.hypot(l[0] - r[0], l[1] - r[1]);
          ctx.beginPath(); ctx.ellipse(up[0], up[1] - w * .1, (s.len / SEG_SAMPLES) * 1.1, (w * .22 + 1.2) * (flat - .55) / .45 + .6, Math.atan2(ty, tx), 0, TAU); ctx.fill();
        }
      }
    }
    for (const n of plant.nodes) {
      if (n.segs.length < 2 || n.id === 0 || !inView(n.x, n.y, 30)) continue;
      const s = plant.segs[n.segs[0]], w = plant.posOn(s, s.a === n.id ? 0 : 1, false).w;
      ctx.fillStyle = withAlpha(T.stemCol[1], .9); ctx.beginPath(); ctx.arc(n.x + plant.sway(n.x, n.y), n.y, w * .52, 0, TAU); ctx.fill();
    }
    for (const lf of plant.leaves) { if (lf.z < 0 || !leafVisible(lf)) continue; const p = plant.posOn(lf.seg, lf.t); if (!inView(p.x, p.y, lf.size * 1.6)) continue; Sprites.drawLeaf(ctx, lf, p.x, p.y, time, quality !== 'low', season); }
    const bloom = season.key === 'spring' ? smoothstep(.2, .7, G.world.seasonT) : season.key === 'summer' ? 1 : season.key === 'autumn' ? 1 - smoothstep(0, .5, G.world.seasonT) : 0;
    for (const f of plant.flowers) {
      const x = f.x + plant.sway(f.x, f.y);
      if (!inView(x, f.y, f.size * 3)) continue;
      const isFruit = f.kind === 'pod' || f.kind === 'bud', a = isFruit ? (season.key === 'winter' ? 0 : 1) : bloom;
      if (a <= .01) continue;
      ctx.globalAlpha = a; Sprites.drawFlower(ctx, f, x, f.y, time); ctx.globalAlpha = 1;
    }
    /* aphids, with a honeydew drop when one is ready; aphid eggs in winter */
    const herd = plant.herd;
    for (const a of herd.list) {
      if (!inView(a.x, a.y, 20)) continue;
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang);
      Sprites.drawAphid(ctx, { s: 1.05, variant: a.variant, grow: a.grow, dew: a.dew, walk: 0 });
      ctx.restore();
    }
    if (G.world.season === 'winter') {
      ctx.fillStyle = '#1a1a1a';
      for (const s of plant.segs) if (s.depth >= 1) for (let k = 1; k < 4; k++) { const p = plant.posOn(s, k / 4); if (inView(p.x, p.y, 10)) { ctx.beginPath(); ctx.ellipse(p.x, p.y - p.w * .5 - 1, 1.6, 1, 0, 0, TAU); ctx.fill(); } }
    }
  }

  /* ---------- a side-view ant anywhere ---------- */
  function antAt(e, o) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.ang);
    if (e.flip) ctx.scale(1, -1);
    Sprites.drawAnt(ctx, o);
    ctx.restore();
  }
  function drawNest(G, view, time) {
    const C = G.colony, sp = G.speciesDef(), W = G.world;
    const inView = (x, y, pad = 30) => x > view.l - pad && x < view.r + pad && y > view.t - pad && y < view.b + pad;
    /* the scent trail */
    if (C.trail.length) {
      for (const t of C.trail) { if (!inView(t.x, t.y, 4)) continue; ctx.globalAlpha = t.life * .55; ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(t.x, t.y, 1.8, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    /* food piles in the food rooms: more food, bigger pile */
    const pans = C.pantries();
    if (pans.length) {
      const per = Math.min(22, Math.round(Math.sqrt(C.food / Math.max(1, C.rep()) * 3)));
      const hon = Math.min(12, Math.round(Math.sqrt(C.honey / Math.max(1, C.rep()) * 2)));
      pans.forEach((room, ri) => {
        if (!inView(room.x, room.y, room.rx + 20)) return;
        const R = mulberry32(room.id * 97);
        const n = Math.round(per / pans.length) + (ri === 0 ? per % pans.length : 0);
        for (let k = 0; k < n; k++) {
          const x = room.x + (R() - .5) * room.rx * 1.2, fy = floorY(G, x, room);
          ctx.save(); ctx.translate(x, fy - 3 - (k % 3) * 3); ctx.rotate(R() * TAU);
          if (sp.special === 'gardener') { ctx.fillStyle = k % 2 ? '#f2f0e6' : '#e0dcc8'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); }
          else if (R() < .6) Sprites.drawSeed(ctx, { s: .7 }); else Sprites.drawCrumb(ctx, { s: .6 });
          ctx.restore();
        }
        for (let k = 0; k < Math.round(hon / pans.length); k++) {
          const x = room.x + (R() - .5) * room.rx, fy = floorY(G, x, room);
          ctx.save(); ctx.translate(x, fy - 4); Sprites.drawHoneydew(ctx, 3.2); ctx.restore();
        }
      });
    }
    /* brood */
    for (const b of C.brood) {
      if (b.carried || !inView(b.x, b.y)) continue;
      ctx.save(); ctx.translate(b.x, b.y);
      if (b.kind === 'egg') { ctx.translate(0, -3); Sprites.drawEggs(ctx, { s: b.rep > 1 ? 1.3 : 1, count: b.rep > 1 ? 7 : 4, seed: b.id }); }
      else if (b.kind === 'larva') {
        ctx.translate(0, -5); Sprites.drawBroodLarva(ctx, { s: b.caste === 'alate' ? 1.25 : 1, grow: .25 + b.fed / BROOD.larvaNeed * .75, fed: b.fed / BROOD.larvaNeed, t: b.t });
        if (C.hungryLarva(b) && G.colony.phase === 'founding' || (C.hungryLarva(b) && G.players[0] && dist(G.players[0].x, G.players[0].y, b.x, b.y) < 120)) {
          /* a little hungry bubble */
          ctx.globalAlpha = .75 + .25 * Math.sin(time * 5 + b.id);
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, -12, 5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(4, -6, 1.6, 0, TAU); ctx.fill();
          ctx.fillStyle = '#f39a2b'; ctx.beginPath(); ctx.arc(8, -12, 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        }
      } else { ctx.translate(0, -5); Sprites.drawCocoon(ctx, { s: b.caste === 'alate' ? 1.3 : 1, prog: b.age / BROOD.pupaT }); }
      if (b.wet > .3) { ctx.fillStyle = 'rgba(160,210,255,.7)'; ctx.beginPath(); ctx.arc(-6, -10, 2, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    /* the queen */
    const q = C.queen;
    if (q && inView(q.x, q.y)) antAt({ x: q.x, y: q.y, ang: q.ang, flip: false }, { s: 1.25, sp, caste: 'queen', walk: q.walk, wings: 0 });
    /* the crowd of a big colony */
    if (C.crowd.length) {
      const col = sp.gaster;
      ctx.fillStyle = col;
      for (const c of C.crowd) {
        if (!inView(c.x, c.y, 8)) continue;
        if (G.cam.zoom > 1.1) { antAt({ x: c.x, y: c.y + 2, ang: c.ang, flip: Math.cos(c.ang) < 0 && false }, { s: .6, sp, walk: c.walk }); continue; }
        ctx.save(); ctx.translate(c.x, c.y + 3); ctx.rotate(c.ang);
        ctx.beginPath(); ctx.ellipse(-4, 0, 3.4, 2.4, 0, 0, TAU); ctx.ellipse(1.5, -.5, 2.6, 1.4, 0, 0, TAU); ctx.ellipse(5.5, -1, 2, 1.8, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    /* the ants you can see */
    for (const a of C.agents) {
      if (!inView(a.x, a.y)) continue;
      antAt(a, { s: .92, sp, walk: a.walk, carry: a.carry, crop: clamp(a.crop / 3, 0, 1), callow: a.callow, bite: a.bite, tap: a.tap, dig: a.dig, aphidVariant: 'green' });
    }
  }
  function floorY(G, x, room) {
    const S = G.world.soil;
    let y = room.y - room.ry * .3;
    while (y < room.y + room.ry + 30 && !S.solidAt(x, y + 2)) y += 3;
    return y;
  }
  function drawOutside(G, view, time) {
    const W = G.world, sp = G.speciesDef();
    const inView = (x, y, pad = 30) => x > view.l - pad && x < view.r + pad && y > view.t - pad && y < view.b + pad;
    for (const f of W.foods.list) {
      if (!inView(f.x, f.y)) continue;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.falling ? f.rot : (f.kind === 'bug' ? 0 : f.rot * .3));
      if (f.kind === 'seed') Sprites.drawSeed(ctx, { s: 1 });
      else if (f.kind === 'crumb') Sprites.drawCrumb(ctx, { s: 1 });
      else if (f.kind === 'leaf') Sprites.drawLeafBit(ctx, { s: 1 });
      else Sprites.drawDeadBug(ctx, { s: 1 });
      ctx.restore();
      if (f.need > 1 && !f.falling) {
        /* how many ants it needs */
        for (let k = 0; k < f.need; k++) { ctx.fillStyle = k < f.carriers.length ? '#ffe27a' : 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(f.x - (f.need - 1) * 6 + k * 12, f.y - f.r - 10, 3.6, 0, TAU); ctx.fill(); }
      }
    }
    /* the ladybug and her larva */
    const lb = W.ladybug;
    if (lb.state === 'visit' && lb.fly) {
      const f = lb.fly;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang || 0); Sprites.drawLadybug(ctx, { s: .8, open: f.open, wingPhase: f.phase }); ctx.restore();
    }
    if (lb.egg && (lb.state === 'visit' && lb.fly && lb.fly.leave || lb.state === 'eggs')) {
      const p = lb.plant.posOn(lb.egg.seg, lb.egg.t);
      ctx.save(); ctx.translate(p.x, p.y - p.w * .5 - 3);
      const R = mulberry32(5);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = '#f6c544'; ctx.beginPath(); ctx.ellipse((R() - .5) * 12, (R() - .5) * 5, 1.6, 2.6, R() - .5, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    if (lb.state === 'hunt' || lb.state === 'falling' || lb.state === 'leaving') {
      ctx.save(); ctx.translate(lb.x, lb.y); ctx.rotate(lb.ang);
      if (lb.flinch > 0) ctx.translate(Math.sin(time * 60) * 2, 0);
      Sprites.drawLadyLarva(ctx, { s: .95, instar: 3, walk: lb.walk, chew: lb.chew > 0 ? .5 + .5 * Math.sin(time * 20) : 0 });
      ctx.restore();
    }
    /* the earthworm */
    const wm = W.worm;
    if (inView(wm.x, wm.y, 80)) Sprites.drawWorm(ctx, wm.body, time);
  }
  function drawPlayer(G, p, time) {
    const sp = G.speciesDef();
    /* a soft glow so a child can always find "me" */
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 26 * p.scale());
    g.addColorStop(0, p.id === 1 ? 'rgba(255,230,120,.35)' : 'rgba(150,210,255,.35)'); g.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 26 * p.scale(), 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.ang); if (p.flip) ctx.scale(1, -1);
    Sprites.drawAnt(ctx, { s: p.caste === 'queen' ? 1.25 : 1, sp, caste: p.caste === 'queen' ? (p.wings > .05 ? 'alate' : 'queen') : 'worker', wings: p.wings, flap: p.flap, flying: p.mode === 'fly', walk: p.walk, bite: p.bite, tap: p.tap, dig: p.dig, carry: p.carry, crop: clamp(p.crop / 3, 0, 1), callow: p.callow, aphidVariant: p.aphidVariant });
    ctx.restore();
    /* a little bobbing marker so a child can always find "me" */
    const bob = Math.sin(time * 4) * 3, my = p.y - 26 * p.scale() - 10 + bob, k = 1 / Math.max(.8, G.cam.zoom * .8);
    ctx.save(); ctx.translate(p.x, my); ctx.scale(k, k);
    ctx.fillStyle = p.id === 1 ? '#ffd23f' : '#8fd0ff'; ctx.strokeStyle = 'rgba(60,30,0,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(7, -9); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawFlight(G, view, time) {
    const C = G.colony, sp = G.speciesDef();
    for (const w of C.alates) {
      ctx.save(); ctx.translate(w.x, w.y);
      if (w.phase === 'fly') ctx.rotate(Math.atan2(w.vy, w.vx) * .3);
      else ctx.rotate(w.ang);
      Sprites.drawAnt(ctx, { s: w.male ? .85 : 1.1, sp, caste: w.male ? 'male' : 'alate', walk: w.walk, flap: w.flap, flying: w.phase === 'fly' });
      ctx.restore();
    }
  }

  /* rain and snow fall only through the air */
  function drawPrecipitation(G, view, weather, time, dt, S) {
    if (weather.rain < .02 && weather.snow < .02) return;
    if (view.t > 40) return;
    ctx.save();
    surfacePath(ctx, S, view, false, false); ctx.clip();
    const w = view.r - view.l, h = Math.min(view.b, 20) - view.t;
    if (weather.rain > .02) {
      const n = Math.round((quality === 'low' ? 90 : 220) * weather.rain);
      ctx.strokeStyle = `rgba(200,225,255,${.32 * weather.rain})`; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      const gust = weather.gust * 60;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const hx = ((i * 1234.567) % 1), hy = ((i * 7654.321) % 1);
        const x = view.l + ((hx * w + time * 90 + i * 7) % w), y = view.t + ((hy * h + time * 1400 * (0.8 + hx * .4)) % h);
        ctx.moveTo(x, y); ctx.lineTo(x - 4 - gust * .3, y - 22);
      }
      ctx.stroke();
      if (weather.rain > .4 && chance(dt * 30) && quality !== 'low') { const x = rnd(view.l, view.r); G.particles.spawn({ type: 'ring', x, y: S.surfaceAt(x) - 1, r: 1, grow: 30, col: 'rgba(200,230,255,.7)', life: .3, width: 1 }); }
    }
    if (weather.snow > .02) {
      const n = Math.round((quality === 'low' ? 60 : 160) * weather.snow);
      ctx.fillStyle = `rgba(250,252,255,${.85 * weather.snow})`;
      for (let i = 0; i < n; i++) {
        const hx = ((i * 1234.567) % 1), hy = ((i * 7654.321) % 1);
        const x = view.l + ((hx * w + Math.sin(time * .7 + i) * 30 + time * 15) % w), y = view.t + ((hy * h + time * (40 + hx * 40)) % h);
        ctx.beginPath(); ctx.arc(x, y, 1.5 + hx * 2.2, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------- labels, arrows, the room map ---------- */
  function drawOverlays(G, night, time) {
    const { cam, world, settings, players, colony: C } = G;
    const S = world.soil;
    ctx.font = `700 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (wx, wy, text, dy = -30, col = '#fff') => {
      const [sx, sy] = cam.toScreen(wx, wy);
      if (sx < -40 || sx > W + 40 || sy < 0 || sy > H) return;
      const w = ctx.measureText(text).width + 16;
      ctx.fillStyle = 'rgba(20,14,8,.72)'; rr(ctx, sx - w / 2, sy + dy - 11, w, 22, 11); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(text, sx, sy + dy);
    };
    const arrow = (wx, wy, col, label) => {
      const [sx, sy] = cam.toScreen(wx, wy);
      if (sx > 30 && sx < W - 30 && sy > 110 && sy < H - 40) return;
      const cx = clamp(sx, 50, W - 50), cy = clamp(sy, 140, H - 90), a = Math.atan2(sy - cy, sx - cx);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-12, -15); ctx.lineTo(-5, 0); ctx.lineTo(-12, 15); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
      if (label) { ctx.fillStyle = '#fff'; ctx.font = `900 14px ${UI_FONT}`; ctx.fillText(label, cx, cy + 28); ctx.font = `700 13px ${UI_FONT}`; }
    };
    const p = players[0];
    /* where to go next */
    if (p && C.phase === 'growing') {
      const carryingHome = (p.carry && !['soil', 'sand'].includes(p.carry) && !['egg', 'larva', 'pupa'].includes(p.carry)) || p.crop >= 1;
      if (carryingHome && !p.underground && C.entrance) arrow(C.entrance.x, C.entrance.y - 10, '#ffe27a', '🏠 home');
      if ((p.carry === 'soil' || p.carry === 'sand') && p.underground && C.entrance) arrow(C.entrance.x, C.entrance.y - 20, '#e0b070', '⬆ out');
      if (world.ladybug.onPlant && !carryingHome) arrow(world.ladybug.x, world.ladybug.y, '#ff7a6a', '🐞');
    }
    if (players.length > 1) players.forEach((q, i) => { tag(q.x, q.y, `Player ${i + 1}`, -30, i ? '#a9dcff' : '#ffe27a'); const [sx, sy] = cam.toScreen(q.x, q.y); if (sx < 0 || sx > W || sy < 0 || sy > H) arrow(q.x, q.y, i ? '#a9dcff' : '#ffe27a'); });
    /* zoomed out: every room gets its name, so the nest reads like a map */
    const map = cam.zoom < .75;
    if (settings.labels || map) {
      const ROOM = { royal: '👑 Queen\'s room', nursery: '🍼 Nursery', pantry: '🌾 Food room', winter: '❄️ Winter room' };
      for (const r of C.rooms) if (r.open >= .7 || r.kind === 'royal') tag(r.x, r.y - r.ry, ROOM[r.kind] || 'Room', -8, '#ffe9a0');
      if (C.entrance) tag(C.entrance.x + 90, Math.min(S.surfaceAt(C.entrance.x + 70), S.surfaceAt(C.entrance.x)), '⛰️ Ant hill', -34, '#f0d0a0');
    }
    if (!settings.labels) return;
    if (p) tag(p.x, p.y, p.caste === 'queen' ? 'You · the queen' : 'You · a worker', -30 - (players.length > 1 ? 24 : 0), '#ffe27a');
    const seen = new Set();
    for (const a of C.agents) { if (seen.has(a.job) || seen.size >= 5) continue; const [sx, sy] = cam.toScreen(a.x, a.y); if (sx < 60 || sx > W - 60 || sy < 120 || sy > H - 60) continue; seen.add(a.job); tag(a.x, a.y, JOBS[a.job].emoji + ' ' + JOBS[a.job].name.toLowerCase(), -24, JOBS[a.job].col); }
    if (C.queen) tag(C.queen.x, C.queen.y, '👑 the queen', -30, '#ffe27a');
    for (const P of world.plants) { if (P.herd.list[0]) tag(P.herd.list[0].x, P.herd.list[0].y, 'aphids', -20); const n = P.nodes[Math.min(3, P.nodes.length - 1)]; tag(n.x, n.y, P.type.name, -10, '#d8f5c0'); }
    if (world.ladybug.onPlant) tag(world.ladybug.x, world.ladybug.y, 'ladybug larva', -28, '#ffb0a0');
    tag(world.worm.x, world.worm.y, 'earthworm', -18, '#ffc8d0');
    /* what the soil is made of, near you */
    if (p) for (const [dx, dy] of [[-90, 40], [90, 60], [0, 120]]) { const m = S.matAt(p.x + dx, p.y + dy); if (isSolidMat(m)) tag(p.x + dx, p.y + dy, MAT_INFO[m].name.toLowerCase(), 0, '#f0e0c0'); }
  }

  function snapshot(G) {
    frame(G, 0, true);
    return canvas;
  }

  return { init, resize, frame, nightAmount, skyColours, setQuality, getQuality, getFps, snapshot };
})();
