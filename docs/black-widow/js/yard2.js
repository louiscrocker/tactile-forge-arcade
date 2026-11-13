/* ============================================================
   yard2.js — what happens in the yard
   ============================================================
   Yard holds the Net (yard.js) and everything alive in it:
     prey      bugs that blunder into your silk.  Flyers hit a
               thread; walkers trip a gumfoot line (a thread to the
               ground) and are snapped up into the air.  A stuck bug
               shakes its thread: PULSES run along the silk.  At
               night that is how you find it.  A leaf shakes slowly;
               a courting male plucks in a steady beat.
     visitors  the blue mud dauber, the lizard, the bird, the
               mantis, the broom.  They look, lose interest, leave.
     people    a child and a grown-up with a torch.  They look.
               They do not touch.
     others    your mother on the porch, the brothers and sisters,
               the female a boy walks to, the male who comes to a
               girl's web.
   Nothing here hurts anything.
   ============================================================ */
'use strict';

/* size: how big a spider must be to hold it · food: how much of a meal it is */
const PREY = {
  gnat: { name: 'gnat', size: 1, food: 1, fly: true },
  ant: { name: 'ant', size: 1, food: 1 },
  fly: { name: 'fly', size: 2, food: 2, fly: true },
  moth: { name: 'moth', size: 2, food: 2, fly: true },
  pillbug: { name: 'pill bug', size: 2, food: 2 },
  cricket: { name: 'cricket', size: 3, food: 3 },
  beetle: { name: 'beetle', size: 3, food: 3 },
  junebug: { name: 'June beetle', size: 4, food: 4, fly: true },
  hopper: { name: 'grasshopper', size: 4, food: 5 }
};
const THERMALS = [{ x: 930, w: 110 }, { x: 420, w: 120 }, { x: -180, w: 140 }, { x: -950, w: 170 }];
const WATCH = { woodpile: [-1230, -1], shed: [-190, -1], pots: [285, -1], pear: [285, 1] };

class Yard {
  constructor(G, seed) {
    this.G = G; this.seed = seed; this.rng = mulberry32((seed >>> 0) + 77);
    this.net = new Net();
    this.sites = SITES;
    this.home = null; this.t = 0;
    this.bounds = { left: WORLD.left - 40, right: WORLD.right + 560, top: WORLD.top, bottom: WORLD.bottom };
    this.weather = { rain: 0, cloud: 0, gust: 0 }; this.humid = 0;
    this.prey = []; this.pulses = []; this.preyClock = 5; this.caught = 0;
    this.visitor = null; this.people = null; this.peopleSeen = 0;
    this.her = null; this.suitor = null; this.sibs = []; this.babies = [];
    this.exuviae = []; this.sac = null; this.feel = null;
    this.mother = { x: 1168, y: -306 };
    for (const [a, b] of [[[1100, -320], [1180, -232]], [[1140, -320], [1180, -150]], [[1118, -320], [1096, -40]], [[1180, -280], [1128, -40]]]) this.net.addThread(a[0], a[1], b[0], b[1], { force: true, props: { mother: true } });
  }
  site(key) { return this.sites.find(s => s.key === key); }
  siteNear(x) { let b = this.sites[0]; for (const s of this.sites) if (Math.abs(s.x - x) < Math.abs(b.x - x)) b = s; return b; }
  own() { return this.net.threads.filter(t => !t.mother && !t.hers); }
  webLen() { let n = 0; for (const t of this.own()) n += t.len; return n; }
  gums() { return this.own().filter(t => t.gum); }
  /* the next thread the game suggests at home, or null when the first web is up */
  guide() { const p = this.G.player, h = this.home; if (!h || !p) return null; const n = p.stats.threads; return n < h.guide.length ? h.guide[n] : null; }
  thermal(x) { let k = 0; for (const t of THERMALS) k = Math.max(k, 1 - Math.abs(x - t.x) / t.w); return Math.max(0, k); }

