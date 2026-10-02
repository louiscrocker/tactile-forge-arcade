// =====================================================
// Tactile Forge — Settings screen
// =====================================================

import { state } from '../state.js';
import { saveSettings } from '../storage.js';
import * as audio from '../audio/audio.js';
import { sfx } from '../audio/audio.js';

export function bindSettings() {
  const sfxBtn = document.getElementById('opt-sfx');
  const musBtn = document.getElementById('opt-music');
  const speed = document.getElementById('opt-speed');
  const reduceBtn = document.getElementById('opt-reduce-motion');

  // Initialize from state
  setToggle(sfxBtn, state.settings.sfx);
  setToggle(musBtn, state.settings.music);
  setToggle(reduceBtn, !!state.settings.reduceMotion);
  setActiveSeg(speed, state.settings.speed);
  if (state.settings.reduceMotion) document.documentElement.dataset.reduceMotion = 'true';

  sfxBtn.addEventListener('click', () => {
    state.settings.sfx = !state.settings.sfx;
    setToggle(sfxBtn, state.settings.sfx);
    audio.setSfx(state.settings.sfx);
    saveSettings(state.settings);
    sfx.click();
  });
  musBtn.addEventListener('click', () => {
    state.settings.music = !state.settings.music;
    setToggle(musBtn, state.settings.music);
    audio.setMusic(state.settings.music);
    saveSettings(state.settings);
  });
  speed.addEventListener('click', (e) => {
    const t = e.target.closest('.seg'); if (!t) return;
    [...speed.children].forEach(b => b.classList.remove('is-active'));
    t.classList.add('is-active');
    state.settings.speed = t.dataset.value;
    saveSettings(state.settings);
  });
  reduceBtn.addEventListener('click', () => {
    state.settings.reduceMotion = !state.settings.reduceMotion;
    setToggle(reduceBtn, state.settings.reduceMotion);
    if (state.settings.reduceMotion) document.documentElement.dataset.reduceMotion = 'true';
    else delete document.documentElement.dataset.reduceMotion;
    saveSettings(state.settings);
  });
}

function setToggle(btn, on) {
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? 'On' : 'Off';
}
function setActiveSeg(root, value) {
  [...root.children].forEach(b => b.classList.toggle('is-active', b.dataset.value === value));
}
