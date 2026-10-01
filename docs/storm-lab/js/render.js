/* ============================================================
   render.js — software 3D rasteriser on a 2D canvas
   ============================================================
   Draw order matters more than anything else here. The frame is:

     sky → ground → far half of town → far dust → FUNNEL →
     near dust → near half of town → impact puffs → rain → overlays

   Splitting the depth-sorted face list at the funnel's depth is
   what makes houses correctly pass in front of and behind it.
   ============================================================ */
'use strict';

const Render = {
  canvas: null, ctx: null,
  W: 0, H: 0, dpr: 1,
  quality: 'high',
  FAR: 2600, FOG_NEAR: 320,

  flash: 0, nextBolt: 3, bolt: null,
  shake: 0,
  time: 0,

  /* option flags driven by the UI */
  showPath: true, showAnatomy: false, showWind: false, showGrid: false,
  surveyMode: false, cellar: false,
  rain: 0.45, tod: 0.55,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.noiseG = makeNoise2D(1337);
    this.noiseC = makeNoise2D(777);
    this.cloudN = makeNoise1D(5150);
    this.buildFacePool(9000);
    this.buildCondensation(1400);
    this.buildRain(620);
    this.resize();
  },

  qualityProfile() {
    switch (this.quality) {
      case 'low':   return { dpr: 1,    dust: 900,  cond: 380,  rain: 180, lod: 4.5, far: 1700, radarN: 48 };
      case 'med':   return { dpr: 1.25, dust: 1700, cond: 700,  rain: 320, lod: 3.0, far: 2100, radarN: 60 };
      case 'ultra': return { dpr: 2.5,  dust: 3600, cond: 1400, rain: 620, lod: 1.2, far: 3000, radarN: 92 };
      default:      return { dpr: 2,    dust: 2600, cond: 1000, rain: 460, lod: 2.0, far: 2600, radarN: 72 };
    }
  },

  resize() {
    const p = this.qualityProfile();
    this.dpr = Math.min(window.devicePixelRatio || 1, p.dpr);
    this.FAR = p.far;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
  },

  /* ---------------------------------------------------------
     Pools
     --------------------------------------------------------- */
  buildFacePool(n) {
    this.pool = new Array(n);
    this.pts = new Float64Array(n * 24);
    for (let i = 0; i < n; i++) this.pool[i] = { d: 0, n: 0, off: i * 24, col: '#000' };
    this.active = [];
  },

  buildCondensation(n) {
    this.cond = new Array(n);
    for (let i = 0; i < n; i++) {
      this.cond[i] = {
        h: Math.pow(Math.random(), 0.9),
        a: rnd(TAU),
        rf: rnd(0.68, 1.28),                // a fuzzy sheath, not a thin rim
        s: rnd(0.5, 1.9),
        al: rnd(0.06, 0.26)
      };
    }
  },

  buildRain(n) {
    this.drops = new Array(n);
    for (let i = 0; i < n; i++) {
      this.drops[i] = { x: Math.random(), y: Math.random(), l: rnd(9, 30), v: rnd(0.55, 1.5), a: rnd(0.06, 0.24) };
    }
  },

  /* ---------------------------------------------------------
     Mood: sky, haze and sun position
     --------------------------------------------------------- */
  mood(tod, ef) {
    const stops = [
      { t: 0.0,  top: [26, 34, 56],  hor: [214, 138, 90],  fog: [176, 148, 128], sunE: 0.12, sunA: 1.7, amb: 0.42 },
      { t: 0.35, top: [45, 62, 84],  hor: [188, 186, 168], fog: [180, 182, 172], sunE: 0.55, sunA: 2.4, amb: 0.5 },
      { t: 0.6,  top: [43, 58, 73],  hor: [174, 172, 152], fog: [168, 172, 164], sunE: 0.8,  sunA: 3.1, amb: 0.52 },
      { t: 0.85, top: [30, 38, 58],  hor: [196, 124, 74],  fog: [162, 132, 112], sunE: 0.3,  sunA: 4.0, amb: 0.44 },
      { t: 1.0,  top: [16, 21, 36],  hor: [138, 82, 62],   fog: [116, 96, 90],   sunE: 0.08, sunA: 4.4, amb: 0.36 }
    ];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (tod >= stops[i].t && tod <= stops[i + 1].t) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const u = a === b ? 0 : clamp((tod - a.t) / (b.t - a.t), 0, 1);
    const mix = (k) => [
      lerp(a[k][0], b[k][0], u) | 0,
      lerp(a[k][1], b[k][1], u) | 0,
      lerp(a[k][2], b[k][2], u) | 0
    ];
    const top = mix('top'), hor = mix('hor'), fog = mix('fog');

    /* Strong storms darken everything and push the famous green cast
       into the light behind the precipitation core. */
    const g = clamp(ef / 5, 0, 1) * 0.6;
    const green = [96, 112, 72];
    for (let i = 0; i < 3; i++) {
      top[i] = lerp(top[i], green[i] * 0.5, g * 0.55) | 0;
      hor[i] = lerp(hor[i], green[i], g * 0.5) | 0;
      fog[i] = lerp(fog[i], green[i] * 1.15, g * 0.42) | 0;
    }

    const sunE = lerp(a.sunE, b.sunE, u), sunA = lerp(a.sunA, b.sunA, u);
    const amb = lerp(a.amb, b.amb, u) * (1 - g * 0.3);
    return {
      top, hor, fog,
      amb,
      lx: Math.cos(sunA) * Math.cos(sunE),
      ly: Math.sin(sunE),
      lz: Math.sin(sunA) * Math.cos(sunE)
    };
  },

  fogAt(depth) {
    return smoothstep(this.FOG_NEAR, this.FAR, depth) * 0.94;
  },

  /* ---------------------------------------------------------
     Per-frame effect bookkeeping, shared with the WebGL path so
     lightning, flash and camera shake behave identically in both.
     --------------------------------------------------------- */
  tickEffects(dt, t) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 5.5);
    if (this.lightning) {
      this.nextBolt -= dt * (0.5 + t.ef * 0.28);
      if (this.nextBolt <= 0) {
        this.nextBolt = rnd(1.4, 6);
        this.flash = rnd(0.35, 1);
        this.makeBolt();
      }
    }
    if (this.bolt) { this.bolt.age += dt; if (this.bolt.age > 0.16) this.bolt = null; }

    const camDist = Math.hypot(Camera.x - t.x, Camera.z - t.z);
    const prox = clamp(1 - camDist / 500, 0, 1) * t.lifeScale * clamp(t.peakWind / 90, 0, 1);
    this.shake = prox * 3.4;
  },

  /* ---------------------------------------------------------
     Frame
     --------------------------------------------------------- */
  draw(sim, dt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const t = sim.tor;

    const M = this.mood(this.tod, t.ef);
    this.M = M;
    Pal.setFog(M.fog);
    this.tickEffects(dt, t);
    const shx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, shx * this.dpr, shy * this.dpr);

    Camera.update(W, H);
    this.horizonY = Camera.cy + Camera.focal * (Camera._sP / Camera._cP);

    this.drawSky(ctx, M, t);
    this.drawGround(ctx, sim, M);
    if (this.showGrid) this.drawSurveyGrid(ctx, t);
    if (this.showPath) this.drawDamagePath(ctx, sim);

    /* Survey mode is the morning after: the storm is gone, and only what
       it left on the ground is drawn. */
    const survey = this.surveyMode;

    /* Collect and sort every mesh face in the scene. */
    this.active.length = 0;
    this.faceN = 0;
    const lod = this.qualityProfile().lod;
    for (const p of sim.props) {
      if (survey && p.dyn) continue;      // nothing is still in the air afterwards
      this.collectProp(p, M, lod);
    }
    this.active.sort(cmpDepth);

    // Depth of the funnel's ground point decides where the town splits.
    const cbuf = _cbuf;
    Camera.toCam(t.x, 0, t.z, cbuf);
    const torDepth = cbuf[2];

    let i = 0;
    const A = this.active;
    for (; i < A.length; i++) {
      if (A[i].d <= torDepth) break;
      this.paintFace(ctx, A[i]);
    }

    if (!survey) {
      this.drawDust(ctx, sim, t, true);
      this.drawCondensation(ctx, t, true);
      this.drawFunnel(ctx, t);
      this.drawCondensation(ctx, t, false);
      this.drawDust(ctx, sim, t, false);
    }

    for (; i < A.length; i++) this.paintFace(ctx, A[i]);

    if (!survey) {
      this.drawPuffs(ctx, sim);
      this.drawRain(ctx, t, dt);
    }

    if (this.cellar) this.drawCellar(ctx, sim, t);

    if (this.showWind) this.drawWindField(ctx, t);
    if (this.showAnatomy && !survey) this.drawAnatomy(ctx, t);
    if (!survey) this.drawShouts(ctx, sim);

    if (this.bolt) this.paintBolt(ctx);
    if (this.flash > 0.01) {
      ctx.fillStyle = 'rgba(226,238,255,' + (this.flash * 0.3).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    this.drawVignette(ctx);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  /* ---------------------------------------------------------
     Sky, storm deck, wall cloud
     --------------------------------------------------------- */
  drawSky(ctx, M, t) {
    const W = this.W, H = this.H;
    const hy = clamp(this.horizonY, -H, H * 2);
    /* An overcast deck is a plane above the camera, so it covers the entire
       sky down to the horizon: near parts high overhead, distant parts
       converging on the horizon line. That is what this gradient is — dark
       storm base above, with a thin bright slot at the horizon where the
       light gets in under the anvil. */
    const g = ctx.createLinearGradient(0, Math.min(0, hy - H * 1.1), 0, hy);
    g.addColorStop(0, rgb(M.top));
    g.addColorStop(0.55, rgb(mixc(M.top, M.hor, 0.22)));
    g.addColorStop(0.87, rgb(mixc(M.top, M.hor, 0.66)));
    g.addColorStop(1, rgb(M.hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, Math.max(0, hy) + 2);

    /* Overcast storm base. Wide, flat, heavily overlapping layers read as
       a continuous deck; discrete round puffs read as polka dots. */
    ctx.save();
    const drift = this.time * 6;

    /* Low-contrast texture so the deck isn't a flat wash. Kept faint on
       purpose: anything punchy here reads as separate clouds. */
    for (let i = 0; i < 14; i++) {
      const n1 = this.cloudN(i * 3.1 + drift * 0.008);
      const n2 = this.cloudN(i * 7.7 + 40);
      const cx = ((n1 * 2.4 - 0.7) * W + drift * (0.25 + n2 * 0.3)) % (W * 2.4) - W * 0.7;
      const cy = hy - H * 0.08 - n2 * H * 0.6;
      const rx = (0.55 + n2 * 0.6) * W;
      const ry = (0.05 + n1 * 0.09) * H;
      const dark = mixc(M.top, [12, 15, 22], 0.4 + n1 * 0.3);
      const ds = 'rgba(' + dark[0] + ',' + dark[1] + ',' + dark[2] + ',';
      softBlob(ctx, cx, cy, rx, ry, [
        [0, ds + (0.1 + n1 * 0.09).toFixed(2) + ')'], [1, ds + '0)']
      ]);
    }
    ctx.restore();

    /* Wall cloud: the lowered, rotating base the funnel hangs from. */
    Camera.toCam(t.x, t.cloudBase, t.z, _cbuf);
    if (_cbuf[2] > Camera.near) {
      const sx = Camera.projX(_cbuf[0], _cbuf[2]);
      const sy = Camera.projY(_cbuf[1], _cbuf[2]);
      const sc = Camera.scaleAt(_cbuf[2]);
      /* A broad, ragged lowering of the storm base that the funnel hangs
         from — wide and flat, blended into the deck above it. */
      const rad = Math.min(t.radiusAt(t.cloudBase) * 5.5 * sc, this.W * 1.4);
      const fog = this.fogAt(_cbuf[2]);
      const c = mixc(mixc(M.top, [16, 19, 26], 0.45), M.fog, fog * 0.55);
      const cs = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',';
      ctx.save();

      // The main mass, sitting slightly above the funnel top.
      const my = sy - rad * 0.16;
      softBlob(ctx, sx, my, rad, rad * 0.3, [
        [0, cs + '0.6)'], [0.45, cs + '0.36)'], [1, cs + '0)']
      ]);

      // Ragged edges, rotating with the mesocyclone.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + this.time * 0.26 * t.spin;
        const n = this.cloudN(i * 5.3);
        const rr = rad * (0.24 + n * 0.22);
        softBlob(ctx, sx + Math.cos(a) * rad * 0.62, my + Math.sin(a) * rad * 0.13, rr, rr * 0.52, [
          [0, cs + (0.2 + n * 0.16).toFixed(2) + ')'], [1, cs + '0)']
        ]);
      }
      ctx.restore();
    }
  },

  /* ---------------------------------------------------------
     Ground: base fill under the horizon, then farm patchwork
     --------------------------------------------------------- */
  drawGround(ctx, sim, M) {
    const W = this.W, H = this.H;
    const hy = this.horizonY;
    if (hy > H) return;
    const top = Math.max(0, hy);

    const base = [72, 92, 58];
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, rgb(mixc(base, M.fog, 0.92)));
    g.addColorStop(0.22, rgb(mixc(base, M.fog, 0.55)));
    g.addColorStop(1, rgb(mixc(base, M.fog, 0.05)));
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);

    /* Field patchwork. Cells are stepped out from the camera along the
       view direction so distant rows stay cheap. */
    const CELL = 140;
    const cxr = Math.round(Camera.x / CELL), czr = Math.round(Camera.z / CELL);
    const span = Math.ceil(this.FAR / CELL);
    const q = [0, 0, 0];
    for (let iz = -span; iz <= span; iz++) {
      for (let ix = -span; ix <= span; ix++) {
        const gx = (cxr + ix) * CELL, gz = (czr + iz) * CELL;
        const dx = gx - Camera.x, dz = gz - Camera.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > this.FAR * this.FAR) continue;
        if (dx * Camera.fx + dz * Camera.fz < -CELL * 1.6) continue;   // behind us

        const n = this.noiseG(gx * 0.0031, gz * 0.0031);
        const n2 = this.noiseC(gx * 0.011, gz * 0.011);
        let col;
        if (n < 0.34) col = [104, 118, 62];
        else if (n < 0.52) col = [126, 132, 74];
        else if (n < 0.68) col = [88, 108, 56];
        else if (n < 0.84) col = [148, 138, 88];
        else col = [122, 100, 66];
        col = [
          clamp(col[0] * (0.9 + n2 * 0.2), 0, 255) | 0,
          clamp(col[1] * (0.9 + n2 * 0.2), 0, 255) | 0,
          clamp(col[2] * (0.9 + n2 * 0.2), 0, 255) | 0
        ];
        const h = CELL * 0.5;
        const depth = this.quad(ctx, gx - h, gz - h, gx + h, gz - h, gx + h, gz + h, gx - h, gz + h, null, q);
        if (depth < 0) continue;
        ctx.fillStyle = rgb(mixc(col, M.fog, this.fogAt(depth)));
        ctx.fill();
      }
    }

    /* Roads */
    for (const r of sim.roads) {
      const hw = r.w / 2, hl = r.len / 2;
      let ax, az, bx, bz, cx2, cz2, dx2, dz2;
      if (r.dir === 'z') {
        ax = r.x - hw; az = r.z - hl; bx = r.x + hw; bz = r.z - hl;
        cx2 = r.x + hw; cz2 = r.z + hl; dx2 = r.x - hw; dz2 = r.z + hl;
      } else {
        ax = r.x - hl; az = r.z - hw; bx = r.x + hl; bz = r.z - hw;
        cx2 = r.x + hl; cz2 = r.z + hw; dx2 = r.x - hl; dz2 = r.z + hw;
      }
      const depth = this.quad(ctx, ax, az, bx, bz, cx2, cz2, dx2, dz2, null, q);
      if (depth < 0) continue;
      ctx.fillStyle = rgb(mixc([62, 64, 70], M.fog, this.fogAt(depth)));
      ctx.fill();
    }

    /* Scour marks left by the circulation */
    ctx.save();
    const scars = sim.scars;
    for (let i = 0; i < scars.length; i++) {
      const s = scars[i];
      const dx = s.x - Camera.x, dz = s.z - Camera.z;
      if (dx * dx + dz * dz > 1600 * 1600) continue;
      const depth = this.quad(ctx, s.x - s.r, s.z - s.r, s.x + s.r, s.z - s.r,
                                   s.x + s.r, s.z + s.r, s.x - s.r, s.z + s.r, null, q);
      if (depth < 0) continue;
      ctx.globalAlpha = s.a * (1 - this.fogAt(depth));
      ctx.fillStyle = '#4a3b2c';
      ctx.fill();
    }
    ctx.restore();
  },

  /* Project a ground quad into a path. Returns depth, or -1 if it is
     entirely behind the near plane. Leaves the path current for filling. */
  quad(ctx, x1, z1, x2, z2, x3, z3, x4, z4, y, out) {
    const yy = y || 0;
    const b = _quadBuf;
    Camera.toCam(x1, yy, z1, out); b[0] = out[0]; b[1] = out[1]; b[2] = out[2];
    Camera.toCam(x2, yy, z2, out); b[3] = out[0]; b[4] = out[1]; b[5] = out[2];
    Camera.toCam(x3, yy, z3, out); b[6] = out[0]; b[7] = out[1]; b[8] = out[2];
    Camera.toCam(x4, yy, z4, out); b[9] = out[0]; b[10] = out[1]; b[11] = out[2];
    const n = clipNear(b, 4, Camera.near);
    if (n < 3) return -1;
    ctx.beginPath();
    let depth = 0;
    for (let i = 0; i < n; i++) {
      const cz = _clipOut[i * 3 + 2];
      const sx = Camera.projX(_clipOut[i * 3], cz);
      const sy = Camera.projY(_clipOut[i * 3 + 1], cz);
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      depth += cz;
    }
    ctx.closePath();
    return depth / n;
  },

  drawDamagePath(ctx, sim) {
    const tr = sim.tor.trail;
    if (tr.length < 2) return;
    const q = [0, 0, 0];
    ctx.save();
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len, pz = dx / len;
      const wa = a.w * 0.5, wb = b.w * 0.5;
      const depth = this.quad(ctx,
        a.x + px * wa, a.z + pz * wa, b.x + px * wb, b.z + pz * wb,
        b.x - px * wb, b.z - pz * wb, a.x - px * wa, a.z - pz * wa, null, q);
      if (depth < 0) continue;
      const f = this.fogAt(depth);
      ctx.globalAlpha = 0.5 * (1 - f * 0.8);
      ctx.fillStyle = '#5a4a35';
      ctx.fill();
    }
    ctx.restore();
  },

  drawSurveyGrid(ctx, t) {
    const q = [0, 0, 0];
    const S = 100, N = 9;
    const ox = Math.round(t.x / S) * S, oz = Math.round(t.z / S) * S;
    ctx.save();
    ctx.strokeStyle = 'rgba(79,216,232,0.30)';
    ctx.lineWidth = 1;
    for (let i = -N; i <= N; i++) {
      for (const axis of [0, 1]) {
        const a = axis === 0
          ? [ox + i * S, oz - N * S, ox + i * S, oz + N * S]
          : [ox - N * S, oz + i * S, ox + N * S, oz + i * S];
        const b = _quadBuf;
        Camera.toCam(a[0], 0.2, a[1], q); b[0] = q[0]; b[1] = q[1]; b[2] = q[2];
        Camera.toCam(a[2], 0.2, a[3], q); b[3] = q[0]; b[4] = q[1]; b[5] = q[2];
        if (b[2] <= Camera.near && b[5] <= Camera.near) continue;
        const n = clipNear(b, 2, Camera.near);
        if (n < 2) continue;
        ctx.beginPath();
        ctx.moveTo(Camera.projX(_clipOut[0], _clipOut[2]), Camera.projY(_clipOut[1], _clipOut[2]));
        ctx.lineTo(Camera.projX(_clipOut[3], _clipOut[5]), Camera.projY(_clipOut[4], _clipOut[5]));
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  /* ---------------------------------------------------------
     Mesh rasterisation
     --------------------------------------------------------- */
  collectProp(p, M, lodPx) {
    const mesh = p.mesh;
    if (!mesh) return;

    // Bounding-sphere reject.
    Camera.toCam(p.x, p.y + mesh.r * 0.4, p.z, _cbuf);
    const cz = _cbuf[2];
    if (cz < -mesh.r) return;
    if (cz > this.FAR + mesh.r) return;
    const scale = Camera.scaleAt(Math.max(cz, Camera.near));
    const rpx = mesh.r * scale;
    if (cz > Camera.near) {
      if (rpx < lodPx) return;
      const sx = Camera.projX(_cbuf[0], cz), sy = Camera.projY(_cbuf[1], cz);
      const pad = rpx + 40;
      if (sx < -pad || sx > this.W + pad || sy < -pad || sy > this.H + pad) return;
    }

    const m = eulerMat(p.yaw, p.pitch, p.roll, p.m);
    const v = mesh.v, nv = v.length / 3;
    const wb = _worldBuf, cb = _camBuf;
    if (nv * 3 > wb.length) return;

    for (let i = 0, k = 0; i < nv; i++, k += 3) {
      const x = v[k], y = v[k + 1], z = v[k + 2];
      const wx = m[0] * x + m[1] * y + m[2] * z + p.x;
      const wy = m[3] * x + m[4] * y + m[5] * z + p.y;
      const wz = m[6] * x + m[7] * y + m[8] * z + p.z;
      wb[k] = wx; wb[k + 1] = wy; wb[k + 2] = wz;
      Camera.toCam(wx, wy, wz, _cbuf);
      cb[k] = _cbuf[0]; cb[k + 1] = _cbuf[1]; cb[k + 2] = _cbuf[2];
    }

    const faces = mesh.f, fn = mesh.n;
    const fog = this.fogAt(Math.max(cz, 0));
    for (let fi = 0; fi < faces.length; fi++) {
      const f = faces[fi];
      const idx = f.i, n = idx.length;

      // Rotate the face normal and test which way it faces.
      const nx0 = fn[fi * 3], ny0 = fn[fi * 3 + 1], nz0 = fn[fi * 3 + 2];
      let nx = m[0] * nx0 + m[1] * ny0 + m[2] * nz0;
      let ny = m[3] * nx0 + m[4] * ny0 + m[5] * nz0;
      let nz = m[6] * nx0 + m[7] * ny0 + m[8] * nz0;

      const a0 = idx[0] * 3;
      const vx = wb[a0] - Camera.x, vy = wb[a0 + 1] - Camera.y, vz = wb[a0 + 2] - Camera.z;
      const facing = nx * vx + ny * vy + nz * vz;
      if (f.t) { if (facing > 0) { nx = -nx; ny = -ny; nz = -nz; } }
      else if (facing > 0) continue;                          // back face

      // Gather, clip, project.
      const b = _quadBuf;
      let anyFront = false;
      for (let i = 0; i < n; i++) {
        const s = idx[i] * 3;
        b[i * 3] = cb[s]; b[i * 3 + 1] = cb[s + 1]; b[i * 3 + 2] = cb[s + 2];
        if (cb[s + 2] > Camera.near) anyFront = true;
      }
      if (!anyFront) continue;
      const cn = clipNear(b, n, Camera.near);
      if (cn < 3) continue;

      const rec = this.pool[this.faceN];
      if (!rec) continue;
      let dsum = 0, m2 = Math.min(cn, 12);
      const off = rec.off;
      for (let i = 0; i < m2; i++) {
        const czz = _clipOut[i * 3 + 2];
        this.pts[off + i * 2] = Camera.projX(_clipOut[i * 3], czz);
        this.pts[off + i * 2 + 1] = Camera.projY(_clipOut[i * 3 + 1], czz);
        dsum += czz;
      }
      rec.n = m2;
      rec.d = dsum / m2;

      // Lambert term plus a sky-bounce fill so nothing goes pure black.
      const diff = Math.max(0, nx * M.lx + ny * M.ly + nz * M.lz);
      const sky = 0.5 + 0.5 * ny;
      const shade = M.amb * (0.55 + 0.45 * sky) + diff * (0.95 - M.amb * 0.4) + this.flash * 0.28;
      rec.col = Pal.str(f.c, shade, fog);

      this.active.push(rec);
      this.faceN++;
      if (this.faceN >= this.pool.length) return;
    }
  },

  paintFace(ctx, r) {
    const p = this.pts, o = r.off, n = r.n;
    ctx.beginPath();
    ctx.moveTo(p[o], p[o + 1]);
    for (let i = 1; i < n; i++) ctx.lineTo(p[o + i * 2], p[o + i * 2 + 1]);
    ctx.closePath();
    ctx.fillStyle = r.col;
    ctx.fill();
  },

  /* ---------------------------------------------------------
     The funnel
     --------------------------------------------------------- */
  drawFunnel(ctx, t) {
    if (t.lifeScale <= 0.02) return;

    // Debris cloud glow hugging the ground.
    Camera.toCam(t.x, 6, t.z, _cbuf);
    if (_cbuf[2] > Camera.near) {
      const sx = Camera.projX(_cbuf[0], _cbuf[2]);
      const sy = Camera.projY(_cbuf[1], _cbuf[2]);
      const sc = Camera.scaleAt(_cbuf[2]);
      const rr = t.radius * 3.6 * sc;
      softBlob(ctx, sx, sy - rr * 0.18, rr, rr * 0.52, [
        [0, 'rgba(120,98,72,0.5)'], [0.55, 'rgba(112,94,72,0.26)'], [1, 'rgba(112,94,72,0)']
      ]);
    }

    const shape = this.funnelShape(t, 1, 0);
    if (!shape) return;
    this.paintRibbon(ctx, shape, t, 1);

    /* Merge the top of the funnel into the cloud base. Without this the
       ribbon simply stops on a hard horizontal line. */
    const n = shape.L.length;
    const tlx = shape.L[n - 2], trx = shape.R[n - 2], tly = shape.L[n - 1];
    const tcx = (tlx + trx) * 0.5, tw = Math.abs(trx - tlx);
    if (tw > 2 && isFinite(tcx) && isFinite(tly)) {
      const m = this.M;
      const c = mixc(m.top, [16, 19, 26], 0.45);
      const cs = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',';
      const rr = tw * 2.2;
      softBlob(ctx, tcx, tly, rr, rr * 0.3, [
        [0, cs + '0.6)'], [0.35, cs + '0.32)'], [1, cs + '0)']
      ]);
    }

    // Suction vortices drawn on top so they read as separate whirls.
    for (let i = 0; i < t.subs.length; i++) {
      const s = t.subs[i];
      const sh = this.funnelShape(t, 0, s);
      if (sh) this.paintRibbon(ctx, sh, t, 0.62);
    }

    /* A second pass of the debris cloud, this time in FRONT of the funnel.
       Without it the ribbon ends on a hard flat edge at ground level; a real
       funnel disappears into the dirt it is throwing up. */
    Camera.toCam(t.x, 4, t.z, _cbuf);
    if (_cbuf[2] > Camera.near) {
      const sx = Camera.projX(_cbuf[0], _cbuf[2]);
      const sy = Camera.projY(_cbuf[1], _cbuf[2]);
      const sc = Camera.scaleAt(_cbuf[2]);
      const rr = t.radius * 4.2 * sc;
      softBlob(ctx, sx, sy - rr * 0.3, rr, rr * 0.58, [
        [0, 'rgba(132,112,88,0.62)'], [0.42, 'rgba(124,106,84,0.36)'], [1, 'rgba(116,100,78,0)']
      ]);
    }
  },

  /* Build a screen-space ribbon for the main funnel or a sub-vortex. */
  funnelShape(t, isMain, sub) {
    const N = 42;
    const H = t.cloudBase;
    const yBot = H * (1 - t.reach);
    const topY = isMain ? H : H * 0.46;
    if (topY <= yBot) return null;

    const L = [], R = [];
    const cen = { x: 0, z: 0 };
    let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;

    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const h = lerp(yBot, topY, s);
      t.centreAt(h, cen);
      let rad = t.radiusAt(h);
      let cxw = cen.x, czw = cen.z;

      if (sub) {
        const a = sub.phase + t.t * sub.rate * t.spin * (t.vmax * t.lifeScale / 90);
        const orb = t.radiusAt(h) * sub.orbit;
        cxw += Math.cos(a) * orb;
        czw += Math.sin(a) * orb;
        // Taper to a point near the top, otherwise each sub-vortex ends on a
        // flat cut and reads as a separate tornado standing alongside.
        rad = Math.max(1.2, t.radiusAt(h) * sub.size * (1 - 0.88 * s * s));
      }
      // A slow breathing ripple down the length of the funnel.
      rad *= 1 + 0.055 * Math.sin(h * 0.052 + t.t * 3.1);

      const lx = cxw - Camera.rx * rad, lz = czw - Camera.rz * rad;
      const rx = cxw + Camera.rx * rad, rz = czw + Camera.rz * rad;

      Camera.toCam(lx, h, lz, _cbuf);
      if (_cbuf[2] <= Camera.near) { if (i === 0) continue; else break; }
      const lsx = Camera.projX(_cbuf[0], _cbuf[2]), lsy = Camera.projY(_cbuf[1], _cbuf[2]);
      Camera.toCam(rx, h, rz, _cbuf);
      if (_cbuf[2] <= Camera.near) break;
      const rsx = Camera.projX(_cbuf[0], _cbuf[2]), rsy = Camera.projY(_cbuf[1], _cbuf[2]);

      L.push(lsx, lsy); R.push(rsx, rsy);
      if (lsy < minY) minY = lsy; if (lsy > maxY) maxY = lsy;
      if (rsy < minY) minY = rsy; if (rsy > maxY) maxY = rsy;
      if (lsx < minX) minX = lsx; if (rsx > maxX) maxX = rsx;
      if (rsx < minX) minX = rsx; if (lsx > maxX) maxX = lsx;
    }
    if (L.length < 6) return null;
    // Vertices grazing the near plane can project to huge or non-finite
    // coordinates; a gradient built from those throws.
    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) return null;
    if (maxX - minX > 1e5 || maxY - minY > 1e5) return null;
    return { L, R, minX, maxX, minY, maxY };
  },

  paintRibbon(ctx, sh, t, alpha) {
    const ctxPath = () => {
      ctx.beginPath();
      ctx.moveTo(sh.L[0], sh.L[1]);
      for (let i = 2; i < sh.L.length; i += 2) ctx.lineTo(sh.L[i], sh.L[i + 1]);
      for (let i = sh.R.length - 2; i >= 0; i -= 2) ctx.lineTo(sh.R[i], sh.R[i + 1]);
      ctx.closePath();
    };

    // Soft halo first, so the silhouette doesn't read as cut paper.
    const wpx = Math.max(8, sh.maxX - sh.minX);
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = 'rgba(198,206,218,0.13)';
    ctx.lineWidth = clamp(wpx * 0.16, 7, 30);
    ctxPath();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha * 0.93;
    ctxPath();
    ctx.clip();

    // Vertical tone: dirty at the ground, bright condensation at the top.
    const gv = ctx.createLinearGradient(0, sh.maxY, 0, sh.minY);
    gv.addColorStop(0, 'rgb(92,80,66)');
    gv.addColorStop(0.28, 'rgb(124,118,114)');
    gv.addColorStop(0.62, 'rgb(160,163,169)');
    gv.addColorStop(1, 'rgb(96,104,120)');   // darker up top, or it vanishes into the deck
    ctx.fillStyle = gv;
    ctx.fillRect(sh.minX - 4, sh.minY - 4, sh.maxX - sh.minX + 8, sh.maxY - sh.minY + 8);

    // Cylindrical shading across the width.
    const gh = ctx.createLinearGradient(sh.minX, 0, sh.maxX, 0);
    gh.addColorStop(0, 'rgba(16,20,26,0.62)');
    gh.addColorStop(0.30, 'rgba(255,255,255,0.14)');
    gh.addColorStop(0.52, 'rgba(255,255,255,0.02)');
    gh.addColorStop(0.78, 'rgba(16,20,26,0.34)');
    gh.addColorStop(1, 'rgba(12,16,22,0.72)');
    ctx.fillStyle = gh;
    ctx.fillRect(sh.minX - 4, sh.minY - 4, sh.maxX - sh.minX + 8, sh.maxY - sh.minY + 8);

    /* Helical streaks.
       Each streak is a strand of condensation wound around the funnel: at
       every sampled height it sits at centre + halfWidth*cos(angle), with
       the angle advancing with height (the twist) and with time (the spin).
       Strands on the near side of the axis are drawn brighter, which is what
       actually sells the rotation — horizontal banding just reads as a coil. */
    const N = sh.L.length / 2;
    const spin = this.time * 2.1 * t.spin;
    const strands = 18;
    ctx.lineWidth = clamp(wpx * 0.022, 1, 5);
    for (let k = 0; k < strands; k++) {
      const phase = (k / strands) * TAU + spin;
      // Varying the opacity per strand keeps them from reading as
      // regular stripes at close range.
      const av = 0.05 + 0.075 * this.cloudN(k * 13.7);
      let started = false, lastFront = 0;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const lx = sh.L[i * 2], ly = sh.L[i * 2 + 1];
        const rx = sh.R[i * 2], ry = sh.R[i * 2 + 1];
        const cx = (lx + rx) * 0.5, cy = (ly + ry) * 0.5;
        const hw = (rx - lx) * 0.5;
        const ang = phase + u * 15.5;           // the twist down the column
        const x = cx + hw * Math.cos(ang);
        const front = Math.sin(ang);
        // Break the stroke as a strand passes behind the funnel.
        if (front > 0 && lastFront <= 0) { ctx.moveTo(x, cy); started = true; }
        else if (front > 0 && started) ctx.lineTo(x, cy);
        lastFront = front;
      }
      ctx.strokeStyle = 'rgba(238,242,248,' + av.toFixed(3) + ')';
      ctx.stroke();
    }
    ctx.restore();

    // Soft rim so the funnel doesn't look like cut paper.
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = 'rgba(206,214,226,0.30)';
    ctx.lineWidth = 2.4;
    ctxPath();
    ctx.stroke();
    ctx.restore();
  },

  /* Condensation particles orbiting the funnel wall. `far` selects the
     half of the orbit currently behind the funnel body. */
  drawCondensation(ctx, t, far) {
    if (t.lifeScale <= 0.02) return;
    const prof = this.qualityProfile();
    const n = Math.min(this.cond.length, prof.cond);
    const H = t.cloudBase;
    const yBot = H * (1 - t.reach);
    const cen = { x: 0, z: 0 };
    const dt = 1 / 60;

    ctx.save();
    ctx.fillStyle = '#dfe4ea';
    for (let i = 0; i < n; i++) {
      const c = this.cond[i];
      const h = lerp(yBot, H, c.h);
      const rad = t.radiusAt(h) * c.rf;
      // Advance the orbit on the far pass only — this runs twice a frame.
      if (far) {
        const omega = (t.vmax * t.lifeScale) / Math.max(6, rad);
        c.a += omega * dt * t.spin * 0.55;
      }

      t.centreAt(h, cen);
      const px = cen.x + Math.cos(c.a) * rad;
      const pz = cen.z + Math.sin(c.a) * rad;

      // Is this particle on the near or far side of the funnel axis?
      const side = (px - cen.x) * Camera.fx + (pz - cen.z) * Camera.fz;
      if (far ? side < 0 : side >= 0) continue;

      Camera.toCam(px, h, pz, _cbuf);
      if (_cbuf[2] <= Camera.near) continue;
      const sx = Camera.projX(_cbuf[0], _cbuf[2]);
      const sy = Camera.projY(_cbuf[1], _cbuf[2]);
      const sc = Camera.scaleAt(_cbuf[2]);
      // Kept deliberately small: these are a soft fringe that breaks up the
      // funnel's silhouette, not the funnel itself.
      const r = c.s * sc * (0.7 + 1.5 * (h / H));
      if (r < 0.35) continue;
      ctx.globalAlpha = c.al * (far ? 0.5 : 1) * (1 - this.fogAt(_cbuf[2]) * 0.6) * t.lifeScale;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.min(r, 13), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  drawDust(ctx, sim, t, far) {
    const d = sim.dust;
    const tones = ['#7a6247', '#8f7657', '#5f5344'];
    ctx.save();
    let cur = -1;
    for (let i = 0; i < d.length; i++) {
      const p = d[i];
      const side = (p.x - t.x) * Camera.fx + (p.z - t.z) * Camera.fz;
      if (far ? side < 0 : side >= 0) continue;
      Camera.toCam(p.x, p.y, p.z, _cbuf);
      if (_cbuf[2] <= Camera.near || _cbuf[2] > this.FAR) continue;
      const sc = Camera.scaleAt(_cbuf[2]);
      const r = p.s * sc * 1.9;
      if (r < 0.3) continue;
      const sx = Camera.projX(_cbuf[0], _cbuf[2]);
      const sy = Camera.projY(_cbuf[1], _cbuf[2]);
      if (sx < -60 || sx > this.W + 60 || sy < -60 || sy > this.H + 60) continue;
      if (cur !== p.tone) { cur = p.tone; ctx.fillStyle = tones[p.tone]; }
      // Most debris never gets near cloud base — fade it out with height so
      // the column stays a ground-hugging debris cloud.
      const hf = clamp(1 - p.y / (t.cloudBase * 0.5), 0.06, 1);
      ctx.globalAlpha = p.a * hf * (far ? 0.55 : 0.85) * (1 - this.fogAt(_cbuf[2]) * 0.7);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.min(r, 12), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  drawPuffs(ctx, sim) {
    const p = sim.puffs;
    ctx.save();
    ctx.fillStyle = '#a08f77';
    for (let i = 0; i < p.length; i++) {
      const q = p[i];
      Camera.toCam(q.x, q.y, q.z, _cbuf);
      if (_cbuf[2] <= Camera.near) continue;
      const sc = Camera.scaleAt(_cbuf[2]);
      const r = q.s * sc * 2;
      if (r < 0.4) continue;
      ctx.globalAlpha = clamp(1 - q.age / q.life, 0, 1) * 0.45;
      ctx.beginPath();
      ctx.arc(Camera.projX(_cbuf[0], _cbuf[2]), Camera.projY(_cbuf[1], _cbuf[2]), Math.min(r, 60), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  drawRain(ctx, t, dt) {
    if (this.rain <= 0.01) return;
    const prof = this.qualityProfile();
    const n = Math.min(this.drops.length, Math.round(prof.rain * this.rain));
    const W = this.W, H = this.H;
    const slant = 0.24 + t.fwdSpeed * 0.012 + t.peakWind * 0.0025;
    ctx.save();
    ctx.strokeStyle = 'rgba(196,212,224,0.5)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const d = this.drops[i];
      d.y += d.v * dt * 1.9;
      d.x += d.v * dt * slant * 0.5;
      if (d.y > 1) { d.y -= 1.05; d.x = Math.random(); }
      if (d.x > 1.05) d.x -= 1.1;
      const x = d.x * W, y = d.y * H;
      ctx.moveTo(x, y);
      ctx.lineTo(x + d.l * slant, y + d.l);
    }
    ctx.globalAlpha = clamp(this.rain, 0, 1) * 0.7;
    ctx.stroke();
    ctx.restore();
  },

  /* ---------------------------------------------------------
     Overlays
     --------------------------------------------------------- */
  drawWindField(ctx, t) {
    ctx.save();
    ctx.lineWidth = 1.6;
    const rings = 7, spokes = 20;
    for (let ri = 1; ri <= rings; ri++) {
      const r = t.radius * (0.5 + ri * 0.85);
      for (let si = 0; si < spokes; si++) {
        const a = (si / spokes) * TAU;
        const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
        t.windAt(x, 6, z, _wind);
        const sp = Math.hypot(_wind.x, _wind.z);
        if (sp < 3) continue;
        const L = clamp(sp * 0.6, 4, 42);
        const ux = _wind.x / sp, uz = _wind.z / sp;

        Camera.toCam(x, 6, z, _cbuf);
        if (_cbuf[2] <= Camera.near || _cbuf[2] > 2200) continue;
        const ax = Camera.projX(_cbuf[0], _cbuf[2]), ay = Camera.projY(_cbuf[1], _cbuf[2]);
        Camera.toCam(x + ux * L, 6, z + uz * L, _cbuf);
        if (_cbuf[2] <= Camera.near) continue;
        const bx = Camera.projX(_cbuf[0], _cbuf[2]), by = Camera.projY(_cbuf[1], _cbuf[2]);

        const hue = clamp(sp / 95, 0, 1);
        ctx.strokeStyle = 'rgba(' + (90 + hue * 165 | 0) + ',' + (220 - hue * 130 | 0) + ',' + (232 - hue * 130 | 0) + ',0.85)';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        const ang = Math.atan2(by - ay, bx - ax);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(ang - 0.45) * 5, by - Math.sin(ang - 0.45) * 5);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(ang + 0.45) * 5, by - Math.sin(ang + 0.45) * 5);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  drawAnatomy(ctx, t) {
    const R0 = t.radiusAt(0), Rm = t.radiusAt(t.cloudBase * 0.5);
    const items = [
      { p: [t.x, t.cloudBase * 1.06, t.z], dx: 30, dy: -46, ttl: 'Wall cloud', sub: 'lowered, rotating storm base' },
      { p: [t.x + Rm * 1.15, t.cloudBase * 0.52, t.z], dx: 86, dy: -14, ttl: 'Condensation funnel', sub: 'low pressure makes vapour visible' },
      { p: [t.x - R0 * 2.4, 22, t.z], dx: -96, dy: -30, ttl: 'Debris cloud', sub: 'the part that does the damage' },
      { p: [t.x - R0 * 6.5, 8, t.z], dx: -104, dy: 34, ttl: 'Inflow', sub: 'air spiralling in near the ground' },
      { p: [t.x, t.cloudBase * 0.8, t.z], dx: -74, dy: -8, ttl: 'Updraft', sub: 'lifts at the funnel wall' },
      { p: [t.x - t.vx * 12, 2, t.z - t.vz * 12], dx: 60, dy: 44, ttl: 'Damage path', sub: 'the track surveyors walk' }
    ];
    ctx.save();
    ctx.font = '600 12px ' + FONT;
    for (const it of items) {
      Camera.toCam(it.p[0], it.p[1], it.p[2], _cbuf);
      if (_cbuf[2] <= Camera.near) continue;
      const ax = Camera.projX(_cbuf[0], _cbuf[2]), ay = Camera.projY(_cbuf[1], _cbuf[2]);
      if (ax < -200 || ax > this.W + 200 || ay < -200 || ay > this.H + 200) continue;
      const bx = ax + it.dx, by = ay + it.dy;

      ctx.strokeStyle = 'rgba(79,216,232,0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = 'rgba(79,216,232,0.95)';
      ctx.beginPath();
      ctx.arc(ax, ay, 3, 0, TAU);
      ctx.fill();

      const w1 = ctx.measureText(it.ttl).width;
      ctx.font = '500 10.5px ' + FONT;
      const w2 = ctx.measureText(it.sub).width;
      ctx.font = '600 12px ' + FONT;
      const w = Math.max(w1, w2) + 18;
      const left = it.dx < 0 ? bx - w : bx;
      roundRect(ctx, left, by - 17, w, 34, 7);
      ctx.fillStyle = 'rgba(10,16,24,0.82)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(79,216,232,0.36)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#e8eef6';
      ctx.fillText(it.ttl, left + 9, by - 3);
      ctx.font = '500 10.5px ' + FONT;
      ctx.fillStyle = '#93a3b8';
      ctx.fillText(it.sub, left + 9, by + 11);
      ctx.font = '600 12px ' + FONT;
    }
    ctx.restore();
  },

  drawShouts(ctx, sim) {
    ctx.save();
    ctx.font = '800 15px ' + FONT;
    ctx.textAlign = 'center';
    for (const s of sim.shouts) {
      const p = s.p;
      Camera.toCam(p.x, p.y + 3, p.z, _cbuf);
      if (_cbuf[2] <= Camera.near) continue;
      const sx = Camera.projX(_cbuf[0], _cbuf[2]);
      const sy = Camera.projY(_cbuf[1], _cbuf[2]) - 14 - s.age * 12;
      const a = clamp(1 - s.age / s.life, 0, 1);
      ctx.globalAlpha = a;
      const w = ctx.measureText(s.text).width + 20;
      roundRect(ctx, sx - w / 2, sy - 15, w, 24, 12);
      ctx.fillStyle = 'rgba(255,182,72,0.94)';
      ctx.fill();
      ctx.fillStyle = '#20160a';
      ctx.fillText(s.text, sx, sy + 2);
    }
    ctx.restore();
  },

  makeBolt() {
    const x = rnd(this.W * 0.1, this.W * 0.9);
    const pts = [[x, -20]];
    let cx = x, cy = -20;
    const endY = this.horizonY - rnd(20, 140);
    while (cy < endY) {
      cy += rnd(18, 46);
      cx += rnd(-34, 34);
      pts.push([cx, cy]);
    }
    this.bolt = { pts, age: 0 };
  },

  paintBolt(ctx) {
    const b = this.bolt;
    const a = clamp(1 - b.age / 0.16, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(226,240,255,0.95)';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(180,214,255,0.9)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(b.pts[0][0], b.pts[0][1]);
    for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
    ctx.stroke();
    ctx.restore();
  },

  /*
     Storm cellar: you are under the door, looking out through the gap
     between the boards. Everything but a thin slit is timber, the slit
     narrows as the tornado bears down, and dust shakes loose overhead.
  */
  drawCellar(ctx, sim, t) {
    const W = this.W, H = this.H;
    const d = Math.hypot(Camera.x - t.x, Camera.z - t.z);
    const near = clamp(1 - d / 900, 0, 1) * t.lifeScale;

    // The gap closes as it gets close — partly the door flexing, mostly
    // because you would not be sitting there watching.
    const gap = lerp(H * 0.24, H * 0.075, near);
    const cy = H * 0.44;
    const top = cy - gap * 0.5, bot = cy + gap * 0.5;

    ctx.save();
    // Timber above and below the gap.
    const wood = ctx.createLinearGradient(0, 0, 0, H);
    wood.addColorStop(0, '#0a0806');
    wood.addColorStop(0.5, '#171009');
    wood.addColorStop(1, '#080605');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, W, top);
    ctx.fillRect(0, bot, W, H - bot);

    // Plank seams, and a rim of light leaking round the edges of the gap.
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = 0; y < top; y += 34) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    for (let y = bot + 34; y < H; y += 34) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    const glow = ctx.createLinearGradient(0, top - 26, 0, top);
    glow.addColorStop(0, 'rgba(150,150,140,0)');
    glow.addColorStop(1, 'rgba(190,188,170,0.22)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, top - 26, W, 26);
    const glow2 = ctx.createLinearGradient(0, bot, 0, bot + 26);
    glow2.addColorStop(0, 'rgba(190,188,170,0.22)');
    glow2.addColorStop(1, 'rgba(150,150,140,0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, bot, W, 26);

    // Dust shaken loose from the boards, heavier the closer it gets.
    const n = (18 + near * 90) | 0;
    ctx.fillStyle = 'rgba(196,184,158,0.5)';
    for (let i = 0; i < n; i++) {
      const s = (i * 97.13 + this.time * (26 + near * 150)) % (H + 40);
      const x = (i * 137.51) % W;
      ctx.globalAlpha = 0.1 + 0.35 * ((i * 31) % 7) / 7;
      ctx.fillRect(x, s - 20, 1.4, 3 + near * 5);
    }
    ctx.globalAlpha = 1;

    // Darken everything as it passes directly overhead.
    if (near > 0.55) {
      ctx.fillStyle = 'rgba(0,0,0,' + ((near - 0.55) * 1.5).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  },

  drawVignette(ctx) {
    const W = this.W, H = this.H;
    if (!this._vig || this._vigW !== W || this._vigH !== H) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.44)');
      this._vig = g; this._vigW = W; this._vigH = H;
    }
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, W, H);
  }
};

/* ---------- shared scratch buffers ---------- */
const _cbuf = new Float64Array(3);
const _quadBuf = new Float64Array(64);
const _worldBuf = new Float32Array(3 * 900);
const _camBuf = new Float64Array(3 * 900);
const _wind = { x: 0, y: 0, z: 0 };
const FONT = '"Inter","Segoe UI",system-ui,sans-serif';

/*
   Soft flattened blob.
   Filling an ellipse with a radial gradient leaves a hard edge: the gradient
   is circular, so along the short axis it is cut off while still opaque.
   Scaling the canvas instead flattens the gradient and the shape together,
   so the falloff always reaches zero exactly at the boundary.
*/
function softBlob(ctx, x, y, rx, ry, stops) {
  if (!(rx > 0.5) || !(ry > 0.01) || !isFinite(x) || !isFinite(y)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function cmpDepth(a, b) { return b.d - a.d; }
function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
function mixc(a, b, t) {
  return [
    (lerp(a[0], b[0], t) + 0.5) | 0,
    (lerp(a[1], b[1], t) + 0.5) | 0,
    (lerp(a[2], b[2], t) + 0.5) | 0
  ];
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
