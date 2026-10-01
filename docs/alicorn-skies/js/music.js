/* ============================================================
   music.js — the soundtrack: twelve little themes
   ============================================================
   Each place has its own tune: a music-box waltz for the meadow,
   a flute in the woods, harp ripples at the lake, a brave horn
   on the mountain, bells in the Cloud Kingdom, a celesta in the
   Star Sky, a lullaby at night, sleigh bells in winter, marimba
   bubbles under the water, a bouncy party, a racing gallop, and
   a cosy tune at the foal's stable.

   A theme is chords (one per bar), a melody ("note:eighths"
   tokens, r = rest), and an arrangement (instruments, bass,
   arpeggio, drums).  Themes crossfade at bar lines.  All sound
   is synthesised through AudioFX's context — no files.
   ============================================================ */
'use strict';

const THEMES = {
  meadow: { bpm: 104, beats: 3, chords: 'C G Am F C G F C', lead: 'box', lead2: 'harp', arp: 'harp', bass: 'waltz', pad: .018,
    mel: 'E5:2 G5:2 C6:2 | B5:3 A5:1 G5:2 | A5:2 C6:2 E6:2 | D6:3 C6:1 A5:2 | G5:2 E5:2 G5:2 | D6:4 B5:2 | A5:2 C6:2 A5:2 | C6:6' },
  woods: { bpm: 76, beats: 4, chords: 'Dm C Dm Am Bb F C Dm', lead: 'flute', lead2: 'flute', arp: 'pluck', bass: 'slow', pad: .022,
    mel: 'A4:2 D5:2 E5:2 F5:2 | E5:4 G4:2 C5:2 | D5:2 F5:2 A5:3 G5:1 | E5:6 r:2 | F5:2 D5:2 Bb4:2 D5:2 | C5:4 A4:2 C5:2 | E5:2 G5:2 E5:2 C5:2 | D5:8' },
  lake: { bpm: 90, beats: 3, chords: 'G Em C D G Em Am G', lead: 'bells', lead2: 'harp', arp: 'harp', arpFast: true, bass: 'waltz', pad: .02,
    mel: 'B5:2 D6:2 B5:2 | G5:4 E5:2 | E5:2 G5:2 C6:2 | A5:4 F#5:2 | G5:2 B5:2 D6:2 | E6:4 D6:2 | C6:2 A5:2 F#5:2 | G5:6' },
  mountain: { bpm: 96, beats: 4, chords: 'F C Dm Bb F C Bb F', lead: 'horn', lead2: 'horn', arp: null, bass: 'march', pad: .026, drums: 'soft',
    mel: 'C5:2 F5:2 A5:3 G5:1 | G5:4 E5:2 C5:2 | D5:2 F5:2 A5:2 D6:2 | C6:4 Bb5:2 A5:2 | A5:2 C6:2 F6:3 E6:1 | E6:4 C6:2 G5:2 | Bb5:2 D6:2 C6:2 E6:2 | F6:8' },
  clouds: { bpm: 70, beats: 4, chords: 'Cmaj7 D Cmaj7 D Am D G C', lead: 'bells', lead2: 'box', arp: 'harp', bass: 'slow', pad: .03,
    mel: 'G5:2 B5:2 E6:4 | F#6:4 D6:4 | E6:2 D6:2 B5:4 | A5:8 | C6:2 B5:2 A5:2 E5:2 | F#5:4 A5:4 | B5:2 D6:2 G6:4 | E6:8' },
  stars: { bpm: 60, beats: 3, chords: 'Am F C G Am F G C', lead: 'celesta', lead2: 'bells', arp: 'celesta', bass: 'slow', pad: .034,
    mel: 'E6:2 C6:2 A5:2 | F6:4 C6:2 | E6:2 G6:2 C6:2 | D6:6 | E6:2 A6:2 E6:2 | F6:3 E6:1 C6:2 | D6:2 B5:2 G5:2 | C6:6' },
  night: { bpm: 68, beats: 3, chords: 'F C C F F Bb C F', lead: 'box', lead2: 'celesta', arp: null, bass: 'slow', pad: .026,
    mel: 'C6:2 A5:2 F5:2 | G5:4 C5:2 | E5:2 G5:2 C6:2 | A5:6 | F5:2 A5:2 C6:2 | D6:4 Bb5:2 | G5:2 C6:2 E5:2 | F5:6' },
  winter: { bpm: 88, beats: 3, chords: 'Em C G D Em C D G', lead: 'celesta', lead2: 'bells', arp: 'celesta', bass: 'waltz', pad: .022, drums: 'sleigh',
    mel: 'B5:2 E6:2 G6:2 | E6:4 C6:2 | D6:2 B5:2 G5:2 | A5:4 F#5:2 | G5:2 B5:2 E6:2 | G6:3 F#6:1 E6:2 | F#6:2 A6:2 D6:2 | G6:6' },
  underwater: { bpm: 84, beats: 4, chords: 'D Bm G A D Bm G A', lead: 'marimba', lead2: 'marimba', arp: 'marimba', bass: 'slow', pad: .03, muffle: true,
    mel: 'F#5:1 A5:1 D6:2 r:1 A5:1 F#5:2 | B5:3 A5:1 F#5:4 | G5:1 B5:1 D6:2 E6:2 D6:2 | C#6:6 r:2 | D6:1 F#6:1 A6:2 F#6:2 D6:2 | B5:4 D6:4 | G5:2 B5:2 E6:2 C#6:2 | D6:8' },
  party: { bpm: 128, beats: 4, chords: 'C Am F G C Am F G', lead: 'bells', lead2: 'lead', arp: 'pluck', bass: 'bounce', pad: .014, drums: 'party',
    mel: 'E5:1 G5:1 C6:1 G5:1 E6:2 C6:2 | A5:2 C6:1 A5:1 E5:4 | F5:1 A5:1 C6:1 F6:1 E6:2 D6:2 | D6:2 B5:2 G5:4 | E6:1 E6:1 D6:1 C6:1 G5:2 E5:2 | A5:2 G5:2 A5:2 C6:2 | F6:2 E6:2 D6:2 C6:2 | C6:6 r:2' },
  race: { bpm: 150, beats: 4, chords: 'G Em C D G Em C D', lead: 'lead', lead2: 'lead', arp: 'pluck', bass: 'bounce', pad: .01, drums: 'race',
    mel: 'G5:1 B5:1 D6:1 B5:1 G5:1 B5:1 D6:2 | E6:1 D6:1 B5:1 G5:1 E5:2 G5:2 | C6:1 E6:1 G6:1 E6:1 C6:2 E6:2 | D6:1 C6:1 B5:1 A5:1 F#5:4 | G6:2 D6:2 B5:2 D6:2 | E6:2 B5:2 G5:2 B5:2 | C6:1 D6:1 E6:1 G6:1 E6:2 C6:2 | D6:2 F#6:2 G6:4' },
  home: { bpm: 80, beats: 4, chords: 'G C G D Em C D G', lead: 'flute', lead2: 'box', arp: 'pluck', bass: 'slow', pad: .02,
    mel: 'D5:2 G5:2 B5:3 A5:1 | G5:4 E5:4 | D5:2 G5:2 B5:2 D6:2 | C6:4 A5:4 | B5:2 G5:2 E5:2 G5:2 | A5:2 C6:2 E6:4 | D6:2 C6:2 A5:2 F#5:2 | G5:8' }
};

