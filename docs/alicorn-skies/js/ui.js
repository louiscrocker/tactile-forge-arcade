/* ============================================================
   ui.js — HUD, quest card, talk box, hints, fact cards, toasts,
           title, settings, sticker book, diary, map modal
   ============================================================ */
'use strict';

const UI = (function () {
  const $ = (id) => document.getElementById(id);
  let G, cb;
  let factQueue = [], factOpen = false, factsSeen = new Set(), factKey = null;
  let lastHUD = '', lastQuest = '', iconKey = '', questIconKey = '', p2IconKey = '';
  let hintText = '';
  let toastTimer = 0, toastQueue = [], qToastTimer = 0;
  let mapRaf = 0;

  const simple = () => G.settings.reading === 'simple';
  const T = (key) => { const h = HINTS[key]; if (!h) return key; return Array.isArray(h) ? h[simple() ? 1 : 0] : h; };

  function init(game, callbacks) {
    G = game; cb = callbacks;
    $('btnStart').addEventListener('click', () => cb.onStart(false));
    $('btnContinue').addEventListener('click', () => cb.onStart(true));
    for (const grp of ['diffPickTitle', 'diffPick']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onDiff(b.dataset.diff); AudioFX.click(); refreshToggles(); }));
    for (const grp of ['readPick', 'readPickDrawer']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReading(b.dataset.read); AudioFX.click(); refreshToggles(); }));

    /* Read to Play */
    for (const grp of ['readModeDrawer', 'readModeTitle']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadMode(b.dataset.rm); AudioFX.click(); refreshToggles(); }));
    for (const grp of ['readLevelDrawer', 'readLevelTitle']) for (const L of READ_LEVELS) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.level = L; b.textContent = L; b.title = LEVEL_INFO[L].about; b.addEventListener('click', () => { cb.onReadLevel(L); AudioFX.click(); refreshToggles(); }); $(grp).appendChild(b); }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadHelp(b.dataset.rh); AudioFX.click(); refreshToggles(); }));
    $('btnMyWords').addEventListener('click', () => { show('drawer', false); Reading.openWords(); });
    $('btnHelp').addEventListener('click', () => { show('help', true); AudioFX.click(); });
    $('helpClose').addEventListener('click', () => show('help', false));
    $('btnMenu').addEventListener('click', () => { show('drawer', $('drawer').hidden); if (!$('drawer').hidden) Reading.renderReport(); AudioFX.click(); });
    $('drawerClose').addEventListener('click', () => show('drawer', false));
    const tg = { tgReadAuto: 'readAuto', tgGlow: 'glow', tgFollow: 'follow', tgRim: 'rim', btnLabels: 'labels', tgLabels: 'labels', tgSoundChip: 'sound', tgMusic: 'music', btnVoice: 'voice', tgVoice: 'voice', tgVoiceTitle: 'voice', tgArrow: 'arrow', tgStorms: 'storms', tgSlow: 'slowmo', tgPad: 'pad', tgClock: 'clock', tgP2: 'p2', tgGpSwap: 'gpP2' };
    for (const id in tg) $(id).addEventListener('click', () => cb.onToggle(tg[id]));
    $('selQuality').addEventListener('change', (e) => cb.onQuality(e.target.value));
    $('sTod').addEventListener('input', (e) => cb.onTod(e.target.value / 100));
    $('btnNewAdventure').addEventListener('click', () => { if (confirm('Start the story again? Your alicorn, stars and clothes stay.')) { show('drawer', false); cb.onNewAdventure(); } });
    $('btnRestart').addEventListener('click', () => { if (confirm('Make a brand new alicorn? This starts everything over.')) { show('drawer', false); cb.onRestart(); } });

    $('btnPhoto').addEventListener('click', () => cb.onPhoto());
    $('btnMap').addEventListener('click', () => openMap());
    $('btnMapDrawer').addEventListener('click', () => { show('drawer', false); openMap(); });
    $('mapClose').addEventListener('click', closeMap);
    $('btnWardrobe').addEventListener('click', () => { AudioFX.click(); Wardrobe.open(G); });
    $('btnSalon').addEventListener('click', () => { AudioFX.click(); Salon.open(G); });
    $('btnSalonDrawer').addEventListener('click', () => { show('drawer', false); Salon.open(G); });
    $('btnPaintDrawer').addEventListener('click', () => { show('drawer', false); Paint.open(G, G.player.look, { onDone: () => { cb.onLookSaved && cb.onLookSaved(); } }); });
    $('btnFoal').addEventListener('click', () => { AudioFX.click(); if (G.foal && G.foal.adopted) Care.open(G); });
    $('btnHomeDrawer').addEventListener('click', () => { show('drawer', false); if (G.foal && G.foal.adopted) HomeUI.open(G); else Voice.say('Find the baby alicorn first!', { interrupt: true, force: true }); });
    $('btnStudio').addEventListener('click', () => { show('drawer', false); Studio.open(G); });
    $('btnPrintables').addEventListener('click', () => { show('drawer', false); Printables.open(G, 'certificate'); });
    $('btnColouring').addEventListener('click', () => { show('drawer', false); Printables.open(G, 'colouring'); });
    document.querySelectorAll('#seasonPick button').forEach(b => b.addEventListener('click', () => { cb.onSeason(b.dataset.season); AudioFX.click(); refreshToggles(); }));
    $('btnWardrobeDrawer').addEventListener('click', () => { show('drawer', false); Wardrobe.open(G); });
    $('btnCreatorDrawer').addEventListener('click', () => { show('drawer', false); cb.onEditLook(); });
    $('btnBook').addEventListener('click', () => openStickers());
    $('btnStickersDrawer').addEventListener('click', () => { show('drawer', false); openStickers(); });
    $('stickerClose').addEventListener('click', () => show('stickerBook', false));
    $('btnJournal').addEventListener('click', () => openJournal());
    $('btnJournalDrawer').addEventListener('click', () => { show('drawer', false); openJournal(); });
    $('journalClose').addEventListener('click', () => show('journal', false));
    $('journalPrint').addEventListener('click', () => window.print());
    $('journalClear').addEventListener('click', () => { if (confirm('Clear the whole diary?')) Journal.clear(); });

    $('factClose').addEventListener('click', closeFact);
    $('factOk').addEventListener('click', () => { if (factKey) Bus.emit('factRead', factKey); closeFact(); });
    $('factSay').addEventListener('click', () => { const t = $('factTitle').textContent; Voice.say(`${t}. ${$('factBody').textContent}`, { interrupt: true, force: true, speaker: 'narrator', el: $('factBody'), offset: t.length + 2 }); });
    $('hintSay').addEventListener('click', () => Voice.say(hintText, { interrupt: true, force: true, speaker: 'narrator', el: $('hintText') }));
    const sayQuest = () => { const c = Quests.card(), rq = Reading.questText(); if (rq) Reading.markText(rq, 'help'); Voice.say(rq || `${c.title}. ${c.text}`, { interrupt: true, force: true, speaker: 'narrator' }); };
    $('questSay').addEventListener('click', sayQuest);
    $('questCard').addEventListener('click', (e) => { if (e.target.id !== 'questSay') sayQuest(); });
    $('talkNext').addEventListener('click', () => { Dialog.next(); AudioFX.click(); });
    $('talkSay').addEventListener('click', () => { const a = Dialog.active; Voice.say(Dialog.line, { interrupt: true, force: true, speaker: a && a.who.key, el: $('talkText') }); });
    $('talk').addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') Dialog.next(); });

    $('mapCanvas').addEventListener('click', onMapClick);

    Bus.on('fact', queueFact);
    Bus.on('hint', (k) => hint(k));
    Bus.on('dialog', showTalk); Bus.on('dialogLine', showTalk); Bus.on('dialogEnd', hideTalk);
    Bus.on('questOffered', (q) => { lastQuest = ''; });
    Bus.on('questStart', (q) => { AudioFX.questStart(); questToast(q, simple() ? 'New quest!' : 'New quest'); });
    Bus.on('questDone', (q) => { AudioFX.quest(); questToast(q, 'Quest complete!'); });
    Bus.on('questProgress', (q, n, goal) => { lastQuest = ''; if (n < goal) Voice.say(`${n}!`, { force: true }); });
    Bus.on('questPhase', () => { lastQuest = ''; const c = Quests.card(), rq = Reading.questText(); if (rq) hint(rq, true, true); else hint(c.text); });
    Bus.on('questsFree', () => { lastQuest = ''; });
    Bus.on('weather', (w) => { if (w === 'clearing') { Bus.emit('fact', 'rainbow'); } });
    Bus.on('cinematic', (title) => { if (title) Voice.say(title, { interrupt: false }); });
    refreshToggles();
  }

  function show(id, on) { $(id).hidden = !on; }

  function refreshToggles() {
    const s = G.settings;
    const on = (id, v) => $(id).classList.toggle('on', !!v);
    on('btnLabels', s.labels); on('tgLabels', s.labels); on('tgSoundChip', s.sound); on('tgMusic', s.music);
    on('btnVoice', s.voice); on('tgVoice', s.voice); on('tgVoiceTitle', s.voice); on('tgArrow', s.arrow);
    on('tgStorms', s.storms); on('tgGlow', s.glow !== false); on('tgFollow', s.follow !== false); on('tgRim', s.rim !== false);
    document.querySelectorAll('#seasonPick button').forEach(b => b.classList.toggle('on', b.dataset.season === (s.season || 'auto'))); on('tgSlow', s.slowmo); on('tgPad', s.pad); on('tgClock', s.clock); on('tgP2', s.p2); on('tgGpSwap', s.gpP2);
    $('btnVoice').textContent = s.voice ? '🔊' : '🔇';
    $('tgClock').textContent = s.clock ? 'Clock running' : 'Clock paused';
    $('p2card').hidden = !s.p2;
    $('selQuality').value = s.quality;
    $('pad').hidden = !s.pad;
    document.body.classList.toggle('pad-on', s.pad);
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === s.difficulty));
    document.querySelectorAll('#readPick button, #readPickDrawer button').forEach(b => b.classList.toggle('on', b.dataset.read === s.reading));
    document.body.classList.toggle('simple', s.reading === 'simple');
    const rm = s.readMode === 'play' ? 'play' : 'listen', RL = Reading.level();
    document.querySelectorAll('#readModeDrawer button, #readModeTitle button').forEach(b => b.classList.toggle('on', b.dataset.rm === rm));
    document.querySelectorAll('#readLevelDrawer .chip, #readLevelTitle .chip').forEach(b => b.classList.toggle('on', b.dataset.level === RL));
    document.querySelectorAll('#readHelpPick button').forEach(b => b.classList.toggle('on', b.dataset.rh === (s.readHelp === 'ask' ? 'ask' : 'auto')));
    on('tgReadAuto', s.readAuto);
    $('readAboutDrawer').textContent = $('readAboutTitle').textContent = `${LEVEL_INFO[RL].name}: ${LEVEL_INFO[RL].about}`;
    $('readLevelTitle').hidden = $('readAboutTitle').hidden = rm !== 'play';
    document.body.classList.toggle('read-play', rm === 'play');
    if (!$('drawer').hidden) Reading.renderReport();
    lastQuest = '';
  }

  /* ---------- HUD ---------- */
  function update(dt) {
    const p = G.players[0];
    const W = G.world, wx = W.weather;
    const sky = wx.rain > .4 ? '🌧️' : wx.rainbow > .3 ? '🌈' : wx.cloud > .5 ? '☁️' : (G.night > .5 ? '🌙' : '☀️');
    const place = W.placeName(p.x, p.y);
    const placeName = simple() && place.simple ? place.simple.replace(/^the /, '') : place.name.replace(/^the /, '');
    const sig = `${p.look.name}|${Math.round(p.sparkle * 20)}|${G.stars}|${placeName}|${sky}|${G.day}|${G.apples}`;
    const fb = $('btnFoal'); fb.hidden = !(G.foal && G.foal.adopted);
    if (!fb.hidden) { const fk = `${G.foal.look.body}|${G.foal.stage}|${G.foal.need()}`; if (fb.dataset.k !== fk) { fb.dataset.k = fk; fb.innerHTML = ''; fb.appendChild(Sprites.iconEl(G.foal.stage >= 2 ? 'foalgrown' : 'foal', G.foal.look, 30, 'hud' + fk)); } fb.classList.toggle('wants', !!G.foal.need()); }
    if (sig !== lastHUD) {
      lastHUD = sig;
      $('alicornName').textContent = p.look.name;
      $('sparkleBar').style.width = (p.sparkle * 100).toFixed(0) + '%';
      $('sparkleText').textContent = p.sparkle >= .25 ? '✨ Dash ready!' : '✨ Sparkle';
      $('roStars').textContent = G.stars;
      $('roPlace').textContent = placeName.charAt(0).toUpperCase() + placeName.slice(1);
      $('weatherBadge').textContent = sky;
      $('roDay').textContent = G.day;
      $('roApples').textContent = G.apples || 0;
    }
    const lk = JSON.stringify([p.look.body, p.look.mane, p.look.horn, p.look.eyes, p.look.mark, p.look.wear, p.look.wings]);
    if (lk !== iconKey) {
      iconKey = lk;
      const c = $('stageIcon'), ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(Sprites.icon('portrait', p.look, 64), 0, 0, 128, 128);
    }
    /* quest card */
    const card = Quests.card(), rq = Reading.questText();
    const qs = `${card.title}|${rq || card.text}|${card.prog}|${card.icon}`;
    if (qs !== lastQuest) {
      lastQuest = qs;
      $('questK').textContent = card.done ? 'Free play' : card.offered ? (simple() ? 'Next' : 'Next quest') : 'Quest';
      $('questTitle').textContent = card.title;
      if (rq) { $('questText').innerHTML = ''; Reading.renderWords($('questText'), rq); } else $('questText').textContent = card.text;
      $('questProgWrap').hidden = !card.goal;
      if (card.goal) { $('questBar').style.width = (card.count / card.goal * 100) + '%'; $('questProg').textContent = card.prog; }
      $('questCard').classList.toggle('done', !!card.done);
      if (card.icon !== questIconKey) {
        questIconKey = card.icon;
        const c = $('questIcon'), ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(Sprites.icon(card.icon, p.look, 48), 0, 0, 96, 96);
      }
    }
    /* touch buttons */
    const f = G.friends.nearest(p.x, p.y - 20, 150);
    const book = (w) => Reading.locked(w) ? '📖 ' : '';
    const magicLabel = Dialog.active ? 'NEXT' : book('magic') + ((f && p.state === 'ground') ? 'TALK' : 'MAGIC');
    if ($('btnMagic').textContent !== magicLabel) $('btnMagic').textContent = magicLabel;
    const flyLabel = p.state === 'air' ? 'FLAP' : book('fly') + 'FLY';
    const dashLabel = book('dash') + 'DASH';
    if ($('btnDash').textContent !== dashLabel) $('btnDash').textContent = dashLabel;
    if ($('btnFly').textContent !== flyLabel) $('btnFly').textContent = flyLabel;
    $('btnDash').style.opacity = p.sparkle >= .25 ? 1 : .45;

    /* player 2 */
    const q = G.players[1];
    if (q) {
      $('p2Name').textContent = q.look.name;
      $('p2Sparkle').style.width = (q.sparkle * 100).toFixed(0) + '%';
      const k2 = JSON.stringify([q.look.body, q.look.mane, q.look.wear]);
      if (k2 !== p2IconKey) { p2IconKey = k2; const c = $('p2Icon'), ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(Sprites.icon('portrait', q.look, 44), 0, 0, 88, 88); }
      $('p2Keys').textContent = G.settings.gpP2 && Gamepads.connected ? '🎮' : 'IJKL + U';
    }
    $('gpNote').textContent = Gamepads.connected ? `${Gamepads.connected} gamepad${Gamepads.connected > 1 ? 's' : ''} connected.` : 'No gamepad connected. Plug one in and press a button.';
    document.body.classList.toggle('cine', !!Cinematic.active);
    document.body.classList.toggle('talking', !!Dialog.active);

    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) { $('stickerToast').hidden = true; if (toastQueue.length) showSticker(toastQueue.shift()); } }
    if (qToastTimer > 0) { qToastTimer -= dt; if (qToastTimer <= 0) $('questToast').hidden = true; }
  }

  /* ---------- talk box ---------- */
  function showTalk(a) {
    const f = a.who;
    const c = $('talkIcon'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(Sprites.icon(f.key === 'puff' ? 'lamb' : f.def.kind, G.player.look, 80), 0, 0, 160, 160);
    $('talkName').textContent = f.def.name;
    $('talkNext').textContent = a.i < a.lines.length - 1 ? 'Next ▶' : 'OK! ✓';
    $('talk').hidden = false;
    const pitch = { bunny: 1.35, fox: 1.15, owl: .8, deer: 1.25, frog: .9, swan: 1.05, sheep: 1.1, lamb: 1.5, dragon: 1.3, mermaid: 1.25 }[f.def.kind] || 1.1;
    Karaoke.set($('talkText'), a.lines[a.i]);
    Voice.say(a.lines[a.i], { interrupt: true, force: true, pitch, speaker: f.key, el: $('talkText') });
  }
  function hideTalk() { $('talk').hidden = true; }

  /* ---------- hints ---------- */
  /* in Read to Play, hints are shown at the child's level and only read aloud after the help delay */
  let hintSayT = null;
  function hint(keyOrText, flash = true, readIt = false) {
    const rt = Reading.hintText(keyOrText);
    const txt = rt || T(keyOrText);
    if (txt === hintText) return;
    hintText = txt;
    const h = $('hint');
    Karaoke.set($('hintText'), txt);
    if (flash) { h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); }
    clearTimeout(hintSayT);
    if (rt || (readIt && Reading.on())) { if (G.settings.readHelp !== 'ask') hintSayT = setTimeout(() => { if (hintText === txt && !Dialog.active && !Reading.busy()) Voice.say(txt, { interrupt: false, speaker: 'narrator', el: $('hintText') }); }, Reading.helpDelay() * 1000); return; }
    if (!Dialog.active) Voice.say(txt, { interrupt: true, speaker: 'narrator', el: $('hintText') });
  }

  /* ---------- facts ---------- */
  function queueFact(key) {
    if (!FACTS[key] || factsSeen.has(key)) return;
    factsSeen.add(key);
    factQueue.push(key);
    if (!factOpen) nextFact();
  }
  function nextFact() {
    if (Dialog.active) { setTimeout(nextFact, 1500); return; }
    const key = factQueue.shift();
    if (!key) { factOpen = false; return; }
    factOpen = true; factKey = key;
    const f = FACTS[key];
    $('factTitle').textContent = f.title;
    Karaoke.set($('factBody'), simple() ? f.simple : f.body);
    const more = $('factMore'); more.hidden = !f.more; if (f.more) more.href = f.more;
    const el = $('fact');
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(nextFact._t);
    nextFact._t = setTimeout(closeFact, 30000);
    setTimeout(() => { if (!Dialog.active) Voice.say(`${f.title}. ${simple() ? f.simple : f.body}`, { speaker: 'narrator', el: $('factBody'), offset: f.title.length + 2 }); }, 900);
  }
  function closeFact() { $('fact').hidden = true; clearTimeout(nextFact._t); setTimeout(nextFact, 600); }
  function resetFacts() { factQueue = []; factsSeen = new Set(); factOpen = false; $('fact').hidden = true; }

  /* ---------- toasts ---------- */
  function showSticker(st) {
    const t = $('stickerToast');
    const c = $('stickerToastCanvas'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(Stickers.image(st, 80, false), 0, 0, 160, 160);
    $('stickerToastName').textContent = simple() ? st.simple : st.name;
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    toastTimer = 4.5;
    AudioFX.sticker();
    if (!Dialog.active) Voice.say(`New sticker! ${simple() ? st.simple : st.name}`);
  }
  function onSticker(st) { if (toastTimer > 0) toastQueue.push(st); else showSticker(st); }
  function questToast(q, k) {
    const c = $('questToastCanvas'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(Sprites.icon(q.icon, G.player.look, 60), 0, 0, 120, 120);
    $('questToastK').textContent = k;
    $('questToastName').textContent = simple() ? q.simple : q.title;
    const t = $('questToast'); t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    qToastTimer = 4;
  }

  /* ---------- sticker book / diary ---------- */
  function openStickers() {
    AudioFX.click();
    Stickers.setLook(G.player.look);
    const grid = $('stickerGrid');
    grid.innerHTML = '';
    let n = 0;
    for (const st of Stickers.all()) {
      const has = Stickers.has(st.key); if (has) n++;
      const b = document.createElement('button');
      b.className = 'sticker-btn' + (has ? '' : ' locked');
      b.appendChild(Stickers.imageEl(st, 72, !has));
      const s = document.createElement('span'); s.textContent = simple() ? st.simple : st.name; b.appendChild(s);
      b.addEventListener('click', () => Voice.say(has ? `${st.name}. ${st.simple}` : `Still to find: ${st.simple}`, { interrupt: true, force: true }));
      grid.appendChild(b);
    }
    $('stickerCount').textContent = `${n} / ${Stickers.all().length}`;
    show('stickerBook', true);
  }
  function openJournal() { AudioFX.click(); Journal.renderBook(); show('journal', true); }

  /* ---------- map ---------- */
  function openMap() {
    AudioFX.click();
    show('mapModal', true);
    Bus.emit('mapOpened');
    const c = $('mapCanvas');
    const step = () => {
      if ($('mapModal').hidden) return;
      mapRaf = requestAnimationFrame(step);
      const r = c.getBoundingClientRect();
      const w = Math.max(320, Math.round(r.width)), h = Math.round(w * 9 / 16);
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      MapView.draw(ctx, w, h, G);
    };
    step();
  }
  function closeMap() { show('mapModal', false); cancelAnimationFrame(mapRaf); }
  function onMapClick(e) {
    const c = $('mapCanvas'), r = c.getBoundingClientRect();
    const w = r.width, h = w * 9 / 16;
    const hit = MapView.hit(e.clientX - r.left, e.clientY - r.top, w, h, G);
    if (!hit) { Voice.say(simple() ? 'Tap a place!' : 'Tap a place or a friend to fly there.', { interrupt: true, force: true }); return; }
    closeMap();
    cb.onTravel(hit);
  }

  function hideTitle() { $('title').classList.add('out'); }
  function showTitle(hasSave) { $('title').classList.remove('out'); $('btnContinue').hidden = !hasSave; }
  function anyModalOpen() { return ['readCard', 'readPage', 'myWords', 'help', 'stickerBook', 'journal', 'mapModal', 'creator', 'wardrobe', 'care', 'home', 'salon', 'paint', 'studio', 'print', 'photoStudio'].some(id => !$(id).hidden); }
  function closeModals() { ['help', 'stickerBook', 'journal', 'drawer', 'myWords'].forEach(id => show(id, false)); closeMap(); if (Wardrobe.isOpen()) Wardrobe.close(); if (Care.isOpen()) Care.close(); if (HomeUI.isOpen()) HomeUI.close(); if (Salon.isOpen()) Salon.close(); if (Paint.isOpen()) Paint.close(); if (Studio.isOpen()) Studio.close(); if (Printables.isOpen()) Printables.close(); if (PhotoStudio.isOpen()) PhotoStudio.close(); }

  return { init, update, hint, refreshToggles, hideTitle, showTitle, resetFacts, queueFact, onSticker, openStickers, openJournal, openMap, closeMap, anyModalOpen, closeModals, isFactOpen: () => factOpen, T };
})();
