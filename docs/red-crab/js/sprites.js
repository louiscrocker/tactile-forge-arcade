/* ============================================================
   sprites.js — every living thing, drawn with paths
   ============================================================
   THE CRAB is drawn from the front, the way a crab looks at you
   when it scuttles sideways past: a domed shell 100 units wide
   (`s` scales it), the eyes up on their stalks, the two claws
   folded in front of the mouth (a boy's are bigger), and four
   walking legs down each side.  The origin is the middle of the
   shell; the leg tips touch the ground at y = +42·s.

   THE LARVAE are drawn side-on, facing +x: the zoea is a see-
   through bubble with a huge black eye, a long spine on top, a
   spike pointing down, a curled tail and feathery swimming legs;
   the megalopa is a little shrimp-crab with claws, eyes on stalks
   and a swimming tail.

   Then plankton, fish, the whale shark, the manta, jellyfish,
   the turtle, the robber crab, the frigatebird, the ranger, food
   on the forest floor, and the icons for the HUD, the stickers
   and the reading pictures.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();
  const C = (hex) => hexToRgb(hex);

  /* the shell colours of a form, washed pale for a soft new shell */
  function crabCols(form, pale, robber) {
    if (robber) return { shell: C('#5a4f9e'), shell2: C('#2e2864'), leg: C('#d0682a'), claw: C('#f0b080'), eye: C('#101018') };
    const F = FORMS[form] || FORMS.red;
    const pk = [255, 214, 200], m = (c) => pale > 0 ? mixRgb(C(c), pk, pale * .75) : C(c);
    return { shell: m(F.shell), shell2: m(F.shell2), leg: m(F.leg), claw: m(F.claw), eye: C(F.eye) };
  }

  /* one crab leg: hip → knee (up and out) → the pointed tip on the ground */
  function crabLeg(ctx, hx, hy, kx, ky, tx, ty, w, col, col2) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col2; ctx.lineWidth = w + 2.2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = w * .8; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(lerp(kx, tx, .72), lerp(ky, ty, .72)); ctx.stroke();
    /* the last joint tapers to a sharp tip */
    ctx.lineWidth = w * .5; ctx.beginPath(); ctx.moveTo(lerp(kx, tx, .72), lerp(ky, ty, .72)); ctx.lineTo(tx, ty); ctx.stroke();
    /* a shine along the top of the thigh */
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = w * .25;
    ctx.beginPath(); ctx.moveTo(lerp(hx, kx, .2), lerp(hy, ky, .2) - w * .2); ctx.lineTo(lerp(hx, kx, .85), lerp(hy, ky, .85) - w * .2); ctx.stroke();
  }

  /* one claw: arm from the shoulder, then the big hand with its two fingers */
  function crabClaw(ctx, side, k, up, pinch, cols, big) {
    const sh = side;
    const ax = 30 * sh, ay = 12;                                  /* the shoulder under the shell's front corner */
    const ex = lerp(40 * sh, 52 * sh, up), ey = lerp(26, 2, up);  /* the elbow */
    const hx = lerp(17 * sh, 44 * sh, up), hy = lerp(32, -18, up);  /* the middle of the hand */
    const hand = 15 * k;
    const legS = rgbStr(cols.leg), dark = rgbStr(mixRgb(cols.shell2, [0, 0, 0], .3));
    ctx.lineCap = 'round';
    ctx.strokeStyle = dark; ctx.lineWidth = 10 * k + 2.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.lineTo(hx + sh * 8 * k, hy); ctx.stroke();
    ctx.strokeStyle = rgbStr(cols.shell); ctx.lineWidth = 10 * k; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.lineTo(hx + sh * 8 * k, hy); ctx.stroke();
    ctx.save();
    ctx.translate(hx, hy);
    /* folded: fingers point in and down; raised: fingers point up */
    ctx.rotate(lerp(sh > 0 ? Math.PI * .92 : Math.PI * .08, -Math.PI / 2 + sh * .25, up));
    /* the hand (propodus) */
    const g = ctx.createLinearGradient(0, -hand * .7, 0, hand * .7);
    g.addColorStop(0, rgbStr(mixRgb(cols.shell, [255, 255, 255], .25))); g.addColorStop(.55, rgbStr(cols.shell)); g.addColorStop(1, rgbStr(cols.shell2));
    ctx.fillStyle = g; ctx.strokeStyle = dark; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, 0, hand, hand * .62, 0, 0, TAU); ctx.fill(); ctx.stroke();
    /* the fixed finger and the moving finger, pale tipped */
    const open = pinch * .55;
    for (const [dy, rot] of [[-hand * .28, -open], [hand * .26, open * .3]]) {
      ctx.save(); ctx.translate(hand * .78, dy); ctx.rotate(rot);
      const fg = ctx.createLinearGradient(0, 0, hand * 1.1, 0); fg.addColorStop(0, rgbStr(cols.shell)); fg.addColorStop(.7, rgbStr(cols.claw)); fg.addColorStop(1, rgbStr(mixRgb(cols.claw, [40, 20, 10], .35)));
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(0, -hand * .2); ctx.quadraticCurveTo(hand * .7, -hand * .26, hand * 1.1, 0); ctx.quadraticCurveTo(hand * .6, hand * .14, 0, hand * .2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-hand * .2, -hand * .28, hand * .45, hand * .14, -.2, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = legS;
  }

  /* ============================================================
     THE CRAB
     o: { s, form, sex ('boy'|'girl'), walk, moving, pale (soft shell 0..1),
          wet, up (claws raised 0..1), pinch, eat, eyes (1 up .. 0 folded),
          eggs (egg mass 0..1), tuck (legs pulled in 0..1), robber, face }
     ============================================================ */
  function drawCrab(ctx, o) {
    const s = o.s || 1, boy = o.sex !== 'girl', robber = !!o.robber;
    const cols = crabCols(o.form, o.pale || 0, robber);
    const walk = o.walk || 0, tuck = o.tuck || 0, up = o.up || 0, eyes = o.eyes === undefined ? 1 : o.eyes;
    ctx.save();
    ctx.scale(s, s);
    if (o.face) ctx.rotate(o.face * .04 * (o.moving ? 1 : 0));
    const shellS = rgbStr(cols.shell), dark = rgbStr(mixRgb(cols.shell2, [0, 0, 0], .3));
    const legC = rgbStr(cols.leg), legD = rgbStr(mixRgb(cols.leg, [0, 0, 0], .45));
    const legW = robber ? 8 : 7.6, reach = robber ? 1.12 : 1;

    /* --- the walking legs, four a side, behind the shell --- */
    /* each leg: up and out to a high knee, then a long shin angling down and out to a pointed tip
       (the front pair reach forward-down, the back pair sit highest, like a real crab's splay) */
    const KNEE = [[50, -6], [68, -22], [86, -32], [100, -37]], TIP = [[54, 42], [88, 43], [118, 40], [146, 31]];
    for (const side of [-1, 1]) for (let k = 3; k >= 0; k--) {
      const hy = 6 - k * 6, hx = side * (40 - k * 1.5);
      const ph = walk + k * 1.7 + (side > 0 ? Math.PI : 0);
      const lift = o.moving ? Math.max(0, Math.sin(ph)) * 9 : 0, swing = o.moving ? Math.cos(ph) * 7 : 0;
      const spread = reach * (1 - tuck * .42);
      const kx = side * KNEE[k][0] * spread + swing * .5, ky = hy + KNEE[k][1] - lift * .5 - tuck * 6;
      const tx = side * TIP[k][0] * spread + swing, ty = TIP[k][1] - lift - tuck * 10;
      crabLeg(ctx, hx, hy, kx, ky, tx, ty, legW - k * .5, k % 2 ? legC : rgbStr(mixRgb(cols.leg, [255, 255, 255], .1)), legD);
    }
    /* --- the egg mass under a girl's tummy flap --- */
    if (o.eggs > 0) {
      const e = o.eggs, g = ctx.createRadialGradient(0, 26, 2, 0, 30, 30 * e + 6);
      g.addColorStop(0, '#5a3a3a'); g.addColorStop(.6, '#3a2228'); g.addColorStop(1, '#1e1216');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 26 + e * 4, 22 + e * 14, 10 + e * 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,220,.25)'; const R = mulberry32(7);
      for (let k = 0; k < 40 * e; k++) { ctx.beginPath(); ctx.arc((R() - .5) * (40 + e * 26), 26 + e * 4 + (R() - .5) * (16 + e * 14), 1.2, 0, TAU); ctx.fill(); }
    }
    /* --- the shell --- */
    const sg = ctx.createRadialGradient(-12, -22, 4, 0, -4, 62);
    sg.addColorStop(0, rgbStr(mixRgb(cols.shell, [255, 240, 220], .38))); sg.addColorStop(.45, shellS); sg.addColorStop(1, rgbStr(cols.shell2));
    ctx.fillStyle = sg; ctx.strokeStyle = dark; ctx.lineWidth = 2;
    ctx.beginPath();
    if (robber) { ctx.moveTo(-40, 8); ctx.bezierCurveTo(-46, -24, -26, -38, 0, -38); ctx.bezierCurveTo(26, -38, 46, -24, 40, 8); ctx.bezierCurveTo(36, 18, 16, 20, 0, 20); ctx.bezierCurveTo(-16, 20, -36, 18, -40, 8); }
    else { ctx.moveTo(-48, 6); ctx.bezierCurveTo(-53, -22, -30, -33, 0, -33); ctx.bezierCurveTo(30, -33, 53, -22, 48, 6); ctx.bezierCurveTo(44, 16, 20, 18, 0, 18); ctx.bezierCurveTo(-20, 18, -44, 16, -48, 6); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the grooves on top of the shell (an H), and little bumps */
    ctx.strokeStyle = 'rgba(60,10,6,.35)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-15, -29); ctx.quadraticCurveTo(-8, -14, -11, 4); ctx.moveTo(15, -29); ctx.quadraticCurveTo(8, -14, 11, 4); ctx.moveTo(-9, -13); ctx.quadraticCurveTo(0, -10, 9, -13); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; const RB = mulberry32(o.seed || 3);
    for (let k = 0; k < 18; k++) { const a = RB() * TAU, d = RB(); ctx.beginPath(); ctx.arc(Math.cos(a) * 38 * d, -8 + Math.sin(a) * 20 * d, 1 + RB() * 1.4, 0, TAU); ctx.fill(); }
    /* a wet shine across the top */
    ctx.fillStyle = `rgba(255,255,255,${.22 + (o.wet || 0) * .3})`;
    ctx.beginPath(); ctx.ellipse(-12, -24, 20, 5, -.12, 0, TAU); ctx.fill();
    if (o.wet > .3) { ctx.fillStyle = `rgba(255,255,255,${o.wet * .35})`; ctx.beginPath(); ctx.ellipse(16, -18, 8, 2.5, .3, 0, TAU); ctx.fill(); }
    /* --- the mouth plates under the front edge --- */
    const chew = o.eat ? Math.sin(o.eat * 18) * 2 : 0;
    ctx.fillStyle = rgbStr(mixRgb(cols.shell2, [60, 20, 60], .3));
    rr(ctx, -12, 13 + chew * .3, 11, 12, 3); ctx.fill(); rr(ctx, 1, 13 - chew * .3, 11, 12, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(0, 25); ctx.stroke();
    /* --- the eyes on their stalks (they fold down into grooves) --- */
    for (const side of [-1, 1]) {
      const bx = side * 13, by = 12, tx = side * (15 + eyes * 2), ty = lerp(13, -2, eyes);
      ctx.strokeStyle = dark; ctx.lineWidth = 7.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = shellS; ctx.lineWidth = 5.4; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      const eg = ctx.createRadialGradient(tx - 1.5, ty - 2, .5, tx, ty, 6);
      eg.addColorStop(0, '#5a5a6a'); eg.addColorStop(.5, rgbStr(cols.eye)); eg.addColorStop(1, '#000');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(tx, ty, 5.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(tx - 1.6, ty - 2, 1.5, 0, TAU); ctx.fill();
    }
    /* a robber crab's long feelers */
    if (robber) { ctx.strokeStyle = '#d0682a'; ctx.lineWidth = 1.6; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 6, 12); ctx.quadraticCurveTo(side * 40, -60, side * 70 + Math.sin(walk * .5) * 4, -54); ctx.stroke(); } }
    /* --- the claws, in front --- */
    const ck = robber ? 1.9 : boy ? 1.26 : .9;
    for (const side of [-1, 1]) crabClaw(ctx, side, ck, side < 0 ? up : up * .85, o.pinch || 0, cols, boy);
    ctx.restore();
  }

  /* an empty shed shell, pale and see-through */
  function drawExuvia(ctx, s, form) {
    ctx.save(); ctx.globalAlpha = .6;
    drawCrab(ctx, { s, form, pale: 1, tuck: .6, eyes: .2, sex: 'girl' });
    ctx.restore();
  }

  /* ============================================================
     THE LARVAE (side-on, facing +x)
     ============================================================ */
  function drawZoea(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, F = FORMS[o.form] || FORMS.red, inst = o.instar || 1;
    ctx.save(); ctx.scale(s, s);
    /* feathery swimming legs, beating */
    const beat = Math.sin(ph);
    ctx.strokeStyle = 'rgba(255,236,210,.75)'; ctx.lineWidth = .45; ctx.lineCap = 'round';
    for (const k of [0, 1]) {
      const a = .6 + beat * .55 + k * .35, L = 6.5 + inst * .4;
      const x0 = .6 - k * 1.2, y0 = 3.4, x1 = x0 + Math.cos(a) * L * -.3, y1 = y0 + Math.sin(a) * L;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      for (let j = 1; j <= 4; j++) { const t = j / 5, px = lerp(x0, x1, t), py = lerp(y0, y1, t); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 1.6, py + .6); ctx.moveTo(px, py); ctx.lineTo(px + 1.4, py + .8); ctx.stroke(); }
    }
    /* the curled tail with its forked end */
    ctx.strokeStyle = 'rgba(255,230,205,.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3, 2.2); ctx.quadraticCurveTo(-8, 3 + beat * .6, -9.5, 7.5 + beat * .8); ctx.stroke();
    ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(-9.5, 7.5 + beat * .8); ctx.lineTo(-11.6, 9.2 + beat); ctx.moveTo(-9.5, 7.5 + beat * .8); ctx.lineTo(-8.6, 10.4 + beat); ctx.stroke();
    for (let k = 1; k <= 4; k++) { const t = k / 5, x = lerp(-3, -9.5, t), y = lerp(2.2, 7.5, t * t); ctx.fillStyle = 'rgba(200,80,40,.5)'; ctx.beginPath(); ctx.arc(x, y, .5, 0, TAU); ctx.fill(); }
    /* the spines: a long one on top, one pointing down at the front */
    ctx.strokeStyle = 'rgba(255,240,225,.85)'; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(-.4, -3.6); ctx.quadraticCurveTo(-1.4, -8, -2.8, -12.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, 2.6); ctx.lineTo(5.2, 8.6); ctx.stroke();
    /* the see-through shell */
    const g = ctx.createRadialGradient(-.8, -1.4, .4, 0, 0, 4.6);
    g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(.5, 'rgba(255,236,214,.42)'); g.addColorStop(1, 'rgba(240,190,160,.55)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .4;
    ctx.beginPath(); ctx.ellipse(0, 0, 4.4, 3.9, -.15, 0, TAU); ctx.fill(); ctx.stroke();
    /* colour spots (chromatophores) and the gut */
    const sc = hexToRgb(F.shell);
    ctx.fillStyle = rgbStr(sc, .75);
    for (const [x, y, r] of [[-1.6, -1.6, .55], [.4, 1.6, .7], [-2.4, .9, .45], [1.4, -2.4, .4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(120,170,60,.45)'; ctx.beginPath(); ctx.ellipse(-1, .4, 1.6, .9, .3, 0, TAU); ctx.fill();
    /* the huge eye */
    ctx.fillStyle = '#0c0c14'; ctx.beginPath(); ctx.arc(2.6, -.9, 2.1, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,200,255,.5)'; ctx.beginPath(); ctx.arc(2.6, -.9, 1.5, -1.2, .4); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2.1, -1.6, .55, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawMegalopa(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, F = FORMS[o.form] || FORMS.red;
    const sc = hexToRgb(F.shell), pale = mixRgb(sc, [255, 230, 210], .45);
    ctx.save(); ctx.scale(s, s);
    const beat = Math.sin(ph);
    /* the tail, with swimmerets beating underneath and a tail fan */
    ctx.fillStyle = rgbStr(pale, .9); ctx.strokeStyle = rgbStr(mixRgb(sc, [0, 0, 0], .3), .8); ctx.lineWidth = .5;
    for (let k = 0; k < 5; k++) { const x = -3.5 - k * 2, y = 1 + k * .3; ctx.beginPath(); ctx.ellipse(x, y, 1.4, 1.5 - k * .1, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-12.5, 2.2); ctx.lineTo(-15.5, -.6 + beat * .4); ctx.lineTo(-15.5, 4.8 - beat * .4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,214,.7)'; ctx.lineWidth = .4;
    for (let k = 0; k < 4; k++) { const x = -4 - k * 2, a = Math.sin(ph + k * .8) * .6; ctx.beginPath(); ctx.moveTo(x, 2.4); ctx.lineTo(x + Math.sin(a) * 2, 5.6); ctx.stroke(); }
    /* walking legs folded under */
    ctx.strokeStyle = rgbStr(mixRgb(sc, [255, 255, 255], .2)); ctx.lineWidth = .7;
    for (let k = 0; k < 4; k++) { const x = 3.4 - k * 1.7; ctx.beginPath(); ctx.moveTo(x, 2.6); ctx.lineTo(x - 1, 5); ctx.lineTo(x - 2.6, 5.6); ctx.stroke(); }
    /* the body */
    const g = ctx.createRadialGradient(1, -1.6, .5, 2, 0, 6);
    g.addColorStop(0, rgbStr(mixRgb(pale, [255, 255, 255], .4))); g.addColorStop(1, rgbStr(mixRgb(sc, [80, 30, 20], .3)));
    ctx.fillStyle = g; ctx.strokeStyle = rgbStr(mixRgb(sc, [0, 0, 0], .4), .9); ctx.lineWidth = .5;
    ctx.beginPath(); ctx.ellipse(2, 0, 5.2, 3.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rgbStr(sc, .6); for (const [x, y] of [[0, -1.4], [2.6, .6], [3.6, -1.8]]) { ctx.beginPath(); ctx.arc(x, y, .55, 0, TAU); ctx.fill(); }
    /* little claws held forward */
    ctx.fillStyle = rgbStr(mixRgb(sc, [255, 255, 255], .1)); ctx.strokeStyle = rgbStr(mixRgb(sc, [0, 0, 0], .4)); ctx.lineWidth = .4;
    ctx.beginPath(); ctx.moveTo(5.2, 1.6); ctx.lineTo(7.6, 2.8); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(8.4, 2.9, 1.4, .8, .2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9.4, 2.4); ctx.lineTo(10.6, 2.2); ctx.moveTo(9.4, 3.4); ctx.lineTo(10.4, 3.6); ctx.stroke();
    /* eyes on stalks */
    ctx.strokeStyle = rgbStr(pale); ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(6, -1.6); ctx.lineTo(7.4, -2.8); ctx.stroke();
    ctx.fillStyle = '#0c0c14'; ctx.beginPath(); ctx.arc(7.6, -3, 1.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7.2, -3.4, .35, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawEgg(ctx, o = {}) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-.35, -.4, .1, 0, 0, 1.1);
    g.addColorStop(0, '#9a6a6a'); g.addColorStop(.5, '#4a2a30'); g.addColorStop(1, '#1e1014');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    if (o.eye) { ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.beginPath(); ctx.arc(.3, -.1, .22, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-.35, -.4, .22, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     PLANKTON AND SEA LIFE
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
  /* a little silvery fish (side-on, facing +x), canonical 34 long */
  function drawFish(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, col = o.col || '#c8d8e8', col2 = o.col2 || '#5a7a9a';
    ctx.save(); ctx.scale(s, s);
    const tail = Math.sin(ph) * 3;
    const g = ctx.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, col2); g.addColorStop(.5, col); g.addColorStop(1, '#f4f8ff');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.quadraticCurveTo(10, -7, -6, -5); ctx.lineTo(-13, 0); ctx.lineTo(-6, 5); ctx.quadraticCurveTo(10, 7, 17, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-19, -6 + tail); ctx.lineTo(-17, 0); ctx.lineTo(-19, 6 + tail); ctx.closePath(); ctx.fill();
    if (o.stripe) { ctx.strokeStyle = o.stripe; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(4, 5); ctx.moveTo(-3, -5); ctx.lineTo(-3, 5); ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14, -.5); ctx.lineTo(-10, -.5); ctx.stroke(); }
    ctx.fillStyle = '#101820'; ctx.beginPath(); ctx.arc(11, -1.5, 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10.6, -2, .5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* the whale shark, facing +x, canonical length 1000 (`s` scales); mouth at the front */
  function drawWhaleShark(ctx, o) {
    const s = o.s || 1, t = o.t || 0, gulp = o.gulp || 0;
    ctx.save(); ctx.scale(s, s);
    const sw = Math.sin(t * 1.4) * 22;
    /* tail */
    ctx.fillStyle = '#2e4a66';
    ctx.beginPath(); ctx.moveTo(-430, -6); ctx.quadraticCurveTo(-520, -40 + sw * .3, -560, -160 + sw); ctx.quadraticCurveTo(-540, -50, -500, 0); ctx.quadraticCurveTo(-540, 40, -555, 110 + sw * .7); ctx.quadraticCurveTo(-500, 30 + sw * .2, -430, 14); ctx.fill();
    /* body */
    const g = ctx.createLinearGradient(0, -90, 0, 90);
    g.addColorStop(0, '#24405c'); g.addColorStop(.55, '#3a6080'); g.addColorStop(.62, '#c8d4dc'); g.addColorStop(1, '#e6eef2');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(500, -8);
    ctx.quadraticCurveTo(470, -80, 300, -96); ctx.quadraticCurveTo(0, -112, -300, -60); ctx.quadraticCurveTo(-420, -30, -440, -6);
    ctx.lineTo(-440, 14); ctx.quadraticCurveTo(-300, 56, 0, 84); ctx.quadraticCurveTo(300, 92, 470, 46 + gulp * 18); ctx.quadraticCurveTo(505, 26, 500, -8);
    ctx.fill();
    /* the wide mouth, opening to gulp */
    ctx.fillStyle = '#1a2836';
    ctx.beginPath(); ctx.moveTo(500, 4); ctx.quadraticCurveTo(470, 24 + gulp * 22, 420, 30 + gulp * 26); ctx.quadraticCurveTo(470, 14, 500, 4); ctx.fill();
    /* ridges along the side */
    ctx.strokeStyle = 'rgba(200,220,235,.35)'; ctx.lineWidth = 4;
    for (const dy of [-60, -34]) { ctx.beginPath(); ctx.moveTo(360, dy - 18); ctx.quadraticCurveTo(0, dy - 34, -380, dy * .3); ctx.stroke(); }
    /* gill slits */
    ctx.strokeStyle = 'rgba(20,30,40,.6)'; ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(330 - k * 18, -40); ctx.quadraticCurveTo(322 - k * 18, 0, 330 - k * 18, 40); ctx.stroke(); }
    /* the spots and stripes that make every whale shark different */
    const R = mulberry32(o.seed || 5);
    ctx.fillStyle = 'rgba(235,245,255,.82)';
    for (let k = 0; k < 230; k++) { const x = -420 + R() * 880, top = -100 + Math.abs(x) * .06, y = lerp(top, 40, R()); if (x > 430) continue; ctx.beginPath(); ctx.arc(x, y, 3 + R() * 5, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(235,245,255,.55)'; ctx.lineWidth = 3;
    for (let k = 0; k < 12; k++) { const x = 260 - k * 56; ctx.beginPath(); ctx.moveTo(x, -98 + Math.abs(x) * .05); ctx.lineTo(x - 8, 30); ctx.stroke(); }
    /* fins */
    ctx.fillStyle = '#2a4660';
    ctx.beginPath(); ctx.moveTo(40, -104); ctx.quadraticCurveTo(-30, -220, -100, -230); ctx.quadraticCurveTo(-80, -150, -110, -90); ctx.fill();
    ctx.beginPath(); ctx.moveTo(220, 60); ctx.quadraticCurveTo(140, 190, 60, 230 + Math.sin(t) * 10); ctx.quadraticCurveTo(110, 130, 120, 72); ctx.fill();
    /* the little eye */
    ctx.fillStyle = '#0a1018'; ctx.beginPath(); ctx.arc(440, -10, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(438, -12, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* a manta ray from the side and a little below, canonical width 600 */
  function drawManta(ctx, o) {
    const s = o.s || 1, t = o.t || 0, flap = Math.sin(t * 1.6);
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#1a2a3a';
    ctx.beginPath();
    ctx.moveTo(120, 0); ctx.quadraticCurveTo(40, -40, -40, -20 - flap * 120); ctx.quadraticCurveTo(-60, -10, -120, 0);
    ctx.quadraticCurveTo(-60, 10, -40, 20 + flap * 60); ctx.quadraticCurveTo(40, 40, 120, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-110, 0); ctx.quadraticCurveTo(-200, 4, -280, -4); ctx.lineWidth = 3; ctx.strokeStyle = '#1a2a3a'; ctx.stroke();
    ctx.fillStyle = '#26384a'; for (const dy of [-10, 10]) { ctx.beginPath(); ctx.ellipse(132, dy, 18, 6, dy * .03, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(230,240,250,.25)'; ctx.beginPath(); ctx.ellipse(30, 10, 50, 12, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* a moon jellyfish: canonical bell radius 1 → scaled by r */
  function drawJelly(ctx, j, t) {
    const r = j.r, pulse = Math.max(0, Math.sin(j.ph)) ** 2;
    ctx.save(); ctx.translate(j.x, j.y);
    const w = r * (1 - pulse * .14), h = r * (.62 + pulse * .1);
    const tint = j.hue === 'pink' ? '255,170,210' : '200,225,255';
    /* tentacle fringe and frilly arms */
    ctx.strokeStyle = `rgba(${tint},.45)`; ctx.lineWidth = .6;
    for (let k = 0; k < 16; k++) { const x = (k / 15 - .5) * w * 1.9; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(t * 2 + k) * 3, r * .5, x + Math.sin(t * 1.4 + k) * 5, r * .9); ctx.stroke(); }
    ctx.strokeStyle = `rgba(${tint},.6)`; ctx.lineWidth = 2;
    for (const k of [-1, -.35, .35, 1]) { ctx.beginPath(); ctx.moveTo(k * w * .2, 0); ctx.bezierCurveTo(k * w * .3 + Math.sin(t * 1.5 + k * 3) * 6, r * .6, k * w * .1 - Math.sin(t + k) * 6, r * 1.1, k * w * .2 + Math.sin(t * 1.2 + k) * 8, r * 1.6); ctx.stroke(); }
    /* the bell */
    const g = ctx.createRadialGradient(0, -h * .4, 1, 0, 0, w);
    g.addColorStop(0, `rgba(255,255,255,.55)`); g.addColorStop(.7, `rgba(${tint},.32)`); g.addColorStop(1, `rgba(${tint},.12)`);
    ctx.fillStyle = g; ctx.strokeStyle = `rgba(${tint},.7)`; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.bezierCurveTo(-w, -h * 1.3, w, -h * 1.3, w, 0);
    for (let k = 8; k >= 0; k--) { const x = (k / 8 - .5) * 2 * w; ctx.quadraticCurveTo(x + w / 8, 3, x, 0); }
    ctx.fill(); ctx.stroke();
    /* the four rings of a moon jelly */
    ctx.strokeStyle = `rgba(${j.hue === 'pink' ? '255,120,180' : '190,140,230'},.7)`; ctx.lineWidth = 1.6;
    for (const [dx, dy] of [[-.32, -.42], [.32, -.42], [-.16, -.18], [.16, -.18]]) { ctx.beginPath(); ctx.ellipse(dx * w, dy * h, w * .16, h * .14, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function drawTurtle(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    const fl = Math.sin(ph * 2);
    ctx.fillStyle = '#6a8a4a';
    ctx.beginPath(); ctx.ellipse(10, 8 + fl * 2, 18, 5, .5 + fl * .4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-16, 6, 9, 3.6, -.4 - fl * .3, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(0, -16, 0, 10); g.addColorStop(0, '#8a6a3a'); g.addColorStop(1, '#4a3a20');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 26, 12, 0, Math.PI, TAU); ctx.lineTo(26, 2); ctx.quadraticCurveTo(0, 8, -26, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,10,.5)'; ctx.lineWidth = 1; for (const x of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(x, -11); ctx.lineTo(x + 2, 2); ctx.stroke(); }
    ctx.fillStyle = '#7a9a5a'; ctx.beginPath(); ctx.ellipse(31, -2, 8, 5.5, -.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#101010'; ctx.beginPath(); ctx.arc(34, -4, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* a frigatebird gliding (side-ish silhouette, wings spread), canonical span 200 */
  function drawBird(ctx, o) {
    const s = o.s || 1, flap = Math.sin(o.ph || 0) * .25;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#14141c';
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-40, -30 - flap * 60, -100, -10 - flap * 50); ctx.quadraticCurveTo(-60, -4, -10, 8);
    ctx.quadraticCurveTo(40, -4, 96, -14 - flap * 50); ctx.quadraticCurveTo(40, -30 - flap * 60, 0, 0); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 6, 18, 7, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(-40, 22); ctx.lineTo(-30, 10); ctx.lineTo(-42, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, 4); ctx.lineTo(34, 8); ctx.lineTo(16, 9); ctx.fill();
    ctx.fillStyle = '#e03a2a'; ctx.beginPath(); ctx.ellipse(12, 12, 6, 4.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* the park ranger at the crab bridge, holding a rake; canonical height 90, feet at 0 */
  function drawRanger(ctx, o) {
    const s = o.s || 1, wave = o.wave || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(22, -62); ctx.lineTo(30, 0); ctx.stroke();
    ctx.strokeStyle = '#6a6a6a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(40, 0); for (let k = 0; k < 6; k++) { ctx.moveTo(23 + k * 3.4, 0); ctx.lineTo(23 + k * 3.4, 4); } ctx.stroke();
    ctx.fillStyle = '#3a3a2a'; rr(ctx, -12, -34, 9, 34, 3); ctx.fill(); rr(ctx, 2, -34, 9, 34, 3); ctx.fill();
    ctx.fillStyle = '#7a7a4a'; rr(ctx, -15, -66, 30, 36, 8); ctx.fill();
    ctx.fillStyle = '#c8a87a'; ctx.beginPath(); ctx.arc(0, -76, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a4a2a'; ctx.beginPath(); ctx.ellipse(0, -84, 18, 4, 0, 0, TAU); ctx.fill(); rr(ctx, -9, -94, 18, 11, 5); ctx.fill();
    ctx.fillStyle = '#2a2016'; ctx.beginPath(); ctx.arc(-3.5, -77, 1.3, 0, TAU); ctx.arc(3.5, -77, 1.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -73, 4, .3, Math.PI - .3); ctx.stroke();
    ctx.strokeStyle = '#7a7a4a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, -60); ctx.lineTo(22, -48); ctx.stroke();
    const a = -2.2 + Math.sin(wave * 3) * .5;
    ctx.beginPath(); ctx.moveTo(-10, -60); ctx.lineTo(-10 + Math.cos(a) * 20, -60 + Math.sin(a) * 20); ctx.stroke();
    ctx.fillStyle = '#c8a87a'; ctx.beginPath(); ctx.arc(-10 + Math.cos(a) * 22, -60 + Math.sin(a) * 22, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(-7, -58, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- food on the forest floor ---------- */
  function drawLeaf(ctx, len, ang, col) {
    ctx.save(); ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(len * .3, -len * .28, len * .75, -len * .22, len, 0); ctx.bezierCurveTo(len * .75, len * .22, len * .3, len * .28, 0, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = Math.max(.4, len * .03); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * .95, 0); ctx.stroke();
    ctx.restore();
  }
  function drawFood(ctx, it, t) {
    const k = FOOD_KINDS[it.kind], left = it.bites / k.bites;
    ctx.save(); ctx.rotate(it.rot * .3);
    switch (it.kind) {
      case 'leaf': { const cols = ['#c89a3a', '#a86a2a', '#7a9a3a', '#d8b04a', '#8a5a2a']; ctx.translate(-7, 0); drawLeaf(ctx, 14 * (.5 + left * .5), 0, cols[(it.col * cols.length) | 0]); break; }
      case 'flower': {
        const cols = ['#ff5a6a', '#ffd23f', '#ff8ac8', '#ffffff'], c = cols[(it.col * cols.length) | 0];
        for (let i = 0; i < Math.max(2, Math.round(5 * left)); i++) { ctx.save(); ctx.rotate(i / 5 * TAU); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(2.6, 0, 2.6, 1.6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, TAU); ctx.fill();
        break;
      }
      case 'fruit': {
        const g = ctx.createRadialGradient(-1.2, -1.4, .4, 0, 0, 4.4); g.addColorStop(0, '#c88ab8'); g.addColorStop(1, '#5a2a52');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, TAU); ctx.fill();
        if (left < 1) { ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(2.2, -1, 2.6 * (1 - left), 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#3a6a2a'; ctx.fillRect(-.4, -5, .8, 1.6);
        break;
      }
      case 'seedling': {
        ctx.strokeStyle = '#6aa83a'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -5); ctx.stroke();
        drawLeaf(ctx, 5, -2.5, '#7ac84a'); ctx.save(); ctx.translate(0, -5); drawLeaf(ctx, 5, -.6, '#7ac84a'); ctx.restore(); ctx.save(); ctx.translate(0, -5); ctx.scale(-1, 1); drawLeaf(ctx, 5, -.6, '#8ad85a'); ctx.restore();
        break;
      }
    }
    ctx.restore();
  }

  /* ============================================================
     ICONS (HUD, life wheel, stickers, reading pictures): drawn in
     a 100×100 box centred on 0,0
     ============================================================ */
  function iconCrab(ctx, form, extra = {}) { ctx.translate(0, -2); drawCrab(ctx, Object.assign({ s: .5, form, sex: 'boy', seed: 3 }, extra)); }
  function drawIcon(ctx, key, px, form) {
    form = form || 'red';
    /* the see-through sea creatures sit in a drop of blue water, so they show up on a pale page */
    if (['egg', 'zoea', 'megalopa', 'plankton', 'copepod', 'diatom', 'jelly'].includes(key)) {
      const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 48); g.addColorStop(0, '#bfe8f8'); g.addColorStop(1, '#4aa0d0');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
    }
    switch (key) {
      case 'egg': for (const [x, y] of [[-8, -6], [8, -4], [0, 8], [-14, 10], [14, 10], [0, -16]]) { ctx.save(); ctx.translate(x, y); drawEgg(ctx, { s: 9, eye: true }); ctx.restore(); } break;
      case 'eggs': {
        ctx.fillStyle = '#3a2228'; ctx.beginPath(); ctx.ellipse(0, 6, 36, 22, 0, 0, TAU); ctx.fill();
        const R = mulberry32(4); for (let k = 0; k < 40; k++) { ctx.save(); ctx.translate((R() - .5) * 60, 6 + (R() - .5) * 34); drawEgg(ctx, { s: 4 }); ctx.restore(); }
        break;
      }
      case 'zoea': ctx.translate(6, -1); drawZoea(ctx, { s: 3.6, ph: .8, form }); break;
      case 'megalopa': ctx.translate(4, 0); drawMegalopa(ctx, { s: 3, ph: .8, form }); break;
      case 'baby': ctx.translate(0, 2); drawCrab(ctx, { s: .36, form, sex: 'boy', seed: 3 }); break;
      case 'young': iconCrab(ctx, form, { s: .46 }); break;
      case 'crab': case 'adult': case 'boy': iconCrab(ctx, form, { s: .52 }); break;
      case 'girl': case 'female': iconCrab(ctx, form, { s: .52, sex: 'girl', eggs: key === 'female' ? .6 : 0 }); break;
      case 'march': { iconCrab(ctx, form, { s: .42, moving: true, walk: 1 }); ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-46, 30); ctx.lineTo(-30, 18); ctx.lineTo(-30, 26); ctx.lineTo(-10, 26); ctx.lineTo(-10, 34); ctx.lineTo(-30, 34); ctx.lineTo(-30, 42); ctx.closePath(); ctx.fill(); break; }
      case 'rival': iconCrab(ctx, 'orange', { s: .5, up: .8, pinch: .6 }); break;
      case 'king': { iconCrab(ctx, form, { s: .46, up: 1 }); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(-10, -38); ctx.lineTo(-2, -28); ctx.lineTo(6, -40); ctx.lineTo(12, -28); ctx.lineTo(18, -38); ctx.lineTo(20, -22); ctx.closePath(); ctx.fill(); ctx.stroke(); break; }
      case 'claw': { ctx.rotate(-.5); ctx.translate(-20, 10); crabClaw(ctx, 1, 2.6, 0, .5, crabCols(form, 0), true); break; }
      case 'shell': ctx.translate(0, -2); drawExuvia(ctx, .52, form); break;
      case 'robber': ctx.translate(0, -4); drawCrab(ctx, { s: .36, robber: true }); break;
      case 'plankton': for (const q of [{ x: -16, y: -10, kind: 'diatom', rot: 0 }, { x: 14, y: -14, kind: 'chain', rot: .4 }, { x: 0, y: 12, kind: 'copepod', rot: 0, vx: 1, vy: -.3 }, { x: -18, y: 16, kind: 'dino', rot: 0, glow: .6 }, { x: 18, y: 14, kind: 'diatom', rot: .5 }]) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(7, 7); ctx.translate(-q.x, -q.y); drawPlankton(ctx, Object.assign({ glow: q.glow || 0 }, q, { x: q.x, y: q.y }), .3, 0); ctx.restore(); } break;
      case 'diatom': ctx.scale(24, 24); drawPlankton(ctx, { x: 0, y: 0, kind: 'diatom', rot: 0 }, 0, 0); break;
      case 'copepod': ctx.scale(16, 16); drawPlankton(ctx, { x: 0, y: 0, kind: 'copepod', rot: 0, vx: 1, vy: -.4 }, 0, 0); break;
      case 'jelly': drawJelly(ctx, { x: 0, y: -6, r: 30, ph: 1.2, hue: 'moon' }, 1); break;
      case 'whaleshark': ctx.translate(4, 0); drawWhaleShark(ctx, { s: .085, t: 0, gulp: .7 }); break;
      case 'manta': ctx.translate(10, 0); drawManta(ctx, { s: .3, t: .3 }); break;
      case 'fish': drawFish(ctx, { s: 2.2, col: '#c8d8e8', col2: '#5a7a9a' }); break;
      case 'turtle': drawTurtle(ctx, { s: 1.1 }); break;
      case 'bird': ctx.translate(0, 4); drawBird(ctx, { s: .42, ph: 1 }); break;
      case 'ranger': ctx.translate(-6, 42); drawRanger(ctx, { s: .88 }); break;
      case 'leaf': ctx.translate(-36, 0); drawLeaf(ctx, 72, -.3, '#c89a3a'); break;
      case 'flower': ctx.scale(6, 6); drawFood(ctx, { kind: 'flower', bites: 2, col: 0, rot: 0 }, 0); break;
      case 'fruit': ctx.scale(7, 7); drawFood(ctx, { kind: 'fruit', bites: 3, col: 0, rot: 0 }, 0); break;
      case 'seedling': ctx.translate(0, 18); ctx.scale(6, 6); drawFood(ctx, { kind: 'seedling', bites: 1, col: 0, rot: 0 }, 0); break;
      case 'burrow': {
        ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-44, -8, 88, 50);
        ctx.fillStyle = '#5a3018'; ctx.fillRect(-44, -8, 88, 6);
        ctx.fillStyle = '#2a140a'; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.quadraticCurveTo(-14, 14, 4, 26); ctx.quadraticCurveTo(20, 34, 28, 30); ctx.lineTo(30, 18); ctx.quadraticCurveTo(10, 18, 8, -8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c8a050'; for (const [x, y, a] of [[-30, -14, -.3], [24, -14, .2], [-12, -16, .6]]) { ctx.save(); ctx.translate(x, y); drawLeaf(ctx, 16, a, '#b8903a'); ctx.restore(); }
        ctx.save(); ctx.translate(16, 22); drawCrab(ctx, { s: .14, form, eyes: 1 }); ctx.restore();
        break;
      }
      case 'forest': case 'tree': {
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-6, -10, 12, 52);
        ctx.beginPath(); ctx.moveTo(-6, 30); ctx.lineTo(-22, 42); ctx.lineTo(-6, 40); ctx.moveTo(6, 30); ctx.lineTo(22, 42); ctx.lineTo(6, 40); ctx.fill();
        for (const [x, y, r, c] of [[-18, -18, 20, '#2f7a3e'], [16, -20, 22, '#3a8a46'], [0, -34, 22, '#4aa052'], [-4, -10, 16, '#2a6a3a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        break;
      }
      case 'cliff': {
        ctx.fillStyle = '#9a9488'; ctx.beginPath(); ctx.moveTo(-44, 44); ctx.lineTo(-44, 20); ctx.lineTo(-20, 18); ctx.lineTo(-14, -10); ctx.lineTo(6, -12); ctx.lineTo(12, -36); ctx.lineTo(44, -38); ctx.lineTo(44, 44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3f8a3a'; ctx.fillRect(12, -44, 32, 8);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-12, -2, 10, 6); ctx.fillRect(14, -30, 10, 5);
        ctx.save(); ctx.translate(-2, 6); drawCrab(ctx, { s: .14, form }); ctx.restore();
        break;
      }
      case 'sea': case 'wave': {
        ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 0); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 2); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a6ab0'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 14); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, 14 + Math.sin(x * .12 + 2) * 6); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -40; x <= 40; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 4); ctx.stroke();
        break;
      }
      case 'reef': {
        ctx.fillStyle = '#2a7ac8'; ctx.fillRect(-46, -46, 92, 92);
        for (const [x, c] of [[-26, '#ff7a8a'], [0, '#ffb04a'], [24, '#c86aff']]) { ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, 14); ctx.lineTo(x - 10, 0); ctx.moveTo(x, 20); ctx.lineTo(x + 12, 2); ctx.stroke(); }
        ctx.save(); ctx.translate(0, -18); drawFish(ctx, { s: 1, col: '#ffd23f', col2: '#2a6fb8', stripe: '#1a2a6a' }); ctx.restore();
        break;
      }
      case 'bridge': {
        ctx.fillStyle = '#4a4c50'; ctx.fillRect(-46, 26, 92, 14);
        ctx.strokeStyle = '#fff'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-44, 33); ctx.lineTo(44, 33); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#8a9aa8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-46, 26); ctx.lineTo(-24, -6); ctx.lineTo(24, -6); ctx.lineTo(46, 26); ctx.stroke();
        ctx.lineWidth = 2; for (let x = -20; x <= 20; x += 8) { ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x, 26); ctx.stroke(); }
        ctx.save(); ctx.translate(4, -14); drawCrab(ctx, { s: .12, form, moving: true, walk: 1 }); ctx.restore();
        break;
      }
      case 'moon': {
        ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,190,140,.6)'; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        break;
      }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'rain': ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(-12, -8, 16, 0, TAU); ctx.arc(8, -14, 18, 0, TAU); ctx.arc(22, -4, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-16, -2, 12]) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x - 5, 32); ctx.stroke(); } break;
      case 'rock': { const g = ctx.createRadialGradient(-10, -12, 4, 0, 0, 34); g.addColorStop(0, '#d9d2c4'); g.addColorStop(1, '#7a7468'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 4, 36, 24, -.1, 0, TAU); ctx.fill(); ctx.save(); ctx.translate(0, 26); drawCrab(ctx, { s: .16, form, eyes: .5, tuck: .5 }); ctx.restore(); break; }
      case 'water': { ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(0, -36); ctx.bezierCurveTo(22, -8, 26, 6, 26, 14); ctx.arc(0, 14, 26, 0, Math.PI); ctx.bezierCurveTo(-26, 6, -22, -8, 0, -36); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-10, 10, 5, 9, -.4, 0, TAU); ctx.fill(); break; }
      default: iconCrab(ctx, form);
    }
  }
  function icon(key, px, form) {
    form = form || (window.G && window.G.form) || 'red';
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

  return { drawCrab, crabClaw, drawExuvia, drawZoea, drawMegalopa, drawEgg, drawPlankton, drawFish, drawWhaleShark, drawManta, drawJelly, drawTurtle, drawBird, drawRanger, drawLeaf, drawFood, drawIcon, icon, crabCols };
})();
