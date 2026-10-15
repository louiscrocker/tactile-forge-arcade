/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how long you are in millimetres on a "times ten"
   scale (0.1 mm, 1 mm, 10 mm), so a tiny egg and a grown copepod
   fit on one page; every moult is marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'plankton.journal';
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
  function stamp() { return { day: G.day, gen: G.generation, when: Date.now() }; }
  function add(type, title, body, extra = {}) {
    const e = Object.assign({ type, title, body }, stamp(), extra);
    entries.push(e); if (entries.length > MAX_ENTRIES) entries.shift();
    save(); Bus.emit('journal', e); return e;
  }
  /* how long the player is, in millimetres (head to tail; an egg across) */
  function sizeMM(p) { return p.mm; }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.red;
    const mm = (p) => p.mm.toFixed(2);
    Bus.on('hatched', () => add('milestone', 'I hatched', `Generation ${G.generation}: a ${form().name.toLowerCase()} egg, let go into the spring sea by my mother. Now I am a nauplius with one red eye.`, { icon: 'nauplius' }));
    Bus.on('molted', (p, step) => {
      if (step === 7) add('milestone', 'A copepod at last!', `My sixth moult. Now I have a long body, a tail and long feelers. I am ${mm(p)} mm long.`, { icon: 'copepodite' });
      else if (step === 11) add('milestone', 'Stage V', 'Time to eat and fill my oil sac for the long sleep.', { icon: 'oil' });
      else if (step === 12) add('milestone', 'Grown up!', `My eleventh and last moult, in the deep in winter. I am ${mm(p)} mm long.`, { icon: 'adult' });
      else add('milestone', `${STEP_NAME[step]}`, `Moult number ${p.stats.molts}: out of my old skin and bigger. I am ${mm(p)} mm long.`, { icon: step <= 6 ? 'nauplius' : 'copepodite' });
    });
    Bus.on('canEat', () => add('event', 'My first meal', 'My yolk was used up, so I ate my first diatom: a tiny plant in a glass case.', { icon: 'diatom' }));
    Bus.on('glow', (p) => { if (p.stats.glow === 1) add('event', 'The glowing sea', 'At night I bumped a dinoflagellate and it flashed blue.', { icon: 'dino' }); });
    Bus.on('schoolGone', () => { if (!init.herring) { init.herring = true; add('event', 'Herring!', 'A silver school of herring swept through the light. I kicked my legs and jumped.', { icon: 'herring' }); } });
    Bus.on('sharkPassed', () => add('event', 'A basking shark!', 'The second biggest fish in the world swam past with its huge mouth open, straining plankton.', { icon: 'basking' }));
    Bus.on('whalePassed', () => add('event', 'A right whale!', 'One of the rarest whales on Earth swam through our cloud of copepods with its mouth open. I jumped out of the way.', { icon: 'whale' }));
    Bus.on('oilFull', () => add('milestone', 'Full of oil', 'My oil sac is full. Time to sink down to the deep.', { icon: 'oil' }));
    Bus.on('sleepStart', () => add('milestone', 'The long sleep', 'I sank into the deep, cold, dark water and went to sleep. Marine snow drifted past.', { icon: 'sleep' }));
    Bus.on('woke', () => add('milestone', 'Wake up!', 'It is winter. Months have gone by, and my oil sac is smaller. Time for my last moult.', { icon: 'sleep' }));
    Bus.on('met', (p) => add('milestone', p.sex === 'boy' ? 'I followed her trail' : 'He found my trail', p.sex === 'boy' ? 'I smelled a girl\'s scent trail and followed it, zig-zag, until I found her.' : 'A boy smelled the scent trail I left and followed it to find me.', { icon: 'trail' }));
    Bus.on('eggsLaid', (p) => add('milestone', 'My eggs are free!', `In the spring bloom I let ${fmtInt(p.stats.eggsOut)} eggs go into the sea, a clutch at a time.`, { icon: 'eggs' }));
    Bus.on('generationDone', (p) => { if (p.sex === 'boy') add('milestone', 'The next spring', 'In the spring bloom the girl I met let her eggs go into the green sea.', { icon: 'eggs' }); });
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'egg') return;
    const k = 's' + p.step;
    growLog.push({ t: G.time, mm: +sizeMM(p).toFixed(2), k });
    if (growLog.length > 600) growLog.shift();
  }

  function drawGraph(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = 2, W = canvas.clientWidth || 300, H = canvas.clientHeight || 120;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const pts = growLog;
    if (pts.length < 2) { ctx.fillStyle = '#8a7a66'; ctx.font = `700 12px ${UI_FONT}`; ctx.fillText('Measuring…', 10, 20); return; }
    const pad = { l: 44, r: 10, t: 10, b: 20 }, t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const X = (t) => pad.l + (t - t0) / Math.max(1, t1 - t0) * (W - pad.l - pad.r);
    const Y = (mm) => pad.t + (1 - (Math.log10(clamp(mm, .1, 10)) + 1) / 2) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const [v, l] of [[.1, '0.1 mm'], [1, '1 mm'], [10, '1 cm']]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(l, pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,80,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#2a6ab0'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.mm); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#2a6ab0'; ctx.fillText('how long I am', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = moults', W - 60, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `copepod-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STEP_NAME[p.step]}, ${p.mm.toFixed(2)} mm.`, { icon: 'camera', thumb });
    Bus.emit('photo');
  }

  function renderBook() {
    const list = $('journalList'); if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple', shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Hatch, swim, grow and take photos: it all lands here.</p>'; return; }
    for (const e of shown) {
      const div = document.createElement('div'); div.className = `jentry ${e.type}`;
      const d = new Date(e.when);
      div.innerHTML = `<div class="jicon"></div><div class="jbody"><div class="jmeta"></div><h4></h4><p></p></div>`;
      div.querySelector('.jmeta').textContent = `Day ${e.day || 1} · Gen ${e.gen || 1} · ${d.toLocaleDateString()}`;
      div.querySelector('h4').textContent = e.title;
      div.querySelector('p').textContent = simple && e.simpleBody ? e.simpleBody : e.body;
      if (e.more && /^https:\/\//.test(e.more)) { const a = document.createElement('a'); a.className = 'more'; a.href = e.more; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'See the real thing ↗'; div.querySelector('.jbody').appendChild(a); }
      const icon = iconFor(e); if (icon) div.querySelector('.jicon').appendChild(icon);
      if (e.thumb && /^data:image\//.test(e.thumb)) { const img = new Image(); img.src = e.thumb; img.className = 'jthumb'; div.querySelector('.jbody').appendChild(img); }
      list.appendChild(div);
    }
  }
  const ICONS = ['egg', 'eggs', 'nauplius', 'copepodite', 'copepod', 'stage5', 'adult', 'boy', 'girl', 'diatom', 'dino', 'oil', 'sleep', 'trail', 'herring', 'basking', 'whale', 'deep', 'snow', 'moon', 'skin'];
  function iconFor(e) {
    try {
      if (e.type === 'sticker' && e.sticker) { const st = STICKERS.find(s => s.key === e.sticker); if (st) { const c = Stickers.image(st, 44, false), out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0); out.style.width = out.style.height = '44px'; return out; } }
      if (ICONS.includes(e.icon)) { const c = Sprites.icon(e.icon, 44, G.form); c.style.width = c.style.height = '44px'; return c; }
      const span = document.createElement('span');
      span.textContent = { fact: '💡', camera: '📷', book: '📖' }[e.icon] || '📝'; span.className = 'jemoji';
      return span;
    } catch (err) { return null; }
  }
  function clear() { entries = []; save(); renderBook(); }
  function serialize() { return { growLog: growLog.slice(-300) }; }
  function restore(o) { growLog = o && Array.isArray(o.growLog) ? o.growLog.filter(e => e && Number.isFinite(e.t) && Number.isFinite(e.mm)) : []; }
  function dropPhotos() { let n = 0; for (const e of entries) if (e.thumb) { delete e.thumb; n++; } if (n) save(); return n; }
  function resetGrowth() { growLog = []; }

  return { init, update, add, drawGraph, photo, renderBook, clear, serialize, restore, dropPhotos, resetGrowth, sizeMM, entries: () => entries };
})();
