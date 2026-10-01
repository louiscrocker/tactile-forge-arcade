/* ============================================================
   pond.js — the pond in cross-section
   ============================================================
   The still water surface is y = 0.  bedY(x) gives the pond
   bottom under water (positive) and the bank surface on land
   (negative), so one function describes the whole ground line.
   The surface itself is a row of springs: anything that hits
   the water pushes a column down and the wave spreads sideways.
   Lily pads float on that surface, sink under weight and tilt
   with the wave.  The calendar, the weather and the winter ice
   live here too.
   ============================================================ */
'use strict';

const DAY_LENGTH = 320;               // real seconds per pond day

class Weather {
  constructor(rng) {
    this.rng = rng || Math.random;
    this.state = 'clear'; this.timer = 40 + this.rng() * 60;
    this.rain = 0; this.cloud = 0; this.rainbow = 0; this.snow = 0; this.gust = 0; this.wind = 0; this.windT = .3;
    this.ice = 0;                       // 0..1 sheet thickness
    this.dry = 0;                       // 0..1 late-summer dry spell
    this.gustTimer = 12;
  }
  get raining() { return this.rain > .5; }
  next(season) {
    const rainChance = { spring: .55, summer: .3, autumn: .5, winter: 0 }[season];
    switch (this.state) {
      case 'clear': this.state = 'cloudy'; this.timer = 25 + this.rng() * 40; break;
      case 'cloudy': if (this.rng() < rainChance) { this.state = 'rain'; this.timer = 35 + this.rng() * 40; Bus.emit('weather', 'rain'); } else { this.state = 'clear'; this.timer = 60 + this.rng() * 80; Bus.emit('weather', 'clear'); } break;
      case 'rain': this.state = 'clearing'; this.timer = 22 + this.rng() * 14; Bus.emit('weather', 'clearing'); break;
      default: this.state = 'clear'; this.timer = 70 + this.rng() * 90; Bus.emit('weather', 'clear');
    }
  }
  update(dt, season, night, seasonT, rate = 1) {
    this.timer -= dt;
    if (this.timer <= 0) this.next(season);
    const ease = (k, target, rate) => { this[k] += (target - this[k]) * (1 - Math.exp(-dt * rate)); };
    const winter = season === 'winter';
    ease('rain', this.state === 'rain' && !winter ? 1 : 0, .35);
    ease('cloud', this.state === 'cloudy' || this.state === 'rain' ? 1 : this.state === 'clearing' ? .45 : (winter ? .6 : 0), .25);
    ease('rainbow', this.state === 'clearing' && !night && !winter ? 1 : 0, .4);
    ease('snow', winter && this.ice > .05 ? 1 : 0, .3);
    /* wind: slow drift plus gusts */
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) { this.gustTimer = 14 + this.rng() * 30; this.gust = 1; this.windT = .2 + this.rng() * .7; Bus.emit('gust'); }
    this.gust = Math.max(0, this.gust - dt * .45);
    ease('wind', this.windT, .3);
    /* a dry spell: the level falls in a hot late summer and rain refills it */
    if (season === 'summer' && seasonT > .3 && this.rain < .3) this.dry = Math.min(1, this.dry + dt * rate / (DAY_LENGTH * 1.3));
    else this.dry = Math.max(0, this.dry - dt * rate * (this.rain > .3 ? 1 / 30 : 1 / 90));
    /* ice: grows through winter (with the calendar, so a fast-forwarded
       winter still freezes over), melts in early spring */
    if (winter) { this.ice = Math.min(1, this.ice + dt * rate / (DAY_LENGTH * .35)); }
    else if (this.ice > 0) {
      const was = this.ice;
      this.ice = Math.max(0, this.ice - dt * Math.max(1, rate * .15) / 26);
      if (was > .35 && this.ice <= .35) Bus.emit('iceBreak');
    }
  }
}

