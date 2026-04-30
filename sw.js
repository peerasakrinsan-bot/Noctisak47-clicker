// ══ Service Worker — NOCTISAK47: OVERDRIVE RAMPAGE ══
// เปลี่ยน CACHE_NAME ทุกครั้งที่ deploy ใหม่ (ต้องตรงกับ CACHE_VER ใน index.html)
const CACHE_NAME = 'noctisak47-v4';

// Assets ที่ cache ไว้สำหรับ offline
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './default_bg.png',
  './one_bg.png',
  './play.png',
  './shop.png',
  './boss.png',
  './arena.png',
  './boxer.png',
  './boxer_hit1.png',
  './boxer_hit2.png',
  './boxer_hit3.png',
  './boxer_hit4.png',
  './boxer_icon.webp',
  './toei.png',
  './toei_hit1.png',
  './toei_hit2.png',
  './toei_hit3.png',
  './toei_hit4.png',
  './toei_icon.webp',
  './ak47.png',
  './gun.png',
  './weak.webp',
  './midas.webp',
  './47title.mp3',
  './ak47.mp3',
  './punch.mp3',
];

// ══ INSTALL — precache assets ══
self.addEventListener('install', event => {
  console.log('[SW] Install', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => {
      // activate ทันทีไม่รอ tab เก่าปิด
      self.skipWaiting();
    })
  );
});

// ══ ACTIVATE — ลบ cache เก่าทั้งหมด ══
self.addEventListener('activate', event => {
  console.log('[SW] Activate', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim()) // ควบคุม tab ทั้งหมดทันที
  );
});

// ══ FETCH — Network First สำหรับ HTML, Cache First สำหรับ assets ══
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ข้าม cross-origin requests (fonts, CDN)
  if (url.origin !== self.location.origin) return;

  // HTML → Network First (ให้ได้ version ล่าสุดเสมอ)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets → Cache First, fallback to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      });
    })
  );
});

// ══ MESSAGE — รับ SKIP_WAITING จาก index.html ══
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
