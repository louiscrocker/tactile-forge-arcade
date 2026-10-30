/* ============================================================
   smash.js — what holds up what.  Blocks no longer connected
   to the street fall as one chunk; a chunk that drops two rows
   or more crumbles its bottom row when it lands, and scatters
   rubble wider the further it fell.  Rubble that lands outside
   the lot is dust on the neighbours (the tidy star).
   ============================================================ */
'use strict';

Object.assign(Level.prototype, {
  settle() {
    /* support: a block resting on a column down to the street costs 0; every step sideways
       (or hanging down) costs 1, through a steel beam only a third.  More than SPAN and it falls:
       so a long overhang breaks off, but a steel beam carries a wide floor. */
    const C = this.cols, n = this.cell.length, seen = new Uint8Array(n), cost = new Float32Array(n).fill(99), q = [], SPAN = 3, steel = matCode('X');
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let c = 0; c < C; c++) { const k = this.idx(c, ROWS - 1); if (this.cell[k]) { cost[k] = 0; q.push(k); } }
    for (let h = 0; h < q.length; h++) {
      const k = q[h], c = k % C, r = (k / C) | 0;
      for (const [dc, dr] of N4) {
        const cc = c + dc, rr = r + dr; if (!this.inside(cc, rr)) continue;
        const kk = this.idx(cc, rr); if (!this.cell[kk]) continue;
        const step = dr < 0 ? 0 : dr > 0 ? 1 : (this.cell[kk] === steel && this.cell[k] === steel ? .34 : 1);
        const nc = cost[k] + step;
        if (nc < cost[kk] - 1e-6 && nc <= SPAN + 1e-6) { cost[kk] = nc; q.push(kk); }
      }
    }
    for (let k = 0; k < n; k++) if (cost[k] <= SPAN + 1e-6) seen[k] = 1;
    for (let k = 0; k < this.cell.length; k++) {
      if (!this.cell[k] || seen[k]) continue;
      const cells = [], st = [k]; seen[k] = 1;
      while (st.length) {
        const kk = st.pop(), c = kk % C, r = (kk / C) | 0;
        cells.push({ c, r, code: this.cell[kk], hp: this.hp[kk] });
        for (const [dc, dr] of N4) {
          const cc = c + dc, rr = r + dr; if (!this.inside(cc, rr)) continue;
          const k2 = this.idx(cc, rr); if (this.cell[k2] && !seen[k2]) { seen[k2] = 1; st.push(k2); }
        }
      }
      /* animals never ride a falling chunk: they hop out first */
      for (const b of cells) { const m = matOf(b.code); if (m.critter) { this.critterOut(b.c, b.r, m.critter); b.code = matCode('G'); b.hp = 1; } }
      for (const b of cells) { const kk = this.idx(b.c, b.r); this.cell[kk] = 0; this.hp[kk] = 0; }
      this.chunks.push({ cells, off: 0, vy: 0 });
      this.version++;
      this.emit('loose', { n: cells.length, x: (cells[0].c + .5) * CELL, y: cells[0].r * CELL });
    }
  },
  chunkDrop(ch) {
    const low = new Map();
    for (const b of ch.cells) if (!low.has(b.c) || b.r > low.get(b.c)) low.set(b.c, b.r);
    let drop = 99;
    for (const [c, r] of low) { let d = 0; while (r + d + 1 < ROWS && !this.cell[this.idx(c, r + d + 1)]) d++; drop = Math.min(drop, d); }
    return { drop, low };
  },
  chunkSet(ch, offRows) { const s = new Set(); for (const b of ch.cells) s.add(b.c + ',' + (b.r + offRows)); return s; },
  updateChunks(dt) {
    for (let n = this.chunks.length - 1; n >= 0; n--) {
      const ch = this.chunks[n];
      ch.vy = Math.min(ch.vy + 1900 * dt, 1300); ch.off += ch.vy * dt;
      const { drop, low } = this.chunkDrop(ch);
      const landed = ch.off >= drop * CELL;
      if (landed) ch.off = drop * CELL;
      for (const a of this.players) if (this.actorInCells(a, ch, ch.off)) this.eject(a, ch, ch.off, true);
      if (!landed) continue;
      this.chunks.splice(n, 1);
      const width = low.size, broken = new Set();
      for (const b of ch.cells) b.r += drop;
      if (drop >= 2) {
        const depth = drop >= 4 ? 2 : 1;
        for (const [c, r0] of low) for (let d = 0; d < depth; d++) { const r = r0 + drop - d, b = ch.cells.find(x => x.c === c && x.r === r); if (b) broken.add(b); }
      }
      for (const b of ch.cells) if (!broken.has(b)) { const k = this.idx(b.c, b.r); if (!this.cell[k]) { this.cell[k] = b.code; this.hp[k] = b.hp; } }
      const spread = 60 + 26 * drop + 7 * width;
      for (const b of broken) {
        const m = matOf(b.code); this.broken++; this.score += 5;
        for (let q = 0; q < 2; q++) this.addBit((b.c + .5) * CELL, (b.r + .5) * CELL, (this.rng() * 2 - 1) * spread, -150 - this.rng() * (100 + 30 * drop), m.color);
      }
      this.version++; this.crumbles++;
      this.hitStop = Math.max(this.hitStop, Math.min(.09, .02 + ch.cells.length * .003));
      let x0 = 1e9, x1 = -1e9, yb = 0; for (const b of ch.cells) { x0 = Math.min(x0, b.c); x1 = Math.max(x1, b.c + 1); yb = Math.max(yb, b.r + 1); }
      this.emit('crumble', { x: (x0 + x1) / 2 * CELL, y: yb * CELL, w: width, drop, n: ch.cells.length, broke: broken.size });
      for (const a of this.players) if (this.rectHitsSolid(a.x, a.y, a.w, a.h)) this.eject(a, null, 0, drop >= 2);
      this.settle();
    }
  },
  actorInCells(a, ch, off) {
    const x0 = a.x - a.w / 2 + 3, x1 = a.x + a.w / 2 - 3, y0 = a.y - a.h + 3, y1 = a.y - 3;
    for (const b of ch.cells) { const bx = b.c * CELL, by = b.r * CELL + off; if (x1 > bx && x0 < bx + CELL && y1 > by && y0 < by + CELL) return true; }
    return false;
  },
  /* push an actor sideways (or up on top) to the nearest free spot */
  eject(a, ch, off, bonk) {
    const e1 = ch ? this.chunkSet(ch, Math.floor(off / CELL)) : null, e2 = ch ? this.chunkSet(ch, Math.ceil(off / CELL)) : null;
    const free = (x, y) => !this.rectHitsSolid(x, y, a.w, a.h, e1) && !(e2 && this.rectHitsSolid(x, y, a.w, a.h, e2));
    let best = null;
    for (let k = 1; k <= 80 && !best; k++) for (const s of [-1, 1]) { const x = a.x + s * k * 8; if (x > a.w / 2 && x < this.W - a.w / 2 && free(x, a.y)) { best = [x, a.y]; break; } }
    if (!best) for (let k = 1; k <= 30 && !best; k++) if (free(a.x, a.y - k * CELL / 2)) best = [a.x, a.y - k * CELL / 2];
    if (best) { a.vx = Math.sign(best[0] - a.x) * 120; a.x = best[0]; a.y = best[1]; }
    a.vy = Math.min(a.vy, -200); a.climbing = false; a.onLadder = false; a.pound = false;
    if (bonk && a.dizzy <= 0 && (this.diff.chunkBonk || a.type !== 'mungo')) { a.dizzy = this.diff.dizzy; this.bonks++; this.emit('bonk', { who: a.type, x: a.x, y: a.y - a.h }); }
    else this.emit('boing', { who: a.type, x: a.x, y: a.y - a.h });
  },

  /* ---------- flying rubble ---------- */
  addBit(x, y, vx, vy, color) {
    if (this.bits.length > 420) this.bits.shift();
    this.bits.push({ x, y, vx, vy, rot: this.rng() * 6.3, vr: (this.rng() - .5) * 14, size: 5 + this.rng() * 8, color, landed: false, life: 2.5 + this.rng() * 2, used: false });
  },
  updateBits(dt) {
    const H = this.house;
    for (let n = this.bits.length - 1; n >= 0; n--) {
      const b = this.bits[n];
      if (!b.landed) {
        b.vy += 1400 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
        const c = Math.floor(b.x / CELL), r = Math.floor(b.y / CELL);
        const onBlock = b.vy > 0 && r >= 0 && r < ROWS && c >= 0 && c < this.cols && this.cell[this.idx(c, r)];
        if (b.y >= GROUND_Y - b.size / 2 || onBlock) {
          b.y = onBlock ? r * CELL - b.size / 2 : GROUND_Y - b.size / 2;
          if (Math.abs(b.vy) > 160) { b.vy *= -.28; b.vx *= .55; }
          else {
            b.landed = true; b.vx = 0; b.vy = 0;
            if (this.kind === 'smash' && (b.x < this.lot[0] * CELL || b.x > this.lot[1] * CELL)) { this.mess++; this.emit('mess', { x: b.x, y: b.y }); }
          }
        }
        if (b.x < 0 || b.x > this.W) { b.landed = true; b.life = 0; }
        /* in the team game a flying bit can crack a window next door */
        if (H && !b.used && b.x > H.x0 * CELL && b.x < (H.x0 + H.w) * CELL) {
          for (const f of H.fixes) if (Math.abs(b.x - f.x) < 20 && Math.abs(b.y - f.y) < 20) {
            b.used = true;
            if (f.fixed && this.time - f.since > 2.5 && this.rng() < [.2, .35, .5][this.diff.i]) this.rebreak(f, 'rubble');
            break;
          }
        }
      } else b.life -= dt;
      if (b.life <= 0) this.bits.splice(n, 1);
    }
  },
  updateCritters(dt) {
    for (let n = this.critters.length - 1; n >= 0; n--) {
      const k = this.critters[n]; k.t += dt;
      if (k.kind === 'pigeon') { k.vy -= 60 * dt; k.x += k.vx * dt; k.y += k.vy * dt; }
      else { k.vy += 1200 * dt; k.x += k.vx * dt; k.y += k.vy * dt; if (k.y > GROUND_Y) { k.y = GROUND_Y; k.vy = k.t < 1.5 ? -300 : 0; } }
      if (k.t > 6) this.critters.splice(n, 1);
    }
  },

  /* ---------- the runaway wrecking ball (boss) ---------- */
  makeBall() {
    const ax = (this.bx + this.bw + 2.5) * CELL, ay = (ROWS - this.bh - 3) * CELL;
    const L = GROUND_Y - 70 - ay;
    this.ball = { ax, ay, L, r: 34, th: .25, w: 0, x: ax, y: ay + L, hits: 0, calm: false };
  },
  updateBall(dt) {
    const B = this.ball; if (!B) return;
    const g = 1400, prevTh = B.th; B.safeT = Math.max(0, (B.safeT || 0) - dt);
    if (B.calm) { B.w *= Math.pow(.3, dt); B.th *= Math.pow(.3, dt); }
    B.w += -(g / B.L) * Math.sin(B.th) * dt; B.th += B.w * dt;
    /* the slipping brake pumps it a little higher each swing */
    if (!B.calm && Math.sign(prevTh) !== Math.sign(B.th) && Math.abs(B.w) < 2.4) B.w *= 1 + .07 * this.diff.ballPump;
    if (!B.calm && Math.abs(B.w) < .25 && Math.abs(B.th) < .05) B.w = .9;
    B.x = B.ax + B.L * Math.sin(B.th); B.y = B.ay + B.L * Math.cos(B.th);
    /* it smashes blocks it swings into */
    let hits = 0;
    const c0 = Math.floor((B.x - B.r) / CELL), c1 = Math.floor((B.x + B.r) / CELL), r0 = Math.floor((B.y - B.r) / CELL), r1 = Math.floor((B.y + B.r) / CELL);
    for (let r = r0; r <= r1 && hits < 2; r++) for (let c = c0; c <= c1 && hits < 2; c++) {
      if (!this.code(c, r)) continue;
      const nx = clamp(B.x, c * CELL, c * CELL + CELL), ny = clamp(B.y, r * CELL, r * CELL + CELL);
      if (Math.hypot(B.x - nx, B.y - ny) < B.r) { this.hitCell(c, r, 2, 'ball'); hits++; }
    }
    if (hits) { B.w *= Math.pow(.72, hits); B.hits += hits; this.emit('ballHit', { x: B.x, y: B.y, n: hits }); this.settle(); }
    /* the neighbour's fence: a soft bump that counts as mess */
    const fence = this.lot[1] * CELL;
    if (B.x + B.r > fence && B.w > 0) { B.w = -Math.abs(B.w) * .5; this.mess += 1; this.fenceBumps++; this.emit('fence', { x: fence, y: B.y }); }
    for (const a of this.players) {
      if (a.type !== 'mungo' || a.dizzy > 0 || a.grace > 0 || B.safeT > 0) continue;
      const nx = clamp(B.x, a.x - a.w / 2, a.x + a.w / 2), ny = clamp(B.y, a.y - a.h, a.y);
      if (Math.hypot(B.x - nx, B.y - ny) < B.r - 4 && !(a.punchT > .05 && Math.sign(B.x - a.x) === a.face)) {
        a.dizzy = this.diff.dizzy * .8; a.grace = a.dizzy + 1.2; a.vx = Math.sign(a.x - B.x || 1) * 260; a.vy = -260; a.climbing = false; this.bonks++;
        this.emit('bonk', { who: 'mungo', x: a.x, y: a.y - a.h, ball: true });
      }
    }
  },
  punchBall(a) {
    const B = this.ball; if (!B || B.calm) return;
    const px = a.x + a.face * (a.w / 2 + 30), py = a.y - a.h * .55;
    if (Math.abs(B.x - px) < 60 + B.r && Math.abs(B.y - py) < 50 + B.r) {
      const toward = Math.sign((this.bx + this.bw / 2) * CELL - B.ax) || -1;
      B.w = toward * Math.sqrt(2 * 1400 / B.L * (1 - Math.cos(1.05)));
      B.safeT = .7; this.ballPunches++; this.score += 30; this.hitStop = Math.max(this.hitStop, .07);
      this.emit('ballPunch', { x: B.x, y: B.y });
    }
  }
});
