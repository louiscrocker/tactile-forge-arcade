/* ============================================================
   boot.js — the loop, the buttons, the keys, auto-pause, and the
   URL debug switches used for screenshots and tests:
     ?level=<id> ?coop=<id> ?map=1 ?diff=easy|normal|hard ?seed=N
     ?warp=<seconds the bots play first> ?bot=1 (bots keep playing)
     ?pad=1 (touch buttons) ?unlock=1 (all stars) ?results=1 ?clean=1
     ?open=help|grownups|wardrobe|coop|settings|pause
   ============================================================ */
'use strict';

(function () {
  const canvas = $('scene');
  let W = 1, H = 1, last = performance.now();
  function resize() { W = innerWidth; H = innerHeight; Render.resize(W, H, Math.min(2, devicePixelRatio || 1)); G.cam.resize(W, H); }
  addEventListener('resize', resize);

  /* sound can only start after a tap or a key */
  function unlockAudio() { if (G.audioUnlocked) return; G.audioUnlocked = true; if (G.settings.sound) AudioFX.setEnabled(true); }
  addEventListener('pointerdown', unlockAudio, true); addEventListener('keydown', unlockAudio, true);

  /* ---------- buttons ---------- */
  const on = (id, fn) => $(id).addEventListener('click', (e) => { AudioFX.play('click'); fn(e); });
  on('btnStart', () => { if (SaveGame.hasProgress()) { Grownups.askGrownup({ title: 'Start the street again?', reason: 'This clears every star, hat and new building on this device.' }).then(ok => { if (ok) { SaveGame.reset(); SaveGame.write(); toMap(0); } }); } else startLevel(LEVELS[0]); });
  on('btnContinue', () => toMap());
  for (const id of ['btnTwo', 'btnTwoMap']) on(id, () => UI.coop((def) => startLevel(def)));
  for (const id of ['btnHelpT', 'btnHelpD']) on(id, () => UI.show('help', true));
  for (const id of ['btnGrownT', 'btnGrownD']) on(id, () => UI.show('grownups', true));
  on('helpClose', () => UI.show('help', false)); on('grownClose', () => UI.show('grownups', false));
  on('wardClose', () => UI.show('wardrobe', false)); on('coopClose', () => UI.show('coop', false));
  on('drawerClose', () => UI.show('drawer', false)); on('btnSettings', () => UI.show('drawer', true));
  on('btnWardrobe', () => UI.wardrobe(() => { SaveGame.write(); wardrobeToG(); }));
  on('mapBack', toTitle);
  on('mapPrev', () => { if (G.sel > 0) { G.sel--; UI.refreshMap(G.sel); } });
  on('mapNext', () => { if (G.sel < LEVELS.length - 1) { G.sel++; UI.refreshMap(G.sel); } });
  on('mcPlay', () => { if (SaveGame.unlocked(LEVELS[G.sel].id)) startLevel(LEVELS[G.sel]); });
  on('introGo', beginPlay); on('introSay', sayIntro); on('btnSay', () => { if (G.def) Voice.say(G.def.say, { interrupt: true, force: true }); });
  on('btnPause', () => pauseGame(true)); on('pResume', () => pauseGame(false));
  on('pRestart', () => { pauseGame(false); startLevel(G.def); }); on('pMap', () => { pauseGame(false); AudioFX.pause(false); toMap(Math.max(0, LEVELS.indexOf(G.def))); });
  on('resAgain', () => startLevel(G.def)); on('resMap', () => toMap(Math.max(0, LEVELS.indexOf(G.def)))); on('resNext', resultNext);
  on('btnReset', () => Grownups.askGrownup({ title: 'Start the whole street again?', reason: 'This clears every star, hat and new building on this device.' }).then(ok => { if (ok) { SaveGame.reset(); SaveGame.write(); UI.show('grownups', false); toTitle(); } }));
  const flip = (k) => () => { G.settings[k] = !G.settings[k]; applySettings(); };
  for (const id of ['tgSound', 'tgSoundT', 'tgSoundD']) on(id, flip('sound'));
  for (const id of ['tgMusic', 'tgMusicD']) on(id, flip('music'));
  for (const id of ['tgVoice', 'tgVoiceT', 'tgVoiceD']) on(id, flip('voice'));
  on('tgShake', flip('shake')); on('tgSlow', flip('slow'));
  $('selTouch').addEventListener('change', (e) => { G.settings.touch = e.target.value; applySettings(); if (G.mode === 'play') UI.show('pad', touchWanted()); });
  for (const seg of ['diffTitle', 'diffDrawer']) $(seg).addEventListener('click', (e) => { const b = e.target.closest('button[data-diff]'); if (!b) return; G.settings.diff = b.dataset.diff; applySettings(); AudioFX.play('click'); });
  Input.bindPad($('pad'));
  Grownups.guardOutboundLinks();

  /* the map: tap a stop to choose it, tap it again to go */
  canvas.addEventListener('pointerdown', (e) => {
    if (G.mode !== 'map' || UI.anyModal()) return;
    const i = MapView.hit(e.clientX, e.clientY, W, H); if (i < 0) return;
    if (i === G.sel && SaveGame.unlocked(LEVELS[i].id)) startLevel(LEVELS[i]); else { G.sel = i; UI.refreshMap(i); AudioFX.play('click'); }
  });

  /* ---------- keys ---------- */
  addEventListener('keydown', (e) => {
    if (Input.typing(e) || document.querySelector('.gu-veil')) return;
    if (G.mode === 'play' && !G.paused && Input.keydown(e)) return;
    const k = e.key, c = e.code;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (c === 'KeyM') { G.settings.sound = !G.settings.sound; applySettings(); return; }
    if (c === 'KeyO') { toggleLook(); return; }
    if (k === 'Escape' && UI.closeTopModal()) return;
    if (G.mode === 'play') {
      if (!$('intro').hidden) { if (k === 'Enter' || k === ' ' || c === 'KeyX') { e.preventDefault(); beginPlay(); } return; }
      if (!$('results').hidden) { if (k === 'Enter') { e.preventDefault(); resultNext(); } return; }
      if (c === 'KeyP' || k === 'Escape') { pauseGame(!G.paused); return; }
      if (c === 'KeyV' && G.def) Voice.say(G.def.say, { interrupt: true, force: true });
      return;
    }
    if (UI.anyModal()) return;
    if (G.mode === 'map') {
      if (k === 'ArrowLeft' && G.sel > 0) { G.sel--; UI.refreshMap(G.sel); AudioFX.play('click'); }
      if (k === 'ArrowRight' && G.sel < LEVELS.length - 1) { G.sel++; UI.refreshMap(G.sel); AudioFX.play('click'); }
      if ((k === 'Enter' || k === ' ') && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); if (SaveGame.unlocked(LEVELS[G.sel].id)) startLevel(LEVELS[G.sel]); }
      if (k === 'Escape') toTitle();
    } else if (G.mode === 'title' && k === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); if (SaveGame.hasProgress()) toMap(); else startLevel(LEVELS[0]); }
  });
  addEventListener('keyup', (e) => Input.keyup(e));
  addEventListener('blur', () => { Input.reset(); if (G.mode === 'play' && !G.paused) pauseGame(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Input.reset(); if (G.mode === 'play' && !G.paused) pauseGame(true); AudioFX.pause(true); Voice.stop(); SaveGame.write(); }
    else { last = performance.now(); if (!(G.mode === 'play' && G.paused)) AudioFX.pause(false); }
  });

  /* ---------- gamepads on the menus ---------- */
  let padPrev = {};
  function padMenus(pads) {
    const g = pads[0]; if (!g) return;
    const left = g.x < -.5, right = g.x > .5;
    if (G.mode === 'play') {
      if (g.startPressed && !G.result) { if (!$('intro').hidden) beginPlay(); else pauseGame(!G.paused); }
      else if (g.actionPressed) { if (!$('intro').hidden) beginPlay(); else if (!$('results').hidden) resultNext(); else if (G.paused) pauseGame(false); }
    } else if (G.mode === 'map' && !UI.anyModal()) {
      if (left && !padPrev.left && G.sel > 0) { G.sel--; UI.refreshMap(G.sel); }
      if (right && !padPrev.right && G.sel < LEVELS.length - 1) { G.sel++; UI.refreshMap(G.sel); }
      if ((g.actionPressed || g.startPressed) && SaveGame.unlocked(LEVELS[G.sel].id)) startLevel(LEVELS[G.sel]);
      if (g.eggPressed) toTitle();
    } else if (G.mode === 'title' && (g.actionPressed || g.startPressed)) { if (SaveGame.hasProgress()) toMap(); else startLevel(LEVELS[0]); }
    if (UI.anyModal() && g.eggPressed) UI.closeTopModal();
    padPrev = { left, right };
  }

  /* ---------- the loop ---------- */
  function events(L, attract) { for (const e of L.events) Director.handle(G, L, e, attract); L.events.length = 0; }
  function loop(now) {
    requestAnimationFrame(loop);
    const raw = clamp((now - last) / 1000, 0, .1); last = now;
    if (document.hidden) return;
    G.t += raw; UI.tick(raw);
    const pads = Gamepads.poll();
    const L = G.level;
    if (G.mode === 'play' && L) {
      const live = !G.paused && !L.result;
      if (live) {
        G.acc = Math.min(G.acc + raw * (G.settings.slow ? .75 : 1), .1);
        let inp = G.acc < STEP ? null : G.bot ? L.players.map((a, n) => Bot.input(L, a, G.bot[n])) : Input.read(L.players.length, pads);
        while (G.acc >= STEP && !L.result) {
          L.step(STEP, inp); G.acc -= STEP; events(L, false);
          if (!G.bot) inp = inp.map(i => Object.assign({}, i, { upP: false, downP: false, jumpP: false, actionP: false }));
          else inp = L.players.map((a, n) => Bot.input(L, a, G.bot[n]));
        }
        if (L.result && !G.result) setTimeout(() => finishLevel(L.result), 350);
        UI.hud(L);
      } else if (pads.length) Input.read(L.players.length, pads);
      padMenus(pads);
      if (G.newBuilding) G.newBuilding.t += raw;
      Render.frameCamera(G.cam, L, insets(), false);
      AudioFX.update(raw, { mode: L.def.boss === 'storm' ? 'storm' : L.smash ? 'smash' : 'mend', rain: L.def.boss === 'storm' ? 1 : 0, wind: L.gust ? 1 : L.def.boss === 'storm' ? .3 : 0, combo: L.combo });
    } else if (G.mode === 'title' && G.attract) {
      const A = G.attract;
      if (!A.result) { A.step(STEP, A.players.map((a, k) => Bot.input(A, a, G.attractBots[k]))); events(A, true); }
      if (A.result) startAttract();
      Render.frameCamera(G.cam, G.attract, { top: 20, bottom: 20 }, false);
      if (W > 1000) G.cam.tx -= W * .33 / G.cam.tzoom;   /* the bots play beside the title card, not behind it */
      padMenus(pads);
      AudioFX.update(raw, { mode: 'mend' });
    } else { padMenus(pads); AudioFX.update(raw, { mode: 'map' }); }
    G.cam.update(raw, G.level || G.attract ? { left: -200, right: (G.level || G.attract).W + 200, top: -2000, bottom: GROUND_Y + 300 } : null);
    G.particles.update(raw);
    if (G.mode === 'map') drawMap();
    else if (G.level || G.attract) { const keep = G.level; if (!keep) G.level = G.attract; Render.frame(G, raw); G.level = keep; }
    if (params.has('debug')) document.title = `${G.mode} fps=${Render.fps.toFixed(0)} t=${L ? L.time.toFixed(1) : ''}`;
  }

  /* the town map: classic straight onto the canvas; painted through the GPU with the
     stop numbers and stars on the overlay */
  function drawMap() {
    const main = Render.ctx;
    if (!Render.gl()) { main.setTransform(Render.DPR, 0, 0, Render.DPR, 0, 0); MapView.draw(main, W, H, G.t, G.sel); return; }
    const ctx = Render.beginGL('morning');
    main.setTransform(Render.DPR, 0, 0, Render.DPR, 0, 0);
    MapView.draw(ctx, W, H, G.t, G.sel, main);
    const { s, street } = MapView.layout(W, H), cx = MapView.camX;
    Render.endGL('morning', { x: cx, y: 0, zoom: s, toScreen: (x, y) => [(x - cx) * s, y * s] }, { groundY: street, hillBase: street + 40, hillCamX: cx * .6, skyCamX: cx, t: G.t });
  }
  /* O: the painted look on/off (remembered); the grown-ups' settings drawer has the same switch */
  function toggleLook() {
    if (typeof GFX === 'undefined' || !GFX.available()) { UI.hint('The painted look needs WebGL2 (not on this device)', 3); return; }
    const on = GFX.toggle(); UI.hint(on ? 'Painted look on' : 'Classic look on', 2); syncLook();
  }
  function syncLook() { const b = $('tgGfx'); if (!b) return; const ok = typeof GFX !== 'undefined' && GFX.available(); b.disabled = !ok; b.classList.toggle('on', ok && GFX.active()); }
  on('tgGfx', toggleLook);
  setInterval(syncLook, 2000);   /* the slow-device fallback can switch it off by itself */

  /* ---------- go ---------- */
  Render.init(canvas); resize();
  SaveGame.load();
  if (params.has('unlock')) { for (const l of LEVELS) SaveGame.data.stars[l.id] = 3; SaveGame.data.stars.cottage = 3; }
  if (params.has('diff') && DIFF[params.get('diff')]) G.settings.diff = params.get('diff');
  if (params.has('pad')) G.settings.touch = 'on';
  Voice.init(); applySettings(); wardrobeToG(); syncLook();
  $('titleCanvas').hidden = true;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  const want = params.get('level') || params.get('coop');
  if (want && levelById(want)) {
    startLevel(levelById(want), { noIntro: params.has('warp') || params.has('bot') || params.has('nointro') });
    if (params.has('warp')) { const L = G.level, bots = L.players.map(a => Bot.make(a.type)); for (let t = 0; t < +params.get('warp') && !L.result; t += STEP) { L.step(STEP, L.players.map((a, n) => Bot.input(L, a, bots[n]))); for (const e of L.events) if (['break', 'crumble', 'fixed', 'catch', 'stomp'].includes(e.type)) Director.handle(G, L, e, true); L.events.length = 0; } G.particles.update(.3); Render.frameCamera(G.cam, L, insets(), true); }
    if (params.has('bot')) G.bot = G.level.players.map(a => Bot.make(a.type));
    if (params.has('results')) { const L = G.level; L.finish(false); G.level.result = L.result; finishLevel(L.result); }
  } else if (params.has('map')) toMap(params.has('sel') ? +params.get('sel') : undefined);
  else toTitle();
  if (params.has('open')) { const o = params.get('open'); setTimeout(() => { if (o === 'wardrobe') UI.wardrobe(() => {}); else if (o === 'coop') UI.coop(() => {}); else if (o === 'settings') UI.show('drawer', true); else if (o === 'pause') { if (G.mode === 'play') { beginPlay(); pauseGame(true); } } else if ($(o)) UI.show(o, true); }, 50); }
  if (params.has('clean')) { const st = document.createElement('style'); st.textContent = '.hud,.hint,.combo,.pad,.mapui,.title-card{visibility:hidden!important}'; document.head.appendChild(st); }
  requestAnimationFrame(loop);
})();
