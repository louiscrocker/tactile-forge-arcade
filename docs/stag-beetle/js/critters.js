/* ============================================================
   critters.js — everyone else in the garden, and the garden
   ============================================================
   Drawn the same in both looks (the WebGL look lights them).
   The child, who grows up (height comes from age) · mole, centipede,
   woodlice, badger · magpie, cat, fox, bat, moth · the house, the
   fence, the washing line, the street lamp, the pond, the path, the
   log pile, the compost.  Everything is side view; a thing's feet
   are at y = 0 unless it says otherwise.
   ============================================================ */
'use strict';

const Critters = (function () {
  const bean = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
  const shade = (ctx, y0, y1, a, b) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };

  /* the child: 6 at the start, a teenager by the end; o: { h height, pose: stand|walk|sit|carry|look|bike|guitar, t, dir } */
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
  function bike(ctx, h, t, stabilisers) {
    const r = h * .26;
    ctx.save(); ctx.lineCap = 'round';
    for (const x of [-h * .4, h * .4]) { ctx.strokeStyle = '#25282e'; ctx.lineWidth = h * .035; ctx.beginPath(); ctx.arc(x, -r, r, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(200,205,215,.6)'; ctx.lineWidth = h * .008; for (let k = 0; k < 6; k++) { const a = t * 6 + k / 6 * TAU; ctx.beginPath(); ctx.moveTo(x, -r); ctx.lineTo(x + Math.cos(a) * r, -r + Math.sin(a) * r); ctx.stroke(); } }
    ctx.strokeStyle = '#c8362a'; ctx.lineWidth = h * .04; ctx.beginPath(); ctx.moveTo(-h * .4, -r); ctx.lineTo(-h * .08, -r * 2.2); ctx.lineTo(h * .32, -r * 2.2); ctx.lineTo(h * .4, -r); ctx.moveTo(-h * .08, -r * 2.2); ctx.lineTo(0, -r); ctx.lineTo(-h * .4, -r); ctx.moveTo(0, -r); ctx.lineTo(h * .32, -r * 2.2); ctx.stroke();
    ctx.strokeStyle = '#25282e'; ctx.beginPath(); ctx.moveTo(h * .32, -r * 2.2); ctx.lineTo(h * .3, -r * 2.7); ctx.lineTo(h * .4, -r * 2.75); ctx.moveTo(-h * .08, -r * 2.2); ctx.lineTo(-h * .1, -r * 2.5); ctx.stroke();
    if (stabilisers) { ctx.strokeStyle = '#d0d4da'; ctx.lineWidth = h * .025; ctx.beginPath(); ctx.moveTo(-h * .4, -r); ctx.lineTo(-h * .5, -r * .3); ctx.stroke(); ctx.beginPath(); ctx.arc(-h * .5, -r * .3, r * .3, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  /* ---------- below ground ---------- */
  function mole(ctx, s, dir, t) {
    ctx.save(); ctx.scale(s * dir, s);
    const dig = Math.sin(t * 10);
    ctx.fillStyle = shade(ctx, -20, 20, '#4a4648', '#1c1a1e'); bean(ctx, -6, 0, 30, 18);
    ctx.fillStyle = '#353235'; bean(ctx, 18, -2, 13, 11, .1);
    ctx.fillStyle = '#f0a8a8'; bean(ctx, 32, 0, 6, 4.2, .1);
    ctx.fillStyle = '#d88a8a'; bean(ctx, 35, -1, 2.2, 1.6);
    ctx.save(); ctx.translate(14, 12); ctx.rotate(.8 + dig * .6); ctx.fillStyle = '#eeb0a8'; rr(ctx, -2, -3, 16, 9, 4); ctx.fill(); ctx.strokeStyle = '#e8d8c0'; ctx.lineWidth = 1.4; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(14, -2 + k * 2.2); ctx.lineTo(19, -3 + k * 2.6); ctx.stroke(); } ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-24, -9); ctx.quadraticCurveTo(-6, -17, 10, -11); ctx.stroke();
    ctx.restore();
  }
  function centipede(ctx, s, dir, t) {
    ctx.save(); ctx.scale(s * dir, s);
    for (let k = 14; k >= 0; k--) {
      const x = -k * 5, y = Math.sin(t * 16 + k * .7) * 2;
      ctx.strokeStyle = '#a0622a'; ctx.lineWidth = .9;
      for (const q of [1, -1]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(t * 30 + k) * 3, y + q * 7); ctx.stroke(); }
      ctx.fillStyle = k % 2 ? '#c07a30' : '#a8642a'; bean(ctx, x, y, 3.6, 2.8);
    }
    ctx.strokeStyle = '#a0622a'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(3, 0); ctx.quadraticCurveTo(10, -5, 14, -2); ctx.moveTo(3, 0); ctx.quadraticCurveTo(10, 5, 14, 3); ctx.stroke();
    ctx.restore();
  }
  function woodlouse(ctx, s, dir, t) {
    ctx.save(); ctx.scale(s * dir, s);
    ctx.fillStyle = '#8a8c94'; bean(ctx, 0, 0, 8, 4.6);
    ctx.strokeStyle = 'rgba(40,40,50,.5)'; ctx.lineWidth = .6; for (let k = -5; k <= 5; k += 2) { ctx.beginPath(); ctx.moveTo(k, -4); ctx.lineTo(k, 4); ctx.stroke(); }
    ctx.strokeStyle = '#60626a'; ctx.lineWidth = .7; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-5 + k * 2.4, 4); ctx.lineTo(-5 + k * 2.4 + Math.sin(t * 20 + k) * 1.5, 7); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(8, -1); ctx.lineTo(12, -3.5); ctx.stroke();
    ctx.restore();
  }
  function badger(ctx, s, dir, t, digging) {
    ctx.save(); ctx.scale(s * dir, s);
    const dig = digging ? Math.sin(t * 12) : 0;
    ctx.fillStyle = shade(ctx, -60, 0, '#8c8c8e', '#3a3a3c'); bean(ctx, -36, -32, 56, 30);
    ctx.fillStyle = '#26262a'; for (const x of [-72, -14]) { rr(ctx, x, -20 - (x > -30 ? dig * 8 : 0), 14, 22, 5); ctx.fill(); }
    ctx.fillStyle = '#e8e8e4'; ctx.beginPath(); ctx.moveTo(4, -48); ctx.quadraticCurveTo(42, -44, 48, -18); ctx.quadraticCurveTo(26, -10, 4, -22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#17171a'; ctx.beginPath(); ctx.moveTo(10, -40); ctx.quadraticCurveTo(30, -36, 44, -22); ctx.lineTo(38, -20); ctx.quadraticCurveTo(26, -28, 8, -30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#17171a'; bean(ctx, 48, -18, 4, 3);
    ctx.fillStyle = '#fff'; bean(ctx, 6, -48, 5, 4);
    ctx.restore();
  }

  /* ---------- on the lawn and in the air ---------- */
  function magpie(ctx, s, dir, t, flying) {
    ctx.save(); ctx.scale(s * dir, s);
    ctx.fillStyle = '#12141c'; ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(-62, -8); ctx.lineTo(-58, -2); ctx.lineTo(-12, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#16181f'; bean(ctx, 2, -22, 20, 12, -.2);
    ctx.fillStyle = '#f2f2ee'; bean(ctx, 4, -17, 13, 7, -.2);
    ctx.fillStyle = '#12141c'; bean(ctx, 19, -32, 8, 7.5);
    ctx.fillStyle = '#3a6ac0'; bean(ctx, -6, -24, 11, 4, -.1 + (flying ? Math.sin(t * 16) * .6 : 0));
    ctx.fillStyle = '#23232a'; ctx.beginPath(); ctx.moveTo(26, -33); ctx.lineTo(36, -31); ctx.lineTo(26, -29); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; bean(ctx, 21, -34, 1.6, 1.6);
    ctx.strokeStyle = '#1a1a20'; ctx.lineWidth = 1.5; if (!flying) { for (const x of [0, 7]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + 2, 0); ctx.stroke(); } }
    ctx.restore();
  }
  function cat(ctx, s, dir, t, patting) {
    ctx.save(); ctx.scale(s * dir, s);
    const col = '#d98a3a', dk = '#a85f22', pat = patting ? Math.max(0, Math.sin(t * 7)) : 0;
    ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-54, -34); ctx.quadraticCurveTo(-80, -40 + Math.sin(t * 3) * 6, -74, -72); ctx.stroke();
    ctx.fillStyle = shade(ctx, -56, -12, col, dk); bean(ctx, -24, -34, 36, 21);
    ctx.fillStyle = dk; for (const x of [-44, -12]) { rr(ctx, x, -22, 10, 22, 4); ctx.fill(); }
    ctx.fillStyle = col; ctx.save(); ctx.translate(2, -24); ctx.rotate(-pat * .9); rr(ctx, 0, -4, 10, 26, 5); ctx.fill(); ctx.restore();
    bean(ctx, 18, -54, 18, 16);
    ctx.beginPath(); ctx.moveTo(6, -66); ctx.lineTo(8, -82); ctx.lineTo(18, -70); ctx.moveTo(22, -70); ctx.lineTo(32, -82); ctx.lineTo(32, -64); ctx.fill();
    ctx.fillStyle = '#7ad07a'; bean(ctx, 24, -56, 3.4, 4); ctx.fillStyle = '#111'; bean(ctx, 25, -56, 1.2, 3.2);
    ctx.fillStyle = '#f0a0a0'; bean(ctx, 34, -49, 2, 1.6);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .7; for (const q of [-2, 2]) { ctx.beginPath(); ctx.moveTo(32, -47); ctx.lineTo(46, -47 + q * 2); ctx.stroke(); }
    ctx.strokeStyle = dk; ctx.lineWidth = 3; for (const x of [-40, -28, -16]) { ctx.beginPath(); ctx.moveTo(x, -52); ctx.lineTo(x + 3, -38); ctx.stroke(); }
    ctx.restore();
  }
  function fox(ctx, s, dir, t, sniff) {
    ctx.save(); ctx.scale(s * dir, s);
    const col = '#c8582a', wag = Math.sin(t * 4) * 5;
    ctx.fillStyle = shade(ctx, -60, 0, '#e2743a', '#a8421e');
    ctx.beginPath(); ctx.moveTo(-50, -42); ctx.quadraticCurveTo(-96, -34 + wag, -112, -14 + wag); ctx.quadraticCurveTo(-82, -6 + wag, -50, -26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.moveTo(-112, -14 + wag); ctx.lineTo(-92, -24 + wag); ctx.lineTo(-90, -11 + wag); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(ctx, -60, -18, '#e2743a', '#a8421e'); bean(ctx, -20, -40, 40, 18);
    ctx.fillStyle = '#2a1a14'; for (const x of [-44, -32, 0, 12]) { rr(ctx, x, -28, 6, 28, 3); ctx.fill(); }
    ctx.save(); ctx.translate(22, -44); ctx.rotate(sniff ? .5 + Math.sin(t * 8) * .05 : 0);
    ctx.fillStyle = col; bean(ctx, 8, -6, 15, 12); ctx.beginPath(); ctx.moveTo(2, -14); ctx.lineTo(4, -32); ctx.lineTo(14, -16); ctx.moveTo(10, -16); ctx.lineTo(20, -30); ctx.lineTo(20, -12); ctx.fill();
    ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.moveTo(6, 2); ctx.quadraticCurveTo(22, 6, 38, -2); ctx.lineTo(18, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1210'; bean(ctx, 37, -3, 3, 2.4); bean(ctx, 15, -8, 1.8, 2.2);
    ctx.restore(); ctx.restore();
  }
  function bat(ctx, s, ph) {
    ctx.save(); ctx.scale(s, s);
    const f = Math.sin(ph);
    ctx.fillStyle = '#2a2230';
    for (const q of [1, -1]) { ctx.save(); ctx.scale(q, 1); ctx.beginPath(); ctx.moveTo(2, -2); ctx.quadraticCurveTo(14, -10 - f * 12, 28, -4 - f * 16); ctx.quadraticCurveTo(22, 0 - f * 6, 18, 3 - f * 4); ctx.quadraticCurveTo(12, 0, 2, 5); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#3e3038'; bean(ctx, 0, 0, 4.4, 6.4);
    ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(-4, -11); ctx.lineTo(0, -6); ctx.lineTo(4, -11); ctx.lineTo(3, -5); ctx.fill();
    ctx.restore();
  }
  function moth(ctx, s, ph) { ctx.save(); ctx.scale(s, s); const f = Math.abs(Math.sin(ph)); ctx.fillStyle = '#e8d8b0'; bean(ctx, -4 * f - 2, 0, 5 * f + 1, 3.6, .3); bean(ctx, 4 * f + 2, 0, 5 * f + 1, 3.6, -.3); ctx.fillStyle = '#a89070'; bean(ctx, 0, 0, 1.4, 3.6); ctx.restore(); }
  function icon(ctx, key) {
    const t = 1;
    switch (key) {
      case 'mole': ctx.translate(-4, 2); mole(ctx, .95, 1, t); break;
      case 'badger': ctx.translate(-2, 26); badger(ctx, .62, 1, t); break;
      case 'magpie': ctx.translate(4, 24); magpie(ctx, .95, 1, t); break;
      case 'cat': ctx.translate(6, 34); cat(ctx, .78, 1, t); break;
      case 'fox': ctx.translate(14, 28); fox(ctx, .62, 1, t); break;
      case 'bat': bat(ctx, 1.4, .8); break;
      case 'moth': moth(ctx, 3, 1); break;
      case 'kid': ctx.translate(0, 44); child(ctx, 12, { h: 88, pose: 'wave', t: 1 }); break;
      case 'bike': ctx.translate(0, 26); bike(ctx, 70, 1); break;
      case 'lamp': ctx.fillStyle = '#2e3138'; ctx.fillRect(-3, -28, 6, 66); bean(ctx, 0, -30, 13, 6); ctx.fillStyle = '#ffe9a0'; bean(ctx, 0, -25, 10, 5); break;
      case 'pile': for (const [x, y] of [[-22, 16], [22, 16], [0, -18]]) { ctx.fillStyle = '#7a5638'; bean(ctx, x, y, 20, 20); ctx.fillStyle = '#d0a06a'; bean(ctx, x, y, 14, 14); ctx.strokeStyle = '#9a6a3e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke(); } break;
    }
  }
  return { child, bike, mole, centipede, woodlouse, badger, magpie, cat, fox, bat, moth, icon, bean, shade };
})();
