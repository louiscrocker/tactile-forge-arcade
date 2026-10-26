/* ============================================================
   people.js — everyone who lives in the castle, and the animals
   ============================================================
   A Mover walks the grid along paths from grid.path().  A Person
   has a role and a job: by day it works where its furniture is
   (the cook at the hearth, the sage at the bookshelf), in the
   evening it goes to the feast, at night it sleeps in a bed.  A
   room nobody can reach is simply never visited (and the game
   says so).  Horses live in their stalls, dogs in their kennels,
   cats chase mice that always get away.
   ============================================================ */
'use strict';

class Mover {
  constructor(W, cx, cy) {
    this.W = W; this.cx = cx; this.cy = cy;
    this.x = cx * CELL + CELL / 2; this.y = (cy + 1) * CELL;
    this.path = null; this.face = 1; this.ph = 0; this.moving = false; this.speed = 60; this.wait = 0; this.gridV = -1;
  }
  get grid() { return this.W.castle.grid; }
  at(cx, cy) { this.cx = cx; this.cy = cy; this.x = cx * CELL + CELL / 2; this.y = (cy + 1) * CELL; this.path = null; }
  goTo(cx, cy) {
    if (cx === this.cx && cy === this.cy) { this.path = []; return true; }
    const p = this.grid.path(this.cx, this.cy, cx, cy);
    if (!p) { this.path = null; return false; }
    this.path = p; this.gridV = this.grid.version; return true;
  }
  /* walk along the path; returns 'arrived', 'walking', 'blocked' or 'idle' */
  step(dt) {
    if (!this.path) { this.moving = false; return 'idle'; }
    if (!this.path.length) { this.path = null; this.moving = false; return 'arrived'; }
    const [nx, ny] = this.path[0];
    if (!this.grid.standable(nx, ny)) { this.path = null; this.moving = false; return 'blocked'; }
    const tx = nx * CELL + CELL / 2, ty = (ny + 1) * CELL, dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy), stepLen = this.speed * dt;
    this.moving = true; this.ph += dt * this.speed / 14;
    if (Math.abs(dx) > 1) this.face = dx > 0 ? 1 : -1;
    if (d <= stepLen) { this.x = tx; this.y = ty; this.cx = nx; this.cy = ny; this.path.shift(); if (!this.path.length) { this.path = null; this.moving = false; return 'arrived'; } }
    else { this.x += dx / d * stepLen; this.y += dy / d * stepLen; }
    return 'walking';
  }
  /* is the ground still under us? (a floor was erased) */
  grounded() { return this.grid.standable(this.cx, this.cy); }
  settle() { const s = this.grid.nearestStandable(this.cx, this.cy, 8); if (s) this.at(s[0], s[1]); }
}

/* a standing spot next to an item, where a person can use it */
function spotFor(grid, item) {
  const d = ITEMS[item.key];
  const cands = [];
  for (let x = item.cx; x < item.cx + d.w; x++) cands.push([x, item.cy]);
  cands.push([item.cx - 1, item.cy], [item.cx + d.w, item.cy]);
  for (const [x, y] of cands) if (grid.inside(x, y) && grid.standable(x, y)) return [x, y];
  return null;
}

const JOBS = {
  royal:    { day: ['sit:throne', 'read:bookshelf', 'look:telescope', 'wander', 'sit:stand', 'look:fountain', 'brush:stall'], evening: 'eat', night: 'sleep:canopybed' },
  king:     { day: ['sit:throne', 'wander', 'read:desk', 'look:telescope'], evening: 'eat', night: 'sleep:canopybed' },
  queen:    { day: ['sit:throne', 'play:harp', 'read:bookshelf', 'wander'], evening: 'eat', night: 'sleep:canopybed' },
  knight:   { day: ['patrol', 'train:quintain', 'wander', 'warm:brazier'], evening: 'eat', night: 'sleep:bed' },
  guard:    { day: ['patrol', 'patrol', 'wander'], evening: 'patrol', night: 'patrol' },
  cook:     { day: ['cook:hearth', 'cook:kitchentable', 'cook:cauldron', 'bake:oven'], evening: 'cook:hearth', night: 'sleep:bed' },
  baker:    { day: ['bake:oven', 'cook:kitchentable'], evening: 'eat', night: 'sleep:bed' },
  maid:     { day: ['sweep', 'sweep', 'cook:kitchentable'], evening: 'eat', night: 'sleep:bed' },
  sage:     { day: ['read:bookshelf', 'read:desk', 'look:telescope', 'look:globe'], evening: 'eat', night: 'sleep:bed' },
  smith:    { day: ['hammer:anvil', 'warm:forgefire', 'hammer:anvil'], evening: 'eat', night: 'sleep:bed' },
  groom:    { day: ['brush:stall', 'feed:hay', 'brush:stall', 'wander'], evening: 'eat', night: 'sleep:bed' },
  jester:   { day: ['play', 'play', 'wander'], evening: 'play', night: 'sleep:bed' },
  falconer: { day: ['look', 'wander', 'look'], evening: 'eat', night: 'sleep:bed' },
  visitor:  { day: ['sit:throne', 'wander', 'look:fountain'], evening: 'eat', night: 'wander' },
  trader:   { day: ['look:marketstall', 'stand'], evening: 'stand', night: 'stand' }
};

