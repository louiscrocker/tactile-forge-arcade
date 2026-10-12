/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how heavy you are in kilograms on a "times ten"
   scale (0.5 kg, 5 kg, 50 kg, 500 kg), so a newborn and a grown bear fit
   on one page; every growth step is marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'polarbear.journal';
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
  /* how heavy the player is, in kilograms */
  function sizeKG(p) { return p.kg; }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.cream;
    const kg = (p) => p.kg < 2 ? p.kg.toFixed(1) : Math.round(p.kg);
    Bus.on('firstDrink', (p) => add('milestone', 'Born in a snow den', `Generation ${G.generation}: a polar bear cub with a ${form().short.toLowerCase()} coat, born in a snow den in the middle of winter. Tiny, blind and about 600 grams, and already drinking milk.`, { icon: 'den' }));
    Bus.on('eyesOpen', () => add('milestone', 'My eyes opened', 'One month old. The snow walls of the den glow blue, and I can see Mum and my twin.', { icon: 'eyes' }));
    Bus.on('grewUp', (p, age) => {
      if (age === 2) add('milestone', 'Out into the light', `March, and ${kg(p)} kg. Mum broke open the den and my twin and I climbed out into the snow.`, { icon: 'cub' });
      if (age === 3) add('milestone', 'The walk to the sea', `${kg(p)} kg. After two weeks by the den, Mum is leading us on the long walk to the sea ice.`, { icon: 'mum' });
      if (age === 4) add('milestone', 'One year old', `A yearling, ${kg(p)} kg. Back on the sea ice with Mum, trying things by myself.`, { icon: 'yearling' });
      if (age === 5) add('milestone', 'Grown up', `A grown polar bear, ${kg(p)} kg, wandering the sea ice.`, { icon: 'bear' });
    });
    Bus.on('firstPlay', () => add('event', 'Play!', 'My first play-fight with my twin: a push, a roll in the snow. Nobody hurt.', { icon: 'cubs' }));
    Bus.on('firstWindSniff', () => add('event', 'Sniffing the wind', 'I stood up on my back legs and sniffed the wind. So many smells!', { icon: 'sniff' }));
    Bus.on('slid', (p) => { if (p.stats.slides === 1) add('event', 'Wheee!', 'I slid all the way down the snowy hill on my tummy.', { icon: 'slide' }); });
    Bus.on('foxNear', () => { if (G.player && !G.player.flags.foxLogged) { G.player.flags.foxLogged = true; add('event', 'An Arctic fox', 'A little white fox was following us. When I came near, it trotted away.', { icon: 'fox' }); } });
    Bus.on('sheltered', () => add('event', 'A blizzard', 'The wind howled and the snow flew. We curled up behind the big rock until it blew over.', { icon: 'blizzard' }));
    Bus.on('firstTrack', (p, t) => add('event', 'Tracks', TRACK_KINDS[t.kind].say, { icon: 'tracks' }));
    Bus.on('looked', (p, t) => { if (p.stats.looks > 1) add('event', `${TRACK_KINDS[t.kind].name} tracks`, TRACK_KINDS[t.kind].say, { icon: 'tracks' }); });
    Bus.on('onIce', (p) => { if (p.age === 3) add('milestone', 'The sea ice', 'We walked right out onto the frozen sea. Polar bears are sea bears!', { icon: 'ice' }); });
    Bus.on('waited', (p) => add('event', p.age >= 4 ? 'My own seal hole' : 'Keeping still', 'I waited by a breathing hole without moving. A seal came up to breathe… and slipped away again.', { icon: 'hole' }));
    Bus.on('stalked', (p, how) => add('event', 'The careful creep', how === 'close' ? 'I crept right up close to a resting seal. Splash! It slid into its hole.' : 'I crept up on a resting seal, but it looked up and saw me. Splash!', { icon: 'seal' }));
    Bus.on('feast', (p) => add('milestone', 'A feast', `Mum found a meal at last and shared it. We ate until we were full, then slept for a long time. I am ${kg(p)} kg.`, { icon: 'meal' }));
    Bus.on('mumFound', () => add('event', 'Lost and found', 'A whiteout! I lost Mum in the blowing snow, so I stood up and sniffed the wind until I found her scent.', { icon: 'mum' }));
    Bus.on('swimStart', (p) => { if (!p.flags.swimLogged) { p.flags.swimLogged = true; add('event', 'Swimming', 'I swam in the icy sea, paddling with my big front paws.', { icon: 'swim' }); } });
    Bus.on('ashore', () => add('milestone', 'Summer on land', 'The sea ice broke up and melted. We swam to the shore to wait for it to freeze again. The sun hardly sets!', { icon: 'shore' }));
    Bus.on('scientistMet', () => add('event', 'The scientists', 'Scientists in a big tundra buggy were listening for Mum\'s radio collar. They waved from their safe place.', { icon: 'buggy' }));
    Bus.on('firstPounce', () => add('event', 'Pounce!', 'I crept up on a lemming and pounced. It dived into its burrow. Practice!', { icon: 'lemming' }));
    Bus.on('firstSniff', (p, s) => add('event', 'A scent on the wind', `I sniffed the air and knew it: ${SCENT_KINDS[s.kind].name}. My nose can tell who went by.`, { icon: 'scent' }));
    Bus.on('aurora', () => add('event', 'The northern lights', 'The dark nights came back, and green curtains of light danced across the sky.', { icon: 'lights' }));
    Bus.on('freezeUp', () => add('milestone', 'Freeze-up', 'The sea is freezing again: slush, then thin ice, then thick ice. Soon we can go back out.', { icon: 'ice' }));
    Bus.on('rested', () => add('event', 'A warm rest', 'I got too cold, so I curled up tight with my nose tucked in until I was warm again.', { icon: 'tail' }));
    Bus.on('wentAlone', (p) => add('milestone', 'On my own', `Two and a half years old and ${kg(p)} kg. Mum walked off over the ice, and so did I: a young bear on my own.`, { icon: 'young' }));
    Bus.on('ridge', (p) => { if (p.age >= 4) add('event', 'A pressure ridge', 'A wall of ice blocks, piled up where the ice pushed together. I climbed right over it.', { icon: 'ridge' }); });
    Bus.on('leadSwim', () => add('event', 'Across the lead', 'A long crack of open water split the ice. I swam across it.', { icon: 'lead' }));
    Bus.on('playEnd', (p, n) => { if (n && n.role === 'young' && !p.flags.sparLogged) { p.flags.sparLogged = true; add('event', 'Play-sparring', 'Two young males were play-fighting on the ice, standing up and pushing. I joined in. Nobody got hurt.', { icon: 'spar' }); } if (n && n.role === 'bigmale' && !p.flags.bigLogged) { p.flags.bigLogged = true; add('event', 'A big male', 'I stood up and play-sparred with a huge male. We pushed and wrestled, mouths open wide, nobody hurt.', { icon: 'spar' }); } });
    Bus.on('met', (p, o) => { if (o && o.role === 'mate') add('milestone', 'A walk together', 'I followed a scent across the ice and met another grown bear. We walked together for a while.', { icon: 'mate' }); });
    Bus.on('denMade', () => add('milestone', 'My den', 'Back on the hills where I was born, I dug a den into the soft peat bank: a tunnel and a round room.', { icon: 'den' }));
    Bus.on('firstNurse', () => add('event', 'Milk', 'My cubs are born in the middle of winter: tiny, blind and hungry. They drink my rich milk.', { icon: 'milk' }));
    Bus.on('cubHome', () => add('event', 'Carried home', 'One cub wobbled up to the den mouth. I carried it back, very gently.', { icon: 'cub' }));
    Bus.on('generationDone', () => add('milestone', 'New cubs', 'New cubs in the spring snow. Newborn, cub, yearling, young bear, grown bear: the whole life of a polar bear.', { icon: 'parent' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p) return;
    growLog.push({ t: G.time, kg: +sizeKG(p).toFixed(2), k: 'a' + p.age });
    if (growLog.length > 600) growLog.shift();
  }

  function drawGraph(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = 2, W = canvas.clientWidth || 300, H = canvas.clientHeight || 120;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const pts = growLog;
    if (pts.length < 2) { ctx.fillStyle = '#8a7a66'; ctx.font = `700 12px ${UI_FONT}`; ctx.fillText('Weighing…', 10, 20); return; }
    const pad = { l: 44, r: 10, t: 10, b: 20 }, t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const X = (t) => pad.l + (t - t0) / Math.max(1, t1 - t0) * (W - pad.l - pad.r);
    const Y = (kg) => pad.t + (1 - (Math.log10(clamp(kg, .3, 700)) + .5) / 3.4) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const [v, l] of [[.5, '½ kg'], [5, '5 kg'], [50, '50 kg'], [500, '500 kg']]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(l, pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,120,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#4a6a8a'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.kg); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#4a6a8a'; ctx.fillText('how heavy I am', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = growing up', W - 70, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `polarbear-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}, ${p.kg < 2 ? p.kg.toFixed(1) : Math.round(p.kg)} kg.`, { icon: 'camera', thumb });
    Bus.emit('photo');
  }

  function renderBook() {
    const list = $('journalList'); if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple', shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Drink, play, slide, sniff, grow and take photos: it all lands here.</p>'; return; }
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
  const ICONS = ['bear', 'cub', 'cubs', 'twin', 'newborn', 'seacub', 'yearling', 'young', 'adult', 'parent', 'mate', 'mum', 'den', 'milk', 'meal', 'seal', 'hole', 'fox', 'lemming', 'tracks', 'paw', 'scent', 'nose', 'snow', 'ice', 'floe', 'ridge', 'lead', 'swim', 'shore', 'tail', 'blizzard', 'sniff', 'slide', 'spar', 'eyes', 'buggy', 'lights', 'antenna'];
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
  function restore(o) { growLog = o && Array.isArray(o.growLog) ? o.growLog.filter(e => e && Number.isFinite(e.t) && Number.isFinite(e.kg)) : []; }
  function dropPhotos() { let n = 0; for (const e of entries) if (e.thumb) { delete e.thumb; n++; } if (n) save(); return n; }
  function resetGrowth() { growLog = []; }

  return { init, update, add, drawGraph, photo, renderBook, clear, serialize, restore, dropPhotos, resetGrowth, sizeKG, entries: () => entries };
})();