class Pond {
  constructor(G, seed, place = 'home') {
    const P = this.place = PLACES[place] || PLACES.home;
    this.G = G; this.baseSeed = seed; seed = (seed ^ Math.imul(P.salt, 0x9e3779b1)) >>> 0; this.seed = seed;
    const rng = this.rng = mulberry32(seed);
    this.noise = makeNoise1D(seed ^ 0x9e37);
    this.W = P.W;                       // half width of the open water
    this.maxDepth = P.depth;
    this.bounds = { left: -this.W - 900, right: this.W + 900, top: -840, bottom: Math.max(420, this.maxDepth + 160) };

    /* ----- surface springs ----- */
    this.SX0 = -this.W - 300; this.SX1 = this.W + 300; this.SN = 260;
    this.SDX = (this.SX1 - this.SX0) / (this.SN - 1);
    this.sh = new Float32Array(this.SN); this.sv = new Float32Array(this.SN);
    this._ld = new Float32Array(this.SN); this._rd = new Float32Array(this.SN);
    this.subAcc = 0;

    /* ----- lily pads ----- */
    this.pads = [];
    const padXs = [];
    let px = -this.W + 240;
    if (P.pads > 0) while (px < this.W - 240) { px += (190 + rng() * 260) / P.pads; if (px < this.W - 240) padXs.push(px); }
    for (const x of padXs) {
      const r = 38 + rng() * 42;
      this.pads.push({ x, r, y: 0, tilt: 0, sink: 0, weight: 0, ph: rng() * TAU, notch: rng() * TAU, flower: rng() < .45, bloom: 0, size: 1, health: 1, hue: rng(), vx: 0 });
    }
    /* the half-sunk log on the right shallows: a fixed perch */
    this.log = { x: this.W - 330, y: -4, len: 250, r: 24, ang: -.06 };

    /* ----- reeds on both shores ----- */
    this.reeds = [];
    for (const side of [-1, 1]) {
      let x = this.W - 210;
      while (x < this.W + 420) {
        const wx = side * x;
        const base = this.bedY(wx);
        const kind = rng() < .38 ? 'cattail' : rng() < .5 ? 'reed' : 'grass';
        const h = kind === 'grass' ? 40 + rng() * 40 : 150 + rng() * 170;
        this.reeds.push({ x: wx + (rng() - .5) * 12, base, h, lean: (rng() - .5) * .3, kind, ph: rng() * TAU, w: 3 + rng() * 3, side, back: rng() < .45 });
        x += (18 + rng() * 34) / P.reeds;
      }
    }
    this.spawnSpots = [];
    for (const side of [-1, 1]) { const x = side * (this.W - 110 - rng() * 90); this.spawnSpots.push({ x, y: 34 + rng() * 22, side }); }
    this.reeds = this.reeds.filter(r => !this.spawnSpots.some(s => Math.abs(s.x - r.x) < 46));
    this.reeds.sort((a, b) => a.x - b.x);
    /* a reed clump the treefrog can cling to (one per side, tall) */
    this.clingReeds = [];
    for (const side of [-1, 1]) { const wx = side * (this.W - 90); this.clingReeds.push({ x: wx, y: -140, side }); }

    /* ----- underwater weeds ----- */
    this.weeds = [];
    for (let i = 0; i < P.weeds; i++) {
      const x = lerp(-this.W + 60, this.W - 60, rng());
      const base = this.bedY(x);
      const kind = rng() < .4 ? 'elodea' : rng() < .5 ? 'hornwort' : 'ribbon';
      this.weeds.push({ x, base, h: Math.max(12, Math.min(base - 30, 70 + rng() * 190)), ph: rng() * TAU, kind: P.current ? 'ribbon' : kind, sway: .6 + rng() * .8, tint: rng() });
    }
    /* ----- rocks and stones on the bed ----- */
    this.rocks = [];
    for (let i = 0; i < P.rocks; i++) {
      const x = lerp(-this.W + 40, this.W - 40, rng());
      const rx = 22 + rng() * 48, ry = rx * (.45 + rng() * .3);
      this.rocks.push({ x, y: this.bedY(x) + ry * .35, rx, ry, k: rng(), tilt: (rng() - .5) * .4 });
    }
    for (let i = 0; i < 40; i++) { const x = lerp(-this.W + 20, this.W - 20, rng()); this.rocks.push({ x, y: this.bedY(x) + 2, rx: 5 + rng() * 9, ry: 3 + rng() * 5, k: rng(), tilt: 0, pebble: true }); }
    /* ----- where algae can grow (rocks first, bed and weeds after) ----- */
    this.algaeSites = [];
    for (const r of this.rocks) if (!r.pebble) this.algaeSites.push({ x: r.x, y: r.y - r.ry * .8, r: r.rx * .8, kind: 'rock' });
    for (let i = 0; i < 18; i++) { const x = lerp(-this.W + 120, this.W - 120, rng()); this.algaeSites.push({ x, y: this.bedY(x) - 4, r: 30 + rng() * 26, kind: 'bed' }); }
    for (const w of this.weeds) if (rng() < .45) this.algaeSites.push({ x: w.x, y: w.base - w.h * (.3 + rng() * .5), r: 18 + rng() * 14, kind: 'weed', weed: w });
    for (const p of this.pads) if (rng() < .5) this.algaeSites.push({ x: p.x, y: 14, r: p.r * .7, kind: 'pad', pad: p });

    /* ----- special spots ----- */
    const mx = (rng() - .5) * 500;
    this.mudSpot = { x: mx, y: this.bedY(mx) - 10 };
    this.litterSpot = { x: -this.W - 230, y: this.bedY(-this.W - 230) - 2 };
    /* a sunken branch for décor */
    this.branch = { x: -this.W + 520, y: this.bedY(-this.W + 520) - 14, len: 170, ang: -.35 };
    /* ----- what makes each place itself ----- */
    this.culvert = P.culvert ? { side: P.culvert, x: P.culvert * (this.W - 30), y: 52 } : null;
    this.signs = [-1, 1].map(side => ({ side, x: side * (this.W + 600), dest: Places.overland(P.key, side) })).filter(s => s.dest);
    this.mossMats = P.moss ? Array.from({ length: 7 }, () => ({ x: lerp(-this.W + 120, this.W - 120, rng()), r: 40 + rng() * 60, ph: rng() * TAU })) : [];
    this.pitchers = P.pitcher ? Array.from({ length: 9 }, (_, i) => { const side = i % 2 ? 1 : -1, x = side * (this.W + 40 + rng() * 380); return { x, h: 30 + rng() * 26, lean: (rng() - .5) * .4 }; }) : [];
    this.edgeStones = P.stone ? (() => { const a = []; for (const side of [-1, 1]) for (let x = this.W - 30; x < this.W + 260; x += 26 + rng() * 10) a.push({ x: side * x, r: 13 + rng() * 8, k: rng() }); return a; })() : [];
    this.fountain = P.fountain ? { x: this.W + 200 } : null;
    const cattails = this.reeds.filter(r => r.kind === 'cattail' && !r.back);
    this.blackbird = P.blackbird && cattails.length ? { reed: cattails[(rng() * cattails.length) | 0], sing: 0, t: rng() * 5 } : null;

    /* ----- calendar ----- */
    this.dayOfYear = 1; this.year = 1; this.season = 'spring'; this.seasonT = 0; this.seasonChanged = false;
    this.updateSeason();
    this.weather = new Weather(mulberry32(seed ^ 0x77));
    this.thawT = 0; this.t = 0;
    this.level = 0; this.wet = this.W;
  }
  /* how far out the water reaches when the level has dropped */
  wetW() { return this.wet; }
  updateWet() { let x = this.W; while (x > this.W - 500 && this.bedY(x) < this.level + 8) x -= 10; this.wet = x; }