class Person extends Mover {
  constructor(W, role, cx, cy, opts = {}) {
    super(W, cx, cy);
    this.role = role; this.look = opts.look || null; this.sex = opts.sex || null; this.name = opts.name || '';
    this.act = 'walk'; this.actT = 0; this.task = null; this.wait = rnd(0, 2); this.speed = role === 'knight' ? 54 : 60; this.carry = null; this.zzz = 0; this.id = Person.nextId++;
    this.arriving = !!opts.arriving; this.leaving = false; this.busyEvent = null; this.mood = 0; this.said = 0;
  }
  /* the castle's furniture that this person could use, nearest first and reachable */
  findItem(key, act) {
    const items = this.W.castle.items.filter(it => it.key === key && !this.W.busy(it, this));
    items.sort((a, b) => Math.abs(a.cx - this.cx) + Math.abs(a.cy - this.cy) * 2 - Math.abs(b.cx - this.cx) - Math.abs(b.cy - this.cy) * 2);
    for (const it of items.slice(0, 4)) { const s = spotFor(this.grid, it); if (s && this.grid.path(this.cx, this.cy, s[0], s[1])) return { it, spot: s }; }
    return null;
  }
  pickTask() {
    const W = this.W, tod = W.G.tod, night = nightAmount(tod) > .5, evening = tod > .68 && tod < .8, job = JOBS[this.role] || JOBS.guard;
    if (this.leaving) { return this.taskLeave(); }
    if (W.feast && evening && job.evening === 'eat') { const f = this.findItem('longtable', 'eat'); if (f) return this.taskUse(f, 'eat', rnd(20, 40)); }
    let plan = night ? job.night : evening ? job.evening : pick(job.day);
    if (night && this.role === 'royal') plan = this.findItem('canopybed') ? 'sleep:canopybed' : 'sleep:bed';
    const [act, key] = plan.split(':');
    if (act === 'patrol') return this.taskPatrol();
    if (act === 'wander') return this.taskWander();
    if (act === 'stand') { this.task = { kind: 'idle', t: rnd(4, 9), act: 'walk' }; return; }
    if (act === 'sweep') { const r = pick(W.castle.rooms().filter(x => !x.tiny)); if (r) { const c = pick(r.floor); if (c !== undefined) { const cx = c % COLS, cy = (c - cx) / COLS; if (this.goTo(cx, cy)) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(5, 9), act: 'brush' } }; this.carry = 'bucket'; return; } } } return this.taskWander(); }
    if (act === 'play' && !key) { const near = W.people.filter(p => p !== this && Math.abs(p.cx - this.cx) < 12); const tgt = near.length ? pick(near) : null; if (tgt) { const s = this.grid.nearestStandable(tgt.cx + (Math.random() < .5 ? -1 : 1), tgt.cy, 2); if (s && this.goTo(s[0], s[1])) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(6, 10), act: 'play' } }; return; } } return this.taskWander(); }
    if (act === 'look' && !key) { const walk = W.outdoorSpots(); if (walk.length) { const [cx, cy] = pick(walk); if (this.goTo(cx, cy)) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(6, 12), act: 'look' } }; return; } } return this.taskWander(); }
    if (key) { const f = this.findItem(key, act); if (f) return this.taskUse(f, act, act === 'sleep' ? 9999 : rnd(10, 25)); if (act === 'sleep') { const f2 = this.findItem(key === 'bed' ? 'canopybed' : 'bed', 'sleep'); if (f2) return this.taskUse(f2, 'sleep', 9999); /* no bed: doze where it is warm */ this.task = { kind: 'idle', t: rnd(20, 40), act: 'walk', zzz: true }; return; } }
    return this.taskWander();
  }
  taskUse(f, act, dur) { if (!this.goTo(f.spot[0], f.spot[1])) return this.taskWander(); this.W.claim(f.it, this); this.task = { kind: 'go', item: f.it, then: { kind: 'use', item: f.it, act, t: dur } }; this.carry = act === 'eat' ? null : act === 'read' ? 'book' : act === 'feed' ? 'hay' : null; }
  taskWander() {
    const reach = this.grid.reach(this.cx, this.cy, 1200);
    if (reach.length < 2) { this.task = { kind: 'idle', t: rnd(2, 5), act: 'walk' }; return; }
    const i = reach[(Math.random() * reach.length) | 0], cx = i % COLS, cy = (i - cx) / COLS;
    if (this.goTo(cx, cy)) this.task = { kind: 'go', then: { kind: 'idle', t: rnd(2, 6), act: Math.random() < .3 ? 'look' : 'walk' } };
    else this.task = { kind: 'idle', t: rnd(2, 4), act: 'walk' };
    this.carry = null;
  }
  taskPatrol() {
    const ways = this.grid.walkways().filter(([x, y]) => this.grid.standable(x, y));
    if (ways.length) { const [cx, cy] = pick(ways); if (this.goTo(cx, cy)) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(4, 8), act: 'look' } }; return; } }
    return this.taskWander();
  }
  taskLeave() { const exit = this.exitOverride || this.W.exitCell(); if (exit && this.goTo(exit[0], exit[1])) { this.task = { kind: 'go', then: { kind: 'gone' } }; return; } this.task = { kind: 'idle', t: 3, act: 'wave' }; }
  update(dt) {
    const W = this.W;
    if (!this.grounded()) this.settle();
    if (this.busyEvent) return;                       /* the joust or the carriage is steering this person */
    if (this.task && this.task.kind === 'go' && this.path && this.path.length && this.gridV !== this.grid.version) { const g = this.path[this.path.length - 1]; if (!this.goTo(g[0], g[1])) { this.task = null; } }
    if (!this.task) { this.wait -= dt; if (this.wait <= 0) { this.pickTask(); this.wait = rnd(.5, 1.5); } this.act = 'walk'; return; }
    const tk = this.task;
    if (tk.kind === 'go') {
      const r = this.step(dt);
      this.act = 'walk';
      if (r === 'arrived') { this.task = tk.then; if (tk.then.kind === 'use') this.face = tk.then.item.cx * CELL + ITEMS[tk.then.item.key].w * CELL / 2 >= this.x ? 1 : -1; }
      else if (r === 'blocked' || r === 'idle') { if (tk.item) W.release(tk.item, this); this.task = null; this.wait = rnd(1, 2); }
      return;
    }
    if (tk.kind === 'use') {
      const it = tk.item;
      if (!W.castle.items.includes(it)) { W.release(it, this); this.task = null; this.act = 'walk'; return; }
      this.act = tk.act; tk.t -= dt; this.ph += dt;
      if (tk.act === 'sleep') { this.zzz += dt * .7; const night = nightAmount(W.G.tod) > .5; if (!night) tk.t = 0; }
      if (tk.act === 'eat' && !W.feast) tk.t = Math.min(tk.t, 2);
      if (tk.act === 'cook' && Math.random() < dt * .5) W.steam(it.cx * CELL + ITEMS[it.key].w * CELL / 2, it.cy * CELL - 20);
      if (tk.act === 'hammer' && Math.random() < dt * 2.2) { W.sparks(this.x + this.face * 14, this.y - 24); if (AudioFX.clink && Math.random() < .6) AudioFX.clink(); }
      if (tk.act === 'brush' && it.key === 'stall') { const h = W.horseAt(it); if (h) h.hearts = .4; }
      if (tk.act === 'feed') { const h = W.horses.find(x => Math.abs(x.cx - it.cx) <= 2 && Math.abs(x.cy - it.cy) <= 1); if (h) h.grazing = true; }
      if (tk.t <= 0) { W.release(it, this); this.task = null; this.act = 'walk'; this.carry = null; this.zzz = 0; this.wait = rnd(.5, 2); }
      return;
    }
    if (tk.kind === 'idle') { this.act = tk.act || 'walk'; tk.t -= dt; this.ph += dt; if (tk.zzz) this.zzz += dt * .7; if (tk.t <= 0) { this.task = null; this.zzz = 0; this.carry = null; } return; }
    if (tk.kind === 'gone') { this.gone = true; return; }
    this.task = null;
  }
  sprite() { return { role: this.role, look: this.look, sex: this.sex, ph: this.ph, moving: this.moving, face: this.face, act: this.act, carry: this.carry, zzz: this.zzz }; }
}
Person.nextId = 1;

