/* ============================================================
   foal.js — your baby alicorn, and her stable
   ============================================================
   The foal starts lost and shy in the Whispering Woods.  Gentle
   horn magic near her builds trust; then she follows you home
   to the stable.  After that she needs three things — apples
   (full), brushing (shiny) and play (fun) — and every bit of
   care makes her grow: baby → young (she can flutter after you)
   → grown (she flies anywhere with you).  Nothing bad ever
   happens if you forget her: she just waits at the stable and
   shows a little thought bubble of what she'd like.
   ============================================================ */
'use strict';

const FOAL_GROW = [0, 12, 30];                 // care points to become young, then grown
const FOAL_LOST = { x: -5900 };

class Foal {
  constructor(G) {
    this.G = G;
    this.adopted = false;
    this.state = 'hidden';                       // hidden | lost | follow | home
    this.name = 'Moonbeam';
    this.look = Object.assign(JSON.parse(JSON.stringify(DEFAULT_LOOK)), { name: 'Moonbeam', body: 'mint', mane: ['gold', 'orange'], horn: 'pearl', eyes: 'violet', mark: 'star' });
    this.care = 0; this.stage = 0; this.babyK = 1;
    this.full = .8; this.shiny = .8; this.fun = .8;
    this.trust = 0;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.dir = 1;
    this.walk = 0; this.fly = 0; this.flap = 0; this.blink = 0; this.blinkT = 3; this.time = 0;
    this.hop = 0; this.hopT = 2; this.happyT = 0; this.playT = 0; this.sleep = false; this.mouth = 0;
    this.leader = null;
    this.hugCd = 0;
    this.stats = { fed: 0, brushed: 0, played: 0, hugs: 0 };
  }
  get W() { return this.G.world; }
  get size() { return lerp(.95, .58, this.babyK); }
  get feet() { return Sprites.feetY(this.babyK) * this.size; }
  canFly() { return this.stage >= 1; }
  need() {                                       /* what she'd like most right now, or null */
    const m = Math.min(this.full, this.shiny, this.fun);
    if (m > .35) return null;
    return m === this.full ? 'apple' : m === this.shiny ? 'brush' : 'play';
  }
  mood() { return (this.full + this.shiny + this.fun) / 3; }

  /* the quest: appear, shy, in the woods */
  appearLost() { this.state = 'lost'; this.x = FOAL_LOST.x; this.y = this.W.standY(this.x); this.trust = 0; this.dir = -1; }
  befriend(p) {
    this.trust++;
    this.G.particles.hearts(this.x, this.y - 50, 4);
    AudioFX.foalNicker && AudioFX.foalNicker(this.babyK);
    if (this.trust >= 3) { this.state = 'follow'; this.leader = p; Bus.emit('foalFound', p, this); }
    else Bus.emit('foalTrust', p, this, this.trust);
  }
  adopt(name, look) {
    this.adopted = true; this.name = name || this.name;
    if (look) this.look = look;
    this.look.name = this.name;
    this.state = 'follow';
    Bus.emit('foalAdopted', this);
  }
  goHome(announce) {
    const st = this.W.stable;
    if (announce) this.G.particles.sparkle(this.x, this.y - 30, 16, '#fff6c8', 30);
    this.state = 'home'; this.x = st.x + 60; this.y = this.W.standY(this.x); this.fly = 0; this.vy = 0;
    if (announce) Bus.emit('foalHome', this);
  }
  follow(p) { this.state = 'follow'; this.leader = p; this.G.particles.hearts(this.x, this.y - 40, 3); }

  /* ---------- care ---------- */
  feed() {
    if (this.G.apples <= 0) return false;
    this.G.apples--; this.full = 1; this.addCare(2); this.stats.fed++;
    this.happyT = 1.5; this.mouth = 1;
    this.G.particles.hearts(this.x, this.y - 50, 6);
    AudioFX.munch && AudioFX.munch();
    Bus.emit('foalFed', this);
    return true;
  }
  brushed() { this.shiny = 1; this.addCare(1.5); this.stats.brushed++; this.happyT = 1.5; this.G.particles.sparkle(this.x, this.y - 40, 30, '#fff', 40); Bus.emit('foalBrushed', this); }
  play() { this.fun = 1; this.addCare(1.5); this.stats.played++; this.playT = 5; this.happyT = 5; Bus.emit('foalPlayed', this); }
  hug() { if (this.hugCd > 0) { this.G.particles.hearts(this.x, this.y - 50, 3); return; } this.hugCd = 60; this.addCare(.5); this.stats.hugs++; this.happyT = 2; this.G.particles.hearts(this.x, this.y - 50, 10); Bus.emit('foalHug', this); }
  addCare(n) {
    this.care += n;
    if (this.stage < 2 && this.care >= FOAL_GROW[this.stage + 1]) { this.stage++; Bus.emit('foalGrew', this, this.stage); }
  }

