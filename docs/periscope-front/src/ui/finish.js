// =====================================================
// Tactile Forge — Tank Battle · Finish / debrief screen
// =====================================================

import { state, bus, persist } from '../state.js';
import { gotoScreen } from './screens.js';

function fmtAcc(fired, kills) {
  if (!fired) return '0%';
  return Math.round(100 * kills / fired) + '%';
}

function renderFinish() {
  const sortie = state.lastSortie;
  if (!sortie) return;
  const isWin = false;     // game ends only on death
  document.getElementById('finish-title').textContent =
    isWin ? 'Engagement Holds' : 'Engagement Ends';
  document.getElementById('finish-sub').textContent =
    sortie.message || 'The dust settles.';
  document.getElementById('ds-score').textContent = sortie.score.toLocaleString();
  document.getElementById('ds-waves').textContent = sortie.wavesCleared;
  document.getElementById('ds-kills').textContent = sortie.kills;
  document.getElementById('ds-acc').textContent  = fmtAcc(sortie.shellsFired, sortie.kills);
  document.getElementById('ds-rank').textContent  = sortie.rank;
  persist();
}

export function bindFinish() {
  document.getElementById('btn-rematch').addEventListener('click', () => {
    gotoScreen('game');
    document.body.dispatchEvent(new CustomEvent('mission:launch'));
  });

  bus.on('screen', (name) => {
    if (name === 'finish') renderFinish();
  });
}
