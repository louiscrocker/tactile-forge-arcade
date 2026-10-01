/* ============================================================
   ui.js — HUD, life-cycle wheel, journey bar, fact cards, title,
   settings, the journal, the garden, the map, the forecast, the
   modals, and reading aloud
   ============================================================ */
'use strict';

const UI = (function () {
  const $ = (id) => document.getElementById(id);
  let G, cb;
  let factQueue = [], factOpen = false, factsSeen = new Set();
  let lastHUD = '';
  let hintKey = '';
  let stageIconKey = '';
  let mode = 'milkweed';
  let zoneKey = '';
  let hop = null;                     // the animated hop north
  let mapTime = 0;
  let jtab = 'milestones';
  let region = 'ontario';
  const MODALS = ['help', 'south', 'arrived', 'spring', 'nextgen', 'hop', 'mapModal', 'journal', 'garden', 'citizen', 'readCard', 'readPage', 'myWords', 'grownup'];
  /* Read to Play panels sit on top: another modal opening never hides them (a gate page must be finished) */
  const STAYS = ['readCard', 'readPage'];
  const WHEEL = ['egg', 'L1', 'L2', 'L3', 'L4', 'L5', 'chrysalis', 'adult', 'journey', 'forest'];
  const WHEEL_NAMES = ['Egg', '1st', '2nd', '3rd', '4th', '5th', 'Pupa', 'Adult', 'South', 'Forest'];
  const WHEEL_TITLES = ['Egg', 'Caterpillar, 1st instar', 'Caterpillar, 2nd instar', 'Caterpillar, 3rd instar', 'Caterpillar, 4th instar', 'Caterpillar, 5th instar', 'Chrysalis', 'Monarch butterfly', 'The migration south', 'The oyamel forest in Mexico'];
  let wheelEls = [];

  function init(game, callbacks) {
    G = game; cb = callbacks;
    buildWheel();
    buildVariants($('variantPick'));
    buildVariants($('variantPickDrawer'));
    buildRegions();

    $('btnStart').addEventListener('click', () => { cb.onStart(); });
    for (const grp of ['diffPickTitle', 'diffPick']) {
      $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => setDiff(b.dataset.diff)));
    }
    $('btnHelp').addEventListener('click', () => show('help', true));
    $('helpClose').addEventListener('click', () => show('help', false));
    $('btnMenu').addEventListener('click', () => show('drawer', $('drawer').hidden));
    $('drawerClose').addEventListener('click', () => show('drawer', false));
    $('btnLabels').addEventListener('click', () => cb.onToggle('labels'));
    $('btnSound').addEventListener('click', () => cb.onToggle('sound'));
    $('btnJournal').addEventListener('click', () => showJournal());
    $('btnMap').addEventListener('click', () => showMap());
    for (const [id, key] of [['tgSoundChip', 'sound'], ['tgLabels', 'labels'], ['tgAnts', 'ants'], ['tgWasp', 'wasp'], ['tgBirds', 'birds'], ['tgCoop', 'coop'], ['tgScience', 'science'], ['tgSlow', 'slowmo'], ['tgSimple', 'simple'], ['tgSpeak', 'speak'], ['tgPad', 'pad'], ['tgClock', 'clock']])
      $(id).addEventListener('click', () => cb.onToggle(key));
    $('sTod').addEventListener('input', (e) => cb.onTod(e.target.value / 100));
    $('btnNewPlant').addEventListener('click', () => { show('drawer', false); cb.onNewPlant(); });
    $('btnRestart').addEventListener('click', () => { show('drawer', false); cb.onRestart(); });
    $('btnSkipSouth').addEventListener('click', () => { show('drawer', false); cb.onSkipSouth(); });
    $('btnResetJournal').addEventListener('click', () => { if (confirm('Erase every sticker, tag and seed in the journal?')) { cb.onResetJournal(); show('drawer', false); } });
    $('btnGardenDrawer').addEventListener('click', () => { show('drawer', false); showGarden(); });
    $('btnCitizen').addEventListener('click', () => { show('drawer', false); showCitizen(); });

    $('factClose').addEventListener('click', closeFact);
    $('factOk').addEventListener('click', closeFact);

    $('btnGoSouth').addEventListener('click', () => { show('south', false); cb.onGoSouth(); });
    $('btnStay').addEventListener('click', () => { show('south', false); cb.onStay(); });
    $('btnWinter').addEventListener('click', () => { show('arrived', false); cb.onWinter(); });
    $('btnStayForest').addEventListener('click', () => { show('arrived', false); cb.onStayForest(); });
    $('btnNorth').addEventListener('click', () => { show('spring', false); cb.onNorth(); });
    $('btnGardenSpring').addEventListener('click', () => { showGarden(() => show('spring', true)); show('spring', false); });
    $('btnNextGen').addEventListener('click', () => { show('nextgen', false); cb.onNextGen(); });
    $('btnHopDone').addEventListener('click', () => { show('hop', false); const f = hop && hop.onDone; hop = null; if (f) f(); });
    $('mapClose').addEventListener('click', () => show('mapModal', false));
    $('journalClose').addEventListener('click', () => show('journal', false));
    $('gardenClose').addEventListener('click', () => closeGarden());
    $('gardenOk').addEventListener('click', () => closeGarden());
    $('btnPlant').addEventListener('click', () => { if (Journal.plant()) { AudioFX.silk(); Bus.emit('fact', 'garden'); } else AudioFX.bump(); renderGarden(); });
    $('citizenClose').addEventListener('click', () => show('citizen', false));
    $('btnGardenJournal').addEventListener('click', () => { show('journal', false); showGarden(() => show('journal', true)); });
    $('btnMapJournal').addEventListener('click', () => { show('journal', false); showMap(); });
    $('btnCitizenJournal').addEventListener('click', () => { show('journal', false); showCitizen(); });
    $('jtabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { jtab = b.dataset.tab; renderJournal(); }));
    $('btnFlyDawn').addEventListener('click', () => { forecast(null); cb.onFlyDawn(); });
    /* reading: read to me, or read to play at a level */
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadMode(b.dataset.rm); AudioFX.click(); refreshToggles(); if (typeof Voice !== 'undefined') Voice.say(b.dataset.rm === 'play' ? 'I read to play. Pick your level.' : 'Read to me.', { force: true }); }));
      const box = $('readLevel' + sfx);
      for (const L of [...READ_LEVELS, 'auto']) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.rl = L; b.textContent = L === 'auto' ? '⚙ Auto' : L; b.title = L === 'auto' ? 'Move up or down by itself' : LEVEL_INFO[L].about; b.addEventListener('click', () => { cb.onReadLevel(L); AudioFX.click(); refreshToggles(); }); box.appendChild(b); }
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadHelp(b.dataset.rh); refreshToggles(); }));
    $('tgReadMic').addEventListener('click', () => cb.onToggle('readMic'));
    $('tgReadMicTitle').addEventListener('click', () => cb.onToggle('readMic'));
    $('tgReadSave').addEventListener('click', () => cb.onToggle('readSave'));
    $('btnMyWords').addEventListener('click', () => { show('drawer', false); Reading.openWords(); });
    $('btnGrownup').addEventListener('click', () => { show('drawer', false); Reading.openGrownup(); });
    $('btnWait').addEventListener('click', () => { forecast(null); cb.onWait(); });

    Bus.on('fact', queueFact);
    Bus.on('hint', (k) => hint(k));
    Bus.on('sticker', (kind, key) => toast(kind, key));
    refreshToggles();
    refreshJournalLine();
  }

  function show(id, on) { $(id).hidden = !on; if (on && id !== 'drawer') { /* one modal at a time */ for (const m of MODALS) if (m !== id && !STAYS.includes(m)) $(m).hidden = true; } }
  function anyModal() { return MODALS.some(id => !$(id).hidden); }
  function closeAll() { for (const m of MODALS) if (!STAYS.includes(m)) $(m).hidden = true; $('drawer').hidden = true; hop = null; }

  function buildWheel() {
    const ol = $('wheel');
    ol.innerHTML = '';
    wheelEls = WHEEL.map((k, i) => {
      const li = document.createElement('li');
      li.appendChild(Sprites.icon(k, G.variantDef(), 40));
      const s = document.createElement('span'); s.textContent = WHEEL_NAMES[i];
      li.appendChild(s);
      li.title = WHEEL_TITLES[i];
      ol.appendChild(li);
      return li;
    });
  }

  function buildVariants(grid) {
    grid.innerHTML = '';
    for (const key of Object.keys(VARIANTS)) {
      const v = VARIANTS[key];
      const b = document.createElement('button');
      b.dataset.variant = key;
      b.appendChild(Sprites.icon('adult', v, 54));
      const t = document.createElement('span'); t.textContent = v.name.replace(' monarch', '');
      b.appendChild(t);
      b.addEventListener('click', () => { cb.onVariant(key); AudioFX.click(); });
      grid.appendChild(b);
    }
  }
  function buildRegions() {
    const el = $('regionPick');
    el.innerHTML = '';
    for (const r of REGIONS) {
      const b = document.createElement('button'); b.textContent = r.name; b.dataset.region = r.key;
      b.addEventListener('click', () => { region = r.key; try { localStorage.setItem('monarch.region', region); } catch (e) { /* */ } renderRegion(); });
      el.appendChild(b);
    }
    try { region = localStorage.getItem('monarch.region') || region; } catch (e) { /* */ }
  }
  function renderRegion() {
    const r = REGIONS.find(x => x.key === region) || REGIONS[0];
    $('regionPick').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.region === r.key));
    $('regionCard').innerHTML = `<b>${r.name}</b><br><b>Spring:</b> ${r.spring}<br><b>Autumn:</b> ${r.fall}`;
  }

  function refreshVariant() {
    document.querySelectorAll('.species-grid button').forEach(b => b.classList.toggle('on', b.dataset.variant === G.settings.variant));
    const v = G.variantDef();
    $('variantBlurb').innerHTML = `<b>${v.name}</b> <i>(${v.latin})</i> — ${G.settings.simple ? v.simple : v.blurb} <em>${v.power}</em>`;
    buildWheel();
    stageIconKey = '';
  }
  function refreshJournalLine() {
    const t = Journal.totals();
    const d = Journal.data;
    $('journalLine').textContent = t.all[0] ? `Journal: ${t.all[0]} of ${t.all[1]} stickers · ${d.garden.plants} milkweeds planted · ${d.years} full year${d.years === 1 ? '' : 's'}` : '';
  }

  function setDiff(d) {
    cb.onDiff(d);
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === d));
    AudioFX.click();
  }

  function refreshToggles() {
    const s = G.settings;
    for (const [id, key] of [['btnLabels', 'labels'], ['tgLabels', 'labels'], ['btnSound', 'sound'], ['tgSoundChip', 'sound'], ['tgAnts', 'ants'], ['tgWasp', 'wasp'], ['tgBirds', 'birds'], ['tgCoop', 'coop'], ['tgScience', 'science'], ['tgSlow', 'slowmo'], ['tgSimple', 'simple'], ['tgSpeak', 'speak'], ['tgPad', 'pad'], ['tgClock', 'clock']])
      $(id).classList.toggle('on', !!s[key]);
    $('tgClock').textContent = s.clock ? 'Clock running' : 'Clock paused';
    $('pad').hidden = !s.pad;
    document.body.classList.toggle('pad-on', s.pad);
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === s.difficulty));
    $('bar2').hidden = !(s.coop && mode === 'route');
    /* reading */
    const L = READ_LEVELS.includes(s.readLevel) ? s.readLevel : 'B';
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rm === (s.readMode || 'listen')));
      $('readLevel' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rl === 'auto' ? !!s.readAuto : b.dataset.rl === L));
      $('readLevel' + sfx).hidden = s.readMode !== 'play';
      $('readAbout' + sfx).textContent = s.readMode === 'play' ? `${LEVEL_INFO[L].name}: ${LEVEL_INFO[L].about}${s.readAuto ? ' The level moves up or down by itself.' : ''}` : 'Fact cards and place names are read aloud. Pick "I read to play" to make reading how the game is played.';
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rh === (s.readHelp || 'auto')));
    document.body.classList.toggle('read-play', s.readMode === 'play');
    $('tgReadMic').classList.toggle('on', !!s.readMic); $('tgReadMicTitle').classList.toggle('on', !!s.readMic);
    $('tgReadMic').textContent = s.readMic ? '🎤 Microphone on while I read' : '🎤 Microphone off';
    $('tgReadSave').classList.toggle('on', s.readSave !== false);
    $('readMicTitleRow').hidden = s.readMode !== 'play';
    refreshVariant();
  }

  function setMode(m) {
    mode = m;
    $('bars').hidden = m !== 'route';
    $('journey').hidden = m !== 'route';
    $('bar2').hidden = !(G.settings.coop && m === 'route');
    $('roAk').textContent = m === 'route' ? 'Miles' : 'Bites';
    $('roBk').textContent = m === 'route' ? 'Stops' : 'Leaves';
    $('roB').title = m === 'route' ? 'Nectar stops' : 'Leaves left with something to eat';
    $('roA').title = m === 'route' ? 'Miles flown' : 'Bites taken in this life';
    if (m !== 'route') { $('zone').hidden = true; zoneKey = ''; forecast(null); }
    lastHUD = '';
  }

  /* ---------- HUD ---------- */
  function update() {
    const p = G.player;
    let name = STAGES[p.stage].name, prog = 0, ptxt = '', k = 'You are a';
    switch (p.state) {
      case 'egg': name = 'Egg'; prog = p.hatchProg; ptxt = 'Chew out!'; k = 'You are an'; break;
      case 'larva': case 'molting':
        prog = p.progress();
        ptxt = p.readyFlag ? 'FULL — find a place to hang!' : `${p.eaten} / ${p.need()} bites to grow`;
        if (p.state === 'molting') ptxt = 'Molting…';
        break;
      case 'silk': name = 'Hanging on silk'; prog = p.progress(); ptxt = 'Climbing back…'; break;
      case 'jhang': name = 'Hanging in a J'; prog = p.timer / p.jTime(); ptxt = 'Getting ready…'; break;
      case 'pupating': name = 'Becoming a chrysalis'; prog = 1; ptxt = 'The skin comes off!'; break;
      case 'chrysalis': prog = p.pupaProgress(); ptxt = p.clearAmount() > .3 ? 'Going clear…' : 'Metamorphosis…'; break;
      case 'eclosing': name = 'Emerging'; prog = 1; ptxt = 'Out you come!'; break;
      case 'drying': name = 'Fresh monarch (drying)'; prog = p.timer / p.dryTime(); ptxt = 'Wings unfolding…'; break;
      case 'adult': case 'flying': case 'sipping':
        name = p.state === 'flying' ? 'Monarch in flight' : (p.summer ? 'Summer monarch' : 'Monarch butterfly');
        prog = p.summer && p.readyFlag ? (p.variant.key === 'female' ? p.eggsLaid / 3 : 0) : p.progress();
        ptxt = p.readyFlag ? (p.summer ? (p.variant.key === 'female' ? `${p.eggsLaid} / 3 eggs laid` : 'Find a mate!') : 'READY to fly south!') : `${p.eaten} / ${p.need()} sips of nectar`;
        if (p.state === 'sipping') ptxt = 'Drinking…';
        break;
      case 'laying': name = 'Laying an egg'; prog = p.eggsLaid / 3; ptxt = 'Tasting the leaf…'; break;
      case 'courting': name = 'Courtship'; prog = 1; ptxt = 'A spiral dance!'; break;
      case 'migrating': name = 'Flying south'; prog = G.route ? G.route.frac(p.x) : 0; ptxt = `${fmtInt(G.route ? G.route.miles(p.x) : 0)} of ${fmtInt(ROUTE_MILES)} miles`; k = 'You are'; break;
      case 'nectaring': name = 'Drinking nectar'; prog = p.energy; ptxt = `${NECTAR_PLANTS[p.patch.kind].name}`; k = 'You are'; break;
      case 'tagging': name = 'Being tagged'; prog = p.timer / 4.6; ptxt = 'Hold still…'; k = 'You are'; break;
      case 'roosting': name = p.waitDays > 0 ? 'Waiting out the weather' : 'Roosting'; prog = G.route ? G.route.frac(p.x) : 0; ptxt = (G.night || 0) > .5 ? 'Sleeping till dawn…' : 'Sheltering…'; k = 'You are'; break;
      case 'resting': name = p.exhaustedFlag ? 'Exhausted' : 'Resting'; prog = p.energy; ptxt = p.exhaustedFlag ? 'Catching your breath…' : 'SPACE to fly'; k = 'You are'; break;
      case 'arrived': name = 'In the oyamel forest'; prog = 1; ptxt = 'You made it!'; k = 'You are'; break;
      case 'winterFly': name = 'A winter flutter'; prog = p.energy; ptxt = 'Land on a fir to rest'; k = 'You are'; break;
    }
    const wheelIdx = p.state === 'arrived' || p.state === 'winterFly' ? 9 : (p.onRoute() ? 8 : p.stage);
    const leavesLeft = G.plant ? G.plant.leaves.filter(l => !l.skeleton).length : 0;
    const a = mode === 'route' ? fmtInt(p.stats.miles) : p.stats.bites;
    const b = mode === 'route' ? p.stats.nectarStops : leavesLeft;
    const p2 = G.players && G.players[1];
    const sig = `${name}|${Math.round(prog * 100)}|${ptxt}|${a}|${b}|${G.day}|${G.generation}|${k}|${wheelIdx}|${Math.round(p.energy * 100)}|${Math.round(p.fat * 100)}|${p2 ? Math.round(p2.energy * 100) : ''}`;
    if (sig !== lastHUD) {
      lastHUD = sig;
      $('stageK').textContent = k;
      $('stageName').textContent = name;
      $('progBar').style.width = (prog * 100).toFixed(1) + '%';
      $('progText').textContent = ptxt;
      $('roAv').textContent = a;
      $('roBv').textContent = b;
      $('roDay').textContent = G.day;
      $('roGen').textContent = G.generation;
      wheelEls.forEach((li, i) => { li.classList.toggle('done', i < wheelIdx); li.classList.toggle('now', i === wheelIdx); });
      if (mode === 'route') {
        $('energyBar').style.width = (p.energy * 100).toFixed(0) + '%';
        $('energyBar').classList.toggle('low', p.energy < .25);
        $('fatBar').style.width = (p.fat * 100).toFixed(0) + '%';
        if (p2) { $('energyBar2').style.width = (p2.energy * 100).toFixed(0) + '%'; $('energyBar2').classList.toggle('low', p2.energy < .25); }
        const f = G.route ? G.route.frac(p.x) : 0;
        $('journeyFill').style.width = (f * 100).toFixed(1) + '%';
        $('journeyBug').style.left = (f * 100).toFixed(1) + '%';
      }
    }
    const ik = `${wheelIdx}|${p.state}|${G.settings.variant}`;
    if (ik !== stageIconKey) {
      stageIconKey = ik;
      const c = $('stageIcon'), ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      const kind = p.state === 'flying' ? 'adult' : WHEEL[wheelIdx];
      ctx.drawImage(Sprites.icon(kind, G.variantDef(), 56), 0, 0, 112, 112);
    }
    const act = $('btnAction');
    const label = { egg: 'CHEW', larva: p.readyFlag ? 'HANG' : 'BITE', silk: '…', molting: '…', jhang: 'WRIGGLE', pupating: '…', chrysalis: 'TWITCH', eclosing: '…', drying: 'DRYING', adult: p.podNear ? 'POP!' : p.eggSpotNear ? 'LAY' : p.mateNear ? 'MATE' : (p.flowerNear && !p.readyFlag ? 'DRINK' : 'FLY!'), flying: p.mateNear ? 'MATE' : (p.flowerNear && !p.readyFlag ? 'DRINK' : 'LAND'), sipping: 'FLY!', laying: '…', courting: '…', migrating: p.landing ? 'LAND' : 'FLAP', nectaring: 'FLY!', tagging: '…', roosting: 'WAKE', resting: 'FLY!', arrived: 'FLY', winterFly: p.landing ? 'LAND' : 'FLAP' }[p.state];
    if (act.textContent !== label) act.textContent = label;
    /* zone banner */
    if (mode === 'route' && G.route) {
      const z = G.route.zone(p.x);
      if (z.key !== zoneKey) {
        zoneKey = z.key;
        $('zoneName').textContent = z.name; $('zonePlace').textContent = z.place + (G.settings.simple ? '' : ' — ' + z.blurb);
        const el = $('zone'); el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
        clearTimeout(update._zt); update._zt = setTimeout(() => { el.hidden = true; }, 7000);
        speak(z.name + '. ' + z.place + '. ' + (G.settings.simple ? '' : z.blurb));
      }
    }
  }

  /* per frame: animated maps */
  function tick(dt) {
    mapTime += dt;
    if (hop && !$('hop').hidden) {
      hop.t += dt;
      const c = $('hopMap');
      MapView.draw(c.getContext('2d'), c.width, c.height, { hops: hop.hops, hop: hop.leg, hopT: smoothstep(0, 4, hop.t), progress: 1, time: mapTime, variant: G.variantDef() });
      if (hop.t >= 4 && $('btnHopDone').disabled) $('btnHopDone').disabled = false;
    }
    if (!$('mapModal').hidden) drawBigMap();
    if (!$('arrived').hidden) { const c = $('arrivedMap'); MapView.draw(c.getContext('2d'), c.width, c.height, { progress: 1, showReal: true, time: mapTime, variant: G.variantDef() }); }
  }
  function drawBigMap() {
    const c = $('bigMap');
    const p = G.player;
    const onRoute = G.mode === 'route';
    const relay = RELAY[G.relay || 0];
    const opts = { time: mapTime, variant: G.variantDef(), showReal: true, hops: [[MapView.RESERVE, [RELAY[1].lon, RELAY[1].lat]], [[RELAY[1].lon, RELAY[1].lat], [RELAY[2].lon, RELAY[2].lat]], [[RELAY[2].lon, RELAY[2].lat], [RELAY[0].lon, RELAY[0].lat]]] };
    if (onRoute) opts.progress = p.state === 'arrived' || p.state === 'winterFly' ? 1 : G.route.frac(p.x);
    else { opts.progress = 0; opts.you = [relay.lon, relay.lat]; }
    MapView.draw(c.getContext('2d'), c.width, c.height, opts);
  }

  /* ---------- hints ---------- */
  let readHintTimer = null;
  function hint(keyOrText, flash = true) {
    /* in Read to Play, key moments show a leveled sentence to read; it is only spoken as help */
    const rt = typeof Reading !== 'undefined' && Reading.hintText(keyOrText);
    if (rt) {
      if (rt === hintKey) return;
      hintKey = rt;
      $('hintText').textContent = rt;
      if (flash) { const el = $('hint'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      clearTimeout(readHintTimer);
      if (G.settings.readHelp !== 'ask') readHintTimer = setTimeout(() => { if (hintKey === rt && typeof Voice !== 'undefined') Voice.say(rt, { interrupt: false }); }, LEVEL_INFO[Reading.level()].help * 1000);
      return;
    }
    const h = HINTS[keyOrText];
    const txt = h ? h[G.settings.simple ? 1 : 0] : keyOrText;
    if (txt === hintKey) return;
    hintKey = txt;
    const el = $('hint');
    $('hintText').textContent = txt;
    if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }

  /* ---------- facts and cards ---------- */
  function queueFact(key) {
    if (!FACTS[key] || factsSeen.has(key)) return;
    factsSeen.add(key);
    factQueue.push({ key });
    if (!factOpen) nextFact();
  }
  /* a one-off card with its own text (the "why did that happen" cards) */
  function card(title, body, tag = 'Why did that happen?') {
    factQueue.unshift({ title, body, tag });
    if (!factOpen) nextFact(); else { closeFactNow(); nextFact(); }
  }
  function nextFact() {
    const item = factQueue.shift();
    if (!item) { factOpen = false; return; }
    factOpen = true;
    let title, body, more = null, tag = 'Did you know?';
    if (item.key) { const f = FACTS[item.key]; title = f.title; body = G.settings.simple ? f.simple : f.body; more = f.more; Journal.add('facts', item.key); }
    else { title = item.title; body = item.body; tag = item.tag; }
    $('factTag').textContent = tag;
    $('factTitle').textContent = title;
    $('factBody').textContent = body;
    $('factMore').href = more || '#';
    $('factMore').hidden = !more;
    const el = $('fact');
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(nextFact._t);
    nextFact._t = setTimeout(closeFact, 26000);
    speak(title + '. ' + body);
  }
  function closeFactNow() { $('fact').hidden = true; clearTimeout(nextFact._t); stopSpeaking(); }
  function closeFact() { closeFactNow(); setTimeout(nextFact, 600); }
  function resetFacts() { factQueue = []; factsSeen = new Set(); factOpen = false; $('fact').hidden = true; }

  /* ---------- reading aloud ---------- */
  function speak(text) {
    if (!G.settings.speak || !text) return;
    Voice.say(text, { force: true });
  }
  function stopSpeaking() { Voice.stop(); }

  /* ---------- stickers ---------- */
  function toast(kind, key) {
    let ico = '⭐', text = key;
    if (kind === 'milestones') { const m = MILESTONES.find(x => x[0] === key); if (m) { ico = m[1]; text = m[2]; } }
    else if (kind === 'plants') { ico = '🌼'; text = NECTAR_PLANTS[key] ? NECTAR_PLANTS[key].name : key; }
    else if (kind === 'trees') { ico = '🌳'; text = TREE_NAMES[key] || key; }
    else if (kind === 'zones') { ico = '🗺️'; const z = ZONES.find(z => z.key === key); text = z ? z.name : key; }
    else if (kind === 'milkweeds') { ico = '🌿'; text = MILKWEEDS[key] ? MILKWEEDS[key].name : key; }
    else if (kind === 'facts') return;                       // facts are quiet: the card is the reward
    $('toastIco').textContent = ico; $('toastText').textContent = text;
    const el = $('toast'); el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, 4000);
    AudioFX.pop && AudioFX.pop(1.2);
    refreshJournalLine();
  }

  /* ---------- the journal ---------- */
  function showJournal() { renderJournal(); show('journal', true); }
  function renderJournal() {
    const d = Journal.data, t = Journal.totals();
    $('journalCount').textContent = `${t.all[0]} / ${t.all[1]} stickers`;
    $('jtabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === jtab));
    const page = $('jpage');
    page.innerHTML = '';
    const sticker = (got, ico, name, sub) => {
      const el = document.createElement('div'); el.className = 'sticker ' + (got ? 'got' : 'missing');
      const i = document.createElement('div'); i.className = 'ico';
      if (ico instanceof HTMLCanvasElement) i.appendChild(ico); else i.textContent = ico;
      el.appendChild(i);
      const s = document.createElement('span'); s.textContent = got ? name : (sub || '???'); el.appendChild(s);
      return el;
    };
    if (jtab === 'milestones') {
      const grid = document.createElement('div'); grid.className = 'stickers';
      for (const [key, ico, name] of MILESTONES) grid.appendChild(sticker(d.milestones.includes(key), ico, name, name));
      const best = document.createElement('div'); best.className = 'best';
      best.innerHTML = `<div><span>Best miles</span><b>${fmtInt(d.best.miles)}</b></div><div><span>Fastest trip</span><b>${d.best.days < 999 ? d.best.days + ' days' : '—'}</b></div><div><span>Generations</span><b>${d.generations}</b></div><div><span>Full years</span><b>${d.years}</b></div>`;
      page.appendChild(best);
      page.appendChild(grid);
    } else if (jtab === 'facts') {
      const list = document.createElement('div'); list.className = 'jlist';
      for (const key of Object.keys(FACTS)) {
        const got = d.facts.includes(key);
        const b = document.createElement('button'); b.className = got ? '' : 'missing';
        b.innerHTML = `<span>${got ? '📖' : '📕'}</span><span>${got ? FACTS[key].title : '???'}</span>`;
        if (got) b.addEventListener('click', () => { show('journal', false); factsSeen.delete(key); queueFact(key); });
        list.appendChild(b);
      }
      page.appendChild(list);
    } else if (jtab === 'plants') {
      const grid = document.createElement('div'); grid.className = 'stickers';
      for (const key of Object.keys(NECTAR_PLANTS)) {
        const c = document.createElement('canvas'); c.width = c.height = 80; const ctx = c.getContext('2d'); ctx.scale(2, 2);
        Sprites.drawNectarPatch(ctx, { kind: key, seed: 7, w: 26 }, 20, 40, 0, false);
        grid.appendChild(sticker(d.plants.includes(key), c, NECTAR_PLANTS[key].name, 'Drink here'));
      }
      const mw = document.createElement('div'); mw.className = 'stickers'; mw.style.marginTop = '10px';
      for (const key of Object.keys(MILKWEEDS)) {
        const c = document.createElement('canvas'); c.width = c.height = 80; const ctx = c.getContext('2d'); ctx.scale(2, 2);
        ctx.translate(20, 40); Sprites.drawMiniMilkweed(ctx, 3, 34, 0, MILKWEEDS[key]);
        mw.appendChild(sticker(d.milkweeds.includes(key), c, MILKWEEDS[key].name, 'A milkweed'));
      }
      const h = document.createElement('p'); h.className = 'tiny'; h.textContent = 'Nectar plants you have drunk from, and milkweeds you have lived on.';
      page.appendChild(grid); page.appendChild(h); page.appendChild(mw);
    } else if (jtab === 'trees') {
      const grid = document.createElement('div'); grid.className = 'stickers';
      for (const key of Object.keys(TREE_NAMES)) {
        const c = document.createElement('canvas'); c.width = c.height = 80; const ctx = c.getContext('2d'); ctx.scale(2, 2);
        Sprites.drawTree(ctx, { kind: key, h: 34, seed: 11, roost: key === 'fir' ? .5 : 0 }, 20, 40, 0);
        grid.appendChild(sticker(d.trees.includes(key), c, TREE_NAMES[key], 'Roost here'));
      }
      page.appendChild(grid);
    } else if (jtab === 'places') {
      const grid = document.createElement('div'); grid.className = 'stickers';
      for (const z of ZONES) grid.appendChild(sticker(d.zones.includes(z.key), { north: '🍁', lake: '🌊', farm: '🌽', plains: '🤠', mexico: '🌵', forest: '🌲' }[z.key], z.name, z.name));
      page.appendChild(grid);
    } else if (jtab === 'tags') {
      const list = document.createElement('div'); list.className = 'jlist';
      if (!d.tags.length) { const p = document.createElement('p'); p.className = 'tiny'; p.textContent = 'No tags yet. On the flight south, a volunteer with a net will find you at your second nectar stop.'; page.appendChild(p); }
      for (const t of d.tags.slice().reverse()) {
        const div = document.createElement('div');
        const rate = t.found && t.foundDay > t.day ? Math.round((ROUTE_MILES - t.miles) / (t.foundDay - t.day)) : null;
        div.innerHTML = `<span class="code">${t.code}</span><span>Gen ${t.gen} · tagged in ${t.place} on day ${t.day}<br><small>${t.found ? `Found in Michoacán on day ${t.foundDay}${rate ? ` · about ${fmtInt(rate)} miles a day (record: 265)` : ''}` : 'Not found yet'}</small></span>`;
        list.appendChild(div);
      }
      page.appendChild(list);
    }
  }

  /* ---------- the garden ---------- */
  let gardenAfter = null;
  function showGarden(after) { gardenAfter = after || null; renderGarden(); show('garden', true); }
  function closeGarden() { show('garden', false); const f = gardenAfter; gardenAfter = null; if (f) f(); }
  function renderGarden() {
    const g = Journal.data.garden;
    const plots = $('plots'); plots.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('div'); el.className = 'plot ' + (i < g.plants ? '' : 'empty');
      if (i < g.plants) { const c = document.createElement('canvas'); c.width = c.height = 96; const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(24, 44); Sprites.drawMiniMilkweed(ctx, i * 17 + 3, 36, 0, MILKWEEDS[['swamp', 'common', 'antelope'][i % 3]]); el.appendChild(c); }
      else el.textContent = '·';
      plots.appendChild(el);
    }
    $('gardenSeeds').textContent = g.seeds; $('gardenPlants').textContent = g.plants; $('gardenPop').textContent = Journal.population();
    $('btnPlant').disabled = g.seeds <= 0 || g.plants >= 12;
    $('btnPlant').textContent = g.plants >= 12 ? 'The patch is full!' : g.seeds > 0 ? `Plant a seed 🌱 (${g.seeds} left)` : 'No seeds: burst a pod on the milkweed';
  }

  /* ---------- the map, the forecast, the citizen page ---------- */
  function showMap() { drawBigMap(); show('mapModal', true); }
  function showCitizen() { renderRegion(); show('citizen', true); }
  function forecast(data) {
    const el = $('forecast');
    if (!data) { el.hidden = true; return; }
    $('fcTree').textContent = TREE_NAMES[data.tree.kind] || data.tree.kind;
    $('fcIcon').textContent = data.plan.icon; $('fcLabel').textContent = data.plan.label;
    const c = $('fcCanvas'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const log = data.log || [];
    if (log.length > 1) {
      ctx.strokeStyle = '#e0641a'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      log.forEach(([tod, e], i) => { const x = i / (log.length - 1) * (c.width - 8) + 4, y = c.height - 4 - e * (c.height - 8); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.fillStyle = 'rgba(224,100,26,.18)'; ctx.lineTo(c.width - 4, c.height - 4); ctx.lineTo(4, c.height - 4); ctx.closePath(); ctx.fill();
    }
    const ds = data.stats;
    const pct = (v) => ds.fly > 0 ? Math.round(v / ds.fly * 100) : 0;
    $('fcSummary').textContent = ds.fly > 0 ? `Today you flapped ${pct(ds.flap)}% of the time, flew in a headwind ${pct(ds.head)}%, and rode thermals ${pct(ds.thermal)}%.` : 'No flying yet today.';
    el.hidden = false;
    if (!$('fact').hidden) closeFactNow();
  }

  function hideTitle() { $('title').classList.add('out'); }
  function showSouth(coop) { $('southCoop').hidden = !coop; show('south', true); }
  function showArrived(stats, G2, tagInfo) {
    const rows = [['Miles flown', fmtInt(ROUTE_MILES)], ['Days on the wing', G2.day], ['Nectar stops', stats.nectarStops], ['Nights in a roost', stats.roosts], ['Storms sheltered from', stats.storms], ['Thermals ridden', stats.thermals], ['Times exhausted', stats.exhausted], ['Seeds in hand', Journal.data.garden.seeds]];
    $('arrivedStats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    const rec = $('recovery');
    if (tagInfo) {
      rec.hidden = false;
      $('recCode').textContent = tagInfo.code;
      const days = Math.max(1, G2.day - tagInfo.day), rate = Math.round((ROUTE_MILES - tagInfo.miles) / days);
      $('recText').textContent = `Tagged in ${tagInfo.place} on day ${tagInfo.day} at ${fmtInt(tagInfo.miles)} miles. Found in the oyamel forest on day ${G2.day}: ${fmtInt(ROUTE_MILES - tagInfo.miles)} miles in ${days} day${days === 1 ? '' : 's'}, about ${fmtInt(rate)} miles a day. The real record is 265 miles in a day.`;
    } else rec.hidden = true;
    show('arrived', true);
  }
  function showSpring(variant) {
    const seeds = Journal.data.garden.seeds;
    $('springText').textContent = 'The forest warms up. After four months hanging in the firs you wake, drink at a stream, and fly north to Texas, where the first milkweed of the year is up. There the super generation lays its eggs and its journey ends. But the relay goes on: your children will fly to the prairies, and their children to Canada.';
    $('springSeeds').textContent = seeds > 0 ? `You have ${seeds} milkweed seed${seeds === 1 ? '' : 's'} to plant.` : 'No seeds yet. Burst the pods on a milkweed as a butterfly to collect some.';
    show('spring', true);
  }
  function showNextGen(kind, next) {
    $('nextgenTitle').textContent = kind === 'eggs' ? '🥚 Eggs laid!' : '💞 You found a mate!';
    $('nextgenText').textContent = (kind === 'eggs' ? 'Three eggs glued under three leaves, each with a leaf to itself. Your short summer life is done, and it was enough. ' : 'A spiral chase, a flutter to the ground, and the eggs will be laid on the milkweed nearby. Your short summer life is done, and it was enough. ')
      + `The next generation hatches ${next.name === 'Ontario meadow' ? 'in Ontario, in late summer, and will be the super generation' : 'further north, in ' + next.name.replace(' meadow', '').replace(' prairie', '') + ', in ' + next.season.toLowerCase()}.`;
    show('nextgen', true);
  }
  /* animate the hop north on the map, then hand back to main */
  function showHop(from, to, title, text, onDone) {
    hop = { t: 0, leg: [from, to], hops: [[from, to]], onDone };
    $('hopTitle').textContent = title; $('hopText').textContent = text;
    $('btnHopDone').disabled = true;
    show('hop', true);
    speak(title + '. ' + text);
  }

  return { init, update, tick, hint, card, refreshToggles, refreshVariant, refreshJournalLine, hideTitle, showSouth, showArrived, showSpring, showNextGen, showHop, showMap, showJournal, showGarden, showCitizen, forecast, resetFacts, queueFact, setMode, anyModal, closeAll, speak, stopSpeaking, isFactOpen: () => factOpen };
})();
