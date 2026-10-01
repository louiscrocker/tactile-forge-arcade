/* ============================================================
   scenarios.js — real storms, and the damage survey quiz
   ============================================================ */
'use strict';

/*
   Four tornadoes worth knowing about. Widths are the official path
   widths of the damaging circulation, which is wider than the visible
   condensation funnel — in several of these the funnel was rain-wrapped
   and effectively invisible from the ground.

   `peak` is the peak wind in mph. The app solves backwards from it for
   the rotation speed, because the wind a building feels also includes
   inflow and the storm's own forward motion.
*/
const REAL_STORMS = [
  {
    id: 'elreno',
    name: 'El Reno',
    place: 'Oklahoma',
    date: '31 May 2013',
    peak: 302, widthM: 4184, fwd: 25, base: 1050, subs: 4,
    rating: 'EF3',
    stats: [
      ['Width', '2.6 miles — the widest ever measured'],
      ['Winds', 'over 300 mph by mobile radar'],
      ['Rating', 'EF3']
    ],
    note: 'The best lesson in this whole app. Radar measured winds above 300 mph, ' +
          'yet it is officially rated EF3 — because it spent most of its life over ' +
          'open farmland and never hit enough well-built structures to prove it. ' +
          'Ratings come from damage, not from wind gauges. It killed eight people, ' +
          'including three storm chasers.'
  },
  {
    id: 'moore',
    name: 'Moore',
    place: 'Oklahoma',
    date: '20 May 2013',
    peak: 210, widthM: 2092, fwd: 13, base: 780, subs: 1,
    rating: 'EF5',
    stats: [
      ['Width', '1.3 miles'],
      ['Path', '14 miles'],
      ['Rating', 'EF5 · 24 killed']
    ],
    note: 'Ground into a suburb at its strongest, including two elementary schools. ' +
          'Whole neighbourhoods were swept to their foundations — the damage ' +
          'indicator that earns an EF5.'
  },
  {
    id: 'joplin',
    name: 'Joplin',
    place: 'Missouri',
    date: '22 May 2011',
    peak: 200, widthM: 1600, fwd: 12, base: 700, subs: 3,
    rating: 'EF5',
    stats: [
      ['Width', 'about 1 mile'],
      ['Rating', 'EF5 · 158 killed'],
      ['Note', 'deadliest since 1950']
    ],
    note: 'Multiple vortices inside one enormous rain-wrapped circulation, which is ' +
          'why damage varied so sharply from house to house. The deadliest single ' +
          'US tornado since modern record-keeping began.'
  },
  {
    id: 'tristate',
    name: 'Tri-State',
    place: 'MO · IL · IN',
    date: '18 March 1925',
    peak: 260, widthM: 1600, fwd: 28, base: 760, subs: 2,
    rating: 'F5',
    stats: [
      ['Path', '219 miles — the longest'],
      ['Duration', '3.5 hours on the ground'],
      ['Rating', 'F5 · 695 killed']
    ],
    note: 'It ran for three and a half hours at around 60 mph — faster than a car ' +
          'on a country road, so there was almost no warning. Still the deadliest ' +
          'tornado in United States history.'
  }
];

/* ============================================================
   Damage survey quiz
   ============================================================
   Hides the storm, walks up to one damaged building and asks for a
   rating. This is the whole point of the app in one interaction:
   surveyors read wreckage, not wind gauges.
   ============================================================ */
