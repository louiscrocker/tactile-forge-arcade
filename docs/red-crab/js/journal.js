/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how big you are in millimetres on a "times ten"
   scale (1 mm, 10 mm, 100 mm), so a tiny zoea and a big crab fit
   on one page; every moult is marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'redcrab.journal';
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
  /* how big the player is, in millimetres */
  function sizeMM(p) {
    if (p.stage === 'egg') return .6;
    if (p.stage === 'zoea') return [0, 1.2, 1.8, 2.6][p.zinstar] + p.r * .05;
    if (p.stage === 'megalopa') return 4;
    return p.cm * 10;
  }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.red;
    const cm = (p) => p.cm.toFixed(1);
    Bus.on('hatched', () => add('milestone', 'Splash! I hatched', `Generation ${G.generation}: a ${form().name.toLowerCase()} egg, shaken into the sea before dawn. It hatched into a see-through zoea the moment it touched the water.`, { icon: 'zoea' }));
    Bus.on('molted', (p, i) => add('milestone', i === 2 ? 'My first moult' : 'Zoea III', i === 2 ? 'My skin got too tight, so I wriggled out of it in the open ocean.' : 'Another moult. My long spike is even longer now.', { icon: 'zoea' }));
    Bus.on('megalopa', () => add('milestone', 'A megalopa!', 'My last moult at sea. Now I have little claws, eyes on stalks and a swimming tail. Time to find the island.', { icon: 'megalopa' }));
    Bus.on('ride', () => add('event', 'Jellyfish taxi', 'I hopped onto a moon jellyfish and rode it towards the island.', { icon: 'jelly' }));
    Bus.on('whalePassed', () => add('event', 'A whale shark!', 'The biggest fish in the world swam right past me, gulping plankton. Whoosh!', { icon: 'whaleshark' }));
    Bus.on('ashore', () => add('milestone', 'Out of the sea', 'I crawled out onto the rocks and moulted into a tiny crab, 5 millimetres across. The rocks were red with my brothers and sisters.', { icon: 'baby' }));
    Bus.on('forest', () => add('milestone', 'The rainforest', 'I climbed the cliff and reached the forest at the top. Cool, damp and full of food.', { icon: 'forest' }));
    Bus.on('firstFood', (p, it) => add('event', 'My first meal on land', `I ate a ${FOOD_KINDS[it.kind].name}.`, { icon: it.kind === 'fruit' ? 'fruit' : it.kind }));
    Bus.on('crabMolted', (p, i) => add('milestone', i >= 4 ? 'Grown up!' : `Year ${i - 1}: a new shell`, i >= 4 ? `My last moult into an adult. My shell is ${cm(p)} cm across.` : `I shut my burrow door with leaves and moulted. Then I ate my old shell. Now I am ${cm(p)} cm across.`, { icon: i >= 4 ? 'adult' : 'shell' }));
    Bus.on('robberGone', () => { if (G.player && G.player.flags.robberSafe) add('event', 'The robber crab', 'The biggest land crab in the world came sniffing about. I stayed deep in my burrow.', { icon: 'robber' }); });
    Bus.on('migrate', () => add('milestone', 'The first rain', 'The first big rain of the wet season! Every crab in the forest is marching to the sea.', { icon: 'rain' }));
    Bus.on('bridge', () => add('event', 'The crab bridge', 'I walked over the bridge the rangers built for us, high above the road.', { icon: 'bridge' }));
    Bus.on('dipped', (p) => add('milestone', 'A dip in the sea', `After the long march I dipped into the sea to soak up water and salt. I am ${cm(p)} cm across.`, { icon: 'sea' }));
    Bus.on('shoveWon', (p, r) => add('event', 'I won a push', `A rival ${r.cm.toFixed(1)} cm across wanted my burrow. I shoved him away.`, { icon: 'claw' }));
    Bus.on('shoveLost', (p, r) => add('event', 'Pushed over!', `A rival ${r.cm.toFixed(1)} cm across pushed me away. I rolled over, got up and tried again.`, { icon: 'rival' }));
    Bus.on('king', () => add('milestone', 'King of the terrace', 'My burrow by the sea is safe.', { icon: 'king' }));
    Bus.on('met', (p) => add('milestone', p.sex === 'boy' ? 'A female came' : 'I found a burrow', p.sex === 'boy' ? 'A female crab came to my burrow. She will keep her eggs safe in it.' : 'A male crab had dug a burrow on the terrace. I moved in to keep my eggs safe.', { icon: 'female' }));
    Bus.on('broodDone', () => add('milestone', 'Twelve days', 'My eggs grew under my tummy flap for twelve days. Now it is the last quarter of the moon.', { icon: 'moon' }));
    Bus.on('eggsReleased', (p) => add('milestone', 'Into the sea', `Before dawn I shook ${fmtInt(p.stats.eggsOut)} eggs into the waves. They hatched the moment they touched the sea.`, { icon: 'eggs' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'egg') return;
    const k = p.stage === 'crab' ? 'c' + p.instar : p.stage === 'zoea' ? 'z' + p.zinstar : 'm';
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
    const Y = (mm) => pad.t + (1 - (Math.log10(clamp(mm, .5, 200)) + .3) / 2.6) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const [v, l] of [[1, '1 mm'], [10, '1 cm'], [100, '10 cm']]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(l, pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,80,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#c0301a'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.mm); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#c0301a'; ctx.fillText('how big I am', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = moults', W - 60, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `red-crab-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}${p.stage === 'crab' ? `, ${p.cm.toFixed(1)} cm` : ''}.`, { icon: 'camera', thumb });
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
  const ICONS = ['egg', 'eggs', 'zoea', 'megalopa', 'baby', 'young', 'adult', 'march', 'crab', 'female', 'king', 'claw', 'rival', 'shell', 'robber', 'jelly', 'whaleshark', 'forest', 'sea', 'rain', 'moon', 'bridge', 'leaf', 'flower', 'fruit', 'seedling'];
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
