/* ============================================================
   render.js — composing the pond
   ============================================================
   Layers, back to front:
     sky (time of day, overcast) → stars, sun, moon, clouds,
     rainbow → far hills and trees (parallax) → ground: banks and
     bed in one cross-section → back reeds, the log → the water
     body (clipped): light rays, caustics, weeds, rocks, algae,
     snails, nymphs, minnows, wrigglers, eggs, tadpoles, depth fog
     → reflections, the surface line → lily pads, front reeds,
     chorus frogs, bugs, heron, frogs in the air / on perches →
     ice → rain / snow / particles → lighting, fireflies, vignette,
     danger pulse, labels, arrows, letterbox
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1;
  let farImg = null, waterLayer = null, wctx = null;
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
  const stars = [], clouds = [], grass = [], pebbles = [], roots = [], cracks = [];
  let builtFor = -1;
  let quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  let underView = 0;

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    for (let i = 0; i < 140; i++) stars.push([Math.random(), Math.random() * .7, Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 9; i++) clouds.push(makeCloud(i));
  }
  function resize(w, h, dpr) {
    W = w; H = h; DPR = quality === 'low' ? 1 : dpr;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    farImg = null;
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
  function makeCloud(i) {
    const c = document.createElement('canvas');
    const w = 560, h = 320; c.width = w; c.height = h;
    const g = c.getContext('2d');
    const n = 7 + (Math.random() * 5 | 0);
    for (let k = 0; k < n; k++) {
      const x = 120 + Math.random() * (w - 240), y = 130 + Math.random() * 60, r = 40 + Math.random() * 55;
      const rg = g.createRadialGradient(x, y, r * .1, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(.6, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return { img: c, x: Math.random(), y: .04 + Math.random() * .22, s: .6 + Math.random() * .9, sp: 4 + Math.random() * 8, a: .5 + Math.random() * .5 };
  }
  function buildGround(pond) {
    grass.length = 0; pebbles.length = 0; roots.length = 0; cracks.length = 0;
    const rng = mulberry32(pond.seed ^ 0x5151);
    const b = pond.bounds;
    for (let x = b.left - 200; x < b.right + 200; x += 9) {
      if (Math.abs(x) < pond.W - 40) continue;
      grass.push({ x: x + rng() * 8, h: 14 + rng() * 34, lean: (rng() - .5) * .9, w: 1.8 + rng() * 2, c: (rng() * 4) | 0, ph: rng() * TAU });
    }
    for (let i = 0; i < 160; i++) { const x = lerp(b.left, b.right, rng()); pebbles.push({ x, dy: 6 + rng() * 120, r: 2 + rng() * 6, k: rng() }); }
    for (let i = 0; i < 24; i++) { const x = lerp(b.left, b.right, rng()); if (Math.abs(x) < pond.W + 20) continue; roots.push({ x, len: 40 + rng() * 90, sway: (rng() - .5) * 60, w: 2 + rng() * 3 }); }
    for (let i = 0; i < 14; i++) { const x = lerp(-pond.W, pond.W, rng()); const pts = [[x, 0]]; let cx = x, cy = 0; for (let k = 0; k < 5; k++) { cx += (rng() - .5) * 140; cy += (rng() - .5) * 6; pts.push([cx, cy]); } cracks.push(pts); }
  }
  function buildFar() {
    farImg = document.createElement('canvas');
    farImg.width = Math.round(W * 2); farImg.height = Math.round(H * .6);
    const g = farImg.getContext('2d');
    const rng = mulberry32(77);
    const base = farImg.height;
    /* hills */
    for (const [k, col, amp] of [[0, '#8fb9a8', .45], [1, '#6f9a86', .32], [2, '#4f7a66', .22]]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, base);
      for (let x = 0; x <= farImg.width; x += 24) { const n = Math.sin(x * .0025 + k * 2) * .5 + Math.sin(x * .0071 + k) * .3 + Math.sin(x * .017 + k * 5) * .15; g.lineTo(x, base - base * amp * (.55 + .45 * n)); }
      g.lineTo(farImg.width, base); g.closePath(); g.fill();
    }
    /* treeline */
    if (quality !== 'low') g.filter = 'blur(2px)';
    for (let i = 0; i < 90; i++) {
      const x = rng() * farImg.width, h = base * (0.12 + rng() * .2), w = h * (0.35 + rng() * .3);
      g.fillStyle = mixHex('#2f5a44', '#5a8a62', rng(), .9);
      g.beginPath(); g.moveTo(x - w, base); g.quadraticCurveTo(x - w * .6, base - h * .6, x, base - h); g.quadraticCurveTo(x + w * .6, base - h * .6, x + w, base); g.closePath(); g.fill();
    }
    g.filter = 'none';
  }

  /* ---------- the frame ---------- */
  function frame(G, dt) {
    const g = G.pond, cam = G.cam, tod = G.tod;
    const night = nightAmount(tod); G.night = night;
    /* fps & auto quality, decided at frame start */
    if (dt > 0) { fpsAcc += dt; fpsN++; if (fpsAcc > .5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; } }
    if (G.settings.quality === 'auto') { if (fps < 40) lowFor += dt; else lowFor = 0; if (lowFor > 3 && quality !== 'low') setQuality('low'); }
    if (builtFor !== g.seed) { builtFor = g.seed; buildGround(g); }
    if (!farImg) buildFar();
    const wx = g.weather;
    const ice = wx.ice;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawSky(G, tod, night);
    /* far hills, parallax, anchored to the bank height */
    {
      const hy = cam.toScreen(0, 6 + g.level)[1];
      const scaleK = Math.pow(cam.zoom, .35);
      const ih = farImg.height * scaleK * .9, iw = farImg.width * scaleK;
      const ox = -((cam.x * .12 * scaleK) % iw);
      ctx.globalAlpha = 1 - night * .35;
      const k0 = Math.floor((-ox) / iw) - 1;
      for (let k = k0; k <= k0 + 3; k++) {
        const x = ox + k * iw;
        if (x > W || x + iw < 0) continue;
        if (((k % 2) + 2) % 2 === 0) ctx.drawImage(farImg, x, hy - ih + 6, iw, ih);
        else { ctx.save(); ctx.translate(x + iw, 0); ctx.scale(-1, 1); ctx.drawImage(farImg, 0, hy - ih + 6, iw, ih); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    cam.apply(ctx);
    const view = cam.viewRect(240);
    const time = G.time;

    /* ---- ground: banks and bed in one cross-section ---- */
    drawGround(G, view);
    drawPlaceBack(G, view, time);
    /* back reeds */
    for (const r of g.reeds) { if (!r.back || r.x < view.l || r.x > view.r) continue; ctx.save(); ctx.translate(r.x, r.base); ctx.globalAlpha = .75; Sprites.drawReed(ctx, r, time, wx.wind + wx.gust, g.season); ctx.restore(); }
    ctx.globalAlpha = 1;
    drawLog(G);
    /* frogs sitting on the bank behind the water line */
    drawChorus(G, view, 'bank');

    /* ---- water ---- */
    const surfacePath = () => {
      ctx.beginPath();
      const l = Math.max(-g.W, view.l), r = Math.min(g.W, view.r);
      ctx.moveTo(l, g.surfaceAt(l));
      for (let x = l + 8; x < r; x += 8) ctx.lineTo(x, g.surfaceAt(x));
      ctx.lineTo(r, g.surfaceAt(r));
      for (let x = r; x >= l; x -= 16) ctx.lineTo(x, g.bedY(x) + 2);
      ctx.lineTo(l, g.bedY(l) + 2);
      ctx.closePath();
    };
    if (view.r > -g.W && view.l < g.W) {
      surfacePath();
      const day = 1 - night;
      const cold = ice * .8 + (g.season === 'winter' ? .2 : 0);
      const top = mixHex(mixHex(g.place.water[0], '#1c2a4a', night), '#9fc4d4', cold * .5);
      const deep = mixHex(mixHex(g.place.water[1], '#06121e', night), '#1a3040', cold * .4);
      const wg = ctx.createLinearGradient(0, -20, 0, 600);
      wg.addColorStop(0, withAlpha(top, .78)); wg.addColorStop(.35, withAlpha(mixHex(top, deep, .5), .84)); wg.addColorStop(1, withAlpha(deep, .92));
      ctx.fillStyle = wg; ctx.fill();
      /* on high quality the underwater world is drawn to its own layer and copied back in
         wobbling strips, so everything below the surface refracts */
      const useLayer = quality !== 'low';
      const mainCtx = ctx;
      if (useLayer) {
        if (!waterLayer || waterLayer.width !== canvas.width || waterLayer.height !== canvas.height) { waterLayer = document.createElement('canvas'); waterLayer.width = canvas.width; waterLayer.height = canvas.height; wctx = waterLayer.getContext('2d'); }
        wctx.setTransform(1, 0, 0, 1, 0, 0); wctx.clearRect(0, 0, waterLayer.width, waterLayer.height);
        wctx.setTransform(DPR, 0, 0, DPR, 0, 0); cam.apply(wctx);
        ctx = wctx;
      }
      surfacePath();
      ctx.save(); ctx.clip();
      /* light rays */
      if (quality !== 'low' && day > .05 && ice < .5) {
        ctx.globalAlpha = .07 * day * (1 - wx.cloud * .7);
        ctx.fillStyle = '#eaffff';
        for (let i = 0; i < 7; i++) {
          const x = view.l + ((i * 431 + time * 9) % (view.r - view.l));
          const sw = Math.sin(time * .3 + i) * 40;
          ctx.beginPath(); ctx.moveTo(x - 18, -10); ctx.lineTo(x + 18, -10); ctx.lineTo(x + 80 + sw, 520); ctx.lineTo(x - 30 + sw, 520); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      /* caustics on the bed */
      if (quality !== 'low' && day > .05 && ice < .5) {
        ctx.strokeStyle = `rgba(230,255,240,${.14 * day})`; ctx.lineWidth = 2;
        const l = Math.max(-g.W + 10, view.l), r = Math.min(g.W - 10, view.r);
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          for (let x = l; x <= r; x += 10) { const y = g.bedY(x) - 4 - Math.abs(Math.sin(x * .05 + time * 1.3 + k * 2) * Math.sin(x * .013 - time * .7)) * 8; x === l ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
          ctx.stroke();
        }
      }
      /* the stream's current: streaks sliding downstream */
      if (g.place.current && ice < .5) {
        ctx.strokeStyle = `rgba(235,255,250,${.26 * (1 - night * .6)})`; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        const span = 2 * g.W, n = 70;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = -g.W + ((i * 337.7 + time * g.place.current) % span), y = 14 + ((i * 53.3) % Math.max(20, g.maxDepth - 30));
          if (x < view.l || x > view.r || y > g.bedY(x) - 10) continue;
          const len = 22 * (g.currentAt(x, y) / g.place.current);
          if (len < 3) continue;
          ctx.moveTo(x, y); ctx.lineTo(x + len, y + Math.sin(x * .02 + time) * 2);
        }
        ctx.stroke();
      }
      /* underwater life */
      if (G.heron && G.heron.active && G.heron.pose() !== 'fly') drawHeron(G);      // legs tinted by the water
      drawUnderwater(G, view, time);
      /* light dancing on the players' skin */
      if (quality !== 'low' && day > .05 && ice < .5) {
        for (const p of G.players) {
          if (!(p.inWater() || p.isTadpole()) || p.state === 'egg') continue;
          const s = p.scale();
          ctx.save(); ctx.beginPath(); ctx.ellipse(p.x, p.y, 26 * s, 13 * s, p.isTadpole() ? p.ang : 0, 0, TAU); ctx.clip();
          ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(200,240,220,${.22 * day})`; ctx.lineWidth = 2.5 * s;
          for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = p.x - 40 * s; x <= p.x + 40 * s; x += 6) { const y = p.y - 30 * s + k * 22 * s + Math.sin(x * .09 + time * 2.2 + k) * 6 * s; x === p.x - 40 * s ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
          ctx.restore();
        }
      }
      /* depth fog */
      const fog = ctx.createLinearGradient(0, 0, 0, 600);
      fog.addColorStop(0, 'rgba(10,40,50,0)'); fog.addColorStop(1, `rgba(6,26,36,${.5 + night * .25})`);
      ctx.fillStyle = fog; ctx.fillRect(view.l, -20, view.r - view.l, 700);
      if (quality !== 'low') G.particles.drawMotes(ctx, { l: Math.max(view.l, -g.W), r: Math.min(view.r, g.W), t: view.t, b: view.b }, time, dt, g);
      ctx.restore();
      if (useLayer) {
        ctx = mainCtx;
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        const strip = Math.max(4, Math.round(5 * DPR)), lw = waterLayer.width, lh = waterLayer.height;
        const amp = (1 - ice) * (1 + wx.rain * .6);
        for (let y = 0; y < lh; y += strip) {
          const wy = y / DPR;
          const dx = (Math.sin(wy * .021 + time * 1.7) * 2.2 + Math.sin(wy * .057 - time * 2.6) * 1.3) * DPR * amp;
          ctx.drawImage(waterLayer, 0, y, lw, strip, dx, y, lw, strip);
        }
        ctx.restore();
      }
      /* the part of a floating body that is out of the water: crisp, above the surface */
      {
        ctx.save();
        ctx.beginPath();
        const l = Math.max(-g.W, view.l), r = Math.min(g.W, view.r);
        ctx.moveTo(l, view.t - 100); ctx.lineTo(l, g.surfaceAt(l));
        for (let x = l + 8; x < r; x += 8) ctx.lineTo(x, g.surfaceAt(x));
        ctx.lineTo(r, g.surfaceAt(r)); ctx.lineTo(r, view.t - 100); ctx.closePath(); ctx.clip();
        for (const p of G.players) if (p.isFrogLike() && p.mode === 'water' && p.state !== 'hibernating') drawPlayer(G, p, time);
        if (G.heron && G.heron.active && G.heron.pose() !== 'fly') drawHeron(G);
        ctx.restore();
        /* meniscus: a bright rim where the body breaks the surface */
        for (const p of G.players) {
          if (!(p.isFrogLike() && p.mode === 'water')) continue;
          const s = p.scale(), surf = g.surfaceAt(p.x), d = Math.abs(p.y - surf);
          if (d > 16 * s) continue;
          ctx.save(); ctx.globalAlpha = (1 - d / (16 * s)) * .7; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(p.x, surf, 26 * s, 5 * s, 0, 0, TAU); ctx.stroke(); ctx.restore();
        }
      }
      /* reflections of the reeds, upside down, wobbled by the wave */
      if (quality !== 'low' && ice < .5) {
        ctx.save(); surfacePath(); ctx.clip();
        ctx.globalAlpha = .18 + (1 - night) * .06;
        for (const r of g.reeds) {
          if (r.x < view.l || r.x > view.r || r.kind === 'grass') continue;
          const s = g.surfaceAt(r.x);
          ctx.save(); ctx.translate(r.x + g.surfaceSlope(r.x) * 30, s + (s - r.base) * .02); ctx.scale(1, -.85); ctx.translate(0, -(r.base - s) * 0);
          Sprites.drawReed(ctx, r, time, wx.wind + wx.gust, g.season);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      /* the surface line */
      if (ice < .95) {
        const l = Math.max(-g.W, view.l), r = Math.min(g.W, view.r);
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(200,240,255,${.22 * (1 - ice)})`; ctx.lineWidth = 7;
        ctx.beginPath(); for (let x = l; x <= r; x += 8) { const y = g.surfaceAt(x); x === l ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.55 * (1 - ice)})`; ctx.lineWidth = 2; ctx.stroke();
        /* glitter */
        if (quality !== 'low') {
          ctx.fillStyle = night > .5 ? 'rgba(255,255,230,.8)' : 'rgba(255,255,255,.9)';
          for (let x = l; x <= r; x += 26) {
            const slope = g.surfaceSlope(x);
            const k = Math.max(0, Math.sin(x * .21 + time * 2.1) * .5 + .5 - .6 + slope * 6);
            if (k <= 0) continue;
            ctx.globalAlpha = Math.min(1, k) * .8; ctx.beginPath(); ctx.arc(x + 4, g.surfaceAt(x) - 1, 1.3, 0, TAU); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    /* ---- above the water ---- */
    drawEggMasses(G, view, time, false);
    for (const p of g.pads) drawPad(G, p, time);
    drawNeighboursOver(G, view, time);
    for (const p of G.players) if (p.mode === 'perch' && p.perch && p.perch.kind !== 'land' && p.state !== 'hibernating') drawPlayer(G, p, time);
    for (const r of g.reeds) { if (r.back || r.x < view.l || r.x > view.r) continue; ctx.save(); ctx.translate(r.x, r.base); Sprites.drawReed(ctx, r, time, wx.wind + wx.gust, g.season); ctx.restore(); }
    drawSpots(G, time);
    drawChorus(G, view, 'front');
    drawHazardsOver(G);
    drawPlaceFront(G, view, time);
    for (const p of G.players) if (!p.inWater() && !(p.mode === 'perch' && p.perch && p.perch.kind !== 'land') && !p.isTadpole() && p.state !== 'egg') drawPlayer(G, p, time);
    drawBugs(G, view, time);
    if (G.heron && G.heron.active && G.heron.pose() === 'fly') drawHeron(G);
    /* ice */
    if (ice > .02) drawIce(G, view, time);
    /* weather in world space */
    if (wx.rain > .02) drawRain(G, view, time);
    G.particles.draw(ctx, cam);
    for (const p of G.players) drawTargetRing(G, p, time);
    /* morning mist in spring and autumn */
    {
      const mist = (g.season === 'spring' || g.season === 'autumn' ? 1 : .3) * Math.max(0, 1 - Math.abs(tod - .3) / .07) * (1 - wx.rain) * .45;
      if (mist > .01) { const mg = ctx.createLinearGradient(0, -110, 0, 40); mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(.6, `rgba(255,255,255,${mist})`); mg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = mg; ctx.fillRect(view.l, -110, view.r - view.l, 150); }
    }
    /* fireflies / pollen above the water */
    if (quality !== 'low') { G.particles.ensureAmbient(70, { l: view.l, r: view.r, t: view.t, b: -6 }); G.particles.drawAmbient(ctx, { l: view.l, r: view.r, t: view.t, b: -6 }, time, night, dt, g); }
    ctx.restore();

    /* ---- screen space: lighting ---- */
    if (night > .01) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(40,60,120,${night * .72})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    const warm = Math.max(0, 1 - Math.abs(tod - .25) / .06) + Math.max(0, 1 - Math.abs(tod - .8) / .07);
    if (warm > 0) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,150,60,${warm * .6})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,120,40,${warm * .08})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (wx.cloud > .3) { ctx.fillStyle = `rgba(120,130,150,${wx.cloud * .12})`; ctx.fillRect(0, 0, W, H); }
    /* underwater camera tint */
    const surfScreen = cam.toScreen(cam.x, g.surfaceAt(cam.x))[1];
    underView = clamp(1 - surfScreen / H, 0, 1);
    if (underView > 0 && Math.abs(cam.x) < g.W + 300) { ctx.fillStyle = `rgba(20,90,110,${underView * .13})`; ctx.fillRect(0, Math.max(0, surfScreen), W, H); }
    /* vignette */
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,10,20,.42)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    const danger = (G.heron && G.heron.state === 'warning') || (G.hazards && (G.hazards.snake.state === 'coil' || G.hazards.fish.state === 'hunt' || (G.hazards.raccoon.state === 'pat' && G.hazards.raccoon.warned)));
    if (danger) { const k = .5 + .5 * Math.sin(time * 10); const rg = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .9); rg.addColorStop(0, 'rgba(255,40,20,0)'); rg.addColorStop(1, `rgba(255,40,20,${.35 * k})`); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); }
    drawOverlays(G);
    if (typeof Rhythm !== 'undefined') Rhythm.draw(ctx, W, H);
    /* travelling: fade through black with the place's name */
    if (G.fade > .01) {
      ctx.fillStyle = `rgba(4,10,12,${G.fade})`; ctx.fillRect(0, 0, W, H);
      if (G.fadeTitle) { ctx.globalAlpha = G.fade; ctx.fillStyle = '#fff3c0'; ctx.font = `900 ${Math.round(H * .06)}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(G.fadeTitle, W / 2, H / 2); ctx.globalAlpha = 1; }
    }
    Cinematic.draw(ctx, W, H);
  }

  /* ---------- sky ---------- */
  function drawSky(G, tod, night) {
    const [top, bot] = skyColours(tod);
    const wx = G.pond.weather;
    const sg = ctx.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, mixHex(top, '#8a94a8', wx.cloud * .5)); sg.addColorStop(1, mixHex(bot, '#b8c0cc', wx.cloud * .5));
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    if (night > .02) {
      ctx.fillStyle = '#fff';
      for (const s of stars) { const tw = .5 + .5 * Math.sin(G.time * 2 + s[3]); ctx.globalAlpha = night * (1 - wx.cloud) * (0.3 + .7 * tw) * (0.4 + s[2] * .6); ctx.beginPath(); ctx.arc(s[0] * W, s[1] * H, .7 + s[2] * 1.3, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    /* sun and moon on an arc */
    const sunA = (tod - .25) / .55 * Math.PI, sx = W * .5 - Math.cos(sunA) * W * .45, sy = H * .55 - Math.sin(sunA) * H * .5;
    if (tod > .22 && tod < .83) {
      const rg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 160); rg.addColorStop(0, 'rgba(255,250,220,.95)'); rg.addColorStop(.12, 'rgba(255,240,180,.7)'); rg.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = rg; ctx.globalAlpha = 1 - wx.cloud * .6; ctx.beginPath(); ctx.arc(sx, sy, 160, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (night > .05) {
      const ma = ((tod + .5) % 1 - .25) / .55 * Math.PI, mx = W * .5 - Math.cos(ma) * W * .45, my = H * .55 - Math.sin(ma) * H * .5;
      ctx.globalAlpha = night * (1 - wx.cloud * .7);
      const mg = ctx.createRadialGradient(mx, my, 20, mx, my, 120); mg.addColorStop(0, 'rgba(255,255,240,.5)'); mg.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 120, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff9e0'; ctx.beginPath(); ctx.arc(mx, my, 26, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,200,190,.35)'; for (const [dx, dy, r] of [[-8, -6, 5], [7, 4, 7], [-3, 10, 3]]) { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    /* clouds */
    for (const c of clouds) {
      c.x += c.sp * .0001 * (1 + wx.gust * 4) * (1 / 60);
      if (c.x > 1.3) c.x -= 1.6;
      const cw = c.img.width * c.s * (W / 1600), ch = c.img.height * c.s * (W / 1600);
      ctx.globalAlpha = c.a * (0.55 + wx.cloud * .45) * (1 - night * .6);
      const px = (c.x - G.cam.x * .00003) * W * 1.3 - W * .15;
      ctx.drawImage(c.img, px, c.y * H - ch * .3, cw, ch);
    }
    ctx.globalAlpha = 1;
    if (wx.rainbow > .02) {
      ctx.globalAlpha = wx.rainbow * .5; ctx.lineWidth = 7;
      const cols = ['#ff5a5a', '#ffb347', '#ffe95a', '#7fe37a', '#5ac8ff', '#8a7aff'];
      cols.forEach((col, i) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(W * .5, H * .95, H * .75 - i * 7, Math.PI, TAU); ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- ground ---------- */
  function drawGround(G, view) {
    const g = G.pond, b = g.bounds;
    const l = Math.max(b.left - 300, view.l), r = Math.min(b.right + 300, view.r);
    ctx.beginPath(); ctx.moveTo(l, b.bottom + 300);
    for (let x = l; x <= r; x += 12) ctx.lineTo(x, g.bedY(x));
    ctx.lineTo(r, b.bottom + 300); ctx.closePath();
    const sg = ctx.createLinearGradient(0, -120, 0, 700);
    sg.addColorStop(0, g.place.soil[0]); sg.addColorStop(.3, g.place.soil[1]); sg.addColorStop(1, g.place.soil[2]);
    ctx.fillStyle = sg; ctx.fill();
    ctx.save(); ctx.clip();
    /* soil bands */
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 3;
    for (let k = 1; k < 5; k++) { ctx.beginPath(); for (let x = l; x <= r; x += 24) { const y = g.bedY(x) + 30 * k + Math.sin(x * .02 + k) * 8; x === l ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
    for (const p of pebbles) { if (p.x < l || p.x > r) continue; ctx.fillStyle = mixHex('#8a7a62', '#4a3a2a', p.k, .8); ctx.beginPath(); ctx.ellipse(p.x, g.bedY(p.x) + p.dy, p.r, p.r * .7, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(70,45,20,.7)'; ctx.lineCap = 'round';
    for (const rt of roots) { if (rt.x < l || rt.x > r) continue; ctx.lineWidth = rt.w; ctx.beginPath(); ctx.moveTo(rt.x, g.bedY(rt.x) + 4); ctx.quadraticCurveTo(rt.x + rt.sway, g.bedY(rt.x) + rt.len * .5, rt.x + rt.sway * .4, g.bedY(rt.x) + rt.len); ctx.stroke(); }
    ctx.restore();
    /* the mud that a dry spell exposes */
    if (g.level > 4) { ctx.strokeStyle = 'rgba(40,30,20,.55)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (const side of [-1, 1]) { ctx.beginPath(); let first = true; for (let x = side * g.wetW(); Math.abs(x) <= g.W; x += side * 10) { if (x < l || x > r) continue; const y = g.bedY(x) - 1; first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; } ctx.stroke(); } ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; for (let x = -g.W; x <= g.W; x += 24) { if (Math.abs(x) < g.wetW() || x < l || x > r) continue; ctx.beginPath(); ctx.moveTo(x, g.bedY(x)); ctx.lineTo(x + 6, g.bedY(x) + 8); ctx.stroke(); } }
    /* top layer: dark humus on the banks, pale sand on the bed */
    ctx.lineCap = 'butt';
    ctx.beginPath(); for (let x = l; x <= r; x += 10) { const y = g.bedY(x) + 5; x === l ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.strokeStyle = 'rgba(40,28,12,.55)'; ctx.lineWidth = 10; ctx.stroke();
    /* snow on the banks in winter */
    if (g.weather.snow > .05) {
      ctx.strokeStyle = `rgba(245,250,255,${g.weather.snow * .95})`; ctx.lineWidth = 9; ctx.lineCap = 'round';
      for (const side of [-1, 1]) { const x0 = side * (g.W + 6), x1 = side * (b.right + 300); ctx.beginPath(); for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 12) { if (x < l || x > r) continue; const y = g.bedY(x) - 3; ctx.lineTo(x, y); } ctx.stroke(); }
    }
    /* grass on the banks */
    const season = g.season, brown = season === 'autumn' || season === 'winter';
    const cols = brown ? ['#a89a55', '#8a7a3a', '#c9b06a', '#7a6a35'] : ['#69a84a', '#4f8a33', '#8fc45a', '#3f7a2a'];
    ctx.lineCap = 'round';
    for (const gr of grass) {
      if (gr.x < l || gr.x > r) continue;
      const base = g.bedY(gr.x);
      const sway = Math.sin(G.time * 1.3 + gr.ph) * .08 + (g.weather.wind + g.weather.gust) * .3;
      ctx.strokeStyle = cols[gr.c]; ctx.lineWidth = gr.w;
      ctx.beginPath(); ctx.moveTo(gr.x, base + 2); ctx.quadraticCurveTo(gr.x + gr.lean * gr.h * .4, base - gr.h * .55, gr.x + (gr.lean + sway) * gr.h, base - gr.h); ctx.stroke();
    }
    /* leaf litter on the left bank */
    const ls = g.litterSpot;
    if (ls.x > l - 100 && ls.x < r + 100) {
      const rng = mulberry32(5);
      for (let i = 0; i < 26; i++) { const x = ls.x + (rng() - .5) * 150, y = g.bedY(x) - 2 - rng() * 8; ctx.save(); ctx.translate(x, y); ctx.rotate((rng() - .5) * 1.2); Sprites.drawLeaf(ctx, { s: .8 + rng() * .5, col: mixHex('#b5742e', '#7a4a1e', rng()) }); ctx.restore(); }
    }
  }
  function drawLog(G) {
    const L = G.pond.log;
    if (G.pond.place.log === 'stone') {
      ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.ang);
      Sprites.drawRock(ctx, { rx: L.len / 2, ry: L.r * 1.1, k: .6, tilt: 0 });
      ctx.restore(); return;
    }
    ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.ang);
    const g = ctx.createLinearGradient(0, -L.r, 0, L.r); g.addColorStop(0, '#8a6a44'); g.addColorStop(.5, '#5e4426'); g.addColorStop(1, '#2e1e10');
    ctx.fillStyle = g; rr(ctx, -L.len / 2, -L.r, L.len, L.r * 2, L.r * .8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
    for (let x = -L.len / 2 + 20; x < L.len / 2; x += 26) { ctx.beginPath(); ctx.moveTo(x, -L.r + 4); ctx.quadraticCurveTo(x + 6, 0, x - 3, L.r - 4); ctx.stroke(); }
    ctx.fillStyle = '#c9a56a'; ctx.beginPath(); ctx.ellipse(L.len / 2, 0, 7, L.r, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(L.len / 2, 0, 7 * k / 4, L.r * k / 4, 0, 0, TAU); ctx.stroke(); }
    if (G.pond.weather.snow > .1) { ctx.fillStyle = `rgba(245,250,255,${G.pond.weather.snow})`; rr(ctx, -L.len / 2 + 4, -L.r - 5, L.len - 8, 9, 4); ctx.fill(); }
    ctx.restore();
  }

  /* ---------- underwater ---------- */
  function drawUnderwater(G, view, time) {
    const g = G.pond;
    /* the sunken branch */
    const br = g.branch;
    ctx.save(); ctx.translate(br.x, br.y); ctx.rotate(br.ang); ctx.strokeStyle = '#3e2c18'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(br.len, -10); ctx.moveTo(br.len * .55, -6); ctx.lineTo(br.len * .7, -40); ctx.stroke(); ctx.restore();
    for (const w of g.weeds) { if (w.x < view.l || w.x > view.r) continue; ctx.save(); ctx.translate(w.x, w.base); Sprites.drawWeed(ctx, w, time, g.season); ctx.restore(); }
    for (const r of g.rocks) { if (r.x < view.l || r.x > view.r) continue; ctx.save(); ctx.translate(r.x, r.y); Sprites.drawRock(ctx, r); ctx.restore(); }
    for (const p of G.algae.patches) { if (p.x < view.l || p.x > view.r) continue; if (p.site.kind === 'pad' && p.site.pad.health < .2) continue; ctx.save(); ctx.translate(p.x, p.y); Sprites.drawAlgae(ctx, p.site, p.amount, time); ctx.restore(); }
    for (const s of G.snails.list) { if (s.x < view.l || s.x > view.r) continue; ctx.save(); ctx.translate(s.x, g.bedY(s.x) - 2); ctx.scale(s.dir, 1); Sprites.drawSnail(ctx, { s: .9 }); ctx.restore(); }
    for (const h of G.nymphs.husks) { ctx.save(); ctx.translate(h.x, h.y); ctx.scale(h.dir, 1); ctx.globalAlpha = .5; Sprites.drawNymph(ctx, { s: .9, jaw: 0 }); ctx.restore(); }
    for (const n of G.nymphs.list) { if (n.x < view.l || n.x > view.r) continue; ctx.save(); ctx.translate(n.x, n.y); ctx.scale(n.dir, 1); if (n.state === 'twitch') ctx.translate(Math.sin(time * 60) * 1.5, 0); Sprites.drawNymph(ctx, { s: 1, jaw: n.jaw, walk: n.walk }); ctx.restore(); }
    for (const m of G.minnows.list) { ctx.save(); ctx.translate(m.x, m.y); ctx.scale(sign(m.vx) || 1, 1); Sprites.drawMinnow(ctx, { s: 1, ph: m.ph, gold: g.place.goldfish }); ctx.restore(); }
    /* the mud spot */
    const ms = g.mudSpot;
    ctx.save(); ctx.translate(ms.x, ms.y + 8); ctx.fillStyle = '#3a2a18'; ctx.beginPath(); ctx.ellipse(0, 0, 46, 12, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 2, 30, 6, 0, 0, TAU); ctx.fill(); ctx.restore();
    drawEggMasses(G, view, time, true);
    for (const w of G.wrigglers.list) { if (w.caught || w.x < view.l || w.x > view.r) continue; ctx.save(); ctx.translate(w.x, w.y); Sprites.drawWriggler(ctx, { s: 1, ph: w.ph, wriggle: 1 }); ctx.restore(); }
    /* spawn spots: weed clumps in the shallows */
    for (const sp of g.spawnSpots) { ctx.save(); ctx.translate(sp.x, g.bedY(sp.x)); Sprites.drawWeed(ctx, { kind: 'elodea', h: g.bedY(sp.x) - sp.y + 10, ph: sp.x, sway: .8, tint: .4 }, time, g.season); ctx.restore(); }
    drawNeighboursUnder(G, view, time);
    for (const p of G.players) if (p.inWater() || p.isTadpole() || p.state === 'egg') drawPlayer(G, p, time);
  }
  function drawNeighboursUnder(G, view, time) {
    const N = G.neighbours, H = G.hazards, g = G.pond; if (!N) return;
    for (const c of N.caddis) { if (c.x < view.l || c.x > view.r) continue; ctx.save(); ctx.translate(c.x, g.bedY(c.x) - 3); ctx.scale(c.dir, 1); Sprites.drawCaddis(ctx, { s: 1, walk: c.walk, seed: c.seed }); ctx.restore(); }
    for (const l of N.leeches) { ctx.save(); ctx.translate(l.x, l.y); Sprites.drawLeech(ctx, { s: 1, ph: l.ph }); ctx.restore(); }
    for (const b of N.boatmen) { if (b.x < view.l || b.x > view.r) continue; ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.dir, 1); Sprites.drawBoatman(ctx, { s: 1, ph: b.ph }); ctx.restore(); }
    for (const n of N.newts) { if (n.x < view.l || n.x > view.r) continue; ctx.save(); ctx.translate(n.x, n.y); ctx.scale(n.dir, 1); ctx.rotate(clamp(n.vy / 200, -.5, .5) * n.dir); Sprites.drawNewt(ctx, { s: 1.1, ph: n.ph }); ctx.restore(); }
    for (const t of N.tadpoles) { if (t.x < view.l || t.x > view.r) continue; ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang); if (Math.cos(t.ang) < 0) ctx.scale(1, -1); Sprites.drawTadpole(ctx, { s: t.size * .7, species: SPECIES[t.species] || SPECIES.green, kick: t.kick, swim: .6, legs: Math.max(0, t.size - .7) * 3 }); ctx.restore(); }
    if (H && H.fish.state !== 'away') { const F = H.fish; ctx.save(); ctx.translate(F.x, F.y); ctx.scale(F.dir, 1); ctx.rotate(clamp(F.vy / 300, -.4, .4) * F.dir); Sprites.drawFish(ctx, { s: 1.6, ph: F.ph }); ctx.restore(); }
    const T = N.turtle; if (T.state === 'climb' && T.y > g.surfaceAt(T.x)) { ctx.save(); ctx.translate(T.x, T.y); ctx.scale(-1, 1); Sprites.drawTurtle(ctx, { s: 1, pose: 'swim', ph: T.ph }); ctx.restore(); }
  }
  function drawNeighboursOver(G, view, time) {
    const N = G.neighbours, H = G.hazards, g = G.pond; if (!N) return;
    const T = N.turtle;
    if (T.state === 'bask' || T.state === 'slide' || (T.state === 'climb' && T.y <= g.surfaceAt(T.x))) { ctx.save(); ctx.translate(T.x, T.y); ctx.scale(T.state === 'climb' ? -1 : 1, 1); if (T.state === 'slide' && T.t > .9) ctx.rotate(.5 * (T.t - .9)); Sprites.drawTurtle(ctx, { s: 1, pose: 'bask', ph: T.ph }); ctx.restore(); }
    for (const s of N.striders) { if (s.y > 5000 || s.x < view.l || s.x > view.r) continue; ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.dir, 1); Sprites.drawStrider(ctx, { s: 1, ph: s.ph }); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; for (const dx of [-14, -9, 9, 16]) { ctx.beginPath(); ctx.ellipse(s.x + dx * s.dir, s.y + 1, 4, 1.5, 0, 0, TAU); ctx.stroke(); } }
    for (const t of N.toadlets || []) { ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.dir, 1); Sprites.drawFrog(ctx, { s: .3, species: SPECIES.toad, pose: t.air ? 'jump' : 'sit' }); ctx.restore(); }
  }
  /* ---------- things that belong to one place ---------- */
  function drawPlaceBack(G, view, time) {
    const g = G.pond;
    /* the culvert: a concrete pipe in the bank, under the water line */
    if (g.culvert) {
      const c = g.culvert;
      ctx.save();
      /* keep the pipe inside the soil: clip to everything below the bank line */
      ctx.beginPath(); ctx.moveTo(c.x - 200, 900);
      for (let x = c.x - 200; x <= c.x + 200; x += 8) ctx.lineTo(x, Math.max(g.bedY(x), c.side * (x - c.x) < 0 ? 12 : -999));
      ctx.lineTo(c.x + 200, 900); ctx.closePath(); ctx.clip();
      ctx.translate(c.x, c.y); ctx.scale(c.side, 1);
      const pg = ctx.createLinearGradient(0, -34, 0, 34); pg.addColorStop(0, '#b8b4a8'); pg.addColorStop(.5, '#8a867c'); pg.addColorStop(1, '#5a574f');
      ctx.fillStyle = pg; ctx.fillRect(0, -34, 140, 68);
      const fadeG = ctx.createLinearGradient(20, 0, 140, 0); fadeG.addColorStop(0, 'rgba(60,40,20,0)'); fadeG.addColorStop(1, g.place.soil[1]); ctx.fillStyle = fadeG; ctx.fillRect(0, -35, 141, 70);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; for (const x of [34, 68]) { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x, 34); ctx.stroke(); }
      ctx.fillStyle = '#9a968a'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 36, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#141814'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 28, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(80,120,60,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4, -30); ctx.quadraticCurveTo(-10, -10, -6, 12); ctx.stroke();
      ctx.restore();
    }
    /* signposts at the ends of the banks */
    for (const s of g.signs) {
      if (s.x < view.l - 100 || s.x > view.r + 100) continue;
      const y = g.bedY(s.x);
      ctx.save(); ctx.translate(s.x, y);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-4, -96, 8, 96);
      ctx.save(); ctx.translate(0, -84); ctx.scale(s.side, 1);
      ctx.fillStyle = '#c9a060'; ctx.beginPath(); ctx.moveTo(-46, -16); ctx.lineTo(40, -16); ctx.lineTo(58, 0); ctx.lineTo(40, 16); ctx.lineTo(-46, 16); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#3a2410'; ctx.font = `900 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(PLACES[s.dest.kind].simple, s.side * 6, -84);
      ctx.restore();
    }
    /* pitcher plants on the bog banks */
    for (const pp of g.pitchers) { if (pp.x < view.l || pp.x > view.r) continue; ctx.save(); ctx.translate(pp.x, g.bedY(pp.x)); Sprites.drawPitcher(ctx, pp); ctx.restore(); }
    /* the garden's stone edge and fountain */
    for (const st of g.edgeStones) { if (st.x < view.l || st.x > view.r) continue; ctx.save(); ctx.translate(st.x, g.bedY(st.x) - st.r * .3); Sprites.drawRock(ctx, { rx: st.r, ry: st.r * .6, k: st.k, tilt: 0 }); ctx.restore(); }
    if (g.fountain) {
      const fx = g.fountain.x, fy = g.bedY(fx);
      ctx.save(); ctx.translate(fx, fy);
      ctx.fillStyle = '#9a9488'; ctx.fillRect(-10, -60, 20, 60);
      ctx.fillStyle = '#b8b2a4'; ctx.beginPath(); ctx.ellipse(0, -60, 44, 10, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(-44, -66, 88, 6);
      ctx.fillStyle = '#7ac2dc'; ctx.beginPath(); ctx.ellipse(0, -66, 40, 5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(210,240,255,.8)'; ctx.lineWidth = 2;
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -72); ctx.quadraticCurveTo(sgn * 20, -120 - Math.sin(time * 8) * 2, sgn * 38, -68); ctx.stroke(); }
      ctx.fillStyle = 'rgba(220,245,255,.9)'; for (let i = 0; i < 6; i++) { const k = ((time * 1.7 + i / 6) % 1); ctx.beginPath(); ctx.arc((i % 2 ? 1 : -1) * (38 * k), -72 - Math.sin(k * Math.PI) * 44, 1.8, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  function drawPlaceFront(G, view, time) {
    const g = G.pond;
    /* the ladybug visitor */
    const E = G.events;
    if (E && E.ladybug) { const L = E.ladybug; ctx.save(); ctx.translate(L.x, L.y); ctx.scale(L.dir, 1); Sprites.drawLadybug(ctx, { s: 1.3, open: L.state === 'sit' ? 0 : 1, wing: L.wing }); ctx.restore(); }
    /* first frost: white rime on the banks and pad edges */
    if (E && E.frost > .02) {
      ctx.save(); ctx.globalAlpha = E.frost * .85; ctx.strokeStyle = '#f4fbff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const side of [-1, 1]) { ctx.beginPath(); for (let x = side * g.W; Math.abs(x) < g.W + 900; x += side * 14) { if (x < view.l || x > view.r) continue; ctx.lineTo(x, g.bedY(x) - 2); } ctx.stroke(); }
      ctx.fillStyle = '#ffffff'; for (const p of g.pads) { const r = g.padSize(p); ctx.beginPath(); ctx.ellipse(p.x, p.y - 1, r * .95, r * .33, 0, Math.PI, TAU); ctx.lineWidth = 2; ctx.stroke(); }
      for (let i = 0; i < 40; i++) { const x = view.l + ((i * 97.3) % (view.r - view.l)), y = g.isLand(x) ? g.bedY(x) - 4 : g.surfaceAt(x) - 2; const tw = .5 + .5 * Math.sin(time * 4 + i); ctx.globalAlpha = E.frost * tw; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    /* floating sphagnum moss in the bog */
    for (const m of g.mossMats) {
      if (m.x < view.l - 120 || m.x > view.r + 120) continue;
      const y = g.surfaceAt(m.x);
      ctx.save(); ctx.translate(m.x, y);
      const rng = mulberry32((m.x * 7) | 0);
      for (let i = 0; i < 14; i++) { ctx.fillStyle = mixHex('#6a8a3a', '#a8a050', rng(), .9); ctx.beginPath(); ctx.ellipse((rng() - .5) * m.r * 1.8, (rng() - .6) * 6, 8 + rng() * 10, 4 + rng() * 3, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(200,60,60,.8)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc((rng() - .5) * m.r * 1.4, -4 - rng() * 3, 1.6, 0, TAU); ctx.fill(); }      // sundew dots
      ctx.restore();
    }
    /* the marsh blackbird, singing konk-la-ree */
    const b = g.blackbird;
    if (b) {
      const r = b.reed, sway = Math.sin(time * 1.1 + r.ph) * .06 + (g.weather.wind + g.weather.gust) * .18;
      const tx = r.x + (r.lean + sway) * r.h * .92, ty = r.base - r.h * .9 - 30;
      ctx.save(); ctx.translate(tx, ty); ctx.scale(-r.side || 1, 1); Sprites.drawBlackbird(ctx, { s: 1.3, sing: b.sing }); ctx.restore();
    }
  }
  function drawHazardsOver(G) {
    const H = G.hazards; if (!H) return;
    const S = H.snake; if (S.state !== 'hidden') { ctx.save(); ctx.translate(S.x, S.y); ctx.scale(S.dir, 1); Sprites.drawSnake(ctx, { s: 1.2, ph: S.ph, pose: S.state === 'coil' ? 'coil' : 'slither', tongue: S.tongue, strike: S.strike }); ctx.restore(); }
    const R = H.raccoon;
    if (R.state !== 'away') {
      ctx.save(); ctx.translate(R.x, R.y - 6); ctx.scale(R.dir, 1); Sprites.drawRaccoon(ctx, { s: 1.45, ph: R.ph, pose: R.pose });
      if (G.night > .3) { ctx.globalCompositeOperation = 'lighter'; for (const ex of [20, 29]) { const e = ctx.createRadialGradient(ex * 1.45, -9 * 1.45, 0, ex * 1.45, -9 * 1.45, 6); e.addColorStop(0, `rgba(255,240,150,${G.night})`); e.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = e; ctx.beginPath(); ctx.arc(ex * 1.45, -9 * 1.45, 6, 0, TAU); ctx.fill(); } }
      ctx.restore();
    }
  }
  function drawEggMasses(G, view, time, underwater) {
    for (const m of G.eggMasses) {
      if (m.x < view.l || m.x > view.r) continue;
      const age = time - (m.laidAt || 0);
      const dev = m.dev !== undefined && m.laidAt === undefined ? m.dev : clamp(age / 70, 0, 1);
      const hatch = m.hatch !== undefined && m.laidAt === undefined ? m.hatch : clamp((age - 100) / 30, 0, 1);
      if (!underwater) continue;
      ctx.save(); ctx.translate(m.x, m.y + Math.sin(time * 1.5 + m.x) * 1.5);
      if (m.string) Sprites.drawEggString(ctx, { s: 1, seed: m.seed, dev, hatch }); else Sprites.drawEggMass(ctx, { s: 1.1, count: m.count, seed: m.seed, dev, hatch });
      ctx.restore();
    }
  }
  function drawPad(G, p, time) {
    const g = G.pond, r = g.padSize(p);
    if (r < 6) return;
    ctx.save(); ctx.translate(p.x, p.y);
    /* shadow under the pad on the water */
    ctx.fillStyle = 'rgba(0,30,30,.18)'; ctx.beginPath(); ctx.ellipse(0, 4, r * .95, r * .32, 0, 0, TAU); ctx.fill();
    Sprites.drawLilyPad(ctx, { r, notch: p.notch, tilt: p.tilt, hue: p.hue, health: p.health, bloom: p.bloom, seed: p.x | 0 });
    if (g.weather.snow > .1 && p.health < .3) { ctx.fillStyle = `rgba(245,250,255,${g.weather.snow * .8})`; ctx.beginPath(); ctx.ellipse(0, -2, r * .8, r * .2, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function drawSpots(G, time) {
    const g = G.pond, p = G.player;
    if (!p) return;
    const pulse = .5 + .5 * Math.sin(time * 4);
    const glow = (x, y, col, rx = 40, ry = 14) => { ctx.save(); ctx.globalAlpha = .35 + pulse * .35; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, rx + pulse * 6, ry + pulse * 3, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = .12 + pulse * .1; ctx.fillStyle = col; ctx.fill(); ctx.restore(); };
    if (g.season === 'winter' && p.stage === 5 && p.state !== 'hibernating') {
      if (p.species.special === 'freeze') glow(g.litterSpot.x, g.litterSpot.y - 4, '#bfe8ff', 60, 14);
      else glow(g.mudSpot.x, g.mudSpot.y + 4, '#ffd23f', 50, 16);
    }
    if (p.readyFlag) for (const s of g.spawnSpots) glow(s.x, s.y, '#dff6ff', 34, 22);
    if (p.species.special === 'cling' && p.stage >= 4) for (const c of g.clingReeds) { ctx.save(); ctx.globalAlpha = .25 + pulse * .2; ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.ellipse(c.x, c.y, 14, 40, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  function drawChorus(G, view, layer) {
    if (!G.chorus) return;
    for (const f of G.chorus.frogs) {
      if (f.present < .05 || f.x < view.l || f.x > view.r) continue;
      if ((layer === 'bank') !== (f.kind === 'bank')) continue;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir, 1); ctx.globalAlpha = f.present; ctx.scale(f.s, f.s);
      Sprites.drawFrog(ctx, { s: 1, species: f.species, pose: 'sit', throat: f.throat, blink: f.blink });
      ctx.restore();
    }
  }
  function drawBugs(G, view, time) {
    for (const b of G.bugs.list) {
      if (b.x < view.l || b.x > view.r) continue;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.dir, 1);
      if (b.kind === 'fly') Sprites.drawFly(ctx, { s: 1, wing: b.wing });
      else if (b.kind === 'mosquito') Sprites.drawMosquito(ctx, { s: 1, wing: b.wing });
      else if (b.kind === 'mayfly') Sprites.drawMayfly(ctx, { s: 1.2, ph: b.wing * .1 });
      else Sprites.drawDragonfly(ctx, { s: 1, wing: b.wing, col: b.col });
      ctx.restore();
    }
  }
  function drawHeron(G) {
    const h = G.heron; if (!h || !h.active) return;
    const g = G.pond;
    if (h.pose() === 'fly') { const sy = g.surfaceAt(h.x); ctx.fillStyle = 'rgba(0,20,30,.18)'; ctx.beginPath(); ctx.ellipse(h.x, Math.max(sy, g.bedY(h.x) - 2), 90, 12, 0, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(h.dir, 1);
    Sprites.drawHeron(ctx, { s: 1.15, pose: h.pose(), flap: h.flap, neck: h.neck, strike: h.strikeT });
    ctx.restore();
  }

  /* ---------- the player ---------- */
  function drawPlayer(G, p, time) {
    const g = G.pond, s = p.scale();
    ctx.save();
    if (p.state === 'egg') {
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(time * 14) * .08 * p.hatchWobble);
      Sprites.drawEggMass(ctx, { s: 1.1, count: 14, seed: 4, dev: .55 + p.hatchProg * .45, hatch: 0 });
      /* our own egg, a little bigger */
      ctx.fillStyle = 'rgba(200,235,250,.5)'; ctx.beginPath(); ctx.arc(2, -2, 9 + p.hatchWobble * 2, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#1d1d16'; ctx.save(); ctx.rotate(-.6 + Math.sin(time * 9) * .25 * p.hatchWobble); ctx.beginPath(); ctx.ellipse(2, -2, 4.2, 3.2, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1d1d16'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(-6, 0, -9, -3 + p.hatchProg * 2); ctx.stroke(); ctx.restore();
      ctx.restore(); return;
    }
    if (p.isTadpole()) {
      ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      if (Math.cos(p.ang) < 0) ctx.scale(1, -1);
      if (p.fright > 0) ctx.translate(Math.sin(time * 50) * 2 * p.fright, 0);
      Sprites.drawTadpole(ctx, { s, species: p.species, kick: p.kick, swim: clamp(p.swim + p.burst, 0, 1), legs: p.legs, arms: p.arms, tail: p.tail, morph: p.morph, look: p.look });
      ctx.restore();
      /* air meter while the tail shrinks */
      if (p.stage === 3) drawAirMeter(G, p);
      return;
    }
    /* froglet / frog */
    ctx.translate(p.x, p.y);
    let pose = 'sit', leg, rot = 0;
    if (p.state === 'hibernating') pose = 'sleep';
    else if (p.mode === 'air') { pose = 'jump'; leg = p.vy < 0 ? 1 : clamp(1 - (p.vy / 500), .2, 1); rot = clamp(p.vy / 900, -.4, .4) * p.dir; }
    else if (p.mode === 'water') { const surf = g.surfaceAt(p.x); pose = p.y < surf + 8 * s && p.kickAnim < .2 ? 'float' : 'swim'; leg = pose === 'swim' ? p.kickAnim : .6; rot = pose === 'swim' ? clamp(p.vy / 400, -.5, .5) * p.dir : 0; }
    else if (p.mode === 'cling') { rot = -Math.PI / 2 * p.dir; pose = 'crouch'; }
    else if (p.crouch > .5) pose = 'crouch';
    else if (p.perch && p.perch.kind === 'pad') rot = p.perch.pad.tilt;
    ctx.rotate(rot);
    ctx.scale(p.dir, 1);
    if (p.landT > 0) ctx.scale(1 + .14 * p.landT, 1 - .2 * p.landT);
    if (p.state === 'hibernating' && p.hibKind === 'mud') ctx.globalAlpha = .75;
    const tg = p.tongue;
    const idle = p.mode === 'perch' && p.state !== 'hibernating';
    const throat = Math.max(p.throat, idle ? .1 + .07 * Math.sin(time * 2.6 + p.id) : 0);
    Sprites.drawFrog(ctx, { s, species: p.species, pose, leg, throat, blink: p.blink, tail: p.stub, look: p.look, tongue: tg.active ? Math.sin(Math.min(1, tg.t) * Math.PI) : 0, tongueLen: tg.len / s, tongueDy: tg.dy / s });
    ctx.globalAlpha = 1;
    if (p.state === 'hibernating') {
      if (p.hibKind === 'mud') { ctx.fillStyle = 'rgba(58,42,24,.85)'; ctx.beginPath(); ctx.ellipse(0, 8 * s, 34 * s, 10 * s, 0, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(200,240,255,.9)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + time * .2; const x = Math.cos(a) * 26 * s, y = Math.sin(a) * 14 * s - 4; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke(); } }
      const zz = (time * .8) % 1; ctx.fillStyle = `rgba(255,255,255,${.8 - zz * .8})`; ctx.font = `900 ${12 + zz * 10}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('z', 10 * s, -24 * s - zz * 22);
    }
    ctx.restore();
    if (p.fright > 0) { ctx.save(); ctx.globalAlpha = p.fright * .5; ctx.strokeStyle = '#ff9a7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 30 * s + (1 - p.fright) * 20, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  function drawAirMeter(G, p) {
    const s = p.scale();
    ctx.save(); ctx.translate(p.x, p.y - 26 * s);
    ctx.fillStyle = 'rgba(0,20,30,.45)'; rr(ctx, -22, -5, 44, 10, 5); ctx.fill();
    ctx.fillStyle = p.air < .3 ? '#ff7a5a' : '#8fe0ff'; rr(ctx, -20, -3, 40 * p.air, 6, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `900 9px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('air', 0, -8);
    ctx.restore();
  }
  function drawTargetRing(G, p, time) {
    const pulse = .5 + .5 * Math.sin(time * 8);
    if (p.target) { const t = p.target, y = t.y + (p.targetKind === 'wriggler' ? 8 : 0); ctx.save(); ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2.5; ctx.globalAlpha = .6 + pulse * .4; ctx.beginPath(); ctx.arc(t.x, y, 12 + pulse * 4, 0, TAU); ctx.stroke(); ctx.restore(); }
    if (p.grazing) { const a = p.grazing; ctx.save(); ctx.strokeStyle = '#bff08a'; ctx.lineWidth = 2; ctx.globalAlpha = .4 + pulse * .3; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.site.r * .8 + pulse * 3, a.site.r * .4 + pulse * 2, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  }

  /* ---------- ice ---------- */
  function drawIce(G, view, time) {
    const g = G.pond, ice = g.weather.ice, thawing = g.season !== 'winter';
    const th = 5 + ice * 26;
    const l = Math.max(-g.W, view.l), r = Math.min(g.W, view.r);
    ctx.save();
    for (let x0 = Math.floor(l / 80) * 80; x0 < r; x0 += 80) {
      if (thawing && g.noise(x0 * .03 + 9) > ice * 1.4) continue;
      const x1 = Math.min(x0 + 80, g.W), xa = Math.max(x0, -g.W);
      if (x1 <= xa) continue;
      const drift = thawing ? Math.sin(time * .6 + x0) * 3 : 0;
      const ig = ctx.createLinearGradient(0, -th * .3, 0, th);
      ig.addColorStop(0, `rgba(240,250,255,${.95 * Math.min(1, ice * 3)})`); ig.addColorStop(.6, `rgba(200,228,240,${.85 * Math.min(1, ice * 3)})`); ig.addColorStop(1, `rgba(150,190,215,${.6 * Math.min(1, ice * 3)})`);
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.moveTo(xa, -th * .3 + drift); ctx.lineTo(x1, -th * .3 + drift); ctx.lineTo(x1, th * .7 + drift); ctx.lineTo(xa, th * .7 + drift); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xa, -th * .3 + drift); ctx.lineTo(x1, -th * .3 + drift); ctx.stroke();
      if (thawing) { ctx.strokeStyle = 'rgba(120,170,200,.6)'; ctx.beginPath(); ctx.moveTo(xa, -th * .3 + drift); ctx.lineTo(xa, th * .7 + drift); ctx.moveTo(x1, -th * .3 + drift); ctx.lineTo(x1, th * .7 + drift); ctx.stroke(); }
    }
    /* cracks */
    if (ice > .35) {
      ctx.strokeStyle = `rgba(120,160,190,${(ice - .35) * .9})`; ctx.lineWidth = 1.2;
      for (const c of cracks) { if (c[0][0] < l - 300 || c[0][0] > r + 300) continue; ctx.beginPath(); c.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1] + th * .2) : ctx.moveTo(pt[0], pt[1] + th * .2)); ctx.stroke(); }
    }
    /* snow on top */
    if (g.weather.snow > .1 && !thawing) { ctx.fillStyle = `rgba(250,253,255,${g.weather.snow * .9})`; ctx.beginPath(); ctx.moveTo(l, -th * .3); for (let x = l; x <= r; x += 30) ctx.lineTo(x, -th * .3 - 3 - Math.abs(Math.sin(x * .05)) * 5 * g.weather.snow); ctx.lineTo(r, -th * .3 + 2); ctx.lineTo(l, -th * .3 + 2); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function drawRain(G, view, time) {
    const g = G.pond, k = g.weather.rain;
    const n = Math.round(260 * k * (quality === 'low' ? .5 : 1));
    ctx.strokeStyle = `rgba(210,235,255,${.35 * k})`; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    const w = view.r - view.l, h = view.b - view.t;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = view.l + ((i * 173.3 + time * 60) % w), y = view.t + ((i * 97.7 + time * 700) % h);
      const floor = g.isLand(x) ? g.bedY(x) : g.surfaceAt(x);
      if (y > floor) continue;
      ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 16);
    }
    ctx.stroke();
  }

  /* ---------- overlays ---------- */
  function drawOverlays(G) {
    const cam = G.cam, g = G.pond;
    const tag = (wx, wy, text, col = '#fff') => {
      const [sx, sy] = cam.toScreen(wx, wy);
      if (sx < -80 || sx > W + 80 || sy < 0 || sy > H) return;
      ctx.font = `800 12px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(text).width + 14;
      ctx.fillStyle = 'rgba(10,30,40,.6)'; rr(ctx, sx - tw / 2, sy - 20, tw, 18, 9); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(text, sx, sy - 11);
    };
    if (G.settings.labels) {
      const N = G.neighbours, Hz = G.hazards;
      if (N) {
        if (N.turtle.state !== 'gone') tag(N.turtle.x, N.turtle.y - 26, 'painted turtle');
        if (G.events && G.events.ladybug) tag(G.events.ladybug.x, G.events.ladybug.y - 14, 'ladybug', '#ffb0a0');
        for (const s of N.striders) if (s.y < 5000) tag(s.x, s.y - 8, 'water strider');
        for (const c of N.caddis) tag(c.x, g.bedY(c.x) - 14, 'caddisfly larva');
        for (const b of N.boatmen) tag(b.x, b.y - 10, 'water boatman');
        for (const n of N.newts) tag(n.x, n.y - 14, 'newt');
        for (const lc of N.leeches) tag(lc.x, lc.y - 10, 'leech');
        if (N.tadpoles.length) tag(N.tadpoles[0].x, N.tadpoles[0].y - 12, 'wild tadpoles');
      }
      if (Hz) {
        if (Hz.snake.state !== 'hidden') tag(Hz.snake.x, Hz.snake.y - 20, 'garter snake', '#ff9a7a');
        if (Hz.raccoon.state !== 'away') tag(Hz.raccoon.x, Hz.raccoon.y - 40, 'raccoon', '#ff9a7a');
        if (Hz.fish.state !== 'away') tag(Hz.fish.x, Hz.fish.y - 30, 'bass', '#ff9a7a');
      }
      for (const p of G.players) tag(p.x, p.y - 30 * p.scale(), (G.players.length > 1 ? `P${p.id} · ` : '') + STAGES[p.stage].short + (p.stage >= 4 ? ' · ' + p.species.short : ''), '#ffe27a');
      for (const b of G.bugs.list) if (!b.caught) tag(b.x, b.y - 8, BUG_KINDS[b.kind].name);
      for (const n of G.nymphs.list) tag(n.x, n.y - 14, 'dragonfly nymph', '#ffb08a');
      let k = 0; for (const w of G.wrigglers.list) { if (k++ > 6) break; tag(w.x, w.y - 6, 'wriggler'); }
      if (G.heron && G.heron.active) tag(G.heron.x, G.heron.y - 80, 'great blue heron', '#ff9a7a');
      for (const f of G.chorus.frogs) if (f.present > .5) tag(f.x, f.y - 26, f.species.short);
      for (const p of g.pads) if (g.padSize(p) > 20) tag(p.x, p.y - 8, 'lily pad', '#bff08a');
      for (const m of G.eggMasses) tag(m.x, m.y - 30, 'frog spawn');
      tag(g.mudSpot.x, g.mudSpot.y - 10, 'mud', '#d9c08a');
      for (const s of G.snails.list) tag(s.x, g.bedY(s.x) - 14, 'pond snail');
      for (const m of G.minnows.list.slice(0, 1)) tag(m.x, m.y - 10, 'minnows');
    }
    /* off-screen arrows */
    const arrow = (wx, wy, col, label) => {
      const [sx, sy] = cam.toScreen(wx, wy);
      if (sx > 40 && sx < W - 40 && sy > 100 && sy < H - 40) return;
      const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy, a = Math.atan2(dy, dx);
      const ex = clamp(sx, 50, W - 50), ey = clamp(sy, 110, H - 50);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -12); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (label) { ctx.font = `900 12px ${UI_FONT}`; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(label, ex, ey + 26); }
    };
    if (G.players[1]) arrow(G.players[1].x, G.players[1].y, '#7fd0ff', 'Player 2');
    const p = G.player;
    if (p && g.season === 'winter' && p.stage === 5 && p.state !== 'hibernating') { if (p.species.special === 'freeze') arrow(g.litterSpot.x, g.litterSpot.y, '#bfe8ff', 'leaf pile'); else arrow(g.mudSpot.x, g.mudSpot.y, '#ffd23f', 'mud'); }
    if (p && p.readyFlag) { const s = g.spawnSpots.reduce((a, b) => dist(p.x, p.y, a.x, a.y) < dist(p.x, p.y, b.x, b.y) ? a : b); arrow(s.x, s.y, '#dff6ff', 'eggs here'); }
  }

  function snapshot(G) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }
  function underwaterView() { return underView; }

  return { init, resize, frame, snapshot, setQuality, getQuality, getFps, nightAmount, skyColours, underwaterView };
})();
