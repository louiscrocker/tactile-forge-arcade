/* ============================================================
   audio.js — the storm, synthesised
   ============================================================
   No sample files. The roar is filtered noise whose cutoff and
   gain track how close and how strong the circulation is; rain
   is a separate high-passed noise bed; thunder and the moo are
   one-shot voices.
   ============================================================ */
'use strict';

const AudioFX = {
  on: false,
  ctx: null,
  ready: false,

  start() {
    if (this.ready) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    /* A couple of seconds of brown-ish noise, looped. */
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.019 * w) / 1.019;
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    /* --- the roar --- */
    this.roarSrc = ctx.createBufferSource();
    this.roarSrc.buffer = buf;
    this.roarSrc.loop = true;

    this.roarLP = ctx.createBiquadFilter();
    this.roarLP.type = 'lowpass';
    this.roarLP.frequency.value = 300;
    this.roarLP.Q.value = 0.7;

    this.roarBP = ctx.createBiquadFilter();
    this.roarBP.type = 'bandpass';
    this.roarBP.frequency.value = 90;
    this.roarBP.Q.value = 1.1;

    this.roarGain = ctx.createGain();
    this.roarGain.gain.value = 0;

    this.roarSrc.connect(this.roarLP);
    this.roarLP.connect(this.roarBP);
    this.roarBP.connect(this.roarGain);
    this.roarGain.connect(this.master);
    this.roarSrc.start();

    /* --- rain bed --- */
    this.rainSrc = ctx.createBufferSource();
    this.rainSrc.buffer = buf;
    this.rainSrc.loop = true;
    this.rainHP = ctx.createBiquadFilter();
    this.rainHP.type = 'highpass';
    this.rainHP.frequency.value = 1800;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this.rainSrc.connect(this.rainHP);
    this.rainHP.connect(this.rainGain);
    this.rainGain.connect(this.master);
    this.rainSrc.start();

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
      this.master.gain.setTargetAtTime(v ? 0.9 : 0, t, 0.25);
    }
  },

  /* Called every frame with the live storm state. */
  update(tor, camDist, rain) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;

    const strength = clamp(tor.peakWind / 100, 0, 1.4) * tor.lifeScale;
    const near = clamp(1 - camDist / 1600, 0, 1);
    const level = strength * near * near;

    this.roarGain.gain.setTargetAtTime(level * 0.85, t, 0.3);
    this.roarLP.frequency.setTargetAtTime(160 + level * 900, t, 0.4);
    this.roarBP.frequency.setTargetAtTime(58 + level * 130, t, 0.4);
    this.rainGain.gain.setTargetAtTime(rain * 0.1 + level * 0.05, t, 0.5);
  },

  thunder(distance) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const delay = clamp(distance / 340, 0, 4);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t + delay);
    lp.frequency.exponentialRampToValueAtTime(90, t + delay + 1.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(0.7, t + delay + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 2.2);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t + delay);
    src.stop(t + delay + 2.4);
  },

  /* A cow, briefly and unwillingly airborne. */
  moo() {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(168, t);
    osc.frequency.exponentialRampToValueAtTime(104, t + 0.35);
    osc.frequency.exponentialRampToValueAtTime(126, t + 0.62);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(380, t + 0.6);
    lp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.06);
    g.gain.setValueAtTime(0.22, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    osc.connect(lp); lp.connect(g); g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.8);
  },

  /*
     Civil defence siren: a slow rise-and-fall wail, two detuned voices
     so it beats the way a real rotating horn does. Runs continuously
     while a warning is up, faded in and out rather than switched.
  */
  siren(on) {
    if (!this.ready) { if (on) this.start(); if (!this.ready) return; }
    const ctx = this.ctx, t = ctx.currentTime;

    if (on && !this.sirenNodes) {
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.connect(this.master);

      const lfo = ctx.createOscillator();          // the wail
      lfo.type = 'triangle';
      lfo.frequency.value = 0.14;
      const lfoAmt = ctx.createGain();
      lfoAmt.gain.value = 118;
      lfo.connect(lfoAmt);

      const voices = [];
      for (let i = 0; i < 2; i++) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 452 + i * 5;
        lfoAmt.connect(o.frequency);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1500;
        const vg = ctx.createGain();
        vg.gain.value = 0.5;
        o.connect(lp); lp.connect(vg); vg.connect(g);
        o.start(t);
        voices.push(o);
      }
      lfo.start(t);
      this.sirenNodes = { g, lfo, voices };
      g.gain.setTargetAtTime(0.13, t, 1.1);
    } else if (on && this.sirenNodes) {
      this.sirenNodes.g.gain.setTargetAtTime(0.13, t, 1.1);
    } else if (!on && this.sirenNodes) {
      const n = this.sirenNodes;
      this.sirenNodes = null;
      n.g.gain.setTargetAtTime(0.0001, t, 1.4);
      const stopAt = t + 6;
      n.lfo.stop(stopAt);
      n.voices.forEach(v => v.stop(stopAt));
    }
  },

  /* Debris impact — a short dry thud. */
  thud(power) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.4;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 180 + Math.random() * 260;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    const amp = clamp(power * 0.02, 0.02, 0.16);
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t);
    src.stop(t + 0.25);
  }
};