class Horse extends Mover {
  constructor(W, cx, cy, opts = {}) {
    super(W, cx, cy);
    this.col = opts.col || pick(['#8a5a3a', '#4a3020', '#c8a070', '#e8e4dc', '#5a4a44', '#a06a40']); this.mane = this.col === '#e8e4dc' ? '#c8c0b0' : '#2a1a10';
    this.blaze = Math.random() < .5; this.home = opts.home || null; this.task = null; this.speed = 48; this.hearts = 0; this.grazing = false; this.rider = null; this.saddle = false; this.wait = rnd(1, 4); this.happy = 0; this.id = Horse.nextId++;
    this.arriving = !!opts.arriving; this.busyEvent = null;
  }
  update(dt) {
    const W = this.W;
    if (!this.grounded()) this.settle();
    this.hearts = Math.max(0, this.hearts - dt * .5); this.happy = Math.max(0, this.happy - dt * .01);
    if (this.busyEvent) return;
    if (this.task && this.path && this.path.length && this.gridV !== this.grid.version) { const g = this.path[this.path.length - 1]; if (!this.goTo(g[0], g[1])) this.task = null; }
    if (!this.task) {
      this.wait -= dt; if (this.wait > 0) { this.moving = false; return; }
      const night = nightAmount(W.G.tod) > .5, r = Math.random();
      if (this.home && !W.castle.items.includes(this.home)) this.home = null;
      if (night || r < .45) { const tgt = this.home ? spotFor(this.grid, this.home) : null; if (tgt && this.goTo(tgt[0], tgt[1])) { this.task = { kind: 'go', then: { kind: 'idle', t: night ? rnd(30, 60) : rnd(6, 12), graze: Math.random() < .5 } }; return; } }
      if (r < .7) { const hay = W.castle.items.filter(it => (it.key === 'hay' || it.key === 'haystack' || it.key === 'trough') && Math.abs(it.cx - this.cx) < 30); const h = hay.length ? pick(hay) : null; const s = h && spotFor(this.grid, h); if (s && this.goTo(s[0], s[1])) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(6, 12), graze: true } }; return; } }
      const reach = this.grid.reach(this.cx, this.cy, 600).filter(i => { const cy = (i - i % COLS) / COLS; return cy >= GROUND - 3; });
      if (reach.length > 1) { const i = reach[(Math.random() * reach.length) | 0]; if (this.goTo(i % COLS, (i - i % COLS) / COLS)) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(3, 8), graze: Math.random() < .6 } }; return; } }
      this.task = { kind: 'idle', t: rnd(3, 6), graze: true };
      return;
    }
    const tk = this.task;
    if (tk.kind === 'go') { this.grazing = false; const r = this.step(dt); if (r === 'arrived') this.task = tk.then; else if (r !== 'walking') { this.task = null; this.wait = rnd(1, 3); } return; }
    if (tk.kind === 'idle') { this.moving = false; this.grazing = !!tk.graze; this.ph += dt * .5; tk.t -= dt; if (tk.t <= 0) { this.task = null; this.grazing = false; } return; }
    this.task = null;
  }
  sprite() { return { col: this.col, mane: this.mane, blaze: this.blaze, ph: this.ph, moving: this.moving, face: this.face, grazing: this.grazing, saddle: this.saddle || !!this.rider, hearts: this.hearts, s: .72 }; }
}
Horse.nextId = 1;

