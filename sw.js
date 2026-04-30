// NOCTISAK47 Service Worker — Cache-first PWA
const CACHE = 'noctisak47-v1';

// ไฟล์ทั้งหมดที่ต้อง cache
const ASSETS = [
  './',
  './index.html',
  // images
  './logo.png',
  './bg.jpg',
  './play.png',
  './shop.png',
  './boss.png',
  './pause.png',
  './void_main.png',
  './best_main.png',
  './ak47.png',
  './noobak47.png',
  './wp5.png',
  './weak.webp',
  './blood.webp',
  './bloodshot.png',
  // shop icons
  './daedalus.webp',
  './desolator.webp',
  './moonshard.webp',
  './aghanimscepter.webp',
  './octarinecore.webp',
  './midas.webp',
  './boxer_icon.webp',
  './toei_icon.webp',
  // boxer skins
  './boxer.png',
  './boxer_hit1.png',
  './boxer_hit2.png',
  './boxer_hit3.png',
  './boxer_hit4.png',
  './toei.png',
  './toei_hit1.png',
  './toei_hit2.png',
  './toei_hit3.png',
  './toei_hit4.png',
  // audio SFX
  './ak47.mp3',
  './punch.mp3',
  './wpball.mp3',
  './wp1.mp3',
  './wp2.mp3',
  './wp3.mp3',
  './wp4.mp3',
  './wp5.mp3',
  './wk1.mp3',
  './wk2.mp3',
  './wk3.mp3',
  './wk4.mp3',
  './wk5.mp3',
  // audio BGM
  './47title.mp3',
  './fight1.mp3',
  './fight2.mp3',
  './fight3.mp3',
  './fight4.mp3',
];

// ── Install: cache ทุกไฟล์ ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // cache ทีละไฟล์ ถ้าไฟล์ไหนหายก็ข้ามไป ไม่ให้ install fail
      return Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(() => {
            console.warn('[SW] Failed to cache:', url);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: ลบ cache เก่าออก ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first, fallback to network ──
self.addEventListener('fetch', e => {
  // ข้าม non-GET และ external requests
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      // ไม่มีใน cache → fetch จาก network แล้ว cache ไว้
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => {
        // offline + ไม่มี cache → ส่ง fallback
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
