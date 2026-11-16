/* ============================================================
   sprites.js — the macaw, drawn in code
   ============================================================
   Everything is drawn facing RIGHT, with y down.  u = r / 16, so
   a grown macaw (r 16) is about 40 units tall when it sits, with
   a tail as long again.
     drawParrot  pose 'perch': the feet are at (0, 0)
                 pose 'fly':   the middle of the body is at (0, 0);
                               ph is the wing beat
     drawChick   in the hollow, by instar: pink and bare · pins ·
                 patchy red · (instar 3 is a small drawParrot)
     drawEgg
   PAL holds the colours of every parrot in the card book.
   Icons and the other things are in sprites2.js.
   ============================================================ */
'use strict';

const PAL = {
  scarlet: { body: '#d9201f', dark: '#9f1414', wing: ['#d9201f', '#ffd21f', '#1f62c8'], tail: '#d9201f', tip: '#2a6fd0', face: '#f7f0e6', beakU: '#efe2c0', beakL: '#2a2420', eye: '#f7ecaa', foot: '#55555c', tailK: 1 },
  blue: { body: '#f6b400', dark: '#c98a00', wing: ['#1f7fe0', '#1f7fe0', '#1450a8'], tail: '#1f7fe0', tip: '#f6b400', face: '#f7f0e6', beakU: '#25221f', beakL: '#25221f', eye: '#f7ecaa', foot: '#55555c', tailK: 1, cap: '#3aa85a', back: '#1f7fe0', lines: true },
  redgreen: { body: '#b81822', dark: '#84101a', wing: ['#b81822', '#2f9a4a', '#1f62c8'], tail: '#b81822', tip: '#2a6fd0', face: '#f7f0e6', beakU: '#efe2c0', beakL: '#2a2420', eye: '#f7ecaa', foot: '#55555c', tailK: 1, lines: true },
  green: { body: '#4f9f3c', dark: '#35762a', wing: ['#4f9f3c', '#3d8a34', '#2a5fa8'], tail: '#4f9f3c', tip: '#b8d848', face: '#e9e4d2', beakU: '#d9cfae', beakL: '#b8ae90', eye: '#e86a2a', foot: '#6a6a66', tailK: .35, small: true },
  hyacinth: { body: '#1c3fb4', dark: '#142c84', wing: ['#1c3fb4', '#1c3fb4', '#142c84'], tail: '#1c3fb4', tip: '#142c84', face: '#ffd21f', beakU: '#1c1a1c', beakL: '#1c1a1c', eye: '#2a2420', foot: '#3a3a40', tailK: 1.05, ring: '#ffd21f' },
  kea: { body: '#6f8a3c', dark: '#4c6428', wing: ['#6f8a3c', '#e8762a', '#3f6f6a'], tail: '#3f7f6a', tip: '#2a4f4a', face: '#7f8f4c', beakU: '#4a4640', beakL: '#4a4640', eye: '#2a2420', foot: '#55554c', tailK: .4, thin: true },
  kakapo: { body: '#7fa03a', dark: '#5a7a2a', wing: ['#7fa03a', '#9ab048', '#6a8a30'], tail: '#7fa03a', tip: '#5a7a2a', face: '#c8b878', beakU: '#cfc8b0', beakL: '#b8b098', eye: '#2a2420', foot: '#8a8474', tailK: .3, fat: true },
  grey: { body: '#9a9ea6', dark: '#70747c', wing: ['#8a8e96', '#7c8088', '#5a5e66'], tail: '#d8261f', tip: '#d8261f', face: '#f2f0ec', beakU: '#1c1a1c', beakL: '#1c1a1c', eye: '#f2e6a0', foot: '#55555c', tailK: .28 },
  cockatoo: { body: '#fbfaf4', dark: '#dcd8c8', wing: ['#fbfaf4', '#f4f0d8', '#ece8c8'], tail: '#fbfaf4', tip: '#f4ec9a', face: '#fbfaf4', beakU: '#2a2622', beakL: '#2a2622', eye: '#2a2420', foot: '#55555c', tailK: .32, crest: '#ffe03a' },
  budgie: { body: '#7fd03a', dark: '#5aa82a', wing: ['#e8e04a', '#c8c83a', '#3a3a30'], tail: '#2a6fb0', tip: '#2a6fb0', face: '#f6e84a', beakU: '#d8c888', beakL: '#b8a868', eye: '#2a2420', foot: '#8a8a94', tailK: .55, small: true, bars: true, cap: '#f6e84a' }
};

