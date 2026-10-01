/* ============================================================
   journal.js — the pond journal, photos and the science graph
   ============================================================
   Every milestone, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph logs algae, bugs and wrigglers so the food-web story can
   be seen, not just told.
   ============================================================ */
'use strict';

const Journal = (function () {
  let entries = [];
  let popLog = [];              // [{ t, algae, bugs, wrigglers }]
  let eatMarks = [];
  let logClock = 0;
  const MAX_ENTRIES = 200;
  const $ = (id) => document.getElementById(id);
  let G;

  function load() { try { entries = JSON.parse(localStorage.getItem(pkey('journal')) || '[]'); } catch (e) { entries = []; } }
  function save() {
    try { localStorage.setItem(pkey('journal'), JSON.stringify(entries.slice(-MAX_ENTRIES))); } catch (e) { dropPhoto(); }
  }
  function dropPhoto() {
    const i = entries.findIndex(e => e.thumb);
    if (i >= 0) { delete entries[i].thumb; try { localStorage.setItem(pkey('journal'), JSON.stringify(entries)); } catch (e) { /* give up */ } }
  }

  function stamp() { const g = G.pond; return { day: G.day, season: g.season, year: g.year, gen: G.generation, when: Date.now() }; }

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
    const once = (p, key, fn) => { if (!p._j) p._j = {}; if (p._j[key]) return; p._j[key] = true; fn(); };
    Bus.on('hatched', (p) => add('milestone', 'I hatched!', `Generation ${G.generation}. A ${p.species.name} tadpole wriggled out of the jelly in the shallows.`, { icon: 'tadpole' }));
    Bus.on('legs', (p) => add('milestone', 'Back legs sprouted', `After ${p.total} bites of algae, two little legs grew at the root of my tail.`, { icon: 'legs' }));
    Bus.on('arms', (p) => add('milestone', 'Front legs popped out', 'Both front legs came through, and now I have lungs. I have to swim up for air.', { icon: 'tail' }));
    Bus.on('froglet', (p) => add('milestone', 'A froglet!', `My tail is gone, absorbed into my body. I took ${p.stats.gulps} gulps of air while it shrank.`, { icon: 'froglet' }));
    Bus.on('frog', (p) => add('milestone', 'A grown frog', `I am a ${p.species.name}. Bugs eaten so far: ${p.total}.`, { icon: 'frog' }));
    Bus.on('hop', (p) => once(p, 'hop', () => add('milestone', 'First hop', 'Out of the water and into the air. Frogs jump!', { icon: 'frog' })));
    Bus.on('landedPad', (p) => once(p, 'pad', () => add('milestone', 'Sat on a lily pad', 'It sank a little under me and rings spread out across the water.', { icon: 'pad' })));
    Bus.on('snap', (p) => once(p, 'snap', () => add('milestone', 'First tongue snap', 'My tongue flipped out and stuck to a bug faster than I could blink.', { icon: 'frog' })));
    Bus.on('eggsLaid', (m, p) => add('milestone', 'Laid eggs', `A jelly mass of eggs on the weeds in the shallows. Generation ${G.generation + 1} is on its way.`, { icon: 'egg' }));
    Bus.on('hibernate', (p, kind) => add('milestone', kind === 'mud' ? 'Went to sleep in the mud' : 'Froze solid in the leaves', kind === 'mud' ? 'Buried myself in the mud at the bottom while the ice closed over the pond.' : 'Hopped into the leaf litter on the bank and froze solid. My heart stopped.', { icon: 'snow' }));
    Bus.on('wake', () => add('milestone', 'Woke up in spring', `Year ${G.pond.year}. The ice is gone. Hungry!`, { icon: 'frog' }));
    Bus.on('season', (s) => add('season', `${SEASON_INFO[s].name} arrived`, SEASON_INFO[s].blurb, { icon: s }));
    Bus.on('weather', (w) => { if (w === 'rain') add('weather', 'It rained', 'Rings all over the water. The wrigglers will multiply.', { icon: 'rain' }); });
    Bus.on('iceBreak', () => add('event', 'The ice cracked', 'Spring sun broke the ice into floes that drifted and melted.', { icon: 'ice' }));
    Bus.on('heronScare', () => add('event', 'A heron got me!', 'It stabbed and gave me a fright. Next time: dive deep, hide under a pad, or hold still.', { icon: 'heron' }));
    Bus.on('heronSafe', (p) => add('event', 'Hid from a heron', { deep: 'I dived deep where its beak could not reach.', statue: 'I held perfectly still and it never saw me.', cling: 'I clung to a reed out of its reach.', pad: 'I hid under a lily pad.', reeds: 'I hid among the reed stems.' }[p.safeReason()], { icon: 'heron' }));
    Bus.on('nymphHit', () => add('event', 'A nymph grabbed at me', 'The dragonfly nymph shot its jaw out. It got a fright out of me and nothing more.', { icon: 'nymph' }));
    Bus.on('dragonflyEmerged', () => add('event', 'A dragonfly emerged', 'A nymph climbed a reed, split its skin and flew away as a dragonfly.', { icon: 'dragonfly' }));
    Bus.on('chorusAnswer', (n) => { if (n === 1) add('event', 'The chorus answered', 'I sang, and the other frogs sang back.', { icon: 'note' }); });
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('eat', () => { eatMarks.push(G.time); if (eatMarks.length > 400) eatMarks.shift(); });
    Bus.on('turtleSlide', () => add('event', 'Plop!', 'I came too close and the painted turtle slid off the log into the water.', { icon: 'turtle' }));
    Bus.on('snakeScare', () => add('event', 'A snake got me!', 'The garter snake struck in the bank grass. Next time: freeze, or hop into the water.', { icon: 'snake' }));
    Bus.on('snakeSafe', () => add('event', 'Fooled the snake', 'I held perfectly still and the snake slid on by.', { icon: 'snake' }));
    Bus.on('raccoonScare', () => add('event', 'The raccoon got me!', 'It felt for me in the shallows at night. Deep water next time.', { icon: 'raccoon' }));
    Bus.on('raccoonSafe', () => add('event', 'Out of the raccoon\'s reach', 'It patted the shallows all it liked. I was too deep.', { icon: 'raccoon' }));
    Bus.on('raccoonYuck', () => add('event', 'Yuck!', 'The raccoon grabbed me and spat me straight out. Toads taste terrible.', { icon: 'toad' }));
    Bus.on('fishScare', () => add('event', 'The fish got me!', 'A bass came out of the deep at dusk. The shallows are the safe place then.', { icon: 'fish' }));
    Bus.on('fishSafe', () => add('event', 'Escaped the fish', 'I swam up into the shallows where the big fish could not follow.', { icon: 'fish' }));
    Bus.on('wildHatch', (m, n) => add('event', 'Eggs hatched', `${n} tadpoles wriggled out of the jelly${m.wild ? ' laid by the wild frogs' : ' I laid'}.`, { icon: 'tadpole' }));
    Bus.on('wildGrown', () => add('event', 'A tadpole grew up', 'One of the wild tadpoles finished growing and slipped away into the reeds.', { icon: 'froglet' }));
    Bus.on('travel', (kind, how) => add('event', `Went to ${PLACES[kind].name.toLowerCase()}`, ({ culvert: 'Swam through the dark culvert pipe. ', stream: 'Rode the current down the stream. ', overland: 'Hopped over land on a rainy night. ' }[how] || '') + PLACES[kind].blurb, { icon: 'map' }));
    Bus.on('storyRead', (k) => { const ch = CHAPTERS.find(c => c.key === k); if (ch) add('event', `Story: ${ch.title}`, G.settings.reading === 'simple' ? ch.simple : ch.full, { icon: 'book' }); });
    Bus.on('rhythmWin', () => add('event', 'Sang with the chorus', 'Eight answers in a row, right on the beat. The whole pond joined in.', { icon: 'note' }));
    Bus.on('mayflyHatch', () => add('event', 'The mayfly hatch', 'On a summer evening the mayflies rose from the water in a cloud.', { icon: 'summer' }));
    Bus.on('bigNight', () => add('event', 'The big night', 'The first warm rainy night of spring. Frogs arrived from everywhere to sing.', { icon: 'note' }));
    Bus.on('firstFrost', () => add('event', 'First frost', 'The banks and lily pads sparkled with frost.', { icon: 'winter' }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
    Bus.on('toadParade', () => add('event', 'Toadlet parade', 'It rained, and every toadlet left the pond at once, hopping up the bank together.', { icon: 'toad' }));
    Bus.on('seen', (k) => { const G2 = (typeof GUIDE !== 'undefined') && GUIDE[k]; if (G2) add('event', `Spotted: ${G2.name}`, G.settings.reading === 'simple' ? G2.simple : G2.body, { icon: 'guide' }); });
  }

  /* ---------- population log ---------- */
  function update(dt) {
    logClock -= dt;
    if (logClock > 0) return;
    logClock = 2;
    popLog.push({ t: G.time, algae: G.algae.count(), bugs: G.bugs.count(), wrigglers: G.wrigglers.count() });
    if (popLog.length > 300) popLog.shift();
  }

  function drawGraph(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = 2, W = canvas.clientWidth || 300, H = canvas.clientHeight || 120;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (popLog.length < 2) { ctx.fillStyle = '#6a8a8f'; ctx.font = `700 12px ${UI_FONT}`; ctx.fillText('Watching the pond…', 10, 20); return; }
    const pad = { l: 34, r: 10, t: 10, b: 20 };
    const t0 = popLog[0].t, t1 = popLog[popLog.length - 1].t;
    const maxV = Math.max(12, ...popLog.map(p => Math.max(p.algae, p.bugs, p.wrigglers))) * 1.1;
    const X = (t) => pad.l + (t - t0) / Math.max(1, t1 - t0) * (W - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - v / maxV) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(40,90,90,.12)'; ctx.lineWidth = 1;
    ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#6a8a8f'; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { const v = maxV / 1.1 * i / 4; ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(Math.round(v), pad.l - 6, Y(v) + 3); }
    ctx.fillStyle = 'rgba(224,57,47,.35)';
    for (const t of eatMarks) { if (t < t0) continue; ctx.fillRect(X(t) - .5, H - pad.b - 6, 1, 6); }
    const line = (key, col, w, dash) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.lineJoin = 'round'; ctx.beginPath(); popLog.forEach((e, k) => { const x = X(e.t), y = Y(e[key]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]); };
    line('algae', '#3f8a2e', 2.4);
    line('bugs', '#2a6fb8', 1.8);
    line('wrigglers', '#a08a4a', 1.6, [4, 3]);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3f8a2e'; ctx.fillText('algae', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#2a6fb8'; ctx.fillText('flying bugs', pad.l + 44, pad.t + 10);
    ctx.fillStyle = '#a08a4a'; ctx.fillText('wrigglers', pad.l + 112, pad.t + 10);
    ctx.fillStyle = '#6a8a8f'; ctx.textAlign = 'right'; ctx.fillText(`last ${Math.round((t1 - t0) / 60)} min`, W - pad.r, H - 6);
  }

  /* ---------- photo mode ---------- */
  function photo(renderFn) {
    const src = renderFn();
    const name = `frogpond-day${G.day}-${G.pond.season}.png`;
    try {
      src.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
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
    add('photo', 'Photo', `${STAGES[p.stage].name.toLowerCase()}, ${G.pond.season}, day ${G.day}.`, { icon: 'camera', thumb });
    Bus.emit('photo');
    return thumb;
  }

  /* ---------- the book ---------- */
  function renderBook() {
    const list = $('journalList');
    if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple';
    const shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Hatch, swim, grow legs and take photos: it all lands here.</p>'; return; }
    for (const e of shown) {
      const div = document.createElement('div');
      div.className = `jentry t-${e.type}`;
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
      if (e.type === 'sticker' && e.sticker) { const st = STICKERS.find(s => s.key === e.sticker); if (st) { const src = Stickers.image(st, 44, false); const c = document.createElement('canvas'); c.width = c.height = src.width; c.getContext('2d').drawImage(src, 0, 0); c.style.width = c.style.height = '44px'; return c; } }
      if (['egg', 'tadpole', 'legs', 'tail', 'froglet', 'frog', 'pad', 'heron', 'nymph', 'dragonfly'].includes(e.icon)) { const c = Sprites.iconEl(e.icon, G.players[0].species, 44); c.style.width = c.style.height = '44px'; return c; }
      const span = document.createElement('span');
      span.textContent = { rain: '🌧️', snow: '❄️', ice: '🧊', spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️', fact: '💡', camera: '📷', note: '🎵', turtle: '🐢', snake: '🐍', raccoon: '🦝', toad: '🐸', fish: '🐟', guide: '🔍', map: '🗺️', book: '📖' }[e.icon] || '📝';
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
