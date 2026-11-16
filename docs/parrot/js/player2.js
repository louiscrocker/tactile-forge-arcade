/* ============================================================
   player2.js — what the parrot does with Space, and the little games
   ============================================================
   context() says what Space would do right here:
     beg     a parent is at the door with food: beg for it
     flap    at the door of the hollow: flap to make your wings strong
     eat     a fig within reach
     crack   a palm nut: turn it, bite on green (a rhythm)
     lick    clay at the clay lick
     preen   a lone macaw: preen its feathers, gently, in time
     peek    look into a hollow: is anybody home?
     enter   she: go into your own hollow
     lay     she: lay an egg
     take    she, on the eggs: take the food your mate brings
     feed    he: give her the food you carry
   echo is the name game: the notes of a call, copied with the arrows.
   ============================================================ */
'use strict';

Object.assign(Parrot.prototype, {
  nearMate() { const m = this.F.mate; return m && m.mode === 'perch' && Math.hypot(m.x - this.x, m.y - this.y) < 70 ? m : null; },
  ownDoor() { const h = this.F.hollow(this.flags.nest); return h && Math.hypot(h.door[0] - this.x, h.door[1] - this.y) < 40 ? h : null; },
  doorNear() { for (const h of this.F.hollows) if (h.key !== 'home' && !h.seen && Math.hypot(h.door[0] - this.x, h.door[1] - this.y) < 40) return h; return null; },
  context() {
    const F = this.F, fl = this.flags, D = this.D;
    if (this.busy > 0) return null;
    if (this.mode === 'nest') {
      if (F.feed.state === 'offer') return this.stage === 'chick' ? 'beg' : 'take';
      if (this.stage === 'adult' && !fl.laid) return 'lay';
      return null;
    }
    if (this.mode !== 'perch') return null;
    if (this.stage === 'chick') return fl.strong ? null : 'flap';
    if (this.stage === 'adult') {
      if (!fl.paired) { if (this.nearMate()) return 'preen'; }
      else if (!fl.nest) { if (this.doorNear()) return 'peek'; }
      else if (this.ownDoor()) {
        if (!this.male && !fl.laid) return 'enter';
        if (this.male && fl.laid && !fl.hatched && this.crop >= D.crop) return 'feed';
      }
    }
    const f = F.foodNear(this.x, this.y);
    if (f) { if (this.male && fl.laid && !fl.hatched && this.crop >= D.crop) return null; return f.kind === 'fig' ? 'eat' : f.kind === 'nut' ? 'crack' : 'lick'; }
    return null;
  },
  act() {
    const c = this.context(), G = this.G, P = G.particles, F = this.F, fl = this.flags;
    if (!c) return;
    if (c === 'beg' || c === 'take') { this.begN++; this.stats.begs++; P.sparkle(this.x, this.y - this.r, 4, '#ffd24a', 12); Bus.emit('begged', this); if (this.begN >= 2) F.feedNow(false); return; }
    if (c === 'flap') {
      this.flapN++; this.flapping = .4; P.dust(this.x, this.y, '#e8dcc0', 3); Bus.emit('flapped', this);
      if (this.flapN >= this.D.flaps) { fl.strong = true; Bus.emit('strong', this); }
      return;
    }
    if (c === 'eat' || c === 'lick') {
      const f = F.foodNear(this.x, this.y); this.face = sign(f.x - this.x) || 1; this.busy = .7; this.busyKind = c;
      this.busyDone = () => { F.take(f); if (c === 'eat') { this.stats.figs++; this.crop++; } else this.stats.clay++; Bus.emit('ate', this, f.kind); };
      return;
    }
    if (c === 'crack') { const f = F.foodNear(this.x, this.y); this.face = sign(f.x - this.x) || 1; this.mode = 'crack'; this.cr = { f, n: 0, need: 6, t: 0, flash: 0 }; Bus.emit('crackStart', this); return; }
    if (c === 'preen') { const m = this.nearMate(); this.face = sign(m.x - this.x) || 1; m.face = -this.face; this.mode = 'preen'; this.pr = { t: .2, good: 0, flash: 0, beatDone: -1 }; Bus.emit('preenStart', this); return; }
    if (c === 'peek') {
      const h = this.doorNear(); h.seen = true; h.pop = 1; this.stats.peeks++; this.face = sign(h.door[0] - this.x) || 1;
      Bus.emit('peeked', this, h);
      if (h.who === 'free') this.milestone('nest', () => { fl.nest = h.key; Bus.emit('nestFound', this, h); });
      return;
    }
    if (c === 'enter') { const h = this.ownDoor(); this.mode = 'nest'; this.line = null; fl.inNest = true; this.x = h.inside[0]; this.y = h.inside[1]; Bus.emit('entered', this); return; }
    if (c === 'lay') {
      this.eggsN++; P.sparkle(this.x, this.y, 8, '#fff3c0', 14); Bus.emit('laidOne', this, this.eggsN);
      if (this.eggsN >= this.D.eggs) { fl.laid = true; this.stats.eggs = this.D.eggs; Bus.emit('laid', this); }
      return;
    }
    if (c === 'feed') { this.crop = 0; this.stats.trips++; P.sparkle(this.x, this.y - this.r, 8, '#ffd24a', 14); Bus.emit('fedMate', this, this.stats.trips); return; }
  },

  /* ---------- the name game: copy the notes with the arrows ---------- */
  startEcho(seq, kind) {
    if (this.mode === 'echo') return;
    this.backTo = this.mode; this.mode = 'echo'; this.target = null; this.lastDir = 'x';
    this.ec = { seq: seq || [], kind, i: 0, t: 0, got: [], flash: 0, tries: 0 };
    Bus.emit('echoStart', this, kind);
  }
  ,
  echoShowing() { const e = this.ec; return !!e && e.kind !== 'give' && e.t < e.seq.length * .6 + .3; },
  echoWant() { const e = this.ec; return e && e.kind !== 'give' && !this.echoShowing() ? e.seq[e.i] : null; },
  updateEcho(dt) {
    const e = this.ec, inp = this.input; e.t += dt; e.flash = Math.max(0, e.flash - dt * 3);
    const dir = Math.abs(inp.x) > Math.abs(inp.y) ? (inp.x > .5 ? 'right' : inp.x < -.5 ? 'left' : null) : (inp.y > .5 ? 'down' : inp.y < -.5 ? 'up' : null);
    let press = dir && dir !== this.lastDir ? dir : null; this.lastDir = dir;
    if (this.echoShowing()) return;
    if (inp.actionPressed) press = e.kind === 'give' ? NOTES[(Math.random() * 4) | 0] : e.seq[e.i];
    if (!press) return;
    if (e.kind === 'give') { e.got.push(press); e.flash = 1; this.stats.notes++; Bus.emit('note', this, press); if (e.got.length < 3) return; }
    else if (press === e.seq[e.i]) { e.i++; e.flash = 1; this.stats.notes++; Bus.emit('note', this, press); if (e.i < e.seq.length) return; }
    else { e.i = 0; e.t = 0; e.tries++; Bus.emit('wrongNote', this); return; }
    this.ec = null; this.mode = this.backTo || 'perch';
    if (e.kind === 'give') { this.flags.chickName = e.got.map(n => 'urdl'[NOTES.indexOf(n)]).join(''); Bus.emit('chickNamed', this, e.got); }
    else { this.flags.named = true; this.flags.name = e.seq.map(n => 'urdl'[NOTES.indexOf(n)]).join(''); Bus.emit('named', this, e.seq); }
  },

  /* ---------- a palm nut: bite when the ring is green ---------- */
  crackGood() { const w = this.cr; if (!w) return false; const ph = (w.t % .8) / .8; return ph > .55 || ph < .12; },
  updateCrack(dt) {
    const w = this.cr; w.t += dt; w.flash = Math.max(0, w.flash - dt * 3);
    if (this.input.y < -.6 || this.input.y > .8) { this.cr = null; this.mode = 'perch'; return; }
    if (!this.input.actionPressed) return;
    const good = this.crackGood(); w.n += good ? 2 : 1; w.flash = good ? 1 : .4;
    Bus.emit('bit', this, good);
    if (w.n < w.need) return;
    const f = w.f; this.cr = null; this.mode = 'perch'; this.busy = .9; this.busyKind = 'eat';
    Bus.emit('cracked', this);
    this.busyDone = () => { this.F.take(f); this.stats.nuts++; Bus.emit('ate', this, 'nut'); };
  },

  /* ---------- preening: gently, in time ---------- */
  preenGood() { const q = this.pr; if (!q) return false; const ph = q.t % 1; return ph > 1 - this.D.window || ph < .2; },
  updatePreen(dt) {
    const q = this.pr, inp = this.input; q.t += dt; q.flash = Math.max(0, q.flash - dt * 3);
    if (!this.nearMate() || inp.y < -.6) { this.mode = 'perch'; this.pr = null; return; }
    const beat = Math.floor(q.t - .2);
    if (!inp.actionPressed || beat === q.beatDone) return;
    if (this.preenGood()) {
      q.beatDone = beat; q.good++; q.flash = 1; this.stats.preens++; this.F.mate.bob = 1; Bus.emit('preened', this, q.good);
      if (q.good >= this.D.preens) { this.pr = null; this.mode = 'perch'; this.milestone('pair', () => { this.flags.paired = true; Bus.emit('paired', this, this.F.mate); }); }
    } else if (beat !== q.badBeat) { q.badBeat = beat; q.flash = -1; Bus.emit('tooSoon', this); }
  },

  /* ---------- save ---------- */
  serialize() {
    return { form: this.form, stage: this.stage, mode: this.mode === 'egg' ? 'egg' : this.mode === 'nest' || (this.mode === 'echo' && this.backTo === 'nest') ? 'nest' : 'perch', x: +this.x.toFixed(1), y: +this.y.toFixed(1),
      food: this.food, instar: this.instar, crop: this.crop, crack: this.crack, eggT: this.eggT, flapN: this.flapN, eggsN: this.eggsN, stats: this.stats, flags: this.flags };
  },
  restore(o) {
    if (!o || typeof o !== 'object' || !['egg', 'chick', 'young', 'adult'].includes(o.stage) || ![o.x, o.y, o.food, o.instar].every(Number.isFinite)) throw new Error('bad player');
    this.stage = o.stage; this.food = Math.max(0, o.food); this.instar = clamp(o.instar | 0, 0, 3); if (this.stage !== 'chick' && this.stage !== 'egg') this.instar = 3;
    this.crop = clamp(o.crop | 0, 0, 9); this.crack = clamp(+o.crack || 0, 0, 1); this.eggT = +o.eggT || 0; this.flapN = Math.max(0, o.flapN | 0); this.eggsN = Math.max(0, o.eggsN | 0);
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) if (typeof o.flags[k] === 'boolean' || Number.isFinite(o.flags[k]) || typeof o.flags[k] === 'string') this.flags[k] = o.flags[k];
    if (this.flags.name && !/^[urdl]{2,4}$/.test(this.flags.name)) throw new Error('bad name');
    if (this.flags.nest && !this.F.hollow(this.flags.nest)) throw new Error('bad nest');
    this.flags.firstFlight = false;
    if (o.stage === 'egg') { this.mode = 'egg'; this.flags.hatching = false; return; }
    if (o.mode === 'nest' && (this.stage === 'chick' || (this.stage === 'adult' && this.flags.nest))) { this.mode = 'nest'; const B = this.nestBox(); this.x = clamp(o.x, B.x0, B.x1); this.y = B.y; return; }
    if (this.stage === 'chick') { this.stage = this.flags.fledged ? 'young' : 'chick'; }
    const q = this.stage === 'chick' ? { line: this.F.line('doorstep'), s: 6 } : this.F.locate(o.x, o.y);
    this.mode = 'perch'; this.setOn(q.line, q.s); this.flags.inNest = false;
  }
});
