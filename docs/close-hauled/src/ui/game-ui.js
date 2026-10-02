// =====================================================
// Tactile Forge — In-game UI controller
// Wires HUD, action dock, dice, event cards, hot-seat handoff,
// AI turns, online sync, and the canvas interactions.
// =====================================================

import { state, bus } from '../state.js';
import { gotoScreen } from './screens.js';
import { CourseRenderer, COMPACT } from '../render/course.js';
import { WindRose } from '../render/wind-rose.js';
import { YachtRaceEngine } from '../game/engine.js';
import { YACHT_COLORS, YACHT_CLASSES, COURSES } from '../game/constants.js';
import { pickAIHeading, aiShouldRest } from '../game/ai.js';
import { sfx } from '../audio/audio.js';
import { loadStats, saveStats } from '../storage.js';

const dieFaces = ['⚀','⚁','⚂','⚃','⚄','⚅'];

let renderer = null;
let windRose = null;
let engine = null;
let aiTimer = null;
let chatLog = [];

export function initGame() {
  renderer = new CourseRenderer(document.getElementById('course-canvas'));
  windRose = new WindRose(document.getElementById('wind-rose'));

  bindGameButtons();
  bindCanvas();

  bus.on('start-game', () => startLocalGame());
  bus.on('start-game-online', (cfg) => startOnlineGame(cfg, true));
  bus.on('online-start', (cfg) => startOnlineGame(cfg, false));
  bus.on('online-state', (st) => applyRemoteState(st));
  bus.on('online-chat', ({ name, text }) => addChat(name, text));
}

function bindGameButtons() {
  document.getElementById('btn-roll').addEventListener('click', onRoll);
  document.getElementById('btn-end-turn').addEventListener('click', onEndTurn);
  document.getElementById('btn-rest').addEventListener('click', onRest);
  document.getElementById('btn-event-ok').addEventListener('click', onEventOk);
  document.getElementById('btn-handoff-ok').addEventListener('click', () => {
    document.getElementById('handoff-back').hidden = true;
    syncUI();
  });
  // On phones the standings collapse into a bar; tapping it opens the full list.
  const standingsHud = document.getElementById('hud-standings');
  standingsHud.addEventListener('click', () => {
    if (!COMPACT.matches) return;
    const open = standingsHud.classList.toggle('is-open');
    standingsHud.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('game-menu-btn').addEventListener('click', () => {
    const m = document.getElementById('game-menu');
    m.hidden = !m.hidden;
  });
  document.getElementById('btn-quit').addEventListener('click', () => {
    if (confirm('Quit this race and return to the main menu?')) {
      cleanupGame();
      gotoScreen('title');
    }
  });
  document.getElementById('btn-rematch').addEventListener('click', () => {
    if (state.online && state.net?.role === 'host') {
      state.net.send({ kind: 'start', config: state.setup });
    }
    startLocalGame();
  });

  // Chat
  const chatForm = document.getElementById('chat-form');
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = document.getElementById('chat-text');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    const name = state.net?.localName || 'You';
    addChat(name, text);
    state.net?.send({ kind: 'chat', name, text });
  });
}

// Pointer events cover mouse, touch and pen. A mouse previews the heading on
// hover and sets it on click, as before. A finger previews it while pressed
// (drag to adjust) and sets it on release, so no hover is needed.
function bindCanvas() {
  const canvas = document.getElementById('course-canvas');
  let downId = null;
  const aim = (e) => {
    if (!engine || engine.phase !== 'heading') { renderer.setHover(null); return; }
    const cur = engine.getCurrentPlayer();
    if (cur.isAI) { renderer.setHover(null); return; }
    if (state.online && cur.netId !== myPeerId()) { renderer.setHover(null); return; }
    const n = renderer.pickFromEvent(e);
    renderer.setHover(n.x, n.y);
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    downId = e.pointerId;
    document.getElementById('hud-standings').classList.remove('is-open');
    if (e.pointerType !== 'mouse') {
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      aim(e);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || downId === e.pointerId) aim(e);
  });
  canvas.addEventListener('pointerleave', (e) => { if (downId !== e.pointerId) renderer.setHover(null); });
  canvas.addEventListener('pointercancel', () => { downId = null; renderer.setHover(null); });
  canvas.addEventListener('pointerup', (e) => {
    if (downId !== e.pointerId) return;
    downId = null;
    if (e.pointerType !== 'mouse') renderer.setHover(null);
    setHeadingFrom(e);
  });

  function setHeadingFrom(e) {
    if (!engine || engine.phase !== 'heading') return;
    const cur = engine.getCurrentPlayer();
    if (cur.isAI) return;
    if (state.online && cur.netId !== myPeerId()) return;
    const n = renderer.pickFromEvent(e);
    const dx = n.x - cur.x, dy = n.y - cur.y;
    if (Math.hypot(dx, dy) < 0.005) return;
    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    const result = engine.setHeading(angle);
    sfx.click();
    if (result === 'tack_success' || result === 'jibe') sfx.tack();
    else if (result === 'tack_failed') { sfx.collide(); toast('Tack failed!', '🌀'); }
    renderer.setHover(null);
    syncUI();
    pushOnlineState();
  }
}

