/* ============================================================
   audio.js — the valley, synthesised
   ============================================================
   No sample files.  Wind is filtered noise that gusts; the river
   hisses when you are near it; aspens rustle in a breeze; by day
   there are chickadees and now and then a raven's croak, by
   summer night crickets; snow hushes everything; thunder rolls.
   One-shots: a lap of milk, the crunch of a meal, digging, a
   pup's yip, a wolf's howl (a sine sweep with a wobble, higher
   for a pup), the pack's chorus answering, a bark, a splash,
   thunder.  Everything outside goes through a filter that closes
   when you are inside a den.
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
    this.brown = bb;

    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.outside = ctx.createBiquadFilter(); this.outside.type = 'lowpass'; this.outside.frequency.value = 18000;
    this.outside.connect(this.master);
    /* the wind: brown noise through a band that opens with each gust */
    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = bb; this.windSrc.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 500; this.windF.Q.value = .5;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(this.windF); this.windF.connect(this.windGain); this.windGain.connect(this.outside); this.windSrc.start();
    /* the river */
    const riv = ctx.createBufferSource(); riv.buffer = buf; riv.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1600; rf.Q.value = .5;
    this.riverGain = ctx.createGain(); this.riverGain.gain.value = 0;
    riv.connect(rf); rf.connect(this.riverGain); this.riverGain.connect(this.outside); riv.start();
    /* leaves rustling */
    const rus = ctx.createBufferSource(); rus.buffer = buf; rus.loop = true;
    const rsf = ctx.createBiquadFilter(); rsf.type = 'highpass'; rsf.frequency.value = 4000;
    this.rustleGain = ctx.createGain(); this.rustleGain.gain.value = 0;
    rus.connect(rsf); rsf.connect(this.rustleGain); this.rustleGain.connect(this.outside); rus.start();
    /* crickets: a pulsing high trill */
    this.insGain = ctx.createGain(); this.insGain.gain.value = 0;
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 4400;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 4520;
    const pulse = ctx.createGain(); pulse.gain.value = .5;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 16;
    const lfoG = ctx.createGain(); lfoG.gain.value = .5; lfo.connect(lfoG); lfoG.connect(pulse.gain);
    this.insBurst = ctx.createGain();
    o1.connect(pulse); o2.connect(pulse); pulse.connect(this.insBurst); this.insBurst.connect(this.insGain); this.insGain.connect(this.outside);
    o1.start(); o2.start(); lfo.start();
    /* rain */
    this.rainSrc = ctx.createBufferSource(); this.rainSrc.buffer = buf; this.rainSrc.loop = true;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 1800;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    this.rainSrc.connect(rhp); rhp.connect(this.rainGain); this.rainGain.connect(this.outside); this.rainSrc.start();
    /* inside a den: a soft low hum of earth */
    const deep = ctx.createBufferSource(); deep.buffer = bb; deep.loop = true;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 180;
    this.deepGain = ctx.createGain(); this.deepGain.gain.value = 0;
    deep.connect(dlp); dlp.connect(this.deepGain); this.deepGain.connect(this.master); deep.start();
    this.birdClock = 2; this.insClock = 0; this.chewClock = 0; this.howlClock = 0;
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

  /* o: { night, inside (in a den), rain, snow, wind, river (0..1 how close), forest (0..1), winter, summer, storm } */
  update(dt, o) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.outside.frequency.setTargetAtTime(o.inside ? 380 : 18000, t, .25);
    this.windGain.gain.setTargetAtTime((.02 + o.wind * .05) * (o.winter ? 1.6 : 1) * (o.inside ? .3 : 1), t, .5);
    this.windF.frequency.setTargetAtTime(300 + o.wind * 700, t, .5);
    this.riverGain.gain.setTargetAtTime(o.river * .06 * (o.winter ? .15 : 1), t, .4);
    this.rustleGain.gain.setTargetAtTime(o.forest * o.wind * .025 * (o.winter ? .3 : 1), t, .4);
    this.insGain.gain.setTargetAtTime(o.night * .025 * (o.summer ? 1 : .2) * (1 - o.rain * .7) * (o.winter ? 0 : 1), t, .8);
    this.rainGain.gain.setTargetAtTime(o.rain * .08 * (o.inside ? .2 : 1), t, 1);
    this.deepGain.gain.setTargetAtTime(o.inside ? .05 : 0, t, .6);
    this.insClock -= dt;
    if (this.insClock <= 0) { this.insClock = rnd(.3, 1.4); this.insBurst.gain.cancelScheduledValues(t); this.insBurst.gain.setValueAtTime(1, t); this.insBurst.gain.setValueAtTime(0, t + rnd(.2, .5)); }
    this.birdClock -= dt;
    if (this.birdClock <= 0) { this.birdClock = rnd(3, 9); if (o.night < .4 && o.rain < .5 && !o.inside) { if (Math.random() < .3) this.croak(); else if (!o.winter || Math.random() < .3) this.chickadee(); } }
    this.chewClock = Math.max(0, this.chewClock - dt);
  },
  chickadee() {
    const ctx = this.ctx, t = ctx.currentTime;
    [[3200, 0], [2600, .18], [2600, .34]].forEach(([f, d]) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t + d); o.frequency.exponentialRampToValueAtTime(f * .95, t + d + .12); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.03, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .14); o.connect(g); g.connect(this.outside); o.start(t + d); o.stop(t + d + .16); });
  },
  /* a raven's croak: a low, rough rasp */
  croak() {
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < rndInt(1, 3); i++) {
      const st = t + i * .35, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(160, st); o.frequency.exponentialRampToValueAtTime(110, st + .22);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 2;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.05, st + .03); g.gain.exponentialRampToValueAtTime(.0001, st + .25);
      o.connect(f); f.connect(g); g.connect(this.outside); o.start(st); o.stop(st + .27);
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
  /* a wolf's howl: a long sine that rises, holds with a wobble, and falls; a pup's is higher and shorter */
  howl(age = 5) {
    if (!this.ok() || this.howlClock > 0) return; this.howlClock = .4;
    const ctx = this.ctx, t = ctx.currentTime, young = age <= 2, base = young ? 900 : age === 3 ? 520 : 380, dur = young ? .6 : 2.2;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(base * .7, t); o.frequency.exponentialRampToValueAtTime(base * 1.25, t + dur * .3); o.frequency.setValueAtTime(base * 1.25, t + dur * .6); o.frequency.exponentialRampToValueAtTime(base * .8, t + dur);
    const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = young ? 9 : 5.5; const vg = ctx.createGain(); vg.gain.value = base * .025; vib.connect(vg); vg.connect(o.frequency);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.setValueAtTime(base * 1.4, t); o2.frequency.exponentialRampToValueAtTime(base * 2.5, t + dur * .3); o2.frequency.setValueAtTime(base * 2.5, t + dur * .6); o2.frequency.exponentialRampToValueAtTime(base * 1.6, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(young ? .08 : .14, t + .15); g.gain.setValueAtTime(young ? .08 : .14, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = .25;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.master); o.start(t); o2.start(t); vib.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05); vib.stop(t + dur + .05);
    setTimeout(() => { this.howlClock = 0; }, 400);
  },
  /* the pack answers: two or three howls, far off and a little muffled */
  chorus() {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [[300, .1], [420, .5], [350, 1.1]].forEach(([base, d]) => {
      const st = t + d, dur = 1.8, o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base * .75, st); o.frequency.exponentialRampToValueAtTime(base * 1.2, st + dur * .35); o.frequency.exponentialRampToValueAtTime(base * .85, st + dur);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.05, st + .2); g.gain.exponentialRampToValueAtTime(.0001, st + dur);
      o.connect(f); f.connect(g); g.connect(this.master); o.start(st); o.stop(st + dur + .05);
    });
  },
  yip() { if (!this.ok()) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1500, t + .06); o.frequency.exponentialRampToValueAtTime(800, t + .14); const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.08, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .16); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .18); },
  bark() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 2; i++) { const st = t + i * .22; this.noiseBurst(st, .12, 600, 1.2, .25, .8); this.tone(220, st, .12, .12, 'sawtooth'); } },
  lap(k = 1) { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .08, 1200 * k, 1.6, .08, 1.1); },
  munch() { if (!this.ok() || this.chewClock > 0) return; this.chewClock = .08; const t = this.ctx.currentTime; this.noiseBurst(t, .06, 1100, 1.4, .12, rnd(.8, 1.2)); },
  dig() { if (!this.ok() || this.chewClock > 0) return; this.chewClock = .1; const t = this.ctx.currentTime; this.noiseBurst(t, .09, 500, .9, .14, rnd(.6, .9)); },
  crunch() { if (!this.ok() || this.chewClock > 0) return; this.chewClock = .2; const t = this.ctx.currentTime; this.noiseBurst(t, .12, 2400, .6, .07, rnd(.9, 1.3), 'highpass'); },
  heave() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .3, 250, .6, .25, .6, 'lowpass'); [196, 262, 330].forEach((f, i) => this.tone(f, t + i * .06, .25, .07, 'triangle')); },
  toss() { if (!this.ok()) return; const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(900, t + .35); const g = this.ctx.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .4); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .42); },
  splash() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .5, 1800, .5, .22, .9); this.noiseBurst(t + .05, .3, 4000, .8, .08, 1.2); },
  thunder() { if (!this.ok()) return; const t = this.ctx.currentTime, src = this.ctx.createBufferSource(); src.buffer = this.brown; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(90, t + 2.5); const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + 2.8); src.connect(f); f.connect(g); g.connect(this.master); src.start(t, Math.random()); src.stop(t + 2.9); },
  thud() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .12, 200, .7, .2, .6, 'lowpass'); },
  whoosh() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .5, 800, 1, .15, 1.2); },
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
  magic() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 9; i++) this.tone(rnd(900, 2200), t + i * .09, .4, .03, 'sine'); [262, 330, 392, 523].forEach((f, i) => this.tone(f, t + .2 + i * .15, 1.6, .05, 'sine')); },
  fanfare() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72], [1318, .84]].forEach(([f, d]) => this.tone(f, t + d, .35, .12, 'triangle'));
    [523, 659, 784].forEach(f => this.tone(f, t + 1.1, 1.6, .06, 'sine'));
    this.noiseBurst(t, 2, 6000, .3, .04, 1, 'highpass');
  }
};
