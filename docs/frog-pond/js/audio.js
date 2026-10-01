/* ============================================================
   audio.js — the pond, synthesised
   ============================================================
   No sample files.  Splashes are pitched noise bursts, bubbles
   are rising sine pips, frog calls are amplitude-modulated
   sawtooths (a banjo twang, a bullfrog's jug-o-rum, a peeper's
   peep, a wood frog's quack, a treefrog's trill, a leopard
   frog's snore).  A low-pass filter on the master bus muffles
   everything when the player is underwater.  Every one-shot
   takes an optional world x and is panned left/right relative
   to the camera.
   ============================================================ */
'use strict';

const AudioFX = {
  on: false, ctx: null, ready: false, under: 0,
  listener: { x: 0, hw: 800 },

  start() {
    if (this.ready) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const bb = ctx.createBuffer(1, len, ctx.sampleRate), bd = bb.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brown = bb;

    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 18000; this.muffle.Q.value = .5;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(this.muffle); this.muffle.connect(comp); comp.connect(ctx.destination);
    this.dry = ctx.createGain(); this.dry.gain.value = 0; this.dry.connect(comp);

    const bed = (buffer, type, freq, q, gain) => {
      const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return g;
    };
    this.windGain = bed(buf, 'bandpass', 500, .4, .01);
    this.rainGain = bed(buf, 'highpass', 2200, .7, 0);
    this.underGain = bed(this.brown, 'lowpass', 160, .8, 0);
    this.reedGain = bed(buf, 'bandpass', 1400, 1.2, 0);
    this.streamGain = bed(buf, 'bandpass', 900, .5, 0);

    this.crickGain = ctx.createGain(); this.crickGain.gain.value = 0;
    const cr = ctx.createOscillator(); cr.type = 'sine'; cr.frequency.value = 4200;
    const cr2 = ctx.createOscillator(); cr2.type = 'sine'; cr2.frequency.value = 4350;
    const pulse = ctx.createGain(); pulse.gain.value = .5;
    const plfo = ctx.createOscillator(); plfo.type = 'square'; plfo.frequency.value = 31;
    const plfoG = ctx.createGain(); plfoG.gain.value = .5;
    plfo.connect(plfoG); plfoG.connect(pulse.gain);
    this.crickBurst = ctx.createGain(); this.crickBurst.gain.value = 1;
    cr.connect(pulse); cr2.connect(pulse); pulse.connect(this.crickBurst); this.crickBurst.connect(this.crickGain); this.crickGain.connect(this.master);
    cr.start(); cr2.start(); plfo.start();

    this.birdClock = 3; this.crickClock = 0; this.bubbleClock = 1; this.heartClock = 0; this.rainClock = 0;
    this.ready = true;
    this.resume();
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setEnabled(v) {
    this.on = v;
    if (v) this.start();
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v ? .8 : 0, t, .2);
      this.dry.gain.cancelScheduledValues(t); this.dry.gain.setTargetAtTime(v ? .8 : 0, t, .2);
    }
  },

  /* a destination panned by world x; the master bus when x is unknown */
  dest(x) {
    if (x === undefined || x === null || !this.ctx.createStereoPanner) return this.master;
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp((x - this.listener.x) / Math.max(200, this.listener.hw), -1, 1) * .85;
    p.connect(this.master);
    return p;
  },
  /* distance fade for far-off sounds */
  fade(x) { return x === undefined ? 1 : clamp(1.15 - Math.abs(x - this.listener.x) / (this.listener.hw * 2.2), .08, 1); },

  /* every frame: ambience follows the time of day and where the player is */
  update(dt, o) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    const under = o.underwater || 0;
    this.under = under;
    this.muffle.frequency.setTargetAtTime(lerp(18000, 520, under), t, .12);
    this.crickGain.gain.setTargetAtTime(o.night * .045 * (1 - o.rain) * (1 - under) * (o.ice > .5 ? 0 : 1), t, .8);
    this.windGain.gain.setTargetAtTime((.008 + o.wind * .014) * (1 - under * .8), t, .5);
    this.reedGain.gain.setTargetAtTime(o.gust * .02 * (1 - under), t, .3);
    this.rainGain.gain.setTargetAtTime(o.rain * .07 * (1 - under * .6), t, 1);
    this.underGain.gain.setTargetAtTime(under * .09, t, .3);
    this.streamGain.gain.setTargetAtTime((o.stream || 0) * .06 * (1 - under * .5), t, .5);
    this.crickClock -= dt;
    if (this.crickClock <= 0) {
      this.crickClock = rnd(.4, 1.6);
      this.crickBurst.gain.cancelScheduledValues(t);
      this.crickBurst.gain.setValueAtTime(1, t); this.crickBurst.gain.setValueAtTime(0, t + rnd(.25, .6)); this.crickBurst.gain.setValueAtTime(1, t + rnd(.7, 1.0));
    }
    this.birdClock -= dt;
    if (this.birdClock <= 0) { this.birdClock = rnd(3, 9) + o.night * 30 + o.rain * 20; if (o.night < .5 && o.rain < .5 && under < .5) this.bird(); }
    this.bubbleClock -= dt;
    if (this.bubbleClock <= 0) { this.bubbleClock = rnd(.6, 2.5); if (under > .5) this.bubble(rnd(.6, 1.4), .04); }
    /* a muffled heartbeat when the air runs low */
    const airLow = o.airLow || 0;
    if (airLow > 0) { this.heartClock -= dt; if (this.heartClock <= 0) { this.heartClock = .95 - airLow * .45; this.tone(52, t, .11, .22 * airLow, 'sine'); this.tone(48, t + .17, .1, .16 * airLow, 'sine'); } }
    /* rain drumming on the lily pads */
    if (o.rain > .3 && under < .5) { this.rainClock -= dt; if (this.rainClock <= 0) { this.rainClock = rnd(.05, .25) / o.rain; const d = this.dest(this.listener.x + rnd(-1, 1) * this.listener.hw); this.tone(rnd(1600, 2600), t, .035, .018 * o.rain, 'sine', d); } }
  },

  tone(freq, start, dur, vol = .12, type = 'sine', dest) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + .03);
    g.gain.setValueAtTime(vol, start + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(g); g.connect(dest || this.master); o.start(start); o.stop(start + dur + .02);
    return o;
  },
  noiseBurst(t, dur, type, freq, q, vol, rate = 1, dest) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.master); src.start(t); src.stop(t + dur + .02);
    return f;
  },

  bird() {
    const ctx = this.ctx, t = ctx.currentTime;
    const n = rndInt(2, 5), base = rnd(1800, 3200);
    const d = this.dest(this.listener.x + rnd(-1, 1) * this.listener.hw * 1.5);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const st = t + i * rnd(.09, .16);
      o.frequency.setValueAtTime(base * rnd(.9, 1.1), st); o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.6), st + .06); o.frequency.exponentialRampToValueAtTime(base * rnd(.8, 1), st + .12);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(.04, st + .02); g.gain.exponentialRampToValueAtTime(0.0001, st + .13);
      o.connect(g); g.connect(d); o.start(st); o.stop(st + .15);
    }
  },

  bubble(pitch = 1, vol = .08, x) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(420 * pitch, t); o.frequency.exponentialRampToValueAtTime(900 * pitch, t + .09);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol * this.fade(x), t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .11);
    o.connect(g); g.connect(this.dest(x)); o.start(t); o.stop(t + .12);
  },
  wriggle(x) { if (!this.on || !this.ready) return; this.bubble(rnd(1.1, 1.6), .05, x); },
  hatch(x) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime, d = this.dest(x);
    for (let i = 0; i < 4; i++) setTimeout(() => this.bubble(rnd(.9, 1.8), .06, x), i * 70);
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * .1, .4, .07, 'triangle', d));
  },
  scrape(x) { if (!this.on || !this.ready) return; this.noiseBurst(this.ctx.currentTime, .1, 'bandpass', rnd(700, 1100), 1.5, .12 * this.fade(x), rnd(.7, 1), this.dest(x)); },
  gulpBug(x) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(110, t + .14);
    const g = ctx.createGain(); g.gain.setValueAtTime(.18 * this.fade(x), t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g); g.connect(this.dest(x)); o.start(t); o.stop(t + .17);
  },
  gulp(x) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime, d = this.dest(x); this.tone(220, t, .12, .1, 'sine', d); this.tone(330, t + .08, .16, .08, 'sine', d); this.bubble(.8, .05, x); },
  burst(x) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(t, .16, 'lowpass', 900, .8, .16 * this.fade(x), .8, this.dest(x)); this.bubble(rnd(.7, 1.1), .05, x); },
  snap(x) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, d = this.dest(x);
    this.noiseBurst(t, .05, 'highpass', 3000, 1, .2 * this.fade(x), 2, d);
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(1400, t + .02); o.frequency.exponentialRampToValueAtTime(220, t + .12);
    const g = ctx.createGain(); g.gain.setValueAtTime(.08 * this.fade(x), t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .14);
    o.connect(g); g.connect(d); o.start(t + .02); o.stop(t + .15);
  },
  jump(x) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime, d = this.dest(x); this.tone(260, t, .1, .06, 'triangle', d); this.tone(420, t + .05, .12, .05, 'triangle', d); },
  hop(x) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime, d = this.dest(x); this.noiseBurst(t, .08, 'lowpass', 500, .7, .14 * this.fade(x), .6, d); this.tone(150, t, .09, .1 * this.fade(x), 'sine', d); },
  climb(x) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime, d = this.dest(x); this.noiseBurst(t, .18, 'bandpass', 1800, .8, .08, 1.2, d); this.tone(380, t + .05, .08, .04, 'triangle', d); },
  /* a plop sized to what fell in: small things pip, big things thud */
  splash(power = 1, x, size = 1) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, d = this.dest(x), k = this.fade(x);
    const f = this.noiseBurst(t, .28 + power * .2, 'lowpass', 2400, .6, (.16 + power * .2) * k, .9 / Math.sqrt(size), d);
    f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(500, t + .3);
    const o = ctx.createOscillator(); o.type = 'sine';
    const base = 180 / (0.55 + size * .5);
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * .4, t + .2);
    const g = ctx.createGain(); g.gain.setValueAtTime(.15 * power * k, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
    o.connect(g); g.connect(d); o.start(t); o.stop(t + .25);
    for (let i = 0; i < 3; i++) setTimeout(() => this.bubble(rnd(1, 1.8) / Math.sqrt(size), .04, x), 120 + i * 90);
  },

  /* ---------- frog calls ---------- */
  ribbit(kind = 'twang', vol = 1, x) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const v = .16 * vol * this.fade(x), D = this.dest(x);
    const am = (o, rate, depth, start, dur) => { const g = ctx.createGain(); g.gain.value = 1 - depth; const l = ctx.createOscillator(); l.type = 'sine'; l.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = depth; l.connect(lg); lg.connect(g.gain); o.connect(g); l.start(start); l.stop(start + dur + .05); return g; };
    const voice = (type, f0, f1, dur, start, rate, depth, vv, lp) => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, start); o.frequency.exponentialRampToValueAtTime(f1, start + dur);
      const g = am(o, rate, depth, start, dur);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 2;
      const env = ctx.createGain(); env.gain.setValueAtTime(.0001, start); env.gain.exponentialRampToValueAtTime(vv, start + .03); env.gain.setValueAtTime(vv, start + dur * .7); env.gain.exponentialRampToValueAtTime(.0001, start + dur);
      g.connect(f); f.connect(env); env.connect(D); o.start(start); o.stop(start + dur + .05);
    };
    switch (kind) {
      case 'jug': voice('sawtooth', 95, 70, .55, t, 14, .6, v, 500); voice('sawtooth', 120, 85, .5, t + .5, 14, .6, v * .9, 450); voice('sawtooth', 80, 60, .7, t + .95, 12, .7, v, 400); break;
      case 'peep': { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2600, t); o.frequency.exponentialRampToValueAtTime(3400, t + .1); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v * .7, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .13); o.connect(g); g.connect(D); o.start(t); o.stop(t + .14); break; }
      case 'quack': voice('sawtooth', 420, 300, .14, t, 60, .5, v * .8, 1800); voice('sawtooth', 400, 280, .14, t + .2, 60, .5, v * .8, 1800); voice('sawtooth', 380, 260, .14, t + .38, 60, .5, v * .7, 1800); break;
      case 'trill': voice('square', 1100, 1000, .8, t, 26, .95, v * .35, 2400); break;
      case 'snore': voice('sawtooth', 150, 120, .9, t, 19, .9, v * .8, 700); break;
      case 'toad': voice('square', 1500, 1450, 2.2, t, 30, .9, v * .3, 2600); break;      /* a long high trill */
      default: { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(130, t + .25); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(300, t + .3); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .32); o.connect(f); f.connect(g); g.connect(D); o.start(t); o.stop(t + .34); }
    }
  },

  heronCall(x) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, D = this.dest(x), k = this.fade(x);
    for (let i = 0; i < 2; i++) {
      const st = t + i * .32;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, st); o.frequency.exponentialRampToValueAtTime(140, st + .25);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.12 * k, st + .02); g.gain.exponentialRampToValueAtTime(.0001, st + .28);
      o.connect(f); f.connect(g); g.connect(D); o.start(st); o.stop(st + .3);
      this.noiseBurst(st, .25, 'bandpass', 900, 1, .06 * k, .8, D);
    }
  },
  /* a snake's hiss, a raccoon's chitter, a fish's swirl */
  hiss(x) { if (!this.on || !this.ready) return; this.noiseBurst(this.ctx.currentTime, .6, 'highpass', 4000, .8, .1 * this.fade(x), 1.1, this.dest(x)); },
  chitter(x) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime, D = this.dest(x); for (let i = 0; i < 6; i++) this.tone(rnd(900, 1500), t + i * .07, .05, .05 * this.fade(x), 'square', D); },
  swirl(x) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; const f = this.noiseBurst(t, .5, 'lowpass', 600, .7, .14 * this.fade(x), .7, this.dest(x)); f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1400, t + .4); },
  bump(x) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + .18);
    const g = ctx.createGain(); g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
    o.connect(g); g.connect(this.dest(x)); o.start(t); o.stop(t + .25);
  },
  molt(x) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime, D = this.dest(x); [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * .11, .5, .1, 'triangle', D)); this.sparkleNoise(t, 1.2); },
  sparkleNoise(t, dur) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .1); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(hp); hp.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur);
  },
  fanfare() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72], [1318, .84]].forEach(([f, d]) => this.tone(f, t + d, .35, .12, 'triangle'));
    [523, 659, 784].forEach(f => this.tone(f, t + 1.1, 1.6, .06, 'sine'));
    this.sparkleNoise(t, 2);
  },
  eggs() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; for (let i = 0; i < 8; i++) this.tone(rnd(900, 1500), t + i * .09, .12, .05, 'sine'); [392, 494, 587, 784].forEach((f, i) => this.tone(f, t + .8 + i * .1, 1, .06, 'triangle')); },
  sleep() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; [392, 330, 262].forEach((f, i) => this.tone(f, t + i * .35, .9, .07, 'sine')); },
  wake() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; [262, 330, 392, 523].forEach((f, i) => this.tone(f, t + i * .12, .6, .07, 'triangle')); this.sparkleNoise(t, 1); },
  iceCrack(x) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, D = this.dest(x);
    this.noiseBurst(t, .35, 'bandpass', 1800, 2, .18, 1.5, D);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + .4);
    const g = ctx.createGain(); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
    o.connect(g); g.connect(D); o.start(t); o.stop(t + .5);
  },
  /* a metronome tick for the rhythm chorus, and a duet chord */
  tick(accent) { if (!this.on || !this.ready) return; this.tone(accent ? 1200 : 800, this.ctx.currentTime, .04, accent ? .07 : .04, 'square', this.dry); },
  chord() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; [262, 330, 392, 523].forEach((f, i) => this.tone(f, t + i * .05, 1.4, .06, 'triangle')); },
  sticker() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; [880, 1108, 1318, 1760].forEach((f, i) => this.tone(f, t + i * .07, .35, .07, 'triangle', this.dry)); },
  click() { if (!this.on || !this.ready) return; this.tone(900, this.ctx.currentTime, .05, .05, 'square', this.dry); },
  shutter() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
    src.connect(g); g.connect(this.dry); src.start(t); src.stop(t + .08);
    this.tone(1200, t + .04, .05, .08, 'square', this.dry);
  },
  season(warm) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; (warm ? [392, 494, 587, 784] : [349, 415, 523, 698]).forEach((f, i) => this.tone(f, t + i * .12, 2.2, .05, 'sine')); }
};
