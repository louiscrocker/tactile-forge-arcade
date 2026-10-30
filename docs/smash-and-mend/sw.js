/* Mungo & Pip: Smash and Mend — offline cache.  Everything the game
   needs is a static file, so cache the lot on install and serve from
   the cache first.  Bump VERSION when files change. */
const VERSION = 'smash-v2';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/core.js','./js/levels.js','./js/paint.js','./js/gfx.js','./js/game.js','./js/smash.js','./js/mend.js','./js/step.js','./js/bot.js','./js/sprites.js','./js/chars.js','./js/scene.js','./js/scene2.js','./js/particles.js','./js/cinematic.js','./js/render.js','./js/mapview.js','./js/audio.js','./js/grownups.js','./js/voice.js','./js/gamepad.js','./js/save.js','./js/input.js','./js/ui.js','./js/director.js','./js/main.js','./js/boot.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './fonts/fonts.css', './fonts/nunito-9abf3bd2.woff2', './fonts/nunito-ff573f56.woff2'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('smash-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => hit)));
});
