/* ============================================================
   sprites.js — everything drawn in code (the classic look)
   ============================================================
   The ocean sunfish at every stage (a see-through hatchling, a
   spiky star, a young sunfish with its clavus growing, a grown
   sunfish flapping its tall fins, lying flat to bask), its egg, the
   plankton, anchovies and reef fish, comb jellies, moon jellies, sea
   nettles, salps, krill, the gull, the visitors (mahi-mahi, tuna,
   sea lion, orcas, blue shark, leatherback), the boat, the net, the
   cleaner fish (señorita, halfmoon), giant kelp, and the icons for
   the HUD, the stickers and the reading pictures.  Animals face +x.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();
  const C = (hex) => hexToRgb(hex);
  const RGB = (c, a = 1) => rgbStr(c, a);
  const mx = mixRgb;

  /* the colours of a form, darkened by a fright (dark 0..1) */
  function molaCols(form, o = {}) {
    const F = FORMS[form] || FORMS.normal, k = (o.dark || 0) * .45;
    const d = (c) => mx(C(c), [30, 36, 44], k);
    return { b: d(F.body), b2: d(F.body2), be: d(F.belly), fin: d(F.fin), eye: F.eye, sp: C(F.spots), spotty: form === 'spotted' ? .9 : 0 };
  }
  function lob(ctx, x0, y0, x1, y1, tipx, tipy, w) {
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(lerp(x0, tipx, .5) - w, lerp(y0, tipy, .55), tipx, tipy);
    ctx.quadraticCurveTo(lerp(x1, tipx, .5) + w, lerp(y1, tipy, .55), x1, y1);
    ctx.closePath();
  }
  /* the clavus: a rounded rear edge made of little lobes, out behind the body's back edge at x = −30 */
  function clavusPath(ctx, ch, n, depth, flap) {
    const edge = (y) => -29 - depth * Math.sqrt(Math.max(0, 1 - (y / (ch * 1.02)) ** 2));
    if (ctx.beginPath) ctx.beginPath(); ctx.moveTo(-24, -ch);
    for (let i = 0; i < n; i++) {
      const y0 = -ch + i * ch * 2 / n, y1 = y0 + ch * 2 / n, ym = (y0 + y1) / 2;
      ctx.quadraticCurveTo(edge(ym) - 4 - Math.sin(flap * .5 + i) * .8, ym, edge(y1), y1);
    }
    ctx.lineTo(-24, ch); ctx.closePath();
  }
  /* the body outline of a grown or young sunfish (canonical length 100: nose at +50, clavus at −48) */
  function bodyPath(ctx, round) {
    const h = 34 * round;
    ctx.beginPath(); ctx.moveTo(50, 2);
    ctx.bezierCurveTo(50, -h * .9, 18, -h * 1.2, -30, -h * .95);
    ctx.lineTo(-30, h * .95);
    ctx.bezierCurveTo(18, h * 1.2, 50, h * .9, 50, 2);
    ctx.closePath();
  }
  function drawMola(ctx, o, juv) {
    const cols = molaCols(o.form, o), f = Math.sin(o.flap || 0), k = .62 + .38 * Math.abs(Math.cos(o.flap || 0)), round = juv ? 1.05 : 1;
    const lean = f * 9, H = juv ? 40 : 54;
    /* the tall fins, behind the body: dorsal up, anal down, flapping together like wings */
    ctx.fillStyle = RGB(cols.fin); ctx.strokeStyle = RGB(cols.b2, .7); ctx.lineWidth = 1.2;
    lob(ctx, -34, -26, -6, -30, -24 + lean, -30 - H * k, 4); ctx.fill(); ctx.stroke();
    lob(ctx, -34, 26, -6, 30, -24 + lean, 30 + H * k, 4); ctx.fill(); ctx.stroke();
    /* the clavus: the frilly rudder where a tail would be */
    const n = juv ? 5 : 8, ch = 34 * round * .95;
    ctx.fillStyle = RGB(mx(cols.fin, cols.be, .25)); clavusPath(ctx, ch, n, juv ? 9 : 14, o.flap || 0);
    ctx.fill(); ctx.strokeStyle = RGB(cols.b2, .5); ctx.stroke();
    /* the body: dark back, silver sides, pale belly */
    bodyPath(ctx, round);
    const g = ctx.createLinearGradient(0, -36, 0, 36); g.addColorStop(0, RGB(cols.b2)); g.addColorStop(.42, RGB(cols.b)); g.addColorStop(1, RGB(cols.be));
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); bodyPath(ctx, round); ctx.clip();
    /* rough skin: soft mottling, spots for a spotted (or excited) sunfish, sea lice when itchy */
    const R = mulberry32(o.seed || 7);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(255,255,255,${.05 + R() * .06})`; ctx.beginPath(); ctx.ellipse(-26 + R() * 74, -30 + R() * 60, 3 + R() * 7, 2 + R() * 4, R() * 3, 0, TAU); ctx.fill(); }
    const spots = Math.max(cols.spotty, o.spots || 0);
    if (spots > .05) for (let i = 0; i < 34; i++) { ctx.fillStyle = RGB(cols.sp, .55 * spots); ctx.beginPath(); ctx.arc(-26 + R() * 72, -30 + R() * 60, 1.5 + R() * 3.2, 0, TAU); ctx.fill(); }
    const lice = Math.round((o.lice || 0) * 26);
    for (let i = 0; i < lice; i++) { const x = -24 + R() * 66, y = -28 + R() * 56; ctx.fillStyle = 'rgba(70,52,40,.85)'; ctx.beginPath(); ctx.ellipse(x, y, 1.6, 1, R() * 3, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(220,200,170,.6)'; ctx.beginPath(); ctx.arc(x - .5, y - .4, .45, 0, TAU); ctx.fill(); }
    ctx.restore();
    bodyPath(ctx, round); ctx.strokeStyle = RGB(cols.b2, .8); ctx.lineWidth = 1.1; ctx.stroke();
    if (juv && (o.spiky || 0) > .02) { ctx.fillStyle = RGB(cols.b, .9); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, x = 10 + Math.cos(a) * 38, y = Math.sin(a) * 34, L = 6 * o.spiky; ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * 2, y + Math.cos(a) * 2); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.lineTo(x + Math.sin(a) * 2, y - Math.cos(a) * 2); ctx.fill(); } }
    /* gill opening, the little pectoral fin, eye, the small round beak-mouth */
    ctx.fillStyle = RGB(cols.b2, .8); ctx.beginPath(); ctx.ellipse(22, 3, 2, 4.5, .2, 0, TAU); ctx.fill();
    ctx.fillStyle = RGB(mx(cols.fin, cols.b2, .3)); ctx.save(); ctx.translate(19, 4); ctx.rotate(.5 + f * .3); ctx.beginPath(); ctx.ellipse(-5, 0, 7, 3.2, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#e8ecef'; ctx.beginPath(); ctx.arc(36, -7, 5.2, 0, TAU); ctx.fill();
    ctx.fillStyle = cols.eye; ctx.beginPath(); ctx.arc(37, -7, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(35.8, -8.4, 1.1, 0, TAU); ctx.fill();
    const m = 1.6 + (o.eat || 0) * 2.2;
    ctx.fillStyle = RGB(cols.b2); ctx.beginPath(); ctx.ellipse(49.5, 3, m * .7, m, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1e1e'; ctx.beginPath(); ctx.ellipse(50, 3, m * .4, m * .65, 0, 0, TAU); ctx.fill();
  }
  /* a see-through hatchling (canonical 100 long): a round body with a yolk, a big eye and a fin fold */
  function drawHatchling(ctx, o) {
    const w = Math.sin(o.flap || 0) * 6;
    ctx.fillStyle = 'rgba(220,240,250,.35)'; ctx.strokeStyle = 'rgba(230,248,255,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, -14); ctx.quadraticCurveTo(-40, -12 + w, -58, w * 1.6); ctx.quadraticCurveTo(-40, 12 + w, -14, 14); ctx.fill(); ctx.stroke();
    const g = ctx.createRadialGradient(4, -8, 4, 8, 0, 34); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(190,225,240,.3)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(8, 0, 32, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(250,200,110,.8)'; ctx.beginPath(); ctx.ellipse(6, 14, 16, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,60,.9)'; ctx.beginPath(); ctx.arc(2, 14, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#10161c'; ctx.beginPath(); ctx.arc(26, -8, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,200,255,.7)'; ctx.beginPath(); ctx.arc(28, -10, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(24, -12, 2.6, 0, TAU); ctx.fill();
  }
  /* the spiky star (canonical 100 across the spikes): a round body bristling with spikes */
  function drawStar(ctx, o) {
    const sp = o.spiky === undefined ? 1 : o.spiky, w = Math.sin(o.flap || 0) * .06, n = 12;
    ctx.fillStyle = 'rgba(214,196,150,.9)'; ctx.strokeStyle = 'rgba(120,100,70,.7)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + .13 + w, L = (26 + (i % 2) * 10) * sp;
      ctx.beginPath(); ctx.moveTo(Math.cos(a - .2) * 24, Math.sin(a - .2) * 24); ctx.lineTo(Math.cos(a) * (28 + L), Math.sin(a) * (28 + L)); ctx.lineTo(Math.cos(a + .2) * 24, Math.sin(a + .2) * 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const g = ctx.createRadialGradient(-6, -10, 4, 0, 0, 32); g.addColorStop(0, 'rgba(250,240,210,.95)'); g.addColorStop(1, 'rgba(190,168,120,.9)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(150,120,80,.4)'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 2.4) * 15, Math.sin(i * 2.4) * 15, 2.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#10161c'; ctx.beginPath(); ctx.arc(14, -8, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12, -10, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a3828'; ctx.beginPath(); ctx.arc(27, 4, 3, 0, TAU); ctx.fill();
  }
  /* o: { s (length / 100), form, stage: larva|star|juvenile|mola, flap, roll (0..1 lying flat), spiky, dark, spots, lice, eat, seed } */
  function drawSunfish(ctx, o) {
    const s = o.s || 1, st = o.stage || 'mola';
    ctx.save(); ctx.scale(s, s);
    if (o.roll) { ctx.rotate(-.1 * o.roll); ctx.scale(1, 1 - .62 * o.roll); }
    if (st === 'larva') drawHatchling(ctx, o);
    else if (st === 'star') drawStar(ctx, o);
    else drawMola(ctx, o, st === 'juvenile');
    ctx.restore();
  }
  /* an egg (canonical radius 10): clear, with an oil droplet and a curled baby when it is nearly ready */
  function drawEgg(ctx, o = {}) {
    const s = o.s || 1, r = 10 * s;
    const g = ctx.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(200,230,245,.35)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(230,245,255,.9)'; ctx.lineWidth = Math.max(.15, r * .08);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,190,90,.85)'; ctx.beginPath(); ctx.arc(r * .3, r * .3, r * .28, 0, TAU); ctx.fill();
    if (o.eye) { ctx.strokeStyle = 'rgba(160,190,200,.8)'; ctx.lineWidth = r * .12; ctx.beginPath(); ctx.arc(0, 0, r * .55, Math.PI * .9, Math.PI * 2.3); ctx.stroke(); ctx.fillStyle = '#10161c'; ctx.beginPath(); ctx.arc(-r * .35, -r * .2, r * .16, 0, TAU); ctx.fill(); }
  }
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
  /* a gull standing on a basking sunfish (canonical: 40 tall, feet at y = 0), pecking */
  function drawGullStand(ctx, o) {
    const s = o.s || 1, peck = Math.max(0, Math.sin((o.ph || 0) * 4)) * .5;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#e0a040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-2, -10); ctx.moveTo(3, 0); ctx.lineTo(2, -10); ctx.stroke();
    ctx.fillStyle = '#f6f6f8'; ctx.beginPath(); ctx.ellipse(0, -18, 12, 9, -.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9ea4ae'; ctx.beginPath(); ctx.ellipse(-3, -20, 11, 6, -.25, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(-22, -16); ctx.lineTo(-12, -16); ctx.fill();
    ctx.save(); ctx.translate(9, -26); ctx.rotate(peck);
    ctx.fillStyle = '#f6f6f8'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b020'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(13, 2); ctx.lineTo(4, 3.4); ctx.fill();
    ctx.fillStyle = '#c03020'; ctx.beginPath(); ctx.arc(10, 2.4, .9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(2, -1.5, 1.1, 0, TAU); ctx.fill();
    ctx.restore(); ctx.restore();
  }
  /* a moon jelly (canonical bell radius 10): a see-through dome with four pink rings and a frilly fringe */
  function drawMoonJelly(ctx, r, t, ph) {
    const sq = 1 + Math.sin(t * 2 + ph) * .08;
    const g = ctx.createRadialGradient(0, -r * .3, r * .1, 0, 0, r * 1.1); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(200,220,255,.22)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(235,245,255,.75)'; ctx.lineWidth = r * .05;
    ctx.beginPath(); ctx.ellipse(0, 0, r * sq, r * .55 / sq, 0, Math.PI, TAU); ctx.quadraticCurveTo(0, r * .18, -r * sq, 0); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,150,200,.8)'; ctx.lineWidth = r * .09;
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(k * r * .3, -r * .14, r * .17, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(235,245,255,.5)'; ctx.lineWidth = r * .03;
    for (let i = -6; i <= 6; i++) { const x = i / 6 * r * sq; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + Math.sin(t * 2 + i) * r * .06, r * .3); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(245,230,250,.6)'; ctx.lineWidth = r * .08;
    for (const k of [-.25, .25]) { ctx.beginPath(); ctx.moveTo(k * r, 0); ctx.quadraticCurveTo(k * r * 1.6 + Math.sin(t + k * 9) * r * .2, r * .6, k * r * .8, r * 1.1); ctx.stroke(); }
  }
  /* a Pacific sea nettle (canonical bell radius 10): a golden bell, long frilly arms and thin tentacles */
  function drawNettle(ctx, r, t, ph) {
    ctx.strokeStyle = 'rgba(160,60,40,.55)'; ctx.lineWidth = r * .03;
    for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(i / 5 * r * .9, 0); ctx.quadraticCurveTo(i / 5 * r + Math.sin(t * 1.2 + i) * r * .3, r * 2, i / 5 * r * .6 + Math.sin(t * .8 + i) * r * .5, r * 3.6); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,240,220,.8)'; ctx.lineWidth = r * .14;
    for (const k of [-.15, .15]) { ctx.beginPath(); ctx.moveTo(k * r, r * .1); ctx.bezierCurveTo(k * r * 3 + Math.sin(t + k * 9) * r * .4, r * 1.2, -k * r * 2, r * 2, k * r + Math.sin(t * .7) * r * .3, r * 2.8); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -r * .6, 0, 0); g.addColorStop(0, 'rgba(240,180,80,.9)'); g.addColorStop(1, 'rgba(210,120,50,.75)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .6, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(150,60,30,.5)'; ctx.lineWidth = r * .04; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i / 4 * r * .3, -r * .55); ctx.lineTo(i / 4 * r, 0); ctx.stroke(); }
  }
  /* a salp (canonical barrel 10 long), and chains of them */
  function drawSalp(ctx, x, y, L, a, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = 'rgba(220,240,250,.35)'; ctx.strokeStyle = 'rgba(235,250,255,.85)'; ctx.lineWidth = L * .05;
    ctx.beginPath(); ctx.ellipse(0, 0, L * .5, L * .3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(235,250,255,.45)'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * L * .18, -L * .28); ctx.lineTo(i * L * .18, L * .28); ctx.stroke(); }
    ctx.fillStyle = 'rgba(200,120,70,.85)'; ctx.beginPath(); ctx.arc(-L * .3, 0, L * .08, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* food drifting in the sea: f = { kind, r, ph, rot } drawn at the origin */
  function drawFood(ctx, f, t) {
    const r = f.r;
    switch (f.kind) {
      case 'moon': drawMoonJelly(ctx, r, t, f.ph); break;
      case 'nettle': drawNettle(ctx, r * .8, t, f.ph); break;
      case 'comb': drawCombJelly(ctx, { x: 0, y: 0, r: r * .7, ph: f.ph }, t); break;
      case 'salp': { const n = 6; for (let i = 0; i < n; i++) { const u = i / (n - 1) - .5; drawSalp(ctx, u * r * 2.2, Math.sin(t + i * .7 + f.ph) * r * .15, r * .42, f.rot + Math.sin(t * .5 + i) * .2, t); } break; }
      case 'salplet': drawSalp(ctx, 0, 0, r * 1.6, f.rot, t); break;
      case 'krill': { ctx.save(); ctx.scale(r * .7, r * .7); drawPlankton(ctx, { x: 0, y: 0, kind: 'krill', rot: 0, ph: f.ph }, 0, 0); ctx.restore(); break; }
    }
  }
  /* the visitors, facing +x, canonical 100 long */
  function streamFish(ctx, top, mid, bot, ph, finCol, h = 16) {
    const tail = Math.sin(ph) * 6;
    const g = ctx.createLinearGradient(0, -h, 0, h); g.addColorStop(0, top); g.addColorStop(.5, mid); g.addColorStop(1, bot);
    ctx.fillStyle = finCol; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-62, -22 + tail); ctx.quadraticCurveTo(-52, 0, -62, 22 + tail); ctx.closePath(); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(50, 0); ctx.bezierCurveTo(44, -h * 1.1, 0, -h * 1.15, -42, -3); ctx.lineTo(-42, 3); ctx.bezierCurveTo(0, h * 1.15, 44, h * 1.1, 50, 0); ctx.fill();
  }
  function eye(ctx, x, y, r) { ctx.fillStyle = '#0c0c12'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .35, r * .35, 0, TAU); ctx.fill(); }
  function drawVisitor(ctx, kind, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    if (kind === 'dorado') {
      streamFish(ctx, '#2a8a5a', '#a8c040', '#f0e070', ph, '#70a040', 15);
      ctx.fillStyle = '#2a8a6a'; ctx.beginPath(); ctx.moveTo(38, -14); ctx.quadraticCurveTo(0, -26, -40, -6); ctx.lineTo(-30, -4); ctx.quadraticCurveTo(0, -18, 38, -10); ctx.fill();
      ctx.fillStyle = 'rgba(40,120,200,.6)'; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(-20 + i * 5, -2 + (i % 3) * 4, 1.3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#3a8a5a'; ctx.beginPath(); ctx.moveTo(50, 0); ctx.quadraticCurveTo(50, -16, 40, -16); ctx.lineTo(40, 6); ctx.fill();
      eye(ctx, 40, -3, 2.6);
    } else if (kind === 'tuna') {
      streamFish(ctx, '#1a2a5a', '#7a8aa8', '#e8eef4', ph, '#2a3a6a', 17);
      ctx.fillStyle = '#e8c030'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-14 - i * 4, -8 + i * .6); ctx.lineTo(-16 - i * 4, -12 + i); ctx.lineTo(-18 - i * 4, -8 + i * .6); ctx.fill(); }
      ctx.fillStyle = '#2a3a6a'; ctx.beginPath(); ctx.moveTo(10, -16); ctx.lineTo(-2, -30); ctx.lineTo(-10, -14); ctx.fill();
      eye(ctx, 38, -4, 2.8);
    } else if (kind === 'shark') {
      streamFish(ctx, '#2050a8', '#3a78c8', '#e8eef4', ph, '#2a5ab0', 11);
      ctx.fillStyle = '#2a5ab0'; ctx.beginPath(); ctx.moveTo(4, -10); ctx.lineTo(-8, -28); ctx.lineTo(-16, -8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(18, 6); ctx.lineTo(-2, 30); ctx.lineTo(4, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(20,30,60,.5)'; ctx.lineWidth = .8; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(26 - i * 2.4, -5); ctx.lineTo(25 - i * 2.4, 4); ctx.stroke(); }
      eye(ctx, 40, -2, 2);
    } else if (kind === 'orca') {
      const tail = Math.sin(ph) * 5;
      ctx.fillStyle = '#121418'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-56, -4 + tail, -64, -12 + tail); ctx.lineTo(-58, tail); ctx.lineTo(-64, 12 + tail); ctx.quadraticCurveTo(-56, 4 + tail, -40, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(50, 2); ctx.bezierCurveTo(48, -16, 10, -20, -42, -4); ctx.lineTo(-42, 4); ctx.bezierCurveTo(10, 20, 46, 16, 50, 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4, -15); ctx.quadraticCurveTo(0, -40, -6, -44); ctx.quadraticCurveTo(-6, -26, -14, -13); ctx.fill();
      ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.ellipse(32, -7, 7, 3, -.1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(46, 6); ctx.quadraticCurveTo(20, 16, -6, 10); ctx.quadraticCurveTo(10, 6, 46, 4); ctx.fill();
      ctx.fillStyle = 'rgba(200,210,220,.6)'; ctx.beginPath(); ctx.ellipse(-14, -10, 9, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#121418'; ctx.beginPath(); ctx.ellipse(22, 9, 8, 3.5, .6, 0, TAU); ctx.fill();
    } else if (kind === 'sealion') {
      const flip = Math.sin(ph) * 5;
      const g = ctx.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, '#4a3a2c'); g.addColorStop(.6, '#7a5e44'); g.addColorStop(1, '#a88a68');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(52, -2); ctx.quadraticCurveTo(46, -14, 26, -15); ctx.quadraticCurveTo(-10, -17, -34, -9); ctx.quadraticCurveTo(-46, -5, -50, 0); ctx.quadraticCurveTo(-46, 7, -34, 10); ctx.quadraticCurveTo(-10, 16, 20, 14); ctx.quadraticCurveTo(44, 12, 52, 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-62, -9 + flip); ctx.lineTo(-56, 0); ctx.lineTo(-62, 9 + flip); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2c20'; ctx.beginPath(); ctx.moveTo(18, 10); ctx.quadraticCurveTo(10, 28, -8, 26 + Math.sin(ph * .7) * 4); ctx.quadraticCurveTo(4, 16, 18, 10); ctx.fill();
      eye(ctx, 40, -6, 3.6);
      ctx.fillStyle = '#2a1e16'; ctx.beginPath(); ctx.ellipse(51, 0, 2.6, 2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .6; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(48, 2 + k); ctx.lineTo(60, 2 + k * 5); ctx.stroke(); }
    } else if (kind === 'turtle') {
      const fl = Math.sin(ph) * .5;
      ctx.fillStyle = '#2a3036';
      ctx.save(); ctx.translate(14, 6); ctx.rotate(-.55 + fl * .5); ctx.beginPath(); ctx.ellipse(-22, 0, 26, 6, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.moveTo(-40, 2); ctx.lineTo(-52, 8); ctx.lineTo(-40, 8); ctx.fill();
      const g = ctx.createLinearGradient(0, -18, 0, 10); g.addColorStop(0, '#22282e'); g.addColorStop(1, '#4a525a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(34, 0); ctx.bezierCurveTo(30, -20, -20, -22, -44, 2); ctx.quadraticCurveTo(-4, 12, 34, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(180,190,200,.5)'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(30, -4 - i * 4); ctx.quadraticCurveTo(-4, -16 - i * 2, -40, 1 - i); ctx.stroke(); }
      ctx.fillStyle = '#e8eef0'; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(-30 + i * 4.4, -8 + Math.sin(i) * 4, .9, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#2a3036'; ctx.beginPath(); ctx.ellipse(42, 0, 11, 7, 0, 0, TAU); ctx.fill();
      eye(ctx, 46, -2, 1.8);
    }
    ctx.restore();
  }
  /* a boat on the top, waterline at y = 0, canonical 240 long; o.fishing adds a net drum */
  function drawBoat(ctx, o) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s); ctx.rotate(Math.sin(o.ph || 0) * .03);
    ctx.fillStyle = '#f0ece0'; ctx.strokeStyle = '#4a4a50'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-120, -14); ctx.lineTo(124, -22); ctx.lineTo(112, 14); ctx.quadraticCurveTo(0, 22, -100, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = o.fishing ? '#b8402a' : '#2a5a8a'; ctx.beginPath(); ctx.moveTo(-108, 2); ctx.lineTo(118, -4); ctx.lineTo(112, 14); ctx.quadraticCurveTo(0, 22, -100, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8e4d8'; ctx.strokeStyle = '#4a4a50'; rr(ctx, 10, -58, 70, 44, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a9ac8'; rr(ctx, 18, -52, 22, 16, 3); ctx.fill(); rr(ctx, 48, -52, 22, 16, 3); ctx.fill();
    ctx.fillStyle = '#4a4a50'; ctx.fillRect(40, -88, 3, 30); ctx.fillStyle = '#e8a020'; ctx.beginPath(); ctx.arc(42, -90, 4, 0, TAU); ctx.fill();
    if (o.fishing) { ctx.fillStyle = '#5a6a5a'; ctx.beginPath(); ctx.arc(-70, -26, 14, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a3a2a'; ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(-70, -26, 4 + k * 1.8, 0, TAU); ctx.stroke(); }
      /* two fishers in orange, one leaning over the side */
      for (const [x, lean] of [[-30, .5], [-6, 0]]) { ctx.save(); ctx.translate(x, -14); ctx.rotate(lean); ctx.fillStyle = '#f08020'; rr(ctx, -6, -30, 12, 30, 4); ctx.fill(); ctx.fillStyle = '#e8c0a0'; ctx.beginPath(); ctx.arc(0, -36, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#f0c020'; ctx.beginPath(); ctx.arc(0, -39, 6.5, Math.PI, TAU); ctx.fill(); ctx.restore(); } }
    ctx.restore();
  }
  /* the cleaner fish, canonical 30 long: the señorita (slim, yellow-orange, a black spot by the tail) and the halfmoon (deep, blue-grey) */
  function drawCleaner(ctx, kind, o) {
    const s = o.s || 1, w = Math.sin(o.ph || 0) * 2;
    ctx.save(); ctx.scale(s, s);
    if (kind === 'senorita') {
      ctx.fillStyle = '#f0b830'; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-17, -4 + w); ctx.lineTo(-17, 4 + w); ctx.closePath(); ctx.fill();
      const g = ctx.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, '#e89a20'); g.addColorStop(.5, '#f8d040'); g.addColorStop(1, '#f8ecc0');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 14, 3.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a1414'; ctx.beginPath(); ctx.arc(-10.5, 0, 2, 0, TAU); ctx.fill();
      eye(ctx, 10, -.8, 1.1);
    } else {
      ctx.fillStyle = '#4a6a8a'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-18, -9 + w, -20, -8 + w); ctx.quadraticCurveTo(-16, 0, -20, 8 + w); ctx.quadraticCurveTo(-18, 9 + w, -10, 0); ctx.fill();
      const g = ctx.createLinearGradient(0, -9, 0, 9); g.addColorStop(0, '#3a5878'); g.addColorStop(1, '#8aa8c0');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(30,50,70,.6)'; ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(6, -8); ctx.lineTo(-8, -10); ctx.fill();
      eye(ctx, 8, -2, 1.5);
    }
    ctx.restore();
  }
  /* giant kelp, in world units: a stipe from its holdfast on the rock up to a canopy at the top,
     with a blade and a little gas float every few units */
  function drawKelp(ctx, k, t, far) {
    const top = k.root - k.h, R = mulberry32(k.seed), n = Math.max(4, Math.floor(k.h / 16));
    const sway = (u) => Math.sin(t * .6 + k.ph + u * 3) * 10 * u + Math.sin(t * 1.1 + k.ph * 2) * 4 * u;
    ctx.strokeStyle = far ? 'rgba(70,90,40,.6)' : '#6a5a22'; ctx.lineWidth = far ? 1.6 : 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); for (let i = 0; i <= n; i++) { const u = i / n, x = k.x + sway(u), y = lerp(k.root, top, u); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    for (let i = 1; i <= n; i++) {
      const u = i / n, x = k.x + sway(u), y = lerp(k.root, top, u), side = i % 2 ? 1 : -1, L = 16 + R() * 10, a = side * (.9 + Math.sin(t + i + k.ph) * .25) - Math.PI / 2;
      ctx.fillStyle = far ? 'rgba(110,110,40,.55)' : (i % 3 ? '#8a7a2a' : '#a08a32');
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-k.w * 1.3, -L * .5, 0, -L); ctx.quadraticCurveTo(k.w * 1.3, -L * .5, 0, 0); ctx.fill();
      ctx.fillStyle = far ? 'rgba(150,140,60,.5)' : '#b8a040'; ctx.beginPath(); ctx.ellipse(0, -2, 1.8, 2.6, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    /* the canopy floating at the top */
    if (!far) { ctx.fillStyle = 'rgba(140,120,40,.85)'; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(k.x + sway(1) + (j - 2) * 9 + Math.sin(t + j) * 2, top + 2, 8, 2.4, Math.sin(j) * .2, 0, TAU); ctx.fill(); } }
    else { ctx.fillStyle = 'rgba(120,120,50,.4)'; ctx.beginPath(); ctx.ellipse(k.x + sway(1), top + 2, 20, 3, 0, 0, TAU); ctx.fill(); }
  }
  /* ---------- icons: a 100-unit square centred on 0 ---------- */
  const WATERY = ['egg', 'eggs', 'larva', 'starlarva', 'star', 'plankton', 'copepod', 'krill', 'jelly', 'salp', 'comb', 'nettle', 'lice', 'anchovy', 'cleaner', 'juvenile', 'school', 'dorado', 'tuna', 'sealion', 'orca', 'shark', 'turtle', 'mola', 'sunfish', 'giant', 'boy', 'girl', 'spawn', 'cloud', 'fin', 'clean'];
  const icMola = (ctx, form, o = {}) => drawSunfish(ctx, Object.assign({ s: .78, form, stage: 'mola', flap: .9, seed: 3 }, o));
  function drawIcon(ctx, key, px, form) {
    form = form || 'normal';
    if (WATERY.includes(key)) {
      const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 48); g.addColorStop(0, '#9fdcf6'); g.addColorStop(1, '#2a78b8');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.clip();
    } else ctx.save();
    switch (key) {
      case 'egg': drawEgg(ctx, { s: 3.2, eye: true }); break;
      case 'eggs': for (const [x, y] of [[-14, -10], [10, -16], [0, 6], [-22, 14], [20, 10], [-4, 26], [26, -2], [-28, -6]]) { ctx.save(); ctx.translate(x, y); drawEgg(ctx, { s: .8, eye: true }); ctx.restore(); } break;
      case 'larva': drawSunfish(ctx, { s: .62, stage: 'larva', flap: .5 }); break;
      case 'starlarva': case 'star': drawSunfish(ctx, { s: .62, stage: 'star', flap: .5 }); break;
      case 'juvenile': case 'school': if (key === 'school') { for (const [x, y, s] of [[-18, -16, .3], [16, -20, .26], [-20, 20, .26]]) { ctx.save(); ctx.translate(x, y); drawSunfish(ctx, { s, form, stage: 'juvenile', flap: x, spiky: .3 }); ctx.restore(); } ctx.translate(12, 12); drawSunfish(ctx, { s: .34, form, stage: 'juvenile', flap: 1, spiky: .3 }); } else drawSunfish(ctx, { s: .62, form, stage: 'juvenile', flap: .9, spiky: .35 }); break;
      case 'mola': case 'sunfish': case 'boy': icMola(ctx, form, { s: .6 }); break;
      case 'giant': icMola(ctx, form, { s: .64, spots: .3 }); ctx.fillStyle = '#ffd23f'; ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 30, -26); break;
      case 'girl': icMola(ctx, form, { s: .58 }); for (const [x, y] of [[-34, 26], [-26, 32], [-38, 34]]) { ctx.save(); ctx.translate(x, y); drawEgg(ctx, { s: .45 }); ctx.restore(); } break;
      case 'spawn': case 'heart': icMola(ctx, form, { s: .5 }); ctx.fillStyle = '#ff6a98'; ctx.font = '900 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', 26, -18); ctx.fillText('♥', -30, -28); break;
      case 'fin': ctx.translate(0, 18); icMola(ctx, form, { s: .9, flap: 0 }); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-50, -30, 100, 3); break;
      case 'clean': case 'cleaner': icMola(ctx, form, { s: .5, spots: .4 }); for (const [x, y, k, a] of [[-24, -20, 'senorita', .3], [20, 16, 'halfmoon', -.2], [-6, 26, 'senorita', 0], [26, -22, 'senorita', 3.4]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); drawCleaner(ctx, k, { s: .9 }); ctx.restore(); } break;
      case 'lice': ctx.save(); ctx.scale(10, 10); ctx.fillStyle = 'rgba(90,64,48,.95)'; ctx.beginPath(); ctx.ellipse(0, 0, 2.4, 1.6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(90,64,48,.95)'; ctx.lineWidth = .25; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * .8, 1); ctx.lineTo(i * 1.4, 2.4); ctx.moveTo(i * .8, -1); ctx.lineTo(i * 1.4, -2.4); ctx.stroke(); } ctx.fillStyle = '#e8d0b0'; ctx.beginPath(); ctx.arc(1.2, -.3, .4, 0, TAU); ctx.fill(); ctx.restore(); break;
      case 'plankton': for (const q of [{ x: -16, y: -10, kind: 'copepod', rot: 0, vx: 1, vy: -.3 }, { x: 14, y: -14, kind: 'krill', rot: .4 }, { x: 0, y: 14, kind: 'copepod', rot: 0, vx: 1, vy: .3 }, { x: -18, y: 18, kind: 'dino', rot: 0, glow: 0 }]) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(6, 6); drawPlankton(ctx, Object.assign({}, q, { x: 0, y: 0, ph: 0 }), 0, 0); ctx.restore(); } break;
      case 'copepod': ctx.scale(16, 16); drawPlankton(ctx, { x: 0, y: 0, kind: 'copepod', rot: 0, vx: 1, vy: -.4, ph: 0 }, 0, 0); break;
      case 'krill': ctx.scale(14, 14); drawPlankton(ctx, { x: 0, y: 0, kind: 'krill', rot: 0, vx: 1, vy: 0, ph: 0 }, 0, 0); break;
      case 'jelly': ctx.translate(0, -8); drawFood(ctx, { kind: 'moon', r: 30, ph: 0, rot: 0 }, .5); break;
      case 'nettle': ctx.translate(0, -18); drawFood(ctx, { kind: 'nettle', r: 30, ph: 0, rot: 0 }, .5); break;
      case 'comb': drawCombJelly(ctx, { x: 0, y: -4, r: 24, ph: 1.2 }, 1); break;
      case 'salp': drawFood(ctx, { kind: 'salp', r: 30, ph: 0, rot: .1 }, 0); break;
      case 'anchovy': for (const [x, y] of [[-14, -14], [12, -4], [-10, 16], [18, 20]]) { ctx.save(); ctx.translate(x, y); drawFish(ctx, { s: .9, col: '#c8d8e8', col2: '#3a5a7a' }); ctx.restore(); } break;
      case 'gull': ctx.translate(0, 4); drawGull(ctx, { s: .42, ph: 1 }); break;
      case 'gullstand': ctx.translate(0, 34); drawGullStand(ctx, { s: 1.6, ph: .3 }); break;
      case 'dorado': case 'tuna': case 'shark': case 'turtle': drawVisitor(ctx, key, { s: .8, ph: 1 }); break;
      case 'sealion': drawVisitor(ctx, 'sealion', { s: .78, ph: 1 }); break;
      case 'orca': drawVisitor(ctx, 'orca', { s: .72, ph: 1 }); break;
      case 'boat': { ctx.fillStyle = '#5aa8e0'; ctx.fillRect(-46, 10, 92, 36); ctx.translate(0, 12); drawBoat(ctx, { s: .36 }); break; }
      case 'net': { ctx.fillStyle = '#3a8ac0'; ctx.fillRect(-46, -46, 92, 92); ctx.strokeStyle = 'rgba(240,240,220,.85)'; ctx.lineWidth = 1.4; for (let i = -40; i <= 40; i += 10) { ctx.beginPath(); ctx.moveTo(i, -34); ctx.lineTo(i + 8, 44); ctx.stroke(); } for (let j = -34; j <= 44; j += 10) { ctx.beginPath(); ctx.moveTo(-46, j); ctx.lineTo(46, j + 2); ctx.stroke(); } ctx.fillStyle = '#f0a020'; for (let i = -36; i <= 36; i += 18) { ctx.beginPath(); ctx.ellipse(i, -36, 6, 4, 0, 0, TAU); ctx.fill(); } break; }
      case 'kelp': { ctx.fillStyle = '#2a6a9a'; ctx.fillRect(-46, -46, 92, 92); for (const [x, h] of [[-22, 90], [4, 100], [28, 84]]) drawKelp(ctx, { x, root: 48, h, ph: x, seed: x + 50, w: 3 }, 0); break; }
      case 'rock': { ctx.fillStyle = '#7a7468'; ctx.beginPath(); ctx.ellipse(0, 14, 40, 26, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#9a9488'; ctx.beginPath(); ctx.ellipse(-8, 2, 20, 10, 0, 0, TAU); ctx.fill(); break; }
      case 'cloud': ctx.fillStyle = 'rgba(250,250,240,.9)'; for (const [x, y, r] of [[-10, 0, 18], [10, -6, 20], [18, 8, 14], [-20, 10, 12]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } break;
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'moon': {
        ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,190,140,.6)'; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        break;
      }
      case 'sea': case 'water': {
        ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 0); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 2); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a6ab0'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 14); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, 14 + Math.sin(x * .12 + 2) * 6); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -40; x <= 40; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 4); ctx.stroke();
        break;
      }
      case 'deep': { const g = ctx.createLinearGradient(0, -46, 0, 46); g.addColorStop(0, '#2a7ac0'); g.addColorStop(1, '#030c1c'); ctx.fillStyle = g; ctx.fillRect(-46, -46, 92, 92); ctx.save(); ctx.translate(10, 16); drawFood(ctx, { kind: 'moon', r: 14, ph: 0, rot: 0 }, .5); ctx.restore(); ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-30, 30); ctx.lineTo(-42, 10); ctx.lineTo(-34, 10); ctx.lineTo(-34, -30); ctx.lineTo(-26, -30); ctx.lineTo(-26, 10); ctx.lineTo(-18, 10); ctx.closePath(); ctx.fill(); break; }
      case 'scope': ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(-6, 10); ctx.lineTo(14, 30); ctx.moveTo(-26, 30); ctx.lineTo(22, 30); ctx.stroke(); break;
      default: icMola(ctx, form, { s: .6 });
    }
    ctx.restore();
  }
  function icon(key, px, form) {
    form = form || (typeof window !== 'undefined' && window.G && window.G.form) || 'normal';
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

  return { clavusPath, drawSunfish, drawEgg, drawPlankton, drawFish, drawCombJelly, drawGull, drawGullStand, drawFood, drawMoonJelly, drawNettle, drawSalp, drawVisitor, drawBoat, drawCleaner, drawKelp, drawIcon, icon, molaCols, bodyPath };
})();
