// =====================================================
// Tactile Forge — Tank Battle · WebAudio synth bank
// All sounds synthesized on the fly (no asset files).
// =====================================================

let ctx = null;
let masterGain = null;
let droneNode = null;          // engine rumble drone
let cfg = { sfx: true, music: true };
const _unlockCallbacks = [];

export function init(opts = {}) {
  cfg = { ...cfg, ...opts };
}

export function unlock() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  } catch (e) {
    console.warn('Audio unlock failed:', e);
  }
  while (_unlockCallbacks.length) {
    try { _unlockCallbacks.shift()(); } catch {}
  }
}

export function isUnlocked() { return !!ctx; }
export function onUnlock(fn) {
  if (ctx) { try { fn(); } catch {} }
  else _unlockCallbacks.push(fn);
}

export function setSFX(on) { cfg.sfx = on; }
export function setMusic(on) {
  cfg.music = on;
  if (!on) stopDrone();
}

function ready() { return ctx && cfg.sfx; }

// ===== Cannon fire (deep punch with tail) =====
export function cannon() {
  if (!ready()) return;
  const t = ctx.currentTime;
  // Sub punch
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.22);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g).connect(masterGain);
  o.start(t); o.stop(t + 0.34);
  // White noise crack
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 600;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.32, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
  src.connect(filt).connect(ng).connect(masterGain);
  src.start(t); src.stop(t + 0.22);
}

// ===== Enemy explosion (deeper boom, big = super tank or saucer) =====
export function explode(big = false) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.7, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(big ? 1500 : 800, t);
  filter.frequency.exponentialRampToValueAtTime(60, t + (big ? 0.65 : 0.45));
  const g = ctx.createGain();
  g.gain.setValueAtTime(big ? 0.34 : 0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.7 : 0.5));
  src.connect(filter).connect(g).connect(masterGain);
  src.start(t); src.stop(t + 0.72);
}

// ===== Hull hit (player gets hit — bass thud + crunch) =====
export function hullHit() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.55);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(g).connect(masterGain);
  o.start(t); o.stop(t + 0.62);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(900, t);
  filt.frequency.exponentialRampToValueAtTime(120, t + 0.4);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.34, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  src.connect(filt).connect(g2).connect(masterGain);
  src.start(t); src.stop(t + 0.42);
}

// ===== Ricochet (shell hit obstacle) =====
export function ricochet() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(420, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
  o.connect(g).connect(masterGain);
  o.start(t); o.stop(t + 0.22);
}

// ===== Saucer hum (UFO incoming chirp loop simulation; one-shot here) =====
export function saucer() {
  if (!ready()) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(720, t + i * 0.09);
    o.frequency.exponentialRampToValueAtTime(960, t + i * 0.09 + 0.07);
    g.gain.setValueAtTime(0.0001, t + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.05, t + i * 0.09 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.10);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.12);
  }
}

// ===== Klaxon (warning two-tone) =====
export function klaxon() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [620, 460];
  for (let i = 0; i < notes.length; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = notes[i];
    g.gain.setValueAtTime(0.0001, t + i * 0.18);
    g.gain.exponentialRampToValueAtTime(0.10, t + i * 0.18 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.18);
  }
}

// ===== Wave-clear chime (rising arpeggio) =====
export function waveClear() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [392.0, 523.2, 659.3, 783.9, 987.7];
  for (let i = 0; i < notes.length; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = notes[i];
    g.gain.setValueAtTime(0.0001, t + i * 0.10);
    g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.10 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.10 + 0.5);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.10); o.stop(t + i * 0.10 + 0.55);
  }
}

// ===== Defeat (descending dirge) =====
export function defeat() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [220, 196, 164.8, 130.8, 98.0];
  for (let i = 0; i < notes.length; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = notes[i];
    g.gain.setValueAtTime(0.0001, t + i * 0.28);
    g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.28 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.28 + 0.85);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.28); o.stop(t + i * 0.28 + 0.9);
  }
}

// ===== Engine drone (low rumble while alive) =====
export function startDrone() {
  if (!ctx || !cfg.music || droneNode) return;
  const t = ctx.currentTime;
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'sawtooth';
  o1.frequency.value = 48;
  o2.frequency.value = 73;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 220;
  lp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.04, t + 0.6);
  o1.connect(lp); o2.connect(lp);
  lp.connect(g).connect(masterGain);
  o1.start(t); o2.start(t);
  droneNode = { o1, o2, g, lp };
}
export function stopDrone() {
  if (!droneNode || !ctx) return;
  const t = ctx.currentTime;
  try {
    droneNode.g.gain.cancelScheduledValues(t);
    droneNode.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    droneNode.o1.stop(t + 0.5);
    droneNode.o2.stop(t + 0.5);
  } catch {}
  droneNode = null;
}