function myPeerId() {
  if (!state.online) return null;
  if (state.net?.role === 'host') return 'host';
  return state.net?.localId;
}

// ---- Start / restart ----
export function startLocalGame() {
  cleanupGame();
  state.online = false;
  document.getElementById('chat').hidden = true;
  document.getElementById('net-badge').hidden = true;
  engine = new YachtRaceEngine();
  engine.setupGame({
    players: state.setup.players,
    course: state.setup.course,
    laps: state.setup.laps,
    difficulty: state.setup.difficulty
  });
  state.engine = engine;
  beginGame();
}

function startOnlineGame(cfg, isHost) {
  cleanupGame();
  state.online = true;
  document.getElementById('chat').hidden = false;
  document.getElementById('net-badge').hidden = false;
  engine = new YachtRaceEngine();
  engine.setupGame({
    players: cfg.players,
    course: cfg.course,
    laps: cfg.laps,
    difficulty: cfg.difficulty
  });
  state.engine = engine;
  beginGame();
}

function beginGame() {
  renderer.setEngine(engine);
  renderer.start();
  gotoScreen('game');
  syncUI();
  // First turn
  setTimeout(maybeAutoTurn, 600);
}

function cleanupGame() {
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
  if (eventTimer) { clearTimeout(eventTimer); eventTimer = null; }
  rollPending = false;
  document.getElementById('event-back').hidden = true;
  document.getElementById('handoff-back').hidden = true;
  document.getElementById('dice').hidden = true;
  document.getElementById('btn-roll').hidden = false;
  document.getElementById('btn-end-turn').hidden = true;
  document.getElementById('btn-rest').hidden = true;
}

// ---- Turn flow ----
function maybeAutoTurn() {
  if (!engine) return;
  if (engine.phase === 'finished') return finishRace();

  const cur = engine.getCurrentPlayer();

  // In online mode, only the host advances the simulation.
  if (state.online && state.net?.role !== 'host' && cur.netId !== myPeerId()) {
    // We are an observer this turn — just sync.
    syncUI();
    return;
  }

  if (cur.isAI) {
    runAITurn();
  } else {
    showHotseatHandoffIfNeeded();
  }
}

function showHotseatHandoffIfNeeded() {
  // Only show in offline hot-seat with multiple humans
  if (state.online) { syncUI(); return; }
  const humans = engine.players.filter(p => !p.isAI && !p.finished);
  if (humans.length < 2) { syncUI(); return; }
  const cur = engine.getCurrentPlayer();
  document.getElementById('handoff-name').textContent = cur.name;
  document.getElementById('handoff-color').style.background = cur.color.hex;
  document.getElementById('handoff-color').style.color = cur.color.hex;
  document.getElementById('handoff-back').hidden = false;
  syncUI();
}

function runAITurn() {
  syncUI();
  aiTimer = setTimeout(() => {
    if (!engine) return;
    const cur = engine.getCurrentPlayer();
    if (aiShouldRest(engine, cur)) {
      engine.restCrew(cur);
      toast(`${cur.name} rests the crew`, '☕');
    }
    const heading = pickAIHeading(engine, cur);
    engine.setHeading(heading);
    sfx.tack();
    syncUI();
    aiTimer = setTimeout(() => {
      const result = engine.performRoll();
      animateDice(result.dice);
      sfx.dice();
      aiTimer = setTimeout(() => {
        engine.performMove(result.movement);
        sfx.splash();
        syncUI();
        pushOnlineState();
        aiTimer = setTimeout(() => doEventPhase(), 700);
      }, 800);
    }, 600);
  }, 700);
}

