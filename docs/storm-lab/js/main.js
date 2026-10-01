/* ============================================================
   main.js — loop, cameras, input, interface
   ============================================================ */
'use strict';

const App = {
  sim: null,
  playing: true,
  timeScale: 1,
  camMode: 'chase',
  acc: 0,
  last: 0,
  fpsT: 0, fpsN: 0,
  hudT: 0,
  drag: null,
  lookH: 0.38,
  lastMoo: 0,
  siren: false,

  init() {
    // Before the town: Town.build places every prop on the terrain surface.
    Terrain.init(20260729);
    this.sim = new Simulation();
    Render.init(document.getElementById('scene'));
    Render.lightning = true;

    /* WebGL2 drives the scene when it is available; the software renderer
       in render.js stays as a working fallback rather than a dead end. */
    this.gl = GLScene.init(document.getElementById('glscene'));
    if (this.gl) {
      document.body.classList.add('gl');
      Overlay.init(document.getElementById('overlay'));
      Overlay.active = true;
      this.viewCanvas = GLScene.canvas;
    } else {
      console.warn('WebGL2 unavailable (' + GLScene.fail + ') — using the software renderer.');
      this.viewCanvas = Render.canvas;
    }

    Radar.init();
    this.applyQuality();
    this.hookEvents();
    this.bindUI();
    this.setCam('chase', true);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));

    setTimeout(() => document.getElementById('hint').classList.add('gone'), 7000);
  },

  /* Sound cues piggyback on the simulation's own event hooks. */
  hookEvents() {
    const sim = this.sim;
    const launch = sim.onLaunch.bind(sim);
    sim.onLaunch = (p, ws) => {
      launch(p, ws);
      if (p.kind === 'cow') {
        const now = performance.now();
        if (now - this.lastMoo > 260) { AudioFX.moo(); this.lastMoo = now; }
      }
    };
    const puff = sim.puff.bind(sim);
    sim.puff = (x, y, z, n) => {
      puff(x, y, z, n);
      if (n > 12) AudioFX.thud(n);
    };
  },

  /* ---------------------------------------------------------
     Cameras
     --------------------------------------------------------- */
  setCam(mode, hard) {
    this.camMode = mode;
    const t = this.sim.tor;
    document.querySelectorAll('#camPicker button').forEach(b =>
      b.classList.toggle('on', b.dataset.cam === mode));

    /* Distances scale with the cloud base so the whole funnel frames up
       whether it is a 30 m rope or a 300 m wedge. */
    const D = t.cloudBase;
    if (mode === 'chase') { Camera.dist = D * 2.35; Camera.pitch = 0.18; Camera.yaw = t.heading + Math.PI; this.lookH = 0.5; }
    if (mode === 'aerial') { Camera.dist = D * 3.2; Camera.pitch = 0.82; this.lookH = 0.22; }
    if (mode === 'orbit') { Camera.dist = D * 2.3; Camera.pitch = 0.22; this.lookH = 0.5; }
    // Keep the horizon on screen — craning up so far that the prairie
    // disappears loses all sense of scale.
    if (mode === 'ground') { Camera.dist = D * 1.3; this.lookH = 0.32; }
    if (mode === 'town') { this.lookH = 0.42; }
    if (mode === 'cellar') { this.lookH = 0.16; }
    // Far enough back that the tower, anvil and wall cloud all fit — the
    // classic chaser structure shot. Under the base you only see darkness.
    Render.cellar = (mode === 'cellar');
    if (hard) {
      Camera.target.x = t.x; Camera.target.z = t.z;
      Camera.target.y = t.cloudBase * this.lookH;
    }
  },

  /* Point the camera at a world position by solving for orbit angles. */
  placeAt(px, py, pz) {
    const T = Camera.target;
    const dx = px - T.x, dy = py - T.y, dz = pz - T.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    Camera.dist = d;
    Camera.yaw = Math.atan2(dx, dz);
    Camera.pitch = Math.asin(clamp(dy / d, -1, 1));
  },

  updateCamera(dt) {
    const t = this.sim.tor;
    const T = Camera.target;
    const wantY = t.cloudBase * this.lookH;
    const k = 1 - Math.pow(0.0016, dt);          // frame-rate independent smoothing

    if (this.camMode === 'quiz') return;         // the quiz parks the camera itself

    if (this.camMode === 'cellar') {
      // You are in a hole in the ground and you are staying there.
      T.x = lerp(T.x, t.x, k * 0.7);
      T.z = lerp(T.z, t.z, k * 0.7);
      T.y = lerp(T.y, Math.min(wantY, 120), k);
      this.placeAt(SHELTER.x, SHELTER.y, SHELTER.z);
      return;
    }

    if (this.camMode === 'town') {
      T.x = lerp(T.x, t.x * 0.35, k * 0.6);
      T.z = lerp(T.z, t.z * 0.35, k * 0.6);
      T.y = lerp(T.y, wantY * 0.8, k);
      this.placeAt(30, 34, 120);
      return;
    }

    T.x = lerp(T.x, t.x, k);
    T.z = lerp(T.z, t.z, k);
    T.y = lerp(T.y, wantY, k);

    if (this.camMode === 'chase') {
      // Drift back behind the storm without fighting the user's drag.
      let want = t.heading + Math.PI;
      let d = want - Camera.yaw;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      Camera.yaw += d * Math.min(1, dt * 0.35);
    }

    if (this.camMode === 'ground') {
      // Stand on the prairie and look up, rather than floating above and
      // looking down — which is what a positive pitch would give.
      const eye = 1.8;
      Camera.pitch = Math.asin(clamp((eye - T.y) / Camera.dist, -1, 1));
    }
  },

  /* ---------------------------------------------------------
     Main loop
     --------------------------------------------------------- */
  frame(now) {
    /* Clamped at both ends. The cap stops a long stall from teleporting the
       storm; the floor guards against a non-monotonic timestamp, which would
       otherwise run the clock backwards. */
    let raw = (now - this.last) / 1000;
    if (!(raw > 0)) raw = 0; else if (raw > 0.05) raw = 0.05;
    this.last = now;

    if (this.playing) {
      const scaled = raw * this.timeScale;
      this.acc += scaled;
      if (this.acc < 0) this.acc = 0;     // a negative accumulator would latch
      /* 60 Hz is ample: damage is integrated as exposure, and debris drag
         (k·dt of about 0.04) is nowhere near the stability limit. */
      const STEP = 1 / 60;
      let guard = 0;
      while (this.acc >= STEP && guard < 8) { this.sim.step(STEP); this.acc -= STEP; guard++; }
      if (guard >= 8) this.acc = 0;       // never let the sim spiral
      this.sim.stepVisual(scaled);        // once per frame, not per substep
    }

    this.updateCamera(raw);
    if (this.gl) {
      GLScene.draw(this.sim, raw);
      Overlay.draw(this.sim, raw);
    } else {
      Render.draw(this.sim, raw);
    }
    Radar.update(this.sim, raw);

    // Thunder follows the flash by the time sound takes to travel.
    if (Render.flash > 0.9 && !this._flashed) {
      this._flashed = true;
      AudioFX.thunder(rnd(600, 3400));
    } else if (Render.flash < 0.2) this._flashed = false;

    AudioFX.update(this.sim.tor, Math.hypot(Camera.x - this.sim.tor.x, Camera.z - this.sim.tor.z), Render.rain);

    this.fpsN++;
    this.fpsT += raw;
    if (this.fpsT >= 0.5) {
      document.getElementById('fps').textContent = Math.round(this.fpsN / this.fpsT);
      this.fpsN = 0; this.fpsT = 0;
    }

    this.hudT += raw;
    if (this.hudT > 0.1) { this.hudT = 0; this.updateHUD(); }

    requestAnimationFrame((t) => this.frame(t));
  },

  /* ---------------------------------------------------------
     Readouts
     --------------------------------------------------------- */
  updateHUD() {
    const t = this.sim.tor, s = this.sim.stats;
    const $ = (id) => document.getElementById(id);

    // Ground-relative peak: rotation + inflow + the storm's forward motion.
    const gp = t.groundPeak;
    const gpEF = efFromWind(gp);
    $('roWind').textContent = Math.round(gp * MS_TO_MPH);
    $('roEF').textContent = EF_LABEL[gpEF];
    $('roWidth').textContent = Math.round(t.radius * 2 * 1.0936);
    $('roPath').textContent = (t.pathLen / 1609.34).toFixed(2);
    $('roStage').textContent = t.stageName;

    const prevCows = this._cows | 0;
    if (s.cowsNow !== prevCows) {
      this._cows = s.cowsNow;
      const el = $('mooNow');
      el.textContent = s.cowsNow;
      if (s.cowsNow > prevCows) {
        const box = el.parentElement;
        box.classList.remove('pop');
        void box.offsetWidth;
        box.classList.add('pop');
      }
    }
    $('mooTotal').textContent = s.cowsTotal;
    $('mooBar').style.width = Math.min(100, (s.cowsTotal / Math.max(1, this.sim.cfg.cows)) * 100) + '%';

    $('tRoof').textContent = s.roofs;
    $('tHome').textContent = s.homes;
    $('tSlab').textContent = s.slabs;
    $('tCar').textContent = s.cars;
    $('tTree').textContent = s.trees;
    $('tDebris').textContent = s.debrisAloft;
    $('surveyEF').textContent = EF_LABEL[s.surveyEF];

    document.querySelectorAll('#fujita li').forEach(li =>
      li.classList.toggle('on', +li.dataset.ef === gpEF));

    if (this.sim.events.length) this.showTicker(this.sim.events.shift());
    if (this.sim.autoStorm) {
      const sv = Math.round(this.sim.stormStage * 100);
      $('sStorm').value = sv;
      $('vStorm').textContent = ['Clear air', 'Cumulus', 'Towering', 'Supercell',
        'Mesocyclone', 'Mature'][Math.min(5, Math.floor(this.sim.stormStage * 5.99))];
      $('sLife').value = Math.round(t.life * 100);
      $('vLife').textContent = t.stageName;
    }
    this.updateWarning();
  },

  /*
     Tornado warning: solves for the storm's closest approach to the
     shelter and counts down to it. This is roughly what a warning
     actually gives you — minutes, not seconds, and only if you are
     paying attention.
  */
  updateWarning() {
    const t = this.sim.tor;
    const banner = document.getElementById('warnBanner');
    const dx = SHELTER.x - t.x, dz = SHELTER.z - t.z;
    const v2 = t.vx * t.vx + t.vz * t.vz;
    const dist = Math.hypot(dx, dz);

    let tc = 0, closest = dist;
    if (v2 > 0.01) {
      tc = (dx * t.vx + dz * t.vz) / v2;
      if (tc < 0) tc = 0;
      closest = Math.hypot(dx - t.vx * tc, dz - t.vz * tc);
    }

    const threat = Math.max(600, t.radius * 2.0);
    const active = t.lifeScale > 0.18 && closest < threat && (tc < 150 || dist < threat);

    if (active) {
      banner.hidden = false;
      // "Overhead" means actually on top of you, not merely inside the warning
      // polygon — otherwise the banner claims impact while still counting down.
      const overhead = dist < Math.max(130, t.radius * 1.7);
      const secs = Math.max(0, Math.round(tc));
      document.getElementById('warnClock').textContent = (overhead || secs <= 2)
        ? 'NOW'
        : Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
      document.getElementById('warnSub').textContent = overhead
        ? 'Tornado overhead — stay down, cover your head'
        : 'Tornado on the ground ' + (dist / 1000).toFixed(1) + ' km '
          + bearingName(dx, dz) + ' of town';
    } else {
      banner.hidden = true;
    }

    if (this.siren) AudioFX.siren(active);
  },

  showTicker(msg) {
    const el = document.getElementById('ticker');
    el.firstElementChild.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._tick);
    this._tick = setTimeout(() => el.classList.remove('show'), 3400);
  },

  applyQuality() {
    const p = Render.qualityProfile();
    Render.resize();
    if (this.gl) {
      GLScene.quality = Render.quality;
      GLScene.resize();
      Overlay.resize();
      const gp = GLScene.qualityProfile();
      // The GPU path affords far more dust than the software one.
      this.sim.dustCount = gp.dust;
      if (this.sim.vegCount !== gp.veg) {
        this.sim.vegCount = gp.veg;
        Vegetation.build(gp.veg, this.sim.roads);
      }
    } else {
      this.sim.dustCount = p.dust;
    }
    Radar.setN(p.radarN);
    Radar.resize();
  },

  /* ---------------------------------------------------------
     Interface
     --------------------------------------------------------- */
  bindUI() {
    const $ = (id) => document.getElementById(id);
    const t = this.sim.tor;
    const sim = this.sim;

    /* --- storm strength --- */
    const wind = $('sWind'), width = $('sWidth'), speed = $('sSpeed'), heading = $('sHeading');

    /* The picker highlights the band the storm actually lands in at ground
       level, so it agrees with the rating in the top bar. Width and forward
       speed shift that too, hence the shared refresh. */
    const refreshEF = () => {
      const ef = efFromWind(t.groundPeak);
      document.querySelectorAll('#efPicker button').forEach(b =>
        b.classList.toggle('on', +b.dataset.ef === ef));
    };
    const syncWind = () => {
      const mph = +wind.value;
      t.vmax = mph / MS_TO_MPH;
      $('vWind').textContent = mph + ' mph';
      refreshEF();
    };
    wind.addEventListener('input', syncWind);

    document.querySelectorAll('#efPicker button').forEach(b => {
      b.addEventListener('click', () => {
        const ef = +b.dataset.ef;
        // Bigger tornadoes really are wider — nudge the funnel to match.
        width.value = Math.round(lerp(34, 280, ef / 5) / 2) * 2;
        t.coreR = +width.value / 2;
        // A wide wedge hangs from a higher cloud base; keeping 420 m for all
        // of them makes the big ones look squat.
        base.value = Math.round(lerp(340, 660, ef / 5) / 5) * 5;
        base.dispatchEvent(new Event('input'));
        this.setCam(this.camMode);          // reframe for the new size
        // Aim for the middle of the band as measured at the ground, then
        // back out the rotation speed that gets us there.
        const lo = EF_MIN_MS[ef];
        const hi = ef < 5 ? EF_MIN_MS[ef + 1] : 116;
        const target = lerp(lo, hi, 0.5);
        wind.value = Math.round(clamp(t.rotationForPeak(target) * MS_TO_MPH, +wind.min, +wind.max));
        syncWind();
        width.dispatchEvent(new Event('input'));
      });
    });

    // The slider is a diameter, which is how tornado width is always quoted.
    width.addEventListener('input', () => {
      t.coreR = +width.value / 2;
      $('vWidth').textContent = width.value + ' m';
      refreshEF();
    });
    speed.addEventListener('input', () => {
      t.fwdSpeed = +speed.value;
      $('vSpeed').textContent = (+speed.value).toFixed(1) + ' m/s ('
        + Math.round(+speed.value * MS_TO_MPH) + ' mph)';
      refreshEF();
    });
    heading.addEventListener('input', () => {
      t.heading = +heading.value * DEG;
      t.steer = null;
      $('vHeading').textContent = heading.value + '°';
    });

    /* --- the supercell --- */
    const storm = $('sStorm');
    const stormNames = ['Clear air', 'Cumulus', 'Towering', 'Supercell', 'Mesocyclone', 'Mature'];
    const syncStorm = () => {
      sim.stormStage = +storm.value / 100;
      $('vStorm').textContent = stormNames[Math.min(5, Math.floor(sim.stormStage * 5.99))];
    };
    storm.addEventListener('input', () => { sim.autoStorm = false; syncStorm(); });
    $('btnForm').addEventListener('click', () => {
      sim.beginFormation();
      this.setCam('chase', true);
      this.playing = true;
      document.getElementById('icPlay').classList.add('hide');
      document.getElementById('icPause').classList.remove('hide');
      this.showTicker('Watch the storm build — the funnel comes last.');
    });

    /* --- structure --- */
    const sub = $('sSub'), base = $('sBase'), life = $('sLife');
    sub.addEventListener('input', () => {
      t.subCount = +sub.value;
      t.rebuildSubs();
      $('vSub').textContent = sub.value === '0' ? 'single' : sub.value;
    });
    base.addEventListener('input', () => {
      t.cloudBase = +base.value;
      $('vBase').textContent = base.value + ' m';
    });
    life.addEventListener('input', () => {
      t.life = +life.value / 100;
      $('vLife').textContent = t.stageName;
    });

    $('btnSpin').addEventListener('click', (e) => {
      t.spin = -t.spin;
      const cyc = t.spin > 0;
      e.currentTarget.classList.toggle('on', cyc);
      e.currentTarget.innerHTML = cyc ? 'Cyclonic &#8635;' : 'Anticyclonic &#8634;';
    });

    $('btnLife').addEventListener('click', (e) => {
      t.autoLife = !t.autoLife;
      e.currentTarget.classList.toggle('on', t.autoLife);
      e.currentTarget.textContent = 'Life cycle: ' + (t.autoLife ? 'On' : 'Off');
      life.disabled = t.autoLife;
      life.style.opacity = t.autoLife ? 0.4 : 1;
      if (t.autoLife) { t.life = 0.02; t.reposition(); }
    });

    /* --- real storm presets --- */
    const applyStorm = (s) => {
      // Structure first: the rotation solve depends on width, forward speed
      // and how many suction vortices are in play.
      width.value = s.widthM;
      t.coreR = s.widthM / 2;
      base.value = s.base;
      speed.value = s.fwd;
      t.fwdSpeed = s.fwd;
      sub.value = s.subs;
      t.subCount = s.subs;
      t.rebuildSubs();
      t.cloudBase = s.base;

      const rot = t.rotationForPeak(s.peak / MS_TO_MPH);
      wind.value = Math.round(clamp(rot * MS_TO_MPH, +wind.min, +wind.max));

      [width, base, speed, sub].forEach(el => el.dispatchEvent(new Event('input')));
      syncWind();

      sim.resetStorm();
      this.setCam(this.camMode === 'quiz' ? 'chase' : this.camMode, true);

      document.querySelectorAll('#stormPicker button').forEach(b =>
        b.classList.toggle('on', b.dataset.storm === s.id));

      const card = $('stormCard');
      card.hidden = false;
      card.innerHTML =
        '<h4>' + s.name + ', ' + s.place + '</h4>' +
        '<div class="sc-date">' + s.date + '</div>' +
        '<dl>' + s.stats.map(r =>
          '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>').join('') + '</dl>' +
        '<p>' + s.note + '</p>';

      this.showTicker(s.name + ' ' + s.date.slice(-4) + ' — ' + s.rating
        + ', ' + Math.round(s.widthM) + ' m wide. Storm reset upwind.');
    };

    document.querySelectorAll('#stormPicker button').forEach(b =>
      b.addEventListener('click', () => {
        const s = REAL_STORMS.find(x => x.id === b.dataset.storm);
        if (s) applyStorm(s);
      }));

    /* --- weather --- */
    const rain = $('sRain'), tod = $('sTod');
    rain.addEventListener('input', () => {
      Render.rain = +rain.value / 100;
      $('vRain').textContent = rain.value + '%';
    });
    tod.addEventListener('input', () => {
      Render.tod = +tod.value / 100;
      const names = ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Golden hour', 'Dusk'];
      $('vTod').textContent = names[Math.min(5, Math.floor(Render.tod * 5.99))];
    });
    $('btnLightning').addEventListener('click', (e) => {
      Render.lightning = !Render.lightning;
      e.currentTarget.classList.toggle('on', Render.lightning);
    });
    $('btnSound').addEventListener('click', (e) => {
      AudioFX.setEnabled(!AudioFX.on);
      e.currentTarget.classList.toggle('on', AudioFX.on);
      e.currentTarget.textContent = 'Sound: ' + (AudioFX.on ? 'On' : 'Off');
    });

    /* --- town --- */
    const town = $('sTown'), cows = $('sCows'), cars = $('sCars');
    const townLabel = () => {
      $('vTown').textContent = town.value;
      $('vCows').textContent = cows.value;
      $('vCars').textContent = cars.value;
    };
    const rebuild = () => {
      sim.cfg.buildings = +town.value;
      sim.cfg.cows = +cows.value;
      sim.cfg.cars = +cars.value;
      sim.rebuild();
    };
    [town, cows, cars].forEach(s => {
      s.addEventListener('input', townLabel);
      s.addEventListener('change', rebuild);
    });
    $('btnRebuild').addEventListener('click', () => {
      sim.rebuild(true);
      sim.tor.reset();
      this.showTicker('New town generated. Storm reset upwind.');
    });

    /* --- show me --- */
    const chip = (id, key) => $(id).addEventListener('click', (e) => {
      Render[key] = !Render[key];
      e.currentTarget.classList.toggle('on', Render[key]);
    });
    chip('tgAnatomy', 'showAnatomy');
    chip('tgPath', 'showPath');
    chip('tgWind', 'showWind');
    chip('tgGrid', 'showGrid');

    /* --- radar --- */
    const radarLegend = () => {
      $('radarLegend').innerHTML = Radar.mode === 'velocity'
        ? 'Storm-relative. <span class="g">Green</span> toward the radar, '
          + '<span class="r">red</span> away. The two hard against each other mean rotation.'
        : 'Rain intensity. The <b>hook</b> curling round the south side is '
          + 'the classic tornado signature.';
    };
    $('tgRadar').addEventListener('click', (e) => {
      Radar.on = !Radar.on;
      e.currentTarget.classList.toggle('on', Radar.on);
      $('radarPanel').hidden = !Radar.on;
      if (Radar.on) { Radar.resize(); Radar.paint(sim); radarLegend(); }
    });
    document.querySelectorAll('.rmode button').forEach(b =>
      b.addEventListener('click', () => {
        Radar.mode = b.dataset.rmode;
        document.querySelectorAll('.rmode button').forEach(o =>
          o.classList.toggle('on', o === b));
        radarLegend();
        Radar.paint(sim);
      }));
    radarLegend();

    /* --- siren --- */
    $('tgSiren').addEventListener('click', (e) => {
      this.siren = !this.siren;
      e.currentTarget.classList.toggle('on', this.siren);
      if (this.siren && !AudioFX.on) {
        AudioFX.setEnabled(true);
        $('btnSound').classList.add('on');
        $('btnSound').textContent = 'Sound: On';
      }
      if (!this.siren) AudioFX.siren(false);
    });

    /* --- damage survey quiz --- */
    $('btnQuiz').addEventListener('click', () => {
      if (Quiz.active) { Quiz.finish(sim, this); return; }
      if (!Quiz.start(sim, this)) {
        this.showTicker('Nothing damaged yet — let the storm hit town first.');
      }
    });

    /* --- transport --- */
    $('btnPlay').addEventListener('click', () => this.togglePlay());
    $('btnReset').addEventListener('click', () => {
      sim.resetStorm();
      this.setCam(this.camMode, true);
      this.showTicker('Storm reset. Here it comes again.');
    });
    const ts = $('sTime');
    ts.addEventListener('input', () => {
      this.timeScale = +ts.value / 100;
      $('vTime').textContent = this.timeScale.toFixed(1) + '×';
    });

    document.querySelectorAll('#camPicker button').forEach(b =>
      b.addEventListener('click', () => this.setCam(b.dataset.cam, true)));

    $('selQuality').addEventListener('change', (e) => {
      Render.quality = e.target.value;
      this.applyQuality();
    });

    /* --- top actions --- */
    $('btnHelp').addEventListener('click', () => $('modal').hidden = false);
    $('btnClose').addEventListener('click', () => $('modal').hidden = true);
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('modal').hidden = true; });
    $('btnUI').addEventListener('click', () => document.body.classList.toggle('ui-hidden'));
    $('btnShot').addEventListener('click', () => this.screenshot());

    /* --- pointer --- */
    const cv = this.viewCanvas;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      cv.classList.add('dragging');
      this.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      AudioFX.resume();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      Camera.yaw -= dx * 0.005;
      if (this.camMode !== 'ground') Camera.pitch = clamp(Camera.pitch + dy * 0.004, -0.05, 1.4);
      else this.lookH = clamp(this.lookH + dy * 0.0016, 0.05, 1.2);
    });
    const endDrag = (e) => {
      if (!this.drag) return;
      if (this.drag.moved < 6) {
        const g = Camera.screenToGround(e.clientX, e.clientY);
        if (g) {
          this.sim.tor.steer = g;
          this.showTicker('Steering the storm toward that point.');
        }
      }
      this.drag = null;
      cv.classList.remove('dragging');
    };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', () => { this.drag = null; cv.classList.remove('dragging'); });

    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      Camera.dist = clamp(Camera.dist * (1 + e.deltaY * 0.0011), 30, 3600);
    }, { passive: false });

    window.addEventListener('resize', () => {
      Render.resize();
      if (this.gl) { GLScene.resize(); Overlay.resize(); }
      Radar.resize();
    });

    /* --- keyboard --- */
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); this.togglePlay(); }
      else if (k === 'r') $('btnReset').click();
      else if (k === 'a') $('tgAnatomy').click();
      else if (k === 'w') $('tgWind').click();
      else if (k === 'g') $('tgGrid').click();
      else if (k === 'h') $('btnUI').click();
      else if (k === 'p') this.screenshot();
      else if (k === '?' || k === '/') $('modal').hidden = !$('modal').hidden;
      else if (k === 'escape') $('modal').hidden = true;
      else if (k === 'q') $('btnQuiz').click();
      else if (k === 'd') $('tgRadar').click();
      else if (k >= '1' && k <= '6') {
        const modes = ['chase', 'ground', 'town', 'aerial', 'cellar', 'orbit'];
        this.setCam(modes[+k - 1], true);
      }
    });

    /* Initial label pass */
    syncWind();
    width.dispatchEvent(new Event('input'));
    speed.dispatchEvent(new Event('input'));
    heading.dispatchEvent(new Event('input'));
    sub.dispatchEvent(new Event('input'));
    base.dispatchEvent(new Event('input'));
    life.dispatchEvent(new Event('input'));
    syncStorm();
    rain.dispatchEvent(new Event('input'));
    tod.dispatchEvent(new Event('input'));
    ts.dispatchEvent(new Event('input'));
    townLabel();
  },

  togglePlay() {
    this.playing = !this.playing;
    document.getElementById('icPlay').classList.toggle('hide', this.playing);
    document.getElementById('icPause').classList.toggle('hide', !this.playing);
  },

  screenshot() {
    try {
      (this.gl ? GLScene.canvas : Render.canvas).toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'storm-lab-' + Date.now() + '.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, 'image/png');
      this.showTicker('Picture saved to your downloads.');
    } catch (err) {
      this.showTicker('Could not save the picture here.');
    }
  }
};

/* Where the storm cellar is, and where the warning counts down to. */
const SHELTER = { x: 62, y: 0.55, z: 96 };

/* Compass direction FROM the town TO the storm. dx/dz point town -> storm
   reversed, so negate to describe where the storm is sitting. */
function bearingName(dx, dz) {
  const names = ['north', 'north-east', 'east', 'south-east',
                 'south', 'south-west', 'west', 'north-west'];
  const a = Math.atan2(-dx, -dz);            // 0 = north, clockwise
  let i = Math.round(((a + TAU) % TAU) / (TAU / 8)) % 8;
  return names[i];
}

window.addEventListener('DOMContentLoaded', () => App.init());
