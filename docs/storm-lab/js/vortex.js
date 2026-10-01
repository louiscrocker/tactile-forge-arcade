/* ============================================================
   vortex.js — the wind field
   ============================================================
   A Rankine combined vortex, plus the two things that make a
   tornado a tornado rather than a bathtub drain:

     · a frictional inflow layer near the ground, which is what
       actually drags objects toward the funnel, and
     · an updraft peaking at the funnel wall, which is what turns
       a sliding cow into a flying cow.

   windAt() is the single source of truth. Debris motion, damage
   assessment, dust advection and the wind arrows all read it.
   ============================================================ */
'use strict';

const EF_MIN_MS = [29.1, 38.4, 49.6, 60.8, 74.2, 89.4];   // EF0..EF5 lower bounds, m/s
const EF_LABEL = ['EF0', 'EF1', 'EF2', 'EF3', 'EF4', 'EF5'];
const STAGE_NAME = ['Developing', 'Organising', 'Mature', 'Shrinking', 'Rope-out', 'Dissipating'];

function efFromWind(ms) {
  let e = 0;
  for (let i = 5; i >= 0; i--) if (ms >= EF_MIN_MS[i]) { e = i; break; }
  return e;
}

class Tornado {
  constructor() {
    this.x = -430; this.z = -400;
    this.vmax = 49;             // peak tangential wind, m/s
    this.coreR = 55;            // funnel radius at the ground, m
    this.cloudBase = 1000;   // realistic; a real base is 1-1.5 km
    this.fwdSpeed = 14;
    this.heading = 45 * DEG;    // 0 = north, clockwise on the compass
    this.spin = 1;              // +1 cyclonic (counter-clockwise from above)
    this.subCount = 0;
    this.subs = [];

    this.life = 0.5;            // 0 forming -> 1 gone
    this.autoLife = false;
    this.lifeRate = 0.011;          // a full birth-to-rope-out in ~90 s

    this.t = 0;
    this.vx = 0; this.vz = 0;   // resolved translation velocity
    this.steer = null;          // {x,z} target the user clicked

    this.wobble = makeNoise1D(9137);
    this.tilt = makeNoise1D(4421);
    this.tiltB = makeNoise1D(8802);

    this.trail = [];            // damage-path centreline
    this.pathLen = 0;
    this.maxWidth = 0;

    this.rebuildSubs();
  }

  rebuildSubs() {
    this.subs.length = 0;
    for (let i = 0; i < this.subCount; i++) {
      this.subs.push({
        phase: (i / Math.max(1, this.subCount)) * TAU,
        orbit: rnd(0.42, 0.74),
        rate: rnd(0.9, 1.4),
        size: rnd(0.12, 0.22),
        strength: rnd(0.5, 0.85)
      });
    }
  }

  /* ---- derived quantities ------------------------------------------- */

  /*
     lifeScale, radius and the flare coefficient are pure functions of
     three inputs, and windAt needs all of them. Recomputing them per call
     meant the life envelope was evaluated twice for every dust particle,
     every step. Cached behind a three-comparison validity check, so it is
     always correct even if a slider moves mid-frame.
  */
  _sync() {
    if (this._sL === this.life && this._sC === this.coreR && this._sB === this.cloudBase) return;
    this._sL = this.life; this._sC = this.coreR; this._sB = this.cloudBase;

    const L = this.life;
    let ls;
    if (L < 0.14) ls = smoothstep(0, 0.14, L) * 0.55;           // dust whirl
    else if (L < 0.3) ls = lerp(0.55, 1, smoothstep(0.14, 0.3, L));
    else if (L < 0.62) ls = 1;                                   // mature
    else if (L < 0.86) ls = lerp(1, 0.4, smoothstep(0.62, 0.86, L));
    else ls = lerp(0.4, 0, smoothstep(0.86, 1, L));              // rope-out

    this._ls = ls;
    this._R = Math.max(4, this.coreR * (0.34 + 0.66 * ls));
    this._flare = 1.05 * clamp(55 / this._R, 0.28, 1.5);
    this._invBase = 1 / this.cloudBase;
  }

  /* Envelope that scales the whole vortex over its life. */
  get lifeScale() { this._sync(); return this._ls; }

  /* How far the visible condensation funnel reaches down from cloud base. */
  get reach() {
    const L = this.life;
    if (L < 0.1) return 0.22;
    if (L < 0.3) return lerp(0.22, 1, smoothstep(0.1, 0.3, L));
    if (L < 0.78) return 1;
    return lerp(1, 0.34, smoothstep(0.78, 1, L));
  }

  get stageIndex() {
    const L = this.life;
    if (L < 0.14) return 0;
    if (L < 0.3) return 1;
    if (L < 0.62) return 2;
    if (L < 0.78) return 3;
    if (L < 0.93) return 4;
    return 5;
  }

