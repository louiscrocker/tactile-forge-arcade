/* ============================================================
   gfx.js — the painted, lit look (on by default; O switches it live)
   ============================================================
     The game still draws the town with Canvas 2D (render.js,
     scene.js, sprites.js, chars.js), but into a transparent layer.
     This module paints what is around it and the light on it, on
     the GPU (Castle's pipeline, re-tuned for a sunny cartoon town):
       background (part res): the level's sky (SKIES) as a soft
         painted gradient, the sun and its glow (or the moon on a
         storm night), drifting painted clouds lit from the sun,
         three bands of hills with the far town's rooftops, hazier
         with distance, sliding with the camera like the classic ones
       scene (full res): the town layer lit by the sun (warm in the
         morning, golden at sunset, blue on a storm night), a soft
         rim of light along the tops of shapes, gentle shade low
         down and a contact shadow at the street, and the street
         lamps, lit windows and sparks as glowing point lights
       particles: rain streaks slanting with the gusts
       bloom (only for really bright things), a gentle highlight
       roll-off that keeps the cartoon colours saturated (no milky
       haze), a warm/cool grade, vignette, grain, the lightning flash
     No libraries; falls back to the Canvas 2D look when WebGL2 is
     missing or a shader fails.  Nothing in the game's logic reads
     from here.
   ============================================================ */
'use strict';

