/* ============================================================
   director.js — turns the level's events into sound, sparkle,
   screen shake, big words and short spoken hints.  Each kind of
   hint is said once per level, so nobody is nagged.
   ============================================================ */
'use strict';

const Director = {
  once: new Set(),
  reset() { this.once.clear(); },
  first(k) { if (this.once.has(k)) return false; this.once.add(k); return true; },
  say(G, text, k) { if (k && !this.first(k)) return; UI.hint(text); if (G.settings.voice) Voice.say(text, { interrupt: false }); },
  shake(G, v) { if (G.settings.shake) G.cam.shake = Math.min(1.2, Math.max(G.cam.shake, v)); },
  handle(G, L, e, attract) {
    const P = G.particles, A = attract ? { play() {} } : AudioFX;
    switch (e.type) {
      case 'punch': A.play(e.hit ? 'punch' : 'whiff'); if (e.hit) { P.ring(e.x, e.y, '#fff3c0', 30); this.shake(G, .18); } break;
      case 'break': {
        A.play(e.mat === 'window' ? 'glass' : e.mat === 'bell' ? 'clang' : 'break');
        P.dust(e.x, e.y, 4, e.mat === 'stone' ? '#d8d2c4' : '#d8b8a0'); P.sparkle(e.x, e.y, 3, '#ffe9b0');
        if (e.combo >= 2) { P.word('x' + e.combo + '!', e.x, e.y - 30, ['#ffd23a', '#ff9a3a', '#ff6a8a', '#a070e0', '#5ac0f0'][Math.min(4, e.combo - 2)], 24 + e.combo * 3, 'combo'); A.play('combo', e.combo); }
        if (e.combo === 5 && !attract) this.say(G, 'Wow, a five combo! Keep smashing!', 'combo5');
        if (e.mat === 'bell' && !attract) this.say(G, 'BONG! The old bell rings goodbye.', 'bell');
        this.shake(G, .14); break;
      }
      case 'crack': A.play('crack'); P.dust(e.x, e.y, 2, '#c8b8a8', .6); break;
      case 'stomp': A.play('stomp'); P.dust(e.x, e.y, 8, '#d8c8b0', 1.3); P.ring(e.x, e.y, '#ffffff', 60); this.shake(G, e.hit ? .5 : .25); if (e.hit) P.word('STOMP!', e.x, e.y - 90, '#ffd23a', 30); break;
      case 'crumble': {
        const big = e.n >= 8;
        A.play('crumble', Math.min(1, e.n / 30)); P.dust(e.x, e.y, Math.min(40, 6 + e.n), '#d8c8b0', 1 + Math.min(1.5, e.w * .12));
        this.shake(G, Math.min(1.1, .25 + e.n * .025 + e.drop * .05));
        if (big || e.drop >= 2) P.word(e.n > 30 ? 'MEGA CRUMBLE!' : 'CRUMBLE!', e.x, e.y - 120, '#ff9a3a', big ? 40 : 30);
        if (e.drop >= 3 && !attract) this.say(G, 'What a crumble! Big drops make lots of dust, so be careful near the neighbours.', 'bigdrop');
        break;
      }
      case 'critter': A.play(e.kind === 'cat' ? 'meow' : 'coo'); P.sparkle(e.x, e.y, 10, '#ffffff'); if (!attract) this.say(G, e.kind === 'cat' ? 'The sleepy cat hops out to find a sunny wall. Bye, cat!' : 'The pigeon flies off to a new home. Bye, pigeon!', 'critter' + e.kind); break;
      case 'jump': A.play('jump', e.who === 'pip' ? 1.4 : .8); break;
      case 'land': A.play('land', Math.min(1, e.v / 900)); if (e.v > 500) P.dust(e.x, e.y, e.who === 'mungo' ? 5 : 2, '#d8c8b0', e.who === 'mungo' ? 1 : .5); if (e.who === 'mungo' && e.v > 700) this.shake(G, .2); break;
      case 'grab': A.play('grab'); break;
      case 'mantle': A.play('jump', .9); break;
      case 'mess': if (!attract) this.say(G, 'Oops! Dust in the neighbour\'s garden. Smashing from the top keeps it tidy.', 'mess'); break;
      case 'ballPunch': A.play('punch'); A.play('ballswing'); P.word('WHAM!', e.x, e.y - 50, '#ff6a8a', 40); P.ring(e.x, e.y, '#ffffff', 70); this.shake(G, .6); if (!attract) this.say(G, 'Wham! Back it goes at the old building!', 'ballpunch'); break;
      case 'ballHit': this.shake(G, .4); P.dust(e.x, e.y, 6, '#d8c8b0', 1.2); break;
      case 'fence': A.play('fence'); P.word('Boing!', e.x, e.y - 40, '#ffffff', 26); if (!attract) this.say(G, 'Oh! It bumped the neighbour\'s fence. Punch the ball when it swings at you!', 'fence'); break;
      case 'bonk': A.play('bonk'); P.word(pick(['Bonk!', 'Wobble!', 'Oof!', 'Boing!']), e.x, e.y - 20, '#ffffff', 26); this.shake(G, .25); if (!attract) this.say(G, e.who === 'pip' ? 'Bonk! Just a wobble. Hold down to lift your bucket and catch things.' : 'Oof! Just a wobble. Off you go again!', 'bonk' + e.who); break;
      case 'boing': A.play('boing'); break;
      case 'fixTap': A.play(e.tool === 'glue' ? 'glue' : 'spanner'); P.sparkle(e.x, e.y, 5, '#fff3a0'); break;
      case 'fixed': {
        A.play('fixed'); P.sparkle(e.x, e.y, 18, '#fff3a0'); P.word(pick(['Fixed!', 'Good as new!', 'Mended!', 'All better!']), e.x, e.y - 30, '#5ad06a', 28);
        if (!attract && e.left > 0) this.say(G, e.left === 1 ? 'Just one more to fix!' : `Lovely! ${e.left} more to fix.`, 'left' + e.left);
        break;
      }
      case 'nofix': if (!attract) this.say(G, 'Walk right up to something that sparkles, then press fix.', 'nofix'); break;
      case 'rebreak': A.play('rebreak'); P.dust(e.x, e.y, 3, '#ffffff', .6); if (!attract) this.say(G, e.why === 'rubble' ? 'A bit of rubble cracked it again! Pip can fix it.' : 'Oh no, it cracked again! Catch things in the bucket to stop that.', 'rebreak' + (e.why === 'rubble' ? 'r' : '')); break;
      case 'catch': A.play('catch'); P.sparkle(e.x, e.y, 8, '#ffffff'); P.word('Caught!', e.x, e.y - 24, '#5ac0f0', 22); if (!attract) this.say(G, 'Great catch!', 'catch'); break;
      case 'thingLand': A.play('plop'); P.dust(e.x, e.y, 2, '#c8c0b0', .5); break;
      case 'gust': A.play('gust'); if (!attract) this.say(G, 'Whoosh! A gust of wind. Hold on to a drainpipe!', 'gust'); break;
      case 'lightning': Render.flash = 1; A.play('thunder'); break;
      case 'finale': A.play('crumble', 1); P.word('Here it comes!', (L.bx + L.bw / 2) * CELL, GROUND_Y - L.bh * CELL - 40, '#ffd23a', 34); this.shake(G, .5); break;
      case 'smashDone': if (L.kind === 'coop' && !L.mendDone && !attract) this.say(G, 'The old building is down! Now help Pip finish the house.', 'smashdone'); break;
      case 'mendDone': if (L.kind === 'coop' && !L.smashDone && !attract) this.say(G, 'The house is all fixed! Now help Mungo finish smashing.', 'menddone'); break;
      case 'done': A.play('fanfare'); for (const a of L.players) P.confetti(a.x, a.y - 120, 50); if (!attract) Voice.say(L.kind === 'smash' ? 'Hooray! The old building is gone!' : L.kind === 'mend' ? 'Hooray! The house is all fixed!' : 'Hooray! Team job done!', { interrupt: true }); break;
    }
  }
};
