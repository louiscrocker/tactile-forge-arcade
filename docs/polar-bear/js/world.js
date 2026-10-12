/* ============================================================
   world.js — the Arctic coast and everything living on it
   ============================================================
   THE FAMILY  your mother (she wears a radio collar) and your
               twin.  Where they are and what they do depends on
               the story's phase (set by the director in main.js):
               in the snow den, outside it in March, the long walk
               to the sea, the spring sea ice (Mum still-hunts at a
               breathing hole), the ice breaking up, summer on the
               shore, the yearling's spring on the ice; then other
               bears: young males sparring, the bear you meet in
               spring, a big male, and at last your own cubs.
   VISITORS    seals (at their breathing holes, and resting on the
               ice: they always slip away), Arctic foxes (they
               follow bears and trot off when you come close),
               lemmings and snow buntings to pounce at (they always
               get away), scents on the wind, tracks in the snow,
               caribou on the tundra, belugas in the summer sea,
               the scientists' tundra buggy, a meal Mum found.
   THE PLACE   the den hill and its drift, the big rock, the sea
               ice (holes, a lead, pressure ridges), floes, the
               weather and the seasons.
   Nothing here ever hurts anybody: seals slip away, pounces miss,
   a play-fight is a roll in the snow, a fox only trots off.
   ============================================================ */
'use strict';

