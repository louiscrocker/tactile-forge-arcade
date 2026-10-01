/* ============================================================
   world.js — the town, the damage model, the flying things
   ============================================================
   Every object in Prairie Bend owns a failure wind speed. Damage
   is accumulated as exposure (how hard, for how long) rather than
   applied instantly, so a storm that merely clips a house peels
   shingles while one that sits on it takes the walls.
   ============================================================ */
'use strict';

const GRAV = -9.81;

/* Failure thresholds in m/s.
   stages : wind needed to advance to damage stage 1,2,3,4
   loft   : wind at which a loose object is picked up outright
   drag   : how strongly the wind couples to it (1/s) — light, flat
            things have a big number, a pickup truck does not      */
const SPEC = {
  /* hp is exposure, not hit points: (wind - threshold) integrated over the
     time the object spends in that wind. Tuned so a tornado that parks on a
     house takes it apart, while one that merely clips it only peels shingles. */
  house:      { stages: [32, 43, 58, 80], hp: [16, 24, 32, 48] },
  barn:       { stages: [27, 37, 51, 68], hp: [13, 20, 27, 40] },
  shop:       { stages: [30, 41, 56, 76], hp: [15, 23, 31, 45] },
  church:     { stages: [34, 46, 62, 86], hp: [20, 30, 40, 58] },
  /* Single-stage structures: thresholds are indexed by the *current*
     stage, so a one-shot failure has to live at index 0. */
  silo:       { stages: [55, 99, 99, 99], hp: [46, 1, 1, 1] },
  waterTower: { stages: [66, 99, 99, 99], hp: [60, 1, 1, 1] },
  driveIn:    { stages: [40, 99, 99, 99], hp: [30, 1, 1, 1] },
  tree:       { stages: [29, 42, 99, 99], hp: [14, 24, 1, 1] },
  pole:       { stages: [33, 45, 99, 99], hp: [16, 26, 1, 1] },

  cow:        { loft: 29, drag: 0.62, mass: 1 },
  car:        { loft: 52, slide: 40, drag: 0.30, mass: 1 },
  pickup:     { loft: 58, slide: 44, drag: 0.26, mass: 1 },
  tractor:    { loft: 66, slide: 50, drag: 0.22, mass: 1 },
  hayBale:    { loft: 24, drag: 0.9, mass: 1 },
  sign:       { loft: 31, drag: 1.1, mass: 1 },
  mailbox:    { loft: 30, drag: 1.0, mass: 1 },
  fence:      { loft: 26, drag: 1.3, mass: 1 },
  debris:     { loft: 0, drag: 2.6, mass: 1 }
};

/* ------------------------------------------------------------
   Prop — anything with a mesh standing on (or flying over) the ground
   ------------------------------------------------------------ */
class Prop {
  constructor(kind, x, z, mesh, opts) {
    this.kind = kind;
    // gy is the terrain height under this prop: its resting level, and the
    // altitude debris has to fall back to. Flat world if terrain is absent.
    this.gy = Terrain.heightAt(x, z);
    this.x = x; this.y = this.gy; this.z = z;
    this.yaw = opts && opts.yaw !== undefined ? opts.yaw : rnd(TAU);
    this.pitch = 0; this.roll = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.sx = 0; this.sy = 0; this.sz = 0;
    this.mesh = mesh;
    this.opts = opts || {};
    this.stage = 0;
    this.dmg = 0;
    this.dyn = false;          // integrating under the wind field
    this.settled = false;
    this.grounded = true;
    this.counted = false;      // already added to the tally
    this.aloftPeak = 0;
    this.temp = false;         // recyclable debris rather than town furniture
    this.m = new Float32Array(9);
    this.spec = SPEC[kind] || SPEC.debris;
    this.structure = !!this.spec.stages;
  }

  rebuild() {
    const o = this.opts;
    o.stage = this.stage;
    if (Models[this.kind]) this.mesh = Models[this.kind](o);
  }

