/* Alicorn Skies — offline cache.  Everything the game needs is a
   static file, so we cache the lot on install and serve from the
   cache first.  Bump VERSION when files change. */
const VERSION = 'alicorn-v5';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/core.js', './js/data.js', './js/world.js', './js/sprites.js', './js/particles.js', './js/critters.js',
  './js/quests.js', './js/cinematic.js', './js/foal.js', './js/player.js', './js/games.js', './js/race.js',
  './js/render.js', './js/postfx.js', './js/audio.js', './js/music.js', './js/grownups.js', './js/voice.js', './js/gamepad.js',
  './js/stickers.js', './js/journal.js', './js/save.js', './js/readlex.js', './js/reading.js', './js/map.js', './js/creator.js', './js/care.js',
  './js/paint.js', './js/studio.js', './js/print.js', './js/ui.js', './js/main.js',
  './fonts/fonts.css', './fonts/nunito-9abf3bd2.woff2', './fonts/nunito-ff573f56.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('alicorn-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => hit)));
});
