/* ============================================================
   quests.js — the story: ten little quests for the friends,
               and the talk box they are told through
   ============================================================
   A quest is offered by a friend (they get a "!" bubble), starts
   when you talk to them, has one or more phases (talk to someone,
   count an event, or reach a place), and pays a reward.  Nothing
   in here touches the DOM: the UI listens on the Bus.
   ============================================================ */
'use strict';

/* ---------- the talk box ---------- */
const Dialog = {
  active: null,
  open(who, lines, opts = {}) {
    this.active = { who, lines: lines.slice(), i: 0, onDone: opts.onDone, player: opts.player, quest: opts.quest };
    Bus.emit('dialog', this.active);
    return this.active;
  },
  next() {
    const a = this.active; if (!a) return;
    a.i++;
    if (a.i >= a.lines.length) this.close(); else Bus.emit('dialogLine', a);
  },
  append(lines, onDone) { const a = this.active; if (!a) return; a.lines.push(...lines); if (onDone) { const prev = a.onDone; a.onDone = () => { if (prev) prev(); onDone(); }; } },
  close() { const a = this.active; this.active = null; Bus.emit('dialogEnd', a); if (a && a.onDone) a.onDone(); },
  get line() { return this.active ? this.active.lines[this.active.i] : ''; },
  get open_() { return !!this.active; }
};

/* ---------- small talk when there is no quest to give ---------- */
const CHATTER = {
  bramble: [['Hop hop! What a lovely day!'], ['I can hop higher than a sunflower. Nearly.'], ['The castle is your home now. Isn\'t it pretty?']],
  hazel: [['Sneaky, sneaky. The woods are full of secrets.'], ['At night the fireflies come out. Come and see!'], ['I know every path in these woods.']],
  hoot: [['Hoo. Every star is a faraway sun, you know.'], ['I can turn my head almost all the way round. Hoo-hoo.'], ['The Moon is up there. You could land on it, you know.']],
  fern: [['Oh! You made me jump. Hello.'], ['My spots help me hide in the sunny patches.'], ['I like the bluebells best.']],
  lily: [['Ribbit! Frogs drink through their skin!'], ['Come to the lake at night. We frogs sing!'], ['Did you walk on the water? Show-off!']],
  pearl: [['Swans stay with their friends for their whole lives.'], ['My babies ride on my back when they are tired.'], ['Do you like my long neck? I do.']],
  cloudia: [['A cloud is made of tiny, tiny drops of water.'], ['Baaa. It is so soft and quiet up here.'], ['Puff loves it when you visit.']],
  puff: [['Baaa!'], ['Baa baa!']],
  ember: [['*hic* Flying is the BEST.'], ['My tail flame keeps me warm at night.'], ['I am a very small dragon. But I am very brave now.']],
  marina: [['Blub blub! Hello, alicorn!'], ['Fish breathe with their gills. I just like to sing.'], ['The jellyfish are my friends. They are so squishy!']]
};
const CHATTER_FACT = { marina: 'jellyfish', hoot: 'owl', lily: 'frog', pearl: 'swan', cloudia: 'clouds', hazel: 'fireflies', ember: 'dragonfly', bramble: 'gallop', fern: 'flowers' };

