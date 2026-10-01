/* ============================================================
   glshaders.js — GLSL ES 3.00 sources
   ============================================================
   `#version 300 es` must be the very first characters of a
   shader, so every template literal below starts hard against
   the backtick.
   ============================================================ */
'use strict';

const SH = {};

/* ---------- shared helpers ---------- */
const GLSL_COMMON = `
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
/* Aerial perspective. Exponential extinction whose density falls off with
   altitude, plus forward scattering toward the sun. This is what lets
   something twenty kilometres away read as *distant* rather than simply
   faded out — the linear fog it replaces hit full strength and became a
   flat wall. */
vec3 aerial(vec3 col, vec3 world, vec3 cam, vec3 fogCol, vec3 sun, float haze){
  vec3 d = world - cam;
  float dist = length(d);
  float hAvg = max(0.0, (world.y + cam.y) * 0.5);
  float thin = exp(-hAvg / 2400.0);
  float f = 1.0 - exp(-dist * haze * thin);
  float mu = max(0.0, dot(d / max(dist, 0.001), sun));
  vec3 h = fogCol * (1.0 + 0.55 * pow(mu, 8.0));
  return mix(col, h, clamp(f, 0.0, 1.0));
}

/* How much direct sun reaches a point, given the storm overhead. Traces the
   sun ray up to the cloud base and asks whether it comes out inside the
   storm's cloud disc. Under a supercell the ground is in deep shadow, with
   sunlit country beyond the edge — which is most of what makes a storm read
   as enormous. */
float sunThroughStorm(vec3 world, vec3 sun, vec2 stormXZ, float stormR,
                      float cloudBase, float stage){
  if (stage <= 0.01) return 1.0;
  float climb = (cloudBase - world.y) / max(0.15, sun.y);
  vec2 hit = world.xz + sun.xz * climb;
  float d = length(hit - stormXZ);
  float cover = smoothstep(stormR * 1.35, stormR * 0.5, d) * clamp(stage * 1.4, 0.0, 1.0);
  return 1.0 - 0.62 * cover;
}
`;

/* ============================================================
   Fullscreen pass — shared vertex shader
   ============================================================ */
SH.fsVert = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/* ============================================================
   Sky
   ============================================================ */
SH.skyFrag = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 frag;

uniform mat4 uInvVP;
uniform vec3 uCam;
uniform vec3 uTop;
uniform vec3 uHor;
uniform vec3 uSun;
uniform sampler3D uNoise;
uniform float uTime;
uniform float uCloudBase;
uniform vec2 uTorXZ;
uniform float uWallR;
uniform float uLife;
${GLSL_COMMON}

