/* ============================================================
   world.js — the castle's life: time, weather, the people, the
              animals, and the day's events
   ============================================================
   World owns everyone who moves (see people.js) and decides who
   lives here from what has been built: a cook when there is a
   kitchen, knights when there are battlements, a horse for every
   stall.  The day's events are the director: the feast at dusk,
   tournament day, the royal carriage, market day, fireworks, and
   the dragon that comes when a tower is tall enough.  The lights
   list is what the painted look uses at night.
   ============================================================ */
'use strict';

class World {
  constructor(G, castle, seed) {
    this.G = G; this.castle = castle; this.seed = seed; this.rng = mulberry32(seed);
    this.people = []; this.horses = []; this.dogs = []; this.cats = []; this.mice = []; this.pigeons = []; this.swans = []; this.fish = []; this.butterflies = [];
    this.claims = new Map();
    this.weather = { state: 'calm', cloud: .2, rain: 0, snow: 0, wind: .2, flash: 0, timer: 30, fog: 0 };
    this.season = 'summer';
    this.bridgeDown = 1; this.gateOpen = 1; this.feast = false; this.feastDay = 0;
    this.joust = null; this.joustDay = 0; this.carriage = null; this.visitDay = 0; this.market = false; this.marketDay = 0; this.fireworksAt = 0; this.fireworksNight = 0; this.fwBurst = 0;
    this.dragon = { state: 'away', x: -400, y: 100, ph: 0, puff: 0, timer: 25, face: 1, landed: false };
    this.owl = null; this.rosterClock = 1; this.questClock = 2; this.lastNight = null; this.coinsDay = 0; this.bellRing = 0; this.lightCache = null; this.lightV = -1;
    this.time = 0; this.rain = []; this.lastDay = G.day;
  }

  /* ---------- helpers for the people ---------- */
  busy(item, who) { const c = this.claims.get(item.id); return c && c !== who && !c.gone && !c.leaving; }
  claim(item, who) { this.claims.set(item.id, who); }
  release(item, who) { if (this.claims.get(item.id) === who) this.claims.delete(item.id); }
  horseAt(stall) { return this.horses.find(h => h.home === stall) || null; }
  outdoorSpots() { const g = this.castle.grid, out = []; for (let cx = 1; cx < COLS - 1; cx++) for (let cy = GROUND - 1; cy >= 1; cy--) if (g.standable(cx, cy) && g.roomId(cx, cy) === 0 && g.get(cx, cy) === T.AIR) { out.push([cx, cy]); break; } return out; }
  perches() { const g = this.castle.grid, out = []; for (let cx = 0; cx < COLS; cx++) { const r = g.topOf(cx); if (r >= GROUND) continue; const t = g.get(cx, r); if (t === T.ROOF || t === T.CONE || t === T.BATTLEMENT || t === T.STONE || t === T.TOWER) out.push([cx, r]); } for (const it of this.castle.items) if (it.key === 'dovecote') out.push([it.cx, it.cy - 1], [it.cx, it.cy - 1]); return out; }
  exitCell() { const g = this.castle.grid; for (let cx = COLS - 1; cx > COLS / 2; cx--) if (g.standable(cx, GROUND - 1)) return [cx, GROUND - 1]; return null; }
  entryCell() { return [COLS - 2, GROUND - 1]; }
  /* somewhere inside or at the castle for a newcomer to head for */
  homeCell() { const b = this.castle.grid.bounds(), g = this.castle.grid; const cx = b ? Math.round((b.l + b.r) / 2) : Math.round(COLS / 2); const s = g.nearestStandable(cx, GROUND - 1, 12); return s || [cx, GROUND - 1]; }
  steam(x, y) { if (this.G.particles) this.G.particles.steam(x, y); }
  sparks(x, y) { if (this.G.particles) this.G.particles.sparks(x, y); }
  poof(x, y) { if (this.G.particles) this.G.particles.puff(x, y, 'rgba(200,200,210,.8)', 6); }

