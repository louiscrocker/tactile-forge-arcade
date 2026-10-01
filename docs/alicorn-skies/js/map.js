/* ============================================================
   map.js — the magic map
   ============================================================
   A picture of the whole land: the four ground zones, the Cloud
   Kingdom above, the Star Sky and the Moon at the top.  Friends
   sit where they live, the gold star marks the quest, and the
   alicorn's own face shows where she is.  Tap a landmark to fly
   there.
   ============================================================ */
'use strict';

const MapView = (function () {
  /* world → map: x spans the width; y is squashed into bands */
  function toMap(wx, wy, w, h) {
    const mx = (wx + 7000) / 14000 * w;
    let my;
    if (wy > -600) my = h * .96 - (600 + Math.min(wy, 200)) / 800 * h * .28;          // ground band (bottom 28%)
    else if (wy > -1500) my = h * .68 - (-600 - wy) / 900 * h * .1;                    // open sky
    else if (wy > -2900) my = h * .58 - (-1500 - wy) / 1400 * h * .22;                 // cloud kingdom
    else my = h * .36 - (-2900 - wy) / 1800 * h * .30;                                 // star sky
    return [mx, my];
  }

  function landmarks(G) {
    const W = G.world;
    const L = [
      { name: 'Starlight Castle', x: W.castle.x + 200, y: W.castle.y, icon: 'castle' },
      { name: 'Whispering Woods', x: W.bigOak.x, y: W.bigOak.y, icon: 'tree' },
      { name: 'Crystal Lake', x: 3400, y: LAKE.y, icon: 'lake' },
      { name: 'The waterfall', x: 4800, y: LAKE.y, icon: 'waterfall' },
      { name: "Ember's cave", x: W.cave.x - 160, y: W.cave.y, icon: 'cave' },
      { name: 'Rainbow Mountain', x: W.summit.x, y: W.summit.y, icon: 'mountain' },
      { name: 'Cloud Castle', x: W.cloudCastle.x, y: W.cloudCastle.y, icon: 'cloudcastle' },
      { name: "Rainbow's End", x: W.rainbowEnd.x, y: W.rainbowEnd.y, icon: 'cloud' },
      { name: 'The Moon', x: W.moon.x, y: W.moon.y - W.moon.r, icon: 'moon' },
      { name: 'The Unicorn stars', x: W.constellation.pts[2].x, y: W.constellation.pts[2].y + 100, icon: 'stars' }
    ];
    for (const c of W.clouds) if (!c.castle && !c.name) L.push({ name: 'a cloud', x: c.x, y: c.y, icon: 'smallcloud' });
    return L;
  }

  function draw(ctx, w, h, G) {
    const W = G.world;
    ctx.clearRect(0, 0, w, h);
    /* parchment sky bands */
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1c1a4a'); sky.addColorStop(.32, '#3e3a8a'); sky.addColorStop(.42, '#8fb8ff'); sky.addColorStop(.7, '#bfe3ff'); sky.addColorStop(1, '#dff3ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    /* stars in the star band */
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 90; i++) { const x = (i * 97.3) % w, y = (i * 53.7) % (h * .34); ctx.globalAlpha = .4 + (i % 5) * .12; ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * .6, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    /* ground zones */
    for (const z of ZONES) {
      const [x0] = toMap(z.x0, 0, w, h), [x1] = toMap(z.x1, 0, w, h);
      ctx.fillStyle = z.grass;
      ctx.beginPath(); ctx.moveTo(x0, h);
      for (let x = x0; x <= x1; x += 6) { const wx = x / w * 14000 - 7000; const [, y] = toMap(wx, W.groundY(wx), w, h); ctx.lineTo(x, y); }
      ctx.lineTo(x1, h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.font = `900 ${Math.round(h * .03)}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(z.name, (x0 + x1) / 2, h * .955);
    }
    /* lake */
    { const [x0, y0] = toMap(LAKE.x0, LAKE.y, w, h), [x1] = toMap(LAKE.x1, LAKE.y, w, h); ctx.fillStyle = '#5fb8f0'; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, y0 + 3, (x1 - x0) / 2, h * .02, 0, 0, TAU); ctx.fill(); }
    /* cloud band label and platforms */
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (const c of W.clouds) { const [x, y] = toMap(c.x, c.y, w, h); const r = c.w / 14000 * w; for (const [dx, rr_] of [[-r * .5, r * .5], [0, r * .7], [r * .5, r * .5]]) { ctx.beginPath(); ctx.arc(x + dx, y, Math.max(6, rr_), 0, TAU); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `900 ${Math.round(h * .03)}px ${UI_FONT}`; ctx.textAlign = 'left';
    ctx.fillText('Cloud Kingdom', 14, h * .4); ctx.fillText('Star Sky', 14, h * .06);
    /* moon and constellation */
    { const [x, y] = toMap(W.moon.x, W.moon.y, w, h); ctx.save(); ctx.translate(x, y); ctx.scale(.075 * h / 100, .075 * h / 100); Sprites.drawMoon(ctx, W.moon, 0); ctx.restore(); }
    { const pts = W.constellation.pts.map(p => toMap(p.x, p.y, w, h)); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.fillStyle = '#fff'; for (const [x, y] of pts) { starPath(ctx, x, y, 4); ctx.fill(); } }
    /* rainbow bridge */
    { const [ax, ay] = toMap(W.summit.x, W.summit.y, w, h), [bx, by] = toMap(W.rainbowEnd.x, W.rainbowEnd.y, w, h); ctx.lineWidth = 3; RAINBOW.forEach((c, i) => { ctx.strokeStyle = mixHex('#9a9ab0', c, W.rainbowRestored); ctx.beginPath(); ctx.moveTo(ax, ay + i * 2); ctx.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - h * .12 + i * 2, bx, by + i * 2); ctx.stroke(); }); }
    /* landmarks */
    ctx.textAlign = 'center';
    for (const l of landmarks(G)) {
      if (l.icon === 'smallcloud') continue;
      const [x, y] = toMap(l.x, l.y, w, h);
      drawLandmark(ctx, l.icon, x, y, h * .045);
      ctx.font = `900 ${Math.round(h * .022)}px ${UI_FONT}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = '#3a2a55';
      const lx = clamp(x, ctx.measureText(l.name).width / 2 + 6, w - ctx.measureText(l.name).width / 2 - 6);
      ctx.strokeText(l.name, lx, y + h * .035); ctx.fillText(l.name, lx, y + h * .035);
    }
    /* friends */
    for (const f of G.friends.list) {
      if (f.hidden || f.state === 'riding') continue;
      const [x, y] = toMap(f.x, f.y, w, h);
      const img = Sprites.icon(f.def.kind, G.player.look, 32);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x, y - 14, 17, 0, TAU); ctx.fill();
      ctx.drawImage(img, x - 14, y - 28, 28, 28);
      if (Quests.bubble(f.key)) { ctx.fillStyle = Quests.bubble(f.key) === '!' ? '#ffd23f' : '#7fd0ff'; ctx.beginPath(); ctx.arc(x + 14, y - 28, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a2a4a'; ctx.font = `900 12px ${UI_FONT}`; ctx.fillText(Quests.bubble(f.key), x + 14, y - 27); }
    }
    /* quest target */
    const t = Quests.target();
    if (t) { const [x, y] = toMap(t.x, t.y, w, h); const pulse = 1 + .15 * Math.sin(performance.now() / 200); ctx.fillStyle = '#ffd23f'; starPath(ctx, x, y - 30, 14 * pulse); ctx.fill(); ctx.strokeStyle = '#c99a1a'; ctx.lineWidth = 2; ctx.stroke(); }
    /* players */
    G.players.forEach((p, i) => {
      const [x, y] = toMap(p.x, p.y, w, h);
      ctx.fillStyle = i ? '#7fd0ff' : '#ff5f9a'; ctx.beginPath(); ctx.arc(x, y - 16, 20, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - 16, 17, 0, TAU); ctx.fill();
      ctx.drawImage(Sprites.icon('alicorn', p.look, 34), x - 17, y - 33, 34, 34);
    });
  }

  function drawLandmark(ctx, icon, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    switch (icon) {
      case 'castle': ctx.fillStyle = '#fff5fa'; ctx.fillRect(-s * .6, -s * .8, s * 1.2, s * .8); ctx.fillStyle = '#c98bff'; for (const dx of [-.6, 0, .6]) { ctx.beginPath(); ctx.moveTo(dx * s - s * .25, -s * .8); ctx.lineTo(dx * s, -s * 1.4); ctx.lineTo(dx * s + s * .25, -s * .8); ctx.fill(); } break;
      case 'tree': ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-s * .1, -s * .6, s * .2, s * .6); ctx.fillStyle = '#4f9a3a'; ctx.beginPath(); ctx.arc(0, -s * .8, s * .5, 0, TAU); ctx.fill(); break;
      case 'lake': ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.ellipse(0, 0, s * .9, s * .3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#4f9a3a'; ctx.beginPath(); ctx.arc(-s * .3, -s * .05, s * .18, 0, TAU); ctx.fill(); break;
      case 'waterfall': ctx.fillStyle = '#bfe8ff'; ctx.fillRect(-s * .15, -s * .9, s * .3, s * .9); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, s * .4, s * .12, 0, 0, TAU); ctx.fill(); break;
      case 'cave': ctx.fillStyle = '#5a5568'; ctx.beginPath(); ctx.arc(0, 0, s * .6, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.arc(0, 0, s * .32, Math.PI, 0); ctx.fill(); break;
      case 'mountain': ctx.fillStyle = '#9a86c8'; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(0, -s * 1.3); ctx.lineTo(s, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-s * .3, -s * .9); ctx.lineTo(0, -s * 1.3); ctx.lineTo(s * .3, -s * .9); ctx.fill(); break;
      case 'cloudcastle': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, s * .9, s * .3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#f6f1ff'; ctx.fillRect(-s * .4, -s * .7, s * .8, s * .7); ctx.fillStyle = '#ff9ad4'; ctx.beginPath(); ctx.moveTo(-s * .45, -s * .7); ctx.lineTo(0, -s * 1.2); ctx.lineTo(s * .45, -s * .7); ctx.fill(); break;
      case 'cloud': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, s * .9, s * .3, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 2; RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, s * .6 - i * s * .07), Math.PI, 0); ctx.stroke(); }); break;
      case 'moon': break;
      case 'stars': break;
    }
    ctx.restore();
  }

  /* which landmark (or friend) was tapped; returns a world position to travel to */
  function hit(px, py, w, h, G) {
    let best = null, bd = h * .09;
    for (const l of landmarks(G)) { const [x, y] = toMap(l.x, l.y, w, h); const d = dist(px, py, x, y - 10); if (d < bd) { bd = d; best = l; } }
    for (const f of G.friends.list) { if (f.hidden || f.state === 'riding') continue; const [x, y] = toMap(f.x, f.y, w, h); const d = dist(px, py, x, y - 14); if (d < bd) { bd = d; best = { name: f.def.name, x: f.x - 80 * (f.dir || 1), y: f.y, friend: f }; } }
    return best;
  }

  return { draw, hit, toMap, landmarks };
})();
