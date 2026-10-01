/* ============================================================
   overlay.js — the 2D layer that sits over the 3D scene
   ============================================================
   Labels, speech bubbles, wind arrows, the survey grid, rain and
   the cellar door are all screen-space work that Canvas 2D does
   better than a shader — crisp text especially.

   The drawing routines themselves still live in render.js and
   already take a context as their first argument, so this simply
   hands them a different canvas. When the software renderer is
   driving, it paints its own overlays and this layer stays idle.
   ============================================================ */
'use strict';

const Overlay = {
  active: false,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  },

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.dpr = dpr;
  },

  draw(sim, dt) {
    if (!this.active) return;
    const ctx = this.ctx, t = sim.tor;
    const survey = Render.surveyMode;

    // The shake is applied to the 3D camera, so the overlay has to move with
    // it or the labels detach from what they are pointing at.
    const shx = Render.shake ? (Math.random() - 0.5) * Render.shake : 0;
    const shy = Render.shake ? (Math.random() - 0.5) * Render.shake : 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, shx * this.dpr, shy * this.dpr);
    ctx.clearRect(-8, -8, this.W + 16, this.H + 16);

    if (!survey) Render.drawRain(ctx, t, dt);
    if (Render.cellar) Render.drawCellar(ctx, sim, t);
    if (Render.showGrid) Render.drawSurveyGrid(ctx, t);
    if (Render.showWind) Render.drawWindField(ctx, t);
    if (Render.showAnatomy && !survey) Render.drawAnatomy(ctx, t);
    if (!survey) Render.drawShouts(ctx, sim);
    if (Render.bolt) Render.paintBolt(ctx);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  clear() {
    if (!this.ctx) return;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.W, this.H);
  }
};
