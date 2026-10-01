// =====================================================
// Tactile Forge — Lunar Lander · WebAudio synth bank
// All sounds synthesized on the fly (no asset files).
// =====================================================

let ctx = null;
let masterGain = null;
let droneNode = null;     // capcom radio static / ambient drone
let thrustNode = null;    // looping thrust noise
let cfg = { sfx: true, music: true };
let droneWanted = false;  // a mission is in progress and wants the drone

export function init(opts = {}) {
  cfg = { ...cfg, ...opts };
}

export function unlock() {
  if (ctx) {
    // A context created before the page had a user gesture — or one suspended
    // when the tab was backgrounded — stays silent until explicitly resumed.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch (e) {
    console.warn('Audio unlock failed:', e);
  }
}

export function setSFX(on) {
  cfg.sfx = on;
  if (!on) stopThrust();
}
export function setMusic(on) {
  cfg.music = on;
  // Toggling the setting only spins the nodes up or down; whether a mission
  // wants a drone at all is tracked separately by droneWanted.
  if (on) { if (droneWanted) spinUpDrone(); }
  else spinDownDrone();
}

function ready() { return ctx && cfg.sfx; }

// ===== Thrust (looping filtered noise, ramps with throttle 0..1) =====
export function setThrust(throttle) {
  if (!cfg.sfx) { stopThrust(); return; }
  if (!ctx) return;
  const t = ctx.currentTime;
  if (throttle <= 0.01) { stopThrust(); return; }
  if (!thrustNode) {
    // Build a 1s noise buffer looped
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
    lp.Q.value = 1.2;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(hp).connect(lp).connect(g).connect(masterGain);
    src.start(t);
    thrustNode = { src, lp, g };
  }
  // Map throttle to loudness + filter brightness
  const amp = 0.05 + 0.18 * throttle;
  const cut = 320 + 1100 * throttle;
  thrustNode.g.gain.cancelScheduledValues(t);
  thrustNode.g.gain.linearRampToValueAtTime(amp, t + 0.04);
  thrustNode.lp.frequency.cancelScheduledValues(t);
  thrustNode.lp.frequency.linearRampToValueAtTime(cut, t + 0.04);
}
export function stopThrust() {
  if (!thrustNode || !ctx) return;
  const t = ctx.currentTime;
  try {
    thrustNode.g.gain.cancelScheduledValues(t);
    thrustNode.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    thrustNode.src.stop(t + 0.08);
  } catch {}
  thrustNode = null;
}

// ===== Explosion (filtered noise burst) =====
export function explosion(big = false) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(big ? 1800 : 900, t);
  filter.frequency.exponentialRampToValueAtTime(60, t + 0.65);
  const g = ctx.createGain();
  g.gain.setValueAtTime(big ? 0.42 : 0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.8 : 0.5));
  src.connect(filter).connect(g).connect(masterGain);
  src.start(t);
  src.stop(t + 0.8);
}

// ===== Footpad contact thud (soft landing) =====
export function thud() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(80, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.30, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + 0.24);
}

// ===== Beep (terminal blip) =====
export function beep(freq = 880, dur = 0.06) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.10, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ===== Low-fuel warning chirp =====
export function lowFuelChirp() {
  if (!ready()) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 2; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 440;
    g.gain.setValueAtTime(0.0001, t + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.10, t + i * 0.12 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.08);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.12);
    o.stop(t + i * 0.12 + 0.10);
  }
}

// ===== Soft landing chime (rising arpeggio) =====
export function landed(multiplier = 1) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [392.0, 523.2, 659.3, 783.9];   // G B-ish C E G
  for (let i = 0; i < notes.length; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = notes[i] * (1 + (multiplier - 1) * 0.05);
    g.gain.setValueAtTime(0.0001, t + i * 0.10);
    g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.10 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.10 + 0.45);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.10);
    o.stop(t + i * 0.10 + 0.5);
  }
}

// ===== Death thud (defeat) =====
export function defeat() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [220, 196, 174.6, 130.8];
  for (let i = 0; i < notes.length; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = notes[i];
    g.gain.setValueAtTime(0.0001, t + i * 0.22);
    g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.22 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.7);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.22);
    o.stop(t + i * 0.22 + 0.75);
  }
}

// ===== Ambient drone (low LM ambient hum) =====

/** Begin the mission drone (respects the Engine Drone setting). */
export function startDrone() {
  droneWanted = true;
  spinUpDrone();
}

/** End the mission drone. */
export function stopDrone() {
  droneWanted = false;
  spinDownDrone();
}

function spinUpDrone() {
  if (!ctx || !cfg.music || droneNode) return;
  const t = ctx.currentTime;
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sine';
  o2.type = 'sine';
  o1.frequency.value = 65.4;        // C2
  o2.frequency.value = 65.4 * 1.501; // ~G2 (perfect fifth-ish)
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 280;
  lp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.6);
  o1.connect(lp); o2.connect(lp);
  lp.connect(g).connect(masterGain);
  o1.start(t); o2.start(t);
  droneNode = { o1, o2, g, lp };
}

function spinDownDrone() {
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
