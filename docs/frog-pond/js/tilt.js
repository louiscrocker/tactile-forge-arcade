/* ============================================================
   tilt.js — tilt the tablet to swim
   ============================================================
   Reads the device's tilt and turns it into a joystick.  The
   way the tablet is held when tilt is switched on counts as
   "level".  iPads ask for permission, which must come from a
   tap, so enable() is called from the settings button.
   ============================================================ */
'use strict';

const Tilt = {
  x: 0, y: 0, on: false, base: null,
  handler(e) {
    if (e.beta === null || e.gamma === null) return;
    const landscape = (screen.orientation ? screen.orientation.angle : window.orientation || 0) % 180 !== 0;
    const flip = (screen.orientation ? screen.orientation.angle : window.orientation || 0) === 270 || window.orientation === -90 ? -1 : 1;
    const lr = landscape ? e.beta * flip : e.gamma, fb = landscape ? -e.gamma * flip : e.beta;
    if (!Tilt.base) Tilt.base = { lr, fb };
    const dz = (v) => Math.abs(v) < 4 ? 0 : clamp((v - sign(v) * 4) / 18, -1, 1);
    Tilt.x = dz(lr - Tilt.base.lr); Tilt.y = dz(fb - Tilt.base.fb);
  },
  async enable() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false;
      }
    } catch (e) { return false; }
    this.base = null; this.on = true;
    addEventListener('deviceorientation', this.handler);
    return true;
  },
  disable() { this.on = false; this.x = this.y = 0; removeEventListener('deviceorientation', this.handler); }
};
