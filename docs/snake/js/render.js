/* ============================================================
   render.js — the meadow, back to front
   ============================================================
     sky (time of day, season, weather) · stars · the sun · the
     moon in its real phase · two bands of far hills and woods
     trees · THE GROUND in cross-section: topsoil, the rocky hill's
     limestone, the crack of the winter den winding down to its
     chamber, the frost line (autumn and winter) · snow
     back grass, flowers, reeds · covers (boards, logs, rocks,
     slabs, the stone wall, leaf piles) · snacks that sparkle once
     smelled · shed skins · worms, frogs, grasshoppers · scent trails
     the snakes (the mother, the litter in their bags, the crowd,
     the girl and the other boys) · the raccoon, the heron, the
     scientist · YOU · particles · the pond's water in front (ice
     in winter), lily pads · front grass tufts · butterflies and
     dragonflies · the hawk and its shadow
     night (a moonlit multiply) · fireflies · the den's darkness ·
     blue-eye haze, cold and hot edges · rain, snow · vignette
     overlays: the birth glow ring, arrows, name tags
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1, quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  const SKY = [
    [0.00, '#070b22', '#14234a'], [0.19, '#141a44', '#5a3a62'], [0.25, '#7a8fc8', '#ffb98a'],
    [0.36, '#58a8e0', '#d8eef8'], [0.55, '#4b9ce0', '#cfe8f4'], [0.70, '#6aa0d8', '#ffd2a0'],
    [0.79, '#3d3f8c', '#ff8a5c'], [0.86, '#121a48', '#3a2f5c'], [1.00, '#070b22', '#14234a']
  ];
  const stars = [], flakes = [], drops = [];
  let hillNoise = null, decor = null, builtFor = null;
  const coilCache = new Map();

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    for (let i = 0; i < 220; i++) stars.push([Math.random(), Math.random() * .8, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 160; i++) flakes.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, ph: Math.random() * TAU });
    for (let i = 0; i < 140; i++) drops.push({ x: Math.random(), y: Math.random(), z: .4 + Math.random() * .6 });
    hillNoise = [makeNoise1D(5), makeNoise1D(9), makeNoise1D(17)];
  }
  function resize(w, h, dpr) {
    W = w; H = h; DPR = quality === 'low' ? 1 : dpr;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  }
  function setQuality(q) { if (q !== quality) { quality = q; resize(W, H, Math.min(2, devicePixelRatio || 1)); } }
  function getFps() { return fps; }
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = clamp((tod - a[0]) / (b[0] - a[0]), 0, 1);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  /* things in the ground that never move: pebbles, roots, fossils in the limestone */
  function buildDecor(Wd) {
    const R = mulberry32(Wd.seed * 3 + 1), L = Wd.land, out = { pebbles: [], roots: [], tufts: [] };
    for (let i = 0; i < 260; i++) { const x = lerp(WORLD.left, WORLD.right, R()), y = L.surfaceAt(x) + 14 + R() * 220; if (L.inPond(x) && y < L.surfaceAt(x) + 20) continue; out.pebbles.push({ x, y, r: 1.5 + R() * 4, c: R() }); }
    for (let i = 0; i < 40; i++) { const x = lerp(WORLD.meadowL, WORLD.woodsR, R()); if (L.inPond(x)) continue; out.roots.push({ x, y: L.surfaceAt(x), l: 14 + R() * 30, a: R() * .8 - .4 }); }
    for (let x = WORLD.left; x < WORLD.right; x += 46 + R() * 50) out.tufts.push({ x, h: 7 + R() * 7, n: 3 + ((R() * 3) | 0), ph: R() * TAU });
    decor = out; builtFor = Wd;
  }

  /* ============================================================ */
  function frame(G, dt, clean) {
    const { cam, world: Wd, tod, time } = G, p = G.player, L = Wd.land, wx = Wd.weather, season = Wd.season;
    const night = nightAmount(tod);
    G.night = night;
    if (builtFor !== Wd) buildDecor(Wd);
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const view = cam.viewRect(80);
    const horizon = cam.toScreen(0, -30)[1];

    /* --- the sky --- */
    let [top, bot] = skyColours(tod);
    if (season === 'winter') { top = mixHex(top, '#8a9ab0', .25); bot = mixHex(bot, '#dde4ec', .3); }
    if (wx.cloud > .01) { top = mixHex(top, '#4a5460', wx.cloud * .55); bot = mixHex(bot, '#9aa4ac', wx.cloud * .5); }
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(60, horizon + 40));
    sky.addColorStop(0, top); sky.addColorStop(1, bot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (night > .05 && wx.cloud < .85) {
      for (const [sx, sy, r, ph] of stars) { const y = sy * Math.max(80, horizon); ctx.globalAlpha = night * (.3 + .7 * (.5 + .5 * Math.sin(time * 2 + ph * 6))) * (1 - wx.cloud); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * W, y, .5 + r * 1.2, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    drawSunMoon(G, tod, night, horizon, wx.cloud);
    drawClouds(G, horizon, time, night);
    drawFarHills(G, night, season);

    /* ---------------- world space ---------------- */
    ctx.save(); cam.apply(ctx);
    const snow = wx.snowCover;
    for (const T of Wd.trees) if (T.x > view.l - 200 && T.x < view.r + 200) Sprites.drawTree(ctx, T, L.surfaceAt(T.x) + 4, season, time, snow);
    drawGround(G, Wd, L, view, night, season, snow, time);
    drawHawkShadow(G, Wd, L, night);
    drawBackGrass(G, Wd, L, view, season, time, snow);
    for (const c of Wd.covers) { if (c.x + c.w < view.l || c.x - c.w > view.r || c.lifted) continue; Sprites.drawCover(ctx, c, Wd, season, snow); }
    const under = (p.mode === 'hide' || p.mode === 'birth') && !!p.cover;
    if (under) drawPlayer(G, p, time);
    for (const c of Wd.covers) { if (!(under && p.cover === c)) continue; Sprites.drawCover(ctx, c, Wd, season, snow); }
    drawTrails(G, Wd, p, time);
    for (const s of Wd.snacks) { if (!s.seen || s.x < view.l || s.x > view.r) continue; ctx.globalAlpha = clamp(s.t * 2, 0, 1); Sprites.drawSnack(ctx, s, time); }
    ctx.globalAlpha = 1;
    for (const e of Wd.exuviae) { if (e.x < view.l - 100 || e.x > view.r + 100) continue; Sprites.drawExuvia(ctx, e, time); }
    for (const w of Wd.worms) Sprites.drawWorm(ctx, w);
    for (const c of Wd.critters) { if (c.x < view.l || c.x > view.r) continue; if (c.kind === 'frog' && c.state !== 'under') Sprites.drawFrog(ctx, c); else if (c.kind === 'hopper' && season !== 'winter') Sprites.drawHopper(ctx, c); }
    drawDenCrowd(G, Wd, L, season);
    if (Wd.mum) drawNPC(G, Wd.mum, time);
    for (const n of Wd.npcs) drawNPC(G, n, time);
    if (Wd.raccoon) Sprites.drawRaccoon(ctx, Wd.raccoon);
    if (Wd.sci) Sprites.drawScientist(ctx, Object.assign({ y: L.walkY(Wd.sci.x) }, Wd.sci), time);
    if (!under) drawPlayer(G, p, time);
    if (Wd.heron) Sprites.drawHeron(ctx, Wd.heron, time);
    G.particles.draw(ctx, cam);
    drawPond(G, Wd, L, view, season, time, night);
    drawFrontGrass(G, Wd, L, view, season, time, snow);
    if (season === 'summer' || season === 'spring') for (const c of Wd.critters) { if (c.x < view.l || c.x > view.r || night > .6) continue; if (c.kind === 'butterfly') Sprites.drawButterfly(ctx, c, time); else if (c.kind === 'dragonfly' && season === 'summer') Sprites.drawDragonfly(ctx, c, time); }
    if (season === 'autumn') drawFallingLeaves(G, view, time);
    if (Wd.hawk) Sprites.drawHawk(ctx, Wd.hawk, time);
    ctx.restore();

    /* ---------------- light ---------------- */
    const dark = Math.max(night * .72, wx.cloud * .22 + wx.rain * .1);
    if (dark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${lerp(255, 60, dark) | 0},${lerp(255, 80, dark) | 0},${lerp(255, 140, dark) | 0})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    const glow = (Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06)) * (1 - wx.cloud);
    if (glow > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,70,${glow * .4})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (season === 'summer' && night > .3) { ctx.save(); cam.apply(ctx); drawFireflies(G, Wd, view, night, time); ctx.restore(); }
    if (p.underground) {
      const [sx, sy] = cam.toScreen(p.x, p.y), rad = Math.max(W, H) * .5;
      const lg = ctx.createRadialGradient(sx, sy, rad * .2, sx, sy, rad);
      lg.addColorStop(0, 'rgba(6,4,2,0)'); lg.addColorStop(1, 'rgba(6,4,2,.55)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    }
    drawWeather(G, wx, time, dt);
    /* how the snake feels: cloudy blue eyes before a shed, cold, too hot */
    if (p.stage === 'snake') {
      const blue = p.blue;
      if (blue > .01) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .2, W / 2, H / 2, Math.max(W, H) * .7); g.addColorStop(0, `rgba(200,220,240,${blue * .12})`); g.addColorStop(1, `rgba(190,215,240,${blue * .6})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      const [lo, hi] = p.warmBand;
      const cold = clamp((lo - p.warm) / lo, 0, 1) * (p.mode === 'winter' ? .4 : 1), hot = clamp((p.warm - hi) / (1 - hi), 0, 1);
      if (cold > .02) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(180,220,255,0)'); g.addColorStop(1, `rgba(170,210,255,${cold * .55})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      if (hot > .02) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(255,180,80,0)'); g.addColorStop(1, `rgba(255,150,60,${hot * .45})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(10,14,8,${.3 + night * .2})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (!clean) drawOverlays(G, night, time);
    Cinematic.draw(ctx, W, H);
  }

  function drawSunMoon(G, tod, night, horizon, cloud) {
    const skyTop = Math.max(80, horizon * .85);
    if (tod > .22 && tod < .82) {
      const t = invLerp(.22, .82, tod), x = W * (.1 + .8 * t), y = horizon - Math.sin(Math.PI * t) * skyTop + 10;
      ctx.globalAlpha = 1 - cloud * .7;
      const g = ctx.createRadialGradient(x, y, 8, x, y, 220); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(.12, 'rgba(255,230,160,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, y - 220, 440, 440);
      ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const t = tod > .5 ? invLerp(.78, 1.28, tod) : invLerp(-.22, .28, tod), x = W * (.15 + .7 * t), y = horizon - Math.sin(Math.PI * clamp(t, 0, 1)) * skyTop * .9 - 10;
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
  function drawClouds(G, horizon, time, night) {
    const wx = G.world.weather, n = 3 + Math.round(wx.cloud * 6);
    for (let k = 0; k < n; k++) {
      const x = ((k * .23 + time * .004 * (1 + k % 3) - G.cam.x * .00005 * (k % 2 + 1)) % 1.3 + 1.3) % 1.3 * W - W * .15, y = Math.max(40, horizon * (.18 + (k % 4) * .1)), s = 40 + (k % 3) * 22;
      const v = lerp(255, 120, wx.cloud * .7) * (1 - night * .7);
      ctx.fillStyle = `rgba(${v | 0},${v | 0},${(v + 8) | 0},${.55 + wx.cloud * .35})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.arc(x + s, y + 6, s * .8, 0, TAU); ctx.arc(x - s * .9, y + 8, s * .7, 0, TAU); ctx.arc(x + s * .3, y - s * .4, s * .7, 0, TAU); ctx.fill();
    }
  }
  /* two bands of far country: blue hills, then nearer woods */
  function drawFarHills(G, night, season) {
    const cam = G.cam, specs = [
      { par: .12, wy: -40, amp: 170, col: '#8aa0b8', n: 0 },
      { par: .28, wy: -20, amp: 110, col: season === 'autumn' ? '#9a8a4a' : season === 'winter' ? '#a8b4c0' : season === 'spring' ? '#7aa860' : '#5a8a4a', n: 1 }
    ];
    for (const sp of specs) {
      const base = H / 2 + (sp.wy - cam.y) * cam.zoom * sp.par + 40, off = cam.x * cam.zoom * sp.par;
      ctx.fillStyle = mixHex(sp.col, '#101828', night * .6);
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let sx = 0; sx <= W + 8; sx += 8) { const u = (sx + off) * .004; const y = base - sp.amp * (.4 + .6 * hillNoise[sp.n](u)) - (sp.n === 1 ? 14 * Math.abs(Math.sin((sx + off) * .07)) * hillNoise[2](u * 3) : 0); ctx.lineTo(sx, y); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      if (sp.n === 1 && season === 'winter') { ctx.fillStyle = `rgba(240,245,250,${.5 - night * .3})`; ctx.fillRect(0, base - 8, W, 10); }
    }
  }

  /* ---------- the ground in cross-section ---------- */
  function drawGround(G, Wd, L, view, night, season, snow, time) {
    const x0 = Math.floor(view.l / 6) * 6, x1 = view.r + 6, bottom = Math.max(view.b, 500);
    const surf = []; for (let x = x0; x <= x1; x += 6) surf.push([x, L.surfaceAt(x)]);
    const groundPath = () => { ctx.beginPath(); ctx.moveTo(x0, bottom); for (const [x, y] of surf) ctx.lineTo(x, y); ctx.lineTo(x1, bottom); ctx.closePath(); };
    groundPath();
    const g = ctx.createLinearGradient(0, -180, 0, 380); g.addColorStop(0, '#7a6448'); g.addColorStop(.35, '#6a5238'); g.addColorStop(.7, '#4e3c2a'); g.addColorStop(1, '#2e2418');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); groundPath(); ctx.clip();
    /* the rocky hill: limestone in layers, under a thin skin of soil */
    if (view.l < WORLD.hillR + 100) {
      const lg = ctx.createLinearGradient(0, -180, 0, 300); lg.addColorStop(0, '#c8bc9c'); lg.addColorStop(.5, '#a89c80'); lg.addColorStop(1, '#6a6050');
      ctx.fillStyle = lg; ctx.beginPath();
      const hx0 = Math.max(x0, WORLD.hillL - 120), hx1 = Math.min(x1, WORLD.hillR + 120);
      ctx.moveTo(hx0, bottom); for (let x = hx0; x <= hx1; x += 6) { const k = smoothstep(WORLD.hillL - 120, WORLD.hillL + 140, x) * (1 - smoothstep(WORLD.hillR - 140, WORLD.hillR + 120, x)); ctx.lineTo(x, L.surfaceAt(x) + 12 + (1 - k) * 260); } ctx.lineTo(hx1, bottom); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(90,80,62,.35)'; ctx.lineWidth = 1.4;
      for (let k = 0; k < 14; k++) { const yy = -150 + k * 26; ctx.beginPath(); for (let x = hx0; x <= hx1; x += 12) { const y = yy + Math.sin(x * .01 + k) * 4; x === hx0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
    }
    /* bedrock deep down everywhere */
    ctx.fillStyle = 'rgba(90,86,78,.45)'; ctx.beginPath(); ctx.moveTo(x0, bottom); for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, 300 + Math.sin(x * .006) * 30 + hillNoise[2](x * .01) * 30); ctx.lineTo(x1, bottom); ctx.closePath(); ctx.fill();
    for (const pb of decor.pebbles) { if (pb.x < view.l || pb.x > view.r) continue; ctx.fillStyle = pb.c < .5 ? 'rgba(160,150,130,.6)' : 'rgba(60,50,36,.5)'; ctx.beginPath(); ctx.ellipse(pb.x, pb.y, pb.r * 1.3, pb.r, pb.c * 3, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(70,50,30,.45)'; ctx.lineWidth = 1.1;
    for (const r of decor.roots) { if (r.x < view.l || r.x > view.r) continue; ctx.beginPath(); ctx.moveTo(r.x, r.y + 2); ctx.quadraticCurveTo(r.x + r.a * 20, r.y + r.l * .5, r.x + r.a * 30, r.y + r.l); ctx.stroke(); }
    /* the frost line: in winter the ground above it freezes; the den goes far below it */
    if (season === 'autumn' || season === 'winter' || (G.player.underground)) {
      const k = season === 'winter' ? 1 : .55;
      if (season === 'winter') { ctx.fillStyle = 'rgba(200,225,255,.28)'; ctx.beginPath(); ctx.moveTo(x0, L.surfaceAt(x0)); for (const [x, y] of surf) ctx.lineTo(x, y); for (let i = surf.length - 1; i >= 0; i--) ctx.lineTo(surf[i][0], surf[i][1] + WORLD.frost); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = `rgba(150,200,255,${.8 * k})`; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath(); let first = true; for (const [x, y] of surf) { if (L.inPond(x)) { first = true; continue; } first ? ctx.moveTo(x, y + WORLD.frost) : ctx.lineTo(x, y + WORLD.frost); first = false; } ctx.stroke(); ctx.setLineDash([]);
      const fx = clamp(L.mouth.x + 150, view.l + 60, view.r - 60);
      if (!L.inPond(fx)) { ctx.font = `800 11px ${UI_FONT}`; ctx.fillStyle = `rgba(200,230,255,${.9 * k})`; ctx.textAlign = 'center'; ctx.fillText('frost line', fx, L.surfaceAt(fx) + WORLD.frost - 6); }
    }
    /* the winter den: a crack in the rock, winding down to its chamber */
    if (view.l < WORLD.hillR) {
      const P = L.path, C = L.chamber;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(60,50,38,.6)'; ctx.lineWidth = 30; ctx.beginPath(); P.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y - 6)); ctx.stroke();
      ctx.strokeStyle = '#1e160e'; ctx.lineWidth = 24; ctx.beginPath(); P.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y - 6)); ctx.stroke();
      ctx.fillStyle = 'rgba(60,50,38,.6)'; ctx.beginPath(); ctx.ellipse(C.x, C.y, C.rx + 4, C.ry + 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1e160e'; ctx.beginPath(); ctx.ellipse(C.x, C.y, C.rx, C.ry, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,100,70,.25)'; ctx.beginPath(); ctx.ellipse(C.x, C.y + C.ry * .5, C.rx * .9, C.ry * .4, 0, 0, TAU); ctx.fill();
    }
    /* a darker band of topsoil just under the grass */
    ctx.fillStyle = 'rgba(60,42,24,.35)'; ctx.beginPath(); for (const [x, y] of surf) ctx.lineTo(x, y); for (let i = surf.length - 1; i >= 0; i--) ctx.lineTo(surf[i][0], surf[i][1] + 24); ctx.closePath(); ctx.fill();
    ctx.restore();
    /* the grassy edge along the top (snow in winter) */
    const edge = season === 'autumn' ? '#a89a4a' : season === 'winter' ? '#8a8a70' : season === 'spring' ? '#7ac050' : '#5a9a3a';
    ctx.strokeStyle = edge; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.beginPath(); let started = false;
    for (const [x, y] of surf) { if (L.inPond(x)) { started = false; continue; } const onRock = L.onHill(x) && Math.abs(x - WORLD.hillC) < 420; if (onRock) { started = false; continue; } started ? ctx.lineTo(x, y + 1) : ctx.moveTo(x, y + 1); started = true; }
    ctx.stroke();
    if (snow > .02) {
      ctx.fillStyle = `rgba(250,252,255,${Math.min(1, snow * 1.2)})`; ctx.beginPath();
      let on = false; const dep = 9 * snow;
      for (const [x, y] of surf) { if (L.inPond(x)) continue; if (!on) { ctx.moveTo(x, y + 2); on = true; } ctx.lineTo(x, y - dep + Math.sin(x * .05) * 1.5); }
      for (let i = surf.length - 1; i >= 0; i--) { const [x, y] = surf[i]; if (L.inPond(x)) continue; ctx.lineTo(x, y + 2); }
      ctx.fill();
    }
    /* the den's mouth: a dark gap in the rock, with a hint of the way in */
    const m = L.mouth; if (m.x > view.l - 60 && m.x < view.r + 60) { ctx.fillStyle = '#140e08'; ctx.beginPath(); ctx.ellipse(m.x - 2, m.y - 2, 15, 7, -.3, 0, TAU); ctx.fill(); }
  }
  function drawBackGrass(G, Wd, L, view, season, time, snow) {
    if (season === 'winter' && snow > .6) return;
    const col = season === 'autumn' ? ['#b8a050', '#a08a40', '#c8b060'] : season === 'spring' ? ['#8ad060', '#6ab848', '#a0d870'] : ['#5aa03a', '#4a8a30', '#6ab048'];
    const gust = Wd.weather.gust;
    ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
    for (let x = Math.floor(view.l / 5) * 5; x < view.r; x += 5) {
      if (L.inPond(x)) continue;
      const rock = L.onHill(x) && Math.abs(x - WORLD.hillC) < 420; if (rock && (x % 25)) continue;
      const y = L.surfaceAt(x), n = hillNoise[2](x * .13), h = (6 + n * 12) * (season === 'spring' ? .75 : 1);
      ctx.strokeStyle = col[((x / 5) | 0) % 3]; ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.quadraticCurveTo(x + 1, y - h * .5, x + Math.sin(time * 1.4 + x * .05) * 2 * (.5 + gust) + 2, y - h); ctx.stroke();
    }
    if (season !== 'winter') for (const f of Wd.flowers) {
      if (f.x < view.l || f.x > view.r) continue;
      if (season === 'autumn' && f.k < .6) continue;
      const y = L.surfaceAt(f.x), sx = Math.sin(time * 1.2 + f.ph) * 2;
      ctx.strokeStyle = '#4a8a2a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(f.x, y); ctx.quadraticCurveTo(f.x, y - f.h * .5, f.x + sx, y - f.h); ctx.stroke();
      ctx.fillStyle = season === 'autumn' ? '#c8a050' : f.col; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.beginPath(); ctx.arc(f.x + sx + Math.cos(a) * 2.6, y - f.h + Math.sin(a) * 2.6, 2, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#c87a20'; ctx.beginPath(); ctx.arc(f.x + sx, y - f.h, 1.5, 0, TAU); ctx.fill();
    }
    /* cattails at the pond's edges (behind) */
    for (const r of Wd.reeds) { if (r.x < view.l || r.x > view.r) continue; const y = Math.min(L.surfaceAt(r.x), WORLD.waterY + 10), sx = Math.sin(time + r.ph) * 3; ctx.strokeStyle = season === 'winter' ? '#a89a7a' : season === 'autumn' ? '#a8a060' : '#5a8a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r.x, y + 6); ctx.quadraticCurveTo(r.x, y - r.h * .5, r.x + sx, y - r.h); ctx.stroke(); if (r.h > 70) { ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(r.x + sx * .9, y - r.h + 10, 2.6, 8, 0, 0, TAU); ctx.fill(); } }
  }
  function drawFrontGrass(G, Wd, L, view, season, time, snow) {
    if (season === 'winter' && snow > .6) return;
    const col = season === 'autumn' ? '#b8a050' : season === 'spring' ? '#9ad870' : '#6ab848';
    ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    for (const t of decor.tufts) {
      if (t.x < view.l || t.x > view.r || L.inPond(t.x)) continue;
      if (L.onHill(t.x) && Math.abs(t.x - WORLD.hillC) < 420) continue;
      const y = L.surfaceAt(t.x) + 3;
      for (let k = 0; k < t.n; k++) { const dx = (k - t.n / 2) * 2.2, h = t.h * (.7 + (k % 2) * .4); ctx.beginPath(); ctx.moveTo(t.x + dx, y); ctx.quadraticCurveTo(t.x + dx, y - h * .5, t.x + dx * 1.6 + Math.sin(time * 1.5 + t.ph + k) * 1.5, y - h); ctx.stroke(); }
    }
  }
  function drawPond(G, Wd, L, view, season, time, night) {
    if (view.r < WORLD.pondL || view.l > WORLD.pondR) return;
    const ice = season === 'winter';
    const xs = []; for (let x = WORLD.pondL; x <= WORLD.pondR; x += 6) if (L.surfaceAt(x) > WORLD.waterY) xs.push(x);
    if (!xs.length) return;
    ctx.beginPath(); ctx.moveTo(xs[0], WORLD.waterY); for (const x of xs) ctx.lineTo(x, WORLD.waterY); for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], L.surfaceAt(xs[i]) + 1); ctx.closePath();
    const g = ctx.createLinearGradient(0, WORLD.waterY, 0, WORLD.waterY + 120);
    if (ice) { g.addColorStop(0, 'rgba(220,235,250,.85)'); g.addColorStop(1, 'rgba(120,150,180,.75)'); }
    else { g.addColorStop(0, 'rgba(90,160,200,.55)'); g.addColorStop(1, 'rgba(30,70,90,.8)'); }
    ctx.fillStyle = g; ctx.fill();
    /* the surface: ripples, lily pads (or ice) */
    ctx.strokeStyle = ice ? 'rgba(255,255,255,.9)' : `rgba(230,245,255,${.75 - night * .3})`; ctx.lineWidth = ice ? 4 : 1.6;
    ctx.beginPath(); xs.forEach((x, i) => { const y = WORLD.waterY + (ice ? 0 : Math.sin(x * .06 + time * 2) * .8); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    if (!ice) for (const pd of Wd.pads) {
      ctx.fillStyle = season === 'autumn' ? '#8a8a3a' : '#3a8a3a'; ctx.beginPath(); ctx.ellipse(pd.x, WORLD.waterY - .5, pd.r, pd.r * .28, 0, .25, TAU - .25); ctx.lineTo(pd.x, WORLD.waterY - .5); ctx.closePath(); ctx.fill();
      if (pd.flower && season === 'summer') { ctx.fillStyle = '#ffd0e8'; for (let i = 0; i < 6; i++) { const a = Math.PI + i / 5 * Math.PI; ctx.beginPath(); ctx.ellipse(pd.x + Math.cos(a) * 3, WORLD.waterY - 3 + Math.sin(a) * 2.4, 2.4, 1.2, a, 0, TAU); ctx.fill(); } }
    }
  }
  function drawFallingLeaves(G, view, time) {
    for (let k = 0; k < 24; k++) {
      const x = view.l + (((k * 97.3 + time * 12 * (1 + k % 3)) % (view.r - view.l + 200)) + (view.r - view.l + 200)) % (view.r - view.l + 200) - 100;
      const y = -260 + ((k * 53.1 + time * (20 + k % 5 * 4)) % 300);
      ctx.save(); ctx.translate(x + Math.sin(time * 2 + k) * 8, y); ctx.rotate(time * 2 + k);
      ctx.fillStyle = ['#e8902a', '#c8501a', '#f0c040'][k % 3]; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  function drawFireflies(G, Wd, view, night, time) {
    ctx.globalCompositeOperation = 'lighter';
    for (const c of Wd.critters) {
      if (c.kind !== 'firefly' || c.x < view.l || c.x > view.r) continue;
      const on = Math.max(0, Math.sin(time * TAU / c.per + c.ph * 7)); if (on < .3) continue;
      const x = c.x + Math.sin(time * .5 + c.ph) * 20, y = Wd.land.surfaceAt(c.x) + c.y + Math.sin(time * .7 + c.ph * 2) * 8;
      const a = (on - .3) / .7 * night, g = ctx.createRadialGradient(x, y, 0, x, y, 10);
      g.addColorStop(0, `rgba(240,255,140,${a})`); g.addColorStop(1, 'rgba(240,255,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawHawkShadow(G, Wd, L, night) {
    const h = Wd.hawk; if (!h || night > .5) return;
    const gy = L.walkY(h.x), k = h.state === 'dive' ? .5 : .28;
    ctx.fillStyle = `rgba(20,16,10,${k * (1 - Wd.weather.cloud * .7)})`;
    ctx.beginPath(); ctx.ellipse(h.x, gy - 2, 46, 6, 0, 0, TAU); ctx.fill();
  }
  /* the scent trails: faint purple dots, bright for a while after a tongue flick */
  function drawTrails(G, Wd, p, time) {
    const k = p.stage === 'snake' ? clamp(p.scentT / 1.5, 0, 1) : 0;
    if (Wd.trail && Wd.trail.kind === 'den' && p.flags.autumnNow) {
      ctx.fillStyle = '#c86ad8';
      for (let i = 0; i < Wd.trail.pts.length; i += 2) { const q = Wd.trail.pts[i]; ctx.globalAlpha = .3 + k * .65 * (.6 + .4 * Math.sin(time * 4 - i * .3)); ctx.beginPath(); ctx.arc(q.x, q.y - 7, 2.6 + k * 1.6, 0, TAU); ctx.fill(); }
    }
    const r = Wd.race;
    if (r && !r.done && r.girl.trailPts) {
      ctx.fillStyle = '#ff7ab8';
      for (let i = 0; i < r.girl.trailPts.length; i++) { const q = r.girl.trailPts[i]; ctx.globalAlpha = .3 + k * .65 * (.6 + .4 * Math.sin(time * 5 - i * .4)); ctx.beginPath(); ctx.arc(q.x, q.y - 4, 2.6 + k * 1.6, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  /* in the winter den, a tangle of resting snakes */
  function drawDenCrowd(G, Wd, L, season) {
    const p = G.player, show = season === 'winter' || p.underground || Wd.denCrowd > 0;
    if (!show) return;
    const C = L.chamber, n = clamp(season === 'winter' ? 7 : Wd.denCrowd, 0, 9);
    for (let i = 0; i < n; i++) {
      const key = i + '|' + G.form;
      let pts = coilCache.get(key);
      if (!pts) { const R = mulberry32(i * 31 + 5), len = snakeUnits(30 + R() * 30), x = C.x + (i - 4) * 17 + R() * 6; pts = { P: Trail.coil(len, len * .085, x, C.y + C.ry * .75 - (i % 2) * 6, i % 2 ? 1 : -1, 1.7), th: len * .085, form: R() < .75 ? G.form : FORM_KEYS[(R() * 3) | 0] }; coilCache.set(key, pts); }
      Sprites.drawSnake(ctx, pts.P, { thick: pts.th, form: pts.form, shadow: false, alpha: .95 });
    }
  }

  /* ---------- snakes ---------- */
  function snakeOpts(s, extra) {
    return Object.assign({ thick: s.thick, form: s.form, alpha: s.alpha, tongue: s.tongueT > 0 ? 1 - s.tongueT * 2 : 0, baby: s.len < 70 ? clamp((70 - s.len) / 14, 0, 1) : 0 }, extra);
  }
  function drawNPC(G, n, time) {
    if (n.mode === 'sac') { Sprites.drawSac(ctx, n.x, n.y + n.thick * .5, n.len / 52, time, n.sacT < 1.2 ? 1 : 0, n.form); return; }
    const P = Trail.sample(n.trail, n.len, clamp(Math.round(n.len / 3.2), 20, 40));
    Sprites.drawSnake(ctx, P, snakeOpts(n, { tongue: n.tongueT > 0 ? 1 - n.tongueT * 2 : 0, headUp: n.coiled ? .2 : 0 }));
  }
  function drawPlayer(G, p, time) {
    if (p.stage === 'sac') {
      /* you: a soft golden glow around your own bag */
      const g = ctx.createRadialGradient(p.x, p.y - 12, 4, p.x, p.y - 12, 34); g.addColorStop(0, `rgba(255,236,140,${.35 + .15 * Math.sin(time * 3)})`); g.addColorStop(1, 'rgba(255,236,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 12, 34, 0, TAU); ctx.fill();
      Sprites.drawSac(ctx, p.x, p.y, 1.25, time, p.flags.sacReady ? p.crack + .4 : 0, p.form);
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = .8; const ay = p.y - 34 + Math.sin(time * 4) * 2;
      ctx.beginPath(); ctx.moveTo(p.x, ay + 6); ctx.lineTo(p.x - 5, ay - 2); ctx.lineTo(p.x + 5, ay - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      return;
    }
    const n = clamp(Math.round(p.len / 3), 22, 44);
    let P;
    if (p.mode === 'measured') { P = Sprites.posePts('straight', p.len, p.thick).map(q => ({ x: p.x + q.x * .9 - p.len * .1, y: p.y + Math.abs(q.x) * .06, z: 0, c: 1, g: 0 })); }
    else P = Trail.sample(p.trail, p.len, n);
    const o = { thick: p.thick, form: p.form, tongue: p.tongueT > 0 ? 1 - p.tongueT : 0, blue: p.blue, dull: p.shed === 'blue' || p.shed === 'clear' || p.shed === 'tight' ? (p.shed === 'tight' ? .3 : .75) : 0, fresh: p.fresh, headUp: p.headUp, baby: p.len < 70 ? clamp((70 - p.len) / 14, 0, 1) : 0, peel: p.mode === 'shed' ? p.peel : undefined };
    if (p.mode === 'startle') o.headUp = .6;
    if ((p.mode === 'hide' || p.mode === 'birth') && p.cover) {
      const c = p.cover; ctx.save();
      ctx.beginPath(); ctx.rect(c.x - 5000, -5000, 10000, 10000); ctx.rect(c.x - c.w / 2 + 2, c.y - 200, c.w - 4, 230); ctx.clip('evenodd');
      Sprites.drawSnake(ctx, P, o); ctx.restore();
    } else Sprites.drawSnake(ctx, P, o);
    if (p.mode === 'birth' && p.birth) { /* she lies coiled; the glow is in the overlay */ }
    if (G.player === p && p.flags.carrying && p.eggs > .05 && p.mode !== 'hide') { ctx.fillStyle = `rgba(255,220,240,${.25 + .15 * Math.sin(time * 2)})`; const q = P[Math.floor(P.length * .45)]; ctx.beginPath(); ctx.arc(q.x, q.y, p.thick * (.7 + p.eggs * .5), 0, TAU); ctx.fill(); }
  }

  /* ---------- weather on the screen ---------- */
  function drawWeather(G, wx, time, dt) {
    const cam = G.cam;
    if (wx.rain > .03 && !G.player.underground) {
      ctx.strokeStyle = `rgba(200,220,240,${.45 * wx.rain})`; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of drops) { d.y += dt * (1.2 + d.z) * 1.1; if (d.y > 1) { d.y -= 1; d.x = Math.random(); } const x = ((d.x - cam.x * .0002 * d.z) % 1 + 1) % 1 * W, y = d.y * H; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14 * d.z); }
      ctx.stroke();
    }
    if (wx.snow > .03 && !G.player.underground) {
      ctx.fillStyle = `rgba(255,255,255,${.85 * wx.snow})`;
      for (const f of flakes) { f.y += dt * .05 * f.z; f.ph += dt; if (f.y > 1) { f.y -= 1; f.x = Math.random(); } const x = ((f.x + Math.sin(f.ph) * .01 - cam.x * .0002 * f.z) % 1 + 1) % 1 * W, y = f.y * H; ctx.beginPath(); ctx.arc(x, y, 1 + f.z * 2, 0, TAU); ctx.fill(); }
    }
  }

  /* ---------- overlays: the birth glow, arrows, labels ---------- */
  function arrow(x, y, a, col, alpha = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function pointTo(G, tx, ty, col, time) {
    const cam = G.cam, p = G.player, [sx, sy] = cam.toScreen(tx, ty), [px, py] = cam.toScreen(p.x, p.y - p.thick * 2);
    const a = Math.atan2(sy - py, sx - px), d = Math.min(Math.hypot(sx - px, sy - py) - 10, 70 + Math.sin(time * 5) * 10);
    if (d > 24) arrow(px + Math.cos(a) * d, py + Math.sin(a) * d, a, col, .75 + .25 * Math.sin(time * 5));
  }
  function ringMeter(G, cx, cy, u, ok, flash) {
    const rr2 = lerp(26, 110, u);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ok ? '#7dff7a' : 'rgba(255,230,140,.9)'; ctx.lineWidth = ok ? 8 : 5; ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, TAU); ctx.stroke();
    if (flash > 0) { ctx.strokeStyle = `rgba(255,255,200,${flash})`; ctx.lineWidth = 14 * flash; ctx.beginPath(); ctx.arc(cx, cy, 40 + (1 - flash) * 80, 0, TAU); ctx.stroke(); }
  }
  function bottomText(txt, ok) {
    ctx.font = `900 ${Math.round(Math.min(26, W * .03))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = ok ? '#7dff7a' : '#fff3c0';
    ctx.strokeText(txt, W / 2, H - 170); ctx.fillText(txt, W / 2, H - 170);
  }
  function drawOverlays(G, night, time) {
    const p = G.player, cam = G.cam, Wd = G.world, L = Wd.land;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (p.mode === 'birth' && p.birth) {
      const ok = p.birthWindow(), [sx, sy] = cam.toScreen(p.x, p.y - p.thick);
      ringMeter(G, sx, sy, Wd.pulse(), ok, p.birth.flash);
      const need = G.diff().pushes;
      for (let k = 0; k < need; k++) { ctx.fillStyle = k < p.birth.good ? '#ffd0e8' : 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(W / 2 - (need - 1) * 14 + k * 28, H - 206, 9, 0, TAU); ctx.fill(); }
      bottomText(ok ? 'PUSH!  (Space)' : 'Wait for the glow…', ok);
    }
    const race = Wd.race;
    if (race && !race.done && p.sex === 'boy' && p.stage === 'snake' && !p.flags.met) bottomText(p.scentT > 0 ? 'On her trail! Keep going!' : 'Flick your tongue (Space) to find her trail!', p.scentT > 0);
    /* arrows to where you are going */
    if (p.stage === 'snake' && (p.mode === 'crawl' || p.mode === 'hide')) {
      const m = L.mouth;
      if (Wd.hawk && Wd.hawk.state === 'circle' && p.mode === 'crawl') { const c = nearestCover(Wd, p.x); if (c) pointTo(G, c.x, c.y - 10, '#a8e0ff', time); }
      else if (p.flags.autumnNow && !p.flags.wintered && Math.abs(p.x - m.x) > 60) pointTo(G, m.x, m.y - 10, '#d8a0f0', time);
      else if (race && !race.done && p.sex === 'boy') pointTo(G, race.girl.x, race.girl.y - 6, '#ff9ad0', time);
      else if (p.sex === 'girl' && p.flags.gathering && !p.flags.met) { const b = Wd.boys().sort((a, c) => Math.abs(a.x - p.x) - Math.abs(c.x - p.x))[0]; if (b && Math.abs(b.x - p.x) > 50) pointTo(G, b.x, b.y - 6, '#ff9ad0', time); }
      else if (p.flags.ready && p.mode === 'crawl') { const c = nearestCover(Wd, p.x, ['log', 'board', 'leaves']); if (c) pointTo(G, c.x, c.y - 10, '#ffd0e8', time); }
      else if (p.shed === 'blue' && p.mode === 'crawl') { const c = nearestCover(Wd, p.x); if (c) pointTo(G, c.x, c.y - 10, '#b2cee8', time); }
      else if (p.shed === 'clear' && p.context() !== 'rub') { const c = Wd.covers.filter(c2 => c2.rough && !c2.lifted).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; if (c) pointTo(G, c.x, c.y - 10, '#fff3b0', time); }
      else if (p.warm < p.warmBand[0] && G.world.sun(G.tod) > .25 && p.mode === 'hide') { /* come out into the sun */ }
      else if (p.belly < 4 && p.instar < 4 && !p.full) { const s = Wd.nearestSeenSnack(p.x); if (s && Math.abs(s.x - p.x) > 40) pointTo(G, s.x, s.y - 6, '#ffe9a0', time); }
    }
    /* off-screen things that matter */
    const targets = [];
    if (Wd.raccoon) targets.push([Wd.raccoon.x, Wd.raccoon.y - 20, '#ff9a6a']);
    if (Wd.heron && Wd.heron.state !== 'leave') targets.push([Wd.heron.x, Wd.heron.y - 50, '#ff9a6a']);
    if (Wd.sci) targets.push([Wd.sci.x, L.walkY(Wd.sci.x) - 40, '#ffe27a']);
    for (const [x, y, col] of targets) {
      const [sx, sy] = cam.toScreen(x, y);
      if (sx > 40 && sx < W - 40 && sy > 110 && sy < H - 60) continue;
      const cx = clamp(sx, 50, W - 50), cy = clamp(sy, 130, H - 80);
      arrow(cx, cy, Math.atan2(sy - cy, sx - cx), col);
    }
    if (G.settings.labels) drawLabels(G);
  }
  function nearestCover(Wd, x, kinds) { let best = null, bd = 1e9; for (const c of Wd.covers) { if (c.lifted || !c.hide || (kinds && !kinds.includes(c.kind))) continue; const d = Math.abs(c.x - x); if (d < bd) { bd = d; best = c; } } return best; }
  function drawLabels(G) {
    const cam = G.cam, Wd = G.world, L = Wd.land, p = G.player;
    ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, t) => { const [sx, sy] = cam.toScreen(x, y); if (sx < 0 || sx > W || sy < 100 || sy > H) return; const w = ctx.measureText(t).width + 14; ctx.fillStyle = 'rgba(255,252,240,.85)'; rr(ctx, sx - w / 2, sy - 11, w, 22, 11); ctx.fill(); ctx.fillStyle = '#2a2016'; ctx.fillText(t, sx, sy); };
    const v = cam.viewRect(0);
    for (const c of Wd.covers) if (c.x > v.l && c.x < v.r && !c.lifted) tag(c.x, c.y - c.h - 16, c.name);
    for (const s of Wd.snacks) if (s.seen && Math.abs(s.x - p.x) < 400) tag(s.x, s.y - 20, 'snack');
    for (const e of Wd.exuviae) if (e.x > v.l && e.x < v.r) tag(e.x, e.y - 16, 'shed skin');
    for (const c of Wd.critters) if (c.kind === 'frog' && c.state === 'sit' && c.x > v.l && c.x < v.r) tag(c.x, c.y - 18, 'frog');
    if (L.mouth.x > v.l && L.mouth.x < v.r) tag(L.mouth.x, L.mouth.y - 30, 'winter den');
    if (L.chamber.x > v.l && L.chamber.x < v.r && p.underground) tag(L.chamber.x, L.chamber.y - L.chamber.ry - 14, 'den chamber');
    if ((WORLD.pondL + WORLD.pondR) / 2 > v.l && (WORLD.pondL + WORLD.pondR) / 2 < v.r) tag((WORLD.pondL + WORLD.pondR) / 2, WORLD.waterY - 40, 'pond');
    if (Wd.mum) tag(Wd.mum.x, Wd.mum.y - 30, 'mum');
    for (const n of Wd.npcs) if (n.x > v.l && n.x < v.r && n.mode !== 'sac') tag(n.x, n.y - n.thick * 3 - 8, n.role === 'sib' ? 'brother or sister' : n.role === 'baby' ? 'baby' : n.role === 'rival' ? 'other boy' : n.sex === 'girl' ? 'girl snake' : 'boy snake');
    if (Wd.hawk) tag(Wd.hawk.x, Wd.hawk.y - 30, 'red-tailed hawk');
    if (Wd.raccoon) tag(Wd.raccoon.x, Wd.raccoon.y - 50, 'raccoon');
    if (Wd.heron) tag(Wd.heron.x, Wd.heron.y - 100, 'great blue heron');
    if (Wd.sci) tag(Wd.sci.x, L.walkY(Wd.sci.x) - 110, 'snake scientist');
    tag(p.x, p.y - (p.stage === 'snake' ? p.thick * 3 + 14 : 34), STAGES[STAGE_INDEX[p.stageKey()]].name);
  }

  function snapshot(G) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    frame(G, 0, true);
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }
  function invalidate() { builtFor = null; coilCache.clear(); }

  return { init, resize, setQuality, getFps, frame, snapshot, invalidate, skyColours, drawMoonDisc };
})();
