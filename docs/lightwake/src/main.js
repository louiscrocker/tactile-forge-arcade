// =====================================================
// Tactile Forge — TRON · Entry point
// =====================================================

import { state, bus } from './state.js';
import { gotoScreen, bindTopNav } from './ui/screens.js';
import { bindBriefing } from './ui/title.js';
import { bindSettings } from './ui/settings.js';
import { bindStats, renderStats } from './ui/stats.js';
import { bindFinish } from './ui/finish.js';
import { initGame } from './ui/game-ui.js';
import { playIntro } from './ui/intro.js';
import { Starfield } from './render/starfield.js';
import * as audio from './audio/audio.js';

function boot() {
  audio.init({ sfx: state.settings.sfx, music: state.settings.music });

  // eslint-disable-next-line no-new
  new Starfield(document.getElementById('bg-stars'), 220);

  bindTopNav();
  bindBriefing();
  bindSettings();
  bindStats();
  bindFinish();
  initGame();

  let introPlayed = false;
  bus.on('screen', (name) => {
    if (name === 'stats') renderStats();
    if (name === 'title' && !introPlayed) {
      introPlayed = true;
      requestAnimationFrame(() => playIntro());
    }
  });

  document.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="goto-title"]')) {
      introPlayed = false;
    }
  }, true);

  const unlock = () => {
    audio.unlock();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  gotoScreen('title');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
