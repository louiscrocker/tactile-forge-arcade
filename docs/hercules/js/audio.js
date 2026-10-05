/* ============================================================
   audio.js — the rainforest at night, synthesised
   ============================================================
   No sample files.  Chewing wood is a short crunchy noise burst
   (softer in fungus wood, gritty in soil); the beetle's flight is
   a deep, rough buzz (a big beetle's wings beat slowly enough to
   hear the hum); horns knock with a hollow click; tree frogs and
   insects fill the night; rain hisses.  Everything above ground
   goes through a filter that closes when you are inside the log,
   so the forest sounds muffled through the wood.
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
    const bb = ctx.createBuffer(1, len, ctx.sampleRate), bd = bb.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }

    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.outside = ctx.createBiquadFilter(); this.outside.type = 'lowpass'; this.outside.frequency.value = 18000;
    this.outside.connect(this.master);

    /* the night chorus: insects, a pulsing high trill */
    this.insGain = ctx.createGain(); this.insGain.gain.value = 0;
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 5200;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 5340;
    const pulse = ctx.createGain(); pulse.gain.value = .5;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 24;
    const lfoG = ctx.createGain(); lfoG.gain.value = .5; lfo.connect(lfoG); lfoG.connect(pulse.gain);
    this.insBurst = ctx.createGain();
    o1.connect(pulse); o2.connect(pulse); pulse.connect(this.insBurst); this.insBurst.connect(this.insGain); this.insGain.connect(this.outside);
    o1.start(); o2.start(); lfo.start();
    /* rain */
    this.rainSrc = ctx.createBufferSource(); this.rainSrc.buffer = buf; this.rainSrc.loop = true;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 1800;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    this.rainSrc.connect(rhp); rhp.connect(this.rainGain); this.rainGain.connect(this.outside); this.rainSrc.start();
    /* leaves in the breeze */
    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = buf; this.windSrc.loop = true;
    const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 700; wbp.Q.value = .5;
    this.windGain = ctx.createGain(); this.windGain.gain.value = .01;
    this.windSrc.connect(wbp); wbp.connect(this.windGain); this.windGain.connect(this.outside); this.windSrc.start();
    /* inside the wood: a low, close rumble */
    this.woodSrc = ctx.createBufferSource(); this.woodSrc.buffer = bb; this.woodSrc.loop = true;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 160;
    this.woodGain = ctx.createGain(); this.woodGain.gain.value = 0;
    this.woodSrc.connect(wlp); wlp.connect(this.woodGain); this.woodGain.connect(this.master); this.woodSrc.start();
    /* the beetle's buzz: a slow, rough drone (a big beetle beats its wings ~50 times a second) */
    this.buzzOsc = ctx.createOscillator(); this.buzzOsc.type = 'sawtooth'; this.buzzOsc.frequency.value = 62;
    const buzz2 = ctx.createOscillator(); buzz2.type = 'square'; buzz2.frequency.value = 124;
    const bwob = ctx.createOscillator(); bwob.frequency.value = 7; const bwobG = ctx.createGain(); bwobG.gain.value = 4; bwob.connect(bwobG); bwobG.connect(this.buzzOsc.frequency);
    const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 700;
    this.buzzGain = ctx.createGain(); this.buzzGain.gain.value = 0;
    const b2g = ctx.createGain(); b2g.gain.value = .35;
    this.buzzOsc.connect(blp); buzz2.connect(b2g); b2g.connect(blp); blp.connect(this.buzzGain); this.buzzGain.connect(this.master);
    this.buzzOsc.start(); buzz2.start(); bwob.start();

    this.birdClock = 2; this.insClock = 0; this.frogClock = 1; this.chewClock = 0;
    this.ready = true;
    this.resume();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setEnabled(v) {
    this.on = v;
    if (v) this.start();
    if (this.master) { const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v ? .8 : 0, t, .2); }
    clearTimeout(this._off);
    if (this.ctx) { if (v && !this.paused) this.resume(); else if (!v) this._off = setTimeout(() => { if (!this.on && this.ctx.state === 'running') this.ctx.suspend(); }, 400); }
  },
  pause(p) { this.paused = p; if (!this.ctx) return; if (p) this.ctx.suspend(); else if (this.on) this.ctx.resume(); },

  update(dt, night, inside, rain, wind, buzz, buzzPitch) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.outside.frequency.setTargetAtTime(inside ? 380 : 18000, t, .25);
    this.woodGain.gain.setTargetAtTime(inside ? .06 : 0, t, .6);
    this.insGain.gain.setTargetAtTime(night * .035 * (1 - rain * .7), t, .8);
    this.windGain.gain.setTargetAtTime(.008 + wind * .014, t, .5);
    this.rainGain.gain.setTargetAtTime(rain * .08, t, 1);
    this.buzzGain.gain.setTargetAtTime(buzz ? .13 : 0, t, .12);
    if (buzz) this.buzzOsc.frequency.setTargetAtTime(55 + (buzzPitch || 0) * 20, t, .1);
    this.insClock -= dt;
    if (this.insClock <= 0) { this.insClock = rnd(.3, 1.4); this.insBurst.gain.cancelScheduledValues(t); this.insBurst.gain.setValueAtTime(1, t); this.insBurst.gain.setValueAtTime(0, t + rnd(.2, .5)); }
    this.frogClock -= dt;
    if (this.frogClock <= 0) { this.frogClock = rnd(.4, 2.2); if (night > .4) this.frog(); }
    this.birdClock -= dt;
    if (this.birdClock <= 0) { this.birdClock = rnd(3, 9); if (night < .4 && rain < .5) this.bird(); }
    this.chewClock = Math.max(0, this.chewClock - dt);
  },
  /* a tree frog: "co-qui" or a wooden clack */
  frog() {
    const ctx = this.ctx, t = ctx.currentTime;
    if (Math.random() < .55) {
      for (const [f0, f1, d] of [[1150, 1250, 0], [1800, 2300, .13]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t + d); o.frequency.exponentialRampToValueAtTime(f1, t + d + .1); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.05, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .12); o.connect(g); g.connect(this.outside); o.start(t + d); o.stop(t + d + .14); }
    } else {
      for (let i = 0; i < rndInt(2, 4); i++) { const st = t + i * .11, o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = rnd(380, 520); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.06, st + .01); g.gain.exponentialRampToValueAtTime(.0001, st + .07); o.connect(g); g.connect(this.outside); o.start(st); o.stop(st + .08); }
    }
  },
  bird() {
    const ctx = this.ctx, t = ctx.currentTime, n = rndInt(3, 6), base = rnd(900, 2000);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine'; const st = t + i * rnd(.12, .2);
      o.frequency.setValueAtTime(base * rnd(.9, 1.1), st); o.frequency.exponentialRampToValueAtTime(base * rnd(1.3, 1.8), st + .08);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.04, st + .02); g.gain.exponentialRampToValueAtTime(.0001, st + .14);
      o.connect(g); g.connect(this.outside); o.start(st); o.stop(st + .16);
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
  /* a bite of wood: soft in fungus wood (k < 1), gritty in soil (k > 1) */
  chew(k = 1) {
    if (!this.on || !this.ready || this.chewClock > 0) return;
    this.chewClock = .1;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, .05 + k * .02, 900 + k * 500, 1.4, .12 + k * .03, rnd(.8, 1.2));
    if (Math.random() < .5) this.noiseBurst(t + .05, .04, 2200, 2, .06, 1.5);
  },
  press(k) { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(t, .18, 300, .8, .2, .7, 'lowpass'); this.tone(110 + k * 60, t, .2, .1, 'sine'); },
  thud() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(t, .12, 200, .7, .2, .6, 'lowpass'); },
  slurp() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 3; i++) { const st = t + i * .08, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(380 + i * 50, st); o.frequency.exponentialRampToValueAtTime(820 + i * 70, st + .06); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.08, st + .02); g.gain.exponentialRampToValueAtTime(.0001, st + .08); o.connect(g); g.connect(this.master); o.start(st); o.stop(st + .09); }
  },
  /* horns knocking together */
  push() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(t, .04, 1800, 6, .2, 1.2); this.tone(rnd(420, 520), t, .06, .08, 'triangle'); },
  heave() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(t, .3, 250, .6, .25, .6, 'lowpass'); [196, 262, 330].forEach((f, i) => this.tone(f, t + i * .06, .25, .07, 'triangle')); },
  toss() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(900, t + .35); const g = this.ctx.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .4); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .42); },
  /* the huff of an annoyed Hercules beetle */
  huff() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this.noiseBurst(t + i * .16, .12, 600, .7, .14, .5); },
  pop(pitch = 1) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(520 * pitch, t); o.frequency.exponentialRampToValueAtTime(1100 * pitch, t + .08);
    const g = ctx.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .18);
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
  shutter() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(t, .06, 3000, .5, .25, 2); this.tone(1200, t + .04, .05, .08, 'square'); },
  hatch() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(t, .08, 2400, 2, .15, 1.6); [523, 659, 784].forEach((f, i) => this.tone(f, t + .1 + i * .09, .3, .06, 'triangle')); },
  molt() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(t, .5, 1200, .8, .08, .8); [392, 523, 659, 784].forEach((f, i) => this.tone(f, t + .3 + i * .11, .5, .08, 'triangle')); },
  magic() { if (!this.on || !this.ready) return; const t = this.ctx.currentTime; for (let i = 0; i < 9; i++) this.tone(rnd(900, 2200), t + i * .09, .4, .03, 'sine'); [262, 330, 392, 523].forEach((f, i) => this.tone(f, t + .2 + i * .15, 1.6, .05, 'sine')); },
  fanfare() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72], [1318, .84]].forEach(([f, d]) => this.tone(f, t + d, .35, .12, 'triangle'));
    [523, 659, 784].forEach(f => this.tone(f, t + 1.1, 1.6, .06, 'sine'));
    this.noiseBurst(t, 2, 6000, .3, .04, 1, 'highpass');
  }
};
