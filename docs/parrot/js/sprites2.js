/* ============================================================
   sprites2.js — the food, the notes of a call, and every icon
   ============================================================
   drawFood    a fig, a bunch of palm nuts, a scrape of clay
   drawNote    one note of a name: an arrow on a coloured disc
   drawIcon    the pictures on stickers, cards, the life wheel and
               the Read to Play pages, in a 100 × 100 box round (0, 0)
   ============================================================ */
'use strict';

const NOTE_COL = { up: '#ff7a59', right: '#ffd23f', down: '#5ad1ff', left: '#b78cff' };
const NOTE_ANG = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI };

(function () {
  const bean = Sprites.bean;
  function drawFood(ctx, kind, o = {}) {
    const n = o.n === undefined ? 1 : o.n, bite = o.bite || 0;
    ctx.save();
    if (kind === 'fig') {
      ctx.strokeStyle = '#4a6a2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke();
      ctx.globalAlpha = n > 0 ? 1 : .28; ctx.translate(0, 10 + bite * 2);
      ctx.fillStyle = '#7a3a8a'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.bezierCurveTo(7, -4, 8, 6, 0, 7); ctx.bezierCurveTo(-8, 6, -7, -4, 0, -6); ctx.fill();
      ctx.fillStyle = 'rgba(255,210,255,.4)'; bean(ctx, -2.4, -1, 1.6, 2.6, .3);
      ctx.fillStyle = '#3f8a3a'; ctx.save(); ctx.translate(5, -7); ctx.rotate(-.5); Sprites.drawLeaf(ctx, 6, 0, '#4a9a3a'); ctx.restore();
    } else if (kind === 'nut') {
      ctx.strokeStyle = '#6a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8); ctx.stroke();
      ctx.globalAlpha = n > 0 ? 1 : .28;
      for (const [x, y] of [[-5, 10], [5, 10], [0, 16], [-6, 20], [6, 20], [0, 25]]) { ctx.fillStyle = '#a8662a'; bean(ctx, x, y, 4.6, 5.2); ctx.fillStyle = '#7a4418'; ctx.beginPath(); ctx.arc(x, y, 4.4, .3, 2.6); ctx.fill(); ctx.fillStyle = 'rgba(255,230,180,.45)'; bean(ctx, x - 1.4, y - 1.8, 1.2, 1.6); }
    } else {
      ctx.globalAlpha = n > 0 ? 1 : .3;
      ctx.fillStyle = '#e9a27a'; bean(ctx, 0, 3, 13, 5); ctx.fillStyle = '#f6c4a0'; bean(ctx, -2, 2, 8, 2.6);
      ctx.strokeStyle = '#a85a3a'; ctx.lineWidth = 1; for (const x of [-7, -2, 4]) { ctx.beginPath(); ctx.moveTo(x, 1); ctx.lineTo(x + 3, 5); ctx.stroke(); }
    }
    ctx.restore();
  }
  function drawNote(ctx, dir, s, k = 1) {
    ctx.save(); ctx.globalAlpha *= k;
    ctx.fillStyle = NOTE_COL[dir] || '#fff'; ctx.strokeStyle = 'rgba(30,20,10,.7)'; ctx.lineWidth = s * .12; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.rotate(NOTE_ANG[dir] || 0); ctx.fillStyle = '#2a2016';
    ctx.beginPath(); ctx.moveTo(s * .62, 0); ctx.lineTo(0, -s * .52); ctx.lineTo(0, -s * .2); ctx.lineTo(-s * .58, -s * .2); ctx.lineTo(-s * .58, s * .2); ctx.lineTo(0, s * .2); ctx.lineTo(0, s * .52); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /* a hole in a trunk, with the trunk round it */
  function hole(ctx, box) {
    ctx.fillStyle = '#7a5a3a'; rr(ctx, -30, -44, 60, 88, 10); ctx.fill();
    ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; for (const x of [-18, -4, 12]) { ctx.beginPath(); ctx.moveTo(x, -40); ctx.quadraticCurveTo(x + 5, 0, x, 40); ctx.stroke(); }
    if (box) { ctx.fillStyle = '#c89a5a'; rr(ctx, -22, -26, 44, 58, 4); ctx.fill(); ctx.strokeStyle = '#8a6a3a'; ctx.stroke(); }
    ctx.fillStyle = '#20140c'; bean(ctx, 0, -2, 14, 17);
  }
  function drawIcon(ctx, key, size = 100, form = 'girl') {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const par = (o, s = 1.25, x = -2, y = 26) => { ctx.translate(x, y); ctx.scale(s, s); Sprites.drawParrot(ctx, o); };
    switch (key) {
      case 'egg': ctx.fillStyle = '#b89a6a'; bean(ctx, 0, 30, 34, 8); Sprites.drawEgg(ctx, 26); break;
      case 'chick': ctx.translate(-6, 34); Sprites.drawChick(ctx, { r: 20, instar: 1 }); break;
      case 'fledge': ctx.translate(-4, 0); ctx.scale(1.05, 1.05); Sprites.drawParrot(ctx, { r: 15, pose: 'fly', ph: 1, young: true, tailK: .6 }); break;
      case 'young': par({ r: 15, young: true, tailK: .7 }, 1.3, 0, 26); break;
      case 'adult': case 'parrot': par({ r: 16 }, 1.2, 2, 24); break;
      case 'pair': ctx.save(); par({ r: 16 }, .92, -18, 22); ctx.restore(); ctx.save(); ctx.translate(22, 22); ctx.scale(-.92, .92); Sprites.drawParrot(ctx, { r: 16 }); ctx.restore(); ctx.fillStyle = '#ff7aa8'; ctx.translate(2, -34); ctx.scale(.3, .3); ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-50, -6, -22, -42, 0, -14); ctx.bezierCurveTo(22, -42, 50, -6, 0, 30); ctx.fill(); break;
      case 'parent': hole(ctx); ctx.save(); ctx.translate(-4, 12); Sprites.drawChick(ctx, { r: 9, instar: 1, beg: 1 }); ctx.restore(); break;
      case 'hollow': hole(ctx); break;
      case 'box': hole(ctx, true); break;
      case 'tree': ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(-7, 40); ctx.lineTo(-4, -6); ctx.lineTo(4, -6); ctx.lineTo(8, 40); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3f8a3a'; bean(ctx, 0, -14, 34, 24); ctx.fillStyle = '#58a84a'; bean(ctx, -10, -20, 16, 11); bean(ctx, 14, -12, 12, 8); break;
      case 'fig': ctx.scale(3.4, 3.4); ctx.translate(0, -9); drawFood(ctx, 'fig'); break;
      case 'nut': ctx.scale(2.6, 2.6); ctx.translate(0, -15); drawFood(ctx, 'nut'); break;
      case 'clay': ctx.fillStyle = '#c8683a'; ctx.beginPath(); ctx.moveTo(-40, 36); ctx.lineTo(-30, -30); ctx.lineTo(34, -36); ctx.lineTo(40, 36); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e9a27a'; bean(ctx, -6, -4, 16, 8); bean(ctx, 12, 18, 12, 6); ctx.fillStyle = '#a84a2a'; ctx.fillRect(-40, 30, 80, 8); break;
      case 'river': ctx.fillStyle = '#4a9ad8'; rr(ctx, -40, -22, 80, 44, 14); ctx.fill(); ctx.strokeStyle = '#cfeaff'; ctx.lineWidth = 4; for (const y of [-8, 8]) { ctx.beginPath(); ctx.moveTo(-26, y); ctx.quadraticCurveTo(-13, y - 8, 0, y); ctx.quadraticCurveTo(13, y + 8, 26, y); ctx.stroke(); } break;
      case 'wing': ctx.translate(14, 22); ctx.scale(1.5, 1.5); Sprites.wing(ctx, 1, .8, PAL.scarlet); break;
      case 'feather': ctx.rotate(-.7); ctx.fillStyle = '#d9201f'; ctx.beginPath(); ctx.moveTo(-36, 0); ctx.quadraticCurveTo(0, -20, 36, 0); ctx.quadraticCurveTo(0, 20, -36, 0); ctx.fill(); ctx.fillStyle = '#1f62c8'; ctx.beginPath(); ctx.moveTo(14, -9); ctx.quadraticCurveTo(28, -6, 36, 0); ctx.quadraticCurveTo(28, 6, 14, 9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff3d8'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(34, 0); ctx.stroke(); break;
      case 'beak': ctx.translate(-14, 4); Sprites.head(ctx, 30, PAL.scarlet, {}); break;
      case 'foot': ctx.strokeStyle = '#55555c'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, 0); ctx.moveTo(0, 0); ctx.lineTo(26, 14); ctx.moveTo(0, 0); ctx.lineTo(14, 26); ctx.moveTo(0, 0); ctx.lineTo(-24, 16); ctx.moveTo(0, 0); ctx.lineTo(-12, 28); ctx.stroke(); ctx.fillStyle = '#a8662a'; bean(ctx, 2, 14, 10, 11); break;
      case 'leaf': Sprites.drawLeaf(ctx, 32, 1); break;
      case 'moon': ctx.fillStyle = '#f4efd0'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(160,160,130,.4)'; bean(ctx, -8, -6, 7, 7); bean(ctx, 10, 8, 5, 5); break;
      case 'sun': ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 5; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 27, Math.sin(a) * 27); ctx.lineTo(Math.cos(a) * 37, Math.sin(a) * 37); ctx.stroke(); } break;
      case 'mist': ctx.fillStyle = 'rgba(235,242,246,.95)'; for (const [x, y, w] of [[-8, -16, 30], [8, 0, 34], [-6, 16, 28]]) bean(ctx, x, y, w, 8); break;
      case 'call': ctx.save(); ctx.translate(-28, 0); drawNote(ctx, 'up', 13); ctx.restore(); drawNote(ctx, 'right', 13); ctx.translate(28, 0); drawNote(ctx, 'up', 13); break;
      case 'heart': ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-50, -6, -22, -42, 0, -14); ctx.bezierCurveTo(22, -42, 50, -6, 0, 30); ctx.fill(); break;
      case 'rope': ctx.strokeStyle = '#d8c48a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, 30); ctx.stroke(); ctx.strokeStyle = '#a8904a'; ctx.lineWidth = 2; for (let y = -40; y < 30; y += 8) { ctx.beginPath(); ctx.moveTo(-3, y); ctx.lineTo(3, y + 4); ctx.stroke(); } break;
      default: if (PAL[key]) { par({ r: 16, look: key }, PAL[key].tailK < .6 ? 1.6 : 1.15, 0, PAL[key].tailK < .6 ? 34 : 22); break; }
        if (typeof Critters !== 'undefined' && Critters.icon(ctx, key)) break; ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  const ICONS = ['egg', 'chick', 'fledge', 'young', 'adult', 'parrot', 'pair', 'parent', 'hollow', 'box', 'tree', 'fig', 'nut', 'clay', 'river', 'wing', 'feather', 'beak', 'foot', 'leaf', 'moon', 'sun', 'mist', 'call', 'heart', 'rope', 'toucan', 'eagle', 'bee', 'boat', 'kid'].concat(Object.keys(PAL));
  const cache = new Map();
  function icon(key, px, form = 'girl') {
    const id = key + '|' + px + '|' + form; let c = cache.get(id);
    if (!c) { c = document.createElement('canvas'); c.width = c.height = px * 2; const g = c.getContext('2d'); g.scale(px * 2 / 100, px * 2 / 100); g.translate(50, 50); drawIcon(g, key, 100, form); cache.set(id, c); }
    const out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }
  Object.assign(Sprites, { drawFood, drawNote, drawIcon, icon, hasIcon: (k) => ICONS.includes(k) });
})();
