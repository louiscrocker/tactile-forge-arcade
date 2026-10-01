/* ============================================================
   race.js — racing Ember through the rainbow rings
   ============================================================
   Walk under the rainbow arch in the meadow and a race begins:
   3… 2… 1… GO!  Twelve rings loop up over the meadow and back.
   You must fly through them in order (the next one sparkles).
   Ember races too.  He is quick, but on "Little kid" and "Big
   kid" he always keeps it close and lets a good flier win.  In
   two-player mode both alicorns race each other as well.
   ============================================================ */
'use strict';

const Race = (function () {
  let G = null;
  const R = { state: 'idle', t: 0, count: 0, rival: 0, rivalX: 0, rivalY: 0, finishers: [], best: 0, wins: 0, races: 0, cooldown: 0, result: null, resultT: 0 };
  const simple = () => G.settings.reading === 'simple';

  function init(game) { G = game; }
  const unlocked = () => Quests.isDone('race') || (Quests.current() && Quests.current().key === 'race' && Quests.status() === 'active');
  function canStart() { return !!G && R.state === 'idle' && R.cooldown <= 0 && unlocked(); }
  function active() { return R.state !== 'idle' && R.state !== 'done'; }
  function racing() { return R.state === 'racing'; }
  function locked() { return R.state === 'countdown'; }

  function start() {
    const W = G.world;
    W.spawnRings('race');
    R.state = 'countdown'; R.t = 3.2; R.count = 3; R.rival = 0; R.finishers = []; R.result = null; R.races++;
    const a = W.raceArch;
    G.players.forEach((p, i) => { p.x = a.x - 40 - i * 70; p.placeAt(p.x); p.dir = 1; p.vx = 0; });
    const e = G.friends.get('ember');
    R.wasFollowing = e.state === 'following';
    e.state = 'racing'; e.hidden = false; R.rivalX = a.x - 140; R.rivalY = a.y - 60; e.x = R.rivalX; e.y = R.rivalY; e.dir = 1;
    AudioFX.raceBeep && AudioFX.raceBeep(false);
    Bus.emit('raceStart');
    if (typeof UI !== 'undefined') UI.hint(simple() ? 'Get ready! Fly through the rings in order!' : 'Get ready! Fly through every ring, in order. The next ring sparkles.');
  }

  /* the course as points, for Ember to follow */
  function coursePoint(u) {
    const pts = [[G.world.raceArch.x, G.world.raceArch.y - 60], ...RACE_COURSE];
    u = clamp(u, 0, pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(u)), f = u - i;
    return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
  }
  function playerProgress(p) {
    const done = G.world.rings.filter(r => r.set === 'race' && r.passed).length;
    return done;
  }

  function update(dt) {
    if (!G) return;
    R.cooldown = Math.max(0, R.cooldown - dt);
    if (R.resultT > 0) R.resultT -= dt;
    const W = G.world, e = G.friends.get('ember');
    if (R.state === 'idle') {
      /* walking under the arch starts a race */
      if (canStart()) for (const p of G.players) if (p.state === 'ground' && Math.abs(p.x - W.raceArch.x) < 50 && Math.abs(p.y - W.raceArch.y) < 30) { start(); break; }
      return;
    }
    if (R.state === 'countdown') {
      R.t -= dt;
      const c = Math.ceil(R.t - .2);
      if (c !== R.count && c >= 0) { R.count = c; if (c > 0) AudioFX.raceBeep && AudioFX.raceBeep(false); else { AudioFX.raceBeep && AudioFX.raceBeep(true); Voice.say('Go!', { interrupt: true, force: true }); } }
      else if (c > 0 && R.count === c && !R.said) { }
      if (R.t <= .2) { R.state = 'racing'; R.t = 0; }
      return;
    }
    if (R.state === 'racing') {
      R.t += dt;
      /* Ember: steady, but rubber-banded so it's always a close race */
      const lead = G.players.reduce((m, p) => Math.max(m, playerProgress(p)), 0);
      const diff = G.settings.difficulty;
      let speed = diff === 'hard' ? 1.05 : diff === 'easy' ? .55 : .78;              /* rings per second-ish */
      const gap = R.rival - lead;
      if (gap > 1.2) speed *= diff === 'hard' ? .8 : .35;                             /* way ahead: wait for you */
      if (gap < -1.5) speed *= 1.6;                                                    /* behind: catch up */
      if (diff !== 'hard' && R.rival > RACE_COURSE.length - .8 && lead < RACE_COURSE.length) speed *= .15;   /* dawdles at the line */
      R.rival = Math.min(RACE_COURSE.length, R.rival + speed * dt);
      const [tx, ty] = coursePoint(R.rival);
      const k = 1 - Math.exp(-dt * 5);
      e.dir = tx >= e.x ? 1 : -1;
      e.x += (tx - e.x) * k; e.y += (ty - e.y) * k;
      if (R.rival >= RACE_COURSE.length && !R.finishers.includes('ember')) R.finishers.push('ember');
      for (const p of G.players) if (playerProgress(p) >= RACE_COURSE.length && !R.finishers.includes(p.id)) R.finishers.push(p.id);
      /* in two-player mode each player owns their own ring progress: keep it simple, rings are shared, the finisher is whoever passes the last ring */
      if (R.finishers.some(f => f !== 'ember')) finish();
      return;
    }
  }

  function finish() {
    const W = G.world, e = G.friends.get('ember');
    const winner = R.finishers[0];
    const won = winner !== 'ember';
    R.state = 'done'; R.result = { won, winner, time: R.t }; R.resultT = 6; R.cooldown = 4;
    if (won) { R.wins++; if (!R.best || R.t < R.best) R.best = R.t; }
    W.clearRings('race');
    const p = G.players.find(q => q.id === winner) || G.player;
    G.particles.confetti(p.x, p.y - 60, 90); G.particles.starBurst(p.x, p.y - 40, 24, '#ffe14a', 280);
    for (let i = 0; i < 4; i++) setTimeout(() => { G.particles.firework(p.x + rnd(-400, 400), p.y - rnd(200, 500)); AudioFX.firework(); }, 300 + i * 400);
    AudioFX.quest();
    const secs = Math.round(R.t);
    const msg = won
      ? (G.players.length > 1 ? `${p.look.name} wins! ${secs} seconds!` : (simple() ? `You won! ${secs} seconds!` : `You won the race in ${secs} seconds!`))
      : (simple() ? 'So close! Ember won this time. Try again!' : 'So close! Ember just beat you. Walk under the arch to race again!');
    if (typeof UI !== 'undefined') UI.hint(msg);
    Voice.say(msg, { interrupt: true, force: true });
    Bus.emit('raceDone', p, won, R.t);
    setTimeout(() => {
      e.state = R.wasFollowing || Quests.isDone('ember') ? 'following' : 'cave';
      if (e.state === 'following') e.leader = G.player;
      R.state = 'idle';
    }, 2500);
  }

  function target() {
    const W = G.world;
    const r = W.rings.filter(r => r.set === 'race' && !r.passed).sort((a, b) => a.i - b.i)[0];
    return r ? { x: r.x, y: r.y, label: simple() ? 'next ring' : 'the next ring' } : { x: W.raceArch.x, y: W.raceArch.y - 60, label: 'the arch' };
  }

  function drawHUD(ctx, W, H) {
    if (!G) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (R.state === 'countdown') {
      const n = R.count > 0 ? String(R.count) : 'GO!';
      const f = R.t % 1;
      const s = Math.min(W, H) * (.18 + .06 * f);
      ctx.font = `900 ${Math.round(s)}px ${UI_FONT}`;
      ctx.lineWidth = s * .12; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(60,20,90,.55)';
      ctx.strokeText(n, W / 2, H * .42);
      const g = ctx.createLinearGradient(0, H * .32, 0, H * .52); g.addColorStop(0, '#fff29a'); g.addColorStop(1, '#ff9ad4');
      ctx.fillStyle = g; ctx.fillText(n, W / 2, H * .42);
    }
    if (R.state === 'racing' || (R.state === 'done' && R.resultT > 0)) {
      const t = R.state === 'racing' ? R.t : R.result.time;
      const passed = G.world.rings.filter(r => r.set === 'race' && r.passed).length;
      const txt = R.state === 'racing' ? `⏱ ${t.toFixed(1)}s   💍 ${passed} / ${RACE_COURSE.length}` : (R.result.won ? `🏆 ${t.toFixed(1)}s!` : '🐉 Ember won — try again!');
      ctx.font = `900 26px ${UI_FONT}`;
      const w = ctx.measureText(txt).width + 44;
      ctx.fillStyle = 'rgba(255,253,255,.92)'; rr(ctx, W / 2 - w / 2, 118, w, 48, 24); ctx.fill();
      ctx.fillStyle = '#3a2a55'; ctx.fillText(txt, W / 2, 143);
      if (R.state === 'done' && R.result.won) { ctx.font = `900 ${Math.round(H * .08)}px ${UI_FONT}`; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(60,20,90,.5)'; ctx.strokeText('WINNER!', W / 2, H * .36); ctx.fillStyle = '#ffd24a'; ctx.fillText('WINNER!', W / 2, H * .36); }
    }
    ctx.restore();
  }

  function serialize() { return { best: R.best, wins: R.wins, races: R.races }; }
  function restore(o) { if (o) { R.best = o.best || 0; R.wins = o.wins || 0; R.races = o.races || 0; } }
  return { init, update, start, canStart, active, racing, locked, target, drawHUD, serialize, restore, state: R };
})();