function doEventPhase() {
  if (engine.shouldDrawEvent()) {
    const card = engine.drawEvent();
    showEventCard(card);
  } else {
    advanceTurn();
  }
}

function showEventCard(card) {
  document.getElementById('event-icon').textContent = card.icon;
  document.getElementById('event-tag').textContent = card.type.toUpperCase();
  document.getElementById('event-tag').dataset.tone = card.type;
  document.getElementById('event-title').textContent = card.title;
  document.getElementById('event-text').textContent = card.text;
  document.getElementById('event-effect').textContent = card.effect;
  document.getElementById('event-back').hidden = false;
  sfx.card();
}

function onEventOk() {
  const card = engine.lastEvent;
  if (card) engine.applyEvent(card);
  document.getElementById('event-back').hidden = true;
  syncUI();
  pushOnlineState();
  advanceTurn();
}

function onRest() {
  const cur = engine.getCurrentPlayer();
  engine.restCrew(cur);
  toast(`${cur.name} rests the crew`, '☕');
  document.getElementById('btn-rest').hidden = true;
  sfx.click();
  syncUI();
  pushOnlineState();
}

// A roll is in flight from the click until the event phase runs. Without this
// guard a double-click rolled twice, moved twice and advanced the turn twice,
// skipping the next skipper; End Turn during the pause did the same.
let rollPending = false;
let eventTimer = null;

function onRoll() {
  if (!engine || rollPending) return;
  if (engine.phase !== 'rolling') {
    toast('Set a heading first — click on the chart.', '🧭');
    return;
  }
  rollPending = true;
  document.getElementById('btn-roll').hidden = true;
  sfx.dice();
  const result = engine.performRoll();
  animateDice(result.dice);
  setTimeout(() => {
    engine.performMove(result.movement);
    sfx.splash();
    syncUI();
    pushOnlineState();
    eventTimer = setTimeout(runEventPhase, 600);
  }, 900);
}

function runEventPhase() {
  eventTimer = null;
  rollPending = false;
  doEventPhase();
}

function onEndTurn() {
  if (!engine) return;
  // End Turn only skips the short pause after a move; the event phase still runs once.
  if (eventTimer) { clearTimeout(eventTimer); runEventPhase(); }
}

function advanceTurn() {
  engine.endTurn();
  if (engine.phase === 'finished') return finishRace();
  const start = engine.startTurn();
  if (start === 'wind_shifted') toast(`Wind shifts to ${engine.windDirection}`, '💨');
  if (start === 'skipped')      toast('Skipped (broken halyard)', '🔧');
  syncUI();
  pushOnlineState();
  setTimeout(maybeAutoTurn, 500);
}

function animateDice(dice) {
  const dock = document.getElementById('dice');
  const d1 = document.getElementById('die1');
  const d2 = document.getElementById('die2');
  const tot = document.getElementById('dice-total');
  dock.hidden = false;
  d1.classList.remove('is-rolling'); d2.classList.remove('is-rolling');
  void d1.offsetWidth; void d2.offsetWidth;
  d1.classList.add('is-rolling'); d2.classList.add('is-rolling');
  let i = 0;
  const id = setInterval(() => {
    d1.textContent = dieFaces[Math.floor(Math.random() * 6)];
    d2.textContent = dieFaces[Math.floor(Math.random() * 6)];
    tot.textContent = '+' + (Math.floor(Math.random() * 12) + 1);
    if (i++ > 7) { clearInterval(id); d1.textContent = dieFaces[dice.d1 - 1]; d2.textContent = dieFaces[dice.d2 - 1]; tot.textContent = '+' + dice.total; }
  }, 80);
}

