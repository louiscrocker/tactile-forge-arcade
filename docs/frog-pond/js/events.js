/* ============================================================
   events.js — the pond's special days, and a garden visitor
   ============================================================
     mayfly hatch   one summer evening the mayflies rise from the
                    water in a cloud; a feast for every frog
     the big night  the first warm rainy night of spring, frogs
                    arrive from everywhere and the chorus is huge
     first frost    one late-autumn morning the banks and pads
                    sparkle white
     ladybug        on sunny days a ladybug from the garden game
                    flies in and lands on a lily pad.  Frogs will
                    not eat it: ladybugs taste bitter.
   ============================================================ */
'use strict';

class PondEvents {
  constructor(G) {
    this.G = G;
    this.done = {};           // key → year it happened
    this.frost = 0;
    this.ladybug = null; this.ladyTimer = rnd(40, 90);
    this.extras = [];
  }
  once(key) { const y = this.G.pond.year; if (this.done[key] === y) return false; this.done[key] = y; return true; }

  update(dt, env) {
    const G = this.G, g = G.pond, tod = env.tod;
    /* ---- mayfly hatch: a summer evening ---- */
    if (g.season === 'summer' && tod > .72 && tod < .8 && g.weather.rain < .3 && this.done.mayfly !== g.year && g.seasonT > .2) {
      this.done.mayfly = g.year;
      for (let i = 0; i < 46; i++) { const b = G.bugs.add('mayfly', lerp(-g.W + 100, g.W - 100, Math.random()), g.surfaceAt(0) - rnd(2, 20)); b.life = rnd(50, 80); b.vy = -rnd(20, 60); }
      Bus.emit('mayflyHatch');
    }
    for (let i = G.bugs.list.length - 1; i >= 0; i--) { const b = G.bugs.list[i]; if (b.kind === 'mayfly' && !b.caught) { b.life -= dt; if (b.life <= 0) G.bugs.list.splice(i, 1); } }

    /* ---- the big night: first rainy night of spring ---- */
    if (g.season === 'spring' && G.night > .6 && g.weather.rain > .5 && this.done.bignight !== g.year) {
      this.done.bignight = g.year;
      const keys = g.place.chorus || Object.keys(SPECIES);
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1, x = side * (g.W + 30 + Math.random() * 360);
        const f = { species: SPECIES[pick(keys)], throat: 0, callT: rnd(.5, 4), blink: 0, blinkT: rnd(5), present: 0, s: .6 + Math.random() * .3, x, y: g.bedY(x), kind: 'bank', dir: -side, extra: true };
        G.chorus.frogs.push(f); this.extras.push(f);
      }
      Bus.emit('bigNight');
    }
    if (this.extras.length && G.night < .2) { G.chorus.frogs = G.chorus.frogs.filter(f => !f.extra); this.extras = []; }

    /* ---- first frost: a late autumn morning ---- */
    if (g.season === 'autumn' && g.seasonT > .6 && tod > .26 && tod < .34 && this.done.frost !== g.year) { this.done.frost = g.year; this.frost = 1; Bus.emit('firstFrost'); }
    if (this.frost > 0) this.frost = Math.max(0, this.frost - dt / 90);

    /* ---- the ladybug visitor ---- */
    const L = this.ladybug;
    if (!L) {
      this.ladyTimer -= dt;
      const pads = g.pads.filter(p => g.padSize(p) > 30 && p.health > .6);
      if (this.ladyTimer <= 0 && pads.length && G.night < .2 && (g.season === 'spring' || g.season === 'summer') && g.weather.rain < .3) {
        const pad = pick(pads), side = chance(.5) ? -1 : 1;
        this.ladybug = { x: side * (g.W + 500), y: -260, pad, state: 'fly', t: 0, dir: -side, wing: 0 };
        Bus.emit('ladybugVisit');
      } else if (this.ladyTimer <= 0) this.ladyTimer = 30;
    } else {
      L.t += dt; L.wing += dt * 50;
      if (L.state === 'fly') {
        const tx = L.pad.x, ty = L.pad.y - 6, dx = tx - L.x, dy = ty - L.y, d = Math.hypot(dx, dy);
        L.dir = sign(dx) || L.dir;
        if (d < 6) { L.state = 'sit'; L.t = 0; }
        else { const sp = Math.min(d, 120 * dt); L.x += dx / d * sp; L.y += dy / d * sp + Math.sin(L.t * 6) * 12 * dt; }
      } else if (L.state === 'sit') {
        L.x = L.pad.x + Math.sin(L.t * .6) * 10; L.y = L.pad.y - 6;
        for (const p of G.players) if (dist(p.x, p.y, L.x, L.y) < 60 && p.isFrogLike()) L.t = Math.max(L.t, 30);
        if (L.t > 35) { L.state = 'leave'; L.t = 0; }
      } else {
        L.x += L.dir * 90 * dt; L.y -= 70 * dt;
        if (L.y < -500) { this.ladybug = null; this.ladyTimer = rnd(120, 240); }
      }
    }
  }
  serialize() { return { done: this.done }; }
  restore(o) { if (o && o.done) this.done = o.done; }
}
