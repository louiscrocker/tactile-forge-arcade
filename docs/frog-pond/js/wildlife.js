/* ============================================================
   wildlife.js — the heron and the night chorus
   ============================================================
   The heron flies in, wades in the shallows nearest the player,
   coils its neck (the warning) and stabs.  A player who is deep,
   under a lily pad, clinging to a reed, or holding perfectly
   still is safe; anyone else gets a fright and a shove.  Nothing
   worse ever happens.

   The chorus is a handful of wild frogs on the banks and pads
   who sing at night, each in its own species' voice, and answer
   when the player sings.
   ============================================================ */
'use strict';

class Heron {
  constructor(G) {
    this.G = G; this.enabled = true;
    this.state = 'idle'; this.timer = rnd(60, 110);
    this.x = 0; this.y = -300; this.dir = 1; this.flap = 0; this.strikeT = 0; this.neck = 0; this.t = 0;
    this.fromX = 0; this.fromY = 0; this.toX = 0; this.toY = 0; this.stalkT = 0;
    this.warnTarget = null;
  }
  get active() { return this.state !== 'idle'; }
  /* the nearest wadeable spot on one side: the deepest point still under 110 deep */
  standX(side) {
    const pond = this.G.pond;
    let x = side * (pond.W - 20);
    while (Math.abs(x) > pond.W - 400 && pond.bedY(x) < 100) x -= side * 10;
    return x;
  }
  standY(x) { return this.G.pond.bedY(x) - 74; }
  reach(p) { return Math.abs(p.x - this.x) < 210 && p.y < 175; }

  update(dt, players, tod, season) {
    const pond = this.G.pond;
    this.t += dt;
    this.flap += dt * 7;
    switch (this.state) {
      case 'idle': {
        this.timer -= dt;
        const day = tod > .27 && tod < .8;
        if (this.timer > 0 || !this.enabled || !day || season === 'winter' || !players.length) return;
        const p = players[0];
        const side = p.x < 0 ? -1 : 1;
        this.dir = -side;                                   // faces the water
        this.toX = this.standX(side); this.toY = this.standY(this.toX);
        this.fromX = side * (pond.W + 900); this.fromY = -420;
        this.x = this.fromX; this.y = this.fromY; this.t = 0;
        this.state = 'arrive';
        AudioFX.heronCall && AudioFX.heronCall(this.x);
        break;
      }
      case 'arrive': {
        const k = smoothstep(0, 3.6, this.t);
        this.x = lerp(this.fromX, this.toX, k);
        this.y = lerp(this.fromY, this.toY, easeInOut(k)) - Math.sin(k * Math.PI) * 120;
        if (this.t >= 3.6) { this.state = 'stalk'; this.stalkT = 0; this.t = 0; this.G.particles.splash(this.x, pond.surfaceAt(this.x), .7, 8); pond.disturb(this.x, 14, 3); AudioFX.splash && AudioFX.splash(.8, this.x, 3); Bus.emit('heronLanded', this); }
        break;
      }
      case 'stalk': {
        this.stalkT += dt;
        /* wade toward the player, but only where it is shallow */
        const p = players[0];
        const want = clamp(p.x, -pond.W + 30, pond.W - 30);
        const step = sign(want - this.x) * 16 * dt;
        const nx = this.x + step;
        if (pond.bedY(nx) < 105 && Math.abs(want - this.x) > 30) { this.x = nx; this.y = this.standY(nx); if (chance(dt * 1.5)) pond.disturb(this.x, 5, 2); }
        this.dir = sign(p.x - this.x) || this.dir;
        const anyInReach = players.some(q => this.reach(q));
        if (this.stalkT > 3 && anyInReach) { this.state = 'warning'; this.t = 0; Bus.emit('heronWarning', this); AudioFX.heronCall && AudioFX.heronCall(this.x); }
        else if (this.stalkT > 16) { this.state = 'leave'; this.t = 0; }
        break;
      }
      case 'warning':
        this.neck = smoothstep(0, .6, this.t);
        if (this.t >= 2.6) { this.state = 'strike'; this.t = 0; this.checked = false; }
        break;
      case 'strike': {
        this.strikeT = smoothstep(0, .18, this.t) - smoothstep(.3, .55, this.t);
        if (this.t >= .18 && !this.checked) {
          this.checked = true;
          const sx = this.x + this.dir * 70, sy = pond.surfaceAt(this.x + this.dir * 70);
          this.G.particles.splash(sx, sy, 1.2, 18); pond.disturb(sx, 40, 3); this.G.cam.shake = .6;
          AudioFX.splash && AudioFX.splash(1.2, sx, 2.5);
          for (const q of players) {
            if (!this.reach(q)) continue;
            if (q.isSafeFromHeron()) Bus.emit('heronSafe', q);
            else { q.frightened(this.x, this.y, 'heron'); Bus.emit('heronScare', q); }
          }
        }
        if (this.t >= .8) { this.state = 'leave'; this.t = 0; this.neck = 0; }
        break;
      }
      case 'leave': {
        const k = smoothstep(0, 3.2, this.t);
        this.fromX = this.toX; this.fromY = this.toY;
        this.x = lerp(this.toX, this.toX - this.dir * 1100, k);
        this.y = lerp(this.toY, -520, easeOutCubic(k));
        if (this.t >= 3.2) { this.state = 'idle'; this.timer = rnd(70, 150); }
        break;
      }
    }
  }
  pose() { return this.state === 'arrive' || this.state === 'leave' ? 'fly' : this.state === 'warning' ? 'coil' : this.state === 'strike' ? 'strike' : 'stand'; }
}

