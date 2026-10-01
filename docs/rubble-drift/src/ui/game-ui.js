// =====================================================
// Tactile Forge — Asteroids · In-game HUD wiring
// =====================================================

import { state, bus } from '../state.js';
import { gotoScreen } from './screens.js';
import { Engine } from '../game/engine.js';
import * as audio from '../audio/audio.js';

let engine = null;

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function shipsGlyph(n) {
  // Up to 6 ship icons, then numeric overflow
  if (n <= 0) return '—';
  if (n > 6)  return `▲ × ${n}`;
  return '▲'.repeat(n);
}

export function initGame() {
  const canvas = document.getElementById('game-canvas');
  engine = new Engine(canvas);

  // Phase banner
  const banner  = document.getElementById('phase-banner');
  const pbNum   = document.getElementById('pb-num');
  const pbName  = document.getElementById('pb-name');
  const pbSub   = document.getElementById('pb-sub');

  bus.on('phase', ({ num, name, sub }) => {
    pbNum.textContent  = String(num);
    pbName.textContent = name;
    pbSub.textContent  = sub;
    banner.hidden = false;
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
    setTimeout(() => { banner.hidden = true; }, 2200);
  });

  // HUD
  const valWave   = document.getElementById('val-wave');
  const valShips  = document.getElementById('val-ships');
  const valRocks  = document.getElementById('val-rocks');
  const valSaucer = document.getElementById('val-saucer');
  const valScore  = document.getElementById('val-score');
  const valHigh   = document.getElementById('val-high');
  const valTime   = document.getElementById('val-time');
  const screenGame = document.querySelector('.screen-game');

  bus.on('hud', (h) => {
    valWave.textContent  = String(h.wave).padStart(2, '0');
    valShips.textContent = shipsGlyph(h.lives);
    valRocks.textContent = h.rocks;
    valSaucer.textContent = h.saucer;
    valSaucer.dataset.unsafe = (h.saucer !== '—') ? 'true' : 'false';
    valScore.textContent = h.score.toLocaleString();
    valHigh.textContent  = h.high.toLocaleString();
    valTime.textContent  = fmtTime(h.time);
  });

  bus.on('hit', () => {
    screenGame.classList.add('is-hit');
    setTimeout(() => screenGame.classList.remove('is-hit'), 400);
  });

  // Comm
  const commText = document.getElementById('comm-text');
  const commWrap = document.getElementById('comm');
  let commTimer = null;
  bus.on('comm', (text) => {
    commText.textContent = text;
    commWrap.classList.remove('is-hidden');
    clearTimeout(commTimer);
    commTimer = setTimeout(() => commWrap.classList.add('is-hidden'), 3200);
  });

  // Pause
  const pausedVeil = document.getElementById('paused-veil');
  const menu = document.getElementById('game-menu');
  function pause(p) {
    engine.setPaused(p);
    pausedVeil.hidden = !p;
    if (!p) menu.hidden = true;
  }
  bus.on('pause-toggle', () => pause(!engine.paused));

  // Navigating away mid-sortie (top nav, brand mark) must not leave a live ship
  // flying — and audio droning — behind a screen nobody is looking at.
  bus.on('screen', (name) => {
    if (name !== 'game' && engine.running && !engine.paused) pause(true);
  });

  document.getElementById('game-menu-btn').addEventListener('click', () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    pause(opening);
  });
  document.getElementById('btn-resume').addEventListener('click', () => pause(false));
  document.getElementById('btn-restart')?.addEventListener('click', () => {
    engine.restartWave();
    pause(false);
  });
  document.getElementById('btn-quit').addEventListener('click', () => {
    engine.stop();
    pausedVeil.hidden = true;
    menu.hidden = true;
    gotoScreen('title');
  });

  // Mission launch from briefing or rematch
  document.body.addEventListener('mission:launch', () => {
    audio.unlock();
    audio.init({ sfx: state.settings.sfx, music: state.settings.music });
    engine.start({ difficulty: state.difficulty });
    pausedVeil.hidden = true;
    menu.hidden = true;
  });

  // Mission end → debrief
  bus.on('mission-end', () => {
    setTimeout(() => gotoScreen('finish'), 1600);
  });
}

export function getEngine() { return engine; }