  /* ---------- the roster: who lives here follows what is built ---------- */
  desired() {
    const S = this.castle.summary(this), rt = S.roomTypes, want = { royal: 1 };
    if (rt.throne) { want.king = 1; want.queen = 1; }
    if (rt.kitchen) want.cook = 1; if (rt.bakery) want.baker = 1; if (rt.library) want.sage = 1; if (rt.forge) want.smith = 1; if (rt.stables) want.groom = 1;
    want.maid = S.named >= 5 ? 2 : S.named >= 2 ? 1 : 0;
    if (rt.hall || rt.music || rt.throne) want.jester = 1;
    if (rt.lookout || S.items.flag >= 2) want.falconer = 1;
    want.knight = Math.min(6, Math.floor(S.battlements / 4) + (rt.armoury ? 2 : 0) + Math.floor(S.items.stall / 2) + (S.items.quintain ? 1 : 0));
    if (S.gates) want.guard = 1;
    return want;
  }
  spawnPerson(role, arriving = true) {
    if (this.quiet > 0) arriving = false;
    const [ex, ey] = arriving ? this.entryCell() : this.homeCell();
    const look = role === 'royal' ? royalLook(this.G.sex, this.G.look) : null;
    const p = new Person(this, role, ex, ey, { look, sex: role === 'royal' ? this.G.sex : null, arriving });
    if (role === 'knight') p.look = Object.assign({}, Sprites.ROLE_LOOK.knight, { robe: pick(['#9a9ea8', '#9a9ea8', '#b03a3a', '#2f5aa8', '#2a8a5a']) });
    this.people.push(p);
    if (arriving) { const h = this.homeCell(); if (!p.goTo(h[0], h[1])) { p.task = { kind: 'idle', t: 20, act: 'wave' }; this.noWayIn = (this.noWayIn || 0) + 1; Bus.emit('noWayIn', p); } else p.task = { kind: 'go', then: { kind: 'idle', t: 2, act: 'wave' } }; }
    Bus.emit('arrived', p, role);
    return p;
  }
  roster(dt) {
    this.rosterClock -= dt; if (this.rosterClock > 0) return; this.rosterClock = this.quiet > 0 ? .3 : 2.5;
    /* a horse for every stall, a dog for every kennel (they come first: a child is waiting) */
    const stalls = this.castle.items.filter(it => it.key === 'stall');
    for (const s of stalls) if (!this.horses.some(h => h.home === s)) { const [ex, ey] = this.entryCell(); const h = new Horse(this, ex, ey, { home: s, arriving: true }); const spot = spotFor(this.castle.grid, s); if (this.quiet > 0 && spot) h.at(spot[0], spot[1]); else if (spot && h.goTo(spot[0], spot[1])) h.task = { kind: 'go', then: { kind: 'idle', t: 6, graze: true } }; else { h.at(spot ? spot[0] : s.cx, spot ? spot[1] : s.cy); } this.horses.push(h); if (!this.castle.flags.firstHorse) { this.castle.flags.firstHorse = true; this.castle.milestone('horse', () => Bus.emit('horseCame', h)); } else Bus.emit('horseAgain', h); return; }
    for (const h of this.horses) if (!h.home || !this.castle.items.includes(h.home)) { if (!h.leaving) { h.leaving = true; const ex = this.exitCell(); if (ex && h.goTo(ex[0], ex[1])) h.task = { kind: 'go', then: { kind: 'gone' } }; else h.gone = true; } }
    const kennels = this.castle.items.filter(it => it.key === 'kennel');
    for (const k of kennels) if (!this.dogs.some(d => d.home === k)) { const [ex, ey] = this.entryCell(); const d = new Dog(this, ex, ey, { home: k }); const spot = spotFor(this.castle.grid, k); if (spot && d.goTo(spot[0], spot[1])) d.task = { kind: 'go', then: { kind: 'idle', t: 4, wag: true } }; else d.at(spot ? spot[0] : k.cx, spot ? spot[1] : k.cy); this.dogs.push(d); Bus.emit('dogCame', d); return; }
    this.dogs = this.dogs.filter(d => d.home && this.castle.items.includes(d.home));
    const want = this.desired(), have = {};
    for (const p of this.people) if (!p.leaving) have[p.role] = (have[p.role] || 0) + 1;
    for (const role in want) if ((have[role] || 0) < want[role]) { this.spawnPerson(role, role !== 'royal' || this.people.length > 0); return; }
    for (const p of this.people) if (p.role !== 'royal' && p.role !== 'visitor' && p.role !== 'trader' && (have[p.role] || 0) > (want[p.role] || 0) && !p.leaving && !p.busyEvent) { p.leaving = true; p.task = null; have[p.role]--; Bus.emit('left', p); return; }
    const S = this.castle.summary(this), wantCats = S.roomTypes.cellar ? 2 : (S.roomTypes.kitchen || S.rooms >= 3) ? 1 : 0;
    if (this.cats.length < wantCats) { const r = this.castle.rooms().find(x => !x.tiny && (x.type === 'kitchen' || x.type === 'cellar')) || this.castle.rooms().find(x => !x.tiny); if (r && r.floor.length) { const c = r.floor[0]; this.cats.push(new Cat(this, c % COLS, (c - c % COLS) / COLS)); } }
    if (this.cats.length > wantCats) this.cats.pop();
    const perches = this.perches(), wantPigeons = Math.min(8, Math.floor(perches.length / 3) + S.items.dovecote * 3);
    while (this.pigeons.length < wantPigeons && perches.length) this.pigeons.push(new Pigeon(this, pick(perches)));
    if (this.pigeons.length > wantPigeons) this.pigeons.length = wantPigeons;
    const waterCols = []; for (let cx = 0; cx < COLS; cx++) if (this.castle.grid.get(cx, GROUND) === T.WATER) waterCols.push(cx);
    const wantSwans = Math.min(4, Math.floor(waterCols.length / 4)), wantFish = Math.min(6, Math.floor(waterCols.length / 2));
    if (this.swans.length < wantSwans) { this.swans.push(new Swan(this, pick(waterCols))); if (this.swans.length === 1) Bus.emit('swan'); }
    if (this.fish.length < wantFish) this.fish.push(new Fish(this, pick(waterCols)));
    const flowers = this.castle.items.filter(it => it.key === 'rosebush' || it.key === 'appletree' || it.key === 'pond' || it.key === 'beehive');
    const wantB = (this.season === 'spring' || this.season === 'summer') && nightAmount(this.G.tod) < .5 ? Math.min(6, flowers.length) : 0;
    while (this.butterflies.length < wantB) { const f = pick(flowers); this.butterflies.push({ x: f.cx * CELL + CELL / 2, y: f.cy * CELL - 10, ph: rnd(0, 6), col: pick(['#f0a030', '#e8e0f8', '#f06090', '#f8e040']), hx: f.cx * CELL + CELL / 2, hy: f.cy * CELL - 14 }); }
    if (this.butterflies.length > wantB) this.butterflies.length = Math.max(0, wantB);
    /* mice in the kitchen and the cellar, now and then */
    if (this.mice.length < 1 && Math.random() < .25) { const r = this.castle.rooms().find(x => !x.tiny && (x.type === 'kitchen' || x.type === 'cellar' || x.type === 'store')); if (r && r.floor.length) { const c = pick(r.floor); this.mice.push(new Mouse(this, c % COLS, (c - c % COLS) / COLS)); } }
  }