// ---- HUD sync ----
function syncUI() {
  if (!engine) return;
  const cur = engine.getCurrentPlayer();
  const cls = YACHT_CLASSES[cur.yachtClass];
  const pos = engine.getPointOfSail(cur.heading);

  // Wind HUD
  document.getElementById('wind-strength').textContent = engine.windStrength.replace(/^./, s => s.toUpperCase());
  document.getElementById('wind-dir').textContent = engine.windDirection;
  document.getElementById('wind-tide').textContent = engine.getTideStateLabel();
  document.getElementById('wind-sky').textContent = engine.weatherState === 'fog' ? '🌫️' : engine.weatherState === 'rain' ? '🌧️' : engine.timeOfDay > 0.7 || engine.timeOfDay < 0.2 ? '🌙' : '☀️';
  windRose.draw(engine.getWindAngle(), engine.windStrength, cur.heading, pos);

  // Standings
  const list = document.getElementById('standings');
  list.innerHTML = '';
  engine.getStandings().forEach((p, i) => {
    const li = document.createElement('li');
    if (p.id === cur.id) li.classList.add('is-current');
    if (p.finished) li.classList.add('is-finished');
    li.innerHTML = `
      <span class="st-rank">${i + 1}</span>
      <span class="st-color" style="background:${p.color.hex}"></span>
      <span class="st-name">${escape(p.name)}${p.isAI ? ' <span style="opacity:.5;font-family:JetBrains Mono;font-size:9px">AI</span>' : ''}</span>
      <span class="st-mark">M${p.currentMark}</span>
      <span class="st-lap">L${p.lap + 1}/${engine.totalLaps}</span>
      <span class="st-bar"></span>
    `;
    list.appendChild(li);
  });
  document.getElementById('turn-tag').textContent = `Turn ${engine.turnNumber}`;

  // Action dock
  document.getElementById('dock-color').style.background = cur.color.hex;
  document.getElementById('dock-color').style.color = cur.color.hex;
  document.getElementById('dock-name').textContent = cur.name + (cur.isAI ? ' (AI)' : '');
  document.getElementById('dock-class').textContent = cls.name;
  document.getElementById('dock-stamina').textContent = Math.round(cur.crewStamina) + '%';
  document.getElementById('dock-lap').textContent = `${Math.min(cur.lap + 1, engine.totalLaps)}/${engine.totalLaps}`;

  const sailPill = document.getElementById('pill-sail');
  sailPill.querySelector('.pill-v').textContent = pos.name;
  sailPill.dataset.tone = pos.tone || '';

  document.getElementById('pill-heading').querySelector('.pill-v').textContent = pad3(Math.round(cur.heading)) + '°';
  document.getElementById('pill-mark').querySelector('.pill-v').textContent = `${(cur.currentMark % engine.course.marks.length) + 1}/${engine.course.marks.length}`;

  // Action buttons
  const isMyTurn = !cur.isAI && (!state.online || cur.netId === myPeerId());
  document.getElementById('btn-roll').hidden = !(isMyTurn && engine.phase === 'rolling' && !rollPending);
  document.getElementById('btn-end-turn').hidden = !(isMyTurn && engine.phase === 'event');
  document.getElementById('btn-rest').hidden = !(isMyTurn && engine.phase === 'heading' && cur.crewStamina < 50);
  const headingPrompt = document.getElementById('heading-prompt');
  headingPrompt.hidden = !(isMyTurn && engine.phase === 'heading');
}

function pad3(n) { return String(n).padStart(3, '0'); }

function toast(text, icon = '⛵') {
  const t = document.getElementById('toast');
  document.getElementById('toast-text').textContent = text;
  document.getElementById('toast-icon').textContent = icon;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 2400);
}

