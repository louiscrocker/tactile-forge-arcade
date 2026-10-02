// =====================================================
// Tactile Forge — Screen routing & top-level navigation
// =====================================================

import { state, bus } from '../state.js';

export function gotoScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
  const next = document.querySelector(`.screen[data-screen="${name}"]`);
  if (next) {
    next.classList.add('is-active');
    state.screen = name;
    bus.emit('screen', name);
  }
}

export function bindTopNav() {
  document.body.addEventListener('click', (evt) => {
    const t = evt.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    switch (action) {
      case 'goto-title':    gotoScreen('title');    break;
      case 'goto-setup':    gotoScreen('setup');    break;
      case 'goto-rules':    gotoScreen('rules');    break;
      case 'goto-stats':    gotoScreen('stats');    break;
      case 'goto-settings': gotoScreen('settings'); break;
      case 'goto-game':     gotoScreen('game');     break;
      case 'goto-finish':   gotoScreen('finish');   break;
    }
  });
}
