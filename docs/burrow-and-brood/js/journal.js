/* ============================================================
   journal.js — the field journal, photos and the colony graph
   ============================================================
   Every milestone, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph logs the colony's size (on a log scale, so one queen and
   five thousand ants fit on the same chart) and its food.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'antkingdom.journal';
  let entries = [];
  let popLog = [];              // [{ t, pop, food, honey, brood }]
  let logClock = 0;
  const MAX_ENTRIES = 200;
  const $ = (id) => document.getElementById(id);
  let G;

  function load() { try { entries = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { entries = []; } }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))); }
    catch (e) { const i = entries.findIndex(x => x.thumb); if (i >= 0) { delete entries[i].thumb; try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch (e2) { /* give up */ } } }
  }
  function stamp() { const w = G.world; return { day: G.day, season: w.season, year: w.year, gen: G.generation, when: Date.now() }; }
  function add(type, title, body, extra = {}) {
    const e = Object.assign({ type, title, body }, stamp(), extra);
    entries.push(e);
    if (entries.length > MAX_ENTRIES) entries.shift();
    save();
    Bus.emit('journal', e);
    return e;
  }

  function init(game) {
    G = game;
    load();
    const sp = () => G.speciesDef();
    Bus.on('landed', (p) => { if (p.caste === 'queen') add('milestone', 'I landed', `A young ${sp().name} queen. Generation ${G.generation}. I pulled off my wings: I will never fly again.`, { icon: 'queen' }); });
    Bus.on('founded', () => add('milestone', 'I dug my first room', 'Deep enough to be safe. This little room is where the kingdom starts.', { icon: 'room' }));
    Bus.on('eggsLaid', () => add('milestone', 'My first eggs', 'Five tiny white eggs, a little sticky, on the floor of my room.', { icon: 'egg' }));
    Bus.on('milestone', (k) => {
      const T = {
        larvae: ['The eggs hatched', 'Legless white larvae. I feed them from my own body.', 'larva'],
        cocoon: ['The first cocoon', 'A big larva spun a silk cocoon. Something is changing inside.', 'pupa'],
        worker: ['The first worker!', 'A small, pale worker came out of her cocoon. She is my daughter, and from now on the workers do the work.', 'worker'],
        ten: ['Ten ants', 'Ten of us now. Every ant has a job.', 'ten'],
        hundred: ['One hundred ants', 'Nurses, diggers, foragers, farmers and guards. Nobody is in charge.', 'hundred'],
        thousand: ['One thousand ants', 'The ant hill is big and the tunnels go deep.', 'thousand'],
        kingdom: ['An ant kingdom', 'Five thousand ants. It is time to raise new queens with wings.', 'kingdom']
      }[k];
      if (T) add('milestone', T[0], T[1], { icon: T[2] });
    });
    Bus.on('roomDug', (r) => add('event', { nursery: 'A new nursery', pantry: 'A new food room', winter: 'A deep winter room' }[r.kind] || 'A new room', `Dug ${Math.round(r.y)} ant-steps down.`, { icon: 'room' }));
    Bus.on('enemyShooed', () => add('event', 'Chased off a ladybug larva', 'It was eating our aphids. We bit it until it let go of the plant.', { icon: 'ladylarva' }));
    Bus.on('bigFood', (f, n) => add('event', 'We carried a beetle', `${n} ants carried it together and cut it up at the door.`, { icon: 'bug' }));
    Bus.on('flightDone', () => add('milestone', 'Flying ant day!', 'The princesses and the males flew out of the ant hill to start new kingdoms.', { icon: 'alate' }));
    Bus.on('colonyWinter', () => add('season', 'Winter rest', 'Everyone went deep down to wait for spring.', { icon: 'winter' }));
    Bus.on('colonySpring', () => add('season', 'Spring!', 'The doors are open again and the queen is laying.', { icon: 'spring' }));
    Bus.on('season', (s) => { if (s !== 'winter' && s !== 'spring') add('season', `${SEASON_INFO[s].name} arrived`, SEASON_INFO[s].blurb, { icon: s }); });
    Bus.on('weather', (w) => { if (w === 'rain') add('weather', 'It rained', 'Water trickled into the tunnels. It ran through the sand and sat on the clay.', { icon: 'rain' }); });
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt;
    if (logClock > 0) return;
    logClock = 3;
    const C = G.colony;
    popLog.push({ t: G.time, pop: C.ants(), food: C.food, honey: C.honey, brood: C.brood.reduce((n, b) => n + b.rep, 0) });
    if (popLog.length > 400) popLog.shift();
  }

  function drawGraph(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = 2, W = canvas.clientWidth || 300, H = canvas.clientHeight || 120;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (popLog.length < 2) { ctx.fillStyle = '#8a7a66'; ctx.font = `700 12px ${UI_FONT}`; ctx.fillText('Counting the ants…', 10, 20); return; }
    const pad = { l: 40, r: 10, t: 10, b: 20 };
    const t0 = popLog[0].t, t1 = popLog[popLog.length - 1].t;
    const maxP = Math.max(10, ...popLog.map(p => p.pop, 0));
    const top = Math.pow(10, Math.ceil(Math.log10(maxP * 1.2)));
    const X = (t) => pad.l + (t - t0) / Math.max(1, t1 - t0) * (W - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - Math.log10(Math.max(1, v)) / Math.log10(top)) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1;
    ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (let v = 1; v <= top; v *= 10) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(fmtInt(v), pad.l - 6, Y(v) + 3); }
    /* food in the store (dashed, gold) */
    ctx.strokeStyle = '#d9a020'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
    ctx.beginPath(); popLog.forEach((e, k) => { const x = X(e.t), y = Y(e.food + 1); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.setLineDash([]);
    /* ants, bold */
    ctx.strokeStyle = '#6a3a1a'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); popLog.forEach((e, k) => { const x = X(e.t), y = Y(e.pop); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#6a3a1a'; ctx.fillText('ants', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#d9a020'; ctx.fillText('food stored', pad.l + 36, pad.t + 10);
    ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right'; ctx.fillText(`last ${Math.max(1, Math.round((t1 - t0) / 60))} min`, W - pad.r, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `burrow-and-brood-day${G.day}-${G.world.season}.png`;
    try {
      src.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }, 'image/png');
    } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas');
    const tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh;
    th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null;
    try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${p.caste === 'queen' ? 'The queen' : 'A worker'}, ${fmtInt(G.colony.ants())} ants, ${G.world.season}, day ${G.day}.`, { icon: 'camera', thumb });
    Bus.emit('photo');
  }

  function renderBook() {
    const list = $('journalList');
    if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple';
    const shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Land, dig, lay eggs and take photos: it all lands here.</p>'; return; }
    for (const e of shown) {
      const div = document.createElement('div');
      div.className = `jentry ${e.type}`;
      const d = new Date(e.when);
      div.innerHTML = `<div class="jicon"></div><div class="jbody"><div class="jmeta">Day ${e.day} · ${SEASON_INFO[e.season] ? SEASON_INFO[e.season].name : ''} · Gen ${e.gen} · ${d.toLocaleDateString()}</div><h4></h4><p></p></div>`;
      div.querySelector('h4').textContent = e.title;
      div.querySelector('p').textContent = simple && e.simpleBody ? e.simpleBody : e.body;
      if (e.more && /^https:\/\//.test(e.more)) { const a = document.createElement('a'); a.className = 'more'; a.href = e.more; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'See the real thing ↗'; div.querySelector('.jbody').appendChild(a); }
      const icon = iconFor(e);
      if (icon) div.querySelector('.jicon').appendChild(icon);
      if (e.thumb && /^data:image\//.test(e.thumb)) { const img = new Image(); img.src = e.thumb; img.className = 'jthumb'; div.querySelector('.jbody').appendChild(img); }
      list.appendChild(div);
    }
  }
  function iconFor(e) {
    try {
      if (e.type === 'sticker' && e.sticker) { const st = STICKERS.find(s => s.key === e.sticker); if (st) { const c = Stickers.image(st, 44, false); const out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0); out.style.width = out.style.height = '44px'; return out; } }
      if (['queen', 'alate', 'worker', 'egg', 'larva', 'pupa', 'ten', 'hundred', 'thousand', 'kingdom', 'ladylarva', 'bug'].includes(e.icon)) { const c = Sprites.icon(e.icon, G.speciesDef(), 44); c.style.width = c.style.height = '44px'; return c; }
      const span = document.createElement('span');
      span.textContent = { room: '🕳️', rain: '🌧️', snow: '❄️', spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️', fact: '💡', camera: '📷', book: '📖' }[e.icon] || '📝';
      span.className = 'jemoji';
      return span;
    } catch (err) { return null; }
  }

  function clear() { entries = []; save(); renderBook(); }
  function count() { return entries.length; }
  function serialize() { return { popLog: popLog.slice(-200) }; }
  function restore(o) { popLog = o && Array.isArray(o.popLog) ? o.popLog.filter(e => e && Number.isFinite(e.t) && Number.isFinite(e.pop)) : []; }
  /* storage full: keep the pages, drop every photo thumbnail */
  function dropPhotos() { let n = 0; for (const e of entries) if (e.thumb) { delete e.thumb; n++; } if (n) save(); return n; }

  return { init, update, add, drawGraph, photo, renderBook, clear, count, serialize, restore, dropPhotos, entries: () => entries };
})();
