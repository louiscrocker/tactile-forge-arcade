/* ============================================================
   gfx.js — the WebGL2 look (?gfx=gl; O switches it live)
   ============================================================
     Adapted from Wolf's pilot for the rainforest.  render.js still
     draws the world (trees, the log and its cut-away, the soil,
     the beetles) with Canvas 2D, but into a transparent layer.
     This module paints everything around and over it on the GPU:
       background (half res): a sky glimpsed through the canopy,
         the sun or the moon, stars; four bands of rainforest
         (emergent crowns, a sub-canopy, trunks with buttresses,
         an understory of palms) sinking into a heavy, humid mist
         with strong aerial perspective; gaps in the leaves
       god rays: light shafts from the gaps in the canopy, blocked
         by the world itself (the climbable trees, the log)
       scene (full res): the world layer lit by the sky, with
         drifting sunflecks (dappled light through the leaves) and
         a rim light from each shape's edge above ground; the cut-
         away log and soil dark and warm; underground, a soft light
         around you; an emissive layer (glowing fungus) added on top
       particles: dust motes in the light shafts, drifting spores,
         rain, fireflies at night, wood dust in your light below
       bloom, filmic tone mapping (ACES), grade, vignette, grain
     No libraries.  No WebGL2, or a shader that fails, means the
     classic Canvas 2D look.  Nothing in the game's logic reads it.
   ============================================================ */
'use strict';