  /* ---------- weather and the calendar ---------- */
  setSeason(s) { if (this.season === s) return; this.season = s; Bus.emit('season', s); }
  weatherStep(dt) {
    const w = this.weather, winter = this.season === 'winter';
    w.timer -= dt;
    if (w.timer <= 0) {
      const r = this.rng(); let next = 'calm';
      if (winter) next = r < .35 ? 'snow' : r < .6 ? 'cloudy' : 'calm';
      else if (this.season === 'summer') next = r < .1 ? 'storm' : r < .25 ? 'cloudy' : 'calm';
      else next = r < .25 ? 'rain' : r < .5 ? 'cloudy' : 'calm';
      if (next !== w.state) { w.state = next; if (next === 'rain' || next === 'storm') Bus.emit('rain'); if (next === 'snow') Bus.emit('snowfall'); }
      w.timer = next === 'calm' ? rnd(50, 110) : rnd(25, 60);
    }
    const tc = w.state === 'calm' ? .15 : w.state === 'cloudy' ? .6 : w.state === 'snow' ? .75 : .95, k = 1 - Math.exp(-dt * .15);
    w.cloud += (tc - w.cloud) * k;
    w.rain += (((w.state === 'rain' || w.state === 'storm') ? (w.state === 'storm' ? 1 : .6) : 0) - w.rain) * k;
    w.snowing = w.state === 'snow' ? 1 : 0;
    const snowTarget = winter ? 1 : 0; w.snow += (snowTarget - w.snow) * (1 - Math.exp(-dt * (winter ? .03 : .06)));
    w.wind += ((w.state === 'storm' ? .9 : w.state === 'rain' ? .5 : .2) - w.wind) * k;
    w.flash = Math.max(0, w.flash - dt * 3);
    if (w.state === 'storm' && Math.random() < dt * .08) { w.flash = 1; Bus.emit('lightning'); }
  }