  update(dt, tor, sim) {
    if (this.dyn) return this.updateDynamic(dt, tor, sim);
    if (this.settled) return;

    // Cheap reject: only objects within reach of the circulation matter.
    const dx = this.x - tor.x, dz = this.z - tor.z;
    const d2 = dx * dx + dz * dz;
    const reach = tor.radius * 9 + 240;
    if (d2 > reach * reach) return;

    const ws = tor.speedAt(this.x, Math.max(1.5, this.mesh.r * 0.4), this.z);

    if (this.structure) {
      const sp = this.spec;
      const next = this.stage;
      if (next < 4 && sp.stages[next] < 99 && ws > sp.stages[next]) {
        this.dmg += (ws - sp.stages[next]) * dt;
        if (this.dmg >= sp.hp[next]) {
          this.dmg = 0;
          this.stage++;
          this.rebuild();
          sim.onStageChange(this, ws);
        }
      } else if (this.dmg > 0) {
        this.dmg = Math.max(0, this.dmg - dt * 4);
      }
    } else {
      const sp = this.spec;
      if (sp.slide && ws > sp.slide && ws <= sp.loft) {
        // Shoved along the ground before it ever leaves it.
        tor.windAt(this.x, 1, this.z, _wv);
        const k = (ws - sp.slide) * 0.02 * dt;
        this.x += _wv.x * k; this.z += _wv.z * k;
        this.gy = Terrain.heightAt(this.x, this.z);
        this.y = this.gy;
        this.yaw += k * 0.6;
      } else if (ws > sp.loft) {
        this.launch(tor, sim, ws);
      }
    }
  }

  launch(tor, sim, ws) {
    this.dyn = true;
    this.grounded = false;
    tor.windAt(this.x, this.y + 1, this.z, _wv);
    this.vx = _wv.x * 0.35; this.vz = _wv.z * 0.35; this.vy = 2 + rnd(0, 4);
    const tumble = clamp(ws / 30, 0.6, 4);
    this.sx = rnd(-2.4, 2.4) * tumble;
    this.sy = rnd(-2.4, 2.4) * tumble;
    this.sz = rnd(-2.4, 2.4) * tumble;
    sim.onLaunch(this, ws);
  }

  updateDynamic(dt, tor, sim) {
    tor.windAt(this.x, this.y, this.z, _wv);
    const rx = _wv.x - this.vx, ry = _wv.y - this.vy, rz = _wv.z - this.vz;
    const k = this.spec.drag;

    this.vx += rx * k * dt;
    this.vy += (ry * k + GRAV) * dt;
    this.vz += rz * k * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    this.yaw += this.sy * dt;
    this.pitch += this.sx * dt;
    this.roll += this.sz * dt;

    if (this.y > this.aloftPeak) this.aloftPeak = this.y;

    if (this.y <= this.gy) {                  // touchdown
      this.y = this.gy;
      const impact = -this.vy;
      this.vy = impact * 0.24;
      this.vx *= 0.55; this.vz *= 0.55;
      this.sx *= 0.4; this.sy *= 0.5; this.sz *= 0.4;
      if (impact > 6) sim.puff(this.x, this.gy + 1, this.z, Math.min(14, impact * 1.2));

      const speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
      const ws = Math.sqrt(_wv.x * _wv.x + _wv.z * _wv.z);
      if (speed < 1.4 && ws < (this.spec.loft || 20) * 0.7) {
        this.dyn = false;
        this.settled = true;
        this.grounded = true;
        this.pitch = rnd(-0.4, 0.4);
        this.roll = rnd(-0.4, 0.4);
        if (this.temp) this.pitch = this.roll = rnd(-1.4, 1.4);
        sim.onSettle(this);
      }
    }

    // Anything flung clear off the map stops being our problem.
    if (Math.abs(this.x) > 4200 || Math.abs(this.z) > 4200 || this.y > 3000) {
      if (this.temp) this.dead = true;
      else { this.dyn = false; this.settled = true; this.gy = Terrain.heightAt(this.x, this.z); this.y = this.gy; }
      sim.onSettle(this);
    }
  }
}

