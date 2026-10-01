/* ============================================================
   critters.js — the friends, the lamb, the dragon, butterflies,
                 birds, storm clouds and leaping fish
   ============================================================
   Friends stand at their homes and talk when a player comes
   close.  What they say comes from quests.js; this file only
   moves and animates them.
   ============================================================ */
'use strict';

class Friends {
  constructor(G) {
    this.G = G;
    const W = G.world;
    this.list = [];
    for (const key of Object.keys(FRIENDS)) {
      const d = FRIENDS[key];
      const f = { key, def: d, x: d.x, y: 0, dir: -1, home: d.home, homeX: d.x, hidden: !!d.hidden, blink: 0, blinkT: rnd(2, 5), anim: 0, hop: 0, hopT: rnd(1, 3), talkCd: 0, wander: 0, state: 'home', bob: 0, flap: 0, time: rnd(TAU), hiccup: 0, hiccupT: rnd(3, 6), graze: 0, throat: 0 };
      this.placeHome(f);
      this.list.push(f);
    }
    this.byKey = Object.fromEntries(this.list.map(f => [f.key, f]));
  }
  placeHome(f) {
    const W = this.G.world;
    switch (f.home) {
      case 'branch': f.y = W.groundY(f.x) - 95; break;
      case 'pad': f.y = LAKE.y - 3; break;
      case 'water': f.y = LAKE.y + 2; break;
      case 'cloudcastle': f.x = W.cloudCastle.x + 220; f.y = W.cloudCastle.y; f.homeX = f.x; break;
      case 'grotto': f.x = W.grotto.x; f.y = W.grotto.y - 26; f.homeX = f.x; f.homeY = f.y; break;
      case 'cave': f.x = W.cave.x + 10; f.y = W.cave.y; f.homeX = f.x; break;
      default: f.y = W.standY(f.x);
    }
  }
  get(key) { return this.byKey[key]; }
  nearest(x, y, range) {
    let best = null, bd = range;
    for (const f of this.list) { if (f.hidden || f.state === 'riding' || f.state === 'racing' || (f.state === 'following' && !Quests.bubble(f.key))) continue; const d = dist(f.x, f.y - 20, x, y); if (d < bd) { bd = d; best = f; } }
    return best;
  }

  update(dt, players, night) {
    const W = this.G.world;
    for (const f of this.list) {
      f.time += dt;
      f.talkCd = Math.max(0, f.talkCd - dt);
      f.blinkT -= dt; if (f.blinkT <= 0) { f.blinkT = rnd(2, 5); f.blink = 1; }
      f.blink = Math.max(0, f.blink - dt * 7);
      const p = players[0];
      if (f.hidden) continue;
      /* face the nearest player */
      let np = null, nd = 1e9;
      for (const q of players) { const d = Math.abs(q.x - f.x); if (d < nd) { nd = d; np = q; } }
      const facing = np && nd < 400 ? sign(np.x - f.x) : f.dir;
      switch (f.key) {
        case 'bramble':
          f.hopT -= dt;
          if (f.hopT <= 0 && f.state === 'home') { f.hopT = rnd(.8, 3); f.hopping = .5; f.hopDir = f.x > f.homeX + 120 ? -1 : f.x < f.homeX - 120 ? 1 : (chance(.5) ? 1 : -1); }
          if (f.hopping > 0) { f.hopping -= dt; f.hop = Math.sin((1 - f.hopping / .5) * Math.PI); f.x += f.hopDir * 90 * dt; f.dir = f.hopDir; if (f.hopping <= 0) f.hop = 0; }
          else f.dir = facing;
          f.y = W.standY(f.x);
          break;
        case 'hazel': f.dir = facing; break;
        case 'hoot': f.tilt = Math.sin(f.time * .8) * .12; f.dir = facing; break;
        case 'fern': f.graze = np && nd < 260 ? approach(f.graze, 0, dt * 2) : (.5 + .5 * Math.sin(f.time * .6)); f.dir = facing; break;
        case 'lily': f.hopT -= dt; if (f.hopT <= 0) { f.hopT = rnd(2, 5); f.hopping = .4; } if (f.hopping > 0) { f.hopping -= dt; f.hop = Math.sin((1 - f.hopping / .4) * Math.PI); } else f.hop = 0; f.throat = night > .5 ? .5 + .5 * Math.sin(f.time * 6) : 0; f.dir = facing; break;
        case 'pearl': f.x += f.dir * 18 * dt; if (f.x > f.homeX + 260) f.dir = -1; if (f.x < f.homeX - 260) f.dir = 1; break;
        case 'cloudia': f.dir = facing; break;
        case 'puff': this.updateLamb(f, dt, players); break;
        case 'ember': this.updateEmber(f, dt, players, np); break;
        case 'marina': f.y = f.homeY + Math.sin(f.time * 1.3) * 10; f.x = f.homeX + Math.sin(f.time * .4) * 40; f.dir = facing; break;
      }
    }
  }