/* ---------------- the chorus ---------------- */
class Chorus {
  constructor(G) {
    this.G = G; this.frogs = [];
    const pond = G.pond, rng = mulberry32(pond.seed ^ 0x66);
    const keys = Object.keys(SPECIES);
    const spots = [];
    for (const side of [-1, 1]) { for (let i = 0; i < 2; i++) { const x = side * (pond.W + 30 + i * 110 + rng() * 70); spots.push({ x, y: pond.bedY(x), kind: 'bank', dir: -side }); } }
    spots.push({ x: pond.log.x + 40, y: pond.logTop(pond.log.x + 40), kind: 'log', dir: -1 });
    const pads = pond.pads.filter(p => p.r > 55);
    if (pads.length) { const p = pads[(rng() * pads.length) | 0]; spots.push({ x: p.x, y: 0, kind: 'pad', pad: p, dir: rng() < .5 ? -1 : 1 }); }
    const pool = pond.place.chorus || keys;
    for (const s of spots) this.frogs.push(Object.assign({ species: SPECIES[pool[(rng() * pool.length) | 0]], throat: 0, callT: rng() * 8, blink: 0, blinkT: rng() * 5, present: 1, s: .7 + rng() * .25 }, s));
    Bus.on('sing', (p) => this.answer(p));
    this.answered = 0; this.answerT = 0; this.lastCall = -10; this.recent = [];
  }
  activity() {
    const G = this.G, pond = G.pond;
    return G.night * SEASON_INFO[pond.season].chorus * (1 - pond.weather.rain * .5) * (pond.weather.ice > .3 ? 0 : 1);
  }
  answer(p) {
    let n = 0;
    for (const f of this.frogs) { if (f.present < .5) continue; if (dist(f.x, f.y, p.x, p.y) < 1400) { f.callT = Math.min(f.callT, rnd(.5, 2.2)); n++; } }
    if (n) { this.answerT = 4; }
  }
  update(dt) {
    const G = this.G, pond = G.pond;
    const act = this.activity();
    const cold = pond.season === 'winter' || (pond.season === 'autumn' && pond.seasonT > .7);
    for (const f of this.frogs) {
      f.present += ((cold ? 0 : (act > .1 || pond.season !== 'autumn' ? 1 : .5)) - f.present) * (1 - Math.exp(-dt * .5));
      if (f.kind === 'pad') { f.y = f.pad.y - 3; f.present = Math.min(f.present, f.pad.health); }
      f.throat = Math.max(0, f.throat - dt * 2.2);
      f.blinkT -= dt; if (f.blinkT <= 0) { f.blinkT = rnd(3, 8); f.blink = 1; }
      f.blink = Math.max(0, f.blink - dt * 5);
      f.callT -= dt;
      const answering = this.answerT > 0;
      if (f.callT <= 0 && f.present > .5 && (act > .15 || answering)) {
        /* real frogs take turns: wait for the last caller to finish */
        if (G.time - this.lastCall < .55) { f.callT = rnd(.15, .5); continue; }
        this.lastCall = G.time;
        this.recent = this.recent.filter(t => G.time - t < 6); this.recent.push(G.time);
        f.throat = 1;
        f.callT = rnd(3, 9) / Math.max(.25, act) * (answering ? .4 : 1);
        const swell = clamp(.6 + .12 * this.recent.length, .6, 1.25);
        AudioFX.ribbit && AudioFX.ribbit(f.species.call, swell, f.x);
        G.particles.note(f.x + f.dir * 10, f.y - 24, '#fff3b0');
        if (answering) { this.answered++; Bus.emit('chorusAnswer', this.answered); }
      }
    }
    if (this.answerT > 0) this.answerT -= dt;
  }
}
