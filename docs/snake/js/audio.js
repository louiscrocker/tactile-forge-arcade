/* ============================================================
   audio.js — the meadow, synthesised
   ============================================================
   No sample files.  Wind through the grass, birdsong by day,
   crickets on summer nights, spring peepers by the pond, rain,
   the soft lap of the pond, and the deep hush of the den.
   One-shots: the tiny tick of a tongue flick, a rustle for a dash,
   a happy gulp for a snack, the crinkle of an old skin peeling off,
   a red-tailed hawk's cry, a comic "pee-yew" for the musk, a frog's
   plop, the pop of a baby breaking out of its bag, fanfares.
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
    this.outside = ctx.createBiquadFilter(); this.outside.type = 'lowpass'; this.outside.frequency.value = 6000;
    this.outside.connect(this.master);
    /* wind in the grass */
    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = buf; this.windSrc.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 900; this.windF.Q.value = .4;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(this.windF); this.windF.connect(this.windGain); this.windGain.connect(this.outside); this.windSrc.start();
    /* rain */
    const rain = ctx.createBufferSource(); rain.buffer = buf; rain.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2500;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(this.outside); rain.start();
    /* the pond's soft lapping and the den's deep hush */
    this.lapSrc = ctx.createBufferSource(); this.lapSrc.buffer = bb; this.lapSrc.loop = true;
    const lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 500;
    this.lapGain = ctx.createGain(); this.lapGain.gain.value = 0;
    this.lapSrc.connect(lf); lf.connect(this.lapGain); this.lapGain.connect(this.outside); this.lapSrc.start();
    this.denSrc = ctx.createBufferSource(); this.denSrc.buffer = bb; this.denSrc.loop = true;
    const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 160;
    this.denGain = ctx.createGain(); this.denGain.gain.value = 0;
    this.denSrc.connect(df); df.connect(this.denGain); this.denGain.connect(this.master); this.denSrc.start();
    this.birdClock = 2; this.cricketClock = 1; this.frogClock = 2; this.chewClock = 0; this.rustleClock = 0;
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

  /* o: { night, season, inside (in the den), rain, wind (0..1), pond (0..1 near the pond), moving } */
  update(dt, o) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime, winter = o.season === 'winter';
    this.outside.frequency.setTargetAtTime(o.inside ? 260 : 6000, t, .3);
    this.windGain.gain.setTargetAtTime((.012 + o.wind * .02 + (winter ? .015 : 0)) * (o.inside ? .15 : 1), t, .5);
    this.windF.frequency.setTargetAtTime(700 + o.wind * 600, t, .5);
    this.rainGain.gain.setTargetAtTime(o.rain * .05 * (o.inside ? .1 : 1), t, .5);
    this.lapGain.gain.setTargetAtTime(o.pond * .05 * (winter ? .2 : 1), t, .5);
    this.denGain.gain.setTargetAtTime(o.inside ? .08 : 0, t, .6);
    if (o.inside) return;
    this.birdClock -= dt;
    if (this.birdClock <= 0) { this.birdClock = rnd(2.5, 7); if (o.night < .3 && !winter && o.rain < .4) this.bird(); }
    this.cricketClock -= dt;
    if (this.cricketClock <= 0) { this.cricketClock = rnd(.35, .9); if (o.night > .5 && (o.season === 'summer' || o.season === 'autumn') && o.rain < .5) this.cricket(o.season === 'autumn' ? .5 : 1); }
    this.frogClock -= dt;
    if (this.frogClock <= 0) { this.frogClock = rnd(.6, 1.6); if (o.night > .4 && o.pond > .2 && (o.season === 'spring' || o.season === 'summer')) this.peeper(o.pond); }
    this.rustleClock -= dt;
    if (o.moving && this.rustleClock <= 0) { this.rustleClock = rnd(.25, .5); this.noiseBurst(t, .12, 3200, .8, .015, rnd(.8, 1.2)); }
    this.chewClock = Math.max(0, this.chewClock - dt);
  },
  /* a little songbird phrase */
  bird() {
    const ctx = this.ctx, t = ctx.currentTime, n = rndInt(2, 5), base = rnd(2200, 3600);
    for (let i = 0; i < n; i++) {
      const st = t + i * rnd(.08, .16), o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base * rnd(.9, 1.2), st); o.frequency.exponentialRampToValueAtTime(base * rnd(1.1, 1.5), st + .06);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.025, st + .01); g.gain.exponentialRampToValueAtTime(.0001, st + .09);
      o.connect(g); g.connect(this.outside); o.start(st); o.stop(st + .1);
    }
  },
  cricket(k = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 3; i++) { const st = t + i * .05, o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 4400; const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.006 * k, st + .005); g.gain.exponentialRampToValueAtTime(.0001, st + .03); o.connect(g); g.connect(this.outside); o.start(st); o.stop(st + .04); }
  },
  peeper(k = 1) {
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(2600, t); o.frequency.exponentialRampToValueAtTime(3100, t + .12);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.02 * k, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .15);
    o.connect(g); g.connect(this.outside); o.start(t); o.stop(t + .16);
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
  /* the tongue: two tiny ticks */
  flick() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .03, 5200, 6, .05, 1.6); this.noiseBurst(t + .09, .03, 5600, 6, .04, 1.6); },
  dash() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .3, 2400, .6, .08, 1.2); },
  whoosh() { if (!this.ok()) return; const t = this.ctx.currentTime, src = this.ctx.createBufferSource(); src.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + .5); const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .15); g.gain.exponentialRampToValueAtTime(.0001, t + .7); src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + .72); },
  munch() { if (!this.ok() || this.chewClock > 0) return; this.chewClock = .1; const t = this.ctx.currentTime; this.tone(320, t, .12, .06, 'sine'); this.tone(240, t + .1, .14, .05, 'sine'); },
  splash() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .45, 1800, .5, .16, .9); for (let i = 0; i < 4; i++) this.tone(rnd(800, 1600), t + .1 + i * .05, .08, .03, 'sine'); },
  plop() { if (!this.ok()) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(220, t + .12); const g = this.ctx.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .18); },
  /* a red-tailed hawk: a hoarse, falling "keee-eeer" */
  hawk() { if (!this.ok()) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(2200, t); o.frequency.exponentialRampToValueAtTime(1400, t + .9); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 2; const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .1); g.gain.exponentialRampToValueAtTime(.0001, t + 1); o.connect(f); f.connect(g); g.connect(this.outside); o.start(t); o.stop(t + 1.02); this.noiseBurst(t, .9, 2600, 1.5, .03, 1); },
  /* the musk: a silly sliding "pee-yew" */
  musk() { if (!this.ok()) return; const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1100, t + .15); o.frequency.exponentialRampToValueAtTime(260, t + .6); const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.1, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + .65); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .67); },
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
  hatch() { if (!this.ok()) return; const t = this.ctx.currentTime; this.pop(1.2); [523, 659, 784].forEach((f, i) => this.tone(f, t + .2 + i * .09, .3, .06, 'triangle')); },
  /* the old skin peeling off: a dry crinkle, then a bright chord */
  molt() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 8; i++) this.noiseBurst(t + i * .06, .04, 4000 + Math.random() * 2000, 3, .04, 1.4); [392, 523, 659, 784].forEach((f, i) => this.tone(f, t + .5 + i * .11, .5, .07, 'triangle')); },
  magic() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 9; i++) this.tone(rnd(900, 2200), t + i * .09, .4, .03, 'sine'); [262, 330, 392, 523].forEach((f, i) => this.tone(f, t + .2 + i * .15, 1.6, .05, 'sine')); },
  fanfare() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72], [1318, .84]].forEach(([f, d]) => this.tone(f, t + d, .35, .12, 'triangle'));
    [523, 659, 784].forEach(f => this.tone(f, t + 1.1, 1.6, .06, 'sine'));
    this.noiseBurst(t, 2, 6000, .3, .04, 1, 'highpass');
  }
};
