/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how heavy you are on a "times ten" scale (a
   milligram up to a tonne), so a tiny hatchling and a giant
   sunfish fit on one page: sixty million times heavier.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'sunfish.journal';
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
  /* how heavy the player is, in grams */
  function sizeMM(p) { return molaKG(p.cm) * 1000; }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.normal;
    const cm = (p) => p.cm.toFixed(1);
    const kg = (p) => { const k = molaKG(p.cm); return k < .001 ? `${(k * 1e6).toFixed(0)} mg` : k < 1 ? `${(k * 1000).toFixed(0)} g` : k < 1000 ? `${k.toFixed(0)} kg` : `${(k / 1000).toFixed(1)} tonnes`; };
    const len = (p) => p.cm < 1 ? `${(p.cm * 10).toFixed(1)} mm` : p.cm < 100 ? `${p.cm.toFixed(0)} cm` : `${(p.cm / 100).toFixed(1)} m`;
    Bus.on('hatched', () => add('milestone', 'I hatched', `Generation ${G.generation}: one of three hundred million eggs, a ${form().name.toLowerCase()}. I hatched in the warm open sea, smaller than a grain of rice.`, { icon: 'larva' }));
    Bus.on('grew', (p) => add('milestone', p.stage === 'larva' && p.zinstar === 2 ? 'A spiky star!' : 'Bigger!', p.stage === 'larva' && p.zinstar === 2 ? 'I grew spikes all over. I look like a tiny star, or a tiny pufferfish (my cousin).' : `I am ${len(p)} long now and weigh about ${kg(p)}.`, { icon: p.stage === 'larva' ? 'starlarva' : p.stage === 'juvenile' ? 'juvenile' : 'mola' }));
    Bus.on('juvenile', () => add('milestone', 'No tail!', 'My spikes are fading, and a frilly rudder called the clavus is growing where a tail would be. I swim with a school of other young sunfish.', { icon: 'juvenile' }));
    Bus.on('mola', (p) => add('milestone', 'A real sunfish', `Now I look like a real sunfish: round and flat, flapping my tall fins like wings. I am ${len(p)} long.`, { icon: 'mola' }));
    Bus.on('ateJelly', (p, f) => { if (p.stats.jellies === 1) add('event', 'My first jelly', `I dived down and slurped up a ${FOOD_KINDS[f.kind].name}.`, { icon: 'jelly' }); });
    Bus.on('warmed', (p) => { if (p.stats.basks === 1) add('event', 'Sunbathing', 'After a cold dive I lay flat on my side at the top of the sea and warmed up in the sun.', { icon: 'sun' }); });
    Bus.on('gullDone', () => add('event', 'A gull helped', 'A gull landed on me while I basked and pecked the itchy sea lice off my skin.', { icon: 'gullstand' }));
    Bus.on('cleaned', () => add('event', 'The cleaning station', 'In the kelp forest near the shore I held very still while little señoritas and halfmoon fish picked me clean.', { icon: 'cleaner' }));
    Bus.on('jumped', () => add('event', 'Splash!', 'I swam up fast and leapt right out of the sea. The sea lice shook off when I landed.', { icon: 'mola' }));
    Bus.on('dodged', (p, v) => { if (v && VISITOR_KINDS[v.kind]) add('event', 'Too quick!', `A ${VISITOR_KINDS[v.kind].name} came for a look. One big flap and it missed me.`, { icon: v.kind }); });
    Bus.on('boatSlow', () => add('event', 'Slow down!', 'A boat crossed the top. The skipper saw my fin and slowed right down.', { icon: 'boat' }));
    Bus.on('freed', () => add('event', 'Let go!', 'I swam into a fishing net by mistake. The fishers lifted me out and let me go.', { icon: 'net' }));
    Bus.on('ready', (p) => add('milestone', 'A giant!', `I am a giant sunfish: ${len(p)} long and about ${kg(p)}. From a hatchling, that is millions of times heavier.`, { icon: 'giant' }));
    Bus.on('arrived', () => add('milestone', 'The warm sea', 'I swam all the way back out to the warm sea, where I was an egg. Other grown sunfish are here.', { icon: 'sea' }));
    Bus.on('met', (p) => add('milestone', 'Hello!', p.sex === 'boy' ? 'I met a girl sunfish with hearts all around.' : 'I met a boy sunfish with hearts all around.', { icon: 'heart' }));
    Bus.on('cloud', () => add('milestone', 'A little cloud', 'I let my milky cloud go beside her. Days later, her eggs drifted in the sea.', { icon: 'cloud' }));
    Bus.on('eggsReleased', (p) => add('milestone', 'Eggs away!', `Each time the swell rose I let my eggs go: about ${fmtInt(p.stats.eggsOut)} of them, drifting in the warm sea.`, { icon: 'eggs' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }

  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'egg') return;
    const k = p.stage === 'mola' ? 'm' + p.size : p.stage === 'larva' ? 'z' + p.zinstar : 'j' + p.jsize;
    growLog.push({ t: G.time, mm: +sizeMM(p).toPrecision(3), k });
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
    const Y = (g) => pad.t + (1 - (Math.log10(clamp(g, .001, 3e6)) + 3) / 9.5) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const [v, l] of [[.001, '1 mg'], [1, '1 g'], [1000, '1 kg'], [1e6, '1 tonne']]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(l, pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,80,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#2a6ab0'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.mm); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#2a6ab0'; ctx.fillText('how heavy I am', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = growth steps', W - 70, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `sunfish-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}${p.stage === 'mola' ? `, ${(p.cm / 100).toFixed(1)} m long` : ''}.`, { icon: 'camera', thumb });
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
  const ICONS = ['egg', 'eggs', 'larva', 'starlarva', 'juvenile', 'mola', 'giant', 'sunfish', 'jelly', 'sun', 'gullstand', 'cleaner', 'boat', 'net', 'sea', 'heart', 'cloud', 'dorado', 'tuna', 'sealion', 'orca', 'shark', 'turtle', 'deep', 'kelp', 'plankton'];
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
