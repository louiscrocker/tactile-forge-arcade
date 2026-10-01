// =====================================================
// Tactile Forge — Missile Attack · Input controller
// PointerEvents unify mouse/touch/pen.
//   Mouse:        pointerdown fires immediately (cabinet feel).
//   Touch / pen:  pointerdown sets aim; pointermove drags it; pointerup fires.
// Z/X/C or 1/2/3 fire from a specific battery (keyboard).
// P / Esc pause. Crosshair is reported in canvas-CSS pixels.
//
// Keyboard is bound to `window` (the canvas can't hold focus reliably), so it
// is gated on `enabled` — the engine turns it on only while a mission is live
// and on-screen. Without that gate a call sign like "ZAP" would be swallowed
// by the fire/pause keys instead of reaching the text field.
// =====================================================

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = 0;
    this.mouseY = 0;
    this.fireQueue = [];           // { x, y, batteryHint }
    this.pausePressed = false;
    this.enabled = false;          // off until the engine starts a mission

    // Per-pointer state (touch may have multiple but we just track the active one)
    this._activeTouch = null;      // { id, downX, downY, downT }

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this._setMouse(e);
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      if (e.pointerType === 'mouse') {
        // Immediate fire on mouse click
        this.fireQueue.push({ x: this.mouseX, y: this.mouseY, batteryHint: null });
      } else {
        // Touch / pen: lock aim, defer fire until pointerup
        this._activeTouch = {
          id: e.pointerId,
          downX: this.mouseX,
          downY: this.mouseY,
          downT: performance.now(),
        };
      }
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (e.pointerType !== 'mouse' && this._activeTouch?.id !== e.pointerId) return;
      this._setMouse(e);
    });

    const releaseTouch = (e) => {
      if (e.pointerType === 'mouse') return;
      if (this._activeTouch?.id !== e.pointerId) return;
      this._setMouse(e);
      if (this.enabled) {
        this.fireQueue.push({ x: this.mouseX, y: this.mouseY, batteryHint: null });
      }
      this._activeTouch = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    };
    canvas.addEventListener('pointerup', releaseTouch);
    canvas.addEventListener('pointercancel', (e) => {
      if (this._activeTouch?.id === e.pointerId) this._activeTouch = null;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Suppress page-scroll on touch over the canvas
    canvas.style.touchAction = 'none';

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      // Never steal keys from a text field or a browser/OS shortcut.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target?.closest?.(EDITABLE)) return;

      const k = e.key.toLowerCase();
      if (k === 'p' || k === 'escape') {
        this.pausePressed = true;
        e.preventDefault();
        return;
      }
      let hint = null;
      if (k === 'z' || k === '1') hint = 0;
      else if (k === 'x' || k === '2') hint = 1;
      else if (k === 'c' || k === '3') hint = 2;
      if (hint !== null) {
        this.fireQueue.push({ x: this.mouseX, y: this.mouseY, batteryHint: hint });
        e.preventDefault();
      }
    });

    window.addEventListener('blur', () => this.reset());
  }

  /** Gameplay input only listens while a mission is live and on-screen. */
  setEnabled(on) {
    this.enabled = !!on;
    if (!on) this.reset();
  }

  /** Drop any queued intent so it can't leak into the next mission. */
  reset() {
    this.pausePressed = false;
    this.fireQueue.length = 0;
    this._activeTouch = null;
  }

  _setMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - r.left;
    this.mouseY = e.clientY - r.top;
  }

  drainFire() {
    const out = this.fireQueue.slice();
    this.fireQueue.length = 0;
    return out;
  }
}
