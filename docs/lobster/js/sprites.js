/* ============================================================
   sprites.js — every living thing, drawn with paths
   ============================================================
   THE LOBSTER is drawn side-on, facing +x (the caller flips it
   with scale(face, 1)): a canonical body 100 units long from the
   tip of the tail fan (x = −50) to the rostrum (x = +38), the two
   claws reaching forward past that.  The origin is the middle of
   the body; the leg tips touch the ground at y = +20·s.  Boys get
   bigger claws, girls a wider tail; one claw is the fat crusher,
   the other the slim cutter; a soft new shell is washed pale; a
   mother carries a dark berry-cluster of eggs under her tail; the
   tail curls under for a flip.

   THE LARVA is a tiny shrimp-like swimmer with a big eye, a spiky
   back and feathery swimming legs; STAGE IV is a little lobster
   swimming forwards with its tail stretched out.

   Then plankton, herring, the basking shark, comb jellies, the
   tern, the hunters (cod, sculpin, striped bass, the seal), the
   lobster boat with its lobsterman and trap, kelp, food on the
   sea floor, and the icons for the HUD, the stickers and the
   reading pictures.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();
  const C = (hex) => hexToRgb(hex);

  /* the shell colours of a form, washed pale for a soft new shell */
  function lobCols(form, pale) {
    const F = FORMS[form] || FORMS.normal;
    const pk = [255, 228, 214], m = (c) => pale > 0 ? mixRgb(C(c), pk, pale * .72) : C(c);
    return { shell: m(F.shell), shell2: m(F.shell2), belly: m(F.belly), leg: m(F.leg), claw: m(F.claw), eye: C(F.eye), spots: m(F.spots), split: form === 'split' };
  }
  const RGB = (c, a) => rgbStr(c, a);

  /* a shell gradient: light along the top, dark below (a split lobster: orange above, blue below) */
  function shellGrad(ctx, cols, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    if (cols.split) { g.addColorStop(0, RGB(mixRgb(cols.shell, [255, 240, 220], .25))); g.addColorStop(.48, RGB(cols.shell)); g.addColorStop(.52, RGB(cols.shell2)); g.addColorStop(1, RGB(mixRgb(cols.shell2, [0, 0, 0], .3))); }
    else { g.addColorStop(0, RGB(mixRgb(cols.shell, [255, 240, 220], .3))); g.addColorStop(.5, RGB(cols.shell)); g.addColorStop(1, RGB(cols.shell2)); }
    return g;
  }

  /* one walking leg, side view: hip → knee (out and down) → the tip on the ground */
  function leg(ctx, hx, hy, kx, ky, tx, ty, w, col, dark) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = dark; ctx.lineWidth = w + 1.8;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = w * .75; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(lerp(kx, tx, .7), lerp(ky, ty, .7)); ctx.stroke();
    ctx.lineWidth = w * .45; ctx.beginPath(); ctx.moveTo(lerp(kx, tx, .7), lerp(ky, ty, .7)); ctx.lineTo(tx, ty); ctx.stroke();
  }

  /* a claw held forward: shoulder → elbow → the big hand with its two fingers.
     crusher: fat with bumpy teeth · cutter: slim with a fine edge.  up: raised and open (a contest) */
  function claw(ctx, o) {
    const { sx, sy, k, up, pinch, cols, crusher, near, boy } = o;
    const dark = RGB(mixRgb(cols.shell2, [0, 0, 0], .35)), big = (crusher ? 1.3 : .92) * (boy ? 1.12 : .95) * k;
    const ex = lerp(sx + 18, sx + 10, up), ey = lerp(sy + 8, sy - 16, up);          /* elbow */
    const hx = lerp(sx + 36, sx + 30, up), hy = lerp(sy + 4, sy - 26, up);          /* wrist */
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = dark; ctx.lineWidth = 7 * k + 1.8; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = RGB(near ? cols.shell : mixRgb(cols.shell, [0, 0, 0], .25)); ctx.lineWidth = 7 * k; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(lerp(.1, -.9, up));
    const L = 22 * big, H = 9 * big * (crusher ? 1.15 : .85);
    /* the hand (propodus) */
    const g = ctx.createLinearGradient(0, -H, 0, H);
    g.addColorStop(0, RGB(mixRgb(cols.shell, [255, 240, 220], .3))); g.addColorStop(.55, RGB(near ? cols.shell : mixRgb(cols.shell, [0, 0, 0], .2))); g.addColorStop(1, RGB(cols.shell2));
    ctx.fillStyle = g; ctx.strokeStyle = dark; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-4, -H * .6); ctx.quadraticCurveTo(L * .5, -H * 1.25, L, -H * .3); ctx.lineTo(L, H * .2); ctx.quadraticCurveTo(L * .5, H * 1.15, -4, H * .55); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the fixed finger (below) and the moving finger (above), pale tipped */
    const open = pinch * .5 + up * .3;
    for (const [dy, rot, fixed] of [[H * .15, open * .15, true], [-H * .35, -open, false]]) {
      ctx.save(); ctx.translate(L - 2, dy); ctx.rotate(rot);
      const fl = L * (crusher ? .75 : .95), fh = H * (fixed ? .42 : .34);
      const fg = ctx.createLinearGradient(0, 0, fl, 0); fg.addColorStop(0, RGB(cols.shell)); fg.addColorStop(.7, RGB(cols.claw)); fg.addColorStop(1, RGB(mixRgb(cols.claw, [40, 20, 10], .35)));
      ctx.fillStyle = fg; ctx.strokeStyle = dark; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -fh); ctx.quadraticCurveTo(fl * .6, -fh * 1.1, fl, 0); ctx.quadraticCurveTo(fl * .6, fh * .9, 0, fh); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* a crusher's rounded teeth / a cutter's fine serrations along the inner edge */
      ctx.fillStyle = RGB(cols.claw);
      if (crusher) { for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(fl * i / 4.2, fixed ? -fh * .8 : fh * .8, fh * .32, 0, TAU); ctx.fill(); } }
      else { ctx.beginPath(); for (let i = 0; i < 7; i++) { const x = fl * (i + .5) / 7.5, y = fixed ? -fh * .9 : fh * .9; ctx.moveTo(x, y); ctx.lineTo(x + fl * .04, y + (fixed ? -1 : 1) * fh * .5); ctx.lineTo(x + fl * .08, y); } ctx.fill(); }
      ctx.restore();
    }
    /* the bumps and a shine on the hand */
    ctx.fillStyle = 'rgba(0,0,0,.14)'; const RB = mulberry32(crusher ? 9 : 4);
    for (let i = 0; i < (crusher ? 7 : 3); i++) { ctx.beginPath(); ctx.arc(2 + RB() * L * .8, (RB() - .5) * H * 1.2, .8 + RB() * 1.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(L * .4, -H * .55, L * .3, H * .18, -.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     THE LOBSTER (side-on, facing +x)
     o: { s, form, sex ('boy'|'girl'), walk, moving, pale (soft shell 0..1), up (claws raised 0..1),
          pinch, eat, eggs (0..1), tuck (curled up, hiding 0..1), flip (tail snapped under 0..1),
          swim (postlarva swimming: tail out, paddles beating, ph), crusher ('left'|'right'|null),
          face (+1 right), simple (a tiny one: fewer details), seed }
     ============================================================ */
  function drawLobster(ctx, o) {
    const s = o.s || 1, boy = o.sex !== 'girl', cols = lobCols(o.form, o.pale || 0);
    const walk = o.walk || 0, tuck = o.tuck || 0, up = o.up || 0, flip = o.flip || 0, eggs = o.eggs || 0, swim = o.swim;
    const face = o.face === undefined ? 1 : o.face, nearSide = face >= 0 ? 'right' : 'left';
    const crusherNear = o.crusher ? o.crusher === nearSide : null;     /* null: not decided yet (both alike) */
    const dark = RGB(mixRgb(cols.shell2, [0, 0, 0], .35)), legC = RGB(cols.leg), legD = RGB(mixRgb(cols.leg, [0, 0, 0], .45));
    const legFar = RGB(mixRgb(cols.leg, [0, 0, 0], .3));
    const tailH = boy ? 1 : 1.16;
    ctx.save();
    ctx.scale(s, s);
    if (o.moving && !swim) ctx.rotate(Math.sin(walk * .5) * .015);

    /* --- antennae: two long feelers sweeping forward, and the short antennules --- */
    const ant = Math.sin((o.ph || walk) * .6) * .12;
    ctx.strokeStyle = RGB(mixRgb(cols.shell, [255, 220, 180], .2)); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(34, -6 + k * 1.5); ctx.quadraticCurveTo(70 + k * 6, -30 + ant * 40 * k - up * 10, 112 + k * 4, -14 + ant * 60 * k - up * 20 - k * 10); ctx.stroke(); }
    ctx.lineWidth = 1; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(36, -4); ctx.quadraticCurveTo(46, -10 + k * 3, 52, -14 + k * 5 + ant * 10); ctx.stroke(); }

    /* --- the far claw (behind) --- */
    claw(ctx, { sx: 24, sy: 2, k: 1, up, pinch: o.pinch || 0, cols, crusher: crusherNear === null ? false : !crusherNear, near: false, boy });

    /* --- the far-side legs --- */
    const HIP = [[22, 6], [12, 7], [2, 7], [-8, 6]];
    for (let k = 3; k >= 0; k--) {
      const ph = walk + k * 1.6 + Math.PI, lift = o.moving ? Math.max(0, Math.sin(ph)) * 5 : 0, swing = o.moving ? Math.cos(ph) * 6 : 0;
      const [hx, hy] = HIP[k], tx = hx + swing + 4 - k * 3 - tuck * 6, ty = 20 - lift - tuck * 6;
      leg(ctx, hx, hy, (hx + tx) / 2 + 6, hy + 4 - lift * .5, tx, ty, 2.2, legFar, legD);
    }

    /* --- the tail: six plates, curling under for a flip or a tuck --- */
    ctx.save(); ctx.translate(-10, 0);
    const curl = flip * .62 + tuck * .4, segs = 6;
    let px = 0, py = 0, ang = 0;
    for (let k = 0; k < segs; k++) {
      ang += curl;
      const L = 6.5 - k * .3, h = (12 - k * 1.1) * tailH;
      ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, -h, 0, h); g.addColorStop(0, RGB(mixRgb(cols.shell, [255, 240, 220], .25))); g.addColorStop(.5, RGB(cols.shell)); g.addColorStop(1, RGB(cols.belly));
      ctx.fillStyle = g; ctx.strokeStyle = dark; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(2, -h * .9); ctx.quadraticCurveTo(-L * .5, -h * 1.05, -L - 2, -h * .8); ctx.lineTo(-L - 1, h * .75); ctx.quadraticCurveTo(-L * .4, h * 1.02, 2, h * .85); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* swimmerets: little paddles under each segment (beating when swimming or fanning) */
      const beat = swim !== undefined ? Math.sin(swim + k) * .7 : (o.fan ? Math.sin(o.fan * 14 + k) * .8 : 0);
      ctx.strokeStyle = RGB(cols.belly); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-L * .5, h * .8); ctx.lineTo(-L * .5 - 1 + beat * 3, h * .8 + 4.5 - Math.abs(beat)); ctx.stroke();
      ctx.restore();
      px += -L * Math.cos(ang) - .5; py += -L * Math.sin(ang);
    }
    /* the tail fan: a middle blade and two pairs of side blades */
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang + curl);
    const spread = .35 + flip * .3 + (swim !== undefined ? .2 : 0);
    for (const a of [-spread, -spread * .5, 0, spread * .5, spread]) {
      ctx.save(); ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, -12, 0); g.addColorStop(0, RGB(cols.shell)); g.addColorStop(1, RGB(mixRgb(cols.belly, cols.claw, .5)));
      ctx.fillStyle = g; ctx.strokeStyle = dark; ctx.lineWidth = .9;
      ctx.beginPath(); ctx.moveTo(1, -2.6 * tailH); ctx.quadraticCurveTo(-8, -4 * tailH, -13, -1.2); ctx.quadraticCurveTo(-8, 3.6 * tailH, 1, 2.6 * tailH); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    /* a mother's eggs: a cluster of dark berries glued under the tail */
    if (eggs > 0) {
      const g = ctx.createRadialGradient(-14, 10, 2, -16, 13, 16 * eggs + 6);
      g.addColorStop(0, '#4a3a34'); g.addColorStop(.6, '#2a2022'); g.addColorStop(1, '#161014');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-16, 11 + eggs * 3, 14 + eggs * 10, 5 + eggs * 5, .05, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,210,.25)'; const R = mulberry32(7);
      for (let k = 0; k < 34 * eggs; k++) { ctx.beginPath(); ctx.arc(-16 + (R() - .5) * (26 + eggs * 18), 11 + eggs * 3 + (R() - .5) * (9 + eggs * 8), 1.1, 0, TAU); ctx.fill(); }
    }
    ctx.restore();

    /* --- the carapace: a long domed shield with the rostrum spike at the front --- */
    ctx.fillStyle = shellGrad(ctx, cols, 0, -14, 0, 12); ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, -4); ctx.bezierCurveTo(-12, -14, 0, -15, 14, -14); ctx.bezierCurveTo(26, -13, 34, -10, 36, -6);
    ctx.lineTo(44, -9); ctx.lineTo(37, -3);                           /* the rostrum */
    ctx.bezierCurveTo(36, 4, 28, 9, 16, 10); ctx.bezierCurveTo(4, 11, -8, 9, -12, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the groove across the carapace, speckles, a shine */
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, -13); ctx.quadraticCurveTo(6, -2, 9, 9); ctx.stroke();
    if (!o.simple) {
      ctx.fillStyle = RGB(cols.spots, .55); const RB = mulberry32(o.seed || 3);
      for (let k = 0; k < 22; k++) { const x = -10 + RB() * 44, y = -12 + RB() * 20; if (x > 34) continue; ctx.beginPath(); ctx.arc(x, y, .6 + RB() * 1.1, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = `rgba(255,255,255,${.2 + (o.pale || 0) * .15})`; ctx.beginPath(); ctx.ellipse(10, -10, 14, 2.4, .04, 0, TAU); ctx.fill();
    /* the mouth parts, chewing */
    const chew = o.eat ? Math.sin(o.eat * 18) * 1.5 : 0;
    ctx.fillStyle = RGB(mixRgb(cols.belly, [0, 0, 0], .3)); rr(ctx, 26, 7 + chew * .4, 7, 5, 2); ctx.fill();
    /* the eye on its stalk */
    ctx.strokeStyle = dark; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(32, -7); ctx.lineTo(36, -11 + tuck * 3); ctx.stroke();
    const eg = ctx.createRadialGradient(35.5, -12 + tuck * 3, .4, 36.5, -11 + tuck * 3, 3.4);
    eg.addColorStop(0, '#6a6a7a'); eg.addColorStop(.5, RGB(cols.eye)); eg.addColorStop(1, '#000');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(36.5, -11 + tuck * 3, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(35.6, -12.2 + tuck * 3, .9, 0, TAU); ctx.fill();

    /* --- the near-side legs, in front of the body --- */
    for (let k = 3; k >= 0; k--) {
      const ph = walk + k * 1.6, lift = o.moving ? Math.max(0, Math.sin(ph)) * 6 : 0, swing = o.moving ? Math.cos(ph) * 7 : 0;
      const [hx, hy] = HIP[k], tx = hx + swing + 2 - k * 4 - tuck * 6, ty = 20 - lift - tuck * 7;
      leg(ctx, hx, hy + 2, (hx + tx) / 2 + 7, hy + 6 - lift * .5, tx, ty, 2.5, k % 2 ? legC : RGB(mixRgb(cols.leg, [255, 255, 255], .12)), legD);
    }
    /* --- the near claw, in front --- */
    claw(ctx, { sx: 26, sy: 5, k: 1, up: up * .9, pinch: o.pinch || 0, cols, crusher: crusherNear === null ? false : crusherNear, near: true, boy });
    ctx.restore();
  }

  /* an empty shed shell, pale and see-through, split along the back */
  function drawExuvia(ctx, s, form) {
    ctx.save(); ctx.globalAlpha = .55;
    drawLobster(ctx, { s, form, pale: 1, tuck: .2, simple: true, seed: 2 });
    ctx.scale(s, s); ctx.strokeStyle = 'rgba(80,40,20,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-10, -11); ctx.quadraticCurveTo(12, -17, 34, -12); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     THE LARVA (side-on, facing +x), canonical 10 long
     ============================================================ */
  function drawLarva(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, F = FORMS[o.form] || FORMS.normal, inst = o.instar || 1;
    ctx.save(); ctx.scale(s, s);
    const beat = Math.sin(ph), sc = hexToRgb(F.shell);
    /* feathery swimming legs (the exopods) beating under the thorax */
    ctx.strokeStyle = 'rgba(255,236,210,.8)'; ctx.lineWidth = .45; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = .7 + Math.sin(ph + k * .9) * .55, L = 4.5 + inst * .4;
      const x0 = 1.4 - k * 1.3, y0 = 2.2, x1 = x0 - Math.cos(a) * L * .4, y1 = y0 + Math.sin(a) * L;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      for (let j = 1; j <= 3; j++) { const t = j / 4, px = lerp(x0, x1, t), py = lerp(y0, y1, t); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 1.2, py + .5); ctx.moveTo(px, py); ctx.lineTo(px + 1, py + .7); ctx.stroke(); }
    }
    /* the tail: thin segments and a small fan */
    ctx.strokeStyle = 'rgba(255,230,205,.85)'; ctx.fillStyle = 'rgba(255,236,214,.5)'; ctx.lineWidth = .5;
    ctx.beginPath(); ctx.moveTo(-3, -.6); ctx.quadraticCurveTo(-7, -.2 + beat * .5, -10.5, 1.5 + beat * .8); ctx.lineTo(-10.5, 2.8 + beat * .8); ctx.quadraticCurveTo(-7, 1.8 + beat * .5, -3, 1.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let k = 1; k <= 4; k++) { const x = -3 - k * 1.7; ctx.beginPath(); ctx.moveTo(x, -.4); ctx.lineTo(x, 1.9); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-10.5, 2.1 + beat * .8); ctx.lineTo(-13, .4 + beat); ctx.lineTo(-13.6, 2.2 + beat); ctx.lineTo(-13, 4 + beat); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the spiky back and the rostrum */
    ctx.strokeStyle = 'rgba(255,240,225,.9)'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(3.8, -1.2); ctx.lineTo(7.2 + inst * .3, -2.2); ctx.stroke();
    for (const [x, y] of [[-1, -3.2], [1.2, -3.4]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - .8, y - 2.4); ctx.stroke(); }
    /* the see-through carapace */
    const g = ctx.createRadialGradient(.6, -1, .3, 1, -.4, 4.6);
    g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(.5, 'rgba(255,236,214,.42)'); g.addColorStop(1, 'rgba(240,200,170,.55)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .4;
    ctx.beginPath(); ctx.ellipse(1, -.4, 4.4, 2.8, .05, 0, TAU); ctx.fill(); ctx.stroke();
    /* colour spots (chromatophores) and the green gut */
    ctx.fillStyle = rgbStr(sc, .75);
    for (const [x, y, r] of [[-1.6, -1.4, .55], [.4, 1.2, .6], [-2.6, .4, .45], [2.4, -1.6, .4], [3.2, .8, .4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(120,170,60,.45)'; ctx.beginPath(); ctx.ellipse(0, .2, 2, .8, .2, 0, TAU); ctx.fill();
    /* the huge eye on its short stalk */
    ctx.fillStyle = '#0c0c14'; ctx.beginPath(); ctx.arc(4.2, -1.8, 1.7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3.8, -2.3, .45, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* stage IV: a tiny lobster swimming forwards, tail out, paddles beating */
  function drawPostlarva(ctx, o) {
    drawLobster(ctx, { s: o.s || .08, form: o.form, sex: 'boy', swim: o.ph || 0, simple: true, ph: o.ph, seed: 2, up: .15 });
  }
  function drawEgg(ctx, o = {}) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-.35, -.4, .1, 0, 0, 1.1);
    g.addColorStop(0, '#8a6a5a'); g.addColorStop(.5, '#3a2a26'); g.addColorStop(1, '#16100e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    if (o.eye) { ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.beginPath(); ctx.arc(.3, -.1, .22, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-.35, -.4, .22, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     PLANKTON AND THE SEA'S VISITORS
     ============================================================ */
  function drawPlankton(ctx, q, night, t) {
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + t * .2);
    switch (q.kind) {
      case 'diatom': {
        ctx.fillStyle = 'rgba(120,200,90,.85)'; ctx.strokeStyle = 'rgba(220,255,200,.9)'; ctx.lineWidth = .18;
        ctx.beginPath(); ctx.arc(0, 0, 1.1, 0, TAU); ctx.fill(); ctx.stroke();
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 1.1, Math.sin(a) * 1.1); ctx.stroke(); }
        break;
      }
      case 'chain': {
        ctx.fillStyle = 'rgba(150,200,80,.85)'; ctx.strokeStyle = 'rgba(230,255,200,.8)'; ctx.lineWidth = .15;
        for (let k = -2; k <= 2; k++) { ctx.fillRect(k * .8 - .35, -.45, .7, .9); ctx.strokeRect(k * .8 - .35, -.45, .7, .9); }
        ctx.beginPath(); ctx.moveTo(-2, -.5); ctx.lineTo(-2.6, -1.6); ctx.moveTo(2, .5); ctx.lineTo(2.6, 1.6); ctx.stroke();
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
  /* the basking shark, facing +x, canonical length 1000; the cavernous mouth at the front */
  function drawBaskingShark(ctx, o) {
    const s = o.s || 1, t = o.t || 0, gulp = o.gulp || 0;
    ctx.save(); ctx.scale(s, s);
    const sw = Math.sin(t * 1.1) * 22;
    ctx.fillStyle = '#4a4a44';
    ctx.beginPath(); ctx.moveTo(-430, -6); ctx.quadraticCurveTo(-520, -40 + sw * .3, -560, -170 + sw); ctx.quadraticCurveTo(-540, -50, -500, 0); ctx.quadraticCurveTo(-540, 40, -555, 120 + sw * .7); ctx.quadraticCurveTo(-500, 30 + sw * .2, -430, 14); ctx.fill();
    const g = ctx.createLinearGradient(0, -90, 0, 90);
    g.addColorStop(0, '#3e3e38'); g.addColorStop(.55, '#6a665c'); g.addColorStop(.62, '#b8b4a8'); g.addColorStop(1, '#dcd8cc');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(470, -30); ctx.quadraticCurveTo(440, -90, 300, -100); ctx.quadraticCurveTo(0, -116, -300, -62); ctx.quadraticCurveTo(-420, -30, -440, -6);
    ctx.lineTo(-440, 14); ctx.quadraticCurveTo(-300, 56, 0, 86); ctx.quadraticCurveTo(300, 94, 440, 60 + gulp * 20); ctx.quadraticCurveTo(480, 30, 470, -30);
    ctx.fill();
    /* the huge open mouth with the pale gill rakers inside */
    ctx.fillStyle = '#1e1a1c';
    ctx.beginPath(); ctx.moveTo(470, -30); ctx.quadraticCurveTo(440, 20 + gulp * 30, 400, 40 + gulp * 26); ctx.quadraticCurveTo(430, 30, 440, 60 + gulp * 20); ctx.quadraticCurveTo(480, 30, 470, -30); ctx.fill();
    ctx.strokeStyle = 'rgba(220,210,200,.35)'; ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(430 - k * 5, -10 + k * 6); ctx.lineTo(412 - k * 5, 30 + gulp * 20 + k * 2); ctx.stroke(); }
    /* the five enormous gill slits almost ringing the body */
    ctx.strokeStyle = 'rgba(20,18,22,.7)'; ctx.lineWidth = 5;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(330 - k * 22, -70); ctx.quadraticCurveTo(312 - k * 22, 0, 330 - k * 22, 70); ctx.stroke(); }
    /* fins: the tall dorsal, the pectoral, the little second dorsal */
    ctx.fillStyle = '#3e3e38';
    ctx.beginPath(); ctx.moveTo(60, -108); ctx.quadraticCurveTo(-10, -230, -90, -240); ctx.quadraticCurveTo(-70, -150, -110, -94); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-300, -70); ctx.quadraticCurveTo(-330, -110, -360, -112); ctx.quadraticCurveTo(-345, -80, -370, -58); ctx.fill();
    ctx.beginPath(); ctx.moveTo(230, 66); ctx.quadraticCurveTo(150, 200, 60, 240 + Math.sin(t) * 10); ctx.quadraticCurveTo(120, 140, 130, 76); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.ellipse(0, -60, 300, 20, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a1018'; ctx.beginPath(); ctx.arc(420, -44, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(418, -46, 2, 0, TAU); ctx.fill();
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
    /* the comb rows: beads of colour running down the sides */
    for (let row = 0; row < 4; row++) {
      const a = (row - 1.5) * .55 + Math.sin(j.ph * .3) * .2;
      for (let k = 0; k < 9; k++) {
        const u = k / 8, hue = ((u * 2 + t * 1.6 + row * .3) % 1) * 360;
        const x = Math.sin(a) * r * .7 * Math.sin(u * Math.PI), y = (u - .5) * r * 2.2;
        ctx.fillStyle = `hsla(${hue},100%,70%,${.55 + .4 * Math.sin(t * 6 - k)})`;
        ctx.beginPath(); ctx.arc(x, y, r * .09, 0, TAU); ctx.fill();
      }
    }
    /* two long trailing tentacles */
    ctx.strokeStyle = 'rgba(230,245,255,.5)'; ctx.lineWidth = .6;
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * r * .3, r * 1.1); ctx.quadraticCurveTo(k * r * .6 + Math.sin(t + k) * 6, r * 2, k * r * .2 + Math.sin(t * .7 + k) * 10, r * 3); ctx.stroke(); }
    ctx.restore();
  }
  /* a tern: white, black cap, forked tail, long narrow wings; canonical span 200 */
  function drawTern(ctx, o) {
    const s = o.s || 1, flap = Math.sin(o.ph || 0) * .3;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#f4f4f8';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -26 - flap * 60, -100, -14 - flap * 70); ctx.quadraticCurveTo(-50, -2, -8, 6); ctx.quadraticCurveTo(50, -2, 100, -14 - flap * 70); ctx.quadraticCurveTo(30, -26 - flap * 60, 0, 0); ctx.fill();
    ctx.fillStyle = '#d8d8e0'; ctx.beginPath(); ctx.moveTo(-10, 4); ctx.quadraticCurveTo(-60, -8 - flap * 60, -98, -14 - flap * 70); ctx.quadraticCurveTo(-55, 2, -8, 8); ctx.fill();
    ctx.fillStyle = '#f4f4f8'; ctx.beginPath(); ctx.ellipse(2, 6, 18, 6, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16, 6); ctx.lineTo(-40, 16); ctx.lineTo(-28, 7); ctx.lineTo(-40, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.ellipse(16, 2, 8, 5, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#e8402a'; ctx.beginPath(); ctx.moveTo(22, 4); ctx.lineTo(38, 8); ctx.lineTo(22, 9); ctx.fill();
    ctx.restore();
  }
  /* the hunters, facing +x, canonical 100 long: cod (olive, spotted, a chin barbel), sculpin (spiny, flat), striped bass */
  function drawHunter(ctx, kind, o) {
    const s = o.s || 1, ph = o.ph || 0, tail = Math.sin(ph) * 5;
    ctx.save(); ctx.scale(s, s);
    if (kind === 'cod') {
      const g = ctx.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, '#5a5a2a'); g.addColorStop(.6, '#9a8a4a'); g.addColorStop(1, '#e8e0c0');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(50, -2); ctx.quadraticCurveTo(30, -18, -10, -16); ctx.quadraticCurveTo(-35, -12, -46, -2); ctx.lineTo(-46, 4); ctx.quadraticCurveTo(-30, 14, -5, 15); ctx.quadraticCurveTo(30, 16, 50, 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-58, -12 + tail); ctx.lineTo(-56, 0); ctx.lineTo(-58, 12 + tail); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a4a22'; for (const [x0, x1] of [[-2, 22], [-20, -6], [-36, -24]]) { ctx.beginPath(); ctx.moveTo(x1, -14); ctx.lineTo((x0 + x1) / 2, -26); ctx.lineTo(x0, -14); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(10, 14); ctx.lineTo(-2, 24); ctx.lineTo(-12, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(44, -3); ctx.quadraticCurveTo(10, -9, -40, -3); ctx.stroke();
      ctx.fillStyle = 'rgba(90,70,20,.6)'; const R = mulberry32(3); for (let k = 0; k < 30; k++) { ctx.beginPath(); ctx.arc(-40 + R() * 80, -12 + R() * 22, 1 + R() * 1.4, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(44, 7); ctx.lineTo(46, 13); ctx.stroke();
      ctx.fillStyle = '#101820'; ctx.beginPath(); ctx.arc(38, -4, 3.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(37, -5, 1, 0, TAU); ctx.fill();
    } else if (kind === 'sculpin') {
      const g = ctx.createLinearGradient(0, -10, 0, 12); g.addColorStop(0, '#6a4a2a'); g.addColorStop(1, '#c8a870');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(50, 2); ctx.quadraticCurveTo(40, -16, 10, -10); ctx.quadraticCurveTo(-20, -8, -46, -2); ctx.lineTo(-46, 4); ctx.quadraticCurveTo(-10, 12, 20, 12); ctx.quadraticCurveTo(44, 12, 50, 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-56, -9 + tail); ctx.lineTo(-56, 9 + tail); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); for (let k = 0; k < 7; k++) { const x = 20 - k * 8; ctx.moveTo(x, -8); ctx.lineTo(x - 3, -22 + Math.sin(k) * 4); ctx.lineTo(x - 7, -8); } ctx.fill();
      ctx.beginPath(); ctx.moveTo(28, 10); ctx.quadraticCurveTo(22, 26, 0, 20); ctx.fill();
      ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(30, -8); ctx.lineTo(36, -16); ctx.moveTo(22, -6); ctx.lineTo(24, -14); ctx.stroke();
      ctx.fillStyle = 'rgba(60,40,20,.5)'; const R = mulberry32(5); for (let k = 0; k < 20; k++) { ctx.beginPath(); ctx.ellipse(-40 + R() * 80, -4 + R() * 12, 3, 1.5, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#101820'; ctx.beginPath(); ctx.arc(36, -6, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd080'; ctx.beginPath(); ctx.arc(35, -7, 1.2, 0, TAU); ctx.fill();
    } else {
      const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, '#3a4a5a'); g.addColorStop(.5, '#c0c8d0'); g.addColorStop(1, '#f0f4f8');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(50, -1); ctx.quadraticCurveTo(28, -15, -8, -13); ctx.quadraticCurveTo(-34, -10, -46, -2); ctx.lineTo(-46, 3); ctx.quadraticCurveTo(-30, 12, -4, 13); ctx.quadraticCurveTo(28, 14, 50, 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-58, -13 + tail); ctx.lineTo(-54, 0); ctx.lineTo(-58, 13 + tail); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a4a5a'; ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(-8, -26); ctx.lineTo(-18, -12); ctx.fill(); ctx.beginPath(); ctx.moveTo(-20, -11); ctx.lineTo(-28, -20); ctx.lineTo(-34, -10); ctx.fill();
      ctx.strokeStyle = 'rgba(30,40,60,.7)'; ctx.lineWidth = 1.3; for (let k = 0; k < 7; k++) { const y = -9 + k * 3; ctx.beginPath(); ctx.moveTo(40 - k * 2, y); ctx.quadraticCurveTo(0, y - 1, -42, y + 1); ctx.stroke(); }
      ctx.fillStyle = '#101820'; ctx.beginPath(); ctx.arc(38, -4, 3, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(37, -5, 1, 0, TAU); ctx.fill();
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
  /* the lobster boat seen from the side on the surface, canonical length 240, waterline at y = 0 */
  function drawBoat(ctx, o) {
    const s = o.s || 1, roll = o.roll || 0;
    ctx.save(); ctx.scale(s, s); ctx.rotate(roll * .04);
    ctx.fillStyle = '#f0ece0'; ctx.strokeStyle = '#4a4a50'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-120, -14); ctx.lineTo(124, -22); ctx.lineTo(112, 14); ctx.quadraticCurveTo(0, 22, -100, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b02a2a'; ctx.beginPath(); ctx.moveTo(-108, 2); ctx.lineTo(118, -4); ctx.lineTo(112, 14); ctx.quadraticCurveTo(0, 22, -100, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8e4d8'; ctx.strokeStyle = '#4a4a50'; rr(ctx, 10, -58, 70, 44, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a9ac8'; rr(ctx, 18, -52, 22, 16, 3); ctx.fill(); rr(ctx, 48, -52, 22, 16, 3); ctx.fill();
    ctx.fillStyle = '#4a4a50'; ctx.fillRect(40, -88, 3, 30); ctx.fillStyle = '#e8a020'; ctx.beginPath(); ctx.arc(42, -90, 4, 0, TAU); ctx.fill();
    /* the davit and the hauler, the pile of traps at the stern */
    ctx.strokeStyle = '#6a6a70'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, -14); ctx.lineTo(-40, -50); ctx.lineTo(-70, -44); ctx.stroke();
    ctx.fillStyle = '#6a8a4a'; for (let k = 0; k < 2; k++) rr(ctx, -112 + k * 2, -34 + k * 10, 34, 14, 2); ctx.fill();
    ctx.strokeStyle = '#3a5a2a'; ctx.lineWidth = .8; for (let x = -108; x < -80; x += 5) { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x, -10); ctx.stroke(); }
    ctx.restore();
  }
  /* the lobsterman: oilskins, boots, a gauge in his hand; canonical height 80, feet at 0 */
  function drawLobsterman(ctx, o) {
    const s = o.s || 1, wave = o.wave || 0, measure = o.measure || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#2a2a2e'; rr(ctx, -12, -28, 9, 28, 3); ctx.fill(); rr(ctx, 3, -28, 9, 28, 3); ctx.fill();
    ctx.fillStyle = '#e89a20'; rr(ctx, -15, -62, 30, 36, 8); ctx.fill();
    ctx.fillStyle = '#d8a878'; ctx.beginPath(); ctx.arc(0, -72, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8a040'; ctx.beginPath(); ctx.ellipse(0, -80, 16, 4, 0, 0, TAU); ctx.fill(); rr(ctx, -9, -90, 18, 11, 5); ctx.fill();
    ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(0, -66, 7, 3, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#2a2016'; ctx.beginPath(); ctx.arc(-3.5, -73, 1.3, 0, TAU); ctx.arc(3.5, -73, 1.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e89a20'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const a = measure ? -.4 : -2.2 + Math.sin(wave * 3) * .5;
    ctx.beginPath(); ctx.moveTo(10, -56); ctx.lineTo(10 + Math.cos(a) * 22, -56 + Math.sin(a) * 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, -56); ctx.lineTo(-20, -40); ctx.stroke();
    /* the brass gauge */
    ctx.fillStyle = '#c8a030'; ctx.save(); ctx.translate(10 + Math.cos(a) * 24, -56 + Math.sin(a) * 24); ctx.rotate(a + .4); ctx.fillRect(-2, -1.5, 16, 3); ctx.fillRect(12, -6, 3, 8); ctx.fillRect(-2, -6, 3, 8); ctx.restore();
    ctx.restore();
  }
  /* a wire lobster trap with its bait bag and the rope up to the buoy, canonical 60 wide, 30 high, base at 0 */
  function drawTrap(ctx, o) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(40,80,40,.25)'; ctx.strokeStyle = '#4a8a4a'; ctx.lineWidth = 1.2;
    rr(ctx, -30, -30, 60, 30, 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = .5; for (let x = -30; x <= 30; x += 4) { ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(x, 0); ctx.stroke(); } for (let y = -30; y <= 0; y += 4) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(30, y); ctx.stroke(); }
    ctx.strokeStyle = '#2a5a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.moveTo(-30, -30); ctx.lineTo(30, -30); ctx.moveTo(0, -30); ctx.lineTo(0, 0); ctx.stroke();
    /* the funnel entrance, and the bait bag hanging inside */
    ctx.strokeStyle = 'rgba(160,220,160,.8)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-30, -24); ctx.lineTo(-14, -16); ctx.moveTo(-30, -6); ctx.lineTo(-14, -14); ctx.stroke();
    if (o.bait) { ctx.fillStyle = '#b0a0a0'; ctx.beginPath(); ctx.ellipse(10, -14, 5, 7, .2, 0, TAU); ctx.fill(); ctx.fillStyle = '#8a7a9a'; ctx.beginPath(); ctx.ellipse(11, -12, 2, 4, .3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#7a4a2a'; for (const x of [-26, 26]) ctx.fillRect(x - 1.5, 0, 3, 3);
    ctx.restore();
  }
  /* a kelp frond: a long stipe with a wavy blade, swaying; canonical height h */
  function drawKelp(ctx, k, t, ground) {
    const sw = Math.sin(t * .6 + k.ph) * 10 + Math.sin(t * 1.3 + k.ph * 2) * 4;
    ctx.save(); ctx.translate(k.x, ground);
    ctx.fillStyle = '#4a3a20'; ctx.beginPath(); ctx.ellipse(0, 1, 6, 2.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5a4a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sw * .4, -k.h * .5, sw, -k.h); ctx.stroke();
    const g = ctx.createLinearGradient(0, -k.h, 0, 0); g.addColorStop(0, '#9a8a3a'); g.addColorStop(.5, '#6a7a2a'); g.addColorStop(1, '#3a5a22');
    ctx.fillStyle = g; ctx.globalAlpha = .85;
    ctx.beginPath(); ctx.moveTo(sw * .1, -k.h * .3);
    for (let i = 0; i <= 10; i++) { const u = i / 10, y = -k.h * (.3 + u * .72), x = sw * (.3 + u * .7) + Math.sin(u * 9 + t * 1.5 + k.ph) * k.w * .8; ctx.lineTo(x + k.w * (1 - u * .5), y); }
    for (let i = 10; i >= 0; i--) { const u = i / 10, y = -k.h * (.3 + u * .72), x = sw * (.3 + u * .7) + Math.sin(u * 9 + t * 1.5 + k.ph) * k.w * .8; ctx.lineTo(x - k.w * (1 - u * .5), y); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ---------- food on the sea floor ---------- */
  function drawFood(ctx, it, t) {
    const k = FOOD_KINDS[it.kind], left = it.bites / k.bites;
    ctx.save(); ctx.rotate(it.rot * .3);
    switch (it.kind) {
      case 'mussel': {
        const g = ctx.createLinearGradient(-5, -3, 5, 3); g.addColorStop(0, '#2a2a5a'); g.addColorStop(.6, '#1a1a3a'); g.addColorStop(1, '#4a4a7a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-6, 1); ctx.quadraticCurveTo(-4, -5, 4, -4); ctx.quadraticCurveTo(7, -2, 6, 2); ctx.quadraticCurveTo(0, 4, -6, 1); ctx.fill();
        ctx.strokeStyle = 'rgba(200,210,255,.5)'; ctx.lineWidth = .4; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-5, 1); ctx.quadraticCurveTo(0, -4 + i, 5 - i, -3 + i * 1.3); ctx.stroke(); }
        if (left < 1) { ctx.fillStyle = '#f0b060'; ctx.beginPath(); ctx.ellipse(1, 0, 3, 1.6, .2, 0, TAU); ctx.fill(); }
        break;
      }
      case 'crab': {
        ctx.fillStyle = '#8a6a3a'; ctx.strokeStyle = '#4a3010'; ctx.lineWidth = .6;
        for (const s2 of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(s2 * 3, -1 + i); ctx.lineTo(s2 * 7, -3 + i * 2 + Math.sin(t * 6 + i) * .6); ctx.lineTo(s2 * 9, 1 + i * 1.5); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(0, 0, 5, 3.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-5, 2.5, 2, 1.3, .5, 0, TAU); ctx.ellipse(5, 2.5, 2, 1.3, -.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#101010'; ctx.beginPath(); ctx.arc(-1.5, -2.6, .6, 0, TAU); ctx.arc(1.5, -2.6, .6, 0, TAU); ctx.fill();
        if (left < 1) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(2, 0, 2.5 * (1 - left), 0, TAU); ctx.fill(); }
        break;
      }
      case 'urchin': {
        ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = .7; for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 3.2); ctx.lineTo(Math.cos(a) * 7.5, Math.sin(a) * 6.4); ctx.stroke(); }
        const g = ctx.createRadialGradient(-1, -1.5, .5, 0, 0, 5); g.addColorStop(0, '#9ac86a'); g.addColorStop(1, '#3a6a2a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 3.8, 0, 0, TAU); ctx.fill();
        if (left < 1) { ctx.fillStyle = '#f0c060'; ctx.beginPath(); ctx.ellipse(0, .5, 3, 2, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'snail': {
        const g = ctx.createRadialGradient(-1, -1, .5, 0, 0, 4.5); g.addColorStop(0, '#8a7a5a'); g.addColorStop(1, '#2a2418');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,230,200,.45)'; ctx.lineWidth = .6; ctx.beginPath(); for (let a = 0; a < 9; a += .3) ctx.lineTo(Math.cos(a) * a * .4, Math.sin(a) * a * .4); ctx.stroke();
        ctx.fillStyle = '#4a4a3a'; ctx.beginPath(); ctx.ellipse(4, 2.4, 3, 1.4, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'kelp': {
        ctx.fillStyle = '#7a8a2a'; ctx.beginPath(); ctx.moveTo(-9, 0); for (let i = 0; i <= 8; i++) ctx.lineTo(-9 + i * 2.25, -2 - Math.sin(i * 1.3 + t * 2) * 1.8); ctx.lineTo(9, 0); for (let i = 8; i >= 0; i--) ctx.lineTo(-9 + i * 2.25, 2 + Math.sin(i * 1.3 + t * 2) * 1.8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8 * left, 0); ctx.stroke();
        break;
      }
      case 'drift': {
        ctx.fillStyle = '#b89a6a'; ctx.beginPath(); ctx.moveTo(-3, 1); ctx.lineTo(-1, -3); ctx.lineTo(3, -2); ctx.lineTo(3.5, 2); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(-.5, -.5, 1.2, 0, TAU); ctx.fill();
        break;
      }
      case 'bait': { ctx.fillStyle = '#a89aa8'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, .3, 0, TAU); ctx.fill(); ctx.fillStyle = '#7a6a8a'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(8, -3); ctx.lineTo(8, 3); ctx.fill(); break; }
    }
    ctx.restore();
  }

  /* ============================================================
     ICONS (HUD, life wheel, stickers, reading pictures): drawn in
     a 100×100 box centred on 0,0
     ============================================================ */
  function iconLob(ctx, form, extra = {}) { ctx.translate(-6, 4); drawLobster(ctx, Object.assign({ s: .48, form, sex: 'boy', seed: 3, crusher: 'right' }, extra)); }
  function cobbleIcon(ctx, hollow) {
    const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 40); g.addColorStop(0, '#c8c0b0'); g.addColorStop(1, '#5a5448');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -6, 40, 26, -.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8a888'; ctx.beginPath(); ctx.ellipse(0, 28, 50, 10, 0, 0, TAU); ctx.fill();
    if (hollow) { ctx.fillStyle = '#120c08'; ctx.beginPath(); ctx.ellipse(4, 20, 26, 9, 0, Math.PI, TAU); ctx.fill(); }
  }
  function drawIcon(ctx, key, px, form) {
    form = form || 'normal';
    /* the see-through sea creatures sit in a drop of blue water, so they show up on a pale page */
    if (['egg', 'larva', 'postlarva', 'plankton', 'copepod', 'diatom', 'combjelly'].includes(key)) {
      const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 48); g.addColorStop(0, '#bfe8f8'); g.addColorStop(1, '#3a8ac0');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
    }
    if (['kelp', 'deep', 'mud', 'boat'].includes(key)) { ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.clip(); }
    switch (key) {
      case 'egg': for (const [x, y] of [[-8, -6], [8, -4], [0, 8], [-14, 10], [14, 10], [0, -16]]) { ctx.save(); ctx.translate(x, y); drawEgg(ctx, { s: 9, eye: true }); ctx.restore(); } break;
      case 'eggs': {
        ctx.save(); ctx.translate(10, -14); drawLobster(ctx, { s: .42, form, sex: 'girl', eggs: 1, seed: 5, crusher: 'right' }); ctx.restore();
        break;
      }
      case 'larva': ctx.translate(2, 0); drawLarva(ctx, { s: 3.4, ph: .8, form, instar: 2 }); break;
      case 'postlarva': ctx.translate(4, 4); drawPostlarva(ctx, { s: .48, ph: .8, form }); break;
      case 'juvenile': case 'baby': ctx.translate(-2, 4); drawLobster(ctx, { s: .3, form, sex: 'boy', seed: 3, simple: true }); break;
      case 'young': iconLob(ctx, form, { s: .4 }); break;
      case 'lobster': case 'adult': case 'boy': iconLob(ctx, form, { s: .48 }); break;
      case 'girl': case 'female': iconLob(ctx, form, { s: .48, sex: 'girl', eggs: key === 'female' ? .7 : 0, seed: 5 }); break;
      case 'walk': { iconLob(ctx, form, { s: .4, moving: true, walk: 1 }); ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-46, 30); ctx.lineTo(-30, 18); ctx.lineTo(-30, 26); ctx.lineTo(-10, 26); ctx.lineTo(-10, 34); ctx.lineTo(-30, 34); ctx.lineTo(-30, 42); ctx.closePath(); ctx.fill(); break; }
      case 'rival': iconLob(ctx, 'normal', { s: .44, up: .9, pinch: .6, seed: 8 }); break;
      case 'boss': { iconLob(ctx, form, { s: .44, up: 1 }); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(-10, -38); ctx.lineTo(-2, -28); ctx.lineTo(6, -40); ctx.lineTo(12, -28); ctx.lineTo(18, -38); ctx.lineTo(20, -22); ctx.closePath(); ctx.fill(); ctx.stroke(); break; }
      case 'claw': { ctx.rotate(-.5); ctx.translate(-40, 14); ctx.scale(.95, .95); claw(ctx, { sx: 0, sy: 0, k: 1, up: 0, pinch: .5, cols: lobCols(form, 0), crusher: true, near: true, boy: true }); break; }
      case 'tail': { ctx.translate(-6, 0); drawLobster(ctx, { s: .5, form, flip: .9, simple: true, seed: 3, crusher: 'right' }); break; }
      case 'shell': ctx.translate(-4, 2); drawExuvia(ctx, .46, form); break;
      case 'plankton': for (const q of [{ x: -16, y: -10, kind: 'diatom', rot: 0 }, { x: 14, y: -14, kind: 'chain', rot: .4 }, { x: 0, y: 12, kind: 'copepod', rot: 0, vx: 1, vy: -.3 }, { x: -18, y: 16, kind: 'dino', rot: 0, glow: .6 }, { x: 18, y: 14, kind: 'diatom', rot: .5 }]) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(7, 7); ctx.translate(-q.x, -q.y); drawPlankton(ctx, Object.assign({ glow: q.glow || 0 }, q, { x: q.x, y: q.y }), .3, 0); ctx.restore(); } break;
      case 'diatom': ctx.scale(24, 24); drawPlankton(ctx, { x: 0, y: 0, kind: 'diatom', rot: 0 }, 0, 0); break;
      case 'copepod': ctx.scale(16, 16); drawPlankton(ctx, { x: 0, y: 0, kind: 'copepod', rot: 0, vx: 1, vy: -.4 }, 0, 0); break;
      case 'combjelly': drawCombJelly(ctx, { x: 0, y: -4, r: 26, ph: 1.2 }, 1); break;
      case 'basking': ctx.translate(4, 4); drawBaskingShark(ctx, { s: .082, t: 0, gulp: .7 }); break;
      case 'herring': case 'fish': drawFish(ctx, { s: 2.2, col: '#c8d8e8', col2: '#3a5a7a' }); break;
      case 'tern': case 'bird': ctx.translate(0, 4); drawTern(ctx, { s: .42, ph: 1 }); break;
      case 'seal': drawSeal(ctx, { s: .72, ph: 1 }); break;
      case 'cod': drawHunter(ctx, 'cod', { s: .82, ph: 1 }); break;
      case 'cobble': case 'rock': cobbleIcon(ctx, false); break;
      case 'den': { cobbleIcon(ctx, true); ctx.save(); ctx.translate(6, 18); drawLobster(ctx, { s: .18, form, tuck: .3, simple: true, seed: 3 }); ctx.restore(); break; }
      case 'kelp': { ctx.fillStyle = '#2a6a9a'; ctx.fillRect(-46, -46, 92, 92); for (const k of [{ x: -22, h: 80, ph: 0, w: 7 }, { x: 4, h: 92, ph: 2, w: 8 }, { x: 28, h: 70, ph: 4, w: 6 }]) drawKelp(ctx, k, 1, 44); break; }
      case 'mussel': ctx.scale(7, 7); drawFood(ctx, { kind: 'mussel', bites: 2, col: 0, rot: 0 }, 0); break;
      case 'crab': ctx.scale(5.5, 5.5); drawFood(ctx, { kind: 'crab', bites: 3, col: 0, rot: 0 }, 0); break;
      case 'urchin': ctx.scale(5.5, 5.5); drawFood(ctx, { kind: 'urchin', bites: 2, col: 0, rot: 0 }, 0); break;
      case 'snail': ctx.scale(7, 7); drawFood(ctx, { kind: 'snail', bites: 1, col: 0, rot: 0 }, 0); break;
      case 'trap': { ctx.translate(0, 18); ctx.scale(1.4, 1.4); drawTrap(ctx, { s: 1, bait: true }); ctx.strokeStyle = '#d8d0b0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(26, -30); ctx.lineTo(30, -56); ctx.stroke(); ctx.fillStyle = '#e8402a'; ctx.beginPath(); ctx.ellipse(30, -60, 4, 6, 0, 0, TAU); ctx.fill(); break; }
      case 'lobsterman': ctx.translate(0, 44); drawLobsterman(ctx, { s: .92, measure: 1 }); break;
      case 'boat': { ctx.fillStyle = '#5aa8e0'; ctx.fillRect(-46, 10, 92, 36); ctx.translate(0, 10); drawBoat(ctx, { s: .36 }); break; }
      case 'moon': {
        ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,190,140,.6)'; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        break;
      }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'snow': ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(-12, -8, 16, 0, TAU); ctx.arc(8, -14, 18, 0, TAU); ctx.arc(22, -4, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; for (const [x, y] of [[-18, 20], [-2, 30], [14, 18], [26, 32], [-28, 34]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); } break;
      case 'mud': { ctx.fillStyle = '#2a4a6a'; ctx.fillRect(-46, -46, 92, 40); ctx.fillStyle = '#5a5244'; ctx.beginPath(); ctx.moveTo(-46, -6); ctx.quadraticCurveTo(0, -16, 46, -4); ctx.lineTo(46, 46); ctx.lineTo(-46, 46); ctx.fill(); ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.ellipse(6, 16, 22, 12, 0, 0, TAU); ctx.fill(); ctx.save(); ctx.translate(6, 18); drawLobster(ctx, { s: .14, form, tuck: .5, simple: true, seed: 3 }); ctx.restore(); break; }
      case 'deep': { const g = ctx.createLinearGradient(0, -46, 0, 46); g.addColorStop(0, '#2a7ac0'); g.addColorStop(1, '#061830'); ctx.fillStyle = g; ctx.fillRect(-46, -46, 92, 92); ctx.fillStyle = '#4a4238'; ctx.beginPath(); ctx.moveTo(-46, 10); ctx.quadraticCurveTo(-10, 0, 20, 24); ctx.quadraticCurveTo(36, 34, 46, 40); ctx.lineTo(46, 46); ctx.lineTo(-46, 46); ctx.fill(); ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(30, -34); ctx.lineTo(18, -14); ctx.lineTo(26, -14); ctx.lineTo(26, 6); ctx.lineTo(34, 6); ctx.lineTo(34, -14); ctx.lineTo(42, -14); ctx.closePath(); ctx.fill(); break; }
      case 'sea': case 'water': {
        ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 0); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 2); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a6ab0'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 14); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, 14 + Math.sin(x * .12 + 2) * 6); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -40; x <= 40; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 4); ctx.stroke();
        break;
      }
      default: iconLob(ctx, form);
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

  return { drawLobster, claw, drawExuvia, drawLarva, drawPostlarva, drawEgg, drawPlankton, drawFish, drawBaskingShark, drawCombJelly, drawTern, drawHunter, drawSeal, drawBoat, drawLobsterman, drawTrap, drawKelp, drawFood, drawIcon, icon, lobCols };
})();
