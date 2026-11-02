/* ============================================================
   ui.js — HUD, the life wheel, fact cards, title, settings,
            sticker book, journal, growth graph, narration
   ============================================================ */
'use strict';

const UI = (function () {
  const $ = (id) => document.getElementById(id);
  let G, cb;
  let factQueue = [], factOpen = false, factsSeen = new Set(), factKey = null;
  let lastHUD = '', hintKey = '', hintText = '', stageIconKey = '';
  let wheelEls = [], toastTimer = 0, toastQueue = [], graphClock = 0;

  const simple = () => G.settings.reading === 'simple';
  const T = (key) => { const h = HINTS[key]; if (!h) return key; return Array.isArray(h) ? h[simple() ? 1 : 0] : h; };

  function init(game, callbacks) {
    G = game; cb = callbacks;
    buildWheel();
    buildForms($('formPick')); buildForms($('formPickDrawer'));
    for (const grp of ['sexPick', 'sexPickDrawer']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onSex(b.dataset.sex); AudioFX.click(); const s = SEXES[b.dataset.sex]; Voice.say(`${s.name}. ${simple() ? s.simple : s.blurb}`, { interrupt: true }); refreshToggles(); }));
    $('btnStart').addEventListener('click', () => cb.onStart(false));
    $('btnContinue').addEventListener('click', () => cb.onStart(true));
    for (const grp of ['diffPickTitle', 'diffPick']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => setDiff(b.dataset.diff)));
    for (const grp of ['readPick', 'readPickDrawer']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReading(b.dataset.read); AudioFX.click(); refreshToggles(); }));
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadMode(b.dataset.rm); AudioFX.click(); refreshToggles(); Voice.say(b.dataset.rm === 'play' ? 'I read to play. Pick your level.' : 'Read to me.', { interrupt: true }); }));
      const box = $('readLevel' + sfx);
      for (const L of [...READ_LEVELS, 'auto']) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.rl = L; b.textContent = L === 'auto' ? '⚙ Auto' : L; b.title = L === 'auto' ? 'Move up or down by itself' : LEVEL_INFO[L].about; b.addEventListener('click', () => { cb.onReadLevel(L); AudioFX.click(); refreshToggles(); }); box.appendChild(b); }
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadHelp(b.dataset.rh); AudioFX.click(); refreshToggles(); }));
    $('btnMyWords').addEventListener('click', () => { show('drawer', false); Reading.openWords(); });
    $('btnHelp').addEventListener('click', () => { show('help', true); AudioFX.click(); });
    $('helpClose').addEventListener('click', () => show('help', false));
    $('btnMenu').addEventListener('click', () => { show('drawer', $('drawer').hidden); AudioFX.click(); });
    $('drawerClose').addEventListener('click', () => show('drawer', false));
    for (const [id, key] of [['btnLabels', 'labels'], ['tgLabels', 'labels'], ['tgSoundChip', 'sound'], ['btnVoice', 'voice'], ['tgVoice', 'voice'], ['tgVoiceTitle', 'voice'], ['tgVisitors', 'visitors'], ['tgSlow', 'slowmo'], ['tgPad', 'pad'], ['tgClock', 'clock'], ['tgScience', 'science'], ['btnFast', 'fast']])
      $(id).addEventListener('click', () => cb.onToggle(key));
    $('selQuality').addEventListener('change', (e) => cb.onQuality(e.target.value));
    $('sTod').addEventListener('input', (e) => cb.onTod(e.target.value / 100));
    $('btnNewGame').addEventListener('click', () => { show('drawer', false); cb.onNewGame(); });
    $('btnPhoto').addEventListener('click', () => cb.onPhoto());
    $('btnScope').addEventListener('click', () => { Microscope.open(G); AudioFX.click(); });
    $('btnBook').addEventListener('click', () => openStickers());
    $('btnStickersDrawer').addEventListener('click', () => { show('drawer', false); openStickers(); });
    $('stickerClose').addEventListener('click', () => show('stickerBook', false));
    $('btnJournal').addEventListener('click', () => openJournal());
    $('btnJournalDrawer').addEventListener('click', () => { show('drawer', false); openJournal(); });
    $('journalClose').addEventListener('click', () => show('journal', false));
    $('journalPrint').addEventListener('click', () => window.print());
    $('journalClear').addEventListener('click', () => { if (confirm('Clear the whole journal?')) Journal.clear(); });
    $('scienceClose').addEventListener('click', () => cb.onToggle('science'));
    $('factClose').addEventListener('click', closeFact);
    $('factOk').addEventListener('click', () => { if (factKey) Bus.emit('factRead', factKey); closeFact(); });
    $('factSay').addEventListener('click', () => { Voice.say(`${$('factTitle').textContent}. ${$('factBody').textContent}`, { interrupt: true, force: true }); });
    $('hintSay').addEventListener('click', () => Voice.say(hintText, { interrupt: true, force: true }));
    $('btnNextGen').addEventListener('click', () => { show('choice', false); cb.onNextGeneration(); });
    $('btnKeep').addEventListener('click', () => { show('choice', false); refreshToggles(); });
    $('btnNextGenDrawer').addEventListener('click', () => { show('drawer', false); cb.onNextGeneration(); });
    Bus.on('fact', queueFact);
    Bus.on('hint', (k) => hint(k));
    Bus.on('cinematic', (title) => { if (title && !Reading.on()) Voice.say(title, { interrupt: false }); });
    Microscope.init();
    refreshToggles();
  }
  function show(id, on) { $(id).hidden = !on; }

  const SCOPE_FOR = { egg: 'egg', larva: 'larva', postlarva: 'postlarva', juvenile: 'juvenile', young: 'boy', adult: 'boy', spawn: 'girl' };
  function buildWheel() {
    const ol = $('wheel'); ol.innerHTML = '';
    wheelEls = STAGES.map((st) => {
      const li = document.createElement('li');
      li.appendChild(Sprites.icon(st.key, 40, G.form));
      const s = document.createElement('span'); s.textContent = st.short; li.appendChild(s);
      li.title = st.name;
      li.addEventListener('click', () => { const k = SCOPE_FOR[st.key]; Microscope.open(G, (k === 'boy' || k === 'girl') && G.player ? (G.player.sex === 'girl' ? 'girl' : 'boy') : k); });
      ol.appendChild(li);
      return li;
    });
  }
  function buildForms(grid) {
    grid.innerHTML = '';
    for (const key of FORM_KEYS) {
      const f = FORMS[key], b = document.createElement('button');
      b.dataset.form = key;
      const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d'); g.scale(2, 2); g.translate(30, 34); Sprites.drawStar(g, { w: 50, form: key, face: true, seed: 3 });
      b.appendChild(c);
      const t = document.createElement('span'); t.textContent = f.short; b.appendChild(t);
      b.addEventListener('click', () => { cb.onForm(key); AudioFX.click(); Voice.say(`${f.name}. ${simple() ? f.simple : f.blurb}`, { interrupt: true }); });
      grid.appendChild(b);
    }
  }
  function refreshForms() {
    document.querySelectorAll('.species-grid button').forEach(b => b.classList.toggle('on', b.dataset.form === G.settings.form));
    document.querySelectorAll('.sex-pick button').forEach(b => b.classList.toggle('on', b.dataset.sex === G.settings.sex));
    const f = FORMS[G.settings.form] || FORMS.normal, s = SEXES[G.settings.sex] || SEXES.boy;
    const bl = $('formBlurb'); bl.innerHTML = '';
    const bb = document.createElement('b'); bb.textContent = `${f.name}, ${s.short.toLowerCase()}`; const ii = document.createElement('i'); ii.textContent = ` (${f.latin}) `;
    bl.append(bb, ii, document.createTextNode('— ' + (simple() ? `${f.simple} ${s.simple}` : `${f.blurb} ${s.blurb}`)));
    $('formPower').textContent = '✦ ' + f.power;
  }
  function setDiff(d) {
    cb.onDiff(d);
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === d));
    AudioFX.click();
  }
  function refreshToggles() {
    const s = G.settings, on = (id, v) => $(id).classList.toggle('on', !!v);
    on('btnLabels', s.labels); on('tgLabels', s.labels); on('tgSoundChip', s.sound);
    on('btnVoice', s.voice); on('tgVoice', s.voice); on('tgVoiceTitle', s.voice);
    $('btnVoice').textContent = s.voice ? '🔊' : '🔇';
    on('tgVisitors', s.visitors); on('tgSlow', s.slowmo); on('tgPad', s.pad); on('tgClock', s.clock);
    $('tgClock').textContent = s.clock ? 'Clock running' : 'Clock paused';
    on('tgScience', s.science); $('science').hidden = !s.science;
    on('btnFast', G.fast);
    $('selQuality').value = s.quality;
    $('pad').hidden = !s.pad; document.body.classList.toggle('pad-on', s.pad);
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === s.difficulty));
    document.querySelectorAll('#readPick button, #readPickDrawer button').forEach(b => b.classList.toggle('on', b.dataset.read === s.reading));
    document.body.classList.toggle('simple', s.reading === 'simple');
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rm === (s.readMode || 'listen')));
      $('readLevel' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rl === 'auto' ? !!s.readAuto : b.dataset.rl === (s.readLevel || 'B')));
      $('readLevel' + sfx).hidden = s.readMode !== 'play';
      $('readAbout' + sfx).textContent = s.readMode === 'play' ? `${LEVEL_INFO[s.readLevel || 'B'].name}: ${LEVEL_INFO[s.readLevel || 'B'].about}${s.readAuto ? ' The level moves up or down by itself.' : ''}` : 'Everything is read aloud. Pick "I read to play" to make reading how the game is played.';
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rh === (s.readHelp || 'auto')));
    document.body.classList.toggle('read-play', s.readMode === 'play');
    $('btnNextGenDrawer').hidden = !(cb.canNextGen && cb.canNextGen());
    refreshForms();
  }

  /* ---------- HUD ---------- */
  const ACT_LABEL = { eat: 'EAT', settle: 'HOLD ON', rest: 'REST', count: 'HOLD STILL', meet: 'SAY HI', arch: 'STAND TALL', toodry: 'WAIT…' };
  const ROMAN = ['', 'I', 'II', 'III'];
  function describe(p) {
    const D = G.diff(), Wd = G.world;
    let name = STAGES[STAGE_INDEX[p.stageKey()]].name, prog = 0, ptxt = '';
    if (p.stage === 'egg') { prog = clamp(p.eggT / 4, 0, 1) * .5 + p.crack * .5; ptxt = p.flags.eggReady ? 'Ready! Wiggle to hatch!' : 'Drifting on the tide…'; }
    else if (p.stage === 'larva') {
      const th = [0, ...D.larva], i = p.zinstar;
      prog = clamp((p.food - th[i - 1]) / (th[i] - th[i - 1]), 0, 1);
      name = i < 3 ? `Swimming larva ${ROMAN[i]}` : 'Larva with sticky arms';
      ptxt = p.growing > 0 ? 'Growing…' : p.tight > 0 ? 'Growing soon' : i < 3 ? 'Eat the tiny plants to grow' : 'Eat until you can settle';
    } else if (p.stage === 'postlarva') {
      const onShore = p.x > WORLD.lowL - 360;
      prog = onShore ? .7 + clamp((p.y - 60) / 120, 0, 1) * .3 : clamp(1 - (WORLD.lowL - 360 - p.x) / 1800, 0, .7);
      ptxt = !onShore ? `Swim to the shore · ${Math.round(Math.max(0, WORLD.lowL - 360 - p.x) / UNITS_PER_M)} m` : 'Find a pink rock with nobody on it';
    } else {
      const cm = `${p.cm.toFixed(1)} cm`;
      if (p.mode === 'rest') { prog = 1 - p.resting / REST_T; ptxt = 'Resting · growing…'; }
      else if (p.mode === 'curl') { prog = clamp(p.curlT / CURL_WAIT, 0, 1); ptxt = 'Too dry! Waiting for a wave…'; }
      else if (p.mode === 'lifted') { prog = .5; ptxt = 'Lifted up to look at… gently!'; }
      else if (p.mode === 'arch') { prog = p.rel ? p.rel.good / D.blows : 0; ptxt = `${p.sex === 'girl' ? 'Eggs' : 'Cloud'} let go · ${p.rel ? p.rel.good : 0} / ${D.blows}`; }
      else if (p.flags.spring) { prog = p.flags.released ? 1 : p.flags.met ? .6 : .3; ptxt = p.flags.released ? 'Millions of eggs in the sea!' : p.flags.met ? 'Stand tall when the wave glows' : (p.sex === 'boy' ? 'Find the girls with hearts' : 'Find the boys with hearts'); }
      else if (p.flags.storm) { prog = clamp((p.flags.stormHeld || 0) / D.storm, 0, 1); ptxt = 'Winter storm! Hold on (E) for each wave'; }
      else if (p.instar < 4) {
        const th = [0, ...D.grow], i = p.instar;
        prog = clamp((p.cfood - th[i - 1]) / (th[i] - th[i - 1]), 0, 1);
        ptxt = p.full ? (p.restReady() ? 'Full! Press Space to rest' : 'Full! Rest in a pool or a crack') : p.exposed ? `Tide out: stay wet · ${cm}` : `Eat to grow · ${cm}`;
      } else { prog = clamp(Wd.keystone / D.keystone, 0, 1); ptxt = p.flags.keystone ? `Keeper of the shore · ${Wd.lifeCount()} kinds of life` : `Eat mussels: ${Math.min(Wd.keystone, D.keystone)} / ${D.keystone} · ${cm}`; }
    }
    return { name, prog, ptxt };
  }
  const MOON_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  function update(dt = 1 / 60) {
    const p = G.players[0], Wd = G.world, d = describe(p);
    const sky = Wd.weather.snow > .4 ? '🌨️' : Wd.weather.storm > .4 ? '🌊' : Wd.weather.cloud > .5 ? '☁️' : (G.night > .5 ? '🌙' : '☀️');
    const size = p.stage === 'egg' ? '0.2 mm' : p.stage === 'star' ? (p.cm < 1 ? `${(p.cm * 10).toFixed(1)} mm` : `${p.cm.toFixed(1)} cm`) : `${Journal.sizeMM(p).toFixed(1)} mm`;
    const safe = p.stage === 'star' ? `${Math.round(p.wet * 100)}%` : '—', tide = `${Wd.tideDir() > 0 ? '▲' : '▼'} ${Wd.tideM().toFixed(1)} m`;
    const moon = MOON_EMOJI[Math.round(((G.moon % 1) + 1) % 1 * 8) % 8];
    const sig = `${d.name}|${Math.round(d.prog * 100)}|${d.ptxt}|${size}|${G.day}|${sky}|${safe}|${moon}|${tide}|${p.stageKey()}|${Wd.season}|${Math.round(Wd.temp)}`;
    if (sig !== lastHUD) {
      lastHUD = sig;
      $('stageName').textContent = d.name;
      $('progBar').style.width = (d.prog * 100).toFixed(1) + '%'; $('progText').textContent = d.ptxt;
      $('roDay').textContent = `Day ${G.day}`; $('roSeason').textContent = SEASON_INFO[Wd.season][0];
      $('weatherBadge').textContent = `${sky} ${Math.round(Wd.temp)}°`;
      $('roSize').textContent = size;
      $('roWater').textContent = safe; $('roWater').parentElement.classList.toggle('warn', p.stage === 'star' && p.wet < .3);
      if ($('roTide')) $('roTide').textContent = tide;
      $('roMoon').textContent = moon; $('roMoon').parentElement.title = moonName(G.moon);
      const si = STAGE_INDEX[p.stageKey()];
      wheelEls.forEach((li, i) => { li.classList.toggle('done', i < si); li.classList.toggle('now', i === si); });
    }
    const ik = `${p.stageKey()}|${G.form}`;
    if (ik !== stageIconKey) {
      stageIconKey = ik;
      const c = $('stageIcon'), ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(Sprites.icon(p.stageKey(), 56, G.form), 0, 0, 112, 112);
    }
    document.body.classList.toggle('timing', p.mode === 'arch');
    const act = $('btnAction'), v = p.context ? p.context() : null;
    let label = v ? ACT_LABEL[v] : 'GO!';
    if (Reading.on() && p.mode !== 'arch') label = '📖 GO!';
    if (p.mode === 'arch') label = p.sex === 'girl' ? 'EGGS!' : 'CLOUD!';
    if (act.textContent !== label) act.textContent = label;
    const dash = $('btnDash');
    dash.hidden = !(p.swimming || (p.stage === 'star' && p.mode === 'crawl'));
    const dl = p.swimming ? 'SWIM' : 'HOLD';
    if (dash.dataset.l !== dl) { dash.dataset.l = dl; dash.innerHTML = (dl === 'SWIM' ? '💨' : '✊') + '<br>' + dl; }
    if (G.settings.science) { graphClock -= dt; if (graphClock <= 0) { graphClock = .5; Journal.drawGraph($('scienceCanvas')); } }
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) { $('stickerToast').hidden = true; if (toastQueue.length) showSticker(toastQueue.shift()); } }
  }

  /* ---------- hints ---------- */
  let readHintTimer = null;
  function hint(keyOrText, flash = true) {
    const rt = Reading.hintText(keyOrText);
    if (rt) {
      if (rt === hintKey) return;
      hintKey = rt; hintText = rt;
      const h = $('hint'); $('hintText').textContent = rt;
      if (flash) { h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); }
      clearTimeout(readHintTimer);
      if (G.settings.readHelp !== 'ask') readHintTimer = setTimeout(() => { if (hintText === rt) Voice.say(rt, { interrupt: false }); }, LEVEL_INFO[Reading.level()].help * 1000);
      return;
    }
    const txt = T(keyOrText);
    if (txt === hintKey) return;
    hintKey = txt; hintText = txt;
    const h = $('hint'); $('hintText').textContent = txt;
    if (flash) { h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); }
    Voice.say(txt, { interrupt: true });
  }

  /* ---------- facts ---------- */
  function queueFact(key) { if (!FACTS[key] || factsSeen.has(key)) return; factsSeen.add(key); factQueue.push(key); if (!factOpen) nextFact(); }
  let factGap = null;
  function nextFact() {
    clearTimeout(factGap);
    const p = G.players[0];
    if (p && (p.mode === 'box' || p.mode === 'release' || p.mode === 'tossed' || Reading.busy()) && factQueue.length) { factOpen = true; factGap = setTimeout(nextFact, 1500); return; }
    const key = factQueue.shift();
    if (!key) { factOpen = false; return; }
    factOpen = true; factKey = key;
    const f = FACTS[key];
    $('factTitle').textContent = f.title; $('factBody').textContent = simple() ? f.simple : f.body;
    const more = $('factMore'); more.hidden = !f.more; if (f.more) more.href = f.more;
    const el = $('fact'); el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(nextFact._t); nextFact._t = setTimeout(closeFact, 30000);
    if (!Reading.on()) setTimeout(() => Voice.say(`${f.title}. ${simple() ? f.simple : f.body}`), 900);
  }
  function closeFact() { $('fact').hidden = true; clearTimeout(nextFact._t); clearTimeout(factGap); factGap = setTimeout(nextFact, 600); }
  function resetFacts() { clearTimeout(factGap); clearTimeout(nextFact._t); factQueue = []; factsSeen = new Set(); factOpen = false; $('fact').hidden = true; }

  /* ---------- stickers ---------- */
  function showSticker(st) {
    const t = $('stickerToast'), c = $('stickerToastCanvas'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(Stickers.image(st, 80, false), 0, 0, 160, 160);
    $('stickerToastName').textContent = simple() ? st.simple : st.name;
    t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    const below = [$('hud'), $('missionCard')].filter(el => el && !el.hidden).reduce((y, el) => Math.max(y, el.getBoundingClientRect().bottom), 0);
    if (innerWidth <= 900) t.style.top = Math.round(below + 10) + 'px'; else t.style.top = '';
    toastTimer = 4.5; AudioFX.sticker && AudioFX.sticker();
    Voice.say(`New sticker! ${simple() ? st.simple : st.name}`);
  }
  function onSticker(st) { if (toastTimer > 0) toastQueue.push(st); else showSticker(st); }
  function openStickers() {
    AudioFX.click();
    const grid = $('stickerGrid'); grid.innerHTML = '';
    let n = 0;
    for (const st of Stickers.all()) {
      const has = Stickers.has(st.key); if (has) n++;
      const b = document.createElement('button'); b.className = 'sticker' + (has ? '' : ' locked');
      const src = Stickers.image(st, 72, !has), img = document.createElement('canvas');
      img.width = src.width; img.height = src.height; img.getContext('2d').drawImage(src, 0, 0); img.style.width = img.style.height = '72px';
      b.appendChild(img);
      const s = document.createElement('span'); s.textContent = simple() ? st.simple : st.name; b.appendChild(s);
      b.addEventListener('click', () => Voice.say(has ? `${st.name}. ${st.simple}` : `Still locked: ${st.name}.`, { interrupt: true, force: true }));
      grid.appendChild(b);
    }
    $('stickerCount').textContent = `${n} / ${Stickers.all().length}`;
    show('stickerBook', true);
  }
  function openJournal() { AudioFX.click(); Journal.renderBook(); show('journal', true); }
  function hideTitle() { $('title').classList.add('out'); }
  function showTitle(hasSave) { $('title').classList.remove('out'); $('btnContinue').hidden = !hasSave; }
  function choice() { show('choice', true); Voice.say(simple() ? 'New eggs in the sea! Be one of them, or keep playing?' : 'Millions of new eggs are drifting out on the tide. Hatch as one of them, or keep playing as this sea star?', { interrupt: true }); }
  /* the settings drawer pauses the game too: nothing happens while a grown-up changes settings */
  function anyModalOpen() { return ['help', 'stickerBook', 'journal', 'microscope', 'choice', 'readCard', 'readPage', 'myWords', 'drawer'].some(id => !$(id).hidden); }
  /* the next-generation choice is not dismissed by Escape: it is a decision */
  function closeModals() { ['help', 'stickerBook', 'journal', 'microscope', 'myWords', 'drawer'].forEach(id => show(id, false)); }

  return { init, update, hint, refreshToggles, refreshForms, buildWheel, buildForms, hideTitle, showTitle, choice, resetFacts, queueFact, onSticker, openStickers, openJournal, anyModalOpen, closeModals, isFactOpen: () => factOpen, T };
})();
