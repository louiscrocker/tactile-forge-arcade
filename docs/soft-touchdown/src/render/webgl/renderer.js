// =====================================================
// Tactile Forge · WebGL2 back end  [SHARED across games — keep in sync]
//
// Renders the shared display list as a real vector tube: analytic beam
// falloff, phosphor persistence, and multi-level HDR bloom — none of which
// Canvas 2D can express. See shaders.js for the pipeline order.
// =====================================================

import {
  program, createTarget, deleteTarget, bindTarget,
  drawFullscreen, bindTexture, hexToRGB,
} from './glutil.js';
import {
  FULLSCREEN_VS, BEAM_VS, BEAM_FS, GLOW_VS, GLOW_FS, PERSIST_FS,
  BRIGHT_FS, BLUR_FS, COMPOSITE_FS, TEXT_FS,
} from './shaders.js';

// Floats per segment instance:
// p0.xy, p1.xy, colour.rgb, hot.rgb, core, glow, intensity
const STRIDE = 13;

// Floats per glow instance: center.xy, radii.xy, colour.rgb, alpha
const GLOW_STRIDE = 8;

// Phosphor time constant. Higher = longer trails.
const PERSIST_TAU = 0.055;

/** True when this browser can run the WebGL back end at all. */
export function isSupported() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

export class WebGLRenderer {
  static mode = 'webgl';
  static label = 'WebGL';

  constructor(canvas, { onContextLost } = {}) {
    this.mode = 'webgl';
    this.canvas = canvas;
    this.onContextLost = onContextLost;

    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;

    this._onLost = (e) => {
      e.preventDefault();
      this.lost = true;
      this.onContextLost?.();
    };
    canvas.addEventListener('webglcontextlost', this._onLost);
    this.lost = false;

    // Half-float targets give the bloom real headroom above 1.0. Without the
    // render-to-float extension we still work, just with less range.
    const canFloat = !!(gl.getExtension('EXT_color_buffer_float') ||
                        gl.getExtension('EXT_color_buffer_half_float'));
    this.hdr = canFloat;
    this.fmt = canFloat
      ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT }
      : { internal: gl.RGBA8,   type: gl.UNSIGNED_BYTE };

    this.beam      = program(gl, BEAM_VS, BEAM_FS);
    this.glow      = program(gl, GLOW_VS, GLOW_FS);
    this.persist   = program(gl, FULLSCREEN_VS, PERSIST_FS);
    this.bright    = program(gl, FULLSCREEN_VS, BRIGHT_FS);
    this.blur      = program(gl, FULLSCREEN_VS, BLUR_FS);
    this.composite = program(gl, FULLSCREEN_VS, COMPOSITE_FS);
    this.textProg  = program(gl, FULLSCREEN_VS, TEXT_FS);

    this._initBeamGeometry();

    // Fullscreen passes need a bound VAO in WebGL2 even with no attributes.
    this.emptyVAO = gl.createVertexArray();

    // Off-screen 2D canvas used to rasterise HUD text for the emissive pass.
    this.textCanvas = document.createElement('canvas');
    this.textCtx = this.textCanvas.getContext('2d');
    this.textTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.textTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this._textKey = null;

