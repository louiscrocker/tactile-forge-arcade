/* ============================================================
   render.js — composing the scene
   ============================================================
   Two scenes share one pipeline:

   MILKWEED  sky → far hills / fence / bokeh → soil & grass →
             back leaves → stems → front leaves & umbels →
             critters, shed skins, egg, you → particles → light

   ROUTE     sky (zone colours, storm, night) → far mountains →
             mid hills / fields / water → props, nectar, trees,
             thermals → flock, you → rain & wind → light
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1;
  let bokeh = null, farPlants = null, fence = null;
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
  const stars = [];
  const clouds = [];
  const grass = [];
  const daisies = [];
  const pebbles = [];
  let builtFor = -1, builtPalette = '';
  const PAL0 = { hills: ['#8ec279', '#6fae62', '#57984f'], soil: ['#6a4a2c', '#4a3320', '#2c1d12'], grass: ['#4f9a3a', '#5fae43', '#3f8a2e', '#74c24f'], far: '#3d7a4a', far2: '#8fbf72', flowerA: '#e9a2c8', flowerB: '#f2c21b' };
  const palette = (G) => (G.scene && G.scene.hills) ? G.scene : PAL0;
  const hillNoise = makeNoise1D(7), hillNoise2 = makeNoise1D(13);

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    for (let i = 0; i < 140; i++) stars.push([Math.random(), Math.random() * .7, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 9; i++) clouds.push(makeCloud(i));
  }

  function resize(w, h, dpr) {
    W = w; H = h; DPR = dpr;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    bokeh = null; farPlants = null; fence = null;
  }

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
  /* zone colours blended across boundaries */
  function zoneMix(route, x) {
    const f = route.frac(x);
    const z = zoneAt(f);
    const i = ZONES.indexOf(z);
    const blendW = 1400 / route.len;
    let other = z, t = 0;
    if (i < ZONES.length - 1 && z.to - f < blendW) { other = ZONES[i + 1]; t = 1 - (z.to - f) / blendW; }
    return { a: z, b: other, t: smoothstep(0, 1, t) };
  }
  function zoneCol(zm, key, idx) {
    const ca = idx === undefined ? zm.a[key] : zm.a[key][idx], cb = idx === undefined ? zm.b[key] : zm.b[key][idx];
    return mixHex(ca, cb, zm.t);
  }
  const rgbOf = hexToRgb;                       // handles '#hex' and 'rgba(...)'
  const mixC = (a, b, t, alpha = 1) => rgbStr(mixRgb(rgbOf(a), rgbOf(b), t), alpha);

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

  function buildGround(seed) {
    grass.length = 0; daisies.length = 0; pebbles.length = 0;
    const rng = mulberry32(seed ^ 0x5151);
    for (let x = -3000; x < 3000; x += 7) grass.push({ x: x + rng() * 6, h: 18 + rng() * 46, lean: (rng() - .5) * .9, w: 2 + rng() * 2.5, c: (rng() * 4) | 0, ph: rng() * TAU });
    for (let i = 0; i < 40; i++) daisies.push({ x: rnd(-2800, 2800), h: 26 + rng() * 30, r: 6 + rng() * 5, ph: rng() * TAU, pink: rng() < .3 });
    for (let i = 0; i < 60; i++) pebbles.push({ x: rnd(-2800, 2800), y: 4 + rng() * 40, r: 3 + rng() * 7, k: rng() });
  }

  function buildFar(pal = PAL0) {
    builtPalette = JSON.stringify(pal);
    farPlants = document.createElement('canvas');
    farPlants.width = Math.round(W * 1.8); farPlants.height = Math.round(H * .9);
    const g = farPlants.getContext('2d');
    g.filter = 'blur(5px)';
    const rng = mulberry32(99);
    const base = farPlants.height;
    for (let i = 0; i < 26; i++) {
      const x = rng() * farPlants.width;
      const h = base * (0.35 + rng() * .5);
      const col = mixHex(pal.far, pal.far2, rng(), .75);
      g.strokeStyle = col; g.lineWidth = 6 + rng() * 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + (rng() - .5) * 80, base - h * .5, x + (rng() - .5) * 120, base - h); g.stroke();
      g.fillStyle = col;
      for (let k = 0; k < 6; k++) {
        const ly = base - h * (0.3 + rng() * .7), lx = x + (rng() - .5) * 100;
        g.beginPath(); g.ellipse(lx, ly, 26 + rng() * 30, 12 + rng() * 12, rng() * TAU, 0, TAU); g.fill();
      }
      if (rng() < .5) {
        g.fillStyle = mixHex(pal.flowerA, pal.flowerB, rng(), .8);
        g.beginPath(); g.arc(x + (rng() - .5) * 60, base - h - 10, 12 + rng() * 10, 0, TAU); g.fill();
      }
    }
    g.filter = 'none';

    fence = document.createElement('canvas');
    fence.width = Math.round(W * 1.6); fence.height = 160;
    const f = fence.getContext('2d');
    f.filter = 'blur(2px)';
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

  /* ============================================================
     the frame
     ============================================================ */
  function frame(G, dt) {
    const { cam, tod, time } = G;
    if (!bokeh || builtPalette !== JSON.stringify(palette(G))) buildFar(palette(G));
    const night = nightAmount(tod);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (G.mode === 'route') frameRoute(G, dt, night); else frameMilkweed(G, dt, night);
    Cinematic.draw(ctx, W, H);
  }

  function lighting(G, night, tod, extraDark = 0) {
    if (night > .01 || extraDark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      const k = Math.max(night, extraDark * .6);
      ctx.fillStyle = `rgba(${lerp(255, 95, k) | 0},${lerp(255, 115, k) | 0},${lerp(255, 190, k) | 0},1)`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    const warm = Math.max(0, 1 - Math.abs(tod - .78) / .09) + Math.max(0, 1 - Math.abs(tod - .26) / .07);
    if (warm > .01) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = `rgba(255,150,70,${warm * .55})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function vignette(night, danger = 0) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(10,20,10,${.28 + night * .2})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (danger > .01) {
      const dg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7);
      dg.addColorStop(0, 'rgba(255,60,30,0)'); dg.addColorStop(1, `rgba(255,60,30,${danger * .35})`);
      ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    }
  }
  function drawStars(night, time) {
    if (night <= .05) return;
    for (const [sx, sy, r, ph] of stars) {
      const tw = .5 + .5 * Math.sin(time * 2 + ph * 6);
      ctx.globalAlpha = night * (0.35 + .65 * tw);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx * W, sy * H, .6 + r * 1.3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawSunMoon(tod, night, horizonY) {
    const sunT = invLerp(.22, .82, tod);
    if (tod > .2 && tod < .84) {
      const a = Math.PI * sunT;
      const x = W * (0.08 + .84 * sunT), y = horizonY - Math.sin(a) * (horizonY * .9) - 10;
      const r = 42;
      const g = ctx.createRadialGradient(x, y, r * .2, x, y, r * 5);
      g.addColorStop(0, 'rgba(255,250,220,.9)'); g.addColorStop(.15, 'rgba(255,230,150,.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = mixHex('#fff6d0', '#ff9a4a', Math.pow(Math.abs(sunT - .5) * 2, 3));
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    if (night > .05) {
      const moonT = tod < .5 ? tod + .5 : tod - .5;
      const mT = invLerp(.22, .82, moonT);
      const a = Math.PI * clamp(mT, 0, 1);
      const x = W * (0.08 + .84 * mT), y = horizonY - Math.sin(a) * (horizonY * .85) - 10;
      ctx.globalAlpha = night;
      const g = ctx.createRadialGradient(x, y, 20, x, y, 140);
      g.addColorStop(0, 'rgba(220,230,255,.35)'); g.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 140, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f2f4ff'; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(180,190,220,.5)';
      ctx.beginPath(); ctx.arc(x - 9, y - 6, 6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 8, y + 9, 4, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  function drawClouds(cam, time, night, extra = 0) {
    for (const c of clouds) {
      const cx = ((c.x * W * 1.5 + time * c.sp - cam.x * .05) % (W * 1.5 + 500)) - 250;
      const cy = c.y * H * .6 - cam.y * .03 - 200;
      ctx.globalAlpha = c.a * (1 - night * .75) * (1 - extra * .5);
      ctx.drawImage(c.img, cx, cy, c.img.width * c.s, c.img.height * c.s);
    }
    ctx.globalAlpha = 1;
  }

  /* ============================================================
     MILKWEED
     ============================================================ */
  function frameMilkweed(G, dt, night) {
    const { plant, cam, player, tod, time } = G;
    if (builtFor !== plant.seed) { buildGround(plant.seed); builtFor = plant.seed; }
    const [top, bot] = skyColours(tod);
    const horizonY = (0 - cam.y) * cam.zoom + H / 2;
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 10));
    sky.addColorStop(0, top); sky.addColorStop(1, bot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    drawStars(night, time);
    drawSunMoon(tod, night, horizonY);
    drawClouds(cam, time, night);

    /* far hills */
    const hillBase = horizonY - 10;
    const pal = palette(G);
    for (let i = 2; i >= 0; i--) {
      const par = .06 + i * .05;
      ctx.fillStyle = mixHex(pal.hills[i], '#1b2a3c', night * .8);
      ctx.beginPath(); ctx.moveTo(0, H);
      const amp = 40 + i * 30, yb = hillBase - 60 - i * 55;
      for (let x = 0; x <= W; x += 20) { const wx = x + cam.x * par; ctx.lineTo(x, yb + Math.sin(wx * .0025 + i) * amp + Math.sin(wx * .007 + i * 2) * amp * .3); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1 - night * .5;
    const fx = -((cam.x * .12) % 34) - 34;
    ctx.drawImage(fence, fx, hillBase - 150, fence.width, 160);
    ctx.drawImage(fence, fx + fence.width, hillBase - 150, fence.width, 160);
    const fpx = -W * .4 - cam.x * .22;
    ctx.globalAlpha = 1 - night * .3;
    ctx.drawImage(farPlants, fpx, hillBase - farPlants.height + 20);
    ctx.drawImage(farPlants, fpx + farPlants.width, hillBase - farPlants.height + 20);
    ctx.globalAlpha = (1 - night * .6);
    ctx.drawImage(bokeh, -W * .3 - cam.x * .1, -H * .1 - cam.y * .05);
    ctx.globalAlpha = 1;

    ctx.save();
    cam.apply(ctx);
    const view = cam.viewRect(120);
    drawGround(G, view, night);
    drawGarden(G, view, time);
    drawPlant(G, view, night);
    drawPlantEntities(G, view, time);
    G.particles.draw(ctx, cam);
    ctx.restore();

    lighting(G, night, tod);
    ctx.save(); cam.apply(ctx);
    G.particles.ensureAmbient(70, view);
    G.particles.drawAmbient(ctx, view, time, night, dt);
    ctx.restore();
    vignette(night, G.wasp ? G.wasp.danger() : 0);
    drawLabelsMilkweed(G);
  }

  function drawGround(G, view, night) {
    const time = G.time;
    const pal = palette(G);
    const g = ctx.createLinearGradient(0, -6, 0, 300);
    g.addColorStop(0, pal.soil[0]); g.addColorStop(.15, pal.soil[1]); g.addColorStop(1, pal.soil[2]);
    ctx.fillStyle = g;
    ctx.fillRect(view.l, -4, view.r - view.l, Math.max(0, view.b + 4));
    ctx.fillStyle = 'rgba(255,220,160,.12)';
    ctx.fillRect(view.l, -4, view.r - view.l, 6);
    for (const p of pebbles) {
      if (p.x < view.l || p.x > view.r) continue;
      ctx.fillStyle = mixHex('#8a7a6a', '#c9bfae', p.k);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * .7, 0, 0, TAU); ctx.fill();
    }
    const cols = pal.grass;
    for (const b of grass) {
      if (b.x < view.l || b.x > view.r) continue;
      const sw = Math.sin(time * 1.8 + b.ph) * .25 + b.lean;
      ctx.strokeStyle = cols[b.c]; ctx.lineWidth = b.w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, 2); ctx.quadraticCurveTo(b.x + sw * b.h * .3, -b.h * .55, b.x + sw * b.h, -b.h); ctx.stroke();
    }
    for (const d of daisies) {
      if (d.x < view.l || d.x > view.r) continue;
      const sw = Math.sin(time * 1.4 + d.ph) * 4;
      ctx.strokeStyle = '#4a9a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(d.x, 0); ctx.quadraticCurveTo(d.x + sw * .5, -d.h * .5, d.x + sw, -d.h); ctx.stroke();
      ctx.fillStyle = d.pink ? '#f7a8c4' : '#fff';
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; ctx.beginPath(); ctx.ellipse(d.x + sw + Math.cos(a) * d.r * .8, -d.h + Math.sin(a) * d.r * .8, d.r * .5, d.r * .3, a, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#f5c531'; ctx.beginPath(); ctx.arc(d.x + sw, -d.h, d.r * .38, 0, TAU); ctx.fill();
    }
  }

  /* your milkweed patch: one background plant per milkweed you have planted */
  function drawGarden(G, view, time) {
    const n = Journal.data ? Journal.data.garden.plants : 0;
    if (!n) return;
    const rng = mulberry32(G.plant.seed ^ 0x9a);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      const x = G.plant.ox + side * (380 + k * 170 + rng() * 60), h = 220 + rng() * 120;
      if (x < view.l - 200 || x > view.r + 200) continue;
      ctx.save(); ctx.translate(x, 0); ctx.globalAlpha = .85;
      Sprites.drawMiniMilkweed(ctx, (i + 1) * 131, h, time, G.plant.type);
      ctx.restore();
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

  function drawPlant(G, view, night) {
    const { plant, time } = G;
    const inView = (x, y, pad) => x > view.l - pad && x < view.r + pad && y > view.t - pad && y < view.b + pad;
    const leafVisible = (lf) => { const s = plant.segs[lf.seg]; const n = plant.nodes[s.b]; return inView(n.x, n.y, lf.size * 1.5); };

    /* back leaves */
    for (const lf of plant.leaves) if (lf.z < 0 && leafVisible(lf)) Sprites.drawLeafBlade(ctx, plant, lf, time, false);

    /* stems */
    const segs = plant.segs.filter(s => s.kind !== 'leaf').sort((a, b) => a.depth - b.depth);
    for (const s of segs) {
      const n0 = plant.nodes[s.a], n1 = plant.nodes[s.b];
      if (!inView((n0.x + n1.x) / 2, (n0.y + n1.y) / 2, s.len * .6 + 40)) continue;
      const [L, R] = segPoly(plant, s);
      ctx.beginPath();
      ctx.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath();
      const g = ctx.createLinearGradient(L[0][0], L[0][1], R[0][0], R[0][1]);
      g.addColorStop(0, shade('#a9d47a', 1.05 + s.hueShift * .01));
      g.addColorStop(.5, '#7fb85a');
      g.addColorStop(1, shade('#4f8a3a', .9));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,220,.25)'; ctx.lineWidth = Math.max(1, s.w0 * .12);
      ctx.beginPath();
      for (let i = 0; i < L.length; i++) { const x = lerp(L[i][0], R[i][0], .18), y = lerp(L[i][1], R[i][1], .18); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(20,40,10,.35)'; ctx.lineWidth = Math.max(1, s.w0 * .1);
      ctx.beginPath();
      for (let i = 0; i < R.length; i++) { const x = lerp(L[i][0], R[i][0], .9), y = lerp(L[i][1], R[i][1], .9); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    /* petioles of leaves (the first bit of every leaf segment) so they join the stem */
    for (const lf of plant.leaves) {
      const s = plant.segs[lf.seg];
      const p0 = plant.posOn(s, 0), p1 = plant.posOn(s, lf.petiole + .02);
      ctx.strokeStyle = '#6faa4f'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    for (const n of plant.nodes) {
      if (n.segs.length < 2 || n.id === 0) continue;
      if (!inView(n.x, n.y, 30)) continue;
      const s = plant.segs[n.segs.find(id => plant.segs[id].kind !== 'leaf') ?? n.segs[0]];
      const w = plant.posOn(s, s.a === n.id ? 0 : 1, false).w;
      ctx.fillStyle = 'rgba(90,150,70,.9)';
      ctx.beginPath(); ctx.arc(n.x + plant.sway(n.x, n.y), n.y, w * .52, 0, TAU); ctx.fill();
    }
    /* front leaves */
    for (const lf of plant.leaves) if (lf.z >= 0 && leafVisible(lf)) Sprites.drawLeafBlade(ctx, plant, lf, time, true);
    /* umbels and pods */
    const p = G.player;
    for (const f of plant.flowers) {
      const x = f.x + plant.sway(f.x, f.y);
      if (!inView(x, f.y, f.size * 3)) continue;
      const glow = p.stage === 7 && !p.readyFlag && f.nectar > .3 && (p.state === 'adult' || p.state === 'flying');
      Sprites.drawUmbel(ctx, f, x, f.y, time, glow, plant.type);
    }
    for (const pd of plant.pods) {
      const x = pd.x + plant.sway(pd.x, pd.y);
      if (!inView(x, pd.y, 60)) continue;
      if (!pd.burst && p.stage === 7 && (p.state === 'adult' || p.state === 'flying')) {
        const pulse = .5 + .5 * Math.sin(time * 4);
        ctx.globalAlpha = .3 + pulse * .3; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + pd.side * pd.size * .5, pd.y - 6, 22 + pulse * 4, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
      Sprites.drawPod(ctx, pd, x, pd.y, time);
    }
  }

  function drawPlantEntities(G, view, time) {
    const { plant, player, aphids, ants, wasp } = G;
    const inView = (x, y, pad) => x > view.l - pad && x < view.r + pad && y > view.t - pad && y < view.b + pad;

    /* shed skins (eaten a while after the molt) */
    for (let i = G.exuviae.length - 1; i >= 0; i--) {
      const e = G.exuviae[i];
      if (e.eatenAt && time > e.eatenAt + 2) { G.exuviae.splice(i, 1); continue; }
      const p = plant.posOn(e.seg, e.t);
      if (!inView(p.x, p.y, 60)) continue;
      ctx.save(); ctx.translate(p.x, p.y);
      if (e.dropped) { ctx.translate(0, 30 + Math.min(300, (time - e.born) * 120)); ctx.rotate((time - e.born) * 2); }
      else ctx.rotate(Math.atan2(p.ty * e.dir, p.tx * e.dir));
      let alpha = e.alpha === undefined ? .7 : e.alpha;
      if (e.eatenAt) alpha *= 1 - smoothstep(e.eatenAt, e.eatenAt + 2, time);
      if (e.dropped) alpha *= 1 - smoothstep(e.born + 1, e.born + 3, time);
      Sprites.drawCaterpillar(ctx, { s: e.s, instar: e.instar, walk: 0, chew: 0, pale: .9, alpha });
      ctx.restore();
    }
    /* the empty egg shell (its first meal, so it goes quickly) */
    for (let i = G.eggShells.length - 1; i >= 0; i--) {
      const e = G.eggShells[i];
      const k = 1 - smoothstep(e.born + 2, e.born + 8, time);
      if (k <= 0) { G.eggShells.splice(i, 1); continue; }
      const p = plant.posOn(e.seg, e.t);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty, p.tx)); ctx.translate(0, 4); ctx.globalAlpha = k * .8;
      Sprites.drawEgg(ctx, { s: 1.6 * lerp(.5, 1, k), crack: 1 });
      ctx.restore();
    }
    /* eggs you have laid (summer generations) */
    for (const e of G.eggs) {
      const p = plant.posOn(e.seg, e.t);
      if (!inView(p.x, p.y, 20)) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty, p.tx)); ctx.translate(0, 4);
      Sprites.drawEgg(ctx, { s: 1.4 });
      ctx.restore();
    }
    /* egg spots glow for a ready female */
    if (player.summer && player.readyFlag && player.variant.key === 'female' && (player.state === 'adult' || player.state === 'flying')) {
      for (const es of plant.eggSpots) {
        if (G.eggs.some(e => e.seg === es.seg)) continue;
        const x = es.x + plant.sway(es.x, es.y);
        if (!inView(x, es.y, 40)) continue;
        const near = player.eggSpotNear === es;
        const pulse = .5 + .5 * Math.sin(time * 4 + es.seg);
        ctx.globalAlpha = near ? .9 : .3 + pulse * .25;
        ctx.strokeStyle = near ? '#fff4a0' : '#ffe27a'; ctx.lineWidth = near ? 3 : 1.5;
        ctx.beginPath(); ctx.arc(x, es.y, (near ? 22 : 12) + pulse * 4, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    /* the mantis, on its leaf */
    if (G.mantis && G.mantis.enabled && inView(G.mantis.x, G.mantis.y, 60)) {
      const m = G.mantis;
      ctx.save(); ctx.translate(m.x, m.y - 2); ctx.rotate(m.ang); ctx.scale(1, m.side > 0 ? 1 : 1);
      Sprites.drawMantis(ctx, { s: 1.1, strike: m.strike, sway: m.sway });
      ctx.restore();
    }
    /* glowing hang spots when the caterpillar is full */
    if (player.readyFlag && player.state === 'larva') {
      for (const hs of plant.hangSpots) {
        const x = hs.x + plant.sway(hs.x, hs.y);
        if (!inView(x, hs.y, 40)) continue;
        const near = player.hangSpot === hs;
        const pulse = .5 + .5 * Math.sin(time * 4 + hs.seg);
        ctx.globalAlpha = near ? .9 : .35 + pulse * .25;
        ctx.strokeStyle = near ? '#fff4a0' : '#ffe27a'; ctx.lineWidth = near ? 3 : 1.5;
        ctx.beginPath(); ctx.arc(x, hs.y, (near ? 24 : 14) + pulse * 4, 0, TAU); ctx.stroke();
        if (near) { ctx.fillStyle = 'rgba(255,240,160,.25)'; ctx.beginPath(); ctx.arc(x, hs.y, 24 + pulse * 4, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    /* landing marker */
    if (player.state === 'flying') {
      const spot = player.flowerNear ? { x: player.flowerNear.x + plant.sway(player.flowerNear.x, player.flowerNear.y), y: player.flowerNear.y } : (player.landSpot ? plant.posOn(player.landSpot.seg, player.landSpot.t) : null);
      if (spot) {
        ctx.globalAlpha = .8; ctx.strokeStyle = player.flowerNear ? '#ffe27a' : '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(spot.x, spot.y, 14 + Math.sin(time * 8) * 3, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    /* aphids */
    for (const a of aphids.list) {
      if (!inView(a.x, a.y, 20)) continue;
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang);
      Sprites.drawAphid(ctx, { s: .7 + a.grow * .4, walk: a.state === 'walk' ? a.walk : 0 });
      ctx.restore();
    }
    if (ants.enabled) for (const a of ants.list) {
      if (!inView(a.x, a.y, 30)) continue;
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang);
      Sprites.drawAnt(ctx, { s: 1, walk: a.pause > 0 ? 0 : a.walk, bite: a.bite });
      ctx.restore();
    }
    /* the other monarch, in summer */
    if (G.mate) G.mate.draw(ctx, time);
    /* you */
    player.draw(ctx, time);
    /* the wasp, above everything */
    if (wasp && wasp.state !== 'idle') {
      ctx.save(); ctx.translate(wasp.x, wasp.y + 60); ctx.globalAlpha = .15; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 8, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(wasp.x, wasp.y); ctx.scale(wasp.side, 1);
      Sprites.drawWasp(ctx, { s: 1.4, phase: wasp.phase });
      ctx.restore();
    }
  }

  function drawLabelsMilkweed(G) {
    const { cam, player, plant, settings } = G;
    if (!settings.labels) return;
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
    const names = { egg: 'egg', larva: STAGES[player.stage].name.toLowerCase(), molting: 'molting', jhang: 'the J', pupating: 'pupating', chrysalis: 'chrysalis', eclosing: 'emerging', drying: 'drying wings', adult: 'monarch', flying: 'flying monarch', sipping: 'drinking nectar' };
    tag(player.x, player.y, `You · ${names[player.state] || player.state}`, -34 - 20 * player.scale(), '#ffe27a');
    const seen = new Set();
    for (const a of G.aphids.list) { if (seen.has(a.seg) || seen.size > 3) continue; seen.add(a.seg); tag(a.x, a.y, 'oleander aphids', -22); }
    for (const e of G.exuviae) { const p = plant.posOn(e.seg, e.t); tag(p.x, p.y, 'shed skin', -22, '#ddd'); }
    for (const f of plant.flowers) tag(f.x, f.y, 'milkweed flowers', -f.size - 10, '#f2c4dc');
    if (plant.pods[0]) tag(plant.pods[0].x, plant.pods[0].y, plant.pods[0].burst ? 'burst pod' : 'seed pod', -20, '#cfe8b0');
    if (G.mantis && G.mantis.enabled) tag(G.mantis.x, G.mantis.y, 'praying mantis', -40, '#ffb3a7');
    if (G.mate) tag(G.mate.x, G.mate.y, G.mate.variant.key === 'female' ? 'a female monarch' : 'a male monarch', -40, '#ffd9a0');
    tag(plant.flowers[0] ? plant.flowers[0].x : player.x, -plant.height - 60, plant.type.name, 0, '#cfe8b0');
    if (G.ants.enabled) for (const a of G.ants.list) tag(a.x, a.y, 'ant', -22, '#ffd0c0');
  }

  /* ============================================================
     THE ROUTE
     ============================================================ */
  function frameRoute(G, dt, night) {
    const { route, cam, player, tod, time } = G;
    const zm = zoneMix(route, cam.x);
    const storm = route.cloud;
    const horizonY = (0 - cam.y) * cam.zoom + H / 2;
    /* sky: zone colours, dimmed by night and storm */
    const [nTop, nBot] = skyColours(tod);
    const top = mixC(zoneCol(zm, 'sky', 0), nTop, Math.max(night, smoothstep(.15, .3, Math.abs(tod - .5) * 2) * .6));
    const bot = mixC(zoneCol(zm, 'sky', 1), nBot, Math.max(night, smoothstep(.15, .3, Math.abs(tod - .5) * 2) * .6));
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 10));
    sky.addColorStop(0, mixC(top, '#3a4050', storm * .7)); sky.addColorStop(1, mixC(bot, '#6a7080', storm * .7));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    drawStars(night, time);
    drawSunMoon(tod, night * (1 - storm), horizonY);
    drawClouds(cam, time, night, storm);

    /* far mountains / hills: two parallax layers coloured by zone */
    const farCol = zoneCol(zm, 'far');
    const isForest = zm.a.key === 'forest' || zm.b.key === 'forest';
    for (let i = 2; i >= 0; i--) {
      const par = .05 + i * .06;
      const col = mixC(mixC(farCol, '#ffffff', (2 - i) * .18), '#1b2a3c', night * .8);
      ctx.fillStyle = mixC(col, '#3a4050', storm * .4);
      ctx.beginPath(); ctx.moveTo(0, H);
      const mountain = zm.a.key === 'mexico' || isForest ? 1 + zm.t : (zm.a.key === 'plains' && zm.b.key === 'mexico' ? zm.t : 0);
      const amp = (40 + i * 30) * (1 + mountain * 1.3), yb = horizonY - 50 - i * 50 - mountain * 90;
      for (let x = 0; x <= W; x += 16) {
        const wx = x + cam.x * par;
        const n = hillNoise(wx * .004 + i * 40) * 2 - 1, n2 = hillNoise2(wx * .012 + i * 9) * 2 - 1;
        ctx.lineTo(x, yb + n * amp + n2 * amp * .3 * (1 + mountain));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = (1 - night * .6) * (1 - storm * .5);
    ctx.drawImage(bokeh, -W * .3 - cam.x * .02, -H * .1 - cam.y * .05);
    ctx.globalAlpha = 1;

    ctx.save();
    cam.apply(ctx);
    const view = cam.viewRect(160);
    drawRouteGround(G, view, zm, night);
    drawRouteThings(G, view, time, night);
    G.particles.draw(ctx, cam);
    ctx.restore();

    /* rain and wind, spawned into the particle system */
    if (route.rain > .05) G.particles.rain(view, Math.round(route.rain * 22), route.wind(player.x, -300).x);
    const w = route.wind(player.x, player.y);
    if (Math.abs(w.x) > 60 && chance(dt * Math.abs(w.x) * .06)) G.particles.streak(view, w.x, rnd(view.t, -60));
    if (zm.a.key === 'north' && chance(dt * 2)) G.particles.leaf(view, w.x);

    lighting(G, night, tod, storm);
    ctx.save(); cam.apply(ctx);
    if (isForest) drawMist(view, time);
    G.particles.ensureAmbient(40, view);
    G.particles.drawAmbient(ctx, view, time, night, dt, w.x);
    ctx.restore();
    vignette(night, Math.max(route.inStorm(player.x) ? .6 : 0, G.bird ? G.bird.danger() * .8 : 0));
    drawRouteOverlay(G, zm);
  }

  function drawRouteGround(G, view, zm, night) {
    const { route, time, cam } = G;
    const gcol = zoneCol(zm, 'ground');
    /* the ground strip */
    const g = ctx.createLinearGradient(0, -6, 0, 400);
    g.addColorStop(0, shade(rgbToHexish(gcol), 1.05)); g.addColorStop(.3, gcol); g.addColorStop(1, mixC(gcol, '#2c1d12', .6));
    ctx.fillStyle = g;
    ctx.fillRect(view.l, -4, view.r - view.l, Math.max(0, view.b + 4));
    /* mid hills with a little parallax, in the ground colour */
    ctx.fillStyle = mixC(gcol, zoneCol(zm, 'far'), .5);
    ctx.beginPath(); ctx.moveTo(view.l, 0);
    for (let x = view.l; x <= view.r; x += 24) { const wx = x * .7 + cam.x * .3; ctx.lineTo(x, -70 - (hillNoise(wx * .003) * 2 - 1) * 50 - (hillNoise2(wx * .01) * 2 - 1) * 14); }
    ctx.lineTo(view.r, 0); ctx.closePath(); ctx.fill();
    /* fields: stripes in the farm belt */
    if (zm.a.key === 'farm' || zm.b.key === 'farm') {
      ctx.globalAlpha = .18 * (zm.a.key === 'farm' ? 1 - zm.t : zm.t);
      for (let x = Math.floor(view.l / 60) * 60; x < view.r; x += 60) { ctx.fillStyle = (x / 60) % 2 ? '#7a6a2a' : '#c9b85a'; ctx.fillRect(x, 0, 60, 300); }
      ctx.globalAlpha = 1;
    }
    /* the lake */
    if (route.lake) {
      const { x0, x1 } = route.lake;
      if (x1 > view.l && x0 < view.r) {
        const wg = ctx.createLinearGradient(0, -8, 0, 300);
        wg.addColorStop(0, mixHex('#6fb4e8', '#1b2a3c', night * .7)); wg.addColorStop(1, mixHex('#2a5a8a', '#0a1020', night * .7));
        ctx.fillStyle = wg;
        ctx.fillRect(Math.max(x0, view.l - 10), -8, Math.min(x1, view.r + 10) - Math.max(x0, view.l - 10), 320);
        /* shorelines */
        ctx.fillStyle = '#e8d9a8'; ctx.fillRect(x0 - 120, -4, 120, 30); ctx.fillRect(x1, -4, 120, 30);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
        for (let x = Math.max(x0, view.l); x < Math.min(x1, view.r); x += 90) {
          const ph = time * 1.5 + x * .01;
          ctx.beginPath(); ctx.moveTo(x + Math.sin(ph) * 10, 6 + Math.cos(ph) * 3); ctx.quadraticCurveTo(x + 20, 2 + Math.sin(ph * 1.3) * 3, x + 40 + Math.sin(ph) * 10, 6); ctx.stroke();
        }
        /* far shore */
        ctx.fillStyle = mixHex('#6f9e6a', '#1b2a3c', night * .7);
        ctx.beginPath(); ctx.moveTo(x0, -8); for (let x = x0; x <= x1; x += 40) ctx.lineTo(x, -8 - 10 - hillNoise(x * .002) * 14); ctx.lineTo(x1, -8); ctx.closePath(); ctx.fill();
      }
    }
    /* grass tufts in green zones */
    if (zm.a.key === 'north' || zm.a.key === 'forest' || zm.a.key === 'farm') {
      ctx.strokeStyle = mixC(gcol, '#2f6a2a', .5); ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let x = Math.floor(view.l / 26) * 26; x < view.r; x += 26) {
        if (route.overWater(x)) continue;
        const h = 14 + hillNoise(x * .3) * 16, sw = Math.sin(time * 1.6 + x * .05) * 4;
        ctx.beginPath(); ctx.moveTo(x, 2); ctx.quadraticCurveTo(x + sw * .4, -h * .5, x + sw, -h); ctx.stroke();
      }
    }
  }
  function rgbToHexish(c) { const m = rgbOf(c); return '#' + m.map(v => (v | 0).toString(16).padStart(2, '0')).join(''); }

  function drawRouteThings(G, view, time, night) {
    const { route, player } = G;
    const inX = (x, pad) => x > view.l - pad && x < view.r + pad;
    /* thermals: shimmer columns with hawks */
    for (const t of route.thermals) {
      if (!inX(t.x, t.r + 100)) continue;
      const g = ctx.createLinearGradient(t.x - t.r, 0, t.x + t.r, 0);
      g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(.5, 'rgba(255,240,200,.16)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g; ctx.fillRect(t.x - t.r, t.top, t.r * 2, -t.top - 40);
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const ph = time * 1.2 + i * 1.1, yy = -60 - ((time * 60 + i * 130) % (-t.top - 80));
        ctx.beginPath(); ctx.moveTo(t.x - 30 + Math.sin(ph) * 20, yy); ctx.quadraticCurveTo(t.x + Math.cos(ph) * 25, yy - 12, t.x + 30 + Math.sin(ph + 1) * 20, yy - 24); ctx.stroke();
      }
      for (let h = 0; h < t.hawks; h++) {
        const a = time * .5 + h * 2.1;
        Sprites.drawHawk(ctx, t.x + Math.cos(a) * t.r * .5, -560 - h * 90 + Math.sin(a) * 40, .9, a + Math.PI / 2);
      }
    }
    /* props */
    for (const p of route.props) if (inX(p.x, 260)) Sprites.drawProp(ctx, p, p.x, 0, time);
    /* nectar patches */
    for (const n of route.nectar) {
      if (!inX(n.x, 200)) continue;
      const glow = n.nectar > .2 && player.state === 'migrating' && (player.energy < .7 || dist(player.x, player.y, n.x, n.y) < 400);
      ctx.globalAlpha = .5 + .5 * n.nectar;
      Sprites.drawNectarPatch(ctx, n, n.x, 0, time, glow);
      ctx.globalAlpha = 1;
    }
    /* trees */
    for (const t of route.trees) {
      if (!inX(t.x, t.h)) continue;
      Sprites.drawTree(ctx, t, t.x, 0, time, { gust: route.gust });
      const glowTree = (player.state === 'migrating' || player.state === 'winterFly') && ((night > .3 || (route.storm && route.storm.warned) || t.fir) && dist(player.x, player.y, t.x, t.landY) < 700);
      if (glowTree) {
        const pulse = .5 + .5 * Math.sin(time * 4 + t.seed);
        ctx.globalAlpha = .3 + pulse * .3; ctx.strokeStyle = t.fir ? '#ffd27a' : '#fff4a0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(t.x, t.landY, 30 + pulse * 6, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    /* the storm: a dark band of cloud low over the ground */
    if (route.storm) {
      const s = route.storm;
      if (inX(s.x, s.w)) {
        const g = ctx.createLinearGradient(s.x - s.w / 2, 0, s.x + s.w / 2, 0);
        g.addColorStop(0, 'rgba(40,45,60,0)'); g.addColorStop(.3, 'rgba(40,45,60,.75)'); g.addColorStop(.7, 'rgba(40,45,60,.75)'); g.addColorStop(1, 'rgba(40,45,60,0)');
        ctx.fillStyle = g; ctx.fillRect(s.x - s.w / 2, view.t, s.w, -view.t - 640);
        for (let i = 0; i < 9; i++) {
          const cx = s.x + Math.sin(i * 2.3 + time * .2) * s.w * .35 + (i - 4) * s.w * .1, cy = -720 + Math.cos(i * 1.7) * 60;
          const rg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 180);
          rg.addColorStop(0, 'rgba(60,65,80,.9)'); rg.addColorStop(1, 'rgba(60,65,80,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, 180, 0, TAU); ctx.fill();
        }
        if (chance(.01)) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(view.l, view.t, view.r - view.l, view.b - view.t); }
      }
    }
    /* the flock */
    for (const f of route.flock) {
      if (!inX(f.x, 60)) continue;
      const flap = player.state === 'migrating' || player.state === 'winterFly' ? .3 + .7 * Math.abs(Math.cos(time * 12 + f.ph)) : .15;
      Sprites.drawMonarchTiny(ctx, f.x, f.y, f.s, flap, f.ang);
    }
    /* the tagging volunteer */
    if (player.state === 'tagging') {
      const k = player.timer;
      const swing = k < 1.6 ? smoothstep(.8, 1.6, k) : (k < 2.6 ? 1 : 1 - smoothstep(2.6, 3.4, k));
      ctx.save(); ctx.translate(player.x + 95, 0); ctx.scale(-1, 1);
      Sprites.drawVolunteer(ctx, { s: 1.15, swing, time });
      ctx.restore();
    }
    /* player 2 */
    if (G.players && G.players[1]) {
      const p2 = G.players[1];
      p2.draw(ctx, time);
      ctx.save(); ctx.translate(p2.x, p2.y - 48);
      ctx.font = `900 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(20,30,20,.7)'; rr(ctx, -12, -10, 24, 20, 10); ctx.fill(); ctx.fillStyle = '#9ad8ff'; ctx.fillText('P2', 0, 0);
      ctx.restore();
    }
    /* the bird */
    if (G.bird && G.bird.state !== 'idle') {
      const b = G.bird;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy * .3, Math.abs(b.vx) || 1)); if (b.vx < 0) ctx.scale(-1, 1);
      Sprites.drawBird(ctx, { s: 1.5, phase: b.phase, kind: b.kind });
      ctx.restore();
    }
    /* landing marker */
    if ((player.state === 'migrating' || player.state === 'winterFly') && player.landing) {
      const l = player.landing;
      const x = l.type === 'nectar' ? l.patch.x : l.type === 'ground' ? player.x : l.tree.x;
      const y = l.type === 'nectar' ? l.patch.y : l.type === 'ground' ? -20 : l.tree.landY;
      ctx.globalAlpha = .85; ctx.strokeStyle = l.type === 'nectar' ? '#ffe27a' : '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 18 + Math.sin(time * 8) * 4, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    player.draw(ctx, time);
  }

  function drawMist(view, time) {
    for (let i = 0; i < 5; i++) {
      const y = -120 - i * 150, x = view.l + ((time * (8 + i * 3)) % (view.r - view.l));
      const g = ctx.createRadialGradient(x, y, 20, x, y, 420);
      g.addColorStop(0, 'rgba(220,235,245,.18)'); g.addColorStop(1, 'rgba(220,235,245,0)');
      ctx.fillStyle = g; ctx.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);
    }
  }

  /* Screen-space: wind arrow, mile progress, labels. */
  function drawRouteOverlay(G, zm) {
    const { route, player, cam, settings } = G;
    /* wind arrow, bottom left */
    const w = route.wind(player.x, player.y);
    const ax = 70, ay = H - (document.body.classList.contains('pad-on') ? 190 : 70);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.fillStyle = 'rgba(255,252,240,.8)';
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    const k = clamp(Math.abs(w.x) / 260, 0, 1);
    ctx.strokeStyle = w.x >= 0 ? '#4f9a3a' : '#e0392f'; ctx.lineWidth = 4 + k * 4; ctx.lineCap = 'round';
    const len = 10 + k * 16, dir = w.x >= 0 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(-len * dir, 0); ctx.lineTo(len * dir, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len * dir, 0); ctx.lineTo((len - 8) * dir, -7); ctx.moveTo(len * dir, 0); ctx.lineTo((len - 8) * dir, 7); ctx.stroke();
    if (w.y < -30) { ctx.strokeStyle = '#f39a2b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, -16); ctx.moveTo(0, -16); ctx.lineTo(-5, -10); ctx.moveTo(0, -16); ctx.lineTo(5, -10); ctx.stroke(); }
    ctx.font = `800 10px ${UI_FONT}`; ctx.fillStyle = '#23301f'; ctx.textAlign = 'center';
    ctx.fillText(w.x >= 0 ? 'TAILWIND' : 'HEADWIND', 0, 46);
    if (settings.difficulty === 'hard' || settings.science) {
      ctx.font = `800 11px ${UI_FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      const mph = Math.round(Math.abs(w.x) / 260 * 25), ft = Math.max(0, Math.round(-player.y * 3.2)), lift = Math.round(-w.y / 60 * 3);
      const lines = [`wind ${mph} mph`, `altitude ${fmtInt(ft)} ft`, lift > 0 ? `lift +${lift} ft/s` : `sink ${Math.round(player.vy / 60 * 3)} ft/s`, `energy ${Math.round(player.energy * 100)}%`];
      lines.forEach((l, i) => { ctx.fillStyle = 'rgba(20,30,20,.6)'; rr(ctx, 44, -34 + i * 18, ctx.measureText(l).width + 12, 16, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(l, 50, -26 + i * 18); });
    }
    ctx.restore();

    if (!settings.labels) return;
    ctx.font = `700 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (wx, wy, text, dy = -30, col = '#fff') => {
      const [sx, sy] = cam.toScreen(wx, wy);
      if (sx < -50 || sx > W + 50 || sy < 0 || sy > H) return;
      const ww = ctx.measureText(text).width + 16;
      ctx.fillStyle = 'rgba(20,30,20,.7)'; rr(ctx, sx - ww / 2, sy + dy - 11, ww, 22, 11); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(text, sx, sy + dy);
    };
    tag(player.x, player.y, 'You' + (player.tag ? ' · tagged' : ''), -50, '#ffe27a');
    if (G.bird && G.bird.state !== 'idle') tag(G.bird.x, G.bird.y, { oriole: 'black-backed oriole', grosbeak: 'black-headed grosbeak', kingbird: 'kingbird' }[G.bird.kind], -30, '#ffb3a7');
    for (const n of route.nectar) if (Math.abs(n.x - player.x) < 1400) tag(n.x, n.y, NECTAR_PLANTS[n.kind].name, -40, '#ffe9a0');
    for (const t of route.trees) if (Math.abs(t.x - player.x) < 1400) tag(t.x, -t.h, (t.fir ? 'oyamel fir' : t.kind) + (t.roost > 0 ? ' · roost' : ''), -14, '#cfe8b0');
    for (const t of route.thermals) if (Math.abs(t.x - player.x) < 1400) tag(t.x, -700, 'thermal', 0, '#fff2c0');
    if (route.storm && Math.abs(route.storm.x - player.x) < 2000) tag(route.storm.x, -600, 'storm', 0, '#cfe3ff');
    if (route.lake && player.x > route.lake.x0 - 1400 && player.x < route.lake.x1 + 200) tag((Math.max(route.lake.x0, player.x - 400) + Math.min(route.lake.x1, player.x + 400)) / 2, -20, 'Lake Erie', -30, '#bfe0ff');
  }

  return { init, resize, frame, nightAmount, skyColours, zoneMix };
})();
