// =====================================================
// Tactile Forge — Tank Battle · Settings bindings
// =====================================================

import { state, persist } from '../state.js';
import * as audio from '../audio/audio.js';

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

  // Bloom (off/soft/hot)
  const bloom = document.getElementById('opt-bloom');
  if (bloom) {
    bloom.querySelectorAll('.seg').forEach(b => {
      b.classList.toggle('is-active', b.dataset.value === state.settings.bloom);
      b.addEventListener('click', () => {
        bloom.querySelectorAll('.seg').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        state.settings.bloom = b.dataset.value;
        persist();
      });
    });
  }

  // CRT curve + chroma
  const curve = document.getElementById('opt-curve');
  if (curve) {
    curve.setAttribute('aria-pressed', state.settings.curve ? 'true' : 'false');
    curve.textContent = state.settings.curve ? 'On' : 'Off';
    curve.addEventListener('click', () => {
      state.settings.curve = !state.settings.curve;
      curve.setAttribute('aria-pressed', state.settings.curve ? 'true' : 'false');
      curve.textContent = state.settings.curve ? 'On' : 'Off';
      persist();
    });
  }

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
