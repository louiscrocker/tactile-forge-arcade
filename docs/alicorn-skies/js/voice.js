/* ============================================================
   voice.js — read it out loud, follow the words, real voices
   ============================================================
   Voice.say(text, { interrupt, force, rate, pitch, speaker, el,
   offset }) speaks a line.  If a grown-up has recorded that line
   in the Voice Studio (VoiceBank, stored in IndexedDB) the real
   recording plays; otherwise the browser's speech synthesis does.

   Karaoke: when `el` is given, its text is split into word
   spans and the word being spoken lights up — from the speech
   engine's word-boundary events when it sends them, or on a
   timer spread over the recording or an estimate otherwise.
   Tapping any word says that word, for a child learning to read.
   ============================================================ */
'use strict';

/* strip emoji and symbols the speech engine would read out */
function speakable(text) {
  return String(text).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}]/gu, '').replace(/\*hic\*/g, 'hic!').replace(/\s+/g, ' ').trim();
}

/* ---------- recorded voices ---------- */
const VoiceBank = {
  db: null, keys: new Set(), ready: false,
  norm(text) { return speakable(text).toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim(); },
  key(speaker, text) { return (speaker || 'narrator') + '|' + this.norm(text); },
  init() {
    if (typeof indexedDB === 'undefined') return Promise.resolve();
    return new Promise((res) => {
      let req;
      try { req = indexedDB.open('alicorn-voices', 1); } catch (e) { res(); return; }
      req.onupgradeneeded = () => req.result.createObjectStore('clips');
      req.onerror = () => res();
      req.onsuccess = () => {
        this.db = req.result;
        const tx = this.db.transaction('clips', 'readonly').objectStore('clips').getAllKeys();
        tx.onsuccess = () => { for (const k of tx.result) this.keys.add(k); this.ready = true; res(); Bus.emit('voicesLoaded', this.keys.size); };
        tx.onerror = () => res();
      };
    });
  },
  has(k) { return this.keys.has(k); },
  count() { return this.keys.size; },
  store(mode) { return this.db.transaction('clips', mode).objectStore('clips'); },
  get(k) { return new Promise((res) => { if (!this.db) return res(null); const r = this.store('readonly').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); },
  put(k, blob) { return new Promise((res) => { if (!this.db) return res(false); const r = this.store('readwrite').put(blob, k); r.onsuccess = () => { this.keys.add(k); res(true); }; r.onerror = () => res(false); }); },
  del(k) { return new Promise((res) => { if (!this.db) return res(false); const r = this.store('readwrite').delete(k); r.onsuccess = () => { this.keys.delete(k); res(true); }; r.onerror = () => res(false); }); },
  async exportAll() {
    const out = {};
    for (const k of this.keys) { const b = await this.get(k); if (!b) continue; out[k] = { type: b.type, data: await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }) }; }
    return out;
  },
  async importAll(obj) {
    let n = 0;
    for (const k of Object.keys(obj || {})) { const e = obj[k]; if (!e || !e.data) continue; const blob = await (await fetch(e.data)).blob(); if (await this.put(k, blob)) n++; }
    return n;
  }
};

