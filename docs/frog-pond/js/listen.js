/* ============================================================
   listen.js — the microphone that stays on while a child reads
   ============================================================
   Listener.start() runs from the moment a reading panel opens
   until it is told to stop (when "I read it!" is tapped, or a
   word card is answered).  It:
     - keeps the browser's speech recognition running, restarting
       it whenever the browser stops it (it does, after a pause
       or about a minute), without looping on errors;
     - ignores anything heard while the game itself is talking,
       so the frog's voice never counts as the child's reading;
     - follows the child through the text in order (align()),
       forgiving "two/to", digits, and one-letter slips;
     - shows a live sound meter so the child knows it hears them;
     - optionally records the reading so a grown-up can listen.
   Recognition in Chrome uses Google's servers: it needs the
   internet.  Everything else works offline.
   ============================================================ */
'use strict';

/* ---------- matching a heard word to an expected word ---------- */
const SOUNDS_LIKE = {
  to: ['two', 'too', '2'], two: ['to', 'too', '2'], too: ['to', 'two'], for: ['four', '4'], four: ['for', '4'], one: ['won', '1'], won: ['one'],
  i: ['eye', 'aye', 'hi'], see: ['sea', 'c'], sea: ['see'], be: ['bee', 'b'], bee: ['be'], eggs: ['eggs', 'x'], egg: ['ag', 'eg'],
  are: ['r', 'our'], our: ['are'], you: ['u'], why: ['y'], by: ['bye', 'buy'], hi: ['high'], here: ['hear'], there: ['their'],
  no: ['know'], know: ['no'], new: ['knew'], red: ['read'], read: ['red', 'reed'], a: ['uh', 'ah'], it: ['at'], at: ['it'],
  three: ['3'], five: ['5'], am: ['im', "i'm"], frog: ['frogs', 'fog'], frogs: ['frog'], fly: ['flies', 'fli'], legs: ['leg'], leg: ['legs'],
  hop: ['hops', 'hot'], swim: ['swims'], sing: ['sings'], bug: ['bugs', 'bog'], log: ['logs', 'lug'], mud: ['mug'], pad: ['pads', 'pat']
};
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 9;
  const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function wordsMatch(heard, want) {
  if (!heard || !want) return false;
  if (heard === want) return true;
  if ((SOUNDS_LIKE[want] || []).includes(heard)) return true;
  if (want.length >= 4 && lev(heard, want) <= 1) return true;
  if (want.length >= 4 && (heard === want + 's' || heard + 's' === want)) return true;
  return false;
}
/* Follow the child through the text.  Returns the indices of expected words
   that were read, in order.  A heard word may skip ahead up to 3 words (a word
   the recogniser missed), but never jump back; unmatched noise is ignored. */
function align(expected, heard) {
  const got = []; let p = 0;
  for (const h of heard) {
    for (let j = p; j < Math.min(expected.length, p + 4); j++) {
      if (wordsMatch(h, expected[j])) { got.push(j); p = j + 1; break; }
    }
  }
  return got;
}