  /* Puff: waiting in the meadow → riding on a player's back → home on the cloud castle */
  updateLamb(f, dt, players) {
    const W = this.G.world;
    if (f.state === 'waiting') {
      f.y = W.standY(f.x);
      f.hopT -= dt; if (f.hopT <= 0) { f.hopT = rnd(1.5, 3); f.hopping = .4; if (chance(.6)) { AudioFX.baa(true); this.G.particles.note(f.x, f.y - 40, '#fff'); } }
      if (f.hopping > 0) { f.hopping -= dt; f.hop = Math.sin((1 - f.hopping / .4) * Math.PI); } else f.hop = 0;
      for (const p of players) if (dist(p.x, p.y, f.x, f.y - 14) < 60) { f.state = 'riding'; f.rider = p; p.passenger = 'puff'; Bus.emit('lambFound', p); AudioFX.baa(true); this.G.particles.hearts(f.x, f.y - 30, 6); }
    } else if (f.state === 'riding') {
      const p = f.rider; f.x = p.x; f.y = p.y; f.dir = p.dir;
    } else if (f.state === 'home') {
      f.y = W.cloudCastle.y; f.dir = -1;
      f.hopT -= dt; if (f.hopT <= 0) { f.hopT = rnd(2, 5); f.hopping = .4; } if (f.hopping > 0) { f.hopping -= dt; f.hop = Math.sin((1 - f.hopping / .4) * Math.PI); } else f.hop = 0;
    }
  }
  spawnLamb() { const f = this.byKey.puff; f.hidden = false; f.state = 'waiting'; f.x = FRIENDS.puff.x; f.y = this.G.world.standY(f.x); }
  lambHome() { const f = this.byKey.puff; if (f.rider) f.rider.passenger = null; f.rider = null; f.state = 'home'; f.hidden = false; f.x = this.G.world.cloudCastle.x + 150; f.y = this.G.world.cloudCastle.y; }

  /* Ember: in the cave, or flying along behind a player like a puppy */
  updateEmber(f, dt, players, np) {
    const W = this.G.world;
    f.hiccupT -= dt; if (f.hiccupT <= 0) { f.hiccupT = rnd(4, 9); f.hiccup = 1; if (f.state === 'cave' && np && Math.abs(np.x - f.x) < 500) AudioFX.hiccup(); }
    f.hiccup = Math.max(0, f.hiccup - dt * 1.6);
    if (f.state === 'racing') { f.flap += dt * 16; f.fly = 1; return; }
    if (f.state === 'following') {
      const p = f.leader || players[0];
      const tx = p.x - p.dir * 70, ty = p.y - 30 + Math.sin(f.time * 3) * 8;
      const k = 1 - Math.exp(-dt * 2.6);
      f.x += (tx - f.x) * k; f.y += (ty - f.y) * k;
      f.dir = Math.abs(p.x - f.x) > 8 ? sign(p.x - f.x) : p.dir;
      f.flap += dt * 14; f.fly = 1;
      if (chance(dt * 1.5)) this.G.particles.spawn({ type: 'puff', x: f.x - f.dir * 20, y: f.y - 30, vx: -f.dir * 10, vy: -20, g: -10, r: 3, col: 'rgba(255,200,150,.5)', life: .8, drag: 2 });
    } else {
      f.y = W.cave.y; f.dir = np ? sign(np.x - f.x) : -1; f.fly = 0; f.flap += dt * 3;
    }
  }
  emberFollow(p) { const f = this.byKey.ember; f.state = 'following'; f.leader = p; f.fly = 1; }
  gatherForParty() {
    const W = this.G.world;
    const spots = { hazel: -230, fern: -320, lily: 180, pearl: 260, cloudia: 330, hoot: -400, puff: 380 };
    for (const f of this.list) {
      if (f.key === 'bramble' || f.key === 'ember' || f.key === 'marina') continue;
      f.party = true; f.hidden = false; f.state = 'party'; f.x = spots[f.key] || 0; f.y = W.standY(f.x); f.dir = sign(-f.x);
      if (f.key === 'hoot') f.y -= 0;
    }
  }
  serialize() { return { puff: { state: this.byKey.puff.state, hidden: this.byKey.puff.hidden, x: this.byKey.puff.x }, ember: this.byKey.ember.state, party: !!this.byKey.hazel.party }; }
  restore(o, players) {
    if (!o) return;
    const puff = this.byKey.puff;
    if (o.puff) { puff.hidden = o.puff.hidden; puff.state = o.puff.state === 'riding' ? 'waiting' : o.puff.state; if (puff.state === 'waiting') { puff.x = FRIENDS.puff.x; puff.y = this.G.world.standY(puff.x); } if (puff.state === 'home') this.lambHome(); }
    if (o.ember === 'following') this.emberFollow(players[0]);
    if (o.party) this.gatherForParty();
  }
}

