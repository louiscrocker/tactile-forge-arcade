/* ============================================================
   world.js — the valley and everything living in it
   ============================================================
   THE PACK    your family: mum, dad, two yearlings (one with a
               radio collar) and your litter-mates.  Where they
               are and what they do depends on the story's phase
               (set by the director in main.js): in and around
               the den, at the summer meadow, travelling single
               file in autumn, breaking trail and testing the
               herds in winter, back at the den with the new
               litter, left behind when you disperse, and at last
               your mate and your own pups.
   VISITORS    ravens (they follow wolves), grasshoppers and voles
               to pounce on (they always get away), scents on the
               breeze, tracks on the ground, the elk and bison
               herds, the biologist with her antenna, the meal you
               carry home for the den.
   THE PLACE   trees (pines, aspens, the big meadow tree), the
               river (swim it; it freezes in winter), scent posts,
               the road with the wildlife tunnel, the weather and
               the seasons.
   Nothing here ever hurts anybody: herds get away, pounces miss,
   the bison just turns and the pack scatters, ravens flap off.
   ============================================================ */
'use strict';

const TRACK_KINDS = {
  elk: { name: 'elk', say: 'Elk tracks: two big toes, like a split heart.' },
  bison: { name: 'bison', say: 'Bison tracks: round and heavy, as wide as a big hand.' },
  deer: { name: 'deer', say: 'Deer tracks: two little toes, pointed at the front.' },
  otter: { name: 'otter', say: 'Otter tracks: five toes, and a long slide where it slid on its tummy.' },
  bear: { name: 'bear', say: 'Bear tracks: five toes with long claws, and a big back foot like a person.' },
  hare: { name: 'hare', say: 'Hare tracks: two long back feet land in front of the little front feet.' }
};
const SCENT_KINDS = {
  elk: { col: '#d8a860', name: 'elk' }, deer: { col: '#c88a50', name: 'deer' }, bison: { col: '#9a7a5a', name: 'bison' },
  hare: { col: '#e8e0c8', name: 'hare' }, bear: { col: '#6a4a3a', name: 'bear' }, otter: { col: '#7ab8c8', name: 'otter' }
};
const PACK_FORMS = ['gray', 'black', 'gray', 'black', 'gray'];

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    const R = this.R = mulberry32(seed + 77);
    this.ground = new Ground(seed);
    const S = this.ground, W = WORLD;
    this.t = 0; this.phase = 'den';
    /* ---------- trees ---------- */
    this.trees = [];
    for (let x = W.left + 40; x < W.meadowL - 60; x += 70 + R() * 90) { if (Math.abs(x - W.denX) < 46) continue; this.trees.push({ x, kind: 'pine', h: 150 + R() * 140, w: 9 + R() * 5, seed: (R() * 1e9) | 0, lean: (R() - .5) * .05 }); }
    this.trees.push({ x: W.treeX, kind: 'bigtree', h: 260, w: 20, seed: 77, lean: 0 });
    for (let x = W.meadowR + 20; x < W.riverL - 40; x += 46 + R() * 50) this.trees.push({ x, kind: 'aspen', h: 120 + R() * 90, w: 5 + R() * 3, seed: (R() * 1e9) | 0, lean: (R() - .5) * .08 });
    for (let x = W.riverR + 40; x < W.flatL + 120; x += 60 + R() * 60) this.trees.push({ x, kind: R() < .5 ? 'aspen' : 'willow', h: 60 + R() * 70, w: 4 + R() * 3, seed: (R() * 1e9) | 0, lean: (R() - .5) * .1 });
    for (let x = W.flatL + 300; x < W.ridgeL - 100; x += 240 + R() * 260) this.trees.push({ x, kind: 'pine', h: 110 + R() * 90, w: 8 + R() * 4, seed: (R() * 1e9) | 0, lean: 0 });
    for (let x = W.ridgeL + 60; x < W.ridgeR; x += 80 + R() * 70) this.trees.push({ x, kind: 'pine', h: 90 + R() * 100, w: 7 + R() * 4, seed: (R() * 1e9) | 0, lean: (R() - .5) * .06 });
    for (let x = W.valleyL + 40; x < W.newDenL - 40; x += 55 + R() * 70) this.trees.push({ x, kind: R() < .6 ? 'aspen' : 'pine', h: 110 + R() * 120, w: 6 + R() * 5, seed: (R() * 1e9) | 0, lean: (R() - .5) * .06 });
    for (let x = W.newDenL + 60; x < W.right - 40; x += 70 + R() * 90) this.trees.push({ x, kind: 'pine', h: 140 + R() * 120, w: 8 + R() * 5, seed: (R() * 1e9) | 0, lean: (R() - .5) * .05 });
    for (const T of this.trees) T.y = S.surfaceAt(T.x);
    /* ---------- tracks on the ground, along the pack's autumn route ---------- */
    this.tracks = [];
    const tk = Object.keys(TRACK_KINDS);
    [[1560, 'elk'], [1700, 'deer'], [1820, 'hare'], [2140, 'otter'], [2420, 'bison'], [2900, 'bear'], [3300, 'elk'], [5100, 'deer'], [5600, 'elk'], [5900, 'hare']].forEach(([x, k]) => this.tracks.push({ x: x + (R() - .5) * 40, kind: k, seen: false, dir: R() < .5 ? 1 : -1 }));
    for (let k = 0; k < 4; k++) this.tracks.push({ x: lerp(W.flatL, W.ridgeL, R()), kind: tk[(R() * tk.length) | 0], seen: false, dir: 1 });
    /* ---------- scent posts: the home pack's edge, and three in the new valley ---------- */
    this.posts = [{ x: W.postX, home: true, marked: false, kind: 'rock' }].concat(W.posts2.map((x, i) => ({ x, home: false, marked: false, kind: ['log', 'rock', 'stump'][i] })));
    for (const p of this.posts) p.y = S.walkTop(p.x, 22);
    /* ---------- living things ---------- */
    this.pack = []; this.pups = []; this.ravens = []; this.hoppers = []; this.scents = []; this.herd = []; this.bison = [];
    this.biologist = null; this.meal = null; this.denRaven = null;
    this.weather = { state: 'clear', timer: 60 + R() * 60, rain: 0, snow: 0, cloud: .15, gust: 0, thunder: 0, bolt: 0 };
    this.season = 'spring'; this.humid = .5;
    this.chase = null; this.howlGame = null; this.feastAt = 0;
    this.makePack();
    this.makeRavens(3, W.denX + 120);
  }

  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }
  get den() { return this.ground.den; }

  /* ============================================================
     THE PACK
     ============================================================ */
  makePack() {
    const R = this.R, d = this.den;
    const form = (k) => PACK_FORMS[k % PACK_FORMS.length];
    this.pack = [
      new WolfNPC(this, { role: 'mum', sex: 'girl', form: this.G.form === 'white' ? 'white' : 'gray', kg: 42, x: d.cx, y: d.cy }),
      new WolfNPC(this, { role: 'dad', sex: 'boy', form: this.G.form === 'black' ? 'black' : form(1), kg: 50, x: d.x + 90 }),
      new WolfNPC(this, { role: 'yearling', sex: 'girl', form: form(2), kg: 34, x: d.x + 160, collar: true }),
      new WolfNPC(this, { role: 'yearling', sex: 'boy', form: form(3), kg: 36, x: d.x + 230 })
    ];
    for (let k = 0; k < 3; k++) this.pack.push(new WolfNPC(this, { role: 'sib', sex: k % 2 ? 'girl' : 'boy', form: R() < .5 ? this.G.form : form(k + 1), kg: .5, x: d.cx + (k - 1) * 10, y: d.cy + 4, sib: k }));
    this.pack[0].mode = 'lie'; this.pack[0].inDen = true;
    for (const s of this.sibs()) { s.mode = 'lie'; s.inDen = true; }
  }
  sibs() { return this.pack.filter(n => n.role === 'sib'); }
  adults() { return this.pack.filter(n => n.role !== 'sib' && n.role !== 'newpup'); }
  leader() { return this.pack.find(n => n.role === 'dad') || this.pack[0]; }
  mum() { return this.pack.find(n => n.role === 'mum'); }
  mate() { return this.pack.find(n => n.role === 'mate'); }
  /* the pack's phase: where everybody goes */
  setPhase(ph, p) {
    this.phase = ph;
    const d = this.den, W = WORLD, S = this.ground, R = this.R;
    const place = (n, x, mode = 'walk') => { n.goal = x; n.mode = mode; n.inDen = false; n.x = x; n.y = S.walkTop(x, 22) - n.feet; };
    if (ph === 'outside') {
      /* pups out of the den; mum lies at the mouth, the others wander, adults come and go with meals */
      const m = this.mum(); place(m, d.x + 40, 'lie'); m.home = d.x + 40;
      this.sibs().forEach((s, k) => { s.kg = p.kg * (.9 + k * .08); place(s, d.x + 50 + k * 34); s.home = d.x + 60; s.roam = 120; });
      this.adults().filter(n => n.role !== 'mum').forEach((n, k) => { place(n, d.x + 180 + k * 70); n.home = d.x + 200; n.roam = 140; });
      this.makeRavens(3, d.x + 140);
    } else if (ph === 'rendezvous') {
      const x0 = W.rvX;
      /* the parents and one yearling are off finding food (they come back with meals); the collared yearling babysits */
      let sitter = this.pack.find(n => n.role === 'yearling' && n.collar) || this.pack.find(n => n.role === 'yearling');
      if (!sitter) { sitter = new WolfNPC(this, { role: 'yearling', sex: 'girl', form: 'gray', kg: 34, x: x0, collar: true }); this.pack.push(sitter); }
      this.pack = this.pack.filter(n => n.role === 'sib' || n === sitter);
      place(sitter, x0 - 60, 'sit'); sitter.home = x0 - 40; sitter.roam = 90; sitter.role = 'sitter';
      this.sibs().forEach((s, k) => { s.kg = p.kg * (.9 + k * .08); place(s, x0 + 20 + k * 50); s.home = x0 + 40; s.roam = 180; });
      this.makeRavens(2, x0 + 160);
      this.makeHoppers(10, x0 - 200, x0 + 320);
    } else if (ph === 'travel') {
      /* the whole family, in a line, heading down the valley; mum and dad are back */
      const keep = this.pack.filter(n => n.role === 'sib' || n.role === 'sitter');
      const d2 = new WolfNPC(this, { role: 'dad', sex: 'boy', form: this.G.form === 'black' ? 'black' : 'gray', kg: 50, x: p.x + 80 });
      const m2 = new WolfNPC(this, { role: 'mum', sex: 'girl', form: this.G.form === 'white' ? 'white' : 'gray', kg: 42, x: p.x + 40 });
      const y2 = new WolfNPC(this, { role: 'yearling', sex: 'boy', form: 'black', kg: 36, x: p.x + 10 });
      for (const n of keep) if (n.role === 'sitter') n.role = 'yearling';
      this.pack = [d2, m2, y2, ...keep];
      this.pack.forEach((n, k) => { if (n.role === 'sib') n.kg = p.kg * (.92 + (n.sib || 0) * .06); n.lineK = k; place(n, p.x + 120 - k * 46); n.roam = 0; });
      this.route = [1760, 2180, 2560, 3000, 3500, W.postX + 30]; this.routeK = 0; this.waiting = false;
      this.hoppers.length = 0; this.ravens.length = 0; this.makeRavens(2, p.x + 300);
    } else if (ph === 'winter') {
      this.pack.forEach((n, k) => { n.lineK = k; place(n, W.herdX - 520 + 110 - k * 46); n.roam = 0; });
      this.route = [W.herdX - 300]; this.routeK = 0;
      this.makeHerd();
      this.biologist = { x: W.bioX, y: S.walkTop(W.bioX, 22), wave: 0, met: false };
      this.ravens.length = 0; this.makeRavens(3, W.herdX - 400);
    } else if (ph === 'home2') {
      /* spring: everybody home; the new litter at the den mouth */
      /* last year's litter-mates are yearlings now too */
      for (const n of this.pack) if (n.role === 'sib') { n.role = 'yearling'; n.kg = 30 + (n.sib || 0) * 2; }
      this.pack.forEach((n, k) => { place(n, d.x + 60 + k * 60, n.role === 'mum' ? 'lie' : 'walk'); n.home = d.x + 120; n.roam = 160; n.lineK = k; });
      this.pups = [];
      for (let k = 0; k < 4; k++) { const q = new WolfNPC(this, { role: 'newpup', sex: k % 2 ? 'girl' : 'boy', form: R() < .5 ? 'gray' : 'black', kg: 3 + R(), x: d.x + 30 + k * 24 }); q.home = d.x + 50; q.roam = 90; q.sib = k; this.pups.push(q); }
      this.ravens.length = 0; this.makeRavens(2, d.x + 200);
      this.hoppers.length = 0; this.makeHoppers(6, d.x + 60, d.x + 360);
    } else if (ph === 'lone') {
      /* the pack stays home; only ravens and the wild things ahead */
      this.pack.length = 0; this.pups.length = 0; this.hoppers.length = 0;
      this.ravens.length = 0; this.makeRavens(2, p.x + 200);
      this.makeHerd(true);
      const mate = new WolfNPC(this, { role: 'mate', sex: p.sex === 'boy' ? 'girl' : 'boy', form: R() < .5 ? 'gray' : R() < .5 ? 'black' : 'white', kg: p.sex === 'boy' ? 38 : 46, x: W.mateX });
      mate.home = W.mateX; mate.roam = 70; place(mate, W.mateX);
      this.pack = [mate];
    } else if (ph === 'parent') {
      /* the pair at the new den; (boy) she is inside, (girl) he keeps watch outside */
      const mate = this.mate(); if (!mate) return;
      const nd = this.newDen;
      if (p.sex === 'boy') { mate.mode = 'lie'; mate.inDen = true; mate.x = nd.cx; mate.y = nd.cy + 4; mate.roam = 0; }
      else { place(mate, nd.x + 40 * nd.dir * -1, 'sit'); mate.home = mate.x; mate.roam = 40; }
      this.ravens.length = 0; this.makeRavens(2, nd.x - 200 * nd.dir);
    }
  }
  /* the next litter is born in the new den (girl's ending), or comes out for the first time (both endings) */
  makeOwnPups(inside) {
    const nd = this.newDen, R = this.R, S = this.ground;
    this.pups = [];
    for (let k = 0; k < 4; k++) {
      const q = new WolfNPC(this, { role: 'ownpup', sex: k % 2 ? 'girl' : 'boy', form: R() < .5 ? this.G.form : (this.mate() ? this.mate().form : 'gray'), kg: inside ? .5 : 3.2, x: inside ? nd.cx + (k - 1.5) * 9 : nd.x - nd.dir * (20 + k * 22) });
      if (inside) { q.mode = 'lie'; q.inDen = true; q.y = nd.cy + 6; q.x = nd.cx + (k - 1.5) * 9; q.roam = 0; }
      else { q.x = nd.x - nd.dir * (40 + k * 24); q.home = q.x; q.roam = 50; q.y = S.walkTop(q.x, 22) - q.feet; }
      q.sib = k; this.pups.push(q);
    }
  }
  /* the pack heard your howl and came back: they gather round you and go on from here */
  packCameBack(p) {
    const S = this.ground;
    this.lostMode = null;
    const n0 = this.pack.length;
    for (const n of this.pack) { n.x = p.x + 60 + (n0 - 1 - (n.lineK || 0)) * 40; n.goal = n.x; n.mode = 'stand'; n.wag = 3; n.y = S.walkTop(n.x, 22) - n.feet; }
    if (this.route) { const k = this.route.findIndex(x => x > p.x + 200); this.routeK = k < 0 ? this.route.length - 1 : k; }
  }
  /* is the pack waiting for you (travel), and where is its tail? */
  packTail() { let t = null; for (const n of this.pack) if (!n.inDen && (t === null || n.x < t)) t = n.x; return t; }
  packHead() { let h = null; for (const n of this.pack) if (!n.inDen && (h === null || n.x > h)) h = n.x; return h; }
  /* the pack walks its route; the leader waits when you fall behind (unless the night has swallowed them) */
  updatePackTravel(dt, p) {
    const route = this.route; if (!route) return;
    const lead = this.pack.find(n => n.lineK === 0) || this.pack[0]; if (!lead) return;
    const target = route[Math.min(this.routeK, route.length - 1)];
    const behind = lead.x - p.x;
    this.waiting = behind > (this.lostMode ? 1e9 : 330) && !this.lostMode;
    if (this.lostMode) { lead.goal = this.lostMode.x; }
    else if (this.waiting) lead.goal = lead.x;
    else lead.goal = target;
    if (Math.abs(lead.x - target) < 8 && this.routeK < route.length - 1 && !this.waiting) this.routeK++;
    lead.mode = Math.abs(lead.goal - lead.x) > 3 ? 'walk' : 'stand';
    for (const n of this.pack) {
      if (n === lead) continue;
      const ahead = this.pack.find(o => o.lineK === n.lineK - 1) || lead;
      n.goal = ahead.x - 46; n.mode = Math.abs(n.goal - n.x) > 4 ? (ahead.mode === 'run' ? 'run' : 'walk') : 'stand';
    }
    /* in deep snow the leader breaks the trail and the rest follow in it */
    if (this.ground.snowOn) for (const n of this.pack) if (n.mode === 'walk' || n.mode === 'run') this.ground.breakTrail(n.x, n.y + n.feet - 4, Math.max(8, n.h * .45));
  }

  /* ============================================================
     VISITORS
     ============================================================ */
  makeRavens(n, x) {
    const R = this.R;
    for (let k = 0; k < n; k++) this.ravens.push({ x: x + (R() - .5) * 200, y: 0, state: 'ground', t: R() * 5, ph: R() * TAU, dir: R() < .5 ? -1 : 1, hop: 0, home: x, alt: 0 });
  }
  makeHoppers(n, x0, x1) {
    const R = this.R, S = this.ground;
    for (let k = 0; k < n; k++) { const x = lerp(x0, x1, R()); this.hoppers.push({ x, home: (x0 + x1) / 2, span: (x1 - x0) / 2 + 40, y: S.walkTop(x, 3), kind: R() < .7 ? 'grasshopper' : 'vole', vx: 0, vy: 0, air: 0, tired: 0, ph: R() * TAU, dir: 1, hopped: false }); }
  }
  makeHerd(far) {
    const R = this.R, S = this.ground, x0 = far ? WORLD.valleyL + 300 : WORLD.herdX;
    this.herd = []; this.bison = [];
    for (let k = 0; k < 9; k++) { const x = x0 + (R() - .5) * 320; this.herd.push({ x, y: S.walkTop(x, 22), kind: 'elk', bull: k === 0, s: .85 + R() * .3, ph: R() * TAU, dir: R() < .5 ? -1 : 1, vx: 0, graze: R() * 4, home: x }); }
    if (!far) for (let k = 0; k < 4; k++) { const x = x0 + 420 + (R() - .5) * 180; this.bison.push({ x, y: S.walkTop(x, 22), kind: 'bison', s: .9 + R() * .25, ph: R() * TAU, dir: -1, vx: 0, graze: R() * 4, home: x }); }
  }
  spawnScent(p) {
    const R = this.R, kinds = Object.keys(SCENT_KINDS);
    const x = p.x + (R() < .5 ? -1 : 1) * (90 + R() * 220), y = this.ground.walkTop(x, 4) - 8 - R() * 18;
    this.scents.push({ x, y, kind: kinds[(R() * kinds.length) | 0], t: 0, ph: R() * TAU, life: 40 + R() * 30, sniffed: false, vx: (R() - .5) * 3 });
  }
  scentNear(x, y, r) { return this.scents.find(s => !s.sniffed && Math.hypot(s.x - x, (s.y - y) * .7) < r); }
  trackNear(x, r) { return this.tracks.find(t => !t.seen && Math.abs(t.x - x) < r); }
  postNear(x, r) { return this.posts.find(q => Math.abs(q.x - x) < r); }
  hopperNear(x, y, r) { return this.hoppers.find(h => h.air <= 0 && Math.hypot(h.x - x, (h.y - y) * .6) < r); }
  ravenNear(x, r) { return this.ravens.find(b => b.state === 'ground' && Math.abs(b.x - x) < r); }
  /* a meal appears away from the den for the father to fetch */
  spawnMeal(p) {
    const nd = this.newDen, R = this.R, S = this.ground;
    const side = -nd.dir, x = clamp(nd.x + side * (260 + R() * 220), WORLD.valleyL + 60, WORLD.right - 80);
    this.meal = { x, y: S.walkTop(x, 4) - 3, taken: false, t: 0 };
    return this.meal;
  }
  /* the raven that pesters the new den (the father barks it off, unhurt) */
  sendDenRaven() {
    const nd = this.newDen;
    this.denRaven = { x: nd.x - nd.dir * 24, y: 0, state: 'ground', t: 0, ph: 0, dir: nd.dir, hop: 0, home: nd.x - nd.dir * 24, alt: 0, pest: true };
    this.ravens.push(this.denRaven);
    return this.denRaven;
  }

  updateRavens(dt, p) {
    const S = this.ground, R = this.R;
    for (const b of this.ravens) {
      b.t += dt; b.ph += dt;
      /* ravens keep out of the river (they hop on the banks) */
      if (b.state === 'ground' && this.inRiver(b.x) && !S.snowOn) { b.x = b.x < (WORLD.riverL + WORLD.riverR) / 2 ? WORLD.riverL - 20 : WORLD.riverR + 20; b.home = b.x; }
      const gy = S.walkTop(b.x, 4);
      if (b.state === 'ground') {
        b.y = gy - 1;
        b.hop = Math.max(0, b.hop - dt * 4);
        if (R() < dt * .8) { b.hop = 1; b.dir = R() < .5 ? -1 : 1; if (Math.abs(b.x + b.dir * 14 - b.home) > 160) b.dir *= -1; b.x += b.dir * 10; }
        /* flap up when a wolf comes close (the den raven is bolder: only a bark moves it) */
        const near = Math.abs(p.x - b.x) < (b.pest ? 10 : 34) && Math.abs(p.y - b.y) < 60;
        if (near && !b.pest) { b.state = 'fly'; b.t = 0; b.alt = 0; b.from = b.x; if (!b.scared) { b.scared = true; Bus.emit('ravenNear', b); } }
      } else if (b.state === 'fly') {
        const u = clamp(b.t / 4, 0, 1);
        b.alt = Math.sin(u * Math.PI) * 140;
        b.x = b.from + Math.sin(u * TAU) * 120 * b.dir;
        b.y = gy - 4 - b.alt;
        if (b.t > 4) { b.state = 'ground'; b.home = b.pest ? b.home : p.x + (R() < .5 ? -1 : 1) * (80 + R() * 80); b.x = b.home; }
      } else if (b.state === 'away') {
        b.y -= 90 * dt; b.x += b.dir * 70 * dt;
        if (b.t > 6) b.gone = true;
      }
    }
    this.ravens = this.ravens.filter(b => !b.gone);
    if (this.denRaven && this.denRaven.gone) this.denRaven = null;
  }
  updateHoppers(dt, p) {
    const S = this.ground, R = this.R;
    for (const h of this.hoppers) {
      h.ph += dt;
      const gy = S.walkTop(h.x, 3);
      if (h.air > 0) {
        h.air -= dt; h.vy += 420 * dt; h.x += h.vx * dt; h.y += h.vy * dt;
        if (h.y >= gy) { h.y = gy; h.air = 0; h.vx = 0; h.vy = 0; }
      } else {
        h.y = gy; h.tired = Math.max(0, h.tired - dt * .5);
        const d = Math.abs(p.x - h.x);
        if (d < 26 && h.tired < 1 && Math.abs(p.y - h.y) < 40) this.hop(h, sign(h.x - p.x) || 1, 1);
        else if (R() < dt * .08) this.hop(h, R() < .5 ? -1 : 1, .4);
      }
      h.x = clamp(h.x, h.home - h.span, h.home + h.span);
    }
  }
  hop(h, dir, k) { h.air = .5 + k * .3; h.vx = dir * (h.kind === 'vole' ? 40 : 90) * (.6 + k); h.vy = -(h.kind === 'vole' ? 60 : 150) * (.5 + k * .6); h.dir = dir; h.tired += .5; h.hopped = true; }
  updateScents(dt, p) {
    for (let i = this.scents.length - 1; i >= 0; i--) {
      const s = this.scents[i]; s.t += dt; s.ph += dt;
      s.x += (s.vx + Math.sin(s.ph * .5) * 2) * dt; s.y += Math.cos(s.ph * .3) * 1.5 * dt;
      const gy = this.ground.walkTop(s.x, 4); if (s.y > gy - 4) s.y = gy - 4; if (s.y < gy - 40) s.y = gy - 40;
      if (s.t > s.life || s.sniffed && s.t > s.sniffedAt + 1.5 || Math.abs(s.x - p.x) > 900) this.scents.splice(i, 1);
    }
    const want = (this.phase === 'rendezvous' || this.phase === 'travel' || this.phase === 'lone') && p.age >= 3 ? 4 : 0;
    if (this.scents.length < want && this.R() < dt * .4) this.spawnScent(p);
  }
  updateHerd(dt, p) {
    const S = this.ground, R = this.R, ch = this.chase;
    for (const e of this.herd.concat(this.bison)) {
      e.ph += dt * (Math.abs(e.vx) > 5 ? 9 : 1.5);
      if (ch && ch.on) {
        /* the herd runs from the pack: it is faster than you and gets away */
        e.vx += ((e.kind === 'bison' ? 110 : 150) * (1 + ch.t * .05) - e.vx) * dt * 1.5; e.dir = 1;
      } else {
        e.vx *= Math.exp(-dt * 2);
        e.graze -= dt; if (e.graze <= 0) { e.graze = 3 + R() * 5; if (R() < .4) e.dir = e.x > e.home + 60 ? -1 : e.x < e.home - 60 ? 1 : (R() < .5 ? -1 : 1); e.vx = e.dir * 6; }
      }
      e.x += e.vx * dt;
      e.y = S.walkTop(e.x, 8);
    }
  }
  /* ---------- the chase: the pack tests the herd, runs, and the herd gets away ---------- */
  startChase(p) {
    if (this.chase && this.chase.on) return null;
    this.chase = { on: true, t: 0, x0: p.x, done: null, dist: 0 };
    for (const n of this.pack) { n.mode = 'run'; n.goal = n.x + 2000; }
    for (const e of this.herd) e.home = e.x + 900;
    for (const e of this.bison) e.home = e.x + 700;
    Bus.emit('chaseStart', p);
    return this.chase;
  }
  updateChase(dt, p) {
    const ch = this.chase; if (!ch || !ch.on) return;
    ch.t += dt; ch.dist = p.x - ch.x0;
    for (const n of this.pack) { n.goal = Math.max(n.goal, p.x + 60 + (n.lineK || 0) * 30); }
    const lead = this.herd.reduce((m, e) => Math.min(m, e.x), 1e9);
    const limit = this.G.diff().stamina * 11 + 6;
    if (ch.t > limit || lead - p.x > 560 || p.x > WORLD.flatR - 60) {
      ch.on = false; ch.done = 'away'; ch.resting = true;
      for (const n of this.pack) { n.mode = 'stand'; n.goal = n.x; n.pant = 6; }
      Bus.emit('chaseEnd', p, ch);
    }
  }
  /* later that day: the herd has settled back on the valley floor, the pack rests nearby, ready to try again */
  resetHunt(p) {
    const S = this.ground, R = this.R;
    this.chase = null;
    for (const e of this.herd) { e.x = e.home = WORLD.herdX + (R() - .5) * 320; e.vx = 0; }
    for (const e of this.bison) { e.x = e.home = WORLD.herdX + 420 + (R() - .5) * 180; e.vx = 0; }
    this.pack.forEach((n, k) => { n.x = WORLD.herdX - 410 - k * 46; n.goal = n.x; n.mode = 'stand'; n.y = S.walkTop(n.x, 22) - n.feet; });
    this.route = [WORLD.herdX - 300]; this.routeK = 0;
    p.x = WORLD.herdX - 560; p.y = S.walkTop(p.x, 22) - p.feet; p.mode = 'walk';
  }
  /* the herd walks back and settles after a while */
  settleHerd(p) {
    for (const e of this.herd.concat(this.bison)) { e.home = clamp(p.x + 360 + (this.R() - .5) * 320, WORLD.flatL + 100, WORLD.flatR - 100); e.x = e.home; e.vx = 0; }
  }

  /* ============================================================
     THE PLACE
     ============================================================ */
  /* 'den' (underground) | 'water' | 'tree' (under branches) | 'tunnel' | 'open' */
  shadeAt(x, y, h = 20) {
    const S = this.ground;
    if (y > S.surfaceAt(x) + h * .3) return 'den';
    if (this.inWater(x, y)) return 'water';
    if (x > WORLD.tunnelL && x < WORLD.tunnelR) return 'tunnel';
    for (const T of this.trees) { const r = T.kind === 'bigtree' ? 70 : T.kind === 'pine' ? 26 : 18; if (Math.abs(x - T.x) < r) return 'tree'; }
    return 'open';
  }
  nearestTree(x) { let best = null, bd = 1e9; for (const T of this.trees) { if (T.kind === 'willow') continue; const d = Math.abs(T.x - x) - (T.kind === 'bigtree' ? 40 : 0); if (d < bd) { bd = d; best = T; } } return best; }
  inRiver(x) { return x > WORLD.riverL + 6 && x < WORLD.riverR - 6; }
  /* the river's water: present unless the river is frozen */
  inWater(x, y) { return this.inRiver(x) && !this.ground.snowOn && y > WORLD.riverY && !this.ground.solidAt(x, y); }
  waterDeep(x) { return this.inRiver(x) && !this.ground.snowOn && this.ground.surfaceAt(x) - WORLD.riverY > 14; }
  inTunnel(x) { return x > WORLD.tunnelL && x < WORLD.tunnelR; }
  /* how deep the snow is where something stands (0 in summer or in a broken trail) */
  snowAt(x) { return this.ground.snowDepthAt(x); }
  /* winter: lay the snow (deepest on the valley floor and the ridge) and freeze the river */
  winter() {
    const n1 = makeNoise1D(this.seed + 5);
    this.ground.laySnow((x) => {
      const W = WORLD, base = 14 + n1(x * .01) * 8;
      const deep = smoothstep(W.flatL - 200, W.flatL + 200, x) * (1 - smoothstep(W.flatR, W.ridgeL + 200, x)) * 16 + smoothstep(W.ridgeL, W.ridgeTop, x) * (1 - smoothstep(W.ridgeTop, W.ridgeR, x)) * 10 + smoothstep(W.valleyL, W.valleyL + 300, x) * 10;
      return (x > W.tunnelL - 10 && x < W.tunnelR + 10) ? 0 : base + deep;
    });
    this.season = 'winter';
    for (const T of this.trees) T.snow = 1;
    Bus.emit('winterCame');
  }
  spring() { this.ground.melt(); this.season = 'spring'; for (const T of this.trees) T.snow = 0; }

  /* ============================================================
     WEATHER AND SEASONS
     ============================================================ */
  setWeather(state, hold = 40) { const W = this.weather; W.state = state; W.timer = hold; Bus.emit('weather', state); }
  update(dt, tod, p) {
    const G = this.G, W = this.weather, R = this.R, D = G.diff();
    this.t += dt;
    W.timer -= dt;
    if (W.timer <= 0) {
      const s = this.season;
      let next;
      if (W.state === 'clear') next = R() < .5 ? 'cloudy' : 'clear';
      else if (W.state === 'cloudy') next = s === 'winter' ? (R() < .5 ? 'snowfall' : 'clear') : s === 'summer' ? (R() < .35 && D.storms && G.settings.visitors ? 'storm' : R() < .4 ? 'rain' : 'clear') : (R() < .45 ? 'rain' : 'clear');
      else next = 'clear';
      W.state = next; W.timer = { clear: 70 + R() * 90, cloudy: 25 + R() * 25, rain: 30 + R() * 30, snowfall: 40 + R() * 40, storm: 28 + R() * 10 }[next];
      Bus.emit('weather', next);
      if (next === 'storm') Bus.emit('storm', p);
    }
    const tc = { clear: .1, cloudy: .65, rain: .95, snowfall: .9, storm: 1 }[W.state] + (this.season === 'winter' ? .12 : 0);
    W.cloud += (tc - W.cloud) * (1 - Math.exp(-dt * .3));
    W.rain += ((W.state === 'rain' || W.state === 'storm' ? 1 : 0) - W.rain) * (1 - Math.exp(-dt * .5));
    W.snow += ((W.state === 'snowfall' ? 1 : 0) - W.snow) * (1 - Math.exp(-dt * .4));
    W.gust = Math.max(0, W.gust - dt * .3); if (R() < dt * .05) W.gust = .5 + R() * .5;
    W.bolt = Math.max(0, W.bolt - dt * 4);
    if (W.state === 'storm' && R() < dt * .25) { W.bolt = 1; W.thunder = 1; Bus.emit('thunder'); }
    W.thunder = Math.max(0, W.thunder - dt);
    const night = nightAmount(tod);
    this.humid += (clamp(.3 + night * .3 + W.rain * .6, 0, 1) - this.humid) * (1 - Math.exp(-dt * .25));

    if ((this.phase === 'travel' || this.phase === 'winter') && !(this.chase && this.chase.on) && !(this.chase && this.chase.resting) && !p.flags.feasted) this.updatePackTravel(dt, p);
    for (const n of this.pack) n.update(dt, p);
    for (const q of this.pups) q.update(dt, p);
    this.pack = this.pack.filter(n => !n.gone);
    this.updateRavens(dt, p);
    this.updateHoppers(dt, p);
    this.updateScents(dt, p);
    this.updateHerd(dt, p);
    this.updateChase(dt, p);
    if (this.biologist) { this.biologist.wave += dt; this.biologist.y = this.ground.walkTop(this.biologist.x, 10); }
    if (this.meal) this.meal.t += dt;
  }
}

