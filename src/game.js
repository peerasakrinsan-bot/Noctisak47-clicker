// ── NOCTISAK47: OVERDRIVE RAMPAGE — game module (Stage 2A) ──────────────────
// ยกโค้ดเกมทั้งหมด (เดิม classic inline <script> 2 บล็อก: เกมหลัก + Card Mastery)
// มาเป็น ES module เดียวแบบ verbatim — ไม่แก้ logic. โหลดผ่าน src/main.js.
// inline onclick= ใน index.html ยังเรียกฟังก์ชันแบบ global ได้ผ่าน window bridge ท้ายไฟล์.

// ════════════════════ MAIN GAME (เดิม inline block #2) ════════════════════
// ── shorthand $ — ต้องอยู่ก่อนทุกอย่างที่ใช้ $ ──
const $ = id => document.getElementById(id);

// ── ป้องกัน pinch-zoom / double-tap zoom ทั้งหมด ──
document.addEventListener('gesturestart',  e => e.preventDefault(), {passive:false});
document.addEventListener('gesturechange', e => e.preventDefault(), {passive:false});
document.addEventListener('gestureend',    e => e.preventDefault(), {passive:false});
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault(); // pinch only
}, {passive:false});

// FIX 1E — prevent full-page pan except inside scrollable screens
document.addEventListener('touchmove', e => {
  // Allow native touch-scroll inside the card ability-description boxes:
  //  • .card-detail-description-scroll — the Card Collection detail modal
  //    (#cardModal is a top-level overlay, not a child of cardCollectionScreen)
  //  • .reveal-description-scroll      — the draw/reveal result card detail
  //    (#cardDrawScreen is not in the whitelist below either)
  // Without this guard the blanket preventDefault() cancels the scroll before the
  // browser can pan the long Elite/Mythic descriptions. Cosmetic-only.
  if (e.target && e.target.closest &&
      e.target.closest('.card-detail-description-scroll, .reveal-description-scroll')) return;
  const scrollable = ['mainMenu','shopScreen','bossScreen','arenaScreen','cardCollectionScreen','blhRoot'];
  for (const id of scrollable) {
    const el = $(id);
    if (el && el.style.display === 'flex' && el.contains(e.target)) return;
  }
  e.preventDefault();
}, { passive: false });

// double-tap zoom: ป้องกันเฉพาะนอก tapZone
// tapZone ใช้ touchstart + preventDefault อยู่แล้ว จึงไม่ trigger zoom
let _lastTap = 0;
document.addEventListener('touchend', e => {
  // ถ้า target เป็น tapZone หรือ weakPoint → ปล่อยผ่าน (จัดการใน hit() แล้ว)
  const tgt = e.target;
  if(tgt && (tgt.id === 'tapZone' || tgt.id === 'weakPoint')) return;
  const now = Date.now();
  if (now - _lastTap < 300) e.preventDefault();
  _lastTap = now;
}, {passive:false});

// ── Number formatter (ป้องกัน overflow ใน UI) ──
function formatNum(n) {
  n = Number(n) || 0;
  if (n >= 1e9)  return (n/1e9).toFixed(n>=10e9?1:2).replace(/\.?0+$/,'')+'B';
  if (n >= 1e6)  return (n/1e6).toFixed(n>=10e6?1:2).replace(/\.?0+$/,'')+'M';
  if (n >= 1e3)  return (n/1e3).toFixed(n>=10e3?1:2).replace(/\.?0+$/,'')+'K';
  return n.toString();
}

// ════════════════════════════════════════════
//  SHOP DATA  — item มี levels
//  ราคาออกแบบให้:
//    รอบปกติได้ ~250 coin/รอบ (60 วินาที)
//    Lv1 = ~15-20 รอบ, Lv2 = ~50-70 รอบ, Lv3 = ~120-180 รอบ
//    Lv4 all = ~250 min (~4h) | Lv5 all = ~510 min (~8.5h)
// ════════════════════════════════════════════
const SHOP_DEF = [
  {
    id: 'oca',
    name: 'OLD CRINGE ALBUM',
    icon: '',
    tagline: 'สุ่มรับการ์ด 1 ใบ',
    _type: 'consumable',
    cost: 1500,
    dropWeights: { standard:65, premium:20, elite:13, mythic:2 },
  },
  {
    id: 'daedalus',
    name: 'RNGESUS',
    icon: 'SWD',
    tagline: 'โอกาสคริติคอล — ดาเมจพุ่ง',
    levels: [
      { lv:1, cost:250,  desc:'คริติคอล <strong>15%</strong> : ดาเมจ x2',   effect:'crit_chance:0.15 crit_mult:2.0' },
      { lv:2, cost:1650, desc:'คริติคอล <strong>22%</strong> : ดาเมจ x2.5', effect:'crit_chance:0.22 crit_mult:2.5' },
      { lv:3, cost:3600, desc:'คริติคอล <strong>30%</strong> : ดาเมจ x3.2', effect:'crit_chance:0.30 crit_mult:3.2' },
      { lv:4, cost:6400, desc:'คริติคอล <strong>40%</strong> : ดาเมจ x4.0', effect:'crit_chance:0.40 crit_mult:4.0' },
      { lv:5, cost:12750,desc:'คริติคอล <strong>50%</strong> : ดาเมจ x5.0 <span class="css-max">MAX</span>', effect:'crit_chance:0.50 crit_mult:5.0' },
    ]
  },
  {
    id: 'desolator',
    name: 'DE-SO-LATER',
    icon: '🗡️',
    tagline: 'เพิ่มดาเมจพื้นฐานทุกตี',
    levels: [
      { lv:1, cost:200,  desc:'ดาเมจทุกตี <strong>+20%</strong>',   effect:'dmg_bonus:0.2' },
      { lv:2, cost:1500, desc:'ดาเมจทุกตี <strong>+45%</strong>',   effect:'dmg_bonus:0.45' },
      { lv:3, cost:3200, desc:'ดาเมจทุกตี <strong>+80%</strong>',   effect:'dmg_bonus:0.80' },
      { lv:4, cost:6100, desc:'ดาเมจทุกตี <strong>+130%</strong>',  effect:'dmg_bonus:1.30' },
      { lv:5, cost:12000,desc:'ดาเมจทุกตี <strong>+200%</strong> <span class="css-max">MAX</span>', effect:'dmg_bonus:2.00' },
    ]
  },
  {
    id: 'moonshard',
    name: 'METH SHARD',
    icon: '🌙',
    tagline: 'โอกาสตีซ้ำในคลิกเดียว',
    levels: [
      { lv:1, cost:300,  desc:'<strong>15%</strong> โอกาสตี 2 ครั้ง/คลิก', effect:'double:0.15' },
      { lv:2, cost:1850, desc:'<strong>25%</strong> โอกาสตี 2 ครั้ง/คลิก', effect:'double:0.25' },
      { lv:3, cost:4000, desc:'<strong>35%</strong> โอกาสตี 3 ครั้ง/คลิก', effect:'double:0.35 triple:true' },
      { lv:4, cost:7200, desc:'<strong>50%</strong> โอกาสตี 3 ครั้ง/คลิก', effect:'double:0.50 triple:true' },
      { lv:5, cost:13500,desc:'<strong>65%</strong> โอกาสตี 3 ครั้ง/คลิก <span class="css-max">MAX</span>', effect:'double:0.65 triple:true' },
    ]
  },
  {
    id: 'aghanims',
    name: 'BUFF STICK',
    icon: '🔮',
    tagline: 'Overdrive ดาเมจทรงพลังขึ้น',
    levels: [
      { lv:1, cost:300,  desc:'Overdrive ดาเมจ <strong>+30%</strong>',   effect:'god_dmg:0.3' },
      { lv:2, cost:2000, desc:'Overdrive ดาเมจ <strong>+70%</strong>',   effect:'god_dmg:0.7' },
      { lv:3, cost:4400, desc:'Overdrive ดาเมจ <strong>+120%</strong>',  effect:'god_dmg:1.2' },
      { lv:4, cost:8000, desc:'Overdrive ดาเมจ <strong>+180%</strong>',  effect:'god_dmg:1.8' },
      { lv:5, cost:15000,desc:'Overdrive ดาเมจ <strong>+250%</strong> <span class="css-max">MAX</span>', effect:'god_dmg:2.5' },
    ]
  },
  {
    id: 'octarine',
    name: 'TIME SKIP CORE',
    icon: '💎',
    tagline: 'Overdrive อยู่นานขึ้น',
    levels: [
      { lv:1, cost:260,  desc:'Overdrive นาน <strong>+3 วินาที</strong>',   effect:'god_dur:3' },
      { lv:2, cost:1750, desc:'Overdrive นาน <strong>+6 วินาที</strong>',   effect:'god_dur:6' },
      { lv:3, cost:3800, desc:'Overdrive นาน <strong>+10 วินาที</strong>',  effect:'god_dur:10' },
      { lv:4, cost:6700, desc:'Overdrive นาน <strong>+15 วินาที</strong>',  effect:'god_dur:15' },
      { lv:5, cost:13200,desc:'Overdrive นาน <strong>+22 วินาที</strong> <span class="css-max">MAX</span>', effect:'god_dur:22' },
    ]
  },
  {
    id: 'midas',
    name: 'STONKS HAND',
    icon: 'GOLD',
    tagline: 'สัมผัสทองคำ — coin ที่ได้เพิ่มขึ้นทุกแหล่ง',
    levels: [
      { lv:1, cost:500,  desc:'Coin ทุกแหล่ง <strong>+15%</strong>',   effect:'coin_mult:0.15' },
      { lv:2, cost:2500, desc:'Coin ทุกแหล่ง <strong>+30%</strong>',   effect:'coin_mult:0.30' },
      { lv:3, cost:4500, desc:'Coin ทุกแหล่ง <strong>+45%</strong>',   effect:'coin_mult:0.45' },
      { lv:4, cost:7500, desc:'Coin ทุกแหล่ง <strong>+60%</strong>',   effect:'coin_mult:0.60' },
      { lv:5, cost:11500,desc:'Coin ทุกแหล่ง <strong>+75%</strong>', effect:'coin_mult:0.75' },
    ]
  },
];

const ITEM_IMGS = {
  oca:       'old-cringe-album.webp',
  daedalus:  'rngesus.webp',
  desolator: 'de-so-later.webp',
  moonshard: 'methstone.webp',
  aghanims:  'buff-stick.webp',
  octarine:  'time-skip-core.webp',
  midas:     'stonks-hand.webp',
};

const CARD_HIDDEN_IMG = 'card_hidden.png';

// ══════════════════════════════════════════
// SOUND SYSTEM
// ══════════════════════════════════════════
const DEFAULT_SETTINGS = { musicOn:true, musicVolume:1, sfxOn:true, sfxVolume:1, reduceFlash:true, flashEffect:'low' };
function _clamp01(v) { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; }
function normalizeSettings(src) {
  src = (src && typeof src === 'object') ? src : {};
  const fe = src.flashEffect;
  return {
    musicOn: src.musicOn !== false,
    musicVolume: _clamp01(src.musicVolume === undefined ? 1 : src.musicVolume),
    sfxOn: src.sfxOn !== false,
    sfxVolume: _clamp01(src.sfxVolume === undefined ? 1 : src.sfxVolume),
    // Soft visual effects are now the default style for every player.
    // Keep the flag internal/always true so old saves with reduceFlash:false
    // cannot re-enable harsher flashes or heavier shake.
    reduceFlash: true,
    flashEffect: (fe === 'on' || fe === 'low' || fe === 'off') ? fe : 'low',
  };
}
function _loadLocalSettings() {
  let base = Object.assign({}, DEFAULT_SETTINGS);
  try {
    const legacySound = localStorage.getItem('noctis_sound');
    if (legacySound === 'off') { base.musicOn = false; base.sfxOn = false; }
    const raw = localStorage.getItem('noctis_settings');
    if (raw) base = Object.assign(base, JSON.parse(raw));
  } catch(e) {}
  return normalizeSettings(base);
}
let gameSettings = _loadLocalSettings();
let soundEnabled = gameSettings.musicOn || gameSettings.sfxOn; // legacy compatibility flag
// DOMContentLoaded removed — settings UI sync called inline after load

// volume ของแต่ละ channel (0–1)
const VOL = {
  ak:0.15, punch:0.72,
  wp1:0.80,wp2:0.85,wp3:0.88,wp4:0.92,wp5:1.0,
  wk1:0.90,wk2:0.92,wk3:0.95,wk4:0.97,wk5:1.0,
  wpball:1.0,
};

// เพิ่มเสียงเฉพาะ BGM ขึ้น 30% (SFX ยังใช้ VOL เดิม)
const BGM_VOLUME_BOOST = 1.3;
const TITLE_BGM_VOLUME = Math.min(1, 0.45 * BGM_VOLUME_BOOST);
const FIGHT_BGM_VOLUME = Math.min(1, 1.0 * BGM_VOLUME_BOOST);
const COLLECT_BGM_VOLUME = Math.min(1, 0.8 * BGM_VOLUME_BOOST);

// ── Web Audio Context (สร้างครั้งเดียว หลัง user gesture) ──
let _actx = null;
const _sfxBufs = {};  // cache decoded AudioBuffer

function _getActx() {
  if(_actx) return _actx;
  _actx = new (window.AudioContext || window.webkitAudioContext)();
  return _actx;
}

// โหลดและ decode ไฟล์เสียงเป็น AudioBuffer
async function _loadSfx(id, url) {
  if(_sfxBufs[id]) return;
  try {
    const r = await fetch(url);
    const ab = await r.arrayBuffer();
    _sfxBufs[id] = await _getActx().decodeAudioData(ab);
  } catch(e) {}
}

// เล่นเสียงจาก buffer — zero latency บน iOS
const _sfxSrc = {}; // เก็บ source node ล่าสุดของแต่ละ sfx id
const _sfxQueue = {}; // เก็บ queue สำหรับ sfx ที่มี max overlap

function _playSfx(id, vol, maxOverlap) {
  if(!gameSettings.sfxOn || !_actx || !_sfxBufs[id]) return;
  try {
    if(maxOverlap === false) {
      // ไม่ overlap เลย — stop เก่าก่อน
      if(_sfxSrc[id]) { try { _sfxSrc[id].stop(); } catch(e) {} _sfxSrc[id] = null; }
    } else if(typeof maxOverlap === 'number') {
      // จำกัด overlap — ถ้าเกิน limit ให้ stop ตัวเก่าสุดออก
      if(!_sfxQueue[id]) _sfxQueue[id] = [];
      if(_sfxQueue[id].length >= maxOverlap) {
        try { _sfxQueue[id].shift().stop(); } catch(e) {}
      }
    }
    const src = _actx.createBufferSource();
    src.buffer = _sfxBufs[id];
    const gain = _actx.createGain();
    gain.gain.value = Math.min(1, vol || 1) * gameSettings.sfxVolume;
    src.connect(gain);
    gain.connect(_actx.destination);
    src.start(0);
    if(maxOverlap === false) {
      _sfxSrc[id] = src;
      src.onended = () => { if(_sfxSrc[id] === src) _sfxSrc[id] = null; };
    } else if(typeof maxOverlap === 'number') {
      _sfxQueue[id].push(src);
      src.onended = () => {
        const q = _sfxQueue[id];
        if(q) { const i = q.indexOf(src); if(i >= 0) q.splice(i, 1); }
      };
    }
  } catch(e) {}
}

// SFX file map
const SFX_FILES = {
  ak:'ak47.mp3', punch:'punch.mp3', wpball:'wpball.mp3',
  wp1:'wp1.mp3',wp2:'wp2.mp3',wp3:'wp3.mp3',wp4:'wp4.mp3',wp5:'wp5.mp3',
  wk1:'wk1.mp3',wk2:'wk2.mp3',wk3:'wk3.mp3',wk4:'wk4.mp3',wk5:'wk5.mp3',
};

// unlock AudioContext + โหลด SFX ทั้งหมดหลัง user gesture ครั้งแรก
let audioWarmedUp = false;
function warmUpAudio() {
  if(audioWarmedUp) return;
  audioWarmedUp = true;
  const ctx = _getActx();
  // resume ถ้า suspended (iOS policy)
  if(ctx.state === 'suspended') ctx.resume();
  // โหลด SFX ทั้งหมด
  Object.entries(SFX_FILES).forEach(([id, url]) => _loadSfx(id, url));
  // เริ่มบัฟเฟอร์ collect.mp3 ล่วงหน้าผ่าน <audio> element ธรรมดา (เหมือน fight BGM) —
  // ไม่ decode เป็น AudioBuffer ค้างหน่วยความจำอีกต่อไป (เพลง ~39 วิ = PCM ~13MB ถ้า decode)
  const cbEl = $('collectBgm');
  if(cbEl && cbEl.preload === 'none') { cbEl.preload = 'auto'; cbEl.load(); }
}

function _musicGain(base) { return gameSettings.musicOn ? base * gameSettings.musicVolume : 0; }
function _sfxGain(base) { return gameSettings.sfxOn ? base * gameSettings.sfxVolume : 0; }

function applyAudioSettings() {
  soundEnabled = gameSettings.musicOn || gameSettings.sfxOn;
  const bgm = $('bgmSound'); if(bgm) bgm.volume = _musicGain(TITLE_BGM_VOLUME);
  [1,2,3,4].forEach(i=>{ const t=$('fightBgm'+i); if(t) t.volume = _musicGain(FIGHT_BGM_VOLUME); });
  const cd = $('countdownSound'); if(cd) cd.volume = _sfxGain(1.0);
  const cb = $('collectBgm'); if(cb) cb.volume = _musicGain(COLLECT_BGM_VOLUME);
  document.body.classList.toggle('reduce-flash', !!gameSettings.reduceFlash);
  applyFlashEffectSetting();
  syncSettingsUI();
}

function applyFlashEffectSetting() {
  const fe = gameSettings.flashEffect || 'low';
  document.body.classList.toggle('flash-low', fe === 'low');
  document.body.classList.toggle('flash-off', fe === 'off');
  // Premium card VFX collapse to a static look when effects are fully off
  document.body.classList.toggle('low-vfx', fe === 'off');
  // ── เชื่อม flashEffect → canvas VFX intensity ────────────────────────────
  if (typeof window !== 'undefined' && window.CanvasVFX && typeof window.CanvasVFX.setVFXLevel === 'function') {
    window.CanvasVFX.setVFXLevel(fe);
  }
}

function setFlashEffect(value) {
  if (value !== 'on' && value !== 'low' && value !== 'off') return;
  gameSettings.flashEffect = value;
  applyFlashEffectSetting();
  syncSettingsUI();
  persistSettings();
}

function persistSettings() {
  gameSettings = normalizeSettings(gameSettings);
  try { localStorage.setItem('noctis_settings', JSON.stringify(gameSettings)); } catch(e) {}
  try { localStorage.setItem('noctis_sound', soundEnabled ? 'on' : 'off'); } catch(e) {}
  if (typeof save !== 'undefined' && save) {
    save.settings = gameSettings;
    markSaveDirty('settings_changed');
    doSave('settings');
    scheduleCloudSync('settings_changed');
  }
}

function syncSettingsUI() {
  const musicBtn = $('musicToggleBtn');
  if(musicBtn) { musicBtn.textContent = gameSettings.musicOn ? 'ON' : 'OFF'; musicBtn.classList.toggle('off', !gameSettings.musicOn); }
  const sfxBtn = $('sfxToggleBtn');
  if(sfxBtn) { sfxBtn.textContent = gameSettings.sfxOn ? 'ON' : 'OFF'; sfxBtn.classList.toggle('off', !gameSettings.sfxOn); }
  const flashBtn = $('reduceFlashToggleBtn');
  if(flashBtn) { flashBtn.textContent = 'ON'; flashBtn.classList.remove('off'); }
  const mv = $('musicVolumeSlider');
  if(mv) mv.value = Math.round(gameSettings.musicVolume * 100);
  const mvv = $('musicVolumeValue');
  if(mvv) mvv.textContent = Math.round(gameSettings.musicVolume * 100) + '%';
  const sv = $('sfxVolumeSlider');
  if(sv) sv.value = Math.round(gameSettings.sfxVolume * 100);
  const svv = $('sfxVolumeValue');
  if(svv) svv.textContent = Math.round(gameSettings.sfxVolume * 100) + '%';
  // Flash Effect segmented buttons
  const fe = gameSettings.flashEffect || 'low';
  const fsOn  = $('flashSegOn');
  const fsLow = $('flashSegLow');
  const fsOff = $('flashSegOff');
  if(fsOn)  { fsOn.className  = 'flash-seg-btn' + (fe === 'on'  ? ' active-on'  : ''); }
  if(fsLow) { fsLow.className = 'flash-seg-btn' + (fe === 'low' ? ' active-low' : ''); }
  if(fsOff) { fsOff.className = 'flash-seg-btn' + (fe === 'off' ? ' active-off' : ''); }
}

function toggleSetting(type) {
  if(type === 'music') gameSettings.musicOn = !gameSettings.musicOn;
  if(type === 'sfx') gameSettings.sfxOn = !gameSettings.sfxOn;
  if(type === 'reduceFlash') gameSettings.reduceFlash = true;
  applyAudioSettings();
  persistSettings();
}

function setSettingVolume(type, value) {
  const v = _clamp01(Number(value) / 100);
  if(type === 'music') { gameSettings.musicVolume = v; if(v > 0) gameSettings.musicOn = true; }
  if(type === 'sfx') { gameSettings.sfxVolume = v; if(v > 0) gameSettings.sfxOn = true; }
  applyAudioSettings();
  persistSettings();
}

function _syncSoundBtns() { syncSettingsUI(); }

// เล่นเสียง SFX ที่เป็น <audio> element (เช่น countdown) ผ่าน gate เดียวกับ _playSfx
// ใช้ตัวกลางตัวเดียวกัน: เคารพ sfxOn + sfxVolume และมี fallback กัน error
// (ไฟล์หาย / browser block autoplay) — ไม่มี SFX ใด bypass ค่า setting
function _playSfxEl(id, baseVol) {
  if(!gameSettings.sfxOn) return;
  const el = $(id);
  if(!el) return;
  try {
    el.currentTime = 0;
    el.volume = _sfxGain(baseVol == null ? 1 : baseVol);
    const p = el.play();
    if(p && typeof p.catch === 'function') p.catch(()=>{});
  } catch(e) {}
}

// ── SFX play functions ──
let _akLastPlay = 0;
function playAK() {
  if(!gameSettings.sfxOn) return;
  const now = Date.now();
  if(now - _akLastPlay < 1000) return; // รอ 1 วินาทีระหว่างแต่ละเสียง
  _akLastPlay = now;
  _playSfx('ak', 0.40, 3); // overlap ได้สูงสุด 3
}
function playPunch() { _playSfx('punch', VOL.punch, false); } // ไม่ overlap
function playWpSound(round) { _playSfx('wp'+round, VOL['wp'+round]||0.7, true); }
function playWkSound(num)   { _playSfx('wk'+num,   VOL['wk'+num]||0.8,  true); }
function playWpBall()       { _playSfx('wpball', VOL.wpball, true); }

// ══════════════════════════════════════════
// SAVE / LOAD
// ══════════════════════════════════════════
// ── ตาราง migrate ID เก่า → ID ใหม่ (ใช้ใน loadSave) ──
const _MIGRATE_ID = {'poring':'po','lunatic':'lu','fabre':'fa','condor':'co','pecopeco':'pp','spore':'sp','poporing':'pr','drops':'dr','stainer':'st','rocker':'ro','caramel':'ca','rodafrog':'rf','metaller':'me','mandragora':'ma','willow':'wi','hornet':'ho','thiefbug':'tb','mastering':'ms','zombie':'zo','savage':'sa','orc':'oc','mummy':'mu','skelworker':'sw','hunterfly':'hf','elderwillow':'ew','sting':'si','nightmare':'nm','zenorc':'ze','horong':'hg','raydric':'ry','greatestgeneral':'gg','jakk':'jk','marina':'mn','demonpungus':'dp','vitata':'vi','alligator':'al','doppelganger':'dg','hydra':'hy','phreeoni':'ph','turtlegeneral':'tg','drake':'dk','taogunka':'tk','dracula':'dc','incantation':'ic','stormyknight':'sk','darklord':'dl','moonlightflower':'mf','minorous':'mi','executioner':'ex','whisper':'wh','goblinleader':'gl','amonra':'ar','thanatos':'th','baphomet':'bh','eddga':'eg','osiris':'os','mistress':'mt','goldenbug':'gb','orchero':'oh','lordofdeath':'ld','ktullanux':'kn','beelzebub':'bz','valkyrierandgris':'vr','atroce':'at','kield01':'kl','kiel':'kl','ifrit':'if','rsx0806':'rx','andre':'an','kukre':'ku','familiar':'fm','picky':'pi','yoyo':'yy','soldierskeleton':'ss','marc':'mc','sidewinder':'sd','zerom':'zr','matyr':'my','abysmalknight':'ak','mayapurple':'mp','evildruid':'ed'};
function _migrateId(id) { return _MIGRATE_ID[id] || id; }
function _migrateIds(arr) { return Array.isArray(arr) ? arr.map(_migrateId) : arr; }


const SAVE_STORAGE_KEY = 'noctisak47_v3';
const _SUPA_URL = 'https://ouhtyyddclgqvrqqdwlc.supabase.co';
const _SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aHR5eWRkY2xncXZycXFkd2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTY4NDQsImV4cCI6MjA5MzU3Mjg0NH0.XITBYW17rsVjQzVx2l4jzzsdF3K7xk94aIjBoxi2qBk';
let _saveIntegrityWarning = '';
let _saveSignatureState = 'local';

function defaultSave() {
  return { coins:0, items:{}, stats:{totalKO:0,maxCombo:0,highScore:0},
           ownedSkins:['default'], ownedArenas:['default'],
           activeSkin:'default', activeArena:'default',
           quitPenalty:false, savedCards:null,
           unlockedCards:['po','lu','fa','co','pp'],
           gamesCompleted:0,
           ocaTickets:{ standard:0, premium:0, elite:0 },
           dailyQuest:{ weekKey:'', streak:0, lastClaimDate:'', claimed:[] },
           weeklyChallenge:{ weekId:'', runsCompleted:0, totalKO:0, breakSuccess:0, ak47Complete:0, claimed:{ tier1:false, tier2:false, tier3:false } },
           settings:normalizeSettings(gameSettings),
           cloudPlayerId:null,
           cardRuns:{} };
}

function normalizeSaveData(d) {
  d = (d && typeof d === 'object') ? d : defaultSave();
  d.coins = Math.max(0, Math.floor(Number(d.coins) || 0));
  if (!d.items || typeof d.items !== 'object') d.items = {};
  if (!d.stats || typeof d.stats !== 'object') d.stats = {totalKO:0, maxCombo:0, highScore:0};
  d.stats.totalKO = Math.max(0, Math.floor(Number(d.stats.totalKO) || 0));
  d.stats.maxCombo = Math.max(0, Math.floor(Number(d.stats.maxCombo) || 0));
  d.stats.highScore = Math.max(0, Math.floor(Number(d.stats.highScore) || 0));
  if (!Array.isArray(d.ownedSkins)) d.ownedSkins = ['default'];
  d.ownedSkins = Array.from(new Set(d.ownedSkins.filter(id => typeof id === 'string' && id)));
  if (!d.ownedSkins.includes('default')) d.ownedSkins.unshift('default');
  if (!Array.isArray(d.ownedArenas)) d.ownedArenas = ['default'];
  d.ownedArenas = Array.from(new Set(d.ownedArenas.filter(id => typeof id === 'string' && id)));
  if (!d.ownedArenas.includes('default')) d.ownedArenas.unshift('default');
  if (!d.activeSkin || !d.ownedSkins.includes(d.activeSkin)) d.activeSkin = 'default';
  if (!d.activeArena || !d.ownedArenas.includes(d.activeArena)) d.activeArena = 'default';
  if (!d.savedCards) d.savedCards = null;
  if (!Array.isArray(d.unlockedCards)) d.unlockedCards = ['po','lu','fa','co','pp'];
  d.gamesCompleted = Math.max(0, Math.floor(Number(d.gamesCompleted) || 0));
  if (!d.ocaTickets || typeof d.ocaTickets !== 'object') d.ocaTickets = { standard:0, premium:0, elite:0 };
  ['standard','premium','elite'].forEach(t => { d.ocaTickets[t] = Math.max(0, Math.floor(Number(d.ocaTickets[t]) || 0)); });
  if (!d.dailyQuest || typeof d.dailyQuest !== 'object') d.dailyQuest = { weekKey:'', streak:0, lastClaimDate:'', claimed:[] };
  if (!Array.isArray(d.dailyQuest.claimed)) d.dailyQuest.claimed = [];
  // ── weeklyChallenge: default + normalize for old saves ──
  if (!d.weeklyChallenge || typeof d.weeklyChallenge !== 'object') d.weeklyChallenge = { weekId:'', runsCompleted:0, totalKO:0, breakSuccess:0, ak47Complete:0, claimed:{ tier1:false, tier2:false, tier3:false } };
  d.weeklyChallenge.weekId        = typeof d.weeklyChallenge.weekId === 'string'          ? d.weeklyChallenge.weekId : '';
  d.weeklyChallenge.runsCompleted = Math.max(0, Math.floor(Number(d.weeklyChallenge.runsCompleted) || 0));
  d.weeklyChallenge.totalKO       = Math.max(0, Math.floor(Number(d.weeklyChallenge.totalKO)       || 0));
  d.weeklyChallenge.breakSuccess  = Math.max(0, Math.floor(Number(d.weeklyChallenge.breakSuccess)  || 0));
  d.weeklyChallenge.ak47Complete  = Math.max(0, Math.floor(Number(d.weeklyChallenge.ak47Complete)  || 0));
  if (!d.weeklyChallenge.claimed || typeof d.weeklyChallenge.claimed !== 'object') d.weeklyChallenge.claimed = { tier1:false, tier2:false, tier3:false };
  ['tier1','tier2','tier3'].forEach(t => { d.weeklyChallenge.claimed[t] = !!d.weeklyChallenge.claimed[t]; });
  d.settings = normalizeSettings(d.settings || gameSettings);
  if (d.cloudPlayerId === undefined) d.cloudPlayerId = null;
  d.quitPenalty = false;
  d.unlockedCards = _migrateIds(d.unlockedCards);
  if (d.savedCards) d.savedCards = _migrateIds(d.savedCards);
  // cardRuns: { [cardId]: number } — default to {} for old saves, values clamped to 0
  if (!d.cardRuns || typeof d.cardRuns !== 'object' || Array.isArray(d.cardRuns)) d.cardRuns = {};
  Object.keys(d.cardRuns).forEach(k => { d.cardRuns[k] = Math.max(0, Math.floor(Number(d.cardRuns[k]) || 0)); });
  // ── preRunState: persists rerollCount between navigations; cleared on run end ──
  if (!d.preRunState || typeof d.preRunState !== 'object' || !d.preRunState.sessionId) {
    d.preRunState = null;
  } else {
    // Clamp rerollCount against tampering
    d.preRunState.rerollCount = Math.max(0, Math.floor(Number(d.preRunState.rerollCount) || 0));
  }
  // ── v6 migration: preserve auto-save metadata if present, seed defaults for old saves ──
  d.saveVersion = Math.max(0, Math.floor(Number(d.saveVersion) || 0));
  d.updatedAt   = (typeof d.updatedAt === 'string' && d.updatedAt) ? d.updatedAt : '';
  d.deviceId    = (typeof d.deviceId  === 'string' && d.deviceId)  ? d.deviceId  : '';
  d.lastRunId   = (typeof d.lastRunId === 'string' && d.lastRunId)  ? d.lastRunId : null;
  return d;
}

function _saveEnvelope(payload) {
  return { version: 6, payload, saved_at: new Date().toISOString() };
}

// ── Unique device ID (persisted in localStorage independently of save) ──
function _getDeviceId() {
  const KEY = 'noctisak47_device_id';
  let id = null;
  try { id = localStorage.getItem(KEY); } catch(e) {}
  if (!id) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    id = 'dev_' + Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    try { localStorage.setItem(KEY, id); } catch(e) {}
  }
  return id;
}
const _DEVICE_ID = _getDeviceId();

// ── Run ID: unique per run, set at game start, consumed at endGame ──
let _currentRunId = null;
function _newRunId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `run_${ts}_${rand}`;
}

// ── Shared save payload builder — single source of truth ──
function buildSavePayload() {
  const now = new Date().toISOString();
  const base = normalizeSaveData(Object.assign({}, save));
  base.saveVersion  = (base.saveVersion || 0) + 1;  // incremented at build time
  base.updatedAt    = now;
  base.deviceId     = _DEVICE_ID;
  base.lastRunId    = _currentRunId || base.lastRunId || null;
  return base;
}

// ── Pending sync queue (survives page close via localStorage) ──
const _PENDING_SYNC_KEY = 'noctisak47_pending_sync';
function _pendingSyncGet()        { try { return JSON.parse(localStorage.getItem(_PENDING_SYNC_KEY)) || null; } catch(e) { return null; } }
function _pendingSyncSet(payload) { try { localStorage.setItem(_PENDING_SYNC_KEY, JSON.stringify(payload)); } catch(e) {} }
function _pendingSyncClear()      { try { localStorage.removeItem(_PENDING_SYNC_KEY); } catch(e) {} }

function _safeLocalStorageGet(key) {
  try { return localStorage.getItem(key); }
  catch(e) {
    console.warn('[save] localStorage get failed', e);
    return null;
  }
}

function _safeLocalStorageSet(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch(e) {
    console.warn('[save] localStorage set failed', e);
    return false;
  }
}

function _safeLocalStorageRemove(key) {
  try { localStorage.removeItem(key); return true; }
  catch(e) {
    console.warn('[save] localStorage remove failed', e);
    return false;
  }
}

function _readStoredSaveEnvelope() {
  const raw = _safeLocalStorageGet(SAVE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.payload ? parsed : { legacyPayload: parsed };
  } catch(e) { return { corrupt: true }; }
}

function _storeLocalSave(payload) {
  return _safeLocalStorageSet(SAVE_STORAGE_KEY, JSON.stringify(_saveEnvelope(payload)));
}

function _isLikelyNetworkFetchError(e) {
  return e && (e.name === 'TypeError' || /Failed to fetch|NetworkError|Load failed|fetch/i.test(String(e.message || e)));
}

function _cloudFriendlyError(e) {
  if (_isLikelyNetworkFetchError(e)) return '❌ ติดต่อ Supabase REST ไม่ได้ — เช็กเน็ต/CORS/RLS';
  return `❌ ${e && e.message ? e.message : 'Cloud error'}`;
}

function loadSave() {
  const stored = _readStoredSaveEnvelope();
  if (!stored) return defaultSave();
  if (stored.corrupt) {
    _saveIntegrityWarning = 'Save ในเครื่องเสียหาย ระบบ reset/repair ให้แล้ว';
    _saveSignatureState = 'invalid';
    return defaultSave();
  }
  if (stored.legacyPayload) {
    try { localStorage.setItem(SAVE_STORAGE_KEY + '_legacy_backup', JSON.stringify(stored.legacyPayload)); } catch(e) {}
    _saveSignatureState = 'legacy';
    return normalizeSaveData(stored.legacyPayload);
  }
  _saveSignatureState = 'local';
  return normalizeSaveData(stored.payload);
}

async function verifyLocalSaveSignature() {
  const stored = _readStoredSaveEnvelope();
  if (!stored) {
    _saveSignatureState = 'empty';
    return true;
  }
  if (stored.corrupt) {
    _safeLocalStorageRemove(SAVE_STORAGE_KEY);
    save = defaultSave();
    _saveSignatureState = 'invalid';
    if (_saveIntegrityWarning) alert(_saveIntegrityWarning);
    return false;
  }
  save = normalizeSaveData(stored.legacyPayload || stored.payload);
  gameSettings = normalizeSettings(save.settings || gameSettings);
  save.settings = gameSettings;
  applyAudioSettings();
  _storeLocalSave(save);
  _saveSignatureState = 'local';
  return true;
}

function doSave(action) {
  const payload = buildSavePayload();
  // Write the enriched payload back so save object carries version/updatedAt/etc.
  Object.assign(save, payload);
  try { _storeLocalSave(save); } catch(e) { console.warn('[doSave] local save failed', e); }
  if (_showLocalSaveToast) {
    _showLocalSaveToast = false;
    showSaveToast('local');
  }
  if (typeof DEV_LOG === 'function') DEV_LOG('[doSave]', action || 'save', 'saveVersion:', save.saveVersion, 'updatedAt:', save.updatedAt);
}
// ── Dev-only logger (stripped silently in prod — set window.NOCTIS_DEV=true to enable) ──
function DEV_LOG(...args) {
  if (window.NOCTIS_DEV) console.log('[NOCTIS]', ...args);
}

// Flag: set true by endGame so doSave() shows 'Local Saved' toast exactly once
let _showLocalSaveToast = false;

// ══ SAVE STATE ══
const saveState = {
  dirty:                false,
  dirtyReason:          null,
  dirtyReasons:         new Set(),  // multi-reason tracking
  lastLocalSaveAt:      0,
  lastCloudSyncAt:      0,
  cloudSyncInProgress:  false,
  pendingCloudSync:     false,
  lastSyncRunId:        null,
  lastSyncHash:         null,
  // Startup read throttle — one cloud check per session window
  startupCloudChecked:  false,
  lastRemoteCheckedAt:  0,
  // Exponential retry backoff state
  _retryCount:          0,
  _retryTimer:          null,
  _retryDelays:         [30000, 60000, 120000, 300000],  // 30s, 1m, 2m, 5m
};

// ══ TOAST RATE-LIMIT STATE ══
// Prevents toast spam during rapid card opening.
const saveToastState = {
  lastShownAt:   0,       // timestamp of last rendered success toast
  lastType:      null,    // last type shown
  suppressUntil: 0,       // suppress success toasts until this timestamp
  batchCount:    0,       // number of card_opened events in current batch
  batchTimer:    null,    // timer for "batch idle" final toast
  errorLastAt:   {}       // map of error-type → last shown timestamp
};

// Minimum gap (ms) between success toasts during normal operation
const _TOAST_SUCCESS_MIN_GAP  = 5000;
// Gap between same error type repeating
const _TOAST_ERROR_MIN_GAP    = 7000;
// How long after last card open to show the final batch summary toast
const _TOAST_BATCH_IDLE_MS    = 2200;
// During rapid card opening, suppress individual toasts for this long
const _TOAST_CARD_SUPPRESS_MS = 4000;

const _TOAST_SUCCESS_TYPES = new Set(['local','syncing','cloud','loaded','localonly']);
const _TOAST_ERROR_TYPES   = new Set(['failed','offline','pending']);

/**
 * showSaveToastThrottled — rate-limited wrapper around showSaveToast.
 * @param {string} type         - toast type key
 * @param {object} [opts]       - { silentToast, batchToast, reason, msgOverride }
 */
function showSaveToastThrottled(type, opts) {
  opts = opts || {};
  const now = Date.now();

  // Always allow non-save-status toasts through raw
  if (!_TOAST_SUCCESS_TYPES.has(type) && !_TOAST_ERROR_TYPES.has(type)) {
    showSaveToast(type, opts.msgOverride);
    return;
  }

  // silentToast: suppress entirely (used during card_opened batch)
  if (opts.silentToast) return;

  if (_TOAST_SUCCESS_TYPES.has(type)) {
    // If currently in a batch suppress window, don't show
    if (now < saveToastState.suppressUntil) {
      DEV_LOG('[toast-throttle] suppressed (batch window):', type);
      return;
    }
    // Enforce minimum gap between success toasts
    if (now - saveToastState.lastShownAt < _TOAST_SUCCESS_MIN_GAP) {
      DEV_LOG('[toast-throttle] suppressed (min gap):', type);
      return;
    }
    saveToastState.lastShownAt = now;
    saveToastState.lastType    = type;
    showSaveToast(type, opts.msgOverride);

  } else if (_TOAST_ERROR_TYPES.has(type)) {
    // Error types: allow but throttle per-type
    const lastErr = saveToastState.errorLastAt[type] || 0;
    if (now - lastErr < _TOAST_ERROR_MIN_GAP) {
      DEV_LOG('[toast-throttle] error suppressed (min gap):', type);
      return;
    }
    saveToastState.errorLastAt[type] = now;
    showSaveToast(type, opts.msgOverride);
  }
}

/**
 * markCardOpenBatch — called on every card open.
 * Suppresses individual success toasts during rapid opening to prevent spam.
 * @param {string|null} [finalType]
 *   Pass null (default): suppress window only; sync shows its own toast when it resolves.
 *   Pass a type string: show that toast once after batch idle (only use for local-save types).
 *   NEVER pass 'cloud' here — cloud success is confirmed only by the actual upload callback.
 */
function markCardOpenBatch(finalType) {
  saveToastState.batchCount++;
  // Extend suppress window so rapid-open individual toasts are muted
  saveToastState.suppressUntil = Date.now() + _TOAST_CARD_SUPPRESS_MS;

  // Restart the idle timer — fires 2.2s after the LAST card collect
  clearTimeout(saveToastState.batchTimer);
  saveToastState.batchTimer = setTimeout(() => {
    saveToastState.batchTimer = null;
    saveToastState.batchCount = 0;
    saveToastState.suppressUntil = 0;
    // Only show a toast if a concrete type was requested
    // (null = let the upcoming cloud sync show its own cloud/failed/offline toast)
    if (finalType) {
      saveToastState.lastShownAt = Date.now();
      saveToastState.lastType    = finalType;
      showSaveToast(finalType);
      DEV_LOG('[toast-batch] final batch toast:', finalType);
    } else {
      DEV_LOG('[toast-batch] idle — suppress lifted; cloud sync will show its own toast');
    }
  }, _TOAST_BATCH_IDLE_MS);
}

// ══ CLOUD PROFILE ══
const cloudProfile = {
  isCloudEnabled: false,
  playerId:       '',
  secret:         '',
  deviceId:       _DEVICE_ID,
  updatedAt:      0,
  saveVersion:    1
};
function _cpInit() {
  const creds   = _cloudLoadCreds();
  const boundId = _cloudBoundId();
  if (boundId && creds.key) {
    cloudProfile.isCloudEnabled = true;
    cloudProfile.playerId       = boundId;
    cloudProfile.secret         = creds.key;
  }
  DEV_LOG('[cloudProfile] enabled:', cloudProfile.isCloudEnabled, 'id:', cloudProfile.playerId || '(none)');
}

// ── markSaveDirty: tag the reason before every important doSave ──
function markSaveDirty(reason) {
  saveState.dirty       = true;
  saveState.dirtyReason = reason || 'unknown';
  if (saveState.dirtyReasons) saveState.dirtyReasons.add(reason || 'unknown');
  DEV_LOG('[dirty]', reason);
}

// ── Stable save hash — excludes ALL volatile metadata ──
// Only hashes persistent gameplay data that actually matters for dedup.
// Excludes: saveVersion, updatedAt, lastRunId, deviceId, lastLocalSaveAt,
//           lastCloudSyncAt, toast/modal/animation state, runtime flags.
// This makes hash-skip actually fire when nothing real has changed between syncs.
function _saveHash(payload) {
  return computeStableSaveHash(payload);
}

function computeStableSaveHash(d) {
  if (!d) return '0';
  // Sort array/object fields for stable JSON serialisation regardless of insertion order
  const sortedCards = d.unlockedCards
    ? [...d.unlockedCards].sort()
    : [];
  const sortedSkins = d.ownedSkins
    ? [...d.ownedSkins].sort()
    : [];
  const sortedArenas = d.ownedArenas
    ? [...d.ownedArenas].sort()
    : [];
  const sortedItems = d.items
    ? Object.keys(d.items).sort().map(k => k + ':' + d.items[k]).join(',')
    : '';
  const sortedOca = d.ocaTickets
    ? ['standard','premium','elite'].map(t => t + ':' + (d.ocaTickets[t] || 0)).join(',')
    : '';
  const sortedCardRuns = d.cardRuns
    ? Object.keys(d.cardRuns).sort().map(k => k + ':' + d.cardRuns[k]).join(',')
    : '';
  // Card mastery: only mastery tier per card (the persistent advancement level)
  const sortedMastery = d.cardMastery
    ? Object.keys(d.cardMastery).sort().map(k => {
        const m = d.cardMastery[k];
        return k + ':' + (m ? (m.tier || 0) : 0);
      }).join(',')
    : '';
  // Daily quest: only the week key and per-day claimed state (not claim timestamps)
  const dqKey     = d.dailyQuest ? (d.dailyQuest.weekKey || '') : '';
  const dqStreak  = d.dailyQuest ? (d.dailyQuest.streak  || 0) : 0;
  const dqClaimed = d.dailyQuest && d.dailyQuest.claimed
    ? [...d.dailyQuest.claimed].sort().join(',')
    : '';
  // Weekly challenge hash
  const wqHash = d.weeklyChallenge
    ? [d.weeklyChallenge.weekId||'', d.weeklyChallenge.runsCompleted||0,
       d.weeklyChallenge.totalKO||0, d.weeklyChallenge.breakSuccess||0,
       d.weeklyChallenge.ak47Complete||0,
       (d.weeklyChallenge.claimed&&d.weeklyChallenge.claimed.tier1)?1:0,
       (d.weeklyChallenge.claimed&&d.weeklyChallenge.claimed.tier2)?1:0,
       (d.weeklyChallenge.claimed&&d.weeklyChallenge.claimed.tier3)?1:0,
      ].join(',')
    : '';
  // Settings: only values that affect gameplay or cloud identity
  const settingsKey = d.settings
    ? ['musicOn','musicVolume','sfxOn','sfxVolume','flashEffect']
        .map(k => k + ':' + (d.settings[k] !== undefined ? d.settings[k] : ''))
        .join(',')
    : '';

  const s = JSON.stringify([
    d.coins        || 0,
    d.gamesCompleted || 0,
    (d.stats && d.stats.highScore)  || 0,
    (d.stats && d.stats.totalKO)    || 0,
    (d.stats && d.stats.maxCombo)   || 0,
    d.activeSkin   || '',
    d.activeArena  || '',
    d.cloudPlayerId || '',
    sortedCards,
    sortedSkins,
    sortedArenas,
    sortedItems,
    sortedOca,
    sortedCardRuns,
    sortedMastery,
    dqKey,
    dqStreak,
    dqClaimed,
    wqHash,
    settingsKey,
  ]);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h.toString(36);
}


let save = loadSave();
gameSettings = normalizeSettings(save.settings || gameSettings);
save.settings = gameSettings;
applyAudioSettings();
const _saveReadyPromise = verifyLocalSaveSignature();
// Init cloud profile from persisted creds (safe: _cloudLoadCreds uses localStorage, always available)
// _cpInit() references _cloudLoadCreds/_cloudBoundId defined later in the file, so we defer one tick.
setTimeout(() => _cpInit(), 0);

// item level helper
function itemLv(id) { return (save.items && save.items[id]) || 0; }
function itemEffect(id) {
  const lv = itemLv(id);
  if (!lv) return null;
  const def = SHOP_DEF.find(d => d.id === id);
  return def ? def.levels[lv-1] : null;
}
function getStatNum(id, key) {
  const ef = itemEffect(id);
  if (!ef) return 0;
  const m = ef.effect.match(new RegExp(key+':(\\S+)'));
  return m ? parseFloat(m[1]) : 0;
}
function hasStat(id, key) {
  const ef = itemEffect(id);
  return ef ? ef.effect.includes(key) : false;
}

// ══════════════════════════════════════════
// ASSET PRELOADER
// ══════════════════════════════════════════
const ASSETS = {
  images: [
    // backgrounds / title first-screen (default + menu only).
    // Purchasable arena bgs (one_bg / colosseum_bg) are NOT eagerly preloaded —
    // they lazily load on-demand when the arena shop opens (_drawArenaPreview) or
    // the arena is equipped (_applyArenaBg, CSS url), and the SW caches them then.
    'title_bg.png','default_bg.webp',
    // default skin — the only skin every player has by default; the currently
    // EQUIPPED skin (whichever it is) is always freshly preloaded on demand by
    // initState()/applySkin() regardless of this list, so purchasable skins
    // (XUANG/JAKKADUN/SORNSIT SPIRIT/etc.) don't need an unconditional eager
    // preload here — they behave the same as the other purchasable skins already do.
    'boxer.png','boxer_hit1.png','boxer_hit2.png','boxer_hit3.png','boxer_hit4.png',
    // game UI critical
    'ak47.png','noobak47.png','wp5.png','break_core.png','break_barrier.png','weak.webp',
    'transfer.png','card.png','shop.png','play.png','arena.png','pause.png',
    'void_main.png','best_main.png',
    CARD_HIDDEN_IMG,'card_back.png','logo.png',
    // shop/OCA item art (optional, non-blocking; preload keeps renamed assets warm)
    ...Object.values(ITEM_IMGS),
  ],
  audio: [] // audio loaded on-demand via Web Audio API
};
// ── Skin image preload cache (ใช้ HTMLImageElement แคช ป้องกัน re-fetch ตอน src swap) ──
const _imgObjCache = {};
function _preloadImg(src) {
  if(_imgObjCache[src]) return;
  const img = new Image(); img.src = src; _imgObjCache[src] = img;
}
function preloadAll() {
  // All entries are optional for startup: a bad image must never softlock the title screen.
  const imgs = Array.from(new Set(ASSETS.images.filter(Boolean)));
  const total = imgs.length;
  if(total === 0) { onAllLoaded(); return; }
  let loaded = 0;
  let preloadClosed = false;
  const pending = new Set(imgs);

  function setPreloadPct(pct) {
    const bar = document.getElementById('loadBar');
    const pctEl = document.getElementById('loadPct');
    if(bar) bar.style.width = pct + '%';
    if(pctEl) pctEl.textContent = pct + '%';
  }

  // แสดง 1% ทันทีเพื่อให้ผู้เล่นรู้ว่าเริ่ม load แล้ว
  setPreloadPct(1);

  // fallback 5 วิ — ถ้า image ใดค้างก็ผ่านไปได้ และ TAP TO START ต้องขึ้นเสมอ
  const fallbackTimer = setTimeout(() => {
    if (preloadClosed) return;
    preloadClosed = true;
    if (pending.size) console.warn('[preload] continuing with pending optional assets:', Array.from(pending));
    onAllLoaded();
  }, 5000);

  function prog(src, ok) {
    if (preloadClosed) return;
    if (!pending.has(src)) return;
    pending.delete(src);
    loaded++;
    if (!ok) console.warn('[preload] optional image failed:', src);
    const pct = Math.min(Math.round(loaded / total * 100), 99);
    setPreloadPct(pct);
    if(loaded >= total) {
      preloadClosed = true;
      clearTimeout(fallbackTimer);
      onAllLoaded();
    }
  }

  imgs.forEach(src => {
    const i = new Image();
    _imgObjCache[src] = i;
    let _fired = false;
    const _once = (ok) => { if(!_fired){ _fired=true; prog(src, ok); } };
    i.onload  = () => _once(true);
    i.onerror = () => _once(false);
    i.src = src;
    if(i.complete) _once(i.naturalWidth > 0);
  });
}
let _allLoadedCalled = false;
let _preloadEnterStarted = false;
function onAllLoaded() {
  if(_allLoadedCalled) return;
  _allLoadedCalled = true;
  // ให้ progress bar animate ไปถึง 100% ก่อน แล้วค่อยแสดง TAP TO START
  const loadBar  = document.getElementById('loadBar');
  const loadPct  = document.getElementById('loadPct');
  const loadText = $('loadText');
  const tapEl    = $('tapToStart');

  // force 100%
  if (loadBar)  loadBar.style.width = '100%';
  if (loadPct)  loadPct.textContent  = '100%';

  // รอให้ transition animation ของ bar เสร็จก่อน (~200ms) แล้วค่อยซ่อน text และแสดง TAP
  setTimeout(() => {
    if (loadText) loadText.style.display = 'none';
    if (tapEl)    tapEl.style.display    = 'block';
  }, 300);

  async function doEnter(e) {
    if (e) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    }
    if (_preloadEnterStarted) return;
    _preloadEnterStarted = true;
    if (tapEl) tapEl.style.display = 'none';
    if (loadText) { loadText.style.display = 'block'; loadText.textContent = 'VERIFYING SAVE...'; }
    try {
      await Promise.race([
        _saveReadyPromise,
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
    } catch(err) {
      console.warn('[save] verification skipped after error', err);
      save = normalizeSaveData(save);
    }
    if (loadText) loadText.style.display = 'none';
    // unlock + เล่น BGM ทันทีหลัง user gesture
    const bgm = $('bgmSound');
    if (bgm) {
      bgm.volume = _musicGain(TITLE_BGM_VOLUME);
      bgm.play().catch(() => {});
    }
    setTimeout(() => {
      const preloader = $('preloader');
      if (preloader) preloader.style.display = 'none';
      showMainMenu();
    }, 150);
  }

  if (tapEl) {
    tapEl.addEventListener('click', doEnter, { once: true });
    tapEl.addEventListener('touchstart', doEnter, { once: true, passive: false });
  }
  // fallback: คลิกที่ preloader ได้เลย
  const preloaderEl = $('preloader');
  if (preloaderEl) {
    preloaderEl.addEventListener('click', doEnter, { once: true });
    preloaderEl.addEventListener('touchstart', doEnter, { once: true, passive: false });
  }
}
preloadAll();
// Emergency bypass: ถ้า 2 วินาทียังอยู่ที่ 0% (SW cache เก่าบล็อก) → ข้ามไปเลย
setTimeout(() => {
  const pctEl = document.getElementById('loadPct');
  if(pctEl && (pctEl.textContent === '0%' || pctEl.textContent === '')) {
    onAllLoaded();
  }
}, 2000);

// ══════════════════════════════════════════
// STAT CACHE
// ══════════════════════════════════════════
let _sc = {};
function rebuildStatCache() {
  _sc = {
    desoBns:    getStatNum('desolator','dmg_bonus'),
    critChance: getStatNum('daedalus','crit_chance'),
    critMult:   getStatNum('daedalus','crit_mult') || 2,
    dblChance:  getStatNum('moonshard','double'),
    isTriple:   hasStat('moonshard','triple'),
    godBns:     getStatNum('aghanims','god_dmg'),
    durBns:     getStatNum('octarine','god_dur'),
    coinMult:   getStatNum('midas','coin_mult'),  // Hand of Midas
  };
}
const boxer = $('boxer'), gun = $('gun'), fx = $('fxLayer'), flash = $('screenFlash');

// ── DOM cache สำหรับ hot path (ไม่ getElementById ซ้ำทุก hit) ──
const _el = {};
function _cacheEls() {
  ['hpFill','godFill','koNum','scoreNum','coinNum',
   'bossBar',
   'godLevelWrap','godLevelNum','godLevelName','godTimer2','odLevelBadge','odSweep','odLevelUpFlash',
   'bigCombo','comboWrap','multiBadge','multiNum'].forEach(id => {
    _el[id] = document.getElementById(id);
  });
}
_cacheEls();

// ══════════════════════════════════════════
// CANVAS BOXER
// ══════════════════════════════════════════
const _bCtx = boxer.getContext('2d');
let _bCurrentImg = null;   // HTMLImageElement ที่กำลังแสดงอยู่
let _bRafId = null;

function _bSetSize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = boxer.getBoundingClientRect();
  const cssW = rect.width  || boxer.offsetWidth  || 546;
  const cssH = rect.height || boxer.offsetHeight || 780;
  if(cssW < 2) return;
  const targetW = Math.round(cssW * dpr);
  const targetH = Math.round(cssH * dpr);
  if(boxer.width !== targetW || boxer.height !== targetH) {
    boxer.width  = targetW;
    boxer.height = targetH;
    _bCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function _bDraw() {
  _bRafId = null;
  if(!_bCurrentImg || !_bCurrentImg.complete || !_bCurrentImg.naturalWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const cW = boxer.width / dpr;
  const cH = boxer.height / dpr;
  _bCtx.clearRect(0, 0, boxer.width, boxer.height);
  // รักษา aspect ratio ของภาพ วาดให้พอดีใน canvas (contain)
  const iW = _bCurrentImg.naturalWidth, iH = _bCurrentImg.naturalHeight;
  const scale = Math.min(cW/iW, cH/iH);
  const dW = iW * scale, dH = iH * scale;
  const dx = (cW - dW) / 2, dy = (cH - dH) / 2;
  _bCtx.drawImage(_bCurrentImg, dx, dy, dW, dH);
}

function _bScheduleDraw() {
  if(_bRafId) return;
  _bRafId = requestAnimationFrame(_bDraw);
}

// แทนที่ boxer.src = ... ทั้งหมดด้วยฟังก์ชันนี้
function boxerSetImg(img) {
  if(typeof img === 'string') img = _imgObjCache[img];
  if(!img) return;
  if(_bCurrentImg === img && img.complete) { _bScheduleDraw(); return; }
  _bCurrentImg = img;
  if(img.complete && img.naturalWidth > 0) {
    _bSetSize(); _bScheduleDraw();
  } else {
    img.onload = () => { if(_bCurrentImg === img) { _bSetSize(); _bScheduleDraw(); } };
  }
}

// ปรับ canvas size เมื่อ window resize
window.addEventListener('resize', () => { _bSetSize(); _bScheduleDraw(); });

// hitImgs เปลี่ยนแปลงตาม skin — ใช้ฟังก์ชัน getter แทน const
function getHitImgs() { return getActiveSkin().files.hits; }
function getIdleImg()  { return getActiveSkin().files.idle; }
const GOD_LEVELS = [
  {lv:0,name:'',color:'white'},
  {lv:1,name:'NOCTIS OVERDRIVE', color:'#00ffee', dmgMult:5,  duration:10},
  {lv:2,name:'OVERDRIVE BURST',  color:'#4488ff', dmgMult:8,  duration:6 },
  {lv:3,name:'ANNIHILATION MODE',color:'#ff2233', dmgMult:12, duration:4 },
];

// ══════════════════════════════════════════
// SHOP — Upgrade & Equipment
// ══════════════════════════════════════════
let shopReturnTo = 'menu'; // 'menu' | 'result'

function _hideAllScreens() {
  ['mainMenu','resultScreen','shopScreen','bossScreen','arenaScreen',
   'cardSlotScreen','cardCollectionScreen','cardDrawScreen','countdownOverlay'].forEach(id => {
    const el = $(id); if(el) el.style.display = 'none';
  });
  // ซ่อน game UI elements ด้วย
  const gameEls = ['topUI','fighter','tapZone','streakLabel','wpCounter','lodCardDisplay'];
  gameEls.forEach(id=>{ const el=$(id); if(el) el.style.display='none'; });
  // ซ่อน save/transfer button
  $('dailyQuestWidget').classList.remove('visible');
}

function openShop(from) {
  shopReturnTo = from || 'menu';
  if(from !== 'result') _stopCollectBGM();
  _hideAllScreens();
  renderShop();
  $('shopScreen').style.display = 'flex';
}
function closeShop() {
  $('shopScreen').style.display = 'none';
  if (shopReturnTo === 'result') {
    $('resultScreen').style.display = 'flex';
    // collect BGM ยังเล่นต่อ
  } else {
    _stopCollectBGM();
    showMainMenu();
  }
}
function showMainMenu() {
  checkDailyQuestReset();
  updateDailyQuestUI();
  if (typeof updateWeeklyBadgesUI === 'function') updateWeeklyBadgesUI();
  $('mainMenu').style.display = 'flex';
  $('dailyQuestWidget').classList.add('visible');
  $('menuCoinNum').textContent = formatNum(save.coins);
  $('menuHsNum').textContent = formatNum(save.stats.highScore || 0);
  $('topUI').style.display = 'none';
  $('fighter').style.display = 'none';
  $('tapZone').style.display = 'none';
  $('streakLabel').style.display = 'none';
  _el.godLevelWrap.style.display = 'none';
  _resetOdBadge();
  updateOdScreenAura(0);
  _el.bossBar.style.display = 'none';
  $('wpCounter').style.display = 'none';
  pressureHide();
  _el.multiBadge.classList.remove('show');
  _applyArenaBg();
  playBGM();
  // Startup cloud restore — runs once, background, non-blocking
  setTimeout(() => startupCloudRestore(), 300);
  window.dispatchEvent(new CustomEvent('noctis:main-menu-shown'));
}

function updateShopCoinUI() {
  if ($('menuCoinNum'))  $('menuCoinNum').textContent  = formatNum(save.coins);
  if ($('shopCoinNum'))  $('shopCoinNum').textContent  = formatNum(save.coins);
  if ($('bossCoinNum'))  $('bossCoinNum').textContent  = formatNum(save.coins);
  if ($('arenaCoinNum')) $('arenaCoinNum').textContent = formatNum(save.coins);
}

// ── Can't-afford feedback for shop BUY buttons (OCA / items / boss & arena skins) ──
// Mirrors the card-slot reroll pattern (_csShowRerollFeedback): shake the button +
// briefly flash its price red, so tapping a disabled BUY never fails silently.
function _shopCantAffordFeedback(btnEl, priceEl) {
  if (btnEl) {
    btnEl.classList.remove('cs-reroll-shake');
    void btnEl.offsetWidth;
    btnEl.classList.add('cs-reroll-shake');
    setTimeout(() => btnEl.classList.remove('cs-reroll-shake'), 380);
  }
  if (priceEl) {
    const _origColor = priceEl.style.color;
    priceEl.style.color = '#ff4444';
    setTimeout(() => { priceEl.style.color = _origColor; }, 450);
  }
}

function renderShop() {
  $('shopCoinNum').textContent = formatNum(save.coins);
  const body = $('shopBody');
  body.innerHTML = '';

  SHOP_DEF.forEach(def => {
    // ── OCA Special Card ──
    if(def._type === 'consumable') {
      const canAfford = save.coins >= def.cost;
      const imgSrc = ITEM_IMGS[def.id];
      const card = document.createElement('div');
      card.className = 'shop-card-oca';
      card.innerHTML = `
        <div class="oca-row">
          ${imgSrc ? `<img src="${imgSrc}" style="width:52px;height:52px;object-fit:contain;flex-shrink:0;" decoding="async">` : ''}
          <div style="flex:1;min-width:0;">
            <div class="shop-card-name">${def.name}</div>
            <div class="shop-card-tagline">${def.tagline}</div>
            <div style="font-family:'Sarabun',sans-serif;font-size:10px;color:#555;margin-top:3px;"></div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:4px;font-family:'Oswald',sans-serif;font-size:13px;color:${canAfford?'var(--gold)':'#444'};letter-spacing:1px;">
              <span class="css-coin" style="background:${canAfford?'var(--gold)':'#444'}"></span>${def.cost}
            </div>
            <button class="oca-buy-btn ${canAfford?'':'cant-afford'}" onclick="buyOCA(this)">BUY</button>
          </div>
        </div>
      `;
      body.appendChild(card);
      return;
    }

    const curLv = itemLv(def.id);
    const maxLv = def.levels.length;

    const card = document.createElement('div');
    card.className = 'shop-card';

    const imgSrc = ITEM_IMGS[def.id];
    const iconHtml = imgSrc
      ? '<img src="' + imgSrc + '" style="width:44px;height:44px;object-fit:contain;flex-shrink:0;" alt="' + def.name + '" decoding="async">'
      : '<div class="shop-card-icon">' + def.icon + '</div>';
    let headerHtml = `
      <div class="shop-card-header">
        ${iconHtml}
        <div>
          <div class="shop-card-name">${def.name}</div>
          <div class="shop-card-tagline">${def.tagline}</div>
        </div>
      </div>
      <div class="shop-levels">
    `;

    def.levels.forEach((lvDef, idx) => {
      const lv = idx + 1;
      const isOwned = curLv >= lv;
      const isCurrent = curLv === lv;
      const isNext = curLv === lv - 1;
      const isLocked = curLv < lv - 1;
      const canAfford = save.coins >= lvDef.cost;

      let rowClass = 'shop-level-row';
      if (isOwned) rowClass += ' current';
      if (isLocked) rowClass += ' locked';

      let rightHtml = '';
      if (isOwned) {
        rightHtml = `<div class="slr-owned"><span class="css-check" style="color:#00ff88;"></span> OWNED</div>`;
      } else if (isNext) {
        rightHtml = `
          <div class="slr-cost ${canAfford ? '' : 'cant'}"><span class="css-coin" style="background:${canAfford?'var(--cyan)':'#333'}"></span> ${lvDef.cost}</div>
          <button class="slr-buy-btn ${canAfford ? '' : 'cant-afford'}" onclick="buyItem('${def.id}',${lv},${lvDef.cost},this)">BUY</button>
        `;
      } else if (isLocked) {
        rightHtml = `<div class="slr-cost cant"><span class='css-coin' style='background:#333'></span> ${lvDef.cost}</div>`;
      }

      let lvCircleClass = 'slr-lv';
      if (isOwned) lvCircleClass += ' done';
      else if (isNext) lvCircleClass += ' active';

      headerHtml += `
        <div class="${rowClass}">
          <div class="slr-left">
            <div class="${lvCircleClass}">L${lv}</div>
            <div class="slr-desc">${lvDef.desc}${isLocked ? '<br><span style="color:#333;font-size:10px">— ต้องซื้อ Lv'+(lv-1)+' ก่อน</span>' : ''}</div>
          </div>
          <div class="slr-right">${rightHtml}</div>
        </div>
      `;
    });

    headerHtml += '</div>';
    card.innerHTML = headerHtml;
    body.appendChild(card);
  });
}

// ── OCA DRAW — ใช้ cardDrawScreen เดิม ไม่เล่น BGM ──
let _ocaMode = false;

function _openOcaDraw(result, onDone) {
  _ocaMode = true;
  _cardDrawResult = result;
  window._cardDrawOnDone = onDone;

  $('cardDrawPityBanner').textContent = '';
  $('cardDrawPityBanner').style.display = 'none';
  _resetCardDrawScreen();

  _hideAllScreens();
  $('cardDrawScreen').style.display = 'flex';
}

function buyOCA(btnEl) {
  const cost = SHOP_DEF.find(d=>d.id==='oca').cost;
  const canAfford = save.coins >= cost;
  if (!canAfford) {
    _shopCantAffordFeedback(btnEl, btnEl && btnEl.previousElementSibling);
    return;
  }
  const modal = $('ocaConfirmModal');
  $('ocaConfirmCost').innerHTML = `<span class="css-coin"></span>${cost} ZENY`;
  $('ocaConfirmBox').querySelector('.oca-btn-confirm').className = 'oca-btn-confirm' + (canAfford ? '' : ' cant-afford');
  modal.style.display = 'flex';
}

function cancelOCA() {
  $('ocaConfirmModal').style.display = 'none';
}

function confirmOCA() {
  const def = SHOP_DEF.find(d=>d.id==='oca');
  if(save.coins < def.cost) return;
  save.coins -= def.cost;
  markSaveDirty('card_purchase');
  doSave();
  scheduleCloudSync('card_purchase');
  $('ocaConfirmModal').style.display = 'none';
  const weights = def.dropWeights;
  const tiers = Object.keys(weights);
  const total = tiers.reduce((s,t)=>s+weights[t],0);
  let r = Math.random()*total;
  let tier = tiers[tiers.length-1];
  for(const t of tiers){ r-=weights[t]; if(r<=0){tier=t;break;} }
  const pool = CARD_POOL.filter(c=>c.rarity===tier);
  const card = pool.length ? pool[Math.floor(Math.random()*pool.length)] : CARD_POOL[0];
  const unlocked = getUnlockedCards();
  const isDupe = unlocked.includes(card.id);
  const dupeCoins = isDupe ? (CARD_DUPE_COINS[card.rarity]||50) : 0;

  // เปิด OCA draw screen แยกต่างหาก — ไม่เล่น BGM ใหม่
  const returnTo = shopReturnTo;
  _openOcaDraw(
    { card, tier, isDupe, dupeCoins },
    ()=>{
      updateShopCoinUI();
      openShop(returnTo);
    }
  );
}

let _shopBuyPopFlip = false;
function buyItem(id, lv, cost, btnEl) {
  if (save.coins < cost) {
    _shopCantAffordFeedback(btnEl, btnEl && btnEl.previousElementSibling);
    return;
  }
  if (itemLv(id) >= lv) return;
  save.coins -= cost;
  if (!save.items) save.items = {};
  save.items[id] = lv;
  markSaveDirty('shop_purchase');
  doSave();
  scheduleCloudSync('shop_purchase');
  rebuildStatCache();
  renderShop();
  $('shopCoinNum').textContent = formatNum(save.coins);
  if ($('menuCoinNum')) $('menuCoinNum').textContent = formatNum(save.coins);
  // A successful buy had strictly less feedback than the can't-afford shake —
  // reuse the same "reward feel" scale-punch already used for score/KO/coin.
  _hudPop($('shopCoinNum'), (_shopBuyPopFlip = !_shopBuyPopFlip));
}

// ══════════════════════════════════════════
// BOSS SKIN
// ══════════════════════════════════════════
const BOSS_SKINS = [
  {
    id: 'default',
    name: 'NOCTISAK47',
    sub: 'Boxer — Default',
    icon: 'boxer_icon.webp',
    cost: 0,
    files: {
      idle: 'boxer.png',
      hits: ['boxer_hit1.png','boxer_hit2.png','boxer_hit3.png','boxer_hit4.png'],
    }
  },
  {
    id: 'toei_boxer',
    name: 'TOEI',
    sub: '1,500 ZENY',
    icon: 'toei_boxer_icon.webp',
    cost: 1500,
    files: {
      idle: 'toei_boxer.png',
      hits: ['toei_boxer_hit1.png','toei_boxer_hit2.png','toei_boxer_hit3.png','toei_boxer_hit4.png'],
    }
  },
  {
    id: 'apologize',
    name: 'APOLOGIZE',
    sub: '1,500 ZENY',
    icon: 'apologize_icon.webp',
    cost: 1500,
    files: {
      idle: 'apologize.png',
      hits: ['apologize_hit1.png','apologize_hit2.png','apologize_hit3.png','apologize_hit4.png'],
    }
  },
  {
    id: 'xuang',
    name: 'XUANG',
    sub: '3,000 ZENY',
    icon: 'xuang_icon.webp',
    auraClass: 'xuang-blood-aura',
    cost: 3000,
    files: {
      idle: 'xuang.png',
      hits: ['xuang_hit1.png','xuang_hit2.png','xuang_hit3.png','xuang_hit4.png'],
    }
  },
  {
    id: 'jakkadun',
    name: 'JAKKADUN',
    sub: '1,000 ZENY',
    icon: 'jakkadun_icon.webp',
    cost: 1000,
    files: {
      idle: 'jakkadun.png',
      hits: ['jakkadun_hit1.png','jakkadun_hit2.png','jakkadun_hit3.png','jakkadun_hit4.png'],
    }
  },
  {
    id: 'sornsit_spirit',
    name: 'SORNSIT SPIRIT',
    sub: '1,000 ZENY',
    icon: 'sornsit_icon.webp',
    cost: 1000,
    files: {
      idle: 'sornsit.png',
      hits: ['sornsit_hit1.png','sornsit_hit2.png','sornsit_hit3.png','sornsit_hit4.png'],
    }
  },
  {
    id: 'rukawa',
    name: 'RUKAWA',
    sub: '1,500 ZENY',
    icon: 'rukawa_icon.webp',
    cost: 1500,
    files: {
      idle: 'rukawa.png',
      hits: ['rukawa_hit1.png','rukawa_hit2.png','rukawa_hit3.png','rukawa_hit4.png'],
    }
  },
  {
    id: 'suang',
    name: 'SUANG',
    sub: '500 ZENY',
    icon: 'suang_icon.webp',
    cost: 500,
    files: {
      idle: 'suang.png',
      hits: ['suang_hit1.png','suang_hit2.png','suang_hit3.png','suang_hit4.png'],
    }
  },
  {
    id: 'morgan',
    name: 'ARTHUR MORGAN',
    sub: '1,000 ZENY',
    icon: 'morgan_icon.webp',
    cost: 1000,
    files: {
      idle: 'morgan.png',
      hits: ['morgan_hit1.png','morgan_hit2.png','morgan_hit3.png','morgan_hit4.png'],
    }
  },
  {
    id: 'toei',
    name: 'TOEI (ENIGMA)',
    sub: '10,000 ZENY',
    icon: 'toei_icon.webp',
    auraClass: 'toei-enigma-aura',
    cost: 10000,
    files: {
      idle: 'toei.png',
      hits: ['toei_hit1.png','toei_hit2.png','toei_hit3.png','toei_hit4.png'],
    }
  },
];

function getActiveSkinId() { return (save.activeSkin) || 'default'; }
// Cache active skin — อัปเดตเฉพาะตอน applySkin() หรือ initState()
let _cachedSkin = null;
function getActiveSkin() {
  if (!_cachedSkin) _cachedSkin = BOSS_SKINS.find(s => s.id === getActiveSkinId()) || BOSS_SKINS[0];
  return _cachedSkin;
}

function openBossShop() {
  _hideAllScreens();
  renderBossShop();
  $('bossScreen').style.display = 'flex';
}
function closeBossShop() {
  $('bossScreen').style.display = 'none';
  showMainMenu();
}

function renderBossShop() {
  $('bossCoinNum').textContent = formatNum(save.coins);
  const grid = $('bossSkinGrid');
  grid.innerHTML = '';
  const activeSkinId = getActiveSkinId();
  const ownedSkins = save.ownedSkins || ['default'];

  BOSS_SKINS.forEach(skin => {
    const isOwned  = ownedSkins.includes(skin.id);
    const isActive = skin.id === activeSkinId;
    const canAfford = save.coins >= skin.cost;

    const card = document.createElement('div');
    card.className = 'boss-skin-card' + (isActive ? ' active-skin' : '');

    let actionHtml = '';
    if (isOwned) {
      if (!isActive) {
        actionHtml = `<button class="boss-skin-action apply-btn" onclick="applySkin('${skin.id}')">APPLY</button>`;
      }
    } else {
      actionHtml = `
        <div style="font-size:11px;color:${canAfford?'var(--cyan)':'#444'};letter-spacing:2px;margin-bottom:4px;display:flex;align-items:center;gap:4px;justify-content:center;"><span class="css-coin" style="background:${canAfford?'var(--cyan)':'#444'}"></span> ${skin.cost.toLocaleString()}</div>
        <button class="boss-skin-action ${canAfford?'':'cant-afford'}" onclick="buyBossSkin('${skin.id}',this)">BUY</button>
      `;
    }

    card.innerHTML = `
      <img class="boss-skin-icon" src="${skin.icon}" alt="${skin.name}" onerror="this.style.background='#1a1a1a';this.src=''" decoding="async" onclick="openBossSkinPreview('${skin.id}', event)">
      <div class="boss-skin-name">${skin.name}</div>
      <div class="boss-skin-sub">${isOwned ? (isActive ? '<span class="css-check" style="color:#00ff88;display:inline-block;margin-right:4px;"></span>ใช้งานอยู่' : 'ซื้อแล้ว') : skin.sub}</div>
      ${actionHtml}
    `;
    grid.appendChild(card);
  });
}

function openBossSkinPreview(id, event) {
  if (event) event.stopPropagation();
  const skin = BOSS_SKINS.find(s => s.id === id);
  if (!skin) return;
  const img = $('bossSkinModalImg');
  img.src = skin.icon || '';
  img.alt = skin.name;
  $('bossSkinModalName').textContent = skin.name;
  $('bossSkinModal').style.display = 'flex';
}

function closeBossSkinPreview() {
  $('bossSkinModal').style.display = 'none';
}

function buyBossSkin(id, btnEl) {
  const skin = BOSS_SKINS.find(s => s.id === id);
  if (!skin) return;
  if (save.coins < skin.cost) {
    _shopCantAffordFeedback(btnEl, btnEl && btnEl.previousElementSibling);
    return;
  }
  save.coins -= skin.cost;
  if (!save.ownedSkins) save.ownedSkins = ['default'];
  if (!save.ownedSkins.includes(id)) save.ownedSkins.push(id);
  markSaveDirty('shop_purchase');
  doSave();
  scheduleCloudSync('shop_purchase');
  renderBossShop();
  $('bossCoinNum').textContent = formatNum(save.coins);
}

function applySkin(id) {
  save.activeSkin = id;
  _cachedSkin = null;
  markSaveDirty('inventory_changed');
  doSave();
  scheduleCloudSync('inventory_changed');
  // preload ภาพ skin ที่เลือก ทันที
  const sk = BOSS_SKINS.find(s=>s.id===id);
  if(sk){ _preloadImg(sk.files.idle); sk.files.hits.forEach(_preloadImg); }
  // apply/remove skin-specific aura
  _applyBossSkinAura(id);
  renderBossShop();
}

function _applyBossSkinAura(skinId) {
  const fighter = $('fighter');
  if(!fighter) return;
  const auraClasses = BOSS_SKINS.map(s => s.auraClass).filter(Boolean);
  if(auraClasses.length) fighter.classList.remove(...auraClasses);
  clearTimeout(fighter._xuangAuraHitTimer);
  fighter.classList.remove('xuang-aura-hit');
  const skin = BOSS_SKINS.find(s => s.id === skinId);
  if(skin && skin.auraClass) fighter.classList.add(skin.auraClass);
}

function _pulseBossSkinAura() {
  const fighter = $('fighter');
  if(!fighter || !fighter.classList.contains('xuang-blood-aura')) return;
  if(PRESSURE._explosionRunning) return; // suppress during BREAK explosion to avoid stacking filters
  if(PRESSURE.phase !== 'idle') return; // suppress during buildup and BREAK to avoid visual stacking
  fighter.classList.add('xuang-aura-hit');
  clearTimeout(fighter._xuangAuraHitTimer);
  fighter._xuangAuraHitTimer = setTimeout(() => fighter.classList.remove('xuang-aura-hit'), 180);
}

// ══════════════════════════════════════════
// ARENA SKIN
// ══════════════════════════════════════════
const ARENA_SKINS = [
  {
    id: 'default',
    name: 'RAJADAMNERN\nSTADIUM',
    sub: 'Default Arena',
    preview: 'default_bg.webp',
    bg: 'default_bg.webp',
    cost: 0,
  },
  {
    id: 'one_championship',
    name: 'ONE\nCHAMPIONSHIP',
    sub: '500 ZENY',
    preview: 'one_bg.webp',
    bg: 'one_bg.webp',
    cost: 500,
  },
  {
    id: 'colosseum',
    name: 'COLOSSEUM',
    sub: '500 ZENY',
    preview: 'colosseum_bg.webp',
    bg: 'colosseum_bg.webp',
    cost: 500,
  },
];
function getActiveArenaId() { return (save.activeArena) || 'default'; }

function _applyArenaBg() {
  const arenaId = getActiveArenaId();
  const arena = ARENA_SKINS.find(a => a.id === arenaId) || ARENA_SKINS[0];
  const bgEl = document.getElementById('bg');
  if (bgEl) {
    bgEl.style.background =
      'radial-gradient(ellipse at 50% 80%, rgba(26,0,0,0.15), rgba(0,0,0,0.22)), url("' + arena.bg + '") center/cover no-repeat';
  }
}

function openArenaShop() {
  _hideAllScreens();
  renderArenaShop();
  $('arenaScreen').style.display = 'flex';
}
function closeArenaShop() {
  $('arenaScreen').style.display = 'none';
  showMainMenu();
}

// วาด preview ลง canvas จาก _imgObjCache — เรียกนอก loop ไม่สร้าง closure ซ้ำ
function _drawArenaPreview(canvasEl, src) {
  const ctx = canvasEl.getContext('2d');
  function _doDraw(imgEl) {
    if (!imgEl || !imgEl.naturalWidth) return;
    const cw = canvasEl.width, ch = canvasEl.height;
    const iw = imgEl.naturalWidth, ih = imgEl.naturalHeight;
    const scale = Math.max(cw/iw, ch/ih);
    const dw = iw*scale, dh = ih*scale;
    ctx.clearRect(0,0,cw,ch);
    ctx.drawImage(imgEl, (cw-dw)/2, (ch-dh)/2, dw, dh);
  }
  const cached = _imgObjCache[src];
  if (cached && cached.complete && cached.naturalWidth) {
    _doDraw(cached);
  } else {
    const img = cached || new Image();
    img.onload = () => _doDraw(img);
    if (!cached) { _imgObjCache[src] = img; img.src = src; }
  }
}

function renderArenaShop() {
  $('arenaCoinNum').textContent = formatNum(save.coins);
  const grid = $('arenaSkinGrid');
  grid.innerHTML = '';
  const activeArenaId = getActiveArenaId();
  const ownedArenas = save.ownedArenas || ['default'];

  ARENA_SKINS.forEach(arena => {
    const isOwned  = ownedArenas.includes(arena.id);
    const isActive = arena.id === activeArenaId;
    const canAfford = save.coins >= arena.cost;

    // build actionHtml ก่อน
    let actionHtml = '';
    if (isOwned) {
      if (!isActive) actionHtml = `<button class="arena-skin-action apply-arena-btn" onclick="applyArena('${arena.id}')">APPLY</button>`;
    } else {
      actionHtml = `
        <div style="font-size:11px;color:${canAfford?'#00b4ff':'#444'};letter-spacing:2px;margin-bottom:4px;display:flex;align-items:center;gap:4px;justify-content:center;"><span class="css-coin" style="background:${canAfford?'#00b4ff':'#444'}"></span> ${arena.cost.toLocaleString()}</div>
        <button class="arena-skin-action ${canAfford?'':'cant-afford'}" onclick="buyArena('${arena.id}',this)">BUY</button>
      `;
    }

    const card = document.createElement('div');
    card.className = 'arena-skin-card' + (isActive ? ' active-arena' : '');

    // ใช้ canvas วาด preview จาก _imgObjCache ที่ preload ไว้แล้ว — ไม่มีปัญหา path/base64
    const canvas = document.createElement('canvas');
    canvas.className = 'arena-skin-preview';
    canvas.width  = 300;
    canvas.height = 120;
    canvas.style.cssText = 'width:100%;height:70px;border-radius:6px;border:1px solid #333;background:#1a1a1a;display:block;image-rendering:auto;';

    _drawArenaPreview(canvas, arena.preview);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'arena-skin-name';
    nameDiv.innerHTML = arena.name.replace(/\n/g,'<br>');

    const subDiv = document.createElement('div');
    subDiv.className = 'arena-skin-sub';
    subDiv.innerHTML = isOwned ? (isActive ? '<span class="css-check" style="color:#00ff88;display:inline-block;margin-right:4px;"></span>ใช้งานอยู่' : 'ซื้อแล้ว') : arena.sub;

    card.appendChild(canvas);
    card.appendChild(nameDiv);
    card.appendChild(subDiv);
    card.insertAdjacentHTML('beforeend', actionHtml);
    grid.appendChild(card);
  });
}

function buyArena(id, btnEl) {
  const arena = ARENA_SKINS.find(a => a.id === id);
  if (!arena) return;
  if (save.coins < arena.cost) {
    _shopCantAffordFeedback(btnEl, btnEl && btnEl.previousElementSibling);
    return;
  }
  save.coins -= arena.cost;
  if (!save.ownedArenas) save.ownedArenas = ['default'];
  if (!save.ownedArenas.includes(id)) save.ownedArenas.push(id);
  markSaveDirty('shop_purchase');
  doSave();
  scheduleCloudSync('shop_purchase');
  renderArenaShop();
  // sync coin display ทุกหน้า
  $('arenaCoinNum').textContent = formatNum(save.coins);
  if ($('menuCoinNum'))  $('menuCoinNum').textContent  = formatNum(save.coins);
  if ($('shopCoinNum'))  $('shopCoinNum').textContent  = formatNum(save.coins);
  if ($('bossCoinNum'))  $('bossCoinNum').textContent  = formatNum(save.coins);
}

function applyArena(id) {
  save.activeArena = id;
  markSaveDirty('inventory_changed');
  doSave();
  scheduleCloudSync('inventory_changed');
  _applyArenaBg();
  renderArenaShop();
}

// ══════════════════════════════════════════
// GAME STATE — ตัวแปร runtime ทั้งหมด
// ══════════════════════════════════════════

// Combo & timing
let combo, lastHitTime, lastIndex;

// Overdrive
let godLevel, canEnterGod, godTimeout, godInterval, godHitCount;
// Run-scoped count of OD activations (Lv1 entries) this run — result-screen display only.
let odActivations;

// ── Infinite Tap Ramp ──
// Normal taps (including OD extra hits) accumulate bossTapCount.
// Damage bonus = bossTapCount * 0.02 (+2% per tap — 50 taps = +100%, 100 = +200%, no cap).
// WP, BREAK, AK47 and passive damage are excluded.
// Resets on boss KO, idle >1500ms, defeat, restart, or new run.
let bossTapCount = 0, lastTapTime = 0;

// HP & boss
let hp, maxHP, bossHP, bossMaxHP, isBoss, bossPhase;

// Score & economy
let ko, score, maxCombo, annihilationCount, roundCoins;

// Timer & loop
let gameRunning, gamePaused = false, timerInterval, timeLeft, godSecondsLeft, waveKO;

// Weak Point system
let wpActive = false, wpTimeout = null, wpSchedule = null;
let wpCollected = 0, wpRound = 1, wpCompletions = 0, wp5FirstDone = false;
const WP_MAX_BASE = 5;
function getWpMax() {
  return (window._csState && window._csState.cs_moonlightflower) ? 3 : WP_MAX_BASE;
}
// backward-compat alias
Object.defineProperty(window, 'WP_MAX', { get: () => getWpMax() });
const WP_ROUND_MULT = [1, 1.5, 2.2, 3.2, 5.0]; // ตัวคูณดาเมจระเบิดรอบ 1-5
function initState() {
  hp = maxHP = 500;
  bossHP = bossMaxHP = 0;
  isBoss = false; bossPhase = 1;
  combo = 1; lastHitTime = 0; lastIndex = -1;
  godLevel = 0; canEnterGod = true; godHitCount = 0; odActivations = 0;
  bossTapCount = 0; lastTapTime = 0;
  ko = 0; score = 0; maxCombo = 0; annihilationCount = 0; roundCoins = 0;
  // BAPHOBET DEVIL TAX: clear any cinematic state from a prior run
  _baphTaxActive = false; window._baphTaxDrain = null;
  waveKO = 0; timeLeft = 60;
  window._bossesDefeated = 0;
  wpCollected = 0;
  wpRound = 1;
  wpCompletions = 0;
  wp5FirstDone = false;
  _lastWpPos = null; // AK47 Safe Spawn: clear previous position on new round
  _ocaDropCount = 0; // OCA Drop System — reset per-round cap
  // ── Weekly Challenge: reset per-run counters ──
  window._wqRunBreakSuccess = 0;
  window._wqRunAk47Complete = 0;
  window._wqRunKO           = 0;
  pressureReset();
  updateWpCounter();
  gun.style.display = 'none';
  // invalidate skin cache + preload skin ที่ active อยู่
  _cachedSkin = null;
  const _sk = getActiveSkin();
  _preloadImg(_sk.files.idle); _sk.files.hits.forEach(_preloadImg);
  boxerSetImg(_sk.files.idle);
  _applyBossSkinAura(_sk.id);
  _el.bossBar.style.display = 'none';
  _el.godLevelWrap.style.display = 'none';
  _resetOdBadge();
  updateOdScreenAura(0);
  updateUI();
  // HUD RESET: force the timer/combo/multi-badge DOM text to the fresh values
  // set above — without this the previous run's numbers stay on screen through
  // the whole GET READY → GO! countdown, only snapping once play actually starts.
  renderTimer();
  updateComboUI();
  _el.multiBadge.classList.remove('show');
  rebuildStatCache();
  _resetHpTier();
  // Hit-number pool: prewarm nodes on first run, reset aggregation state on every run
  _hnEnsurePrewarm();
  _hnReset();
}

function scheduleWeakPoint() {
  clearTimeout(wpSchedule);
  wpSchedule = null;
  if(!gameRunning) return;
  if(typeof pressureIsBreak === 'function' && pressureIsBreak()) return;
  // RSX-0806: ไม่มี AK47 เลย
  if(window._csState && window._csState.cs_rsx0806) return;
  let delay = 800 + Math.random()*400;
  // MOONLIGHT FLOWER: spawn x2 เร็วขึ้น
  if(window._csState && window._csState.cs_moonlightflower) delay *= 0.5;
  // MARINA: spawn เร็วขึ้น 15%
  if(window._csState && window._csState.cs_marinaSpawn) delay *= 0.85;
  // EXECUTIONER: spawn เร็วขึ้น x2 เมื่อ HP < 25%
  if(window._csState && window._csState._executionModeEndTime && performance.now() < window._csState._executionModeEndTime) delay *= 0.65;
  if(window._csState && window._csState._amogAkBoostEndTime && performance.now() < window._csState._amogAkBoostEndTime) delay *= 0.70;
  // WHISPER: spawn ช้าลง 2 เท่า
  if(window._csState && window._csState.cs_whisper) delay *= (1 - Math.min(0.40, (window._csState.cs_ak47DuplicateChance||0) * 0.5));
  // HYDRA: burst window speeds AK47 spawn
  if(window._csState && window._csState.cs_hydra && window._csState._hydraBurstEndTime && performance.now() < window._csState._hydraBurstEndTime) delay *= 0.80;
  if(window._csState && window._csState.cs_incantation && window._csState._incantationContractEndTime && performance.now() < window._csState._incantationContractEndTime) delay *= 0.75;
  // LORD OF DEBT: ANALYZED state — AK47 spawn +35%
  if(window._csState && window._csState.cs_lordofdeath && window._csState._lod_akSpawnFast) delay *= (1 - window._csState._lod_akSpawnFast);
  // DEVILINGO: 15 วิแรกของ encounter → AK47 spawn +20% เร็วขึ้น
  if(window._csState && window._csState.cs_devilingo && window._csState._devilingoCombatStart && Date.now() - window._csState._devilingoCombatStart <= 15000) delay *= 0.80;
  wpSchedule = setTimeout(showWeakPoint, delay);
}

// ══════════════════════════════════════════════════════════════
// AK47 SAFE SPAWN SYSTEM — NOCTISAK47: OVERDRIVE RAMPAGE
// ──────────────────────────────────────────────────────────────
// Guarantees AK47 weakpoints:
//   • Never clip off-screen or under UI elements
//   • Always fully tappable on mobile portrait
//   • Minimum distance from other active WPs
//   • Slight bias toward boss center-mass
//   • Accounts for WP icon size + LOD/Hydra scale bonuses
// ══════════════════════════════════════════════════════════════

function _getWpSafeRegion() {
  const W = vvW(), H = vvH();

  // ── Base icon radius (70px / 2 = 35) + glow bleed (≈8px)
  // Scale bonus from LOD Hunter (+20%) and other card effects
  const cs = window._csState;
  const scaleBonus = (cs && cs.cs_lordofdeath && cs._lod_wpSizeBonus) ? cs._lod_wpSizeBonus : 0;
  // Hydra: each head adds a subtle visual size bump (≈+6% per head)
  const hydraBonus = (cs && cs.cs_hydra) ? Math.min(0.18, (cs._hydraHeads || 0) * 0.06) : 0;
  const totalScale = 1 + scaleBonus + hydraBonus;
  const iconRadius = Math.ceil(35 * totalScale) + 10; // icon half-width + glow + tap buffer

  // ── Viewport-based safe padding (12% W / 15% H)
  // Clamped so it never shrinks below icon radius on tiny screens
  const padX = Math.max(iconRadius, Math.round(W * 0.12));
  const padY = Math.max(iconRadius, Math.round(H * 0.15));

  // ── Hard UI clearance zones (measured from actual CSS positions)
  // topUI: abs top, roughly 110–130px on most phones at standard scale
  const topUIClear   = Math.max(padY, 130);
  // wpCounter: bottom:75px + slots ~50px + label ~20px → clear 155px from bottom
  const bottomUIClear = Math.max(padY, 160);
  // comboWrap: abs left:12px, font up to 110px wide; clear left band
  const leftUIClear  = Math.max(padX, 0);   // padX already covers this
  // godLevelWrap: abs right:12px, ~80px wide; clear right band
  const rightUIClear = Math.max(padX, 0);   // padX already covers this
  // lodCardDisplay: abs left clamp(18px,5vw,30px), bottom:80px, ~72px wide, ~96px tall
  const lodCardRight = Math.min(30, W * 0.05) + 80; // approx right edge

  return {
    W, H,
    iconRadius,
    // Final spawn bounds (center of WP must stay inside)
    minX: leftUIClear,
    maxX: W - rightUIClear,
    minY: topUIClear,
    maxY: H - bottomUIClear,
    // UI exclusion zones for mid-screen side HUD
    // comboWrap: left 0–(120+padX)px, vertical 30%–70% of screen
    comboZone:   { x1: 0,         x2: 120 + padX * 0.5, y1: H * 0.30, y2: H * 0.70 },
    // godLevelWrap: right (W-100-padX)–W px, vertical 30%–70%
    godZone:     { x1: W - 100 - padX * 0.5, x2: W,   y1: H * 0.30, y2: H * 0.70 },
    // lodCardDisplay: bottom-left band
    lodZone:     { x1: 0, x2: lodCardRight + 20, y1: H * 0.60, y2: H - 60 },
    // Boss center-mass for spawn bias (vertical center of combat area)
    bossCX: W * 0.50,
    bossCY: H * 0.42,
  };
}

function _wpInExclusionZone(px, py, zone) {
  return px >= zone.x1 && px <= zone.x2 && py >= zone.y1 && py <= zone.y2;
}

// Track last accepted WP position for minimum-distance check
let _lastWpPos = null;

function showWeakPoint() {
  wpSchedule = null;
  if(!gameRunning || wpActive) return;
  if(typeof pressureIsBreak === 'function' && pressureIsBreak()) return;

  const wp = $('weakPoint');
  const reg = _getWpSafeRegion();
  const { W, H, minX, maxX, minY, maxY, iconRadius } = reg;

  // Minimum spacing between active WPs (10–14% vw)
  const minSpacing = Math.round(W * 0.12);

  // Boss-center bias: blend random position toward boss center-mass
  // 40% pull toward (bossCX, bossCY) — keeps spawns intentional, not corner-hunting
  const BIAS = 0.40;

  let px, py;
  let accepted = false;
  const MAX_ATTEMPTS = 30;

  for(let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Raw random within safe region
    const rx = minX + Math.random() * (maxX - minX);
    const ry = minY + Math.random() * (maxY - minY);

    // Apply boss-center bias
    const bx = rx + (reg.bossCX - rx) * BIAS * Math.random();
    const by = ry + (reg.bossCY - ry) * BIAS * Math.random();

    // Clamp back to safe region (bias can pull toward edge on narrow screens)
    px = Math.max(minX, Math.min(maxX, bx));
    py = Math.max(minY, Math.min(maxY, by));

    // ── Reject: inside side-HUD exclusion zones
    if(_wpInExclusionZone(px, py, reg.comboZone)) continue;
    if(_wpInExclusionZone(px, py, reg.godZone))   continue;
    if(_wpInExclusionZone(px, py, reg.lodZone))   continue;

    // ── Reject: too close to last WP position (anti-overlap)
    if(_lastWpPos) {
      const dist = Math.hypot(px - _lastWpPos.x, py - _lastWpPos.y);
      if(dist < minSpacing && attempt < MAX_ATTEMPTS - 5) continue; // relax on final attempts
    }

    accepted = true;
    break;
  }

  // Absolute fallback: guaranteed safe center if all attempts exhausted
  if(!accepted) {
    px = W * 0.50;
    py = H * 0.42;
  }

  // Clamp icon center so icon body never clips viewport edges
  px = Math.max(iconRadius, Math.min(W - iconRadius, px));
  py = Math.max(iconRadius, Math.min(H - iconRadius, py));

  _lastWpPos = { x: px, y: py };

  wp.style.left = px + 'px';
  wp.style.top  = py + 'px';
  wp.style.display = 'block';
  wp.classList.remove('wp-vanish');
  wp.classList.remove('wp-treasure');
  wpActive = true;

  // ── Duration: 1.0–1.4s base + card bonuses (unchanged)
  const _wpDurationBonus = (window._csState && window._csState.cs_wpDuration) ? window._csState.cs_wpDuration * 1000 : 0;
  // LORD OF DEBT: HUNTER state — AK47 visible time +40%
  const _lodHunterDurBonus = (window._csState && window._csState.cs_lordofdeath && window._csState._lod_wpDurationBonus)
    ? (1000 + Math.random()*400) * window._csState._lod_wpDurationBonus : 0;
  let ttl = 1000 + Math.random()*400 + _wpDurationBonus + _lodHunterDurBonus;

  // ── Scale: LORD OF DEBT HUNTER +20% (unchanged, scale is purely visual)
  if(window._csState && window._csState.cs_lordofdeath && window._csState._lod_wpSizeBonus) {
    wp.style.transform = `translate(-50%,-50%) scale(${1 + window._csState._lod_wpSizeBonus})`;
  } else {
    wp.style.transform = '';
  }

  // ── DRAKE — X MARKS THE SPOT: turn this weak point into a golden treasure ──
  const _drakeCs = window._csState;
  if(_drakeCs && _drakeCs.cs_drakeTreasure && _drakeCs._drakeArmed && !_drakeCs._drakeWpActive) {
    _drakeCs._drakeArmed = false;      // consume the arm — one treasure per cycle
    _drakeCs._drakeWpActive = true;    // this WP carries the plunder reward
    wp.classList.add('wp-treasure');
    ttl = DRAKE_TREASURE_TTL;          // fair, slightly longer window for the big take
  }

  wpTimeout = setTimeout(hideWeakPoint, ttl);
}

function hideWeakPoint(hit=false) {
  clearTimeout(wpTimeout);
  wpActive = false;
  const wp = $('weakPoint');
  wp.classList.add('wp-vanish');
  wp.classList.remove('wp-treasure');
  // DRAKE — treasure slipped away on a miss (fizzle, no extra penalty). On a hit,
  // keep _drakeWpActive set so csOnWpHit can pay out DRAKE PLUNDER.
  if(!hit && window._csState && window._csState._drakeWpActive) window._csState._drakeWpActive = false;
  setTimeout(()=>{ wp.style.display='none'; wp.classList.remove('wp-vanish'); }, 200);
  if(!hit) {
    // พลาด WP → reset counter กลับ 0! (ห้ามพลาดแม้แต่อันเดียว)
    if(wpCollected > 0) {
      wpCollected = 0;
      updateWpCounter();
      showWpMissPenalty();
    }
    if(typeof pressureOnWeakPointMiss === 'function') pressureOnWeakPointMiss();
    if(typeof csOnWpMiss === 'function') csOnWpMiss();
    scheduleWeakPoint();
  }
}

function checkWeakPointHit(rawX, rawY) {
  // rawX/rawY = e.clientX / e.clientY ไม่ต้อง offset (getBoundingClientRect ใช้ coordinate เดียวกัน)
  if(!wpActive) return false;
  const wp = $('weakPoint');
  const r = wp.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;
  const dist = Math.hypot(rawX-cx, rawY-cy);
  return dist < r.width/2 + 22;
}

function onWeakPointHit(x, y, baseDmg, customMult) {
  if(typeof pressureIsBreak === 'function' && pressureIsBreak()) return 0;
  hideWeakPoint(true);
  playWpBall();
  if(typeof pressureOnWeakPointCollect === 'function') pressureOnWeakPointCollect();
  const mult = customMult || 4;
  const wpDmg = Math.round(baseDmg * mult);
  showWpHitFX(x, y, wpDmg);
  // per-hit camera (prio 1) — yield while a climactic shake (AK47 BOMB / boss death) dominates
  if(!cameraDominant()){
    cameraClaim(1, 300);
    document.getElementById("gameRoot").classList.remove('shake-wp'); void document.getElementById("gameRoot").offsetWidth;
    document.getElementById("gameRoot").classList.add('shake-wp');
    setTimeout(()=>document.getElementById("gameRoot").classList.remove('shake-wp'), 300);
  }
  // FLASH RULE: a weak-point collect is NOT a major event → no full-screen flash.
  // Readability comes from the distinct cyan burst + camera shake + gold number.

  // เพิ่ม counter
  wpCollected++;
  updateWpCounter();
  if(wpCollected >= WP_MAX) {
    setTimeout(()=>{ if(gameRunning) triggerBombExplosion(); }, 200);
  }

  scheduleWeakPoint(); // schedule ถัดไปทันที
  return wpDmg;
}

function updateWpCounter() {
  for(let i=0;i<WP_MAX;i++){
    const slot = $('wpSlot'+i);
    if(!slot) continue;
    slot.classList.remove('filled','ready');
    if(i < wpCollected) {
      slot.classList.add(wpCollected===WP_MAX && i===WP_MAX-1 ? 'ready' : 'filled');
    }
    if(wpCollected===WP_MAX) slot.classList.add('ready');
  }
  // แสดง round indicator
  const lbl = $('wpRoundLabel');
  if(lbl) {
    const roundColors = ['#ffcc00','#ff8800','#ff4400','#ff2233','#ff00ff'];
    lbl.textContent = 'AK47 '+wpRound+'/5';
    lbl.style.color = roundColors[(wpRound||1)-1];
  }
}

function completeWeakPointRequirementInstant() {
  if(!gameRunning) return;
  wpCollected = getWpMax();
  updateWpCounter();
  triggerBombExplosion();
}

function triggerBombExplosion() {
  if(!gameRunning) return;
  const currentRound = wpRound;
  wpCollected = 0;

  if(wpRound < 5) wpRound++;
  updateWpCounter();

  // Haptic feedback — สั่นแรงขึ้นตามรอบ
  if(navigator.vibrate) {
    const patterns = [
      [80],                    // รอบ 1
      [80, 40, 80],            // รอบ 2
      [100, 40, 100],          // รอบ 3
      [100, 40, 100, 40, 100], // รอบ 4
      [200, 60, 200, 60, 200], // รอบ 5 (สั่นหนักสุด)
    ];
    navigator.vibrate(patterns[currentRound - 1] || [100]);
  }

  // ตัวคูณดาเมจตามรอบที่เพิ่งครบ (currentRound 1–5)
  const roundMult = WP_ROUND_MULT[currentRound - 1];

  // ระเบิดทำดาเมจตามรอบ
  const bombDmg = isBoss
    ? Math.round((bossMaxHP*0.35) * roundMult * (1 + _sc.desoBns))
    : Math.round(maxHP * 2 * roundMult * (1 + _sc.desoBns));

  // screen effects — rวม reflow ไว้ครั้งเดียวลด layout thrashing
  const bf = $('bombFlash');
  bf.className='';
  document.getElementById("gameRoot").classList.remove('shake');
  void bf.offsetWidth; // reflow ครั้งเดียว
  bf.className='boom';
  // AK47 BOMB = climactic camera (prio 3) — claim dominance so per-hit shakes yield
  cameraClaim(3, 600);
  document.getElementById("gameRoot").classList.add('shake');
  setTimeout(()=>document.getElementById("gameRoot").classList.remove('shake'),600);

  // spawn particles ทั่วหน้าจอ — จำกัดจำนวนและใช้ rAF batching ลด lag
  const pCount = Math.min(6 + currentRound * 2, 16); // รอบ1=8 … รอบ5=16 (ลดจาก 30–70)
  const _W = vvW(), _H = vvH() * 0.8;
  const _pos = [];
  for(let i=0;i<pCount;i++) _pos.push([Math.random()*_W, Math.random()*_H]);
  let _pi = 0;
  (function spawnBatch(){
    const end = Math.min(_pi+4, pCount);
    for(; _pi<end; _pi++) spawnFX(_pos[_pi][0], _pos[_pi][1], true, true);
    if(_pi<pCount) requestAnimationFrame(spawnBatch);
  })();

  // apply damage — route through centralized function so hpFill always updates
  if(isBoss){
    applyBossDamage(bombDmg, 'wp-bomb');
    if(bossHP<=0) { setTimeout(()=>{ if(!gameRunning||gamePaused) return; bossKO(); }, 300); }
  } else {
    applyBossDamage(bombDmg, 'wp-bomb');
    if(hp<=0) { setTimeout(()=>{ if(!gameRunning||gamePaused) return; normalKO(); }, 300); }
  }

  // bonus score + coins (เพิ่มตามรอบ)
  const bombCoins = Math.round((4 + (currentRound - 1) * 2) * (1.25 + (_sc.coinMult||0)));

  // bonus coin เมื่อครบ 5 ลูก — เพิ่มตามจำนวนครั้งที่ครบ
  wpCompletions++;
  // ── Weekly Challenge: per-run AK47 complete counter ──
  window._wqRunAk47Complete = (window._wqRunAk47Complete || 0) + 1;
  const wpBonusTable = [10, 20, 35, 50, 75]; // ครั้งที่ 1-5
  const wpBonus = wpCompletions <= 5
    ? wpBonusTable[wpCompletions - 1]
    : 25; // ครั้งที่ 6+ ได้ 25 ต่อครั้ง
  let totalBombCoins = bombCoins + Math.round(wpBonus * (1.25 + (_sc.coinMult||0)));

  // ── BAPHOBET — SOUL CONTRACT: BLOOD MONEY (chain-scaled, no recursion) ──
  // Payout scales off the uninterrupted AK47 chain length only (NOT the bank),
  // so it floods hard but never snowballs into itself. Per-BOMB hard cap.
  const _bapCs = window._csState;
  if(_bapCs && _bapCs.cs_baphomet) {
    _bapCs._baphChain = (_bapCs._baphChain || 0) + 1;
    const _bloodMult = BAPH_CHAIN_BASE + _bapCs._baphChain * BAPH_CHAIN_STEP;
    totalBombCoins = Math.min(BAPH_BOMB_CAP, Math.round(totalBombCoins * _bloodMult));
  }

  roundCoins += totalBombCoins;
  // LORD OF DEBT: HUNTER state — AK47 reward +25%
  if(window._csState && window._csState.cs_lordofdeath && window._csState._lod_wpRewardBonus) {
    const _hunterBonus = Math.round(totalBombCoins * window._csState._lod_wpRewardBonus);
    roundCoins += _hunterBonus;
    spawnCoinPopup(_hunterBonus);
  }
  score += 500 * currentRound;
  spawnCoinPopup(totalBombCoins);

  const roundLabels = ['AK47 x1','AK47 x2','AK47 x3','AK47 x4','MAX AK47 x5'];
  const roundColors = ['#ffcc00','#ff8800','#ff4400','#ff2233','#ff00ff'];
  showBigSplash(
    'AK47 BOMB ' + roundLabels[currentRound-1],
    'x'+roundMult+' — '+bombDmg+' DMG!',
    roundColors[currentRound-1],
    currentRound === 5
  );

  // เล่นเสียงตามรอบ
  if(currentRound < 5) {
    // รอบ 1–4: เล่น wp1–wp4 ตามปกติ (รอบ 4 ก็เล่น wp4 ก่อนเลื่อนเข้า 5)
    playWpSound(currentRound);
  } else if(!wp5FirstDone) {
    // รอบ 5 ครั้งแรก → wp5.mp3 + รูป wp5.png
    wp5FirstDone = true;
    playWpSound(5);
    const sp = $('wp5Splash');
    sp.classList.remove('showSplash'); void sp.offsetWidth; sp.classList.add('showSplash');
  } else {
    // รอบ 5 ครั้งต่อๆ ไป → สุ่ม wk1–wk5 ไม่มีรูป
    playWkSound(Math.ceil(Math.random() * 5));
  }

  updateUI();

  // ── BAPHOBET — SOUL CONTRACT: hidden pity → 💀 DEVIL TAX ──
  // Blood Money owed since the last tax drives an invisible, quadratically-rising
  // collection chance. Decoupled from the chain on purpose (skill is not punished):
  // the chain scales income, _unpaidBlood scales the Devil's hunger.
  if(_bapCs && _bapCs.cs_baphomet) {
    _bapCs._unpaidBlood = (_bapCs._unpaidBlood || 0) + totalBombCoins;
    const _taxGoal = BAPH_TAX_GOAL_BASE + (ko || 0) * BAPH_TAX_GOAL_KO;
    const _bloodNorm = Math.min(1, _bapCs._unpaidBlood / _taxGoal);
    _baphometWhisper(_bloodNorm);
    if(!_baphTaxActive && Math.random() < (_bloodNorm * _bloodNorm)) _baphometDevilTax();
  }

  // FREEONI: AK47 complete → OD +35% (if inactive) OR OD timer +2s (if active)
  if(window._csState && window._csState.cs_freeoni) {
    if(godLevel > 0) {
      godSecondsLeft += 2;
    } else {
      const _fBar = _el.godFill;
      const _fCur = parseFloat(_fBar.style.width) || 0;
      _fBar.style.width = Math.min(100, _fCur + 35) + '%';
      if(parseFloat(_fBar.style.width) >= 100 && canEnterGod) activateGodLevel(1);
    }
  }
  // HYDRA: gain head on every AK47 complete (max 3)
  if(window._csState && window._csState.cs_hydra) {
    window._csState._hydraHeads = Math.min(3, (window._csState._hydraHeads || 0) + 1);
    _cardFx('head', { stack: window._csState._hydraHeads, max: 3 }); // HYDRA head pip + fang strike (cosmetic)
  }
  // DRAKE: count this AK47 chain toward arming "X MARKS THE SPOT"
  drakeOnAk47Complete();
  // THANATOS: เก็บ AK47 ครบ → OD bar เต็มทันที + เปิด OD ถ้ายังไม่ active
  if(window._csState && window._csState.cs_thanatos) {
    _el.godFill.style.width = '100%';
    if(canEnterGod && godLevel === 0) activateGodLevel(1);
    // THANABROS: ระหว่าง Thanatos Phase และ OD active → ต่อเวลา OD +1 วิ
    if(window._csState._thanatosPhaseEndTime && performance.now() < window._csState._thanatosPhaseEndTime && godLevel > 0) {
      godSecondsLeft += 1;
      updateUI();
    }
  }
  // KTULLANUX: combo protect 5s
  if(window._csState && window._csState.cs_ktullanux) {
    const ktullanuxState = window._csState;
    ktullanuxState._ktullanuxComboProtect = true;
    setTimeout(()=>{ if(window._csState === ktullanuxState) ktullanuxState._ktullanuxComboProtect = false; }, 5000);
  }
  // VALKYRIE RANDGRIS: สุ่ม effect ใหม่จาก Elite pool ทุกครั้งที่ AK47 ครบ
  if(window._csState && window._csState.cs_valkyrieRandgris) {
    _csValkyrieRandgrisSwap();
  }

  // OCA Drop System — roll for ticket drop on AK47 complete (all 5 WPs collected).
  // This is the ONLY place OCA rolls for AK47. One roll per completion.
  const _bx = window.innerWidth  / 2;
  const _by = window.innerHeight * 0.4;
  onAk47Complete(_bx, _by);
}

// ── AK47 complete OCA entry point ──
// Called ONLY when all 5 weak points have been collected (wp1–wp5 sounds play).
// ONE OCA roll per completion. No partial-progress rolls.
function onAk47Complete(x, y) {
  _cardFx('ak47', { x, y }); // Elite/Mythic VFX: เอฟเฟกต์ตอน AK47 ครบชุด (cosmetic)
  tryOcaBombDrop(x, y);
}

// ── Pooled AK47 visual FX nodes (no createElement during gameplay) ──
const _wpMissPool = [];   // showWpMissPenalty nodes
const _wpHitPool  = [];   // showWpHitFX nodes

function _getWpMissEl() {
  const el = _wpMissPool.pop() || (() => {
    const n = document.createElement('div');
    n.style.cssText = 'position:absolute;top:28%;left:50%;transform:translate(-50%,-50%);font-family:\'Oswald\',sans-serif;font-size:clamp(14px,4vw,22px);color:#ff2233;text-align:center;pointer-events:none;z-index:40;text-shadow:0 0 12px #ff0000;';
    n.innerHTML = 'X MISS — AK47 RESET';
    return n;
  })();
  return el;
}
function _getWpHitEl() {
  return _wpHitPool.pop() || (() => {
    const n = document.createElement('div');
    n.className = 'wp-hit-text';
    return n;
  })();
}

function showWpMissPenalty() {
  const root = _hnRoot || document.getElementById('gameRoot');
  if (!root) return;
  const el = _getWpMissEl();
  // Restart animation without layout read: clear class, set, re-apply
  el.className = '';
  el.style.animation = 'none';
  el.style.animation = '';
  el.className = 'hn-alt'; // toggle alt bit to force keyframe restart
  el.style.animationName = 'floatUp';
  el.style.animationDuration = '0.75s';
  el.style.animationFillMode = 'forwards';
  root.appendChild(el);
  setTimeout(() => { el.style.animation='none'; el.className=''; root.contains(el) && root.removeChild(el); _wpMissPool.length < 3 && _wpMissPool.push(el); }, 820);
  triggerFlash('flash-god3');
}

function showWpHitFX(x, y, dmg) {
  const root = _hnRoot || document.getElementById('gameRoot');
  if (!root) return;
  // ตัวเลขใหญ่สีฟ้า (cyan) — Weak Point owns cyan: no yellow, no warm glow. pooled node
  const el = _getWpHitEl();
  el.className = '';
  el.innerHTML = `<div style="font-size:clamp(36px,12vw,60px);color:#8ff0ff;text-shadow:0 0 18px #16c8ff,0 0 36px #0aa6e6;">${dmg}</div><div style="font-size:13px;letter-spacing:3px;color:#7fe9ff;margin-top:-4px;">AK47 COLLECT!</div>`;
  el.style.left = (x-60)+'px';
  el.style.top  = (y-40)+'px';
  el.className = 'wp-hit-text';
  root.appendChild(el);
  setTimeout(() => { el.className=''; root.contains(el) && root.removeChild(el); _wpHitPool.length < 3 && _wpHitPool.push(el); }, 870);
  // WEAK-POINT VISUAL LANGUAGE — reads "I hit the weak point" without text, and can
  // never be confused with a Crit (Crit = a circular ring; WP = directional pierce).
  const _wpFrag=document.createDocumentFragment();
  // PIERCE / SHATTER, never a circle (circles = normal/crit). Pool only — NO ring node
  // (fewer nodes than before): one thin cyan ENERGY STREAK punching up + two cyan-white
  // forward SHARDS. Pure cyan = "weak point"; the big cyan number carries the value.
  const _wpDir=-Math.PI/2; // up
  for(let i=0;i<3;i++){
    const p=_getParticle();
    const streak=(i===0);                               // i0 = pierce streak; i1/i2 = shards
    const angle=_wpDir + (streak?0:(i===1?-0.5:0.5)) + (Math.random()-0.5)*0.18;
    const dist=(streak?64:42)+Math.random()*34;         // streak travels farther (pierce)
    const w=streak?3:4, h=streak?13:4;                  // streak = thin tall line; shard = small
    p.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${streak?'#7fe9ff':'#bdf3ff'};--dx:${Math.cos(angle)*dist}px;--dy:${Math.sin(angle)*dist}px;animation:particle ${(streak?0.26:0.22)+Math.random()*0.1}s forwards;`;
    _wpFrag.appendChild(p);
    setTimeout(()=>{ p.remove(); _retParticle(p); },360);
  }
  fx.appendChild(_wpFrag);
}

function playBGM() {
  const bgm = $('bgmSound');
  if (!bgm) return;
  bgm.volume = _musicGain(TITLE_BGM_VOLUME);
  if (bgm.paused) bgm.play().catch(() => {});
}
function stopBGM() {
  const bgm = $('bgmSound');
  if (!bgm) return;
  bgm.pause(); bgm.currentTime = 0;
}

// ── Fight BGM — สุ่มเพลง fight1-4 วนจนจบเกม ──
let _fightBgmActive = false;
let _fightBgmCurrent = null;

function playFightBGM() {
  _fightBgmActive = true;
  _pickFightTrack();
}

// โหลด fight BGM ล่วงหน้าตั้งแต่กด play ก่อนนับถอยหลัง
function prefetchFightBGM() {
  [1,2,3,4].forEach(i => {
    const t = $('fightBgm'+i);
    if(t && t.preload === 'none') {
      t.preload = 'auto';
      t.load();
    }
  });
}
function _pickFightTrack() {
  if (!_fightBgmActive) return;
  if (_fightBgmCurrent) {
    _fightBgmCurrent.removeEventListener('ended', _pickFightTrack);
    _fightBgmCurrent.pause();
    _fightBgmCurrent.currentTime = 0;
  }
  const track = $('fightBgm' + (Math.floor(Math.random() * 4) + 1));
  if (!track) return;
  track.volume = _musicGain(FIGHT_BGM_VOLUME);
  track.currentTime = 0;
  track.play().catch(() => {});
  track.addEventListener('ended', _pickFightTrack, { once: true });
  _fightBgmCurrent = track;
}
function stopFightBGM() {
  _fightBgmActive = false;
  if (_fightBgmCurrent) {
    _fightBgmCurrent.removeEventListener('ended', _pickFightTrack);
    _fightBgmCurrent.pause();
    _fightBgmCurrent.currentTime = 0;
    _fightBgmCurrent = null;
  }
}
// ══════════════════════════════════════════
// CARD SLOT SYSTEM
// ══════════════════════════════════════════

const CARD_POOL = [
  // ── COMMON ──
  { id:'po',     name:'BORING CARD',       img:'cards/boring.png',      rarity:'standard',
    effect:'Zeny <strong>+12%</strong>',  tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_coinPct = (s.cs_coinPct||0) + 0.12; }
  },
  { id:'lu',    name:'LOONEYTIC CARD',       img:'cards/looneytic.png',     rarity:'standard',
    effect:'Crit DMG <strong>+15%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_critDmgBonus = (s.cs_critDmgBonus||0) + 0.15; }
  },
  { id:'fa',      name:'FA-BRRR CARD',         img:'cards/fa-brrr.png',       rarity:'standard',
    effect:'Combo decay ช้าลง <strong>20%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_comboDecaySlow = (s.cs_comboDecaySlow||0) + 0.20; }
  },
  { id:'co',     name:'CONBRO CARD',        img:'cards/conbro.png',      rarity:'standard',
    effect:'<strong>10%</strong> โอกาส Combo ไม่ reset', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_comboNoReset = (s.cs_comboNoReset||0) + 0.10; }
  },
  { id:'pp',   name:'PEKO PEKO CARD',     img:'cards/peko_peko.png',    rarity:'standard',
    effect:'HP ศัตรู เริ่มต้น <strong>-15%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_enemyHpReduce = (s.cs_enemyHpReduce||0) + 0.15; }
  },
  { id:'sp',      name:'SNORE CARD',         img:'cards/snore.png',       rarity:'standard',
    effect:'เวลา <strong>+3 วิ</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_extraTime = (s.cs_extraTime||0) + 3; }
  },
  { id:'pr',   name:'POPORINGO CARD',      img:'cards/poporingo.png',   rarity:'standard',
    effect:'ทุก 10 Combo: Zeny <strong>+12</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_comboMilestoneCoin = (s.cs_comboMilestoneCoin||0) + 12; }
  },

  // ── UNCOMMON ──
  { id:'zo',     name:'ZOOMBIE CARD',        img:'cards/zoombie.png',      rarity:'premium',
    effect:'KO: เวลา <strong>+0.05 วิ</strong> (สูงสุด +5 วิ)', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_koTimeBonus = true; }
  },
  { id:'sa',     name:'SALVAGE CARD',        img:'cards/salvage.png',      rarity:'premium',
    effect:'DMG <strong>+12%</strong> | BREAK: DMG <strong>+15%</strong> เพิ่ม', tradeoff:'OD charge <strong>-15%</strong>',
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_dmgBonus=(s.cs_dmgBonus||0)+0.12; s.cs_odChargePenalty=(s.cs_odChargePenalty||0)+0.15; s.cs_salvageBreak=true; }
  },
  { id:'oc',        name:'ORC WORRIER CARD',   img:'cards/orc_worrier.png',         rarity:'premium',
    effect:'Crit: OD charge <strong>+3%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_critOdCharge = (s.cs_critOdCharge||0) + 0.03; }
  },
  { id:'mu',      name:'MOMMY CARD',         img:'cards/mommy.png',       rarity:'premium',
    effect:'Combo ≥ 20: DMG <strong>+15%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_combo20Dmg = (s.cs_combo20Dmg||0) + 0.15; }
  },
  { id:'sw', name:'SKILL WORKER CARD',   img:'cards/skill_worker.png', rarity:'premium',
    effect:'<strong>+8%</strong> DMG ต่อ 10 Combo (สูงสุด +24%)', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_skelWorker = true; }
  },
  { id:'hf',  name:'HUNGER FLY CARD',    img:'cards/hunger_fly.png',  rarity:'premium',
    effect:'OD ที่ใช้: Zeny <strong>+60</strong>/รอบ', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_odCoinBonus = (s.cs_odCoinBonus||0) + 60; }
  },

  // ── RARE ──
  { id:'dg',name:'DOPPELGANGER CARD', img:'cards/doppelganger.png',rarity:'elite',
    effect:'ทุก Hit ที่สำเร็จ: เรียก <strong>SHADOW STRIKE</strong> หลัง 0.08 วิ (DMG 45%, Crit +20%)', tradeoff:null,
    shortDescription:'ทุก Hit เรียก SHADOW STRIKE หลัง 0.08 วิ\nแรง 45% + โอกาสคริ +20%',
    fullDescription:'[SHADOW STRIKE]\nทุกการโจมตีติดเงาตาม 0.08 วิ\n\n• ดาเมจ 45% ของต้นทาง\n• Crit rate +20%\n• ถ้าต้นทางเป็น Crit: เงา DMG เพิ่มเป็น 60%',
    balanceNote:'REWORK - นักลอบสังหารเงาตามจังหวะ เน้น burst เสริมแบบคุมเพดาน ปลอดภัยจาก recursive hit',
    apply(s){ s.cs_doppelShadow = true; }
  },
  { id:'hy',      name:'HYDRA CARD',         img:'cards/hydra.png',       rarity:'elite',
    effect:'AK47 ครบชุด: ได้ 1 Hydra Head (สูงสุด 3)<br>ต่อ Head: BREAK DMG <strong>+10%</strong> และ AK47 DMG <strong>+20%</strong><br>ที่ 3 Head: BREAK ถัดไปจะระเบิด <strong>Hydra Burst</strong>', tradeoff:null,
    shortDescription:'สะสม Hydra Head จาก AK47\nเต็ม 3 หัวแล้วกด BREAK ระเบิดหนัก',
    fullDescription:'[HYDRA HEAD]\nเก็บ AK47 ครบชุด → +1 หัว (สูงสุด 3)\n\nต่อหัว:\n• BREAK DMG +10%\n• AK47 DMG +20%\n\n[HYDRA BURST]\nเมื่อมี 3 หัว\nBREAK ครั้งถัดไปจะกินหัวทั้งหมด\nระเบิดแรง + Score + AK47 spawn เร็วขึ้น 4 วิ',
    balanceNote:'REWORK - สายสะสมหัวแล้วปล่อยจังหวะเดียวแรงมาก มีหน้าต่างเร่งสปีดและความเสี่ยงจุดซ้ำ',
    apply(s){ s.cs_hydra = true; }
  },
  { id:'ph',   name:'FREEONI CARD',      img:'cards/freeoni.png',    rarity:'elite',
    effect:'AK47 Complete:<br>OD inactive → <strong>OD +35%</strong> | OD active → <strong>+2 วิ</strong><br><br>OD: AK47 hit = DMG Stack <strong>+4%</strong> (สูงสุด <strong>+40%</strong>)<br><br>BREAK: Combo <strong>-12</strong> + <strong>FREE MODE</strong> 5 วิ (CD 3 วิ)<br>FREE MODE: Combo ไม่ลด + OD ชาร์จ <strong>+50%/คลิก</strong>', tradeoff:null,
    shortDescription:'AK47 ครบ: ชาร์จ OD +35% หรือยืด OD +2 วิ\nBREAK: Combo -12 + FREE MODE 5 วิ (CD 3 วิ)',
    fullDescription:'[AK47 COMPLETE]\n• OD ไม่ active: OD +35%\n• OD active: OD time +2 วิ\n\n[ระหว่าง OD]\nตี AK47: DMG Stack +4% (สูงสุด +40%)\n\n[BREAK สำเร็จ]\n• Combo -12\n• FREE MODE 5 วิ (CD 3 วิ)\n\n[FREE MODE]\n• Combo ไม่ลด\n• OD ชาร์จ +50% ต่อคลิก\n(FREE MODE มี CD 3 วิ ป้องกัน BREAK loop)',
    balanceNote:'FIXED - เปลี่ยน "Rage" เป็น "Combo" ให้ตรงกับ code & เพิ่ม CD 3 วิ สำหรับ FREE MODE',
    apply(s){ s.cs_freeoni=true; }
  },
  { id:'tg',name:'TURTLE SHOGUN CARD',img:'cards/turtle_shogun.png',rarity:'elite',
    effect:'Combo ≥25 เปิด SHOGUN STANCE 6วิ: DMG +45% | BREAK gauge +25% | KO +250', tradeoff:'ระหว่าง STANCE คอมโบร่วงเร็วขึ้น 35%',
    shortDescription:'คอมโบ 25+ เปิด SHOGUN STANCE 6วิ\nแรงขึ้น แต่คอมโบร่วงไว',
    fullDescription:'[SHOGUN STANCE]\nเมื่อ Combo ถึง 25\nเข้า Stance 6 วิ (CD 12 วิ)\n\n• DMG +45%\n• BREAK gauge +25% ต่อแตะ\n• KO score +250',
    balanceNote:'REWORK - สายโมเมนตัม burst เป็นช่วง มีความเสี่ยงคอมโบร่วงชัดเจน',
    apply(s){ s.cs_turtleShogun = true; }
  },
  { id:'dk',      name:'DRAKE CARD',         img:'cards/drake.png',       rarity:'elite',
    effect:'ทุก 3 AK47: <strong>X MARKS THE SPOT</strong><br><br>จุดอ่อน “สมบัติ” สีทองโผล่ในชุดถัดไป (หน้าต่าง ~2.2 วิ)<br>แตะทัน → <strong>DRAKE PLUNDER</strong>:<br>• เบิร์สต์ดาเมจก้อนใหญ่<br>• ปล้น Zeny ก้อนโต (ตาม Combo)<br>• OD <strong>+12%</strong><br><br>พลาดหน้าต่าง = สมบัติหลุดมือ (ไม่มีโทษ)', tradeoff:null,
    shortDescription:'ทุก 3 AK47 → จุดอ่อนสมบัติทองโผล่\nแตะทันปล้น DRAKE PLUNDER (เบิร์สต์ + Zeny ก้อนโต)',
    fullDescription:'[X MARKS THE SPOT]\nเก็บ AK47 ครบ 3 ชุด → จุดอ่อน “สมบัติ” สีทองจะโผล่ในชุดถัดไป (หน้าต่าง ~2.2 วิ — โจรสลัดรอจังหวะปล้นครั้งใหญ่)\n\n[DRAKE PLUNDER] แตะจุดสมบัติทันเวลา:\n• เบิร์สต์ดาเมจก้อนใหญ่ใส่ศัตรู\n• ปล้น Zeny ก้อนโต (มากขึ้นตาม Combo)\n• OD +12%\n\nพลาดหน้าต่าง = สมบัติหลุดมือ (ไม่มีโทษ) ต้องสะสม AK47 ใหม่อีก 3 ชุด',
    balanceNote:'REWORK - ลบ HP threshold เดิม (เด้งทุกไฟต์) เปลี่ยนเป็นโอกาสปล้นครั้งใหญ่ทุก 3 AK47',
    apply(s){ s.cs_drakeTreasure = true; }
  },
  { id:'ak',name:'ABYSMELL KNIGHT CARD', img:'cards/abysmell_knight.png', rarity:'elite',
    shortDescription:'คอมโบ 30+ เปิด EXECUTION READY 5 วิ\nต้องคุมคอมโบเพื่อจบงานบอส',
    effect:'Combo ≥30: ได้ <strong>EXECUTION READY</strong> 5 วิ<br>ระหว่าง READY ถ้าบอส HP ≤5% จะ <strong>EXECUTE</strong> ทันที', tradeoff:null,
    fullDescription:'[EXECUTION READY]\nเมื่อ Combo ถึง 30\nเข้าสถานะ READY 5 วิ\n\nREADY จะหายเมื่อ:\n• คอมโบหลุด  • หมดเวลา\n\nระหว่าง READY:\nถ้าบอส HP ≤5% → EXECUTE ทันที\n\n[EXECUTE]\n• KO boss ทันที\n• Zeny โบนัส +30%\n• Score burst',
    balanceNote:'REWORK - สายปิดงานจังหวะสูง ต้องรักษาคอมโบและกดดันช่วงท้ายบอส ไม่ใช่พาสซีฟถาวร',
    apply(s){ s.cs_aknightExecute=true; }
  },

  // ── VOID (MVP) ──
  { id:'th',   name:'THANABROS CARD',      img:'cards/thanabros.png',    rarity:'mythic',
    effect:'AK47 DMG <strong>×2.5</strong><br>BREAK สำเร็จ: OD เต็มทันที + <strong>Thanatos Phase</strong> 5 วิ<br>(DMG ×2 & ตี AK47: OD time +1 วิ)', tradeoff:'Combo reset ทุก 10 วิ',
    shortDescription:'AK47 DMG ×2.5\nBREAK ปลด Thanatos Phase + OD เต็ม\n[TRADEOFF: Combo reset ทุก 10 วิ]',
    fullDescription:'[PASSIVE]\nAK47 DMG ×2.5\n\n[BREAK สำเร็จ]\n• OD ชาร์จเต็มทันที\n• เปิด THANATOS PHASE 5 วิ\n\n[THANATOS PHASE]\n• DMG ×2\n• ตี AK47: OD time +1 วิ\n\n[TRADEOFF]\nCombo reset เป็น 1 ทุก 10 วิ',
    balanceNote:'FIXED - เพิ่ม apply() ที่หายไป ทำให้ cs_thanatos ถูก set และ Thanatos timer เริ่มทำงาน',
    apply(s){ s.cs_thanatos = true; }
  },
  { id:'bh',   name:'BAPHOBET CARD',      img:'cards/baphobet.png',    rarity:'mythic',
    effect:'<strong>SOUL CONTRACT</strong> — AK47 ไม่มีคูลดาวน์ ยิงรัวไม่หยุด<br>ทุก AK47 BOMB: <strong>BLOOD MONEY</strong> — Zeny พุ่งตามสายโซ่ AK47 (ยิ่งต่อเนื่อง ยิ่งรวย)', tradeoff:'<strong>💀 DEVIL TAX:</strong> ยิ่งรวย ปีศาจยิ่งมาเก็บ — สุ่มริบ Zeny 40–60% ของรอบ',
    shortDescription:'ไพ่ปีศาจสายเงิน: AK47 ไม่มีคูลดาวน์ + เงินไหลเป็นน้ำ แต่ปีศาจจะมาเก็บส่วย',
    fullDescription:'[AK47 — ไม่มีคูลดาวน์]\nWeak Point เกิดใหม่ทันที ยิงรัวต่อเนื่อง\n\n[BLOOD MONEY]\nทุก AK47 BOMB จ่าย Zeny ตามความยาวสายโซ่ AK47\n(ยิ่งต่อเนื่องไม่พลาด ยิ่งจ่ายหนัก)\nพลาด WP = สายโซ่ขาด\n\n[💀 DEVIL TAX]\nยิ่งสะสม Blood Money มาก ปีศาจยิ่งมาเก็บ\nสุ่มริบ 40–60% ของ Zeny ในรอบ แล้ววนรอบใหม่',
    balanceNote:'MYTHIC FINAL - SOUL CONTRACT: 3 identities only (no-cooldown AK47 + Blood Money + DEVIL TAX). ลบ Sin Stack / Triple Strike / OD Curse เดิมออกหมด',
    apply(s){ s.cs_baphomet = true; }
  },
  { id:'eg',      name:'EDGEGA CARD',         img:'cards/edgega.png',       rarity:'mythic',
    effect:'OD Lv.1 เปิดตลอดรอบ<br>ทุก 15 วิ: <strong>Lv.2 Burst</strong> 5 วิ', tradeoff:'ล็อค OD Lv.1 ตลอดเวลา',
    shortDescription:'OD Lv.1 ถาวร\nทุก 15 วิ ปะทุ Lv.2 ชั่วคราว 5 วิ',
    fullDescription:'[PASSIVE]\nOD Lv.1 เปิดตลอดรอบ\n(ไม่สามารถเลื่อนขึ้น Lv.2 ด้วยการชาร์จปกติ)\n\n[ทุก 15 วิ]\nเปิด Lv.2 Burst 5 วิ โดยอัตโนมัติ\nหลังจบ Burst: กลับ Lv.1\n\n[TRADEOFF]\nOD ล็อคอยู่ที่ Lv.1 ตลอดเวลา',
    balanceNote:'FIXED - เพิ่ม apply() ที่หายไป ทำให้ cs_eddga ถูก set และ _csStartEddga() ทำงาน',
    apply(s){ s.cs_eddga = true; }
  },
  { id:'os',     name:'NOSIRIS CARD',        img:'cards/nosiris.png',      rarity:'mythic',
    shortDescription:'สะสม Soul Stack จาก BREAK\nปฏิเสธความตาย และเปิด JUDGMENT',
    effect:'BREAK:<br>Soul Stack +1 & Zeny <strong>+25/Stack</strong><br>(สูงสุด 5)<br><br>ครบ 5 Stack:<br><strong>JUDGMENT</strong> 8 วิ<br>• DMG ×2<br>• Zeny ×2<br>• Boss ถูกพิพากษา<br><br>เมื่อเวลาหมด:<br>หากมี Soul Stack 3+<br><strong>ปฏิเสธความตาย</strong> 1 ครั้ง<br>• เวลา +15 วิ<br>• ล้าง Soul Stack ทั้งหมด', tradeoff:null,
    fullDescription:'[SOUL STACK]\nBREAK สำเร็จ: Stack +1 (สูงสุด 5)\n• Zeny +25 ต่อ Stack\n\n[JUDGMENT]\nครบ 5 Stack: เปิด 8 วิ\n• DMG ×2\n• Zeny ×2\n\n[ปฏิเสธความตาย]\nเมื่อเวลาหมด ถ้ามี 3+ Stack\n• เวลา +15 วิ\n• ล้าง Soul Stack\n(ใช้ได้ 1 ครั้งต่อรอบ)',
    balanceNote:'POLISH - ปรับถ้อยคำให้ดูเป็น Mythic / supernatural มากขึ้น ไม่แก้ค่าเกมเพลย์',
    apply(s){ s.cs_osiris = true; }
  },
  { id:'mt',   name:'MISSSTRESS CARD',      img:'cards/missstress.png',    rarity:'mythic',
    shortDescription:'OD คลิกเพิ่ม Zeny (0.3 วิ/ครั้ง) และยืดเวลา Overdrive',
    effect:'OD:<br>คลิก = Zeny <strong>+12</strong> (ทุก 0.3 วิ) & OD timer <strong>+0.35 วิ</strong><br>(สูงสุด <strong>+4 วิ/OD</strong>) & Crit <strong>+10%</strong>', tradeoff:null,
    fullDescription:'[ระหว่าง OD]\nทุกคลิก (ทุก 0.3 วิ):\n• Zeny +12\n• OD time +0.35 วิ\n• Crit +10%\n\nยืดเวลา OD ได้สูงสุด +4 วิ ต่อรอบ OD\n(Zeny มี ICD 0.3 วิ ป้องกันการกด spam)',
    balanceNote:'FIXED - เพิ่ม ICD 300ms สำหรับ Zeny gain & ลด cap OD time จาก +6s เป็น +4s',
    apply(s){ s.cs_mistress = true; }
  },
  { id:'gb',  name:'GOLDEN BRUH CARD',    img:'cards/golden_bruh.png',  rarity:'mythic',
    shortDescription:'คอมโบเร่ง Zeny และปลด GOLD RUSH เมื่อ Max Combo\n[GOLD RUSH ไม่ซ้อนกันได้]',
    effect:'คลิก = Combo <strong>+1</strong><br>Zeny <strong>×3</strong><br>Max Combo (47): <strong>GOLD RUSH</strong> 12 วิ<br>Zeny ×9 & คลิก = +8 Zeny<br>Cooldown <strong>14 วิ</strong>', tradeoff:'OD ชาร์จไม่ได้',
    fullDescription:'[PASSIVE]\nทุกคลิก: Combo +1\nZeny ×3\n\n[GOLD RUSH]\nเมื่อ Combo เต็ม (47)\nเปิด 12 วิ (CD 14 วิ)\n\n• Zeny ×9\n• คลิก = Zeny +8\n\n(Gold Rush ใหม่จะไม่ทับ Rush ที่ยังเปิดอยู่)',
    balanceNote:'FIXED - CD 14s > Duration 12s ป้องกัน Rush chain loop ที่เคยเกิดได้',
    apply(s){ s.cs_goldenbug = true; }
  },
  { id:'oh',    name:'COKE ZERO CARD',      img:'cards/coke_zero.png',    rarity:'mythic',
    shortDescription:'เร่ง OD charge ×4 และสะสม Stack DMG จากการใช้ OD',
    effect:'OD charge <strong>×4</strong><br>OD หมด: DMG <strong>+15%</strong> Stack<br>(สูงสุด +90%)', tradeoff:'เริ่มเกมด้วยเวลา <strong>-5 วิ</strong>',
    fullDescription:'[PASSIVE]\nOD charge ×4\n\n[หลังออกจาก OD]\nDMG Stack +15%\n(สูงสุด +90%)\n\nยิ่งใช้ OD บ่อย ยิ่งแรงขึ้นเรื่อยๆ\n\n[TRADEOFF]\nเริ่มรอบด้วยเวลา -5 วิ',
    balanceNote:'FIXED - แก้ OD charge จาก ×3.5 เป็น ×4 ตามที่ระบุ & เพิ่ม tradeoff เวลา -5 วิ ในคำบรรยาย',
    apply(s){ s.cs_orchero = true; }
  },
  { id:'ld',name:'LORD OF DEBT CARD', img:'cards/lord_of_debt.png',rarity:'mythic',
    effect:'ทุก 10 วิ: <strong>DEBT CONTRACT</strong><br>สุ่มพลังต้องห้าม 8 วิ<br><br>ทุกสัญญา: DEBT STACK +1<br>• Combo decay เร็วขึ้น<br><br>BREAK สำเร็จ: ล้าง DEBT STACK', tradeoff:'ยิ่งหนี้สูง ยิ่งอันตราย',
    shortDescription:'ทุก 10 วิ:\nสุ่มรับพลังต้องห้ามชั่วคราว',
    fullDescription:'[DEBT CONTRACT]\nทุก 10 วิ ทำสัญญาหนี้ต้องสาป 8 วิ\n\nสุ่มรับพลังต้องห้าม 1 อย่าง\n\nทุกสัญญา:\nDEBT STACK +1\n\n• Combo decay เร็วขึ้น\n\n[BREAK สำเร็จ]\nล้าง DEBT STACK ทั้งหมด',
    balanceNote:'REWORK - DEBT STATE system: 10 handcrafted isolated powers, safe cleanup, non-recursive, stack pressure',
    apply(s){ s.cs_lordofdeath = true; }
  },

  // ── COMMON ใหม่ ──
  { id:'dr',      name:'DRIPZ CARD',         img:'cards/dripz.png',       rarity:'standard',
    effect:'Zeny <strong>+8%</strong> & Crit <strong>+5%</strong>', tradeoff:null,
    shortDescription:'Zeny +8% & Crit +5% ตลอดรอบ',
    fullDescription:'[PASSIVE]\nZeny +8%\nCrit +5%\n(ใช้ตลอดรอบ)',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_coinPct=(s.cs_coinPct||0)+0.08; s.cs_critChanceBonus=(s.cs_critChanceBonus||0)+0.05; }
  },
  { id:'st',    name:'STAYNOR CARD',        img:'cards/staynor.png',     rarity:'standard',
    effect:'Combo decay ช้าลง <strong>20%</strong> & ทุก 10 Combo: Zeny <strong>+6</strong>', tradeoff:null,
    shortDescription:'Combo ร่วงช้าลง 20% & ทุก 10 Combo ได้ Zeny +6',
    fullDescription:'[PASSIVE]\nCombo ร่วงช้าลง 20%\n\nทุก 10 Combo:\nZeny +6',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_comboDecaySlow=(s.cs_comboDecaySlow||0)+0.20; s.cs_comboMilestoneCoin=(s.cs_comboMilestoneCoin||0)+6; }
  },
  { id:'ro',     name:'BROCKER CARD',         img:'cards/brocker.png',      rarity:'standard',
    effect:'ทุก 10 Combo: Zeny <strong>+10</strong>', tradeoff:null,
    shortDescription:'ทุก 10 Combo ได้ Zeny +10',
    fullDescription:'[PASSIVE]\nทุกครั้งที่ Combo เป็นทวีคูณ 10:\nZeny +10',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_comboMilestoneCoin = (s.cs_comboMilestoneCoin||0) + 10; }
  },
  { id:'ca',    name:'CARAMEME CARD',        img:'cards/carameme.png',     rarity:'standard',
    effect:'HP ศัตรู เริ่มต้น <strong>-10%</strong> & เวลา <strong>+1 วิ</strong>', tradeoff:null,
    shortDescription:'HP ศัตรูลดลง 10% ตั้งแต่เริ่ม & เวลา +1 วิ',
    fullDescription:'[PASSIVE]\nHP ศัตรูทุกตัวลดลง 10%\nตั้งแต่เริ่มรอบ\n\nเวลาเริ่มต้น +1 วิ',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_enemyHpReduce=(s.cs_enemyHpReduce||0)+0.10; s.cs_extraTime=(s.cs_extraTime||0)+1; }
  },
  { id:'rf',   name:'BRODA FROG CARD',      img:'cards/broda_frog.png',   rarity:'standard',
    effect:'DMG <strong>+7%</strong>', tradeoff:null,
    shortDescription:'DMG +7% ตลอดรอบ',
    fullDescription:'[PASSIVE]\nDMG +7%',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_dmgBonus = (s.cs_dmgBonus||0) + 0.07; }
  },
  { id:'me',   name:'METALOL CARD',       img:'cards/metalol.png',    rarity:'standard',
    effect:'Combo ≥ 10: OD charge <strong>+4%</strong>/คลิก', tradeoff:null,
    shortDescription:'Combo ≥ 10: OD charge +4% ต่อคลิก',
    fullDescription:'[PASSIVE]\nเมื่อ Combo ≥ 10:\nทุกคลิกชาร์จ OD +4%',
    balanceNote:'NERF - ลดจาก +8% ไม่มีเงื่อนไข เป็น +4% เฉพาะ Combo ≥ 10 ป้องกัน OD charge เร็วกว่า Premium',
    apply(s){ s.cs_odChargeBonus = (s.cs_odChargeBonus||0) + 0.04; s.cs_metalolComboGate = true; }
  },
  { id:'ma', name:'MANGAGORA CARD',     img:'cards/mangagora.png',  rarity:'standard',
    effect:'เวลาเริ่มต้น <strong>+2 วิ</strong>', tradeoff:null,
    shortDescription:'เวลาเริ่มต้น +2 วิ',
    fullDescription:'[PASSIVE]\nเพิ่มเวลาเริ่มต้น +2 วิ',
    balanceNote:'NERF - ลดจาก +3 วิ เป็น +2 วิ ให้เหมาะสมกับระดับ Standard',
    apply(s){ s.cs_extraTime = (s.cs_extraTime||0) + 2; }
  },
  { id:'wi',     name:'WEEBLOW CARD',         img:'cards/weeblow.png',      rarity:'standard',
    effect:'Crit DMG <strong>+10%</strong> & Zeny <strong>+3%</strong>', tradeoff:null,
    shortDescription:'Crit DMG +10% & Zeny +3% ตลอดรอบ',
    fullDescription:'[PASSIVE]\nCrit DMG +10%\nZeny +3%',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_critDmgBonus=(s.cs_critDmgBonus||0)+0.10; s.cs_coinPct=(s.cs_coinPct||0)+0.03; }
  },
  { id:'an',     name:'ANDRUH CARD',         img:'cards/andruh.png',       rarity:'standard',
    effect:'DMG <strong>+6%</strong> & Zeny <strong>+5%</strong>', tradeoff:null,
    shortDescription:'DMG +6% & Zeny +5% ตลอดรอบ',
    fullDescription:'[PASSIVE]\nDMG +6%\nZeny +5%',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_dmgBonus=(s.cs_dmgBonus||0)+0.06; s.cs_coinPct=(s.cs_coinPct||0)+0.05; }
  },
  { id:'ku',     name:'COOKRE CARD',         img:'cards/cookre.png',       rarity:'standard',
    effect:'Crit <strong>+4%</strong> & Crit DMG <strong>+8%</strong>', tradeoff:null,
    shortDescription:'Crit +4% & Crit DMG +8% ตลอดรอบ',
    fullDescription:'[PASSIVE]\nCrit +4%\nCrit DMG +8%',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_critChanceBonus=(s.cs_critChanceBonus||0)+0.04; s.cs_critDmgBonus=(s.cs_critDmgBonus||0)+0.08; }
  },
  { id:'fm',     name:'FAMILIARUTO CARD',      img:'cards/familiaruto.png',    rarity:'standard',
    effect:'Zeny <strong>+6%</strong> | ทุก 10 Combo: Zeny <strong>+8</strong>', tradeoff:null,
    shortDescription:'Zeny +6% & ทุก 10 Combo ได้ Zeny +8',
    fullDescription:'[PASSIVE]\nZeny +6%\n\nทุก 10 Combo:\nZeny +8',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_coinPct=(s.cs_coinPct||0)+0.06; s.cs_comboMilestoneCoin=(s.cs_comboMilestoneCoin||0)+8; }
  },
  { id:'pi',     name:'PICK-CHU CARD',         img:'cards/pick-chu.png',       rarity:'standard',
    effect:'เวลา <strong>+2 วิ</strong> & HP ศัตรู เริ่มต้น <strong>-8%</strong>', tradeoff:null,
    shortDescription:'HP ศัตรูลดลง 8% ตั้งแต่เริ่ม & เวลา +2 วิ',
    fullDescription:'[PASSIVE]\nHP ศัตรูทุกตัวลดลง 8%\nตั้งแต่เริ่มรอบ\n\nเวลาเริ่มต้น +2 วิ',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_extraTime=(s.cs_extraTime||0)+2; s.cs_enemyHpReduce=(s.cs_enemyHpReduce||0)+0.08; }
  },
  { id:'yy',     name:'JOJOYO CARD',          img:'cards/jojoyo.png',        rarity:'standard',
    effect:'<strong>5%</strong> โอกาส Combo ไม่ reset | decay ช้าลง <strong>10%</strong>', tradeoff:null,
    shortDescription:'5% โอกาสคอมโบไม่ร่วง & Combo decay ช้าลง 10%',
    fullDescription:'[PASSIVE]\n5% โอกาสคอมโบไม่ร่วงเมื่อตีช้า\n\nCombo ร่วงช้าลง 10%',
    balanceNote:'OK - ค่าเหมาะสมกับ Standard แก้ไขเฉพาะ description',
    apply(s){ s.cs_comboNoReset=(s.cs_comboNoReset||0)+0.05; s.cs_comboDecaySlow=(s.cs_comboDecaySlow||0)+0.10; }
  },

  // ── UNCOMMON ใหม่ ──
  { id:'ew', name:'ELDER WEEBLOW CARD',  img:'cards/elder_weeblow.png',rarity:'premium',
    effect:'Combo ≥ 25: OD charge <strong>×1.5</strong>', tradeoff:null,
    shortDescription:'Combo ≥ 25: OD charge ×1.5',
    fullDescription:'[เงื่อนไข]\nเมื่อ Combo ≥ 25:\nOD charge ×1.5\n(ใช้ได้เฉพาะนอก OD)',
    balanceNote:'OK - ค่าเหมาะสมกับ Premium แก้ไขเฉพาะ description',
    apply(s){ s.cs_elderWillow = true; }
  },
  { id:'si',      name:'STONK CARD',          img:'cards/stonk.png',       rarity:'premium',
    effect:'DMG <strong>+8%</strong> | BREAK: DMG <strong>+20%</strong> เพิ่ม', tradeoff:'Combo decay เร็วขึ้น <strong>20%</strong>',
    shortDescription:'DMG +8% & ระหว่าง BREAK: DMG +20%\n[TRADE-OFF: Combo ร่วงเร็วขึ้น 20%]',
    fullDescription:'[PASSIVE]\nDMG +8%\n\n[ระหว่าง BREAK]\nDMG +20% เพิ่ม',
    balanceNote:'OK - ค่าเหมาะสมกับ Premium แก้ไขเฉพาะ description',
    apply(s){ s.cs_dmgBonus=(s.cs_dmgBonus||0)+0.08; s.cs_comboDecayFast=(s.cs_comboDecayFast||0)+0.20; s.cs_stonkBreak=true; }
  },
  { id:'nm',  name:'NIGHTMAYOR CARD',      img:'cards/nightmayor.png',   rarity:'premium',
    effect:'KO: OD charge <strong>+3%</strong>', tradeoff:null,
    shortDescription:'ทุก KO ชาร์จ OD +3%',
    fullDescription:'[เมื่อ KO ศัตรู]\nOD charge +3%\n(ใช้ได้เฉพาะนอก OD)',
    balanceNote:'OK - ค่าเหมาะสมกับ Premium แก้ไขเฉพาะ description',
    apply(s){ s.cs_koOdCharge = (s.cs_koOdCharge||0) + 0.03; }
  },
  { id:'ze',     name:'XENORC CARD',         img:'cards/xenorc.png',      rarity:'premium',
    effect:'OD ที่ใช้: DMG <strong>+6%</strong> Stack (สูงสุด +18%) | BREAK: DMG <strong>+6%</strong> เพิ่ม (Stack reset หลัง BREAK)', tradeoff:null,
    shortDescription:'ใช้ OD: DMG Stack +6% (สูงสุด +18%)\nBREAK: DMG +6% (Stack reset หลัง BREAK)',
    fullDescription:'[สะสมจากการใช้ OD]\nDMG Stack +6% ต่อครั้ง\n(สูงสุด 3 ครั้ง = +18%)\n\n[ระหว่าง BREAK]\nDMG +6% เพิ่ม\n\n[หลัง BREAK]\nStack reset กลับ 0',
    balanceNote:'NERF - ลด per-OD stack จาก +8% เป็น +6% (max +18%) และลด BREAK bonus จาก +8% เป็น +6% เพื่อให้ต่ำกว่า STONK+Elite ชัดเจน เพิ่ม reset หลัง BREAK กัน infinite accumulation',
    apply(s){ s.cs_zenorc = true; s.cs_zenorcResetOnBreak = true; }
  },
  { id:'hg',     name:'WRONG CARD',         img:'cards/wrong.png',      rarity:'premium',
    effect:'เวลา < 15 วิ: DMG <strong>+20%</strong>', tradeoff:'ขณะมีผล: Combo decay เร็วขึ้น <strong>15%</strong>',
    shortDescription:'เวลา < 15 วิ: DMG +20%\n[TRADE-OFF: Combo ร่วงเร็วขึ้น 15% ขณะมีผล]',
    fullDescription:'[เงื่อนไข]\nเมื่อเวลาเหลือ < 15 วิ:\nDMG +20%',
    balanceNote:'NERF - ลด DMG bonus จาก +35% เป็น +20% และลดหน้าต่างเวลาจาก <20s เป็น <15s เพื่อไม่ครอบคลุม 1 ใน 3 ของรอบ เพิ่ม combo decay tradeoff',
    apply(s){ s.cs_horong = true; s.cs_horongTradeoff = true; }
  },
  { id:'ry',    name:'RAYTRICK CARD',        img:'cards/raytrick.png',     rarity:'premium',
    effect:'HP ศัตรู ≤ 60%: DMG <strong>+15%</strong> (reset เมื่อ KO ศัตรู)', tradeoff:null,
    shortDescription:'HP ศัตรู ≤ 60%: DMG +15%\n(reset เมื่อ KO ศัตรูใหม่)',
    fullDescription:'[เงื่อนไข]\nเมื่อ HP ศัตรูปัจจุบัน ≤ 60%:\nDMG +15%\n\n[Reset]\nเมื่อ KO ศัตรูและศัตรูใหม่เกิด:\nต้องรอ HP ลดต่ำกว่า 60% อีกครั้ง',
    balanceNote:'FIX+NERF - แก้ _raydricActive ที่ไม่เคยถูก set ให้ทำงานจริง ลด bonus จาก +25% เป็น +15% และเพิ่ม reset on KO กัน permanent stacking',
    apply(s){ s.cs_raydric = true; s.cs_raydricResetOnKO = true; }
  },

  // ── ELITE (RARE) ใหม่ ──
  { id:'tk',   name:'TAO FUNKA CARD',      img:'cards/tao_funka.png',   rarity:'elite',
    effect:'[FUNK FEVER] หลัง BREAK สำเร็จ:<br>5 วิ • DMG <strong>+45%</strong> • Crit <strong>+20%</strong><br>• Combo gain +1 ต่อคลิก (CD 10 วิ)', tradeoff:'ระหว่าง FUNK FEVER: Combo decay เร็วขึ้น <strong>25%</strong>',
    shortDescription:'BREAK สำเร็จ: FUNK FEVER 5วิ\nDMG+45% • Crit+20% • Combo+1',
    fullDescription:'[FUNK FEVER]\nหลัง BREAK สำเร็จ\nเปิด 5 วิ (CD 10 วิ)\n\n• DMG +45%\n• Crit +20%\n• Combo gain +1 ต่อคลิก',
    balanceNote:'CLEANUP - แยกบัฟ/ความเสี่ยงชัดเจนและอ่านเร็วขึ้นบนมือถือ',
    apply(s){ s.cs_taoFunka=true; }
  },
  { id:'dc',    name:'DRUNKULA CARD',        img:'cards/drunkula.png',     rarity:'elite',
    shortDescription:'[PASSIVE] Crit DMG +35%\nCrit มีลุ้น BLOOD DRINK → OD+Zeny',
    effect:'[PASSIVE] Crit DMG <strong>+35%</strong><br><br>Crit มีโอกาส <strong>25%</strong> ติด <strong>BLOOD DRINK</strong><br>BLOOD DRINK: OD <strong>+3%</strong> และ Zeny <strong>+8</strong> (ICD 0.8 วิ)', tradeoff:null,
    fullDescription:'[PASSIVE]\nCrit DMG +35%\n\n[BLOOD DRINK]\nทุก Crit: โอกาส 25%\n• OD +3%\n• Zeny +8\n(CD 0.8 วิ)',
    balanceNote:'REWORK - สายคริตสุ่มจังหวะ เน้นเร่ง OD แบบมีเพดานผ่าน ICD',
    apply(s){ s.cs_drunkula=true; s.cs_critDmgBonus=(s.cs_critDmgBonus||0)+0.35; }
  },
  { id:'ic',name:'INCANTATION SCAMURAI CARD',img:'cards/incantation_scamurai.png',rarity:'elite',
    effect:'Combo ≥35: เปิด <strong>SCAMURAI CONTRACT</strong> 6 วิ (CD 18 วิ)<br>DMG <strong>+70%</strong> | AK47 spawn <strong>+25%</strong> | BREAK gauge <strong>+20%</strong>', tradeoff:'เมื่อหมดสัญญา Combo จะถูกรีเซ็ตเหลือ 15',
    shortDescription:'เร่งคอมโบถึง 35 เพื่อเปิดสัญญา 6 วิ\nจบสัญญาโดนตัดคอมโบเหลือ 15',
    fullDescription:'[SCAMURAI CONTRACT]\nเมื่อ Combo ถึง 35\nเปิด 6 วิ (CD 18 วิ)\n\n• DMG +70%\n• AK47 spawn +25%\n• BREAK gauge +20% ต่อแตะ',
    balanceNote:'REWORK - บูสต์แรงเป็นช่วงพร้อมค่าเสียโอกาสหลังจบ ป้องกัน uptime ถาวร',
    apply(s){ s.cs_incantation = true; }
  },
  { id:'sk',name:'STORMYNITE CARD', img:'cards/stormynite.png',rarity:'elite',
    shortDescription:'เข้า OD แล้วได้ STORM CHARGE 6 วิ\nทุก 12 คลิกจะปะทุสายฟ้า+เพิ่มเวลา',
    effect:'เข้า OD: เปิด <strong>STORM CHARGE</strong> 6 วิ<br>ระหว่างนี้ทุก 12 คลิก: timer <strong>+1 วิ</strong> + Lightning Burst DMG<br>เพิ่มเวลาได้สูงสุด <strong>+3 วิ/OD</strong>', tradeoff:null,
    fullDescription:'[STORM CHARGE]\nเมื่อเข้า OD: เปิด 6 วิ\n\nทุก 12 คลิก:\n• เวลา +1 วิ\n• Lightning Burst DMG\n(เพิ่มเวลาได้สูงสุด +3 วิ ต่อ OD)\n\n[PASSIVE]\nระหว่าง OD: DMG +30%',
    balanceNote:'REWORK - การ์ดจังหวะ OD มีเพดานเวลาแข็งแรง กันยืด OD วนลูป',
    apply(s){ s.cs_stormyKnight = true; }
  },
  { id:'dl',   name:'DORK LORD CARD',      img:'cards/dork_lord.png',   rarity:'elite',
    shortDescription:'ทุก 15วิได้ NIGHT STACK\nยิ่งแรง แต่เวลาเดินเร็วขึ้น',
    effect:'ทุก 15วิรับ NIGHT STACK (สูงสุด 5): ต่อ Stack DMG +6% / BREAK gauge +4%', tradeoff:'ต่อ Stack timer speed +3% (สูงสุด +15%) | Zeny per KO <strong>-15%</strong>',
    fullDescription:'[NIGHT STACK]\nทุก 15 วิ: +1 Stack (สูงสุด 5)\n\nต่อ Stack:\n• DMG +6%\n• BREAK gauge +4% ต่อแตะ',
    balanceNote:'REWORK - การ์ดคอร์รัปชันสะสมแบบมีเพดาน ป้องกันยืดเวลาเกินขอบเขต',
    apply(s){ s.cs_dorkLord = true; }
  },
  { id:'mf', name:'MOONLIGHT FEVER CARD', img:'cards/moonlight_fever.png', rarity:'elite',
    effect:'DMG ×2 | Zeny ×2 | OD ×2 | AK47 3 ลูก & spawn ×2 | BREAK window <strong>+0.5 วิ</strong> | KO: score <strong>+500</strong>', tradeoff:'เวลาเหลือ <strong>ครึ่งเดียว</strong>',
    shortDescription:'DMG ×2 • Zeny ×2 • OD ×2 • AK47 3ลูก • spawn ×2\nBREAK +0.5 วิ • KO score +500 | เวลาเหลือครึ่งเดียว',
    fullDescription:'[PASSIVE]\n• DMG ×2\n• Zeny ×2\n• OD charge ×2\n• AK47 3 ลูก + spawn ×2\n• BREAK window +0.5 วิ\n• KO: Score +500',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_moonlightflower = true; s.cs_breakDuration = (s.cs_breakDuration||0) + 0.5; }
  },

  // ── STANDARD ใหม่ ──
  { id:'ho',     name:'HORNYET CARD',        img:'cards/hornyet.png',      rarity:'standard',
    effect:'Crit <strong>+6%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_critChanceBonus = (s.cs_critChanceBonus||0) + 0.06; }
  },
  { id:'tb',   name:'THUG BUG CARD',     img:'cards/thug_bug.png',   rarity:'standard',
    effect:'OD charge <strong>+7%</strong>/คลิก', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_odChargeBonus = (s.cs_odChargeBonus||0) + 0.07; }
  },
  { id:'ms',  name:'MASTER BLING CARD',     img:'cards/master_bling.png',   rarity:'standard',
    effect:'ทุก 10 Combo: Zeny <strong>+15</strong> & เวลา <strong>+0.3 วิ</strong> (สูงสุด +3 วิ)', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_comboMilestoneCoin=(s.cs_comboMilestoneCoin||0)+15; s.cs_comboTimeBonus=true; }
  },

  // ── PREMIUM ใหม่ ──
  { id:'gg', name:'GENERAL GRIEVOUS CARD', img:'cards/general_grievous.png', rarity:'premium',
    effect:'DMG <strong>+8%</strong> | BREAK: DMG <strong>+22%</strong> เพิ่ม', tradeoff:'เวลา <strong>-5 วิ</strong>',
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_dmgBonus=(s.cs_dmgBonus||0)+0.08; s.cs_timePenalty=(s.cs_timePenalty||0)+5; s.cs_ggBreak=true; }
  },
  { id:'jk',       name:'JACKED CARD',          img:'cards/jacked.png',        rarity:'premium',
    effect:'OD: Crit <strong>+20%</strong> & Crit DMG <strong>+15%</strong> | BREAK: Crit <strong>+8%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_jakkCrit = true; }
  },
  { id:'mn',     name:'MARINAH CARD',        img:'cards/marinah.png',      rarity:'premium',
    effect:'AK47 spawn เร็ว <strong>+15%</strong> & BREAK window <strong>+0.35 วิ</strong> & BREAK <strong>+8%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_marinaSpawn=true; s.cs_breakDuration=(s.cs_breakDuration||0)+0.35; s.cs_breakPower=(s.cs_breakPower||0)+0.08; }
  },
  { id:'dp',name:'DEMON FUNGUS CARD',  img:'cards/demon_fungus.png',rarity:'premium',
    effect:'ทุก 5 KO: OD charge <strong>+8%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_demonPungus = true; }
  },
  { id:'vi',     name:'VITAMOE CARD',        img:'cards/vitamoe.png',      rarity:'premium',
    effect:'Combo ≥ 15: OD charge <strong>×1.25</strong>', tradeoff:'DMG <strong>-5%</strong>',
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_vitata = true; s.cs_dmgBonus=(s.cs_dmgBonus||0)-0.05; }
  },
  { id:'al',  name:'ALLEYGATOR CARD',     img:'cards/alleygator.png',   rarity:'premium',
    effect:'ทุก 6 KO: Zeny <strong>+1.5%</strong> Stack (สูงสุด +15%) & BREAK: KO นับเร็ว <strong>×2</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_alligator = true; }
  },
  { id:'ss',name:'SOLDIER SKELLYTON CARD', img:'cards/soldier_skellyton.png', rarity:'premium',
    effect:'Crit DMG <strong>+25%</strong> & Crit <strong>+4%</strong> & AK47: Crit <strong>+10%</strong> 5 วิ', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_critDmgBonus=(s.cs_critDmgBonus||0)+0.25; s.cs_critChanceBonus=(s.cs_critChanceBonus||0)+0.04; s.cs_skellytonWp=true; }
  },
  { id:'mc',     name:'MARVELC CARD',          img:'cards/marvelc.png',        rarity:'premium',
    effect:'เวลา <strong>+4 วิ</strong> | Combo decay ช้าลง <strong>15%</strong> | เวลา < 15 วิ: DMG <strong>+8%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_extraTime=(s.cs_extraTime||0)+4; s.cs_comboDecaySlow=(s.cs_comboDecaySlow||0)+0.15; s.cs_marvelcLowTime=true; }
  },
  { id:'sd', name:'SIDEWHINER CARD',    img:'cards/sidewhiner.png',  rarity:'premium',
    effect:'DMG <strong>+16%</strong>', tradeoff:'OD charge <strong>-20%</strong>',
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_dmgBonus=(s.cs_dmgBonus||0)+0.16; s.cs_odChargePenalty=(s.cs_odChargePenalty||0)+0.20; }
  },
  { id:'zr',     name:'ZERO SENPAI CARD',         img:'cards/zero_senpai.png',       rarity:'premium',
    effect:'Crit <strong>+10%</strong> & Zeny <strong>+8%</strong>', tradeoff:null,
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_critChanceBonus=(s.cs_critChanceBonus||0)+0.10; s.cs_coinPct=(s.cs_coinPct||0)+0.08; }
  },
  { id:'my',     name:'MADTYR CARD',         img:'cards/madtyr.png',       rarity:'premium',
    effect:'OD charge <strong>+10%</strong>/คลิก', tradeoff:'Combo decay เร็วขึ้น <strong>15%</strong>',
    shortDescription:'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)',
    fullDescription:'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_odChargeBonus=(s.cs_odChargeBonus||0)+0.10; s.cs_comboDecayFast=(s.cs_comboDecayFast||0)+0.15; }
  },

  // ── ELITE ใหม่ ──
  { id:'mi',   name:'MINORAGE CARD',      img:'cards/minorage.png',    rarity:'elite',
    effect:'ทุก <strong>18</strong> คลิก: +1 Ore Crack (สูงสุด 3)<br>Ore Crack: DMG <strong>+8%</strong>/stack<br>เริ่ม BREAK: ใช้ Ore Crack หมด → BREAK DMG <strong>+20%</strong>/stack<br>ใช้ครบ 3: <strong>RAGE RUSH</strong> 4s — Combo <strong>+2/คลิก</strong> • Crit <strong>+25%</strong> • DMG <strong>+25%</strong><br>HP ≤30%: เก็บ Ore Crack เร็วขึ้น (12 คลิก)', tradeoff:null,
    shortDescription:'ขุด Ore Crack ทุก 18 คลิก (สูงสุด 3) แล้วระเบิดใส่ BREAK\nDMG +8%/stack • BREAK DMG +20%/stack • ครบ 3 = RAGE RUSH 4s',
    fullDescription:'[ORE CRACK]\nทุก 18 คลิก ได้ Ore Crack (สูงสุด 3)\nแต่ละ stack: DMG +8%\n\n[เริ่ม BREAK]\nใช้ Ore Crack ทั้งหมด\nแต่ละ stack ที่ใช้: BREAK DMG +20% (เฉพาะ BREAK รอบนั้น)\n\n[RAGE RUSH] — ใช้ครบ 3 stack\nเปิด 4 วิ\n• Combo +2 ต่อคลิก\n• Crit +25%\n• DMG +25%\n\n[HP ≤ 30%]\nเก็บ Ore Crack เร็วขึ้น (ทุก 12 คลิก)',
    balanceNote:'REWORK - ORE RAGE: สะสม Ore Crack จากการคลิกแล้วระเบิดตอน BREAK แทนบัฟ HP-threshold ที่ติดเกือบถาวร',
    apply(s){ s.cs_minorous = true; }
  },
  { id:'ex',name:'EXECUSIONER CARD',   img:'cards/execusioner.png', rarity:'elite',
    effect:'[EXECUTION MODE] HP <30%:<br>5 วิ • DMG <strong>+60%</strong><br>• BREAK DMG <strong>+35%</strong><br>• AK47 spawn <strong>+35%</strong> (CD 18 วิ)', tradeoff:null,
    shortDescription:'HP <30%: EXECUTION MODE 5วิ\nDMG+60% • BREAK+35% • AK47+35%',
    fullDescription:'[EXECUTION MODE]\nเมื่อ HP ต่ำกว่า 30%\nเปิด 5 วิ (CD 18 วิ)\n\n• DMG +60%\n• BREAK DMG +35%\n• AK47 spawn +35%',
    balanceNote:'CLEANUP - ตัดข้อความซ้ำและแยกข้อดี/ข้อเสียให้อ่านง่าย',
    apply(s){ s.cs_executioner = true; }
  },
  { id:'wh',    name:'WHIZPER CARD',       img:'cards/whizper.png',     rarity:'elite',
    effect:'BREAK สำเร็จ: เปิด <strong>GHOST PROTOCOL</strong> 4 วิ (CD 10 วิ)', tradeoff:null,
    shortDescription:'BREAK สำเร็จเปิด GHOST PROTOCOL 4วิ (CD 10วิ)\nพักคอมโบ 1.2วิ + BREAK window +0.15วิ + OD +6%',
    fullDescription:'[GHOST PROTOCOL]\nหลัง BREAK สำเร็จ (CD 10 วิ)\nเปิด 4 วิ\n\n• หยุด Combo decay 1.2 วิ\n• BREAK window +0.15 วิ\n• OD +6%\n\n[PASSIVE]\n• AK47 spawn เร็วขึ้น ~17%',
    balanceNote:'REWORK - สายคุมจังหวะหลัง BREAK แบบชั่วคราว ไม่ยืดเวลา ไม่ลูป BREAK/OD และยังมีความเสี่ยงจากจุดซ้ำ',
    apply(s){ s.cs_whisper = true; s.cs_whizperGhostProtocol = true; s.cs_ak47DuplicateChance = (s.cs_ak47DuplicateChance||0) + 0.35; }
  },
  { id:'gl',name:'GOBLIN WEEBER CARD',img:'cards/goblin_weeber.png',rarity:'elite',
    effect:'คลิก = Combo <strong>+2</strong><br>Combo ≥25: DMG <strong>+20%</strong><br>Combo ≥35: คลิกซ้ำฟรี <strong>20%</strong> (ทุก 0.25 วิ)<br>Combo เต็ม (47): <strong>WEEB FOCUS</strong> 5 วิ<br>Combo ไม่ลด + OD gain <strong>+35%</strong> + Crit <strong>+20%</strong>', tradeoff:null,
    shortDescription:'ทุกคลิก Combo +2 ยิ่งคอมโบสูง ยิ่งแรง\nคอมโบเต็ม (47) ปลด WEEB FOCUS',
    fullDescription:'[PASSIVE]\nทุกคลิก: Combo +2\n\nCombo ≥25: DMG +20%\nCombo ≥35: คลิกซ้ำฟรี 20%\n(คลิกซ้ำมี ICD 0.25 วิ ป้องกัน cascade)\n\n[WEEB FOCUS]\nCombo เต็ม (47) เปิด 5 วิ\n• Combo ไม่ลด\n• OD gain +35%\n• Crit +20%',
    balanceNote:'FIXED - เพิ่ม ICD 250ms สำหรับ free-click proc ป้องกัน cascade burst',
    apply(s){ s.cs_goblinLeader = true; }
  },
  { id:'ar',     name:'AMOG RA CARD',       img:'cards/amog_ra.png',     rarity:'elite',
    effect:'ทุกครั้งที่ Combo แตะ 20 จะสุ่มผล 5วิ: 70% ได้ DMG +35% + Crit +20% | 30% SUS EVENT', tradeoff:null,
    shortDescription:'แตะคอมโบ 20 = สุ่มบัฟ 5วิ\n70% ดีจัด / 30% SUS แลกเวลา',
    fullDescription:'[AMOG GAMBLE]\nทุกครั้งที่ Combo แตะ 20\nสุ่มเอฟเฟกต์ 5 วิ (CD 8 วิ)\n\n• 70% — BLESSED\nDMG +35%, Crit +20%\n\n• 30% — SUS EVENT\nเวลา -2 วิ\nBREAK gauge +60% ต่อแตะ\nAK47 spawn +30% (4 วิ)',
    balanceNote:'REWORK - สายพนันจังหวะ มี burst สูงและความเสี่ยงคุมได้',
    apply(s){ s.cs_amogRa = true; }
  },
  { id:'mp',name:'MAYA PROBLEM CARD',    img:'cards/maya_problem.png', rarity:'elite',
    shortDescription:'BREAK แล้ว burst หนัก',
    effect:'Boss DMG <strong>+30%</strong> & Crit <strong>+10%</strong><br>BREAK สำเร็จ: Boss DMG <strong>+40%</strong> 6 วิ & Crit <strong>+25%</strong> 6 วิ', tradeoff:null,
    fullDescription:'[PASSIVE]\nBoss DMG +30%\nCrit +10%\n\n[BREAK สำเร็จ]\nBurst 6 วิ:\n• Boss DMG +40%\n• Crit +25%',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_bossDmgBonus=(s.cs_bossDmgBonus||0)+0.30; s.cs_critChanceBonus=(s.cs_critChanceBonus||0)+0.10; s.cs_mayaProblem=true; }
  },
  { id:'ed',name:'WEEBVIL DUDE CARD',     img:'cards/weebvil_dude.png',  rarity:'elite',
    effect:'เริ่มรอบ: เวลา <strong>-6 วิ</strong><br>หลัง BREAK แรกของรอบ: ปลด <strong>OTAKU AWAKENING</strong> ถาวรจนจบรอบ', tradeoff:null,
    shortDescription:'เสียเวลาเริ่มต้น 6 วิ\nแต่หลัง BREAK แรกจะปลดร่างทั้งรอบ',
    fullDescription:'[เริ่มรอบ]\nเวลา -6 วิ\n\n[OTAKU AWAKENING]\nหลัง BREAK แรก: ปลดร่างถาวรจนจบรอบ\n\n• Crit DMG +25%\n\nทุก BREAK จากนั้น:\n• BREAK burst DMG +35% (5 วิ)\n• OD gain +15% (4 วิ)',
    balanceNote:'REWORK - สายเสี่ยงต้นเกมแลกพลังปลายเกม เน้นเร่ง BREAK ให้ไวที่สุด',
    apply(s){ s.cs_timePenalty=(s.cs_timePenalty||0)+6; s.cs_weebvilDude=true; }
  },

  // ── MYTHIC ใหม่ ──
  { id:'kn',  name:'CATULLANUX CARD',     img:'cards/catullanux.png',   rarity:'mythic',
    effect:'AK47 DMG <strong>×4</strong> | AK47/BREAK: Combo lock <strong>5 วิ</strong> & BREAK <strong>+20%</strong>', tradeoff:'HP ศัตรู <strong>+50%</strong>',
    shortDescription:'AK47 DMG ×4 — เก็บ AK47/BREAK: Combo lock 5 วิ',
    fullDescription:'[PASSIVE]\nAK47 DMG ×4\n\n[AK47 ครบ หรือ BREAK สำเร็จ]\n• Combo lock 5 วิ (Combo ไม่ลด)\n• BREAK gauge +20%',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_ktullanux = true; s.cs_breakPower = (s.cs_breakPower||0) + 0.20; s.cs_enemyHpReduce = (s.cs_enemyHpReduce||0) - 0.50; }
  },
  { id:'bz',  name:'BEELZEBRUH CARD',     img:'cards/beelzebruh.png',   rarity:'mythic',
    effect:'คลิก: Corruption <strong>+0.5%</strong> (สูงสุด 50%) | >20%: BREAK <strong>+bonus</strong>/tap | [MAX + BREAK]: Zeny <strong>×1.5</strong> 8 วิ & OCA chance <strong>+50%</strong> 8 วิ', tradeoff:'HP ศัตรู เริ่มต้น <strong>×2</strong>',
    shortDescription:'สะสม Corruption ด้วยการคลิก\nMAX + BREAK = Zeny ×1.5 & OCA +50%',
    fullDescription:'[CORRUPTION]\nทุกคลิก: Corruption +0.5%\n(สูงสุด 50%)\n\n>20% Corruption:\nBREAK gauge เพิ่มต่อแตะ\n\n[BREAK สำเร็จ ที่ MAX Corruption]\nZeny ×1.5 (8 วิ)\nOCA chance +50% (8 วิ)',
    balanceNote:'BUFF - เพิ่ม duration 5→8s และเพิ่ม OCA chance +50% ระหว่าง buff window',
    apply(s){ s.cs_beelzebub = true; }
  },
  { id:'vr', name:'VALKYRIZZ CARD', img:'cards/valkyrizz.png', rarity:'mythic',
    effect:'AK47ครบ/BREAK: สุ่ม effect ใหม่จาก <strong>ELITE pool</strong>', tradeoff:null,
    shortDescription:'AK47 ครบ / BREAK สำเร็จ\nสุ่มรับพลัง ELITE ใหม่ (ถาวรจนกว่าจะ swap ครั้งต่อไป)',
    fullDescription:'[VALKYRIE SWAP]\nทุกครั้งที่ AK47 ครบ\nหรือ BREAK สำเร็จ\n\nสุ่มรับพลัง Elite card 1 อย่าง\nมีผลถาวรจนกว่าจะ swap ครั้งถัดไป',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_valkyrieRandgris = true; }
  },
  { id:'at',     name:'ATROSUS CARD',        img:'cards/atrosus.png',      rarity:'mythic',
    effect:'BREAK: <strong>Resonance</strong> 6 วิ (DMG <strong>×1.6</strong>) | Crit ใน Resonance: <strong>+0.4 วิ</strong> (สูงสุด +4 วิ) | 3 Resonance: <strong>Resonant Mastery</strong> (10 วิ & ×2)', tradeoff:null,
    shortDescription:'BREAK ปลด Resonance DMG ×1.6\nCrit ในขณะ Resonance ยืดเวลา',
    fullDescription:'[RESONANCE]\nBREAK สำเร็จ: เปิด 6 วิ\n• DMG ×1.6\n\nระหว่าง Resonance:\nทุก Crit: +0.4 วิ (สูงสุด +4 วิ)\n\n[RESONANT MASTERY]\nครบ 3 Resonance:\n• Resonance เปิด 10 วิ\n• DMG ×2',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_atrosusBreak=true; }
  },
  { id:'kl', name:'KILL-D01 CARD',     img:'cards/kill-d01.png',   rarity:'mythic',
    effect:'OD charge <strong>+12%</strong> | คลิก = OD timer <strong>+0.05 วิ</strong> (สูงสุด <strong>+5 วิ/OD</strong>) | OD: ทุก 3 คลิก = <strong>Drive Token</strong> (สูงสุด 8) | BREAK: Token = BREAK <strong>+8%</strong> & Zeny <strong>+30</strong> | 8 Tokens: Execution 4 วิ (DMG <strong>×1.5</strong>)', tradeoff:null,
    shortDescription:'สะสม Drive Token ใน OD\nBREAK ใช้ Token ระเบิดพลัง',
    fullDescription:'[PASSIVE]\nOD charge +12%\nทุกคลิก: OD time +0.05 วิ (สูงสุด +5 วิ/OD)\n\n[ระหว่าง OD]\nทุก 3 คลิก: Drive Token +1 (สูงสุด 8)\n\n[BREAK สำเร็จ]\nต่อ Token: BREAK +8%, Zeny +30\n\n[8 Tokens]\nDrive Discharge 4 วิ: DMG ×1.5',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_killD01=true; s.cs_odChargeBonus=(s.cs_odChargeBonus||0)+0.12; s.cs_odTimerOnClick=(s.cs_odTimerOnClick||0)+0.05; }
  },
  { id:'if',     name:'IFRIED CARD',         img:'cards/ifried.png',       rarity:'mythic',
    effect:'Crit: <strong>Inferno Stack</strong> +1 (สูงสุด 15) | Crit DMG <strong>+20%</strong> | BREAK & >5 Stacks: <strong>+2%/Stack</strong> extra | ≥10 Stacks & BREAK: <strong>Inferno Burst</strong> 5 วิ (DMG ×2.5 & Crit <strong>+25%</strong>)', tradeoff:'HP ศัตรู เริ่มต้น <strong>+20%</strong>',
    shortDescription:'Crit สะสม Inferno Stack\nครบ 10 + BREAK ปลด Inferno Burst',
    fullDescription:'[INFERNO STACK]\nทุก Crit: Stack +1 (สูงสุด 15)\n• Crit DMG +20%\n\nBREAK + >5 Stacks:\nBREAK gauge +2% ต่อ Stack\n\n[INFERNO BURST]\n≥10 Stacks + BREAK สำเร็จ\n• DMG ×2.5\n• Crit +25%\n• นาน 5 วิ',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_critDmgBonus=(s.cs_critDmgBonus||0)+0.20; s.cs_enemyHpReduce=(s.cs_enemyHpReduce||0)-0.20; s.cs_ifriedBreak=true; }
  },
  { id:'rx',    name:'RSICK-0806 CARD',      img:'cards/rsick-0806.png',    rarity:'mythic',
    effect:'DMG <strong>×2.5</strong> | BREAK <strong>+30%</strong>/tap | KO: score <strong>+500</strong> | BREAK: DMG <strong>+12%</strong> Stack (สูงสุด +60%) & <strong>Execution Phase</strong> 8 วิ (DMG ×1.5)', tradeoff:'ไม่มี OD & ไม่มี AK47',
    shortDescription:'DMG ×2.5 สายบุกล้วน\nBREAK สะสม Execution Stack',
    fullDescription:'[PASSIVE]\nDMG ×2.5\nBREAK gauge +30% ต่อแตะ\nKO: Score +500\n\n[BREAK สำเร็จ]\nExecution Stack +12% (สูงสุด +60%)\nExecution Phase 8 วิ: DMG ×1.5',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_rsx0806 = true; s.cs_breakPower = (s.cs_breakPower||0) + 0.30; }
  },

  // ── PREMIUM NEW (v2) ──
  { id:'als', name:'A-LIST CARD',          img:'cards/alist_card.png',          rarity:'premium',
    effect:'Boss KO: Zeny <strong>+12%</strong> | BREAK: <strong>Sponsor Rush</strong> 5 วิ (Zeny +25%)', tradeoff:'Cooldown 20 วิ',
    shortDescription:'Boss KO: Zeny +12%\nBREAK: Sponsor Rush 5 วิ (Zeny +25%) [CD 20 วิ]',
    fullDescription:'[Boss KO]\nZeny +12%\n\n[BREAK สำเร็จ]\nเปิด Sponsor Rush 5 วิ\nZeny +25%\n\n[Cooldown]\n20 วิ ระหว่าง Sponsor Rush',
    balanceNote:'OK - ค่าเหมาะสมกับ Premium แก้ไขเฉพาะ description',
    apply(s){ s.cs_bossCoinPct=(s.cs_bossCoinPct||0)+0.12; s.cs_aListCard=true; }
  },
  { id:'rzw', name:'RIZZWORD CARD',        img:'cards/rizzword_card.png',       rarity:'premium',
    effect:'AK47 active <strong>+0.5 วิ</strong> | เก็บ AK47: OD charge <strong>+3%</strong> (สูงสุด 10×/8 วิ)', tradeoff:null,
    shortDescription:'AK47 อยู่บนจออีก +0.5 วิ\nเก็บ AK47: OD +3% (สูงสุด 10 ครั้ง/8 วิ)',
    fullDescription:'[PASSIVE]\nAK47 อยู่บนจอนาน +0.5 วิ\n\n[เมื่อเก็บ AK47]\nOD charge +3%\n(สูงสุด 10 ครั้งต่อ 8 วิ)',
    balanceNote:'OK - ค่าเหมาะสมกับ Premium แก้ไขเฉพาะ description',
    apply(s){ s.cs_rizzword=true; s.cs_wpDuration=(s.cs_wpDuration||0)+0.5; }
  },
  { id:'orb', name:'ORC BADDY CARD',       img:'cards/orc_baddy_card.png',      rarity:'premium',
    effect:'OD ≥ 70%: DMG <strong>+12%</strong>', tradeoff:'ระหว่าง OD: OD หมดเร็วขึ้น',
    shortDescription:'OD ≥ 70%: DMG +12%\n[TRADE-OFF: ระหว่าง OD หมดเร็วขึ้น]',
    fullDescription:'[เงื่อนไข]\nเมื่อ OD bar ≥ 70% หรืออยู่ใน OD:\nDMG +12%\n\n[TRADE-OFF]\nระหว่าง OD:\nOD drain เร็วขึ้น 20%',
    balanceNote:'NERF+FIX - ลด DMG จาก +18% เป็น +12% และเพิ่ม OD drain tradeoff ที่ขาดหายไปจาก code',
    apply(s){ s.cs_orcBaddy=true; s.cs_orcBaddyDrain=true; }
  },

  // ── ELITE NEW (v2) ──
  { id:'ghp', name:'GHOSTPING CARD',       img:'cards/ghostping_card.png',      rarity:'elite',
    shortDescription:'พลาด AK47 แต่ละลูก ช่วยเร่ง BREAK และบูสต์ DMG ตอน BREAK',
    effect:'เมื่อพลาด AK47 แต่ละลูก:<br>BREAK จะมาถึงเร็วขึ้น <strong>1.5 วิ</strong><br>(สูงสุด 6 ลูก/รอบ BREAK)<br><br>BREAK:<br>DMG <strong>+55%</strong><br>BREAK progress <strong>+15%</strong>', tradeoff:null,
    fullDescription:'[พลาด AK47 ลูก]\nBREAK มาถึงเร็วขึ้น 1.5 วิ ต่อลูก\n(สูงสุด 6 ลูก ต่อรอบ BREAK)\nnับ reset เมื่อ BREAK เริ่ม\n\n[ระหว่าง BREAK]\n• DMG +55%\n• BREAK gauge +15% ต่อคลิก',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_ghostping=true; }
  },
  { id:'dvl', name:'DEVILINGO CARD',       img:'cards/devilingo_card.png',      rarity:'elite',
    shortDescription:'15 วิแรก: Boss DMG +70%, Zeny +30%, AK47 เร็วขึ้น\nหลัง 15 วิ: CURSED PANIC ทั้งรอบ (ทุกศัตรู)',
    effect:'15 วิแรกของรอบ: Boss DMG <strong>+70%</strong> | Zeny <strong>+30%</strong> | AK47 spawn <strong>+20%</strong>', tradeoff:'หลัง 15 วิ: <strong>CURSED PANIC</strong><br>(เวลาไหลเร็ว +15%, คอมโบร่วงเร็ว +20%<br>ทุกศัตรูในรอบ)',
    fullDescription:'[15 วิแรกของรอบ]\n• Boss DMG +70%\n• Zeny +30%\n• AK47 spawn +20%',
    balanceNote:'FIXED - CURSED PANIC ตอนนี้ใช้กับทั้งรอบ (นับจาก run start) ไม่ใช่เฉพาะบอสหลัง 15 วิ',
    apply(s){ s.cs_devilingo=true; }
  },
  { id:'ltn', name:'LADY TRAINEE CARD',    img:'cards/lady_trainee_card.png',   rarity:'elite',
    shortDescription:'เข้า OD ทุกครั้ง: สะสม DMG Stack +4%\nครบ 10 ครั้ง ปลด Spotlight Mode',
    effect:'เข้า OD ทุกครั้ง:<br>DMG <strong>+4%</strong> Stack<br>(สูงสุด +60%)<br><br>10 Stacks:<br><strong>Spotlight Mode</strong><br>OD charge <strong>+10%/คลิก</strong>', tradeoff:null,
    fullDescription:'[ทุกครั้งที่เข้า OD]\nDMG Stack +4% ต่อครั้ง\n(สูงสุด +60%)\n\n[SPOTLIGHT MODE]\nเมื่อครบ 10 Stacks\nOD charge +10% ต่อคลิก\n\n(นับ 1 Stack ต่อการเข้า OD 1 ครั้ง ไม่ใช่ต่อ Level)',
    balanceNote:'FIXED - เปลี่ยน description จาก "OD Lv. เพิ่ม" เป็น "เข้า OD ทุกครั้ง" ให้ตรงกับ code จริง',
    apply(s){ s.cs_ladyTrainee = true; }
  },
  // ── MYTHIC NEW (v2) ──
  { id:'fwc', name:'FALLEN WECHAT CARD',   img:'cards/fallen_wechat_card.png',  rarity:'mythic',
    shortDescription:'OD เต็มแล้วเปิด Overloaded BREAK แบบระเบิดพลัง',
    effect:'OD เต็ม:<br><strong>Overloaded BREAK</strong><br>DMG <strong>+60%</strong><br>BREAK progress +20%<br>BREAK window +0.6 วิ<br><br>จบ: OD reset', tradeoff:'Cooldown <strong>24 วิ</strong>',
    fullDescription:'[OVERLOADED BREAK]\nเมื่อ OD เต็ม (CD 24 วิ)\n\n• DMG +60%\n• BREAK gauge +20% ต่อแตะ\n• BREAK window +0.6 วิ\n\nจบ BREAK: OD reset',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_fallenWechat=true; }
  },
  { id:'dtl', name:'DETAILED CARD',        img:'cards/detailed_card.png',       rarity:'mythic',
    shortDescription:'เก็บ AK47 สะสม Analysis Stack\nครบ 8: มองเห็นจุดอ่อนทั้งหมด — ANALYZED BREAK',
    effect:'เก็บ AK47:<br>Analysis Stack +1 (สูงสุด 8)<br><br>ระหว่าง BREAK:<br>DMG <strong>+4%/Stack</strong><br><br>ครบ 8 Stack:<br><strong>ANALYZED BREAK</strong><br>มองเห็นจุดอ่อนทั้งหมด<br>• BREAK window ×2<br>• BREAK gauge gain ×2<br><br>เมื่อ BREAK สำเร็จ:<br><strong>Critical Analysis</strong> 10 วิ<br>Crit +25% & Crit DMG +35%', tradeoff:'พลาด AK47: Stack <strong>-2</strong> & Combo <strong>-3</strong>',
    fullDescription:'[ANALYSIS STACK]\nเก็บจากการเก็บ AK47 (สูงสุด 8 Stack)\n\nระหว่าง BREAK:\nDMG +4% ต่อ Stack\n\n[ANALYZED BREAK]\nเมื่อครบ 8 Stack:\n• BREAK window ×2\n• BREAK gauge gain ×2\n\n[CRITICAL ANALYSIS]\nหลัง BREAK สำเร็จ:\n• Crit +25%\n• Crit DMG +35%\n• นาน 10 วิ',
    balanceNote:'POLISH - เปลี่ยนคำศัพท์ developer เป็นภาษาธีมที่อ่านง่าย ไม่แก้ค่าเกมเพลย์',
    apply(s){ s.cs_detailed=true; }
  },
  { id:'gus', name:'GLOOM UNDER SIDE CARD',img:'cards/gloom_under_side_card.png',rarity:'mythic',
    shortDescription:'ทุก 2 วิสะสม OBSESSION STACK\nแรงขึ้น แต่เวลาไหลเร็วขึ้นทุก Stack',
    effect:'ทุก 2 วิ:<br><strong>OBSESSION STACK</strong> +1<br>(สูงสุด 20)<br><br>ต่อ Stack:<br>• DMG +3%<br>• Zeny +3%<br>• BREAK progress +3%<br><br>ที่ 20 Stack: +60% ทุกด้าน', tradeoff:'ต่อ Stack: เวลาไหลเร็วขึ้น <strong>+1%</strong><br>(สูงสุด 20 Stack)',
    fullDescription:'[OBSESSION STACK]\nสะสมทุก 2 วิ (สูงสุด 20 Stack)\n\nต่อ Stack:\n• DMG +3%\n• Zeny +3%\n• BREAK +3%',
    balanceNote:'REWORK - เพิ่ม tradeoff timer drain ต่อ Stack ทำให้รู้สึกอันตรายและ Mythic จริง ไม่ใช่ passive ฟรี',
    apply(s){ s.cs_gloomUnderSide=true; }
  },
  { id:'dsk', name:'DARK STAKE LORD CARD', img:'cards/dark_stake_lord_card.png', rarity:'mythic',
    shortDescription:'BREAK ลุ้น Jackpot เพิ่ม Zeny และ OCA chance',
    effect:'BREAK:<br>Jackpot <strong>15%</strong><br><br>พลาด:<br>Jackpot +10%<br>(สูงสุด 75%)<br><br>Jackpot:<br>Zeny ×2.5<br>OCA chance ×10<br><br>ได้รับแล้ว reset กลับ 15%', tradeoff:'Zeny <strong>-10%</strong>',
    fullDescription:'[BREAK สำเร็จ]\nสุ่ม JACKPOT (เริ่ม 15%)\n\nพลาด: โอกาส +10% สะสม (สูงสุด 75%)\n\n[JACKPOT]\n• Zeny ×2.5\n• OCA chance ×10\n• Reset กลับ 15%',
    balanceNote:'REBALANCE - ปรับให้มีเพดานความแรงและลดจุดเสี่ยง abuse',
    apply(s){ s.cs_darkStakeLord=true; }
  },];

const CS_WEIGHTS = { standard:50, premium:25, elite:15, mythic:10 };
const CS_LOD_EXCLUDED_IDS = new Set(['ld','mf','vr']);
const CS_VALKYRIE_EXCLUDED_IDS = new Set(['mf','vr']);
const DEBUG_CARD_EFFECTS = false;

// ══════════════════════════════════════════
// PRE-RUN CARD REROLL SYSTEM
// ══════════════════════════════════════════

// Per-run reroll state — persists across Back/menu navigation; only resets on new run.
// FIX: Added sessionId so we can detect stale vs. live pre-run state across page reloads.
let _preRunCardState = {
  offers: [],           // current 3-card offer (Card objects)
  selectedCardId: null,
  rerollCount: 0,       // number of successful rerolls this pre-run
  sessionId: ''         // unique token; cleared on run-start / run-end
};

// FIX-1: Double-fire guard — prevents onclick + ontouchstart from both executing on one tap.
// Released via setTimeout(0) so it absorbs both events in the same gesture before unlocking.
let _rerollInProgress = false;

// ── Serialize pre-run state to save object (call after each reroll) ──
function _persistPreRunState() {
  try {
    save.preRunState = {
      rerollCount: _preRunCardState.rerollCount,
      selectedCardId: _preRunCardState.selectedCardId,
      offerIds: (_preRunCardState.offers || []).map(c => c.id),
      sessionId: _preRunCardState.sessionId
    };
  } catch(e) {}
}

// ── Restore pre-run state from save object on page reload ──
function _restorePreRunStateFromSave() {
  try {
    const p = save.preRunState;
    if (!p || typeof p !== 'object' || !p.sessionId) return false;
    const ids = Array.isArray(p.offerIds) ? p.offerIds : [];

    // FIX-2: Filter restored cards against current owned/unlocked list.
    // getUnlockedCards() returns an array of ID strings — use directly.
    // Prevents edited localStorage from injecting unowned cards into offers.
    const unlocked = getUnlockedCards();
    const cards = ids
      .map(id => CARD_POOL.find(c => c.id === id))
      .filter(c => c && unlocked.includes(c.id));  // must exist in pool AND be owned

    // Validate: must have at least 1 valid owned card to be worth restoring.
    // If empty (e.g. all restored IDs were unowned), return false so
    // ensurePreRunCardState() regenerates a clean offer from owned cards.
    if (!cards.length) return false;
    _preRunCardState.rerollCount = Math.min(999, Math.max(0, Math.floor(Number(p.rerollCount) || 0)));
    _preRunCardState.selectedCardId = p.selectedCardId || null;
    _preRunCardState.offers = cards;
    _preRunCardState.sessionId = p.sessionId;
    return true;
  } catch(e) { return false; }
}

// ── Ensure valid pre-run state exists; only resets if state is stale/empty ──
// FIX: replaces the unconditional resetPreRunCardState() call in openCardSlot().
// FIX-3: Returns true if state was reset/newly created, false if existing state was kept.
//        openCardSlot() uses the return value to skip doSave() on simple navigation.
function ensurePreRunCardState() {
  const valid =
    _preRunCardState.sessionId &&
    Array.isArray(_preRunCardState.offers) &&
    _preRunCardState.offers.length > 0;
  if (!valid) {
    resetPreRunCardState();
    return true;  // state was created/reset — caller should save
  }
  return false;   // existing valid state kept — no save needed
}

// Returns the zeny cost for the NEXT reroll given how many rerolls are already done.
function getRerollCost(rerollCount) {
  if (rerollCount === 0) return 0;      // 1st reroll: FREE
  if (rerollCount <= 3) return 100;     // rerolls 2–4: 100
  if (rerollCount <= 6) return 250;     // rerolls 5–7: 250
  if (rerollCount <= 9) return 500;     // rerolls 8–10: 500
  if (rerollCount <= 12) return 800;    // rerolls 11–13: 800
  return 1200;                          // reroll 14+: cap
}

// Dynamic rarity weights — scales with how many rerolls have already succeeded.
// Expensive rerolls feel more rewarding: ELITE/MYTHIC odds rise, STANDARD falls.
// STANDARD never drops below 15%; MYTHIC never exceeds 13%.
// Keys use lowercase to match CARD_POOL rarity strings.
function getRerollRarityWeights(rerollCount) {
  if (rerollCount <= 1)  return { standard:45, premium:32, elite:18, mythic:5  };
  if (rerollCount <= 4)  return { standard:38, premium:34, elite:22, mythic:6  };
  if (rerollCount <= 7)  return { standard:30, premium:36, elite:27, mythic:7  };
  if (rerollCount <= 10) return { standard:24, premium:35, elite:32, mythic:9  };
  if (rerollCount <= 13) return { standard:18, premium:33, elite:38, mythic:11 };
  return                        { standard:15, premium:30, elite:42, mythic:13 };
}

// Returns all owned/unlocked card objects — starter 5 always included.
function getOwnedCardsForReroll() {
  const unlocked = getUnlockedCards(); // always includes DEFAULT_UNLOCKED starters
  return CARD_POOL.filter(c => unlocked.includes(c.id));
}

// Pick one card using dynamic weights for the given rerollCount.
// Only considers tiers that actually have available owned cards (missing rarities ignored).
// Excludes card IDs already picked this offer (duplicate prevention).
function _pickRerollCard(ownedByTier, excludeIds, rerollCount) {
  const TIER_ORDER = ['mythic', 'elite', 'premium', 'standard'];
  const weights = getRerollRarityWeights(rerollCount);

  // Only roll among tiers that have at least one owned, unpicked card
  const availTiers = TIER_ORDER.filter(
    t => ownedByTier[t] && ownedByTier[t].some(c => !excludeIds.has(c.id))
  );
  if (!availTiers.length) return null;

  // Sum weights of available tiers only (missing rarities are naturally ignored)
  const totalW = availTiers.reduce((s, t) => s + (weights[t] || 0), 0);
  if (totalW <= 0) {
    // Fallback: uniform pick from any available card
    for (const t of TIER_ORDER) {
      const fb = (ownedByTier[t] || []).filter(c => !excludeIds.has(c.id));
      if (fb.length) return fb[Math.floor(Math.random() * fb.length)];
    }
    return null;
  }

  // Weighted roll among available tiers
  let r = Math.random() * totalW;
  let rolledTier = availTiers[availTiers.length - 1];
  for (const t of availTiers) {
    r -= (weights[t] || 0);
    if (r <= 0) { rolledTier = t; break; }
  }

  // Pick a random card from the rolled tier (excluding already-picked)
  const pool = (ownedByTier[rolledTier] || []).filter(c => !excludeIds.has(c.id));
  if (!pool.length) {
    // Rare edge case: rolled tier emptied mid-pick — fallback to any available
    for (const t of TIER_ORDER) {
      const fb = (ownedByTier[t] || []).filter(c => !excludeIds.has(c.id));
      if (fb.length) return fb[Math.floor(Math.random() * fb.length)];
    }
    return null;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// Generate up to 3 unique owned cards for the pre-run offer.
// Uses rerollCount from _preRunCardState to determine rarity weights.
// Each successive pick recalculates available pools (duplicate prevention).
function generatePreRunCardOffers() {
  const owned = getOwnedCardsForReroll();
  if (!owned.length) return [];

  // Group owned cards by rarity tier
  const byTier = { standard: [], premium: [], elite: [], mythic: [] };
  owned.forEach(c => { if (byTier[c.rarity]) byTier[c.rarity].push(c); });

  const picked = [];
  const usedIds = new Set();
  const count = Math.min(3, owned.length);
  // Use current rerollCount so weights reflect how many rerolls have happened
  const rc = _preRunCardState.rerollCount;

  for (let i = 0; i < count; i++) {
    const card = _pickRerollCard(byTier, usedIds, rc);
    if (!card) break;
    picked.push(card);
    usedIds.add(card.id);
  }
  return picked;
}

function resetPreRunCardState() {
  _preRunCardState.rerollCount = 0;
  _preRunCardState.selectedCardId = null;
  _preRunCardState.sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  _preRunCardState.offers = generatePreRunCardOffers(); // uses rerollCount=0 weights
  // Clear persisted pre-run state so page-reload cannot restore a stale free reroll
  if (save) { save.preRunState = null; }
}

function rerollPreRunCards() {
  // Delegated to executePreRunReroll (which holds the _rerollInProgress guard).
  // Kept for backward compatibility only — no direct callers remain post-refactor.
  executePreRunReroll();
}

function selectPreRunCard(cardId) {
  _preRunCardState.selectedCardId = cardId;
}

// ── Render the 3 offered cards (called on open + after each reroll) ──
function _csRenderRerollCards() {
  const wrap = $('csCardsWrap');
  if (!wrap) return;

  // Animate out (shuffle feel) then render new
  wrap.style.opacity = '0.3';
  wrap.style.transform = 'scale(0.96)';

  requestAnimationFrame(() => {
    wrap.innerHTML = '';
    wrap.classList.remove('has-selection'); // POLISH: clear dim state on new offer
    const offers = _preRunCardState.offers;

    if (!offers || !offers.length) {
      // Fallback: no cards
      const empty = document.createElement('div');
      empty.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;color:#444;font-size:12px;letter-spacing:2px;font-family:\'Oswald\',sans-serif;';
      empty.textContent = 'NO CARD EQUIPPED';
      wrap.appendChild(empty);
      wrap.style.opacity = '';
      wrap.style.transform = '';
      return;
    }

    offers.forEach((card, idx) => {
      const div = document.createElement('div');
      div.className = `cs-card rarity-${card.rarity}`;
      div.style.animationDelay = (0.05 + idx * 0.10) + 's';

      // Selected state
      if (_preRunCardState.selectedCardId === card.id) {
        div.classList.add('selected');
      }

      let imgHtml;
      if (card.img) {
        const cached = _imgObjCache[card.img];
        const imgSrc = (cached && cached.complete && cached.naturalWidth > 0) ? cached.src : card.img;
        imgHtml = `<img class="cs-card-img" src="${imgSrc}" alt="${card.name}" decoding="async" onerror="this.style.opacity='0'">`;
      } else {
        imgHtml = `<div class="cs-card-img" style="display:flex;align-items:center;justify-content:center;font-size:36px;background:#111;border-radius:4px;">#</div>`;
      }

      const slotDesc = getCardSlotDescription(card);
      const isHighRarity = (card.rarity === 'elite' || card.rarity === 'mythic');
      if (isHighRarity) div.classList.add('cs-offer-highrarity');
      div.innerHTML = `
        <div class="cs-rarity-tag">${RARITY_LABEL[card.rarity]}</div>
        ${imgHtml}
        <div class="cs-card-name">${card.name}</div>
        <div class="cs-card-effect">${slotDesc}</div>
        <div class="cs-card-check" aria-label="Selected" role="img"></div>
        <div class="cs-selected-badge">SELECTED</div>
      `;

      div.addEventListener('click', () => _csSelectRerollCard(div, card));
      div.addEventListener('touchstart', e => { e.preventDefault(); _csSelectRerollCard(div, card); }, { passive: false });
      cmDecorateCardSlotCard(div, card);
      applyCardRarityVfx(div, card.rarity);
      wrap.appendChild(div);
    });

    // Animate in
    wrap.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    requestAnimationFrame(() => {
      wrap.style.opacity = '';
      wrap.style.transform = '';
      // POLISH: restore dim state if a card is already selected (Back → re-enter)
      if (_preRunCardState.selectedCardId) wrap.classList.add('has-selection');
      setTimeout(() => { wrap.style.transition = ''; }, 220);
    });
  });
}

function _csSelectRerollCard(el, card) {
  // Deselect all (also clear any per-card themed pick accent from a prior select)
  document.querySelectorAll('.cs-card').forEach(c => {
    c.classList.remove('selected', 'cs-pick-themed');
    c.style.removeProperty('--cv-pick');
  });
  el.classList.add('selected');
  pulseCardRarityVfx(el); // premium sparkle/sweep on Elite/Mythic select (no-op otherwise)
  _csApplyPickAccent(el, card); // tint the pick burst with the card's signature colour
  // POLISH: dim unselected cards when one is active
  const wrap = $('csCardsWrap');
  if (wrap) wrap.classList.add('has-selection');
  selectPreRunCard(card.id);

  // Find the actual card object from offers
  const found = _preRunCardState.offers.find(c => c.id === card.id) || card;
  _csPendingCard   = found;
  _csPendingChosen = _csOnChosen;

  // Show CONFIRM, hide footer
  $('csFooter').classList.add('hidden');
  $('csConfirmBtn').classList.add('visible');
}

// ── Update the reroll button label and state ──
function _csUpdateRerollBtn() {
  const btn = $('csRerollBtn');
  const costText = $('csRerollCostText');
  const costLabel = $('csRerollCostLabel');
  const icon = $('csRerollIcon');
  if (!btn || !costText) return;

  const rc = _preRunCardState.rerollCount;
  const cost = getRerollCost(rc);
  const canAfford = save.coins >= cost;
  const costStr = cost === 0 ? 'FREE' : cost.toLocaleString() + ' ZENY';

  costText.textContent = costStr;

  // Reset state
  btn.classList.remove('reroll-not-enough', 'reroll-shuffling');
  if (icon) icon.classList.remove('spinning');

  if (!canAfford) {
    btn.classList.add('reroll-not-enough');
    if (costLabel) {
      costLabel.textContent = 'NOT ENOUGH ZENY';
      costLabel.className = 'not-enough';
      costLabel.style.display = 'block';
    }
  } else {
    if (costLabel) {
      costLabel.textContent = '';
      costLabel.style.display = 'none';
    }
  }
}

// ── High-rarity offer detection ──
function currentOffersContainHighRarity() {
  return Array.isArray(_preRunCardState.offers) &&
    _preRunCardState.offers.some(function(card) {
      return card && (card.rarity === 'ELITE' || card.rarity === 'MYTHIC' ||
                      card.rarity === 'elite' || card.rarity === 'mythic');
    });
}

// ── Open / close reroll confirm modal ──
function _openRerollConfirmModal() {
  const modal = $('rerollConfirmModal');
  if (!modal) return;
  // Update cost line to reflect current reroll cost
  const costEl = $('rerollConfirmCost');
  if (costEl) {
    const cost = getRerollCost(_preRunCardState.rerollCount);
    costEl.textContent = cost === 0 ? 'Cost: FREE' : 'Cost: ' + cost.toLocaleString() + ' ZENY';
  }
  modal.style.display = 'flex';
}

function _closeRerollConfirmModal() {
  const modal = $('rerollConfirmModal');
  if (modal) modal.style.display = 'none';
}

// ── CANCEL: close modal, no reroll, no zeny deducted, no count increment ──
function _rerollConfirmCancel() {
  _closeRerollConfirmModal();
  // _rerollInProgress was NOT set when the modal opened — nothing to release
}

// ── CONFIRM REROLL: close modal then execute normal reroll flow ──
function _rerollConfirmExecute() {
  _closeRerollConfirmModal();
  executePreRunReroll();
}

// ── Reroll button click handler ──
function _csRerollClick() {
  if (_rerollInProgress) return;

  if (currentOffersContainHighRarity()) {
    // Do NOT set _rerollInProgress here — modal is non-blocking
    _openRerollConfirmModal();
    return;
  }

  executePreRunReroll();
}

// ── Actual reroll execution (extracted from former rerollPreRunCards) ──
function executePreRunReroll() {
  // FIX-1: Double-fire guard — absorbs onclick + ontouchstart firing on the same gesture.
  if (_rerollInProgress) return;
  _rerollInProgress = true;

  const cost = getRerollCost(_preRunCardState.rerollCount);

  // Insufficient zeny — do NOT reroll, do NOT increment count
  if (cost > save.coins) {
    _csShowRerollFeedback('broke');
    setTimeout(() => { _rerollInProgress = false; }, 0);
    return;
  }

  // Deduct zeny immediately
  if (cost > 0) {
    save.coins -= cost;
    if ($('menuCoinNum'))  $('menuCoinNum').textContent  = formatNum(save.coins);
    if ($('shopCoinNum'))  $('shopCoinNum').textContent  = formatNum(save.coins);
    if ($('bossCoinNum'))  $('bossCoinNum').textContent  = formatNum(save.coins);
    if ($('arenaCoinNum')) $('arenaCoinNum').textContent = formatNum(save.coins);
  }

  // Increment rerollCount BEFORE generating offers so the new count drives rarity weights
  _preRunCardState.rerollCount++;
  _preRunCardState.selectedCardId = null;
  _preRunCardState.offers = generatePreRunCardOffers();

  // Update UI immediately — non-blocking
  _csRenderRerollCards();
  _csUpdateRerollBtn();

  // Persist pre-run state so page-reload cannot restore free reroll exploit
  _persistPreRunState();
  markSaveDirty('card_reroll');
  doSave();
  // Background cloud sync — fire-and-forget, never awaited
  scheduleCloudSync('card_reroll', { silentToast: true });

  // Release lock after this event-loop tick
  setTimeout(() => { _rerollInProgress = false; }, 0);
}

// ── Visual feedback for broke state — inline toast, auto-dismiss, no modal ──
let _csZenyToastTimer = null;
function _csShowRerollFeedback(type) {
  const btn = $('csRerollBtn');
  const costLabel = $('csRerollCostLabel');
  if (!btn) return;

  if (type === 'broke') {
    // Shake the button
    btn.classList.remove('cs-reroll-shake');
    void btn.offsetWidth;
    btn.classList.add('cs-reroll-shake');
    setTimeout(() => btn.classList.remove('cs-reroll-shake'), 380);

    // Show inline toast text, auto-dismiss after 1.6s
    if (costLabel) {
      costLabel.textContent = 'NOT ENOUGH ZENY';
      costLabel.className = 'not-enough';
      costLabel.style.display = 'block';
      if (_csZenyToastTimer) clearTimeout(_csZenyToastTimer);
      _csZenyToastTimer = setTimeout(() => {
        // Only clear if still showing the broke message (don't stomp a fresh update)
        if (costLabel.textContent === 'NOT ENOUGH ZENY') {
          costLabel.textContent = '';
          costLabel.style.display = 'none';
        }
        _csZenyToastTimer = null;
      }, 1600);
    }
  }
}

// Ensure UI-safe description fields across Premium/Elite without changing save/card IDs.
for (const _card of CARD_POOL) {
  const _plainEffect = String(_card.effect || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    !_card.shortDescription ||
    _card.shortDescription === 'เอฟเฟกต์ตามการ์ดนี้ (เวอร์ชันย่อ)'
  ) {
    _card.shortDescription = _plainEffect || _card.shortDesc || 'เอฟเฟกต์การ์ด';
  }
  if (
    !_card.fullDescription ||
    _card.fullDescription === 'รายละเอียดเอฟเฟกต์ตามการ์ดนี้แบบเต็ม ใช้งานตามเงื่อนไขที่ระบุในเอฟเฟกต์'
  ) {
    _card.fullDescription = _card.effect || _card.shortDescription || '';
  }
  if (!_card.balanceNote) _card.balanceNote = 'KEEP - รักษาสมดุลเดิมโดยไม่เพิ่มความเสี่ยงระบบ';
  if (!_card.shortDesc) _card.shortDesc = _card.shortDescription;
}

function _csDebugLog(...args){
  if(DEBUG_CARD_EFFECTS) console.log('[CardEffects]', ...args);
}

// สุ่ม tier ก่อน แล้วค่อยสุ่มการ์ดใน tier นั้น — rate คงที่ไม่ขึ้นกับจำนวนใบ
function _pickTier(excludeTiers=[]) {
  const tiers = Object.keys(CS_WEIGHTS).filter(t=>!excludeTiers.includes(t));
  const total = tiers.reduce((s,t)=>s+CS_WEIGHTS[t],0);
  let r = Math.random()*total;
  for(const t of tiers){ r-=CS_WEIGHTS[t]; if(r<=0) return t; }
  return tiers[tiers.length-1];
}

function drawCardSlot() {
  const unlocked = getUnlockedCards();
  const TIER_ORDER = ['mythic','elite','premium','standard'];

  // แบ่ง unlocked cards ตาม tier
  const byTier = { standard:[], premium:[], elite:[], mythic:[] };
  CARD_POOL.filter(c=>unlocked.includes(c.id)).forEach(c=>{ if(byTier[c.rarity]) byTier[c.rarity].push(c); });

  const picked = [];
  const usedIds = new Set();

  for(let i=0;i<3;i++){
    const availTiers = Object.keys(byTier).filter(t=>byTier[t].some(c=>!usedIds.has(c.id)));
    if(!availTiers.length) break;

    // สุ่ม tier โดยใช้ CS_WEIGHTS คงที่
    const tierTotal = Object.keys(CS_WEIGHTS).reduce((s,t)=>s+CS_WEIGHTS[t],0);
    let r = Math.random()*tierTotal;
    let rolledTier = 'standard';
    for(const t of Object.keys(CS_WEIGHTS)){ r-=CS_WEIGHTS[t]; if(r<=0){rolledTier=t;break;} }

    // ถ้า tier ที่สุ่มได้ไม่มีการ์ด unlock → falldown ลงมาตามลำดับ
    const rolledIdx = TIER_ORDER.indexOf(rolledTier);
    let tier = null;
    for(let j=rolledIdx; j<TIER_ORDER.length; j++){
      const t = TIER_ORDER[j];
      if(byTier[t] && byTier[t].some(c=>!usedIds.has(c.id))){ tier=t; break; }
    }
    // ถ้า falldown จนสุดแล้วยังไม่มี ลองขึ้นบน
    if(!tier){
      for(let j=rolledIdx-1; j>=0; j--){
        const t = TIER_ORDER[j];
        if(byTier[t] && byTier[t].some(c=>!usedIds.has(c.id))){ tier=t; break; }
      }
    }
    if(!tier) break;

    const pool = byTier[tier].filter(c=>!usedIds.has(c.id));
    const card = pool[Math.floor(Math.random()*pool.length)];
    picked.push(card);
    usedIds.add(card.id);
  }

  // fallback ถ้าได้ไม่ครบ 3
  if(picked.length < 3) {
    const defaults = CARD_POOL.filter(c=>DEFAULT_UNLOCKED.includes(c.id)&&!usedIds.has(c.id));
    while(picked.length < 3 && defaults.length) {
      const c = defaults.splice(Math.floor(Math.random()*defaults.length),1)[0];
      picked.push(c); usedIds.add(c.id);
    }
  }

  return picked;
}

const RARITY_LABEL = { standard:'STANDARD', premium:'PREMIUM', elite:'ELITE', mythic:'MYTHIC' };

function openCardSlot(onChosen) {
  const screen = $('cardSlotScreen');
  screen.style.display = 'flex';
  _csOnChosen = onChosen;

  // Reset confirm state
  $('csConfirmBtn').classList.remove('visible');
  $('csFooter').classList.remove('hidden');

  // Hide penalty warning
  const penaltyWarn = $('csPenaltyWarn');
  penaltyWarn.textContent = '';
  penaltyWarn.classList.remove('visible');

  // ── Preserve pre-run reroll state across Back/menu navigation ──
  // FIX: Only reset if no valid pre-run session exists (first open, or after run end).
  // Blindly calling resetPreRunCardState() every open was the exploit root cause.
  const unlocked = getUnlockedCards();

  // Try to restore from save (handles page-reload exploit: rerollCount is persisted)
  if (!_preRunCardState.sessionId) {
    _restorePreRunStateFromSave();
  }
  // FIX-3: ensurePreRunCardState() now returns true only when it reset/created new state.
  // doSave() is called only when state genuinely changed — not on simple Back → re-enter.
  const stateWasReset = ensurePreRunCardState();

  // Always sync _csLastCards for any external code that reads it
  _csLastCards = _preRunCardState.offers.slice();
  save.savedCards = _preRunCardState.offers.map(c => c.id);
  // Save only when a new pre-run state was created — skip redundant write on navigation
  if (stateWasReset) doSave();

  // Render offers
  _csRenderRerollCards();

  // Render reroll button
  _csUpdateRerollBtn();
  const rerollWrap = $('csRerollWrap');
  if (rerollWrap) rerollWrap.style.display = 'flex';
}

function getCardSlotDescription(card) {
  if(card.shortDescription) return card.shortDescription;
  if(card.shortDesc) return card.shortDesc;
  const raw = (card.effect || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if(raw.length <= 70) return raw;
  return raw.slice(0, 67).trimEnd() + '...';
}

function _csSelectCard(el, card) {
  // deselect others
  document.querySelectorAll('.cs-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  // เก็บ card ไว้ใน module-level variable
  _csPendingCard    = card;
  _csPendingChosen  = _csOnChosen;

  // แสดงปุ่ม CONFIRM ซ่อน footer
  $('csFooter').classList.add('hidden');
  $('csConfirmBtn').classList.add('visible');
}

// module-level เพื่อให้ _csConfirm เข้าถึงได้เสมอ
let _csPendingCard   = null;
let _csPendingChosen = null;

// FIX: Double-fire guard for CONFIRM button (onclick + ontouchstart fire on same tap).
// Mirrors the _rerollInProgress pattern used by the reroll button.
let _confirmInProgress = false;

function _csConfirmClick() {
  // FIX: guard must come first — absorbs the second event in onclick+ontouchstart pair.
  if (_confirmInProgress) return;
  if (!_csPendingCard || !_csPendingChosen) return;
  _confirmInProgress = true;

  const card     = _csPendingCard;
  const onChosen = _csPendingChosen;
  // Clear pending refs before onChosen() so any re-entrant call is a no-op.
  _csPendingCard   = null;
  _csPendingChosen = null;

  $('cardSlotScreen').style.display  = 'none';
  $('csConfirmBtn').classList.remove('visible');
  $('csFooter').classList.remove('hidden');

  activeCard = card;
  _csKoTimeAcc  = 0;
  _csOdUseCount = 0;
  _csOsirisUsed = false;
  const cs = {};
  card.apply(cs);
  window._csState = cs;
  _csRefreshVolatileCardEffects(cs);
  // Elite/Mythic VFX: ตั้ง aura ถาวรของการ์ดที่เลือก (cosmetic, no-op สำหรับ tier อื่น)
  if (window.CardVFX) window.CardVFX.setActiveCard(card.id, card.rarity);

  // Release guard after this tick so both events in the gesture are absorbed.
  setTimeout(() => { _confirmInProgress = false; }, 0);
  onChosen();
}

function _csBack() {
  // FIX: guard against onclick + ontouchstart double-fire — if screen is already
  // hidden a second call is a no-op, preserving all reroll state as intended.
  if ($('cardSlotScreen').style.display === 'none') return;

  // _csLastCards ยังคงเดิม + save.savedCards ยังคงเดิม
  // กด PLAY ใหม่จะได้การ์ดเดิมเสมอ
  $('cardSlotScreen').style.display = 'none';
  $('csConfirmBtn').classList.remove('visible');
  $('csFooter').classList.remove('hidden');
  // Clear reroll pending state
  _csPendingCard   = null;
  _csPendingChosen = null;
  // ไม่ stopBGM() — เพลงเล่นต่อเนื่องจาก main menu อยู่แล้ว
  // stopBGM() จะ reset currentTime = 0 ทำให้เพลงเริ่มใหม่
  goMainMenu();
}

function _csResetOdFromExpiredEddga() {
  if(!_csEddgaForcedOd) return;
  clearTimeout(godTimeout);
  clearInterval(godInterval);
  godLevel = 0;
  canEnterGod = true;
  godSecondsLeft = 0;
  godHitCount = 0;
  _csEddgaForcedOd = false;
  if(typeof gun !== 'undefined' && gun) gun.style.display = 'none';
  if(_el && _el.godFill) _el.godFill.style.width = '0%';
  if(_el && _el.godLevelWrap) _el.godLevelWrap.style.display = 'none';
  _resetOdBadge();
  if(typeof updateOdScreenAura === 'function') updateOdScreenAura(0);
  if(typeof updateComboUI === 'function') updateComboUI();
}

function _csRefreshVolatileCardEffects(nextState) {
  const nextHasEddga = !!(nextState && nextState.cs_eddga);
  clearInterval(_csThanatosTimer);
  clearInterval(_csEddgaInterval);
  clearInterval(_csEddgaBurstInterval);
  _csThanatosTimer = null;
  _csEddgaInterval = null;
  _csEddgaBurstInterval = null;

  // ORC BADDY: clear old timers
  clearTimeout(_csOrcBaddyTimer);
  clearInterval(_csOrcBaddyDrainInterval);
  _csOrcBaddyTimer = null;
  _csOrcBaddyDrainInterval = null;

  // GLOOM UNDER SIDE: clear old stack timer
  clearInterval(_csGloomTimer);
  _csGloomTimer = null;

  if(!nextHasEddga) _csResetOdFromExpiredEddga();
  if(nextState && nextState.cs_eddga) _csStartEddga();
  if(nextState && nextState.cs_thanatos) _csStartThanatosTimer();

  // ORC BADDY: start 25s timer, then drain OD while active
  if(nextState && nextState.cs_orcBaddy) {
    _csOrcBaddyTimer = setTimeout(() => {
      if(!gameRunning || !window._csState || !window._csState.cs_orcBaddy) return;
      _csOrcBaddyDrainInterval = setInterval(() => {
        if(!gameRunning || gamePaused || godLevel === 0) return;
        if(!window._csState || !window._csState.cs_orcBaddy) return;
        godSecondsLeft = Math.max(0, godSecondsLeft - 0.1);
      }, 500);
    }, 25000);
  }

  // DEVILINGO: record combat start time
  if(nextState && nextState.cs_devilingo) {
    nextState._devilingoCombatStart = Date.now();
    nextState._devilingoRoundStart  = Date.now(); // set ONCE at run start — used for CURSED PANIC
    _csDebugLog('DEVILINGO started', nextState._devilingoCombatStart);
  }
  // GLOOM UNDER SIDE: start 2s obsession stack timer (+3%/stack up to 20; each stack also drains timer +1%)
  // Stacks persist through KO, Boss KO, and all combat. Reset only on run end.
  if(nextState && nextState.cs_gloomUnderSide) {
    _csGloomTimer = setInterval(() => {
      if(!gameRunning || gamePaused) return;
      if(!window._csState || !window._csState.cs_gloomUnderSide) return;
      const prevStacks = window._csState._gloomStacks || 0;
      if(prevStacks < 20) {
        window._csState._gloomStacks = prevStacks + 1;
      }
      // Timer drain: each stack makes time flow 1% faster (applied as -0.02s every 2s per stack)
      // This is safe: minimum drain per tick = 0, never drives timeLeft below 0
      const stacks = window._csState._gloomStacks || 0;
      if(stacks > 0 && typeof timeLeft !== 'undefined') {
        const drain = stacks * 0.02; // 1% of 2s per stack per tick
        timeLeft = Math.max(0, timeLeft - drain);
      }
      // GLOOM build-up VFX (คอสเมติกล้วน): aura หนักขึ้นตาม tier จริง + พัลส์เงาตอนขึ้น tier.
      // _gloomVfxTier เป็นตัวกัน fire ซ้ำสำหรับภาพเท่านั้น (run-only, ไม่เซฟ, ไม่แตะ logic/บาลานซ์).
      const _gloomTier = Math.min(3, Math.floor(stacks / 5));
      if(_gloomTier !== (window._csState._gloomVfxTier || 0)) {
        window._csState._gloomVfxTier = _gloomTier;
        _cardFx('gloom', { tier: _gloomTier });
      }
      // GLOOM Layer-3 peak (cosmetic): MAX OBSESSION ครบ 20 stack ครั้งแรก = signature moment.
      // _gloomMaxVfxFired กัน fire ซ้ำ (run-only, ไม่เซฟ, ไม่แตะ logic/บาลานซ์).
      if(stacks >= 20 && !window._csState._gloomMaxVfxFired) {
        window._csState._gloomMaxVfxFired = true;
        _cardFx('gloommax', { tier: 3 });
      }
    }, 2000);
  }
  // FALLEN WECHAT: init break flags
  if(nextState && nextState.cs_fallenWechat) {
    nextState._fallenWechatBreakActive = false;
    if(!nextState._fallenWechatCooldownUntil) nextState._fallenWechatCooldownUntil = 0;
  }
}

function _csStartEddga() {
  clearInterval(_csEddgaInterval);
  clearInterval(_csEddgaBurstInterval);
  // เปิด OD Lv1 ทันทีเมื่อเกมเริ่ม
  _csEddgaInterval = setInterval(()=>{
    if(!gameRunning || gamePaused) return;
    if(godLevel === 0 && canEnterGod) {
      _csEddgaForcedOd = true;
      godLevel = 1; canEnterGod = false;
      updateOdScreenAura(godLevel);
      _el.godLevelWrap.style.display = 'block';
      updateGodLevelUI();
      pulseOdLevel();
    }
  }, 500);
  // Lv2 burst every 15s for 5s
  _csEddgaBurstInterval = setInterval(()=>{
    if(!gameRunning || gamePaused) return;
    // Temporarily bypass EDDGA Lv1 lock for the burst
    const eddgaState = window._csState;
    eddgaState._eddgaBurstActive = true;
    _csEddgaForcedOd = true;
    activateGodLevel(2);
    eddgaState._eddgaBurstActive = false;
    // After 5s, revert to Lv1
    setTimeout(()=>{
      if(!gameRunning || window._csState !== eddgaState || !eddgaState.cs_eddga) return;
      activateGodLevel(1);
    }, 5000);
  }, 15000);
}

function _csStartThanatosTimer() {
  clearInterval(_csThanatosTimer);
  _csThanatosTimer = setInterval(()=>{
    if(!gameRunning || gamePaused) return;
    combo = 1;
    updateComboUI();
  }, 10000);
}

// ══════════════════════════════════════════════════════════════════
// LORD OF DEBT — DEBT STATE SYSTEM
// Isolated handcrafted powers. Non-recursive. Cleanup-safe.
// ══════════════════════════════════════════════════════════════════

// Module-level debt state tracking
let _lodDebtStateTimer     = null;  // 8s active state expiry
let _lodContractInterval   = null;  // 10s contract cycle (replaces _csLodTimer alias)
let _lodDebtCorruptionTimer= null;  // CORRUPTION: -1s every 3s sub-timer
let _lodDebtRequiemActive  = false; // REQUIEM: flag combo decay paused
let _lodDebtFinalHourLock  = false; // FINAL HOUR: timer cannot increase flag
let _lodDebtStacks         = 0;     // DEBT STACK counter (max 5)
let _lodActiveStateName    = '';    // name of currently active debt state

// ── DEBT STATE POOL ─────────────────────────────────────────────
// Each entry: { name, color, activate(cs), deactivate(cs) }
// activate/deactivate must be pure — no external card references,
// no recursive calls, no timer creation inside (timers managed externally).
const LOD_DEBT_STATES = [

  // 1. EXECUTION
  {
    name: 'EXECUTION',
    color: '#ff4422',
    activate(cs) {
      cs._lod_bossDmg      = 0.60;
      cs._lod_breakDmg     = 0.80;
      cs._lod_execLowHp    = true;   // crit +25% if boss <15%
    },
    deactivate(cs) {
      cs._lod_bossDmg      = 0;
      cs._lod_breakDmg     = 0;
      cs._lod_execLowHp    = false;
    }
  },

  // 2. ANALYZED
  {
    name: 'ANALYZED',
    color: '#00ffee',
    activate(cs) {
      cs._lod_akSpawnFast  = 0.35;   // AK47 delay *= (1-0.35)
      cs._lod_breakWinBonus= 800;    // ms added to break window at BREAK start
      cs._lod_breakGaugeBonus = 0.50; // extra BREAK gauge per tap
    },
    deactivate(cs) {
      cs._lod_akSpawnFast  = 0;
      cs._lod_breakWinBonus= 0;
      cs._lod_breakGaugeBonus = 0;
    }
  },

  // 3. BERSERK
  {
    name: 'BERSERK',
    color: '#ff6600',
    activate(cs) {
      cs._lod_berserkShadow = true;  // extra shadow 35% DMG, no combo/OD/break
    },
    deactivate(cs) {
      cs._lod_berserkShadow = false;
    }
  },

  // 4. REQUIEM
  {
    name: 'REQUIEM',
    color: '#cc88ff',
    activate(cs) {
      cs._lod_comboFrozen  = true;   // combo window pause (no decay)
      cs._lod_timerDrain   = 0.30;   // timer drains 30% faster
    },
    deactivate(cs) {
      cs._lod_comboFrozen  = false;
      cs._lod_timerDrain   = 0;
    }
  },

  // 5. GREED
  {
    name: 'GREED',
    color: '#ffcc00',
    activate(cs) {
      cs._lod_zenyBonus    = 0.80;
      cs._lod_dmgPenalty   = 0.20;   // boss dmg -20%
    },
    deactivate(cs) {
      cs._lod_zenyBonus    = 0;
      cs._lod_dmgPenalty   = 0;
    }
  },

  // 6. OVERLOAD
  {
    name: 'OVERLOAD',
    color: '#4488ff',
    activate(cs) {
      cs._lod_odGainBonus  = 0.40;   // OD charge +40%
      cs._lod_odDmgBonus   = 0.30;   // OD DMG +30%
      cs._lod_odDrainFast  = true;   // godSecondsLeft drains 1.5x
    },
    deactivate(cs) {
      cs._lod_odGainBonus  = 0;
      cs._lod_odDmgBonus   = 0;
      cs._lod_odDrainFast  = false;
    }
  },

  // 7. MASSACRE
  {
    name: 'MASSACRE',
    color: '#ff2233',
    activate(cs) {
      cs._lod_comboGainBonus = 1;    // +1 combo per click
      cs._lod_critDmgBonus   = 0.45;
      cs._lod_missCombo      = true; // miss WP → combo -5
    },
    deactivate(cs) {
      cs._lod_comboGainBonus = 0;
      cs._lod_critDmgBonus   = 0;
      cs._lod_missCombo      = false;
    }
  },

  // 8. CORRUPTION
  {
    name: 'CORRUPTION',
    color: '#aa00ff',
    activate(cs) {
      cs._lod_dmgBonus     = 0.90;   // DMG +90%
      cs._lod_corruption   = true;   // -1s every 3s (managed by external timer)
    },
    deactivate(cs) {
      cs._lod_dmgBonus     = 0;
      cs._lod_corruption   = false;
    }
  },

  // 9. HUNTER
  {
    name: 'HUNTER',
    color: '#00ff88',
    activate(cs) {
      cs._lod_wpDurationBonus = 0.40; // AK47 visible time +40%
      cs._lod_wpSizeBonus  = 0.20;   // AK47 scale +20% (visual)
      cs._lod_wpRewardBonus= 0.25;   // AK47 reward +25%
      cs._lod_bossDmgCut   = 0.25;   // normal boss dmg -25%
    },
    deactivate(cs) {
      cs._lod_wpDurationBonus = 0;
      cs._lod_wpSizeBonus  = 0;
      cs._lod_wpRewardBonus= 0;
      cs._lod_bossDmgCut   = 0;
    }
  },

  // 10. FINAL HOUR — only activates below 20s remaining
  {
    name: 'FINAL HOUR',
    color: '#ff0000',
    activate(cs) {
      cs._lod_dmgX2        = true;   // DMG x2
      cs._lod_breakPowerBonus = 0.50; // BREAK power +50%
      cs._lod_critBonus    = 0.30;   // crit +30%
      cs._lod_timerLock    = true;   // timer cannot increase
    },
    deactivate(cs) {
      cs._lod_dmgX2        = false;
      cs._lod_breakPowerBonus = 0;
      cs._lod_critBonus    = 0;
      cs._lod_timerLock    = false;
    }
  }
];

// ── Helpers ──────────────────────────────────────────────────────

function _lodCleanupActiveState() {
  // Clear the corruption sub-timer safely
  clearTimeout(_lodDebtCorruptionTimer);
  _lodDebtCorruptionTimer = null;
  _lodDebtRequiemActive = false;

  const cs = window._csState;
  if(!cs) return;

  // Deactivate all states to ensure clean slate
  for(const state of LOD_DEBT_STATES) {
    try { state.deactivate(cs); } catch(e) {}
  }
  _lodActiveStateName = '';

  // Update badge
  const badge = document.getElementById('debtActiveBadge');
  if(badge) { badge.textContent = ''; badge.classList.remove('visible'); }
}

function _lodCleanupAllDebt() {
  clearTimeout(_lodDebtStateTimer);
  clearInterval(_lodContractInterval);
  clearTimeout(_lodDebtCorruptionTimer);
  _lodDebtStateTimer = null;
  _lodContractInterval = null;
  _lodDebtCorruptionTimer = null;
  _lodDebtRequiemActive = false;
  _lodDebtFinalHourLock = false;
  _lodDebtStacks = 0;
  _lodActiveStateName = '';

  const cs = window._csState;
  if(cs) {
    for(const state of LOD_DEBT_STATES) {
      try { state.deactivate(cs); } catch(e) {}
    }
  }

  const counter = document.getElementById('debtStackCounter');
  if(counter) counter.style.display = 'none';
  const badge = document.getElementById('debtActiveBadge');
  if(badge) { badge.textContent = ''; badge.classList.remove('visible'); }
}

function _lodShowDebtPopup(name, color) {
  const popup = document.getElementById('debtStatePopup');
  const nameEl = document.getElementById('debtStateName');
  if(!popup || !nameEl) return;
  nameEl.textContent = name;
  nameEl.style.color = color;
  nameEl.style.textShadow = `0 0 16px ${color}88, 0 0 32px ${color}44`;
  popup.className = '';
  void popup.offsetWidth;
  popup.className = 'show';

  // Screen aura flash
  const aura = document.getElementById('debtAuraFlash');
  if(aura) {
    aura.style.background = `radial-gradient(ellipse at center, ${color}28 0%, transparent 70%)`;
    aura.className = '';
    void aura.offsetWidth;
    aura.className = 'flash';
  }
}

function _lodUpdateStackUI() {
  const counter = document.getElementById('debtStackCounter');
  if(!counter) return;
  if(!window._csState || !window._csState.cs_lordofdeath) {
    counter.style.display = 'none';
    return;
  }
  counter.style.display = 'block';
  const stacks = _lodDebtStacks;
  const maxStacks = 5;
  const pips = Array.from({length: maxStacks}, (_,i) => i < stacks ? '◆' : '◇').join('');
  counter.textContent = `DEBT ${pips}`;
  counter.style.color = stacks >= 4 ? '#ff2233' : stacks >= 2 ? '#cc88ff' : '#884499';
}

function _lodActivateDebtState() {
  if(!gameRunning || gamePaused) return;
  const cs = window._csState;
  if(!cs || !cs.cs_lordofdeath) return;

  // Cleanup previous state first
  _lodCleanupActiveState();
  clearTimeout(_lodDebtStateTimer);
  _lodDebtStateTimer = null;

  // Build candidate pool — FINAL HOUR only if <20s
  let pool = LOD_DEBT_STATES.slice(0, 9); // all except FINAL HOUR
  if(typeof timeLeft !== 'undefined' && timeLeft < 20) {
    pool = LOD_DEBT_STATES; // include FINAL HOUR
  }

  // Pick random state
  const state = pool[Math.floor(Math.random() * pool.length)];

  // Gain one DEBT STACK (max 5)
  const _prevDebt = _lodDebtStacks;
  _lodDebtStacks = Math.min(5, _lodDebtStacks + 1);
  _lodUpdateStackUI();
  // LOD VFX — DEBT CONTRACT signed: seal stamps (tinted by the forbidden power), binding chains,
  // rising interest; aura intensity climbs with the real DEBT STACK (accumulating obligation).
  // Cosmetic only — #debtStackCounter stays the source of truth.
  const _lodTier = _lodDebtStacks >= 5 ? 3 : _lodDebtStacks >= 3 ? 2 : 1;
  _cardFx('debt', { color: state.color, tier: _lodTier, stack: _lodDebtStacks });
  // MAX DEBT — inevitable collection (fires only when newly reaching 5)
  if(_prevDebt < 5 && _lodDebtStacks >= 5) _cardFx('debtmax');

  // Activate the state
  try { state.activate(cs); } catch(e) { console.warn('[LOD] state.activate error', e); return; }
  _lodActiveStateName = state.name;

  // Update badge on LOD card
  const badge = document.getElementById('debtActiveBadge');
  if(badge) { badge.textContent = state.name; badge.classList.add('visible'); }

  // Show popup
  _lodShowDebtPopup(state.name, state.color);

  // Start CORRUPTION drain timer if this state needs it
  if(cs._lod_corruption) {
    _lodStartCorruptionDrain();
  }

  // Store REQUIEM flag for combo freeze
  _lodDebtRequiemActive = !!(cs._lod_comboFrozen);

  // Store FINAL HOUR lock
  _lodDebtFinalHourLock = !!(cs._lod_timerLock);

  // Schedule deactivation after 8s
  _lodDebtStateTimer = setTimeout(() => {
    _lodDebtStateTimer = null;
    if(!window._csState || !window._csState.cs_lordofdeath) return;
    _lodCleanupActiveState();
    _lodDebtFinalHourLock = false;
  }, 8000);
}

function _lodStartCorruptionDrain() {
  clearTimeout(_lodDebtCorruptionTimer);
  _lodDebtCorruptionTimer = null;
  function _drainTick() {
    if(!gameRunning || gamePaused) { _lodDebtCorruptionTimer = setTimeout(_drainTick, 200); return; }
    const cs = window._csState;
    if(!cs || !cs.cs_lordofdeath || !cs._lod_corruption) return;
    if(typeof timeLeft !== 'undefined') timeLeft = Math.max(0, timeLeft - 1);
    // Schedule next tick in 3s
    _lodDebtCorruptionTimer = setTimeout(_drainTick, 3000);
  }
  _lodDebtCorruptionTimer = setTimeout(_drainTick, 3000);
}

function _csStartLodTimer() {
  // Clear any existing LOD timers (uses module globals now)
  clearInterval(_csLodTimer);
  clearInterval(_lodContractInterval);
  clearTimeout(_lodDebtStateTimer);
  clearTimeout(_lodDebtCorruptionTimer);
  _csLodTimer = null; // keep null — we use _lodContractInterval
  _lodDebtStacks = 0;
  _lodDebtRequiemActive = false;
  _lodDebtFinalHourLock = false;

  // Show LOD card icon (no image — uses card_of_debt image from card definition)
  const display = $('lodCardDisplay');
  const img     = $('lodCardImg');
  if(display && img) {
    display.style.display = 'flex';
    img.className = 'rarity-mythic';
    const lodCard = CARD_POOL.find(c => c.id === 'ld');
    if(lodCard && lodCard.img) { img.src = lodCard.img; img.style.opacity = '1'; }
  }

  // Reset all debt state fields on current cs
  if(window._csState) {
    for(const state of LOD_DEBT_STATES) {
      try { state.deactivate(window._csState); } catch(e) {}
    }
  }

  // Update stack UI (shows empty pips)
  _lodUpdateStackUI();

  // Trigger first contract immediately
  _lodActivateDebtState();

  // Contract cycle every 10s
  _lodContractInterval = setInterval(() => {
    if(!gameRunning || gamePaused) return;
    if(!window._csState || !window._csState.cs_lordofdeath) return;
    _lodActivateDebtState();
  }, 10000);
}

function _lodShowCard(card, isFirst) {
  const display = $('lodCardDisplay');
  const img     = $('lodCardImg');
  const lbl     = $('lodCardChange');
  if(!display || !img) return;

  display.style.display = 'flex';

  // set rarity class for border style
  img.className = 'rarity-' + (card.rarity || 'common');

  if(card.img) {
    img.src = card.img;
    img.style.opacity = '1';
  } else {
    img.style.opacity = '0';
  }

  if(!isFirst) {
    lbl.classList.add('show');
    setTimeout(()=> lbl.classList.remove('show'), 1200);
  }
}

// แสดงการ์ดที่เลือก (ไม่ใช่ LOD) — ไม่มี CHANGED label
function _showActiveCard(card) {
  if(!card) return;
  const display = $('lodCardDisplay');
  const img     = $('lodCardImg');
  if(!display || !img) return;

  display.style.display = 'flex';
  img.className = 'rarity-' + (card.rarity || 'common');

  if(card.img) {
    img.src = card.img;
    img.style.opacity = '1';
  } else {
    img.style.opacity = '0';
  }
  // ── Card Mastery: apply visual to in-game card thumbnail
  cmApplyVisual(img, card.id);
}

function _lodHideCard() {
  const display = $('lodCardDisplay');
  if(display) display.style.display = 'none';
  const img = $('lodCardImg');
  if(img) img.className = '';
}

function _csSyncWeakPointAvailability(prevHadRsx=false, reschedulePending=false) {
  if(!gameRunning) return;
  const hasRsx = !!(window._csState && window._csState.cs_rsx0806);

  if(hasRsx) {
    clearTimeout(wpSchedule);
    wpSchedule = null;
    clearTimeout(wpTimeout);
    wpTimeout = null;
    wpActive = false;
    wpCollected = 0;
    updateWpCounter();
    const wp = $('weakPoint');
    if(wp) {
      wp.style.display = 'none';
      wp.classList.remove('wp-vanish');
    }
    return;
  }

  if(prevHadRsx) {
    wpCollected = 0;
    updateWpCounter();
  }

  if(!wpActive && reschedulePending && wpSchedule) {
    scheduleWeakPoint();
    return;
  }

  if(!wpActive && !wpSchedule) scheduleWeakPoint();
}

function _csStopAllTimers() {
  clearInterval(_csThanatosTimer);
  clearInterval(_csLodTimer);
  clearTimeout(_csLodSwapTimeout);
  clearInterval(_csEddgaInterval);
  clearInterval(_csEddgaBurstInterval);
  clearTimeout(_csOrcBaddyTimer);
  clearInterval(_csOrcBaddyDrainInterval);
  clearInterval(_csGloomTimer);
  _csThanatosTimer = null;
  _csLodTimer = null;
  _csLodSwapTimeout = null;
  _csEddgaInterval = null;
  _csEddgaBurstInterval = null;
  _csOrcBaddyTimer = null;
  _csOrcBaddyDrainInterval = null;
  _csGloomTimer = null;
  // BEELZEBRUH: cancel discharge expiry timer on any run-end/reset path
  if(window._csState && window._csState._beelzebubExpireTimer) {
    clearTimeout(window._csState._beelzebubExpireTimer);
    window._csState._beelzebubExpireTimer = null;
  }
  _csResetOdFromExpiredEddga();
  _lodHideCard();
  // LORD OF DEBT: clean up all debt state timers and modifiers
  _lodCleanupAllDebt();
}

function _sanitizeDamage(value, source='unknown') {
  if(Number.isFinite(value) && value > 0) return value;
  const debugState = {
    source,
    value,
    cardState: window._csState ? Object.keys(window._csState).filter(k => k.startsWith('cs_') && window._csState[k]) : [],
    isBoss,
    hp,
    maxHP,
    godLevel
  };
  console.warn('[DamageGuard] invalid damage, applying fallback', debugState);
  _csDebugLog('DamageGuard fallback', debugState);
  return 1;
}

// ── helper: apply card modifiers to damage ──
function csApplyDmgMod(baseDmg, isGod) {
  if(!window._csState) return baseDmg;
  const cs = window._csState;
  let d = baseDmg;
  if(cs.cs_dmgBonus)   d *= (1 + cs.cs_dmgBonus);
  if(cs.cs_bossDmgBonus && isBoss) d *= (1 + cs.cs_bossDmgBonus);
  if(cs.cs_devilingo && isBoss && cs._devilingoCombatStart && Date.now() - cs._devilingoCombatStart <= 15000) d *= 1.70;
  // MISSSTRESS no longer has a non-OD damage penalty.
  if(cs.cs_mummy_active) d *= (1 + (cs.cs_combo20Dmg||0));
  if(cs.cs_skelworker_bonus) d *= (1 + cs.cs_skelworker_bonus);
  if(cs._turtleShogunEndTime && performance.now() < cs._turtleShogunEndTime) d *= 1.45;
  if(cs.cs_horong_active) d *= 1.20;
  // MARVELC: dmg +8% when time < 15s
  if(cs.cs_marvelcLowTime && cs._marvelcLowTimeActive) d *= 1.08;
  if(cs.cs_raydric && cs._raydricActive) d *= 1.15;
  if(cs.cs_zenorc_active) d *= (1 + cs.cs_zenorc_active);
  if(cs.cs_moonlightflower) d *= 2;
  if(cs.cs_stormyKnight && godLevel > 0) d *= 1.30;
  // MINORAGE — ORE RAGE
  if(cs.cs_minorous) {
    // Ore Crack: DMG +8%/stack (passive ระหว่างที่ยังถืออยู่ — สูงสุด 3 stack = +24%)
    if(cs.cs_minorageOreStacks) d *= (1 + cs.cs_minorageOreStacks * 0.08);
    // ใช้ Ore Crack ตอนเริ่ม BREAK: BREAK DMG +20%/stack (เฉพาะหน้าต่าง BREAK รอบนั้น)
    if(cs._minorageBreakDmgBonus && typeof pressureIsBreak === 'function' && pressureIsBreak()) d *= (1 + cs._minorageBreakDmgBonus);
    // RAGE RUSH: DMG +25%
    if(cs.cs_minorageRageRushUntil && performance.now() < cs.cs_minorageRageRushUntil) d *= 1.25;
  }
  // Executioner: +50% when HP < 25%
  if(cs._executionModeEndTime && performance.now() < cs._executionModeEndTime) d *= 1.60;
  // EXECUSIONER: additional BREAK DMG +35% during Execution Mode
  if(cs.cs_executioner && cs._executionModeEndTime && performance.now() < cs._executionModeEndTime
     && typeof pressureIsBreak === 'function' && pressureIsBreak()) d *= 1.35;
  // Beelzebub: accumulated corruption dmg bonus
  if(cs.cs_beelzebub && cs._beelzebubBonus) d *= (1 + cs._beelzebubBonus);
  // Beelzebub: coin-burst window (applied in coin mod)
  // RSX-0806: dmg x2.5 base + BREAK-stacked bonus + Execution Phase
  if(cs.cs_rsx0806) {
    d *= 2.5;
    if(cs._rsxBreakBonus) d *= (1 + cs._rsxBreakBonus);
    if(cs._rsxExecutionEndTime && performance.now() < cs._rsxExecutionEndTime) d *= 1.5;
  }
  // Amon Ra: combo >= 40 dmg +40%
  if(cs._amogBuffEndTime && performance.now() < cs._amogBuffEndTime) d *= 1.35;
  // Goblin Leader: combo >= 30 dmg +20%
  if(cs.cs_goblinLeader && combo >= 25) d *= 1.20;
  if(cs.cs_freeoni && cs._freeoniOdDmgStack) d *= (1 + cs._freeoniOdDmgStack);
  // Orc Hero: accumulated dmg bonus from OD completions
  if(cs.cs_orchero && cs._orcheroDmgStack) d *= (1 + cs._orcheroDmgStack);
  // Ktullanux handled in WP bomb section
  // ORC BADDY: OD bar >= 70% → dmg +12% (nerfed from +18%)
  if(cs.cs_orcBaddy) {
    const _odFill = _el && _el.godFill ? (parseFloat(_el.godFill.style.width) || 0) : 0;
    if(_odFill >= 70 || godLevel > 0) d *= 1.12;
  }
  // GHOSTPING: during BREAK → dmg +30%
  if(cs.cs_ghostping && typeof pressureIsBreak === 'function' && pressureIsBreak()) d *= 1.55;
  // LADY TRAINEE: run-only accumulated dmg bonus (max +30%)
  if(cs.cs_ladyTrainee && cs._ladyTraineeDmg) d *= (1 + cs._ladyTraineeDmg);
  // FALLEN WECHAT: Overloaded BREAK → dmg +60%
  if(cs.cs_fallenWechat && cs._fallenWechatBreakActive && typeof pressureIsBreak === 'function' && pressureIsBreak()) d *= 1.60;
  // DETAILED: Analysis stacks during BREAK → +4% per stack
  if(cs.cs_detailed && typeof pressureIsBreak === 'function' && pressureIsBreak() && cs._analysisStacks) d *= (1 + (cs._analysisStacks * 0.04));
  // GLOOM UNDER SIDE: run-scaling dmg bonus (+3% per stack, max +60%)
  if(cs.cs_gloomUnderSide && cs._gloomStacks) d *= (1 + cs._gloomStacks * 0.03);
  // DORK LORD: NIGHT STACK dmg +6%/stack (max 5 stacks = +30%)
  if(cs.cs_dorkLord && cs._dorkNightStacks) d *= (1 + cs._dorkNightStacks * 0.06);
  // SALVAGE: during BREAK → dmg +15% additional
  if(cs.cs_salvageBreak && typeof pressureIsBreak === 'function' && pressureIsBreak()) d *= 1.15;
  // HYDRA: BREAK DMG +10% per Head (max 3 heads = +30%)
  if(cs.cs_hydra && cs._hydraHeads && typeof pressureIsBreak === 'function' && pressureIsBreak()) d *= (1 + cs._hydraHeads * 0.10);
  // STONK: during BREAK → dmg +20% additional
  if(cs.cs_stonkBreak && typeof pressureIsBreak === 'function' && pressureIsBreak()) d *= 1.20;
  // GENERAL GRIEVOUS: during BREAK → dmg +22% additional
  if(cs.cs_ggBreak && typeof pressureIsBreak === 'function' && pressureIsBreak()) d *= 1.22;
  // MAYA PROBLEM: 5s post-BREAK boss dmg +20%
  if(cs.cs_mayaProblem && isBoss && cs._mayaBreakEndTime && performance.now() < cs._mayaBreakEndTime) d *= 1.40;
  // WEEBVIL DUDE: awakened break burst +35% 5s
  if(cs.cs_weebvilDude && cs._weebvilBreakBurstEndTime && performance.now() < cs._weebvilBreakBurstEndTime) d *= 1.35;
  // ATROSUS: Resonance post-BREAK (x1.6 base, x2.0 after Resonant Mastery)
  if(cs.cs_atrosusBreak && cs._atrosusBreakEndTime && performance.now() < cs._atrosusBreakEndTime) {
    d *= cs._atrosusResonanceMastery ? 2.0 : 1.6;
  }
  // THANABROS: Thanatos Phase post-BREAK (x2 dmg)
  if(cs.cs_thanatos && cs._thanatosPhaseEndTime && performance.now() < cs._thanatosPhaseEndTime) d *= 2.0;
  // IFRIED: Inferno Burst (x2.5 dmg)
  if(cs.cs_ifriedBreak && cs._ifriedBurstEndTime && performance.now() < cs._ifriedBurstEndTime) d *= 2.5;
  // KILL-D01: Execution bonus (x1.5 after 8 Drive Tokens consumed)
  if(cs.cs_killD01 && cs._killD01ExecutionEndTime && performance.now() < cs._killD01ExecutionEndTime) d *= 1.5;
  // NOSIRIS: Judgment phase (x2 dmg)
  if(cs.cs_osiris && cs._osirisJudgmentEndTime && performance.now() < cs._osirisJudgmentEndTime) d *= 2.0;
  // TAO FUNKA: FUNK FEVER burst
  if(cs.cs_taoFunka && cs._taoFunkFeverEndTime && performance.now() < cs._taoFunkFeverEndTime) d *= 1.45;
  // INCANTATION SCAMURAI: contract burst
  if(cs.cs_incantation && cs._incantationContractEndTime && performance.now() < cs._incantationContractEndTime) d *= 1.70;
  // LORD OF DEBT: active debt state damage modifiers
  if(cs.cs_lordofdeath) {
    if(cs._lod_dmgBonus)     d *= (1 + cs._lod_dmgBonus);      // CORRUPTION: +90%
    if(cs._lod_bossDmg && isBoss)  d *= (1 + cs._lod_bossDmg); // EXECUTION: +60% boss
    if(cs._lod_bossDmgCut && isBoss) d *= (1 - cs._lod_bossDmgCut); // HUNTER: -25% boss
    if(cs._lod_dmgPenalty && isBoss) d *= (1 - cs._lod_dmgPenalty); // GREED: -20% boss
    if(cs._lod_dmgX2)        d *= 2;                            // FINAL HOUR: x2
    if(cs._lod_execLowHp && isBoss && bossHP < bossMaxHP * 0.15) {
      // EXECUTION: crit +25% already in crit section, dmg multiplier here
    }
    if(cs._lod_breakDmg && typeof pressureIsBreak === 'function' && pressureIsBreak()) d *= (1 + cs._lod_breakDmg); // EXECUTION: +80% break
    if(cs._lod_odDmgBonus && godLevel > 0) d *= (1 + cs._lod_odDmgBonus); // OVERLOAD: OD DMG +30%
  }
  return _sanitizeDamage(Math.round(d), 'csApplyDmgMod');
}

// ── helper: apply card modifiers to coin gain ──
function csApplyCoinMod(coins) {
  if(!window._csState) {
    const mult = typeof pressureCoinMultiplier === 'function' ? pressureCoinMultiplier() : 1;
    return Math.round(coins * mult);
  }
  const cs = window._csState;
  let c = coins;
  if(cs.cs_coinPct)   c *= (1 + cs.cs_coinPct);
  // ALLEYGATOR: accumulated percentage bonus from KO stacks
  if(cs._alligatorPct) c *= (1 + cs._alligatorPct);
  // GOLDEN BRUH: Gold Rush x7 when active, x2.5 baseline (no OD)
  if(cs.cs_goldenbug) {
    if(cs._goldRushEndTime && performance.now() < cs._goldRushEndTime) c *= 9;
    else c *= 3;
  }
  // NOSIRIS: Judgment x2 coin
  if(cs.cs_osiris) {
    if(cs._osirisJudgmentEndTime && performance.now() < cs._osirisJudgmentEndTime) c *= 2;
  }
  // BEELZEBRUH: max-corruption discharge coin ×1.5 (8s window)
  if(cs.cs_beelzebub && cs._beelzebubCoinEndTime && performance.now() < cs._beelzebubCoinEndTime) c *= 1.5;
  if(cs.cs_moonlightflower) c *= 2;
  if(cs.cs_devilingo && cs._devilingoCombatStart && Date.now() - cs._devilingoCombatStart <= 15000) c *= 1.30;
  
  if(typeof pressureCoinMultiplier === 'function') c *= pressureCoinMultiplier();
  // A-LIST: Sponsor Rush +25% coin
  if(cs.cs_aListCard && cs._sponsorRushEndTime && performance.now() < cs._sponsorRushEndTime) c *= 1.25;
  // GLOOM UNDER SIDE: run-scaling Zeny bonus (+3% per stack, max +60%)
  if(cs.cs_gloomUnderSide && cs._gloomStacks) c *= (1 + cs._gloomStacks * 0.03);
  // DARK STAKE LORD: permanent card trade-off, not an OCA-rate change.
  if(cs.cs_darkStakeLord) c *= 0.90;
  // LORD OF DEBT: GREED state Zeny bonus
  if(cs.cs_lordofdeath && cs._lod_zenyBonus) c *= (1 + cs._lod_zenyBonus);
  return Math.round(c);
}

// ── helper: on each click ──
function csOnClick(isGod) {
  if(!window._csState || !gameRunning) return;
  const cs = window._csState;
  // MISSSTRESS: Zeny +12 (ICD 300ms) and OD timer +0.35s during OD (cap per OD = +4s)
  // FIX: Added ICD to Zeny gain (prevent ~+1200 Zeny/OD at max tap rate)
  // FIX: Reduced time cap from +6s to +4s to match updated card description
  if(cs.cs_mistress && isGod) {
    const _mNow = performance.now();
    if(!cs._mistressZenyIcdUntil) cs._mistressZenyIcdUntil = 0;
    if(_mNow >= cs._mistressZenyIcdUntil) {
      roundCoins += 12;
      cs._mistressZenyIcdUntil = _mNow + 300;
      _cardFx('hive'); // MISSSTRESS — bees join the hive (ICD-throttled 0.3s, cosmetic)
    }
    if(!cs._mistressOdTimeGain) cs._mistressOdTimeGain = 0;
    if(cs._mistressOdTimeGain < 4) {
      const gain = Math.min(0.35, 4 - cs._mistressOdTimeGain);
      cs._mistressOdTimeGain += gain;
      godSecondsLeft += gain;
      // MISSSTRESS — hive-expansion charge ring from real OD-extension (0–4, cosmetic)
      try { if(window.CardVFX && activeCard && activeCard.id === 'mt') window.CardVFX.setCharge('mt', Math.round(cs._mistressOdTimeGain), 4); } catch(e){}
    }
    updateUI();
  }
  if(cs.cs_odTimerOnClick && isGod) {
    if(!cs._odTimerClickGain) cs._odTimerClickGain = 0;
    if(cs._odTimerClickGain < 5) {
      const gain = Math.min(cs.cs_odTimerOnClick, 5 - cs._odTimerClickGain);
      cs._odTimerClickGain += gain;
      godSecondsLeft += gain;
    }
    updateUI();
  }
  // combo milestone coin (poporing)
  if(cs.cs_comboMilestoneCoin && combo > 0 && combo % 10 === 0) {
    const bonus = csApplyCoinMod(cs.cs_comboMilestoneCoin);
    roundCoins += bonus;
    updateUI();
  }
  // update combo-based states
  if(cs.cs_combo20Dmg)  cs.cs_mummy_active  = combo >= 20;
  
  if(cs.cs_elderWillow) cs.cs_elderWillow_active = combo >= 25;
  if(cs.cs_horong)      cs.cs_horong_active = timeLeft < 15;
  // WRONG CARD tradeoff: when horong_active, add combo decay penalty
  if(cs.cs_horong && cs.cs_horongTradeoff) cs._horongDecayActive = cs.cs_horong_active;
  if(cs.cs_goblinLeader && combo >= 47) {
    // GOBLIN WEEBER — fire WEEB FOCUS VFX เฉพาะตอนเริ่มต้นรอบ focus (transition guard, ไม่สแปม)
    const _wfWasActive = cs._weebFocusEndTime && performance.now() < cs._weebFocusEndTime;
    cs._weebFocusEndTime = performance.now() + 5000;
    if(!_wfWasActive) _cardFx('combo');
  }
  // MINORAGE — ORE RAGE: สะสม Ore Crack จากการคลิก (สูงสุด 3)
  // HP ≤30% เก็บเร็วขึ้น (ทุก 12 คลิก แทน 18) — เปลี่ยนแค่ความเร็วการเก็บ ไม่ใช่ดาเมจตรง
  if(cs.cs_minorous && (cs.cs_minorageOreStacks || 0) < 3) {
    const _miRatio = isBoss ? (bossHP/bossMaxHP) : (hp/maxHP);
    const _miInterval = (_miRatio <= 0.30) ? 12 : 18;
    cs.cs_minorageOreClicks = (cs.cs_minorageOreClicks || 0) + 1;
    if(cs.cs_minorageOreClicks >= _miInterval) {
      cs.cs_minorageOreClicks = 0;
      cs.cs_minorageOreStacks = (cs.cs_minorageOreStacks || 0) + 1;
      _cardFx('oregain', { stack: cs.cs_minorageOreStacks, max: 3 }); // mining spark + stack pip (cosmetic)
    }
  }
  // MARVELC: low-time dmg bonus (<15s)
  if(cs.cs_marvelcLowTime) cs._marvelcLowTimeActive = timeLeft < 15;
  // RAYTRICK: set _raydricActive when current enemy HP ratio <= 60%
  // FIX: _raydricActive was never set before — card had zero runtime effect
  if(cs.cs_raydric) {
    const _raydricRatio = isBoss ? (bossHP / bossMaxHP) : (hp / maxHP);
    cs._raydricActive = _raydricRatio <= 0.60;
  }
  // Amon Ra: combo >= 40 → dmg+40% + coin x1.5
  
  if(cs.cs_turtleShogun){ const now=performance.now(); if(combo>=25 && now>=(cs._turtleShogunCooldownUntil||0) && now>=(cs._turtleShogunEndTime||0)){ cs._turtleShogunEndTime=now+6000; cs._turtleShogunCooldownUntil=now+12000; cs._turtleComboDecayFast=0.35; _cardFx('stance'); /* TURTLE SHOGUN — SHOGUN STANCE เปิด (cosmetic) */ } if((cs._turtleShogunEndTime||0)<=now) cs._turtleComboDecayFast=0; }
  if(cs.cs_incantation){
    const now = performance.now();
    if(combo >= 35 && now >= (cs._incantationCdUntil||0) && !cs._incantationContractEndTime) {
      cs._incantationContractEndTime = now + 6000;
      cs._incantationCdUntil = now + 18000;
      _cardFx('contract'); // INCANTATION SCAMURAI — CONTRACT เปิด: ยันต์สัญญา (cosmetic)
    }
    if(cs._incantationContractEndTime && now >= cs._incantationContractEndTime) {
      cs._incantationContractEndTime = 0;
      combo = Math.min(combo, 15);
    }
  }
  if(cs.cs_amogRa){ const now=performance.now(); if(combo>=20 && now>=(cs._amogCooldownUntil||0) && !cs._amogTriggerLock){ cs._amogTriggerLock=true; cs._amogCooldownUntil=now+8000; if(Math.random()<0.7){ cs._amogBuffEndTime=now+5000; cs._amogCritEndTime=now+5000; cs._amogSusEndTime=0; } else { timeLeft=Math.max(1,timeLeft-2); cs._amogBuffEndTime=0; cs._amogCritEndTime=0; cs._amogSusEndTime=now+5000; cs._amogAkBoostEndTime=now+4000; } } if(combo<20) cs._amogTriggerLock=false; }
  if(cs.cs_executioner){ const now=performance.now(); const ratio=isBoss?(bossHP/bossMaxHP):(hp/maxHP); if(ratio<0.30 && now>=(cs._executionCooldownUntil||0) && now>=(cs._executionModeEndTime||0)){ cs._executionModeEndTime=now+5000; cs._executionCooldownUntil=now+18000; } }
  if(cs.cs_aknightExecute){
    const now = performance.now();
    if(combo >= 30 && now >= (cs._aknightReadyCooldownUntil || 0) && now >= (cs._aknightReadyEndTime || 0)) {
      cs._aknightReadyEndTime = now + 5000;
    }
    if((cs._aknightReadyEndTime || 0) > 0) {
      if(combo < 30 || now >= cs._aknightReadyEndTime) {
        cs._aknightReadyEndTime = 0;
        cs._aknightReadyCooldownUntil = now + 12000;
      }
    }
  }
  if(cs.cs_dorkLord){ const now=performance.now(); if(!cs._dorkNextStackAt) cs._dorkNextStackAt=now+15000; while((cs._dorkNightStacks||0)<5 && now>=cs._dorkNextStackAt){ cs._dorkNightStacks=(cs._dorkNightStacks||0)+1; cs._dorkNextStackAt+=15000; } cs._dorkTimerRateBonus=Math.min(0.15,(cs._dorkNightStacks||0)*0.03);
    // DORK LORD: NIGHT STACK build-up VFX (คอสเมติกล้วน): aura เงาหนักขึ้นตาม tier จริง (0–5 → 0–3)
    // + พัลส์เงาตอนขึ้น tier. _dorkVfxTier กัน fire ซ้ำสำหรับภาพเท่านั้น (run-only, ไม่เซฟ, ไม่แตะ logic/บาลานซ์).
    const _dorkTier = Math.min(3, Math.round((cs._dorkNightStacks||0)*0.6));
    if(_dorkTier !== (cs._dorkVfxTier||0)){ cs._dorkVfxTier = _dorkTier; _cardFx('nightstack', { tier: _dorkTier }); }
  }
  // Goblin Leader: combo+2 per click (applied in processHit combo line)
  // Beelzebub: accumulate corruption per click (max 50%)
  if(cs.cs_beelzebub) {
    if(!cs._beelzebubBonus) cs._beelzebubBonus = 0;
    if(cs._beelzebubBonus < 0.50) cs._beelzebubBonus = Math.min(0.50, cs._beelzebubBonus + 0.005);
  }
  // KILL-D01: Drive Token accumulation during OD (every 3 clicks)
  if(cs.cs_killD01 && isGod) {
    if(!cs._killD01OdClickCount) cs._killD01OdClickCount = 0;
    cs._killD01OdClickCount++;
    if(cs._killD01OdClickCount % 3 === 0) {
      cs._driveTokens = Math.min(8, (cs._driveTokens || 0) + 1);
      // KILL-D01 VFX — Drive Token gained: drive-core charge + pip (cosmetic, real count).
      _cardFx('token', { stack: cs._driveTokens, max: 8 });
    }
  }
  // GOLDEN BRUH: +3 coin per click during Gold Rush
  if(cs.cs_goldenbug && cs._goldRushEndTime && performance.now() < cs._goldRushEndTime) {
    roundCoins += 8;
  }
  // Mastering: combo milestone time bonus
  if(cs.cs_comboTimeBonus && combo > 0 && combo % 10 === 0) {
    if(!cs._comboTimeBonusAcc) cs._comboTimeBonusAcc = 0;
    if(cs._comboTimeBonusAcc < 3) {
      const gain = Math.min(0.3, 3 - cs._comboTimeBonusAcc);
      cs._comboTimeBonusAcc += gain;
      if(!_lodDebtFinalHourLock) timeLeft += gain;
    }
  }
  // Jakk: crit bonus during OD — tracked via cs_jakkCrit flag, applied in processHit
  // Vitata: OD charge x1.3 when combo >= 15 — applied in charge section
  if(cs.cs_skelWorker) {
    const tiers = Math.min(Math.floor(combo/10),3);
    cs.cs_skelworker_bonus = tiers * 0.08;
  }
  // STORMYNITE: Storm Charge 6s, every 12 clicks gain +1s (max +3/OD)
  if(cs.cs_stormyKnight && isGod && cs._stormChargeEndTime && performance.now() < cs._stormChargeEndTime) {
    cs._stormChargeClicks = (cs._stormChargeClicks || 0) + 1;
    if(cs._stormChargeClicks >= 12 && (cs._stormyOdTimeGain || 0) < 3) {
      cs._stormChargeClicks = 0;
      cs._stormyOdTimeGain = Math.min(3, (cs._stormyOdTimeGain || 0) + 1);
      godSecondsLeft += 1;
      // Lightning Burst: instant damage burst (0.8x equivalent of a combo x2 hit)
      const _lbDmg = isBoss
        ? Math.round(bossMaxHP * 0.018 * (1 + (_sc.desoBns || 0)))
        : Math.round(maxHP * 0.04);
      setTimeout(() => {
        if(!gameRunning || gamePaused) return;
        applyBossDamage(_lbDmg, 'storm-lightning');
        showBigSplash('LIGHTNING BURST', '+1s OD • STORM STRIKE', '#aaeeff', false);
      }, 0);
    }
  }
  // Zenorc: OD usage stacks handled in csOnOdStart; BREAK adds flat +6% (nerfed from +8%)
  if(cs.cs_zenorc) {
    cs.cs_zenorc_active = (cs._zenorcCount||0) * 0.06;
    if(typeof pressureIsBreak === 'function' && pressureIsBreak()) cs.cs_zenorc_active += 0.06;
  }
  // Elder Willow: boost OD charge
  if(cs.cs_elderWillow_active && !isGod) {
    // applied in hit() via charge multiplier
  }
  cs._taoComboDecayFast = (cs.cs_taoFunka && cs._taoFunkFeverEndTime && performance.now() < cs._taoFunkFeverEndTime) ? 0.25 : 0;
  // LORD OF DEBT: OVERLOAD state — extra OD charge per click
  if(cs.cs_lordofdeath && cs._lod_odGainBonus && godLevel === 0
     && !cs.cs_goldenbug && !cs.cs_rsx0806) {
    const cur = parseFloat(_el.godFill.style.width) || 0;
    _el.godFill.style.width = Math.min(100, cur + cs._lod_odGainBonus * 100) + '%';
    if(parseFloat(_el.godFill.style.width) >= 100 && canEnterGod) activateGodLevel(1);
  }
}


// ── helper: on KO ──
function csOnKO() {
  if(!window._csState || !gameRunning) return;
  const cs = window._csState;
  if(cs.cs_koTimeBonus) {
    _csKoTimeAcc += 0.05;
    if(_csKoTimeAcc <= 5 && !_lodDebtFinalHourLock) timeLeft += 0.05;
  }
  // DORK LORD: +0.08s per KO + score +80
    // Turtle General: score +300 per KO when combo >= 30
  if(cs._turtleShogunEndTime && performance.now() < cs._turtleShogunEndTime) score += 250;
  // RAYTRICK: reset active state on KO — new enemy starts at full HP, must re-earn the bonus
  if(cs.cs_raydric && cs.cs_raydricResetOnKO) {
    cs._raydricActive = false;
  }
  // MINORAGE — ORE RAGE: Ore Crack ไม่รีเซ็ตตอน KO (สะสมข้ามศัตรูภายในรอบ
  // แล้วระเบิดตอน BREAK) — เคลียร์เฉพาะตอนเริ่ม/จบรอบผ่าน _csState ใหม่
  // Nightmare: +2% OD charge per KO
  if(cs.cs_koOdCharge && !cs.cs_goldenbug) {
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.min(100, cur + cs.cs_koOdCharge*100) + '%';
    if(parseFloat(_el.godFill.style.width)>=100 && canEnterGod && godLevel===0) activateGodLevel(1);
  }
  // Zenorc OD stack tracked in csOnOdStart
  // Alligator: every 6 KOs = +1.5% coin bonus (max +15%); during BREAK counts 2x
  if(cs.cs_alligator) {
    if(!cs._alligatorKoCount) cs._alligatorKoCount = 0;
    if(!cs._alligatorPct) cs._alligatorPct = 0;
    if(cs._alligatorPct < 0.15) {
      cs._alligatorKoCount++;
      const inBreak = (typeof pressureIsBreak === 'function' && pressureIsBreak());
      const threshold = inBreak ? 3 : 6;
      if(cs._alligatorKoCount % threshold === 0) {
        cs._alligatorPct = Math.min(0.15, cs._alligatorPct + 0.015);
      }
    }
  }
  // Demon Pungus: every 5 KO = OD charge +8%
  if(cs.cs_demonPungus) {
    if(!cs._demonPungusKO) cs._demonPungusKO = 0;
    cs._demonPungusKO++;
    if(cs._demonPungusKO % 5 === 0 && !cs.cs_goldenbug) {
      const cur = parseFloat(_el.godFill.style.width)||0;
      _el.godFill.style.width = Math.min(100, cur + 8) + '%';
      if(parseFloat(_el.godFill.style.width)>=100 && canEnterGod && godLevel===0) activateGodLevel(1);
    }
  }
}

// ── helper: on OD end ──
function csOnOdEnd() {
  if(!window._csState) return;
  const cs = window._csState;
  cs._mistressOdTimeGain = 0;
  cs._mistressZenyIcdUntil = 0; // reset ICD so Zeny gain starts fresh next OD
  // MISSSTRESS aftermath — OD ends: swarm returns to hive → clear hive-expansion ring (cosmetic)
  if(cs.cs_mistress) { try { if(window.CardVFX && activeCard && activeCard.id === 'mt') window.CardVFX.clearCharge(); } catch(e){} }
  cs._odTimerClickGain = 0;
  cs._stormyOdTimeGain = 0;
  // COKE ZERO: accumulate dmg bonus +10% per OD end (max +50%)
  if(cs.cs_orchero) {
    if(!cs._orcheroDmgStack) cs._orcheroDmgStack = 0;
    if(cs._orcheroDmgStack < 0.90) cs._orcheroDmgStack = Math.min(0.90, cs._orcheroDmgStack + 0.15);
    // COKE ZERO VFX — void buildup: aura/world bends harder per real DMG stack (0–0.90 → tier 0–3);
    // at max, fire the one-time SINGULARITY cue (cosmetic, run-only guard).
    try {
      if(window.CardVFX && activeCard && activeCard.id === 'oh') {
        window.CardVFX.setAuraTier('oh', Math.min(3, Math.round(cs._orcheroDmgStack / 0.30)));
        if(cs._orcheroDmgStack >= 0.90 && !cs._orcheroSingularityFired) {
          cs._orcheroSingularityFired = true;
          _cardFx('singularity');
        }
      }
    } catch(e){}
  }
  // KILL-D01: reset per-OD click counter when OD expires
  if(cs.cs_killD01) cs._killD01OdClickCount = 0;
  // OD collapse penalty: if peak level reached < Lv3 when OD ends
  if((cs._currentOdPeakLevel || 0) < 3) {
    // LADY TRAINEE: lose 2 stacks if OD ended below Lv3
    if(cs.cs_ladyTrainee && cs._ladyTraineeDmg) {
      cs._ladyTraineeDmg = Math.max(0, cs._ladyTraineeDmg - 0.00);
    }
  }
  cs._currentOdPeakLevel = 0;
}

// ── helpers: new card events ──

function csOnBreakStart() {
  if(!window._csState || !gameRunning) return;
  const cs = window._csState;
  // A-LIST: Sponsor Rush on BREAK enter (once per 20s)
  if(cs.cs_aListCard) {
    const now = performance.now();
    if(!cs._sponsorRushCooldownUntil || now >= cs._sponsorRushCooldownUntil) {
      cs._sponsorRushEndTime = now + 5000;
      cs._sponsorRushCooldownUntil = now + 20000;
    }
  }
  // GHOSTPING: reset miss count for this BREAK cycle
  if(cs.cs_ghostping) cs._ghostpingMissCount = 0;
  // FALLEN WECHAT Overloaded BREAK: extend window by 0.6s (matches description)
  if(cs.cs_fallenWechat && cs._fallenWechatBreakActive) {
    PRESSURE.breakDuration += 600;
    PRESSURE.breakEndsAt += 600;
  }
  // KILL-D01: convert Drive Tokens into temporary breakPower boost
  if(cs.cs_killD01 && cs._driveTokens > 0) {
    cs._killD01BreakPowerBonus = cs._driveTokens * 0.08;
    cs.cs_breakPower = (cs.cs_breakPower || 0) + cs._killD01BreakPowerBonus;
    cs._killD01TokensUsedCount = cs._driveTokens;
    cs._driveTokens = 0;
    // KILL-D01 VFX — tokens discharged at BREAK: laser strike + pip reset (cosmetic).
    _cardFx('discharge', { stack: 0, max: 8 });
  }
  // DETAILED: Analysis Complete — double BREAK window
  if(cs.cs_detailed && cs._analysisComplete) {
    const extra = PRESSURE.breakDuration;
    PRESSURE.breakDuration += extra;
    PRESSURE.breakEndsAt += extra;
    cs._analysisBreakActive = true;
    showBigSplash('ANALYZED BREAK', 'WINDOW x2 + PROGRESS x2', '#00ffee', false);
  }
  // LORD OF DEBT: ANALYZED state — extend break window
  if(cs.cs_lordofdeath && cs._lod_breakWinBonus) {
    PRESSURE.breakDuration += cs._lod_breakWinBonus;
    PRESSURE.breakEndsAt += cs._lod_breakWinBonus;
  }
  // MINORAGE — ORE RAGE: ใช้ Ore Crack ทั้งหมดตอนเริ่ม BREAK (ครั้งเดียวต่อ BREAK)
  if(cs.cs_minorous) {
    const _miStacks = cs.cs_minorageOreStacks || 0;
    cs._minorageBreakDmgBonus = _miStacks * 0.20; // BREAK DMG +20%/stack เฉพาะ BREAK รอบนี้
    cs.cs_minorageOreStacks = 0;
    cs.cs_minorageOreClicks = 0;
    if(_miStacks > 0) _cardFx('break'); // rock crack burst (cosmetic)
    if(_miStacks >= 3) {
      cs.cs_minorageRageRushUntil = performance.now() + 4000; // RAGE RUSH 4 วิ
      _cardFx('rage'); // rage pulse + sparks (cosmetic)
      showBigSplash('RAGE RUSH', 'COMBO +2 • CRIT +25% • DMG +25%', '#ff3322', false);
    }
  }
}

function csOnBreakEnd() {
  if(!window._csState) return;
  const cs = window._csState;
  // MINORAGE — ORE RAGE: เคลียร์โบนัส BREAK DMG เมื่อ BREAK จบ (ใช้ได้เฉพาะหน้าต่าง BREAK)
  if(cs.cs_minorous) cs._minorageBreakDmgBonus = 0;
  // DETAILED: reset Analysis stacks after BREAK ends
  if(cs.cs_detailed) {
    cs._analysisStacks = 0;
    cs._analysisComplete = false;
    cs._analysisBreakActive = false;
    _cardFx('analysisreset'); // analysis-stack expire flourish on BREAK end (cosmetic)
    // DETAILED aftermath: scan dissolves → aura/world tier back to idle (cosmetic)
    try { if(window.CardVFX && activeCard && activeCard.id === 'dtl') window.CardVFX.setAuraTier('dtl', 0); } catch(e){}
  }
  // FALLEN WECHAT: reset break-active flag, clear OD bar
  if(cs.cs_fallenWechat && cs._fallenWechatBreakActive) {
    cs._fallenWechatBreakActive = false;
    if(_el && _el.godFill) _el.godFill.style.width = '0%';
    if(typeof godLevel !== 'undefined') { godLevel = 0; canEnterGod = true; }
  }
  // KILL-D01: remove temporary breakPower boost after BREAK resolves
  if(cs.cs_killD01 && cs._killD01BreakPowerBonus) {
    cs.cs_breakPower = Math.max(0, (cs.cs_breakPower || 0) - cs._killD01BreakPowerBonus);
    cs._killD01BreakPowerBonus = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BAPHOBET — "SOUL CONTRACT": chain-scaled Blood Money + cinematic 💀 DEVIL TAX
//   • Money scales off the AK47 chain (_baphChain) — see triggerBombExplosion.
//   • DEVIL TAX pity scales off Blood Money owed (_unpaidBlood) — decoupled, so
//     a long clean chain is never punished; only being rich draws the Devil.
//   • The tax is a ≤0.45s cinematic theft that NEVER pauses gameplay: AK47,
//     weak points, boss and damage all keep running under a cosmetic overlay.
//   • Reuses: demonContract VFX (CardVFX), the coin-popup DOM, the SFX pool,
//     cameraClaim/shake, showBigSplash — no new render loop, no duplicate pools.
// ═══════════════════════════════════════════════════════════════════════════
const BAPH_CHAIN_BASE   = 4;       // BLOOD MONEY base multiplier (chain 0)
const BAPH_CHAIN_STEP   = 1.5;     // +mult per uninterrupted AK47 BOMB
const BAPH_BOMB_CAP     = 30000;   // per-BOMB Zeny ceiling (anti-runaway)
const BAPH_TAX_GOAL_BASE= 80000;   // Blood-money-owed pity goal (run-depth scaled)
const BAPH_TAX_GOAL_KO  = 4000;
const BAPH_TAX_MIN      = 0.40;    // Devil's share floor
const BAPH_TAX_MAX      = 0.60;    // Devil's share ceiling
// Cosmetic only — never affect tax amount / pity / chain. No back-to-back repeat.
const BAPH_PERSONAS = [
  { tone:'collector', weight:30, line:'ถึงเวลาเก็บส่วนแบ่งของข้า', pull:'slow',    shake:0.85 },
  { tone:'greedy',    weight:22, line:'ทั้งหมดนั่นแหละ ของข้า',   pull:'fast',    shake:1.30 },
  { tone:'gentleman', weight:18, line:'ขอบคุณที่อุดหนุน',         pull:'medium',  shake:0.90 },
  { tone:'patient',   weight:18, line:'เจ้าก็รู้ว่าวันนี้ต้องมาถึง', pull:'delayed', shake:1.05 },
  { tone:'matured',   weight:12, line:'สัญญาครบกำหนดแล้ว',        pull:'medium',  shake:1.00 },
];
const BAPH_WHISPERS = {
  low:  ['เพลิดเพลินกับความมั่งคั่งเถอะ…','สัญญายังไม่ได้ชำระ'],
  mid:  ['ปีศาจกำลังจับตาดู…','หนี้ของเจ้ากำลังโต…'],
  high: ['ยังก่อน…','ใกล้แล้ว…'],
};
let _baphLastPersona = null;
let _baphTaxActive   = false;
const _baphCoinPool  = []; // reusable "stolen coin" sprite nodes

function _baphReduced() {
  try { if(typeof gameSettings === 'object' && gameSettings && gameSettings.flashEffect === 'off') return true; } catch(e){}
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){ return false; }
}
function _baphPickPersona() {
  const pool = BAPH_PERSONAS.filter(p => p.tone !== _baphLastPersona);
  let tot = 0; for(const p of pool) tot += p.weight;
  let r = Math.random() * tot;
  for(const p of pool) { r -= p.weight; if(r <= 0) { _baphLastPersona = p.tone; return p; } }
  _baphLastPersona = pool[0].tone; return pool[0];
}
// Cosmetic dread whispers — escalate with Blood Money owed (the real tax driver).
function _baphometWhisper(bloodNorm) {
  if(!gameRunning || gamePaused || _baphReduced()) return;
  const now = performance.now();
  if(now < (window._baphWhisperUntil || 0)) return;
  if(Math.random() >= 0.12) return;
  window._baphWhisperUntil = now + 4000;
  const tier = bloodNorm > 0.66 ? 'high' : bloodNorm > 0.33 ? 'mid' : 'low';
  const pool = BAPH_WHISPERS[tier];
  const txt  = pool[Math.floor(Math.random() * pool.length)];
  try {
    const root = document.getElementById('gameRoot'); if(!root) return;
    let el = document.getElementById('baphWhisper');
    if(!el) {
      el = document.createElement('div');
      el.id = 'baphWhisper';
      el.className = 'baph-whisper';
      root.appendChild(el);
    }
    el.textContent = txt;
    el.style.opacity = '0';
    el.style.transition = 'none';
    void el.offsetWidth;
    el.style.transition = 'opacity .55s ease';
    requestAnimationFrame(() => { el.style.opacity = '0.82'; });
    setTimeout(() => { el.style.opacity = '0'; }, 1500);
  } catch(e){}
}
// Make/reuse a small stolen-coin sprite at a fixed screen position.
function _baphMakeCoin(x, y) {
  const el = _baphCoinPool.pop() || document.createElement('div');
  el.className = 'baph-stolen-coin';
  el.style.cssText = 'position:fixed;left:0;top:0;transform:translate(' + x + 'px,' + y + 'px);opacity:1;transition:none;';
  document.getElementById('gameRoot').appendChild(el);
  return el;
}
// Fly any money node toward the Devil (cx,cy); compositor-only transform/opacity.
function _baphFlyCoin(el, cx, cy, dur, pooled) {
  let ox = 0, oy = 0;
  try { const r = el.getBoundingClientRect(); ox = r.left + r.width/2; oy = r.top + r.height/2; } catch(e){}
  const dx = cx - ox, dy = cy - oy;
  requestAnimationFrame(() => {
    el.style.transition = 'transform ' + dur + 'ms cubic-bezier(.45,0,.85,.55), opacity ' + dur + 'ms ease-in';
    if(pooled) el.style.transform = 'translate(' + cx + 'px,' + cy + 'px) scale(.25)';
    else       el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.3)';
    el.style.opacity = '0';
  });
  setTimeout(() => {
    try {
      if(pooled) {
        el.style.cssText = ''; el.className = '';
        if(el.parentNode) el.parentNode.removeChild(el);
        if(_baphCoinPool.length < 10) _baphCoinPool.push(el);
      }
    } catch(e){}
  }, dur + 40);
}
// Vacuum the visible money into the Devil — reuse real coin-popups first; only
// top up with a tiny number of stolen-coin sprites if the screen is near-empty.
function _baphCoinVacuum(cx, cy, dur) {
  try {
    const root = document.getElementById('gameRoot'); if(!root) return;
    const coins = Array.from(root.querySelectorAll('.coin-popup'));
    for(const c of coins) _baphFlyCoin(c, cx, cy, dur, false);
    const TARGET = _baphReduced() ? 3 : 7;
    for(let i = coins.length; i < TARGET; i++) {
      const sx = vvW() * (0.12 + Math.random() * 0.76);
      const sy = vvH() * (0.18 + Math.random() * 0.5);
      _baphFlyCoin(_baphMakeCoin(sx, sy), cx, cy, dur, true);
    }
  } catch(e){}
}
// 💀 DEVIL TAX — the cinematic theft. Snapshot now, deduct on impact, never pause.
function _baphometDevilTax() {
  if(_baphTaxActive) return;
  const cs = window._csState;
  if(!cs || !cs.cs_baphomet || !gameRunning) return;
  const startBank = Math.max(0, roundCoins);
  const taxPct = BAPH_TAX_MIN + Math.random() * (BAPH_TAX_MAX - BAPH_TAX_MIN);
  const tax = Math.round(startBank * taxPct);
  if(tax <= 0) { cs._unpaidBlood = 0; return; }
  _baphTaxActive = true;
  const persona = _baphPickPersona();
  const reduced = _baphReduced();
  // per-event variation (within persona) so no two taxes feel copy-pasted
  const durBase = persona.pull === 'fast' ? 280 : persona.pull === 'slow' ? 440 : persona.pull === 'delayed' ? 420 : 350;
  const dur   = Math.round(Math.max(250, Math.min(450, durBase + (Math.random()*40 - 20))));
  const delay = persona.pull === 'delayed' ? Math.round(90 + Math.random()*70) : Math.round(Math.random()*40);
  const cx = vvW() / 2, cy = vvH() * 0.42;

  // dark contract veil (one reusable node) — cosmetic, pointer-events:none
  let veil = null;
  try {
    const root = document.getElementById('gameRoot');
    if(root && !reduced) {
      veil = document.getElementById('baphTaxVeil');
      if(!veil) { veil = document.createElement('div'); veil.id = 'baphTaxVeil'; veil.className = 'baph-tax-veil'; root.appendChild(veil); }
      veil.style.transition = 'none'; veil.style.opacity = '0'; void veil.offsetWidth;
      veil.style.transition = 'opacity .12s ease'; veil.style.opacity = '1';
    }
  } catch(e){}
  // the Devil's slam: shake (scaled per persona, honor reduced) + boom camera
  try {
    if(typeof cameraClaim === 'function') cameraClaim(3, dur + 160);
    if(!reduced) {
      const gr = document.getElementById('gameRoot');
      if(gr) { gr.classList.remove('shake'); void gr.offsetWidth; gr.classList.add('shake'); setTimeout(() => gr.classList.remove('shake'), dur + 120); }
    }
  } catch(e){}

  setTimeout(() => {
    // devil burst at center — reuse demonContract canvas primitives (cosmetic)
    try { if(window.CardVFX) window.CardVFX.trigger('bh', 'sinmax', { x: cx, y: cy }); } catch(e){}
    // persona "voice"/slam — reuse the existing SFX pool (guaranteed assets)
    try { if(typeof _playSfx === 'function') _playSfx('wk' + (1 + Math.floor(Math.random()*5)), Math.min(0.85, 0.5 * persona.shake), true); } catch(e){}
    // physically vacuum the money toward the Devil
    _baphCoinVacuum(cx, cy, dur);
    // HUD count-down in sync with the vacuum (display only; bank untouched yet)
    const t0 = performance.now();
    (function drain() {
      if(!gameRunning) { window._baphTaxDrain = null; _baphTaxActive = false; return; }
      const k = Math.min(1, (performance.now() - t0) / dur);
      window._baphTaxDrain = Math.round(startBank - tax * k);
      if(k < 1) { requestAnimationFrame(drain); return; }
      // IMPACT — coins reach the Devil: the money actually leaves the bank now.
      roundCoins = Math.max(0, roundCoins - tax);
      cs._unpaidBlood = 0;
      window._baphTaxDrain = null;
      showBigSplash('💀 DEVIL TAX', persona.line + '  −' + tax + ' ZENY', '#cc0011', true);
      try { if(window.CardVFX) window.CardVFX.trigger('bh', 'break', { x: cx, y: cy }); } catch(e){}
      try { if(veil) { veil.style.transition = 'opacity .18s ease'; veil.style.opacity = '0'; } } catch(e){}
      _baphTaxActive = false;
    })();
  }, delay);
}

function csOnBreakSuccess() {
  if(!window._csState || !gameRunning) return;
  const cs = window._csState;
  _cardFx('break'); // Elite/Mythic VFX: เอฟเฟกต์ตอน BREAK สำเร็จ (cosmetic)
  // GLOOM UNDER SIDE: bonus coins on BREAK success proportional to stacks (+1.5% of roundCoins per stack)
  if(cs.cs_gloomUnderSide && cs._gloomStacks) {
    const bonus = Math.max(1, Math.round(roundCoins * cs._gloomStacks * 0.02));
    roundCoins += bonus;
    spawnCoinPopup(bonus);
  }
  // DARK STAKE LORD: escalating jackpot system
  if(cs.cs_darkStakeLord) {
    if(!cs._jackpotChance) cs._jackpotChance = 0.15;
    if(Math.random() < cs._jackpotChance) {
      // Jackpot: Zeny ×2.5 (roundCoins becomes 2.5× its current value)
      const before = Math.max(0, roundCoins);
      const bonus = Math.max(30, Math.round(before * 1.5)); // adds 1.5× so total = 2.5× original
      roundCoins += bonus;
      spawnCoinPopup(bonus);
      cs._darkStakeOcaBoostNextBreak = true;
      showBigSplash('JACKPOT!', '×2.5 ZENY — OCA ×10 (' + Math.round(cs._jackpotChance * 100) + '%)', '#ffcc00', false);
      _cardFx('jackpot'); // DARK STAKE LORD — 777 flash + cursed coins → zeny reacts (cosmetic)
      cs._jackpotChance = 0.15; // reset odds
    } else {
      // No jackpot: increase odds for next time (max 75%)
      cs._jackpotChance = Math.min(0.75, cs._jackpotChance + 0.10);
      _cardFx('stakeup'); // DARK STAKE LORD — risk-reward red warning flicker (odds rising, cosmetic)
    }
  }
  // XENORC: reset OD stack count after BREAK (prevents infinite cross-run accumulation)
  if(cs.cs_zenorc && cs.cs_zenorcResetOnBreak) {
    cs._zenorcCount = 0;
    cs.cs_zenorc_active = 0;
  }
  // HYDRA: consume 3 heads on BREAK for Hydra Burst
  if(cs.cs_hydra && (cs._hydraHeads || 0) >= 3) {
    cs._hydraHeads = 0;
    cs._hydraBurstEndTime = performance.now() + 4000;
    const hydraBonus = 500;
    score += hydraBonus;
    _cardFx('burst'); // HYDRA BURST payoff + head-pip reset (cosmetic)
    showBigSplash('HYDRA BURST', 'BREAK EXPLOSION + AK47 FAST 4s', '#44ff88', false);
  }
  // MAYA PROBLEM: 5s boss dmg window, once per boss
  if(cs.cs_mayaProblem && isBoss) {
    cs._mayaBreakEndTime = performance.now() + 6000;
    cs._mayaCritEndTime = performance.now() + 6000;
  }
  if(cs.cs_whizperGhostProtocol) {
    const _nowGhost = performance.now();
    if(_nowGhost >= (cs._whizperGhostCdUntil || 0)) {
      cs._whizperGhostCdUntil = _nowGhost + 10000;
      cs._whizperGhostEndTime = _nowGhost + 4000;
      cs._whizperComboPauseUntil = _nowGhost + 1200;
      if(!cs.cs_goldenbug && !cs.cs_rsx0806) {
        const cur = parseFloat(_el.godFill.style.width) || 0;
        _el.godFill.style.width = Math.min(100, cur + 6) + '%';
        if(parseFloat(_el.godFill.style.width) >= 100 && canEnterGod && godLevel === 0) activateGodLevel(1);
      }
    }
  }
  // WEEBVIL DUDE: unlock awakening on first BREAK, grant post-BREAK windows
  if(cs.cs_weebvilDude) {
    if(!cs._weebvilAwakened) { cs._weebvilAwakened = true; cs.cs_critDmgBonus = (cs.cs_critDmgBonus||0) + 0.25; }
    cs._weebvilBreakBurstEndTime = performance.now() + 5000;
    cs._weebvilOdGainEndTime = performance.now() + 4000;
  }
  if(cs.cs_freeoni) {
    // FIX: Added 3s cooldown between FREE MODE activations to prevent OD/BREAK chain loop
    const _freeModeCdClear = !cs._freeModeCooldownUntil || performance.now() >= cs._freeModeCooldownUntil;
    if(_freeModeCdClear) {
      cs._freeModeEndTime = performance.now() + 5000;
      cs._freeModeCooldownUntil = performance.now() + 3000; // 3s CD between activations
      // FREEONI: BREAK → Combo -12
      combo = Math.max(1, combo - 12);
      if(typeof updateComboUI === 'function') updateComboUI();
    }
  }
  // ATROSUS: Resonance window (6s base, 10s with Mastery); track count toward Mastery
  if(cs.cs_atrosusBreak) {
    const resDur = cs._atrosusResonanceMastery ? 10000 : 6000;
    cs._atrosusBreakEndTime = performance.now() + resDur;
    cs._atrosusResonanceExtension = 0;
    cs._atrosusResonanceCount = (cs._atrosusResonanceCount || 0) + 1;
    if(cs._atrosusResonanceCount >= 3) cs._atrosusResonanceMastery = true;
    showBigSplash('RESONANCE', cs._atrosusResonanceMastery ? 'MASTERY x2 — ' + resDur/1000 + 's' : 'DMG x1.6 — 6s', '#cc88ff', false);
  }
  // TAO FUNKA: FUNK FEVER (5s, CD 10s)
  if(cs.cs_taoFunka) {
    const now = performance.now();
    if(!cs._taoFunkCdUntil || now >= cs._taoFunkCdUntil) {
      cs._taoFunkFeverEndTime = now + 5000;
      cs._taoFunkCdUntil = now + 10000;
    }
  }
  // BAPHOBET — SOUL CONTRACT: BREAK feeds the frenzy (instant AK47 burst, anti-loop guarded)
  if(cs.cs_baphomet) {
    const _nowB = performance.now();
    const _spawnOne = () => {
      if(!gameRunning || gamePaused) return;
      cs._baphometSpawnChainLock = true;
      try {
        clearTimeout(wpTimeout);
        clearTimeout(wpSchedule);
        wpActive = false;
        $('weakPoint').style.display='none';
        showWeakPoint();
      } finally {
        cs._baphometSpawnChainLock = false;
      }
    };
    // SOUL CONTRACT: BREAK fuels the frenzy — burst-spawn AK47 weak points (no cooldown).
    // (anti-loop gate only on the burst itself; the per-WP no-cooldown respawn lives elsewhere)
    if(!cs._baphometAk47CdUntil || _nowB >= cs._baphometAk47CdUntil) {
      cs._baphometAk47CdUntil = _nowB + 1500;
      _spawnOne(); setTimeout(_spawnOne, 90); setTimeout(_spawnOne, 180);
    }
  }
  // THANABROS: OD fills instantly + start Thanatos Phase 5s
  if(cs.cs_thanatos) {
    if(_el && _el.godFill) _el.godFill.style.width = '100%';
    if(canEnterGod && godLevel === 0) activateGodLevel(1);
    cs._thanatosPhaseEndTime = performance.now() + 5000;
    _cardFx('thanatos'); // THANABROS — time-stop OD aura
    showBigSplash('THANATOS PHASE', 'DMG x2 — 5s', '#cc0000', false);
  }
  // NOSIRIS: Soul Stack accumulation → Judgment at 5 stacks
  if(cs.cs_osiris) {
    cs._osirisStacks = Math.min(5, (cs._osirisStacks || 0) + 1);
    const stackBonus = cs._osirisStacks * 25;
    if(stackBonus > 0) { roundCoins += stackBonus; spawnCoinPopup(stackBonus); }
    // NOSIRIS soul-stack pip + aura/world tier escalation from real stack (cosmetic)
    _cardFx('soulstack', { stack: cs._osirisStacks, max: 5, tier: Math.min(3, Math.ceil(cs._osirisStacks * 3 / 5)) });
    if(cs._osirisStacks >= 5) {
      cs._osirisJudgmentEndTime = performance.now() + 8000;
      cs._osirisStacks = 0;
      _cardFx('judgment', { tier: 0 }); // JUDGMENT peak + soul-stack expire + aura decay (cosmetic)
      showBigSplash('JUDGMENT', 'DMG x2 + ZENY x2 — 8s', '#cc88ff', true);
    }
  }
  // IFRIED: Inferno Burst at 10+ stacks
  if(cs.cs_ifriedBreak && (cs._ifriedStacks || 0) >= 10) {
    cs._ifriedBurstEndTime = performance.now() + 5000;
    cs._ifriedStacks = 0;
    cs._ifriedReadyFired = false;
    _cardFx('inferno'); // IFRIED — Inferno Burst payoff (cosmetic)
    // IFRIED lifecycle VFX — Decay → Idle: ปะทุแล้ว stack รีเซ็ต → วงแหวนหาย + ออร่าสงบ (cosmetic).
    try {
      if(window.CardVFX && activeCard && activeCard.id === 'if') {
        window.CardVFX.setAuraTier('if', 0);
        window.CardVFX.clearCharge();
      }
    } catch(e){}
    showBigSplash('INFERNO BURST', 'DMG x2.5 + CRIT +25% — 5s', '#ff4400', false);
  }
  // RSICK-0806: Execute Stack + Execution Phase
  if(cs.cs_rsx0806) {
    cs._rsxBreakBonus = Math.min(0.60, (cs._rsxBreakBonus || 0) + 0.12);
    cs._rsxExecutionEndTime = performance.now() + 8000;
    showBigSplash('EXECUTION PROTOCOL', 'DMG x1.5 — 8s (+' + Math.round((cs._rsxBreakBonus)*100) + '% total)', '#ff2233', false);
  }
  // KILL-D01: coin reward per token consumed + Execution bonus at max tokens
  if(cs.cs_killD01 && cs._killD01TokensUsedCount > 0) {
    const tokenCoin = cs._killD01TokensUsedCount * 30;
    roundCoins += tokenCoin;
    spawnCoinPopup(tokenCoin);
    if(cs._killD01TokensUsedCount >= 8) {
      cs._killD01ExecutionEndTime = performance.now() + 4000;
      // KILL-D01 VFX — Layer-3 peak: DRIVE DISCHARGE laser cannon (cosmetic).
      _cardFx('drivedischarge');
      showBigSplash('DRIVE DISCHARGE', 'DMG x1.5 — 4s', '#00ffee', false);
    }
    cs._killD01TokensUsedCount = 0;
  }
  // DETAILED: Critical Analysis reward for Analyzed BREAK success
  if(cs.cs_detailed && cs._analysisBreakActive) {
    cs._analysisCritEndTime = performance.now() + 10000;
    cs._analysisBreakActive = false;
    cs._analysisComplete = false;
    showBigSplash('CRITICAL ANALYSIS', 'CRIT +25% — 10s', '#00ffee', false);
  }
  // BEELZEBRUH: Corruption Discharge at max corruption
  // BUFF: 5s → 8s duration; adds OCA chance +50% for the same 8s window.
  // Safe refresh: if triggered again while active, replaces/extends both timers.
  // _beelzebubOcaEndTime is read in rollOcaFromBreakSuccess() to boost OCA chance.
  if(cs.cs_beelzebub && (cs._beelzebubBonus || 0) >= 0.50) {
    const _bzNow = performance.now();
    cs._beelzebubCoinEndTime = _bzNow + 8000;
    cs._beelzebubOcaEndTime  = _bzNow + 8000;
    // Clear any previous expiry timer to prevent duplicate leaks on re-trigger
    if(cs._beelzebubExpireTimer) {
      clearTimeout(cs._beelzebubExpireTimer);
      cs._beelzebubExpireTimer = null;
    }
    // Auto-expire both windows cleanly after exactly 8 seconds
    cs._beelzebubExpireTimer = setTimeout(() => {
      if(!window._csState || window._csState !== cs) return; // run already ended
      cs._beelzebubCoinEndTime = 0;
      cs._beelzebubOcaEndTime  = 0;
      cs._beelzebubExpireTimer = null;
    }, 8000);
    showBigSplash('CORRUPTION DISCHARGED', 'ZENY ×1.5 + OCA +50% — 8s', '#cc00ff', false);
  }
  // LORD OF DEBT: BREAK success clears all DEBT STACKS
  if(cs.cs_lordofdeath && _lodDebtStacks > 0) {
    const _cleared = _lodDebtStacks;
    _lodDebtStacks = 0;
    _lodUpdateStackUI();
    // LOD VFX — debt collected/voided: cursed coins siphoned away + aura intensity reset (tier 0).
    // (the seal-shatter itself fires from the generic _cardFx('break') above — cosmetic only)
    _cardFx('debtclear', { tier: 0, stacks: _cleared });
    showBigSplash('DEBT CLEARED', 'STACKS RESET', '#cc88ff', false);
  }
  // VALKYRIZZ: BREAK success triggers Elite card swap (same as AK47 complete)
  if(cs.cs_valkyrieRandgris) _csValkyrieRandgrisSwap();
}

function csOnWpMiss() {
  if(!window._csState || !gameRunning) return;
  const cs = window._csState;
  // GHOSTPING: reduce BREAK cooldown (up to 5 misses per BREAK cycle)
  if(cs.cs_ghostping && PRESSURE.phase === 'idle') {
    if(!cs._ghostpingMissCount) cs._ghostpingMissCount = 0;
    if(cs._ghostpingMissCount < 6) {
      cs._ghostpingMissCount++;
      PRESSURE.cooldown = Math.max(0, PRESSURE.cooldown - 1500);
    }
  }
  // DETAILED: lose 2 Analysis stacks on WP miss + small combo penalty
  if(cs.cs_detailed && cs._analysisStacks) {
    cs._analysisStacks = Math.max(0, cs._analysisStacks - 2);
    if(cs._analysisStacks < 8) cs._analysisComplete = false;
    // อัปเดต pip ให้ตรงค่าจริงตอนพลาด (ลดลง ไม่มี spark — คอสเมติกล้วน)
    try { if(window.CardVFX && activeCard && activeCard.id === 'dtl') { window.CardVFX.setStack('dtl', cs._analysisStacks, 8); window.CardVFX.setAuraTier('dtl', Math.min(3, Math.floor(cs._analysisStacks / 3))); } } catch(e){}
    combo = Math.max(1, combo - 3);
    if(typeof updateComboUI === 'function') updateComboUI();
  }
  // LORD OF DEBT: MASSACRE state — miss WP: combo -5
  if(cs.cs_lordofdeath && cs._lod_missCombo) {
    combo = Math.max(1, combo - 5);
    if(typeof updateComboUI === 'function') updateComboUI();
  }
  // BAPHOBET — SOUL CONTRACT: a missed weak point breaks the AK47 money chain.
  // (Blood Money scaling resets; the Devil's debt — _unpaidBlood — is untouched.)
  if(cs.cs_baphomet) cs._baphChain = 0;
}

// ── helper: on OD start ──
// ── Valkyrie Randgris: สุ่ม Elite card effect ทุกครั้งที่ AK47 ครบ ──
function _csValkyrieRandgrisSwap() {
  if(!window._csState || !gameRunning) return;
  const elitePool = CARD_POOL.filter(c =>
    c.rarity === 'elite' && !CS_VALKYRIE_EXCLUDED_IDS.has(c.id)
  );
  if(!elitePool.length) return;
  const prevHadRsx = !!window._csState.cs_rsx0806;
  const newCard = elitePool[Math.floor(Math.random()*elitePool.length)];
  const cs = { cs_valkyrieRandgris:true };
  newCard.apply(cs);
  window._csState = cs;
  _csRefreshVolatileCardEffects(window._csState);
  _csDebugLog('VALKYRIZZ swap applied', newCard.id);
  _csSyncWeakPointAvailability(prevHadRsx, true);
  _showActiveCard(newCard);
  // VALKYRIZZ VFX — Layer 3 peak: VALKYRIE SWAP grand descent (cosmetic only).
  // ยิงทั้งทาง AK47 ครบ และ BREAK สำเร็จ (ทั้งคู่เรียกฟังก์ชันนี้) → จังหวะ signature
  // ของการ์ดมี VFX จริงทุกครั้ง (เดิม AK47-swap ไม่มี VFX การ์ดเลย). activeCard ยังเป็น vr.
  _cardFx('valkyrie');
  showBigSplash('VALKYRIE SWAP', newCard.name.replace(' CARD',''), '#cc88ff');
}

function csOnOdStart() {
  if(!window._csState) return;
  const cs = window._csState;
  _cardFx('od'); // Elite/Mythic VFX: เอฟเฟกต์ตอนเข้า OVERDRIVE (cosmetic)
  _csOdUseCount++;
  // track peak OD level reached this OD session (godLevel is set before csOnOdStart is called)
  cs._currentOdPeakLevel = Math.max(cs._currentOdPeakLevel || 0, godLevel);
  cs._mistressOdTimeGain = 0;
  cs._odTimerClickGain = 0;
  cs._stormyOdTimeGain = 0;
  cs._stormChargeClicks = 0;
  if(cs.cs_stormyKnight) cs._stormChargeEndTime = performance.now() + 6000;
  // ZENORC: count OD uses for damage stack (max 3 → +18% after nerf from +24%)
  if(cs.cs_zenorc) {
    if(!cs._zenorcCount) cs._zenorcCount = 0;
    if(cs._zenorcCount < 3) cs._zenorcCount++;
  }
  // LADY TRAINEE: +2% dmg stack per OD Level Up (max +30%)
  if(cs.cs_ladyTrainee && (cs._ladyTraineeDmg || 0) < 0.60) {
    cs._ladyTraineeDmg = Math.min(0.60, (cs._ladyTraineeDmg || 0) + 0.04);
    // Track discrete stacks (max 15 total, Spotlight at 10)
    cs._ladyTraineeStacks = (cs._ladyTraineeStacks || 0) + 1;
    _cardFx('odlevel', { charge: cs._ladyTraineeStacks, chargeMax: 15 }); // compact charge ring (cosmetic)
    if(cs._ladyTraineeStacks >= 10 && !cs._ladyTraineeSpotlight) {
      cs._ladyTraineeSpotlight = true;
      _cardFx('spotlight'); // SPOTLIGHT MODE stage-light (cosmetic)
      showBigSplash('SPOTLIGHT MODE', 'OD CHARGE +10%/CLICK', '#ff88ff', false);
    }
  }
}


// csOnOdEnd defined after csOnKO above

// ── helper: on WP hit ──
function csOnWpHit(x, y) {
  if(!window._csState || !gameRunning) return;
  const cs = window._csState;
  // Phreeoni: if OD active → OD timer +1s; else charge +20%
  if(cs.cs_freeoni) {
    if(godLevel > 0) {
      cs._freeoniOdDmgStack = Math.min(0.40, (cs._freeoniOdDmgStack || 0) + 0.04);
      godSecondsLeft += 0.20;
    } else {
      const bar = _el.godFill;
      const cur = parseFloat(bar.style.width)||0;
      bar.style.width = Math.min(100, cur + 35) + '%';
    }
  } else if(cs.cs_wpOdCharge) {
    if(godLevel > 0) {
      godSecondsLeft += 1;
    } else {
      const bar = _el.godFill;
      const cur = parseFloat(bar.style.width)||0;
      bar.style.width = Math.min(100, cur + cs.cs_wpOdCharge*100) + '%';
      if(parseFloat(bar.style.width)>=100 && canEnterGod && !cs.cs_goldenbug) {
        activateGodLevel(1);
      }
    }
  }
  // baphomet: spawn new WP immediately
  if(cs.cs_baphomet && !cs._baphometSpawnChainLock) {
    clearTimeout(wpTimeout);
    clearTimeout(wpSchedule);
    wpActive = false;
    $('weakPoint').style.display='none';
    setTimeout(showWeakPoint, 300);
  }
  // RIZZWORD: +3% OD charge per WP collect (max 10 triggers per 8s)
  if(cs.cs_rizzword && godLevel === 0 && !cs.cs_goldenbug && !cs.cs_rsx0806) {
    const _now = performance.now();
    if(!cs._rizzwordWindowStart || _now - cs._rizzwordWindowStart >= 8000) {
      cs._rizzwordWindowStart = _now;
      cs._rizzwordCount = 0;
    }
    if(cs._rizzwordCount < 10) {
      cs._rizzwordCount++;
      const _bar = _el.godFill;
      const _cur = parseFloat(_bar.style.width) || 0;
      _bar.style.width = Math.min(100, _cur + 3) + '%';
      if(parseFloat(_bar.style.width) >= 100 && canEnterGod) activateGodLevel(1);
    }
  }
  // DETAILED: increment Analysis stacks on WP collect (max 8); at 8 mark Analysis Complete
  if(cs.cs_detailed) {
    cs._analysisStacks = Math.min(8, (cs._analysisStacks || 0) + 1);
    // DETAILED analysis-stack pip + aura/world scan layers grow per real stack (cosmetic)
    _cardFx('analysis', { stack: cs._analysisStacks, max: 8, tier: Math.min(3, Math.floor(cs._analysisStacks / 3)) });
    if(cs._analysisStacks >= 8 && !cs._analysisComplete) {
      cs._analysisComplete = true;
      _cardFx('analysiscomplete'); // DETAILED — ANALYSIS COMPLETE payoff (cosmetic)
      // HUD sync (cosmetic): combo (affects) pulses via trigger; also sync OD bar at full map.
      try { if(window.CardVFX && activeCard && activeCard.id === 'dtl') window.CardVFX.targetPulse('odBar', '#00ffcc', 'analysis'); } catch(e){}
      showBigSplash('ANALYSIS COMPLETE', 'Next BREAK: WINDOW x2', '#00ffee', false);
    }
  }
  // SOLDIER SKELLYTON: WP hit → crit chance +10% for 5s
  if(cs.cs_skellytonWp) cs._skellytonCritEndTime = performance.now() + 5000;
  // THANABROS: AK47 WP hit during Thanatos Phase → OD timer +1s
  if(cs.cs_thanatos && cs._thanatosPhaseEndTime && performance.now() < cs._thanatosPhaseEndTime && godLevel > 0) {
    godSecondsLeft += 1;
  }
  // DRAKE — X MARKS THE SPOT: tapped the golden treasure → DRAKE PLUNDER (big take)
  if(cs.cs_drakeTreasure && cs._drakeWpActive) drakePlunder(x, y);
  // NOTE: No OCA roll here — single weak point pickup must NOT trigger OCA.
  // OCA rolls only on: AK47 complete (all 5 WPs → onAk47Complete) and BREAK success.
}

// ══════════════════════════════════════════════════════════════
// DRAKE — "X MARKS THE SPOT" (Elite, pirate/opportunist)
// ──────────────────────────────────────────────────────────────
// ทุก DRAKE_ARM_EVERY ชุด AK47 → ติดอาวุธ "สมบัติ": จุดอ่อนถัดไปกลายเป็น
// จุดสมบัติสีทอง (หน้าต่างยาวขึ้นเล็กน้อย). แตะทัน → DRAKE PLUNDER ครั้งใหญ่
// (เบิร์สต์ดาเมจ + ปล้น Zeny ตาม Combo + OD +12%). พลาด = สมบัติหลุดมือ
// (fizzle, ไม่มีโทษเพิ่ม) ต้องสะสม AK47 ใหม่. ไม่มี passive ถาวร, ไม่ใช้ตัวนับ UI.
const DRAKE_ARM_EVERY      = 3;      // arm after every N completed AK47 chains
const DRAKE_TREASURE_TTL   = 2200;   // ms — treasure weak-point visible window
const DRAKE_PLUNDER_OD     = 12;     // % OD bar gained on a successful plunder
const DRAKE_PLUNDER_HP_BOSS   = 0.15; // plunder burst = 15% boss max HP
const DRAKE_PLUNDER_HP_NORMAL = 1.50; // plunder burst = 150% normal-enemy max HP

// Count one completed AK47 chain toward arming the treasure (called on AK47 bomb).
function drakeOnAk47Complete(){
  const cs = window._csState;
  if(!cs || !cs.cs_drakeTreasure) return;
  if(cs._drakeArmed) return; // already waiting for a treasure to be tapped
  cs._drakeAkCount = (cs._drakeAkCount || 0) + 1;
  if(cs._drakeAkCount >= DRAKE_ARM_EVERY){
    cs._drakeAkCount = 0;
    cs._drakeArmed = true; // next weak point spawns as a golden treasure
    showBigSplash('X MARKS THE SPOT', 'จุดสมบัติทองกำลังจะโผล่ — ปล้นให้ทัน!', '#ffcc33', false);
  }
}

// Resolve a successful tap on the golden treasure weak point: DRAKE PLUNDER.
function drakePlunder(x, y){
  const cs = window._csState;
  if(!cs || !cs.cs_drakeTreasure) return;
  cs._drakeWpActive = false; // consume the treasure
  // ── big plunder burst (a "take", not a full execute) ──
  const burst = isBoss
    ? Math.round(bossMaxHP * DRAKE_PLUNDER_HP_BOSS)
    : Math.round(maxHP * DRAKE_PLUNDER_HP_NORMAL);
  applyBossDamage(burst, 'drake-plunder');
  showWpHitFX(x, y - 60, burst); // offset above the normal WP number so the big take reads clearly
  // ── steal Zeny — bigger the longer you've been building combo ──
  const plunderCoins = Math.round((40 + combo * 1.5) * (1.25 + (_sc.coinMult || 0)));
  roundCoins += plunderCoins;
  spawnCoinPopup(plunderCoins);
  // ── small OD chip (skip if a card disables OD charging) ──
  if(!cs.cs_goldenbug){
    const cur = parseFloat(_el.godFill.style.width) || 0;
    _el.godFill.style.width = Math.min(100, cur + DRAKE_PLUNDER_OD) + '%';
    if(parseFloat(_el.godFill.style.width) >= 100 && canEnterGod) activateGodLevel(1);
  }
  _cardFx('drake', { x, y }); // DRAKE — golden plunder burst (cosmetic)
  showBigSplash('DRAKE PLUNDER', 'ปล้นสำเร็จ! +' + plunderCoins + ' ZENY', '#ffcc33', true);
  if(navigator.vibrate) navigator.vibrate([60, 30, 120]);
  if(isBoss){ if(bossHP <= 0){ setTimeout(()=>{ if(gameRunning && !gamePaused) bossKO(); }, 200); } }
  else { if(hp <= 0){ setTimeout(()=>{ if(gameRunning && !gamePaused) normalKO(); }, 200); } }
}

// ── helper: on time up — osiris ──
function csOnTimeUp() {
  if(!window._csState) return false;
  const cs = window._csState;
  if(cs.cs_osiris && !_csOsirisUsed && (cs._osirisStacks || 0) >= 3) {
    _csOsirisUsed = true;
    timeLeft = 15;
    showBigSplash('ปฏิเสธความตาย','NOSIRIS — +15 วิ (Soul Stack ถูกล้าง)','#cc88ff',true);
    cs._osirisStacks = 0;
    _cardFx('judgment'); // soul-stack expire flourish on death-defy clear (cosmetic)
    return true; // prevent game end
  }
  return false;
}

// ── helper: extra coins at end (hunter fly) ──
function csGetEndBonusCoins() {
  if(!window._csState) return 0;
  const cs = window._csState;
  return (cs.cs_odCoinBonus||0) * _csOdUseCount;
}

// ── reset card state ──
function csReset(clearSavedCards = false) {
  if (window.CardVFX) window.CardVFX.clearActive();
  activeCard = null;
  window._csState = null;
  _csKoTimeAcc = 0;
  _csOdUseCount = 0;
  _csOsirisUsed = false;
  _csLastCards = null;
  _csOnChosen = null;
  if(clearSavedCards) {
    save.savedCards = null;
    // FIX: Invalidate pre-run state on hard reset (retry / quit) so next open is fresh
    _preRunCardState.sessionId = '';
    _preRunCardState.offers = [];
    if (save) { save.preRunState = null; }
    doSave();
  }
  _csStopAllTimers();
}

function _csResetRuntimeState() {
  // Called implicitly when window._csState is cleared — any per-round runtime vars reset here
  // Accumulated stacks on the csState object are reset automatically since _csState is nulled.
  // This function exists for explicit mid-round resets if needed.
}

// ══════════════════════════════════════════
// CARD COLLECTION SYSTEM
// ══════════════════════════════════════════

// Default unlocked cards (5 standard cards)
const DEFAULT_UNLOCKED = ['po','lu','fa','co','pp'];

// Drop weights per tier
const CARD_DROP_WEIGHTS        = { standard:65, premium:20, elite:13, mythic:2 };
const CARD_DROP_WEIGHTS_PITY5  = { premium:70, elite:25, mythic:5 };    // x5  — premium ขึ้นไป
const CARD_DROP_WEIGHTS_PITY25 = { elite:90, mythic:10 };               // x25 — elite ขึ้นไป
const CARD_DROP_WEIGHTS_PITY50 = { mythic:100 };                        // x50 — mythic การันตี

// coin ที่ได้เมื่อได้การ์ดซ้ำ
const CARD_DUPE_COINS = { standard:100, premium:800, elite:3000, mythic:10000 };

// คำนวณ pity type จาก gamesCompleted (1-indexed หลัง +1)
function _getPityType(gamesCompleted) {
  // cycle 1-50 แล้วรีเซ็ต
  const cycle = ((gamesCompleted - 1) % 50) + 1; // 1..50
  if(cycle === 50) return 'mythic';
  if(cycle === 25) return 'elite';
  if(cycle % 5 === 0) return 'premium';
  return null; // ไม่ใช่รอบ pity
} // hard pity round 5

let _cardDrawResult = null; // การ์ดที่จะได้รับในรอบนี้
let _collectBgmPlaying = false;

function getUnlockedCards() {
  if(!save.unlockedCards) save.unlockedCards = [...DEFAULT_UNLOCKED];
  return save.unlockedCards;
}

function isCardUnlocked(id) {
  return getUnlockedCards().includes(id);
}

function unlockCard(id) {
  const uc = getUnlockedCards();
  // Note: doSave() is NOT called here — collectCard() calls doSave() right after.
  // Calling it here would cause a double-write and could trigger extra toasts.
  if(!uc.includes(id)) { uc.push(id); save.unlockedCards = uc; markSaveDirty('card_opened'); }
}

// active card state for this round
let activeCard = null;
let _csKoTimeAcc = 0;
let _csThanatosTimer = null;
let _csLodTimer = null;
let _csOdUseCount = 0;
let _csOsirisUsed = false;
let _csEddgaInterval = null;
let _csEddgaBurstInterval = null;
let _csEddgaForcedOd = false;
let _csLastCards = null;
let _csOnChosen = null;
let _csOrcBaddyTimer = null;
let _csOrcBaddyDrainInterval = null;
let _csGloomTimer = null;
let _csLodSwapTimeout = null;
// LORD OF DEBT — debt state module variables (declared here for hoisting safety)
// (actual declarations are in the LOD block above; these are fallback guards)
if(typeof _lodDebtStateTimer === 'undefined')   window._lodDebtStateTimer   = null;
if(typeof _lodContractInterval === 'undefined') window._lodContractInterval = null;

// weighted pick ใช้สำหรับ LOD pool (pool เล็ก ไม่ต้องแยก tier)
function _csWeightedPick(pool) {
  const total = pool.reduce((s,c)=>s+(CS_WEIGHTS[c.rarity]||0),0);
  let r = Math.random()*total;
  for(const c of pool){ r-=CS_WEIGHTS[c.rarity]||0; if(r<=0) return c; }
  return pool[pool.length-1];
}

// ── Card Drop Gacha ──
function rollCardDrop() {
  // gamesCompleted จะถูก +1 ใน collectCard() ดังนั้น ตรวจก่อน +1
  const nextGame = (save.gamesCompleted||0) + 1;
  const pityType = _getPityType(nextGame);

  let weights;
  if     (pityType === 'mythic')  weights = CARD_DROP_WEIGHTS_PITY50;
  else if(pityType === 'elite')   weights = CARD_DROP_WEIGHTS_PITY25;
  else if(pityType === 'premium') weights = CARD_DROP_WEIGHTS_PITY5;
  else                            weights = CARD_DROP_WEIGHTS;

  const tiers = Object.keys(weights);
  const total = tiers.reduce((s,t)=>s+weights[t],0);
  let r = Math.random()*total;
  let tier = tiers[tiers.length-1];
  for(const t of tiers){ r-=weights[t]; if(r<=0){tier=t;break;} }

  // สุ่มจากทุกการ์ดใน tier นั้น (รวมที่มีแล้ว)
  const unlocked = getUnlockedCards();
  let pool = CARD_POOL.filter(c=>c.rarity===tier);
  if(!pool.length) { pool = CARD_POOL; tier = 'standard'; }

  const card = pool[Math.floor(Math.random()*pool.length)];
  const isDupe = unlocked.includes(card.id);
  const dupeCoins = isDupe ? (CARD_DUPE_COINS[card.rarity] || 50) : 0;

  return { card, tier, isPity: !!pityType, pityType, isDupe, dupeCoins };
}

// ── Open Card Draw Screen ──
function openCardDraw(onDone) {
  window._cardDrawOnDone = onDone;
  const result = rollCardDrop();
  _cardDrawResult = result;

  const screen = $('cardDrawScreen');
  screen.style.display = 'flex';

  // pity banner
  const banner = $('cardDrawPityBanner');
  if(result && result.isPity) {
    const labels = {
      premium: 'PITY x5 — GUARANTEED PREMIUM',
      elite:   'PITY x25 — GUARANTEED ELITE',
      mythic:  'PITY x50 — GUARANTEED MYTHIC',
    };
    banner.textContent = labels[result.pityType] || 'PITY DRAW';
    banner.style.display = 'block';
    // สีตาม tier
    const colors = { premium:'#0088ff', elite:'#ffcc00', mythic:'#ff2233' };
    banner.style.color = colors[result.pityType] || '#ffd700';
    banner.style.textShadow = '0 0 20px '+(colors[result.pityType]||'#ffd700');
  } else {
    banner.textContent = '';
    banner.style.display = 'none';
  }

  // reset to the idle reveal state
  _resetCardDrawScreen();

  // stop all other BGM then play collect
  stopFightBGM(); stopBGM();
  _playCollectBGM();
}

// Plays via a plain <audio> element (like bgmSound / fightBgm1-4) instead of a
// permanently-decoded Web Audio AudioBuffer — collect.mp3 is a ~39s music loop,
// not a latency-critical SFX, so it doesn't need zero-latency BufferSource
// playback; decoding it once held ~13MB of raw PCM in memory for the rest of
// the session. warmUpAudio() already primes this element's buffering ahead of
// time via preload="auto" + load(), same lead-time strategy as prefetchFightBGM().
function _playCollectBGM() {
  _stopCollectBGM();
  if(!gameSettings.musicOn) return;
  const el = $('collectBgm');
  if(!el) return;
  try {
    el.volume = _musicGain(COLLECT_BGM_VOLUME);
    el.currentTime = 0;
    const p = el.play();
    if(p && typeof p.catch === 'function') p.catch(()=>{});
  } catch(e) { console.warn('collect BGM error', e); }
}

function _stopCollectBGM() {
  const el = $('collectBgm');
  if(el && !el.paused) { el.pause(); el.currentTime = 0; }
}

// ══════════════════════════════════════════════════════════════════════
// CARD REVEAL CONTROLLER — premium gacha reveal sequence
// State machine on #cardDrawScreen:
//   is-idle → is-charging → is-hinting → is-flipping → is-burst → is-settled
//   (idle → tap impact/suspense charge → rarity colour hint → flip →
//    rarity burst → settle). All transient FX are CSS (transform/opacity);
// JS only toggles state classes, swaps the image at the flip midpoint,
// spawns the (capped, event-based) particle field, and fires haptics.
// The reveal sequence is INDEPENDENT of the Flash Effect setting: it always
// plays the full idle → charge → hint → (fakeout) → flip → burst → settle
// sequence regardless of flashEffect (off/low/on). Flash Effect governs only
// gameplay flashes (hits/OD/boss/screen/shake), never the reward reveal.
// ══════════════════════════════════════════════════════════════════════
// Per-rarity timing + particle budget (single source of truth; timings are
// also pushed to CSS vars so animation length matches JS sequencing).
// Rarer cards charge + hint longer → more anticipation. Approx. total reveal
// (charge + hint + 2×flipHalf + burst): standard ~1.5s, premium ~1.84s,
// elite ~2.3s, mythic ~2.98s.
// `charge` = inward-pull duration (rarer = longer suspense). `chargeParticles`
// = inward "magnetized energy" motes pulled toward the card during charge
// (event-based, capped, auto-removed). `particles` = outward burst motes at
// reveal. Charge counts stay mobile-safe (one-shot DOM nodes, not loops).
const REVEAL_CFG = {
  standard: { charge:360,  hint:200, flipHalf:260, burst:420, chargeParticles:8,  particles:2,  haptic:[10],             label:'STANDARD' },
  premium:  { charge:520,  hint:280, flipHalf:260, burst:540, chargeParticles:13, particles:5,  haptic:[16],             label:'PREMIUM'  },
  elite:    { charge:760,  hint:360, flipHalf:300, burst:620, chargeParticles:19, particles:8,  haptic:[14,30,18],       label:'ELITE'    },
  mythic:   { charge:1080, hint:480, flipHalf:360, burst:780, chargeParticles:27, particles:13, haptic:[20,40,25,50,30], label:'MYTHIC'   },
};
let _revealTimers = [];
// explicit reveal state machine: idle → charging → hinting → flipping → burst
// → settled (or skipped → settled). Drives the second-tap skip dispatcher.
let _revealState = 'idle';

// TEMP (reveal regression diagnostics): a build marker the dev-only debug overlay
// reads to prove WHICH reveal code is actually running. Its mere presence means
// the suspense state machine (idle-float + charge particles + fakeout, added
// 2026-06-25) is in this bundle; a stale pre-2026-06-25 build will not define it.
// Remove together with src/debugOverlay.js once the cache/deploy issue is closed.
try { window.NOCTIS_REVEAL_BUILD = 'statemachine+fakeout (2026.06.28.14)'; } catch(_) {}

// monotonic clock helper (reveal timing must not depend on wall-clock jumps)
function _revealNow() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

// ── REVEAL TIMELINE INSTRUMENTATION (dev-only, zero-cost when off) ─────────
// Logs every reveal stage with elapsed ms from RevealStart so the full tap →
// reveal timeline can be audited in a real browser. Enable with
// `localStorage.setItem('reveal_debug','1')` (or `window.REVEAL_DEBUG = true`).
// Never runs in production (gated) and never touches gameplay/save state.
let _revealT0 = 0;            // RevealStart timestamp (perf clock)
let _revealStartedAt = 0;     // same anchor, used by the skip-duration floor
const _REVEAL_DEBUG = (() => {
  try {
    if(typeof window !== 'undefined' && window.REVEAL_DEBUG) return true;
    if(typeof localStorage !== 'undefined' && localStorage.getItem('reveal_debug') === '1') return true;
  } catch(e) {}
  return false;
})();
function _revealMark(stage, extra) {
  let on = _REVEAL_DEBUG;
  try { if(!on && typeof window !== 'undefined' && window.REVEAL_DEBUG) on = true; } catch(e) {}
  if(!on) return;
  const el = (_revealNow() - _revealT0);
  try { console.log('[reveal] +' + el.toFixed(0).padStart(4, ' ') + 'ms ' + stage + (extra ? '  ' + extra : '')); } catch(e) {}
}

// ── MINIMUM SKIP / REVEAL DURATION FLOOR ──────────────────────────────────
// The double-tap skip must NEVER collapse the reveal to "instant". Any skip
// event (a genuine impatient second tap, or a synthesized/ghost event the
// click/mousedown guard below doesn't recognise) that lands before this floor
// is rejected — the reveal keeps playing. This is the spec floor: skip may
// bypass only AFTER 300ms; no code path may reveal the card in <300ms.
const MIN_SKIP_MS = 300;

// ══════════════════════════════════════════════════════════════════════
// MULTI-PATTERN FAKEOUT REVEAL — cosmetic-only presentation layer
// ──────────────────────────────────────────────────────────────────────
// Rarely, an Elite/Mythic pull is *presented* as a lower rarity first, then
// transforms into its true rarity. To stop players memorizing the sequence,
// each fakeout randomly picks ONE pattern from a per-rarity pool (4 Elite /
// 6 Mythic + a rare Jackpot). This is PURELY presentation: the gacha already
// rolled the real card in rollCardDrop() BEFORE the reveal, and
// `_cardDrawResult` (true rarity + card) is NEVER read for the outcome nor
// mutated here. The fake rarity is only ever a CSS palette class + teaser
// label during the early phases — it never enters the collection, plays no
// reward/dupe sounds, never saves. Skip (2nd tap / COLLECT) jumps straight to
// the true result via the shared _finalizeReveal() path. The fakeout is part
// of the reward reveal and is NOT gated by the Flash Effect setting.
//   Elite  → appears STANDARD, then bursts into ELITE   (15–20% of Elites)
//   Mythic → appears PREMIUM,  then bursts into MYTHIC   (25–35% of Mythics)
const FAKEOUT_CHANCE    = { elite: 0.17, mythic: 0.30 }; // within 15–20% / 25–35%
const FAKEOUT_FAKE_TIER = { elite: 'standard', mythic: 'premium' };
const ELITE_FAKEOUT_PATTERNS  = ['delayedUpgrade','frameCrack','particleReverse','colorCorruption'];
const MYTHIC_FAKEOUT_PATTERNS = ['heartbeatPause','shadowReveal','doubleUpgrade','eclipseReveal','wrongColor','blackoutReveal'];
// rarer mythic sub-rolls, taken as a fraction OF the mythic fakeouts that fire:
const MYTHIC_JACKPOT_CHANCE   = 0.015; // 1–2% of mythic fakeouts → MYTHIC JACKPOT REVEAL
const MYTHIC_SPECIAL_CHANCE   = 0.08;  // 5–10% of mythic fakeouts → "special" dramatic patterns
const MYTHIC_SPECIAL_PATTERNS = ['blackoutReveal','eclipseReveal'];
// every transient twist class (cleared on finalize/reset so no stale state leaks)
const FAKEOUT_TWIST_CLASSES = ['fk-delayedUpgrade','fk-frameCrack','fk-particleReverse','fk-colorCorruption',
  'fk-heartbeatPause','fk-shadowReveal','fk-doubleUpgrade','fk-eclipseReveal','fk-wrongColor','fk-blackoutReveal','fk-jackpot'];
// Per-pattern pacing (ms). Total = charge+hint+frame+twist + 2·flipHalf + burst.
// Elite fakeouts land in 2.2–2.7s, Mythic in 2.5–3.2s, Jackpot strongest (~3.1s).
const FAKEOUT_TIMING = {
  delayedUpgrade:  { charge:360, hint:160, frame:300, twist:440, flipHalf:300, burst:560 }, // ~2.42s
  frameCrack:      { charge:320, hint:150, frame:240, twist:520, flipHalf:300, burst:560 }, // ~2.39s
  particleReverse: { charge:380, hint:150, frame:220, twist:480, flipHalf:300, burst:560 }, // ~2.39s
  colorCorruption: { charge:360, hint:160, frame:300, twist:420, flipHalf:300, burst:560 }, // ~2.40s
  heartbeatPause:  { charge:420, hint:200, frame:280, twist:640, flipHalf:320, burst:620 }, // ~2.80s
  shadowReveal:    { charge:420, hint:200, frame:320, twist:560, flipHalf:320, burst:640 }, // ~2.78s
  doubleUpgrade:   { charge:380, hint:180, frame:260, twist:760, flipHalf:320, burst:620 }, // ~2.84s (two swaps)
  eclipseReveal:   { charge:420, hint:200, frame:300, twist:620, flipHalf:320, burst:640 }, // ~2.82s
  wrongColor:      { charge:420, hint:200, frame:320, twist:560, flipHalf:320, burst:620 }, // ~2.76s
  blackoutReveal:  { charge:400, hint:180, frame:240, twist:720, flipHalf:320, burst:680 }, // ~2.86s
  jackpot:         { charge:440, hint:200, frame:300, twist:760, flipHalf:340, burst:720 }, // ~3.10s
};

// the active fakeout plan for the in-flight reveal (null = normal reveal)
let _revealSurprise = null;

const _fkPick = (arr) => arr[(Math.random()*arr.length)|0];

// Decide (cosmetic-only) whether this reveal fakes a lower rarity, and which
// pattern. Reads only the TRUE tier to gate eligibility; the dice rolled here
// cannot change the gacha outcome (already locked in `_cardDrawResult`).
// Exactly ONE pattern is returned per fakeout.
function _planSurprise(result) {
  if(!result || !result.tier) return null;
  const tier = result.tier;
  if(tier === 'elite') {
    if(Math.random() >= FAKEOUT_CHANCE.elite) return null;
    return { tier:'elite', fakeTier: FAKEOUT_FAKE_TIER.elite, pattern: _fkPick(ELITE_FAKEOUT_PATTERNS) };
  }
  if(tier === 'mythic') {
    if(Math.random() >= FAKEOUT_CHANCE.mythic) return null; // no fakeout this pull
    // a fakeout WILL happen — pick which pattern (sub-rolls fraction OF fakeouts)
    const r = Math.random();
    let pattern;
    if(r < MYTHIC_JACKPOT_CHANCE) pattern = 'jackpot';
    else if(r < MYTHIC_JACKPOT_CHANCE + MYTHIC_SPECIAL_CHANCE) pattern = _fkPick(MYTHIC_SPECIAL_PATTERNS);
    else pattern = _fkPick(MYTHIC_FAKEOUT_PATTERNS);
    return { tier:'mythic', fakeTier: FAKEOUT_FAKE_TIER.mythic, pattern, jackpot: pattern === 'jackpot' };
  }
  return null;
}

// Synthesised low bass "thump" for the Mythic transforms / impacts. Web Audio
// only (no new asset); honours the SFX setting. Not a reward sound — it is the
// transform impact, fired only on cosmetic twists. `strong` (jackpot) adds a
// brighter click layer for the game's biggest reveal. Part of the reward
// reveal: not gated by Flash Effect.
function _revealBassHit(strong) {
  if(typeof gameSettings === 'undefined' || !gameSettings || !gameSettings.sfxOn) return;
  try {
    const ctx = _getActx();
    if(ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(strong ? 150 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(strong ? 44 : 38, now + 0.42);
    const peak = Math.max(0.0006, (strong ? 1.0 : 0.9) * (gameSettings.sfxVolume || 1));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (strong ? 0.62 : 0.55));
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + (strong ? 0.68 : 0.6));
  } catch(e) {}
}

// Strip every transient fakeout class so a stale fake palette / overlay can
// never bleed into the final settled state (called from finalize + reset).
function _clearSurpriseClasses(screen) {
  if(!screen) return;
  screen.classList.remove('is-surprise-fake','is-surprise-transform','is-surprise-blackout');
  for(const c of FAKEOUT_TWIST_CLASSES) screen.classList.remove(c);
}

function _revealHaptic(pattern) {
  try { if(navigator.vibrate && pattern) navigator.vibrate(pattern); } catch(e) {}
}

function _clearRevealParticles() {
  const c = $('cardDrawParticles');
  if(c) c.textContent = '';
}

// Event-based, capped particle burst (auto-removes each node on animationend).
// `countOverride` lets a fakeout twist tune the spray size (still bounded).
function _spawnRevealParticles(tier, countOverride) {
  const cfg = REVEAL_CFG[tier]; if(!cfg) return;
  const c = $('cardDrawParticles'); if(!c) return;
  const n = Math.min(countOverride || cfg.particles, 18);
  const frag = document.createDocumentFragment();
  for(let i=0; i<n; i++) {
    const p = document.createElement('span');
    p.className = 'rp';
    const ang  = (Math.PI*2)*(i/n) + Math.random()*0.5;
    const dist = 60 + Math.random()*70;
    p.style.setProperty('--tx', (Math.cos(ang)*dist).toFixed(1)+'px');
    p.style.setProperty('--ty', (Math.sin(ang)*dist - 12).toFixed(1)+'px'); // slight upward bias
    p.style.setProperty('--pdur', (560 + (Math.random()*360|0))+'ms');
    p.style.setProperty('--pdelay', ((Math.random()*120|0))+'ms');
    const sz = (tier === 'mythic' ? 4 : 3) + Math.random()*3;
    p.style.width = sz.toFixed(1)+'px';
    p.style.height = sz.toFixed(1)+'px';
    p.addEventListener('animationend', () => { p.remove(); }, { once:true });
    frag.appendChild(p);
  }
  c.appendChild(frag);
}

// ── INWARD CHARGE PARTICLES ──────────────────────────────────────────────
// Rarity-coloured motes that spawn around the card zone and fly INWARD to the
// card centre ("magnetized energy"), staggered across the charge window so
// they keep streaming in. Mythic gets per-mote prismatic hues. Event-based:
// each node removes itself on animationend; transform/opacity only.
function _spawnChargeParticles(tier, countOverride) {
  const cfg = REVEAL_CFG[tier]; if(!cfg) return;
  const c = $('cardDrawParticles'); if(!c) return;
  const n = Math.min(countOverride || cfg.chargeParticles || 0, 34);
  if(!n) return;
  const chargeDur = cfg.charge;
  const frag = document.createDocumentFragment();
  for(let i=0; i<n; i++) {
    const p = document.createElement('span');
    p.className = 'rcp';
    const ang  = (Math.PI*2)*(i/n) + (Math.random()-0.5)*0.9;
    const dist = 120 + Math.random()*120; // start far out, converge to centre
    p.style.setProperty('--sx', (Math.cos(ang)*dist).toFixed(1)+'px');
    p.style.setProperty('--sy', (Math.sin(ang)*dist).toFixed(1)+'px');
    const dur = 340 + (Math.random()*240|0);
    const maxDelay = Math.max(0, chargeDur - dur);
    p.style.setProperty('--pdur', dur+'ms');
    p.style.setProperty('--pdelay', ((Math.random()*maxDelay)|0)+'ms');
    const sz = (tier === 'mythic' ? 3.5 : tier === 'elite' ? 3 : 2.5) + Math.random()*2.5;
    p.style.width = sz.toFixed(1)+'px';
    p.style.height = sz.toFixed(1)+'px';
    // mythic = prismatic / cosmic: randomise hue per mote
    if(tier === 'mythic') p.style.setProperty('--rc', 'hsl('+(Math.random()*360|0)+',92%,66%)');
    p.addEventListener('animationend', () => { p.remove(); }, { once:true });
    frag.appendChild(p);
  }
  c.appendChild(frag);
}

// ── SECOND-TAP / DOUBLE-TAP SKIP ──────────────────────────────────────────
// A tap anywhere on the reveal screen while the sequence is running jumps
// straight to the settled end-state. The skip listeners are attached one task
// AFTER the starting tap (via setTimeout 0): the tap that STARTS the reveal is
// still bubbling toward the screen, so attaching synchronously would let that
// same tap also skip. Deferring guarantees only a subsequent tap can skip,
// while keeping the card itself a valid skip target (no stopPropagation).
let _skipAttachTimer = null;
// Ghost-click guard: a TOUCH that starts the reveal also produces a synthesized
// "compatibility" mouse click a moment later. On browsers/in-app webviews that
// don't suppress it after touchstart's preventDefault() (Android WebView, LINE/
// FB/WeChat in-app browsers, …), that ghost click would hit the skip listener
// and make the STARTING tap skip its own reveal → instant reveal + no fakeout.
// We mark a short window after a touch-started reveal and swallow exactly that
// synthesized mouse event. A genuine second tap skips via `touchstart` (not a
// click), so double-tap skip is unaffected; desktop (mouse) never sets the guard.
const GHOST_CLICK_GUARD_MS = 800;
let _ghostClickGuardUntil = 0;
function _onSkipTap(e) {
  // reject the initiating touch's synthesized ghost mouse event (never a real skip)
  if(e && (e.type === 'click' || e.type === 'mousedown') &&
     (typeof performance !== 'undefined' ? performance.now() : Date.now()) < _ghostClickGuardUntil) {
    if(e.cancelable) { try { e.preventDefault(); } catch(_) {} }
    return;
  }
  if(e && e.cancelable) { try { e.preventDefault(); } catch(_) {} }
  _skipReveal();
}
function _clearSkipAttach() {
  if(_skipAttachTimer) { clearTimeout(_skipAttachTimer); _skipAttachTimer = null; }
}
function _attachSkip() {
  _clearSkipAttach();
  _skipAttachTimer = setTimeout(() => {
    _skipAttachTimer = null;
    const screen = $('cardDrawScreen');
    if(!screen) return;
    screen.addEventListener('click', _onSkipTap);
    screen.addEventListener('touchstart', _onSkipTap, { passive:false });
  }, 0);
}
function _detachSkip() {
  _clearSkipAttach();
  const screen = $('cardDrawScreen');
  if(!screen) return;
  screen.removeEventListener('click', _onSkipTap);
  screen.removeEventListener('touchstart', _onSkipTap);
}

// Force the fully-settled final state from ANY running state. Used by both the
// natural sequence end and the skip path. Clears all timers, transient
// particles, charge/flip classes, flash, then shows the final face + info +
// reward + COLLECT. Idempotent and safe to call once.
function _finalizeReveal() {
  _revealMark('FinalizeReveal');
  const screen = $('cardDrawScreen');
  const result = _cardDrawResult;
  const tier   = (result && result.tier) ? result.tier : null;
  // stop every pending step + remove transient particle nodes
  if(_revealTimers.length) { _revealTimers.forEach(clearTimeout); _revealTimers = []; }
  _clearRevealParticles();
  // drop transient state + card animation classes
  screen.classList.remove('is-idle','is-charging','is-hinting','is-flipping','is-burst');
  _clearSurpriseClasses(screen);
  _revealSurprise = null;
  const hiddenEl = $('cardDrawHidden');
  hiddenEl.classList.remove('charging','flip-out');
  hiddenEl.style.display = 'none';
  $('cardDrawFlash').classList.remove('fire');
  // force the TRUE rarity palette — strip any leftover fake reveal--* class so
  // a skipped/finished surprise can never settle on the fake colour.
  screen.classList.remove('reveal--standard','reveal--premium','reveal--elite','reveal--mythic');
  if(tier) screen.classList.add('reveal--'+tier);
  // final card face (no flip animation when skipping straight to the result)
  const img = $('cardDrawRevealedImg');
  _populateRevealedCard(result, tier);
  img.classList.remove('flip-in');
  img.style.display = 'block';
  // rarity stamp settled (faded so it never covers the art at rest)
  const label = $('cardDrawRarityLabel');
  label.classList.remove('pop');
  label.textContent = (tier && REVEAL_CFG[tier]) ? REVEAL_CFG[tier].label : '';
  label.style.opacity = '0';
  // info column + reward + button
  const revealed = $('cardDrawRevealed');
  revealed.style.display = 'flex';
  revealed.classList.remove('show'); void revealed.offsetWidth; revealed.classList.add('show');
  _showDupeBanner(result);
  $('cardDrawHint').classList.add('hidden');
  $('cardDrawCollectBtn').classList.add('visible');
  screen.classList.add('is-settled');
  _revealState = 'settled';
  _detachSkip();
}

// Second-tap handler: skip the running animation to the final result.
// Enforces the minimum-skip floor: a skip attempt before MIN_SKIP_MS has
// elapsed since RevealStart is REJECTED (the reveal keeps playing) so no input
// — genuine fast double-tap or an unrecognised synthesized event — can ever
// collapse the reveal below the floor.
function _skipReveal() {
  if(_revealState === 'idle' || _revealState === 'settled') { _detachSkip(); return; }
  _revealMark('SkipRequested', 'state=' + _revealState);
  const elapsed = _revealNow() - _revealStartedAt;
  if(elapsed < MIN_SKIP_MS) {
    // too soon — refuse the skip, keep the suspense; a later tap can still skip
    _revealMark('SkipRejected', 'elapsed=' + elapsed.toFixed(0) + 'ms < ' + MIN_SKIP_MS + 'ms');
    return;
  }
  _revealMark('SkipAccepted', 'elapsed=' + elapsed.toFixed(0) + 'ms');
  _revealState = 'skipped';
  _finalizeReveal();
}

// Full reset back to the idle state (called on every screen open)
function _resetCardDrawScreen() {
  const screen = $('cardDrawScreen');
  if(_revealTimers.length) { _revealTimers.forEach(clearTimeout); _revealTimers = []; }
  _detachSkip();
  _revealState = 'idle';
  _revealSurprise = null;
  screen.classList.remove('is-charging','is-hinting','is-flipping','is-burst','is-settled',
    'reveal--standard','reveal--premium','reveal--elite','reveal--mythic');
  _clearSurpriseClasses(screen);
  screen.classList.add('is-idle');
  screen.style.removeProperty('--charge-dur');
  screen.style.removeProperty('--hint-dur');
  screen.style.removeProperty('--flip-half');
  screen.style.removeProperty('--burst-dur');
  screen.style.removeProperty('--trans-dur');

  const hidden = $('cardDrawHidden');
  hidden.style.display = 'block';
  hidden.classList.remove('charging','flip-out');
  $('cardDrawHiddenImg').src = CARD_HIDDEN_IMG;

  const img = $('cardDrawRevealedImg');
  img.style.display = 'none';
  img.className = '';
  img.src = '';

  const revealed = $('cardDrawRevealed');
  revealed.style.display = 'none';
  revealed.classList.remove('show');
  $('cardDrawDupeBanner').style.display = 'none';

  $('cardDrawFlash').classList.remove('fire');
  const label = $('cardDrawRarityLabel');
  label.classList.remove('pop');
  label.textContent = '';
  label.style.opacity = '';
  _clearRevealParticles();

  $('cardDrawHint').classList.remove('hidden');
  $('cardDrawCollectBtn').classList.remove('visible');
}

// Reset the ability-description scroll back to the top and (re)measure whether
// the text overflows its fixed-height slot, toggling the bottom fade hint.
// Called only when a NEW card is populated — so reading a long card never
// resets the player's scroll position mid-read.
function _refreshDescScroll() {
  const scroll = $('cardDrawDescScroll');
  const wrap   = $('cardDrawDescWrap');
  if(!scroll || !wrap) return;
  scroll.scrollTop = 0;
  wrap.classList.remove('has-overflow');
  // measure after layout settles (content + flip-in width are applied first)
  requestAnimationFrame(() => {
    if(scroll.scrollHeight - scroll.clientHeight > 2) wrap.classList.add('has-overflow');
  });
}

// Populate the revealed face + info column (or COLLECTION COMPLETE state)
function _populateRevealedCard(result, tier) {
  const img = $('cardDrawRevealedImg');
  if(!result) {
    img.src = ''; img.className = '';
    $('cardDrawRevealedName').textContent = 'COLLECTION COMPLETE!';
    const tierEl = $('cardDrawRevealedTier');
    tierEl.textContent = ''; tierEl.className = '';
    $('cardDrawRevealedEffect').textContent = 'คุณมีการ์ดครบทุกใบแล้ว';
    $('cardDrawRevealedTradeoff').textContent = '';
    _refreshDescScroll();
    return;
  }
  const card = result.card;
  img.src = card.img || '';
  img.className = 'aura-'+tier; // flip-in class is added separately after this
  $('cardDrawRevealedName').textContent = card.name;
  const tierEl = $('cardDrawRevealedTier');
  tierEl.textContent = tier.toUpperCase();
  tierEl.className = 'tier-'+tier;
  $('cardDrawRevealedEffect').innerHTML = card.effect||'';
  if(result.isDupe) {
    $('cardDrawRevealedTradeoff').textContent = '';
  } else {
    $('cardDrawRevealedTradeoff').innerHTML = card.tradeoff ? 'TRADE-OFF: '+card.tradeoff : '';
  }
  _refreshDescScroll();
}

function _showDupeBanner(result) {
  const dupeBanner = $('cardDrawDupeBanner');
  if(result && result.isDupe) {
    dupeBanner.innerHTML =
      '<div class="dupe-label">DUPLICATE</div>' +
      '<div class="dupe-amount">+' + result.dupeCoins.toLocaleString() + ' ZENY</div>';
    dupeBanner.style.display = 'block';
    dupeBanner.style.animation = 'none';
    requestAnimationFrame(() => { dupeBanner.style.animation = ''; });
  } else {
    dupeBanner.style.display = 'none';
  }
}

// ── MULTI-PATTERN FAKEOUT REVEAL sequence ─────────────────────────────────
// Presents the pull as `plan.fakeTier`, then runs ONE randomly-chosen twist
// pattern before transforming into the TRUE rarity. Reuses every existing
// reveal primitive (charge motes, flash, burst particles, flip, label) — only
// the ordering + palette swaps + one extra burst per reveal are new, so it
// stays mobile-safe (no new permanent loops). `result` is read-only here; the
// real card/tier is only committed by collectCard() after COLLECT. Skip from
// ANY phase jumps straight to the true result via _finalizeReveal().
function _runSurpriseReveal(result, plan, screen) {
  const trueTier = result.tier;
  const fakeTier = plan.fakeTier;
  const pattern  = plan.pattern;
  const trueCfg  = REVEAL_CFG[trueTier] || REVEAL_CFG.standard;
  const fakeCfg  = REVEAL_CFG[fakeTier] || REVEAL_CFG.standard;
  const T        = FAKEOUT_TIMING[pattern] || FAKEOUT_TIMING.delayedUpgrade;
  const twistCls = 'fk-' + pattern;
  const hiddenEl = $('cardDrawHidden');
  const label    = $('cardDrawRarityLabel');
  const flash    = $('cardDrawFlash');

  // timing CSS vars: fake tier early, true tier for the final flip/burst
  screen.style.setProperty('--charge-dur', T.charge+'ms');
  screen.style.setProperty('--hint-dur',   T.hint+'ms');
  screen.style.setProperty('--flip-half',  T.flipHalf+'ms');
  screen.style.setProperty('--burst-dur',  T.burst+'ms');
  screen.style.setProperty('--trans-dur',  T.twist+'ms');

  // start under the FAKE rarity palette (the player "sees" a lower rarity)
  screen.classList.add('reveal--'+fakeTier);
  $('cardDrawHint').classList.add('hidden');

  // preload the TRUE card art during the fakeout so the final flip is instant
  let _imgReady = !(result.card && result.card.img);
  if(!_imgReady) {
    const pre = new Image();
    pre.onload = pre.onerror = () => { _imgReady = true; };
    pre.src = result.card.img;
  }
  const after = (ms, fn) => { _revealTimers.push(setTimeout(fn, ms)); };
  const whenReady = (fn) => {
    if(_imgReady) return fn();
    let waited = 0;
    const tick = () => {
      if(_imgReady || waited > 1200) return fn();
      waited += 60; _revealTimers.push(setTimeout(tick, 60));
    };
    tick();
  };
  const fireFlash = () => { flash.classList.remove('fire'); void flash.offsetWidth; flash.classList.add('fire'); };
  const setLabel  = (txt) => {
    label.style.opacity = ''; label.textContent = txt;
    label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop');
  };
  const dropLabel = () => { label.classList.remove('pop'); label.style.opacity = '0'; label.textContent = ''; };

  // ── PHASE A: fake charge (particleReverse sprays OUTWARD; others charge in) ──
  screen.classList.remove('is-idle');
  screen.classList.add('is-charging');
  _revealState = 'charging';
  _revealMark('ChargeStart', 'fakeout=' + pattern + ' charge=' + T.charge + 'ms');
  _attachSkip(); // skip → _finalizeReveal() jumps straight to the TRUE rarity
  hiddenEl.classList.add('charging');
  if(pattern === 'particleReverse') _spawnRevealParticles(fakeTier, 12); // motes move outward
  else _spawnChargeParticles(fakeTier);
  _revealHaptic(fakeCfg.haptic);

  // ── PHASE B: fake hint → "frame appears" (fake rarity label, card face-down) ──
  after(T.charge, () => {
    screen.classList.remove('is-charging');
    screen.classList.add('is-hinting');
    _revealState = 'hinting';
    _revealMark('ChargeComplete', 'hint=' + T.hint + 'ms');

    after(T.hint, () => {
      screen.classList.remove('is-hinting');
      screen.classList.add('is-surprise-fake');
      _revealState = 'surprise-fake';
      hiddenEl.classList.remove('charging');
      setLabel(fakeCfg.label); // tease the FAKE rarity so the pull reads lower
      _revealMark('FakeoutShown', 'fakeRarity=' + fakeCfg.label + ' hold=' + T.frame + 'ms');
      _revealHaptic([10]);
      after(T.frame, _runTwist); // ── PHASE C ──
    });
  });

  // ── PHASE C: TRANSFORM — run the chosen pattern, then reveal the TRUE card ──
  function _runTwist() {
    screen.classList.remove('is-surprise-fake');
    _revealState = 'surprise-transform';
    screen.classList.add('is-surprise-transform', twistCls);
    _revealMark('FakeoutUpgrade', 'fake=' + fakeTier + '→true=' + trueTier + ' twist=' + T.twist + 'ms');

    // doubleUpgrade: premium → ELITE → mythic (two visible upgrades, one burst)
    if(pattern === 'doubleUpgrade') {
      screen.classList.remove('reveal--'+fakeTier);
      screen.classList.add('reveal--elite');
      setLabel((REVEAL_CFG.elite && REVEAL_CFG.elite.label) || 'ELITE');
      fireFlash(); _revealHaptic([14,24,14]);
      after(T.twist*0.5, () => {
        screen.classList.remove('reveal--elite');
        screen.classList.add('reveal--'+trueTier);
        dropLabel();
        _revealBassHit(); fireFlash();
        _spawnChargeParticles(trueTier); // the single twist burst
        _revealHaptic([20,40,25]);
        after(T.twist*0.5, () => { screen.classList.remove('is-surprise-transform', twistCls); _surpriseBurstTrue(); });
      });
      return;
    }

    // every other pattern swaps fake → true here
    screen.classList.remove('reveal--'+fakeTier);
    screen.classList.add('reveal--'+trueTier);
    dropLabel();

    // "freeze / void" patterns: stop particles, dim, single impact, then explode
    if(pattern === 'heartbeatPause' || pattern === 'blackoutReveal') {
      screen.classList.add('is-surprise-blackout');
      _clearRevealParticles(); // everything stops / VFX nearly disappear
      const impactAt = pattern === 'blackoutReveal' ? T.twist*0.6 : T.twist*0.45;
      after(impactAt, () => { _revealBassHit(); _revealHaptic([0,70]); }); // heartbeat / impact pulse
      after(T.twist, () => {
        screen.classList.remove('is-surprise-blackout', 'is-surprise-transform', twistCls);
        fireFlash();
        _spawnChargeParticles(trueTier); // prismatic explosion (the one twist burst)
        _surpriseBurstTrue();
      });
      return;
    }

    // JACKPOT: rapid colour cycle + shake + audio + massive rainbow burst
    if(pattern === 'jackpot') {
      _revealBassHit(true);
      _revealHaptic([10,20,10,20,10,20]);
      after(T.twist, () => {
        screen.classList.remove('is-surprise-transform', twistCls);
        fireFlash();
        _spawnChargeParticles(trueTier, 30); // strongest reveal — bigger (bounded) burst
        _surpriseBurstTrue();
      });
      return;
    }

    // generic twist: crack/flicker/eclipse/shadow (CSS) + one inward rush burst
    if(trueTier === 'mythic') _revealBassHit();
    if(pattern !== 'colorCorruption') fireFlash(); // corruption stays a quiet flicker
    _spawnChargeParticles(trueTier); // the "1 additional burst" — reuses .rcp motes
    _revealHaptic(trueTier === 'mythic' ? [20,40,25] : [14,30,18]);
    after(T.twist, () => {
      screen.classList.remove('is-surprise-transform', twistCls);
      _surpriseBurstTrue();
    });
  }

  // ── PHASE D: TRUE flip + burst (identical end-state to a normal reveal) ──
  function _surpriseBurstTrue() {
    screen.classList.add('is-flipping');
    _revealState = 'flipping';
    _revealMark('RevealFlip', 'flipHalf=' + T.flipHalf + 'ms');
    hiddenEl.classList.add('flip-out');
    after(T.flipHalf, () => whenReady(() => {
      hiddenEl.style.display = 'none';
      const img = $('cardDrawRevealedImg');
      fireFlash();
      _populateRevealedCard(result, trueTier);
      img.style.display = 'block';
      img.classList.remove('flip-in'); void img.offsetWidth; img.classList.add('flip-in');

      after(T.flipHalf, () => {
        screen.classList.remove('is-flipping');
        screen.classList.add('is-burst');
        _revealState = 'burst';
        _revealMark('RevealComplete', 'trueRarity=' + trueCfg.label + ' burst=' + T.burst + 'ms');
        setLabel(trueCfg.label);
        _spawnRevealParticles(trueTier);
        _revealHaptic([trueTier === 'mythic' ? 40 : 28]);
        const revealed = $('cardDrawRevealed');
        revealed.style.display = 'flex';
        revealed.classList.remove('show'); void revealed.offsetWidth; revealed.classList.add('show');

        after(T.burst, () => {
          screen.classList.remove('is-burst');
          screen.classList.add('is-settled');
          _revealState = 'settled';
          _detachSkip();
          label.classList.remove('pop'); label.style.opacity = '0';
          _showDupeBanner(result);
          $('cardDrawCollectBtn').classList.add('visible');
          _revealMark('Settled');
        });
      });
    }));
  }
}

function revealCard(e) {
  const screen = $('cardDrawScreen');
  // only the idle → charging transition starts here; any later tap is routed
  // to the skip handler (_onSkipTap), so this guard just blocks restarts.
  if(_revealState !== 'idle') return;

  // anchor the reveal clock: drives the dev timeline log AND the minimum-skip
  // floor (no skip may resolve before MIN_SKIP_MS after this instant).
  _revealStartedAt = _revealT0 = _revealNow();
  _revealMark('RevealStart', e ? 'via=' + e.type : 'via=programmatic');

  // touch-started reveal: arm the ghost-click guard so the synthesized mouse
  // click from THIS tap can't immediately skip the reveal it just started.
  if(e && e.type === 'touchstart') {
    _ghostClickGuardUntil = _revealNow() + GHOST_CLICK_GUARD_MS;
  }

  const result = _cardDrawResult;
  const tier   = (result && result.tier) ? result.tier : null;
  const cfg    = (tier && REVEAL_CFG[tier]) ? REVEAL_CFG[tier] : REVEAL_CFG.standard;
  const hiddenEl = $('cardDrawHidden');

  // ── MULTI-PATTERN FAKEOUT REVEAL (cosmetic-only) ──
  // Rarely re-route Elite/Mythic into one randomly-chosen fakeout pattern (true
  // rarity in `result` is untouched). Always eligible — not gated by Flash Effect.
  _revealSurprise = _planSurprise(result);
  if(_revealSurprise) {
    _revealMark('FakeoutSelected', 'pattern=' + _revealSurprise.pattern + ' fake=' + _revealSurprise.fakeTier + ' true=' + tier);
    _runSurpriseReveal(result, _revealSurprise, screen);
    return;
  }
  _revealMark('NormalReveal', 'tier=' + tier);

  // push per-rarity timing to CSS so animation length tracks JS sequencing
  screen.style.setProperty('--charge-dur', cfg.charge+'ms');
  screen.style.setProperty('--hint-dur',   (cfg.hint||220)+'ms');
  screen.style.setProperty('--flip-half',  cfg.flipHalf+'ms');
  screen.style.setProperty('--burst-dur',  cfg.burst+'ms');
  if(tier) screen.classList.add('reveal--'+tier);

  $('cardDrawHint').classList.add('hidden');

  // preload the revealed image during charge/flip
  let _imgReady = !(result && result.card && result.card.img);
  if(!_imgReady) {
    const pre = new Image();
    pre.onload = pre.onerror = () => { _imgReady = true; };
    pre.src = result.card.img;
  }

  const after = (ms, fn) => { _revealTimers.push(setTimeout(fn, ms)); };
  const whenReady = (fn) => {
    if(_imgReady) return fn();
    let waited = 0;
    const tick = () => {
      if(_imgReady || waited > 1200) return fn();
      waited += 60; _revealTimers.push(setTimeout(tick, 60));
    };
    tick();
  };

  // Full suspense timing — always; independent of the Flash Effect setting.
  const chargeMs = cfg.charge;
  const hintMs   = (cfg.hint || 220);
  const flipHalf = cfg.flipHalf;
  const burstMs  = cfg.burst;

  // ── STATE: CHARGING (tap impact + inward energy pull) ──
  screen.classList.remove('is-idle');
  screen.classList.add('is-charging');
  _revealState = 'charging';
  _revealMark('ChargeStart', 'dur=' + chargeMs + 'ms');
  // route every subsequent tap to the skip handler (safe: listeners added now
  // do not fire for the tap currently being dispatched)
  _attachSkip();
  hiddenEl.classList.add('charging'); // press → rise → hold lifted (kept through hint)
  _spawnChargeParticles(tier);        // magnetized energy flying into the card
  _revealHaptic(cfg.haptic);

  // ── STATE: HINTING (rarity colour tease — no card face yet) ──
  after(chargeMs, () => {
    screen.classList.remove('is-charging');
    screen.classList.add('is-hinting');
    _revealState = 'hinting';
    _revealMark('ChargeComplete', 'hint=' + hintMs + 'ms');
    // a short tension tick for the rarer tiers as the colour bleeds through
    if(tier === 'elite' || tier === 'mythic') {
      _revealHaptic(tier === 'mythic' ? [12,24,12] : [10]);
    }

    // ── STATE: FLIPPING ──
    after(hintMs, () => {
    screen.classList.remove('is-hinting');
    screen.classList.add('is-flipping');
    _revealState = 'flipping';
    _revealMark('RevealFlip', 'flipHalf=' + flipHalf + 'ms');
    hiddenEl.classList.remove('charging');
    hiddenEl.classList.add('flip-out');

    // ── SWAP at the flip midpoint (wait for the image if needed) ──
    after(flipHalf, () => whenReady(() => {
      hiddenEl.style.display = 'none';
      const img = $('cardDrawRevealedImg');

      const flash = $('cardDrawFlash');
      flash.classList.remove('fire'); void flash.offsetWidth; flash.classList.add('fire');

      _populateRevealedCard(result, tier);
      img.style.display = 'block';
      img.classList.remove('flip-in'); void img.offsetWidth; img.classList.add('flip-in');

      // ── STATE: BURST (card face is up; fire the rarity impact) ──
      after(flipHalf, () => {
        screen.classList.remove('is-flipping');
        screen.classList.add('is-burst');
        _revealState = 'burst';

        if(tier) {
          const label = $('cardDrawRarityLabel');
          label.style.opacity = '';
          label.textContent = cfg.label;
          label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop');
          _spawnRevealParticles(tier);
          _revealHaptic([tier === 'mythic' ? 40 : tier === 'elite' ? 28 : 14]);
        }

        const revealed = $('cardDrawRevealed');
        revealed.style.display = 'flex';
        revealed.classList.remove('show'); void revealed.offsetWidth; revealed.classList.add('show');

        _revealMark('RevealComplete', 'burst=' + burstMs + 'ms');
        // ── STATE: SETTLED ──
        after(burstMs, () => {
          screen.classList.remove('is-burst');
          screen.classList.add('is-settled');
          _revealState = 'settled';
          _detachSkip();
          const label = $('cardDrawRarityLabel');
          label.classList.remove('pop');
          label.style.opacity = '0'; // fade the stamp so it never covers art at rest
          _showDupeBanner(result);
          $('cardDrawCollectBtn').classList.add('visible');
          _revealMark('Settled');
        });
      });
    }));
    }); // close HINTING → FLIPPING (after hintMs)
  });   // close CHARGING → HINTING (after chargeMs)
}

function collectCard() {
  const result = _cardDrawResult;
  const onDone = window._cardDrawOnDone;
  const isOCA = _ocaMode;
  // reset ทันที ป้องกัน double call
  _cardDrawResult = null;
  window._cardDrawOnDone = null;
  _ocaMode = false;

  if(result && result.card) {
    if(result.isDupe) {
      save.coins = (save.coins||0) + result.dupeCoins;
    } else {
      unlockCard(result.card.id);
      _csLastCards = null; save.savedCards = null;
    }
  }
  // เพิ่ม gamesCompleted เฉพาะ endgame draw
  if(!isOCA) {
    save.gamesCompleted = (save.gamesCompleted||0)+1;
  }
  markSaveDirty('card_opened');
  doSave();
  // ── BATCH TOAST: suppress per-card toasts during rapid opening ──
  // Pass null — do NOT claim 'Cloud Synced' here. The actual sync fires at 12s idle
  // and shows its own cloud/failed/offline toast when it resolves. Showing 'cloud' now
  // would be a false positive if the sync later fails (offline, timeout, 401).
  markCardOpenBatch(null);
  scheduleCloudSync('card_opened', { silentToast: false, batchToast: false, reason: 'card_opened' });
  $('cardDrawScreen').style.display = 'none';
  try {
    if(typeof onDone === 'function') onDone();
  } catch(e) {
    console.error('[collectCard] onDone error:', e);
    // fallback — ถ้า onDone fail ให้กลับ main menu เฉพาะกรณี OCA เท่านั้น
    // (endgame flow ไม่ควรมาถึงนี้ เพราะ updateShopCoinUI ถูก define แล้ว)
    if(isOCA) {
      showMainMenu();
    } else {
      // พยายาม navigate กลับ main menu เป็น last resort
      console.warn('[collectCard] endgame onDone failed — falling back to main menu');
      showMainMenu();
    }
  }
}

// ── Card Collection Screen ──
// ── PERF R2: IntersectionObserver for shimmer pause/resume ──────────────
let _ccShimmerObserver = null;

function _ccEnsureShimmerObserver() {
  if (_ccShimmerObserver) return;
  if (!window.IntersectionObserver) return; // graceful fallback
  _ccShimmerObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('cm-paused');
        } else {
          entry.target.classList.add('cm-paused');
        }
      }
    },
    {
      root: document.getElementById('cardCollectionScreen'),
      rootMargin: '60px 0px',  // small pre-load buffer
      threshold: 0
    }
  );
}

function _ccDisconnectShimmerObserver() {
  if (_ccShimmerObserver) {
    _ccShimmerObserver.disconnect();
    _ccShimmerObserver = null;
  }
}
// ── END PERF R2 observer helpers ──────────────────────────────────────

// ── PREMIUM RARITY CARD VFX (Elite/Mythic) — cosmetic DOM layers ───────
// Injects the GPU-only visual layers (.card-vfx-*) that give Elite/Mythic
// cards their premium look. Purely cosmetic: never touches save / cs_* /
// balance. No-op for Standard/Premium. Idempotent per node.
const _RARITY_VFX_CLASS = { standard: 'card--normal', premium: 'card--premium', elite: 'card--elite', mythic: 'card--mythic' };
const _RARITY_VFX_MOTES = { elite: 4, mythic: 6 };
const _MYTHIC_MOTE_COLORS = ['#b066ff', '#33e6ff', '#ffd86a', '#cc99ff', '#66f0ff', '#e0b8ff'];
function applyCardRarityVfx(el, rarity) {
  const cls = el && _RARITY_VFX_CLASS[rarity];
  if (!cls || el.classList.contains(cls)) return; // unknown rarity or already decorated
  el.classList.add(cls);
  // Normal = clean CSS-only baseline: no injected layers, no glow, no particles
  if (rarity === 'standard') return;
  // Premium = refined static look: surface depth + sheen + ring + interaction sweep
  if (rarity === 'premium') {
    el.insertAdjacentHTML('beforeend',
      '<div class="card-vfx-surface"></div>' +
      '<div class="card-vfx-highlight"></div>' +
      '<div class="card-vfx-border"></div>' +
      '<div class="card-vfx-sweep"></div>');
    return;
  }
  // Elite / Mythic = animated premium layers (+ particles)
  const n = _RARITY_VFX_MOTES[rarity] || 0;
  let motes = '';
  for (let i = 0; i < n; i++) {
    const left  = (8 + (i + 0.5) * (84 / n)).toFixed(1);
    const dur   = (6 + (i % 3) * 1.4).toFixed(1);
    const delay = (i * 0.9).toFixed(1);
    const color = rarity === 'mythic' ? _MYTHIC_MOTE_COLORS[i % _MYTHIC_MOTE_COLORS.length] : '#ffe680';
    motes += `<i class="card-vfx-particle" style="left:${left}%;--mdur:${dur}s;--mdelay:${delay}s;--mote:${color}"></i>`;
  }
  el.insertAdjacentHTML('beforeend',
    '<div class="card-vfx-aura"></div>' +
    '<div class="card-vfx-border"></div>' +
    '<div class="card-vfx-sweep"></div>' +
    (n ? `<div class="card-vfx-particles">${motes}</div>` : ''));
}

// Per-card themed selection accent. Bridges the in-run signature colour
// (CardVFX.VFX_MAP aura) into the pick moment so each Elite/Mythic card's
// selection burst matches its gameplay identity (fire → ember, frost → cold
// spark, gold → treasure gleam, …) instead of one generic gold/violet for the
// whole rarity. Cosmetic only, element-local (renders above the slot screen),
// and self-cleaning. No-op for Standard/Premium or if the layer isn't loaded.
function _csApplyPickAccent(el, card) {
  try {
    const color = (window.CardVFX && window.CardVFX.pickColor) ? window.CardVFX.pickColor(card.id) : null;
    if (!color) { el.style.removeProperty('--cv-pick'); el.classList.remove('cs-pick-themed'); return; }
    el.style.setProperty('--cv-pick', color);
    el.classList.add('cs-pick-themed');          // recolours the burst motes (CSS)
    // one-shot signature flare ring — a fresh self-removing node per select
    const flare = document.createElement('span');
    flare.className = 'cs-pick-flare';
    flare.setAttribute('aria-hidden', 'true');
    el.appendChild(flare);
    setTimeout(() => { if (flare.parentNode) flare.parentNode.removeChild(flare); }, 900);
  } catch (e) { /* cosmetic — must never break selection */ }
}

// One-shot sparkle + light-sweep burst on obtain / select / upgrade.
function pulseCardRarityVfx(el) {
  if (!el || !(el.classList.contains('card--premium') || el.classList.contains('card--elite') || el.classList.contains('card--mythic'))) return;
  el.classList.remove('card-vfx-burst');
  void el.offsetWidth; // restart the one-shot animations
  el.classList.add('card-vfx-burst');
  setTimeout(() => el && el.classList.remove('card-vfx-burst'), 900);
}
// ── END PREMIUM RARITY CARD VFX ───────────────────────────────────────

function openCardCollection() {
  $('mainMenu').style.display = 'none';
  $('dailyQuestWidget').classList.remove('visible');
  const screen = $('cardCollectionScreen');
  screen.style.display = 'flex';
  renderCardCollection();
  updateOcaTicketUI();
  // FIX 3 — defer observer setup until after layout is settled and screen is truly visible
  // (avoids all shimmer cards being paused because root was display:none at observer creation)
  requestAnimationFrame(() => {
    _ccEnsureShimmerObserver();
    const grid = $('cardCollectionGrid');
    if (_ccShimmerObserver && grid) {
      const shimmerCards = grid.querySelectorAll('.cm-glossy-wrap, .cm-prismatic-wrap, .card--elite, .card--mythic');
      for (const el of shimmerCards) {
        _ccShimmerObserver.observe(el);
      }
    }
  });
}

function closeCardCollection() {
  // Disconnect observer before hiding — avoids stale references
  _ccDisconnectShimmerObserver();
  $('cardCollectionScreen').style.display = 'none';
  $('mainMenu').style.display = 'flex';
  $('dailyQuestWidget').classList.add('visible');
}

function renderCardCollection() {
  const grid = $('cardCollectionGrid');

  // PERF R2: disconnect old observer before clearing grid (avoids observing stale nodes)
  _ccDisconnectShimmerObserver();

  // Clear grid in one shot
  grid.innerHTML = '';

  // PERF R2: remove any previously-delegated listeners cleanly by cloning the grid node
  // (grid.innerHTML='' already drops children; clone is only needed if listeners were set on grid itself)
  // We use event delegation so we only add ONE listener set per render.

  const RARITY_ORDER = { standard:0, premium:1, elite:2, mythic:3 };
  const unlocked = getUnlockedCards();
  const sorted = [...CARD_POOL].sort((a,b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);

  // PERF R2: build all cards into a DocumentFragment — single DOM insertion
  const frag = document.createDocumentFragment();

  // Store card data on the DOM node so delegation can retrieve it cheaply
  for (const card of sorted) {
    const div = document.createElement('div');
    const isUnlocked = unlocked.includes(card.id);
    div.className = 'cc-card' + (isUnlocked ? ' unlocked rarity-' + card.rarity : ' locked');

    if (isUnlocked) {
      // Only unlocked slots carry the real card id — locked ? slots must not leak
      // the hidden card identity into the DOM, and must not be openable.
      div.dataset.cardId = card.id; // used by delegated listener
      const img = document.createElement('img');
      img.src = card.img || '';
      img.alt = card.name;
      img.decoding = 'async';
      img.loading = 'lazy'; // PERF R2: browser-native lazy load for offscreen images
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      img.onerror = () => { img.style.opacity = '0'; };
      div.appendChild(img);
      // Card Mastery visual overlay (no save/cloud calls)
      cmDecorateCollectionCard(div, card);
      applyCardRarityVfx(div, card.rarity);
    } else {
      div.setAttribute('aria-disabled', 'true');
      div.innerHTML = '<div class="cc-card-locked">?</div>';
    }

    frag.appendChild(div);
  }

  // Single DOM write for all cards
  grid.appendChild(frag);

  // NOTE: shimmer observer setup moved to openCardCollection() inside requestAnimationFrame
  // to avoid race where IntersectionObserver root is display:none at creation time.
  // renderCardCollection() only builds DOM; observer wiring happens after screen is visible.

  // PERF R2: single delegated tap listener on grid (avoids N listeners for N cards)
  // Guard: only attach once per grid element lifetime (innerHTML='' doesn't remove grid listeners)
  if (!grid._perfR2ListenersAttached) {
    grid._perfR2ListenersAttached = true;
    let _tapStartX = 0, _tapStartY = 0, _tapStartT = 0, _tapTargetId = null;

    grid.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      _tapStartX = touch.clientX;
      _tapStartY = touch.clientY;
      _tapStartT = Date.now();
      // Find nearest UNLOCKED cc-card ancestor — locked ? slots are not tappable
      const ccCard = e.target.closest('.cc-card.unlocked');
      _tapTargetId = ccCard ? ccCard.dataset.cardId : null;
    }, { passive: true });

    grid.addEventListener('touchend', e => {
      if (!_tapTargetId) return;
      const touch = e.changedTouches[0];
      const dx = Math.abs(touch.clientX - _tapStartX);
      const dy = Math.abs(touch.clientY - _tapStartY);
      const dt = Date.now() - _tapStartT;
      if (dx < 8 && dy < 8 && dt < 300) {
        e.preventDefault();
        const card = CARD_POOL.find(c => c.id === _tapTargetId);
        if (card) openCardModal(card);
      }
      _tapTargetId = null;
    }, { passive: false });

    grid.addEventListener('click', e => {
      const ccCard = e.target.closest('.cc-card.unlocked');
      if (!ccCard) return;
      const card = CARD_POOL.find(c => c.id === ccCard.dataset.cardId);
      if (card) openCardModal(card);
    });
  }
}

// ── CARD DETAIL MODAL VFX ─────────────────────────────────────────────
// The collection grid already layers rarity VFX on each .cc-card via
// applyCardRarityVfx(). The detail modal previously only set a single
// box-shadow class on the <img>, so opened cards looked plain. These helpers
// extend the SAME rarity identity (rarity tier + per-card signature colour
// from CardVFX.VFX_MAP) into the modal: a framed hero card with aura, border
// shimmer, spotlight sweep, themed ability accents and (Mythic) soul orbs.
// Cosmetic only — never touches card logic / save / cs_* / balance. Honors
// prefers-reduced-motion + body.low-vfx / body.flash-off (Low VFX Mode).
const _CD_MOTES = { elite: 4, mythic: 8 };   // Elite = burst-only, Mythic = ambient orbs

// Premium detail-modal THEME accents (secondary only). The Premium *frame*
// colour is a fixed rarity identity (electric cyan / premium blue) defined in
// CSS via --rarity-* on .card-detail-vfx--premium — every Premium card shares
// it. These per-card two-tone accents are keyed deterministically off the card
// id and feed ONLY --cd-theme / --cd-theme2, which the CSS consumes for small
// flavour touches (ability-section header tint, optional sheen/sweep) — they
// must never recolour the frame, glow, or rarity label. Kept subtle so Premium
// reads as one consistent rarity, clearly BELOW Elite (gold) / Mythic (red).
// Cosmetic only; never touches card logic / save / cs_* / balance.
const _CD_PREMIUM_THEMES = [
  { style: 'rizz',    accent: '#ff5fa8', accent2: '#36e6ff' }, // influencer / love / rizz — pink + cyan
  { style: 'fame',    accent: '#e6ecff', accent2: '#4aa8ff' }, // fame / sponsor — pearl + blue
  { style: 'charm',   accent: '#e04fff', accent2: '#3a7bff' }, // charm / confidence — magenta + electric blue
  { style: 'azure',   accent: '#39b8ff', accent2: '#8fe6ff' }, // refined sky + ice
  { style: 'verdant', accent: '#3fe0b8', accent2: '#2bbfd6' }, // mint + teal
  { style: 'violet',  accent: '#8f7bff', accent2: '#45d6ff' }, // periwinkle + cyan
];
function _cdPremiumTheme(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return _CD_PREMIUM_THEMES[h % _CD_PREMIUM_THEMES.length];
}

let _cdActiveCardId = null;

// Build the per-card themed orb pool inside the frame's particle layer.
// Mythic floats ambiently; Elite stays idle until a burst (.triggered).
function _cdBuildParticles(rarity, themeColor) {
  const host = document.getElementById('cardDetailParticles');
  if (!host) return;
  host.innerHTML = '';
  const n = _CD_MOTES[rarity] || 0;
  if (!n) return;
  let html = '';
  for (let i = 0; i < n; i++) {
    const left  = (6 + (i + 0.5) * (88 / n)).toFixed(1);
    const dur   = (5.5 + (i % 4) * 1.3).toFixed(1);
    const delay = (i * 0.7).toFixed(1);
    const color = rarity === 'mythic'
      ? (themeColor || _MYTHIC_MOTE_COLORS[i % _MYTHIC_MOTE_COLORS.length])
      : (themeColor || '#ffe680');
    html += `<i class="card-detail-mote" style="left:${left}%;--mdur:${dur}s;--mdelay:${delay}s;--mote:${color}"></i>`;
  }
  host.innerHTML = html;
}

// Fire a short selection/activation burst (Elite sparkle / Mythic activation).
function _cdTriggerBurst() {
  const content = document.getElementById('cardModalContent');
  if (!content) return;
  content.classList.remove('triggered');
  void content.offsetWidth;            // restart one-shot animations
  content.classList.add('triggered');
  clearTimeout(_cdTriggerBurst._t);
  _cdTriggerBurst._t = setTimeout(() => content && content.classList.remove('triggered'), 950);
}

function openCardModal(card) {
  // Defense-in-depth: never reveal a card the player has not unlocked, no matter
  // which path calls this. Locked cards stay secret.
  if (!card || !isCardUnlocked(card.id)) return;
  _cdActiveCardId = card.id;

  const img = $('cardModalImg');
  img.src = card.img||'';
  img.className = 'aura-'+card.rarity;
  $('cardModalName').textContent = card.name;
  const tierEl = $('cardModalTier');
  tierEl.textContent = card.rarity.toUpperCase();
  tierEl.className = 'tier-'+card.rarity;
  // ── Card Mastery: update runs + visual
  cmUpdateModalMastery(card.id);
  const rawDesc = card.fullDescription || card.effect || '';
  const formattedDesc = rawDesc
    .replace(/\n/g, '<br>')
    // Ability section headers get a themed accent pulse (.ability-vfx) so each
    // [SECTION] reads as a high-tier skill block, not plain text.
    .replace(/\[([^\]]+)\]/g, '<span class="card-modal-section-header ability-vfx">[$1]</span>');
  $('cardModalEffect').innerHTML = formattedDesc;
  $('cardModalTradeoff').innerHTML = card.tradeoff ? 'TRADE-OFF: '+card.tradeoff : '';
  // Reset the ability-description scroll to the top for the newly opened card
  // (never resets mid-read because this only runs on open) and (re)measure
  // whether the text overflows its fixed-height slot to toggle the fade hint.
  const descScroll = $('cardModalDescScroll');
  const descWrap   = $('cardModalDescWrap');
  if (descScroll && descWrap) {
    descScroll.scrollTop = 0;
    descWrap.classList.remove('has-overflow');
    requestAnimationFrame(() => {
      if (descScroll.scrollHeight - descScroll.clientHeight > 2) descWrap.classList.add('has-overflow');
    });
  }

  // ── Detail-modal rarity VFX: inherit the grid card's rarity identity ──
  const content = $('cardModalContent');
  // Per-card signature colour + theme style from the in-run VFX map (single
  // source of truth so the modal matches gameplay identity, not a generic glow).
  const themeColor = (window.CardVFX && window.CardVFX.pickColor) ? window.CardVFX.pickColor(card.id) : null;
  const themeStyle = (window.CardVFX && window.CardVFX.VFX_MAP && window.CardVFX.VFX_MAP[card.id] && window.CardVFX.VFX_MAP[card.id].aura)
    ? window.CardVFX.VFX_MAP[card.id].aura[0] : '';
  content.className = 'card-detail-vfx card-detail-vfx--' + card.rarity;
  content.classList.remove('opened', 'active', 'triggered');
  // Per-rarity colour:
  //  • Premium → fixed cyan rarity frame (CSS --rarity-*); the curated two-tone
  //    palette below only feeds --cd-theme/--cd-theme2 as a SECONDARY accent
  //    (ability headers / sheen), never the frame.
  //  • Elite/Mythic → gameplay signature colour drives --cd-theme.
  //  • Standard → neutral baseline (no --cd-theme).
  content.style.removeProperty('--cd-theme2');
  if (card.rarity === 'premium') {
    const pt = _cdPremiumTheme(card.id);
    content.dataset.cdTheme = pt.style;
    content.style.setProperty('--cd-theme',  pt.accent);
    content.style.setProperty('--cd-theme2', pt.accent2);
  } else if (themeColor) {                       // Elite / Mythic signature colour
    content.dataset.cdTheme = themeStyle || '';
    content.style.setProperty('--cd-theme', themeColor);
  } else {                                       // Standard — clean neutral baseline
    content.dataset.cdTheme = '';
    content.style.removeProperty('--cd-theme');
  }
  _cdBuildParticles(card.rarity, themeColor);

  $('cardModal').style.display = 'flex';

  // Open choreography: modal fades in → hero card rises → aura/shimmer activate
  // → ability sections reveal → one selection burst. All GPU-only (transform/
  // opacity), short, and skipped under reduced-motion / Low VFX (CSS-gated).
  requestAnimationFrame(() => {
    content.classList.add('opened');
    requestAnimationFrame(() => {
      content.classList.add('active');
      _cdTriggerBurst();
    });
  });
}

function closeCardModal() {
  $('cardModal').style.display = 'none';
  // Pause + tear down modal VFX so nothing animates behind a hidden modal.
  const content = document.getElementById('cardModalContent');
  if (content) {
    content.classList.remove('opened', 'active', 'triggered');
    clearTimeout(_cdTriggerBurst._t);
  }
  const host = document.getElementById('cardDetailParticles');
  if (host) host.innerHTML = '';   // drop orb nodes — no idle DOM/animation
  _cdActiveCardId = null;
}

function startGame() {
  _currentRunId = _newRunId();
  DEV_LOG('[startGame] new runId:', _currentRunId);
  prefetchFightBGM();
  _applyArenaBg();
  $('mainMenu').style.display='none';
  $('dailyQuestWidget').classList.remove('visible');
  $('resultScreen').style.display='none';
  // ซ่อนทุกอย่างก่อน — จะแสดงหลังเลือกการ์ดแล้ว
  $('topUI').style.display='none';
  $('fighter').style.display='none';
  $('tapZone').style.display='none';
  $('streakLabel').style.display='none';
  $('wpCounter').style.display='none';
  initState(); warmUpAudio();
  csReset(false);
  openCardSlot(()=>{
    // แสดง UI หลังเลือกการ์ดแล้ว
    $('topUI').style.display='block';
    $('fighter').style.display='block';
    $('streakLabel').style.display='block';
    $('wpCounter').style.display='flex';
    _syncSoundBtns();
    requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ _bSetSize(); _bScheduleDraw(); }); });
    stopBGM();
    if(window._csState){
      if(window._csState.cs_extraTime)  timeLeft += window._csState.cs_extraTime;
      if(window._csState.cs_orchero)    timeLeft = Math.max(5, timeLeft - 5);
      if(window._csState.cs_moonlightflower) timeLeft = Math.round(timeLeft * 0.5);
      if(window._csState.cs_timePenalty) timeLeft = Math.max(5, timeLeft - window._csState.cs_timePenalty);
      if(window._csState.cs_enemyHpReduce) {
        maxHP = Math.round(maxHP * (1 - window._csState.cs_enemyHpReduce));
        hp = maxHP; updateUI();
      }
      // cs_ktullanux HP *1.5 handled via cs_enemyHpReduce = -0.50 in apply()
      if(window._csState.cs_beelzebub) { maxHP = Math.round(maxHP * 2); hp = maxHP; updateUI(); }
    }
    startCountdown(()=>{
      gameRunning=true;
      if(window._csState && window._csState.cs_eddga) _csStartEddga();
      if(window._csState && window._csState.cs_lordofdeath) _csStartLodTimer();
      else _showActiveCard(activeCard);
      $('tapZone').style.display='block';
      scheduleWeakPoint(); startTimer(); playFightBGM(); INPUT.start(); pressureArm();
    });
  });
}

function retryGame() {
  _currentRunId = _newRunId();
  DEV_LOG('[retryGame] new runId:', _currentRunId);
  stopFightBGM(); _stopCollectBGM();
  prefetchFightBGM();
  _applyArenaBg();
  $('resultScreen').style.display='none';
  $('topUI').style.display='block';
  $('fighter').style.display='block';
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ _bSetSize(); _bScheduleDraw(); }); });
  $('tapZone').style.display='none';
  $('streakLabel').style.display='block';
  $('wpCounter').style.display='flex';
  _syncSoundBtns();
  initState();
  csReset(true); // ล้าง savedCards — retry สุ่มใหม่เสมอ
  // เล่น title BGM ระหว่างหน้า card slot
  playBGM();
  openCardSlot(()=>{
    stopBGM();
    if(window._csState){
      if(window._csState.cs_extraTime)  timeLeft += window._csState.cs_extraTime;
      if(window._csState.cs_orchero)    timeLeft = Math.max(5, timeLeft - 5);
      if(window._csState.cs_moonlightflower) timeLeft = Math.round(timeLeft * 0.5);
      if(window._csState.cs_timePenalty) timeLeft = Math.max(5, timeLeft - window._csState.cs_timePenalty);
      if(window._csState.cs_enemyHpReduce) {
        maxHP = Math.round(maxHP * (1 - window._csState.cs_enemyHpReduce));
        hp = maxHP; updateUI();
      }
      // cs_ktullanux HP *1.5 handled via cs_enemyHpReduce = -0.50 in apply()
      if(window._csState.cs_beelzebub) { maxHP = Math.round(maxHP * 2); hp = maxHP; updateUI(); }
    }
    startCountdown(()=>{
      gameRunning=true;
      if(window._csState && window._csState.cs_eddga) _csStartEddga();
      if(window._csState && window._csState.cs_lordofdeath) _csStartLodTimer();
      else _showActiveCard(activeCard); // แสดงการ์ดที่เลือก (non-LOD)
      $('tapZone').style.display='block';
      scheduleWeakPoint(); startTimer(); playFightBGM(); INPUT.start(); pressureArm();
    });
  });
}

function startCountdown(onDone) {
  const overlay = $('countdownOverlay');
  const numEl   = $('countdownNum');
  const subEl   = $('countdownSub');
  overlay.style.display = 'flex';
  let count = 3;

  // เล่นเสียง countdown (ผ่านตัวกลาง SFX เดียวกัน — เคารพ sfxOn + sfxVolume)
  _playSfxEl('countdownSound', 1.0);

  function tick() {
    numEl.className = ''; // reset animation
    void numEl.offsetWidth;  // reflow trigger animation
    if(count > 0) {
      numEl.textContent = count;
      numEl.className   = '';
      subEl.textContent = 'GET READY';
      count--;
      setTimeout(tick, 900);
    } else {
      numEl.textContent = 'GO!';
      numEl.className   = 'go';
      subEl.textContent = '';
      setTimeout(()=>{
        overlay.style.display = 'none';
        onDone();
      }, 700);
    }
  }
  tick();
}

function goMainMenu() {
  stopFightBGM(); _stopCollectBGM();
  $('resultScreen').style.display='none';
  showMainMenu();
}

// ══════════════════════════════════════════
// PAUSE
// ══════════════════════════════════════════

function pauseGame() {
  if(!gameRunning || gamePaused) return;
  INPUT.stop();
  pressureClearTimers();
  pressureHide();
  gamePaused = true;
  gameRunning = false;
  clearInterval(timerInterval);
  clearTimeout(godTimeout);
  clearInterval(godInterval);
  clearTimeout(wpSchedule);
  clearTimeout(wpTimeout);
  $('weakPoint').style.display = 'none';
  wpActive = false;
  if(_fightBgmCurrent && !_fightBgmCurrent.paused) _fightBgmCurrent.pause();

  // แสดงการ์ดที่เลือกในรอบนี้
  const card = activeCard;
  const info = $('pauseCardInfo');
  if(card) {
    const img = $('pauseCardImg');
    img.src = card.img || '';
    img.className = 'aura-'+card.rarity;
    $('pauseCardName').textContent = card.name;
    const tierEl = $('pauseCardTier');
    tierEl.textContent = card.rarity.toUpperCase();
    tierEl.className = 'tier-'+card.rarity;
    $('pauseCardEffect').innerHTML = card.effect || '';
    $('pauseCardTradeoff').innerHTML = card.tradeoff ? 'TRADE-OFF: '+card.tradeoff : '';
    info.style.display = 'flex';
  } else {
    info.style.display = 'none';
  }

  $('pauseScreen').style.display = 'flex';
}

function resumeGame() {
  if(!gamePaused) return;
  $('pauseScreen').style.display = 'none';
  gamePaused = false;
  gameRunning = true;
  INPUT.start();
  // resume fight BGM
  if(_fightBgmCurrent && _fightBgmCurrent.paused && _fightBgmActive) {
    _fightBgmCurrent.play().catch(()=>{});
  }
  startTimer();
  scheduleWeakPoint();
  if(godLevel > 0 && godSecondsLeft > 0) {
    clearInterval(godInterval);
    _lastOdTickAt = performance.now();
    godInterval = setInterval(()=>{
      // Wall-clock elapsed seconds since the previous tick — see the matching
      // comment in activateGodLevel()'s godInterval for the full reasoning.
      const _odNow = performance.now();
      const _odRealDtSec = Math.min(2, Math.max(0, (_odNow - _lastOdTickAt) / 1000));
      _lastOdTickAt = _odNow;
      godSecondsLeft -= _odRealDtSec;
      updateGodLevelUI();
      if(godSecondsLeft <= 0){
        clearInterval(godInterval);
        if(godLevel === 3) finalAnnihilation();
        else exitGodMode();
      }
    }, 1000);
  }
}

function pauseGoMainMenu() {
  stopFightBGM();
  // เคลียร์ทุก timer ก่อนออก
  gamePaused = false;
  gameRunning = false;
  clearInterval(timerInterval);
  clearTimeout(godTimeout);
  clearInterval(godInterval);
  clearTimeout(wpSchedule);
  clearTimeout(wpTimeout);
  _csStopAllTimers();
  wpActive = false;
  $('weakPoint').style.display = 'none';
  $('pauseScreen').style.display = 'none';
  showMainMenu();
}




// ══════════════════════════════════════════
// PRESSURE SYSTEM V7 — AK47 SURVIVAL BREAK SYSTEM
// Additive survival pacing: chaos → focus → static BREAK target → progressive rewards.
// ══════════════════════════════════════════
const PRESSURE = {
  rage: 0,
  phase: 'idle',
  cooldown: 0,
  targetHits: 0,
  targetNeed: 12,
  breakEndsAt: 0,
  breakDuration: 2800,
  activeTarget: null,
  timers: [],
  heartbeat: null,
  lastAfkAt: 0,
  breakAttempts: 0,
  currentBreak: 0,
  successStreak: 0,
  successes: 0,
  bestStreak: 0,
  failedBreaks: 0,
  failStreak: 0,
  maxRage: 0,
  prePressureMusicVolume: null,
  auraStage: 'normal',
  successFreezeUntil: 0,
  failAssist: 0,
  resolvePoint: null,
};

const PRESSURE_BREAK_TABLE = [
  { min: 6, max: 9, duration: 3100 },
  { min: 10, max: 14, duration: 3000 },
  { min: 15, max: 18, duration: 2925 },
  { min: 20, max: 24, duration: 2750 },
  { min: 25, max: 28, duration: 2650 },
];

const PRESSURE_FAIL_RAGE_TABLE = [
  { min: 32, max: 38 },
  { min: 40, max: 50 },
  { min: 55, max: 65 },
];

function pressureReset() {
  pressureClearTimers();
  PRESSURE.rage = 0;
  PRESSURE.phase = 'idle';
  PRESSURE.cooldown = 0;
  PRESSURE.targetHits = 0;
  PRESSURE.lastAfkAt = Date.now();
  PRESSURE.breakAttempts = 0;
  PRESSURE.currentBreak = 0;
  PRESSURE.successStreak = 0;
  PRESSURE.successes = 0;
  PRESSURE.bestStreak = 0;
  PRESSURE.failedBreaks = 0;
  PRESSURE.failStreak = 0;
  PRESSURE.maxRage = 0;
  PRESSURE.auraStage = 'normal';
  PRESSURE.successFreezeUntil = 0;
  PRESSURE.failAssist = 0;
  PRESSURE.resolvePoint = null;
  PRESSURE._lastTarget = null;
  pressureHide();
  pressureUpdateRageUI();
}

function pressureArm() {
  PRESSURE.cooldown = pressureNextCooldown();
  PRESSURE.lastAfkAt = Date.now();
  pressureUpdateRageUI();
}

function pressureRandomRange(min, max) {
  return min + Math.random() * (max - min);
}

function pressureNextCooldown() {
  const n = PRESSURE.breakAttempts;
  let min = 15000;
  let max = 22000;
  if(n >= 2 && n < 5) {
    min = 12000;
    max = 18000;
  } else if(n >= 5) {
    min = 10000;
    max = 15000;
  }

  // Successful, controlled runs should naturally intensify without making BREAK
  // feel like a constant interruption. Overdrive is intentionally not a primary
  // frequency driver so normal no-OD runs still see the system regularly.
  const wins = Math.max(0, PRESSURE.successes || 0);
  let accel = Math.min(0.16, Math.max(0, wins - 2) * 0.035);
  if((combo || 0) >= 80) accel += 0.05;
  else if((combo || 0) >= 40) accel += 0.03;
  if((PRESSURE.rage || 0) <= 35 && wins >= 2) accel += 0.025;
  accel = Math.min(0.22, accel);

  const cooldown = pressureRandomRange(min, max) * (1 - accel);
  return Math.max(9000, cooldown);
}

function pressureClearTimers() {
  PRESSURE.timers.forEach(clearTimeout);
  PRESSURE.timers.length = 0;
  if(PRESSURE.heartbeat) { clearInterval(PRESSURE.heartbeat); PRESSURE.heartbeat = null; }
  clearTimeout(PRESSURE._auraHitTimer);
  PRESSURE._auraHitTimer = null;
  pressureRemoveTarget();
}

function pressureSetTimer(fn, ms) {
  const id = setTimeout(fn, ms);
  PRESSURE.timers.push(id);
  return id;
}

function pressureHide() {
  const root = $('gameRoot');
  const overlay = $('pressureOverlay');
  if(overlay) { overlay.className = ''; overlay.style.display = 'none'; }
  root.classList.remove('pressure-focus','pressure-break','pressure-impact-freeze','pressure-success-release','pressure-fail-backlash','pressure-aura-mid','pressure-aura-high','pressure-aura-critical','pressure-aura-hit','pressure-aura-collapse','pressure-aura-release','rage-mid','rage-high','rage-critical','shake-wp','shake-wp2');
  pressureApplyRageClass();
  pressureApplyStreakClass();
  const txt = $('pressureText'); if(txt) txt.classList.remove('show');
  const hud = $('pressureHud'); if(hud) hud.classList.remove('show');
  if(!gameRunning) {
    const meter = $('rageMeter'); if(meter) meter.classList.remove('show');
  }
  pressureRemoveTarget();
  _barrierHide();
}

function pressureUpdate(dtMs) {
  if(!gameRunning || gamePaused) return;
  if(PRESSURE.phase !== 'idle') return;
  PRESSURE.cooldown -= dtMs;
  const now = Date.now();
  if(now - PRESSURE.lastAfkAt > 3200) {
    pressureAddRage(4, 'AFK');
    PRESSURE.lastAfkAt = now;
  }
  if(PRESSURE.cooldown <= 0) pressureStartBuildup();
}

function pressureStartBuildup() {
  if(!gameRunning || PRESSURE.phase !== 'idle') return;
  pressureClearTimers();
  PRESSURE.phase = 'buildup';
  const root = $('gameRoot');
  const overlay = $('pressureOverlay');
  pressureApplyStreakClass();
  root.classList.add('pressure-focus');
  overlay.style.display = 'block';
  overlay.className = 'active buildup';
  pressureHeartbeat(pressureHeartbeatDelay());
  pressureSetTimer(()=>pressureLockIn(), Math.round(pressureRandomRange(1500, 2000)));
  _barrierStart();
}

function pressureLockIn() {
  if(!gameRunning) return;
  PRESSURE.phase = 'lockin';
  const overlay = $('pressureOverlay');
  overlay.className = 'active lockin';
  pressureSetTimer(()=>pressureStartBreak(), Math.round(pressureRandomRange(600, 800)));
}

function pressureDifficulty() {
  // Progression follows successful BREAK count, not total appearances.
  // A failed BREAK retries the same success tier with a small temporary assist.
  const breakNo = Math.max(1, (PRESSURE.successes || 0) + 1);
  const tier = Math.min(5, breakNo);
  const base = PRESSURE_BREAK_TABLE[tier - 1];
  let need = Math.round(pressureRandomRange(base.min, base.max));
  let duration = base.duration;
  if(breakNo > 5) {
    // Soft post-BREAK-5 scaling: never exceed the human target-count cap.
    need = Math.min(28, need + (Math.random() < 0.35 ? 1 : 0));
    duration = Math.max(2450, duration - Math.min(200, (breakNo - 5) * 25));
  }
  const assist = Math.min(3, Math.max(0, PRESSURE.failAssist || 0));
  if(assist > 0) {
    need = Math.max(5, need - assist);
    duration += assist * 120;
  }
  return { need, duration, breakNo };
}

function pressureStartBreak() {
  if(!gameRunning) return;
  PRESSURE.phase = 'break';
  PRESSURE.targetHits = 0;
  PRESSURE.breakAttempts++;
  const d = pressureDifficulty();
  PRESSURE.currentBreak = d.breakNo;
  PRESSURE.targetNeed = d.need;
  let _extraBreakMs = Math.round(((window._csState && window._csState.cs_breakDuration) || 0) * 1000);
  if(window._csState && window._csState.cs_whizperGhostProtocol && window._csState._whizperGhostEndTime && performance.now() < window._csState._whizperGhostEndTime) _extraBreakMs += 150;
  PRESSURE.breakDuration = d.duration + _extraBreakMs;
  PRESSURE.breakEndsAt = performance.now() + PRESSURE.breakDuration;
  PRESSURE.auraStage = 'normal';
  pressurePauseNormalSpawns();
  const overlay = $('pressureOverlay');
  pressureApplyStreakClass();
  $('gameRoot').classList.add('pressure-break');
  overlay.className = 'active break';
  $('pressureHud').classList.add('show');
  pressureUpdateBreakHUD();
  pressureSpawnTarget();
  _barrierOverload();
  if(typeof csOnBreakStart === 'function') csOnBreakStart();
  pressureBreakLoop();
}

function pressureBreakLoop() {
  if(PRESSURE.phase !== 'break') return;
  pressureUpdateBreakHUD();
  if(performance.now() >= PRESSURE.breakEndsAt) {
    pressureResolve(false);
    return;
  }
  pressureSetTimer(pressureBreakLoop, 66);
}

function pressureUpdateBreakHUD() {
  const pct = Math.min(100, (PRESSURE.targetHits / PRESSURE.targetNeed) * 100);
  const remainMs = Math.max(0, PRESSURE.breakEndsAt - performance.now());
  const remainRatio = PRESSURE.breakDuration ? remainMs / PRESSURE.breakDuration : 1;
  $('pressureProgress').style.width = pct + '%';
  $('pressureHitLabel').textContent = 'SUPPRESSION';
  $('pressureTimer').textContent = (remainMs / 1000).toFixed(1);
  pressureUpdateTargetDamage(pct);
  pressureUpdateTargetAura(remainRatio);
  pressureUpdateBossAura(remainRatio);
}

function pressureUpdateTargetDamage(pct) {
  const target = PRESSURE.activeTarget;
  if(!target) return;
  target.classList.toggle('dmg-25', pct >= 25);
  target.classList.toggle('dmg-50', pct >= 50);
  target.classList.toggle('dmg-75', pct >= 75);
  target.classList.toggle('dmg-90', pct >= 90);
}


function pressureUpdateTargetAura(remainRatio) {
  const target = PRESSURE.activeTarget;
  if(!target) return;
  const stage = remainRatio <= 0.10 ? 'critical' : remainRatio <= 0.30 ? 'panic' : 'normal';
  if(PRESSURE.auraStage === stage) return;
  PRESSURE.auraStage = stage;
  target.classList.toggle('panic', stage === 'panic');
  target.classList.toggle('critical', stage === 'critical');
  if(stage === 'critical') pressureHeartbeat(210);
  else if(stage === 'panic') pressureHeartbeat(280);
}


function pressureUpdateBossAura(remainRatio) {
  const root = $('gameRoot');
  if(!root || PRESSURE.phase !== 'break') return;
  root.classList.toggle('pressure-aura-mid', remainRatio <= 0.70 && remainRatio > 0.30);
  root.classList.toggle('pressure-aura-high', remainRatio <= 0.30 && remainRatio > 0.10);
  root.classList.toggle('pressure-aura-critical', remainRatio <= 0.10);
}

function pressureReactBossAura() {
  const root = $('gameRoot');
  if(!root || PRESSURE.phase !== 'break') return;
  // Debounce: no reflow — just extend the timeout if already showing
  if(!PRESSURE._auraHitTimer) root.classList.add('pressure-aura-hit');
  clearTimeout(PRESSURE._auraHitTimer);
  PRESSURE._auraHitTimer = setTimeout(()=>{ root.classList.remove('pressure-aura-hit'); PRESSURE._auraHitTimer = null; }, 160);
}

function pressureReleaseBossAura(failed=false) {
  const root = $('gameRoot');
  if(!root) return;
  root.classList.remove('pressure-aura-mid','pressure-aura-high','pressure-aura-critical','pressure-aura-hit','pressure-aura-collapse','pressure-aura-release');
  void root.offsetWidth;
  root.classList.add(failed ? 'pressure-aura-release' : 'pressure-aura-collapse');
  setTimeout(()=>root.classList.remove('pressure-aura-collapse','pressure-aura-release'), failed ? 560 : 420);
}


// ══════════════════════════════════════════
// BREAK BARRIER OVERLAY SYSTEM
// ══════════════════════════════════════════
const _BARRIER = {
  state: 'idle',      // idle | buildup | overload | breaking | shatter | fade
  opacity: 0,
  rotation: 0,        // degrees
  scale: 1,
  buildupStartTime: 0,
  overloadStartTime: 0,
  shatterStartTime: 0,
  fadeStartTime: 0,
  lastTs: 0,
  raf: null,
  el: null,
};

function _barrierEl() {
  if (!_BARRIER.el) _BARRIER.el = document.getElementById('breakBarrierOverlay');
  return _BARRIER.el;
}

function _barrierApply(el) {
  el.style.opacity = _BARRIER.opacity;
  el.style.transform = 'translate(-50%, -50%) scale(' + _BARRIER.scale + ') rotate(' + _BARRIER.rotation + 'deg)';
}

function _barrierTick(ts) {
  const el = _barrierEl();
  if (!el) { _BARRIER.raf = null; return; }

  const dt = _BARRIER.lastTs ? Math.min((ts - _BARRIER.lastTs) / 1000, 0.05) : 0.016;
  _BARRIER.lastTs = ts;

  switch (_BARRIER.state) {
    case 'buildup': {
      const elapsed = ts - _BARRIER.buildupStartTime;
      // Progress 0→1 over ~2500ms (buildup + lockin combined)
      const buildProg = Math.min(1, elapsed / 2500);
      const targetOpacity = buildProg * 0.40;
      _BARRIER.opacity += (targetOpacity - _BARRIER.opacity) * Math.min(1, dt * 5);
      // Slow rotation: slightly faster past 80% build-up
      const rotSpeed = buildProg >= 0.8 ? 5.5 : 3.5; // deg/s
      _BARRIER.rotation = (_BARRIER.rotation + rotSpeed * dt) % 360;
      // Subtle pulse
      _BARRIER.scale = 1 + Math.sin(ts * 0.002) * 0.02;
      break;
    }
    case 'overload': {
      const elapsed = ts - _BARRIER.overloadStartTime;
      const t = Math.min(1, elapsed / 200);
      _BARRIER.opacity = 0.40 + (0.85 - 0.40) * t;
      _BARRIER.scale = 1 + (1.12 - 1) * t;
      _BARRIER.rotation = (_BARRIER.rotation + 9 * dt) % 360;
      if (elapsed >= 200) {
        _BARRIER.state = 'breaking';
        _BARRIER.opacity = 0.85;
        _BARRIER.scale = 1.12;
      }
      break;
    }
    case 'breaking': {
      _BARRIER.opacity = 0.85;
      _BARRIER.scale = 1.12 + Math.sin(ts * 0.003) * 0.02;
      _BARRIER.rotation = (_BARRIER.rotation + 7 * dt) % 360;
      break;
    }
    case 'shatter': {
      const elapsed = ts - _BARRIER.shatterStartTime;
      const dur = 500;
      const t = Math.min(1, elapsed / dur);
      const eased = 1 - Math.pow(1 - t, 2);
      _BARRIER.scale = 1.12 + (1.35 - 1.12) * eased;
      _BARRIER.opacity = 0.85 * (1 - eased);
      _BARRIER.rotation = (_BARRIER.rotation + 12 * dt) % 360;
      if (elapsed >= dur) {
        _BARRIER.state = 'idle';
        _BARRIER.opacity = 0;
        _BARRIER.scale = 1;
        _BARRIER.rotation = 0;
      }
      break;
    }
    case 'fade': {
      const elapsed = ts - _BARRIER.fadeStartTime;
      const t = Math.min(1, elapsed / 350);
      _BARRIER.opacity = (1 - t) * _BARRIER._fadeFromOpacity;
      _BARRIER.rotation = (_BARRIER.rotation + 4 * dt) % 360;
      if (elapsed >= 350) {
        _BARRIER.state = 'idle';
        _BARRIER.opacity = 0;
      }
      break;
    }
    default:
      break;
  }

  _barrierApply(el);

  if (_BARRIER.state === 'idle') {
    _BARRIER.raf = null;
    _BARRIER.lastTs = 0;
    return;
  }
  _BARRIER.raf = requestAnimationFrame(_barrierTick);
}

function _barrierEnsureRaf() {
  if (!_BARRIER.raf) _BARRIER.raf = requestAnimationFrame(_barrierTick);
}

function _barrierStart() {
  _BARRIER.state = 'buildup';
  _BARRIER.buildupStartTime = performance.now();
  _BARRIER.opacity = 0;
  _BARRIER.rotation = 0;
  _BARRIER.scale = 1;
  _BARRIER.lastTs = 0;
  _barrierEnsureRaf();
}

function _barrierOverload() {
  _BARRIER.state = 'overload';
  _BARRIER.overloadStartTime = performance.now();
  _barrierEnsureRaf();
}

function _barrierShatter() {
  _BARRIER.state = 'shatter';
  _BARRIER.shatterStartTime = performance.now();
  _BARRIER.opacity = Math.max(_BARRIER.opacity, 0.85);
  _BARRIER.scale = Math.max(_BARRIER.scale, 1.12);
  _barrierEnsureRaf();
}

function _barrierFail() {
  if (_BARRIER.state === 'idle') return;
  _BARRIER._fadeFromOpacity = _BARRIER.opacity;
  _BARRIER.state = 'fade';
  _BARRIER.fadeStartTime = performance.now();
  _barrierEnsureRaf();
}

function _barrierHide() {
  // Let shatter and fade finish naturally; interrupt everything else immediately
  if (_BARRIER.state === 'shatter' || _BARRIER.state === 'fade') return;
  _BARRIER.state = 'idle';
  _BARRIER.opacity = 0;
  _BARRIER.scale = 1;
  _BARRIER.rotation = 0;
  const el = _barrierEl();
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -50%) scale(1) rotate(0deg)';
  }
}


function pressureSpawnTarget() {
  pressureRemoveTarget();
  if(PRESSURE.phase !== 'break') return;
  const overlay = $('pressureOverlay');
  const target = document.createElement('button');
  target.className = 'break-target';
  target.type = 'button';
  target.setAttribute('aria-label','AK47 BREAK target');
  const crack = document.createElement('span');
  crack.className = 'break-crack';
  crack.setAttribute('aria-hidden','true');
  target.appendChild(crack);
  const marginX = Math.min(96, Math.max(70, vvW()*0.18));
  const marginTop = Math.min(140, Math.max(96, vvH()*0.18));
  const marginBot = Math.min(150, Math.max(110, vvH()*0.2));
  const minX = marginX, maxX = Math.max(minX, vvW() - marginX);
  const minY = marginTop, maxY = Math.max(minY, vvH() - marginBot);
  const old = PRESSURE._lastTarget || {x: vvW()/2, y: vvH()/2};
  let x = minX + Math.random() * (maxX - minX);
  let y = minY + Math.random() * (maxY - minY);
  const maxTravel = Math.min(vvW(), vvH()) * (PRESSURE.currentBreak >= 4 ? 0.5 : 0.44);
  const dist = Math.hypot(x-old.x, y-old.y);
  if(dist > maxTravel) { x = old.x + (x-old.x) / dist * maxTravel; y = old.y + (y-old.y) / dist * maxTravel; }
  x = Math.max(minX, Math.min(maxX, x));
  y = Math.max(minY, Math.min(maxY, y));
  PRESSURE._lastTarget = {x,y};
  const targetSize = Math.max(110, Math.min(170, vvW() * 0.30));
  target.style.setProperty('--break-target-size', targetSize + 'px');
  target.style.left = (x - targetSize / 2) + 'px';
  target.style.top = (y - targetSize / 2) + 'px';
  let lastTouchTapAt = 0;
  const activePointers = new Set();
  const pointerTapAt = new Map();
  const hit = ev => {
    if(ev.cancelable) ev.preventDefault();
    ev.stopPropagation();
    const now = performance.now();
    const id = ev.pointerId || (ev.type === 'touchstart' ? 'touch' : 'mouse');
    if(ev.type === 'click' && now - lastTouchTapAt < 500) return;
    if(ev.type === 'touchstart') {
      lastTouchTapAt = now;
      if(ev.touches && ev.touches.length > 3) return;
    }
    if(ev.type === 'pointerdown' && ev.pointerType === 'touch') {
      if(!activePointers.has(id) && activePointers.size >= 3) return;
      activePointers.add(id);
    }
    const last = pointerTapAt.get(id) || 0;
    if(now - last < 70) return;
    pointerTapAt.set(id, now);
    pressureHitTarget(x, y);
    // OD extra hits and Meth Shard extra hits do NOT apply during BREAK.
    // BREAK hit count is exactly 1 per physical tap — no multipliers from any source.
  };
  const releasePointer = ev => {
    if(ev.pointerId) activePointers.delete(ev.pointerId);
  };
  target.addEventListener('touchstart', hit, {passive:false});
  target.addEventListener('pointerdown', hit);
  target.addEventListener('pointerup', releasePointer);
  target.addEventListener('pointercancel', releasePointer);
  target.addEventListener('lostpointercapture', releasePointer);
  target.addEventListener('click', ev => {
    if(ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return;
    hit(ev);
  });
  overlay.appendChild(target);
  PRESSURE.activeTarget = target;
  if(gameSettings.sfxOn) playAK();
}

function pressureRemoveTarget() {
  if(PRESSURE.activeTarget) { PRESSURE.activeTarget.remove(); PRESSURE.activeTarget = null; }
}

function pressurePauseNormalSpawns() {
  clearTimeout(wpSchedule);
  wpSchedule = null;
  clearTimeout(wpTimeout);
  wpTimeout = null;
  wpActive = false;
  const wp = $('weakPoint');
  if(wp) {
    wp.style.display = 'none';
    wp.classList.remove('wp-vanish');
  }
}

function pressureResumeNormalSpawns() {
  if(!gameRunning || gamePaused || pressureIsBreak()) return;
  if(window._csState && window._csState.cs_rsx0806) return;
  if(!wpActive && !wpSchedule) scheduleWeakPoint();
}

function pressureHitTarget(x, y) {
  if(PRESSURE.phase !== 'break') return;
  PRESSURE.lastAfkAt = Date.now();
  PRESSURE.targetHits++;
  // DETAILED: Analyzed BREAK doubles tap progress.
  if(window._csState && window._csState.cs_detailed && window._csState._analysisBreakActive) PRESSURE.targetHits++;
  // FALLEN WECHAT: Overloaded BREAK adds +25% progress per tap.
  if(window._csState && window._csState.cs_fallenWechat && window._csState._fallenWechatBreakActive) PRESSURE.targetHits += 0.25;
  // GLOOM UNDER SIDE: stack-based BREAK progress (+4% per stack).
  if(window._csState && window._csState.cs_gloomUnderSide && window._csState._gloomStacks) PRESSURE.targetHits += window._csState._gloomStacks * 0.03;
  // GHOSTPING: during BREAK → BREAK gauge +15% per tap
  if(window._csState && window._csState.cs_ghostping) PRESSURE.targetHits += 0.15;
  // cs_breakPower: extra BREAK progress per tap (HYDRA +0.15, CATULLANUX +0.20, stacks)
  const _bpBonus = (window._csState && window._csState.cs_breakPower) || 0;
  if(_bpBonus > 0) PRESSURE.targetHits += _bpBonus;
  // INCANTATION SCAMURAI: contract adds BREAK progress
  if(window._csState && window._csState.cs_incantation && window._csState._incantationContractEndTime && performance.now() < window._csState._incantationContractEndTime) PRESSURE.targetHits += 0.20;
  // EXECUSIONER: +15% BREAK progress when boss/enemy HP < 25%
  if(window._csState && window._csState._executionModeEndTime && performance.now() < window._csState._executionModeEndTime) PRESSURE.targetHits += 0.35;
  if(window._csState && window._csState._turtleShogunEndTime && performance.now() < window._csState._turtleShogunEndTime) PRESSURE.targetHits += 0.25;
  if(window._csState && window._csState._amogSusEndTime && performance.now() < window._csState._amogSusEndTime) PRESSURE.targetHits += 0.60;
  if(window._csState && window._csState._dorkNightStacks) PRESSURE.targetHits += window._csState._dorkNightStacks * 0.04;
  // IFRIED: Inferno Stacks above 5 add extra BREAK progress per tap (+2% per stack above 5)
  if(window._csState && window._csState.cs_ifriedBreak && (window._csState._ifriedStacks || 0) > 5) {
    PRESSURE.targetHits += (window._csState._ifriedStacks - 5) * 0.02;
  }
  // BEELZEBRUH: corruption above 20% adds bonus BREAK progress per tap
  if(window._csState && window._csState.cs_beelzebub && (window._csState._beelzebubBonus || 0) > 0.20) {
    PRESSURE.targetHits += ((window._csState._beelzebubBonus - 0.20) / 0.10) * 0.05;
  }
  // DETAILED: Analyzed BREAK doubles progress per tap
  if(window._csState && window._csState.cs_detailed && window._csState._analysisBreakActive) {
    PRESSURE.targetHits += 1;
  }
  // LORD OF DEBT: ANALYZED state — extra BREAK gauge per tap
  if(window._csState && window._csState.cs_lordofdeath && window._csState._lod_breakGaugeBonus) {
    PRESSURE.targetHits += window._csState._lod_breakGaugeBonus;
  }
  // LORD OF DEBT: FINAL HOUR — extra BREAK power +50%
  if(window._csState && window._csState.cs_lordofdeath && window._csState._lod_breakPowerBonus) {
    PRESSURE.targetHits += window._csState._lod_breakPowerBonus;
  }
  const target = PRESSURE.activeTarget;
  if(target) {
    // Alternate hit/hit2 classes to restart animation without forced reflow
    const useHit2 = target.classList.contains('hit');
    target.classList.remove('hit','hit2');
    target.classList.add(useHit2 ? 'hit2' : 'hit');
    clearTimeout(target._hitTO);
    target._hitTO = setTimeout(()=>target.classList.remove('hit','hit2'), 180);
  }
  const _bp = PRESSURE.targetHits / PRESSURE.targetNeed;
  const impact = _getBreakImpact(_bp >= 0.75);
  impact.style.left = x + 'px'; impact.style.top = y + 'px';
  $('gameRoot').appendChild(impact);
  setTimeout(()=>{ impact.remove(); _retBreakImpact(impact); }, 320);
  spawnBreakFX(x, y, _bp >= 0.5);
  // Throttle shake to max once per 200ms — avoids reflow spam on rapid tapping
  const _sNow = performance.now();
  // per-hit BREAK camera (prio 1) — yield while a climactic shake dominates (one camera language at a time)
  if((!PRESSURE._lastBreakShake || _sNow - PRESSURE._lastBreakShake > 200) && !cameraDominant()) {
    PRESSURE._lastBreakShake = _sNow;
    cameraClaim(1, 320);
    const _gr = $('gameRoot');
    const _useShake2 = _gr.classList.contains('shake-wp');
    _gr.classList.remove('shake-wp','shake-wp2');
    _gr.classList.add(_useShake2 ? 'shake-wp2' : 'shake-wp');
    clearTimeout(PRESSURE._shakeTO);
    PRESSURE._shakeTO = setTimeout(()=>_gr.classList.remove('shake-wp','shake-wp2'), 320);
  }
  if(gameSettings.sfxOn) playAK();
  pressureReactBossAura();
  pressureUpdateBreakHUD();
  if(PRESSURE.targetHits >= PRESSURE.targetNeed) pressureResolve(true);
}

function pressureResolve(success) {
  if(PRESSURE.phase === 'idle') return;
  PRESSURE.resolvePoint = PRESSURE._lastTarget || { x: vvW()/2, y: vvH()*0.42 };
  pressureClearTimers();
  PRESSURE.phase = 'idle';
  if(success) pressureSuccess();
  else pressureFail();
  pressureResumeNormalSpawns();
}

function pressureSuccess() {
  PRESSURE.successes++;
  PRESSURE.successStreak++;
  PRESSURE.bestStreak = Math.max(PRESSURE.bestStreak, PRESSURE.successStreak);
  PRESSURE.failAssist = Math.max(0, (PRESSURE.failAssist || 0) - 1);
  PRESSURE.failStreak = 0;
  const _overloadBonus = (window._csState && window._csState.cs_overloadReduce) || 0;
  const relief = Math.round(pressureRandomRange(12, 18)) + _overloadBonus;
  PRESSURE.rage = Math.max(0, PRESSURE.rage - relief);
  pressureUpdateRageUI();
  _barrierShatter();
  // BREAK SUCCESS camera (prio 2) — short, impactful "crack" shake: harder than a per-hit
  // weak-point nudge (prio 1) but softer than the climactic AK47 BOMB / boss-death shake (prio 3).
  // cameraClaim(2,…) yields to any climactic shake already playing (Boss KO stays untouched) and
  // claims dominance so per-hit shakes yield during its brief window — no stacking within a frame.
  // Reduced-motion / flash-off / flash-low gating is inherited from the .shake-break CSS rules.
  if(cameraClaim(2, 180)) {
    const _gr = $('gameRoot');
    if(_gr && _gr.classList) {
      _gr.classList.remove('shake-break'); void _gr.offsetWidth;
      _gr.classList.add('shake-break');
      clearTimeout(PRESSURE._breakShakeTO);
      PRESSURE._breakShakeTO = setTimeout(()=>_gr.classList.remove('shake-break'), 180);
    }
  }
  pressureHide();
  pressureReleaseBossAura(false);
  pressurePlaySuccessRelease(PRESSURE.resolvePoint);
  playWpBall();
  completeWeakPointRequirementInstant();
  PRESSURE.cooldown = pressureNextCooldown();
  PRESSURE.lastAfkAt = Date.now();
  if(typeof csOnBreakSuccess === 'function') csOnBreakSuccess();
  if(typeof csOnBreakEnd === 'function') csOnBreakEnd();
  // ── Weekly Challenge: per-run BREAK success counter ──
  window._wqRunBreakSuccess = (window._wqRunBreakSuccess || 0) + 1;
  // ── OCA Drop: BREAK success ──
  const _brx = (PRESSURE.resolvePoint && PRESSURE.resolvePoint.x) || vvW() / 2;
  const _bry = (PRESSURE.resolvePoint && PRESSURE.resolvePoint.y) || vvH() * 0.42;
  tryOcaSkillDrop(_brx, _bry);
}



// Pooled crack burst nodes — BREAK phase fires these rapidly; pool avoids createElement storm
const _crackBurstPool = [];
function _getCrackBurst() {
  return _crackBurstPool.pop() || document.createElement('div');
}

function pressureSpawnCrackBurst(point, failed=false) {
  const root = $('gameRoot');
  if(!root) return;
  const cx = point && point.x ? point.x : vvW()/2;
  const cy = point && point.y ? point.y : vvH()*0.42;
  const crack = _getCrackBurst();
  // Reset class/animation before reuse
  crack.className = '';
  crack.style.animation = 'none';
  crack.style.left = cx + 'px';
  crack.style.top = cy + 'px';
  // Alternate suffix forces keyframe restart without reflow
  crack.className = 'break-crack-burst' + (failed ? ' fail' : '') + ' hn-alt';
  root.appendChild(crack);
  const ttl = failed ? 440 : 380;
  setTimeout(()=>{ crack.className=''; crack.style.animation='none'; root.contains(crack) && root.removeChild(crack); _crackBurstPool.length < 4 && _crackBurstPool.push(crack); }, ttl);
}

function pressurePlaySuccessRelease(point) {
  if(PRESSURE._explosionRunning) return;
  PRESSURE._explosionRunning = true;
  const root = $('gameRoot');
  if(!root) { PRESSURE._explosionRunning = false; return; }
  root.classList.remove('pressure-impact-freeze','pressure-success-release');
  void root.offsetWidth;
  root.classList.add('pressure-impact-freeze','pressure-success-release');
  PRESSURE.successFreezeUntil = performance.now() + 320;
  triggerFlash('flash-god');
  const cx = point && point.x ? point.x : vvW()/2;
  const cy = point && point.y ? point.y : vvH()*0.42;
  pressureSpawnCrackBurst(point, false);
  // Pooled break-impact heavy burst — avoids createElement on every BREAK success
  const burst = _biPool.pop() || document.createElement('div');
  burst.className = '';
  burst.style.animation = 'none';
  burst.style.left = cx + 'px'; burst.style.top = cy + 'px';
  burst.className = 'break-impact heavy hn-alt';
  root.appendChild(burst);
  setTimeout(()=>{ burst.className=''; burst.style.animation='none'; root.contains(burst) && root.removeChild(burst); _biPool.push(burst); }, 330);
  // Batch-spawn 3 FX bursts (matching weak-point weight)
  const _bPos=[];
  for(let i=0;i<3;i++) _bPos.push([cx+(Math.random()-.5)*110, cy+(Math.random()-.5)*90]);
  let _bi=0;
  (function _burst(){ const end=Math.min(_bi+2,3); for(;_bi<end;_bi++) spawnFX(_bPos[_bi][0],_bPos[_bi][1],false,true); if(_bi<3) requestAnimationFrame(_burst); })();
  if(gameSettings.sfxOn) playAK();
  setTimeout(()=>{ root.classList.remove('pressure-impact-freeze','pressure-success-release'); PRESSURE._explosionRunning = false; }, 300);
}

function pressureFail() {
  _barrierFail();
  pressureHide();
  pressureReleaseBossAura(true);
  PRESSURE.successStreak = 0;
  PRESSURE.failedBreaks++;
  PRESSURE.failStreak = (PRESSURE.failStreak || 0) + 1;
  PRESSURE.failAssist = Math.min(3, (PRESSURE.failAssist || 0) + 1);
  const rageGain = pressureFailRageGain();
  pressureAddRage(rageGain, 'BREAK FAILED');
  combo = Math.max(1, Math.floor(combo * 0.85));
  lastHitTime = 0;
  pressurePlayFailBacklash(PRESSURE.resolvePoint);
  PRESSURE.cooldown = pressureNextCooldown();
  PRESSURE.lastAfkAt = Date.now();
  if(typeof csOnBreakEnd === 'function') csOnBreakEnd();
}


function pressurePlayFailBacklash(point) {
  if(PRESSURE._explosionRunning) return;
  PRESSURE._explosionRunning = true;
  const root = $('gameRoot');
  if(!root) { PRESSURE._explosionRunning = false; return; }
  const cx = point && point.x ? point.x : vvW()/2;
  const cy = point && point.y ? point.y : vvH()*0.42;
  root.classList.remove('pressure-fail-backlash','shake-wp','shake-wp2');
  void root.offsetWidth;
  root.classList.add('pressure-fail-backlash','shake-wp');
  triggerFlash('flash-boss');
  pressureSpawnCrackBurst(point, true);
  const burst = document.createElement('div');
  burst.className = 'break-impact fail';
  burst.style.left = cx + 'px'; burst.style.top = cy + 'px';
  root.appendChild(burst); setTimeout(()=>burst.remove(), 380);
  // Batch-spawn 2 FX bursts (lightweight, matching weak-point weight)
  const _bPos=[];
  for(let i=0;i<2;i++) _bPos.push([cx+(Math.random()-.5)*110, cy+(Math.random()-.5)*90]);
  let _bi=0;
  (function _burst(){ for(;_bi<2;_bi++) spawnFX(_bPos[_bi][0],_bPos[_bi][1],false,_bi<1,false,2); })();
  if(gameSettings.sfxOn) { playPunch(); playAK(); }
  pressureHeartbeat(190);
  setTimeout(()=>{ root.classList.remove('pressure-fail-backlash','shake-wp','shake-wp2'); PRESSURE._explosionRunning = false; }, 400);
}

function pressureFailRageGain() {
  const streak = Math.max(1, PRESSURE.failStreak || 1);
  if(streak === 1) return Math.round(pressureRandomRange(32, 38));
  if(streak === 2) return Math.round(pressureRandomRange(42, 48));
  return Math.round(pressureRandomRange(56, 64));
}


function pressureOnWeakPointMiss() {
  if(!gameRunning || (typeof pressureIsBreak === 'function' && pressureIsBreak())) return;
  pressureAddRage(Math.round(pressureRandomRange(4, 7)), 'AK MISSED');
}

function pressureOnWeakPointCollect() {
  if(!gameRunning || (typeof pressureIsBreak === 'function' && pressureIsBreak())) return;
  const _overloadBonus = (window._csState && window._csState.cs_overloadReduce) || 0;
  PRESSURE.rage = Math.max(0, PRESSURE.rage - Math.round(pressureRandomRange(3, 5)) - _overloadBonus);
  pressureUpdateRageUI();
}

function pressureAddRage(amount, reason) {
  PRESSURE.rage = Math.min(100, PRESSURE.rage + amount);
  PRESSURE.maxRage = Math.max(PRESSURE.maxRage || 0, PRESSURE.rage);
  pressureUpdateRageUI();
  if(PRESSURE.rage >= 100 && PRESSURE.phase === 'idle') {
    PRESSURE.rage = 100;
    pressureUpdateRageUI();
    if(gameRunning) _triggerRageMaxKO();
  }
}

// RAGE MAX explanation splash — freezes the run immediately (no extra taps/score
// land during it) and shows a brief cause-and-effect beat before the cut to
// GAME OVER, instead of dropping straight to the result screen with no context.
function _triggerRageMaxKO() {
  gameRunning = false;
  INPUT.stop();
  clearInterval(timerInterval);
  clearTimeout(godTimeout);
  clearInterval(godInterval);
  clearTimeout(wpSchedule); clearTimeout(wpTimeout);
  // RAGE MAX used to be all text — no shake, no flash — for a death whose whole
  // point is "the boss became uncontrollable". Reuses the same climactic flash +
  // shake AK47 BOMB / Annihilation use so it hits like a KO, not a fade.
  triggerFlash('flash-boss');
  const _grRageMax = document.getElementById('gameRoot');
  if (_grRageMax && _grRageMax.classList && cameraClaim(3, 500)) {
    _grRageMax.classList.remove('shake'); void _grRageMax.offsetWidth; _grRageMax.classList.add('shake');
    setTimeout(() => { if (_grRageMax && _grRageMax.classList) _grRageMax.classList.remove('shake'); }, 500);
  }
  showBigSplash('RAGE MAX!', 'The boss became uncontrollable.', '#ff2233', true);
  setTimeout(() => endGame({gameOver:true}), 850);
}

function pressureBreakBonusPct() {
  const wins = Math.max(0, PRESSURE.successes || 0);
  if(wins <= 0) return 0;
  if(wins <= 4) return wins * 25;
  return 100 + (wins - 4) * 15;
}

function pressureRewardBonusPct() {
  return pressureBreakBonusPct();
}

function pressureCoinMultiplier() {
  return 1 + pressureBreakBonusPct() / 100;
}

function pressureFinalSummary() {
  return { bonusPct: pressureBreakBonusPct(), successes: PRESSURE.successes || 0 };
}

function pressureOcaTicketChance() {
  const wins = Math.max(0, PRESSURE.successes || 0);
  if(wins <= 0) return 0;
  return Math.min(0.50, wins * 0.05);
}

function pressureTryOcaTicketDrop(x, y) {
  if(Math.random() >= pressureOcaTicketChance()) return false;
  if (!save.ocaTickets) save.ocaTickets = { standard:0, premium:0, elite:0 };
  save.ocaTickets.standard = (save.ocaTickets.standard || 0) + 1;
  markSaveDirty('inventory_changed');
  doSave();
  scheduleCloudSync('inventory_changed');
  showOcaDropFX(x, y, 'standard');
  showOcaDropToast('standard');
  return true;
}

function pressureLootChanceMultiplier() {
  return 1;
}

function pressureUpdateRageUI() {
  const meter = $('rageMeter');
  if(!meter) return;
  meter.classList.toggle('show', gameRunning || PRESSURE.rage > 0);
  $('rageFill').style.width = PRESSURE.rage + '%';
  $('rageNum').textContent = Math.round(PRESSURE.rage) + '%';
  pressureApplyRageClass();
}

function pressureApplyRageClass() {
  const root = $('gameRoot');
  if(!root) return;
  root.classList.remove('rage-mid','rage-high','rage-critical');
  if(PRESSURE.rage >= 90) root.classList.add('rage-critical');
  else if(PRESSURE.rage >= 70) root.classList.add('rage-high');
  else if(PRESSURE.rage >= 40) root.classList.add('rage-mid');
}


function pressureApplyStreakClass() {
  const root = $('gameRoot');
  if(!root) return;
  root.classList.remove('pressure-streak-hot','pressure-streak-insane');
  if((PRESSURE.successes || 0) >= 8) root.classList.add('pressure-streak-insane');
  else if((PRESSURE.successes || 0) >= 5) root.classList.add('pressure-streak-hot');
}

function pressureHeartbeatDelay() {
  return Math.max(320, 560 - PRESSURE.rage * 2.2);
}

function pressureHeartbeat(ms) {
  if(PRESSURE.heartbeat) clearInterval(PRESSURE.heartbeat);
  PRESSURE.heartbeat = setInterval(() => {
    if(!gameRunning || PRESSURE.phase === 'idle') return;
    if(gameSettings.sfxOn) playPunch();
  }, ms);
}

function pressureMuffleAudio(scale) {
  // V7 keeps fight music untouched; heartbeat layers on top instead of muting gameplay audio.
}

function pressureRestoreAudio() {
  PRESSURE.prePressureMusicVolume = null;
}

function pressureIsBreak() { return PRESSURE.phase === 'break'; }


// ══════════════════════════════════════════
// TIMER
// ══════════════════════════════════════════
// อัตราเวลาช้าลงตาม Overdrive level
// Lv0=1.0 (ปกติ), Lv1=0.75, Lv2=0.55, Lv3=0.35
const GOD_TIME_RATE = [1.0, 0.75, 0.55, 0.35];

// Wall-clock baseline for the round timer's setInterval tick — see startTimer().
let _lastTimerTickAt = 0;
function startTimer() {
  clearInterval(timerInterval);
  _lastTimerTickAt = performance.now();
  timerInterval=setInterval(()=>{
    // Measure real elapsed time since the previous tick instead of assuming the
    // nominal 50ms always elapsed. Under GC pauses, heavy VFX, or background-tab
    // timer throttling, ticks can arrive late; the old fixed-0.05s-per-tick math
    // then under-drained timeLeft relative to real wall-clock time, letting a
    // round run longer in real time on exactly the devices struggling the most.
    // Clamped to 200ms (4x nominal) so a single pathological stall can't skip an
    // excessive chunk of round time in one tick — genuinely long gaps already
    // pause the run entirely via the visibilitychange handler before this fires.
    const _now = performance.now();
    const _realDtMs = Math.min(200, Math.max(0, _now - _lastTimerTickAt));
    _lastTimerTickAt = _now;
    pressureUpdate(_realDtMs);
    const baseRate = performance.now() < (PRESSURE.successFreezeUntil || 0) ? 0.18 : (PRESSURE.phase === 'break' ? 0.25 : (GOD_TIME_RATE[godLevel] || 1.0));
    const rate = baseRate * (1 + ((window._csState && window._csState._dorkTimerRateBonus) || 0)
      // DEVILINGO CURSED PANIC: after 15s from run start, timer drains 15% faster (all phases)
      + ((window._csState && window._csState.cs_devilingo && window._csState._devilingoRoundStart && Date.now() - window._csState._devilingoRoundStart > 15000) ? 0.15 : 0)
      // LORD OF DEBT: REQUIEM state — timer drains 30% faster
      + ((window._csState && window._csState.cs_lordofdeath && window._csState._lod_timerDrain) ? window._csState._lod_timerDrain : 0)
    );
    const _timeDelta = (_realDtMs / 1000) * Math.min(1.15, rate);
    timeLeft -= _timeDelta;
    // LORD OF DEBT: FINAL HOUR — prevent timer from increasing (clamp any external additions)
    if(_lodDebtFinalHourLock && window._csState && window._csState.cs_lordofdeath) {
      // FINAL HOUR only blocks increases, not the natural drain (handled by not re-adding)
      // We store last timeLeft so external adds get cancelled on next tick
      if(window._csState._lodFinalHourLastTime !== undefined && timeLeft > window._csState._lodFinalHourLastTime + 0.01) {
        timeLeft = window._csState._lodFinalHourLastTime;
      }
    }
    if(window._csState && window._csState.cs_lordofdeath) {
      window._csState._lodFinalHourLastTime = timeLeft;
    }
    if(window._csState && window._csState._executionModeEndTime && performance.now() < window._csState._executionModeEndTime){
      if(isBoss) bossHP = Math.max(1, bossHP - Math.max(1, bossMaxHP*0.0015));
      else hp = Math.max(1, hp - Math.max(1, maxHP*0.0015));
      updateUI();
    }
    if(timeLeft<=0){timeLeft=0;endGame();}
    renderTimer();
  },50);
}
// FIX 3: cache timer child nodes once; use textContent instead of innerHTML
// to avoid DOM parse + child node churn 20×/sec.
let _timerSecEl = null, _timerMsEl = null, _timerDisplayEl = null, _lastSpurtAuraEl = null;
let _lastTimerSec = -1, _lastTimerMs = '', _lastTimerUrgent = -1;
function _initTimerEls() {
  if (!_timerSecEl) { _timerSecEl = document.getElementById('timerSec'); }
  if (!_timerMsEl)  { _timerMsEl  = document.getElementById('timerMs');  }
  if (!_timerDisplayEl) { _timerDisplayEl = document.getElementById('timerDisplay'); }
  if (!_lastSpurtAuraEl) { _lastSpurtAuraEl = document.getElementById('lastSpurtAura'); }
}
function renderTimer() {
  _initTimerEls();
  const sec = Math.floor(timeLeft);
  const ms  = Math.max(0, Math.floor((timeLeft % 1) * 100));
  if (_lastTimerSec !== sec) {
    _lastTimerSec = sec;
    if (_timerSecEl) _timerSecEl.textContent = String(sec);
  }
  const msText = '.' + String(ms).padStart(2, '0');
  if (_lastTimerMs !== msText) {
    _lastTimerMs = msText;
    if (_timerMsEl) _timerMsEl.textContent = msText;
  }
  // FIX 3b: cache #timerDisplay + only touch classList when the urgent state
  // actually flips (renderTimer runs 20×/sec; toggle+getElementById every tick
  // is wasted work the rest of the round).
  const urgent = timeLeft <= 10 ? 1 : 0;
  if (_lastTimerUrgent !== urgent) {
    _lastTimerUrgent = urgent;
    if (_timerDisplayEl) _timerDisplayEl.classList.toggle('urgent', urgent === 1);
    // LAST SPURT (final 10s) — pure presentation, reuses this same flip-only check:
    // edge vignette + a slight whole-screen saturate bump (same filter knob as OD aura),
    // plus a one-shot cue (existing countdown asset) exactly on the 0→1 transition.
    const gr = document.getElementById('gameRoot');
    if (gr) gr.classList.toggle('last-spurt', urgent === 1);
    if (_lastSpurtAuraEl) _lastSpurtAuraEl.classList.toggle('last-spurt-active', urgent === 1);
    if (urgent === 1) _playSfxEl('countdownSound', 0.6);
  }
}
function endGame(opts = {}) {
  const gameOver = !!(opts && opts.gameOver);
  // OSIRIS: extend time once
  if(!gameOver && csOnTimeUp()) {
    startTimer();
    return;
  }
  INPUT.stop();
  pressureClearTimers();
  pressureHide();
  stopFightBGM();
  clearInterval(timerInterval);
  clearTimeout(godTimeout);
  clearInterval(godInterval);
  clearTimeout(wpSchedule); clearTimeout(wpTimeout);
  wpActive=false; $('weakPoint').style.display='none';
  gameRunning=false;
  _hnReset(); // flush pending hit-number aggregate, hide all pooled nodes
  _csStopAllTimers();
  // Hunter Fly end bonus
  const endBonus = csGetEndBonusCoins();
  if(endBonus > 0) {
    roundCoins += endBonus;
    spawnCoinPopup(endBonus);
  }
  const pressureSummary = pressureFinalSummary();
  // save stats + coins — เฉพาะจบเกมปกติ (ไม่ใช่ quit)
  const prevHS = save.stats.highScore || 0;
  const isNewRecord = score > prevHS;
  save.stats.totalKO=(save.stats.totalKO||0)+ko;
  save.stats.maxCombo=Math.max(save.stats.maxCombo||0,maxCombo);
  save.stats.highScore=Math.max(prevHS,score);
  // ── End-run: roundCoins accumulated per-KO (already scaled at earn time). ──
  // Do NOT apply getZenyKoMultiplier here — that would retroactively reduce Zeny
  // the player already earned this run. Multiplier is applied per-KO only.
  save.coins=(save.coins||0)+roundCoins;
  save.quitPenalty = false;
  save.savedCards = null;
  // FIX: Invalidate pre-run state so next CARD SLOT open generates fresh offers with rerollCount=0.
  // Clearing sessionId causes ensurePreRunCardState() to call resetPreRunCardState() on next open.
  _preRunCardState.sessionId = '';
  _preRunCardState.offers = [];
  if (save) { save.preRunState = null; }
  markSaveDirty('run_complete');
  _showLocalSaveToast = true;  // ← arm: next doSave() will show 'Local Saved' toast
  doSave();
  // Cloud sync fires after Local Saved toast; sequenced in _showResultScreen via autoCloudSave()
  // ── Card Mastery: record this run for the active card (time-up / game over only)
  let _cmNewTier = null;
  if (activeCard && activeCard.id) _cmNewTier = cmRecordRun(activeCard.id);
  tryClaimDailyReward();
  commitWeeklyProgress(); // ── Weekly Challenge: commit run stats once ──
  _csLastCards = null;

  // NEW RECORD EVENT — fire once here (endGame runs once per run) while the game
  // view is still visible, before it gets hidden below. Pure presentation.
  if (isNewRecord) _triggerNewRecordCelebration(score);

  // hide game elements
  $('topUI').style.display='none';
  $('fighter').style.display='none';
  $('tapZone').style.display='none';
  $('streakLabel').style.display='none';
  _el.godLevelWrap.style.display='none';
  _resetOdBadge();
  updateOdScreenAura(0);
  _el.bossBar.style.display='none';
  $('wpCounter').style.display='none';
  $('lodCardDisplay').style.display='none';
  $('rageMeter').classList.remove('show');
  // LAST SPURT: clear so the vignette/saturate filter don't linger under the result screen
  document.getElementById('gameRoot').classList.remove('last-spurt');
  if (_lastSpurtAuraEl) _lastSpurtAuraEl.classList.remove('last-spurt-active');

  function _showResultScreen() {
    const h2 = $('resultScreen').querySelector('h2');
    if(h2) h2.textContent = gameOver ? 'GAME OVER' : '— BATTLE RESULT —';
    $('res-score').textContent = formatNum(score);
    $('coinsEarned').textContent = '+' + formatNum(roundCoins) + ' ZENY';
    $('res-hs-num').textContent = formatNum(save.stats.highScore);
    $('newRecordBanner').style.display = isNewRecord ? 'block' : 'none';
    $('res-highscore').style.color = isNewRecord ? 'var(--gold)' : '#555';
    // Run stats — reuses tracked run counters, no new statistics introduced
    if ($('res-ko'))       $('res-ko').textContent       = formatNum(ko);
    if ($('res-maxcombo')) $('res-maxcombo').textContent = formatNum(maxCombo);
    if ($('res-break'))    $('res-break').textContent    = formatNum(pressureSummary.successes || 0);
    if ($('res-wp'))       $('res-wp').textContent       = formatNum(wpCompletions);
    if ($('res-od'))       $('res-od').textContent       = formatNum(odActivations || 0);

    // ── RUN CARD: render the card used this run ──
    // activeCard is captured at endGame() entry; null if no card was equipped.
    (function _renderRunCard() {
      const block    = $('res-run-card');
      const iconEl   = $('res-run-card-icon');
      const nameEl   = $('res-run-card-name');
      const rarityEl = $('res-run-card-rarity');
      const subEl    = $('res-run-card-sub');
      if (!block) return;

      // Remove old img if present (from a previous run)
      const oldImg = block.querySelector('#res-run-card-img');
      if (oldImg) oldImg.remove();

      // Reset rarity classes
      block.className = '';
      rarityEl.className = '';

      if (!activeCard) {
        // No card equipped
        block.classList.add('no-card');
        iconEl.style.display = 'flex';
        iconEl.textContent = '🃏';
        nameEl.textContent = 'No Card Equipped';
        rarityEl.textContent = '';
        subEl.textContent = '';
        return;
      }

      const card = activeCard;
      const rarity = card.rarity || 'standard';
      block.classList.add('rarity-' + rarity);
      rarityEl.classList.add('rarity-' + rarity);

      // Card image
      if (card.img) {
        const img = document.createElement('img');
        img.id = 'res-run-card-img';
        img.src = card.img;
        img.alt = card.name || '';
        img.decoding = 'async';
        img.onerror = function() { this.style.display = 'none'; iconEl.style.display = 'flex'; };
        iconEl.style.display = 'none';
        block.insertBefore(img, $('res-run-card-text'));
      } else {
        iconEl.style.display = 'flex';
        iconEl.textContent = card.icon || '🃏';
      }

      nameEl.textContent = card.name || '???';
      rarityEl.textContent = (typeof RARITY_LABEL !== 'undefined' && RARITY_LABEL[rarity]) ? RARITY_LABEL[rarity] : rarity.toUpperCase();
      subEl.textContent = '';
    })();

    $('resultScreen').style.display = 'flex';
    // ── reward burst: coin shower เมื่อได้เหรียญ ────────────────────────────
    if (roundCoins > 0 && window.CanvasVFX && window.CanvasVFX.spawnCanvasVfx) {
      setTimeout(function() {
        const el = $('coinsEarned');
        const pos = el ? el.getBoundingClientRect() : null;
        window.CanvasVFX.spawnCanvasVfx('coinBurst', pos
          ? { x: pos.left + pos.width / 2, y: pos.top + pos.height / 2 }
          : {});
      }, 280);
    }
    updateShopCoinUI(); _syncSoundBtns();
    // ── Card Mastery: show evolution reveal if tier changed this run
    if (_cmNewTier) setTimeout(() => cmShowEvolutionReveal(_cmNewTier), 800);
    // ── Auto Cloud Save: fire after screen is rendered, never blocking ──
    // Show pending badge immediately if previous save was not flushed yet
    _acsShowPendingIfNeeded();
    setTimeout(() => { autoCloudSave(); }, 200);
    window.dispatchEvent(new CustomEvent('noctis:first-run-complete'));
  }

  function _proceedToResultScreen() {
    // score >= 10k → ลุ้นการ์ด
    if(score >= 10000) {
      openCardDraw(()=>{ _showResultScreen(); });
    } else {
      _showResultScreen();
    }
  }

  // NEW RECORD: let the celebration beat (freeze/flash/shake/splash) land on the
  // still-visible game view before the result modal (z-index 997) covers it.
  // Non-record runs are completely unaffected — zero added delay.
  if (isNewRecord) {
    setTimeout(_proceedToResultScreen, 650);
  } else {
    _proceedToResultScreen();
  }
}

// ══════════════════════════════════════════
// ══════════════════════════════════════════
// INPUT SYSTEM — Rate Limit + Anti-bot + Buffered Game Loop
// ══════════════════════════════════════════

const INPUT = (() => {
  // ── Constants ──
  const MAX_TOUCHES        = 3;       // max simultaneous fingers
  const MIN_INTERVAL_MS    = 100;     // ~10 taps/s per finger (100ms floor)
  const TOTAL_CAP_PER_SEC  = 35;      // total inputs/s across all fingers
  const BOT_WINDOW_MS      = 1000;    // window to measure rate
  const BOT_RATE_THRESH    = 30;      // inputs/s that triggers bot suspicion
  const BOT_CONSISTENCY_MS = 12;      // stddev < this → perfectly consistent → bot
  const BOT_PENALTY_SCALE  = 0.25;    // scale factor when bot detected (75% ignored)
  const LOOP_MS            = 33;      // ~30fps game loop tick

  // ── State ──
  const fingerTimestamps = new Map(); // touchId → last accepted timestamp
  const recentTimestamps = [];        // rolling window for rate + consistency check
  let   tapBuffer        = [];        // buffered taps to process next tick
  let   botPenalty       = false;     // currently penalised?
  let   botPenaltyUntil  = 0;
  let   loopId           = null;

  // ── Helpers ──
  function stddev(arr) {
    if(arr.length < 3) return 999;
    const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
    return Math.sqrt(arr.map(x=>(x-mean)**2).reduce((a,b)=>a+b,0)/arr.length);
  }

  // Prune finger-timestamp entries the per-finger rate limit no longer needs —
  // Android can hand out ever-increasing touch identifiers across a long/rapid
  // multi-touch session, so without this the Map grows unbounded for the run's
  // duration. Only sweeps once the map gets large; cheap no-op otherwise.
  function _pruneFingers(now) {
    if(fingerTimestamps.size <= 50) return;
    for(const [id, t] of fingerTimestamps) {
      if(now - t > 5000) fingerTimestamps.delete(id);
    }
  }

  function checkBot(now) {
    // trim window
    while(recentTimestamps.length && now - recentTimestamps[0] > BOT_WINDOW_MS)
      recentTimestamps.shift();

    const rate = recentTimestamps.length; // inputs in last 1s
    if(rate < BOT_RATE_THRESH) { botPenalty = false; return false; }

    // compute intervals stddev — perfect bots have near-zero stddev
    const intervals = [];
    for(let i=1;i<recentTimestamps.length;i++)
      intervals.push(recentTimestamps[i]-recentTimestamps[i-1]);
    const sd = stddev(intervals);

    if(sd < BOT_CONSISTENCY_MS) {
      botPenalty = true;
      botPenaltyUntil = now + 500;
      return true;
    }
    botPenalty = false;
    return false;
  }

  function acceptInput(e) {
    if(!gameRunning) return;
    const now = Date.now();
    PRESSURE.lastAfkAt = now;
    if(pressureIsBreak()) return;

    // lift bot penalty if expired
    if(botPenalty && now > botPenaltyUntil) botPenalty = false;

    // record timestamp for rate/consistency tracking
    recentTimestamps.push(now);
    checkBot(now);

    // if bot penalty → accept only BOT_PENALTY_SCALE fraction (probabilistic)
    if(botPenalty && Math.random() > BOT_PENALTY_SCALE) return;

    // total rate cap — drop if over TOTAL_CAP_PER_SEC
    let recentCount = 0;
    for(let i = 0; i < recentTimestamps.length; i++) {
      if(now - recentTimestamps[i] < 1000) recentCount++;
    }
    if(recentCount > TOTAL_CAP_PER_SEC) return;

    // per-finger rate limit
    if(e.identifier !== undefined) {
      const id   = e.identifier;
      const last = fingerTimestamps.get(id) || 0;
      if(now - last < MIN_INTERVAL_MS) return;
      fingerTimestamps.set(id, now);
      _pruneFingers(now);
    }

    tapBuffer.push({ e, now });
  }

  // ── Game Loop ──
  function tick() {
    if(!gameRunning) { loopId = null; return; }
    const batch = tapBuffer.splice(0, tapBuffer.length);
    if(batch.length > 0) {
      // process all game logic per hit
      for(const { e, now } of batch) processHit(e, now);
      // visual/UI refresh ONCE per tick regardless of batch size
      updateUI();
      updateComboUI();
      // flush deferred visuals accumulated during this tick
      _flushTickVisuals();
    }
    loopId = setTimeout(tick, LOOP_MS);
  }

  return {
    start() {
      fingerTimestamps.clear();
      recentTimestamps.length = 0;
      tapBuffer.length = 0;
      botPenalty = false;
      if(!loopId) loopId = setTimeout(tick, LOOP_MS);
    },
    stop()  { clearTimeout(loopId); loopId = null; tapBuffer.length = 0; },
    accept: acceptInput,
  };
})();

// ══════════════════════════════════════════
// TICK VISUAL ACCUMULATOR
// รวม visual effects ต่อ tick แทนต่อ hit — ลด DOM/setTimeout thrashing
// ══════════════════════════════════════════
const _tv = {
  // สะสมค่าต่อ tick
  hitCount:   0,
  lastX:      0,
  lastY:      0,
  lastIsGun:  false,
  lastIsCrit: false,
  lastDmg:    0,
  doRecoil:   false,
  doFlash:    false,
  flashCls:   '',
  doBossHit:  false,
  bossHitCls: '',
  doBoxerImg: false,
  nextImg:    null,
  idleImg:    null,
  hitDur:     250,
  weight:     0,   // strongest normal-hit weight this tick: 0 light · 2 heavy (crit)
  isWp:       false, // winning hit this tick is a Weak-Point collect → skip red debris
                     // (its bespoke cyan pierce owns the read; no competing spark cloud)
};

// ── CONTEXT-DRIVEN IMPACT WEIGHT (deterministic — no RNG) ──
// Impact strength is decided ONLY by gameplay context so players can always read
// WHY a hit looked stronger (skill, not randomness). The escalation a normal tap
// can reach, strongest→weakest: Overdrive state > Critical > Combo milestone >
// normal tap. (BREAK / Boss-Skill / Devil-Tax / Mythic / Weak-Point own their own
// bespoke FX elsewhere and always read above this.)
// _COMBO_MILESTONES: sparse, achievement-feel thresholds (not every 10). NOTE: combo
// hard-caps at 47 (gameplay), so the ideal 50/100/250… log progression is unreachable —
// clamped to the reachable {10, 25, 47}, where 47 = MAX COMBO (a genuine achievement).
// A milestone is now a HUD-ONLY beat (a combo-number bump in updateComboUI) — it spawns
// NO battlefield VFX, so the arena stays quiet between the loud moments.
const _COMBO_MILESTONES = [10, 25, 47];

// ── FREQUENCY GOVERNOR ──
// Min-interval (ms) per strong effect. During sustained fast tapping each one
// "breathes" at most ~Hz cap instead of firing every single tap; debris + the
// boxer sprite-swap still fire every hit so input stays responsive. Casual
// tapping (<~8/s, gap > interval) is unaffected; any idle gap restores every
// effect to full on the next hit (all intervals < 300ms → full recovery ~300ms).
// This reduces FREQUENCY, never strength — strong moments stay strong, just rarer.
const FX_GATE  = { recoil: 95, bossHit: 120, flash: 160 };
const _fxGate  = { recoil: 0,  bossHit: 0,   flash: 0   };

function _tickVisualAccum(x, y, dmg, isGun, isCrit, recoilCls, flashCls, bossHitCls, nextImg, idleImg, hitDur, weight, isWp) {
  const w = weight|0;
  if (_tv.hitCount === 0) _tv.weight = -1;
  _tv.hitCount++;
  // boxer sprite-swap fires every hit (responsive input); the strongest beat in the
  // tick owns the weight + matching recoil/rim class + spawn position so the recoil/rim
  // never mismatch (matters only for multi-touch ticks).
  _tv.doBoxerImg = true; _tv.nextImg = nextImg; _tv.idleImg = idleImg; _tv.hitDur = hitDur;
  if (w < _tv.weight) return;
  _tv.weight = w;
  _tv.lastX = x; _tv.lastY = y;
  _tv.lastIsGun = isGun; _tv.lastIsCrit = isCrit; _tv.lastDmg = dmg;
  _tv.isWp = !!isWp;
  _tv.doRecoil  = true; _tv.recoilCls = recoilCls;
  _tv.doFlash   = true; _tv.flashCls  = flashCls;
  _tv.doBossHit = true; _tv.bossHitCls = bossHitCls;
}

function _flushTickVisuals() {
  if(_tv.hitCount === 0) return;

  // หมายเหตุ: เลขดาเมจ (showHitNum) ถูกยิงต่อ hit ใน processHit (มี aggregation window
  // ของตัวเอง). ส่วน impact FX ย้ายมายิง "ครั้งเดียวต่อ tick" ตรงนี้ และผ่าน frequency
  // governor (FX_GATE) — ตอนแตะรัว effect แรงจะ "หายใจ" แทนที่จะยิงทุกแตะ, แต่ debris
  // กับการสลับรูปบอสยังยิงทุก hit เพื่อให้ feedback ตอบสนองทันที.
  const _t = performance.now();
  const _w = _tv.lastIsGun ? 2 : _tv.weight;  // OD taps keep their full big-moment path

  // No per-hit impact ring in ANY normal combat — including Overdrive. The OD "gun"
  // path no longer spawns a yellow/gold ring; impact is read via boss recoil + rim
  // light + damage number + one tiny dust. (Major events — AK47 Bomb / BREAK / Boss
  // Skills / Devil Tax / Mythic — own their large rings elsewhere.)
  // Weak-Point ticks skip the battlefield debris entirely — the bespoke cyan pierce
  // (showWpHitFX) already fired and must own the read with no competing spark cloud.
  if(!_tv.isWp) spawnFX(_tv.lastX, _tv.lastY, _tv.lastIsGun, false, true, _w);

  // recoil — throttled; LIGHT uses the soft (tiny) recoil, MEDIUM/HEAVY the full one
  if(_tv.doRecoil && _t - _fxGate.recoil >= FX_GATE.recoil) {
    _fxGate.recoil = _t;
    boxer.classList.add(_tv.recoilCls);
    setTimeout(()=>boxer.classList.remove('recoil','recoil-soft','recoil-crit','recoil-god'), 90);
  }

  // flash — throttled; ONLY Overdrive sets a flash class now (normal/crit/combo = '' →
  // skipped). Normal combat never full-screen flashes (FLASH RULE).
  if(_tv.doFlash && _tv.flashCls && _t - _fxGate.flash >= FX_GATE.flash) {
    _fxGate.flash = _t;
    triggerFlash(_tv.flashCls);
  }

  // boss hit rim — throttled; LIGHT taps skip it entirely (silhouette stays clean)
  if(_tv.doBossHit && _tv.bossHitCls && _t - _fxGate.bossHit >= FX_GATE.bossHit) {
    _fxGate.bossHit = _t;
    boxer.classList.remove('boss-hit','boss-hit-crit','boss-hit-god');
    requestAnimationFrame(()=>{ boxer.classList.add(_tv.bossHitCls); });
    setTimeout(()=>boxer.classList.remove('boss-hit','boss-hit-crit','boss-hit-god'), _tv.hitDur > 200 ? 200 : 150);
    _pulseBossSkinAura();
  }

  // boxer image swap — once per tick
  if(_tv.doBoxerImg && _tv.nextImg) {
    clearTimeout(boxer._rt);
    boxerSetImg(_tv.nextImg);
    boxer._rt = setTimeout(()=>{ boxerSetImg(_tv.idleImg || _tv.nextImg); }, _tv.hitDur);
  }

  // updateMultiBadge handled in processHit (cheap)

  // reset accumulator
  _tv.hitCount = 0;
  _tv.isWp = false;
  _tv.doRecoil = _tv.doFlash = _tv.doBossHit = _tv.doBoxerImg = false;
}

// ── Wire up events ──
const wpEl = $('weakPoint');

$('tapZone').addEventListener('touchstart', e => {
  e.preventDefault();
  if(!audioWarmedUp) warmUpAudio();
  // จำกัด simultaneous touches ด้วย e.touches.length (touches ทั้งหมดบนจอ)
  if(e.touches.length > 3) return;
  const touches = [...e.changedTouches].slice(0, 3);
  touches.forEach(t => INPUT.accept(t));
}, { passive: false });

$('tapZone').addEventListener('click', e => {
  if(e.sourceCapabilities && !e.sourceCapabilities.firesTouchEvents) {
    if(!audioWarmedUp) warmUpAudio();
    INPUT.accept(e);
  }
});

wpEl.addEventListener('touchstart', e => {
  e.preventDefault();
  e.stopPropagation();
  if(!audioWarmedUp) warmUpAudio();
  if(e.touches.length > 3) return;
  const touches = [...e.changedTouches].slice(0, 3);
  touches.forEach(t => INPUT.accept(t));
}, { passive: false });

wpEl.addEventListener('click', e => {
  e.stopPropagation();
  if(e.sourceCapabilities && !e.sourceCapabilities.firesTouchEvents) INPUT.accept(e);
});

// ── processHit: the actual game logic (was hit()) ──
function processHit(e, now) {
  const gap = now - lastHitTime;

  // ── WEAK POINT CHECK (ทำก่อน combo เพื่อไม่ให้ WP hit รีเซ็ตคอมโบ) ──
  const rawX = e && e.clientX !== undefined ? e.clientX : e && e.touches ? e.touches[0].clientX : vvW()/2;
  const rawY = e && e.clientY !== undefined ? e.clientY : e && e.touches ? e.touches[0].clientY : vvH()/2;
  const isWpHit = checkWeakPointHit(rawX, rawY);

  // คอมโบ: WP hit ไม่รีเซ็ตคอมโบ (นับเป็น "ตีทัน" เสมอ)
  let _comboInc = (window._csState && window._csState.cs_goblinLeader) ? 2 : 1;
  if(window._csState && window._csState.cs_taoFunka && window._csState._taoFunkFeverEndTime && performance.now() < window._csState._taoFunkFeverEndTime) _comboInc += 1;
  if(window._csState && window._csState.cs_minorageRageRushUntil && performance.now() < window._csState.cs_minorageRageRushUntil) _comboInc += 2;
  // LORD OF DEBT: MASSACRE state — +1 combo per hit
  if(window._csState && window._csState.cs_lordofdeath && window._csState._lod_comboGainBonus) _comboInc += window._csState._lod_comboGainBonus;
  // FABRE/STAINER: extend combo window; STING tradeoff: shorten combo window
  const _comboWindow = 220
    * (1 + (window._csState && window._csState.cs_comboDecaySlow || 0))
    * (1 - (window._csState && window._csState.cs_comboDecayFast || 0))
    * (1 - (window._csState && window._csState._turtleComboDecayFast || 0))
    * (1 - (window._csState && window._csState._taoComboDecayFast || 0))
    * (1 - ((window._csState && window._csState.cs_devilingo && window._csState._devilingoRoundStart && Date.now() - window._csState._devilingoRoundStart > 15000) ? 0.20 : 0))
    // WRONG CARD tradeoff: when DMG bonus is active (time < 15s), combo decays 15% faster
    * (1 - ((window._csState && window._csState._horongDecayActive) ? 0.15 : 0))
    // LORD OF DEBT: DEBT STACK — each stack speeds up combo decay +5%
    * (1 - (_lodDebtStacks * 0.05));
  const _suppressReset = window._csState && (
    (window._csState._whizperComboPauseUntil && performance.now() < window._csState._whizperComboPauseUntil) ||
    window._csState._ktullanuxComboProtect ||
    (window._csState._freeModeEndTime && performance.now() < window._csState._freeModeEndTime) ||
    (window._csState._weebFocusEndTime && performance.now() < window._csState._weebFocusEndTime) ||
    (window._csState.cs_comboNoReset && Math.random() < window._csState.cs_comboNoReset) ||
    // LORD OF DEBT: REQUIEM state — combo cannot decay (suppress reset)
    _lodDebtRequiemActive
  );
  if(isWpHit || gap < _comboWindow) combo = Math.min(combo + _comboInc, 47);
  else if(!_suppressReset) combo = 1;
  // GOBLIN WEEBER: Combo >= 35 → 20% chance free click (re-entrancy guard + 250ms ICD)
  // FIX: Added _goblinFreeClickIcdUntil to prevent cascade bursts at high tap speed
  if(window._csState && window._csState.cs_goblinLeader && combo >= 35
     && !window._csState._goblinFreeClickPending
     && (!window._csState._goblinFreeClickIcdUntil || now >= window._csState._goblinFreeClickIcdUntil)
     && Math.random() < 0.20) {
    window._csState._goblinFreeClickPending = true;
    window._csState._goblinFreeClickIcdUntil = now + 250; // 250ms ICD prevents cascade chains
    const _fakeEvt = { clientX: rawX, clientY: rawY };
    setTimeout(() => {
      if(gameRunning && !gamePaused && window._csState) {
        window._csState._goblinFreeClickPending = false;
        processHit(_fakeEvt, performance.now());
      } else if(window._csState) {
        window._csState._goblinFreeClickPending = false;
      }
    }, 16);
  }
  // Golden Bug: extra +1 combo per click (on top of normal increment)
  if(window._csState && window._csState.cs_goldenbug && (isWpHit || gap < _comboWindow)) {
    combo = Math.min(combo + 1, 47);
  }
  lastHitTime=now;
  if(combo>maxCombo) maxCombo=combo;

  // god bar
  _el.godFill.style.width=(combo/47*100)+'%';
  // ORC HERO: charge x4 — boost fill (base already set above, add 3.0× more to reach ×4 total)
  if(window._csState && window._csState.cs_orchero) {
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.min(100, cur + (combo/47*100)*3.0) + '%';
  }
  // MOONLIGHT FLOWER: OD charge x2
  if(window._csState && window._csState.cs_moonlightflower) {
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.min(100, cur + (combo/47*100)) + '%';
  }
  // VITATA: OD charge x1.3 when combo >= 15
  if(window._csState && window._csState.cs_vitata && combo >= 15 && godLevel === 0) {
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.min(100, cur + (combo/47*100)*0.3) + '%';
  }
  // ELDER WILLOW: OD charge x1.5 when combo >= 25
  if(window._csState && window._csState.cs_elderWillow_active && godLevel === 0
     && !window._csState.cs_goldenbug && !window._csState.cs_rsx0806) {
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.min(100, cur + (combo/47*100)*0.5) + '%';
  }
  // METALLER / THIEF BUG: flat OD charge bonus per click — METALOL gated to combo >= 10
  if(window._csState && window._csState.cs_odChargeBonus && godLevel === 0
     && !window._csState.cs_goldenbug && !window._csState.cs_rsx0806) {
    // cs_metalolComboGate: only apply when combo >= 10 (METALOL nerf — prevents low-combo OD spam)
    const _metalolGated = window._csState.cs_metalolComboGate && combo < 10;
    if(!_metalolGated) {
      const cur = parseFloat(_el.godFill.style.width)||0;
      _el.godFill.style.width = Math.min(100, cur + window._csState.cs_odChargeBonus * 100) + '%';
    }
  }
  if(window._csState && window._csState._freeModeEndTime && performance.now() < window._csState._freeModeEndTime && godLevel === 0) {
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.min(100, cur + 50) + '%';
  }
  if(window._csState && window._csState._weebFocusEndTime && performance.now() < window._csState._weebFocusEndTime && godLevel === 0) {
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.min(100, cur + 35) + '%';
  }
  if(window._csState && window._csState.cs_weebvilDude && window._csState._weebvilOdGainEndTime && performance.now() < window._csState._weebvilOdGainEndTime && godLevel === 0) {
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.min(100, cur + 15) + '%';
  }
  // SAVAGE / TAO GUNKA / GOBLIN LEADER: OD charge penalty (reduce charge rate)
  if(window._csState && window._csState.cs_odChargePenalty && godLevel === 0
     && !window._csState.cs_goldenbug && !window._csState.cs_rsx0806) {
    const base = combo/47*100;
    const penalty = base * window._csState.cs_odChargePenalty;
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.max(0, cur - penalty) + '%';
  }
  // LADY TRAINEE: Spotlight Mode at 10 stacks → +10% OD charge per click
  if(window._csState && window._csState.cs_ladyTrainee && window._csState._ladyTraineeSpotlight
     && godLevel === 0 && !window._csState.cs_goldenbug && !window._csState.cs_rsx0806) {
    const cur = parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width = Math.min(100, cur + 10) + '%';
    if(parseFloat(_el.godFill.style.width) >= 100 && canEnterGod) activateGodLevel(1);
  }
  // GOLDEN BUG / RSX-0806: no OD charge
  if(window._csState && (window._csState.cs_goldenbug || window._csState.cs_rsx0806)) {
    _el.godFill.style.width = '0%';
  }
  if(combo===47&&godLevel===0&&canEnterGod){
    if(!window._csState || (!window._csState.cs_goldenbug && !window._csState.cs_rsx0806))
      activateGodLevel(1);
  }
  // GOLDEN BRUH: Gold Rush at max combo (replaces OD)
  // FIX: Guard against re-trigger while Rush still active (was: CD 10s < Duration 12s → overlap loop)
  if(window._csState && window._csState.cs_goldenbug && combo === 47) {
    const _grNow = performance.now();
    const _rushStillActive = window._csState._goldRushEndTime && _grNow < window._csState._goldRushEndTime;
    const _rushOnCooldown  = window._csState._goldRushCooldownUntil && _grNow < window._csState._goldRushCooldownUntil;
    if(!_rushStillActive && !_rushOnCooldown) {
      window._csState._goldRushEndTime       = _grNow + 12000;
      window._csState._goldRushCooldownUntil = _grNow + 14000; // CD > Duration — no chain overlap
      showBigSplash('GOLD RUSH', 'ZENY x9 — 12s', '#ffcc00', false);
      _cardFx('combo'); // GOLDEN BRUH — gold coin explosion ตอน GOLD RUSH เปิดจริง (cosmetic)
    }
  }
  // MOONLIGHT FLOWER / VITATA / ELDER WILLOW / METALLER / THIEF BUG: ถ้า bar เต็ม 100% ก่อน combo 47 → trigger OD ทันที
  if(godLevel===0 && canEnterGod && window._csState
     && (window._csState.cs_moonlightflower || window._csState.cs_vitata || window._csState.cs_elderWillow_active || window._csState.cs_odChargeBonus)
     && !window._csState.cs_goldenbug && !window._csState.cs_rsx0806) {
    if(parseFloat(_el.godFill.style.width) >= 100) activateGodLevel(1);
  }

  // upgrade overdrive เมื่อตีเร็วพอครบ threshold (ไม่รอเวลาหมด)
  if(godLevel===1||godLevel===2){
    if(gap<_comboWindow){ // ตีเร็วพอ
      godHitCount++;
      const upgradeAt = godLevel===1 ? 30 : 25; // Lv1→2 ต้องตี 30 ครั้ง, Lv2→3 ต้องตี 25 ครั้ง
      if(godHitCount>=upgradeAt){
        activateGodLevel(godLevel+1);
      }
    } else {
      godHitCount=Math.max(0,godHitCount-2); // ตีช้า → หักคืน
    }
  }

  // damage
  let baseDmg = 10;
  if(_sc.desoBns) baseDmg = Math.round(baseDmg*(1+_sc.desoBns));

  let multi=1;
  if(godLevel===0){
    multi=combo>=30?3:combo>=15?2:1;
  } else {
    const gd=GOD_LEVELS[godLevel];
    multi=gd.dmgMult;
    if(_sc.godBns) multi=Math.round(multi*(1+_sc.godBns));
  }

  let dmg=baseDmg*multi;

  // crit (daedalus)
  let isCrit=false;
  // crit chance: base Daedalus + Hornet bonus + Jakk (OD only)
  let _critChance = (_sc.critChance||0);
  if(window._csState) {
    if(window._csState.cs_critChanceBonus) _critChance += window._csState.cs_critChanceBonus;
    // MINORAGE — ORE RAGE: RAGE RUSH crit +25%
    if(window._csState.cs_minorageRageRushUntil && performance.now() < window._csState.cs_minorageRageRushUntil) _critChance += 0.25;
    if(window._csState._weebFocusEndTime && performance.now() < window._csState._weebFocusEndTime) _critChance += 0.20;
    if(window._csState.cs_jakkCrit && godLevel>0) _critChance += 0.20;
    // JACKED: +8% crit during BREAK (even outside OD)
    if(window._csState.cs_jakkCrit && godLevel===0 && typeof pressureIsBreak === 'function' && pressureIsBreak()) _critChance += 0.08;
    // MISSSTRESS: Crit +10% during OD
    if(window._csState.cs_mistress && godLevel > 0) _critChance += 0.10;
    // SOLDIER SKELLYTON: +10% crit for 5s after WP collect
    if(window._csState.cs_skellytonWp && window._csState._skellytonCritEndTime && performance.now() < window._csState._skellytonCritEndTime) _critChance += 0.10;
    // IFRIED: +10% crit during BREAK (legacy bonus kept for feel)
    if(window._csState.cs_ifriedBreak && typeof pressureIsBreak === 'function' && pressureIsBreak()) _critChance += 0.10;
    // IFRIED: Inferno Burst — +25% crit chance during burst window
    if(window._csState.cs_ifriedBreak && window._csState._ifriedBurstEndTime && performance.now() < window._csState._ifriedBurstEndTime) _critChance += 0.25;
    // DETAILED: Critical Analysis — +20% crit chance for 8s
    if(window._csState.cs_detailed && window._csState._analysisCritEndTime && performance.now() < window._csState._analysisCritEndTime) _critChance += 0.25;
    if(window._csState._amogCritEndTime && performance.now() < window._csState._amogCritEndTime) _critChance += 0.20;
    // TAO FUNKA: FUNK FEVER — Crit +20%
    if(window._csState.cs_taoFunka && window._csState._taoFunkFeverEndTime && performance.now() < window._csState._taoFunkFeverEndTime) _critChance += 0.20;
    // LORD OF DEBT: EXECUTION — crit +25% when boss HP <15%
    if(window._csState.cs_lordofdeath && window._csState._lod_execLowHp && isBoss && bossHP < bossMaxHP * 0.15) _critChance += 0.25;
    // LORD OF DEBT: FINAL HOUR — crit +30%
    if(window._csState.cs_lordofdeath && window._csState._lod_critBonus) _critChance += window._csState._lod_critBonus;
  }
  if(_critChance&&Math.random()<_critChance){dmg=Math.round(dmg*(_sc.critMult||2));isCrit=true;}
  // LUNATIC: crit dmg +15%
  if(isCrit && window._csState && window._csState.cs_critDmgBonus) dmg = Math.round(dmg*(1+window._csState.cs_critDmgBonus));
  // JACKED: +15% crit dmg during OD
  if(isCrit && window._csState && window._csState.cs_jakkCrit && godLevel>0) dmg = Math.round(dmg*1.15);
  // DETAILED: Critical Analysis — +25% crit dmg for 8s
  if(isCrit && window._csState && window._csState.cs_detailed && window._csState._analysisCritEndTime && performance.now() < window._csState._analysisCritEndTime) dmg = Math.round(dmg * 1.35);
  // LORD OF DEBT: MASSACRE — crit dmg +45%
  if(isCrit && window._csState && window._csState.cs_lordofdeath && window._csState._lod_critDmgBonus) dmg = Math.round(dmg * (1 + window._csState._lod_critDmgBonus));
  // IFRIED: build Inferno Stack on crit (max 15)
  if(isCrit && window._csState && window._csState.cs_ifriedBreak) {
    window._csState._ifriedStacks = Math.min(15, (window._csState._ifriedStacks || 0) + 1);
    _cardFx('emberhit'); // IFRIED throttled ember on Inferno-stack gain (cosmetic, ติดเฉพาะคริ + throttle)
    // IFRIED lifecycle VFX (cosmetic, real count — bypass throttle so growth always reads):
    // charge ring 0–15 (ready ที่ 10) + aura/world tier ตาม stack จริง → Idle→Growth→Peak-ready.
    try {
      if(window.CardVFX && activeCard && activeCard.id === 'if') {
        const st = window._csState._ifriedStacks;
        window.CardVFX.setCharge('if', st, 15, 10);
        window.CardVFX.setAuraTier('if', Math.min(3, Math.floor(st / 5)));
        if(st >= 10 && !window._csState._ifriedReadyFired) {
          window._csState._ifriedReadyFired = true;
          _cardFx('infernoready'); // crossed peak-ready threshold (cosmetic cue)
        }
      }
    } catch(e){}
  }
  // ATROSUS: crit during Resonance extends window (+0.4s base, +0.6s with Mastery, max +4s total)
  if(isCrit && window._csState && window._csState.cs_atrosusBreak && window._csState._atrosusBreakEndTime && performance.now() < window._csState._atrosusBreakEndTime) {
    const _resExt = window._csState._atrosusResonanceMastery ? 600 : 400;
    if(!window._csState._atrosusResonanceExtension) window._csState._atrosusResonanceExtension = 0;
    if(window._csState._atrosusResonanceExtension < 4000) {
      const _extGain = Math.min(_resExt, 4000 - window._csState._atrosusResonanceExtension);
      window._csState._atrosusResonanceExtension += _extGain;
      window._csState._atrosusBreakEndTime += _extGain;
    }
  }
  // ORC WARRIOR: crit → OD charge
  if(isCrit && window._csState && window._csState.cs_critOdCharge && !window._csState.cs_goldenbug) {
    const cur=parseFloat(_el.godFill.style.width)||0;
    _el.godFill.style.width=Math.min(100,cur+window._csState.cs_critOdCharge*100)+'%';
    if(parseFloat(_el.godFill.style.width)>=100&&canEnterGod&&godLevel===0) activateGodLevel(1);
  }
  // DRUNKULA: 25% proc BLOOD DRINK with 0.8s ICD
  if(isCrit && window._csState && window._csState.cs_drunkula) {
    const _nowDrink = performance.now();
    if((!window._csState._drunkulaIcdUntil || _nowDrink >= window._csState._drunkulaIcdUntil) && Math.random() < 0.25) {
      window._csState._drunkulaIcdUntil = _nowDrink + 800;
      roundCoins += 8;
      spawnCoinPopup(8);
      if(!window._csState.cs_goldenbug) {
        const cur = parseFloat(_el.godFill.style.width)||0;
        _el.godFill.style.width = Math.min(100, cur + 3) + '%';
        if(parseFloat(_el.godFill.style.width) >= 100 && canEnterGod && godLevel === 0) activateGodLevel(1);
      }
    }
  }

  // card damage mods
  dmg = _sanitizeDamage(csApplyDmgMod(dmg, godLevel>0), 'postCardMod');

  // ── INFINITE TAP RAMP ──
  // Only applied to normal taps (including OD taps). WP hits branch separately below
  // so they never touch this block.
  const _now = performance.now();
  if (_now - lastTapTime > 1500) bossTapCount = 0; // idle reset
  lastTapTime = _now;

  // moon shard
  const doubleHit=_sc.dblChance&&Math.random()<_sc.dblChance;

  // call card on-click hook
  csOnClick(godLevel>0);
  if(window._csState && window._csState.cs_aknightExecute && isBoss && !isWpHit) {
    const _cs = window._csState;
    const _now = performance.now();
    const _inBreak = (typeof pressureIsBreak === 'function' && pressureIsBreak());
    if(!_inBreak && _cs._aknightReadyEndTime && _now < _cs._aknightReadyEndTime && bossMaxHP > 0 && (bossHP / bossMaxHP) <= 0.05) {
      const _execCoin = Math.max(1, Math.round(roundCoins * 0.30));
      roundCoins += _execCoin;
      score += 600;
      spawnCoinPopup(_execCoin);
      _cardFx('execute'); // ABYSMELL KNIGHT — dark execute slash
      showBigSplash('EXECUTE', 'BOSS FINISH +30% ZENY', '#ff3355', false);
      _cs._aknightReadyEndTime = 0;
      _cs._aknightReadyCooldownUntil = _now + 12000;
      // FIX: use bossHP+1 instead of magic number — same instant-kill result, future-proof
      const _execFinishDmg = isBoss ? (bossHP + 1) : (hp + 1);
      // EXECUTE is a discrete major event (own EXECUTE splash) — weight 2 keeps the subtle
      // accent ring, unlike normal-combat taps which carry no ring.
      applyDamage(_execFinishDmg, e, false, 2);
      return;
    }
  }

  // ── WEAK POINT APPLY ──
  // rawX/rawY คำนวณไว้แล้วด้านบน
  const pos = getPos(e);
  if(isWpHit){
    // HYDRA: WP dmg x3 | KTULLANUX: WP dmg x4 | default: x2
    let wpMult = 2;
    if(window._csState && window._csState.cs_hydra) wpMult *= (1 + Math.min(3, window._csState._hydraHeads || 0) * 0.20);
    if(window._csState && window._csState.cs_ktullanux) wpMult = 4;
    // THANATOS: WP dmg x2.5 (OD +1s during Thanatos Phase handled in csOnWpHit)
    const thanatosMult = (window._csState && window._csState.cs_thanatos) ? 2.5 : 1;
    const wpDmg = _sanitizeDamage(onWeakPointHit(pos.x, pos.y, baseDmg*multi, wpMult * thanatosMult), 'weakPoint');
    applyDamage(wpDmg, e, false, -1); // -1 = cyan pierce owns the read (no red dust / dup number)
    score += 20;
    csOnWpHit(pos.x, pos.y);
  } else {
    // ── Normal tap — Tap Ramp + batched multi-hit ──
    // One bossTapCount++ per physical tap regardless of hit count.
    // All extra hits (OD / Meth Shard / Baphomet / Doppelganger) are summed into
    // one totalDmg value → one applyBossDamage call → one damage number → one flash.
    // No setTimeout spam, no multiple DOM writes per tap.
    bossTapCount++;
    const _rampBonus = bossTapCount * 0.02; // +2% per tap (50 taps = +100%, 100 = +200%)
    dmg = Math.round(dmg * (1 + _rampBonus));

    // ── Hit count: OD (normal tap only) ──
    // Lv1 = 1 hit, Lv2 = 2 hits, Lv3 = 3 hits. Never applies to BREAK/WP/AK47.
    const _odHits = godLevel >= 3 ? 3 : godLevel >= 2 ? 2 : 1;

    // ── Hit count: Meth Shard (normal tap only) ──
    // doubleHit computed above. Multiplies on top of OD hits.
    const _methHits = (doubleHit && _sc.isTriple) ? 3 : doubleHit ? 2 : 1;

    // ── Total damage: base × (OD hits × Meth hits) ──
    let _totalDmg = _sanitizeDamage(Math.round(dmg * _odHits * _methHits), 'normalTapTotal');

    // ── One damage application, one number, one flash ──
    // Impact FX (particles+ring) is NOT spawned per-hit anymore — it's merged into
    // a single spawn per tick in _flushTickVisuals (density: rapid/multi-touch taps
    // inside one 33ms tick collapse to one weighty impact instead of N overlapping).
    const pos2 = pos; // pos already computed above
    // showHitNum handles crit label internally via pooled _critNodes
    showHitNum(pos2.x, pos2.y, _totalDmg, godLevel > 0, isCrit);
    applyBossDamage(_totalDmg, 'tap');
    if(window._csState && window._csState.cs_doppelShadow) {
      const _shadowBase = Math.round(_totalDmg * (isCrit ? 0.60 : 0.45));
      // FIX: use runtime _critChance (includes AMOG RA, FUNK FEVER, etc.) not raw shop stat
      const _shadowWillCrit = Math.random() < Math.min(1, (_critChance + 0.20));
      const _shadowDmg = _sanitizeDamage(Math.round(_shadowBase * (_shadowWillCrit ? (_sc.critMult||2) : 1)), 'doppelShadow');
      setTimeout(()=>{
        if(!gameRunning || gamePaused) return;
        const _p = pos2;
        showHitNum(_p.x + 24, _p.y - 24, _shadowDmg, godLevel > 0, _shadowWillCrit);
        applyBossDamage(_shadowDmg, 'doppel-shadow');
        _cardFx('hit', { x: _p.x + 24, y: _p.y - 24 }); // DOPPELGANGER mirror slash
      }, 80);
    }
    // LORD OF DEBT: BERSERK state — extra shadow hit 35% DMG, no combo/OD/break/recursive
    if(window._csState && window._csState.cs_lordofdeath && window._csState._lod_berserkShadow) {
      const _bsBase = Math.round(_totalDmg * 0.35);
      const _bsDmg = _sanitizeDamage(_bsBase, 'lod-berserk-shadow');
      setTimeout(()=>{
        if(!gameRunning || gamePaused) return;
        showHitNum(pos2.x - 20, pos2.y - 30, _bsDmg, false, false);
        applyBossDamage(_bsDmg, 'lod-berserk-shadow');
        _cardFx('hit', { x: pos2.x - 20, y: pos2.y - 30 }); // LORD OF DEBT berserk shadow slash
      }, 120);
    }
    // boss phase / KO checks (mirrors applyDamage logic)
    if(isBoss){
      if(bossHP <= bossMaxHP*0.5 && bossPhase === 1){
        bossPhase = 2;
        _triggerBerserkFx();
        showBigSplash('BERSERK!','NOCTIS ENRAGED','#ff4400');
      }
      if(bossHP <= 0) bossKO();
    } else {
      if(window._csState && window._csState.cs_raydric && !window._csState._raydricActive){
        if((hp/maxHP) <= 0.60) window._csState._raydricActive = true;
      }
      if(hp <= 0) normalKO();
    }
  }

  score+=multi+(isCrit?5:0);
  // UI refreshed by game loop tick — only updateMultiBadge per hit (lightweight)
  updateMultiBadge(multi);

  // ── Collect visual params → accumulate for tick flush (1 render per tick) ──
  // MINIMAL-REACTION IMPACT MODEL (deterministic — never RNG). Most hits are quiet;
  // silence is what makes the loud moments land.
  //  • NORMAL hit  → boss movement (recoil-soft) + damage number + one tiny dust. NOTHING
  //                  else: no glow, no rim, no ring, no flash, no sparkle, no HUD reaction.
  //  • CRIT        → all of the above, plus exactly ONE extra signal: the boss rim light
  //                  (boss-hit-crit). No ring, no flash, no spark cloud, no HUD bounce.
  //  • Overdrive   → keeps its own big-moment path (recoil-god / flash / gun FX).
  // Weak-Point hits render LIGHT here — their bespoke cyan pierce (showWpHitFX) owns the
  // read. Combo milestones are HUD-ONLY (a combo bump in updateComboUI) and add ZERO
  // battlefield VFX — the arena stays quiet so the boss/number/weak-point own attention.
  // Weak-Point taps stay LIGHT and rim-less on the battlefield — their cyan pierce owns
  // the read; a WP must never borrow the normal/crit red dust or the boss rim.
  const _weight = isWpHit ? 0 : godLevel>0 ? 2 : isCrit ? 2 : 0;
  // FLASH RULE: normal combat NEVER full-screen flashes. Only Overdrive keeps its flash.
  const _rc   = isWpHit ? 'recoil-soft' : godLevel>0 ? 'recoil-god' : isCrit ? 'recoil-crit' : 'recoil-soft';
  const _fcls = godLevel===3?'flash-god3':godLevel===2?'flash-god2':godLevel===1?'flash-god':'';
  // Crit's single extra signal — the boss rim light. Normal / combo / WP hits get NO rim.
  const _bhc  = isWpHit ? '' : godLevel>0 ? 'boss-hit-god' : isCrit ? 'boss-hit-crit' : '';
  const _skin2 = getActiveSkin();
  const _hitImgs2 = _skin2.files.hits;
  let _ii; do{_ii=Math.floor(Math.random()*_hitImgs2.length);}while(_ii===lastIndex&&_hitImgs2.length>1);
  lastIndex=_ii;
  const _hitDur2 = _skin2.id==='toei' ? (godLevel>0?200:400) : (godLevel>0?120:250);
  _tickVisualAccum(
    pos.x, pos.y, isBoss ? Math.round(bossHP) : dmg,
    godLevel>0, isCrit,
    _rc, _fcls, _bhc,
    _imgObjCache[_hitImgs2[_ii]] || _hitImgs2[_ii],
    _imgObjCache[_skin2.files.idle],
    _hitDur2,
    _weight, isWpHit
  );

  if(godLevel>0) playAK(); else playPunch();
}

// ══════════════════════════════════════════
// DAMAGE
// ══════════════════════════════════════════

// ── Centralized HP mutation — every damage source must call this ──
// FIX 2: updateUI() removed from here. The main tick loop (INPUT.tick) and
// processHit already call updateUI() once per batch — calling it here caused
// a duplicate forced reflow on every single hit.
function applyBossDamage(amount, source) {
  if (isBoss) {
    bossHP = Math.max(0, bossHP - amount);
  } else {
    hp = Math.max(0, hp - amount);
  }
  // updateUI() intentionally removed — rendering handled by tick loop
}

function applyDamage(dmg,e,isCrit,fxWeight) {
  const pos=getPos(e);
  const _fw = fxWeight==null ? 1 : fxWeight;
  // Weak-Point collect passes -1: its bespoke cyan pierce + AK47 popup (showWpHitFX)
  // own the read, so we spawn NO generic red dust and NO duplicate damage number here.
  // Other discrete hits keep the normal one-dust + damage number.
  if(_fw >= 0){
    spawnFX(pos.x,pos.y,godLevel>0,false,false,_fw);
    // showHitNum handles crit label internally via pooled _critNodes
    showHitNum(pos.x,pos.y,dmg,godLevel>0,isCrit);
  }

  // Route through centralized damage function — updates hpFill on every hit
  applyBossDamage(dmg, 'tap');

  if(isBoss){
    if(bossHP<=bossMaxHP*0.5&&bossPhase===1){
      bossPhase=2;
      _triggerBerserkFx();
      showBigSplash('BERSERK!','NOCTIS ENRAGED','#ff4400');
    }
    if(bossHP<=0) bossKO();
  } else {
    // RAYDRIC: activate permanently once enemy HP drops to <= 60%
    if(window._csState && window._csState.cs_raydric && !window._csState._raydricActive) {
      if((hp / maxHP) <= 0.60) window._csState._raydricActive = true;
    }
    if(hp<=0) normalKO();
  }
}

// ══════════════════════════════════════════
// KO & BOSS
// ══════════════════════════════════════════
function normalKO() {
  ko++; waveKO++;
  window._wqRunKO = (window._wqRunKO || 0) + 1; // weekly per-run KO counter
  let baseCoins = Math.round((1 + Math.floor(combo * 0.05)) * (1.25 + (_sc.coinMult||0)));
  // DORK LORD: KO Zeny -15% (documented tradeoff). Turtle Shogun no longer shares this.
  if(window._csState && window._csState.cs_dorkLord) baseCoins = Math.round(baseCoins * 0.85);
  baseCoins = csApplyCoinMod(baseCoins);
  // ── Zeny KO reduction (late-game economy rebalance) ──
  // Applied per-KO at earn time so totalRunZeny is never reduced retroactively.
  baseCoins = Math.round(baseCoins * getZenyKoMultiplier((save && save.stats && save.stats.totalKO) || 0));
  roundCoins+=baseCoins;
  score+=100+combo*8;
  // Moonlight Flower: +500 score per KO
  if(window._csState && window._csState.cs_moonlightflower) score += 500;
  // RSX-0806: +500 score per KO (Pure Execution)
  if(window._csState && window._csState.cs_rsx0806) score += 500;
  hp=maxHP;
  // chip resets instantly on HP restore — no trail on refill
  const _chip = _getHpChip();
  if (_chip) { _chip.style.transition = 'none'; _chip.style.width = '100%'; requestAnimationFrame(()=>{ if(_chip) _chip.style.transition = ''; }); }
  updateUI(); // sync hpFill to 100% immediately after respawn
  showKOFlash(false);
  spawnCoinPopup(baseCoins);
  csOnKO();
  if(waveKO>=10){waveKO=0;spawnBoss();}
}

function spawnBoss() {
  isBoss=true; bossPhase=1;
  // ── Tiered HP scaling based on lifetime KO count ──
  // 0–250 KO: ×1.040 | 251–500: ×1.047 | 501–750: ×1.052 | 751+: ×1.057
  const _lifetimeKO = (save && save.stats && save.stats.totalKO) || 0;
  const _hpMult = _lifetimeKO > 750 ? 1.057 : _lifetimeKO > 500 ? 1.052 : _lifetimeKO > 250 ? 1.047 : 1.040;
  const scale = Math.pow(_hpMult, window._bossesDefeated||0);
  bossMaxHP=Math.round(maxHP*5*scale);
  bossHP=bossMaxHP;
  _el.bossBar.style.display='block';
  updateUI(); // sync hpFill — now isBoss=true so ratio = bossHP/bossMaxHP = 1
  const arr=$('bossArrival');
  if(arr){ $('bossArrivalPhase').textContent='BOSS INCOMING'; arr.className=''; void arr.offsetWidth; arr.className='show'; }
  triggerFlash('flash-boss');
}

function csOnBossKO() {
  if(!window._csState) return;
  const cs = window._csState;
  _cardFx('boss'); // Elite/Mythic VFX: boss flare ตอนล้มบอส (MAYA PROBLEM / DEVILINGO)
  // ABYSMELL KNIGHT: clear transient ready window safely on boss transition
  cs._aknightReadyEndTime = 0;
  cs._mayaBossBreakUsed = false;
  cs._weebvilBossBreakUsed = false;
  // DEVILINGO: reset per-boss timer so each boss fight is judged independently
  if(cs.cs_devilingo) cs._devilingoCombatStart = Date.now();
}

// BERSERK phase-shift feedback (boss crosses the 50% HP threshold) — this used
// to be a text splash only, with zero shake/flash for a real power-spike moment.
// Reuses the existing boss-arrival flash + WP-weight camera shake so it reads as
// a physical event instead of just a label. Cosmetic only — no gameplay change.
function _triggerBerserkFx() {
  triggerFlash('flash-boss');
  if (cameraClaim(2, 300)) {
    const gr = document.getElementById('gameRoot');
    if (gr && gr.classList) {
      gr.classList.remove('shake-wp'); void gr.offsetWidth; gr.classList.add('shake-wp');
      setTimeout(() => { if (gr && gr.classList) gr.classList.remove('shake-wp'); }, 300);
    }
  }
}

function bossKO() {
  csOnBossKO();
  isBoss=false; ko++;
  window._wqRunKO = (window._wqRunKO || 0) + 1; // weekly per-run KO counter
  bossTapCount = 0; lastTapTime = 0; // reset tap ramp on boss KO
  window._bossesDefeated = (window._bossesDefeated||0) + 1;
  let bossCoins=Math.round((8+Math.floor(combo*0.2)) * (1.25 + (_sc.coinMult||0)));
  if(window._csState && window._csState.cs_bossCoinPct) bossCoins = Math.round(bossCoins * (1 + window._csState.cs_bossCoinPct));
  // DEVILINGO: boss defeated within 15s → Boss KO Zeny +30%
  if(window._csState && window._csState.cs_devilingo && window._csState._devilingoCombatStart) {
    if(Date.now() - window._csState._devilingoCombatStart <= 15000) {
      bossCoins = Math.round(bossCoins * 1.30);
    }
  }
  bossCoins = csApplyCoinMod(bossCoins);
  // ── Zeny KO reduction (late-game economy rebalance) ──
  // Applied after all card mods so card bonuses are also scaled down proportionally.
  bossCoins = Math.round(bossCoins * getZenyKoMultiplier((save && save.stats && save.stats.totalKO) || 0));
  roundCoins+=bossCoins;
  score+=500+combo*15;
  // Moonlight Flower: +500 score per KO
  if(window._csState && window._csState.cs_moonlightflower) score += 500;
  // RSX-0806: +500 score per KO (Pure Execution)
  if(window._csState && window._csState.cs_rsx0806) score += 500;
  hp=maxHP; bossHP=0;
  // chip resets instantly on HP restore
  const _chip2 = _getHpChip();
  if (_chip2) { _chip2.style.transition = 'none'; _chip2.style.width = '100%'; requestAnimationFrame(()=>{ if(_chip2) _chip2.style.transition = ''; }); }
  updateUI(); // isBoss is now false — hpFill snaps to 100% for next enemy
  _el.bossBar.style.display='none';
  spawnCoinPopup(bossCoins);
  showBigSplash('BOSS KO','+'+bossCoins+' COIN','#ffcc00');
  showKOFlash(true);
  playWpBall(); // Boss KO had zero SFX despite the heavy visual payoff — reuse the existing "success ding"
  _triggerBossDeathVfx(); // ฉากตายเฉพาะตัวต่อบอส + กล้องประจำบอส (คอสเมติก)
  csOnKO();
}

// ══════════════════════════════════════════
// OVERDRIVE
// ══════════════════════════════════════════
function updateOdScreenAura(level) {
  const aura = $('odScreenAura');
  if(!aura) return;
  const lv = Math.max(0, Math.min(3, Number(level) || 0));
  aura.classList.remove('od-aura-active','od-aura-lv1','od-aura-lv2','od-aura-lv3');
  if(lv > 0) aura.classList.add('od-aura-active', 'od-aura-lv' + lv);
}
// บอสสกิล VFX — ยิงตอน Overdrive (ท่าไม้ตายของบอสที่สวมอยู่). คอสเมติกล้วน:
// ไม่แตะ balance/save/coin — แค่ส่ง id สกินบอส + พิกัด + ระดับ OD ให้เลเยอร์ canvas
// ตัดสินใจหน้าตา/สีเอง. no-op อัตโนมัติเมื่อ canvas ไม่รองรับ/ปิด VFX/reduced-motion.
function _bossSkillCoords() {
  const r = (boxer && boxer.getBoundingClientRect) ? boxer.getBoundingClientRect() : null;
  if (r && r.width) return { x: r.left + r.width / 2, y: r.top + r.height * 0.42 };
  return { x: undefined, y: undefined };
}
function _triggerBossSkillVfx(lv) {
  try {
    const CV = window.CanvasVFX;
    if (!CV || typeof CV.spawnBossSkillVfx !== 'function') return;
    const skinId = getActiveSkinId();
    const c0 = _bossSkillCoords();
    // 1) ANTICIPATION — skill charge telegraph (< 300ms) ก่อนปล่อยท่าไม้ตาย
    if (typeof CV.spawnBossSkillCharge === 'function') CV.spawnBossSkillCharge(skinId, { x: c0.x, y: c0.y, level: lv });
    // 2) RELEASE — หน่วงคอสเมติก ~270ms ให้ charge นำก่อน (ไม่กระทบ logic OD ใด ๆ:
    //    godLevel/ดาเมจ/ดูเรชัน ตั้งไปแล้วใน activateGodLevel — นี่เป็นเลเยอร์ภาพล้วน)
    const _delay = (CV.reducedMotion && CV.reducedMotion()) ? 0 : 270;
    const _fire = () => {
      try {
        const c = _bossSkillCoords(); // คำนวณพิกัดใหม่ตอนยิงจริง (บอสอาจขยับ)
        CV.spawnBossSkillVfx(skinId, { x: c.x, y: c.y, level: lv });
        // เด้งภาพบอสสั้น ๆ ให้ผู้เล่นรู้สึกว่า "สกิลของบอสตัวนี้กำลังทำงาน"
        if (boxer && boxer.classList) {
          boxer.classList.remove('boss-skill-pulse');
          void boxer.offsetWidth;
          boxer.classList.add('boss-skill-pulse');
          setTimeout(() => { if (boxer && boxer.classList) boxer.classList.remove('boss-skill-pulse'); }, 520);
        }
      } catch (e) { /* คอสเมติกต้องไม่ทำเกมพัง */ }
    };
    if (_delay > 0) setTimeout(_fire, _delay); else _fire();
  } catch (e) { /* คอสเมติกต้องไม่ทำเกมพัง */ }
}

// บอส DEATH VFX + camera identity — ยิงครั้งเดียวตอนล้มบอส (climactic, ไม่ spam).
// คอสเมติกล้วน: ไม่แตะ balance/save/coin. กล้องประจำบอสมาจาก CanvasVFX.BOSS_VFX[id].camera
// และ reuse ระบบ screen-shake เดิม (gate ครบทุกโหมด flash) + freeze ใหม่ (hit-stop).
// ── CAMERA IMPULSE ARBITER — one camera language dominates at a time ─────────
// คอสเมติกล้วน (ไม่แตะ logic/balance/save): กันไม่ให้ impulse กล้อง "อ่อน" (เช่น shake-wp
// ตอนต่อย BREAK/WP ที่ยิงถี่) ไปแย่งจังหวะกล้อง "หนัก/climactic" ที่กำลังเล่น (AK47 BOMB,
// boss death). prio สูงกว่าหรือเท่ากัน claim ทับได้; ที่อ่อนกว่าถูกข้ามระหว่างตัวหนัก active.
// (ฟังก์ชัน hoist → เรียกจากจุดที่อยู่ก่อนหน้าในไฟล์ได้). PRIO: 1 = per-hit, 3 = climactic.
let _camDomUntil = 0, _camDomPrio = 0;
function cameraClaim(prio, dur) {
  const now = Date.now();
  if (now < _camDomUntil && prio < _camDomPrio) return false; // ตัวหนักกำลังเล่น → ตัวอ่อนยอม
  _camDomUntil = now + dur; _camDomPrio = prio; return true;
}
function cameraDominant() { return Date.now() < _camDomUntil; }

function _applyBossCamera(cam) {
  const gr = document.getElementById('gameRoot');
  if (!gr || !gr.classList) return;
  let cls, dur;
  if (cam === 'shake')        { cls = 'shake';          dur = 500; }
  else if (cam === 'shakeWp') { cls = 'shake-wp';       dur = 300; }
  else if (cam === 'freeze')  { cls = 'boss-cam-freeze'; dur = 260; }
  else return; // 'none' → ไม่มีกล้อง
  if (!cameraClaim(3, dur)) return; // climactic boss camera — claim dominance (ไม่ให้ทับโดยตัวอ่อน)
  gr.classList.remove(cls); void gr.offsetWidth; gr.classList.add(cls);
  setTimeout(() => { if (gr && gr.classList) gr.classList.remove(cls); }, dur);
}
function _triggerBossDeathVfx() {
  try {
    const CV = window.CanvasVFX;
    const c = _bossSkillCoords();
    const skinId = getActiveSkinId();
    if (CV && typeof CV.spawnBossDeathVfx === 'function') CV.spawnBossDeathVfx(skinId, { x: c.x, y: c.y });
    const meta = (CV && CV.BOSS_VFX) ? CV.BOSS_VFX[skinId] : null;
    _applyBossCamera((meta && meta.camera) || 'shake');
  } catch (e) { /* คอสเมติกต้องไม่ทำเกมพัง */ }
}

// NEW RECORD EVENT — fires once per run (endGame runs once), pure presentation.
// Reuses: _applyBossCamera('freeze') for the hitstop beat, the existing #bombFlash
// gold-flash element (same one AK47 BOMB uses) + #gameRoot.shake for the flash/shake,
// showBigSplash for the splash text, playWpBall for the stinger (same "success ding"
// already reused for Boss KO), and CanvasVFX's existing coinBurst for the gold burst.
function _triggerNewRecordCelebration(finalScore) {
  try {
    _applyBossCamera('freeze');
    setTimeout(() => {
      const bf = $('bombFlash');
      if (bf) { bf.className = ''; void bf.offsetWidth; bf.className = 'boom'; }
      const gr = document.getElementById('gameRoot');
      if (gr && gr.classList) {
        cameraClaim(3, 600);
        gr.classList.remove('shake'); void gr.offsetWidth; gr.classList.add('shake');
        setTimeout(() => { if (gr && gr.classList) gr.classList.remove('shake'); }, 600);
      }
      showBigSplash('NEW RECORD!', formatNum(finalScore) + ' PTS', '#ffcc00', true);
      playWpBall();
      if (window.CanvasVFX && typeof window.CanvasVFX.spawnCanvasVfx === 'function') {
        const el = $('scoreDisplay');
        const pos = el ? el.getBoundingClientRect() : null;
        window.CanvasVFX.spawnCanvasVfx('coinBurst', pos ? { x: pos.left + pos.width / 2, y: pos.top + pos.height / 2 } : {});
      }
    }, 260);
  } catch (e) { /* คอสเมติกต้องไม่ทำเกมพัง */ }
}

// Wall-clock baseline shared by the two godInterval sites (activateGodLevel and
// resumeGame) — only one of the two is ever running at a time, since both
// clearInterval(godInterval) before creating a new one.
let _lastOdTickAt = 0;
function activateGodLevel(lv) {
  // FALLEN WECHAT: intercept Lv1 OD → trigger Overloaded BREAK instead
  if(lv === 1 && window._csState && window._csState.cs_fallenWechat) {
    const _fwcs = window._csState;
    const _now = Date.now();
    if(!pressureIsBreak() && (!_fwcs._fallenWechatCooldownUntil || _now >= _fwcs._fallenWechatCooldownUntil)) {
      _fwcs._fallenWechatBreakActive = true;
      _fwcs._fallenWechatCooldownUntil = _now + 24000; // FIX: was 20000 — description says 24s
      if(_el && _el.godFill) _el.godFill.style.width = '0%';
      showBigSplash('OVERLOADED BREAK', 'OD → BREAK', '#ff2233', false);
      setTimeout(() => {
        if(gameRunning && PRESSURE.phase === 'idle' && window._csState === _fwcs) pressureStartBuildup();
      }, 80);
      return;
    }
  }
  // EDDGA: lock at Lv1 (allow burst Lv2 via _eddgaBurstActive, block Lv3 always)
  if(window._csState && window._csState.cs_eddga && lv > 1) {
    if(lv === 3 || !window._csState._eddgaBurstActive) return;
  }
  godLevel=lv; canEnterGod=(lv<3);
  updateOdScreenAura(godLevel);
  clearTimeout(godTimeout); clearInterval(godInterval);
  gun.style.display=lv>0?'block':'none';
  csOnOdStart();

  const gd=GOD_LEVELS[lv];
  let dur=gd.duration;
  const durBns=_sc.durBns;
  if(durBns) dur+=durBns;
  godSecondsLeft=dur;
  _el.godLevelWrap.style.display='block';
  updateGodLevelUI();
  pulseOdLevel();
  _triggerBossSkillVfx(lv); // บอสสกิล VFX เฉพาะตัว (คอสเมติก)

  if(lv===1){
    odActivations = (odActivations || 0) + 1;
    const sp=$('godSplash');
    sp.classList.remove('showSplash'); void sp.offsetWidth; sp.classList.add('showSplash');
  }
  showBigSplash(
    lv===1?'OVERDRIVE Lv1':lv===2?'OVERDRIVE Lv2':'ANNIHILATION!!!',
    lv===1?'DMG x5':lv===2?'DMG x8':'DMG x12',
    gd.color,
    lv===3 // เฉพาะ Lv3 กลางจอ
  );
  if(lv===3){
    document.getElementById("gameRoot").classList.remove('shake'); void document.getElementById("gameRoot").offsetWidth;
    document.getElementById("gameRoot").classList.add('shake');
    setTimeout(()=>document.getElementById("gameRoot").classList.remove('shake'),500);
  }

  godHitCount=0; // reset hit counter สำหรับ upgrade

  clearInterval(godInterval);
  _lastOdTickAt = performance.now();
  godInterval=setInterval(()=>{
    // Wall-clock elapsed seconds since the previous tick, not an assumed 1.0s —
    // see startTimer()'s _lastTimerTickAt for the same reasoning. Clamped to 2s
    // (2x nominal) so one pathological stall can't wipe out most of a short
    // (as low as 4s at ANNIHILATION MODE) Overdrive window in a single tick.
    const _odNow = performance.now();
    const _odRealDtSec = Math.min(2, Math.max(0, (_odNow - _lastOdTickAt) / 1000));
    _lastOdTickAt = _odNow;
    // LORD OF DEBT: OVERLOAD state — OD drains 1.5x faster
    const _overloadDrain = (window._csState && window._csState.cs_lordofdeath && window._csState._lod_odDrainFast) ? 2 : 1;
    // ORC BADDY tradeoff: OD drains 20% faster during active OD
    const _orcBaddyDrain = (window._csState && window._csState.cs_orcBaddy && window._csState.cs_orcBaddyDrain) ? 1.20 : 1;
    godSecondsLeft -= _overloadDrain * _orcBaddyDrain * _odRealDtSec;
    updateGodLevelUI();
    if(godSecondsLeft<=0){
      clearInterval(godInterval);
      if(godLevel===3) finalAnnihilation();
      else exitGodMode(); // เวลาหมด → ออกเลย ไม่ upgrade อัตโนมัติ
    }
  },1000);
}

function exitGodMode() {
  csOnOdEnd();
  // OD Lv1/Lv2 used to vanish with zero punctuation (Lv3 already gets a loud
  // finalAnnihilation ending) — reuse the same boss-portrait pulse fired at OD
  // activation so the power dropping off reads as a beat, not a silent cut.
  if (boxer && boxer.classList) {
    boxer.classList.remove('boss-skill-pulse');
    void boxer.offsetWidth;
    boxer.classList.add('boss-skill-pulse');
    setTimeout(() => { if (boxer && boxer.classList) boxer.classList.remove('boss-skill-pulse'); }, 520);
  }
  godLevel=0; canEnterGod=false;
  gun.style.display='none';
  combo=1; lastHitTime=0;
  _el.godFill.style.width='0%';
  _el.godLevelWrap.style.display='none';
  _el.godLevelWrap.classList.remove('od-lv1','od-lv2','od-lv3');
  _resetOdBadge();
  updateOdScreenAura(0);
  updateComboUI();
  setTimeout(()=>{canEnterGod=true;},1500);
}

function finalAnnihilation() {
  annihilationCount++;
  // bonus coin จาก annihilation — สำคัญมากแต่ให้ไม่บ่อย
  const bonus=Math.round((8+annihilationCount*4) * (1.25 + (_sc.coinMult||0)));
  roundCoins+=bonus; score+=1000+combo*25;

  document.getElementById("gameRoot").classList.remove('shake'); void document.getElementById("gameRoot").offsetWidth;
  document.getElementById("gameRoot").classList.add('shake');

  const af=$('annihilationFlash');
  af.className=''; void af.offsetWidth; af.className='boom';

  for(let i=0;i<5;i++){
    setTimeout(()=>{spawnFX(Math.random()*vvW(),Math.random()*vvH(),true);},i*80);
  }
  spawnCoinPopup(bonus);
  showBigSplash('ANNIHILATION','+'+bonus+' ZENY','#ffcc00',true);
  setTimeout(()=>{document.getElementById("gameRoot").classList.remove('shake');exitGodMode();},500);
}

// ป้ายเลเวล OD ติดแถบ OD — แหล่งข้อมูลเลเวลที่ชัดเจน (ไม่กำกวม) เพียงจุดเดียว
function _resetOdBadge() {
  if(_el && _el.odLevelBadge) {
    _el.odLevelBadge.classList.remove('is-active','od-level-badge--pulse','od-lv1','od-lv2','od-lv3');
  }
  // เคลียร์อนิเมชัน impact one-shot เผื่อ OD จบกลางทาง
  if(_el && _el.odSweep) _el.odSweep.classList.remove('od-sweep-go');
  if(_el && _el.odLevelUpFlash) _el.odLevelUpFlash.classList.remove('is-flashing');
}

// อิมแพกต์ตอนเข้า/อัปเลเวล OD — เด้งป้ายเลเวล + ป๊อปชื่อโหมด (transform/opacity เท่านั้น)
function pulseOdLevel() {
  if(_el.odLevelBadge){
    _el.odLevelBadge.classList.remove('od-level-badge--pulse');
    void _el.odLevelBadge.offsetWidth;
    _el.odLevelBadge.classList.add('od-level-badge--pulse');
    setTimeout(()=>{ if(_el.odLevelBadge) _el.odLevelBadge.classList.remove('od-level-badge--pulse'); },500);
  }
  if(_el.godLevelName){
    _el.godLevelName.classList.remove('od-levelup');
    void _el.godLevelName.offsetWidth;
    _el.godLevelName.classList.add('od-levelup');
    setTimeout(()=>{ if(_el.godLevelName) _el.godLevelName.classList.remove('od-levelup'); },450);
  }
  // แสงกวาดบนแถบ OD (one-shot)
  if(_el.odSweep){
    _el.odSweep.classList.remove('od-sweep-go');
    void _el.odSweep.offsetWidth;
    _el.odSweep.classList.add('od-sweep-go');
    setTimeout(()=>{ if(_el.odSweep) _el.odSweep.classList.remove('od-sweep-go'); },520);
  }
  // ป้ายแฟลช "OD LEVEL UP" ชั่วคราว (~800ms แล้วถอดคลาส — ไม่ค้างถาวร)
  if(_el.odLevelUpFlash){
    _el.odLevelUpFlash.classList.remove('is-flashing');
    void _el.odLevelUpFlash.offsetWidth;
    _el.odLevelUpFlash.classList.add('is-flashing');
    setTimeout(()=>{ if(_el.odLevelUpFlash) _el.odLevelUpFlash.classList.remove('is-flashing'); },800);
  }
}

function updateGodLevelUI() {
  const gd=GOD_LEVELS[godLevel];
  // เลเวลแสดงที่ป้ายติดแถบ OD (#odLevelBadge) — ชัดเจน ไม่ลอยกลางจอ
  if(_el.odLevelBadge){
    _el.odLevelBadge.textContent = godLevel >= 3 ? 'OD MAX' : 'OD Lv.'+godLevel;
    _el.odLevelBadge.classList.remove('od-lv1','od-lv2','od-lv3');
    if(godLevel>0){
      _el.odLevelBadge.classList.add('is-active','od-lv'+Math.min(godLevel,3));
    } else {
      _el.odLevelBadge.classList.remove('is-active');
    }
  }
  // ป้ายลอย = ชื่อโหมด + เวลา (ไม่ใช่เลขเลเวลกำกวมอีกต่อไป)
  _el.godLevelName.textContent = gd.name;
  _el.godLevelName.style.color = gd.color;
  _el.godTimer2.textContent = godSecondsLeft>0 ? godSecondsLeft.toFixed(1)+'s' : '';
  _el.godLevelWrap.classList.remove('od-lv1','od-lv2','od-lv3');
  if(godLevel>0) _el.godLevelWrap.classList.add('od-lv'+Math.min(godLevel,3));
  updateOdScreenAura(godLevel);
}

// ══════════════════════════════════════════
// UI UPDATE
// ══════════════════════════════════════════
let _lastHpTier = -1; // track tier เพื่อไม่ set background ซ้ำทุก hit
let _hpHitFlip  = false; // FIX 1: alternates between hp-hit-a and hp-hit-b, no reflow needed
let _lastOdChargingState = null; // FIX 5: skip classList.toggle when OD charging state unchanged
let _hpChipEl   = null; // cached once after DOM ready
function _getHpChip() { return _hpChipEl || (_hpChipEl = document.getElementById('hpChip')); }
function _resetHpTier() { _lastHpTier = -1; _hpHitFlip = false; _lastOdChargingState = null; }
function updateUI() {
  const ratio = isBoss ? (bossHP / bossMaxHP) : (hp / maxHP);
  const pct   = ratio * 100;
  _el.hpFill.style.width = pct + '%';

  // chip bar — only ever shrinks; transition handles the delay visually
  const chip = _getHpChip();
  if (chip) {
    const chipNow = parseFloat(chip.style.width);
    if (isNaN(chipNow) || pct < chipNow) chip.style.width = pct + '%';
  }

  // HP hit flash — intensity scales with tap ramp (base 2.2, +0.015 per tap, cap 4.5)
  // FIX 1: no offsetWidth reflow — alternate between hp-hit-a and hp-hit-b to restart animation
  const _flashBright = Math.min(4.5, 2.2 + bossTapCount * 0.015);
  _el.hpFill.style.setProperty('--ramp-flash', _flashBright);
  _hpHitFlip = !_hpHitFlip;
  _el.hpFill.classList.remove(_hpHitFlip ? 'hp-hit-b' : 'hp-hit-a');
  _el.hpFill.classList.add(_hpHitFlip ? 'hp-hit-a' : 'hp-hit-b');

  // OD charging glow — on while bar has charge but OD not active
  // FIX 5: only write classList when the state actually changes
  const odPct = parseFloat(_el.godFill.style.width) || 0;
  const _shouldOdCharge = typeof godLevel !== 'undefined' && godLevel === 0 && odPct > 1;
  if (_shouldOdCharge !== _lastOdChargingState) {
    _lastOdChargingState = _shouldOdCharge;
    _el.godFill.classList.toggle('od-charging', _shouldOdCharge);
  }

  const tier = ratio > 0.5 ? 2 : ratio > 0.25 ? 1 : 0;
  if (tier !== _lastHpTier) {
    _lastHpTier = tier;
    _el.hpFill.style.background = tier === 2
      ? 'linear-gradient(90deg,#cc0018,#ff1e30,#ff3040)'
      : tier === 1 ? 'linear-gradient(90deg,#882200,#cc4400,#ff6000)'
      : 'linear-gradient(90deg,#551100,#882200,#bb3300)';
  }
  _el.koNum.textContent   = ko;
  _el.scoreNum.textContent = score;
  // BAPHOBET DEVIL TAX: while the coins are being vacuumed, show the rapid drain
  // (display-only override; roundCoins itself is deducted on impact).
  _el.coinNum.textContent  = (window._baphTaxDrain != null) ? window._baphTaxDrain : roundCoins;
  // ── HUD RESTRAINT: the score and coin numbers NO LONGER bounce. ──
  // Score flowed up every hit → a constant per-frame HUD punch that made the screen
  // never rest; coin gains already have their own flying +C popups. Both scale-punches
  // are removed so the HUD stays quiet during sustained combat. Only the KO counter
  // keeps a discrete bump — a genuine "you killed something" beat, not per-frame noise.
  // (Big reward moments — BREAK / Boss KO / Devil Tax / Legendary / Gold Rush — carry
  // their own splashes/popups elsewhere.)
  if (ko > _koPrev) { _hudPop(_el.koNum, (_koPopFlip = !_koPopFlip)); }
  _koPrev = ko;
}
// HUD reward bounce helper — restart transform punch โดยสลับ a/b class (ไม่มี reflow read)
let _koPrev = 0;
let _koPopFlip = false;
function _hudPop(el, flip) {
  if (!el || !el.classList) return;
  el.classList.remove(flip ? 'hud-pop-b' : 'hud-pop-a');
  el.classList.add(flip ? 'hud-pop-a' : 'hud-pop-b');
}
function updateComboUI() {
  _el.bigCombo.textContent = combo;
  const w = _el.comboWrap;
  w.classList.remove('combo-hot','combo-max');
  if(combo>=30) w.classList.add('combo-hot');
  if(combo>=47) w.classList.add('combo-max');
  // ── COMBO BOUNCE: HUD-only milestone beat (transform-only, flip restart) ──
  // The combo number no longer bounces every hit (that made the HUD never rest during
  // sustained tapping). It punches ONLY when combo crosses a milestone {10, 25, 47} —
  // a rare, earned beat. Text still updates every hit; only the scale-punch is gated.
  if (combo > _comboPrev && _COMBO_MILESTONES.indexOf(combo) !== -1) {
    _comboPopFlip = !_comboPopFlip;
    w.classList.remove(_comboPopFlip ? 'combo-pop-b' : 'combo-pop-a');
    w.classList.add(_comboPopFlip ? 'combo-pop-a' : 'combo-pop-b');
  }
  _comboPrev = combo;
}
let _comboPopFlip = false, _comboPrev = 0;
function updateMultiBadge(multi) {
  const b = _el.multiBadge;
  if(multi>1){ b.classList.add('show'); _el.multiNum.textContent='x'+multi; }
  else b.classList.remove('show');
}

// ══════════════════════════════════════════════════════════════════════
// HIT NUMBER POOL — Performance Patch
// ──────────────────────────────────────────────────────────────────────
// Bounded pool of pre-created DOM nodes reused in round-robin order.
// Hard cap on simultaneous visible nodes. Aggregation for rapid hits.
// Zero createElement during gameplay. No layout reads. Transform+opacity only.
// ══════════════════════════════════════════════════════════════════════

const HIT_NUM_POOL_SIZE = 36;   // total nodes pre-created
const HIT_NUM_ACTIVE_CAP = 20;  // max nodes visible at once (hard cap)
const HIT_NUM_AGG_WINDOW = 140; // ms — hits within this window aggregate visually
                                // (widened 90→140: merges more aggressively during
                                //  sustained tapping — one rising number, not a stream)
const HIT_NUM_REDUCE_CAP = 10;  // max visible nodes in reduce-flash mode

// Pre-create pool nodes (once, at parse time — no createElement during gameplay)
const _hnNodes = [];
let _hnIdx = 0;          // round-robin cursor
let _hnActive = 0;       // count of currently visible nodes

// Aggregation state
let _hnAggTimer = 0;     // setTimeout id
let _hnAggDmg = 0;       // accumulated damage for pending aggregate
let _hnAggCount = 0;     // hit count for pending aggregate
let _hnAggX = 0;
let _hnAggY = 0;
let _hnAggIsGun = false;
let _hnAggIsCrit = false;

// Crit-text pool (separate, smaller — crits are rarer)
const CRIT_POOL_SIZE = 8;
const _critNodes = [];
let _critIdx = 0;
let _critActive = 0;

function _hnPrewarm() {
  const root = document.getElementById('gameRoot');
  if (!root) return;
  _hnRoot = root; // cache immediately — no getElementById in hot path
  for (let i = 0; i < HIT_NUM_POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.style.cssText = 'display:none;';
    root.appendChild(el);
    _hnNodes.push(el);
  }
  for (let i = 0; i < CRIT_POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.style.display = 'none';
    root.appendChild(el);
    _critNodes.push(el);
  }
  // Pre-fill allied pools (KO flash, AK47 text, crack burst)
  for (let i = 0; i < 2; i++) {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;font-family:\'Oswald\',sans-serif;pointer-events:none;z-index:40;';
    _koFlashPool.push(el);
  }
  for (let i = 0; i < 2; i++) {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;top:28%;left:50%;transform:translate(-50%,-50%);font-family:\'Oswald\',sans-serif;font-size:clamp(14px,4vw,22px);color:#ff2233;text-align:center;pointer-events:none;z-index:40;text-shadow:0 0 12px #ff0000;';
    el.innerHTML = 'X MISS — AK47 RESET';
    _wpMissPool.push(el);
  }
  for (let i = 0; i < 2; i++) {
    const el = document.createElement('div');
    _wpHitPool.push(el);
  }
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div');
    _crackBurstPool.push(el);
  }
}

// Prewarm after gameRoot is available (called from initState)
function _hnEnsurePrewarm() {
  if (_hnNodes.length === 0) _hnPrewarm();
}

// Recycle a node back to idle state
function _hnRecycle(node) {
  node.style.display = 'none';
  node.className = '';
  if (_hnActive > 0) _hnActive--;
}
function _critRecycle(node) {
  node.style.display = 'none';
  node.className = '';
  if (_critActive > 0) _critActive--;
}

// Acquire the next round-robin node (displaces whatever was there)
function _hnAcquire() {
  const node = _hnNodes[_hnIdx];
  _hnIdx = (_hnIdx + 1) % HIT_NUM_POOL_SIZE;
  // If it was visible, recycle it first (hard cap: evict oldest)
  if (node.style.display !== 'none') {
    if (_hnActive > 0) _hnActive--;
  }
  return node;
}
function _critAcquire() {
  const node = _critNodes[_critIdx];
  _critIdx = (_critIdx + 1) % CRIT_POOL_SIZE;
  if (node.style.display !== 'none') {
    if (_critActive > 0) _critActive--;
  }
  return node;
}

// Actual DOM update — uses only className + style.cssText (no layout reads)
// Animation restart trick: clear class → rAF → set class. Avoids offsetWidth reflow.
// Uses _hnAltBit to alternate between twin CSS classes that share identical keyframes
// so the browser always sees a *new* class name and restarts the animation.
let _hnAltBit = 0;
function _hnShow(el, x, y, text, cls, color, fontSize, lifetime) {
  // small random offset so stacked hits don't overlap perfectly
  const ox = (Math.random() - 0.5) * 24;
  const oy = (Math.random() - 0.5) * 16;
  // Reset to bare state first so animation restarts cleanly
  el.className = '';
  el.textContent = text;
  el.style.cssText =
    `display:block;left:${x - 20 + ox}px;top:${y - 20 + oy}px;` +
    `font-size:${fontSize};color:${color};`;
  // Alternate suffix forces browser to re-apply animation even for same logical class
  const suffix = (_hnAltBit ^= 1) ? ' hn-alt' : '';
  el.className = cls + suffix;
  _hnActive++;
  const _snap = el;
  setTimeout(() => _hnRecycle(_snap), lifetime);
}

let _critAltBit = 0;
function _critShow(el, x, y, lifetime) {
  el.className = '';
  el.textContent = 'CRITICAL!';
  el.style.cssText =
    `display:block;left:${x - 40}px;top:${y - 40}px;`;
  el.className = 'crit-label' + ((_critAltBit ^= 1) ? ' hn-alt' : '');
  _critActive++;
  const _snap = el;
  setTimeout(() => _critRecycle(_snap), lifetime);
}

// Active-cap check — returns true if we can show another number
function _hnCanShow() {
  const cap = document.body.classList.contains('reduce-flash')
    ? HIT_NUM_REDUCE_CAP : HIT_NUM_ACTIVE_CAP;
  return _hnActive < cap;
}

// Core display function — called by aggregation flush and direct callers
// _hnRoot is cached after prewarm — no getElementById in hot path
let _hnRoot = null;
function _hnDisplayNow(x, y, dmg, hitCount, isGun, isCrit) {
  if (!_hnCanShow()) return; // hard cap: skip if too many active

  // Make sure pool exists (first call after game start)
  _hnEnsurePrewarm();
  if (!_hnRoot) _hnRoot = document.getElementById('gameRoot');
  if (!_hnRoot) return;

  const reduceFlash = document.body.classList.contains('reduce-flash');
  const lifetime    = reduceFlash ? 380 : (hitCount > 1 ? 680 : 580);

  // Choose visual style
  let cls, fontSize, color;
  if (hitCount > 1) {
    // Aggregated: show total + count
    cls      = 'hit-num-agg';
    fontSize = isCrit ? '26px' : isGun ? '24px' : '22px';
    color    = isCrit ? '#ff4444' : isGun ? getGodColor() : '#ffcc00';
  } else if (isGun) {
    cls      = 'hit-num-od';
    fontSize = isCrit ? '28px' : '24px';
    color    = isCrit ? '#ff4444' : getGodColor();
  } else {
    cls      = 'hit-num';
    fontSize = isCrit ? '28px' : '17px';
    color    = isCrit ? '#ff4444' : '#ffcc00';
  }

  const el = _hnAcquire();
  const text = hitCount > 1 ? `${dmg}\nx${hitCount}` : `${dmg}`;
  _hnShow(el, x, y, text, cls, color, fontSize, lifetime);

  // Crit label — only for single crits (aggregate already shows bigger number)
  if (isCrit && hitCount === 1 && _critActive < CRIT_POOL_SIZE) {
    const ce = _critAcquire();
    _critShow(ce, x, y, reduceFlash ? 440 : 700);
  }
}

// Aggregation flush — called when AGG_WINDOW expires
function _hnFlushAgg() {
  _hnAggTimer = 0;
  if (_hnAggCount === 0) return;
  const dmg   = _hnAggDmg;
  const count = _hnAggCount;
  const x     = _hnAggX;
  const y     = _hnAggY;
  const isGun = _hnAggIsGun;
  const isCrit = _hnAggIsCrit;
  // Reset
  _hnAggDmg = 0; _hnAggCount = 0;
  _hnAggIsGun = false; _hnAggIsCrit = false;
  _hnDisplayNow(x, y, dmg, count, isGun, isCrit);
}

// Public entry point — replaces old showHitNum.
// All callers pass the same signature: showHitNum(x, y, dmg, isGun, isCrit)
// VISUAL ONLY — no damage/KO/economy logic here.
function showHitNum(x, y, dmg, isGun, isCrit) {
  // Accumulate into aggregation window
  _hnAggDmg   += dmg;
  _hnAggCount += 1;
  _hnAggX      = x;   // use latest position (closest to actual impact)
  _hnAggY      = y;
  _hnAggIsGun  = _hnAggIsGun  || isGun;
  _hnAggIsCrit = _hnAggIsCrit || isCrit;

  if (_hnAggTimer) {
    // Already pending — just accumulate, don't reset timer
    // (flush fires at the end of the original window)
    return;
  }
  // Start aggregation window
  _hnAggTimer = setTimeout(_hnFlushAgg, HIT_NUM_AGG_WINDOW);
}

// Reset aggregation state on game start/end (prevents stale data across runs)
function _hnReset() {
  if (_hnAggTimer) { clearTimeout(_hnAggTimer); _hnAggTimer = 0; }
  _hnAggDmg = 0; _hnAggCount = 0;
  _hnActive  = 0; _critActive = 0;
  _hnRoot = null; // will re-cache on next hit (safe: gameRoot may re-render between runs)
  // Hide all pooled nodes
  for (const n of _hnNodes)  { n.style.display = 'none'; n.className = ''; }
  for (const n of _critNodes) { n.style.display = 'none'; n.className = ''; }
}

function getGodColor(){return godLevel===3?'#ff2233':godLevel===2?'#4488ff':'#00ffee';}

// ── Elite/Mythic card VFX bridge (cosmetic only — src/cardVfx.js) ──
// ส่ง event ของ mechanic ที่ยิงจริงไปให้ layer ภาพ. ไม่แตะ logic การ์ด/บาลานซ์
// และ safe no-op ถ้า module ยังไม่โหลด / ไม่มีการ์ด active.
function _cardFx(context, ctx){
  try {
    if (window.CardVFX && typeof activeCard !== 'undefined' && activeCard)
      window.CardVFX.trigger(activeCard.id, context, ctx);
  } catch(e){}
}

// ══════════════════════════════════════════
// FX & PARTICLES
// ══════════════════════════════════════════
const _pPool=[], _rPool=[], _biPool=[];
function _getParticle(){
  const p=_pPool.pop()||document.createElement('div');
  p.className='particle'; return p;
}
function _getRing(){
  const r=_rPool.pop()||document.createElement('div');
  r.className='impact'; return r;
}
function _retParticle(p){ p.style.animation='none'; _pPool.push(p); }
function _retRing(r){ r.style.animation='none'; _rPool.push(r); }
function _getBreakImpact(heavy){
  const el=_biPool.pop()||document.createElement('div');
  el.className='break-impact'+(heavy?' heavy':'');
  return el;
}
function _retBreakImpact(el){ el.style.animation='none'; el.className='break-impact'; _biPool.push(el); }

function spawnFX(x,y,isGun,isBomb,skipRing,weight){
  // skipRing: frequency governor may suppress the impact ring on a throttled tick
  // while debris still spawns (ring should not appear every hit during fast tapping).
  // Direct callers (AK47 bomb, etc.) omit it → ring fires as before.
  // ── NORMAL COMBAT — the quietest possible hit ─────────────────────────────
  // Every non-OD / non-bomb tap (normal, crit, combo milestone) spawns EXACTLY ONE
  // tiny red dust mote — and nothing else. No ring, no warm "energy" spark, no debris
  // escalation. Impact is read via boss movement (recoil) + the damage number; CRIT
  // adds only the boss rim light (set in processHit), never an extra battlefield
  // particle. One node, one timeout — the cheapest possible per-hit FX. Large rings /
  // spark bursts stay reserved for BREAK / Boss Skills / Devil Tax / Mythic / Overdrive.
  if(!isGun && !isBomb){
    const p=_getParticle();
    const ang=Math.random()*Math.PI*2;
    const dist=20+Math.random()*20;
    const sz=3+Math.random()*1.2;                    // tiny dust — same for normal & crit
    const life=0.15+Math.random()*0.05;              // fades fast (calm screen)
    p.style.cssText=`left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;background:#ff3344;--dx:${Math.cos(ang)*dist}px;--dy:${Math.sin(ang)*dist}px;animation:particle ${life}s forwards;`;
    fx.appendChild(p);
    setTimeout(()=>{ p.remove(); _retParticle(p); },300);
    return;
  }
  // ── GUN (OD) / BOMB (AK47) — big moments, unchanged ──
  const count=isBomb?3:isGun?5:3; // ลด particle count — เพียงพอสายตาเห็น ไม่ทำ DOM หนัก
  const color=isGun?getGodColor():'#ff3344';
  const frag=document.createDocumentFragment();
  for(let i=0;i<count;i++){
    const p=_getParticle();
    p.style.cssText=`left:${x}px;top:${y}px;width:${isGun?4:5}px;height:${isGun?4:5}px;background:${color};--dx:${Math.cos((i/count)*Math.PI*2)*(30+Math.random()*50)}px;--dy:${Math.sin((i/count)*Math.PI*2)*(30+Math.random()*50)}px;animation:particle ${0.22+Math.random()*0.1}s forwards;`;
    frag.appendChild(p);
    setTimeout(()=>{ p.remove(); _retParticle(p); },320);
  }
  // Impact ring is reserved for the AK47 BOMB climax only (isBomb). The OD "gun" path
  // (normal taps during Overdrive) NO LONGER spawns any ring — no yellow/gold impact
  // ring, halo, pulse or shockwave. During Overdrive, hit feedback is read via boss
  // recoil + rim light + damage number + tiny dust only; large rings stay reserved for
  // AK47 Bomb / BREAK / Boss Skills / Devil Tax / Mythic. (Non-OD combat never reached
  // here — it early-returns above.)
  if(!skipRing && isBomb){
    const ring=_getRing();
    ring.style.cssText=`left:${x}px;top:${y}px;border-color:${isGun?getGodColor():'rgba(255,206,168,0.85)'};animation:impact 0.22s forwards;`;
    frag.appendChild(ring);
    setTimeout(()=>{ ring.remove(); _retRing(ring); },220);
  }
  fx.appendChild(frag);
}

function spawnBreakFX(x,y,heavy){
  const count=heavy?2:1;
  const color=getGodColor();
  const frag=document.createDocumentFragment();
  for(let i=0;i<count;i++){
    const p=_getParticle();
    const angle=(i/count)*Math.PI*2;
    p.style.cssText=`left:${x}px;top:${y}px;width:3px;height:3px;background:${color};--dx:${Math.cos(angle)*(20+Math.random()*28)}px;--dy:${Math.sin(angle)*(20+Math.random()*28)}px;animation:particle ${0.18+Math.random()*0.07}s forwards;`;
    frag.appendChild(p);
    setTimeout(()=>{ p.remove(); _retParticle(p); },260);
  }
  fx.appendChild(frag);
}
function triggerFlash(cls){
  flash.className='';
  requestAnimationFrame(()=>{ flash.className=cls; });
}
// Pooled KO flash nodes — 2 slots (boss KO and regular KO rarely overlap)
const _koFlashPool = [];
function showKOFlash(isBossKO){
  const root = _hnRoot || document.getElementById('gameRoot');
  if (!root) return;
  const el = _koFlashPool.pop() || document.createElement('div');
  el.className = '';
  el.style.cssText =`position:absolute;top:14%;right:16px;font-family:'Oswald',sans-serif;font-size:clamp(28px,8vw,48px);color:${Math.random()>0.5?'#ffcc00':'#ff2233'};z-index:40;pointer-events:none;text-shadow:0 0 20px currentColor;`;
  el.textContent = isBossKO?'BOSS KO!':'KO!';
  // animation restart without reflow
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = 'floatUp 0.7s forwards'; });
  root.appendChild(el);
  setTimeout(()=>{ el.style.animation='none'; root.contains(el) && root.removeChild(el); _koFlashPool.length < 2 && _koFlashPool.push(el); }, 780);
}
// FIX 4: DOM pool for coin popups — reuse nodes instead of creating a new div
// every AK47 bomb, BREAK, boss KO, and annihilation call.
const _coinPopupPool = [];
function spawnCoinPopup(amount){
  const el = _coinPopupPool.pop() || document.createElement('div');
  el.className = 'coin-popup';
  el.textContent = '+' + amount + ' C';
  el.style.cssText = 'right:18px;top:22%;left:auto;';
  document.getElementById('gameRoot').appendChild(el);
  setTimeout(() => {
    el.remove();
    el.className = '';
    el.textContent = '';
    el.removeAttribute('style');
    if (_coinPopupPool.length < 10) _coinPopupPool.push(el);
  }, 800);
}
function showBigSplash(main,sub,color,center){
  const el=$('bigSplashText');
  $('splashMain').textContent=main;
  $('splashMain').style.color=color||'white';
  $('splashMain').style.textShadow=`0 0 20px ${color||'white'}`;
  $('splashSub').textContent=sub;
  el.className=''; void el.offsetWidth;
  el.className = center ? 'show-center' : 'show';
  // center mode → กลางจอ, normal → บนจอ
  el.style.top = center ? '42%' : '18%';
}

window.addEventListener('popstate', () => {
  if (gameRunning && !gamePaused) {
    pauseGame();
    // push state กลับเพื่อรับ back ครั้งหน้าด้วย
    history.pushState(null, '', location.href);
  } else if (gamePaused) {
    // กด back ตอน pause → resume
    resumeGame();
    history.pushState(null, '', location.href);
  }
});
// push state ตั้งต้น เพื่อให้ popstate ทำงานได้
history.pushState(null, '', location.href);

function _root(){ return document.getElementById('gameRoot') || document.body; }
function vvW(){ return window.visualViewport ? window.visualViewport.width  : window.innerWidth;  }
function vvH(){ return window.visualViewport ? window.visualViewport.height : window.innerHeight; }
function vvOffY(){ return window.visualViewport ? window.visualViewport.offsetTop : 0; }

function getPos(e){
  if(e && e.clientX !== undefined) return { x: e.clientX, y: e.clientY - vvOffY() };
  if(e && e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY - vvOffY() };
  return { x: vvW()/2, y: vvH()/2 };
}

// ══════════════════════════════════════════
// SAVE TRANSFER SYSTEM
// Cloud Save only
// ══════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// ══ CLOUD SAVE ENGINE v2 — Guest-first Smart Auto Sync               ══
// ══════════════════════════════════════════════════════════════════════
//
// FLOW: Local save always first. Cloud is async backup. Never blocks UI.
// GUEST MODE: works fully without any cloud setup.
// CLOUD MODE: auto-syncs after run, purchase, card open, 5-min dirty, hide.

// ── TOAST SYSTEM ──
// Single reusable fixed top-right corner toast. pointer-events:none.

const _TOAST_TIMING = {
  local:    1200,
  syncing:  0,       // indefinite — replaced by result
  checking: 0,       // indefinite — replaced by result
  cloud:    1600,
  loaded:   2000,
  pending:  2200,
  offline:  2600,
  failed:   3000,
  localonly:1200
};
const _TOAST_CONFIG = {
  local:    { cls: 'st-local',   icon: '💾', label: 'Local Saved'            },
  syncing:  { cls: 'st-syncing', icon: '☁️', label: 'Syncing...',   spin:true },
  checking: { cls: 'st-syncing', icon: '☁️', label: 'Checking Cloud...', spin:true },
  cloud:    { cls: 'st-cloud',   icon: '☁️', label: 'Cloud Synced'           },
  loaded:   { cls: 'st-cloud',   icon: '☁️', label: 'Cloud Loaded'           },
  pending:  { cls: 'st-pending', icon: '⏳', label: 'Sync Pending'           },
  offline:  { cls: 'st-offline', icon: '⚠️', label: 'Offline — Local Saved'  },
  failed:   { cls: 'st-failed',  icon: '❌', label: 'Cloud Failed'           },
  localonly:{ cls: 'st-local',   icon: '💾', label: 'Local Save Active'      },
  vfxlow:   { cls: 'st-offline', icon: '⚡', label: 'VFX Auto-Reduced'       },
};

let _toastEl        = null;
let _toastHideTimer = null;
let _toastFadeTimer = null;

function _getToastEl() {
  if (_toastEl) return _toastEl;
  const el = document.createElement('div');
  el.id = 'saveToast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  (document.body || document.documentElement).appendChild(el);
  _toastEl = el;
  return el;
}

function showSaveToast(type, msgOverride) {
  try {
    const cfg = _TOAST_CONFIG[type];
    if (!cfg) return;
    const el = _getToastEl();
    clearTimeout(_toastHideTimer);
    clearTimeout(_toastFadeTimer);
    const iconHtml = cfg.spin
      ? `<span class="st-spin" aria-hidden="true">${cfg.icon}</span>`
      : `<span class="st-icon" aria-hidden="true">${cfg.icon}</span>`;
    const text = msgOverride || cfg.label;
    el.innerHTML = iconHtml + `<span class="st-label">${text}</span>`;
    el.className = cfg.cls;
    void el.offsetWidth;  // force reflow for clean transition
    el.classList.add('st-visible');
    DEV_LOG('[toast]', type, text);
    const ms = _TOAST_TIMING[type];
    if (ms > 0) _toastHideTimer = setTimeout(() => _hideToast(), ms);
  } catch(e) {
    if (window.NOCTIS_DEV) console.warn('[toast] error:', e);
  }
}

function _hideToast() {
  if (!_toastEl) return;
  _toastEl.classList.remove('st-visible');
  _toastFadeTimer = setTimeout(() => { if (_toastEl) _toastEl.className = ''; }, 260);
}

// ── Conflict guard ──
// Returns true if localPayload is strictly newer than cloudPayload.
function _isLocalNewer(localPayload, cloudPayload) {
  if (!cloudPayload) return true;
  const lv = localPayload.saveVersion  || 0;
  const cv = cloudPayload.saveVersion  || 0;
  if (lv !== cv) return lv > cv;
  const lt = localPayload.updatedAt || '';
  const ct = cloudPayload.updatedAt || cloudPayload.uploaded_at || '';
  if (lt && ct) return lt > ct;
  return true;
}

// ── Core upload (used by both auto and manual) ──
// Includes 10-second fetch timeout via AbortController to prevent indefinite hang.
// OPTIMIZATION: pre-upload READ is skipped for auto-sync; only done at startup,
// on manual cloud load, or when a different device is suspected. This eliminates
// one Supabase read per auto-sync cycle.
async function _cloudUploadCore(payload, opts) {
  opts = opts || {};
  const id  = cloudProfile.playerId  || _cloudBoundId();
  const key = cloudProfile.secret    || (_cloudLoadCreds().key);
  if (!id || !key) { DEV_LOG('[upload] no credentials — skip'); return false; }

  // Validate payload shape before any write — never push an empty/corrupt object
  // over good cloud data. A valid save always carries a stats object.
  if (!payload || typeof payload !== 'object' || !payload.stats || typeof payload.stats !== 'object') {
    console.warn('[upload] refusing to upload invalid payload — keeping cloud untouched');
    return false;
  }

  // Hash-based skip: if payload is identical to last synced hash, skip write entirely
  const hash = _saveHash(payload);
  if (hash === saveState.lastSyncHash) {
    DEV_LOG('[upload] payload unchanged (hash match) — skip');
    // Clear dirty if hash matches — data is already in cloud
    saveState.dirty = false;
    if (saveState.dirtyReasons) saveState.dirtyReasons.clear();
    return false;
  }

  const _fetchWithTimeout = (url, fetchOpts, ms) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, Object.assign({}, fetchOpts, { signal: ctrl.signal }))
      .finally(() => clearTimeout(timer));
  };

  // Conflict check READ — only when explicitly requested (startup, manual, conflict suspected).
  // Auto-sync uses PATCH with secret_key filter; Supabase returns 0 rows on mismatch (safe).
  //
  // SECURITY: never request the secret_key column back from Supabase. Ownership is
  // verified by filtering (player_id AND secret_key) server-side — if the filter
  // doesn't match, PostgREST returns zero rows and the real secret is never exposed
  // in a response body. A second, existence-only probe (selecting just player_id)
  // is used solely to tell "no row yet" apart from "row owned by a different secret"
  // for the abort branch below — it never selects secret_key either.
  let cloudRow = null;
  if (opts.forceConflictCheck) {
    try {
      const chkRes = await _fetchWithTimeout(
        `${_SUPA_URL}/rest/v1/cloud_saves?player_id=eq.${encodeURIComponent(id)}&secret_key=eq.${encodeURIComponent(key)}&select=save_data,uploaded_at`,
        { headers: _cloudHeaders() }, 10000
      );
      if (chkRes.ok) {
        const rows = await chkRes.json();
        cloudRow = rows && rows[0] || null;
        saveState.lastRemoteCheckedAt = Date.now();

        if (!cloudRow) {
          const existsRes = await _fetchWithTimeout(
            `${_SUPA_URL}/rest/v1/cloud_saves?player_id=eq.${encodeURIComponent(id)}&select=player_id`,
            { headers: _cloudHeaders() }, 10000
          );
          if (existsRes.ok) {
            const existsRows = await existsRes.json().catch(() => []);
            if (Array.isArray(existsRows) && existsRows.length > 0) {
              DEV_LOG('[upload] secret key mismatch — abort');
              return false;
            }
          }
        }
      }
    } catch(e) {
      if (_isLikelyNetworkFetchError(e) || e.name === 'AbortError') throw e;
      DEV_LOG('[upload] conflict-check error (non-fatal):', e);
    }

    if (cloudRow && !_isLocalNewer(payload, cloudRow.save_data || {})) {
      DEV_LOG('[upload] cloud equal/newer — skip. cloudSV:', (cloudRow.save_data||{}).saveVersion, 'localSV:', payload.saveVersion);
      return false;
    }
  }

  const uploadedAt = new Date().toISOString();
  const body = JSON.stringify({ save_data: payload, uploaded_at: uploadedAt });
  // return=representation + select=player_id lets us confirm the PATCH actually
  // matched a row. A PATCH that matches 0 rows returns 200/204 with an empty body,
  // so without this we cannot tell "wrote nothing" apart from "wrote successfully" —
  // which silently drops the cloud backup when no row exists yet for this player.
  const res = await _fetchWithTimeout(
    `${_SUPA_URL}/rest/v1/cloud_saves?player_id=eq.${encodeURIComponent(id)}&secret_key=eq.${encodeURIComponent(key)}&select=player_id`,
    { method: 'PATCH', headers: _cloudHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }), body },
    10000
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(err)}`);
  }
  const patched = await res.json().catch(() => []);
  if (!Array.isArray(patched) || patched.length === 0) {
    // PATCH matched no row: either the row does not exist yet, or the player_id is
    // owned by a different secret_key. Try to INSERT it. POST will 409 if the
    // player_id already exists (different owner) — in that case we MUST NOT claim
    // success, so the error propagates to the caller (toast + retry).
    DEV_LOG('[upload] PATCH matched 0 rows — attempting insert for', id);
    const insertRes = await _fetchWithTimeout(
      `${_SUPA_URL}/rest/v1/cloud_saves`,
      { method: 'POST',
        headers: _cloudHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
        body: JSON.stringify({ player_id: id, secret_key: key, save_data: payload, uploaded_at: uploadedAt }) },
      10000
    );
    if (!insertRes.ok) {
      const err = await insertRes.json().catch(() => ({}));
      throw new Error(`HTTP ${insertRes.status} (insert): ${JSON.stringify(err)}`);
    }
    const inserted = await insertRes.json().catch(() => []);
    if (!Array.isArray(inserted) || inserted.length === 0) {
      throw new Error('cloud insert returned no row — not confirming success');
    }
    DEV_LOG('[upload] inserted new cloud row for', id);
  }
  saveState.lastSyncHash    = hash;
  saveState.lastCloudSyncAt = Date.now();
  saveState._retryCount     = 0;  // reset backoff on success
  DEV_LOG('[upload] OK — runId:', payload.lastRunId, 'saveVersion:', payload.saveVersion);
  return true;
}

// ── Core performer: does the actual sync. Fire-and-forget safe. ──
async function performCloudSync(reason, opts) {
  opts = opts || {};
  if (!cloudProfile.isCloudEnabled) {
    DEV_LOG('[sync] cloud disabled — local only');
    return;
  }
  if (saveState.cloudSyncInProgress) {
    saveState.pendingCloudSync = true;
    DEV_LOG('[sync] already in flight — marked pending');
    return;
  }
  saveState.cloudSyncInProgress = true;
  // NOTE: dirty flag cleared AFTER success only — so 5-min interval retries on failure
  DEV_LOG('[sync] starting —', reason);

  // Build minimal persistent payload — strip volatile runtime fields
  const payload = buildSavePayload();

  try {
    const uploaded = await _cloudUploadCore(payload, opts);
    if (uploaded) {
      _pendingSyncClear();
      saveState.dirty            = false;   // ← only clear on success
      saveState.dirtyReason      = null;
      saveState.pendingCloudSync = false;
      if (saveState.dirtyReasons) saveState.dirtyReasons.clear();
      // Cancel any pending retry timer on success
      if (saveState._retryTimer) { clearTimeout(saveState._retryTimer); saveState._retryTimer = null; }
      saveState._retryCount = 0;
      if (opts.silentToast) {
        DEV_LOG('[sync] success (silent)');
      } else if (opts.batchToast) {
        DEV_LOG('[sync] success (batch) — batch idle will show toast');
      } else {
        showSaveToastThrottled('cloud');
        DEV_LOG('[sync] success');
      }
    } else {
      _hideToast();
    }
  } catch(e) {
    const offline = _isLikelyNetworkFetchError(e);
    _pendingSyncSet(payload);
    saveState.pendingCloudSync = true;
    // dirty stays true — exponential retry will handle it
    const errType = offline ? 'offline' : 'failed';
    showSaveToastThrottled(errType);
    if (!offline) console.warn('[sync] error:', e);
    DEV_LOG('[sync] failed —', offline ? 'offline' : e.message);
    // Exponential backoff retry (skip for manual_save and app_hide — user already knows)
    if (reason !== 'manual_save' && reason !== 'app_hide') {
      _scheduleRetryBackoff();
    }
  } finally {
    saveState.cloudSyncInProgress = false;
    // If another sync was queued while this one ran, flush it now (after 1.5s)
    if (saveState.pendingCloudSync && cloudProfile.isCloudEnabled) {
      setTimeout(() => flushPendingCloudSync(), 1500);
    }
  }
}

// ── Exponential retry backoff ──
function _scheduleRetryBackoff() {
  if (saveState._retryTimer) return; // already scheduled
  const delays = saveState._retryDelays || [30000, 60000, 120000, 300000];
  const idx = Math.min(saveState._retryCount, delays.length - 1);
  const delay = delays[idx];
  saveState._retryCount = (saveState._retryCount || 0) + 1;
  DEV_LOG('[retry] scheduled in', delay / 1000, 's (attempt', saveState._retryCount, ')');
  saveState._retryTimer = setTimeout(() => {
    saveState._retryTimer = null;
    if (saveState.dirty && cloudProfile.isCloudEnabled && !saveState.cloudSyncInProgress) {
      DEV_LOG('[retry] firing retry attempt', saveState._retryCount);
      flushPendingCloudSync();
    }
  }, delay);
}

// ── scheduleCloudSync: debounced, deduped, respects in-flight ──
// ── Reason-based debounce table (per spec) ──
const _SYNC_REASON_DELAY = {
  // Immediate / high-priority
  manual_save:       0,       // immediate
  run_complete:      1500,    // 1.5s
  app_hide:          0,       // immediate (best-effort)
  daily_reward:      1500,
  // Medium priority
  shop_purchase:     7000,    // 7s (batch rapid buys)
  card_purchase:     7000,
  card_opened:       12000,   // 12s (batch rapid card opening)
  card_reroll:       10000,   // 10s — fire-and-forget after reroll
  // Low priority
  inventory_changed: 15000,
  settings_changed:  25000,
  cosmetic_change:   25000,
  cloud_bind:        5000,
  // Background fallback
  startup_no_cloud:  3000,
  local_newer_at_startup: 3000,
  interval_dirty:    5000,
  // Daily/weekly state resets — silent background sync, low priority
  daily_reset:       10000,
  weekly_reset:      10000,
};
// Global minimum write interval: never auto-sync more often than every 30 seconds
// Exceptions: manual_save, app_hide
const _MIN_CLOUD_WRITE_INTERVAL = 30000;
const _SYNC_MIN_BYPASS = new Set(['manual_save', 'app_hide']);

const _syncTimers    = {};

/**
 * scheduleCloudSync
 * @param {string} reason
 * @param {object} [opts] - { silentToast: bool, batchToast: bool }
 *   silentToast: suppress syncing + cloud toasts entirely for this call
 *   batchToast:  defer success toast to batch idle handler (markCardOpenBatch)
 */
function scheduleCloudSync(reason, opts) {
  if (!cloudProfile.isCloudEnabled) return;
  opts = opts || {};
  const delay = (_SYNC_REASON_DELAY[reason] !== undefined) ? _SYNC_REASON_DELAY[reason] : 15000;
  clearTimeout(_syncTimers[reason]);
  _syncTimers[reason] = setTimeout(() => {
    // Global minimum write interval guard (skip for manual/app_hide)
    if (!_SYNC_MIN_BYPASS.has(reason)) {
      const msSinceLastSync = Date.now() - saveState.lastCloudSyncAt;
      if (msSinceLastSync < _MIN_CLOUD_WRITE_INTERVAL) {
        const waitMs = _MIN_CLOUD_WRITE_INTERVAL - msSinceLastSync;
        DEV_LOG('[scheduleSync] min interval guard — waiting', waitMs, 'ms for', reason);
        saveState.pendingCloudSync = true;
        clearTimeout(_syncTimers[reason + '_minwait']);
        _syncTimers[reason + '_minwait'] = setTimeout(() => {
          performCloudSync(reason, opts);
        }, waitMs + 100);
        return;
      }
    }
    // Show syncing toast only for high-priority reasons (not batched/silenced)
    const isHighPri = delay <= 2000;
    if (isHighPri && !opts.silentToast && !opts.batchToast) {
      showSaveToastThrottled('syncing');
    }
    performCloudSync(reason, opts);
  }, delay);
  DEV_LOG('[scheduleSync]', reason, 'delay:', delay, opts);
}

// ── flushPendingCloudSync: upload queued payload from localStorage ──
// Always uses the NEWER of (stored pending, live save) to avoid uploading a stale snapshot.
async function flushPendingCloudSync() {
  const pending = _pendingSyncGet();
  if (!pending) return false;
  if (saveState.cloudSyncInProgress) return false;
  DEV_LOG('[flush] flushing pending sync...');
  // Pick the newer payload: live save may have advanced beyond what was queued
  const livePayload = buildSavePayload();
  const flushPayload = _isLocalNewer(livePayload, pending) ? livePayload : pending;
  DEV_LOG('[flush] using', flushPayload === livePayload ? 'live save' : 'stored pending', 'sv:', flushPayload.saveVersion);
  showSaveToastThrottled('syncing');
  try {
    // On flush, do a conflict-check read if we haven't checked cloud recently (>2 min)
    const needsConflictCheck = (Date.now() - saveState.lastRemoteCheckedAt) > 120000;
    const uploaded = await _cloudUploadCore(flushPayload, { forceConflictCheck: needsConflictCheck });
    if (uploaded) {
      _pendingSyncClear();
      saveState.pendingCloudSync = false;
      saveState.dirty            = false;
      if (saveState.dirtyReasons) saveState.dirtyReasons.clear();
      if (saveState._retryTimer) { clearTimeout(saveState._retryTimer); saveState._retryTimer = null; }
      saveState._retryCount = 0;
      showSaveToastThrottled('cloud');
      DEV_LOG('[flush] OK');
      return true;
    } else {
      _hideToast();
      return false;
    }
  } catch(e) {
    showSaveToastThrottled(_isLikelyNetworkFetchError(e) ? 'offline' : 'pending');
    DEV_LOG('[flush] failed:', e);
    // Schedule retry backoff
    _scheduleRetryBackoff();
    return false;
  }
}

// ── Legacy alias (called from endGame / result screen) ──
function autoCloudSave() {
  scheduleCloudSync('run_complete');
}

// ── Legacy bridge (result screen pending check) ──
function _acsShowPendingIfNeeded() {
  if (_pendingSyncGet()) showSaveToastThrottled('pending');
}

// ── Startup Cloud Restore ──
// Called after local save is loaded and main menu is first shown.
// Never blocks startup. Never overwrites newer local save.
// Throttled: at most ONE cloud read per session (startupCloudChecked flag),
// and only if we haven't checked within the last 3 minutes (lastRemoteCheckedAt).
let _startupRestoreDone = false;
async function startupCloudRestore() {
  if (_startupRestoreDone) return;
  _startupRestoreDone = true;

  if (!cloudProfile.isCloudEnabled) {
    DEV_LOG('[restore] cloud disabled — guest mode');
    return;
  }
  const id  = cloudProfile.playerId;
  const key = cloudProfile.secret;
  if (!id || !key) return;

  // Skip if already checked this session
  if (saveState.startupCloudChecked) {
    DEV_LOG('[restore] already checked this session — skip');
    return;
  }
  // Skip if checked recently (within 3 minutes) — handles page refresh or rapid menu navigation
  const msSinceLastCheck = Date.now() - saveState.lastRemoteCheckedAt;
  if (saveState.lastRemoteCheckedAt > 0 && msSinceLastCheck < 180000) {
    DEV_LOG('[restore] checked recently (', Math.round(msSinceLastCheck/1000), 's ago) — skip');
    return;
  }

  saveState.startupCloudChecked = true;
  saveState.lastRemoteCheckedAt = Date.now();

  showSaveToast('checking');
  DEV_LOG('[restore] checking cloud for player:', id);

  const _restoreFetch = (url, opts) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    return fetch(url, Object.assign({}, opts || {}, { signal: ctrl.signal }))
      .finally(() => clearTimeout(timer));
  };

  try {
    // SECURITY: never request the secret_key column back from Supabase — ownership is
    // verified by filtering (player_id AND secret_key) server-side. If that filter
    // matches nothing, a second existence-only probe (selecting just player_id, never
    // secret_key) tells "no cloud save yet" apart from "this id belongs to a
    // different secret" for the two branches below.
    const res = await _restoreFetch(
      `${_SUPA_URL}/rest/v1/cloud_saves?player_id=eq.${encodeURIComponent(id)}&secret_key=eq.${encodeURIComponent(key)}&select=save_data,uploaded_at`,
      { headers: _cloudHeaders() }
    );
    if (!res.ok) { _hideToast(); DEV_LOG('[restore] fetch failed:', res.status); return; }

    const rows = await res.json();
    const row  = rows && rows[0];
    if (!row || !row.save_data) {
      const existsRes = await _restoreFetch(
        `${_SUPA_URL}/rest/v1/cloud_saves?player_id=eq.${encodeURIComponent(id)}&select=player_id`,
        { headers: _cloudHeaders() }
      );
      const existsRows = existsRes.ok ? await existsRes.json().catch(() => []) : [];
      if (Array.isArray(existsRows) && existsRows.length > 0) {
        // Row exists under this player_id but not under our secret — abort silently.
        _hideToast();
        DEV_LOG('[restore] secret key mismatch on restore — abort');
        return;
      }
      // No cloud save yet — local is canonical, schedule upload
      showSaveToast('localonly');
      DEV_LOG('[restore] no cloud save found — local is canonical');
      markSaveDirty('startup_no_cloud');
      scheduleCloudSync('startup_no_cloud');
      return;
    }

    const cloudSaveData = row.save_data;

    // Sanity check cloud payload
    if (typeof cloudSaveData !== 'object' || !cloudSaveData.stats) {
      _hideToast();
      DEV_LOG('[restore] cloud payload corrupted — keeping local');
      return;
    }

    if (_isLocalNewer(save, cloudSaveData)) {
      // Local is newer — show badge, schedule push
      showSaveToast('localonly');
      DEV_LOG('[restore] local is newer — keeping local, scheduling push');
      markSaveDirty('local_newer_at_startup');
      scheduleCloudSync('local_newer_at_startup');
    } else {
      // Cloud is newer — apply it
      DEV_LOG('[restore] cloud is newer — applying. cloudSV:', cloudSaveData.saveVersion);
      const restored = normalizeSaveData(Object.assign({}, cloudSaveData));
      Object.assign(save, restored);
      _storeLocalSave(save);
      gameSettings = normalizeSettings(save.settings || gameSettings);
      save.settings = gameSettings;
      applyAudioSettings();
      // Re-render any live UI that shows save data
      try { updateShopCoinUI(); } catch(e) {}
      // FIX 2 — update main menu coin display immediately after cloud restore
      try { if ($('menuCoinNum')) $('menuCoinNum').textContent = formatNum(save.coins); } catch(e) {}
      try { if (typeof checkDailyQuestReset === 'function') checkDailyQuestReset(); } catch(e) {}
      try { if (typeof updateDailyQuestUI  === 'function') updateDailyQuestUI();    } catch(e) {}
      try { if (typeof checkWeeklyChallengeReset === 'function') checkWeeklyChallengeReset(); } catch(e) {}
      try { if (typeof updateWeeklyBadgesUI      === 'function') updateWeeklyBadgesUI();      } catch(e) {}
      saveState.lastSyncHash = _saveHash(save);
      showSaveToast('loaded');
      DEV_LOG('[restore] applied — coins:', save.coins, 'hs:', save.stats && save.stats.highScore);
    }
  } catch(e) {
    if (_isLikelyNetworkFetchError(e) || e.name === 'AbortError') {
      showSaveToast('offline');
      saveState.pendingCloudSync = true;
      DEV_LOG('[restore] offline/timeout — keeping local');
    } else {
      _hideToast();
      console.warn('[restore] error:', e);
    }
  }
}

// ── 5-minute dirty sync interval ──
// Only fires if dirty AND at least 30s since last cloud sync (min write interval).
setInterval(() => {
  if (saveState.dirty && cloudProfile.isCloudEnabled && !saveState.cloudSyncInProgress) {
    const msSince = Date.now() - saveState.lastCloudSyncAt;
    if (msSince >= _MIN_CLOUD_WRITE_INTERVAL) {
      DEV_LOG('[interval] dirty — scheduling 5-min sync');
      scheduleCloudSync('interval_dirty');
    }
  }
}, 5 * 60 * 1000);

// ── App hide / close: save local synchronously, attempt quick cloud ──
function _onAppHide() {
  // Always commit local save immediately
  try { _storeLocalSave(save); } catch(e) {}
  if (cloudProfile.isCloudEnabled && saveState.dirty) {
    if (saveState.cloudSyncInProgress) {
      saveState.pendingCloudSync = true;
    } else {
      // Best-effort fire-and-forget; queue if it fails
      const _hidePayload = buildSavePayload();
      _pendingSyncSet(_hidePayload);
      // Cancel any pending retry timer — new attempt on next launch
      if (saveState._retryTimer) { clearTimeout(saveState._retryTimer); saveState._retryTimer = null; }
      performCloudSync('app_hide').catch(() => {});
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// BACKGROUND AUDIO LIFECYCLE — Android / mobile tab-switch fix
// ──────────────────────────────────────────────────────────────────────
// Pauses all BGM when app is hidden/backgrounded. Resumes correctly when
// the user returns. Never touches user mute settings or save state.
// ══════════════════════════════════════════════════════════════════════

let _audioPausedByBackground = false;
let _bgmWasPlayingBeforeHidden = false; // title BGM
let _fightBgmWasPlayingBeforeHidden = false;
let _collectBgmWasPlayingBeforeHidden = false;

/** Returns true if the title BGM element is currently playing. */
function _isTitleBgmPlaying() {
  const bgm = $('bgmSound');
  return !!(bgm && !bgm.paused);
}

/** Returns true if the fight BGM chain is currently active and playing. */
function _isFightBgmPlaying() {
  return _fightBgmActive && !!(_fightBgmCurrent && !_fightBgmCurrent.paused);
}

/** Returns true if the collect BGM <audio> element is currently playing. */
function _isCollectBgmPlaying() {
  const el = $('collectBgm');
  return !!(el && !el.paused);
}

/** Pause all BGM tracks for backgrounding. Preserves currentTime. */
function pauseAllBgmForBackground() {
  // Title BGM (HTMLAudioElement)
  const bgm = $('bgmSound');
  if (bgm && !bgm.paused) {
    bgm.pause();
    // Do NOT reset currentTime — so resume picks up where it left off
  }

  // Fight BGM (HTMLAudioElement, chained)
  if (_fightBgmCurrent && !_fightBgmCurrent.paused) {
    _fightBgmCurrent.pause();
    // Keep _fightBgmActive true and _fightBgmCurrent reference so resume works
  }

  // Collect BGM (HTMLAudioElement)
  const collectEl = $('collectBgm');
  if (collectEl && !collectEl.paused) collectEl.pause();
}

/** Resume BGM tracks after returning from background. Respects mute settings. */
function resumeCurrentBgmIfAllowed() {
  if (!gameSettings.musicOn) return; // user has music muted — don't resume anything

  // Collect BGM
  if (_collectBgmWasPlayingBeforeHidden) {
    const collectEl = $('collectBgm');
    if (collectEl && collectEl.paused) collectEl.play().catch(() => {});
    return; // collect BGM owns the moment; don't layer fight/title on top
  }

  // Fight BGM
  if (_fightBgmWasPlayingBeforeHidden && _fightBgmActive && _fightBgmCurrent) {
    try { _fightBgmCurrent.play().catch(() => {}); } catch(e) {}
    return; // don't also start title BGM
  }

  // Title BGM
  if (_bgmWasPlayingBeforeHidden) {
    const bgm = $('bgmSound');
    if (bgm && bgm.paused) {
      bgm.volume = _musicGain(TITLE_BGM_VOLUME);
      bgm.play().catch(() => {}); // browser may block — silently fail, next tap will unlock
    }
  }
}

function pauseAudioForBackground() {
  if (_audioPausedByBackground) return; // already paused — guard against double-fire
  _audioPausedByBackground = true;

  // Snapshot what was playing *before* we pause anything
  _bgmWasPlayingBeforeHidden        = _isTitleBgmPlaying();
  _fightBgmWasPlayingBeforeHidden   = _isFightBgmPlaying();
  _collectBgmWasPlayingBeforeHidden = _isCollectBgmPlaying();

  pauseAllBgmForBackground();

  // Also silence short-lived SFX elements to avoid stray sounds on resume
  // (these reset currentTime — they are fire-and-forget, not looping BGM)
  ['countdownSound'].forEach(id => {
    try { const s = $(id); if(s && !s.paused){ s.pause(); s.currentTime = 0; } } catch(e) {}
  });
}

function resumeAudioFromBackground() {
  if (!_audioPausedByBackground) return; // nothing to resume — guard against double-fire
  _audioPausedByBackground = false;
  resumeCurrentBgmIfAllowed();
}

// ── Wire lifecycle events (once) ──────────────────────────────────────

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseAudioForBackground();
    _onAppHide();
    if (gameRunning && !gamePaused) pauseGame();
  } else {
    resumeAudioFromBackground();
    // Flush any pending cloud sync after returning
    if (saveState.pendingCloudSync) {
      setTimeout(() => flushPendingCloudSync(), 2000);
    }
  }
});

// handleAppBackgroundLifecycle — shared handler for pagehide and blur.
// Both events can fire on Android without visibilitychange (tab kill, home button,
// notification tray, WebView app-switch). Calling this handler ensures:
//   1. Audio pauses (via existing guards in pauseAudioForBackground)
//   2. Local save commits immediately (best-effort, sync write)
//   3. Cloud sync fires fire-and-forget (non-blocking)
//   4. Active game run pauses (timer/OD/WP/INPUT stop via existing pauseGame guards)
// All three subroutines carry their own re-entrancy guards so duplicate calls
// (e.g. visibilitychange + blur firing together) are safe no-ops.
function handleAppBackgroundLifecycle() {
  pauseAudioForBackground();

  if (typeof _onAppHide === 'function') {
    _onAppHide();
  }

  if (typeof gameRunning !== 'undefined' && typeof gamePaused !== 'undefined') {
    if (gameRunning && !gamePaused && typeof pauseGame === 'function') {
      pauseGame();
    }
  }
}

// pagehide fires on Android when tab is killed or navigated away.
// Previously only paused audio; now also commits save and pauses the run.
window.addEventListener('pagehide', handleAppBackgroundLifecycle);

// pageshow fires when BFCache restores the page — resume if appropriate
window.addEventListener('pageshow', (e) => {
  // e.persisted = true means page came from BFCache (back-forward cache)
  if (e.persisted) resumeAudioFromBackground();
});

// blur/focus: catches app-switch, home button, notification drawer on Android
// These fire independently of visibilitychange on some Android WebViews.
// blur previously only paused audio; now also commits save and pauses the run.
window.addEventListener('blur',  handleAppBackgroundLifecycle, { passive: true });
window.addEventListener('focus', resumeAudioFromBackground,    { passive: true });

window.addEventListener('beforeunload', () => {
  try { _storeLocalSave(save); } catch(e) {}
});

// ── Online reconnect: flush pending ──
window.addEventListener('online', () => {
  DEV_LOG('[online] reconnected — flushing pending sync');
  flushPendingCloudSync();
});

// ── VFX auto-downscale: รับ event จาก canvasVfx เมื่อ FPS ตำ ──────────────
// อัปเดต gameSettings + บันทึก + แสดง toast ครั้งเดียว
window.addEventListener('noctis:vfx-auto-downscale', function(e) {
  const newLevel = (e && e.detail && e.detail.level) || 'low';
  if (gameSettings.flashEffect === newLevel) return;
  gameSettings.flashEffect = newLevel;
  applyFlashEffectSetting();
  syncSettingsUI();
  persistSettings();
  showSaveToast('vfxlow');
});

// ══ END CLOUD SAVE ENGINE v2 ══




const _CLOUD_STORE_KEY = 'noctisak47_cloud';
// key ที่ lock ว่า save นี้ผูกกับ cloud ID ไหนแล้ว (แยกจาก creds เพื่อไม่ให้ถูกล้างตาม load)
const _CLOUD_LOCK_KEY  = 'noctisak47_cloud_lock';

// Generate random 8-char alphanumeric secret key
function _cloudGenSecret() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function _cloudLoadCreds() {
  try { return JSON.parse(localStorage.getItem(_CLOUD_STORE_KEY)) || {}; } catch(e) { return {}; }
}
function _cloudSaveCreds(id, key) {
  try { localStorage.setItem(_CLOUD_STORE_KEY, JSON.stringify({ id, key })); } catch(e) {}
}
function _cloudClearCreds() {
  try { localStorage.removeItem(_CLOUD_STORE_KEY); } catch(e) {}
}

// ── Lock: ผูก save นี้กับ cloud ID ──
// ใช้ทั้ง localStorage และ field ใน save_data เพื่อกันการนำ save เดียวไปสร้างหลาย ID
function _cloudGetLock()       { try { return localStorage.getItem(_CLOUD_LOCK_KEY) || null; } catch(e) { return null; } }
function _cloudSetLock(id)     { try { localStorage.setItem(_CLOUD_LOCK_KEY, id); } catch(e) {} }
function _cloudClearLock()     { try { localStorage.removeItem(_CLOUD_LOCK_KEY); } catch(e) {} }
function _cloudBoundId()       { return (save && save.cloudPlayerId) || _cloudGetLock(); }
function _cloudBindSave(id)    { save.cloudPlayerId = id; _cloudSetLock(id); doSave('cloud_bind'); }
function _cloudClearAccountState() {
  _cloudClearCreds();
  _cloudClearLock();
  // Reset in-memory profile so future auto-syncs don't target the old account
  cloudProfile.isCloudEnabled = false;
  cloudProfile.playerId       = '';
  cloudProfile.secret         = '';
  saveState.pendingCloudSync  = false;
  saveState.dirty             = false;
  saveState.lastSyncHash      = null;
  saveState.startupCloudChecked = false;
  saveState.lastRemoteCheckedAt = 0;
  saveState._retryCount       = 0;
  if (saveState._retryTimer) { clearTimeout(saveState._retryTimer); saveState._retryTimer = null; }
  if (saveState.dirtyReasons) saveState.dirtyReasons.clear();
  _pendingSyncClear();
  DEV_LOG('[cloudProfile] cleared on account reset');
}
function _cloudHeaders(extra)  {
  return Object.assign({
    'apikey': _SUPA_KEY,
    'Authorization': `Bearer ${_SUPA_KEY}`
  }, extra || {});
}


function svSetSecretDisplay(secret, revealed, emptyText) {
  const box = $('sv-secret-display');
  if (!box) return;
  const hasSecret = !!secret;
  box.dataset.secret = hasSecret ? secret : '';
  box.dataset.revealed = hasSecret && revealed ? '1' : '0';
  box.classList.toggle('revealed', hasSecret && revealed);
  box.classList.toggle('hidden', hasSecret && !revealed);
  box.textContent = hasSecret
    ? (revealed ? secret : '•••••••• — กดเพื่อดู')
    : (emptyText || '— กรอก ID แล้วกด Cloud Save —');
}

function svToggleSecret() {
  const box = $('sv-secret-display');
  if (!box || !box.dataset.secret) return;
  svSetSecretDisplay(box.dataset.secret, box.dataset.revealed !== '1');
}

function svSecretKeydown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    svToggleSecret();
  }
}

function svToggleLoadKey() {
  const input = $('sv-cloud-load-key');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

// Init cloud panel — restore credentials + แสดงสถานะ lock
function svCloudInitPanel() {
  const creds    = _cloudLoadCreds();
  const lockedId = _cloudBoundId();
  const idEl     = $('sv-cloud-id');

  if (lockedId) {
    idEl.value    = lockedId;
    idEl.readOnly = true;
    svSetSecretDisplay((creds.id === lockedId && creds.key) ? creds.key : '', false, '••••••••');
  } else {
    idEl.readOnly = false;
    idEl.value = creds.id || idEl.value || '';
    if (creds.id && creds.key && idEl.value === creds.id) {
      svSetSecretDisplay(creds.key, false);
    } else {
      svSetSecretDisplay('', false, '— กรอก ID แล้วกด Cloud Save —');
    }
  }

  const loadIdEl  = $('sv-cloud-load-id');
  const loadKeyEl = $('sv-cloud-load-key');
  if (loadKeyEl) loadKeyEl.type = 'password';
  if (lockedId || (creds.id && creds.key)) {
    if (loadIdEl && !loadIdEl.value) loadIdEl.value = lockedId || creds.id;
    if (loadKeyEl && !loadKeyEl.value && creds.id === (lockedId || creds.id)) loadKeyEl.value = creds.key || '';
  } else {
    if (loadIdEl) loadIdEl.value = '';
    if (loadKeyEl) loadKeyEl.value = '';
  }
  if ($('sv-cloud-save-msg')) { $('sv-cloud-save-msg').innerHTML = ''; $('sv-cloud-save-msg').className = 'sv-msg'; }
  if ($('sv-cloud-msg'))      { $('sv-cloud-msg').innerHTML = '';      $('sv-cloud-msg').className = 'sv-msg'; }
}

// Called when player types in ID field
function svCloudOnIdChange() {
  const id  = ($('sv-cloud-id').value || '').trim();
  if (!id) { svSetSecretDisplay('', false, '— กรอก ID แล้วกด Cloud Save —'); return; }
  const creds = _cloudLoadCreds();
  if (creds.id === id && creds.key) {
    svSetSecretDisplay(creds.key, false);
  } else {
    svSetSecretDisplay('', false, '— ระบบจะแจกรหัสลับหลัง Upload สำเร็จ —');
  }
}

function svCloudClearPanel() {
  const idEl = $('sv-cloud-id');
  if (idEl) {
    idEl.value = '';
    idEl.readOnly = false;
  }

  if ($('sv-secret-display')) {
    svSetSecretDisplay('', false, '— กรอก ID แล้วกด Cloud Save —');
  }

  if ($('sv-cloud-load-id'))  $('sv-cloud-load-id').value = '';
  if ($('sv-cloud-load-key')) {
    $('sv-cloud-load-key').value = '';
    $('sv-cloud-load-key').type = 'password';
  }
  if ($('sv-cloud-save-msg')) { $('sv-cloud-save-msg').innerHTML = ''; $('sv-cloud-save-msg').className = 'sv-msg'; }
  if ($('sv-cloud-msg'))      { $('sv-cloud-msg').innerHTML = '';      $('sv-cloud-msg').className = 'sv-msg'; }
}

// Upload save to Supabase — พร้อม lock ID หลัง save สำเร็จครั้งแรก
async function svCloudUpload() {
  const saveMsg  = $('sv-cloud-save-msg');
  const id       = ($('sv-cloud-id').value || '').trim();
  const boundId  = _cloudBoundId();

  if (!id) { svShowMsg(saveMsg, '❌ กรอก PLAYER ID ก่อน', 'err'); return; }
  if (id.length < 3) { svShowMsg(saveMsg, '❌ ID ต้องมีอย่างน้อย 3 ตัวอักษร', 'err'); return; }

  if (boundId && boundId !== id) {
    svShowMsg(saveMsg, `🔒 Save นี้ผูกกับ ID "${boundId}" แล้ว ใช้ ID อื่นไม่ได้`, 'err'); return;
  }

  markSaveDirty('manual_save');

  let creds = _cloudLoadCreds();
  let key   = (creds.id === id) ? creds.key : null;
  if (!key) key = _cloudGenSecret();

  const btn = $('sv-cloud-upload-btn');
  btn.innerHTML = '<span class="sv-loading"></span>กำลัง Upload...';
  btn.disabled  = true;

  try {
    // SECURITY: never request the secret_key column back from Supabase. Ownership is
    // verified by filtering (player_id AND secret_key) server-side — a wrong/unknown
    // key simply matches zero rows. A second existence-only probe (selecting just
    // player_id) tells "id free" apart from "id owned by a different secret" without
    // ever exposing that secret to the client.
    const ownUrl = `${_SUPA_URL}/rest/v1/cloud_saves?player_id=eq.${encodeURIComponent(id)}&secret_key=eq.${encodeURIComponent(key)}&select=save_data,uploaded_at`;
    const ownRes = await fetch(ownUrl, { headers: _cloudHeaders() });
    if (!ownRes.ok) { svShowMsg(saveMsg, `❌ ตรวจสอบ ID ไม่สำเร็จ (${ownRes.status})`, 'err'); return; }

    const ownRows = await ownRes.json();
    const row = ownRows && ownRows[0];

    if (!row) {
      const existsRes = await fetch(
        `${_SUPA_URL}/rest/v1/cloud_saves?player_id=eq.${encodeURIComponent(id)}&select=player_id`,
        { headers: _cloudHeaders() }
      );
      if (existsRes.ok) {
        const existsRows = await existsRes.json().catch(() => []);
        if (Array.isArray(existsRows) && existsRows.length > 0) {
          svShowMsg(saveMsg, `❌ ID "${id}" ถูกใช้แล้ว — เปลี่ยน ID ใหม่`, 'err');
          return;
        }
      }
    }

    // ── Conflict guard: if cloud has newer data, warn player ──
    if (row && row.save_data) {
      const cloudSaveData = row.save_data;
      const localPayload  = buildSavePayload();
      if (!_isLocalNewer(localPayload, cloudSaveData)) {
        const cloudDev = cloudSaveData.deviceId || '?';
        if (cloudDev !== _DEVICE_ID) {
          svShowMsg(saveMsg, `⚠️ Cloud มีข้อมูลใหม่กว่า (จากอุปกรณ์อื่น) — กด Cloud Load เพื่อนำมาใช้`, 'err');
          return;
        }
      }
    }

    // Flush any pending auto-save payload: use whichever is newer
    const pendingPayload = _pendingSyncGet();
    const uploadSaveRaw  = buildSavePayload();
    let uploadSave;
    if (pendingPayload && _isLocalNewer(pendingPayload, uploadSaveRaw)) {
      uploadSave = normalizeSaveData(Object.assign({}, pendingPayload, { cloudPlayerId: id }));
      DEV_LOG('[manualCloud] using pending payload (newer)');
    } else {
      uploadSave = normalizeSaveData(Object.assign({}, uploadSaveRaw, { cloudPlayerId: id }));
    }

    const payload = JSON.stringify({ save_data: uploadSave, uploaded_at: new Date().toISOString() });
    const res = row
      ? await fetch(`${_SUPA_URL}/rest/v1/cloud_saves?player_id=eq.${encodeURIComponent(id)}&secret_key=eq.${encodeURIComponent(key)}`, {
          method: 'PATCH',
          headers: _cloudHeaders({ 'Content-Type': 'application/json' }),
          body: payload
        })
      : await fetch(`${_SUPA_URL}/rest/v1/cloud_saves`, {
          method: 'POST',
          headers: _cloudHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ player_id: id, secret_key: key, save_data: uploadSave, uploaded_at: new Date().toISOString() })
        });

    if (res.ok) {
      Object.assign(save, uploadSave);
      _storeLocalSave(save);
      _saveSignatureState = 'local';
      _cloudBindSave(id);
      _cloudSaveCreds(id, key);
      _pendingSyncClear();
      saveState.pendingCloudSync = false;
      saveState.lastSyncHash     = _saveHash(uploadSave);
      saveState.lastCloudSyncAt  = Date.now();
      saveState.dirty            = false;
      saveState._retryCount      = 0;
      if (saveState._retryTimer) { clearTimeout(saveState._retryTimer); saveState._retryTimer = null; }
      if (saveState.dirtyReasons) saveState.dirtyReasons.clear();
      // Refresh cloudProfile so future auto-syncs work without page reload
      cloudProfile.isCloudEnabled = true;
      cloudProfile.playerId       = id;
      cloudProfile.secret         = key;
      svSetSecretDisplay(key, false);
      $('sv-cloud-id').readOnly = true;
      if ($('sv-cloud-load-id')) $('sv-cloud-load-id').value = id;
      if ($('sv-cloud-load-key')) $('sv-cloud-load-key').value = key;
      svShowMsg(saveMsg, `✅ Upload สำเร็จ! ID: ${id}`, 'ok');
      showSaveToast('cloud');
      DEV_LOG('[manualCloud] upload OK — saveVersion:', uploadSave.saveVersion);
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('[cloudUpload] HTTP', res.status, err);
      svShowMsg(saveMsg, `❌ Upload ไม่สำเร็จ (${res.status})`, 'err');
      showSaveToast('failed');
    }
  } catch(e) {
    console.error('[cloudUpload]', e);
    svShowMsg(saveMsg, _cloudFriendlyError(e), 'err');
    showSaveToast(_isLikelyNetworkFetchError(e) ? 'offline' : 'failed');
  } finally {
    btn.innerHTML = '☁️ CLOUD SAVE';
    btn.disabled  = false;
  }
}

// Download save from Supabase
async function svCloudDownload() {
  const msg = $('sv-cloud-msg');
  const id  = ($('sv-cloud-load-id').value || '').trim();
  const key = ($('sv-cloud-load-key').value || '').trim();
  if (!id)  { svShowMsg(msg, '❌ กรอก PLAYER ID ก่อน', 'err'); return; }
  if (!key) { svShowMsg(msg, '❌ กรอกรหัสลับก่อน', 'err'); return; }

  svShowMsg(msg, '<span class="sv-loading"></span>กำลัง Load...', 'ok');
  try {
    const url = `${_SUPA_URL}/rest/v1/cloud_saves?player_id=eq.${encodeURIComponent(id)}&secret_key=eq.${encodeURIComponent(key)}&select=save_data,uploaded_at`;
    const res = await fetch(url, { headers: _cloudHeaders() });
    if (!res.ok) { svShowMsg(msg, `❌ ดึงข้อมูลไม่สำเร็จ (${res.status})`, 'err'); return; }

    const rows = await res.json();
    if (!rows || rows.length === 0) {
      svShowMsg(msg, '❌ ไม่พบ Save — ตรวจสอบ ID หรือรหัสลับ', 'err');
      return;
    }

    const cloudSave = rows[0].save_data;
    if (!cloudSave) { svShowMsg(msg, '❌ ข้อมูล Save ว่างเปล่า', 'err'); return; }
    // Reject structurally-invalid cloud payloads before they can overwrite local data.
    // A valid save always carries a stats object; a corrupt/partial blob must NOT be applied.
    if (typeof cloudSave !== 'object' || !cloudSave.stats || typeof cloudSave.stats !== 'object') {
      svShowMsg(msg, '❌ ข้อมูล Save เสียหาย — ไม่นำมาใช้', 'err'); return;
    }
    if (cloudSave.cloudPlayerId && cloudSave.cloudPlayerId !== id) {
      svShowMsg(msg, '❌ Save นี้ผูกกับ ID อื่น', 'err'); return;
    }

    cloudSave.cloudPlayerId = id;
    const _localWeekly = (save.weeklyChallenge && save.weeklyChallenge.weekId)
      ? { weekId: save.weeklyChallenge.weekId, claimed: Object.assign({}, save.weeklyChallenge.claimed) }
      : null;
    Object.assign(save, normalizeSaveData(cloudSave));
    // If cloud save is from the same week, carry forward any claims already made locally
    // to prevent a stale cloud load from re-enabling already-claimed tiers.
    if (_localWeekly && save.weeklyChallenge &&
        _localWeekly.weekId === save.weeklyChallenge.weekId) {
      ['tier1', 'tier2', 'tier3'].forEach(t => {
        if (_localWeekly.claimed[t]) save.weeklyChallenge.claimed[t] = true;
      });
    }
    gameSettings = normalizeSettings(save.settings || gameSettings);
    save.settings = gameSettings;
    applyAudioSettings();
    _storeLocalSave(save);
    _saveSignatureState = 'local';
    _cloudBindSave(id);
    _cloudSaveCreds(id, key);
    // ── Sync state: record that save now matches cloud so the next auto-sync
    //    does not immediately re-upload the same data we just downloaded. ──
    saveState.lastSyncHash    = computeStableSaveHash(save);
    saveState.lastCloudSyncAt = Date.now();
    saveState.lastRemoteCheckedAt = Date.now();
    saveState.dirty            = false;
    saveState.pendingCloudSync = false;
    if (saveState.dirtyReasons) saveState.dirtyReasons.clear();
    if (saveState._retryTimer) { clearTimeout(saveState._retryTimer); saveState._retryTimer = null; }
    saveState._retryCount = 0;
    // Enable cloud auto-sync for this session with the loaded credentials
    cloudProfile.isCloudEnabled = true;
    cloudProfile.playerId       = id;
    cloudProfile.secret         = key;
    updateShopCoinUI();
    if ($('menuCoinNum')) $('menuCoinNum').textContent = formatNum(save.coins);
    if ($('menuHsNum'))   $('menuHsNum').textContent   = formatNum(save.stats.highScore || 0);
    const ts = rows[0].uploaded_at ? new Date(rows[0].uploaded_at).toLocaleDateString('th-TH') : '';
    svShowMsg(msg, `✅ โหลดสำเร็จ!${ts ? ' ('+ts+')' : ''}`, 'ok');
    setTimeout(closeSaveModal, 1500);
  } catch(e) {
    console.error('[cloudDownload]', e);
    svShowMsg(msg, _cloudFriendlyError(e), 'err');
  }
}

// ── Modal open/close ──

function openSaveModal() {
  $('saveModal').classList.add('open');
  svSwitchTab('cloud');
}

function closeSaveModal() {
  $('saveModal').classList.remove('open');
  _svResetConfirmed = false;
  $('sv-reset-btn').textContent = '🗑️ RESET ACCOUNT';
  $('sv-reset-btn').style.borderColor = '';
  $('sv-reset-btn').style.color = '';
  $('sv-reset-btn').onclick = svConfirmReset;
  $('sv-reset-msg').textContent = '';
  if($('sv-cloud-save-msg')) { $('sv-cloud-save-msg').textContent = ''; $('sv-cloud-save-msg').className = 'sv-msg'; }
  if($('sv-cloud-msg')) { $('sv-cloud-msg').textContent = ''; $('sv-cloud-msg').className = 'sv-msg'; }
}

// ── Tab switching ──
function svSwitchTab(tab) {
  ['cloud','reset'].forEach(t => {
    $('svTab-'  + t).classList.toggle('active', t === tab);
    $('svPanel-' + t).classList.toggle('active', t === tab);
  });
  if(tab === 'cloud') svCloudInitPanel();
}

// ── Reset account ──
let _svResetConfirmed = false;
function svConfirmReset() {
  if(!_svResetConfirmed) {
    _svResetConfirmed = true;
    $('sv-reset-btn').textContent = '⚠️ ยืนยัน? กดอีกครั้งเพื่อ RESET';
    $('sv-reset-btn').style.borderColor = '#ff2233';
    $('sv-reset-btn').style.color = '#ff2233';
    setTimeout(() => {
      _svResetConfirmed = false;
      $('sv-reset-btn').textContent = '🗑️ RESET ACCOUNT';
      $('sv-reset-btn').style.borderColor = '';
      $('sv-reset-btn').style.color = '';
    }, 4000);
    return;
  }
  // RESET
  _svResetConfirmed = false;
  localStorage.removeItem(SAVE_STORAGE_KEY);
  _cloudClearAccountState(); // ล้าง credentials + lock เมื่อ reset — save ใหม่สร้าง ID ใหม่ได้
  save = loadSave();
  svCloudClearPanel();
  doSave();
  updateShopCoinUI();
  if($('menuCoinNum')) $('menuCoinNum').textContent = formatNum(save.coins);
  if($('menuHsNum'))   $('menuHsNum').textContent   = formatNum(save.stats.highScore || 0);
  svShowMsg($('sv-reset-msg'), '✅ Reset เรียบร้อย', 'ok');
  setTimeout(closeSaveModal, 1000);
}

// ── Helper ──
function svShowMsg(el, text, type) {
  if (!el) return;
  el.innerHTML = text;
  el.className = 'sv-msg ' + type;
  setTimeout(() => { if(el.innerHTML === text) { el.innerHTML = ''; el.className = 'sv-msg'; } }, 3000);
}

// close modal on backdrop tap
$('saveModal').addEventListener('click', e => { if(e.target === $('saveModal')) closeSaveModal(); });

// ══ DAILY BATTLE REWARD SYSTEM ══

// Dot color per day index 0–6 (Day3/Day6=premium, Day7=elite, rest=standard)
const DQ_DOT_COLORS = ['#aaaaaa','#aaaaaa','#0088ff','#aaaaaa','#aaaaaa','#0088ff','#ffcc00'];
const DQ_COLORS     = DQ_DOT_COLORS; // alias used by new updateDailyQuestUI
// Ticket type awarded each day (index 0–6)
const DQ_REWARDS    = ['standard','standard','premium','standard','standard','premium','elite'];

function getDailyRewardDate() {
  const now = new Date();
  // Daily rewards roll over at 06:00 every day, so 00:00–05:59 still counts as yesterday.
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  return now;
}

function getDailyWeekKey() {
  const now = getDailyRewardDate();
  // ISO week number: week containing first Thursday of the year.
  // Because getDailyRewardDate() applies the 06:00 cutoff, Monday before 06:00 stays in the previous week.
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7; // Sun→7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum   = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-' + String(weekNum).padStart(2, '0');
}

function getDailyTodayKey() {
  const now = getDailyRewardDate();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function checkDailyQuestReset() {
  const currentWeekKey = getDailyWeekKey();
  if (!save.dailyQuest || save.dailyQuest.weekKey !== currentWeekKey) {
    save.dailyQuest = { weekKey: currentWeekKey, streak: 0, lastClaimDate: '', claimed: [] };
    // Mark dirty so cloud reflects the week reset, even if the player closes immediately.
    // Guest mode: markSaveDirty is safe (no-op on cloud side); scheduleCloudSync guards isCloudEnabled.
    markSaveDirty('weekly_reset');
    doSave();
    scheduleCloudSync('weekly_reset', { silentToast: true });
    updateDailyQuestUI();
  }
}

function tryClaimDailyReward() {
  checkDailyQuestReset();
  const todayKey = getDailyTodayKey();
  const dq = save.dailyQuest;
  if (dq.lastClaimDate === todayKey) return; // already claimed today
  if (dq.streak >= 7) return;                // full week done

  dq.streak++;
  dq.claimed.push(dq.streak - 1);
  dq.lastClaimDate = todayKey;

  const ticketType = DQ_REWARDS[dq.streak - 1];
  if (!save.ocaTickets) save.ocaTickets = { standard:0, premium:0, elite:0 };
  save.ocaTickets[ticketType] = (save.ocaTickets[ticketType] || 0) + 1;

  markSaveDirty('daily_reward');
  doSave();
  scheduleCloudSync('daily_reward');
  if (window.CanvasVFX && window.CanvasVFX.spawnCanvasVfx) {
    window.CanvasVFX.spawnCanvasVfx('coinBurst', { count: 5 });
  }
  showDailyRewardToast(dq.streak, ticketType);
  updateDailyQuestUI();
}

function showDailyRewardToast(day, ticketType) {
  let container = document.getElementById('achievementToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'achievementToastContainer';
    container.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'z-index:10000;display:flex;flex-direction:column-reverse;gap:8px;' +
      'pointer-events:none;width:min(340px,90vw);';
    document.body.appendChild(container);
  }

  const TICKET_COLORS_TOAST = { standard:'#aaaaaa', premium:'#0088ff', elite:'#ffcc00' };
  const color = TICKET_COLORS_TOAST[ticketType] || '#aaaaaa';

  const toast = document.createElement('div');
  toast.className = 'dq-toast';
  toast.style.borderLeftColor = color;
  toast.innerHTML =
    '<div style="font-family:\'Sarabun\',sans-serif;font-size:9px;letter-spacing:3px;color:#555;">DAY ' + day + ' REWARD</div>' +
    '<div style="font-family:\'Oswald\',sans-serif;font-size:14px;letter-spacing:2px;color:white;">DAILY BATTLE REWARD</div>' +
    '<div style="font-family:\'Oswald\',sans-serif;font-size:11px;letter-spacing:2px;color:' + color + ';">OCA ' + ticketType.toUpperCase() + ' x1</div>';

  container.appendChild(toast);
  setTimeout(function() { try { toast.remove(); } catch(e) {} }, 3200);
}

function updateDailyQuestUI() {
  if (!save.dailyQuest) return;
  const { streak, claimed } = save.dailyQuest;

  document.querySelectorAll('.dq-dot').forEach(dot => {
    const day   = parseInt(dot.dataset.day);
    const color = DQ_COLORS[day];

    dot.style.animation = '';

    if (claimed.includes(day)) {
      dot.style.background  = color;
      dot.style.borderColor = color;
      dot.style.boxShadow   = '0 0 8px ' + color;
    } else if (day === streak && streak < 7) {
      dot.style.background  = 'transparent';
      dot.style.borderColor = color;
      dot.style.boxShadow   = '0 0 6px ' + color;
      dot.style.animation   = 'dqNextPulse 1.2s ease-in-out infinite';
    } else {
      dot.style.background  = '#111';
      dot.style.borderColor = '#2a2a2a';
      dot.style.boxShadow   = 'none';
    }
  });
}

// FIX 1 — OCA Ticket double-tap guard
let _ocaTicketInProgress = false;

function useOcaTicket(type) {
  // Guard: reject rapid double-taps before any state mutation
  if (_ocaTicketInProgress) return;
  if (!save.ocaTickets || (save.ocaTickets[type] || 0) <= 0) return;

  _ocaTicketInProgress = true;

  try {
    save.ocaTickets[type]--;
    markSaveDirty('card_purchase');
    doSave();
    scheduleCloudSync('card_purchase');

    // Select drop weights by ticket grade
    var weights;
    if      (type === 'premium') weights = CARD_DROP_WEIGHTS_PITY5;
    else if (type === 'elite')   weights = CARD_DROP_WEIGHTS_PITY25;
    else                         weights = CARD_DROP_WEIGHTS;

    // Roll tier
    var tiers = Object.keys(weights);
    var total = tiers.reduce(function(s, t) { return s + weights[t]; }, 0);
    var r = Math.random() * total;
    var tier = tiers[tiers.length - 1];
    for (var i = 0; i < tiers.length; i++) {
      r -= weights[tiers[i]];
      if (r <= 0) { tier = tiers[i]; break; }
    }

    // Pick random card from tier pool
    var pool = CARD_POOL.filter(function(c) { return c.rarity === tier; });
    var card = pool.length ? pool[Math.floor(Math.random() * pool.length)] : CARD_POOL[0];
    var unlocked  = getUnlockedCards();
    var isDupe    = unlocked.includes(card.id);
    var dupeCoins = isDupe ? (CARD_DUPE_COINS[card.rarity] || 50) : 0;

    _openOcaDraw(
      { card: card, tier: tier, isDupe: isDupe, dupeCoins: dupeCoins },
      function() {
        _ocaTicketInProgress = false;
        openCardCollection();
      }
    );
  } catch(e) {
    _ocaTicketInProgress = false;
    throw e;
  }
}

function updateOcaTicketUI() {
  const idMap   = { standard:'oca-std-count', premium:'oca-prm-count', elite:'oca-elt-count' };
  const cardMap = { standard:'ocaTicketCard-standard', premium:'ocaTicketCard-premium', elite:'ocaTicketCard-elite' };
  ['standard','premium','elite'].forEach(type => {
    const count = (save.ocaTickets && save.ocaTickets[type]) || 0;
    const el   = $(idMap[type]);
    const card = $(cardMap[type]);
    if (el)   el.textContent = count;
    if (card) card.classList.toggle('disabled', count === 0);
  });
}

// ══ OCA DROP SYSTEM ══
let _ocaDropCount = 0; // reset each round in initState()

const OCA_DROP_RATES = [
  { tier: 'elite',    chance: 0.0001 },
  { tier: 'premium',  chance: 0.001  },
  { tier: 'standard', chance: 0.05   },
];
const BASE_OCA_RATE_BREAK = 1.0;
const BASE_OCA_RATE_AK47_COMPLETE = 0.7; // 70% of legacy AK47-complete OCA chance
const DEBUG_OCA_DROP = false;

// ── OCA KO Multiplier ──
// After 250 lifetime KO, OCA drop rates from skill-based actions scale up every 100 KO.
// Multiplier applies to base chance only — no extra rolls, no flat additions.
// Formula: finalChance = baseChance * getOcaKoMultiplier()
function getOcaKoMultiplier() {
  const _ko = (save && save.stats && save.stats.totalKO) || 0;
  if (_ko <= 250)  return 1.00;
  if (_ko <= 350)  return 1.10;
  if (_ko <= 450)  return 1.20;
  if (_ko <= 550)  return 1.30;
  if (_ko <= 650)  return 1.40;
  if (_ko <= 750)  return 1.50;
  if (_ko <= 850)  return 1.60;
  if (_ko <= 950)  return 1.70;
  if (_ko <= 1050) return 1.80;
  if (_ko <= 1150) return 1.90;
  return 2.00;
}

// ── Zeny KO Multiplier ──
// Reduces per-KO Zeny reward after 250 lifetime KO.
// Applied at EARN TIME (normalKO, bossKO) — NOT at end-run.
// This means totalRunZeny is NEVER reduced retroactively.
// Applies ONLY to: per-KO reward at the moment it is earned.
// Does NOT affect: AK47 bomb coins, card bonuses, OCA, items, totalRunZeny pot.
// Formula: rewardThisKO = baseKoReward * getZenyKoMultiplier(totalKO)
function getZenyKoMultiplier(koCount) {
  const _ko = koCount || 0;
  if (_ko <= 250)  return 1.00;
  if (_ko <= 350)  return 0.94;
  if (_ko <= 450)  return 0.89;
  if (_ko <= 550)  return 0.84;
  if (_ko <= 650)  return 0.79;
  if (_ko <= 750)  return 0.74;
  if (_ko <= 850)  return 0.69;
  if (_ko <= 950)  return 0.64;
  if (_ko <= 1050) return 0.58;
  if (_ko <= 1150) return 0.52;
  return 0.46;
}

// rollOCA({ source, multiplier, allowBreakBoosts }) — source-scoped OCA roll.
// Returns tier string or null. One roll, no duplicate checks.
function rollOCA(opts) {
  const o = opts || {};
  const source = o.source || 'break';
  const allowBreakBoosts = !!o.allowBreakBoosts;
  const manualMultiplier = o.multiplier == null ? 1 : o.multiplier;
  const sourceBase = source === 'ak47_complete' ? BASE_OCA_RATE_AK47_COMPLETE : BASE_OCA_RATE_BREAK;
  const breakBoost = allowBreakBoosts ? getOcaKoMultiplier() : 1;
  const totalMult = Math.max(0, sourceBase * manualMultiplier * breakBoost);

  const r = Math.random();
  const eliteChance = Math.min(0.0001 * totalMult, 1);
  const premiumChance = Math.min(0.001 * totalMult, 1);
  const standardChance = Math.min(0.05 * totalMult, 1);
  const darkStakeApplied = allowBreakBoosts && manualMultiplier > 1;
  const result =
    r < eliteChance ? 'elite' :
    r < premiumChance ? 'premium' :
    r < standardChance ? 'standard' : null;

  if (DEBUG_OCA_DROP) {
    const chosenBase = source === 'ak47_complete' ? 0.05 * BASE_OCA_RATE_AK47_COMPLETE : 0.05 * BASE_OCA_RATE_BREAK;
    console.log(`[OCA] source=${source} base=${chosenBase.toFixed(4)} mult=${totalMult.toFixed(4)} final=${standardChance.toFixed(4)} result=${result ? 'drop:'+result : 'miss'} breakBoost=${breakBoost.toFixed(2)} darkStake=${darkStakeApplied ? 'yes' : 'no'}`);
  }

  return result;
}

function consumeDarkStakeOcaMultiplier() {
  const cs = window._csState;
  if (!cs || !cs.cs_darkStakeLord || !cs._darkStakeOcaBoostNextBreak) return 1;
  cs._darkStakeOcaBoostNextBreak = false;
  return 10;
}

function rollOcaFromBreakSuccess() {
  const darkStakeMult = consumeDarkStakeOcaMultiplier();
  // BEELZEBRUH: OCA chance +50% during Corruption Discharge window (8s after MAX BREAK).
  // Implemented as a ×1.5 multiplier on the existing manualMultiplier chain — additive
  // relative to base, isolated to this BREAK roll only, cannot make OCA guaranteed.
  const cs = window._csState;
  const bzMult = (cs && cs.cs_beelzebub && cs._beelzebubOcaEndTime && performance.now() < cs._beelzebubOcaEndTime)
    ? 1.5 : 1;
  return rollOCA({ source: 'break', multiplier: darkStakeMult * bzMult, allowBreakBoosts: true });
}

function rollOcaFromAk47Complete() {
  return rollOCA({ source: 'ak47_complete', multiplier: 1, allowBreakBoosts: false });
}

function awardOcaTierDrop(tier, x, y) {
  if (!tier) return;
  if (_ocaDropCount >= 10) return;
  _ocaDropCount++;
  if (!save.ocaTickets) save.ocaTickets = { standard:0, premium:0, elite:0 };
  save.ocaTickets[tier] = (save.ocaTickets[tier] || 0) + 1;
  markSaveDirty('inventory_changed');
  doSave();
  scheduleCloudSync('inventory_changed');
  showOcaDropFX(x, y, tier);
  showOcaDropToast(tier);
}

function tryOcaBombDrop(x, y) {
  awardOcaTierDrop(rollOcaFromAk47Complete(), x, y);
}

// tryOcaSkillDrop(x, y) — used by BREAK success ONLY.
// NOT called from individual weak point pickup (that was Bug 2).
// Single WP collect = no OCA roll. AK47 complete uses rollOcaFromAk47Complete() instead.
function tryOcaSkillDrop(x, y) {
  awardOcaTierDrop(rollOcaFromBreakSuccess(), x, y);
}

function showOcaDropFX(x, y, tier) {
  const TIER_COLORS = { standard:'#aaaaaa', premium:'#0088ff', elite:'#ffcc00' };
  const color = TIER_COLORS[tier] || '#aaaaaa';

  const container = $('fxLayer') || document.getElementById('gameRoot');

  const wrap = document.createElement('div');
  wrap.className = 'oca-drop-fx';
  wrap.style.left = x + 'px';
  wrap.style.top  = y + 'px';

  // image with per-tier glow filter
  const img = document.createElement('img');
  img.className = 'oca-drop-img';
  img.alt = 'OCA';
  img.decoding = 'async';

  const filterMap = {
    standard: 'drop-shadow(0 0 6px #aaaaaa)',
    premium:  'drop-shadow(0 0 8px #0088ff) drop-shadow(0 0 16px rgba(0,136,255,0.5))',
    elite:    'drop-shadow(0 0 10px #ffcc00) drop-shadow(0 0 24px rgba(255,204,0,0.6))',
  };
  img.style.filter = filterMap[tier] || '';

  // fallback: if OCA artwork fails, show a coloured circle
  img.onerror = function() {
    this.style.display = 'none';
    const fb = document.createElement('div');
    fb.className = 'oca-drop-img fallback';
    fb.style.background = color;
    fb.style.boxShadow  = '0 0 12px ' + color;
    wrap.insertBefore(fb, this);
  };
  img.src = 'old-cringe-album.webp';

  wrap.appendChild(img);

  // premium extra — pulse ring
  if (tier === 'premium') {
    const ring = document.createElement('div');
    ring.style.cssText =
      'position:absolute;inset:0;border:2px solid #0088ff;border-radius:50%;' +
      'pointer-events:none;animation:ocaPulseRing 0.6s ease-out forwards;';
    wrap.appendChild(ring);
  }

  // elite extra — 6 gold particles radiating outward
  if (tier === 'elite') {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const dx = Math.cos(angle) * (40 + Math.random() * 20);
      const dy = Math.sin(angle) * (40 + Math.random() * 20);
      const pt = document.createElement('div');
      pt.style.cssText =
        'position:absolute;width:5px;height:5px;background:#ffcc00;border-radius:50%;' +
        'top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;' +
        `--dx:${dx}px;--dy:${dy}px;` +
        'animation:particle 0.6s ease-out forwards;';
      wrap.appendChild(pt);
    }
  }

  container.appendChild(wrap);
  setTimeout(() => { try { wrap.remove(); } catch(e) {} }, 1250);
}

function showOcaDropToast(tier) {
  const TIER_COLORS = { standard:'#aaaaaa', premium:'#0088ff', elite:'#ffcc00' };
  const color = TIER_COLORS[tier] || '#aaaaaa';
  const label = tier.toUpperCase();

  let container = document.getElementById('achievementToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'achievementToastContainer';
    container.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'z-index:2000;display:flex;flex-direction:column-reverse;gap:8px;' +
      'pointer-events:none;width:min(340px,90vw);';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'oca-drop-toast';
  toast.style.borderLeft = '3px solid ' + color;

  const img = document.createElement('img');
  img.className = 'oca-toast-img';
  img.alt = 'OCA';
  img.style.filter = 'drop-shadow(0 0 6px ' + color + ')';
  img.onerror = function() {
    this.style.display = 'none';
    const fb = document.createElement('div');
    fb.style.cssText = 'width:32px;height:32px;border-radius:50%;flex-shrink:0;background:' + color + ';';
    toast.insertBefore(fb, this);
  };
  img.src = 'old-cringe-album.webp';

  const textWrap = document.createElement('div');
  textWrap.className = 'oca-toast-text';

  const lbl = document.createElement('div');
  lbl.className = 'oca-toast-label';
  lbl.textContent = 'OCA DROP!';

  const tierDiv = document.createElement('div');
  tierDiv.className = 'oca-toast-tier';
  tierDiv.style.color = color;
  tierDiv.textContent = label + ' OCA x1';

  textWrap.appendChild(lbl);
  textWrap.appendChild(tierDiv);
  toast.appendChild(img);
  toast.appendChild(textWrap);
  container.appendChild(toast);

  setTimeout(() => { try { toast.remove(); } catch(e) {} }, 3000);
}
// ══ WEEKLY CHALLENGE SYSTEM ══

// ── Week ID: resets every Monday at 06:00 local time ──
function getWeeklyId() {
  const now = new Date();
  // If Monday before 06:00 → still previous week
  const day = now.getDay(); // 0=Sun, 1=Mon
  let adj = new Date(now);
  if (day === 1 && now.getHours() < 6) {
    adj.setDate(adj.getDate() - 1); // treat as previous day (Sunday)
  }
  // Get ISO week for adj
  const d = new Date(Date.UTC(adj.getFullYear(), adj.getMonth(), adj.getDate()));
  const dayNum = d.getUTCDay() || 7; // Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

// ── Reset weekly challenge if week changed ──
function checkWeeklyChallengeReset() {
  const currentWeekId = getWeeklyId();
  if (!save.weeklyChallenge || save.weeklyChallenge.weekId !== currentWeekId) {
    save.weeklyChallenge = {
      weekId: currentWeekId,
      runsCompleted: 0,
      totalKO: 0,
      breakSuccess: 0,
      ak47Complete: 0,
      claimed: { tier1: false, tier2: false, tier3: false }
    };
    markSaveDirty('weekly_reset');
    doSave();
    scheduleCloudSync('weekly_reset', { silentToast: true });
  }
}

// ── Commit per-run counters to weekly save (called once per run at endGame) ──
function commitWeeklyProgress() {
  checkWeeklyChallengeReset();
  const wq = save.weeklyChallenge;
  wq.runsCompleted = (wq.runsCompleted || 0) + 1;
  wq.totalKO       = (wq.totalKO       || 0) + Math.max(0, Math.floor(window._wqRunKO           || 0));
  wq.breakSuccess  = (wq.breakSuccess  || 0) + Math.max(0, Math.floor(window._wqRunBreakSuccess || 0));
  wq.ak47Complete  = (wq.ak47Complete  || 0) + Math.max(0, Math.floor(window._wqRunAk47Complete || 0));
  // reset per-run counters
  window._wqRunKO           = 0;
  window._wqRunBreakSuccess = 0;
  window._wqRunAk47Complete = 0;
  markSaveDirty('weekly_reset');
  // save happens in endGame's doSave()
}

// ── Claim a weekly tier reward (double-tap guarded) ──
let _wqClaimInProgress = false;
function wqClaimTier(tier) {
  if (_wqClaimInProgress) return;
  _wqClaimInProgress = true;
  try {
    checkWeeklyChallengeReset();
    const wq = save.weeklyChallenge;
    const key = 'tier' + tier;
    if (wq.claimed[key]) { _wqClaimInProgress = false; return; } // already claimed
    if (!wqTierIsComplete(tier)) { _wqClaimInProgress = false; return; } // not complete

    // Grant rewards — Premium OCA or Elite OCA only (no Standard)
    if (!save.ocaTickets) save.ocaTickets = { standard: 0, premium: 0, elite: 0 };
    if (tier === 1) {
      save.ocaTickets.premium = (save.ocaTickets.premium || 0) + 2;
      save.coins = (save.coins || 0) + 1000;
    } else if (tier === 2) {
      save.ocaTickets.premium = (save.ocaTickets.premium || 0) + 3;
      save.coins = (save.coins || 0) + 3000;
    } else if (tier === 3) {
      save.ocaTickets.elite   = (save.ocaTickets.elite   || 0) + 1;
      save.ocaTickets.premium = (save.ocaTickets.premium || 0) + 3;
      save.coins = (save.coins || 0) + 5000;
    }
    wq.claimed[key] = true;
    markSaveDirty('weekly_reset');
    doSave();
    scheduleCloudSync('weekly_reset'); // background, non-blocking
    if (window.CanvasVFX && window.CanvasVFX.spawnCanvasVfx) {
      window.CanvasVFX.spawnCanvasVfx('coinBurst', { count: tier >= 3 ? 9 : 7 });
    }
    updateWeeklyBadgesUI();
    renderWeeklyPanel();
    updateShopCoinUI();
    showWeeklyClaimToast(tier);
  } finally {
    setTimeout(() => { _wqClaimInProgress = false; }, 600); // double-tap guard
  }
}

// ── Check if a tier's objectives are met ──
function wqTierIsComplete(tier) {
  const wq = save.weeklyChallenge;
  if (!wq) return false;
  if (tier === 1) return (wq.runsCompleted || 0) >= 5;
  if (tier === 2) return (wq.totalKO       || 0) >= 3000;
  if (tier === 3) return (wq.breakSuccess  || 0) >= 40 && (wq.ak47Complete || 0) >= 60;
  return false;
}

// ── Update the 3 weekly badge dots on the widget ──
function updateWeeklyBadgesUI() {
  checkWeeklyChallengeReset();
  const wq = save.weeklyChallenge;
  [1, 2, 3].forEach(t => {
    const badge = document.querySelector('.wq-badge[data-tier="' + t + '"]');
    if (!badge) return;
    const claimed = wq.claimed['tier' + t];
    const complete = wqTierIsComplete(t);
    badge.className = 'wq-badge ' + (claimed ? 'wq-claimed' : complete ? 'wq-ready' : 'wq-incomplete');
  });
}

// ── Render the weekly panel inside the modal ──
function renderWeeklyPanel() {
  checkWeeklyChallengeReset();
  const wq = save.weeklyChallenge;

  const TIERS = [
    { n: 1, goal1: wq.runsCompleted, max1: 5,    goal2: null, max2: null,    key: 'tier1' },
    { n: 2, goal1: wq.totalKO,       max1: 3000,  goal2: null, max2: null,    key: 'tier2' },
    { n: 3, goal1: wq.breakSuccess,  max1: 40,    goal2: wq.ak47Complete, max2: 60, key: 'tier3' },
  ];

  TIERS.forEach(t => {
    const claimed  = wq.claimed[t.key];
    const complete = wqTierIsComplete(t.n);
    const card = $('wqCard' + t.n);
    if (!card) return;

    // card class
    card.className = 'wq-tier-card' + (t.n === 3 ? ' tier-3' : '') +
      (claimed ? ' tier-claimed' : complete ? ' tier-complete' : '');

    // status label
    const statusEl = $('wqStatus' + t.n);
    if (statusEl) statusEl.textContent = claimed ? 'CLAIMED' : complete ? 'READY' : 'IN PROGRESS';

    // bars + nums for tier 1 and tier 2
    if (t.n <= 2) {
      const bar  = $('wqBar' + t.n);
      const prog = $('wqProg' + t.n);
      const pct  = $('wqPct' + t.n);
      const ratio = Math.min(1, (t.goal1 || 0) / t.max1);
      if (bar)  bar.style.width  = (ratio * 100).toFixed(1) + '%';
      if (prog) prog.textContent = (t.goal1 || 0).toLocaleString() + ' / ' + t.max1.toLocaleString();
      if (prog) prog.className   = ratio >= 1 ? 'done' : '';
      if (pct)  pct.textContent  = Math.round(ratio * 100) + '%';
    }

    // tier 3: two bars
    if (t.n === 3) {
      const ra = Math.min(1, (wq.breakSuccess || 0) / 40);
      const rb = Math.min(1, (wq.ak47Complete || 0) / 60);
      const bar3a = $('wqBar3a'); const bar3b = $('wqBar3b');
      const prog3a = $('wqProg3a'); const prog3b = $('wqProg3b');
      if (bar3a)  bar3a.style.width  = (ra * 100).toFixed(1) + '%';
      if (bar3b)  bar3b.style.width  = (rb * 100).toFixed(1) + '%';
      if (prog3a) { prog3a.textContent = (wq.breakSuccess || 0) + ' / 40'; prog3a.className = ra >= 1 ? 'done' : ''; }
      if (prog3b) { prog3b.textContent = (wq.ak47Complete || 0) + ' / 60'; prog3b.className = rb >= 1 ? 'done' : ''; }
    }

    // claim button
    const btn = $('wqClaimBtn' + t.n);
    if (!btn) return;
    btn.onclick = () => wqClaimTier(t.n);
    if (claimed) {
      btn.disabled   = true;
      btn.className  = 'wq-claim-btn btn-claimed';
      btn.textContent = '✓ CLAIMED';
      btn.onclick = null;
    } else if (complete) {
      btn.disabled   = false;
      btn.className  = 'wq-claim-btn btn-claim' + (t.n === 3 ? ' btn-tier3' : '');
      btn.textContent = 'CLAIM REWARD';
    } else {
      btn.disabled   = true;
      btn.className  = 'wq-claim-btn btn-inprog';
      btn.textContent = 'IN PROGRESS';
    }
  });

  // reset note
  const note = $('wqResetNote');
  if (note) note.textContent = 'Week: ' + (wq.weekId || '—') + ' · Resets Monday 06:00';
}

// ── Render the daily panel inside the modal ──
function renderDailyPanel() {
  checkDailyQuestReset();
  const dq = save.dailyQuest;
  const grid = $('rmDailyGrid');
  const info = $('rmDailyInfo');
  if (!grid) return;
  grid.innerHTML = '';
  const DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const TIER_LABEL = { standard: 'STD', premium: 'PRE', elite: 'ELT' };
  for (let i = 0; i < 7; i++) {
    const claimed  = dq.claimed && dq.claimed.includes(i);
    const isNext   = !claimed && i === (dq.streak || 0) && (dq.streak || 0) < 7;
    const color    = DQ_COLORS[i] || '#aaa';
    const tierName = TIER_LABEL[DQ_REWARDS[i]] || 'STD';
    const cell = document.createElement('div');
    cell.className = 'rm-day-cell' + (claimed ? ' day-claimed' : isNext ? ' day-next' : '');
    cell.style.setProperty('--color', color);
    cell.innerHTML =
      '<div class="rm-day-num">' + (i + 1) + '</div>' +
      '<div class="rm-day-dot"></div>' +
      '<div class="rm-day-tier">' + tierName + '</div>';
    grid.appendChild(cell);
  }
  if (info) {
    if (dq.streak >= 7) {
      info.textContent = 'Week complete! Resets next Monday 06:00';
    } else {
      const todayKey = getDailyTodayKey();
      const claimed  = dq.lastClaimDate === todayKey;
      info.textContent = claimed
        ? 'Today\'s reward claimed — Day ' + dq.streak + ' / 7'
        : 'Day ' + ((dq.streak || 0) + 1) + ' reward available — play a run!';
    }
  }
}

// ── Open / close rewards modal ──
let _rmCurrentTab = 'daily';
function openRewardsModal() {
  checkDailyQuestReset();
  checkWeeklyChallengeReset();
  renderDailyPanel();
  renderWeeklyPanel();
  rmSwitchTab(_rmCurrentTab);
  $('rewardsModal').classList.add('open');
}
function closeRewardsModal() {
  $('rewardsModal').classList.remove('open');
}
// Close on backdrop click
$('rewardsModal').addEventListener('click', e => { if (e.target === $('rewardsModal')) closeRewardsModal(); });

function rmSwitchTab(tab) {
  _rmCurrentTab = tab;
  const tabDaily  = $('rmTabDaily');
  const tabWeekly = $('rmTabWeekly');
  const panelD    = $('rmPanelDaily');
  const panelW    = $('rmPanelWeekly');
  if (!tabDaily || !panelD) return;
  tabDaily.className  = 'rm-tab' + (tab === 'daily'  ? ' active-daily'  : '');
  tabWeekly.className = 'rm-tab' + (tab === 'weekly' ? ' active-weekly' : '');
  panelD.className  = 'rm-panel' + (tab === 'daily'  ? ' active' : '');
  panelW.className  = 'rm-panel' + (tab === 'weekly' ? ' active' : '');
}

// ── Small toast after weekly claim ──
function showWeeklyClaimToast(tier) {
  let container = document.getElementById('achievementToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'achievementToastContainer';
    container.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'z-index:10000;display:flex;flex-direction:column-reverse;gap:8px;' +
      'pointer-events:none;width:min(340px,90vw);';
    document.body.appendChild(container);
  }
  const REWARD_TEXT = {
    1: 'PREMIUM OCA ×2 + 1,000 ZENY',
    2: 'PREMIUM OCA ×3 + 3,000 ZENY',
    3: 'ELITE OCA ×1 + PREMIUM OCA ×3 + 5,000 ZENY',
  };
  const color = tier === 3 ? 'var(--gold)' : 'var(--cyan)';
  const toast = document.createElement('div');
  toast.className = 'dq-toast';
  toast.style.borderLeftColor = color;
  toast.innerHTML =
    '<div style="font-family:\'Sarabun\',sans-serif;font-size:9px;letter-spacing:3px;color:#555;">WEEKLY TIER ' + ['Ⅰ','Ⅱ','Ⅲ'][tier-1] + ' REWARD</div>' +
    '<div style="font-family:\'Oswald\',sans-serif;font-size:13px;letter-spacing:2px;color:white;">WEEKLY CHALLENGE</div>' +
    '<div style="font-family:\'Sarabun\',sans-serif;font-size:10px;letter-spacing:1px;color:' + color + ';">' + (REWARD_TEXT[tier]||'') + '</div>';
  container.appendChild(toast);
  setTimeout(() => { try { toast.remove(); } catch(e) {} }, 3500);
}

// ══ END WEEKLY CHALLENGE SYSTEM ══

// ════════════════════ CARD MASTERY (เดิม inline block #3) ════════════════════
// ══ CARD MASTERY SYSTEM ══
// Hidden progression. Backend tracks runs. Only visuals are revealed.
// Players discover NORMAL → GLOSSY → PRISMATIC organically.
// ─────────────────────────────────────────────────────────────────────

const CM_TIER = { NORMAL: 'normal', GLOSSY: 'glossy', PRISMATIC: 'prismatic' };
const CM_GLOSSY_THRESHOLD    = 10;
const CM_PRISMATIC_THRESHOLD = 30;

// ── Backend: run count read/write ──────────────────────────────────────

function cmGetRuns(cardId) {
  if (!save.cardRuns || typeof save.cardRuns !== 'object') save.cardRuns = {};
  return Math.max(0, Math.floor(Number(save.cardRuns[cardId]) || 0));
}

function cmGetTier(cardId) {
  const runs = cmGetRuns(cardId);
  if (runs >= CM_PRISMATIC_THRESHOLD) return CM_TIER.PRISMATIC;
  if (runs >= CM_GLOSSY_THRESHOLD)    return CM_TIER.GLOSSY;
  return CM_TIER.NORMAL;
}

// Records a run and returns the new tier if an evolution just occurred,
// or null if no tier change happened.
function cmRecordRun(cardId) {
  if (!cardId) return null;
  if (!save.cardRuns || typeof save.cardRuns !== 'object') save.cardRuns = {};
  const prevRuns = cmGetRuns(cardId);
  const prevTier = cmGetTier(cardId);
  save.cardRuns[cardId] = prevRuns + 1;
  const newTier = cmGetTier(cardId);
  return (newTier !== prevTier) ? newTier : null;
}

// ── Visual: apply mastery overlay class to an element ─────────────────

function cmApplyVisual(wrapEl, cardId) {
  if (!wrapEl) return;
  wrapEl.classList.remove('cm-glossy-wrap', 'cm-prismatic-wrap');
  const tier = cmGetTier(cardId);
  if (tier === CM_TIER.PRISMATIC)    wrapEl.classList.add('cm-prismatic-wrap');
  else if (tier === CM_TIER.GLOSSY)  wrapEl.classList.add('cm-glossy-wrap');
}

// ── UI: collection grid — visual only, no text ────────────────────────

function cmDecorateCollectionCard(ccCardDiv, card) {
  if (!ccCardDiv || !card) return;
  ccCardDiv.style.position = 'relative';
  cmApplyVisual(ccCardDiv, card.id);
}

// ── UI: card modal — visual on image only, no text row ────────────────

function cmUpdateModalMastery(cardId) {
  cmApplyVisual(document.getElementById('cardModalImg'), cardId);
}

// ── UI: card slot screen — visual on img only, no runs label ──────────

function cmDecorateCardSlotCard(csCardDiv, card) {
  if (!csCardDiv || !card) return;
  cmApplyVisual(csCardDiv.querySelector('.cs-card-img'), card.id);
}

// ── UI: in-game active card display ───────────────────────────────────

function cmUpdateActiveCardDisplay(cardId) {
  cmApplyVisual(document.getElementById('lodCardImg'), cardId);
}

// ── Discovery moment: subtle toast on tier evolution ──────────────────
// Called from endGame after cmRecordRun returns a new tier.
// Fires after result screen is visible so it overlays cleanly.

let _cmEvolveToastTimer = null;

function cmShowEvolutionReveal(newTier) {
  const toast = document.getElementById('cmEvolveToast');
  const main  = document.getElementById('cmEvolveToastMain');
  if (!toast || !main) return;

  // Clear any existing animation cleanly
  if (_cmEvolveToastTimer) { clearTimeout(_cmEvolveToastTimer); _cmEvolveToastTimer = null; }
  toast.className = '';
  void toast.offsetWidth; // reflow

  main.textContent = newTier === CM_TIER.PRISMATIC ? 'CARD EVOLVED' : 'CARD EVOLVED';
  toast.className = 'show ' + newTier;

  _cmEvolveToastTimer = setTimeout(() => {
    toast.className = '';
    _cmEvolveToastTimer = null;
  }, 2400);
}
// ══ END CARD MASTERY SYSTEM ══

// ════════════════════ STAGE 2A — INLINE HANDLER BRIDGE ════════════════════
// index.html มี inline handler (onclick=/onerror= ทั้งแบบ static และที่สร้างจาก
// template string) ที่เรียกฟังก์ชันเหล่านี้แบบ global. พอย้ายมาเป็น ES module โค้ด
// จะอยู่ใน module scope (strict) ฟังก์ชันจึงไม่ถูกผูกบน window อัตโนมัติ — ต้อง bridge
// ไว้จนกว่าจะแปลง handler ทั้งหมดเป็น addEventListener ใน phase ถัดไป.
Object.assign(window, {
  // ── navigation / run lifecycle ──
  startGame, goMainMenu, retryGame, pauseGame, resumeGame, pauseGoMainMenu,
  // ── exposed for Boss Loop Hero mode (separate overlay) ──
  showMainMenu, stopBGM, playBGM,
  // ── shop / upgrades / equipment ──
  openShop, closeShop, buyItem,
  // ── boss & arena skins ──
  openBossShop, closeBossShop, buyBossSkin, applySkin,
  openBossSkinPreview, closeBossSkinPreview,
  openArenaShop, closeArenaShop, buyArena, applyArena,
  // ── OCA ──
  buyOCA, confirmOCA, cancelOCA, useOcaTicket,
  // ── cards ──
  openCardCollection, closeCardCollection, closeCardModal,
  collectCard, revealCard,
  // ── pre-run reroll (card slot) ──
  _csBack, _csConfirmClick, _csRerollClick,
  _rerollConfirmCancel, _rerollConfirmExecute,
  // ── rewards / weekly ──
  openRewardsModal, closeRewardsModal, rmSwitchTab, wqClaimTier,
  // ── save / cloud ──
  openSaveModal, closeSaveModal, svSwitchTab,
  svCloudUpload, svCloudDownload, svConfirmReset, svToggleSecret, svToggleLoadKey,
  svCloudOnIdChange, svSecretKeydown,
  // ── settings ──
  toggleSetting, setSettingVolume, setFlashEffect,
});