/* ---------- butterflies: flutter near the flowers, giggle when touched ---------- */
class Butterflies {
  constructor(G) {
    this.G = G; this.list = [];
    const W = G.world;
    const cols = [['#ff9ad4', '#ffd23f'], ['#8fd0ff', '#ffffff'], ['#ffb347', '#ff6b6b'], ['#c9a5ff', '#7fe0ff'], ['#ffffff', '#ffd6e8'], ['#7fdc6a', '#ffe98a']];
    for (let i = 0; i < 34; i++) {
      const x = i < 22 ? rnd(-2100, 2100) : i < 28 ? rnd(-6800, -2400) : rnd(2200, 6800);
      const [c1, c2] = pick(cols);
      this.list.push({ x, y: W.standY(x) - rnd(30, 140), homeX: x, vx: 0, vy: 0, flap: rnd(TAU), col: c1, col2: c2, s: rnd(.8, 1.2), t: rnd(TAU), cd: 0, flee: 0 });
    }
  }
  update(dt, players, night) {
    const W = this.G.world;
    this.hide = W.snow > .5;
    if (this.hide) return;
    for (const b of this.list) {
      b.t += dt; b.flap += dt * (12 + b.flee * 10); b.cd = Math.max(0, b.cd - dt); b.flee = Math.max(0, b.flee - dt);
      const g = W.standY(b.x);
      const tx = b.homeX + Math.sin(b.t * .4) * 120, ty = g - 60 - Math.sin(b.t * .7) * 40 - (night > .5 ? -30 : 0) - b.flee * 120;
      b.vx += (tx - b.x) * .6 * dt + Math.sin(b.t * 3) * 30 * dt;
      b.vy += (ty - b.y) * .8 * dt + Math.cos(b.t * 2.7) * 30 * dt;
      b.vx *= 1 - dt * .8; b.vy *= 1 - dt * .8;
      b.x += b.vx * dt; b.y += b.vy * dt;
      for (const p of players) if (b.cd <= 0 && dist(p.x, p.y, b.x, b.y) < 34) { b.cd = 6; b.flee = 1.5; b.vy -= 80; Bus.emit('butterfly', p, b); this.G.particles.hearts(b.x, b.y, 3, b.col); AudioFX.giggle(); }
    }
  }
}

/* ---------- birds: little flocks crossing the sky ---------- */
class Birds {
  constructor(G) {
    this.G = G; this.flocks = [];
    for (let i = 0; i < 4; i++) this.flocks.push({ x: rnd(-6000, 6000), y: rnd(-1300, -500), dir: chance(.5) ? 1 : -1, sp: rnd(40, 70), n: rndInt(3, 6), col: pick(['#5ab0ff', '#ff8fb8', '#ffd23f', '#ffffff']), t: rnd(TAU) });
  }
  update(dt) {
    for (const f of this.flocks) {
      f.t += dt; f.x += f.dir * f.sp * dt; f.y += Math.sin(f.t * .5) * 8 * dt;
      if (f.x > 7400) { f.x = -7400; } if (f.x < -7400) { f.x = 7400; }
    }
  }
}

