/* ============================================================
   render.js — the water column of the Gulf of Maine, back to front
   ============================================================
     the sky above the surface (time of day, weather, stars, the
     sun, the moon in its real phase, snow in winter)
     THE SEA you are in: blue-green near the top, darker and bluer
     with depth until it is black; light rays by day; a faint haze
     of plankton far away; specks drifting past the camera
     THE FLOOR of the deep basin in cross-section (mud over clay,
     a few old stones), painted from cells at 4x with smooth edges,
     tube worms and burrows
     marine snow sinking, the sleeping layer of stage V copepods,
     comb jellies, the right whale, the basking shark, herring,
     other copepods and nauplii, the grown-up you meet and her
     scent trail, eggs drifting free, diatoms and dinoflagellates,
     YOU, shed skins and bubbles
     night (a moonlit multiply) · glowing plankton (additive)
     overlays: the depth gauge (where the light is, and you), the
     egg-laying ring, arrows to where you are going, name tags
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
  const stars = [], specks = [], flakes = [];
  let lo = null, loImg = null, hi = null, hiCtx = null, back = null, backCtx = null, smooth = null;
  let buf = null, bufCtx = null, grainPat = null, grain = null;
  let builtFor = null, decor = null;
  /* the painted art goes with the WebGL look (?gfx=gl); the classic sprites everywhere else */
  const noPaint = (() => { try { return new URLSearchParams(location.search).get('paint') === '0'; } catch (e) { return false; } })();
  const painting = () => !noPaint && typeof Painted !== 'undefined' && typeof GFX !== 'undefined' && GFX.active();
  const Art = () => (painting() ? Painted : Sprites);

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    if (typeof GFX !== 'undefined' && GFX.init(c)) GFX.setQualitySource(() => quality);
    for (let i = 0; i < 220; i++) stars.push([Math.random(), Math.random() * .8, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 110; i++) specks.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, ph: Math.random() * TAU });
    for (let i = 0; i < 120; i++) flakes.push({ x: Math.random(), y: Math.random(), z: .4 + Math.random() * .6, ph: Math.random() * TAU });
    buildGrain();
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

  function buildGrain() {
    grain = document.createElement('canvas'); grain.width = grain.height = 256;
    const g = grain.getContext('2d'), R = mulberry32(99);
    for (let i = 0; i < 5000; i++) { const v = R(); g.fillStyle = v < .55 ? `rgba(0,0,0,${R() * .22})` : `rgba(255,245,225,${R() * .14})`; g.fillRect(R() * 256, R() * 256, 1 + (R() < .3), 1 + (R() < .3)); }
    for (let i = 0; i < 140; i++) { const x = R() * 256, y = R() * 256, r = .6 + R() * 1.8; g.fillStyle = `rgba(0,0,0,${.1 + R() * .15})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  }

  /* ---------- the floor's cells ---------- */
  function cellColour(S, i, c, r, out, backWall) {
    const m = backWall ? S.orig[i] : S.mat[i];
    if (m === MAT.AIR) { out[0] = out[1] = out[2] = out[3] = 0; return; }
    const info = MAT_INFO[m], t = S.tex[i] / 255, x = S.cx(c), y = S.cy(r);
    let R = lerp(info.col[0], info.col2[0], t), Gc = lerp(info.col[1], info.col2[1], t), B = lerp(info.col[2], info.col2[2], t);
    let f = 1;
    const depth = y - S.surfaceAt(x);
    if (m === MAT.ROCK) f *= 1 + Math.sin(x * .31 + Math.sin(y * .2) * 2) * .05;
    if (m === MAT.COBBLE) f *= .92 + Math.sin(x * .7 + y * .5) * .08;
    if (m === MAT.MUD || m === MAT.CLAY || m === MAT.GRAVEL) { f *= 1 - clamp(depth / 200, 0, 1) * .45; if (depth < 6) { R = lerp(R, 128, .35); Gc = lerp(Gc, 120, .35); B = lerp(B, 100, .35); } }
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
    S.dirtyAll = false; S.paint.fill(0);
    for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, false);
    builtFor = S;
    const R = mulberry32(S.seed + 9);
    decor = { worms: [], pens: [], holes: [], shells: [] };
    for (let k = 0; k < 80; k++) decor.worms.push({ x: lerp(WORLD.gridL + 40, WORLD.gridR - 40, R()), s: .6 + R() * .6, ph: R() * TAU });
    for (let k = 0; k < 40; k++) decor.pens.push({ x: lerp(WORLD.gridL + 40, WORLD.gridR - 40, R()), s: .7 + R() * .8, ph: R() * TAU });
    for (let k = 0; k < 70; k++) decor.holes.push({ x: lerp(WORLD.gridL + 40, WORLD.gridR - 40, R()), s: .5 + R() * .8 });
    for (let k = 0; k < 50; k++) decor.shells.push({ x: lerp(WORLD.gridL + 40, WORLD.gridR - 40, R()), s: .4 + R() * .6, a: R() * TAU });
  }
  function updateCells(S) {
    if (builtFor !== S) buildCells(S);
    if (S.dirtyAll) { S.dirtyAll = false; S.paint.fill(0); for (let r = 0; r < S.rows; r += 40) for (let c = 0; c < S.cols; c += 40) paintCells(S, c, r, c + 39, r + 39, false); }
  }

  /* ---------- the frame ---------- */
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  /* the water by depth: green-blue at the top, blue, then black */
  const SEA_STOPS = [[0, [86, 176, 196]], [70, [40, 128, 170]], [200, [18, 80, 136]], [380, [8, 40, 88]], [600, [3, 16, 42]], [900, [1, 6, 16]]];
  function seaCol(y) { let i = 0; while (i < SEA_STOPS.length - 2 && SEA_STOPS[i + 1][0] <= y) i++; const a = SEA_STOPS[i], b = SEA_STOPS[i + 1]; return mixRgb(a[1], b[1], clamp((y - a[0]) / (b[0] - a[0]), 0, 1)); }
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
    const winter = Wd.season === 'winter', bloom = Wd.bloom * (Wd.season === 'spring' ? 1 : .5);

    /* --- the sea body, darker with depth (greener in the bloom) --- */
    const topDepth = Math.max(0, view.t), botDepth = Math.max(topDepth + 10, view.b);
    if (!gx) {
      const sea = ctx.createLinearGradient(0, cam.toScreen(0, topDepth)[1], 0, cam.toScreen(0, Math.min(botDepth, 1000))[1]);
      for (const [d] of SEA_STOPS) { const u = clamp((d - topDepth) / (Math.min(botDepth, 1000) - topDepth), 0, 1); let c = seaCol(d); if (d < 220) c = mixRgb(c, [70, 150, 110], bloom * .35 * (1 - d / 220)); sea.addColorStop(u, rgbStr(mixRgb(c, [6, 14, 34], night * .65 + (winter ? .1 : 0)))); }
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
      if (weather.snow > .02 && seaSY > 0) drawFlakes(G, seaSY, dt);
      ctx.save(); cam.apply(ctx);
      if (!gx) {
        ctx.strokeStyle = `rgba(240,250,255,${.8 - night * .4})`; ctx.lineWidth = 1.6 / Math.max(.6, cam.zoom) * 2;
        ctx.beginPath(); for (let x = view.l; x <= view.r; x += 3) { const y = Wd.surfaceY(x); x === view.l ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
        ctx.fillStyle = `rgba(200,235,255,${.18 * (1 - night * .5)})`;
        ctx.beginPath(); ctx.moveTo(view.l, Wd.surfaceY(view.l)); for (let x = view.l; x <= view.r; x += 3) ctx.lineTo(x, Wd.surfaceY(x)); ctx.lineTo(view.r, Wd.surfaceY(view.r) + 4); for (let x = view.r; x >= view.l; x -= 3) ctx.lineTo(x, Wd.surfaceY(x) + 4 + Math.sin(x * .05 + time) * 1.5); ctx.closePath(); ctx.fill();
      }
      if (weather.storm > .05) { ctx.fillStyle = `rgba(255,255,255,${.35 * weather.storm})`; for (let x = view.l; x <= view.r; x += 30) { const y = Wd.surfaceY(x); ctx.beginPath(); ctx.ellipse(x + Math.sin(time * 2 + x) * 4, y - 1, 9, 2, 0, 0, TAU); ctx.fill(); } }
      ctx.restore();
    }
    /* light rays from the surface by day */
    const day = 1 - night;
    if (!gx && day > .05 && seaSY < H) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 10; k++) {
        const bx = (k / 10 + ((time * .01 + k * .37) % .1)) * W, len = H * .95;
        const lg = ctx.createLinearGradient(0, seaSY, 0, seaSY + len);
        lg.addColorStop(0, `rgba(210,245,255,${.15 * day * (1 - weather.cloud * .7) * clamp(1 - topDepth / 380, 0, 1)})`); lg.addColorStop(1, 'rgba(200,240,255,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(bx, seaSY); ctx.lineTo(bx + 30 + Math.sin(time * .5 + k) * 10, seaSY); ctx.lineTo(bx + 150, seaSY + len); ctx.lineTo(bx + 70, seaSY + len); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    if (!gx) drawHaze(G, night, time);

    /* ---------------- world space ---------------- */
    drawCellLayer(G, S, view);
    ctx.save();
    cam.apply(ctx);
    drawRim(G, S, view);
    drawFloorDecor(G, S, view);
    drawSnowWorld(G, Wd, view);
    drawSleepers(G, Wd, view, time);
    for (const j of Wd.jellies) if (j.x > view.l - 80 && j.x < view.r + 80 && j.y > view.t - 80 && j.y < view.b + 80) Art().drawCombJelly(ctx, j, time);
    drawBig(G, Wd, view);
    drawSibs(G, Wd, view, time);
    drawMateAndTrail(G, Wd, view, time);
    for (const e of Wd.eggs) { if (e.x < view.l || e.x > view.r || e.y < view.t || e.y > view.b) continue; ctx.save(); ctx.translate(e.x, e.y); ctx.globalAlpha = clamp((40 - e.t) / 4, 0, 1); Art().drawEgg(ctx, { s: 1.05 }); ctx.restore(); }
    ctx.globalAlpha = 1;
    for (const q of Wd.plankton) if (q.x > view.l && q.x < view.r && q.y > view.t && q.y < view.b) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1.4, 1.4); ctx.translate(-q.x, -q.y); Art().drawPlankton(ctx, q, night, time); ctx.restore(); }
    if (Wd.mum) { const m = Wd.mum; ctx.save(); ctx.translate(m.x, m.y); ctx.scale(m.face, 1); ctx.globalAlpha = clamp((9 - m.t) / 3, 0, 1); Art().drawCopepod(ctx, { s: 1.1, form: m.form, step: 12, sex: 'girl', ph: m.ph, gut: .6, oil: .3 }); ctx.restore(); }
    drawPlayer(G, p, time);
    G.particles.draw(ctx, cam);
    ctx.restore();

    /* ---------------- light ---------------- */
    const deep = clamp((cam.y - 150) / 600, 0, 1);
    if (gx) {
      const sm = sunMoonPos(tod, night, seaSY, weather.cloud);
      GFX.render(G, { night, warm: (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - weather.cloud) * (1 - deep), deep, top, bot,
        sun: sm.sun, moon: sm.moon, seaLevel: Wd.seaLevel(), surf: (sx) => cam.toScreen(0, Wd.surfaceY((sx - W / 2) / cam.zoom + cam.x))[1],
        floorY: S.surfaceAt(cam.x), farK: clamp((cam.y - 600) / 250, 0, 1), winter, bloom, underground: false });
      ctx = mainCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.save(); cam.apply(ctx); drawGlows(G, Wd, view, night, time); ctx.restore();
      if (!clean) drawOverlays(G, night, time);
      Cinematic.draw(ctx, W, H);
      return;
    }
    const dark = Math.max(night * .7, weather.cloud * .22) + deep * .2 * (1 - night);
    if (dark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${lerp(255, 60, dark) | 0},${lerp(255, 90, dark) | 0},${lerp(255, 150, dark) | 0})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    const warm = (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - weather.cloud) * (1 - deep);
    if (warm > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,70,${warm * .4})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    ctx.save(); cam.apply(ctx); drawGlows(G, Wd, view, night, time); ctx.restore();
    drawSpecks(G, time, dt, deep, night);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(2,14,34,${.4 + night * .2})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (!clean) drawOverlays(G, night, time);
    Cinematic.draw(ctx, W, H);
  }

  /* where the sun and the moon are on screen (CSS px); vis 0 when not up */
  function sunMoonPos(tod, night, horizon, cloud) {
    const skyTop = horizon * .85, out = { sun: { x: W * .5, y: -H, vis: 0 }, moon: { x: W * .5, y: -H, vis: 0 } };
    if (tod > .22 && tod < .82) { const t = invLerp(.22, .82, tod); out.sun = { x: W * (.1 + .8 * t), y: horizon - Math.sin(Math.PI * t) * Math.max(80, skyTop) + 10, vis: (1 - cloud * .7) * clamp(Math.sin(Math.PI * t) * 4, 0, 1) }; }
    if (night > .05) { const t = tod > .5 ? invLerp(.78, 1.28, tod) : invLerp(-.22, .28, tod); out.moon = { x: W * (.15 + .7 * t), y: horizon - Math.sin(Math.PI * clamp(t, 0, 1)) * Math.max(80, skyTop) * .9 - 10, vis: night * (1 - cloud * .8) }; }
    return out;
  }
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
  /* far away in the blue: soft clouds of plankton and a shoal turning, fading with depth */
  const shoals = Array.from({ length: 3 }, (_, i) => ({ ph: i * 2.1, y: .2 + i * .27, n: 26 + i * 6, dir: i % 2 ? -1 : 1, sp: .006 + i * .003 }));
  function drawHaze(G, night, time) {
    const cam = G.cam, k = clamp(1 - cam.y / 500, 0, 1);
    if (k <= 0) return;
    ctx.save();
    for (const sh of shoals) {
      const cx = (((sh.ph * .17 + time * sh.sp * sh.dir - cam.x * .00012) % 1.4) + 1.4) % 1.4 * W - W * .2, cy = sh.y * H + Math.sin(time * .2 + sh.ph) * 20 - cam.y * .05;
      ctx.fillStyle = `rgba(150,190,220,${.07 * k * (1 - night * .7)})`;
      for (let j = 0; j < sh.n; j++) { const a = j * 2.399 + time * .3 * sh.dir, r = Math.sqrt(j) * 9; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 1.8, cy + Math.sin(a) * r * .7, 5, 1.6, sh.dir * .1, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  /* specks drifting past the camera (thicker in the deep), and on dark nights the sea twinkles */
  function drawSpecks(G, time, dt, deep, night) {
    ctx.fillStyle = 'rgba(230,245,255,.55)';
    const n = quality === 'low' ? 40 : 60 + Math.round(deep * 40);
    for (let i = 0; i < n; i++) {
      const s = specks[i];
      s.y += dt * .01 * s.z; s.x += Math.sin(time * .3 + s.ph) * dt * .004;
      if (s.y > 1) s.y = 0;
      const x = ((s.x - G.cam.x * .0006 * s.z) % 1 + 1) % 1 * W, y = ((s.y - G.cam.y * .0006 * s.z) % 1 + 1) % 1 * H;
      ctx.globalAlpha = .15 + s.z * .35; ctx.fillRect(x, y, 1 + s.z * 1.4, 1 + s.z * 1.4);
    }
    ctx.globalAlpha = 1;
  }
  function drawCellLayer(G, S, view) {
    const cam = G.cam, b = bufCtx;
    if (view.b < WORLD.gridT) return;
    const sx0 = clamp(Math.floor((view.l - S.X0) / S.C) - 1, 0, S.cols), sy0 = clamp(Math.floor((view.t - S.Y0) / S.C) - 1, 0, S.rows);
    const sx1 = clamp(Math.ceil((view.r - S.X0) / S.C) + 1, 0, S.cols), sy1 = clamp(Math.ceil((view.b - S.Y0) / S.C) + 1, 0, S.rows);
    if (sx1 <= sx0 || sy1 <= sy0) return;
    const src = [sx0 * HI, sy0 * HI, (sx1 - sx0) * HI, (sy1 - sy0) * HI], dst = [S.X0 + sx0 * S.C, S.Y0 + sy0 * S.C, (sx1 - sx0) * S.C, (sy1 - sy0) * S.C];
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, buf.width, buf.height);
    b.setTransform(DPR, 0, 0, DPR, 0, 0);
    b.save(); cam.apply(b);
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    b.drawImage(hi, ...src, ...dst);
    if (view.b > WORLD.gridB) { b.fillStyle = '#2a2622'; b.fillRect(view.l, WORLD.gridB - 1, view.r - view.l, view.b - WORLD.gridB + 1); }
    b.globalCompositeOperation = 'source-atop';
    b.globalAlpha = quality === 'low' ? .5 : .85; b.fillStyle = grainPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    b.globalAlpha = 1;
    const fp = painting() && Painted.floorPattern(b);
    if (fp) { b.fillStyle = fp; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t); }
    b.restore(); b.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (quality !== 'low') { ctx.shadowColor = 'rgba(2,6,14,.7)'; ctx.shadowBlur = 8 * DPR * Math.min(2, cam.zoom); ctx.shadowOffsetY = 2 * DPR * cam.zoom; }
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  }
  function drawSunMoon(G, tod, night, horizon, cloud) {
    const sm = sunMoonPos(tod, night, horizon, cloud);
    if (sm.sun.vis > 0) {
      const { x, y } = sm.sun;
      ctx.globalAlpha = 1 - cloud * .7;
      const g = ctx.createRadialGradient(x, y, 8, x, y, 220); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(.12, 'rgba(255,230,160,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, y - 220, 440, 440);
      ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const { x, y } = sm.moon;
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
  /* a soft pale line along the mud's top */
  function drawRim(G, S, view) {
    const x0 = Math.max(view.l, WORLD.gridL), x1 = Math.min(view.r, WORLD.gridR), step = Math.max(1.5, 6 / G.cam.zoom);
    if (x1 <= x0 || view.b < WORLD.gridT) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [col, lw] of [['rgba(30,26,20,.5)', 5], ['rgba(150,140,118,.85)', 2]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw / G.cam.zoom; ctx.beginPath();
      for (let x = x0; x <= x1; x += step) { const y = S.topAt(x) + (lw > 3 ? 1.2 : 0); x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  /* on the mud: burrow holes, tube worms with feathery crowns, sea pens, old shells */
  function drawFloorDecor(G, S, view) {
    if (!decor || view.b < WORLD.gridT) return;
    const time = G.time;
    for (const h of decor.holes) { if (h.x < view.l || h.x > view.r) continue; const y = S.topAt(h.x); ctx.fillStyle = 'rgba(20,16,12,.6)'; ctx.beginPath(); ctx.ellipse(h.x, y + .6, 2.4 * h.s, .9 * h.s, 0, 0, TAU); ctx.fill(); }
    for (const sh of decor.shells) { if (sh.x < view.l || sh.x > view.r) continue; const y = S.topAt(sh.x); ctx.save(); ctx.translate(sh.x, y); ctx.rotate(sh.a * .2); ctx.fillStyle = 'rgba(210,200,180,.7)'; ctx.beginPath(); ctx.ellipse(0, 0, 3 * sh.s, 1.3 * sh.s, 0, Math.PI, TAU); ctx.fill(); ctx.restore(); }
    for (const wm of decor.worms) {
      if (wm.x < view.l || wm.x > view.r) continue; const y = S.topAt(wm.x);
      ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 1.2 * wm.s; ctx.beginPath(); ctx.moveTo(wm.x, y + 1); ctx.lineTo(wm.x + Math.sin(time + wm.ph) * 1.5, y - 8 * wm.s); ctx.stroke();
      ctx.strokeStyle = '#e8a070'; ctx.lineWidth = .7; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .5 + Math.sin(time * 2 + wm.ph + k) * .2; ctx.beginPath(); ctx.moveTo(wm.x, y - 8 * wm.s); ctx.lineTo(wm.x + Math.cos(a) * 4 * wm.s, y - 8 * wm.s + Math.sin(a) * 4 * wm.s); ctx.stroke(); }
    }
    for (const pn of decor.pens) {
      if (pn.x < view.l || pn.x > view.r) continue; const y = S.topAt(pn.x), h = 22 * pn.s, sway = Math.sin(time * .6 + pn.ph) * 2;
      ctx.strokeStyle = '#d8b090'; ctx.lineWidth = 1.1 * pn.s; ctx.beginPath(); ctx.moveTo(pn.x, y + 1); ctx.quadraticCurveTo(pn.x + sway * .5, y - h * .5, pn.x + sway, y - h); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,200,170,.8)'; ctx.lineWidth = .6;
      for (let k = 2; k < 9; k++) { const u = k / 9, px = pn.x + sway * u, py = y - h * u; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + s2 * 3.2 * pn.s * (1 - u * .5), py - 1.6); ctx.stroke(); } }
    }
  }
  /* marine snow sinking past: soft pale flakes, bigger and more of them in the deep */
  function drawSnowWorld(G, Wd, view) {
    for (const f of Wd.flakes) {
      if (f.x < view.l || f.x > view.r || f.y < view.t || f.y > view.b) continue;
      const a = clamp(.25 + f.y / 1200, .25, .8);
      ctx.fillStyle = `rgba(232,240,236,${a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.s, f.s * .7, f.ph, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(180,170,140,${a * .5})`; ctx.beginPath(); ctx.arc(f.x + f.s * .3, f.y + f.s * .2, f.s * .4, 0, TAU); ctx.fill();
    }
  }
  function drawSleepers(G, Wd, view, time) {
    for (const s of Wd.sleepers) {
      if (s.x < view.l - 20 || s.x > view.r + 20 || s.y < view.t - 20 || s.y > view.b + 20) continue;
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.face, 1); ctx.rotate(s.waking ? -.5 : .15);
      ctx.globalAlpha = .85;
      Art().drawCopepod(ctx, { s: .95, form: 'red', step: s.waking > .5 ? 12 : 11, ph: time * (s.waking ? 3 : .2) + s.ph, oil: s.oil, gut: .1, sleep: !s.waking, simple: true });
      ctx.restore();
    }
  }
  function drawBig(G, Wd, view) {
    const w = Wd.whale;
    if (w) { ctx.save(); ctx.translate(w.x, w.y); ctx.scale(w.dir, 1); Art().drawWhale(ctx, { s: .32, t: w.t, open: w.open }); ctx.restore(); }
    const sh = Wd.shark;
    if (sh) { ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(sh.dir, 1); Art().drawBaskingShark(ctx, { s: .6, t: sh.t, gulp: sh.gulp }); ctx.restore(); }
    const sc = Wd.school;
    if (sc) for (const f of sc.fish) { const x = sc.x + f.dx, y = sc.y + f.dy + Math.sin(sc.t * 2 + f.ph) * 5; if (x < view.l - 60 || x > view.r + 60) continue; ctx.save(); ctx.translate(x, y); ctx.scale(sc.dir * f.s, f.s); Art().drawFish(ctx, { ph: f.ph, col: '#d8e4ee', col2: '#2a4a6a' }); ctx.restore(); }
  }
  function drawSibs(G, Wd, view, time) {
    for (const s of Wd.sibs) {
      if (s.x < view.l || s.x > view.r || s.y < view.t || s.y > view.b) continue;
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.face, 1); ctx.globalAlpha = .8;
      const r = copR(s.step, .5);
      if (s.step <= 6) Art().drawNauplius(ctx, { s: r / 1.1, form: 'red', step: s.step, ph: s.ph, gut: .5, simple: true });
      else Art().drawCopepod(ctx, { s: r / 4.4, form: 'red', step: s.step, sex: s.sex, ph: s.ph, jump: s.jump, gut: .5, oil: s.step === 11 ? .6 : 0, simple: true });
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function drawMateAndTrail(G, Wd, view, time) {
    for (const q of Wd.trail) { if (q.x < view.l || q.x > view.r || q.y < view.t || q.y > view.b) continue; const a = clamp(1 - q.t / 60, .15, 1); ctx.fillStyle = `rgba(255,150,210,${.55 * a})`; ctx.beginPath(); ctx.arc(q.x, q.y, 1.4, 0, TAU); ctx.fill(); }
    const m = Wd.mate; if (!m) return;
    ctx.save(); ctx.translate(m.x, m.y); ctx.scale(m.face, 1); ctx.globalAlpha = clamp(1 - (m.fade || 0), 0, 1);
    Art().drawCopepod(ctx, { s: 4.9 / 4.4, form: m.form, step: 12, sex: m.sex, ph: m.ph, gut: .6, oil: .5, ripe: m.sex === 'girl' && m.laying });
    ctx.restore();
    /* a pink heart bobs over the one you are looking for */
    const p = G.player;
    if (!p.flags.met && m.mode !== 'leave') { ctx.fillStyle = '#ff7aa8'; ctx.font = `900 ${Math.max(6, 14 / G.cam.zoom * 2)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('♥', m.x, m.y - 14 - Math.sin(time * 3) * 2); }
  }
  function drawGlows(G, Wd, view, night, time) {
    ctx.globalCompositeOperation = 'lighter';
    for (const q of Wd.plankton) {
      if (q.kind !== 'dino' || q.x < view.l || q.x > view.r) continue;
      const a = Math.min(1, night * .4 + q.glow);
      if (a < .05) continue;
      const r = 2.5 + q.glow * 4, g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      g.addColorStop(0, `rgba(120,230,255,${a})`); g.addColorStop(1, 'rgba(120,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
    }
    /* the scent trail shimmers pink; eggs just let go sparkle */
    for (const q of Wd.trail) { if (q.x < view.l || q.x > view.r) continue; const a = clamp(1 - q.t / 60, .1, 1) * (.25 + .15 * Math.sin(time * 4 + q.x)); const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 5); g.addColorStop(0, `rgba(255,140,210,${a})`); g.addColorStop(1, 'rgba(255,140,210,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, TAU); ctx.fill(); }
    for (const e of Wd.eggs) { if (e.t > 2 || e.x < view.l || e.x > view.r) continue; const a = (1 - e.t / 2) * (.2 + night * .2), g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 3); g.addColorStop(0, `rgba(255,240,190,${a})`); g.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 3, 0, TAU); ctx.fill(); }
    const p = G.player;
    if (p.mode === 'lay' && p.rel) { const u = (p.rel.t % LAY_PULSE) / LAY_PULSE, g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 10 + u * 30); g.addColorStop(0, `rgba(255,230,170,${.3 * u})`); g.addColorStop(1, 'rgba(255,230,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 10 + u * 30, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawPlayer(G, p, time) {
    ctx.save();
    const glowR = p.r * 5 + 6;
    const gg = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, glowR);
    gg.addColorStop(0, `rgba(255,240,190,${.14 + G.night * .16})`); gg.addColorStop(1, 'rgba(255,240,180,0)');
    if (!painting()) { ctx.fillStyle = gg; ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2); }
    ctx.translate(p.x, p.y);
    if (p.stage === 'egg') {
      ctx.strokeStyle = `rgba(255,240,150,${.5 + .4 * Math.sin(time * 4)})`; ctx.lineWidth = .25; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, TAU); ctx.stroke();
      Art().drawEgg(ctx, { s: 1.1, eye: p.flags.eggReady, crack: p.crack, ph: time }); ctx.restore(); return;
    }
    if (p.tumble > 0) ctx.rotate(p.spin);
    ctx.scale(p.face, 1); ctx.rotate(p.ang * p.face);
    if (p.mode === 'moult') {
      const k = 1 - p.molting / MOLT_T;
      ctx.globalAlpha = .45; drawBody(G, p, Math.max(1, p.step), time, { sleep: true }, .97);
      ctx.globalAlpha = 1; ctx.translate(k * p.r * 1.2, -k * p.r * .3);
      drawBody(G, p, Math.min(12, p.step + 1), time, {}, 1);
      ctx.restore(); return;
    }
    drawBody(G, p, p.step, time, {}, 1);
    ctx.restore();
  }
  function drawBody(G, p, step, time, extra, k) {
    const ph = p.phase * (p.moving ? 2.2 : 1), gut = clamp(p.step === 12 ? p.eggFood / G.diff().eggs : p.frac, 0, 1);
    if (step <= 6) Art().drawNauplius(ctx, Object.assign({ s: copR(step, p.frac) / 1.1 * k, form: p.form, step, ph, gut }, extra));
    else Art().drawCopepod(ctx, Object.assign({ s: copR(step, p.frac) / 4.4 * k, form: p.form, step, sex: p.sex, ph, jump: p.jumpAnim, oil: step >= 11 ? p.oil : 0, gut, sleep: p.mode === 'sleep', ripe: p.sex === 'girl' && p.flags.eggsReady && !p.flags.laid }, extra));
  }

  /* ---------- overlays: the depth gauge, egg-laying, arrows, labels ---------- */
  function arrow(x, y, a, col, alpha = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function pointTo(G, tx, ty, col, time) {
    const cam = G.cam, p = G.player, [sx, sy] = cam.toScreen(tx, ty), [px, py] = cam.toScreen(p.x, p.y);
    const a = Math.atan2(sy - py, sx - px), d = Math.min(Math.hypot(sx - px, sy - py) - 10, 80 + Math.sin(time * 5) * 10);
    if (d > 24) arrow(px + Math.cos(a) * d, py + Math.sin(a) * d, a, col, .75 + .25 * Math.sin(time * 5));
  }
  function ringMeter(cx, cy, u, ok, flash) {
    const R0 = 110, rr2 = lerp(R0, 26, u);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ok ? '#7dff7a' : 'rgba(255,230,140,.9)'; ctx.lineWidth = ok ? 8 : 5; ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, TAU); ctx.stroke();
    if (flash > 0) { ctx.strokeStyle = `rgba(255,255,200,${flash})`; ctx.lineWidth = 14 * flash; ctx.beginPath(); ctx.arc(cx, cy, 40 + (1 - flash) * 80, 0, TAU); ctx.stroke(); }
  }
  /* the depth gauge down the left: the light from the top, the dark below, the floor, and you */
  function drawGauge(G, night, time) {
    const p = G.player, Wd = G.world;
    if (p.stage === 'egg') return;
    const x = 14, w = 16, y0 = Math.max(130, H * .2), y1 = H - Math.max(150, H * .2), h = y1 - y0;
    if (h < 120) return;
    const Y = (d) => y0 + clamp(d / WORLD.floor, 0, 1) * h;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, x - 4, y0 - 26, w + 8, h + 40, 10); ctx.fill();
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (let k = 0; k <= 10; k++) { const d = k / 10 * WORLD.floor, L = lightAt(d, G.tod, Wd.weather.cloud), c = seaCol(d); g.addColorStop(k / 10, rgbStr(mixRgb(mixRgb(c, [5, 10, 24], night * .7), [255, 250, 210], L * .5))); }
    ctx.fillStyle = g; rr(ctx, x, y0, w, h, 6); ctx.fill();
    /* the light line: above it a fish can see you by day */
    if (night < .5) { let d = 0; while (d < WORLD.floor && lightAt(d, G.tod, Wd.weather.cloud) > .12) d += 5; const ly = Y(d); ctx.strokeStyle = 'rgba(255,240,160,.9)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x - 2, ly); ctx.lineTo(x + w + 2, ly); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = '#5a5244'; ctx.fillRect(x, y1 - 5, w, 5);
    ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(night > .5 ? '🌙' : '☀️', x + w / 2, y0 - 13);
    const py = Y(p.y);
    ctx.fillStyle = '#fff3b0'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w + 3, py); ctx.lineTo(x + w + 13, py - 7); ctx.lineTo(x + w + 13, py + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + w / 2, py, 4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawOverlays(G, night, time) {
    const p = G.player, cam = G.cam, Wd = G.world;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawGauge(G, night, time);
    if (p.mode === 'lay' && p.rel) {
      const u = (p.rel.t % LAY_PULSE) / LAY_PULSE, ok = p.layWindow(), [sx, sy] = cam.toScreen(p.x, p.y);
      ringMeter(sx, sy, u, ok, p.rel.flash);
      const need = G.diff().lays, by = H - 180;
      for (let k = 0; k < need; k++) { ctx.fillStyle = k < p.rel.good ? '#ffe9a0' : 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(W / 2 - (need - 1) * 14 + k * 28, by, 9, 0, TAU); ctx.fill(); }
      ctx.font = `900 ${Math.round(Math.min(26, W * .045))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = ok ? '#7dff7a' : '#fff3c0';
      const txt = ok ? 'LAY!' : 'Wait for the green ring…';
      ctx.strokeText(txt, W / 2, by + 34); ctx.fillText(txt, W / 2, by + 34);
    }
    /* arrows to where you should go */
    if (p.stage !== 'egg' && p.mode === 'swim' && p.tumble <= 0) {
      const L = Wd.light(p.y);
      if (p.step === 11 && p.oil >= 1 && !p.flags.slept) pointTo(G, p.x, p.y + 200, '#7fe0ff', time);
      else if (p.step === 12 && p.sex === 'boy' && !p.flags.met && Wd.mate) { const q = Wd.trailAhead(p); const tgt = q && Math.hypot(Wd.mate.x - p.x, Wd.mate.y - p.y) > 60 ? q : Wd.mate; pointTo(G, tgt.x, tgt.y, '#ff9ad0', time); }
      else if (p.step === 12 && p.sex === 'girl' && p.flags.met && !p.flags.laid && p.y > 200) pointTo(G, p.x, p.y - 200, '#b7f07a', time);
      else if (p.step >= 7 && p.step < 12 && G.night < .3 && L > .08) pointTo(G, p.x, p.y + 200, '#a8e0ff', time);
      else if (p.step >= 7 && p.step < 12 && G.night > .6 && p.y > 230 && !(p.step === 11 && p.oil >= 1)) pointTo(G, p.x, p.y - 200, '#ffe9a0', time);
    }
    /* off-screen things that matter */
    const targets = [];
    if (Wd.school && !Wd.school.hitDone) targets.push([Wd.school.x, Wd.school.y, '#ff6a6a']);
    if (Wd.whale && !Wd.whale.hitDone) { const m = Wd.whaleMouth(); targets.push([m.x, m.y, '#ff6a6a']); }
    if (Wd.mate && !p.flags.met) targets.push([Wd.mate.x, Wd.mate.y, '#ff9ad0']);
    for (const [x, y, col] of targets) {
      const [sx, sy] = cam.toScreen(x, y);
      if (sx > 40 && sx < W - 40 && sy > 110 && sy < H - 60) continue;
      const cx = clamp(sx, 50, W - 50), cy = clamp(sy, 130, H - 80);
      arrow(cx, cy, Math.atan2(sy - cy, sx - cx), col);
    }
    if (G.settings.labels) drawLabels(G);
  }
  function drawLabels(G) {
    const cam = G.cam, Wd = G.world, p = G.player;
    ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, t) => { const [sx, sy] = cam.toScreen(x, y); if (sx < 0 || sx > W || sy < 100 || sy > H) return; const w = ctx.measureText(t).width + 14; ctx.fillStyle = 'rgba(255,252,240,.85)'; rr(ctx, sx - w / 2, sy - 11, w, 22, 11); ctx.fill(); ctx.fillStyle = '#2a2016'; ctx.fillText(t, sx, sy); };
    const v = cam.viewRect(0), seen = new Set();
    for (const q of Wd.plankton) { if (seen.has(q.kind) || Math.hypot(q.x - p.x, q.y - p.y) > 70) continue; seen.add(q.kind); tag(q.x, q.y - 6, { diatom: 'diatom', chain: 'diatom chain', dino: 'dinoflagellate' }[q.kind]); }
    for (const j of Wd.jellies) if (j.x > v.l && j.x < v.r && j.y > v.t && j.y < v.b) tag(j.x, j.y - j.r - 12, 'comb jelly');
    if (Wd.shark) tag(Wd.shark.x, Wd.shark.y - 120, 'basking shark');
    if (Wd.whale) tag(Wd.whale.x, Wd.whale.y - 60, 'right whale');
    if (Wd.school) tag(Wd.school.x, Wd.school.y - 50, 'herring');
    if (Wd.mate) tag(Wd.mate.x, Wd.mate.y - 16, Wd.mate.sex === 'girl' ? 'girl copepod' : 'boy copepod');
    const sib = Wd.sibs.find(s => s.x > v.l && s.x < v.r && s.y > v.t && s.y < v.b); if (sib) tag(sib.x, sib.y - 10, sib.step <= 6 ? 'nauplius' : 'copepod');
    if (Wd.flakes.length && p.y > 400) { const f = Wd.flakes.find(f2 => f2.x > v.l && f2.x < v.r && f2.y > v.t && f2.y < v.b); if (f) tag(f.x, f.y - 8, 'marine snow'); }
    tag(p.x, p.y - p.r * 3 - 8, STEP_NAME[p.step]);
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