/* ---------- recordings of the child reading (IndexedDB, memory if none) ---------- */
const Takes = (function () {
  let db = null; const mem = new Map();
  const ready = Promise.race([new Promise((res) => {
    try {
      if (typeof indexedDB === 'undefined') return res(null);
      const r = indexedDB.open('frogpond-takes-' + (typeof Profile !== 'undefined' ? Profile.id : 'main'), 1);
      r.onupgradeneeded = () => r.result.createObjectStore('takes');
      r.onsuccess = () => { db = r.result; res(db); }; r.onerror = () => res(null);
    } catch (e) { res(null); }
  }), new Promise(r => setTimeout(() => r(null), 900))]);
  async function put(key, blob) { await ready; if (!db) { mem.set(key, blob); return; } db.transaction('takes', 'readwrite').objectStore('takes').put(blob, key); }
  async function get(key) { await ready; if (!db) return mem.get(key) || null; return new Promise((res) => { const q = db.transaction('takes', 'readonly').objectStore('takes').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); }
  async function del(key) { await ready; if (!db) { mem.delete(key); return; } db.transaction('takes', 'readwrite').objectStore('takes').delete(key); }
  let playing = null;
  async function play(key) { const b = await get(key); if (!b) return false; if (playing) playing.pause(); playing = new Audio(URL.createObjectURL(b)); playing.play().catch(() => {}); return true; }
  return { put, get, del, play, saved: () => !!db };
})();

const Listener = (function () {
  const SRC = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  let rec = null, active = false, opts = null, heard = [], finalWords = [], restarts = 0, startedAt = 0, lastErr = null;
  let stream = null, analyser = null, meterRaf = 0, recorder = null, chunks = [], quietUntil = 0;

  function supported() { return !!SRC; }
  /* the game is talking: do not listen to ourselves */
  function gameSpeaking() {
    const tts = typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking;
    if (tts || (typeof VoiceClips !== 'undefined' && VoiceClips.isPlaying && VoiceClips.isPlaying())) { quietUntil = performance.now() + 450; return true; }
    return performance.now() < quietUntil;
  }
  function makeRec() {
    const r = new SRC(); r.lang = 'en-US'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 3;
    r.onresult = (e) => {
      if (!active) return;
      if (gameSpeaking()) return;
      let interim = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        /* take every alternative: any of them may hold the right word */
        /* the best guess, in order; if another guess holds a word we expected at the same spot, prefer it */
        const best = tokenize(res[0].transcript);
        for (let a = 1; a < res.length && opts.expected; a++) { const alt = tokenize(res[a].transcript); alt.forEach((w, k) => { if (k < best.length && !opts.expected.includes(best[k]) && opts.expected.includes(w)) best[k] = w; }); }
        if (res.isFinal) finalWords.push(...best); else interim.push(...best);
      }
      heard = finalWords.concat(interim);
      opts.onHeard && opts.onHeard(heard);
    };
    r.onerror = (e) => { lastErr = e.error; if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'network' || e.error === 'audio-capture') { opts.onError && opts.onError(e.error); active = false; } };
    r.onend = () => {
      /* the browser stops listening after a pause or about a minute: start again */
      if (!active) return;
      if (++restarts > 40) { opts.onError && opts.onError('too-many-restarts'); return; }
      setTimeout(() => { if (active) try { rec = makeRec(); rec.start(); } catch (e) { /* fine */ } }, 250);
    };
    return r;
  }
  async function startMeter(record) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!active) { stream.getTracks().forEach(t => t.stop()); stream = null; return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = (typeof AudioFX !== 'undefined' && AudioFX.ctx) || new AC();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser(); analyser.fftSize = 512; src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => { if (!analyser) return; analyser.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) * (v - 128); const lvl = Math.min(1, Math.sqrt(s / buf.length) / 40); opts.onLevel && opts.onLevel(lvl); meterRaf = requestAnimationFrame(tick); };
      tick();
      if (record && window.MediaRecorder) { chunks = []; recorder = new MediaRecorder(stream); recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); }; recorder.start(); }
    } catch (e) { /* no meter: recognition may still work */ }
  }
  /* start({ expected: [words], onHeard(words), onLevel(0..1), onError(code), record }) */
  function start(o) {
    stop();
    opts = o || {}; heard = []; finalWords = []; restarts = 0; lastErr = null; active = true; startedAt = performance.now();
    if (!SRC) { opts.onError && opts.onError('unsupported'); active = false; return false; }
    try { rec = makeRec(); rec.start(); } catch (e) { opts.onError && opts.onError('start'); active = false; return false; }
    startMeter(!!opts.record);
    return true;
  }
  /* stop and hand back what happened; the recording arrives as a promise */
  function stop() {
    const was = active; active = false;
    try { rec && rec.stop(); } catch (e) { /* fine */ }
    rec = null;
    cancelAnimationFrame(meterRaf); analyser = null;
    let blobP = Promise.resolve(null);
    if (recorder) { const r = recorder; recorder = null; blobP = new Promise((res) => { r.onstop = () => res(chunks.length ? new Blob(chunks, { type: r.mimeType || 'audio/webm' }) : null); try { r.stop(); } catch (e) { res(null); } }); }
    const s = stream; stream = null;
    blobP.then(() => { if (s) s.getTracks().forEach(t => t.stop()); });
    return { was, heard: heard.slice(), seconds: (performance.now() - startedAt) / 1000, blob: blobP, error: lastErr };
  }
  return { supported, start, stop, active: () => active, heard: () => heard.slice() };
})();