const GFX = (function () {
  let on = false, ready = false, cv = null, gl = null, hdr = false, maxPt = 64;
  let world = null, wctx = null, worldTex = null, glowC = null, gctx = null, glowTex = null, glowUsed = false, vao = null;
  let cssW = 1, cssH = 1, dpr = 1, pw = 1, ph = 1, bgScale = .5;
  const P = {}, T = {};
  let frames = 0, gpuMs = 0, upMs = 0, lastUp = 0;
  const NT = 64;                                /* surface samples across the screen */
  const tops = new Float32Array(NT);
  const qp = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
  const EXPOSURE = (() => { const v = +qp.get('exposure'); return v > 0 ? v : 1; })();

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

  /* the background: sky, sun, moon, stars, four bands of rainforest, mist (alpha = open sky) */
  const FS_BG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uFloor, uNight, uDark, uCloud, uMist, uWarm;
  uniform vec3 uTop, uBot, uSun, uMoon, uSunCol, uAmb, uHaze;
  ${LIB}
  /* one layer of round crowns: returns coverage (0..1) and fills the crown's centre/top/radius */
  float crowns(float lx, float hy, float hMin, float hMax, float salt, out vec4 info) {
    float best = 0.; info = vec4(0., -9., 1., 9.);
    float c = floor(lx);
    for (int k = -1; k <= 1; k++) {
      float ci = c + float(k) + salt;
      float cx = c + float(k) + .5 + .34 * (h11(ci * 3.1) - .5);
      float ch = mix(hMin, hMax, h11(ci * 7.7));
      float cr = .5 + .42 * h11(ci * 1.9);
      vec2 q = vec2((lx - cx) / (cr * 1.2), (hy - ch) / (cr * .62));
      float lump = (fbm3(vec2(lx * 3.1 + salt * 11., hy * 3.4)) - .5) * .55;
      float d = length(q) + lump;
      float cov = smoothstep(1.02, .94, d);
      if (cov > best) { best = cov; info = vec4(cx, ch, cr, d); }
    }
    return best;
  }
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float H = uRes.y;
    /* --- the sky glimpsed above the canopy --- */
    float g0 = min(0., uFloor - H * 1.4), g1 = max(uFloor, 10.);
    vec3 col = mix(uTop, uBot, pow(clamp((px.y - g0) / (g1 - g0), 0., 1.), .85));
    vec2 sd = (px - uSun.xy) / H; float d = length(sd);
    float sunUp = uSun.z;
    col += uSunCol * sunUp * (.9 * exp(-d * 9.) + .14 * exp(-d * 2.6)) * (1. - .6 * uCloud);
    col += uSunCol * smoothstep(30., 26., length(px - uSun.xy)) * 9. * sunUp * (1. - uCloud);
    if (uNight > .02) {
      vec2 sp = px / 2.5; vec2 ci = floor(sp); float r = h21(ci);
      if (r > .9965) { vec2 f = fract(sp) - .5; float tw = .55 + .45 * sin(uTime * (1.5 + 3. * h21(ci + 7.)) + r * 80.);
        col += vec3(.9, .95, 1.) * smoothstep(.5, .0, length(f)) * uNight * tw * (1. - uCloud) * 1.6; }
    }
    vec2 md = (px - uMoon.xy) / 34.; float mr = length(md);
    if (uMoon.z > .001) {
      col += vec3(.5, .62, 1.) * uMoon.z * (.25 * exp(-length(px - uMoon.xy) / H * 6.) + .05);
      if (mr < 1.) {
        vec3 n = vec3(md.x, -md.y, sqrt(1. - mr * mr));
        float lit = smoothstep(-.04, .2, dot(n, normalize(vec3(-.5, .3, .8))));
        float mare = .72 + .28 * fbm(n.xy * 2.6 + 5.);
        col = mix(col, vec3(1., .97, .9) * (lit * mare * 1.7 + .04), smoothstep(1., .96, mr) * uMoon.z);
      }
    }
    /* soft clouds */
    float cn = fbm(vec2(px.x / H * 1.3 + uTime * .004 + uCamX * uZoom * .02 / H, px.y / H * 3.));
    float dens = smoothstep(.5 - uCloud * .3, .85, cn) * (.5 + uCloud * .5);
    col = mix(col, mix(uBot * .9 + vec3(.05), vec3(.25, .28, .3), uCloud) * (1. - uDark * .75) + uSunCol * sunUp * .25, dens * .7);
    /* a moonlit blue-violet night above the leaves */
    col += vec3(.035, .04, .11) * uNight * (1. - uCloud * .6) * (.6 + .4 * smoothstep(uFloor, 0., px.y));
    float sky = 1.;
    /* --- four bands of rainforest, back to front --- */
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float par = fi == 0. ? .07 : fi == 1. ? .13 : fi == 2. ? .22 : .36;
      float kv = fi == 0. ? .3 : fi == 1. ? .44 : fi == 2. ? .6 : .76;
      float unit = H * (fi == 0. ? .085 : fi == 1. ? .12 : fi == 2. ? .17 : .24) * mix(1., clamp(uZoom, .7, 2.6), .35);
      float floorY = H * .5 + (uFloor - H * .5) * kv;
      float lx = ((px.x - uRes.x * .5) + uCamX * uZoom * par) / unit + fi * 17.3;
      float hy = (floorY - px.y) / unit;
      if (hy > 9.) continue;
      vec4 info, info2;
      float em = crowns(lx * .8, hy, 3.6, 6.4, fi * 3.7, info);              /* emergents */
      float sub = crowns(lx * 1.25 + .5, hy, 1.8, 3.6, fi * 5.3 + 1., info2); /* the sub-canopy */
      info.x /= .8; info.z /= .8; info2.x = (info2.x - .5) / 1.25; info2.z /= 1.25;
      /* trunks under the emergents, with buttresses near the floor */
      float tc = floor(lx * .8 + .5) - .5; float tx = (tc + .5 + .34 * (h11((tc + fi * 3.7) * 3.1) - .5)) / .8;
      float th = mix(3.6, 6.4, h11((tc + fi * 3.7) * 7.7));
      float tw = .07 + .05 * h11(tc * 5.3) + .25 * exp(-hy * 3.) * (.6 + .4 * sin(lx * 9.));
      float trunk = smoothstep(tw + .02, tw - .02, abs(lx - tx)) * step(hy, th);
      /* the understory: palms and ferns, dense near the floor */
      float us = smoothstep(.15, -.05, hy - (.75 + .9 * fbm3(vec2(lx * 1.6, 3. + fi)) + .35 * sin(lx * 7. + fi)));
      float cov = max(max(em, sub), max(trunk, us));
      if (hy < 0.) cov = 1.;
      if (cov <= .002) continue;
      /* gaps in the leaves (the sky, or the band behind, shows through) */
      float gaps = smoothstep(.62, .7, fbm3(vec2(lx * 2.2, hy * 2.4) + fi * 9.)) * step(1.2, hy) * (1. - trunk);
      cov *= 1. - gaps * .95;
      /* --- colour and light --- */
      float tex = n2(vec2(lx * 9., hy * 9.)) * .6 + n2(vec2(lx * 23., hy * 23.)) * .4;
      vec3 alb; float lit, rim = 0.;
      if (trunk > .5 && em < .6 && sub < .6) {
        alb = mix(vec3(.05, .045, .03), vec3(.11, .1, .07), n2(vec2(lx * 40., hy * 3.)) * .7 + n2(vec2(lx * 90., hy * 9.)) * .3);
        alb = mix(alb, vec3(.06, .1, .04), smoothstep(.55, .8, n2(vec2(lx * 20., hy * 5.))) * .7);   /* moss and climbers on the trunks */
        lit = .3 + .4 * smoothstep(-.06, .06, tx - lx);
      } else if (em > .02 || sub > .02) {
        vec4 I = em >= sub ? info : info2;
        /* the crown's own edge, lit from above by the moon at night: silhouettes with silver rims */
        rim = smoothstep(.8, .985, I.w + (tex - .5) * .12) * smoothstep(-.1, .6, (hy - I.y) / I.z);
        float up = clamp((hy - (I.y - I.z * .6)) / (I.z * 1.2), 0., 1.);
        alb = mix(vec3(.04, .12, .04), vec3(.11, .24, .07), tex);
        alb = mix(alb, vec3(.2, .3, .08), smoothstep(.75, 1., h11(floor(I.x * 3.) + fi)) * .5);   /* a yellower crown here and there */
        lit = .32 + .95 * up * up + .25 * (tex - .5);
      } else {
        alb = mix(vec3(.03, .09, .035), vec3(.08, .2, .06), tex);
        lit = .45 + .3 * tex;
      }
      if (hy < 0.) { alb = vec3(.07, .05, .03); lit = .5; }
      vec3 c = alb * (uAmb * 1.1 + uSunCol * sunUp * lit * .9);
      /* at night: darker cores, moonlit rims, and the far bands lifted by a blue moonlit mist */
      c = mix(c, c * .55 + vec3(.32, .4, .7) * rim * (.05 + .035 * fi) * (.5 + uMoon.z), uNight);
      /* aerial perspective: humid air, thick near the floor, the far bands almost lost in it */
      float far = fi == 0. ? .62 : fi == 1. ? .46 : fi == 2. ? .3 : .14;
      far = clamp(far + uMist * .22 * exp(-max(hy, 0.) * .6) * (1. - fi * .2), 0., .9) * (1. - uNight * .35);
      c = mix(c, uHaze, far);
      col = mix(col, c, cov);
      sky *= 1. - cov;
    }
    /* drifting sheets of mist between the bands */
    float my = mix(uFloor, H * .5, .4);
    float mist = uMist * fbm(vec2(px.x / H * 1.4 + uCamX * uZoom * .12 / H + uTime * .015, px.y / H * 5.)) * exp(-abs(px.y - my) / (H * .22));
    col = mix(col, uHaze * 1.05, clamp(mist * .55, 0., .5));
    if (px.y > uFloor) { col = vec3(.03, .02, .012); sky = 0.; }
    o = vec4(col, sky);
  }`;

  /* the light source for the god rays: open sky through the canopy gaps, minus whatever the world puts in front */
  const FS_OCC = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld; uniform vec3 uSun; uniform vec2 uRes;
  void main() {
    float sky = texture(uBg, vUv).a * (1. - texture(uWorld, vUv).a);
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float d = length(px - uSun.xy) / uRes.y;
    o = vec4(vec3(sky * uSun.z * (exp(-d * 1.6) * .9 + .15)), 1.);
  }`;

  const FS_RAYS = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uSrc; uniform vec2 uSunUv; uniform float uSeed;
  void main() {
    vec2 delta = (vUv - uSunUv) * (.75 / 56.);
    vec2 uv = vUv - delta * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
    float illum = 1., acc = 0.;
    for (int i = 0; i < 56; i++) { uv -= delta; acc += texture(uSrc, uv).r * illum; illum *= .968; }
    o = vec4(vec3(acc / 56.), 1.);
  }`;

  /* the scene: background, the world lit by the forest light, sunflecks, rim light, the cut-away, the glow, the rays */
  const FS_SCENE = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld, uRays, uGlow;
  uniform vec2 uRes, uTexel, uPlayer; uniform float uDPR, uTime, uCamX, uCamY, uZoom, uMist, uRayK, uDark, uWarm, uNight, uUnder, uPoolR, uGlowK, uFleck;
  uniform vec3 uSun, uMoon, uSunCol, uAmb, uWorldLight, uSkyLight, uCutLight;
  uniform float uTops[${NT}];
  ${LIB}
  float topAt(float x) { float u = clamp(x / uRes.x, 0., 1.) * ${NT - 1}.; int i = int(floor(u)); int j = min(i + 1, ${NT - 1}); return mix(uTops[i], uTops[j], fract(u)); }
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    vec3 col = texture(uBg, vUv).rgb;
    vec4 w = texture(uWorld, vUv);
    vec2 wp = vec2((px.x - uRes.x * .5) / uZoom + uCamX, (px.y - uRes.y * .5) / uZoom + uCamY);
    float cut = smoothstep(-1., 3., px.y - topAt(px.x));       /* 1 inside the log / the soil (the cut-away) */
    /* sunflecks: light through the leaves, drifting as the canopy sways */
    vec2 fp = wp * .012 + vec2(uTime * .03, sin(uTime * .2) * .1);
    float fleck = smoothstep(.56, .72, fbm3(fp) * .7 + n2(fp * 3.1 + uTime * .05) * .3);
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
      float sunLit = .35 + .65 * fleck;
      float rim = edge * pow(max(dot(n, L), 0.), 1.5) * key.z * sunLit;
      float top = edge * max(-n.y, 0.);
      float l0 = dot(w.rgb, vec3(.33)), lx = dot(texture(uWorld, vUv + vec2(uTexel.x * uDPR, 0.)).rgb, vec3(.33));
      float bump = (lx - l0) * sign(L.x) * 1.5;
      vec3 above = alb * (uWorldLight * (1. + bump * .3) + uSunCol * uSun.z * fleck * uFleck + uSkyLight * top * .35) + keyCol * rim * (.3 + .9 * dot(alb, vec3(.33)));
      vec3 inside = mix(vec3(dot(alb, vec3(.3, .5, .2))), alb, .82) * uCutLight;
      vec3 lit = mix(above, inside, cut);
      col = col * (1. - w.a) + lit * w.a;
    }
    /* light shafts, then the humid air in front, then whatever glows */
    vec3 rays = texture(uRays, vUv).rgb;
    col += rays * uSunCol * uRayK * (1. - cut);
    float m = uMist * fbm(vec2(wp.x * .003 + uTime * .02, wp.y * .008)) * smoothstep(-700., -20., wp.y) * (1. - cut) * (1. - w.a * .6);
    col = mix(col, uSkyLight * 1.2 + uSunCol * uSun.z * .08, clamp(m * .38, 0., .4));
    /* underground: dark and warm, a soft light around you */
    float pd = length(px - uPlayer) / uPoolR;
    float pool = exp(-pd * pd * 1.6);
    col *= mix(1., .16 + 1.05 * pool, uUnder);
    col += uGlowK * toLin(texture(uGlow, vUv).rgb);
    o = vec4(col, 1.);
  }`;

  /* particles: 0 dust in the light shafts · 1 spores · 2 rain · 3 fireflies · 4 wood dust in your light below */
  const VS_PART = `#version 300 es
  precision highp float;
  uniform vec2 uRes, uPlayer; uniform float uTime, uCamX, uCamY, uZoom, uDPR, uMaxPt, uKind, uCount, uPoolR;
  uniform float uTops[${NT}];
  uniform sampler2D uRays;
  out float vBlur, vRot, vSeed, vGlow, vFade, vLight;
  float h(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  float topAt(float x) { float u = clamp(x / uRes.x, 0., 1.) * ${NT - 1}.; int i = int(floor(u)); int j = min(i + 1, ${NT - 1}); return mix(uTops[i], uTops[j], fract(u)); }
  void main() {
    float i = float(gl_VertexID);
    float z = pow(h(i * 1.37 + uKind), 2.2);
    float par = mix(.25, 1.8, z);
    vec2 span = uRes + vec2(200.);
    vec2 vel; float size;
    if (uKind < .5) { vel = vec2(5. * sin(uTime * .3 + i), -3. + 6. * h(i * 5.1)); size = mix(1.5, 16., z * z); }
    else if (uKind < 1.5) { vel = vec2(10. + 8. * sin(uTime * .2 + i), -6. + 4. * sin(uTime * .3 + i * 2.)); size = mix(2., 22., z * z); }
    else if (uKind < 2.5) { vel = vec2(-60., 900. + 300. * h(i * 4.7)) * (.6 + z * .6); size = mix(10., 64., z); }
    else if (uKind < 3.5) { vel = vec2(12. * sin(uTime * .7 + i * 3.), 9. * cos(uTime * .9 + i)); size = mix(5., 16., z); }
    else { vel = vec2(4. * sin(uTime * .4 + i), -2. + 4. * h(i * 2.2)); size = mix(1.2, 6., z); }
    vec2 p = vec2(h(i * 2.1), h(i * 3.7)) * span + vel * uTime - vec2(uCamX * uZoom * par, uCamY * uZoom * par * .5);
    p = mod(p, span) - 100.;
    if (uKind > 3.5) p = uPlayer + (vec2(h(i * 2.1), h(i * 3.7)) - .5) * uPoolR * 2.2 + vec2(sin(uTime * .3 + i) * 20., mod(vel.y * uTime + h(i) * 80., 80.) - 40.);
    p.x += sin(uTime * (.5 + h(i * 8.)) + i) * 14. * z;
    float t = topAt(p.x);
    vFade = step(h(i * 11.3), uCount);
    if (uKind < 3.5 && p.y > t - 2.) vFade = 0.;      /* nothing falls into the cut-away log or the soil */
    if (uKind > 3.5 && p.y < t + 6.) vFade = 0.;      /* wood dust only inside */
    gl_Position = vec4(p.x / uRes.x * 2. - 1., 1. - p.y / uRes.y * 2., 0., 1.);
    gl_PointSize = min(size * uDPR, uMaxPt);
    vBlur = smoothstep(.45, 1., z);
    vRot = uTime * (1. + 3. * h(i * 6.1)) + i;
    vSeed = h(i * 9.9);
    vGlow = textureLod(uRays, vec2(p.x / uRes.x, 1. - p.y / uRes.y), 0.).r;
    float pd = length(p - uPlayer) / uPoolR; vLight = exp(-pd * pd * 1.6);
  }`;
  const FS_PART = `#version 300 es
  precision highp float;
  in float vBlur, vRot, vSeed, vGlow, vFade, vLight; out vec4 o;
  uniform float uKind, uTime, uNight; uniform vec3 uSunCol, uWorldLight;
  void main() {
    if (vFade < .5) discard;
    vec2 q = gl_PointCoord * 2. - 1.;
    float soft = .08 + vBlur * .9;
    if (uKind < .5) {
      float a = smoothstep(1., 1. - soft - .3, length(q));
      vec3 c = uSunCol * (vGlow * 6. + .03) * (1. - uNight);
      o = vec4(c * a * (1. - vBlur * .5), 0.);
    } else if (uKind < 1.5) {
      float a = smoothstep(1., 1. - soft - .2, length(q)) * (.55 - vBlur * .3);
      vec3 c = vec3(.85, .92, .75) * (uWorldLight * .7 + uSunCol * vGlow * 2.5) + vec3(.2, .5, .3) * uNight * .25;
      o = vec4(c * a, a * .6);
    } else if (uKind < 2.5) {
      /* a thin slanted streak */
      vec2 r = vec2(q.x + q.y * .07, q.y);
      float a = smoothstep(.09 + vBlur * .12, 0., abs(r.x)) * smoothstep(1., .3, abs(r.y)) * (.35 - vBlur * .15);
      vec3 c = uWorldLight * .9 + uSunCol * vGlow * 2. + .04;
      o = vec4(c * a, a);
    } else if (uKind < 3.5) {
      float blink = pow(max(0., sin(uTime * (1.3 + vSeed) + vSeed * 40.)), 5.);
      float a = (exp(-dot(q, q) * 6.) + .22 * exp(-dot(q, q) * 2.2) * smoothstep(1., .5, length(q))) * blink * uNight;
      o = vec4(vec3(.85, 1., .35) * a * 9., 0.);
    } else {
      float a = smoothstep(1., .2, length(q)) * vLight * .5;
      o = vec4(vec3(1., .78, .5) * a * .5, 0.);
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
    o = vec4(c * smoothstep(.7, 1.5, l), 1.);
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
  uniform sampler2D uScene, uB1, uB2; uniform float uTime, uNight, uWarm, uUnder, uExposure, uHumid; uniform vec2 uRes;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main() {
    vec3 c = texture(uScene, vUv).rgb;
    c += texture(uB1, vUv).rgb * .6 + texture(uB2, vUv).rgb * .5;
    c *= uExposure;
    c = aces(c);
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(vec3(l), c, 1.1 - uNight * .3);
    c *= mix(vec3(.92, 1., 1.02), vec3(1.05, 1.01, .92), smoothstep(.05, .7, l));       /* green-cool shadows, warm highlights */
    c = mix(c, c * vec3(1.08, .96, .84), uWarm * .35);
    c = mix(c, c * vec3(.75, .9, 1.18), uNight * .5);
    c = mix(c, c * vec3(1.08, .96, .84), uUnder * .25);                                   /* warm inside the log */
    vec2 v = vUv - .5; c *= 1. - dot(v, v) * (.6 + uNight * .3 + uUnder * .5);
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
  function plainTex() {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return t;
  }
  function upload(tex, src) {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  /* ---------- public ---------- */
  /* on by default; ?gfx=classic keeps the Canvas 2D look, ?gfx=gl forces this one, O flips it (remembered) */
  function gfxParam() { try { return new URLSearchParams(location.search).get('gfx') || ''; } catch (e) { return ''; } }
  function wanted() { const p = gfxParam(); return p !== 'classic' && p !== '2d'; }
  function startOn() { if (gfxParam() === 'gl') return true; try { return localStorage.getItem('hercules.gfx') !== 'off'; } catch (e) { return true; } }
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
    worldTex = plainTex(); glowTex = plainTex();
    world = document.createElement('canvas'); wctx = world.getContext('2d');
    glowC = document.createElement('canvas'); gctx = glowC.getContext('2d');
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
    glowC.width = Math.max(1, Math.round(w / 2)); glowC.height = Math.max(1, Math.round(h / 2));
    for (const k of Object.keys(T)) free(T[k]);
    bgScale = d > 1.5 ? .4 : .5;
    T.bg = target(pw * bgScale, ph * bgScale);
    T.occ = target(pw / 4, ph / 4); T.rays = target(pw / 4, ph / 4);
    T.scene = target(pw, ph);
    T.b1a = target(pw / 4, ph / 4); T.b1b = target(pw / 4, ph / 4);
    T.b2a = target(pw / 8, ph / 8); T.b2b = target(pw / 8, ph / 8);
  }
  function active() { return ready && on; }
  function toggle() { if (!ready) return false; on = !on; cv.style.display = on ? 'block' : 'none'; try { localStorage.setItem('hercules.gfx', on ? 'on' : 'off'); } catch (e) {} return on; }
  function worldCtx() { return wctx; }
  /* the emissive layer (half resolution, CSS px / 2): whatever glows in the dark; cleared each frame */
  function glowCtx() { glowUsed = true; return gctx; }
  function canvas() { return cv; }
  function hexLin(c) { return hexToRgb(c).map(v => Math.pow(v / 255, 2.2)); }

  /* L: { night, dark, warm, floorY, top, bot, sun, moon, under (0..1), player [x,y], poolR, rain, humid, cloud, tops(fn x→screen y of the surface) } */
  function render(G, L) {
    const t0 = performance.now();
    const cam = G.cam, time = G.time, night = L.night, dark = L.dark, cloud = L.cloud;
    const sunT = L.sun.t || 0, elev = Math.sin(Math.PI * sunT);
    const sunCol = [1.0, lerp(.6, .95, Math.min(1, elev * 1.6)), lerp(.32, .84, Math.min(1, elev * 1.4))].map(v => v * (1 - cloud * .6));
    const top = hexLin(L.top), bot = hexLin(L.bot);
    /* under the canopy the ambient light is green and dim; the sky's own colour comes through the gaps */
    const amb = [lerp(top[0], bot[0], .6) * .4 + .015, lerp(top[1], bot[1], .6) * .5 + .03, lerp(top[2], bot[2], .6) * .4 + .015].map(v => v * (1 - dark * .55));
    const dayK = 1 - dark;
    const worldLight = [lerp(.52, .05, dark), lerp(.6, .075, dark), lerp(.5, .14, dark)].map(v => v * (1 - cloud * .25));
    const warmTint = [1 + L.warm * .14, 1 - L.warm * .02, 1 - L.warm * .16];
    for (let k = 0; k < 3; k++) worldLight[k] *= warmTint[k];
    const cutLight = [lerp(.4, .16, night), lerp(.31, .13, night), lerp(.22, .13, night)].map(v => v * (L.under ? 1.12 : 1));
    const haze = [lerp(.2, .022, dark) * (1 - cloud * .2), lerp(.3, .026, dark), lerp(.25, .07, dark)].map((v, k) => v + sunCol[k] * L.warm * .08 * dayK);
    const mist = clamp(.45 + L.humid * .4 + L.rain * .3 + night * .1 + L.warm * .2, 0, 1);
    const sun = [L.sun.x, L.sun.y, L.sun.vis * clamp(elev * 4, 0, 1)], moon = [L.moon.x, L.moon.y, L.moon.vis];
    for (let k = 0; k < NT; k++) tops[k] = L.tops(k / (NT - 1) * cssW);
    const under = L.under ? 1 : 0;

    gl.disable(gl.BLEND);
    /* 1. the background */
    let u = use(P.bg, T.bg);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uFloor, L.floorY); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uDark, dark); gl.uniform1f(u.uCloud, cloud);
    gl.uniform1f(u.uMist, mist); gl.uniform1f(u.uWarm, L.warm);
    gl.uniform3fv(u.uTop, top); gl.uniform3fv(u.uBot, bot); gl.uniform3fv(u.uSun, sun); gl.uniform3fv(u.uMoon, moon); gl.uniform3fv(u.uSunCol, sunCol); gl.uniform3fv(u.uAmb, amb); gl.uniform3fv(u.uHaze, haze);
    draw();
    /* 2. the world layer (and the glow layer, if anything glowed) as drawn by render.js this frame */
    const t1 = performance.now();
    upload(worldTex, world);
    if (glowUsed) upload(glowTex, glowC);
    lastUp = performance.now() - t1; upMs = upMs * .95 + lastUp * .05;
    /* 3. god rays through the gaps */
    u = use(P.occ, T.occ); bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); gl.uniform3fv(u.uSun, sun); gl.uniform2f(u.uRes, cssW, cssH); draw();
    u = use(P.rays, T.rays); bind(u, 'uSrc', 0, T.occ.t); gl.uniform2f(u.uSunUv, sun[0] / cssW, 1 - sun[1] / cssH); gl.uniform1f(u.uSeed, (frames % 64) * .37); draw();
    /* 4. the scene */
    u = use(P.scene, T.scene);
    bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); bind(u, 'uRays', 2, T.rays.t); bind(u, 'uGlow', 3, glowTex);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); gl.uniform1f(u.uDPR, dpr);
    gl.uniform2f(u.uPlayer, L.player[0], L.player[1]); gl.uniform1f(u.uPoolR, L.poolR);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uMist, mist); gl.uniform1f(u.uRayK, (1.3 + L.humid * .8) * (1 - cloud * .7)); gl.uniform1f(u.uDark, dark); gl.uniform1f(u.uWarm, L.warm);
    gl.uniform1f(u.uNight, night); gl.uniform1f(u.uUnder, under); gl.uniform1f(u.uGlowK, glowUsed ? .9 : 0); gl.uniform1f(u.uFleck, .55 * dayK * (1 - cloud * .8));
    gl.uniform3fv(u.uSun, sun); gl.uniform3fv(u.uMoon, moon); gl.uniform3fv(u.uSunCol, sunCol); gl.uniform3fv(u.uAmb, amb);
    gl.uniform3fv(u.uWorldLight, worldLight); gl.uniform3fv(u.uSkyLight, amb.map(v => v * 1.8)); gl.uniform3fv(u.uCutLight, cutLight);
    gl.uniform1fv(u.uTops, tops);
    draw();
    /* 5. particles, into the scene */
    const kinds = [];
    if (L.rain < .3 && night < .6) kinds.push([0, 320, 1]);
    kinds.push([1, 70, .6 + L.humid * .4]);
    if (L.rain > .03) kinds.push([2, 520, clamp(L.rain, 0, 1)]);
    if (night > .35 && L.rain < .3) kinds.push([3, 150, 1]);
    if (under) kinds.push([4, 90, 1]);
    u = use(P.part, T.scene);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    bind(u, 'uRays', 0, T.rays.t);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uDPR, dpr); gl.uniform1f(u.uMaxPt, maxPt); gl.uniform1f(u.uNight, night);
    gl.uniform2f(u.uPlayer, L.player[0], L.player[1]); gl.uniform1f(u.uPoolR, L.poolR);
    gl.uniform3fv(u.uSunCol, sunCol); gl.uniform3fv(u.uWorldLight, worldLight); gl.uniform1fv(u.uTops, tops);
    gl.bindVertexArray(vao);
    for (const [kind, n, amount] of kinds) { gl.uniform1f(u.uKind, kind); gl.uniform1f(u.uCount, amount); gl.drawArrays(gl.POINTS, 0, n); }
    gl.disable(gl.BLEND);
    /* 6. bloom */
    u = use(P.bright, T.b1a); bind(u, 'uSrc', 0, T.scene.t); gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); draw();
    u = use(P.blur, T.b1b); bind(u, 'uSrc', 0, T.b1a.t); gl.uniform2f(u.uDir, 1 / T.b1a.w, 0); draw();
    u = use(P.blur, T.b1a); bind(u, 'uSrc', 0, T.b1b.t); gl.uniform2f(u.uDir, 0, 1 / T.b1a.h); draw();
    u = use(P.blur, T.b2a); bind(u, 'uSrc', 0, T.b1a.t); gl.uniform2f(u.uDir, 1.5 / T.b2a.w, 0); draw();
    u = use(P.blur, T.b2b); bind(u, 'uSrc', 0, T.b2a.t); gl.uniform2f(u.uDir, 0, 1.5 / T.b2a.h); draw();
    /* 7. to the screen */
    u = use(P.final, null);
    bind(u, 'uScene', 0, T.scene.t); bind(u, 'uB1', 1, T.b1a.t); bind(u, 'uB2', 2, T.b2b.t);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uWarm, L.warm); gl.uniform1f(u.uHumid, L.humid);
    gl.uniform1f(u.uUnder, under); gl.uniform1f(u.uExposure, EXPOSURE); gl.uniform2f(u.uRes, cssW, cssH);
    draw();
    glowUsed = false;
    frames++;
    gpuMs = gpuMs * .95 + (performance.now() - t0) * .05;
  }
  function stats() { return { on: active(), hdr, ms: gpuMs, upload: upMs, lastUpload: lastUp, maxPt, bgScale }; }

  return { init, resize, active, toggle, worldCtx, glowCtx, canvas, render, stats };
})();
