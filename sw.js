// ══ Service Worker — NOCTISAK47 ══
const CACHE = 'noctisak47-v5';

// ไฟล์ที่ cache ไว้สำหรับ offline
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './default_bg.png',
  './one_bg.png',
  './default_bg.webp',
  './one_bg.webp',
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
  './weak.webp',
  './midas.webp',
  './void_main.png',
  './best_main.png',
  './noobak47.png',
  './gun.png',
  './wp5.png',
  './47title.mp3',
  './ak47.mp3',
  './punch.mp3',
];

// ══ INSTALL — cache assets ══
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => {
        // ถ้า addAll ล้มเหลว (ไฟล์บางตัวไม่มี) → skip ไม่หยุด
        console.warn('[SW] addAll partial fail:', err);
        return self.skipWaiting();
      })
  );
});

// ══ ACTIVATE — ลบ cache เก่า ══
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ══ FETCH — Stale-While-Revalidate ══
// HTML → Network First (ได้ version ใหม่เสมอ)
// Assets → Cache First + update in background (ประหยัด bandwidth)
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // ข้าม non-GET และ cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // HTML → Network First
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Assets → Stale-While-Revalidate
  // ตอบจาก cache ทันที + fetch ใหม่ใน background
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(request).then(cached => {
        const fetchPromise = fetch(request).then(res => {
          if (res && res.status === 200) cache.put(request, res.clone());
          return res;
        }).catch(() => {});
        return cached || fetchPromise;
      })
    )
  );
});

// ══ MESSAGE — SKIP_WAITING ══
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
