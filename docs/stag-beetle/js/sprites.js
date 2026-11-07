/* ============================================================
   sprites.js — the classic look of the stag beetle
   ============================================================
   Side view, facing +x, centred on the body, feet on y = 30.  A
   big male measures about 200 units from antler tip to wing tip at
   scale 1.  His jaws are the "antlers": they arch forward and up,
   with a tine on top and a fork at the tip, and they rise when he
   lifts.  She has small jaws, a smaller head, and a duller shine.
   paint.js has the same creatures, the same joints, painted.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();

  /* ---------- colour helpers for the beetle ---------- */
  function wingCol(form, wet, pale, k = 0) {
    const F = FORMS[form] || FORMS.boy;
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

  /* how long the jaws are, from the beetle's length (a real allometry: small males, small antlers) */
  function antlerLen(male, mm) { return male ? 30 + 72 * clamp(((mm || 60) - 35) / 40, 0, 1) : 12; }
  function antlerCol(F, pale) { const c = mixRgb(hexToRgb(F.wing), [30, 12, 8], .12); return pale > 0 ? mixRgb(c, [236, 222, 190], pale) : c; }
  /* A real Lucanus mandible, in the head's frame, seen in a slight 3/4 view: side 1 is the near jaw, -1 the far one.
     Each is built along an axis u (forward, tilted up) and v (out to its own side): a long arc that bows out and
     curves back in, a strong tooth on the inner edge about mid-length, a clean fork at the tip. */
  function jawGeom(L, side, male) {
    const A = -.34, ca = Math.cos(A), sa = Math.sin(A), k = .8, ox = 13, oy = side > 0 ? 5 : -7, W = L * (male ? .21 : .3);
    const P = (u, v) => [ox + u * ca - side * k * v * sa, oy + u * sa + side * k * v * ca];
    const bow = (t) => W * Math.sin(Math.PI * Math.pow(t, .82)), hw = (t) => lerp(2.4 + L * .058, 1.5 + L * .022, t);
    return { P, bow, hw, W };
  }
  function antlerPath(L, male, side = 1) {
    const { P, bow, hw } = jawGeom(L, side, male), p = new Path2D(), n = 14, end = .86;
    const pt = (q) => q;
    p.moveTo(...P(0, hw(0)));
    for (let i = 1; i <= n; i++) { const t = i / n * end; p.lineTo(...P(L * t, bow(t) + hw(t))); }
    if (male) {
      const nt = .9;
      p.quadraticCurveTo(...P(L * .97, bow(.9) + hw(.9) + L * .03), ...pt(P(L * 1.07, L * .085)));      /* the outer prong */
      p.quadraticCurveTo(...P(L * .96, bow(nt) + L * .025), ...pt(P(L * .9, bow(nt))));                  /* the notch of the fork */
      p.quadraticCurveTo(...P(L * .98, bow(.96) - L * .02), ...pt(P(L * 1.04, -L * .05)));               /* the inner prong */
      p.quadraticCurveTo(...P(L * .93, bow(.86) - hw(.86) - L * .012), ...pt(P(L * end * .94, bow(end * .94) - hw(end * .94))));
      for (let i = n; i >= 0; i--) {
        const t = i / n * .8;
        if (t > .62) { p.lineTo(...P(L * t, bow(t) - hw(t))); continue; }
        if (!p.toothDone) { p.toothDone = true; p.lineTo(...P(L * .62, bow(.62) - hw(.62))); p.quadraticCurveTo(...P(L * .59, bow(.59) - hw(.59) - L * .07), ...pt(P(L * .535, bow(.56) - hw(.56) - L * .135))); p.quadraticCurveTo(...P(L * .52, bow(.52) - hw(.52) - L * .05), ...pt(P(L * .47, bow(.47) - hw(.47)))); }
        if (t < .47) p.lineTo(...P(L * t, bow(t) - hw(t)));
      }
    } else {
      p.quadraticCurveTo(...P(L * .96, bow(.9)), ...pt(P(L * 1.05, 0)));
      for (let i = n; i >= 0; i--) { const t = i / n * end; p.lineTo(...P(L * t, bow(t) - hw(t) * .8)); }
    }
    p.closePath();
    return p;
  }
  /* one thin bright line along whichever edge of the jaw faces the sky */
  function jawStreak(ctx, L, side, male) {
    const { P, bow, hw } = jawGeom(L, side, male);
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const t = .12 + i / 12 * .66, q = P(L * t, bow(t) - side * hw(t) * .55); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
    ctx.stroke();
  }
  /* the pair, far jaw first if asked: draw(fill) puts the far one behind the head and the near one in front */
  function drawJaw(ctx, L, male, side, ac, dark) {
    const c = dark ? mixRgb(ac, [0, 0, 0], .46) : ac, g = ctx.createLinearGradient(13, 0, 13 + L, -L * .33);
    g.addColorStop(0, rgbStr(mixRgb(c, [0, 0, 0], .62))); g.addColorStop(.42, rgbStr(c)); g.addColorStop(1, rgbStr(mixRgb(c, [0, 0, 0], .2)));
    const p = antlerPath(L, male, side);
    ctx.fillStyle = g; ctx.fill(p);
    ctx.strokeStyle = 'rgba(14,5,2,.8)'; ctx.lineWidth = 1.1; ctx.lineJoin = 'round'; ctx.stroke(p);
    if (male && L > 26) { ctx.strokeStyle = dark ? 'rgba(255,220,190,.28)' : 'rgba(255,226,196,.72)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; jawStreak(ctx, L, side, male); }
  }

  function drawNearJaw(ctx, o) {
    const F = FORMS[o.form] || FORMS.boy;
    ctx.save(); ctx.scale(o.s, o.s); ctx.translate(34, 0); ctx.rotate(-(o.pinch || 0) * .26 - (o.lift || 0) * .42 + (o.jaw || 0));
    drawJaw(ctx, antlerLen(true, o.lengthMM), true, 1, antlerCol(F, 0), false);
    ctx.restore();
  }
  /* ============================================================
     THE BEETLE
     o: { s, male, form, wet, pale, walk, moving, open (wings 0..1), flap,
          lift (pronotum raised 0..1), pinch (head horn up 0..1), seed,
          lengthMM (sets how long the horns are), eat (0..1) }
     ============================================================ */
  function drawBeetle(ctx, o) {
    const s = o.s || 1, male = o.male !== false, form = o.form || 'boy', F = FORMS[form] || FORMS.boy;
    const wet = o.wet || 0, pale = o.pale || 0, walk = o.walk || 0, open = o.open || 0, lift = o.lift || 0, pinch = o.pinch || 0;
    /* horn length grows with body size: small males have short horns (a real allometry) */
    const antL = antlerLen(male, o.lengthMM);
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

    /* --- the pronotum: a broad, shiny black shield --- */
    ctx.save();
    ctx.translate(14, -16);
    ctx.rotate(-lift * .12);
    const pg = ctx.createRadialGradient(4, -8, 2, 10, 4, 30);
    pg.addColorStop(0, rgbStr(mixRgb(black, [255, 255, 255], .35))); pg.addColorStop(.35, rgbStr(mixRgb(black, [255, 255, 255], .06))); pg.addColorStop(1, blackS);
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.moveTo(-10, 22); ctx.bezierCurveTo(-14, 2, -6, -12, 8, -11); ctx.bezierCurveTo(24, -10, 28, 8, 24, 23); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shine; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-2, -7); ctx.quadraticCurveTo(8, -12, 18, -6); ctx.stroke();
    ctx.restore();
    /* --- the head and the antlers (they rise when lifting and pinching) --- */
    ctx.save();
    ctx.translate(34, 0);
    ctx.rotate(-pinch * .26 - lift * .42 + (o.jaw || 0) + (o.eat ? Math.sin(o.eat * 20) * .05 : 0));
    const ac = antlerCol(F, pale);
    /* the far jaw, then the head, then the near one */
    drawJaw(ctx, antL, male, -1, ac, true);
    ctx.fillStyle = blackS;
    ctx.beginPath(); ctx.ellipse(7, 1, male ? 15 : 11, male ? 12 : 9, -.1, 0, TAU); ctx.fill();
    /* the feeler with its little fan, and the orange brush of a tongue */
    ctx.strokeStyle = rgbStr(blackCol(pale, [70, 40, 20])); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(10, 6); ctx.lineTo(19, 11); ctx.stroke();
    ctx.fillStyle = rgbStr(blackCol(pale, [110, 64, 30])); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(19 + k * 1.8, 11 + k * .8, 1.1, 3, .4, 0, TAU); ctx.fill(); }
    const tongue = (o.eat ? 1 : 0);
    ctx.fillStyle = '#e8922a'; ctx.beginPath(); ctx.ellipse(16 + tongue * 7, 11, 3 + tongue * 5, 2 + tongue, .2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(11, -3, 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(10.3, -3.8, .7, 0, TAU); ctx.fill();
    drawJaw(ctx, antL, male, 1, ac, false);
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
    const s = o.s || 1, male = o.male !== false, k = o.progress || 0;
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
    /* the antlers, folded in their sheath */
    ctx.save(); ctx.translate(30, 2); ctx.scale(.8, .8); ctx.fillStyle = g; ctx.fill(antlerPath(antlerLen(male, o.lengthMM), male)); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-26, -12, 16, 4, -.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- fruit, sticks, fungus, critters ---------- */
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
    form = form || (window.G && window.G.form) || 'boy'; if (!FORMS[form]) form = 'boy';
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
      case 'beetle': case 'champ': ctx.translate(-22, 4); drawBeetle(ctx, { s: .55, form, male: FORMS[form].male, lengthMM: 75 }); break;
      case 'horn': case 'antler': ctx.translate(-60, 14); ctx.scale(1.25, 1.25); ctx.translate(-10, 6); drawBeetle(ctx, { s: .8, form: 'boy', lengthMM: 75 }); break;
      case 'rival': ctx.scale(-1, 1); ctx.translate(-22, 8); drawBeetle(ctx, { s: .5, form: 'r_rusty', lengthMM: 70 }); break;
      case 'female': ctx.translate(-6, 4); drawBeetle(ctx, { s: .6, male: false, form: 'girl', lengthMM: 44 }); break;
      case 'sap': case 'fruit': ctx.fillStyle = '#6a4a30'; rr(ctx, -40, -34, 80, 68, 8); ctx.fill(); { const g = ctx.createLinearGradient(0, -24, 0, 30); g.addColorStop(0, '#ffcf6a'); g.addColorStop(1, '#d9801e'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-8, -24); ctx.quadraticCurveTo(12, -24, 6, -4); ctx.quadraticCurveTo(14, 18, 2, 28); ctx.quadraticCurveTo(-12, 20, -6, -2); ctx.closePath(); ctx.fill(); } break;
      case 'mole': case 'badger': case 'magpie': case 'cat': case 'fox': case 'bat': case 'moth': case 'kid': case 'pile': case 'lamp': case 'bike': ctx.scale(px > 60 ? 1 : 1, 1); Critters.icon(ctx, key); break;
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
    form = form || (window.G && window.G.form) || 'boy'; if (!FORMS[form]) form = 'boy';
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

  return { drawBeetle, drawGrub, grubShape, drawExuvia, drawEgg, drawPupa, drawMushroom, antlerPath, antlerLen, antlerCol, jawGeom, jawStreak, drawJaw, drawNearJaw, drawLeaf, drawIcon, icon, wingCol };
})();