const GFX = (function () {
  let on = false, ready = false, cv = null, gl = null, hdr = false, maxPt = 64;
  let world = null, wctx = null, worldTex = null, vao = null;
  let cssW = 1, cssH = 1, dpr = 1, pw = 1, ph = 1, bgScale = .5;
  const P = {}, T = {};
  let gpuMs = 0, upMs = 0;
  const NL = 32;                                      /* point lights at once */
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

  /* the background: sky, sun or moon, stars, clouds, hills with the far town */
  const FS_BG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uRes; uniform float uTime, uHillCamX, uSkyCamX, uHillBase, uGroundY, uNight, uCloud, uWarm, uFlash;
  uniform vec3 uTop, uMid, uLow, uSun, uSunCol, uH0, uH1, uH2;
  ${LIB}
  float hillY(float wx, float k) { return uHillBase - 150. + k * 45. - sin(wx * .004 + k) * 40. - sin(wx * .011 + k * 3.) * 16.; }
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float H = uRes.y;
    /* --- the sky: the level's three colours, with soft painted bands --- */
    float ty = px.y / H;
    vec3 col = ty < .55 ? mix(uTop, uMid, smoothstep(0., .55, ty)) : mix(uMid, uLow, smoothstep(.55, 1., ty));
    float wash = fbm3(vec2(px.x / H * 1.4 + uSkyCamX * .0004, ty * 5.) + uTime * .004);
    col *= .97 + .06 * wash;
    vec2 sd = (px - uSun.xy) / H; float d = length(sd);
    float day = 1. - uNight;
    /* the sun's glow (warm, not white: keep the blue sky blue) */
    col += uSunCol * (.35 * exp(-d * 16.) + .05 * exp(-d * 4.)) * (1. - .6 * uCloud) * day;
    col = mix(col, uSunCol * vec3(1.5, 1.45, 1.2), smoothstep(29., 26., length(px - uSun.xy)) * day * (1. - .5 * uCloud));
    /* stars and the moon on a storm night */
    if (uNight > .02) {
      vec2 sp = (px + vec2(uSkyCamX * .02, 0.)) / 2.5; vec2 ci = floor(sp); float r = h21(ci);
      if (r > .996) { vec2 f = fract(sp) - .5; float tw = .55 + .45 * sin(uTime * (1.5 + 3. * h21(ci + 7.)) + r * 80.);
        col += vec3(.9, .95, 1.) * smoothstep(.5, .0, length(f)) * uNight * tw * smoothstep(uHillBase - 120., uHillBase * .4, px.y); }
      vec2 md = (px - uSun.xy) / 24.; float mr = length(md);
      col += vec3(.45, .55, .9) * uNight * .35 * exp(-length(px - uSun.xy) / H * 5.);
      if (mr < 1.) {
        vec3 n = vec3(md.x, -md.y, sqrt(1. - mr * mr));
        float lit = smoothstep(-.05, .15, dot(n, normalize(vec3(-.9, .25, .35)))), mare = .78 + .22 * fbm(n.xy * 2.6 + 5.);
        col = mix(col, vec3(1., .97, .88) * (lit * mare * 1.9 + .05), smoothstep(1., .94, mr) * uNight);
      }
    }
    /* painted clouds: soft lumps, lit on top, a little shade beneath */
    float cov = mix(.4, .62, uCloud) - .08 * uNight;
    vec2 cp = vec2((px.x + uSkyCamX * .08) / H + uTime * .008, px.y / H * 2.4);
    float cn = fbm3(cp * vec2(1.6, 1.8) + 3.) * .8 + fbm(cp * 5.) * .28;
    float lim = uHillBase - 60.;
    float dens = smoothstep(1. - cov, 1. - cov + mix(.05, .16, uCloud), cn) * smoothstep(lim, lim * .55, px.y) * smoothstep(-.1, .05, ty);
    vec2 cq = cp + vec2(0., .06);
    float cnU = fbm3(cq * vec2(1.6, 1.8) + 3.) * .8 + fbm(cq * 5.) * .28;
    float shadeK = clamp((cnU - cn) * 7. + .4, 0., 1.);
    vec3 cTop = mix(vec3(1., .99, .96), uSunCol * vec3(1.05, .95, .9), .35 + .4 * uWarm);
    vec3 cBot = mix(uMid, uTop, .35) * .92 + vec3(.06, .05, .08);
    vec3 cc = mix(cTop, cBot, .1 + .65 * shadeK) * (.96 + .08 * n2(px / 3.));
    cc = mix(cc, mix(vec3(.08, .1, .19), vec3(.035, .045, .09), shadeK), uNight);
    col = mix(col, cc, dens * mix(.88, .95, uCloud));
    /* --- three bands of hills, the far town on the middle one, hazier with distance --- */
    vec3 hc3[3]; hc3[0] = uH0; hc3[1] = uH1; hc3[2] = uH2;
    for (int i = 0; i < 3; i++) {
      float k = float(i), par = .15 + k * .15, off = uHillCamX * par, wx = px.x + off;
      float top = hillY(wx, k) + (n1(wx * .05 + k * 9.) - .5) * 3.;
      vec3 hc = hc3[i] * (.93 + .1 * fbm3(vec2(wx * .012, px.y * .02) + k * 4.));
      hc *= 1. + .12 * smoothstep(top + 26., top, px.y) * day;
      float haze = (k == 0. ? .3 : k == 1. ? .16 : .04) * day + (k == 0. ? .15 : .08) * uNight;
      hc = mix(hc, mix(uLow, uMid, .5), haze);
      col = mix(col, hc, smoothstep(top - .8, top + .8, px.y));
      if (i == 1) {
        float m = floor(wx / 140.), lx = wx - m * 140., hh = h11(m * 1.7 + 5.);
        float w = 26. + hh * 20., th = 20. + hh * 24., ry = hillY(m * 140., 1.) + 45.;
        vec3 rc = uH2 * .8 * (.95 + .08 * n1(lx * .2 + m));
        float body = step(0., lx) * step(lx, w) * step(ry - th, px.y);
        float roof = step(ry - th - 14. * (1. - abs(lx - w * .5) / (w * .5 + 4.)), px.y) * step(-4., lx) * step(lx, w + 4.) * step(px.y, ry - th);
        float inHouse = max(body, roof) * step(px.y, ry + 30.);
        rc = mix(rc, mix(uLow, uMid, .5), .1 * day);
        col = mix(col, rc, inHouse);
        if (uNight > .02 && lx > 6. && lx < 11. && px.y > ry - th + 8. && px.y < ry - th + 14.) col = mix(col, vec3(1.4, 1.05, .55), uNight);
      }
    }
    col += vec3(.85, .9, 1.) * uFlash * .5;
    o = vec4(col, 1.);
  }`;

  /* the scene: the town layer lit by the sun and the lamps, over the background */
  const FS_SCENE = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld;
  uniform vec2 uRes, uTexel; uniform float uDPR, uTime, uNight, uCloud, uGroundY, uZoom, uFlash;
  uniform vec3 uSun, uSunCol, uSky, uAmb;
  uniform int uNL; uniform vec2 uLPos[${NL}]; uniform vec3 uLCol[${NL}]; uniform float uLRad[${NL}];
  ${LIB}
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    vec3 col = texture(uBg, vUv).rgb;
    vec4 w = texture(uWorld, vUv);
    /* soft halos of the lamps on the air itself */
    vec3 halo = vec3(0.);
    for (int i = 0; i < ${NL}; i++) { if (i >= uNL) break; float dd = length((px - uLPos[i]) / uLRad[i]); halo += uLCol[i] * exp(-dd * dd * 2.4) * .2; }
    col += halo * (1. - w.a * .6);
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
      float bump = (ly - l0) * .8;
      vec2 L = normalize(uSun.xy - px + 1e-3);
      float sunK = uSun.z * (1. - .45 * uCloud);
      float ndl = max(dot(n, L), 0.) * edge;
      /* about 1.0 on a flat face, brighter along lit edges, a little darker on the shaded ones */
      vec3 light = uAmb + uSunCol * sunK * (.55 + .3 * ndl - .12 * edge * (1. - ndl) + bump * .25) + uSky * top * .25;
      /* gentle shade low down and a contact shadow where things meet the street */
      float gy = uGroundY - px.y;
      if (gy > -2.) { float z = max(uZoom, .3); light *= 1. - .2 * exp(-max(gy, 0.) / (26. * z)) - .07 * (1. - smoothstep(0., 240. * z, gy)); }
      vec3 lit = alb * light;
      lit += uSunCol * sunK * pow(ndl, 1.5) * (.08 + .25 * dot(alb, vec3(.33)));
      /* the lamps and lit windows */
      vec3 lamp = vec3(0.);
      for (int i = 0; i < ${NL}; i++) { if (i >= uNL) break; vec2 dv = px - uLPos[i]; float dd = length(dv) / uLRad[i]; float f = smoothstep(1., 0., dd); f = f * f; lamp += uLCol[i] * f * (1. + .6 * max(dot(n, -normalize(dv + 1e-3)), 0.) * edge); }
      lit += alb * lamp * 1.5;
      col = col * (1. - w.a) + lit * w.a;
    }
    col += vec3(.85, .9, 1.) * uFlash * .9;
    o = vec4(col, 1.);
  }`;

  /* rain streaks, slanting with the wind */
  const VS_PART = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uDPR, uMaxPt, uCount, uWind, uGroundY;
  out float vBlur, vFade;
  float h(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  void main() {
    float i = float(gl_VertexID);
    float z = pow(h(i * 1.37), 1.6), par = mix(.4, 1.4, z);
    vec2 span = uRes + vec2(300.);
    vec2 vel = vec2(uWind * 160. + 20., 620. + 300. * z);
    vec2 p = vec2(h(i * 2.1), h(i * 3.7)) * span + vel * uTime - vec2(uCamX * uZoom * par, uCamY * uZoom * par);
    p = mod(p, span) - 150.;
    gl_Position = vec4(p.x / uRes.x * 2. - 1., 1. - p.y / uRes.y * 2., 0., 1.);
    gl_PointSize = min(mix(1.5, 3.5, z) * uDPR * 3., uMaxPt);
    vBlur = z; vFade = step(h(i * 11.3), uCount) * step(p.y, uGroundY + 30.);
  }`;
  const FS_PART = `#version 300 es
  precision highp float;
  in float vBlur, vFade; out vec4 o;
  uniform float uNight, uWind;
  void main() {
    if (vFade < .5) discard;
    vec2 q = gl_PointCoord * 2. - 1.;
    vec2 dir = normalize(vec2(uWind * .25 + .03, 1.));
    float along = dot(q, dir), across = dot(q, vec2(dir.y, -dir.x));
    float a = smoothstep(.22, 0., abs(across)) * smoothstep(1., .2, abs(along)) * (.35 + .4 * vBlur);
    o = vec4(vec3(.7, .8, 1.) * a * (1. - uNight * .4), a * .7);
  }`;

  const FS_BRIGHT = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThr;
  void main() {
    vec3 c = vec3(0.);
    for (int y = -1; y <= 1; y += 2) for (int x = -1; x <= 1; x += 2) c += texture(uSrc, vUv + vec2(x, y) * uTexel).rgb;
    c *= .25;
    float l = max(c.r, max(c.g, c.b));
    o = vec4(c * smoothstep(uThr, uThr + 1., l), 1.);
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
  /* the grade: a highlight roll-off (not a full filmic curve, which greys cartoon colours),
     a touch more colour, warm or cool by the time of day, vignette, grain */
  const FS_FINAL = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uB1, uB2; uniform float uTime, uNight, uWarm, uExposure, uRain; uniform vec2 uRes;
  vec3 knee(vec3 x) { const float k = .8; vec3 y = k + (1. - k) * (1. - exp(-(x - k) / (1. - k))); return mix(x, y, step(k, x)); }
  void main() {
    vec3 c = texture(uScene, vUv).rgb;
    c += texture(uB1, vUv).rgb * .5 + texture(uB2, vUv).rgb * .4;
    c = knee(max(c * uExposure, 0.));
    c = pow(c, vec3(1. / 2.2));
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(vec3(l), c, 1.1 - uRain * .08);
    c = mix(c, c * vec3(1.05, .99, .92), uWarm * .5);
    c = mix(c, c * vec3(.9, .95, 1.08), uNight * .5);
    vec2 v = vUv - .5; c *= 1. - dot(v, v) * (.2 + uNight * .6);
    c += (fract(sin(dot(vUv * uRes + uTime * 61., vec2(12.9898, 78.233))) * 43758.5453) - .5) * .014;
    o = vec4(c, 1.);
  }`;

  /* the light for each time of day (the classic art is already darker at night, so
     the night ambient stays fairly high: the house and the hazards must stay clear) */
  const LIGHT = {
    morning: { sun: [1.06, .98, .86], amb: [.48, .49, .54], warm: .35, cloud: .1 },
    noon:    { sun: [1.03, 1.01, .96], amb: [.48, .5, .56], warm: 0, cloud: .05 },
    sunset:  { sun: [1.14, .82, .6], amb: [.46, .42, .5], warm: 1, cloud: .25 },
    storm:   { sun: [.5, .6, .9], amb: [.7, .76, .98], warm: 0, cloud: .6, night: 1 }
  };

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
  const KEY = 'smash.gfx';
  function gfxParam() { try { return new URLSearchParams(location.search).get('gfx') || ''; } catch (e) { return ''; } }
  function wanted() { const p = gfxParam(); return p !== 'classic' && p !== '2d'; }
  function startOn() { if (gfxParam() === 'gl') return true; try { const v = localStorage.getItem(KEY); return v !== 'off' && v !== 'slow'; } catch (e) { return true; } }
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
  function available() { return ready; }
  function toggle() { if (!ready) return false; on = !on; cv.style.display = on ? 'block' : 'none'; speed.t0 = 0; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {} return on; }
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
    try { if (localStorage.getItem(KEY) === 'on') return; localStorage.setItem(KEY, 'slow'); } catch (e) {}
    on = false; cv.style.display = 'none';
    console.info('gfx: ' + fps.toFixed(0) + ' fps, switched to the classic look (press O for the painted one)');
  }
  /* L: { tod, sky (a SKIES entry), sun{x,y} (screen), groundY, hillBase (screen), hillCamX, skyCamX,
          camX, camY, zoom, time, rain 0..1, wind, flash 0..1, lights [{x,y,r,col,i}] (screen px) } */
  function render(L) {
    watchSpeed();
    const t0 = performance.now(), S = L.sky, Lt = LIGHT[L.tod] || LIGHT.noon;
    const night = Lt.night ? 1 : 0, cloud = Math.max(Lt.cloud, L.rain * .85), time = L.time;
    const sunCol = Lt.sun.map(v => v * (1 - cloud * .25));
    const top = hexLin(S.top), mid = hexLin(S.mid), low = hexLin(S.low);
    const sky = mid.map((v, i) => lerp(top[i], v, .5) * (night ? .6 : 1));
    const sun = [L.sun.x, L.sun.y, 1];
    let nl = 0;
    /* the ones on screen, strongest first (the fix-me glows and lamps win over far windows) */
    const vis = L.lights.filter(l => !(l.x < -l.r || l.x > cssW + l.r || l.y < -l.r || l.y > cssH + l.r)).sort((a, b) => b.i - a.i);
    for (const l of vis) {
      if (nl >= NL) break;
      lpos[nl * 2] = l.x; lpos[nl * 2 + 1] = l.y; lrad[nl] = Math.max(4, l.r);
      lcol[nl * 3] = l.col[0] * l.i; lcol[nl * 3 + 1] = l.col[1] * l.i; lcol[nl * 3 + 2] = l.col[2] * l.i; nl++;
    }
    gl.disable(gl.BLEND);
    let u = use(P.bg, T.bg);
    gl.uniform2f(u.uRes, cssW, cssH); f1(u, 'uTime', time); f1(u, 'uHillCamX', L.hillCamX); f1(u, 'uSkyCamX', L.skyCamX);
    f1(u, 'uHillBase', L.hillBase); f1(u, 'uGroundY', L.groundY); f1(u, 'uNight', night); f1(u, 'uCloud', cloud); f1(u, 'uWarm', Lt.warm); f1(u, 'uFlash', L.flash);
    f3(u, 'uTop', top); f3(u, 'uMid', mid); f3(u, 'uLow', low); f3(u, 'uSun', sun); f3(u, 'uSunCol', night ? [.9, .9, 1] : sunCol);
    f3(u, 'uH0', hexLin(S.hill[0])); f3(u, 'uH1', hexLin(S.hill[1])); f3(u, 'uH2', hexLin(S.hill[2]));
    draw();
    const t1 = performance.now();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, worldTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, world);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    upMs = upMs * .95 + (performance.now() - t1) * .05;
    u = use(P.scene, T.scene);
    bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform2f(u.uTexel, 1 / pw, 1 / ph);
    f1(u, 'uDPR', dpr); f1(u, 'uTime', time); f1(u, 'uNight', night); f1(u, 'uCloud', cloud); f1(u, 'uGroundY', L.groundY); f1(u, 'uZoom', L.zoom); f1(u, 'uFlash', L.flash);
    f3(u, 'uSun', [sun[0], sun[1], night ? .5 : 1]); f3(u, 'uSunCol', sunCol); f3(u, 'uSky', sky); f3(u, 'uAmb', Lt.amb);
    gl.uniform1i(u.uNL, nl); if (nl) { gl.uniform2fv(u.uLPos, lpos); gl.uniform3fv(u.uLCol, lcol); gl.uniform1fv(u.uLRad, lrad); }
    draw();
    if (L.rain > .02) {
      u = use(P.part, T.scene);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform2f(u.uRes, cssW, cssH); f1(u, 'uTime', time); f1(u, 'uCamX', L.camX); f1(u, 'uCamY', L.camY); f1(u, 'uZoom', L.zoom);
      f1(u, 'uDPR', dpr); f1(u, 'uMaxPt', maxPt); f1(u, 'uNight', night); f1(u, 'uWind', L.wind); f1(u, 'uGroundY', L.groundY); f1(u, 'uCount', L.rain);
      gl.bindVertexArray(vao); gl.drawArrays(gl.POINTS, 0, 700);
      gl.disable(gl.BLEND);
    }
    /* bloom: only the really bright things (the sun, lamps, lit windows, sparks) */
    u = use(P.bright, T.b1a); bind(u, 'uSrc', 0, T.scene.t); gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); f1(u, 'uThr', night ? .75 : .95); draw();
    u = use(P.blur, T.b1b); bind(u, 'uSrc', 0, T.b1a.t); gl.uniform2f(u.uDir, 1 / T.b1a.w, 0); draw();
    u = use(P.blur, T.b1a); bind(u, 'uSrc', 0, T.b1b.t); gl.uniform2f(u.uDir, 0, 1 / T.b1a.h); draw();
    u = use(P.blur, T.b2a); bind(u, 'uSrc', 0, T.b1a.t); gl.uniform2f(u.uDir, 1.5 / T.b2a.w, 0); draw();
    u = use(P.blur, T.b2b); bind(u, 'uSrc', 0, T.b2a.t); gl.uniform2f(u.uDir, 0, 1.5 / T.b2a.h); draw();
    u = use(P.final, null);
    bind(u, 'uScene', 0, T.scene.t); bind(u, 'uB1', 1, T.b1a.t); bind(u, 'uB2', 2, T.b2b.t);
    f1(u, 'uTime', time); f1(u, 'uNight', night); f1(u, 'uWarm', Lt.warm); f1(u, 'uRain', L.rain); f1(u, 'uExposure', EXPOSURE); gl.uniform2f(u.uRes, cssW, cssH);
    draw();
    gpuMs = gpuMs * .95 + (performance.now() - t0) * .05;
  }
  function stats() { return { on: active(), hdr, ms: gpuMs, upload: upMs, maxPt, bgScale }; }

  return { init, resize, active, available, toggle, worldCtx, canvas, render, stats };
})();
