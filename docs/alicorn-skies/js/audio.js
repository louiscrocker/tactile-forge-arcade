/* ============================================================
   audio.js — the whole soundtrack, synthesised
   ============================================================
   No sample files.  A music box plays a gentle, never-repeating
   pentatonic tune over four soft chords (slower and dreamier at
   night, higher up in the Star Sky).  Hoofbeats are filtered
   noise thumps, wings are whooshes, magic is a chime cluster,
   friends have little voices.  Everything is built on the fly
   from the Web Audio API so the game stays one offline folder.
   ============================================================ */
'use strict';

const AudioFX = {
  on: false, ctx: null, ready: false, musicOn: true,

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

    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.fx = ctx.createGain(); this.fx.gain.value = 1; this.fx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    /* a little reverb-ish echo for the music box */
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = .32;
    const fb = ctx.createGain(); fb.gain.value = .28;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    this.delay.connect(dlp); dlp.connect(fb); fb.connect(this.delay);
    const wet = ctx.createGain(); wet.gain.value = .35;
    dlp.connect(wet); wet.connect(this.music);

    /* beds */
    const bed = (type, freq, q, gain) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(this.fx); src.start();
      return g;
    };
    this.windGain = bed('bandpass', 420, .5, .01);
    this.rainGain = bed('highpass', 2400, 0, 0);
    this.waterGain = bed('lowpass', 500, 0, 0);
    this.rushGain = bed('bandpass', 900, .8, 0);          // air rushing past when flying fast

    /* crickets */
    this.crickGain = ctx.createGain(); this.crickGain.gain.value = 0;
    const cr = ctx.createOscillator(); cr.type = 'sine'; cr.frequency.value = 4300;
    const pulse = ctx.createGain(); pulse.gain.value = .5;
    const plfo = ctx.createOscillator(); plfo.type = 'square'; plfo.frequency.value = 29;
    const plfoG = ctx.createGain(); plfoG.gain.value = .5;
    plfo.connect(plfoG); plfoG.connect(pulse.gain);
    this.crickBurst = ctx.createGain(); this.crickBurst.gain.value = 1;
    cr.connect(pulse); pulse.connect(this.crickBurst); this.crickBurst.connect(this.crickGain); this.crickGain.connect(this.fx);
    cr.start(); plfo.start();

    this.birdClock = 3; this.crickClock = 0; this.callClock = 8;
    this.beat = 0; this.nextBeat = 0; this.bar = 0; this.melodyNote = 7; this.env = { night: 0, high: 0 };
    this.ready = true;
    this.resume();
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setEnabled(v) {
    this.on = v;
    if (v) this.start();
    if (this.master) { const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v ? .8 : 0, t, .2); }
  },
  setMusic(v) { this.musicOn = v; if (this.music) this.music.gain.setTargetAtTime(v ? (this.ducked ? .16 : .55) : 0, this.ctx.currentTime, .5); },
  /* quieter music while a voice is speaking */
  duck(on) { this.ducked = on; if (this.music && this.musicOn) this.music.gain.setTargetAtTime(on ? .16 : .55, this.ctx.currentTime, .15); },

  /* every frame: ambience follows time of day, altitude, weather, speed */
  update(dt, env) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    this.env = env;
    const { night, high, rain, speed, water, woods, flying } = env;
    this.crickGain.gain.setTargetAtTime(night * .045 * (1 - rain) * (1 - high), t, .8);
    this.windGain.gain.setTargetAtTime(.006 + high * .03 + (env.gust || 0) * .02, t, .5);
    this.rainGain.gain.setTargetAtTime(rain * .06 * (1 - high), t, 1);
    this.waterGain.gain.setTargetAtTime(water * .05, t, .8);
    this.rushGain.gain.setTargetAtTime(flying ? clamp((speed - 200) / 500, 0, 1) * .08 : 0, t, .2);
    this.crickClock -= dt;
    if (this.crickClock <= 0) { this.crickClock = rnd(.4, 1.6); this.crickBurst.gain.cancelScheduledValues(t); this.crickBurst.gain.setValueAtTime(1, t); this.crickBurst.gain.setValueAtTime(0, t + rnd(.25, .6)); this.crickBurst.gain.setValueAtTime(1, t + rnd(.7, 1.0)); }
    this.birdClock -= dt;
    if (this.birdClock <= 0) { this.birdClock = rnd(3, 8) + night * 30 + rain * 20 + high * 20; if (night < .5 && rain < .5 && high < .5) this.bird(); }
    this.callClock -= dt;
    if (this.callClock <= 0) { this.callClock = rnd(6, 14); if (night > .5 && woods) this.hoot(.4); else if (night > .5 && water > .5) this.ribbit(.35); }
    if (this.musicOn && typeof Music !== 'undefined') Music.update(env);
  },

  /* ---------- the music box ---------- */
  scheduleMusic() {
    const ctx = this.ctx, now = ctx.currentTime;
    if (this.nextBeat === 0) this.nextBeat = now + .1;
    const night = this.env.night, high = this.env.high;
    const bpm = lerp(84, 64, night), beatLen = 60 / bpm / 2;      // eighths
    while (this.nextBeat < now + .25) {
      const t = this.nextBeat;
      const eighth = this.beat % 8, bar = Math.floor(this.beat / 8) % 4;
      const restBar = Math.floor(this.beat / 8) % 8 === 7;
      const chords = night ? [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]] : [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];   // C Am F G / Am F C G
      const chord = chords[bar];
      if (eighth === 0) {
        /* pad */
        for (const n of chord) this.pad(n - 12, t, beatLen * 8, .022);
        this.pluck(chord[0] - 24, t, .35, .07, 'sine');
      }
      if (eighth === 4) this.pluck(chord[2] - 24, t, .3, .05, 'sine');
      if (!restBar) {
        const density = lerp(.62, .45, night);
        if (Math.random() < density || eighth === 0) {
          const scale = [0, 2, 4, 7, 9];
          let deg = this.melodyNote + pick([-2, -1, -1, 0, 1, 1, 2, 3]);
          deg = clamp(deg, 4, 13);
          this.melodyNote = deg;
          const oct = Math.floor(deg / 5), st = scale[deg % 5];
          const midi = 72 + oct * 12 + st + (high > .5 ? 12 : 0);
          this.box(midi, t, .06 + Math.random() * .03);
        }
      }
      this.beat++; this.nextBeat += beatLen;
    }
  },
  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  box(n, t, vol) {
    const ctx = this.ctx, f = this.midi(n);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + 1.3);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(.0001, t); g2.gain.exponentialRampToValueAtTime(vol * .25, t + .005); g2.gain.exponentialRampToValueAtTime(.0001, t + .35);
    o.connect(g); o2.connect(g2); g.connect(this.music); g2.connect(this.music); g.connect(this.delay);
    o.start(t); o.stop(t + 1.4); o2.start(t); o2.stop(t + .4);
  },
  pad(n, t, dur, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = this.midi(n);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .4); g.gain.linearRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + .05);
  },
  pluck(n, t, dur, vol, type) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type || 'triangle'; o.frequency.value = this.midi(n);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + .05);
  },

  /* ---------- helpers ---------- */
  tone(freq, start, dur, vol = .12, type = 'sine', dest) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + .02);
    g.gain.setValueAtTime(vol, start + dur * .6);
    g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(g); g.connect(dest || this.fx); o.start(start); o.stop(start + dur + .02);
    return o;
  },
  slide(f0, f1, start, dur, vol, type = 'sine') {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, start); o.frequency.exponentialRampToValueAtTime(f1, start + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + .015); g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(g); g.connect(this.fx); o.start(start); o.stop(start + dur + .02);
  },
  noiseHit(start, dur, vol, type, freq, q, rate = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + .01); g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(this.fx); src.start(start); src.stop(start + dur + .02);
  },
  ok() { return this.on && this.ready; },

  /* ---------- one-shots ---------- */
  step(water, gallop, cloud) {
    if (!this.ok()) return; const t = this.ctx.currentTime;
    if (water) { this.noiseHit(t, .12, .12, 'bandpass', 1800, 1, 1.4); this.slide(500, 250, t, .08, .05); return; }
    if (cloud) { this.noiseHit(t, .16, .05, 'lowpass', 500, 0, .6); return; }
    this.noiseHit(t, .07, .18 + gallop * .12, 'lowpass', 320, 0, .7);
    this.slide(120, 60, t, .07, .12 + gallop * .08);
  },
  flap() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseHit(t, .22, .09, 'bandpass', 700, .7, .9); },
  jump() { if (!this.ok()) return; const t = this.ctx.currentTime; this.slide(300, 520, t, .16, .07, 'triangle'); },
  land(cloud) { if (!this.ok()) return; const t = this.ctx.currentTime; if (cloud) { this.noiseHit(t, .3, .07, 'lowpass', 400, 0, .5); this.tone(520, t, .2, .04, 'sine'); } else { this.noiseHit(t, .09, .16, 'lowpass', 300, 0, .6); this.slide(140, 60, t, .1, .12); } },
  splash() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseHit(t, .35, .18, 'bandpass', 1600, .8, 1.2); this.slide(600, 200, t, .15, .06); },
  magic() {
    if (!this.ok()) return; const t = this.ctx.currentTime;
    [1046, 1318, 1568, 2093, 2637].forEach((f, i) => this.tone(f, t + i * .05, .5, .06, 'triangle'));
    this.noiseHit(t, .6, .05, 'highpass', 6000, 0, 1);
  },
  bloom() { if (!this.ok()) return; const t = this.ctx.currentTime; this.slide(400, 900, t, .12, .07, 'triangle'); this.tone(1318, t + .1, .3, .05, 'sine'); },
  crystal() { if (!this.ok()) return; const t = this.ctx.currentTime; [1760, 2217, 2637, 3520].forEach((f, i) => this.tone(f, t + i * .08, 1.2, .05, 'sine')); },
  starUp() { if (!this.ok()) return; const t = this.ctx.currentTime; this.slide(500, 1600, t, .5, .07, 'triangle'); [1318, 1760, 2093].forEach((f, i) => this.tone(f, t + .3 + i * .1, .4, .05, 'triangle')); },
  cheer() { if (!this.ok()) return; const t = this.ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * .07, .3, .08, 'triangle')); this.noiseHit(t + .2, .5, .06, 'highpass', 5000, 0, 1); },
  star(combo = 1) {
    if (!this.ok()) return; const t = this.ctx.currentTime;
    const base = [1046, 1174, 1318, 1568, 1760, 2093, 2349, 2637][Math.min(7, combo - 1)];
    this.tone(base, t, .18, .09, 'triangle'); this.tone(base * 1.5, t + .06, .25, .06, 'sine');
  },
  gem(idx = 0) { if (!this.ok()) return; const t = this.ctx.currentTime; const f = 523 * Math.pow(2, idx / 7); [f, f * 1.25, f * 1.5, f * 2].forEach((x, i) => this.tone(x, t + i * .09, .6, .08, 'triangle')); this.noiseHit(t, .8, .05, 'highpass', 6000, 0, 1); },
  ring(i = 0) { if (!this.ok()) return; const t = this.ctx.currentTime; const f = 660 * Math.pow(2, (i % 8) / 12); this.slide(f, f * 2, t, .25, .08, 'triangle'); this.tone(f * 2, t + .2, .3, .05, 'sine'); },
  constStar(n) { if (!this.ok()) return; const t = this.ctx.currentTime; const f = [523, 587, 659, 784, 880][Math.min(4, n - 1)]; this.tone(f * 2, t, .8, .07, 'sine'); this.tone(f * 3, t + .1, .8, .04, 'sine'); this.noiseHit(t, .6, .04, 'highpass', 7000, 0, 1); if (n >= 5) [523, 659, 784, 1046, 1318].forEach((x, i) => this.tone(x * 2, t + .5 + i * .1, .8, .06, 'triangle')); },
  dash() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseHit(t, .7, .14, 'bandpass', 1200, .6, 1.5); this.slide(300, 1200, t, .5, .06, 'sawtooth'); },
  talk(kind) {
    if (!this.ok()) return; const t = this.ctx.currentTime;
    const base = { bunny: 900, fox: 620, owl: 380, deer: 760, frog: 300, swan: 520, sheep: 440, lamb: 700, dragon: 330 }[kind] || 600;
    for (let i = 0; i < 3; i++) this.slide(base * rnd(.9, 1.1), base * rnd(1.1, 1.4), t + i * .1, .08, .05, kind === 'frog' || kind === 'dragon' ? 'square' : 'triangle');
  },
  baa(lamb) { if (!this.ok()) return; const t = this.ctx.currentTime; const f = lamb ? 520 : 330; const o = this.tone(f, t, .45, .07, 'sawtooth'); o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * .8, t + .4); const lfo = this.ctx.createOscillator(); lfo.frequency.value = 9; const lg = this.ctx.createGain(); lg.gain.value = f * .05; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + .5); },
  hiccup() { if (!this.ok()) return; const t = this.ctx.currentTime; this.slide(300, 700, t, .08, .08, 'square'); this.noiseHit(t + .08, .12, .05, 'lowpass', 800, 0, 1); },
  giggle() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this.slide(1400 + i * 200, 1800 + i * 200, t + i * .07, .06, .035, 'sine'); },
  hoot(vol = .3) { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 2; i++) { const o = this.tone(330, t + i * .32, .28, .08 * vol, 'sine'); o.frequency.setValueAtTime(360, t + i * .32); o.frequency.exponentialRampToValueAtTime(300, t + i * .32 + .25); } },
  ribbit(vol = .3) { if (!this.ok()) return; const t = this.ctx.currentTime; const o = this.tone(140, t, .22, .1 * vol, 'sawtooth'); o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(180, t + .2); },
  bird() {
    if (!this.ok()) return; const ctx = this.ctx, t = ctx.currentTime;
    const n = rndInt(2, 5), base = rnd(1800, 3200);
    for (let i = 0; i < n; i++) { const st = t + i * rnd(.09, .16); const o = this.tone(base, st, .13, .04, 'sine'); o.frequency.setValueAtTime(base * rnd(.9, 1.1), st); o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.6), st + .06); o.frequency.exponentialRampToValueAtTime(base * rnd(.8, 1), st + .12); }
  },
  quest() { if (!this.ok()) return; const t = this.ctx.currentTime; const seq = [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72], [1318, .84]]; seq.forEach(([f, d]) => this.tone(f, t + d, .35, .1, 'triangle')); [523, 659, 784].forEach(f => this.tone(f * 2, t + 1.1, 1.6, .05, 'sine')); this.noiseHit(t + .8, 1.2, .05, 'highpass', 6000, 0, 1); },
  questStart() { if (!this.ok()) return; const t = this.ctx.currentTime; [784, 988, 1175].forEach((f, i) => this.tone(f, t + i * .1, .3, .07, 'triangle')); },
  sticker() { if (!this.ok()) return; const t = this.ctx.currentTime; [880, 1108, 1318, 1760].forEach((f, i) => this.tone(f, t + i * .07, .35, .07, 'triangle')); },
  click() { if (!this.ok()) return; this.tone(900, this.ctx.currentTime, .05, .05, 'square'); },
  shutter() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseHit(t, .06, .25, 'highpass', 1000, 0, 2); this.tone(1200, t + .04, .05, .08, 'square'); },
  firework() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseHit(t, .5, .16, 'lowpass', 900, 0, .8); this.slide(200, 60, t, .3, .1); for (let i = 0; i < 6; i++) this.noiseHit(t + .2 + i * .07, .08, .04, 'highpass', 3000, 0, 1.5); },
  buy() { if (!this.ok()) return; const t = this.ctx.currentTime; [1046, 1318, 1568].forEach((f, i) => this.tone(f, t + i * .06, .25, .07, 'triangle')); },
  sleep() { if (!this.ok()) return; const t = this.ctx.currentTime; [523, 440, 392].forEach((f, i) => this.tone(f, t + i * .3, .6, .04, 'sine')); },
  wake() { if (!this.ok()) return; const t = this.ctx.currentTime; [392, 523, 659].forEach((f, i) => this.tone(f, t + i * .1, .3, .05, 'triangle')); },
  whoosh() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseHit(t, 1.2, .12, 'bandpass', 600, .5, 1); this.slide(200, 900, t, .8, .04, 'sine'); },
  munch() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) { this.noiseHit(t + i * .13, .09, .2, 'bandpass', 1300, 1, 1.1); this.slide(300, 120, t + i * .13, .08, .08); } },
  foalNicker(baby = 1) { if (!this.ok()) return; const t = this.ctx.currentTime; const f = lerp(420, 720, baby); for (let i = 0; i < 4; i++) { const o = this.tone(f * (1 - i * .06), t + i * .07, .1, .05, 'sawtooth'); o.frequency.setValueAtTime(f * (1 - i * .06), t + i * .07); o.frequency.linearRampToValueAtTime(f * .8, t + i * .07 + .09); } },
  brush() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseHit(t, .18, .08, 'bandpass', 3500, .6, .8); if (Math.random() < .5) this.tone(rnd(1800, 2600), t + .05, .15, .025, 'sine'); },
  skate() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseHit(t, .35, .06, 'highpass', 4000, 0, .7); this.slide(900, 1300, t, .25, .02); },
  pop() { if (!this.ok()) return; const t = this.ctx.currentTime; this.slide(500, 1100, t, .09, .1, 'triangle'); },
  raceBeep(go) { if (!this.ok()) return; const t = this.ctx.currentTime; this.tone(go ? 1320 : 660, t, go ? .5 : .2, .12, 'square'); if (go) this.tone(1760, t + .05, .45, .06, 'square'); },
  dive() { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 6; i++) this.slide(rnd(300, 600), rnd(900, 1400), t + i * .05, .08, .04); },
  cloudBump() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noiseHit(t, .4, .08, 'lowpass', 300, 0, .5); }
};
