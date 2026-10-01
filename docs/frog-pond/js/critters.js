/* ============================================================
   critters.js — algae, wrigglers, flying bugs, dragonfly nymphs,
                 minnows and snails
   ============================================================
   Everything that lives in the pond besides the frogs.  Algae is
   tadpole food and grows back in the light.  Wrigglers (mosquito
   larvae) hang from the surface and dive when rushed.  Flies,
   mosquitoes and dragonflies buzz above the water for frogs to
   snap.  Nymphs lurk on the bottom and lunge at tadpoles, then
   in summer climb a reed and turn into dragonflies.
   ============================================================ */
'use strict';

/* ---------------- algae ---------------- */
class Algae {
  constructor(pond) {
    this.pond = pond;
    const rng = mulberry32(pond.seed ^ 0x41);
    this.patches = pond.algaeSites.map(site => ({ site, amount: .45 + rng() * .5, x: site.x, y: site.y }));
  }
  count() { return this.patches.reduce((n, p) => n + p.amount, 0); }
  /* a patch you can graze from (x, y) */
  nearest(x, y, reach = 10) {
    let best = null, bd = 1e9;
    for (const p of this.patches) {
      if (p.amount < .06) continue;
      if (p.site.kind === 'pad' && p.site.pad.health < .3) continue;
      const d = dist(x, y, p.x, p.y) - p.site.r * (0.35 + .65 * p.amount);
      if (d < reach && d < bd) { bd = d; best = p; }
    }
    return best;
  }
  graze(p, amt) { p.amount = Math.max(0, p.amount - amt); }
  update(dt, env) {
    const rate = .012 * env.light * env.algae;
    for (const p of this.patches) {
      if (p.site.kind === 'pad') { p.y = p.site.pad.y + 12; p.x = p.site.pad.x; if (p.site.pad.health < .3) { p.amount = Math.max(0, p.amount - dt * .05); continue; } }
      if (p.site.kind === 'weed') { const w = p.site.weed; p.x = w.x + Math.sin(env.time * .7 + w.ph) * .12 * w.sway * (w.base - p.site.y) * .8; }
      p.amount = Math.min(1, p.amount + dt * rate * (1.2 - p.amount));
    }
  }
}

/* ---------------- wrigglers: mosquito larvae at the surface ---------------- */
class Wrigglers {
  constructor(pond) {
    this.pond = pond; this.list = [];
    const rng = mulberry32(pond.seed ^ 0x99);
    for (let i = 0; i < 16; i++) this.add(lerp(-pond.W + 80, pond.W - 80, rng()), rng);
  }
  add(x, rng = Math.random) { const w = { x, y: 6, depth: 4 + rng() * 8, ph: rng() * TAU, dive: 0, diveT: 0, drift: (rng() - .5) * 6, caught: false, wr: 1 }; this.list.push(w); return w; }
  count() { return this.list.length; }
  remove(w) { const i = this.list.indexOf(w); if (i >= 0) this.list.splice(i, 1); }
  nearest(x, y, r) {
    let best = null, bd = r;
    for (const w of this.list) { if (w.caught) continue; const d = dist(x, y, w.x, w.y + 8); if (d < bd) { bd = d; best = w; } }
    return best;
  }
  update(dt, hunters, diff, env) {
    const pond = this.pond;
    const ice = pond.weather.ice > .5;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      if (w.caught) continue;
      w.ph += dt * (w.dive > .5 ? 14 : 5);
      /* dive away from anything rushing at it */
      for (const h of hunters) {
        if (!h.canHuntWrigglers || !h.canHuntWrigglers()) continue;
        const d = dist(h.x, h.y, w.x, w.y + 8), sp = Math.hypot(h.vx, h.vy);
        if (d < 70 && sp > 55 * (1.3 - diff.wrigglerFear) && w.diveT <= 0) { w.diveT = 2.5 + diff.wrigglerFear * 2; }
      }
      if (w.diveT > 0) { w.diveT -= dt; w.dive += (1 - w.dive) * (1 - Math.exp(-dt * 8)); }
      else w.dive += (0 - w.dive) * (1 - Math.exp(-dt * 1.2));
      w.x += w.drift * dt + Math.sin(w.ph * .3) * 3 * dt;
      w.x = clamp(w.x, -pond.W + 40, pond.W - 40);
      const surf = pond.surfaceAt(w.x);
      w.y = surf + w.depth + w.dive * 46 + (ice ? 20 : 0);
    }
    /* births and cold */
    const cap = Math.round(18 * env.wrigglers * (env.raining ? 1.3 : 1));
    if (this.list.length < cap && chance(dt * .12 * (1 + env.wrigglers))) this.add(lerp(-pond.W + 80, pond.W - 80, Math.random()));
    if (env.cold && this.list.length > 2 && chance(dt * .05)) this.list.pop();
    if (this.list.length > cap + 6 && chance(dt * .1)) this.list.shift();
  }
}

