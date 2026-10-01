/* ============================================================
   audio.js — the kingdom, synthesised
   ============================================================
   No sample files: digging is filtered noise bursts (crunchier
   in clay, softer in sand), the recruitment call is a scratchy
   chirp (real ants squeak by rubbing a ridge on the waist:
   stridulation), honeydew is a little slurp, birds are sine
   chirps, crickets are pulsed high tones, flight is a buzz.
   Above-ground sounds go through a filter that closes when you
   are underground, so the world sounds muffled through the soil.
   ============================================================ */
'use strict';

const AudioFX = {
  on: false, ctx: null, ready: false,

  start() {
    if (this.ready) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    /* brown noise for the deep hum of the earth */
    const bb = ctx.createBuffer(1, len, ctx.sampleRate), bd = bb.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }

    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    /* the outdoors bus, muffled underground */
    this.outside = ctx.createBiquadFilter(); this.outside.type = 'lowpass'; this.outside.frequency.value = 18000;
    this.outside.connect(this.master);

    /* crickets at night */
    this.crickGain = ctx.createGain(); this.crickGain.gain.value = 0;
    const cr = ctx.createOscillator(); cr.type = 'sine'; cr.frequency.value = 4200;
    const cr2 = ctx.createOscillator(); cr2.type = 'sine'; cr2.frequency.value = 4350;
    const pulse = ctx.createGain(); pulse.gain.value = .5;
    const plfo = ctx.createOscillator(); plfo.type = 'square'; plfo.frequency.value = 31;
    const plfoG = ctx.createGain(); plfoG.gain.value = .5;
    plfo.connect(plfoG); plfoG.connect(pulse.gain);
    this.crickBurst = ctx.createGain();
    cr.connect(pulse); cr2.connect(pulse); pulse.connect(this.crickBurst); this.crickBurst.connect(this.crickGain); this.crickGain.connect(this.outside);
    cr.start(); cr2.start(); plfo.start();
    /* rain */
    this.rainSrc = ctx.createBufferSource(); this.rainSrc.buffer = buf; this.rainSrc.loop = true;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 2200;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    this.rainSrc.connect(rhp); rhp.connect(this.rainGain); this.rainGain.connect(this.outside); this.rainSrc.start();
    /* breeze */
    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = buf; this.windSrc.loop = true;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'bandpass'; wlp.frequency.value = 500; wlp.Q.value = .4;
    this.windGain = ctx.createGain(); this.windGain.gain.value = .012;
    this.windSrc.connect(wlp); wlp.connect(this.windGain); this.windGain.connect(this.outside); this.windSrc.start();
    /* the earth: a low, warm rumble when you are down in the nest */
    this.earthSrc = ctx.createBufferSource(); this.earthSrc.buffer = bb; this.earthSrc.loop = true;
    const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 180;
    this.earthGain = ctx.createGain(); this.earthGain.gain.value = 0;
    this.earthSrc.connect(elp); elp.connect(this.earthGain); this.earthGain.connect(this.master); this.earthSrc.start();
    /* wing buzz (the flight) */
    this.buzzOsc = ctx.createOscillator(); this.buzzOsc.type = 'sawtooth'; this.buzzOsc.frequency.value = 190;
    const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 900;
    this.buzzGain = ctx.createGain(); this.buzzGain.gain.value = 0;
    this.buzzOsc.connect(blp); blp.connect(this.buzzGain); this.buzzGain.connect(this.master); this.buzzOsc.start();

    this.birdClock = 2; this.crickClock = 0; this.dripClock = 3; this.digClock = 0;
    this.ready = true;
    this.resume();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setEnabled(v) {
    this.on = v;
    if (v) this.start();
    if (this.master) { const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v ? .8 : 0, t, .2); }
    /* sound off: stop the whole engine a moment later (the drones cost battery on a tablet) */
    clearTimeout(this._off);
    if (this.ctx) { if (v && !this.paused) this.resume(); else if (!v) this._off = setTimeout(() => { if (!this.on && this.ctx.state === 'running') this.ctx.suspend(); }, 400); }
  },
  /* the tab is hidden: everything stops, and comes back as it was */
  pause(p) {
    this.paused = p;
    if (!this.ctx) return;
    if (p) this.ctx.suspend(); else if (this.on) this.ctx.resume();
  },

  /* every frame: the ambience follows where you are and the time of day */
  update(dt, night, underground, depth, rain, wind, buzz, wet) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.outside.frequency.setTargetAtTime(underground ? 260 + Math.max(0, 500 - depth) : 18000, t, .25);
    this.earthGain.gain.setTargetAtTime(underground ? .05 + Math.min(.05, depth / 8000) : 0, t, .6);
    this.crickGain.gain.setTargetAtTime(night * .05 * (1 - rain), t, .8);
    this.windGain.gain.setTargetAtTime(.008 + wind * .012, t, .5);
    this.rainGain.gain.setTargetAtTime(rain * .07, t, 1);
    this.buzzGain.gain.setTargetAtTime(buzz ? .09 : 0, t, .15);
    this.crickClock -= dt;
    if (this.crickClock <= 0) {
      this.crickClock = rnd(.4, 1.6);
      this.crickBurst.gain.cancelScheduledValues(t);
      this.crickBurst.gain.setValueAtTime(1, t); this.crickBurst.gain.setValueAtTime(0, t + rnd(.25, .6)); this.crickBurst.gain.setValueAtTime(1, t + rnd(.7, 1.0));
    }
    this.birdClock -= dt;
    if (this.birdClock <= 0) { this.birdClock = rnd(2, 7) + night * 30 + rain * 20; if (night < .5 && rain < .5) this.bird(); }
    /* drips in wet tunnels */
    if (underground && wet) { this.dripClock -= dt; if (this.dripClock <= 0) { this.dripClock = rnd(.6, 2.2); this.drip(); } }
    this.digClock = Math.max(0, this.digClock - dt);
  },
  bird() {
    const ctx = this.ctx, t = ctx.currentTime, n = rndInt(2, 5), base = rnd(1800, 3200);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const st = t + i * rnd(.09, .16);
      o.frequency.setValueAtTime(base * rnd(.9, 1.1), st); o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.6), st + .06); o.frequency.exponentialRampToValueAtTime(base * rnd(.8, 1), st + .12);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.05, st + .02); g.gain.exponentialRampToValueAtTime(.0001, st + .13);
      o.connect(g); g.connect(this.outside); o.start(st); o.stop(st + .15);
    }
  },
  tone(freq, start, dur, vol = .12, type = 'sine', dest) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + .03); g.gain.setValueAtTime(vol, start + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(g); g.connect(dest || this.master); o.start(start); o.stop(start + dur + .02);
  },
  noiseBurst(t, dur, freq, q, vol, rate = 1, type = 'bandpass') {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t, Math.random()); src.stop(t + dur + .02);
  },
  /* a bite of soil: hard clay crunches, sand hisses */
  dig(hard = 1) {
    if (!this.on || !this.ready || this.digClock > 0) return;
    this.digClock = .09;
    const t = this.ctx.currentTime;
    if (hard < .6) this.noiseBurst(t, .12, 3500, .7, .1, 1.4, 'highpass');
    else this.noiseBurst(t, .07 + hard * .02, 500 + 400 / hard, 1.2, .16 + Math.min(.12, hard * .04), rnd(.7, 1.1));
  },
  drip() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(rnd(900, 1400), t); o.frequency.exponentialRampToValueAtTime(rnd(2200, 2800), t + .05);
    const g = ctx.createGain(); g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .14);
  },
  pop(pitch = 1) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(520 * pitch, t); o.frequency.exponentialRampToValueAtTime(1100 * pitch, t + .08);
    const g = ctx.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .18);
  },
  slurp() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const st = t + i * .09, o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(420 + i * 60, st); o.frequency.exponentialRampToValueAtTime(900 + i * 80, st + .07);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.08, st + .02); g.gain.exponentialRampToValueAtTime(.0001, st + .09);
      o.connect(g); g.connect(this.master); o.start(st); o.stop(st + .1);
    }
  },
  snap() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, .05, 2600, 2, .25, 1.8);
    this.tone(180, t, .08, .08, 'square');
  },
  /* stridulation: a scratchy squeak, repeated */
  chirp() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const st = t + i * .07, o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(2400, st); o.frequency.exponentialRampToValueAtTime(3400, st + .04);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.06, st + .01); g.gain.exponentialRampToValueAtTime(.0001, st + .05);
      o.connect(f); f.connect(g); g.connect(this.master); o.start(st); o.stop(st + .06);
    }
  },
  bump() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + .18);
    const g = ctx.createGain(); g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .25);
  },
  click() { if (!this.on || !this.ready) return; this.tone(900, this.ctx.currentTime, .05, .05, 'square'); },
  sticker() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; [880, 1108, 1318, 1760].forEach((f, i) => this.tone(f, t + i * .07, .35, .07, 'triangle')); },
  shutter() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, .06, 3000, .5, .25, 2);
    this.tone(1200, t + .04, .05, .08, 'square');
  },
  hatch() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(t, .08, 2400, 2, .15, 1.6); this.tone(rnd(700, 900), t + .02, .1, .05, 'square'); },
  eggs() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; for (let i = 0; i < 5; i++) this.tone(rnd(900, 1500), t + i * .1, .12, .05, 'sine'); [392, 494, 587, 784].forEach((f, i) => this.tone(f, t + .6 + i * .1, 1, .06, 'triangle')); },
  molt() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * .11, .5, .1, 'triangle')); },
  fanfare() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72], [1318, .84]].forEach(([f, d]) => this.tone(f, t + d, .35, .12, 'triangle'));
    [523, 659, 784].forEach(f => this.tone(f, t + 1.1, 1.6, .06, 'sine'));
    this.noiseBurst(t, 2, 6000, .3, .04, 1, 'highpass');
  },
  season(warm) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; (warm ? [392, 494, 587, 784] : [349, 415, 523, 698]).forEach((f, i) => this.tone(f, t + i * .12, 2.2, .05, 'sine')); }
};
