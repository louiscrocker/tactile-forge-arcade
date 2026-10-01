/* ============================================================
   radar.js — the Doppler scope
   ============================================================
   Two products, the same two a warning forecaster looks at:

   REFLECTIVITY  how much precipitation the beam hits. The famous
                 hook echo is rain being wrapped cyclonically
                 around the back of the mesocyclone by the rear
                 flank downdraft.

   VELOCITY      how fast that precipitation is moving ALONG the
                 beam — toward the radar or away from it. This one
                 is computed from the live wind field, so the
                 red/green couplet you see is the actual simulated
                 rotation, not a picture of one. Bright red hard
                 against bright green over a few kilometres is a
                 mesocyclone; a tight knot at the centre is a
                 tornado vortex signature.

   One honesty note: the simulation models the tornado, not the
   whole supercell around it. The broad parent circulation and the
   precipitation field are modelled here, for the radar only.
   ============================================================ */
'use strict';

const Radar = {
  on: false,
  mode: 'velocity',        // 'reflectivity' | 'velocity'
  SPAN: 14000,             // metres across the scope
  N: 72,                   // sample grid (upscaled for the soft radar look)
  site: { x: -55000, z: -55000, name: 'KTLX', },
  beamHeight: 140,         // metres above ground the beam samples

  acc: 0,
  ready: false,

  init() {
    this.canvas = document.getElementById('radarCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Offscreen buffer holding the raw product at sample resolution.
    this.buf = document.createElement('canvas');
    this.buf.width = this.N;
    this.buf.height = this.N;
    this.bctx = this.buf.getContext('2d');
    this.img = this.bctx.createImageData(this.N, this.N);

    this.noise = makeNoise2D(24601);
    this.resize();
    this.ready = true;
  },

  /* Sample resolution follows the app's Quality setting. */
  setN(n) {
    if (!this.ready || n === this.N) return;
    this.N = n;
    this.buf.width = n;
    this.buf.height = n;
    this.img = this.bctx.createImageData(n, n);
  },

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const css = this.canvas.clientWidth || 232;
    this.canvas.width = Math.round(css * dpr);
    this.canvas.height = Math.round(css * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.css = css;
  },

  /* ---------------------------------------------------------
     Modelled supercell fields
     --------------------------------------------------------- */

  /* Hook geometry depends only on the storm, not on the sample point.
     Hoisted out of the per-pixel loop: recomputing its trig for every one
     of ~5000 pixels made a radar sweep cost more than the whole 3D frame. */
  prepare(t) {
    this._ch = Math.cos(t.heading);
    this._sh = Math.sin(t.heading);
    const h = this._hook || (this._hook = []);
    h.length = 0;
    for (let k = 0; k <= 9; k++) {
      const s = k / 9;
      const ha = (-2.15 + s * 4.0 * t.spin) + Math.PI * 0.5;
      const hr = 4200 * (1 - 0.8 * s) + 320;
      const w = 1150 * (1 - 0.45 * s);
      h.push({
        u: Math.cos(ha) * hr,
        v: Math.sin(ha) * hr,
        inv: 1 / (2 * w * w),
        amp: 52 - s * 8
      });
    }
  },

  /*
     Reflectivity in dBZ at a world point: a forward-flank precipitation
     core, a weaker trailing core, and the hook of rain wrapped around the
     circulation. All laid out in storm-relative coordinates, so the hook
     stays correctly oriented when the track heading changes.
  */
  reflectivityAt(t, wx, wz) {
    if (!this._hook) this.prepare(t);
    const dx = wx - t.x, dz = wz - t.z;
    // Rotate into storm-relative axes: u along the track, v to its left.
    const ch = this._ch, sh = this._sh;
    const u = dx * sh + dz * ch;
    const v = dx * ch - dz * sh;

    // Forward-flank downdraft: the big precipitation core ahead and left.
    /* Gaussians are skipped once they are far enough out to contribute
       nothing — exp() is the whole cost of this function, and most pixels
       are outside most of the blobs. */
    const cu = u - 2600, cv = v - 3000;
    let q = (cu * cu + cv * cv) * 2.834e-8;         // 1/(2*4200^2)
    let dbz = q < 7 ? 62 * Math.exp(-q) : 0;

    // A second, weaker core trailing behind.
    const bu = u + 3800, bv = v - 1200;
    q = (bu * bu + bv * bv) * 4.325e-8;             // 1/(2*3400^2)
    if (q < 7) { const s = 44 * Math.exp(-q); if (s > dbz) dbz = s; }

    /* The hook: precipitation drawn inward along a spiral that wraps
       roughly two-thirds of the way around the circulation. Modelled as
       a chain of blobs down that spiral. */
    if (u * u + v * v < 49000000) {                 // within 7 km
      const H = this._hook;
      for (let k = 0; k < H.length; k++) {
        const b = H[k];
        const du = u - b.u, dv = v - b.v;
        const e = (du * du + dv * dv) * b.inv;
        if (e > 7) continue;
        const blob = b.amp * Math.exp(-e);
        if (blob > dbz) dbz = blob;
      }
      // The weak-echo notch: the RFD clears out rain just behind the core.
      const nu = u + 408, nv = v + 802;
      const ne = (nu * nu + nv * nv) / 1620000;
      if (ne < 7) dbz *= 1 - 0.55 * Math.exp(-ne);
    }

    // Texture, so it doesn't look like an equation.
    dbz *= 0.86 + 0.28 * this.noise(wx * 0.00055, wz * 0.00055);
    dbz += 8 * this.noise(wx * 0.0021 + 40, wz * 0.0021);
    return dbz;
  },

  /*
     Wind used by the velocity product: the simulated tornado plus a broad
     parent mesocyclone. Without the parent circulation the couplet would be
     a couple of pixels wide, because a tornado is tiny compared with a radar
     sample at 78 km.

     Evaluated from the simulation's own vortex parameters — rotation speed,
     core radius, spin direction and life stage all feed straight in, so the
     couplet responds live to every slider. Two deliberate simplifications
     for the radar's sake: the far field decays as a pure free vortex (1/r)
     rather than the shallower exponent used on the ground, and suction
     vortices are ignored. Both are invisible here — a radar sample at this
     range covers more ground than a whole suction vortex.

     This runs for every pixel of the scope, so it avoids Math.hypot and
     Math.pow entirely.
  */
  radarWind(t, wx, wz, out) {
    const dx = wx - t.x, dz = wz - t.z;
    const r = Math.sqrt(dx * dx + dz * dz);
    if (r < 1e-3) { out.x = 0; out.z = 0; return out; }
    const inv = 1 / r;
    const ls = t.lifeScale;

    /* Parent mesocyclone: the broad rotation a radar actually resolves.
       The outer field is windowed down to nothing by about 8 km — a bare 1/r
       tail keeps enough speed at the edge of the scope to colour every pixel,
       which turns the couplet into one big diagonal wash instead of a
       localised signature sitting on the storm. */
    const Rm = 2600, Vm = 21 * ls;
    let vt;
    if (r < Rm) vt = Vm * r * (1 / Rm);
    else {
      const e = (r - Rm) / 3200;
      vt = Vm * Rm * inv * Math.exp(-e * e);
    }

    // The tornado itself: a tight spike at the centre of that couplet.
    const Rc = Math.max(20, t.radius), Vt = t.vmax * ls;
    vt += r < Rc ? Vt * r * (1 / Rc) : Vt * Rc * inv;

    // Inflow gives the couplet its slight convergent tilt.
    const vr = -vt * 0.28;
    out.x = (-dz * inv * vt * t.spin) + dx * inv * vr;
    out.z = (dx * inv * vt * t.spin) + dz * inv * vr;
    return out;
  },

  /* ---------------------------------------------------------
     Colour scales
     --------------------------------------------------------- */

  /* Stepped, like a real radar display rather than a smooth ramp. */
  dbzColor(d, o) {
    let c;
    if (d < 8) { o[3] = 0; return; }
    else if (d < 14) c = [4, 160, 170];
    else if (d < 20) c = [1, 130, 220];
    else if (d < 26) c = [2, 200, 40];
    else if (d < 32) c = [1, 168, 20];
    else if (d < 38) c = [0, 128, 10];
    else if (d < 44) c = [235, 226, 20];
    else if (d < 50) c = [226, 170, 0];
    else if (d < 56) c = [240, 140, 0];
    else if (d < 62) c = [232, 22, 22];
    else if (d < 68) c = [190, 10, 10];
    else if (d < 74) c = [244, 30, 240];
    else c = [152, 84, 198];
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    o[3] = d < 12 ? 150 : 240;
  },

  /* Green = toward the radar, red = away. Grey where the air is calm. */
  velColor(v, dbz, o) {
    if (dbz < 8) { o[3] = 0; return; }          // no returns, no velocity
    const a = clamp(Math.abs(v) / 42, 0, 1);
    if (Math.abs(v) < 2.2) { o[0] = 96; o[1] = 100; o[2] = 104; o[3] = 190; return; }
    if (v < 0) {                                 // inbound
      o[0] = (18 + 40 * (1 - a)) | 0;
      o[1] = (110 + 145 * a) | 0;
      o[2] = (34 + 60 * (1 - a)) | 0;
    } else {                                     // outbound
      o[0] = (120 + 135 * a) | 0;
      o[1] = (26 + 46 * (1 - a)) | 0;
      o[2] = (26 + 46 * (1 - a)) | 0;
    }
    o[3] = 240;
  },

  /* ---------------------------------------------------------
     Frame
     --------------------------------------------------------- */
  update(sim, dt) {
    if (!this.on || !this.ready) return;
    this.acc += dt;
    if (this.acc < 0.25) return;                 // 4 Hz; a real volume scan is minutes
    this.acc = 0;
    this.paint(sim);
  },

  paint(sim) {
    const t = sim.tor;
    this.prepare(t);
    const N = this.N, span = this.SPAN;
    const data = this.img.data;
    const px = [0, 0, 0, 0];
    const w = _radWind;
    const step = span / N;
    const x0 = t.x - span * 0.5, z0 = t.z + span * 0.5;

    for (let j = 0; j < N; j++) {
      const wz = z0 - (j + 0.5) * step;          // north at the top
      for (let i = 0; i < N; i++) {
        const wx = x0 + (i + 0.5) * step;
        const dbz = this.reflectivityAt(t, wx, wz);
        if (this.mode === 'reflectivity') {
          this.dbzColor(dbz, px);
        } else {
          this.radarWind(t, wx, wz, w);
          // Component along the beam: positive is away from the radar.
          let bx = wx - this.site.x, bz = wz - this.site.z;
          const bl = Math.hypot(bx, bz) || 1;
          bx /= bl; bz /= bl;
          this.velColor(w.x * bx + w.z * bz, dbz, px);
        }
        const k = (j * N + i) * 4;
        data[k] = px[0]; data[k + 1] = px[1]; data[k + 2] = px[2]; data[k + 3] = px[3];
      }
    }
    this.bctx.putImageData(this.img, 0, 0);

    const ctx = this.ctx, S = this.css;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#05080c';
    ctx.fillRect(0, 0, S, S);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.buf, 0, 0, S, S);

    this.overlay(ctx, S, sim, t, span);
  },

  overlay(ctx, S, sim, t, span) {
    const mid = S / 2;
    const mPerPx = span / S;

    /* 2 km grid */
    ctx.save();
    ctx.strokeStyle = 'rgba(150,175,205,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -3; k <= 3; k++) {
      if (!k) continue;
      const p = mid + (k * 2000) / mPerPx;
      ctx.moveTo(p, 0); ctx.lineTo(p, S);
      ctx.moveTo(0, p); ctx.lineTo(S, p);
    }
    ctx.stroke();

    /* Damage path so far */
    const tr = t.trail;
    if (tr.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < tr.length; i++) {
        const sx = mid + (tr[i].x - t.x) / mPerPx;
        const sy = mid - (tr[i].z - t.z) / mPerPx;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    /* The town */
    const tx = mid + (0 - t.x) / mPerPx, tz = mid - (0 - t.z) / mPerPx;
    if (tx > -20 && tx < S + 20 && tz > -20 && tz < S + 20) {
      ctx.strokeStyle = 'rgba(232,238,246,0.7)';
      ctx.lineWidth = 1;
      const half = 700 / mPerPx;
      ctx.strokeRect(tx - half, tz - half, half * 2, half * 2);
      ctx.fillStyle = 'rgba(232,238,246,0.8)';
      ctx.font = '600 8px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('PRAIRIE BEND', tx, tz + half + 9);
    }

    /* Tornado vortex signature — the tight couplet at the centre */
    if (t.lifeScale > 0.2) {
      const pulse = 0.6 + 0.4 * Math.sin(Render.time * 4);
      ctx.strokeStyle = 'rgba(255,72,72,' + pulse.toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mid, mid, 9, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mid, mid - 15); ctx.lineTo(mid, mid - 11);
      ctx.moveTo(mid, mid + 11); ctx.lineTo(mid, mid + 15);
      ctx.moveTo(mid - 15, mid); ctx.lineTo(mid - 11, mid);
      ctx.moveTo(mid + 11, mid); ctx.lineTo(mid + 15, mid);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,92,92,0.95)';
      ctx.font = '700 8px ' + FONT;
      ctx.textAlign = 'left';
      ctx.fillText('TVS', mid + 13, mid - 12);
    }

    /* Azimuth back to the radar site */
    let ax = this.site.x - t.x, az = this.site.z - t.z;
    const al = Math.hypot(ax, az) || 1;
    ax /= al; az /= al;
    ctx.strokeStyle = 'rgba(79,216,232,0.34)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mid, mid);
    ctx.lineTo(mid + ax * S, mid - az * S);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Labels */
    ctx.font = '600 8.5px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(147,163,184,0.9)';
    ctx.fillText(this.site.name + '  ' + Math.round(al / 1000) + ' km', 6, S - 6);
    ctx.textAlign = 'right';
    ctx.fillText((span / 1000) + ' km across', S - 6, S - 6);

    /* North arrow */
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,238,246,0.75)';
    ctx.fillText('N', S - 13, 15);
    ctx.strokeStyle = 'rgba(232,238,246,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(S - 13, 26); ctx.lineTo(S - 13, 18);
    ctx.moveTo(S - 16, 21); ctx.lineTo(S - 13, 17); ctx.lineTo(S - 10, 21);
    ctx.stroke();
    ctx.restore();
  }
};

const _radWind = { x: 0, y: 0, z: 0 };