  /* ---------- geometry ---------- */
  bedY(x) {
    const ax = Math.abs(x), W = this.W;
    if (ax >= W) {
      const d = ax - W;
      return 2 - smoothstep(0, 300, d) * 64 - (this.noise(ax * .011) - .5) * 26 * smoothstep(0, 80, d);
    }
    const u = x / W;
    const base = Math.pow(1 - u * u, .72) * this.maxDepth;
    const bump = (this.noise(x * .013 + 40) - .5) * 70 * smoothstep(0, .18, 1 - Math.abs(u));
    return Math.max(3, base + bump);
  }
  isLand(x) { return Math.abs(x) >= this.W; }
  /* the stream's current, px/s to the right; slower near the bed and in the lee of big rocks */
  currentAt(x, y) {
    const c = this.place.current; if (!c || Math.abs(x) >= this.W) return 0;
    let k = smoothstep(-10, 40, y) * (1 - .6 * smoothstep(this.bedY(x) - 70, this.bedY(x), y)) * smoothstep(0, 160, this.wetW() - Math.abs(x));
    for (const r of this.rocks) if (!r.pebble && x > r.x && x < r.x + r.rx * 2.6 && y > r.y - r.ry * 2.2) { k *= .15; break; }
    return c * k * (1 - this.weather.ice);
  }
  inWater(x, y) { return Math.abs(x) < this.W && y > this.surfaceAt(x) && y < this.bedY(x); }
  depthAt(x) { return Math.max(0, this.bedY(x)); }

