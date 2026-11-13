/* ============================================================
   cards.js — the card book
   ============================================================
   Two kinds of trading card, kept across lives in the browser
   (key `widow.cards`): everyone who came to look at your web, and
   the widow spiders of the world.  You earn a visitor's card when
   it loses interest and goes away.  Cousin cards come along with
   the story: one for each moult and each night.
   ============================================================ */
'use strict';

const Cards = (function () {
  const KEY = 'widow.cards';
  let got = new Set(), onNew = null;
  const known = (k) => VISITORS.some(r => r.key === k) || COUSINS.some(c => c.key === k);
  function load() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(a)) got = new Set(a.filter(k => typeof k === 'string' && known(k))); } catch (e) { got = new Set(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify([...got])); } catch (e) { /* private mode */ } }
  function give(k) { if (!known(k) || got.has(k)) return false; got.add(k); save(); if (onNew) onNew(lookup(k)); return true; }
  function lookup(k) { const r = VISITORS.find(q => q.key === k); return r ? Object.assign({ visitor: true }, r) : COUSINS.find(q => q.key === k); }
  /* one new cousin for each thing done: the order they arrive in */
  const COUSIN_ORDER = ['western', 'false', 'southern', 'brown', 'northern', 'redback', 'med', 'katipo'];
  function nextCousin() { const k = COUSIN_ORDER.find(q => !got.has(q)); if (k) give(k); }
  function init(cb) {
    onNew = cb; load();
    Bus.on('card', (k) => { give(k); });
    Bus.on('molted', nextCousin);
    Bus.on('dusk', (p, n) => { if (n > 1) nextCousin(); });
    Bus.on('generationDone', nextCousin);
    for (const v of VISITORS) Bus.on(v.key + 'Gone', () => give(v.key));
  }
  return { init, give, has: (k) => got.has(k), count: () => got.size, total: () => VISITORS.length + COUSINS.length, lookup, list: () => [...COUSINS.map(c => c.key), ...VISITORS.map(r => r.key)] };
})();
