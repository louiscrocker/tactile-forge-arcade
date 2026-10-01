// =====================================================
// Tactile Forge · GLSL ES 3.00 sources  [SHARED across games — keep in sync]
//
// Pipeline:
//   1. beam       -> emissive HDR target (additive, analytic beam falloff)
//   2. persist    -> max(emissive, previous * decay)   [phosphor decay]
//   3. brightpass -> downsampled, thresholded
//   4. blur x2    -> separable gaussian, per mip level
//   5. composite  -> backdrop + scene + bloom + flash + CRT
// =====================================================

// A fullscreen triangle generated from gl_VertexID — no vertex buffer needed.
export const FULLSCREEN_VS = `#version 300 es
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

// ---------- 1. Beam ----------
// One instance per segment. A zero-length segment is a round dot, so lines,
// dots and vertex highlights all share this one shader.
export const BEAM_VS = `#version 300 es
precision highp float;

in vec2 aCorner;      // static quad corner, components in {-1, +1}
in vec2 aP0;          // segment start, CSS px
in vec2 aP1;          // segment end, CSS px
in vec3 aColor;       // halo colour
in vec3 aHot;         // hot core colour
in vec3 aParams;      // x = core half-width, y = glow radius, z = intensity

uniform vec2 uRes;    // viewport in CSS px

out vec2 vPos;
out vec2 vP0;
out vec2 vP1;
out vec3 vColor;
out vec3 vHot;
out vec3 vParams;

