// =====================================================
// Tactile Forge — Missile Attack · WebAudio synth bank
// All sounds synthesized on the fly (no asset files).
// =====================================================

let ctx = null;
let masterGain = null;
let droneNode = null;          // ambient klaxon hum
let droneWanted = false;       // a mission is live and wants the hum
let cfg = { sfx: true, music: true };
const _unlockCallbacks = [];

export function init(opts = {}) {
  cfg = { ...cfg, ...opts };
}

export function unlock() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('Audio unlock failed:', e);
      return;
    }
  }
  // A context can come back suspended (autoplay policy, tab restore). Without
  // this resume every cue schedules silently and the game plays mute.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  // Fire deferred callbacks (e.g. intro chime catch-up)
  while (_unlockCallbacks.length) {
    try { _unlockCallbacks.shift()(); } catch {}
  }
}

export function isUnlocked() { return !!ctx; }
export function isRunning() { return ctx?.state === 'running'; }
export function onUnlock(fn) {
  if (ctx) { try { fn(); } catch {} }
  else _unlockCallbacks.push(fn);
}

export function setSFX(on) {
  cfg.sfx = on;
}
export function setMusic(on) {
  cfg.music = on;
  // Toggling music mid-mission should take effect immediately, both ways.
  if (on) _spinDrone();
  else _killDrone();
}

function ready() { return ctx && cfg.sfx; }

// ===== Counter-missile launch (rising whoosh) =====
export function launch() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(800, t);
  filt.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
  filt.Q.value = 6;
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(filt).connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + 0.24);
}

// ===== Friendly explosion (your blast — bright pop) =====
export function friendlyExplode() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1100, t);
  filter.frequency.exponentialRampToValueAtTime(420, t + 0.32);
  filter.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  src.connect(filter).connect(g).connect(masterGain);
  src.start(t);
  src.stop(t + 0.36);
}

// ===== Enemy explosion (deeper boom; bigger if true) =====
export function enemyExplode(big = false) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(big ? 1400 : 700, t);
  filter.frequency.exponentialRampToValueAtTime(70, t + (big ? 0.55 : 0.4));
  const g = ctx.createGain();
  g.gain.setValueAtTime(big ? 0.28 : 0.18, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.6 : 0.42));
  src.connect(filter).connect(g).connect(masterGain);
  src.start(t);
  src.stop(t + 0.62);
}

// ===== City / battery hit (bass thud + sub) =====
export function cityHit() {
  if (!ready()) return;
  const t = ctx.currentTime;
  // Sub-bass kick
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + 0.6);
  // Crunch noise on top
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.45, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(1100, t);
  filt.frequency.exponentialRampToValueAtTime(120, t + 0.45);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.32, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  src.connect(filt).connect(g2).connect(masterGain);
  src.start(t);
  src.stop(t + 0.5);
}

// ===== MIRV split chirp =====
export function mirvSplit() {
  if (!ready()) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(660 + i * 80, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    g.gain.setValueAtTime(0.0001, t + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.07, t + i * 0.04 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.04 + 0.16);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.04);
    o.stop(t + i * 0.04 + 0.18);
  }
}

// ===== Klaxon (low/empty ammo, urgent two-tone) =====
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
    o.start(t + i * 0.18);
    o.stop(t + i * 0.18 + 0.18);
  }
}

// ===== Wave-clear chime (rising arpeggio) =====
export function waveClear() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [392.0, 523.2, 659.3, 783.9, 987.7];   // G4 C5 E5 G5 B5
  for (let i = 0; i < notes.length; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = notes[i];
    g.gain.setValueAtTime(0.0001, t + i * 0.10);
    g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.10 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.10 + 0.5);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.10);
    o.stop(t + i * 0.10 + 0.55);
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
    o.start(t + i * 0.28);
    o.stop(t + i * 0.28 + 0.9);
  }
}

// ===== Ambient klaxon drone (low control-room hum) =====
export function startDrone() {
  droneWanted = true;
  _spinDrone();
}
export function stopDrone() {
  droneWanted = false;
  _killDrone();
}

function _spinDrone() {
  if (!ctx || !cfg.music || !droneWanted || droneNode) return;
  const t = ctx.currentTime;
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sine';
  o2.type = 'sine';
  o1.frequency.value = 58.27;        // ~Bb1
  o2.frequency.value = 58.27 * 1.498; // perfect fifth-ish
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 240;
  lp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.045, t + 0.6);
  o1.connect(lp); o2.connect(lp);
  lp.connect(g).connect(masterGain);
  o1.start(t); o2.start(t);
  droneNode = { o1, o2, g, lp };
}

function _killDrone() {
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
