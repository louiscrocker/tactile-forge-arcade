/* ============================================================
   input.js — keyboard, touch buttons and gamepads, turned into
   one input object per player each tick.  Only live while a
   level is being played (Input.enabled); never while typing in a
   field; everything is dropped on pause, blur and tab-hide.
   ============================================================ */
'use strict';

const KEYMAP = {
  one: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], jump: ['Space'], action: ['KeyX', 'KeyJ', 'KeyF', 'Enter', 'NumpadEnter'] },
  p1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['Space'], action: ['KeyF', 'KeyG', 'KeyE'] },
  p2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['ShiftRight', 'Numpad0'], action: ['KeyL', 'KeyK', 'Enter', 'Slash', 'NumpadEnter'] }
};
const GAME_CODES = new Set(Object.values(KEYMAP).flatMap(m => Object.values(m).flat()));

const Input = {
  enabled: false, coop: false,
  held: new Set(), pressed: new Set(),
  touchHeld: [new Set(), new Set()], touchPressed: [new Set(), new Set()],
  padPrev: [{}, {}],
  typing(e) { const t = e.target; if (!t || !t.tagName) return false; if (t.tagName === 'TEXTAREA' || t.isContentEditable) return true; return t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type); },
  keydown(e) {
    if (!this.enabled || this.typing(e)) return false;
    if (!GAME_CODES.has(e.code)) return false;
    e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.held.add(e.code);
    return true;
  },
  keyup(e) { this.held.delete(e.code); },
  reset() { this.held.clear(); this.pressed.clear(); for (const s of this.touchHeld) s.clear(); for (const s of this.touchPressed) s.clear(); document.querySelectorAll('.pad button.down').forEach(b => b.classList.remove('down')); },

  bindPad(root) {
    const map = new Map();
    const down = (e) => {
      const b = e.target.closest('button[data-k]'); if (!b) return;
      e.preventDefault();
      const p = +b.closest('.cluster').dataset.p, k = b.dataset.k;
      map.set(e.pointerId, { p, k, b }); b.classList.add('down');
      if (this.enabled) { this.touchHeld[p].add(k); this.touchPressed[p].add(k); }
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    };
    const up = (e) => { const m = map.get(e.pointerId); if (!m) return; map.delete(e.pointerId); m.b.classList.remove('down'); this.touchHeld[m.p].delete(m.k); };
    root.addEventListener('pointerdown', down);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(ev, up);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  /* one input object per player; pads = Gamepads.poll() */
  read(n, pads) {
    const out = [];
    for (let p = 0; p < n; p++) {
      const M = n > 1 ? (p === 0 ? KEYMAP.p1 : KEYMAP.p2) : KEYMAP.one;
      const h = (k) => M[k].some(c => this.held.has(c)) || this.touchHeld[p].has(k);
      const pr = (k) => M[k].some(c => this.pressed.has(c)) || this.touchPressed[p].has(k);
      const i = { left: h('left'), right: h('right'), up: h('up'), down: h('down'), upP: pr('up'), downP: pr('down'), jumpP: pr('jump'), actionP: pr('action') };
      const g = pads && pads[p];
      if (g && this.enabled) {
        const was = this.padPrev[p];
        const up = g.y < -.5, dn = g.y > .5;
        i.left = i.left || g.x < -.4; i.right = i.right || g.x > .4; i.up = i.up || up; i.down = i.down || dn;
        i.upP = i.upP || (up && !was.up); i.downP = i.downP || (dn && !was.dn);
        i.jumpP = i.jumpP || g.actionPressed; i.actionP = i.actionP || g.eggPressed || g.photoPressed || g.scopePressed;
        this.padPrev[p] = { up, dn };
      }
      out.push(i);
    }
    this.pressed.clear(); for (const s of this.touchPressed) s.clear();
    return out;
  }
};
