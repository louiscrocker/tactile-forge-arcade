/* ============================================================
   gldraw.js — the per-frame WebGL pipeline
   ============================================================ */
'use strict';

Object.assign(GLScene, {

  buildPrograms() {
    this.pSky    = GLX.program(SH.fsVert,     SH.skyFrag,    'sky');
    this.pCloud  = GLX.program(SH.fsVert,     SH.cloudFrag,  'cloud');
    this.pComp   = GLX.program(SH.fsVert,     SH.compositeFrag, 'composite');
    this.pShadow = GLX.program(SH.shadowVert, SH.shadowFrag, 'shadow');
    this.pMesh   = GLX.program(SH.meshVert,   SH.meshFrag,   'mesh');
    this.pGround = GLX.program(SH.groundVert, SH.groundFrag, 'ground');
    this.pSwath  = GLX.program(SH.swathVert,  SH.swathFrag,  'swath');
    this.pFunnel = GLX.program(SH.fsVert,     SH.funnelFrag, 'funnel');
    this.pPart   = GLX.program(SH.partVert,   SH.partFrag,   'particle');
    this.pTree   = GLX.program(SH.treeVert,   SH.treeFrag,   'tree');
    this.pBright = GLX.program(SH.fsVert,     SH.brightFrag, 'bright');
    this.pBlur   = GLX.program(SH.fsVert,     SH.blurFrag,   'blur');
    this.pPost   = GLX.program(SH.fsVert,     SH.postFrag,   'post');

    this.view = M4.create();
    this.proj = M4.create();
    this.vp = M4.create();
    this.invVP = M4.create();
    this.lightVP = M4.create();
    this.lightView = M4.create();
    this.lightProj = M4.create();
    this.model = M4.create();
    this.profile = new Float32Array(27);
  },

  /* ---------------------------------------------------------
     Camera and light matrices
     --------------------------------------------------------- */
  setupMatrices(t) {
    const p = this.qualityProfile();
    /* Resolve the orbit into a world position and basis. The software
       renderer used to do this inside its own draw(), so the GL path has to
       do it explicitly — without it the camera sits at the world origin. */
    Camera.update(this.W, this.H);

    this.near = 0.6;
    // Pull the far plane out when the camera backs off for a structure shot,
    // or the terrain clips away while the storm above it keeps rendering.
    this.far = Math.max(p.far, Camera.dist * 1.8);
    // Far enough to keep the view open, near enough that the terrain's own
    // edge is always buried in haze rather than showing as a hard rim.
    this.fogFar = clamp(Camera.dist * 2.8, 2600, 15000);
    /* Aerial perspective density. Tuned so ground twenty kilometres out is
       heavily hazed but still legible, rather than a flat wall of fog. */
    this.haze = 1 / 17000;
    const aspect = this.bw / Math.max(1, this.bh);
    M4.perspective(this.proj, Camera.fov, aspect, this.near, this.far);
    M4.lookAt(this.view,
      Camera.x, Camera.y, Camera.z,
      Camera.target.x, Camera.target.y, Camera.target.z,
      0, 1, 0);
    M4.mul(this.vp, this.proj, this.view);
    M4.invert(this.invVP, this.vp);

    /* Shadow frustum follows the camera target, sized to cover the visible
       town without wasting texel density on the whole 9 km terrain. */
    const M = this.M;
    let sx = M.lx, sy = M.ly, sz = M.lz;
    if (sy < 0.25) {                       // keep the sun off the horizon,
      sy = 0.25;                           // or shadows stretch to infinity
      const l = Math.hypot(sx, sz) || 1;
      const k = Math.sqrt(1 - sy * sy) / l;
      sx *= k; sz *= k;
    }
    this.sun = [sx, sy, sz];

    const cx = Camera.target.x, cz = Camera.target.z;
    const R = clamp(Camera.dist * 0.85 + 220, 400, 2200);
    this.shadowR = R;
    /* Keep the light's depth range tight around the scene. Shadow bias is
       expressed in normalised depth, so a loose range silently turns a
       half-metre bias into a dozen metres and every shadow disappears. */
    const D = R * 2.2 + 400;
    const zNear = Math.max(1, D - R * 1.9);
    const zFar = D + R * 1.9;
    this.shadowRange = zFar - zNear;
    M4.lookAt(this.lightView, cx + sx * D, sy * D, cz + sz * D, cx, 0, cz, 0, 1, 0);
    M4.ortho(this.lightProj, -R, R, -R, R, zNear, zFar);
    M4.mul(this.lightVP, this.lightProj, this.lightView);
  },

  /* ---------------------------------------------------------
     Frame
     --------------------------------------------------------- */
  draw(sim, dt) {
    const gl = this.gl;
    this.time += dt;
    const t = sim.tor;

    // Reuse the software renderer's mood model so both paths agree.
    const M = Render.mood(Render.tod, t.ef);
    this.M = M;
    this.flash = Render.flash;

    if (!this.groundTex || this.groundStamp !== sim.groundStamp) {
      this.bakeGround(sim);
      this.groundStamp = sim.groundStamp;
    }

    this.tor = t;
    this.stormStage = sim.stormStage;
    this.setupMatrices(t);
    const prof = this.qualityProfile();

    this.shadowPass(sim);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
    gl.viewport(0, 0, this.bw, this.bh);
    gl.clearColor(M.hor[0] / 255, M.hor[1] / 255, M.hor[2] / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.skyPass(t);
    this.cloudPass(sim, t, prof);
    this.groundPass();
    this.propPass(sim);
    this.treePass(sim, t);
    this.swathPass(sim);
    this.funnelPass(t, prof);
    this.particlePass(sim, t, prof);

    this.postPass(prof);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  },

  /* ---------------------------------------------------------
     Passes
     --------------------------------------------------------- */
  shadowPass(sim) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo.fb);
    gl.viewport(0, 0, this.shadowFbo.w, this.shadowFbo.h);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);          // front-face culling reduces peter-panning

    const P = GLX.use(this.pShadow);
    gl.uniformMatrix4fv(P.u.uLightVP, false, this.lightVP);

    const R = this.shadowR;
    const cx = Camera.target.x, cz = Camera.target.z;
    for (const p of sim.props) {
      if (Render.surveyMode && p.dyn) continue;
      const dx = p.x - cx, dz = p.z - cz;
      if (dx * dx + dz * dz > R * R) continue;
      const e = this.propBuffer(p);
      if (!e) continue;
      M4.fromEuler(this.model, p.yaw, p.pitch, p.roll, p.x, p.y, p.z);
      gl.uniformMatrix4fv(P.u.uModel, false, this.model);
      gl.bindVertexArray(e.vao);
      gl.drawArrays(gl.TRIANGLES, 0, e.count);
    }
    gl.cullFace(gl.BACK);
  },


  /* ---------------------------------------------------------
     Supercell: raymarched small, then composited over the sky
     --------------------------------------------------------- */
  cloudPass(sim, t, prof) {
    const gl = this.gl;
    const M = this.M;
    const stage = sim.stormStage;
    if (stage <= 0.01) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cloud.fb);
    gl.viewport(0, 0, this.cloud.w, this.cloud.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    const dx = Math.sin(t.heading), dz = Math.cos(t.heading);
    const P = GLX.use(this.pCloud);
    gl.uniformMatrix4fv(P.u.uInvVP, false, this.invVP);
    gl.uniform3f(P.u.uCam, Camera.x, Camera.y, Camera.z);
    gl.uniform3fv(P.u.uSun, this.sun);
    gl.uniform3f(P.u.uTop, M.top[0] / 255, M.top[1] / 255, M.top[2] / 255);
    gl.uniform3f(P.u.uHor, M.hor[0] / 255, M.hor[1] / 255, M.hor[2] / 255);
    gl.uniform2f(P.u.uStormXZ, t.x, t.z);
    gl.uniform2f(P.u.uDir, dx, dz);
    gl.uniform2f(P.u.uPerp, -dz, dx);
    gl.uniform1f(P.u.uBase, t.cloudBase);
    gl.uniform1f(P.u.uTopMul, 12.0);
    gl.uniform1f(P.u.uStage, stage);
    gl.uniform1f(P.u.uMeso, clamp(t.lifeScale * 1.2, 0, 1) * smoothstep(0.35, 0.7, stage));
    gl.uniform1f(P.u.uTime, this.time);
    gl.uniform1i(P.u.uSteps, prof.cloud);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this.noiseTex);
    gl.uniform1i(P.u.uNoise, 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Composite up into the scene buffer, under everything solid.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
    gl.viewport(0, 0, this.bw, this.bh);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);      // premultiplied
    const C = GLX.use(this.pComp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cloud.color);
    gl.uniform1i(C.u.uTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  },

  skyPass(t) {
    const gl = this.gl;
    const M = this.M;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    const P = GLX.use(this.pSky);
    gl.uniformMatrix4fv(P.u.uInvVP, false, this.invVP);
    gl.uniform3f(P.u.uCam, Camera.x, Camera.y, Camera.z);
    gl.uniform3f(P.u.uTop, M.top[0] / 255, M.top[1] / 255, M.top[2] / 255);
    gl.uniform3f(P.u.uHor, M.hor[0] / 255, M.hor[1] / 255, M.hor[2] / 255);
    gl.uniform3fv(P.u.uSun, this.sun);
    gl.uniform1f(P.u.uTime, this.time);
    gl.uniform1f(P.u.uCloudBase, t.cloudBase);
    gl.uniform2f(P.u.uTorXZ, t.x, t.z);
    gl.uniform1f(P.u.uWallR, t.radiusAt(t.cloudBase) * 3.0);
    gl.uniform1f(P.u.uLife, t.lifeScale);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this.noiseTex);
    gl.uniform1i(P.u.uNoise, 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },

  bindLighting(P) {
    const gl = this.gl, M = this.M;
    const amb = M.amb;
    const t = this.tor;
    gl.uniform2f(P.u.uStormXZ, t.x, t.z);
    gl.uniform1f(P.u.uStormR, t.cloudBase * 8.5);
    gl.uniform1f(P.u.uStormStage, this.stormStage);
    gl.uniform1f(P.u.uCloudBase, t.cloudBase);
    gl.uniform3fv(P.u.uSun, this.sun);
    gl.uniform3f(P.u.uSunCol, 1.05, 1.0, 0.92);
    gl.uniform3f(P.u.uAmbCol, amb * 0.95, amb, amb * 1.08);
    gl.uniform3f(P.u.uCam, Camera.x, Camera.y, Camera.z);
    gl.uniform3f(P.u.uFogCol, M.fog[0] / 255, M.fog[1] / 255, M.fog[2] / 255);
    gl.uniform1f(P.u.uFogNear, 240);
    gl.uniform1f(P.u.uFogFar, this.fogFar);
    gl.uniform1f(P.u.uHaze, this.haze);
    gl.uniform1f(P.u.uFlash, this.flash);
    gl.uniformMatrix4fv(P.u.uLightVP, false, this.lightVP);
    gl.uniform1f(P.u.uShadowTexel, 1 / this.shadowFbo.w);
    gl.uniform1f(P.u.uShadowBias, 0.55 / this.shadowRange);   // ~0.55 m
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowFbo.depth);
    gl.uniform1i(P.u.uShadow, 1);
  },

  groundPass() {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);

    const P = GLX.use(this.pGround);
    gl.uniformMatrix4fv(P.u.uVP, false, this.vp);
    this.bindLighting(P);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.groundTex);
    gl.uniform1i(P.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_3D, this.noiseTex);
    gl.uniform1i(P.u.uNoise, 2);

    // Coarse outer county first, then the textured tier over its cut-out.
    gl.uniform1f(P.u.uProcedural, 1);
    gl.bindVertexArray(this.tierFar.vao);
    gl.drawElements(gl.TRIANGLES, this.tierFar.count, gl.UNSIGNED_INT, 0);
    gl.uniform1f(P.u.uProcedural, 0);
    gl.bindVertexArray(this.tierNear.vao);
    gl.drawElements(gl.TRIANGLES, this.tierNear.count, gl.UNSIGNED_INT, 0);
  },

  propPass(sim) {
    const gl = this.gl;
    const P = GLX.use(this.pMesh);
    gl.uniformMatrix4fv(P.u.uVP, false, this.vp);
    this.bindLighting(P);

    const far = this.far, fx = Camera.fx, fz = Camera.fz;
    let drawn = 0;
    for (const p of sim.props) {
      if (Render.surveyMode && p.dyn) continue;
      const dx = p.x - Camera.x, dz = p.z - Camera.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > far * far) continue;
      const r = p.mesh ? p.mesh.r : 6;
      // Behind-camera reject; generous so tall things near the edge stay.
      if (dx * fx + dz * fz < -(r + 60)) continue;
      const e = this.propBuffer(p);
      if (!e) continue;
      M4.fromEuler(this.model, p.yaw, p.pitch, p.roll, p.x, p.y, p.z);
      gl.uniformMatrix4fv(P.u.uModel, false, this.model);
      gl.bindVertexArray(e.vao);
      gl.drawArrays(gl.TRIANGLES, 0, e.count);
      drawn++;
    }
    this.propsDrawn = drawn;
  },


  /* ---------------------------------------------------------
     Instanced vegetation
     --------------------------------------------------------- */
  treePass(sim, t) {
    const gl = this.gl;
    this.syncVegetation();
    if (!this.treeInstances) return;

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);

    const P = GLX.use(this.pTree);
    gl.uniformMatrix4fv(P.u.uVP, false, this.vp);
    gl.uniform2f(P.u.uTorXZ, t.x, t.z);
    // Scaled from the actual rotation so a stronger storm bends more country.
    gl.uniform1f(P.u.uTorPush, t.vmax * t.lifeScale * t.radius * 0.055);
    gl.uniform1f(P.u.uTorR, Math.max(20, t.radius));
    gl.uniform1f(P.u.uSpin, t.spin);
    gl.uniform1f(P.u.uTime, this.time);
    this.bindLighting(P);
    gl.bindVertexArray(this.treeVao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.treeCount, this.treeInstances);
  },

  swathPass(sim) {
    const gl = this.gl;
    const tr = sim.tor.trail;
    if (!Render.showPath || tr.length < 2) return;

    const data = this.swathData;
    let k = 0;
    const maxPts = Math.min(tr.length, 340);
    const start = tr.length - maxPts;
    for (let i = start; i < tr.length; i++) {
      const a = tr[i];
      const b = tr[Math.min(i + 1, tr.length - 1)];
      let dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len, pz = dx / len;
      const w = a.w * 0.5;
      const fade = 1;
      if (k + 8 > data.length) break;
      const lx = a.x + px * w, lz = a.z + pz * w;
      const rx = a.x - px * w, rz = a.z - pz * w;
      data[k++] = lx; data[k++] = Terrain.heightAt(lx, lz) + 0.35; data[k++] = lz; data[k++] = fade;
      data[k++] = rx; data[k++] = Terrain.heightAt(rx, rz) + 0.35; data[k++] = rz; data[k++] = fade;
    }
    const verts = k / 4;
    if (verts < 4) return;

    gl.bindVertexArray(this.swathVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.swathBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, k), gl.DYNAMIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    const P = GLX.use(this.pSwath);
    gl.uniformMatrix4fv(P.u.uVP, false, this.vp);
    gl.uniform3f(P.u.uCam, Camera.x, Camera.y, Camera.z);
    gl.uniform3fv(P.u.uSun, this.sun);
    gl.uniform1f(P.u.uHaze, this.haze);
    const M = this.M;
    gl.uniform3f(P.u.uFogCol, M.fog[0] / 255, M.fog[1] / 255, M.fog[2] / 255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, verts);

    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  },

  funnelPass(t, prof) {
    const gl = this.gl;
    if (t.lifeScale <= 0.02) return;

    // Sample the same centre/radius profile the simulation uses.
    const cen = { x: 0, z: 0 };
    const gy = Terrain.heightAt(t.x, t.z);
    const yBot = gy + (t.cloudBase - gy) * (1 - t.reach);
    let maxR = 0, maxOff = 0;
    for (let i = 0; i <= 8; i++) {
      const h = yBot + (t.cloudBase - yBot) * (i / 8);
      t.centreAt(h, cen);
      const r = t.radiusAt(h);
      this.profile[i * 3] = cen.x;
      this.profile[i * 3 + 1] = cen.z;
      this.profile[i * 3 + 2] = r;
      if (r > maxR) maxR = r;
      const off = Math.hypot(cen.x - t.x, cen.z - t.z);
      if (off > maxOff) maxOff = off;
    }

    // Detach depth before sampling it: reading a texture still attached to
    // the bound framebuffer is undefined behaviour.
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, null, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied
    gl.disable(gl.CULL_FACE);

    const P = GLX.use(this.pFunnel);
    gl.uniformMatrix4fv(P.u.uInvVP, false, this.invVP);
    gl.uniform3f(P.u.uCam, Camera.x, Camera.y, Camera.z);
    gl.uniform3f(P.u.uFwd, Camera.fwdX, Camera.fwdY, Camera.fwdZ);
    gl.uniform3fv(P.u.uSun, this.sun);
    gl.uniform3fv(P.u.uProfile, this.profile);
    gl.uniform2f(P.u.uBoundC, t.x, t.z);
    gl.uniform1f(P.u.uBoundR, maxR * 1.9 + maxOff + 30);
    gl.uniform1f(P.u.uCloudBase, t.cloudBase);
    gl.uniform1f(P.u.uYBot, yBot);
    gl.uniform1f(P.u.uTime, this.time);
    gl.uniform1f(P.u.uSpin, t.spin);
    gl.uniform1f(P.u.uVmax, t.vmax * t.lifeScale);
    gl.uniform1f(P.u.uLife, clamp(t.lifeScale, 0, 1));
    gl.uniform1f(P.u.uNear, this.near);
    gl.uniform1f(P.u.uFar, this.far);
    gl.uniform1f(P.u.uDensity, 0.055);
    gl.uniform1i(P.u.uSteps, prof.steps);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.depth);
    gl.uniform1i(P.u.uDepth, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.noiseTex);
    gl.uniform1i(P.u.uNoise, 1);

    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.scene.depth, 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
  },

  particlePass(sim, t, prof) {
    const gl = this.gl;
    if (Render.surveyMode) return;

    const data = this.partData;
    const cap = Math.min(prof.dust, (data.length / 8) | 0);
    let n = 0;

    const tones = [[0.44, 0.36, 0.26], [0.53, 0.44, 0.32], [0.34, 0.30, 0.24]];
    const dust = sim.dust;
    for (let i = 0; i < dust.length && n < cap; i++) {
      const p = dust[i];
      const hf = clamp(1 - p.y / (t.cloudBase * 0.55), 0.05, 1);
      const c = tones[p.tone];
      const o = n * 8;
      data[o] = p.x; data[o + 1] = p.y; data[o + 2] = p.z;
      data[o + 3] = p.s * 1.9;
      data[o + 4] = c[0]; data[o + 5] = c[1]; data[o + 6] = c[2];
      data[o + 7] = p.a * hf * 0.85;
      n++;
    }
    for (let i = 0; i < sim.puffs.length && n < cap; i++) {
      const q = sim.puffs[i];
      const o = n * 8;
      data[o] = q.x; data[o + 1] = q.y; data[o + 2] = q.z;
      data[o + 3] = q.s * 1.6;
      data[o + 4] = 0.60; data[o + 5] = 0.54; data[o + 6] = 0.44;
      data[o + 7] = clamp(1 - q.age / q.life, 0, 1) * 0.5;
      n++;
    }
    if (!n) return;

    gl.bindVertexArray(this.partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 8), gl.DYNAMIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);

    const P = GLX.use(this.pPart);
    gl.uniformMatrix4fv(P.u.uVP, false, this.vp);
    gl.uniform3f(P.u.uRight, Camera.rx, 0, Camera.rz);
    gl.uniform3f(P.u.uUp, Camera.upX, Camera.upY, Camera.upZ);
    gl.uniform3f(P.u.uCam, Camera.x, Camera.y, Camera.z);
    gl.uniform3fv(P.u.uSun, this.sun);
    gl.uniform1f(P.u.uHaze, this.haze);
    const M = this.M;
    gl.uniform3f(P.u.uFogCol, M.fog[0] / 255, M.fog[1] / 255, M.fog[2] / 255);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.partsDrawn = n;
  },

  postPass(prof) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.quadVao);

    let bloomTex = this.half.color;
    if (prof.bloom) {
      let P = GLX.use(this.pBright);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.half.fb);
      gl.viewport(0, 0, this.half.w, this.half.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.scene.color);
      gl.uniform1i(P.u.uTex, 0);
      gl.uniform1f(P.u.uThreshold, 0.88);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      P = GLX.use(this.pBlur);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blur.fb);
      gl.bindTexture(gl.TEXTURE_2D, this.half.color);
      gl.uniform1i(P.u.uTex, 0);
      gl.uniform2f(P.u.uDir, 1 / this.half.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.half.fb);
      gl.bindTexture(gl.TEXTURE_2D, this.blur.color);
      gl.uniform2f(P.u.uDir, 0, 1 / this.half.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      bloomTex = this.half.color;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.bw, this.bh);
    const P = GLX.use(this.pPost);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.color);
    gl.uniform1i(P.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomTex);
    gl.uniform1i(P.u.uBloom, 1);
    gl.uniform1f(P.u.uBloomAmt, prof.bloom ? 0.32 : 0.0);
    gl.uniform1f(P.u.uFlash, this.flash);
    gl.uniform1f(P.u.uVignette, 0.85);
    gl.uniform1f(P.u.uTime, this.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },

  /* Drop GPU buffers for props that no longer exist. */
  sweep(sim) {
    if (this.props.size < 900) return;
    const live = new Set(sim.props);
    for (const p of this.props.keys()) if (!live.has(p)) this.releaseProp(p);
  }
});
