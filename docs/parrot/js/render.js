/* ============================================================
   render.js — the rainforest, back to front
   ============================================================
     sky (time of day) · stars · moon / sun · two far layers of
     forest (the classic look; the WebGL look paints its own)
     far trunks · the river and the clay cliff · the trees and
     their hollows · the forest floor · the food · everyone · YOU ·
     the leaves in front · the calls you can see · particles
     overlays (renderh.js)
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1, quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  const SKY = [
    [0.00, '#060a20', '#141e42'], [0.19, '#141a44', '#5a3a62'], [0.25, '#7a8fc8', '#ffb98a'],
    [0.36, '#3f8fdc', '#b8dcf0'], [0.55, '#3888dc', '#b4d6ee'], [0.70, '#5f94d8', '#ffd6a8'],
    [0.79, '#3d3a8c', '#ff7a4c'], [0.86, '#101844', '#3a2a58'], [1.00, '#060a20', '#141e42']
  ];
  const stars = [];
  let layers = [];

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    if (typeof GFX !== 'undefined') GFX.init(c);
    for (let i = 0; i < 240; i++) stars.push([Math.random(), Math.random() * .8, Math.random(), Math.random() * TAU]);
    buildLayers();
  }
  function resize(w, h, dpr) {
    W = w; H = h; DPR = quality === 'low' ? 1 : dpr;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    if (typeof GFX !== 'undefined') GFX.resize(w, h, DPR, canvas.width, canvas.height);
  }
  function setQuality(q) { if (q !== quality) { quality = q; resize(W, H, Math.min(2, devicePixelRatio || 1)); } }
  function getFps() { return fps; }
  /* two tileable bands: far mesas, then low scrub with a saguaro or two */
  function buildLayers() {
    layers = [];
    [{ h: 420, base: '#7fae96', par: .08, big: true }, { h: 420, base: '#4f8a62', par: .18, big: false }].forEach((sp, li) => {
      const c = document.createElement('canvas'), w = 2048; c.width = w; c.height = sp.h;
      const g = c.getContext('2d'), R = mulberry32(31 + li * 7); g.fillStyle = sp.base;
      for (let k = 0; k < (sp.big ? 16 : 28); k++) { const x = (k + R() * .8) / (sp.big ? 16 : 28) * w, rr0 = (sp.big ? 70 : 44) + R() * 50, y = sp.h * (sp.big ? .5 : .66) + R() * 40; for (const dx of [-w, 0, w]) { g.beginPath(); g.ellipse(x + dx, y, rr0 * 1.3, rr0, 0, 0, TAU); g.fill(); g.fillRect(x + dx - 5, y, 10, sp.h); if (k % 5 === 0) { g.beginPath(); g.ellipse(x + dx + 20, y - rr0 * 1.2, rr0 * .9, rr0 * .6, 0, 0, TAU); g.fill(); g.fillRect(x + dx + 16, y - rr0, 8, sp.h); } } }
      g.fillRect(0, sp.h * .8, w, sp.h * .2);
      layers.push({ img: c, par: sp.par, h: sp.h });
    });
  }
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1], t = smoothstep(a[0], b[0], tod);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  function sunPos(tod, hy) { if (!(tod > .22 && tod < .82)) return { x: W / 2, y: H * 2, vis: 0, t: 0 }; const top = Math.min(hy, H) * .85, t = invLerp(.22, .82, tod); return { x: W * (.1 + .8 * t), y: hy - Math.sin(Math.PI * t) * Math.max(160, top) - 20, vis: 1, t }; }
  function moonPos(tod, night, hy) { if (!(night > .05)) return { x: W / 2, y: H * 2, vis: 0 }; const top = Math.min(hy, H) * .85, t = tod > .5 ? invLerp(.74, 1.28, tod) : invLerp(-.26, .28, tod); return { x: W * (.15 + .7 * t), y: hy - Math.sin(Math.PI * clamp(t, 0, 1)) * Math.max(160, top) * .9 - 30, vis: night }; }
  function drawSky(G, tod, night, hy, top, bot) {
    const cam = G.cam, sky = ctx.createLinearGradient(0, Math.min(0, hy - H * 1.4), 0, Math.max(hy, 10));
    sky.addColorStop(0, top); sky.addColorStop(1, bot); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (night > .05) { for (const [sx, sy, r, ph] of stars) { const y = sy * Math.max(200, hy); if (y > hy - 30) continue; ctx.globalAlpha = night * (.3 + .7 * (.5 + .5 * Math.sin(G.time * 2 + ph * 6))); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * W, y, .5 + r * 1.2, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    const s = sunPos(tod, hy), m = moonPos(tod, night, hy);
    if (s.vis) { const g = ctx.createRadialGradient(s.x, s.y, 8, s.x, s.y, 220); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(.12, 'rgba(255,230,160,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(s.x - 220, s.y - 220, 440, 440); ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(s.x, s.y, 30, 0, TAU); ctx.fill(); }
    if (m.vis) { ctx.globalAlpha = m.vis; const g = ctx.createRadialGradient(m.x, m.y, 10, m.x, m.y, 260); g.addColorStop(0, 'rgba(220,235,255,.55)'); g.addColorStop(.2, 'rgba(160,190,255,.18)'); g.addColorStop(1, 'rgba(120,150,255,0)'); ctx.fillStyle = g; ctx.fillRect(m.x - 260, m.y - 260, 520, 520); ctx.fillStyle = '#f6f2dc'; ctx.beginPath(); ctx.arc(m.x, m.y, 36, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(150,150,130,.35)'; for (const [dx, dy, r] of [[-12, -8, 8], [10, 6, 6], [4, -16, 4]]) { ctx.beginPath(); ctx.arc(m.x + dx, m.y + dy, r, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    layers.forEach((L, li) => {
      const z = Math.min(1.2, cam.zoom) * (.6 + li * .2), w = L.img.width * z, h = L.h * z, y = hy - h * .82 + (cam.y < 0 ? -cam.y * cam.zoom * (1 - L.par) * .2 : 0);
      let x0 = (-(cam.x * cam.zoom * L.par) % w) - w; while (x0 > -w) x0 -= w;
      ctx.save(); ctx.filter = quality === 'low' ? 'none' : `brightness(${lerp(1, .3 + li * .05, night)})`; for (let x = x0; x < W; x += w) ctx.drawImage(L.img, x, y, w, h); ctx.restore();
    });
  }
  function frame(G, dt, clean) {
    const { cam, tod } = G, p = G.player, night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    const gx = typeof GFX !== 'undefined' && GFX.active(), mainCtx = ctx;
    if (gx) { ctx = GFX.worldCtx(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = true;
    const hy = (0 - cam.y) * cam.zoom + H / 2, [top, bot] = skyColours(tod), view = cam.viewRect(140);
    if (!gx) drawSky(G, tod, night, hy, top, bot);
    ctx.save(); cam.apply(ctx);
    Scene.back(ctx, G, view, night); Scene.objects(ctx, G, view, night); Scene.ground(ctx, view);
    RenderWorld.creatures(ctx, G, night); RenderWorld.player(ctx, G);
    Scene.front(ctx, G, view); RenderWorld.rings(ctx, G);
    G.particles.draw(ctx, cam);
    ctx.restore();
    const dark = night * .62, warm = Math.max(0, 1 - Math.abs(tod - .8) / .07) + Math.max(0, 1 - Math.abs(tod - .25) / .06);
    if (gx) {
      const gc = GFX.glowCtx(); gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(0, 0, gc.canvas.width, gc.canvas.height);
      if (night > .12) { gc.setTransform(gc.canvas.width / W, 0, 0, gc.canvas.height / H, 0, 0); gc.save(); cam.apply(gc); RenderWorld.glows(gc, G, night); gc.restore(); }
      const [px, py] = cam.toScreen(p.x, p.y);
      GFX.render(G, { night, dark, warm, floorY: hy, top, bot, cloud: G.forest.weather.fog * .6, rain: 0, humid: .25 + G.forest.weather.fog * 1.6, sun: sunPos(tod, hy), moon: moonPos(tod, night, hy), under: false, player: [px, py], poolR: Math.max(W, H) * .4, tops: () => H + 200 });
      ctx = mainCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    } else {
      if (dark > .01) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${lerp(255, 52, dark) | 0},${lerp(255, 64, dark) | 0},${lerp(255, 118, dark) | 0})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
      if (warm > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,70,${warm * .5})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
      if (night > .12) { ctx.save(); cam.apply(ctx); ctx.globalCompositeOperation = 'lighter'; RenderWorld.glows(ctx, G, night); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; }
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(4,6,14,${.3 + night * .2})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    // At night the dark dims the parrot: draw it again on top, a little brighter, so it is always easy to find.
    if (night > .12 && p.stage !== 'egg' && p.mode !== 'nest') { ctx.save(); cam.apply(ctx); ctx.globalAlpha = Math.min(.6, night); RenderWorld.player(ctx, G); ctx.restore(); ctx.globalAlpha = 1; }
    if (!clean) RenderHud.draw(ctx, G, W, H, night);
    Cinematic.draw(ctx, W, H);
  }
  function snapshot(G) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    frame(G, 0, true);
    if (typeof GFX !== 'undefined' && GFX.active()) c.getContext('2d').drawImage(GFX.canvas(), 0, 0, c.width, c.height);
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }
  function invalidate() { /* nothing is cached per world */ }
  return { init, resize, setQuality, getFps, frame, snapshot, invalidate, skyColours };
})();