const TRACK_KINDS = {
  bear: { name: 'polar bear', say: 'Polar bear tracks: huge round prints with five toes, as wide as a dinner plate.' },
  fox: { name: 'Arctic fox', say: 'Arctic fox tracks: neat little prints in a line, like a small dog\'s.' },
  hare: { name: 'Arctic hare', say: 'Arctic hare tracks: two long back feet land in front of the little front feet.' },
  caribou: { name: 'caribou', say: 'Caribou tracks: two big round toes, like a split moon.' },
  ptarmigan: { name: 'ptarmigan', say: 'Ptarmigan tracks: a bird\'s three toes forward, with feathery feet for snowshoes.' },
  lemming: { name: 'lemming', say: 'Lemming tracks: tiny prints from one snow hole to the next.' },
  wolf: { name: 'Arctic wolf', say: 'Arctic wolf tracks: four toes and claw marks, in a long straight line.' }
};
const SCENT_KINDS = {
  seal: { col: '#9ab4c8', name: 'seal' }, fox: { col: '#e8e0c8', name: 'Arctic fox' }, caribou: { col: '#c8a070', name: 'caribou' },
  whale: { col: '#bfe4f0', name: 'beluga whale' }, goose: { col: '#d8d0a0', name: 'snow goose' }, kelp: { col: '#8aa86a', name: 'kelp' }
};
const FAMILY_FORMS = ['cream', 'snow', 'gold'];

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    const R = this.R = mulberry32(seed + 77);
    this.ground = new Ground(seed);
    const S = this.ground, W = WORLD;
    this.t = 0; this.phase = 'den';
    /* ---------- shelter: the big rock on the tundra, and the pressure ridges ---------- */
    this.rocks = [{ x: W.rockX, big: true, h: 70, w: 64, seed: 7 }];
    for (const x of [-520, 880, 1640, 2080, 2340]) this.rocks.push({ x: x + (R() - .5) * 60, big: false, h: 26 + R() * 18, w: 30 + R() * 16, seed: (R() * 997) | 0 });
    for (const r of this.rocks) r.y = S.surfaceAt(r.x);
    /* ---------- tracks: along the walk to the sea, and out on the ice ---------- */
    this.tracks = [];
    [[880, 'fox'], [1080, 'hare'], [1480, 'ptarmigan'], [1760, 'caribou'], [2050, 'lemming'], [2360, 'wolf'], [3000, 'bear'], [3700, 'fox'], [4600, 'bear'], [6100, 'fox']].forEach(([x, k]) => this.tracks.push({ x: x + (R() - .5) * 40, kind: k, seen: false, dir: R() < .5 ? 1 : -1 }));
    /* ---------- seals' breathing holes in the ice ---------- */
    this.holes = W.holes.map(x => ({ x, up: 0, puff: 0, t: R() * 5 }));
    /* ---------- living things ---------- */
    this.pack = []; this.cubs = []; this.foxes = []; this.hoppers = []; this.scents = []; this.herd = []; this.belugas = [];
    this.bask = null; this.buggy = null; this.meal = null; this.newDen = null;
    this.weather = { state: 'clear', timer: 60 + R() * 60, rain: 0, snow: 0, cloud: .15, gust: 0, white: 0 };
    this.season = 'winter'; this.humid = .5; this.aurora = 0;
    this.still = null; this.lostMode = null;
    /* it starts in midwinter: snow on the land, ice on the sea */
    this.winter(true);
    this.makePack();
  }

  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }
  get den() { return this.ground.den; }

  /* ============================================================
     THE FAMILY
     ============================================================ */
  makePack() {
    const R = this.R, d = this.den, G = this.G;
    const mum = new BearNPC(this, { role: 'mum', sex: 'girl', form: G.form === 'gold' ? 'gold' : 'cream', kg: 190, x: d.cx - 6, y: d.cy + 6, collar: true });
    mum.mode = 'lie'; mum.inDen = true; mum.face = 1;
    const twin = new BearNPC(this, { role: 'twin', sex: G.sex === 'boy' ? 'girl' : 'boy', form: R() < .5 ? G.form : 'snow', kg: .6, x: d.cx + 24, y: d.cy + 12 });
    twin.mode = 'lie'; twin.inDen = true;
    this.pack = [mum, twin];
  }
  twin() { return this.pack.find(n => n.role === 'twin'); }
  mum() { return this.pack.find(n => n.role === 'mum'); }
  mate() { return this.pack.find(n => n.role === 'mate'); }
  /* the family's phase: where everybody goes */
  setPhase(ph, p) {
    this.phase = ph;
    const d = this.den, W = WORLD, S = this.ground, R = this.R;
    const place = (n, x, mode = 'walk') => { n.goal = x; n.mode = mode; n.inDen = false; n.x = x; n.y = S.walkTop(x, 22) - n.feet; n.still = false; };
    const mum = this.mum(), twin = this.twin();
    if (ph === 'outside') {
      /* March: Mum has broken open the den; she lies at the mouth, the twin tumbles about */
      if (mum) { place(mum, d.x + 50, 'lie'); mum.home = d.x + 50; mum.roam = 0; mum.face = 1; }
      if (twin) { twin.kg = p.kg * .95; place(twin, d.x + 110); twin.home = d.x + 130; twin.roam = 110; }
      this.makeFoxes(1, d.x + 420);
    } else if (ph === 'trek') {
      /* the long walk to the sea ice: Mum leads, the twin and you follow */
      if (mum) { place(mum, p.x + 90); mum.lineK = 0; mum.roam = 0; }
      if (twin) { twin.kg = p.kg * .95; place(twin, p.x + 40); twin.lineK = 1; twin.roam = 0; }
      this.route = [W.rockX + 120, 1900, W.shoreX - 80, W.shoreX + 260, W.holes[0] - 120]; this.routeK = 0;
      this.makeHerd(); this.makeFoxes(1, p.x + 600);
    } else if (ph === 'ice') {
      /* out on the frozen sea: Mum lies still beside a seal's breathing hole */
      this.route = null;
      /* she walks on to the hole (or is put there if she is far away) and lies flat beside it */
      if (mum) { const hx = W.holes[0] - 34; if (Math.abs(mum.x - hx) > 700 || mum.inDen) place(mum, hx - 200); mum.inDen = false; mum.goal = hx; mum.mode = 'walk'; mum.stillAt = hx; mum.face = 1; mum.home = hx; mum.roam = 0; }
      if (twin) { twin.kg = p.kg * .95; if (Math.abs(twin.x - W.holes[0]) > 700 || twin.inDen) place(twin, W.holes[0] - 300); twin.inDen = false; twin.goal = W.holes[0] - 110; twin.mode = 'walk'; twin.home = W.holes[0] - 110; twin.roam = 60; }
      this.herd.length = 0;
      this.foxes.length = 0; this.makeFoxes(1, W.holes[0] - 400);
      this.makeBask(W.holes[0] + 420);
    } else if (ph === 'breakup') {
      /* early summer: the ice has broken into floes; Mum swims for the shore */
      if (mum) { mum.still = false; place(mum, Math.min(mum.x, p.x + 60)); mum.lineK = 0; mum.roam = 0; }
      if (twin) { twin.kg = p.kg * .95; place(twin, p.x + 20); twin.lineK = 1; twin.roam = 0; }
      this.route = [W.shoreX - 160]; this.routeK = 0; this.bask = null;
    } else if (ph === 'shore') {
      /* summer on land: Mum rests on the beach, the twin plays; lemmings on the tundra, the buggy, belugas */
      this.route = null;
      if (mum) { place(mum, W.shoreL + 120, 'lie'); mum.home = mum.x; mum.roam = 40; }
      if (twin) { twin.kg = p.kg * .95; place(twin, W.shoreL - 40); twin.home = W.shoreL; twin.roam = 140; }
      this.foxes.length = 0; this.makeFoxes(1, W.tundraR - 500);
      this.hoppers.length = 0; this.makeHoppers(9, W.tundraR - 900, W.tundraR - 120);
      this.buggy = { x: W.buggyX, wave: 0, met: !!this.buggyMetSaved };
      this.makeBelugas();
    } else if (ph === 'ice2') {
      /* a yearling's spring on the ice: Mum at one hole, a free hole for you, a resting seal to creep up on */
      this.route = null; this.hoppers.length = 0; this.buggy = null; this.belugas.length = 0;
      if (mum) { place(mum, W.holes[1] - 34, 'still'); mum.face = 1; mum.home = mum.x; mum.roam = 0; mum.still = true; }
      if (twin) { twin.kg = p.kg * .96; place(twin, W.holes[0] + 140); twin.home = twin.x; twin.roam = 120; }
      this.foxes.length = 0; this.makeFoxes(1, W.holes[1] - 300);
      this.makeBask(W.holes[0] + 380);
    } else if (ph === 'alone') {
      /* on your own: the family has gone its own ways; young males spar far out on the ice */
      this.pack.length = 0; this.cubs.length = 0;
      this.route = null; this.meal = null;
      const a = new BearNPC(this, { role: 'young', sex: 'boy', form: 'cream', kg: 150, x: W.sparX - 30 }), b = new BearNPC(this, { role: 'young', sex: 'boy', form: 'snow', kg: 140, x: W.sparX + 30 });
      a.face = 1; b.face = -1; a.mode = b.mode = 'spar'; a.home = a.x; b.home = b.x; a.partner = b; b.partner = a;
      this.pack = [a, b];
      this.foxes.length = 0; this.makeFoxes(1, p.x + 500);
      this.makeBask(W.holes[1] + 360);
    } else if (ph === 'adult') {
      /* a grown bear in spring: somewhere far out is another bear's scent */
      this.pack.length = 0; this.cubs.length = 0; this.bask = null;
      this.foxes.length = 0; this.makeFoxes(1, p.x - 300);
    } else if (ph === 'shore2') {
      /* the grown bear's summer ashore: (boy) other big males rest and spar on the beach */
      this.pack = this.pack.filter(n => n.role === 'bigmale');
      this.route = null; this.bask = null; this.meal = null;
      if (p.sex === 'boy') {
        const b1 = this.pack.find(n => n.role === 'bigmale') || new BearNPC(this, { role: 'bigmale', sex: 'boy', form: 'gold', kg: 420, x: W.shoreL + 260 });
        place(b1, W.shoreL + 260, 'lie'); b1.home = b1.x; b1.roam = 50;
        const b2 = new BearNPC(this, { role: 'bigmale', sex: 'boy', form: 'cream', kg: 380, x: W.shoreL + 420 }); place(b2, W.shoreL + 420, 'lie'); b2.home = b2.x; b2.roam = 40;
        this.pack = [b1, b2];
      } else this.pack = [];
      this.foxes.length = 0; this.makeFoxes(1, W.tundraR - 400);
      this.hoppers.length = 0; this.makeHoppers(6, W.tundraR - 700, W.tundraR - 100);
      this.makeBelugas();
    } else if (ph === 'parent') {
      /* the girl's den: she is inside; the snow will come */
      this.pack.length = 0; this.foxes.length = 0; this.hoppers.length = 0; this.belugas.length = 0;
    }
  }
  /* the girl's own cubs: born in her den, or out on the snow beside it */
  makeOwnCubs(inside) {
    const nd = this.newDen, R = this.R, S = this.ground, G = this.G;
    this.cubs = [];
    for (let k = 0; k < 2; k++) {
      const q = new BearNPC(this, { role: 'owncub', sex: k ? 'girl' : 'boy', form: R() < .5 ? G.form : 'snow', kg: inside ? .6 : 11, x: inside ? nd.cx + (k - .5) * 16 : nd.x - nd.dir * (90 + k * 34) });
      if (inside) { q.mode = 'lie'; q.inDen = true; q.y = nd.cy + 8; q.roam = 0; }
      else { q.home = q.x; q.roam = 60; q.y = S.walkTop(q.x, 22) - q.feet; }
      q.sib = k; this.cubs.push(q);
    }
  }
  /* the family heard you (in the whiteout) and came back: they gather round and go on from here */
  familyCameBack(p) {
    const S = this.ground;
    this.lostMode = null;
    const mum = this.mum(), twin = this.twin();
    if (mum) { mum.x = p.x + 70; mum.goal = mum.x; mum.mode = 'stand'; mum.chuff = 2; mum.y = S.walkTop(mum.x, 22) - mum.feet; }
    if (twin) { twin.x = p.x + 30; twin.goal = twin.x; twin.mode = 'stand'; twin.y = S.walkTop(twin.x, 22) - twin.feet; }
  }
  packHead() { let h = null; for (const n of this.pack) if (!n.inDen && (h === null || n.x > h)) h = n.x; return h; }
  /* the leader walks the route; she waits when you fall behind (unless the whiteout has swallowed her) */
  updateFamilyTravel(dt, p) {
    const route = this.route; if (!route) return;
    const lead = this.mum() || this.pack[0]; if (!lead) return;
    const target = route[Math.min(this.routeK, route.length - 1)], dir = sign(target - lead.x);
    const behind = (lead.x - p.x) * dir;
    this.waiting = behind > 300 && !this.lostMode;
    if (this.lostMode) lead.goal = this.lostMode.x;
    else if (this.waiting) lead.goal = lead.x;
    else lead.goal = target;
    if (Math.abs(lead.x - target) < 8 && this.routeK < route.length - 1 && !this.waiting) this.routeK++;
    if (lead.mode !== 'lie') lead.mode = Math.abs(lead.goal - lead.x) > 3 ? 'walk' : 'stand';
    for (const n of this.pack) {
      if (n === lead || n.role !== 'twin') continue;
      n.goal = lead.x - (dir || 1) * 50; n.mode = Math.abs(n.goal - n.x) > 4 ? 'walk' : 'stand';
    }
  }

  /* ============================================================
     VISITORS
     ============================================================ */
  makeFoxes(n, x) {
    const R = this.R;
    for (let k = 0; k < n; k++) this.foxes.push({ x: x + (R() - .5) * 160, y: 0, state: 'sit', t: R() * 5, ph: R() * TAU, dir: R() < .5 ? -1 : 1, home: x, vx: 0, scared: false });
  }
  makeHoppers(n, x0, x1) {
    const R = this.R, S = this.ground;
    for (let k = 0; k < n; k++) { const x = lerp(x0, x1, R()); this.hoppers.push({ x, home: (x0 + x1) / 2, span: (x1 - x0) / 2 + 40, y: S.walkTop(x, 3), kind: R() < .65 ? 'lemming' : 'bunting', vx: 0, vy: 0, air: 0, tired: 0, ph: R() * TAU, dir: 1, hopped: false, hidden: 0 }); }
  }
  makeHerd() {
    const R = this.R, S = this.ground, x0 = 1720;
    this.herd = [];
    for (let k = 0; k < 7; k++) { const x = x0 + (R() - .5) * 300; this.herd.push({ x, y: S.walkTop(x, 22), kind: 'caribou', bull: k === 0, s: .8 + R() * .3, ph: R() * TAU, dir: R() < .5 ? -1 : 1, vx: 0, graze: R() * 4, home: x }); }
  }
  makeBelugas() {
    const R = this.R; this.belugas = [];
    for (let k = 0; k < 5; k++) this.belugas.push({ x: WORLD.shoreX + 420 + k * 260 + R() * 120, t: R() * 6, period: 5 + R() * 4, dir: R() < .5 ? -1 : 1 });
  }
  /* a seal resting on the ice beside its own little hole */
  makeBask(x) {
    const S = this.ground;
    this.bask = { x, y: S.walkTop(x, 10), dir: -1, look: 0, lookT: 2.5, lookHold: 0, state: 'bask', t: 0, alpha: 1 };
    return this.bask;
  }
  spawnScent(p) {
    const R = this.R, kinds = this.phase === 'shore' || this.phase === 'shore2' ? ['fox', 'whale', 'goose', 'kelp', 'caribou'] : this.phase === 'trek' ? ['caribou', 'fox', 'goose', 'seal'] : ['seal', 'fox', 'whale', 'seal'];
    const x = p.x + (R() < .5 ? -1 : 1) * (90 + R() * 220), y = this.ground.walkTop(x, 4) - 8 - R() * 18;
    this.scents.push({ x, y, kind: kinds[(R() * kinds.length) | 0], t: 0, ph: R() * TAU, life: 40 + R() * 30, sniffed: false, vx: (R() - .5) * 3 });
  }
  scentNear(x, y, r) { return this.scents.find(s => !s.sniffed && Math.hypot(s.x - x, (s.y - y) * .7) < r); }
  trackNear(x, r) { return this.tracks.find(t => !t.seen && Math.abs(t.x - x) < r && !this.inWater(t.x, this.ground.walkTop(t.x, 4) + 2)); }
  holeNear(x, r) { return this.holes.find(h => Math.abs(h.x - x) < r && this.ground.iceOn && this.ground.iceMode !== 'floes'); }
  hopperNear(x, y, r) { return this.hoppers.find(h => h.air <= 0 && h.hidden <= 0 && Math.hypot(h.x - x, (h.y - y) * .6) < r); }
  foxNear(x, r) { return this.foxes.find(f => Math.abs(f.x - x) < r); }
  /* Mum found a meal (what it is stays off screen): a tidy bundle on the ice beside her */
  spawnMeal(x) {
    const S = this.ground;
    this.meal = { x, y: S.walkTop(x, 6) - 3, taken: false, t: 0 };
    return this.meal;
  }

  updateFoxes(dt, p) {
    const S = this.ground, R = this.R;
    for (const f of this.foxes) {
      f.t += dt; f.ph += dt * (Math.abs(f.vx) > 5 ? 10 : 1);
      const near = Math.abs(p.x - f.x) < 70 && Math.abs(p.y - f.y) < 80;
      if (near && f.state !== 'run') { f.state = 'run'; f.t = 0; f.dir = sign(f.x - p.x); f.home = clamp(f.x + f.dir * (160 + R() * 80), WORLD.left + 60, WORLD.right - 60); if (!f.scared) { f.scared = true; Bus.emit('foxNear', f); } }
      if (f.state === 'run') { f.vx = f.dir * 120; if (Math.abs(f.x - f.home) < 10 || f.t > 3) { f.state = 'sit'; f.vx = 0; f.dir = sign(p.x - f.x); } }
      else if (f.state === 'trot') { f.vx = f.dir * 30; if (Math.abs(f.x - f.home) > 120) f.dir = sign(f.home - f.x); if (R() < dt * .3) { f.state = 'sit'; f.vx = 0; f.dir = sign(p.x - f.x); } }
      else { f.vx = 0; if (R() < dt * .2) { f.state = 'trot'; f.dir = R() < .5 ? -1 : 1; } }
      /* foxes do not swim out into open water */
      const nx = f.x + f.vx * dt;
      if (!this.inWater(nx, S.walkTop(nx, 6) + 2)) f.x = nx; else { f.dir *= -1; f.state = 'trot'; }
      f.y = S.walkTop(f.x, 6);
    }
  }
  updateHoppers(dt, p) {
    const S = this.ground, R = this.R;
    for (const h of this.hoppers) {
      h.ph += dt; h.hidden = Math.max(0, h.hidden - dt);
      const gy = S.walkTop(h.x, 3);
      if (h.air > 0) {
        h.air -= dt; h.vy += 420 * dt; h.x += h.vx * dt; h.y += h.vy * dt;
        if (h.y >= gy) { h.y = gy; h.air = 0; h.vx = 0; h.vy = 0; }
      } else {
        h.y = gy; h.tired = Math.max(0, h.tired - dt * .5);
        const d = Math.abs(p.x - h.x);
        if (h.hidden <= 0 && d < 26 && h.tired < 1 && Math.abs(p.y - h.y) < 50) this.hop(h, sign(h.x - p.x) || 1, 1);
        else if (R() < dt * .08) this.hop(h, R() < .5 ? -1 : 1, .4);
      }
      h.x = clamp(h.x, h.home - h.span, h.home + h.span);
    }
  }
  /* a lemming dives into its burrow for a while; a bunting flutters up */
  hop(h, dir, k) { h.air = .5 + k * .3; h.vx = dir * (h.kind === 'lemming' ? 40 : 90) * (.6 + k); h.vy = -(h.kind === 'lemming' ? 60 : 160) * (.5 + k * .6); h.dir = dir; h.tired += .5; h.hopped = true; if (h.kind === 'lemming' && k >= 1) h.hidden = 3 + this.R() * 2; }
  updateScents(dt, p) {
    for (let i = this.scents.length - 1; i >= 0; i--) {
      const s = this.scents[i]; s.t += dt; s.ph += dt;
      s.x += (s.vx + Math.sin(s.ph * .5) * 2) * dt; s.y += Math.cos(s.ph * .3) * 1.5 * dt;
      const gy = this.ground.walkTop(s.x, 4); if (s.y > gy - 4) s.y = gy - 4; if (s.y < gy - 40) s.y = gy - 40;
      if (s.t > s.life || s.sniffed && s.t > s.sniffedAt + 1.5 || Math.abs(s.x - p.x) > 900) this.scents.splice(i, 1);
    }
    const want = (['trek', 'ice', 'shore', 'ice2', 'alone', 'shore2'].includes(this.phase)) && p.age >= 3 ? 4 : 0;
    if (this.scents.length < want && this.R() < dt * .4) this.spawnScent(p);
  }
  updateHerd(dt) {
    const S = this.ground, R = this.R;
    for (const e of this.herd) {
      e.ph += dt * (Math.abs(e.vx) > 5 ? 9 : 1.5);
      e.vx *= Math.exp(-dt * 2);
      e.graze -= dt; if (e.graze <= 0) { e.graze = 3 + R() * 5; if (R() < .4) e.dir = e.x > e.home + 60 ? -1 : e.x < e.home - 60 ? 1 : (R() < .5 ? -1 : 1); e.vx = e.dir * 8; }
      e.x += e.vx * dt; e.y = S.walkTop(e.x, 8);
    }
  }
  /* the holes: a seal pops up now and then (and always when you have kept still long enough) */
  sealUp(h) { h.up = 1.8; h.puff = 1; Bus.emit('sealUp', h); }
  updateHoles(dt) {
    for (const h of this.holes) {
      h.t += dt; h.puff = Math.max(0, h.puff - dt * .6);
      if (h.up > 0) { h.up -= dt; if (h.up <= 0) { h.up = 0; h.splash = .8; Bus.emit('sealGone', h); } }
      if (h.splash) h.splash = Math.max(0, h.splash - dt);
    }
  }
  /* the resting seal: head down for a while, then up to look round; it slides into its hole if it sees you move */
  updateBask(dt, p) {
    const b = this.bask; if (!b) return;
    const D = this.G.diff();
    b.t += dt;
    if (b.state === 'dive') { b.alpha = Math.max(0, b.alpha - dt * 1.4); b.x += b.dir * 30 * dt; if (b.alpha <= 0) { b.state = 'gone'; } return; }
    if (b.state === 'gone') return;
    b.y = this.ground.walkTop(b.x, 10);
    if (b.lookHold > 0) { b.lookHold -= dt; b.look = Math.min(1, b.look + dt * 5); if (b.lookHold <= 0) b.lookT = (3.2 + this.R() * 2) / D.look; }
    else { b.look = Math.max(0, b.look - dt * 4); b.lookT -= dt; if (b.lookT <= 0) { b.lookHold = (1.1 + this.R() * .9) * Math.sqrt(D.look); Bus.emit('sealLooks', b); } }
    b.dir = sign(p.x - b.x) || -1;
  }
  baskDive(why) { const b = this.bask; if (!b || b.state === 'dive' || b.state === 'gone') return; b.state = 'dive'; b.t = 0; b.dir = -b.dir; Bus.emit('sealDive', b, why); }
  updateBelugas(dt) { for (const w of this.belugas) { w.t += dt; w.x += w.dir * 12 * dt; if (w.x < WORLD.shoreX + 300 || w.x > WORLD.iceR - 200) w.dir *= -1; } }

  /* ============================================================
     THE PLACE
     ============================================================ */
  /* 'den' (inside snow or earth) | 'water' | 'lee' (sheltered by a rock or an ice ridge) | 'open' */
  shadeAt(x, y, h = 20) {
    const S = this.ground;
    if (this.inWater(x, y)) return 'water';
    if (y > S.topAt(x) + h * .3) return 'den';
    for (const r of this.rocks) if (r.big && Math.abs(x - r.x) < 70) return 'lee';
    if (S.iceMode === 'solid') for (const rx of WORLD.ridges) if (Math.abs(x - rx) < 70) return 'lee';
    return 'open';
  }
  nearestShelter(x) {
    let best = null, bd = 1e9;
    for (const r of this.rocks) if (r.big) { const d = Math.abs(r.x - x); if (d < bd) { bd = d; best = { x: r.x, y: r.y }; } }
    if (this.ground.iceMode === 'solid') for (const rx of WORLD.ridges) { const d = Math.abs(rx - x); if (d < bd) { bd = d; best = { x: rx, y: this.ground.walkTop(rx, 10) }; } }
    return best;
  }
  /* sea water: over the sea, below the surface, where there is no ice */
  inWater(x, y) { return y > WORLD.seaY - 1 && this.ground.isSea(x) && !this.ground.solidAt(x, y); }
  /* open water at the surface here (no ice) */
  openWater(x) { return this.ground.isSea(x) && !this.ground.solidAt(x, WORLD.seaY - 2) && !this.ground.solidAt(x, WORLD.seaY + 2); }
  snowAt(x) { return this.ground.snowDepthAt(x); }
  setSeason(s) { this.season = s; setDaylight(s === 'winter' ? 'night' : s === 'summer' ? 'midsun' : 'normal'); }
  /* winter: snow on land and ice, and the sea frozen solid */
  winter(quiet) {
    const n1 = makeNoise1D(this.seed + 5), S = this.ground;
    if (!S.iceOn || S.iceMode !== 'solid') { if (S.iceOn) S.clearIce(); S.layIce('solid'); }
    if (!S.snowOn) S.laySnow((x) => { const W = WORLD; const base = 10 + n1(x * .01) * 8; return base + (x > W.tundraL && x < W.shoreL ? 6 : 0) + (x > W.shoreX ? -2 : 0); });
    this.setSeason('winter');
    if (!quiet) Bus.emit('winterCame');
  }
  /* early summer: the land's snow and the old drift melt, the sea ice breaks into floes */
  breakup() { const S = this.ground; S.meltSnow(); if (!S.driftGone) S.meltDrift(); S.clearIce(); S.layIce('floes'); this.setSeason('summer'); this.bask = null; Bus.emit('breakup'); }
  /* midsummer: the floes are gone too */
  openSea() { this.ground.clearIce(); }
  /* late autumn: the sea freezes again, and snow falls */
  freezeUp() {
    const S = this.ground, n1 = makeNoise1D(this.seed + 6);
    if (S.iceOn) S.clearIce(); S.layIce('young');
    if (!S.snowOn) S.laySnow((x) => 6 + n1(x * .01) * 6);
    this.setSeason('autumn');
    Bus.emit('freezeUp');
  }
  /* a spring on the ice: thick old ice again, with its lead and ridges */
  springIce() { const S = this.ground, n1 = makeNoise1D(this.seed + 7); if (S.iceMode !== 'solid') { if (S.iceOn) S.clearIce(); S.layIce('solid'); S.laySnow((x) => S.isSea(x) ? 8 + n1(x * .01) * 6 : 0); } if (!S.snowOn) this.winter(true); this.setSeason('spring'); }

  /* ============================================================
     WEATHER
     ============================================================ */
  setWeather(state, hold = 40) { const W = this.weather; W.state = state; W.timer = hold; Bus.emit('weather', state); }
  update(dt, tod, p) {
    const G = this.G, W = this.weather, R = this.R;
    this.t += dt;
    W.timer -= dt;
    if (W.timer <= 0) {
      const s = this.season;
      let next;
      if (W.state === 'clear') next = R() < .5 ? 'cloudy' : 'clear';
      else if (W.state === 'cloudy') next = s === 'summer' ? (R() < .35 ? 'rain' : 'clear') : (R() < .45 ? 'snowfall' : 'clear');
      else next = 'clear';
      W.state = next; W.timer = { clear: 70 + R() * 90, cloudy: 25 + R() * 25, rain: 25 + R() * 25, snowfall: 40 + R() * 40, blizzard: 30 }[next];
      Bus.emit('weather', next);
    }
    const tc = { clear: .08, cloudy: .6, rain: .9, snowfall: .8, blizzard: 1 }[W.state] || .1;
    W.cloud += (tc - W.cloud) * (1 - Math.exp(-dt * .3));
    W.rain += ((W.state === 'rain' ? 1 : 0) - W.rain) * (1 - Math.exp(-dt * .5));
    W.snow += ((W.state === 'snowfall' ? .8 : W.state === 'blizzard' ? 1 : 0) - W.snow) * (1 - Math.exp(-dt * .4));
    W.white += ((W.state === 'blizzard' ? 1 : 0) - W.white) * (1 - Math.exp(-dt * .5));
    W.gust = Math.max(W.white * .8, W.gust - dt * .3); if (R() < dt * .05) W.gust = .5 + R() * .5;
    const night = nightAmount(tod);
    /* the northern lights: dark, clear autumn and winter nights */
    const auroraWant = (this.season === 'autumn' || this.season === 'winter') && night > .5 ? clamp(1 - W.cloud * 1.3, 0, 1) : 0;
    this.aurora += (auroraWant - this.aurora) * (1 - Math.exp(-dt * .4));
    if (this.aurora > .5 && !this.auroraSeen && p.age >= 3 && (this.season === 'autumn' || this.season === 'winter') && !p.underground) { this.auroraSeen = true; Bus.emit('aurora', p); }

    if (['trek', 'breakup'].includes(this.phase) && !this.travelPaused) this.updateFamilyTravel(dt, p);
    else if (this.travelPaused) { const tw = this.twin(), m = this.mum(); if (tw && m && Math.abs(tw.x - m.x) > 50) { tw.goal = m.x - 40; tw.mode = 'walk'; } else if (tw && tw.mode === 'stand') tw.mode = 'lie'; }
    for (const n of this.pack) n.update(dt, p);
    for (const q of this.cubs) q.update(dt, p);
    this.pack = this.pack.filter(n => !n.gone);
    this.updateFoxes(dt, p);
    this.updateHoppers(dt, p);
    this.updateScents(dt, p);
    this.updateHerd(dt);
    this.updateHoles(dt);
    this.updateBask(dt, p);
    this.updateBelugas(dt);
    if (this.buggy) this.buggy.wave += dt;
    if (this.meal) this.meal.t += dt;
  }
}

