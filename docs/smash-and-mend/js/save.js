/* ============================================================
   save.js — progress along the street (key `smash.save`).
   Stars per level, best times, what went up on each cleared lot,
   the hats and the bucket.  Everything is shape-checked on load:
   anything odd is dropped, and a save that is not an object at
   all starts a fresh street.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'smash.save', VERSION: 1,
  data: null,
  fresh() { return { version: this.VERSION, stars: {}, best: {}, styles: {}, hats: { mungo: 'hardhat', pip: 'beanie' }, bucket: 'blue', played: 0 }; },
  /* clean any object into a valid save (or null if it is not a save at all) */
  clean(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.version !== this.VERSION) return null;
    const d = this.fresh();
    const ids = new Set(ALL_LEVELS.map(l => l.id));
    if (o.stars && typeof o.stars === 'object') for (const k in o.stars) if (ids.has(k) && Number.isInteger(o.stars[k]) && o.stars[k] >= 0 && o.stars[k] <= 3) d.stars[k] = o.stars[k];
    if (o.best && typeof o.best === 'object') for (const k in o.best) { const b = o.best[k]; if (ids.has(k) && b && Number.isFinite(b.time) && b.time > 0 && Number.isFinite(b.score) && b.score >= 0) d.best[k] = { time: b.time, score: Math.floor(b.score) }; }
    if (o.styles && typeof o.styles === 'object') for (const k in o.styles) if (ids.has(k) && STYLES.some(s => s.key === o.styles[k])) d.styles[k] = o.styles[k];
    if (o.hats && typeof o.hats === 'object') for (const who of ['mungo', 'pip']) if (HATS[who].some(h => h.key === o.hats[who])) d.hats[who] = o.hats[who];
    if (BUCKETS.some(b => b.key === o.bucket)) d.bucket = o.bucket;
    if (Number.isInteger(o.played) && o.played >= 0) d.played = o.played;
    return d;
  },
  load() {
    let o = null;
    try { const s = localStorage.getItem(this.KEY); if (s) o = this.clean(JSON.parse(s)); } catch (e) { o = null; }
    this.data = o || this.fresh();
    return this.data;
  },
  write() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); return true; } catch (e) { return false; } },
  hasProgress() { const d = this.data; return !!d && (Object.keys(d.stars).length > 0 || d.played > 0); },
  reset() { this.data = this.fresh(); try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } },

  totalStars() { let n = 0; for (const l of LEVELS) n += this.data.stars[l.id] || 0; return n; },
  unlocked(id) {
    const i = LEVELS.findIndex(l => l.id === id);
    if (i === 0) return true;
    if (i > 0) return (this.data.stars[LEVELS[i - 1].id] || 0) >= 1;
    if (COOP_LEVELS.some(l => l.id === id)) return (this.data.stars.cottage || 0) >= 1;
    return false;
  },
  hatUnlocked(who, key) { const h = HATS[who].find(x => x.key === key); return !!h && this.totalStars() >= h.stars; },
  bucketUnlocked(key) { const b = BUCKETS.find(x => x.key === key); return !!b && this.totalStars() >= b.stars; },
  styleUnlocked(key) { const s = STYLES.find(x => x.key === key); return !!s && (!s.level || (this.data.stars[s.level] || 0) >= 1); },
  /* everything that a finished level newly unlocks, as {kind, name} */
  record(result) {
    const before = this.snapshot();
    const d = this.data, id = result.id;
    d.played++;
    if (!result.outOfTime) {
      d.stars[id] = Math.max(d.stars[id] || 0, result.stars);
      const b = d.best[id];
      if (!b || result.time < b.time) d.best[id] = { time: Math.round(result.time * 10) / 10, score: Math.max(result.score, b ? b.score : 0) };
      else b.score = Math.max(b.score, result.score);
    }
    this.write();
    const after = this.snapshot();
    return after.filter(x => !before.some(y => y.kind === x.kind && y.key === x.key));
  },
  snapshot() {
    const out = [];
    for (const l of ALL_LEVELS) if (this.unlocked(l.id)) out.push({ kind: 'level', key: l.id, name: l.name });
    for (const who of ['mungo', 'pip']) for (const h of HATS[who]) if (this.hatUnlocked(who, h.key)) out.push({ kind: 'hat', key: who + ':' + h.key, name: h.name, who });
    for (const b of BUCKETS) if (this.bucketUnlocked(b.key)) out.push({ kind: 'bucket', key: b.key, name: b.name });
    for (const s of STYLES) if (this.styleUnlocked(s.key)) out.push({ kind: 'style', key: s.key, name: s.name });
    return out;
  }
};
