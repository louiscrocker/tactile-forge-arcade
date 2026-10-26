/* ============================================================
   render.js — drawing the castle, back to front
   ============================================================
   Sky, sun, moon and far hills (classic: Canvas 2D here; painted:
   gfx.js paints them on the GPU and this module draws only the
   world into a transparent layer) · the earth and the moat · the
   rooms' back walls · the walls, floors, windows, doors, roofs,
   spires and stairs · rugs, wall hangings and furniture · the
   animals and the people · the battlements and the gate grids in
   front · the sky folk (pigeons, the owl, the dragon) · the
   carriage · particles · weather · night (classic) · overlays
   (the build cursor, room names, the cinematic bars).
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1, quality = 'high', fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  const stars = [], flakes = [], drops = [];
  const SKY = [[0, '#0a0f2e', '#141c4a'], [.2, '#0a0f2e', '#1a2450'], [.27, '#e8805a', '#ffd2a0'], [.36, '#4a9ae0', '#bfe3ff'], [.5, '#3a86e6', '#b8dcff'], [.7, '#4a88d8', '#d0e2ff'], [.78, '#e07a50', '#ffc890'], [.86, '#1a2050', '#3a3a70'], [1, '#0a0f2e', '#141c4a']];
  const C = CELL;

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    if (typeof GFX !== 'undefined' && GFX.init(c)) GFX.setQualitySource(() => quality);
    for (let i = 0; i < 220; i++) stars.push([Math.random(), Math.random() * .7, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 160; i++) flakes.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, ph: Math.random() * TAU });
    for (let i = 0; i < 220; i++) drops.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7 });
  }
  function resize(w, h, dpr) {
    W = w; H = h; DPR = quality === 'low' ? 1 : dpr;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    if (typeof GFX !== 'undefined') GFX.resize(w, h, DPR, canvas.width, canvas.height);
  }
  function setQuality(q) { if (q !== quality) { quality = q; resize(W, H, Math.min(2, devicePixelRatio || 1)); } }
  function getFps() { return fps; }
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  /* where the sun and the moon are on screen */
  function skyBodies(G, groundY) {
    const sunT = clamp((G.tod - .22) / .6, 0, 1), moonT = clamp((((G.tod + .5) % 1) - .22) / .6, 0, 1);
    const pos = (t) => [W * (.08 + .84 * t), groundY - Math.sin(Math.PI * t) * Math.min(H * .7, groundY * .9) - 10];
    const s = pos(sunT), m = pos(moonT);
    return { sun: { x: s[0], y: s[1], vis: G.tod > .2 && G.tod < .82 ? smoothstep(0, .06, Math.min(sunT, 1 - sunT)) : 0 }, moon: { x: m[0], y: m[1], vis: (G.tod > .72 || G.tod < .3) ? smoothstep(0, .06, Math.min(moonT, 1 - moonT)) : 0 } };
  }

  /* ---------- classic sky and far hills (screen space) ---------- */
  function classicSky(G, night, groundY, bodies, weather) {
    const [top, bot] = skyColours(G.tod);
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(groundY, 10)); g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (night > .02) { for (const s of stars) { const tw = .5 + .5 * Math.sin(G.time * (1 + s[2] * 2) + s[3]); ctx.globalAlpha = night * tw * (1 - weather.cloud) * .9; ctx.fillStyle = '#fff'; ctx.fillRect(s[0] * W, s[1] * groundY, 1.5 + s[2], 1.5 + s[2]); } ctx.globalAlpha = 1; }
    if (bodies.sun.vis > 0) { const sg = ctx.createRadialGradient(bodies.sun.x, bodies.sun.y, 10, bodies.sun.x, bodies.sun.y, 220); sg.addColorStop(0, `rgba(255,230,160,${.55 * bodies.sun.vis})`); sg.addColorStop(1, 'rgba(255,220,160,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H); ctx.fillStyle = `rgba(255,246,210,${bodies.sun.vis})`; ctx.beginPath(); ctx.arc(bodies.sun.x, bodies.sun.y, 26, 0, TAU); ctx.fill(); }
    if (bodies.moon.vis > 0) drawMoonDisc(ctx, bodies.moon.x, bodies.moon.y, 22, G.moon, bodies.moon.vis);
    /* clouds */
    ctx.fillStyle = `rgba(255,255,255,${.35 + .4 * weather.cloud})`;
    for (let k = 0; k < 7; k++) { const x = ((k * 263 + G.time * 6 + G.cam.x * .05) % (W + 400)) - 200, y = groundY * (.12 + (k % 3) * .14), s = 40 + (k % 4) * 18; ctx.globalAlpha = (.5 + .5 * weather.cloud) * (1 - night * .7); ctx.beginPath(); ctx.arc(x, y, s * .6, 0, TAU); ctx.arc(x + s * .6, y - s * .2, s * .5, 0, TAU); ctx.arc(x + s * 1.2, y, s * .55, 0, TAU); ctx.arc(x + s * .5, y + s * .25, s * .5, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    /* far hills with trees, three bands */
    const season = G.world.season, snow = G.world.weather.snow;
    const grass = season === 'winter' ? mixHex('#6a8a5a', '#eef2f8', snow) : season === 'autumn' ? '#9a8a3a' : '#4a8a3a';
    for (let i = 0; i < 3; i++) {
      const par = [.06, .14, .26][i], base = groundY - [170, 110, 50][i] * Math.min(1.2, G.cam.zoom), amp = [90, 70, 48][i] * Math.min(1.2, G.cam.zoom), haze = [.55, .32, .12][i];
      let col = mixHex(grass, bot, haze); col = mixHex(col, '#0a1030', night * .85);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += 10) { const ix = x + G.cam.x * G.cam.zoom * par + i * 711; const hh = amp * (.55 + .45 * Math.sin(ix / (420 - i * 90) + i * 13.7) * .5 + .4 * Math.sin(ix / 97 + i) * .5); ctx.lineTo(x, base - hh); }
      ctx.lineTo(W + 10, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = mixHex(mixHex(grass, bot, haze * .8), '#0a1030', night * .9);
      for (let x = -20; x <= W + 20; x += 14 - i * 2) { const ix = x + G.cam.x * G.cam.zoom * par + i * 711; const hh = amp * (.55 + .45 * Math.sin(ix / (420 - i * 90) + i * 13.7) * .5 + .4 * Math.sin(ix / 97 + i) * .5); const th = [10, 16, 24][i] * (.6 + .4 * Math.abs(Math.sin(ix * .37))); ctx.beginPath(); ctx.moveTo(x - 4, base - hh + 2); ctx.lineTo(x, base - hh - th); ctx.lineTo(x + 4, base - hh + 2); ctx.fill(); }
    }
  }
  function drawMoonDisc(g, x, y, r, phase, alpha = 1) {
    g.save(); g.globalAlpha = alpha;
    const mg = g.createRadialGradient(x, y, r, x, y, r * 4); mg.addColorStop(0, 'rgba(200,210,255,.25)'); mg.addColorStop(1, 'rgba(200,210,255,0)'); g.fillStyle = mg; g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    g.fillStyle = '#f6efd0'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    const p = ((phase % 1) + 1) % 1, k = Math.cos(p * TAU);
    g.fillStyle = 'rgba(20,24,60,.9)'; g.beginPath();
    if (p < .5) { g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, true); g.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k < 0); }
    else { g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false); g.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0); }
    g.fill(); g.restore();
  }

  /* ---------- the world ---------- */
  function roomBackWall(Wd, room, o) {
    const type = ROOM_TYPES[room.type] || ROOM_TYPES.empty, plaster = Painted.on() ? Painted.pattern('plaster') : null;
    for (const k of room.cells) {
      const cx = k % COLS, cy = (k - cx) / COLS, x = cx * C, y = cy * C;
      ctx.fillStyle = type.wall; ctx.fillRect(x, y, C, C);
      if (plaster) { ctx.globalAlpha = .55; ctx.fillStyle = plaster; ctx.fillRect(x, y, C, C); ctx.globalAlpha = 1; }
      /* darker under the ceiling, a skirting at the floor */
      if (cy === room.y0 || Wd.castle.grid.solid(cx, cy - 1)) { ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x, y, C, 6); }
      if (Wd.castle.grid.solid(cx, cy + 1)) { ctx.fillStyle = type.floor; ctx.fillRect(x, y + C - 5, C, 5); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x, y + C - 5, C, 1.5); }
      if (room.type === 'throne' || room.type === 'hall') { ctx.fillStyle = 'rgba(120,60,40,.12)'; if ((cx + cy) % 2) ctx.fillRect(x, y, C, C); }
      if (room.type === 'cellar' || room.type === 'armoury' || room.type === 'forge') { Sprites.stoneFace(ctx, x, y, C, C, Wd.castle.grid.variant(cx, cy), false); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y, C, C); }
    }
    if (o.night > .05 && !room.items.some(it => ITEMS[it.key].light)) { ctx.fillStyle = `rgba(10,14,40,${o.night * .35})`; for (const k of room.cells) { const cx = k % COLS, cy = (k - cx) / COLS; ctx.fillRect(cx * C, cy * C, C, C); } }
  }
  function drawItems(Wd, G, layer, o) {
    const C2 = Wd.castle;
    for (const it of C2.items) {
      const d = ITEMS[it.key]; if (C2.layerOf(it.key) !== layer) continue;
      const x = it.cx * C, y = (it.cy + 1) * C;
      if (x > o.view.r || x + d.w * C < o.view.l || y < o.view.t || y - d.h * C > o.view.b) continue;
      ctx.save(); ctx.translate(x, y);
      const lit = d.fire || o.night > .1 || it.key === 'lantern' && o.night > .05;
      const quint = it.key === 'quintain' && Wd.people.some(p => p.task && p.task.kind === 'use' && p.task.item === it) ? Math.sin(G.time * 4) * .5 : 0;
      Sprites.item(ctx, it.key, { t: G.time, lit, feast: Wd.feast, season: Wd.season, swing: quint, ring: Wd.bellRing > 0, robe: G.royalRobe });
      ctx.restore();
    }
  }
  function drawPerson(p, G) {
    let x = p.x, y = p.y;
    if (p.task && p.task.kind === 'use' && p.task.act === 'sleep' && p.task.item) { const it = p.task.item, d = ITEMS[it.key]; x = it.cx * C + d.w * C / 2; y = it.cy * C + C - d.h * C * .35; }
    ctx.save(); ctx.translate(x, y); Sprites.person(ctx, p.sprite()); ctx.restore();
  }
  function frame(G, dt, clean) {
    const { cam, world: Wd, tod, time } = G, castle = G.castle, grid = castle.grid, weather = Wd.weather;
    const night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    const gx = typeof GFX !== 'undefined' && GFX.active(), mainCtx = ctx;
    mainCtx.setTransform(1, 0, 0, 1, 0, 0); mainCtx.clearRect(0, 0, canvas.width, canvas.height);
    if (gx) { ctx = GFX.worldCtx(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    Painted.useContext(ctx);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';
    const view = cam.viewRect(60), groundY = cam.toScreen(0, GROUND_Y)[1], bodies = skyBodies(G, groundY);
    const warm = clamp(1 - Math.abs(tod - .27) / .08, 0, 1) + clamp(1 - Math.abs(tod - .79) / .08, 0, 1);
    if (!gx) classicSky(G, night, groundY, bodies, weather);

    /* --- the world, in world units --- */
    ctx.save(); cam.apply(ctx);
    const o = { time, snow: weather.snow, season: Wd.season, bridge: Wd.bridgeDown, gate: Wd.gateOpen, night, view, lit: false };
    const lit = Wd.litWindows();
    const cx0 = Math.max(0, Math.floor(view.l / C)), cx1 = Math.min(COLS - 1, Math.ceil(view.r / C)), cy0 = Math.max(0, Math.floor(view.t / C)), cy1 = Math.min(ROWS - 1, Math.ceil(view.b / C));
    /* earth beyond the grid */
    ctx.fillStyle = '#4a3220'; if (view.b > WORLD_H) ctx.fillRect(view.l, WORLD_H, view.r - view.l, view.b - WORLD_H);
    if (view.l < 0) { ctx.fillStyle = '#4a3220'; ctx.fillRect(view.l, GROUND_Y, -view.l, view.b - GROUND_Y); ctx.fillStyle = Wd.season === 'winter' ? mixHex('#5aa03a', '#f0f4ff', weather.snow) : '#5aa03a'; ctx.fillRect(view.l, GROUND_Y, -view.l, 7); }
    if (view.r > WORLD_W) { ctx.fillStyle = '#4a3220'; ctx.fillRect(WORLD_W, GROUND_Y, view.r - WORLD_W, view.b - GROUND_Y); ctx.fillStyle = Wd.season === 'winter' ? mixHex('#5aa03a', '#f0f4ff', weather.snow) : '#5aa03a'; ctx.fillRect(WORLD_W, GROUND_Y, view.r - WORLD_W, 7); }
    /* the ground rows */
    for (let cy = Math.max(cy0, GROUND); cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { const t = grid.get(cx, cy); if (t === T.WATER) continue; Sprites.tile(ctx, grid, cx, cy, t, o); }
    /* fish, then the water over them */
    for (const f of Wd.fish) { ctx.save(); ctx.translate(f.x, f.y); Sprites.fish(ctx, { face: f.dir, col: f.col }); ctx.restore(); }
    ctx.globalAlpha = .82; for (let cy = Math.max(cy0, GROUND); cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (grid.get(cx, cy) === T.WATER) Sprites.tile(ctx, grid, cx, cy, T.WATER, o); ctx.globalAlpha = 1;
    /* the village road on the right, a path to the gate */
    if (grid.get(COLS - 1, GROUND) === T.EARTH) { ctx.fillStyle = 'rgba(160,130,90,.5)'; ctx.fillRect((COLS - 6) * C, GROUND_Y + 1, 6 * C + Math.max(0, view.r - WORLD_W), 6); }
    /* rooms' back walls */
    for (const r of castle.rooms()) { if (r.tiny && r.cells.length < 2) continue; if (r.x1 * C < view.l || r.x0 * C > view.r || r.y1 * C < view.t || r.y0 * C > view.b) continue; roomBackWall(Wd, r, o); }
    /* the tiles above ground (battlements and gate grids come later, in front) */
    for (let cy = cy0; cy <= Math.min(cy1, GROUND - 1); cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const t = grid.get(cx, cy); if (t === T.AIR || t === T.BATTLEMENT) continue;
      o.lit = WINDOWS.has(t) && lit.has(cy * COLS + cx);
      Sprites.tile(ctx, grid, cx, cy, t, o);
    }
    o.lit = false;
    drawItems(Wd, G, 'rug', o); drawItems(Wd, G, 'wall', o); drawItems(Wd, G, 'floor', o);
    /* the small animals, then the horses and their riders, then everyone else */
    for (const m of Wd.mice) { ctx.save(); ctx.translate(m.x, m.y); Sprites.mouse(ctx, { face: m.face }); ctx.restore(); }
    for (const c of Wd.cats) { ctx.save(); ctx.translate(c.x, c.y); Sprites.cat(ctx, c.sprite()); ctx.restore(); }
    for (const d of Wd.dogs) { ctx.save(); ctx.translate(d.x, d.y); Sprites.dog(ctx, d.sprite()); ctx.restore(); }
    for (const h of Wd.horses) {
      if (h.x < view.l - 80 || h.x > view.r + 80) continue;
      ctx.save(); ctx.translate(h.x, h.y); Sprites.horse(ctx, h.sprite()); ctx.restore();
      if (h.rider) { const k = h.rider; ctx.save(); ctx.translate(h.x + h.face * -2, h.y - 30); Sprites.person(ctx, Object.assign(k.sprite(), { act: Wd.joust && Wd.joust.phase === 'bow' ? 'cheer' : 'ride', face: h.face })); if (Wd.joust && Wd.joust.phase === 'charge') { ctx.scale(h.face, 1); ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -28); ctx.lineTo(48, -34); ctx.stroke(); ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.arc(48, -34, 3, 0, TAU); ctx.fill(); ctx.fillStyle = k.look && k.look.robe ? k.look.robe : '#b03a3a'; ctx.beginPath(); ctx.moveTo(-10, -34); ctx.lineTo(-10, -22); ctx.lineTo(-4, -18); ctx.lineTo(2, -22); ctx.lineTo(2, -34); ctx.fill(); } ctx.restore(); }
    }
    for (const p of Wd.people) { if (p.rider) continue; if (p.x < view.l - 40 || p.x > view.r + 40) continue; drawPerson(p, G); }
    /* in front: battlements, the gate grids, the carriage */
    for (let cy = cy0; cy <= Math.min(cy1, GROUND - 1); cy++) for (let cx = cx0; cx <= cx1; cx++) { const t = grid.get(cx, cy); if (t === T.BATTLEMENT) Sprites.tile(ctx, grid, cx, cy, t, o); else if (t === T.GATE) Sprites.gateGrid(ctx, cx, cy, Wd.gateOpen); }
    if (Wd.carriage) { ctx.save(); ctx.translate(Wd.carriage.x, Wd.carriage.y); Sprites.carriage(ctx, { ph: Wd.carriage.ph, moving: Wd.carriage.state === 'in' || Wd.carriage.state === 'out', face: Wd.carriage.face }); ctx.restore(); }
    /* the sky folk */
    for (const s of Wd.swans) { ctx.save(); ctx.translate(s.x, s.y); Sprites.swan(ctx, { face: s.face, ph: s.ph }); ctx.restore(); }
    for (const b of Wd.pigeons) { ctx.save(); ctx.translate(b.x, b.y); Sprites.pigeon(ctx, { face: b.face, ph: b.ph, flying: b.flying }); ctx.restore(); }
    for (const b of Wd.butterflies) { ctx.save(); ctx.translate(b.x, b.y); Sprites.butterfly(ctx, b); ctx.restore(); }
    if (Wd.owl) { ctx.save(); ctx.translate(Wd.owl.x, Wd.owl.y); Sprites.owl(ctx, { ph: Wd.owl.ph, s: 1.1 }); ctx.restore(); }
    if (Wd.dragon.state !== 'away') { const d = Wd.dragon; ctx.save(); ctx.translate(d.x, d.y); Sprites.dragon(ctx, { ph: d.ph, face: d.face, flying: d.state !== 'landed', puff: d.puff, s: .85 }); ctx.restore(); }
    G.particles.draw(ctx, cam);
    ctx.restore();

    /* --- classic weather and night, in screen space --- */
    if (!gx) {
      if (weather.rain > .02) { ctx.strokeStyle = `rgba(200,220,255,${.35 * weather.rain})`; ctx.lineWidth = 1.2; ctx.beginPath(); for (const d of drops) { if (Math.random() > weather.rain) continue; const x = ((d.x * W + time * (120 + d.z * 160) * weather.wind) % (W + 40)) - 20, y = ((d.y * H + time * (600 + d.z * 300)) % (groundY + 20)); ctx.moveTo(x, y); ctx.lineTo(x - 3 - weather.wind * 6, y + 10 + d.z * 8); } ctx.stroke(); }
      if (weather.snowing > .02) { ctx.fillStyle = 'rgba(255,255,255,.85)'; for (const f of flakes) { const x = ((f.x * W + Math.sin(time * .7 + f.ph) * 30 + time * 20 * weather.wind) % (W + 20)) - 10, y = ((f.y * H + time * (30 + f.z * 40)) % (groundY + 10)); ctx.beginPath(); ctx.arc(x, y, 1 + f.z * 2, 0, TAU); ctx.fill(); } }
      if (night > .02) {
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(${lerp(255, 70, night) | 0},${lerp(255, 85, night) | 0},${lerp(255, 150, night) | 0},1)`; ctx.fillRect(0, 0, W, H); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const l of Wd.lights()) { const [sx, sy] = cam.toScreen(l.x, l.y), r = l.r * cam.zoom, fl = l.flicker ? .85 + .15 * Math.sin(time * 11 + l.x) : 1; const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, r); g.addColorStop(0, `rgba(${l.col[0] * 255 | 0},${l.col[1] * 255 | 0},${l.col[2] * 255 | 0},${.55 * l.i * fl * (l.fire ? 1 : night)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(sx - r, sy - r, r * 2, r * 2); }
        ctx.restore();
      }
      if (weather.flash > 0) { ctx.fillStyle = `rgba(230,240,255,${weather.flash * .6})`; ctx.fillRect(0, 0, W, H); }
    }

    /* --- the painted look: light it all on the GPU --- */
    if (gx) {
      const lights = Wd.lights().map(l => { const [sx, sy] = cam.toScreen(l.x, l.y); return { x: sx, y: sy, r: l.r, i: l.i, col: l.col, flicker: l.flicker, fire: l.col[1] < .6 }; });
      const [top, bot] = skyColours(tod);
      GFX.render(G, { night, warm, top, bot, sun: bodies.sun, moon: bodies.moon, groundY, cloud: weather.cloud, rain: weather.rain, snowing: weather.snowing || 0, snow: weather.snow, wind: weather.wind, flash: weather.flash, season: SEASONS.indexOf(Wd.season), lights });
      ctx = mainCtx; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    /* --- overlays (always on the main canvas) --- */
    if (!clean) overlays(G);
    Cinematic.draw(ctx, W, H);
    ctx = mainCtx;
  }

  function overlays(G) {
    const { cam, castle } = G, cur = G.cursor, tool = G.tool;
    ctx.save(); cam.apply(ctx);
    const z = 1 / cam.zoom;
    /* room names */
    if (G.settings.labels || (tool && tool.kind === 'name')) {
      for (const r of castle.rooms()) {
        if (r.tiny) continue;
        const type = ROOM_TYPES[r.type], x = (r.x0 + r.x1 + 1) / 2 * C, y = r.y0 * C + 4 * z;
        const txt = r.type === 'empty' ? 'Tap to name' : type.emoji + ' ' + (r.name || type.name);
        ctx.font = `800 ${13 * z}px ${UI_FONT}`; const w = ctx.measureText(txt).width + 14 * z;
        ctx.fillStyle = r.type === 'empty' ? 'rgba(255,240,180,.9)' : 'rgba(255,252,240,.88)'; rr(ctx, x - w / 2, y, w, 20 * z, 8 * z); ctx.fill();
        ctx.fillStyle = '#2a2016'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + 10 * z);
      }
    }
    if (G.settings.labels) {
      ctx.font = `800 ${11 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const tag = (x, y, s) => { const w = ctx.measureText(s).width + 8 * z; ctx.fillStyle = 'rgba(255,252,240,.85)'; rr(ctx, x - w / 2, y - 14 * z, w, 14 * z, 5 * z); ctx.fill(); ctx.fillStyle = '#2a2016'; ctx.fillText(s, x, y - 1.5 * z); };
      for (const p of G.world.people) tag(p.x, p.y - 56, p.role === 'royal' ? (ROYALS[G.sex] || ROYALS.princess).name : p.role);
      for (const h of G.world.horses) tag(h.x, h.y - 60, 'horse');
    }
    /* the hovered room with the Name tool */
    if (tool && tool.kind === 'name' && cur && cur.room) { ctx.fillStyle = 'rgba(255,220,100,.22)'; for (const k of cur.room.cells) { const cx = k % COLS, cy = (k - cx) / COLS; ctx.fillRect(cx * C, cy * C, C, C); } }
    /* the build cursor */
    if (cur && cur.cx !== undefined && tool && tool.kind !== 'hand' && tool.kind !== 'name') {
      const x = cur.cx * C, y = cur.cy * C;
      if (tool.kind === 'tile') {
        ctx.globalAlpha = .55; const t = TILE_BY_KEY[tool.key]; if (cur.ok) Sprites.tile(ctx, castle.grid, cur.cx, cur.cy, t, { time: G.time, snow: 0, bridge: 1, lit: false, season: G.world.season }); ctx.globalAlpha = 1;
        ctx.strokeStyle = cur.ok ? 'rgba(90,220,110,.95)' : 'rgba(240,80,80,.95)'; ctx.lineWidth = 2.5 * z; ctx.strokeRect(x + 1, y + 1, C - 2, C - 2);
      } else if (tool.kind === 'item') {
        const d = ITEMS[tool.key]; ctx.save(); ctx.translate(x, y + C); ctx.globalAlpha = .6; Sprites.item(ctx, tool.key, { t: G.time, lit: true, season: G.world.season }); ctx.restore();
        ctx.strokeStyle = cur.ok ? 'rgba(90,220,110,.95)' : 'rgba(240,80,80,.95)'; ctx.lineWidth = 2.5 * z; ctx.strokeRect(x + 1, y + C - d.h * C + 1, d.w * C - 2, d.h * C - 2);
      } else if (tool.kind === 'erase') {
        ctx.strokeStyle = 'rgba(240,80,80,.95)'; ctx.lineWidth = 3 * z; ctx.beginPath(); ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + C - 6, y + C - 6); ctx.moveTo(x + C - 6, y + 6); ctx.lineTo(x + 6, y + C - 6); ctx.stroke();
      }
    }
    /* someone with no way in: a little sign at the edge */
    ctx.restore();
  }

  function snapshot(G) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    frame(G, 0, true);
    if (typeof GFX !== 'undefined' && GFX.active()) c.getContext('2d').drawImage(GFX.canvas(), 0, 0, c.width, c.height);
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }
  function invalidate() {}

  return { init, resize, setQuality, getFps, frame, snapshot, invalidate, skyColours, drawMoonDisc, skyBodies };
})();