/* another bear: walks, runs, stands, sits, lies, stands up to sniff, still-hunts at a hole,
   swims, play-spars, goes into a den, leaves */
class BearNPC {
  constructor(W, o) {
    this.W = W; this.role = o.role; this.sex = o.sex; this.form = o.form || 'cream'; this.kg = o.kg; this.collar = !!o.collar; this.sib = o.sib;
    this.x = o.x; this.y = o.y !== undefined ? o.y : W.ground.walkTop(this.x, 22) - this.feet;
    this.mode = 'walk'; this.face = 1; this.walk = 0; this.t = 0; this.goal = this.x; this.leaving = false; this.gone = false; this.inDen = false;
    this.home = this.x; this.roam = 0; this.wander = 0; this.vx = 0; this.vy = 0; this.spin = 0; this.sniffT = 0; this.chuff = 0; this.lineK = 0;
    this.playT = 0; this.still = false;
  }
  get len() { return bearUnits(this.kg); }
  get h() { return this.len * .55; }
  get feet() { return this.h * .6; }
  get w() { return this.len; }
  get age() { return this.kg < 10.5 ? 1 : this.kg < 15 ? 2 : this.kg < 59 ? 3 : this.kg < 150 ? 4 : 5; }
  get swimming() { return !this.inDen && this.W.inWater(this.x, this.y + this.feet - 2); }
  update(dt, p) {
    const S = this.W.ground, R = this.W.R;
    this.t += dt; this.sniffT = Math.max(0, this.sniffT - dt); this.chuff = Math.max(0, this.chuff - dt); this.playT = Math.max(0, this.playT - dt);
    if (this.leaveIn !== undefined) { this.leaveIn -= dt; if (this.leaveIn <= 0) { this.leaveIn = undefined; this.leave(); } }
    if (this.inDen) { if (this.mode === 'walk') this.mode = 'lie'; return; }
    /* two young bears play-sparring: up on their back legs, pushing, falling back, again */
    if (this.mode === 'spar') {
      this.y = S.walkTop(this.x, Math.max(14, this.len * .3)) - this.feet; this.walk += dt * 6;
      if (this.partner && !this.partner.gone) this.face = sign(this.partner.x - this.x) || this.face;
      return;
    }
    /* idle bears wander a little way from home, stop, sit, lie, stand up and sniff */
    if (this.roam > 0 && !['run', 'enter', 'play', 'leave', 'still', 'tossed'].includes(this.mode)) {
      this.wander -= dt;
      if (this.wander <= 0) {
        this.wander = 2 + R() * 6;
        const r = R();
        if (r < .45) { this.goal = clamp(this.home + (R() - .5) * 2 * this.roam, WORLD.left + 40, WORLD.right - 40); this.mode = 'walk'; }
        else if (r < .68) this.mode = 'stand';
        else if (r < .82) this.mode = 'sit';
        else if (r < .94) this.mode = 'lie';
        else { this.mode = 'stand'; this.sniffT = 2.5; }
      }
      /* a twin or a little cub asks you to play: a bounce and a paw up */
      if ((this.role === 'twin' || this.role === 'owncub') && Math.abs(p.x - this.x) < 60 && R() < dt * .3) { this.playT = 1.4; this.face = sign(p.x - this.x) || 1; }
    }
    if (this.mode === 'walk' || this.mode === 'leave' || this.mode === 'run') {
      const gx = this.mode === 'leave' ? this.leaveTo : this.goal, dx = gx - this.x;
      if (Math.abs(dx) > 3) {
        const snow = this.W.snowAt(this.x);
        const base = this.mode === 'run' ? 120 : this.mode === 'leave' ? 60 : 30 + this.len * .3;
        const sp = base / (1 + Math.abs(S.slopeAt(this.x, 6)) * 1.1) / (snow > 10 ? 1.3 : 1) * (this.swimming ? .55 : 1);
        this.x += sign(dx) * Math.min(Math.abs(dx), sp * dt); this.walk += dt * (this.mode === 'run' ? 14 : 8) * (this.swimming ? .7 : 1); this.face = sign(dx);
      } else if (this.mode === 'walk') { this.mode = this.stillAt !== undefined && Math.abs(this.x - this.stillAt) < 6 ? 'still' : 'stand'; if (this.mode === 'still') { this.still = true; this.face = 1; this.stillAt = undefined; } }
      else if (this.mode === 'leave') this.gone = true;
      else if (this.mode === 'run') this.mode = 'stand';
      this.y = S.walkTop(this.x, Math.max(14, this.len * .3)) - this.feet;
    } else if (this.mode === 'tossed') {
      /* rolled over in play: a roll, then up again, unhurt */
      this.vy += 600 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.spin += dt * 10 * sign(this.vx);
      const top = S.walkTop(this.x, 22) - this.feet;
      if (this.y >= top && this.vy > 0) { this.y = top; this.spin = 0; this.mode = 'stand'; this.playT = 2; }
    } else if (this.mode === 'enter') {
      this.sink = (this.sink || 0) + dt * .6; this.y += dt * 14;
      if (this.sink > 1) { this.inDen = true; this.mode = 'lie'; this.sink = 0; const nd = this.W.newDen || this.W.den; this.x = nd.cx; this.y = nd.cy + 6; }
    } else {
      /* stand, sit, lie, still (beside a hole), play, nurse */
      this.y = S.walkTop(this.x, Math.max(14, this.len * .3)) - this.feet;
    }
    if (!this.inDen && this.mode !== 'tossed' && this.mode !== 'enter' && this.W.inWater(this.x, this.y + this.feet - 2)) this.y = Math.min(this.y, WORLD.seaY - this.h * .2);
    /* a bear you met walks along with you for a while */
    if (this.following && !['play', 'tossed', 'enter', 'leave'].includes(this.mode) && !this.inDen) {
      const want = p.x - p.face * (p.w * .6 + this.len * .6);
      if (Math.abs(want - this.x) > 80) { this.goal = want; this.mode = 'walk'; this.roam = 0; }
      else if (this.mode === 'walk' && Math.abs(want - this.x) < 14) this.mode = 'stand';
      if (this.mode === 'stand') this.face = sign(p.x - this.x) || this.face;
    }
  }
  leave(dir = 1) { this.mode = 'leave'; this.leaving = true; this.following = false; this.leaveTo = this.x + dir * 1100; }
}
