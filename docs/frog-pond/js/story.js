/* ============================================================
   story.js — story chapters with karaoke reading
   ============================================================
   Each big moment of the life opens a page of the story.  The
   page is read aloud and each word lights up as it is spoken,
   so the child can follow along and learn to read the words.
   Word timing comes from the speech engine's boundary events;
   if the engine gives none (or Dad recorded the page), the
   words advance on an estimated clock instead.
   ============================================================ */
'use strict';

const CHAPTERS = [
  { key: 'egg', trigger: 'start', title: 'The Egg', pic: 'egg',
    simple: 'I am a tiny black dot. I live in a ball of jelly. The jelly keeps me safe and warm. Soon I will wiggle out!',
    full: 'I am a tiny black dot inside a bubble of jelly, stuck to a weed in the warm shallows with hundreds of my brothers and sisters. The sun warms us. I grow a tail. Soon I will wriggle free.' },
  { key: 'bottom', trigger: 'nymphWarn', title: 'The Bottom of the Pond', pic: 'nymph',
    simple: 'Something moved on the mud. It has big eyes and a jaw that shoots out! I must be quick. Zoom!',
    full: 'Down on the mud something is watching me. It has six legs, big eyes, and a jaw that shoots out like a spring. It is a dragonfly nymph, and it wants to eat me. I flick my tail and zoom away.' },
  { key: 'legs', trigger: 'legs', title: 'Legs', pic: 'legs',
    simple: 'Look! I have two little legs! They grew by my tail. Now I can kick.',
    full: 'Something tickles at the root of my tail. Two little bumps grow and grow, until one day they are legs, with toes and webs between them. I can kick now, as well as wiggle.' },
  { key: 'air', trigger: 'arms', title: 'Air', pic: 'tail',
    simple: 'Pop! My front legs came out. Now I need air. I swim up to the top and gulp. My tail gets small.',
    full: 'Pop, pop! My front legs push out of my skin. Inside, my gills are closing and my lungs are opening. I swim up to the bright surface and gulp my first breath of air. My tail is shrinking, a little every day.' },
  { key: 'out', trigger: 'froglet', title: 'Out of the Water', pic: 'froglet',
    simple: 'My tail is gone! I am a froglet. I climb onto a lily pad. The air is warm. I see bugs!',
    full: 'My tail is gone, soaked back into my body. I climb out onto a lily pad and feel the warm air on my wet skin for the first time. Something buzzes past. My tongue flicks out. Snap!' },
  { key: 'song', trigger: 'frog', title: 'The Song', pic: 'frog',
    simple: 'I am a big frog now. At night I puff up my throat and sing. The other frogs sing back!',
    full: 'I am grown. When the sun goes down I puff up my throat like a balloon and sing my song across the water. From the reeds, from the log, from the far bank, the other frogs answer me.' },
  { key: 'eggs', trigger: 'eggsLaid', title: 'Eggs of My Own', pic: 'egg',
    simple: 'I laid my eggs in the jelly. Tiny black dots. Soon they will be tadpoles, like I was.',
    full: 'In the warm shallows I leave a clump of jelly full of tiny black dots. Each one is a new beginning. Soon the pond will be full of tadpoles, just like I was.' },
  { key: 'ice', trigger: 'hibernate', title: 'Under the Ice', pic: 'frog',
    simple: 'It is cold. Ice is on top of the pond. I sleep in the mud. Sleep, frog, sleep.',
    full: 'The days grow short and cold. A lid of ice closes over the pond. I settle into the soft mud and slow down, down, down, until my heart barely beats. I will sleep until spring.' },
  { key: 'spring', trigger: 'wake', title: 'Spring Again', pic: 'frog',
    simple: 'The ice is gone! The sun is back! I am awake and hungry. Hello, pond!',
    full: 'The ice cracks and melts. Warm light pours down through the water and I wake, stiff and very hungry. The peepers are already singing. Hello again, pond.' }
];