void main(){
  vec4 a = uInvVP * vec4(vUv * 2.0 - 1.0, -1.0, 1.0);
  vec4 b = uInvVP * vec4(vUv * 2.0 - 1.0,  1.0, 1.0);
  vec3 rd = normalize(b.xyz / b.w - a.xyz / a.w);

  float up = clamp(rd.y, -0.2, 1.0);

  /* An overcast deck is a plane above the camera, so it covers the whole
     sky and converges on the horizon. A simple height ramp reproduces
     that far more reliably than scattering blobs around. */
  vec3 col = mix(uHor, uTop, pow(clamp(up * 1.6, 0.0, 1.0), 0.62));

  // Bright slot right at the horizon, where light gets under the anvil.
  float slot = exp(-abs(rd.y) * 42.0);
  col = mix(col, uHor * 1.22 + 0.04, slot * 0.55);

  if (rd.y > -0.02) {
    // Where the view ray meets the cloud base, so texture has real
    // perspective instead of being pasted flat across the sky.
    float t = (uCloudBase - uCam.y) / max(rd.y, 0.012);
    t = clamp(t, 0.0, 40000.0);
    vec3 hit = uCam + rd * t;
    vec3 np = vec3(hit.x, hit.z, uTime * 6.0) * 0.00016;
    float n = texture(uNoise, np).r;
    n = mix(n, texture(uNoise, np * 3.1 + vec3(0.0, 0.0, uTime * 0.004)).r, 0.5);

    float dens = smoothstep(0.30, 0.85, n) * smoothstep(0.0, 0.09, rd.y);
    col = mix(col, uTop * 0.44, dens * 0.75);

    // Mammatus-ish relief on the underside.
    float lumps = smoothstep(0.55, 0.95, texture(uNoise, np * 7.0).r);
    col *= 1.0 - lumps * 0.16 * smoothstep(0.0, 0.16, rd.y);

    // Wall cloud: the lowered, rotating mass the funnel hangs from.
    float d = length(hit.xz - uTorXZ);
    float wall = smoothstep(uWallR * 2.6, uWallR * 0.35, d) * uLife;
    float swirl = texture(uNoise, vec3((hit.xz - uTorXZ) * 0.0012, uTime * 0.03)).r;
    col = mix(col, uTop * 0.24, wall * (0.55 + 0.35 * swirl));
  }

  // A little warmth toward the sun, scattered through the murk.
  float sd = max(0.0, dot(rd, uSun));
  col += uHor * 0.30 * pow(sd, 7.0) * (0.35 + 0.65 * slot);

  frag = vec4(col, 1.0);
}`;

/* ============================================================
   Depth-only pass for the shadow map
   ============================================================ */
SH.shadowVert = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uLightVP;
uniform mat4 uModel;
void main(){ gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;

SH.shadowFrag = `#version 300 es
precision mediump float;
void main(){}`;

/* ============================================================
   Props
   ============================================================ */
SH.meshVert = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCol;
uniform mat4 uVP;
uniform mat4 uModel;
uniform mat4 uLightVP;
out vec3 vNrm;
out vec3 vCol;
out vec3 vWorld;
out vec4 vLightPos;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  // Props are rotated and translated only — never scaled — so the upper
  // 3x3 of the model matrix is a valid normal matrix as-is.
  vNrm = mat3(uModel) * aNrm;
  vCol = aCol;
  vLightPos = uLightVP * w;
  gl_Position = uVP * w;
}`;

SH.meshFrag = `#version 300 es
precision highp float;
in vec3 vNrm;
in vec3 vCol;
in vec3 vWorld;
in vec4 vLightPos;
out vec4 frag;

uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uAmbCol;
uniform vec3 uCam;
uniform vec3 uFogCol;
uniform float uFogNear;
uniform float uFogFar;
uniform float uHaze;
uniform sampler2D uShadow;
uniform float uShadowTexel;
uniform float uShadowBias;
uniform float uFlash;
uniform vec2 uStormXZ;
uniform float uStormR;
uniform float uStormStage;
uniform float uCloudBase;
${GLSL_COMMON}

float shadowAt(vec4 lp, float ndl){
  vec3 q = lp.xyz / lp.w * 0.5 + 0.5;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 || q.z > 1.0) return 1.0;
  // Slope-scaled: surfaces edge-on to the sun need more of it.
  float bias = uShadowBias * mix(3.5, 1.0, ndl);
  float sum = 0.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      float d = texture(uShadow, q.xy + vec2(float(x), float(y)) * uShadowTexel).r;
      sum += (q.z - bias > d) ? 0.0 : 1.0;
    }
  }
  return sum / 9.0;
}

void main(){
  vec3 n = normalize(vNrm);
  float ndl = max(0.0, dot(n, uSun));
  float sh = shadowAt(vLightPos, ndl);

  // Hemispheric ambient: sky above, bounced ground light below.
  float hemi = 0.5 + 0.5 * n.y;
  vec3 amb = uAmbCol * mix(0.55, 1.15, hemi);
  float sun = sunThroughStorm(vWorld, uSun, uStormXZ, uStormR, uCloudBase, uStormStage);
  vec3 col = vCol * (amb + uSunCol * ndl * sh * sun);
  col += vCol * uFlash * 0.5;

  float dist = length(vWorld - uCam);
  col = aerial(col, vWorld, uCam, uFogCol, uSun, uHaze);
  frag = vec4(col, 1.0);
}`;

