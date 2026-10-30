/* ============================================================
   audio.js — the open Pacific, synthesised
   ============================================================
   No sample files.  Everything is heard from under the water: a
   deep, slow hum and little bubbles, the muffled wash of the
   waves when you are near the surface (and the rumble of a storm),
   gulls crying above when you are shallow, the thrum of a boat's
   engine when it is overhead.  One-shots: a soft blip for each
   bite of plankton, a swish for a dash or a big flap, the slurp
   of a jelly, a splash for a jump and for the eggs going free.
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
    this.outside = ctx.createBiquadFilter(); this.outside.type = 'lowpass'; this.outside.frequency.value = 900;
    this.outside.connect(this.master);
    /* the waves: brown noise through a band that opens with every swell */
    this.surfSrc = ctx.createBufferSource(); this.surfSrc.buffer = bb; this.surfSrc.loop = true;
    this.surfF = ctx.createBiquadFilter(); this.surfF.type = 'lowpass'; this.surfF.frequency.value = 600;
    this.surfGain = ctx.createGain(); this.surfGain.gain.value = 0;
    this.surfSrc.connect(this.surfF); this.surfF.connect(this.surfGain); this.surfGain.connect(this.outside); this.surfSrc.start();
    const hiss = ctx.createBufferSource(); hiss.buffer = buf; hiss.loop = true;
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 2000; hf.Q.value = .4;
    this.hissGain = ctx.createGain(); this.hissGain.gain.value = 0;
    hiss.connect(hf); hf.connect(this.hissGain); this.hissGain.connect(this.outside); hiss.start();
    /* under the sea: a deep, slow hum */
    this.deepSrc = ctx.createBufferSource(); this.deepSrc.buffer = bb; this.deepSrc.loop = true;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 200;
    this.deepGain = ctx.createGain(); this.deepGain.gain.value = 0;
    this.deepSrc.connect(dlp); dlp.connect(this.deepGain); this.deepGain.connect(this.master); this.deepSrc.start();
    /* the boat's engine: a low pulsing thrum */
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    const e1 = ctx.createOscillator(); e1.type = 'sawtooth'; e1.frequency.value = 52;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 180;
    const elfo = ctx.createOscillator(); elfo.type = 'sine'; elfo.frequency.value = 7; const elg = ctx.createGain(); elg.gain.value = .4;
    const epulse = ctx.createGain(); epulse.gain.value = .6; elfo.connect(elg); elg.connect(epulse.gain);
    e1.connect(ef); ef.connect(epulse); epulse.connect(this.engGain); this.engGain.connect(this.master); e1.start(); elfo.start();
    /* the current in the kelp: a soft rushing */
    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = buf; this.windSrc.loop = true;
    const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 500; wbp.Q.value = .5;
    this.windGain = ctx.createGain(); this.windGain.gain.value = .01;
    this.windSrc.connect(wbp); wbp.connect(this.windGain); this.windGain.connect(this.master); this.windSrc.start();
    this.birdClock = 2; this.bubbleClock = 1; this.chewClock = 0;
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

  /* o: { night, surface (0..1 how close to the top), inside (in a den), storm, wind, swash (0..1), boat (0..1), deep (0..1) } */
  update(dt, o) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.outside.frequency.setTargetAtTime(o.inside ? 300 : 400 + o.surface * 3000, t, .25);
    this.surfGain.gain.setTargetAtTime(o.surface * (.05 + o.swash * .1) * (1 + o.storm * 1.5) + .01, t, .3);
    this.surfF.frequency.setTargetAtTime(300 + o.swash * 700 + o.storm * 400, t, .3);
    this.hissGain.gain.setTargetAtTime(o.surface * o.swash * .03 * (1 + o.storm), t, .3);
    this.deepGain.gain.setTargetAtTime(.06 + o.deep * .05 + (o.inside ? .03 : 0), t, .6);
    this.engGain.gain.setTargetAtTime(o.boat * .05 * (o.inside ? .3 : 1), t, .5);
    this.windGain.gain.setTargetAtTime((.008 + o.wind * .014) * (o.inside ? .2 : 1), t, .5);
    this.birdClock -= dt;
    if (this.birdClock <= 0) { this.birdClock = rnd(3, 9); if (o.night < .4 && o.surface > .4 && !o.inside) this.gull(o.surface); }
    this.bubbleClock -= dt;
    if (this.bubbleClock <= 0) { this.bubbleClock = rnd(.6, 2.4); this.bubble(); }
    this.chewClock = Math.max(0, this.chewClock - dt);
  },
  /* a gull crying above the water, muffled from below */
  gull(k = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < rndInt(1, 3); i++) {
      const st = t + i * .32, o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(900, st); o.frequency.exponentialRampToValueAtTime(1400, st + .08); o.frequency.exponentialRampToValueAtTime(700, st + .26);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.025 * k, st + .03); g.gain.exponentialRampToValueAtTime(.0001, st + .28);
      o.connect(f); f.connect(g); g.connect(this.outside); o.start(st); o.stop(st + .3);
    }
  },
  bubble() {
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < rndInt(1, 4); i++) {
      const st = t + i * rnd(.05, .14), o = ctx.createOscillator(); o.type = 'sine';
      const f0 = rnd(300, 700); o.frequency.setValueAtTime(f0, st); o.frequency.exponentialRampToValueAtTime(f0 * 2.2, st + .06);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.04, st + .01); g.gain.exponentialRampToValueAtTime(.0001, st + .08);
      o.connect(g); g.connect(this.master); o.start(st); o.stop(st + .1);
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
  ok() { return this.on && this.ready; },
  blip(k = 1) { if (!this.ok()) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(700 * k, t); o.frequency.exponentialRampToValueAtTime(1400 * k, t + .05); const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.06, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .09); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .1); },
  dash() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .26, 700, .7, .12, 1.1); },
  whoosh() { if (!this.ok()) return; const t = this.ctx.currentTime, src = this.ctx.createBufferSource(); src.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + .5); const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .15); g.gain.exponentialRampToValueAtTime(.0001, t + .7); src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + .72); },
  munch() { if (!this.ok() || this.chewClock > 0) return; this.chewClock = .08; const t = this.ctx.currentTime; this.noiseBurst(t, .06, 1100, 1.4, .12, rnd(.7, 1.1)); if (Math.random() < .5) this.noiseBurst(t + .06, .05, 2200, 2, .07, 1.3); },
  dig() { if (!this.ok() || this.chewClock > 0) return; this.chewClock = .1; const t = this.ctx.currentTime; this.noiseBurst(t, .1, 500, .9, .12, rnd(.6, .9)); },
  clack() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .03, 3000, 8, .2, 1.4); this.tone(rnd(800, 1100), t, .04, .07, 'square'); },
  heave() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .3, 250, .6, .25, .6, 'lowpass'); [196, 262, 330].forEach((f, i) => this.tone(f, t + i * .06, .25, .07, 'triangle')); },
  toss() { if (!this.ok()) return; const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(900, t + .35); const g = this.ctx.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .4); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .42); },
  splash() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .5, 1800, .5, .2, .9); this.noiseBurst(t + .05, .3, 4000, .8, .07, 1.2); for (let i = 0; i < 5; i++) this.tone(rnd(800, 1600), t + .1 + i * .05, .08, .03, 'sine'); },
  creak() { if (!this.ok()) return; const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(90, t + .5); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 6; const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.08, t + .1); g.gain.exponentialRampToValueAtTime(.0001, t + .6); o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + .62); },
  thud() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .12, 200, .7, .2, .6, 'lowpass'); },
  pop(pitch = 1) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(520 * pitch, t); o.frequency.exponentialRampToValueAtTime(1100 * pitch, t + .08);
    const g = ctx.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .18);
  },
  bump() {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + .18);
    const g = ctx.createGain(); g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .25);
  },
  click() { if (!this.ok()) return; this.tone(900, this.ctx.currentTime, .05, .05, 'square'); },
  sticker() { if (!this.ok()) return; const t = this.ctx.currentTime; [880, 1108, 1318, 1760].forEach((f, i) => this.tone(f, t + i * .07, .35, .07, 'triangle')); },
  shutter() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .06, 3000, .5, .25, 2); this.tone(1200, t + .04, .05, .08, 'square'); },
  hatch() { if (!this.ok()) return; const t = this.ctx.currentTime; this.splash(); [523, 659, 784].forEach((f, i) => this.tone(f, t + .2 + i * .09, .3, .06, 'triangle')); },
  molt() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .5, 1200, .8, .08, .8); [392, 523, 659, 784].forEach((f, i) => this.tone(f, t + .3 + i * .11, .5, .08, 'triangle')); },
  magic() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 9; i++) this.tone(rnd(900, 2200), t + i * .09, .4, .03, 'sine'); [262, 330, 392, 523].forEach((f, i) => this.tone(f, t + .2 + i * .15, 1.6, .05, 'sine')); },
  fanfare() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72], [1318, .84]].forEach(([f, d]) => this.tone(f, t + d, .35, .12, 'triangle'));
    [523, 659, 784].forEach(f => this.tone(f, t + 1.1, 1.6, .06, 'sine'));
    this.noiseBurst(t, 2, 6000, .3, .04, 1, 'highpass');
  }
};
