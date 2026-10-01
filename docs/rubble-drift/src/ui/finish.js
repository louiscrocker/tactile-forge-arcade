// =====================================================
// Tactile Forge — Asteroids · Finish / debrief screen
// =====================================================

import { state, bus, persist, qualifiesForHighScore, addHighScore } from '../state.js';
import { gotoScreen } from './screens.js';

function fmtAcc(fired, hits) {
  if (!fired) return '0%';
  return Math.round(100 * hits / fired) + '%';
}

function renderFinish() {
  const sortie = state.lastSortie;
  if (!sortie) return;
  document.getElementById('finish-title').textContent = 'Patrol Ends';
  document.getElementById('finish-sub').textContent =
    sortie.message || 'The void is quiet again.';
  document.getElementById('ds-score').textContent = sortie.score.toLocaleString();
  document.getElementById('ds-waves').textContent = sortie.wavesCleared;
  document.getElementById('ds-rocks').textContent = sortie.asteroidsBlasted;
  document.getElementById('ds-saucers').textContent = sortie.saucersDowned;
  document.getElementById('ds-acc').textContent  = fmtAcc(sortie.shotsFired, sortie.hits);
  document.getElementById('ds-rank').textContent = sortie.rank;

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
  // Leaving the finish screen also calls this, so gate on qualification —
  // otherwise a 0-point run lands a visible "AAA · 0" row in the table.
  if (!qualifiesForHighScore(sortie.score)) { sortie._hsSaved = true; return; }
  const initials = document.getElementById('hs-initials');
  const name = (initials?.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'AAA';
  addHighScore({ name, score: sortie.score, wave: sortie.wave });
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

  bus.on('screen', (name) => {
    if (name === 'finish') renderFinish();
    else saveHighScore();
  });
}
