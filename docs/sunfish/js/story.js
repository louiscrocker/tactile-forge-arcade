/* ============================================================
   story.js — the director: what happens when, and what it means
   ============================================================
   Shared by main.js (the browser) and smoke.js (Node), so the test
   plays exactly the story the children play.  No DOM here: the
   browser passes in hooks for hints, facts, cinematics and the
   "a new generation!" choice; smoke.js passes stubs.  Timers run on
   game time (G.time), so time-lapse speeds them up.
     the warm sea in summer: a mother lets her eggs go · the hatchling
     in the plankton (anchovies, comb jellies, a gull) · the spiky
     star · the young sunfish in its school (mahi-mahi, tuna) · the
     sunfish: dives for jellies, the cold, basking (a gull pecks lice
     off), the boat, visitors that miss · itchy → the kelp cleaning
     station · the net · a giant: the breach · the journey back to the
     warm sea: the boy's little cloud / the girl's eggs · next generation
   ============================================================ */
'use strict';

const Story = (function () {
  let G = null, ui = {};
  let timers = [];
  const once = {};
  const T = { school: null, gull: null, visit: null, boat: null, net: null, land: null, journey: null, far: 0 };
  let lastNight = null, seen = {};

  const P = () => G.player;
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  /* a timer on game time; one made for an old world never fires in a new one */
  function later(sec, fn) { timers.push({ at: G.time + sec, fn, W0: G.world }); }
  const hint = (k) => ui.hint && ui.hint(k);
  const fact = (k, sec = 0) => { if (!ui.fact) return; if (sec) later(sec, () => ui.fact(k)); else ui.fact(k); };
  const cine = (o) => ui.cine && ui.cine(o);
  const sound = (n, ...a) => { if (typeof AudioFX !== 'undefined' && AudioFX[n]) AudioFX[n](...a); };

  function bind(game, hooks) { G = game; if (hooks) ui = hooks; }
  function reset() { timers = []; for (const k in once) delete once[k]; for (const k in T) T[k] = null; T.far = 0; lastNight = null; seen = {}; }

  /* the mother: a big sunfish who has just let her eggs go, swimming slowly off */
  function makeMum() {
    const Wd = G.world;
    Wd.mum = { x: WORLD.eggX + 140, y: 110, cm: 200, form: G.form, face: 1, ph: 0, leaving: false, fade: 0 };
    Wd.babyBurst(WORLD.eggX, 50, 120);
    return Wd.mum;
  }
  function updateMum(dt) {
    const m = G.world.mum; if (!m) return;
    m.ph += dt;
    if (m.leaving) { m.x += 22 * dt; m.y += 5 * dt; m.fade += dt * .1; if (m.fade > 1) G.world.mum = null; }
    else m.y = 110 + Math.sin(m.ph * .4) * 8;
  }

  /* ---------- the big turns ---------- */
  function startJourney() {
    const p = P(), Wd = G.world;
    T.journey = null;
    if (p.flags.journey || p.stage !== 'mola') return;
    p.flags.journey = true;
    Wd.setSeason('summer'); G.day += 30;
    for (const v of Wd.visitors) if (v.state !== 'leave') { v.state = 'leave'; v.t = 0; }
    Wd.makeMates(p, p.sex === 'boy' ? 'girl' : 'boy');
    hint('journey'); fact('warmsea'); sound('fanfare');
    cine({ follow: () => ({ x: P().x - 200, y: P().y }), zoom: .9, duration: 4.5, slow: .7, title: 'To the warm sea!' });
    Bus.emit('journey', p);
  }
  /* a boy's ending: days later, the girl he met lets her eggs go */
  function boyEnding() {
    const p = P(), Wd = G.world;
    if (p.flags.genDone || p.flags.boyEnd) return;
    p.flags.boyEnd = true;
    G.day += 2; G.tod = .45;
    const girl = Wd.mates.find(m => m.met) || Wd.mates[0];
    if (!girl) { generationDone(); return; }
    girl.with = false; girl.hx = p.x + 160; girl.hy = p.y; girl.x = p.x + 160; girl.y = p.y;
    hint('larvae'); fact('spawn');
    cine({ follow: () => ({ x: girl.x, y: girl.y }), zoom: 1.6, duration: 6.5, slow: .8, title: 'Millions of eggs!' });
    let n = 0;
    const burst = () => { if (n >= 6) return; n++; Wd.babyBurst(girl.x - girl.face * 30, girl.y + 20, 70); sound('splash'); if (n < 6) later(.9, burst); };
    later(1.2, burst);
    later(7.4, () => P().milestone('larvae', generationDone));
  }
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    hint('larvae'); fact('lifecycle'); fact('babies', 8); fact('life', 20);
    Bus.emit('generationDone', p);
    if (ui.done) ui.done();
  }
  /* which visitor comes to a grown sunfish: the sea lion near the coast, the others out at sea; something new each time */
  function pickVisitor(p) {
    const D = G.diff();
    let list = p.x > WORLD.slopeL - 500 ? ['sealion', 'turtle', 'shark'] : ['orca', 'shark', 'turtle', 'sealion'];
    if (!D.fish) list = ['turtle', 'sealion'];
    const fresh = list.filter(k => !seen[k]);
    const k = fresh.length ? fresh[0] : pick(list);
    seen[k] = true;
    return k;
  }

  function init(game, hooks) {
    bind(game, hooks);
    Bus.on('started', (p) => { if (!p || p.stage !== 'egg') return; hint('egg'); fact('egg', 1.8); fact('drift', 14); });
    Bus.on('eggReady', () => hint('hatch'));
    Bus.on('hatched', () => {
      sound('hatch'); hint('swim'); fact('hatch');
      cine({ follow: P, zoom: 8, duration: 3, slow: .5, title: 'Hatch!' });
      fact('plankton', 9); fact('copepod', 30);
      T.school = G.time + 40; T.gull = G.time + 25;
      later(5, () => { const m = G.world.mum; if (m) m.leaving = true; });
    });
    Bus.on('ate', (p) => { if (p.stats.plankton === 3) hint('bigger'); if (p.stats.plankton === 10) fact('krill'); });
    Bus.on('glow', () => { if (first('glow')) fact('glow'); });
    Bus.on('dash', (p) => { if (first('dash1') && p.stage === 'larva') hint('missed'); });
    Bus.on('spikes', () => { if (first('spikes1')) fact('star'); });
    Bus.on('growing', (p) => { sound('molt'); cine({ follow: P, zoom: clamp(150 / (p.len + 12), 1, 9), duration: 2, slow: .6, title: 'Growing!' }); });
    Bus.on('grew', (p, key) => {
      G.particles.sparkle(p.x, p.y, 18, '#fff3c0', p.len * .8);
      if (p.stage === 'larva' && p.zinstar === 2) { hint('star'); fact('star'); fact('puffer', 12); sound('fanfare'); later(10, () => { if (P().stage === 'larva') hint('spikes'); }); }
      else if (p.stage === 'larva') hint('grow');
      else if (p.stage === 'juvenile') { hint('grew'); fact('spines'); }
      else if (p.size === 2) { hint('grew'); fact('growth'); T.net = G.time + 40; }
      else { hint('grew'); fact('heavy'); fact('fast', 14); sound('fanfare'); cine({ follow: P, zoom: 1.2, duration: 3.5, slow: .6, title: 'A giant sunfish!' }); later(25, () => { const q = P(); if (q.stage === 'mola' && !q.flags.breached) { q.itch = Math.max(q.itch, .62); q.flags.itchSaid = false; } }); }
    });
    Bus.on('anchovy', () => { hint('anchovy'); fact('anchovy'); });
    Bus.on('combJelly', () => { if (first('jellyHint')) { hint('jelly'); fact('combjelly'); } });
    Bus.on('gullDip', () => { hint('gull'); fact('gull'); });
    Bus.on('gullPass', (b) => { const p = P(); if (p.stage === 'egg' || p.stage === 'mola' || p.mode !== 'swim') return; if (Math.abs(b.target.x - p.x) < 60 && p.y < G.world.seaLevel() + 30) { p.startTumble(60, 30); Bus.emit('missed', p); } else Bus.emit('gullMissed'); });
    Bus.on('missed', () => hint('missed'));
    Bus.on('dodged', () => hint('dodged'));
    Bus.on('juvenile', (p) => {
      sound('fanfare'); hint('juvenile'); fact('notail'); fact('school', 14);
      cine({ follow: P, zoom: 6, duration: 3.5, slow: .5, title: 'A young sunfish!' });
      G.world.makeSchool(p); T.visit = G.time + 45; T.gull = G.time + 30;
    });
    Bus.on('ateKrill', (p) => { if (first('krill1')) { hint('friends'); } if (p.stats.krill === 6) fact('krill'); });
    Bus.on('dorado', () => { hint('dorado'); fact('dorado'); });
    Bus.on('tuna', () => { hint('dorado'); fact('tuna'); });
    Bus.on('mola', (p) => {
      const Wd = G.world;
      sound('fanfare'); hint('mola'); fact('mola'); fact('head', 14); fact('fins', 30);
      cine({ follow: P, zoom: 3, duration: 3.5, slow: .5, title: 'A real sunfish!' });
      Wd.setSeason('summer'); G.day += 120; G.tod = .35;
      T.visit = G.time + 70; T.boat = G.time + 50;
    });
    Bus.on('dived', (p) => { if (first('dive1')) { hint('dive'); fact('dive'); } });
    Bus.on('ateJelly', (p, f) => {
      if (first('jelly1')) fact('jellies');
      if (f.kind === 'moon') fact('moonjelly', 3); if (f.kind === 'nettle') fact('nettle', 3); if (f.kind === 'salp') fact('salp', 3); if (f.kind === 'comb') fact('combjelly', 3);
      if (p.stats.jellies === 4) fact('beak');
    });
    Bus.on('cold', () => { hint('cold'); if (first('cold1')) fact('cold'); });
    Bus.on('chilly', () => { hint('chilly'); sound('bump'); });
    Bus.on('upToWarm', () => hint('bask'));
    Bus.on('needBask', () => hint('bask'));
    Bus.on('basking', () => { hint('basking'); fact('bask'); if (nightAmount(G.tod) < .5) T.land = G.time + 2.5; });
    Bus.on('gullLand', () => { hint('gulls'); fact('gullclean'); });
    Bus.on('warmed', () => hint('warm'));
    Bus.on('itchy', (p) => { if (!p.flags.cleaned) { hint('itchy'); fact('lice'); } else if (p.size >= 3) { hint('breach'); } else hint('itchy'); });
    Bus.on('fullItchy', () => { hint('full'); fact('lice'); });
    Bus.on('cleaning', () => { hint('cleaning'); fact('station'); fact('senorita', 6); fact('halfmoon', 16); sound('magic'); });
    Bus.on('cleaned', () => { hint('cleaned'); sound('fanfare'); fact('shade', 4); fact('kelp', 20); });
    Bus.on('jumped', () => { hint('jumped'); fact('breach'); cine({ follow: P, zoom: 1.4, duration: 2.5, slow: .5, title: 'Splash!' }); const p = P(); if (p.flags.ready && !p.flags.journey) T.journey = G.time + 6; });
    Bus.on('sealion', () => { hint('sealion'); fact('sealion'); });
    Bus.on('orca', () => { hint('orca'); fact('orca'); });
    Bus.on('shark', () => { hint('shark'); fact('shark'); });
    Bus.on('turtle', () => { hint('turtle'); fact('turtle'); });
    Bus.on('boat', () => { hint('boat'); fact('finshark'); });
    Bus.on('boatSlow', () => { fact('boat'); P().stats.boats++; });
    Bus.on('netted', () => { hint('net'); fact('net'); cine({ follow: P, zoom: 1.6, duration: 4, slow: .8, title: 'Up you come…' }); });
    Bus.on('freed', () => hint('freed'));
    Bus.on('ready', (p) => { if (p.flags.breached) T.journey = G.time + 4; else { hint('breach'); p.itch = Math.max(p.itch, .62); T.journey = G.time + 120; } });
    Bus.on('arrived', (p) => { fact('spawn', 6); p.milestone('warmsea', () => hint(p.sex === 'boy' ? 'findgirl' : 'findboy')); });
    Bus.on('met', (p) => {
      for (let k = 0; k < 6; k++) G.particles.text(p.x + rnd(-30, 30), p.y - p.len * .6, '♥', '#ff7aa8', 16);
      sound('fanfare'); hint(p.sex === 'boy' ? 'cloud' : 'release');
    });
    Bus.on('cloud', () => { hint('done'); later(4, boyEnding); });
    Bus.on('release', () => hint('release'));
    Bus.on('eggsOut', (p, n) => { if (n === 1) fact('egg'); });
    Bus.on('eggsReleased', () => later(2, () => P().milestone('larvae', generationDone)));
  }

  /* ---------- after a save is loaded: re-arm whatever was about to happen (timers are not saved) ---------- */
  function afterRestore() {
    const p = P(), Wd = G.world;
    if (p.stage === 'egg') makeMum();
    if (p.stage === 'larva') { T.school = G.time + 30; T.gull = G.time + 20; }
    if (p.stage === 'juvenile') { Wd.makeSchool(p); T.visit = G.time + 40; T.gull = G.time + 25; }
    if (p.stage === 'mola' && !p.flags.journey) { T.visit = G.time + 40; T.boat = G.time + 30; if (p.size >= 2) T.net = G.time + 30; }
    if (p.flags.ready && !p.flags.journey) T.journey = G.time + (p.flags.breached ? 5 : 90);
    if (p.flags.journey) {
      Wd.makeMates(p, p.sex === 'boy' ? 'girl' : 'boy');
      if (p.flags.met) { const m = Wd.mates.find(o => o.heart); if (m) { m.met = true; m.with = true; m.x = p.x - p.len; m.y = p.y; } }
    }
    if (p.flags.clouded && !p.flags.genDone) { p.flags.boyEnd = false; later(3, boyEnding); }
    if (p.flags.released && !p.flags.genDone) later(2, generationDone);
  }

  /* the arrow on screen: to the cleaning station when itchy, to the warm sea on the journey */
  function guide(p) {
    if (p.stage !== 'mola') return null;
    if (p.flags.journey && !p.flags.arrived) return { x: WORLD.warmR - 700, y: 50 };
    const full = p.food >= p.steps()[p.size];
    if (!p.flags.journey && (p.itch > .55 && (!p.flags.cleaned || p.size < 3) || (p.size === 2 && full && !p.flags.cleaned))) { const S = G.world.station; return { x: S.x, y: S.floor - 90 }; }
    if (!p.flags.journey && ((p.size === 1 && full && !p.flags.basked) || p.mode === 'chilly' || p.warm < .25) && p.y > 80) return { x: p.x + p.face * 30, y: G.world.seaLevel() - 20 };
    return null;
  }

  /* ---------- the director (every tick) ---------- */
  function update(dt) {
    if (!G) return;
    for (let i = 0; i < timers.length; i++) { const t = timers[i]; if (t.W0 !== G.world) { timers.splice(i--, 1); continue; } if (G.time >= t.at) { timers.splice(i--, 1); t.fn(); } }
    updateMum(dt);
    const p = P(), Wd = G.world, D = G.diff(), vis = G.settings.visitors;
    if (!p || p.stage === 'egg') return;
    const night = nightAmount(G.tod) > .5;
    p.homeHint = guide(p);
    if (p.stage === 'larva' && p.mode === 'swim') {
      if (lastNight !== null && night !== lastNight) { hint(night ? 'night' : 'day'); fact('updown'); }
      lastNight = night;
    }
    if (p.stage === 'juvenile' && p.mode === 'swim') {
      T.far = p.inSchool ? 0 : T.far + dt;
      if (T.far > 5 && Wd.schoolC) { T.far = -20; hint('far'); }
    }
    if (p.stage === 'mola' && p.mode === 'swim' && !once.eatHint && p.context() === 'eat') { once.eatHint = true; hint('eat'); }
    if (T.journey !== null && G.time > T.journey && p.mode === 'swim') startJourney();
    if (p.flags.journey && !p.flags.arrived && p.x < WORLD.warmR - 200) { p.flags.arrived = true; G.tod = .45; hint('arrived'); Bus.emit('arrived', p); }
    /* a gull lands on a basking sunfish (by day) */
    if (p.mode === 'bask' && T.land !== null && G.time > T.land) { T.land = null; if (!night) Wd.landGull(p); }
    /* visitors: never during the big moments */
    const calm = vis && !p.flags.journey && !p.flags.genDone && p.mode === 'swim' && p.tumble <= 0 && p.growing <= 0 && !(typeof Cinematic !== 'undefined' && Cinematic.active);
    if (!calm) return;
    if (p.stage === 'larva') {
      if (D.fish && T.school !== null && G.time > T.school && !Wd.school && p.zinstar >= 2) { Wd.startSchool(p); T.school = G.time + 80 + Math.random() * 50; }
      if (!night && p.y < Wd.seaLevel() + 50 && T.gull !== null && G.time > T.gull) { if (Wd.dip(p)) T.gull = G.time + 60 + Math.random() * 40; }
    }
    if (p.stage === 'juvenile') {
      if (T.visit !== null && G.time > T.visit && !Wd.visitors.length) { Wd.startVisitor(Math.random() < .5 ? 'dorado' : 'tuna', p); T.visit = D.fish ? G.time + 70 + Math.random() * 50 : null; }
      if (!night && p.y < Wd.seaLevel() + 40 && T.gull !== null && G.time > T.gull) { if (Wd.dip(p)) T.gull = G.time + 70 + Math.random() * 40; }
    }
    if (p.stage === 'mola') {
      if (T.visit !== null && G.time > T.visit && !Wd.visitors.length) { Wd.startVisitor(pickVisitor(p), p); T.visit = G.time + (D.fish ? 55 + Math.random() * 45 : 100 + Math.random() * 50); }
      if (T.boat !== null && G.time > T.boat && p.y < 160 && Wd.boat.state === 'away' && Wd.boat.done < 2) { Wd.startBoat(p); T.boat = G.time + 140 + Math.random() * 60; }
      if (D.net && p.size >= 2 && T.net !== null && G.time > T.net && !Wd.net.done && Wd.net.state === 'away' && p.y < 220 && !Wd.visitors.length) { T.net = null; Wd.startNet(p); }
    }
  }

  return { init, bind, reset, update, afterRestore, generationDone, boyEnding, startJourney, makeMum, later, guide, timers: T };
})();
