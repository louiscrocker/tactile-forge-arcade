/* ============================================================
   voice.js — read it out loud, in a grown-up's own voice if
              one was recorded
   ============================================================
   Uses the browser's built-in speech synthesis, so it works
   offline and needs no files.  If a parent recorded a line in
   the Voice Recorder (VoiceClips), that recording plays instead.
   say() returns true when a recording is playing.
   ============================================================ */
'use strict';

/* ---------- recorded clips, kept in IndexedDB per child ---------- */
const VoiceClips = (function () {
  let db = null, keys = new Set(), current = null, recorder = null, chunks = [], stream = null;
  const mem = new Map();          // used when the browser will not give us IndexedDB
  const store = () => 'clips';
  function open() {
    return new Promise((res) => {
      if (!('indexedDB' in window)) return res(null);
      try {
        const r = indexedDB.open('frogpond-voice-' + (typeof Profile !== 'undefined' ? Profile.id : 'main'), 1);
        r.onupgradeneeded = () => r.result.createObjectStore(store());
        r.onsuccess = () => { db = r.result; const tx = db.transaction(store(), 'readonly'); const req = tx.objectStore(store()).getAllKeys(); req.onsuccess = () => { keys = new Set(req.result); res(db); }; req.onerror = () => res(db); };
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  const ready = Promise.race([open(), new Promise(r => setTimeout(() => r(null), 900))]);
  function get(key) { return new Promise((res) => { if (!db) return res(mem.get(key) || null); const req = db.transaction(store(), 'readonly').objectStore(store()).get(key); req.onsuccess = () => res(req.result || null); req.onerror = () => res(null); }); }
  function put(key, blob) { return new Promise((res) => { if (!db) { mem.set(key, blob); keys.add(key); return res(true); } const tx = db.transaction(store(), 'readwrite'); tx.objectStore(store()).put(blob, key); tx.oncomplete = () => { keys.add(key); res(true); }; tx.onerror = () => res(false); }); }
  function del(key) { return new Promise((res) => { if (!db) { mem.delete(key); keys.delete(key); return res(true); } const tx = db.transaction(store(), 'readwrite'); tx.objectStore(store()).delete(key); tx.oncomplete = () => { keys.delete(key); res(true); }; }); }
  function stop() { if (current) { try { current.pause(); } catch (e) { /* fine */ } current = null; } }
  async function play(key, onend) {
    const blob = await get(key); if (!blob) return false;
    stop();
    const a = new Audio(URL.createObjectURL(blob));
    current = a; a.onended = () => { if (current === a) current = null; onend && onend(); };
    try { await a.play(); } catch (e) { return false; }
    return true;
  }
  async function startRecording() {
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('This browser cannot record.');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = []; recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.start();
  }
  function stopRecording(key) {
    return new Promise((res) => {
      if (!recorder) return res(false);
      recorder.onstop = async () => { const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); stream.getTracks().forEach(t => t.stop()); recorder = null; res(await put(key, blob)); };
      recorder.stop();
    });
  }
  return { isPlaying: () => !!current && !current.paused, ready, saved: () => !!db, has: (k) => keys.has(k), play, stop, del, startRecording, stopRecording, recording: () => !!recorder, count: () => keys.size };
})();

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
      const prefer = ['Google UK English Female', 'Microsoft Aria', 'Microsoft Jenny', 'Samantha', 'Karen', 'Google US English', 'Microsoft Zira', 'Microsoft Libby', 'Microsoft Sonia'];
      let v = null;
      for (const name of prefer) { v = vs.find(x => x.name.includes(name)); if (v) break; }
      if (!v) v = vs.find(x => x.lang && x.lang.startsWith('en') && /female|woman/i.test(x.name)) || vs.find(x => x.lang && x.lang.startsWith('en')) || vs[0];
      this.voice = v; this.ready = true;
    };
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  },

  setEnabled(v) { this.on = v; if (!v) this.stop(); },

  /* say(text, { interrupt, rate, force, key, onboundary(charIndex), onend }) */
  say(text, opts = {}) {
    if (!this.on || !text) return false;
    /* a grown-up's recording wins */
    if (opts.key && VoiceClips.has(opts.key)) {
      const now = performance.now();
      if (opts.key === this.lastKey && now - this.lastAt < 4000 && !opts.force) return true;
      this.lastKey = opts.key; this.lastAt = now;
      if (this.supported) speechSynthesis.cancel();
      VoiceClips.play(opts.key, opts.onend);
      return true;
    }
    if (!this.supported) return false;
    text = String(text).replace(/[🐸🥚🌿✨🍃🟢🦟🪰🐦🌧️❄️💤🌸🧊😅😮🎵♪→←↑↓📷🗺️]/gu, '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    const now = performance.now();
    if (text === this.last && now - this.lastAt < 4000 && !opts.force) return false;
    this.last = text; this.lastAt = now; this.lastKey = null;
    if (opts.interrupt) { speechSynthesis.cancel(); VoiceClips.stop(); }
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = opts.rate || .95;
    u.pitch = 1.05;
    u.volume = 1;
    if (opts.onboundary) u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) opts.onboundary(e.charIndex); };
    if (opts.onend) u.onend = opts.onend;
    speechSynthesis.speak(u);
    return false;
  },

  stop() { if (this.supported) speechSynthesis.cancel(); VoiceClips.stop(); }
};

