// =====================================================
// Tactile Forge — Lunar Lander · Settings bindings
// =====================================================

import { state, persist, bus } from '../state.js';
import * as audio from '../audio/audio.js';
import { resolveMode, rendererLabel, webglAvailable } from '../render/index.js';

function applyPhosphor(p) {
  document.body.dataset.phosphor = p;
}
function applyCRT(on) {
  document.body.dataset.crt = on ? 'on' : 'off';
}
function applyReduce(on) {
  document.body.dataset.reduceMotion = on ? 'true' : 'false';
}

export function bindSettings() {
  // Apply current settings on load
  applyPhosphor(state.settings.phosphor);
  applyCRT(state.settings.crt);
  applyReduce(state.settings.reduceMotion);

  // SFX
  const sfx = document.getElementById('opt-sfx');
  sfx.setAttribute('aria-pressed', state.settings.sfx ? 'true' : 'false');
  sfx.textContent = state.settings.sfx ? 'On' : 'Off';
  sfx.addEventListener('click', () => {
    state.settings.sfx = !state.settings.sfx;
    sfx.setAttribute('aria-pressed', state.settings.sfx ? 'true' : 'false');
    sfx.textContent = state.settings.sfx ? 'On' : 'Off';
    audio.setSFX(state.settings.sfx);
    persist();
  });

  // Music
  const music = document.getElementById('opt-music');
  music.setAttribute('aria-pressed', state.settings.music ? 'true' : 'false');
  music.textContent = state.settings.music ? 'On' : 'Off';
  music.addEventListener('click', () => {
    state.settings.music = !state.settings.music;
    music.setAttribute('aria-pressed', state.settings.music ? 'true' : 'false');
    music.textContent = state.settings.music ? 'On' : 'Off';
    audio.setMusic(state.settings.music);
    persist();
  });

  // CRT scanlines
  const crt = document.getElementById('opt-crt');
  crt.setAttribute('aria-pressed', state.settings.crt ? 'true' : 'false');
  crt.textContent = state.settings.crt ? 'On' : 'Off';
  crt.addEventListener('click', () => {
    state.settings.crt = !state.settings.crt;
    crt.setAttribute('aria-pressed', state.settings.crt ? 'true' : 'false');
    crt.textContent = state.settings.crt ? 'On' : 'Off';
    applyCRT(state.settings.crt);
    persist();
  });

  // Phosphor color
  const ph = document.getElementById('opt-phosphor');
  ph.querySelectorAll('.seg').forEach(b => {
    b.classList.toggle('is-active', b.dataset.value === state.settings.phosphor);
    b.addEventListener('click', () => {
      ph.querySelectorAll('.seg').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      state.settings.phosphor = b.dataset.value;
      applyPhosphor(state.settings.phosphor);
      persist();
    });
  });

  // Renderer
  const rend = document.getElementById('opt-renderer');
  const note = document.getElementById('renderer-note');
  const describe = () => {
    const active = rendererLabel(resolveMode(state.settings.renderer));
    if (!webglAvailable()) {
      note.textContent = `Using ${active} — WebGL2 isn't available in this browser.`;
      return;
    }
    note.textContent = state.settings.renderer === 'canvas'
      ? 'Using Canvas 2D — flat strokes, no bloom or phosphor trails.'
      : `Using ${active} — beam glow, bloom and phosphor persistence.`;
  };
  rend.querySelectorAll('.seg').forEach(b => {
    b.classList.toggle('is-active', b.dataset.value === state.settings.renderer);
    // Offering WebGL where it can't run would just be a dead button.
    if (b.dataset.value === 'webgl' && !webglAvailable()) b.disabled = true;
    b.addEventListener('click', () => {
      rend.querySelectorAll('.seg').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      state.settings.renderer = b.dataset.value;
      persist();
      bus.emit('renderer', state.settings.renderer);
      describe();
    });
  });
  describe();

  // Reduced motion
  const rm = document.getElementById('opt-reduce-motion');
  rm.setAttribute('aria-pressed', state.settings.reduceMotion ? 'true' : 'false');
  rm.textContent = state.settings.reduceMotion ? 'On' : 'Off';
  rm.addEventListener('click', () => {
    state.settings.reduceMotion = !state.settings.reduceMotion;
    rm.setAttribute('aria-pressed', state.settings.reduceMotion ? 'true' : 'false');
    rm.textContent = state.settings.reduceMotion ? 'On' : 'Off';
    applyReduce(state.settings.reduceMotion);
    persist();
  });
}
