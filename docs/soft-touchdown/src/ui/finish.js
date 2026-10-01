// =====================================================
// Tactile Forge — Lunar Lander · Finish / debrief screen
// =====================================================

import { state, bus, persist } from '../state.js';
import { gotoScreen } from './screens.js';

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderFinish() {
  const sortie = state.lastSortie;
  if (!sortie) return;
  const isWin = sortie.landings >= 1;     // any landing at all is a "victory" of sorts
  const callsign = state.pilot || 'EAGLE';
  document.getElementById('finish-title').textContent =
    isWin ? `${callsign} Down` : 'Mission Failed';
  document.getElementById('finish-sub').textContent =
    isWin
      ? `${sortie.landings} successful touchdown${sortie.landings === 1 ? '' : 's'}.${sortie.message ? ' ' + sortie.message : ''}`
      : (sortie.message || `Better luck on the next sortie, ${callsign}.`);
  document.getElementById('ds-score').textContent = sortie.score.toLocaleString();
  document.getElementById('ds-lands').textContent = sortie.landings;
  document.getElementById('ds-site').textContent  = String(sortie.bestSite).padStart(2, '0');
  document.getElementById('ds-time').textContent  = fmtTime(sortie.time);
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
