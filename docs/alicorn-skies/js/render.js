/* ============================================================
   render.js — composing the land and the sky
   ============================================================
   Layers, back to front:
     sky (time of day + altitude + weather) → stars, aurora, sun,
     moon, drifting clouds, weather rainbow → far mountains and
     hills (parallax, tinted by zone) → world: ground, lake,
     waterfall, castle, cave, trees, decor, crystals, flowers,
     cloud platforms, rainbow bridge, Moon, constellation,
     collectibles, rings, friends, butterflies, birds, storm
     clouds, players, rain, particles → night / dusk tints,
     fireflies, vignette, quest arrow, labels, letterbox
   ============================================================ */
'use strict';

const Render = (function () {
  let canvas, ctx, W = 1, H = 1, DPR = 1;
  const SKY = [
    [0.00, '#0b1240', '#26306a'],
    [0.19, '#1a1e4a', '#8a4a6a'],
    [0.26, '#6f9ede', '#ffc3a0'],
    [0.38, '#5fb0f5', '#dff3ff'],
    [0.55, '#4fa3ef', '#d4ecff'],
    [0.70, '#6ba6e3', '#ffd9a3'],
    [0.79, '#4a4d9c', '#ff9a7c'],
    [0.86, '#1a2050', '#5c3d7c'],
    [1.00, '#0b1240', '#26306a']
  ];
  const stars = [], clouds = [];
  let quality = 'high';
  let fps = 60, fpsAcc = 0, fpsN = 0, lowFor = 0;
  let grassTufts = null;
  let curNight = 0, curTod = .4, curAlt = 0, curUnder = 0;
  let rimA = null, rimB = null;

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    for (let i = 0; i < 220; i++) stars.push([Math.random(), Math.random(), Math.random(), Math.random() * TAU]);
    for (let i = 0; i < 10; i++) clouds.push(makeCloud(i));
  }
  function resize(w, h, dpr) {
    W = w; H = h; DPR = quality === 'low' ? 1 : dpr;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  }
  function setQuality(q) { if (q !== quality) { quality = q; resize(W, H, devicePixelRatio || 1); } }
  function getFps() { return fps; }

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
    const w = 560, h = 300; c.width = w; c.height = h;
    const g = c.getContext('2d');
    const n = 7 + (Math.random() * 5 | 0);
    for (let k = 0; k < n; k++) {
      const x = 120 + Math.random() * (w - 240), y = 130 + Math.random() * 60, r = 40 + Math.random() * 55;
      const rg = g.createRadialGradient(x, y, r * .1, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(.6, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return { img: c, x: Math.random(), y: Math.random(), s: .5 + Math.random() * .9, sp: 3 + Math.random() * 8, a: .45 + Math.random() * .5, depth: .04 + Math.random() * .08 };
  }

  /* blend a per-zone colour across zone borders */
  function zoneMix(x, key) {
    let col = ZONES[0][key], i = 0;
    for (i = 1; i < ZONES.length; i++) { const z = ZONES[i]; col = mixHex(col, z[key], smoothstep(z.x0 - 260, z.x0 + 260, x)); }
    return col;
  }

  /* ---------- the frame ---------- */
  function frame(G, dt) {
    const { cam, world, tod, time } = G;
    const players = G.players;
    const weather = world.weather;
    const night = nightAmount(tod);
    G.night = night;
    if (dt > 0 && dt < .05) { fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.settings.quality === 'auto') { if (fps < 40) { if (++lowFor >= 3) setQuality('low'); } else lowFor = 0; } } }
    const alt = smoothstep(-2500, -3500, cam.y);           // 0 near the ground .. 1 in the Star Sky
    const cloudAlt = smoothstep(-1100, -1900, cam.y) * (1 - smoothstep(-2600, -3300, cam.y));
    G.alt = alt;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = quality === 'low' ? 'low' : 'high';

    /* --- sky --- */
    let [top, bot] = skyColours(tod);
    const zsky = zoneMix(cam.x, 'sky');
    bot = mixHex(bot, zsky, .25 * (1 - night));
    if (weather.cloud > .01) { top = mixHex(top, '#7d8794', weather.cloud * .7 * (1 - alt)); bot = mixHex(bot, '#b9bfc6', weather.cloud * .65 * (1 - alt)); }
    top = mixHex(top, '#8ec8ff', cloudAlt * .55 * (1 - night * .7)); bot = mixHex(bot, '#ffd9ef', cloudAlt * .6 * (1 - night * .7));
    top = mixHex(top, '#070a2a', alt * .95); bot = mixHex(bot, '#1a2470', alt * .85);
    const horizonY = clamp((0 - cam.y) * cam.zoom + H / 2, H * .35, H * 4);
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, top); sky.addColorStop(1, bot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    /* stars */
    const starK = Math.max(night * (1 - weather.cloud), alt);
    if (starK > .03) {
      const n = quality === 'low' ? 110 : stars.length;
      for (let i = 0; i < n; i++) {
        const [sx, sy, r, ph] = stars[i];
        const tw = .5 + .5 * Math.sin(time * 2 + ph * 6);
        const x = ((sx * W * 1.4 - cam.x * .02) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * .2, y = ((sy * H * 1.4 - cam.y * .03) % (H * 1.4) + H * 1.4) % (H * 1.4) - H * .2;
        ctx.globalAlpha = starK * (0.35 + .65 * tw);
        ctx.fillStyle = r > .9 ? '#ffe9b0' : '#fff';
        ctx.beginPath(); ctx.arc(x, y, .6 + r * 1.4 + alt * r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    /* aurora in the Star Sky */
    if (alt > .35 && quality !== 'low') {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 30) { const y = H * (.15 + b * .12) + Math.sin(x * .004 + time * .3 + b) * 60 + Math.sin(x * .011 - time * .2) * 25; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = ['rgba(120,255,190,.18)', 'rgba(160,140,255,.16)', 'rgba(255,150,220,.12)'][b];
        ctx.lineWidth = 60 + b * 20; ctx.globalAlpha = (alt - .35) * 1.4;
        ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    drawSunMoon(tod, night, horizonY, weather.cloud, alt);

    /* drifting clouds (screen space) */
    for (const c of clouds) {
      const cx = ((c.x * W * 1.5 + time * c.sp * (1 + weather.gust * 4) - cam.x * c.depth) % (W * 1.5 + 600) + (W * 1.5 + 600)) % (W * 1.5 + 600) - 300;
      const cy = ((c.y * H * 1.6 - cam.y * c.depth * .6) % (H * 1.6) + H * 1.6) % (H * 1.6) - H * .3;
      const a = c.a * (1 - night * .7) * (1 - weather.cloud * .4) * (1 - alt * .9) * (1 + cloudAlt * .5);
      if (a < .02) continue;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(c.img, cx, cy, c.img.width * c.s, c.img.height * c.s);
      if (weather.cloud > .3) { ctx.globalAlpha = weather.cloud * .7 * (1 - alt); ctx.filter = quality === 'low' ? 'none' : 'brightness(.78)'; ctx.drawImage(c.img, cx + 140, cy + 60, c.img.width * c.s * 1.3, c.img.height * c.s * 1.1); ctx.filter = 'none'; }
    }
    ctx.globalAlpha = 1;
    if (weather.rainbow > .02 && alt < .6) drawWeatherRainbow(horizonY, weather.rainbow * (1 - alt));

    /* far mountains & hills (parallax) */
    if (alt < .95) {
      const hillBase = horizonY;
      const fade = 1 - alt;
      for (let i = 2; i >= 0; i--) {
        const par = .06 + i * .05;
        let col = zoneMix(cam.x, 'hill');
        col = mixHex(col, '#dfe6ff', (2 - i) * .22);
        col = mixHex(col, '#141a3c', night * .8);
        if (weather.cloud > 0) col = mixHex(col, '#8a94a8', weather.cloud * .4);
        if (world.autumn > .01) col = mixHex(col, '#d9a04a', world.autumn * .35);
        if (world.snow > .01) col = mixHex(col, mixHex('#f2f6fb', '#3a4070', night * .7), world.snow * .75);
        ctx.fillStyle = col; ctx.globalAlpha = fade;
        ctx.beginPath(); ctx.moveTo(0, H);
        const amp = 50 + i * 40, yb = hillBase - 70 - i * 70 - alt * 200;
        for (let x = 0; x <= W; x += 16) {
          const wx = x + cam.x * par;
          const y = yb + Math.sin(wx * .0022 + i) * amp + Math.sin(wx * .0071 + i * 2) * amp * .35 + (i === 2 ? Math.abs(Math.sin(wx * .0009)) * -90 : 0);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

      }
      ctx.globalAlpha = 1;
    }

    /* ---------------- world space ---------------- */
    ctx.save();
    cam.apply(ctx);
    const view = cam.viewRect(160);
    curNight = night; curTod = tod; curAlt = alt;
    curUnder = players.some(p => p.state === 'swim') ? 1 : 0;
    const season = { snow: world.snow, autumn: world.autumn, blossom: world.blossom };
    drawGround(G, view, night, time, season);
    drawLakeBed(G, view, night, time);
    drawLake(G, view, night, time);
    for (const t of world.trees) if (t.back && t.x > view.l - 200 && t.x < view.r + 200) { ctx.save(); ctx.translate(t.x, t.y + 6); ctx.globalAlpha = .7; ctx.scale(.85, .85); Sprites.drawTree(ctx, t, time, night, season); ctx.restore(); }
    if (world.castle.x > view.l - 400 && world.castle.x < view.r + 400) { ctx.save(); ctx.translate(world.castle.x, world.castle.y); Sprites.drawCastle(ctx, world.castle, time, night); ctx.restore(); }
    if (world.cave.x > view.l - 200 && world.cave.x < view.r + 200) { ctx.save(); ctx.translate(world.cave.x, world.cave.y); Sprites.drawCave(ctx, world.cave, time, night); ctx.restore(); }
    const st = world.stable;
    if (st.x > view.l - 300 && st.x < view.r + 300) { ctx.save(); ctx.translate(st.x, st.y + 4); Sprites.drawStable(ctx, G.home || { items: [] }, time, night, G.foal && G.foal.adopted ? G.foal.name : ''); ctx.restore(); }
    const ra = world.raceArch;
    if (ra.x > view.l - 200 && ra.x < view.r + 200) { ctx.save(); ctx.translate(ra.x, ra.y + 4); Sprites.drawRaceArch(ctx, time, typeof Race !== 'undefined' && Race.canStart()); ctx.restore(); }
    for (const r of world.rocks) if (r.x > view.l && r.x < view.r) {
      ctx.save(); ctx.translate(r.x, r.y); Sprites.drawRock(ctx, r); ctx.restore();
    }
    for (const t of world.trees) if (!t.back && t.x > view.l - 300 && t.x < view.r + 300) { ctx.save(); ctx.translate(t.x, t.y + 2); Sprites.drawTree(ctx, t, time, night, season); ctx.restore(); }
    for (const a of world.apples) if (a.state !== 'taken' && a.x > view.l && a.x < view.r) { ctx.save(); ctx.translate(a.x, a.y + (a.state === 'hang' ? Math.sin(time * 2 + a.hx) * 1.5 : 0)); Sprites.drawApple(ctx, 8); ctx.restore(); }
    if (world.snow > .3) { ctx.save(); ctx.globalAlpha = smoothstep(.3, .8, world.snow); for (const sm of world.snowmen) if (sm.x > view.l - 100 && sm.x < view.r + 100) { ctx.save(); ctx.translate(sm.x, sm.y + 4); Sprites.drawSnowman(ctx, sm, time); ctx.restore(); } ctx.restore(); }
    /* the owl's branch */
    { const h = { x: FRIENDS.hoot.x, y: world.groundY(FRIENDS.hoot.x) - 95 }; if (h.x > view.l - 200 && h.x < view.r + 200) { ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(h.x - 30, h.y - 90); ctx.quadraticCurveTo(h.x - 10, h.y + 4, h.x + 60, h.y + 2); ctx.stroke(); } }
    for (const m of world.mushrooms) if (m.x > view.l && m.x < view.r) { ctx.save(); ctx.translate(m.x, m.y); Sprites.drawMushroom(ctx, m); ctx.restore(); }
    for (const rd of world.reeds) if (rd.x > view.l && rd.x < view.r) { ctx.save(); ctx.translate(rd.x, rd.y); Sprites.drawReed(ctx, rd, time); ctx.restore(); }
    if (world.ice < .6) for (const p of world.pads) if (p.x > view.l && p.x < view.r) { ctx.save(); ctx.translate(p.x, p.y); Sprites.drawLilyPad(ctx, p, time); ctx.restore(); }
    for (const c of world.crystals) if (c.x > view.l - 100 && c.x < view.r + 100) { ctx.save(); ctx.translate(c.x, c.y); Sprites.drawCrystal(ctx, c, time, night); ctx.restore(); }
    const nightClose = smoothstep(.3, .9, night);
    const flowerK = 1 - smoothstep(.35, .75, world.snow);
    for (const f of world.flowers) if (f.x > view.l && f.x < view.r && view.b > f.y - 80 && view.t < f.y && (flowerK > .02 || f.sleepy)) { ctx.save(); ctx.translate(f.x, f.y); if (!f.sleepy) ctx.scale(1, lerp(.2, 1, flowerK)); Sprites.drawFlower(ctx, f, time, nightClose); ctx.restore(); }
    for (const f of world.fallen) if (f.state === 'down' || f.state === 'rising') { ctx.save(); ctx.translate(f.x, f.y); Sprites.drawFallenStar(ctx, f, time); ctx.restore(); }
    /* the Cloud Kingdom */
    for (const c of world.clouds) if (c.x + c.w > view.l && c.x - c.w < view.r && c.y - 400 < view.b && c.y + 200 > view.t) {
      ctx.save(); ctx.translate(c.x, c.y);
      if (c.castle) Sprites.drawCloudCastle(ctx, c, time, night);
      Sprites.drawCloudPlatform(ctx, c, time, night);
      if (c.name && G.settings.labels) label(c.name, 0, -c.h - (c.castle ? 240 : 30), 15);
      ctx.restore();
    }
    drawRainbowBridge(G, view, time);
    if (world.moon.y + 500 > view.t && world.moon.y - 500 < view.b) { ctx.save(); ctx.translate(world.moon.x, world.moon.y); Sprites.drawMoon(ctx, world.moon, time); ctx.restore(); }
    drawConstellation(G, view, time);
    for (const s of world.stars) if (!s.taken && s.x > view.l && s.x < view.r && s.y > view.t && s.y < view.b) { ctx.save(); ctx.translate(s.x, s.y + Math.sin(time * 2 + s.ph) * 4); Sprites.drawStar(ctx, s.r, time, s.ph); ctx.restore(); }
    for (const g of world.gems) if (g.shown && !g.taken && g.x > view.l && g.x < view.r) { ctx.save(); ctx.translate(g.x, g.y); Sprites.drawGem(ctx, g.col, 16, time, g.ph); ctx.restore(); }
    for (const r of world.rings) if (r.x > view.l - 100 && r.x < view.r + 100) { ctx.save(); ctx.translate(r.x, r.y); Sprites.drawRing(ctx, r, time); ctx.restore(); }
    drawFriends(G, view, time, night);
    if (typeof Games !== 'undefined') Games.draw(ctx, time, view);
    if (G.foal) { G.foal.draw(ctx, time); }
    if (!G.butterflies.hide) for (const b of G.butterflies.list) if (b.x > view.l && b.x < view.r) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(clamp(b.vx * .004, -.5, .5)); Sprites.drawButterfly(ctx, b); ctx.restore(); }
    for (const fl of G.birds.flocks) if (fl.x > view.l - 200 && fl.x < view.r + 200 && fl.y > view.t && fl.y < view.b) for (let i = 0; i < fl.n; i++) { ctx.save(); ctx.translate(fl.x - i * 26 * fl.dir + (i % 2) * 6, fl.y + i * 14 - (i % 2) * 22); if (fl.dir < 0) ctx.scale(-1, 1); Sprites.drawBird(ctx, { s: 1.2, flap: fl.t * 9 + i, col: fl.col }); ctx.restore(); }
    for (const s of world.stormClouds) if (s.x > view.l - 200 && s.x < view.r + 200) { ctx.save(); ctx.translate(s.x, s.y); ctx.globalAlpha = s.happy ? clamp(s.life / 6, 0, 1) : 1; Sprites.drawStormCloud(ctx, s, time); ctx.restore(); }
    for (const f of G.fish.list) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(Math.atan2(f.vy, f.vx)); ctx.fillStyle = f.col; ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-13, -5); ctx.lineTo(-13, 5); ctx.closePath(); ctx.fill(); ctx.restore(); }
    for (const p of players) p.drawTrail(ctx);
    for (const p of players) p.drawShadow(ctx);
    for (const p of players) { p.draw(ctx, time); if (G.settings.labels || players.length > 1) label(p.look.name, p.x, p.y - 100, 16, p.id === 2 ? '#7fd0ff' : '#fff'); }
    drawUnderwaterTint(G, view, time);
    drawRain(G, view, weather, alt);
    G.particles.draw(ctx, cam);
    ctx.restore();
    if (world.snow > .15 && alt < .6) drawSnowfall(time, cam, world.snow * (1 - alt));

    /* ---------------- lighting ---------------- */
    const dark = Math.max(night * (1 - alt * .3), weather.cloud * .3 * (1 - alt));
    if (dark > .01) {
      ctx.globalCompositeOperation = 'multiply';
      const nb = night * (1 - alt * .3), cb = weather.cloud * .3 * (1 - night) * (1 - alt);
      ctx.fillStyle = `rgba(${lerp(255, 140, nb) - cb * 50 | 0},${lerp(255, 145, nb) - cb * 45 | 0},${lerp(255, 215, nb) - cb * 25 | 0},1)`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    const warm = (Math.max(0, 1 - Math.abs(tod - .78) / .09) + Math.max(0, 1 - Math.abs(tod - .26) / .07)) * (1 - weather.cloud) * (1 - alt);
    if (warm > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,90,${warm * .55})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }

    /* glow pass: things that shine stay bright at night */
    const glowK = Math.max(night, alt * .6);
    if (glowK > .05) {
      ctx.save(); cam.apply(ctx);
      ctx.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, col, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, withAlpha(col, a)); g.addColorStop(1, withAlpha(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
      for (const s of world.stars) if (!s.taken && s.x > view.l && s.x < view.r && s.y > view.t && s.y < view.b) glow(s.x, s.y + Math.sin(time * 2 + s.ph) * 4, s.r * 2.2, '#ffe68a', .5 * glowK);
      for (const f of world.fallen) if (f.state === 'down' || f.state === 'rising') glow(f.x, f.y, 70, '#fff2a0', .5 * glowK);
      for (const c of world.crystals) if (c.x > view.l - 100 && c.x < view.r + 100) glow(c.x, c.y - 24 * c.s, 60 + c.lit * 60, c.col, (.18 + c.lit * .45) * glowK);
      for (const g of world.gems) if (g.shown && !g.taken) glow(g.x, g.y, 50, g.col, .5 * glowK);
      if (world.castle.x > view.l - 400 && world.castle.x < view.r + 400) for (const [dx, dy] of [[0, -300], [-90, -250], [90, -250], [-200, -180], [200, -180], [0, -60]]) glow(world.castle.x + dx, world.castle.y + dy, 60, '#ffd98a', .22 * night);
      for (const p of players) { if (p.magicT > 0) glow(p.x + p.dir * 48, p.y - 74, 90, '#fff2b0', .6 * p.magicT); }
      G.particles.drawGlow(ctx, glowK);
      ctx.restore();
    }
    if (night > .05 && alt < .5) drawSkyMoon(tod, night, horizonY, weather.cloud, alt);

    /* fireflies in the woods and pollen by day, near the ground */
    if (alt < .3) {
      ctx.save(); cam.apply(ctx);
      const woods = smoothstep(-1900, -2600, cam.x);
      G.particles.ensureAmbient(quality === 'low' ? 30 : 70, view);
      if (weather.rain < .5) G.particles.drawAmbient(ctx, view, time, night, dt, Math.max(.25, woods));
      ctx.restore();
    }
    /* vignette */
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .78);
    vg.addColorStop(0, 'rgba(20,10,40,0)'); vg.addColorStop(1, `rgba(20,10,40,${.22 + night * .2})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    if (typeof PostFX !== 'undefined' && quality !== 'low' && G.settings.glow !== false) PostFX.apply(ctx, canvas, W, H, DPR, { night, alt, party: G.partyT > 0 });
    drawArrows(G);
    if (typeof Race !== 'undefined') Race.drawHUD(ctx, W, H);
    Cinematic.draw(ctx, W, H);
  }

  /* ---------- pieces ---------- */
  function drawSunMoon(tod, night, horizonY, cloud, alt) {
    const a = (tod - .25) * TAU;          // sun at the top at midday
    const cx = W / 2 + Math.cos(a) * W * .42, cy = horizonY - 30 + Math.sin(a) * H * .55;
    const sunUp = cy < horizonY + 40;
    if (sunUp && alt < .8) {
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 220);
      g.addColorStop(0, `rgba(255,240,190,${.9 * (1 - cloud * .5) * (1 - alt)})`); g.addColorStop(.25, `rgba(255,220,140,${.35 * (1 - alt)})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 220, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,250,220,${1 - cloud * .4})`; ctx.beginPath(); ctx.arc(cx, cy, 38, 0, TAU); ctx.fill();
    }
  }
  function drawSkyMoon(tod, night, horizonY, cloud, alt) {
    const a = (tod - .25) * TAU;
    const mx = W / 2 - Math.cos(a) * W * .42, my = horizonY - 30 - Math.sin(a) * H * .55;
    if (my < horizonY + 40 && alt < .5) {
      ctx.globalAlpha = night * (1 - cloud * .6) * (1 - alt * 2);
      const g = ctx.createRadialGradient(mx, my, 20, mx, my, 160);
      g.addColorStop(0, 'rgba(255,250,210,.5)'); g.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 160, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff9d8'; ctx.beginPath(); ctx.arc(mx, my, 30, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,190,150,.35)'; for (const [dx, dy, r] of [[-9, -5, 6], [8, 6, 8], [10, -10, 4]]) { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  function drawWeatherRainbow(horizonY, k) {
    ctx.save();
    ctx.globalAlpha = k * .55; ctx.lineWidth = 12;
    const cx = W * .55, cy = horizonY + 80, r0 = Math.min(W, H) * .9;
    RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r0 - i * 12, Math.PI, 0); ctx.stroke(); });
    ctx.restore();
  }

  function drawGround(G, view, night, time, season) {
    season = season || { snow: 0, autumn: 0 };
    const world = G.world;
    const l = Math.max(view.l, world.bounds.left - 400), r = Math.min(view.r, world.bounds.right + 400);
    if (view.t > 400) return;          // looking at nothing but sky
    const step = 14;
    /* the grass gradient blends across zones with stops at each border */
    const gg = ctx.createLinearGradient(l, 0, r, 0);
    const stops = [l];
    for (const z of ZONES.slice(1)) { if (z.x0 - 260 > l && z.x0 - 260 < r) stops.push(z.x0 - 260); if (z.x0 + 260 > l && z.x0 + 260 < r) stops.push(z.x0 + 260); }
    stops.push(r);
    const grassAt = (x) => { let c = zoneMix(x, 'grass'); if (season.autumn > .01) c = mixHex(c, '#c9b04a', season.autumn * .4); if (season.snow > .01) c = mixHex(c, '#f1f6fb', season.snow * .9); return mixHex(c, '#14203a', night * .7); };
    for (const x of stops) gg.addColorStop(clamp((x - l) / (r - l), 0, 1), grassAt(x));
    ctx.beginPath();
    ctx.moveTo(l, view.b + 400);
    for (let x = l; x <= r; x += step) ctx.lineTo(x, world.groundY(x));
    ctx.lineTo(r, view.b + 400); ctx.closePath();
    ctx.fillStyle = gg; ctx.fill();
    /* soil beneath, and rock and snow up the mountain */
    ctx.save(); ctx.clip();
    const sg = ctx.createLinearGradient(0, -1250, 0, 160);
    sg.addColorStop(0, mixHex('#ffffff', '#3a4070', night * .7)); sg.addColorStop(.2, mixHex('#e9e4f6', '#3a4070', night * .7)); sg.addColorStop(.36, mixHex('#9a86c8', '#2a2450', night * .7, .95)); sg.addColorStop(.5, 'rgba(154,134,200,0)'); sg.addColorStop(1, 'rgba(154,134,200,0)');
    ctx.fillStyle = sg; ctx.fillRect(l, -1300, r - l, 1500);
    const soil = ctx.createLinearGradient(0, 0, 0, 260);
    soil.addColorStop(0, 'rgba(120,90,60,0)'); soil.addColorStop(.35, mixHex('#8a6a4a', '#1a1420', night * .7, .9)); soil.addColorStop(1, mixHex('#5a4030', '#100c18', night * .7));
    ctx.beginPath(); ctx.moveTo(l, view.b + 400);
    for (let x = l; x <= r; x += step) ctx.lineTo(x, world.groundY(x) + 34);
    ctx.lineTo(r, view.b + 400); ctx.closePath();
    ctx.fillStyle = soil; ctx.fill();
    ctx.restore();
    /* grass tufts along the line */
    if (G.cam.zoom > .6) {
      ctx.strokeStyle = mixHex(mixHex(mixHex('#a8e07a', '#e0c060', season.autumn * .5), '#ffffff', season.snow * .9), '#25304a', night * .7, .8); ctx.lineWidth = 2; ctx.lineCap = 'round';
      const rng = mulberry32(7);
      ctx.beginPath();
      for (let x = Math.floor(l / 18) * 18; x <= r; x += 18) {
        if (world.isWater(x)) continue;
        const gy = world.groundY(x), h = 6 + ((x * 7919) % 11), lean = Math.sin(time * 1.5 + x * .05) * 2;
        ctx.moveTo(x, gy + 2); ctx.lineTo(x + lean, gy - h);
      }
      ctx.stroke();
      void rng;
    }
    /* the waterfall */
    const wf = world.waterfall;
    if (wf.x > view.l - 100 && wf.x < view.r + 100) {
      ctx.save();
      const top = wf.top, bottom = wf.bottom;
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, 'rgba(200,235,255,.75)'); g.addColorStop(1, 'rgba(230,245,255,.95)');
      ctx.fillStyle = g; ctx.fillRect(wf.x - 22, top, 44, bottom - top);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const t = (time * 1.6 + i * .2) % 1; const y0 = top + (bottom - top) * t; ctx.beginPath(); ctx.moveTo(wf.x - 16 + i * 8, y0); ctx.lineTo(wf.x - 16 + i * 8 + 1, y0 + 30); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(wf.x - 30 + i * 12, bottom - 2 + Math.sin(time * 6 + i) * 3, 8 + (i % 2) * 4, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }

  function drawLake(G, view, night, time) {
    const world = G.world;
    if (view.r < LAKE.x0 || view.l > LAKE.x1 || view.t > 300) return;
    const l = Math.max(view.l, LAKE.x0), r = Math.min(view.r, LAKE.x1);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(l, LAKE.y);
    for (let x = l; x <= r; x += 14) ctx.lineTo(x, Math.max(LAKE.y, world.groundY(x)));
    ctx.lineTo(r, LAKE.y); ctx.closePath();
    const g = ctx.createLinearGradient(0, LAKE.y, 0, LAKE.y + 700);
    g.addColorStop(0, mixHex('#9fe0ff', '#1a2a5a', night * .7, .45)); g.addColorStop(.3, mixHex('#4fb0e8', '#12204a', night * .7, .62)); g.addColorStop(1, mixHex('#1f5fa8', '#0a1030', night * .7, .82));
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    /* reflection of the sky and glitter */
    ctx.globalAlpha = .35;
    ctx.fillStyle = mixHex('#ffffff', '#1a2a5a', night * .7);
    for (let i = 0; i < 40; i++) { const x = LAKE.x0 + ((i * 373 + time * 25) % (LAKE.x1 - LAKE.x0)); const y = LAKE.y + 8 + (i * 53) % 90; const w = 14 + (i * 7) % 30; ctx.globalAlpha = .18 + .14 * Math.sin(time * 2 + i); ctx.fillRect(x, y, w, 2); }
    ctx.globalAlpha = 1;
    /* sun rays slanting down through the water */
    if (quality !== 'low') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const x0 = LAKE.x0 + 250 + i * 330 + Math.sin(time * .3 + i) * 40;
        if (x0 < l - 300 || x0 > r + 300) continue;
        const rg = ctx.createLinearGradient(0, LAKE.y, 0, LAKE.y + 600);
        rg.addColorStop(0, `rgba(255,255,230,${.13 * (1 - night)})`); rg.addColorStop(1, 'rgba(255,255,230,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x0, LAKE.y); ctx.lineTo(x0 + 70, LAKE.y); ctx.lineTo(x0 + 260, LAKE.y + 620); ctx.lineTo(x0 + 120, LAKE.y + 620); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    if (world.ice > .02) drawIce(G, l, r, night, time);
    else {
      ctx.strokeStyle = mixHex('#ffffff', '#6a80c0', night * .6, .8); ctx.lineWidth = 2;
      ctx.beginPath(); for (let x = l; x <= r; x += 10) { const y = LAKE.y + Math.sin(x * .03 + time * 2) * 1.5; x === l ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    }
  }

  /* the lake floor: sand, seaweed, coral, shells, the chest, jellyfish, fish, Marina */
  function drawLakeBed(G, view, night, time) {
    const world = G.world;
    if (view.r < LAKE.x0 || view.l > LAKE.x1 || view.b < LAKE.y) return;
    const l = Math.max(view.l, LAKE.x0), r = Math.min(view.r, LAKE.x1);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(l, world.groundY(l));
    for (let x = l; x <= r; x += 14) ctx.lineTo(x, world.groundY(x) - 2);
    for (let x = r; x >= l; x -= 14) ctx.lineTo(x, world.groundY(x) + 60);
    ctx.closePath(); ctx.fillStyle = mixHex('#f0dca8', '#2a2440', night * .6); ctx.fill();
    ctx.fillStyle = mixHex('#e0c890', '#221c38', night * .6);
    for (let x = Math.floor(l / 37) * 37; x < r; x += 37) { const y = world.groundY(x); if (y < LAKE.y + 40) continue; ctx.beginPath(); ctx.ellipse(x, y + 8 + (x % 3) * 4, 4 + (x % 5), 2.5, 0, 0, TAU); ctx.fill(); }
    for (const rk of world.rocks) if (world.isWater(rk.x) && rk.x > l - 100 && rk.x < r + 100) { const bed = world.groundY(rk.x); const g = ctx.createLinearGradient(0, rk.y, 0, bed); g.addColorStop(0, mixHex('#9aa3b8', '#3a3a5a', night * .6)); g.addColorStop(1, mixHex('#6a7890', '#22223a', night * .6)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(rk.x - rk.w * .42, rk.y); ctx.quadraticCurveTo(rk.x - rk.w * .55, (rk.y + bed) / 2, rk.x - rk.w * .7, bed + 4); ctx.lineTo(rk.x + rk.w * .7, bed + 4); ctx.quadraticCurveTo(rk.x + rk.w * .5, (rk.y + bed) / 2, rk.x + rk.w * .42, rk.y); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(90,160,110,.4)'; for (let y = rk.y + 60; y < bed - 20; y += 70) { ctx.beginPath(); ctx.ellipse(rk.x + Math.sin(y) * rk.w * .2, y, rk.w * .18, 9, 0, 0, TAU); ctx.fill(); } }
    for (const s of world.seaweed) if (s.x > l - 40 && s.x < r + 40) { ctx.save(); ctx.translate(s.x, s.y); Sprites.drawSeaweed(ctx, s, time); ctx.restore(); }
    for (const c of world.coral) if (c.x > l - 60 && c.x < r + 60) { ctx.save(); ctx.translate(c.x, c.y + 2); Sprites.drawCoral(ctx, c); ctx.restore(); }
    const ch = world.chest; if (ch.x > l - 60 && ch.x < r + 60) { ctx.save(); ctx.translate(ch.x, ch.y + 2); Sprites.drawChest(ctx, ch, time); ctx.restore(); }
    for (const s of world.shells) if (s.state !== 'hidden' && s.x > l - 40 && s.x < r + 40) { ctx.save(); ctx.translate(s.x, s.y); Sprites.drawShell(ctx, s, time); ctx.restore(); }
    const m = G.friends.get('marina');
    if (m && m.x > l - 100 && m.x < r + 100) {
      ctx.save(); ctx.translate(m.x, m.y + 30); if (m.dir > 0) ctx.scale(-1, 1); Sprites.drawMermaid(ctx, { s: 1.15, time: m.time, blink: m.blink }); ctx.restore();
      /* her grotto: an arch of rocks */
      ctx.fillStyle = mixHex('#7a8098', '#2a2848', night * .6);
      for (const [dx, dy, rr_] of [[-110, 0, 34], [-120, -40, 26], [-95, -78, 22], [-50, -100, 20], [0, -110, 22], [50, -100, 20], [95, -78, 22], [120, -40, 26], [110, 0, 34]]) { ctx.beginPath(); ctx.arc(world.grotto.x + dx, world.grotto.y + dy, rr_, 0, TAU); ctx.fill(); }
    }
    for (const j of world.jellies) if (j.x > l - 40 && j.x < r + 40) { ctx.save(); ctx.translate(j.x, j.y); Sprites.drawJelly(ctx, j, time); ctx.restore(); }
    for (const sc of G.fish.schools) if (sc.x > l - 80 && sc.x < r + 80) for (const f of sc.fish) { ctx.save(); ctx.translate(sc.x + f.dx + Math.sin(time * 2 + f.ph) * 6, sc.y + f.dy + Math.cos(time * 1.7 + f.ph) * 4); if (sc.vx < 0) ctx.scale(-1, 1); Sprites.drawSwimFish(ctx, sc.col, time + f.ph); ctx.restore(); }
    ctx.restore();
  }

  function drawIce(G, l, r, night, time) {
    const world = G.world, k = world.ice;
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.3, 0, 1);
    const seg = (a, b) => {
      if (b <= a) return;
      const g = ctx.createLinearGradient(0, LAKE.y - 4, 0, LAKE.y + 18);
      g.addColorStop(0, mixHex('#ffffff', '#8a9ad0', night * .5)); g.addColorStop(1, mixHex('#bfe6f6', '#4a5a90', night * .5, .85));
      ctx.fillStyle = g; ctx.fillRect(a, LAKE.y - 4, b - a, 22);
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2;
      for (let x = Math.ceil(a / 160) * 160; x < b; x += 160) { ctx.beginPath(); ctx.moveTo(x, LAKE.y - 2); ctx.lineTo(x + 20, LAKE.y + 6); ctx.lineTo(x + 12, LAKE.y + 14); ctx.stroke(); }
      for (let x = Math.ceil(a / 90) * 90; x < b; x += 90) { const tw = .5 + .5 * Math.sin(time * 3 + x); ctx.fillStyle = `rgba(255,255,255,${tw})`; starPath(ctx, x + 30, LAKE.y - 3, 2.5 + tw * 2); ctx.fill(); }
    };
    seg(l, Math.min(r, ICE_HOLE.x0)); seg(Math.max(l, ICE_HOLE.x1), r);
    /* the hole: open water with a ring of snow */
    if (ICE_HOLE.x1 > l && ICE_HOLE.x0 < r) { ctx.fillStyle = 'rgba(255,255,255,.9)'; for (const x of [ICE_HOLE.x0, ICE_HOLE.x1]) { ctx.beginPath(); ctx.ellipse(x, LAKE.y, 10, 5, 0, 0, TAU); ctx.fill(); } }
    ctx.restore();
  }

  function drawUnderwaterTint(G, view, time) {
    const world = G.world;
    if (view.r < LAKE.x0 || view.l > LAKE.x1 || view.b < LAKE.y) return;
    if (!G.players.some(p => p.state === 'swim')) return;
    const l = Math.max(view.l, LAKE.x0), r = Math.min(view.r, LAKE.x1);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(l, LAKE.y);
    for (let x = l; x <= r; x += 20) ctx.lineTo(x, Math.max(LAKE.y, world.groundY(x)));
    ctx.lineTo(r, LAKE.y); ctx.closePath();
    ctx.fillStyle = 'rgba(40,130,210,.2)'; ctx.fill();
    ctx.restore();
  }

  function drawSnowfall(time, cam, k) {
    ctx.save(); ctx.fillStyle = '#fff';
    const n = quality === 'low' ? 60 : 150;
    for (let i = 0; i < n; i++) {
      const sp = 30 + (i % 7) * 9;
      const x = (((i * 97.3 + Math.sin(time * .8 + i) * 30 + time * 12 - cam.x * .25) % W) + W) % W;
      const y = (((i * 53.1 + time * sp - cam.y * .25) % H) + H) % H;
      ctx.globalAlpha = k * (.5 + (i % 3) * .2);
      ctx.beginPath(); ctx.arc(x, y, 1.2 + (i % 3) * .9, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* draw a character with a soft rim of light on the side facing the sun or moon.
     fn(ctx) draws it in the current local frame; the box is [-ox,-oy,w,h]. */
  function rimLit(c, w, h, ox, oy, dir, fn) {
    if (quality === 'low' || !canvas || (typeof G !== 'undefined' && G.settings && G.settings.rim === false)) return false;
    const m = c.getTransform(); const sc = Math.hypot(m.a, m.b);
    const pw = Math.ceil(w * sc), ph = Math.ceil(h * sc);
    if (pw < 16 || pw > 1600 || ph > 1600) return false;
    if (!rimA) { rimA = document.createElement('canvas'); rimB = document.createElement('canvas'); }
    if (rimA.width < pw || rimA.height < ph) { rimA.width = rimB.width = Math.max(pw, rimA.width); rimA.height = rimB.height = Math.max(ph, rimA.height); }
    const a = rimA.getContext('2d'), b = rimB.getContext('2d');
    a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, pw + 2, ph + 2);
    a.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    fn(a);
    /* light colour and side */
    const dusk = Math.max(0, 1 - Math.abs(curTod - .76) / .08) + Math.max(0, 1 - Math.abs(curTod - .26) / .07);
    let col = curNight > .5 ? '#b8c8ff' : dusk > .2 ? '#ffb070' : '#fff4dc';
    if (curUnder) col = '#aee6ff';
    const alpha = curNight > .5 ? .5 : dusk > .2 ? .85 : .45;
    const sunSide = Math.cos((curTod - .25) * TAU) > 0 ? 1 : -1;
    const lx = sunSide * dir;
    const d = 2.6 * sc;
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, pw + 2, ph + 2);
    b.globalCompositeOperation = 'source-over'; b.drawImage(rimA, 0, 0);
    b.globalCompositeOperation = 'source-in'; b.fillStyle = col; b.fillRect(0, 0, pw, ph);
    b.globalCompositeOperation = 'destination-out'; b.drawImage(rimA, -lx * d * .75, d * .75);
    b.globalCompositeOperation = 'source-over';
    c.drawImage(rimA, 0, 0, pw, ph, -ox, -oy, pw / sc, ph / sc);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= alpha;
    c.drawImage(rimB, 0, 0, pw, ph, -ox, -oy, pw / sc, ph / sc);
    c.restore();
    return true;
  }

  function drawRainbowBridge(G, view, time) {
    const world = G.world;
    const a = world.summit, b = world.rainbowEnd;
    const ax = a.x, ay = a.y - 10, bx = b.x, by = b.y - 20;
    if (Math.max(ax, bx) < view.l || Math.min(ax, bx) > view.r) return;
    const k = world.rainbowRestored;
    ctx.save();
    ctx.lineCap = 'round';
    const cx = (ax + bx) / 2, cy = Math.min(ay, by) - 800;
    for (let i = 0; i < 7; i++) {
      const col = mixHex('#8a8aa0', RAINBOW[i], k);
      ctx.strokeStyle = col; ctx.globalAlpha = lerp(.35, .75, k); ctx.lineWidth = 22;
      ctx.beginPath(); ctx.moveTo(ax, ay + i * 18); ctx.quadraticCurveTo(cx, cy + i * 18, bx, by + i * 18); ctx.stroke();
    }
    if (k > .5) { ctx.globalAlpha = k; for (let i = 0; i < 10; i++) { const t = (time * .12 + i * .1) % 1; const u = 1 - t; const x = u * u * ax + 2 * u * t * cx + t * t * bx, y = u * u * ay + 2 * u * t * cy + t * t * by; ctx.fillStyle = 'rgba(255,255,255,.85)'; starPath(ctx, x, y + 60, 6 + Math.sin(time * 3 + i) * 2); ctx.fill(); } }
    ctx.restore();
  }

  function drawConstellation(G, view, time) {
    const C = G.world.constellation;
    if (C.pts[0].y > view.b + 300 || C.pts[0].y < view.t - 800) return;
    const q = Quests.current(), active = q && q.key === 'moon' && Quests.status() === 'active';
    ctx.save();
    ctx.strokeStyle = 'rgba(200,220,255,.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
    ctx.beginPath();
    for (let i = 0; i < C.pts.length; i++) { const p = C.pts[i]; if (i && !(C.pts[i - 1].lit && p.lit)) { ctx.moveTo(p.x, p.y); continue; } i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.stroke(); ctx.setLineDash([]);
    C.pts.forEach((p, i) => {
      const next = active && i === C.lit;
      const pulse = next ? .7 + .3 * Math.sin(time * 6) : 1;
      const r = p.lit ? 22 : next ? 18 * pulse + 4 : 12;
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * 3);
      g.addColorStop(0, p.lit ? 'rgba(255,255,255,.8)' : next ? `rgba(255,240,180,${.6 * pulse})` : 'rgba(200,210,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, TAU); ctx.fill();
      starPath(ctx, p.x, p.y, r); ctx.fillStyle = p.lit ? '#fff' : next ? '#fff2a8' : 'rgba(210,220,255,.6)'; ctx.fill();
    });
    if (C.done) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); C.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); label('The Unicorn', C.pts[2].x, C.pts[4].y - 60, 22, '#fff'); }
    ctx.restore();
  }

  function drawFriends(G, view, time, night) {
    for (const f of G.friends.list) {
      if (f.hidden || f.state === 'riding' || f.x < view.l - 150 || f.x > view.r + 150) continue;
      ctx.save(); ctx.translate(f.x, f.y);
      if (f.dir > 0) ctx.scale(-1, 1);
      const o = { s: 1.1, blink: f.blink, time: f.time, hop: f.hop, tilt: f.tilt, graze: f.graze, throat: f.throat, flap: f.flap, fly: f.fly, hiccup: f.hiccup, lamb: f.key === 'puff' };
      switch (f.def.kind) {
        case 'mermaid': break;
        case 'bunny': Sprites.drawBunny(ctx, o); break;
        case 'fox': Sprites.drawFox(ctx, o); break;
        case 'owl': Sprites.drawOwl(ctx, o); break;
        case 'deer': Sprites.drawDeer(ctx, o); break;
        case 'frog': Sprites.drawFrog(ctx, o); break;
        case 'swan': Sprites.drawSwan(ctx, o); break;
        case 'sheep': case 'lamb': Sprites.drawSheep(ctx, o); break;
        case 'dragon': Sprites.drawDragon(ctx, o); break;
      }
      ctx.restore();
      const b = Quests.bubble(f.key);
      if (b) {
        const by = f.y - 78 + Math.sin(time * 4) * 4;
        ctx.fillStyle = b === '!' ? '#ffd23f' : '#7fd0ff'; ctx.beginPath(); ctx.arc(f.x, by, 15, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2a4a'; ctx.font = `900 22px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b, f.x, by + 1);
      }
      const near = G.players.some(p => Math.abs(p.x - f.x) < 240 && Math.abs(p.y - f.y) < 200);
      if (G.settings.labels || near) label(f.def.name, f.x, f.y - 60 - (b ? 34 : 0), 14, '#fff');
    }
  }

  function drawRain(G, view, weather, alt) {
    if (weather.rain < .02 || alt > .7) return;
    ctx.save();
    ctx.strokeStyle = `rgba(200,225,255,${.45 * weather.rain * (1 - alt)})`; ctx.lineWidth = 1.5;
    const t = G.time;
    ctx.beginPath();
    const n = quality === 'low' ? 60 : 140;
    for (let i = 0; i < n; i++) {
      const x = view.l + ((i * 137.7 + t * 40) % (view.r - view.l)), y = view.t + ((i * 89.3 + t * 900) % (view.b - view.t));
      ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 22);
    }
    ctx.stroke();
    ctx.restore();
  }

  function label(text, x, y, size = 14, col = '#fff') {
    ctx.save();
    ctx.font = `900 ${size}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = size * .28; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,20,60,.55)';
    ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* the big quest arrow, and an arrow to player 2 */
  function drawArrows(G) {
    const cam = G.cam;
    const targets = [];
    const qt = Quests.target();
    if (qt && G.settings.arrow !== false && !Dialog.active) targets.push({ x: qt.x, y: qt.y, col: '#ffd23f', label: qt.label, icon: (Quests.card() || {}).icon });
    if (G.players[1]) targets.push({ x: G.players[1].x, y: G.players[1].y - 40, col: '#7fd0ff', label: G.players[1].look.name, p2: true });
    for (const t of targets) {
      const [sx, sy] = cam.toScreen(t.x, t.y);
      const pad = 70, onScreen = sx > pad && sx < W - pad && sy > pad + 80 && sy < H - pad;
      const pulse = 1 + .1 * Math.sin(G.time * 5);
      if (onScreen) {
        if (t.p2) continue;
        const d = dist(G.player.x, G.player.y, t.x, t.y);
        if (d < 90) continue;
        const y = sy - 60 - Math.abs(Math.sin(G.time * 4)) * 14;
        ctx.save(); ctx.translate(sx, y);
        ctx.fillStyle = t.col; ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(-16, 4); ctx.lineTo(16, 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(60,30,80,.5)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
      } else {
        const cx = W / 2, cy = H / 2;
        const dx = sx - cx, dy = sy - cy, ang = Math.atan2(dy, dx);
        const m = Math.min((W / 2 - pad) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - pad) / Math.abs(Math.sin(ang) || 1e-6));
        const ex = cx + Math.cos(ang) * m, ey = clamp(cy + Math.sin(ang) * m, 130, H - 90);
        ctx.save(); ctx.translate(ex, ey);
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, TAU); ctx.fill();
        ctx.strokeStyle = t.col; ctx.lineWidth = 4; ctx.stroke();
        if (t.icon) ctx.drawImage(Sprites.icon(t.icon, G.player.look, 40), -20, -20, 40, 40);
        ctx.rotate(ang);
        ctx.fillStyle = t.col; ctx.beginPath(); ctx.moveTo(52 * pulse, 0); ctx.lineTo(36 * pulse, -14); ctx.lineTo(36 * pulse, 14); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(60,30,80,.5)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        const wd = Math.round(dist(G.player.x, G.player.y, t.x, t.y) / 10);
        label(t.label + (t.p2 ? '' : ` · ${wd}`), ex, ey + 50, 13, '#fff');
      }
    }
  }

  function snapshot() { return canvas; }

  return { init, resize, frame, setQuality, getFps, nightAmount, snapshot, label, rimLit, getQuality: () => quality };
})();
