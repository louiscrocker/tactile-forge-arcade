// =====================================================
// Tactile Forge — Missile Attack · Entry point
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

  // Background starfield (atmosphere on non-game screens too)
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
      // Defer one frame so the screen is on-DOM before we measure the canvas
      requestAnimationFrame(() => playIntro());
    }
  });

  // User clicks on Home/brand → re-arm the intro before the screen swap
  // (capture phase so we run before screens.js handles the click)
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="goto-title"]')) {
      introPlayed = false;
    }
  }, true);

  // Audio unlock on first interaction. Keep listening until the context is
  // actually running — the first gesture can yield a suspended context, and a
  // one-shot listener would leave the game permanently mute.
  const unlock = () => {
    audio.unlock();
    if (!audio.isRunning()) return;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  gotoScreen('title');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
