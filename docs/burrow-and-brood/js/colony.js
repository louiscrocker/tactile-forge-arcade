/* ============================================================
   colony.js — the queen, her brood, the nest and her daughters
   ============================================================
   THE STORY     A queen lands, digs a room and lays eggs.  She
                 feeds the first larvae from her own body.  The
                 first cocoons open and out come the first workers
                 (the player becomes one of them).  From then on the
                 workers do everything, and the colony grows from
                 a handful to thousands.
   THE BROOD     egg → larva (must be fed) → cocoon → worker.
                 Every brood item stands for `rep` ants, so a big
                 colony can be shown with a few dozen items.
   THE NEST      Rooms are planned from the queen's room (food
                 rooms, nurseries, a deep winter room) and joined by
                 tunnels that route round stones.  Digger ants dig
                 them out a bite at a time and carry the dirt up.
   THE JOBS      Every ant you see has a job: nurse, digger,
                 forager, farmer or guard.  Every two seconds the
                 colony looks at what it needs (hungry larvae, an
                 empty food room, no room left, a ladybug larva on
                 the aphids…) and some ants switch jobs.  Nobody is
                 in charge: that is division of labour.
   GETTING ABOUT Ants follow BFS distance fields over the soil's
                 walkable cells (see soil.js); on a plant they walk
                 the stem graph like the ladybug larva does.
   ============================================================ */
'use strict';

const BROOD = { eggT: 14, larvaNeed: 3, spinT: 3, pupaT: 16 };
const FOOD_PER_FEED = 2.1, EGG_COST = .8, LAY_T = 6, BROOD_CAP = 40;
const HONEY_PER_ANT = .0018;

/* a tiny binary heap for the tunnel planner */
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], last = k.length - 1;
    k[0] = k[last]; v[0] = v[last]; k.pop(); v.pop();
    let i = 0;
    for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; }
    return top;
  }
}

class Colony {
  constructor(G, world) {
    this.G = G; this.W = world; this.S = world.soil;
    this.phase = 'founding';
    this.pop = 0;                   // workers alive (the player's worker is one of them)
    this.food = 0; this.honey = 0;
    this.brood = []; this.nextBrood = 1;
    this.rooms = []; this.nextRoom = 1;
    this.plan = []; this.planAt = 0;
    this.entrance = null; this.entryX = null;
    this.queen = null;              // the NPC queen, once the player becomes a worker
    this.agents = []; this.nextAgent = 1;
    this.crowd = [];
    this.fields = {}; this.fieldBudget = 2;
    this.stage = 0;
    this.done = {};                 // milestones passed
    this.waitKey = null;
    this.trail = [];
    this.stats = { foodIn: 0, honeyIn: 0, playerFood: 0, raised: 0, dug: 0, maxPop: 0, bigFood: 0 };
    this.boost = {}; this.jobClock = 0;
    this.targets = { nurse: 0, digger: 0, forager: 0, farmer: 0, guard: 0 };
    this.layClock = 6;
    this.queenReserve = 1;
    this.alates = []; this.flight = null;
    this.hungry = 0;
    this.winter = false;
  }

  /* ---------- sizes ---------- */
  ants() { return this.pop + 1; }                                         // workers + the queen
  capacity() { return 24 + this.S.nestAir * 2.4; }
  rep() { return Math.max(1, Math.round(this.pop / 16)); }                  // ants per new brood item
  scale() { return Math.max(1, this.pop / Math.max(1, this.agents.length + 1)); }  // ants per visible ant
  visCap() { return Render.getQuality && Render.getQuality() === 'low' ? 45 : 80; }
  jobCounts() {
    const c = { nurse: 0, digger: 0, forager: 0, farmer: 0, guard: 0 };
    for (const a of this.agents) c[a.job]++;
    const s = this.scale(), out = {};
    for (const k in c) out[k] = Math.round(c[k] * s);
    return { seen: c, all: out };
  }

  /* ---------- rooms ---------- */
  addRoom(kind, x, y, rx, ry) {
    const r = { id: this.nextRoom++, kind, x, y, rx, ry, open: 0 };
    this.rooms.push(r);
    return r;
  }
  roomById(id) { return this.rooms.find(r => r.id === id); }
  get royal() { return this.rooms.find(r => r.kind === 'royal'); }
  roomAt(x, y, pad = 10) {
    for (const r of this.rooms) { const dx = (x - r.x) / (r.rx + pad), dy = (y - r.y) / (r.ry + pad); if (dx * dx + dy * dy <= 1) return r; }
    return null;
  }
  openRooms(kind) { return this.rooms.filter(r => r.kind === kind && r.open >= .7); }
  nurseries() { const n = this.openRooms('nursery'); return n.length ? n : (this.royal ? [this.royal] : []); }
  pantries() { const n = this.openRooms('pantry'); return n.length ? n : (this.royal ? [this.royal] : []); }
  winterRoom() { const w = this.openRooms('winter')[0]; if (w) return w; const all = this.rooms.filter(r => r.open >= .7); return all.sort((a, b) => b.y - a.y)[0] || this.royal; }
  /* a resting place on the floor of a room, away from what is already there */
  floorSpot(room, avoid = []) {
    const S = this.S;
    let best = null, bd = -1;
    for (let k = 0; k < 10; k++) {
      const x = room.x + rnd(-room.rx * .75, room.rx * .75);
      let y = room.y - room.ry * .5;
      while (y < room.y + room.ry + 24 && !S.solidAt(x, y + 3)) y += 2;
      if (!S.solidAt(x, y + 3)) continue;
      let d = 60;
      for (const o of avoid) d = Math.min(d, dist(o.x, o.y, x, y));
      if (d > bd) { bd = d; best = { x, y: y - 1 }; }
    }
    return best || { x: room.x, y: room.y + room.ry * .6 };
  }

