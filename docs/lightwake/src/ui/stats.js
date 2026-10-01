// =====================================================
// Tactile Forge — TRON · Stats screen
// =====================================================

import { state, resetCareer } from '../state.js';

function fmtT(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function renderHighScores() {
  const el = document.getElementById('hs-table');
  if (!el) return;
  const scores = state.scores || [];
  if (scores.length === 0) {
    el.innerHTML = '<div class="hs-empty">No scores yet. Get in the arena.</div>';
    return;
  }
  // Values are sanitised in state.js (initials [A-Z0-9], date YYYY-MM-DD),
  // which is what makes this innerHTML safe for imported data.
  const rows = scores.map((s, i) => `
    <tr>
      <td class="hs-rank">${String(i + 1).padStart(2, '0')}</td>
      <td class="hs-name">${s.name}</td>
      <td class="hs-score">${s.score.toLocaleString()}</td>
      <td class="hs-wave">R${String(s.round).padStart(2, '0')}</td>
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
    <div class="stat-tile"><span class="v">${c.runs}</span><span class="k">Runs</span></div>
    <div class="stat-tile"><span class="v">${c.roundsCleared}</span><span class="k">Rounds Cleared</span></div>
    <div class="stat-tile"><span class="v">${c.derezzes.toLocaleString()}</span><span class="k">Takedowns</span></div>
    <div class="stat-tile"><span class="v">${c.deaths}</span><span class="k">Crashes</span></div>
    <div class="stat-tile"><span class="v">${fmtT(c.longestRound)}</span><span class="k">Longest Round</span></div>
    <div class="stat-tile"><span class="v">${c.bestRound}</span><span class="k">Furthest Round</span></div>
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
