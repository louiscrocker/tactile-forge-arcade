/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how long you are in millimetres on a "times ten"
   scale (1 mm, 10 mm, 100 mm, 1000 mm), so a tiny paralarva and a
   giant octopus fit on one page; every growth sleep is marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'octopus.journal';
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
  /* how long the player is, in millimetres (arm span, tip to tip) */
  function sizeMM(p) {
    if (p.stage === 'egg') return 6;
    if (p.stage === 'larva') return [0, 7, 9, 12][p.zinstar] + p.r * .3;
    if (p.stage === 'postlarva') return 18;
    return armSpanCM(p.cm) * 10;
  }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.normal;
    const cm = (p) => p.cm.toFixed(1);
    Bus.on('hatched', () => add('milestone', 'I popped out', `Generation ${G.generation}: a ${form().name.toLowerCase()} egg, hanging for months in my mother's den. On a spring night she blew water over the eggs and I jetted up to the light.`, { icon: 'larva' }));
    Bus.on('grew', (p, i) => add('milestone', i === 2 ? 'Bigger!' : 'Bigger again', i === 2 ? 'I ate copepods and krill and grew. No shell to shed: an octopus just grows.' : 'Bigger again, with longer arms and bigger eyes.', { icon: 'larva' }));
    Bus.on('postlarva', () => add('milestone', 'Time to settle', 'I am big enough to leave the plankton. Now I look like a tiny octopus. Time to sink to the reef and find a den.', { icon: 'postlarva' }));
    Bus.on('whalePassed', () => add('event', 'A grey whale!', 'A whale as long as a bus swam right past me on its way north. Its wave tumbled me head over arms.', { icon: 'whale' }));
    Bus.on('settled', (p, sh) => add('milestone', 'A den of my own', sh && sh.kind === 'bottle' ? 'I sank to the reef and looked under rock after rock. Every crack was taken. Then I found an old bottle lying on the sand. Home!' : 'I sank to the reef and looked under rock after rock. Most cracks were taken. At last I found a free one. Home!', { icon: sh && sh.kind === 'bottle' ? 'bottle' : 'den' }));
    Bus.on('firstFood', (p, it) => add('event', 'My first meal on the bottom', `I ate a ${FOOD_KINDS[it.kind].name}.`, { icon: it.kind === 'drift' ? 'shrimp' : it.kind }));
    Bus.on('grewOct', (p, i) => add('milestone', i >= 4 ? 'A giant!' : `I woke up bigger (sleep ${p.stats.sleeps})`, i >= 4 ? `My last big growth sleep. Now I am a giant Pacific octopus: my mantle is ${cm(p)} cm long and my arms span ${armSpanCM(p.cm).toFixed(0)} cm.` : `I curled up in my den and slept, and my skin flickered with colours while I dreamed. I woke up bigger: my mantle is ${cm(p)} cm long.`, { icon: i >= 4 ? 'adult' : 'sleep' }));
    Bus.on('middenGrew', () => add('event', 'My midden', 'The empty shells of my meals are piling up by my door. Divers find octopus dens by looking for them.', { icon: 'shell' }));
    Bus.on('favArm', (p) => add('milestone', 'My favourite arm', `My ${p.favArm} front arm became my favourite, because I reached with it most. Every octopus has one.`, { icon: 'arm' }));
    Bus.on('dodged', () => add('event', 'Too quick!', 'A hunter came for a look. I squirted ink and jetted backwards out of reach.', { icon: 'ink' }));
    Bus.on('blended', () => add('event', 'Vanished!', 'I kept very still and my skin changed to match the ground. The hunter swam right past.', { icon: 'cobble' }));
    Bus.on('putBack', () => add('event', 'Not a crab!', 'The crabber hauled up his pot and lifted the lid. I am not a crab, so he tipped me straight back into the sea.', { icon: 'crabber' }));
    Bus.on('shook', () => add('event', 'Hello, diver', 'A diver came to visit the reef and held very still. I reached out an arm and tasted her hand with my suckers. She took my photo.', { icon: 'diver' }));
    Bus.on('armTip', () => add('event', 'An arm tip left behind', 'A wolf eel got hold of the tip of an arm, so I let it go. It does not hurt an octopus much, and it will grow back.', { icon: 'arm' }));
    Bus.on('migrate', () => add('milestone', 'Autumn', 'The shallow water is getting cold and stormy. The octopuses are crawling down the drop-off to the deep.', { icon: 'deep' }));
    Bus.on('winterStart', () => add('milestone', 'Winter in the deep', 'I dug a den under a stone in the deep, where the water stays calm. Rest until spring.', { icon: 'mud' }));
    Bus.on('homeAgain', (p) => add('milestone', 'Home again', `Spring! I crawled all the way back up to the reef. My mantle is ${cm(p)} cm long.`, { icon: 'cobble' }));
    Bus.on('boxWon', (p, r) => add('event', 'I won a wrestle', `A rival with a ${r.cm.toFixed(0)} cm mantle wanted my den. We spread our arms and pushed, and he jetted off.`, { icon: 'arm' }));
    Bus.on('boxLost', (p, r) => add('event', 'Pushed back!', `A rival with a ${r.cm.toFixed(0)} cm mantle pushed me away. Nobody was hurt. I tried again.`, { icon: 'rival' }));
    Bus.on('boss', () => add('milestone', 'The biggest on the reef', 'My den is the best on this part of the reef.', { icon: 'boss' }));
    Bus.on('met', (p) => add('milestone', p.sex === 'boy' ? 'A female came' : 'I found a den', p.sex === 'boy' ? 'A female octopus came to my den. I handed her the gift with my special arm.' : 'A male octopus had the best den. I took the one next door for my eggs.', { icon: 'female' }));
    Bus.on('broodDone', () => add('milestone', 'Months with my eggs', 'I hung my eggs from the roof of my den and tended them for months, stroking them clean and blowing water over them. Now it is spring.', { icon: 'eggs' }));
    Bus.on('babiesReleased', (p) => add('milestone', 'Babies away!', `On a spring night I blew about ${fmtInt(p.stats.babiesOut)} babies out of my den. They jetted up to the surface.`, { icon: 'eggs' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'egg') return;
    const k = p.stage === 'octopus' ? 'c' + p.instar : p.stage === 'larva' ? 'z' + p.zinstar : 'm';
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
    const Y = (mm) => pad.t + (1 - (Math.log10(clamp(mm, 1, 6000)) - 0) / 3.8) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const [v, l] of [[1, '1 mm'], [10, '1 cm'], [100, '10 cm'], [1000, '1 m']]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(l, pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,80,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#2a6ab0'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.mm); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#2a6ab0'; ctx.fillText('my arm span', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = growth sleeps', W - 70, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `octopus-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}${p.stage === 'octopus' ? `, mantle ${p.cm.toFixed(1)} cm` : ''}.`, { icon: 'camera', thumb });
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
  const ICONS = ['egg', 'eggs', 'larva', 'postlarva', 'juvenile', 'young', 'adult', 'walk', 'octopus', 'female', 'boss', 'arm', 'rival', 'ink', 'sleep', 'den', 'bottle', 'cobble', 'whale', 'deep', 'mud', 'moon', 'trap', 'crabber', 'diver', 'crab', 'clam', 'scallop', 'snail', 'shrimp', 'shell', 'kelp'];
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