const _wv = { x: 0, y: 0, z: 0 };

/* ------------------------------------------------------------
   Town generation
   ------------------------------------------------------------ */
const Town = {
  name: 'PRAIRIE BEND, OK',

  build(sim, cfg) {
    const R = mulberry32(cfg.seed >>> 0);
    const rr = (a, b) => a + R() * (b - a);
    const rp = (arr) => arr[(R() * arr.length) | 0];
    const props = [];

    /* Street plan: one highway north–south, main street east–west,
       plus a couple of residential rows either side. */
    const roads = [
      { x: 0, z: 0, w: 14, len: 2000, dir: 'z' },        // the highway
      { x: 0, z: 0, w: 12, len: 1100, dir: 'x' },        // Main Street
      { x: 0, z: 180, w: 9, len: 760, dir: 'x' },
      { x: 0, z: -180, w: 9, len: 760, dir: 'x' },
      { x: 260, z: 0, w: 9, len: 560, dir: 'z' },
      { x: -260, z: 0, w: 9, len: 560, dir: 'z' }
    ];

    const nBuild = cfg.buildings;
    let placed = 0;

    /* --- Main Street storefronts --- */
    const shopNames = ['#c9b9a0', '#b6c3cb', '#cbb0a4', '#adbcae', '#c7c3b4'];
    const signCols = ['#c9403c', '#2f6fb5', '#d9a032', '#3f8a63', '#8f5fb0'];
    for (let side = -1; side <= 1; side += 2) {
      let x = -230;
      while (x < 230 && placed < nBuild) {
        const w = rr(11, 18), d = rr(9, 13), h = rr(5, 7.5);
        if (Math.abs(x) > 22) {
          const o = {
            w, d, h, stage: 0,
            wall: rp(shopNames), sign: rp(signCols),
            awning: R() < 0.5, yaw: side > 0 ? 0 : Math.PI
          };
          props.push(new Prop('shop', x + w / 2, side * (12 + d / 2), Models.shop(o), o));
          placed++;
        }
        x += w + rr(3, 8);
      }
    }

    /* --- Residential rows --- */
    const rows = [180, -180, 330, -330];
    for (const z0 of rows) {
      for (let side = -1; side <= 1; side += 2) {
        let x = -320;
        while (x < 320 && placed < nBuild) {
          if (Math.abs(x) > 26 && R() < 0.82) {
            const w = rr(9, 14), d = rr(8, 12), h = rr(4.2, 6.4);
            const o = {
              w, d, h, stage: 0,
              wall: rp(C.wall), roof: rp(C.roof), door: rp(C.door),
              porch: R() < 0.55, chimney: R() < 0.6,
              yaw: side > 0 ? 0 : Math.PI
            };
            const zz = z0 + side * (14 + d / 2);
            props.push(new Prop('house', x, zz, Models.house(o), o));
            placed++;

            // Yard furniture: a tree, a mailbox, sometimes the family car.
            if (R() < 0.72) {
              const to = { h: rr(7, 12), r: rr(2.6, 4.2), stage: 0, leaf: rp([C.leafA, C.leafB, C.leafC, C.leafD]) };
              props.push(new Prop('tree', x + rr(-8, 8), zz + side * rr(7, 12), Models.tree(to), to));
            }
            if (R() < 0.5) props.push(new Prop('mailbox', x + rr(-5, 5), z0 + side * 7.5, Models.mailbox({}), {}));
          }
          x += rr(20, 30);
        }
      }
    }

    /* --- Landmarks --- */
    {
      const o = { w: 16, d: 26, h: 8, stage: 0, yaw: 0 };
      props.push(new Prop('church', -150, -260, Models.church(o), o));
    }
    {
      const o = { r: 6.5, h: 34, stage: 0 };
      props.push(new Prop('waterTower', 210, -300, Models.waterTower(o), o));
    }
    {
      const o = { w: 26, h: 14, stage: 0, yaw: 0.2 };
      props.push(new Prop('driveIn', -430, 400, Models.driveIn(o), o));
    }

    /* --- Farmsteads out past the town limits --- */
    for (let i = 0; i < 5; i++) {
      const a = rr(0, TAU), rad = rr(430, 780);
      const fx = Math.cos(a) * rad, fz = Math.sin(a) * rad;
      const yaw = rr(0, TAU);
      const bo = { w: rr(15, 22), d: rr(11, 16), h: rr(6, 8.5), stage: 0, yaw };
      props.push(new Prop('barn', fx, fz, Models.barn(bo), bo));
      const ho = {
        w: rr(9, 12), d: rr(8, 11), h: rr(4.5, 6), stage: 0,
        wall: rp(C.wall), roof: rp(C.roof), door: rp(C.door), porch: true, chimney: true, yaw
      };
      props.push(new Prop('house', fx + Math.cos(yaw) * 34, fz + Math.sin(yaw) * 34, Models.house(ho), ho));
      if (R() < 0.7) {
        const so = { r: rr(3, 4.6), h: rr(14, 22), stage: 0 };
        props.push(new Prop('silo', fx - 18, fz + 14, Models.silo(so), so));
      }
      for (let k = 0; k < 3; k++) {
        const bo2 = { r: rr(1.1, 1.6) };
        props.push(new Prop('hayBale', fx + rr(-40, 40), fz + rr(-40, 40), Models.hayBale(bo2), bo2));
      }
      if (R() < 0.6) {
        const to = {};
        props.push(new Prop('tractor', fx + rr(-25, 25), fz + rr(-25, 25), Models.tractor(to), to));
      }
    }

    /* --- Power line along the highway --- */
    for (let z = -900; z <= 900; z += 60) {
      const o = { h: rr(8, 10), stage: 0 };
      props.push(new Prop('pole', 12, z, Models.pole(o), o));
    }

    /* --- Windbreak trees and shelter belts --- */
    for (let i = 0; i < 90; i++) {
      const a = rr(0, TAU), rad = rr(120, 1050);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (Math.abs(x) < 30 || Math.abs(z) < 26) continue;
      const o = { h: rr(6, 14), r: rr(2.2, 4.6), stage: 0, leaf: rp([C.leafA, C.leafB, C.leafC, C.leafD]) };
      props.push(new Prop('tree', x, z, Models.tree(o), o));
    }

    /* --- Pasture fencing --- */
    for (let i = 0; i < 26; i++) {
      const a = rr(0, TAU), rad = rr(300, 900);
      const o = { len: rr(14, 28) };
      props.push(new Prop('fence', Math.cos(a) * rad, Math.sin(a) * rad, Models.fence(o), { ...o, yaw: rr(0, TAU) }));
    }

    /* --- Road signs --- */
    for (let i = 0; i < 8; i++) {
      const o = { h: rr(2.6, 3.6), w: rr(0.8, 1.4), col: rp(['#3f8a63', '#c9403c', '#d9a032']) };
      props.push(new Prop('sign', rr(-500, 500), rr(-500, 500), Models.sign(o), o));
    }

    /* --- Cars: parked on driveways, moving on the highway --- */
    for (let i = 0; i < cfg.cars; i++) {
      const onRoad = R() < 0.45;
      const kind = R() < 0.35 ? 'pickup' : 'car';
      const o = { col: rp(C.car) };
      let x, z, yaw;
      if (onRoad) {
        if (R() < 0.5) { x = R() < 0.5 ? -4.5 : 4.5; z = rr(-800, 800); yaw = 0; }
        else { x = rr(-420, 420); z = R() < 0.5 ? -4 : 4; yaw = Math.PI / 2; }
      } else {
        x = rr(-360, 360); z = rr(-380, 380); yaw = rr(0, TAU);
      }
      const mk = kind === 'pickup' ? Models.pickup(o) : Models.car(o);
      props.push(new Prop(kind, x, z, mk, { ...o, yaw }));
    }

    /* --- Cows: grazing in clusters, because cows do that ---
       Placement matters more than it looks. Herds scattered at random over
       a square kilometre can all sit outside the ~140 m in which a tornado
       can actually pick one up, so a whole pass goes by without a single
       cow leaving the ground. Half the herds are therefore seeded along the
       storm's opening track, and the rest are spread on an evenly spaced
       ring so that any track through the middle still finds some. */
    const herds = Math.max(2, Math.round(cfg.cows / 7));
    const tor = cfg.track;
    let made = 0;
    for (let hIdx = 0; hIdx < herds && made < cfg.cows; hIdx++) {
      let hx, hz;
      if (tor && hIdx % 2 === 0) {
        const along = rr(-120, 1000);
        hx = tor.x + Math.sin(tor.heading) * along + rr(-110, 110);
        hz = tor.z + Math.cos(tor.heading) * along + rr(-110, 110);
      } else {
        const a = (hIdx / herds) * TAU + rr(-0.3, 0.3);
        const rad = rr(200, 620);
        hx = Math.cos(a) * rad; hz = Math.sin(a) * rad;
      }
      const n = Math.min(cfg.cows - made, rndInt(5, 11));
      for (let i = 0; i < n; i++) {
        const o = { spotted: R() < 0.7, hide: rp(['#8a6144', '#6f4f38', '#a9856a']) };
        props.push(new Prop('cow', hx + rr(-42, 42), hz + rr(-42, 42), Models.cow(o), { ...o, yaw: rr(0, TAU) }));
        made++;
      }
    }

    return { props, roads };
  }
};

