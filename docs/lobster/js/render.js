/* ============================================================
   render.js — the Gulf of Maine, back to front
   ============================================================
     the sky above the surface (time of day, weather, stars, the
     sun, the moon in its real phase, snow in winter), the far
     shore with its spruce and a lighthouse, the far sea
     THE SEA you are in: blue getting darker with depth, light rays
     from the surface by day, far boulders and kelp in blue haze,
     specks of marine snow, shoals turning far away
     THE SEA FLOOR in cross-section (mud, clay, sand, bedrock,
     cobbles, gravel, mussel beds), painted from cells at 4x with
     smooth edges (Ant Kingdom's method), dug dens showing dark
     sand behind them
     kelp behind, mussels, sea stars, anemones, coralline pink on
     the rocks, the boat and its trap, shed shells, food, the
     walking crowds, the hunters, other lobsters, YOU, the sea's
     visitors, kelp in front, the cobbles you hide under (in front
     of you, with you peeking through)
     the water's tint and the bright underside of the surface
     night (a moonlit multiply) · glowing plankton (additive)
     overlays: the boxing ring and meter, the swell meter for the
     larvae, arrows to where you are going, name tags
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
  const stars = [], snow = [], flakes = [];
  let layers = [];
  let lo = null, loImg = null, hi = null, hiCtx = null, back = null, backCtx = null, smooth = null;
  let buf = null, bufCtx = null, grainPat = null, grain = null;
  let builtFor = null, decor = null;
  const crowdCache = new Map();
  /* the painted art goes with the WebGL look (?gfx=gl); the classic sprites everywhere else */
  const noPaint = (() => { try { return new URLSearchParams(location.search).get('paint') === '0'; } catch (e) { return false; } })();
  const painting = () => !noPaint && typeof Painted !== 'undefined' && typeof GFX !== 'undefined' && GFX.active();
  const lobArt = () => (painting() ? Painted : Sprites);

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
      for (let k = 0; k < sp.kelp; k++) { const x = R() * w, h = sp.h * (.4 + R() * .55); for (const dx of [-w, 0, w]) { g.beginPath(); g.moveTo(x + dx, sp.h); for (let j = 0; j <= 8; j++) { const u = j / 8; g.lineTo(x + dx + Math.sin(u * 6 + k) * 14 + 8 * (1 - u), sp.h - h * u); } for (let j = 8; j >= 0; j--) { const u = j / 8; g.lineTo(x + dx + Math.sin(u * 6 + k) * 14 - 8 * (1 - u), sp.h - h * u); } g.fill(); } }
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
    if (m === MAT.ROCK) { f *= 1 + Math.sin(x * .31 + Math.sin(y * .2) * 2) * .05 - (((c * 7 + r * 13) % 11) === 0 ? .18 : 0); if (depth > 30) f *= 1 - clamp((depth - 30) / 300, 0, .45); if (x > WORLD.ledgeL) { R = lerp(R, 120, .3); Gc = lerp(Gc, 100, .3); B = lerp(B, 80, .3); } }
    if (m === MAT.COBBLE) { f *= .92 + Math.sin(x * .7 + y * .5) * .08; const pink = smoothstep(.5, .8, t) * .5; R = lerp(R, 190, pink); Gc = lerp(Gc, 120, pink); B = lerp(B, 140, pink); }
    if (m === MAT.SAND || m === MAT.MUD || m === MAT.CLAY || m === MAT.GRAVEL) { f *= 1 - clamp(depth / 300, 0, 1) * .4; if (m === MAT.SAND && depth < 7) { R = lerp(R, 150, .4); Gc = lerp(Gc, 150, .4); B = lerp(B, 120, .4); } }
    if (m === MAT.SHELL) { const live = t; R = lerp(26, 60, live); Gc = lerp(24, 56, live); B = lerp(44, 96, live); f *= 1 + Math.sin(x * 1.1 + y * .9) * .12; }
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
  function buildDecor(S) {
    const R = mulberry32(S.seed + 9);
    decor = { stars: [], anem: [], mussels: [], weed: [], shells: [], worms: [], barn: [] };
    for (let k = 0; k < 40; k++) { const x = lerp(WORLD.cobbleL - 300, WORLD.ledgeR, R()); decor.stars.push({ x, s: .6 + R() * .8, col: pick(['#e07a3a', '#c85a8a', '#d8a040', '#8a4ab0']), a: R() * TAU }); }
    for (let k = 0; k < 30; k++) { const x = lerp(WORLD.cobbleL, WORLD.ledgeR, R()); decor.anem.push({ x, s: .6 + R() * .8, col: pick(['#f0e8e0', '#ffd8c0', '#e8c0d8']), ph: R() * TAU }); }
    for (let x = WORLD.kelpL; x < WORLD.ledgeR; x += 4 + R() * 5) { if (S.matAt(x, S.surfaceAt(x) + 3) !== MAT.SHELL) continue; decor.mussels.push({ x, s: .7 + R() * .6, a: R() * TAU }); }
    for (let k = 0; k < 120; k++) { const x = lerp(WORLD.cobbleL - 200, WORLD.ledgeR + 100, R()); decor.weed.push({ x, s: .5 + R() * 1, ph: R() * TAU, col: R() < .5 ? '#3a7a4a' : '#7a6a2a' }); }
    for (let k = 0; k < 60; k++) { const x = lerp(WORLD.gridL + 100, WORLD.ledgeR, R()); decor.shells.push({ x, s: .5 + R() * .8, a: R() * TAU, col: pick(['#e8e0d0', '#d0c0b0', '#f0e8f0', '#c8b8a0']) }); }
    for (let k = 0; k < 40; k++) { const x = lerp(WORLD.gridL + 60, WORLD.slopeR + 200, R()); decor.worms.push({ x, s: .6 + R() * .6, ph: R() * TAU }); }
    for (let k = 0; k < 50; k++) { const x = lerp(WORLD.ledgeL, WORLD.walkR, R()); decor.barn.push({ x, n: 3 + (R() * 5 | 0), s: .6 + R() * .5 }); }
  }

  /* a crowd lobster, pre-drawn for speed (form, size, sex, walking frame) */
  function crowdSprite(form, px, male, frame) {
    const painted = painting() && Painted.lobsterReady({ form, sex: male ? 'boy' : 'girl' });
    const key = `${form}|${px}|${male}|${frame}|${painted ? 1 : 0}`;
    let c = crowdCache.get(key); if (c) return c;
    c = document.createElement('canvas'); const w = Math.ceil(px * 2.3), h = Math.ceil(px * .7); c.width = w * 2; c.height = h * 2;
    const g = c.getContext('2d'); g.scale(2, 2); g.translate(w / 2 - px * .1, px * .3);
    (painted ? Painted : Sprites).drawLobster(g, { s: px / 100, form, sex: male ? 'boy' : 'girl', walk: frame / 6 * TAU, moving: true, seed: frame + 2, crusher: 'right', simple: px < 24 });
    crowdCache.set(key, c);
    if (crowdCache.size > 400) crowdCache.delete(crowdCache.keys().next().value);
    return c;
  }
  function drawCrowdLob(x, y, w, form, male, ph, face) {
    /* painted crowds come in size steps of about 15 % (each step is a set of painted frames), scaled to fit */
    const px0 = Math.max(6, Math.round(w)), px = painting() ? Math.round(Math.pow(1.15, Math.round(Math.log(px0) / Math.log(1.15)))) : px0;
    const frame = ((Math.floor(ph) % 6) + 6) % 6, img = crowdSprite(form, px, male, frame), k = px0 / px;
    const iw = img.width / 2 * k, ih = img.height / 2 * k;
    ctx.save(); ctx.translate(x, y); ctx.scale(face, 1); ctx.drawImage(img, -iw / 2 + px0 * .1, -px0 * .3, iw, ih); ctx.restore();
  }

  /* ---------- the frame ---------- */
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  const SEA_STOPS = [[0, [74, 170, 206]], [60, [34, 118, 176]], [180, [16, 76, 136]], [360, [8, 40, 88]], [560, [4, 20, 48]], [800, [2, 8, 22]]];
  function seaCol(y) { let i = 0; while (i < SEA_STOPS.length - 2 && SEA_STOPS[i + 1][0] <= y) i++; const a = SEA_STOPS[i], b = SEA_STOPS[i + 1]; return mixRgb(a[1], b[1], clamp((y - a[0]) / (b[0] - a[0]), 0, 1)); }
  function frame(G, dt, clean) {
    const { cam, world: Wd, tod, time } = G, S = Wd.ground, weather = Wd.weather, p = G.player;
    const night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    updateCells(S);
    /* the WebGL look (?gfx=gl): the world is drawn as usual into a transparent layer; GFX paints the
       water, the sky and the light, and only the glows and the overlays stay on this canvas */
    const gx = typeof GFX !== 'undefined' && GFX.active(), mainCtx = ctx;
    if (gx && typeof Painted !== 'undefined') Painted.beginFrame();
    if (gx) { ctx = GFX.worldCtx(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    const view = cam.viewRect(80);
    const seaSY = cam.toScreen(0, Wd.seaLevel())[1];
    const winter = Wd.season === 'winter';

    /* --- the sea body fills the screen, darker with depth --- */
    const topDepth = Math.max(0, view.t), botDepth = Math.max(topDepth + 10, view.b);
    if (!gx) {
    const sea = ctx.createLinearGradient(0, cam.toScreen(0, topDepth)[1], 0, cam.toScreen(0, Math.min(botDepth, 820))[1]);
    for (const [d] of SEA_STOPS) { const u = clamp((d - topDepth) / (Math.min(botDepth, 820) - topDepth), 0, 1); sea.addColorStop(u, rgbStr(mixRgb(seaCol(d), [8, 20, 40], night * .6 + (winter ? .1 : 0)))); }
    ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
    }

    /* --- the sky above the surface, when the camera sees it --- */
    let [top, bot] = skyColours(tod);
    if (weather.cloud > .01) { top = mixHex(top, '#3a4450', weather.cloud * .6); bot = mixHex(bot, '#7a8a90', weather.cloud * .55); }
    if (seaSY > -40) {
      if (!gx) {
      const sky = ctx.createLinearGradient(0, 0, 0, Math.max(60, seaSY));
      sky.addColorStop(0, top); sky.addColorStop(1, bot);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, Math.max(0, seaSY));
      if (night > .05 && weather.cloud < .85) {
        for (const [sx, sy, r, ph] of stars) {
          const y = sy * seaSY; if (y > seaSY - 10) continue;
          ctx.globalAlpha = night * (0.3 + .7 * (.5 + .5 * Math.sin(time * 2 + ph * 6))) * (1 - weather.cloud);
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * W, y, .5 + r * 1.2, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      drawSunMoon(G, tod, night, seaSY, weather.cloud);
      }
      drawFarShore(G, seaSY, night, winter);
      if (weather.snow > .02 && seaSY > 0) drawFlakes(G, seaSY, dt);
      /* the surface's silver underside and crests, seen from below or above */
      ctx.save(); cam.apply(ctx);
      if (!gx) {
      ctx.strokeStyle = `rgba(240,250,255,${.8 - night * .4})`; ctx.lineWidth = 1.6 / Math.max(.6, cam.zoom) * 2;
      ctx.beginPath(); for (let x = view.l; x <= view.r; x += 5) { const y = Wd.surfaceY(x); x === view.l ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      ctx.fillStyle = `rgba(200,235,255,${.18 * (1 - night * .5)})`;
      ctx.beginPath(); ctx.moveTo(view.l, Wd.surfaceY(view.l)); for (let x = view.l; x <= view.r; x += 5) ctx.lineTo(x, Wd.surfaceY(x)); ctx.lineTo(view.r, Wd.surfaceY(view.r) + 6); for (let x = view.r; x >= view.l; x -= 5) ctx.lineTo(x, Wd.surfaceY(x) + 6 + Math.sin(x * .05 + time) * 2); ctx.closePath(); ctx.fill();
      }
      if (weather.storm > .05) { ctx.fillStyle = `rgba(255,255,255,${.35 * weather.storm})`; for (let x = view.l; x <= view.r; x += 40) { const y = Wd.surfaceY(x); ctx.beginPath(); ctx.ellipse(x + Math.sin(time * 2 + x) * 6, y - 1, 12, 2.5, 0, 0, TAU); ctx.fill(); } }
      ctx.restore();
    }

    /* light rays from the surface by day; far boulders and kelp in blue haze */
    const day = 1 - night;
    if (!gx && day > .05 && seaSY < H && !p.underground) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 10; k++) {
        const bx = (k / 10 + ((time * .01 + k * .37) % .1)) * W, len = H * .9;
        const lg = ctx.createLinearGradient(0, Math.max(0, seaSY), 0, Math.max(0, seaSY) + len);
        lg.addColorStop(0, `rgba(200,240,255,${.13 * day * (1 - weather.cloud * .7) * (1 - clamp(topDepth / 400, 0, .8))})`); lg.addColorStop(1, 'rgba(200,240,255,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(bx, seaSY); ctx.lineTo(bx + 30 + Math.sin(time * .5 + k) * 10, seaSY); ctx.lineTo(bx + 150, seaSY + len); ctx.lineTo(bx + 70, seaSY + len); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    if (!gx) drawFarLayers(G, S, view, night);
    else drawDeepLife(G, night, time, true);

    /* ---------------- world space ---------------- */
    ctx.save();
    cam.apply(ctx);
    drawDeepFloorFar(S, view);
    drawKelpLayer(G, Wd, S, view, 'back');
    ctx.restore();

    drawCellLayer(G, S, view);

    ctx.save();
    cam.apply(ctx);
    drawRim(G, S, view);
    drawFloorDecor(G, Wd, S, view, night);
    drawBoat(G, Wd, view);
    for (const e of Wd.exuviae) { if (e.x < view.l || e.x > view.r || e.eaten) continue; ctx.save(); ctx.translate(e.x, e.y); lobArt().drawExuvia(ctx, e.s, e.form); ctx.restore(); }
    for (const it of Wd.items) { if (it.x < view.l || it.x > view.r) continue; ctx.save(); ctx.translate(it.x, it.fy !== null ? it.fy : it.y - 1); ctx.globalAlpha = it.gone ? clamp(1 - it.gone / 3, 0, 1) : 1; if (it.fy !== null) ctx.rotate(Math.sin(time * 3 + it.col * 9) * .8); lobArt().drawFood(ctx, it, time); ctx.restore(); }
    ctx.globalAlpha = 1;
    drawCrowds(G, Wd, S, view);
    for (const n of Wd.npcs) drawNPC(G, n);
    if (Wd.mum) drawMum(G, Wd.mum);
    drawSeaLife(G, Wd, view, night, time);
    drawHunters(G, Wd, view);
    drawPlayer(G, p, time);
    G.particles.draw(ctx, cam);
    drawKelpLayer(G, Wd, S, view, 'front');
    drawShelters(G, Wd, view, night);
    if (G.player.stage === 'lobster' && G.player.shade === 'shelter') { ctx.save(); ctx.globalAlpha = .45; drawPlayer(G, G.player, time); ctx.restore(); }
    drawTern(G, Wd);
    ctx.restore();

    /* ---------------- light ---------------- */
    const deep = clamp((cam.y - 150) / 500, 0, 1);
    if (gx) {
      if (p.underground) denDark(G, p, night);
      const sm = sunMoonPos(tod, night, seaSY, weather.cloud);
      GFX.render(G, { night, warm: (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - weather.cloud) * (1 - deep), deep, top, bot,
        sun: sm.sun, moon: sm.moon, seaLevel: Wd.seaLevel(), surf: (sx) => cam.toScreen(0, Wd.surfaceY((sx - W / 2) / cam.zoom + cam.x))[1],
        floorY: S.surfaceAt(cam.x), farK: clamp((cam.x - (WORLD.deepR - 500)) / 200, 0, 1), winter, underground: p.underground });
      ctx = mainCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      /* glows are light, not paint: they go on top, after the lighting */
      ctx.save(); cam.apply(ctx); drawGlows(G, Wd, view, night, time); ctx.restore();
      if (!clean) drawOverlays(G, night, time);
      Cinematic.draw(ctx, W, H);
      return;
    }
    const dark = Math.max(night * .72, weather.cloud * .25) * (p.underground ? .55 : 1) + deep * .25 * (1 - night);
    if (dark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${lerp(255, 60, dark) | 0},${lerp(255, 90, dark) | 0},${lerp(255, 150, dark) | 0})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    const warm = (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - weather.cloud) * (1 - deep);
    if (warm > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,70,${warm * .4})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    ctx.save(); cam.apply(ctx);
    drawGlows(G, Wd, view, night, time);
    ctx.restore();
    drawDeepLife(G, night, time);
    drawSnow(G, time, dt, deep);
    if (p.underground) denDark(G, p, night);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(2,14,34,${.4 + night * .2})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (!clean) drawOverlays(G, night, time);
    Cinematic.draw(ctx, W, H);
  }

  function denDark(G, p, night) {
    const [sx, sy] = G.cam.toScreen(p.x, p.y), rad = Math.max(W, H) * .5;
    const lg = ctx.createRadialGradient(sx, sy, rad * .18, sx, sy, rad);
    lg.addColorStop(0, 'rgba(6,4,2,0)'); lg.addColorStop(1, `rgba(6,4,2,${.45 + night * .2})`);
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  }
  /* where the sun and the moon are on screen (CSS px), as drawSunMoon puts them; vis 0 when not up */
  function sunMoonPos(tod, night, horizon, cloud) {
    const skyTop = horizon * .85, out = { sun: { x: W * .5, y: -H, vis: 0 }, moon: { x: W * .5, y: -H, vis: 0 } };
    if (tod > .22 && tod < .82) { const t = invLerp(.22, .82, tod); out.sun = { x: W * (.1 + .8 * t), y: horizon - Math.sin(Math.PI * t) * Math.max(80, skyTop) + 10, vis: (1 - cloud * .7) * clamp(Math.sin(Math.PI * t) * 4, 0, 1) }; }
    if (night > .05) { const t = tod > .5 ? invLerp(.78, 1.28, tod) : invLerp(-.22, .28, tod); out.moon = { x: W * (.15 + .7 * t), y: horizon - Math.sin(Math.PI * clamp(t, 0, 1)) * Math.max(80, skyTop) * .9 - 10, vis: night * (1 - cloud * .8) }; }
    return out;
  }
  /* the far shore above the surface: granite, spruce trees and a lighthouse, seen when you are near the coast */
  let shoreImg = null;
  function drawFarShore(G, seaSY, night, winter) {
    const cam = G.cam, k = smoothstep(WORLD.kelpL - 600, WORLD.ledgeR, cam.x);
    if (k < .02 || seaSY < 10) return;
    if (!shoreImg) {
      shoreImg = document.createElement('canvas'); shoreImg.width = 1400; shoreImg.height = 240;
      const g = shoreImg.getContext('2d'), R = mulberry32(44);
      g.fillStyle = '#2a3a3a'; g.beginPath(); g.moveTo(0, 240); g.lineTo(0, 200); g.quadraticCurveTo(300, 150, 600, 170); g.quadraticCurveTo(900, 120, 1400, 140); g.lineTo(1400, 240); g.fill();
      g.fillStyle = '#1a2a28'; for (let x = 20; x < 1400; x += 14 + R() * 18) { const h = 30 + R() * 50, y = x < 600 ? lerp(200, 170, x / 600) : lerp(170, 140, (x - 600) / 800); g.beginPath(); g.moveTo(x - 7, y + 6); g.lineTo(x, y - h); g.lineTo(x + 7, y + 6); g.fill(); }
      g.fillStyle = '#f0f0f0'; g.fillRect(1180, 60, 16, 90); g.fillStyle = '#c0302a'; g.fillRect(1180, 90, 16, 14); g.fillRect(1180, 120, 16, 14); g.fillStyle = '#2a2a2a'; g.fillRect(1176, 52, 24, 10); g.fillStyle = '#ffe080'; g.fillRect(1182, 42, 12, 10);
      g.fillStyle = '#8a8a80'; g.beginPath(); g.moveTo(0, 240); g.lineTo(0, 212); g.quadraticCurveTo(200, 206, 400, 212); g.quadraticCurveTo(800, 206, 1400, 210); g.lineTo(1400, 240); g.fill();
    }
    const s = Math.max(.5, Math.min(1.1, cam.zoom * .5)), w = shoreImg.width * s, h = shoreImg.height * s;
    const x0 = W * .35 - (cam.x - WORLD.ledgeL) * cam.zoom * .12, y0 = seaSY - h + 8 * s;
    ctx.save(); ctx.globalAlpha = k;
    ctx.filter = quality === 'low' ? 'none' : `brightness(${lerp(1, .3, night)})`;
    ctx.drawImage(shoreImg, x0, y0, w, h);
    if (winter) { ctx.filter = 'none'; ctx.fillStyle = `rgba(240,245,255,${.5 * k})`; ctx.fillRect(x0, seaSY - 30 * s, w, 30 * s); }
    ctx.restore(); ctx.filter = 'none';
    /* the lighthouse beam at night */
    if (night > .3) { ctx.save(); ctx.globalAlpha = night * k * .35; ctx.fillStyle = '#ffe9a0'; const bx = x0 + 1188 * s, by = y0 + 48 * s, a = (G.time * .8) % TAU; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * 400, by + Math.sin(a) * 60 - 10); ctx.lineTo(bx + Math.cos(a + .25) * 400, by + Math.sin(a + .25) * 60 + 10); ctx.closePath(); ctx.fill(); ctx.restore(); }
  }
  /* snowflakes over the water in winter */
  function drawFlakes(G, seaSY, dt) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const f of flakes) {
      f.y += dt * .08 * f.z; f.x += Math.sin(G.time * .7 + f.ph) * dt * .01;
      if (f.y > 1) f.y = 0;
      const x = ((f.x - G.cam.x * .0003 * f.z) % 1 + 1) % 1 * W, y = f.y * seaSY;
      ctx.globalAlpha = .4 + f.z * .5 * G.world.weather.snow; ctx.beginPath(); ctx.arc(x, y, 1 + f.z * 1.6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  /* far boulders and kelp, blue with distance, standing on the far floor */
  function drawFarLayers(G, S, view, night) {
    const cam = G.cam;
    if (cam.x < WORLD.deepR - 400) return;
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
  /* the deep floor beyond the grid (no cells there): mud going off into the dark */
  function drawDeepFloorFar(S, view) {
    if (view.l > WORLD.gridL || view.b < 500) return;
    ctx.fillStyle = '#2e2a24';
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
    const fp = painting() && Painted.floorPattern(b);
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
      /* the moon's path on the water */
      ctx.fillStyle = `rgba(230,240,255,${.22 * night * (1 - cloud)})`;
      for (let k = 0; k < 30; k++) { const yy = horizon + 4 + k * 6, ww = 30 + k * 10; ctx.fillRect(x - ww / 2 + Math.sin(G.time * 2 + k) * 8, yy, ww * (.4 + .3 * Math.sin(k * 1.7 + G.time)), 1.6); }
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

  /* a crisp edge along the top of the floor, coloured by what it is made of */
  const RIM = {};
  RIM[MAT.SAND] = ['rgba(110,96,60,.5)', 'rgba(236,226,196,.9)']; RIM[MAT.MUD] = ['rgba(30,26,20,.55)', 'rgba(130,120,100,.9)']; RIM[MAT.CLAY] = RIM[MAT.MUD];
  RIM[MAT.ROCK] = ['rgba(40,38,34,.5)', 'rgba(190,186,176,.85)']; RIM[MAT.COBBLE] = ['rgba(60,56,50,.5)', 'rgba(220,210,200,.9)'];
  RIM[MAT.GRAVEL] = ['rgba(80,70,50,.5)', 'rgba(210,196,160,.85)']; RIM[MAT.SHELL] = ['rgba(10,10,30,.6)', 'rgba(120,120,180,.8)'];
  function drawRim(G, S, view) {
    const x0 = Math.max(view.l, WORLD.gridL), x1 = Math.min(view.r, WORLD.gridR), step = Math.max(1.5, 6 / G.cam.zoom);
    if (x1 <= x0) return;
    const lw = 2.2 / G.cam.zoom;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      let cur = null;
      for (let x = x0; x <= x1; x += step) {
        const t0 = S.topAt(x);
        if (t0 > S.surfaceAt(x) + 8) { if (cur) { ctx.stroke(); cur = null; } continue; }   /* an open den door */
        const y = (S.topAt(x - 8) + S.topAt(x - 4) + t0 * 2 + S.topAt(x + 4) + S.topAt(x + 8)) / 6, m = S.matAt(x, t0 + 2), col = (RIM[m] || RIM[MAT.ROCK])[pass], yy = y + (pass ? 0 : lw * 1.6);
        if (col !== cur) { if (cur) { ctx.lineTo(x, yy); ctx.stroke(); } cur = col; ctx.strokeStyle = col; ctx.lineWidth = pass ? lw : lw * 2.6; ctx.beginPath(); ctx.moveTo(x, yy); }
        else ctx.lineTo(x, yy);
      }
      if (cur) ctx.stroke();
    }
  }
  function drawFloorDecor(G, Wd, S, view, night) {
    if (!decor) return;
    const time = G.time, pt = painting();
    /* sea grass and brown weed on the floor */
    for (const w of decor.weed) { if (w.x < view.l - 20 || w.x > view.r + 20) continue; const y = S.topAt(w.x); if (y > S.surfaceAt(w.x) + 6) continue; ctx.strokeStyle = w.col; ctx.lineWidth = 1.4 * w.s; ctx.lineCap = 'round'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(w.x + k * 2, y + 2); ctx.quadraticCurveTo(w.x + k * 3 + Math.sin(time * 1.2 + w.ph + k) * 4, y - 8 * w.s, w.x + k * 2 + Math.sin(time + w.ph) * 6, y - 16 * w.s); ctx.stroke(); } }
    /* tube worms in the mud offshore */
    for (const wm of decor.worms) { if (wm.x < view.l || wm.x > view.r) continue; const y = S.topAt(wm.x); ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 1.2 * wm.s; ctx.beginPath(); ctx.moveTo(wm.x, y + 1); ctx.lineTo(wm.x + Math.sin(time + wm.ph) * 1.5, y - 7 * wm.s); ctx.stroke(); ctx.strokeStyle = '#e0a070'; ctx.lineWidth = .7; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .5 + Math.sin(time * 2 + wm.ph + k) * .2; ctx.beginPath(); ctx.moveTo(wm.x, y - 7 * wm.s); ctx.lineTo(wm.x + Math.cos(a) * 4 * wm.s, y - 7 * wm.s + Math.sin(a) * 4 * wm.s); ctx.stroke(); } }
    /* empty shells and bits of sea-urchin test */
    for (const sh of decor.shells) { if (sh.x < view.l || sh.x > view.r) continue; const y = S.topAt(sh.x); if (y > S.surfaceAt(sh.x) + 6) continue; if (pt && Painted.drawShell(ctx, sh.x, y, sh.s, sh.a, sh.col)) continue; ctx.save(); ctx.translate(sh.x, y); ctx.rotate(sh.a * .2); ctx.fillStyle = sh.col; ctx.beginPath(); ctx.ellipse(0, 0, 3 * sh.s, 1.4 * sh.s, 0, Math.PI, TAU); ctx.fill(); ctx.restore(); }
    /* blue mussels clustered on the mussel beds */
    for (const m of decor.mussels) { if (m.x < view.l || m.x > view.r) continue; const y = S.topAt(m.x) + 1; if (pt && Painted.drawMusselDecor(ctx, m.x, y, m.s, m.a)) continue; ctx.save(); ctx.translate(m.x, y); ctx.rotate(m.a * .3 - 1.2); ctx.scale(m.s, m.s); ctx.fillStyle = '#1e1e48'; ctx.beginPath(); ctx.moveTo(-4, 1); ctx.quadraticCurveTo(-2, -4, 4, -3); ctx.quadraticCurveTo(5, 0, 3, 2); ctx.quadraticCurveTo(0, 3, -4, 1); ctx.fill(); ctx.fillStyle = 'rgba(180,200,255,.35)'; ctx.beginPath(); ctx.ellipse(1, -1.5, 2, .7, .3, 0, TAU); ctx.fill(); ctx.restore(); }
    /* sea stars and frilled anemones on the rocks and cobbles */
    for (const st of decor.stars) {
      if (st.x < view.l || st.x > view.r) continue; const y = S.topAt(st.x); if (y > S.surfaceAt(st.x) + 6) continue;
      if (pt && Painted.drawStar(ctx, st.x, y, st.s, st.col, st.a)) continue;
      ctx.save(); ctx.translate(st.x, y); ctx.rotate(st.a); ctx.scale(st.s, st.s * .55); ctx.fillStyle = st.col;
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.6 : 7, a = i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * 4, Math.sin(a) * 4, .8, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    for (const a of decor.anem) {
      if (a.x < view.l || a.x > view.r) continue; const y = S.topAt(a.x); if (y > S.surfaceAt(a.x) + 6) continue;
      if (pt && Painted.drawAnemone(ctx, a.x, y, a.s, a.col, time, a.ph)) continue;
      ctx.fillStyle = a.col; ctx.beginPath(); ctx.ellipse(a.x, y - 2 * a.s, 3 * a.s, 3 * a.s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = a.col; ctx.lineWidth = 1 * a.s; ctx.lineCap = 'round';
      for (let k = 0; k < 12; k++) { const ang = -Math.PI + k / 11 * Math.PI; ctx.beginPath(); ctx.moveTo(a.x, y - 3 * a.s); ctx.quadraticCurveTo(a.x + Math.cos(ang) * 5 * a.s + Math.sin(time * 1.5 + k + a.ph) * 1.5, y - 3 * a.s + Math.sin(ang) * 5 * a.s, a.x + Math.cos(ang) * 8 * a.s + Math.sin(time * 1.5 + k + a.ph) * 2.5, y - 3 * a.s + Math.sin(ang) * 8 * a.s); ctx.stroke(); }
    }
    /* barnacles on the ledge */
    for (const b of decor.barn) { if (b.x < view.l || b.x > view.r) continue; const y = S.topAt(b.x); ctx.fillStyle = '#d8d0c0'; ctx.strokeStyle = '#6a645a'; ctx.lineWidth = .5; for (let k = 0; k < b.n; k++) { ctx.beginPath(); ctx.arc(b.x + k * 3.4 * b.s, y - 1 - (k % 2), 1.6 * b.s, 0, TAU); ctx.fill(); ctx.stroke(); } }
  }
  /* the kelp forest: half the fronds behind the lobsters, half in front, swaying */
  function drawKelpLayer(G, Wd, S, view, which) {
    const time = G.time;
    let k = 0;
    for (const K of Wd.kelp) {
      k++;
      if ((which === 'back') !== (k % 2 === 0)) continue;
      if (K.x + 60 < view.l || K.x - 60 > view.r) continue;
      ctx.save(); if (which === 'front' && !painting()) ctx.globalAlpha = .9;
      lobArt().drawKelp(ctx, K, time + (which === 'front' ? 1 : 0), S.topAt(K.x), which === 'back');
      ctx.restore();
    }
  }
  /* the lobster boat on the surface, its rope going down to the trap, and the trap */
  function drawBoat(G, Wd, view) {
    const b = Wd.boat, T = Wd.trap, lvl = Wd.seaLevel();
    if (T.state !== 'away') {
      /* the rope and the buoy */
      ctx.strokeStyle = 'rgba(230,220,180,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(T.x + 26, T.y - 28); ctx.quadraticCurveTo(T.x + 34, (T.y + lvl) / 2, b.x - 40, lvl - 2); ctx.stroke();
      ctx.save(); ctx.translate(T.x, T.y); lobArt().drawTrap(ctx, { s: 1, bait: T.bait > 0 }); ctx.restore();
    }
    if (b.x + 200 < view.l || b.x - 200 > view.r || view.t > lvl + 60) return;
    ctx.save(); ctx.translate(b.x, Wd.surfaceY(b.x) + 2 + b.wave); lobArt().drawBoat(ctx, { s: .9, roll: b.wave });
    ctx.translate(-20, -16); lobArt().drawLobsterman(ctx, { s: .7, wave: b.ph, measure: T.state === 'up' ? 1 : 0 });
    if (T.state === 'up') { ctx.translate(0, -74); ctx.fillStyle = '#c8a030'; ctx.fillRect(-10, 0, 20, 2); }
    ctx.restore();
    /* the hull's reflection and the wake */
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(b.x, lvl + 10, 110, 5, 0, 0, TAU); ctx.fill();
  }
  /* the holes under the cobbles, crevices and mud banks: drawn in front of the lobsters, with a little lobster peeking out of a taken hole */
  function drawShelters(G, Wd, view, night) {
    for (const sh of Wd.shelters) {
      if (sh.x + sh.w < view.l || sh.x - sh.w > view.r) continue;
      const y = sh.y, w = sh.w;
      if (painting() && Painted.drawShelter(ctx, sh, G.time)) { if (sh.kind === 'hollow') peek(G, sh, y, w, sh.rad || 12); continue; }
      if (sh.kind === 'hollow') {
        /* a rounded cobble resting on the sand, with a dark hole dug out under its front edge */
        const R = mulberry32((sh.x * 13) | 0), rad = sh.rad || 12, cy = y - rad * .5;
        const sg = ctx.createRadialGradient(sh.x - w * .18, cy - rad * .45, 2, sh.x, cy, w * .62);
        sg.addColorStop(0, '#d4ccbc'); sg.addColorStop(.55, '#968e80'); sg.addColorStop(1, '#4e483e');
        ctx.fillStyle = sg; ctx.beginPath();
        for (let k = 0; k <= 20; k++) { const a2 = k / 20 * TAU, rr3 = 1 + (R() - .5) * .08; ctx.lineTo(sh.x + Math.cos(a2) * w * .56 * rr3, cy + Math.sin(a2) * rad * .78 * rr3); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(30,26,20,.35)'; ctx.lineWidth = .7; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(sh.x - w * .15, cy - rad * .45, w * .22, rad * .12, -.1, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(200,110,150,.4)'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(sh.x + (R() - .5) * w * .7, cy - R() * rad * .5, 1 + R() * 2, 0, TAU); ctx.fill(); }
        /* the hole: a dark mouth under the stone's front edge */
        const hg = ctx.createRadialGradient(sh.x, y, 1, sh.x, y, w * .42);
        hg.addColorStop(0, 'rgba(6,4,2,.95)'); hg.addColorStop(.75, 'rgba(10,8,4,.85)'); hg.addColorStop(1, 'rgba(10,8,4,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(sh.x, y + 1, w * .4, rad * .42, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(200,180,140,.5)'; ctx.beginPath(); ctx.ellipse(sh.x, y + 1.5, w * .44, 1.6, 0, 0, TAU); ctx.fill();
        peek(G, sh, y, w, rad);
      } else if (sh.kind === 'crevice') {
        const hg = ctx.createRadialGradient(sh.x, y, 1, sh.x, y - 4, w * .6);
        hg.addColorStop(0, 'rgba(8,6,4,.92)'); hg.addColorStop(1, 'rgba(8,6,4,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(sh.x, y - 4, w * .6, 11, 0, 0, TAU); ctx.fill();
        const g = ctx.createLinearGradient(0, y - 22, 0, y - 10); g.addColorStop(0, '#b0a898'); g.addColorStop(1, '#5a544a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sh.x - w * .7, y - 12); ctx.quadraticCurveTo(sh.x - w * .2, y - 24, sh.x + w * .3, y - 20); ctx.lineTo(sh.x + w * .75, y - 13); ctx.quadraticCurveTo(sh.x + w * .2, y - 10, sh.x - w * .7, y - 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(210,130,160,.4)'; ctx.beginPath(); ctx.ellipse(sh.x - w * .1, y - 20, w * .2, 2.5, -.1, 0, TAU); ctx.fill();
      } else {
        /* a mud bank offshore with a dark burrow mouth */
        const g = ctx.createLinearGradient(0, y - 18, 0, y); g.addColorStop(0, '#6a6252'); g.addColorStop(1, '#3a342c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sh.x - w * .6, y + 1); ctx.quadraticCurveTo(sh.x - w * .2, y - 20, sh.x + w * .3, y - 16); ctx.quadraticCurveTo(sh.x + w * .6, y - 12, sh.x + w * .65, y + 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(8,6,4,.85)'; ctx.beginPath(); ctx.ellipse(sh.x, y - 4, w * .28, 6, 0, 0, TAU); ctx.fill();
      }
    }
  }

  /* another little lobster lives in a taken hole: its claws and feelers at the door */
  function peek(G, sh, y, w, rad) {
    if (!sh.taken || sh.mine) return;
    ctx.save(); ctx.translate(sh.x + Math.sin(sh.npcPh) * 3, y - 3); ctx.scale(Math.sin(sh.npcPh) > 0 ? 1 : -1, 1);
    ctx.beginPath(); ctx.rect(-w * .3, -rad * .5, w * .6, rad * .6); ctx.clip();
    lobArt().drawLobster(ctx, { s: .1, form: sh.npcForm, up: .3 + Math.sin(G.time * 2 + sh.npcPh) * .15, simple: true, seed: 4, ph: G.time * 2 });
    ctx.restore();
  }
  function drawCrowds(G, Wd, S, view) {
    const p = G.player, busy = p.mode === 'box' || p.mode === 'release' || p.busy > 0 || (p.flags.home && !p.flags.met);
    for (const m of Wd.marchers) {
      if (m.x < view.l || m.x > view.r || m.gone) continue;
      const w = lobUnits(m.cm), y = S.walkTop(m.x, 6) - w * .2 + (m.sink || 0) * w * .4, near = Math.abs(m.x - p.x) < (busy ? 120 : 40);
      ctx.globalAlpha = (near ? .3 : .9) * (1 - (m.sink || 0));
      drawCrowdLob(m.x, y, w, m.form, m.male, m.pause > 0 || m.arrived ? 0 : m.ph, Wd.marchDir || -1);
    }
    ctx.globalAlpha = 1;
  }
  function drawHunters(G, Wd, view) {
    for (const h of Wd.hunters) {
      const K = HUNTER_KINDS[h.kind];
      if (h.x + K.len < view.l || h.x - K.len > view.r) continue;
      ctx.save(); ctx.translate(h.x, h.y); ctx.scale(h.dir, 1);
      if (h.state === 'strike') ctx.rotate(Math.sin(h.t * 8) * .12);
      if (h.kind === 'seal') lobArt().drawSeal(ctx, { s: K.len / 100, ph: h.ph }); else lobArt().drawHunter(ctx, h.kind, { s: K.len / 100, ph: h.ph });
      ctx.restore();
      /* its shadow on the floor */
      const gy = Wd.ground.walkTop(h.x, 6); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(h.x, gy, K.len * .4, 3, 0, 0, TAU); ctx.fill();
    }
  }
  function drawNPC(G, n) {
    ctx.save(); ctx.translate(n.x, n.y); ctx.scale(n.face, 1);
    if (n.spin) ctx.rotate(n.spin);
    if (n.mode === 'door') { ctx.beginPath(); ctx.rect(-n.w * .7, -n.w * .3, n.w * 1.6, n.w * .5); ctx.clip(); }
    if (n.mode === 'enter') ctx.globalAlpha = clamp(1 - (n.sink || 0), 0, 1);
    lobArt().drawLobster(ctx, { s: n.w / 100, form: n.form, sex: n.sex, walk: n.walk, moving: n.mode === 'walk' || n.mode === 'leave' || n.mode === 'box', up: n.mode === 'box' ? .6 + Math.sin(G.time * 9) * .2 : n.mode === 'door' ? .25 + Math.sin(G.time * 2 + n.x) * .15 : 0, pinch: n.mode === 'box' ? .6 : 0, eggs: n.role === 'female' && n.eggs ? n.eggs : 0, seed: (n.cm * 13) | 0, crusher: 'right', ph: G.time * 2 });
    ctx.restore();
  }
  function drawMum(G, m) {
    ctx.save(); ctx.translate(m.x, m.y); ctx.scale(m.face || 1, 1); ctx.globalAlpha = clamp(1 - (m.fade || 0), 0, 1);
    lobArt().drawLobster(ctx, { s: m.w / 100, form: m.form, sex: 'girl', walk: m.ph * 4, moving: m.leaving, eggs: m.eggs, up: m.shake > 0 ? .5 + Math.sin(m.ph * 20) * .1 : .1, fan: m.shake > 0 ? m.ph : 0, seed: 5, crusher: 'right', ph: m.ph });
    ctx.restore();
  }
  function drawSeaLife(G, Wd, view, night, time) {
    const w = Wd.shark; if (w) { ctx.save(); ctx.translate(w.x, w.y); ctx.scale(w.dir, 1); lobArt().drawBaskingShark(ctx, { s: .6, t: w.t, gulp: w.gulp }); ctx.restore(); }
    for (const f of Wd.smallFish) { if (f.x < view.l - 20 || f.x > view.r + 20) continue; ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir * f.s * .5, f.s * .5); lobArt().drawFish(ctx, { col: f.col, col2: f.col2, ph: f.ph }); ctx.restore(); }
    for (const j of Wd.jellies) if (j.x > view.l - 80 && j.x < view.r + 80) lobArt().drawCombJelly(ctx, j, time);
    for (const q of Wd.plankton) if (q.x > view.l && q.x < view.r && q.y > view.t && q.y < view.b) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1.5, 1.5); ctx.translate(-q.x, -q.y); lobArt().drawPlankton(ctx, q, night, time); ctx.restore(); }
    for (const s of Wd.sibs) { if (s.x < view.l || s.x > view.r) continue; ctx.save(); ctx.translate(s.x, s.y); ctx.scale(Math.cos(s.a) < 0 ? -1 : 1, 1); ctx.globalAlpha = .75; if (s.post) lobArt().drawPostlarva(ctx, { s: .07, ph: s.ph, form: 'normal' }); else lobArt().drawLarva(ctx, { s: .3, ph: s.ph, form: 'normal', instar: 1 }); ctx.restore(); }
    ctx.globalAlpha = 1;
    const sc = Wd.school;
    if (sc) for (const f of sc.fish) { const x = sc.x + f.dx, y = sc.y + f.dy + Math.sin(sc.t * 2 + f.ph) * 6; if (x < view.l - 40 || x > view.r + 40) continue; ctx.save(); ctx.translate(x, y); ctx.scale(sc.dir * f.s, f.s); lobArt().drawFish(ctx, { ph: f.ph, col: '#d8e4ee', col2: '#2a4a6a' }); ctx.restore(); }
    for (const e of Wd.larvaCloud) { ctx.save(); ctx.translate(e.x, e.y); ctx.globalAlpha = clamp(6 - e.t, 0, 1) * .85; ctx.scale(e.vx < 0 ? -1 : 1, 1); lobArt().drawLarva(ctx, { s: .24, ph: e.t * 10 + e.ph, form: 'normal', instar: 1 }); ctx.restore(); }
    ctx.globalAlpha = 1;
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
    /* each larva sparkles as it swims free */
    for (const e of Wd.larvaCloud) {
      if (e.t > 1.5) continue;
      const a = (1 - e.t / 1.5) * (.18 + night * .14), r = 1.2 + e.t * 2.5;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      g.addColorStop(0, `rgba(170,240,255,${a})`); g.addColorStop(1, 'rgba(170,240,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
    }
    /* the swell glows blue over the cobble when a mother fans her larvae free */
    const p = G.player;
    if (p.mode === 'release') { const sw = Wd.swash(); const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 40 + sw * 60); g.addColorStop(0, `rgba(110,220,255,${.3 * sw})`); g.addColorStop(1, 'rgba(110,220,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 40 + sw * 60, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  /* far away in the blue: shoals of little fish turning, and on dark nights the sea twinkles */
  const shoals = Array.from({ length: 3 }, (_, i) => ({ ph: i * 2.1, y: .2 + i * .27, n: 26 + i * 6, dir: i % 2 ? -1 : 1, sp: .006 + i * .003 }));
  const twinkles = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * TAU, sp: .5 + Math.random() * 2 }));
  function drawDeepLife(G, night, time, shoalsOnly) {
    if (G.player.underground) return;
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
  /* specks of marine snow drifting past the camera (thicker in the deep) */
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

  function drawTern(G, Wd) {
    const b = Wd.tern, p = G.player;
    if (!p.swimming || p.y > 120) return;
    ctx.save(); ctx.translate(b.x, b.y);
    if (b.state === 'dive') ctx.rotate(.4 * Math.cos(b.t * 2));
    lobArt().drawTern(ctx, { s: b.state === 'dive' ? .4 : .32, ph: b.ph * 4 });
    ctx.restore();
    if (b.state === 'dive' && b.y > Wd.seaLevel() - 6) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(b.x, Wd.seaLevel(), 10, 2, 0, 0, TAU); ctx.fill(); }
  }

  function drawPlayer(G, p, time) {
    ctx.save();
    const glowR = p.stage === 'lobster' ? p.w * .6 + 6 : p.r * 4 + 4;
    const gg = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, glowR);
    gg.addColorStop(0, `rgba(255,240,190,${.16 + G.night * .16})`); gg.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = gg; ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
    if (p.stage === 'egg') {
      ctx.translate(p.x, p.y); ctx.rotate(Math.sin(time * 9) * p.crack * .4);
      ctx.strokeStyle = `rgba(255,240,150,${.5 + .4 * Math.sin(time * 4)})`; ctx.lineWidth = .4; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.stroke();
      lobArt().drawEgg(ctx, { s: 1.4, eye: true }); ctx.restore(); return;
    }
    if (p.swimming) {
      ctx.translate(p.x, p.y);
      if (p.tumble > 0) ctx.rotate(p.spin);
      ctx.scale(p.face, 1); ctx.rotate(p.ang * p.face);
      if (p.molting > 0) { ctx.globalAlpha = .6 + .4 * Math.sin(time * 20); }
      if (p.stage === 'larva') lobArt().drawLarva(ctx, { s: p.r / 3.2, ph: p.phase * (p.moving ? 2.2 : 1), form: p.form, instar: p.zinstar });
      else lobArt().drawPostlarva(ctx, { s: .11, ph: p.phase * (p.moving ? 2.2 : 1), form: p.form });
      ctx.restore(); return;
    }
    /* the lobster */
    ctx.translate(p.x, p.y);
    if (p.mode === 'tossed') ctx.rotate(p.spin);
    else if (['dig', 'moult', 'harden', 'brood', 'winter'].includes(p.mode)) ctx.rotate(0);
    else ctx.rotate(p.ang * p.face);
    ctx.scale(p.face, 1);
    const inDen = p.underground;
    if (p.mode === 'moult') { const k = 1 - p.molting / MOLT_T; ctx.globalAlpha = .5; lobArt().drawLobster(ctx, { s: p.w / 100 * .97, form: p.form, sex: p.sex, pale: .9, tuck: .3, simple: true, crusher: p.crusher }); ctx.globalAlpha = 1; ctx.translate(-k * p.w * .3, -k * p.w * .08); }
    const flip = p.flipT > 0 ? Math.sin(Math.min(1, p.flipT / FLIP_T) * Math.PI) : 0;
    lobArt().drawLobster(ctx, { s: p.w / 100, form: p.form, sex: p.sex, walk: p.walk, moving: p.moving, pale: p.pale, up: p.up, pinch: p.pinch, eat: p.eatAnim, flip, tuck: p.mode === 'tuck' ? .8 : inDen ? .35 : p.mode === 'winter' ? .7 : 0, eggs: p.sex === 'girl' ? p.eggs : 0, fan: p.mode === 'release' || p.mode === 'brood' ? p.t : 0, crusher: p.crusher, face: p.face, seed: 11, ph: p.t });
    ctx.restore();
  }

  /* ---------- overlays: boxing, the larvae's swell, arrows, labels ---------- */
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
  function drawOverlays(G, night, time) {
    const p = G.player, cam = G.cam, Wd = G.world;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (p.mode === 'box' && p.wr) {
      const w = p.wr, [sx, sy] = cam.toScreen(w.mid, p.y - p.w * .25);
      const ok = p.boxWindow();
      ringMeter(G, sx, sy, (w.ring % 1.8) / 1.8, ok, w.flash);
      const bw = Math.min(520, W * .6), bx = W / 2 - bw / 2, by = H - 190;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, bx - 8, by - 8, bw + 16, 40, 20); ctx.fill();
      const half = bw / 2, mk = W / 2 + w.p * half * (p.face > 0 ? 1 : -1);
      const lg = ctx.createLinearGradient(bx, 0, bx + bw, 0); lg.addColorStop(0, p.face > 0 ? '#ff7a5a' : '#7ad35a'); lg.addColorStop(.5, '#ffe27a'); lg.addColorStop(1, p.face > 0 ? '#7ad35a' : '#ff7a5a');
      ctx.fillStyle = lg; rr(ctx, bx, by, bw, 24, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mk, by + 12, 16, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(mk, by + 12); ctx.scale(.2, .2); Sprites.drawLobster(ctx, { s: 1, form: p.form, sex: p.sex, simple: true, crusher: 'right' }); ctx.restore();
      ctx.font = `900 ${Math.round(Math.min(26, W * .03))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = ok ? '#7dff7a' : '#fff3c0';
      const txt = w.done === 'win' ? 'YOU WIN!' : w.done === 'lose' ? 'WHOOPS!' : ok ? 'BIG HEAVE!  (E / ▲)' : 'BOX!  (Space)';
      ctx.strokeText(txt, W / 2, by + 56); ctx.fillText(txt, W / 2, by + 56);
    }
    if (p.mode === 'release' && p.rel) {
      const sw = Wd.swash(), ok = p.releaseWindow(), [sx, sy] = cam.toScreen(p.x, p.y);
      ringMeter(G, sx, sy, sw, ok, p.rel.flash);
      const bw = Math.min(420, W * .5), bx = W / 2 - bw / 2, by = H - 180;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, bx - 8, by - 8, bw + 16, 40, 20); ctx.fill();
      ctx.fillStyle = '#1a3a70'; rr(ctx, bx, by, bw, 24, 12); ctx.fill();
      ctx.fillStyle = ok ? '#7dff7a' : '#8fd6ff'; rr(ctx, bx, by, bw * sw, 24, 12); ctx.fill();
      const need = G.diff().fans;
      for (let k = 0; k < need; k++) { ctx.fillStyle = k < p.rel.good ? '#bfefff' : 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(W / 2 - (need - 1) * 14 + k * 28, by - 22, 9, 0, TAU); ctx.fill(); }
      ctx.font = `900 ${Math.round(Math.min(26, W * .03))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = ok ? '#7dff7a' : '#fff3c0';
      const txt = ok ? 'FAN!  (Space)' : 'Wait for the swell…';
      ctx.strokeText(txt, W / 2, by + 56); ctx.fillText(txt, W / 2, by + 56);
    }
    /* arrows to where you are going */
    const S = Wd.ground;
    if (p.stage === 'postlarva' && p.homeHint) pointTo(G, p.homeHint.x, p.homeHint.y, '#7fe0ff', time);
    if (p.stage === 'lobster' && p.mode === 'walk') {
      if (p.flags.migrating && !p.flags.arrivedDeep && p.x > WORLD.deepR - 250) pointTo(G, WORLD.deepR - 400, S.surfaceAt(WORLD.deepR - 400) - 20, '#7fe0ff', time);
      else if (p.flags.returning && !p.flags.home) pointTo(G, WORLD.homeX, S.surfaceAt(WORLD.homeX) - 20, '#b7f07a', time);
      else if (p.safe < .3 && p.shade === 'open') { const sh = Wd.nearestShelter(p.x); if (sh) pointTo(G, sh.x, sh.y - 6, '#a8e0ff', time); }
      else if (p.foodHint) pointTo(G, p.foodHint.x, p.foodHint.y, '#ffe9a0', time);
      else if (p.sex === 'girl' && p.flags.home && !p.flags.met) { const h = Wd.hosts().sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; if (h && Math.abs(h.x - p.x) > 40) pointTo(G, h.x, h.y, '#ff9ad0', time); }
      else if (p.sex === 'boy' && p.flags.home && !p.flags.denDug && (p.x < WORLD.cobbleL || p.x > WORLD.cobbleR)) pointTo(G, WORLD.homeX, S.surfaceAt(WORLD.homeX) - 20, '#ffe9a0', time);
      else if (p.full && p.den && Math.abs(p.den.x - p.x) > 30 && p.instar >= 2) pointTo(G, p.den.x, p.den.y, '#ffe9a0', time);
      else if (p.full && p.instar === 1 && p.home && Math.abs(p.home.x - p.x) > 30) pointTo(G, p.home.x, p.home.y, '#ffe9a0', time);
      else if (Wd.trap.state === 'set' && !p.flags.trapped && p.instar <= 3 && Math.abs(Wd.trap.x - p.x) > 50) pointTo(G, Wd.trap.x, Wd.trap.y - 10, '#ffd0a0', time);
    }
    /* off-screen things that matter */
    const targets = [];
    const riv = Wd.rival(); if (riv && p.stage === 'lobster') targets.push([riv.x, riv.y, '#ff9a6a']);
    const fem = Wd.female(); if (fem && p.stage === 'lobster' && !p.flags.met) targets.push([fem.x, fem.y, '#ff9ad0']);
    for (const h of Wd.hunters) if (h.state === 'come') targets.push([h.x, h.y, '#ff6a6a']);
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
      for (const sh of Wd.shelters) if (sh.x > v.l && sh.x < v.r) tag(sh.x, sh.y - 30, sh.kind === 'hollow' ? (sh.taken && !sh.mine ? 'taken hole' : sh.mine ? 'my hole' : 'empty hole') : sh.kind === 'crevice' ? 'crevice' : 'mud bank');
      for (const K of Wd.kelp) if (K.x > v.l && K.x < v.r && Math.abs(K.x - p.x) < 120) { tag(K.x, S.topAt(K.x) - K.h - 10, 'kelp'); break; }
    } else {
      const seen = new Set();
      for (const q of Wd.plankton) { if (seen.has(q.kind) || Math.hypot(q.x - p.x, q.y - p.y) > 80) continue; seen.add(q.kind); tag(q.x, q.y - 6, { diatom: 'diatom', chain: 'diatom chain', dino: 'glowing plankton', copepod: 'copepod' }[q.kind]); }
      for (const j of Wd.jellies) if (j.x > v.l && j.x < v.r) tag(j.x, j.y - j.r - 12, 'comb jelly');
      if (Wd.shark) tag(Wd.shark.x, Wd.shark.y - 120, 'basking shark');
      if (Wd.school) tag(Wd.school.x, Wd.school.y - 50, 'herring');
    }
    tag(p.x, p.y - (p.stage === 'lobster' ? p.w * .3 + 14 : p.r * 3 + 8), STAGES[STAGE_INDEX[p.stageKey()]].name);
    for (const it of Wd.items) if (Math.abs(it.x - p.x) < 300 && it.bites > 0 && it.fy === null) tag(it.x, it.y - 12, FOOD_KINDS[it.kind].name);
    for (const h of Wd.hunters) tag(h.x, h.y - 40, HUNTER_KINDS[h.kind].name);
    for (const n of Wd.npcs) tag(n.x, n.y - n.w * .3 - 10, n.role === 'rival' ? 'rival boy' : n.sex === 'girl' ? 'girl lobster' : 'boy lobster');
    if (Wd.trap.state !== 'away') tag(Wd.trap.x, Wd.trap.y - 40, 'lobster trap');
    if (Math.abs(Wd.boat.x - p.x) < 600 && Wd.trap.state !== 'away') tag(Wd.boat.x, Wd.seaLevel() - 70, 'the lobsterman');
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
