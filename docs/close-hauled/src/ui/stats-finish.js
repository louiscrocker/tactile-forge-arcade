// =====================================================
// Tactile Forge — Stats screen
// =====================================================

import { loadStats, saveStats } from '../storage.js';
import { sfx } from '../audio/audio.js';

export function bindStats() {
  document.getElementById('btn-clear-stats').addEventListener('click', () => {
    if (confirm('Reset career stats?')) {
      saveStats({ races: 0, wins: 0, podiums: 0, distance: 0, marksRounded: 0, eventsDrawn: 0 });
      renderStats();
      sfx.click();
    }
  });
}

export function renderStats() {
  const s = loadStats();
  const tiles = [
    ['Races',       s.races],
    ['Wins',        s.wins],
    ['Podiums',     s.podiums],
    ['Marks Rounded', s.marksRounded],
    ['Cards Drawn',   s.eventsDrawn],
    ['Win Rate',    s.races ? `${Math.round((s.wins / s.races) * 100)}%` : '—']
  ];
  document.getElementById('stats-body').innerHTML = tiles.map(([k, v]) =>
    `<div class="stat-tile"><span class="v">${v}</span><span class="k">${k}</span></div>`
  ).join('');
}
