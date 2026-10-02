/* ============================================================
   corner.js — the grown-up corner and the certificate
   ============================================================
   Time played (per child), what has been learned, which facts
   were read, tips for talking about it, and a printable
   "Pond Scientist" certificate with the child's name on it.
   ============================================================ */
'use strict';

const GrownupCorner = (function () {
  const $ = (id) => document.getElementById(id);
  let Gm = null, stats = { seconds: 0, sessions: 0, first: Date.now() }, clock = 0;
  const load = () => { try { stats = Object.assign(stats, JSON.parse(localStorage.getItem(pkey('playtime')) || '{}')); } catch (e) { /* fine */ } };
  const save = () => { try { localStorage.setItem(pkey('playtime'), JSON.stringify(stats)); } catch (e) { /* fine */ } };

  function init(game) {
    Gm = game; load(); stats.sessions++; save();
    if (!$('grownup')) return;
    $('grownupClose').addEventListener('click', () => { $('grownup').hidden = true; });
    $('certPrint').addEventListener('click', () => { fillCertificate(); document.body.classList.add('print-cert'); window.print(); setTimeout(() => document.body.classList.remove('print-cert'), 500); });
    $('childName').addEventListener('change', (e) => { Profile.rename(e.target.value.trim()); fillCertificate(); });
  }
  function tick(dt) { if (!Gm || !Gm.started) return; stats.seconds += dt; clock -= dt; if (clock <= 0) { clock = 20; save(); } }
  const mins = (s) => s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;

  function facts() { return Journal.entries().filter(e => e.type === 'fact'); }
  function open() {
    const st = Stickers.stats;
    const rows = [
      ['Time playing', mins(stats.seconds)],
      ['Times played', stats.sessions],
      ['Generations raised', Gm.generation],
      ['Stickers', `${Stickers.count()} / ${STICKERS.length}`],
      ['Field guide', `${FieldGuide.count()} / ${FieldGuide.total()}`],
      ['Story chapters read', `${Story.count()} / ${CHAPTERS.length}`],
      ['Facts read', facts().length],
      ['Places visited', `${st.places || 1} / 5`],
      ['Photo safari', `${Safari.count()} / ${SAFARI.length} (${Safari.stars()} ★)`],
      ['Voice lines recorded', VoiceClips.count()],
      ['Reading level', Reading.level() + (Gm.settings.readMode === 'play' ? ' (reading to play)' : ' (read to me)')]
    ];
    $('grownupStats').innerHTML = rows.map(([k, v]) => `<div class="gstat"><span>${k}</span><b>${v}</b></div>`).join('');
    const fl = facts().slice(-40).reverse();
    $('grownupFacts').innerHTML = fl.length ? fl.map(f => `<li><b>${esc(f.title)}</b> <span>${esc(f.body)}</span></li>`).join('') : '<li>No fact cards finished yet. Tap “Got it!” on a fact card to count it.</li>';
    $('childName').value = Profile.name;
    const r = Reading.report();
    $('readReport').innerHTML = `<div><b>Mode:</b> ${r.mode === 'play' ? 'I read to play' : 'Read to me'} · <b>Level:</b> ${r.level}${Gm.settings.readAuto ? ' (auto)' : ''}</div>
      <div><b>Without help, lately:</b> ${r.accuracy === null ? 'not enough reading yet' : Math.round(r.accuracy * 100) + '%'} · <b>Pages:</b> ${r.pages} · <b>Missions:</b> ${r.missions} · <b>Word cards:</b> ${r.cards}</div>
      <div><b>Suggestion:</b> ${r.suggest}</div>
      <div><b>Words known (${r.known.length} of ${r.met}):</b></div><div class="words">${r.known.slice(0, 60).map(w => `<span>${w}</span>`).join('') || '—'}</div>
      <div><b>Tricky words to practise:</b></div><div class="words">${r.tricky.slice(0, 30).map(w => `<span>${w}</span>`).join('') || '—'}</div>`;
    const recs = Reading.records().reverse();
    const box = $('readRecords'); box.innerHTML = '';
    if (!recs.length) box.innerHTML = '<p class="tiny">Switch on "Microphone on while I read" in settings. Each page read out loud will be listed here with how many words were heard, how fast, and what needed help.</p>';
    for (const r of recs) {
      const row = document.createElement('div'); row.className = 'rrow';
      const d = new Date(r.when);
      row.innerHTML = `<span class="rdate">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><b>${esc(r.key)}</b><span>Level ${r.level}</span><span class="${r.acc >= .9 ? 'good' : r.acc >= .75 ? 'ok' : 'low'}">${r.mic ? Math.round(r.acc * 100) + '% heard' : 'mic off'}</span><span>${r.mic ? r.wpm + ' words/min' : ''}</span><span>${r.helped ? r.helped + ' helped' : 'no help'}</span><span class="missed">${r.missed && r.missed.length && r.mic ? 'not heard: ' + r.missed.map(esc).join(', ') : ''}</span>`;
      if (r.take) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = '▶ Listen'; b.addEventListener('click', () => Reading.playTake(r.take)); row.appendChild(b); }
      box.appendChild(row);
    }
    fillCertificate();
    $('grownup').hidden = false;
  }
  function fillCertificate() {
    const name = Profile.name || 'Pond Explorer';
    $('certName').textContent = name;
    $('certDate').textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    $('certDetail').textContent = `raised ${Gm.generation} generation${Gm.generation > 1 ? 's' : ''} of frogs, found ${FieldGuide.count()} pond creatures, earned ${Stickers.count()} stickers and read ${facts().length} science facts.`;
    const c = $('certFrog'), ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    ctx.save(); ctx.translate(c.width / 2, c.height / 2 + 20); Sprites.drawLilyPad(ctx, { r: 90, bloom: 1, hue: .3, notch: .7 }); ctx.translate(0, -18); Sprites.drawFrog(ctx, { s: 2.6, species: Gm.speciesDef(), pose: 'sit' }); ctx.restore();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  return { init, open, tick, seconds: () => stats.seconds };
})();
