/* ============================================================
   critters.js — everyone else in the yard
   ============================================================
   Drawn the same in both looks (the WebGL look lights them).
   The child and the grown-up with the torch · the blue mud
   dauber, the alligator lizard, the cactus wren, the mantis · the
   broom · moths at the porch light.  Everything is side view; a
   thing's feet are at y = 0 unless it says otherwise.
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
  /* the blue mud dauber: a thin metallic blue wasp, smoky wings, a thread of a waist */
  function dauber(ctx, s, dir, ph) {
    ctx.save(); ctx.scale(s * dir, s); const f = Math.sin(ph * 40);
    ctx.fillStyle = 'rgba(60,70,110,.35)'; bean(ctx, -6, -9 - f * 3, 14, 4, -.5); bean(ctx, 0, -8 + f * 3, 12, 3.5, -.2);
    ctx.strokeStyle = '#141c3a'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(2 + k * 3, 3); ctx.lineTo(k * 4 - 2, 13 + k); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#4a6ae0'); g.addColorStop(.5, '#1a2a8a'); g.addColorStop(1, '#0a1040');
    ctx.fillStyle = g; bean(ctx, -17, 2, 8, 4.4, .25); bean(ctx, 4, 0, 7, 4.6); bean(ctx, 13, -2, 4, 3.8);
    ctx.strokeStyle = '#1a2a8a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-10, 1.5); ctx.lineTo(-2, .5); ctx.stroke();
    ctx.strokeStyle = '#0a1040'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(15, -4); ctx.quadraticCurveTo(20, -10, 24, -8); ctx.stroke();
    ctx.fillStyle = 'rgba(190,210,255,.7)'; bean(ctx, 3, -2, 3, 1.2);
    ctx.restore();
  }
  /* the alligator lizard: long, low, brown with dark bars, a long tail */
  function lizard(ctx, s, dir, t) {
    ctx.save(); ctx.scale(s * dir, s); const w = Math.sin(t * 6);
    ctx.strokeStyle = '#6a5a3a'; ctx.lineCap = 'round'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-28, -8); ctx.quadraticCurveTo(-60, -6 + w * 3, -92, -3); ctx.stroke(); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-88, -3); ctx.lineTo(-118, -2 - w * 2); ctx.stroke();
    ctx.lineWidth = 4; for (const [x, k] of [[-22, 1], [18, -1]]) { ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x + 6 + w * 3 * k, -1); ctx.lineTo(x + 12 + w * 3 * k, 0); ctx.stroke(); }
    ctx.fillStyle = shade(ctx, -18, 0, '#9a8454', '#5a4a30'); bean(ctx, 0, -9, 34, 9);
    ctx.fillStyle = '#3a2e1c'; for (let k = -3; k <= 3; k++) ctx.fillRect(k * 8 - 1.5, -17, 3, 9);
    ctx.fillStyle = shade(ctx, -20, -4, '#a08a5a', '#6a583a'); ctx.beginPath(); ctx.moveTo(28, -15); ctx.quadraticCurveTo(50, -20, 60, -10); ctx.quadraticCurveTo(50, -3, 28, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0d060'; bean(ctx, 47, -13, 2.6, 2.2); ctx.fillStyle = '#1a140c'; bean(ctx, 47.6, -13, 1.2, 1.6);
    ctx.restore();
  }
  /* the cactus wren: a speckled brown bird with a white eyebrow */
  function wren(ctx, s, dir, t) {
    ctx.save(); ctx.scale(s * dir, s); const bob = Math.sin(t * 5) * 1.5;
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-3, 6); ctx.moveTo(5, -4); ctx.lineTo(6, 6); ctx.stroke();
    ctx.fillStyle = '#6a4e32'; ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(-36, -8); ctx.lineTo(-34, -2); ctx.lineTo(-12, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(ctx, -30, 0, '#8a6a46', '#e8dcc0'); bean(ctx, 0, -14 + bob * .3, 17, 12, -.15);
    ctx.fillStyle = '#3a2a1c'; for (const [x, y] of [[-6, -10], [0, -6], [6, -9], [-2, -15], [8, -14], [-10, -5]]) bean(ctx, x, y + bob * .3, 1.4, 1.1);
    ctx.fillStyle = '#7a5a3a'; bean(ctx, 15, -25 + bob, 8.5, 7.5);
    ctx.fillStyle = '#fbf6ea'; bean(ctx, 16, -28 + bob, 7, 1.5, -.15);
    ctx.fillStyle = '#1a120c'; bean(ctx, 18, -25.5 + bob, 1.5, 1.5);
    ctx.fillStyle = '#3a3028'; ctx.beginPath(); ctx.moveTo(22, -26 + bob); ctx.quadraticCurveTo(32, -25 + bob, 35, -21 + bob); ctx.lineTo(22, -22 + bob); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /* the mantis: green, upright, arms folded, a triangle of a head */
  function mantis(ctx, s, dir, t) {
    ctx.save(); ctx.scale(s * dir, s); const sw = Math.sin(t * 1.6) * .05; ctx.rotate(sw);
    ctx.strokeStyle = '#5a8a34'; ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
    for (const x of [-12, -4]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x - 5, -3); ctx.lineTo(x - 3, 0); ctx.stroke(); }
    ctx.fillStyle = shade(ctx, -16, -4, '#8aba50', '#4a7a2a'); bean(ctx, -12, -11, 15, 4, -.12);
    ctx.lineWidth = 3.4; ctx.strokeStyle = '#6a9a3c'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, -30); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(7, -26); ctx.lineTo(17, -24); ctx.lineTo(12, -32); ctx.stroke();
    ctx.fillStyle = '#7aaa44'; ctx.beginPath(); ctx.moveTo(6, -34); ctx.lineTo(15, -36); ctx.lineTo(10, -28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a2a10'; bean(ctx, 7.5, -34, 1.3, 1.3); bean(ctx, 13.5, -35, 1.3, 1.3);
    ctx.restore();
  }
  /* the broom: a long handle, straw bristles, sweeping */
  function broom(ctx, s, t) {
    ctx.save(); ctx.scale(s, s); ctx.rotate(-.5 + Math.sin(t * 7) * .12);
    ctx.strokeStyle = '#b8935a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, -230); ctx.stroke();
    ctx.fillStyle = '#7a3a2a'; ctx.fillRect(-16, -40, 32, 9);
    ctx.fillStyle = '#e0c070'; ctx.beginPath(); ctx.moveTo(-16, -32); ctx.lineTo(16, -32); ctx.lineTo(26, 0); ctx.lineTo(-26, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a88a40'; ctx.lineWidth = 1; for (let k = -5; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(k * 3, -32); ctx.lineTo(k * 4.6, 0); ctx.stroke(); }
    ctx.restore();
  }
  function moth(ctx, s, ph) { ctx.save(); ctx.scale(s, s); const f = Math.abs(Math.sin(ph)); ctx.fillStyle = '#e8d8b0'; bean(ctx, -4 * f - 2, 0, 5 * f + 1, 3.6, .3); bean(ctx, 4 * f + 2, 0, 5 * f + 1, 3.6, -.3); ctx.fillStyle = '#a89070'; bean(ctx, 0, 0, 1.4, 4); ctx.restore(); }
  function icon(ctx, key) {
    switch (key) {
      case 'wasp': ctx.translate(-2, 2); dauber(ctx, 1.9, 1, .01); return true;
      case 'lizard': ctx.translate(14, 12); lizard(ctx, .52, 1, 1); return true;
      case 'bird': ctx.translate(0, 22); wren(ctx, 1.5, 1, 1); return true;
      case 'mantis': ctx.translate(2, 30); mantis(ctx, 1.7, 1, 1); return true;
      case 'broom': ctx.translate(-22, 34); broom(ctx, .34, 1); return true;
      case 'kid': ctx.translate(0, 44); child(ctx, 9, { h: 100, pose: 'look', t: 1 }); return true;
    }
    return false;
  }
  return { child, grownup, beam, dauber, lizard, wren, mantis, broom, moth, icon, bean, shade };
})();
