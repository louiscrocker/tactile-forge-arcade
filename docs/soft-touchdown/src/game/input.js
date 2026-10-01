// =====================================================
// Tactile Forge — Lunar Lander · Input controller
// Keyboard: A/D or ←/→ rotate, W/↑/Space thrust, P/Esc pause.
//
// Listeners are global (the canvas isn't focusable), so the controller stays
// disabled until a mission is running. That keeps Space and the arrow keys
// usable in the briefing form instead of being swallowed as flight controls.
// =====================================================

/** True when the key event is destined for a text field, not the game. */
function isTextTarget(e) {
  const t = e.target;
  if (!t || t.nodeType !== 1) return false;
  if (t.isContentEditable) return true;
  return /^(input|textarea|select)$/i.test(t.tagName);
}

export class Input {
  constructor() {
    this.keys = new Set();
    this.pausePressed = false;
    this._spaceHeld = false;
    this.enabled = false;

    window.addEventListener('keydown', e => {
      if (!this.enabled || isTextTarget(e)) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === ' ' || e.code === 'Space') {
        // Treat space as thrust held; consume to prevent page-scroll.
        this._spaceHeld = true;
        e.preventDefault();
      }
      if (k === 'arrowup' || k === 'arrowleft' || k === 'arrowright' || k === 'arrowdown') {
        e.preventDefault();
      }
      if (k === 'p' || k === 'escape') this.pausePressed = true;
    });

    // Key releases are always honoured, even if the controller was disabled
    // mid-press — otherwise a key held across a state change stays "down".
    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === ' ' || e.code === 'Space') {
        this._spaceHeld = false;
      }
    });

    // Release everything on tab blur — avoids stuck-key drifts
    window.addEventListener('blur', () => this.reset());
  }

  /** Start accepting flight input. Clears anything buffered beforehand. */
  enable() {
    this.reset();
    this.enabled = true;
  }

  /** Stop accepting flight input (menus, debrief, aborted mission). */
  disable() {
    this.enabled = false;
    this.reset();
  }

  /** Drop all held keys and pending edge-triggered events. */
  reset() {
    this.keys.clear();
    this._spaceHeld = false;
    this.pausePressed = false;
  }

  /** Per-frame intents. Returns { thrust, rotate } where rotate is -1, 0, +1. */
  read() {
    const k = this.keys;
    const thrust =
      this._spaceHeld ||
      k.has('w') || k.has('arrowup');
    let rotate = 0;
    if (k.has('a') || k.has('arrowleft'))  rotate -= 1;
    if (k.has('d') || k.has('arrowright')) rotate += 1;
    return { thrust: thrust ? 1 : 0, rotate };
  }

  /** Drain edge-triggered events; call once per frame. */
  drain() {
    const p = this.pausePressed; this.pausePressed = false;
    return { pause: p };
  }
}