/* ------------------------------------------------------------
   Simulation container
   ------------------------------------------------------------ */
class Simulation {
  constructor() {
    this.tor = new Tornado();
    this.props = [];
    this.roads = [];
    this.dust = [];
    this.puffs = [];
    this.shouts = [];
    this.shoutCd = 0;
    this.scars = [];
    this.cfg = { seed: 20260727, buildings: 28, cows: 34, cars: 22 };
    this.groundStamp = 0;        // bumped on rebuild so the GL ground re-bakes
    this.vegCount = 0;           // set by the renderer's quality profile
    /* How far the parent supercell has developed, 0 (fair-weather cumulus)
       to 1 (mature, anvil spread, wall cloud lowered). Separate from the
       tornado's own life stage: the storm exists long before the funnel. */
    this.stormStage = 1;
    this.autoStorm = false;
    this.stormClock = 0;
    this.stats = this.freshStats();
    this.dustCount = 2600;
    this.events = [];
    this.debrisBudget = 420;
    this.rebuild();
  }

  freshStats() {
    return {
      roofs: 0, homes: 0, slabs: 0, cars: 0, trees: 0,
      cowsNow: 0, cowsTotal: 0, debrisAloft: 0, surveyEF: 0, peakObserved: 0
    };
  }

  rebuild(newSeed) {
    if (newSeed) this.cfg.seed = (Math.random() * 1e9) | 0;
    // Let the generator see where the storm will come from.
    this.cfg.track = { x: this.tor.x, z: this.tor.z, heading: this.tor.heading };
    const t = Town.build(this, this.cfg);
    this.props = t.props;
    this.roads = t.roads;
    this.groundStamp++;
    if (typeof Vegetation !== 'undefined' && this.vegCount) {
      Vegetation.build(this.vegCount, this.roads);
    }
    this.stats = this.freshStats();
    this.scars.length = 0;
    this.shouts.length = 0;
    this.initDust();
  }

