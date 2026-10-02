// =====================================================
// Tactile Forge — Close-Hauled
// Entry point
// =====================================================

import { state, bus } from './state.js';
import { gotoScreen, bindTopNav } from './ui/screens.js';
import { bindSetup } from './ui/setup.js';
import { bindStats, renderStats } from './ui/stats-finish.js';
import { bindSettings } from './ui/settings.js';
import { initGame } from './ui/game-ui.js';
import { WaterBackground } from './render/water.js';
import * as audio from './audio/audio.js';

function boot() {
  audio.init({ sfx: state.settings.sfx, music: state.settings.music });

  // Animated background
  const water = new WaterBackground(document.getElementById('bg-water'));

  bindTopNav();
  bindSetup();
  bindStats();
  bindSettings();
  initGame();

  // Render stats whenever the user opens that screen
  bus.on('screen', (name) => {
    if (name === 'stats') renderStats();
  });

  // Unlock audio on first interaction
  const unlock = () => {
    audio.unlock();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  // Make sure title is showing
  gotoScreen('title');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
