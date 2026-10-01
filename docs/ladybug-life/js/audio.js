/* ============================================================
   audio.js — the garden, synthesised
   ============================================================
   No sample files.  Munches are filtered noise bursts, the
   wing-buzz is a tremolo'd sawtooth, birds are sine chirps,
   crickets are pulsed high tones.  Everything is built on the
   fly from the Web Audio API, so the game stays a single folder
   that works offline.
   ============================================================ */
'use strict';

const AudioFX = {
  on: false, ctx: null, ready: false,

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

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);

    /* wing buzz voice, always running, gain 0 until flying */
    this.buzzOsc = ctx.createOscillator(); this.buzzOsc.type = 'sawtooth'; this.buzzOsc.frequency.value = 118;
    this.buzzLP = ctx.createBiquadFilter(); this.buzzLP.type = 'lowpass'; this.buzzLP.frequency.value = 700; this.buzzLP.Q.value = 2;
    this.buzzTrem = ctx.createGain(); this.buzzTrem.gain.value = .5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 27; lfo.type = 'sine';
    const lfoG = ctx.createGain(); lfoG.gain.value = .5;
    lfo.connect(lfoG); lfoG.connect(this.buzzTrem.gain);
    this.buzzGain = ctx.createGain(); this.buzzGain.gain.value = 0;
    this.buzzOsc.connect(this.buzzLP); this.buzzLP.connect(this.buzzTrem); this.buzzTrem.connect(this.buzzGain); this.buzzGain.connect(this.master);
    this.buzzOsc.start(); lfo.start();

    /* crickets: two detuned high tones pulsed at ~30 Hz */
    this.crickGain = ctx.createGain(); this.crickGain.gain.value = 0;
    const cr = ctx.createOscillator(); cr.type = 'sine'; cr.frequency.value = 4200;
    const cr2 = ctx.createOscillator(); cr2.type = 'sine'; cr2.frequency.value = 4350;
    const pulse = ctx.createGain(); pulse.gain.value = .5;
    const plfo = ctx.createOscillator(); plfo.type = 'square'; plfo.frequency.value = 31;
    const plfoG = ctx.createGain(); plfoG.gain.value = .5;
    plfo.connect(plfoG); plfoG.connect(pulse.gain);
    /* a slower chirp envelope so they sing in bursts */
    this.crickBurst = ctx.createGain(); this.crickBurst.gain.value = 1;
    cr.connect(pulse); cr2.connect(pulse); pulse.connect(this.crickBurst); this.crickBurst.connect(this.crickGain); this.crickGain.connect(this.master);
    cr.start(); cr2.start(); plfo.start();

    /* rain bed: high-passed noise, faded with the weather */
    this.rainSrc = ctx.createBufferSource(); this.rainSrc.buffer = buf; this.rainSrc.loop = true;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 2200;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    this.rainSrc.connect(rhp); rhp.connect(this.rainGain); this.rainGain.connect(this.master);
    this.rainSrc.start();

    /* gentle breeze bed */
    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = buf; this.windSrc.loop = true;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'bandpass'; wlp.frequency.value = 500; wlp.Q.value = .4;
    this.windGain = ctx.createGain(); this.windGain.gain.value = .012;
    this.windSrc.connect(wlp); wlp.connect(this.windGain); this.windGain.connect(this.master);
    this.windSrc.start();

    this.birdClock = 2;
    this.crickClock = 0;
    this.ready = true;
    this.resume();
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setEnabled(v) {
    this.on = v;
    if (v) this.start();
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(v ? 0.8 : 0, t, 0.2);
    }
  },

  /* every frame: ambience follows the time of day */
  update(dt, night, flying, windK, rain = 0) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.crickGain.gain.setTargetAtTime(night * .05 * (1 - rain), t, .8);
    this.windGain.gain.setTargetAtTime(.008 + windK * .012, t, .5);
    this.rainGain.gain.setTargetAtTime(rain * .07, t, 1);
    /* cricket bursts */
    this.crickClock -= dt;
    if (this.crickClock <= 0) {
      this.crickClock = rnd(.4, 1.6);
      this.crickBurst.gain.cancelScheduledValues(t);
      this.crickBurst.gain.setValueAtTime(1, t);
      this.crickBurst.gain.setValueAtTime(0, t + rnd(.25, .6));
      this.crickBurst.gain.setValueAtTime(1, t + rnd(.7, 1.0));
    }
    /* birds by day */
    this.birdClock -= dt;
    if (this.birdClock <= 0) {
      this.birdClock = rnd(2, 7) + night * 30 + rain * 20;
      if (night < .5 && rain < .5) this.bird();
    }
    this.buzzGain.gain.setTargetAtTime(flying ? .16 : 0, t, flying ? .08 : .15);
  },

  bird() {
    const ctx = this.ctx, t = ctx.currentTime;
    const n = rndInt(2, 5);
    const base = rnd(1800, 3200);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const st = t + i * rnd(.09, .16);
      o.frequency.setValueAtTime(base * rnd(.9, 1.1), st);
      o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.6), st + .06);
      o.frequency.exponentialRampToValueAtTime(base * rnd(.8, 1), st + .12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(.05, st + .02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + .13);
      o.connect(g); g.connect(this.master);
      o.start(st); o.stop(st + .15);
    }
  },

  /* munch: crunchy filtered noise + a wet low click */
  munch() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = rnd(.8, 1.3);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rnd(900, 1600); bp.Q.value = .9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.35, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + .13);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + .15);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(rnd(260, 340), t); o.frequency.exponentialRampToValueAtTime(90, t + .1);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(.18, t); g2.gain.exponentialRampToValueAtTime(.0001, t + .12);
    o.connect(g2); g2.connect(this.master); o.start(t); o.stop(t + .13);
  },

  /* aphid pop: a quick upward blip */
  pop(pitch = 1) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(520 * pitch, t); o.frequency.exponentialRampToValueAtTime(1100 * pitch, t + .08);
    const g = ctx.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .18);
  },

  tone(freq, start, dur, vol = .12, type = 'sine') {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + .03);
    g.gain.setValueAtTime(vol, start + dur * .6);
    g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(g); g.connect(this.master); o.start(start); o.stop(start + dur + .02);
  },

  /* molt: rising shimmer */
  molt() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * .11, .5, .1, 'triangle'));
    this.sparkleNoise(t, 1.2);
  },

  sparkleNoise(t, dur) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .1); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(hp); hp.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur);
  },

  pupate() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    [392, 494, 587].forEach((f) => this.tone(f, t, 2.2, .07, 'sine'));
    [784, 988].forEach((f, i) => this.tone(f, t + .6 + i * .3, 1.2, .04, 'triangle'));
  },

  /* eclosion fanfare */
  fanfare() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    const seq = [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72], [1318, .84]];
    seq.forEach(([f, d]) => this.tone(f, t + d, .35, .12, 'triangle'));
    [523, 659, 784].forEach(f => this.tone(f, t + 1.1, 1.6, .06, 'sine'));
    this.sparkleNoise(t, 2);
  },

  hatch() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 1.6;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.0001, t + .08);
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start(t); src.stop(t + .1);
    this.tone(rnd(700, 900), t + .02, .1, .06, 'square');
  },

  twitch() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.tone(180, t, .08, .1, 'sawtooth');
    this.tone(240, t + .05, .08, .08, 'sawtooth');
  },

  bump() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + .18);
    const g = ctx.createGain(); g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .25);
  },

  takeoff() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.tone(300, t, .25, .06, 'triangle');
    this.tone(450, t + .08, .25, .06, 'triangle');
  },

  land() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.tone(360, t, .12, .08, 'triangle');
    this.tone(240, t + .07, .15, .08, 'triangle');
  },

  click() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.tone(900, t, .05, .05, 'square');
  },

  /* a sharp warning call from the sky */
  birdCall() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = 'square';
      const st = t + i * .22;
      o.frequency.setValueAtTime(1400, st); o.frequency.exponentialRampToValueAtTime(2600, st + .05); o.frequency.exponentialRampToValueAtTime(1100, st + .16);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.09, st + .01); g.gain.exponentialRampToValueAtTime(.0001, st + .18);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
      o.connect(lp); lp.connect(g); g.connect(this.master); o.start(st); o.stop(st + .2);
    }
  },

  /* sticker unlocked: a bright little chime */
  sticker() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    [880, 1108, 1318, 1760].forEach((f, i) => this.tone(f, t + i * .07, .35, .07, 'triangle'));
  },

  /* camera shutter */
  shutter() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
    src.connect(g); g.connect(this.master); src.start(t); src.stop(t + .08);
    this.tone(1200, t + .04, .05, .08, 'square');
  },

  /* a season turning: a soft chord */
  season(warm) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    const chord = warm ? [392, 494, 587, 784] : [349, 415, 523, 698];
    chord.forEach((f, i) => this.tone(f, t + i * .12, 2.2, .05, 'sine'));
  },

  eggs() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 8; i++) this.tone(rnd(900, 1500), t + i * .09, .12, .05, 'sine');
    [392, 494, 587, 784].forEach((f, i) => this.tone(f, t + .8 + i * .1, 1, .06, 'triangle'));
  }
};
