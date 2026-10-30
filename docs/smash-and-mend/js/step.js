/* ============================================================
   step.js — one tick of a level, the end of a level, the stars
   ============================================================ */
'use strict';

const STEP = 1 / 60;
const NO_INPUT = Object.freeze({ left: false, right: false, up: false, down: false, upP: false, downP: false, jumpP: false, actionP: false });

Object.assign(Level.prototype, {
  step(dt, inputs) {
    if (this.result) return;
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    this.time += dt;
    this.players.forEach((a, n) => {
      const i = (inputs && inputs[n]) || NO_INPUT;
      if (a.grace > 0) a.grace -= dt;
      if (this.done) { a.cheer += dt; if (a.type === 'mungo') this.controlMungo(a, NO_INPUT, dt); else this.controlPip(a, NO_INPUT, dt); return; }
      if (a.type === 'mungo') this.controlMungo(a, i, dt); else this.controlPip(a, i, dt);
    });
    if (this.smash) { this.updateChunks(dt); this.updateBall(dt); this.updateCritters(dt); }
    this.updateBits(dt);
    if (this.mend) { this.updateWeather(dt); this.spawnHazards(dt); this.updateThings(dt); for (const f of this.house.fixes) f.glint = Math.max(0, f.glint - dt); }
    if (this.combo && this.time - this.lastBreak > .9) this.combo = 0;
    this.checkDone(dt);
  },

  remaining() { return this.smash ? this.countCells() : 0; },
  fixesLeft() { return this.mend ? this.house.fixes.filter(f => !f.fixed).length : 0; },
  progress() {
    const p = [];
    if (this.smash) p.push(1 - this.remaining() / this.initial);
    if (this.mend) p.push(1 - this.fixesLeft() / this.house.fixes.length);
    return p.reduce((a, b) => a + b, 0) / p.length;
  },

  checkDone(dt) {
    if (this.smash && !this.smashDone) {
      const left = this.remaining();
      /* the last few blocks crumble by themselves, top first: the big finish */
      if (!this.finale && left <= Math.max(1, Math.floor(this.initial * .06)) && !this.chunks.length) { this.finale = true; this.emit('finale', {}); }
      if (this.finale) {
        this.finaleT -= dt;
        if (this.finaleT <= 0) {
          this.finaleT = .07;
          let pick = -1;
          for (let k = 0; k < this.cell.length && pick < 0; k++) if (this.cell[k]) pick = k;
          if (pick >= 0) { const c = pick % this.cols, r = (pick / this.cols) | 0, m = matOf(this.cell[pick]); if (m.critter) this.critterOut(c, r, m.critter); else this.breakCell(c, r, 'finale'); }
        }
        if (this.chunks.length) for (const ch of this.chunks.splice(0)) for (const b of ch.cells) { const k = this.idx(b.c, b.r); if (!this.cell[k]) { this.cell[k] = b.code; this.hp[k] = b.hp; } }
      }
      if (left === 0 && !this.chunks.length) { this.smashDone = true; if (this.ball) this.ball.calm = true; this.emit('smashDone', {}); }
    }
    if (this.mend && !this.mendDone && this.fixesLeft() === 0) { this.mendDone = true; this.things.length = 0; this.emit('mendDone', {}); }
    if (!this.done && this.smashDone && this.mendDone) { this.done = true; this.endT = 1.6; this.emit('done', {}); }
    if (this.done) { this.endT -= dt; if (this.endT <= 0) this.finish(false); return; }
    if (this.limit && this.diff.failOnTime && this.time > this.limit) this.finish(true);
  },

  finish(outOfTime) {
    const d = this.def, easy = this.diffKey === 'easy';
    const par = d.par * (easy ? 1.5 : 1);
    let stars = 0; const why = [];
    if (!outOfTime) {
      stars = 1; why.push('done');
      if (this.time <= par) { stars++; why.push('quick'); }
      const tidyOk = this.kind === 'smash' ? this.mess <= d.tidy : this.bonks <= (this.kind === 'coop' ? 4 : 2);
      if (tidyOk) { stars++; why.push(this.kind === 'smash' ? 'tidy' : 'steady'); }
    }
    this.result = { id: d.id, kind: this.kind, stars, why, outOfTime, time: this.time, par, score: this.score, mess: this.mess, tidy: d.tidy,
      bonks: this.bonks, catches: this.catches, bestCombo: this.bestCombo, crumbles: this.crumbles, ballPunches: this.ballPunches, diff: this.diffKey };
    this.emit('result', this.result);
  }
});
