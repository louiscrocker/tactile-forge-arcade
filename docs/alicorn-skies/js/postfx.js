/* ============================================================
   postfx.js — a soft WebGL glow over the bright things
   ============================================================
   Each frame the finished scene is shrunk to a quarter-size 2D
   canvas (cheap), uploaded to WebGL, bright-passed (only the
   brightest, most colourful pixels survive), blurred twice at
   low resolution, and the result is added back over the scene
   with 'lighter'.  Stars, magic, crystals, fireworks and the
   moon bloom softly; daylight stays clean because the threshold
   rises in the day.  If WebGL isn't available the game simply
   draws without it.
   ============================================================ */
'use strict';

const PostFX = (function () {
  let gl = null, glCanvas = null, small = null, sctx = null, ok = null;
  let progBright = null, progBlur = null, tex = null, fbA = null, fbB = null, texA = null, texB = null, buf = null;
  let w = 0, h = 0;

  const VS = 'attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }';
  const FS_BRIGHT = `precision mediump float; varying vec2 uv; uniform sampler2D t; uniform float th; uniform float nt;
    void main(){ vec3 c = texture2D(t, vec2(uv.x, 1. - uv.y)).rgb; float l = max(c.r, max(c.g, c.b));
      float s = l - min(c.r, min(c.g, c.b)); float k = smoothstep(th, 1., l + s * .25) * mix(clamp(s * 2.2, 0., 1.), 1., nt); gl_FragColor = vec4(c * k, 1.); }`;
  const FS_BLUR = `precision mediump float; varying vec2 uv; uniform sampler2D t; uniform vec2 d;
    void main(){ vec3 c = texture2D(t, uv).rgb * .227;
      c += (texture2D(t, uv + d * 1.385).rgb + texture2D(t, uv - d * 1.385).rgb) * .316;
      c += (texture2D(t, uv + d * 3.23).rgb + texture2D(t, uv - d * 3.23).rgb) * .07;
      gl_FragColor = vec4(c, 1.); }`;

  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(fs) { const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link'); return p; }
  function makeTex() { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  function makeFb(t) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }

  function setup(W, H) {
    w = Math.max(64, Math.round(W / 4)); h = Math.max(36, Math.round(H / 4));
    if (!glCanvas) {
      glCanvas = document.createElement('canvas');
      gl = glCanvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
      if (!gl) { ok = false; return; }
      progBright = program(FS_BRIGHT); progBlur = program(FS_BLUR);
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      tex = makeTex(); texA = makeTex(); texB = makeTex();
      small = document.createElement('canvas'); sctx = small.getContext('2d');
    }
    glCanvas.width = w; glCanvas.height = h; small.width = w; small.height = h;
    fbA = makeFb(texA); fbB = makeFb(texB);
    ok = true;
  }
  function draw(p) { const loc = gl.getAttribLocation(p, 'p'); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

  /* opts: { night, alt, party } */
  function apply(ctx, sceneCanvas, W, H, DPR, opts) {
    if (ok === false) return;
    try {
      if (ok === null || Math.round(W / 4) !== w || Math.round(H / 4) !== h) setup(W, H);
      if (!ok) return;
      sctx.drawImage(sceneCanvas, 0, 0, w, h);
      gl.viewport(0, 0, w, h);
      /* bright pass → A */
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, small);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbA); gl.useProgram(progBright);
      gl.uniform1i(gl.getUniformLocation(progBright, 't'), 0);
      const night = Math.max(opts.night || 0, opts.alt || 0);
      gl.uniform1f(gl.getUniformLocation(progBright, 'th'), lerp(.88, .74, night));
      gl.uniform1f(gl.getUniformLocation(progBright, 'nt'), smoothstep(.2, .8, night));
      draw(progBright);
      /* blur A→B (x), B→A (y), twice */
      gl.useProgram(progBlur);
      const dl = gl.getUniformLocation(progBlur, 'd');
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbB); gl.bindTexture(gl.TEXTURE_2D, texA); gl.uniform2f(dl, (1 + i) / w, 0); draw(progBlur);
        gl.bindFramebuffer(gl.FRAMEBUFFER, i === 1 ? null : fbA); gl.bindTexture(gl.TEXTURE_2D, texB); gl.uniform2f(dl, 0, (1 + i) / h); draw(progBlur);
      }
      ctx.save();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lerp(.28, .6, night) + (opts.party ? .1 : 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(glCanvas, 0, 0, W, H);
      ctx.restore();
    } catch (e) { ok = false; console.warn('glow off', e); }
  }
  return { apply, available: () => ok !== false };
})();