  /* Run the whole thing from clear air to rope-out. */
  beginFormation() {
    this.resetStorm();
    this.autoStorm = true;
    this.stormClock = 0;
    this.stormStage = 0;
    this.tor.autoLife = false;
    this.tor.life = 0;
  }

  resetStorm() {
    if (typeof Vegetation !== 'undefined') Vegetation.reset();
    this.autoStorm = false;
    this.stormClock = 0;
    this.tor.reset();
    for (const p of this.props) {
      if (p.temp) continue;
      p.stage = 0; p.dmg = 0; p.dyn = false; p.settled = false;
      p.gy = Terrain.heightAt(p.x, p.z);
      p.y = p.gy; p.pitch = 0; p.roll = 0;
      p.vx = p.vy = p.vz = 0; p.counted = false; p.aloftPeak = 0;
      if (p.structure || p.kind === 'tree' || p.kind === 'pole') p.rebuild();
    }
    this.props = this.props.filter(p => !p.temp);
    this.stats = this.freshStats();
    this.scars.length = 0;
    this.shouts.length = 0;
    this.initDust();
  }

  initDust() {
    this.dust.length = 0;
    for (let i = 0; i < this.dustCount; i++) this.dust.push(this.newDust(true));
  }

  newDust(spread) {
    const t = this.tor;
    const a = rnd(TAU);
    const r = t.radius * (spread ? rnd(0.2, 6) : rnd(0.9, 3.2));
    const px = t.x + Math.cos(a) * r, pz = t.z + Math.sin(a) * r;
    const gy = Terrain.heightAt(px, pz);
    const y = gy + (spread ? rnd(0, t.cloudBase * 0.35) : rnd(0, 24));
    return {
      x: px,
      y,
      z: pz,
      s: rnd(0.5, 2.6),
      a: rnd(0.18, 0.62),
      tone: Math.random() < 0.62 ? 0 : (Math.random() < 0.6 ? 1 : 2),
      life: rnd(2, 11)
    };
  }

