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
  /* with the touch buttons on, hints name the buttons, not the keyboard (a tablet has no Space bar) */
  const padWords = (t) => !(G && G.settings.pad) || typeof t !== 'string' ? t : t.replace(/\b(press|Press|tap|Tap) Space\b/g, '$1 the big button').replace(/\b(hold|Hold) E\b/g, '$1 SNIFF').replace(/\bpress E\b/g, 'press the small button').replace(/: E!/g, ': small button!');
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

  const SCOPE_FOR = { newborn: 'newborn', cub: 'cub', seacub: 'cub', yearling: 'boy', young: 'boy', adult: 'boy', parent: 'girl' };
  function buildWheel() {
    const ol = $('wheel'); ol.innerHTML = '';
    wheelEls = STAGES.map((st) => {
      const li = document.createElement('li');
      li.appendChild(Sprites.icon(st.key, 40, G.form));
      const s = document.createElement('span'); s.textContent = st.short; li.appendChild(s);
      li.title = st.name;
      li.addEventListener('click', () => { const k = SCOPE_FOR[st.key]; Microscope.open(G, k === 'boy' && G.player && G.player.sex === 'girl' ? 'girl' : k); });
      ol.appendChild(li);
      return li;
    });
  }
  function buildForms(grid) {
    grid.innerHTML = '';
    for (const key of FORM_KEYS) {
      const f = FORMS[key], b = document.createElement('button');
      b.dataset.form = key;
      const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d'); g.scale(2, 2); g.translate(28, 38); Sprites.drawBear(g, { s: .56, form: key, age: 1, sex: G.settings.sex, seed: 3 });
      b.appendChild(c);
      const t = document.createElement('span'); t.textContent = f.short; b.appendChild(t);
      b.addEventListener('click', () => { cb.onForm(key); AudioFX.click(); Voice.say(`${f.name}. ${simple() ? f.simple : f.blurb}`, { interrupt: true }); });
      grid.appendChild(b);
    }
  }
  function refreshForms() {
    document.querySelectorAll('.species-grid button').forEach(b => b.classList.toggle('on', b.dataset.form === G.settings.form));
    document.querySelectorAll('.sex-pick button').forEach(b => b.classList.toggle('on', b.dataset.sex === G.settings.sex));
    const f = FORMS[G.settings.form] || FORMS.cream, s = SEXES[G.settings.sex] || SEXES.boy;
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
  const ACT_LABEL = { drink: 'DRINK', eat: 'EAT', play: 'PLAY', pounce: 'POUNCE', sniff: 'SNIFF', look: 'LOOK', wait: 'WAIT', creep: 'CREEP', slide: 'SLIDE', meet: 'SAY HI', hello: 'WAVE', dig: 'MAKE DEN', carry: 'CARRY', feed: 'FEED' };
  function describe(p) {
    const D = G.diff(), Wd = G.world, th = D.grow;
    let name = STAGES[STAGE_INDEX[p.stageKey()]].name, prog = 0, ptxt = '';
    const kg = `${p.kg < 2 ? p.kg.toFixed(1) : Math.round(p.kg)} kg`;
    const growth = (i) => clamp((p.food - (i ? th[i - 1] : 0)) / ((th[i] || th[3] * BONUS) - (i ? th[i - 1] : 0)), 0, 1);
    const ph = Wd.phase;
    if (p.mode === 'sleep') { prog = 1 - p.sleepT / SLEEP_T; ptxt = 'Time goes by…'; }
    else if (p.mode === 'rest') { prog = p.restT / REST_T; ptxt = 'Curled up, warming up…'; }
    else if (p.mode === 'play') { prog = (p.wr.p + 1) / 2; ptxt = p.age >= 4 ? 'Play-sparring!' : 'A play-fight!'; }
    else if (p.mode === 'sniff') { prog = p.sw.good / D.sniffs; ptxt = `Sniffing · ${p.sw.good} / ${D.sniffs}`; }
    else if (p.mode === 'still') { prog = p.st.q; ptxt = 'Keep still…'; }
    else if (p.mode === 'stalk') { prog = 0; ptxt = 'Creep… freeze when it looks!'; }
    else if (p.mode === 'slide') { prog = 1; ptxt = 'Wheee!'; }
    else if (p.age === 1) { prog = growth(0); ptxt = p.flags.eyesOpen ? `Drink to grow · ${kg}` : `Eyes shut · drink milk · ${kg}`; }
    else if (p.age === 2) { prog = growth(1); ptxt = p.full ? 'Ready for the walk to the sea!' : `Drink, play, slide · ${kg}`; }
    else if (p.age === 3) {
      if (ph === 'trek') { prog = clamp((p.x - Wd.den.x) / (WORLD.shoreX - Wd.den.x), 0, 1); ptxt = `Follow Mum to the sea · ${kg}`; }
      else if (ph === 'ice') { prog = p.flags.feasted ? 1 : clamp((Math.min(1, p.stats.waits) + Math.min(D.stalks, p.stats.stalks)) / (1 + D.stalks), 0, 1); ptxt = p.flags.feasted ? (p.flags.found ? 'Summer is coming' : 'Stay close to Mum') : `Wait at a hole, creep up on a seal · ${kg}`; }
      else if (ph === 'breakup') { prog = clamp((WORLD.iceR - p.x) / (WORLD.iceR - WORLD.shoreX), 0, 1); ptxt = 'Swim to the shore!'; }
      else { prog = p.flags.frozen ? 1 : p.flags.autumn ? .7 : (Wd.buggy && Wd.buggy.met ? .3 : 0) + (p.stats.pounces ? .3 : 0); ptxt = p.flags.frozen ? 'The sea is ice again!' : p.flags.autumn ? 'Autumn · waiting for the ice' : `Summer on land · ${kg}`; name = p.flags.autumn ? 'Cub in autumn' : 'Cub in summer'; }
    } else if (p.age === 4 && !p.flags.alone) { prog = clamp(((p.flags.soloWait ? 1 : 0) + (p.flags.soloStalk ? 1 : 0) + (p.stats.plays > (p.flags.playsAtYear || 0) ? 1 : 0) + (p.food >= th[2] + (th[3] - th[2]) * .5 ? 1 : 0)) / 4, 0, 1); ptxt = `Practise by myself · ${kg}`; }
    else if (p.age === 4) { prog = p.flags.sparred ? 1 : clamp((p.x - WORLD.holes[1]) / (WORLD.sparX - WORLD.holes[1]), 0, 1); ptxt = p.flags.sparred ? 'Growing up…' : `On my own · ${kg}`; }
    else if (ph === 'adult') { prog = p.flags.met ? .6 + (p.flags.sparBig ? .4 : 0) : p.flags.scentFound ? .4 : 0; ptxt = !p.flags.scentFound ? `Sniff the wind · ${kg}` : !p.flags.met ? 'Find the other bear' : p.sex === 'boy' ? (p.flags.sparBig ? 'Summer is coming' : 'A big male!') : 'Walking together'; }
    else if (p.sex === 'boy') { name = p.flags.cubsSeen ? 'Big male' : 'Big male'; prog = p.flags.cubsSeen ? 1 : .5; ptxt = p.flags.cubsSeen ? 'New cubs in the snow!' : `Summer on the shore · ${kg}`; }
    else if (!p.flags.denMade) { name = 'Mother-to-be'; prog = p.mode === 'burrow' ? clamp(p.depth / p.denDepth(), 0, 1) : 0; ptxt = !p.flags.denTime ? `Summer on the shore · ${kg}` : p.mode === 'burrow' ? (p.denReady() ? 'Deep enough! Make the den' : 'Dig deeper') : 'Dig a den in the bank'; }
    else { name = 'Mother bear'; prog = !p.flags.cubsBorn ? .2 : clamp(p.stats.nurses / D.nurses, 0, 1) * .6 + (p.stats.carries ? .2 : 0) + (p.flags.cubsOut ? .2 : 0); ptxt = !p.flags.cubsBorn ? 'Waiting for the cubs' : p.stats.nurses < D.nurses ? `Feed the cubs · ${p.stats.nurses} / ${D.nurses}` : !p.stats.carries ? 'A cub wandered off!' : p.flags.cubsOut ? 'Their first sniff of the wind!' : 'Spring is coming'; }
    return { name, prog, ptxt };
  }
  const MOON_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  function update(dt = 1 / 60) {
    const p = G.players[0], Wd = G.world, d = describe(p);
    /* during a timing game (play-fight, sniff, keep still, creep, slide) a phone hides the fact card and toast (style.css) */
    document.body.classList.toggle('timing', ['play', 'sniff', 'still', 'stalk', 'slide'].includes(p.mode));
    const sky = Wd.weather.state === 'storm' ? '⛈️' : Wd.weather.snow > .4 ? '🌨️' : Wd.weather.rain > .4 ? '🌧️' : Wd.weather.cloud > .5 ? '☁️' : (G.night > .5 ? '🌙' : '☀️');
    const size = `${p.kg < 2 ? p.kg.toFixed(1) : Math.round(p.kg)} kg`;
    const warm = `${Math.round(p.warmth * 100)}%`;
    const moon = MOON_EMOJI[Math.round(((G.moon % 1) + 1) % 1 * 8) % 8];
    const season = SEASONS[Wd.season] || SEASONS.spring;
    const sig = `${d.name}|${Math.round(d.prog * 100)}|${d.ptxt}|${size}|${G.day}|${sky}|${warm}|${moon}|${p.stageKey()}|${Wd.season}`;
    if (sig !== lastHUD) {
      lastHUD = sig;
      $('stageName').textContent = d.name;
      $('progBar').style.width = (d.prog * 100).toFixed(1) + '%'; $('progText').textContent = d.ptxt;
      $('roDay').textContent = `Day ${G.day}`; $('roSeason').textContent = `${season.emoji} ${season.name}`;
      $('roSeason').parentElement.className = 'ro season ' + Wd.season;
      $('weatherBadge').textContent = sky;
      $('roSize').textContent = size;
      $('roWater').textContent = warm; $('roWater').parentElement.classList.toggle('warn', p.warmth < .3);
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
    const timing = ['play', 'sniff', 'still', 'stalk', 'slide'].includes(p.mode);
    document.body.classList.toggle('timing', timing);
    const act = $('btnAction'), v = p.context ? p.context() : null;
    let label = v ? ACT_LABEL[v] : 'GO!';
    if (Reading.on() && !timing) label = '📖 GO!';
    if (p.mode === 'play') label = 'PUSH!';
    if (p.mode === 'still') label = 'SHH…';
    if (p.mode === 'stalk') label = 'CREEP';
    if (act.textContent !== label) act.textContent = label;
    const dash = $('btnDash');
    dash.hidden = !(p.mode === 'walk' || p.mode === 'den' || p.mode === 'burrow' || p.mode === 'play' || p.mode === 'sniff');
    const dl = p.mode === 'play' ? 'PUSH!' : 'SNIFF';
    if (dash.dataset.l !== dl) { dash.dataset.l = dl; dash.innerHTML = (dl === 'SNIFF' ? '🐻‍❄️' : '💥') + '<br>' + dl; }
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
    const txt = padWords(T(keyOrText));
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
    if (p && (['play', 'sniff', 'still', 'stalk', 'slide', 'tossed'].includes(p.mode) || Reading.busy()) && factQueue.length) { factOpen = true; factGap = setTimeout(nextFact, 1500); return; }
    const key = factQueue.shift();
    if (!key) { factOpen = false; return; }
    factOpen = true; factKey = key;
    const f = FACTS[key];
    $('factTitle').textContent = f.title; $('factBody').textContent = simple() ? f.simple : f.body;
    const more = $('factMore'); more.hidden = !f.more; if (f.more) more.href = f.more;
    const el = $('fact'); el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    /* a phone held upright: the card sits just under the HUD (and a mission), in the sky above the bear */
    el.style.top = innerWidth <= 560 ? Math.round(belowTop([$('hud'), $('missionCard')]) + 8) + 'px' : '';
    if (!$('stickerToast').hidden) placeToast();
    clearTimeout(nextFact._t); nextFact._t = setTimeout(closeFact, 30000);
    if (!Reading.on()) setTimeout(() => Voice.say(`${f.title}. ${simple() ? f.simple : f.body}`), 900);
  }
  function closeFact() { $('fact').hidden = true; clearTimeout(nextFact._t); clearTimeout(factGap); factGap = setTimeout(nextFact, 600); }
  function resetFacts() { clearTimeout(factGap); clearTimeout(nextFact._t); factQueue = []; factsSeen = new Set(); factOpen = false; $('fact').hidden = true; }

  /* ---------- stickers ---------- */
  const belowTop = (els) => els.filter(el => el && !el.hidden).reduce((y, el) => Math.max(y, el.getBoundingClientRect().bottom), 0);
  /* the toast goes under the HUD and a mission (and, on a phone, under an open fact card) */
  function placeToast() {
    const t = $('stickerToast'), below = belowTop([$('hud'), $('missionCard'), innerWidth <= 560 ? $('fact') : null]);
    if (innerWidth <= 900) t.style.top = Math.round(below + 10) + 'px'; else t.style.top = '';
  }
  function showSticker(st) {
    const t = $('stickerToast'), c = $('stickerToastCanvas'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(Stickers.image(st, 80, false), 0, 0, 160, 160);
    $('stickerToastName').textContent = simple() ? st.simple : st.name;
    t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    placeToast();
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
  function choice() { show('choice', true); Voice.say(simple() ? 'New cubs! Be one of them, or keep playing?' : 'New cubs have come out of a snow den. Be born as one of them, or keep playing as this bear?', { interrupt: true }); }
  /* the settings drawer pauses the game too: nothing gets cold while a grown-up changes settings */
  function anyModalOpen() { return ['help', 'stickerBook', 'journal', 'microscope', 'choice', 'readCard', 'readPage', 'myWords', 'drawer'].some(id => !$(id).hidden); }
  /* the next-generation choice is not dismissed by Escape: it is a decision */
  function closeModals() { ['help', 'stickerBook', 'journal', 'microscope', 'myWords', 'drawer'].forEach(id => show(id, false)); }

  return { init, update, hint, refreshToggles, refreshForms, buildWheel, buildForms, hideTitle, showTitle, choice, resetFacts, queueFact, onSticker, openStickers, openJournal, anyModalOpen, closeModals, isFactOpen: () => factOpen, T };
})();
