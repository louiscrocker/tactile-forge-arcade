/* ============================================================
   above.js — the child above: a window on the garden
   ============================================================
   While you are underground a strip along the top of the screen
   shows the garden over your head.  The seasons turn, the oak goes
   green and gold and bare, and a child grows up: the sandpit, the
   swing, a snowman, the bike, the treehouse, a kite, a guitar on the
   stump.  This is the thread the whole game hangs on, so the child
   is always visible and always doing something.
   G.yearsAll goes on across generations, so a second life finds a
   grown-up with a small child of their own.
   ============================================================ */
'use strict';

const Above = (function () {
  const { bean } = { bean: (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); } };
  const SEASON = [
    { top: '#8fcdf2', bot: '#dff1f6', grass: '#7fbf4f', leaf: '#6fbf5a', leaf2: '#8fd468', sun: 1 },
    { top: '#6fbcf0', bot: '#cdeef7', grass: '#74b444', leaf: '#3f9a42', leaf2: '#5ab04e', sun: 1 },
    { top: '#a0b8d0', bot: '#f4dcae', grass: '#94a84a', leaf: '#d9902e', leaf2: '#c8562a', sun: .6 },
    { top: '#b8c8d8', bot: '#eef2f6', grass: '#e8eef2', leaf: null, leaf2: null, sun: .3 }
  ];
  const ageOf = (G) => 5 + (G.yearsAll || 1);
  function tree(c, x, y, s, S, t) {
    c.fillStyle = '#5a4230'; c.beginPath(); c.moveTo(x - 7 * s, y); c.lineTo(x - 3.5 * s, y - 34 * s); c.lineTo(x + 3.5 * s, y - 34 * s); c.lineTo(x + 7 * s, y); c.fill();
    c.strokeStyle = '#5a4230'; c.lineWidth = 2.4 * s; c.lineCap = 'round';
    for (const [dx, dy] of [[-24, -48], [22, -50], [-9, -62], [12, -66]]) { c.beginPath(); c.moveTo(x, y - 30 * s); c.lineTo(x + dx * s, y + dy * s); c.stroke(); }
    if (!S.leaf) return;
    for (const [dx, dy, r, k] of [[-22, -50, 19, 0], [20, -52, 21, 1], [0, -68, 22, 0], [-8, -48, 15, 1], [12, -70, 13, 1]]) { c.fillStyle = k ? S.leaf2 : S.leaf; bean(c, x + dx * s + Math.sin(t + dx) * .8, y + dy * s, r * s, r * .82 * s); }
  }
  function house(c, x, y, s) {
    c.fillStyle = '#e8d8c0'; c.fillRect(x, y - 44 * s, 70 * s, 44 * s);
    c.fillStyle = '#a84a32'; c.beginPath(); c.moveTo(x - 6 * s, y - 44 * s); c.lineTo(x + 35 * s, y - 70 * s); c.lineTo(x + 76 * s, y - 44 * s); c.fill();
    c.fillStyle = '#7fa8c8'; for (const [wx, wy] of [[10, -36], [46, -36]]) c.fillRect(x + wx * s, y + wy * s, 14 * s, 12 * s);
    c.fillStyle = '#4a6a4a'; c.fillRect(x + 30 * s, y - 20 * s, 10 * s, 20 * s);
  }
  /* what the child is doing this year */
  function scene(c, y0, w, h, G, t, S, season) {
    const age = ageOf(G), g = h - 16, x0 = w * .46, H = h * .78, yr = G.year;
    const kind = age >= 20 ? 'grown' : age >= 12 ? 'guitar' : age === 11 ? 'kite' : age === 10 ? 'treehouse' : age === 9 ? 'bike' : age === 8 ? 'snowman' : age === 7 ? 'swing' : 'sandpit';
    const winter = season === 3;
    if (kind === 'sandpit') {
      c.fillStyle = '#b08a5a'; c.fillRect(x0 - 40, g - 5, 80, 6); c.fillStyle = '#ecd59a'; bean(c, x0, g - 5, 37, 6);
      c.fillStyle = '#e8503a'; c.beginPath(); c.moveTo(x0 + 24, g - 12); c.lineTo(x0 + 36, g - 12); c.lineTo(x0 + 34, g - 3); c.lineTo(x0 + 26, g - 3); c.fill();
      c.save(); c.translate(x0, g - 3); Critters.child(c, age, { h: H, pose: 'sit', t, dir: 1 }); c.restore();
    } else if (kind === 'swing') {
      c.strokeStyle = '#7a4a2a'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 34, g); c.lineTo(x0, g - h * .78); c.lineTo(x0 + 34, g); c.stroke();
      const a = Math.sin(t * 2.2) * .55, L = h * .55, sx = x0 + Math.sin(a) * L, sy = g - h * .78 + Math.cos(a) * L;
      c.strokeStyle = 'rgba(70,50,30,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, g - h * .78); c.lineTo(sx, sy); c.stroke();
      c.save(); c.translate(sx - 2, sy + 10); c.rotate(-a * .4); Critters.child(c, age, { h: H, pose: 'sit', t, dir: 1 }); c.restore();
    } else if (kind === 'snowman') {
      const sz = winter ? 1 : season === 2 ? .0 : 0;
      c.save(); c.translate(x0 - 30, g); Critters.child(c, age, { h: H, pose: winter ? 'wave' : 'walk', t, dir: 1 }); c.restore();
      if (sz) { c.fillStyle = '#fbfdff'; bean(c, x0 + 26, g - 10, 15, 13); bean(c, x0 + 26, g - 29, 11, 10); bean(c, x0 + 26, g - 44, 8, 8); c.fillStyle = '#e8702a'; c.beginPath(); c.moveTo(x0 + 32, g - 45); c.lineTo(x0 + 42, g - 43); c.lineTo(x0 + 32, g - 42); c.fill(); c.fillStyle = '#222'; bean(c, x0 + 29, g - 47, 1.3, 1.3); c.fillStyle = '#c8362a'; c.fillRect(x0 + 16, g - 38, 20, 3.4); }
      else { c.fillStyle = '#8a6a4a'; bean(c, x0 + 22, g - 2, 9, 3); }
    } else if (kind === 'bike') {
      const x = x0 + Math.sin(t * .5) * w * .2, dir = Math.cos(t * .5) >= 0 ? 1 : -1;
      c.save(); c.translate(x, g); c.scale(dir, 1); Critters.bike(c, h * .48, t, false); c.translate(-h * .05, -h * .22); Critters.child(c, age, { h: H, pose: 'sit', t, dir: 1 }); c.restore();
    } else if (kind === 'treehouse' || kind === 'kite') {
      const tx = w * .77;
      c.fillStyle = '#a06a3a'; c.fillRect(tx - 26, g - h * .72, 52, 24); c.fillStyle = '#7a3a22'; c.beginPath(); c.moveTo(tx - 32, g - h * .72); c.lineTo(tx, g - h * .96); c.lineTo(tx + 32, g - h * .72); c.fill();
      c.fillStyle = '#ffe9a0'; c.fillRect(tx - 8, g - h * .68, 16, 12);
      if (kind === 'treehouse') { c.strokeStyle = '#7a4a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx - 16, g); c.lineTo(tx - 16, g - h * .5); c.moveTo(tx - 8, g); c.lineTo(tx - 8, g - h * .5); for (let k = 1; k < 6; k++) { c.moveTo(tx - 16, g - k * h * .09); c.lineTo(tx - 8, g - k * h * .09); } c.stroke(); c.save(); c.translate(tx - 12, g - (Math.sin(t * .8) * .5 + .5) * h * .3); Critters.child(c, age, { h: H, pose: 'wave', t, dir: -1 }); c.restore(); }
      else { const kx = x0 + 74 + Math.sin(t * .9) * 16, ky = 16 + Math.sin(t * 1.3) * 5; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = .8; c.beginPath(); c.moveTo(x0 + 8, g - H * .6); c.quadraticCurveTo(x0 + 40, g - h * .3, kx, ky); c.stroke(); c.fillStyle = '#e8503a'; c.beginPath(); c.moveTo(kx, ky - 9); c.lineTo(kx + 7, ky); c.lineTo(kx, ky + 11); c.lineTo(kx - 7, ky); c.fill(); c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(kx, ky - 9); c.lineTo(kx + 7, ky); c.lineTo(kx - 7, ky); c.fill(); c.save(); c.translate(x0, g); Critters.child(c, age, { h: H, pose: 'look', t, dir: 1 }); c.restore(); }
    } else if (kind === 'guitar') {
      c.save(); c.translate(w * .16 + 14, g - 12); Critters.child(c, age, { h: H, pose: 'guitar', t, dir: 1 }); c.restore();
      if (Math.floor(t * 1.5) % 3 === 0) { c.fillStyle = '#fff'; c.font = '900 13px sans-serif'; c.fillText('♪', w * .16 + 54 + Math.sin(t) * 8, g - h * .6); }
    } else {
      c.save(); c.translate(x0, g); Critters.child(c, age, { h: H, pose: 'stand', t, dir: 1 }); c.translate(36, 0); Critters.child(c, 6, { h: H * .9, pose: 'walk', t, dir: 1 }); c.restore();
    }
  }
  function draw(ctx, x, y, w, h, G) {
    const t = G.time, season = seasonOf(G.yt || 0), S = SEASON[season], c = ctx;
    c.save();
    rr(c, x, y, w, h, 16); c.fillStyle = '#26190f'; c.fill();
    rr(c, x + 3, y + 3, w - 6, h - 6, 13); c.clip();
    c.translate(x + 3, y + 3); const W = w - 6, H = h - 6;
    const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, S.top); sky.addColorStop(1, S.bot); c.fillStyle = sky; c.fillRect(0, 0, W, H);
    if (S.sun > .5) { c.fillStyle = 'rgba(255,244,190,.95)'; bean(c, W * .86, H * .22, 11, 11); }
    /* the wood behind, the house */
    c.fillStyle = 'rgba(70,110,80,.45)'; for (let k = 0; k < 14; k++) bean(c, k / 13 * W, H - 22 - (k * 7 % 9), 26, 20);
    house(c, W * .55, H - 16, 1 * Math.min(1, H / 96));
    const g = H - 16;
    tree(c, W * .77, g, Math.min(1.5, H / 66), S, t * .6);
    c.fillStyle = S.grass; c.fillRect(0, g, W, 20);
    if (season === 3) { c.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 26; k++) bean(c, ((k * 37.1 + t * 9) % W), ((k * 19.3 + t * 26) % H), 1.2, 1.2); }
    /* the stump, crumbling year by year; and you, under it, a little glowing dot */
    const yr = clamp(G.year || 1, 1, 8), stW = 40, stH = 16 - yr * .9, sx = W * .16;
    c.fillStyle = '#6a5038'; c.fillRect(sx - stW / 2, g - stH, stW, stH); c.fillStyle = '#c8a070'; bean(c, sx, g - stH, stW / 2, 3.4);
    if (yr >= 5) { c.fillStyle = '#e8e0c8'; bean(c, sx - 12, g - stH + 3, 5, 2); bean(c, sx + 9, g - stH + 5, 4, 1.6); }
    const F = G.forest, u = F && F.under;
    if (u && u.kind === 'mole') { c.fillStyle = '#5a3e28'; for (const q of [.28, .4, .52]) if (u.t > (q - .25) * 14) bean(c, W * q, g + 1, 12, 7); }
    if (u && u.kind === 'badger') { c.save(); c.translate(sx + 34, g - 2); Critters.badger(c, .34, -1, t, true); c.restore(); c.fillStyle = '#6a4a30'; for (let k = 0; k < 5; k++) bean(c, sx + 8 + ((t * 40 + k * 13) % 26), g - 12 - ((t * 60 + k * 19) % 14), 1.6, 1.6); }
    scene(c, 0, W, H, G, t, S, season);
    if (F && F.weather.rain > .05) { c.fillStyle = `rgba(70,84,104,${.34 * F.weather.rain})`; c.fillRect(0, 0, W, H); c.strokeStyle = `rgba(214,230,246,${.75 * F.weather.rain})`; c.lineWidth = 1; c.beginPath(); for (let k = 0; k < 46; k++) { const px = (k * 31.7 + t * 40) % W, py = (k * 17.3 + t * 230) % H; c.moveTo(px, py); c.lineTo(px - 2, py + 8); } c.stroke(); }
    c.restore();
    /* the label */
    const age = ageOf(G), label = `Year ${G.year} · ${SEASONS[season]}`;
    c.save();
    c.font = `800 12px ${UI_FONT}`; const tw = c.measureText(label).width + 16; c.fillStyle = 'rgba(38,25,15,.86)'; rr(c, x + 10, y + 8, tw, 20, 9); c.fill();
    c.fillStyle = '#fff3c0'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(label, x + 18, y + 18.5);
    c.restore();
    /* the year wheel: one bead for each year */
    c.save();
    for (let k = 1; k <= LAST_YEAR; k++) { const bx = x + w - 18 - (LAST_YEAR - k) * 14, by = y + 16; c.fillStyle = k < G.year ? '#ffd23f' : k === G.year ? '#fff' : 'rgba(38,25,15,.5)'; bean(c, bx, by, k === G.year ? 5 : 4, k === G.year ? 5 : 4); if (k === G.year) { c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, 7, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(G.yt, 0, 1)); c.stroke(); } }
    c.restore();
  }
  return { draw, ageOf };
})();
