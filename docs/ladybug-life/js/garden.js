/* ============================================================
   garden.js — several plants, the turning year, and the weather
   ============================================================
   The Garden owns the plants (each with its own aphids, ants and
   wild larvae), the calendar (day of year → season) and the
   weather machine (clear → clouds → rain → rainbow; gusts; snow).
   It also knows where the warm crack in the garden wall is, for
   hibernating.
   ============================================================ */
'use strict';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const DAYS_PER_SEASON = 4;
const SEASON_INFO = {
  spring: { name: 'Spring', leafTint: ['#a8e07a', .35], birth: 1.2, rain: .45, temp: 'mild', blurb: 'New leaves, new aphids, and ladybugs waking up hungry.' },
  summer: { name: 'Summer', leafTint: ['#3f8a2e', 0], birth: 1.0, rain: .2, temp: 'warm', blurb: 'Aphid colonies boom. Larvae grow fast in the warmth.' },
  autumn: { name: 'Autumn', leafTint: ['#e0a030', .55], birth: .45, rain: .35, temp: 'cool', blurb: 'Leaves turn and drop. Ladybugs fatten up before the cold.' },
  winter: { name: 'Winter', leafTint: ['#8a6a3a', .8], birth: 0, rain: 0, temp: 'cold', blurb: 'Too cold to fly. Ladybugs huddle together in a sheltered crack and sleep until spring.' }
};

class Garden {
  constructor(G, seed, layout) {
    this.G = G;
    this.seed = seed;
    const rng = mulberry32(seed ^ 0xabc);
    this.plants = [];
    layout = layout || [
      { type: 'bean', x: -1650 },
      { type: 'rose', x: 0 },
      { type: 'milkweed', x: 1650 }
    ];
    layout.forEach((l, i) => {
      const p = new Plant((seed + i * 7919) >>> 0, { type: l.type, x: l.x, id: i });
      p.aphids = new Aphids(p, G);
      p.ants = new Ants(p, G);
      p.npcs = [];
      this.plants.push(p);
    });
    this.bounds = this.plants.reduce((b, p) => ({
      left: Math.min(b.left, p.bounds.left), right: Math.max(b.right, p.bounds.right),
      top: Math.min(b.top, p.bounds.top), bottom: 0
    }), { left: 1e9, right: -1e9, top: 1e9, bottom: 0 });
    /* the garden wall with the warm crack, off to the right */
    this.wall = { x: this.bounds.right + 380, crack: { x: this.bounds.right + 380, y: -140 } };
    this.bounds.right += 620;
    this.bounds.left -= 200;

    /* calendar */
    this.dayOfYear = 1;      // 1..16
    this.year = 1;
    this.season = 'spring';
    this.seasonT = 0;        // 0..1 through the current season
    this.seasonChanged = false;

    this.weather = new Weather(this, rng);
  }

  get main() { return this.plants[Math.floor(this.plants.length / 2)]; }

  plantAt(id) { return this.plants[id] || this.plants[0]; }

  /* All leaf spots everywhere (for eggs / pupation choices). */
  allLeafSpots() { return this.plants.flatMap(p => p.leafSpots); }

  /* Nearest branch point across every plant. */
  nearest(wx, wy, maxDist) {
    let best = null;
    for (const p of this.plants) {
      const n = p.nearest(wx, wy, maxDist);
      if (n && (!best || n.d < best.d)) best = n;
    }
    return best;
  }

  /* Called by main when a garden day ends. `mayAdvance` is false when the
     player is still a larva or pupa and winter would strand them. */
  endDay(mayAdvance) {
    const nextDoy = this.dayOfYear + 1;
    const nextSeason = SEASONS[Math.min(3, Math.floor((nextDoy - 1) / DAYS_PER_SEASON))];
    if (nextSeason === 'winter' && !mayAdvance) return;      // hold the year at late autumn
    this.dayOfYear = nextDoy;
    if (this.dayOfYear > SEASONS.length * DAYS_PER_SEASON) { this.dayOfYear = 1; this.year++; }
    this.updateSeason();
  }

  updateSeason() {
    const s = SEASONS[Math.min(3, Math.floor((this.dayOfYear - 1) / DAYS_PER_SEASON))];
    this.seasonT = ((this.dayOfYear - 1) % DAYS_PER_SEASON) / DAYS_PER_SEASON;
    if (s !== this.season) { this.season = s; this.seasonChanged = true; Bus.emit('season', s); }
  }

  /* Spring again after hibernation. */
  toSpring() {
    this.dayOfYear = 1; this.year++;
    this.updateSeason();
    for (const p of this.plants) { p.aphids.list.length = 0; p.aphids.seedColonies(); }
  }

  /* How bare the plants are: 0 full leaf, 1 winter twigs. */
  bareness() {
    if (this.season === 'autumn') return smoothstep(.35, 1, this.seasonT) * .7;
    if (this.season === 'winter') return .85;
    if (this.season === 'spring') return (1 - smoothstep(0, .5, this.seasonT)) * .5;
    return 0;
  }

  update(dt, tod) {
    for (const p of this.plants) { p.time = this.G.time; p.gust = this.weather.gust; }
    this.weather.update(dt, tod, this.season);
  }
}

/* ============================================================ */

class Weather {
  constructor(garden, rng) {
    this.garden = garden;
    this.state = 'clear';        // clear | cloudy | rain | clearing
    this.timer = rnd(40, 90);
    this.rain = 0;               // 0..1 intensity, eased
    this.cloud = 0;              // 0..1 overcast
    this.rainbow = 0;            // 0..1 visible
    this.gust = 0;               // 0..1 extra wind
    this.gustTimer = rnd(20, 45);
    this.snow = 0;
    this.rng = rng;
    this.firstRain = false;
  }

  update(dt, tod, season) {
    const info = SEASON_INFO[season];
    this.timer -= dt;
    if (this.timer <= 0) {
      switch (this.state) {
        case 'clear':
          if (season !== 'winter' && chance(info.rain)) { this.state = 'cloudy'; this.timer = rnd(8, 14); }
          else this.timer = rnd(40, 90);
          break;
        case 'cloudy': this.state = 'rain'; this.timer = rnd(18, 32); if (!this.firstRain) { this.firstRain = true; Bus.emit('fact', 'rain'); } Bus.emit('weather', 'rain'); break;
        case 'rain': this.state = 'clearing'; this.timer = rnd(25, 40); Bus.emit('weather', 'clearing'); break;
        case 'clearing': this.state = 'clear'; this.timer = rnd(60, 140); break;
      }
    }
    const k = 1 - Math.exp(-dt * .6);
    this.cloud += (((this.state === 'cloudy' || this.state === 'rain') ? 1 : (this.state === 'clearing' ? .35 : 0)) - this.cloud) * k;
    this.rain += ((this.state === 'rain' ? 1 : 0) - this.rain) * (1 - Math.exp(-dt * .8));
    const day = tod > .3 && tod < .78;
    this.rainbow += (((this.state === 'clearing' && day) ? 1 : 0) - this.rainbow) * (1 - Math.exp(-dt * .5));
    this.snow += ((season === 'winter' ? 1 : 0) - this.snow) * (1 - Math.exp(-dt * .3));

    /* gusts */
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTimer = rnd(25, 60) * (this.state === 'rain' ? .5 : 1);
      this.gustLeft = rnd(2.2, 4);
      Bus.emit('gust');
    }
    if (this.gustLeft > 0) { this.gustLeft -= dt; this.gust = Math.min(1, this.gust + dt * 2.5); }
    else this.gust = Math.max(0, this.gust - dt * 1.2);
  }

  get raining() { return this.rain > .4; }
}
