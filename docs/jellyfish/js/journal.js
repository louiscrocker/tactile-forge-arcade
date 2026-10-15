/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how long you are in millimetres on a "times ten"
   scale (1 mm, 10 mm, 100 mm), so a tiny planula and a grown moon
   jelly fit on one page; every new stage is marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'jellyfish.journal';
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
  /* how big the player is, in millimetres (the bell across, or the polyp's height) */
  function sizeMM(p) {
    if (p.stage === 'egg') return .2;
    if (p.stage === 'planula') return .25;
    return jellyCM(p) * 10;
  }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.pink;
    const cm = (p) => p.cm.toFixed(p.cm < 2 ? 1 : 0);
    Bus.on('hatched', () => add('milestone', 'I swam free', `Generation ${G.generation}: a ${form().name.toLowerCase()} baby. My mother carried me in a pouch on her arm, then let me go. Now I am a planula, swimming with my tiny hairs.`, { icon: 'planula' }));
    Bus.on('settled', (p, s) => add('milestone', 'Upside down', `I found a free, shady spot under ${s && s.kind === 'dock' ? 'the dock' : 'a rock ledge'} and stuck on. Now I am a polyp, hanging upside down.`, { icon: 'polyp' }));
    Bus.on('tentacles', (p, n) => add('milestone', `${n} tentacles`, `I caught and ate enough food to grow ${n} tentacles.`, { icon: 'tentacles' }));
    Bus.on('budded', (p, n) => add('milestone', n === 1 ? 'A copy of me' : `Bud number ${n}`, 'A bump on my side grew into a whole new polyp: a clone of me.', { icon: 'bud' }));
    Bus.on('slugPast', (p, pulled) => add('event', 'A sea slug!', pulled ? 'A sea slug crawled by. I pulled my tentacles in tight and it slid right past.' : 'A sea slug crawled by and bumped me. I wobbled, and it crawled on.', { icon: 'slug' }));
    Bus.on('strobila', () => add('milestone', 'Winter', 'The sea got cold. I grew long and started to split into a stack of discs, like a pile of plates.', { icon: 'strobila' }));
    Bus.on('popFree', () => add('milestone', 'Pop!', 'I pulsed and popped off the bottom of the stack. Now I am an ephyra, a baby jellyfish like a tiny star.', { icon: 'ephyra' }));
    Bus.on('grew', (p) => add('event', 'Filling in', `My eight arms are filling in. I am ${cm(p)} cm across.`, { icon: 'ephyra' }));
    Bus.on('medusa', (p) => add('milestone', 'A young jelly', `My bell is round now. I am a young moon jelly, ${cm(p)} cm across. Food sticks to my bell as I swim.`, { icon: 'medusa' }));
    Bus.on('ride', () => add('event', 'Riding the current', 'I found a current, like a river in the sea, and rode along with it.', { icon: 'current' }));
    Bus.on('dodged', (p, h) => add('event', 'Too quick!', `${h && h.kind === 'turtle' ? 'A sea turtle' : h && h.kind === 'sunfish' ? 'An ocean sunfish' : h && (h.kind === 'gull' || h.kind === 'tern') ? 'A seabird' : 'Something'} came for a jelly snack. One big pulse and it missed me.`, { icon: h && VISIT_ICON[h.kind] ? VISIT_ICON[h.kind] : 'jelly' }));
    Bus.on('adult', (p) => add('milestone', 'Four rings', `Four rings show through my bell: I am a grown moon jelly, ${cm(p)} cm across.`, { icon: 'rings' }));
    Bus.on('inBloom', () => add('milestone', 'The bloom', 'I swam out to where the currents meet. Hundreds and hundreds of moon jellies are here together: a bloom!', { icon: 'bloom' }));
    Bus.on('met', (p) => add('milestone', p.sex === 'boy' ? 'Hello, girl jelly' : 'A little cloud', p.sex === 'boy' ? 'I found a girl jelly in the bloom and let my little cloud drift to her.' : 'A boy let a little cloud go, and I caught it. Now my babies can start to grow.', { icon: 'heart' }));
    Bus.on('brooding', () => add('milestone', 'Babies on my arms', 'My babies are growing in little pouches on my four arms.', { icon: 'pouch' }));
    Bus.on('broodDone', () => add('milestone', 'Ready to go', 'Weeks went by. My babies are planulae now, ready to swim free.', { icon: 'pouch' }));
    Bus.on('larvaeReleased', (p) => add('milestone', 'Swim free, little ones', `I let about ${fmtInt(p.stats.planulaeOut)} planulae go. They swam down to look for shady rocks.`, { icon: 'planulae' }));
    Bus.on('generationDone', (p) => { if (p && p.sex === 'boy') add('milestone', 'The next generation', 'Weeks later, the girl I met let her babies go. They swam down to the rocks, and it all starts again.', { icon: 'planulae' }); });
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }
  const VISIT_ICON = { turtle: 'turtle', sunfish: 'sunfish', gull: 'gull', tern: 'tern' };

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'egg') return;
    const k = p.stage === 'polyp' ? 'p' + p.pinst : p.stage === 'ephyra' ? 'e' + p.einst : p.stage === 'medusa' ? 'm' + p.minst : p.stage;
    growLog.push({ t: G.time, mm: +sizeMM(p).toFixed(3), k });
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
    const Y = (mm) => pad.t + (1 - (Math.log10(clamp(mm, .1, 600)) + 1) / 3.8) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const [v, l] of [[.1, '0.1 mm'], [1, '1 mm'], [10, '1 cm'], [100, '10 cm']]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(l, pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,80,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#2a6ab0'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.mm); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#2a6ab0'; ctx.fillText('how big I am', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = new stage', W - 64, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `jellyfish-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}${p.stage === 'medusa' || p.stage === 'ephyra' ? `, ${p.cm.toFixed(1)} cm across` : ''}.`, { icon: 'camera', thumb });
    Bus.emit('photo');
  }

  function renderBook() {
    const list = $('journalList'); if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple', shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Swim, grow, pulse and take photos: it all lands here.</p>'; return; }
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
  const ICONS = ['pouch', 'planula', 'polyp', 'strobila', 'ephyra', 'medusa', 'adult', 'jelly', 'bloom', 'boy', 'girl', 'mum', 'planulae', 'plankton', 'copepod', 'diatom', 'combjelly', 'herring', 'fish', 'tern', 'gull', 'bird', 'turtle', 'sunfish', 'slug', 'rock', 'ledge', 'dock', 'bud', 'tentacles', 'rings', 'arms', 'cloud', 'current', 'sea', 'water', 'moon', 'sun', 'snow', 'kelp', 'heart', 'sparkle'];
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
