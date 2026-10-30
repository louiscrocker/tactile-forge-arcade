/* ============================================================
   audio.js — every sound synthesised on the fly, no files.
   A bouncy generative tune (marimba and tuba, faster on smash
   days, softer on storm nights), rain and wind for the storm,
   and the one-shots: thumps and crumbles, glass tinkles, the
   spanner's ratchet, the glue's squelch, the bucket's clang,
   the dizzy boing, pigeons' coos, the fanfare.
   ============================================================ */
'use strict';

const AudioFX = {
  on: false, ctx: null, ready: false, paused: false, music: true,
  start() {
    if (this.ready) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    const rain = ctx.createBufferSource(); rain.buffer = buf; rain.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1500;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0; rain.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(this.master); rain.start();
    const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 300; this.windF.Q.value = .8;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0; wind.connect(this.windF); this.windF.connect(this.windGain); this.windGain.connect(this.master); wind.start();
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = .45; this.musicGain.connect(this.master);
    this.clock = .5; this.step = 0; this.chord = 0;
    this.ready = true; this.resume();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended' && !this.paused) this.ctx.resume(); },
  setEnabled(v) {
    this.on = v; if (v) this.start();
    if (this.master) { const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v ? .8 : 0, t, .15); }
  },
  pause(p) { this.paused = p; if (!this.ctx) return; if (p) this.ctx.suspend(); else if (this.on) this.ctx.resume(); },
  ok() { return this.on && this.ready && !this.paused; },

  CHORDS: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14], [7, 11, 14]],
  /* o: { mode: 'smash'|'mend'|'storm'|'map'|'title', rain, wind, combo } */
  update(dt, o) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime((o.rain || 0) * .05, t, .4);
    this.windGain.gain.setTargetAtTime((o.wind || 0) * .06, t, .3); this.windF.frequency.setTargetAtTime(250 + (o.wind || 0) * 400, t, .3);
    if (!this.music || o.mode === 'quiet') return;
    this.clock -= dt;
    if (this.clock > 0) return;
    const storm = o.mode === 'storm', beat = storm ? .3 : o.mode === 'smash' ? .19 : .22;
    this.clock = beat; this.step++;
    if (this.step % 8 === 0) this.chord = (this.chord + 1) % this.CHORDS.length;
    const ch = this.CHORDS[this.chord], root = storm ? 196 : 262, s = this.step % 8;
    if (s % 4 === 0) this.voice(root / 2 * Math.pow(2, ch[0] / 12), t, .28, .09, 'tuba');
    if (s % 4 === 2) this.voice(root / 2 * Math.pow(2, ch[2] / 12), t, .2, .06, 'tuba');
    const pat = storm ? [0, -1, 2, -1, 1, -1, 2, 1] : [0, 2, 1, 2, 0, 1, 2, 1];
    if (pat[s] >= 0 && Math.random() < .85) this.voice(root * Math.pow(2, (ch[pat[s]] + (s === 6 ? 12 : 0)) / 12), t, .22, storm ? .04 : .06, 'marimba');
    if (o.mode === 'smash' && s % 2 === 1) this.hat(t);
    if (o.combo > 2 && s % 2 === 0) this.voice(root * 2 * Math.pow(2, ch[1] / 12), t, .1, .03, 'marimba');
  },
  voice(f, start, dur, vol, kind) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = kind === 'tuba' ? 'triangle' : 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + .008); g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(g); g.connect(this.musicGain); o.start(start); o.stop(start + dur + .02);
    if (kind === 'marimba') { const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.frequency.value = f * 4; g2.gain.setValueAtTime(vol * .3, start); g2.gain.exponentialRampToValueAtTime(.0001, start + .05); o2.connect(g2); g2.connect(this.musicGain); o2.start(start); o2.stop(start + .07); }
  },
  hat(t) { this.burst(t, .03, 8000, 1, .015, 1, 'highpass', this.musicGain); },
  tone(f, start, dur, vol = .1, type = 'sine', f2) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, start);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, start + dur);
    g.gain.setValueAtTime(.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + .01); g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(g); g.connect(this.master); o.start(start); o.stop(start + dur + .02);
  },
  burst(t, dur, freq, q, vol, rate = 1, type = 'bandpass', dest) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.master); src.start(t, Math.random()); src.stop(t + dur + .02);
  },
  /* ---- one-shots ---- */
  play(name, k = 1) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'whiff': this.burst(t, .12, 1200, 1.2, .08, 1.4); break;
      case 'punch': this.tone(160, t, .12, .3, 'sine', 50); this.burst(t, .08, 900, 1, .18, .8); break;
      case 'break': this.tone(120, t, .16, .28, 'sine', 45); this.burst(t, .25, 500, .7, .22, .6, 'lowpass'); for (let i = 0; i < 3; i++) this.burst(t + .03 + i * .03, .05, 2400 + i * 400, 4, .05, 1.3); break;
      case 'crack': this.burst(t, .06, 1800, 3, .14, 1.2); this.tone(220, t, .06, .1, 'square', 120); break;
      case 'glass': for (let i = 0; i < 6; i++) this.tone(2400 + Math.random() * 2200, t + i * .025, .18, .035, 'sine'); this.burst(t, .12, 5000, 2, .08, 1.5); break;
      case 'clang': for (const f of [440, 1108, 1660]) this.tone(f, t, 1.6, .07, 'sine'); break;
      case 'crumble': { const n = Math.min(1, k); this.tone(70, t, .5 + n * .5, .35, 'sine', 30); this.burst(t, .6 + n * .6, 300, .5, .3, .4, 'lowpass'); for (let i = 0; i < 8; i++) this.burst(t + .05 + i * .06, .07, 1200 + Math.random() * 1800, 3, .05, 1.1); break; }
      case 'stomp': this.tone(90, t, .3, .4, 'sine', 35); this.burst(t, .3, 250, .6, .3, .5, 'lowpass'); break;
      case 'jump': this.tone(300 * k, t, .14, .06, 'square', 600 * k); break;
      case 'land': this.burst(t, .08, 400, .8, .1 * k, .7, 'lowpass'); break;
      case 'climb': this.burst(t, .04, 1500, 2, .03, 1); break;
      case 'grab': this.tone(500, t, .05, .05, 'triangle'); break;
      case 'spanner': for (let i = 0; i < 4; i++) this.burst(t + i * .045, .025, 3200, 8, .09, 1.6); break;
      case 'glue': this.tone(180, t, .18, .12, 'sine', 420); this.burst(t, .12, 600, 2, .05, .6); break;
      case 'fixed': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * .06, .3, .07, 'triangle')); break;
      case 'catch': this.tone(660, t, .08, .1, 'square'); for (const f of [1320, 1760]) this.tone(f, t + .02, .5, .04, 'sine'); break;
      case 'bonk': { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(140, t + .35); const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 18; lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.0001, t + .45); o.connect(g); g.connect(this.master); o.start(t); lfo.start(t); o.stop(t + .5); lfo.stop(t + .5); break; }
      case 'boing': this.tone(200, t, .25, .12, 'sine', 500); break;
      case 'coo': for (const d of [0, .22]) this.tone(420, t + d, .18, .06, 'sine', 360); break;
      case 'meow': this.tone(700, t, .35, .07, 'triangle', 500); break;
      case 'drop': this.tone(900, t, .3, .03, 'sine', 300); break;
      case 'plop': this.tone(300, t, .1, .1, 'sine', 120); break;
      case 'rebreak': this.burst(t, .08, 2600, 3, .1, 1.2); this.tone(500, t, .2, .06, 'triangle', 250); break;
      case 'thunder': this.burst(t + .2, 1.8, 120, .4, .35, .35, 'lowpass'); this.burst(t + .4, 1.2, 240, .6, .15, .5, 'lowpass'); break;
      case 'gust': this.burst(t, 1.2, 600, .5, .08, .6); break;
      case 'ballswing': this.burst(t, .3, 400, 1, .08, .7); break;
      case 'fence': this.burst(t, .1, 1400, 3, .12, 1); this.tone(330, t, .2, .08, 'square', 260); break;
      case 'combo': this.tone(523 * Math.pow(2, Math.min(k, 9) / 12), t, .12, .07, 'square'); break;
      case 'click': this.tone(900, t, .04, .05, 'square'); break;
      case 'star': this.tone(1047 * k, t, .4, .09, 'triangle'); this.tone(1568 * k, t + .05, .4, .05, 'sine'); break;
      case 'fail': [392, 330, 262].forEach((f, i) => this.tone(f, t + i * .18, .3, .08, 'triangle')); break;
      case 'fanfare': [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .56], [1046, .68], [1318, .8]].forEach(([f, d]) => this.tone(f, t + d, .35, .11, 'triangle')); [523, 659, 784].forEach(f => this.tone(f, t + 1.05, 1.4, .05, 'sine')); break;
    }
  }
};
