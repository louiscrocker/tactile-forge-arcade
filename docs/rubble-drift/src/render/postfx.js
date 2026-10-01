// =====================================================
// Tactile Forge — Asteroids · WebGL post-processing
// Samples the engine's 2D canvas as a texture and runs:
//   1. bright-pass extraction (extracts pixels above threshold)
//   2. separable Gaussian blur on a half-res FBO
//   3. composite original + bloom
//   4. CRT curvature, scanlines, optional vignette
// Falls back gracefully (returns null) when WebGL2 is unavailable.
// =====================================================

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// --- Bright-pass + downsample ---
const FRAG_BRIGHT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_src;
uniform float u_threshold;   // pixels brighter than this contribute to bloom
uniform float u_intensity;   // bloom contribution scale
void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 b = max(c - vec3(u_threshold), vec3(0.0)) * u_intensity;
  // Bias toward the brighter colored core
  b += smoothstep(0.85, 1.0, lum) * c * 0.6;
  outColor = vec4(b, 1.0);
}`;

// --- Separable blur (5-tap Gaussian) ---
const FRAG_BLUR = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_src;
uniform vec2 u_dir;          // (1/w, 0) or (0, 1/h)
void main() {
  vec3 c = vec3(0.0);
  c += texture(u_src, v_uv - u_dir * 4.0).rgb * 0.05;
  c += texture(u_src, v_uv - u_dir * 2.0).rgb * 0.20;
  c += texture(u_src, v_uv             ).rgb * 0.50;
  c += texture(u_src, v_uv + u_dir * 2.0).rgb * 0.20;
  c += texture(u_src, v_uv + u_dir * 4.0).rgb * 0.05;
  outColor = vec4(c, 1.0);
}`;

// --- Composite + CRT pass (final) ---
const FRAG_COMPOSITE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_src;
uniform sampler2D u_bloom;
uniform float u_bloom_amount;
uniform float u_curve;       // 0 = no curve, 0.20 = strong barrel
uniform float u_scanline;    // 0..1 strength
uniform vec2  u_resolution;
uniform float u_chroma;      // chromatic aberration radius (px)
uniform float u_time;

vec2 barrel(vec2 uv, float k) {
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  return uv + c * r2 * k;
}

