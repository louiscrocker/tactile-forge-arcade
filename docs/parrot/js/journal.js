/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows the parrot growing in centimetres, with each new
   coat of feathers marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'parrot.journal';
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
    const form = () => FORMS[G.form] || FORMS.boy;
    Bus.on('hatched', () => add('milestone', 'Out of the egg', `A tiny ${form().name} chick, generation ${G.generation}, pink and bare, in a hollow high in an old ironwood tree.`, { icon: 'chick' }));
    Bus.on('named', (p, seq) => add('milestone', 'My name', 'Mom and Dad gave me a call of my own. It is my name: ' + seq.map(n => ({ up: '↑', right: '→', down: '↓', left: '←' })[n]).join(' ') + '.', { icon: 'call' }));
    Bus.on('grew', (p, i) => add('milestone', ['', 'My eyes are open', 'Red feathers', 'All my feathers'][i], ['', 'My eyes opened, and my first feathers are coming, rolled up like pins.', 'Red, yellow and blue feathers are opening all over me.', `I have all my feathers. I am about ${p.lengthCM} cm long, almost as big as Mom and Dad.`][i], { icon: i >= 3 ? 'young' : 'chick' }));
    Bus.on('firstLanding', () => add('milestone', 'My first flight', 'I flapped at the door until my wings were strong. Then I jumped, and flew to my family.', { icon: 'fledge' }));
    Bus.on('lessonDone', (p, k) => add('event', { fig: 'Figs', clay: 'The clay lick', nut: 'A hard nut', call: 'Lost and found', hide: 'In the leaves' }[k], { fig: 'I followed Mom and Dad to the fig tree and ate what they ate.', clay: 'We flew over the river to the clay lick. So many parrots! I ate clay too.', nut: 'I held a palm nut in my foot and cracked it with my beak.', call: 'The mist came down and I lost my family. I called my name, and they called back.', hide: 'A hawk-eagle came over the trees. I hid in the leaves until it went away.' }[k], { icon: { fig: 'fig', clay: 'clay', nut: 'nut', call: 'call', hide: 'leaf' }[k] }));
    Bus.on('visitorGone', (v) => add('event', 'A visitor', v.kind === 'toucan' ? 'A toucan looked into the hollow. There was a great deal of squawking, and it went away.' : 'An eagle came over. Every bird went up, and it flew on.', { icon: v.kind }));
    Bus.on('peopleLook', (p, Q) => add('milestone', Q.kind === 'climber' ? 'A scientist' : 'Wild and free', Q.kind === 'climber' ? 'A scientist came down a rope to see how I was growing, and put me straight back.' : 'People in a boat watched the clay lick from far away. They were quiet, and they did not come close.', { icon: Q.kind === 'climber' ? 'rope' : 'boat' }));
    Bus.on('grownUp', (p) => add('milestone', 'All grown up', `Years have gone by. I am a grown scarlet macaw, about ${p.lengthCM} cm from beak to tail tip.`, { icon: 'adult' }));
    Bus.on('paired', () => add('milestone', 'A friend for life', 'I met a macaw at the clay lick. We preened each other, and now we fly wing to wing.', { icon: 'pair' }));
    Bus.on('nestFound', (p, h) => add('milestone', 'A hollow of our own', h.key === 'box' ? 'Every hole was taken. Then we found a nest box that people had hung in a tall tree.' : 'Every hole was taken. Then we found the hollow top of a dead palm.', { icon: h.key === 'box' ? 'box' : 'hollow' }));
    Bus.on('laid', (p) => add('milestone', 'Eggs', p.male ? 'She laid the eggs and sits on them. I fly out for food and bring it home.' : 'I laid the eggs and I keep them warm. My mate brings me food.', { icon: 'egg' }));
    Bus.on('generationDone', () => add('milestone', 'A new generation', 'The eggs hatched, and I gave my chick a name of its own.', { icon: 'parent' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'egg') return;
    growLog.push({ t: G.time, g: p.lengthCM, i: p.stage === 'chick' ? p.instar : p.stage === 'young' ? 4 : 5 });
    if (growLog.length > 600) growLog.shift();
  }

  function drawGraph(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = 2, W = canvas.clientWidth || 300, H = canvas.clientHeight || 120;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const pts = growLog.filter(e => e.g !== null);
    if (pts.length < 2) { ctx.fillStyle = '#8a7a66'; ctx.font = `700 12px ${UI_FONT}`; ctx.fillText('Measuring the parrot…', 10, 20); return; }
    const pad = { l: 36, r: 10, t: 10, b: 20 }, t0 = pts[0].t, t1 = pts[pts.length - 1].t, top = Math.max(4, Math.ceil(Math.max(...pts.map(e => e.g)) / 4) * 4);
    const X = (t) => pad.l + (t - t0) / Math.max(1, t1 - t0) * (W - pad.l - pad.r), Y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (let v = 0; v <= top; v += top / 4) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(Math.round(v) + 'cm', pad.l - 5, Y(v) + 3); }
    /* moults */
    for (let k = 1; k < pts.length; k++) if (pts[k].i !== pts[k - 1].i) { ctx.strokeStyle = 'rgba(200,120,40,.6)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('moult', X(pts[k].t), H - 6); }
    ctx.strokeStyle = '#6a3a1a'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.g); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#6a3a1a'; ctx.fillText('body length', pad.l + 4, pad.t + 10);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `parrot-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}${p.stage === 'egg' ? '' : `, ${p.lengthCM} cm`}.`, { icon: 'camera', thumb });
    Bus.emit('photo');
  }

  function renderBook() {
    const list = $('journalList'); if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple', shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Hatch, spin, grow and take photos: it all lands here.</p>'; return; }
    for (const e of shown) {
      const div = document.createElement('div'); div.className = `jentry ${e.type}`;
      const d = new Date(e.when);
      div.innerHTML = `<div class="jicon"></div><div class="jbody"><div class="jmeta"></div><h4></h4><p></p></div>`;
      div.querySelector('.jmeta').textContent = `Day ${e.night || 1} · Gen ${e.gen || 1} · ${d.toLocaleDateString()}`;
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
      if (typeof e.icon === 'string' && Sprites.hasIcon(e.icon)) { const c = Sprites.icon(e.icon, 44, G.form); c.style.width = c.style.height = '44px'; return c; }
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
