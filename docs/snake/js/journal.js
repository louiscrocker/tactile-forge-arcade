/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how long you are in centimetres, from a newborn of
   about 18 cm to a grown-up of about 60; every shed is marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'snake.journal';
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
  /* how long the player is, in centimetres, nose to tail */
  function sizeCM(p) { return p.stage === 'sac' ? 17 : p.cm; }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.eastern;
    const cm = (p) => p.cm.toFixed(0);
    Bus.on('born', () => add('milestone', 'Born!', `Generation ${G.generation}: a ${form().name.toLowerCase()}, born in late summer in a thin clear bag, with a whole litter of brothers and sisters. I wiggled out and flicked my tongue.`, { icon: 'sac' }));
    Bus.on('ateSnack', (p) => { if (p.stats.snacks === 1) add('event', 'My first snack', 'I flicked my tongue, smelled a snack, found it and ate it. Then I basked to warm my tummy.', { icon: 'snack' }); });
    Bus.on('basking', () => add('event', 'Basking', 'I lay coiled in the sunshine and felt myself warm up.', { icon: 'bask' }));
    Bus.on('chilled', () => add('event', 'Too cold!', 'I got so cold I could hardly move, so I curled up and waited for the warm sun.', { icon: 'snow' }));
    Bus.on('blue', () => add('event', 'Blue eyes', 'My eyes went cloudy blue. A new skin is growing under my old one. I hid and rested.', { icon: 'blueeye' }));
    Bus.on('shed', (p, i) => add('milestone', i >= 4 ? 'Grown up!' : `A new skin (shed ${p.stats.sheds})`, i >= 4 ? `My last big shed of growing up. I am ${cm(p)} cm long.` : `I rubbed my nose on something rough and crawled right out of my old skin. I am ${cm(p)} cm long.`, { icon: i >= 4 ? 'adult' : 'shed' }));
    Bus.on('lookedShed', (p, e) => add('event', 'My old skin', `My old skin is about ${(e.len / Math.max(1, p.len) * p.cm).toFixed(0)} cm long: longer than me! I could see the eye caps and every scale.`, { icon: 'shed' }));
    Bus.on('dodged', (p, h) => { if (h && h.state === 'dive') add('event', 'A hawk!', 'A red-tailed hawk circled and swooped, but it missed. My stripes fooled it.', { icon: 'hawk' }); });
    Bus.on('musk', () => add('event', 'Pee-yew!', 'A raccoon came poking about. I made my stinky musk and it walked away.', { icon: 'raccoon' }));
    Bus.on('swimStart', () => add('event', 'Swimming', 'I swam in the pond with my head held up.', { icon: 'swim' }));
    Bus.on('putBack', (p) => add('event', 'Measured!', `A snake scientist lifted her coverboard, measured me (${cm(p)} cm) and put me gently back.`, { icon: 'measure' }));
    Bus.on('autumn', () => add('milestone', 'Autumn', 'The days are getting cool. The big snakes are following their scent trails to the winter den.', { icon: 'leaf' }));
    Bus.on('winterStart', () => add('milestone', 'Winter in the den', 'I crawled down the crack in the rock, below the frost line, and curled up with the other snakes.', { icon: 'winter' }));
    Bus.on('emerged', (p) => add('milestone', 'Spring!', `I crawled up out of the den into the spring sunshine. I am ${cm(p)} cm long.`, { icon: 'spring' }));
    Bus.on('raceLost', () => add('event', 'Another boy got there first', "I followed a girl's trail, but another boy found her first. I tried again.", { icon: 'trail' }));
    Bus.on('met', (p) => add('milestone', p.sex === 'boy' ? 'I found her!' : 'Hello!', p.sex === 'boy' ? 'I followed her scent trail and found her first.' : 'I met a boy snake by the den in the spring sunshine.', { icon: 'heart' }));
    Bus.on('babiesReady', () => add('milestone', 'All summer long', 'I basked all summer to keep my babies warm. Now they are ready.', { icon: 'girl' }));
    Bus.on('litterBorn', (p) => add('milestone', 'A new litter!', `Under cover in late summer, I had ${p.stats.babies} babies. They wiggled out of their bags and slithered off.`, { icon: 'babies' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'sac') return;
    growLog.push({ t: G.time, cm: +sizeCM(p).toFixed(2), k: 's' + p.instar });
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
    const Y = (cm) => pad.t + (1 - clamp(cm, 0, 70) / 70) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const v of [0, 20, 40, 60]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(v + ' cm', pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,80,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#3a8a3a'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.cm); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#3a8a3a'; ctx.fillText('how long I am', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = sheds', W - 60, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `garter-snake-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}${p.stage === 'snake' ? `, ${p.cm.toFixed(0)} cm` : ''}.`, { icon: 'camera', thumb });
    Bus.emit('photo');
  }

  function renderBook() {
    const list = $('journalList'); if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple', shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Wiggle out, flick, bask, shed and take photos: it all lands here.</p>'; return; }
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
  const ICONS = ['sac', 'snake', 'baby', 'newborn', 'young', 'adult', 'girl', 'boy', 'babies', 'snack', 'bask', 'snow', 'blueeye', 'shed', 'hawk', 'raccoon', 'swim', 'measure', 'leaf', 'winter', 'spring', 'trail', 'heart', 'coil', 'den', 'frog', 'heron', 'sun', 'moon', 'rock', 'log', 'board', 'tongue', 'scales', 'firefly'];
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
  function restore(o) { growLog = o && Array.isArray(o.growLog) ? o.growLog.filter(e => e && Number.isFinite(e.t) && Number.isFinite(e.cm)) : []; }
  function dropPhotos() { let n = 0; for (const e of entries) if (e.thumb) { delete e.thumb; n++; } if (n) save(); return n; }
  function resetGrowth() { growLog = []; }

  return { init, update, add, drawGraph, photo, renderBook, clear, serialize, restore, dropPhotos, resetGrowth, sizeCM, entries: () => entries };
})();
