/* ============================================================
   sprites.js — every living thing, drawn with paths
   ============================================================
   THE MOON JELLY is drawn side-on with its bell's top up (the
   caller rotates it to where it swims): origin at the middle of
   the bell's rim, the dome above (−y), the fringe of fine
   tentacles and the four frilly arms below.  Everything is see-
   through: the four rings show through the bell, food stuck on
   the slime shows as green specks, a mother's brood pouches show
   as little clusters on her arms.  A pulse squeezes the bell
   narrower and taller.
   THE EPHYRA is a little eight-armed star seen a little from
   above, each arm ending in two lappets; as it grows the gaps
   between the arms fill in.  THE POLYP hangs down from its spot
   (+y down from the origin): a sticky foot, a stalk, a cup with
   a mouth and 4, 8 or 16 tentacles; in winter it grows long and
   splits into a stack of discs.  THE PLANULA is a tiny hairy oval.
   Then plankton, herring, comb jellies, the tern and the gull,
   the leatherback turtle, the ocean sunfish, the sea slug, what
   lives on the taken spots, kelp, and the icons for the HUD, the
   stickers and the reading pictures.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();
  const F = (form) => FORMS[form] || FORMS.pink;
  const rgba = (hex, a) => { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

  /* ============================================================
     THE MOON JELLY
     ============================================================ */
  /* the bell's outline: half-width w, dome height h, a gently scalloped rim */
  function bellPath(ctx, w, h, under) {
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.bezierCurveTo(-w * 1.02, -h * .55, -w * .55, -h, 0, -h);
    ctx.bezierCurveTo(w * .55, -h, w * 1.02, -h * .55, w, 0);
    /* the underside, seen just a little from below */
    ctx.bezierCurveTo(w * .6, under, -w * .6, under, -w, 0);
    ctx.closePath();
  }
  function drawJelly(ctx, o) {
    const f = F(o.form), r = o.r || 10, c = clamp(o.pulse || 0, 0, 1), t = o.t || 0, simple = o.simple;
    const w = r * (1 - .17 * c), h = r * (.5 + .22 * c), under = r * (.1 + .08 * c);
    const rings = o.rings === undefined ? 1 : o.rings;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    /* the fringe of fine tentacles round the rim (behind the arms) */
    if (!simple) {
      ctx.strokeStyle = rgba(f.fringe, .42); ctx.lineWidth = Math.max(.25, r * .018);
      const n = Math.round(clamp(r * 1.4, 12, 40)), L = r * (.32 + c * .05);
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const u = k / n, x = -w + u * w * 2, y0 = Math.sin(u * Math.PI) * under * .9;
        const sw = Math.sin(t * 2.2 + u * 9) * r * .05 + c * (x > 0 ? -1 : 1) * r * .06;
        ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + sw, y0 + L * .5, x + sw * 2 - (x / w) * L * .15, y0 + L);
      }
      ctx.stroke();
    }
    /* the four frilly arms around the mouth (two in front, two behind) */
    const armL = r * (o.armL || .95);
    for (let k = 0; k < 4; k++) {
      const front = k % 2 === 1, bx = (k - 1.5) * r * .14, sway = Math.sin(t * 1.3 + k * 1.7) * r * .1;
      ctx.globalAlpha = front ? .78 : .5;
      ctx.fillStyle = rgba(f.arm, .55); ctx.strokeStyle = rgba(f.arm, .85); ctx.lineWidth = Math.max(.3, r * .025);
      ctx.beginPath();
      const pts = [];
      for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push([bx + sway * u * u + Math.sin(u * 6 + t * 2 + k) * r * .05 * u + (k - 1.5) * u * r * .1, under * .5 + u * armL]); }
      const wd = (u) => r * (.07 + .05 * Math.sin(u * 18 + k)) * (1 - u * .4);
      ctx.moveTo(pts[0][0] - wd(0), pts[0][1]);
      pts.forEach((p, j) => ctx.lineTo(p[0] - wd(j / 8), p[1]));
      for (let j = 8; j >= 0; j--) ctx.lineTo(pts[j][0] + wd(j / 8) * 1.2, pts[j][1]);
      ctx.closePath(); ctx.fill(); if (!simple) ctx.stroke();
      /* a mother's brood pouches: little clusters of babies along her arms */
      if (o.eggs > .02) {
        ctx.fillStyle = 'rgba(255,236,246,.95)';
        const nb = Math.round(3 + o.eggs * 6);
        for (let j = 1; j <= nb; j++) { const u = j / (nb + 1) * .85, p = pts[Math.round(u * 8)]; for (let e = 0; e < 3; e++) { ctx.beginPath(); ctx.arc(p[0] + (e - 1) * r * .045, p[1] + (e % 2) * r * .03, Math.max(.35, r * .028), 0, TAU); ctx.fill(); } }
      }
    }
    ctx.globalAlpha = 1;
    if (o.skipBell) { ctx.restore(); return; }
    /* the bell: clear jelly, brighter at the rim where you look through more of it */
    bellPath(ctx, w, h, under);
    const g = ctx.createRadialGradient(0, -h * .2, r * .1, 0, -h * .2, r * 1.15);
    g.addColorStop(0, rgba(f.bell, .2)); g.addColorStop(.7, rgba(f.bell, .32)); g.addColorStop(1, rgba(f.bell2, .62));
    ctx.fillStyle = g; ctx.fill();
    /* the radial canals, fine lines from the middle to the rim */
    if (!simple && r > 6) {
      ctx.save(); bellPath(ctx, w, h, under); ctx.clip();
      ctx.strokeStyle = rgba(f.bell2, .45); ctx.lineWidth = Math.max(.2, r * .012);
      for (let k = 0; k < 9; k++) { const a = (k / 8 - .5) * 2.4, x1 = Math.sin(a) * w * .98; ctx.beginPath(); ctx.moveTo(x1 * .25, -h * .45); ctx.quadraticCurveTo(x1 * .7, -h * .45 * Math.cos(a * .6), x1, under * .2); ctx.stroke(); }
      ctx.strokeStyle = rgba(f.bell2, .35); ctx.beginPath(); ctx.ellipse(0, -h * .05, w * .9, h * .12, 0, 0, Math.PI); ctx.stroke();
      ctx.restore();
    }
    /* the stomach and the four rings (the gonads) showing through */
    const gy = -h * .38, gr = r * .2;
    if (rings > .02) {
      /* four horseshoes round the middle, their open ends facing out, seen a little from above */
      const tilt = .32 + c * .1, R1 = r * .2, r2 = r * .15;
      for (const back of [true, false]) for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4 + (o.spin || 0), isBack = Math.sin(a) < 0;
        if (isBack !== back) continue;
        const cx = Math.cos(a) * R1, cz = Math.sin(a) * R1;
        ctx.strokeStyle = rgba(back ? f.ring2 : f.ring, (back ? .55 : .9) * rings); ctx.lineWidth = Math.max(.6, r * .055);
        ctx.beginPath();
        for (let j = 0; j <= 16; j++) { const th = a + .75 + j / 16 * (TAU - 1.5), x = cx + Math.cos(th) * r2, z = cz + Math.sin(th) * r2; j ? ctx.lineTo(x * (1 - c * .15), gy + z * tilt) : ctx.moveTo(x * (1 - c * .15), gy + z * tilt); }
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = rgba(f.ring, .3); ctx.beginPath(); ctx.ellipse(0, gy, r * .28, r * .08, 0, 0, TAU); ctx.fill();
    }
    /* the rim: a bright edge with the little sense organs */
    ctx.strokeStyle = rgba('#ffffff', .55); ctx.lineWidth = Math.max(.3, r * .03);
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.bezierCurveTo(-w * 1.02, -h * .55, -w * .55, -h, 0, -h); ctx.bezierCurveTo(w * .55, -h, w * 1.02, -h * .55, w, 0); ctx.stroke();
    if (!simple) { ctx.fillStyle = rgba(f.ring2, .7); for (const u of [-.92, -.5, 0, .5, .92]) { ctx.beginPath(); ctx.arc(u * w, Math.sqrt(1 - u * u) * under * .9, Math.max(.4, r * .03), 0, TAU); ctx.fill(); } }
    /* a wet highlight */
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(.4, r * .05);
    ctx.beginPath(); ctx.ellipse(-w * .2, -h * .62, w * .42, h * .3, -.15, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    /* food stuck on the slime of the bell */
    if (o.stuck) {
      const R = mulberry32(7);
      for (let k = 0; k < o.stuck; k++) { const u = R() * 1.6 - .8, x = u * w * .9, y = -Math.sqrt(Math.max(0, 1 - u * u)) * h * (.4 + R() * .5); ctx.fillStyle = k % 3 ? 'rgba(160,230,110,.95)' : 'rgba(255,200,140,.95)'; ctx.beginPath(); ctx.arc(x, y, Math.max(.6, r * .045), 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  /* ============================================================
     THE EPHYRA: a little star with eight forked arms
     ============================================================ */
  function drawEphyra(ctx, o) {
    const f = F(o.form), r = o.r || 5, c = clamp(o.pulse || 0, 0, 1), fill = clamp(o.fill || 0, 0, 1), t = o.t || 0;
    ctx.save();
    ctx.scale(1, .62);
    /* the arms bend in when it pulses */
    const disc = r * (.42 + fill * .48), bend = c * .35;
    ctx.fillStyle = rgba(f.bell, .5); ctx.strokeStyle = rgba('#ffffff', .75); ctx.lineWidth = Math.max(.25, r * .05); ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU + .2, a2 = a + TAU / 16, L = r * (1 - c * .18);
      const half = (TAU / 16) * (.35 + fill * .55);
      /* between the arms, the rim (filling in as it grows) */
      ctx.lineTo(Math.cos(a - half) * disc, Math.sin(a - half) * disc);
      /* the arm and its two lappets */
      const ax = Math.cos(a) * L, ay = Math.sin(a) * L, px = -Math.sin(a), py = Math.cos(a);
      ctx.lineTo(Math.cos(a) * L * .72 - px * r * .1, Math.sin(a) * L * .72 - py * r * .1 + bend * r * .2);
      ctx.lineTo(ax - px * r * .14, ay - py * r * .14 + bend * r * .3);
      ctx.lineTo(ax * .9, ay * .9 + bend * r * .25);
      ctx.lineTo(ax + px * r * .14, ay + py * r * .14 + bend * r * .3);
      ctx.lineTo(Math.cos(a) * L * .72 + px * r * .1, Math.sin(a) * L * .72 + py * r * .1 + bend * r * .2);
      ctx.lineTo(Math.cos(a + half) * disc, Math.sin(a + half) * disc);
      void a2;
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the sense organs at the notch of each arm */
    ctx.fillStyle = rgba(f.ring2, .8);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .86, Math.sin(a) * r * .86 + bend * r * .25, Math.max(.3, r * .05), 0, TAU); ctx.fill(); }
    /* the stomach in the middle, with its mouth hanging down */
    ctx.fillStyle = rgba(f.ring, .55); ctx.beginPath(); ctx.arc(0, 0, r * .26, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-r * .08, -r * .08, r * .08, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgba(f.arm, .7); ctx.lineWidth = Math.max(.3, r * .08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, r * .1); ctx.lineTo(Math.sin(t * 2) * r * .05, r * .42); ctx.stroke();
  }

  /* ============================================================
     THE POLYP hanging from its spot (+y down)
     ============================================================ */
  function drawPolyp(ctx, o) {
    const f = F(o.form), len = o.len || 14, st = clamp(o.stretch === undefined ? .6 : o.stretch, 0, 1), t = o.t || 0;
    const strob = clamp(o.strob || 0, 0, 1), discs = o.discs || 0, nT = o.tentacles || 8;
    ctx.save();
    ctx.rotate(-(o.lean || 0) * .75);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const body = rgba('#f4ecee', .82), edge = 'rgba(255,255,255,.9)';
    /* the sticky foot */
    ctx.fillStyle = 'rgba(240,226,220,.9)'; ctx.beginPath(); ctx.ellipse(0, .6, len * .12, len * .05, 0, 0, TAU); ctx.fill();
    const cupY = len, cupW = len * (.2 + .06 * (1 - strob));
    if (strob > .01 && discs) {
      /* the stack of discs: the polyp has grown long and split into little plates */
      const shown = Math.max(1, Math.round(discs * strob));
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-len * .05, 0); ctx.lineTo(-len * .08, len * .3); ctx.lineTo(len * .08, len * .3); ctx.lineTo(len * .05, 0); ctx.fill();
      const top = len * .28, step = (len * 1.05 - top) / Math.max(1, discs);
      for (let k = 0; k < shown; k++) {
        const y = top + (k + .5) * step, wv = cupW * (1.1 + .1 * Math.sin(k * 1.7)), wob = Math.sin(t * 3 + k) * len * .01 * (o.popping ? 4 : 1);
        ctx.fillStyle = rgba(f.bell, .78); ctx.strokeStyle = edge; ctx.lineWidth = Math.max(.25, len * .02);
        ctx.beginPath(); ctx.ellipse(wob, y, wv, step * .42, 0, 0, TAU); ctx.fill(); ctx.stroke();
        /* the notched rim of each little plate (its arms-to-be) */
        ctx.strokeStyle = rgba(f.ring2, .55);
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(wob + s * wv, y); ctx.lineTo(wob + s * wv * 1.18, y + step * .25); ctx.stroke(); }
        ctx.fillStyle = rgba(f.ring, .55); ctx.beginPath(); ctx.arc(wob, y, step * .16, 0, TAU); ctx.fill();
      }
      /* a few short tentacles left at the bottom */
      ctx.strokeStyle = 'rgba(250,240,240,.7)'; ctx.lineWidth = Math.max(.2, len * .015);
      const by = top + shown * step;
      for (let k = 0; k < 6; k++) { const a = (k / 5 - .5) * 2.2; ctx.beginPath(); ctx.moveTo(Math.sin(a) * cupW * .6, by); ctx.lineTo(Math.sin(a) * cupW * 1.2, by + len * .12 * (1 - strob)); ctx.stroke(); }
      ctx.restore();
      return;
    }
    /* the stalk, narrow at the foot, and the cup */
    const g = ctx.createLinearGradient(0, 0, 0, cupY);
    g.addColorStop(0, 'rgba(236,220,214,.85)'); g.addColorStop(1, 'rgba(250,244,246,.9)');
    ctx.fillStyle = g; ctx.strokeStyle = edge; ctx.lineWidth = Math.max(.25, len * .02);
    ctx.beginPath();
    ctx.moveTo(-len * .05, 0); ctx.quadraticCurveTo(-len * .06, cupY * .5, -cupW, cupY * .85);
    ctx.quadraticCurveTo(-cupW * 1.1, cupY, -cupW * .7, cupY * 1.02);
    ctx.lineTo(cupW * .7, cupY * 1.02); ctx.quadraticCurveTo(cupW * 1.1, cupY, cupW, cupY * .85);
    ctx.quadraticCurveTo(len * .06, cupY * .5, len * .05, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the stomach inside, tinted by the form */
    ctx.fillStyle = rgba(f.ring, .4); ctx.beginPath(); ctx.ellipse(0, cupY * .8, cupW * .55, cupY * .12, 0, 0, TAU); ctx.fill();
    /* the mouth on its little cone */
    ctx.fillStyle = 'rgba(250,236,240,.95)'; ctx.beginPath(); ctx.moveTo(-cupW * .3, cupY * 1.01); ctx.lineTo(0, cupY * 1.1); ctx.lineTo(cupW * .3, cupY * 1.01); ctx.fill();
    /* the tentacles: out and curling when stretched, folded in when pulled in */
    const TL = len * (.25 + st * .75);
    for (let k = 0; k < nT; k++) {
      const u = nT > 1 ? k / (nT - 1) : .5, a = (u - .5) * (2.0 + st * 1.1), front = k % 2;
      const sx = Math.sin(a) * cupW * .9, sy = cupY * 1.0;
      /* each tentacle arches out, then curls back up a little at its tip */
      const ex = sx + Math.sin(a) * TL * 1.05, ey = sy + Math.cos(a) * TL * .55 + TL * .3, wig = Math.sin(t * 2 + k * 1.3) * len * .05 * st;
      const mx = (sx + ex) * .5 + Math.sin(a) * TL * .25 + wig, my = (sy + ey) * .5 + TL * .15;
      ctx.globalAlpha = front ? 1 : .55;
      for (const [wd, al] of [[.05, .35], [.026, .9]]) {
        ctx.strokeStyle = `rgba(252,244,248,${al})`; ctx.lineWidth = Math.max(.2, len * wd);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ex + wig, ey - TL * .08 * st); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    /* caught food held in the tentacles */
    if (o.caught) for (let k = 0; k < o.caught; k++) { ctx.fillStyle = k === 1 ? 'rgba(255,200,140,.95)' : 'rgba(160,230,110,.95)'; ctx.beginPath(); ctx.arc((k - 1) * len * .14, cupY + TL * .6, Math.max(.6, len * .045), 0, TAU); ctx.fill(); }
    /* a bud growing on the side */
    if (o.bud) { ctx.fillStyle = 'rgba(246,234,236,.9)'; ctx.beginPath(); ctx.ellipse(cupW * .9, cupY * .5, len * .08 * o.bud, len * .14 * o.bud, -.5, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* the planula: a tiny oval covered in beating hairs (front end +y, the end that sticks on) */
  function drawPlanula(ctx, o) {
    const s = o.s || 2, t = o.t || 0;
    ctx.save();
    ctx.strokeStyle = 'rgba(240,250,255,.7)'; ctx.lineWidth = Math.max(.12, s * .06); ctx.lineCap = 'round';
    for (let k = 0; k < 18; k++) { const a = k / 18 * TAU, x = Math.cos(a) * s * .55, y = Math.sin(a) * s, wv = Math.sin(t * 20 + k) * .5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x * 1.35 + wv * s * .1, y * 1.18 + wv * s * .1); ctx.stroke(); }
    const g = ctx.createRadialGradient(-s * .15, -s * .3, s * .05, 0, 0, s * 1.1);
    g.addColorStop(0, 'rgba(255,250,246,.95)'); g.addColorStop(1, 'rgba(240,206,214,.8)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * .55, s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(230,170,190,.5)'; ctx.beginPath(); ctx.ellipse(0, s * .45, s * .32, s * .35, 0, 0, TAU); ctx.fill();
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
        const glow = night * .4 + (q.glow || 0);
        if (glow > .05) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 4); g.addColorStop(0, `rgba(120,220,255,${Math.min(1, glow)})`); g.addColorStop(1, 'rgba(120,220,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(200,170,110,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 1, .8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,170,110,.7)'; ctx.lineWidth = .15; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(1, 0); ctx.moveTo(0, .8); ctx.quadraticCurveTo(.8, 1.8, 0, 2.6); ctx.stroke();
        break;
      }
      case 'copepod': {
        ctx.rotate(-q.rot - t * .2 + Math.atan2(q.vy || 0, q.vx || .01));
        ctx.fillStyle = 'rgba(255,190,140,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 1.4, .7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,160,120,.8)'; ctx.beginPath(); ctx.moveTo(-1.2, 0); ctx.lineTo(-2.4, -.3); ctx.lineTo(-2.4, .3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,190,.8)'; ctx.lineWidth = .12; ctx.beginPath(); ctx.moveTo(1, -.3); ctx.lineTo(2.8, -1.4); ctx.moveTo(1, .3); ctx.lineTo(2.8, 1.4); ctx.stroke();
        ctx.fillStyle = '#d0201a'; ctx.beginPath(); ctx.arc(1, 0, .25, 0, TAU); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
  /* a herring or a little reef fish, facing +x, canonical 34 long */
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
  /* a comb jelly: a clear blob with eight rows of rainbow combs */
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
  /* a tern (white, black cap, forked tail) or a gull (grey back, yellow bill); canonical span 200 */
  function drawTern(ctx, o) {
    const s = o.s || 1, flap = Math.sin(o.ph || 0) * .3, gull = o.kind === 'gull';
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = gull ? '#c4ccd6' : '#f4f4f8';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -26 - flap * 60, -100, -14 - flap * 70); ctx.quadraticCurveTo(-50, -2, -8, 6); ctx.quadraticCurveTo(50, -2, 100, -14 - flap * 70); ctx.quadraticCurveTo(30, -26 - flap * 60, 0, 0); ctx.fill();
    ctx.fillStyle = gull ? '#2a2a30' : '#d8d8e0';
    if (gull) { for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 80, -12 - flap * 66); ctx.lineTo(sx * 100, -14 - flap * 70); ctx.lineTo(sx * 86, -6 - flap * 60); ctx.fill(); } }
    else { ctx.beginPath(); ctx.moveTo(-10, 4); ctx.quadraticCurveTo(-60, -8 - flap * 60, -98, -14 - flap * 70); ctx.quadraticCurveTo(-55, 2, -8, 8); ctx.fill(); }
    ctx.fillStyle = '#f4f4f8'; ctx.beginPath(); ctx.ellipse(2, 6, gull ? 22 : 18, gull ? 8 : 6, 0, 0, TAU); ctx.fill();
    if (gull) { ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(-34, 4); ctx.lineTo(-34, 12); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(-16, 6); ctx.lineTo(-40, 16); ctx.lineTo(-28, 7); ctx.lineTo(-40, 0); ctx.closePath(); ctx.fill(); }
    if (!gull) { ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.ellipse(16, 2, 8, 5, 0, Math.PI, TAU); ctx.fill(); }
    else { ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(20, 3, 1.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = gull ? '#f0c020' : '#e8402a'; ctx.beginPath(); ctx.moveTo(22, 4); ctx.lineTo(gull ? 34 : 38, gull ? 7 : 8); ctx.lineTo(22, 9); ctx.fill();
    ctx.restore();
  }
  /* the leatherback turtle, facing +x, canonical 100 long: dark, white-speckled, ridged, huge front flippers */
  function drawTurtle(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, fl = Math.sin(ph) * .5;
    ctx.save(); ctx.scale(s, s); ctx.lineJoin = 'round';
    /* far flippers */
    ctx.fillStyle = '#1a2230';
    ctx.save(); ctx.translate(18, 4); ctx.rotate(.4 + fl * .6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-10, 30, -34, 46); ctx.quadraticCurveTo(-18, 26, -6, 6); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(-30, 6); ctx.rotate(.3 - fl * .3); ctx.beginPath(); ctx.ellipse(-8, 6, 12, 5, .5, 0, TAU); ctx.fill(); ctx.restore();
    /* the shell: long, tapering, with ridges */
    const g = ctx.createLinearGradient(0, -20, 0, 14); g.addColorStop(0, '#3a4658'); g.addColorStop(.6, '#1c2432'); g.addColorStop(1, '#4a5466');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(30, -2); ctx.bezierCurveTo(26, -20, -10, -22, -40, -10); ctx.quadraticCurveTo(-56, -4, -58, 2); ctx.quadraticCurveTo(-40, 10, -10, 12); ctx.quadraticCurveTo(20, 12, 30, -2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,176,196,.5)'; ctx.lineWidth = 1.2;
    for (const k of [-.5, 0, .5]) { ctx.beginPath(); ctx.moveTo(28, -4 + k * 8); ctx.bezierCurveTo(10, -16 + k * 12, -20, -14 + k * 10, -54, 0 + k * 3); ctx.stroke(); }
    ctx.fillStyle = 'rgba(230,236,244,.75)'; const R = mulberry32(3); for (let k = 0; k < 28; k++) { ctx.beginPath(); ctx.arc(-50 + R() * 76, -14 + R() * 22, .7 + R() * .9, 0, TAU); ctx.fill(); }
    /* head and neck */
    ctx.fillStyle = '#2a3442'; ctx.beginPath(); ctx.moveTo(26, -6); ctx.quadraticCurveTo(40, -12, 48, -6); ctx.quadraticCurveTo(52, 0, 44, 4); ctx.quadraticCurveTo(34, 6, 26, 4); ctx.fill();
    ctx.fillStyle = 'rgba(230,236,244,.8)'; for (const [x, y] of [[36, -6], [42, -3], [38, 0], [32, -2]]) { ctx.beginPath(); ctx.arc(x, y, .9, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#0a0c10'; ctx.beginPath(); ctx.arc(44, -5, 1.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d8e0ea'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(49, -1); ctx.lineTo(44, 1); ctx.stroke();
    /* near front flipper */
    ctx.fillStyle = '#28323f';
    ctx.save(); ctx.translate(14, 6); ctx.rotate(.3 - fl); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, 34, -40, 52); ctx.quadraticCurveTo(-22, 30, -8, 4); ctx.fill(); ctx.restore();
    ctx.restore();
  }
  /* the ocean sunfish (mola), facing +x, canonical 100 long: a huge swimming head with tall fins */
  function drawSunfish(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, fin = Math.sin(ph) * .35;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#7a8a98';
    ctx.save(); ctx.translate(-12, -26); ctx.rotate(-fin); ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(-4, -34, 8, -44); ctx.quadraticCurveTo(10, -20, 10, 4); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(-12, 26); ctx.rotate(fin); ctx.beginPath(); ctx.moveTo(-8, -4); ctx.quadraticCurveTo(-4, 34, 8, 44); ctx.quadraticCurveTo(10, 20, 10, -4); ctx.fill(); ctx.restore();
    const g = ctx.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, '#8a9aa8'); g.addColorStop(.5, '#c8d2da'); g.addColorStop(1, '#e8eef2');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(44, 0); ctx.bezierCurveTo(44, -30, 10, -36, -16, -30); ctx.quadraticCurveTo(-24, 0, -16, 30); ctx.bezierCurveTo(10, 36, 44, 30, 44, 0); ctx.fill();
    /* the clavus: the frilly back edge where a tail would be */
    ctx.fillStyle = '#9aa8b4'; ctx.beginPath(); ctx.moveTo(-16, -30); for (let k = 0; k <= 8; k++) { const y = -30 + k * 7.5; ctx.quadraticCurveTo(-30, y - 3.7, -20 - (k % 2) * 4, y); } ctx.lineTo(-16, 30); ctx.quadraticCurveTo(-24, 0, -16, -30); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; const R = mulberry32(9); for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.arc(-8 + R() * 44, -20 + R() * 40, 1 + R() * 2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#6a7884'; ctx.beginPath(); ctx.ellipse(22, 6, 3, 6, .4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a2026'; ctx.beginPath(); ctx.arc(30, -6, 3.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(29, -7, 1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a5660'; ctx.beginPath(); ctx.ellipse(43, 2, 2, 3, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* a sea slug (an aeolid nudibranch), crawling along +x on a floor at y = 0 (flip it to crawl on a ceiling) */
  function drawSlug(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s); ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(246,240,236,.95)';
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(0, -5 - Math.sin(ph) * .5, 13, -2); ctx.quadraticCurveTo(15, 0, 13, 0.5); ctx.closePath(); ctx.fill();
    /* the cerata: finger-like bumps, orange at the tips */
    for (let k = 0; k < 9; k++) {
      const x = -11 + k * 2.6, L = 5 + Math.sin(k * 1.3) * 1.5, wv = Math.sin(ph * 1.5 + k) * .8;
      ctx.strokeStyle = '#c8a8b8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x + wv - 1, -2 - L); ctx.stroke();
      ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(x + wv - 1, -2 - L, .9, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#f0a050'; ctx.lineWidth = 1; for (const d of [0, 2]) { ctx.beginPath(); ctx.moveTo(11 + d * .4, -2.5); ctx.lineTo(13 + d, -7); ctx.stroke(); }
    ctx.restore();
  }
  /* what already lives on a taken spot (hanging down from y = 0) */
  function drawOccupant(ctx, kind, t, ph, form) {
    ctx.save();
    if (kind === 'barnacle') {
      for (const dx of [-4, 3]) { ctx.fillStyle = '#d8d0c0'; ctx.strokeStyle = '#7a7266'; ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(dx - 3, 0); ctx.lineTo(dx - 2, 3.5); ctx.lineTo(dx + 2, 3.5); ctx.lineTo(dx + 3, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#5a544a'; ctx.fillRect(dx - 1, 3.2, 2, .8); }
    } else if (kind === 'squirt') {
      const g = ctx.createLinearGradient(0, 0, 0, 9); g.addColorStop(0, 'rgba(240,220,170,.85)'); g.addColorStop(1, 'rgba(250,240,200,.6)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 4.5 + Math.sin(t + ph) * .3, 3, 4.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,140,80,.7)'; ctx.beginPath(); ctx.arc(-1, 8.6, .8, 0, TAU); ctx.arc(1.4, 7.6, .7, 0, TAU); ctx.fill();
    } else if (kind === 'sponge') {
      ctx.fillStyle = '#e8902a'; ctx.beginPath(); ctx.ellipse(0, 2.5, 6, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b8601a'; for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.arc(dx, 3, .7, 0, TAU); ctx.fill(); }
    } else drawPolyp(ctx, { len: 9, tentacles: 8, stretch: .55 + .2 * Math.sin(t * .7 + ph), lean: Math.sin(t * .4 + ph) * .3, t: t + ph, form: form || 'white' });
    ctx.restore();
  }
  /* kelp on the reef */
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
  /* eelgrass blades in the bay */
  function drawGrass(ctx, gr, t, ground) {
    const sw = Math.sin(t * .8 + gr.ph) * 6;
    ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(gr.x + k * 2, ground + 1); ctx.quadraticCurveTo(gr.x + k * 3 + sw * .4, ground - gr.h * .5, gr.x + k * 2 + sw + k * 3, ground - gr.h * (1 - Math.abs(k) * .2)); ctx.stroke(); }
  }

  /* ============================================================
     ICONS (HUD, life wheel, stickers, reading pictures): drawn in
     a 100×100 box centred on 0,0
     ============================================================ */
  function waterDrop(ctx, dark) {
    const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 48); g.addColorStop(0, dark ? '#4a8ac0' : '#bfe8f8'); g.addColorStop(1, dark ? '#0e3a6a' : '#3a8ac0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
  }
  function rockIcon(ctx) {
    const g = ctx.createLinearGradient(0, -46, 0, -14); g.addColorStop(0, '#8a8478'); g.addColorStop(1, '#4a463e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-46, -46); ctx.lineTo(46, -46); ctx.lineTo(46, -20); ctx.quadraticCurveTo(0, -10, -46, -16); ctx.closePath(); ctx.fill();
  }
  function drawIcon(ctx, key, px, form) {
    form = FORMS[form] ? form : 'pink';
    if (['pouch', 'planula', 'polyp', 'strobila', 'ephyra', 'medusa', 'adult', 'jelly', 'boy', 'girl', 'mum', 'planulae', 'plankton', 'copepod', 'diatom', 'combjelly', 'bud', 'tentacles', 'rings', 'arms', 'cloud', 'sparkle', 'ledge', 'rock', 'dock', 'slug'].includes(key)) waterDrop(ctx, ['sparkle', 'cloud'].includes(key));
    if (['bloom', 'current', 'kelp', 'turtle', 'sunfish', 'herring', 'fish', 'snow', 'winter'].includes(key)) { ctx.save(); waterDrop(ctx, key === 'bloom' || key === 'snow' || key === 'winter'); ctx.restore(); }
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.clip();
    switch (key) {
      case 'pouch': case 'mum': {
        ctx.translate(0, key === 'mum' ? -18 : -40); drawJelly(ctx, { r: key === 'mum' ? 30 : 46, form, eggs: 1, t: 1, armL: key === 'mum' ? 1.4 : 1.1 }); break;
      }
      case 'planula': ctx.rotate(.5); drawPlanula(ctx, { s: 26, t: .3 }); break;
      case 'planulae': { const R = mulberry32(5); for (let k = 0; k < 9; k++) { ctx.save(); ctx.translate(-26 + R() * 52, -26 + R() * 52); ctx.rotate(R() * TAU); drawPlanula(ctx, { s: 7, t: k }); ctx.restore(); } break; }
      case 'polyp': case 'tentacles': case 'bud': { rockIcon(ctx); ctx.translate(0, -18); drawPolyp(ctx, { len: 34, tentacles: key === 'polyp' ? 8 : 16, stretch: .9, t: 1, form, bud: key === 'bud' ? 1 : 0 }); if (key === 'bud') { ctx.translate(-26, 0); drawPolyp(ctx, { len: 20, tentacles: 8, stretch: .7, t: 2, form }); } break; }
      case 'strobila': { rockIcon(ctx); ctx.translate(0, -18); drawPolyp(ctx, { len: 46, tentacles: 8, strob: 1, discs: 6, t: 1, form }); break; }
      case 'ledge': case 'rock': { rockIcon(ctx); ctx.fillStyle = '#5a544a'; ctx.beginPath(); ctx.moveTo(-46, 30); ctx.quadraticCurveTo(0, 18, 46, 28); ctx.lineTo(46, 46); ctx.lineTo(-46, 46); ctx.fill(); for (const x of [-20, 4, 26]) { ctx.save(); ctx.translate(x, -18); drawPolyp(ctx, { len: 16, tentacles: 8, stretch: .7, t: x, form }); ctx.restore(); } break; }
      case 'dock': { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-46, -40, 92, 12); for (const x of [-30, 22]) ctx.fillRect(x, -46, 10, 92); for (const x of [-12, 4]) { ctx.save(); ctx.translate(x, -28); drawPolyp(ctx, { len: 16, tentacles: 8, stretch: .7, t: x, form }); ctx.restore(); } break; }
      case 'ephyra': drawEphyra(ctx, { r: 36, fill: .2, form, t: 1 }); break;
      case 'medusa': ctx.translate(0, -6); drawJelly(ctx, { r: 30, form, rings: 0, t: 1, armL: .9 }); break;
      case 'adult': case 'jelly': case 'boy': case 'rings': ctx.translate(0, -10); drawJelly(ctx, { r: 38, form, t: 1, armL: .9 }); break;
      case 'girl': ctx.translate(0, -12); drawJelly(ctx, { r: 36, form, t: 1, armL: 1, eggs: .6 }); break;
      case 'arms': ctx.translate(0, -40); drawJelly(ctx, { r: 40, form, t: 1, armL: 1.8 }); break;
      case 'bloom': { const R = mulberry32(11); for (let k = 0; k < 9; k++) { ctx.save(); ctx.translate(-30 + R() * 60, -28 + R() * 56); drawJelly(ctx, { r: 9 + R() * 6, form: FORM_KEYS[k % 4], t: k, simple: true }); ctx.restore(); } break; }
      case 'cloud': { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (const [x, y, r] of [[-10, 0, 18], [10, -6, 16], [6, 12, 14], [-14, 14, 10]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } break; }
      case 'heart': { ctx.fillStyle = '#ff6a9a'; ctx.beginPath(); ctx.moveTo(0, 26); ctx.bezierCurveTo(-40, 0, -24, -34, 0, -12); ctx.bezierCurveTo(24, -34, 40, 0, 0, 26); ctx.fill(); break; }
      case 'sparkle': { ctx.fillStyle = '#8ef0ff'; const R = mulberry32(4); for (let k = 0; k < 18; k++) { ctx.globalAlpha = .4 + R() * .6; ctx.beginPath(); ctx.arc(-34 + R() * 68, -34 + R() * 68, 1.5 + R() * 3, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; drawJelly(ctx, { r: 20, form, t: 1, simple: true }); break; }
      case 'current': { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (const y of [-18, 0, 18]) { ctx.beginPath(); ctx.moveTo(34, y); ctx.bezierCurveTo(10, y - 10, -10, y + 10, -34, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-26, y - 7); ctx.lineTo(-36, y); ctx.lineTo(-26, y + 7); ctx.stroke(); } break; }
      case 'plankton': for (const q of [{ x: -16, y: -10, kind: 'diatom', rot: 0 }, { x: 14, y: -14, kind: 'chain', rot: .4 }, { x: 0, y: 12, kind: 'copepod', rot: 0, vx: 1, vy: -.3 }, { x: -18, y: 16, kind: 'dino', rot: 0, glow: .6 }, { x: 18, y: 14, kind: 'diatom', rot: .5 }]) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(7, 7); ctx.translate(-q.x, -q.y); drawPlankton(ctx, Object.assign({ glow: q.glow || 0 }, q), .3, 0); ctx.restore(); } break;
      case 'diatom': ctx.scale(24, 24); drawPlankton(ctx, { x: 0, y: 0, kind: 'diatom', rot: 0 }, 0, 0); break;
      case 'copepod': ctx.scale(16, 16); drawPlankton(ctx, { x: 0, y: 0, kind: 'copepod', rot: 0, vx: 1, vy: -.4 }, 0, 0); break;
      case 'combjelly': drawCombJelly(ctx, { x: 0, y: -4, r: 24, ph: 1.2 }, 1); break;
      case 'herring': case 'fish': for (const [x, y] of [[-10, -12], [12, 4], [-14, 18]]) { ctx.save(); ctx.translate(x, y); drawFish(ctx, { s: 1.5, col: '#c8d8e8', col2: '#3a5a7a', ph: x }); ctx.restore(); } break;
      case 'tern': ctx.translate(0, 4); drawTern(ctx, { s: .42, ph: 1 }); break;
      case 'gull': case 'bird': ctx.translate(0, 4); drawTern(ctx, { s: .42, ph: 1, kind: 'gull' }); break;
      case 'turtle': ctx.translate(-4, -6); drawTurtle(ctx, { s: .78, ph: 1 }); break;
      case 'sunfish': drawSunfish(ctx, { s: .9, ph: 1 }); break;
      case 'slug': { rockIcon(ctx); ctx.translate(0, -16); ctx.scale(2.6, -2.6); drawSlug(ctx, { s: 1, ph: 1 }); break; }
      case 'kelp': { ctx.fillStyle = '#2a6a9a'; ctx.fillRect(-46, -46, 92, 92); for (const k of [{ x: -22, h: 80, ph: 0, w: 7 }, { x: 4, h: 92, ph: 2, w: 8 }, { x: 28, h: 70, ph: 4, w: 6 }]) drawKelp(ctx, k, 1, 44); break; }
      case 'moon': {
        ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,190,140,.6)'; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        break;
      }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'snow': case 'winter': { ctx.fillStyle = '#fff'; const R = mulberry32(2); for (let k = 0; k < 16; k++) { ctx.beginPath(); ctx.arc(-40 + R() * 80, -40 + R() * 80, 2 + R() * 3, 0, TAU); ctx.fill(); } ctx.strokeStyle = '#e8f4ff'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); ctx.stroke(); } break; }
      case 'sea': case 'water': {
        ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 0); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 2); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a6ab0'; ctx.beginPath(); ctx.moveTo(-46, 46); ctx.lineTo(-46, 14); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, 14 + Math.sin(x * .12 + 2) * 6); ctx.lineTo(46, 46); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -40; x <= 40; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 4); ctx.stroke();
        break;
      }
      default: ctx.translate(0, -10); drawJelly(ctx, { r: 36, form, t: 1 });
    }
    ctx.restore();
  }
  function icon(key, px, form) {
    form = form || (typeof window !== 'undefined' && window.G && window.G.form) || 'pink';
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

  return { drawJelly, drawEphyra, drawPolyp, drawPlanula, drawPlankton, drawFish, drawCombJelly, drawTern, drawTurtle, drawSunfish, drawSlug, drawOccupant, drawKelp, drawGrass, drawIcon, icon };
})();