  /* ---- event hooks used by the props ---- */

  onStageChange(p, ws) {
    const s = this.stats;
    if (ws > s.peakObserved) s.peakObserved = ws;

    if (p.kind === 'tree') {
      if (p.stage === 2) { s.trees++; this.say('Tree line down — snapped at the trunk.'); }
      this.spawnDebris(p, 4, 'leaf');
      return;
    }
    if (p.kind === 'pole') { this.spawnDebris(p, 3, 'wood'); return; }

    /* One-shot structures fail outright rather than peeling in stages. */
    if (p.kind === 'silo' || p.kind === 'waterTower' || p.kind === 'driveIn') {
      s.homes++;
      this.spawnDebris(p, 16, 'wall');
      this.puff(p.x, 3, p.z, 24);
      this.say(p.kind === 'waterTower'
        ? 'The water tower is down.'
        : p.kind === 'silo' ? 'Grain silo buckled and collapsed.' : 'Drive-in screen folded over.');
      this.updateSurvey();
      return;
    }

    if (p.stage === 1) { s.roofs++; this.spawnDebris(p, 10, 'shingle'); this.say('Shingles coming off — that is EF0 to EF1 damage.'); }
    if (p.stage === 2) { this.spawnDebris(p, 14, 'wood'); this.say('Roof deck gone. Surveyors call that EF2.'); }
    if (p.stage === 3) { s.homes++; this.spawnDebris(p, 20, 'wall'); this.say('Exterior walls collapsing — EF3.'); }
    if (p.stage === 4) { s.slabs++; this.spawnDebris(p, 22, 'wall'); this.say('Swept clean to the foundation. That is EF5 damage.'); }
    this.puff(p.x, 2, p.z, 18);
    this.updateSurvey();
  }

  onLaunch(p, ws) {
    const s = this.stats;
    if (ws > s.peakObserved) s.peakObserved = ws;
    if (p.kind === 'cow') {
      s.cowsTotal++;
      this.shout(p, pick(['MOO!', 'MOOOO!', 'MO-O-O-O!']));
      if (s.cowsTotal === 1) this.say('There’s a cow.');
      else if (s.cowsTotal === 2) this.say('…’Nother cow.');
      else if (s.cowsTotal === 3) this.say('Actually, I think that was the same cow.');
      else if (s.cowsTotal % 10 === 0) this.say('We got cows! ' + s.cowsTotal + ' of them airborne so far.');
    } else if (p.kind === 'car' || p.kind === 'pickup' || p.kind === 'tractor') {
      s.cars++;
      if (s.cars === 1) this.say('Vehicle lofted — that takes at least EF2 winds.');
    }
    this.updateSurvey();
  }

