/* ============================================================
   gfx.js — the WebGL2 look (PILOT, ?gfx=gl; O switches it live)
   ============================================================
     The game still draws its world with Canvas 2D (render.js),
     but into a transparent layer. This module paints everything
     around and over it on the GPU:
       background (half res): a sky lit by the sun, the moon as a
         lit sphere in its real phase, stars, clouds with silver
         linings, four procedural mountain and forest bands with
         ridges, snowlines and aerial perspective, valley mist
       occlusion + god rays: light shafts from the sun, blocked by
         the mountains AND by the world (trees, wolves, hills)
       scene (full res): the world layer lit by the sun or the moon,
         with a rim light worked out from each shape's edge, the
         god rays and a mist in front
       particles: pollen in the sunbeams, falling leaves, snow,
         fireflies; the near ones large and out of focus
       bloom, filmic tone mapping, colour grade, vignette, grain
     No libraries; falls back to the Canvas 2D look when WebGL2 is
     missing. Nothing in the game's logic reads from here.
   ============================================================ */
'use strict';

const GFX = (function () {
  let on = false, ready = false, cv = null, gl = null, hdr = false, maxPt = 64;
  let world = null, wctx = null, worldTex = null, vao = null;
  let cssW = 1, cssH = 1, dpr = 1, pw = 1, ph = 1, bgScale = .5;
  const P = {}, T = {};
  let frames = 0, gpuMs = 0, upMs = 0, lastUp = 0;
  const EXPOSURE = (() => { try { const v = +new URLSearchParams(location.search).get('exposure'); return v > 0 ? v : .92; } catch (e) { return .92; } })();

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
  float ridge1(float x) { float a = .55, s = 0.; for (int i = 0; i < 6; i++) { float r = 1. - abs(n1(x) * 2. - 1.); s += a * r * r; x = x * 2.1 + 3.7; a *= .47; } return s; }
  float ridge2(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 4; i++) { float r = 1. - abs(n2(p) * 2. - 1.); s += a * r * r; p = p * 2.07 + 11.3; a *= .5; } return s; }
  vec3 toLin(vec3 c) { return pow(max(c, 0.), vec3(2.2)); }
  `;

  /* the background: sky, sun, moon, stars, clouds, mountains, forests, mist (alpha = open sky) */
  const FS_BG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uHorizon, uNight, uDark, uCloud, uSeason, uMist, uWarm, uMoonPhase;
  uniform vec3 uTop, uBot, uSun, uMoon, uSunCol, uAmb;
  ${LIB}
  /* a band's skyline in px from the top of the screen */
  float peaks(float x, float amp) { return amp * (.35 + .65 * ridge1(x)) ; }
  float forest(float x, float amp, float treeH, float sp, out float side) {
    float hill = amp * (.45 + .55 * n1(x * .7 + 4.));
    float best = 0.; side = 0.;
    float c = floor(x / sp);
    for (int k = -1; k <= 1; k++) {
      float ci = c + float(k), cx = (ci + .3 + .4 * h11(ci * 3.1)) * sp, th = treeH * (.55 + .9 * h11(ci * 7.7));
      float w = sp * (.55 + .35 * h11(ci * 1.9));
      float ax = abs(x - cx) / w;
      float t = th * (1. - ax) - th * .06 * abs(sin(ax * 22. + ci));
      if (t > best) { best = t; side = sign(x - cx); }
    }
    return hill + max(best, 0.);
  }
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float H = uRes.y;
    float horizon = uHorizon;
    /* --- sky --- */
    float ty = clamp(px.y / (horizon * 1.1), 0., 1.);
    vec3 col = mix(uTop, uBot, pow(ty, .85));
    vec2 sd = (px - uSun.xy) / H; float d = length(sd);
    float sunUp = uSun.z;
    col += uSunCol * sunUp * (.9 * exp(-d * 10.) + .12 * exp(-d * 3.)) * (1. - .6 * uCloud);
    col += uSunCol * sunUp * .14 * exp(-abs(px.y - horizon) / (.12 * H)) * (1. - clamp((horizon - uSun.y) / H * 2., 0., 1.)) ;
    float disk = smoothstep(26., 23., length(px - uSun.xy));
    col += uSunCol * disk * 9. * sunUp * (1. - uCloud);
    /* stars */
    if (uNight > .02) {
      vec2 sp = (px + vec2(uCamX * uZoom * .01, 0.)) / 2.5; vec2 ci = floor(sp);
      float r = h21(ci);
      if (r > .9965) { vec2 f = fract(sp) - .5; float tw = .55 + .45 * sin(uTime * (1.5 + 3. * h21(ci + 7.)) + r * 80.);
        col += vec3(.9, .95, 1.) * smoothstep(.5, .0, length(f)) * uNight * tw * (1. - uCloud) * 1.6 * smoothstep(horizon, horizon * .6, px.y); }
      col += vec3(.05, .07, .12) * uNight * .5 * fbm3(px / H * vec2(2., 6.) + 3.) * smoothstep(horizon, 0., px.y);   /* a faint Milky Way haze */
    }
    /* the moon: a lit sphere, phase 0 new · .5 full */
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
    /* clouds */
    float cov = mix(.38, .92, uCloud);
    vec2 cp = vec2((px.x + uCamX * uZoom * .03) / H + uTime * .004, px.y / H * 3.2);
    vec2 warp = vec2(fbm3(cp * 1.3 + uTime * .01), fbm3(cp * 1.3 + 9.));
    float cn = fbm(cp * vec2(2.2, 1.4) + warp * .8);
    float dens = smoothstep(1. - cov, 1. - cov + .3, cn) * smoothstep(horizon * 1.02, horizon * .55, px.y) * smoothstep(0., horizon * .12, px.y + horizon * .05);
    if (dens > .001) {
      vec2 toSun = normalize(uSun.xy - px + 1e-3) * .06;
      float cn2 = fbm(cp * vec2(2.2, 1.4) + warp * .8 + vec2(toSun.x / 2.2, toSun.y * 3.2 / 1.4) * 1.5);
      float lit = clamp(.55 + (cn - cn2) * 6., 0., 1.);
      vec3 shade = mix(uBot * .75 + vec3(.04), vec3(.18, .2, .24), uCloud * .8) * (1. - uDark * .7);
      vec3 cc = mix(shade, uSunCol * 1.15 + uAmb * .3, lit * sunUp * (1. - uCloud * .7));
      cc += uSunCol * sunUp * 2.2 * exp(-d * 5.) * (1. - dens) ;   /* the silver lining */
      cc = mix(cc, vec3(.05, .06, .1) + vec3(.3, .35, .5) * uMoon.z * lit * .4, uNight * .85);
      col = mix(col, cc, dens * .92);
    }
    float sky = 1.;
    vec3 haze = mix(uBot, uTop, .3) * (1. - uDark * .6) + uSunCol * sunUp * .1 * exp(-abs(px.x - uSun.x) / uRes.x * 2.5);
    vec2 sunDir = vec2(clamp((uSun.x - px.x) / uRes.x * 2.2, -1., 1.), 1.);
    float winter = step(2.5, uSeason) ;
    /* --- four bands, back to front --- */
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float par = fi == 0. ? .03 : fi == 1. ? .07 : fi == 2. ? .15 : .26;
      float k = fi == 0. ? 1.6 : fi == 1. ? 1.15 : fi == 2. ? .8 : .6;
      float lx = ((px.x - uRes.x * .5) * k / H + uCamX * uZoom * par / H) * (fi < 2. ? 2.2 : 9.);
      float base = horizon + H * (fi == 0. ? .02 : fi == 1. ? .085 : fi == 2. ? .15 : .21) + max(0., uCamY + 300.) * uZoom * .012 * (fi + 1.);
      float sy, side = 0.;
      if (i < 2) sy = base - peaks(lx + fi * 13.7, H * (fi == 0. ? .34 : .24));
      else sy = base - forest(lx + fi * 5.1, H * (fi == 2. ? .05 : .045), H * (fi == 2. ? .045 : .07), fi == 2. ? .2 : .3, side);
      float aa = (fi < 2. ? 1.2 : .8);
      float cov2 = smoothstep(sy - aa, sy + aa, px.y);
      if (cov2 <= 0.) continue;
      float dy = (px.y - sy) / H;
      vec3 c;
      if (i < 2) {
        /* rock faces with gullies, lit from the sun's side; snow above a ragged line */
        vec2 fp = vec2(lx * 3.2, dy * 7.);
        fp.x += (fbm3(fp * vec2(.5, .3) + fi * 7.) - .5) * .6;
        float r0 = ridge2(fp), rx = ridge2(fp + vec2(.05, 0.)), ry = ridge2(fp + vec2(0., .05));
        float sl = (peaks(lx + .01 + fi * 13.7, 1.) - peaks(lx - .01 + fi * 13.7, 1.)) * 50.;
        float gx = (rx - r0) * 6. - sl * .6 * exp(-dy * 30.);
        float shade = clamp(.6 + gx * sunDir.x * .9 + (r0 - ry) * 1.5, .15, 1.2);
        float snowLine = (fi == 0. ? .075 : .045) * (.5 + 1. * n1(lx * 3. + 2.)) + winter * .1;
        float snow = smoothstep(snowLine + .01, snowLine - .015, dy - r0 * .03) * smoothstep(.2, .5, r0 + .35 * (1. - winter) + .2 * winter);
        vec3 rock = mix(vec3(.18, .19, .22), vec3(.3, .28, .26), n2(fp * 3.)) ;
        vec3 forestC = mix(vec3(.03, .07, .05), vec3(.06, .11, .07), n2(fp * 14.));
        rock = mix(rock, forestC, smoothstep(.08, .2, dy) * (1. - winter * .6));
        vec3 alb = mix(rock, vec3(.92, .95, 1.), snow);
        vec3 light = uAmb * .75 + uSunCol * sunUp * shade * 1.35;
        c = alb * light;
        c += vec3(.25, .35, .6) * snow * (1. - shade) * .15 * (1. - uDark);   /* blue snow in shadow */
      } else {
        /* conifers (and, on the near hill, aspen groves that follow the season) */
        side *= exp(-dy * 25.);                 /* only the treetops face the light */
        float tex = n2(vec2(lx * 25., dy * 40.));
        vec3 alb = mix(vec3(.025, .06, .035), vec3(.05, .1, .055), tex);
        if (i == 3) {
          float grove = smoothstep(.55, .7, n1(lx * .9 + 31.));
          vec3 g = uSeason < .5 ? vec3(.25, .45, .1) : uSeason < 1.5 ? vec3(.12, .28, .06) : uSeason < 2.5 ? vec3(.75, .45, .04) : alb * 1.2;
          alb = mix(alb, g * (.6 + .5 * tex), grove * smoothstep(.0, .01, dy));
        }
        if (winter > .5) alb = mix(alb, vec3(.8, .84, .92), smoothstep(.6, .9, n2(vec2(lx * 60., dy * 90.))) * .3);
        float lit = .65 + .5 * side * sunDir.x;
        c = alb * (uAmb * .8 + uSunCol * sunUp * lit * 1.1);
      }
      /* aerial perspective: distant bands fade into the sky's haze; more near their feet */
      float far = fi == 0. ? .36 : fi == 1. ? .22 : fi == 2. ? .14 : .07;
      far = clamp(far + smoothstep(.0, .35, dy) * .12 * (1. - fi * .2), 0., .9);
      c = mix(c, haze, far * (1. - uNight * .4));
      col = mix(col, c, cov2);
      sky *= 1. - cov2;
    }
    /* valley mist between the forests and the world */
    float my = horizon + H * .22;
    float mist = uMist * fbm(vec2(px.x / H * 1.6 + uCamX * uZoom * .3 / H + uTime * .02, px.y / H * 7.)) * exp(-abs(px.y - my) / (H * .07));
    col = mix(col, haze * 1.02 + uSunCol * sunUp * .05, clamp(mist * .6, 0., .5));
    o = vec4(col, sky);
  }`;

  /* the light source for the god rays: open sky near the sun, minus whatever the world puts in front of it */
  const FS_OCC = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld; uniform vec3 uSun; uniform vec2 uRes;
  void main() {
    float sky = texture(uBg, vUv).a * (1. - texture(uWorld, vUv).a);
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
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

  /* the scene: the background, the world lit by the sun/moon with rim light, the rays, mist in front */
  const FS_SCENE = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld, uRays;
  uniform vec2 uRes, uTexel; uniform float uDPR, uTime, uCamX, uCamY, uZoom, uMist, uRayK, uDark, uWarm, uNight, uUnder;
  uniform vec3 uSun, uMoon, uSunCol, uAmb, uWorldLight, uSkyLight;
  ${LIB}
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    vec3 col = texture(uBg, vUv).rgb;
    vec4 w = texture(uWorld, vUv);
    if (w.a > .002) {
      vec3 alb = toLin(w.rgb / w.a);
      /* the shape's edge normal, from its alpha, at two radii */
      vec2 g = vec2(0.); float avg = 0.;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * .7853982; vec2 dir = vec2(cos(a), sin(a));
        float s1 = texture(uWorld, vUv + dir * uTexel * 2.5 * uDPR).a, s2 = texture(uWorld, vUv + dir * uTexel * 6. * uDPR).a;
        g += dir * (s1 + s2 * .6); avg += s1 * .6 + s2 * .4;
      }
      avg /= 8.;
      vec2 n = -g; float nl = length(n); n = nl > 1e-4 ? n / nl : vec2(0.);
      n.y = -n.y;                        /* uv y is up; screen y is down */
      float edge = clamp((1. - avg) * 1.6, 0., 1.);
      /* key light: the sun by day, the moon by night */
      vec3 key = uSun.z > .01 ? uSun : uMoon;
      vec3 keyCol = uSun.z > .01 ? uSunCol : vec3(.45, .6, 1.) * .9;
      vec2 L = normalize(key.xy - px + 1e-3);
      float rim = edge * pow(max(dot(n, L), 0.), 1.5) * key.z * (1. - uUnder);
      float top = edge * max(-n.y, 0.);
      /* a little relief from the art itself */
      float l0 = dot(w.rgb, vec3(.33)), lx = dot(texture(uWorld, vUv + vec2(uTexel.x * uDPR, 0.)).rgb, vec3(.33));
      float bump = (lx - l0) * sign(L.x) * 1.5;
      vec3 lit = alb * (uWorldLight * (1. + bump * .3) + uSkyLight * top * .2) + keyCol * rim * (.25 + .9 * dot(alb, vec3(.33)));
      col = col * (1. - w.a) + lit * w.a;
    }
    /* light shafts, then a little low mist in front, where the world meets the air */
    vec3 rays = texture(uRays, vUv).rgb;
    col += rays * uSunCol * uRayK;
    vec2 wp = vec2((px.x - uRes.x * .5) / uZoom + uCamX, (px.y - uRes.y * .5) / uZoom + uCamY);
    float m = uMist * fbm(vec2(wp.x * .004 + uTime * .03, wp.y * .012)) * exp(-max(-wp.y - 10., 0.) / 70.) * smoothstep(10., -10., wp.y) * (1. - uUnder) * (1. - w.a * .65);
    col = mix(col, uSkyLight * 1.1 + uSunCol * uSun.z * .1, clamp(m * .4, 0., .45));
    o = vec4(col, 1.);
  }`;

  /* particles: pollen and dust in the sunbeams, leaves, snow, fireflies */
  const VS_PART = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uDPR, uMaxPt, uKind, uCount, uGroundY;
  uniform sampler2D uRays;
  out float vBlur, vRot, vSeed, vGlow, vFade;
  float h(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  void main() {
    float i = float(gl_VertexID);
    float z = pow(h(i * 1.37 + uKind), 2.2);          /* 0 far … 1 right in front of the camera */
    float par = mix(.25, 1.8, z);
    vec2 span = uRes + vec2(200.);
    vec2 vel;
    float size;
    if (uKind < .5) { vel = vec2(6. * sin(uTime * .3 + i), -4. + 8. * h(i * 5.1)); size = mix(1.5, 18., z * z); }        /* dust and pollen */
    else if (uKind < 1.5) { vel = vec2(-30. - 40. * h(i * 2.3), 26. + 30. * h(i * 4.7)) * (.5 + z); size = mix(4., 46., z * z); }   /* leaves */
    else if (uKind < 2.5) { vel = vec2(-10. + 6. * sin(uTime * .5 + i), 34. + 30. * h(i * 4.7)) * (.5 + z); size = mix(2., 34., z * z); }   /* snow */
    else { vel = vec2(12. * sin(uTime * .7 + i * 3.), 9. * cos(uTime * .9 + i)); size = mix(3., 10., z); }   /* fireflies */
    vec2 p = vec2(h(i * 2.1), h(i * 3.7)) * span + vel * uTime - vec2(uCamX * uZoom * par, uCamY * uZoom * par * .5);
    if (uKind > 2.5) { p.x = mod(p.x, span.x) - 100.; p.y = uGroundY - 10. - mod(h(i * 3.7) * 140. + 9. * sin(uTime * .4 + i), 140.) * uZoom * .6; }
    else p = mod(p, span) - 100.;
    p.x += sin(uTime * (.5 + h(i * 8.)) + i) * 14. * z;
    gl_Position = vec4(p.x / uRes.x * 2. - 1., 1. - p.y / uRes.y * 2., 0., 1.);
    gl_PointSize = min(size * uDPR, uMaxPt);
    vBlur = smoothstep(.45, 1., z);
    vRot = uTime * (1. + 3. * h(i * 6.1)) + i;
    vSeed = h(i * 9.9);
    vGlow = textureLod(uRays, vec2(p.x / uRes.x, 1. - p.y / uRes.y), 0.).r;
    vFade = step(h(i * 11.3), uCount);
  }`;
  const FS_PART = `#version 300 es
  precision highp float;
  in float vBlur, vRot, vSeed, vGlow, vFade; out vec4 o;
  uniform float uKind, uTime, uNight, uSeason; uniform vec3 uSunCol, uWorldLight;
  void main() {
    if (vFade < .5) discard;
    vec2 q = gl_PointCoord * 2. - 1.;
    float soft = .08 + vBlur * .9;
    if (uKind < .5) {
      float a = smoothstep(1., 1. - soft - .3, length(q));
      vec3 c = uSunCol * (vGlow * 5. + .06) * (1. - uNight);
      o = vec4(c * a * (1. - vBlur * .5), 0.);                     /* additive */
    } else if (uKind < 1.5) {
      float c = cos(vRot), s = sin(vRot); vec2 r = mat2(c, -s, s, c) * q;
      r.x *= 1. + .6 * abs(sin(vRot * .7));                           /* a leaf tumbling */
      float d = length(r * vec2(1., 2.2));
      float a = smoothstep(1., 1. - soft, d) * (1. - vBlur * .45);
      vec3 pal = vSeed < .33 ? vec3(.95, .62, .08) : vSeed < .66 ? vec3(.85, .4, .05) : vec3(.98, .8, .2);
      if (uSeason < 1.5) pal = vec3(.35, .6, .15);
      vec3 lit = pow(pal, vec3(2.2)) * (uWorldLight + uSunCol * vGlow * 3.);
      o = vec4(lit * a, a);
    } else if (uKind < 2.5) {
      float a = smoothstep(1., 1. - soft - .2, length(q)) * (.85 - vBlur * .45);
      vec3 c = uWorldLight * 1.1 + uSunCol * vGlow * 2.;
      o = vec4(c * a, a);
    } else {
      float blink = pow(max(0., sin(uTime * (1.3 + vSeed) + vSeed * 40.)), 6.);
      float a = exp(-dot(q, q) * 4.) * blink * uNight;
      o = vec4(vec3(.9, 1., .35) * a * 4., 0.);
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
  /* the final image: bloom, exposure, filmic curve, grade, vignette, grain */
  const FS_FINAL = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uB1, uB2; uniform float uTime, uNight, uWarm, uBolt, uUnder, uExposure; uniform vec2 uRes;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main() {
    vec3 c = texture(uScene, vUv).rgb;
    c += texture(uB1, vUv).rgb * .55 + texture(uB2, vUv).rgb * .45;
    c += vec3(.9, .95, 1.) * uBolt * .8;
    c *= uExposure;
    c = aces(c);
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(vec3(l), c, 1.12 - uNight * .35);                                       /* saturation; colour drains a little at night */
    c *= mix(vec3(.94, .98, 1.06), vec3(1.05, 1., .93), smoothstep(.05, .7, l));      /* cool shadows, warm highlights */
    c = mix(c, c * vec3(1.08, .96, .82), uWarm * .35);                                /* golden hour */
    c = mix(c, c * vec3(.75, .88, 1.2), uNight * .5);                                 /* moonlight */
    vec2 v = vUv - .5; c *= 1. - dot(v, v) * (.55 + uNight * .3 + uUnder * .4);
    c = pow(c, vec3(1. / 2.2));
    c += (fract(sin(dot(vUv * uRes + uTime * 61., vec2(12.9898, 78.233))) * 43758.5453) - .5) * .022;
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
  function bind(u, name, unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], unit); }
  function draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  /* ---------- public ---------- */
  /* on by default; ?gfx=classic keeps the Canvas 2D look, ?gfx=gl forces this one, O flips it (remembered) */
  function gfxParam() { try { return new URLSearchParams(location.search).get('gfx') || ''; } catch (e) { return ''; } }
  function wanted() { const p = gfxParam(); return p !== 'classic' && p !== '2d'; }
  function startOn() { if (gfxParam() === 'gl') return true; try { return localStorage.getItem('wolf.gfx') !== 'off'; } catch (e) { return true; } }
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
    bgScale = d > 1.5 ? .4 : .55;
    T.bg = target(pw * bgScale, ph * bgScale);
    T.occ = target(pw / 4, ph / 4); T.rays = target(pw / 4, ph / 4);
    T.scene = target(pw, ph);
    T.b1a = target(pw / 4, ph / 4); T.b1b = target(pw / 4, ph / 4);
    T.b2a = target(pw / 8, ph / 8); T.b2b = target(pw / 8, ph / 8);
  }
  function active() { return ready && on; }
  function toggle() { if (!ready) return false; on = !on; cv.style.display = on ? 'block' : 'none'; try { localStorage.setItem('wolf.gfx', on ? 'on' : 'off'); } catch (e) {} return on; }
  function worldCtx() { return wctx; }
  function canvas() { return cv; }
  function hexLin(c) { return hexToRgb(c).map(v => Math.pow(v / 255, 2.2)); }
  const SEASON_N = { spring: 0, summer: 1, autumn: 2, winter: 3 };

  function render(G, L) {
    const t0 = performance.now();
    const cam = G.cam, Wd = G.world, weather = Wd.weather, season = Wd.season, time = G.time;
    const night = L.night, dark = L.dark;
    /* the light of the moment: a white noon, an orange low sun, a blue moon, grey under cloud */
    const sunT = L.sun.t || 0, elev = Math.sin(Math.PI * sunT);
    const sunCol = [1.0, lerp(.55, .93, Math.min(1, elev * 1.6)), lerp(.25, .82, Math.min(1, elev * 1.4))].map(v => v * (1 - weather.cloud * .65));
    const top = hexLin(L.top), bot = hexLin(L.bot);
    const amb = [lerp(top[0], bot[0], .6) * .55, lerp(top[1], bot[1], .6) * .55, lerp(top[2], bot[2], .6) * .6].map(v => v * (1 - dark * .4) + .02);
    const worldLight = [lerp(1, 70 / 255, dark), lerp(1, 92 / 255, dark), lerp(1, 150 / 255, dark)].map(v => Math.pow(v, 1.6) * (1 - weather.cloud * .3));
    const warmTint = [1 + L.warm * .12, 1 - L.warm * .02, 1 - L.warm * .14];
    for (let k = 0; k < 3; k++) worldLight[k] *= warmTint[k];
    const mist = clamp(.12 + L.warm * .55 + (weather.rain > .05 ? .35 : 0) + (season === 'autumn' ? .12 : 0) + night * .15, 0, .8);
    const sun = [L.sun.x, L.sun.y, L.sun.vis * clamp(elev * 4, 0, 1)], moon = [L.moon.x, L.moon.y, L.moon.vis];

    gl.disable(gl.BLEND);
    /* 1. the background */
    let u = use(P.bg, T.bg);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uHorizon, L.horizon); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uDark, dark); gl.uniform1f(u.uCloud, weather.cloud);
    gl.uniform1f(u.uSeason, SEASON_N[season] || 0); gl.uniform1f(u.uMist, mist); gl.uniform1f(u.uWarm, L.warm); gl.uniform1f(u.uMoonPhase, ((G.moon % 1) + 1) % 1);
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
    u = use(P.occ, T.occ); bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); gl.uniform3fv(u.uSun, sun); gl.uniform2f(u.uRes, cssW, cssH); draw();
    u = use(P.rays, T.rays); bind(u, 'uSrc', 0, T.occ.t); gl.uniform2f(u.uSunUv, sun[0] / cssW, 1 - sun[1] / cssH); gl.uniform1f(u.uSeed, (frames % 64) * .37); draw();
    /* 4. the scene */
    u = use(P.scene, T.scene);
    bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); bind(u, 'uRays', 2, T.rays.t);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); gl.uniform1f(u.uDPR, dpr);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uMist, L.underground ? 0 : mist); gl.uniform1f(u.uRayK, L.underground ? 0 : 1.1); gl.uniform1f(u.uDark, dark); gl.uniform1f(u.uWarm, L.warm);
    gl.uniform1f(u.uNight, night); gl.uniform1f(u.uUnder, L.underground ? 1 : 0);
    gl.uniform3fv(u.uSun, sun); gl.uniform3fv(u.uMoon, moon); gl.uniform3fv(u.uSunCol, sunCol); gl.uniform3fv(u.uAmb, amb);
    gl.uniform3fv(u.uWorldLight, worldLight); gl.uniform3fv(u.uSkyLight, amb.map(v => v * 1.6));
    draw();
    /* 5. particles, into the scene */
    if (!L.underground) {
      const kinds = [];
      const snowy = season === 'winter' || weather.snow > .03;
      if (!snowy && weather.rain < .05 && night < .6) kinds.push([0, 260, 1]);
      if (season === 'autumn' && weather.rain < .3) kinds.push([1, 160, .8]);
      if (snowy) kinds.push([2, 420, clamp(.25 + weather.snow, 0, 1)]);
      if ((season === 'summer' || season === 'spring') && night > .4 && weather.rain < .05) kinds.push([3, 90, 1]);
      if (kinds.length) {
        u = use(P.part, T.scene);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        bind(u, 'uRays', 0, T.rays.t);
        gl.uniform2f(u.uRes, cssW, cssH); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
        gl.uniform1f(u.uDPR, dpr); gl.uniform1f(u.uMaxPt, maxPt); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uSeason, SEASON_N[season] || 0);
        gl.uniform1f(u.uGroundY, cam.toScreen(0, Wd.ground.surfaceAt(cam.x))[1]);
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
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uWarm, L.warm); gl.uniform1f(u.uBolt, L.bolt);
    gl.uniform1f(u.uUnder, L.underground ? 1 : 0); gl.uniform1f(u.uExposure, EXPOSURE); gl.uniform2f(u.uRes, cssW, cssH);
    draw();
    frames++;
    gpuMs = gpuMs * .95 + (performance.now() - t0) * .05;
  }
  function stats() { return { on: active(), hdr, ms: gpuMs, upload: upMs, lastUpload: lastUp, maxPt, bgScale }; }

  return { init, resize, active, toggle, worldCtx, canvas, render, stats };
})();
