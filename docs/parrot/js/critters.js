/* ============================================================
   critters.js — everyone who is not a parrot
   ============================================================
   The people (the family child figure), the toucan, the
   hawk-eagle, the bees, the scientist on a rope, the river boat.
   All drawn in code, in both looks.
   ============================================================ */
'use strict';

const Critters = (function () {
  const bean = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
  const shade = (ctx, y0, y1, a, b) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };

  /* a person; o: { h height, pose: stand|walk|look|wave, t, dir } */
  const SHIRTS = { 6: '#e8503a', 7: '#f2a33a', 8: '#3a9ad9', 9: '#4fb06a', 10: '#8a5ac8', 11: '#2f7f8f', 12: '#46506a' };
  function child(ctx, age, o = {}) {
    const a = clamp(age, 5, 22), k = clamp((a - 6) / 8, 0, 1), H = (o.h || 100) * lerp(.58, 1, k), pose = o.pose || 'stand', t = o.t || 0;
    const shirt = SHIRTS[Math.round(clamp(a, 6, 12))], hair = '#5a3820', skin = '#f0c8a0', legs = a > 10 ? '#34405a' : '#3f5f9a';
    const head = H * lerp(.17, .125, k), body = H * .34, leg = H * .42, wk = pose === 'walk' ? Math.sin(t * 8) : 0;
    ctx.save(); ctx.scale(o.dir || 1, 1); ctx.lineCap = 'round';
    const sit = pose === 'sit' || pose === 'guitar';
    /* legs */
    ctx.strokeStyle = legs; ctx.lineWidth = H * .075;
    if (sit) { ctx.beginPath(); ctx.moveTo(0, -H * .12); ctx.lineTo(H * .24, -H * .12); ctx.lineTo(H * .26, 0); ctx.stroke(); }
    else for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(0, -leg); ctx.lineTo(s * wk * H * .13, -leg * .5); ctx.lineTo(s * wk * H * .2, 0); ctx.stroke(); }
    ctx.fillStyle = '#e8e2d2'; if (!sit) for (const s of [1, -1]) bean(ctx, s * wk * H * .2 + H * .03, -H * .02, H * .06, H * .025);
    const hip = sit ? -H * .12 : -leg, top = hip - body;
    /* body */
    ctx.fillStyle = shade(ctx, top, hip, mixHex(shirt, '#ffffff', .15), mixHex(shirt, '#000000', .2));
    rr(ctx, -H * .085, top, H * .17, body + H * .02, H * .05); ctx.fill();
    /* the arm */
    ctx.strokeStyle = shirt; ctx.lineWidth = H * .06; ctx.beginPath(); ctx.moveTo(0, top + H * .04);
    if (pose === 'carry' || pose === 'look') { ctx.lineTo(H * .13, top + H * .15); ctx.lineTo(H * .24, top + H * (pose === 'carry' ? .1 : .25)); }
    else if (pose === 'guitar') { ctx.lineTo(H * .12, top + H * .16); ctx.lineTo(H * .2, top + H * .2 + Math.sin(t * 9) * H * .012); }
    else if (pose === 'wave') { ctx.lineTo(H * .12, top - H * .02); ctx.lineTo(H * (.17 + Math.sin(t * 6) * .04), top - H * .13); }
    else { ctx.lineTo(-wk * H * .1, top + H * .15); ctx.lineTo(-wk * H * .14, top + H * .27); } ctx.stroke();
    ctx.fillStyle = skin; const hand = pose === 'carry' ? [H * .25, top + H * .09] : null; if (hand) { bean(ctx, hand[0], hand[1], H * .03, H * .03); ctx.fillStyle = '#5f9a3a'; bean(ctx, hand[0] + H * .05, hand[1] + H * .005, H * .1, H * .022, -.1); }
    /* the head: hair, face, an eye and a smile */
    const hy = top - head * .9 - (pose === 'look' ? 0 : 0);
    ctx.save(); ctx.translate(0, hy); if (pose === 'look') ctx.rotate(.28);
    ctx.fillStyle = skin; bean(ctx, 0, 0, head, head * 1.05);
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(-head * .08, -head * .12, head * 1.04, Math.PI * .92, Math.PI * 2.08); ctx.fill(); if (a < 9) bean(ctx, -head * .9, head * .1, head * .3, head * .5);
    ctx.fillStyle = '#2a1a10'; bean(ctx, head * .5, -head * .05, head * .11, head * .15);
    ctx.strokeStyle = '#a0583a'; ctx.lineWidth = head * .09; ctx.beginPath(); ctx.arc(head * .4, head * .3, head * .28, .1, 1.4); ctx.stroke();
    ctx.fillStyle = 'rgba(240,120,110,.35)'; bean(ctx, head * .3, head * .32, head * .2, head * .13);
    ctx.restore();
    if (pose === 'guitar') { ctx.save(); ctx.translate(H * .13, top + H * .2); ctx.rotate(-.35); ctx.fillStyle = '#b5702e'; bean(ctx, 0, 0, H * .11, H * .085); ctx.fillStyle = '#2a180c'; bean(ctx, 0, 0, H * .03, H * .03); ctx.fillStyle = '#6a3e1a'; ctx.fillRect(H * .08, -H * .012, H * .24, H * .024); ctx.restore(); }
    ctx.restore();
  }
  /* a grown-up: the same figure, taller, with a torch in the hand that looks */
  function grownup(ctx, o = {}) { child(ctx, 22, Object.assign({ h: 150 }, o)); }
  /* the torch's light: a soft cone from (0,0) toward the angle a */
  function beam(ctx, a, len, alpha = .2) {
    ctx.save(); ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, len, 0); g.addColorStop(0, `rgba(255,240,180,${alpha * 1.6})`); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(len, -len * .2); ctx.lineTo(len, len * .2); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /* a white-throated toucan, sitting, facing right; feet at (0, 0) */
  function toucan(ctx, s, t = 0) {
    ctx.save(); ctx.scale(s, s); ctx.lineJoin = 'round';
    const nod = Math.sin(t * 2.2) * .12;
    ctx.fillStyle = '#16161c'; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-30, 16); ctx.lineTo(-22, 18); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5a7a9a'; ctx.lineWidth = 2.4; for (const x of [-3, 4]) { ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x, 0); ctx.moveTo(x - 3, 0); ctx.lineTo(x + 3, 0); ctx.stroke(); }
    ctx.fillStyle = '#16161c'; bean(ctx, -2, -20, 12, 17, .3);
    ctx.fillStyle = '#d8201f'; bean(ctx, -9, -5, 5, 3, .5);
    ctx.save(); ctx.translate(5, -34); ctx.rotate(nod);
    ctx.fillStyle = '#16161c'; bean(ctx, 0, 0, 10, 10);
    ctx.fillStyle = '#fbfbf4'; ctx.beginPath(); ctx.ellipse(3, 6, 9, 9, 0, -.5, 2.4); ctx.fill();
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(2, 13, 8, 2.4, .1, 0, TAU); ctx.fill();
    /* the great beak */
    ctx.fillStyle = '#1c1c22'; ctx.beginPath(); ctx.moveTo(7, -7); ctx.bezierCurveTo(26, -13, 46, -8, 52, 6); ctx.bezierCurveTo(40, 6, 22, 6, 8, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(7, -7); ctx.bezierCurveTo(26, -13, 44, -9, 50, 2); ctx.bezierCurveTo(38, -5, 22, -5, 8, -3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5aa8e8'; ctx.beginPath(); ctx.ellipse(8, -1, 3, 6.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7ac0ff'; bean(ctx, 2, -3, 4.4, 4.4); ctx.fillStyle = '#16161c'; bean(ctx, 2.6, -3, 2, 2); ctx.fillStyle = '#fff'; bean(ctx, 3.3, -3.8, .7, .7);
    ctx.restore(); ctx.restore();
  }
  /* an ornate hawk-eagle, gliding, facing right; centre at (0, 0) */
  function eagle(ctx, s, t = 0) {
    ctx.save(); ctx.scale(s, s); ctx.lineJoin = 'round';
    const a = Math.sin(t * 2.4) * .18;
    const wing = (k) => {
      ctx.fillStyle = shadeCol('#4a3a2a', k); ctx.beginPath(); ctx.moveTo(10, -2); ctx.quadraticCurveTo(-4, -30 - a * 40, -44, -34 - a * 60);
      for (let i = 0; i < 5; i++) ctx.lineTo(-44 + i * 6, -24 - a * 50 + i * 4 + (i % 2 ? 5 : 0));
      ctx.quadraticCurveTo(-18, -6, -12, 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(250,240,220,.5)'; ctx.lineWidth = 1.2; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(4 - i * 4, -4 - i * 2); ctx.lineTo(-10 - i * 7, -14 - a * 30 - i * 3); ctx.stroke(); }
    };
    ctx.save(); ctx.translate(2, -2); wing(.7); ctx.restore();
    ctx.fillStyle = '#3a2e22'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-40, -4); ctx.lineTo(-40, 8); ctx.lineTo(-12, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2; for (const x of [-22, -30, -37]) { ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x, 7); ctx.stroke(); }
    ctx.fillStyle = '#f4ecd8'; bean(ctx, 0, 2, 18, 8);
    ctx.strokeStyle = '#3a2e22'; ctx.lineWidth = 1.3; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 4, 4); ctx.lineTo(-8 + i * 4, 8); ctx.stroke(); }
    ctx.fillStyle = '#b8642a'; bean(ctx, 14, -3, 8, 7); ctx.fillStyle = '#f4ecd8'; bean(ctx, 17, 0, 5, 4);
    ctx.fillStyle = '#1c1612'; ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(2, -22); ctx.lineTo(8, -20); ctx.lineTo(14, -9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(20, -4); ctx.quadraticCurveTo(29, -3, 27, 4); ctx.lineTo(21, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb000'; bean(ctx, 16.5, -4, 2, 2); ctx.fillStyle = '#1c1612'; bean(ctx, 17, -4, 1, 1);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, 9); ctx.lineTo(-6, 15); ctx.moveTo(4, 9); ctx.lineTo(1, 15); ctx.stroke();
    wing(1);
    ctx.restore();
  }
  const shadeCol = (hex, k) => mixHex(hex, '#000000', 1 - k);
  /* bees round a hole */
  function bees(ctx, t, n = 7, R = 26) {
    for (let k = 0; k < n; k++) {
      const a = t * (2 + k * .37) + k * 2.1, r = R * (.4 + .6 * Math.abs(Math.sin(t * .7 + k))), x = Math.cos(a) * r, y = Math.sin(a * 1.3) * r * .7;
      ctx.fillStyle = 'rgba(255,255,255,.6)'; bean(ctx, x - 1, y - 2.4, 2.4, 1.3, .4);
      ctx.fillStyle = '#f2b81a'; bean(ctx, x, y, 2.8, 2); ctx.fillStyle = '#2a2016'; ctx.fillRect(x - .6, y - 2, 1.2, 4);
    }
  }
  /* the scientist on a rope: the rope runs up from (0, 0) */
  function climber(ctx, t, look) {
    ctx.strokeStyle = '#e0cf90'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -1400); ctx.lineTo(0, 10); ctx.stroke();
    ctx.save(); ctx.translate(4, 62); ctx.rotate(Math.sin(t * 1.3) * .03);
    child(ctx, 22, { h: 132, pose: look ? 'look' : 'stand', dir: -1, t });
    ctx.restore();
    ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(1, -52, 12, 9, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(-13, -53, 26, 3);
    ctx.strokeStyle = '#e8503a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-8, -16); ctx.lineTo(8, -16); ctx.moveTo(0, -30); ctx.lineTo(0, -8); ctx.stroke();
  }
  /* a long river boat with a child, a grown-up and a pair of binoculars; the waterline is y = 0 */
  function boat(ctx, t, look) {
    ctx.save(); ctx.translate(0, Math.sin(t * 1.6) * 1.5);
    ctx.save(); ctx.translate(-34, -6); child(ctx, 22, { h: 96, pose: 'sit', dir: 1, t }); ctx.restore();
    ctx.save(); ctx.translate(18, -6); child(ctx, 8, { h: 80, pose: look ? 'wave' : 'sit', dir: 1, t }); ctx.restore();
    ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.moveTo(-96, -16); ctx.lineTo(96, -16); ctx.quadraticCurveTo(84, 6, 60, 8); ctx.lineTo(-70, 8); ctx.quadraticCurveTo(-90, 6, -96, -16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a4218'; ctx.fillRect(-92, -18, 186, 5);
    ctx.fillStyle = '#3f8a5a'; ctx.fillRect(-60, -64, 96, 5); ctx.fillStyle = '#5a4020'; ctx.fillRect(-58, -62, 3, 46); ctx.fillRect(32, -62, 3, 46);
    ctx.restore();
  }
  function icon(ctx, key) {
    if (key === 'toucan') { ctx.translate(-14, 30); toucan(ctx, 1.3, 0); return true; }
    if (key === 'eagle') { ctx.translate(6, 12); eagle(ctx, 1.2, .6); return true; }
    if (key === 'bee' || key === 'bees') { ctx.scale(3, 3); bees(ctx, 2.2, 5, 12); return true; }
    if (key === 'boat') { ctx.translate(0, 26); ctx.scale(.44, .44); boat(ctx, 0, true); return true; }
    if (key === 'kid') { ctx.translate(0, 40); child(ctx, 8, { h: 84, pose: 'wave' }); return true; }
    return false;
  }
  return { child, grownup, beam, toucan, eagle, bees, climber, boat, icon, bean, shade };
})();