/* ============================================================
   Terrain
   ============================================================ */
SH.groundVert = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in vec3 aNrm;
uniform mat4 uVP;
uniform mat4 uLightVP;
out vec2 vUv;
out vec3 vWorld;
out vec3 vNrm;
out vec4 vLightPos;
void main(){
  vWorld = aPos;
  vUv = aUv;
  vNrm = aNrm;
  vLightPos = uLightVP * vec4(aPos, 1.0);
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

SH.groundFrag = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
in vec3 vWorld;
in vec3 vNrm;
in vec4 vLightPos;
out vec4 frag;

uniform float uProcedural;
uniform sampler2D uTex;
uniform sampler3D uNoise;
uniform sampler2D uShadow;
uniform float uShadowTexel;
uniform float uShadowBias;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uAmbCol;
uniform vec3 uCam;
uniform vec3 uFogCol;
uniform float uFogNear;
uniform float uFogFar;
uniform float uHaze;
uniform float uFlash;
uniform vec2 uStormXZ;
uniform float uStormR;
uniform float uStormStage;
uniform float uCloudBase;
${GLSL_COMMON}

float shadowAt(vec4 lp){
  vec3 q = lp.xyz / lp.w * 0.5 + 0.5;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 || q.z > 1.0) return 1.0;
  float sum = 0.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      float d = texture(uShadow, q.xy + vec2(float(x), float(y)) * uShadowTexel).r;
      sum += (q.z - uShadowBias * 2.0 > d) ? 0.0 : 1.0;
    }
  }
  return sum / 9.0;
}

