/* ============================================================
   safari.js — photo safari
   ============================================================
   Fourteen photo challenges.  When a photo is taken, each
   challenge looks for its subject on screen and scores it:
     ★    in the picture
     ★★   near the middle
     ★★★  near the middle AND close up (zoomed in)
   The best photo of each challenge goes on the photo wall.
   ============================================================ */
'use strict';

const SAFARI = [
  { key: 'emerge', name: 'A dragonfly coming out', simple: 'Dragonfly coming out', find: (G) => G.nymphs.list.filter(n => n.state === 'emerge').map(n => [n.x, n.y]) },
  { key: 'strike', name: 'The heron stabbing', simple: 'Heron stabbing', find: (G) => G.heron.state === 'strike' ? [[G.heron.x + G.heron.dir * 60, G.heron.y + 40]] : [] },
  { key: 'turtle', name: 'A turtle basking', simple: 'Turtle on the log', find: (G) => G.neighbours.turtle.state === 'bask' ? [[G.neighbours.turtle.x, G.neighbours.turtle.y]] : [] },
  { key: 'singer', name: 'A frog singing', simple: 'Frog singing', find: (G) => [...G.chorus.frogs.filter(f => f.throat > .4).map(f => [f.x, f.y]), ...G.players.filter(p => p.throat > .4).map(p => [p.x, p.y])] },
  { key: 'tongue', name: 'A tongue catching a bug', simple: 'Tongue snap', find: (G) => G.players.filter(p => p.tongue.active).map(p => [p.x + p.dir * 30, p.y]) },
  { key: 'raccoon', name: 'The raccoon at night', simple: 'Raccoon', find: (G) => G.hazards.raccoon.state !== 'away' ? [[G.hazards.raccoon.x, G.hazards.raccoon.y]] : [] },
  { key: 'snake', name: 'The garter snake', simple: 'Snake', find: (G) => G.hazards.snake.state !== 'hidden' ? [[G.hazards.snake.x, G.hazards.snake.y]] : [] },
  { key: 'fish', name: 'The big fish', simple: 'Big fish', find: (G) => G.hazards.fish.state !== 'away' ? [[G.hazards.fish.x, G.hazards.fish.y]] : [] },
  { key: 'mayfly', name: 'The mayfly swarm', simple: 'Mayflies', find: (G) => G.bugs.list.filter(b => b.kind === 'mayfly').map(b => [b.x, b.y]) },
  { key: 'lily', name: 'A water lily flower', simple: 'Lily flower', find: (G) => G.pond.pads.filter(p => p.bloom > .6).map(p => [p.x, p.y]) },
  { key: 'rainbow', name: 'A rainbow over the pond', simple: 'Rainbow', find: (G) => G.pond.weather.rainbow > .4 ? [[G.cam.x, G.cam.y]] : [] },
  { key: 'ice', name: 'The frozen pond', simple: 'Ice', find: (G) => G.pond.weather.ice > .5 ? [[G.cam.x, 0]] : [] },
  { key: 'tadpoles', name: 'A crowd of tadpoles', simple: 'Tadpole crowd', find: (G) => G.neighbours.tadpoles.length >= 5 ? G.neighbours.tadpoles.map(t => [t.x, t.y]) : [] },
  { key: 'ladybug', name: 'A ladybug visitor', simple: 'Ladybug visitor', find: (G) => G.events && G.events.ladybug ? [[G.events.ladybug.x, G.events.ladybug.y]] : [] }
];

const Safari = (function () {
  const $ = (id) => document.getElementById(id);
  let wall = {};
  const load = () => { try { wall = JSON.parse(localStorage.getItem(pkey('safari')) || '{}'); } catch (e) { wall = {}; } };
  const save = () => { try { localStorage.setItem(pkey('safari'), JSON.stringify(wall)); } catch (e) { for (const k in wall) if (wall[k].thumb) { delete wall[k].thumb; break; } try { localStorage.setItem(pkey('safari'), JSON.stringify(wall)); } catch (e2) { /* give up */ } } };
  load();

  /* score what is on screen right now */
  function evaluate(G) {
    const cam = G.cam, out = [];
    for (const ch of SAFARI) {
      let pts = []; try { pts = ch.find(G) || []; } catch (e) { pts = []; }
      let best = 0;
      for (const [x, y] of pts) {
        const [sx, sy] = cam.toScreen(x, y);
        if (sx < 0 || sx > cam.w || sy < 90 || sy > cam.h) continue;
        const dx = Math.abs(sx - cam.w / 2) / (cam.w / 2), dy = Math.abs(sy - cam.h / 2) / (cam.h / 2);
        let s = 1;
        if (dx < .5 && dy < .5) s = 2;
        if (dx < .3 && dy < .35 && cam.zoom > 1.15) s = 3;
        best = Math.max(best, s);
      }
      if (best) out.push({ key: ch.key, stars: best });
    }
    return out.sort((a, b) => b.stars - a.stars);
  }
  /* file a photo: returns the best new result, if any */
  function file(results, thumb) {
    let improved = null;
    for (const r of results) {
      const had = wall[r.key];
      if (!had || r.stars > had.stars) { wall[r.key] = { stars: r.stars, thumb, when: Date.now() }; if (!improved || r.stars > improved.stars) improved = r; }
    }
    if (improved) { save(); Bus.emit('safari', improved, count()); }
    return improved;
  }
  function count() { return Object.keys(wall).length; }
  function stars() { return Object.values(wall).reduce((n, w) => n + w.stars, 0); }
  function open(G) {
    const grid = $('safariGrid'); if (!grid) return;
    grid.innerHTML = '';
    for (const ch of SAFARI) {
      const w = wall[ch.key];
      const card = document.createElement('div'); card.className = 'scard' + (w ? '' : ' locked');
      const img = document.createElement('div'); img.className = 'sthumb';
      if (w && w.thumb) img.style.backgroundImage = `url(${w.thumb})`; else img.textContent = w ? '📷' : '?';
      card.appendChild(img);
      const lab = document.createElement('b'); lab.textContent = G.settings.reading === 'simple' ? ch.simple : ch.name; card.appendChild(lab);
      const st = document.createElement('span'); st.className = 'stars'; st.textContent = w ? '★'.repeat(w.stars) + '☆'.repeat(3 - w.stars) : '☆☆☆'; card.appendChild(st);
      card.addEventListener('click', () => Voice.say(w ? `${ch.name}. ${w.stars} star${w.stars > 1 ? 's' : ''}.` : `Still to find: ${ch.name}.`, { interrupt: true, force: true }));
      grid.appendChild(card);
    }
    $('safariCount').textContent = `${count()} / ${SAFARI.length} · ${stars()} ★`;
    $('safari').hidden = false;
  }
  return { evaluate, file, open, count, stars, wall: () => wall };
})();