const Story = (function () {
  const $ = (id) => document.getElementById(id);
  let Gm, done = new Set(), cur = null, words = [], timer = 0, idx = -1, boundarySeen = false, clockOn = false, startAt = 0;
  const load = () => { try { done = new Set(JSON.parse(localStorage.getItem(pkey('story')) || '[]')); } catch (e) { done = new Set(); } };
  const save = () => { try { localStorage.setItem(pkey('story'), JSON.stringify([...done])); } catch (e) { /* fine */ } };

  function init(game) {
    Gm = game; load();
    for (const ch of CHAPTERS) if (ch.trigger !== 'start') Bus.on(ch.trigger, (p) => { if (p && p.id && p.id !== 1) return; if (!done.has(ch.key)) setTimeout(() => open(ch.key), ch.trigger === 'nymphWarn' ? 2200 : 3600); });
    if (!$('story')) return;
    $('storyClose').addEventListener('click', close);
    $('storyRead').addEventListener('click', () => read(true));
    $('storyBookBtn') && $('storyBookBtn').addEventListener('click', openBook);
  }
  function enabled() { return Gm.settings.stories !== false; }

  function open(key, forced) {
    /* in Read to Play the leveled pages take over; the four growth pages are gates, the rest are read here */
    if (!forced && typeof Reading !== 'undefined' && Reading.on()) {
      if (['legs', 'air', 'out', 'song'].includes(key) || !READ_CHAPTERS[key] || !Gm.started) return;
      if (UI.anyModalOpen() || Cinematic.active) { setTimeout(() => open(key), 1500); return; }
      done.add(key); save(); Reading.showPage(key); return;
    }
    const ch = CHAPTERS.find(c => c.key === key);
    if (!ch || !$('story')) return;
    if (!forced && (!enabled() || !Gm.started)) return;
    if (!forced && (UI.anyModalOpen() || (typeof Cinematic !== 'undefined' && Cinematic.active))) { setTimeout(() => open(key), 1500); return; }
    cur = ch; done.add(key); save(); Bus.emit('storyRead', key, done.size);
    const simple = Gm.settings.reading === 'simple';
    const text = simple ? ch.simple : ch.full;
    $('storyNum').textContent = `Chapter ${CHAPTERS.indexOf(ch) + 1}`;
    $('storyTitle').textContent = ch.title;
    const pic = $('storyPic'); pic.innerHTML = '';
    const c = Sprites.iconEl(ch.pic, Gm.speciesDef(), 120); c.style.width = c.style.height = '120px'; pic.appendChild(c);
    const box = $('storyText'); box.innerHTML = '';
    words = [];
    let pos = 0;
    for (const w of text.split(/(\s+)/)) {
      if (!w) continue;
      if (/^\s+$/.test(w)) { box.appendChild(document.createTextNode(' ')); pos += w.length; continue; }
      const span = document.createElement('span'); span.className = 'sw'; span.textContent = w;
      span.addEventListener('click', () => Voice.say(w.replace(/[^\w']/g, ''), { interrupt: true, force: true, rate: .8 }));
      box.appendChild(span);
      words.push({ el: span, start: pos, end: pos + w.length });
      pos += w.length;
    }
    $('story').hidden = false;
    AudioFX.season && AudioFX.season(true);
    setTimeout(() => read(false), 500);
  }
  function highlight(i) {
    if (i === idx) return;
    words.forEach((w, k) => { w.el.classList.toggle('now', k === i); w.el.classList.toggle('read', k < i); });
    idx = i;
  }
  /* read the page aloud with word highlighting */
  function read(force) {
    if (!cur) return;
    const simple = Gm.settings.reading === 'simple';
    const text = simple ? cur.simple : cur.full;
    idx = -1; highlight(-1); boundarySeen = false; clockOn = false;
    const key = 'story:' + cur.key;
    const clipPlaying = Voice.say(text, {
      interrupt: true, force: true, key, rate: simple ? .82 : .92,
      onboundary: (ci) => { boundarySeen = true; const i = words.findIndex(w => ci >= w.start && ci < w.end + 1); if (i >= 0) highlight(i); },
      onend: () => { highlight(words.length); }
    });
    /* no word events from the engine (or a recorded voice): run a clock instead */
    startAt = performance.now();
    const perWord = (simple ? .46 : .38) * 1000;
    cancelAnimationFrame(timer);
    const tick = () => {
      if ($('story').hidden) return;
      const t = performance.now() - startAt;
      if (!boundarySeen && (clipPlaying || t > 900 || !Voice.on || !Voice.supported)) { clockOn = true; highlight(Math.min(words.length, Math.floor(t / perWord))); }
      if (idx < words.length) timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }
  function close() { $('story').hidden = true; cancelAnimationFrame(timer); Voice.stop(); cur = null; }
  function openBook() {
    const list = $('storyList'); if (!list) return;
    list.innerHTML = '';
    CHAPTERS.forEach((ch, i) => {
      const b = document.createElement('button'); b.className = 'chip' + (done.has(ch.key) ? '' : ' locked');
      b.textContent = done.has(ch.key) ? `${i + 1}. ${ch.title}` : `${i + 1}. ?`;
      b.disabled = !done.has(ch.key);
      b.addEventListener('click', () => { $('storyBook').hidden = true; open(ch.key, true); });
      list.appendChild(b);
    });
    $('storyBook').hidden = false;
  }
  return { init, open, openBook, read, close, count: () => done.size, isOpen: () => !!$('story') && !$('story').hidden, chapters: CHAPTERS };
})();
