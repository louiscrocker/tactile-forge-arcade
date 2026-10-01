// =====================================================
// Tactile Forge — Asteroids · WebAudio synth bank
// All sounds synthesized on the fly (no asset files).
// Surface mirrors siblings: init, unlock, setSFX/Music, startDrone/stopDrone.
// =====================================================

let ctx = null;
let masterGain = null;
let droneNode = null;          // saucer hum (active while saucer on screen)
let thrustNode = null;         // ship thrust loop (active while thrusting)
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

export function setSFX(on) { cfg.sfx = on; if (!on) stopThrust(); }
export function setMusic(on) {
  cfg.music = on;
  if (!on) stopDrone();
}

function ready() { return ctx && cfg.sfx; }

// ===== Player fire (short blip) =====
export function fire() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.10);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  o.connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + 0.15);
}

// ===== Saucer fire (slightly buzzier) =====
export function saucerFire() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(540, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.14);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.13, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + 0.2);
}

// ===== Asteroid bang (filtered noise burst, size-dependent) =====
function bang(durSec, lpStart, lpEnd, peak) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * durSec), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(lpStart, t);
  lp.frequency.exponentialRampToValueAtTime(lpEnd, t + durSec);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
  src.connect(lp).connect(g).connect(masterGain);
  src.start(t);
  src.stop(t + durSec + 0.02);
}
export function bangSmall()  { bang(0.30, 1800, 320, 0.18); }
export function bangMedium() { bang(0.45, 1500, 180, 0.24); }
export function bangLarge()  { bang(0.65, 1200,  60, 0.32); }

// ===== Player explosion (debris cracking) =====
export function shipExplode() {
  if (!ready()) return;
  bang(0.85, 1600, 30, 0.34);
  // Add a sub-bass tail
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.85);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.30, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + 0.95);
}

// ===== Hyperspace whoosh =====
export function hyperspace() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.20);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.40);
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 800;
  filt.Q.value = 7;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o.connect(filt).connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + 0.45);
}

// ===== Extra-ship jingle =====
export function extraShip() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];   // C5 E5 G5 C6
  for (let i = 0; i < notes.length; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = notes[i];
    g.gain.setValueAtTime(0.0001, t + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.14, t + i * 0.08 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.42);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.08);
    o.stop(t + i * 0.08 + 0.45);
  }
}

// ===== Wave-clear (rising arpeggio) =====
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
    g.gain.exponentialRampToValueAtTime(0.13, t + i * 0.10 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.10 + 0.50);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.10);
    o.stop(t + i * 0.10 + 0.55);
  }
}

// ===== Game-over dirge =====
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
    o.start(t + i * 0.28);
    o.stop(t + i * 0.28 + 0.9);
  }
}

// ===== Beat (low/high alternating bass — the iconic Asteroids pulse) =====
let _beatHigh = false;
export function beat() {
  if (!ready()) return;
  _beatHigh = !_beatHigh;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = _beatHigh ? 110 : 78;     // ~A2 / Eb2
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  // Add a sub-bass kick under the square for body
  const sub = ctx.createOscillator();
  const sg  = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.value = _beatHigh ? 55 : 39;
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
  o.connect(g).connect(masterGain);
  sub.connect(sg).connect(masterGain);
  o.start(t); o.stop(t + 0.18);
  sub.start(t); sub.stop(t + 0.22);
}
export function resetBeat() { _beatHigh = false; }

// ===== Ship-thrust loop (low pulsing rumble while W is held) =====
export function startThrust() {
  if (!ctx || !cfg.sfx || thrustNode) return;
  const t = ctx.currentTime;
  // Buffer noise source through a lowpass for a rocket-rumble feel
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 240;
  lp.Q.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.085, t + 0.04);
  src.connect(lp).connect(g).connect(masterGain);
  src.start(t);
  thrustNode = { src, g, lp };
}
export function stopThrust() {
  if (!thrustNode || !ctx) return;
  const t = ctx.currentTime;
  try {
    thrustNode.g.gain.cancelScheduledValues(t);
    thrustNode.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
    thrustNode.src.stop(t + 0.12);
  } catch {}
  thrustNode = null;
}

// ===== Saucer drone (warbling siren — large vs small different pitch) =====
export function startDrone(small = false) {
  if (!ctx || !cfg.music || droneNode) return;
  const t = ctx.currentTime;
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'sawtooth';
  const base = small ? 180 : 110;
  o1.frequency.value = base;
  o2.frequency.value = base * 1.012;     // detuned for warble
  // LFO modulates pitch slightly (gives the saucer hover-feel)
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = small ? 5.5 : 3.5;
  lfoGain.gain.value = small ? 8 : 6;
  lfo.connect(lfoGain);
  lfoGain.connect(o1.frequency);
  lfoGain.connect(o2.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = small ? 900 : 600;
  lp.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.075, t + 0.5);
  o1.connect(lp); o2.connect(lp);
  lp.connect(g).connect(masterGain);
  o1.start(t); o2.start(t); lfo.start(t);
  droneNode = { o1, o2, lfo, g, lp };
}
export function stopDrone() {
  if (!droneNode || !ctx) return;
  const t = ctx.currentTime;
  try {
    droneNode.g.gain.cancelScheduledValues(t);
    droneNode.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    droneNode.o1.stop(t + 0.5);
    droneNode.o2.stop(t + 0.5);
    droneNode.lfo.stop(t + 0.5);
  } catch {}
  droneNode = null;
}
