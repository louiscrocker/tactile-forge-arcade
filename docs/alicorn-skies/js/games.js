/* ============================================================
   games.js — little learning games the friends play with you
   ============================================================
   Bramble's apple basket: "Can you bring me 5 apples?"  You
   shake apples down from the apple trees with magic, then bring
   them back and Bramble counts them out loud, one at a time.

   Professor Hoot's letter hunt: floating letter bubbles spell a
   word.  Catch the letters in order — the next one glows — and
   each letter says its sound.  At the end the word is blended
   and read aloud.

   A friend with a game to play shows a star (★) bubble.
   ============================================================ */
'use strict';

/* simple sounds for each letter, for reading aloud */
const LETTER_SOUNDS = { A: 'ah', B: 'buh', C: 'kuh', D: 'duh', E: 'eh', F: 'fff', G: 'guh', H: 'huh', I: 'ih', J: 'juh', K: 'kuh', L: 'lll', M: 'mmm', N: 'nnn', O: 'oh', P: 'puh', Q: 'kwuh', R: 'rrr', S: 'sss', T: 'tuh', U: 'uh', V: 'vvv', W: 'wuh', X: 'ks', Y: 'yuh', Z: 'zzz' };
const WORDS_EASY = ['SUN', 'CAT', 'HOP', 'BUG', 'PIG', 'HAT', 'DOG', 'FUN', 'MUD', 'RED', 'BED', 'FOX', 'HEN', 'CUP', 'LOG', 'MAP'];
const WORDS_MORE = ['STAR', 'MOON', 'FROG', 'FISH', 'SHIP', 'SNOW', 'CAKE', 'RAIN', 'TREE', 'PINK', 'WING', 'HORN', 'LAMB', 'SWAN', 'GLOW', 'CLOUD'];
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

