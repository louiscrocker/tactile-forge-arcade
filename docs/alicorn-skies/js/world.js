/* ============================================================
   world.js — the land, the sky, and everything that stays put
   ============================================================
   One World holds the terrain (a height function), the lake,
   Rainbow Mountain, the trees and flowers and crystals, the
   cloud platforms of the Cloud Kingdom, the Moon, the floating
   stars and gems, the quest rings, the weather and the calendar.
   Everything is grown from a seed so a saved game can regrow it.
   ============================================================ */
'use strict';

const DAY_LENGTH = 240;          // real seconds per in-game day
const WORLD_BOUNDS = { left: -7000, right: 7000, top: -4700, bottom: 190 };
const LAKE = { x0: 2400, x1: 4800, y: 0 };
const STAR_RESPAWN = 75;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_DAYS = 3;                 // in-game days per season when the seasons turn by themselves
const ICE_HOLE = { x0: 3230, x1: 3370 };  // a hole in the winter ice so you can still dive

/* clear → cloudy → rain → clearing (rainbow) → clear */
class Weather {
  constructor(rng) {
    this.rng = rng || Math.random;
    this.state = 'clear'; this.timer = 60 + this.rng() * 90;
    this.rain = 0; this.cloud = 0; this.rainbow = 0; this.gust = 0; this.gustTimer = 20;
  }
  get raining() { return this.rain > .3; }
  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      switch (this.state) {
        case 'clear': this.state = 'cloudy'; this.timer = 25 + this.rng() * 20; break;
        case 'cloudy': this.state = this.rng() < .75 ? 'rain' : 'clear'; this.timer = this.state === 'rain' ? 35 + this.rng() * 25 : 90 + this.rng() * 90; break;
        case 'rain': this.state = 'clearing'; this.timer = 40; Bus.emit('weather', 'clearing'); break;
        case 'clearing': this.state = 'clear'; this.timer = 120 + this.rng() * 120; break;
      }
      if (this.state === 'rain') Bus.emit('weather', 'rain');
    }
    const tr = this.state === 'rain' ? 1 : 0;
    const tc = this.state === 'rain' ? 1 : this.state === 'cloudy' ? .7 : this.state === 'clearing' ? .25 : 0;
    const tb = this.state === 'clearing' ? 1 : 0;
    this.rain += (tr - this.rain) * (1 - Math.exp(-dt * .25));
    this.cloud += (tc - this.cloud) * (1 - Math.exp(-dt * .2));
    this.rainbow += (tb - this.rainbow) * (1 - Math.exp(-dt * .3));
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) { this.gustTimer = 18 + this.rng() * 30; this.gust = 1; Bus.emit('gust'); }
    this.gust = Math.max(0, this.gust - dt * .35);
  }
}

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    this.rng = mulberry32(seed);
    this.noise = makeNoise1D(seed ^ 0x9e37);
    this.bounds = Object.assign({}, WORLD_BOUNDS);
    this.weather = new Weather(mulberry32(seed ^ 0x77));
    this.time = 0;
    this.rainbowRestored = 0;      // 0 grey .. 1 full colour (the big bridge)
    this.season = 'spring'; this.snow = 0; this.autumn = 0; this.blossom = 1; this.ice = 0;
    this.build();
  }

  /* ---------- terrain ---------- */
  groundY(x) {
    const n = this.noise;
    let y = -(n(x / 640) * 80 + n(x / 210 + 50) * 22);
    if (x > 2200 && x < 5000) {                       // the lake basin
      const k = smoothstep(2200, 2500, x) * (1 - smoothstep(4700, 4900, x));
      const deep = smoothstep(2650, 3250, x) * (1 - smoothstep(4150, 4650, x));
      y = lerp(y, 170 + n(x / 300) * 30 + deep * (460 + n(x / 170 + 9) * 70), k);
    }
    if (x > 4700) {                                    // Rainbow Mountain
      const k = smoothstep(4850, 6500, x);
      y -= k * k * 1050 + smoothstep(4850, 5000, x) * 120;
      y += Math.sin(x / 90) * 8 * k;
      if (x > 6500) y += smoothstep(6500, 7000, x) * 150;
    }
    return y;
  }
  isWater(x) { return x > LAKE.x0 && x < LAKE.x1 && this.groundY(x) > LAKE.y; }
  get frozen() { return this.ice > .6; }
  isIce(x) { return this.frozen && this.isWater(x) && !(x > ICE_HOLE.x0 && x < ICE_HOLE.x1); }
  canDive(x) { return this.isWater(x) && !this.isIce(x) && this.groundY(x) > LAKE.y + 90; }
  standY(x) { return this.isWater(x) ? LAKE.y : this.groundY(x); }
  slope(x) { return (this.standY(x + 6) - this.standY(x - 6)) / 12; }
  zoneAt(x) { return ZONES.find(z => x >= z.x0 && x < z.x1) || (x < 0 ? ZONES[0] : ZONES[3]); }
  skyZoneAt(y) { return SKY_ZONES.find(z => y >= z.y0 && y < z.y1) || null; }
  placeName(x, y) { const s = this.skyZoneAt(y); if (s && s.key !== 'sky') return s; if (this.moonTop(x) !== null && y < this.moon.y) return { key: 'moon', name: 'the Moon' }; return this.zoneAt(x); }

  /* the Moon's top surface at x, or null when not over it */
  moonTop(x) {
    const m = this.moon, dx = x - m.x;
    if (Math.abs(dx) > m.r * .82) return null;
    return m.y - Math.sqrt(m.r * m.r - dx * dx);
  }
  /* Every surface that could hold hooves at x.  kind: ground | water | cloud | moon */
  surfacesAt(x) {
    const out = [{ kind: this.isWater(x) ? (this.isIce(x) ? 'ice' : 'water') : 'ground', y: this.standY(x), obj: null }];
    for (const c of this.clouds) if (x > c.x - c.w / 2 + 14 && x < c.x + c.w / 2 - 14) out.push({ kind: 'cloud', y: c.y + Math.sin(x * .015 + c.seed) * 3, obj: c });
    const mt = this.moonTop(x); if (mt !== null) out.push({ kind: 'moon', y: mt, obj: this.moon });
    return out;
  }
  /* The nearest surface at or just below the feet (y).  Used for landing and for following the ground. */
  surfaceBelow(x, y, tol = 14) {
    let best = null;
    for (const s of this.surfacesAt(x)) if (s.y >= y - tol && (!best || s.y < best.y)) best = s;
    return best;
  }
  surfaceY(s, x) {
    if (!s) return this.standY(x);
    if (s.kind === 'cloud') return s.obj.y + Math.sin(x * .015 + s.obj.seed) * 3;
    if (s.kind === 'moon') { const t = this.moonTop(x); return t === null ? Infinity : t; }
    return this.standY(x);
  }
  onSurface(s, x) {
    if (!s) return true;
    if (s.kind === 'cloud') return x > s.obj.x - s.obj.w / 2 + 14 && x < s.obj.x + s.obj.w / 2 - 14;
    if (s.kind === 'moon') return this.moonTop(x) !== null;
    return true;
  }

  /* ---------- build everything from the seed ---------- */
  build() {
    const rng = this.rng;
    const R = (a, b) => a + rng() * (b - a);

    this.castle = { x: 0, y: this.groundY(0), w: 520, h: 420 };
    this.cave = { x: 5460, y: this.groundY(5460), w: 220, h: 150 };
    this.bigOak = { x: -3900, y: this.groundY(-3900) };
    this.moon = { x: 900, y: -4000, r: 170 };
    this.summit = { x: 6500, y: this.groundY(6500) };
    this.waterfall = { x: 4870, top: this.groundY(4930), bottom: LAKE.y };
    this.stable = { x: -820, y: this.groundY(-820) };
    this.raceArch = { x: 700, y: this.groundY(700) };
    this.grotto = { x: 3650, y: this.groundY(3650) };

    /* cloud platforms: {x, y (top), w, seed, name} */
    this.clouds = [
      { x: 0, y: -2100, w: 760, seed: 1, castle: true, name: 'Cloud Castle' },
      { x: -5600, y: -2200, w: 340, seed: 2 }, { x: -4200, y: -1800, w: 380, seed: 3 }, { x: -3100, y: -2300, w: 320, seed: 4 },
      { x: -1900, y: -1700, w: 420, seed: 5 }, { x: -900, y: -2450, w: 300, seed: 6 }, { x: 1100, y: -1850, w: 360, seed: 7 },
      { x: 2300, y: -2350, w: 400, seed: 8 }, { x: 3800, y: -2000, w: 460, seed: 9, name: "Rainbow's End" }, { x: 5200, y: -2500, w: 300, seed: 10 },
      { x: 6300, y: -1900, w: 360, seed: 11 }, { x: -6600, y: -1650, w: 300, seed: 12 }
    ];
    for (const c of this.clouds) c.h = 60 + c.w * .12;
    this.cloudCastle = this.clouds[0];
    this.rainbowEnd = this.clouds.find(c => c.name === "Rainbow's End");

    /* trees */
    this.trees = [];
    const tree = (x, kind, s, back) => this.trees.push({ x, y: this.groundY(x), kind, s, seed: rng() * 1e6 | 0, back: !!back, ph: rng() * TAU });
    for (let x = -6900; x < -2300; x += R(70, 130)) {
      if (Math.abs(x - FRIENDS.hoot.x) < 60 || Math.abs(x - this.bigOak.x) < 140) continue;
      tree(x, rng() < .45 ? 'oak' : rng() < .5 ? 'birch' : 'pine', R(.8, 1.35), rng() < .35);
    }
    tree(this.bigOak.x, 'bigoak', 1.9, false);
    tree(FRIENDS.hoot.x, 'oak', 1.5, false);
    for (const x of [-1700, 1250, 1750, 2050, -2000]) tree(x, rng() < .5 ? 'blossom' : 'oak', R(.9, 1.2), false);
    tree(-1180, 'apple', 1.1, false); tree(-480, 'apple', 1.0, false);
    for (const x of [2280, 2340, 4890]) tree(x, 'willow', R(1, 1.25), false);
    for (let x = 5050; x < 6950; x += R(110, 190)) { if (Math.abs(x - this.cave.x) < 200 || Math.abs(x - this.summit.x) < 220) continue; tree(x, 'pine', R(.7, 1.1), rng() < .4); }
    this.trees.sort((a, b) => (a.back === b.back ? a.x - b.x : a.back ? -1 : 1));

    /* flowers */
    this.flowers = [];
    const FK = ['daisy', 'tulip', 'bluebell', 'sunflower', 'poppy', 'daisy', 'tulip'];
    const flower = (x, kind) => this.flowers.push({ x, y: this.standY(x), kind: kind || FK[rng() * FK.length | 0], col: rng(), s: R(.8, 1.25), ph: rng() * TAU, bloom: 1, sleepy: false, magicT: 0 });
    for (let x = -2150; x < 2150; x += R(14, 30)) { if (Math.abs(x) < 190 || Math.abs(x + 820) < 170 || Math.abs(x - 700) < 90) continue; flower(x); }
    for (let x = -6900; x < -2300; x += R(40, 90)) flower(x, rng() < .6 ? 'bluebell' : 'daisy');
    for (let x = 2200; x < 2390; x += R(20, 35)) flower(x);
    for (let x = 4810; x < 5000; x += R(20, 35)) flower(x);
    for (let x = 5000; x < 6900; x += R(60, 140)) flower(x, rng() < .5 ? 'poppy' : 'daisy');
    for (let x = -180; x < 180; x += R(18, 30)) flower(x, rng() < .5 ? 'tulip' : 'daisy');   // castle garden

    /* crystals: {x, y, col, s, lit, quest} */
    this.crystals = [];
    const crystal = (x, y, col, s, quest) => this.crystals.push({ x, y, col, s, lit: 0, quest: !!quest, ph: rng() * TAU });
    /* six on rocks poking out of the lake */
    this.rocks = [];
    for (const x of [2560, 2950, 3400, 3750, 4150, 4550]) { this.rocks.push({ x, y: LAKE.y + 6, w: R(70, 100), h: R(38, 50), seed: rng() }); crystal(x, LAKE.y - 30, pick(['#7fe0ff', '#c58bff', '#ff8fd0', '#8fffc8']), R(1, 1.3), true); }
    for (const x of [-6500, -5300, -4000, -2500]) crystal(x, this.groundY(x) - 10, pick(['#8fe3ff', '#c99bff']), R(.8, 1.1), false);
    for (const dx of [-70, 40, 90]) crystal(this.cave.x + dx, this.cave.y - 6, pick(['#ff9a5c', '#ffd06a', '#c58bff']), R(.8, 1.1), false);
    crystal(6720, this.groundY(6720) - 8, '#ff8fd0', 1.2, false);
    for (const dx of [-140, 150]) this.rocks.push({ x: this.cave.x + dx, y: this.cave.y + 4, w: R(60, 90), h: R(30, 40), seed: rng() });

    /* mushrooms and reeds and lily pads (decor) */
    this.mushrooms = [];
    for (let x = -6800; x < -2300; x += R(120, 300)) this.mushrooms.push({ x, y: this.groundY(x), s: R(.7, 1.3), red: rng() < .6, seed: rng() });
    this.reeds = [];
    for (let x = 2360; x < 2480; x += R(12, 22)) this.reeds.push({ x, y: LAKE.y, h: R(50, 90), ph: rng() * TAU });
    for (let x = 4700; x < 4820; x += R(12, 22)) this.reeds.push({ x, y: LAKE.y, h: R(50, 90), ph: rng() * TAU });
    this.pads = [];
    for (let x = 2600; x < 4700; x += R(90, 220)) if (Math.abs(x - FRIENDS.lily.x) > 60) this.pads.push({ x, y: LAKE.y, r: R(22, 38), ph: rng() * TAU, flower: rng() < .3 });
    this.pads.push({ x: FRIENDS.lily.x, y: LAKE.y, r: 44, ph: 0, flower: true, home: true });

    /* floating stars to collect */
    this.stars = [];
    const star = (x, y) => this.stars.push({ x, y, taken: false, timer: 0, ph: rng() * TAU, r: R(11, 15) });
    for (let i = 0; i < 60; i++) { const x = R(-6800, 6800); const g = this.standY(x); const arc = Math.sin(i * 1.3) * 60; star(x, g - R(60, 380) - arc); }
    for (let i = 0; i < 40; i++) star(R(-6800, 6800), R(-1450, -600));
    for (let i = 0; i < 40; i++) star(R(-6800, 6800), R(-2850, -1550));
    for (let i = 0; i < 50; i++) star(R(-6800, 6800), R(-4600, -2950));
    for (const c of this.clouds) for (let i = 0; i < 3; i++) star(c.x + R(-c.w * .4, c.w * .4), c.y - R(40, 140));
    /* a welcome trail of stars from the castle up into the sky */
    for (let i = 0; i < 8; i++) star(300 + i * 90, this.groundY(300 + i * 90) - 80 - i * 70);

    /* the seven rainbow gems (shown during the rainbow quest) */
    this.gems = [
      { idx: 0, col: RAINBOW[0], name: 'red', x: -270, y: this.groundY(-270) - 26, where: ['in the castle garden', 'by the castle'] },
      { idx: 1, col: RAINBOW[1], name: 'orange', x: -230, y: this.cloudCastle.y - 26, where: ['on the Cloud Castle', 'on the Cloud Castle'] },
      { idx: 2, col: RAINBOW[2], name: 'yellow', x: 4870, y: -110, where: ['behind the waterfall', 'by the waterfall'] },
      { idx: 3, col: RAINBOW[3], name: 'green', x: this.bigOak.x + 30, y: this.bigOak.y - 330, where: ['at the top of the big oak tree in the woods', 'up the big tree'] },
      { idx: 4, col: RAINBOW[4], name: 'blue', x: this.moon.x - 40, y: this.moon.y - this.moon.r - 24, where: ['on the Moon!', 'on the Moon!'] },
      { idx: 5, col: RAINBOW[5], name: 'indigo', x: this.cave.x + 60, y: this.cave.y - 30, where: ["in Ember's cave", "in Ember's cave"] },
      { idx: 6, col: RAINBOW[6], name: 'violet', x: this.summit.x + 60, y: this.summit.y - 30, where: ['on the very top of Rainbow Mountain', 'on top of the mountain'] }
    ];
    for (const g of this.gems) { g.taken = false; g.shown = false; g.ph = rng() * TAU; if (g.idx === 0 || g.idx === 5 || g.idx === 6) g.y = Math.min(g.y, this.groundY(g.x) - 40); }

    /* five fallen stars in the woods (shown during the fallen-star quest) */
    this.fallen = [-6400, -5700, -5100, -4150, -3600].map((x, i) => ({ x, y: this.groundY(x) - 14, state: 'hidden', t: 0, ph: i }));

    /* apples hang on the apple trees; magic shakes them down */
    this.apples = [];
    for (const t of this.trees.filter(t => t.kind === 'apple')) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + rng(); this.apples.push({ tree: t, hx: t.x + Math.cos(a) * 60 * t.s, hy: t.y - (150 + Math.sin(a) * 34) * t.s, x: 0, y: 0, vy: 0, state: 'hang', timer: 0 }); }
    for (const a of this.apples) { a.x = a.hx; a.y = a.hy; }

    /* under the lake: seaweed, coral, shells with pearls, a treasure chest, jellyfish */
    this.seaweed = []; this.coral = [];
    for (let x = 2700; x < 4550; x += R(40, 90)) { const b = this.groundY(x); if (b < LAKE.y + 120) continue; this.seaweed.push({ x, y: b, h: R(60, 170), ph: rng() * TAU, col: pick(['#3fa86a', '#5ac27a', '#2f8f6a', '#7fcf5a']) }); }
    for (let x = 2800; x < 4450; x += R(90, 170)) { const b = this.groundY(x); if (b < LAKE.y + 200) continue; this.coral.push({ x, y: b, kind: pick(['fan', 'branch', 'brain']), col: pick(['#ff8fb8', '#ffb07a', '#c58bff', '#ff6f8f', '#ffd06a']), s: R(.8, 1.3) }); }
    this.shells = [2950, 3250, 3520, 3900, 4200].map((x, i) => ({ x, y: this.groundY(x) - 6, state: 'hidden', t: 0, i, col: ['#ffd6e8', '#fff1d6', '#e6dcff', '#d6f5ff', '#ffe0cc'][i] }));
    this.chest = { x: 3380, y: this.groundY(3380), open: 0 };
    this.jellies = [];
    for (let i = 0; i < 6; i++) this.jellies.push({ x: R(2900, 4300), y: R(120, 420), ph: rng() * TAU, col: pick(['#ffb3e6', '#b3d9ff', '#d6b3ff']), s: R(.7, 1.2) });

    /* winter: snowmen in the meadow */
    this.snowmen = [-1450, 1480, -3000].map(x => ({ x, y: this.groundY(x), s: R(.9, 1.15), hat: pick(['#ff5f9a', '#9b6cff', '#3fb8ff']) }));

    /* the constellation: the Unicorn */
    this.constellation = { pts: [[-2650, -3650], [-2380, -3860], [-2080, -3800], [-1880, -4020], [-2180, -4180]].map(([x, y], i) => ({ x, y, i, lit: false })), lit: 0, done: false };

    /* rings appear per quest */
    this.rings = [];
    this.stormClouds = [];   // owned by critters
  }

  /* rings for a quest: set 'learn' (3 over the meadow) or 'ember' (8 up the mountain) */
  spawnRings(set) {
    this.rings = this.rings.filter(r => r.set !== set);
    const pts = set === 'learn'
      ? [[640, -280], [900, -500], [1230, -700]]
      : set === 'race' ? RACE_COURSE
      : [[5700, -520], [5930, -680], [6120, -860], [6300, -1080], [6480, -1330], [6600, -1600], [6380, -1850], [6100, -2000]];
    pts.forEach(([x, y], i) => this.rings.push({ x, y, r: set === 'learn' ? 80 : set === 'race' ? 78 : 68, set, i, passed: false, t: 0 }));
  }
  clearRings(set) { this.rings = this.rings.filter(r => r.set !== set); }

  /* the season: key is spring|summer|autumn|winter; instant skips the easing */
  setSeason(key, instant) {
    this.season = key;
    if (instant) { this.snow = key === 'winter' ? 1 : 0; this.ice = this.snow; this.autumn = key === 'autumn' ? 1 : 0; this.blossom = key === 'spring' ? 1 : 0; }
  }
  showShells(on) { for (const s of this.shells) if (s.state === 'hidden' && on) s.state = 'closed'; }

  showGems(on) { for (const g of this.gems) g.shown = on && !g.taken; }
  showFallen(on) { for (const f of this.fallen) if (f.state === 'hidden' && on) f.state = 'down'; }

  /* ---------- per frame ---------- */
  update(dt, tod) {
    this.time += dt;
    this.weather.update(dt);
    for (const s of this.stars) if (s.taken) { s.timer -= dt; if (s.timer <= 0) { s.taken = false; } }
    for (const f of this.flowers) { f.bloom = approach(f.bloom, f.sleepy ? 0 : 1, dt * .9); if (f.magicT > 0) f.magicT -= dt; }
    for (const c of this.crystals) if (c.litTarget) c.lit = approach(c.lit, 1, dt * .8);
    for (const f of this.fallen) if (f.state === 'rising') { f.t += dt; f.y -= dt * (60 + f.t * 120); if (f.t > 6) f.state = 'gone'; }
    for (const r of this.rings) r.t += dt;
    /* seasons ease in over about a minute */
    const k = 1 - Math.exp(-dt * .05);
    this.snow += ((this.season === 'winter' ? 1 : 0) - this.snow) * k;
    this.ice += ((this.season === 'winter' ? 1 : 0) - this.ice) * k * .8;
    this.autumn += ((this.season === 'autumn' ? 1 : 0) - this.autumn) * k;
    this.blossom += ((this.season === 'spring' ? 1 : 0) - this.blossom) * k;
    /* apples fall, lie in the grass, and grow back */
    for (const a of this.apples) {
      if (a.state === 'fall') { a.vy += 900 * dt; a.y += a.vy * dt; const g = this.groundY(a.x) - 7; if (a.y >= g) { a.y = g; a.state = 'ground'; a.vy = 0; } }
      else if (a.state === 'taken') { a.timer -= dt; if (a.timer <= 0) { a.state = 'hang'; a.x = a.hx; a.y = a.hy; } }
    }
    for (const s of this.shells) if (s.state === 'open') s.t = Math.min(1, s.t + dt * 2);
    for (const j of this.jellies) { j.ph += dt; j.y += Math.sin(j.ph * .7) * 10 * dt; j.x += Math.cos(j.ph * .3) * 6 * dt; }
    if (this.rainbowTarget) this.rainbowRestored = approach(this.rainbowRestored, 1, dt * .12);
  }

  /* how far the nearest thing that still wants magic is (Infinity if none) */
  magicTargetDist(x, y) {
    let d = Infinity;
    for (const f of this.flowers) if (f.sleepy) d = Math.min(d, dist(f.x, f.y - 10, x, y));
    for (const c of this.crystals) if (!c.litTarget) d = Math.min(d, dist(c.x, c.y - 20, x, y));
    for (const f of this.fallen) if (f.state === 'down') d = Math.min(d, dist(f.x, f.y, x, y));
    for (const s of this.stormClouds) if (!s.happy) d = Math.min(d, dist(s.x, s.y, x, y) - s.r);
    for (const s of this.shells) if (s.state === 'closed') d = Math.min(d, dist(s.x, s.y, x, y));
    for (const a of this.apples) if (a.state === 'hang') d = Math.min(d, dist(a.x, a.y, x, y) + 40);
    return d;
  }

  /* things that react to horn magic within `range` of (x,y); returns a list of what happened */
  magicAt(x, y, range) {
    const hits = [];
    for (const f of this.flowers) {
      if (dist(f.x, f.y - 10, x, y) > range) continue;
      if (f.sleepy) { f.sleepy = false; hits.push({ kind: 'flowerBloomed', x: f.x, y: f.y - 14 }); }
      else if (f.magicT <= 0) { f.magicT = 40; hits.push({ kind: 'flowerMagic', x: f.x, y: f.y - 14 }); }
    }
    for (const c of this.crystals) {
      if (dist(c.x, c.y - 20, x, y) > range || c.litTarget) continue;
      c.litTarget = true; hits.push({ kind: c.quest ? 'crystalLit' : 'crystalGlow', x: c.x, y: c.y - 24 });
    }
    for (const f of this.fallen) {
      if (f.state !== 'down' || dist(f.x, f.y, x, y) > range) continue;
      f.state = 'rising'; f.t = 0; hits.push({ kind: 'starLifted', x: f.x, y: f.y });
    }
    for (const s of this.stormClouds) {
      if (s.happy || dist(s.x, s.y, x, y) > range + s.r) continue;
      s.happy = 1e-6; hits.push({ kind: 'cloudCheered', x: s.x, y: s.y });
    }
    for (const s of this.shells) {
      if (s.state !== 'closed' || dist(s.x, s.y, x, y) > range) continue;
      s.state = 'open'; s.t = 0; hits.push({ kind: 'shellOpened', x: s.x, y: s.y - 10, shell: s });
    }
    let shook = 0;
    for (const a of this.apples) {
      if (a.state !== 'hang' || dist(a.tree.x, a.tree.y - 170 * a.tree.s, x, y) > range + 60) continue;
      a.state = 'fall'; a.vy = rnd(-60, 0); shook++;
    }
    if (shook) hits.push({ kind: 'applesShaken', x, y, n: shook });
    return hits;
  }

  /* ---------- save / restore ---------- */
  serialize() {
    return {
      stars: this.stars.map((s, i) => s.taken ? i : -1).filter(i => i >= 0),
      gems: this.gems.map(g => g.taken ? 1 : 0), gemsShown: this.gems.some(g => g.shown),
      fallen: this.fallen.map(f => f.state),
      crystals: this.crystals.map(c => c.litTarget ? 1 : 0),
      sleepy: this.flowers.map((f, i) => f.sleepy ? i : -1).filter(i => i >= 0),
      constellation: this.constellation.pts.map(p => p.lit ? 1 : 0), constDone: this.constellation.done,
      rainbow: this.rainbowRestored, rainbowTarget: !!this.rainbowTarget,
      rings: this.rings.filter(r => r.set !== 'race').map(r => ({ set: r.set, i: r.i, passed: r.passed })),
      shells: this.shells.map(s => s.state === 'open' ? 'taken' : s.state),
      weather: { state: this.weather.state, timer: this.weather.timer, rain: this.weather.rain, cloud: this.weather.cloud }
    };
  }
  restore(o) {
    if (!o) return;
    for (const i of o.stars || []) if (this.stars[i]) { this.stars[i].taken = true; this.stars[i].timer = STAR_RESPAWN; }
    (o.gems || []).forEach((t, i) => { if (this.gems[i]) { this.gems[i].taken = !!t; this.gems[i].shown = !!o.gemsShown && !t; } });
    (o.fallen || []).forEach((s, i) => { if (this.fallen[i]) { this.fallen[i].state = s === 'rising' ? 'gone' : s; } });
    (o.crystals || []).forEach((l, i) => { if (this.crystals[i] && l) { this.crystals[i].litTarget = true; this.crystals[i].lit = 1; } });
    for (const i of o.sleepy || []) if (this.flowers[i]) { this.flowers[i].sleepy = true; this.flowers[i].bloom = 0; }
    (o.constellation || []).forEach((l, i) => { if (this.constellation.pts[i]) this.constellation.pts[i].lit = !!l; });
    this.constellation.lit = this.constellation.pts.filter(p => p.lit).length; this.constellation.done = !!o.constDone;
    this.rainbowRestored = o.rainbow || 0; this.rainbowTarget = !!o.rainbowTarget;
    const sets = new Set((o.rings || []).map(r => r.set));
    for (const s of sets) { this.spawnRings(s); for (const r of this.rings) { const saved = (o.rings || []).find(q => q.set === r.set && q.i === r.i); if (saved) r.passed = saved.passed; } }
    if (o.weather) Object.assign(this.weather, o.weather);
    (o.shells || []).forEach((st, i) => { if (this.shells[i]) this.shells[i].state = st; });
  }
}