/* ---------------- flying bugs ---------------- */
const BUG_KINDS = {
  fly: { speed: 95, yMin: -220, yMax: -8, worth: 2, name: 'fly' },
  mosquito: { speed: 48, yMin: -70, yMax: -4, worth: 1, name: 'mosquito' },
  dragonfly: { speed: 230, yMin: -200, yMax: -30, worth: 3, name: 'dragonfly' },
  mayfly: { speed: 40, yMin: -260, yMax: -6, worth: 1, name: 'mayfly' }
};
class Bugs {
  constructor(pond) {
    this.pond = pond; this.list = [];
    const rng = mulberry32(pond.seed ^ 0x55);
    for (let i = 0; i < 6; i++) this.add('fly', lerp(-pond.W, pond.W, rng()), -40 - rng() * 120);
    for (let i = 0; i < 4; i++) this.add('mosquito', lerp(-pond.W, pond.W, rng()), -10 - rng() * 30);
  }
  add(kind, x, y) {
    const k = BUG_KINDS[kind];
    const b = { kind, x, y, vx: 0, vy: 0, tx: x, ty: y, timer: 0, wing: rnd(TAU), dir: 1, caught: false, rest: 0, col: pick(['#3aa0d8', '#4fc47a', '#d84a3a', '#8a5ad8']), ph: rnd(TAU), id: Math.random() };
    this.list.push(b); return b;
  }
  count() { return this.list.filter(b => !b.caught).length; }
  remove(b) { const i = this.list.indexOf(b); if (i >= 0) this.list.splice(i, 1); }
  nearest(x, y, r) {
    let best = null, bd = r;
    for (const b of this.list) { if (b.caught) continue; const d = dist(x, y, b.x, b.y); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  update(dt, env, diff) {
    const pond = this.pond, W = pond.W + 260;
    const wind = (pond.weather.wind * .4 + pond.weather.gust) * 60;
    for (const b of this.list) {
      if (b.caught) continue;
      const k = BUG_KINDS[b.kind];
      b.wing += dt * (b.kind === 'dragonfly' ? 40 : 60);
      b.timer -= dt;
      if (b.kind === 'mayfly') {
        /* the mayfly dance: rise, then float down */
        b.vx += (Math.sin(env.time * .7 + b.ph) * 30 - b.vx) * (1 - Math.exp(-dt * 2));
        b.vy += ((Math.sin(env.time * 1.3 + b.ph * 2) > 0 ? -50 : 25) - b.vy) * (1 - Math.exp(-dt * 1.5));
      } else if (b.kind === 'dragonfly') {
        /* fast patrol with sine height, turns at the edges */
        b.vx += (b.dir * k.speed * diff.bugSpeed - b.vx) * (1 - Math.exp(-dt * 2));
        b.vy = Math.sin(b.ph + env.time * 2.2) * 40;
        if (b.x > W - 100) b.dir = -1; if (b.x < -W + 100) b.dir = 1;
        if (b.timer <= 0) { b.timer = rnd(2, 5); if (chance(.3)) b.dir *= -1; b.ph = rnd(TAU); }
        b.y = clamp(b.y, k.yMin, k.yMax);
      } else if (b.kind === 'mosquito') {
        if (b.rest > 0) { b.rest -= dt; b.vx = b.vy = 0; continue; }
        if (b.timer <= 0) {
          b.timer = rnd(.4, 1.4);
          if (chance(.06) && env.night < .4) { b.rest = rnd(3, 8); }
          b.tx = clamp(b.x + rnd(-70, 70), -W, W); b.ty = clamp(pond.surfaceAt(clamp(b.x, -pond.W, pond.W)) + rnd(-50, -6), k.yMin, k.yMax);
        }
        b.vx += ((b.tx - b.x) * 2 - b.vx) * (1 - Math.exp(-dt * 4));
        b.vy += ((b.ty - b.y) * 2 - b.vy) * (1 - Math.exp(-dt * 4));
        const m = Math.hypot(b.vx, b.vy), cap = k.speed * diff.bugSpeed; if (m > cap) { b.vx *= cap / m; b.vy *= cap / m; }
      } else {
        /* fly: erratic darting */
        if (b.timer <= 0) { b.timer = rnd(.15, .7); const a = rnd(TAU); b.vx = Math.cos(a) * k.speed * diff.bugSpeed * rnd(.4, 1.2); b.vy = Math.sin(a) * k.speed * diff.bugSpeed * rnd(.3, .8); if (b.y > -30) b.vy -= 40; if (b.y < -180) b.vy += 40; }
        if (b.x > W) b.vx = -Math.abs(b.vx); if (b.x < -W) b.vx = Math.abs(b.vx);
      }
      b.x += (b.vx + wind * .3) * dt; b.y += b.vy * dt;
      if (b.kind !== 'mosquito') b.y = clamp(b.y, k.yMin, k.yMax);
      const floor = pond.isLand(b.x) ? pond.bedY(b.x) - 8 : pond.surfaceAt(b.x) - 4;
      if (b.y > floor) { b.y = floor; b.vy = -Math.abs(b.vy) * .5 - 10; }
      b.x = clamp(b.x, -W, W);
      if (Math.abs(b.vx) > 5) b.dir = sign(b.vx);
    }
    /* population targets by season, time and weather */
    const rain = env.raining ? .3 : 1;
    const want = {
      fly: Math.round(7 * env.bugs * (1 - env.night * .7) * rain),
      mosquito: Math.round(6 * env.bugs * (.35 + env.night) * (env.raining ? .6 : 1)),
      dragonfly: env.season === 'summer' && env.night < .3 ? 2 : 0
    };
    for (const kind in want) {
      const have = this.list.filter(b => b.kind === kind && !b.caught).length;
      if (have < want[kind] && chance(dt * .35)) { const side = chance(.5) ? -1 : 1; this.add(kind, side * (pond.W + 200), kind === 'mosquito' ? -20 : -80 - rnd(80)); }
      else if (have > want[kind] && chance(dt * (want[kind] === 0 ? .6 : .12))) { const b = this.list.find(b => b.kind === kind && !b.caught && (want[kind] === 0 || Math.abs(b.x) > pond.W * .5)); if (b) this.remove(b); }
    }
  }
}

/* ---------------- dragonfly nymphs ---------------- */
class Nymphs {
  constructor(pond, G) {
    this.pond = pond; this.G = G; this.list = []; this.enabled = true; this.husks = [];
    this.rng = mulberry32(pond.seed ^ 0x33);
    this.setCount(2);
  }
  setCount(n) {
    while (this.list.length < n) { const x = lerp(-this.pond.W + 300, this.pond.W - 300, this.rng()); this.list.push({ x, y: this.pond.bedY(x) - 8, dir: this.rng() < .5 ? -1 : 1, state: 'lurk', jaw: 0, timer: this.rng() * 6, walk: 0, tx: x, target: null, lungeT: 0, id: Math.random() }); }
    while (this.list.length > n) this.list.pop();
  }
  update(dt, hunters, diff, env) {
    const pond = this.pond;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i];
      n.timer -= dt;
      switch (n.state) {
        case 'lurk':
          n.jaw += (0 - n.jaw) * (1 - Math.exp(-dt * 6));
          if (n.timer <= 0) { n.timer = rnd(4, 12); n.tx = clamp(n.x + rnd(-260, 260), -pond.W + 200, pond.W - 200); n.state = 'walk'; }
          if (this.enabled && !env.cold) {
            for (const h of hunters) {
              if (!h.isTadpole || !h.isTadpole()) continue;
              if (dist(h.x, h.y, n.x, n.y) < diff.nymphRange) { n.state = 'twitch'; n.timer = .75; n.target = h; n.dir = sign(h.x - n.x); Bus.emit('nymphWarn', h); break; }
            }
          }
          /* summer: climb out and become a dragonfly */
          if (env.season === 'summer' && env.night < .3 && this.list.length > 1 && chance(dt * .006)) { n.state = 'climb'; n.dir = sign(n.x); n.tx = sign(n.x) * (pond.W - 60); n.climbY = 0; }
          break;
        case 'walk':
          n.walk += dt * 6; n.dir = sign(n.tx - n.x);
          n.x += n.dir * 22 * dt;
          n.y = pond.bedY(n.x) - 8;
          if (Math.abs(n.tx - n.x) < 4 || n.timer <= 0) { n.state = 'lurk'; n.timer = rnd(3, 9); }
          break;
        case 'twitch':
          n.jaw = .25 + Math.sin(env.time * 40) * .15;
          if (n.timer <= 0) { n.state = 'lunge'; n.lungeT = 0; }
          break;
        case 'lunge': {
          n.lungeT += dt;
          n.jaw = Math.min(1, n.lungeT / .22);
          const h = n.target;
          if (h) n.dir = sign(h.x - n.x) || n.dir;
          if (n.lungeT >= .2 && !n.checked) {
            n.checked = true;
            const tipX = n.x + n.dir * 34, tipY = n.y - 2;
            if (h && dist(h.x, h.y, tipX, tipY) < 40 + h.scale() * 12 && h.burst < .35 && h.isTadpole()) { h.frightened(n.x, n.y, 'nymph'); Bus.emit('nymphHit', h); }
            else Bus.emit('nymphMiss', h);
            this.G.particles.puff(tipX, tipY, 'rgba(120,100,70,.6)', 6);
          }
          if (n.lungeT > .5) { n.state = 'recover'; n.timer = 3; n.checked = false; }
          break;
        }
        case 'recover':
          n.jaw += (0 - n.jaw) * (1 - Math.exp(-dt * 4));
          if (n.timer <= 0) { n.state = 'lurk'; n.timer = rnd(2, 6); }
          break;
        case 'climb': {
          /* crawl to the shore, then up the reed */
          if (Math.abs(n.x - n.tx) > 6) { n.walk += dt * 6; n.x += sign(n.tx - n.x) * 26 * dt; n.y = pond.bedY(n.x) - 8; }
          else { n.climbY += dt * 24; n.y = pond.bedY(n.x) - 8 - n.climbY; if (n.y < -130) { n.state = 'emerge'; n.timer = 4; Bus.emit('fact', 'dragonfly'); } }
          break;
        }
        case 'emerge':
          if (n.timer <= 0) {
            this.husks.push({ x: n.x, y: n.y, dir: n.dir, life: 400 });
            if (this.G.bugs) { const d = this.G.bugs.add('dragonfly', n.x, n.y - 10); d.dir = -n.dir; }
            this.G.particles.sparkle(n.x, n.y, 16, '#dff6ff', 16);
            Bus.emit('dragonflyEmerged');
            const x = lerp(-pond.W + 300, pond.W - 300, Math.random());
            this.list[i] = { x, y: pond.bedY(x) - 8, dir: 1, state: 'lurk', jaw: 0, timer: 8, walk: 0, tx: x, target: null, lungeT: 0, id: Math.random() };
          }
          break;
      }
    }
    for (let i = this.husks.length - 1; i >= 0; i--) { this.husks[i].life -= dt; if (this.husks[i].life <= 0) this.husks.splice(i, 1); }
  }
}

