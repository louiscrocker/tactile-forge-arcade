/* ============================================================
   paint.js — the painted look's hooks
   ============================================================
   The painted look (gfx.js, on by default) paints the water, the
   sky, the light shafts and the caustics with WebGL2.  The animals
   and the shore are drawn by sprites.js under that light (this game
   has no baked painted animal art yet), so `Painted` only keeps the
   hooks render.js calls each frame.
   ============================================================ */
'use strict';

const Painted = (function () {
  function beginFrame() { }
  function floorPattern() { return null; }
  function cached() { return {}; }
  return { beginFrame, floorPattern, cached };
})();