/* ---------- the quests ---------- */
const QUESTS = [
  {
    key: 'hello', title: 'Say hello to Bramble', simple: 'Find Bramble the bunny', icon: 'bunny', giver: 'bramble',
    intro: ['Hello! Are you a real alicorn?! You have a horn AND wings!', 'I\'m Bramble. Welcome to Flower Meadow!', 'Let\'s be friends. Come and see me any time!'],
    phases: [], reward: { stars: 5 }
  },
  {
    key: 'flowers', title: 'Wake the sleepy flowers', simple: 'Wake 5 flowers', icon: 'flower', giver: 'bramble',
    intro: ['Oh no. The flowers by the castle are still asleep!', 'Your horn can wake them up. Walk close and press E for magic.', 'Please wake up 5 sleepy flowers!'],
    phases: [{ kind: 'count', event: 'flowerBloomed', goal: 5, text: ['Wake 5 sleepy flowers with horn magic (E).', 'Wake 5 flowers. Press E near them!'] }],
    reward: { stars: 5, accessory: 'garland' },
    done: ['The flowers are awake! Look how happy they are.', 'I made you a flower garland. Put it on in the wardrobe!']
  },
  {
    key: 'fly', title: 'Learn to fly', simple: 'Fly through 3 rings', icon: 'ring', giver: 'bramble',
    intro: ['Now, can you REALLY fly? Show me!', 'Hold SPACE to flap your wings. Let go to glide.', 'Fly through the 3 rainbow rings above the meadow!'],
    phases: [{ kind: 'count', event: 'ringPassed', set: 'learn', goal: 3, text: ['Fly through the 3 rainbow rings.', 'Fly through the 3 rings!'] }],
    reward: { stars: 10 },
    done: ['WOW! You can really fly!', 'Everyone in the land will want to meet you. Follow the big arrow!']
  },
  {
    key: 'foal', title: 'A baby alicorn!', simple: 'Find the baby alicorn', icon: 'foal', giver: 'bramble',
    intro: ['Have you heard? Someone saw a BABY alicorn in the Whispering Woods!', 'She is lost, and very shy. Walk slowly, and use gentle horn magic near her so she trusts you.', 'Then bring her home. There is a stable waiting for her, next to the castle.'],
    phases: [
      { kind: 'count', event: 'foalFound', goal: 1, text: ['Find the baby alicorn in the Whispering Woods. Use gentle magic (E) near her three times.', 'Find the baby in the Woods. Press E near her 3 times!'] },
      { kind: 'reach', target: 'stable', range: 180, text: ['Walk the baby home to the stable by the castle. She can\'t fly yet!', 'Walk her home to the stable! No flying yet.'] }
    ],
    reward: { stars: 10 },
    done: ['She loves her new home! And she loves YOU.', 'Visit her every day. Give her apples, brush her and play. She will grow up big and strong!']
  },
  {
    key: 'lamb', title: 'The lost lamb', simple: 'Find Puff the lamb', icon: 'lamb', giver: 'cloudia',
    intro: ['Baaa! An alicorn, up here in the Cloud Kingdom!', 'I\'m Cloudia. My little lamb Puff bounced off the clouds and fell down to the meadow.', 'Please find him and bring him home. He is very small and very fluffy.'],
    phases: [
      { kind: 'count', event: 'lambFound', goal: 1, text: ['Find Puff the lamb in the Flower Meadow. Listen for his baa!', 'Find Puff the lamb in the Meadow.'] },
      { kind: 'talk', who: 'cloudia', text: ['Fly Puff back up to Cloudia on the Cloud Castle.', 'Fly Puff up to Cloudia.'], lines: ['Puff! My little Puff! Thank you, thank you!', 'You are the kindest alicorn in the whole sky.'] }
    ],
    reward: { stars: 15 },
    done: ['Have some stars. Cloud sheep collect them, you know.']
  },
  {
    key: 'fallen', title: 'The fallen stars', simple: 'Lift 5 fallen stars', icon: 'stars3', giver: 'hoot',
    intro: ['Hoo-hoo! Who flies into my woods? An alicorn!', 'Last night five little stars fell out of the sky. They are lost on the forest floor.', 'Find them and lift them back up with your magic.'],
    phases: [{ kind: 'count', event: 'starLifted', goal: 5, text: ['Find the 5 fallen stars in the Whispering Woods and lift them with magic (E).', 'Find 5 fallen stars in the Woods. Press E near them!'] }],
    reward: { stars: 10, accessory: 'starcrown' },
    done: ['The stars are home. The night sky says thank you.', 'Take this Star Crown. You earned it!']
  },
  {
    key: 'crystals', title: 'Lights for the lake party', simple: 'Light 6 crystals', icon: 'crystal', giver: 'lily',
    intro: ['Ribbit! Hi! I\'m Lily. We frogs are having a party tonight!', 'But the lake crystals are all dark. Could you light them with your magic?', 'They sit on the rocks in the lake. You can walk on the water, you know!'],
    phases: [{ kind: 'count', event: 'crystalLit', goal: 6, text: ['Light the 6 crystals on the lake rocks with magic (E).', 'Light 6 lake crystals. Press E near them!'] }],
    reward: { stars: 10, horn: 'crystal' },
    done: ['Look at them glow! Best party EVER!', 'Your horn can be a crystal horn now. Try it in the wardrobe!']
  },
  {
    key: 'mermaid', title: 'The mermaid\'s pearls', simple: 'Find 5 pearls', icon: 'mermaid', giver: 'lily',
    intro: ['Ribbit! Did you know a mermaid lives at the bottom of the lake? Her name is Marina.', 'She lost her five pearls! They are hiding inside shells on the lake floor.', 'Stand on the water and hold DOWN to dive. Use magic to open the shells!'],
    phases: [
      { kind: 'count', event: 'pearl', goal: 5, text: ['Dive into Crystal Lake (hold DOWN on the water). Open the shells with magic and collect 5 pearls.', 'Dive in the lake (hold DOWN). Open shells with E. Get 5 pearls!'] },
      { kind: 'talk', who: 'marina', text: ['Swim down to Marina\'s grotto and give her the pearls.', 'Give the pearls to Marina!'], lines: ['My pearls! All five! Thank you, thank you!', 'Here, a seashell tiara, just for you. You look like a sea princess!'] }
    ],
    reward: { stars: 15, accessory: 'shelltiara' }
  },
  {
    key: 'ember', title: 'Teach Ember to fly', simple: 'Fly 8 rings with Ember', icon: 'dragon', giver: 'ember',
    intro: ['*hic* Oh! *hic* Hello. I\'m Ember. I\'m a dragon. A small one.', 'I have the hiccups because I\'m scared. I have never flown before!', 'If you fly through the rings, I will follow you. Please show me how!'],
    phases: [{ kind: 'count', event: 'ringPassed', set: 'ember', goal: 8, text: ['Fly through the 8 rings up Rainbow Mountain. Ember will follow you.', 'Fly through the 8 rings. Ember will follow!'] }],
    reward: { stars: 15 },
    done: ['I\'m FLYING! I\'m really flying! My hiccups are gone!', 'Can I come with you? I\'ll follow you everywhere!']
  },
  {
    key: 'race', title: 'Race Ember!', simple: 'Race Ember', icon: 'trophy', giver: 'ember',
    intro: ['Now that I can fly... *hic*... let\'s RACE!', 'Meet me at the rainbow arch in the meadow. Walk under it to start.', 'Fly through all the rings, one after another. Ready, set...'],
    phases: [{ kind: 'count', event: 'raceDone', goal: 1, text: ['Go to the rainbow arch in the meadow and walk under it to race Ember.', 'Go under the rainbow arch to race!'] }],
    reward: { stars: 15, accessory: 'medal' },
    done: ['What a race! You are SO fast!', 'Here is a gold medal. We can race again any time. Just go under the arch!']
  },
  {
    key: 'rainbow', title: 'Bring back the rainbow', simple: 'Find the 7 rainbow gems', icon: 'rainbow', giver: 'pearl',
    intro: ['Good day. I am Pearl.', 'Have you seen the great rainbow over the mountain? It has gone grey and sad.', 'Its seven colours are hidden as gems all over the land. Find them all and carry them to the mountain top.'],
    phases: [
      { kind: 'count', event: 'gem', goal: 7, text: ['Find the 7 rainbow gems.', 'Find the 7 gems!'] },
      { kind: 'reach', target: 'summit', range: 130, text: ['Carry the 7 gems to the very top of Rainbow Mountain.', 'Fly to the top of the Mountain!'] }
    ],
    reward: { stars: 20, mane: 'rainbow', horn: 'rainbow' },
    done: ['The rainbow is back! You can see it from everywhere.', 'Now your mane can be a rainbow too. Look in the wardrobe!']
  },
  {
    key: 'moon', title: 'The Unicorn in the stars', simple: 'Touch the 5 stars', icon: 'constellation', giver: 'hoot',
    intro: ['Hoo! Look up. Way, WAY up. The Unicorn constellation has gone dim.', 'Fly up to the Star Sky, higher than the clouds, and touch its 5 stars in order.', 'The next star always twinkles. Follow the twinkle!'],
    phases: [{ kind: 'count', event: 'constStar', goal: 5, text: ['Fly up to the Star Sky and touch the Unicorn\'s 5 stars in order.', 'Fly way up and touch the 5 twinkling stars in order!'] }],
    reward: { stars: 15, accessory: 'necklace', wings: 'glitter' },
    done: ['The Unicorn shines again! Hoo-hoo-hooray!', 'This moon necklace is for you. And your wings can sparkle now!']
  },
  {
    key: 'party', title: 'The big party', simple: 'Invite 5 friends', icon: 'party', giver: 'bramble',
    intro: ['Everyone is talking about you! We want to throw a party at the castle.', 'Please invite our friends: Hazel, Fern, Lily, Pearl and Cloudia.', 'Then come back to me and we will start the party!'],
    phases: [
      { kind: 'invite', who: ['hazel', 'fern', 'lily', 'pearl', 'cloudia'], goal: 5, text: ['Invite Hazel, Fern, Lily, Pearl and Cloudia to the party (talk to them).', 'Talk to Hazel, Fern, Lily, Pearl and Cloudia!'] },
      { kind: 'talk', who: 'bramble', text: ['Go back to Bramble at the castle to start the party!', 'Go back to Bramble!'], lines: ['Everyone is here! Let the party begin!'] }
    ],
    reward: { stars: 30, accessory: 'queencrown' },
    done: ['Three cheers for the Alicorn Princess!', 'The whole land is yours to explore. Come back and see us any time!']
  }
];

