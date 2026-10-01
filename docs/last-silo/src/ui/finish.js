// =====================================================
// Tactile Forge — Missile Attack · Finish / debrief screen
// =====================================================

import { state, bus, persist, qualifiesForHighScore, addHighScore } from '../state.js';
import { gotoScreen } from './screens.js';

// One blast can take several warheads, so hits can exceed shots fired —
// cap the ratio rather than reporting "340% accuracy".
function fmtAcc(fired, hits) {
  if (!fired) return '0%';
  return Math.min(100, Math.round(100 * hits / fired)) + '%';
}

function renderFinish() {
  const sortie = state.lastSortie;
  if (!sortie) return;
  const isWin = sortie.citiesRemaining > 0;
  document.getElementById('finish-title').textContent =
    isWin ? 'Sirens Fall Silent' : 'The Coast Burns';
  document.getElementById('finish-sub').textContent =
    isWin
      ? `${sortie.citiesRemaining} cit${sortie.citiesRemaining === 1 ? 'y' : 'ies'} stand. ${sortie.message ?? ''}`.trim()
      : (sortie.message || 'All silos cold. All cities lost.');
  document.getElementById('ds-score').textContent = sortie.score.toLocaleString();
  document.getElementById('ds-waves').textContent = sortie.wavesCleared;
  document.getElementById('ds-cities').textContent = sortie.citiesRemaining;
  document.getElementById('ds-acc').textContent  = fmtAcc(sortie.missilesFired, sortie.hits);
  document.getElementById('ds-rank').textContent  = sortie.rank;

  // High-score prompt
  const prompt = document.getElementById('hs-prompt');
  const initials = document.getElementById('hs-initials');
  const saved = sortie._hsSaved;
  if (prompt && initials) {
    if (!saved && qualifiesForHighScore(sortie.score)) {
      prompt.hidden = false;
      initials.value = (state.pilot || 'AAA').slice(0, 3).toUpperCase();
      initials.focus();
      initials.select();
    } else {
      prompt.hidden = true;
    }
  }

  persist();
}

function saveHighScore() {
  const sortie = state.lastSortie;
  if (!sortie || sortie._hsSaved) return;
  const initials = document.getElementById('hs-initials');
  const name = (initials?.value || 'AAA').toUpperCase().slice(0, 3) || 'AAA';
  addHighScore({ name, score: sortie.score, wave: sortie.wavesCleared + 1 });
  sortie._hsSaved = true;
  document.getElementById('hs-prompt').hidden = true;
}

export function bindFinish() {
  document.getElementById('btn-rematch').addEventListener('click', () => {
    saveHighScore();
    gotoScreen('game');
    document.body.dispatchEvent(new CustomEvent('mission:launch'));
  });

  document.getElementById('btn-hs-save')?.addEventListener('click', saveHighScore);
  document.getElementById('hs-initials')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveHighScore(); }
  });

  // Save high score when navigating away from finish screen via topnav
  bus.on('screen', (name) => {
    if (name === 'finish') renderFinish();
    else saveHighScore();
  });
}
