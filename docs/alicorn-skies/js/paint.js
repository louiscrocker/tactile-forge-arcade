/* ============================================================
   paint.js — paint your own cutie mark
   ============================================================
   A round canvas to finger-paint on: 12 colours plus a rainbow
   brush, three brush sizes, stamps (star, heart, sparkle,
   flower), an eraser, undo and clear.  "Use it!" saves the
   picture as a small PNG on the alicorn's look (look.markImg)
   and sets her cutie mark to "custom".
   ============================================================ */
'use strict';

const Paint = (function () {
  const $ = (id) => document.getElementById(id);
  const SIZE = 320;
  const COLS = ['#ff4d6d', '#ff9a2e', '#ffd23f', '#5ad85a', '#3fb8ff', '#5b6cff', '#c56cff', '#ff7ab6', '#ffffff', '#8a5a3a', '#3a2a55', 'rainbow'];
  let G = null, look = null, onDone = null, ctx = null, col = '#ff7ab6', size = 14, tool = 'brush', drawing = false, last = null, hue = 0, undo = [];

  function init(game) {
    G = game;
    const c = $('paintCanvas');
    c.width = c.height = SIZE; ctx = c.getContext('2d');
    const pal = $('paintColours');
    for (const k of COLS) {
      const b = document.createElement('button'); b.className = 'swatch' + (k === 'rainbow' ? ' rainbow' : ''); if (k !== 'rainbow') b.style.background = k;
      b.addEventListener('click', () => { col = k; if (tool === 'eraser') tool = 'brush'; AudioFX.click(); sync(); });
      b.dataset.col = k; pal.appendChild(b);
    }
    $('paintTools').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.size) size = +b.dataset.size;
      if (b.dataset.tool) tool = b.dataset.tool;
      AudioFX.click(); sync();
    }));
    $('paintUndo').addEventListener('click', () => { const u = undo.pop(); if (u) ctx.putImageData(u, 0, 0); AudioFX.click(); });
    $('paintClear').addEventListener('click', () => { push(); ctx.clearRect(0, 0, SIZE, SIZE); AudioFX.click(); });
    $('paintClose').addEventListener('click', close);
    $('paintDone').addEventListener('click', () => {
      /* crop to a circle and save small */
      const out = document.createElement('canvas'); out.width = out.height = 160;
      const o = out.getContext('2d'); o.beginPath(); o.arc(80, 80, 80, 0, TAU); o.clip(); o.drawImage(c, 0, 0, 160, 160);
      look.markImg = out.toDataURL('image/png'); look.mark = 'custom';
      Sprites.clearIcons(); AudioFX.buy(); Voice.say('Your very own cutie mark!', { interrupt: true, force: true });
      Bus.emit('painted', look);
      close(); if (onDone) onDone(look);
    });
    const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SIZE, (e.clientY - r.top) / r.height * SIZE]; };
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); c.setPointerCapture(e.pointerId); push(); drawing = true; last = pos(e); dab(last, last); });
    c.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); dab(last, p); last = p; });
    const up = () => { drawing = false; last = null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
  function push() { undo.push(ctx.getImageData(0, 0, SIZE, SIZE)); if (undo.length > 20) undo.shift(); }
  function colour() { if (col !== 'rainbow') return col; hue = (hue + 7) % 360; return `hsl(${hue},95%,62%)`; }
  function dab(a, b) {
    ctx.save();
    ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, TAU); ctx.clip();
    if (tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; ctx.lineWidth = size * 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    else if (tool === 'brush') { ctx.strokeStyle = colour(); ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    else if (a === b || dist(a[0], a[1], b[0], b[1]) > size * 2.2) {
      /* stamps only on tap, or spaced out while dragging */
      ctx.fillStyle = colour(); const r = size * 1.6;
      if (tool === 'star') { starPath(ctx, b[0], b[1], r); ctx.fill(); }
      else if (tool === 'heart') { heartPath(ctx, b[0], b[1], r * .9); ctx.fill(); }
      else if (tool === 'sparkle') { for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(b[0], b[1]); ctx.rotate(i * Math.PI / 4); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * .22, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
      else if (tool === 'flower') { for (let i = 0; i < 5; i++) { const an = i / 5 * TAU; ctx.beginPath(); ctx.ellipse(b[0] + Math.cos(an) * r * .6, b[1] + Math.sin(an) * r * .6, r * .5, r * .32, an, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(b[0], b[1], r * .3, 0, TAU); ctx.fill(); }
      last = b;
    }
    ctx.restore();
  }
  function sync() {
    $('paintColours').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.col === col && tool !== 'eraser'));
    $('paintTools').querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.size && +b.dataset.size === size) || (b.dataset.tool && b.dataset.tool === tool)));
  }
  function open(game, l, opts = {}) {
    G = game || G; look = l; onDone = opts.onDone;
    ctx.clearRect(0, 0, SIZE, SIZE); undo = [];
    if (look.markImg) { const im = Sprites.markImage(look.markImg); if (im.complete) ctx.drawImage(im, 0, 0, SIZE, SIZE); }
    sync();
    $('paint').hidden = false;
    Voice.say(G.settings.reading === 'simple' ? 'Paint your own cutie mark!' : 'Paint your very own cutie mark! Pick a colour and draw with your finger.', { interrupt: true, force: true });
  }
  function close() { $('paint').hidden = true; }
  function isOpen() { return !$('paint').hidden; }
  return { init, open, close, isOpen };
})();
