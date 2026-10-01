/* ============================================================
   rhythm.js — sing with the chorus, and sing in duets
   ============================================================
   At night, when a grown frog sings, the chorus starts a beat.
   The wild frogs call on beats 1 and 3; you answer on 2 and 4
   (press E, or the Sing button).  A beat ring at the top of the
   screen shows where you are.  Eight good answers in a row and
   the whole pond joins in, and a frog hops over to your side.

   Two players singing within a second of each other make a duet.
   ============================================================ */
'use strict';

const Rhythm = (function () {
  let Gm = null, on = false, t = 0, beat = 0, lastBeat = -1, streak = 0, best = 0, idle = 0, judged = new Set(), flash = null, finale = 0;
  const BPM = 76, LEN = 60 / BPM;
  let lastSing = { 1: -9, 2: -9 };

  function init(game) {
    Gm = game;
    Bus.on('sing', (p) => {
      lastSing[p.id] = Gm.time;
      if (Gm.players[1] && Math.abs(lastSing[1] - lastSing[2]) < 1.1) { lastSing[1] = lastSing[2] = -9; Bus.emit('duet'); AudioFX.chord && AudioFX.chord(); for (const q of Gm.players) for (let i = 0; i < 4; i++) Gm.particles.note(q.x + rnd(-20, 20), q.y - 30 - i * 6, '#ffb0d0'); }
      if (p.id !== 1) return;
      if (!on) { if (Gm.night > .45 && Gm.pond.weather.ice < .3 && Gm.settings.rhythm !== false) start(); return; }
      judge();
    });
  }
  function start() { on = true; t = 0; beat = 0; lastBeat = -1; streak = 0; idle = 0; judged = new Set(); finale = 0; Bus.emit('rhythmStart'); }
  function stop() { if (!on) return; on = false; Bus.emit('rhythmEnd', best); }

  /* how far is now from the nearest answer beat (2 or 4 of each bar)? */
  function judge() {
    idle = 0;
    const pos = t / LEN, n = Math.round(pos), off = (pos - n) * LEN;
    const isAnswer = ((n % 4) + 4) % 4 === 1 || ((n % 4) + 4) % 4 === 3;
    let grade;
    if (!isAnswer || judged.has(n)) grade = 'oops';
    else if (Math.abs(off) < .14) grade = 'perfect';
    else if (Math.abs(off) < .26) grade = 'good';
    else grade = 'oops';
    if (isAnswer) judged.add(n);
    if (grade === 'oops') streak = 0; else { streak++; best = Math.max(best, streak); }
    flash = { grade, t: 0 };
    Bus.emit('rhythmHit', grade, streak);
    if (streak === 8) { finale = 6; Bus.emit('rhythmWin'); AudioFX.chord && AudioFX.chord(); arrive(); }
  }
  /* a frog hops over to sit beside you */
  function arrive() {
    const p = Gm.players[0], ch = Gm.chorus; if (!ch || !ch.frogs.length) return;
    const f = ch.frogs.reduce((a, b) => (dist(a.x, a.y, p.x, p.y) > dist(b.x, b.y, p.x, p.y) ? b : a));
    f.visitFrom = { x: f.x, y: f.y }; f.visitT = 0; f.visitTo = { x: p.x - p.dir * 34, y: p.y };
  }

  function update(dt) {
    if (!Gm) return;
    for (const f of (Gm.chorus ? Gm.chorus.frogs : [])) if (f.visitFrom) {
      f.visitT += dt; const k = Math.min(1, f.visitT / 2.2);
      f.x = lerp(f.visitFrom.x, f.visitTo.x, k); f.y = lerp(f.visitFrom.y, f.visitTo.y, k) - Math.abs(Math.sin(k * Math.PI * 4)) * 26;
      if (k >= 1) { f.visitFrom = null; f.kind = 'visit'; }
    }
    if (flash) { flash.t += dt; if (flash.t > .7) flash = null; }
    if (!on) return;
    const p = Gm.players[0];
    if (!p || p.stage !== 5 || p.state !== 'frog' || Gm.night < .3) { stop(); return; }
    t += dt; idle += dt;
    const n = Math.floor(t / LEN);
    if (n !== lastBeat) {
      lastBeat = n; const b = ((n % 4) + 4) % 4;
      AudioFX.tick && AudioFX.tick(b === 0);
      if (b === 0 || b === 2 || finale > 0) {
        /* the chorus calls on the beat */
        const fr = Gm.chorus.frogs.filter(f => f.present > .5);
        const who = finale > 0 ? fr : fr.slice(0, 2 + (n % 2));
        for (const f of who) { f.throat = 1; AudioFX.ribbit && AudioFX.ribbit(f.species.call, .7, f.x); Gm.particles.note(f.x, f.y - 24, finale > 0 ? '#ffe27a' : '#fff3b0'); }
      }
      if (b === 1 || b === 3) { const prev = n - 2; if (prev > 0 && (((prev % 4) + 4) % 4 === 1 || ((prev % 4) + 4) % 4 === 3) && !judged.has(prev) && streak > 0) streak = 0; }
      if (finale > 0) finale -= LEN;
    }
    if (idle > LEN * 12) stop();
  }

  /* the beat ring, top centre */
  function draw(ctx, W, H) {
    if (!on && !flash) return;
    const cx = W / 2, cy = 142;
    if (on) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,20,40,.55)'; rr(ctx, cx - 150, cy - 30, 300, 60, 30); ctx.fill();
      const pos = t / LEN, frac = pos - Math.floor(pos), cur = ((Math.floor(pos) % 4) + 4) % 4;
      for (let i = 0; i < 4; i++) {
        const x = cx - 105 + i * 70, answer = i === 1 || i === 3, now = i === cur;
        ctx.beginPath(); ctx.arc(x, cy, answer ? 16 : 11, 0, TAU);
        ctx.fillStyle = answer ? (now ? '#ffe27a' : 'rgba(255,226,122,.35)') : (now ? '#9fe0ff' : 'rgba(159,224,255,.3)'); ctx.fill();
        if (now) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * (1 - frac); ctx.beginPath(); ctx.arc(x, cy, (answer ? 16 : 11) + frac * 14, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = answer ? '#3a2a00' : '#0a2a3a'; ctx.font = `900 ${answer ? 13 : 10}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(answer ? 'YOU' : '♪', x, cy + 1);
      }
      ctx.fillStyle = '#fff'; ctx.font = `900 13px ${UI_FONT}`; ctx.fillText(streak ? `${streak} in a row!` : 'Sing on the yellow beats', cx, cy + 44);
      ctx.restore();
    }
    if (flash) {
      ctx.save(); ctx.globalAlpha = 1 - flash.t / .7;
      ctx.font = `900 28px ${UI_FONT}`; ctx.textAlign = 'center';
      ctx.fillStyle = flash.grade === 'perfect' ? '#ffe27a' : flash.grade === 'good' ? '#bff08a' : '#ffb0a0';
      ctx.fillText({ perfect: 'Perfect!', good: 'Good!', oops: 'Oops!' }[flash.grade], cx, cy - 44 - flash.t * 20);
      ctx.restore();
    }
  }
  return { init, update, draw, active: () => on, start, stop, best: () => best };
})();