  onSettle() { /* tallies are recomputed each frame from live state */ }

  /* Ground scour and scattered wreckage left along the track. */
  scar(x, z, r) {
    this.scars.push({ x, z, r, a: rnd(0.3, 0.75) });
    if (this.scars.length > 520) this.scars.shift();
  }

  puff(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      this.puffs.push({
        x: x + rnd(-3, 3), y: y + rnd(0, 3), z: z + rnd(-3, 3),
        vx: rnd(-6, 6), vy: rnd(1, 8), vz: rnd(-6, 6),
        s: rnd(1.2, 4), life: rnd(0.8, 2.2), age: 0
      });
    }
    if (this.puffs.length > 1400) this.puffs.splice(0, this.puffs.length - 1400);
  }

  /* Rate-limited: a whole herd goes up within a second or two, and stacking
     six speech bubbles on the same spot just makes an unreadable blob. */
  shout(p, text) {
    if (this.shoutCd > 0) return;
    this.shoutCd = 0.62;
    this.shouts.push({ p, text, age: 0, life: 2.4 });
    if (this.shouts.length > 4) this.shouts.shift();
  }

  say(text) {
    this.events.push(text);
    if (this.events.length > 4) this.events.shift();
  }

  /* Debris pieces are pooled: past the budget, the oldest is reused. */
  spawnDebris(p, n, type) {
    const t = this.tor;
    let live = 0;
    for (const q of this.props) if (q.temp && !q.dead) live++;
    const room = Math.max(0, this.debrisBudget - live);
    n = Math.min(n, room);

    for (let i = 0; i < n; i++) {
      let o, kind = 'debris';
      if (type === 'shingle') o = { hx: rnd(0.3, 0.7), hy: 0.03, hz: rnd(0.3, 0.7), col: '#5c5348' };
      else if (type === 'wood') o = { hx: rnd(0.06, 0.14), hy: rnd(0.05, 0.1), hz: rnd(0.5, 1.7), col: '#b9a986', col2: '#8d7f63' };
      else if (type === 'leaf') o = { hx: rnd(0.15, 0.4), hy: 0.02, hz: rnd(0.15, 0.4), col: p.opts.leaf || C.leafA };
      else o = { hx: rnd(0.4, 1.1), hy: rnd(0.03, 0.09), hz: rnd(0.4, 1.1), col: p.opts.wall || '#d8cfc0' };

      const d = new Prop(kind, p.x + rnd(-4, 4), p.z + rnd(-4, 4), Models.plank(o), o);
      d.temp = true;
      d.y = d.gy + rnd(1, Math.max(3, p.mesh.r));
      d.dyn = true;
      d.grounded = false;
      t.windAt(d.x, d.y, d.z, _wv);
      d.vx = _wv.x * 0.4 + rnd(-6, 6);
      d.vz = _wv.z * 0.4 + rnd(-6, 6);
      d.vy = rnd(3, 14);
      d.sx = rnd(-9, 9); d.sy = rnd(-9, 9); d.sz = rnd(-9, 9);
      this.props.push(d);
    }
  }

  updateSurvey() {
    const s = this.stats;
    let ef = 0;
    if (s.roofs > 0) ef = Math.max(ef, 1);
    if (s.trees > 0) ef = Math.max(ef, 2);
    if (s.cars > 0) ef = Math.max(ef, 2);
    if (s.homes > 0) ef = Math.max(ef, 3);
    if (s.homes > 3) ef = Math.max(ef, 4);
    if (s.slabs > 0) ef = Math.max(ef, 5);
    s.surveyEF = ef;
  }

  /* ---- main step ---- */

  step(dt) {
    const t = this.tor;
    t.step(dt);

    /* Scripted formation: the supercell builds first, and only once the
       mesocyclone is established does the funnel reach the ground. */
    if (this.autoStorm) {
      this.stormClock += dt;
      const c = this.stormClock;
      this.stormStage = clamp(c / 34, 0, 1);
      if (c > 30) {
        t.life = clamp((c - 30) / 62, 0, 1);
        if (t.life >= 1) { this.autoStorm = false; }
      } else {
        t.life = 0;
      }
    }

    /* Flatten the county's trees under the circulation. Bucketed, so this
       only ever examines the handful of cells the storm is actually over. */
    if (t.lifeScale > 0.2 && typeof Vegetation !== 'undefined' && Vegetation.count) {
      Vegetation.flatten(t.x, t.z, t.radius * 1.5 + 30);
    }

    // Ground scour under the circulation.
    if (t.lifeScale > 0.15 && Math.random() < dt * 34) {
      const a = rnd(TAU), r = rnd(0, t.radius * 1.5);
      this.scar(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, rnd(1.6, 5.5));
    }

    let cowsNow = 0, aloft = 0;
    const props = this.props;
    for (let i = props.length - 1; i >= 0; i--) {
      const p = props[i];
      if (p.dead) { props.splice(i, 1); continue; }
      p.update(dt, t, this);
      if (p.dyn) {
        aloft++;
        if (p.kind === 'cow') cowsNow++;
      }
    }
    this.stats.cowsNow = cowsNow;
    this.stats.debrisAloft = aloft;
    if (t.peakWind > this.stats.peakObserved && t.lifeScale > 0.2) {
      // Only credit wind that actually touched something on the ground.
      const nearTown = Math.abs(t.x) < 1100 && Math.abs(t.z) < 1100;
      if (nearTown) this.stats.peakObserved = t.peakWind;
    }

  }

  /*
     Purely visual state — dust, impact puffs, speech bubbles. Advanced once
     per rendered frame rather than once per physics substep: there is no
     stability requirement here, and dust advection is the single most
     expensive thing in the simulation.
  */
  stepVisual(dt) {
    if (dt <= 0) return;
    if (dt > 0.06) dt = 0.06;
    this.stepDust(dt);
    this.stepPuffs(dt);

    if (this.shoutCd > 0) this.shoutCd -= dt;
    for (let i = this.shouts.length - 1; i >= 0; i--) {
      const s = this.shouts[i];
      s.age += dt;
      if (s.age > s.life) this.shouts.splice(i, 1);
    }
  }

  stepDust(dt) {
    const t = this.tor;
    const d = this.dust;
    for (let i = 0; i < d.length; i++) {
      const p = d[i];
      t.windAt(p.x, p.y, p.z, _wv);
      // Dust is nearly massless — it just goes where the air goes.
      p.x += _wv.x * dt * 0.94;
      p.y += (_wv.y * 0.9 - 1.2) * dt;
      p.z += _wv.z * dt * 0.94;
      p.life -= dt;

      const dx = p.x - t.x, dz = p.z - t.z;
      const rr = Math.sqrt(dx * dx + dz * dz);
      if (p.life <= 0 || p.y < Terrain.heightAt(p.x, p.z) - 3 || p.y > t.cloudBase * 0.68 || rr > t.radius * 11 + 320) {
        d[i] = this.newDust(false);
      }
    }
    // Keep the population matched to the quality setting.
    while (d.length < this.dustCount) d.push(this.newDust(true));
    if (d.length > this.dustCount) d.length = this.dustCount;
  }

  stepPuffs(dt) {
    const p = this.puffs;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      q.age += dt;
      if (q.age > q.life) { p.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.vy -= 3.4 * dt;
      q.vx *= 0.97; q.vz *= 0.97;
      q.s += dt * 3.2;
    }
  }
}