void main(){
  vec3 base;
  if (uProcedural > 0.5) {
    /* Outer county: no baked texture out here, so the field patchwork is
       generated from the same noise the bake uses. */
    float n = texture(uNoise, vec3(vWorld.xz * 0.00042, 0.11)).r;
    vec3 a = vec3(0.40, 0.46, 0.24), b = vec3(0.50, 0.51, 0.30);
    vec3 c = vec3(0.34, 0.42, 0.22), d = vec3(0.58, 0.54, 0.35);
    base = n < 0.34 ? a : (n < 0.55 ? b : (n < 0.76 ? c : d));
    base *= 0.88 + 0.24 * texture(uNoise, vec3(vWorld.xz * 0.0021, 0.6)).r;
  } else {
    base = texture(uTex, vUv).rgb;
  }
  float dist = length(vWorld - uCam);

  /* Field detail at metre scale, done here because the baked texture is far
     too coarse for it. Faded out with distance so it never shimmers. */
  float d1 = texture(uNoise, vec3(vWorld.xz * 0.055, 0.31)).r;
  float d2 = texture(uNoise, vec3(vWorld.xz * 0.19, 0.77)).r;
  float grain = (d1 * 0.62 + d2 * 0.38) - 0.5;
  base *= 1.0 + grain * 0.20 * (1.0 - smoothstep(140.0, 1100.0, dist));

  float sh = shadowAt(vLightPos);
  // Lit by the true surface normal, so hillsides catch the sun properly.
  vec3 n = normalize(vNrm);
  float ndl = max(0.0, dot(n, uSun));
  float sun = sunThroughStorm(vWorld, uSun, uStormXZ, uStormR, uCloudBase, uStormStage);
  float hemi = 0.5 + 0.5 * n.y;
  vec3 col = base * (uAmbCol * mix(0.7, 1.15, hemi) + uSunCol * ndl * sh * sun);
  col += base * uFlash * 0.5;
  col = aerial(col, vWorld, uCam, uFogCol, uSun, uHaze);
  frag = vec4(col, 1.0);
}`;

/* ============================================================
   Damage swath
   ============================================================ */
SH.swathVert = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in float aFade;
uniform mat4 uVP;
out float vFade;
out vec3 vWorld;
void main(){
  vWorld = aPos;
  vFade = aFade;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

SH.swathFrag = `#version 300 es
precision highp float;
in float vFade;
in vec3 vWorld;
out vec4 frag;
uniform vec3 uCam;
uniform vec3 uFogCol;
uniform vec3 uSun;
uniform float uHaze;
${GLSL_COMMON}
void main(){
  vec3 col = vec3(0.24, 0.19, 0.13);
  col = aerial(col, vWorld, uCam, uFogCol, uSun, uHaze);
  frag = vec4(col, vFade * 0.72);
}`;

/* ============================================================
   Volumetric funnel
   ============================================================ */
SH.funnelFrag = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 frag;

uniform sampler2D uDepth;
uniform sampler3D uNoise;
uniform mat4 uInvVP;
uniform vec3 uCam;
uniform vec3 uFwd;
uniform vec3 uSun;
uniform vec3 uProfile[9];     // (centreX, centreZ, radius) up the column
uniform vec2 uBoundC;
uniform float uBoundR;
uniform float uCloudBase;
uniform float uYBot;
uniform float uTime;
uniform float uSpin;
uniform float uVmax;
uniform float uLife;
uniform float uNear;
uniform float uFar;
uniform float uDensity;
uniform int uSteps;
${GLSL_COMMON}

vec3 profileAt(float h){
  float t = clamp(h / uCloudBase, 0.0, 1.0) * 8.0;
  float fi = floor(t);
  int i = int(min(fi, 7.0));
  float f = t - fi;
  return mix(uProfile[i], uProfile[i + 1], f);
}

void main(){
  vec4 a = uInvVP * vec4(vUv * 2.0 - 1.0, -1.0, 1.0);
  vec4 b = uInvVP * vec4(vUv * 2.0 - 1.0,  1.0, 1.0);
  vec3 ro = uCam;
  vec3 rd = normalize(b.xyz / b.w - a.xyz / a.w);

  // Stop the march at whatever solid geometry the scene pass already drew.
  float maxT = 1e9;
  float dz = texture(uDepth, vUv).r;
  if (dz < 1.0) {
    float ndc = dz * 2.0 - 1.0;
    float vz = (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
    maxT = vz / max(0.02, dot(rd, uFwd));
  }

  // Ray against the bounding cylinder of the whole vortex.
  vec2 oc = ro.xz - uBoundC;
  float A = dot(rd.xz, rd.xz);
  float t0, t1;
  if (A < 1e-7) {
    if (dot(oc, oc) > uBoundR * uBoundR) { frag = vec4(0.0); return; }
    t0 = 0.0; t1 = 1e9;
  } else {
    float B = 2.0 * dot(oc, rd.xz);
    float C = dot(oc, oc) - uBoundR * uBoundR;
    float disc = B * B - 4.0 * A * C;
    if (disc <= 0.0) { frag = vec4(0.0); return; }
    float sq = sqrt(disc);
    t0 = (-B - sq) / (2.0 * A);
    t1 = (-B + sq) / (2.0 * A);
  }

  if (abs(rd.y) > 1e-5) {
    float ta = (uYBot - ro.y) / rd.y;
    float tb = (uCloudBase - ro.y) / rd.y;
    t0 = max(t0, min(ta, tb));
    t1 = min(t1, max(ta, tb));
  } else if (ro.y < uYBot || ro.y > uCloudBase) {
    frag = vec4(0.0); return;
  }

  t0 = max(t0, 0.0);
  t1 = min(t1, maxT);
  if (t1 <= t0) { frag = vec4(0.0); return; }

  float dt = (t1 - t0) / float(uSteps);
  // Jitter the first sample: without it the march bands into visible shells.
  float jitter = hash12(vUv * 1024.0 + uTime);
  float T = 1.0;
  vec3 col = vec3(0.0);
  float span = max(1.0, uCloudBase - uYBot);

  for (int i = 0; i < 128; i++){
    if (i >= uSteps || T < 0.02) break;
    float t = t0 + (float(i) + jitter) * dt;
    vec3 p = ro + rd * t;

    vec3 pr = profileAt(p.y);
    vec2 d = p.xz - pr.xy;
    float r = length(d);
    float R = max(2.0, pr.z);

    // Condensation lives in a shell at the funnel wall, thinning inward.
    float x = (r - R) / (R * 0.42);
    float shell = exp(-x * x);
    if (r < R) shell = max(shell, 0.34 * exp(-x * x * 0.22));

    // Twist the sampling frame with height and time: this is what makes the
    // structure read as rotation rather than drifting fog.
    float omega = uSpin * (uVmax / max(10.0, R)) * 0.30;
    float ang = omega * uTime + p.y * 0.014 * uSpin;
    float ca = cos(ang), sa = sin(ang);
    vec2 rp = vec2(d.x * ca - d.y * sa, d.x * sa + d.y * ca);

    vec3 np = vec3(rp.x, p.y * 0.55, rp.y) * 0.0052;
    float n = texture(uNoise, np).r;
    n = mix(n, texture(uNoise, np * 2.9 + vec3(0.0, -uTime * 0.02, 0.0)).r, 0.45);

    float dens = shell * smoothstep(0.30, 0.90, n) * uLife;
    dens *= smoothstep(0.0, 0.10, (p.y - uYBot) / span);
    dens *= 1.0 - 0.30 * smoothstep(0.88, 1.0, p.y / uCloudBase);

    if (dens > 0.002){
      float aStep = 1.0 - exp(-dens * dt * uDensity);
      float hFrac = clamp(p.y / uCloudBase, 0.0, 1.0);
      // Dirt-laden and dark at the base, bright condensation higher up.
      vec3 base = mix(vec3(0.40, 0.33, 0.26), vec3(0.76, 0.78, 0.83),
                      smoothstep(0.01, 0.30, hFrac));
      vec3 outward = normalize(vec3(d.x, 0.0, d.y) + 1e-5);
      float lit = 0.62 + 0.38 * clamp(dot(outward, uSun), -1.0, 1.0);
      // Gentle self-shadowing: deeper into the volume is a little darker.
      col += T * aStep * base * lit * (0.70 + 0.30 * T);
      T *= (1.0 - aStep);
    }
  }
  frag = vec4(col, 1.0 - T);
}`;

