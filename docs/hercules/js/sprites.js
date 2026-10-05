/* ============================================================
   sprites.js — every living thing, drawn with paths
   ============================================================
   The beetle is drawn side-on, facing +x, at a canonical size
   where a big male measures 150 units from the tip of his horn
   to the end of his wing cases; `s` scales it.  The origin is
   the middle of his body; his feet stand at y = +30·s.

   A Hercules male, front to back: the long THORACIC horn grows
   from the pronotum (the shield behind the head) and has a
   fringe of golden hair underneath; the shorter HEAD horn curves
   up from the head to meet it like a pair of pincers.  The wing
   cases (elytra) are olive-yellow with black spots when the air
   is dry and black when it is damp (`wet`).  A just-hatched
   beetle is pale (`pale`) until its shell hardens.

   The grub is drawn along a list of points (its body follows the
   path its head took through the wood, like a real grub in a
   tunnel), or curled into a C when resting.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();

  /* ---------- colour helpers for the beetle ---------- */
  function wingCol(form, wet, pale, k = 0) {
    const F = FORMS[form] || FORMS.hercules;
    let c = mixRgb(hexToRgb(k ? F.wing2 : F.wing), hexToRgb(F.wet), clamp(wet, 0, 1));
    if (pale > 0) c = mixRgb(c, [236, 222, 190], pale);
    return c;
  }
  function blackCol(pale, base = [18, 16, 14]) { return pale > 0 ? mixRgb(base, [214, 190, 150], pale) : base; }

  /* one leg: hip → knee → ankle → toes, with spines on the shin and two claws */
  function leg(ctx, hx, hy, kx, ky, ax, ay, tx, ty, w, col, spines) {
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = w * .8; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(ax, ay); ctx.stroke();
    if (spines) {
      ctx.lineWidth = w * .3;
      for (let k = 1; k <= 3; k++) { const t = k / 4, px = lerp(kx, ax, t), py = lerp(ky, ay, t), nx = -(ay - ky), ny = ax - kx, L = Math.hypot(nx, ny) || 1; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + nx / L * w * 1.1 + (ax - kx) * .05, py + ny / L * w * 1.1 + (ay - ky) * .05); ctx.stroke(); }
    }
    /* the tarsus: little beads, then a hook */
    ctx.lineWidth = w * .45; ctx.beginPath(); ctx.moveTo(ax, ay);
    for (let k = 1; k <= 4; k++) ctx.lineTo(lerp(ax, tx, k / 4) + Math.sin(k * 2) * w * .15, lerp(ay, ty, k / 4));
    ctx.stroke();
    ctx.lineWidth = w * .3; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + sign(tx - ax) * w * .9, ty - w * .5); ctx.stroke();
  }

  /* ============================================================
     THE BEETLE
     o: { s, male, form, wet, pale, walk, moving, open (wings 0..1), flap,
          lift (pronotum raised 0..1), pinch (head horn up 0..1), seed,
          lengthMM (sets how long the horns are), eat (0..1) }
     ============================================================ */
  function drawBeetle(ctx, o) {
    const s = o.s || 1, male = o.male !== false, form = o.form || 'hercules', F = FORMS[form] || FORMS.hercules;
    const wet = o.wet || 0, pale = o.pale || 0, walk = o.walk || 0, open = o.open || 0, lift = o.lift || 0, pinch = o.pinch || 0;
    /* horn length grows with body size: small males have short horns (a real allometry) */
    const hornK = male ? clamp(((o.lengthMM || 150) - 50) / 110, .15, 1.15) * F.horn : 0;
    const R = mulberry32((o.seed || 7) >>> 0);
    ctx.save();
    ctx.scale(s, s);
    if (!male) ctx.scale(.9, .95);
    const black = blackCol(pale), blackS = rgbStr(black), shine = pale > .5 ? 'rgba(255,250,235,.5)' : 'rgba(255,255,255,.55)';
    const legCol = rgbStr(blackCol(pale, [26, 20, 16]));
    const farLeg = rgbStr(mixRgb(blackCol(pale, [26, 20, 16]), [0, 0, 0], .45));

    /* --- far-side legs (behind the body) --- */
    const gait = (k) => o.moving ? Math.sin(walk + k * Math.PI) : 0;
    const up = (k) => o.moving ? Math.max(0, Math.sin(walk + k * Math.PI + Math.PI / 2)) * 5 : 0;
    if (open < .5) {
      leg(ctx, 26, 6, 40 + gait(1) * 6, 14, 52 + gait(1) * 10, 26 - up(1), 62 + gait(1) * 12, 30 - up(1), 4.4, farLeg, false);
      leg(ctx, -2, 8, 4 + gait(0) * 6, 20, -2 + gait(0) * 10, 28 - up(0), 2 + gait(0) * 12, 30 - up(0), 4.4, farLeg, false);
      leg(ctx, -16, 8, -30 + gait(1) * 6, 18, -40 + gait(1) * 10, 26 - up(1), -54 + gait(1) * 10, 30 - up(1), 4.4, farLeg, false);
    }

    /* --- hind wings (only when flying): thin, brown-veined, a blur when beating --- */
    if (open > .05) {
      const beat = Math.sin(o.flap || 0);
      ctx.save();
      ctx.translate(-4, -26);
      ctx.globalAlpha = .55 * open;
      for (const k of [0, 1]) {
        ctx.save();
        ctx.rotate(.35 + beat * .75 + k * .3);
        ctx.scale(1, .35 + Math.abs(beat) * .65);
        const g = ctx.createLinearGradient(0, 0, -150, 0);
        g.addColorStop(0, 'rgba(120,80,40,.7)'); g.addColorStop(1, 'rgba(200,170,120,.25)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-40, -50, -130, -40, -150, -6); ctx.bezierCurveTo(-120, 18, -40, 22, 0, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(90,50,20,.5)'; ctx.lineWidth = 1.2;
        for (const v of [-30, -10, 8]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-70, v - 10, -140, v * .4); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
    }

    /* --- abdomen underside (visible when the wing cases lift) --- */
    if (open > .05) {
      const ag = ctx.createLinearGradient(0, -24, 0, 10);
      ag.addColorStop(0, rgbStr(blackCol(pale, [96, 60, 34]))); ag.addColorStop(1, rgbStr(blackCol(pale, [40, 26, 16])));
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.moveTo(6, -20); ctx.bezierCurveTo(-10, -26, -46, -22, -58, -8); ctx.bezierCurveTo(-62, 4, -50, 9, -40, 9); ctx.lineTo(4, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) { const x = -8 - k * 8.5; ctx.beginPath(); ctx.moveTo(x, -20 + k * 1.8); ctx.quadraticCurveTo(x - 3, -6, x + 1, 8); ctx.stroke(); }
    }

    /* --- the wing cases (elytra) --- */
    ctx.save();
    ctx.translate(8, -26);
    ctx.rotate(open * .85);
    ctx.translate(-8, 26);
    const wc = wingCol(form, wet, pale, 0), wc2 = wingCol(form, wet, pale, 1);
    const eg = ctx.createLinearGradient(0, -34, 0, 12);
    eg.addColorStop(0, rgbStr(mixRgb(wc, [255, 255, 230], .18))); eg.addColorStop(.5, rgbStr(wc)); eg.addColorStop(1, rgbStr(mixRgb(wc2, [0, 0, 0], .25)));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.moveTo(8, -26);
    ctx.bezierCurveTo(-6, -38, -50, -36, -64, -14);
    ctx.bezierCurveTo(-72, 0, -60, 10, -44, 10);
    ctx.lineTo(4, 8);
    ctx.bezierCurveTo(10, 0, 12, -16, 8, -26);
    ctx.closePath(); ctx.fill();
    /* spots: black blotches that vanish as the case darkens */
    if (F.spots && male && wet < .95) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = `rgba(14,12,10,${(1 - wet) * .9})`;
      for (let k = 0; k < 14; k++) { const x = -60 + R() * 64, y = -30 + R() * 34, r = 1.5 + R() * 3.6; ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r, R(), 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    if (!male) {
      /* a female's cases are dull and finely hairy */
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(70,45,25,.55)'; ctx.fillRect(-80, -50, 100, 70);
      ctx.fillStyle = 'rgba(200,170,120,.25)';
      for (let k = 0; k < 120; k++) ctx.fillRect(-70 + R() * 80, -36 + R() * 46, .9, .9);
      ctx.restore();
    }
    /* the edge of the case, a shoulder bump and a glossy highlight */
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(4, 6); ctx.bezierCurveTo(-20, 9, -50, 9, -62, -4); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(2, -12); ctx.bezierCurveTo(-20, -18, -46, -16, -60, -8); ctx.stroke();
    const hl = ctx.createLinearGradient(-40, -36, -30, -20);
    hl.addColorStop(0, wet > .5 ? 'rgba(255,255,255,.55)' : 'rgba(255,255,240,.42)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.beginPath(); ctx.ellipse(-26, -27, 26, 5, -.06, 0, TAU); ctx.fill();
    ctx.restore();

    /* --- near-side legs --- */
    if (open < .5) {
      leg(ctx, 30, 6, 44 + gait(0) * 6, 12, 56 + gait(0) * 10, 24 - up(0), 66 + gait(0) * 12, 30 - up(0), 5.6, legCol, true);
      leg(ctx, 0, 8, 10 + gait(1) * 6, 18, 4 + gait(1) * 10, 28 - up(1), 10 + gait(1) * 12, 30 - up(1), 5.6, legCol, true);
      leg(ctx, -14, 8, -26 + gait(0) * 6, 16, -36 + gait(0) * 10, 26 - up(0), -50 + gait(0) * 10, 30 - up(0), 5.6, legCol, true);
    } else {
      /* tucked up in flight */
      for (const [hx, kx, ax] of [[30, 40, 48], [0, 6, 0], [-14, -26, -40]]) leg(ctx, hx, 8, kx, 18, ax, 24, ax + 6, 27, 5, legCol, false);
    }

    /* --- head + head horn (pivots up when pinching) --- */
    ctx.save();
    ctx.translate(34, 2);
    ctx.rotate(-pinch * .32 + (o.eat ? Math.sin(o.eat * 20) * .05 : 0));
    ctx.fillStyle = blackS;
    ctx.beginPath(); ctx.ellipse(6, 2, 11, 9, -.2, 0, TAU); ctx.fill();
    /* antenna: a little club of leaves (lamellae) */
    ctx.strokeStyle = rgbStr(blackCol(pale, [70, 40, 20])); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(12, 6); ctx.lineTo(20, 10); ctx.stroke();
    ctx.fillStyle = rgbStr(blackCol(pale, [110, 64, 30])); ctx.beginPath(); ctx.ellipse(21, 10, 2.6, 1.6, .4, 0, TAU); ctx.fill();
    /* mouth brushes (they lap fruit juice) */
    ctx.fillStyle = 'rgba(190,120,50,.9)'; ctx.beginPath(); ctx.ellipse(16, 11, 3, 2, .2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(9, -1, 2, 0, TAU); ctx.fill();
    if (male && hornK > 0) {
      const L = 46 * hornK;
      const hg = ctx.createLinearGradient(0, -6, 0, 8);
      hg.addColorStop(0, rgbStr(mixRgb(black, [255, 255, 255], .15))); hg.addColorStop(1, blackS);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(8, -6);
      ctx.bezierCurveTo(8 + L * .4, -6, 8 + L * .8, -12 - L * .1, 8 + L, -18 - L * .18);
      ctx.lineTo(8 + L - 1, -15 - L * .18);
      ctx.bezierCurveTo(8 + L * .75, -6 - L * .08, 8 + L * .4, 4, 10, 6);
      ctx.closePath(); ctx.fill();
      /* teeth along the top of the head horn */
      ctx.fillStyle = blackS;
      for (const t of [.45, .62]) { const x = 8 + L * t, y = -6 - L * t * .14 - 5; ctx.beginPath(); ctx.moveTo(x - 3, y + 3); ctx.lineTo(x, y - 3); ctx.lineTo(x + 3, y + 3); ctx.fill(); }
      ctx.strokeStyle = shine; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(10, -5); ctx.bezierCurveTo(8 + L * .4, -5.5, 8 + L * .75, -10, 8 + L * .95, -16 - L * .17); ctx.stroke();
    }
    ctx.restore();

    /* --- the pronotum and the great thoracic horn (raised when lifting) --- */
    ctx.save();
    ctx.translate(14, -16);
    ctx.rotate(-lift * .38);
    const pg = ctx.createRadialGradient(4, -10, 2, 10, 0, 30);
    pg.addColorStop(0, rgbStr(mixRgb(black, [255, 255, 255], .35))); pg.addColorStop(.35, rgbStr(mixRgb(black, [255, 255, 255], .06))); pg.addColorStop(1, blackS);
    ctx.fillStyle = pg;
    ctx.beginPath();
    if (male) {
      const L = 92 * hornK;
      ctx.moveTo(-10, 22);
      ctx.bezierCurveTo(-14, 4, -8, -12, 6, -14);
      /* the horn: up and forward, a long gentle curve, tipped with a down-hook */
      ctx.bezierCurveTo(16 + L * .2, -16 - L * .12, 16 + L * .6, -12 - L * .1, 16 + L, -2 - L * .02);
      ctx.quadraticCurveTo(18 + L, 4, 14 + L, 4);
      ctx.bezierCurveTo(16 + L * .65, -2 - L * .03, 16 + L * .25, 0, 22, 8);
      ctx.bezierCurveTo(24, 16, 22, 22, 18, 24);
      ctx.closePath(); ctx.fill();
      /* golden hair under the horn */
      ctx.strokeStyle = pale > .5 ? 'rgba(240,220,170,.6)' : 'rgba(214,150,60,.95)'; ctx.lineWidth = 1.1;
      for (let k = 0; k < 18; k++) { const t = .2 + k / 18 * .7, x = 16 + L * t, y = lerp(4, -2, t) + Math.sin(t * Math.PI) * -4 + 4; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x - 2, y + 3 + R() * 3); ctx.stroke(); }
      ctx.strokeStyle = shine; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -11); ctx.bezierCurveTo(16 + L * .25, -15 - L * .12, 16 + L * .55, -12 - L * .09, 16 + L * .85, -5 - L * .04); ctx.stroke();
    } else {
      ctx.moveTo(-10, 22); ctx.bezierCurveTo(-14, 2, -6, -12, 8, -10); ctx.bezierCurveTo(22, -8, 26, 8, 22, 22); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shine; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.quadraticCurveTo(8, -11, 16, -6); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  /* ============================================================
     THE GRUB
     pts: head first, in drawing coordinates; r: the fattest radius.
     o: { pale, phase, instar, shed (0..1: the old skin splitting) }
     ============================================================ */
  function drawGrub(ctx, pts, r, o = {}) {
    if (pts.length < 2) return;
    const n = 12, segs = [];
    /* resample the path into 12 segments, head to tail */
    let total = 0; const cum = [0];
    for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(total); }
    const len = r * 4.8;
    for (let k = 0; k < n; k++) {
      const d = Math.min(total, k / (n - 1) * len);
      let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
      const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, t = clamp((d - cum[i - 1]) / seg, 0, 1);
      segs.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), ang: Math.atan2(a.y - b.y, a.x - b.x) });
    }
    const phase = o.phase || 0, pale = o.pale || 0;
    const radius = (k) => r * (k === 0 ? .62 : k < 4 ? .7 + k * .06 : k < 9 ? .9 + (k - 4) * .02 : 1.02 - (k - 9) * .04) * (1 + .06 * Math.sin(phase - k * .9));
    /* a soft shadow */
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (let k = n - 1; k >= 1; k--) { const sg = segs[k]; ctx.beginPath(); ctx.arc(sg.x + r * .15, sg.y + r * .3, radius(k), 0, TAU); ctx.fill(); }
    /* the body: cream, the last segments grey-blue where the gut full of wood shows through */
    for (let k = n - 1; k >= 1; k--) {
      const sg = segs[k], rr = radius(k);
      let base = [236, 226, 196];
      if (k >= 8) base = mixRgb(base, [150, 150, 160], (k - 7) / 4 * .65);
      if (o.instar === 1) base = mixRgb(base, [250, 246, 232], .4);
      const g = ctx.createRadialGradient(sg.x - rr * .35, sg.y - rr * .45, rr * .1, sg.x, sg.y, rr * 1.05);
      g.addColorStop(0, rgbStr(mixRgb(base, [255, 255, 255], .55))); g.addColorStop(.6, rgbStr(base)); g.addColorStop(1, rgbStr(mixRgb(base, [120, 100, 70], .45)));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sg.x, sg.y, rr, 0, TAU); ctx.fill();
      /* the fold between segments */
      ctx.strokeStyle = 'rgba(120,96,60,.35)'; ctx.lineWidth = Math.max(.6, r * .07);
      ctx.beginPath(); ctx.arc(sg.x, sg.y, rr * .96, sg.ang + Math.PI * .5 - .9, sg.ang + Math.PI * .5 + .9); ctx.stroke();
      /* spiracles: little brown breathing holes along the side */
      if (k >= 2 && k <= 10 && r > 3) { ctx.fillStyle = '#8a5a2a'; const a = sg.ang + Math.PI / 2; ctx.beginPath(); ctx.ellipse(sg.x + Math.cos(a) * rr * .45, sg.y + Math.sin(a) * rr * .45, rr * .1, rr * .16, sg.ang, 0, TAU); ctx.fill(); }
      /* fine hairs */
      if (r > 5 && k % 2) { ctx.strokeStyle = 'rgba(160,120,70,.5)'; ctx.lineWidth = .6; const a = sg.ang - Math.PI / 2; ctx.beginPath(); ctx.moveTo(sg.x + Math.cos(a) * rr, sg.y + Math.sin(a) * rr); ctx.lineTo(sg.x + Math.cos(a - .3) * rr * 1.25, sg.y + Math.sin(a - .3) * rr * 1.25); ctx.stroke(); }
    }
    /* six little legs on the thorax */
    ctx.strokeStyle = '#b07a3a'; ctx.lineWidth = Math.max(.8, r * .14); ctx.lineCap = 'round';
    for (let k = 1; k <= 3; k++) {
      const sg = segs[k], a = sg.ang + Math.PI / 2, rr = radius(k), sw = Math.sin(phase * 1.5 + k) * .4;
      ctx.beginPath(); ctx.moveTo(sg.x + Math.cos(a) * rr * .7, sg.y + Math.sin(a) * rr * .7);
      ctx.quadraticCurveTo(sg.x + Math.cos(a + sw) * rr * 1.4, sg.y + Math.sin(a + sw) * rr * 1.4, sg.x + Math.cos(a + sw - .5) * rr * 1.5 + Math.cos(sg.ang) * rr * .4, sg.y + Math.sin(a + sw - .5) * rr * 1.5 + Math.sin(sg.ang) * rr * .4); ctx.stroke();
    }
    /* the hard brown head with its jaws */
    const h = segs[0], hr = radius(0);
    const hg = ctx.createRadialGradient(h.x - hr * .3, h.y - hr * .4, hr * .1, h.x, h.y, hr);
    hg.addColorStop(0, pale ? '#e8c890' : '#d08a3a'); hg.addColorStop(1, pale ? '#b08a50' : '#7a4418');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, TAU); ctx.fill();
    const jaw = Math.sin(phase * 3) * .25;
    ctx.fillStyle = '#2a160a';
    for (const sgn of [-1, 1]) { const a = h.ang + sgn * (.35 + jaw); ctx.beginPath(); ctx.moveTo(h.x + Math.cos(h.ang + sgn * .6) * hr * .7, h.y + Math.sin(h.ang + sgn * .6) * hr * .7); ctx.lineTo(h.x + Math.cos(a) * hr * 1.45, h.y + Math.sin(a) * hr * 1.45); ctx.lineTo(h.x + Math.cos(h.ang) * hr * .8, h.y + Math.sin(h.ang) * hr * .8); ctx.fill(); }
    /* moulting: the old skin splits behind the head and slides back */
    if (o.shed > 0) {
      ctx.strokeStyle = `rgba(255,250,230,${.8 * (1 - o.shed)})`; ctx.lineWidth = r * .25;
      ctx.beginPath(); for (let k = Math.floor(o.shed * n); k < n; k++) { const sg = segs[k]; k === Math.floor(o.shed * n) ? ctx.moveTo(sg.x, sg.y) : ctx.lineTo(sg.x, sg.y); } ctx.stroke();
    }
  }
  /* the grub's shape when it is resting: a fat C */
  function grubShape(r, curl = .8, phase = 0) {
    const pts = [], L = r * 4.8, theta = Math.PI * (.6 + curl * .7), Rc = L / theta;
    for (let k = 0; k <= 16; k++) { const t = k / 16, a = -Math.PI / 2 + t * theta + Math.sin(phase) * .05; pts.push({ x: Math.cos(a) * Rc, y: Math.sin(a) * Rc + Rc * .2 }); }
    return pts;
  }
  /* a shed skin left in the tunnel after a moult */
  function drawExuvia(ctx, r, ang) {
    ctx.save(); ctx.rotate(ang); ctx.globalAlpha = .75;
    ctx.fillStyle = 'rgba(240,230,200,.55)'; ctx.strokeStyle = 'rgba(160,130,90,.6)'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.bezierCurveTo(r, -r * .8, -r * 1.4, -r * .6, -r * 2, 0); ctx.bezierCurveTo(-r * 1.4, r * .4, r, r * .7, r * 1.6, 0); ctx.fill(); ctx.stroke();
    for (let k = -2; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * r * .6, -r * .5); ctx.lineTo(k * r * .6 - r * .1, r * .45); ctx.stroke(); }
    ctx.fillStyle = 'rgba(150,90,30,.8)'; ctx.beginPath(); ctx.arc(r * 1.7, 0, r * .45, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- the egg ---------- */
  function drawEgg(ctx, o) {
    const s = o.s || 1, crack = o.crack || 0, grow = o.grow || 0;
    ctx.save(); ctx.scale(s, s);
    const rx = 5 + grow * 1.4, ry = 4 + grow * 1.8;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(.8, ry * .9, rx, ry * .35, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-rx * .35, -ry * .4, .4, 0, 0, rx * 1.2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#f2ecd6'); g.addColorStop(1, '#c9bc98');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
    if (grow > .5) { /* the curled grub showing through the shell */ ctx.globalAlpha = (grow - .5) * .6; ctx.save(); ctx.scale(.18, .18); drawGrub(ctx, grubShape(18, 1, 0), 18, { instar: 1 }); ctx.restore(); ctx.globalAlpha = 1; }
    if (crack > 0) {
      ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.moveTo(-rx * .6, -ry * .2); for (let k = 0; k < 6; k++) ctx.lineTo(-rx * .6 + k * rx * .24 * crack * 1.4, -ry * .2 + (k % 2 ? -1 : 1) * ry * .25); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(-rx * .35, -ry * .45, rx * .25, ry * .15, -.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- the pupa (a male's shows his horn in a sheath) ---------- */
  function drawPupa(ctx, o) {
    const s = o.s || 1, male = o.male !== false, k = o.progress || 0, hornK = male ? clamp(((o.lengthMM || 150) - 50) / 110, .15, 1.1) : 0;
    ctx.save(); ctx.scale(s, s);
    ctx.rotate(Math.sin((o.t || 0) * 2.3) * .03 * (o.wiggle || 0));
    const base = mixRgb([230, 196, 130], [150, 84, 36], k * .8);
    const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 60);
    g.addColorStop(0, rgbStr(mixRgb(base, [255, 255, 240], .5))); g.addColorStop(.6, rgbStr(base)); g.addColorStop(1, rgbStr(mixRgb(base, [60, 30, 10], .5)));
    ctx.fillStyle = g;
    /* abdomen rings */
    ctx.beginPath(); ctx.ellipse(-22, 2, 38, 22, .08, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(90,50,20,.35)'; ctx.lineWidth = 1.4;
    for (let j = 0; j < 6; j++) { ctx.beginPath(); ctx.ellipse(-46 + j * 9, 2, 3, 19 - Math.abs(j - 2) * 1.5, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
    /* the thorax and wing pads */
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(16, -4, 22, 19, -.15, 0, TAU); ctx.fill();
    ctx.fillStyle = rgbStr(mixRgb(base, [255, 255, 255], .2)); ctx.beginPath(); ctx.ellipse(-2, 6, 18, 9, .35, 0, TAU); ctx.fill();
    /* folded legs */
    ctx.strokeStyle = rgbStr(mixRgb(base, [80, 40, 10], .4)); ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const [a, b] of [[22, 14], [12, 16], [2, 18]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo(a - 6, b + 6, a - 16, b + 2); ctx.stroke(); }
    /* horn sheath */
    if (male) {
      const L = 50 * hornK;
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(14, -22); ctx.bezierCurveTo(28 + L * .3, -30, 30 + L * .7, -22, 32 + L, -8); ctx.quadraticCurveTo(32 + L, 0, 26 + L, -2); ctx.bezierCurveTo(26 + L * .6, -8, 30, -2, 32, 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(34, 0); ctx.quadraticCurveTo(34 + L * .4, 2, 34 + L * .6, -8); ctx.lineTo(32 + L * .6, -5); ctx.quadraticCurveTo(32 + L * .3, 6, 30, 6); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-26, -12, 16, 4, -.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- fruit, sticks, fungus, critters ---------- */
  function drawFruit(ctx, kind, bites, max, rot = 0) {
    const K = FRUIT_KINDS[kind], r = K.r;
    ctx.save(); ctx.rotate(rot);
    if (bites <= 0) { ctx.fillStyle = 'rgba(140,100,50,.7)'; ctx.beginPath(); ctx.ellipse(0, r * .3, r * .6, r * .3, 0, 0, TAU); ctx.fill(); ctx.restore(); return; }
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, r * .8, r, r * .25, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r * 1.1);
    if (kind === 'mango') { g.addColorStop(0, '#ffe08a'); g.addColorStop(.5, K.col); g.addColorStop(1, K.col2); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25, r * .9, -.2, 0, TAU); ctx.fill(); }
    else if (kind === 'fig') { g.addColorStop(0, '#b07ab0'); g.addColorStop(.6, K.col); g.addColorStop(1, '#3a1a3a'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.bezierCurveTo(r * .9, -r * .6, r * 1.1, r, 0, r); ctx.bezierCurveTo(-r * 1.1, r, -r * .9, -r * .6, 0, -r * 1.2); ctx.fill(); ctx.strokeStyle = '#4a7a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(1, -r * 1.6); ctx.stroke(); }
    else { g.addColorStop(0, '#f0f8b0'); g.addColorStop(.6, K.col); g.addColorStop(1, '#7a9a3a'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); }
    /* bites taken: juicy flesh showing */
    const eaten = 1 - bites / max;
    if (eaten > 0) { ctx.fillStyle = kind === 'fig' ? '#e05a6a' : kind === 'mango' ? '#ffb02a' : '#f78a8a'; ctx.beginPath(); ctx.ellipse(r * .2, -r * .1, r * .7 * eaten + r * .2, r * .5 * eaten + r * .15, .3, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(r * .1, -r * .25, r * .15, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * .4, -r * .45, r * .3, r * .15, -.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawStick(ctx, len, lift, seed) {
    const R = mulberry32(seed | 0);
    ctx.save(); ctx.rotate(-lift * .5);
    const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#9a7048'); g.addColorStop(1, '#4a3020');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-len / 2, -4); ctx.quadraticCurveTo(0, -7, len / 2, -3); ctx.lineTo(len / 2, 3); ctx.quadraticCurveTo(0, 6, -len / 2, 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,24,12,.5)'; ctx.lineWidth = .8;
    for (let k = 0; k < 6; k++) { const x = -len / 2 + R() * len; ctx.beginPath(); ctx.moveTo(x, -3); ctx.lineTo(x + 6, -2); ctx.stroke(); }
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(len * .2, -3); ctx.lineTo(len * .32, -13); ctx.stroke();
    ctx.fillStyle = '#5a8a3a'; ctx.beginPath(); ctx.ellipse(len * .34, -15, 5, 2.5, -.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawMushroom(ctx, s, glow, kind) {
    ctx.save(); ctx.scale(s, s);
    if (kind === 'bracket') {
      ctx.fillStyle = glow > .3 ? `rgba(160,255,170,${.5 + glow * .5})` : '#d9b98a';
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 4, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,80,40,.5)'; ctx.fillRect(-12, 0, 24, 1.4);
    } else {
      ctx.fillStyle = '#efe6d0'; ctx.fillRect(-1, -8, 2, 8);
      ctx.fillStyle = glow > .3 ? `rgba(150,255,160,${.55 + glow * .45})` : '#c9a070';
      ctx.beginPath(); ctx.ellipse(0, -8, 5, 3.2, 0, Math.PI, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawMillipede(ctx, ph, dir) {
    ctx.save(); ctx.scale(dir, 1);
    for (let k = 0; k < 14; k++) {
      const x = -k * 3.2, y = Math.sin(ph * .4 - k * .4) * .8 - 3;
      ctx.strokeStyle = '#3a1a10'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + Math.sin(ph - k) * 1.2, y + 4.5); ctx.stroke();
      ctx.fillStyle = k % 2 ? '#7a2a1a' : '#5a1e12'; ctx.beginPath(); ctx.ellipse(x, y, 2.2, 2.4, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#2a120a'; ctx.beginPath(); ctx.arc(2, -3, 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* a coati: a raccoon cousin with a long nose and a ringed tail */
  function drawCoati(ctx, o) {
    const s = o.s || 1, legs = o.legs || 0, sniff = o.sniff || 0;
    ctx.save(); ctx.scale(s * (o.dir || 1), s);
    const fur = ctx.createLinearGradient(0, -40, 0, 0); fur.addColorStop(0, '#a87a4a'); fur.addColorStop(1, '#6a4428');
    /* tail, ringed, held up */
    ctx.lineCap = 'round';
    for (let k = 0; k < 9; k++) { const t = k / 9, x = 40 + t * 22 + Math.sin(t * 3) * 6, y = -26 - t * 46; ctx.strokeStyle = k % 2 ? '#3a2416' : '#c9a070'; ctx.lineWidth = 9 - t * 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(40 + (t + .11) * 22 + Math.sin((t + .11) * 3) * 6, -26 - (t + .11) * 46); ctx.stroke(); }
    /* legs */
    ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 6;
    for (const [x, ph] of [[-20, 0], [-8, Math.PI], [24, Math.PI], [34, 0]]) { const sw = Math.sin(legs + ph) * 6; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + sw, 0); ctx.stroke(); }
    /* body */
    ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(8, -22, 36, 17, 0, 0, TAU); ctx.fill();
    /* head and the long, bendy nose (down when sniffing) */
    ctx.save(); ctx.translate(-26, -26); ctx.rotate(.25 + sniff * .55);
    ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(-8, 0, 13, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a2e1c'; ctx.beginPath(); ctx.moveTo(-14, -4); ctx.quadraticCurveTo(-34, -2, -40, 6 + Math.sin(legs * 2) * sniff * 2); ctx.lineTo(-36, 9); ctx.quadraticCurveTo(-26, 6, -12, 6); ctx.fill();
    ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.arc(-39, 7, 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#efe6d0'; ctx.beginPath(); ctx.ellipse(-12, -2, 5, 2.6, -.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-12, -2.5, 1.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a4428'; ctx.beginPath(); ctx.ellipse(-2, -10, 4, 5, .3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }
  function drawLeaf(ctx, len, ang, col) {
    ctx.save(); ctx.rotate(ang);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(len * .3, -len * .28, len * .8, -len * .2, len, 0); ctx.bezierCurveTo(len * .8, len * .2, len * .3, len * .28, 0, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = len * .03; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * .95, 0); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     ICONS (HUD, stickers, reading pictures)
     ============================================================ */
  function drawIcon(ctx, key, px, form) {
    form = form || (window.G && window.G.form) || 'hercules';
    ctx.save();
    switch (key) {
      case 'egg': ctx.scale(4.4, 4.4); drawEgg(ctx, { grow: .7 }); break;
      case 'grub': case 'grub1': case 'grub2': case 'grub3': case 'wood': {
        if (key === 'wood') { ctx.fillStyle = '#9a6a3a'; rr(ctx, -40, -26, 80, 52, 10); ctx.fill(); ctx.strokeStyle = '#6a4424'; ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(0, 0, 10 + k * 9, 6 + k * 5, 0, 0, TAU); ctx.stroke(); } ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.ellipse(18, -6, 8, 5, .4, 0, TAU); ctx.fill(); break; }
        const r = key === 'grub1' ? 9 : key === 'grub2' ? 12 : 15;
        ctx.translate(0, -2); drawGrub(ctx, grubShape(r, .9, 0), r, { instar: key === 'grub1' ? 1 : 3 });
        break;
      }
      case 'pupa': ctx.translate(4, 0); drawPupa(ctx, { s: .62, lengthMM: 150, progress: .3 }); break;
      case 'beetle': case 'champ': case 'horn': ctx.translate(key === 'horn' ? -62 : -16, key === 'horn' ? 16 : 8); drawBeetle(ctx, { s: key === 'horn' ? .72 : .44, form, wet: 0, lengthMM: 160, seed: 3 }); if (key === 'champ') { ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -24); ctx.lineTo(-6, -38); ctx.lineTo(2, -28); ctx.lineTo(10, -40); ctx.lineTo(18, -28); ctx.lineTo(26, -38); ctx.lineTo(30, -24); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
      case 'rival': ctx.scale(-1, 1); ctx.translate(-16, 8); drawBeetle(ctx, { s: .44, form: 'lichyi', wet: .7, lengthMM: 150, seed: 9, lift: .4 }); break;
      case 'female': ctx.translate(2, 2); drawBeetle(ctx, { s: .58, male: false, form, wet: .3, lengthMM: 60, seed: 5 }); break;
      case 'fruit': ctx.scale(2.6, 2.6); drawFruit(ctx, 'mango', 5, 5); break;
      case 'fig': ctx.scale(3, 3); drawFruit(ctx, 'fig', 3, 3); break;
      case 'stick': ctx.scale(1.1, 1.1); drawStick(ctx, 70, .1, 4); break;
      case 'coati': ctx.translate(-4, 22); drawCoati(ctx, { s: .62, dir: 1, legs: 1 }); break;
      case 'log': {
        const g = ctx.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, '#7a5638'); g.addColorStop(1, '#3e2a1c');
        ctx.fillStyle = g; rr(ctx, -44, -22, 80, 44, 22); ctx.fill();
        ctx.fillStyle = '#c99a62'; ctx.beginPath(); ctx.ellipse(36, 0, 12, 22, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 1.5; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(36, 0, k * 3.5, k * 6.5, 0, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = '#5f8a3a'; ctx.beginPath(); ctx.ellipse(-10, -20, 18, 5, 0, Math.PI, TAU); ctx.fill();
        break;
      }
      case 'dirt': case 'room': {
        ctx.fillStyle = '#6a4428'; rr(ctx, -42, -34, 84, 68, 12); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,180,.15)'; for (let k = 0; k < 20; k++) { ctx.beginPath(); ctx.arc(-36 + (k * 37) % 72, -28 + (k * 23) % 58, 2.2, 0, TAU); ctx.fill(); }
        if (key === 'room') { ctx.fillStyle = '#b07040'; ctx.beginPath(); ctx.ellipse(0, 4, 30, 19, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#2a170c'; ctx.beginPath(); ctx.ellipse(0, 4, 25, 15, 0, 0, TAU); ctx.fill(); ctx.save(); ctx.translate(2, 4); drawPupa(ctx, { s: .3, lengthMM: 150, progress: .2 }); ctx.restore(); }
        break;
      }
      case 'tree': case 'branch': {
        ctx.translate(0, 8);
        ctx.fillStyle = '#5a3e28'; ctx.beginPath(); ctx.moveTo(-8, 40); ctx.lineTo(-5, -10); ctx.lineTo(5, -10); ctx.lineTo(8, 40); ctx.fill();
        ctx.strokeStyle = '#5a3e28'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(18, -2, 30, -16); ctx.stroke();
        for (const [x, y, r, c] of [[-12, -26, 22, '#3f8a3a'], [14, -32, 24, '#4fa046'], [0, -44, 20, '#5fb052'], [30, -18, 12, '#4fa046']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        if (key === 'branch') { ctx.save(); ctx.translate(20, -16); ctx.rotate(-.5); drawBeetle(ctx, { s: .2, form, lengthMM: 150 }); ctx.restore(); }
        break;
      }
      case 'leaf': ctx.translate(-38, 12); drawLeaf(ctx, 80, -.3, '#4f9a3a'); break;
      case 'stone': { const g = ctx.createRadialGradient(-10, -12, 4, 0, 0, 34); g.addColorStop(0, '#c9c4bc'); g.addColorStop(1, '#6a6660'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 4, 34, 24, -.1, 0, TAU); ctx.fill(); break; }
      case 'wings': ctx.translate(0, 10); drawBeetle(ctx, { s: .5, form, open: 1, flap: .6, lengthMM: 150 }); break;
      case 'fungus': { ctx.fillStyle = '#b07a48'; rr(ctx, -40, 10, 80, 26, 8); ctx.fill(); ctx.strokeStyle = '#f4ecd8'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-34 + k * 13, 32); ctx.quadraticCurveTo(-30 + k * 13, 20, -24 + k * 13, 14); ctx.stroke(); } ctx.translate(0, 12); for (const [x, sc] of [[-18, 3.2], [4, 4.2], [24, 2.8]]) { ctx.save(); ctx.translate(x, 0); drawMushroom(ctx, sc, 0, 'cap'); ctx.restore(); } break; }
      case 'moon': ctx.fillStyle = '#f5d860'; ctx.strokeStyle = '#c9a830'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 28, .55, TAU - .95); ctx.arc(12, -8, 22, TAU - 1.35, .95, true); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'rain': ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(-12, -8, 16, 0, TAU); ctx.arc(8, -14, 18, 0, TAU); ctx.arc(22, -4, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-16, -2, 12]) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x - 5, 32); ctx.stroke(); } break;
      case 'mouse': ctx.fillStyle = '#9a8a7a'; ctx.beginPath(); ctx.ellipse(0, 8, 28, 16, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(-24, -2, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#d9a0a0'; ctx.beginPath(); ctx.arc(-24, -14, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-30, -2, 2, 0, TAU); ctx.fill(); ctx.strokeStyle = '#9a8a7a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(26, 10); ctx.quadraticCurveTo(44, 0, 40, -16); ctx.stroke(); break;
      default: ctx.fillStyle = '#999'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  /* a cached canvas of an icon at px CSS pixels (drawn at 2x) */
  function icon(key, px, form) {
    form = form || (window.G && window.G.form) || 'hercules';
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

  return { drawBeetle, drawGrub, grubShape, drawExuvia, drawEgg, drawPupa, drawFruit, drawStick, drawMushroom, drawMillipede, drawCoati, drawLeaf, drawIcon, icon, wingCol };
})();
