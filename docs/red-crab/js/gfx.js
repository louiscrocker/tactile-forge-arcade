/* ============================================================
   gfx.js — the WebGL2 look (?gfx=gl; O switches it live)
   ============================================================
     Carried over from Wolf's pilot and re-made for a tropical
     island.  The game still draws its world with Canvas 2D
     (render.js), but into a transparent layer; this module paints
     everything around, behind and over it on the GPU:
       background (half res): a humid sky lit by the sun, tall
         cumulus with flat grey bases and sunlit tops, the moon as a
         lit sphere in its real phase, stars, the far ocean out to
         the horizon with the sun's (or moon's) glitter on it, and,
         inland, the rainforest plateau's far hills in three bands
         with heavy aerial perspective and mist in the valleys
       the sea you are in: blue darkening with depth, light shafts
         slanting down from the surface, a bright rippled underside
         to the surface; everything under the water is fogged and
         loses its reds with depth, and caustics play over it
       occlusion + god rays: shafts from the sun, blocked by the
         world; in the forest, beams through gaps in the canopy and
         sunflecks on the floor
       the world lit by the sun or the moon, with a rim light worked
         out from each shape's edge
       particles: monsoon rain (stops at the ground and the sea),
         dust in the sunbeams, marine snow, plankton glowing at night
       bloom, ACES tone map, colour grade, vignette, grain
     render.js hands over, per frame, a strip of "columns": for
     each 4 px of screen width, where the sea's surface is, how far
     down the water tint reaches and where the ground is.  No
     libraries; no WebGL2 or a shader failure means the classic look.
   ============================================================ */
'use strict';