/* ---------- storm clouds: grumpy, windy, and easily cheered up ---------- */
class StormClouds {
  constructor(G) { this.G = G; this.list = G.world.stormClouds; this.timer = 70; this.enabled = true; }
  update(dt, players) {
    if (this.enabled) { this.timer -= dt; if (this.timer <= 0 && this.list.filter(s => !s.happy).length < 2) { this.timer = rnd(70, 130); this.spawn(players[0]); } }
    const W = this.G.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.t += dt; s.x += s.vx * dt; s.y += Math.sin(s.t * .6) * 6 * dt;
      if (s.happy) { s.happy = Math.min(1, s.happy + dt * .8); s.life -= dt; s.vx *= 1 - dt * .3; if (s.life <= 0) { this.list.splice(i, 1); continue; } }
      else {
        if (s.x < -7200 || s.x > 7200) s.vx = -s.vx;
        for (const p of players) {
          const d = dist(p.x, p.y, s.x, s.y);
          if (d < s.r + 240 && p.state !== 'talking') { const k = (1 - d / (s.r + 240)); p.vx += sign(p.x - s.x) * 260 * k * dt; p.vy += 40 * k * dt; if (!s.warned && d < s.r + 200) { s.warned = true; Bus.emit('stormNear', p, s); } }
        }
        if (chance(dt * 2)) this.G.particles.spawn({ type: 'drop', x: s.x + rnd(-s.r, s.r) * .8, y: s.y + s.r * .5, vx: 0, vy: 120, g: 200, r: 2, col: 'rgba(160,190,255,.7)', life: .6 });
      }
    }
  }
  spawn(p) {
    const W = this.G.world;
    const x = clamp((p ? p.x : 0) + pick([-1, 1]) * rnd(700, 1400), -6800, 6800);
    this.list.push({ x, y: rnd(-1300, -450), r: rnd(70, 95), vx: pick([-1, 1]) * rnd(12, 26), t: rnd(TAU), happy: 0, life: 22, warned: false });
  }
  cheer(s) { s.happy = 1e-6; }
}

/* ---------- fish leaping from the lake, just for fun ---------- */
class Fish {
  constructor(G) {
    this.G = G; this.list = []; this.timer = 4;
    /* schools that live under the water */
    this.schools = [];
    const cols = ['#ff9a4d', '#7fd0ff', '#ffd23f', '#c9a5ff', '#ff8fb8'];
    for (let i = 0; i < 6; i++) { const x = rnd(2900, 4300), n = rndInt(4, 7); this.schools.push({ x, y: rnd(120, 420), vx: pick([-1, 1]) * rnd(30, 60), t: rnd(TAU), col: cols[i % cols.length], fish: Array.from({ length: n }, () => ({ dx: rnd(-50, 50), dy: rnd(-24, 24), ph: rnd(TAU) })) }); }
  }
  update(dt) {
    const W = this.G.world;
    for (const s of this.schools) {
      s.t += dt; s.x += s.vx * dt; s.y += Math.sin(s.t * .6) * 12 * dt;
      const bed = W.groundY(s.x);
      if (s.x < 2750 || s.x > 4450 || bed < LAKE.y + 120) { s.vx = -s.vx; s.x += s.vx * dt * 2; }
      s.y = clamp(s.y, LAKE.y + 60, bed - 50);
      for (const p of this.G.players) if (p.state === 'swim' && dist(p.x, p.y, s.x, s.y) < 140) { s.vx = sign(s.x - p.x) * 120; }
      s.vx = approach(s.vx, sign(s.vx) * 45, dt * 20);
    }
    if (W.frozen) return;
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = rnd(3, 9); const x = rnd(LAKE.x0 + 150, LAKE.x1 - 150); this.list.push({ x, y: LAKE.y, vx: rnd(-60, 60), vy: -rnd(180, 260), t: 0, col: pick(['#ff9a4d', '#7fd0ff', '#ffd23f', '#c9a5ff']) }); this.G.particles.splash(x, LAKE.y, 8, .7); }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i]; f.t += dt; f.vy += 520 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.y > LAKE.y + 4) { this.G.particles.splash(f.x, LAKE.y, 8, .8); this.list.splice(i, 1); }
    }
  }
}
