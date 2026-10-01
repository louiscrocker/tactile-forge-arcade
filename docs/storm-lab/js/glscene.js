/* ============================================================
   glscene.js — the WebGL2 scene renderer
   ============================================================
   Pipeline per frame:

     1  shadow pass    depth-only, from the sun, into a 2048 map
     2  sky            fullscreen procedural gradient + storm deck
     3  opaque         terrain and props, lit + shadowed, into an
                       offscreen colour buffer with a depth texture
     4  funnel         fullscreen raymarch through the vortex
                       volume, stopped by the scene depth so the
                       town occludes it correctly
     5  particles      instanced billboards, depth-tested
     6  post           bright-pass, blur, composite, vignette

   The depth buffer does the work the software renderer had to do
   by hand: no painter's algorithm, no per-frame face sort, no
   near-plane clipping, no splitting the scene at the funnel.
   ============================================================ */
'use strict';

const GLScene = {
  ok: false,
  gl: null,
  time: 0,
  quality: 'high',

  SHADOW: 2048,
  GROUND_SPAN: 8000,           // the inner, texture-mapped tier
  GROUND_TEX: 2048,

  /* ---------------------------------------------------------
     Setup
     --------------------------------------------------------- */
  init(canvas) {
    const gl = GLX.init(canvas);
    if (!gl) { this.fail = GLX.lastError; return false; }
    this.gl = gl;
    this.canvas = canvas;

    try {
      this.buildPrograms();
      this.buildGeometry();
      this.buildNoise();
      this.buildTargets();
    } catch (e) {
      this.fail = e.message;
      return false;
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.02, 0.03, 0.05, 1);
    this.props = new Map();       // Prop -> {vao, buf, count, stamp}
    this.ok = true;
    return true;
  },

  qualityProfile() {
    switch (this.quality) {
      case 'low':   return { dpr: 1,    dust: 4000,  steps: 28, cloud: 20, shadow: 1024, bloom: false, far: 6000,  veg: 5000 };
      case 'med':   return { dpr: 1.25, dust: 9000,  steps: 40, cloud: 30, shadow: 1024, bloom: true,  far: 7000,  veg: 14000 };
      case 'ultra': return { dpr: 2,    dust: 26000, steps: 96, cloud: 60, shadow: 2048, bloom: true,  far: 9000,  veg: 60000 };
      default:      return { dpr: 1.6,  dust: 16000, steps: 64, cloud: 44, shadow: 2048, bloom: true,  far: 8000,  veg: 30000 };
    }
  },

  resize() {
    const p = this.qualityProfile();
    this.dpr = Math.min(window.devicePixelRatio || 1, p.dpr);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    const bw = Math.max(2, Math.round(this.W * this.dpr));
    const bh = Math.max(2, Math.round(this.H * this.dpr));
    this.canvas.width = bw;
    this.canvas.height = bh;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.bw = bw; this.bh = bh;
    if (this.scene) {
      GLX.resizeFbo(this.scene, bw, bh);
      GLX.resizeFbo(this.half, bw >> 1, bh >> 1);
      GLX.resizeFbo(this.blur, bw >> 1, bh >> 1);
      GLX.resizeFbo(this.cloud, Math.max(2, bw >> 2), Math.max(2, bh >> 2));
    }
  },

  /* ---------------------------------------------------------
     Geometry
     --------------------------------------------------------- */
  buildGeometry() {
    const gl = this.gl;

    // Fullscreen triangle, used by sky, funnel and post.
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    GLX.buffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    /* Terrain in two tiers. The inner one is fine and carries the baked
       field/road texture; the outer is coarse, coloured procedurally, and
       has the inner footprint cut out of it so they do not z-fight. */
    this.tierNear = this.buildTier(this.GROUND_SPAN, 232, 0);
    this.tierFar = this.buildTier(Terrain.SPAN * 0.94, 190, this.GROUND_SPAN * 0.5);
    this.buildTreeGeometry();

    // Instanced particle billboard.
    this.partVao = gl.createVertexArray();
    gl.bindVertexArray(this.partVao);
    GLX.buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.partBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    // instance: x,y,z, size, r,g,b, alpha
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(2, 1);
    this.partData = new Float32Array(26000 * 8);

    // Damage swath, rebuilt each frame from the storm's trail.
    this.swathVao = gl.createVertexArray();
    gl.bindVertexArray(this.swathVao);
    this.swathBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.swathBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
    this.swathData = new Float32Array(1400 * 4);

    gl.bindVertexArray(null);
  },


  /* One terrain tier: positions, texture coords and true surface normals,
     with an optional square hole in the middle for a finer tier to fill. */
  buildTier(span, N, holeHalf) {
    const gl = this.gl;
    const h = span / 2, T = this.GROUND_SPAN;
    const verts = new Float32Array((N + 1) * (N + 1) * 8);
    const nrm = [0, 1, 0];
    let k = 0;
    for (let j = 0; j <= N; j++) {
      const z = -h + (j / N) * span;
      for (let i = 0; i <= N; i++) {
        const x = -h + (i / N) * span;
        Terrain.normalAt(x, z, nrm);
        verts[k++] = x; verts[k++] = Terrain.heightAt(x, z); verts[k++] = z;
        verts[k++] = (x + T / 2) / T; verts[k++] = 1 - (z + T / 2) / T;
        verts[k++] = nrm[0]; verts[k++] = nrm[1]; verts[k++] = nrm[2];
      }
    }
    const idx = [];
    const cell = span / N;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (holeHalf > 0) {
          const cx = -h + (i + 0.5) * cell, cz = -h + (j + 0.5) * cell;
          // Leave the hole slightly small so there is no seam of bare sky.
          if (Math.abs(cx) < holeHalf - cell && Math.abs(cz) < holeHalf - cell) continue;
        }
        const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    GLX.buffer(verts);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20);
    GLX.buffer(new Uint32Array(idx), gl.ELEMENT_ARRAY_BUFFER);
    gl.bindVertexArray(null);
    return { vao, count: idx.length };
  },


  /* One canonical tree, instanced tens of thousands of times. Kept to about
     twenty triangles: at this instance count the triangle budget is the
     whole cost. */
  buildTreeGeometry() {
    const gl = this.gl;
    const m = new Mesh();
    m.cyl(0, 0, 0, 0.26, 2.6, 5, '#5b4433', null);
    m.cone(0, 1.9, 0, 2.0, 3.3, 6, '#3e7a44');
    m.cone(0, 4.1, 0, 1.4, 2.9, 6, '#4d8c4a');
    m.build();

    let tris = 0;
    for (const f of m.f) tris += f.i.length - 2;
    const data = new Float32Array(tris * 3 * 9);
    let k = 0;
    for (let fi = 0; fi < m.f.length; fi++) {
      const f = m.f[fi], rgb = Pal.rgb(f.c);
      const nx = m.n[fi * 3], ny = m.n[fi * 3 + 1], nz = m.n[fi * 3 + 2];
      for (let t = 1; t < f.i.length - 1; t++) {
        const tri = [f.i[0], f.i[t], f.i[t + 1]];
        for (let v = 0; v < 3; v++) {
          const o = tri[v] * 3;
          data[k++] = m.v[o]; data[k++] = m.v[o + 1]; data[k++] = m.v[o + 2];
          data[k++] = nx; data[k++] = ny; data[k++] = nz;
          data[k++] = rgb[0]; data[k++] = rgb[1]; data[k++] = rgb[2];
        }
      }
    }

    this.treeVao = gl.createVertexArray();
    gl.bindVertexArray(this.treeVao);
    GLX.buffer(data);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);

    this.treeInstBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.treeInstBuf);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(4, 1);
    gl.bindVertexArray(null);
    this.treeCount = tris * 3;
    this.treeInstances = 0;
  },

  /* Upload the instance array, or just the slice that changed. */
  syncVegetation() {
    const gl = this.gl;
    if (!Vegetation.data || !this.treeInstBuf) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.treeInstBuf);
    if (this.treeInstances !== Vegetation.count) {
      gl.bufferData(gl.ARRAY_BUFFER, Vegetation.data, gl.DYNAMIC_DRAW);
      this.treeInstances = Vegetation.count;
      Vegetation.clearDirty();
      return;
    }
    if (Vegetation.dirtyHi >= Vegetation.dirtyLo) {
      const S = Vegetation.STRIDE;
      const lo = Vegetation.dirtyLo, hi = Vegetation.dirtyHi;
      gl.bufferSubData(gl.ARRAY_BUFFER, lo * S * 4,
                       Vegetation.data.subarray(lo * S, (hi + 1) * S));
      Vegetation.clearDirty();
    }
  },

  /* A tileable 3D value-noise volume: the structure inside the funnel. */
  buildNoise() {
    const N = 64;
    const data = new Uint8Array(N * N * N);
    const rng = mulberry32(20260728);
    const lattice = new Float32Array(N * N * N);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rng();
    const at = (x, y, z) => lattice[((z & (N - 1)) * N + (y & (N - 1))) * N + (x & (N - 1))];

    // Three octaves, wrapping so the volume tiles seamlessly.
    for (let z = 0; z < N; z++) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          let v = 0, amp = 0.5, f = 1;
          for (let o = 0; o < 3; o++) {
            const fx = x * f / 1, fy = y * f / 1, fz = z * f / 1;
            const xi = Math.floor(fx), yi = Math.floor(fy), zi = Math.floor(fz);
            const tx = fx - xi, ty = fy - yi, tz = fz - zi;
            const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty), uz = tz * tz * (3 - 2 * tz);
            const c000 = at(xi, yi, zi), c100 = at(xi + 1, yi, zi);
            const c010 = at(xi, yi + 1, zi), c110 = at(xi + 1, yi + 1, zi);
            const c001 = at(xi, yi, zi + 1), c101 = at(xi + 1, yi, zi + 1);
            const c011 = at(xi, yi + 1, zi + 1), c111 = at(xi + 1, yi + 1, zi + 1);
            const x00 = c000 + (c100 - c000) * ux, x10 = c010 + (c110 - c010) * ux;
            const x01 = c001 + (c101 - c001) * ux, x11 = c011 + (c111 - c011) * ux;
            const y0 = x00 + (x10 - x00) * uy, y1 = x01 + (x11 - x01) * uy;
            v += (y0 + (y1 - y0) * uz) * amp;
            amp *= 0.5; f *= 2;
          }
          data[(z * N + y) * N + x] = Math.max(0, Math.min(255, (v * 255) | 0));
        }
      }
    }
    this.noiseTex = GLX.tex3D({ w: N, h: N, d: N, data });
  },

  buildTargets() {
    const gl = this.gl;
    this.resize();
    const p = this.qualityProfile();
    this.shadowFbo = GLX.fbo({ w: p.shadow, h: p.shadow, color: false, depth: true });
    this.scene = GLX.fbo({ w: this.bw, h: this.bh, depth: true });
    this.half = GLX.fbo({ w: this.bw >> 1, h: this.bh >> 1 });
    this.blur = GLX.fbo({ w: this.bw >> 1, h: this.bh >> 1 });
    // Cloud is very low frequency, so a quarter-res buffer costs a
    // sixteenth of full rate and upsamples without anyone noticing.
    this.cloud = GLX.fbo({ w: Math.max(2, this.bw >> 2), h: Math.max(2, this.bh >> 2) });
    gl.bindTexture(gl.TEXTURE_2D, this.scene.color);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  },

  /* ---------------------------------------------------------
     Ground texture: farm patchwork and roads, painted once
     --------------------------------------------------------- */
  bakeGround(sim) {
    const S = this.GROUND_TEX, span = this.GROUND_SPAN;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    const mPerPx = span / S;
    const toPx = (w) => (w + span / 2) / mPerPx;

    const nA = makeNoise2D(1337), nB = makeNoise2D(777);
    const CELL = 130, cells = Math.ceil(span / CELL);
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const wx = -span / 2 + i * CELL, wz = -span / 2 + j * CELL;
        const n = nA(wx * 0.0031, wz * 0.0031), n2 = nB(wx * 0.011, wz * 0.011);
        let col;
        if (n < 0.34) col = [104, 118, 62];
        else if (n < 0.52) col = [126, 132, 74];
        else if (n < 0.68) col = [88, 108, 56];
        else if (n < 0.84) col = [148, 138, 88];
        else col = [122, 100, 66];
        const k = 0.88 + n2 * 0.24;
        c.fillStyle = 'rgb(' + Math.min(255, col[0] * k | 0) + ',' +
                                Math.min(255, col[1] * k | 0) + ',' +
                                Math.min(255, col[2] * k | 0) + ')';
        // +1 px overlap so cell seams never show as grid lines.
        c.fillRect(toPx(wx), S - toPx(wz + CELL), CELL / mPerPx + 1, CELL / mPerPx + 1);

        /* No furrows baked in here. This texture is ~6 m per texel, so a
           one-pixel line is a six-metre-wide band 130 m long — which reads
           as a long shadow rather than ploughing. Field detail is done in
           the shader instead, where there is no texel budget. */
      }
    }

    for (const r of sim.roads) {
      c.fillStyle = '#41454b';
      const hw = r.w / 2 / mPerPx, hl = r.len / 2 / mPerPx;
      const cx = toPx(r.x), cy = S - toPx(r.z);
      if (r.dir === 'z') c.fillRect(cx - hw, cy - hl, hw * 2, hl * 2);
      else c.fillRect(cx - hl, cy - hw, hl * 2, hw * 2);
      c.strokeStyle = 'rgba(226,214,150,0.5)';
      c.setLineDash([6, 10]);
      c.lineWidth = 1.2;
      c.beginPath();
      if (r.dir === 'z') { c.moveTo(cx, cy - hl); c.lineTo(cx, cy + hl); }
      else { c.moveTo(cx - hl, cy); c.lineTo(cx + hl, cy); }
      c.stroke();
      c.setLineDash([]);
    }

    if (this.groundTex) this.gl.deleteTexture(this.groundTex);
    this.groundTex = GLX.tex2D({ image: cv, mipmap: true, wrap: this.gl.CLAMP_TO_EDGE });
  },

  /* ---------------------------------------------------------
     Prop buffers — one static VBO per prop, rebuilt on damage
     --------------------------------------------------------- */
  propBuffer(p) {
    const gl = this.gl;
    let e = this.props.get(p);
    if (e && e.mesh === p.mesh) return e;

    const mesh = p.mesh;
    if (!mesh || !mesh.v) return null;
    let tris = 0;
    for (const f of mesh.f) tris += f.i.length - 2;
    const data = new Float32Array(tris * 3 * 9);
    let k = 0;
    for (let fi = 0; fi < mesh.f.length; fi++) {
      const f = mesh.f[fi];
      const rgb = Pal.rgb(f.c);
      const nx = mesh.n[fi * 3], ny = mesh.n[fi * 3 + 1], nz = mesh.n[fi * 3 + 2];
      for (let t = 1; t < f.i.length - 1; t++) {
        const tri = [f.i[0], f.i[t], f.i[t + 1]];
        for (let v = 0; v < 3; v++) {
          const o = tri[v] * 3;
          data[k++] = mesh.v[o]; data[k++] = mesh.v[o + 1]; data[k++] = mesh.v[o + 2];
          data[k++] = nx; data[k++] = ny; data[k++] = nz;
          data[k++] = rgb[0]; data[k++] = rgb[1]; data[k++] = rgb[2];
        }
      }
    }

    if (e) { gl.deleteVertexArray(e.vao); gl.deleteBuffer(e.buf); }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = GLX.buffer(data);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
    gl.bindVertexArray(null);

    e = { vao, buf, count: tris * 3, mesh, mat: M4.create() };
    this.props.set(p, e);
    return e;
  },

  releaseProp(p) {
    const e = this.props.get(p);
    if (!e) return;
    this.gl.deleteVertexArray(e.vao);
    this.gl.deleteBuffer(e.buf);
    this.props.delete(p);
  }
};
