/* ============================================================
   story.js — the director: what happens when, and what it means
   ============================================================
   Shared by main.js (the browser) and smoke.js (Node), so the test
   plays exactly the story the children play.  No DOM here: the
   browser passes in hooks for hints, facts, cinematics and the
   "a new generation!" choice; smoke.js passes stubs.
   Timers run on game time (G.time), so time-lapse speeds them up
   and a test is deterministic.
     late summer: Mum lets her babies go · the planula settles under
     a ledge · autumn: the polyp eats and buds clones (the sea slug
     comes past) · winter: the stack of discs, pop free · spring: the
     ephyra grows (herring, a tern, comb jellies) · the young jelly
     (a turtle, a sunfish, a gull) · summer: four rings, the bloom ·
     the boy's little cloud / the girl's babies · the next generation
   ============================================================ */
'use strict';

const Story = (function () {
  let G = null, ui = {};
  let timers = [];
  const once = {};
  const T = { winter: null, slug: null, school: null, tern: null, visit: null, gull: null };
  let lastNight = null;

  const P = () => G.player;
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  /* a timer on game time; one made for an old world never fires in a new one */
  function later(sec, fn) { timers.push({ at: G.time + sec, fn, W0: G.world }); }
  const hint = (k) => ui.hint && ui.hint(k);
  const fact = (k, sec = 0) => { if (!ui.fact) return; if (sec) later(sec, () => ui.fact(k)); else ui.fact(k); };
  const cine = (o) => ui.cine && ui.cine(o);
  const sound = (n, ...a) => { if (typeof AudioFX !== 'undefined' && AudioFX[n]) AudioFX[n](...a); };

  function bind(game, hooks) { G = game; if (hooks) ui = hooks; }
  function reset() { timers = []; for (const k in once) delete once[k]; for (const k in T) T[k] = null; lastNight = null; }

  /* the mother moon jelly, drifting by the reef with her babies in the pouches on her arms */
  function makeMum(x) {
    const Wd = G.world;
    Wd.mum = { x: x === undefined ? WORLD.mumX : x, y: 70, cm: 26, r: bellUnits(26), form: G.form, eggs: 1, ph: 0, pulseT: 0, leaving: false, fade: 0 };
    return Wd.mum;
  }
  function updateMum(dt) {
    const m = G.world.mum; if (!m) return;
    m.pulseT = (m.pulseT + dt * .55) % 1;
    if (m.leaving) { m.x -= 12 * dt; m.y -= 3 * dt; m.fade += dt * .12; if (m.fade > 1) G.world.mum = null; }
    else m.y = 70 + Math.sin(m.ph * .3) * 6;
  }

  /* ---------- the big turns of the year ---------- */
  function startWinter() {
    const p = P(), Wd = G.world;
    T.winter = null;
    if (p.stage !== 'polyp' || p.mode !== 'polyp') return;
    Wd.setSeason('winter'); G.day += 60; G.tod = .5; Wd.temp = 7;
    hint('cold'); fact('cold'); fact('years', 12);
    p.startStrobila();
    cine({ follow: () => ({ x: P().site.x, y: P().site.y + 20 }), zoom: 6, duration: 4, slow: .6, title: 'Winter' });
  }
  function startBloom() {
    const p = P(), Wd = G.world;
    Wd.makeBloom(p);
    Wd.setSeason('summer'); G.tod = .45;
    hint('bloom'); fact('bloom'); fact('currents', 15);
    sound('fanfare');
    cine({ follow: () => ({ x: (P().x + WORLD.bloomX) / 2, y: 150 }), zoom: .55, duration: 4.5, slow: .7, title: 'The summer bloom!' });
  }
  function startMating() {
    const p = P(), Wd = G.world;
    if (p.flags.mating) return;
    p.flags.mating = true;
    G.tod = .86;
    /* any visitor heads off: this is the bloom's moment */
    for (const v of Wd.visitors) if (v.state !== 'leave') { v.state = 'leave'; v.t = 0; v.dir = sign(v.x - p.x) || 1; }
    Wd.makeMates(p, p.sex === 'boy' ? 'girl' : 'boy');
    hint(p.sex === 'boy' ? 'findgirl' : 'findcloud'); fact('spawn');
  }
  /* a boy's ending: weeks later, the girl he met lets her babies go, and they swim down to find a rock */
  function boyEnding() {
    const p = P(), Wd = G.world;
    if (p.flags.genDone || p.flags.boyEnd) return;
    p.flags.boyEnd = true;
    G.day += 21; G.tod = .9;
    const girl = Wd.mates().find(j => j.met) || Wd.mates()[0] || Wd.makeBloomJelly(Wd.bloom || Wd.makeBloom(p));
    girl.eggs = 1; girl.role = girl.role || 'girl'; girl.x = p.x + 70; girl.y = p.y;
    girl.hold = true;
    hint('larvae'); fact('pouches');
    cine({ follow: () => ({ x: girl.x, y: girl.y + 30 }), zoom: 3, duration: 6.5, slow: .8, title: 'Weeks later…' });
    let n = 0;
    const burst = () => { if (n >= 6) return; n++; Wd.larvaBurst(girl.x, girl.y + bellUnits(girl.cm) * 1.4, 45); sound('splash'); girl.eggs = Math.max(0, 1 - n / 6); if (n < 6) later(.9, burst); };
    later(1.2, burst);
    later(7.4, () => P().milestone('larvae', () => { girl.hold = false; generationDone(); }));
  }
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    hint('larvae'); fact('lifecycle'); fact('twoshapes', 8);
    Bus.emit('generationDone', p);
    if (ui.done) ui.done();
  }

  function init(game, hooks) {
    bind(game, hooks);
    Bus.on('started', (p) => { if (!p || p.stage !== 'egg') return; hint('egg'); fact('brood', 1.8); });
    Bus.on('eggReady', () => { hint('hatch'); const m = G.world.mum; if (m) m.shake = 1; });
    Bus.on('hatched', () => {
      sound('hatch'); hint('swimfree'); fact('planula'); fact('cilia', 9); fact('noeat', 25);
      cine({ follow: P, zoom: 7, duration: 3, slow: .5, title: 'Swim free!' });
      later(6, () => { const m = G.world.mum; if (m) m.leaving = true; });
    });
    Bus.on('overReef', () => { hint('search'); fact('settle'); });
    Bus.on('taken', () => { if (first('takenFact')) fact('dock', 4); });
    Bus.on('settled', (p) => {
      sound('magic'); hint('polyp'); fact('polyp'); fact('tentacles', 14);
      if (ui.lifeDone) ui.lifeDone(G.form, G.sex);
      cine({ follow: () => ({ x: P().site.x, y: P().site.y + 14 }), zoom: 7, duration: 3.5, slow: .5, title: 'Upside down, at home!' });
      later(12, () => { if (P().stage === 'polyp') { G.world.setSeason('autumn'); G.day += 20; hint('stretch'); } });
      later(30, () => { if (P().stage === 'polyp' && P().mode === 'polyp') hint('friend'); });
    });
    Bus.on('caught', () => { if (first('caught1')) hint('caught'); });
    Bus.on('polypAte', () => { if (first('ate1')) fact('catch'); });
    Bus.on('tentacles', (p, n) => { hint('tentacles'); if (n === 16) fact('onehole', 6); });
    Bus.on('fullPolyp', () => { hint('bud'); fact('bud'); });
    Bus.on('budded', (p, n) => { hint('budded'); fact('clones'); sound('magic'); if (n < p.D.buds) later(4, () => { if (P().mode === 'polyp' && !P().canBud()) hint('morebuds'); }); });
    Bus.on('budsDone', () => { T.winter = G.time + 9; });
    Bus.on('slug', () => { hint('slug'); fact('slug'); });
    Bus.on('slugPast', () => hint('slugpast'));
    Bus.on('strobila', () => fact('strobila', 5));
    Bus.on('stack', () => { hint('pop'); fact('ephyrae'); });
    Bus.on('popFree', (p) => {
      const Wd = G.world;
      Wd.setSeason('spring'); G.day += 40; G.tod = .4; Wd.temp = 8;
      sound('fanfare'); hint('free'); fact('ephyra'); fact('pulse', 12); fact('regrow', 30); fact('nobrain', 55);
      cine({ follow: P, zoom: 7, duration: 3.5, slow: .5, title: 'Pop! A baby jellyfish!' });
      const s = p.site, n = p.D.discs - 1;
      for (let k = 1; k <= n; k++) later(1.4 * k, () => { if (s) G.world.popDisc(s.x, s.y + 18 + (n - k) * 2); });
      T.school = G.time + 50 + Math.random() * 30; T.tern = G.time + 30;
    });
    Bus.on('ate', (p) => { if (p.stats.plankton === 3) hint('eatplankton'); if (p.stats.plankton === 8) fact('plankton'); if (p.stats.plankton === 16) fact('diatom'); });
    Bus.on('copepodJump', () => { if (first('copepod')) hint('copepod'); });
    Bus.on('ateCopepod', () => fact('copepod'));
    Bus.on('glow', () => { if (first('glow')) fact('glow'); });
    Bus.on('dash', (p) => { if (first('dash1') && p.jelly) fact('pulse'); });
    Bus.on('grew', (p, i) => { hint('grew'); fact(i === 2 ? 'rhopalia' : 'water'); sound('molt'); });
    Bus.on('missed', () => hint('missed'));
    Bus.on('fishSchool', () => { hint('fish'); fact('herring'); });
    Bus.on('combJelly', () => { if (first('jellyHint')) { hint('jelly'); fact('combjelly'); } });
    Bus.on('ternDip', () => { hint('tern'); fact('tern'); });
    Bus.on('gullDip', () => { hint('gull'); fact('gull'); });
    Bus.on('birdPass', (b) => { const p = P(); if (!p.jelly || p.mode !== 'swim') return; if (Math.abs(b.target.x - p.x) < 70) p.struck({ kind: b.kind, x: b.x, y: b.y }); else Bus.emit('birdMissed'); });
    Bus.on('medusa', () => {
      sound('fanfare'); hint('medusa'); fact('mucus'); fact('arms', 14); fact('medusaname', 34); fact('nobones', 60);
      cine({ follow: P, zoom: 5, duration: 3.5, slow: .5, title: 'A young moon jelly!' });
      T.visit = G.time + 45 + Math.random() * 30; T.gull = G.time + 25;
    });
    Bus.on('stuck', (p, n) => { if (n === 2 && first('stuckHint')) hint('stuck'); });
    Bus.on('stuckFull', () => hint('stuck'));
    Bus.on('licked', () => { if (first('licked1')) { hint('licked'); fact('arms'); } else if (P().stats.licks === 4) hint('grow'); });
    Bus.on('ride', () => { hint('current'); fact('drift'); });
    Bus.on('turtle', () => { hint('turtle'); fact('turtle'); });
    Bus.on('sunfish', () => { hint('sunfish'); fact('sunfish'); });
    Bus.on('dodged', () => hint('dodged'));
    Bus.on('adult', (p) => {
      const Wd = G.world;
      Wd.setSeason('summer'); G.day += 45;
      sound('fanfare'); hint('adult'); fact('rings'); fact('fringe', 12); fact('size', 26); fact('moon', 40); fact('shrink', 60); fact('touch', 80);
      cine({ follow: P, zoom: 4, duration: 3.5, slow: .5, title: 'Four rings!' });
    });
    Bus.on('grown', () => later(2, startBloom));
    Bus.on('inBloom', () => { hint('inbloom'); fact('smack'); fact('everywhere', 14); later(4, startMating); });
    Bus.on('sparkle', () => { hint('sparkle'); fact('glow'); });
    Bus.on('cloud', () => { if (P().sex === 'girl' && first('cloudHint')) hint('findcloud'); });
    Bus.on('met', (p) => {
      if (p.sex === 'boy') { hint('shared'); sound('fanfare'); for (let k = 0; k < 6; k++) G.particles.text(p.x + rnd(-20, 20), p.y - p.r - 6, '♥', '#ff7aa8', 14); later(6, boyEnding); }
      else { p.startBrood(); }
    });
    Bus.on('brooding', () => { hint('brood'); fact('pouches'); G.day += 3; });
    Bus.on('broodDone', () => { G.day += 20; G.tod = .9; hint('ready'); sound('magic'); });
    Bus.on('release', () => hint('release'));
    Bus.on('fan', (p, n) => { if (n === 1) fact('planula'); });
    Bus.on('larvaeReleased', () => generationDone());
  }

  /* ---------- after a save is loaded: re-arm whatever was about to happen (timers are not saved) ---------- */
  function afterRestore() {
    const p = P(), Wd = G.world;
    if (p.stage === 'egg') makeMum();
    if (p.stage === 'polyp' && p.mode === 'polyp' && p.flags.budsDone) T.winter = G.time + 5;
    if (p.stage === 'polyp' && p.mode === 'strobila') Wd.setSeason('winter');
    if (p.stage === 'ephyra') { T.school = G.time + 40; T.tern = G.time + 20; }
    if (p.stage === 'medusa') { T.visit = G.time + 40; T.gull = G.time + 20; }
    if (p.flags.grown && !p.flags.bloomFound) Wd.makeBloom(p);
    if (p.flags.bloomFound) { Wd.makeBloom(p); if (!p.flags.met || p.sex === 'boy') { p.flags.mating = false; startMating(); if (p.flags.met) for (const j of Wd.mates()) { j.met = true; break; } } }
    if (p.flags.met && p.sex === 'boy' && !p.flags.genDone) { p.flags.boyEnd = false; later(3, boyEnding); }
    if (p.flags.met && p.sex === 'girl' && !p.flags.broodStarted) p.startBrood();
    if (p.flags.released && !p.flags.genDone) later(2, generationDone);
  }

  /* ---------- the director (every tick) ---------- */
  function update(dt) {
    if (!G) return;
    for (let i = 0; i < timers.length; i++) { const t = timers[i]; if (t.W0 !== G.world) { timers.splice(i--, 1); continue; } if (G.time >= t.at) { timers.splice(i--, 1); t.fn(); } }
    updateMum(dt);
    const p = P(), Wd = G.world, D = G.diff(), vis = G.settings.visitors;
    if (!p) return;
    const night = nightAmount(G.tod) > .5;
    /* the turns of the year */
    if (T.winter !== null && G.time > T.winter && p.busy <= 0 && !Wd.slug) startWinter();
    /* the plankton go up at night and down by day */
    if (p.stage === 'ephyra' && p.mode === 'swim') {
      if (lastNight !== null && night !== lastNight) { hint(night ? 'night' : 'day'); fact('updown'); }
      lastNight = night;
    }
    /* the bloom: once you are in among the jellies, the spawning begins */
    if (p.stage === 'medusa' && p.flags.grown && !p.flags.bloomFound && Wd.bloom && Wd.bloomCount(p.x, p.y, 280) >= 8) { p.flags.bloomFound = true; Bus.emit('inBloom', p); }
    if (p.flags.bloomFound && p.mode === 'swim') p.stats.bloomTime += dt;
    /* visitors: never during the big moments */
    const calm = vis && !p.flags.mating && !p.flags.genDone && p.busy <= 0 && p.tumble <= 0 && !(typeof Cinematic !== 'undefined' && Cinematic.active);
    if (!calm) return;
    if (p.stage === 'polyp' && p.mode === 'polyp' && D.slug && !Wd.slug && p.stats.polypMeals >= 1) {
      if (T.slug === null) T.slug = G.time + (40 + Math.random() * 40) / D.risk;
      if (G.time > T.slug) { T.slug = null; Wd.startSlug(p); }
    }
    if (p.stage === 'ephyra' && p.mode === 'swim') {
      if (D.fish && T.school !== null && G.time > T.school && !Wd.school) { Wd.startSchool(p); T.school = G.time + (70 + Math.random() * 50) / D.risk; }
      if (!night && p.y < Wd.seaLevel() + 50 && T.tern !== null && G.time > T.tern) { if (Wd.dip(p, 'tern')) T.tern = G.time + 50 + Math.random() * 40; }
    }
    if (p.stage === 'medusa' && p.mode === 'swim') {
      if (D.fish && T.visit !== null && G.time > T.visit && !Wd.visitors.length) { Wd.startVisitor(p.x < WORLD.openR || Math.random() < .4 ? 'sunfish' : 'turtle', p); T.visit = G.time + (60 + Math.random() * 50) / D.risk; }
      if (!D.fish && T.visit !== null && G.time > T.visit && !Wd.visitors.length) { Wd.startVisitor('turtle', p); T.visit = null; }
      if (!night && p.y < Wd.seaLevel() + 50 && T.gull !== null && G.time > T.gull) { if (Wd.dip(p, 'gull')) T.gull = G.time + 60 + Math.random() * 40; }
    }
  }

  return { init, bind, reset, update, afterRestore, generationDone, boyEnding, startWinter, startBloom, startMating, makeMum, later, timers: T };
})();