/* ---------- the recorder panel ---------- */
const Recorder = (function () {
  const $ = (id) => document.getElementById(id);
  let Gm, recKey = null, section = 'story';
  function lines() {
    const simple = Gm.settings.reading === 'simple';
    if (section === 'story') return CHAPTERS.map(c => ({ key: 'story:' + c.key, label: c.title, text: simple ? c.simple : c.full }));
    if (section === 'facts') return Object.keys(FACTS).map(k => ({ key: 'fact:' + k, label: FACTS[k].title, text: `${FACTS[k].title}. ${simple ? FACTS[k].simple : FACTS[k].body}` }));
    if (section === 'hints') return Object.keys(HINTS).map(k => ({ key: 'hint:' + k, label: k, text: HINTS[k][simple ? 1 : 0] }));
    return GUIDE_ORDER.map(k => ({ key: 'guide:' + k, label: GUIDE[k].name, text: `${GUIDE[k].name}. ${simple ? GUIDE[k].simple : GUIDE[k].body} It is ${GUIDE[k].size}.` }));
  }
  function init(game) {
    Gm = game;
    if (!$('recorder')) return;
    $('recorderClose').addEventListener('click', () => { if (VoiceClips.recording()) VoiceClips.stopRecording(recKey); $('recorder').hidden = true; });
    $('recPick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { section = b.dataset.sec; render(); }));
  }
  function render() {
    $('recPick').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.sec === section));
    const list = $('recList'); list.innerHTML = '';
    for (const L of lines()) {
      const row = document.createElement('div'); row.className = 'recrow' + (VoiceClips.has(L.key) ? ' has' : '');
      const txt = document.createElement('div'); txt.className = 'rectext'; txt.innerHTML = `<b></b><span></span>`; txt.querySelector('b').textContent = L.label; txt.querySelector('span').textContent = L.text; row.appendChild(txt);
      const rec = document.createElement('button'); rec.className = 'chip rec'; rec.textContent = recKey === L.key ? '■ Stop' : '● Record';
      rec.addEventListener('click', async () => {
        if (recKey === L.key) { await VoiceClips.stopRecording(L.key); recKey = null; render(); return; }
        if (recKey) await VoiceClips.stopRecording(recKey);
        try { await VoiceClips.startRecording(); recKey = L.key; } catch (e) { $('recNote').textContent = 'Could not use the microphone: ' + e.message; recKey = null; }
        render();
      });
      row.appendChild(rec);
      const play = document.createElement('button'); play.className = 'chip'; play.textContent = '▶'; play.disabled = !VoiceClips.has(L.key);
      play.addEventListener('click', () => VoiceClips.play(L.key)); row.appendChild(play);
      const del = document.createElement('button'); del.className = 'chip'; del.textContent = '✕'; del.disabled = !VoiceClips.has(L.key);
      del.addEventListener('click', async () => { await VoiceClips.del(L.key); render(); }); row.appendChild(del);
      list.appendChild(row);
    }
    $('recCount').textContent = `${VoiceClips.count()} recorded`;
  }
  async function open() { await VoiceClips.ready; render(); $('recorder').hidden = false; if (!VoiceClips.saved()) $('recNote').textContent = 'This browser will not keep recordings after you close the page. Host the game (or install it) to keep them.'; }
  return { init, open };
})();