class Dog extends Mover {
  constructor(W, cx, cy, opts = {}) { super(W, cx, cy); this.col = opts.col || pick(['#c8955a', '#5a4a3a', '#e8e0d0', '#8a6a4a']); this.home = opts.home || null; this.speed = 80; this.task = null; this.wait = 1; this.wag = 0; this.id = Dog.nextId++; }
  update(dt) {
    if (!this.grounded()) this.settle();
    this.wag = Math.max(0, this.wag - dt);
    if (this.task && this.path && this.path.length && this.gridV !== this.grid.version) { const g = this.path[this.path.length - 1]; if (!this.goTo(g[0], g[1])) this.task = null; }
    if (!this.task) {
      this.wait -= dt; if (this.wait > 0) { this.moving = false; return; }
      const W = this.W, r = Math.random();
      if (r < .4 && W.people.length) { const p = pick(W.people); const s = this.grid.nearestStandable(p.cx + (Math.random() < .5 ? -1 : 1), p.cy, 2); if (s && this.goTo(s[0], s[1])) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(3, 7), wag: true } }; return; } }
      if (r < .7 && this.home && W.castle.items.includes(this.home)) { const s = spotFor(this.grid, this.home); if (s && this.goTo(s[0], s[1])) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(8, 16) } }; return; } }
      const reach = this.grid.reach(this.cx, this.cy, 500); if (reach.length > 1) { const i = reach[(Math.random() * reach.length) | 0]; if (this.goTo(i % COLS, (i - i % COLS) / COLS)) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(2, 6) } }; return; } }
      this.task = { kind: 'idle', t: 3 };
      return;
    }
    const tk = this.task;
    if (tk.kind === 'go') { const r = this.step(dt); if (r === 'arrived') { this.task = tk.then; if (tk.then.wag) this.wag = 3; } else if (r !== 'walking') { this.task = null; this.wait = 1; } return; }
    if (tk.kind === 'idle') { this.moving = false; this.ph += dt; tk.t -= dt; if (tk.t <= 0) this.task = null; return; }
    this.task = null;
  }
  sprite() { return { col: this.col, ph: this.ph, moving: this.moving, face: this.face, wag: this.wag > 0, s: .9 }; }
}
Dog.nextId = 1;