const Quiz = {
  active: false,
  target: null,
  answered: false,
  score: 0,
  asked: 0,
  wasPlaying: true,
  prevCam: 'chase',

  /* What a surveyor would call each damage state, and why. */
  verdict(p) {
    if (p.kind === 'tree') {
      return { ef: 2, what: 'Large healthy trees snapped partway up the trunk.',
               why: 'Snapping hardwoods takes something like 110 mph. Trees are a useful ' +
                    'indicator in open country where there are no buildings to read.' };
    }
    if (p.kind === 'pole') {
      return { ef: 1, what: 'Power poles leaning or broken.',
               why: 'Poles go over in fairly modest winds, so on their own they only ' +
                    'support a low rating.' };
    }
    if (p.kind === 'silo' || p.kind === 'waterTower' || p.kind === 'driveIn') {
      return { ef: 3, what: 'A large steel or metal structure collapsed.',
               why: 'Buckling a grain silo or dropping a water tower needs well over ' +
                    '135 mph.' };
    }
    switch (p.stage) {
      case 1: return { ef: 1, what: 'Shingles and gutters stripped, roof deck still on.',
                       why: 'Loss of surface covering only. This is the classic EF0–EF1 ' +
                            'boundary; the structure itself is intact.' };
      case 2: return { ef: 2, what: 'Roof deck removed, exterior walls still standing.',
                       why: 'Losing the roof structure while the walls hold is the textbook ' +
                            'EF2 indicator for a family home.' };
      case 3: return { ef: 3, what: 'Exterior walls collapsed, structure still on its foundation.',
                       why: 'Once the walls go but the building has not been swept away, ' +
                            'surveyors are looking at EF3.' };
      case 4: return { ef: 5, what: 'Swept clean off the foundation. Only the slab is left.',
                       why: 'A well-built home removed entirely, with debris granulated and ' +
                            'carried away, is the single strongest EF5 indicator there is.' };
      default: return { ef: 0, what: 'Minor damage.', why: 'Branches and gutters only.' };
    }
  },

  candidates(sim) {
    const out = [];
    for (const p of sim.props) {
      if (p.temp || p.dyn) continue;
      if (p.structure && p.stage > 0) out.push(p);
      else if (p.kind === 'tree' && p.stage >= 2) out.push(p);
    }
    return out;
  },

  start(sim, app) {
    const list = this.candidates(sim);
    if (list.length < 1) return false;
    this.active = true;
    this.score = 0;
    this.asked = 0;
    this.wasPlaying = app.playing;
    this.prevCam = app.camMode;
    Render.surveyMode = true;
    app.playing = false;
    document.body.classList.add('quizzing');
    this.next(sim, app);
    return true;
  },

  next(sim, app) {
    const list = this.candidates(sim);
    if (!list.length) { this.finish(sim, app); return; }

    // Prefer something we have not just shown, and favour heavier damage
    // so the quiz spans the whole scale rather than only peeled shingles.
    list.sort((a, b) => (b.stage || 0) - (a.stage || 0));
    const pool = list.slice(0, Math.max(3, Math.ceil(list.length * 0.7)));
    let pick = pool[(Math.random() * pool.length) | 0];
    if (pick === this.target && pool.length > 1) {
      pick = pool[(Math.random() * pool.length) | 0];
    }
    this.target = pick;
    this.answered = false;
    this.asked++;

    // Stand the camera in the street outside it.
    const r = Math.max(9, pick.mesh ? pick.mesh.r : 9);
    Camera.target.x = pick.x;
    Camera.target.z = pick.z;
    Camera.target.y = r * 0.45;
    Camera.dist = r * 3.4 + 16;
    Camera.pitch = 0.16;
    Camera.yaw = rnd(0, TAU);
    app.camMode = 'quiz';

    this.render(sim, app);
  },

  answer(ef, sim, app) {
    if (this.answered) return;
    this.answered = true;
    const v = this.verdict(this.target);
    if (ef === v.ef) this.score++;
    this.render(sim, app, ef, v);
  },

  finish(sim, app) {
    this.active = false;
    this.target = null;
    Render.surveyMode = false;
    document.body.classList.remove('quizzing');
    document.getElementById('quizCard').hidden = true;
    app.playing = this.wasPlaying;
    app.setCam(this.prevCam, true);
  },

  render(sim, app, given, v) {
    const card = document.getElementById('quizCard');
    card.hidden = false;
    const body = document.getElementById('quizBody');

    if (!this.answered) {
      body.innerHTML =
        '<p class="q-lead">You are the damage surveyor. Walk around it — ' +
        'what rating would you give this one?</p>' +
        '<div class="q-opts">' +
        [0, 1, 2, 3, 4, 5].map(i => '<button data-ef="' + i + '">EF' + i + '</button>').join('') +
        '</div>' +
        '<p class="q-hint">Look at what is left standing, not at how big the mess is.</p>';
      body.querySelectorAll('.q-opts button').forEach(b =>
        b.addEventListener('click', () => this.answer(+b.dataset.ef, sim, app)));
    } else {
      const right = given === v.ef;
      body.innerHTML =
        '<div class="q-result ' + (right ? 'ok' : 'no') + '">' +
        (right ? 'Correct — ' : 'You said EF' + given + ' · surveyors would say ') +
        '<b>EF' + v.ef + '</b></div>' +
        '<p class="q-what">' + v.what + '</p>' +
        '<p class="q-why">' + v.why + '</p>' +
        '<div class="q-foot"><span>Score ' + this.score + ' / ' + this.asked + '</span>' +
        '<button id="qNext">Next building</button>' +
        '<button id="qDone" class="ghost">Finish</button></div>';
      document.getElementById('qNext').addEventListener('click', () => this.next(sim, app));
      document.getElementById('qDone').addEventListener('click', () => this.finish(sim, app));
    }
  }
};
