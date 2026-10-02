// =====================================================
// Tactile Forge — Race Engine (ES module)
// =====================================================

import {
  WIND_DIRECTIONS, WIND_ANGLES, WIND_SPEED_MULTIPLIERS,
  POINTS_OF_SAIL, YACHT_COLORS, YACHT_CLASSES, DEFAULT_NAMES,
  COURSES, EVENT_CARDS
} from './constants.js';

export class YachtRaceEngine {
  constructor() { this.reset(); }

  reset() {
    this.players = [];
    this.currentPlayerIndex = 0;
    this.course = null;
    this.courseName = 'coastal';
    this.totalLaps = 2;
    this.difficulty = 'normal';
    this.windDirection = 'NW';
    this.windStrength = 'moderate';
    this.turnNumber = 0;
    this.phase = 'setup';
    this.finishOrder = [];
    this.eventDeck = [];
    this.lastEvent = null;
    this.squallActive = false;
    this.squallTurns = 0;
    this.timeOfDay = 0.3;
    this.tideState = 0; this.tideCycle = 0;
    this.weatherState = 'clear'; this.weatherTimer = 0;
    this.lastCollisions = [];
    this.previousLeader = -1;
  }

  setupGame(config) {
    this.reset();
    this.courseName = config.course || 'coastal';
    this.course = COURSES[this.courseName] || config.courseData || COURSES.coastal;
    if (!COURSES[this.courseName]) this.courseName = 'coastal';
    this.totalLaps = config.laps || 2;
    this.difficulty = config.difficulty || 'normal';

    for (let i = 0; i < config.players.length; i++) {
      const p = config.players[i];
      const cls = YACHT_CLASSES[p.yachtClass] || YACHT_CLASSES.allrounder;
      this.players.push({
        id: i,
        netId: p.netId || null,
        name: p.name || DEFAULT_NAMES[i],
        color: YACHT_COLORS[p.colorIndex ?? i] || YACHT_COLORS[i % YACHT_COLORS.length],
        colorIndex: p.colorIndex ?? i,
        isAI: !!p.isAI,
        yachtClass: cls.key,
        progress: 0,
        x: this.course.marks[0].x + (i - config.players.length / 2) * 0.03,
        y: this.course.marks[0].y + 0.05,
        heading: this.course.startAngle,
        currentMark: 0,
        lap: 0,
        finished: false,
        finishPosition: -1,
        skipNextTurn: false, foggedNextTurn: false,
        bonusMove: 0, doubleMove: false, halfMove: false,
        advanceToMark: false, barnacles: 0,
        totalRolls: 0, totalDistance: 0, turnsPlayed: 0,
        cardsDrawn: 0, tacksPerformed: 0,
        crewStamina: 100, resting: false,
        penaltyTurns: 0, tackFailed: false,
        handicapBonus: cls.handicap, handicapAccumulator: 0,
        animX: 0, animY: 0, animHeading: this.course.startAngle,
        trail: [],
        signalFlags: ['class'],
        isMoving: false, lastMoveDistance: 0
      });
    }
    for (const pl of this.players) {
      pl.animX = pl.x; pl.animY = pl.y;
    }

    if (this.difficulty === 'easy') this.windStrength = 'moderate';
    else if (this.difficulty === 'hard') this.windStrength = 'fresh';

    this.windDirection = WIND_DIRECTIONS[Math.floor(Math.random() * 8)];
    this.shuffleEventDeck();
    this.phase = 'heading';
    this.turnNumber = 1;
  }