  /* ---------- surface ---------- */
  waveBias(x) { const w = this.weather; return (w.wind * 2.6 * Math.sin(x * .011 - this.t * 1.5) + w.gust * 2.2 * Math.sin(x * .031 - this.t * 3.1)) * (1 - w.ice); }
  surfaceAt(x) {
    if (Math.abs(x) >= this.W) return this.level;
    const fi = (x - this.SX0) / this.SDX;
    if (fi <= 0) return this.sh[0]; if (fi >= this.SN - 1) return this.sh[this.SN - 1];
    const i = fi | 0, f = fi - i;
    return this.sh[i] + (this.sh[i + 1] - this.sh[i]) * f + this.waveBias(x) * smoothstep(0, 120, this.W - Math.abs(x)) + this.level;
  }
  surfaceSlope(x) { return (this.surfaceAt(x + 12) - this.surfaceAt(x - 12)) / 24; }
  /* push a column: amt in world units of velocity, positive = down */
  disturb(x, amt, width = 2) {
    if (this.weather.ice > .5) return;
    const c = Math.round((x - this.SX0) / this.SDX);
    for (let i = c - width; i <= c + width; i++) {
      if (i < 0 || i >= this.SN) continue;
      const k = 1 - Math.abs(i - c) / (width + 1);
      this.sv[i] += amt * k * k;
    }
  }
  updateSurface(dt) {
    const h = this.sh, v = this.sv, N = this.SN, ld = this._ld, rd = this._rd;
    const stiff = this.weather.ice > .5 ? 60 : 24, damp = this.weather.ice > .5 ? 8 : 1.4, spread = .24;
    this.subAcc += dt;
    const step = 1 / 60;
    let guard = 0;
    while (this.subAcc >= step && guard++ < 4) {
      this.subAcc -= step;
      for (let i = 0; i < N; i++) { v[i] += (-stiff * h[i] - damp * v[i]) * step; h[i] += v[i] * step; }
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < N; i++) {
          ld[i] = i > 0 ? spread * (h[i] - h[i - 1]) : 0;
          rd[i] = i < N - 1 ? spread * (h[i] - h[i + 1]) : 0;
        }
        for (let i = 0; i < N; i++) {
          if (i > 0) { v[i - 1] += ld[i] * .5; h[i - 1] += ld[i] * step * 8; }
          if (i < N - 1) { v[i + 1] += rd[i] * .5; h[i + 1] += rd[i] * step * 8; }
        }
      }
      /* keep the shores pinned */
      h[0] = h[N - 1] = 0; v[0] = v[N - 1] = 0;
    }
    if (this.subAcc > step * 4) this.subAcc = 0;
  }

  /* ---------- lily pads ---------- */
  padSize(p) { return p.r * p.size * (0.15 + .85 * p.health); }
  padAt(x, y, margin = 0) {
    for (const p of this.pads) {
      const r = this.padSize(p);
      if (r < 14) continue;
      if (Math.abs(x - p.x) < r - margin && Math.abs(y - p.y) < 40) return p;
    }
    return null;
  }
  /* the log counts as a fixed pad */
  onLog(x) { const l = this.log; return Math.abs(x - l.x) < l.len / 2 - 10; }
  logTop(x) { const l = this.log; return l.y - l.r + (x - l.x) * Math.tan(l.ang) - 2; }
  /* standing height for a frog at x: pad top, log top, or bank */
  perchAt(x, y) {
    const pad = this.padAt(x, y, 6);
    if (pad) return { kind: 'pad', y: pad.y - 3, pad };
    if (this.onLog(x) && y < this.logTop(x) + 30) return { kind: 'log', y: this.logTop(x) };
    if (this.isLand(x)) return { kind: 'land', y: this.bedY(x) };
    return null;
  }

  /* ---------- calendar ---------- */
  updateSeason() {
    const idx = clamp(Math.floor((this.dayOfYear - 1) / DAYS_PER_SEASON), 0, 3);
    const s = SEASONS[idx];
    if (s !== this.season) { this.season = s; this.seasonChanged = true; }
    this.seasonT = ((this.dayOfYear - 1) % DAYS_PER_SEASON) / DAYS_PER_SEASON;
  }
  /* a day ends.  Winter is refused until every player is a frog, so
     nobody is ever frozen out as a tadpole. */
  endDay(mayAdvance) {
    const next = this.dayOfYear + 1;
    const wouldBeWinter = next > 3 * DAYS_PER_SEASON;
    if (wouldBeWinter && !mayAdvance) return;
    this.dayOfYear = next;
    if (this.dayOfYear > 4 * DAYS_PER_SEASON) { this.dayOfYear = 1; this.year++; }
    this.updateSeason();
  }
  toSpring() { this.dayOfYear = 1; this.year++; this.updateSeason(); }
  bareness() { return this.season === 'autumn' ? smoothstep(.15, .95, this.seasonT) : this.season === 'winter' ? 1 : 0; }

  /* ---------- per frame ---------- */
  update(dt, tod, night, rate = 1) {
    const wx = this.weather;
    this.t += dt;
    wx.update(dt, this.season, night > .5, this.seasonT, rate);
    if (this.seasonChanged) { this.seasonChanged = false; Bus.emit('season', this.season); }
    /* wind ripples and rain rings */
    if (wx.ice < .5) {
      const w = wx.wind + wx.gust;
      if (chance(dt * (2 + w * 14))) this.disturb(lerp(-this.W, this.W, Math.random()), rnd(-18, 18) * (0.4 + w), 1);
      if (wx.rain > .3 && chance(dt * 40 * wx.rain)) this.disturb(lerp(-this.W, this.W, Math.random()), rnd(8, 26), 1);
    }
    this.updateSurface(dt);
    this.level += (wx.dry * 46 - this.level) * (1 - Math.exp(-dt * .2));
    this.updateWet();
    /* pads follow the surface and sink under weight */
    const info = SEASON_INFO[this.season];
    for (const p of this.pads) {
      let sizeT = 1, healthT = 1;
      if (this.season === 'spring') sizeT = .3 + .7 * smoothstep(0, .6, this.seasonT);
      if (this.season === 'autumn') healthT = 1 - smoothstep(.2, 1, this.seasonT);
      if (this.season === 'winter') { healthT = 0; sizeT = .3; }
      p.size += (sizeT - p.size) * (1 - Math.exp(-dt * .3));
      p.health += (healthT - p.health) * (1 - Math.exp(-dt * .3));
      const bloomT = this.season === 'summer' && p.flower ? 1 : (this.season === 'spring' && p.flower ? smoothstep(.6, 1, this.seasonT) : 0);
      p.bloom += (bloomT * (night < .6 ? 1 : .2) - p.bloom) * (1 - Math.exp(-dt * .5));
      p.sink += (p.weight * 7 - p.sink) * (1 - Math.exp(-dt * 6));
      p.weight = 0;
      const r = this.padSize(p);
      p.y = this.surfaceAt(p.x) + p.sink + (1 - p.health) * 6;
      p.tilt = (this.surfaceAt(p.x + r) - this.surfaceAt(p.x - r)) / (2 * r) * .8;
      /* stranded on the mud when the water has dropped away */
      const bed = this.bedY(p.x);
      if (p.y > bed - 4) { p.y = bed - 3; p.tilt = 0; p.stranded = true; p.health = Math.max(0, p.health - dt * .02); } else p.stranded = false;
    }
    if (info.pads === 'grow' && this.thawT < 1) this.thawT = Math.min(1, this.thawT + dt / 30);
    if (this.season === 'winter') this.thawT = 0;
  }
}
