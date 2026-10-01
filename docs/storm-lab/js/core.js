/* ============================================================
   core.js — maths, noise, colour cache, camera
   ============================================================
   World axes:  +x east, +z north, +y up.  Ground is the plane y = 0.
   Units are metres and metres/second throughout; only the HUD
   converts to mph / yards / miles.
   ============================================================ */
'use strict';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const MS_TO_MPH = 2.23694;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const chance = (p) => Math.random() < p;
const sign = (v) => (v < 0 ? -1 : 1);

/* Deterministic PRNG so a town seed can be replayed. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Smooth 1-D value noise, period 256. Returns 0..1. */
function makeNoise1D(seed) {
  const N = 256;
  const rng = mulberry32(seed);
  const tab = new Float32Array(N);
  for (let i = 0; i < N; i++) tab[i] = rng();
  return function (x) {
    x = x % N; if (x < 0) x += N;
    const i = x | 0, f = x - i;
    const u = f * f * (3 - 2 * f);
    return tab[i] + (tab[(i + 1) & 255] - tab[i]) * u;
  };
}

/* Smooth 2-D value noise on a 64x64 lattice. Returns 0..1. */
function makeNoise2D(seed) {
  const N = 64, M = N - 1;
  const rng = mulberry32(seed);
  const tab = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) tab[i] = rng();
  const at = (x, y) => tab[(y & M) * N + (x & M)];
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  };
}

/* ------------------------------------------------------------
   Palette
   Every mesh face stores a palette index rather than a colour
   string. Shade (lighting) and fog (distance haze) are quantised
   and the resulting "rgb(...)" strings are memoised, so a frame
   drawing several thousand faces does almost no string work.
   ------------------------------------------------------------ */
