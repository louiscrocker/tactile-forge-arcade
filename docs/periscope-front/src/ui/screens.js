// =====================================================
// Tactile Forge — Tank Battle · Screen routing
// =====================================================

import { bus } from '../state.js';

const VALID = new Set(['title', 'briefing', 'game', 'finish', 'stats', 'settings']);

export function gotoScreen(name) {
  if (!VALID.has(name)) return;
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.toggle('is-active', el.dataset.screen === name);
  });
  bus.emit('screen', name);
}

export function bindTopNav() {
  document.body.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    switch (action) {
      case 'goto-title':    gotoScreen('title'); break;
      case 'goto-briefing': gotoScreen('briefing'); break;
      case 'goto-stats':    gotoScreen('stats'); break;
      case 'goto-settings': gotoScreen('settings'); break;
      case 'goto-game':     gotoScreen('game'); break;
      case 'goto-finish':   gotoScreen('finish'); break;
    }
  });
}
