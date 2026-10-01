/* Frog Pond — offline cache.  Everything the game needs is a
   static file, so we cache the lot on install and serve from the
   cache first.  Bump VERSION when files change. */
const VERSION = 'frogpond-v7';
const FILES = [
  './', './index.html', './hub.html', './hunt.html', './manifest.webmanifest', './css/style.css',
  './js/core.js', './js/facts.js', './js/pond.js', './js/sprites.js', './js/sprites2.js', './js/neighbours.js', './js/hazards.js', './js/places.js', './js/events.js', './js/tilt.js', './js/guide.js', './js/story.js', './js/rhythm.js', './js/safari.js', './js/keeper.js', './js/grownups.js', './js/readlex.js', './js/listen.js', './js/reading.js', './js/particles.js', './js/critters.js',
  './js/wildlife.js', './js/cinematic.js', './js/player.js', './js/render.js', './js/audio.js',
  './js/voice.js', './js/gamepad.js', './js/stickers.js', './js/journal.js', './js/microscope.js', './js/save.js',
  './js/ui.js', './js/main.js', './fonts/fonts.css', './fonts/atkinson-hyperlegible-076f8fd3.woff2', './fonts/atkinson-hyperlegible-2cb978b7.woff2', './fonts/atkinson-hyperlegible-386222c8.woff2', './fonts/atkinson-hyperlegible-a0b5f6f0.woff2', './fonts/nunito-9abf3bd2.woff2', './fonts/nunito-ff573f56.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('frogpond-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => hit)));
});
