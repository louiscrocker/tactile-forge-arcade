/* ============================================================
   voice.js — read it out loud
   ============================================================
   Uses the browser's built-in speech synthesis, so it works
   offline and needs no files.  Picks a friendly English voice,
   speaks slowly, and never talks over itself unless asked to.
   ============================================================ */
'use strict';

const Voice = {
  on: true,
  ready: false,
  voice: null,
  last: '',
  lastAt: 0,

  init() {
    if (!('speechSynthesis' in window)) { this.supported = false; return; }
    this.supported = true;
    const pickVoice = () => {
      const vs = speechSynthesis.getVoices();
      if (!vs.length) return;
      /* only voices that run on this device (Grownups.pickLocalVoice): an online
         voice would send the game's text away. None? Use the browser default. */
      const prefer = ['Google UK English Female', 'Microsoft Aria', 'Microsoft Jenny', 'Samantha', 'Karen', 'Google US English', 'Microsoft Zira', 'Microsoft Libby', 'Microsoft Sonia'];
      const score = (x) => { const i = prefer.findIndex(name => x.name.includes(name)); return i >= 0 ? 2 + prefer.length - i : (/female|woman/i.test(x.name) ? 1 : 0); };
      this.voice = typeof Grownups !== 'undefined' ? Grownups.pickLocalVoice(vs, 'en', score) : null;
      this.ready = true;
    };
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  },

  setEnabled(v) { this.on = v; if (!v && this.supported) speechSynthesis.cancel(); },

  /* say(text, { interrupt, rate, force, onboundary(charIndex), onend }) */
  say(text, opts = {}) {
    if (!this.on || !this.supported || !text) return;
    text = String(text).replace(/\p{Extended_Pictographic}|️|[→←↑↓]/gu, '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const now = performance.now();
    if (text === this.last && now - this.lastAt < 4000 && !opts.force) return;
    this.last = text; this.lastAt = now;
    if (opts.interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = opts.rate || .95;
    u.pitch = 1.05;
    u.volume = 1;
    if (opts.onboundary) u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) opts.onboundary(e.charIndex); };
    if (opts.onend) u.onend = opts.onend;
    speechSynthesis.speak(u);
  },

  stop() { if (this.supported) speechSynthesis.cancel(); }
};
