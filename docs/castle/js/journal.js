/* ============================================================
   journal.js — the castle chronicle: dated pages and portraits
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   chronicle, which persists in the browser (key `castle.journal`)
   and prints nicely.  The graph shows how the castle grew: stones
   laid and rooms made, day by day.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'castle.journal';
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
      catch (e2) { if (!save.warned) { save.warned = true; Bus.emit('hint', '💾 The chronicle is full. Clearing it makes room.'); } }
    }
  }
  function stamp() { return { day: G.day, when: Date.now(), castle: G.castleName || '' }; }
  function add(type, title, body, extra = {}) {
    const e = Object.assign({ type, title, body }, stamp(), extra);
    entries.push(e); if (entries.length > MAX_ENTRIES) entries.shift();
    save(); Bus.emit('journal', e); return e;
  }

  function init(game) {
    G = game; load();
    const royal = () => ROYALS[G.sex] ? ROYALS[G.sex].name : 'Princess';
    Bus.on('castleStarted', () => add('milestone', `${G.castleName || 'A new castle'}`, `Day 1. The ${royal()} stands on the plot and draws the first plans.`, { icon: G.sex === 'prince' ? 'prince' : 'princess' }));
    Bus.on('roomMade', (c, n) => { if (n === 1) add('milestone', 'The first room', 'Four walls, a floor and a ceiling: the first room of the castle is closed in.', { icon: 'room' }); });
    Bus.on('roomNamed', (c, room, type) => add('event', `A ${ROOM_TYPES[type].name.toLowerCase()}`, `A room ${room.w} by ${room.h} is now the ${ROOM_TYPES[type].name.toLowerCase()}.`, { icon: ROOM_TYPES[type].icon }));
    Bus.on('questDone', (c, q, coins) => add('milestone', `Quest: ${q.title}`, `${q.text} Done! The treasury gains ${coins} coins.`, { icon: q.icon }));
    Bus.on('horseCame', (h) => add('event', 'A horse arrives', 'A horse trotted over the drawbridge and into its new stall.', { icon: 'horse' }));
    Bus.on('arrived', (p, role) => { if (role === 'knight' && !init.knightNoted) { init.knightNoted = true; add('event', 'The first knight', 'A knight has come to guard the battlements.', { icon: 'knight' }); } if (role === 'king') add('event', 'The king and queen', 'The royal family has moved into the throne room.', { icon: 'crown' }); });
    Bus.on('feast', () => add('event', 'A feast', 'Everyone sat down at the long table in the great hall as the sun went down.', { icon: 'feast' }));
    Bus.on('joustDone', (J) => add('event', 'Tournament day', `Two knights jousted in the courtyard: ${J.score[0]} taps to ${J.score[1]}. Both bowed and nobody was hurt.`, { icon: 'joust' }));
    Bus.on('visitor', () => add('event', 'A royal visit', 'A carriage came over the drawbridge with a royal visitor inside.', { icon: 'carriage' }));
    Bus.on('market', () => add('event', 'Market day', 'Traders came to the courtyard with their trays.', { icon: 'market' }));
    Bus.on('dragon', () => add('milestone', 'The dragon', 'A friendly dragon landed on the tallest tower and puffed sparkles.', { icon: 'dragon' }));
    Bus.on('fireworks', () => add('event', 'Fireworks', 'Fireworks burst over the castle in the night.', { icon: 'fireworks' }));
    Bus.on('snowfall', () => add('event', 'Snow', 'Snow fell on the battlements.', { icon: 'snow' }));
    Bus.on('season', (s) => { if (G.day > 1) add('event', SEASON_INFO[s][0].slice(3) + ' comes', `A new season begins on day ${G.day}.`, { icon: s === 'winter' ? 'snow' : s === 'summer' ? 'sun' : 'appletree' }); });
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact' }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 3;
    const c = G.castle; if (!c) return;
    growLog.push({ t: G.time, stones: c.stats.stones, rooms: c.rooms().filter(r => !r.tiny).length, items: c.items.length });
    if (growLog.length > 600) growLog.shift();
  }

  function drawGraph(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = 2, W = canvas.clientWidth || 300, H = canvas.clientHeight || 120;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const pts = growLog;
    if (pts.length < 2) { ctx.fillStyle = '#8a7a66'; ctx.font = `700 12px ${UI_FONT}`; ctx.fillText('Building…', 10, 20); return; }
    const pad = { l: 36, r: 10, t: 10, b: 20 }, t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const X = (t) => pad.l + (t - t0) / Math.max(1, t1 - t0) * (W - pad.l - pad.r);
    const maxS = Math.max(10, ...pts.map(p => p.stones)), maxR = Math.max(4, ...pts.map(p => Math.max(p.rooms, p.items)));
    const Y = (v, m) => pad.t + (1 - v / m) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; for (let k = 0; k <= 4; k++) { const y = pad.t + k * (H - pad.t - pad.b) / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); }
    const lineOf = (key, m, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e[key], m); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
    lineOf('stones', maxS, '#8a857c'); lineOf('items', maxR, '#c87828'); lineOf('rooms', maxR, '#2a6ab0');
    ctx.font = `700 10px ${UI_FONT}`; ctx.textAlign = 'left';
    ctx.fillStyle = '#8a857c'; ctx.fillText(`stones (${pts[pts.length - 1].stones})`, pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#2a6ab0'; ctx.fillText(`rooms (${pts[pts.length - 1].rooms})`, pad.l + 4, pad.t + 22);
    ctx.fillStyle = '#c87828'; ctx.fillText(`furniture (${pts[pts.length - 1].items})`, pad.l + 4, pad.t + 34);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `${(G.castleName || 'castle').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const c = G.castle, S = c ? c.summary() : null;
    add('photo', 'Castle portrait', S ? `${G.castleName || 'The castle'} on day ${G.day}: ${S.stones} stones, ${S.rooms} rooms, ${S.furniture} things inside.` : 'A portrait.', { icon: 'camera', thumb });
    if (c) c.stats.photos++;
    Bus.emit('photo');
  }

  function renderBook() {
    const list = $('journalList'); if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple', shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Build, name rooms, finish quests and take portraits: it all lands here.</p>'; return; }
    for (const e of shown) {
      const div = document.createElement('div'); div.className = `jentry ${e.type}`;
      const d = new Date(e.when);
      div.innerHTML = `<div class="jicon"></div><div class="jbody"><div class="jmeta"></div><h4></h4><p></p></div>`;
      div.querySelector('.jmeta').textContent = `Day ${e.day || 1}${e.castle ? ' · ' + e.castle : ''} · ${d.toLocaleDateString()}`;
      div.querySelector('h4').textContent = e.title;
      div.querySelector('p').textContent = simple && e.simpleBody ? e.simpleBody : e.body;
      const icon = iconFor(e); if (icon) div.querySelector('.jicon').appendChild(icon);
      if (e.thumb && /^data:image\//.test(e.thumb)) { const img = new Image(); img.src = e.thumb; img.className = 'jthumb'; div.querySelector('.jbody').appendChild(img); }
      list.appendChild(div);
    }
  }
  function iconFor(e) {
    try {
      if (e.type === 'sticker' && e.sticker) { const st = STICKERS.find(s => s.key === e.sticker); if (st) { const c = Stickers.image(st, 44, false), out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0); out.style.width = out.style.height = '44px'; return out; } }
      if (e.icon && e.icon !== 'fact' && e.icon !== 'camera' && e.icon !== 'book') { const c = Sprites.icon(e.icon, 44); c.style.width = c.style.height = '44px'; return c; }
      const span = document.createElement('span');
      span.textContent = { fact: '💡', camera: '📷', book: '📖' }[e.icon] || '📝'; span.className = 'jemoji';
      return span;
    } catch (err) { return null; }
  }
  function clear() { entries = []; save(); renderBook(); }
  function serialize() { return { growLog: growLog.slice(-300) }; }
  function restore(o) { growLog = o && Array.isArray(o.growLog) ? o.growLog.filter(e => e && Number.isFinite(e.t) && Number.isFinite(e.stones)) : []; }
  function dropPhotos() { let n = 0; for (const e of entries) if (e.thumb) { delete e.thumb; n++; } if (n) save(); return n; }
  function resetGrowth() { growLog = []; }

  return { init, update, add, drawGraph, photo, renderBook, clear, serialize, restore, dropPhotos, resetGrowth, entries: () => entries };
})();
