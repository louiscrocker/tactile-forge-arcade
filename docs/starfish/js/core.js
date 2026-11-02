/* ============================================================
   core.js — maths, random, noise, colour, camera, event bus
   ============================================================
   World coordinates are canvas-native: +x right, +y DOWN.
   The ground surface is near y = 0: the sky and the plants are
   at negative y, the soil (and the whole ant nest) at positive y.
   One world unit is roughly one screen pixel at zoom 1.
   (Shared with Ladybug Life; only the camera bounds differ.)
   ============================================================ */
'use strict';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const easeOutBack = (t) => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const chance = (p) => Math.random() < p;
const sign = (v) => (v < 0 ? -1 : 1);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angleLerp = (a, b, t) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return a + d * t; };
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

/* Deterministic PRNG so a world can be rebuilt from its seed. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Smooth 1-D value noise, period 256, returns 0..1. */
function makeNoise1D(seed) {
  const N = 256, rng = mulberry32(seed), tab = new Float32Array(N);
  for (let i = 0; i < N; i++) tab[i] = rng();
  return function (x) {
    x = x % N; if (x < 0) x += N;
    const i = x | 0, f = x - i, u = f * f * (3 - 2 * f);
    return tab[i] + (tab[(i + 1) & 255] - tab[i]) * u;
  };
}

/* Smooth 2-D value noise on a 64×64 lattice (wraps), returns 0..1. */
function makeNoise2D(seed) {
  const N = 64, rng = mulberry32(seed), tab = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) tab[i] = rng();
  const at = (i, j) => tab[((j & 63) << 6) | (i & 63)];
  return function (x, y) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

/* ---------- colour helpers ---------- */
function hexToRgb(hex) {
  if (hex[0] !== '#') {
    /* "rgb(a)(r,g,b[,a])" strings come back from mixHex; accept them too */
    const m = hex.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [0, 0, 0];
  }
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbStr(c, a = 1) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mixRgb(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function mixHex(a, b, t, alpha = 1) { return rgbStr(mixRgb(hexToRgb(a), hexToRgb(b), t), alpha); }
function shade(hex, k, alpha = 1) {  // k < 1 darker, > 1 lighter
  const c = hexToRgb(hex);
  return rgbStr([clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)], alpha);
}
function withAlpha(hex, a) { return rgbStr(hexToRgb(hex), a); }

/* ---------- camera ----------
   Converts between world and screen.  Follows a target with a
   critically-damped spring so it never overshoots or jitters.
   Bounds are a plain rectangle: the sky above, the bottom of the
   soil below, the edges of the world at the sides. */
class Camera {
  constructor() {
    this.x = 0; this.y = 0; this.zoom = 1.4;
    this.tx = 0; this.ty = 0; this.tzoom = 1.4;
    this.w = 1; this.h = 1;
    this.shake = 0;
  }
  resize(w, h) { this.w = w; this.h = h; }
  follow(x, y, zoom) { this.tx = x; this.ty = y; if (zoom) this.tzoom = zoom; }
  snap() { this.x = this.tx; this.y = this.ty; this.zoom = this.tzoom; }
  update(dt, bounds) {
    const k = 1 - Math.exp(-dt * 4.5);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.zoom += (this.tzoom - this.zoom) * (1 - Math.exp(-dt * 3));
    if (bounds) {
      const hw = this.w / this.zoom / 2, hh = this.h / this.zoom / 2;
      const lo = bounds.left + hw, hi = bounds.right - hw;
      this.x = lo < hi ? clamp(this.x, lo, hi) : (bounds.left + bounds.right) / 2;
      const top = bounds.top + hh, bot = bounds.bottom - hh;
      this.y = top < bot ? clamp(this.y, top, bot) : (bounds.top + bounds.bottom) / 2;
    }
    this.shake = Math.max(0, this.shake - dt * 3);
  }
  toScreen(wx, wy) {
    return [(wx - this.x) * this.zoom + this.w / 2, (wy - this.y) * this.zoom + this.h / 2];
  }
  toWorld(sx, sy) {
    return [(sx - this.w / 2) / this.zoom + this.x, (sy - this.h / 2) / this.zoom + this.y];
  }
  apply(ctx) {
    ctx.translate(this.w / 2, this.h / 2);
    if (this.shake > 0) {
      const s = this.shake * 8;
      ctx.translate(rnd(-s, s), rnd(-s, s));
    }
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
  /* visible world rectangle, padded */
  viewRect(pad = 0) {
    const hw = this.w / this.zoom / 2 + pad, hh = this.h / this.zoom / 2 + pad;
    return { l: this.x - hw, r: this.x + hw, t: this.y - hh, b: this.y + hh };
  }
}

/* ---------- tiny event bus ---------- */
const Bus = {
  _l: {},
  on(ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); },
  emit(ev, ...args) { (this._l[ev] || []).forEach(f => f(...args)); }
};

/* rounded-rect path helper */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