class Cat extends Mover {
  constructor(W, cx, cy) { super(W, cx, cy); this.col = pick(['#6a6a72', '#e8a050', '#2a2a2a', '#e8e0d0']); this.speed = 70; this.task = null; this.wait = 2; this.id = Cat.nextId++; }
  update(dt) {
    const W = this.W;
    if (!this.grounded()) this.settle();
    if (this.task && this.path && this.path.length && this.gridV !== this.grid.version) { const g = this.path[this.path.length - 1]; if (!this.goTo(g[0], g[1])) this.task = null; }
    /* a mouse in sight: the chase is on */
    const m = W.mice.find(m => !m.fled && Math.abs(m.cy - this.cy) <= 1 && Math.abs(m.cx - this.cx) < 10);
    if (m && (!this.task || this.task.kind !== 'chase')) { if (this.goTo(m.cx, m.cy)) { this.task = { kind: 'chase', mouse: m }; m.scared = true; } }
    if (!this.task) {
      this.wait -= dt; if (this.wait > 0) { this.moving = false; return; }
      const reach = this.grid.reach(this.cx, this.cy, 800);
      if (reach.length > 1) { const i = reach[(Math.random() * reach.length) | 0]; if (this.goTo(i % COLS, (i - i % COLS) / COLS)) { this.task = { kind: 'go', then: { kind: 'idle', t: rnd(4, 14) } }; return; } }
      this.task = { kind: 'idle', t: 4 }; return;
    }
    const tk = this.task;
    if (tk.kind === 'chase') { this.speed = 110; const r = this.step(dt); if (r === 'arrived' || !W.mice.includes(tk.mouse) || tk.mouse.fled) { this.task = { kind: 'idle', t: 3 }; this.speed = 70; } else if (r !== 'walking') { if (!this.goTo(tk.mouse.cx, tk.mouse.cy)) { this.task = null; this.speed = 70; } } return; }
    if (tk.kind === 'go') { const r = this.step(dt); if (r === 'arrived') this.task = tk.then; else if (r !== 'walking') { this.task = null; this.wait = 1; } return; }
    if (tk.kind === 'idle') { this.moving = false; this.ph += dt; tk.t -= dt; if (tk.t <= 0) this.task = null; return; }
    this.task = null;
  }
  sprite() { return { col: this.col, ph: this.ph, moving: this.moving, face: this.face, s: .9 }; }
}
Cat.nextId = 1;