/* ============================================================
   Particles — instanced billboards
   ============================================================ */
SH.partVert = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aPosSize;   // xyz = world, w = radius
layout(location=2) in vec4 aColA;      // rgb + alpha
uniform mat4 uVP;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vC;
out vec4 vColA;
out vec3 vWorld;
void main(){
  vec3 w = aPosSize.xyz + (uRight * aCorner.x + uUp * aCorner.y) * aPosSize.w;
  vWorld = w;
  vC = aCorner;
  vColA = aColA;
  gl_Position = uVP * vec4(w, 1.0);
}`;

SH.partFrag = `#version 300 es
precision highp float;
in vec2 vC;
in vec4 vColA;
in vec3 vWorld;
out vec4 frag;
uniform vec3 uCam;
uniform vec3 uFogCol;
uniform vec3 uSun;
uniform float uHaze;
${GLSL_COMMON}
void main(){
  float d = dot(vC, vC);
  if (d > 1.0) discard;
  float a = vColA.a * (1.0 - d) * (1.0 - d);
  vec3 col = aerial(vColA.rgb, vWorld, uCam, uFogCol, uSun, uHaze);
  frag = vec4(col, a);
}`;

/* ============================================================
   Post
   ============================================================ */
SH.brightFrag = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uTex;
uniform float uThreshold;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  frag = vec4(c * smoothstep(uThreshold, uThreshold + 0.35, l), 1.0);
}`;

