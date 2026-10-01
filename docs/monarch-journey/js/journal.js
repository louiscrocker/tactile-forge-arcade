/* ============================================================
   journal.js — the field journal, the milkweed garden, the tag
   ============================================================
   Everything a kid collects across generations lives here and
   is saved in localStorage: facts read, nectar plants drunk from,
   trees roosted in, zones flown, milestone stickers, tag
   recoveries, and the garden (seeds in hand, milkweeds planted).
   ============================================================ */
'use strict';

const Journal = {
  KEY: 'monarch.journal',
  data: null,

  blank() {
    return { facts: [], plants: [], trees: [], zones: [], milestones: [], milkweeds: [], tags: [], garden: { seeds: 0, plants: 0 }, years: 0, generations: 0, best: { miles: 0, stops: 0, days: 999 }, seen: 0 };
  },
  load() {
    let d = this.blank();
    try {
      const raw = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (raw && typeof raw === 'object') {
        for (const k of ['facts', 'plants', 'trees', 'zones', 'milestones', 'milkweeds']) if (Array.isArray(raw[k])) d[k] = raw[k].filter(v => typeof v === 'string').slice(0, 200);
        if (Array.isArray(raw.tags)) d.tags = raw.tags.filter(t => t && typeof t.code === 'string').slice(0, 50).map(t => ({ code: String(t.code).slice(0, 12), place: String(t.place || '').slice(0, 60), from: String(t.from || '').slice(0, 60), day: +t.day || 0, miles: +t.miles || 0, found: !!t.found, foundDay: +t.foundDay || 0, gen: +t.gen || 1 }));
        if (raw.garden) { d.garden.seeds = clamp(+raw.garden.seeds || 0, 0, 999); d.garden.plants = clamp(+raw.garden.plants || 0, 0, 12); }
        d.years = clamp(+raw.years || 0, 0, 999); d.generations = clamp(+raw.generations || 0, 0, 9999);
        if (raw.best) d.best = { miles: +raw.best.miles || 0, stops: +raw.best.stops || 0, days: +raw.best.days || 999 };
      }
    } catch (e) { /* corrupt or private mode: start fresh */ }
    this.data = d;
    return d;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ } },
  reset() { this.data = this.blank(); this.save(); },

  has(kind, key) { return this.data[kind].includes(key); },
  /* Returns true when the sticker is new. */
  add(kind, key) {
    if (!key || !this.data[kind] || this.data[kind].includes(key)) return false;
    this.data[kind].push(key);
    this.save();
    Bus.emit('sticker', kind, key);
    return true;
  },
  totals() {
    const t = {
      facts: [this.data.facts.length, Object.keys(FACTS).length],
      plants: [this.data.plants.length, Object.keys(NECTAR_PLANTS).length],
      trees: [this.data.trees.length, Object.keys(TREE_NAMES).length],
      zones: [this.data.zones.length, ZONES.length],
      milestones: [this.data.milestones.length, MILESTONES.length],
      milkweeds: [this.data.milkweeds.length, Object.keys(MILKWEEDS).length]
    };
    let got = 0, all = 0;
    for (const k in t) { got += t[k][0]; all += t[k][1]; }
    t.all = [got, all];
    return t;
  },

  /* ---------- the garden ---------- */
  addSeeds(n) { this.data.garden.seeds = Math.min(999, this.data.garden.seeds + n); this.save(); },
  plant() {
    const g = this.data.garden;
    if (g.seeds <= 0 || g.plants >= 12) return false;
    g.seeds--; g.plants++; this.save();
    this.add('milestones', 'garden');
    return true;
  },
  /* How many monarchs your patch raises in a summer: the science hook made countable. */
  population() { return 6 + this.data.garden.plants * 5; },

  /* ---------- the tag ---------- */
  newTag(place, from, day, miles, gen) {
    const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    const code = letters[rndInt(0, 22)] + letters[rndInt(0, 22)] + letters[rndInt(0, 22)] + ' ' + rndInt(100, 999);
    const t = { code, place, from, day, miles, found: false, foundDay: 0, gen };
    this.data.tags.push(t); if (this.data.tags.length > 50) this.data.tags.shift();
    this.save();
    return t;
  },
  recover(tag, day) { if (!tag) return; tag.found = true; tag.foundDay = day; this.save(); },

  bestRun(miles, stops, days) {
    const b = this.data.best;
    b.miles = Math.max(b.miles, miles); b.stops = Math.max(b.stops, stops); if (days > 0) b.days = Math.min(b.days, days);
    this.save();
  }
};
