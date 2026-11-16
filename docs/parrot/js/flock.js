/* ============================================================
   flock.js — everyone else in the forest
   ============================================================
   Bird      a parrot that is not you: your mother and father, your
             brother or sister, your mate, the flock at the clay
             lick.  It sits on a Line or flies to one.  A bird that
             FOLLOWS you flies at your wing and lands beside you.
   feeding   in the hollow a parent comes to the door with food.
             Beg and you are fed.  (You are fed anyway.)
   rings     a call you can see: rings of colour from whoever
             called, with the notes of a name inside.
   visitors  the toucan at the door, the eagle over the trees.
             They look, lose interest, leave.
   people    the scientist on a rope at your hollow; the boat on
             the river.  They look.  They keep wild parrots wild.
   Nothing here hurts anything.
   ============================================================ */
'use strict';

const NOTES = ['up', 'right', 'down', 'left'];

class Bird {
  constructor(F, kind, look) {
    this.F = F; this.kind = kind; this.look = look || 'scarlet';
    this.x = 0; this.y = 0; this.face = 1; this.mode = 'perch'; this.line = null; this.s = 0;
    this.tl = null; this.ts = 0; this.tx = 0; this.ty = 0; this.speed = 250; this.t = 0; this.ph = Math.random() * 9;
    this.follow = null; this.off = 40; this.callT = 0; this.gone = false; this.then = null; this.bob = 0; this.size = 1;
  }
  perchAt(line, s) { this.line = line; this.s = clamp(s, 0, line.len); const q = line.at(this.s); this.x = q.x; this.y = q.y; this.mode = 'perch'; this.tl = null; return this; }
  flyTo(line, s, then) { this.tl = line; this.ts = clamp(s, 0, line.len); const q = line.at(this.ts); this.tx = q.x; this.ty = q.y; this.mode = 'fly'; this.line = null; this.then = then || null; return this; }
  flyToXY(x, y, then) { this.tl = null; this.tx = x; this.ty = y; this.mode = 'fly'; this.line = null; this.then = then || null; return this; }
  update(dt) {
    this.t += dt; this.ph += dt * (this.mode === 'fly' ? 14 : 2); this.callT = Math.max(0, this.callT - dt); this.bob = Math.max(0, this.bob - dt * 2);
    const T = this.follow;
    if (T) {
      if (T.mode === 'fly') {
        if (this.mode !== 'fly') { this.mode = 'fly'; this.line = null; }
        this.tl = null; this.tx = T.x - T.face * this.off; this.ty = T.y - 14 + Math.sin(this.ph * .2) * 6; this.then = null;
      } else if (T.line && (this.mode === 'fly' || this.line !== T.line || Math.abs(this.s - T.s) > this.off + 60)) {
        const L = T.line, mum = this.F.mum, side = mum && mum !== this && mum.line === L && Math.abs(T.s + this.off - mum.s) < 46 ? -1 : 1;
        let want = T.s + side * this.off; if (want > L.len - 2 || want < 2) want = T.s - side * this.off;
        if (this.mode !== 'fly' || this.tl !== L || Math.abs(this.ts - want) > 30) this.flyTo(L, want);
      } else if (!T.line && this.mode === 'fly' && !this.tl) { this.tx = T.x + this.off; this.ty = T.y - 60; }
    }
    if (this.mode !== 'fly') return;
    const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy), sp = this.speed * (T && T.mode === 'fly' ? clamp(d / 40, .5, 1.25) : 1), step = sp * dt;
    if (Math.abs(dx) > 2) this.face = sign(dx);
    if (d <= step + 1) {
      this.x = this.tx; this.y = this.ty;
      if (this.tl) { this.perchAt(this.tl, this.ts); const f = this.then; this.then = null; if (f) f(this); }
      else if (!T) { const f = this.then; this.then = null; if (f) f(this); else this.gone = this.leaving || false; }
    } else { this.x += dx / d * step; this.y += dy / d * step + Math.sin(this.ph * .5) * 10 * dt; }
  }
}

