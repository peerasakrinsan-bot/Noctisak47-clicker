// NOCTISAK47: OVERDRIVE RAMPAGE — Service Worker 2026.06.07.1
const APP_VERSION = '2026.07.01.4';
const CACHE_NAME = 'noctisak47-' + APP_VERSION;

// Precache = first-run / default-offline experience only. Heavy progressive
// content (purchasable boss skins, alt fight tracks) is intentionally NOT
// precached: the fetch handler below caches images/audio cache-first on first
// use, so they persist offline after being seen once without forcing a ~70MB
// download on the very first visit. Card artwork (public/cards/*) was never in
// this list and likewise streams in on demand.
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // Backgrounds (menu + the default arena only).
  // Purchasable arenas (ONE Championship / Colosseum) are NOT precached — their
  // backgrounds cache on demand via the cache-first fetch handler when the arena
  // is previewed/equipped, mirroring the boss-skin policy. Keeps install ~1.8MB lighter.
  './default_bg.png',
  './title_bg.png',
  './collect_bg.png',
  // Audio — title + first fight track (extra tracks load on demand)
  './47title.mp3',
  './fight1.mp3',
  './countdown.mp3',
  './collect.mp3',
  // UI images
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './apple-touch-icon-120x120.png',
  './apple-touch-icon-152x152.png',
  './apple-touch-icon-167x167.png',
  './apple-touch-icon-180x180.png',
  './play.png',
  './shop.png',
  './transfer.png',
  './boss.png',
  './arena.png',
  './pause.png',
  './ak47.png',
  './noobak47.png',
  './wp5.png',
  './sound_on.png',
  './sound_off.png',
  './card_back.png',
  './card.png',
  './card_hidden.png',
  './old-cringe-album.webp',
  './old-cringe-album-detail.webp',
  './oca_item.webp',
  './weak.webp',
  './void_main.png',
  './best_main.png',
  // Shop item icons
  './rngesus.webp',
  './de-so-later.webp',
  './methstone.webp',
  './buff-stick.webp',
  './time-skip-core.webp',
  './stonks-hand.webp',
  // Default boss skin (alt skins cache on demand when equipped)
  './boxer.png',
  './boxer_hit1.png',
  './boxer_hit2.png',
  './boxer_hit3.png',
  './boxer_hit4.png',
  './boxer_icon.webp',
  // SFX
  './ak47.mp3',
  './punch.mp3',
  './wpball.mp3',
  './wp1.mp3','./wp2.mp3','./wp3.mp3','./wp4.mp3','./wp5.mp3',
  './wk1.mp3','./wk2.mp3','./wk3.mp3','./wk4.mp3','./wk5.mp3',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(PRECACHE_ASSETS.map(asset => cache.add(asset))).then(results => {
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length) console.warn('[SW] precache partial fail:', failed);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(event.request.url);
  const isHTML = event.request.destination === 'document' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/' ||
                 url.pathname === '';
  const isCodeAsset = event.request.destination === 'script' ||
                      event.request.destination === 'style' ||
                      /\.(?:js|css|json)$/i.test(url.pathname) ||
                      url.pathname.endsWith('/manifest.json') ||
                      url.pathname.endsWith('/sw.js');

  if (isHTML || isCodeAsset) {
    // Network-first for HTML/code/manifest so deploys cannot be pinned forever by old cache.
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request).then(c => c || (isHTML ? caches.match('./index.html') : undefined)))
    );
    return;
  }

  // Cache-first for heavy immutable-ish media assets (images/audio).
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') return caches.match('./index.html');
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