const Pal = (function () {
  const cols = [];            // [r,g,b] per palette entry
  const caches = [];          // memoised strings per entry
  const index = new Map();    // hex -> entry
  const SB = 20;              // shade buckets
  const FB = 7;               // fog buckets
  const SMAX = 1.45;          // brightest shade multiplier
  let fogRGB = [150, 160, 172];

  function id(hex) {
    let i = index.get(hex);
    if (i !== undefined) return i;
    const n = parseInt(hex.slice(1), 16);
    cols.push([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    caches.push(new Array(SB * FB).fill(null));
    i = cols.length - 1;
    index.set(hex, i);
    return i;
  }

  function str(i, shade, fog) {
    const sb = (clamp(shade, 0, SMAX) / SMAX * (SB - 1) + 0.5) | 0;
    const fb = (clamp(fog, 0, 1) * (FB - 1) + 0.5) | 0;
    const k = sb * FB + fb;
    const cache = caches[i];
    let s = cache[k];
    if (s !== null) return s;
    const sh = (sb / (SB - 1)) * SMAX;
    const fg = fb / (FB - 1);
    const c = cols[i];
    const r = (lerp(c[0] * sh, fogRGB[0], fg) + 0.5) | 0;
    const g = (lerp(c[1] * sh, fogRGB[1], fg) + 0.5) | 0;
    const b = (lerp(c[2] * sh, fogRGB[2], fg) + 0.5) | 0;
    s = 'rgb(' + (r > 255 ? 255 : r) + ',' + (g > 255 ? 255 : g) + ',' + (b > 255 ? 255 : b) + ')';
    cache[k] = s;
    return s;
  }

  /* Changing the haze colour invalidates every memoised string,
     so callers only do this when the sky mood actually changes. */
  function setFog(rgb) {
    if (rgb[0] === fogRGB[0] && rgb[1] === fogRGB[1] && rgb[2] === fogRGB[2]) return;
    fogRGB = rgb;
    for (let i = 0; i < caches.length; i++) caches[i].fill(null);
  }

  /* Unlit 0..1 base colour of a palette entry — what the GL path uploads
     into vertex buffers, since lighting happens in the shader there. */
  const _rgb = [0, 0, 0];
  function rgb(i) {
    const c = cols[i];
    _rgb[0] = c[0] / 255; _rgb[1] = c[1] / 255; _rgb[2] = c[2] / 255;
    return _rgb;
  }

  return { id, str, rgb, setFog, get fogRGB() { return fogRGB; } };
})();

/* ------------------------------------------------------------
   Camera — orbits a target, always looking straight at it.
   ------------------------------------------------------------ */
const Camera = {
  target: { x: 0, y: 90, z: 0 },
  dist: 620,
  yaw: 0.9,          // orbit angle around the target
  pitch: 0.22,       // elevation above the target, radians
  fov: 52 * DEG,

  x: 0, y: 0, z: 0,  // resolved world position
  focal: 1, W: 0, H: 0, cx: 0, cy: 0,
  _cA: 1, _sA: 0, _cP: 1, _sP: 0,
  rx: 1, rz: 0,      // world-space "screen right" vector (y is always 0)
  fx: 0, fz: 1,      // world-space forward vector projected onto the ground
  near: 1.2,

  update(W, H) {
    this.W = W; this.H = H;
    this.cx = W * 0.5; this.cy = H * 0.5;
    this.focal = (H * 0.5) / Math.tan(this.fov * 0.5);

    // Negative pitch is legal: the ground-level chaser camera needs to sit
    // below its target and crane upward. The y floor below keeps us out of
    // the dirt, and the forward vector is derived after that clamp so the
    // look-at stays consistent either way.
    this.pitch = clamp(this.pitch, -1.35, 1.45);
    const cp = Math.cos(this.pitch);
    this.x = this.target.x + this.dist * cp * Math.sin(this.yaw);
    this.y = this.target.y + this.dist * Math.sin(this.pitch);
    this.z = this.target.z + this.dist * cp * Math.cos(this.yaw);
    if (this.y < 1.6) this.y = 1.6;   // never sink below the prairie

    // Heading/elevation of the forward vector (pointing at the target).
    const dx = this.target.x - this.x, dy = this.target.y - this.y, dz = this.target.z - this.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const A = Math.atan2(dx / len, dz / len);
    const P = Math.asin(clamp(dy / len, -1, 1));
    this._cA = Math.cos(A); this._sA = Math.sin(A);
    this._cP = Math.cos(P); this._sP = Math.sin(P);

    this.rx = this._cA; this.rz = -this._sA;   // screen-right in world space
    this.fx = this._sA; this.fz = this._cA;    // forward, flattened to the ground

    /* Full 3D basis, used by the GL path: the true view direction for depth
       linearisation, and the camera up vector for billboarding particles.
       up = forward x right, matching the +Z-into-screen convention above. */
    this.fwdX = dx / len; this.fwdY = dy / len; this.fwdZ = dz / len;
    this.upX = this.fwdY * this.rz;
    this.upY = this.fwdZ * this.rx - this.fwdX * this.rz;
    this.upZ = -this.fwdY * this.rx;
  },

  /* World -> camera space. Writes into `out` (length 3) to avoid churn. */
  toCam(x, y, z, out) {
    const dx = x - this.x, dy = y - this.y, dz = z - this.z;
    const x1 = dx * this._cA - dz * this._sA;
    const z1 = dx * this._sA + dz * this._cA;
    out[0] = x1;
    out[1] = dy * this._cP - z1 * this._sP;
    out[2] = dy * this._sP + z1 * this._cP;
    return out;
  },

  /* Camera space -> screen. Caller must ensure cz > near. */
  projX(cx, cz) { return this.cx + (cx * this.focal) / cz; },
  projY(cy, cz) { return this.cy - (cy * this.focal) / cz; },

  /* Screen pixels per world metre at the given camera depth. */
  scaleAt(cz) { return this.focal / cz; },

  /* Ray from a screen pixel to the ground plane. Null if it misses. */
  screenToGround(sx, sy) {
    const dxc = (sx - this.cx) / this.focal;
    const dyc = -(sy - this.cy) / this.focal;
    // Camera-space ray (dxc, dyc, 1) rotated back into world space.
    const yz = dyc * this._cP + 1 * this._sP;
    const zz = -dyc * this._sP + 1 * this._cP;
    const wx = dxc * this._cA + zz * this._sA;
    const wy = yz;
    const wz = -dxc * this._sA + zz * this._cA;
    if (wy >= -1e-5) return null;               // pointing at or above the horizon
    const t = -this.y / wy;
    return { x: this.x + wx * t, z: this.z + wz * t };
  }
};

/* ------------------------------------------------------------
   Near-plane polygon clipping (Sutherland–Hodgman, one plane).
   Keeps geometry sane when the camera stands inside the town.
   `pts` and the result are flat [x,y,z, x,y,z, ...] in camera space.
   ------------------------------------------------------------ */
const _clipOut = new Float64Array(48);
function clipNear(pts, n, near) {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const az = pts[i * 3 + 2], bz = pts[j * 3 + 2];
    const aIn = az > near, bIn = bz > near;
    if (aIn) {
      _clipOut[m * 3] = pts[i * 3]; _clipOut[m * 3 + 1] = pts[i * 3 + 1]; _clipOut[m * 3 + 2] = az; m++;
    }
    if (aIn !== bIn) {
      const t = (near - az) / (bz - az);
      _clipOut[m * 3] = pts[i * 3] + (pts[j * 3] - pts[i * 3]) * t;
      _clipOut[m * 3 + 1] = pts[i * 3 + 1] + (pts[j * 3 + 1] - pts[i * 3 + 1]) * t;
      _clipOut[m * 3 + 2] = near;
      m++;
      if (m >= 15) break;
    }
  }
  return m;
}

/* 3x3 rotation matrix from yaw (Y), pitch (X), roll (Z) — applied Y then X then Z. */
function eulerMat(yaw, pitch, roll, m) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  m[0] = cr * cy - sr * sp * sy;  m[1] = -sr * cp; m[2] = cr * sy + sr * sp * cy;
  m[3] = sr * cy + cr * sp * sy;  m[4] = cr * cp;  m[5] = sr * sy - cr * sp * cy;
  m[6] = -cp * sy;                m[7] = sp;       m[8] = cp * cy;
  return m;
}
