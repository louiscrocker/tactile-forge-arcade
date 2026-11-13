/* ============================================================
   player2.js — what the spider does with Space and E
   ============================================================
   context() says what Space would do right here:
     balloon  tiptoe, let out silk, and the wind takes you
     molt     too tight: hang and shed your skin
     fling    throw sticky silk at a stuck bug (the comb feet)
     wrap     turn it round and round into a parcel (a rhythm)
     cut      a leaf: cut it out of the web
     show     hang upside down and show the red hourglass
     answer   a male is plucking: pluck back
     pluck    he: pluck her web gently, in time (a rhythm)
     bundle   he: fold up a bit of her web
     spin     she: the egg sac, round and round
     fix      silk: fix an end here
   E is "drop and curl up": the answer to any visitor.
   ============================================================ */
'use strict';

Object.assign(Spider.prototype, {
  nearPrey() { const b = this.Y.stuck(); return b && Math.hypot(b.x - this.x, b.y - this.y) < 30 + this.r ? b : null; },
  onHers() { return this.line && this.line.hers; },
  canMoltHere() { if (this.mode === 'hang') return true; if (this.mode !== 'walk') return false; const q = this.line.at(this.s); return this.line.kind === 'thread' || q.ny > .3 || this.tightT > 22; },
  nearDen() { const h = this.Y.home; return !!h && Math.hypot(this.x - h.retreat[0], this.y - h.retreat[1]) < 30 + this.r; },
  context() {
    const Y = this.Y, fl = this.flags, v = Y.visitor;
    if (this.mode === 'hang') return this.tight > 0 ? 'molt' : null;
    if (this.mode !== 'walk' || this.busy > 0) return null;
    if (this.atLaunch()) return 'balloon';
    if (v && v.state === 'look' && v.kind !== 'broom' && this.stage === 'adult' && !this.male) return 'show';
    if (this.tight > 0) return this.canMoltHere() ? 'molt' : null;
    const b = this.nearPrey(); if (b) return b.leaf ? 'cut' : 'fling';
    if (this.stage === 'adult' && !this.male) {
      const m = Y.suitor;
      if (m && m.state === 'pluck' && !fl.met && Math.hypot(m.x - this.x, m.y - this.y) < 70) return 'answer';
      if (fl.met && !fl.sac && fl.spinNow && this.nearDen()) return 'spin';
    }
    if (this.stage === 'adult' && this.male) {
      if (this.onHers() && !fl.courted) return 'pluck';
      if (this.onHers() && !fl.bundled) return 'bundle';
      return null;
    }
    if (this.stage === 'ling' && !fl.landed) return null;
    return 'fix';
  },
  act() {
    const c = this.context(), G = this.G, P = G.particles;
    if (!c) { if (this.tight > 0) this.say('moltwhere'); return; }
    if (c === 'balloon') return this.milestone('balloon', () => this.launch());
    if (c === 'molt') { if (!this.flags['molt' + this.instar]) { this.flags['molt' + this.instar] = true; const last = this.instar + 1 >= this.last; this.milestone(this.instar === 0 ? 'molt1' : last ? (this.male ? 'grownboy' : 'grown') : 'molt', () => this.startMolt()); } return; }
    if (c === 'show') { this.mode = 'show'; this.showT = 0; this.stats.shows++; Bus.emit('showed', this); return; }
    if (c === 'fix') return this.fix();
    if (c === 'cut') { const b = this.nearPrey(); this.cutN++; P.dust(b.x, b.y, '#eaf6ff', 4); if (this.cutN >= 2) { this.cutN = 0; b.state = 'free'; b.def = Object.assign({}, b.def, { fly: false }); this.stats.leaves++; Bus.emit('cutLeaf', this); } return; }
    if (c === 'fling') {
      const b = this.nearPrey(); b.flings++; b.struggle = Math.max(b.struggle, 8);
      for (let k = 0; k < 5; k++) P.spawn({ type: 'dot', x: this.x, y: this.y, vx: (b.x - this.x) * 3 + rnd(-30, 30), vy: (b.y - this.y) * 3 + rnd(-30, 30), g: 0, r: 1.2, col: 'rgba(235,246,255,.9)', life: .3 });
      if (typeof AudioFX !== 'undefined' && AudioFX.fling) AudioFX.fling();
      Bus.emit('flung', this, b);
      if (b.flings >= b.def.size + 1) { b.state = 'held'; this.mode = 'wrap'; this.wrap = { b, n: 0, need: 6, t: 0, flash: 0 }; Bus.emit('wrapStart', this, b); }
      return;
    }
    if (c === 'answer') { this.ansN++; this.Y.pulse(this.line.kind === 'thread' ? this.line : this.Y.suitor.T, this.line.kind === 'thread' ? this.s : 0, 'her'); if (typeof AudioFX !== 'undefined' && AudioFX.pluck) AudioFX.pluck(.8); if (this.ansN >= 3) { this.flags.met = true; this.Y.suitor.state = 'bundle'; this.Y.suitor.t = 0; Bus.emit('met', this, this.Y.suitor); } return; }
    if (c === 'pluck') { this.mode = 'pluck'; this.pl = { t: .2, good: 0, bad: 0, flash: 0 }; Bus.emit('pluckStart', this); return; }
    if (c === 'bundle') {
      this.bunN++; P.sparkle(this.x, this.y, 6, '#eaf6ff', 16); if (typeof AudioFX !== 'undefined' && AudioFX.fling) AudioFX.fling();
      if (this.bunN >= 4) { this.flags.bundled = true; const g = this.N.threads.find(q => q.hers && q.gum && q !== this.line); if (g) this.N.removeThreads(t => t === g); Bus.emit('bundled', this); }
      return;
    }
    if (c === 'spin') { this.mode = 'spin'; this.sp = { n: 0, need: this.D.spin, want: 0, t: 0 }; Bus.emit('spinStart', this); return; }
  },

  /* ---------- growing ---------- */
  growTight(dt) {
    if (this.stage === 'sac' || this.mode === 'molt' || this.instar >= this.last) return;
    if (this.food >= this.need) {
      this.tight += dt; this.tightT += dt;
      if (!this.flags['tight' + this.instar]) { this.flags['tight' + this.instar] = true; Bus.emit('tight', this); }
    }
  },
  startMolt() {
    this.backTo = this.mode; this.mode = 'molt'; this.molting = MOLT_T; this.target = null;
    Bus.emit('molting', this);
  },
  finishMolt() {
    const Y = this.Y;
    Y.exuviae.push({ x: this.x, y: this.y + this.r * 1.6, r: this.r, ang: 0 }); if (Y.exuviae.length > 8) Y.exuviae.shift();
    this.food -= this.need; this.instar++; this.stats.molts++; this.tight = 0; this.tightT = 0;
    this.stage = this.instar >= this.last ? 'adult' : 'young';
    this.mode = this.backTo === 'hang' && this.rope ? 'hang' : 'walk';
    if (this.mode === 'walk' && this.line) this.setOn(this.line, this.s);
    Bus.emit('molted', this, this.instar);
    if (this.stage === 'adult') Bus.emit('grownUp', this);
  },

  /* ---------- drop and curl up; show the hourglass ---------- */
  curl(auto) {
    if (this.mode !== 'walk' && this.mode !== 'hang') return;
    this.stats.hides++; this.target = null; this.silk = null;
    const done = () => { this.mode = 'curl'; this.curlT = 0; Bus.emit('curled', this, auto); };
    if (this.mode === 'walk' && this.line === this.N.ground) done(); else this.startFall(done);
  },
  isSafe() { return this.mode === 'curl' || this.mode === 'show' || this.mode === 'molt' || (this.mode === 'walk' && this.nearDen()); },
  safeHow() { return this.mode === 'curl' ? 'curl' : this.mode === 'show' ? 'show' : 'den'; },

  /* ---------- wrapping a parcel: tap in time with the turning ring ---------- */
  wrapGood() { const w = this.wrap; if (!w) return false; const ph = (w.t % .7) / .7; return ph > .55 || ph < .12; },
  updateWrap(dt) {
    const w = this.wrap, b = w.b; w.t += dt; w.flash = Math.max(0, w.flash - dt * 3);
    if (!this.Y.prey.includes(b) || b.state !== 'held') { this.mode = 'walk'; this.wrap = null; return; }
    if (!this.input.actionPressed) return;
    const good = this.wrapGood(); w.n += good ? 2 : 1; b.wraps = w.n / w.need; w.flash = good ? 1 : .4;
    if (typeof AudioFX !== 'undefined' && AudioFX.fling) AudioFX.fling(good ? 1.3 : 1);
    Bus.emit('wrapped', this, good);
    if (w.n < w.need) return;
    b.wraps = 1; b.state = 'parcel'; this.wrap = null; this.mode = 'walk'; this.busy = 1.3; this.busyKind = 'eat';
    Bus.emit('parcel', this, b);
    this.busyDone = () => { b.gone = true; this.food += b.def.food; this.stats.meals++; this.stats.got += b.def.food; this.G.particles.sparkle(b.x, b.y, 10, '#fff3c0', 18); Bus.emit('ate', this, b); };
  },

  /* ---------- he plucks her web: gently, in time ---------- */
  pluckGood() { const q = this.pl; if (!q) return false; const ph = q.t % 1; return ph > 1 - this.D.window || ph < .2; },
  updatePluck(dt) {
    const q = this.pl, inp = this.input, Y = this.Y; q.t += dt; q.flash = Math.max(0, q.flash - dt * 3);
    if (!this.onHers()) { this.mode = 'walk'; this.pl = null; return; }
    if (inp.eggPressed || inp.y > .6) { this.mode = 'walk'; this.pl = null; return; }
    if (!inp.actionPressed || Math.floor(q.t - .2) === q.beatDone) return;
    q.beatDone = Math.floor(q.t - .2);
    if (this.pluckGood()) {
      q.good++; q.flash = 1; this.stats.plucks++; Y.pulse(this.line, this.s, 'male'); if (typeof AudioFX !== 'undefined' && AudioFX.pluck) AudioFX.pluck(1.2);
      Bus.emit('plucked', this);
      if (q.good >= this.D.plucks) {
        q.good = 0; q.bad = 0; this.flags.pluckStep = (this.flags.pluckStep || 0) + 1;
        if (Y.her && Y.her.bridge) Y.pulse(Y.her.bridge, Y.her.bridge.len * .1, 'her');
        Bus.emit('herAnswer', this, this.flags.pluckStep);
        if (this.flags.pluckStep >= 3) { this.flags.courted = true; this.mode = 'walk'; this.pl = null; Bus.emit('courted', this); }
      }
    } else {
      q.bad++; q.flash = -1; if (typeof AudioFX !== 'undefined' && AudioFX.bump) AudioFX.bump();
      Bus.emit('tooHard', this);
      if (q.bad >= 2) {
        if (Y.her) Y.her.lunge = 1;
        const f = this.line.at(this.s);
        this.pl = null; this.rope = { ax: f.x, ay: f.y, L: 9, th: 0, om: .6, line: this.line, s: this.s, auto: true, noThread: true }; this.mode = 'hang';
        Bus.emit('lunged', this);
      }
    }
  },

  /* ---------- she spins the egg sac: round and round ---------- */
  spinWant() { return this.sp ? ['right', 'down', 'left', 'up'][this.sp.want] : null; },
  updateSpin(dt) {
    const q = this.sp, inp = this.input; q.t += dt;
    const dir = Math.abs(inp.x) > Math.abs(inp.y) ? (inp.x > .5 ? 'right' : inp.x < -.5 ? 'left' : null) : (inp.y > .5 ? 'down' : inp.y < -.5 ? 'up' : null);
    const pressed = (dir && dir !== this.lastSpin && dir === this.spinWant()) || inp.actionPressed;
    this.lastSpin = dir;
    if (!pressed) return;
    q.n++; q.want = (q.want + 1) % 4;
    if (typeof AudioFX !== 'undefined' && AudioFX.fling) AudioFX.fling(.8 + q.n * .04);
    Bus.emit('spun', this, q.n);
    if (q.n < q.need) return;
    this.sp = null; this.mode = 'walk'; this.flags.sac = true; this.stats.eggs = this.D.eggs;
    const h = this.Y.home; this.Y.sac = { x: h.retreat[0] + (h.retreat[0] < h.x ? 12 : -12), y: h.retreat[1] + 16, t: 0 };
    Bus.emit('sacDone', this);
  },

  /* ---------- save ---------- */
  serialize() {
    const f = this.mode === 'hang' ? { x: this.rope.ax, y: this.rope.ay } : this.foot || { x: this.x, y: this.y };
    return { form: this.form, stage: this.stage, mode: this.mode === 'balloon' ? 'balloon' : this.mode === 'sac' ? 'sac' : this.mode === 'curl' ? 'curl' : 'walk', fx: +f.x.toFixed(1), fy: +f.y.toFixed(1), x: +this.x.toFixed(1), y: +this.y.toFixed(1),
      sl: this.bal ? this.bal.sl : 0, food: this.food, instar: this.instar, crack: this.crack, sacT: this.sacT, stats: this.stats, flags: this.flags };
  },
  restore(o) {
    if (!o || typeof o !== 'object' || !['sac', 'ling', 'young', 'adult'].includes(o.stage) || ![o.fx, o.fy, o.x, o.y, o.food, o.instar].every(Number.isFinite)) throw new Error('bad player');
    this.stage = o.stage; this.food = Math.max(0, o.food); this.instar = clamp(o.instar | 0, 0, this.last);
    if (this.stage === 'adult') this.instar = this.last;
    this.crack = clamp(+o.crack || 0, 0, 1); this.sacT = +o.sacT || 0;
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) if (typeof o.flags[k] === 'boolean' || Number.isFinite(o.flags[k]) || typeof o.flags[k] === 'string') this.flags[k] = o.flags[k];
    for (const k of Object.keys(this.flags)) if (/^m_|^molt\d/.test(k) && k === 'molt' + this.instar) delete this.flags[k];
    if (o.stage === 'sac') { this.mode = 'sac'; this.flags.hatching = false; return; }
    if (o.mode === 'balloon') { this.mode = 'balloon'; this.x = o.x; this.y = Math.min(o.y, -30); this.bal = { sl: clamp(+o.sl || .5, 0, 1), t: 2 }; this.vx = -60; this.vy = 0; return; }
    const q = this.N.locate(o.fx, o.fy) || { line: this.N.ground, s: 100 };
    this.mode = 'walk'; this.setOn(q.line, q.s);
    if (o.mode === 'curl' && q.line === this.N.ground) { this.mode = 'curl'; this.curlT = 2; }
  }
});