/* another wolf: walks, trots, runs, stands, sits, lies, howls, plays, goes into a den, leaves */
class WolfNPC {
  constructor(W, o) {
    this.W = W; this.role = o.role; this.sex = o.sex; this.form = o.form || 'gray'; this.kg = o.kg; this.collar = !!o.collar; this.sib = o.sib;
    this.x = o.x; this.y = o.y !== undefined ? o.y : W.ground.walkTop(this.x, 22) - this.feet;
    this.mode = 'walk'; this.face = 1; this.walk = 0; this.t = 0; this.goal = this.x; this.leaving = false; this.gone = false; this.inDen = false;
    this.home = this.x; this.roam = 0; this.wander = 0; this.vx = 0; this.vy = 0; this.spin = 0; this.howlT = 0; this.pant = 0; this.wag = 0; this.lineK = 0;
    this.playT = 0; this.meal = false;
  }
  get len() { return wolfUnits(this.kg); }
  get h() { return this.len * .58; }
  get feet() { return this.h * .62; }
  get w() { return this.len; }
  get age() { return this.kg < 2.5 ? 1 : this.kg < 6 ? 2 : this.kg < 27 ? 3 : this.kg < 39 ? 4 : 5; }
  update(dt, p) {
    const S = this.W.ground, R = this.W.R;
    this.t += dt; this.howlT = Math.max(0, this.howlT - dt); this.pant = Math.max(0, this.pant - dt); this.wag = Math.max(0, this.wag - dt); this.playT = Math.max(0, this.playT - dt);
    if (this.leaveIn !== undefined) { this.leaveIn -= dt; if (this.leaveIn <= 0) { this.leaveIn = undefined; this.leave(); } }
    if (this.inDen) { if (this.mode === 'walk') this.mode = 'lie'; return; }
    /* idle wolves wander a little way from home, stop, sit, lie, howl */
    if (this.roam > 0 && this.mode !== 'run' && this.mode !== 'enter' && this.mode !== 'play' && this.mode !== 'howl' && this.mode !== 'leave') {
      this.wander -= dt;
      if (this.wander <= 0) {
        this.wander = 2 + R() * 6;
        const r = R();
        if (r < .45) { this.goal = clamp(this.home + (R() - .5) * 2 * this.roam, WORLD.left + 40, WORLD.right - 40); this.mode = 'walk'; }
        else if (r < .7) this.mode = 'stand';
        else if (r < .85) this.mode = 'sit';
        else if (r < .95) this.mode = 'lie';
        else if (this.age >= 3 && !this.W.G.player.swimming) { this.mode = 'howl'; this.howlT = 3 + R() * 2; }
      }
      /* little pups and litter-mates ask you to play: a play bow */
      if ((this.role === 'sib' || this.role === 'newpup' || this.role === 'ownpup') && Math.abs(p.x - this.x) < 60 && R() < dt * .3) { this.playT = 1.4; this.face = sign(p.x - this.x) || 1; }
    }
    if (this.mode === 'howl') { if (this.howlT <= 0) this.mode = 'stand'; }
    else if (this.mode === 'walk' || this.mode === 'leave' || this.mode === 'run') {
      const gx = this.mode === 'leave' ? this.leaveTo : this.goal, dx = gx - this.x;
      if (Math.abs(dx) > 3) {
        const snow = this.W.snowAt(this.x);
        const base = this.mode === 'run' ? 150 : this.mode === 'leave' ? 70 : 34 + this.len * .5;
        const sp = base / (1 + Math.abs(S.slopeAt(this.x, 6)) * 1.1) / (snow > 8 ? 1.6 : 1);
        this.x += sign(dx) * Math.min(Math.abs(dx), sp * dt); this.walk += dt * (this.mode === 'run' ? 16 : 10); this.face = sign(dx);
      } else if (this.mode === 'walk') { this.mode = 'stand'; if (this.role === 'mate' && this.following) this.mode = 'stand'; }
      else if (this.mode === 'leave') this.gone = true;
      else if (this.mode === 'run') this.mode = 'stand';
      this.y = S.walkTop(this.x, 22) - this.feet + (this.W.snowAt(this.x) > 8 ? Math.min(this.W.snowAt(this.x), this.h * .4) * .5 : 0);
    } else if (this.mode === 'stand' || this.mode === 'sit' || this.mode === 'lie' || this.mode === 'play') {
      this.y = S.walkTop(this.x, 22) - this.feet + (this.W.snowAt(this.x) > 8 ? Math.min(this.W.snowAt(this.x), this.h * .4) * .5 : 0);
    } else if (this.mode === 'tossed') {
      /* bowled over in play: a roll, then up again, unhurt */
      this.vy += 600 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.spin += dt * 10 * sign(this.vx);
      const top = S.walkTop(this.x, 22) - this.feet;
      if (this.y >= top && this.vy > 0) { this.y = top; this.spin = 0; this.mode = 'stand'; this.wag = 3; }
    } else if (this.mode === 'enter') {
      /* down into a den */
      this.sink = (this.sink || 0) + dt * .6; this.y += dt * 14;
      if (this.sink > 1) { this.inDen = true; this.mode = 'lie'; this.sink = 0; const nd = this.W.newDen || this.W.den; this.x = nd.cx; this.y = nd.cy + 4; }
    }
    if (!this.inDen && this.mode !== 'tossed' && this.mode !== 'enter' && this.W.inWater(this.x, this.y + this.feet - 2)) this.y = Math.min(this.y, WORLD.riverY - this.h * .35);
    /* a following mate keeps close */
    if (this.following && this.mode !== 'play' && this.mode !== 'howl' && this.mode !== 'tossed' && this.mode !== 'enter' && !this.inDen) {
      const want = p.x - p.face * (p.w * .6 + this.len * .6);
      if (Math.abs(want - this.x) > 70) { this.goal = want; this.mode = p.mode === 'chase' ? 'run' : 'walk'; this.roam = 0; }
      else if (this.mode === 'walk' && Math.abs(want - this.x) < 12) this.mode = 'stand';
      if (this.mode === 'stand') this.face = sign(p.x - this.x) || this.face;
    }
  }
  leave() { this.mode = 'leave'; this.leaving = true; this.leaveTo = this.x + 900; }
}