void main() {
  vec2 uv = barrel(v_uv, u_curve);
  // Drop pixels outside the warped frame to dark glass
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    outColor = vec4(0.0, 0.01, 0.005, 1.0);
    return;
  }
  // Chromatic aberration on the source
  vec2 dir = (uv - 0.5);
  float aberr = u_chroma / max(u_resolution.x, 1.0);
  vec3 src;
  src.r = texture(u_src, uv + dir * aberr).r;
  src.g = texture(u_src, uv).g;
  src.b = texture(u_src, uv - dir * aberr).b;

  vec3 bloom = texture(u_bloom, uv).rgb;
  vec3 col = src + bloom * u_bloom_amount;

  // Scanlines: subtle horizontal modulation
  float scan = 0.5 + 0.5 * sin(uv.y * u_resolution.y * 1.5708);
  col *= mix(1.0, 0.82 + 0.18 * scan, u_scanline);

  // Vignette
  float vd = distance(uv, vec2(0.5));
  col *= smoothstep(0.95, 0.4, vd);

  outColor = vec4(col, 1.0);
}`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[postfx] shader compile:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
function linkProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[postfx] program link:', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

export class PostFX {
  /**
   * @param sourceCanvas - the 2D canvas the engine renders into
   * @param targetCanvas - the visible canvas (will be initialised as WebGL2)
   */
  constructor(sourceCanvas, targetCanvas) {
    this.source = sourceCanvas;
    this.target = targetCanvas;
    this.gl = targetCanvas.getContext('webgl2', {
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!this.gl) {
      console.warn('[postfx] WebGL2 unavailable; bloom disabled');
      return;
    }
    this._init();
    this.opts = {
      bloom: 0.9,
      threshold: 0.55,
      curve: 0.06,
      scanline: 0.55,
      chroma: 0.6,
    };
  }

  available() { return !!this.gl; }

  _init() {
    const gl = this.gl;
    // Fullscreen triangle (covers viewport with one tri)
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  3, -1, -1,  3,
    ]), gl.STATIC_DRAW);

    this.progBright    = linkProgram(gl, VERT, FRAG_BRIGHT);
    this.progBlur      = linkProgram(gl, VERT, FRAG_BLUR);
    this.progComposite = linkProgram(gl, VERT, FRAG_COMPOSITE);

    this.uBright = {
      src:       gl.getUniformLocation(this.progBright, 'u_src'),
      threshold: gl.getUniformLocation(this.progBright, 'u_threshold'),
      intensity: gl.getUniformLocation(this.progBright, 'u_intensity'),
    };
    this.uBlur = {
      src:       gl.getUniformLocation(this.progBlur, 'u_src'),
      dir:       gl.getUniformLocation(this.progBlur, 'u_dir'),
    };
    this.uComp = {
      src:        gl.getUniformLocation(this.progComposite, 'u_src'),
      bloom:      gl.getUniformLocation(this.progComposite, 'u_bloom'),
      amount:     gl.getUniformLocation(this.progComposite, 'u_bloom_amount'),
      curve:      gl.getUniformLocation(this.progComposite, 'u_curve'),
      scanline:   gl.getUniformLocation(this.progComposite, 'u_scanline'),
      resolution: gl.getUniformLocation(this.progComposite, 'u_resolution'),
      chroma:     gl.getUniformLocation(this.progComposite, 'u_chroma'),
      time:       gl.getUniformLocation(this.progComposite, 'u_time'),
    };

    // Source texture (uploaded each frame from the 2D canvas)
    this.srcTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Half-res ping-pong FBOs for bloom
    this.fboA = this._mkFbo();
    this.fboB = this._mkFbo();
    this._lastSize = { w: 0, h: 0 };
  }

  _mkFbo() {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { fbo, tex, w: 0, h: 0 };
  }
  _sizeFbo(target, w, h) {
    if (target.w === w && target.h === h) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, target.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.tex, 0);
    target.w = w; target.h = h;
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const w = Math.floor(cssW * dpr), h = Math.floor(cssH * dpr);
    if (this.target.width !== w || this.target.height !== h) {
      this.target.width = w;
      this.target.height = h;
      this.target.style.width = cssW + 'px';
      this.target.style.height = cssH + 'px';
    }
    if (this._lastSize.w !== w || this._lastSize.h !== h) {
      this._lastSize = { w, h };
      // Half-res FBOs for bloom
      this._sizeFbo(this.fboA, Math.max(2, Math.floor(w / 2)), Math.max(2, Math.floor(h / 2)));
      this._sizeFbo(this.fboB, Math.max(2, Math.floor(w / 2)), Math.max(2, Math.floor(h / 2)));
    }
  }

  /** Upload source canvas as texture, run bloom + composite, present to target. */
  present(opts = {}) {
    const gl = this.gl;
    if (!gl) return;
    Object.assign(this.opts, opts);
    this._resize();

    // Upload source 2D canvas as texture
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const halfW = this.fboA.w, halfH = this.fboA.h;

    // ---- Pass 1: bright-pass into fboA (half-res) ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA.fbo);
    gl.viewport(0, 0, halfW, halfH);
    gl.useProgram(this.progBright);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.uniform1i(this.uBright.src, 0);
    gl.uniform1f(this.uBright.threshold, this.opts.threshold);
    gl.uniform1f(this.uBright.intensity, 1.4);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- Pass 2: horizontal blur fboA -> fboB ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB.fbo);
    gl.viewport(0, 0, halfW, halfH);
    gl.useProgram(this.progBlur);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fboA.tex);
    gl.uniform1i(this.uBlur.src, 0);
    gl.uniform2f(this.uBlur.dir, 1.0 / halfW, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- Pass 3: vertical blur fboB -> fboA ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA.fbo);
    gl.viewport(0, 0, halfW, halfH);
    gl.useProgram(this.progBlur);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fboB.tex);
    gl.uniform1i(this.uBlur.src, 0);
    gl.uniform2f(this.uBlur.dir, 0, 1.0 / halfH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- Pass 4: composite to default framebuffer ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.target.width, this.target.height);
    gl.useProgram(this.progComposite);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.uniform1i(this.uComp.src, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.fboA.tex);
    gl.uniform1i(this.uComp.bloom, 1);
    gl.uniform1f(this.uComp.amount, this.opts.bloom);
    gl.uniform1f(this.uComp.curve, this.opts.curve);
    gl.uniform1f(this.uComp.scanline, this.opts.scanline);
    gl.uniform2f(this.uComp.resolution, this.target.width, this.target.height);
    gl.uniform1f(this.uComp.chroma, this.opts.chroma);
    gl.uniform1f(this.uComp.time, performance.now() / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