  /* ---------- per frame ---------- */
  update(dt, players) {
    this.time += dt;
    if (this.state === 'hidden') return;
    const W = this.W, P = this.G.particles;
    this.babyK = approach(this.babyK, this.stage === 0 ? 1 : this.stage === 1 ? .5 : 0, dt * .35);
    this.blinkT -= dt; if (this.blinkT <= 0) { this.blinkT = rnd(2, 5); this.blink = 1; }
    this.blink = Math.max(0, this.blink - dt * 7);
    this.mouth = Math.max(0, this.mouth - dt * 2);
    this.happyT = Math.max(0, this.happyT - dt); this.hugCd = Math.max(0, this.hugCd - dt);
    if (this.adopted) { this.full = Math.max(.05, this.full - dt / 700); this.shiny = Math.max(.05, this.shiny - dt / 900); this.fun = Math.max(.05, this.fun - dt / 600); }
    const night = this.G.night;

    if (this.state === 'lost') {
      /* shy: hops about near her spot, peeks at you */
      this.hopT -= dt;
      if (this.hopT <= 0) { this.hopT = rnd(1.5, 3.5); this.vx = rnd(-60, 60); }
      const p = players[0];
      if (p && Math.abs(p.x - this.x) < 160 && Math.abs(p.vx) > 250) this.vx = sign(this.x - p.x) * 140;   /* a gallop startles her */
      this.x += this.vx * dt; this.vx *= 1 - dt * 2;
      this.x = clamp(this.x, FOAL_LOST.x - 220, FOAL_LOST.x + 220);
      this.walk += Math.abs(this.vx) * dt * .09;
      this.y = W.standY(this.x); this.fly = 0;
      if (p) this.dir = sign(p.x - this.x) || 1;
      return;
    }
    if (this.state === 'home') {
      const st = W.stable;
      this.sleep = night > .6;
      if (!this.sleep) {
        this.hopT -= dt;
        if (this.hopT <= 0) { this.hopT = rnd(2, 5); this.vx = rnd(-70, 70); }
        this.x += this.vx * dt; this.vx *= 1 - dt * 1.5;
        this.x = clamp(this.x, st.x - 230, st.x + 230);
        this.walk += Math.abs(this.vx) * dt * .09;
        if (Math.abs(this.vx) > 5) this.dir = sign(this.vx);
      } else { this.x = approach(this.x, st.x, dt * 80); this.vx = 0; }
      this.y = W.standY(this.x); this.fly = approach(this.fly, 0, dt * 3);
      if (this.playT > 0) this.playing(dt);
      return;
    }
    /* follow */
    const p = this.leader && players.includes(this.leader) ? this.leader : players[0];
    if (!p) return;
    this.sleep = false;
    const ground = W.standY(p.x);
    const high = ground - p.y;
    /* a baby can't follow into the sky or under the water: she trots home */
    if (!this.canFly() && (p.state === 'swim' || (p.state === 'air' && high > 260) || Math.abs(p.x - this.x) > 1400)) {
      this.waitT = (this.waitT || 0) + dt;
      if (this.waitT > 2.5) { this.waitT = 0; this.goHome(true); }
    } else this.waitT = 0;
    if (this.playT > 0) { this.playing(dt); return; }
    const tx = p.x - p.dir * 95, ty = p.state === 'swim' ? LAKE.y : p.y;
    const dx = tx - this.x;
    const air = this.canFly() && (p.state === 'air' || this.y < W.standY(this.x) - 12);
    if (air) {
      const dy = (ty - 30 - (this.stage === 1 ? 0 : 0)) - this.y;
      const cap = this.stage === 1 ? 480 : 1e9;                   /* young foals flutter low */
      const k = 1 - Math.exp(-dt * 2.2);
      this.x += dx * k; this.y += dy * k;
      if (W.standY(this.x) - this.y > cap) this.y = W.standY(this.x) - cap;
      this.fly = approach(this.fly, 1, dt * 4); this.flap += dt * 14;
      const g = W.surfaceBelow(this.x, this.y, 6);
      if (p.state !== 'air' && g && this.y >= g.y - 4) { this.y = g.y; this.fly = 0; }
      if (Math.abs(dx) > 8) this.dir = sign(dx);
    } else {
      const speed = Math.abs(dx) > 150 ? 400 : 230;
      this.vx = Math.abs(dx) > 30 ? sign(dx) * Math.min(speed, Math.abs(dx) * 2.5) : this.vx * (1 - dt * 6);
      this.x += this.vx * dt;
      const s = W.surfaceBelow(this.x, this.y - 20, 40) || W.surfacesAt(this.x)[0];
      this.y = W.surfaceY(s, this.x); if (!Number.isFinite(this.y)) this.y = W.standY(this.x);
      this.fly = approach(this.fly, 0, dt * 4);
      this.walk += Math.abs(this.vx) * dt * .085;
      if (Math.abs(this.vx) > 10) this.dir = sign(this.vx); else this.dir = sign(p.x - this.x) || this.dir;
      this.hopT -= dt;
      if (Math.abs(this.vx) < 10 && this.hopT <= 0 && this.happyT > 0) { this.hopT = .6; this.hop = 1; }
    }
    this.hop = Math.max(0, this.hop - dt * 2.5);
  }
  /* play: skip in circles, giggling */
  playing(dt) {
    this.playT -= dt;
    const c = this.state === 'home' ? this.W.stable.x + 40 : (this.leader || this.G.player).x;
    const a = this.time * 2.4;
    const tx = c + Math.cos(a) * 110;
    this.dir = -Math.sin(a) > 0 ? 1 : -1;
    this.x += (tx - this.x) * (1 - Math.exp(-dt * 5));
    this.y = this.W.standY(this.x) - Math.abs(Math.sin(this.time * 7)) * 22;
    this.walk += dt * 7;
    if (chance(dt * 3)) this.G.particles.hearts(this.x, this.y - 40, 1);
    if (chance(dt * 1.2)) this.G.particles.note(this.x, this.y - 50, '#ff9ad4');
  }

