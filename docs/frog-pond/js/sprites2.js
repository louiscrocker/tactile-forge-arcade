/* ============================================================
   sprites2.js — the neighbours and the new hazards
   ============================================================
   Painted turtle, water strider, caddisfly larva, water boatman,
   newt, leech, garter snake, raccoon, the fish shadow, toad egg
   strings and toadlets.  Same rules as sprites.js: side view,
   local frame head = +x, `s` is the scale.
   ============================================================ */
'use strict';

Object.assign(Sprites, (function () {
  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function stroke(ctx, pts, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }

  /* painted turtle. pose: bask | swim.  ph animates the legs. */
  function drawTurtle(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, swim = o.pose === 'swim';
    ctx.save(); ctx.scale(s, s);
    const k = swim ? Math.sin(ph) * 6 : 0;
    /* legs */
    ctx.strokeStyle = '#3f4a2a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (const [x, sgn] of [[-16, -1], [12, 1]]) { ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x + sgn * 8 + k, 14); ctx.stroke(); ctx.fillStyle = '#3f4a2a'; circ(ctx, x + sgn * 8 + k, 15, 3.5); ctx.fill(); }
    /* plastron */
    ctx.fillStyle = '#d9b25a'; ell(ctx, -2, 8, 26, 5); ctx.fill();
    /* shell */
    const g = ctx.createRadialGradient(-6, -10, 4, -2, -2, 30);
    g.addColorStop(0, '#6b7a3a'); g.addColorStop(.7, '#3f4a24'); g.addColorStop(1, '#2a3218');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-28, 6); ctx.quadraticCurveTo(-26, -18, 0, -19); ctx.quadraticCurveTo(26, -18, 28, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c9402a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-27, 5); ctx.quadraticCurveTo(0, 8, 27, 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(230,200,100,.5)'; ctx.lineWidth = 1;
    for (const x of [-14, 0, 14]) { ctx.beginPath(); ctx.moveTo(x, -17 + Math.abs(x) * .3); ctx.lineTo(x, 5); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-24, -6); ctx.quadraticCurveTo(0, -10, 24, -6); ctx.stroke();
    /* head and neck */
    ctx.strokeStyle = '#3f4a2a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(34 + k * .3, -6); ctx.stroke();
    ctx.fillStyle = '#3f4a2a'; ell(ctx, 38 + k * .3, -8, 8, 5.5); ctx.fill();
    ctx.strokeStyle = '#e0c040'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(24, -2); ctx.lineTo(42, -9); ctx.moveTo(24, 3); ctx.lineTo(40, -4); ctx.stroke();
    ctx.strokeStyle = '#c9402a'; ctx.beginPath(); ctx.moveTo(30, -1); ctx.lineTo(36, -3); ctx.stroke();
    ctx.fillStyle = '#111'; circ(ctx, 41 + k * .3, -10, 1.6); ctx.fill();
    ctx.restore();
  }
  /* water strider: sits on the surface on four long legs */
  function drawStrider(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = .9; ctx.lineCap = 'round';
    const k = Math.sin(ph) * 2;
    for (const [x0, x1, y1] of [[2, 18 + k, 4], [2, 14 + k, 6], [-2, -16 - k, 4], [-2, -12 - k, 6]]) { ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1 * .5, -3); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(9, 3); ctx.stroke();
    ctx.fillStyle = '#3a3a34'; ell(ctx, 0, 0, 6, 1.8); ctx.fill();
    ctx.fillStyle = '#222'; circ(ctx, 5.5, -.3, 1.3); ctx.fill();
    ctx.restore();
  }
  /* caddisfly larva: a tube of tiny stones with a head and legs out the front */
  function drawCaddis(ctx, o) {
    const s = o.s || 1, walk = o.walk || 0;
    ctx.save(); ctx.scale(s, s);
    const rng = mulberry32(o.seed || 3);
    ctx.fillStyle = '#6a5a44'; ctx.beginPath(); ctx.moveTo(6, -5); ctx.lineTo(-24, -3.5); ctx.lineTo(-24, 3.5); ctx.lineTo(6, 5); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 22; i++) { const x = -22 + rng() * 26, y = (rng() - .5) * 9; ctx.fillStyle = mixHex('#a09078', '#4a3f30', rng()); ell(ctx, x, y, 1.6 + rng() * 1.6, 1.2 + rng() * 1.2, rng() * 3); ctx.fill(); }
    ctx.fillStyle = '#c9b27a'; ell(ctx, 9, 0, 4, 3); ctx.fill();
    ctx.fillStyle = '#2a2018'; circ(ctx, 12, 0, 2.2); ctx.fill();
    ctx.strokeStyle = '#3a3020'; ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const k = Math.sin(walk + i * 2) * 1.5; ctx.beginPath(); ctx.moveTo(8 + i * 1.5, 2); ctx.lineTo(10 + i * 2 + k, 6); ctx.stroke(); }
    ctx.restore();
  }
  /* water boatman: oval bug rowing with two long oar legs */
  function drawBoatman(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    const k = Math.sin(ph);
    ctx.strokeStyle = '#3a3a2a'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, sgn * 2); ctx.lineTo(-6 + k * 6, sgn * 8); ctx.lineTo(-14 + k * 8, sgn * 9); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, '#8a8a6a'); g.addColorStop(1, '#4a4a3a');
    ctx.fillStyle = g; ell(ctx, 0, 0, 8, 4.2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .7; for (let x = -5; x < 6; x += 3) { ctx.beginPath(); ctx.moveTo(x, -3.5); ctx.lineTo(x - 1, 3.5); ctx.stroke(); }
    ctx.fillStyle = 'rgba(220,240,255,.6)'; ell(ctx, -1, -2.5, 4, 1.2); ctx.fill();          // the air bubble it carries
    ctx.fillStyle = '#222'; circ(ctx, 7, -1.2, 1.2); ctx.fill();
    ctx.restore();
  }
  /* eastern newt: slender, orange-brown with red spots, a finned tail */
  function drawNewt(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    const col = '#8a6a3a', dark = '#4a3418';
    /* tail */
    ctx.fillStyle = withAlpha(col, .55); ctx.beginPath(); ctx.moveTo(-10, -1);
    for (let x = 0; x <= 26; x += 3) ctx.lineTo(-10 - x, Math.sin(ph - x * .2) * 3 * (x / 26) - (5 - x * .17));
    for (let x = 26; x >= 0; x -= 3) ctx.lineTo(-10 - x, Math.sin(ph - x * .2) * 3 * (x / 26) + (5 - x * .17));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8, 0); for (let x = 0; x <= 26; x += 3) ctx.lineTo(-10 - x, Math.sin(ph - x * .2) * 3 * (x / 26)); ctx.stroke();
    /* legs */
    ctx.strokeStyle = dark; ctx.lineWidth = 1.4;
    for (const [x, sgn] of [[-6, 1], [8, -1]]) { const k = Math.sin(ph + x) * 2; ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x + sgn * 3 + k, 6); ctx.lineTo(x + sgn * 6 + k, 8); ctx.stroke(); }
    /* body & head */
    const g = ctx.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, '#a8844a'); g.addColorStop(1, col);
    ctx.fillStyle = g; ell(ctx, 0, 0, 12, 4); ctx.fill(); ell(ctx, 13, -.5, 5, 3.4); ctx.fill();
    ctx.fillStyle = '#c9402a'; for (const [x, y] of [[-6, -1.5], [0, -2], [6, -1]]) { circ(ctx, x, y, 1.1); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = .5; ctx.stroke(); }
    ctx.fillStyle = '#111'; circ(ctx, 15, -1.5, 1.1); ctx.fill();
    ctx.restore();
  }
  /* a leech: a dark ribbon that stretches and contracts */
  function drawLeech(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    const len = 14 + Math.sin(ph) * 6;
    ctx.strokeStyle = '#2a2418'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .5, -6 - Math.sin(ph * 1.3) * 3, len, -2 + Math.sin(ph) * 2); ctx.stroke();
    ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(1, -1); ctx.quadraticCurveTo(len * .5, -7.5 - Math.sin(ph * 1.3) * 3, len, -3 + Math.sin(ph) * 2); ctx.stroke();
    ctx.fillStyle = '#2a2418'; circ(ctx, len, -2 + Math.sin(ph) * 2, 2.6); ctx.fill();
    ctx.restore();
  }
  /* garter snake. pose: slither | coil | strike.  ph animates the S-curve, tongue 0..1 */
  function drawSnake(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, pose = o.pose || 'slither', tongue = o.tongue || 0, strike = o.strike || 0;
    ctx.save(); ctx.scale(s, s);
    const pts = [];
    if (pose === 'coil') { for (let i = 0; i <= 30; i++) { const t = i / 30; if (t < .6) { const a = Math.PI + t / .6 * TAU * 1.1, r = 16 - t * 8; pts.push([-6 + Math.cos(a) * r * 1.3, 2 + Math.sin(a) * r * .35]); } else { const k = (t - .6) / .4; pts.push([-6 + k * 10, -2 - k * 18 + Math.sin(k * 3) * 3]); } } }
    else { const L = 90; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([-L + t * L + strike * 24 * t, Math.sin(t * 5 - ph) * 7 * (1 - strike * .8) * (1 - t * .5)]); } }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    stroke(ctx, pts, 8, '#2f3a24');
    stroke(ctx, pts, 5, '#4f6a34');
    stroke(ctx, pts, pose === 'coil' ? 1 : 1.6, withAlpha('#e8d860', pose === 'coil' ? .7 : 1));   // the yellow stripe
    /* head */
    const h = pts[pts.length - 1], h2 = pts[pts.length - 3];
    const a = Math.atan2(h[1] - h2[1], h[0] - h2[0]);
    ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(a);
    ctx.fillStyle = '#2f3a24'; ell(ctx, 3, 0, 7, 4); ctx.fill();
    ctx.fillStyle = '#e8d860'; circ(ctx, 4, -2, 1.4); ctx.fill(); ctx.fillStyle = '#111'; circ(ctx, 4.4, -2, .8); ctx.fill();
    if (tongue > .02) { ctx.strokeStyle = '#d0304a'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10 + 7 * tongue, 0); ctx.lineTo(10 + 10 * tongue, -2 * tongue); ctx.moveTo(10 + 7 * tongue, 0); ctx.lineTo(10 + 10 * tongue, 2 * tongue); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  }
  /* raccoon. pose: walk | pat | yuck.  ph animates legs / paw */
  function drawRaccoon(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, pose = o.pose || 'walk';
    ctx.save(); ctx.scale(s, s);
    const grey = '#7a7a7a', dark = '#3a3a3a', light = '#b8b8b8';
    /* tail */
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = i % 2 ? dark : light; ctx.lineWidth = 9 - i * .8; ctx.beginPath(); ctx.moveTo(-26 - i * 6, 2 - i * 2); ctx.lineTo(-32 - i * 6, -2 - i * 3); ctx.stroke(); }
    /* legs */
    ctx.strokeStyle = dark; ctx.lineWidth = 5;
    const w = pose === 'walk' ? Math.sin(ph) * 4 : 0;
    for (const [x, k] of [[-14, w], [-6, -w], [10, -w * .6], [18, pose === 'pat' ? 0 : w * .6]]) { ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x + k, 20); ctx.stroke(); }
    /* body */
    const g = ctx.createLinearGradient(0, -14, 0, 12); g.addColorStop(0, light); g.addColorStop(.5, grey); g.addColorStop(1, dark);
    ctx.fillStyle = g; ell(ctx, -2, 0, 28, 13); ctx.fill();
    /* head */
    ctx.fillStyle = grey; ell(ctx, 24, -8, 12, 9); ctx.fill();
    ctx.fillStyle = grey; for (const dx of [-6, 6]) { ctx.beginPath(); ctx.moveTo(24 + dx - 3, -14); ctx.lineTo(24 + dx, -21); ctx.lineTo(24 + dx + 3, -14); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(14, -10); ctx.quadraticCurveTo(24, -14, 34, -9); ctx.quadraticCurveTo(24, -4, 14, -10); ctx.fill();   // mask
    ctx.fillStyle = '#f0f0f0'; ell(ctx, 26, -2, 7, 4); ctx.fill();
    ctx.fillStyle = '#f0f0f0'; circ(ctx, 20, -9, 2.2); ctx.fill(); circ(ctx, 29, -9, 2.2); ctx.fill();
    ctx.fillStyle = '#111'; circ(ctx, 20.5, -9, 1.2); ctx.fill(); circ(ctx, 29.5, -9, 1.2); ctx.fill();
    ctx.fillStyle = '#111'; circ(ctx, 36, -6, 2); ctx.fill();
    /* the patting paw */
    if (pose === 'pat') { const k = Math.abs(Math.sin(ph * 4)) * 10; ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(18, 4); ctx.lineTo(30, 12 + k); ctx.stroke(); ctx.fillStyle = dark; circ(ctx, 31, 13 + k, 3.5); ctx.fill(); }
    if (pose === 'yuck') { ctx.strokeStyle = '#d0304a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(34, 4); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '900 10px sans-serif'; ctx.fillText('yuck!', 30, -24); }
    ctx.restore();
  }
  /* the fish shadow: a big dark bass with a flicking tail */
  function drawFish(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    const k = Math.sin(ph) * 5;
    ctx.fillStyle = 'rgba(20,40,40,.78)';
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-44, -10 + k); ctx.lineTo(-40, 0); ctx.lineTo(-44, 10 + k); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(34, 0); ctx.quadraticCurveTo(20, -16, -10, -12); ctx.quadraticCurveTo(-28, -8, -32, 0); ctx.quadraticCurveTo(-28, 8, -10, 12); ctx.quadraticCurveTo(20, 16, 34, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, -11); ctx.lineTo(4, -22); ctx.lineTo(12, -10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, 11); ctx.lineTo(0, 19 + k * .3); ctx.lineTo(10, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(60,90,80,.6)'; ctx.beginPath(); ctx.moveTo(30, -2); ctx.quadraticCurveTo(10, -8, -10, -6); ctx.quadraticCurveTo(10, 0, 30, -2); ctx.fill();
    ctx.fillStyle = 'rgba(230,230,200,.85)'; circ(ctx, 24, -3, 2.6); ctx.fill(); ctx.fillStyle = '#111'; circ(ctx, 24.6, -3, 1.4); ctx.fill();
    ctx.restore();
  }
  /* toad spawn: two long jelly strings of black eggs, draped over a weed */
  function drawEggString(ctx, o) {
    const s = o.s || 1, dev = o.dev || 0, hatch = o.hatch || 0, rng = mulberry32(o.seed || 1);
    ctx.save(); ctx.scale(s, s);
    for (const row of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 12; i++) pts.push([-48 + i * 8, row * 6 + Math.sin(i * .9 + row) * 6]);
      ctx.strokeStyle = 'rgba(210,235,245,.35)'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1; ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const t = i / 12, k = rng();
        const x = lerp(pts[i][0], pts[i + 1][0], .5), y = lerp(pts[i][1], pts[i + 1][1], .5);
        if (k < hatch) continue;
        ctx.fillStyle = '#1d1d16';
        if (dev * k < .3) { circ(ctx, x, y, 2.2); ctx.fill(); }
        else { ctx.save(); ctx.translate(x, y); ctx.rotate(k * TAU); ell(ctx, 0, 0, 2.4, 1.7); ctx.fill(); ctx.strokeStyle = '#1d1d16'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.quadraticCurveTo(-3, 1, -4.5, -.5); ctx.stroke(); ctx.restore(); }
      }
    }
    ctx.restore();
  }

  /* red-winged blackbird on a stalk; sing 0..1 puffs the shoulders */
  function drawBlackbird(ctx, o) {
    const s = o.s || 1, sing = o.sing || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(-3, 13); ctx.moveTo(2, 8); ctx.lineTo(2, 13); ctx.stroke();
    ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-6, 2); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
    ell(ctx, 0, 2, 9, 7, -.2); ctx.fill();
    circ(ctx, 7, -5 - sing * 3, 5); ctx.fill();
    ctx.fillStyle = '#d8262a'; ell(ctx, -1, -1, 4 + sing * 2, 2.6 + sing * 1.4, -.3); ctx.fill();
    ctx.fillStyle = '#f0d040'; ell(ctx, -1, 1.4 + sing, 4 + sing * 1.5, 1, -.3); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.moveTo(11, -6 - sing * 3); ctx.lineTo(17, -5 - sing * 4 - sing * 2); ctx.lineTo(11, -4 - sing * 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /* purple pitcher plant: a rosette of red-veined trumpets */
  function drawPitcher(ctx, o) {
    const h = o.h || 40;
    ctx.save();
    for (let i = -2; i <= 2; i++) {
      ctx.save(); ctx.rotate(i * .32 + (o.lean || 0));
      const g = ctx.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, '#6a2a2a'); g.addColorStop(.5, '#a84a3a'); g.addColorStop(1, '#5a2020');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-7, -h * .6, -6, -h); ctx.lineTo(6, -h); ctx.quadraticCurveTo(7, -h * .6, 3, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c8604a'; ell(ctx, 0, -h, 6.5, 2.4); ctx.fill();
      ctx.fillStyle = '#3a1010'; ell(ctx, 0, -h, 4.5, 1.4); ctx.fill();
      ctx.strokeStyle = 'rgba(40,0,0,.4)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -h + 2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /* mayfly: upright wings, long tail threads, dancing flight */
  function drawMayfly(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = 'rgba(120,100,60,.8)'; ctx.lineWidth = .5;
    for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-11, k * 2 + Math.sin(ph) * 1, -17, k * 3 + 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(235,240,255,.7)'; ctx.beginPath(); ctx.moveTo(-1, -1); ctx.quadraticCurveTo(-4, -9 - Math.sin(ph * 3) * 1.5, 2, -9); ctx.lineTo(2, -1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,120,120,.5)'; ctx.stroke();
    ctx.fillStyle = '#b89a5a'; ctx.beginPath(); ctx.ellipse(-2, 0, 5, 1.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a5030'; circ(ctx, 3.4, -.3, 1.2); ctx.fill();
    ctx.restore();
  }
  /* a seven-spot ladybug, seen from the side */
  function drawLadybug(ctx, o) {
    const s = o.s || 1, wing = o.wing, open = o.open || 0;
    ctx.save(); ctx.scale(s, s);
    if (open > .05) { ctx.fillStyle = 'rgba(230,230,240,.55)'; for (const k of [-1, 1]) { ctx.save(); ctx.rotate(-.6 + k * .25 + Math.sin(wing || 0) * .4); ctx.beginPath(); ctx.ellipse(0, -9, 3, 9, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
    ctx.strokeStyle = '#151515'; ctx.lineWidth = 1; for (const x of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(x, 3); ctx.lineTo(x + 1, 6); ctx.stroke(); }
    const g = ctx.createRadialGradient(-2, -4, 1, 0, -1, 8); g.addColorStop(0, '#ff7b6b'); g.addColorStop(1, '#c02a22');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-7, 3); ctx.quadraticCurveTo(-7, -6, 0, -6); ctx.quadraticCurveTo(7, -6, 7, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#151515'; for (const [x, y] of [[-4, -1], [0, -4], [3, 0], [-1, 1]]) circ(ctx, x, y, 1.3), ctx.fill();
    ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.arc(7.5, 1, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4f1e6'; circ(ctx, 8.4, 0, .8); ctx.fill();
    ctx.restore();
  }

  return { drawMayfly, drawLadybug, drawBlackbird, drawPitcher, drawTurtle, drawStrider, drawCaddis, drawBoatman, drawNewt, drawLeech, drawSnake, drawRaccoon, drawFish, drawEggString };
})());
