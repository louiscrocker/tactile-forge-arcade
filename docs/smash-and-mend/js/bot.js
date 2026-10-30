/* ============================================================
   bot.js — a computer player for each character.  smoke.js uses
   it to play every level in Node; the title screen uses it for
   the attract-mode demo.  It reads the level and returns inputs,
   exactly like a child's keyboard would.
   ============================================================ */
'use strict';

const Bot = {
  make(type) { return { type, frame: 0, lastX: 0, lastY: 0, still: 0, unstick: 0, dir: 1 }; },
  input(L, a, m) {
    m.frame++;
    /* timers run on the level's clock, so a slow poller (the browser test) sees the same behaviour */
    const dt = m.lastT === undefined ? STEP : clamp(L.time - m.lastT, 0, .5); m.lastT = L.time; m.dt = dt;
    const moved = Math.hypot(a.x - m.lastX, a.y - m.lastY);
    m.still = moved < .5 ? m.still + dt : 0; m.lastX = a.x; m.lastY = a.y;
    return a.type === 'mungo' ? this.mungo(L, a, m) : this.pip(L, a, m);
  },

  mungo(L, a, m) {
    const i = { left: false, right: false, up: false, down: false, upP: false, downP: false, jumpP: false, actionP: false };
    if (a.dizzy > 0 || L.smashDone) return i;
    const tap = m.frame % 3 === 0;
    /* the wrecking ball: punch it when it swings in */
    const B = L.ball;
    if (B && !B.calm) {
      const vx = B.L * B.w * Math.cos(B.th), dx = B.x - a.x;
      if (Math.abs(dx) < 150 && Math.abs(B.y - (a.y - a.h / 2)) < 90 && Math.sign(vx) === -Math.sign(dx)) {
        if (Math.sign(dx) !== a.face) { if (dx > 0) i.right = true; else i.left = true; }
        else i.actionP = tap;
        return i;
      }
      /* early on, wait under the crane for the ball: punching it back does the smashing */
      if (L.ballPunches < 3 && L.time < 60) {
        const wx = B.ax - 40;
        if (a.y < GROUND_Y - 2 || Math.abs(a.x - wx) > 12) { if (wx > a.x) i.right = true; else i.left = true; }
        else if (a.face < 0 !== (B.x < a.x)) { if (B.x < a.x) i.left = true; else i.right = true; }
        return i;
      }
    }
    /* target: the highest block left, nearest first */
    let tc = -1, tr = ROWS, best = 1e9;
    for (let r = 0; r < ROWS && tc < 0; r++) for (let c = 0; c < L.cols; c++) if (L.cell[L.idx(c, r)]) { const d = Math.abs((c + .5) * CELL - a.x); if (d < best) { best = d; tc = c; tr = r; } }
    if (tc < 0) return i;
    const tx = (tc + .5) * CELL, ty = tr * CELL, dx = tx - a.x;
    if (m.unstick > 0) { m.unstick -= m.dt; if (m.dir > 0) i.right = true; else i.left = true; i.actionP = tap; i.jumpP = m.frame % 20 === 0; return i; }
    if (m.still > 1.6 && !a.climbing) { m.still = 0; m.unstick = .6; m.dir = dx >= 0 ? 1 : -1; if (Math.abs(dx) < 10) m.dir = m.frame % 2 ? 1 : -1; return i; }
    if (a.climbing && m.still > .4) { i.up = true; i.actionP = tap; return i; }   // a ceiling above: punch up through it
    const level = Math.abs(a.y - ty) < 3 && a.onGround;
    if (level && Math.abs(dx) < 22) { i.down = true; i.actionP = tap; return i; }
    if (a.y < ty - 3) { if (dx > 0) i.right = true; else i.left = true; return i; }
    /* walk toward the target; a block in the way: climb it if it is the building's side, punch it if low */
    const go = Math.abs(dx) < 6 ? 0 : Math.sign(dx);
    if (go > 0) i.right = true; else if (go < 0) i.left = true;
    if (go && a.face === go && L.wallBeside(a, go, false)) {
      if (a.y > ty + 3) i.up = true; else i.actionP = tap;
    } else if (!go && a.y > ty + 3) {
      /* right under the target column: climb whichever side has a wall, else punch up */
      if (L.wallBeside(a, a.face, false)) i.up = true; else if (L.wallBeside(a, -a.face, false)) { if (a.face > 0) i.left = true; else i.right = true; i.up = true; }
      else { i.up = true; i.actionP = tap; }
    }
    return i;
  },

  pip(L, a, m) {
    const i = { left: false, right: false, up: false, down: false, upP: false, downP: false, jumpP: false, actionP: false };
    if (a.dizzy > 0 || L.mendDone) return i;
    const H = L.house, tap = m.frame % 3 === 0;
    /* something about to land on my head? bucket up */
    if (a.onGround && !a.onLadder) {
      for (const t of L.things) {
        const T = THINGS[t.kind]; if (!T) continue;
        const head = a.y - a.h, eta = (head - t.y) / Math.max(80, t.vy + 100);
        if (eta > 0 && eta < .9 && Math.abs(L.landingX(t, head) - a.x) < 22) { i.down = true; return i; }
      }
    }
    let f = null, best = 1e9;
    const myS = a.onGround ? Math.round((GROUND_Y - a.y) / (3 * CELL)) : -1;
    for (const q of H.fixes) if (!q.fixed) { const cost = Math.abs(q.s - (myS < 0 ? q.s : myS)) * 500 + Math.abs(q.x - a.x); if (cost < best) { best = cost; f = q; } }
    if (!f) return i;
    const fy = L.floorY(f.s);
    if (a.onGround && !a.onLadder && Math.abs(a.y - fy) < 3) {
      if (L.fixInReach(a) === f) { i.actionP = tap; return i; }
      if (f.x > a.x + 8) i.right = true; else if (f.x < a.x - 8) i.left = true;
      else i.actionP = tap;
      return i;
    }
    /* change storeys by the nearest drainpipe */
    let lx = null, bd = 1e9;
    for (const lc of L.def.ladders) { const x = (H.x0 + lc + .5) * CELL, d = Math.abs(x - a.x) + Math.abs(x - f.x) * .3; if (d < bd) { bd = d; lx = x; } }
    if (a.onLadder) {
      if (Math.abs(a.y - fy) < 3) { if (f.x > a.x) i.right = true; else i.left = true; }
      else if (a.y > fy) i.up = true; else i.down = true;
      if (m.still > 1.5) { i.jumpP = true; m.still = 0; }
      return i;
    }
    if (Math.abs(lx - a.x) > 6) { if (lx > a.x) i.right = true; else i.left = true; }
    else if (a.y > fy) i.up = true; else i.down = true;
    if (m.still > 2) { i.jumpP = true; m.still = 0; }
    return i;
  }
};
