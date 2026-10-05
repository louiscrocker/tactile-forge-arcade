/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows the grub growing in grams, with each moult marked,
   then the adult's size.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'hercules.journal';
  let entries = [], growLog = [], logClock = 0;
  const MAX_ENTRIES = 200;
  const $ = (id) => document.getElementById(id);
  let G;

  function load() { try { const o = JSON.parse(localStorage.getItem(KEY) || '[]'); entries = Array.isArray(o) ? o.filter(e => e && typeof e.title === 'string') : []; } catch (e) { entries = []; } }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))); }
    catch (e) {
      for (const x of entries) delete x.thumb;
      try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))); }
      catch (e2) { if (!save.warned) { save.warned = true; Bus.emit('hint', '💾 The journal is full. Clearing it makes room.'); } }
    }
  }
  function stamp() { return { night: G.day, gen: G.generation, when: Date.now() }; }
  function add(type, title, body, extra = {}) {
    const e = Object.assign({ type, title, body }, stamp(), extra);
    entries.push(e); if (entries.length > MAX_ENTRIES) entries.shift();
    save(); Bus.emit('journal', e); return e;
  }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.hercules;
    Bus.on('hatched', () => add('milestone', 'I hatched', `A tiny ${form().name} grub, generation ${G.generation}, chewing out of the egg in a rotting log.`, { icon: 'grub1' }));
    Bus.on('molted', (p, i) => add('milestone', i === 2 ? 'My first moult' : 'My last moult', i === 2 ? `My skin got too tight, so I wriggled out of it. I weigh ${p.grams.toFixed(1)} grams.` : `Now I am a giant third-instar grub, ${p.grams.toFixed(0)} grams.`, { icon: i === 2 ? 'grub2' : 'grub3' }));
    Bus.on('fullGrown', (p) => add('milestone', 'Full grown', `I weigh ${p.grams.toFixed(0)} grams. Time to dig down and make my pupal chamber.`, { icon: 'grub3' }));
    Bus.on('pupated', (p) => add('milestone', 'I became a pupa', `In a smooth room of pressed soil. I will be a beetle ${(p.lengthMM / 10).toFixed(1)} cm long.`, { icon: 'pupa' }));
    const compare = (mm) => mm < 100 ? 'longer than your finger' : mm < 140 ? 'as long as a crayon' : mm < 165 ? 'as long as your hand' : 'longer than your hand';
    Bus.on('emerged', (p) => add('milestone', 'A beetle!', `I came out of the pupa soft and pale: a ${form().name}, ${(p.lengthMM / 10).toFixed(1)} cm from horn to tail. That is ${compare(p.lengthMM)}!`, { icon: 'beetle' }));
    Bus.on('surfaced', () => add('event', 'Out into the night', 'I dug up out of the soil into the rainforest at night.', { icon: 'moon' }));
    Bus.on('firstFlight', () => add('event', 'My first flight', 'I lifted my wing cases and buzzed up into the dark.', { icon: 'wings' }));
    Bus.on('firstFruit', (p, f) => add('event', 'Sweet fruit', `I lapped up the juice of a fallen ${FRUIT_KINDS[f.kind].name}.`, { icon: 'fruit' }));
    Bus.on('firstLift', () => add('event', 'So strong', 'I lifted a heavy stick with my horns and flipped it over.', { icon: 'stick' }));
    Bus.on('wrestleWon', (p, r) => add('event', 'I won a wrestle', `I lifted a ${(r.lengthMM / 10).toFixed(1)} cm rival in my horns and threw him off. He flew away.`, { icon: 'horn' }));
    Bus.on('wrestleLost', (p, r) => add('event', 'Flipped!', `A ${(r.lengthMM / 10).toFixed(1)} cm rival threw me off. I fluttered down and tried again.`, { icon: 'rival' }));
    Bus.on('champion', () => add('milestone', 'Champion of the forest', 'Three wrestles won. Every beetle here knows who I am.', { icon: 'champ' }));
    Bus.on('met', () => add('milestone', 'A female came', 'She has no horns. She went to the rotting log to lay her eggs.', { icon: 'female' }));
    Bus.on('coatiGone', () => { if (G.player && G.player.flags.coatiSafe) add('event', 'The coati', 'A coati sniffed at the log for grubs. I stayed deep inside and it gave up.', { icon: 'coati' }); });
    Bus.on('wetWings', () => add('weather', 'My wings went black', 'The air was damp, and my wing cases turned dark.', { icon: 'rain' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'egg') return;
    growLog.push({ t: G.time, g: p.stage === 'adult' || p.stage === 'pupa' ? null : +p.grams.toFixed(2), i: p.instar, mm: p.stage === 'adult' || p.stage === 'pupa' ? p.lengthMM : null });
    if (growLog.length > 600) growLog.shift();
  }

  function drawGraph(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = 2, W = canvas.clientWidth || 300, H = canvas.clientHeight || 120;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const pts = growLog.filter(e => e.g !== null);
    if (pts.length < 2) { ctx.fillStyle = '#8a7a66'; ctx.font = `700 12px ${UI_FONT}`; ctx.fillText('Weighing the grub…', 10, 20); return; }
    const pad = { l: 36, r: 10, t: 10, b: 20 }, t0 = pts[0].t, t1 = pts[pts.length - 1].t, top = Math.max(20, Math.ceil(Math.max(...pts.map(e => e.g)) / 20) * 20);
    const X = (t) => pad.l + (t - t0) / Math.max(1, t1 - t0) * (W - pad.l - pad.r), Y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (let v = 0; v <= top; v += top / 4) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(Math.round(v) + 'g', pad.l - 5, Y(v) + 3); }
    /* moults */
    for (let k = 1; k < pts.length; k++) if (pts[k].i !== pts[k - 1].i) { ctx.strokeStyle = 'rgba(200,120,40,.6)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('moult', X(pts[k].t), H - 6); }
    ctx.strokeStyle = '#6a3a1a'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.g); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#6a3a1a'; ctx.fillText('grub weight', pad.l + 4, pad.t + 10);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `hercules-night${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}${p.stage === 'adult' ? `, ${(p.lengthMM / 10).toFixed(1)} cm` : p.stage === 'grub' ? `, ${p.grams.toFixed(1)} g` : ''}.`, { icon: 'camera', thumb });
    Bus.emit('photo');
  }

  function renderBook() {
    const list = $('journalList'); if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple', shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Hatch, eat, grow and take photos: it all lands here.</p>'; return; }
    for (const e of shown) {
      const div = document.createElement('div'); div.className = `jentry ${e.type}`;
      const d = new Date(e.when);
      div.innerHTML = `<div class="jicon"></div><div class="jbody"><div class="jmeta"></div><h4></h4><p></p></div>`;
      div.querySelector('.jmeta').textContent = `Night ${e.night || 1} · Gen ${e.gen || 1} · ${d.toLocaleDateString()}`;
      div.querySelector('h4').textContent = e.title;
      div.querySelector('p').textContent = simple && e.simpleBody ? e.simpleBody : e.body;
      if (e.more && /^https:\/\//.test(e.more)) { const a = document.createElement('a'); a.className = 'more'; a.href = e.more; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'See the real thing ↗'; div.querySelector('.jbody').appendChild(a); }
      const icon = iconFor(e); if (icon) div.querySelector('.jicon').appendChild(icon);
      if (e.thumb && /^data:image\//.test(e.thumb)) { const img = new Image(); img.src = e.thumb; img.className = 'jthumb'; div.querySelector('.jbody').appendChild(img); }
      list.appendChild(div);
    }
  }
  function iconFor(e) {
    try {
      if (e.type === 'sticker' && e.sticker) { const st = STICKERS.find(s => s.key === e.sticker); if (st) { const c = Stickers.image(st, 44, false), out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0); out.style.width = out.style.height = '44px'; return out; } }
      if (['egg', 'grub1', 'grub2', 'grub3', 'pupa', 'beetle', 'champ', 'horn', 'rival', 'female', 'fruit', 'stick', 'coati', 'moon', 'wings', 'rain'].includes(e.icon)) { const c = Sprites.icon(e.icon, 44, G.form); c.style.width = c.style.height = '44px'; return c; }
      const span = document.createElement('span');
      span.textContent = { fact: '💡', camera: '📷', book: '📖' }[e.icon] || '📝'; span.className = 'jemoji';
      return span;
    } catch (err) { return null; }
  }
  function clear() { entries = []; save(); renderBook(); }
  function serialize() { return { growLog: growLog.slice(-300) }; }
  function restore(o) { growLog = o && Array.isArray(o.growLog) ? o.growLog.filter(e => e && Number.isFinite(e.t)) : []; }
  function dropPhotos() { let n = 0; for (const e of entries) if (e.thumb) { delete e.thumb; n++; } if (n) save(); return n; }
  function resetGrowth() { growLog = []; }

  return { init, update, add, drawGraph, photo, renderBook, clear, serialize, restore, dropPhotos, resetGrowth, entries: () => entries };
})();