  near(p, r = 140) { return this.state !== 'hidden' && dist(p.x, p.y - 20, this.x, this.y - 20) < r; }

  draw(ctx, time) {
    if (this.state === 'hidden') return;
    const s = this.size;
    ctx.save();
    ctx.translate(this.x, this.y - this.feet - this.hop * 10);
    if (this.dir < 0) ctx.scale(-1, 1);
    Sprites.drawAlicorn(ctx, { s, look: this.look, baby: this.babyK, walk: this.walk, fly: this.fly, flap: this.flap, open: this.fly, blink: this.sleep ? 1 : this.blink, sleep: this.sleep, sit: this.sleep ? 1 : 0, mouth: this.mouth, time });
    ctx.restore();
    if (this.sleep && chance(.02)) this.G.particles.zz(this.x + this.dir * 30, this.y - 50);
    /* thought bubble for what she'd like */
    const n = this.adopted && !this.sleep ? this.need() : null;
    if (n) {
      const bx = this.x + this.dir * 26, by = this.y - 95 * s - 10 + Math.sin(time * 3) * 3;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(bx, by, 17, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(bx - this.dir * 12, by + 19, 4.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(bx - this.dir * 18, by + 27, 2.5, 0, TAU); ctx.fill();
      ctx.drawImage(Sprites.icon(n === 'apple' ? 'apple' : n === 'brush' ? 'salon' : 'heart', null, 24), bx - 12, by - 12, 24, 24);
      ctx.restore();
    }
    if (this.state === 'lost') {
      /* little sparkles hint at where she is */
      if (chance(.05)) this.G.particles.sparkle(this.x + rnd(-40, 40), this.y - rnd(20, 70), 1, '#fff6c8', 4);
    }
  }

  serialize() {
    return { adopted: this.adopted, state: this.state, name: this.name, look: this.look, care: this.care, stage: this.stage, full: this.full, shiny: this.shiny, fun: this.fun, trust: this.trust, x: this.x, stats: this.stats };
  }
  restore(o, players) {
    if (!o) return;
    Object.assign(this, { adopted: !!o.adopted, name: o.name || this.name, care: o.care || 0, stage: o.stage || 0, full: o.full ?? .8, shiny: o.shiny ?? .8, fun: o.fun ?? .8, trust: o.trust || 0 });
    if (o.look) this.look = o.look;
    if (o.stats) this.stats = Object.assign(this.stats, o.stats);
    this.babyK = this.stage === 0 ? 1 : this.stage === 1 ? .5 : 0;
    if (o.state === 'lost') this.appearLost();
    else if (o.state === 'follow' || o.state === 'home') { this.goHome(false); if (o.state === 'follow') { this.state = 'follow'; this.leader = players[0]; this.x = players[0].x - 90; this.y = this.W.standY(this.x); } }
  }
}

/* the stable's paint, roof and decorations */
class Home {
  constructor() { this.paint = 'pink'; this.roof = 'lilac'; this.items = []; }
  serialize() { return { paint: this.paint, roof: this.roof, items: this.items.slice() }; }
  restore(o) { if (o) { this.paint = o.paint || this.paint; this.roof = o.roof || this.roof; this.items = (o.items || []).slice(); } }
}
