/* ============================================================
   paint.js — the painted look's textures, baked by code once
   ============================================================
   With the painted look on (the default where WebGL2 works) the
   blocks get brush dabs, chips, moss, brushed steel and rust; the
   house and neighbour walls, the roofs, the pavement, the road,
   the grass verge and the building lot get painted detail laid
   over their flat colours.  The detail textures are mid-grey
   (they only push light and dark around the colour already
   there, with an 'overlay' blend), seamless, painted once on
   ordinary canvases at first use (never willReadFrequently: a
   CPU-backed canvas used as a big pattern re-uploads every
   frame) and laid as patterns in world units.  Painted blocks
   are cached canvases like the classic ones.  The classic look
   (?gfx=classic, or the O key) never comes here, and nothing in
   the game's logic reads from here.  Painted.on() is the switch.
   ============================================================ */
'use strict';

const Painted = (function () {
  const tex = {}, pats = new Map(), blocks = new Map();
  let ctxFor = null, baked = false, forced = false;
  const S = 256;

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  const grey = (v, a) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
  /* draw fn at the 9 wrapped offsets so the texture tiles without seams */
  function wrap(g, fn) { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } }
  function base(g, R, grain) {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { g.fillStyle = grey(R() < .5 ? 90 : 170, R() * grain); g.fillRect(R() * S, R() * S, 1 + (R() < .3 ? 1 : 0), 1); }
  }
  /* short brush strokes: soft light and dark dabs in a direction (radians) with some spread */
  function strokes(g, R, n, len, width, dir, spread, amp) {
    g.lineCap = 'round';
    wrap(g, () => { for (let i = 0; i < n; i++) {
      const x = R() * S, y = R() * S, a = dir + (R() - .5) * spread, l = len * (.5 + R()), light = R() < .5;
      g.strokeStyle = grey(light ? 200 : 60, amp * (.4 + R() * .6)); g.lineWidth = width * (.6 + R() * .8);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * .5 + (R() - .5) * 3, y + Math.sin(a) * l * .5 + (R() - .5) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    } });
  }
  function bake() {
    if (baked) return; baked = true;
    /* all-purpose painted brushwork */
    { const c = canvas(S), g = c.getContext('2d'), R = mulberry32(3); base(g, R, .12); strokes(g, R, 260, 16, 4, -.5, 1.4, .18); strokes(g, R, 140, 9, 2, .9, 1, .14); tex.brush = c; }
    /* horizontal strokes: plaster and render, painted with a wide brush */
    { const c = canvas(S), g = c.getContext('2d'), R = mulberry32(5); base(g, R, .1); strokes(g, R, 220, 30, 6, 0, .25, .14); strokes(g, R, 120, 12, 2, 0, .4, .12); tex.plaster = c; }
    /* paving slabs with worn joints */
    { const c = canvas(S), g = c.getContext('2d'), R = mulberry32(7); base(g, R, .14); strokes(g, R, 120, 10, 3, 0, 3, .14);
      for (let x = 0; x < S; x += 40) { g.fillStyle = grey(70, .35); g.fillRect(x, 0, 2, S); g.fillStyle = grey(190, .25); g.fillRect(x + 2, 0, 1.5, S); }
      for (let i = 0; i < 40; i++) { g.fillStyle = grey(R() < .5 ? 80 : 180, .2); g.beginPath(); g.ellipse(R() * S, R() * S, 2 + R() * 8, 1 + R() * 3, R() * 3, 0, TAU); g.fill(); }
      tex.slabs = c; }
    /* asphalt: speckle and tyre-polished streaks */
    { const c = canvas(S), g = c.getContext('2d'), R = mulberry32(9); base(g, R, .25);
      for (let i = 0; i < 1400; i++) { g.fillStyle = grey(R() < .5 ? 40 : 210, R() * .3); g.beginPath(); g.arc(R() * S, R() * S, .6 + R() * 1.2, 0, TAU); g.fill(); }
      strokes(g, R, 60, 60, 8, 0, .08, .1); tex.asphalt = c; }
    /* grass blades (overlay: dark roots, light tips) */
    { const c = canvas(S, 64), g = c.getContext('2d'), R = mulberry32(11); g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, S, 64);
      for (let i = 0; i < 700; i++) { const x = R() * S, y = 8 + R() * 56, h = 4 + R() * 9; g.strokeStyle = grey(R() < .45 ? 60 : 205, .35 + R() * .4); g.lineWidth = 1 + R() * 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - .5) * 4, y - h * .6, x + (R() - .5) * 5, y - h); g.stroke(); }
      tex.grass = c; }
    /* roof tiles: scalloped rows */
    { const c = canvas(S, S), g = c.getContext('2d'), R = mulberry32(13); base(g, R, .1);
      const th = 16, tw = 20;
      wrap(g, () => { for (let r = 0; r < S / th; r++) { const off = (r % 2) * tw / 2; for (let k = -1; k <= S / tw; k++) { const x = k * tw + off, y = r * th, v = 110 + R() * 50;
        g.fillStyle = grey(v, .6); g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + tw - 1, y); g.lineTo(x + tw - 1, y + th - 4); g.arc(x + tw / 2, y + th - 4, tw / 2 - 1, 0, Math.PI); g.closePath(); g.fill();
        g.fillStyle = grey(40, .45); g.fillRect(x + 2, y + th - 1, tw - 4, 2); g.fillStyle = grey(220, .3); g.fillRect(x + 3, y + 1, tw - 6, 1.6); } } });
      tex.tiles = c; }
    /* bare earth for the building lot */
    { const c = canvas(S), g = c.getContext('2d'), R = mulberry32(17); base(g, R, .25);
      for (let i = 0; i < 160; i++) { g.fillStyle = grey(R() < .5 ? 60 : 200, .3); g.beginPath(); g.ellipse(R() * S, R() * S, 1.5 + R() * 3, 1 + R() * 2, R() * 3, 0, TAU); g.fill(); }
      tex.earth = c; }
  }

  function on() { return forced || (typeof GFX !== 'undefined' && GFX.active()); }
  function force(v) { forced = !!v; }   /* smoke.js: run the painted drawing paths on its stub canvas */
  function useContext(ctx) { if (ctx !== ctxFor) { ctxFor = ctx; pats.clear(); } }
  /* a repeating pattern for the current canvas (patterns belong to one context) */
  function pattern(ctx, name) {
    if (!baked) bake();
    useContext(ctx);
    let p = pats.get(name);
    if (!p) { p = ctx.createPattern(tex[name], 'repeat'); pats.set(name, p); }
    return p;
  }
  /* push the light and dark of a texture into what is already painted in a rectangle */
  function overlay(ctx, name, x, y, w, h, alpha, mode) {
    ctx.save(); ctx.globalCompositeOperation = mode || 'overlay'; ctx.globalAlpha = alpha;
    ctx.fillStyle = pattern(ctx, name); ctx.fillRect(x, y, w, h); ctx.restore();
  }
  /* the same, inside a path (roofs): path(ctx) builds it */
  function overlayPath(ctx, name, path, alpha) {
    ctx.save(); ctx.beginPath(); path(ctx); ctx.clip();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha; ctx.fillStyle = pattern(ctx, name); ctx.fill(); ctx.restore();
  }

  /* ---------- painted blocks: the classic block plus brushwork, chips, moss, rust ---------- */
  function block(code, variant) {
    const key = code + ':' + variant;
    let c = blocks.get(key); if (c) return c;
    if (!baked) bake();
    const src = Sprites.block(code, variant), n = src.width;
    c = canvas(n, n); const g = c.getContext('2d'), R = mulberry32(code * 31 + variant * 7 + 1), k = n / CELL;
    g.drawImage(src, 0, 0);
    const m = matOf(code).key;
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = m === 'steel' ? .35 : .6;
    g.drawImage(tex.brush, (variant * 61) % (S - n), (variant * 37 + code * 13) % (S - n), n, n, 0, 0, n, n); g.restore();
    g.save(); g.scale(k, k); g.lineCap = 'round';
    if (m === 'brick' || m === 'crumbly') {
      /* each brick gets a lighter dab on top and a darker one below, like a quick brush */
      for (let row = 0; row < 3; row++) for (let x = ((row + variant) % 2 ? -10 : 0); x < CELL; x += 20) {
        const y = row * 13.4;
        g.strokeStyle = `rgba(255,225,190,${.16 + R() * .14})`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 3 + R() * 2, y + 3.5); g.lineTo(x + 15 - R() * 3, y + 3 + R()); g.stroke();
        g.strokeStyle = `rgba(80,30,15,${.12 + R() * .12})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4, y + 9.5); g.lineTo(x + 16 - R() * 4, y + 9.8); g.stroke();
      }
      for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(230,215,190,${.25 + R() * .2})`; g.beginPath(); g.arc(R() * CELL, R() * CELL, .6 + R() * .8, 0, TAU); g.fill(); }
      if (m === 'crumbly') for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(60,35,20,.35)'; g.beginPath(); g.ellipse(R() * CELL, R() * CELL, 1.5 + R() * 2.5, 1 + R() * 1.5, R() * 3, 0, TAU); g.fill(); }
    } else if (m === 'stone') {
      for (let i = 0; i < 7; i++) { g.strokeStyle = R() < .5 ? 'rgba(255,250,235,.25)' : 'rgba(60,55,45,.2)'; g.lineWidth = 1.5 + R() * 1.5; const x = 3 + R() * 34, y = 3 + R() * 34; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4 + R() * 6, y + (R() - .5) * 3); g.stroke(); }
      if (R() < .55) { g.fillStyle = 'rgba(110,150,70,.3)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(2 + R() * 14, 17 + R() * 4, 1.5 + R() * 2.5, 0, TAU); g.fill(); } }
    } else if (m === 'steel') {
      for (let i = 0; i < 14; i++) { g.strokeStyle = R() < .5 ? 'rgba(255,255,255,.12)' : 'rgba(20,30,40,.12)'; g.lineWidth = .8 + R(); const y = R() * CELL; g.beginPath(); g.moveTo(1, y); g.lineTo(CELL - 1, y + (R() - .5) * 2); g.stroke(); }
      for (let i = 0; i < 2 + (variant % 2); i++) { g.fillStyle = `rgba(170,90,40,${.18 + R() * .15})`; g.beginPath(); g.ellipse(4 + R() * 32, 4 + R() * 32, 2 + R() * 4, 1.5 + R() * 2.5, R() * 3, 0, TAU); g.fill(); }
    } else if (m === 'bell') {
      g.strokeStyle = 'rgba(255,240,180,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(15, 10); g.quadraticCurveTo(13, 20, 10, 29); g.stroke();
    }
    g.restore();
    blocks.set(key, c);
    return c;
  }

  /* ---------- the town's big surfaces (called right after the flat fills) ---------- */
  function street(ctx, x0, x1, night) {
    const w = x1 - x0;
    overlay(ctx, 'grass', x0, GROUND_Y - 6, w, 10, .9);
    /* a few painted tufts poking above the verge */
    ctx.save(); ctx.strokeStyle = night ? 'rgba(60,90,60,.9)' : 'rgba(80,150,60,.9)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
    for (let x = Math.floor(x0 / 23) * 23; x < x1; x += 23) { const h = 4 + Sprites.hash(x, 9) * 6, s = (Sprites.hash(x, 4) - .5) * 4; ctx.moveTo(x, GROUND_Y - 4); ctx.lineTo(x + s, GROUND_Y - 4 - h); ctx.moveTo(x + 4, GROUND_Y - 4); ctx.lineTo(x + 4 + s * .6, GROUND_Y - 4 - h * .7); }
    ctx.stroke(); ctx.restore();
    overlay(ctx, 'slabs', x0, GROUND_Y + 4, w, 26, .75);
    overlay(ctx, 'brush', x0, GROUND_Y + 30, w, 6, .5);
    overlay(ctx, 'asphalt', x0, GROUND_Y + 36, w, 400, .6);
    /* the kerb casts a soft shadow onto the road */
    const g = ctx.createLinearGradient(0, GROUND_Y + 36, 0, GROUND_Y + 50); g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, GROUND_Y + 36, w, 14);
  }
  function wall(ctx, x, y, w, h, alpha) { overlay(ctx, 'plaster', x, y, w, h, alpha || .55); }
  function roof(ctx, path) { overlayPath(ctx, 'tiles', path, .7); }
  function lot(ctx, x0, x1) { overlay(ctx, 'earth', x0, GROUND_Y - 4, x1 - x0, 10, .8); }
  function wood(ctx, x, y, w, h) { overlay(ctx, 'plaster', x, y, w, h, .6); }

  return { bake, on, force, useContext, pattern, overlay, overlayPath, block, street, wall, roof, lot, wood };
})();
