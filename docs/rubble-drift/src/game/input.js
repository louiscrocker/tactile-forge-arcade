// =====================================================
// Tactile Forge — Asteroids · Input controller
// Keyboard only — matches the original cabinet's button rail.
//   A / ←      rotate left
//   D / →      rotate right
//   W / ↑      thrust
//   Space      fire (held = repeat at engine cooldown)
//   Shift      hyperspace (one-shot per press)
//   P / Esc    pause
// Held-state flags drained by the engine each tick; one-shots are queues.
//
// The listeners are global (the canvas can't hold focus while the HUD does),
// so two guards keep them from hijacking the rest of the app:
//   `enabled`  — only true between engine start() and stop(); otherwise a key
//                pressed on the title screen would sit in a queue and fire on
//                the first frame of the next sortie.
//   isTyping() — never swallow keys aimed at the call-sign or initials fields.
// =====================================================

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
    this.reset();

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || isTyping(e)) return;
      if (e.repeat) {
        // Allow rotation/thrust to be held; ignore repeat noise for one-shots
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'p' || k === 'escape') {
        this.pausePressed = true;
        e.preventDefault();
        return;
      }
      if (k === 'a' || k === 'arrowleft')  { this.rotLeft  = true; e.preventDefault(); return; }
      if (k === 'd' || k === 'arrowright') { this.rotRight = true; e.preventDefault(); return; }
      if (k === 'w' || k === 'arrowup')    { this.thrust   = true; e.preventDefault(); return; }
      if (k === ' ' || k === 'spacebar' || k === 'space') {
        this.fireHeld = true;
        this.fireQueue += 1;
        e.preventDefault();
        return;
      }
      if (k === 'shift') {
        this.hyperQueue += 1;
        e.preventDefault();
        return;
      }
    });

    // Key-up is not gated on `enabled`: a key held when the game stops must
    // still clear, or the flag stays stuck for the next sortie.
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft')  { this.rotLeft  = false; return; }
      if (k === 'd' || k === 'arrowright') { this.rotRight = false; return; }
      if (k === 'w' || k === 'arrowup')    { this.thrust   = false; return; }
      if (k === ' ' || k === 'spacebar' || k === 'space') {
        this.fireHeld = false;
        return;
      }
    });

    window.addEventListener('blur', () => this.reset());
  }

  /** Drop every held flag and queued one-shot. */
  reset() {
    this.rotLeft   = false;
    this.rotRight  = false;
    this.thrust    = false;
    this.fireHeld  = false;
    this.fireQueue = 0;     // counted edge-triggers (so a tap always fires once)
    this.hyperQueue = 0;
    this.pausePressed = false;
  }

  drainFire()  { const n = this.fireQueue;  this.fireQueue  = 0; return n; }
  drainHyper() { const n = this.hyperQueue; this.hyperQueue = 0; return n; }
}
