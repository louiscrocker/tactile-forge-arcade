// =====================================================
// Tactile Forge — Tank Battle · Input controller
// Keyboard-only:
//   W / ↑          drive forward
//   S / ↓          reverse
//   A / ←          rotate hull left
//   D / →          rotate hull right
//   Space          fire main gun
//   P / Esc        pause
// State is polled each frame; fire is queued (consumed once).
//
// The listeners are global (the canvas can't hold focus while the HUD does),
// so two guards keep them from hijacking the rest of the app:
//   `enabled`  — only true between engine start() and stop(); otherwise a key
//                pressed on the title screen would sit latched and fire on the
//                first frame of the next sortie.
//   isTyping() — never swallow keys aimed at the call-sign field.
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
    this.keys = new Set();
    this.reset();

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || isTyping(e)) return;
      const k = e.key.toLowerCase();
      // Ignore repeats for one-shot keys
      if (k === ' ' || k === 'space') {
        if (!e.repeat) this.firePressed = true;
        e.preventDefault();
        return;
      }
      if (k === 'p' || k === 'escape') {
        if (!e.repeat) this.pausePressed = true;
        e.preventDefault();
        return;
      }
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
      }
    });

    // Key-up is not gated on `enabled`: a key held when the sortie stops must
    // still clear, or it stays stuck in `keys` for the next sortie.
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('blur', () => this.reset());
  }

  /** Drop every held key and latched one-shot. */
  reset() {
    this.keys.clear();
    this.firePressed = false;
    this.pausePressed = false;
  }

  isDown(...keys) {
    for (const k of keys) if (this.keys.has(k)) return true;
    return false;
  }

  // Drive: -1 reverse, 0, +1 forward
  driveAxis() {
    let v = 0;
    if (this.isDown('w', 'arrowup')) v += 1;
    if (this.isDown('s', 'arrowdown')) v -= 1;
    return v;
  }

  // Turn: -1 left, +1 right (world heading: positive = clockwise from +Z)
  turnAxis() {
    let v = 0;
    if (this.isDown('d', 'arrowright')) v += 1;
    if (this.isDown('a', 'arrowleft')) v -= 1;
    return v;
  }

  // Consume fire latch
  drainFire() {
    if (this.firePressed) { this.firePressed = false; return true; }
    return false;
  }
}