/* ---------------- minnows: a small school, purely alive ---------------- */
class Minnows {
  constructor(pond) {
    this.pond = pond; this.list = [];
    const rng = mulberry32(pond.seed ^ 0x21);
    const cx = lerp(-pond.W * .5, pond.W * .5, rng()), cy = 120 + rng() * 120;
    for (let i = 0; i < 7; i++) this.list.push({ x: cx + (rng() - .5) * 60, y: cy + (rng() - .5) * 40, vx: 30, vy: 0, ph: rng() * TAU });
    this.tx = cx; this.ty = cy; this.timer = 0;
  }
  update(dt, players, env) {
    const pond = this.pond;
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = rnd(4, 9); this.tx = lerp(-pond.W * .7, pond.W * .7, Math.random()); this.ty = rnd(60, 260); }
    for (const m of this.list) {
      let ax = (this.tx - m.x) * .6, ay = (this.ty - m.y) * .6;
      for (const p of players) { const d = dist(p.x, p.y, m.x, m.y); if (d < 90) { ax += (m.x - p.x) / d * 400; ay += (m.y - p.y) / d * 300; } }
      for (const o of this.list) { if (o === m) continue; const d = dist(o.x, o.y, m.x, m.y) || 1; if (d < 18) { ax += (m.x - o.x) / d * 60; ay += (m.y - o.y) / d * 60; } }
      m.vx += ax * dt; m.vy += ay * dt;
      const sp = Math.hypot(m.vx, m.vy), cap = env.cold ? 25 : 90; if (sp > cap) { m.vx *= cap / sp; m.vy *= cap / sp; }
      m.x += m.vx * dt; m.y += m.vy * dt; m.ph += dt * (4 + sp * .1);
      const surf = pond.surfaceAt(m.x) + 24, bed = pond.bedY(m.x) - 12;
      if (m.y < surf) { m.y = surf; m.vy = Math.abs(m.vy); } if (m.y > bed) { m.y = bed; m.vy = -Math.abs(m.vy); }
      m.x = clamp(m.x, -pond.W + 60, pond.W - 60);
    }
  }
}

class Snails {
  constructor(pond) {
    this.pond = pond; this.list = [];
    const rng = mulberry32(pond.seed ^ 0x11);
    for (let i = 0; i < 5; i++) { const x = lerp(-pond.W + 100, pond.W - 100, rng()); this.list.push({ x, dir: rng() < .5 ? -1 : 1, t: rng() * 10 }); }
  }
  update(dt) { for (const s of this.list) { s.t += dt; s.x += s.dir * 2.5 * dt; if (Math.abs(s.x) > this.pond.W - 90) s.dir *= -1; } }
}