/* ---------- follow-the-words highlighting ---------- */
const Karaoke = {
  /* split an element's text into clickable word spans; returns the words with their char offsets */
  set(el, text) {
    el.textContent = '';
    const words = [];
    const re = /\S+/g; let m, lastEnd = 0;
    while ((m = re.exec(text))) {
      if (m.index > lastEnd) el.appendChild(document.createTextNode(text.slice(lastEnd, m.index)));
      const sp = document.createElement('span'); sp.className = 'kw'; sp.textContent = m[0];
      const word = m[0].replace(/[^A-Za-z0-9'’-]/g, '');
      if (word) sp.addEventListener('click', (e) => { e.stopPropagation(); Voice.sayWord(word, sp); });
      el.appendChild(sp);
      words.push({ start: m.index, end: m.index + m[0].length, sp });
      lastEnd = m.index + m[0].length;
    }
    if (lastEnd < text.length) el.appendChild(document.createTextNode(text.slice(lastEnd)));
    el._kw = words;
    return words;
  },
  light(el, i) { const w = el && el._kw; if (!w) return; w.forEach((x, j) => { x.sp.classList.toggle('on', j === i); x.sp.classList.toggle('said', j < i); }); },
  byChar(el, ch) { const w = el && el._kw; if (!w) return; let i = w.findIndex(x => ch < x.end); if (i < 0) i = w.length - 1; this.light(el, i); },
  clear(el) { const w = el && el._kw; if (w) w.forEach(x => x.sp.classList.remove('on', 'said')); },
  /* spread the highlight over a duration, weighting long words */
  timed(el, ms, token) {
    const w = el && el._kw; if (!w || !w.length) return;
    const weights = w.map(x => 1 + (x.end - x.start) * .35); const tot = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    w.forEach((x, i) => { const at = acc / tot * ms; acc += weights[i]; setTimeout(() => { if (Voice.token === token) this.light(el, i); }, at); });
    setTimeout(() => { if (Voice.token === token) this.light(el, w.length); }, ms + 200);
  }
};

const Voice = {
  on: true, ready: false, voice: null, last: '', lastAt: 0, supported: false, token: 0, audio: null, follow: true,

  init() {
    VoiceBank.init();
    if (typeof speechSynthesis === 'undefined') { this.supported = false; return; }
    this.supported = true;
    const pickVoice = () => {
      const vs = speechSynthesis.getVoices();
      if (!vs.length) return;
      const prefer = ['Google UK English Female', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Sonia', 'Microsoft Libby', 'Samantha', 'Karen', 'Google US English', 'Microsoft Zira'];
      let v = null;
      for (const name of prefer) { v = vs.find(x => x.name.includes(name)); if (v) break; }
      if (!v) v = vs.find(x => x.lang && x.lang.startsWith('en') && /female|woman/i.test(x.name)) || vs.find(x => x.lang && x.lang.startsWith('en')) || vs[0];
      this.voice = v; this.ready = true;
    };
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  },

  setEnabled(v) { this.on = v; if (!v) this.stop(); },

  stop() {
    this.token++;
    if (this.supported) speechSynthesis.cancel();
    if (this.audio) { try { this.audio.pause(); } catch (e) { /* fine */ } this.audio = null; }
    if (typeof AudioFX !== 'undefined' && AudioFX.duck) AudioFX.duck(false);
  },

  /* say(text, { interrupt, rate, force, pitch, speaker, el, offset }) */
  say(text, opts = {}) {
    if (!text) return;
    const el = opts.el && this.follow ? opts.el : null;
    if (!this.on) return;
    const clean = speakable(text);
    if (!clean) return;
    const now = performance.now();
    if (clean === this.last && now - this.lastAt < 4000 && !opts.force) return;
    this.last = clean; this.lastAt = now;
    if (opts.interrupt || this.audio) this.stop();
    const token = ++this.token;
    const key = VoiceBank.key(opts.speaker, text);
    if (VoiceBank.has(key)) { this.playClip(key, el, token); return; }
    if (!this.supported) { if (el) Karaoke.timed(el, clean.length * 70, token); return; }
    const u = new SpeechSynthesisUtterance(clean);
    if (this.voice) u.voice = this.voice;
    u.rate = opts.rate || .92;
    u.pitch = opts.pitch || 1.08;
    u.volume = 1;
    if (el) {
      const off = opts.offset || 0;
      let gotBoundary = false;
      u.onboundary = (e) => { if (token !== this.token) return; gotBoundary = true; Karaoke.byChar(el, Math.max(0, e.charIndex - off)); };
      u.onstart = () => { setTimeout(() => { if (!gotBoundary && token === this.token) Karaoke.timed(el, clean.length * 62 / (u.rate || 1), token); }, 450); };
      u.onend = () => { if (token === this.token) Karaoke.light(el, 1e9); };
    }
    speechSynthesis.speak(u);
  },

  async playClip(key, el, token) {
    const blob = await VoiceBank.get(key);
    if (!blob || token !== this.token) return;
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    this.audio = a;
    if (typeof AudioFX !== 'undefined' && AudioFX.duck) AudioFX.duck(true);
    a.onloadedmetadata = () => { if (el && token === this.token && Number.isFinite(a.duration)) Karaoke.timed(el, a.duration * 1000, token); };
    a.onended = () => { URL.revokeObjectURL(url); if (this.audio === a) { this.audio = null; if (AudioFX.duck) AudioFX.duck(false); } };
    a.play().catch(() => { /* autoplay blocked until a tap: fine */ });
  },

  /* a single tapped word, slowly */
  sayWord(word, sp) {
    this.stop();
    if (sp) { sp.classList.add('tapped'); setTimeout(() => sp.classList.remove('tapped'), 700); }
    if (!this.supported) return;
    const u = new SpeechSynthesisUtterance(word);
    if (this.voice) u.voice = this.voice;
    u.rate = .72; u.pitch = 1.08;
    speechSynthesis.speak(u);
  }
};
