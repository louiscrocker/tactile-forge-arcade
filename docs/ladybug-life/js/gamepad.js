/* ============================================================
   gamepad.js — controllers for one or two players
   ============================================================
   Polled every frame.  Left stick / d-pad moves, A is the action
   button (hatch, chew, pupate, fly, land), B lays eggs, X takes a
   photo, Y opens the microscope.  Pad 0 drives player 1 and pad 1
   drives player 2 unless the settings swap them.
   ============================================================ */
'use strict';

const Gamepads = {
  prev: [{}, {}],
  connected: 0,

  poll() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    this.connected = pads.length;
    const out = [];
    pads.slice(0, 2).forEach((gp, i) => {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const b = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed);
      let x = Math.abs(ax) > .2 ? ax : 0, y = Math.abs(ay) > .2 ? ay : 0;
      if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
      const now = { a: b(0), b: b(1), x: b(2), y: b(3), start: b(9) };
      const was = this.prev[i] || {};
      out.push({
        x, y,
        action: now.a,
        actionPressed: now.a && !was.a,
        eggPressed: now.b && !was.b,
        photoPressed: now.x && !was.x,
        scopePressed: now.y && !was.y,
        startPressed: now.start && !was.start
      });
      this.prev[i] = now;
    });
    return out;
  }
};
