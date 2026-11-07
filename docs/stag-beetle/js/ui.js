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
    $('btnCards').addEventListener('click', () => openCards());
    $('cardClose').addEventListener('click', () => show('cardBook', false));
    $('btnSkipYear').addEventListener('click', () => { Story.skipYear(); AudioFX.click(); });
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

  function buildWheel() {
    const ol = $('wheel'); ol.innerHTML = '';
    wheelEls = STAGES.map((st) => {
      const li = document.createElement('li');
      li.appendChild(Sprites.icon(st.key, 40, G.form));
      const s = document.createElement('span'); s.textContent = st.short; li.appendChild(s);
      li.title = st.name;
      li.addEventListener('click', () => Microscope.open(G, { egg: 'egg', grub1: 'grub', grub2: 'grub', grub3: 'grub', pupa: 'pupa', beetle: G.form === 'girl' ? 'female' : 'male', champ: G.form === 'girl' ? 'female' : 'male' }[st.key]));
      ol.appendChild(li);
      return li;
    });
  }
  function buildForms(grid) {
    grid.innerHTML = '';
    for (const key of FORM_KEYS) {
      const f = FORMS[key], b = document.createElement('button');
      b.dataset.form = key;
      const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d'); g.scale(2, 2); g.translate(26, 36); Sprites.drawBeetle(g, { s: .27, form: key, male: f.male, lengthMM: f.male ? 75 : 44, seed: 3 });
      b.appendChild(c);
      const t = document.createElement('span'); t.textContent = f.short; b.appendChild(t);
      b.addEventListener('click', () => { cb.onForm(key); AudioFX.click(); Voice.say(`${f.name}. ${simple() ? f.simple : f.blurb}`, { interrupt: true }); });
      grid.appendChild(b);
    }
  }
  function refreshForms() {
    document.querySelectorAll('.species-grid button').forEach(b => b.classList.toggle('on', b.dataset.form === G.settings.form));
    const f = FORMS[G.settings.form] || FORMS.boy;
    const bl = $('formBlurb'); bl.innerHTML = '';
    const bb = document.createElement('b'); bb.textContent = f.name; const ii = document.createElement('i'); ii.textContent = ` (${f.latin}) `;
    bl.append(bb, ii, document.createTextNode('— ' + (simple() ? f.simple : f.blurb)));
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
  const ACT_LABEL = { eat: 'SIP', push: 'WRESTLE', sneak: 'SNEAK', build: 'MAKE ROOM', hi: 'SAY HI', bite: 'BITE', sniff: 'SMELL', rear: 'REAR UP', dig: 'DIG', lay: 'LAY EGG' };
  function describe(p) {
    const D = G.diff();
    let k = 'You are', name = STAGES[STAGE_INDEX[p.stageKey()]].name, prog = 0, ptxt = '';
    if (p.stageKey() === 'champ' && !p.male) name = 'Mother beetle';
    if (p.stage === 'egg') { prog = clamp(p.eggT / 4, 0, 1) * .5 + p.crack * .5; ptxt = p.flags.eggReady ? 'Wiggle out!' : 'Growing inside…'; }
    else if (p.stage === 'grub') {
      const q = Story.quest;
      prog = clamp(p.food / (D.full * BONUS), 0, 1);
      ptxt = p.molting > 0 ? 'Moulting…' : p.tight > 0 ? 'Too tight! Moulting soon' : q ? (simple() ? YEARS[q.y].simple : YEARS[q.y].goal) : p.full ? (p.chamberReady() ? 'Make your cocoon!' : 'Dig into the soil') : `Antlers grow as you eat · ${p.grams.toFixed(1)} g`;
    }
    else if (p.stage === 'chamber') { prog = p.build / D.chamber; ptxt = 'Pressing the walls…'; name = 'Building the cocoon'; }
    else if (p.stage === 'pupa') { prog = clamp(p.pupaT / PUPA_T, 0, 1); ptxt = 'Changing… a whole winter'; }
    else if (p.mode === 'tunnel') {
      if (p.flags.digDown) { prog = clamp(p.stats.eggs / D.eggs, 0, 1); ptxt = p.flags.laid ? 'Dig up!' : `Eggs: ${p.stats.eggs} of ${D.eggs}`; name = 'Digging down'; }
      else { prog = clamp(p.hardT / HARDEN_T, 0, 1); ptxt = p.hardT < HARDEN_T ? 'Hardening…' : 'Dig up!'; name = p.hardT < HARDEN_T ? 'A soft new beetle' : name; }
    }
    else { prog = p.energy; ptxt = `Wings · ${(p.lengthMM / 10).toFixed(1)} cm`; }
    return { name, prog, ptxt, k };
  }
  function update(dt = 1 / 60) {
    const p = G.players[0], F = G.forest, d = describe(p);
    const sky = F.weather.rain > .4 ? '🌧️' : F.weather.cloud > .5 ? '☁️' : p.underground ? ['🌱', '☀️', '🍂', '❄️'][seasonOf(G.yt)] : '🌆';
    const weigh = p.stage === 'adult' || p.stage === 'pupa' ? `${(p.lengthMM / 10).toFixed(1)} cm` : p.stage === 'egg' ? '—' : `${p.grams.toFixed(1)} g`;
    const when = p.stage === 'adult' && p.flags.summer ? `Evening ${G.evening}` : `Year ${G.year}`;
    const sig = `${d.name}|${Math.round(d.prog * 100)}|${d.ptxt}|${weigh}|${when}|${sky}|${p.stats.wins + p.stats.sneaks}|${p.stageKey()}|${Cards.count()}`;
    if (sig !== lastHUD) {
      lastHUD = sig;
      $('stageK').textContent = d.k; $('stageName').textContent = d.name;
      $('progBar').style.width = (d.prog * 100).toFixed(1) + '%'; $('progText').textContent = d.ptxt;
      $('progBar').classList.toggle('energy', p.stage === 'adult' && p.mode !== 'tunnel');
      $('roNight').textContent = when;
      $('weatherBadge').textContent = sky;
      $('roWeigh').textContent = weigh; $('roWeighK').textContent = p.stage === 'adult' || p.stage === 'pupa' ? '📏 Size' : '⚖️ Weight';
      $('roWins').textContent = p.stats.wins + p.stats.sneaks;
      $('roCards').textContent = Cards.count();
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
    const act = $('btnAction'), v = p.context ? p.context() : null;
    let label = v ? ACT_LABEL[v] : (p.stage === 'grub' ? 'EAT ➜' : 'GO!');
    if (p.mode === 'flipped') label = 'ROCK!'; if (p.mode === 'bite') label = 'BITE!';
    if (Reading.on() && p.mode !== 'ring' && p.mode !== 'sneak' && p.mode !== 'bite' && p.mode !== 'flipped') label = '📖 GO!';
    if (p.mode === 'ring') label = p.ring && p.ring.state === 'lift' ? 'LIFT!' : 'PUSH!';
    if (act.textContent !== label) act.textContent = label;
    const fly = $('btnFly');
    const singing = p.stage === 'grub';
    fly.hidden = !(singing || (p.stage === 'adult' && p.mode !== 'tunnel'));
    const fl = singing ? 'SING' : p.mode === 'ring' ? 'HOOK!' : p.mode === 'fly' ? 'LAND' : 'FLY';
    if (fly.dataset.l !== fl) { fly.dataset.l = fl; fly.innerHTML = (fl === 'SING' ? '🎵' : fl === 'HOOK!' ? '💪' : fl === 'LAND' ? '⬇️' : '🪽') + '<br>' + fl; }
    const skip = $('btnSkipYear'); const canSkip = Story.canSkip(); if (skip.hidden === canSkip) skip.hidden = !canSkip;
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
    if (p && (p.mode === 'ring' || p.mode === 'tossed' || p.mode === 'sneak' || p.mode === 'bite') && factQueue.length) { factOpen = true; factGap = setTimeout(nextFact, 1500); return; }
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
    const t = $('stickerToast'), c = $('stickerToastCanvas'), ctx = c.getContext('2d'), card = st.card;
    ctx.clearRect(0, 0, c.width, c.height); if (card) { const cv = cardCanvas(card, true); ctx.drawImage(cv, 0, 20, 160, 100); } else ctx.drawImage(Stickers.image(st, 80, false), 0, 0, 160, 160);
    t.querySelector('.stage-k').textContent = card ? 'New card!' : 'New sticker!';
    $('stickerToastName').textContent = card ? card.name : simple() ? st.simple : st.name;
    t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    const below = [$('hud'), $('missionCard')].filter(el => el && !el.hidden).reduce((y, el) => Math.max(y, el.getBoundingClientRect().bottom), 0);
    if (innerWidth <= 560) t.style.top = Math.round(below + 10) + 'px'; else t.style.top = '';
    toastTimer = 4.5; AudioFX.sticker && AudioFX.sticker();
    Voice.say(card ? `New card! ${card.name}` : `New sticker! ${simple() ? st.simple : st.name}`);
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
  /* ---------- the card book ---------- */
  function cardCanvas(c, has) {
    const cv = document.createElement('canvas'), w = 210, h = 130; cv.width = w * 2; cv.height = h * 2; cv.style.width = '100%';
    const g = cv.getContext('2d'); g.scale(2, 2);
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, has ? '#3a5a3e' : '#8f8a80'); bg.addColorStop(1, has ? '#16281c' : '#6a665e'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.translate(w * .48, h * .6);
    if (c.friend) { g.fillStyle = '#b8a24a'; g.beginPath(); g.ellipse(-16, 4, 34, 18, 0, 0, TAU); g.fill(); g.fillStyle = '#141210'; g.beginPath(); g.moveTo(10, -8); g.quadraticCurveTo(40, -36, 72, -24); g.lineTo(70, -18); g.quadraticCurveTo(44, -22, 20, 8); g.closePath(); g.fill(); g.beginPath(); g.ellipse(14, 6, 11, 10, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(16, 2); g.quadraticCurveTo(38, 0, 50, -12); g.lineTo(50, -6); g.quadraticCurveTo(38, 8, 18, 10); g.closePath(); g.fill(); }
    else {
      const rival = c.rival, s = .82 * (rival ? clamp(c.len / 75, .6, 1) : clamp(.5 + c.len / 200, .45, .95));
      const key = 'c_' + c.key; if (!FORMS[key]) FORMS[key] = { name: c.name, wing: c.col, wing2: mixHex(c.col, '#000000', .55), wet: c.col, body: c.col2 && !rival ? mixHex(c.col2, '#000000', .3) : '#15100f', male: true };
      g.translate(-34, -6);
      Sprites.drawBeetle(g, { s, form: rival ? 'r_' + c.key : key, male: true, lengthMM: rival ? c.len : 35 + 40 * clamp(c.jaw, 0, 1) });
    }
    if (!has) { g.setTransform(2, 0, 0, 2, 0, 0); g.fillStyle = 'rgba(70,66,60,.82)'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8d4c8'; g.font = '900 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', w / 2, h / 2); }
    return cv;
  }
  function openCards() {
    AudioFX.click();
    const fill = (el, keys) => {
      el.innerHTML = '';
      for (const k of keys) {
        const c = Cards.lookup(k), has = Cards.has(k), b = document.createElement('button'); b.className = 'tcard' + (has ? '' : ' locked');
        b.appendChild(cardCanvas(c, has));
        const n = document.createElement('b'); n.textContent = has ? c.name : '???'; b.appendChild(n);
        const w = document.createElement('i'); w.textContent = has ? (c.rival ? `${(c.len / 10).toFixed(1)} cm · Power ${'★'.repeat(c.power)} · Tricks ${'★'.repeat(c.trick)}` : `${c.where} · ${(c.len / 10).toFixed(1)} cm`) : ''; b.appendChild(w);
        const t = document.createElement('span'); t.textContent = has ? (simple() ? c.simple : c.card) : ''; b.appendChild(t);
        b.addEventListener('click', () => { if (has) Voice.say(`${c.name}. ${simple() ? c.simple : c.card}`, { interrupt: true, force: true }); });
        el.appendChild(b);
      }
    };
    fill($('cardRivals'), RIVALS.map(r => r.key)); fill($('cardCousins'), COUSINS.map(c => c.key));
    $('cardCount').textContent = `${Cards.count()} / ${Cards.total()}`;
    show('cardBook', true);
  }
  function onCard(c) { toastQueue.push({ card: c }); if (toastTimer <= 0) showSticker(toastQueue.shift()); }
  function openJournal() { AudioFX.click(); Journal.renderBook(); show('journal', true); }
  function hideTitle() { $('title').classList.add('out'); }
  function showTitle(hasSave) { $('title').classList.remove('out'); $('btnContinue').hidden = !hasSave; }
  function choice() {
    const p = G.player, yrs = p.stats.years + 1, age = Above.ageOf(G);
    const done = p.male ? (p.stats.sneaks > p.stats.wins ? `You slipped past ${p.stats.sneaks} rivals.` : `You flipped ${p.stats.wins} rivals off the branch.`) : `You laid ${p.stats.eggs} eggs by the old wood.`;
    $('choiceSummary').textContent = simple() ? `${yrs} years in the stump. One summer. ${done}` : `${yrs} years in the stump, one summer in the air. You grew to ${(p.lengthMM / 10).toFixed(1)} cm. ${done} The child in the garden is ${age} now. Egg, grub, pupa, beetle, and eggs again: that is the whole life cycle.`;
    show('choice', true); Voice.say(simple() ? 'New eggs! Be a new grub, or keep playing?' : 'A new generation of eggs is under the logs. Hatch as one of them, or keep playing?', { interrupt: true }); }
  function anyModalOpen() { return ['help', 'stickerBook', 'cardBook', 'journal', 'microscope', 'choice', 'readCard', 'readPage', 'myWords'].some(id => !$(id).hidden); }
  /* the next-generation choice is not dismissed by Escape: it is a decision */
  function closeModals() { ['help', 'stickerBook', 'cardBook', 'journal', 'microscope', 'myWords', 'drawer'].forEach(id => show(id, false)); }

  return { init, update, hint, openCards, onCard, refreshToggles, refreshForms, buildWheel, hideTitle, showTitle, choice, resetFacts, queueFact, onSticker, openStickers, openJournal, anyModalOpen, closeModals, isFactOpen: () => factOpen, T };
})();
