/* ============================================================
   sprites2.js — the bugs, and every little picture
   ============================================================
   drawPrey: the things that blunder into the web (side view).
   drawIcon: one picture for each key, in a box about 80 across,
   centred on 0,0.  Used by the life wheel, the stickers, the
   journal, the word cards and the rebus pictures.
   ============================================================ */
'use strict';

(function () {
  const bean = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
  /* o: { ph, s (scale) } — about 10 units long at s = 1, facing +x */
  function drawPrey(ctx, kind, o = {}) {
    const ph = o.ph || 0, s = o.s || 1, f = Math.abs(Math.sin(ph));
    ctx.save(); ctx.scale(s, s); ctx.lineCap = 'round';
    const legs = (col, n = 3, len = 4) => { ctx.strokeStyle = col; ctx.lineWidth = .7; for (let k = 0; k < n; k++) { const x = -3 + k * (6 / Math.max(1, n - 1)), w = Math.sin(ph + k * 2) * 1.2; ctx.beginPath(); ctx.moveTo(x, 1); ctx.lineTo(x + w, len); ctx.stroke(); } };
    const wings = (col, w, h) => { ctx.fillStyle = col; bean(ctx, -1, -2 - f * h, w, 1.2 + f * h, -.5); bean(ctx, 1.5, -2 - f * h * .8, w * .8, 1 + f * h * .8, .4); };
    if (kind === 'gnat') { wings('rgba(220,235,255,.6)', 3, 2); ctx.fillStyle = '#3a3630'; bean(ctx, 0, 0, 2.6, 1.1); bean(ctx, 2.6, -.3, 1, 1); }
    else if (kind === 'fly') { wings('rgba(200,225,255,.6)', 4.5, 2.6); ctx.fillStyle = '#2c3440'; bean(ctx, -1, 0, 4, 2.4); ctx.fillStyle = '#3a4656'; bean(ctx, 2.6, -.4, 2.2, 2); ctx.fillStyle = '#a03a2a'; bean(ctx, 3.8, -.9, 1.1, 1.1); legs('#20242c', 3, 3); }
    else if (kind === 'moth') { ctx.fillStyle = '#d8c8a0'; bean(ctx, -2, -1 - f * 4, 5, 2 + f * 3, -.5); ctx.fillStyle = '#c4b088'; bean(ctx, 2, -1 - f * 3, 4, 2 + f * 2.4, .5); ctx.fillStyle = '#8a7658'; bean(ctx, 0, 1, 4.2, 1.7); ctx.strokeStyle = '#8a7658'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(6.5, -3); ctx.stroke(); }
    else if (kind === 'ant') { legs('#3a1c10', 3, 3.4); ctx.fillStyle = '#5a2a14'; bean(ctx, -3.2, 0, 2.6, 1.9); bean(ctx, 0, .2, 1.6, 1.3); bean(ctx, 2.8, -.3, 1.8, 1.6); ctx.strokeStyle = '#5a2a14'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(6, -3); ctx.stroke(); }
    else if (kind === 'pillbug') { legs('#5a6068', 5, 2.6); ctx.fillStyle = '#6a727c'; ctx.beginPath(); ctx.ellipse(0, 0, 5.4, 3.4, 0, Math.PI, TAU); ctx.fill(); ctx.strokeStyle = '#4a5058'; ctx.lineWidth = .6; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 1.4, 0); ctx.lineTo(k * 1.2, -3.2 + Math.abs(k) * .35); ctx.stroke(); } }
    else if (kind === 'cricket') { ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-5, -5); ctx.lineTo(-7, 3); ctx.stroke(); legs('#3a2a1a', 2, 3); ctx.fillStyle = '#4a3622'; bean(ctx, 0, 0, 5.4, 2.4); ctx.fillStyle = '#33241a'; bean(ctx, 4.6, -.6, 2, 2); ctx.strokeStyle = '#33241a'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(6, -1.5); ctx.quadraticCurveTo(9, -6, 12, -5); ctx.stroke(); }
    else if (kind === 'beetle') { legs('#1a1612', 3, 3.2); ctx.fillStyle = '#2a2420'; bean(ctx, -.6, -.4, 5.4, 3.4); ctx.fillStyle = '#1a1612'; bean(ctx, 4.6, 0, 2, 2); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.arc(-.6, -.4, 4, 3.6, 5.2); ctx.stroke(); }
    else if (kind === 'junebug') { wings('rgba(230,220,200,.5)', 5, 2.4); legs('#4a2a12', 3, 3.4); ctx.fillStyle = '#8a4a1e'; bean(ctx, -.6, -.4, 6, 3.8); ctx.fillStyle = '#5a2e12'; bean(ctx, 5, 0, 2.2, 2.2); ctx.strokeStyle = 'rgba(255,235,200,.3)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(-.6, -.4, 4.4, 3.6, 5.2); ctx.stroke(); }
    else if (kind === 'hopper') { ctx.strokeStyle = '#5a7a2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-6, -7); ctx.lineTo(-9, 3); ctx.stroke(); legs('#5a7a2a', 2, 3.4); ctx.fillStyle = '#7a9a3a'; bean(ctx, 0, 0, 7, 2.4); ctx.fillStyle = '#6a8a30'; bean(ctx, 6, -1, 2.2, 2.4); ctx.fillStyle = '#2a2a1a'; bean(ctx, 6.8, -1.6, .7, .9); }
    else if (kind === 'leaf') drawLeaf(ctx, 6, ph);
    ctx.restore();
  }
  function drawLeaf(ctx, r, ph = 0) {
    ctx.save(); ctx.rotate(Math.sin(ph * .25) * .5);
    ctx.fillStyle = '#b08a3a'; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, -r * .8, r, 0); ctx.quadraticCurveTo(0, r * .8, -r, 0); ctx.fill();
    ctx.strokeStyle = '#7a5a1e'; ctx.lineWidth = Math.max(.5, r * .08); ctx.beginPath(); ctx.moveTo(-r * 1.2, 0); ctx.lineTo(r, 0); ctx.stroke();
    ctx.restore();
  }
  const web = (ctx, r, col = '#eaf2ff') => { ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; for (const [a, b, c, d] of [[-r, -r * .7, r, -r * .5], [-r * .8, -r * .1, r * .9, r * .1], [-r * .5, -r * .7, -r * .5, r], [r * .1, -r * .6, r * .1, r], [r * .6, -r * .5, r * .6, r], [-r, -r * .7, r * .1, r * .1]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); } };
  const spider = (ctx, r, o) => { ctx.save(); ctx.rotate(-Math.PI / 2); Sprites.drawSpider(ctx, Object.assign({ r, ph: 1 }, o)); ctx.restore(); };
  function drawIcon(ctx, key, size = 100, form = 'girl') {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const dark = (r = 40) => { ctx.fillStyle = '#26314a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); };
    switch (key) {
      case 'sac': ctx.strokeStyle = '#cfd8e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -22); ctx.stroke(); ctx.translate(0, 4); Sprites.drawSac(ctx, 27); break;
      case 'parent': ctx.translate(0, 8); Sprites.drawSac(ctx, 22, { crack: 1 }); for (const [x, y] of [[14, -24], [22, -34], [4, -34], [-10, -30], [30, -22]]) { ctx.save(); ctx.translate(x, y); spider(ctx, 3.4, { instar: 0 }); ctx.restore(); } break;
      case 'ling': spider(ctx, 13, { instar: 0 }); break;
      case 'young1': case 'skin': spider(ctx, 16, { instar: 2, form }); break;
      case 'young2': spider(ctx, 17, { instar: 4, form: 'girl' }); break;
      case 'adult': case 'spider': if (form === 'boy') spider(ctx, 12, { adult: true, form: 'boy' }); else { ctx.translate(0, 4); spider(ctx, 19, { adult: true, form: 'girl', belly: key === 'adult' }); } break;
      case 'boy': spider(ctx, 12, { adult: true, form: 'boy' }); break;
      case 'hourglass': dark(38); ctx.rotate(Math.PI / 2); Sprites.hourglass(ctx, 44, '#e0241c'); break;
      case 'curl': ctx.translate(0, 6); spider(ctx, 17, { instar: 4, form: 'girl', curl: true }); break;
      case 'web': dark(); web(ctx, 26); break;
      case 'thread': dark(); ctx.strokeStyle = '#eaf2ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-30, -18); ctx.lineTo(30, 14); ctx.stroke(); ctx.fillStyle = '#fff'; bean(ctx, -30, -18, 4, 4); bean(ctx, 30, 14, 4, 4); break;
      case 'gum': dark(); ctx.strokeStyle = '#eaf2ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-28, -24); ctx.lineTo(28, -20); ctx.moveTo(0, -22); ctx.lineTo(0, 26); ctx.stroke(); ctx.fillStyle = '#ffe9a0'; for (const y of [8, 15, 22]) bean(ctx, 0, y, 3.4, 3); ctx.fillStyle = '#b08a5a'; ctx.fillRect(-26, 27, 52, 5); break;
      case 'parcel': ctx.strokeStyle = '#cfd8e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -14); ctx.stroke(); ctx.translate(0, 4); Sprites.drawParcel(ctx, 22, 1, .4); break;
      case 'fly': case 'moth': case 'ant': ctx.scale(4.4, 4.4); drawPrey(ctx, key, { ph: 1 }); break;
      case 'leaf': drawLeaf(ctx, 30, 1); break;
      case 'moon': ctx.fillStyle = '#f4efd0'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(160,160,130,.4)'; bean(ctx, -8, -6, 7, 7); bean(ctx, 10, 8, 5, 5); break;
      case 'sun': ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 5; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 27, Math.sin(a) * 27); ctx.lineTo(Math.cos(a) * 37, Math.sin(a) * 37); ctx.stroke(); } break;
      case 'wind': ctx.strokeStyle = '#8fc0e8'; ctx.lineWidth = 5; for (const [y, w] of [[-16, 30], [0, 38], [16, 24]]) { ctx.beginPath(); ctx.moveTo(-36, y); ctx.quadraticCurveTo(0, y - 10, w - 10, y); ctx.arc(w - 10, y - 7, 7, Math.PI / 2, -Math.PI * .8, true); ctx.stroke(); } ctx.translate(-8, 22); spider(ctx, 5, { instar: 0, spread: true }); break;
      case 'den': ctx.fillStyle = '#b8794a'; ctx.beginPath(); ctx.moveTo(-34, 30); ctx.lineTo(-26, -26); ctx.lineTo(26, -26); ctx.lineTo(34, 30); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.arc(0, 30, 20, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#e0241c'; bean(ctx, 0, 18, 4, 3); break;
      case 'pot': ctx.fillStyle = '#c0703a'; ctx.beginPath(); ctx.moveTo(-26, -18); ctx.lineTo(26, -18); ctx.lineTo(18, 32); ctx.lineTo(-18, 32); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#d88a50'; ctx.fillRect(-31, -30, 62, 13); break;
      case 'boot': ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.moveTo(-26, -34); ctx.lineTo(-2, -34); ctx.lineTo(0, 0); ctx.quadraticCurveTo(34, 2, 34, 30); ctx.lineTo(-28, 30); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3a2a1e'; ctx.fillRect(-30, 28, 66, 6); break;
      case 'torch': ctx.fillStyle = 'rgba(255,240,170,.55)'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(38, -26); ctx.lineTo(38, 26); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a5060'; rr(ctx, -36, -8, 34, 16, 4); ctx.fill(); ctx.fillStyle = '#d8dce6'; ctx.fillRect(-6, -12, 8, 24); break;
      case 'heart': ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-50, -6, -22, -42, 0, -14); ctx.bezierCurveTo(22, -42, 50, -6, 0, 30); ctx.fill(); break;
      default: if (typeof Critters !== 'undefined' && Critters.icon(ctx, key)) break; ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  const ICONS = ['sac', 'parent', 'ling', 'young1', 'skin', 'young2', 'adult', 'spider', 'boy', 'hourglass', 'curl', 'web', 'thread', 'gum', 'parcel', 'fly', 'moth', 'ant', 'leaf', 'moon', 'sun', 'wind', 'den', 'pot', 'boot', 'torch', 'heart', 'wasp', 'lizard', 'bird', 'mantis', 'broom', 'kid'];
  const cache = new Map();
  function icon(key, px, form = 'girl') {
    const id = key + '|' + px + '|' + form; let c = cache.get(id);
    if (!c) { c = document.createElement('canvas'); c.width = c.height = px * 2; const g = c.getContext('2d'); g.scale(px * 2 / 100, px * 2 / 100); g.translate(50, 50); drawIcon(g, key, 100, form); cache.set(id, c); }
    const out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }
  Object.assign(Sprites, { drawPrey, drawLeaf, drawIcon, icon, hasIcon: (k) => ICONS.includes(k) });
})();
