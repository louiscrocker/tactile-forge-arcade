/* ============================================================
   cards.js — the card book
   ============================================================
   Two kinds of trading card, kept across lives in the browser
   (key `stag.cards`): every rival of the Antler Ring, and the stag
   beetles of the world.  You earn a rival's card by beating him or
   slipping past him.  Cousin cards come along with the story.
   ============================================================ */
'use strict';

const Cards = (function () {
  const KEY = 'stag.cards';
  let got = new Set(), onNew = null;
  const known = (k) => RIVALS.some(r => r.key === k) || COUSINS.some(c => c.key === k);
  function load() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(a)) got = new Set(a.filter(k => typeof k === 'string' && known(k))); } catch (e) { got = new Set(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify([...got])); } catch (e) { /* private mode */ } }
  function give(k) { if (!known(k) || got.has(k)) return false; got.add(k); save(); if (onNew) onNew(lookup(k)); return true; }
  function lookup(k) { const r = RIVALS.find(q => q.key === k); return r ? Object.assign({ rival: true, where: 'The Antler Branch', latin: 'Lucanus cervus' }, r) : COUSINS.find(q => q.key === k); }
  /* one new cousin for each thing done: the order they arrive in */
  const COUSIN_ORDER = ['stag', 'lesser', 'rhino', 'pinch', 'giraffe', 'rainbow', 'golden', 'darwin', 'hercules'];
  function nextCousin() { const k = COUSIN_ORDER.find(q => !got.has(q)); if (k) give(k); }
  function init(cb) {
    onNew = cb; load();
    Bus.on('card', (k) => { give(k); });
    /* each year done and each evening finished finds another cousin */
    Bus.on('yearDone', nextCousin);
    Bus.on('evening', nextCousin);
    Bus.on('generationDone', nextCousin);
  }
  return { init, give, has: (k) => got.has(k), count: () => got.size, total: () => RIVALS.length + COUSINS.length, lookup, list: () => [...COUSINS.map(c => c.key), ...RIVALS.map(r => r.key)] };
})();
