// =====================================================
// Tactile Forge — Tank Battle · Stats screen
// =====================================================

import { state, resetCareer } from '../state.js';

function fmtAcc(c) {
  if (!c.shellsFired) return '0%';
  return Math.round(100 * c.kills / c.shellsFired) + '%';
}

export function renderStats() {
  const body = document.getElementById('stats-body');
  if (!body) return;
  const c = state.career;
  body.innerHTML = `
    <div class="stat-tile"><span class="v">${c.sorties}</span><span class="k">Sorties</span></div>
    <div class="stat-tile"><span class="v">${c.wavesCleared}</span><span class="k">Waves Cleared</span></div>
    <div class="stat-tile"><span class="v">${c.kills.toLocaleString()}</span><span class="k">Kills</span></div>
    <div class="stat-tile"><span class="v">${c.superKills.toLocaleString()}</span><span class="k">Super Tanks</span></div>
    <div class="stat-tile"><span class="v">${c.saucerKills.toLocaleString()}</span><span class="k">Saucers</span></div>
    <div class="stat-tile"><span class="v">${fmtAcc(c)}</span><span class="k">Accuracy</span></div>
    <div class="stat-tile"><span class="v">${c.bestWave}</span><span class="k">Best Wave</span></div>
    <div class="stat-tile"><span class="v">${c.bestScore.toLocaleString()}</span><span class="k">Best Score</span></div>
  `;
}

export function bindStats() {
  document.getElementById('btn-clear-stats')?.addEventListener('click', () => {
    if (!confirm('Reset career log?')) return;
    resetCareer();
    renderStats();
  });
}