  shuffleEventDeck() {
    this.eventDeck = [...EVENT_CARDS];
    for (let i = this.eventDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.eventDeck[i], this.eventDeck[j]] = [this.eventDeck[j], this.eventDeck[i]];
    }
  }

  // ---- Wind ----
  getWindAngle() { return WIND_ANGLES[this.windDirection]; }
  shiftWind(steps) {
    const idx = WIND_DIRECTIONS.indexOf(this.windDirection);
    this.windDirection = WIND_DIRECTIONS[((idx + steps) % 8 + 8) % 8];
  }
  maybeShiftWind() {
    const chance = this.difficulty === 'easy' ? 0.15 : this.difficulty === 'hard' ? 0.35 : 0.22;
    let shifted = false;
    if (Math.random() < chance) {
      this.shiftWind(Math.random() < 0.5 ? 1 : -1);
      shifted = true;
    }
    if (Math.random() < 0.1) {
      const opts = ['light', 'moderate', 'fresh'];
      if (this.difficulty === 'hard') opts.push('strong');
      this.windStrength = opts[Math.floor(Math.random() * opts.length)];
    }
    return shifted;
  }

  // ---- Sailing ----
  getPointOfSail(headingDeg) {
    const wind = this.getWindAngle();
    let rel = Math.abs(headingDeg - wind);
    if (rel > 180) rel = 360 - rel;
    for (const [name, data] of Object.entries(POINTS_OF_SAIL)) {
      if (rel >= data.minAngle && rel < data.maxAngle) return { name, ...data };
    }
    return { name: 'Running', ...POINTS_OF_SAIL['Running'] };
  }

  angleDifference(a, b) {
    let d = a - b;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  }

  requiresTack(player, newHeading) {
    const wind = this.getWindAngle();
    const o = this.angleDifference(player.heading, wind);
    const n = this.angleDifference(newHeading, wind);
    return ((o > 0 && n < 0) || (o < 0 && n > 0)) && Math.abs(o) < 90 && Math.abs(n) < 90;
  }
  requiresJibe(player, newHeading) {
    const wind = this.getWindAngle();
    const o = this.angleDifference(player.heading, wind);
    const n = this.angleDifference(newHeading, wind);
    return ((o > 0 && n < 0) || (o < 0 && n > 0)) && Math.abs(o) > 120 && Math.abs(n) > 120;
  }

  performTack(player) {
    const cls = YACHT_CLASSES[player.yachtClass];
    player.tacksPerformed++;
    player.crewStamina = Math.max(0, player.crewStamina - 10 * cls.staminaCost);
    if (Math.random() < 0.15) { player.tackFailed = true; return false; }
    return true;
  }
  performJibe(player) {
    const cls = YACHT_CLASSES[player.yachtClass];
    player.crewStamina = Math.max(0, player.crewStamina - 15 * cls.staminaCost);
    return true;
  }

  rollDice() {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    return { d1, d2, total: d1 + d2 };
  }

  calculateMovement(diceRoll, heading) {
    const pos = this.getPointOfSail(heading);
    const windMult = WIND_SPEED_MULTIPLIERS[this.windStrength];
    const player = this.getCurrentPlayer();
    const cls = YACHT_CLASSES[player.yachtClass];

    let m = Math.max(0, Math.round((diceRoll + pos.modifier) * windMult));
    m += cls.speedModifier;
    if (this.squallActive || this.windStrength === 'strong' || this.windStrength === 'gale') m += cls.stormModifier;

    if (player.doubleMove) { m *= 2; player.doubleMove = false; }
    if (player.halfMove)   { m = Math.max(1, Math.floor(m / 2)); player.halfMove = false; }
    if (player.foggedNextTurn) { m = Math.max(1, Math.floor(m / 2)); player.foggedNextTurn = false; }
    if (player.barnacles > 0)  { m = Math.max(0, m - 1); player.barnacles--; }
    if (this.squallActive)     { m = Math.max(0, m - 2); }
    if (player.crewStamina < 20) m = Math.max(0, m - 1);
    if (player.tackFailed)     { m = Math.max(0, Math.floor(m * 0.5)); player.tackFailed = false; }
    if (player.penaltyTurns > 0) { m = Math.max(0, Math.floor(m / 2)); player.penaltyTurns--; }
    if (player.handicapBonus > 0) {
      player.handicapAccumulator++;
      if (player.handicapAccumulator >= 4) { m += player.handicapBonus; player.handicapAccumulator = 0; }
    }
    m += (player.bonusMove || 0);
    player.bonusMove = 0;
    return Math.max(0, m);
  }

  // ---- Course nav ----
  getNextMarkPosition() {
    const p = this.getCurrentPlayer();
    return this.course.marks[p.currentMark % this.course.marks.length];
  }
  distanceToMark(player, markIdx) {
    const m = this.course.marks[markIdx % this.course.marks.length];
    return Math.hypot(m.x - player.x, m.y - player.y);
  }
  angleToMark(player, markIdx) {
    const m = this.course.marks[markIdx % this.course.marks.length];
    return (Math.atan2(m.y - player.y, m.x - player.x) * 180 / Math.PI + 90 + 360) % 360;
  }

  movePlayer(player, distance) {
    const unit = 0.012;
    const total = distance * unit;
    const rad = (player.heading - 90) * Math.PI / 180;
    let dx = Math.cos(rad) * total;
    let dy = Math.sin(rad) * total;
    const c = this.getCurrentEffect(player.x, player.y);
    if (c) { dx += c.dx; dy += c.dy; }

    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 32) player.trail.shift();

    player.x = Math.max(0.02, Math.min(0.98, player.x + dx));
    player.y = Math.max(0.02, Math.min(0.98, player.y + dy));
    player.totalDistance += distance;
    player.isMoving = distance > 0;
    player.lastMoveDistance = distance;

    this.checkMarkRounding(player);
  }

  checkMarkRounding(player) {
    const idx = player.currentMark % this.course.marks.length;
    if (this.distanceToMark(player, idx) < 0.06) {
      player.currentMark++;
      if (player.currentMark % this.course.marks.length === 0) {
        player.lap++;
        if (player.lap >= this.totalLaps) {
          player.finished = true;
          this.finishOrder.push(player.id);
          player.finishPosition = this.finishOrder.length;
        }
      }
      return true;
    }
    return false;
  }

  // ---- Collisions ----
  checkCollisions() {
    this.lastCollisions = [];
    const t = 0.03;
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i], b = this.players[j];
        if (a.finished || b.finished) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < t) {
          this.lastCollisions.push({ a: i, b: j });
          this.resolveCollision(a, b);
        }
      }
    }
    return this.lastCollisions;
  }
  resolveCollision(a, b) {
    const wind = this.getWindAngle();
    const ra = this.angleDifference(a.heading, wind);
    const rb = this.angleDifference(b.heading, wind);
    let violator;
    if (ra > 0 && rb <= 0) violator = b;
    else if (rb > 0 && ra <= 0) violator = a;
    else violator = Math.abs(ra) > Math.abs(rb) ? a : b;
    violator.penaltyTurns = 1;
    const dx = a.x - b.x, dy = a.y - b.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const push = 0.022;
    a.x += (dx / d) * push; a.y += (dy / d) * push;
    b.x -= (dx / d) * push; b.y -= (dy / d) * push;
  }

  // ---- Currents ----
  getCurrentEffect(x, y) {
    if (!this.course.currentField || !this.course.currentField.length) return null;
    let dx = 0, dy = 0;
    const tideMult = [1, 0, -1, 0][this.tideState];
    for (const c of this.course.currentField) {
      const d = Math.hypot(x - c.x, y - c.y);
      const inf = Math.max(0, 1 - d / 0.3) * c.strength;
      dx += c.dx * inf * tideMult;
      dy += c.dy * inf * tideMult;
    }
    return (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) ? null : { dx, dy };
  }

  advanceTide() {
    this.tideCycle++;
    if (this.tideCycle >= 8) { this.tideCycle = 0; this.tideState = (this.tideState + 1) % 4; }
  }
  getTideStateLabel() { return ['Flood', 'Slack', 'Ebb', 'Slack'][this.tideState]; }

  // ---- Crew/weather ----
  restCrew(p) { p.resting = true; p.crewStamina = Math.min(100, p.crewStamina + 30); }
  applyStormStamina(p) {
    if (this.squallActive || this.windStrength === 'strong' || this.windStrength === 'gale') {
      const cls = YACHT_CLASSES[p.yachtClass];
      p.crewStamina = Math.max(0, p.crewStamina - 5 * cls.staminaCost);
    }
  }
  advanceTime() { this.timeOfDay = (this.timeOfDay + 0.04) % 1; }
  getTimeOfDayLabel() {
    const t = this.timeOfDay;
    if (t < 0.2) return 'Night';
    if (t < 0.3) return 'Dawn';
    if (t < 0.7) return 'Day';
    if (t < 0.8) return 'Dusk';
    return 'Night';
  }
  advanceWeather() {
    if (this.weatherTimer > 0) {
      this.weatherTimer--;
      if (this.weatherTimer <= 0) this.weatherState = 'clear';
    } else if (this.weatherState === 'clear' && Math.random() < 0.05) {
      if (this.difficulty === 'hard' && Math.random() < 0.3) {
        this.weatherState = 'rain'; this.weatherTimer = 2 + Math.floor(Math.random() * 3);
      } else if (Math.random() < 0.2) {
        this.weatherState = 'fog'; this.weatherTimer = 2 + Math.floor(Math.random() * 2);
      }
    }
  }

  // ---- Events ----
  shouldDrawEvent() {
    const c = this.difficulty === 'easy' ? 0.25 : this.difficulty === 'hard' ? 0.45 : 0.33;
    return Math.random() < c;
  }
  drawEvent() {
    if (!this.eventDeck.length) this.shuffleEventDeck();
    const card = this.eventDeck.pop();
    this.lastEvent = card;
    return card;
  }
  applyEvent(card) {
    const p = this.getCurrentPlayer();
    card.apply(p, this);
    p.cardsDrawn++;
  }

  tideShift() {
    const a = Math.random() * Math.PI * 2;
    const s = 0.015;
    for (const p of this.players) {
      if (p.finished) continue;
      p.x = Math.max(0.02, Math.min(0.98, p.x + Math.cos(a) * s));
      p.y = Math.max(0.02, Math.min(0.98, p.y + Math.sin(a) * s));
    }
  }
  squall() {
    this.squallActive = true;
    this.squallTurns = 3;
    this.windStrength = ['strong', 'fresh'][Math.floor(Math.random() * 2)];
    this.shiftWind(Math.random() < 0.5 ? 2 : -2);
  }

  // ---- Turn flow ----
  getCurrentPlayer() { return this.players[this.currentPlayerIndex]; }

  startTurn() {
    const p = this.getCurrentPlayer();
    if (p.skipNextTurn) {
      p.skipNextTurn = false;
      p.turnsPlayed++;
      this.advanceToNextPlayer();
      return 'skipped';
    }
    if (p.finished) { this.advanceToNextPlayer(); return 'finished'; }
    this.advanceTime();
    this.advanceTide();
    this.advanceWeather();
    this.applyStormStamina(p);
    p.resting = false; p.isMoving = false;
    if (this.squallActive) {
      this.squallTurns--;
      if (this.squallTurns <= 0) { this.squallActive = false; this.windStrength = 'moderate'; this.weatherState = 'clear'; this.weatherTimer = 0; }
    }
    const shifted = this.maybeShiftWind();
    this.phase = 'heading';
    return shifted ? 'wind_shifted' : 'ready';
  }

  setHeading(heading) {
    const p = this.getCurrentPlayer();
    let result = null;
    if (this.requiresTack(p, heading)) result = this.performTack(p) ? 'tack_success' : 'tack_failed';
    else if (this.requiresJibe(p, heading)) { this.performJibe(p); result = 'jibe'; }
    p.heading = heading;
    this.phase = 'rolling';
    return result;
  }

  performRoll() {
    const p = this.getCurrentPlayer();
    const dice = this.rollDice();
    p.totalRolls++;
    return { dice, pointOfSail: this.getPointOfSail(p.heading), movement: this.calculateMovement(dice.total, p.heading), player: p };
  }

  performMove(movement) {
    const p = this.getCurrentPlayer();
    this.movePlayer(p, movement);
    p.turnsPlayed++;
    if (p.advanceToMark) {
      const idx = p.currentMark % this.course.marks.length;
      if (this.distanceToMark(p, idx) < 0.1) {
        const m = this.course.marks[idx];
        p.x = m.x; p.y = m.y;
        this.checkMarkRounding(p);
      }
      p.advanceToMark = false;
    }
    this.checkCollisions();
    this.phase = 'event';
  }

  endTurn() { this.advanceToNextPlayer(); this.phase = 'heading'; }

  advanceToNextPlayer() {
    if (this.players.every(p => p.finished)) { this.phase = 'finished'; return; }
    let attempts = 0;
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;
    } while (this.players[this.currentPlayerIndex].finished && attempts < this.players.length);
    if (attempts >= this.players.length) { this.phase = 'finished'; return; }
    this.turnNumber++;
    if (this.finishOrder.length >= this.players.length - 1) {
      for (const p of this.players) {
        if (!p.finished) { p.finished = true; this.finishOrder.push(p.id); p.finishPosition = this.finishOrder.length; }
      }
      this.phase = 'finished';
    }
  }

  // ---- Standings ----
  getStandings() {
    return [...this.players].sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      if (a.finished && b.finished) return a.finishPosition - b.finishPosition;
      const ap = a.lap * this.course.marks.length + a.currentMark;
      const bp = b.lap * this.course.marks.length + b.currentMark;
      if (ap !== bp) return bp - ap;
      return this.distanceToMark(a, a.currentMark) - this.distanceToMark(b, b.currentMark);
    });
  }

  headingToCardinal(deg) {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(((deg % 360 + 360) % 360) / 45) % 8];
  }
}
