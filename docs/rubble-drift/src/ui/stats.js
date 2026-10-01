// =====================================================
// Tactile Forge — Asteroids · Stats screen
// =====================================================

import { state, resetCareer } from '../state.js';

function fmtAcc(c) {
  if (!c.shotsFired) return '0%';
  return Math.round(100 * c.hits / c.shotsFired) + '%';
}

function renderHighScores() {
  const el = document.getElementById('hs-table');
  if (!el) return;
  const scores = state.scores || [];
  if (scores.length === 0) {
    el.innerHTML = '<div class="hs-empty">No scores yet. Punch the void.</div>';
    return;
  }
  const rows = scores.map((s, i) => `
    <tr>
      <td class="hs-rank">${String(i + 1).padStart(2, '0')}</td>
      <td class="hs-name">${s.name}</td>
      <td class="hs-score">${s.score.toLocaleString()}</td>
      <td class="hs-wave">W${String(s.wave).padStart(2, '0')}</td>
      <td class="hs-date">${s.date || ''}</td>
    </tr>
  `).join('');
  el.innerHTML = `
    <h3 class="hs-heading">High Scores</h3>
    <table class="hs"><tbody>${rows}</tbody></table>
  `;
}

export function renderStats() {
  const body = document.getElementById('stats-body');
  if (!body) return;
  const c = state.career;
  body.innerHTML = `
    <div class="stat-tile"><span class="v">${c.patrols}</span><span class="k">Patrols</span></div>
    <div class="stat-tile"><span class="v">${c.wavesCleared}</span><span class="k">Waves Cleared</span></div>
    <div class="stat-tile"><span class="v">${c.asteroidsBlasted.toLocaleString()}</span><span class="k">Rocks Blasted</span></div>
    <div class="stat-tile"><span class="v">${c.saucersDowned}</span><span class="k">Saucers Downed</span></div>
    <div class="stat-tile"><span class="v">${fmtAcc(c)}</span><span class="k">Accuracy</span></div>
    <div class="stat-tile"><span class="v">${c.bestWave}</span><span class="k">Best Wave</span></div>
    <div class="stat-tile"><span class="v">${c.bestScore.toLocaleString()}</span><span class="k">Best Score</span></div>
  `;
  renderHighScores();
}

export function bindStats() {
  document.getElementById('btn-clear-stats')?.addEventListener('click', () => {
    if (!confirm('Reset career log AND high-score table?')) return;
    resetCareer();
    renderStats();
  });
}
