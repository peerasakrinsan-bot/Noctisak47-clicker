// NOCTISAK47: OVERDRIVE RAMPAGE — Service Worker v57
const CACHE_NAME = 'noctisak47-v101';

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
  './play.png',
  './shop.png',
  './boss.png',
  './arena.png',
  './pause.png',
  './ak47.png',
  './noobak47.png',
  './wp5.png',
  './sound_on.png',
  './sound_off.png',
  './card_back.png',
  './card_confirm.png',
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
  // SUANG skin
  './suang.png',
  './suang_hit1.png',
  './suang_hit2.png',
  './suang_hit3.png',
  './suang_hit4.png',
  './suang_icon.webp',
  // STANDARD cards (15)
  './poring.png',
  './lunatic.png',
  './fabre.png',
  './condor.png',
  './pecopeco.png',
  './spore.png',
  './poporing.png',
  './drops.png',
  './stainer.png',
  './rocker.png',
  './caramel.png',
  './roda_frog.png',
  './metaller.png',
  './mandragora.png',
  './willow.png',
  // PREMIUM cards (12)
  './zombie.png',
  './savage.png',
  './orc.png',
  './mummy.png',
  './skel_worker.png',
  './hunter_fly.png',
  './elder_willow.png',
  './sting.png',
  './nightmare.png',
  './zenorc.png',
  './horong.png',
  './raydric.png',
  // ELITE cards (11)
  './doppelganger.png',
  './hydra.png',
  './phreeoni.png',
  './turtle_general.png',
  './drake.png',
  './tao_gunka.png',
  './dracula.png',
  './incantation_samurai.png',
  './stormy_knight.png',
  './dark_lord.png',
  './moonlight_flower.png',
  // SFX
  './ak47.mp3',
  './punch.mp3',
  './wpball.mp3',
  './wp1.mp3','./wp2.mp3','./wp3.mp3','./wp4.mp3','./wp5.mp3',
  './wk1.mp3','./wk2.mp3','./wk3.mp3','./wk4.mp3','./wk5.mp3',
  // MYTHIC cards (8)
  './thanatos.png',
  './baphomet.png',
  './eddga.png',
  './osiris.png',
  './mistress.png',
  './golden_bug.png',
  './orc_hero.png',
  './lord_of_death.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] precache partial fail:', err);
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
