// =====================================================
// Tactile Forge — TRON · Input controller
// Keyboard only — arrows/WASD steer, Space boosts, P/Esc pauses.
// Direction encoding: 0=right, 1=down, 2=left, 3=up.
// Reverse moves are ignored (a 180° turn would derez instantly anyway).
//
// The listeners are global (the canvas can't hold focus while the HUD does),
// so two guards keep them from hijacking the rest of the app:
//   `enabled`  — only true between engine start() and stop(); otherwise a key
//                pressed on the title screen would sit in a queue and fire on
//                the first frame of the next run.
//   isTyping() — never swallow keys aimed at the call-sign or initials fields.
// =====================================================

const DIR_RIGHT = 0, DIR_DOWN = 1, DIR_LEFT = 2, DIR_UP = 3;

/** True when the event targets a text field, so game keys must stay hands-off. */
function isTyping(e) {
  const t = e.target;
  if (!t || !t.tagName) return false;
  const tag = t.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
}

export class Input {
  constructor() {
    this.enabled = false;
    this.turnQueue = [];     // queued direction ints (drained per tick)
    this.reset();

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || isTyping(e)) return;
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'p' || k === 'escape') {
        this.pausePressed = true;
        e.preventDefault();
        return;
      }
      let dir = -1;
      if (k === 'arrowright' || k === 'd') dir = DIR_RIGHT;
      else if (k === 'arrowdown'  || k === 's') dir = DIR_DOWN;
      else if (k === 'arrowleft'  || k === 'a') dir = DIR_LEFT;
      else if (k === 'arrowup'    || k === 'w') dir = DIR_UP;
      if (dir >= 0) {
        // Cap queue depth so a mash doesn't queue indefinitely.
        if (this.turnQueue.length < 2) this.turnQueue.push(dir);
        e.preventDefault();
        return;
      }
      if (k === ' ' || k === 'spacebar') {
        this.boostHeld = true;
        e.preventDefault();
      }
    });

    // Key-up is not gated on `enabled`: a key held when the run stops must
    // still clear, or the flag stays stuck for the next run.
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'spacebar') this.boostHeld = false;
    });

    window.addEventListener('blur', () => this.reset());
  }

  /** Drop every held flag and queued one-shot. */
  reset() {
    this.boostHeld = false;
    this.turnQueue.length = 0;
    this.pausePressed = false;
  }

  /** Drain the next queued turn (or -1 if none). */
  consumeTurn() {
    if (this.turnQueue.length === 0) return -1;
    return this.turnQueue.shift();
  }
}
