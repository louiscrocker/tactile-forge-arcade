/* ============================================================
   gfx.js — the WebGL2 look (?gfx=gl; O switches it live)
   ============================================================
     Wolf's pilot, carried to the Arctic coast.  The game still
     draws its world with Canvas 2D (render.js), but into a
     transparent layer; this module paints everything around and
     over it on the GPU:
       background (half res): a sky lit by the sun (the midnight sun
         circling low in summer, only a glow at noon in the polar
         night), the moon as a lit sphere in its real phase, stars,
         the northern lights as rippling curtains, clouds, then far
         glaciated mountains, rolling snowy (or summer-brown) hills
         and near tundra with aerial perspective; out over the sea a
         plain of sea ice in perspective (solid ice with pressure
         ridges, broken floes, or open water with the sun's glitter)
       occlusion + light shafts: blocked by the world
       scene (full res): the world layer lit by the sun or the moon,
         a rim light from each shape's edge, low drifting mist, the
         whiteout's blowing snow in front
       particles: snowfall, spindrift streaming low in the wind,
         diamond dust glinting in cold sunshine, cotton-grass fluff
         in summer
       bloom, filmic tone mapping, colour grade, vignette, grain
     No libraries; falls back to the Canvas 2D look when WebGL2 or a
     shader is missing.  Nothing in the game's logic reads from here.
   ============================================================ */
'use strict';