  get stageName() { return STAGE_NAME[this.stageIndex]; }

  /* Rotational peak — the number the user dials in. */
  get peakWind() { return this.vmax * this.lifeScale; }

  /*
     The wind a building actually feels. Rotation is only part of it:
     the frictional inflow adds a radial component, and the storm's own
     forward motion adds to the rotation on one flank and subtracts on
     the other. That asymmetry is why damage along a track is one-sided,
     so it is what the HUD and the survey should report.
  */
  get groundPeak() {
    const y = 2, r = this.radiusAt(y);
    let best = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      this.windAt(this.x + Math.cos(a) * r, y, this.z + Math.sin(a) * r, _w);
      const s = Math.hypot(_w.x, _w.z);
      if (s > best) best = s;
    }
    return best;
  }

  get ef() { return efFromWind(this.groundPeak); }

  /*
     Inverse of groundPeak: what rotation speed produces a given
     ground-relative peak? Solved by bisection because the field couples
     rotation, inflow and forward motion in a way that isn't worth
     inverting analytically. Lets the EF buttons land on the rating they
     promise instead of one band high.
  */
  rotationForPeak(targetMs) {
    const saved = this.vmax;
    let lo = 1, hi = 260;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) * 0.5;
      this.vmax = mid;
      if (this.groundPeak < targetMs) lo = mid; else hi = mid;
    }
    const r = (lo + hi) * 0.5;
    this.vmax = saved;
    return r;
  }

  /* Ground-level core radius, thinned during rope-out. */
  get radius() { this._sync(); return this._R; }

  /* Funnel radius at height h — narrow at the ground, flaring into the wall
     cloud. The flare is kept modest, and scaled inversely with width in
     _sync: a big exponent here makes the funnel read as a trumpet, and a
     wide wedge barely flares at all in reality.

     t^2.5 is built as t*t*sqrt(t) because this is called for every dust
     particle every step, and a fractional Math.pow costs several times
     a sqrt. */
  radiusAt(h) {
    this._sync();
    let t = h * this._invBase;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return this._R * (1 + this._flare * t * t * Math.sqrt(t));
  }

  /* Lateral snake of the funnel with height (the "rope" lean).
     Writes into a shared scratch object — this runs a couple of thousand
     times a frame and must not allocate. */
  tiltAt(h) {
    const t = clamp(h / this.cloudBase, 0, 1);
    const amp = this.cloudBase * (0.05 + 0.34 * (1 - this.lifeScale)) * t * t;
    _tilt.x = (this.tilt(h * 0.014 + this.t * 0.21) - 0.5) * 2 * amp;
    _tilt.z = (this.tiltB(h * 0.014 + this.t * 0.19) - 0.5) * 2 * amp;
    return _tilt;
  }

  /* Centre of the circulation at height h, including wobble and lean. */
  centreAt(h, out) {
    const tl = this.tiltAt(h);
    const wob = (this.wobble(this.t * 0.55) - 0.5) * this.radius * 0.4 * this.lifeScale;
    const wob2 = (this.wobble(this.t * 0.55 + 60) - 0.5) * this.radius * 0.4 * this.lifeScale;
    out.x = this.x + tl.x + wob;
    out.z = this.z + tl.z + wob2;
    return out;
  }

  /* ---- the wind field ------------------------------------------------ */

  /*
     Tangential speed follows the Rankine profile: solid-body rotation
     inside the core (still air at the exact centre, peak at the wall),
     then a free-vortex decay outside. The decay exponent is softened
     from the textbook 1.0 so the inflow reaches usefully far out.
  */
  windAt(x, y, z, out) {
    this._sync();
    const scale = this._ls;
    if (scale <= 0.01) { out.x = out.y = out.z = 0; return out; }

    let ty = y * this._invBase;
    if (ty < 0) ty = 0; else if (ty > 1) ty = 1;
    const Rc = Math.max(3, this._R * (1 + this._flare * ty * ty * Math.sqrt(ty)));
    const dx = x - this.x, dz = z - this.z;
    // sqrt, not hypot: this runs a few thousand times per simulation step
    // and V8's hypot pays for overflow handling we do not need here.
    const r = Math.sqrt(dx * dx + dz * dz);
    const vmax = this.vmax * scale;

    let vt;
    if (r < Rc) vt = vmax * (r / Rc);
    else {
      /* Free-vortex decay with exponent 5/8, built from sqrt chains:
         q^0.625 = q^(1/2) · q^(1/8). Indistinguishable from the 0.62 this
         replaces, and far cheaper than a fractional Math.pow in a function
         called thousands of times per step. */
      const s = Math.sqrt(Rc / r);
      vt = vmax * s * Math.sqrt(Math.sqrt(s));
    }

    // Surface friction breaks cyclostrophic balance: strongest inflow at
    // ground level, fading out over the lowest ~70 m.
    // Inflow angle of roughly 20 degrees at the surface, which is the
    // range observed in mobile-radar studies of real tornadoes.
    const surf = Math.exp(y * -0.0142857);   // exp(-y/70)
    const vr = -vt * (0.38 * surf + 0.08);

    /* Updraft: a ring peaking just inside the funnel wall. It has to be
       strong right at the surface, otherwise debris converges into a pile
       at the base and never gets carried up the column — which is the one
       thing everybody knows a tornado does. */
    const ringOff = (r - Rc * 0.75) / (Rc * 1.25);
    const w = vmax * 0.62 * Math.exp(-ringOff * ringOff) * (0.55 + 0.45 * clamp(y / (this.cloudBase * 0.55), 0, 1));

    const inv = r > 1e-4 ? 1 / r : 0;
    const tx = -dz * inv, tz = dx * inv;   // tangential unit (counter-clockwise)
    const nx = dx * inv, nz = dz * inv;    // radial unit (outward)

    let ux = tx * vt * this.spin + nx * vr;
    let uz = tz * vt * this.spin + nz * vr;
    let uy = w;

    // Suction vortices: smaller, faster whirls orbiting inside the parent.
    for (let i = 0; i < this.subs.length; i++) {
      const s = this.subs[i];
      const a = s.phase + this.t * s.rate * this.spin * (vmax / 90);
      const orb = Rc * s.orbit;
      const sx = this.x + Math.cos(a) * orb, sz = this.z + Math.sin(a) * orb;
      const sr = Math.max(2, Rc * s.size);
      const ddx = x - sx, ddz = z - sz;
      const rr = Math.sqrt(ddx * ddx + ddz * ddz);
      if (rr > sr * 7) continue;
      let decay;
      if (rr < sr) decay = rr / sr;
      else {                                  // q^0.875 = q^(1/2+1/4+1/8)
        const q = Math.sqrt(sr / rr), q2 = Math.sqrt(q);
        decay = q * q2 * Math.sqrt(q2);
      }
      const sv = vmax * s.strength * decay;
      const si = rr > 1e-4 ? 1 / rr : 0;
      ux += -ddz * si * sv * this.spin;
      uz += ddx * si * sv * this.spin;
      uy += sv * 0.45 * Math.exp(-Math.pow((rr - sr) / sr, 2)) * surf;
    }

    out.x = ux + this.vx;
    out.y = uy;
    out.z = uz + this.vz;
    return out;
  }

  /* Horizontal wind magnitude — the number the damage model cares about. */
  speedAt(x, y, z) {
    this.windAt(x, y, z, _w);
    return Math.sqrt(_w.x * _w.x + _w.z * _w.z);
  }

  /* ---- integration --------------------------------------------------- */

  step(dt) {
    this.t += dt;

    if (this.autoLife) {
      this.life += this.lifeRate * dt;
      if (this.life > 1) { this.life = 0; this.reposition(); }
    }

    // Gentle steering toward a clicked point, otherwise hold the heading.
    if (this.steer) {
      const want = Math.atan2(this.steer.x - this.x, this.steer.z - this.z);
      let d = want - this.heading;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this.heading += clamp(d, -0.9 * dt, 0.9 * dt);
      if (Math.hypot(this.steer.x - this.x, this.steer.z - this.z) < 40) this.steer = null;
    }

    // Real tracks meander; a slow noise term keeps it from looking like a ruler.
    const drift = (this.wobble(this.t * 0.13 + 300) - 0.5) * 0.14;
    const h = this.heading + drift;
    this.vx = Math.sin(h) * this.fwdSpeed;
    this.vz = Math.cos(h) * this.fwdSpeed;

    const px = this.x, pz = this.z;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // Record the damage swath while the circulation is on the ground.
    if (this.lifeScale > 0.12) {
      const w = this.radius * 2.6;
      if (w > this.maxWidth) this.maxWidth = w;
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(this.x - last.x, this.z - last.z) > 9) {
        this.trail.push({ x: this.x, z: this.z, w });
        if (this.trail.length > 620) this.trail.shift();
      }
      this.pathLen += Math.hypot(this.x - px, this.z - pz);
    }
  }

  reposition() {
    // Re-enter from upwind of the town so the show can start again — close
    // enough that the wait before the first fence post flies is short, but
    // always far enough out that a wide storm is not already on top of it.
    const back = Math.max(640, this.radius * 2.4 + 420);
    this.x = -Math.sin(this.heading) * back + rnd(-260, 260);
    this.z = -Math.cos(this.heading) * back + rnd(-260, 260);
    this.trail.length = 0;
    this.pathLen = 0;
    this.maxWidth = 0;
  }

  reset() {
    this.reposition();
    this.life = this.autoLife ? 0.05 : 0.5;
    this.t = 0;
    this.steer = null;
  }
}

const _w = { x: 0, y: 0, z: 0 };
const _tilt = { x: 0, z: 0 };
