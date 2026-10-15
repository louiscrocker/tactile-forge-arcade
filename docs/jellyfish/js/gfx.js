/* ============================================================
   gfx.js — the WebGL2 look under the sea (?gfx=gl; O switches it live)
   ============================================================
     The game still draws its world with Canvas 2D (render.js),
     but into a transparent layer. This module paints the sea
     around it and the light through it, on the GPU:
       background (part res): the water you are in, blue-green and
         darker with depth; the bright rippling underside of the
         surface; the sky, the sun, the moon (a lit sphere in its
         phase), stars and clouds above the waterline; three bands
         of far boulders and kelp fading into the water's colour
       light shafts: sunlight broken up by the waves, streaming
         down at a slant, blocked by whatever the world puts in
         front of it (kelp, rocks, jellies)
       scene (full res): the world layer lit from above by light
         that loses its red with depth, caustics dancing on the
         sea floor and on animals near the surface, a rim of light
         along the tops of shapes, haze into the water's colour
       particles: marine snow drifting down (the near specks large
         and soft, glinting in the shafts), and on dark nights the
         blue-green sparks of glowing plankton
       bloom, filmic tone mapping, a sea grade, vignette, grain
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
  const EXPOSURE = (() => { try { const v = +new URLSearchParams(location.search).get('exposure'); return v > 0 ? v : 1; } catch (e) { return 1; } })();
  const NS = 33;                                       /* surface samples across the screen */
  const surf = new Float32Array(NS);

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
  uniform float uSurf[${NS}];
  /* the surface's screen y at a screen x */
  float surfAt(float x, float w) { float f = clamp(x / w, 0., 1.) * ${NS - 1}.; int i = int(min(floor(f), ${NS - 2}.)); return mix(uSurf[i], uSurf[i + 1], f - float(i)); }
  /* the water's own colour at a depth (world units below the surface), linear; a temperate bay's green-blue */
  uniform float uNightW, uWinterW, uStormW;
  vec3 water(float d) {
    vec3 c0 = vec3(.04, .2, .3), c1 = vec3(.014, .11, .24), c2 = vec3(.005, .05, .13), c3 = vec3(.0022, .022, .062), c4 = vec3(.0007, .007, .02);
    vec3 c = d < 60. ? mix(c0, c1, d / 60.) : d < 200. ? mix(c1, c2, (d - 60.) / 140.) : d < 420. ? mix(c2, c3, (d - 200.) / 220.) : mix(c3, c4, clamp((d - 420.) / 300., 0., 1.));
    c = mix(c, vec3(dot(c, vec3(.3, .5, .2))) * vec3(.8, 1., 1.05), uWinterW * .3 + uStormW * .35);   /* greyer in winter and storms */
    return c * mix(1., .26, uNightW) + vec3(.0015, .005, .011) * uNightW;
  }
  /* sunlight on the floor: the tileable water caustic, sharpened */
  float caustic(vec2 uv, float time) {
    vec2 p = mod(uv * 6.2831853, 6.2831853) - 250.;
    vec2 i = p; float c = 1., inten = .005;
    for (int n = 0; n < 4; n++) {
      float t = time * (1. - (3.5 / float(n + 1)));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      c += 1. / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
    }
    c /= 4.; c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 7.);
  }
  `;

  /* the background: water, the surface from below, sky above, far boulders and kelp (alpha = light-shaft source) */
  const FS_BG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uSeaLevel, uDay, uNight, uCloud, uMoonPhase, uFloorY, uFarK, uSlant;
  uniform vec3 uTop, uBot, uSun, uMoon, uSunCol;
  ${LIB}
  /* a band of far boulders with kelp standing among them: 1 inside, plus the distance below the skyline */
  float band(float ix, float iy, float sp, float seed, float kelpSp, float kh, float t, out float rimD) {
    float c = floor(ix / sp), top = 0.;
    for (int k = -1; k <= 1; k++) {
      float ci = c + float(k), cx = (ci + .3 + .4 * h11(ci * 3.1 + seed)) * sp, r = sp * (.35 + .5 * h11(ci * 7.7 + seed));
      float hk = .4 + .3 * h11(ci * 1.9 + seed), u = (ix - cx) / r;
      if (abs(u) < 1.) top = max(top, r * hk * sqrt(1. - u * u) * (1. + .06 * (n1(ix * .05 + ci) - .5)));
    }
    rimD = top - iy;
    float inside = step(iy, top);
    /* kelp: a stipe and a wavy blade, swaying a little */
    float kc = floor(ix / kelpSp);
    for (int k = 0; k <= 1; k++) {
      float ci = kc + float(k) - .5 * float(k), kx = (floor(ci) + h11(floor(ci) * 5.3 + seed)) * kelpSp;
      float H = kh * (.4 + .55 * h11(floor(ci) * 2.7 + seed)), v = iy / H;
      if (v < 0. || v > 1.) continue;
      float sway = sin(v * 6. + floor(ci)) * 14. + sin(t * .6 + floor(ci)) * 10. * v;
      float w = 2. + 8. * (1. - v) * (.5 + .5 * sin(v * 9. + t + floor(ci)));
      inside = max(inside, smoothstep(w + 1.5, w - 1.5, abs(ix - kx - sway)) * .9);
    }
    return inside;
  }
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float H = uRes.y;
    float wx = (px.x - uRes.x * .5) / uZoom + uCamX, wy = (px.y - uRes.y * .5) / uZoom + uCamY;
    float sy = surfAt(px.x, uRes.x);
    vec3 col; float src;
    if (px.y < sy) {
      /* --- above the waterline: the sky --- */
      float ty = clamp(px.y / max(sy, 60.), 0., 1.);
      col = mix(uTop, uBot, pow(ty, .85));
      vec2 sd = (px - uSun.xy) / H; float d = length(sd);
      col += uSunCol * uSun.z * (.9 * exp(-d * 10.) + .12 * exp(-d * 3.)) * (1. - .6 * uCloud);
      col += uSunCol * smoothstep(26., 23., length(px - uSun.xy)) * 9. * uSun.z * (1. - uCloud);
      if (uNight > .02) {
        vec2 sp = (px + vec2(uCamX * uZoom * .01, 0.)) / 2.5; vec2 ci = floor(sp); float r = h21(ci);
        if (r > .9965) { vec2 f = fract(sp) - .5; float tw = .55 + .45 * sin(uTime * (1.5 + 3. * h21(ci + 7.)) + r * 80.);
          col += vec3(.9, .95, 1.) * smoothstep(.5, .0, length(f)) * uNight * tw * (1. - uCloud) * 1.6 * smoothstep(sy, sy * .6, px.y); }
      }
      if (uMoon.z > .001) {
        vec2 md = (px - uMoon.xy) / 28.; float mr = length(md);
        col += vec3(.55, .65, 1.) * uMoon.z * (.25 * exp(-length(px - uMoon.xy) / H * 7.));
        if (mr < 1.) {
          vec3 n = vec3(md.x, -md.y, sqrt(1. - mr * mr));
          float a = uMoonPhase * 6.2831853; vec3 L = vec3(sin(a), 0., -cos(a));
          float lit = smoothstep(-.04, .1, dot(n, L)), mare = .72 + .28 * fbm(n.xy * 2.6 + 5.);
          col = mix(col, vec3(1., .97, .9) * (lit * mare * 1.8 + .035), smoothstep(1., .96, mr) * uMoon.z);
        }
      }
      float cov = mix(.38, .92, uCloud);
      vec2 cp = vec2((px.x + uCamX * uZoom * .03) / H + uTime * .004, px.y / H * 3.2);
      float cn = fbm(cp * vec2(2.2, 1.4) + vec2(fbm3(cp * 1.3 + uTime * .01), fbm3(cp * 1.3 + 9.)) * .8);
      float dens = smoothstep(1. - cov, 1. - cov + .3, cn) * smoothstep(sy, sy * .5, px.y);
      vec3 cc = mix(uBot * .8 + vec3(.05), uSunCol * 1.1, .5 * uSun.z * (1. - uCloud * .7));
      cc = mix(cc, vec3(.05, .06, .1), uNight * .85);
      col = mix(col, cc, dens * .85);
      /* the sea's far edge: a glint line where the water meets the sky */
      col += vec3(.7, .85, 1.) * exp(-(sy - px.y) / 3.) * .25 * (uDay + .2);
      src = .45 * uDay * (1. - .6 * uCloud) + .03;
    } else {
      /* --- under the water --- */
      float d = max(0., wy - uSeaLevel), u = px.y - sy;
      col = water(d);
      /* light falls off from the surface; a soft glow below where the sun is */
      col *= 1. + .3 * uDay * exp(-d / 45.);
      col += uSunCol * toLin(vec3(.55, .85, .9)) * uDay * (1. - .6 * uCloud) * .08 * exp(-abs(px.x - uSun.x) / (uRes.x * .3)) * exp(-d / 100.);
      col += vec3(.25, .35, .55) * uMoon.z * .06 * exp(-abs(px.x - uMoon.x) / (uRes.x * .2)) * exp(-d / 120.);
      /* the surface seen from below: a bright skin, rippling cells of light, the sky's glow through Snell's window */
      float skin = exp(-u / (1.5 + uZoom * .7));
      float rip = caustic(vec2(wx * .012 + uTime * .02, uTime * .05 + wx * .003), uTime * .4);
      float under = exp(-u / (10. + 14. * uZoom));
      vec3 surfCol = mix(toLin(vec3(.62, .86, .9)), uSunCol, .25) * (uDay * (1. - .5 * uCloud) + .06 + uMoon.z * .12);
      col += surfCol * (skin * 1. + under * (.2 + 1.1 * rip) * .45);
      /* far boulders and kelp, three bands, blue with distance */
      if (uFarK > .01) {
        float t = uTime;
        for (int i = 0; i < 3; i++) {
          float fi = float(i), par = fi == 0. ? .12 : fi == 1. ? .24 : .4, z = min(1., uZoom) * (.6 + fi * .15);
          float base = (uFloorY + 40. - fi * 30. - uCamY) * uZoom + uRes.y * .5;
          float ix = (px.x + uCamX * uZoom * par) / z + fi * 517., iy = (base - px.y) / z;
          float rimD;
          float inB = band(ix, iy, fi == 0. ? 150. : fi == 1. ? 170. : 200., fi * 13.1, fi == 0. ? 200. : fi == 1. ? 146. : 114., (300. + fi * 40.) * .95, t + fi, rimD);
          inB = max(inB, step(iy, 0.));
          float k = (fi == 0. ? .32 : fi == 1. ? .48 : .62) * uFarK;
          vec3 bc = water(d + 160. + fi * 60.) * (.55 - fi * .1);
          bc += water(d) * .5 * exp(-max(rimD, 0.) / 4.) * uDay;          /* light catching the tops */
          col = mix(col, bc, inB * k);
        }
      }
      float xs = wx - d * uSlant;
      float shaft = n1(xs * .021 + uTime * .06) * n1(xs * .047 - uTime * .09 + 3.) * n1(xs * .009 + 7.);
      src = uDay * (1. - .75 * uCloud) * exp(-d / 260.) * (.02 + 2.4 * shaft * shaft) * (.6 + .4 * exp(-u / 40.));
    }
    o = vec4(col, clamp(src, 0., 1.));
  }`;

  /* the light-shaft source: open water and sky, minus whatever the world puts in the way */
  const FS_OCC = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld;
  void main() { float s = texture(uBg, vUv).a * (1. - texture(uWorld, vUv).a * .92); o = vec4(vec3(s), 1.); }`;

  /* march up the slant towards the surface, gathering the light that gets through */
  const FS_RAYS = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uSrc; uniform vec2 uStep; uniform float uSeed;
  void main() {
    vec2 uv = vUv + uStep * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
    float illum = 1., acc = 0., wsum = 0.;
    for (int i = 0; i < 48; i++) { acc += texture(uSrc, uv).r * illum; wsum += illum; uv += uStep; illum *= .97; }
    o = vec4(vec3(acc / wsum), 1.);
  }`;

  /* the scene: the water, the world lit from above with caustics and a rim, the shafts, haze */
  const FS_SCENE = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld, uRays;
  uniform vec2 uRes, uTexel; uniform float uDPR, uTime, uCamX, uCamY, uZoom, uSeaLevel, uDay, uNight, uCloud, uUnder, uRayK, uHaze, uCaus;
  uniform vec3 uSun, uSunCol, uMoon, uAbove, uSky;
  ${LIB}
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float wx = (px.x - uRes.x * .5) / uZoom + uCamX, wy = (px.y - uRes.y * .5) / uZoom + uCamY;
    float sy = surfAt(px.x, uRes.x);
    bool under = px.y >= sy;
    float d = max(0., wy - uSeaLevel);
    vec3 col = texture(uBg, vUv).rgb;
    vec4 w = texture(uWorld, vUv);
    /* the light that reaches this depth: red goes first, then green */
    vec3 down = exp(-d * vec3(1. / 480., 1. / 640., 1. / 700.));
    vec3 sunIn = uSunCol * uDay * (1. - .55 * uCloud) * down;
    vec3 moonIn = vec3(.3, .42, .7) * (uMoon.z * .35 + uNight * .12) * down;
    vec3 wc = water(d);
    if (w.a > .002) {
      vec3 alb = toLin(w.rgb / w.a);
      vec2 g = vec2(0.); float avg = 0.;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * .7853982; vec2 dir = vec2(cos(a), sin(a));
        float s1 = texture(uWorld, vUv + dir * uTexel * 2.5 * uDPR).a, s2 = texture(uWorld, vUv + dir * uTexel * 6. * uDPR).a;
        g += dir * (s1 + s2 * .6); avg += s1 * .6 + s2 * .4;
      }
      avg /= 8.;
      vec2 n = -g; float nl = length(n); n = nl > 1e-4 ? n / nl : vec2(0.);
      n.y = -n.y;                                  /* now in screen space, y down */
      float edge = clamp((1. - avg) * 1.6, 0., 1.);
      float top = edge * max(-n.y, 0.), bot = edge * max(n.y, 0.);
      float l0 = dot(w.rgb, vec3(.33)), ly = dot(texture(uWorld, vUv - vec2(0., uTexel.y * uDPR)).rgb, vec3(.33));
      float bump = (ly - l0) * 1.5;                 /* a little relief from the art: brighter where it faces up */
      vec3 lit;
      if (under) {
        float diff = .78 + .3 * top - .22 * bot + bump * .25;
        float cs = caustic(vec2(wx * .011, wy * .006 + wx * .002), uTime * .45) * uCaus * exp(-d / 380.) * (1. - uUnder) * 1.6;
        vec3 amb = wc * 2. + vec3(.04, .05, .062) * (1. - uNight * .6) + vec3(.012, .018, .034) * uNight;
        lit = alb * (amb * .8 + (sunIn + moonIn) * diff * 1.05 + sunIn * cs * (.7 + top * 1.1));
        lit += (sunIn * .9 + moonIn * 2.) * edge * pow(max(-n.y, 0.), 1.5) * (.25 + .9 * dot(alb, vec3(.33)));
        lit += vec3(.03, .055, .065) * edge * (.35 + .65 * max(-n.y, 0.)) * (1. - uUnder * .5);   /* a soft outline so shapes read even in the deep */
        float hz = clamp(uHaze + smoothstep(250., 750., d) * .05, 0., .8);
        lit = mix(lit, wc * 1.6, hz);
      } else {
        /* above the waterline: the shore, the dock and its boat in the open air */
        vec2 L = normalize(uSun.xy - px + 1e-3);
        float rim = edge * pow(max(dot(n, L), 0.), 1.5) * uSun.z;
        lit = alb * (uAbove + uSky * top * .25) + uSunCol * rim * (.25 + .9 * dot(alb, vec3(.33)));
      }
      col = col * (1. - w.a) + lit * w.a;
    }
    if (under) {
      vec3 rays = texture(uRays, vUv).rgb;
      col += rays * mix(uSunCol, toLin(vec3(.7, .95, 1.)), .5) * uRayK * (1. - w.a * .6) * (1. - uUnder);
    }
    o = vec4(col, 1.);
  }`;

  /* particles: marine snow (all the time), glowing plankton (on dark nights) */
  const VS_PART = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uDPR, uMaxPt, uKind, uCount, uSurfY;
  uniform sampler2D uRays;
  out float vBlur, vSeed, vGlow, vFade;
  float h(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  void main() {
    float i = float(gl_VertexID);
    float z = pow(h(i * 1.37 + uKind), 2.2);          /* 0 far … 1 right in front of the camera */
    float par = mix(.2, 1.6, z);
    vec2 span = uRes + vec2(200.);
    vec2 vel; float size;
    if (uKind < .5) { vel = vec2(5. * sin(uTime * .2 + i) + 4., 5. + 9. * h(i * 5.1)) * (.4 + z); size = mix(1.4, 22., z * z * z); }
    else { vel = vec2(8. * sin(uTime * .3 + i * 3.), 5. * cos(uTime * .4 + i)); size = mix(2., 9., z); }
    vec2 p = vec2(h(i * 2.1), h(i * 3.7)) * span + vel * uTime - vec2(uCamX * uZoom * par, uCamY * uZoom * par);
    p = mod(p, span) - 100.;
    p.x += sin(uTime * (.4 + h(i * 8.)) + i) * 10. * z;
    gl_Position = vec4(p.x / uRes.x * 2. - 1., 1. - p.y / uRes.y * 2., 0., 1.);
    gl_PointSize = min(size * uDPR, uMaxPt);
    vBlur = smoothstep(.4, 1., z);
    vSeed = h(i * 9.9);
    vGlow = textureLod(uRays, vec2(p.x / uRes.x, 1. - p.y / uRes.y), 0.).r;
    vFade = step(h(i * 11.3), uCount) * step(uSurfY + 4., p.y);
  }`;
  const FS_PART = `#version 300 es
  precision highp float;
  in float vBlur, vSeed, vGlow, vFade; out vec4 o;
  uniform float uKind, uTime, uNight, uDay; uniform vec3 uSunCol, uSnowCol;
  void main() {
    if (vFade < .5) discard;
    vec2 q = gl_PointCoord * 2. - 1.;
    if (uKind < .5) {
      float soft = .1 + vBlur * .85;
      float a = smoothstep(1., 1. - soft - .25, length(q)) * (.55 - vBlur * .35);
      vec3 c = uSnowCol + uSunCol * vGlow * 3.5 * uDay;
      o = vec4(c * a, a * .6);
    } else {
      float blink = pow(max(0., sin(uTime * (1.1 + vSeed * 1.7) + vSeed * 40.)), 8.);
      float a = exp(-dot(q, q) * 3.5) * blink * uNight;
      o = vec4(vec3(.25, 1., .85) * a * 3.5, 0.);
    }
  }`;

  /* bloom: a soft bright pass, then blurs at quarter and eighth size */
  const FS_BRIGHT = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel;
  void main() {
    vec3 c = vec3(0.);
    for (int y = -1; y <= 1; y += 2) for (int x = -1; x <= 1; x += 2) c += texture(uSrc, vUv + vec2(x, y) * uTexel).rgb;
    c *= .25;
    float l = max(c.r, max(c.g, c.b));
    o = vec4(c * smoothstep(.8, 1.8, l), 1.);
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
  /* the final image: bloom, exposure, filmic curve, a sea grade, vignette, grain */
  const FS_FINAL = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uB1, uB2; uniform float uTime, uNight, uWarm, uUnder, uExposure, uDeep; uniform vec2 uRes;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main() {
    vec3 c = texture(uScene, vUv).rgb;
    c += texture(uB1, vUv).rgb * .6 + texture(uB2, vUv).rgb * .5;
    c *= uExposure * 1.08 * (1. + uDeep * .5);   /* the eye adapts in the deep */
    c = aces(c);
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(vec3(l), c, 1.1 - uNight * .3);                                          /* saturation; colour drains a little at night */
    c *= mix(vec3(.9, 1., 1.06), vec3(1.04, 1.01, .95), smoothstep(.05, .7, l));      /* cool, sea-green shadows, warm highlights */
    c = mix(c, c * vec3(1.08, .97, .86), uWarm * .3);                                 /* low sun */
    c = mix(c, c * vec3(.8, .92, 1.15), uNight * .4);                                 /* moonlight */
    vec2 v = vUv - .5; c *= 1. - dot(v, v) * (.7 + uNight * .3 + uUnder * .5 + uDeep * .3);
    c = pow(c, vec3(1. / 2.2));
    c += (fract(sin(dot(vUv * uRes + uTime * 61., vec2(12.9898, 78.233))) * 43758.5453) - .5) * .02;
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
  /* on by default; ?gfx=classic keeps the Canvas 2D look, ?gfx=gl forces this one, O flips it (remembered) */
  function gfxParam() { try { return new URLSearchParams(location.search).get('gfx') || ''; } catch (e) { return ''; } }
  function wanted() { const p = gfxParam(); return p !== 'classic' && p !== '2d'; }
  function startOn() { if (gfxParam() === 'gl') return true; try { const v = localStorage.getItem('jellyfish.gfx'); return v !== 'off' && v !== 'slow'; } catch (e) { return true; } }
  function init(scene) {
    if (!wanted()) return false;
    cv = document.createElement('canvas'); cv.id = 'sceneGL';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) { console.warn('gfx: no WebGL2, keeping the Canvas 2D look'); cv = null; return false; }
    try {
      hdr = !!gl.getExtension('EXT_color_buffer_float');
      maxPt = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64;
      P.bg = prog(VS, FS_BG); P.occ = prog(VS, FS_OCC); P.rays = prog(VS, FS_RAYS); P.scene = prog(VS, FS_SCENE);
      P.part = prog(VS_PART, FS_PART); P.bright = prog(VS, FS_BRIGHT); P.blur = prog(VS, FS_BLUR); P.final = prog(VS, FS_FINAL);
    } catch (e) { console.error('gfx: shader failed, keeping the Canvas 2D look\n', e); cv = null; gl = null; return false; }
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
    T.occ = target(pw / 4, ph / 4); T.rays = target(pw / 4, ph / 4);
    T.scene = target(pw, ph);
    T.b1a = target(pw / 4, ph / 4); T.b1b = target(pw / 4, ph / 4);
    T.b2a = target(pw / 8, ph / 8); T.b2b = target(pw / 8, ph / 8);
  }
  function active() { return ready && on; }
  function toggle() { if (!ready) return false; on = !on; cv.style.display = on ? 'block' : 'none'; speed.t0 = 0; try { localStorage.setItem('jellyfish.gfx', on ? 'on' : 'off'); } catch (e) {} return on; }
  function worldCtx() { return wctx; }
  function canvas() { return cv; }
  function hexLin(c) { return hexToRgb(c).map(v => Math.pow(v / 255, 2.2)); }

  /* L: { night, warm, deep, top, bot, sun{x,y,vis}, moon{x,y,vis}, seaLevel, surf(sx) → screen y, floorY, farK, winter, underground } */
  /* slow device: if the painted look cannot keep up (two 3 s windows under 24 fps after an 8 s
     warm-up while the art is painted), fall back to the classic look and remember it as 'slow'.
     ?gfx=gl, or choosing the painted look with O (stored 'on'), keeps it on. */
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
    try { if (localStorage.getItem('jellyfish.gfx') === 'on') return; localStorage.setItem('jellyfish.gfx', 'slow'); } catch (e) {}
    on = false; cv.style.display = 'none';
    console.info('gfx: ' + fps.toFixed(0) + ' fps, switched to the classic look (press O for the painted one)');
  }
  function render(G, L) {
    watchSpeed();
    const t0 = performance.now();
    const cam = G.cam, Wd = G.world, weather = Wd.weather, time = G.time;
    const night = L.night, day = 1 - night, cloud = weather.cloud, storm = weather.storm || 0;
    const sunT = clamp((G.tod - .22) / .6, 0, 1), elev = Math.sin(Math.PI * sunT);
    const sunCol = [1.0, lerp(.6, .95, Math.min(1, elev * 1.6)), lerp(.32, .86, Math.min(1, elev * 1.4))].map(v => v * (1 - cloud * .5) * 1.25);
    const top = hexLin(L.top), bot = hexLin(L.bot);
    const above = [lerp(1, 70 / 255, night * .8), lerp(1, 92 / 255, night * .8), lerp(1, 150 / 255, night * .8)].map(v => Math.pow(v, 1.6) * (1 - cloud * .3));
    const sky = [lerp(top[0], bot[0], .6), lerp(top[1], bot[1], .6), lerp(top[2], bot[2], .6)];
    const sun = [L.sun.x, L.sun.y, L.sun.vis], moon = [L.moon.x, L.moon.y, L.moon.vis];
    for (let i = 0; i < NS; i++) surf[i] = L.surf(i / (NS - 1) * cssW);
    const surfMid = Math.min(...surf);
    const common = (u) => {
      gl.uniform2f(u.uRes, cssW, cssH); f1(u, 'uTime', time); f1(u, 'uCamX', cam.x); f1(u, 'uCamY', cam.y); f1(u, 'uZoom', cam.zoom);
      f1(u, 'uSeaLevel', L.seaLevel); f1(u, 'uDay', day); f1(u, 'uNight', night); f1(u, 'uCloud', cloud);
      f1(u, 'uNightW', night); f1(u, 'uWinterW', L.winter ? 1 : 0); f1(u, 'uStormW', storm);
      if (u.uSurf) gl.uniform1fv(u.uSurf, surf);
    };

    gl.disable(gl.BLEND);
    /* 1. the background */
    let u = use(P.bg, T.bg);
    common(u);
    f1(u, 'uMoonPhase', ((G.moon % 1) + 1) % 1); f1(u, 'uFloorY', L.floorY); f1(u, 'uFarK', L.farK); f1(u, 'uSlant', .32);
    f3(u, 'uTop', top); f3(u, 'uBot', bot); f3(u, 'uSun', sun); f3(u, 'uMoon', moon); f3(u, 'uSunCol', sunCol);
    draw();
    /* 2. the world layer, as drawn by render.js this frame */
    const t1 = performance.now();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, worldTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, world);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    lastUp = performance.now() - t1; upMs = upMs * .95 + lastUp * .05;
    /* 3. light shafts: up the slant towards the surface */
    u = use(P.occ, T.occ); bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); draw();
    u = use(P.rays, T.rays); bind(u, 'uSrc', 0, T.occ.t);
    const reach = .55 / 48;
    gl.uniform2f(u.uStep, -.32 * reach * cssH / cssW, reach); gl.uniform1f(u.uSeed, (frames % 64) * .37); draw();
    /* 4. the scene */
    u = use(P.scene, T.scene);
    bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); bind(u, 'uRays', 2, T.rays.t);
    common(u);
    gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); f1(u, 'uDPR', dpr);
    f1(u, 'uUnder', L.underground ? 1 : 0); f1(u, 'uRayK', L.underground ? 0 : .85);
    f1(u, 'uHaze', clamp(.04 + storm * .25 + (L.winter ? .02 : 0), 0, .6)); f1(u, 'uCaus', (1 - cloud * .7) * 1.0);
    f3(u, 'uSun', sun); f3(u, 'uSunCol', sunCol); f3(u, 'uMoon', moon); f3(u, 'uAbove', above); f3(u, 'uSky', sky);
    draw();
    /* 5. particles, into the scene */
    if (!L.underground) {
      const kinds = [[0, quality() === 'low' ? 220 : 520, clamp(.55 + L.deep * .45 + storm * .3, 0, 1)]];
      if (night > .35) kinds.push([1, 200, clamp((night - .35) * 1.6, 0, 1)]);
      u = use(P.part, T.scene);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      bind(u, 'uRays', 0, T.rays.t);
      gl.uniform2f(u.uRes, cssW, cssH); f1(u, 'uTime', time); f1(u, 'uCamX', cam.x); f1(u, 'uCamY', cam.y); f1(u, 'uZoom', cam.zoom);
      f1(u, 'uDPR', dpr); f1(u, 'uMaxPt', maxPt); f1(u, 'uNight', night); f1(u, 'uDay', day); f1(u, 'uSurfY', surfMid);
      const sc = [.06 + .1 * day, .09 + .14 * day, .1 + .14 * day];
      f3(u, 'uSunCol', sunCol); f3(u, 'uSnowCol', sc);
      gl.bindVertexArray(vao);
      for (const [kind, n, amount] of kinds) { gl.uniform1f(u.uKind, kind); gl.uniform1f(u.uCount, amount); gl.drawArrays(gl.POINTS, 0, n); }
      gl.disable(gl.BLEND);
    }
    /* 6. bloom */
    u = use(P.bright, T.b1a); bind(u, 'uSrc', 0, T.scene.t); gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); draw();
    u = use(P.blur, T.b1b); bind(u, 'uSrc', 0, T.b1a.t); gl.uniform2f(u.uDir, 1 / T.b1a.w, 0); draw();
    u = use(P.blur, T.b1a); bind(u, 'uSrc', 0, T.b1b.t); gl.uniform2f(u.uDir, 0, 1 / T.b1a.h); draw();
    u = use(P.blur, T.b2a); bind(u, 'uSrc', 0, T.b1a.t); gl.uniform2f(u.uDir, 1.5 / T.b2a.w, 0); draw();
    u = use(P.blur, T.b2b); bind(u, 'uSrc', 0, T.b2a.t); gl.uniform2f(u.uDir, 0, 1.5 / T.b2a.h); draw();
    /* 7. to the screen */
    u = use(P.final, null);
    bind(u, 'uScene', 0, T.scene.t); bind(u, 'uB1', 1, T.b1a.t); bind(u, 'uB2', 2, T.b2b.t);
    f1(u, 'uTime', time); f1(u, 'uNight', night); f1(u, 'uWarm', L.warm); f1(u, 'uUnder', L.underground ? 1 : 0); f1(u, 'uDeep', L.deep);
    f1(u, 'uExposure', EXPOSURE); gl.uniform2f(u.uRes, cssW, cssH);
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
