/* ============================================================
   gl.js — WebGL2 plumbing and matrix maths
   ============================================================
   Deliberately small. Just enough to build programs, buffers,
   textures and framebuffers without a dependency, plus the mat4
   routines the scene renderer needs.

   Conventions follow OpenGL, not the software renderer in
   render.js: the camera looks down -Z in view space, and clip
   space is left to the GPU. The world axes are unchanged —
   +x east, +y up, +z north.
   ============================================================ */
'use strict';

const GLX = {
  gl: null,
  canvas: null,
  ext: {},
  lastError: null,

  /* Returns the context, or null if WebGL2 is unavailable. */
  init(canvas, opts) {
    this.canvas = canvas;
    let gl = null;
    try {
      gl = canvas.getContext('webgl2', Object.assign({
        alpha: false, depth: true, stencil: false,
        antialias: true, powerPreference: 'high-performance',
        preserveDrawingBuffer: true      // so screenshots work
      }, opts || {}));
    } catch (e) { this.lastError = e.message; }
    if (!gl) { this.lastError = this.lastError || 'webgl2 context refused'; return null; }
    this.gl = gl;
    this.ext.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.ext.colorFloat = gl.getExtension('EXT_color_buffer_float');
    this.ext.floatLinear = gl.getExtension('OES_texture_float_linear');
    return gl;
  },

  /* ---------- shaders ---------- */

  compile(type, src, name) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s) || '';
      // Point at the offending line: GLSL errors are useless without it.
      const line = /:(\d+):/.exec(info);
      let ctxLines = '';
      if (line) {
        const all = src.split('\n');
        const n = +line[1] - 1;
        for (let i = Math.max(0, n - 2); i <= Math.min(all.length - 1, n + 2); i++) {
          ctxLines += (i === n ? ' >> ' : '    ') + (i + 1) + ' | ' + all[i] + '\n';
        }
      }
      gl.deleteShader(s);
      throw new Error('[' + (name || 'shader') + '] ' + info + '\n' + ctxLines);
    }
    return s;
  },

  program(vsSrc, fsSrc, name) {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, vsSrc, (name || '') + '.vert');
    const fs = this.compile(gl.FRAGMENT_SHADER, fsSrc, (name || '') + '.frag');
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('[' + (name || 'program') + '] link failed: ' + info);
    }
    // Cache uniform locations so draw code never calls getUniformLocation.
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const base = info.name.replace(/\[0\]$/, '');
      u[base] = gl.getUniformLocation(p, info.name);
    }
    return { p, u, name: name || 'program' };
  },

  use(prog) { this.gl.useProgram(prog.p); return prog; },

  /* ---------- buffers ---------- */

  buffer(data, target, usage) {
    const gl = this.gl;
    const b = gl.createBuffer();
    const t = target || gl.ARRAY_BUFFER;
    gl.bindBuffer(t, b);
    gl.bufferData(t, data, usage || gl.STATIC_DRAW);
    return b;
  },

  /* ---------- textures ---------- */

  tex2D(o) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (o.image) {
      gl.texImage2D(gl.TEXTURE_2D, 0, o.internal || gl.RGBA8, o.format || gl.RGBA,
                    o.type || gl.UNSIGNED_BYTE, o.image);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, o.internal || gl.RGBA8, o.w, o.h, 0,
                    o.format || gl.RGBA, o.type || gl.UNSIGNED_BYTE, o.data || null);
    }
    const wrap = o.wrap || gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, o.mag || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.min || gl.LINEAR);
    if (o.mipmap) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (this.ext.aniso) {
        const max = gl.getParameter(this.ext.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        gl.texParameterf(gl.TEXTURE_2D, this.ext.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
      }
    }
    if (o.compare) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    }
    return t;
  },

  tex3D(o) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, t);
    gl.texImage3D(gl.TEXTURE_3D, 0, o.internal || gl.R8, o.w, o.h, o.d, 0,
                  o.format || gl.RED, o.type || gl.UNSIGNED_BYTE, o.data || null);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  },

  /* ---------- framebuffers ---------- */

  fbo(o) {
    const gl = this.gl;
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    const out = { fb: f, w: o.w, h: o.h };

    if (o.color !== false) {
      out.color = this.tex2D({
        w: o.w, h: o.h,
        internal: o.internal || gl.RGBA8,
        format: gl.RGBA,
        type: o.type || gl.UNSIGNED_BYTE
      });
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out.color, 0);
    } else {
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
    }

    if (o.depth) {
      out.depth = this.tex2D({
        w: o.w, h: o.h,
        internal: gl.DEPTH_COMPONENT24,
        format: gl.DEPTH_COMPONENT,
        type: gl.UNSIGNED_INT,
        min: gl.NEAREST, mag: gl.NEAREST
      });
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, out.depth, 0);
    }

    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete: 0x' + st.toString(16));
    return out;
  },

  resizeFbo(f, w, h) {
    const gl = this.gl;
    if (f.w === w && f.h === h) return;
    f.w = w; f.h = h;
    if (f.color) {
      gl.bindTexture(gl.TEXTURE_2D, f.color);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    if (f.depth) {
      gl.bindTexture(gl.TEXTURE_2D, f.depth);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0,
                    gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    }
  }
};

/* ============================================================
   mat4 — column-major, OpenGL layout
   ============================================================ */
const M4 = {
  create() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },

  identity(o) {
    o.fill(0);
    o[0] = o[5] = o[10] = o[15] = 1;
    return o;
  },

  /* o = a * b  (apply b first, then a) */
  mul(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4]     = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },

  perspective(o, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = f / aspect;
    o[5] = f;
    o[11] = -1;
    o[10] = (far + near) / (near - far);
    o[14] = (2 * far * near) / (near - far);
    return o;
  },

  ortho(o, l, r, b, t, n, f) {
    o.fill(0);
    o[0] = 2 / (r - l);
    o[5] = 2 / (t - b);
    o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l);
    o[13] = -(t + b) / (t - b);
    o[14] = -(f + n) / (f - n);
    o[15] = 1;
    return o;
  },

  lookAt(o, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
    let zx = ex - cx, zy = ey - cy, zz = ez - cz;
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;
    let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
    len = Math.hypot(xx, xy, xz);
    if (len < 1e-6) { xx = 1; xy = 0; xz = 0; } else { xx /= len; xy /= len; xz /= len; }
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez);
    o[13] = -(yx * ex + yy * ey + yz * ez);
    o[14] = -(zx * ex + zy * ey + zz * ez);
    o[15] = 1;
    return o;
  },

  /* Model matrix from the same euler convention the props already use. */
  fromEuler(o, yaw, pitch, roll, tx, ty, tz) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    // Rows of Rz(roll)*Rx(pitch)*Ry(yaw), written into column-major slots.
    o[0] = cr * cy - sr * sp * sy;  o[4] = -sr * cp; o[8]  = cr * sy + sr * sp * cy;  o[12] = tx;
    o[1] = sr * cy + cr * sp * sy;  o[5] = cr * cp;  o[9]  = sr * sy - cr * sp * cy;  o[13] = ty;
    o[2] = -cp * sy;                o[6] = sp;       o[10] = cp * cy;                 o[14] = tz;
    o[3] = 0;                       o[7] = 0;        o[11] = 0;                       o[15] = 1;
    return o;
  },

  invert(o, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M4.identity(o);
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  }
};
