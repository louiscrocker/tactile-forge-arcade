// =====================================================
// Tactile Forge — TRON · WebAudio synth bank
// All sounds synthesized on the fly (no asset files).
// =====================================================

let ctx = null;
let masterGain = null;
let droneNode = null;          // ambient grid hum
let humNode = null;            // cycle engine drone (started when round begins)
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

export function setSFX(on) {
  cfg.sfx = on;
}
export function setMusic(on) {
  cfg.music = on;
  if (!on) { stopDrone(); stopHum(); }
}

function ready() { return ctx && cfg.sfx; }

// ===== Player turn (short tick blip) =====
export function turn() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(660, t + 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g).connect(masterGain);
  o.start(t); o.stop(t + 0.08);
}

// ===== Boost (rising whoosh) =====
export function boost() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(400, t);
  filt.frequency.exponentialRampToValueAtTime(2200, t + 0.22);
  filt.Q.value = 4;
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(720, t + 0.22);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(filt).connect(g).connect(masterGain);
  o.start(t); o.stop(t + 0.30);
}

// ===== Derez =====
//   self=true → player crash, deeper boom + glass shatter
//   self=false → foe crash, descending zap
export function derez(self = false) {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (self) {
    // Bass kick
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(g).connect(masterGain);
    o.start(t); o.stop(t + 0.7);
    // Noise burst on top
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.55, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(1400, t);
    filt.frequency.exponentialRampToValueAtTime(120, t + 0.55);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.32, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    src.connect(filt).connect(g2).connect(masterGain);
    src.start(t); src.stop(t + 0.6);
  } else {
    // Foe derez: bright descending square arpeggio
    const notes = [880, 660, 440, 220];
    for (let i = 0; i < notes.length; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = notes[i];
      g.gain.setValueAtTime(0.0001, t + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.10, t + i * 0.05 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.13);
      o.connect(g).connect(masterGain);
      o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.15);
    }
  }
}

// ===== Round-clear (rising arpeggio) =====
export function victory() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [392.0, 523.2, 659.3, 783.9, 1046.5];   // G4 C5 E5 G5 C6
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

// ===== Cycle engine hum (started when round begins, stopped on derez/finish) =====
export function startHum() {
  if (!ctx || !cfg.sfx || humNode) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = 92;          // low growl
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  lp.Q.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.04, t + 0.4);
  o.connect(lp).connect(g).connect(masterGain);
  o.start(t);
  humNode = { o, g, lp };
}
export function stopHum() {
  if (!humNode || !ctx) return;
  const t = ctx.currentTime;
  try {
    humNode.g.gain.cancelScheduledValues(t);
    humNode.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    humNode.o.stop(t + 0.3);
  } catch {}
  humNode = null;
}
/** Bend the engine hum's pitch up while boost is held. */
export function setHumBoost(active) {
  if (!humNode || !ctx) return;
  const t = ctx.currentTime;
  try {
    humNode.o.frequency.cancelScheduledValues(t);
    humNode.o.frequency.linearRampToValueAtTime(active ? 168 : 92, t + 0.12);
    humNode.lp.frequency.linearRampToValueAtTime(active ? 720 : 380, t + 0.12);
  } catch {}
}

// ===== Ambient grid drone (low control-room hum) =====
export function startDrone() {
  if (!ctx || !cfg.music || droneNode) return;
  const t = ctx.currentTime;
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sine';
  o2.type = 'sine';
  o1.frequency.value = 55.0;
  o2.frequency.value = 55.0 * 1.498;
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
