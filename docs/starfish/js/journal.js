/* ============================================================
   journal.js — the field journal, photos and the growth graph
   ============================================================
   Every big moment, fact and photo becomes a dated page in the
   journal, which persists in the browser and prints nicely.  The
   graph shows how wide you are on a "times ten" scale (0.1 mm to
   1 m), so a tiny larva and a big sea star fit on one page; every
   growth step is marked.
   ============================================================ */
'use strict';

const Journal = (function () {
  const KEY = 'starfish.journal';
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
  /* how wide the player is, in millimetres (arm tip to arm tip, or the larva's length) */
  function sizeMM(p) {
    if (p.stage === 'egg') return .15;
    if (p.stage === 'larva') return [0, .4, .6, .9][p.zinstar] + p.r * .02;
    if (p.stage === 'postlarva') return 1;
    return p.cm * 10;
  }

  function init(game) {
    G = game; load();
    const form = () => FORMS[G.form] || FORMS.normal;
    const cm = (p) => p.cm.toFixed(1);
    Bus.on('hatched', () => add('milestone', 'I hatched', `Generation ${G.generation}: a ${form().name.toLowerCase()} egg, one of millions my mother let go on a spring evening tide. I hatched into a see-through larva that swims with tiny beating hairs.`, { icon: 'larva' }));
    Bus.on('grew', (p, i) => add('milestone', i === 2 ? 'Bigger!' : 'Sticky arms!', i === 2 ? 'I ate diatoms and little green plant cells and grew bigger.' : 'Three little sticky arms grew at my front. Soon I can hold on to a rock.', { icon: i === 3 ? 'postlarva' : 'larva' }));
    Bus.on('postlarva', () => add('milestone', 'Back to the shore', 'After weeks at sea I am ready to settle. Time to swim back to the rocks and find a good pink rock.', { icon: 'postlarva' }));
    Bus.on('whalePassed', () => add('event', 'A grey whale!', 'A whale as long as a bus swam right past me on its way north. Its wave tumbled me over and over.', { icon: 'whale' }));
    Bus.on('settled', () => add('milestone', 'A tiny star!', 'I found a pink rock with nobody on it and held on with my sticky arms. Then I changed completely: now I am a sea star smaller than a pinhead, with five arms.', { icon: 'juvenile' }));
    Bus.on('firstFood', (p, it) => add('event', 'My first meal on the rocks', `I ate a ${FOOD_KINDS[it.kind].name}.`, { icon: it.kind === 'spat' ? 'barnacle' : it.kind }));
    Bus.on('grewStar', (p, i) => add('milestone', i >= 4 ? 'A big sea star!' : `I grew (rest ${p.stats.rests})`, i >= 4 ? `Now I am a big ochre sea star, ${cm(p)} cm from arm tip to arm tip. The mussel bed is mine to eat.` : `I rested in a cool, safe place and grew. Now I am ${cm(p)} cm across.`, { icon: i >= 4 ? 'adult' : 'rest' }));
    Bus.on('wetAgain', (p, shade) => { if (shade === 'pool' && !p.flags.poolPage) { p.flags.poolPage = true; add('event', 'A tide pool', 'The tide went out and left me in the air. I crawled into a tide pool and was cool and wet again.', { icon: 'pool' }); } });
    Bus.on('curl', (p) => { if (!p.flags.curlPage) { p.flags.curlPage = true; add('event', 'Too dry!', 'The sun and wind dried me out, so I held my water in and waited. A wave came and splashed me wet again.', { icon: 'dry' }); } });
    Bus.on('held', (p) => { if (!p.flags.heldPage) { p.flags.heldPage = true; add('event', 'I held on!', 'A big wave crashed over the rocks. I held on tight with all my tube feet and it rolled right over me.', { icon: 'hold' }); } });
    Bus.on('ateFood', (p, it) => { if (it.kind === 'mussel' && !p.flags.musselPage) { p.flags.musselPage = true; add('event', 'My first mussel', 'I pulled and pulled until the mussel\'s shell opened a crack, then I pushed my stomach inside and ate it.', { icon: 'stomach' }); } });
    Bus.on('keystone', () => add('milestone', 'Room for everyone', 'I have eaten so many mussels that there is bare rock on the shore again. Anemones, barnacles, seaweed and limpets are moving in. Sea stars make room for everyone.', { icon: 'keystone' }));
    Bus.on('dodged', (p, h) => add('event', 'Holding tight', `A ${HUNTER_KINDS[h.kind].name} tried to pull me off the rock, but I held on tight with my tube feet. It gave up and went away.`, { icon: h.kind }));
    Bus.on('escaped', () => add('event', 'Run away!', 'A huge sunflower star came hunting. I hurried away on my tube feet, and it went the other way.', { icon: 'sunflower' }));
    Bus.on('putBack', () => add('event', 'Looked at, gently', 'A child tide-pooling lifted me up very gently to look at me, then put me back right where I was.', { icon: 'kid' }));
    Bus.on('counted', () => add('event', 'Counted!', 'A scientist laid a square frame on the rock and counted and measured me, to check how the sea stars are doing.', { icon: 'scientist' }));
    Bus.on('armTip', () => add('event', 'An arm tip let go', 'A winter wave wedged the tip of one arm under a rock, so I let it go. It does not hurt a sea star, and it will grow back.', { icon: 'arm' }));
    Bus.on('regrown', () => add('event', 'Good as new', 'My arm has grown back.', { icon: 'arm' }));
    Bus.on('winter', () => add('milestone', 'Winter storms', 'The biggest waves of the year are crashing on the shore. I am holding on tight.', { icon: 'storm' }));
    Bus.on('spring', () => add('milestone', 'Spring', 'The sea is warmer and green with plankton. The sea stars are gathering on the rocks.', { icon: 'spring' }));
    Bus.on('met', (p) => add('milestone', p.sex === 'boy' ? 'The girls are here' : 'The boys are here', p.sex === 'boy' ? 'I crawled up beside the girl sea stars. Time to stand tall.' : 'I crawled up beside the boy sea stars. Time to stand tall.', { icon: 'mate' }));
    Bus.on('released', (p) => add('milestone', p.sex === 'girl' ? 'Eggs away!' : 'My cloud went', p.sex === 'girl' ? `I stood tall on my arm tips and let about ${fmtInt(p.stats.babiesOut)} eggs go into the sea.` : 'I stood tall on my arm tips and let my milky cloud go, right beside the girls and their eggs.', { icon: p.sex === 'girl' ? 'eggs' : 'cloud' }));
    Bus.on('factRead', (key) => { const f = FACTS[key]; if (f) add('fact', f.title, G.settings.reading === 'simple' ? f.simple : f.body, { icon: 'fact', more: f.more }); });
    Bus.on('sticker', (st) => add('sticker', `Sticker: ${st.name}`, G.settings.reading === 'simple' ? st.simple : st.name, { icon: 'sticker', sticker: st.key }));
    Bus.on('readLevel', (L, why) => add('event', why === 'up' ? `Reading level ${L}!` : `Reading at level ${L}`, why === 'up' ? 'I read so well that my reading level went up.' : 'Practising at an easier level for a while.', { icon: 'book' }));
  }
  function update(dt) {
    logClock -= dt; if (logClock > 0) return; logClock = 2;
    const p = G.player; if (!p || p.stage === 'egg') return;
    const k = p.stage === 'star' ? 'c' + p.instar : p.stage === 'larva' ? 'z' + p.zinstar : 'm';
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
    const Y = (mm) => pad.t + (1 - (Math.log10(clamp(mm, .1, 1000)) + 1) / 4) * (H - pad.t - pad.b);
    ctx.strokeStyle = 'rgba(90,60,30,.14)'; ctx.lineWidth = 1; ctx.font = `700 10px ${UI_FONT}`; ctx.fillStyle = '#8a7a66'; ctx.textAlign = 'right';
    for (const [v, l] of [[.1, '0.1 mm'], [1, '1 mm'], [10, '1 cm'], [100, '10 cm'], [1000, '1 m']]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(l, pad.l - 5, Y(v) + 3); }
    for (let k = 1; k < pts.length; k++) if (pts[k].k !== pts[k - 1].k) { ctx.strokeStyle = 'rgba(200,80,40,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(pts[k].t), pad.t); ctx.lineTo(X(pts[k].t), H - pad.b); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#2a6ab0'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((e, k) => { const x = X(e.t), y = Y(e.mm); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#2a6ab0'; ctx.fillText('my arm span', pad.l + 4, pad.t + 10);
    ctx.fillStyle = '#c87828'; ctx.textAlign = 'center'; ctx.fillText('dashes = growth steps', W - 70, H - 6);
  }

  function photo(renderFn) {
    const src = renderFn();
    const name = `starfish-day${G.day}.png`;
    try { src.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); } catch (e) { /* headless or blocked */ }
    const th = document.createElement('canvas'), tw = 320, thh = Math.round(320 * src.height / src.width);
    th.width = tw; th.height = thh; th.getContext('2d').drawImage(src, 0, 0, tw, thh);
    let thumb = null; try { thumb = th.toDataURL('image/jpeg', .7); } catch (e) { thumb = null; }
    const p = G.players[0];
    add('photo', 'Photo', `${STAGES[STAGE_INDEX[p.stageKey()]].name}${p.stage === 'star' ? `, ${p.cm.toFixed(1)} cm across` : ''}.`, { icon: 'camera', thumb });
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
  const ICONS = ['egg', 'eggs', 'cloud', 'larva', 'postlarva', 'juvenile', 'young', 'adult', 'star', 'mate', 'arm', 'rest', 'pool', 'dry', 'hold', 'storm', 'spring', 'stomach', 'keystone', 'whale', 'kid', 'scientist', 'gull', 'otter', 'crab', 'sunflower', 'mussel', 'barnacle', 'limpet', 'snail', 'chiton', 'shell', 'kelp'];
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