    this.targets = null;
    this.cssW = 1; this.cssH = 1;
    this.instances = new Float32Array(1024 * STRIDE);
    this.glowData = new Float32Array(64 * GLOW_STRIDE);
    this.persistIndex = 0;
  }

  _initBeamGeometry() {
    const gl = this.gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    // Static quad corners, expanded per-instance in the vertex shader.
    const corners = new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]);
    this.cornerBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    const aCorner = this.beam.a.aCorner;
    gl.enableVertexAttribArray(aCorner);
    gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

    this.instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    const bytes = STRIDE * 4;
    const attrs = [
      ['aP0',     2, 0],
      ['aP1',     2, 8],
      ['aColor',  3, 16],
      ['aHot',    3, 28],
      ['aParams', 3, 40],
    ];
    for (const [name, size, offset] of attrs) {
      const loc = this.beam.a[name];
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, bytes, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);

    // ----- Glow quads share the same static corner buffer -----
    this.glowVAO = gl.createVertexArray();
    gl.bindVertexArray(this.glowVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuf);
    gl.enableVertexAttribArray(this.glow.a.aCorner);
    gl.vertexAttribPointer(this.glow.a.aCorner, 2, gl.FLOAT, false, 0, 0);

    this.glowBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
    const gbytes = GLOW_STRIDE * 4;
    for (const [name, size, offset] of [
      ['aCenter', 2, 0],
      ['aRadii',  2, 8],
      ['aColor',  3, 16],
      ['aAlpha',  1, 28],
    ]) {
      const loc = this.glow.a[name];
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, gbytes, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
  }

  resize(cssW, cssH, dpr) {
    const gl = this.gl;
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.cssW = cssW;
    this.cssH = cssH;

    this._disposeTargets();
    const { internal, type } = this.fmt;
    const t = (tw, th, filter = gl.LINEAR) =>
      createTarget(gl, Math.max(1, tw), Math.max(1, th), internal, type, filter);

    this.targets = {
      emis: t(w, h),
      persist: [t(w, h), t(w, h)],
      bloomA: [t(w >> 1, h >> 1), t(w >> 2, h >> 2), t(w >> 3, h >> 3)],
      bloomB: [t(w >> 1, h >> 1), t(w >> 2, h >> 2), t(w >> 3, h >> 3)],
    };

    // Clear the persistence history so a resize doesn't smear the old image.
    for (const p of this.targets.persist) {
      bindTarget(gl, p, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.textCanvas.width = w;
    this.textCanvas.height = h;
    this._textKey = null;
    this._dpr = dpr;
  }

  _disposeTargets() {
    if (!this.targets) return;
    const gl = this.gl;
    deleteTarget(gl, this.targets.emis);
    this.targets.persist.forEach(t => deleteTarget(gl, t));
    this.targets.bloomA.forEach(t => deleteTarget(gl, t));
    this.targets.bloomB.forEach(t => deleteTarget(gl, t));
    this.targets = null;
  }

  // ---------- Instance buffer ----------
  _ensureCapacity(count) {
    if (this.instances.length >= count * STRIDE) return;
    let cap = this.instances.length / STRIDE;
    while (cap < count) cap *= 2;
    this.instances = new Float32Array(cap * STRIDE);
  }

  /** Flatten the display list into segment instances. Dots are zero-length. */
  _buildInstances(list) {
    // Upper bound: every path contributes segments plus one dot per vertex.
    let bound = list.hatch.length + list.dots.length;
    for (const p of list.paths) bound += p.pts.length * 2 + 1;
    this._ensureCapacity(bound);

    const a = this.instances;
    let n = 0;

    const push = (x0, y0, x1, y1, col, hot, core, glow, inten) => {
      const o = n * STRIDE;
      a[o] = x0; a[o + 1] = y0; a[o + 2] = x1; a[o + 3] = y1;
      a[o + 4] = col[0]; a[o + 5] = col[1]; a[o + 6] = col[2];
      a[o + 7] = hot[0]; a[o + 8] = hot[1]; a[o + 9] = hot[2];
      a[o + 10] = core; a[o + 11] = glow; a[o + 12] = inten;
      n++;
    };

    for (const s of list.hatch) {
      const c = hexToRGB(s.color);
      push(s.x, s.y0, s.x, s.y1, c, c, 0.5, 0.9, s.alpha);
    }

    for (const p of list.paths) {
      const col = hexToRGB(p.color);
      const hot = hexToRGB(p.hot);
      const core = Math.max(0.4, p.hotWidth * 0.5);
      const glow = Math.max(0.8, p.width * 0.8);
      const pts = p.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        push(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, hot, core, glow, p.alpha);
      }
      if (p.closed && pts.length > 2) {
        const f = pts[0], l = pts[pts.length - 1];
        push(l[0], l[1], f[0], f[1], col, hot, core, glow, p.alpha);
      }
      // A real beam slows at each vertex and deposits more energy there, which
      // is exactly why vector corners bloom. Zero-length segments reproduce it.
      // Curves approximated as many-sided polylines opt out — the dots would
      // read as beading rather than as corners.
      if (!p.noVertexDots) {
        for (const v of pts) {
          push(v[0], v[1], v[0], v[1], col, hot, core * 1.1, glow * 0.85, p.alpha * 0.45);
        }
      }
    }

    for (const d of list.dots) {
      const col = hexToRGB(d.color);
      const hot = hexToRGB(d.hot);
      // `glow` lets a caller tighten the halo. Dots drawn in a tight cluster to
      // be *counted* (an ammo stack) need it, or they bloom into one smear.
      push(d.x, d.y, d.x, d.y, col, hot, d.r * 0.8, d.r * (d.glow ?? 2.2), d.alpha);
    }

    return n;
  }

  /** Flatten filled elliptical glows into their own instance buffer. */
  _buildGlows(list) {
    const glows = list.glows;
    if (!glows || !glows.length) return 0;
    if (this.glowData.length < glows.length * GLOW_STRIDE) {
      this.glowData = new Float32Array(glows.length * 2 * GLOW_STRIDE);
    }
    const a = this.glowData;
    let n = 0;
    for (const g of glows) {
      if (!(g.rx > 0) || !(g.ry > 0)) continue;
      const c = hexToRGB(g.color);
      const o = n * GLOW_STRIDE;
      a[o] = g.x; a[o + 1] = g.y;
      a[o + 2] = g.rx; a[o + 3] = g.ry;
      a[o + 4] = c[0]; a[o + 5] = c[1]; a[o + 6] = c[2];
      a[o + 7] = g.alpha;
      n++;
    }
    return n;
  }

  // ---------- Text ----------
  _updateText(list) {
    const key = list.texts.map(t =>
      `${t.text}|${t.x.toFixed(1)}|${t.y.toFixed(1)}|${t.size}|${t.align}|${t.color}|${t.alpha}`
    ).join('~');
    if (key === this._textKey) return list.texts.length > 0;
    this._textKey = key;

    const ctx = this.textCtx;
    const dpr = this._dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
    if (list.texts.length) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      for (const t of list.texts) {
        ctx.font = `${t.size}px VT323, monospace`;
        ctx.textAlign = t.align;
        ctx.textBaseline = t.baseline;
        ctx.globalAlpha = 0.55 * t.alpha;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = t.hot;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.textTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.textCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return list.texts.length > 0;
  }

  // ---------- Frame ----------
  render(list, opts = {}) {
    if (this.lost) return;
    const gl = this.gl;
    if (!this.targets) return;

    const dt = Math.min(0.05, Math.max(0, opts.dt ?? 1 / 60));
    const crt = opts.crt ? 1 : 0;
    // Trails are motion smear, so reduced motion turns persistence off.
    const decay = opts.reduceMotion ? 0 : Math.exp(-dt / PERSIST_TAU);

    const T = this.targets;
    const dw = this.canvas.width, dh = this.canvas.height;

    // ----- 1. Emissive pass -----
    bindTarget(gl, T.emis, dw, dh);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const count = this._buildInstances(list);
    if (count > 0) {
      gl.useProgram(this.beam.prog);
      gl.uniform2f(this.beam.u.uRes, this.cssW, this.cssH);
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER,
        this.instances.subarray(0, count * STRIDE), gl.DYNAMIC_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      gl.bindVertexArray(null);
    }

    const glowCount = this._buildGlows(list);
    if (glowCount > 0) {
      gl.useProgram(this.glow.prog);
      gl.uniform2f(this.glow.u.uRes, this.cssW, this.cssH);
      gl.bindVertexArray(this.glowVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
      gl.bufferData(gl.ARRAY_BUFFER,
        this.glowData.subarray(0, glowCount * GLOW_STRIDE), gl.DYNAMIC_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, glowCount);
      gl.bindVertexArray(null);
    }

    gl.bindVertexArray(this.emptyVAO);

    if (this._updateText(list)) {
      gl.useProgram(this.textProg.prog);
      bindTexture(gl, 0, this.textTex, this.textProg.u.uTex);
      drawFullscreen(gl);
    }

    gl.disable(gl.BLEND);

    // ----- 2. Phosphor persistence -----
    let scene = T.emis;
    if (decay > 0.01) {
      const prev = T.persist[this.persistIndex];
      const next = T.persist[this.persistIndex ^ 1];
      bindTarget(gl, next, dw, dh);
      gl.useProgram(this.persist.prog);
      bindTexture(gl, 0, T.emis.tex, this.persist.u.uCurrent);
      bindTexture(gl, 1, prev.tex, this.persist.u.uPrevious);
      gl.uniform1f(this.persist.u.uDecay, decay);
      drawFullscreen(gl);
      this.persistIndex ^= 1;
      scene = next;
    }

    // ----- 3. Bright pass -----
    bindTarget(gl, T.bloomA[0], dw, dh);
    gl.useProgram(this.bright.prog);
    bindTexture(gl, 0, scene.tex, this.bright.u.uSrc);
    gl.uniform1f(this.bright.u.uThreshold, this.hdr ? 0.42 : 0.30);
    gl.uniform1f(this.bright.u.uKnee, 0.55);
    drawFullscreen(gl);

    // ----- 4. Separable blur chain. Each level also downsamples, because a
    // smaller target sampled with LINEAR filtering halves as it blurs. -----
    gl.useProgram(this.blur.prog);
    for (let i = 0; i < 3; i++) {
      const src = i === 0 ? T.bloomA[0] : T.bloomA[i - 1];
      const tmp = T.bloomB[i];
      const dst = T.bloomA[i];

      bindTarget(gl, tmp, dw, dh);
      bindTexture(gl, 0, src.tex, this.blur.u.uSrc);
      gl.uniform2f(this.blur.u.uTexel, 1 / src.w, 1 / src.h);
      gl.uniform2f(this.blur.u.uDir, 1, 0);
      drawFullscreen(gl);

      bindTarget(gl, dst, dw, dh);
      bindTexture(gl, 0, tmp.tex, this.blur.u.uSrc);
      gl.uniform2f(this.blur.u.uTexel, 1 / tmp.w, 1 / tmp.h);
      gl.uniform2f(this.blur.u.uDir, 0, 1);
      drawFullscreen(gl);
    }

    // ----- 5. Composite to the screen -----
    bindTarget(gl, null, dw, dh);
    gl.useProgram(this.composite.prog);
    bindTexture(gl, 0, scene.tex, this.composite.u.uScene);
    bindTexture(gl, 1, T.bloomA[0].tex, this.composite.u.uBloom0);
    bindTexture(gl, 2, T.bloomA[1].tex, this.composite.u.uBloom1);
    bindTexture(gl, 3, T.bloomA[2].tex, this.composite.u.uBloom2);
    const bg0 = hexToRGB(list.bg0), bg1 = hexToRGB(list.bg1);
    gl.uniform3f(this.composite.u.uBg0, bg0[0], bg0[1], bg0[2]);
    gl.uniform3f(this.composite.u.uBg1, bg1[0], bg1[1], bg1[2]);
    gl.uniform1f(this.composite.u.uFlash, list.flash);
    gl.uniform1f(this.composite.u.uBloomStrength, opts.bloomStrength ?? 0.85);
    gl.uniform1f(this.composite.u.uCRT, crt);
    gl.uniform2f(this.composite.u.uRes, dw, dh);
    drawFullscreen(gl);

    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this._disposeTargets();
    gl.deleteTexture(this.textTex);
    gl.deleteBuffer(this.instBuf);
    gl.deleteBuffer(this.glowBuf);
    gl.deleteBuffer(this.cornerBuf);
    gl.deleteVertexArray(this.vao);
    gl.deleteVertexArray(this.glowVAO);
    gl.deleteVertexArray(this.emptyVAO);
    for (const p of [this.beam, this.glow, this.persist, this.bright, this.blur, this.composite, this.textProg]) {
      gl.deleteProgram(p.prog);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