const Music = (function () {
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const midiOf = (s) => { const m = s.match(/^([A-G][#b]?)(\d)$/); return m ? NOTE[m[1]] + (+m[2] + 1) * 12 : null; };
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function chordNotes(sym) {
    const m = sym.match(/^([A-G][#b]?)(m?)(maj7|7)?$/);
    const root = NOTE[m[1]] + 48;
    const third = m[2] ? 3 : 4, seventh = m[3] === 'maj7' ? 11 : m[3] === '7' ? 10 : null;
    const out = [root, root + third, root + 7];
    if (seventh !== null) out.push(root + seventh);
    return out.map(n => n > 59 ? n - 12 : n);
  }
  /* parse every theme once */
  const parsed = {};
  for (const k of Object.keys(THEMES)) {
    const T = THEMES[k];
    const bars = T.mel.split('|').map(b => b.trim().split(/\s+/).map(tok => { const [n, d] = tok.split(':'); return { n: n === 'r' ? null : midiOf(n), d: +d }; }));
    parsed[k] = Object.assign({}, T, { bars, chordList: T.chords.split(' ').map(chordNotes) });
  }

  let A = null, cur = null, want = 'meadow', wantT = 0, gains = {}, bar = 0, nextBar = 0, loop = 0, muffle = null;

  function ensure() {
    if (!AudioFX.ready || A) return !!A;
    A = AudioFX.ctx;
    muffle = A.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 18000;
    muffle.connect(AudioFX.music);
    return true;
  }
  function gainFor(k) {
    if (!gains[k]) { const g = A.createGain(); g.gain.value = 0; g.connect(parsed[k].muffle ? muffle : AudioFX.music); gains[k] = g; }
    return gains[k];
  }

  /* ---------- instruments ---------- */
  function env(g, t, a, peak, d, sustain = 0) {
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (sustain > 0) g.gain.setValueAtTime(peak, t + a + sustain);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + sustain + d);
  }
  function osc(type, f, t, dur, dest, detune = 0) { const o = A.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(t + dur + .05); return o; }
  function play(inst, n, t, dur, vol, out) {
    const f = hz(n), g = A.createGain(); g.connect(out);
    switch (inst) {
      case 'box': { osc('triangle', f, t, 1.4, g); const g2 = A.createGain(); g2.connect(out); osc('sine', f * 4, t, .4, g2); env(g, t, .006, vol, 1.3); env(g2, t, .004, vol * .22, .35); g.connect(AudioFX.delay); break; }
      case 'harp': { const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(g); osc('triangle', f, t, 1.3, lp); env(g, t, .004, vol, 1.2); g.connect(AudioFX.delay); break; }
      case 'pluck': { osc('triangle', f, t, .5, g); env(g, t, .005, vol, .42); break; }
      case 'bells': case 'celesta': {
        osc('sine', f, t, 2.2, g); const g2 = A.createGain(); g2.connect(out); osc('sine', f * (inst === 'bells' ? 2.76 : 4), t, 1, g2);
        env(g, t, .004, vol, inst === 'bells' ? 2 : 1.4); env(g2, t, .003, vol * .3, .8); g.connect(AudioFX.delay); break; }
      case 'marimba': { osc('sine', f, t, .7, g); const g2 = A.createGain(); g2.connect(out); osc('sine', f * 4, t, .15, g2); env(g, t, .004, vol, .6); env(g2, t, .002, vol * .35, .1); break; }
      case 'flute': {
        const o = osc('sine', f, t, dur + .3, g); const o2 = osc('triangle', f, t, dur + .3, g, 4);
        const lfo = A.createOscillator(); lfo.frequency.value = 5.2; const lg = A.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .006, t + .25); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency); lfo.start(t); lfo.stop(t + dur + .35);
        env(g, t, .07, vol * .75, .25, Math.max(.05, dur - .15)); g.connect(AudioFX.delay); break; }
      case 'horn': { const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1800, t + .08); lp.connect(g); osc('sawtooth', f, t, dur + .3, lp); osc('sawtooth', f, t, dur + .3, lp, 7); env(g, t, .05, vol * .45, .25, Math.max(.05, dur - .1)); break; }
      case 'lead': { const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(g); osc('square', f, t, dur + .2, lp); env(g, t, .01, vol * .32, .15, Math.max(.03, dur * .6)); break; }
      case 'pad': { const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(g); osc('triangle', f, t, dur + .6, lp, -6); osc('sine', f, t, dur + .6, lp, 6); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .35); g.gain.linearRampToValueAtTime(.0001, t + dur + .5); break; }
      case 'bass': { osc('sine', f, t, dur + .1, g); osc('triangle', f, t, dur + .1, g); env(g, t, .01, vol, Math.min(.6, dur)); break; }
    }
  }
  function drum(kind, t, vol, out) {
    if (kind === 'kick') { const g = A.createGain(); g.connect(out); const o = A.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .14); o.connect(g); o.start(t); o.stop(t + .2); env(g, t, .004, vol, .16); return; }
    const src = A.createBufferSource(); src.buffer = AudioFX.noise; const f = A.createBiquadFilter(); const g = A.createGain();
    src.connect(f); f.connect(g); g.connect(out);
    if (kind === 'clap') { f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = .8; env(g, t, .003, vol, .14); }
    else if (kind === 'hat') { f.type = 'highpass'; f.frequency.value = 7000; env(g, t, .002, vol * .5, .05); }
    else if (kind === 'sleigh') { f.type = 'bandpass'; f.frequency.value = 6500; f.Q.value = 2; env(g, t, .002, vol * .6, .09); }
    else if (kind === 'shaker') { f.type = 'highpass'; f.frequency.value = 5000; env(g, t, .01, vol * .35, .06); }
    src.start(t, Math.random()); src.stop(t + .25);
  }

  /* ---------- one bar of a theme ---------- */
  function scheduleBar(k, t) {
    const T = parsed[k], out = gainFor(k);
    const beat = 60 / T.bpm, eighth = beat / 2, barLen = beat * T.beats;
    const i = bar % T.bars.length, chord = T.chordList[i % T.chordList.length];
    const alt = loop % 2 === 1;
    /* pad */
    if (T.pad) for (const n of chord) play('pad', n + 12, t, barLen, T.pad, out);
    /* bass */
    const root = chord[0] - 12, fifth = chord[2] - 12;
    if (T.bass === 'waltz') { play('bass', root, t, beat * .9, .12, out); play('pluck', chord[1] + 12, t + beat, beat * .6, .05, out); play('pluck', chord[2] + 12, t + beat * 2, beat * .6, .05, out); }
    else if (T.bass === 'slow') { play('bass', root, t, barLen * .9, .1, out); }
    else if (T.bass === 'march') { for (let b = 0; b < T.beats; b++) play('bass', b % 2 ? fifth : root, t + b * beat, beat * .8, .11, out); }
    else if (T.bass === 'bounce') { for (let e = 0; e < T.beats * 2; e++) play('bass', e % 2 ? root + 12 : root, t + e * eighth, eighth * .8, .1, out); }
    /* arpeggio */
    if (T.arp) {
      const notes = chord.concat([chord[0] + 12]).map(n => n + 12);
      const steps = T.beats * 2 * (T.arpFast ? 1 : 1);
      for (let e = 0; e < steps; e++) { const n = notes[(e % 2 ? notes.length - 1 - (e >> 1) % notes.length : (e >> 1) % notes.length)] ; play(T.arp, n + (alt && e % 4 === 3 ? 12 : 0), t + e * eighth, eighth, .035, out); }
    }
    /* melody */
    let at = 0;
    for (const nt of T.bars[i]) {
      if (nt.n !== null) play(alt ? T.lead2 : T.lead, nt.n + (alt && T.lead2 === T.lead ? 12 : 0), t + at * eighth, nt.d * eighth * .95, .075, out);
      at += nt.d;
    }
    /* drums */
    if (T.drums === 'party' || T.drums === 'race') {
      for (let b = 0; b < T.beats; b++) { drum('kick', t + b * beat, .22, out); if (b % 2) drum('clap', t + b * beat, .12, out); drum('hat', t + b * beat + eighth, .12, out); if (T.drums === 'race') drum('hat', t + b * beat, .08, out); }
    } else if (T.drums === 'soft') { drum('kick', t, .1, out); drum('kick', t + beat * 2, .08, out); for (let e = 0; e < T.beats * 2; e++) drum('shaker', t + e * eighth, .1, out); }
    else if (T.drums === 'sleigh') { for (let e = 0; e < T.beats * 2; e++) drum('sleigh', t + e * eighth, e % 2 ? .08 : .14, out); }
    return barLen;
  }

  /* which theme fits right now */
  function pickTheme(env) {
    if (env.race) return 'race';
    if (env.party) return 'party';
    if (env.underwater) return 'underwater';
    if (env.high > .5) return 'stars';
    if (env.clouds) return 'clouds';
    if (env.night > .6) return 'night';
    if (env.winter) return 'winter';
    if (env.home) return 'home';
    return env.zone && THEMES[env.zone] ? env.zone : 'meadow';
  }

  function update(env) {
    if (!ensure()) return;
    const now = A.currentTime;
    const k = pickTheme(env);
    if (k !== want) { want = k; wantT = now; }
    /* switch after the choice has held for a moment (no flip-flopping at borders) */
    const switchNow = !cur || (want !== cur && now - wantT > (want === 'race' || want === 'underwater' || want === 'party' ? .3 : 2.5));
    if (nextBar < now) nextBar = now + .08;
    if (switchNow && nextBar - now < .4) {
      if (cur) { const g = gainFor(cur); g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, .6); }
      cur = want; bar = 0; loop = 0;
      const g = gainFor(cur); g.gain.cancelScheduledValues(nextBar); g.gain.setValueAtTime(g.gain.value, nextBar); g.gain.linearRampToValueAtTime(1, nextBar + 1.2);
    }
    muffle.frequency.setTargetAtTime(env.underwater ? 900 : 18000, now, .3);
    while (cur && nextBar < now + .6) {
      const len = scheduleBar(cur, nextBar);
      nextBar += len; bar++;
      if (bar % parsed[cur].bars.length === 0) loop++;
    }
  }
  function current() { return cur; }
  return { update, current, pickTheme, themes: THEMES };
})();
