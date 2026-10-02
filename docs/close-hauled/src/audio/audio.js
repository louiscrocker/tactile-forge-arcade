// =====================================================
// Tactile Forge — Lightweight WebAudio sound bank
// All sounds are generated procedurally — no asset files needed.
// =====================================================

let ctx = null;
let masterSfx = null;
let masterMusic = null;
let settings = { sfx: true, music: true };
let musicNode = null;

function ensureCtx() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterSfx   = ctx.createGain(); masterSfx.gain.value   = 0.5; masterSfx.connect(ctx.destination);
    masterMusic = ctx.createGain(); masterMusic.gain.value = 0.16; masterMusic.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

export function init(s) {
  settings = { ...settings, ...s };
}

export function setSfx(on)   { settings.sfx = on;   if (masterSfx)   masterSfx.gain.value   = on ? 0.5 : 0; }
export function setMusic(on) { settings.music = on; if (masterMusic) masterMusic.gain.value = on ? 0.16 : 0; if (on) startMusic(); else stopMusic(); }

function blip({ freq = 440, dur = .15, type = 'sine', detune = 0, gain = 0.4, attack = .005, release = .12 } = {}) {
  if (!settings.sfx || !ensureCtx()) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(masterSfx);
  o.start();
  o.stop(ctx.currentTime + dur + release);
}

function noise({ dur = .3, gain = 0.25, filterFreq = 1200 } = {}) {
  if (!settings.sfx || !ensureCtx()) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(masterSfx);
  src.start();
}

export const sfx = {
  click:    () => blip({ freq: 720, dur: .07, type: 'triangle', gain: .25 }),
  hover:    () => blip({ freq: 920, dur: .04, type: 'sine', gain: .12 }),
  dice:     () => { for (let i = 0; i < 3; i++) setTimeout(() => blip({ freq: 200 + Math.random() * 400, dur: .07, type: 'square', gain: .18 }), i * 80); },
  splash:   () => noise({ dur: .35, gain: .24, filterFreq: 1400 }),
  tack:     () => { blip({ freq: 280, dur: .12, type: 'sawtooth', gain: .22 }); setTimeout(() => blip({ freq: 360, dur: .14, type: 'sawtooth', gain: .22 }), 90); },
  card:     () => { blip({ freq: 540, dur: .1, type: 'triangle', gain: .25 }); setTimeout(() => blip({ freq: 760, dur: .12, type: 'triangle', gain: .22 }), 90); },
  victory:  () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip({ freq: f, dur: .3, type: 'triangle', gain: .35 }), i * 130));
  },
  collide:  () => { noise({ dur: .25, gain: .35, filterFreq: 600 }); blip({ freq: 110, dur: .2, type: 'square', gain: .2 }); },
  bell:     () => { blip({ freq: 1200, dur: .8, type: 'sine', gain: .25, release: .6 }); blip({ freq: 1800, dur: .8, type: 'sine', gain: .15, release: .6 }); }
};

let musicTimeout = null;
function startMusic() {
  if (musicNode || !ensureCtx()) return;
  // simple drone + occasional bell
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 110;
  const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 165;
  const g = ctx.createGain(); g.gain.value = 0.35;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
  osc.connect(filter); osc2.connect(filter); filter.connect(g).connect(masterMusic);
  osc.start(); osc2.start();
  musicNode = { osc, osc2 };
  const tick = () => {
    if (!musicNode) return;
    const notes = [523, 659, 784, 880, 1047, 1175];
    const f = notes[Math.floor(Math.random() * notes.length)];
    blip({ freq: f, dur: 1.4, type: 'sine', gain: .08, release: 1 });
    musicTimeout = setTimeout(tick, 6000 + Math.random() * 6000);
  };
  musicTimeout = setTimeout(tick, 4000);
}
function stopMusic() {
  if (!musicNode) return;
  try { musicNode.osc.stop(); musicNode.osc2.stop(); } catch {}
  musicNode = null;
  if (musicTimeout) clearTimeout(musicTimeout);
}

// Resume on first interaction (browser autoplay policy)
export function unlock() {
  if (ensureCtx() && ctx.state === 'suspended') ctx.resume();
  if (settings.music) startMusic();
}
