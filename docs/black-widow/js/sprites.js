/* ============================================================
   sprites.js — the spider, her silk parcels, the bugs
   ============================================================
   The spider is drawn from above, head toward +x, so she reads
   the same on the ground, on a wall, under a roof and on a thread.
   A widow hangs belly-up in her web, so on a thread a grown female
   shows the red hourglass (o.belly); on a surface you see her
   glossy back.  All drawn in code; icons are in sprites2.js.
     look by instar   0 pale · 1-2 striped white, orange and tan ·
                      3-4 (she) dark with fading stripes ·
                      grown she: glossy black, red hourglass
                      grown he: small, striped, long legs, big palps
   ============================================================ */
'use strict';

const Sprites = (function () {
  /* the colours of a spider: o = { form, instar, adult } */
  function look(o) {
    const male = o.form === 'boy', i = o.instar || 0;
    if (o.adult && !male) return { body: '#0d0b0c', head: '#17110f', leg: '#120e0e', leg2: '#2a1c18', stripe: null, spot: '#e0241c', gloss: .9, k: 'black' };
    if (o.adult && male) return { body: '#8a6a44', head: '#5a3e28', leg: '#6a4a30', leg2: '#d8c098', stripe: '#f6efdc', spot: '#e8742a', gloss: .25, k: 'boy' };
    if (i === 0) return { body: '#e9dcc0', head: '#d9c39a', leg: '#cdb894', leg2: '#efe6d0', stripe: null, spot: null, gloss: .2, k: 'pale' };
    if (i <= 2) return { body: i === 1 ? '#c9a66a' : '#a8804c', head: '#7a5632', leg: '#8a6a44', leg2: '#e6d4ae', stripe: '#fbf6e8', spot: '#f0802c', gloss: .25, k: 'striped' };
    return { body: i === 3 ? '#4a3426' : '#2a1d18', head: '#2e2018', leg: '#33241c', leg2: '#6a5038', stripe: i === 3 ? 'rgba(250,244,228,.8)' : 'rgba(250,244,228,.4)', spot: '#e8402a', gloss: .5, k: 'dark' };
  }
  /* one leg: hip (on the head part) to knee to foot; s = side (+1 right of travel = +y), k = which of four */
  function leg(ctx, L, r, k, s, ph, o) {
    const male = o.adult && o.form === 'boy', len = r * (male ? 3.1 : 2.5) * [1.15, .95, .85, 1.1][k] * (o.curl ? .4 : 1);
    const gait = o.moving ? Math.sin(ph + (k % 2 ? Math.PI : 0) + (s > 0 ? 0 : Math.PI)) * .2 : Math.sin(ph * .2 + k) * .03;
    /* the angle out from straight ahead: the first pair reaches forward, the last pair back */
    const a = [.62, 1.2, 1.9, 2.5][k] + gait + (o.spread ? (k < 2 ? -.25 : .25) : 0), hx = r * (.5 - k * .13), hy = s * r * .26;
    const kx = hx + Math.cos(a) * len * .46, ky = hy + s * Math.sin(a) * len * .46;
    const a2 = o.curl ? a + 2.3 : a + (k < 2 ? -.55 : .55), fx = kx + Math.cos(a2) * len * .54, fy = ky + s * Math.sin(a2) * len * .54;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = L.leg; ctx.lineWidth = Math.max(.7, r * (male ? .11 : .15));
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    if (L.k !== 'black') { ctx.strokeStyle = L.leg2; ctx.lineWidth = Math.max(.5, r * (male ? .085 : .11)); ctx.beginPath(); ctx.moveTo(lerp(hx, kx, .45), lerp(hy, ky, .45)); ctx.lineTo(lerp(hx, kx, .8), lerp(hy, ky, .8)); ctx.moveTo(lerp(kx, fx, .3), lerp(ky, fy, .3)); ctx.lineTo(lerp(kx, fx, .65), lerp(ky, fy, .65)); ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = Math.max(.4, r * .04); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke(); }
  }
  /* the red hourglass, seen on her belly */
  function hourglass(ctx, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-r * .46, -r * .3); ctx.lineTo(-r * .46, r * .3); ctx.lineTo(0, r * .07); ctx.lineTo(r * .46, r * .3); ctx.lineTo(r * .46, -r * .3); ctx.lineTo(0, -r * .07); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,190,150,.5)'; ctx.beginPath(); ctx.ellipse(-r * .28, -r * .08, r * .1, r * .06, 0, 0, TAU); ctx.fill();
  }
  /* o: { r, form, instar, adult, ph, moving, curl, belly, spread, soft (0..1 just moulted) } — centred, head toward +x */
  function drawSpider(ctx, o) {
    const r = o.r || 8, L = look(o), male = o.adult && o.form === 'boy', ph = o.ph || 0;
    const ar = r * (male ? .72 : 1), al = ar * (male ? 1.45 : 1.12), ax = -r * (male ? .75 : .62);
    ctx.save();
    if (o.soft) ctx.globalAlpha = 1 - o.soft * .25;
    for (const s of [1, -1]) for (let k = 0; k < 4; k++) leg(ctx, L, r, k, s, ph, o);
    /* the head part, with palps (a grown boy has big ones, like boxing gloves) */
    ctx.fillStyle = L.head; ctx.beginPath(); ctx.ellipse(r * .32, 0, r * .52, r * .42, 0, 0, TAU); ctx.fill();
    for (const s of [1, -1]) { ctx.beginPath(); ctx.ellipse(r * (.86 + (male ? .12 : 0)), s * r * .17, r * (male ? .2 : .11), r * (male ? .15 : .07), s * .4, 0, TAU); ctx.fill(); }
    if (L.k !== 'black') { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(r * .36, 0, r * .12, r * .3, 0, 0, TAU); ctx.fill(); }
    /* the abdomen */
    const g = ctx.createRadialGradient(ax + al * .25, -ar * .35, ar * .1, ax, 0, al * 1.05);
    g.addColorStop(0, mixHex(L.body, '#ffffff', L.k === 'black' ? .16 : .22)); g.addColorStop(.5, L.body); g.addColorStop(1, mixHex(L.body, '#000000', .45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ax, 0, al, ar, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(ax, 0, al, ar, 0, 0, TAU); ctx.clip();
    if (o.belly && L.k === 'black') { ctx.translate(ax + al * .05, 0); hourglass(ctx, ar * .78, L.spot); }
    else {
      if (L.stripe) { ctx.strokeStyle = L.stripe; ctx.lineWidth = ar * .17; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) for (const s of [1, -1]) { const x0 = ax + al * (.55 - k * .5); ctx.beginPath(); ctx.moveTo(x0, s * ar * .22); ctx.lineTo(x0 - al * .34, s * ar * .95); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(ax + al * .75, 0); ctx.lineTo(ax - al * .9, 0); ctx.lineWidth = ar * .2; ctx.stroke(); }
      if (L.spot && L.k !== 'black') { ctx.fillStyle = L.spot; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(ax + al * (.52 - k * .38), 0, ar * .14, ar * .1, 0, 0, TAU); ctx.fill(); } }
      if (L.k === 'black') { ctx.fillStyle = L.spot; ctx.beginPath(); ctx.ellipse(ax - al * .82, 0, ar * .1, ar * .13, 0, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    /* the shine */
    ctx.fillStyle = `rgba(255,255,255,${.5 * L.gloss})`; ctx.beginPath(); ctx.ellipse(ax + al * .3, -ar * .42, al * .3, ar * .16, -.25, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${.75 * L.gloss})`; ctx.beginPath(); ctx.ellipse(ax + al * .42, -ar * .48, al * .09, ar * .06, -.25, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* a shed skin: pale, empty, legs together */
  function drawExuvia(ctx, r) {
    ctx.save(); ctx.globalAlpha = .7; ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = Math.max(.6, r * .1); ctx.lineCap = 'round';
    for (const s of [1, -1]) for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(s * r * .2, -r * .2 + k * r * .12); ctx.quadraticCurveTo(s * r * (.7 + k * .08), r * .2, s * r * (.3 + k * .12), r * 1.1); ctx.stroke(); }
    ctx.fillStyle = 'rgba(236,226,200,.75)'; ctx.beginPath(); ctx.ellipse(0, -r * .5, r * .5, r * .6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(150,130,100,.6)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, -r * .1); ctx.stroke();
    ctx.restore();
  }
  /* the egg sac: round, papery, the colour of cream; o.crack 0..1 as the spiderlings open it */
  function drawSac(ctx, r, o = {}) {
    const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r * 1.1);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(.6, '#ecdcb8'); g.addColorStop(1, '#b89a6a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(.4, r * .04);
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(0, 0, r * .96, r * (.2 + k * .17), k * .7 + (o.turn || 0), 0, TAU); ctx.stroke(); }
    if (o.crack > 0) { ctx.fillStyle = 'rgba(60,40,20,.7)'; ctx.beginPath(); ctx.ellipse(r * .35, -r * .5, r * .3 * o.crack, r * .2 * o.crack, .5, 0, TAU); ctx.fill(); }
  }
  /* a bug wrapped in silk: w = how wrapped (0..1) */
  function drawParcel(ctx, r, w, turn = 0) {
    ctx.fillStyle = `rgba(240,244,250,${.35 + w * .6})`; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * .8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${.4 + w * .5})`; ctx.lineWidth = Math.max(.5, r * .09);
    for (let k = 0; k < 2 + Math.round(w * 5); k++) { ctx.beginPath(); ctx.ellipse(0, 0, r * 1.12, r * (.15 + (k % 4) * .18), turn + k * .9, 0, TAU); ctx.stroke(); }
  }
  return { look, drawSpider, drawExuvia, drawSac, drawParcel, hourglass };
})();