/* a mouse: runs along the floor; when scared it dashes to the nearest wall and vanishes into a hole (it always gets away) */
class Mouse extends Mover {
  constructor(W, cx, cy) { super(W, cx, cy); this.speed = 50; this.scared = false; this.fled = false; this.life = rnd(20, 40); this.dir = Math.random() < .5 ? -1 : 1; this.t = 0; }
  update(dt) {
    this.life -= dt; this.t += dt;
    if (this.scared) this.speed = 140;
    if (!this.grounded()) { this.fled = true; return; }
    if (!this.grid.standable(this.cx + this.dir, this.cy)) { if (this.scared) { this.fled = true; this.W.poof(this.x, this.y - 4); return; } this.dir = -this.dir; }
    this.x += this.dir * this.speed * dt; this.face = this.dir; this.ph += dt * 6; this.moving = true;
    const ncx = Math.floor(this.x / CELL); if (ncx !== this.cx) { if (this.grid.standable(ncx, this.cy)) this.cx = ncx; else { this.x = this.cx * CELL + CELL / 2; this.dir = -this.dir; } }
    if (this.life <= 0) this.fled = true;
  }
}

/* pigeons perch on the roofs and flutter off when somebody comes close */
class Pigeon {
  constructor(W, perch) { this.W = W; this.perch = perch; this.x = perch[0] * CELL + rnd(6, CELL - 6); this.y = perch[1] * CELL; this.ph = rnd(0, 6); this.flying = false; this.fx = this.x; this.fy = this.y; this.t = 0; this.face = Math.random() < .5 ? -1 : 1; }
  update(dt) {
    this.ph += dt; this.t += dt;
    if (!this.flying) {
      const near = this.W.people.some(p => Math.abs(p.x - this.x) < 50 && Math.abs(p.y - this.y) < 60) || (this.W.dragon && this.W.dragon.landed && Math.abs(this.W.dragon.x - this.x) < 200);
      if (near || Math.random() < dt * .02) { this.flying = true; this.t = 0; this.vx = rnd(-60, 60); this.vy = -rnd(60, 110); }
      if (Math.random() < dt * .2) this.face = -this.face;
      return;
    }
    this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 20 * dt; this.face = this.vx > 0 ? 1 : -1;
    if (this.t > 2.5) { const p = this.W.perches(); if (p.length) { this.perch = pick(p); } const tx = this.perch[0] * CELL + CELL / 2, ty = this.perch[1] * CELL; const d = Math.hypot(tx - this.x, ty - this.y); if (d < 6 || this.t > 9) { this.x = tx; this.y = ty; this.flying = false; } else { this.vx = (tx - this.x) / d * 90; this.vy = (ty - this.y) / d * 90; } }
  }
}
/* swans paddle up and down the moat; fish swim under them */
class Swan {
  constructor(W, cx) { this.W = W; this.x = cx * CELL + CELL / 2; this.y = GROUND * CELL + 3; this.dir = Math.random() < .5 ? -1 : 1; this.ph = rnd(0, 6); this.speed = rnd(8, 14); this.face = this.dir; }
  update(dt) {
    this.ph += dt; const g = this.W.castle.grid;
    const nx = this.x + this.dir * this.speed * dt, cx = Math.floor((nx + this.dir * 14) / CELL);
    if (g.get(cx, GROUND) !== T.WATER || g.get(cx, GROUND - 1) !== T.AIR) { this.dir = -this.dir; } else this.x = nx;
    this.face = this.dir; this.y = GROUND * CELL + 3 + Math.sin(this.ph * 1.5) * .8;
    if (g.get(Math.floor(this.x / CELL), GROUND) !== T.WATER) this.gone = true;
  }
}
class Fish {
  constructor(W, cx) { this.W = W; this.x = cx * CELL + CELL / 2; this.y = GROUND * CELL + rnd(14, 28); this.dir = Math.random() < .5 ? -1 : 1; this.speed = rnd(14, 30); this.col = pick(['#e8a030', '#c0c8d0', '#e06040']); this.ph = rnd(0, 6); }
  update(dt) {
    this.ph += dt; const g = this.W.castle.grid, nx = this.x + this.dir * this.speed * dt, cx = Math.floor((nx + this.dir * 8) / CELL);
    if (g.get(cx, GROUND) !== T.WATER) this.dir = -this.dir; else this.x = nx;
    this.y += Math.sin(this.ph * 2) * 4 * dt;
    if (g.get(Math.floor(this.x / CELL), GROUND) !== T.WATER) this.gone = true;
  }
}
