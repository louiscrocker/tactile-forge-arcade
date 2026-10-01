/* ============================================================
   studio.js — the Voice Studio, for grown-ups
   ============================================================
   Every line a friend can say, and the narrator's hints and
   facts, listed by speaker.  Tap ● to record your own voice for
   that line (tap again to stop), ▶ to hear it, 🗑 to remove it.
   Recorded lines play instead of the robot voice.  Export saves
   every recording to one file; Import loads it on another
   device (e.g. record on the computer, play on the tablet).
   ============================================================ */
'use strict';

const Studio = (function () {
  const $ = (id) => document.getElementById(id);
  let G = null, speaker = 'bramble', stream = null, rec = null, recKey = null, chunks = [];

  function lines(sp) {
    const simple = G.settings.reading === 'simple';
    const out = [];
    const add = (s, text) => { if (s === sp && text && !out.includes(text)) out.push(text); };
    for (const q of QUESTS) {
      for (const l of q.intro || []) add(q.giver, l);
      for (const l of q.done || []) add(q.giver, l);
      for (const ph of q.phases) {
        if (ph.kind === 'talk') for (const l of ph.lines) add(ph.who, l);
        add('narrator', ph.text[simple ? 1 : 0]);
        if (ph.kind === 'invite') for (const w of ph.who) add(w, 'A party? At the castle? I\'ll be there!');
      }
    }
    for (const k of Object.keys(CHATTER)) for (const ls of CHATTER[k]) for (const l of ls) add(k, l);
    add('bramble', 'Let\'s count them together!');
    add('hoot', simple ? 'Hoo! Let\'s make a word! Catch the letters in order.' : 'Hoo-hoo! A letter hunt! Catch the letter bubbles in order to spell a word.');
    add('hoot', simple ? 'The next letter glows. Fly to it!' : 'The letter you need next glows gold.');
    for (const k of Object.keys(HINTS)) add('narrator', HINTS[k][simple ? 1 : 0]);
    for (const k of Object.keys(FACTS)) { const f = FACTS[k]; add('narrator', `${f.title}. ${simple ? f.simple : f.body}`); }
    return out;
  }
  const speakers = () => ['bramble', 'hoot', 'hazel', 'fern', 'lily', 'pearl', 'cloudia', 'ember', 'marina', 'narrator'];
  const nameOf = (k) => k === 'narrator' ? 'Storyteller' : FRIENDS[k].name;
  const kindOf = (k) => k === 'narrator' ? 'book' : FRIENDS[k].kind;

  function init(game) {
    G = game;
    $('studioClose').addEventListener('click', close);
    $('studioExport').addEventListener('click', async () => {
      const data = await VoiceBank.exportAll();
      const blob = new Blob([JSON.stringify({ app: 'alicorn-skies', voices: data })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'alicorn-voices.json'; a.click();
    });
    $('studioImport').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const o = JSON.parse(await f.text()); const n = await VoiceBank.importAll(o.voices || o); $('studioNote').textContent = `Loaded ${n} recordings.`; build(); }
      catch (err) { $('studioNote').textContent = 'That file did not work.'; }
      e.target.value = '';
    });
  }
  function open(game) { G = game || G; build(); $('studio').hidden = false; }
  function close() { stop(); $('studio').hidden = true; if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  function isOpen() { return !$('studio').hidden; }

  function build() {
    const tabs = $('studioTabs'); tabs.innerHTML = '';
    for (const k of speakers()) {
      const all = lines(k), done = all.filter(l => VoiceBank.has(VoiceBank.key(k, l))).length;
      const b = document.createElement('button'); b.className = 'studio-tab' + (k === speaker ? ' on' : '');
      b.appendChild(Sprites.iconEl(kindOf(k) === 'lamb' ? 'lamb' : kindOf(k), G.player ? G.player.look : DEFAULT_LOOK, 36));
      const s = document.createElement('span'); s.textContent = `${nameOf(k)} ${done}/${all.length}`; b.appendChild(s);
      b.addEventListener('click', () => { speaker = k; build(); });
      tabs.appendChild(b);
    }
    const list = $('studioList'); list.innerHTML = '';
    for (const text of lines(speaker)) {
      const key = VoiceBank.key(speaker, text);
      const row = document.createElement('div'); row.className = 'studio-row' + (VoiceBank.has(key) ? ' has' : '');
      const p = document.createElement('p'); p.textContent = text; row.appendChild(p);
      const r = document.createElement('button'); r.className = 'rec' + (recKey === key ? ' on' : ''); r.textContent = recKey === key ? '■ Stop' : '● Record';
      r.addEventListener('click', () => { if (recKey === key) stop(); else record(key); });
      row.appendChild(r);
      const pl = document.createElement('button'); pl.textContent = '▶'; pl.title = 'Play';
      pl.addEventListener('click', () => Voice.say(text, { speaker, force: true, interrupt: true }));
      row.appendChild(pl);
      if (VoiceBank.has(key)) { const d = document.createElement('button'); d.textContent = '🗑'; d.title = 'Delete'; d.addEventListener('click', async () => { await VoiceBank.del(key); build(); }); row.appendChild(d); }
      list.appendChild(row);
    }
    $('studioCount').textContent = `${VoiceBank.count()} recorded`;
  }

  async function record(key) {
    stop();
    try {
      if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) { $('studioNote').textContent = 'The microphone is not available. Check the browser\'s permission for this page.'; return; }
    chunks = [];
    rec = new MediaRecorder(stream);
    recKey = key;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      const k = recKey; recKey = null;
      if (chunks.length) { await VoiceBank.put(k, new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); $('studioNote').textContent = 'Saved! Tap ▶ to hear it.'; }
      build();
    };
    rec.start();
    AudioFX.duck && AudioFX.duck(true);
    setTimeout(() => { if (recKey === key) stop(); }, 20000);
    $('studioNote').textContent = 'Recording… tap ■ Stop when you finish the line.';
    build();
  }
  function stop() { if (rec && rec.state === 'recording') rec.stop(); AudioFX.duck && AudioFX.duck(false); }

  return { init, open, close, isOpen, lines };
})();