const GFX = (function () {
  let on = false, ready = false, cv = null, gl = null, hdr = false, maxPt = 64;
  let world = null, wctx = null, worldTex = null, colTex = null, vao = null;
  let cssW = 1, cssH = 1, dpr = 1, pw = 1, ph = 1, bgScale = .5;
  const P = {}, T = {};
  let frames = 0, gpuMs = 0, upMs = 0, lastUp = 0;
  const COLW = 4;
  let colN = 1, colData = new Float32Array(4);
  const EXPOSURE = (() => { try { const v = +new URLSearchParams(location.search).get('exposure'); return v > 0 ? v : .95; } catch (e) { return .95; } })();

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
  /* the strip of columns: x = sea surface, y = how far down the water tint reaches, z = the ground (screen px; 1e6 = none) */
  const COLS = `
  uniform highp sampler2D uCols; uniform float uColW, uColN;
  vec4 colAt(float x) {
    float u = x / uColW - .5; float i = floor(u), f = clamp(u - i, 0., 1.);
    vec4 a = texelFetch(uCols, ivec2(int(clamp(i, 0., uColN - 1.)), 0), 0), b = texelFetch(uCols, ivec2(int(clamp(i + 1., 0., uColN - 1.)), 0), 0);
    return mix(a, b, f);
  }`;

  /* the background: sky, sun, moon, stars, cumulus, the far ocean, far forested hills (alpha = open sky) */
  const FS_BG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uHorizon, uNight, uDark, uCloud, uRain, uWarm, uMoonPhase, uInland;
  uniform vec3 uTop, uBot, uSun, uMoon, uSunCol, uAmb;
  ${LIB}
  /* one cumulus field: each cloud a heap of billows on a flat base, each billow lit as a sphere;
     returns density, how lit, and how much the sun shines through its thin edge */
  vec3 cumulus(vec2 c, float hY, float cell, float baseH, float size, float seed, vec3 sunD) {
    float dens = 0., lit = 0., rim = 0., best = 0., wAcc = 0.; vec3 nAcc = vec3(0.);
    float ci0 = floor(c.x / cell);
    for (int k = -1; k <= 1; k++) {
      float ci = ci0 + float(k), r = h11(ci * 3.7 + seed);
      if (r < .3 - uCloud * .3) continue;
      float cx = (ci + .25 + .5 * h11(ci * 9.1 + seed)) * cell, hb = baseH * (.85 + .3 * h11(ci * 2.9 + seed));
      float sz = size * (.55 + .8 * h11(ci * 5.3 + seed)) * (.75 + uCloud * .5);
      if (abs(c.x - cx) > sz * 2.2 || hY < hb - .01 || hY > hb + sz * 2.6) continue;
      float baseCut = smoothstep(hb - .002, hb + .012, hY);
      for (int b = 0; b < 8; b++) {
        float fb = float(b);
        float bx = cx + (h11(ci * 13. + fb * 7. + seed) - .5) * sz * 1.9 * (1. - fb / 9.);
        float by = hb + sz * (.2 + fb * .19 * (.6 + .7 * h11(ci * 5. + fb + seed)));
        float br = sz * (.62 - fb * .05) * (.7 + .5 * h11(ci * 3. + fb * 11. + seed));
        vec2 d = vec2((c.x - bx) * .9, hY - by) / br;
        float q = length(d) + (fbm3(vec2(c.x, hY) * 30. + seed) - .5) * .45;
        if (q >= 1.) continue;
        float z = sqrt(max(0., 1. - q * q));
        float dd = smoothstep(1., .8, q) * baseCut;
        dens = max(dens, dd);
        /* blend the billows' normals, weighted to the nearer, fuller ones: one soft heap, not a pile of balls */
        float wgt = dd * (z * z + .05) * br;
        nAcc += vec3(d.x, d.y, z) * wgt; wAcc += wgt;
        rim = max(rim, dd * smoothstep(.65, 1., q));
      }
      if (wAcc > 0.) best = max(best, smoothstep(hb, hb + sz * .5, hY));
    }
    if (wAcc > 0.) {
      vec3 n = normalize(nAcc / wAcc + vec3(0., 0., .15));
      lit = clamp(dot(n, sunD) * .6 + .5, 0., 1.2) * mix(.6, 1., best);
    }
    return vec3(dens, lit, rim * (1. - dens * .5));
  }
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float H = uRes.y, hz = uHorizon;
    /* --- the sky: deep blue overhead, a humid white haze at the horizon --- */
    float ty = clamp(px.y / hz, 0., 1.);
    vec3 col = mix(uTop, uBot, pow(ty, 1.25));
    col = mix(col, uBot * 1.04 + vec3(.03, .035, .03) * (1. - uNight), smoothstep(.55, 1., ty) * .45 * (1. - uNight * .7));
    vec2 sd = (px - uSun.xy) / H; float d = length(sd);
    float sunUp = uSun.z;
    col += uSunCol * sunUp * (.9 * exp(-d * 10.) + .16 * exp(-d * 3.)) * (1. - .6 * uCloud);
    col += uSunCol * sunUp * .16 * exp(-abs(px.y - hz) / (.1 * H)) * (1. - clamp((hz - uSun.y) / H * 2., 0., 1.));
    float disk = smoothstep(26., 23., length(px - uSun.xy));
    col += uSunCol * disk * 9. * sunUp * (1. - uCloud);
    if (uNight > .02) {
      vec2 sp = (px + vec2(uCamX * uZoom * .01, 0.)) / 2.5; vec2 ci = floor(sp);
      float r = h21(ci);
      if (r > .996) { vec2 f = fract(sp) - .5; float tw = .55 + .45 * sin(uTime * (1.5 + 3. * h21(ci + 7.)) + r * 80.);
        col += vec3(.9, .95, 1.) * smoothstep(.5, .0, length(f)) * uNight * tw * (1. - uCloud) * 1.6 * smoothstep(hz, hz * .6, px.y); }
      col += vec3(.05, .07, .12) * uNight * .5 * fbm3(px / H * vec2(2., 6.) + 3.) * smoothstep(hz, 0., px.y);
    }
    /* the moon: a lit sphere in its phase (0 new, .5 full) */
    vec2 md = (px - uMoon.xy) / 30.;
    float mr = length(md);
    if (uMoon.z > .001) {
      col += vec3(.55, .65, 1.) * uMoon.z * (.25 * exp(-length(px - uMoon.xy) / H * 7.) + .05 * exp(-length(px - uMoon.xy) / H * 2.));
      if (mr < 1.) {
        vec3 n = vec3(md.x, -md.y, sqrt(1. - mr * mr));
        float a = uMoonPhase * 6.2831853; vec3 L = vec3(sin(a), 0., -cos(a));
        float lit = smoothstep(-.04, .1, dot(n, L));
        float mare = .72 + .28 * fbm(n.xy * 2.6 + 5.);
        vec3 m = vec3(1., .97, .9) * (lit * mare * 1.8 + .035);
        col = mix(col, m, smoothstep(1., .96, mr) * uMoon.z);
      }
    }
    /* --- clouds: a high thin veil, then two fields of cumulus (far, small and low; near, tall) --- */
    vec2 cp = vec2((px.x + uCamX * uZoom * .02) / H + uTime * .003, px.y / H * 3.2);
    float veil = smoothstep(.55 - uCloud * .35, .95, fbm(cp * vec2(1.2, 2.4) + vec2(uTime * .006, 0.))) * smoothstep(hz, hz * .3, px.y);
    vec3 veilC = mix(uBot * .9 + uSunCol * sunUp * .2, vec3(.32, .35, .4), uCloud) * (1. - uDark * .75);
    col = mix(col, veilC, veil * (.35 + uCloud * .5));
    float hY = (hz - px.y) / H;
    vec3 cloudShade = mix(vec3(.42, .47, .56), vec3(.2, .22, .26), uCloud * .8) * (1. - uDark * .75) + uSunCol * sunUp * .05;
    vec3 cloudLit = (uSunCol * 1.25 + uAmb * .45) * (1. - uDark * .5);
    vec3 sunD = normalize(vec3(clamp((uSun.x - uRes.x * .5) / uRes.x * 2., -1., 1.) * .7, clamp((hz - uSun.y) / H * 2., -.2, 1.), .55));
    for (int L2 = 0; L2 < 2; L2++) {
      float fl = float(L2);
      float par = fl < .5 ? .012 : .03;
      vec2 c = vec2((px.x + uCamX * uZoom * par) / H + uTime * (.0025 + fl * .002), 0.);
      vec3 dl = fl < .5 ? cumulus(c, hY, .32, .03, .065, 3., sunD) : cumulus(c, hY, .75, .1, .19, 11., sunD);
      if (dl.x > .001) {
        vec3 cc = mix(cloudShade, cloudLit, dl.y * mix(1., sunUp, .85));
        cc += uSunCol * sunUp * (1.6 * exp(-d * 6.) + .25) * dl.z;      /* the silver lining */
        cc = mix(cc, vec3(.04, .05, .09) + vec3(.3, .35, .5) * uMoon.z * dl.y * .35, uNight * .85);
        cc = mix(cc, uBot * (1. - uDark * .6), (fl < .5 ? .45 : .15) * (1. - uNight * .5));   /* far clouds sink into the haze */
        col = mix(col, cc, dl.x * .97);
      }
    }
    float sky = 1.;
    vec3 haze = mix(uBot, uTop, .25) * (1. - uDark * .6) + uSunCol * sunUp * .1 * exp(-abs(px.x - uSun.x) / uRes.x * 2.5);
    /* --- the far ocean, out to the horizon --- */
    if (px.y > hz - 1.) {
      float dy = max(px.y - hz, .5) / H;
      float z = .02 / (dy + .02);                                      /* far away at the horizon */
      vec2 op = vec2(((px.x - uRes.x * .5) / H) * z * 3. + uCamX * uZoom * .0004, z * 4. - uTime * .05);
      float w1 = fbm3(op * vec2(1.2, 5.) + vec2(uTime * .04, 0.)), w2 = n2(op * vec2(5., 22.) + uTime * .3);
      vec3 deep = mix(vec3(.02, .1, .2), vec3(.004, .01, .03), uNight);
      vec3 ocean = mix(deep, deep * 1.8 + vec3(0., .03, .04), w1 * .6);
      /* it mirrors the sky: more so towards the horizon */
      float fres = exp(-dy * 12.);
      ocean = mix(ocean, haze * .9, fres * .75);
      /* the glitter path under the sun (or the moon) */
      vec3 key = uSun.z > .01 ? uSun : uMoon;
      vec3 keyCol = uSun.z > .01 ? uSunCol * 5. : vec3(.6, .7, 1.) * 2.4;
      float path = exp(-abs(px.x - key.x) / (H * (.02 + dy * .5))) * (1. - uCloud * .85) * key.z;
      float glint = pow(max(0., w2 * (.6 + .4 * w1)), 9.) * 40.;
      ocean += keyCol * path * (glint * smoothstep(.0, .02, dy) + .12 * fres);
      col = mix(col, ocean, smoothstep(hz - 1., hz + 1., px.y));
      sky *= smoothstep(hz + 1., hz - 1., px.y);
    }
    /* --- inland: the plateau's rainforest in three bands, heavy aerial perspective, mist between them --- */
    if (uInland > .01) {
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float par = fi == 0. ? .05 : fi == 1. ? .1 : .18;
        float k = fi == 0. ? 1.3 : fi == 1. ? .95 : .7;
        float lx = ((px.x - uRes.x * .5) * k / H + uCamX * uZoom * par / H) * 7. + fi * 31.;
        float base = hz + H * (fi == 0. ? -.005 : fi == 1. ? .04 : .09) + max(0., uCamY + 300.) * uZoom * .01 * (fi + 1.);
        float hill = H * (fi == 0. ? .07 : fi == 1. ? .06 : .05) * (.35 + .65 * n1(lx * .18 + fi * 4.));
        /* rounded crowns, some emergent trees standing above the rest */
        float cs = fi == 0. ? .55 : fi == 1. ? .7 : .9, cell = floor(lx / cs), crown = 0., side = 0.;
        for (int j = -1; j <= 1; j++) {
          float cj = cell + float(j), ccx = (cj + .5 + .3 * (h11(cj * 4.1 + fi) - .5)) * cs, cr = cs * (.55 + .35 * h11(cj * 2.3 + fi));
          float emerg = step(.86, h11(cj * 6.7 + fi)) * cr * .9;
          float ax = (lx - ccx) / cr;
          float t = (cr * .55 + emerg) * sqrt(max(0., 1. - ax * ax)) + cr * .08 * n1(lx * 9. + cj);
          if (t > crown) { crown = t; side = ax; }
        }
        float sy = base - hill - crown * H * (fi == 0. ? .03 : fi == 1. ? .045 : .06);
        float cov = smoothstep(sy - .8, sy + .8, px.y) * uInland;
        if (cov <= 0.) continue;
        float dy = (px.y - sy) / H;
        float tex = fbm3(vec2(lx * 6., dy * 40.));
        vec3 alb = mix(vec3(.02, .07, .03), vec3(.06, .15, .06), tex);
        float lit = .55 + .45 * clamp(-side * sign(uSun.x - px.x) * .8 + .4, 0., 1.) * exp(-dy * 30.);
        vec3 c = alb * (uAmb * .9 + uSunCol * sunUp * lit * 1.1);
        float far = fi == 0. ? .62 : fi == 1. ? .45 : .28;
        far = clamp(far + smoothstep(.0, .12, dy) * .25, 0., .92);
        c = mix(c, haze * 1.02, far * (1. - uNight * .3));
        col = mix(col, c, cov);
        sky *= 1. - cov;
        /* mist lying in the valleys in front of this band */
        float mist = (.25 + uRain * .5 + uWarm * .4) * fbm3(vec2(px.x / H * 2.2 + uCamX * uZoom * par * 1.3 / H + uTime * .01 + fi * 7., px.y / H * 9.)) * exp(-abs(px.y - (base + H * .012)) / (H * .02));
        col = mix(col, haze * 1.05 + uSunCol * sunUp * .05, clamp(mist * uInland, 0., .7));
      }
    }
    o = vec4(col, sky);
  }`;

  /* the light source for the god rays: open sky near the sun, minus the world and the sea */
  const FS_OCC = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld; uniform vec3 uSun; uniform vec2 uRes;
  ${COLS}
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float sky = texture(uBg, vUv).a * (1. - texture(uWorld, vUv).a) * step(px.y, colAt(px.x).x);
    float d = length(px - uSun.xy) / uRes.y;
    o = vec4(vec3(sky * uSun.z * (exp(-d * 3.5) * .9 + smoothstep(.05, .0, d))), 1.);
  }`;

  const FS_RAYS = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uSrc; uniform vec2 uSunUv; uniform float uSeed;
  void main() {
    vec2 delta = (vUv - uSunUv) * (.9 / 56.);
    vec2 uv = vUv - delta * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
    float illum = 1., acc = 0.;
    for (int i = 0; i < 56; i++) { uv -= delta; acc += texture(uSrc, uv).r * illum; illum *= .965; }
    o = vec4(vec3(acc / 56.), 1.);
  }`;

  /* the scene: background, the sea body, the lit world, the water over it, rays, beams and mist */
  const FS_SCENE = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld, uRays;
  uniform vec2 uRes, uTexel; uniform float uDPR, uTime, uCamX, uCamY, uZoom, uMist, uRayK, uDark, uWarm, uNight, uUnder, uForest, uSea, uDay, uCloud, uUnderground, uPlateau;
  uniform vec3 uSun, uMoon, uSunCol, uAmb, uWorldLight, uSkyLight;
  ${LIB}
  ${COLS}
  /* water: turquoise in the shallows, blue, then the black of the deep */
  vec3 waterCol(float d) {
    vec3 c = mix(vec3(.05, .3, .4), vec3(.012, .14, .34), 1. - exp(-d / 140.));
    c = mix(c, vec3(.002, .03, .1), 1. - exp(-d / 420.));
    c = mix(c, vec3(0., .004, .016), smoothstep(520., 900., d));
    return c * (.06 + .94 * uDay * (1. - uCloud * .35)) + vec3(0., .006, .02) * uNight;
  }
  /* the dancing net of light on anything near the surface */
  float caustic(vec2 p, float t) {
    vec2 i = p; float c = 1., inten = .005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1. - 3.5 / float(n + 1));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      vec2 dv = vec2(p.x * inten / (sin(i.x + tt) + sign(sin(i.x + tt)) * 1e-3 + 1e-6), p.y * inten / (cos(i.y + tt) + 1e-6));
      c += 1. / max(length(dv), 1e-3);
    }
    c /= 4.; c = 1.17 - pow(clamp(c, 0., 8.), 1.4);
    return clamp(pow(abs(c), 8.), 0., 3.);
  }
  /* light shafts slanting down from the surface, in world space */
  float shafts(vec2 wp, float depth, float slant) {
    float u = wp.x + wp.y * slant;
    float s = smoothstep(.45, .95, n1(u * .011 + uTime * .05)) * (.5 + .5 * n1(u * .045 - uTime * .08));
    return s * exp(-depth / 260.) * smoothstep(-2., 30., depth);
  }
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    vec2 wp = vec2((px.x - uRes.x * .5) / uZoom + uCamX, (px.y - uRes.y * .5) / uZoom + uCamY);
    vec4 cl = colAt(px.x);
    float depth = wp.y - uSea;
    float slant = clamp((uSun.x - uRes.x * .5) / uRes.x, -.6, .6) * -.5 + .12;
    /* is this pixel in the sea's body (behind the world)? and is the world here under the water? */
    float inBody = smoothstep(cl.x - .7, cl.x + .7, px.y);
    float inTint = inBody * smoothstep(cl.y + 1., cl.y - 1., px.y);
    vec3 col = texture(uBg, vUv).rgb;
    if (inBody > 0.) {
      vec3 wc = waterCol(max(depth, 0.));
      /* a slow turbid swirl, and just below the surface its bright rippled underside */
      wc *= .88 + .24 * fbm3(vec2(wp.x * .006 + uTime * .02, wp.y * .012));
      float under = exp(-max(px.y - cl.x, 0.) / (6. * max(uZoom, .4)));
      wc += (vec3(.25, .55, .6) * (.4 + .6 * n2(vec2(wp.x * .08 + uTime * .7, uTime * .3)))) * under * (.15 + .85 * uDay);
      wc += vec3(.5, .8, .85) * shafts(wp, depth, slant) * .22 * uDay * (1. - uCloud * .6);
      col = mix(col, wc, inBody);
    }
    vec4 w = texture(uWorld, vUv);
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
      n.y = -n.y;
      float edge = clamp((1. - avg) * 1.6, 0., 1.);
      vec3 key = uSun.z > .01 ? uSun : uMoon;
      vec3 keyCol = uSun.z > .01 ? uSunCol : vec3(.45, .6, 1.) * .9;
      vec2 L = normalize(key.xy - px + 1e-3);
      float wet = inTint;
      L = normalize(mix(L, vec2(0., -1.), wet));                       /* under the sea the light comes from the surface */
      keyCol = mix(keyCol, vec3(.55, .9, 1.) * uDay * exp(-max(depth, 0.) / 220.), wet);
      float rim = edge * pow(max(dot(n, L), 0.), 1.5) * mix(key.z, 1., wet) * (1. - uUnderground) * smoothstep(.35, .95, w.a);
      float top = edge * max(-n.y, 0.);
      float l0 = dot(w.rgb, vec3(.33)), lx = dot(texture(uWorld, vUv + vec2(uTexel.x * uDPR, 0.)).rgb, vec3(.33));
      float bump = (lx - l0) * sign(L.x) * 1.5;
      /* under the canopy: shade, but sunflecks on the floor and in the beams */
      vec3 wl = uWorldLight;
      float fleck = 0.;
      if (uForest > .01 && wet < .5) {
        float u = wp.x + wp.y * slant * 2.;
        float beam = smoothstep(.62, .9, n1(u * .0065 + 2.)) * (.6 + .4 * n1(u * .03 + uTime * .05));
        fleck = beam * smoothstep(.55, .75, n2(wp * .045 + uTime * .03)) * uDay * (1. - uCloud * .8);
        wl *= mix(1., .72, uForest) * (1. + fleck * 1.6 * uForest);
      }
      vec3 lit = alb * (wl * (1. + bump * .3) + uSkyLight * top * .2) + keyCol * rim * (.18 + .7 * dot(alb, vec3(.33)));
      if (wet > 0.) {
        /* the sea takes the reds first, then fogs everything towards its own colour */
        float dd = max(depth, 0.);
        vec3 absorb = exp(-dd * vec3(.0045, .0016, .0009));
        vec3 wlit = lit * absorb * mix(vec3(.8, 1., 1.05), vec3(1.), .3);
        float cs = caustic(wp * .045 + vec2(0., uTime * .02), uTime * .6 + 23.);
        wlit += vec3(.8, 1., .95) * cs * .35 * exp(-dd / 150.) * uDay * (1. - uCloud * .6) * (.1 + top * 1.2) * (.3 + dot(alb, vec3(.33)));
        float fog = clamp(.06 + (1. - exp(-dd / 300.)) * .75, 0., .9);
        wlit = mix(wlit, waterCol(dd), fog);
        lit = mix(lit, wlit, wet);
      }
      col = col * (1. - w.a) + lit * w.a;
    }
    /* light: the sun's rays in the air, shafts in the water, beams through the canopy, then low mist */
    vec3 rays = texture(uRays, vUv).rgb;
    col += rays * uSunCol * uRayK * (1. - inBody);
    if (inBody > 0. && w.a > .002) col += vec3(.5, .8, .85) * shafts(wp, depth, slant) * .12 * uDay * (1. - uCloud * .6) * inTint;
    float above = smoothstep(cl.z + 2., cl.z - 6., px.y) * (1. - inBody);
    if (uForest > .01) {
      float u = wp.x + wp.y * slant * 2.;
      float beam = smoothstep(.62, .9, n1(u * .0065 + 2.)) * (.6 + .4 * n1(u * .03 + uTime * .05));
      float fall = smoothstep(uRes.y * 1.1, 0., px.y);
      col += uSunCol * beam * fall * above * uForest * uDay * (1. - uCloud * .8) * .28 * (.7 + .3 * fbm3(vec2(u * .02, wp.y * .01 - uTime * .05)));
    }
    float hAbove = (cl.z - px.y) / uZoom;
    float m = uMist * fbm(vec2(wp.x * .004 + uTime * .03, wp.y * .012)) * exp(-max(hAbove - 6., 0.) / 80.) * above * (1. - uUnderground) * (1. - w.a * .6);
    col = mix(col, uSkyLight * 1.15 + uSunCol * uSun.z * .12, clamp(m * .45, 0., .45));
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.);
    o = vec4(max(col, 0.), 1.);
  }`;

  /* particles: dust in the sunbeams, monsoon rain, marine snow, plankton that glows at night */
  const VS_PART = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uDPR, uMaxPt, uKind, uCount;
  uniform sampler2D uRays;
  ${COLS}
  out float vBlur, vSeed, vGlow, vFade; out vec2 vDir;
  float h(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  void main() {
    float i = float(gl_VertexID);
    float z = pow(h(i * 1.37 + uKind), 2.2);
    float par = mix(.25, 1.8, z);
    vec2 span = uRes + vec2(200.);
    vec2 vel; float size;
    vDir = vec2(0., 1.);
    if (uKind < .5) { vel = vec2(6. * sin(uTime * .3 + i), -4. + 8. * h(i * 5.1)); size = mix(1.5, 16., z * z); }
    else if (uKind < 1.5) { vel = vec2(-70. - 40. * h(i * 2.3), 900. + 400. * h(i * 4.7)) * (.45 + z); size = mix(10., 64., z); vDir = normalize(vel); }
    else if (uKind < 2.5) { vel = vec2(4. * sin(uTime * .2 + i), 7. + 9. * h(i * 4.7)) * (.5 + z); size = mix(1.5, 14., z * z); }
    else { vel = vec2(5. * sin(uTime * .4 + i * 3.), 4. * cos(uTime * .5 + i)); size = mix(3., 12., z); }
    vec2 p = vec2(h(i * 2.1), h(i * 3.7)) * span + vel * uTime - vec2(uCamX * uZoom * par, uCamY * uZoom * par);
    p = mod(p, span) - 100.;
    if (uKind < 1.5 || uKind > 2.5) p.x += sin(uTime * (.5 + h(i * 8.)) + i) * 10. * z;
    gl_Position = vec4(p.x / uRes.x * 2. - 1., 1. - p.y / uRes.y * 2., 0., 1.);
    gl_PointSize = min(size * uDPR, uMaxPt);
    vBlur = smoothstep(.45, 1., z);
    vSeed = h(i * 9.9);
    vGlow = textureLod(uRays, vec2(p.x / uRes.x, 1. - p.y / uRes.y), 0.).r;
    /* where it may be: air above the ground and the sea, or in the water */
    vec4 cl = colAt(clamp(p.x, 0., uRes.x - 1.));
    float air = step(p.y, min(cl.x, cl.z) - 2.), wet = step(cl.x + 3., p.y);
    vFade = step(h(i * 11.3), uCount) * (uKind > 1.5 ? wet : air);
  }`;
  const FS_PART = `#version 300 es
  precision highp float;
  in float vBlur, vSeed, vGlow, vFade; in vec2 vDir; out vec4 o;
  uniform float uKind, uTime, uNight, uDay; uniform vec3 uSunCol, uWorldLight;
  void main() {
    if (vFade < .5) discard;
    vec2 q = gl_PointCoord * 2. - 1.;
    float soft = .08 + vBlur * .9;
    if (uKind < .5) {
      float a = smoothstep(1., 1. - soft - .3, length(q));
      vec3 c = uSunCol * (vGlow * 5. + .05) * uDay;
      o = vec4(c * a * (1. - vBlur * .5), 0.);
    } else if (uKind < 1.5) {
      /* a streak of rain along its fall */
      vec2 d = vDir;                                  /* gl_PointCoord runs down the screen, like vDir */
      float along = dot(q, d), across = dot(q, vec2(-d.y, d.x));
      float a = smoothstep(.07 + vBlur * .12, 0., abs(across)) * smoothstep(1., .5, abs(along)) * (.5 - vBlur * .25);
      vec3 c = uWorldLight * .9 + vec3(.06) + uSunCol * vGlow * 2.;
      o = vec4(c * a, a);
    } else if (uKind < 2.5) {
      float a = smoothstep(1., 1. - soft - .2, length(q)) * (.55 - vBlur * .3);
      vec3 c = vec3(.55, .7, .72) * (.15 + .85 * uDay) + vec3(.02, .05, .08);
      o = vec4(c * a, a);
    } else {
      float blink = pow(max(0., sin(uTime * (1.1 + vSeed) + vSeed * 40.)), 5.);
      float a = exp(-dot(q, q) * 5.) * blink * uNight;
      o = vec4(vec3(.25, .95, 1.) * a * 3.5, 0.);
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
    o = vec4(c * smoothstep(.75, 1.6, l), 1.);
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
  uniform sampler2D uScene, uB1, uB2; uniform float uTime, uNight, uWarm, uUnder, uExposure, uUnderground; uniform vec2 uRes;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main() {
    vec3 c = texture(uScene, vUv).rgb;
    c += texture(uB1, vUv).rgb * .55 + texture(uB2, vUv).rgb * .45;
    c *= uExposure;
    c = aces(c);
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(vec3(l), c, 1.14 - uNight * .35);
    c *= mix(vec3(.94, .98, 1.06), vec3(1.05, 1., .93), smoothstep(.05, .7, l));
    c = mix(c, c * vec3(1.08, .96, .82), uWarm * .35);
    c = mix(c, c * vec3(.75, .88, 1.2), uNight * .5);
    c = mix(c, c * vec3(.9, 1.02, 1.06), uUnder * .5);
    vec2 v = vUv - .5; c *= 1. - dot(v, v) * (.5 + uNight * .3 + uUnder * .5 + uUnderground * .6);
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
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
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
  function bind(u, name, unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); if (u[name]) gl.uniform1i(u[name], unit); }
  function cols(u, unit) { bind(u, 'uCols', unit, colTex); gl.uniform1f(u.uColW, COLW); gl.uniform1f(u.uColN, colN); }
  function draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  /* ---------- public ---------- */
  /* on by default; ?gfx=classic keeps the Canvas 2D look, ?gfx=gl forces this one, O flips it (remembered) */
  function gfxParam() { try { return new URLSearchParams(location.search).get('gfx') || ''; } catch (e) { return ''; } }
  function wanted() { const p = gfxParam(); return p !== 'classic' && p !== '2d'; }
  function startOn() { if (gfxParam() === 'gl') return true; try { const v = localStorage.getItem('redcrab.gfx'); return v !== 'off' && v !== 'slow'; } catch (e) { return true; } }
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
    const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    worldTex = tex(); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    colTex = tex(); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
    bgScale = d > 1.5 ? .4 : .55;
    T.bg = target(pw * bgScale, ph * bgScale);
    T.occ = target(pw / 4, ph / 4); T.rays = target(pw / 4, ph / 4);
    T.scene = target(pw, ph);
    T.b1a = target(pw / 4, ph / 4); T.b1b = target(pw / 4, ph / 4);
    T.b2a = target(pw / 8, ph / 8); T.b2b = target(pw / 8, ph / 8);
    colN = Math.ceil(w / COLW) + 1; colData = new Float32Array(colN * 4);
  }
  function active() { return ready && on; }
  function toggle() { if (!ready) return false; on = !on; cv.style.display = on ? 'block' : 'none'; speed.t0 = 0; try { localStorage.setItem('redcrab.gfx', on ? 'on' : 'off'); } catch (e) {} return on; }
  function worldCtx() { return wctx; }
  function canvas() { return cv; }
  /* render.js fills the columns: fn(screenX) → [surface, tint bottom, ground] in screen px (1e6 = none) */
  function columns(fn) {
    for (let i = 0; i < colN; i++) { const c = fn(i * COLW + COLW * .5); colData[i * 4] = c[0]; colData[i * 4 + 1] = c[1]; colData[i * 4 + 2] = c[2]; colData[i * 4 + 3] = 0; }
  }
  function hexLin(c) { return hexToRgb(c).map(v => Math.pow(v / 255, 2.2)); }

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
    try { if (localStorage.getItem('redcrab.gfx') === 'on') return; localStorage.setItem('redcrab.gfx', 'slow'); } catch (e) {}
    on = false; cv.style.display = 'none';
    console.info('gfx: ' + fps.toFixed(0) + ' fps, switched to the classic look (press O for the painted one)');
  }
  function render(G, L) {
    watchSpeed();
    const t0 = performance.now();
    const cam = G.cam, Wd = G.world, weather = Wd.weather, time = G.time;
    const night = L.night, dark = L.dark, day = 1 - night;
    const sunT = L.sun.t || 0, elev = Math.sin(Math.PI * sunT);
    const sunCol = [1.0, lerp(.55, .94, Math.min(1, elev * 1.6)), lerp(.28, .84, Math.min(1, elev * 1.4))].map(v => v * (1 - weather.cloud * .6));
    const top = hexLin(L.top), bot = hexLin(L.bot);
    const amb = [lerp(top[0], bot[0], .6) * .55, lerp(top[1], bot[1], .6) * .58, lerp(top[2], bot[2], .6) * .6].map(v => v * (1 - dark * .4) + .02);
    const worldLight = [lerp(1, 70 / 255, dark), lerp(1, 92 / 255, dark), lerp(1, 150 / 255, dark)].map(v => Math.pow(v, 1.6) * (1 - weather.cloud * .25));
    const warmTint = [1 + L.warm * .12, 1 - L.warm * .02, 1 - L.warm * .14];
    for (let k = 0; k < 3; k++) worldLight[k] *= warmTint[k] * (L.underground ? .8 : 1);
    const mist = clamp(.1 + L.warm * .5 + weather.rain * .45 + night * .12 + L.forest * .18, 0, .8);
    const sun = [L.sun.x, L.sun.y, L.sun.vis * clamp(elev * 4, 0, 1)], moon = [L.moon.x, L.moon.y, L.moon.vis];

    gl.disable(gl.BLEND);
    /* 0. the columns */
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, colTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, colN, 1, 0, gl.RGBA, gl.FLOAT, colData);
    /* 1. the background */
    let u = use(P.bg, T.bg);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uHorizon, L.horizon); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uDark, dark); gl.uniform1f(u.uCloud, weather.cloud); gl.uniform1f(u.uRain, weather.rain);
    gl.uniform1f(u.uWarm, L.warm); gl.uniform1f(u.uMoonPhase, ((G.moon % 1) + 1) % 1); gl.uniform1f(u.uInland, L.inland);
    gl.uniform3fv(u.uTop, top); gl.uniform3fv(u.uBot, bot); gl.uniform3fv(u.uSun, sun); gl.uniform3fv(u.uMoon, moon); gl.uniform3fv(u.uSunCol, sunCol); gl.uniform3fv(u.uAmb, amb);
    draw();
    /* 2. the world layer, as drawn by render.js this frame */
    const t1 = performance.now();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, worldTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, world);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    lastUp = performance.now() - t1; upMs = upMs * .95 + lastUp * .05;
    /* 3. god rays */
    const rayK = L.underground ? 0 : 1.1 * (1 - L.forest * .7);
    if (rayK > 0 && sun[2] > .01) {
      u = use(P.occ, T.occ); bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); cols(u, 2); gl.uniform3fv(u.uSun, sun); gl.uniform2f(u.uRes, cssW, cssH); draw();
      u = use(P.rays, T.rays); bind(u, 'uSrc', 0, T.occ.t); gl.uniform2f(u.uSunUv, sun[0] / cssW, 1 - sun[1] / cssH); gl.uniform1f(u.uSeed, (frames % 64) * .37); draw();
    } else { gl.bindFramebuffer(gl.FRAMEBUFFER, T.rays.f); gl.viewport(0, 0, T.rays.w, T.rays.h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    /* 4. the scene */
    u = use(P.scene, T.scene);
    bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); bind(u, 'uRays', 2, T.rays.t); cols(u, 3);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); gl.uniform1f(u.uDPR, dpr);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uMist, L.underground ? 0 : mist); gl.uniform1f(u.uRayK, rayK); gl.uniform1f(u.uDark, dark); gl.uniform1f(u.uWarm, L.warm);
    gl.uniform1f(u.uNight, night); gl.uniform1f(u.uUnder, L.under ? 1 : 0); gl.uniform1f(u.uForest, L.forest); gl.uniform1f(u.uSea, Wd.seaLevel());
    gl.uniform1f(u.uDay, day); gl.uniform1f(u.uCloud, weather.cloud); gl.uniform1f(u.uUnderground, L.underground ? 1 : 0); gl.uniform1f(u.uPlateau, WORLD.plateau);
    gl.uniform3fv(u.uSun, sun); gl.uniform3fv(u.uMoon, moon); gl.uniform3fv(u.uSunCol, sunCol); gl.uniform3fv(u.uAmb, amb);
    gl.uniform3fv(u.uWorldLight, worldLight); gl.uniform3fv(u.uSkyLight, amb.map(v => v * 1.6));
    draw();
    /* 5. particles, into the scene */
    if (!L.underground) {
      const kinds = [];
      if (weather.rain > .03) kinds.push([1, 700, clamp(weather.rain * 1.1, 0, 1)]);
      if (weather.rain < .2 && day > .3) kinds.push([0, 240, 1]);
      if (L.water) kinds.push([2, 360, 1]);
      if (L.water && night > .3) kinds.push([3, 200, clamp((night - .3) * 1.6, 0, 1)]);
      if (kinds.length) {
        u = use(P.part, T.scene);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        bind(u, 'uRays', 0, T.rays.t); cols(u, 1);
        gl.uniform2f(u.uRes, cssW, cssH); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
        gl.uniform1f(u.uDPR, dpr); gl.uniform1f(u.uMaxPt, maxPt); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uDay, day);
        gl.uniform3fv(u.uSunCol, sunCol); gl.uniform3fv(u.uWorldLight, worldLight);
        gl.bindVertexArray(vao);
        for (const [kind, n, amount] of kinds) { gl.uniform1f(u.uKind, kind); gl.uniform1f(u.uCount, amount); gl.drawArrays(gl.POINTS, 0, n); }
        gl.disable(gl.BLEND);
      }
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
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uWarm, L.warm);
    gl.uniform1f(u.uUnder, L.under ? 1 : 0); gl.uniform1f(u.uUnderground, L.underground ? 1 : 0); gl.uniform1f(u.uExposure, EXPOSURE); gl.uniform2f(u.uRes, cssW, cssH);
    draw();
    frames++;
    gpuMs = gpuMs * .95 + (performance.now() - t0) * .05;
  }
  function stats() { return { on: active(), hdr, ms: gpuMs, upload: upMs, lastUpload: lastUp, maxPt, bgScale }; }

  return { init, resize, active, toggle, worldCtx, canvas, columns, render, stats };
})();
