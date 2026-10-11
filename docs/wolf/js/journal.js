/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how heavy you are in kilograms on a "times ten"
   scale (0.5 kg, 5 kg, 50 kg), so a newborn and a grown wolf fit
   on one page; every growth step is marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'wolf.journal';
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
    const form = () => FORMS[G.form] || FORMS.gray;
    const kg = (p) => p.kg.toFixed(1);
    Bus.on('firstDrink', (p) => add('milestone', 'Born in the den', `Generation ${G.generation}: a ${form().name.toLowerCase()} pup, born in a den in the hillside in April. Blind, deaf and half a kilo, and already drinking milk.`, { icon: 'den' }));
    Bus.on('eyesOpen', () => add('milestone', 'My eyes opened', 'Two weeks old. Everything is blue and blurry, and I can see my mum for the first time.', { icon: 'eyes' }));
    Bus.on('grewUp', (p, age) => {
      if (age === 2) add('milestone', 'Out of the den', `Three weeks old and ${kg(p)} kg. I wobbled out into the light and met my brothers and sisters properly.`, { icon: 'pup' });
      if (age === 3) add('milestone', 'The summer meadow', `Eight weeks old and ${kg(p)} kg. The pack moved us to a rendezvous site: a meadow to play in while the grown-ups find food.`, { icon: 'meadow' });
      if (age === 4) add('milestone', 'One year old', `A yearling, ${kg(p)} kg. Spring is back and there is a new litter in the den.`, { icon: 'yearling' });
      if (age === 5) add('milestone', 'Grown up', `A grown wolf, ${kg(p)} kg, with a mate and a valley of our own.`, { icon: 'adult' });
    });
    Bus.on('firstPlay', () => add('event', 'Play!', 'My first play-fight with a litter-mate: a play bow, a pounce, a roll in the grass. Nobody hurt.', { icon: 'pups' }));
    Bus.on('firstHowl', () => add('event', 'My first howl', 'The pack howled, so I put my nose up and howled too. Out came a tiny yip.', { icon: 'howl' }));
    Bus.on('ravenNear', () => { if (G.player && !G.player.flags.ravenLogged) { G.player.flags.ravenLogged = true; add('event', 'A raven', 'A raven hopped right up to the den, just out of reach. Ravens follow wolves everywhere.', { icon: 'raven' }); } });
    Bus.on('firstMeal', () => add('event', 'A meal brought home', 'A grown-up came home with a meal inside and brought it up for us. Yum.', { icon: 'meal' }));
    Bus.on('firstPounce', () => add('event', 'Pounce!', 'I stalked a grasshopper and pounced. It hopped away. Practice!', { icon: 'grasshopper' }));
    Bus.on('sheltered', () => add('event', 'A storm', 'Thunder rolled over the hills. I waited it out under a tree, then shook the rain off.', { icon: 'storm' }));
    Bus.on('firstSniff', (p, s) => add('event', 'A scent on the breeze', `I sniffed the air and knew it: ${SCENT_KINDS[s.kind].name}. My nose can tell who went by.`, { icon: 'scent' }));
    Bus.on('travel', (p) => add('milestone', 'On the move', `Autumn. I am ${kg(p)} kg and nearly as big as the grown-ups. The pack is travelling, one behind another, and I am in the line.`, { icon: 'pack' }));
    Bus.on('firstTrack', (p, t) => add('event', 'Tracks', TRACK_KINDS[t.kind].say, { icon: 'tracks' }));
    Bus.on('looked', (p, t) => { if (p.stats.looks > 1) add('event', `${TRACK_KINDS[t.kind].name} tracks`, TRACK_KINDS[t.kind].say, { icon: 'tracks' }); });
    Bus.on('swimStart', () => add('event', 'The river', 'I waded in and swam across the cold river, then shook myself dry on the far bank.', { icon: 'river' }));
    Bus.on('firstPost', () => add('event', 'The scent post', 'A rock at the edge of our territory that smells of my whole pack. Mum and Dad mark it to say: ours.', { icon: 'post' }));
    Bus.on('packFound', () => add('event', 'Lost and found', 'I lost the pack in the dark, so I howled. From far away they howled back, and came to find me.', { icon: 'howl' }));
    Bus.on('winterCame', () => add('milestone', 'Winter', 'Deep snow over the whole valley. We walk single file; the wolf in front breaks the trail.', { icon: 'snow' }));
    Bus.on('rested', () => add('event', 'A warm rest', 'I got too cold, so I curled up with my tail over my nose until I was warm again.', { icon: 'tail' }));
    Bus.on('chaseEnd', (p) => add('event', 'The chase', `We ran at the elk herd. They got away, as they mostly do. Chase number ${p.stats.chases}.`, { icon: 'elk' }));
    Bus.on('feast', (p) => add('milestone', 'A feast', `The pack found a meal. Everyone ate until they were full, then slept it off in the snow. I am ${kg(p)} kg.`, { icon: 'pack' }));
    Bus.on('biologistMet', () => add('event', 'The wolf scientist', 'A scientist with a radio antenna was listening for our collared yearling. She waved.', { icon: 'antenna' }));
    Bus.on('babysat', () => add('event', 'Babysitting', 'I played with the new pups and kept them near the den, the way a yearling did for me.', { icon: 'pups' }));
    Bus.on('guarded', () => add('event', 'Keeping watch', 'I sat at the den mouth and kept watch while the grown-ups were away.', { icon: 'den' }));
    Bus.on('dispersed', (p) => add('milestone', 'Leaving home', `${kg(p)} kg and grown. I left my pack to find a mate and a place of my own: a lone wolf.`, { icon: 'lone' }));
    Bus.on('underpass', () => add('event', 'The tunnel', 'A road cut across my way. I went through the tunnel built under it for animals.', { icon: 'tunnel' }));
    Bus.on('met', (p, o) => { if (o && o.role === 'mate') add('milestone', 'My mate', 'Far from home I met another lone wolf. We sniffed, we played, we wagged. A pair now.', { icon: 'mate' }); });
    Bus.on('claimed', () => add('milestone', 'Our valley', 'We marked the scent posts and howled together. This valley is ours.', { icon: 'valley' }));
    Bus.on('denMade', () => add('milestone', 'The den', 'We dug a den into the soft hillside: a long tunnel and a round room for the pups.', { icon: 'den' }));
    Bus.on('firstGiven', () => add('event', 'Food for the den', 'My mate is in the den with the pups, so I bring the meals home.', { icon: 'meal' }));
    Bus.on('barked', () => add('event', 'Shoo!', 'A raven came pestering at the den mouth. One bark and it flapped off, unhurt.', { icon: 'raven' }));
    Bus.on('firstNurse', () => add('event', 'Milk', 'My pups are born: blind, deaf and hungry. They found me by smell and drank.', { icon: 'milk' }));
    Bus.on('pupHome', () => add('event', 'Carried home', 'One pup wobbled out to the den mouth. I carried it back by the scruff, very gently.', { icon: 'pup' }));
    Bus.on('generationDone', () => add('milestone', 'A new pack', 'The pups are out of the den. Pup, big pup, yearling, lone wolf, parent: the whole life of a wolf.', { icon: 'parent' }));
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
    const Y = (kg) => pad.t + (1 - (Math.log10(clamp(kg, .3, 80)) + .5) / 2.4) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const [v, l] of [[.5, '½ kg'], [5, '5 kg'], [50, '50 kg']]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(l, pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,120,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#4a6a8a'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.kg); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#4a6a8a'; ctx.fillText('how heavy I am', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = growing up', W - 70, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `wolf-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}, ${p.kg.toFixed(1)} kg.`, { icon: 'camera', thumb });
    Bus.emit('photo');
  }

  function renderBook() {
    const list = $('journalList'); if (!list) return;
    list.innerHTML = '';
    const simple = G.settings.reading === 'simple', shown = entries.slice().reverse();
    if (!shown.length) { list.innerHTML = '<p class="tiny">Nothing yet. Drink, play, howl, grow and take photos: it all lands here.</p>'; return; }
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
  const ICONS = ['wolf', 'pup', 'pups', 'newborn', 'bigpup', 'yearling', 'lone', 'adult', 'parent', 'mate', 'pack', 'mum', 'dad', 'den', 'milk', 'meal', 'raven', 'grasshopper', 'elk', 'bison', 'tracks', 'paw', 'scent', 'nose', 'river', 'snow', 'tail', 'storm', 'howl', 'eyes', 'meadow', 'post', 'valley', 'tunnel', 'antenna'];
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
