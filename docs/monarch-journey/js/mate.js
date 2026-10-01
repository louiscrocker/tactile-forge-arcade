/* ============================================================
   mate.js — the other monarch on a summer milkweed
   ============================================================
   In a summer generation there is another monarch about: a
   female if you are male (find her and press SPACE close by), a
   male if you are female (he finds you; you lay the eggs).  She
   flutters round the plant, lands on the umbel now and then, and
   drifts toward you once you are ready.
   ============================================================ */
'use strict';

class Mate {
  constructor(G, variantKey) {
    this.G = G;
    this.variant = VARIANTS[variantKey] || VARIANTS.female;
    const b = G.plant.bounds;
    this.x = b.right - 200; this.y = -600;
    this.vx = -40; this.vy = 0; this.ang = Math.PI; this.wingPhase = rnd(TAU);
    this.state = 'fly';          // fly | sit
    this.timer = rnd(4, 8);
    this.flap = 1; this.open = 1;
    this.target = null;
  }
  update(dt, p) {
    const b = this.G.plant.bounds;
    this.timer -= dt;
    this.wingPhase += dt * (this.state === 'fly' ? 22 : 2);
    if (this.state === 'fly') {
      this.flap = .5 + .5 * Math.abs(Math.cos(this.wingPhase * .5));
      /* wander, or drift toward the player when they are ready */
      const seek = p && p.readyFlag && p.summer && p.stage === 7;
      const tx = seek ? p.x + Math.cos(this.G.time * .9) * 90 : (this.target ? this.target[0] : this.x);
      const ty = seek ? p.y - 30 + Math.sin(this.G.time * 1.3) * 60 : (this.target ? this.target[1] : this.y);
      if (!this.target || this.timer <= 0 || dist(this.x, this.y, tx, ty) < 40) { this.target = [rnd(b.left + 100, b.right - 100), rnd(b.top + 100, -120)]; this.timer = rnd(3, 7); if (!seek && chance(.3)) { this.state = 'sit'; this.timer = rnd(2, 5); const f = this.G.plant.flowers[0]; if (f) { this.x = f.x; this.y = f.y - f.size * .5; } } }
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
      this.vx = lerp(this.vx, dx / d * 110, dt * 1.5) + Math.sin(this.G.time * 5) * 20 * dt;
      this.vy = lerp(this.vy, dy / d * 110, dt * 1.5) + Math.cos(this.G.time * 4) * 30 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.x = clamp(this.x, b.left + 40, b.right - 40); this.y = clamp(this.y, b.top - 100, -60);
      this.ang = angleLerp(this.ang, Math.atan2(this.vy * .4, this.vx), 1 - Math.exp(-dt * 4));
      this.open = 1;
    } else {
      this.open = .15 + .15 * Math.sin(this.wingPhase);
      if (this.timer <= 0) { this.state = 'fly'; this.timer = rnd(4, 8); this.vy = -60; }
    }
    if (p) p.mateNear = p.summer && p.readyFlag && p.stage === 7 && dist(this.x, this.y, p.x, p.y) < 70;
  }
  draw(ctx, time) {
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.state === 'fly') { ctx.rotate(this.ang); Sprites.drawMonarch(ctx, { s: .9, variant: this.variant, open: 1, flap: this.flap }); }
    else { ctx.rotate(-.3); Sprites.drawMonarch(ctx, { s: .9, variant: this.variant, open: this.open }); }
    ctx.restore();
  }
}