  /* ---------- events ---------- */
  startJoust() {
    const rail = this.castle.items.find(it => it.key === 'tiltrail'); if (!rail) return false;
    const g = this.castle.grid, A = [rail.cx - 1, rail.cy], B = [rail.cx + 4, rail.cy];
    if (!g.standable(A[0], A[1]) || !g.standable(B[0], B[1])) return false;
    const knights = this.people.filter(p => p.role === 'knight' && !p.busyEvent && !p.leaving).slice(0, 2);
    const horses = this.horses.filter(h => !h.busyEvent && !h.leaving).slice(0, 2);
    if (knights.length < 2 || horses.length < 2) return false;
    for (const k of knights) { k.busyEvent = 'joust'; k.task = null; k.act = 'ride'; }
    for (const h of horses) { h.busyEvent = 'joust'; h.task = null; h.saddle = true; }
    knights[0].rider = horses[0]; knights[1].rider = horses[1]; horses[0].rider = knights[0]; horses[1].rider = knights[1];
    this.joust = { rail, A, B, knights, horses, phase: 'ride', t: 0, score: [0, 0], runs: 0, taps: 0 };
    horses[0].at(A[0], A[1]); horses[1].at(B[0], B[1]); horses[0].face = 1; horses[1].face = -1;
    this.joustDay = this.G.day;
    this.castle.milestone('joust', () => Bus.emit('joust', this.joust));
    return true;
  }
  joustStep(dt) {
    const J = this.joust; if (!J) return;
    J.t += dt;
    const [h0, h1] = J.horses, ax = J.A[0] * CELL + CELL / 2, bx = J.B[0] * CELL + CELL / 2, y = (J.A[1] + 1) * CELL;
    for (const h of J.horses) { h.y = y; h.ph += dt * (J.phase === 'charge' ? 7 : 1); h.moving = J.phase === 'charge'; }
    for (let i = 0; i < 2; i++) { const k = J.knights[i], h = J.horses[i]; k.x = h.x; k.y = h.y - 30; k.face = h.face; k.cx = h.cx; k.cy = h.cy; k.act = J.phase === 'bow' ? 'cheer' : 'ride'; k.ph = h.ph; }
    if (J.phase === 'ride') { if (J.t > 2.5) { J.phase = 'charge'; J.t = 0; J.tapped = false; } }
    else if (J.phase === 'charge') {
      const sp = 150, prog = clamp(J.t * sp / Math.max(1, bx - ax), 0, 1);
      h0.x = lerp(ax, bx, prog); h1.x = lerp(bx, ax, prog); h0.face = 1; h1.face = -1; h0.gallop = h1.gallop = true;
      if (!J.tapped && prog > .48) { J.tapped = true; J.taps++; const who = Math.random() < .5 ? 0 : 1; J.score[who]++; const mx = (ax + bx) / 2; if (this.G.particles) { this.G.particles.sparkle(mx, y - 40, 24, '#ffe27a', 24); this.G.particles.text(mx, y - 70, 'TAP!', '#ffe27a', 22); } if (AudioFX.clink) AudioFX.clink(); Bus.emit('joustTap', J, who); for (const p of this.people) if (!p.busyEvent && Math.abs(p.x - mx) < 400) { p.task = { kind: 'idle', t: 3, act: 'cheer' }; p.path = null; } }
      if (prog >= 1) { J.runs++; h0.gallop = h1.gallop = false; if (J.runs >= 3) { J.phase = 'bow'; J.t = 0; } else { J.phase = 'turn'; J.t = 0; } }
    }
    else if (J.phase === 'turn') { h0.face = -1; h1.face = 1; if (J.t > 1.5) { [J.A, J.B] = [J.B, J.A]; J.phase = 'charge'; J.t = 0; J.tapped = false; } }
    else if (J.phase === 'bow') {
      h0.face = 1; h1.face = -1;
      if (J.t > 4) {
        for (let i = 0; i < 2; i++) { const k = J.knights[i], h = J.horses[i]; h.rider = null; k.rider = null; h.busyEvent = null; h.saddle = false; h.gallop = false; k.busyEvent = null; k.act = 'walk'; k.task = null; const s = this.castle.grid.nearestStandable(h.cx, h.cy, 3); if (s) k.at(s[0], s[1]); else k.at(h.cx, h.cy); }
        Bus.emit('joustDone', J); this.joust = null;
      }
    }
  }
  startCarriage() {
    this.carriage = { x: WORLD_W + 120, y: GROUND_Y, state: 'in', t: 0, visitor: null, wait: 0, face: -1, ph: 0 };
    this.visitDay = this.G.day;
  }
  carriageStep(dt) {
    const c = this.carriage; if (!c) return; const g = this.castle.grid;
    c.ph += dt;
    const stopX = () => { const b = g.bounds(); let gate = -1; for (let cx = COLS - 1; cx >= 0; cx--) { const t = g.get(cx, GROUND - 1); if (t === T.GATE || t === T.DOOR) { gate = cx; break; } } const target = gate >= 0 ? gate + 2 : b ? b.r + 3 : Math.round(COLS / 2); return Math.min(COLS - 3, target) * CELL + CELL / 2; };
    if (c.state === 'in') {
      const nx = c.x - 70 * dt, ahead = Math.floor((nx - 70) / CELL);
      const sx = stopX();
      if (ahead >= 0 && ahead < COLS && !g.solid(ahead, GROUND) && g.get(ahead, GROUND) === T.WATER) { c.state = 'stuck'; c.t = 0; Bus.emit('noWayIn', c); return; }
      c.x = nx;
      if (c.x <= sx) { c.x = sx; c.state = 'visit'; c.t = 0; const cx = Math.floor(c.x / CELL); const s = g.nearestStandable(cx, GROUND - 1, 3) || [cx, GROUND - 1]; const v = new Person(this, 'visitor', s[0], s[1], { look: { hair: '#2a1a12', skin: '#8a5a3a', robe: '#c03a7a', trim: '#f2c14e' } }); v.task = { kind: 'idle', t: 2, act: 'wave' }; this.people.push(v); c.visitor = v; Bus.emit('visitor', v); }
    } else if (c.state === 'stuck') { c.t += dt; if (c.t > 8) { c.state = 'out'; c.face = 1; } }
    else if (c.state === 'visit') {
      c.t += dt;
      if (c.t > 70 && c.visitor && !c.visitor.leaving) { c.visitor.leaving = true; c.visitor.task = null; const cx = Math.floor(c.x / CELL); const s = g.nearestStandable(cx, GROUND - 1, 3); if (s) { c.visitor.exitOverride = s; } }
      if (c.visitor && c.visitor.leaving) { const d = Math.abs(c.visitor.x - c.x); if (d < 40 || c.t > 120) { this.people = this.people.filter(p => p !== c.visitor); c.visitor = null; c.state = 'out'; c.face = 1; } }
    } else if (c.state === 'out') { c.x += 80 * dt; if (c.x > WORLD_W + 200) this.carriage = null; }
  }
  dragonStep(dt) {
    const d = this.dragon, S = this.castle.grid.tallest(), perch = this.castle.items.find(it => it.key === 'perch');
    d.ph += dt; d.puff = Math.max(0, d.puff - dt * .6);
    const allowed = S.h >= 10 || perch, night = nightAmount(this.G.tod) > .5;
    const target = perch ? [perch.cx * CELL + CELL, perch.cy * CELL - 2] : [S.cx * CELL + CELL / 2, (GROUND - S.h) * CELL];
    if (d.state === 'away') { d.landed = false; if (allowed) { d.timer -= dt; if (d.timer <= 0) { d.state = 'arrive'; d.x = -300; d.y = 60; d.face = 1; } } return; }
    if (d.state === 'arrive') {
      const dx = target[0] - d.x, dy = target[1] - d.y, dist = Math.hypot(dx, dy), sp = 140;
      if (dist < sp * dt + 2) { d.x = target[0]; d.y = target[1]; d.state = 'landed'; d.landed = true; d.timer = 0; d.puff = 1; if (this.G.particles) this.G.particles.sparkle(d.x, d.y - 60, 40, '#ffd27a', 60); this.castle.milestone('dragon', () => Bus.emit('dragon', d)); }
      else { d.x += dx / dist * sp * dt; d.y += dy / dist * sp * dt - Math.sin(d.ph * 5) * 10 * dt; d.face = dx >= 0 ? 1 : -1; }
      return;
    }
    if (d.state === 'landed') {
      d.timer += dt; d.x += (target[0] - d.x) * dt * 2; d.y += (target[1] - d.y) * dt * 2;
      if (!allowed || (d.timer > 200 && !night && Math.random() < dt * .02)) { d.state = 'leave'; d.face = 1; d.landed = false; Bus.emit('dragonLeft'); }
      if (Math.random() < dt * .05) d.puff = 1;
      return;
    }
    if (d.state === 'leave') { d.x += 160 * dt; d.y -= 60 * dt; if (d.x > WORLD_W + 300) { d.state = 'away'; d.timer = rnd(120, 240); } }
  }
  poke(wx, wy) {
    const d = this.dragon;
    if (d.state === 'landed' && Math.abs(wx - d.x - 20) < 110 && Math.abs(wy - (d.y - 50)) < 70) { d.puff = 1.4; if (this.G.particles) this.G.particles.sparkle(d.x + 100 * d.face, d.y - 86, 30, '#ffb0e0', 30); Bus.emit('dragonPoke', d); return 'dragon'; }
    for (const h of this.horses) if (Math.abs(wx - h.x) < 34 && wy < h.y && wy > h.y - 52) { h.hearts = 1; h.happy = 1; this.castle.stats.brushed++; if (this.G.particles) this.G.particles.text(h.x, h.y - 60, '♥', '#ff6a9a', 20); Bus.emit('brushed', h); return 'horse'; }
    for (const g of this.dogs) if (Math.abs(wx - g.x) < 20 && wy < g.y && wy > g.y - 24) { g.wag = 4; if (this.G.particles) this.G.particles.text(g.x, g.y - 30, '♥', '#ff6a9a', 16); Bus.emit('patted', g); return 'dog'; }
    for (const c of this.cats) if (Math.abs(wx - c.x) < 16 && wy < c.y && wy > c.y - 20) { if (this.G.particles) this.G.particles.text(c.x, c.y - 24, '♥', '#ff6a9a', 14); Bus.emit('patted', c); return 'cat'; }
    for (const p of this.people) if (Math.abs(wx - p.x) < 14 && wy < p.y && wy > p.y - 52) { if (!p.busyEvent) { p.task = { kind: 'idle', t: 2.5, act: 'wave' }; p.path = null; } Bus.emit('greeted', p); return 'person'; }
    return null;
  }

