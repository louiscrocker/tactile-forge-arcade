/* ============================================================
   journal.js — the field journal, photos and the science graph
   ============================================================
   Every milestone, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph logs the aphid population so the predator-prey story can
   be seen, not just told.
   ============================================================ */
'use strict';

const Journal = (function () {
  let entries = [];
  let popLog = [];              // [{ t, total, perPlant: [], eats }]
  let eatMarks = [];
  let logClock = 0;
  const MAX_ENTRIES = 200;
  const $ = (id) => document.getElementById(id);
  let G;

  function load() {
    try { entries = JSON.parse(localStorage.getItem('ladybug.journal') || '[]'); } catch (e) { entries = []; }
  }
  function save() {
    try { localStorage.setItem('ladybug.journal', JSON.stringify(entries.slice(-MAX_ENTRIES))); } catch (e) { /* photos may overflow; drop the oldest photo */ dropPhoto(); }
  }
  function dropPhoto() {
    const i = entries.findIndex(e => e.thumb);
    if (i >= 0) { delete entries[i].thumb; try { localStorage.setItem('ladybug.journal', JSON.stringify(entries)); } catch (e) { /* give up */ } }
  }

  function stamp() {
    const g = G.garden;
    return { day: G.day, season: g.season, year: g.year, gen: G.generation, when: Date.now() };
  }

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
    Bus.on('hatched', (p) => add('milestone', 'I hatched!', `Generation ${G.generation}. A ${p.species.name} larva, first instar, on the ${p.plant.type.name.toLowerCase()}.`, { icon: 'L1' }));
    Bus.on('molted', (p) => add('milestone', `Molted into the ${['', '1st', '2nd', '3rd', '4th'][p.stage]} instar`, `I ate ${p.total} aphids so far and left my old skin on the branch.`, { icon: STAGES[p.stage].key }));
    Bus.on('pupated', (p) => add('milestone', 'Became a pupa', `Glued my tail to a leaf on the ${p.plant.type.name.toLowerCase()}. Total aphids eaten as a larva: ${p.total}.`, { icon: 'pupa' }));
    Bus.on('eclosed', (p) => add('milestone', 'A ladybug!', `Came out pale and spotless. I am a ${p.species.name}.`, { icon: 'adult' }));
    Bus.on('takeoff', (p) => { if (!p._journalFlew) { p._journalFlew = true; add('milestone', 'First flight', 'Lifted my shells and flew for the first time.', { icon: 'adult' }); } });
    Bus.on('eggsLaid', (c, p) => add('milestone', 'Laid eggs', `${c.count} eggs on the ${G.garden.plantAt(c.plant).type.name.toLowerCase()}, next to the aphids. Generation ${G.generation + 1} is on its way.`, { icon: 'egg' }));
    Bus.on('hibernate', () => add('milestone', 'Went to sleep for winter', 'Squeezed into the warm crack in the wall with the other ladybugs.', { icon: 'snow' }));
    Bus.on('wake', () => add('milestone', 'Woke up in spring', `Year ${G.garden.year}. Hungry!`, { icon: 'adult' }));
    Bus.on('season', (s) => add('season', `${SEASON_INFO[s].name} arrived`, SEASON_INFO[s].blurb, { icon: s }));
    Bus.on('weather', (w) => { if (w === 'rain') add('weather', 'It rained', 'The shy aphids hid under the leaves and drops rolled off the tips.', { icon: 'rain' }); });
    Bus.on('birdScare', (p) => add('event', 'A bird got me!', 'It gave me a fright and knocked me back. Next time: freeze, or hide under a leaf.', { icon: 'bird' }));
    Bus.on('birdSafe', (p) => add('event', 'Hid from a bird', p.stage === 6 ? 'I played dead and it flew right past.' : 'I froze like a statue and it never saw me.', { icon: 'bird' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
    Bus.on('eat', () => { eatMarks.push(G.time); if (eatMarks.length > 400) eatMarks.shift(); });
    Bus.on('landed', (p) => { if (p.stats.plantsLanded.size === 1 && p.state === 'adult' && !p._journalPlant) { p._journalPlant = true; } });
  }

  /* ---------- population log ---------- */
  function update(dt) {
    logClock -= dt;
    if (logClock > 0) return;
    logClock = 2;
    const per = G.garden.plants.map(p => p.aphids.count());
    popLog.push({ t: G.time, total: per.reduce((a, b) => a + b, 0), per, larvae: G.garden.plants.reduce((n, p) => n + (p.npcs.list ? p.npcs.list.length : 0), 0) + G.players.filter(p => p.isLarva()).length });
    if (popLog.length > 300) popLog.shift();          // ~10 minutes
  }

  function drawGraph(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = 2, W = canvas.clientWidth || 300, H = canvas.clientHeight || 120;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (popLog.length < 2) { ctx.fillStyle = '#8a977f'; ctx.font = `700 12px ${UI_FONT}`; ctx.fillText('Watching the aphids…', 10, 20); return; }
    const pad = { l: 34, r: 10, t: 10, b: 20 };
    const t0 = popLog[0].t, t1 = popLog[popLog.length - 1].t;
    const maxV = Math.max(20, ...popLog.map(p => p.total)) * 1.1;
    const X = (t) => pad.l + (t - t0) / Math.max(1, t1 - t0) * (W - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - v / maxV) * (H - pad.t - pad.b);
    /* grid */
    ctx.strokeStyle = 'rgba(60,90,40,.12)'; ctx.lineWidth = 1;
    ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a977f'; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { const v = maxV / 1.1 * i / 4; ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(Math.round(v), pad.l - 6, Y(v) + 3); }
    /* eat marks */
    ctx.fillStyle = 'rgba(224,57,47,.35)';
    for (const t of eatMarks) { if (t < t0) continue; ctx.fillRect(X(t) - .5, H - pad.b - 6, 1, 6); }
    /* per plant, thin */
    const cols = ['#69a84a', '#4f8a33', '#c9a04a'];
    G.garden.plants.forEach((p, i) => {
      ctx.strokeStyle = withAlpha(cols[i % 3], .55); ctx.lineWidth = 1.2;
      ctx.beginPath(); popLog.forEach((e, k) => { const x = X(e.t), y = Y(e.per[i] || 0); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    });
    /* total, bold */
    ctx.strokeStyle = '#3f8a2e'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
    ctx.beginPath(); popLog.forEach((e, k) => { const x = X(e.t), y = Y(e.total); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    /* larvae (predators) */
    ctx.strokeStyle = '#e0392f'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]);
    ctx.beginPath(); popLog.forEach((e, k) => { const x = X(e.t), y = Y(e.larvae * 8); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.fillStyle = '#5b6b52';
    ctx.fillText('aphids (all plants)', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#e0392f'; ctx.fillText('larvae ×8', pad.l + 4, pad.t + 22);
    ctx.fillStyle = '#8a977f'; ctx.textAlign = 'right'; ctx.fillText(`last ${Math.round((t1 - t0) / 60)} min`, W - pad.r, H - 6);
  }

  /* ---------- photo mode ---------- */
  function photo(renderFn) {
    const src = renderFn();
    /* full-size download */
    const name = `ladybug-day${G.day}-${G.garden.season}.png`;
    try {
      src.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }, 'image/png');
    } catch (e) { /* headless or blocked */ }
    /* thumbnail for the journal */
    const th = document.createElement('canvas');
    const tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh;
    th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null;
    try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    const what = p.state === 'flying' ? 'flying' : STAGES[p.stage].name.toLowerCase();
    add('photo', 'Photo', `${what}, ${G.garden.season}, day ${G.day}.`, { icon: 'camera', thumb });
    Bus.emit('photo');
  }

  /* ---------- the book ---------- */
  function renderBook() {
    const list = $('journalList');
    if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple';
    const shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Hatch, eat, molt and take photos — it all lands here.</p>'; return; }
    for (const e of shown) {
      const div = document.createElement('div');
      div.className = `jentry ${e.type}`;
      const d = new Date(e.when);
      const icon = iconFor(e);
      div.innerHTML = `<div class="jicon"></div><div class="jbody"><div class="jmeta">Day ${e.day} · ${SEASON_INFO[e.season] ? SEASON_INFO[e.season].name : ''} · Gen ${e.gen} · ${d.toLocaleDateString()}</div><h4>${escapeHtml(e.title)}</h4><p>${escapeHtml(simple && e.simpleBody ? e.simpleBody : e.body)}</p>${e.more ? `<a class="more" href="${e.more}" target="_blank" rel="noopener">See the real thing ↗</a>` : ''}</div>`;
      if (icon) div.querySelector('.jicon').appendChild(icon);
      if (e.thumb) { const img = new Image(); img.src = e.thumb; img.className = 'jthumb'; div.querySelector('.jbody').appendChild(img); }
      list.appendChild(div);
    }
  }

  function iconFor(e) {
    try {
      if (e.type === 'sticker' && e.sticker) { const st = STICKERS.find(s => s.key === e.sticker); if (st) { const c = Stickers.image(st, 44, false); c.style.width = c.style.height = '44px'; return c; } }
      if (['L1', 'L2', 'L3', 'L4', 'pupa', 'adult', 'egg'].includes(e.icon)) { const c = Sprites.icon(e.icon, G.players[0].species, 44); c.style.width = c.style.height = '44px'; return c; }
      const span = document.createElement('span');
      span.textContent = { rain: '🌧️', bird: '🐦', snow: '❄️', spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️', fact: '💡', camera: '📷', book: '📖' }[e.icon] || '📝';
      span.className = 'jemoji';
      return span;
    } catch (err) { return null; }
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function clear() { entries = []; save(); renderBook(); }
  function count() { return entries.length; }
  function serialize() { return { popLog: popLog.slice(-150), eatMarks: eatMarks.slice(-100) }; }
  function restore(o) { if (!o) return; popLog = o.popLog || []; eatMarks = o.eatMarks || []; }

  return { init, update, add, drawGraph, photo, renderBook, clear, count, serialize, restore, entries: () => entries };
})();
