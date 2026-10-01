/* ============================================================
   voice.js — the game's reading-aloud voice
   ============================================================
   A thin wrapper over the browser's speech synthesis (works
   offline, no files).  It picks a clear English voice when one
   is installed, and supports what Read to Play needs: a slower
   rate for single words, word-boundary callbacks so the page can
   light each word as it is read, and an onend callback.
   Callers decide whether to speak: UI.speak honours the "Read
   aloud" setting; Read to Play help always speaks, because the
   child asked for it.
   ============================================================ */
'use strict';

const Voice = {
  supported: false,
  voice: null,
  last: '',
  lastAt: 0,

  init() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.supported = true;
    const pickVoice = () => {
      const vs = speechSynthesis.getVoices();
      if (!vs.length) return;
      const prefer = ['Google UK English Female', 'Microsoft Aria', 'Microsoft Jenny', 'Samantha', 'Karen', 'Google US English', 'Microsoft Zira', 'Microsoft Libby', 'Microsoft Sonia'];
      let v = null;
      for (const name of prefer) { v = vs.find(x => x.name.includes(name)); if (v) break; }
      if (!v) v = vs.find(x => x.lang && x.lang.startsWith('en') && /female|woman/i.test(x.name)) || vs.find(x => x.lang && x.lang.startsWith('en')) || vs[0];
      this.voice = v;
    };
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  },

  /* say(text, { interrupt, rate, force, onboundary(charIndex), onend }) */
  say(text, opts = {}) {
    if (!this.supported || !text) return false;
    text = String(text).replace(/[—–]/g, ',').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    const now = performance.now();
    if (text === this.last && now - this.lastAt < 4000 && !opts.force) return false;
    this.last = text; this.lastAt = now;
    try {
      if (opts.interrupt !== false) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.rate = opts.rate || .95;
      u.pitch = 1.05;
      if (opts.onboundary) u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) opts.onboundary(e.charIndex); };
      if (opts.onend) u.onend = opts.onend;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  },

  stop() { if (this.supported) try { speechSynthesis.cancel(); } catch (e) { /* no voices */ } }
};