// ---- Online sync ----
function pushOnlineState() {
  if (!state.online) return;
  if (state.net?.role !== 'host') return;
  state.net.send({ kind: 'state', state: serializeEngine() });
}
function serializeEngine() {
  return {
    players: engine.players.map(p => ({ ...p, color: undefined, colorIndex: p.colorIndex })),
    currentPlayerIndex: engine.currentPlayerIndex,
    windDirection: engine.windDirection,
    windStrength: engine.windStrength,
    turnNumber: engine.turnNumber,
    phase: engine.phase,
    finishOrder: engine.finishOrder,
    courseName: engine.courseName,
    totalLaps: engine.totalLaps,
    difficulty: engine.difficulty,
    squallActive: engine.squallActive, squallTurns: engine.squallTurns,
    timeOfDay: engine.timeOfDay, tideState: engine.tideState, tideCycle: engine.tideCycle,
    weatherState: engine.weatherState, weatherTimer: engine.weatherTimer
  };
}
function applyRemoteState(st) {
  if (!engine) return;
  engine.courseName = st.courseName;
  engine.course = COURSES[st.courseName] || engine.course;
  engine.totalLaps = st.totalLaps;
  engine.difficulty = st.difficulty;
  engine.windDirection = st.windDirection;
  engine.windStrength = st.windStrength;
  engine.turnNumber = st.turnNumber;
  engine.phase = st.phase;
  engine.currentPlayerIndex = st.currentPlayerIndex;
  engine.finishOrder = st.finishOrder || [];
  engine.squallActive = st.squallActive; engine.squallTurns = st.squallTurns;
  engine.timeOfDay = st.timeOfDay; engine.tideState = st.tideState; engine.tideCycle = st.tideCycle;
  engine.weatherState = st.weatherState; engine.weatherTimer = st.weatherTimer;
  engine.players = st.players.map((p) => ({
    ...p,
    color: YACHT_COLORS[p.colorIndex] || YACHT_COLORS[0],
    animX: p.x, animY: p.y, animHeading: p.heading,
    isMoving: false, lastMoveDistance: 0,
    trail: p.trail || []
  }));
  syncUI();
}

function addChat(name, text) {
  const log = document.getElementById('chat-log');
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `<span class="who">${escape(name)}</span><span class="text">${escape(text)}</span>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  chatLog.push({ name, text });
}

// ---- Finish ----
function finishRace() {
  sfx.victory();
  document.getElementById('btn-roll').hidden = true;
  document.getElementById('btn-end-turn').hidden = true;
  document.getElementById('btn-rest').hidden = true;

  // Update career stats (for any human player who finished on the podium)
  const stats = loadStats();
  stats.races += 1;
  const ranked = engine.getStandings();
  ranked.forEach((p, i) => {
    if (!p.isAI && i === 0) stats.wins += 1;
    if (!p.isAI && i < 3)  stats.podiums += 1;
  });
  stats.distance += Math.round(engine.players.reduce((s, p) => s + p.totalDistance, 0));
  stats.marksRounded += engine.players.reduce((s, p) => s + p.currentMark + p.lap * engine.course.marks.length, 0);
  stats.eventsDrawn += engine.players.reduce((s, p) => s + p.cardsDrawn, 0);
  saveStats(stats);

  // Render finish screen
  const podium = document.getElementById('podium');
  podium.innerHTML = '';
  const top3 = ranked.slice(0, 3);
  // Reorder to: 2nd, 1st, 3rd for visual podium
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  order.forEach((p, i) => {
    const realRank = ranked.indexOf(p) + 1;
    const div = document.createElement('div');
    div.className = `podium-place podium-place--${realRank}`;
    div.innerHTML = `
      <span class="pp-color" style="background:${p.color.hex}"></span>
      <span class="pp-rank">${realRank === 1 ? '🥇' : realRank === 2 ? '🥈' : '🥉'}</span>
      <span class="pp-name">${escape(p.name)}</span>
      <span class="pp-class">${YACHT_CLASSES[p.yachtClass].name}</span>
    `;
    podium.appendChild(div);
  });

  const fs = document.getElementById('finish-stats');
  fs.innerHTML = `
    <div class="stat-tile"><span class="v">${engine.turnNumber}</span><span class="k">Turns</span></div>
    <div class="stat-tile"><span class="v">${ranked[0].totalRolls}</span><span class="k">Winning Rolls</span></div>
    <div class="stat-tile"><span class="v">${ranked.reduce((s, p) => s + p.cardsDrawn, 0)}</span><span class="k">Event Cards</span></div>
    <div class="stat-tile"><span class="v">${ranked.reduce((s, p) => s + p.tacksPerformed, 0)}</span><span class="k">Tacks</span></div>
  `;
  document.getElementById('finish-sub').textContent =
    ranked[0].isAI ? `${ranked[0].name} takes the trophy.` : `${ranked[0].name} crosses the line first!`;

  setTimeout(() => gotoScreen('finish'), 1200);
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
