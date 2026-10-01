// =====================================================
// Tactile Forge · Renderer selection  [SHARED across games — keep in sync]
// =====================================================

import { Canvas2DRenderer } from './canvas2d.js';
import { WebGLRenderer, isSupported } from './webgl/renderer.js';

export const RENDERER_PREFS = ['auto', 'webgl', 'canvas'];

let cachedSupport = null;

/** Whether WebGL2 can be created at all. Probed once, then cached. */
export function webglAvailable() {
  if (cachedSupport === null) cachedSupport = isSupported();
  return cachedSupport;
}

/** Turn a user preference into the back end that will actually be used. */
export function resolveMode(pref) {
  if (pref === 'canvas') return 'canvas';
  return webglAvailable() ? 'webgl' : 'canvas';
}

export function rendererLabel(mode) {
  return mode === 'webgl' ? WebGLRenderer.label : Canvas2DRenderer.label;
}

/**
 * Build a renderer for `canvas`. Falls back to Canvas 2D if WebGL init throws
 * — a driver can advertise WebGL2 and still fail to allocate float targets.
 */
export function createRenderer(canvas, mode, opts = {}) {
  if (mode === 'webgl') {
    try {
      return new WebGLRenderer(canvas, opts);
    } catch (err) {
      console.warn('WebGL renderer unavailable, falling back to Canvas 2D:', err.message);
    }
  }
  return new Canvas2DRenderer(canvas);
}
