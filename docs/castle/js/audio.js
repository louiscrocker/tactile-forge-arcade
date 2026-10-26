/* ============================================================
   audio.js — the castle, synthesised
   ============================================================
   No sample files.  A soft lute and harp wander through a few
   chords all day (slower and lower at night); birds sing by day,
   crickets and an owl at night; wind in the towers, rain on the
   roofs, the moat's water.  One-shots: a hammer tap for every
   stone, a splash for the moat, a thud when a block comes out, a
   chime for a quest, a fanfare, a horse's neigh, a bell, the
   clink of the smith's anvil and the joust, fireworks.
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
    /* wind in the towers */
    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = bb; this.windSrc.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 400; this.windF.Q.value = .6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = .01;
    this.windSrc.connect(this.windF); this.windF.connect(this.windGain); this.windGain.connect(this.master); this.windSrc.start();
    /* rain on the roofs */
    const rain = ctx.createBufferSource(); rain.buffer = buf; rain.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1800;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(this.master); rain.start();
    /* the moat */
    const water = ctx.createBufferSource(); water.buffer = bb; water.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
    this.waterGain = ctx.createGain(); this.waterGain.gain.value = 0;
    water.connect(wf); wf.connect(this.waterGain); this.waterGain.connect(this.master); water.start();
    /* the music: a lute and a harp, generative */
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = .5; this.musicGain.connect(this.master);
    this.birdClock = 2; this.cricketClock = 1; this.noteClock = 1; this.chord = 0; this.step = 0;
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

  /* o: { night, wind, rain, water (0..1 how much moat is in view), indoors, feast, joust, music (bool) } */
  CHORDS: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [2, 5, 9, 12], [9, 12, 16, 19], [4, 7, 11, 14]],
  update(dt, o) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(.006 + o.wind * .03, t, .5); this.windF.frequency.setTargetAtTime(300 + o.wind * 500, t, .5);
    this.rainGain.gain.setTargetAtTime(o.rain * .05 * (o.indoors ? .4 : 1), t, .5);
    this.waterGain.gain.setTargetAtTime(o.water * .05, t, .5);
    this.birdClock -= dt;
    if (this.birdClock <= 0) { this.birdClock = rnd(2, 6); if (o.night < .4 && !o.rain) this.bird(); }
    this.cricketClock -= dt;
    if (this.cricketClock <= 0) { this.cricketClock = rnd(.6, 1.8); if (o.night > .6) this.cricket(); }
    if (o.music !== false) {
      this.noteClock -= dt;
      if (this.noteClock <= 0) {
        const feast = o.feast || o.joust, tempo = feast ? .22 : o.night > .5 ? .7 : .42;
        this.noteClock = tempo * (feast ? 1 : rnd(.8, 1.6));
        this.step++;
        if (this.step % 8 === 0) this.chord = (this.chord + (Math.random() < .5 ? 1 : 3)) % this.CHORDS.length;
        const ch = this.CHORDS[this.chord], base = o.night > .5 ? 196 : 262;
        const n = ch[(Math.random() * ch.length) | 0] + (Math.random() < .3 ? 12 : 0) - (o.night > .5 ? 12 : 0);
        const f = base * Math.pow(2, n / 12);
        if (feast) { this.pluck(f, t, .5, .07, 'triangle'); if (this.step % 2 === 0) this.pluck(f / 2, t, .6, .05, 'square'); if (this.step % 4 === 0) this.drum(t); }
        else { this.pluck(f, t, o.night > .5 ? 2.5 : 1.6, .05, 'triangle'); if (this.step % 4 === 0) this.pluck(f / 2, t + .02, 2.2, .03, 'sine'); }
      }
    }
  },
  pluck(freq, start, dur, vol = .06, type = 'triangle') {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 6, start); f.frequency.exponentialRampToValueAtTime(freq * 1.5, start + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + .01); g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(f); f.connect(g); g.connect(this.musicGain); o.start(start); o.stop(start + dur + .02);
  },
  drum(t) { this.noiseBurst(t, .12, 180, .8, .1, .5, 'lowpass'); },
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
  bird() { const t = this.ctx.currentTime; for (let i = 0; i < rndInt(2, 4); i++) { const st = t + i * rnd(.12, .22), o = this.ctx.createOscillator(); o.type = 'sine'; const f0 = rnd(1800, 3200); o.frequency.setValueAtTime(f0, st); o.frequency.exponentialRampToValueAtTime(f0 * rnd(1.1, 1.5), st + .06); o.frequency.exponentialRampToValueAtTime(f0 * .9, st + .14); const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(.025, st + .02); g.gain.exponentialRampToValueAtTime(.0001, st + .16); o.connect(g); g.connect(this.master); o.start(st); o.stop(st + .18); } },
  cricket() { const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) { const st = t + i * .07; this.tone(4200, st, .04, .012, 'sine'); } },
  owl() { if (!this.ok()) return; const t = this.ctx.currentTime; for (const [d, dur] of [[0, .25], [.35, .45]]) { const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(380, t + d); o.frequency.exponentialRampToValueAtTime(330, t + d + dur); const g = this.ctx.createGain(); g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.06, t + d + .06); g.gain.exponentialRampToValueAtTime(.0001, t + d + dur); o.connect(g); g.connect(this.master); o.start(t + d); o.stop(t + d + dur + .02); } },
  tap(k = 1) { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .05, 2400 * k, 6, .16, 1.2); this.tone(rnd(600, 900) * k, t, .06, .05, 'square'); },
  thud() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .14, 200, .7, .2, .6, 'lowpass'); },
  splash() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .5, 1800, .5, .18, .9); this.noiseBurst(t + .05, .3, 4000, .8, .06, 1.2); for (let i = 0; i < 4; i++) this.tone(rnd(800, 1600), t + .1 + i * .05, .08, .03, 'sine'); },
  place(kind) { if (!this.ok()) return; if (kind === 'water') this.splash(); else if (kind === 'wood') { const t = this.ctx.currentTime; this.noiseBurst(t, .08, 900, 2, .14, .9); this.tone(220, t, .08, .05, 'triangle'); } else this.tap(kind === 'small' ? 1.3 : 1); },
  pop(pitch = 1) { if (!this.ok()) return; const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(520 * pitch, t); o.frequency.exponentialRampToValueAtTime(1100 * pitch, t + .08); const g = ctx.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .18); },
  bump() { if (!this.ok()) return; const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + .18); const g = ctx.createGain(); g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .25); },
  click() { if (!this.ok()) return; this.tone(900, this.ctx.currentTime, .05, .05, 'square'); },
  sticker() { if (!this.ok()) return; const t = this.ctx.currentTime; [880, 1108, 1318, 1760].forEach((f, i) => this.tone(f, t + i * .07, .35, .07, 'triangle')); },
  shutter() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .06, 3000, .5, .25, 2); this.tone(1200, t + .04, .05, .08, 'square'); },
  chime() { if (!this.ok()) return; const t = this.ctx.currentTime; [1046, 1318, 1568].forEach((f, i) => this.tone(f, t + i * .1, .9, .06, 'sine')); },
  coins() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 5; i++) this.tone(rnd(1800, 2600), t + i * .06, .12, .04, 'triangle'); },
  clink() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseBurst(t, .03, 3400, 10, .18, 1.5); this.tone(rnd(1400, 1900), t, .18, .05, 'triangle'); },
  neigh() { if (!this.ok()) return; const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(900, t + .15); o.frequency.exponentialRampToValueAtTime(380, t + .7); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2; const lfo = ctx.createOscillator(); lfo.frequency.value = 14; const lg = ctx.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.06, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + .75); o.connect(f); f.connect(g); g.connect(this.master); o.start(t); lfo.start(t); o.stop(t + .8); lfo.stop(t + .8); },
  bark() { if (!this.ok()) return; const t = this.ctx.currentTime; for (const d of [0, .18]) { this.noiseBurst(t + d, .08, 600, 1.5, .14, .7); this.tone(300, t + d, .1, .08, 'sawtooth'); } },
  bell() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let k = 0; k < 3; k++) { const st = t + k * 1.1; this.tone(523, st, 2.2, .08, 'sine'); this.tone(523 * 2.76, st, 1.2, .03, 'sine'); this.tone(523 * 1.5, st + .01, 1.6, .02, 'triangle'); } },
  firework() { if (!this.ok()) return; const t = this.ctx.currentTime + rnd(1, 1.3); this.noiseBurst(t, .4, 300, .5, .25, .5, 'lowpass'); this.noiseBurst(t + .02, .5, 3000, .4, .06, 1.5); for (let i = 0; i < 6; i++) this.tone(rnd(1200, 2600), t + .05 + i * .06, .25, .02, 'sine'); },
  thunder() { if (!this.ok()) return; const t = this.ctx.currentTime + rnd(.4, 1.2); this.noiseBurst(t, 1.8, 120, .4, .3, .35, 'lowpass'); this.noiseBurst(t + .3, 1.2, 240, .6, .12, .5, 'lowpass'); },
  roar() { if (!this.ok()) return; const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(160, t + .3); o.frequency.exponentialRampToValueAtTime(90, t + 1.1); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.08, t + .1); g.gain.exponentialRampToValueAtTime(.0001, t + 1.2); o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.25); this.noiseBurst(t, 1, 800, .5, .06, .8); },
  fanfare() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72], [1318, .84]].forEach(([f, d]) => this.tone(f, t + d, .35, .12, 'triangle'));
    [523, 659, 784].forEach(f => this.tone(f, t + 1.1, 1.6, .06, 'sine'));
    this.noiseBurst(t, 2, 6000, .3, .04, 1, 'highpass');
  }
};
