// =====================================================
// Tactile Forge — Setup screen UI
// =====================================================

import { state, bus } from '../state.js';
import { YACHT_COLORS, YACHT_CLASSES, COURSES, DEFAULT_NAMES } from '../game/constants.js';
import { sfx } from '../audio/audio.js';

let openColorPop = null;

export function bindSetup() {
  // Player count
  const pc = document.getElementById('player-count');
  pc.addEventListener('click', (e) => {
    const t = e.target.closest('.seg'); if (!t) return;
    [...pc.children].forEach(b => b.classList.remove('is-active'));
    t.classList.add('is-active');
    const n = +t.dataset.value;
    state.setup.playerCount = n;
    syncPlayerArray(n);
    renderPlayers();
    sfx.click();
  });

  // Laps
  const laps = document.getElementById('laps');
  laps.addEventListener('click', (e) => {
    const t = e.target.closest('.seg'); if (!t) return;
    [...laps.children].forEach(b => b.classList.remove('is-active'));
    t.classList.add('is-active');
    state.setup.laps = +t.dataset.value;
    sfx.click();
  });

  // Difficulty
  const diff = document.getElementById('difficulty');
  diff.addEventListener('click', (e) => {
    const t = e.target.closest('.seg'); if (!t) return;
    [...diff.children].forEach(b => b.classList.remove('is-active'));
    t.classList.add('is-active');
    state.setup.difficulty = t.dataset.value;
    sfx.click();
  });

  // Courses
  renderCourses();

  // Start button
  document.getElementById('btn-start-race').addEventListener('click', () => {
    sfx.bell();
    bus.emit('start-game');
  });

  // Initial render
  syncPlayerArray(state.setup.playerCount);
  renderPlayers();

  // Close color pop on outside click
  document.addEventListener('click', (e) => {
    if (openColorPop && !e.target.closest('.color-pop') && !e.target.closest('.player-color')) {
      openColorPop.remove();
      openColorPop = null;
    }
  });
}

function syncPlayerArray(n) {
  const cur = state.setup.players;
  while (cur.length < n) {
    const idx = cur.length;
    cur.push({
      name: DEFAULT_NAMES[idx] || `Skipper ${idx + 1}`,
      colorIndex: idx % YACHT_COLORS.length,
      yachtClass: 'allrounder',
      isAI: idx > 0
    });
  }
  while (cur.length > n) cur.pop();
}

function renderPlayers() {
  const root = document.getElementById('player-list');
  root.innerHTML = '';
  state.setup.players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-item';
    row.innerHTML = `
      <span class="player-color" style="background:${YACHT_COLORS[p.colorIndex].hex}"></span>
      <input class="player-name" type="text" maxlength="14" value="${escape(p.name)}" />
      <select class="player-class">
        ${Object.values(YACHT_CLASSES).map(c =>
          `<option value="${c.key}"${c.key === p.yachtClass ? ' selected' : ''}>${c.name}</option>`
        ).join('')}
      </select>
      <button class="player-ai${p.isAI ? ' is-ai' : ''}">${p.isAI ? 'AI' : 'Human'}</button>
    `;
    root.appendChild(row);

    row.querySelector('.player-name').addEventListener('input', (e) => { p.name = e.target.value; });
    row.querySelector('.player-class').addEventListener('change', (e) => { p.yachtClass = e.target.value; sfx.click(); });
    row.querySelector('.player-ai').addEventListener('click', (e) => {
      p.isAI = !p.isAI;
      e.currentTarget.classList.toggle('is-ai', p.isAI);
      e.currentTarget.textContent = p.isAI ? 'AI' : 'Human';
      sfx.click();
    });
    row.querySelector('.player-color').addEventListener('click', (e) => {
      e.stopPropagation();
      openColorPicker(e.currentTarget, p, () => renderPlayers());
    });
  });
}

function openColorPicker(anchor, player, onChange) {
  if (openColorPop) { openColorPop.remove(); openColorPop = null; }
  const pop = document.createElement('div');
  pop.className = 'color-pop';
  YACHT_COLORS.forEach((c, idx) => {
    const taken = state.setup.players.some(pp => pp !== player && pp.colorIndex === idx);
    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = c.hex;
    if (idx === player.colorIndex) dot.style.borderColor = '#fff';
    if (taken) dot.style.opacity = '.3';
    dot.title = c.name;
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      if (taken) return;
      player.colorIndex = idx;
      pop.remove();
      openColorPop = null;
      onChange();
      sfx.click();
    });
    pop.appendChild(dot);
  });
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = (r.left + window.scrollX) + 'px';
  pop.style.top  = (r.bottom + window.scrollY + 6) + 'px';
  openColorPop = pop;
}

function renderCourses() {
  const grid = document.getElementById('course-grid');
  grid.innerHTML = '';
  Object.values(COURSES).forEach((c) => {
    const card = document.createElement('div');
    card.className = 'course-card' + (c.key === state.setup.course ? ' is-active' : '');
    card.innerHTML = `
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        ${(c.islands || []).map(isl =>
          `<ellipse cx="${isl.x*100}" cy="${isl.y*100}" rx="${isl.rx*100}" ry="${isl.ry*100}"
                    fill="#5e4a26" opacity=".7" transform="rotate(${isl.rotation || 0} ${isl.x*100} ${isl.y*100})"/>`
        ).join('')}
        ${(c.shallows || []).map(s =>
          `<circle cx="${s.x*100}" cy="${s.y*100}" r="${s.r*100}" fill="rgba(245,212,134,.18)" stroke="rgba(245,212,134,.45)" stroke-dasharray="2,2"/>`
        ).join('')}
        ${c.marks.map((m, i, all) => {
          const next = all[(i + 1) % all.length];
          return `<line x1="${m.x*100}" y1="${m.y*100}" x2="${next.x*100}" y2="${next.y*100}" stroke="rgba(245,212,134,.35)" stroke-dasharray="2,3" stroke-width=".5"/>`;
        }).join('')}
        ${c.marks.map(m => {
          const fill = m.type === 'start' ? '#f5d486' : m.type === 'red' ? '#e74c3c' : '#27ae60';
          return `<circle cx="${m.x*100}" cy="${m.y*100}" r="2.4" fill="${fill}" stroke="#0a1628" stroke-width=".6"/>`;
        }).join('')}
      </svg>
      <span class="course-name">${c.name}</span>
    `;
    card.addEventListener('click', () => {
      grid.querySelectorAll('.course-card').forEach(x => x.classList.remove('is-active'));
      card.classList.add('is-active');
      state.setup.course = c.key;
      sfx.click();
    });
    grid.appendChild(card);
  });
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