const Sprites = (function () {
  const bean = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
  const INK = 'rgba(40,16,10,.55)';

  /* the head, facing right, centred at (0, 0) with radius h */
  function head(ctx, h, P, o) {
    ctx.fillStyle = P.body; bean(ctx, 0, 0, h, h * .96);
    if (P.cap) { ctx.fillStyle = P.cap; ctx.beginPath(); ctx.ellipse(-h * .05, -h * .3, h * .96, h * .68, 0, Math.PI, TAU); ctx.fill(); }
    if (P.crest) { ctx.fillStyle = P.crest; for (const a of [-.9, -.5, -.1]) { ctx.save(); ctx.translate(-h * .1, -h * .7); ctx.rotate(a - 1.2 + (o.crestUp ? .3 : 0)); bean(ctx, h * .9, 0, h * .9, h * .22); ctx.restore(); } }
    /* the bare face */
    ctx.fillStyle = P.face; bean(ctx, h * .34, h * .04, h * (P.ring ? .26 : .62), h * (P.ring ? .26 : .56), -.2);
    if (P.ring) { ctx.fillStyle = P.face; bean(ctx, h * .52, h * .62, h * .3, h * .14, -.5); }
    if (P.lines) { ctx.strokeStyle = P.cap ? '#25221f' : '#a01820'; ctx.lineWidth = h * .05; for (const k of [-.14, .04, .22]) { ctx.beginPath(); ctx.moveTo(h * .0, h * k); ctx.lineTo(h * .62, h * (k + .1)); ctx.stroke(); } }
    /* the beak: a big hooked top, a small dark bottom */
    const bk = P.small ? .7 : P.thin ? .8 : 1;
    ctx.fillStyle = P.beakL; ctx.beginPath(); ctx.moveTo(h * .56, h * .3); ctx.quadraticCurveTo(h * (.56 + .5 * bk), h * .44, h * (.56 + .34 * bk), h * (.74 + (o.open ? .2 : 0))); ctx.quadraticCurveTo(h * .5, h * .78, h * .4, h * .5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.beakU; ctx.beginPath(); ctx.moveTo(h * .5, -h * .5); ctx.bezierCurveTo(h * (.6 + .7 * bk), -h * .62, h * (.7 + .86 * bk), h * .1, h * (.56 + .52 * bk), h * (.66 + .14 * bk));
    ctx.quadraticCurveTo(h * (.6 + .36 * bk), h * .3, h * .56, h * .3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(.5, h * .05); ctx.stroke();
    /* the eye */
    const ex = h * .3, ey = -h * .1;
    if (o.sleep || o.blind) { ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = Math.max(.6, h * .08); ctx.beginPath(); ctx.arc(ex, ey - h * .05, h * .16, .2, Math.PI - .2); ctx.stroke(); }
    else { ctx.fillStyle = o.young ? '#3a2a20' : P.eye; bean(ctx, ex, ey, h * .19, h * .19); ctx.fillStyle = '#1a1210'; bean(ctx, ex + h * .02, ey, h * .1, h * .1); ctx.fillStyle = 'rgba(255,255,255,.9)'; bean(ctx, ex + h * .07, ey - h * .06, h * .04, h * .04); }
  }
  /* a tail: long feathers from (0, 0) along +x, length L */
  function tail(ctx, L, w, P, wave = 0) {
    for (let k = 0; k < 4; k++) {
      const off = (k - 1.5) * w * .34, len = L * (1 - Math.abs(k - 1.5) * .16), bend = wave * (1 + k * .2);
      ctx.fillStyle = k % 2 ? P.tail : shade(P.tail, .86);
      ctx.beginPath(); ctx.moveTo(0, off - w * .2); ctx.quadraticCurveTo(len * .5, off - w * .16 + bend * .5, len, off * .3 + bend); ctx.quadraticCurveTo(len * .5, off + w * .2 + bend * .5, 0, off + w * .2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.tip; ctx.beginPath(); ctx.moveTo(len * .7, off * .55 - w * .1 + bend * .72); ctx.quadraticCurveTo(len * .86, off * .4 + bend * .9, len, off * .3 + bend); ctx.quadraticCurveTo(len * .86, off * .44 + w * .12 + bend * .9, len * .7, off * .55 + w * .12 + bend * .72); ctx.closePath(); ctx.fill();
    }
  }
  /* an open wing from the shoulder (0, 0): a is -1 (down) .. 1 (up); three bands of colour out to the tip */
  function wing(ctx, u, a, P, k = 1) {
    const L = 42 * u, tx = -9 * u - 6 * u * a, ty = -a * L;
    const shape = (s) => {
      ctx.beginPath(); ctx.moveTo(11 * u * s, -1 * u);
      ctx.quadraticCurveTo((11 * u + tx) * .6 * s + 8 * u * s, ty * .55 * s, tx * s + 2 * u, ty * s);
      for (let i = 1; i <= 5; i++) { const f = i / 5, px = lerp(tx * s, -15 * u * s, f), py = lerp(ty * s, 2 * u, f); ctx.quadraticCurveTo(px - 4 * u * s + 3 * u * f, py + (ty > 0 ? -1 : 1) * 2.5 * u * (1 - f) * s, px, py); }
      ctx.closePath();
    };
    const cols = P.wing.map(c => k === 1 ? c : shade(c, k));
    ctx.fillStyle = cols[2]; shape(1); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(.5, u * .7); ctx.stroke();
    ctx.fillStyle = cols[1]; shape(.66); ctx.fill();
    ctx.fillStyle = cols[0]; shape(.4); ctx.fill();
  }

  /* o: { r, pose, look, ph (wing beat), face: ignored (flip outside), open (calling), sleep, young, bob, lean, carry, flap (flapping while sitting) } */
  function drawParrot(ctx, o = {}) {
    const P = PAL[o.look] || PAL.scarlet, u = (o.r || 16) / 16, fat = P.fat ? 1.3 : 1, tk = (o.tailK !== undefined ? o.tailK : 1) * P.tailK;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.pose === 'fly') {
      const a = Math.sin(o.ph || 0), a2 = Math.sin((o.ph || 0) - .5);
      ctx.save(); ctx.translate(-12 * u, 1 * u); ctx.rotate(Math.PI + .06 + a * .05); tail(ctx, 46 * u * tk, 9 * u, P, Math.sin((o.ph || 0) * .5) * 3 * u); ctx.restore();
      ctx.save(); ctx.translate(3 * u, -3 * u); wing(ctx, u * .92, a2, P, .72); ctx.restore();
      ctx.fillStyle = P.body; bean(ctx, 0, 0, 16 * u, 7.4 * u * fat, -.05);
      ctx.fillStyle = P.dark; ctx.beginPath(); ctx.ellipse(-1 * u, 2.6 * u, 14 * u, 4.6 * u, -.05, 0, Math.PI); ctx.fill();
      if (P.back) { ctx.fillStyle = P.back; ctx.beginPath(); ctx.ellipse(0, -1 * u, 15.6 * u, 6 * u, -.05, Math.PI, TAU); ctx.fill(); }
      ctx.save(); ctx.translate(15.5 * u, -2.4 * u); ctx.rotate(.12); head(ctx, 7.4 * u, P, o); ctx.restore();
      ctx.save(); ctx.translate(2 * u, -2 * u); wing(ctx, u, a, P); ctx.restore();
    } else {
      const lean = (o.lean || 0) + (o.bob ? Math.sin(o.bob * Math.PI) * .25 : 0);
      ctx.rotate(lean * .3);
      /* the tail hangs down behind the branch */
      ctx.save(); ctx.translate(-5 * u, -8 * u); ctx.rotate(Math.PI / 2 + .28); tail(ctx, 44 * u * tk, 8.5 * u, P, 0); ctx.restore();
      /* feet */
      ctx.strokeStyle = P.foot; ctx.lineWidth = 2.2 * u; for (const x of [-3, 3.4]) { ctx.beginPath(); ctx.moveTo(x * u, -6 * u); ctx.lineTo(x * u, -.4 * u); ctx.moveTo((x - 2.4) * u, 0); ctx.lineTo((x + 2.6) * u, 0); ctx.stroke(); }
      if (o.flap) { ctx.save(); ctx.translate(-2 * u, -26 * u); ctx.rotate(-1.1); wing(ctx, u * .9, Math.sin(o.ph || 0), P, .72); ctx.restore(); }
      /* body */
      ctx.fillStyle = P.body; bean(ctx, -1 * u, -18 * u, 9.6 * u * fat, 15 * u, .26);
      ctx.fillStyle = P.dark; ctx.beginPath(); ctx.ellipse(2.4 * u, -14 * u, 6 * u * fat, 11 * u, .3, -.4, 1.9); ctx.fill();
      if (P.bars) { ctx.strokeStyle = '#2a2a24'; ctx.lineWidth = .9 * u; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-9 * u, (-26 + k * 4) * u); ctx.lineTo(-3 * u, (-25 + k * 4) * u); ctx.stroke(); } }
      /* the folded wing: shoulder, band, long blue tips */
      if (o.flap) { ctx.save(); ctx.translate(-1 * u, -27 * u); ctx.rotate(-1.1); wing(ctx, u, Math.sin((o.ph || 0) + .4), P); ctx.restore(); }
      else {
        const W = P.wing;
        ctx.fillStyle = W[2]; ctx.beginPath(); ctx.moveTo(-9 * u, -22 * u); ctx.quadraticCurveTo(-14 * u, -4 * u, -10 * u, 12 * u); ctx.quadraticCurveTo(-3 * u, 0, 1 * u, -16 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = W[1]; ctx.beginPath(); ctx.moveTo(-9.6 * u, -25 * u); ctx.quadraticCurveTo(-13 * u, -12 * u, -9 * u, -1 * u); ctx.quadraticCurveTo(-1 * u, -8 * u, 2.4 * u, -20 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = W[0]; ctx.beginPath(); ctx.moveTo(-8 * u, -29 * u); ctx.quadraticCurveTo(-13 * u, -22 * u, -9 * u, -11 * u); ctx.quadraticCurveTo(0, -14 * u, 3.4 * u, -25 * u); ctx.quadraticCurveTo(-2 * u, -31 * u, -8 * u, -29 * u); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(.5, u * .6); ctx.beginPath(); ctx.moveTo(-9 * u, -11 * u); ctx.quadraticCurveTo(0, -14 * u, 3.4 * u, -25 * u); ctx.stroke();
      }
      if (o.carry) { ctx.fillStyle = '#7a3a8a'; bean(ctx, 15 * u, -27 * u, 2.6 * u, 2.6 * u); }
      ctx.save(); ctx.translate(5.4 * u, -33 * u); ctx.rotate(o.sleep ? .5 : o.open ? -.25 : 0); head(ctx, 8.2 * u * (P.fat ? 1.1 : 1), P, o); ctx.restore();
    }
    ctx.restore();
  }

  /* a chick in the hollow, sitting at (0, 0).  instar 0 pink and bare · 1 pins, eyes open · 2 patchy red */
  function drawChick(ctx, o = {}) {
    const i = o.instar || 0, r = o.r || 6, beg = o.beg || 0, ph = o.ph || 0;
    ctx.save(); ctx.lineJoin = 'round';
    const skin = i === 0 ? '#f2a9a0' : i === 1 ? '#d99a92' : '#c84a40';
    const wob = Math.sin(ph * 3) * .06;
    /* body: a soft pear */
    ctx.fillStyle = skin; bean(ctx, -r * .2, -r * .8, r * 1.15, r * .9, 0);
    if (i === 0) { ctx.fillStyle = 'rgba(255,255,255,.35)'; bean(ctx, -r * .4, -r * 1.1, r * .5, r * .3); }
    if (i >= 1) { ctx.fillStyle = i === 1 ? '#5a5a66' : '#d9201f'; const n = i === 1 ? 9 : 16, R = mulberry32(7 + i); for (let k = 0; k < n; k++) { const a = R() * TAU, d = R() * .9; ctx.save(); ctx.translate(-r * .2 + Math.cos(a) * d * r, -r * .8 + Math.sin(a) * d * r * .75); ctx.rotate(a); if (i === 1) ctx.fillRect(-r * .06, -r * .2, r * .12, r * .4); else bean(ctx, 0, 0, r * .3, r * .16); ctx.restore(); } }
    if (i >= 2) { ctx.fillStyle = '#ffd21f'; bean(ctx, -r * .7, -r * .7, r * .34, r * .16, .4); ctx.fillStyle = '#1f62c8'; bean(ctx, -r * 1.0, -r * .5, r * .3, r * .13, .5); }
    /* a stub of a wing, waving when it begs */
    ctx.fillStyle = shade(skin, .9); ctx.save(); ctx.translate(-r * .5, -r * 1.1); ctx.rotate(-.5 - beg * (.6 + .5 * Math.sin(ph * 14))); bean(ctx, -r * .45, 0, r * .5, r * .2); ctx.restore();
    /* head: too big, on a wobbly neck */
    ctx.save(); ctx.translate(r * .55, -r * (1.5 + beg * .5)); ctx.rotate(wob - beg * .5);
    const P = Object.assign({}, PAL.scarlet, { body: skin, face: i === 0 ? skin : '#f3e2d6', beakU: '#f2e6c8', beakL: i === 0 ? '#e6d6b8' : '#4a3a34' });
    head(ctx, r * .78, P, { blind: i === 0, young: true, open: beg > 0 });
    ctx.restore();
    ctx.restore();
  }

  function drawEgg(ctx, r, o = {}) {
    const c = o.crack || 0;
    ctx.save(); ctx.rotate((o.wob || 0) * .2);
    const g = ctx.createRadialGradient(-r * .3, -r * .5, r * .1, 0, 0, r * 1.3); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ddd6c4');
    ctx.fillStyle = g; bean(ctx, 0, 0, r * .82, r * 1.06);
    if (c > 0) { ctx.strokeStyle = '#6a5a48'; ctx.lineWidth = Math.max(.7, r * .07); ctx.beginPath(); ctx.moveTo(-r * .7, -r * .1); const n = 6; for (let k = 1; k <= Math.ceil(n * c); k++) ctx.lineTo(-r * .7 + k / n * r * 1.4, -r * .1 + (k % 2 ? -1 : 1) * r * .18); ctx.stroke(); }
    ctx.restore();
  }
  function drawLeaf(ctx, s, kind, col = '#3f8a3a') {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * .7, s, 0); ctx.quadraticCurveTo(0, s * .7, -s, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,20,.5)'; ctx.lineWidth = Math.max(.6, s * .06); ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
  }
  return { drawParrot, drawChick, drawEgg, drawLeaf, bean, head, tail, wing };
})();