  /* ---------- lights for the night ---------- */
  lights() {
    const night = nightAmount(this.G.tod), C = this.castle;
    if (this.lightCache && this.lightV === C.version + (night > .1 ? 100000 : 0)) return this.lightCache;
    const out = [];
    for (const it of C.items) { const d = ITEMS[it.key]; if (!d.light) continue; if (!d.fire && night < .1) continue; out.push({ x: it.cx * CELL + d.w * CELL / 2, y: it.cy * CELL - d.h * CELL * (d.mount === 'ceiling' ? .4 : .55), r: 70 + d.light * 60, i: d.light * (d.fire ? 1 : .9), col: d.fire ? [1, .55, .22] : [1, .72, .35], flicker: !!d.fire || it.key === 'torch' || it.key === 'candle' || it.key === 'chandelier' });
    }
    if (this.dragon.state === 'landed' && this.dragon.puff > .2) out.push({ x: this.dragon.x + 90 * this.dragon.face, y: this.dragon.y - 86, r: 60, i: this.dragon.puff, col: [1, .7, .9], flicker: true });
    this.lightCache = out; this.lightV = C.version + (night > .1 ? 100000 : 0);
    return out;
  }
  /* rooms with a light in them, and the window cells on their walls */
  litWindows() {
    const C = this.castle, g = C.grid, lit = new Set();
    if (nightAmount(this.G.tod) < .1) return lit;
    for (const r of C.rooms()) { if (!r.items.some(it => ITEMS[it.key].light)) continue; for (let y = r.y0; y <= r.y1; y++) for (const x of [r.x0 - 1, r.x1 + 1]) if (WINDOWS.has(g.get(x, y))) lit.add(y * COLS + x); }
    return lit;
  }

