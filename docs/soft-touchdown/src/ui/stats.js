// =====================================================
// Tactile Forge — Lunar Lander · Stats screen
// =====================================================

import { state, persist, emptyCareer } from '../state.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const tile = (value, label) =>
  `<div class="stat-tile"><span class="v">${value}</span><span class="k">${label}</span></div>`;

export function renderStats() {
  const body = document.getElementById('stats-body');
  if (!body) return;
  const c = state.career;
  body.innerHTML = [
    tile(num(c.sorties).toLocaleString(),    'Sorties'),
    tile(num(c.landings).toLocaleString(),   'Landings'),
    tile(num(c.crashes).toLocaleString(),    'Crashes'),
    tile(num(c.bestStreak).toLocaleString(), 'Best Streak'),
    tile(num(c.bestScore).toLocaleString(),  'Best Score'),
  ].join('');
}

export function bindStats() {
  document.getElementById('btn-clear-stats')?.addEventListener('click', () => {
    if (!confirm('Reset career log?')) return;
    state.career = emptyCareer();
    persist();
    renderStats();
  });
}