  /* ---------- founding (the player is the queen) ---------- */
  canFound(p) {
    if (this.phase !== 'founding' || this.royal) return false;
    const d = this.S.depthAt(p.x, p.y);
    return d > 80 && d < 400 && p.underground;
  }
  found(p) {
    const S = this.S;
    const room = this.addRoom('royal', p.x, p.y - 6, 58, 23);
    S.carve(room.x, room.y, room.rx, room.ry);
    room.open = 1;
    const ex = this.entryX !== null ? this.entryX : p.x;
    this.entrance = { x: ex, y: S.ground0(ex) };
    this.makePlan();
    Bus.emit('founded', room);
    return room;
  }
  /* the queen lays her first eggs (a reading gate can hold this) */
  layFirstEggs(p) {
    const room = this.royal; if (!room) return;
    this.milestone('eggs', () => {
      this.done.eggs = true;
      for (let k = 0; k < 5; k++) this.addBrood('egg', room, 1, this.floorSpot(room, this.brood));
      Bus.emit('eggsLaid', p);
    });
  }
  addBrood(kind, room, rep, spot, caste = 'worker') {
    const b = { id: this.nextBrood++, kind, rep, x: spot.x, y: spot.y, room: room.id, age: 0, fed: 0, spin: 0, wet: 0, t: rnd(TAU), carried: null, caste };
    this.brood.push(b);
    return b;
  }
  broodNear(x, y, r, filter) {
    let best = null, bd = r;
    for (const b of this.brood) { if (b.carried || (filter && !filter(b))) continue; const d = dist(b.x, b.y, x, y); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  /* a claim by a sister lapses if she got busy with something else */
  unclaimed(b) { return !b.claimed || this.G.time - (b.claimedAt || 0) > 20; }
  hungryLarva(b) { return b.kind === 'larva' && b.fed < BROOD.larvaNeed && !b.carried; }
  /* food into a larva: from the queen's own body in the founding, or from a worker */
  feedLarva(b, fromQueen) {
    if (!b || !this.hungryLarva(b)) return false;
    b.fed++;
    if (fromQueen) this.queenReserve = Math.max(.15, this.queenReserve - .07);
    Bus.emit('fedLarva', b);
    return true;
  }

  /* milestones: Read to Play wraps this so a page is read first */
  milestone(key, fn) { fn(); }
  _mile(key, then) {
    if (this.done[key]) return true;
    if (this.waitKey) return false;
    this.waitKey = key;
    this.milestone(key, () => { this.done[key] = true; this.waitKey = null; Bus.emit('milestone', key, this); if (then) then(); });
    return !!this.done[key];
  }

  /* ---------- the nest plan ---------- */
  makePlan() {
    const S = this.S, R = mulberry32(this.W.seed ^ 0x77), room = this.royal;
    const s = R() < .5 ? 1 : -1;
    const T = [
      ['pantry', s * 150, 50, 46, 17], ['nursery', -s * 145, 120, 50, 19], ['nursery', s * 130, 255, 52, 19],
      ['pantry', -s * 175, 330, 54, 19], ['winter', s * 30, 520, 62, 22], ['nursery', -s * 230, 470, 56, 20],
      ['pantry', s * 250, 610, 58, 20], ['nursery', -s * 70, 720, 60, 21], ['nursery', s * 320, 420, 54, 19],
      ['pantry', -s * 330, 640, 58, 20], ['nursery', s * 150, 860, 62, 22], ['nursery', -s * 250, 900, 60, 21],
      ['pantry', s * 380, 800, 60, 21], ['nursery', -s * 420, 780, 58, 20], ['nursery', s * 20, 1040, 66, 23],
      ['pantry', -s * 160, 1120, 62, 22], ['nursery', s * 420, 1060, 60, 21], ['nursery', -s * 460, 1080, 60, 21]
    ];
    let from = room;
    for (const [kind, dx, dy, rx, ry] of T) {
      let x = clamp(room.x + dx + (R() - .5) * 40, S.X0 + 120, S.X1 - 120), y = Math.min(room.y + dy + (R() - .5) * 30, S.Y1 - 80);
      /* nudge away from stones */
      let ok = false;
      for (let k = 0; k < 16 && !ok; k++) { if (this.stoniness(x, y, rx, ry) < .15 && !this.rooms.some(o => Math.abs(o.x - x) < o.rx + rx + 20 && Math.abs(o.y - y) < o.ry + ry + 24)) ok = true; else { x += (R() - .5) * 110; y += (R() - .5) * 60; } }
      if (!ok) continue;
      const r = this.addRoom(kind, x, y, rx, ry);
      r.planned = true;
      /* join it to the nearest room already planned */
      const near = this.rooms.filter(o => o !== r && (o.planned || o.kind === 'royal')).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0] || from;
      const path = this.route(near.x, near.y + near.ry * .4, x, y);
      if (!path) { this.rooms.splice(this.rooms.indexOf(r), 1); continue; }
      for (const [px, py] of path) this.plan.push({ x: px, y: py, r: 11, room: null, done: false });
      /* the room itself, dug from the tunnel end outwards */
      const pts = [];
      for (let yy = -ry + 8; yy <= ry - 6; yy += 12) for (let xx = -rx + 8; xx <= rx - 8; xx += 13) if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) < .8) pts.push({ x: x + xx, y: y + yy, r: 11, room: r.id, done: false });
      const [ex, ey] = path.length ? path[path.length - 1] : [x, y];
      pts.sort((a, b) => dist(a.x, a.y, ex, ey) - dist(b.x, b.y, ex, ey));
      this.plan.push(...pts);
      from = r;
    }
  }
  stoniness(x, y, rx, ry) {
    let stone = 0, all = 0;
    for (let yy = -ry - 12; yy <= ry + 12; yy += 6) for (let xx = -rx - 12; xx <= rx + 12; xx += 6) {
      if ((xx * xx) / ((rx + 12) * (rx + 12)) + (yy * yy) / ((ry + 12) * (ry + 12)) > 1) continue;
      all++; const m = this.S.matAt(x + xx, y + yy); if (m === MAT.ROCK || m === MAT.ROOT) stone++;
    }
    return all ? stone / all : 1;
  }
  /* the cheapest tunnel between two points: soft soil is cheap, stones and roots impossible */
  route(x0, y0, x1, y1) {
    const S = this.S, pad = 26;
    const c0 = clamp(Math.min(S.col(x0), S.col(x1)) - pad, 0, S.cols - 1), c1 = clamp(Math.max(S.col(x0), S.col(x1)) + pad, 0, S.cols - 1);
    const r0 = clamp(Math.min(S.row(y0), S.row(y1)) - pad, 0, S.rows - 1), r1 = clamp(Math.max(S.row(y0), S.row(y1)) + pad, 0, S.rows - 1);
    const w = c1 - c0 + 1, h = r1 - r0 + 1;
    const cost = new Float64Array(w * h).fill(Infinity), prev = new Int32Array(w * h).fill(-1);
    const start = (S.row(y0) - r0) * w + (S.col(x0) - c0), goal = (S.row(y1) - r0) * w + (S.col(x1) - c0);
    const blocked = (c, r) => {
      for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) { const m = S.mat[S.idx(clamp(c + c0 + xx, 0, S.cols - 1), clamp(r + r0 + yy, 0, S.rows - 1))]; if (m === MAT.ROCK || m === MAT.ROOT) return true; }
      return false;
    };
    const H = new MinHeap(); cost[start] = 0; H.push(0, start);
    while (H.size) {
      const i = H.pop();
      if (i === goal) break;
      const c = i % w, r = (i / w) | 0;
      for (const [dc, dr, k] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= w || nr >= h) continue;
        const j = nr * w + nc;
        if (blocked(nc, nr)) continue;
        const m = S.mat[S.idx(nc + c0, nr + r0)];
        const step = k * (m === MAT.AIR || m === MAT.WATER ? .3 : m === MAT.SAND ? 1.3 : m === MAT.CLAY ? 2.6 : 1);
        const nd = cost[i] + step;
        if (nd < cost[j]) { cost[j] = nd; prev[j] = i; H.push(nd + Math.hypot(nc - (goal % w), nr - ((goal / w) | 0)) * .3, j); }
      }
    }
    if (prev[goal] < 0 && goal !== start) return null;
    const cells = [];
    for (let i = goal; i >= 0; i = prev[i]) { cells.push(i); if (i === start) break; }
    cells.reverse();
    const out = []; let lx = -1e9, ly = -1e9;
    for (const i of cells) { const x = S.cx((i % w) + c0), y = S.cy(((i / w) | 0) + r0); if (dist(x, y, lx, ly) >= 9) { out.push([x, y]); lx = x; ly = y; } }
    return out;
  }
  /* the next few places to dig */
  activeDigs(n = 3) {
    const out = [];
    for (let i = this.planAt; i < this.plan.length && out.length < n; i++) if (!this.plan[i].done) out.push(this.plan[i]);
    return out;
  }
  checkPlan() {
    const S = this.S;
    while (this.planAt < this.plan.length && this.plan[this.planAt].done) this.planAt++;
    for (let i = this.planAt; i < Math.min(this.plan.length, this.planAt + 6); i++) {
      const p = this.plan[i];
      if (!p.done && S.openness(p.x, p.y, p.r * .75, p.r * .75) > .82) p.done = true;
    }
    for (const r of this.rooms) {
      if (r.open >= 1 || r.kind === 'royal') continue;
      const o = S.openness(r.x, r.y, r.rx * .8, r.ry * .7);
      if (o > r.open) { const was = r.open; r.open = o; if (was < .7 && o >= .7) { Bus.emit('roomDug', r); this.dirtyFields(); } }
    }
  }

  /* ---------- distance fields ---------- */
  dirtyFields() { for (const k in this.fields) this.fields[k].force = true; }
  sources(key) {
    const S = this.S, out = [];
    const at = (x, y, r = 4) => { const i = S.nearestWalkable(x, y, r); if (i >= 0) out.push(i); };
    if (key.startsWith('room:')) {
      const r = this.roomById(+key.slice(5)); if (!r) return out;
      for (let yy = -r.ry; yy <= r.ry + 6; yy += 6) for (let xx = -r.rx; xx <= r.rx; xx += 6) {
        if ((xx * xx) / ((r.rx + 6) * (r.rx + 6)) + (yy * yy) / ((r.ry + 8) * (r.ry + 8)) > 1) continue;
        const c = S.col(r.x + xx), rr2 = S.row(r.y + yy);
        if (!S.inside(c, rr2)) continue;
        const i = S.idx(c, rr2);
        if (S.walk[i] && rr2 + 1 < S.rows && isSolidMat(S.mat[i + S.cols])) out.push(i);
      }
    } else if (key === 'food') {
      for (const f of this.W.foods.list) if (this.wantFood(f)) at(f.x, f.y + f.r * .3, 6);
    } else if (key.startsWith('plant:')) {
      const P = this.W.plantAt(+key.slice(6)); at(P.ox, P.nodes[0].y - 8, 6);
    } else if (key === 'mound') {
      const e = this.entrance; if (e) { at(e.x + 70, S.surfaceAt(e.x + 70) - 8, 6); at(e.x - 70, S.surfaceAt(e.x - 70) - 8, 6); }
    } else if (key === 'entrance') {
      const e = this.entrance; if (e) at(e.x, e.y - 8, 8);
    } else if (key === 'dig') {
      for (const p of this.activeDigs(3)) {
        const before = out.length;
        for (let yy = -p.r - 12; yy <= p.r + 12; yy += 6) for (let xx = -p.r - 12; xx <= p.r + 12; xx += 6) {
          const c = S.col(p.x + xx), r = S.row(p.y + yy);
          if (S.inside(c, r) && S.walk[S.idx(c, r)] && dist(p.x + xx, p.y + yy, p.x, p.y) < p.r + 14) out.push(S.idx(c, r));
        }
        /* nothing open right next to it yet: work from the nearest open face */
        if (out.length === before) at(p.x, p.y, 10);
      }
    } else if (key.startsWith('player:')) {
      const p = this.G.players.find(q => q.id === +key.slice(7)); if (p) at(p.x, p.y, 5);
    }
    return out;
  }
  field(key) {
    let f = this.fields[key];
    const stale = !f || f.force || f.ver !== this.S.version || (key === 'food' && f.foodSig !== this.foodSig()) || (key.startsWith('player:') && this.G.time - f.at > .5) || (key === 'dig' && f.plan !== this.planAt);
    if (stale && (!f || this.fieldBudget > 0) && (!f || this.G.time - f.at > .35 || f.force)) {
      this.fieldBudget--;
      if (!f) f = this.fields[key] = { data: new Uint16Array(this.S.n) };
      this.S.field(this.sources(key), f.data);
      f.ver = this.S.version; f.at = this.G.time; f.force = false; f.foodSig = this.foodSig(); f.plan = this.planAt;
    }
    return f.data;
  }
  foodSig() { let s = 0; for (const f of this.W.foods.list) if (this.wantFood(f)) s += f.id * 131 + ((f.x / 20) | 0); return s; }
  /* is this food worth walking to?  A beetle only if there are enough foragers to lift it */
  wantFood(f) {
    if (f.falling || f.carriers.length >= f.need) return false;
    if (f.need <= 1) return true;
    if (f.ignoreUntil > this.G.time) return false;
    return f.carriers.some(c => c.isPlayer) || this.agents.filter(a => a.job === 'forager' && !a.group).length + f.carriers.length >= f.need;
  }

  /* ---------- the main update ---------- */
  update(dt) {
    this.fieldBudget = 2;
    const W = this.W, season = W.season;
    const wasWinter = this.winter;
    this.winter = season === 'winter';
    if (this.winter && !wasWinter) Bus.emit('colonyWinter', this);
    if (!this.winter && wasWinter) Bus.emit('colonySpring', this);
    this.updateBrood(dt);
    if (this.flightJustEnded) { this.flightJustEnded = false; Bus.emit('flightDone', this); }
    if (this.phase === 'founding' && this.royal && !this.done.eggs && !this.brood.length && !this.waitKey) {
      const q = this.G.players[0];
      if (q && q.caste === 'queen') this.layFirstEggs(q);
    }
    if (this.phase === 'growing') {
      this.updateQueen(dt);
      this.honey = Math.max(0, this.honey - this.pop * HONEY_PER_ANT * dt * (this.winter ? .2 : 1));
      this.jobClock -= dt;
      if (this.jobClock <= 0) { this.jobClock = 2; this.assignJobs(); }
      this.planClock = (this.planClock || 0) - dt;
      if (this.planClock <= 0) { this.planClock = .6; this.checkPlan(); if (this.activeDigs(1).length === 0 && this.pop > this.capacity() * .5) this.extendPlan(); }
      for (const a of this.agents) this.updateAgent(a, dt);
      this.updateGroups(dt);
      this.updateCrowd(dt);
      this.checkStages();
      this.updateFlight(dt);
    }
    for (let i = this.trail.length - 1; i >= 0; i--) { const t = this.trail[i]; t.life -= dt / 40; if (t.life <= 0) this.trail.splice(i, 1); }
    this.stats.maxPop = Math.max(this.stats.maxPop, this.pop);
  }
  energy() { return this.honey > 0 || this.pop < 6 ? 1 : .72; }
  broodRate() {
    if (this.winter) return 0;
    const s = this.W.season;
    return (s === 'summer' ? 1.1 : s === 'autumn' ? .8 : 1) / this.G.diff().broodT;
  }

  updateBrood(dt) {
    const S = this.S, rate = this.broodRate();
    this.hungry = 0;
    for (let i = this.brood.length - 1; i >= 0; i--) {
      const b = this.brood[i];
      b.t += dt;
      if (b.carried) {
        if (b.carried.isPlayer && !this.G.players.includes(b.carried)) { b.carried = null; b.claimed = null; }
        else continue;
      }
      /* resting on the floor: if the floor went, it drops */
      if (!S.solidAt(b.x, b.y + 4)) { b.y += 90 * dt; if (b.y > S.Y1) b.y = S.Y1 - 10; }
      const m = S.matAt(b.x, b.y);
      if (m === MAT.WATER) { if (!b.wet) Bus.emit('broodWet', b); b.wet = 1; }
      else b.wet = Math.max(0, b.wet - dt * .15);
      if (b.wet > .3 || rate === 0) continue;
      if (b.kind === 'egg') {
        b.age += dt * rate;
        if (b.age >= BROOD.eggT) { if (this._mile('larvae')) { b.kind = 'larva'; b.age = 0; Bus.emit('hatched', b); } }
      } else if (b.kind === 'larva') {
        if (b.fed >= BROOD.larvaNeed) {
          b.spin += dt * rate;
          if (b.spin >= BROOD.spinT) { if (this._mile('cocoon')) { b.kind = 'pupa'; b.age = 0; Bus.emit('spun', b); } }
        } else this.hungry++;
      } else if (b.kind === 'pupa') {
        b.age += dt * rate;
        if (b.age >= BROOD.pupaT) {
          if (!this.done.worker) { if (this._mile('worker', () => this.firstWorker(b))) { /* handled */ } continue; }
          this.eclose(b);
        }
      }
    }
  }
  /* the first worker walks out of her cocoon: that is the player */
  firstWorker(b) {
    this.phase = 'growing';
    this.brood.splice(this.brood.indexOf(b), 1);
    this.pop += 1; this.stats.raised += 1;
    this.layClock = 10;
    Bus.emit('firstWorker', b, this);
  }
  eclose(b) {
    this.brood.splice(this.brood.indexOf(b), 1);
    if (b.caste === 'alate' && !this.flightDone && !this.flight) { this.alates.push(this.spawnAlate(b)); return; }
    this.pop += b.rep; this.stats.raised += b.rep;
    const n = Math.min(this.visCap() - this.agents.length, b.rep);
    for (let k = 0; k < Math.max(0, n); k++) this.spawnAgent(b.x + rnd(-6, 6), b.y - 4, 'nurse');
    this.W.G.particles.sparkle(b.x, b.y - 6, 10, '#fff3c0', 12);
    Bus.emit('eclosed', b, this);
  }
  checkStages() {
    const next = COLONY_STAGES[this.stage + 1];
    if (next && this.pop >= next.at && !this.waitKey) this._mile(next.key, () => { this.stage++; Bus.emit('stage', this.stage, this); });
  }

  /* ---------- the queen, once the workers take over ---------- */
  makeQueen(x, y) {
    this.queen = { x, y, ang: 0, walk: 0, flip: false, clock: 0, tx: x, ty: y };
  }
  updateQueen(dt) {
    const q = this.queen, room = this.royal; if (!q || !room) return;
    /* she potters about her room */
    q.clock -= dt;
    if (q.clock <= 0) { q.clock = rnd(3, 7); const s = this.floorSpot(room, []); q.tx = s.x; q.ty = s.y - 8; }
    const dx = q.tx - q.x, dy = q.ty - q.y, d = Math.hypot(dx, dy);
    if (d > 2) { q.x += dx / d * 14 * dt; q.y += dy / d * 14 * dt; q.walk += dt * 3; q.ang = dx >= 0 ? 0 : Math.PI; }
    if (!this.S.solidAt(q.x, q.y + 10)) q.y += 30 * dt;
    /* laying */
    if (this.winter || this.flight) return;
    this.layClock -= dt * SEASON_INFO[this.W.season].lay * this.G.diff().growth * this.energy() * (q.fedBoost > 0 ? 1.6 : 1);
    q.fedBoost = Math.max(0, (q.fedBoost || 0) - dt);
    if (this.layClock <= 0) {
      this.layClock = LAY_T;
      const rep = this.rep(), cost = EGG_COST * rep;
      const inPipe = this.brood.reduce((n, b) => n + b.rep, 0);
      if (this.brood.length >= BROOD_CAP) return;
      if (this.pop + inPipe > this.capacity()) { this.crowded = true; return; }
      this.crowded = false;
      if (this.food < cost || this.hungry > 4 + this.pop * .2) { this.starving = true; return; }
      this.starving = false;
      this.food -= cost;
      const caste = this.stage >= 5 && !this.flight && !this.flightDone && (this.alatesPlanned || 0) < 14 && this.W.season === 'summer' ? 'alate' : 'worker';
      if (caste === 'alate') this.alatesPlanned = (this.alatesPlanned || 0) + 1;
      this.addBrood('egg', room, caste === 'alate' ? 1 : rep, this.floorSpot(room, this.brood), caste);
      Bus.emit('queenLaid', this);
    }
  }
  feedQueen() { if (this.queen) { this.queen.fedBoost = 25; this.layClock = Math.min(this.layClock, 1); Bus.emit('fedQueen', this); } }

  /* ---------- storing food ---------- */
  store(kind, value, who) {
    const k = value * (who === 'player' ? Math.max(1, this.scale() * .8) : this.scale());
    if (kind === 'honey') { this.honey += k; this.stats.honeyIn += k; }
    else { this.food += k; this.stats.foodIn += k; }
    if (who === 'player') this.stats.playerFood += k;
    Bus.emit('stored', kind, k, who);
    return k;
  }

  /* ---------- the division of labour ---------- */
  assignJobs() {
    const W = this.W, night = this.G.night > .6, raining = W.weather.raining;
    const larvae = this.brood.filter(b => b.kind === 'larva'), hungry = larvae.filter(b => b.fed < BROOD.larvaNeed).length;
    const wet = this.brood.filter(b => b.wet > .3).length;
    const eggsAway = this.royal && this.nurseries()[0] !== this.royal ? this.brood.filter(b => b.room === this.royal.id && b.kind === 'egg').length : 0;
    const aphids = W.plants.reduce((n, P) => n + P.herd.count(), 0);
    const roomLeft = 1 - this.pop / this.capacity();
    const lb = W.ladybug;
    /* nurses for the feeds that can really happen; hungry babies send ants OUT for food */
    const feedable = Math.min(hungry, (this.food + this.honey / 1.5) / (FOOD_PER_FEED * this.rep()));
    const w = {
      nurse: this.brood.length ? .7 + feedable * .8 + wet * 3 + eggsAway * .4 + this.brood.length * .05 : .15,
      forager: this.winter ? 0 : (2 + (this.food < this.rep() * 8 ? 1.5 + Math.min(hungry, 12) * .25 : 0)) * (night ? .35 : 1) * (raining ? .3 : 1),
      farmer: this.winter || !aphids ? 0 : (1 + (this.honey < this.pop * .4 ? 1.6 : .2)) * (night ? .5 : 1) * (raining ? .4 : 1),
      digger: .6 + (roomLeft < .25 ? 2.8 : 0) + (this.activeDigs(1).length ? .6 : 0),
      guard: .35 + (lb.onPlant ? 2.2 : 0)
    };
    for (const k in this.boost) if (this.boost[k] > this.G.time) w[k] *= 2.4;
    const n = this.agents.length, total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    const t = {}; let used = 0;
    for (const k of JOB_KEYS) { t[k] = Math.floor(w[k] / total * n); used += t[k]; }
    const rem = JOB_KEYS.map(k => [k, w[k] / total * n - t[k]]).sort((a, b) => b[1] - a[1]);
    for (let i = 0; used < n && i < rem.length; i++, used++) t[rem[i][0]]++;
    this.targets = t;
    /* a few ants switch jobs each time; the young stay inside, the old go out */
    const have = { nurse: 0, digger: 0, forager: 0, farmer: 0, guard: 0 };
    for (const a of this.agents) have[a.job]++;
    let moves = Math.max(1, Math.round(n * .08));
    for (const to of JOB_KEYS) {
      while (have[to] < t[to] && moves > 0) {
        const from = JOB_KEYS.filter(k => have[k] > t[k]).sort((a, b) => (have[b] - t[b]) - (have[a] - t[a]))[0];
        if (!from) break;
        const pool = this.agents.filter(a => a.job === from && !a.carry && !a.group && !a.onPlant && !a.crop && !a.help && !a.hasFood && !(a.task && a.task.s !== 'idle' && a.task.s !== 'think'));
        if (!pool.length) break;
        pool.sort((a, b) => to === 'nurse' ? a.age - b.age : b.age - a.age);
        const a = pool[0];
        a.job = to; a.task = null; have[from]--; have[to]++; moves--;
        Bus.emit('jobChange', a, from, to);
      }
    }
  }
  boostJob(job) { this.boost[job] = this.G.time + 60; this.jobClock = 0; Bus.emit('boost', job); }

  /* ---------- the ants you can see ---------- */
  spawnAgent(x, y, job) {
    const a = {
      id: this.nextAgent++, x, y, px: x, py: y, ang: rnd(TAU), walk: rnd(TAU), job, task: null, cell: -1, next: -1,
      carry: null, carryVal: 0, crop: 0, callow: 1, age: 0, onPlant: null, w: null, speed: rnd(68, 86),
      nx: 0, ny: 1, flip: false, wait: 0, bite: 0, tap: 0, dig: 0, load: 0, help: null, lane: rnd(-2.5, 2.5), stuck: 0, idle: 0, side: Math.random() < .5 ? -1 : 1
    };
    const i = this.S.nearestWalkable(x, y, 8);
    if (i >= 0) { a.cell = i; a.x = a.px = this.S.cx(i % this.S.cols); a.y = a.py = this.S.cy((i / this.S.cols) | 0); }
    this.agents.push(a);
    return a;
  }
  /* walk one step down a distance field.  'arrived' | 'moving' | 'stuck' */
  follow(a, key, dt, near = 1) {
    const S = this.S, F = this.field(key);
    if (a.cell < 0 || !S.walk[a.cell]) { a.cell = S.nearestWalkable(a.px, a.py, 8); a.next = -1; if (a.cell < 0) return 'stuck'; }
    const d = F[a.cell];
    if (d === FIELD_FAR) { a.stuck += dt; return 'stuck'; }
    if (d <= near) return 'arrived';
    if (a.next < 0 || F[a.next] >= d) a.next = S.downhill(F, a.cell);
    if (a.next < 0) { a.stuck += dt; return 'stuck'; }
    const tx = S.cx(a.next % S.cols), ty = S.cy((a.next / S.cols) | 0);
    const spd = a.speed * this.energy() * (S.matAt(a.px, a.py) === MAT.WATER && this.G.speciesDef().special !== 'raft' ? .5 : 1) * (a.group ? .6 : 1);
    this.moveTo(a, tx, ty, spd * dt);
    if (dist(a.px, a.py, tx, ty) < 2.5) { a.cell = a.next; a.next = S.downhill(F, a.cell); }
    a.stuck = 0;
    return 'moving';
  }
  moveTo(a, tx, ty, step) {
    const dx = tx - a.px, dy = ty - a.py, d = Math.hypot(dx, dy);
    if (d < .01) return true;
    const k = Math.min(1, step / d);
    a.px += dx * k; a.py += dy * k;
    a.walk += step * .16;
    a.hx = dx / d; a.hy = dy / d;
    return k >= 1;
  }
  /* straight at a point (inside a room, or onto a food item) */
  approach(a, x, y, dt, reach = 6) {
    if (dist(a.px, a.py, x, y) <= reach) return true;
    this.moveTo(a, x, y, a.speed * .8 * dt);
    const i = this.S.nearestWalkable(a.px, a.py, 3); if (i >= 0) a.cell = i;
    return dist(a.px, a.py, x, y) <= reach;
  }
  mount(a, P) {
    const root = P.nodes[0].segs[0];
    a.onPlant = P; a.w = { seg: root, t: P.segs[root].a === 0 ? 0 : 1, dir: 1, route: null, side: a.side };
  }
  dismount(a) {
    const P = a.onPlant; a.onPlant = null; a.w = null;
    const i = this.S.nearestWalkable(P.ox + a.side * 8, P.nodes[0].y - 8, 8);
    if (i >= 0) { a.cell = i; a.next = -1; a.px = this.S.cx(i % this.S.cols); a.py = this.S.cy((i / this.S.cols) | 0); }
  }
  plantStep(a, dt, seg, t) {
    const P = a.onPlant;
    if (!a.w.route || a.w.route.seg !== seg) PlantWalk.goTo(a.w, P, seg, t);
    const r = PlantWalk.follow(a.w, P, a.speed * .75 * dt * this.energy());
    if (r === 'moving') a.walk += dt * 9;
    return r === 'done';
  }
  toRoot(a, dt) { const P = a.onPlant, root = P.nodes[0].segs[0]; if (this.plantStep(a, dt, root, P.segs[root].a === 0 ? 0 : 1)) { this.dismount(a); return true; } return false; }
  dropTrail(a) {
    if (!a.lastTrail || dist(a.lastTrail[0], a.lastTrail[1], a.x, a.y) > 14) {
      a.lastTrail = [a.x, a.y];
      this.trail.push({ x: a.x, y: a.y + 7, life: 1 });
      if (this.trail.length > 500) this.trail.shift();
    }
  }

  updateAgent(a, dt) {
    a.age += dt;
    a.callow = Math.max(0, a.callow - dt / 40);
    a.bite = Math.max(0, a.bite - dt * 3); a.tap = Math.max(0, a.tap - dt); a.dig = Math.max(0, a.dig - dt * 2);
    if (a.wait > 0) { a.wait -= dt; this.place(a, dt); return; }
    /* lost in a pocket nothing can reach: find her way back to the queen's room */
    if (a.stuck > 8 && !a.onPlant && !a.group && this.royal) {
      a.stuck = 0; const s = this.floorSpot(this.royal, []), i = this.S.nearestWalkable(s.x, s.y - 6, 6);
      if (i >= 0) { a.cell = i; a.next = -1; a.px = a.x = this.S.cx(i % this.S.cols); a.py = a.y = this.S.cy((i / this.S.cols) | 0); }
    }
    if (this.winter) this.doWinter(a, dt);
    else if (a.help) this.doHelp(a, dt);
    else if (a.group) { /* carried along by updateGroups */ }
    else this['do_' + a.job](a, dt);
    this.place(a, dt);
  }
  /* where the ant is drawn: on the stem, or pressed to the nearest floor, wall or ceiling */
  place(a, dt) {
    if (a.onPlant) {
      const p = PlantWalk.place(a.w, a.onPlant);
      a.x = p.x; a.y = p.y; a.ang = angleLerp(a.ang, p.ang, 1 - Math.exp(-dt * 10)); a.nx = -p.nx; a.ny = -p.ny;
    } else {
      a.cc = (a.cc || 0) - dt;
      if (a.cc <= 0) { a.cc = .15; const c = this.S.contact(a.px, a.py, 13); if (c.n) { a.nx = c.nx; a.ny = c.ny; } else { a.nx = 0; a.ny = 1; } }
      let gap = 16;
      for (let d = 2; d <= 16; d += 2) if (this.S.solidAt(a.px + a.nx * d, a.py + a.ny * d)) { gap = d; break; }
      const off = gap < 16 ? gap - 8.5 : 0;
      a.x = lerp(a.x, a.px + a.nx * off - a.ny * a.lane * .3, 1 - Math.exp(-dt * 12));
      a.y = lerp(a.y, a.py + a.ny * off + a.nx * a.lane * .3, 1 - Math.exp(-dt * 12));
      if (a.hx !== undefined) a.ang = angleLerp(a.ang, Math.atan2(a.hy, a.hx), 1 - Math.exp(-dt * 10));
    }
    const fx = -Math.sin(a.ang), fy = Math.cos(a.ang);
    a.flip = fx * a.nx + fy * a.ny < 0;
  }
  wander(a, dt, key) {
    a.idle -= dt;
    if (a.idle <= 0 || a.wx === undefined) {
      a.idle = rnd(1.5, 4);
      const S = this.S, j = S.nearestWalkable(a.px + rnd(-40, 40), a.py + rnd(-20, 20), 5);
      if (j >= 0) { a.wx = S.cx(j % S.cols); a.wy = S.cy((j / S.cols) | 0); } else { a.wx = a.px; a.wy = a.py; }
    }
    if (dist(a.px, a.py, a.wx, a.wy) > 3) this.approach(a, a.wx, a.wy, dt * .5, 3);
  }

  /* NURSES: fetch food, feed larvae, carry eggs to the nursery, rescue wet brood */
  do_nurse(a, dt) {
    const T = a.task || (a.task = { s: 'think' });
    if (T.s === 'think') {
      const wet = this.brood.find(b => b.wet > .3 && !b.carried && this.unclaimed(b));
      const dry = this.driestNursery();
      if (wet && dry && dry.id !== wet.room) { wet.claimed = a.id; wet.claimedAt = this.G.time; a.task = { s: 'fetch', b: wet, to: dry.id }; return; }
      const nur = this.nurseries()[0];
      const stray = nur && this.brood.find(b => !b.carried && this.unclaimed(b) && b.kind !== 'larva' && b.room !== nur.id && this.roomById(b.room) && this.roomById(b.room).kind === 'royal' && nur.kind !== 'royal');
      if (stray) { stray.claimed = a.id; stray.claimedAt = this.G.time; a.task = { s: 'fetch', b: stray, to: nur.id }; return; }
      const hungry = this.brood.find(b => this.hungryLarva(b) && this.unclaimed(b));
      if (hungry) { hungry.claimed = a.id; hungry.claimedAt = this.G.time; a.task = { s: 'food', b: hungry }; return; }
      a.task = { s: 'idle', t: rnd(2, 5), room: (pick(this.nurseries()) || this.royal).id };
      return;
    }
    if (T.s === 'fetch') {
      const b = T.b;
      if (!this.brood.includes(b) || b.carried) { a.task = null; return; }
      /* follow the paths to the room, then walk straight to the baby (no more path-following, or she dithers) */
      if (!T.near) { if (this.follow(a, 'room:' + b.room, dt, 3) === 'moving') return; T.near = true; }
      if (this.approach(a, b.x, b.y - 6, dt, 7)) {
        b.carried = a; a.carry = b.kind === 'egg' ? 'egg' : b.kind === 'larva' ? 'larva' : 'pupa'; a.carryBrood = b; T.s = 'deliver'; T.near = false;
      }
      return;
    }
    if (T.s === 'deliver') {
      const room = this.roomById(T.to), b = a.carryBrood;
      if (!room || !b) { a.task = null; return; }
      let r = 'arrived';
      if (!T.near) { r = this.follow(a, 'room:' + room.id, dt, 2); if (r === 'moving') return; T.near = true; }
      {
        const s = T.spot || (T.spot = this.floorSpot(room, this.brood));
        T.t = (T.t || 0) + dt;
        if (this.approach(a, s.x, s.y - 6, dt, 10) || r === 'stuck' || T.t > 12) { b.x = s.x; b.y = s.y; b.room = room.id; b.carried = null; b.claimed = null; b.wet = 0; a.carry = null; a.carryBrood = null; a.task = null; a.wait = .4; }
      }
      return;
    }
    if (T.s === 'food') {
      const b = T.b;
      if (!this.brood.includes(b) || !this.hungryLarva(b)) { if (b) b.claimed = null; a.task = null; return; }
      if (!a.hasFood) {
        const pan = this.nearestRoom(this.pantries(), a);
        if (!pan) { a.task = null; return; }
        const r = this.follow(a, 'room:' + pan.id, dt, 2);
        if (r === 'arrived' || r === 'stuck') {
          const cost = FOOD_PER_FEED * b.rep;
          if (this.food >= cost) { this.food -= cost; a.hasFood = true; a.tap = .5; }
          else if (this.honey >= cost * 1.5) { this.honey -= cost * 1.5; a.hasFood = true; a.tap = .5; }
          else { T.waited = (T.waited || 0) + dt; if (T.waited > 4) { b.claimed = null; a.task = { s: 'idle', t: 2, room: pan.id }; } }
        }
        return;
      }
      if (!T.near) { if (this.follow(a, 'room:' + b.room, dt, 3) === 'moving') return; T.near = true; }
      if (this.approach(a, b.x, b.y - 6, dt, 9)) {
        this.feedLarva(b, false); b.claimed = null; a.hasFood = false; a.tap = 1; a.wait = .9; a.task = null;
      }
      return;
    }
    if (T.s === 'idle') {
      const r = this.follow(a, 'room:' + T.room, dt, 3);
      if (r !== 'moving') { this.wander(a, dt); T.t -= dt; if (T.t <= 0) a.task = null; }
    }
  }
  driestNursery() {
    const ok = this.nurseries().filter(r => !this.roomWet(r));
    return ok.sort((a, b) => a.y - b.y)[0] || (this.royal && !this.roomWet(this.royal) ? this.royal : null);
  }
  roomWet(r) { for (let x = -r.rx * .7; x <= r.rx * .7; x += 8) if (this.S.matAt(r.x + x, r.y + r.ry * .6) === MAT.WATER) return true; return false; }
  nearestRoom(list, a) { return list.slice().sort((p, q) => dist(p.x, p.y, a.px, a.py) - dist(q.x, q.y, a.px, a.py))[0]; }

  /* DIGGERS: dig the next planned tunnel or room, carry the dirt up to the ant hill */
  do_digger(a, dt) {
    const S = this.S, diff = this.G.diff();
    if (a.carry === 'soil' || a.carry === 'sand' || a.carry === 'clay') {
      const r = this.follow(a, 'mound', dt, 2);
      if (r === 'arrived' || (r === 'stuck' && a.stuck > 3)) {
        const e = this.entrance;
        S.addMound(e.x + sign(a.px - e.x) * rnd(60, 110), Math.max(1, Math.round(a.load)));
        a.carry = null; a.load = 0; a.wait = .3; a.stuck = 0;
        Bus.emit('spoil', a);
      }
      return;
    }
    const digs = this.activeDigs(3);
    if (!digs.length) { this.wander(a, dt); return; }
    const p = digs.reduce((b, q) => dist(q.x, q.y, a.px, a.py) < dist(b.x, b.y, a.px, a.py) ? q : b);
    const d = dist(a.px, a.py, p.x, p.y);
    if (d > p.r + 16) { const r = this.follow(a, 'dig', dt, 1); if (r === 'stuck') { if (a.stuck > 3) this.wander(a, dt); return; } if (r !== 'arrived') return; }
    /* bite at the face */
    a.hx = (p.x - a.px) / (d || 1); a.hy = (p.y - a.py) / (d || 1);
    const power = 2.6 * diff.dig * this.energy() * (this.G.speciesDef().special === 'builder' ? 1.3 : 1) * (1 + Math.log2(1 + this.pop / 40) * .6);
    const res = S.dig(p.x, p.y, p.r, power * dt);
    a.dig = 1; a.walk += dt * 6;
    if (res.removed) {
      this.stats.dug += res.removed;
      a.load += res.removed / (1 + this.pop / 200);
      if (chance(.5)) this.G.particles.dust(p.x - a.hx * p.r, p.y - a.hy * p.r, res.sand ? '#d8b878' : '#8a6040', 3, Math.atan2(a.hy, a.hx));
    }
    if (res.blocked > 6 && res.removed === 0 && S.openness(p.x, p.y, p.r * .75, p.r * .75) > .6) p.done = true;
    if (S.openness(p.x, p.y, p.r * .75, p.r * .75) > .82) { p.done = true; this.approach(a, p.x, p.y, dt, 6); }
    if (a.load >= 6) { if (diff.pellets) { a.carry = res.sand ? 'sand' : 'soil'; } else { const e = this.entrance; S.addMound(e.x + rnd(-80, 80), Math.round(a.load)); a.load = 0; } }
  }
  extendPlan() {
    /* the colony keeps growing: plan one more room, off the deepest one */
    const S = this.S, R = Math.random;
    const base = this.rooms.filter(r => r.open >= .7).sort(() => R() - .5)[0] || this.royal;
    for (let k = 0; k < 10; k++) {
      const x = clamp(base.x + (R() - .5) * 500, S.X0 + 120, S.X1 - 120), y = clamp(base.y + 60 + R() * 260, 120, S.Y1 - 80);
      if (this.rooms.some(r => dist(r.x, r.y, x, y) < 130) || this.stoniness(x, y, 56, 20) > .15) continue;
      const kind = R() < .6 ? 'nursery' : 'pantry';
      const room = this.addRoom(kind, x, y, 52 + R() * 12, 19 + R() * 3); room.planned = true;
      const path = this.route(base.x, base.y + base.ry * .4, x, y);
      if (!path) { this.rooms.pop(); continue; }
      for (const [px, py] of path) this.plan.push({ x: px, y: py, r: 11, room: null, done: false });
      for (let yy = -room.ry + 8; yy <= room.ry - 6; yy += 12) for (let xx = -room.rx + 8; xx <= room.rx - 8; xx += 13) if ((xx * xx) / (room.rx * room.rx) + (yy * yy) / (room.ry * room.ry) < .8) this.plan.push({ x: x + xx, y: y + yy, r: 11, room: room.id, done: false });
      return;
    }
  }

  /* FORAGERS: find food on the ground and bring it home, leaving a scent trail */
  do_forager(a, dt) {
    const W = this.W;
    if (a.carry) {
      const pan = this.nearestRoom(this.pantries(), a);
      if (!pan) { a.carry = null; return; }
      if (a.py < W.soil.ground0(a.px) + 20) this.dropTrail(a);
      const r = this.follow(a, 'room:' + pan.id, dt, 2);
      if (r === 'arrived' || (r === 'stuck' && a.stuck > 5)) {
        this.store('food', a.carryVal, 'ant'); a.carry = null; a.carryVal = 0; a.wait = .5; a.stuck = 0;
      }
      return;
    }
    if (this.G.night > .7 || W.weather.raining) { const pan = this.pantries()[0]; if (pan && this.follow(a, 'room:' + pan.id, dt, 4) !== 'moving') this.wander(a, dt); return; }
    const r = this.follow(a, 'food', dt, 1);
    if (r === 'arrived') {
      const f = W.foods.nearest(a.px, a.py, 34, f => this.wantFood(f));
      if (!f) { this.wander(a, dt); return; }
      if (!this.approach(a, f.x, f.y, dt, f.r + 4)) return;
      if (f.need <= 1) {
        W.foods.remove(f); a.carry = f.kind === 'leaf' ? 'leaf' : f.kind; a.carryVal = f.value * (f.kind === 'seed' && this.G.speciesDef().special === 'seeds' ? 2 : 1);
        this.dirtyFields(); Bus.emit('pickup', a, f);
      } else { f.carriers.push(a); a.group = f; this.dirtyFields(); }
    } else if (r === 'stuck') {
      /* nothing to find: stroll by the door */
      if (this.follow(a, 'mound', dt, 3) !== 'moving') this.wander(a, dt);
    }
  }

  /* FARMERS: climb the plant, stroke aphids for honeydew, bring it home */
  do_farmer(a, dt) {
    const W = this.W;
    if (a.onPlant) {
      const P = a.onPlant, lb = W.ladybug;
      if (lb.onPlant && lb.plant === P && dist(lb.x, lb.y, a.x, a.y) < 60) { if (a.bite <= 0) { a.bite = 1; a.wait = .5; lb.hit(.34); } return; }
      if (a.crop >= 3 || this.G.night > .8) { this.toRoot(a, dt); return; }
      let aph = a.aphid && P.herd.list.includes(a.aphid) && a.aphid.dew >= .5 ? a.aphid : null;
      if (!aph) { const ready = P.herd.list.filter(x => x.dew >= .5 && this.unclaimed(x)); aph = ready.length ? ready.reduce((b, x) => dist(x.x, x.y, a.x, a.y) < dist(b.x, b.y, a.x, a.y) ? x : b) : null; if (aph) { aph.claimed = a.id; aph.claimedAt = this.G.time; a.aphid = aph; } }
      if (!aph) { if (a.crop > 0 || chance(dt * .3)) this.toRoot(a, dt); return; }
      if (this.plantStep(a, dt, aph.seg, aph.t) || dist(a.x, a.y, aph.x, aph.y) < 14) {
        const got = P.herd.milk(aph, 1); aph.claimed = null; a.aphid = null;
        if (got) { a.crop = Math.min(3, a.crop + (this.G.speciesDef().special === 'farmer' ? 1.5 : 1)); a.tap = 1.4; a.wait = 1.4; W.G.particles.sparkle(aph.x, aph.y, 5, '#ffd86a', 6); }
      }
      return;
    }
    if (a.crop > 0) {
      const pan = this.nearestRoom(this.pantries(), a); if (!pan) { a.crop = 0; return; }
      if (a.py < W.soil.ground0(a.px) + 20) this.dropTrail(a);
      const r = this.follow(a, 'room:' + pan.id, dt, 2);
      if (r === 'arrived' || (r === 'stuck' && a.stuck > 5)) { this.store('honey', a.crop, 'ant'); a.crop = 0; a.wait = .6; a.tap = .6; a.stuck = 0; }
      return;
    }
    if (this.G.night > .8) { this.wander(a, dt); return; }
    const P = a.farm !== undefined ? W.plantAt(a.farm) : null;
    if (!P || !P.herd.count()) { const best = W.plants.slice().sort((p, q) => q.herd.list.filter(x => x.dew > .4).length - p.herd.list.filter(x => x.dew > .4).length)[0]; a.farm = best.id; return; }
    const r = this.follow(a, 'plant:' + P.id, dt, 1);
    if (r === 'arrived') this.mount(a, P);
    else if (r === 'stuck' && a.stuck > 6) { a.farm = undefined; a.stuck = 0; }
  }

  /* GUARDS: watch the door; go and bite the ladybug larva off the aphids */
  do_guard(a, dt) {
    const W = this.W, lb = W.ladybug;
    if (a.onPlant) {
      if (!(lb.onPlant && lb.plant === a.onPlant)) { this.toRoot(a, dt); return; }
      if (dist(lb.x, lb.y, a.x, a.y) < 34) { if (a.bite <= 0) { a.bite = 1; a.wait = .6; lb.hit(.34); } return; }
      this.plantStep(a, dt, lb.w.seg, lb.w.t);
      return;
    }
    if (lb.onPlant) { const r = this.follow(a, 'plant:' + lb.plant.id, dt, 1); if (r === 'arrived') this.mount(a, lb.plant); return; }
    const r = this.follow(a, 'entrance', dt, 5);
    if (r !== 'moving') this.wander(a, dt);
  }

  /* WINTER: everyone goes down to the deep room and rests */
  doWinter(a, dt) {
    if (a.onPlant) { this.toRoot(a, dt); return; }
    if (a.group) { this.leaveGroup(a); }
    const room = this.winterRoom();
    if (room && this.follow(a, 'room:' + room.id, dt, 3) !== 'moving') { a.walk += 0; if (chance(dt * .2)) this.wander(a, dt * .3); }
  }

  /* HELPERS: answering the player's call */
  callHelp(p) {
    const W = this.W;
    const want = p.carryFood && p.carryFood.need > 1 ? p.carryFood.need - p.carryFood.carriers.length : 3;
    const cands = this.agents.filter(a => !a.help && !a.group && !a.carry && !a.onPlant && !a.crop).sort((a, b) => dist(a.px, a.py, p.x, p.y) - dist(b.px, b.py, p.x, p.y));
    const n = Math.min(cands.length, Math.max(2, want + 1));
    for (let k = 0; k < n; k++) { cands[k].help = { until: this.G.time + 30, p }; cands[k].task = null; }
    Bus.emit('help', p, n);
    return n;
  }
  doHelp(a, dt) {
    const p = a.help.p, W = this.W;
    if (!p || !this.G.players.includes(p) || this.G.time > a.help.until) { a.help = null; return; }
    /* a big thing to carry? grab on */
    const f = p.carryFood;
    if (f && f.need > 1 && f.carriers.length < f.need && !f.carriers.includes(a)) {
      if (dist(a.px, a.py, f.x, f.y) < f.r + 22) { f.carriers.push(a); a.group = f; a.help = null; return; }
    }
    /* the ladybug larva nearby? bite it */
    const lb = W.ladybug;
    if (lb.onPlant && p.onPlant && lb.plant === p.onPlant) {
      if (!a.onPlant) { const r = this.follow(a, 'plant:' + lb.plant.id, dt, 1); if (r === 'arrived') this.mount(a, lb.plant); return; }
      if (dist(lb.x, lb.y, a.x, a.y) < 34) { if (a.bite <= 0) { a.bite = 1; a.wait = .5; lb.hit(.34); } } else this.plantStep(a, dt, lb.w.seg, lb.w.t);
      return;
    }
    if (a.onPlant) { this.toRoot(a, dt); return; }
    const r = this.follow(a, 'player:' + p.id, dt, 2);
    if (r !== 'moving') { this.wander(a, dt); if (p.digging) { const res = this.S.dig(p.x + p.faceX * 16, p.y + p.faceY * 16, 12, 2 * dt); if (res.removed) this.stats.dug += res.removed; a.dig = 1; } }
  }

  /* big food carried by several ants at once (cooperative transport) */
  leaveGroup(a) { const f = a.group; if (f) { const i = f.carriers.indexOf(a); if (i >= 0) f.carriers.splice(i, 1); } a.group = null; }
  updateGroups(dt) {
    const W = this.W;
    for (const f of W.foods.list.slice()) {
      if (!f.carriers.length) continue;
      f.carriers = f.carriers.filter(c => c.isPlayer ? this.G.players.includes(c) && c.carryFood === f : (this.agents.includes(c) && c.group === f));
      const leader = f.carriers.find(c => c.isPlayer) || f.carriers[0];
      if (!leader) continue;
      const enough = f.carriers.length >= f.need;
      if (!leader.isPlayer) {
        if (enough) {
          const r = this.follow(leader, 'entrance', dt, 2);
          f.x = lerp(f.x, leader.px + (leader.hx || 0) * 16, 1 - Math.exp(-dt * 8)); f.y = lerp(f.y, leader.py - 4, 1 - Math.exp(-dt * 8));
          if (r === 'arrived') this.cutUp(f);
          /* no way home from here: put it down and try something else */
          else if (r === 'stuck') { f.stuckT = (f.stuckT || 0) + dt; if (f.stuckT > 20) { f.stuckT = 0; for (const c of f.carriers.slice()) this.leaveGroup(c); f.ignoreUntil = this.G.time + 45; this.dirtyFields(); } }
          else f.stuckT = 0;
        } else { f.wait = (f.wait || 0) + dt; if (f.wait > 20) { for (const c of f.carriers.slice()) if (!c.isPlayer) this.leaveGroup(c); f.wait = 0; f.ignoreUntil = this.G.time + 45; this.dirtyFields(); } }
      }
      /* the others hold on round the edge */
      f.carriers.forEach((c, i) => {
        if (c.isPlayer || c === leader && !leader.isPlayer) return;
        const ang = (i / f.carriers.length) * Math.PI + Math.PI;
        const tx = f.x + Math.cos(ang) * f.r * .9, ty = f.y + Math.sin(ang) * f.r * .35 + 4;
        c.px = lerp(c.px, tx, 1 - Math.exp(-dt * 10)); c.py = lerp(c.py, ty, 1 - Math.exp(-dt * 10));
        c.hx = f.x - c.px; c.hy = f.y - c.py; const l = Math.hypot(c.hx, c.hy) || 1; c.hx /= l; c.hy /= l;
        c.walk += dt * (enough ? 9 : 2); c.bite = .6;
        const j = this.S.nearestWalkable(c.px, c.py, 3); if (j >= 0) c.cell = j;
      });
    }
  }
  /* at the door the ants cut big food into pieces that fit the tunnels */
  cutUp(f) {
    const W = this.W, helpers = f.carriers.slice();
    W.foods.remove(f);
    this.stats.bigFood++;
    W.G.particles.sparkle(f.x, f.y, 24, '#ffe9a0', 26);
    const share = f.value / Math.max(1, helpers.length);
    for (const c of helpers) {
      if (c.isPlayer) { c.carryFood = null; c.carry = 'bug'; c.carryVal = share; continue; }
      c.group = null; c.help = null; c.carry = 'bug'; c.carryVal = share;
      if (c.job !== 'forager') { c.job = 'forager'; c.task = null; }
    }
    this.dirtyFields();
    Bus.emit('bigFood', f, helpers.length);
  }

  /* the extra ants of a big colony: little shapes busy in the tunnels */
  updateCrowd(dt) {
    const S = this.S, want = clamp(Math.round((this.pop - this.agents.length) / 14), 0, 260);
    while (this.crowd.length < want) {
      const room = pick(this.rooms.filter(r => r.open >= .7)) || this.royal; if (!room) break;
      const i = S.nearestWalkable(room.x + rnd(-room.rx, room.rx), room.y + rnd(-room.ry, room.ry), 6); if (i < 0) break;
      this.crowd.push({ cell: i, x: S.cx(i % S.cols), y: S.cy((i / S.cols) | 0), tx: 0, ty: 0, ang: 0, walk: rnd(TAU), next: -1, pause: 0 });
    }
    if (this.crowd.length > want) this.crowd.length = want;
    const cols = S.cols;
    for (const c of this.crowd) {
      if (c.pause > 0) { c.pause -= dt; continue; }
      if (c.next < 0 || !S.walk[c.next]) {
        const opts = [];
        for (const d of [-1, 1, -cols, cols, -cols - 1, -cols + 1, cols - 1, cols + 1]) { const j = c.cell + d; if (j > 0 && j < S.n && S.walk[j] && S.row(S.cy((j / cols) | 0)) > S.surfRow0[j % cols]) opts.push(j); }
        if (!opts.length) { c.pause = 1; continue; }
        /* keep going the same way most of the time */
        const fwd = opts.filter(j => (S.cx(j % cols) - c.x) * Math.cos(c.ang) + (S.cy((j / cols) | 0) - c.y) * Math.sin(c.ang) > 0);
        c.next = pick(fwd.length && chance(.85) ? fwd : opts);
        if (chance(.04)) c.pause = rnd(.3, 1.2);
      }
      const tx = S.cx(c.next % cols), ty = S.cy((c.next / cols) | 0);
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
      if (d < 1.5) { c.cell = c.next; c.next = -1; continue; }
      const st = Math.min(d, 60 * dt);
      c.x += dx / d * st; c.y += dy / d * st; c.ang = Math.atan2(dy, dx); c.walk += st * .2;
    }
  }

  /* ---------- the flight of the princesses ---------- */
  spawnAlate(b) {
    return { x: b.x, y: b.y - 6, phase: 'walk', cell: this.S.nearestWalkable(b.x, b.y - 6, 6), next: -1, ang: 0, walk: 0, flap: 0, male: Math.random() < .45, vx: 0, vy: 0 };
  }
  updateFlight(dt) {
    if (this.stage < 5 || this.flightDone) return;
    const S = this.S;
    /* winged ants walk up and wait on the ant hill */
    for (const w of this.alates) {
      if (w.phase === 'walk') {
        const F = this.field('entrance');
        if (w.cell < 0) { w.cell = S.nearestWalkable(w.x, w.y, 8); continue; }
        if (F[w.cell] <= 2) { w.phase = 'wait'; continue; }
        if (w.next < 0 || F[w.next] >= F[w.cell]) w.next = S.downhill(F, w.cell);
        if (w.next < 0) { w.phase = 'wait'; continue; }
        const tx = S.cx(w.next % S.cols), ty = S.cy((w.next / S.cols) | 0), dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
        const st = Math.min(d, 55 * dt); w.x += dx / (d || 1) * st; w.y += dy / (d || 1) * st; w.ang = Math.atan2(dy, dx); w.walk += st * .2;
        if (d < 2) { w.cell = w.next; w.next = -1; }
      } else if (w.phase === 'wait') {
        w.walk += dt * 2; w.flap += dt * 3;
      } else if (w.phase === 'fly') {
        w.flap += dt * 60; w.vy -= 60 * dt; w.x += w.vx * dt; w.y += w.vy * dt;
      }
    }
    const ready = this.alates.filter(w => w.phase === 'wait').length;
    if (!this.flight && this.alates.length >= 8 && ready >= this.alates.length * .8 && this.G.night < .3 && !this.W.weather.raining) {
      this.flight = { t: 0 };
      for (const w of this.alates) { w.phase = 'fly'; w.vx = rnd(-50, 50); w.vy = rnd(-40, -10); }
      Bus.emit('flight', this);
    }
    if (this.flight) {
      this.flight.t += dt;
      if (this.flight.t > 9) {
        this.flightDone = true; this.alates.length = 0; this.flight = null;
        for (const b of this.brood) b.caste = 'worker';
        Bus.emit('flightDone', this);
      }
    }
  }

  /* ---------- saving ---------- */
  serialize() {
    return {
      phase: this.phase, pop: this.pop, food: this.food, honey: this.honey, stage: this.stage, done: this.done,
      brood: this.brood.map(b => [b.kind, b.rep, +b.x.toFixed(1), +b.y.toFixed(1), b.room, +b.age.toFixed(1), b.fed, +b.spin.toFixed(1), b.caste]),
      rooms: this.rooms.map(r => [r.id, r.kind, +r.x.toFixed(1), +r.y.toFixed(1), r.rx, r.ry, +r.open.toFixed(2), r.planned ? 1 : 0]),
      plan: this.plan.map(p => [+p.x.toFixed(1), +p.y.toFixed(1), p.r, p.room, p.done ? 1 : 0]), planAt: this.planAt,
      entrance: this.entrance, entryX: this.entryX, queen: this.queen ? [this.queen.x, this.queen.y] : null, queenReserve: this.queenReserve,
      agents: this.agents.map(a => [a.job, +a.px.toFixed(1), +a.py.toFixed(1), +a.age.toFixed(0), ['seed', 'crumb', 'bug', 'leaf', 'soil', 'sand'].includes(a.carry) ? a.carry : null, +(a.carryVal || 0).toFixed(1), +(a.crop || 0).toFixed(1), a.hasFood ? 1 : 0]),
      alates: this.alates.filter(w => w.phase !== 'fly').map(w => [+w.x.toFixed(1), +w.y.toFixed(1), w.male ? 1 : 0]), flying: this.flight ? 1 : 0,
      stats: this.stats, layClock: this.layClock, nextRoom: this.nextRoom, flightDone: this.flightDone, alatesPlanned: this.alatesPlanned || 0
    };
  }
  restore(o) {
    const num = (v, d = 0) => Number.isFinite(+v) ? +v : d;
    Object.assign(this, { phase: o.phase === 'growing' ? 'growing' : 'founding', pop: Math.max(0, num(o.pop)), food: Math.max(0, num(o.food)), honey: Math.max(0, num(o.honey)), stage: clamp(num(o.stage), 0, COLONY_STAGES.length - 1) | 0, done: o.done && typeof o.done === 'object' ? o.done : {}, planAt: o.planAt || 0, entrance: o.entrance, entryX: o.entryX, queenReserve: o.queenReserve || 1, layClock: o.layClock || 6, nextRoom: o.nextRoom || 1, flightDone: !!o.flightDone || !!o.flying, alatesPlanned: o.alatesPlanned || 0 });
    Object.assign(this.stats, o.stats || {});
    this.rooms = (o.rooms || []).map(([id, kind, x, y, rx, ry, open, planned]) => ({ id, kind, x, y, rx, ry, open, planned: !!planned }));
    this.plan = (o.plan || []).map(([x, y, r, room, done]) => ({ x, y, r, room, done: !!done }));
    this.brood = (o.brood || []).map(([kind, rep, x, y, room, age, fed, spin, caste]) => ({ id: this.nextBrood++, kind, rep, x, y, room, age, fed, spin, wet: 0, t: rnd(TAU), carried: null, caste: caste || 'worker' }));
    if (o.queen) this.makeQueen(o.queen[0], o.queen[1]);
    this.agents = [];
    for (const [job, x, y, age, carry, carryVal, crop, hasFood] of o.agents || []) {
      if (!JOBS[job] || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      const a = this.spawnAgent(x, y, job); a.age = age || 0; a.callow = 0;
      if (carry) { a.carry = carry; a.carryVal = carryVal || 0; if (carry === 'soil' || carry === 'sand') a.load = 6; }
      a.crop = crop || 0; a.hasFood = !!hasFood;
    }
    /* saved in the middle of the flight: it is over, so offer the next generation */
    if (o.flying && !o.flightDone) this.flightJustEnded = true;
    this.alates = (o.alates || []).map(([x, y, male]) => Object.assign(this.spawnAlate({ x, y: y + 6 }), { male: !!male }));
    /* every princess ever planned is still somewhere (brood or waiting), so the flight can happen */
    if (!this.flightDone) this.alatesPlanned = this.brood.filter(b => b.caste === 'alate').length + this.alates.length;
  }
}
