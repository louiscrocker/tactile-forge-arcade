/* ============================================================
   gfx.js — the painted, lit look (on by default; O switches it live)
   ============================================================
     The game still draws its world with Canvas 2D (render.js),
     but into a transparent layer. This module paints what is
     around it and the light on it, on the GPU:
       background (part res): the sky by the time of day, the sun
         and its glow, the moon as a lit sphere in its phase, the
         stars, drifting clouds, and three bands of far hills with
         trees that slide with the camera (parallax), fading into
         the haze
       scene (full res): the world layer lit by the sun (warm at
         dawn and dusk, blue at night), a rim of light along the
         tops of shapes, and at night the torches, fires, candles
         and lamps as flickering point lights with warm halos
       particles: rain streaks slanting with the wind; snow
         drifting down; both only when the weather says so
       bloom, filmic tone mapping, a warm/cool grade, vignette,
       grain, and the flash of lightning
     No libraries; falls back to the Canvas 2D look when WebGL2 is
     missing or a shader fails. Nothing in the game's logic reads
     from here.
   ============================================================ */
'use strict';

const GFX = (function () {
  let on = false, ready = false, cv = null, gl = null, hdr = false, maxPt = 64;
  let world = null, wctx = null, worldTex = null, vao = null;
  let cssW = 1, cssH = 1, dpr = 1, pw = 1, ph = 1, bgScale = .5;
  const P = {}, T = {};
  let frames = 0, gpuMs = 0, upMs = 0, lastUp = 0;
  const NL = 48;                                      /* point lights at once */
  const EXPOSURE = (() => { try { const v = +new URLSearchParams(location.search).get('exposure'); return v > 0 ? v : 1; } catch (e) { return 1; } })();
  const lpos = new Float32Array(NL * 2), lcol = new Float32Array(NL * 3), lrad = new Float32Array(NL);

  /* ---------- shaders ---------- */
  const VS = `#version 300 es
  out vec2 vUv;
  void main() { vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

  const LIB = `
  float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h11(i), h11(i + 1.), f); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
  float fbm3(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 3; i++) { s += a * n2(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
  vec3 toLin(vec3 c) { return pow(max(c, 0.), vec3(2.2)); }
  `;

  /* the background: sky, sun, moon, stars, clouds, far hills */
  const FS_BG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uGroundY, uDay, uNight, uCloud, uMoonPhase, uSeason, uSnow, uWarm;
  uniform vec3 uTop, uBot, uSun, uMoon, uSunCol;
  ${LIB}
  /* a band of rolling hills with a treeline: the hill's height above its base at screen x */
  float hills(float ix, float seed, float amp, float sp) { return amp * (.55 + .45 * sin(ix / sp + seed) * .5 + .5 * n1(ix / (sp * .55) + seed * 3.1)) + amp * .35 * n1(ix / (sp * .17) + seed * 7.); }
  float trees(float ix, float sp, float seed, float h) { float c = floor(ix / sp), f = fract(ix / sp), tw = .35 + .25 * h11(c + seed); float th = h * (.5 + .5 * h11(c * 3. + seed)); float tri = th * (1. - abs(f - .5) / tw); return max(tri, 0.); }
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float H = uRes.y;
    /* --- the sky --- */
    float ty = clamp(px.y / max(uGroundY, 60.), 0., 1.);
    vec3 col = mix(uTop, uBot, pow(ty, .8));
    vec2 sd = (px - uSun.xy) / H; float d = length(sd);
    col += uSunCol * uSun.z * (.8 * exp(-d * 9.) + .14 * exp(-d * 2.5)) * (1. - .6 * uCloud);
    col += uSunCol * smoothstep(30., 26., length(px - uSun.xy)) * 5. * uSun.z * (1. - uCloud);
    if (uNight > .02) {
      vec2 sp = (px + vec2(uCamX * uZoom * .02, 0.)) / 2.5; vec2 ci = floor(sp); float r = h21(ci);
      if (r > .9955) { vec2 f = fract(sp) - .5; float tw = .55 + .45 * sin(uTime * (1.5 + 3. * h21(ci + 7.)) + r * 80.);
        col += vec3(.9, .95, 1.) * smoothstep(.5, .0, length(f)) * uNight * tw * (1. - uCloud) * 1.5 * smoothstep(uGroundY, uGroundY * .5, px.y); }
    }
    if (uMoon.z > .001) {
      vec2 md = (px - uMoon.xy) / 26.; float mr = length(md);
      col += vec3(.55, .65, 1.) * uMoon.z * (.22 * exp(-length(px - uMoon.xy) / H * 6.));
      if (mr < 1.) {
        vec3 n = vec3(md.x, -md.y, sqrt(1. - mr * mr));
        float a = uMoonPhase * 6.2831853; vec3 L = vec3(sin(a), 0., -cos(a));
        float lit = smoothstep(-.04, .1, dot(n, L)), mare = .72 + .28 * fbm(n.xy * 2.6 + 5.);
        col = mix(col, vec3(1., .97, .9) * (lit * mare * 1.9 + .03), smoothstep(1., .96, mr) * uMoon.z);
      }
    }
    /* clouds */
    float cov = mix(.3, .95, uCloud);
    vec2 cp = vec2((px.x + uCamX * uZoom * .05) / H + uTime * .006, px.y / H * 2.6);
    float cn = fbm(cp * vec2(2.2, 1.6) + vec2(fbm3(cp * 1.3 + uTime * .01), fbm3(cp * 1.3 + 9.)) * .7);
    float dens = smoothstep(1. - cov, 1. - cov + .32, cn) * smoothstep(uGroundY * .95, uGroundY * .3, px.y);
    vec3 cc = mix(uBot * .9 + vec3(.08), uSunCol * 1.15, .5 * uSun.z * (1. - uCloud * .6));
    cc = mix(cc, vec3(.06, .07, .12), uNight * .85); cc = mix(cc, cc * vec3(1.1, .9, .8), uWarm * .5);
    col = mix(col, cc, dens * .9);
    /* --- far hills, three bands, hazier with distance --- */
    vec3 grass = uSeason > 2.5 ? vec3(.5, .55, .5) : uSeason > 1.5 ? vec3(.5, .4, .18) : vec3(.22, .42, .16);
    grass = mix(grass, vec3(.9, .92, .98), uSnow * .8);
    for (int i = 2; i >= 0; i--) {
      float fi = float(i), par = fi == 0. ? .06 : fi == 1. ? .14 : .26;
      float base = uGroundY - (fi == 0. ? 170. : fi == 1. ? 110. : 50.) * min(1.2, uZoom) ;
      float ix = px.x + uCamX * uZoom * par + fi * 711.;
      float hh = hills(ix, fi * 13.7, (fi == 0. ? 90. : fi == 1. ? 70. : 48.) * min(1.2, uZoom), 420. - fi * 90.);
      float top = base - hh;
      float tr = trees(ix, 14. - fi * 2., fi, (fi == 0. ? 10. : fi == 1. ? 16. : 24.) * min(1.2, uZoom));
      float inside = step(top, px.y), inTree = step(top - tr, px.y) * (1. - inside);
      float haze = fi == 0. ? .55 : fi == 1. ? .32 : .12;
      vec3 hc = mix(grass * (fi == 0. ? .85 : fi == 1. ? .95 : 1.), uBot * 1.1, haze);
      hc *= .9 + .25 * smoothstep(top + 10., top - 30., px.y);
      vec3 tc = mix(grass * .45, uBot, haze * .8);
      hc = mix(hc, hc * vec3(.14, .17, .32), uNight); tc = mix(tc, tc * vec3(.12, .14, .28), uNight);
      hc = mix(hc, hc * vec3(1.12, .95, .85), uWarm * .4 * (1. - uNight));
      col = mix(col, tc, inTree); col = mix(col, hc, inside);
    }
    /* the ground below the world's earth, in case the earth tiles do not reach */
    col = mix(col, mix(grass * .5, vec3(.03, .04, .07), uNight * .85), step(uGroundY + 2., px.y));
    o = vec4(col, 1.);
  }`;

  /* the scene: the world layer lit by sun and lamps over the background */
  const FS_SCENE = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld;
  uniform vec2 uRes, uTexel; uniform float uDPR, uTime, uDay, uNight, uCloud, uWarm, uGroundY, uFlash;
  uniform vec3 uSun, uSunCol, uSky, uAmb;
  uniform int uNL; uniform vec2 uLPos[${NL}]; uniform vec3 uLCol[${NL}]; uniform float uLRad[${NL}];
  ${LIB}
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    vec3 col = texture(uBg, vUv).rgb;
    vec4 w = texture(uWorld, vUv);
    /* halos of the lamps on the air itself (soft, so the night glows round each torch) */
    vec3 halo = vec3(0.);
    for (int i = 0; i < ${NL}; i++) { if (i >= uNL) break; float dd = length((px - uLPos[i]) / uLRad[i]); halo += uLCol[i] * exp(-dd * dd * 2.2) * .22; }
    col += halo * (1. - w.a * .5);
    if (w.a > .002) {
      vec3 alb = toLin(w.rgb / w.a);
      vec2 g = vec2(0.); float avg = 0.;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * .7853982; vec2 dir = vec2(cos(a), sin(a));
        float s1 = texture(uWorld, vUv + dir * uTexel * 2.5 * uDPR).a, s2 = texture(uWorld, vUv + dir * uTexel * 6. * uDPR).a;
        g += dir * (s1 + s2 * .6); avg += s1 * .6 + s2 * .4;
      }
      avg /= 8.;
      vec2 n = -g; float nl = length(n); n = nl > 1e-4 ? n / nl : vec2(0.); n.y = -n.y;
      float edge = clamp((1. - avg) * 1.6, 0., 1.);
      float top = edge * max(-n.y, 0.);
      float l0 = dot(w.rgb, vec3(.33)), ly = dot(texture(uWorld, vUv - vec2(0., uTexel.y * uDPR)).rgb, vec3(.33));
      float bump = (ly - l0) * 1.2;
      vec2 L = normalize(uSun.xy - px + 1e-3);
      float sunK = uSun.z * (1. - .55 * uCloud);
      float diff = .55 + .45 * max(dot(n, L), 0.) * edge + bump * .3;
      vec3 lit = alb * (uAmb + uSky * top * .22 + uSunCol * sunK * (.42 + .3 * diff));
      lit += uSunCol * sunK * edge * pow(max(dot(n, L), 0.), 1.6) * (.1 + .4 * dot(alb, vec3(.33)));
      /* the lamps */
      vec3 lamp = vec3(0.);
      for (int i = 0; i < ${NL}; i++) { if (i >= uNL) break; vec2 dv = px - uLPos[i]; float dd = length(dv) / uLRad[i]; float f = smoothstep(1., 0., dd); f = f * f; lamp += uLCol[i] * f * (1. + .5 * max(dot(n, -normalize(dv + 1e-3)), 0.) * edge); }
      lit += alb * lamp * 1.6;
      col = col * (1. - w.a) + lit * w.a;
    }
    col += vec3(.9, .95, 1.) * uFlash * 1.5;
    o = vec4(col, 1.);
  }`;

  /* weather particles: rain (kind 0) and snow (kind 1) */
  const VS_PART = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uDPR, uMaxPt, uKind, uCount, uWind, uGroundY;
  out float vBlur, vSeed, vFade, vKind;
  float h(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  void main() {
    float i = float(gl_VertexID);
    float z = pow(h(i * 1.37 + uKind), 1.6);
    float par = mix(.4, 1.4, z);
    vec2 span = uRes + vec2(300.);
    vec2 vel; float size;
    if (uKind < .5) { vel = vec2(uWind * 160. + 20., 620. + 300. * z); size = mix(1.5, 3.5, z); }
    else { vel = vec2(uWind * 50. + 12. * sin(uTime * .3 + i), 28. + 36. * z); size = mix(2., 7., z); }
    vec2 p = vec2(h(i * 2.1), h(i * 3.7)) * span + vel * uTime - vec2(uCamX * uZoom * par, uCamY * uZoom * par);
    p = mod(p, span) - 150.;
    if (uKind > .5) p.x += sin(uTime * (.5 + h(i * 8.)) + i) * 14. * z;
    gl_Position = vec4(p.x / uRes.x * 2. - 1., 1. - p.y / uRes.y * 2., 0., 1.);
    gl_PointSize = min(size * uDPR * (uKind < .5 ? 3. : 1.), uMaxPt);
    vBlur = z; vSeed = h(i * 9.9); vKind = uKind;
    vFade = step(h(i * 11.3), uCount) * step(p.y, uGroundY + 6.);
  }`;
  const FS_PART = `#version 300 es
  precision highp float;
  in float vBlur, vSeed, vFade, vKind; out vec4 o;
  uniform float uNight, uWind;
  void main() {
    if (vFade < .5) discard;
    vec2 q = gl_PointCoord * 2. - 1.;
    if (vKind < .5) {
      /* a slanted streak */
      vec2 dir = normalize(vec2(uWind * .25 + .03, 1.));
      float along = dot(q, dir), across = dot(q, vec2(dir.y, -dir.x));
      float a = smoothstep(.22, 0., abs(across)) * smoothstep(1., .2, abs(along)) * (.35 + .4 * vBlur);
      o = vec4(vec3(.75, .85, 1.) * a * (1. - uNight * .5), a * .7);
    } else {
      float a = smoothstep(1., .2, length(q)) * (.6 + .4 * vBlur);
      o = vec4(vec3(.95, .97, 1.) * a * (1. - uNight * .4), a * .85);
    }
  }`;

  const FS_BRIGHT = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel;
  void main() {
    vec3 c = vec3(0.);
    for (int y = -1; y <= 1; y += 2) for (int x = -1; x <= 1; x += 2) c += texture(uSrc, vUv + vec2(x, y) * uTexel).rgb;
    c *= .25;
    float l = max(c.r, max(c.g, c.b));
    o = vec4(c * smoothstep(.85, 1.9, l), 1.);
  }`;
  const FS_BLUR = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uDir;
  void main() {
    vec3 c = texture(uSrc, vUv).rgb * .2270270;
    c += (texture(uSrc, vUv + uDir * 1.3846154).rgb + texture(uSrc, vUv - uDir * 1.3846154).rgb) * .3162162;
    c += (texture(uSrc, vUv + uDir * 3.2307692).rgb + texture(uSrc, vUv - uDir * 3.2307692).rgb) * .0702703;
    o = vec4(c, 1.);
  }`;
  const FS_FINAL = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uB1, uB2; uniform float uTime, uNight, uWarm, uExposure, uRain; uniform vec2 uRes;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main() {
    vec3 c = texture(uScene, vUv).rgb;
    c += texture(uB1, vUv).rgb * .55 + texture(uB2, vUv).rgb * .45;
    c *= uExposure * 1.15;
    c = aces(c);
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(vec3(l), c, 1.12 - uNight * .25 - uRain * .15);
    c *= mix(vec3(.94, .98, 1.06), vec3(1.05, 1.01, .94), smoothstep(.05, .7, l));
    c = mix(c, c * vec3(1.1, .96, .84), uWarm * .35);
    c = mix(c, c * vec3(.78, .88, 1.15), uNight * .45);
    vec2 v = vUv - .5; c *= 1. - dot(v, v) * (.55 + uNight * .35);
    c = pow(c, vec3(1. / 2.2));
    c += (fract(sin(dot(vUv * uRes + uTime * 61., vec2(12.9898, 78.233))) * 43758.5453) - .5) * .018;
    o = vec4(c, 1.);
  }`;

  /* ---------- plumbing ---------- */
  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
    return s;
  }
  function prog(vs, fs) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function target(w, h) {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  function free(x) { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } }
  function use(pr, tgt) {
    gl.useProgram(pr.p);
    if (tgt) { gl.bindFramebuffer(gl.FRAMEBUFFER, tgt.f); gl.viewport(0, 0, tgt.w, tgt.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, pw, ph); }
    return pr.u;
  }
  function bind(u, name, unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], unit); }
  function draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  const f1 = (u, n, v) => { if (u[n]) gl.uniform1f(u[n], v); };
  const f3 = (u, n, v) => { if (u[n]) gl.uniform3fv(u[n], v); };

  /* ---------- public ---------- */
  function gfxParam() { try { return new URLSearchParams(location.search).get('gfx') || ''; } catch (e) { return ''; } }
  function wanted() { const p = gfxParam(); return p !== 'classic' && p !== '2d'; }
  function startOn() { if (gfxParam() === 'gl') return true; try { const v = localStorage.getItem('castle.gfx'); return v !== 'off' && v !== 'slow'; } catch (e) { return true; } }
  function init(scene) {
    if (!wanted()) return false;
    cv = document.createElement('canvas'); cv.id = 'sceneGL';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) { console.warn('gfx: no WebGL2, keeping the classic look'); cv = null; return false; }
    try {
      hdr = !!gl.getExtension('EXT_color_buffer_float');
      maxPt = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64;
      P.bg = prog(VS, FS_BG); P.scene = prog(VS, FS_SCENE);
      P.part = prog(VS_PART, FS_PART); P.bright = prog(VS, FS_BRIGHT); P.blur = prog(VS, FS_BLUR); P.final = prog(VS, FS_FINAL);
    } catch (e) { console.error('gfx: shader failed, keeping the classic look\n', e); cv = null; gl = null; return false; }
    vao = gl.createVertexArray();
    worldTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, worldTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    world = document.createElement('canvas'); wctx = world.getContext('2d');
    scene.parentNode.insertBefore(cv, scene);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ready = false; on = false; cv.style.display = 'none'; });
    ready = true; on = startOn(); cv.style.display = on ? 'block' : 'none';
    return true;
  }
  function resize(w, h, d, pxW, pxH) {
    if (!ready) return;
    cssW = w; cssH = h; dpr = d; pw = pxW; ph = pxH;
    cv.width = pw; cv.height = ph;
    world.width = pw; world.height = ph;
    for (const k of Object.keys(T)) free(T[k]);
    bgScale = d > 1.5 ? .4 : .5;
    T.bg = target(pw * bgScale, ph * bgScale);
    T.scene = target(pw, ph);
    T.b1a = target(pw / 4, ph / 4); T.b1b = target(pw / 4, ph / 4);
    T.b2a = target(pw / 8, ph / 8); T.b2b = target(pw / 8, ph / 8);
  }
  function active() { return ready && on; }
  function toggle() { if (!ready) return false; on = !on; cv.style.display = on ? 'block' : 'none'; speed.t0 = 0; try { localStorage.setItem('castle.gfx', on ? 'on' : 'off'); } catch (e) {} return on; }
  function worldCtx() { return wctx; }
  function canvas() { return cv; }
  function hexLin(c) { return hexToRgb(c).map(v => Math.pow(v / 255, 2.2)); }

  /* slow device: two 3 s windows under 24 fps after an 8 s warm-up → the classic look, remembered as 'slow' */
  const speed = { t0: 0, last: 0, n: 0, sum: 0, bad: 0 };
  function watchSpeed() {
    const now = performance.now();
    if (!speed.t0) { Object.assign(speed, { t0: now, last: now, n: 0, sum: 0, bad: 0 }); return; }
    const d = now - speed.last; speed.last = now;
    if (now - speed.t0 < 8000 || d > 250 || document.hidden) return;
    speed.n++; speed.sum += d;
    if (speed.sum < 3000) return;
    const fps = speed.n * 1000 / speed.sum; speed.n = 0; speed.sum = 0;
    speed.bad = fps < 24 ? speed.bad + 1 : 0;
    if (speed.bad < 2 || gfxParam() === 'gl') return;
    try { if (localStorage.getItem('castle.gfx') === 'on') return; localStorage.setItem('castle.gfx', 'slow'); } catch (e) {}
    on = false; cv.style.display = 'none';
    console.info('gfx: ' + fps.toFixed(0) + ' fps, switched to the classic look (press O for the painted one)');
  }
  /* L: { night, warm, top, bot, sun{x,y,vis}, moon{x,y,vis}, groundY (screen), cloud, rain, snowing, snow, wind, flash, season (0..3), lights [{x,y,r,i,col,flicker}] (screen px) } */
  function render(G, L) {
    watchSpeed();
    const t0 = performance.now();
    const cam = G.cam, time = G.time;
    const night = L.night, day = 1 - night, cloud = L.cloud;
    const sunT = clamp((G.tod - .22) / .6, 0, 1), elev = Math.sin(Math.PI * sunT);
    const sunCol = [1.0, lerp(.6, .95, Math.min(1, elev * 1.6)), lerp(.32, .86, Math.min(1, elev * 1.4))].map(v => v * (1 - cloud * .4) * 1.1);
    const top = hexLin(L.top), bot = hexLin(L.bot);
    const amb = [lerp(.3, .05, night) * (1 - cloud * .12), lerp(.31, .06, night) * (1 - cloud * .12), lerp(.36, .12, night)];
    const sky = [lerp(top[0], bot[0], .5), lerp(top[1], bot[1], .5), lerp(top[2], bot[2], .5)];
    const sun = [L.sun.x, L.sun.y, L.sun.vis], moon = [L.moon.x, L.moon.y, L.moon.vis];
    /* the lamps, in screen pixels */
    let nl = 0;
    for (const l of L.lights) { if (nl >= NL) break; const fl = l.flicker ? .82 + .18 * Math.sin(time * 11 + l.x * .37) * Math.sin(time * 7.3 + l.y * .51) : 1; lpos[nl * 2] = l.x; lpos[nl * 2 + 1] = l.y; lrad[nl] = l.r * cam.zoom; const k = l.i * fl * (l.fire ? 1 : lerp(.25, 1, night)); lcol[nl * 3] = l.col[0] * k; lcol[nl * 3 + 1] = l.col[1] * k; lcol[nl * 3 + 2] = l.col[2] * k; nl++; }
    const common = (u) => { gl.uniform2f(u.uRes, cssW, cssH); f1(u, 'uTime', time); f1(u, 'uCamX', cam.x); f1(u, 'uCamY', cam.y); f1(u, 'uZoom', cam.zoom); f1(u, 'uDay', day); f1(u, 'uNight', night); f1(u, 'uCloud', cloud); f1(u, 'uGroundY', L.groundY); f1(u, 'uWarm', L.warm); };

    gl.disable(gl.BLEND);
    let u = use(P.bg, T.bg);
    common(u);
    f1(u, 'uMoonPhase', ((G.moon % 1) + 1) % 1); f1(u, 'uSeason', L.season); f1(u, 'uSnow', L.snow);
    f3(u, 'uTop', top); f3(u, 'uBot', bot); f3(u, 'uSun', sun); f3(u, 'uMoon', moon); f3(u, 'uSunCol', sunCol);
    draw();
    const t1 = performance.now();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, worldTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, world);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    lastUp = performance.now() - t1; upMs = upMs * .95 + lastUp * .05;
    u = use(P.scene, T.scene);
    bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex);
    common(u);
    gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); f1(u, 'uDPR', dpr); f1(u, 'uFlash', L.flash || 0);
    f3(u, 'uSun', sun); f3(u, 'uSunCol', sunCol); f3(u, 'uSky', sky); f3(u, 'uAmb', amb);
    gl.uniform1i(u.uNL, nl); if (nl) { gl.uniform2fv(u.uLPos, lpos); gl.uniform3fv(u.uLCol, lcol); gl.uniform1fv(u.uLRad, lrad); }
    draw();
    /* weather */
    if (L.rain > .02 || L.snowing > .02) {
      u = use(P.part, T.scene);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform2f(u.uRes, cssW, cssH); f1(u, 'uTime', time); f1(u, 'uCamX', cam.x); f1(u, 'uCamY', cam.y); f1(u, 'uZoom', cam.zoom);
      f1(u, 'uDPR', dpr); f1(u, 'uMaxPt', maxPt); f1(u, 'uNight', night); f1(u, 'uWind', L.wind); f1(u, 'uGroundY', L.groundY);
      gl.bindVertexArray(vao);
      if (L.rain > .02) { gl.uniform1f(u.uKind, 0); gl.uniform1f(u.uCount, L.rain); gl.drawArrays(gl.POINTS, 0, quality() === 'low' ? 300 : 700); }
      if (L.snowing > .02) { gl.uniform1f(u.uKind, 1); gl.uniform1f(u.uCount, L.snowing); gl.drawArrays(gl.POINTS, 0, quality() === 'low' ? 200 : 450); }
      gl.disable(gl.BLEND);
    }
    /* bloom */
    u = use(P.bright, T.b1a); bind(u, 'uSrc', 0, T.scene.t); gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); draw();
    u = use(P.blur, T.b1b); bind(u, 'uSrc', 0, T.b1a.t); gl.uniform2f(u.uDir, 1 / T.b1a.w, 0); draw();
    u = use(P.blur, T.b1a); bind(u, 'uSrc', 0, T.b1b.t); gl.uniform2f(u.uDir, 0, 1 / T.b1a.h); draw();
    u = use(P.blur, T.b2a); bind(u, 'uSrc', 0, T.b1a.t); gl.uniform2f(u.uDir, 1.5 / T.b2a.w, 0); draw();
    u = use(P.blur, T.b2b); bind(u, 'uSrc', 0, T.b2a.t); gl.uniform2f(u.uDir, 0, 1.5 / T.b2a.h); draw();
    u = use(P.final, null);
    bind(u, 'uScene', 0, T.scene.t); bind(u, 'uB1', 1, T.b1a.t); bind(u, 'uB2', 2, T.b2b.t);
    f1(u, 'uTime', time); f1(u, 'uNight', night); f1(u, 'uWarm', L.warm); f1(u, 'uRain', L.rain); f1(u, 'uExposure', EXPOSURE); gl.uniform2f(u.uRes, cssW, cssH);
    draw();
    frames++;
    gpuMs = gpuMs * .95 + (performance.now() - t0) * .05;
  }
  let qualityFn = () => 'high';
  function quality() { return qualityFn(); }
  function setQualitySource(fn) { qualityFn = fn; }
  function stats() { return { on: active(), hdr, ms: gpuMs, upload: upMs, lastUpload: lastUp, maxPt, bgScale }; }

  return { init, resize, active, toggle, worldCtx, canvas, render, stats, setQualitySource };
})();
