/* ============================================================
   sprites.js — everything drawn by code
   ============================================================
   Side view.  Local frame: the creature faces +x, up is -y.
   Every function takes (ctx, opts) with `s` as the scale.  Frogs
   blend between poses with a `leg` amount (0 folded → 1 extended)
   so swimming, jumping and sitting share one drawing.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const cache = new Map();

  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function lerpPt(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
  function limb(ctx, pts, w, col, col2) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col2 || col; ctx.lineWidth = w + 2.2;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  }
  /* a webbed foot: toes fanned from `at` in direction `dir` (radians) */
  function foot(ctx, at, dir, len, col, dark, web = true) {
    const toes = [-.55, -.18, .18, .55];
    if (web) {
      ctx.fillStyle = withAlpha(col, .75);
      ctx.beginPath(); ctx.moveTo(at[0], at[1]);
      for (const a of toes) ctx.lineTo(at[0] + Math.cos(dir + a) * len * .85, at[1] + Math.sin(dir + a) * len * .85);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const a of toes) { ctx.beginPath(); ctx.moveTo(at[0], at[1]); ctx.lineTo(at[0] + Math.cos(dir + a) * len, at[1] + Math.sin(dir + a) * len); ctx.stroke(); }
    ctx.fillStyle = col;
    for (const a of toes) { circ(ctx, at[0] + Math.cos(dir + a) * len, at[1] + Math.sin(dir + a) * len, 1.5); ctx.fill(); }
  }

  /* =========================== EGGS =========================== */
  /* A jelly mass: translucent spheres with a dark embryo in each.
     dev 0 = round dot, 1 = comma ready to hatch.  hatch 0..1 empties them. */
  function drawEggMass(ctx, o) {
    const s = o.s || 1, n = o.count || 14, rng = mulberry32(o.seed || 1), dev = o.dev || 0, hatch = o.hatch || 0;
    ctx.save(); ctx.scale(s, s);
    const eggs = [];
    for (let i = 0; i < n; i++) { const a = rng() * TAU, r = Math.sqrt(rng()) * 18; eggs.push({ x: Math.cos(a) * r * 1.3, y: Math.sin(a) * r, r: 5.5 + rng() * 2.5, k: rng() }); }
    /* the shared jelly */
    ctx.fillStyle = 'rgba(210,235,245,.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 24, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    for (const e of eggs) {
      const g = ctx.createRadialGradient(e.x - e.r * .3, e.y - e.r * .3, e.r * .1, e.x, e.y, e.r);
      g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.7, 'rgba(200,230,245,.35)'); g.addColorStop(1, 'rgba(160,200,220,.5)');
      ctx.fillStyle = g; circ(ctx, e.x, e.y, e.r); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = .8; ctx.stroke();
      if (e.k < hatch) continue;                       // hatched: empty jelly
      ctx.fillStyle = '#1d1d16';
      const d = dev * e.k;
      if (d < .3) { circ(ctx, e.x, e.y, e.r * .42); ctx.fill(); }
      else {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.k * TAU);
        ell(ctx, 0, 0, e.r * .42, e.r * .32); ctx.fill();
        ctx.strokeStyle = '#1d1d16'; ctx.lineWidth = e.r * .28; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-e.r * .2, 0); ctx.quadraticCurveTo(-e.r * .55, e.r * .15 * d, -e.r * .78, -e.r * .2); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,.55)'; circ(ctx, e.x - e.r * .35, e.y - e.r * .4, e.r * .2); ctx.fill();
    }
    ctx.restore();
  }

  /* =========================== TADPOLE =========================== */
  /* stage 1 plain, 2 hind legs, 3 front legs + shrinking tail.
     tail 0..1 length, legs 0..1, arms 0..1, kick = phase, swim = 0..1 speed. */
  function drawTadpole(ctx, o) {
    const s = o.s || 1, sp = o.species || SPECIES.green;
    const tail = o.tail === undefined ? 1 : o.tail, legs = o.legs || 0, arms = o.arms || 0, kick = o.kick || 0, swim = o.swim || 0;
    const body = sp.tadpole || mixHex(sp.dark, '#4c5a2a', .5), belly = sp.tadpole ? mixHex(sp.tadpole, '#888', .3) : mixHex(sp.belly, '#c9c8a0', .5), dark = shade(sp.dark, .7);
    const morph = o.morph || 0;      // 0 tadpole shape → 1 froggy shape
    ctx.save(); ctx.scale(s, s);
    /* tail: a muscle band with a translucent fin above and below */
    const L = 44 * tail;
    if (L > 2) {
      const wave = (x) => Math.sin(kick - x * .13) * (2.5 + 3.5 * swim) * (x / L);
      ctx.fillStyle = withAlpha(mixHex(sp.accent, '#a9c27a', .5), .5);
      ctx.beginPath(); ctx.moveTo(-8, -2);
      for (let x = 0; x <= L; x += 4) ctx.lineTo(-10 - x, wave(x) - (9 - 8 * (x / L) ** 1.4) * Math.min(1, tail * 1.5));
      for (let x = L; x >= 0; x -= 4) ctx.lineTo(-10 - x, wave(x) + (9 - 8 * (x / L) ** 1.4) * Math.min(1, tail * 1.5));
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = withAlpha(dark, .35); ctx.lineWidth = .8; ctx.stroke();
      ctx.strokeStyle = body; ctx.lineWidth = 6 * Math.min(1, tail * 1.6); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-6, 0);
      for (let x = 0; x <= L; x += 4) ctx.lineTo(-10 - x, wave(x));
      ctx.stroke();
      ctx.strokeStyle = withAlpha('#fff', .15); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-8, -1.5); for (let x = 0; x <= L * .8; x += 4) ctx.lineTo(-10 - x, wave(x) - 1.5); ctx.stroke();
    }
    /* hind legs (grow from buds at the tail root) */
    if (legs > 0.02) {
      const k = Math.sin(kick) * swim;
      const hip = [-8, 5];
      const knee = [-8 - 9 * legs + k * 2, 3 + 8 * legs], ankle = [-2 - 6 * legs + k * 4, 6 + 12 * legs], toe = [4 + 4 * legs + k * 5, 8 + 13 * legs];
      limb(ctx, [hip, knee, ankle], 3 * legs + .5, body, dark);
      if (legs > .35) foot(ctx, ankle, Math.atan2(toe[1] - ankle[1], toe[0] - ankle[0]), 6 * legs, body, dark, legs > .6);
    }
    /* body */
    const rx = 15 + 4 * morph, ry = 10.5;
    const g = ctx.createRadialGradient(4, -5, 2, 0, 0, rx + 4);
    g.addColorStop(0, mixHex(body, '#fff', .18)); g.addColorStop(.6, body); g.addColorStop(1, dark);
    ctx.fillStyle = g; ell(ctx, 0, 0, rx, ry); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = withAlpha(belly, .55); ell(ctx, 1, 6, rx * .8, 5); ctx.fill();
    /* gold speckles */
    const rng = mulberry32(7);
    ctx.fillStyle = withAlpha('#e8c65a', .5);
    for (let i = 0; i < 14; i++) { circ(ctx, (rng() - .5) * rx * 1.8, (rng() - .6) * ry * 1.4, .7 + rng() * .8); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = withAlpha(dark, .6); ctx.lineWidth = 1; ell(ctx, 0, 0, rx, ry); ctx.stroke();
    /* spiracle & mouth */
    ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rx - 2, 2.5); ctx.lineTo(rx - 5, 3.5); ctx.stroke();
    /* eye */
    const ex = rx - 6, ey = -3.5, lk = o.look || { dx: 0, dy: 0 };
    circ(ctx, ex, ey, 3.2); ctx.fillStyle = sp.eye; ctx.fill();
    circ(ctx, ex + .4 + lk.dx * .9, ey + lk.dy * .8, 1.9); ctx.fillStyle = '#111'; ctx.fill();
    circ(ctx, ex - .6, ey - 1, .8); ctx.fillStyle = '#fff'; ctx.fill();
    /* front legs */
    if (arms > 0.02) {
      const sh = [rx - 6, 4];
      const el = [rx - 6 + 3 * arms, 4 + 8 * arms], hand = [rx - 2 + 4 * arms, 6 + 12 * arms];
      limb(ctx, [sh, el, hand], 2.4 * arms + .4, body, dark);
      if (arms > .4) foot(ctx, hand, .9, 4.5 * arms, body, dark, false);
    }
    ctx.restore();
  }

  /* =========================== FROG =========================== */
  /* pose: sit | crouch | jump | swim | float | sleep.  leg 0..1 overrides
     pose blending.  throat 0..1 vocal sac.  tongue 0..1 with tongueLen. */
  function drawFrog(ctx, o) {
    const s = o.s || 1, sp = o.species || SPECIES.green;
    const pose = o.pose || 'sit';
    let leg = o.leg; if (leg === undefined) leg = { sit: 0, crouch: 0, sleep: 0, jump: 1, swim: o.kick || 0, float: .6 }[pose] || 0;
    const flat = pose === 'crouch' || pose === 'sleep' ? .78 : 1;
    const body = sp.body, belly = sp.belly, dark = sp.dark, accent = sp.accent;
    const blink = o.blink || (pose === 'sleep' ? 1 : 0);
    const throat = o.throat || 0, tongue = o.tongue || 0;
    ctx.save(); ctx.scale(s, s * flat);

    /* ---- far hind leg (behind body) ---- */
    const hip = [-16, 3];
    const kneeF = lerpPt([-30, -8], [-40, 6], leg), ankF = lerpPt([-24, 9], [-58, 12], leg), footF = lerpPt([-4, 12], [-74, 10], leg);
    const farCol = shade(body, .72), farDark = shade(dark, .8);
    limb(ctx, [hip, kneeF, ankF], 6, farCol, farDark);
    foot(ctx, ankF, Math.atan2(footF[1] - ankF[1], footF[0] - ankF[0]), 13, farCol, farDark, true);
    /* far front leg */
    const shF = [8, 6];
    const elF = lerpPt([10, 12], [18, 6], leg), hdF = lerpPt([14, 16], [28, 12], leg);
    limb(ctx, [shF, elF, hdF], 3.6, farCol, farDark);
    foot(ctx, hdF, lerp(1.2, .3, leg), 6, farCol, farDark, false);

    /* ---- body ---- */
    const g = ctx.createLinearGradient(0, -16, 0, 12);
    g.addColorStop(0, mixHex(body, '#fff', .12)); g.addColorStop(.55, body); g.addColorStop(1, shade(body, .8));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(26, -2);
    ctx.bezierCurveTo(26, -12, 16, -18, 6, -17);      // head top
    ctx.bezierCurveTo(-8, -18, -24, -14, -28, -2);    // back
    ctx.bezierCurveTo(-30, 8, -16, 12, -2, 11);       // rump / belly
    ctx.bezierCurveTo(10, 11, 22, 8, 26, -2);         // chin
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    /* belly */
    ctx.fillStyle = withAlpha(belly, .85); ell(ctx, -2, 9, 26, 6); ctx.fill();
    /* pattern */
    const rng = mulberry32(31);
    ctx.fillStyle = withAlpha(dark, .55);
    if (sp.pattern === 'spots') for (let i = 0; i < 9; i++) { const x = -24 + rng() * 40, y = -14 + rng() * 16, r = 2.2 + rng() * 2; ctx.strokeStyle = withAlpha(accent, .8); ctx.lineWidth = 1.2; ell(ctx, x, y, r * 1.3, r); ctx.fill(); ctx.stroke(); }
    if (sp.pattern === 'mottle') for (let i = 0; i < 12; i++) { const x = -26 + rng() * 44, y = -15 + rng() * 18; ctx.fillStyle = withAlpha(rng() < .5 ? dark : accent, .35); ell(ctx, x, y, 3 + rng() * 4, 2 + rng() * 2, rng() * 3); ctx.fill(); }
    if (sp.pattern === 'lichen') for (let i = 0; i < 10; i++) { const x = -26 + rng() * 46, y = -15 + rng() * 20; ctx.fillStyle = withAlpha(rng() < .5 ? dark : '#6f8a5a', .4); ell(ctx, x, y, 4 + rng() * 5, 3 + rng() * 3, rng() * 3); ctx.fill(); }
    if (sp.pattern === 'warts') { for (let i = 0; i < 18; i++) { const x = -26 + rng() * 48, y = -15 + rng() * 20, r = 1.4 + rng() * 1.6; ctx.fillStyle = withAlpha(accent, .8); circ(ctx, x, y, r); ctx.fill(); ctx.strokeStyle = withAlpha(dark, .5); ctx.lineWidth = .7; ctx.stroke(); } ctx.fillStyle = withAlpha(dark, .35); ell(ctx, 6, -8, 5, 3); ctx.fill(); }
    if (sp.pattern === 'cross') { ctx.strokeStyle = withAlpha(dark, .7); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(0, -4); ctx.moveTo(-2, -13); ctx.lineTo(-16, -4); ctx.stroke(); }
    if (sp.pattern === 'ridges' || sp.pattern === 'spots') { ctx.strokeStyle = withAlpha(accent, .9); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(6, -13); ctx.quadraticCurveTo(-10, -15, -25, -6); ctx.stroke(); }
    if (sp.mask) { ctx.fillStyle = withAlpha(dark, .85); ctx.beginPath(); ctx.moveTo(24, -6); ctx.lineTo(4, -10); ctx.lineTo(0, -4); ctx.lineTo(20, -1); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f4ead8'; ctx.beginPath(); ctx.moveTo(22, -1); ctx.lineTo(4, -4); ctx.lineTo(3, -1); ctx.lineTo(21, 2); ctx.closePath(); ctx.fill(); }
    /* bumps for the treefrog */
    if (sp.pattern === 'lichen') { ctx.fillStyle = withAlpha('#fff', .18); for (let i = 0; i < 14; i++) { circ(ctx, -26 + rng() * 48, -15 + rng() * 22, 1 + rng()); ctx.fill(); } }
    /* soft highlight */
    ctx.fillStyle = withAlpha('#fff', .12); ell(ctx, 4, -12, 16, 4, -.15); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = withAlpha(dark, .7); ctx.lineWidth = 1.2; ctx.stroke();
    /* froglet tail stub */
    if (o.tail > 0.02) { ctx.fillStyle = body; ctx.strokeStyle = withAlpha(dark, .6); ctx.beginPath(); ctx.moveTo(-26, -2); ctx.quadraticCurveTo(-30 - 20 * o.tail, 0, -28 - 24 * o.tail, 3); ctx.quadraticCurveTo(-30, 8, -24, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    /* tympanum */
    ctx.fillStyle = withAlpha(dark, .5); circ(ctx, 6, -5, 3.6); ctx.fill();
    ctx.strokeStyle = withAlpha(accent, .7); ctx.lineWidth = 1; ctx.stroke();
    /* mouth line */
    ctx.strokeStyle = withAlpha(dark, .8); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(25, 0); ctx.quadraticCurveTo(16, 4, 4, 3); ctx.stroke();
    /* throat sac */
    if (throat > .02) {
      const r = 4 + 12 * throat;
      const tg = ctx.createRadialGradient(12, 8, 1, 12, 8 + r * .3, r);
      tg.addColorStop(0, mixHex(belly, '#ffd9a8', .5)); tg.addColorStop(1, mixHex(belly, sp.body, .35));
      ctx.fillStyle = tg; circ(ctx, 12, 6 + r * .5, r); ctx.fill();
      ctx.strokeStyle = withAlpha(dark, .4); ctx.lineWidth = 1; ctx.stroke();
    }
    /* tongue */
    if (tongue > .02) {
      const len = (o.tongueLen || 60) * tongue, dy = o.tongueDy || 0;
      ctx.strokeStyle = '#e8708a'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(22, 1); ctx.quadraticCurveTo(22 + len * .5, 1 + dy * .3 + len * .14 * (1 - tongue), 22 + len, dy); ctx.stroke();
      ctx.fillStyle = '#f08aa0'; circ(ctx, 22 + len, dy, 3.4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = .5; circ(ctx, 21 + len, dy - 1, 1.2); ctx.fill(); ctx.globalAlpha = 1;
    }

    /* ---- eye ---- */
    const ex = 14, ey = -13;
    circ(ctx, ex, ey, 6.2); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = withAlpha(dark, .6); ctx.lineWidth = 1; ctx.stroke();
    if (blink < .95) {
      const eg = ctx.createRadialGradient(ex, ey, 1, ex, ey, 5);
      eg.addColorStop(0, mixHex(sp.eye, '#fff', .3)); eg.addColorStop(1, sp.eye);
      ctx.fillStyle = eg; circ(ctx, ex, ey, 4.6); ctx.fill();
      const lk = o.look || { dx: 0, dy: 0 };
      ctx.fillStyle = '#111'; ell(ctx, ex + .6 + lk.dx * 1.5, ey + lk.dy * 1.6, 3.2, 1.5 + Math.abs(lk.dy) * 1.2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; circ(ctx, ex - 1.5, ey - 1.8, 1.2); ctx.fill();
    }
    if (blink > .05) { ctx.fillStyle = body; ctx.beginPath(); ctx.arc(ex, ey, 4.8, Math.PI, TAU); ctx.lineTo(ex + 4.8, ey + (blink - .5) * 9); ctx.arc(ex, ey, 4.8, 0, Math.PI * (blink > .5 ? 1 : 0)); ctx.closePath(); ctx.fill(); }

    /* ---- near hind leg (in front) ---- */
    const kneeN = lerpPt([-28, -6], [-38, 4], leg), ankN = lerpPt([-20, 10], [-56, 10], leg), footN = lerpPt([0, 13], [-72, 8], leg);
    limb(ctx, [hip, kneeN, ankN], 6.5, body, dark);
    foot(ctx, ankN, Math.atan2(footN[1] - ankN[1], footN[0] - ankN[0]), 14, body, dark, true);
    /* near front leg */
    const shN = [12, 5];
    const elN = lerpPt([13, 12], [20, 4], leg), hdN = lerpPt([18, 16], [30, 10], leg);
    limb(ctx, [shN, elN, hdN], 4, body, dark);
    foot(ctx, hdN, lerp(1.1, .2, leg), 6.5, body, dark, false);
    ctx.restore();
  }

  /* =========================== BUGS =========================== */
  function drawFly(ctx, o) {
    const s = o.s || 1, w = o.wing || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(200,220,255,.5)';
    for (const sgn of [-1, 1]) { ell(ctx, -2, -4 * sgn - 2, 8, 3, sgn * (.5 + Math.sin(w) * .45)); ctx.fill(); }
    ctx.fillStyle = '#2b2b30'; ell(ctx, -3, 0, 5, 3.2); ctx.fill();
    ctx.fillStyle = '#3d3d44'; ell(ctx, 2, 0, 3.5, 3); ctx.fill();
    ctx.fillStyle = '#4a4a52'; circ(ctx, 5.5, -.5, 2.4); ctx.fill();
    ctx.fillStyle = '#c2352a'; circ(ctx, 6.5, -1.5, 1.3); ctx.fill();
    ctx.strokeStyle = '#2b2b30'; ctx.lineWidth = .8;
    for (const [x0, x1] of [[0, -3], [2, 3], [4, 7]]) { ctx.beginPath(); ctx.moveTo(x0, 2); ctx.lineTo(x1, 5); ctx.stroke(); }
    ctx.restore();
  }
  function drawMosquito(ctx, o) {
    const s = o.s || 1, w = o.wing || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = .7; ctx.lineCap = 'round';
    for (const [x, dx] of [[1, -7], [3, 5], [4, 9]]) { ctx.beginPath(); ctx.moveTo(x, 1); ctx.lineTo(x + dx * .5, 5); ctx.lineTo(x + dx, 9); ctx.stroke(); }
    ctx.fillStyle = 'rgba(210,225,255,.55)';
    for (const sgn of [-1, 1]) { ell(ctx, -3, -2 * sgn - 1, 7, 1.8, sgn * (.35 + Math.sin(w) * .35)); ctx.fill(); }
    ctx.fillStyle = '#4a4238'; ell(ctx, -4, 0, 6, 1.6); ctx.fill();
    ctx.fillStyle = '#5a5044'; ell(ctx, 2, -.5, 2.6, 2); ctx.fill();
    ctx.fillStyle = '#2b2b30'; circ(ctx, 4.6, -1, 1.4); ctx.fill();
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(11, 2); ctx.stroke();
    ctx.restore();
  }
  function drawDragonfly(ctx, o) {
    const s = o.s || 1, w = o.wing || 0, col = o.col || '#3aa0d8';
    ctx.save(); ctx.scale(s, s);
    /* wings: two pairs, translucent, veined */
    for (const sgn of [-1, 1]) {
      for (const [x, len] of [[-2, 20], [-8, 18]]) {
        const a = sgn * (.9 + Math.sin(w + x) * .35);
        ctx.save(); ctx.translate(x, -1); ctx.rotate(-a);
        ctx.fillStyle = 'rgba(220,240,255,.42)'; ell(ctx, len / 2, 0, len / 2, 3.2); ctx.fill();
        ctx.strokeStyle = 'rgba(60,80,100,.3)'; ctx.lineWidth = .5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len - 2, 0); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.strokeStyle = shade(col, .6); ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-30, 1); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-29, 1); ctx.stroke();
    ctx.strokeStyle = shade(col, .5); ctx.lineWidth = .8;
    for (let x = -6; x > -28; x -= 4) { ctx.beginPath(); ctx.moveTo(x, -1.5); ctx.lineTo(x, 2.5); ctx.stroke(); }
    ctx.fillStyle = shade(col, .8); ell(ctx, 0, 0, 5, 3.6); ctx.fill();
    ctx.fillStyle = '#2b4a3a'; circ(ctx, 5, -.5, 3.4); ctx.fill();
    ctx.fillStyle = '#5ac8a8'; circ(ctx, 6, -1.6, 1.8); ctx.fill(); circ(ctx, 6.2, 1, 1.4); ctx.fill();
    ctx.restore();
  }
  /* mosquito larva: hangs from the surface by its tail snorkel, head down */
  function drawWriggler(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, wr = o.wriggle === undefined ? 1 : o.wriggle;
    ctx.save(); ctx.scale(s, s);
    ctx.lineCap = 'round';
    /* siphon at top, body hangs at an angle, wriggling */
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([Math.sin(ph + t * 4) * 2.2 * wr * t + t * 4, t * 16]); }
    ctx.strokeStyle = '#6a6250'; ctx.lineWidth = 3.6; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    ctx.strokeStyle = '#8c8570'; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    ctx.strokeStyle = '#4a4438'; ctx.lineWidth = .7;
    for (let i = 1; i < 8; i++) { const p = pts[i]; ctx.beginPath(); ctx.moveTo(p[0] - 2, p[1]); ctx.lineTo(p[0] + 2, p[1]); ctx.stroke(); }
    /* siphon */
    ctx.strokeStyle = '#5a5244'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2, -5); ctx.stroke();
    /* head */
    const h = pts[8]; ctx.fillStyle = '#4a4438'; circ(ctx, h[0], h[1] + 1, 2.6); ctx.fill();
    ctx.fillStyle = '#111'; circ(ctx, h[0] - 1, h[1] + 1, .7); ctx.fill(); circ(ctx, h[0] + 1, h[1] + 1, .7); ctx.fill();
    /* brush hairs */
    ctx.strokeStyle = 'rgba(80,70,50,.6)'; ctx.lineWidth = .5;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(h[0], h[1] + 2); ctx.lineTo(h[0] + i * 1.2, h[1] + 6); ctx.stroke(); }
    ctx.restore();
  }
  /* dragonfly nymph: flat brown hunter with a hinged mask jaw */
  function drawNymph(ctx, o) {
    const s = o.s || 1, jaw = o.jaw || 0, walk = o.walk || 0;
    ctx.save(); ctx.scale(s, s);
    const col = '#6b5232', dark = '#3d2c16', light = '#8f7449';
    /* legs */
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = 6 - i * 6, k = Math.sin(walk + i * 2) * 2;
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x + sgn * 5 + k, 7); ctx.lineTo(x + sgn * 9 + k * 1.5, 10); ctx.stroke(); }
    }
    /* abdomen */
    const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, light); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(2, -5); ctx.quadraticCurveTo(-26, -8, -30, 0); ctx.quadraticCurveTo(-26, 8, 2, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = .8; ctx.stroke();
    for (let x = -4; x > -26; x -= 4) { ctx.beginPath(); ctx.moveTo(x, -4.5 + (x + 4) * .1); ctx.lineTo(x, 4.5 - (x + 4) * .1); ctx.stroke(); }
    /* tail spikes */
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-36, -3); ctx.moveTo(-30, 0); ctx.lineTo(-36, 3); ctx.stroke();
    /* thorax + head */
    ctx.fillStyle = col; ell(ctx, 5, 0, 7, 5.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = light; ell(ctx, 12, -.5, 5, 4.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1e1a12'; circ(ctx, 13.5, -2.5, 1.9); ctx.fill(); circ(ctx, 13.5, 1.8, 1.4); ctx.fill();
    ctx.fillStyle = '#9ab070'; circ(ctx, 14, -3, .8); ctx.fill();
    /* the mask: a hinged arm that shoots forward */
    const ext = 4 + jaw * 26;
    ctx.strokeStyle = dark; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(12 + ext * .5, 4 + (1 - jaw) * 2); ctx.lineTo(12 + ext, 1); ctx.stroke();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(12 + ext, 1); ctx.lineTo(16 + ext, -2); ctx.lineTo(14 + ext, 1); ctx.lineTo(16 + ext, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /* great blue heron.  pose: stand | coil | strike | fly.  neck 0..1 blends stand→coil. */
  function drawHeron(ctx, o) {
    const s = o.s || 1, pose = o.pose || 'stand', flap = o.flap || 0, strike = o.strike || 0;
    ctx.save(); ctx.scale(s, s);
    const grey = '#6f8394', dark = '#3f4d5a', light = '#a9b8c4', beak = '#e0b34a';
    if (pose === 'fly') {
      /* wings */
      const a = Math.sin(flap) * .7;
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = sgn < 0 ? shade(grey, .8) : grey;
        ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(-30 * sgn, -40 * a - 20, -80 * sgn, -60 * a - 10); ctx.quadraticCurveTo(-60 * sgn, -30 * a + 6, -4, 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.fillStyle = grey; ell(ctx, -10, 2, 30, 9); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-36, 4); ctx.lineTo(-80, 14); ctx.stroke();
      ctx.strokeStyle = grey; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(14, 0); ctx.quadraticCurveTo(26, -8, 30, -10); ctx.stroke();
      ctx.fillStyle = light; circ(ctx, 32, -12, 6); ctx.fill();
      ctx.fillStyle = beak; ctx.beginPath(); ctx.moveTo(36, -14); ctx.lineTo(62, -9); ctx.lineTo(36, -9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#111'; circ(ctx, 34, -13, 1.6); ctx.fill();
      ctx.restore(); return;
    }
    const coil = pose === 'coil' ? 1 : pose === 'strike' ? 0 : (o.neck || 0);
    /* legs */
    ctx.strokeStyle = '#4c4a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const [x, off] of [[-4, 0], [6, -4]]) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x - 2 + off, 40); ctx.lineTo(x + 4 + off, 72); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 4 + off, 72); ctx.lineTo(x - 8 + off, 76); ctx.moveTo(x + 4 + off, 72); ctx.lineTo(x + 14 + off, 76); ctx.stroke(); }
    /* body */
    const g = ctx.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, light); g.addColorStop(.5, grey); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-40, 6); ctx.quadraticCurveTo(-30, -22, 6, -16); ctx.quadraticCurveTo(30, -10, 24, 10); ctx.quadraticCurveTo(0, 22, -30, 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
    /* wing fold */
    ctx.fillStyle = withAlpha(dark, .35); ctx.beginPath(); ctx.moveTo(-34, 4); ctx.quadraticCurveTo(-16, -14, 14, -8); ctx.quadraticCurveTo(0, 8, -34, 4); ctx.fill();
    /* tail feathers */
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-36, 8); ctx.lineTo(-52, 2); ctx.lineTo(-50, 14); ctx.closePath(); ctx.fill();
    /* neck: standing = tall S, coil = tight S pulled back, strike = straight out & down */
    let head;
    ctx.strokeStyle = grey; ctx.lineWidth = 9; ctx.lineCap = 'round';
    if (pose === 'strike') {
      const ex = 40 + strike * 30, ey = 30 + strike * 60;
      ctx.beginPath(); ctx.moveTo(14, -6); ctx.quadraticCurveTo(30, 0, ex, ey); ctx.stroke();
      head = [ex, ey]; ctx.fillStyle = light; ctx.save(); ctx.translate(head[0], head[1]); ctx.rotate(1.1);
    } else {
      const nx = lerp(18, 2, coil), ny = lerp(-40, -30, coil), hx = lerp(24, 12, coil), hy = lerp(-64, -44, coil);
      ctx.beginPath(); ctx.moveTo(12, -8); ctx.bezierCurveTo(nx + 10, ny + 16, nx - 16, ny - 10, hx, hy); ctx.stroke();
      ctx.strokeStyle = light; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(14, -6); ctx.bezierCurveTo(nx + 12, ny + 16, nx - 14, ny - 10, hx + 2, hy + 2); ctx.stroke();
      head = [hx, hy]; ctx.fillStyle = light; ctx.save(); ctx.translate(head[0], head[1]); ctx.rotate(lerp(0, .35, coil));
    }
    /* head */
    ell(ctx, 0, 0, 9, 6.5); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-20, -8); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();   // black crest
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(8, -4); ctx.lineTo(8, -1); ctx.lineTo(-2, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = beak; ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(36, 1); ctx.lineTo(6, 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(beak, .7); ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(6, 1); ctx.lineTo(34, 1); ctx.stroke();
    ctx.fillStyle = '#f2d060'; circ(ctx, 1, -1.5, 2.4); ctx.fill(); ctx.fillStyle = '#111'; circ(ctx, 1.5, -1.5, 1.3); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* =========================== PLANTS =========================== */
  /* lily pad drawn at its own centre; size = radius.  bloom 0..1 opens the flower. */
  function drawLilyPad(ctx, o) {
    const r = o.r, health = o.health === undefined ? 1 : o.health, bloom = o.bloom || 0, notch = o.notch || 0;
    ctx.save();
    ctx.rotate(o.tilt || 0);
    const green = mixHex('#4f9a3a', '#8a7a3a', 1 - health), edge = mixHex('#2f6a22', '#5a4a26', 1 - health);
    /* the pad seen in side-ish perspective: a squashed ellipse */
    const ry = r * .36;
    ctx.save(); ctx.scale(1, ry / r);
    const g = ctx.createRadialGradient(-r * .2, -r * .3, r * .1, 0, 0, r);
    g.addColorStop(0, mixHex(green, '#fff', .18)); g.addColorStop(.7, green); g.addColorStop(1, edge);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, notch + .28, notch - .28 + TAU); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();
    /* veins */
    ctx.strokeStyle = withAlpha('#dff0b0', .35 * health + .1); ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const a = notch + .28 + (TAU - .56) * (i + .5) / 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * .9, Math.sin(a) * r * .9); ctx.stroke(); }
    /* brown spots when withering */
    if (health < .9) { ctx.fillStyle = withAlpha('#6a4a1e', (1 - health) * .6); const rng = mulberry32(o.seed || 5); for (let i = 0; i < 6; i++) { ell(ctx, (rng() - .5) * r * 1.4, (rng() - .5) * r * 1.4, r * .12, r * .1); ctx.fill(); } }
    ctx.restore();
    /* water-line highlight along the near rim */
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, r * .96, ry * .96, 0, .3, Math.PI - .3); ctx.stroke();
    /* flower */
    if (bloom > .02) {
      const fx = r * .25, fy = -4;
      ctx.save(); ctx.translate(fx, fy);
      const open = bloom;
      const pink = o.hue < .5 ? '#f7c9dc' : '#fff6f0', deep = o.hue < .5 ? '#e57aa7' : '#f2d4a8';
      for (let ring = 0; ring < 2; ring++) {
        const n = 7, rad = (12 - ring * 4) * (0.35 + .65 * open), lift = ring ? -6 : -2;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI * .5 + (i - n / 2 + .5) * (Math.PI * 1.15 / n) * open;
          ctx.save(); ctx.rotate(a);
          const pg = ctx.createLinearGradient(0, 0, 0, -rad); pg.addColorStop(0, deep); pg.addColorStop(1, pink);
          ctx.fillStyle = pg; ell(ctx, 0, -rad * .55 + lift * .3, rad * .28, rad * .6); ctx.fill();
          ctx.strokeStyle = withAlpha(deep, .5); ctx.lineWidth = .6; ctx.stroke();
          ctx.restore();
        }
      }
      ctx.fillStyle = '#f2c23a'; circ(ctx, 0, -2, 3.5 * open + 1); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  /* reeds & cattails, base at (0,0) growing up (-y) */
  function drawReed(ctx, r, time, wind, season) {
    const sway = Math.sin(time * 1.1 + r.ph) * .06 + wind * .18;
    const lean = r.lean + sway;
    const brown = season === 'autumn' || season === 'winter';
    const stalk = brown ? '#a08a4a' : '#5f8a3a', leaf = brown ? '#b39a55' : '#79a84a';
    ctx.save();
    if (r.kind === 'grass') {
      ctx.strokeStyle = leaf; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.quadraticCurveTo(i * 6 + lean * 20, -r.h * .6, i * 12 + lean * 50, -r.h); ctx.stroke(); }
      ctx.restore(); return;
    }
    const tipX = lean * r.h, tipY = -r.h;
    /* leaves */
    ctx.strokeStyle = leaf; ctx.lineWidth = r.w * .9; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const f = .35 + i * .22, sgn = i % 2 ? 1 : -1;
      const bx = tipX * f * .5, by = tipY * f;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sgn * 26 + lean * 30, by - r.h * .25, bx + sgn * 34 + lean * 80, by - r.h * .5); ctx.stroke();
    }
    /* stalk */
    ctx.strokeStyle = stalk; ctx.lineWidth = r.w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(tipX * .3, tipY * .55, tipX, tipY); ctx.stroke();
    if (r.kind === 'cattail') {
      ctx.save(); ctx.translate(tipX * .92, tipY * .9); ctx.rotate(lean * .8);
      const g = ctx.createLinearGradient(-5, 0, 5, 0); g.addColorStop(0, '#6a3f1e'); g.addColorStop(.5, '#8c5a2a'); g.addColorStop(1, '#5a3418');
      ctx.fillStyle = g; rr(ctx, -4.5, -26, 9, 40, 4.5); ctx.fill();
      ctx.strokeStyle = stalk; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, -44); ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = brown ? '#c9b06a' : '#9ab96a'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + (i - 2) * 6 + lean * 10, tipY - 14 - Math.abs(i - 2) * -3); ctx.stroke(); }
    }
    ctx.restore();
  }
  /* underwater weeds, base at (0,0) growing up */
  function drawWeed(ctx, w, time, season) {
    const sway = Math.sin(time * .7 + w.ph) * .12 * w.sway;
    const col = season === 'winter' ? mixHex('#3f7a3a', '#5a6a4a', .6) : mixHex('#3f8a3a', '#6ab04a', w.tint);
    ctx.save();
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    if (w.kind === 'ribbon') {
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let i = 1; i <= 8; i++) { const t = i / 8; ctx.lineTo(Math.sin(time * .9 + w.ph + t * 3) * 14 * t + sway * 100 * t, -w.h * t); }
      ctx.stroke();
      ctx.strokeStyle = withAlpha('#fff', .12); ctx.lineWidth = 1.2; ctx.stroke();
    } else if (w.kind === 'elodea') {
      ctx.lineWidth = 2;
      const pts = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([sway * 90 * t * t + Math.sin(w.ph + t * 5) * 4, -w.h * t]); }
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.fillStyle = col;
      for (let i = 1; i < 10; i++) { const p = pts[i]; for (const sgn of [-1, 1]) { ell(ctx, p[0] + sgn * 5, p[1], 5.5, 2, sgn * .5 + sway); ctx.fill(); } }
    } else {
      ctx.lineWidth = 1.6;
      const pts = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([sway * 80 * t * t, -w.h * t]); }
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.lineWidth = 1;
      for (let i = 1; i <= 8; i++) { const p = pts[i]; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + i; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + Math.cos(a) * 9, p[1] + Math.sin(a) * 5 - 2); ctx.stroke(); } }
    }
    ctx.restore();
  }
  function drawRock(ctx, r) {
    const base = mixHex('#6d6a62', '#8a8478', r.k), dark = shade(base, .6);
    ctx.save(); ctx.rotate(r.tilt || 0);
    const g = ctx.createRadialGradient(-r.rx * .3, -r.ry * .5, r.rx * .1, 0, 0, r.rx);
    g.addColorStop(0, mixHex(base, '#fff', .25)); g.addColorStop(.7, base); g.addColorStop(1, dark);
    ctx.fillStyle = g; ell(ctx, 0, 0, r.rx, r.ry); ctx.fill();
    ctx.strokeStyle = withAlpha(dark, .6); ctx.lineWidth = 1; ctx.stroke();
    if (!r.pebble) { ctx.fillStyle = withAlpha('#fff', .1); ell(ctx, -r.rx * .3, -r.ry * .4, r.rx * .4, r.ry * .25); ctx.fill(); }
    ctx.restore();
  }
  /* an algae patch: fuzzy green, `amount` 0..1 */
  function drawAlgae(ctx, site, amount, time) {
    if (amount < .03) return;
    const r = site.r * (0.35 + .65 * amount);
    ctx.save();
    const rng = mulberry32((site.x * 13 + site.y * 7) | 0);
    ctx.fillStyle = withAlpha('#5fae3a', .35 + .4 * amount);
    for (let i = 0; i < 7; i++) { ell(ctx, (rng() - .5) * r * 1.4, (rng() - .5) * r * .5, r * (.35 + rng() * .35), r * (.18 + rng() * .18), rng() * 3); ctx.fill(); }
    ctx.strokeStyle = withAlpha('#8fd85a', .5 * amount + .1); ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (let i = 0; i < 12 * amount + 3; i++) { const x = (rng() - .5) * r * 1.6, y = (rng() - .5) * r * .4; const sw = Math.sin(time * 1.5 + i) * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw, y - 4 - rng() * 6, x + sw * 2, y - 8 - rng() * 8 * amount); ctx.stroke(); }
    ctx.restore();
  }
  function drawSnail(ctx, o) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#8a7a5a'; ell(ctx, 2, 2, 9, 3.2); ctx.fill();
    ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(12, -4); ctx.moveTo(9, 1); ctx.lineTo(13, -1); ctx.stroke();
    const g = ctx.createRadialGradient(-2, -3, 1, -2, -2, 7); g.addColorStop(0, '#d9b27a'); g.addColorStop(1, '#7a5a30');
    ctx.fillStyle = g; circ(ctx, -2, -2, 6.5); ctx.fill();
    ctx.strokeStyle = '#5a3f20'; ctx.lineWidth = .9; ctx.beginPath(); for (let a = 0; a < 9; a += .3) { const rad = a * .7; ctx.lineTo(-2 + Math.cos(a) * rad, -2 + Math.sin(a) * rad); } ctx.stroke();
    ctx.restore();
  }
  function drawMinnow(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    const gold = o.gold;
    const g = ctx.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, gold ? '#e8641a' : '#8fa8b8'); g.addColorStop(.5, gold ? '#ffb040' : '#d8e6ee'); g.addColorStop(1, gold ? '#f07a2a' : '#a8b8c4');
    if (gold) ctx.scale(1.6, 1.6);
    ctx.fillStyle = g; ell(ctx, 0, 0, 8, 2.6); ctx.fill();
    ctx.fillStyle = gold ? '#f08a3a' : '#9ab0be'; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-12, -3 + Math.sin(ph) * 1.5); ctx.lineTo(-12, 3 + Math.sin(ph) * 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111'; circ(ctx, 5, -.6, .8); ctx.fill();
    ctx.restore();
  }
  function drawLeaf(ctx, o) {
    const s = o.s || 1, col = o.col || '#d9a24a';
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-4, -8, 10, 0); ctx.quadraticCurveTo(-4, 8, -10, 0); ctx.fill();
    ctx.strokeStyle = shade(col, .7); ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.restore();
  }
  function drawFirefly(ctx, x, y, r, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    g.addColorStop(0, `rgba(220,255,140,${.95 * a})`); g.addColorStop(.3, `rgba(180,255,100,${.5 * a})`); g.addColorStop(1, 'rgba(180,255,100,0)');
    ctx.fillStyle = g; circ(ctx, x, y, r * 7); ctx.fill();
  }

  /* =========================== ICONS =========================== */
  /* kind: egg tadpole legs tail froglet frog fly mosquito dragonfly wriggler nymph heron pad */
  function icon(kind, species, px = 48) {
    const sp = species || SPECIES.green;
    const key = `${kind}|${sp.key}|${px}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = px * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2); ctx.translate(px / 2, px / 2);
    const s = px / 64;
    switch (kind) {
      case 'egg': drawEggMass(ctx, { s: s * .95, count: 12, seed: 3, dev: .6 }); break;
      case 'tadpole': ctx.rotate(-.2); drawTadpole(ctx, { s: s * .9, species: sp, kick: 1, swim: .5 }); break;
      case 'legs': ctx.rotate(-.2); drawTadpole(ctx, { s: s * .9, species: sp, legs: 1, kick: 1, swim: .5 }); break;
      case 'tail': ctx.rotate(-.1); drawTadpole(ctx, { s: s * .95, species: sp, legs: 1, arms: 1, tail: .45, morph: .5 }); break;
      case 'froglet': ctx.translate(2, 4); drawFrog(ctx, { s: s * .72, species: sp, pose: 'sit', tail: .3 }); break;
      case 'frog': ctx.translate(2, 4); drawFrog(ctx, { s: s * .8, species: sp, pose: 'sit' }); break;
      case 'fly': drawFly(ctx, { s: s * 2.6, wing: 1 }); break;
      case 'mosquito': drawMosquito(ctx, { s: s * 2.4, wing: 1 }); break;
      case 'dragonfly': ctx.translate(8, 0); drawDragonfly(ctx, { s: s * 1.2, wing: 1 }); break;
      case 'wriggler': ctx.translate(-2, -10); drawWriggler(ctx, { s: s * 1.8 }); break;
      case 'nymph': ctx.translate(6, 0); drawNymph(ctx, { s: s * 1.1, jaw: .3 }); break;
      case 'heron': ctx.translate(-2, 8); drawHeron(ctx, { s: s * .38, pose: 'stand' }); break;
      case 'pad': drawLilyPad(ctx, { r: 26 * s, bloom: 1, hue: .3, notch: .8 }); break;
      case 'algae': drawAlgae(ctx, { x: 0, y: 0, r: 22 * s }, 1, 0); break;
      case 'nymph2': ctx.translate(6, 0); drawNymph(ctx, { s: s * 1.1, jaw: .8 }); break;
    }
    cache.set(key, c);
    return c;
  }
  /* a fresh canvas element for putting in the DOM (the cached one is shared) */
  function iconEl(kind, species, px = 48) {
    const src = icon(kind, species, px);
    const c = document.createElement('canvas'); c.width = c.height = src.width;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  return { iconEl, drawEggMass, drawTadpole, drawFrog, drawFly, drawMosquito, drawDragonfly, drawWriggler, drawNymph, drawHeron, drawLilyPad, drawReed, drawWeed, drawRock, drawAlgae, drawSnail, drawMinnow, drawLeaf, drawFirefly, icon };
})();
