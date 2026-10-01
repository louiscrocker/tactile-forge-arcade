/* ============================================================
   render.js — composing the garden
   ============================================================
   Layers, back to front:
     sky (time of day, overcast)  →  stars, sun, moon, clouds,
     rainbow  →  far hills / fence / far plants / bokeh (parallax)
     →  soil & grass & the wall  →  for each plant: back leaves,
     stems, front leaves, flowers  →  critters, exuviae, eggs,
     players  →  rain / snow  →  particles  →  lighting tint
     →  fireflies / pollen  →  vignette, bird, letterbox, labels
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1;
  let bokeh = null, farPlants = null, fence = null, wallImg = null;
  const SKY = [
    [0.00, '#0a1030', '#1a2a55'],
    [0.19, '#1a1e4a', '#8a4a5a'],
    [0.26, '#6f9ede', '#ffc38f'],
    [0.38, '#6ab2f0', '#dcf1ff'],
    [0.55, '#4b9ce8', '#cfe9ff'],
    [0.70, '#6ba6e3', '#ffd9a3'],
    [0.79, '#4a4d9c', '#ff9a5c'],
    [0.86, '#1a2050', '#5c3d6c'],
    [1.00, '#0a1030', '#1a2a55']
  ];
  const stars = [], clouds = [], grass = [], daisies = [], pebbles = [];
  let builtFor = -1;
  let quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    for (let i = 0; i < 140; i++) stars.push([Math.random(), Math.random() * .7, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 9; i++) clouds.push(makeCloud(i));
  }

  function resize(w, h, dpr) {
    W = w; H = h; DPR = quality === 'low' ? 1 : dpr;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    bokeh = null; farPlants = null; fence = null;
  }

  function setQuality(q) { if (q !== quality) { quality = q; resize(W, H, devicePixelRatio || 1); } }
  function getQuality() { return quality; }
  function getFps() { return fps; }

  /* ---------- helpers ---------- */
  function skyColours(tod) {
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
    const a = SKY[i], b = SKY[i + 1];
    const t = smoothstep(a[0], b[0], tod);
    return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t)];
  }
  function nightAmount(tod) {
    if (tod < .2) return 1;
    if (tod < .3) return 1 - smoothstep(.2, .3, tod);
    if (tod > .78) return smoothstep(.78, .9, tod);
    return 0;
  }
  function seasonTint(garden) {
    if (!garden) return { key: 'summer', amount: 0 };
    const s = garden.season, t = garden.seasonT;
    const info = SEASON_INFO[s];
    let amount = info.leafTint[1];
    if (s === 'autumn') amount *= smoothstep(0, .8, t) + .2;
    if (s === 'spring') amount *= 1 - smoothstep(0, .7, t);
    return { key: s, tint: info.leafTint[0], amount: clamp(amount, 0, 1) };
  }

  function makeCloud(i) {
    const c = document.createElement('canvas');
    const w = 560, h = 320;
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const n = 7 + (Math.random() * 5 | 0);
    for (let k = 0; k < n; k++) {
      const x = 120 + Math.random() * (w - 240), y = 130 + Math.random() * 60, r = 40 + Math.random() * 55;
      const rg = g.createRadialGradient(x, y, r * .1, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,.95)');
      rg.addColorStop(.6, 'rgba(255,255,255,.55)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return { img: c, x: Math.random(), y: .05 + Math.random() * .3, s: .6 + Math.random() * .9, sp: 4 + Math.random() * 8, a: .5 + Math.random() * .5 };
  }

  function buildGround(seed, bounds) {
    grass.length = 0; daisies.length = 0; pebbles.length = 0;
    const rng = mulberry32(seed ^ 0x5151);
    const l = bounds.left - 800, r = bounds.right + 800;
    for (let x = l; x < r; x += 7) grass.push({ x: x + rng() * 6, h: 18 + rng() * 46, lean: (rng() - .5) * .9, w: 2 + rng() * 2.5, c: (rng() * 4) | 0, ph: rng() * TAU });
    for (let i = 0; i < 60; i++) daisies.push({ x: lerp(l, r, rng()), h: 26 + rng() * 30, r: 6 + rng() * 5, ph: rng() * TAU, pink: rng() < .3 });
    for (let i = 0; i < 90; i++) pebbles.push({ x: lerp(l, r, rng()), y: 4 + rng() * 40, r: 3 + rng() * 7, k: rng() });
  }

  function buildFar() {
    farPlants = document.createElement('canvas');
    farPlants.width = Math.round(W * 1.8); farPlants.height = Math.round(H * .9);
    const g = farPlants.getContext('2d');
    if (quality !== 'low') g.filter = 'blur(5px)';
    const rng = mulberry32(99);
    const base = farPlants.height;
    for (let i = 0; i < 26; i++) {
      const x = rng() * farPlants.width;
      const h = base * (0.35 + rng() * .5);
      const col = mixHex('#3d7a4a', '#8fbf72', rng(), .75);
      g.strokeStyle = col; g.lineWidth = 6 + rng() * 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + (rng() - .5) * 80, base - h * .5, x + (rng() - .5) * 120, base - h); g.stroke();
      g.fillStyle = col;
      for (let k = 0; k < 6; k++) {
        const ly = base - h * (0.3 + rng() * .7), lx = x + (rng() - .5) * 100;
        g.beginPath(); g.ellipse(lx, ly, 26 + rng() * 30, 12 + rng() * 12, rng() * TAU, 0, TAU); g.fill();
      }
      if (rng() < .4) {
        g.fillStyle = mixHex('#f2a2c0', '#fff0a0', rng(), .8);
        g.beginPath(); g.arc(x + (rng() - .5) * 60, base - h - 10, 12 + rng() * 10, 0, TAU); g.fill();
      }
    }
    g.filter = 'none';

    fence = document.createElement('canvas');
    fence.width = Math.round(W * 1.6); fence.height = 160;
    const f = fence.getContext('2d');
    if (quality !== 'low') f.filter = 'blur(2px)';
    for (let x = 0; x < fence.width; x += 34) {
      f.fillStyle = mixHex('#c9b08a', '#e8d6b4', (x / 34) % 2 ? .3 : .7, .85);
      f.fillRect(x, 20 + Math.sin(x * .05) * 4, 22, 140);
      f.beginPath(); f.moveTo(x, 22); f.lineTo(x + 11, 6); f.lineTo(x + 22, 22); f.closePath(); f.fill();
    }
    f.fillStyle = 'rgba(200,175,135,.85)';
    f.fillRect(0, 50, fence.width, 14); f.fillRect(0, 110, fence.width, 14);
    f.filter = 'none';

    bokeh = document.createElement('canvas');
    bokeh.width = Math.round(W * 1.6); bokeh.height = Math.round(H * 1.2);
    const b = bokeh.getContext('2d');
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * bokeh.width, y = Math.random() * bokeh.height, r = 20 + Math.random() * 70;
      const col = pick(['255,240,150', '200,255,170', '255,200,220', '180,230,255', '255,255,255']);
      const rg = b.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${col},.18)`); rg.addColorStop(.7, `rgba(${col},.08)`); rg.addColorStop(1, `rgba(${col},0)`);
      b.fillStyle = rg; b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
    }
  }

  /* The stone wall, drawn once into a sprite. */
  function buildWall() {
    wallImg = document.createElement('canvas');
    const w = 300, h = 460;
    wallImg.width = w; wallImg.height = h;
    const g = wallImg.getContext('2d');
    const rng = mulberry32(777);
    g.fillStyle = '#6f6a62'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 46) {
      const off = ((y / 46) | 0) % 2 ? 40 : 0;
      for (let x = -40 + off; x < w; x += 84) {
        const sw = 78 + rng() * 6, sh = 40 + rng() * 5;
        const col = mixHex('#8f8a80', '#b8b0a2', rng());
        g.fillStyle = col;
        rr(g, x + 2, y + 2, sw, sh, 8); g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)'; rr(g, x + 6, y + 5, sw - 10, sh * .35, 6); g.fill();
        if (rng() < .35) { g.fillStyle = 'rgba(90,140,60,.45)'; g.beginPath(); g.ellipse(x + rng() * sw, y + sh - 4, 10 + rng() * 14, 5, 0, 0, TAU); g.fill(); }
      }
    }
    /* the crack: a dark diagonal gap around y=320 (world -140) */
    g.strokeStyle = '#1a1612'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(90, 300); g.lineTo(150, 322); g.lineTo(230, 318); g.stroke();
    g.strokeStyle = '#2a2420'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(80, 296); g.lineTo(150, 318); g.lineTo(240, 314); g.stroke();
  }

  /* ---------- the frame ---------- */
  function frame(G, dt) {
    const { cam, garden, tod, time } = G;
    const players = G.players;
    const weather = garden.weather;
    const night = nightAmount(tod);
    G.night = night;
    /* fps for auto quality — decided before any sprite is used this frame */
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    if (builtFor !== garden.seed) { buildGround(garden.seed, garden.bounds); builtFor = garden.seed; }
    if (!bokeh) buildFar();
    if (!wallImg) buildWall();
    const season = seasonTint(garden);
    const cold = weather.snow;


    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';

    /* --- sky --- */
    const horizonY = (0 - cam.y) * cam.zoom + H / 2;
    let [top, bot] = skyColours(tod);
    if (weather.cloud > .01) { top = mixHex(top, '#7d8794', weather.cloud * .75); bot = mixHex(bot, '#b9bfc6', weather.cloud * .7); }
    if (cold > .01) { top = mixHex(top, '#9fb4cc', cold * .35); bot = mixHex(bot, '#e6eef6', cold * .45); }
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 10));
    sky.addColorStop(0, top); sky.addColorStop(1, bot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (night > .05 && weather.cloud < .8) {
      for (const [sx, sy, r, ph] of stars) {
        const tw = .5 + .5 * Math.sin(time * 2 + ph * 6);
        ctx.globalAlpha = night * (0.35 + .65 * tw) * (1 - weather.cloud);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sx * W, sy * H, .6 + r * 1.3, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawSunMoon(tod, night, horizonY, weather.cloud);

    for (const c of clouds) {
      const cx = ((c.x * W * 1.5 + time * c.sp * (1 + weather.gust * 4) - cam.x * .05) % (W * 1.5 + 600)) - 300;
      const cy = c.y * H * .6 - cam.y * .03 - 250;
      ctx.globalAlpha = c.a * (1 - night * .75) * (1 - weather.cloud * .5);
      ctx.drawImage(c.img, cx, cy, c.img.width * c.s, c.img.height * c.s);
      if (weather.cloud > .3) {                       // heavier grey clouds on top
        ctx.globalAlpha = weather.cloud * .8;
        ctx.filter = quality === 'low' ? 'none' : 'brightness(.75)';
        ctx.drawImage(c.img, cx + 140, cy + 60, c.img.width * c.s * 1.3, c.img.height * c.s * 1.1);
        ctx.filter = 'none';
      }
    }
    ctx.globalAlpha = 1;

    /* rainbow */
    if (weather.rainbow > .02) drawRainbow(horizonY, weather.rainbow, cam);

    /* far hills */
    const hillBase = horizonY - 10;
    for (let i = 2; i >= 0; i--) {
      const par = .06 + i * .05;
      let col = mixHex(['#8ec279', '#6fae62', '#57984f'][i], '#1b2a3c', night * .8);
      if (season.key === 'autumn') col = mixHex(col, '#c9a04a', season.amount * .5);
      if (cold > 0) col = mixHex(col, '#e9eef4', cold * .85);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const amp = 40 + i * 30, yb = hillBase - 60 - i * 55;
      for (let x = 0; x <= W; x += 20) {
        const wx = x + cam.x * par;
        ctx.lineTo(x, yb + Math.sin(wx * .0025 + i) * amp + Math.sin(wx * .007 + i * 2) * amp * .3);
      }
      ctx.lineTo(W, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1 - night * .5;
    const fx = -((cam.x * .12) % 34) - 34;
    ctx.drawImage(fence, fx, hillBase - 150, fence.width, 160);
    ctx.drawImage(fence, fx + fence.width, hillBase - 150, fence.width, 160);
    if (quality !== 'low') {
      const fpx = -W * .4 - cam.x * .22;
      ctx.globalAlpha = (1 - night * .3) * (1 - cold * .7);
      ctx.drawImage(farPlants, fpx, hillBase - farPlants.height + 20);
      ctx.drawImage(farPlants, fpx + farPlants.width, hillBase - farPlants.height + 20);
      ctx.globalAlpha = (1 - night * .6) * (1 - weather.cloud * .6);
      ctx.drawImage(bokeh, -W * .3 - cam.x * .1, -H * .1 - cam.y * .05);
    }
    ctx.globalAlpha = 1;

    /* ---------------- world space ---------------- */
    ctx.save();
    cam.apply(ctx);
    const view = cam.viewRect(120);

    drawGround(G, view, night, cold, season);
    drawWall(G, view, time);
    for (const P of garden.plants) drawPlant(G, P, view, season, cold);
    drawEntities(G, view, time);
    drawPrecipitation(G, view, weather, time, dt);
    G.particles.draw(ctx, cam);
    ctx.restore();

    /* ---------------- lighting ---------------- */
    const dark = Math.max(night, weather.cloud * .35);
    if (dark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      const nb = night, cb = weather.cloud * .35 * (1 - night);
      ctx.fillStyle = `rgba(${lerp(255, 95, nb) - cb * 60 | 0},${lerp(255, 115, nb) - cb * 50 | 0},${lerp(255, 190, nb) - cb * 30 | 0},1)`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    const warm = (Math.max(0, 1 - Math.abs(tod - .78) / .09) + Math.max(0, 1 - Math.abs(tod - .26) / .07)) * (1 - weather.cloud);
    if (warm > .01) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = `rgba(255,150,70,${warm * .55})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.save();
    cam.apply(ctx);
    G.particles.ensureAmbient(quality === 'low' ? 30 : 70, view);
    if (weather.rain < .5 && cold < .5) G.particles.drawAmbient(ctx, view, time, night, dt);
    ctx.restore();

    /* vignette (+ red pulse when the bird is coming) */
    const danger = G.bird ? G.bird.danger() : 0;
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, danger > 0 ? `rgba(${120 + danger * 100 | 0},20,10,${.3 + danger * .35 * (0.5 + 0.5 * Math.sin(time * 12))})` : `rgba(10,20,10,${.28 + night * .2})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    drawBird(G);
    drawOverlays(G, night);
    Cinematic.draw(ctx, W, H);
  }

  function drawSunMoon(tod, night, horizonY, cloud) {
    const sunT = invLerp(.22, .82, tod);
    if (tod > .2 && tod < .84) {
      const a = Math.PI * sunT;
      const x = W * (0.08 + .84 * sunT), y = horizonY - Math.sin(a) * (horizonY * .9) - 10;
      const r = 42;
      ctx.globalAlpha = 1 - cloud * .7;
      const g = ctx.createRadialGradient(x, y, r * .2, x, y, r * 5);
      g.addColorStop(0, 'rgba(255,250,220,.9)'); g.addColorStop(.15, 'rgba(255,230,150,.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = mixHex('#fff6d0', '#ff9a4a', Math.pow(Math.abs(sunT - .5) * 2, 3));
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const moonT = tod < .5 ? tod + .5 : tod - .5;
      const mT = invLerp(.22, .82, moonT);
      const a = Math.PI * clamp(mT, 0, 1);
      const x = W * (0.08 + .84 * mT), y = horizonY - Math.sin(a) * (horizonY * .85) - 10;
      ctx.globalAlpha = night * (1 - cloud * .8);
      const g = ctx.createRadialGradient(x, y, 20, x, y, 140);
      g.addColorStop(0, 'rgba(220,230,255,.35)'); g.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 140, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f2f4ff'; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(180,190,220,.5)';
      ctx.beginPath(); ctx.arc(x - 9, y - 6, 6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 8, y + 9, 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 10, y - 12, 3, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawRainbow(horizonY, k, cam) {
    const cx = W * .5 - cam.x * .05, cy = horizonY + 60, R = Math.max(W, H) * .62;
    const cols = ['#ff4b4b', '#ff9a2e', '#ffe14b', '#5ad36a', '#3fb9ff', '#5d5dff', '#b45cff'];
    ctx.save();
    ctx.globalAlpha = k * .32;
    ctx.lineWidth = R * .022;
    cols.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath(); ctx.arc(cx, cy, R - i * R * .022, Math.PI, TAU); ctx.stroke();
    });
    ctx.restore();
  }

  function drawGround(G, view, night, cold, season) {
    const time = G.time;
    const g = ctx.createLinearGradient(0, -6, 0, 300);
    g.addColorStop(0, '#6a4a2c'); g.addColorStop(.15, '#4a3320'); g.addColorStop(1, '#2c1d12');
    ctx.fillStyle = g;
    ctx.fillRect(view.l, -4, view.r - view.l, Math.max(0, view.b + 4));
    ctx.fillStyle = 'rgba(255,220,160,.12)';
    ctx.fillRect(view.l, -4, view.r - view.l, 6);
    for (const p of pebbles) {
      if (p.x < view.l || p.x > view.r) continue;
      ctx.fillStyle = mixHex('#8a7a6a', '#c9bfae', p.k);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * .7, 0, 0, TAU); ctx.fill();
    }
    /* fallen leaves in autumn */
    if (season.key === 'autumn' || season.key === 'winter') {
      const rng = mulberry32(31);
      for (let i = 0; i < 80; i++) {
        const x = lerp(G.garden.bounds.left, G.garden.bounds.right, rng()), y = -2 + rng() * 22;
        if (x < view.l || x > view.r) continue;
        ctx.fillStyle = withAlpha(['#e0a030', '#d9742a', '#c94a2a', '#e8c040'][i % 4], .85 * (season.key === 'winter' ? .5 : season.amount));
        ctx.beginPath(); ctx.ellipse(x, y, 9, 4.5, rng() * TAU, 0, TAU); ctx.fill();
      }
    }
    const cols = ['#4f9a3a', '#5fae43', '#3f8a2e', '#74c24f'];
    const step = quality === 'low' ? 2 : 1;
    const gust = G.garden.weather.gust;
    for (let i = 0; i < grass.length; i += step) {
      const b = grass[i];
      if (b.x < view.l || b.x > view.r) continue;
      const sw = Math.sin(time * 1.8 + b.ph) * .25 + b.lean + gust * .9;
      let col = cols[b.c];
      if (season.key === 'autumn') col = mixHex(col, '#c9a04a', season.amount * .4);
      if (cold > 0) col = mixHex(col, '#dfe7ee', cold * .8);
      ctx.strokeStyle = col; ctx.lineWidth = b.w; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, 2);
      ctx.quadraticCurveTo(b.x + sw * b.h * .3, -b.h * .55, b.x + sw * b.h, -b.h);
      ctx.stroke();
    }
    if (season.key === 'spring' || season.key === 'summer') for (const d of daisies) {
      if (d.x < view.l || d.x > view.r) continue;
      const sw = Math.sin(time * 1.4 + d.ph) * 4 + gust * 10;
      ctx.strokeStyle = '#4a9a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(d.x, 0); ctx.quadraticCurveTo(d.x + sw * .5, -d.h * .5, d.x + sw, -d.h); ctx.stroke();
      ctx.fillStyle = d.pink ? '#f7a8c4' : '#fff';
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU;
        ctx.beginPath(); ctx.ellipse(d.x + sw + Math.cos(a) * d.r * .8, -d.h + Math.sin(a) * d.r * .8, d.r * .5, d.r * .3, a, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#f5c531'; ctx.beginPath(); ctx.arc(d.x + sw, -d.h, d.r * .38, 0, TAU); ctx.fill();
    }
    /* snow on the ground */
    if (cold > .02) {
      ctx.fillStyle = `rgba(245,250,255,${cold * .95})`;
      ctx.beginPath();
      ctx.moveTo(view.l, 6);
      for (let x = view.l; x <= view.r; x += 40) ctx.lineTo(x, -6 - Math.sin(x * .01) * 5 * cold - Math.sin(x * .031) * 3 * cold);
      ctx.lineTo(view.r, 6); ctx.closePath(); ctx.fill();
    }
  }

  function drawWall(G, view, time) {
    const wall = G.garden.wall;
    const x = wall.x;
    if (x + 160 < view.l || x - 160 > view.r) return;
    ctx.drawImage(wallImg, x - 150, -460, 300, 460);
    /* moss and ivy at the foot */
    ctx.fillStyle = 'rgba(70,120,50,.7)';
    ctx.beginPath(); ctx.ellipse(x - 90, -6, 60, 14, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 70, -8, 50, 12, 0, 0, TAU); ctx.fill();
    const g = G.garden;
    const cold = g.weather.snow;
    if (cold > .02) { ctx.fillStyle = `rgba(245,250,255,${cold})`; ctx.beginPath(); ctx.ellipse(x, -462, 156, 10, 0, 0, TAU); ctx.fill(); }
    /* other ladybugs already asleep in the crack */
    const sleepers = g.season === 'winter' || g.season === 'autumn' && g.seasonT > .6;
    if (sleepers) {
      const rng = mulberry32(5);
      for (let i = 0; i < 14; i++) {
        const sp = SPECIES[Object.keys(SPECIES)[i % 6]];
        ctx.save();
        ctx.translate(x - 62 + rng() * 150 + Math.sin(i) * 3, -146 + (rng() - .5) * 22 + (i % 3) * 3);
        ctx.rotate(rng() * TAU);
        ctx.scale(.36, .32);
        Sprites.drawAdult(ctx, { s: 1, species: sp, open: 0, walk: 0, fresh: 0, tucked: true });
        ctx.restore();
      }
    }
    if (g.season === 'winter' && G.players.some(p => p.state === 'flying' || p.state === 'adult')) {
      const pulse = .5 + .5 * Math.sin(time * 4);
      ctx.strokeStyle = `rgba(255,230,150,${.5 + pulse * .4})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(wall.crack.x, wall.crack.y, 60 + pulse * 10, 0, TAU); ctx.stroke();
    }
  }

  function segPoly(plant, s) {
    const L = [], R = [];
    for (let i = 0; i <= SEG_SAMPLES; i++) {
      const p = s.pts[i];
      const q = s.pts[Math.min(SEG_SAMPLES, i + 1)], o = s.pts[Math.max(0, i - 1)];
      let tx = q[0] - o[0], ty = q[1] - o[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const w = lerp(s.w0, s.w1, s.cum[i] / s.len) * .5;
      const sx = p[0] + plant.sway(p[0], p[1]);
      L.push([sx - ty * w, p[1] + tx * w]);
      R.push([sx + ty * w, p[1] - tx * w]);
    }
    return [L, R];
  }

  function drawPlant(G, plant, view, season, cold) {
    const time = G.time;
    const bare = G.garden.bareness();
    const inView = (x, y, pad) => x > view.l - pad && x < view.r + pad && y > view.t - pad && y < view.b + pad;
    if (!inView((plant.bounds.left + plant.bounds.right) / 2, plant.bounds.top / 2, (plant.bounds.right - plant.bounds.left) / 2 + 100)) return;
    const T = plant.type;
    const leafVisible = (lf) => lf.fall >= bare;

    for (const lf of plant.leaves) {
      if (lf.z >= 0 || !leafVisible(lf)) continue;
      const p = plant.posOn(lf.seg, lf.t);
      if (!inView(p.x, p.y, lf.size * 1.6)) continue;
      Sprites.drawLeaf(ctx, lf, p.x, p.y, time, false, season);
    }

    const segs = plant.segs.slice().sort((a, b) => a.depth - b.depth);
    for (const s of segs) {
      const n0 = plant.nodes[s.a], n1 = plant.nodes[s.b];
      if (!inView((n0.x + n1.x) / 2, (n0.y + n1.y) / 2, s.len * .6 + 40)) continue;
      const [L, R] = segPoly(plant, s);
      ctx.beginPath();
      ctx.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath();
      const woody = (s.depth === 0 && T.woody) ? smoothstep(-200, -1400, n0.y) : 1;
      let base = mixHex(T.woodCol, T.stemCol[1], woody);
      if (season.key === 'autumn' || season.key === 'winter') base = mixHex(base, '#7a6a3a', season.amount * .5);
      const g = ctx.createLinearGradient(L[0][0], L[0][1], R[0][0], R[0][1]);
      g.addColorStop(0, shade(T.stemCol[0], 1.15 + s.hueShift * .01));
      g.addColorStop(.5, base);
      g.addColorStop(1, shade(T.stemCol[2], .8));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,220,.25)'; ctx.lineWidth = Math.max(1, s.w0 * .12);
      ctx.beginPath();
      for (let i = 0; i < L.length; i++) { const x = lerp(L[i][0], R[i][0], .18), y = lerp(L[i][1], R[i][1], .18); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(20,40,10,.35)'; ctx.lineWidth = Math.max(1, s.w0 * .1);
      ctx.beginPath();
      for (let i = 0; i < R.length; i++) { const x = lerp(L[i][0], R[i][0], .9), y = lerp(L[i][1], R[i][1], .9); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      if (s.depth === 0 && T.thorns) {
        ctx.fillStyle = '#7a4a2a';
        for (let i = 3; i < SEG_SAMPLES - 1; i += 5) {
          const side = ((i / 5) | 0) % 2 ? L : R, other = side === L ? R : L;
          const p = side[i], q = side[i + 1];
          const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
          const cx = (other[i][0] + other[i + 1][0]) / 2, cy = (other[i][1] + other[i + 1][1]) / 2;
          let nx = mx - cx, ny = my - cy; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
          ctx.lineTo(mx + nx * 9 + (q[0] - p[0]) * .6, my + ny * 9 + (q[1] - p[1]) * .6);
          ctx.closePath(); ctx.fill();
        }
      }
      /* snow along the upper edge */
      if (cold > .3) {
        ctx.fillStyle = `rgba(245,250,255,${(cold - .3) / .7 * .92})`;
        for (let i = 1; i < SEG_SAMPLES; i += 2) {
          const p0 = s.pts[i - 1], p1 = s.pts[i + 1];
          const tx = p1[0] - p0[0], ty = p1[1] - p0[1], tl = Math.hypot(tx, ty) || 1;
          const flat = Math.abs(tx / tl);                 // 1 = horizontal, holds snow
          if (flat < .55) continue;
          const l = L[i], r = R[i];
          const up = l[1] < r[1] ? l : r;
          const w = Math.hypot(l[0] - r[0], l[1] - r[1]);
          const k = (flat - .55) / .45;
          ctx.beginPath(); ctx.ellipse(up[0], up[1] - w * .1, (s.len / SEG_SAMPLES) * 1.1, (w * .22 + 1.2) * k + .6, Math.atan2(ty, tx), 0, TAU); ctx.fill();
        }
      }
    }
    for (const n of plant.nodes) {
      if (n.segs.length < 2 || n.id === 0) continue;
      if (!inView(n.x, n.y, 30)) continue;
      const s = plant.segs[n.segs[0]];
      const w = plant.posOn(s, s.a === n.id ? 0 : 1, false).w;
      ctx.fillStyle = withAlpha(T.stemCol[1], .9);
      ctx.beginPath(); ctx.arc(n.x + plant.sway(n.x, n.y), n.y, w * .52, 0, TAU); ctx.fill();
    }

    for (const lf of plant.leaves) {
      if (lf.z < 0 || !leafVisible(lf)) continue;
      const p = plant.posOn(lf.seg, lf.t);
      if (!inView(p.x, p.y, lf.size * 1.6)) continue;
      Sprites.drawLeaf(ctx, lf, p.x, p.y, time, quality !== 'low', season);
    }
    /* flowers bloom in spring and summer; pods and buds hang on into autumn */
    const bloom = season.key === 'spring' ? smoothstep(.2, .7, G.garden.seasonT) : season.key === 'summer' ? 1 : season.key === 'autumn' ? 1 - smoothstep(0, .5, G.garden.seasonT) : 0;
    for (const f of plant.flowers) {
      const x = f.x + plant.sway(f.x, f.y);
      if (!inView(x, f.y, f.size * 3)) continue;
      const isFruit = f.kind === 'pod' || f.kind === 'bud';
      const a = isFruit ? (season.key === 'winter' ? 0 : 1) : bloom;
      if (a <= .01) continue;
      ctx.globalAlpha = a;
      Sprites.drawFlower(ctx, f, x, f.y, time);
      ctx.globalAlpha = 1;
    }
  }

  function drawEntities(G, view, time) {
    const { garden, players } = G;
    const inView = (x, y, pad) => x > view.l - pad && x < view.r + pad && y > view.t - pad && y < view.b + pad;

    for (const e of G.exuviae) {
      const P = garden.plantAt(e.plant || 0);
      const p = P.posOn(e.seg, e.t);
      if (!inView(p.x, p.y, 60)) continue;
      const flutter = Math.sin(time * 2.5 + (e.born || 0)) * .06 * (1 + garden.weather.gust * 3);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty * e.dir, p.tx * e.dir) + flutter);
      Sprites.drawExuvia(ctx, { s: e.s, instar: e.instar, alpha: e.alpha === undefined ? .75 : e.alpha });
      ctx.restore();
    }
    for (const c of G.eggClusters) {
      const P = garden.plantAt(c.plant || 0);
      const p = P.posOn(c.seg, c.t);
      if (!inView(p.x, p.y, 40)) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty, p.tx));
      Sprites.drawEggCluster(ctx, { s: 1, count: c.count, seed: c.seed, hatched: c.hatched });
      ctx.restore();
    }
    /* leaf spot glow when a player is ready */
    for (const pl of players) {
      if (!(pl.readyFlag && (pl.state === 'larva' || pl.state === 'adult'))) continue;
      const P = pl.plant;
      for (const ls of P.leafSpots) {
        const x = ls.x + P.sway(ls.x, ls.y);
        if (!inView(x, ls.y, 40)) continue;
        const near = pl.pupaSpot === ls;
        const pulse = .5 + .5 * Math.sin(time * 4 + ls.leaf);
        ctx.globalAlpha = near ? .9 : .35 + pulse * .25;
        ctx.strokeStyle = near ? '#fff4a0' : '#ffe27a'; ctx.lineWidth = near ? 3 : 1.5;
        ctx.beginPath(); ctx.arc(x, ls.y, (near ? 26 : 16) + pulse * 4, 0, TAU); ctx.stroke();
        if (near) { ctx.fillStyle = 'rgba(255,240,160,.25)'; ctx.beginPath(); ctx.arc(x, ls.y, 26 + pulse * 4, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    for (const pl of players) {
      if (pl.state === 'flying' && pl.landSpot) {
        const P = garden.plantAt(pl.landSpot.plant);
        const p = P.posOn(pl.landSpot.seg, pl.landSpot.t);
        ctx.globalAlpha = .8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 14 + Math.sin(time * 8) * 3, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    for (const P of garden.plants) {
      const A = P.aphids;
      for (const d of A.honeydew) {
        if (!inView(d.x, d.y, 10)) continue;
        ctx.save(); ctx.translate(d.x, d.y); Sprites.drawHoneydew(ctx, 2.2 + Math.sin(time * 3 + d.life) * .3); ctx.restore();
      }
      for (const sc of A.scales) {
        if (!inView(sc.x, sc.y, 10)) continue;
        ctx.save(); ctx.translate(sc.x, sc.y); ctx.rotate(sc.ang); Sprites.drawScale(ctx, { s: 1 }); ctx.restore();
      }
      for (const a of A.list) {
        if (!inView(a.x, a.y, 20)) continue;
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang);
        if (a.hidden > .01) ctx.globalAlpha = 1 - a.hidden * .65;
        const kick = a.kick > 0 ? time * 40 : 0;
        Sprites.drawAphid(ctx, { s: 1, variant: a.variant, winged: a.winged, walk: a.state === 'walk' ? a.walk : kick, grow: a.grow });
        ctx.restore();
      }
      for (const m of A.migrants) {
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.ang);
        Sprites.drawAphid(ctx, { s: 1.1, variant: m.variant, winged: true, walk: m.walk });
        ctx.restore();
      }
      if (P.ants.enabled) for (const a of P.ants.list) {
        if (!inView(a.x, a.y, 30)) continue;
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang);
        Sprites.drawAnt(ctx, { s: 1, walk: a.pause > 0 || a.drinking > 0 ? 0 : a.walk, bite: a.bite });
        ctx.restore();
      }
      if (P.npcs && P.npcs.list) for (const w of P.npcs.list) {
        if (!inView(w.x, w.y, 40)) continue;
        ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.ang);
        Sprites.drawLarva(ctx, { s: STAGES[w.instar].scale * .95, instar: w.instar, walk: w.pause > 0 ? 0 : w.walk, chew: w.chew });
        ctx.restore();
      }
    }

    /* the bird's shadow on the garden */
    const bird = G.bird;
    if (bird && bird.state === 'pass') {
      const sy = Math.min(-10, bird.targetY + 40);
      const g = ctx.createRadialGradient(bird.x, sy, 10, bird.x, sy, 150);
      g.addColorStop(0, 'rgba(10,15,25,.5)'); g.addColorStop(1, 'rgba(10,15,25,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(bird.x, sy, 170, 90, 0, 0, TAU); ctx.fill();
    }

    for (const pl of players) pl.draw(ctx, time);
  }

  /* rain streaks and snowflakes, in world space so they fall through the garden */
  function drawPrecipitation(G, view, weather, time, dt) {
    if (weather.rain > .02) {
      const n = Math.round((quality === 'low' ? 90 : 220) * weather.rain);
      ctx.strokeStyle = `rgba(200,225,255,${.32 * weather.rain})`;
      ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      const w = view.r - view.l, h = view.b - view.t;
      const gust = weather.gust * 60;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const hx = ((i * 1234.567) % 1), hy = ((i * 7654.321) % 1);
        const x = view.l + ((hx * w + time * 90 + i * 7) % w);
        const y = view.t + ((hy * h + time * 1400 * (0.8 + hx * .4)) % h);
        ctx.moveTo(x, y); ctx.lineTo(x - 4 - gust * .3, y - 22);
      }
      ctx.stroke();
      /* splashes on the ground */
      if (weather.rain > .4 && chance(dt * 30) && quality !== 'low') {
        const x = rnd(view.l, view.r);
        if (x > -3000 && x < 3000) G.particles.spawn({ type: 'ring', x, y: -2, r: 1, grow: 30, col: 'rgba(200,230,255,.7)', life: .3, width: 1 });
      }
      /* drips off leaves */
      if (chance(dt * 6)) {
        const P = pick(G.garden.plants);
        const lf = pick(P.leaves);
        const p = P.posOn(lf.seg, lf.t);
        const tipx = p.x + Math.cos(lf.ang) * (lf.petiole + lf.size), tipy = p.y + Math.sin(lf.ang) * (lf.petiole + lf.size);
        if (tipx > view.l && tipx < view.r) G.particles.spawn({ type: 'dot', x: tipx, y: tipy, vx: 0, vy: 40, g: 500, r: 2, col: 'rgba(200,230,255,.85)', life: 1.2 });
      }
    }
    if (weather.snow > .02) {
      const n = Math.round((quality === 'low' ? 60 : 160) * weather.snow);
      ctx.fillStyle = `rgba(250,252,255,${.85 * weather.snow})`;
      const w = view.r - view.l, h = view.b - view.t;
      for (let i = 0; i < n; i++) {
        const hx = ((i * 1234.567) % 1), hy = ((i * 7654.321) % 1);
        const x = view.l + ((hx * w + Math.sin(time * .7 + i) * 30 + time * 15) % w);
        const y = view.t + ((hy * h + time * (40 + hx * 40)) % h);
        ctx.beginPath(); ctx.arc(x, y, 1.5 + hx * 2.2, 0, TAU); ctx.fill();
      }
    }
  }

  function drawBird(G) {
    const b = G.bird;
    if (!b || (b.state !== 'pass' && b.state !== 'warning')) return;
    const cam = G.cam;
    if (b.state === 'warning') {
      /* a warning silhouette at the edge it will come from */
      const k = 1 - b.timer / 2.6;
      const sx = b.side < 0 ? 60 + k * 30 : W - 60 - k * 30;
      ctx.save(); ctx.translate(sx, 110); ctx.scale(b.side, 1);
      Sprites.drawBird(ctx, { s: .6, phase: b.phase, alpha: .3 + k * .5 });
      ctx.restore();
      return;
    }
    const [sx] = cam.toScreen(b.x, b.y);
    const sy = 90 + Math.sin(b.phase * .2) * 10;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(b.side * 1.6, 1.6);
    Sprites.drawBird(ctx, { s: 1, phase: b.phase, alpha: .92 });
    ctx.restore();
  }

  function drawOverlays(G, night) {
    const { cam, garden, settings, players } = G;
    ctx.font = `700 13px ${UI_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (wx, wy, text, dy = -30, col = '#fff') => {
      const [sx, sy] = cam.toScreen(wx, wy);
      if (sx < 0 || sx > W || sy < 0 || sy > H) return;
      const w = ctx.measureText(text).width + 16;
      ctx.fillStyle = 'rgba(20,30,20,.7)';
      rr(ctx, sx - w / 2, sy + dy - 11, w, 22, 11); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(text, sx, sy + dy);
    };
    /* player 2 tag always, so the pair can tell who is who */
    if (players.length > 1) players.forEach((p, i) => tag(p.x, p.y, `Player ${i + 1}`, -34 - 20 * p.scale(), i ? '#a9dcff' : '#ffe27a'));
    /* off-screen partner arrow */
    if (players.length > 1) {
      for (const p of players) {
        const [sx, sy] = cam.toScreen(p.x, p.y);
        if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
        const cx = clamp(sx, 40, W - 40), cy = clamp(sy, 120, H - 60);
        const a = Math.atan2(sy - cy, sx - cx);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.fillStyle = p.id === 1 ? '#ffe27a' : '#a9dcff';
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    /* winter: point at the wall */
    if (garden.season === 'winter' && players.some(p => p.state === 'flying' || p.state === 'adult')) {
      const c = garden.wall.crack;
      const [sx, sy] = cam.toScreen(c.x, c.y);
      if (sx < 0 || sx > W || sy < 0 || sy > H) {
        const cx = clamp(sx, 60, W - 60), cy = clamp(sy, 130, H - 80);
        const a = Math.atan2(sy - cy, sx - cx);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.fillStyle = '#ffe27a';
        ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-14, -16); ctx.lineTo(-6, 0); ctx.lineTo(-14, 16); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff'; ctx.font = `900 14px ${UI_FONT}`;
        ctx.fillText('warm crack →', cx, cy + 28);
        ctx.font = `700 13px ${UI_FONT}`;
      }
    }
    if (!settings.labels) return;
    for (const p of players) {
      const stage = STAGES[p.stage];
      const what = p.state === 'flying' ? 'flying ladybug' : p.state === 'hibernating' ? 'hibernating' : stage.name.toLowerCase();
      tag(p.x, p.y, `You · ${what}`, -34 - 20 * p.scale() - (players.length > 1 ? 24 : 0), '#ffe27a');
    }
    for (const P of garden.plants) {
      const seen = new Set();
      for (const a of P.aphids.list) {
        if (seen.has(a.seg) || seen.size > 3) continue;
        seen.add(a.seg);
        tag(a.x, a.y, { green: 'aphids', pink: 'pink aphids', black: 'black bean aphids', yellow: 'oleander aphids' }[a.variant] || 'aphids', -22);
      }
      if (P.aphids.scales.length) { const sc = P.aphids.scales[0]; tag(sc.x, sc.y, 'scale insects', -20, '#f0d9b0'); }
      if (P.ants.enabled) for (const a of P.ants.list) tag(a.x, a.y, 'ant', -22, '#ffd0c0');
      if (P.npcs && P.npcs.list) for (const w of P.npcs.list) tag(w.x, w.y, 'wild larva', -24, '#cfd6e6');
      const nx = P.nodes[Math.min(3, P.nodes.length - 1)];
      tag(nx.x, nx.y, P.type.name, -10, '#d8f5c0');
    }
    for (const e of G.exuviae) { const P = garden.plantAt(e.plant || 0); const p = P.posOn(e.seg, e.t); tag(p.x, p.y, 'shed skin', -22, '#ddd'); }
    for (const c of G.eggClusters) { const P = garden.plantAt(c.plant || 0); const p = P.posOn(c.seg, c.t); tag(p.x, p.y, c.hatched ? 'empty eggs' : 'eggs', -24, '#ffe9a0'); }
    tag(garden.wall.crack.x, garden.wall.crack.y, 'the warm crack', -40, '#ffe9a0');
  }

  /* Render a clean frame with no overlays, for photo mode. */
  function snapshot(G) {
    const saved = G.settings.labels;
    G.settings.labels = false;
    frame(G, 0);
    G.settings.labels = saved;
    return canvas;
  }

  return { init, resize, frame, nightAmount, skyColours, setQuality, getQuality, getFps, snapshot };
})();