  /* ---------- each frame ---------- */
  update(dt, tod) {
    const G = this.G, C = this.castle, g = C.grid;
    this.time += dt; if (this.quiet > 0) this.quiet -= dt;
    this.setSeason(seasonOfDay(G.day));
    this.weatherStep(dt);
    const night = nightAmount(tod);
    /* the drawbridge comes down in the morning and goes up at night (never while someone is on it) */
    const wantDown = night < .5 || !!this.carriage;
    this.bridgeDown += ((wantDown ? 1 : 0) - this.bridgeDown) * (1 - Math.exp(-dt * .6));
    g.bridgeDown = this.bridgeDown > .5; this.gateOpen += ((wantDown ? 1 : 0) - this.gateOpen) * (1 - Math.exp(-dt * .8));
    if (this.lastNight !== null && (night > .5) !== this.lastNight) { if (night > .5) Bus.emit('nightFall'); else Bus.emit('morning'); }
    this.lastNight = night > .5;
    if (G.day !== this.lastDay) { this.lastDay = G.day; Bus.emit('newDay', G.day); }
    /* the village's coins come in the morning */
    if (tod > .3 && tod < .5 && this.coinsDay !== G.day) { this.coinsDay = G.day; const n = G.diff().daily; C.earn(n, 'village'); }
    this.roster(dt);
    if (!G.started) { for (const p of this.people) p.update(dt); for (const h of this.horses) h.update(dt); for (const b of this.pigeons) b.update(dt); for (const s of this.swans) s.update(dt); for (const f of this.fish) f.update(dt); return; }
    /* the feast: dusk, with a long table in a great hall */
    const hasTable = C.items.some(it => it.key === 'longtable' && (C.roomAt(it.cx, it.cy) || {}).type === 'hall');
    const feastNow = hasTable && tod > .68 && tod < .8;
    if (feastNow && !this.feast) { this.feast = true; if (this.feastDay !== G.day) { this.feastDay = G.day; C.milestone('feast', () => Bus.emit('feast')); } }
    if (!feastNow) this.feast = false;
    /* tournament day */
    if (!this.joust && this.joustDay !== G.day && G.day % 2 === 0 && tod > .45 && tod < .6 && Math.random() < dt * .3) this.startJoust();
    if (this.joust) this.joustStep(dt);
    /* the royal carriage every other day, market day every third */
    if (!this.carriage && this.visitDay !== G.day && G.day >= 2 && G.day % 2 === 1 && tod > .35 && tod < .5 && (C.grid.bounds())) this.startCarriage();
    if (this.carriage) this.carriageStep(dt);
    const marketNow = G.day % 3 === 0 && tod > .32 && tod < .66 && !!C.grid.bounds();
    if (marketNow && !this.market) { this.market = true; if (this.marketDay !== G.day) { this.marketDay = G.day; for (let i = 0; i < 2; i++) { const t = this.spawnPerson('trader'); t.carry = 'tray'; } Bus.emit('market'); } }
    if (!marketNow && this.market) { this.market = false; for (const p of this.people) if (p.role === 'trader' && !p.leaving) { p.leaving = true; p.task = null; } }
    /* fireworks on dark nights when there is a box (or something to celebrate) */
    const fw = C.items.some(it => it.key === 'fireworks') || (C.flags.celebrate && C.flags.celebrate === G.day);
    if (fw && night > .8) { this.fireworksAt -= dt; if (this.fireworksAt <= 0) { this.fireworksAt = rnd(5, 12); const b = C.grid.bounds(); const x = b ? rnd(b.l, b.r + 1) * CELL : WORLD_W / 2; if (G.particles) G.particles.firework(x, rnd(80, 220)); if (AudioFX.firework) AudioFX.firework(); if (this.fireworksNight !== G.day) { this.fireworksNight = G.day; Bus.emit('fireworks'); } } }
    this.dragonStep(dt);
    /* an owl on the tallest tower at night */
    const tall = g.tallest();
    this.owl = night > .6 && tall.h >= 5 ? { x: tall.cx * CELL + CELL / 2, y: (GROUND - tall.h) * CELL, ph: this.time } : null;
    if (this.owl && Math.random() < dt * .02 && AudioFX.owl) { AudioFX.owl(); Bus.emit('owl'); }
    /* bells ring at noon and dusk */
    const bell = C.items.find(it => it.key === 'bell');
    if (bell && ((tod > .5 && tod < .503) || (tod > .78 && tod < .783)) && this.bellRing <= 0) { this.bellRing = 4; if (AudioFX.bell) AudioFX.bell(); }
    this.bellRing = Math.max(0, this.bellRing - dt);
    /* everyone moves */
    for (const p of this.people) p.update(dt);
    this.people = this.people.filter(p => !p.gone);
    for (const h of this.horses) h.update(dt);
    this.horses = this.horses.filter(h => !h.gone);
    for (const d of this.dogs) d.update(dt);
    for (const c of this.cats) c.update(dt);
    for (const m of this.mice) m.update(dt);
    this.mice = this.mice.filter(m => !m.fled);
    for (const b of this.pigeons) b.update(dt);
    for (const s of this.swans) s.update(dt); this.swans = this.swans.filter(s => !s.gone);
    for (const f of this.fish) f.update(dt); this.fish = this.fish.filter(f => !f.gone);
    for (const b of this.butterflies) { b.ph += dt; b.x += Math.sin(b.ph * 1.3) * 20 * dt + (b.hx - b.x) * dt * .3; b.y += Math.cos(b.ph * 1.7) * 14 * dt + (b.hy - b.y) * dt * .3; }
    /* smoke from chimneys and fires, steam, sparks: ambient particles */
    if (G.particles) {
      for (const it of C.items) { const d = ITEMS[it.key]; if (d.fire && Math.random() < dt * 1.5) G.particles.smoke(it.cx * CELL + d.w * CELL / 2 + rnd(-4, 4), it.cy * CELL - d.h * CELL + 4, .6); if (d.sparks && Math.random() < dt * 1.2) G.particles.sparks(it.cx * CELL + d.w * CELL / 2, it.cy * CELL - d.h * CELL * .5); if (d.water && Math.random() < dt * .8 && it.key === 'fountain') G.particles.drip(it.cx * CELL + d.w * CELL / 2 + rnd(-10, 10), it.cy * CELL - d.h * CELL * .6); }
      if (night > .5 && (this.season === 'summer' || this.season === 'spring') && Math.random() < dt * 2) { const sp = this.outdoorSpots(); if (sp.length) { const [cx, cy] = pick(sp); G.particles.firefly(cx * CELL + rnd(0, CELL), cy * CELL + rnd(-30, 10)); } }
    }
    /* quests check once a second */
    this.questClock -= dt; if (this.questClock <= 0) { this.questClock = 1; C.checkQuests(this); }
  }