const GFX = (function () {
  let on = false, ready = false, cv = null, gl = null, hdr = false, maxPt = 64;
  let world = null, wctx = null, worldTex = null, vao = null;
  let cssW = 1, cssH = 1, dpr = 1, pw = 1, ph = 1, bgScale = .5;
  const P = {}, T = {};
  let frames = 0, gpuMs = 0, upMs = 0, lastUp = 0;
  const EXPOSURE = (() => { try { const v = +new URLSearchParams(location.search).get('exposure'); return v > 0 ? v : 1.02; } catch (e) { return 1.02; } })();

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
  float soft1(float x) { return .55 * n1(x) + .3 * n1(x * 2.3 + 5.) + .15 * n1(x * 5.1 + 9.); }
  vec3 toLin(vec3 c) { return pow(max(c, 0.), vec3(2.2)); }
  `;

  /* the background: sky, sun, moon, stars, aurora, clouds, mountains, hills, tundra or sea ice (alpha = open sky) */
  const FS_BG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uHorizon, uNight, uDark, uCloud, uSeason, uMist, uMoonPhase;
  uniform float uSea, uIce, uSnow, uAurora, uWhite, uSunLow;
  uniform vec3 uTop, uBot, uSun, uMoon, uSunCol, uAmb;
  ${LIB}
  float peaks(float x, float amp) { float env = .45 + .55 * smoothstep(.15, .85, n1(x * .23 + 3.)); float r = ridge1(x * .7); return amp * env * (.12 + .88 * r * r * 1.3); }
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    float H = uRes.y;
    float horizon = uHorizon;
    /* --- sky --- */
    float ty = clamp(px.y / (horizon * 1.1), 0., 1.);
    vec3 skyBot = mix(uBot, uTop, .3);
    vec3 col = mix(uTop * mix(.78, 1., ty), skyBot, pow(ty, 1.6));
    vec2 sd = (px - uSun.xy) / H; float d = length(sd);
    float sunUp = uSun.z;
    col += uSunCol * sunUp * (.7 * exp(-d * 12.) + .045 * exp(-d * 3.)) * (1. - .6 * uCloud);
    col += uSunCol * sunUp * (.06 + uSunLow * .25) * exp(-abs(px.y - horizon) / (.12 * H)) * exp(-abs(px.x - uSun.x) / (uRes.x * (.4 + uSunLow * .4)));
    float disk = smoothstep(26., 23., length(px - uSun.xy));
    col += uSunCol * disk * 9. * sunUp * (1. - uCloud);
    /* stars */
    if (uNight > .02) {
      vec2 sp = (px + vec2(uCamX * uZoom * .01, 0.)) / 2.5; vec2 ci = floor(sp);
      float r = h21(ci);
      if (r > .9962) { vec2 f = fract(sp) - .5; float tw = .55 + .45 * sin(uTime * (1.5 + 3. * h21(ci + 7.)) + r * 80.);
        col += vec3(.9, .95, 1.) * smoothstep(.5, .0, length(f)) * uNight * tw * (1. - uCloud) * 1.6 * smoothstep(horizon, horizon * .6, px.y); }
      col += vec3(.05, .07, .12) * uNight * .5 * fbm3(px / H * vec2(2., 6.) + 3.) * smoothstep(horizon, 0., px.y);
    }
    /* the northern lights: curtains of rays, a bright green lower hem, violet higher up */
    if (uAurora > .01) {
      float ax = px.x / H + uCamX * uZoom * .0004 / H;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float hem = horizon * (.42 + fi * .13) + (fbm3(vec2(ax * .9 + uTime * .025 + fi * 4.1, fi * 3.)) - .5) * H * .32;
        float above = hem - px.y;
        if (above < -H * .03 || px.y > horizon) continue;
        float fold = fbm3(vec2(ax * 3. + uTime * .05, fi * 7.)) * 9.;
        float rays = fbm3(vec2(ax * 34. + fold * .6 + fi * 13., uTime * .15 + fi));
        rays = smoothstep(.3, .8, rays) * .75 + .25 * (.5 + .5 * sin(ax * 90. + fold * 2. + uTime * .3));
        float bright = smoothstep(.25, .7, fbm3(vec2(ax * 1.6 - uTime * .02, fi * 9.)));   /* the curtain is brighter in some stretches */
        float a = max(above, 0.);
        float lower = exp(-a / (H * .045)), tall = exp(-a / (H * (.16 + fi * .05)));
        float edge = smoothstep(-H * .03, H * .004, above);
        float pulse = .7 + .3 * sin(uTime * .6 + fi * 2. + ax * 2.);
        vec3 c = vec3(.12, 1., .42) * (lower * 1.3 + tall * .55) + vec3(.55, .2, 1.) * tall * (1. - tall) * 1.6 + vec3(1., .2, .4) * lower * .08;
        col += c * rays * bright * edge * pulse * uAurora * .55 * (fi == 1. ? .6 : 1.) * smoothstep(horizon, horizon * .82, px.y) * (1. - uCloud);
      }
    }
    /* the moon: a lit sphere, phase 0 new · .5 full */
    vec2 md = (px - uMoon.xy) / 28.;
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
    float cov = mix(.3, .95, uCloud);
    vec2 cp = vec2((px.x + uCamX * uZoom * .03) / H + uTime * .004, px.y / H * 3.2);
    vec2 warp = vec2(fbm3(cp * 1.3 + uTime * .01), fbm3(cp * 1.3 + 9.));
    float cn = fbm(cp * vec2(2.2, 1.4) + warp * .8);
    float dens = smoothstep(1. - cov, 1. - cov + .3, cn) * smoothstep(horizon * 1.02, horizon * .5, px.y) * smoothstep(0., horizon * .12, px.y + horizon * .05);
    if (dens > .001) {
      vec2 toSun = normalize(uSun.xy - px + 1e-3) * .06;
      float cn2 = fbm(cp * vec2(2.2, 1.4) + warp * .8 + vec2(toSun.x / 2.2, toSun.y * 3.2 / 1.4) * 1.5);
      float lit = clamp(.55 + (cn - cn2) * 6., 0., 1.);
      vec3 shade = mix(uBot * .8 + vec3(.05), vec3(.4, .43, .48), uCloud * .8) * (1. - uDark * .7);
      vec3 cc = mix(shade, uSunCol * 1.15 + uAmb * .3, lit * sunUp * (1. - uCloud * .7));
      cc += uSunCol * sunUp * 2.2 * exp(-d * 5.) * (1. - dens);
      cc = mix(cc, vec3(.05, .06, .1) + vec3(.3, .35, .5) * uMoon.z * lit * .4, uNight * .85);
      col = mix(col, cc, dens * .9);
    }
    float sky = 1.;
    vec3 haze = mix(uBot, uTop, .55) * .92 * (1. - uDark * .6) + uSunCol * sunUp * .1 * exp(-abs(px.x - uSun.x) / uRes.x * 2.5);
    haze = mix(haze, vec3(.86, .9, .95) * (1. - uDark * .7), uWhite * .7);
    vec2 sunDir = vec2(clamp((uSun.x - px.x) / uRes.x * 2.2, -1., 1.), 1.);
    vec3 light = uAmb * .8 + uSunCol * sunUp * 1.25;
    vec3 snowA = vec3(.9, .93, .97), blueSh = vec3(.42, .55, .78);
    float summer = 1. - uSnow;
    vec3 tundra = uSeason > 1.5 ? vec3(.36, .22, .12) : vec3(.27, .27, .17);
    /* --- the far mountains, the hills, the near tundra; out at sea a plain of ice --- */
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float par = fi == 0. ? .02 : fi == 1. ? .05 : fi == 2. ? .12 : .22;
      float k = fi == 0. ? 1.6 : fi == 1. ? 1.2 : fi == 2. ? .9 : .7;
      float lx = ((px.x - uRes.x * .5) * k / H + uCamX * uZoom * par / H) * (fi < 1. ? 2. : 3.2);
      float base = horizon + H * (fi == 0. ? .03 : fi == 1. ? .07 : fi == 2. ? .1 : .13) + max(0., uCamY + 300.) * uZoom * .01 * (fi + 1.);
      float sy;
      float land = 1. - (fi >= 2. ? uSea : fi == 1. ? uSea * .85 : 0.);
      if (i == 0) sy = base - peaks(lx, H * (.17 - uSea * .05));
      else if (i == 1) sy = base - H * .075 * soft1(lx * .8 + 3.) * land - H * .004;
      else sy = base - H * (fi == 2. ? .03 : .022) * soft1(lx * 1.3 + fi * 7.) * land - H * .006 * uIce * uSea * smoothstep(.55, .75, n1(lx * 4. + fi)) * (fi == 2. ? 1. : 0.);
      float cov2 = smoothstep(sy - 1., sy + 1., px.y);
      if (cov2 <= 0.) continue;
      float dy = (px.y - sy) / H;
      vec3 c;
      if (i == 0) {
        /* glaciated mountains seen from afar: broad faces, the sunward ones bright snow, the far ones in blue shadow,
           diagonal gullies running down from the ridges, rock showing on the steep shadow sides in summer */
        float fx = lx * .9 + 11.;
        float sm = (n1(fx + .02) - n1(fx - .02)) / .04;                      /* the slope of the big faces */
        float sdx = clamp((uSun.x - uRes.x * .5) / (uRes.x * .2), -1., 1.); sdx = sdx >= 0. ? max(sdx, .6) : sdx;   /* one light direction for the whole range */
        float face = clamp(.5 + sm * sdx * .9, .1, 1.15);
        float gul = ridge2(vec2(lx * 5. + dy * 9. * sign(sm), dy * 14.));        /* gullies slanting down the face */
        float rockF = smoothstep(.55, .8, gul) * (1. - uSnow * .55) * smoothstep(.0, .03, dy);
        vec3 lit = uSunCol * sunUp * .85 + uAmb * .55;
        vec3 shadowC = mix(vec3(.30, .40, .62), uTop * 1.1, .35) * (.55 + .45 * sunUp) * (1. - uDark * .7);
        vec3 snowC = mix(shadowC, snowA * lit, smoothstep(.35, .8, face));
        snowC *= .9 + .1 * smoothstep(.3, .7, gul);
        vec3 rockC = vec3(.2, .19, .2) * (uAmb * .8 + uSunCol * sunUp * face * .6);
        c = mix(snowC, rockC, rockF * .8);
        c = mix(c, c * vec3(.86, .9, 1.), smoothstep(.0, .12, dy));            /* bluer toward the foot */
      } else {
        /* rolling ground: snow with soft drifts and wind-scoured rock in winter; brown, olive or rust tundra in summer */
        float hs = (n1(lx * .7 + .03 + fi * 7.) - n1(lx * .7 - .03 + fi * 7.)) * 6.;
        float shade = clamp(.72 - hs * clamp((uSun.x - uRes.x * .5) / (uRes.x * .2), -1., 1.) * .8 * exp(-dy * 12.), .3, 1.15);
        vec2 tp = vec2(lx * 4., dy * 70.);
        float tex = fbm3(tp);
        float scour = smoothstep(.62, .78, fbm3(vec2(lx * 2.5, dy * 45.) + fi)) * exp(-dy * 25.);
        vec3 snowC = mix(snowA, vec3(.7, .8, .93), .32 + fi * .03) * (.9 + .1 * fbm3(vec2(lx * 3., dy * 160.)));   /* distant snow a little bluer than the bears */      /* sastrugi: streaks along the wind */
        vec3 brown = tundra * (.75 + .5 * tex);
        brown = mix(brown, vec3(.6, .64, .7), smoothstep(.72, .8, fbm3(vec2(lx * 2., dy * 70.) + 9.)) * .6 * summer);   /* ponds and late snow */
        vec3 alb = mix(brown, snowC, uSnow);
        alb = mix(alb, vec3(.24, .22, .2), scour * uSnow * .55);
        c = alb * (uAmb * .7 + uSunCol * sunUp * shade * .8);
        c *= .9 + .1 * smoothstep(.0, .02, dy);
        c += blueSh * uSnow * (1. - min(shade, 1.)) * .12 * (1. - uDark);
        if (uSea > .01 && i >= 1) {
          float flatT = 1.;
          /* the sea in perspective: solid ice with ridges and blue shadow, floes, or open water */
          float sh = horizon + H * .1 + max(0., uCamY + 300.) * uZoom * .03;
          float dp = max(px.y - sh, .5) / H;
          flatT = smoothstep(.03, .0, (px.y - sh) / H);              /* near the sea's horizon the texture would alias: a smooth tone instead */
          dp = max(dp, .02);
          float z = .03 / (dp + .004);
          float u = (px.x - uRes.x * .5) / H * z * 3. + uCamX * .0015;
          float v = z;
          float f = fbm(vec2(u * 1.3, v * 3.2));
          float thr = mix(1.2, .38, clamp(uIce * 1.6, 0., 1.)) - (uIce > .9 ? 1. : 0.);
          float floe = smoothstep(thr, thr + .015 + dp * .05, f);
          float rl = sin(v * 18. + fbm3(vec2(u * 2., v)) * 9.);
          float rid = smoothstep(.85, 1., rl) * uIce, ridSh = smoothstep(.6, .85, rl) * (1. - smoothstep(.85, 1., rl)) * uIce;
          vec3 ice = mix(snowA, vec3(.72, .8, .9), .25) * (.88 + .12 * fbm3(vec2(u * 9., v * 20.)));
          ice = mix(ice, vec3(.62, .74, .88), smoothstep(.5, .8, fbm3(vec2(u * 3., v * 6.) + 4.)) * .35);   /* bare blue ice and old floes */
          vec3 iceC = ice * (uAmb * .72 + uSunCol * sunUp * (.72 + rid * .25)) * (1. - ridSh * .35);
          iceC += blueSh * ridSh * .1;
          float fres = exp(-dp * 9.);
          vec3 water = mix(vec3(.025, .08, .14), mix(uBot, uTop, .4) * .8, .25 + fres * .55);
          float glit = pow(n2(vec2(u * 30., v * 60.) + uTime * .6), 12.) * exp(-abs(px.x - uSun.x) / (H * (.05 + dp * .5))) * sunUp * 30. * (1. - uCloud);
          water += uSunCol * glit;
          water += uSunCol * sunUp * .25 * exp(-abs(px.x - uSun.x) / (H * (.08 + dp))) * fres;
          vec3 seaC = mix(water, iceC, floe);
          vec3 flatC = mix(mix(vec3(.05, .14, .24), mix(uBot, uTop, .4) * .8, .6), mix(snowA, vec3(.72, .8, .9), .3) * (uAmb * .72 + uSunCol * sunUp * .72), clamp(uIce, 0., 1.) * .9 + .1);
          seaC = mix(seaC, flatC, flatT);
          c = mix(c, seaC, uSea * (i == 3 ? 1. : i == 1 ? .85 : smoothstep(0., .01, dp)));
        }
      }
      float far = fi == 0. ? .32 : fi == 1. ? .18 : fi == 2. ? .09 : .04;
      far = clamp(far + smoothstep(.0, .35, dy) * .1 + uWhite * (.5 - fi * .08), 0., .95);
      c = mix(c, haze, far * (1. - uNight * .35));
      col = mix(col, c, cov2);
      sky *= 1. - cov2;
    }
    /* a low haze of frost smoke over the coast */
    float my = horizon + H * .12;
    float mist = uMist * fbm(vec2(px.x / H * 1.6 + uCamX * uZoom * .3 / H + uTime * .02, px.y / H * 7.)) * exp(-abs(px.y - my) / (H * .07));
    col = mix(col, haze * 1.02 + uSunCol * sunUp * .05, clamp(mist * .6, 0., .5));
    o = vec4(col, sky);
  }`;

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

  /* the scene: the background, the world lit by the sun/moon with rim light, the rays, mist and the whiteout in front */
  const FS_SCENE = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uWorld, uRays;
  uniform vec2 uRes, uTexel; uniform float uDPR, uTime, uCamX, uCamY, uZoom, uMist, uRayK, uDark, uNight, uUnder, uWhite, uWind;
  uniform vec3 uSun, uMoon, uSunCol, uAmb, uWorldLight, uSkyLight;
  ${LIB}
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uRes;
    vec3 col = texture(uBg, vUv).rgb;
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
      float rim = edge * pow(max(dot(n, L), 0.), 1.5) * key.z * (1. - uUnder);
      float top = edge * max(-n.y, 0.);
      float l0 = dot(w.rgb, vec3(.33)), lx = dot(texture(uWorld, vUv + vec2(uTexel.x * uDPR, 0.)).rgb, vec3(.33));
      float bump = (lx - l0) * sign(L.x) * 1.5;
      vec3 lit = alb * (uWorldLight * (1. + bump * .3) + uSkyLight * top * .2) + keyCol * rim * (.2 + .7 * dot(alb, vec3(.33)));
      col = col * (1. - w.a) + lit * w.a;
    }
    vec3 rays = texture(uRays, vUv).rgb;
    col += rays * uSunCol * uRayK;
    vec2 wp = vec2((px.x - uRes.x * .5) / uZoom + uCamX, (px.y - uRes.y * .5) / uZoom + uCamY);
    float m = uMist * fbm(vec2(wp.x * .004 + uTime * .03, wp.y * .012)) * exp(-max(-wp.y - 10., 0.) / 70.) * smoothstep(14., -6., wp.y) * (1. - uUnder) * (1. - w.a);   /* never over the animals and the ground */
    col = mix(col, uSkyLight * 1.1 + uSunCol * uSun.z * .1, clamp(m * .4, 0., .45));
    /* the whiteout: blowing snow streaming past in front of everything */
    if (uWhite > .01) {
      float s = fbm(vec2(px.x / uRes.y * 2.5 + uTime * (.6 + uWind * .8), px.y / uRes.y * 5.));
      vec3 wc = vec3(.85, .89, .94) * (uWorldLight * .9 + .05);
      col = mix(col, wc, clamp(uWhite * (.26 + .26 * s) * (1. - uUnder), 0., .6));
    }
    o = vec4(col, 1.);
  }`;

  /* particles: 0 diamond dust in cold sunshine · 1 cotton-grass fluff · 2 snowfall · 3 spindrift low in the wind */
  const VS_PART = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime, uCamX, uCamY, uZoom, uDPR, uMaxPt, uKind, uCount, uGroundY, uWind;
  uniform sampler2D uRays;
  out float vBlur, vRot, vSeed, vGlow, vFade, vStretch;
  float h(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  void main() {
    float i = float(gl_VertexID);
    float z = pow(h(i * 1.37 + uKind), 2.2);
    float par = mix(.25, 1.8, z);
    vec2 span = uRes + vec2(200.);
    vec2 vel; float size; vStretch = 0.;
    if (uKind < .5) { vel = vec2(4. * sin(uTime * .2 + i), 3. + 4. * h(i * 5.1)); size = mix(2., 9., z * z); }
    else if (uKind < 1.5) { vel = vec2(18. + 20. * h(i * 2.3), -2. + 6. * sin(uTime * .7 + i)) * (.5 + z); size = mix(2., 9., z * z); }
    else if (uKind < 2.5) { vel = vec2(-10. - uWind * 160. + 6. * sin(uTime * .5 + i), 34. + 30. * h(i * 4.7)) * (.5 + z); size = mix(2., 30., z * z); }
    else { vel = vec2(-260. - 340. * h(i * 2.9), 8. * sin(uTime * 3. + i)) * (.4 + z) * (.4 + uWind); size = mix(3., 26., z * z); vStretch = 1.; }
    vec2 p = vec2(h(i * 2.1), h(i * 3.7)) * span + vel * uTime - vec2(uCamX * uZoom * par, uCamY * uZoom * par * .5);
    p = mod(p, span) - 100.;
    if (uKind > 2.5) p.y = uGroundY + 6. - mod(h(i * 3.7) * 90. + 6. * sin(uTime * 2. + i), 90.) * (.4 + z) * max(uZoom, .6) * .6;
    p.x += sin(uTime * (.5 + h(i * 8.)) + i) * 10. * z;
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
  in float vBlur, vRot, vSeed, vGlow, vFade, vStretch; out vec4 o;
  uniform float uKind, uTime, uNight; uniform vec3 uSunCol, uWorldLight;
  void main() {
    if (vFade < .5) discard;
    vec2 q = gl_PointCoord * 2. - 1.;
    float soft = .08 + vBlur * .9;
    if (uKind < .5) {
      /* a tumbling ice crystal: a sharp four-point glint that flashes as it turns */
      float flash = pow(max(0., sin(uTime * (2. + 4. * vSeed) + vSeed * 50.)), 8.);
      float star = max(exp(-abs(q.x) * 14.) * exp(-abs(q.y) * 2.5), exp(-abs(q.y) * 14.) * exp(-abs(q.x) * 2.5));
      float a = (star * flash + exp(-dot(q, q) * 6.) * .25) * (1. - vBlur * .6);
      o = vec4(uSunCol * a * (1.2 + vGlow * 4.), 0.);
    } else if (uKind < 1.5) {
      float c = cos(vRot), s = sin(vRot); vec2 r = mat2(c, -s, s, c) * q;
      float d = length(r * vec2(1., 1.4));
      float a = smoothstep(1., 1. - soft - .4, d) * (.55 - vBlur * .3);
      o = vec4(uWorldLight * 1.05 * a, a);
    } else if (uKind < 2.5) {
      float a = smoothstep(1., 1. - soft - .2, length(q)) * (.85 - vBlur * .45);
      vec3 c = uWorldLight * 1.1 + uSunCol * vGlow * 2.;
      o = vec4(c * a, a);
    } else {
      float a = exp(-q.y * q.y * 26.) * smoothstep(1., .2, abs(q.x)) * (.5 - vBlur * .25);
      o = vec4(uWorldLight * 1.1 * a, a);
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
    o = vec4(c * smoothstep(1.6, 4., l), 1.);
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
  uniform sampler2D uScene, uB1, uB2; uniform float uTime, uNight, uWarm, uUnder, uExposure, uAurora; uniform vec2 uRes;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main() {
    vec3 c = texture(uScene, vUv).rgb;
    c += texture(uB1, vUv).rgb * .35 + texture(uB2, vUv).rgb * .3;
    c *= uExposure;
    c = aces(c);
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(vec3(l), c, 1.18 - uNight * .3 + uAurora * .15);
    c *= mix(vec3(.93, .98, 1.07), vec3(1.01, 1., .99), smoothstep(.05, .75, l));       /* cool shadows; highlights left neutral so bright snow keeps its blue */
    c = mix(c, c * vec3(1.08, .97, .85), uWarm * .35);
    c = mix(c, c * vec3(.75, .88, 1.2), uNight * .45);
    vec2 v = vUv - .5; c *= 1. - dot(v, v) * (.5 + uNight * .3 + uUnder * .4);
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
  function bind(u, name, unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], unit); }
  function draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  /* ---------- public ---------- */
  /* on by default; ?gfx=classic keeps the Canvas 2D look, ?gfx=gl forces this one, O flips it (remembered) */
  function gfxParam() { try { return new URLSearchParams(location.search).get('gfx') || ''; } catch (e) { return ''; } }
  function wanted() { const p = gfxParam(); return p !== 'classic' && p !== '2d'; }
  function startOn() { if (gfxParam() === 'gl') return true; try { const v = localStorage.getItem('polarbear.gfx'); return v !== 'off' && v !== 'slow'; } catch (e) { return true; } }
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
  function toggle() { if (!ready) return false; on = !on; cv.style.display = on ? 'block' : 'none'; speed.t0 = 0; try { localStorage.setItem('polarbear.gfx', on ? 'on' : 'off'); } catch (e) {} return on; }
  function worldCtx() { return wctx; }
  function canvas() { return cv; }
  function hexLin(c) { return hexToRgb(c).map(v => Math.pow(v / 255, 2.2)); }
  const SEASON_N = { spring: 0, summer: 1, autumn: 2, winter: 3 };

  /* L: { night, dark, warm, horizon, top, bot, sun {x,y,vis,elev}, moon {x,y,vis}, underground, sea, ice, snow, aurora, white, wind } */
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
    try { if (localStorage.getItem('polarbear.gfx') === 'on') return; localStorage.setItem('polarbear.gfx', 'slow'); } catch (e) {}
    on = false; cv.style.display = 'none';
    console.info('gfx: ' + fps.toFixed(0) + ' fps, switched to the classic look (press O for the painted one)');
  }
  function render(G, L) {
    watchSpeed();
    const t0 = performance.now();
    const cam = G.cam, Wd = G.world, weather = Wd.weather, season = Wd.season, time = G.time;
    const night = L.night, dark = L.dark;
    /* the light of the moment: a white noon, a golden low sun (the midnight sun stays golden), a blue moon, grey under cloud */
    const elev = clamp(L.sun.elev || 0, 0, 1);
    const sunCol = [1.0, lerp(.52, .93, Math.min(1, elev * 1.6)), lerp(.25, .84, Math.min(1, elev * 1.4))].map(v => v * (1 - weather.cloud * .65));
    const top = hexLin(L.top), bot = hexLin(L.bot);
    const amb = [lerp(top[0], bot[0], .6) * .55, lerp(top[1], bot[1], .6) * .58, lerp(top[2], bot[2], .6) * .65].map(v => v * (1 - dark * .4) + .02);
    const worldLight = [lerp(1, 66 / 255, dark), lerp(1, 92 / 255, dark), lerp(1, 156 / 255, dark)].map(v => Math.pow(v, 1.6) * (1 - weather.cloud * .25));
    const cool = [.84, .89, .97]; for (let k = 0; k < 3; k++) worldLight[k] *= lerp(cool[k], 1, weather.cloud * .5);
    const warmTint = [1 + L.warm * .12, 1 - L.warm * .02, 1 - L.warm * .14];
    for (let k = 0; k < 3; k++) worldLight[k] *= warmTint[k];
    /* the northern lights tint the snow green */
    const aur = clamp(L.aurora, 0, 1.2);
    worldLight[0] += aur * .01; worldLight[1] += aur * .07; worldLight[2] += aur * .035;
    const mist = clamp(.04 + L.warm * .25 + (weather.rain > .05 ? .25 : 0) + (L.sea > .5 && !L.ice ? .2 : 0) + night * .06, 0, .6);
    const sun = [L.sun.x, L.sun.y, L.sun.vis], moon = [L.moon.x, L.moon.y, L.moon.vis];

    gl.disable(gl.BLEND);
    /* 1. the background */
    let u = use(P.bg, T.bg);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uHorizon, L.horizon); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uDark, dark); gl.uniform1f(u.uCloud, weather.cloud);
    gl.uniform1f(u.uSeason, SEASON_N[season] || 0); gl.uniform1f(u.uMist, mist); gl.uniform1f(u.uMoonPhase, ((G.moon % 1) + 1) % 1);
    gl.uniform1f(u.uSea, L.sea); gl.uniform1f(u.uIce, L.ice); gl.uniform1f(u.uSnow, L.snow); gl.uniform1f(u.uAurora, aur); gl.uniform1f(u.uWhite, L.white); gl.uniform1f(u.uSunLow, 1 - elev);
    gl.uniform3fv(u.uTop, top); gl.uniform3fv(u.uBot, bot); gl.uniform3fv(u.uSun, sun); gl.uniform3fv(u.uMoon, moon); gl.uniform3fv(u.uSunCol, sunCol); gl.uniform3fv(u.uAmb, amb);
    draw();
    /* 2. the world layer, as drawn by render.js this frame */
    const t1 = performance.now();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, worldTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, world);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    lastUp = performance.now() - t1; upMs = upMs * .95 + lastUp * .05;
    /* 3. light shafts */
    const rayK = L.underground ? 0 : .8 * (1 - L.white);
    u = use(P.occ, T.occ); bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); gl.uniform3fv(u.uSun, sun); gl.uniform2f(u.uRes, cssW, cssH); draw();
    u = use(P.rays, T.rays); bind(u, 'uSrc', 0, T.occ.t); gl.uniform2f(u.uSunUv, sun[0] / cssW, 1 - sun[1] / cssH); gl.uniform1f(u.uSeed, (frames % 64) * .37); draw();
    /* 4. the scene */
    u = use(P.scene, T.scene);
    bind(u, 'uBg', 0, T.bg.t); bind(u, 'uWorld', 1, worldTex); bind(u, 'uRays', 2, T.rays.t);
    gl.uniform2f(u.uRes, cssW, cssH); gl.uniform2f(u.uTexel, 1 / pw, 1 / ph); gl.uniform1f(u.uDPR, dpr);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uMist, L.underground ? 0 : mist); gl.uniform1f(u.uRayK, rayK); gl.uniform1f(u.uDark, dark);
    gl.uniform1f(u.uNight, night); gl.uniform1f(u.uUnder, L.underground ? 1 : 0); gl.uniform1f(u.uWhite, L.white); gl.uniform1f(u.uWind, L.wind);
    gl.uniform3fv(u.uSun, sun); gl.uniform3fv(u.uMoon, moon); gl.uniform3fv(u.uSunCol, sunCol); gl.uniform3fv(u.uAmb, amb);
    gl.uniform3fv(u.uWorldLight, worldLight); gl.uniform3fv(u.uSkyLight, amb.map(v => v * 1.6));
    draw();
    /* 5. particles, into the scene */
    if (!L.underground) {
      const kinds = [];
      const falling = weather.snow > .03;
      if (L.snow && !falling && weather.cloud < .4 && L.sun.vis > .2 && elev > .05) kinds.push([0, 160, .8]);
      if (season === 'summer' && L.sea < .5 && weather.rain < .05) kinds.push([1, 40, .6]);
      if (falling || (season === 'winter' && weather.cloud > .3)) kinds.push([2, 420, clamp(.2 + weather.snow, 0, 1)]);
      if (L.snow && (L.wind > .25 || L.white > .05)) kinds.push([3, 320, clamp(L.wind * .9 + L.white, 0, 1)]);
      if (kinds.length) {
        u = use(P.part, T.scene);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        bind(u, 'uRays', 0, T.rays.t);
        gl.uniform2f(u.uRes, cssW, cssH); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCamX, cam.x); gl.uniform1f(u.uCamY, cam.y); gl.uniform1f(u.uZoom, cam.zoom);
        gl.uniform1f(u.uDPR, dpr); gl.uniform1f(u.uMaxPt, maxPt); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uWind, L.wind);
        gl.uniform1f(u.uGroundY, cam.toScreen(0, Wd.ground.walkTop(cam.x, 10))[1]);
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
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uWarm, L.warm); gl.uniform1f(u.uAurora, Math.min(1, aur));
    gl.uniform1f(u.uUnder, L.underground ? 1 : 0); gl.uniform1f(u.uExposure, EXPOSURE * (1 + night * .15)); gl.uniform2f(u.uRes, cssW, cssH);
    draw();
    frames++;
    gpuMs = gpuMs * .95 + (performance.now() - t0) * .05;
  }
  function stats() { return { on: active(), hdr, ms: gpuMs, upload: upMs, lastUpload: lastUp, maxPt, bgScale }; }

  return { init, resize, active, toggle, worldCtx, canvas, render, stats };
})();
