/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how long you are in millimetres on a "times ten"
   scale (1 mm, 10 mm, 100 mm), so a tiny larva and a big lobster
   fit on one page; every moult is marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'lobster.journal';
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
  /* how long the player is, in millimetres (the whole body, rostrum to tail fan) */
  function sizeMM(p) {
    if (p.stage === 'egg') return 1.5;
    if (p.stage === 'larva') return [0, 8, 9.5, 11][p.zinstar] + p.r * .2;
    if (p.stage === 'postlarva') return 15;
    return lobTotalCM(p.cm) * 10;
  }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.normal;
    const cm = (p) => p.cm.toFixed(1);
    Bus.on('hatched', () => add('milestone', 'I floated free', `Generation ${G.generation}: a ${form().name.toLowerCase()} egg, carried for months under my mother's tail. On a summer night she fanned me free and I swam up to the light.`, { icon: 'larva' }));
    Bus.on('molted', (p, i) => add('milestone', i === 2 ? 'My first moult' : 'Stage III', i === 2 ? 'My skin got too tight, so I wriggled out of it in the plankton.' : 'Another moult. Bigger again, with longer spines.', { icon: 'larva' }));
    Bus.on('postlarva', () => add('milestone', 'Stage IV!', 'My last moult in the plankton. Now I look like a tiny lobster and swim forwards with my tail fan. Time to find the bottom.', { icon: 'postlarva' }));
    Bus.on('sharkPassed', () => add('event', 'A basking shark!', 'The second biggest fish in the world swam right past me with its huge mouth open, straining plankton.', { icon: 'basking' }));
    Bus.on('settled', () => add('milestone', 'A hole of my own', 'I dived to the cobble bed and looked under stone after stone. Most holes were taken. At last I found a free one. Home!', { icon: 'den' }));
    Bus.on('firstFood', (p, it) => add('event', 'My first meal on the bottom', `I ate a ${FOOD_KINDS[it.kind].name}.`, { icon: it.kind === 'drift' ? 'juvenile' : it.kind }));
    Bus.on('lobMolted', (p, i) => add('milestone', i >= 4 ? 'Grown up!' : `A new shell (moult ${p.stats.molts})`, i >= 4 ? `My last big moult into an adult. My shell is ${cm(p)} cm long.` : `My shell split along my back and I backed out of it. Now my shell is ${cm(p)} cm long.`, { icon: i >= 4 ? 'adult' : 'shell' }));
    Bus.on('ateShell', () => add('event', 'Calcium!', 'I ate my old shell. It is full of calcium to harden my new one.', { icon: 'shell' }));
    Bus.on('crusher', (p) => add('milestone', 'Crusher and cutter', `My ${p.crusher} claw became my big crusher, because I used it most. The other is my slim cutter.`, { icon: 'claw' }));
    Bus.on('dodged', () => add('event', 'Too quick!', 'A hunter came for a look. I flipped my tail and shot backwards out of reach.', { icon: 'tail' }));
    Bus.on('putBack', () => add('event', 'Measured!', 'The lobsterman hauled up his trap and measured me with his brass gauge. Too small! He put me straight back into the sea.', { icon: 'lobsterman' }));
    Bus.on('migrate', () => add('milestone', 'Autumn', 'The shallow water is getting cold and stormy. The lobsters are walking offshore to the deep.', { icon: 'deep' }));
    Bus.on('winterStart', () => add('milestone', 'Winter in the mud', 'I dug into the soft mud of the deep, where the water stays a little warmer. Rest until spring.', { icon: 'mud' }));
    Bus.on('homeAgain', (p) => add('milestone', 'Home again', `Spring! I walked all the way back to the cobble bed. My shell is ${cm(p)} cm long.`, { icon: 'cobble' }));
    Bus.on('boxWon', (p, r) => add('event', 'I won a boxing match', `A rival ${r.cm.toFixed(1)} cm long wanted my den. We waved our claws and pushed, and he backed off.`, { icon: 'claw' }));
    Bus.on('boxLost', (p, r) => add('event', 'Pushed back!', `A rival ${r.cm.toFixed(1)} cm long pushed me away. Nobody was hurt. I tried again.`, { icon: 'rival' }));
    Bus.on('boss', () => add('milestone', 'Boss of the cobble bed', 'My den is the best on this part of the cobble bed.', { icon: 'boss' }));
    Bus.on('met', (p) => add('milestone', p.sex === 'boy' ? 'A female came' : 'I found a den', p.sex === 'boy' ? 'A female lobster came to my den to moult where it is safe. I guarded her.' : 'A male lobster had the best den. I moved in to moult where it was safe.', { icon: 'female' }));
    Bus.on('broodDone', () => add('milestone', 'Months under my tail', 'I carried my eggs under my tail for months, fanning them and keeping them clean. Now it is summer again.', { icon: 'eggs' }));
    Bus.on('larvaeReleased', (p) => add('milestone', 'Larvae away!', `On a summer night I fanned about ${fmtInt(p.stats.larvaeOut)} larvae free. They swam up to the surface.`, { icon: 'eggs' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'egg') return;
    const k = p.stage === 'lobster' ? 'c' + p.instar : p.stage === 'larva' ? 'z' + p.zinstar : 'm';
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
    const Y = (mm) => pad.t + (1 - (Math.log10(clamp(mm, 1, 600)) - 0) / 2.8) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const [v, l] of [[1, '1 mm'], [10, '1 cm'], [100, '10 cm']]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(l, pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,80,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#2a6ab0'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.mm); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#2a6ab0'; ctx.fillText('how long I am', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = moults', W - 60, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `lobster-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}${p.stage === 'lobster' ? `, ${p.cm.toFixed(1)} cm` : ''}.`, { icon: 'camera', thumb });
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
  const ICONS = ['egg', 'eggs', 'larva', 'postlarva', 'juvenile', 'young', 'adult', 'walk', 'lobster', 'female', 'boss', 'claw', 'rival', 'shell', 'tail', 'den', 'cobble', 'basking', 'deep', 'mud', 'moon', 'trap', 'lobsterman', 'mussel', 'crab', 'urchin', 'snail', 'kelp'];
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
