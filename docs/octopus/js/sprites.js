/* ============================================================
   sprites.js — every living thing, drawn with paths
   ============================================================
   THE OCTOPUS is drawn side-on, facing +x (the caller flips it with
   scale(face, 1)): a canonical body 100 units long from the back of
   the mantle (x ≈ −44) to the tips of the front arms (x ≈ +56).  The
   origin is the middle of the head; the arm tips rest on the ground
   at y = +20·s.  The mantle is the bag behind and above the head, the
   big eye sits on top of the head with its bar-shaped pupil, the
   siphon pokes out below, and eight tapered arms with two rows of
   suckers radiate from the crown: four on the near side, four on the
   far side.  The skin changes colour live: pale when calm or asleep,
   flushed red when excited, matched to the ground when blending in,
   with raised papillae; a flicker of patches while dreaming.  Arms
   curl in for a tuck, trail for a jet, spread wide (with the web
   between them) for a wrestle; one arm can be short and regrowing.

   THE PARALARVA is a glassy baby with a round mantle full of colour
   cells, two big eyes and eight short arms, pulsing along; the
   SETTLER is a little octopus sinking to the reef.

   Then plankton, herring, the grey whale, comb jellies, the gull,
   the hunters (lingcod, wolf eel, harbour seal, sea otter, sixgill
   shark), the crabber's boat and pot, the diver, bull kelp,
   eelgrass, food on the sea floor, shells for the midden, the
   sunflower star, the rockfish, a bottle, and the icons for the HUD,
   the stickers and the reading pictures.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();
  const C = (hex) => hexToRgb(hex);
  const RGB = (c, a) => rgbStr(c, a);
  const PALE = [240, 226, 214], FLUSH = [150, 30, 22];
  /* what the ground looks like, for blending in */
  const BLEND_COLS = { sand: [196, 176, 134], mud: [104, 96, 82], rock: [120, 116, 108], gravel: [150, 138, 112], shell: [196, 186, 170], kelp: [96, 92, 46], grass: [88, 118, 60] };

  /* the skin colours of a form right now: calm washes pale, excitement flushes red, blending matches the ground */
  function skinCols(form, o) {
    const F = FORMS[form] || FORMS.normal, calm = o.calm || 0, red = o.red || 0, blend = o.blend || 0;
    const bc = BLEND_COLS[o.blendMat] || BLEND_COLS.sand;
    const m = (hex, k = 1) => { let c = C(hex); c = mixRgb(c, PALE, calm * .72 * k); c = mixRgb(c, FLUSH, red * .55 * k); c = mixRgb(c, bc, blend * .78 * k); return c; };
    return { skin: m(F.skin), skin2: m(F.skin2, .8), under: m(F.under, .6), sucker: mixRgb(C(F.sucker), bc, blend * .4), arm: m(F.arm), eye: C(F.eye), spots: mixRgb(C(F.spots), mixRgb(bc, [0, 0, 0], .4), blend * .6), blend, calm, red };
  }
  function skinGrad(ctx, cols, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, RGB(mixRgb(cols.skin, [255, 240, 220], .25))); g.addColorStop(.5, RGB(cols.skin)); g.addColorStop(1, RGB(cols.skin2));
    return g;
  }

  /* ---------- the arms ----------
     eight arms, laid out in side view: k 0..3 on the near side (drawn in front), 4..7 on the far side.
     Each is a cubic curve from the crown to its tip, tapered, with two rows of suckers along the inner edge. */
  const ARM = [
    /* [angle at rest, length, phase, near] : front arms reach forward, back arms trail */
    [-.18, 46, 0, true], [.42, 40, 1.6, true], [1.15, 34, 3.2, true], [2.05, 36, 4.8, true],
    [.1, 44, .8, false], [.75, 38, 2.4, false], [1.55, 33, 4.0, false], [2.5, 38, 5.6, false]
  ];
  function armPath(bx, by, a, L, lift, curlK) {
    /* a curve that leaves the crown along `a`, sags under its own weight and lands on the ground at tip */
    const tx = bx + Math.cos(a) * L, ty = Math.min(by + Math.sin(a) * L, 20 - lift);
    const c1x = bx + Math.cos(a) * L * .4, c1y = by + Math.sin(a) * L * .4 - 6 * (1 - curlK) + curlK * 8;
    const c2x = lerp(c1x, tx, .55) + curlK * 6, c2y = lerp(c1y, ty, .55) + 6 * (1 - curlK) - curlK * 10;
    return { bx, by, c1x, c1y, c2x, c2y, tx, ty };
  }
  const bez = (P, t) => { const u = 1 - t; return [u * u * u * P.bx + 3 * u * u * t * P.c1x + 3 * u * t * t * P.c2x + t * t * t * P.tx, u * u * u * P.by + 3 * u * u * t * P.c1y + 3 * u * t * t * P.c2y + t * t * t * P.ty]; };
  function drawArm(ctx, P, w0, cols, near, suckers, short) {
    const N = 14, left = [], right = [], end = short ? .55 : 1;
    for (let i = 0; i <= N; i++) {
      const t = i / N * end, [x, y] = bez(P, t), [x2, y2] = bez(P, Math.min(end, t + .01));
      let dx = x2 - x, dy = y2 - y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = short && t > end - .12 ? w0 * (1 - t) * .9 * ((end - t) / .12 + .3) : w0 * (1 - t * .92);
      left.push([x - dy * w, y + dx * w]); right.push([x + dy * w, y - dx * w]);
    }
    ctx.fillStyle = near ? skinGrad(ctx, cols, P.bx, P.by - w0, P.bx, P.by + w0) : RGB(mixRgb(cols.skin2, [0, 0, 0], .3));
    ctx.strokeStyle = RGB(mixRgb(cols.skin2, [0, 0, 0], .4)); ctx.lineWidth = .8; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(left[0][0], left[0][1]); for (const [x, y] of left) ctx.lineTo(x, y); for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (short) { const [ex, ey] = bez(P, end); ctx.fillStyle = RGB(mixRgb(cols.under, [255, 240, 230], .4)); ctx.beginPath(); ctx.arc(ex, ey, w0 * .3, 0, TAU); ctx.fill(); }
    /* the suckers: two staggered rows along the underside (the side that faces down and forward) */
    if (suckers) {
      ctx.fillStyle = RGB(cols.sucker, near ? .95 : .6);
      for (let i = 1; i < N; i++) {
        const t = i / N * end, [x, y] = bez(P, t), [x2, y2] = bez(P, Math.min(end, t + .01));
        let dx = x2 - x, dy = y2 - y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const w = w0 * (1 - t * .92), r = Math.max(.35, w * .34), side = 1;
        const sx = x + dy * w * .55 * side, sy = y - dx * w * .55 * side;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
        if (i % 2 === 0 && near) { ctx.beginPath(); ctx.arc(sx + dx * 1.2, sy + dy * 1.2 - w * .18, r * .75, 0, TAU); ctx.fill(); }
      }
      if (near) { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 2; i < N; i += 2) { const t = i / N * end, [x, y] = bez(P, t), [x2, y2] = bez(P, Math.min(end, t + .01)); let dx = x2 - x, dy = y2 - y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; const w = w0 * (1 - t * .92); ctx.beginPath(); ctx.arc(x + dy * w * .55, y - dx * w * .55, Math.max(.15, w * .14), 0, TAU); ctx.fill(); } }
    }
  }
  /* the arm set for a pose: returns the eight curves (in draw order: far first) */
  function armSet(o) {
    const walk = o.walk || 0, tuck = o.tuck || 0, up = o.up || 0, jet = o.jet || 0, reach = o.reach || 0, swim = o.swim !== undefined;
    const arms = [];
    for (let k = 0; k < 8; k++) {
      const [a0, L0, ph, near] = ARM[k];
      let a = a0, L = L0, lift = 0;
      if (o.moving && !swim) { lift = Math.max(0, Math.sin(walk + ph)) * 4; a += Math.cos(walk + ph) * .12; }
      /* a wrestle or a threat: the arms spread wide and lift */
      a = lerp(a, lerp(-1.3, 1.6, k % 4 / 3), up * .7); L *= 1 + up * .1;
      /* a tuck: curled in close */
      L *= 1 - tuck * .45; a = lerp(a, 1.2, tuck * .5);
      /* a jet: streamlined, all the arms trailing forward (the octopus moves backwards) */
      a = lerp(a, (k % 4 - 1.5) * .12 + .1, jet); L *= 1 + jet * .15;
      /* a paralarva's / settler's pulse */
      if (swim) { a = lerp(a, .2 + (k % 4) * .35, .7) + Math.sin(o.swim + k) * .15; L *= .85; }
      /* reaching for food or a hand: the front arm stretches */
      if (k === 0 && reach > 0) { L *= 1 + reach * .35; a -= reach * .15; }
      const bx = 14 + (near ? 0 : -2) + (k % 4) * -2.5, by = 2 + (k % 4) * 1.4;
      const P = armPath(bx, by, a, L, lift, tuck * .8 + up * .3);
      arms.push({ P, near, k, w0: 5.6 - (k % 4) * .35 });
    }
    return arms;
  }

  /* ============================================================
     THE OCTOPUS (side-on, facing +x)
     o: { s, form, sex ('boy'|'girl'), walk, moving, calm (pale 0..1), red (0..1), blend (0..1), blendMat,
          up (arms raised, wrestling 0..1), reach (an arm reaching 0..1), eat, eggs (0..1: egg strings hanging over her),
          tuck (curled up 0..1), jet (streamlined 0..1), swim (pulsing: phase), dream (sleep flicker phase),
          favArm ('left'|'right'|null), armShort (0..1), squeeze (0..1), face (+1 right), simple, seed, ph }
     ============================================================ */
  function drawOctopus(ctx, o) {
    const s = o.s || 1, cols = skinCols(o.form, o);
    const tuck = o.tuck || 0, up = o.up || 0, jet = o.jet || 0, eggs = o.eggs || 0, squeeze = o.squeeze || 0;
    const dark = RGB(mixRgb(cols.skin2, [0, 0, 0], .4));
    ctx.save();
    ctx.scale(s, s);
    if (squeeze > 0) { const q = Math.sin(squeeze * Math.PI); ctx.translate(0, 4 * q); ctx.scale(1 + q * .25, 1 - q * .3); }
    if (o.moving && o.swim === undefined) ctx.rotate(Math.sin((o.walk || 0) * .5) * .012);
    const arms = armSet(o);
    /* a mother's eggs: strings hanging from the roof above her */
    if (eggs > 0) drawEggStrings(ctx, { x: -14, y: -40, w: 44, h: 26 * eggs + 6, n: Math.round(7 + eggs * 9), ph: o.ph || 0, seed: o.seed || 5 });
    /* --- the far arms --- */
    for (const A of arms) if (!A.near) drawArm(ctx, A.P, A.w0 * .9, cols, false, !o.simple, false);
    /* --- the web between the arms when they spread --- */
    if (up > .15) {
      ctx.fillStyle = RGB(mixRgb(cols.under, cols.skin, .5), .85 * up);
      ctx.beginPath(); ctx.moveTo(14, 4);
      for (const A of arms) if (A.near) { const [x, y] = bez(A.P, .42); ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill();
    }
    /* --- the mantle: a rounded bag behind and above the head, pointing back --- */
    ctx.save(); ctx.translate(-16, -12); ctx.rotate(-.32 - jet * .2);
    const mx = 26 * (1 + jet * .2) * (1 - tuck * .1), my = 18 * (1 - tuck * .12) * (1 - jet * .1);
    ctx.fillStyle = skinGrad(ctx, cols, 0, -my, 0, my); ctx.strokeStyle = dark; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(0, 0, mx, my, 0, 0, TAU); ctx.fill(); ctx.stroke();
    /* skin texture: speckles, and papillae (little bumps) when blending in or excited */
    if (!o.simple) {
      const RB = mulberry32(o.seed || 3), pap = (cols.blend || 0) * .8 + (cols.red || 0) * .4;
      ctx.fillStyle = RGB(cols.spots, .5);
      for (let k = 0; k < 26; k++) { const a = RB() * TAU, r = Math.sqrt(RB()) * .9; const x = Math.cos(a) * mx * r, y = Math.sin(a) * my * r; ctx.beginPath(); ctx.arc(x, y, .6 + RB() * 1.2, 0, TAU); ctx.fill(); }
      if (pap > .1) { ctx.fillStyle = RGB(mixRgb(cols.skin, [255, 240, 220], .3), pap); ctx.strokeStyle = RGB(cols.skin2, pap * .7); ctx.lineWidth = .6; for (let k = 0; k < 14; k++) { const a = -Math.PI + RB() * Math.PI, x = Math.cos(a) * mx * .96, y = Math.sin(a) * my * .96; ctx.beginPath(); ctx.moveTo(x - 1.6, y + .6); ctx.lineTo(x, y - 2.2 * pap); ctx.lineTo(x + 1.6, y + .6); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
      /* dreaming: patches of colour come and go across the skin */
      if (o.dream) { const RD = mulberry32(11); for (let k = 0; k < 5; k++) { const a = RD() * TAU, r = Math.sqrt(RD()) * .7, ph = RD() * TAU; const al = Math.max(0, Math.sin(o.dream * (1.2 + k * .3) + ph)) * .55; ctx.fillStyle = RGB(k % 2 ? FLUSH : PALE, al); ctx.beginPath(); ctx.ellipse(Math.cos(a) * mx * r, Math.sin(a) * my * r, 5 + k, 3.5, a, 0, TAU); ctx.fill(); } }
    }
    ctx.fillStyle = `rgba(255,255,255,${.16 + (cols.calm || 0) * .1})`; ctx.beginPath(); ctx.ellipse(-4, -my * .62, mx * .5, my * .18, .1, 0, TAU); ctx.fill();
    ctx.restore();
    /* --- the head, with the eye on top --- */
    ctx.fillStyle = skinGrad(ctx, cols, 0, -18, 0, 10); ctx.strokeStyle = dark; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-8, -12); ctx.bezierCurveTo(0, -22, 16, -22, 22, -10); ctx.bezierCurveTo(26, -2, 22, 8, 12, 9); ctx.bezierCurveTo(2, 10, -8, 4, -8, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the siphon: a tube under the head, pointing back; it flares when blowing */
    const blow = o.fan ? .5 + .5 * Math.sin(o.fan * 10) : 0;
    ctx.fillStyle = RGB(mixRgb(cols.under, cols.skin, .4)); ctx.strokeStyle = dark; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.quadraticCurveTo(-10, 8 + blow, -18, 9 + blow * 2); ctx.lineTo(-18, 12 + blow * 2); ctx.quadraticCurveTo(-10, 12, -1, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(20,10,8,.7)'; ctx.beginPath(); ctx.ellipse(-18, 10.5 + blow * 2, 1, 1.6 + blow, 0, 0, TAU); ctx.fill();
    /* the eye: a bar pupil that stays level, a golden iris, a brow of skin; half closed when asleep */
    const ex = 10, ey = -13, closed = (cols.calm || 0) > .6 && o.dream ? .75 : tuck * .4;
    ctx.fillStyle = RGB(mixRgb(cols.skin, cols.skin2, .3)); ctx.beginPath(); ctx.ellipse(ex, ey - 1, 6.5, 5.5, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#e8d8b0'; ctx.beginPath(); ctx.ellipse(ex, ey, 5, 4.2, 0, 0, TAU); ctx.fill();
    const ig = ctx.createRadialGradient(ex - 1, ey - 1, .5, ex, ey, 4.4); ig.addColorStop(0, '#d8b870'); ig.addColorStop(.6, '#9a6a30'); ig.addColorStop(1, '#4a3016');
    ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(ex, ey, 4.4, 3.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = RGB(cols.eye); ctx.beginPath(); ctx.ellipse(ex + .4, ey + .2, 3.4, 1.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(ex - 1.8, ey - 1.6, .9, 0, TAU); ctx.fill();
    if (closed > 0) { ctx.fillStyle = RGB(cols.skin); ctx.beginPath(); ctx.ellipse(ex, ey - 4.4 + closed * 4.2, 5.4, 4.4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(ex, ey - 4.4 + closed * 4.2, 5.4, 4.4, 0, .2, Math.PI - .2); ctx.stroke(); }
    /* --- the near arms, in front: the favourite arm is the front one; a short one regrows --- */
    const shortK = o.armShort > 0 ? 2 : -1;
    for (let i = arms.length - 1; i >= 0; i--) { const A = arms[i]; if (A.near) drawArm(ctx, A.P, A.w0, cols, true, !o.simple, A.k === shortK ? o.armShort : 0); }
    /* the beak, just visible between the arms when eating */
    if (o.eat) { const chew = Math.sin(o.eat * 18) * .6; ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.moveTo(15, 7 + chew); ctx.lineTo(19, 10 + chew); ctx.lineTo(14, 10.5 + chew); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  /* egg strings hanging from a den roof: pale strings of tiny grain-of-rice eggs */
  function drawEggStrings(ctx, o) {
    const R = mulberry32(o.seed || 5), n = o.n || 12, ph = o.ph || 0;
    for (let k = 0; k < n; k++) {
      const x = o.x + (k / Math.max(1, n - 1) - .5) * o.w + (R() - .5) * 4, len = o.h * (.6 + R() * .4), sway = Math.sin(ph * 1.5 + k) * 1.2;
      ctx.strokeStyle = 'rgba(240,230,210,.6)'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(x, o.y); ctx.quadraticCurveTo(x + sway, o.y + len * .5, x + sway * 1.5, o.y + len); ctx.stroke();
      const m = Math.max(3, Math.round(len / 2.2));
      for (let j = 0; j < m; j++) { const t = (j + .5) / m, ex = x + sway * t * 1.5 + (j % 2 ? .9 : -.9), ey = o.y + len * t; ctx.fillStyle = `rgba(${236 + (j % 3) * 4},${222 - (j % 2) * 10},${200},.85)`; ctx.beginPath(); ctx.ellipse(ex, ey, .75, 1.25, sway * .2, 0, TAU); ctx.fill(); if (j % 3 === 0) { ctx.fillStyle = 'rgba(40,30,30,.6)'; ctx.beginPath(); ctx.arc(ex + .2, ey - .3, .25, 0, TAU); ctx.fill(); } }
    }
  }

  /* ============================================================
     THE PARALARVA (facing +x), canonical 10 long: a glassy baby
     ============================================================ */
  function drawParalarva(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, F = FORMS[o.form] || FORMS.normal, inst = o.instar || 1;
    ctx.save(); ctx.scale(s, s);
    const pulse = .5 + .5 * Math.sin(ph), sc = hexToRgb(F.skin);
    /* eight short arms trailing behind (the baby jets head first), beating with the pulse */
    ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const a = Math.PI + (k - 3.5) * .22 + Math.sin(ph + k) * .12, L = 2.6 + inst * .7 + (k % 2) * .4;
      ctx.strokeStyle = `rgba(255,236,220,${k < 4 ? .55 : .85})`; ctx.lineWidth = .7 - k % 2 * .2;
      ctx.beginPath(); ctx.moveTo(-3.2, .4 + (k - 3.5) * .35); ctx.quadraticCurveTo(-3.2 + Math.cos(a) * L * .5, .4 + (k - 3.5) * .35 + Math.sin(a) * L * .5 + pulse, -3.2 + Math.cos(a) * L, .4 + (k - 3.5) * .5 + Math.sin(a) * L * .6); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let j = 1; j <= 2; j++) { ctx.beginPath(); ctx.arc(-3.2 + Math.cos(a) * L * j / 3, .8 + (k - 3.5) * .4 + Math.sin(a) * L * j / 3 * .6, .22, 0, TAU); ctx.fill(); }
    }
    /* the glassy mantle: a round bag that squeezes with each jet */
    const g = ctx.createRadialGradient(1.4, -1.2, .3, 1, -.4, 4.6);
    g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(.5, 'rgba(255,236,214,.42)'); g.addColorStop(1, 'rgba(240,210,190,.55)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = .4;
    ctx.beginPath(); ctx.ellipse(1, -.6, 4.2 + inst * .3 + pulse * .3, 3.2 + inst * .2 - pulse * .3, .05, 0, TAU); ctx.fill(); ctx.stroke();
    /* colour cells (chromatophores) and the gut */
    ctx.fillStyle = rgbStr(sc, .8);
    for (const [x, y, r] of [[-1.6, -1.4, .55], [.4, 1.2, .6], [-1.2, 1.1, .45], [2.4, -1.6, .45], [3.2, .8, .4], [1.2, -2.4, .35], [-2.6, -.2, .4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(200,120,70,.4)'; ctx.beginPath(); ctx.ellipse(0, .2, 2, .9, .2, 0, TAU); ctx.fill();
    /* the siphon under the head and the two big eyes */
    ctx.strokeStyle = 'rgba(255,230,210,.8)'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(3, 1.8); ctx.lineTo(1.2, 3 + pulse * .4); ctx.stroke();
    for (const [x, y] of [[4.3, -1.6], [3.6, -2.6]]) { ctx.fillStyle = '#0c0c14'; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x - .35, y - .4, .35, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  /* the settler: a little octopus sinking to the reef, arms pulsing */
  function drawSettler(ctx, o) {
    drawOctopus(ctx, { s: o.s || .08, form: o.form, sex: 'boy', swim: o.ph || 0, simple: true, ph: o.ph, seed: 2 });
  }
  /* an egg: a translucent grain of rice with the baby's eye spots showing through */
  function drawEgg(ctx, o = {}) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-.3, -.5, .1, 0, 0, 1.4);
    g.addColorStop(0, 'rgba(255,250,240,.95)'); g.addColorStop(.6, 'rgba(236,222,200,.9)'); g.addColorStop(1, 'rgba(190,170,150,.95)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, .75, 1.3, .15, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,90,.5)'; ctx.lineWidth = .08; ctx.stroke();
    if (o.eye) { ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.beginPath(); ctx.arc(.18, -.35, .2, 0, TAU); ctx.arc(-.2, -.3, .17, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(200,100,60,.35)'; for (const [x, y] of [[-.1, .3], [.25, .5], [-.3, .6]]) { ctx.beginPath(); ctx.arc(x, y, .12, 0, TAU); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-.3, -.6, .18, .3, .3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     PLANKTON AND THE SEA'S VISITORS
     ============================================================ */
  function drawPlankton(ctx, q, night, t) {
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + t * .2);
    switch (q.kind) {
      case 'krill': {
        ctx.rotate(-q.rot - t * .2 + Math.sin(q.ph) * .3);
        ctx.fillStyle = 'rgba(255,225,215,.75)'; ctx.strokeStyle = 'rgba(255,200,190,.9)'; ctx.lineWidth = .15;
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(0, -.9, -2, -.4); ctx.lineTo(-2.6, 0); ctx.lineTo(-2, .5); ctx.quadraticCurveTo(0, 1, 2, 0); ctx.fill(); ctx.stroke();
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-1.4 + k * .6, .6); ctx.lineTo(-1.6 + k * .6, 1.3 + Math.sin(q.ph * 8 + k) * .2); ctx.stroke(); }
        ctx.fillStyle = '#1a1a2a'; ctx.beginPath(); ctx.arc(1.6, -.2, .3, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(1.8, -.4); ctx.lineTo(3.2, -1.6); ctx.stroke();
        break;
      }
      case 'zoea': {
        ctx.rotate(-q.rot - t * .2 + Math.atan2(q.vy, q.vx || .01));
        ctx.fillStyle = 'rgba(240,210,170,.9)'; ctx.strokeStyle = 'rgba(200,160,110,.9)'; ctx.lineWidth = .15;
        ctx.beginPath(); ctx.arc(0, 0, 1.1, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(.3, -3); ctx.moveTo(-1, .3); ctx.lineTo(-2.8, .9); ctx.moveTo(.8, .8); ctx.lineTo(1.4, 2.2); ctx.stroke();
        ctx.fillStyle = '#101020'; ctx.beginPath(); ctx.arc(.7, -.3, .3, 0, TAU); ctx.arc(-.3, -.6, .25, 0, TAU); ctx.fill();
        break;
      }
      case 'dino': {
        const glow = night * .4 + q.glow;
        if (glow > .05) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 4); g.addColorStop(0, `rgba(120,220,255,${Math.min(1, glow)})`); g.addColorStop(1, 'rgba(120,220,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(200,170,110,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 1, .8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,170,110,.7)'; ctx.lineWidth = .15; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(1, 0); ctx.moveTo(0, .8); ctx.quadraticCurveTo(.8, 1.8, 0, 2.6); ctx.stroke();
        break;
      }
      case 'copepod': {
        ctx.rotate(-q.rot - t * .2 + Math.atan2(q.vy, q.vx || .01));
        ctx.fillStyle = 'rgba(230,200,150,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 1.6, .7, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(230,200,150,.8)'; ctx.lineWidth = .15; ctx.beginPath(); ctx.moveTo(-1.4, 0); ctx.lineTo(-3, .3); ctx.moveTo(1.2, -.3); ctx.lineTo(2.8, -2.2); ctx.moveTo(1.2, .3); ctx.lineTo(2.8, 2.2); ctx.stroke();
        ctx.fillStyle = '#e02020'; ctx.beginPath(); ctx.arc(1.2, 0, .3, 0, TAU); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
  /* a herring or a little bottom fish (side-on, facing +x), canonical 34 long */
  function drawFish(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, col = o.col || '#c8d8e8', col2 = o.col2 || '#3a5a7a';
    ctx.save(); ctx.scale(s, s);
    const tail = Math.sin(ph) * 3;
    const g = ctx.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, col2); g.addColorStop(.5, col); g.addColorStop(1, '#f4f8ff');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.quadraticCurveTo(10, -7, -6, -5); ctx.lineTo(-13, 0); ctx.lineTo(-6, 5); ctx.quadraticCurveTo(10, 7, 17, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-19, -6 + tail); ctx.lineTo(-17, 0); ctx.lineTo(-19, 6 + tail); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col2; ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(2, -9); ctx.lineTo(6, -5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14, -.5); ctx.lineTo(-10, -.5); ctx.stroke();
    ctx.fillStyle = '#101820'; ctx.beginPath(); ctx.arc(11, -1.5, 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10.6, -2, .5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* the grey whale, facing +x, canonical length 1000: mottled grey, barnacle patches, a knobbly back, broad flukes */
  function drawWhale(ctx, o) {
    const s = o.s || 1, t = o.t || 0, blow = o.blow || 0;
    ctx.save(); ctx.scale(s, s);
    const sw = Math.sin(t * .9) * 26;
    /* the flukes */
    ctx.fillStyle = '#4a4e52';
    ctx.beginPath(); ctx.moveTo(-430, -6); ctx.quadraticCurveTo(-500, -30 + sw * .3, -560, -90 + sw); ctx.quadraticCurveTo(-520, -20, -500, 0); ctx.quadraticCurveTo(-520, 20, -560, 90 + sw * .7); ctx.quadraticCurveTo(-500, 30 + sw * .2, -430, 14); ctx.fill();
    const g = ctx.createLinearGradient(0, -90, 0, 90);
    g.addColorStop(0, '#50565c'); g.addColorStop(.55, '#7a8088'); g.addColorStop(.75, '#a0a4a8'); g.addColorStop(1, '#c4c6c8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(470, -20); ctx.quadraticCurveTo(430, -80, 300, -92); ctx.quadraticCurveTo(0, -110, -300, -60); ctx.quadraticCurveTo(-420, -30, -440, -6);
    ctx.lineTo(-440, 14); ctx.quadraticCurveTo(-300, 50, 0, 78); ctx.quadraticCurveTo(300, 90, 440, 50); ctx.quadraticCurveTo(486, 20, 470, -20);
    ctx.fill();
    /* the knuckles along the back where a fin would be, mottling and barnacle patches */
    ctx.fillStyle = '#44484c'; for (let k = 0; k < 7; k++) { const x = -40 - k * 46, y = -84 + k * 6; ctx.beginPath(); ctx.ellipse(x, y, 14, 7, 0, Math.PI, TAU); ctx.fill(); }
    const R = mulberry32(21);
    ctx.fillStyle = 'rgba(230,228,220,.55)'; for (let k = 0; k < 90; k++) { ctx.beginPath(); ctx.ellipse(lerp(-400, 420, R()), lerp(-80, 60, R()), 3 + R() * 12, 2 + R() * 7, R() * 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(60,62,66,.4)'; for (let k = 0; k < 50; k++) { ctx.beginPath(); ctx.arc(lerp(-400, 420, R()), lerp(-80, 60, R()), 2 + R() * 7, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(240,220,180,.75)'; for (const [x, y, r] of [[380, -60, 26], [300, -80, 18], [430, -10, 14], [150, -90, 14]]) { for (let k = 0; k < 14; k++) { const a = R() * TAU, d = Math.sqrt(R()) * r; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .6, 1.5 + R() * 2.5, 0, TAU); ctx.fill(); } }
    /* the long mouth line, the eye, the flipper */
    ctx.strokeStyle = 'rgba(30,32,36,.75)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(470, 10); ctx.quadraticCurveTo(380, 44, 240, 50); ctx.stroke();
    ctx.fillStyle = '#4a4e52'; ctx.beginPath(); ctx.moveTo(240, 60); ctx.quadraticCurveTo(170, 170, 90, 190 + Math.sin(t) * 10); ctx.quadraticCurveTo(140, 110, 150, 70); ctx.fill();
    ctx.fillStyle = '#0a1018'; ctx.beginPath(); ctx.arc(362, 8, 7, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(360, 5, 2.4, 0, TAU); ctx.fill();
    /* the blow: a heart-shaped puff from the two blowholes when it is near the top */
    if (blow > 0) { ctx.fillStyle = `rgba(230,240,255,${blow * .5})`; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(300 + (k - 4) * 14 * (1.2 - blow), -100 - (1.2 - blow) * 90 - Math.abs(k - 4) * 6, 14 + (1.2 - blow) * 18, 0, TAU); ctx.fill(); } }
    ctx.restore();
  }
  /* a comb jelly: a see-through oval with eight rows of beating comb plates shimmering like a rainbow */
  function drawCombJelly(ctx, j, t) {
    const r = j.r;
    ctx.save(); ctx.translate(j.x, j.y);
    const g = ctx.createRadialGradient(-r * .3, -r * .4, 1, 0, 0, r * 1.3);
    g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(.7, 'rgba(210,235,255,.22)'); g.addColorStop(1, 'rgba(200,230,255,.08)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(230,245,255,.6)'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.ellipse(0, 0, r * .8, r * 1.25, Math.sin(j.ph * .3) * .2, 0, TAU); ctx.fill(); ctx.stroke();
    for (let row = 0; row < 4; row++) {
      const a = (row - 1.5) * .55 + Math.sin(j.ph * .3) * .2;
      for (let k = 0; k < 9; k++) {
        const u = k / 8, hue = ((u * 2 + t * 1.6 + row * .3) % 1) * 360;
        const x = Math.sin(a) * r * .7 * Math.sin(u * Math.PI), y = (u - .5) * r * 2.2;
        ctx.fillStyle = `hsla(${hue},100%,70%,${.55 + .4 * Math.sin(t * 6 - k)})`;
        ctx.beginPath(); ctx.arc(x, y, r * .09, 0, TAU); ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(230,245,255,.5)'; ctx.lineWidth = .6;
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * r * .3, r * 1.1); ctx.quadraticCurveTo(k * r * .6 + Math.sin(t + k) * 6, r * 2, k * r * .2 + Math.sin(t * .7 + k) * 10, r * 3); ctx.stroke(); }
    ctx.restore();
  }
  /* a gull: white and grey, black wing tips, a yellow bill; canonical span 200 */
  function drawGull(ctx, o) {
    const s = o.s || 1, flap = Math.sin(o.ph || 0) * .3;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#b8bcc4';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -26 - flap * 60, -100, -14 - flap * 70); ctx.quadraticCurveTo(-50, -2, -8, 6); ctx.quadraticCurveTo(50, -2, 100, -14 - flap * 70); ctx.quadraticCurveTo(30, -26 - flap * 60, 0, 0); ctx.fill();
    ctx.fillStyle = '#2a2a30'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * 100, -14 - flap * 70); ctx.lineTo(k * 78, -12 - flap * 58); ctx.lineTo(k * 84, -6 - flap * 56); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#f6f6f8'; ctx.beginPath(); ctx.ellipse(2, 6, 20, 7, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(-40, 12); ctx.lineTo(-40, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(22, 2, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b020'; ctx.beginPath(); ctx.moveTo(27, 2); ctx.lineTo(42, 5); ctx.lineTo(27, 7); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(23, 0, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* the hunters, facing +x, canonical 100 long: lingcod (big mouth, spotted, long dorsal fin), wolf eel (long, wrinkled face), sixgill shark */
  function drawHunter(ctx, kind, o) {
    const s = o.s || 1, ph = o.ph || 0, tail = Math.sin(ph) * 5;
    ctx.save(); ctx.scale(s, s);
    if (kind === 'lingcod') {
      const g = ctx.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, '#4a5a3a'); g.addColorStop(.6, '#8a8a5a'); g.addColorStop(1, '#d8d0b8');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(52, -4); ctx.quadraticCurveTo(30, -18, -10, -15); ctx.quadraticCurveTo(-35, -11, -46, -2); ctx.lineTo(-46, 4); ctx.quadraticCurveTo(-30, 13, -5, 14); ctx.quadraticCurveTo(30, 15, 52, 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-58, -12 + tail); ctx.lineTo(-56, 0); ctx.lineTo(-58, 12 + tail); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a4a2a'; ctx.beginPath(); ctx.moveTo(26, -13); for (let k = 0; k < 12; k++) ctx.lineTo(24 - k * 5.5, -24 + Math.sin(k * .8) * 3); ctx.lineTo(-40, -12); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, 13); ctx.lineTo(0, 24); ctx.lineTo(-14, 13); ctx.fill();
      ctx.fillStyle = 'rgba(60,50,20,.6)'; const R = mulberry32(3); for (let k = 0; k < 36; k++) { ctx.beginPath(); ctx.arc(-40 + R() * 86, -12 + R() * 22, 1 + R() * 2, 0, TAU); ctx.fill(); }
      /* the huge mouth, open a little, with its teeth */
      ctx.strokeStyle = '#2a2a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(52, 2); ctx.quadraticCurveTo(38, 6, 26, 6); ctx.stroke();
      ctx.fillStyle = '#f0ece0'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(46 - k * 4, 3); ctx.lineTo(45 - k * 4, 5.5); ctx.lineTo(44 - k * 4, 3); ctx.fill(); }
      ctx.fillStyle = '#101820'; ctx.beginPath(); ctx.arc(38, -6, 3.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#e0c080'; ctx.beginPath(); ctx.arc(37, -7, 1.2, 0, TAU); ctx.fill();
    } else if (kind === 'wolfeel') {
      const g = ctx.createLinearGradient(0, -8, 0, 10); g.addColorStop(0, '#4a4a46'); g.addColorStop(.6, '#7a7a72'); g.addColorStop(1, '#b8b4a8');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(50, -2); ctx.quadraticCurveTo(44, -11, 30, -10); ctx.quadraticCurveTo(0, -8, -30, -4); ctx.quadraticCurveTo(-46, -2, -52, 0 + tail * .4); ctx.quadraticCurveTo(-46, 4, -30, 6); ctx.quadraticCurveTo(0, 10, 30, 9); ctx.quadraticCurveTo(46, 8, 50, 2); ctx.closePath(); ctx.fill();
      /* the long fin down the whole back, the dark rings, the big wrinkled head */
      ctx.fillStyle = '#3a3a36'; ctx.beginPath(); ctx.moveTo(30, -9); for (let k = 0; k < 16; k++) ctx.lineTo(28 - k * 5, -14 + Math.sin(k * .9 + ph) * 1.5); ctx.lineTo(-50, -1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(30,30,30,.45)'; ctx.lineWidth = 2.2; for (let k = 0; k < 9; k++) { const x = 20 - k * 7; ctx.beginPath(); ctx.arc(x, 0, 6 - k * .4, -1.4, 1.4); ctx.stroke(); }
      ctx.fillStyle = '#6a6a62'; ctx.beginPath(); ctx.ellipse(40, -1, 11, 10, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(40,40,40,.6)'; ctx.lineWidth = 1; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(40, -1, 4 + k * 2, 2.6, 4.2); ctx.stroke(); }
      ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.ellipse(48, 4, 4, 2.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(51, 2); ctx.quadraticCurveTo(44, 7, 36, 6); ctx.stroke();
      ctx.fillStyle = '#101820'; ctx.beginPath(); ctx.arc(42, -5, 3, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(41, -6, 1, 0, TAU); ctx.fill();
    } else {
      /* the sixgill: a heavy, blunt-nosed shark, dark above and pale below, one small dorsal fin set well back */
      const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, '#3a3e44'); g.addColorStop(.55, '#6a6e74'); g.addColorStop(1, '#c8c8c8');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(52, -2); ctx.quadraticCurveTo(44, -14, 10, -14); ctx.quadraticCurveTo(-30, -12, -46, -3); ctx.lineTo(-46, 3); ctx.quadraticCurveTo(-30, 12, 10, 13); ctx.quadraticCurveTo(44, 12, 52, 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-62, -18 + tail); ctx.lineTo(-54, 0); ctx.lineTo(-60, 10 + tail); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a3e44'; ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(-24, -24); ctx.lineTo(-32, -11); ctx.fill();
      ctx.beginPath(); ctx.moveTo(18, 11); ctx.quadraticCurveTo(8, 24, -4, 22); ctx.quadraticCurveTo(4, 14, 18, 11); ctx.fill();
      ctx.strokeStyle = 'rgba(20,20,24,.7)'; ctx.lineWidth = 1.3; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(30 - k * 3, -6); ctx.quadraticCurveTo(28 - k * 3, 0, 30 - k * 3, 7); ctx.stroke(); }
      ctx.fillStyle = '#5ac0a0'; ctx.beginPath(); ctx.arc(44, -4, 3.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#0a1018'; ctx.beginPath(); ctx.ellipse(44.4, -4, 1.6, 2.4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(30,30,30,.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(50, 4); ctx.quadraticCurveTo(44, 8, 36, 7); ctx.stroke();
    }
    ctx.restore();
  }
  /* a harbour seal, side-on facing +x, canonical 100 long */
  function drawSeal(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, flip = Math.sin(ph) * 5;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, '#5a5a62'); g.addColorStop(.6, '#8a8a90'); g.addColorStop(1, '#c8c4c0');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(52, -2); ctx.quadraticCurveTo(44, -16, 20, -17); ctx.quadraticCurveTo(-10, -18, -34, -10); ctx.quadraticCurveTo(-46, -6, -50, 0); ctx.quadraticCurveTo(-46, 8, -34, 12); ctx.quadraticCurveTo(-10, 18, 20, 16); ctx.quadraticCurveTo(44, 14, 52, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-62, -10 + flip); ctx.lineTo(-56, 0); ctx.lineTo(-62, 10 + flip); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a6a70'; ctx.beginPath(); ctx.moveTo(14, 12); ctx.quadraticCurveTo(10, 24, -4, 22 + Math.sin(ph * .7) * 3); ctx.quadraticCurveTo(4, 16, 14, 12); ctx.fill();
    ctx.fillStyle = 'rgba(40,40,50,.5)'; const R = mulberry32(8); for (let k = 0; k < 26; k++) { ctx.beginPath(); ctx.arc(-40 + R() * 80, -12 + R() * 22, .8 + R() * 1.6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#0c0c12'; ctx.beginPath(); ctx.arc(40, -6, 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(39, -7.5, 1.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.ellipse(51, 0, 3, 2.4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .7; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(48, 2 + k); ctx.lineTo(60, 2 + k * 5); ctx.stroke(); }
    ctx.restore();
  }
  /* a sea otter, facing +x, canonical 100 long: dark brown, a pale face, big webbed hind feet */
  function drawOtter(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, kick = Math.sin(ph) * 6;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, '#3a2a1e'); g.addColorStop(.6, '#5a4030'); g.addColorStop(1, '#7a6048');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(48, -4); ctx.quadraticCurveTo(40, -14, 16, -14); ctx.quadraticCurveTo(-14, -14, -34, -8); ctx.quadraticCurveTo(-46, -4, -50, 0); ctx.quadraticCurveTo(-46, 6, -34, 9); ctx.quadraticCurveTo(-14, 14, 16, 13); ctx.quadraticCurveTo(40, 12, 48, 4); ctx.closePath(); ctx.fill();
    /* the hind feet, big webbed paddles, and the tail */
    ctx.fillStyle = '#2e2016'; ctx.beginPath(); ctx.moveTo(-40, 4); ctx.lineTo(-58, 2 + kick); ctx.lineTo(-62, 10 + kick); ctx.lineTo(-46, 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-40, -2); ctx.lineTo(-58, -8 - kick); ctx.lineTo(-62, -1 - kick); ctx.lineTo(-46, 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-48, 0); ctx.quadraticCurveTo(-64, 2, -70, 6 + kick * .3); ctx.quadraticCurveTo(-62, 1, -48, 2); ctx.fill();
    ctx.fillStyle = '#4a3424'; ctx.beginPath(); ctx.ellipse(10, 12, 7, 4, .3, 0, TAU); ctx.fill();
    /* the pale face, dark nose, whiskers, little ears */
    ctx.fillStyle = '#d8c8a8'; ctx.beginPath(); ctx.ellipse(40, -3, 10, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a1e'; ctx.beginPath(); ctx.arc(30, -12, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(49, 0, 3, 2.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0c0c12'; ctx.beginPath(); ctx.arc(41, -5, 2.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(40.3, -6, .9, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .6; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(46, 1 + k); ctx.lineTo(58, 2 + k * 4); ctx.stroke(); }
    ctx.restore();
  }
  /* the crab boat seen from the side on the surface, canonical length 240, waterline at y = 0 */
  function drawBoat(ctx, o) {
    const s = o.s || 1, roll = o.roll || 0;
    ctx.save(); ctx.scale(s, s); ctx.rotate(roll * .04);
    ctx.fillStyle = '#f0ece0'; ctx.strokeStyle = '#4a4a50'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-120, -14); ctx.lineTo(124, -22); ctx.lineTo(112, 14); ctx.quadraticCurveTo(0, 22, -100, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a5a8a'; ctx.beginPath(); ctx.moveTo(-108, 2); ctx.lineTo(118, -4); ctx.lineTo(112, 14); ctx.quadraticCurveTo(0, 22, -100, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8e4d8'; ctx.strokeStyle = '#4a4a50'; rr(ctx, 10, -58, 70, 44, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a9ac8'; rr(ctx, 18, -52, 22, 16, 3); ctx.fill(); rr(ctx, 48, -52, 22, 16, 3); ctx.fill();
    ctx.fillStyle = '#4a4a50'; ctx.fillRect(40, -88, 3, 30); ctx.fillStyle = '#e8a020'; ctx.beginPath(); ctx.arc(42, -90, 4, 0, TAU); ctx.fill();
    /* the davit and the hauler, a stack of round crab pots at the stern */
    ctx.strokeStyle = '#6a6a70'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, -14); ctx.lineTo(-40, -50); ctx.lineTo(-70, -44); ctx.stroke();
    ctx.strokeStyle = '#3a5a3a'; ctx.lineWidth = 1.2; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(-96, -24 - k * 12, 18, 6, 0, 0, TAU); ctx.stroke(); } ctx.fillStyle = 'rgba(60,110,60,.35)'; ctx.beginPath(); ctx.ellipse(-96, -24, 18, 6, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* the crabber: a rain jacket, boots, lifting a pot lid; canonical height 80, feet at 0 */
  function drawCrabber(ctx, o) {
    const s = o.s || 1, wave = o.wave || 0, measure = o.measure || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#2a2a2e'; rr(ctx, -12, -28, 9, 28, 3); ctx.fill(); rr(ctx, 3, -28, 9, 28, 3); ctx.fill();
    ctx.fillStyle = '#d83a2a'; rr(ctx, -15, -62, 30, 36, 8); ctx.fill();
    ctx.fillStyle = '#d8a878'; ctx.beginPath(); ctx.arc(0, -72, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8c040'; ctx.beginPath(); ctx.ellipse(0, -80, 16, 4, 0, 0, TAU); ctx.fill(); rr(ctx, -9, -90, 18, 11, 5); ctx.fill();
    ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(0, -66, 7, 3, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#2a2016'; ctx.beginPath(); ctx.arc(-3.5, -73, 1.3, 0, TAU); ctx.arc(3.5, -73, 1.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d83a2a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const a = measure ? -.6 : -2.2 + Math.sin(wave * 3) * .5;
    ctx.beginPath(); ctx.moveTo(10, -56); ctx.lineTo(10 + Math.cos(a) * 22, -56 + Math.sin(a) * 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, -56); ctx.lineTo(-20, -40); ctx.stroke();
    /* the pot's lid in his hand */
    if (measure) { ctx.strokeStyle = '#3a6a3a'; ctx.lineWidth = 1.2; ctx.save(); ctx.translate(10 + Math.cos(a) * 26, -56 + Math.sin(a) * 26); ctx.rotate(-.4); ctx.beginPath(); ctx.ellipse(0, 0, 12, 4, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  /* a round wire crab pot with its bait box and the rope up to the buoy, canonical 60 wide, 30 high, base at 0 */
  function drawTrap(ctx, o) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(40,80,40,.25)'; ctx.strokeStyle = '#4a8a4a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, -15, 30, 15, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = .5; for (let x = -28; x <= 28; x += 4) { ctx.beginPath(); ctx.moveTo(x, -15 - Math.sqrt(1 - (x / 30) ** 2) * 15); ctx.lineTo(x, -15 + Math.sqrt(1 - (x / 30) ** 2) * 15); ctx.stroke(); } for (let y = -28; y <= -2; y += 4) { const hw = 30 * Math.sqrt(1 - ((y + 15) / 15) ** 2); ctx.beginPath(); ctx.moveTo(-hw, y); ctx.lineTo(hw, y); ctx.stroke(); }
    ctx.strokeStyle = '#2a5a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -15, 30, 15, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-30, -15); ctx.lineTo(30, -15); ctx.stroke();
    /* the tunnel entrance on the side, and the bait box hanging inside */
    ctx.strokeStyle = 'rgba(160,220,160,.8)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-30, -22); ctx.lineTo(-14, -16); ctx.moveTo(-30, -8); ctx.lineTo(-14, -14); ctx.stroke();
    if (o.bait) { ctx.fillStyle = 'rgba(200,200,220,.6)'; rr(ctx, 4, -20, 10, 8, 1.5); ctx.fill(); ctx.fillStyle = '#9a8a9a'; ctx.beginPath(); ctx.ellipse(9, -16, 3, 2, .3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#7a4a2a'; for (const x of [-22, 22]) ctx.fillRect(x - 1.5, 0, 3, 3);
    ctx.restore();
  }
  /* the diver: a wetsuit, mask, fins, a tank, a camera; canonical height 70, fin tips at 0, facing +x */
  function drawDiver(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, kick = Math.sin(ph * 1.5) * 6;
    ctx.save(); ctx.scale(s, s);
    /* fins and legs (lying flat in the water, trailing back) */
    ctx.fillStyle = '#1a1a3a'; ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(-40, -8 + kick); ctx.lineTo(-56, -6 + kick * 1.5); ctx.lineTo(-54, 2 + kick * 1.5); ctx.lineTo(-38, 0 + kick); ctx.lineTo(-10, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8b020'; ctx.beginPath(); ctx.moveTo(-50, -8 + kick * 1.5); ctx.lineTo(-62, -12 + kick * 1.6); ctx.lineTo(-62, 4 + kick * 1.6); ctx.lineTo(-50, 1 + kick * 1.5); ctx.closePath(); ctx.fill();
    /* the tank on the back, the body */
    ctx.fillStyle = '#c8c8d0'; rr(ctx, -14, -28, 26, 10, 5); ctx.fill();
    ctx.fillStyle = '#1a1a3a'; ctx.beginPath(); ctx.moveTo(-14, -18); ctx.quadraticCurveTo(0, -24, 16, -18); ctx.lineTo(16, 0); ctx.quadraticCurveTo(0, 4, -14, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a8ad0'; ctx.fillRect(-10, -14, 24, 3);
    /* the head and mask, the regulator, bubbles */
    ctx.fillStyle = '#1a1a3a'; ctx.beginPath(); ctx.arc(22, -14, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a8d8f0'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2; rr(ctx, 20, -19, 12, 8, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d8b090'; ctx.beginPath(); ctx.ellipse(26, -15, 4, 2.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(27.5, -15, 1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(29, -8, 3, 0, TAU); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(29, -8); ctx.quadraticCurveTo(14, -6, -4, -22); ctx.stroke();
    /* arms: one holding the camera, one reaching forward, held very still */
    ctx.strokeStyle = '#1a1a3a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(26, 0); ctx.lineTo(40, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(20, 6); ctx.stroke();
    ctx.fillStyle = '#d8b090'; ctx.beginPath(); ctx.arc(43, -2, 3.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(22, 7, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; rr(ctx, 14, 4, 12, 8, 2); ctx.fill(); ctx.fillStyle = '#6ab0e0'; ctx.beginPath(); ctx.arc(24, 8, 2.2, 0, TAU); ctx.fill();
    if (o.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${o.flash * .9})`; ctx.beginPath(); ctx.arc(26, 8, 6 + (1 - o.flash) * 30, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  /* bull kelp: a long whip of a stipe rising to a floating bulb, with a crown of long blades streaming from it; canonical height h */
  function drawKelp(ctx, k, t, ground) {
    const sw = Math.sin(t * .6 + k.ph) * 10 + Math.sin(t * 1.3 + k.ph * 2) * 4;
    ctx.save(); ctx.translate(k.x, ground);
    ctx.fillStyle = '#3a3018'; ctx.beginPath(); ctx.ellipse(0, 1, 6, 2.5, 0, 0, TAU); ctx.fill();
    const topX = sw * 1.2, topY = -k.h;
    ctx.strokeStyle = '#6a5a22'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sw * .3, -k.h * .5, topX, topY); ctx.stroke();
    /* the float: a dark olive bulb at the top */
    ctx.fillStyle = '#5a5a1e'; ctx.beginPath(); ctx.ellipse(topX, topY - 3, 3.4 + k.w * .25, 4.5 + k.w * .3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,.25)'; ctx.beginPath(); ctx.ellipse(topX - 1, topY - 5, 1.2, 2, 0, 0, TAU); ctx.fill();
    /* the blades: several long ribbons streaming from the bulb with the current */
    const g = ctx.createLinearGradient(0, topY - 10, 0, topY + k.h * .5); g.addColorStop(0, '#8a7a2a'); g.addColorStop(.5, '#6a7a2a'); g.addColorStop(1, '#3a5a22');
    ctx.fillStyle = g; ctx.globalAlpha = .85;
    for (let b = 0; b < 4; b++) {
      const L = k.h * (.35 + b * .08), dir = (b % 2 ? 1 : -1), ph = k.ph + b;
      ctx.beginPath(); ctx.moveTo(topX, topY);
      for (let i = 0; i <= 8; i++) { const u = i / 8, x = topX + dir * (u * 10 + Math.sin(u * 7 + t * 1.5 + ph) * k.w * .7) + sw * u * .5, y = topY + u * L; ctx.lineTo(x + k.w * .45 * (1 - u * .4), y); }
      for (let i = 8; i >= 0; i--) { const u = i / 8, x = topX + dir * (u * 10 + Math.sin(u * 7 + t * 1.5 + ph) * k.w * .7) + sw * u * .5, y = topY + u * L; ctx.lineTo(x - k.w * .45 * (1 - u * .4), y); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  /* a tuft of eelgrass on the flats */
  function drawGrass(ctx, g, t, ground) {
    ctx.save(); ctx.translate(g.x, ground);
    ctx.lineCap = 'round';
    for (let k = 0; k < g.n; k++) {
      const sw = Math.sin(t * 1.1 + g.ph + k) * 5, x0 = (k - (g.n - 1) / 2) * 1.6, h = g.h * (.75 + (k % 2) * .25);
      ctx.strokeStyle = k % 2 ? '#4a8a3a' : '#6aa050'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0, 1); ctx.quadraticCurveTo(x0 + sw * .4, -h * .5, x0 + sw, -h); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- food on the sea floor ---------- */
  function drawFood(ctx, it, t) {
    const k = FOOD_KINDS[it.kind], left = it.bites / k.bites;
    ctx.save(); ctx.rotate(it.rot * .3);
    switch (it.kind) {
      case 'crab': {
        ctx.fillStyle = '#b84a3a'; ctx.strokeStyle = '#5a2010'; ctx.lineWidth = .6;
        for (const s2 of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(s2 * 3, -1 + i); ctx.lineTo(s2 * 7, -3 + i * 2 + Math.sin(t * 6 + i) * .6); ctx.lineTo(s2 * 9, 1 + i * 1.5); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(0, 0, 5.4, 3.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a1a16'; ctx.beginPath(); ctx.ellipse(-5.4, 2.4, 2.2, 1.4, .5, 0, TAU); ctx.ellipse(5.4, 2.4, 2.2, 1.4, -.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#101010'; ctx.beginPath(); ctx.arc(-1.5, -2.8, .6, 0, TAU); ctx.arc(1.5, -2.8, .6, 0, TAU); ctx.fill();
        if (left < 1) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(2, 0, 2.5 * (1 - left), 0, TAU); ctx.fill(); }
        break;
      }
      case 'clam': {
        const g = ctx.createLinearGradient(-5, -3, 5, 3); g.addColorStop(0, '#e8dcc0'); g.addColorStop(.6, '#c8b898'); g.addColorStop(1, '#9a8a70');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-6, 1); ctx.quadraticCurveTo(-5, -4.5, 1, -4.5); ctx.quadraticCurveTo(7, -3, 6, 2); ctx.quadraticCurveTo(0, 4, -6, 1); ctx.fill();
        ctx.strokeStyle = 'rgba(90,70,50,.45)'; ctx.lineWidth = .4; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-4.5, 1); ctx.quadraticCurveTo(0, -3.5 + i * .7, 5 - i * .6, -2.5 + i * 1.1); ctx.stroke(); }
        if (left < 1) { ctx.fillStyle = '#f0c080'; ctx.beginPath(); ctx.ellipse(1, 0, 3, 1.6, .2, 0, TAU); ctx.fill(); }
        break;
      }
      case 'scallop': {
        const g = ctx.createRadialGradient(0, 1, .5, 0, 0, 7); g.addColorStop(0, '#e0a888'); g.addColorStop(1, '#8a4a40');
        ctx.fillStyle = g; ctx.strokeStyle = '#4a2a20'; ctx.lineWidth = .5;
        ctx.beginPath(); ctx.moveTo(-2, 3); for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI, r = 6.2 + (i % 2) * .6; ctx.lineTo(Math.cos(a) * r, 3 + Math.sin(a) * r * .9); } ctx.lineTo(2, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(60,30,30,.4)'; for (let i = 1; i < 10; i += 2) { const a = Math.PI + i / 10 * Math.PI; ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(Math.cos(a) * 6, 3 + Math.sin(a) * 5.4); ctx.stroke(); }
        if (left < 1) { ctx.fillStyle = '#fff0e0'; ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.8, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'snail': {
        const g = ctx.createRadialGradient(-1, -1, .5, 0, 0, 5); g.addColorStop(0, '#e8e0d0'); g.addColorStop(1, '#8a7a6a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(90,70,60,.45)'; ctx.lineWidth = .6; ctx.beginPath(); for (let a = 0; a < 9; a += .3) ctx.lineTo(Math.cos(a) * a * .45, Math.sin(a) * a * .45); ctx.stroke();
        ctx.fillStyle = '#9a8a7a'; ctx.beginPath(); ctx.ellipse(4, 2.6, 3.4, 1.5, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'drift': {
        /* a little shrimp drifting past */
        ctx.fillStyle = 'rgba(255,220,200,.9)'; ctx.strokeStyle = 'rgba(200,140,120,.9)'; ctx.lineWidth = .4;
        ctx.beginPath(); ctx.moveTo(3.5, 0); ctx.quadraticCurveTo(1, -2.4, -2, -1.6); ctx.quadraticCurveTo(-4, -.6, -4.5, 1.2); ctx.lineTo(-3.5, 1.8); ctx.quadraticCurveTo(0, 2.2, 3.5, 0); ctx.fill(); ctx.stroke();
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-2.4 + k * 1.2, 1.4); ctx.lineTo(-2.8 + k * 1.2, 3); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(3, -.8); ctx.lineTo(6, -2.8); ctx.moveTo(3.2, -.4); ctx.lineTo(6.5, -1); ctx.stroke();
        ctx.fillStyle = '#101018'; ctx.beginPath(); ctx.arc(2.6, -.6, .5, 0, TAU); ctx.fill();
        break;
      }
      case 'bait': { ctx.fillStyle = '#a89aa8'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, .3, 0, TAU); ctx.fill(); ctx.fillStyle = '#7a6a8a'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(8, -3); ctx.lineTo(8, 3); ctx.fill(); break; }
    }
    ctx.restore();
  }
  /* an empty shell on the midden: a crab's carapace, half a clam, a scallop valve, a snail shell */
  function drawMiddenShell(ctx, m, t) {
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot * .4);
    if (m.kind === 'crab') { ctx.fillStyle = '#c87060'; ctx.strokeStyle = '#6a3028'; ctx.lineWidth = .5; ctx.beginPath(); ctx.ellipse(0, -1.5, 5, 2.8, 0, Math.PI, TAU); ctx.fill(); ctx.stroke(); }
    else if (m.kind === 'clam') { ctx.fillStyle = '#e8dcc0'; ctx.strokeStyle = '#8a7a60'; ctx.lineWidth = .4; ctx.beginPath(); ctx.ellipse(0, -1, 4.5, 2.4, 0, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-3, -1); ctx.quadraticCurveTo(0, -3, 3, -1); ctx.stroke(); }
    else if (m.kind === 'scallop') { ctx.fillStyle = '#d8a090'; ctx.strokeStyle = '#6a3a30'; ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(-1.5, 0); for (let i = 0; i <= 8; i++) { const a = Math.PI + i / 8 * Math.PI, r = 4.6 + (i % 2) * .5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * .8); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.fillStyle = '#d8d0c0'; ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = .4; ctx.beginPath(); ctx.arc(0, -2, 3, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  /* the sunflower star: a big soft disc with many arms (up to 24), orange-purple, creeping along */
  function drawSunStar(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, n = 18;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-2, -3, 1, 0, 0, 14); g.addColorStop(0, '#f0a060'); g.addColorStop(.6, '#c86a4a'); g.addColorStop(1, '#8a4a70');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let k = 0; k <= n * 2; k++) { const a = k / (n * 2) * TAU, r = k % 2 ? 7 : 14 + Math.sin(ph * 2 + k) * .8; const x = Math.cos(a) * r, y = Math.sin(a) * r * .5; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,200,.6)'; for (let k = 0; k < n; k++) { const a = k / n * TAU; for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.arc(Math.cos(a) * j * 3.6, Math.sin(a) * j * 1.8, .45, 0, TAU); ctx.fill(); } }
    ctx.restore();
  }
  /* a rockfish: a stout, spiny fish hanging in the gloom, big eyes; canonical 40 long facing +x */
  function drawRockfish(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#5a3a2a'); g.addColorStop(.6, '#a86a3a'); g.addColorStop(1, '#e0c090');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(20, 0); ctx.quadraticCurveTo(12, -8, -4, -8); ctx.quadraticCurveTo(-14, -7, -18, -1); ctx.lineTo(-18, 2); ctx.quadraticCurveTo(-14, 8, -4, 8); ctx.quadraticCurveTo(12, 8, 20, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-24, -6 + Math.sin(ph) * 2); ctx.lineTo(-24, 6 + Math.sin(ph) * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a2a1a'; ctx.beginPath(); ctx.moveTo(10, -7); for (let k = 0; k < 8; k++) ctx.lineTo(9 - k * 2.4, -13 + (k % 2) * 2); ctx.lineTo(-10, -7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,20,10,.45)'; for (const [x, y] of [[6, -2], [0, 3], [-8, -1], [-4, -5], [12, 3]]) { ctx.beginPath(); ctx.ellipse(x, y, 2.4, 1.4, .3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#101820'; ctx.beginPath(); ctx.arc(13, -2.5, 2.6, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12.4, -3.2, .8, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* an old glass bottle lying on the sand (a den), canonical 30 long, lying with its base at -x */
  function drawBottle(ctx, o) {
    const s = o.s || 1, col = o.col === 'brown' ? [120, 80, 30] : [60, 120, 80];
    ctx.save(); ctx.scale(s, s); ctx.rotate(o.tilt || 0);
    const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, RGB(mixRgb(col, [255, 255, 255], .45), .85)); g.addColorStop(.5, RGB(col, .75)); g.addColorStop(1, RGB(mixRgb(col, [0, 0, 0], .4), .85));
    ctx.fillStyle = g; ctx.strokeStyle = RGB(mixRgb(col, [0, 0, 0], .5), .8); ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(-15, -6); ctx.lineTo(4, -6); ctx.quadraticCurveTo(9, -5, 11, -3); ctx.lineTo(15, -3); ctx.lineTo(15, 3); ctx.lineTo(11, 3); ctx.quadraticCurveTo(9, 5, 4, 6); ctx.lineTo(-15, 6); ctx.quadraticCurveTo(-17, 0, -15, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(10,8,6,.85)'; ctx.beginPath(); ctx.ellipse(15, 0, 1.2, 2.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-4, -3.6, 8, .9, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     ICONS (HUD, life wheel, stickers, reading pictures): drawn in
     a 100×100 box centred on 0,0
     ============================================================ */
  function iconOct(ctx, form, extra = {}) { ctx.translate(-4, 2); drawOctopus(ctx, Object.assign({ s: .62, form, sex: 'boy', seed: 3, favArm: 'right' }, extra)); }
  function boulderIcon(ctx, hollow) {
    const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 40); g.addColorStop(0, '#c8c0b0'); g.addColorStop(1, '#5a5448');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -6, 40, 26, -.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8a888'; ctx.beginPath(); ctx.ellipse(0, 28, 50, 10, 0, 0, TAU); ctx.fill();
    if (hollow) { ctx.fillStyle = '#120c08'; ctx.beginPath(); ctx.ellipse(4, 20, 26, 9, 0, Math.PI, TAU); ctx.fill(); }
  }
  function drawIcon(ctx, key, px, form) {
    form = form || 'normal';
    /* the see-through sea creatures sit in a drop of blue water, so they show up on a pale page */
    if (['egg', 'larva', 'baby', 'plankton', 'copepod', 'krill', 'combjelly', 'shrimp'].includes(key)) {
      const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 48); g.addColorStop(0, '#bfe8f8'); g.addColorStop(1, '#3a8ac0');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
    }
    if (['kelp', 'deep', 'mud', 'boat', 'ink'].includes(key)) { ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.clip(); }
    switch (key) {
      case 'egg': for (const [x, y] of [[-8, -6], [8, -4], [0, 8], [-14, 10], [14, 10], [0, -16]]) { ctx.save(); ctx.translate(x, y); drawEgg(ctx, { s: 9, eye: true }); ctx.restore(); } break;
      case 'eggs': {
        ctx.fillStyle = '#5a4a40'; ctx.beginPath(); ctx.ellipse(0, -40, 50, 14, 0, 0, Math.PI); ctx.fill();
        drawEggStrings(ctx, { x: 0, y: -36, w: 60, h: 40, n: 9, ph: 0, seed: 5 });
        ctx.save(); ctx.translate(0, 20); drawOctopus(ctx, { s: .36, form, sex: 'girl', seed: 5, calm: .3, tuck: .2 }); ctx.restore();
        break;
      }
      case 'larva': case 'baby': ctx.translate(2, 0); drawParalarva(ctx, { s: 3.6, ph: .8, form, instar: 2 }); break;
      case 'postlarva': ctx.translate(4, 4); drawSettler(ctx, { s: .42, ph: .8, form }); break;
      case 'juvenile': ctx.translate(-2, 6); drawOctopus(ctx, { s: .38, form, sex: 'boy', seed: 3, simple: true }); break;
      case 'young': iconOct(ctx, form, { s: .5 }); break;
      case 'octopus': case 'adult': case 'boy': iconOct(ctx, form, { s: .62 }); break;
      case 'girl': case 'female': iconOct(ctx, form, { s: .58, sex: 'girl', eggs: key === 'female' ? .7 : 0, seed: 5, calm: key === 'female' ? .3 : 0 }); break;
      case 'walk': { iconOct(ctx, form, { s: .5, moving: true, walk: 1 }); ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-46, 30); ctx.lineTo(-30, 18); ctx.lineTo(-30, 26); ctx.lineTo(-10, 26); ctx.lineTo(-10, 34); ctx.lineTo(-30, 34); ctx.lineTo(-30, 42); ctx.closePath(); ctx.fill(); break; }
      case 'rival': iconOct(ctx, 'brick', { s: .56, up: .9, red: 1, seed: 8 }); break;
      case 'boss': { iconOct(ctx, form, { s: .56, up: .8 }); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(-10, -38); ctx.lineTo(-2, -28); ctx.lineTo(6, -40); ctx.lineTo(12, -28); ctx.lineTo(18, -38); ctx.lineTo(20, -22); ctx.closePath(); ctx.fill(); ctx.stroke(); break; }
      case 'arm': { ctx.save(); ctx.translate(-30, -30); ctx.rotate(.5); const cols = skinCols(form, {}); const P = armPath(0, 0, .55, 76, 0, .3); drawArm(ctx, P, 9, cols, true, true, 0); ctx.restore(); break; }
      case 'ink': { ctx.fillStyle = '#3a8ac0'; ctx.fillRect(-46, -46, 92, 92); ctx.fillStyle = 'rgba(20,14,24,.9)'; for (const [x, y, r] of [[-6, 0, 24], [14, -12, 18], [-22, 12, 16], [10, 16, 15]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } ctx.save(); ctx.translate(28, 10); ctx.scale(-1, 1); drawOctopus(ctx, { s: .22, form, jet: 1, simple: true, seed: 3 }); ctx.restore(); break; }
      case 'sleep': { boulderIcon(ctx, true); ctx.save(); ctx.translate(6, 14); drawOctopus(ctx, { s: .24, form, tuck: .5, calm: .9, dream: 1.3, simple: true, seed: 3 }); ctx.restore(); ctx.fillStyle = '#fff'; ctx.font = '900 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', 28, -24); ctx.font = '900 14px sans-serif'; ctx.fillText('z', 38, -34); break; }
      case 'plankton': for (const q of [{ x: -16, y: -10, kind: 'copepod', rot: 0, vx: 1, vy: -.3 }, { x: 14, y: -14, kind: 'krill', rot: .4 }, { x: 0, y: 12, kind: 'zoea', rot: 0, vx: 1, vy: -.3 }, { x: -18, y: 16, kind: 'dino', rot: 0, glow: .6 }, { x: 18, y: 14, kind: 'copepod', rot: .5, vx: -1, vy: .2 }]) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(7, 7); ctx.translate(-q.x, -q.y); drawPlankton(ctx, Object.assign({ glow: q.glow || 0, ph: 0 }, q, { x: q.x, y: q.y }), .3, 0); ctx.restore(); } break;
      case 'copepod': ctx.scale(16, 16); drawPlankton(ctx, { x: 0, y: 0, kind: 'copepod', rot: 0, vx: 1, vy: -.4, ph: 0 }, 0, 0); break;
      case 'krill': ctx.scale(14, 14); drawPlankton(ctx, { x: 0, y: 0, kind: 'krill', rot: 0, vx: 1, vy: 0, ph: 0 }, 0, 0); break;
      case 'combjelly': drawCombJelly(ctx, { x: 0, y: -4, r: 26, ph: 1.2 }, 1); break;
      case 'whale': ctx.translate(4, 8); drawWhale(ctx, { s: .082, t: 0, blow: 0 }); break;
      case 'herring': case 'fish': drawFish(ctx, { s: 2.2, col: '#c8d8e8', col2: '#3a5a7a' }); break;
      case 'gull': case 'bird': ctx.translate(0, 4); drawGull(ctx, { s: .42, ph: 1 }); break;
      case 'seal': drawSeal(ctx, { s: .72, ph: 1 }); break;
      case 'otter': drawOtter(ctx, { s: .7, ph: 1 }); break;
      case 'lingcod': drawHunter(ctx, 'lingcod', { s: .8, ph: 1 }); break;
      case 'wolfeel': case 'eel': drawHunter(ctx, 'wolfeel', { s: .82, ph: 1 }); break;
      case 'sixgill': case 'shark': drawHunter(ctx, 'sixgill', { s: .78, ph: 1 }); break;
      case 'cobble': case 'rock': boulderIcon(ctx, false); break;
      case 'den': { boulderIcon(ctx, true); ctx.save(); ctx.translate(6, 16); drawOctopus(ctx, { s: .22, form, tuck: .3, simple: true, seed: 3 }); ctx.restore(); break; }
      case 'bottle': { ctx.fillStyle = '#b8a888'; ctx.beginPath(); ctx.ellipse(0, 28, 50, 10, 0, 0, TAU); ctx.fill(); ctx.translate(0, 14); drawBottle(ctx, { s: 2.6, col: 'green', tilt: -.1 }); ctx.save(); ctx.translate(-14, -2); drawOctopus(ctx, { s: .14, form, tuck: .4, simple: true, seed: 3 }); ctx.restore(); break; }
      case 'kelp': { ctx.fillStyle = '#2a6a9a'; ctx.fillRect(-46, -46, 92, 92); for (const k of [{ x: -22, h: 70, ph: 0, w: 7 }, { x: 6, h: 84, ph: 2, w: 8 }, { x: 30, h: 60, ph: 4, w: 6 }]) drawKelp(ctx, k, 1, 44); break; }
      case 'crab': ctx.scale(5.5, 5.5); drawFood(ctx, { kind: 'crab', bites: 3, col: 0, rot: 0 }, 0); break;
      case 'clam': ctx.scale(7, 7); drawFood(ctx, { kind: 'clam', bites: 2, col: 0, rot: 0 }, 0); break;
      case 'scallop': ctx.scale(6, 6); drawFood(ctx, { kind: 'scallop', bites: 2, col: 0, rot: 0 }, 0); break;
      case 'snail': ctx.scale(7, 7); drawFood(ctx, { kind: 'snail', bites: 1, col: 0, rot: 0 }, 0); break;
      case 'shrimp': ctx.scale(6.5, 6.5); drawFood(ctx, { kind: 'drift', bites: 1, col: 0, rot: 0 }, 0); break;
      case 'shell': { ctx.fillStyle = '#b8a888'; ctx.beginPath(); ctx.ellipse(0, 28, 50, 10, 0, 0, TAU); ctx.fill(); ctx.scale(4, 4); for (const [x, y, k, r] of [[-5, 5, 'clam', 0], [4, 6, 'crab', .4], [-1, 2, 'scallop', -.3], [7, 2, 'snail', 0], [-7, 0, 'clam', 1]]) drawMiddenShell(ctx, { x, y, kind: k, rot: r }, 0); break; }
      case 'trap': { ctx.translate(0, 18); ctx.scale(1.4, 1.4); drawTrap(ctx, { s: 1, bait: true }); ctx.strokeStyle = '#d8d0b0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(22, -30); ctx.lineTo(28, -56); ctx.stroke(); ctx.fillStyle = '#e8402a'; ctx.beginPath(); ctx.ellipse(28, -60, 4, 6, 0, 0, TAU); ctx.fill(); break; }
      case 'crabber': ctx.translate(0, 44); drawCrabber(ctx, { s: .92, measure: 1 }); break;
      case 'boat': { ctx.fillStyle = '#5aa8e0'; ctx.fillRect(-46, 10, 92, 36); ctx.translate(0, 10); drawBoat(ctx, { s: .36 }); break; }
      case 'diver': ctx.translate(2, 8); drawDiver(ctx, { s: 1.1, ph: 1 }); break;
      case 'sunstar': ctx.translate(0, 6); drawSunStar(ctx, { s: 3, ph: 0 }); break;
      case 'moon': {
        ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,190,140,.6)'; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        break;
      }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'snow': ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(-12, -8, 16, 0, TAU); ctx.arc(8, -14, 18, 0, TAU); ctx.arc(22, -4, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; for (const [x, y] of [[-18, 20], [-2, 30], [14, 18], [26, 32], [-28, 34]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); } break;
      case 'mud': { ctx.fillStyle = '#2a4a6a'; ctx.fillRect(-46, -46, 92, 40); ctx.fillStyle = '#5a5244'; ctx.beginPath(); ctx.moveTo(-46, -6); ctx.quadraticCurveTo(0, -16, 46, -4); ctx.lineTo(46, 46); ctx.lineTo(-46, 46); ctx.fill(); ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.ellipse(6, 16, 22, 12, 0, 0, TAU); ctx.fill(); ctx.save(); ctx.translate(6, 18); drawOctopus(ctx, { s: .18, form, tuck: .5, calm: .6, simple: true, seed: 3 }); ctx.restore(); break; }
      case 'deep': { const g = ctx.createLinearGradient(0, -46, 0, 46); g.addColorStop(0, '#2a7ac0'); g.addColorStop(1, '#061830'); ctx.fillStyle = g; ctx.fillRect(-46, -46, 92, 92); ctx.fillStyle = '#4a4238'; ctx.beginPath(); ctx.moveTo(-46, 10); ctx.quadraticCurveTo(-10, 0, 20, 24); ctx.quadraticCurveTo(36, 34, 46, 40); ctx.lineTo(46, 46); ctx.lineTo(-46, 46); ctx.fill(); ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(30, -34); ctx.lineTo(18, -14); ctx.lineTo(26, -14); ctx.lineTo(26, 6); ctx.lineTo(34, 6); ctx.lineTo(34, -14); ctx.lineTo(42, -14); ctx.closePath(); ctx.fill(); break; }
      case 'sea': case 'water': {
        ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 0); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 2); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a6ab0'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 14); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, 14 + Math.sin(x * .12 + 2) * 6); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -40; x <= 40; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 4); ctx.stroke();
        break;
      }
      default: iconOct(ctx, form);
    }
  }
  function icon(key, px, form) {
    form = form || (window.G && window.G.form) || 'normal';
    const k = `${key}|${px}|${form}`;
    let c = iconCache.get(k);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = px * 2;
      const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(px / 2, px / 2); ctx.scale(px / 100, px / 100);
      drawIcon(ctx, key, px, form);
      iconCache.set(k, c);
    }
    const out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }

  return { drawOctopus, drawEggStrings, drawParalarva, drawSettler, drawEgg, drawPlankton, drawFish, drawWhale, drawCombJelly, drawGull, drawHunter, drawSeal, drawOtter, drawBoat, drawCrabber, drawTrap, drawDiver, drawKelp, drawGrass, drawFood, drawMiddenShell, drawSunStar, drawRockfish, drawBottle, drawIcon, icon, skinCols, armSet, armPath, bez, drawArm };
})();