const Games = (function () {
  let G = null;
  const S = { apple: null, letters: null, applesDone: 0, wordsDone: 0, wordsSeen: [], appleCd: 0, letterCd: 0 };
  const simple = () => G.settings.reading === 'simple';
  const storyBusy = () => { const q = Quests.current(); return q && Quests.status() === 'active' && q.key !== 'party' ? false : false; };

  function init(game) { G = game; }

  /* ★ bubbles: only once the friend's story quest is done, and never on top of a quest bubble */
  function bubble(key) {
    if (!G || !Quests.isDone('hello')) return null;
    if (key === 'bramble' && Quests.isDone('foal') && S.appleCd <= 0) return S.apple && G.apples >= S.apple.n ? '★' : S.apple ? null : '★';
    if (key === 'hoot' && Quests.isDone('fallen') && S.letterCd <= 0 && !S.letters) return '★';
    return null;
  }

  function talk(friend, player) {
    if (friend.key === 'bramble' && Quests.isDone('foal')) {
      if (S.apple) {
        if (G.apples >= S.apple.n) { countApples(friend, player); return true; }
        Dialog.open(friend, [simple() ? `I need ${S.apple.n} apples. You have ${G.apples}.` : `I still need ${S.apple.n} apples. You have ${G.apples} so far. Shake the apple trees with magic!`], { player });
        return true;
      }
      if (S.appleCd > 0) return false;
      const n = G.settings.difficulty === 'easy' ? rndInt(2, 5) : G.settings.difficulty === 'hard' ? rndInt(6, 10) : rndInt(3, 7);
      S.apple = { n };
      Dialog.open(friend, [simple() ? `Can you bring me ${n} apples? ${'🍎'.repeat(n)}` : `I'm making apple pie! Can you bring me ${n} apples? ${'🍎'.repeat(n)}`, simple() ? 'Use magic on the apple trees by the stable!' : 'Shake the apple trees by the stable with your magic, then pick the apples up.'], { player, onDone: () => { Bus.emit('gameStart', 'apple'); if (G.apples >= n) Dialog.open(friend, ['Oh! You already have enough! Let\'s count them!'], { player, onDone: () => countApples(friend, player) }); } });
      return true;
    }
    if (friend.key === 'hoot' && Quests.isDone('fallen') && !S.letters && S.letterCd <= 0) {
      startLetters(friend, player);
      return true;
    }
    return false;
  }

  /* Bramble counts the apples out loud, one by one */
  function countApples(friend, player) {
    const n = S.apple.n;
    G.apples -= n;
    const lines = [simple() ? 'Let\'s count them together!' : 'Let\'s count them together!'];
    Dialog.open(friend, lines, { player, onDone: () => {
      for (let i = 1; i <= n; i++) setTimeout(() => {
        G.particles.text(friend.x - 40 + i * 12, friend.y - 70 - i * 6, String(i), '#ffd24a', 30);
        G.particles.spawn({ type: 'dot', x: player.x, y: player.y - 40, vx: (friend.x - player.x) * 1.5, vy: -200, g: 400, r: 6, col: '#e8403a', life: .7 });
        Voice.say(NUMBER_WORDS[i] || String(i), { interrupt: true, force: true, rate: 1 });
        AudioFX.star(i);
      }, 400 + i * 800);
      setTimeout(() => {
        const reward = n;
        G.stars += reward; S.applesDone++; S.apple = null; S.appleCd = 60;
        Dialog.open(friend, [simple() ? `${n} apples! Thank you! Here are ${reward} stars!` : `That's ${NUMBER_WORDS[n] || n} apples! Perfect for my pie. Here are ${reward} stars!`], { player });
        G.particles.confetti(friend.x, friend.y - 40, 50);
        Bus.emit('gameDone', 'apple', n);
      }, 400 + (n + 1) * 800);
    } });
  }

  /* Hoot's letter hunt */
  function pickWord() {
    const pool = (simple() ? WORDS_EASY : WORDS_EASY.concat(WORDS_MORE)).filter(w => !S.wordsSeen.includes(w));
    const extra = [];
    if (G.player && G.player.look.name && G.player.look.name.length <= 7 && !S.wordsSeen.includes(G.player.look.name.toUpperCase())) extra.push(G.player.look.name.toUpperCase().replace(/[^A-Z]/g, ''));
    if (G.foal && G.foal.adopted && G.foal.name.length <= 7) extra.push(G.foal.name.toUpperCase().replace(/[^A-Z]/g, ''));
    const all = pool.concat(S.wordsDone >= 2 ? extra : []).filter(w => w.length >= 2);
    return all.length ? pick(all) : pick(WORDS_EASY);
  }
  function startLetters(friend, player) {
    const word = pickWord();
    Dialog.open(friend, [simple() ? `Hoo! Let's make a word! Catch the letters in order.` : `Hoo-hoo! A letter hunt! Catch the letter bubbles in order to spell a word.`, simple() ? 'The next letter glows. Fly to it!' : 'The letter you need next glows gold.'], { player, onDone: () => spawnLetters(word, player) });
  }
  function spawnLetters(word, player) {
    const W = G.world;
    const n = word.length;
    const letters = word.split('').map((ch, i) => {
      const a = Math.PI * (1.1 + i / Math.max(1, n - 1) * .8) + rnd(-.1, .1);
      const rad = rnd(260, 420);
      let x = player.x + Math.cos(a) * rad * (i % 2 ? 1 : -1) * .9 + (i - n / 2) * 60;
      x = clamp(x, W.bounds.left + 200, W.bounds.right - 200);
      const y = Math.min(W.standY(x) - 90, player.y - 60 - Math.abs(Math.sin(a)) * rad * .6 - rnd(0, 80));
      return { ch, x, y, got: false, ph: rnd(TAU) };
    });
    S.letters = { word, letters, next: 0 };
    Bus.emit('gameStart', 'letters', word);
    say(`${letters[0].ch}`);
  }
  function say(ch) { Voice.say(`${ch}. ${LETTER_SOUNDS[ch] || ''}`, { interrupt: true, force: true, rate: .85 }); }

  function update(dt) {
    if (!G) return;
    S.appleCd = Math.max(0, S.appleCd - dt); S.letterCd = Math.max(0, S.letterCd - dt);
    const L = S.letters;
    if (!L) return;
    for (const b of L.letters) { b.ph += dt; }
    const b = L.letters[L.next];
    for (const p of G.players) {
      if (!b) break;
      if (dist(p.x, p.y - 34, b.x, b.y + Math.sin(b.ph * 2) * 6) < 60) {
        b.got = true; L.next++;
        G.particles.starBurst(b.x, b.y, 12, '#ffe14a', 180);
        AudioFX.ring(L.next);
        Bus.emit('letter', p, b.ch);
        if (L.next >= L.letters.length) {
          const w = L.word;
          const spelled = w.split('').join(' - ');
          Voice.say(`${spelled}. ${w.toLowerCase()}!`, { interrupt: true, force: true, rate: .8 });
          if (typeof UI !== 'undefined') UI.hint(`${w.split('').join('-')} spells ${w}! ⭐`);
          G.particles.confetti(p.x, p.y - 60, 60);
          G.stars += 5; S.wordsDone++; S.wordsSeen.push(w); S.letters = null; S.letterCd = 40;
          Bus.emit('gameDone', 'letters', w);
        } else setTimeout(() => say(L.letters[L.next] ? L.letters[L.next].ch : ''), 350);
        break;
      }
    }
  }

  function draw(ctx, time, view) {
    const L = S.letters;
    if (!L) return;
    L.letters.forEach((b, i) => {
      if (b.got) return;
      ctx.save(); ctx.translate(b.x, b.y + Math.sin(b.ph * 2) * 6);
      Sprites.drawLetterBubble(ctx, b.ch, 26, time, i === L.next, false);
      ctx.restore();
    });
    /* the word so far, above the player */
    const p = G.player;
    const shown = L.word.split('').map((c, i) => i < L.next ? c : '_').join(' ');
    Render.label(shown, p.x, p.y - 130, 26, '#fff29a');
  }

  /* what the quest card shows while a game is on */
  function card() {
    if (S.letters) { const L = S.letters; return { title: simple() ? 'Letter hunt' : 'Hoot\'s letter hunt', icon: 'letters', text: simple() ? `Catch the letter ${L.letters[L.next].ch}!` : `Spell the word: catch ${L.letters[L.next].ch} next.`, prog: `${L.next} / ${L.letters.length}`, count: L.next, goal: L.letters.length }; }
    if (S.apple) return { title: simple() ? 'Apples for Bramble' : 'Bramble\'s apple basket', icon: 'basket', text: G.apples >= S.apple.n ? (simple() ? 'Take the apples to Bramble!' : 'You have enough! Take them to Bramble.') : (simple() ? `Get ${S.apple.n} apples. Magic on the apple trees!` : `Collect ${S.apple.n} apples. Shake the apple trees with magic.`), prog: `${Math.min(G.apples, S.apple.n)} / ${S.apple.n}`, count: Math.min(G.apples, S.apple.n), goal: S.apple.n };
    return null;
  }
  function target() {
    if (S.letters) { const b = S.letters.letters[S.letters.next]; return b && { x: b.x, y: b.y, label: 'letter ' + b.ch }; }
    if (S.apple) { if (G.apples >= S.apple.n) { const f = G.friends.get('bramble'); return { x: f.x, y: f.y - 30, label: 'Bramble' }; } const a = G.world.apples.find(a => a.state === 'ground') || G.world.apples.find(a => a.state === 'hang'); return a && { x: a.x, y: a.y, label: 'apples' }; }
    return null;
  }

  function serialize() { return { applesDone: S.applesDone, wordsDone: S.wordsDone, wordsSeen: S.wordsSeen.slice(), apple: S.apple }; }
  function restore(o) { if (o) { S.applesDone = o.applesDone || 0; S.wordsDone = o.wordsDone || 0; S.wordsSeen = o.wordsSeen || []; S.apple = o.apple || null; } }
  return { init, bubble, talk, update, draw, card, target, serialize, restore, state: S };
})();