  /* ---------- save ---------- */
  serialize() { return { season: this.season, weather: { state: this.weather.state, timer: this.weather.timer, snow: +this.weather.snow.toFixed(2) }, dragon: this.dragon.state === 'landed' ? 'landed' : 'away', joustDay: this.joustDay, visitDay: this.visitDay, feastDay: this.feastDay, marketDay: this.marketDay, coinsDay: this.coinsDay, horses: this.horses.filter(h => h.home).map(h => [h.home.id, h.col, h.blaze ? 1 : 0]) }; }
  restore(o) {
    if (!o || typeof o !== 'object') return;
    if (SEASON_INFO[o.season]) this.season = o.season;
    if (o.weather) { if (['calm', 'cloudy', 'rain', 'snow', 'storm'].includes(o.weather.state)) this.weather.state = o.weather.state; this.weather.timer = 20; if (Number.isFinite(o.weather.snow)) this.weather.snow = clamp(o.weather.snow, 0, 1); }
    for (const k of ['joustDay', 'visitDay', 'feastDay', 'marketDay', 'coinsDay']) if (Number.isFinite(o[k])) this[k] = o[k];
    if (o.dragon === 'landed') { this.dragon.state = 'arrive'; this.dragon.x = -200; this.dragon.y = 80; }
    this.lastDay = this.G.day;
  }
}
