/* ============================================================
   journal.js — the diary and the photo album
   ============================================================
   Every quest, place, fact, sticker and photo becomes a dated
   page.  Pages persist in the browser; photo thumbnails are
   JPEG data URLs and are the first thing dropped if storage
   runs out.
   ============================================================ */
'use strict';

const Journal = (function () {
  let G = null, entries = [];
  const KEY = 'alicorn.journal';
  const MAX = 160;

  function init(game) {
    G = game;
    load();
    Bus.on('questStart', (q) => add('quest', q.title, q.intro[0], { icon: q.icon }));
    Bus.on('questDone', (q) => add('quest', 'Done: ' + q.title, (q.done && q.done[0]) || 'Quest complete!', { icon: q.icon }));
    Bus.on('fact', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'book' }); });
    Bus.on('sticker', (st) => add('sticker', 'Sticker: ' + st.name, st.simple, { sticker: st.key }));
    Bus.on('zone', (p, z) => { if (p.id === 1) add('place', z.name, 'I went to ' + z.name + '.', { icon: 'map' }); });
    Bus.on('skyZone', (p, z) => { if (p.id === 1 && z.key !== 'sky') add('place', z.name, 'I flew up to ' + z.name + '!', { icon: z.key === 'stars' ? 'constellation' : 'cloud' }); });
    Bus.on('moonLanded', (p) => { if (p.id === 1) add('place', 'The Moon', 'I landed on the Moon!', { icon: 'moon' }); });
    Bus.on('rainbowRestored', () => add('event', 'The rainbow is back', 'All seven colours shine over Rainbow Mountain.', { icon: 'rainbow' }));
    Bus.on('party', () => add('event', 'The big party', 'All my friends came to Starlight Castle. Fireworks!', { icon: 'party' }));
    Bus.on('talk', (f, p) => { if (p && p.id === 1 && p.stats.talked.length === 1) add('event', 'My first friend', 'I met ' + f.def.name + ', ' + f.def.blurb + '.', { icon: f.def.kind }); });
  }

  function load() { try { entries = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(entries)) entries = []; } catch (e) { entries = []; } }
  function save() {
    for (let tries = 0; tries < 6; tries++) {
      try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); return; }
      catch (e) { const i = entries.findIndex(en => en.thumb); if (i >= 0) delete entries[i].thumb; else { entries.splice(0, 20); } }
    }
  }
  function add(type, title, body, extra = {}) {
    const last = entries[entries.length - 1];
    if (last && last.title === title && Date.now() - last.at < 60000) return;
    entries.push(Object.assign({ type, title: String(title), body: String(body || ''), day: G ? G.day : 1, at: Date.now() }, extra));
    if (entries.length > MAX) entries.splice(0, entries.length - MAX);
    save();
    Bus.emit('journal', entries[entries.length - 1]);
  }
  function count() { return entries.length; }
  function clear() { entries = []; save(); renderBook(); }
  function serialize() { return entries.slice(-40).map(e => Object.assign({}, e, { thumb: undefined })); }
  function restore() { /* the journal persists on its own; nothing to do */ }

  /* a photo: download the frame and file a thumbnail */
  function photo(canvas) {
    try {
      const thumb = document.createElement('canvas');
      const w = 360, h = Math.round(canvas.height / canvas.width * w);
      thumb.width = w; thumb.height = h;
      thumb.getContext('2d').drawImage(canvas, 0, 0, w, h);
      const data = thumb.toDataURL('image/jpeg', .7);
      add('photo', 'Photo', (G && G.player ? G.player.look.name : 'My alicorn') + ' in ' + (G ? G.world.placeName(G.player.x, G.player.y).name : 'the land'), { thumb: data });
      const a = document.createElement('a');
      a.download = `alicorn-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (e) { /* tainted canvas or blocked download: keep going */ }
    Bus.emit('photo');
  }

  /* file a finished picture (from the photo studio) in the diary */
  function addPhoto(canvas) {
    try {
      const thumb = document.createElement('canvas');
      const w = 360, h = Math.round(canvas.height / canvas.width * w);
      thumb.width = w; thumb.height = h; thumb.getContext('2d').drawImage(canvas, 0, 0, w, h);
      add('photo', 'Photo', (G && G.player ? G.player.look.name : 'My alicorn') + ' in ' + (G ? G.world.placeName(G.player.x, G.player.y).name : 'the land'), { thumb: thumb.toDataURL('image/jpeg', .7) });
    } catch (e) { /* fine */ }
  }

  function renderBook() {
    const list = document.getElementById('journalList');
    if (!list) return;
    list.innerHTML = '';
    if (!entries.length) { const p = document.createElement('p'); p.className = 'tiny'; p.textContent = 'Nothing here yet. Go and have an adventure!'; list.appendChild(p); return; }
    const look = G ? G.player.look : DEFAULT_LOOK;
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      const row = document.createElement('div'); row.className = 'jentry t-' + e.type;
      const ic = document.createElement('div'); ic.className = 'jicon';
      if (e.sticker) { const st = STICKERS.find(s => s.key === e.sticker); if (st) ic.appendChild(Stickers.imageEl(st, 44, false)); }
      else if (e.icon) ic.appendChild(Sprites.iconEl(e.icon, look, 44));
      row.appendChild(ic);
      const body = document.createElement('div'); body.className = 'jbody';
      const meta = document.createElement('div'); meta.className = 'jmeta'; meta.textContent = `Day ${e.day} · ${new Date(e.at).toLocaleDateString()}`;
      const h = document.createElement('h4'); h.textContent = e.title;
      const p = document.createElement('p'); p.textContent = e.body;
      body.appendChild(meta); body.appendChild(h); body.appendChild(p);
      if (e.thumb) { const img = document.createElement('img'); img.className = 'jthumb'; img.src = e.thumb; img.alt = 'photo'; body.appendChild(img); }
      row.appendChild(body);
      row.addEventListener('click', () => Voice.say(`${e.title}. ${e.body}`, { interrupt: true, force: true }));
      list.appendChild(row);
    }
  }

  return { init, add, addPhoto, count, clear, serialize, restore, photo, renderBook, entries: () => entries };
})();