  /* ---------- silk that shakes ---------- */
  pulse(T, s, kind) {
    if (!T) return;
    T.hum = 1; T.humKind = kind;
    this.pulses.push({ T, s, dir: 1, kind, life: 1.6 }, { T, s, dir: -1, kind, life: 1.6 });
    const q = T.at(s); this.feel = { x: q.x, y: q.y, kind, t: this.t };
    Bus.emit('pulse', kind, T);
  }

  /* ---------- bugs ---------- */
  spawnPrey(kind, opts = {}) {
    const p = this.G.player, R = this.rng, own = this.own(); if (!own.length) return null;
    const leaf = kind === 'leaf';
    const def = leaf ? { name: 'leaf', size: 0, food: 0, fly: true } : PREY[kind];
    let T, s;
    if (def.fly) { const dry = own.filter(t => t.len > 30); T = dry[(R() * dry.length) | 0] || own[0]; s = T.len * (.25 + R() * .5); }
    else { const g = this.gums(); if (!g.length) return null; T = g[(R() * g.length) | 0]; s = T.a.line === this.net.ground ? 0 : T.len; }
    const q = T.at(s), side = R() < .5 ? -1 : 1;
    const b = { kind, def, leaf, T, s, state: 'in', t: 0, tx: q.x, ty: q.y, x: q.x + side * (230 + R() * 80), y: def.fly ? q.y - 60 - R() * 80 : -2, side, ph: R() * 9, flings: 0, wraps: 0, beat: 0, struggle: 0, lift: 0 };
    if (opts.near) { b.x = q.x + side * 60; b.y = def.fly ? q.y - 30 : -2; }
    this.prey.push(b);
    return b;
  }
  pickPrey() {
    const p = this.G.player, big = p.maxPrey, R = this.rng;
    if (p.instar >= 1 && this.caught >= 2 && !this.prey.some(b => b.leaf) && R() < .12) return 'leaf';
    const kinds = Object.keys(PREY).filter(k => PREY[k].size <= big && PREY[k].size >= Math.max(1, big - 2) && (PREY[k].fly || this.gums().length));
    return kinds[(R() * kinds.length) | 0] || 'gnat';
  }
  stuck() { return this.prey.find(b => b.state === 'stuck' || b.state === 'held'); }
  updatePrey(dt) {
    const G = this.G, p = G.player, D = G.diff();
    const hunting = this.home && p.flags.settled && !p.flags.noHunt && p.mode !== 'molt' && !this.visitor && G.night > .35;
    if (hunting && !this.prey.some(b => b.state !== 'free')) {
      this.preyClock -= dt;
      if (this.preyClock <= 0) { this.preyClock = lerp(D.preyGap * 1.5, D.preyGap * .7, clamp(this.webLen() / 700, 0, 1)) * (.8 + this.rng() * .4); this.spawnPrey(this.pickPrey()); }
    }
    for (const b of this.prey) {
      b.t += dt; b.ph += dt * 9;
      if (b.state === 'in') {
        if (!this.net.threads.includes(b.T)) { b.state = 'free'; continue; }
        const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), sp = b.def.fly ? 95 : 55;
        if (b.def.fly) { b.x += dx / (d || 1) * sp * dt; b.y += dy / (d || 1) * sp * dt + Math.sin(b.ph * .7) * 26 * dt; }
        else b.x += sign(dx) * sp * dt;
        if (d < 5 || (!b.def.fly && Math.abs(dx) < 4)) {
          b.state = 'stuck'; b.struggle = b.leaf ? 40 : b.def.size > p.maxPrey ? 5 : D.struggle; b.beat = 0;
          if (!b.def.fly) { b.lift = 1; G.particles.ring(b.tx, 0, '#fff3c0', 4, 90, .4); if (typeof AudioFX !== 'undefined' && AudioFX.pop) AudioFX.pop(1.4); }
          Bus.emit('caught', b); if (!b.leaf) this.caught++;
        }
      } else if (b.state === 'stuck' || b.state === 'held') {
        if (!this.net.threads.includes(b.T)) { b.state = 'free'; Bus.emit('gotAway', b); continue; }
        /* a walker is snapped up its gumfoot line */
        if (b.lift > 0) { b.lift = Math.max(0, b.lift - dt * 3.2); const up = Math.min(30, b.T.len * .5) * (1 - b.lift); b.s = b.T.a.line === this.net.ground ? up : b.T.len - up; }
        const q = b.T.at(b.s); b.x = q.x; b.y = q.y + 3;
        if (b.state === 'held') continue;
        b.beat -= dt;
        if (b.beat <= 0) { b.beat = b.leaf ? 1.5 : .25 + this.rng() * .5; this.pulse(b.T, b.s, b.leaf ? 'leaf' : 'bug'); }
        if (Math.hypot(p.x - b.x, p.y - b.y) > 46) b.struggle -= dt;
        if (b.struggle <= 0) { b.state = 'free'; Bus.emit('gotAway', b); }
      } else if (b.state === 'free') { b.x += b.side * 120 * dt; b.y -= (b.def.fly ? 60 : 0) * dt; if (b.t > 60 || Math.abs(b.x - p.x) > 700) b.gone = true; }
    }
    this.prey = this.prey.filter(b => !b.gone);
    for (const u of this.pulses) { u.s += u.dir * 170 * dt; u.life -= dt; }
    this.pulses = this.pulses.filter(u => u.life > 0 && u.s > 0 && u.s < u.T.len);
    for (const T of this.net.threads) { T.hum = Math.max(0, T.hum - dt * .9); T.born = Math.min(1, (T.born || 0) + dt * 2); }
  }

  /* ---------- visitors ---------- */
  startVisitor(kind) {
    if (this.visitor || this.people) return null;
    const p = this.G.player, side = this.rng() < .5 ? -1 : 1, fly = kind === 'dauber' || kind === 'bird';
    const v = { kind, state: 'come', t: 0, side, fly, x: p.x + side * 380, y: fly ? p.y - 150 : 0, safeT: 0, patience: 8, ph: 0 };
    if (kind === 'broom') { const h = this.home || this.siteNear(p.x); v.x = h.x1 + 260; v.y = 0; v.side = 1; v.x0 = h.x0; v.x1 = h.x1; v.swept = false; }
    this.visitor = v; Bus.emit('visitor', v);
    return v;
  }
  updateVisitor(dt) {
    const v = this.visitor; if (!v) return;
    const p = this.G.player; v.t += dt; v.ph += dt;
    if (v.kind === 'broom') {
      if (v.state === 'come') { v.x -= 130 * dt; if (v.x < v.x1 + 40) { v.state = 'look'; v.t = 0; } }
      else if (v.state === 'look') {
        v.x = lerp(v.x1 + 40, v.x0 + 30, clamp(v.t / 2.4, 0, 1));
        if (v.t > 1.2 && !v.swept) { v.swept = true; const n = this.net.removeThreads(t => !t.mother && !t.hers && Math.max(t.pts[0][1], t.pts[1][1]) > -62); Bus.emit('swept', p, n); }
        if (v.t > 3) { v.state = 'leave'; v.t = 0; }
      } else { v.x += 150 * dt; if (v.t > 3.2) { this.visitor = null; Bus.emit('visitorGone', v); } }
      return;
    }
    const safe = p.isSafe();
    if (v.state === 'come') {
      const tx = p.x + v.side * (v.fly ? 46 : 70), ty = v.fly ? p.y - 34 : 0, dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy), sp = v.fly ? 150 : 110;
      v.x += dx / (d || 1) * Math.min(d, sp * dt); v.y += dy / (d || 1) * Math.min(d, sp * dt);
      if (d < 6 || v.t > 9) { v.state = 'look'; v.t = 0; Bus.emit('visitorLooks', v); }
    } else if (v.state === 'look') {
      if (v.fly) { v.x += Math.sin(v.ph * 3) * 14 * dt; v.y += Math.cos(v.ph * 2.3) * 10 * dt; }
      if (safe) v.safeT += dt;
      if (v.safeT > 1.6) { v.state = 'leave'; v.t = 0; Bus.emit('visitorBored', v, p.safeHow()); }
      else if (v.t > v.patience) { v.state = 'leave'; v.t = 0; Bus.emit('scared', p, v); p.curl(true); }
    } else { v.x += v.side * (v.fly ? 190 : 120) * dt; if (v.fly) v.y -= 90 * dt; if (v.t > 3) { this.visitor = null; Bus.emit('visitorGone', v); } }
  }

  /* ---------- the people: look, do not touch ---------- */
  startPeople() {
    if (this.people || this.visitor || !this.home) return null;
    const [wx, face] = WATCH[this.home.key];
    this.people = { state: 'come', t: 0, x: wx - face * 560, wx, face, say: null, line: 0, n: ++this.peopleSeen };
    Bus.emit('peopleCame', this.G.player);
    return this.people;
  }
  updatePeople(dt) {
    const P = this.people; if (!P) return;
    P.t += dt;
    if (P.state === 'come') { P.x += P.face * 150 * dt; if ((P.wx - P.x) * P.face <= 0) { P.x = P.wx; P.state = 'look'; P.t = 0; Bus.emit('peopleLook', this.G.player, P); } }
    else if (P.state === 'look') {
      const lines = PEOPLE_SAY[Math.min(P.n, PEOPLE_SAY.length) - 1], k = Math.floor(P.t / 3.2);
      if (k !== P.line - 1 && k < lines.length) { P.line = k + 1; P.say = { who: lines[k][0], text: lines[k][1], t: 0 }; Bus.emit('peopleSay', lines[k][1]); }
      if (P.say) P.say.t += dt;
      if (P.t > lines.length * 3.2 + .6) { P.state = 'go'; P.t = 0; P.say = null; }
    } else { P.x -= P.face * 150 * dt; if (P.t > 4) { this.people = null; Bus.emit('peopleGone', this.G.player); } }
  }

  /* ---------- the others ---------- */
  /* a boy walks to her: a grown female, at home in a web of her own */
  makeHer(siteKey) {
    const S = this.site(siteKey), N = this.net;
    for (const [a, b] of S.guide) N.addThread(a[0], a[1], b[0], b[1], { force: true, props: { hers: true } });
    const mine = N.threads.filter(t => t.hers), br = mine[0], xs = [];
    /* her gumfoot lines: only where there is nothing but air down to the ground */
    for (const T of mine.slice().reverse()) for (let u = .15; u <= .86 && xs.length < 3; u += .1) {
      const q = T.at(T.len * u); let ok = q.y < -40 && !xs.some(x => Math.abs(x - q.x) < 20);
      for (let yy = q.y + 6; yy < -1 && ok; yy += 5) if (N.inside(q.x, yy)) ok = false;
      if (ok && N.addThread(q.x, q.y, q.x, 0, { props: { hers: true } })) xs.push(q.x);
    }
    this.her = { site: S, x: S.retreat[0], y: S.retreat[1], state: 'wait', t: 0, lunge: 0, bridge: br };
    return this.her;
  }
  /* a male comes to a girl's web and plucks it, gently */
  sendSuitor() {
    const own = this.own(); if (this.suitor || !own.length) return null;
    const T = own.find(t => t.gum) || own[0], side = this.rng() < .5 ? -1 : 1, q = T.at(T.gum && T.a.line !== this.net.ground ? T.len : 0);
    this.suitor = { T, state: 'come', t: 0, x: q.x + side * 330, y: 0, tx: q.x, s: T.gum && T.a.line !== this.net.ground ? T.len : 0, up: T.gum && T.a.line !== this.net.ground ? -1 : 1, beat: 0, side };
    return this.suitor;
  }
  updateOthers(dt) {
    const m = this.suitor, p = this.G.player;
    if (m) {
      m.t += dt;
      if (!this.net.threads.includes(m.T) && m.state !== 'leave') { const own = this.own(); if (own.length) { m.T = own[0]; m.s = 0; m.up = 1; m.tx = m.T.pts[0][0]; if (m.state === 'pluck') { const q = m.T.at(20); m.x = q.x; m.y = q.y; m.s = 20; } } }
      if (m.state === 'come') {
        if (m.y > -1 && Math.abs(m.tx - m.x) > 3) m.x += sign(m.tx - m.x) * 80 * dt;
        else { m.s += m.up * 50 * dt; const q = m.T.at(m.s); m.x = q.x; m.y = q.y; if (Math.abs(m.s - (m.up > 0 ? 0 : m.T.len)) > Math.min(26, m.T.len * .4)) { m.state = 'pluck'; m.t = 0; Bus.emit('suitorCame', p, m); } }
      } else if (m.state === 'pluck') { m.beat -= dt; if (m.beat <= 0) { m.beat = .8; this.pulse(m.T, m.s, 'male'); } }
      else if (m.state === 'leave') { if (m.y < -1) { m.y = Math.min(0, m.y + 70 * dt); } else m.x += m.side * 90 * dt; if (m.t > 7) this.suitor = null; }
    }
    const h = this.her; if (h) { h.t += dt; h.lunge = Math.max(0, h.lunge - dt * 1.4); }
    for (const b of this.sibs) {
      b.t += dt;
      if (b.fly) { b.x -= (50 + b.k * 30) * dt; b.y -= (14 + b.k * 16) * dt; }
      else if (b.t > b.wait) { b.s += 34 * dt; const q = b.L.at(b.s); b.x = q.x + q.nx * 2; b.y = q.y + q.ny * 2; if (b.s >= b.end) b.fly = true; }
    }
    this.sibs = this.sibs.filter(b => b.x > WORLD.left - 200 && b.y > WORLD.top - 100);
    for (const b of this.babies) { b.t += dt; if (b.t > b.wait) { b.y -= (18 + b.k * 14) * dt; if (b.y < b.top) b.x -= (40 + b.k * 40) * dt; } }
  }
  /* the brothers and sisters, climbing to the edge of the roof and letting go */
  startSibs() {
    const L = this.net.objects.find(o => o.key === 'porch'), s0 = L.nearest(WORLD.sacX, -320).s, end = L.nearest(WORLD.launchX, WORLD.launchY).s;
    for (let k = 0; k < 9; k++) this.sibs.push({ L, s: s0, end: end + (k % 3) * 8, wait: .5 + k * 1.1, t: 0, k: this.rng(), x: WORLD.sacX, y: WORLD.sacY, fly: false });
  }
  startBabies(x, y) { for (let k = 0; k < 26; k++) this.babies.push({ x: x + (this.rng() - .5) * 10, y: y + (this.rng() - .5) * 8, wait: .4 + k * .22, t: 0, k: this.rng(), top: y - 60 - this.rng() * 90 }); }

  update(dt) {
    this.t += dt;
    this.weather.gust = .3 + .3 * Math.sin(this.t * .23) + .2 * Math.sin(this.t * .71);
    this.updatePrey(dt); this.updateVisitor(dt); this.updatePeople(dt); this.updateOthers(dt);
  }
}

/* what the people say, each time they come.  [who, words] */
const PEOPLE_SAY = [
  [['kid', 'Look! A spider!'], ['grownup', 'A black widow. We look.'], ['grownup', 'We do not touch.']],
  [['kid', 'She is so shiny!'], ['kid', 'I look. I do not touch.'], ['grownup', 'Good. She is shy.']],
  [['kid', 'I see her red mark!'], ['grownup', 'If you see one, tell a grown-up.']]
];
