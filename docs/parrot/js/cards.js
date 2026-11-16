/* ============================================================
   cards.js — the card book
   ============================================================
   Two kinds of trading card, kept across lives in the browser
   (key `parrot.cards`): everyone who came by, and
   the parrots of the world.  You earn a visitor's card when
   it loses interest and goes away.  Cousin cards come along with
   the story: one for each thing you learn.
   ============================================================ */
'use strict';

const Cards = (function () {
  const KEY = 'parrot.cards';
  let got = new Set(), onNew = null;
  const known = (k) => VISITORS.some(r => r.key === k) || COUSINS.some(c => c.key === k);
  function load() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(a)) got = new Set(a.filter(k => typeof k === 'string' && known(k))); } catch (e) { got = new Set(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify([...got])); } catch (e) { /* private mode */ } }
  function give(k) { if (!known(k) || got.has(k)) return false; got.add(k); save(); if (onNew) onNew(lookup(k)); return true; }
  function lookup(k) { const r = VISITORS.find(q => q.key === k); return r ? Object.assign({ visitor: true }, r) : COUSINS.find(q => q.key === k); }
  /* one new cousin for each thing done: the order they arrive in */
  const COUSIN_ORDER = ['hyacinth', 'grey', 'cockatoo', 'budgie', 'kea', 'kakapo', 'blueyellow', 'redgreen', 'mealy', 'scarlet'];
  function nextCousin() { const k = COUSIN_ORDER.find(q => !got.has(q)); if (k) give(k); }
  function init(cb) {
    onNew = cb; load();
    Bus.on('card', (k) => { give(k); });
    Bus.on('lessonDone', nextCousin); Bus.on('grew', nextCousin); Bus.on('paired', nextCousin); Bus.on('laid', nextCousin);
    Bus.on('dusk', (p, n) => { if (n > 1) nextCousin(); });
    Bus.on('generationDone', nextCousin);
    for (const v of VISITORS) Bus.on(v.key + 'Gone', () => give(v.key));
  }
  return { init, give, has: (k) => got.has(k), count: () => got.size, total: () => VISITORS.length + COUSINS.length, lookup, list: () => [...COUSINS.map(c => c.key), ...VISITORS.map(r => r.key)] };
})();
