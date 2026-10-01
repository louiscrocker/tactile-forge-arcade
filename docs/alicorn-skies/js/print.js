/* ============================================================
   print.js — things to hold: a certificate, colouring pages,
              and the photo studio
   ============================================================
   Certificate: her alicorn's portrait, name, what she has done,
   signed by Professor Hoot.  Colouring pages: any sprite drawn
   big, turned into black line art by edge detection, with a
   dotted name to trace.  Photo studio: the last photo with a
   choice of frames and draggable stickers; save, print or put
   it in the diary.
   ============================================================ */
'use strict';

const Printables = (function () {
  const $ = (id) => document.getElementById(id);
  let G = null, kind = 'certificate', subject = 'me';
  const PAGE_W = 1600, PAGE_H = 1130;

  function init(game) {
    G = game;
    $('printClose').addEventListener('click', close);
    $('printKind').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { kind = b.dataset.kind; AudioFX.click(); render(); }));
    $('printSubject').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { subject = b.dataset.subject; AudioFX.click(); render(); }));
    $('printGo').addEventListener('click', () => printCanvas($('printCanvas')));
    $('printSave').addEventListener('click', () => saveCanvas($('printCanvas'), kind));
  }
  function open(game, k) { G = game || G; kind = k || 'certificate'; $('print').hidden = false; render(); }
  function close() { $('print').hidden = true; }
  function isOpen() { return !$('print').hidden; }

  function render() {
    $('printKind').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.kind === kind));
    $('printSubject').hidden = kind !== 'colouring';
    $('printSubject').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.subject === subject); if (b.dataset.subject === 'foal') b.hidden = !(G.foal && G.foal.adopted); });
    const c = $('printCanvas'); c.width = PAGE_W; c.height = PAGE_H;
    const ctx = c.getContext('2d');
    if (kind === 'certificate') certificate(ctx); else colouring(ctx);
  }

  /* ---------- the certificate ---------- */
  function certificate(ctx) {
    const look = G.player.look, W = PAGE_W, H = PAGE_H;
    ctx.fillStyle = '#fffaf2'; ctx.fillRect(0, 0, W, H);
    /* rainbow border */
    RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 10; rr(ctx, 30 + i * 10, 30 + i * 10, W - 60 - i * 20, H - 60 - i * 20, 40); ctx.stroke(); });
    ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 3; rr(ctx, 118, 118, W - 236, H - 236, 26); ctx.stroke();
    for (const [x, y] of [[150, 150], [W - 150, 150], [150, H - 150], [W - 150, H - 150]]) { ctx.fillStyle = '#ffd24a'; starPath(ctx, x, y, 26); ctx.fill(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9b6cff'; ctx.font = `900 34px ${UI_FONT}`; ctx.fillText('✦  THE LAND OF ALICORN SKIES  ✦', W / 2, 200);
    ctx.fillStyle = '#ff5f9a'; ctx.font = `900 92px ${UI_FONT}`; ctx.fillText('Certificate of Magic', W / 2, 290);
    ctx.fillStyle = '#6f5f8a'; ctx.font = `800 34px ${UI_FONT}`; ctx.fillText('This is to say that', W / 2, 370);
    ctx.fillStyle = '#3a2a55'; ctx.font = `900 110px ${UI_FONT}`; ctx.fillText(look.name, W / 2 + 130, 475);
    ctx.fillStyle = '#6f5f8a'; ctx.font = `800 34px ${UI_FONT}`;
    const title = Quests.isDone('party') ? 'is a true Alicorn Princess' : 'is a brave and kind alicorn';
    ctx.fillText(title, W / 2 + 130, 560);
    /* portrait */
    ctx.save(); ctx.translate(430, 560); ctx.fillStyle = '#f3ecff'; ctx.beginPath(); ctx.arc(0, -40, 170, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c9a5ff'; ctx.lineWidth = 6; ctx.stroke();
    ctx.scale(2.7, 2.7); ctx.translate(-4, 0); Sprites.drawAlicorn(ctx, { s: 1, look, time: 1 }); ctx.restore();
    /* achievements */
    const lines = [];
    const done = QUESTS.filter(q => Quests.isDone(q.key)).length;
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    lines.push(`⭐ ${pl(done, 'quest')} done  ·  ${pl(Stickers.count(), 'sticker')}  ·  ${pl(G.stars, 'star')}`);
    const feats = [];
    if (Quests.isDone('rainbow')) feats.push('brought back the rainbow');
    if (Quests.isDone('lamb')) feats.push('carried Puff home');
    if (Quests.isDone('ember')) feats.push('taught Ember to fly');
    if (Quests.isDone('mermaid')) feats.push('found Marina\'s pearls');
    if (G.foal && G.foal.adopted) feats.push(`looks after ${G.foal.name}`);
    if (Quests.isDone('moon')) feats.push('lit the stars');
    for (let i = 0; i < feats.length; i += 2) lines.push(feats.slice(i, i + 2).join(', ') + (i + 2 < feats.length ? ',' : ''));
    ctx.fillStyle = '#3a2a55'; ctx.font = `800 28px ${UI_FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, W / 2 + 160, 640 + i * 42));
    /* signature */
    ctx.save(); ctx.translate(W - 380, H - 250); ctx.scale(1.5, 1.5); Sprites.drawOwl(ctx, { s: 1 }); ctx.restore();
    ctx.strokeStyle = '#3a2a55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W - 700, H - 220); ctx.lineTo(W - 430, H - 220); ctx.stroke();
    ctx.font = `italic 700 38px Georgia, serif`; ctx.fillText('Professor Hoot', W - 565, H - 250);
    ctx.font = `800 24px ${UI_FONT}`; ctx.fillStyle = '#6f5f8a'; ctx.fillText(new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), 420, H - 210);
    ctx.beginPath(); ctx.moveTo(300, H - 235); ctx.lineTo(540, H - 235); ctx.stroke();
  }

  /* ---------- colouring pages: draw big, find the edges ---------- */
  function colouring(ctx) {
    const W = PAGE_W, H = PAGE_H;
    const art = document.createElement('canvas'); art.width = W; art.height = H - 200;
    const a = art.getContext('2d');
    a.fillStyle = '#fff'; a.fillRect(0, 0, art.width, art.height);
    const look = G.player.look;
    const plain = Object.assign({}, look, { body: 'snow', mane: ['white'], eyes: 'blue', markImg: look.markImg });
    let name = look.name;
    a.save();
    switch (subject) {
      case 'foal': { const f = G.foal; name = f.name; a.translate(W / 2 - 40, art.height * .62); a.scale(6.4, 6.4); Sprites.drawAlicorn(a, { s: 1, look: Object.assign({}, f.look, { body: 'snow', mane: ['white'] }), baby: f.babyK, time: 1 }); break; }
      case 'friends': { name = 'My friends'; const put = (x, y, sc, fn) => { a.save(); a.translate(x, y); a.scale(sc, sc); fn(); a.restore(); }; put(260, 600, 4, () => Sprites.drawBunny(a, { s: 1 })); put(560, 600, 3.6, () => Sprites.drawFox(a, { s: 1 })); put(860, 600, 3.8, () => Sprites.drawOwl(a, { s: 1 })); put(1180, 600, 3.4, () => Sprites.drawDragon(a, { s: 1 })); put(420, 880, 3, () => Sprites.drawSwan(a, { s: 1 })); put(820, 880, 3.3, () => Sprites.drawSheep(a, { s: 1 })); put(1200, 880, 3.2, () => Sprites.drawMermaid(a, { s: 1 })); break; }
      case 'castle': { name = 'Starlight Castle'; a.translate(W / 2, art.height * .92); a.scale(1.9, 1.9); Sprites.drawCastle(a, { x: 0, y: 0 }, 0, 0); a.restore(); a.save(); a.translate(W * .82, art.height * .9); a.scale(2.4, 2.4); Sprites.drawAlicorn(a, { s: 1, look: plain, time: 1 }); break; }
      default: { a.translate(W / 2 - 30, art.height * .6); a.scale(6.2, 6.2); Sprites.drawAlicorn(a, { s: 1, look: plain, time: 1, open: .5 }); }
    }
    a.restore();
    /* edge detection on colour + alpha → black lines */
    const img = a.getImageData(0, 0, art.width, art.height), d = img.data, w = art.width, h = art.height;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; lum[i] = r * .3 + g * .59 + b * .11 + (r - g) * .15 + (g - b) * .1; }
    const out = a.createImageData(w, h), o = out.data;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
      const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      const m = Math.hypot(gx, gy);
      const v = m > 70 ? 0 : m > 38 ? 120 : 255;
      o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v; o[i * 4 + 3] = 255;
    }
    a.putImageData(out, 0, 0);
    /* thicken the lines a touch */
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'darken';
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ctx.drawImage(art, dx, 90 + dy);
    ctx.globalCompositeOperation = 'source-over';
    /* title and a name to trace */
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3a2a55'; ctx.font = `900 54px ${UI_FONT}`; ctx.fillText('Colour me in!', W / 2, 60);
    ctx.font = `900 120px ${UI_FONT}`; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.strokeStyle = '#8a7aa8';
    ctx.strokeText(name, W / 2, H - 90); ctx.setLineDash([]);
    ctx.font = `800 24px ${UI_FONT}`; ctx.fillStyle = '#8a7aa8'; ctx.fillText('Trace the name!', W / 2, H - 20);
  }

  /* ---------- print or save a canvas ---------- */
  function printCanvas(c) {
    const url = c.toDataURL('image/png');
    const f = document.createElement('iframe'); f.style.position = 'fixed'; f.style.right = '0'; f.style.bottom = '0'; f.style.width = '0'; f.style.height = '0'; f.style.border = '0';
    document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open(); doc.write(`<html><head><title>Alicorn Skies</title><style>@page{size:landscape;margin:8mm}body{margin:0}img{width:100%;height:auto;display:block}</style></head><body><img src="${url}" onload="setTimeout(function(){window.focus();window.print();},100)"></body></html>`); doc.close();
    setTimeout(() => f.remove(), 60000);
  }
  function saveCanvas(c, name) { const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `alicorn-${name}-${Date.now()}.png`; a.click(); }

  return { init, open, close, isOpen, printCanvas, saveCanvas };
})();

/* ---------- the photo studio: frames and stickers ---------- */
const PhotoStudio = (function () {
  const $ = (id) => document.getElementById(id);
  const FRAMES = [
    { key: 'none', name: 'No frame' }, { key: 'rainbow', name: 'Rainbow' }, { key: 'stars', name: 'Stars' },
    { key: 'hearts', name: 'Hearts' }, { key: 'clouds', name: 'Clouds' }, { key: 'polaroid', name: 'Snapshot' }
  ];
  const STAMPS = ['alicorn', 'foal', 'heart', 'star', 'rainbow', 'bunny', 'dragon', 'mermaid', 'crown', 'butterfly', 'apple', 'moon'];
  let G = null, shot = null, frame = 'rainbow', stickers = [], drag = null;

  function init(game) {
    G = game;
    $('photoClose').addEventListener('click', close);
    const fr = $('photoFrames');
    for (const f of FRAMES) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = f.name; b.dataset.frame = f.key; b.addEventListener('click', () => { frame = f.key; AudioFX.click(); render(); }); fr.appendChild(b); }
    const st = $('photoStamps');
    for (const k of STAMPS) { const b = document.createElement('button'); b.className = 'stamp'; b.appendChild(Sprites.iconEl(k, G.player ? G.player.look : DEFAULT_LOOK, 44, 'stamp' + k)); b.addEventListener('click', () => { stickers.push({ k, x: .2 + Math.random() * .6, y: .25 + Math.random() * .5, s: 1 }); AudioFX.pop(); render(); }); st.appendChild(b); }
    $('photoUndo').addEventListener('click', () => { stickers.pop(); render(); });
    $('photoSave').addEventListener('click', () => { Printables.saveCanvas($('photoCanvas'), 'photo'); });
    $('photoPrint').addEventListener('click', () => Printables.printCanvas($('photoCanvas')));
    $('photoDiary').addEventListener('click', () => { Journal.addPhoto($('photoCanvas')); AudioFX.buy(); Voice.say('It is in your diary!', { interrupt: true, force: true }); close(); });
    const c = $('photoCanvas');
    const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    c.addEventListener('pointerdown', (e) => { const [x, y] = pos(e); for (let i = stickers.length - 1; i >= 0; i--) { const s = stickers[i]; if (Math.hypot((s.x - x) * 1.6, s.y - y) < .08 * s.s) { drag = { s, dx: s.x - x, dy: s.y - y }; c.setPointerCapture(e.pointerId); return; } } });
    c.addEventListener('pointermove', (e) => { if (!drag) return; const [x, y] = pos(e); drag.s.x = x + drag.dx; drag.s.y = y + drag.dy; render(); });
    c.addEventListener('pointerup', () => { drag = null; });
  }
  function open(game, canvas) {
    G = game || G;
    shot = document.createElement('canvas'); shot.width = canvas.width; shot.height = canvas.height; shot.getContext('2d').drawImage(canvas, 0, 0);
    stickers = []; render(); $('photoStudio').hidden = false;
  }
  function close() { $('photoStudio').hidden = true; }
  function isOpen() { return !$('photoStudio').hidden; }

  function render() {
    $('photoFrames').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.frame === frame));
    const c = $('photoCanvas'); const W = 1280, H = Math.round(W * shot.height / shot.width);
    c.width = W; c.height = H + (frame === 'polaroid' ? 150 : 0);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    const pad = frame === 'none' ? 0 : frame === 'polaroid' ? 40 : 46;
    ctx.drawImage(shot, pad, pad, W - pad * 2, H - pad * 2 + (frame === 'polaroid' ? 40 : 0));
    ctx.save();
    if (frame === 'rainbow') RAINBOW.forEach((col, i) => { ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.strokeRect(3 + i * 6.5, 3 + i * 6.5, W - 6 - i * 13, H - 6 - i * 13); });
    else if (frame === 'stars') { ctx.fillStyle = '#3a2a70'; ctx.fillRect(0, 0, W, pad); ctx.fillRect(0, H - pad, W, pad); ctx.fillRect(0, 0, pad, H); ctx.fillRect(W - pad, 0, pad, H); for (let i = 0; i < 60; i++) { const t = i / 60 * 2 * (W + H); let x, y; if (t < W) { x = t; y = pad / 2; } else if (t < W + H) { x = W - pad / 2; y = t - W; } else if (t < 2 * W + H) { x = 2 * W + H - t; y = H - pad / 2; } else { x = pad / 2; y = 2 * (W + H) - t; } ctx.fillStyle = i % 3 ? '#ffe14a' : '#fff'; starPath(ctx, x, y, i % 2 ? 11 : 7); ctx.fill(); } }
    else if (frame === 'hearts') { ctx.fillStyle = '#ffd6ea'; ctx.fillRect(0, 0, W, pad); ctx.fillRect(0, H - pad, W, pad); ctx.fillRect(0, 0, pad, H); ctx.fillRect(W - pad, 0, pad, H); for (let x = pad / 2; x < W; x += 52) for (const y of [pad / 2, H - pad / 2]) { ctx.fillStyle = (x / 52 | 0) % 2 ? '#ff5f9a' : '#ff9ad4'; heartPath(ctx, x, y, 14); ctx.fill(); } for (let y = pad / 2 + 52; y < H - 40; y += 52) for (const x of [pad / 2, W - pad / 2]) { ctx.fillStyle = '#ff7ab6'; heartPath(ctx, x, y, 14); ctx.fill(); } }
    else if (frame === 'clouds') { ctx.fillStyle = '#fff'; for (let x = 0; x < W; x += 60) for (const y of [0, H]) { ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.fill(); } for (let y = 0; y < H; y += 60) for (const x of [0, W]) { ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.fill(); } }
    else if (frame === 'polaroid') { ctx.fillStyle = '#3a2a55'; ctx.font = `900 56px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText(`${G.player.look.name} ♥`, W / 2, H + 75); ctx.font = `700 26px ${UI_FONT}`; ctx.fillStyle = '#8a7aa8'; ctx.fillText(new Date().toLocaleDateString(), W / 2, H + 120); }
    ctx.restore();
    for (const s of stickers) { const px = 150 * s.s; ctx.drawImage(Sprites.icon(s.k, G.player.look, 100, 'stamp' + s.k), s.x * W - px / 2, s.y * c.height - px / 2, px, px); }
  }
  return { init, open, close, isOpen };
})();
