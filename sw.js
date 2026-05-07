// NOCTISAK47: OVERDRIVE RAMPAGE — Service Worker v159
const CACHE_NAME = 'noctisak47-v159';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // Backgrounds
  './default_bg.png',
  './one_bg.png',
  './title_bg.png',
  './collect_bg.png',
  // Audio
  './47title.mp3',
  './fight1.mp3',
  './fight2.mp3',
  './fight3.mp3',
  './fight4.mp3',
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
  './oca_item.webp',
  './weak.webp',
  './void_main.png',
  './best_main.png',
  // Shop item icons
  './midas.webp',
  './daedalus.webp',
  './desolator.webp',
  './moonshard.webp',
  './aghanimscepter.webp',
  './octarinecore.webp',
  // Default boss skin
  './boxer.png',
  './boxer_hit1.png',
  './boxer_hit2.png',
  './boxer_hit3.png',
  './boxer_hit4.png',
  './boxer_icon.webp',
  // TOEI (ENIGMA) skin
  './toei.png',
  './toei_hit1.png',
  './toei_hit2.png',
  './toei_hit3.png',
  './toei_hit4.png',
  './toei_icon.webp',
  // TOEI BOXER skin
  './toei_boxer.png',
  './toei_boxer_hit1.png',
  './toei_boxer_hit2.png',
  './toei_boxer_hit3.png',
  './toei_boxer_hit4.png',
  './toei_boxer_icon.webp',
  // APOLOGIZE skin
  './apologize.png',
  './apologize_hit1.png',
  './apologize_hit2.png',
  './apologize_hit3.png',
  './apologize_hit4.png',
  './apologize_icon.webp',
  // RUKAWA skin
  './rukawa.png',
  './rukawa_hit1.png',
  './rukawa_hit2.png',
  './rukawa_hit3.png',
  './rukawa_hit4.png',
  './rukawa_icon.webp',
  // SUANG skin
  './suang.png',
  './suang_hit1.png',
  './suang_hit2.png',
  './suang_hit3.png',
  './suang_hit4.png',
  './suang_icon.webp',
  // ARTHUR MORGAN skin
  './morgan.png',
  './morgan_hit1.png',
  './morgan_hit2.png',
  './morgan_hit3.png',
  './morgan_hit4.png',
  './morgan_icon.webp',
  // STANDARD cards (18)
  './poring.png','./lunatic.png','./fabre.png','./condor.png','./pecopeco.png',
  './spore.png','./poporing.png','./drops.png','./stainer.png','./rocker.png',
  './caramel.png','./roda_frog.png','./metaller.png','./mandragora.png','./willow.png',
  './hornet.png','./thief_bug.png','./mastering.png',
  // PREMIUM cards (18)
  './zombie.png','./savage.png','./orc.png','./mummy.png','./skel_worker.png',
  './hunter_fly.png','./elder_willow.png','./sting.png','./nightmare.png',
  './zenorc.png','./horong.png','./raydric.png',
  './greatest_general.png','./jakk.png','./marina.png',
  './demon_pungus.png','./vitata.png','./alligator.png',
  // ELITE cards (16)
  './doppelganger.png','./hydra.png','./phreeoni.png','./turtle_general.png',
  './drake.png','./tao_gunka.png','./dracula.png','./incantation_samurai.png',
  './stormy_knight.png','./dark_lord.png','./moonlight_flower.png',
  './minorous.png','./executioner.png','./whisper.png','./goblin_leader.png','./amon_ra.png',
  // SFX
  './ak47.mp3',
  './punch.mp3',
  './wpball.mp3',
  './wp1.mp3','./wp2.mp3','./wp3.mp3','./wp4.mp3','./wp5.mp3',
  './wk1.mp3','./wk2.mp3','./wk3.mp3','./wk4.mp3','./wk5.mp3',
  // MYTHIC cards (12)
  './thanatos.png','./baphomet.png','./eddga.png','./osiris.png',
  './mistress.png','./golden_bug.png','./orc_hero.png','./lord_of_death.png',
  './ktullanux.png','./beelzebub.png','./valkyrie_randgris.png','./rsx_0806.png',
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

  if (isHTML) {
    // Network-first สำหรับ HTML — ได้ version ใหม่เสมอ ถ้า offline ใช้ cache
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first สำหรับ assets อื่น (รูป เสียง ฯลฯ)
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