void main() {
  vec2 d = aP1 - aP0;
  float len = length(d);
  vec2 dir = len > 0.0001 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  // Extend the quad far enough to contain the visible glow falloff.
  float ext = aParams.x + aParams.y * 4.0 + 1.5;

  vec2 anchor = mix(aP0, aP1, aCorner.x * 0.5 + 0.5);
  vec2 pos = anchor + dir * (aCorner.x * ext) + nrm * (aCorner.y * ext);

  vPos = pos;
  vP0 = aP0;
  vP1 = aP1;
  vColor = aColor;
  vHot = aHot;
  vParams = aParams;

  vec2 clip = vec2(pos.x / uRes.x * 2.0 - 1.0, 1.0 - pos.y / uRes.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

export const BEAM_FS = `#version 300 es
precision highp float;

in vec2 vPos;
in vec2 vP0;
in vec2 vP1;
in vec3 vColor;
in vec3 vHot;
in vec3 vParams;

out vec4 fragColor;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float core = vParams.x;
  float glow = vParams.y;
  float intensity = vParams.z;

  float d = segDist(vPos, vP0, vP1);

  // Hot centre: tight gaussian. Halo: broad exponential, which is what a real
  // phosphor dot spread looks like — not simply a second, wider stroke.
  float c = exp(-(d * d) / max(core * core, 0.03));
  float h = exp(-d / max(glow, 0.5));

  vec3 rgb = vHot * c * 1.45 + vColor * h * 0.42;
  fragColor = vec4(rgb * intensity, 1.0);
}
`;

// ---------- 1b. Glow ----------
// A filled elliptical falloff, for things that are a volume of light rather
// than a beam — blast fireballs, muzzle flashes. Radii are independent because
// world x and y scale to the viewport separately, so the on-screen shape of a
// world-space circle is an ellipse.
export const GLOW_VS = `#version 300 es
precision highp float;

in vec2 aCorner;      // quad corner, components in {-1, +1}
in vec2 aCenter;      // CSS px
in vec2 aRadii;       // CSS px, x and y independent
in vec3 aColor;
in float aAlpha;

uniform vec2 uRes;

out vec2 vLocal;
out vec3 vColor;
out float vAlpha;

void main() {
  vLocal = aCorner;
  vColor = aColor;
  vAlpha = aAlpha;
  vec2 pos = aCenter + aCorner * aRadii;
  vec2 clip = vec2(pos.x / uRes.x * 2.0 - 1.0, 1.0 - pos.y / uRes.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

export const GLOW_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec3 vColor;
in float vAlpha;
out vec4 fragColor;
void main() {
  float d = length(vLocal);
  if (d > 1.0) discard;
  float e = pow(1.0 - d, 1.6);
  fragColor = vec4(vColor * e * vAlpha, 1.0);
}
`;

// ---------- 2. Phosphor persistence ----------
// max() rather than accumulate: a real tube's glow decays toward black but a
// re-traced line snaps straight back to full brightness. Summing blows out.
export const PERSIST_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uCurrent;
uniform sampler2D uPrevious;
uniform float uDecay;
out vec4 fragColor;
void main() {
  vec3 cur = texture(uCurrent, vUV).rgb;
  vec3 prev = texture(uPrevious, vUV).rgb * uDecay;
  fragColor = vec4(max(cur, prev), 1.0);
}
`;

// ---------- 3. Bright pass ----------
export const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform float uThreshold;
uniform float uKnee;
out vec4 fragColor;
void main() {
  vec3 c = texture(uSrc, vUV).rgb;
  float l = max(c.r, max(c.g, c.b));
  // Soft knee so the bloom ramps in rather than popping at the threshold.
  float t = clamp((l - uThreshold) / max(uKnee, 1e-4), 0.0, 1.0);
  fragColor = vec4(c * t * t, 1.0);
}
`;

// ---------- 4. Separable gaussian ----------
// Five taps exploiting bilinear filtering to cover a nine-tap kernel.
export const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;      // 1/size
uniform vec2 uDir;        // (1,0) or (0,1)
out vec4 fragColor;
void main() {
  vec2 off = uTexel * uDir;
  vec3 sum = texture(uSrc, vUV).rgb * 0.2270270270;
  sum += texture(uSrc, vUV + off * 1.3846153846).rgb * 0.3162162162;
  sum += texture(uSrc, vUV - off * 1.3846153846).rgb * 0.3162162162;
  sum += texture(uSrc, vUV + off * 3.2307692308).rgb * 0.0702702703;
  sum += texture(uSrc, vUV - off * 3.2307692308).rgb * 0.0702702703;
  fragColor = vec4(sum, 1.0);
}
`;

// ---------- 5. Composite + CRT ----------
export const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUV;

uniform sampler2D uScene;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;

uniform vec3  uBg0;         // backdrop gradient, top
uniform vec3  uBg1;         // backdrop gradient, bottom
uniform float uFlash;       // crash flash, 0..1
uniform float uBloomStrength;
uniform float uCRT;         // 0 = flat, 1 = tube
uniform vec2  uRes;

out vec4 fragColor;

void main() {
  vec2 uv = vUV;

  // Barrel distortion, kept gentle — the pads near the screen edge still have
  // to be readable. Dividing by (1 + 2K) maps the corners exactly onto the
  // corners, so the curve never samples outside the image and no gameplay
  // area is lost to a black bezel.
  if (uCRT > 0.5) {
    const float K = 0.016;
    vec2 c = uv * 2.0 - 1.0;
    float r2 = dot(c, c);
    c *= (1.0 + K * r2) / (1.0 + 2.0 * K);
    uv = clamp(c * 0.5 + 0.5, 0.0, 1.0);
  }

  // Radial misconvergence, applied to the glow only. On the sharp layer a
  // sub-pixel channel offset swamps one-pixel-wide lines — the ground hatching
  // turned green under the amber phosphor — whereas the bloom is soft enough
  // that the same offset reads as a colour fringe, which is the intent.
  vec3 scene = texture(uScene, uv).rgb;
  vec3 bloom;
  if (uCRT > 0.5) {
    vec2 ab = (uv - 0.5) * 0.0022;
    bloom = vec3(
      texture(uBloom0, uv + ab).r,
      texture(uBloom0, uv).g,
      texture(uBloom0, uv - ab).b
    );
  } else {
    bloom = texture(uBloom0, uv).rgb;
  }

  bloom += texture(uBloom1, uv).rgb * 0.75;
  bloom += texture(uBloom2, uv).rgb * 0.55;

  vec3 backdrop = mix(uBg0, uBg1, uv.y);
  vec3 col = backdrop + scene + bloom * uBloomStrength;

  // Crash flash
  col = mix(col, vec3(1.0, 0.27, 0.27), uFlash);

  if (uCRT > 0.5) {
    float r = length(uv - 0.5);
    col *= smoothstep(0.95, 0.25, r) * 0.35 + 0.65;   // vignette
  }

  // Filmic-ish rolloff so the hot cores bloom instead of clipping flat.
  col = col / (col + vec3(0.85)) * 1.85;

  fragColor = vec4(col, 1.0);
}
`;

// Text is rasterised on a 2D canvas and uploaded, then added into the emissive
// buffer so labels bloom exactly like the vector art does.
export const TEXT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
out vec4 fragColor;
void main() {
  vec4 t = texture(uTex, vUV);
  fragColor = vec4(t.rgb * t.a, 1.0);
}
`;