/* the order quests had before the foal, mermaid and race were added (old saves store an index into this) */
const QUEST_ORDER_V1 = ['hello', 'flowers', 'fly', 'lamb', 'fallen', 'crystals', 'ember', 'rainbow', 'moon', 'party'];

const Quests = (function () {
  let G = null, gateFn = null;
  const S = { idx: 0, status: 'offered', phase: 0, count: 0, invited: [], done: [] };
  /* the first quest in story order that hasn't been done */
  const nextIdx = () => { const i = QUESTS.findIndex(q => !S.done.includes(q.key)); return i < 0 ? QUESTS.length : i; };

  const current = () => QUESTS[S.idx] || null;
  const phase = () => { const q = current(); return q && S.status === 'active' ? q.phases[S.phase] : null; };
  const simple = () => G.settings.reading === 'simple';

  function init(game) {
    G = game;
    Bus.on('flowerBloomed', () => onCount('flowerBloomed'));
    Bus.on('ringPassed', (p, ring) => onCount('ringPassed', ring.set));
    Bus.on('lambFound', () => onCount('lambFound'));
    Bus.on('starLifted', () => onCount('starLifted'));
    Bus.on('crystalLit', () => onCount('crystalLit'));
    Bus.on('gem', () => onCount('gem'));
    Bus.on('constStar', () => onCount('constStar'));
    Bus.on('foalFound', () => onCount('foalFound'));
    Bus.on('pearl', () => onCount('pearl'));
    Bus.on('raceDone', () => onCount('raceDone'));
    offer();
  }

  /* make the current quest available: its giver gets a "!" */
  function offer() {
    const q = current();
    if (!q) { S.status = 'free'; Bus.emit('questsFree'); return; }
    S.status = 'offered'; S.phase = 0; S.count = 0; S.invited = [];
    Bus.emit('questOffered', q);
  }

  function start(q, player) {
    S.status = 'active'; S.phase = 0; S.count = 0; S.invited = [];
    const W = G.world;
    switch (q.key) {
      case 'flowers': {
        const b = G.friends.get('bramble');
        const near = W.flowers.filter(f => Math.abs(f.x - b.homeX) < 700).sort((a, c) => Math.abs(a.x - b.homeX) - Math.abs(c.x - b.homeX)).slice(0, 10);
        for (const f of near) { f.sleepy = true; f.bloom = 0; }
        break;
      }
      case 'fly': W.spawnRings('learn'); break;
      case 'lamb': G.friends.spawnLamb(); break;
      case 'fallen': W.showFallen(true); break;
      case 'ember': W.spawnRings('ember'); G.friends.emberFollow(player); break;
      case 'rainbow': W.showGems(true); break;
      case 'foal': G.foal.appearLost(); break;
      case 'mermaid': W.showShells(true); break;
    }
    Bus.emit('questStart', q);
    if (!q.phases.length) complete(player);
  }

  function onCount(event, set) {
    const q = current(), ph = phase();
    if (!ph || ph.kind !== 'count' || ph.event !== event) return;
    if (ph.set && ph.set !== set) return;
    S.count++;
    Bus.emit('questProgress', q, S.count, ph.goal);
    if (S.count >= ph.goal) nextPhase();
  }
  function nextPhase(player) {
    const q = current();
    const finished = q.phases[S.phase];
    if (q.key === 'lamb' && S.phase === 1) G.friends.lambHome();
    if (q.key === 'fly' && S.phase === 0) G.world.clearRings('learn');
    if (q.key === 'ember' && S.phase === 0) G.world.clearRings('ember');
    if (q.key === 'rainbow' && S.phase === 1) { G.world.rainbowTarget = true; Bus.emit('rainbowRestored'); }
    S.phase++; S.count = 0;
    if (S.phase >= q.phases.length) complete(player || G.player);
    else Bus.emit('questPhase', q, S.phase);
    void finished;
  }

  /* checked every frame: 'reach' phases and free-play bookkeeping */
  function update(dt, players) {
    const ph = phase();
    if (ph && ph.kind === 'reach') {
      const t = target();
      for (const p of players) if (t && dist(p.x, p.y, t.x, t.y) < ph.range) { nextPhase(p); break; }
    }
  }

  function complete(player) {
    const q = current();
    S.status = 'done'; S.done.push(q.key);
    const look = (player || G.player).look;
    const r = q.reward || {};
    if (r.stars) { G.stars += r.stars; Bus.emit('starsGiven', r.stars); }
    look.owned = look.owned || []; look.unlocked = look.unlocked || [];
    if (r.accessory && !look.owned.includes(r.accessory)) look.owned.push(r.accessory);
    if (r.mane) look.unlocked.push('mane:' + r.mane);
    if (r.horn) look.unlocked.push('horn:' + r.horn);
    if (r.wings) look.unlocked.push('wings:' + r.wings);
    if (q.key === 'party') { G.friends.gatherForParty(); Bus.emit('party'); }
    if (q.key === 'foal') { if (!G.foal.adopted) G.foal.adopt(); Bus.emit('foalNaming', G.foal); }
    if (r.accessory === 'medal') { /* worn straight away: a medal should be shown off */ const l = (player || G.player).look; l.wear = (l.wear || []).filter(k => { const a = ACCESSORIES.find(x => x.key === k); return !a || a.slot !== 'neck'; }); l.wear.push('medal'); }
    Bus.emit('questDone', q, r);
    const giver = G.friends.get(q.giver);
    /* Read to Play may hold the next quest until a page is read (nothing else changes) */
    const finish = () => { const go = () => { S.idx = nextIdx(); offer(); }; if (gateFn) gateFn(q, go); else go(); };
    if (q.done && q.done.length) {
      if (Dialog.active && Dialog.active.who === giver) Dialog.append(q.done, finish);
      else Dialog.open(giver, q.done, { onDone: finish, player, quest: q });
    } else finish();
  }

  /* what a friend says when a player talks to them */
  function talkTo(friend, player) {
    const q = current();
    friend.talkCd = 8;
    Bus.emit('talk', friend, player);
    /* 1. the offered quest's giver */
    if (q && S.status === 'offered' && q.giver === friend.key) {
      Dialog.open(friend, q.intro, { player, quest: q, onDone: () => start(q, player) });
      return;
    }
    const ph = phase();
    /* 2. a turn-in */
    if (ph && ph.kind === 'talk' && ph.who === friend.key) {
      Dialog.open(friend, ph.lines, { player, quest: q, onDone: () => nextPhase(player) });
      return;
    }
    /* 3. an invitation */
    if (ph && ph.kind === 'invite' && ph.who.includes(friend.key) && !S.invited.includes(friend.key)) {
      S.invited.push(friend.key); S.count = S.invited.length;
      Dialog.open(friend, ['A party? At the castle? I\'ll be there!'], { player, onDone: () => { Bus.emit('questProgress', q, S.count, ph.goal); if (S.count >= ph.goal) nextPhase(player); } });
      return;
    }
    /* 4. a reminder from the giver */
    if (q && S.status === 'active' && q.giver === friend.key && ph) {
      Dialog.open(friend, [ph.text[simple() ? 1 : 0]], { player });
      return;
    }
    /* 5. games (counting, letters) */
    if (typeof Games !== 'undefined' && Games.talk(friend, player)) return;
    /* 6. small talk */
    const lines = pick(CHATTER[friend.key] || [['Hello!']]);
    Dialog.open(friend, lines, { player, onDone: () => { const f = CHATTER_FACT[friend.key]; if (f) Bus.emit('fact', f); } });
  }

  /* where the big arrow points */
  function target() {
    if (typeof Race !== 'undefined' && Race.active()) return Race.target();
    if (typeof Games !== 'undefined') { const gt = Games.target(); if (gt) return gt; }
    const q = current(); if (!q) return null;
    const W = G.world;
    if (S.status === 'offered') { const f = G.friends.get(q.giver); return { x: f.x, y: f.y - 30, label: f.def.name, kind: 'friend' }; }
    const ph = phase(); if (!ph) return null;
    const near = (list, fx) => { const p = G.player; let best = null, bd = 1e12; for (const o of list) { const d = dist(fx(o)[0], fx(o)[1], p.x, p.y); if (d < bd) { bd = d; best = o; } } return best; };
    switch (q.key) {
      case 'flowers': { const f = near(W.flowers.filter(f => f.sleepy), f => [f.x, f.y]); return f && { x: f.x, y: f.y - 20, label: 'a sleepy flower' }; }
      case 'fly': case 'ember': { const r = W.rings.filter(r => !r.passed).sort((a, b) => a.i - b.i)[0]; return r && { x: r.x, y: r.y, label: 'the next ring' }; }
      case 'lamb': { if (S.phase === 0) { const f = G.friends.get('puff'); return { x: f.x, y: f.y - 20, label: 'Puff' }; } const c = G.friends.get('cloudia'); return { x: c.x, y: c.y - 30, label: 'Cloudia' }; }
      case 'fallen': { const f = near(W.fallen.filter(f => f.state === 'down'), f => [f.x, f.y]); return f && { x: f.x, y: f.y, label: 'a fallen star' }; }
      case 'crystals': { const c = near(W.crystals.filter(c => c.quest && !c.litTarget), c => [c.x, c.y]); return c && { x: c.x, y: c.y - 30, label: 'a dark crystal' }; }
      case 'rainbow': { if (S.phase === 0) { const g = W.gems.find(g => !g.taken); return g && { x: g.x, y: g.y, label: 'the ' + g.name + ' gem ' + g.where[simple() ? 1 : 0], hint: g.where[simple() ? 1 : 0] }; } return { x: W.summit.x + 40, y: W.summit.y - 60, label: 'the mountain top' }; }
      case 'moon': { const p = W.constellation.pts[W.constellation.lit]; return p && { x: p.x, y: p.y, label: 'the next star' }; }
      case 'foal': { if (S.phase === 0) return { x: G.foal.x, y: G.foal.y - 40, label: simple() ? 'the baby' : 'the baby alicorn' }; return { x: W.stable.x, y: W.stable.y - 80, label: simple() ? 'the stable' : 'the stable' }; }
      case 'mermaid': { if (S.phase === 0) { const s = near(W.shells.filter(s => s.state === 'closed' || s.state === 'open'), s => [s.x, s.y]); return s && { x: s.x, y: s.y - 20, label: s.state === 'open' ? 'a pearl' : 'a shell' }; } const m = G.friends.get('marina'); return { x: m.x, y: m.y - 40, label: 'Marina' }; }
      case 'race': { if (typeof Race !== 'undefined' && Race.active()) return Race.target(); return { x: W.raceArch.x, y: W.raceArch.y - 60, label: simple() ? 'the arch' : 'the rainbow arch' }; }
      case 'party': { if (S.phase === 0) { const k = ph.who.find(k => !S.invited.includes(k)); const f = G.friends.get(k); return f && { x: f.x, y: f.y - 30, label: f.def.name }; } const b = G.friends.get('bramble'); return { x: b.x, y: b.y - 30, label: 'Bramble' }; }
    }
    return null;
  }

  function bubble(friendKey) {
    const b = questBubble(friendKey);
    if (b) return b;
    return typeof Games !== 'undefined' ? Games.bubble(friendKey) : null;
  }
  function questBubble(friendKey) {
    const q = current(); if (!q) return null;
    if (S.status === 'offered' && q.giver === friendKey) return '!';
    const ph = phase();
    if (ph && ph.kind === 'talk' && ph.who === friendKey) return '?';
    if (ph && ph.kind === 'invite' && ph.who.includes(friendKey) && !S.invited.includes(friendKey)) return '?';
    return null;
  }

  /* the quest card: title, icon, objective text, progress */
  function card() {
    if (typeof Race !== 'undefined' && Race.active()) return { title: 'Race!', icon: 'trophy', text: simple() ? 'Fly through the rings in order!' : 'Fly through every ring in order. The next one sparkles!', prog: '' };
    if (typeof Games !== 'undefined') { const gc = Games.card(); if (gc) return gc; }
    const q = current();
    if (!q) return { title: simple() ? 'Explore!' : 'Free play', icon: 'map', text: HINTS.free[simple() ? 1 : 0], prog: '', done: true };
    if (S.status === 'offered') { const f = FRIENDS[q.giver]; const where = ZONES.find(z => z.key === f.zone) || SKY_ZONES[1]; return { title: simple() ? q.simple : q.title, icon: q.icon, text: simple() ? `Go and talk to ${f.name} in ${where.simple || where.name}.` : `Talk to ${f.name} in ${where.name}.`, prog: '', offered: true, giver: f }; }
    const ph = phase();
    if (!ph) return { title: simple() ? q.simple : q.title, icon: q.icon, text: '', prog: '' };
    let text = ph.text[simple() ? 1 : 0];
    if (q.key === 'rainbow' && S.phase === 0) { const g = G.world.gems.find(g => !g.taken); if (g) text = (simple() ? `Find the ${g.name} gem ` : `Find the ${g.name} gem `) + g.where[simple() ? 1 : 0] + '.'; }
    const prog = ph.goal ? `${S.count} / ${ph.goal}` : '';
    return { title: simple() ? q.simple : q.title, icon: q.icon, text, prog, count: S.count, goal: ph.goal || 0 };
  }

  function serialize() { const q = current(); return { key: q ? q.key : null, idx: S.idx, status: S.status, phase: S.phase, count: S.count, invited: S.invited.slice(), done: S.done.slice(), v: 2 }; }
  function restore(o) {
    if (!o) return;
    S.done = (o.done || []).slice(); S.phase = o.phase || 0; S.count = o.count || 0; S.invited = o.invited || [];
    /* which quest was current: saved by key (v2) or by index into the old order (v1) */
    const key = o.v === 2 ? o.key : QUEST_ORDER_V1[o.idx || 0];
    const status = o.status || 'offered';
    if (status === 'active' && key && !S.done.includes(key)) { S.idx = QUESTS.findIndex(q => q.key === key); S.status = 'active'; }
    else { S.idx = nextIdx(); S.status = 'offered'; S.phase = 0; S.count = 0; S.invited = []; }
    if (S.idx < 0 || S.idx >= QUESTS.length) { S.idx = QUESTS.length; S.status = 'free'; }
    else if (S.status === 'offered') Bus.emit('questOffered', QUESTS[S.idx]);
    const q = current();
    if (q && S.status === 'active') {
      const W = G.world;
      if (q.key === 'fly' && S.phase === 0 && !W.rings.length) W.spawnRings('learn');
      if (q.key === 'ember' && S.phase === 0) { if (!W.rings.length) W.spawnRings('ember'); G.friends.emberFollow(G.player); }
      if (q.key === 'lamb' && S.phase === 0 && G.friends.get('puff').hidden) G.friends.spawnLamb();
      if (q.key === 'fallen') W.showFallen(true);
      if (q.key === 'rainbow') W.showGems(true);
      if (q.key === 'flowers' && !W.flowers.some(f => f.sleepy) && S.count < 5) start(q, G.player);
      if (q.key === 'foal' && S.phase === 0 && G.foal.state === 'hidden') G.foal.appearLost();
      if (q.key === 'mermaid' && S.phase === 0) W.showShells(true);
    }
    if (!q) S.status = 'free';
    Bus.emit('questRestored');
  }
  function isDone(key) { return S.done.includes(key); }
  function status() { return S.status; }
  function reset() { S.idx = 0; S.status = 'offered'; S.phase = 0; S.count = 0; S.invited = []; S.done = []; offer(); }

  function setGate(fn) { gateFn = fn; }

  return { init, update, talkTo, target, bubble, card, current, phase, serialize, restore, isDone, status, reset, nextIdx, setGate, state: S };
})();
