// =====================================================
// Tactile Forge — TRON · Finish / debrief screen
// =====================================================

import { state, bus, persist, qualifiesForHighScore, addHighScore } from '../state.js';
import { gotoScreen } from './screens.js';

function fmtT(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function renderFinish() {
  const sortie = state.lastSortie;
  if (!sortie) return;
  const reachedRound = sortie.reachedRound || 0;
  const isWin = sortie.outcome !== 'gameover';
  document.getElementById('finish-title').textContent =
    isWin ? 'Arena Cleared' : 'Ride Over';
  document.getElementById('finish-sub').textContent =
    isWin ? (sortie.message || 'Bike parked.') : (sortie.message || 'The arena keeps your bike.');
  document.getElementById('ds-score').textContent = sortie.score.toLocaleString();
  document.getElementById('ds-rounds').textContent = sortie.roundsCleared;
  document.getElementById('ds-derezzes').textContent = sortie.derezzes;
  document.getElementById('ds-longest').textContent = fmtT(sortie.longestRound);
  document.getElementById('ds-rank').textContent = sortie.rank;

  // Optional high-score prompt (only if elements present in HTML)
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
  addHighScore({ name, score: sortie.score, round: sortie.reachedRound || 1 });
  sortie._hsSaved = true;
  const prompt = document.getElementById('hs-prompt');
  if (prompt) prompt.hidden = true;
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