SH.blurFrag = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uTex;
uniform vec2 uDir;      // texel-sized step, horizontal or vertical
void main(){
  vec3 s = texture(uTex, vUv).rgb * 0.2270270270;
  s += texture(uTex, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  s += texture(uTex, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  s += texture(uTex, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  s += texture(uTex, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  frag = vec4(s, 1.0);
}`;

SH.postFrag = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomAmt;
uniform float uFlash;
uniform float uVignette;
uniform float uTime;
${GLSL_COMMON}
void main(){
  vec3 c = texture(uScene, vUv).rgb;
  c += texture(uBloom, vUv).rgb * uBloomAmt;
  c += vec3(0.88, 0.93, 1.0) * uFlash * 0.30;

  vec2 q = vUv - 0.5;
  float vig = 1.0 - dot(q, q) * uVignette;
  c *= clamp(vig, 0.0, 1.0);

  // Gentle filmic shoulder, then a touch of grain so flat sky does not band.
  c = c / (c + vec3(0.86)) * 1.86;
  c += (hash12(vUv * 2048.0 + uTime) - 0.5) * 0.012;
  frag = vec4(c, 1.0);
}`;

/* ============================================================
   Supercell — volumetric storm above the tornado
   ============================================================
   Raymarched at quarter resolution and upsampled: cloud is very
   low-frequency, so the cost drops 16x and almost nothing shows.

   Everything is expressed as a multiple of the cloud base height,
   so the whole storm rescales correctly when that slider moves.
   Real proportions are roughly base 1.2 km, top 14 km — about
   twelve to one — which is what uTopMul defaults to.
   ============================================================ */
SH.cloudFrag = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 frag;

uniform sampler3D uNoise;
uniform mat4 uInvVP;
uniform vec3 uCam;
uniform vec3 uSun;
uniform vec3 uTop;         // sky colours, so cloud sits in the same palette
uniform vec3 uHor;
uniform vec2 uStormXZ;
uniform vec2 uDir;         // storm motion, normalised (downshear)
uniform vec2 uPerp;
uniform float uBase;       // cloud base height
uniform float uTopMul;     // storm top as a multiple of the base
uniform float uStage;      // 0..1 development
uniform float uMeso;       // strength of the wall cloud / clear slot
uniform float uTime;
uniform int uSteps;
${GLSL_COMMON}

float stormDensity(vec3 p){
  float H = uBase;
  float S = uStage;
  float top = mix(H * 2.4, H * uTopMul, smoothstep(0.04, 0.88, S));
  if (p.y > top * 1.20 || p.y < H * 0.42) return 0.0;

  vec2 d = p.xz - uStormXZ;
  float u = dot(d, uDir);
  float v = dot(d, uPerp);
  float rFlat = length(d);

  float t = clamp((p.y - H) / max(1.0, top - H), 0.0, 1.0);
  // The updraft leans downshear with height — that tilt is what lets a
  // supercell keep its updraft and downdraft apart and stay alive for hours.
  float lean = t * t * H * 7.0;
  vec2 tc = vec2(u - lean, v);
  float rr = length(tc);

  float dens = 0.0;

  // Main updraft tower.
  float towerR = H * (2.6 + 3.8 * t) * (0.45 + 0.55 * S);
  float tower = smoothstep(towerR, towerR * 0.22, rr);
  tower *= smoothstep(0.0, 0.05, t) * (1.0 - 0.25 * smoothstep(0.82, 1.0, t));
  dens = max(dens, tower * 1.15);

  // Anvil, spreading at the tropopause and streaming downshear.
  float ay = smoothstep(0.52, 0.74, t) * (1.0 - smoothstep(0.93, 1.05, t));
  float ar = H * 34.0 * S;
  float down = smoothstep(-H * 7.0, H * 12.0, u - lean);
  dens = max(dens, ay * smoothstep(ar, ar * 0.12, rr) * (0.30 + 0.80 * down));

  // Overshooting top: the updraft punching through the anvil.
  float ot = smoothstep(H * 2.4, 0.0, rr)
           * smoothstep(top * 0.95, top * 1.0, p.y)
           * (1.0 - smoothstep(top * 1.0, top * 1.18, p.y)) * S;
  dens = max(dens, ot * 0.9);

  // Flat base deck, fading out toward the horizon.
  float deck = smoothstep(H * 0.66, H * 0.95, p.y) * (1.0 - smoothstep(H, H * 2.2, p.y));
  deck *= smoothstep(H * 17.0, H * 6.0, rFlat);
  dens = max(dens, deck * 0.46);

  // Wall cloud: the lowered base beneath the mesocyclone.
  float wl = smoothstep(H * 3.6, H * 0.8, rFlat)
           * (1.0 - smoothstep(H * 0.52, H * 1.10, p.y)) * uMeso;
  dens = max(dens, wl * 0.95);

  // Rear-flank downdraft clear slot, carving in behind the circulation.
  vec2 slot = vec2(u + H * 2.4, v - H * 2.8);
  float cut = smoothstep(H * 3.4, H * 0.5, length(slot))
            * (1.0 - smoothstep(H * 0.3, H * 3.4, p.y)) * uMeso;
  dens *= 1.0 - 0.88 * cut;

  if (dens <= 0.001) return 0.0;

  // Erode the primitives into cloud.
  float n1 = texture(uNoise, p * (1.0 / (H * 11.0)) + vec3(0.0, 0.0, uTime * 0.0035)).r;
  float n2 = texture(uNoise, p * (1.0 / (H * 2.8)) + vec3(uTime * 0.008, 0.0, 0.0)).r;
  float fbm = n1 * 0.62 + n2 * 0.38;
  return dens * smoothstep(0.34, 0.76, fbm + 0.20);
}

void main(){
  vec4 a = uInvVP * vec4(vUv * 2.0 - 1.0, -1.0, 1.0);
  vec4 b = uInvVP * vec4(vUv * 2.0 - 1.0,  1.0, 1.0);
  vec3 ro = uCam;
  vec3 rd = normalize(b.xyz / b.w - a.xyz / a.w);

  float H = uBase;
  float top = mix(H * 2.4, H * uTopMul, smoothstep(0.04, 0.88, uStage)) * 1.20;
  float lo = H * 0.42;

  // Intersect the slab the whole storm lives in.
  float t0 = 0.0, t1 = 90000.0;
  if (abs(rd.y) < 1e-4) {
    if (ro.y < lo || ro.y > top) { frag = vec4(0.0); return; }
  } else {
    float ta = (lo - ro.y) / rd.y;
    float tb = (top - ro.y) / rd.y;
    t0 = max(t0, min(ta, tb));
    t1 = min(t1, max(ta, tb));
  }
  if (t1 <= t0) { frag = vec4(0.0); return; }

  float dt = (t1 - t0) / float(uSteps);
  float jitter = hash12(vUv * 512.0 + uTime);
  float T = 1.0;
  vec3 col = vec3(0.0);

  for (int i = 0; i < 64; i++){
    if (i >= uSteps || T < 0.03) break;
    float t = t0 + (float(i) + jitter) * dt;
    vec3 p = ro + rd * t;
    float dens = stormDensity(p);
    if (dens <= 0.004) continue;

    /* Two samples toward the sun give enough occlusion for the classic
       storm look: luminous tops, heavy dark base. A full light march
       would double the cost for very little extra. */
    float shade = stormDensity(p + uSun * H * 2.2) + stormDensity(p + uSun * H * 5.5);
    float lit = exp(-shade * 1.25);

    float hFrac = clamp((p.y - H) / max(1.0, top - H), 0.0, 1.0);
    vec3 base = mix(uTop * 0.78, vec3(0.94), smoothstep(0.02, 0.52, hFrac));
    vec3 c = base * (0.42 + 0.62 * lit);
    // Warm rim where sun grazes the edge of a turret.
    c += uHor * 0.26 * pow(1.0 - dens, 3.0) * lit;

    float aStep = 1.0 - exp(-dens * dt * 0.00085);
    col += T * aStep * c;
    T *= (1.0 - aStep);
  }
  frag = vec4(col, 1.0 - T);
}`;

/* Upsample the quarter-res cloud buffer over the sky. */
SH.compositeFrag = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uTex;
void main(){ frag = texture(uTex, vUv); }`;

/* ============================================================
   Instanced vegetation
   ============================================================
   One canonical low-poly tree, tens of thousands of instances.
   The interesting part is in the vertex shader: every tree leans
   away from and around the circulation, so a tornado crossing
   the county visibly drags the whole landscape with it.
   ============================================================ */
SH.treeVert = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCol;
layout(location=3) in vec4 aInst;    // world xyz, scale
layout(location=4) in vec4 aInst2;   // yaw, tint, fallen, kind

uniform mat4 uVP;
uniform vec2 uTorXZ;
uniform float uTorPush;
uniform float uTorR;
uniform float uSpin;
uniform float uTime;

out vec3 vNrm;
out vec3 vCol;
out vec3 vWorld;

void main(){
  float yaw = aInst2.x;
  float fallen = aInst2.z;
  vec3 p = aPos * aInst.w;
  vec3 n = aNrm;

  // Snapped trees are laid over in the direction they were thrown.
  if (fallen > 0.5) {
    float ca = cos(1.32), sa = sin(1.32);
    float lay = p.y * sa;
    p = vec3(p.x + lay, p.y * ca, p.z);
    n = vec3(n.x * ca + n.y * sa, n.y * ca - n.x * sa, n.z);
  }

  float cy = cos(yaw), sy = sin(yaw);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);

  vec3 world = aInst.xyz + p;

  /* Bend the crown, not the trunk: quadratic in height so the base stays
     planted. A free-vortex 1/r falloff means the lean reaches well beyond
     the funnel, which is what it does in life. */
  float bend = clamp(aPos.y / 7.0, 0.0, 1.0);
  bend *= bend;

  vec2 d = world.xz - uTorXZ;
  float dist = length(d) + 1.0;
  vec2 away = d / dist;
  vec2 tang = vec2(-away.y, away.x) * uSpin;
  float push = min(uTorPush / max(dist, uTorR), 7.0);
  vec2 lean = (away * 0.5 + tang * 0.9) * push;

  // A little ambient movement so the landscape is never quite still.
  lean += vec2(sin(uTime * 1.4 + aInst.x * 0.09),
               cos(uTime * 1.15 + aInst.z * 0.11)) * 0.20;

  world.xz += lean * bend * aInst.w * 2.6;

  vNrm = n;
  vWorld = world;

  vec3 broad = mix(vec3(0.22, 0.42, 0.20), vec3(0.31, 0.50, 0.24), aInst2.y);
  vec3 conif = mix(vec3(0.15, 0.31, 0.19), vec3(0.20, 0.38, 0.22), aInst2.y);
  vec3 leaf = mix(broad, conif, aInst2.w);
  vCol = mix(aCol, leaf, step(0.5, aCol.g * 2.0));   // trunk keeps its colour

  gl_Position = uVP * vec4(world, 1.0);
}`;

SH.treeFrag = `#version 300 es
precision highp float;
in vec3 vNrm;
in vec3 vCol;
in vec3 vWorld;
out vec4 frag;

uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uAmbCol;
uniform vec3 uCam;
uniform vec3 uFogCol;
uniform float uHaze;
uniform float uFlash;
uniform vec2 uStormXZ;
uniform float uStormR;
uniform float uStormStage;
uniform float uCloudBase;
${GLSL_COMMON}

void main(){
  vec3 n = normalize(vNrm);
  float ndl = max(0.0, dot(n, uSun));
  float hemi = 0.5 + 0.5 * n.y;
  float sun = sunThroughStorm(vWorld, uSun, uStormXZ, uStormR, uCloudBase, uStormStage);
  vec3 col = vCol * (uAmbCol * mix(0.6, 1.1, hemi) + uSunCol * ndl * sun);
  col += vCol * uFlash * 0.5;
  col = aerial(col, vWorld, uCam, uFogCol, uSun, uHaze);
  frag = vec4(col, 1.0);
}`;