Object.assign(Forest.prototype, {
  initFlock() {
    const st = (k, d = 0) => { const q = this.station(k); return [q.line, q.s + d]; };
    this.mum = new Bird(this, 'mum').perchAt(this.line('homehigh'), 40);
    this.dad = new Bird(this, 'dad').perchAt(...st('fig'));
    this.sib = null; this.mate = null; this.others = []; this.rings = []; this.chicks = [];
    this.feed = { state: 'away', bird: null, t: 0, clock: 4, turn: 0 };
    this.visitor = null; this.people = null; this.peopleSeen = 0; this.fogWanted = false; this.heardT = -99;
    /* the flock at the clay lick: macaws and little green parrots */
    const spots = [['ledge1', .2, 'blue'], ['ledge1', .86, 'green'], ['ledge2', .05, 'redgreen'], ['ledge2', .4, 'green'], ['ledge3', .02, 'blue'], ['ledge3', .98, 'scarlet'], ['clifftop', .5, 'green']];
    for (const [k, u, look] of spots) { const L = this.line(k), b = new Bird(this, 'other', look).perchAt(L, L.len * u); b.homeL = L; b.homeS = b.s; b.size = look === 'green' ? .55 : 1; b.face = this.rng() < .5 ? -1 : 1; this.others.push(b); }
  },
  birds() { return [this.mum, this.dad, this.sib, this.mate].filter(Boolean); },
  family() { return [this.mum, this.dad, this.sib].filter(Boolean); },
  /* a call you can see */
  ring(x, y, kind, seq) { this.rings.push({ x, y, kind, seq: seq || null, t: 0 }); Bus.emit('ring', kind, seq); },
  /* the family (or your mate) answer you */
  answer() {
    const who = this.mate ? [this.mate] : [this.mum, this.dad];
    who.forEach((b, i) => { b.callT = .8 + i * .3; });
    this.heardT = this.t; this.pendingAnswer = { at: this.t + .6, who };
  },
  /* the family flies to where the next lesson is */
  lead(k) { const q = this.station(k); this.mum.follow = this.dad.follow = null; this.mum.flyTo(q.line, q.s - 22); this.dad.flyTo(q.line, q.s + 22); this.leadKey = k; },
  /* one alarm call and everybody is in the air: the flock, and your mother and father with it */
  flush() {
    for (const b of this.others) if (b.mode === 'perch') b.flyToXY(b.x + (this.rng() - .5) * 300, b.y - 260 - this.rng() * 160);
    for (const b of [this.mum, this.dad]) if (b.mode === 'perch' && !b.follow && b.line && /^ledge|^clifftop/.test(b.line.key)) { b.backL = b.line; b.backS = b.s; b.flyToXY(b.x + (this.rng() - .5) * 200, b.y - 230 - this.rng() * 80); }
  },
  settle() {
    for (const b of this.others) b.flyTo(b.homeL, b.homeS);
    for (const b of [this.mum, this.dad]) if (b.backL) { if (!b.follow && b.mode === 'fly' && !b.tl) b.flyTo(b.backL, b.backS); b.backL = null; }
  },

  /* ---------- a parent at the door with food ---------- */
  updateFeed(dt) {
    const p = this.G.player, f = this.feed, fl = p.flags;
    if (f.state === 'away') {
      const chick = p.stage === 'chick' && p.mode === 'nest' && !fl.ready, sit = p.stage === 'adult' && !p.male && fl.laid && !fl.hatched && p.mode === 'nest' && this.mate;
      if (!(chick || sit) || this.visitor || this.people) return;
      f.clock -= dt; if (f.clock > 0) return;
      const h = this.hollow(sit ? fl.nest : 'home'), s = clamp(h.s + (h.s > h.line.len / 2 ? -8 : 8), 0, h.line.len);
      f.bird = sit ? this.mate : f.turn++ % 2 ? this.dad : this.mum; f.state = 'come';
      f.bird.follow = null; f.bird.flyTo(h.line, s, () => { f.state = 'offer'; f.t = 0; f.bird.face = sign(h.door[0] - f.bird.x) || -1; Bus.emit('parentHere', p, f.bird); });
    } else if (f.state === 'offer') {
      f.t += dt; if (f.t > 9 && p.mode === 'nest') this.feedNow(true);
    } else if (f.state === 'go') { f.t += dt; if (f.t > .9) { const q = this.station(f.bird === this.dad ? 'lost' : 'fig'); f.bird.flyTo(q.line, q.s + (f.bird === this.mate ? 40 : 0)); f.state = 'away'; f.clock = this.G.diff().feedGap; } }
  },
  feedNow(auto) {
    const p = this.G.player, f = this.feed; if (f.state !== 'offer') return;
    f.state = 'go'; f.t = 0; f.bird.bob = 1; p.food++; p.stats.feeds++; p.begN = 0;
    Bus.emit('fed', p, f.bird, !!auto);
  },

  /* ---------- visitors: they look, and they go ---------- */
  startVisitor(kind, need) {
    if (this.visitor || this.people) return null;
    const p = this.G.player, side = this.rng() < .5 ? -1 : 1;
    const v = { kind, need: need || 'call', state: 'come', t: 0, side, x: p.x + side * 520, y: p.y - 300, safeT: 0, patience: kind === 'eagle' ? 7 : 9, ph: 0, tx: 0, ty: 0 };
    if (kind === 'toucan') { const h = this.hollow(p.flags.nest || 'home'), q = h.line.at(clamp(h.s + (h.s > h.line.len / 2 ? -62 : 62), 0, h.line.len)); v.h = h; v.tx = q.x; v.ty = q.y; v.x = v.tx + 420; v.y = v.ty - 160; v.side = 1; v.face = sign(h.door[0] - q.x) || -1; }
    this.visitor = v; Bus.emit('visitor', v);
    if (kind === 'eagle') this.flush();
    return v;
  },
  updateVisitor(dt) {
    const v = this.visitor; if (!v) return;
    const p = this.G.player; v.t += dt; v.ph += dt;
    if (v.kind === 'eagle' && v.state !== 'leave') { v.tx = p.x + v.side * 90; v.ty = Math.min(p.y - 150, groundY(p.x) - 260); }
    if (v.state === 'come') {
      const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy), sp = 210;
      v.x += dx / (d || 1) * Math.min(d, sp * dt); v.y += dy / (d || 1) * Math.min(d, sp * dt);
      if (d < 8 || v.t > 8) { v.state = 'look'; v.t = 0; Bus.emit('visitorLooks', v); }
    } else if (v.state === 'look') {
      if (v.kind === 'eagle') { v.x += (v.tx - v.x) * Math.min(1, dt) + Math.cos(v.ph * .9) * 60 * dt; v.y += (v.ty - v.y) * Math.min(1, dt); }
      if (p.isSafe(v)) v.safeT += dt;
      if (v.safeT > 1.3) { v.state = 'leave'; v.t = 0; Bus.emit('visitorBored', v, p.safeHow(v)); }
      else if (v.t > v.patience) { v.state = 'leave'; v.t = 0; Bus.emit('scared', p, v); p.flee(v); }
    } else {
      v.x += v.side * 260 * dt; v.y -= 110 * dt;
      if (v.t > 3) { this.visitor = null; if (v.kind === 'eagle') this.settle(); Bus.emit('visitorGone', v); }
    }
  },

  /* ---------- the people ---------- */
  startPeople(kind) {
    if (this.people || this.visitor) return null;
    const P = { kind, state: 'come', t: 0, say: null, line: 0, n: ++this.peopleSeen };
    if (kind === 'climber') { P.x = WORLD.doorX + 30; P.y = -1000; P.wy = WORLD.doorY - 6; }
    else { P.x = WORLD.riverX0 - 220; P.y = 4; P.wx = 520; }
    this.people = P; Bus.emit('peopleCame', this.G.player, P);
    return P;
  },
  updatePeople(dt) {
    const P = this.people; if (!P) return;
    P.t += dt;
    const arrive = () => { P.state = 'look'; P.t = 0; Bus.emit('peopleLook', this.G.player, P); };
    if (P.state === 'come') {
      if (P.kind === 'climber') { P.y += 150 * dt; if (P.y >= P.wy) { P.y = P.wy; arrive(); } }
      else { P.x += 110 * dt; if (P.x >= P.wx) { P.x = P.wx; arrive(); } }
    } else if (P.state === 'look') {
      const lines = PEOPLE_SAY[P.kind], k = Math.floor(P.t / 3.2);
      if (k !== P.line - 1 && k < lines.length) { P.line = k + 1; P.say = { who: lines[k][0], text: lines[k][1], t: 0 }; Bus.emit('peopleSay', lines[k][1]); }
      if (P.say) P.say.t += dt;
      if (P.t > lines.length * 3.2 + .6) { P.state = 'go'; P.t = 0; P.say = null; }
    } else {
      if (P.kind === 'climber') P.y -= 170 * dt; else P.x += 130 * dt;
      if (P.t > 4) { this.people = null; Bus.emit('peopleGone', this.G.player, P); }
    }
  },

  updateFlock(dt) {
    for (const b of this.birds()) b.update(dt);
    for (const b of this.others) b.update(dt);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < 1.6);
    const a = this.pendingAnswer;
    if (a && this.t >= a.at) { this.pendingAnswer = null; for (const b of a.who) this.ring(b.x, b.y - 12, 'family', this.G.player.name()); Bus.emit('answered', this.G.player); }
    for (const c of this.chicks) c.t += dt;
    this.updateFeed(dt);
  }
});

/* what the people say.  [who, words] */
const PEOPLE_SAY = {
  climber: [['grownup', 'Hello, little one.'], ['grownup', 'You are growing well!'], ['grownup', 'Back you go. Stay wild.']],
  boat: [['kid', 'Look! Parrots!'], ['grownup', 'We look from far away.'], ['kid', 'A wild parrot stays wild.']]
};
