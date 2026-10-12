/* ============================================================
   render.js — the Arctic coast, back to front
   ============================================================
     sky (time of day, the season: polar night and midnight sun,
     weather) · stars · the northern lights · the sun · the moon in
     its real phase · far snowy hills and the tundra, parallax bands
     the sea's water behind the cells (so the seabed shows)
     THE COAST in cross-section (peat, permafrost, rock, shingle,
     snow, sea ice, the old snowdrift), painted from cells at 4x with
     smooth edges (Ant Kingdom's method); a dug den shows blue snow
     or dark peat behind it
     the rim along the ground · rocks, sedges, Arctic flowers,
     autumn bearberry, kelp, driftwood · tracks · the seals' holes ·
     the meal · caribou, the buggy, foxes, lemmings, belugas, the
     resting seal, the bears, YOU, the cubs · particles · the water's
     tint over swimmers · snowfall, rain, the whiteout · night · the
     dark of the den · vignette
     overlays: the play-fight ring and meter, the sniff ring, the
     keep-still meter, the creep bar with the seal's eye, arrows,
     name tags
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1, quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  const HI = 4;
  const SKY = [
    [0.00, '#060a22', '#122046'], [0.19, '#121a44', '#4a3a6a'], [0.25, '#7a8fc8', '#ffc0a0'],
    [0.36, '#5aa6dc', '#dcf0fa'], [0.55, '#4f9ad8', '#d4ecf8'], [0.70, '#6aa0d8', '#ffd8b0'],
    [0.79, '#3d3f8c', '#ff9a70'], [0.86, '#121a48', '#3a3a6a'], [1.00, '#060a22', '#122046']
  ];
  const stars = [], flakes = [];
  let layers = [];
  let lo = null, loImg = null, hi = null, hiCtx = null, back = null, backCtx = null, smooth = null;
  let buf = null, bufCtx = null, grainPat = null, grain = null;
  let builtFor = null, decor = null;

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    for (let i = 0; i < 240; i++) stars.push([Math.random(), Math.random() * .8, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 220; i++) flakes.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, ph: Math.random() * TAU });
    buildGrain();
    buildLayers();
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
    for (let i = 0; i < 4000; i++) { const v = R(); g.fillStyle = v < .55 ? `rgba(0,0,0,${R() * .14})` : `rgba(255,255,255,${R() * .14})`; g.fillRect(R() * 256, R() * 256, 1 + (R() < .3), 1 + (R() < .3)); }
    for (let i = 0; i < 100; i++) { const x = R() * 256, y = R() * 256, r = .6 + R() * 1.6; g.fillStyle = `rgba(0,0,0,${.06 + R() * .1})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  }
  /* three tileable bands: far snowy mountains, rolling hills, near tundra ridges.
     Drawn in two versions (snowy and bare) so the season can fade between them */
  function buildLayers() {
    layers = [];
    const specs = [{ h: 380, par: .07, kind: 'mountains' }, { h: 400, par: .14, kind: 'hills' }, { h: 420, par: .26, kind: 'tundra' }];
    specs.forEach((sp, li) => {
      const make = (snowy) => {
        const c = document.createElement('canvas'), w = 2048; c.width = w; c.height = sp.h;
        const g = c.getContext('2d'), R = mulberry32(31 + li * 7), n1 = makeNoise1D(41 + li);
        const pts = [];
        for (let x = 0; x <= w; x += 16) {
          const u = x / w;
          let y;
          if (sp.kind === 'mountains') y = sp.h * (.34 + .2 * Math.abs(Math.sin(u * 6.3 + 1)) + .12 * n1(x * .03));
          else if (sp.kind === 'hills') y = sp.h * (.46 + .1 * Math.sin(u * 5.1 + 2) + .1 * n1(x * .02 + 5));
          else y = sp.h * (.54 + .06 * Math.sin(u * 9 + 1) + .08 * n1(x * .025 + 9));
          pts.push([x, y]);
        }
        pts[pts.length - 1][1] = pts[0][1];
        const base = snowy ? (sp.kind === 'mountains' ? '#c4d2e2' : sp.kind === 'hills' ? '#d4e0ec' : '#e2ecf6') : (sp.kind === 'mountains' ? '#7a8a98' : sp.kind === 'hills' ? '#7a8466' : '#8a8a5e');
        g.fillStyle = base; g.beginPath(); g.moveTo(0, sp.h); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(w, sp.h); g.closePath(); g.fill();
        g.save(); g.beginPath(); g.moveTo(0, sp.h); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(w, sp.h); g.closePath(); g.clip();
        if (sp.kind === 'mountains') {
          /* snowcaps even in summer, and shaded flanks */
          const line = (x) => sp.h * (snowy ? .62 : .44) + (n1(x * .05 + 20) - .5) * 40;
          g.fillStyle = snowy ? '#f4f8ff' : '#e8f0f8'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); for (let x = w; x >= 0; x -= 8) g.lineTo(x, line(x)); g.closePath(); g.fill();
          g.fillStyle = 'rgba(40,60,100,.14)';
          for (let k = 1; k < pts.length - 1; k++) { const [x, y] = pts[k]; if (y < pts[k - 1][1] && y <= pts[k + 1][1]) { g.beginPath(); g.moveTo(x, y); let j = k; while (j < pts.length - 1 && pts[j + 1][1] >= pts[j][1]) j++; for (let m = k; m <= j; m++) g.lineTo(pts[m][0], pts[m][1]); g.lineTo(pts[j][0] - (pts[j][0] - x) * .3, sp.h); g.lineTo(x, sp.h); g.closePath(); g.fill(); } }
        } else {
          /* soft light and shade on the rolling ground; boulders and ponds when bare */
          g.fillStyle = snowy ? 'rgba(120,150,190,.12)' : 'rgba(60,50,30,.12)';
          for (let k = 0; k < 40; k++) { g.beginPath(); g.ellipse(R() * w, sp.h * (.6 + R() * .35), 40 + R() * 80, 6 + R() * 8, 0, 0, TAU); g.fill(); }
          if (!snowy) { g.fillStyle = 'rgba(120,160,190,.55)'; for (let k = 0; k < 10; k++) { g.beginPath(); g.ellipse(R() * w, sp.h * (.66 + R() * .3), 18 + R() * 30, 3 + R() * 3, 0, 0, TAU); g.fill(); } }
        }
        g.restore();
        return c;
      };
      layers.push({ snow: make(true), bare: make(false), par: sp.par, h: sp.h, kind: sp.kind });
    });
  }

  /* ---------- the coast's cells ---------- */
  function cellColour(S, i, c, r, out, backWall) {
    const m = backWall ? S.orig[i] : S.mat[i];
    if (m === MAT.AIR) { out[0] = out[1] = out[2] = out[3] = 0; return; }
    const info = MAT_INFO[m], t = S.tex[i] / 255, x = S.cx(c), y = S.cy(r);
    let R = lerp(info.col[0], info.col2[0], t), Gc = lerp(info.col[1], info.col2[1], t), B = lerp(info.col[2], info.col2[2], t);
    let f = 1;
    const depth = y - S.surfaceAt(x);
    if (m === MAT.ROCK) { f *= 1 + Math.sin(x * .31 + Math.sin(y * .2) * 2) * .05 - (((c * 7 + r * 13) % 11) === 0 ? .18 : 0); if (depth > 30) f *= 1 - clamp((depth - 30) / 300, 0, .45); }
    if (m === MAT.SOIL || m === MAT.FROZEN) {
      f *= 1 - clamp(depth / 300, 0, 1) * .4;
      if (m === MAT.SOIL && depth < 8) { R = lerp(R, 60, .45); Gc = lerp(Gc, 46, .45); B = lerp(B, 30, .45); }   /* a dark mossy top */
      if (m === MAT.FROZEN && ((c * 13 + r * 7) % 9) === 0) { R = lerp(R, 210, .5); Gc = lerp(Gc, 226, .5); B = lerp(B, 240, .5); }   /* ice glints in the permafrost */
    }
    if (m === MAT.GRAVEL && depth > 3 && y > WORLD.seaY) f *= .78;   /* the seabed, under water */
    if (m === MAT.SNOW) { const sh = Math.sin(x * .05 + y * .3) * .03; f *= .97 + sh; }
    if (m === MAT.DRIFT) { const layer = Math.sin(y * .5 + Math.sin(x * .02) * 2) * .035; f *= .97 + layer; B = Math.min(255, B + 4); }
    if (m === MAT.ICE) { f *= 1 + Math.sin(x * .2) * .05; if (y > -1) { R *= .82; Gc *= .9; } }
    if (m === MAT.GRAVEL) f *= .9 + t * .2;
    const dmg = S.dmg[i]; if (dmg > 0 && !backWall) f *= 1 - dmg * .3;
    if (backWall) {
      /* the far side of a dug den: blue shadowy snow, or dark damp peat */
      if (m === MAT.DRIFT) { R = 150 + t * 20; Gc = 178 + t * 20; B = 214 + t * 16; f = 1; }
      else if (m === MAT.SNOW || m === MAT.ICE) { out[0] = out[1] = out[2] = out[3] = 0; return; }
      else { R = 40 + t * 14; Gc = 30 + t * 10; B = 22 + t * 6; f = 1; }
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
  function paintBack(S) { backCtx.clearRect(0, 0, back.width, back.height); for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, true); S.backDirty = false; }
  function buildCells(S) {
    lo = document.createElement('canvas'); lo.width = S.cols; lo.height = S.rows; loImg = lo.getContext('2d').createImageData(S.cols, S.rows);
    hi = document.createElement('canvas'); hi.width = S.cols * HI; hi.height = S.rows * HI; hiCtx = hi.getContext('2d');
    back = document.createElement('canvas'); back.width = S.cols * HI; back.height = S.rows * HI; backCtx = back.getContext('2d');
    grainPat = ctx.createPattern(grain, 'repeat');
    if (grainPat.setTransform) grainPat.setTransform(new DOMMatrix().scale(.5, .5));
    paintBack(S);
    S.dirtyAll = false; S.paint.fill(0);
    for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, false);
    builtFor = S;
    buildDecor(S);
  }
  function updateCells(S) {
    if (builtFor !== S) buildCells(S);
    if (S.backDirty) paintBack(S);
    if (S.dirtyAll) { S.dirtyAll = false; S.paint.fill(0); hiCtx.clearRect(0, 0, hi.width, hi.height); for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, false); }
    for (let k = 0; k < S.paint.length; k++) if (S.paint[k]) {
      S.paint[k] = 0;
      const kc = k % S.ccols, kr = (k / S.ccols) | 0;
      paintCells(S, kc * CELL_CH - 2, kr * CELL_CH - 2, kc * CELL_CH + CELL_CH + 1, kr * CELL_CH + CELL_CH + 1, false);
    }
  }
  /* things growing on the surface (land only), made once per world */
  function buildDecor(S) {
    const R = mulberry32(S.seed + 9), Wd = WORLD;
    decor = { grass: [], flowers: [], berries: [], stones: [], kelp: [], logs: [], cotton: [] };
    for (let x = Wd.left + 20; x < Wd.shoreL + 60; x += 5 + R() * 9) decor.grass.push({ x, s: .5 + R() * .8, ph: R() * TAU, k: R() });
    for (let x = Wd.slopeR - 200; x < Wd.shoreL; x += 14 + R() * 22) decor.flowers.push({ x, s: .6 + R() * .8, col: pick(['#ffd23f', '#e868b0', '#ffffff', '#c890ff', '#ffe060']), ph: R() * TAU });
    for (let x = Wd.left + 40; x < Wd.shoreL; x += 9 + R() * 14) decor.berries.push({ x, s: .6 + R() * .7, a: R() });
    for (let x = Wd.tundraL; x < Wd.shoreL; x += 30 + R() * 50) decor.cotton.push({ x, s: .7 + R() * .6, ph: R() * TAU });
    for (let k = 0; k < 40; k++) { const x = lerp(Wd.left, Wd.shoreL + 300, R()); decor.stones.push({ x, s: .4 + R() * 1.1, seed: (R() * 997) | 0 }); }
    for (let x = Wd.shoreL + 40; x < Wd.shoreX - 10; x += 8 + R() * 16) decor.kelp.push({ x, s: .6 + R() * .7, a: R() * TAU });
    for (const x of [Wd.shoreL + 90, Wd.shoreL + 250, Wd.shoreX - 90]) decor.logs.push({ x: x + (R() - .5) * 30, w: 46 + R() * 40, seed: (R() * 997) | 0, a: (R() - .5) * .15 });
  }

  /* ---------- the northern lights: green and violet curtains that ripple ---------- */
  function drawAurora(c, w, horizon, time, k) {
    if (k <= .01) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band++) {
      const base = horizon * (.3 + band * .12), hue = band === 1 ? [170, 120, 255] : [90, 255, 170];
      for (let x = -20; x < w + 20; x += 6) {
        const u = x / w, wave = Math.sin(u * 7 + time * .3 + band * 2) * 40 + Math.sin(u * 17 - time * .5 + band) * 14;
        const top = base - 60 - 90 * (.5 + .5 * Math.sin(u * 5 + time * .2 + band * 1.7)) + wave * .4;
        const bottom = base + 30 + wave * .5;
        const a = Math.min(.9, k * (.2 + .35 * Math.max(0, Math.sin(u * 11 + time * .7 + band * 3))) * (band === 1 ? .55 : 1));
        const g = c.createLinearGradient(0, top, 0, bottom);
        g.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},0)`); g.addColorStop(.75, `rgba(${hue[0]},${hue[1]},${hue[2]},${a})`); g.addColorStop(1, `rgba(${hue[0]},${hue[1]},${hue[2]},0)`);
        c.fillStyle = g; c.fillRect(x, top, 7, bottom - top);
      }
    }
    c.restore();
  }

  /* ---------- the frame ---------- */
  function skyColours(tod, season) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    let top = mixHex(a[1], b[1], t), bot = mixHex(a[2], b[2], t);
    if (DAYLIGHT === 'night') { const n = nightAmount(tod); top = mixHex('#14204a', '#060a22', n); bot = mixHex('#c88aa0', '#18284e', n); }
    if (DAYLIGHT === 'midsun' && (tod < .25 || tod > .78)) { top = mixHex('#4a6ab0', '#3a5aa0', .5); bot = '#ffc8a0'; }
    if (season === 'winter' || season === 'spring') bot = mixHex(bot, '#e8f0f8', .15);
    return [top, bot];
  }
  function frame(G, dt, clean) {
    const { cam, world: Wd, tod, time } = G, S = Wd.ground, weather = Wd.weather, p = G.player, season = Wd.season;
    const night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    updateCells(S);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    const view = cam.viewRect(80);

    /* --- sky --- */
    let [top, bot] = skyColours(tod, season);
    if (weather.cloud > .01) { top = mixHex(top, '#4a5460', weather.cloud * .55); bot = mixHex(bot, '#a8b0b8', weather.cloud * .5); }
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, top); sky.addColorStop(1, bot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const horizon = clamp(H * .52 - (cam.y + 60) * cam.zoom * .08, H * .25, H * .85);
    if (night > .05 && weather.cloud < .85) {
      for (const [sx, sy, r, ph] of stars) {
        const y = sy * horizon; if (y > horizon - 10) continue;
        ctx.globalAlpha = night * (0.3 + .7 * (.5 + .5 * Math.sin(time * 2 + ph * 6))) * (1 - weather.cloud);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * W, y, .5 + r * 1.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawAurora(ctx, W, horizon, time, Wd.aurora * night * 2.2);
    drawSunMoon(G, tod, night, horizon, weather.cloud);
    /* the far hills (parallax), snowy or bare with the season, tinted by the light */
    const snowy = S.snowOn ? 1 : 0;
    layers.forEach((L, li) => {
      const z = Math.min(1, cam.zoom) * (.5 + li * .14);
      const w = L.snow.width * z, h = L.snow.height * z;
      const y = horizon - h * .6 + li * 30 * z + Math.max(0, (cam.y + 300)) * cam.zoom * .06 * (li + 1) * .2;
      let x0 = (-(cam.x * cam.zoom * L.par) % w) - w; while (x0 > -w) x0 -= w;
      ctx.save();
      ctx.filter = quality === 'low' ? 'none' : `brightness(${lerp(1, .34 + li * .04, night)})`;
      const img = snowy ? L.snow : L.bare;
      for (let x = x0; x < W; x += w) ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      ctx.fillStyle = `rgba(220,232,246,${.13 * (1 - night * .6)})`; ctx.fillRect(0, y + h * .5, W, H);
    });
    ctx.filter = 'none';
    ctx.fillStyle = night > .5 ? (snowy ? '#43547e' : '#0c1420') : snowy ? '#d4e0ec' : cam.x > WORLD.shoreX - 200 ? '#5a84a4' : '#5a6a52'; ctx.fillRect(0, horizon + 80, W, H);

    /* ---------------- world space ---------------- */
    ctx.save();
    cam.apply(ctx);
    drawSeaBack(G, Wd, S, view, night, time);
    ctx.restore();

    drawCellLayer(G, S, view);

    ctx.save();
    cam.apply(ctx);
    drawRim(G, S, view);
    drawSeaFront(G, Wd, S, view, night, time);
    drawSurfaceDecor(G, Wd, S, view, night, season);
    for (const r of Wd.rocks) { if (r.x + 60 < view.l || r.x - 60 > view.r) continue; ctx.save(); ctx.translate(r.x, S.walkTop(r.x, 8) + 2); Sprites.drawRock(ctx, r); if (S.snowOn) { ctx.fillStyle = 'rgba(250,252,255,.9)'; ctx.beginPath(); ctx.ellipse(0, -r.h * .82, r.w * .32, r.h * .13, 0, Math.PI, TAU); ctx.fill(); } ctx.restore(); }
    for (const t of Wd.tracks) { if (t.x < view.l || t.x > view.r || Wd.inWater(t.x, S.walkTop(t.x, 4) + 2)) continue; const y = S.walkTop(t.x, 4) + .5; ctx.save(); ctx.translate(t.x, y); ctx.scale(1.1, .55); Sprites.drawTracks(ctx, t.kind, t.dir, t.seen ? 'rgba(90,110,140,.3)' : S.snowOn ? 'rgba(90,120,170,.65)' : 'rgba(50,40,30,.55)'); ctx.restore(); }
    drawHoles(G, Wd, S, view, time);
    /* a mother bear's fresh snow den on the hill (the boy's ending): a dark mouth in the drifted snow */
    if (Wd.pack.some(n => n.role === 'mother')) { const mx = Wd.den.x + 20, my = S.walkTop(mx, 10); ctx.save(); ctx.translate(mx, my + 2); ctx.fillStyle = 'rgba(250,252,255,.95)'; ctx.beginPath(); ctx.ellipse(0, -6, 26, 14, -.3, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#26364e'; ctx.beginPath(); ctx.ellipse(0, -3, 15, 9, -.3, Math.PI, TAU); ctx.fill(); ctx.restore(); }
    if (Wd.meal && !Wd.meal.taken) { const m = Wd.meal; ctx.save(); ctx.translate(m.x, m.y); Sprites.drawMeal(ctx, 1.2); ctx.restore(); }
    for (const e of Wd.herd) { if (e.x < view.l - 80 || e.x > view.r + 80) continue; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.dir * e.s * .6, e.s * .6); ctx.translate(0, -60); Sprites.drawCaribou(ctx, { s: 1, ph: e.ph, vx: e.vx, bull: e.bull }); ctx.restore(); }
    if (Wd.buggy) { const b = Wd.buggy; ctx.save(); ctx.translate(b.x, S.walkTop(b.x, 30) + 2); Sprites.drawBuggy(ctx, { s: 1.15, wave: b.wave }); ctx.restore(); }
    for (const f of Wd.foxes) if (f.x > view.l - 40 && f.x < view.r + 40) { ctx.save(); ctx.translate(f.x, f.y - 15 * .6); ctx.scale(f.dir, 1); Sprites.drawFox(ctx, { s: .6, ph: f.ph, state: f.state, summer: Wd.season === 'summer' || (!S.snowOn && Wd.season !== 'winter') }); ctx.restore(); }
    for (const h of Wd.hoppers) if (h.x > view.l && h.x < view.r) Sprites.drawHopper(ctx, h, time);
    if (Wd.bask && Wd.bask.state !== 'gone') { const b = Wd.bask; ctx.save(); ctx.translate(b.x, b.y + 1); ctx.fillStyle = '#1a3a5a'; ctx.beginPath(); ctx.ellipse(-b.dir * 30, 0, 9, 2.6, 0, 0, TAU); ctx.fill(); ctx.scale(b.dir, 1); Sprites.drawSeal(ctx, { s: .9, look: b.look, alpha: b.alpha }); ctx.restore(); }
    for (const n of Wd.pack) drawNPC(G, n, view);
    drawScents(G, Wd, view, time);
    drawPlayer(G, p, time);
    for (const q of Wd.cubs) drawNPC(G, q, view);
    G.particles.draw(ctx, cam);
    drawWaterOver(G, Wd, S, view, night, time);
    drawBelugas(G, Wd, view, time);
    drawWeather(G, Wd, view, weather, time);
    ctx.restore();

    /* ---------------- light ---------------- */
    if (weather.white > .02) { ctx.fillStyle = `rgba(232,240,250,${weather.white * .55})`; ctx.fillRect(0, 0, W, H); }
    const dark = Math.max(night * .74, weather.cloud * .22) * (p.underground ? .5 : 1);
    if (dark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${lerp(255, 66, dark) | 0},${lerp(255, 92, dark) | 0},${lerp(255, 156, dark) | 0})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    /* the aurora's green glow on the snow */
    if (Wd.aurora * night > .05 && S.snowOn) { ctx.fillStyle = `rgba(90,255,170,${.06 * Wd.aurora * night})`; ctx.fillRect(0, 0, W, H); }
    const warm = (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - weather.cloud) * (DAYLIGHT === 'night' ? 0 : 1);
    if (warm > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,150,90,${warm * .5})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (p.underground) {
      const [sx, sy] = cam.toScreen(p.x, p.y), rad = Math.max(W, H) * .5 * (p.age <= 1 && !p.flags.eyesOpen ? .5 : 1);
      const lg = ctx.createRadialGradient(sx, sy, rad * .14, sx, sy, rad);
      lg.addColorStop(0, 'rgba(10,16,30,0)'); lg.addColorStop(1, `rgba(8,14,28,${.5 + night * .2})`);
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
      if (p.age <= 1 && !p.flags.eyesOpen) { ctx.fillStyle = 'rgba(20,16,40,.35)'; ctx.fillRect(0, 0, W, H); }
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(4,8,18,${.26 + night * .18})`);
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
    if (view.b > WORLD.gridB) { ctx.fillStyle = '#34363a'; ctx.fillRect(view.l, WORLD.gridB - 1, view.r - view.l, view.b - WORLD.gridB + 1); }
    for (const [x0, x1] of [[view.l, WORLD.gridL], [WORLD.gridR, view.r]]) if (x1 > x0) { ctx.fillStyle = x0 >= WORLD.gridR ? '#4a5258' : '#5a4a3a'; ctx.beginPath(); ctx.moveTo(x0, view.b + 10); for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, S.surfaceAt(x)); ctx.lineTo(x1, view.b + 10); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, buf.width, buf.height);
    b.setTransform(DPR, 0, 0, DPR, 0, 0);
    b.save(); cam.apply(b);
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    b.drawImage(hi, ...src, ...dst);
    b.globalCompositeOperation = 'source-atop';
    b.globalAlpha = quality === 'low' ? .4 : .6; b.fillStyle = grainPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    b.globalAlpha = 1;
    b.restore(); b.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (quality !== 'low') { ctx.shadowColor = 'rgba(10,20,40,.45)'; ctx.shadowBlur = 6 * DPR * Math.min(2, cam.zoom); ctx.shadowOffsetX = 1 * DPR * cam.zoom; ctx.shadowOffsetY = 2 * DPR * cam.zoom; }
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  }

  /* the sun: an ordinary arc; at midsummer a low circle that never sets; at midwinter only a glow at noon */
  function drawSunMoon(G, tod, night, horizon, cloud) {
    const skyTop = horizon * .85;
    let sun = null;
    if (DAYLIGHT === 'midsun') { const a = (tod - .5) * TAU; sun = { x: W * (.5 + .38 * Math.sin(a)), y: horizon - Math.max(60, skyTop) * (.35 + .3 * Math.cos(a)) }; }
    else if (DAYLIGHT === 'night') { if (Math.abs(tod - .5) < .1) sun = { x: W * .5, y: horizon + 10, glow: true }; }
    else if (tod > .22 && tod < .82) { const t = invLerp(.22, .82, tod); sun = { x: W * (.1 + .8 * t), y: horizon - Math.sin(Math.PI * t) * Math.max(120, skyTop) * .8 + 10 }; }
    if (sun) {
      ctx.globalAlpha = 1 - cloud * .7;
      const g = ctx.createRadialGradient(sun.x, sun.y, 8, sun.x, sun.y, 240); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(.12, 'rgba(255,220,170,.5)'); g.addColorStop(1, 'rgba(255,190,140,0)');
      ctx.fillStyle = g; ctx.fillRect(sun.x - 240, sun.y - 240, 480, 480);
      if (!sun.glow) { ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(sun.x, sun.y, 26, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const t = tod > .5 ? invLerp(.78, 1.28, tod) : invLerp(-.22, .28, tod), x = W * (.15 + .7 * t), y = horizon - Math.sin(Math.PI * clamp(t, 0, 1)) * Math.max(120, skyTop) * .9 - 10;
      ctx.globalAlpha = night * (1 - cloud * .8);
      const g = ctx.createRadialGradient(x, y, 10, x, y, 220); g.addColorStop(0, 'rgba(220,235,255,.4)'); g.addColorStop(.2, 'rgba(160,190,255,.14)'); g.addColorStop(1, 'rgba(120,150,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, y - 220, 440, 440);
      drawMoonDisc(ctx, x, y, 28, G.moon);
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
  RIM[MAT.SOIL] = ['rgba(40,30,20,.45)', 'rgba(130,140,80,.85)']; RIM[MAT.ROCK] = ['rgba(60,60,64,.5)', 'rgba(210,210,214,.85)'];
  RIM[MAT.FROZEN] = RIM[MAT.SOIL]; RIM[MAT.GRAVEL] = ['rgba(60,60,56,.5)', 'rgba(206,202,192,.85)'];
  RIM[MAT.SNOW] = ['rgba(140,170,215,.45)', 'rgba(255,255,255,.95)']; RIM[MAT.ICE] = ['rgba(90,140,190,.5)', 'rgba(236,248,255,.95)'];
  RIM[MAT.DRIFT] = RIM[MAT.SNOW];
  function drawRim(G, S, view) {
    const x0 = Math.max(view.l, WORLD.gridL), x1 = Math.min(view.r, WORLD.gridR), step = Math.max(1.5, 6 / G.cam.zoom);
    if (x1 <= x0) return;
    const lw = 2.2 / G.cam.zoom;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      let cur = null;
      for (let x = x0; x <= x1; x += step) {
        const t0 = S.topAt(x);
        if (t0 > WORLD.seaY + 4 && S.isSea(x)) { if (cur) { ctx.stroke(); cur = null; } continue; }    /* open water: the seabed is under it */
        if (t0 > S.walkTop(x, 14) + 10) { if (cur) { ctx.stroke(); cur = null; } continue; }        /* an open den mouth or a seal's hole */
        const ys = [S.topAt(x - 8), S.topAt(x - 4), t0, t0, S.topAt(x + 4), S.topAt(x + 8)].filter(v => v < t0 + 10), y = ys.reduce((u, v) => u + v, 0) / ys.length, m = S.matAt(x, t0 + 2), col = (RIM[m] || RIM[MAT.ROCK])[pass], yy = y + (pass ? 0 : lw * 1.6);
        if (col !== cur) { if (cur) { ctx.lineTo(x, yy); ctx.stroke(); } cur = col; ctx.strokeStyle = col; ctx.lineWidth = pass ? lw : lw * 2.6; ctx.beginPath(); ctx.moveTo(x, yy); }
        else ctx.lineTo(x, yy);
      }
      if (cur) ctx.stroke();
    }
  }
  /* the sea: the water body behind the cells (so the seabed and the ice show over it) */
  const seaL = () => WORLD.shoreX - 120;
  function drawSeaBack(G, Wd, S, view, night, time) {
    if (view.r < seaL()) return;
    const x0 = Math.max(view.l, seaL()), x1 = view.r, y0 = WORLD.seaY;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 240); g.addColorStop(0, Wd.season === 'summer' ? 'rgba(60,130,170,.92)' : 'rgba(40,90,140,.92)'); g.addColorStop(1, 'rgba(10,30,60,.98)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    for (let x = x0; x <= x1 + 6; x += 6) ctx.lineTo(x, y0 + Math.sin(x * .05 + time * 1.6) * 1.2);
    ctx.lineTo(x1 + 6, WORLD.gridB + 40); ctx.lineTo(x0, WORLD.gridB + 40); ctx.closePath(); ctx.fill();
    /* light rays under open water */
    if (night < .5 && !S.iceOn) { ctx.fillStyle = 'rgba(200,240,255,.05)'; for (let k = 0; k < 8; k++) { const x = x0 + ((k * 211 + time * 6) % Math.max(1, x1 - x0)); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 20, y0); ctx.lineTo(x + 70, y0 + 200); ctx.lineTo(x + 40, y0 + 200); ctx.closePath(); ctx.fill(); } }
  }
  /* ripples and glints on open water */
  function drawSeaFront(G, Wd, S, view, night, time) {
    if (view.r < seaL()) return;
    const y0 = WORLD.seaY, x0 = Math.max(view.l, seaL());
    ctx.strokeStyle = `rgba(230,250,255,${.6 - night * .3})`; ctx.lineWidth = 1.6 / Math.max(.6, G.cam.zoom) * 1.5;
    let on = false;
    ctx.beginPath();
    for (let x = x0; x <= view.r; x += 4) {
      const open = Wd.openWater(x) && Wd.openWater(x - 14) && Wd.openWater(x + 14), y = y0 + Math.sin(x * .05 + time * 1.6) * 1.2;
      if (open) { if (!on) ctx.moveTo(x, y); else ctx.lineTo(x, y); on = true; } else on = false;
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${.35 - night * .2})`;
    for (let k = 0; k < 30; k++) { const x = x0 + ((k * 97 + time * 18) % Math.max(1, view.r - x0)), y = y0 + 3 + (k % 5) * 6; if (Wd.openWater(x)) ctx.fillRect(x, y, 8 + (k % 3) * 4, 1); }
  }
  /* the water's tint over anything swimming (only where the sea is open) */
  function drawWaterOver(G, Wd, S, view, night, time) {
    if (view.r < seaL()) return;
    const y0 = WORLD.seaY, x0 = Math.max(view.l, seaL());
    const tg = ctx.createLinearGradient(0, y0, 0, y0 + 160); tg.addColorStop(0, `rgba(30,100,160,${.5 + night * .1})`); tg.addColorStop(.35, 'rgba(30,90,150,.35)'); tg.addColorStop(1, 'rgba(20,60,120,0)');
    ctx.fillStyle = tg;
    let start = null;
    const flush = (xEnd) => { if (start === null) return; ctx.beginPath(); ctx.moveTo(start, y0); for (let x = start; x <= xEnd; x += 6) ctx.lineTo(x, y0 + Math.sin(x * .05 + time * 1.6) * 1.2); ctx.lineTo(xEnd, y0 + 160); ctx.lineTo(start, y0 + 160); ctx.closePath(); ctx.fill(); start = null; };
    for (let x = x0; x <= view.r + 6; x += 6) { const open = Wd.openWater(x) && Wd.openWater(x - 14) && Wd.openWater(x + 14); if (open && start === null) start = x; else if (!open && start !== null) flush(x); }
    flush(view.r + 6);
  }
  /* the seals' breathing holes in the ice: a dark round hole, a puff of breath, a seal's head */
  function drawHoles(G, Wd, S, view, time) {
    if (!S.iceOn || S.iceMode === 'floes') return;
    for (const h of Wd.holes) {
      if (h.x < view.l - 40 || h.x > view.r + 40) continue;
      const y = S.walkTop(h.x, 14);
      ctx.save(); ctx.translate(h.x, y + 1);
      ctx.fillStyle = 'rgba(200,226,246,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#123050'; ctx.beginPath(); ctx.ellipse(0, .5, 9, 2.6, 0, 0, TAU); ctx.fill();
      if (h.up > 0) { ctx.save(); const rise = clamp(Math.min(1.8 - h.up, h.up) * 3, 0, 1); ctx.translate(0, 9 - rise * 9); ctx.beginPath(); ctx.rect(-14, -30, 28, 30); ctx.clip(); Sprites.drawSeal(ctx, { s: .9, head: true }); ctx.restore(); }
      if (h.puff > 0) { ctx.fillStyle = `rgba(240,248,255,${h.puff * .6})`; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-3 + k * 3, -18 - (1 - h.puff) * 16 - k * 3, 3 + (1 - h.puff) * 5, 0, TAU); ctx.fill(); } }
      if (h.splash) { ctx.strokeStyle = `rgba(220,240,255,${h.splash})`; ctx.lineWidth = 1.4; for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + (k - 1.5) * .5; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(Math.cos(a) * 10 * (1.2 - h.splash), -1 + Math.sin(a) * 10 * (1.2 - h.splash)); ctx.stroke(); } }
      ctx.restore();
    }
  }
  function drawBelugas(G, Wd, view, time) {
    for (const w of Wd.belugas) {
      if (w.x < view.l - 60 || w.x > view.r + 60) continue;
      const u = (w.t % w.period) / 1.6; if (u > 1 || !Wd.openWater(w.x)) continue;
      ctx.save(); ctx.translate(w.x, WORLD.seaY + 4); Sprites.drawBeluga(ctx, { s: .7, u, dir: w.dir }); ctx.restore();
    }
  }
  function drawSurfaceDecor(G, Wd, S, view, night, season) {
    if (!decor) return;
    const time = G.time, wind = Wd.weather.gust, snowOn = S.snowOn;
    const gcol = season === 'summer' ? ['#9aaa5a', '#b8b860'] : season === 'autumn' ? ['#c8904a', '#d8a860'] : ['#a8a888', '#b8b898'];
    const ok = (x) => !(S.topAt(x) > S.walkTop(x, 14) + 8) && !S.isSea(x);
    for (const st of decor.stones) {
      if (st.x < view.l - 20 || st.x > view.r + 20 || !ok(st.x)) continue;
      const y = S.walkTop(st.x, 3) + 1, R = mulberry32(st.seed), r = 4 + R() * 7 * st.s;
      if (snowOn && R() < .6) continue;
      const g = ctx.createLinearGradient(0, y - r, 0, y); g.addColorStop(0, '#b2b0ac'); g.addColorStop(1, '#5e6064');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(st.x, y, r, r * .6, 0, Math.PI, TAU); ctx.fill();
      if (snowOn) { ctx.fillStyle = 'rgba(250,252,255,.9)'; ctx.beginPath(); ctx.ellipse(st.x, y - r * .5, r * .85, r * .22, 0, Math.PI, TAU); ctx.fill(); }
    }
    if (!snowOn) {
      for (const lg of decor.logs) {
        if (lg.x + lg.w < view.l || lg.x - lg.w > view.r) continue;
        const y = S.walkTop(lg.x, 6) + 1;
        ctx.save(); ctx.translate(lg.x, y - 5); ctx.rotate(lg.a);
        const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#c8bca8'); g.addColorStop(1, '#7a6e5e');
        ctx.fillStyle = g; rr(ctx, -lg.w / 2, -5, lg.w, 10, 5); ctx.fill(); ctx.fillStyle = '#d8ccb4'; ctx.beginPath(); ctx.ellipse(lg.w / 2, 0, 3, 5, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      for (const k of decor.kelp) {
        if (k.x < view.l || k.x > view.r) continue;
        const y = S.walkTop(k.x, 3) + .5; ctx.strokeStyle = '#4a5a2a'; ctx.lineWidth = 1.6 * k.s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(k.x - 6 * k.s, y); ctx.bezierCurveTo(k.x - 2, y - 3 * k.s, k.x + 2, y + 2, k.x + 7 * k.s, y - 1); ctx.stroke();
      }
      for (const g2 of decor.grass) {
        if (g2.x < view.l || g2.x > view.r || !ok(g2.x)) continue;
        const y = S.walkTop(g2.x, 3) + 1; ctx.strokeStyle = gcol[g2.k < .5 ? 0 : 1]; ctx.lineWidth = 1;
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(g2.x + k * 1.5, y); ctx.quadraticCurveTo(g2.x + k * 2.5 + Math.sin(time * 1.4 + g2.ph) * 2, y - 5 * g2.s, g2.x + k * 3.5 + Math.sin(time * 1.2 + g2.ph) * 3 * (1 + wind), y - 8 * g2.s); ctx.stroke(); }
      }
      /* bearberry and dwarf willow leaves turn red and gold in autumn */
      for (const b of decor.berries) {
        if (b.x < view.l || b.x > view.r || !ok(b.x)) continue;
        const y = S.walkTop(b.x, 3) + .5;
        ctx.fillStyle = season === 'autumn' ? (b.a < .6 ? '#c83a2a' : '#e8a020') : '#5a7a3a';
        ctx.beginPath(); ctx.ellipse(b.x, y - 1.5 * b.s, 3.4 * b.s, 1.8 * b.s, 0, 0, TAU); ctx.fill();
      }
      if (season === 'summer') {
        for (const f of decor.flowers) {
          if (f.x < view.l || f.x > view.r || !ok(f.x)) continue;
          const y = S.walkTop(f.x, 3) - 7 * f.s + Math.sin(time + f.ph) * .5; ctx.strokeStyle = '#5a7a3a'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(f.x, y + 7 * f.s); ctx.lineTo(f.x, y); ctx.stroke();
          ctx.fillStyle = f.col; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 1.7 * f.s, y + Math.sin(a) * 1.7 * f.s, 1.2 * f.s, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.arc(f.x, y, .8 * f.s, 0, TAU); ctx.fill();
        }
        /* cotton grass: white tufts on stalks */
        for (const c of decor.cotton) {
          if (c.x < view.l || c.x > view.r || !ok(c.x)) continue;
          const y = S.walkTop(c.x, 3); ctx.strokeStyle = '#7a8a4a'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(c.x, y); ctx.lineTo(c.x + Math.sin(time + c.ph) * 1.5, y - 12 * c.s); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(c.x + Math.sin(time + c.ph) * 1.5, y - 13 * c.s, 2.6 * c.s, 0, TAU); ctx.fill();
        }
      }
    } else {
      /* dry grass poking through the snow */
      for (const g2 of decor.grass) { if (g2.x < view.l || g2.x > view.r || g2.k > .2 || !ok(g2.x)) continue; const y = S.walkTop(g2.x, 3); ctx.strokeStyle = '#b8a878'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g2.x, y + 1); ctx.lineTo(g2.x + 2, y - 5 * g2.s); ctx.stroke(); }
    }
  }
  function drawScents(G, Wd, view, time) {
    for (const s of Wd.scents) {
      if (s.x < view.l - 40 || s.x > view.r + 40) continue;
      const k = SCENT_KINDS[s.kind], a = s.sniffed ? clamp(1 - (s.t - s.sniffedAt) / 1.5, 0, 1) : clamp(s.t * .5, 0, 1) * clamp((s.life - s.t) / 4, 0, 1);
      ctx.strokeStyle = k.col; ctx.lineCap = 'round'; ctx.globalAlpha = a * .8;
      for (let j = 0; j < 3; j++) { ctx.lineWidth = 2.4 - j * .5; ctx.beginPath(); const x0 = s.x + (j - 1) * 6, ph = s.ph + j; ctx.moveTo(x0, s.y + 8); ctx.bezierCurveTo(x0 - 6 + Math.sin(time * 1.5 + ph) * 4, s.y, x0 + 6 + Math.sin(time * 1.2 + ph) * 4, s.y - 8, x0 + Math.sin(time + ph) * 5, s.y - 18 - j * 3); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
  /* the way another bear looks right now */
  function npcPose(G, n) {
    const age = Sprites.ageOf(n.kg);
    return {
      s: n.len / 100, form: n.form, age, sex: n.sex, walk: n.walk, t: G.time,
      moving: n.mode === 'walk' || n.mode === 'run' || n.mode === 'leave' || n.mode === 'play' && age < .5, run: n.mode === 'run',
      sit: n.mode === 'sit', lie: n.mode === 'lie' || n.mode === 'nurse', curl: n.mode === 'lie' && n.inDen && n.role !== 'mum' && n.role !== 'owncub' && false, still: n.mode === 'still',
      stand: n.sniffT > 0 ? 1 : 0, spar: n.mode === 'spar' ? .8 + .2 * Math.sin(G.time * 3 + n.x) : n.mode === 'play' && age > .6 ? .9 : 0,
      swim: n.swimming, eyes: n.inDen && n.kg < 2 ? 0 : n.mode === 'lie' && n.inDen ? .4 : 1, collar: n.collar,
      snow: G.world.ground.snowOn && n.mode !== 'lie' ? .3 : 0, wet: n.swimming ? 1 : 0, mouth: n.chuff > 0 ? .5 : 0, seed: (n.kg * 13) | 0
    };
  }
  function drawNPC(G, n, view) {
    if (n.gone || n.carried || n.x < view.l - 120 || n.x > view.r + 120) return;
    ctx.save(); ctx.translate(n.x, n.y);
    if (n.spin) ctx.rotate(n.spin);
    else if (!n.inDen && !n.swimming) ctx.rotate(clamp(Math.atan(G.world.ground.slopeAt(n.x, Math.max(8, n.len * .3))), -1, 1) * (['lie', 'still', 'sit'].includes(n.mode) ? .85 : .6));
    if (n.mode === 'enter') ctx.globalAlpha = clamp(1 - (n.sink || 0), 0, 1);
    /* in the whiteout the family walks off into the snow: they fade from sight */
    if (G.world.lostMode && (n.role === 'mum' || n.role === 'twin')) ctx.globalAlpha = clamp(1 - (Math.abs(n.x - G.player.x) - 40) / 110, 0, 1);
    ctx.scale(n.face, 1);
    Sprites.drawBear(ctx, npcPose(G, n));
    ctx.restore();
  }
  function drawPlayer(G, p, time) {
    ctx.save();
    const glowR = p.w * .9 + 6;
    const gg = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, glowR);
    gg.addColorStop(0, `rgba(255,240,200,${.14 + G.night * .16})`); gg.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = gg; ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
    ctx.translate(p.x, p.y);
    if (p.mode === 'tossed') ctx.rotate(p.spin);
    else if (p.mode === 'walk' || p.mode === 'slide' || p.mode === 'stalk' || p.mode === 'still') ctx.rotate(p.ang);
    else if (p.mode === 'burrow' && !(p.flags.denMade && !p.moving)) { const tilt = clamp(Math.atan2(Math.sin(p.ang), Math.abs(Math.cos(p.ang))), -.9, .9) * (p.moving ? 1 : .5); ctx.rotate(p.face * tilt); }
    ctx.scale(p.face, 1);
    if (p.mode === 'sleep') ctx.globalAlpha = .92;
    const rest = p.mode === 'rest' || p.mode === 'sleep';
    const bk = p.busy > 0 ? p.busyKind : null;
    Sprites.drawBear(ctx, {
      s: p.w / 100, form: p.form, age: p.age01, sex: p.sex, walk: p.walk, moving: p.moving && p.mode !== 'slide', t: time,
      lie: rest || (p.mode === 'den' && !p.moving) || (p.mode === 'burrow' && p.flags.denMade && !p.moving) || bk === 'nurse', curl: rest, still: p.mode === 'still',
      stand: p.mode === 'sniff' || p.standT > 0 ? Math.max(p.standT, p.mode === 'sniff' ? .9 : 0) : 0,
      spar: p.mode === 'play' && p.age >= 4 ? .85 : 0, crouch: p.mode === 'stalk' ? 1 : bk === 'pounce' ? .6 : 0,
      sniff: bk === 'sniff' || bk === 'look' || bk === 'drink' || bk === 'eat' ? 1 : 0, swim: p.swimming, slide: p.mode === 'slide',
      eyes: p.age <= 1 && !p.flags.eyesOpen ? 0 : rest ? 0 : 1, snow: p.snowy, wet: p.wet, carry: p.carrying, carryForm: p.carryForm, seed: 11,
      mouth: bk === 'eat' ? .5 : p.mode === 'play' ? .4 : 0
    });
    ctx.restore();
  }
  function drawWeather(G, Wd, view, weather, time) {
    if (weather.rain > .03) {
      const n = Math.floor(weather.rain * (quality === 'low' ? 140 : 280));
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
      const n = Math.floor((quality === 'low' ? 90 : 180) * (1 + weather.white * .25));
      const drift = .01 + weather.white * .25;
      for (let k = 0; k < n && k < flakes.length; k++) {
        const f = flakes[k], x = view.l + ((f.x * 1.3 + Math.sin(time * .6 + f.ph) * .02 + time * drift * f.z) % 1 + 1) % 1 * (view.r - view.l), yy = view.t + ((f.y + time * (.05 + weather.white * .05) * f.z) % 1 + 1) % 1 * (view.b - view.t);
        if (yy > Wd.ground.topAt(x)) continue;
        ctx.beginPath(); ctx.arc(x, yy, (1 + f.z * 1.6) / Math.max(.8, G.cam.zoom * .6), 0, TAU); ctx.fill();
      }
    }
  }

  /* ---------- overlays: play-fights, sniffing, keeping still, creeping, arrows, labels ---------- */
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
  function bar(u, col, label) {
    const bw = Math.min(420, W * .5), bx = W / 2 - bw / 2, by = H - 180;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, bx - 8, by - 8, bw + 16, 40, 20); ctx.fill();
    ctx.fillStyle = 'rgba(40,60,90,.9)'; rr(ctx, bx, by, bw, 24, 12); ctx.fill();
    if (u > .01) { ctx.fillStyle = col; rr(ctx, bx, by, Math.max(24, bw * u), 24, 12); ctx.fill(); }
    ctx.font = `900 12px ${UI_FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, W / 2, by + 12);
    return by;
  }
  function drawOverlays(G, night, time) {
    const p = G.player, cam = G.cam, Wd = G.world, S = Wd.ground;
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
      ctx.save(); ctx.translate(mk - 2, by + 12); ctx.scale(.22, .22); Sprites.drawBear(ctx, { s: 1, form: p.form, age: p.age01 }); ctx.restore();
      bigText(w.done === 'win' ? 'YOU WIN!' : w.done === 'lose' ? 'ROLL OVER!' : ok ? (G.settings.pad ? 'BIG PUSH!  (💥)' : 'BIG PUSH!  (E / ▲)') : (G.settings.pad ? 'PUSH!' : 'PUSH!  (Space)'), W / 2, by + 56, ok);
    }
    if (p.mode === 'sniff' && p.sw) {
      const h = p.sw, [sx, sy] = cam.toScreen(p.x + p.face * p.w * .3, p.y - p.h * 1.5), ok = p.sniffWindow();
      ringMeter(G, sx, sy, h.held ? (h.ring % SNIFF_RING) / SNIFF_RING : 0, ok && h.held, h.flash);
      const need = G.diff().sniffs, by = H - 160;
      for (let k = 0; k < need; k++) { ctx.fillStyle = k < h.good ? '#7fd0ff' : 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(W / 2 - (need - 1) * 14 + k * 28, by - 22, 9, 0, TAU); ctx.fill(); }
      bigText(h.held ? (ok ? 'LET GO NOW!' : 'Sniff… sniff…') : G.settings.pad ? 'HOLD SNIFF' : 'HOLD E TO SNIFF', W / 2, by + 20, ok && h.held);
      if (h.flash > 0) { ctx.strokeStyle = `rgba(200,235,255,${h.flash})`; ctx.lineWidth = 3; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(W - 60, H * .4, k * 18 + (1 - h.flash) * 30, Math.PI * .6, Math.PI * 1.4); ctx.stroke(); } }
    }
    if (p.mode === 'still' && p.st) {
      const s = p.st, by = bar(s.q, s.shh > 0 ? '#ff9a6a' : '#7fd0ff', 'KEEP STILL');
      bigText(s.done ? 'A seal! …and it slipped away.' : s.shh > 0 ? 'Shh! Keep still…' : 'Do not move… wait for the seal', W / 2, by + 56, !!s.done);
      const [hx, hy] = cam.toScreen(s.hole.x, S.walkTop(s.hole.x, 14) - 4);
      if (!s.done && s.q > .4) { ctx.fillStyle = `rgba(220,240,255,${(s.q - .4) * 1.4})`; for (let k = 0; k < 3; k++) { const u = (time * .8 + k / 3) % 1; ctx.beginPath(); ctx.arc(hx + Math.sin(k * 3 + time * 2) * 4, hy - u * 26, 2 + u * 2, 0, TAU); ctx.fill(); } }
    }
    if (p.mode === 'stalk' && p.sk && Wd.bask) {
      const k = p.sk, b = Wd.bask, d = Math.abs(b.x - p.x), u = clamp(1 - (d - p.w * .5 - 22) / Math.max(1, k.start - p.w * .5 - 22), 0, 1);
      const looking = b.look > .55;
      const by = bar(u, looking ? '#ff6a5a' : '#8fe07a', looking ? 'FREEZE!' : 'CREEP');
      bigText(k.done === 'saw' ? 'It saw you! Splash!' : k.done === 'close' ? 'So close! It slipped away.' : looking ? 'It is looking: FREEZE!' : 'Head down: creep closer (hold ▶)', W / 2, by + 56, !looking && !k.done);
      /* the seal's eye: open when it looks */
      const [ex, ey] = cam.toScreen(b.x, b.y - 30);
      ctx.save(); ctx.translate(ex, ey - 26); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 18, 11 * (.15 + b.look * .85), 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (b.look > .2) { ctx.fillStyle = '#1a2a3a'; ctx.beginPath(); ctx.arc(0, 0, 6 * b.look, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    /* arrows to where you are going */
    const mum = Wd.mum();
    if (p.mode === 'den' && mum && Math.hypot(mum.x - p.x, mum.y - p.y) > 30) pointTo(G, mum.x, mum.y, '#ffd0e0', time);
    if (p.mode === 'walk') {
      if (p.sex === 'girl' && p.flags.cubsBorn && Wd.cubs.some(q => q.wandered && !q.inDen)) { const q = Wd.cubs.find(q => q.wandered); pointTo(G, q.x, q.y, '#ffd0e0', time); }
      else if (Wd.meal && !Wd.meal.taken) pointTo(G, Wd.meal.x, Wd.meal.y, '#ffe9a0', time);
      else if (mum && mum.nurseOn && p.age <= 4 && Math.abs(mum.x - p.x) > 50) pointTo(G, mum.x, mum.y, '#ffd0e0', time);
      else if (Wd.weather.state === 'blizzard' && p.age <= 3 && Wd.phase === 'trek' && p.shade !== 'lee') { const s = Wd.nearestShelter(p.x); if (s) pointTo(G, s.x, s.y - 20, '#a8e0ff', time); }
      else if ((Wd.phase === 'trek' || Wd.phase === 'breakup') && mum && Math.abs(mum.x - p.x) > 200 && !p.flags.lostMum) pointTo(G, mum.x, mum.y, '#b7f07a', time);
      else if (Wd.phase === 'ice' && !p.flags.feasted && p.stats.waits === 0) { const h = Wd.holes[0]; if (Math.abs(h.x - p.x) > 40) pointTo(G, h.x, S.walkTop(h.x, 14), '#7fd0ff', time); }
      else if ((Wd.phase === 'ice' && !p.flags.feasted || Wd.phase === 'ice2' && !p.flags.soloStalk) && Wd.bask && Wd.bask.state === 'bask' && Math.abs(Wd.bask.x - p.x) > 380) pointTo(G, Wd.bask.x, Wd.bask.y - 10, '#7fd0ff', time);
      else if (Wd.phase === 'ice2' && !p.flags.soloWait) { const h = Wd.holes.filter(h => Math.abs(h.x - (mum ? mum.x : 0)) > 80).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; if (h && Math.abs(h.x - p.x) > 40) pointTo(G, h.x, S.walkTop(h.x, 14), '#7fd0ff', time); }
      else if (Wd.phase === 'shore' && Wd.buggy && !Wd.buggy.met) pointTo(G, Wd.buggy.x, S.walkTop(Wd.buggy.x, 20) - 40, '#ffe9a0', time);
      else if (Wd.phase === 'alone' && !p.flags.sparred) pointTo(G, WORLD.sparX, S.walkTop(WORLD.sparX, 20) - 30, '#ffe9a0', time);
      else if (Wd.phase === 'adult' && Wd.mate() && !p.flags.met) pointTo(G, Wd.mate().x, Wd.mate().y, '#ff9ad0', time);
      else if (Wd.phase === 'adult' && p.sex === 'boy' && p.flags.met && !p.flags.sparBig) { const b = Wd.pack.find(n => n.role === 'bigmale'); if (b) pointTo(G, b.x, b.y, '#ffe9a0', time); }
      else if (p.flags.denTime && !p.flags.denMade && (p.x < WORLD.bankL || p.x > WORLD.bankR)) pointTo(G, (WORLD.bankL + WORLD.bankR) / 2, S.surfaceAt((WORLD.bankL + WORLD.bankR) / 2) - 10, '#ffe9a0', time);
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
    for (const n of Wd.pack) if (!n.inDen && Math.abs(n.x - p.x) < (Wd.lostMode && (n.role === 'mum' || n.role === 'twin') ? 120 : 500)) tag(n.x, n.y - n.h - 8, { mum: 'Mum (radio collar)', twin: 'twin', young: 'young male', mate: 'another bear', bigmale: 'big male', mother: 'a mother bear' }[n.role] || 'polar bear');
    for (const q of Wd.cubs) if (!q.inDen && Math.abs(q.x - p.x) < 400) tag(q.x, q.y - q.h - 8, 'cub');
    for (const e of Wd.herd) if (Math.abs(e.x - p.x) < 500) tag(e.x, e.y - 60, 'caribou');
    for (const f of Wd.foxes) if (Math.abs(f.x - p.x) < 300) tag(f.x, f.y - 30, 'Arctic fox');
    for (const h of Wd.hoppers) if (Math.abs(h.x - p.x) < 120 && h.hidden <= 0) tag(h.x, h.y - 12, h.kind === 'lemming' ? 'lemming' : 'snow bunting');
    for (const s of Wd.scents) if (Math.abs(s.x - p.x) < 300 && !s.sniffed) tag(s.x, s.y - 24, SCENT_KINDS[s.kind].name + ' scent');
    for (const t of Wd.tracks) if (Math.abs(t.x - p.x) < 300) tag(t.x, S.walkTop(t.x, 4) - 10, t.seen ? TRACK_KINDS[t.kind].name + ' tracks' : 'tracks');
    if (S.iceOn && S.iceMode !== 'floes') for (const h of Wd.holes) if (Math.abs(h.x - p.x) < 300) tag(h.x, S.walkTop(h.x, 14) - 30, 'breathing hole');
    if (Wd.bask && Wd.bask.state !== 'gone' && Math.abs(Wd.bask.x - p.x) < 500) tag(Wd.bask.x, Wd.bask.y - 34, 'ringed seal');
    if (Wd.buggy && Math.abs(Wd.buggy.x - p.x) < 500) tag(Wd.buggy.x, S.walkTop(Wd.buggy.x, 20) - 140, 'scientists\' tundra buggy');
    for (const w of Wd.belugas) if (Math.abs(w.x - p.x) < 400 && Wd.openWater(w.x)) tag(w.x, WORLD.seaY - 24, 'beluga');
    for (const r of Wd.rocks) if (r.big && Math.abs(r.x - p.x) < 400) tag(r.x, r.y - r.h - 18, 'big rock');
    if (S.iceMode === 'solid') { for (const rx of WORLD.ridges) if (Math.abs(rx - p.x) < 400) tag(rx, S.walkTop(rx, 10) - 30, 'pressure ridge'); if (Math.abs((WORLD.leadL + WORLD.leadR) / 2 - p.x) < 400) tag((WORLD.leadL + WORLD.leadR) / 2, WORLD.seaY - 24, 'lead'); }
  }

  function snapshot(G) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    frame(G, 0, true);
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }
  function invalidate() { builtFor = null; }

  return { init, resize, setQuality, getFps, frame, snapshot, invalidate, skyColours, drawMoonDisc, drawAurora };
})();
