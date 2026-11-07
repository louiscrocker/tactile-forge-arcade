/* ============================================================
   ring.js — the Antler Ring: wrestling on a branch
   ============================================================
   Two beetles on the Antler Branch.  `pos` runs from -1 (you are
   off the trunk end, whoops) to +1 (he is off the tip).  There are
   only two buttons and every move is shown before it lands:

     SPACE  push.  A little push any time.  When an orange ring
            closes on him (he is about to shove or charge), a push
            as it closes is a BLOCK: he staggers and his guard opens.
     E      hook.  When his chin glows GREEN, his guard is open: hook
            your antlers under him.  Then tap SPACE to LIFT, and
            FLIP him.  Flipped near the tip, he is off the branch.
            Flipped near the middle, he lands further along.

   A red ring is a trick: the jaws snap shut, so wait for the green.
   Nothing hurts.  Size matters but never decides: a small beetle
   gets further with each flip, and a rival who beats you tires.
   Pure logic, shared with smoke.js.  Sound and pictures hang off
   the Bus events.
   ============================================================ */
'use strict';

class Ring {
  constructor(p, rival, D) {
    this.p = p; this.rival = rival; this.def = rival.rivalDef; this.D = D;
    this.pos = 0; this.state = 'idle'; this.t = 0; this.next = 1.4; this.move = null; this.queue = [];
    this.blocked = false; this.lifts = 0; this.done = null; this.doneT = 0; this.flash = 0; this.say = ''; this.sayT = 0; this.shove = 0;
    this.stats = { blocks: 0, hooks: 0, flips: 0, tricked: 0 };
    const tired = p.ringLosses[this.def.key] || 0;
    this.tired = clamp(tired * .22, 0, .6);
    this.str = clamp(Math.pow(p.lengthMM / this.def.len, .9), .6, 1.5);
  }
  get powerK() { return (.55 + this.def.power * .16) * this.D.rival * (1 - this.tired); }
  get window() { return this.D.window * (1 + this.tired) * (this.move === 'charge' ? .9 : 1); }
  /* colour of the ring: 'orange' block it · 'green' hook him · 'red' trick, wait · '' nothing */
  signal() { return this.state === 'tell' ? (this.move === 'feint' ? 'red' : 'orange') : this.state === 'open' ? 'green' : ''; }
  /* 0 → 1 as the ring closes */
  closing() { return this.state === 'tell' ? clamp(this.t / this.window, 0, 1) : 0; }
  blockable() { return this.state === 'tell' && this.move !== 'feint' && this.closing() > .4; }
  note(s, t = 1.1) { this.say = s; this.sayT = t; }
  pick() {
    if (!this.queue.length) { this.queue = this.def.moves.slice(); for (let i = this.queue.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]; } }
    return this.queue.pop();
  }
  update(dt, space, hook) {
    const p = this.p;
    this.t += dt; this.flash = Math.max(0, this.flash - dt * 3); this.sayT = Math.max(0, this.sayT - dt); this.shove = Math.max(0, this.shove - dt * 3);
    if (this.done) { this.doneT += dt; return; }
    /* he leans on you all the time, gently */
    if (this.state !== 'lift' && this.state !== 'open') this.pos -= this.powerK * .018 * dt;
    switch (this.state) {
      case 'idle':
        if (space) this.push();
        if (hook) this.note('Wait for green!');
        if (this.t >= this.next) { this.move = this.pick(); this.t = 0; this.blocked = false; if (this.move === 'rest') { this.open(2.4); this.rival.nap = true; Bus.emit('ringRest', p); } else { this.state = 'tell'; Bus.emit('ringTell', p, this.move); } }
        break;
      case 'tell':
        if (space) { if (this.blockable()) this.block(); else this.push(); }
        if (hook && this.move === 'feint') { this.pos -= .12; this.stats.tricked++; this.note('Tricked!'); Bus.emit('ringTricked', p); this.idle(1); break; }
        if (this.state === 'tell' && this.t >= this.window) {
          if (this.move === 'feint') { this.note('Snap! Wait for green.'); this.idle(.8); break; }
          /* the blow lands: you slide back along the branch */
          const k = (this.move === 'charge' ? .36 : .2) * this.powerK;
          this.pos -= k; this.shove = 1; p.G.cam.shake = .2; this.note(this.move === 'charge' ? 'Thump!' : 'Shoved!');
          Bus.emit('ringHit', p, this.move); this.idle(1.1);
        }
        break;
      case 'open':
        if (hook) { this.state = 'lift'; this.t = 0; this.lifts = 0; this.stats.hooks++; this.rival.nap = false; this.note('LIFT! Tap Space!', 2); Bus.emit('ringHook', p); break; }
        if (space) this.push();
        if (this.t >= this.openFor) { this.rival.nap = false; this.idle(1); }
        break;
      case 'lift':
        if (space) { this.lifts++; p.lift = Math.min(1.3, this.lifts / 3); Bus.emit('ringLift', p, this.lifts); }
        if (this.lifts >= 3) this.flip();
        else if (this.t > 3 / (1 + this.tired * .3) + (this.D === DIFFICULTY.easy ? 1.5 : 0)) { this.note('He slipped out!'); this.idle(1); }
        break;
    }
    this.pos = clamp(this.pos, -1, 1);
    if (this.pos >= 1) this.win(); else if (this.pos <= -1) this.lose();
  }
  idle(next) { this.state = 'idle'; this.t = 0; this.next = next * (.8 + Math.random() * .5) / Math.sqrt(this.powerK); }
  open(sec) { this.state = 'open'; this.t = 0; this.openFor = sec; }
  push() { this.pos += .024 * this.str; this.p.pinch = .5; Bus.emit('ringPush', this.p); }
  block() {
    this.stats.blocks++; this.pos += .06; this.flash = 1; this.note('BLOCK! Now E!', 1.4);
    Bus.emit('ringBlock', this.p);
    this.open((this.move === 'charge' ? 2.2 : 1.7) * (1 + this.tired) * (this.D === DIFFICULTY.easy ? 1.4 : 1));
  }
  flip() {
    this.stats.flips++; this.flash = 1; this.p.lift = 1.3;
    if (this.pos > .32) { this.pos = 1; return; }
    this.pos += clamp(.34 * this.str, .24, .5); this.note('FLIP! Again!'); Bus.emit('ringFlip', this.p); this.idle(1.5);
  }
  win() { if (this.done) return; this.done = 'win'; this.doneT = 0; Bus.emit('ringWon', this.p, this.rival); }
  lose() { if (this.done) return; this.done = 'lose'; this.doneT = 0; Bus.emit('ringLost', this.p, this.rival); }
}
