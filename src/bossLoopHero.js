// ════════════════════════════════════════════════════════════════════════════
// BOSS LOOP HERO MODE — โหมดแยกอิสระแบบ Loop Hero (MVP)
// ────────────────────────────────────────────────────────────────────────────
// โหมดนี้ "แยกขาด" จากเกมหลักทั้งหมด:
//   • state แยก (BLH.run / BLH.save)
//   • progression แยก (Arena Training upgrades)
//   • currency แยก  (Loop Zeny — ไม่ยุ่งกับ save.coins ของเกมหลัก)
//   • localStorage key แยก ('noctisak47_blh')
//
// ทุกอย่างเป็น data-driven (configs ด้านล่าง) เพื่อให้เพิ่ม stage / boss pool /
// enemy / gear / upgrade ในอนาคตได้ง่าย โดยไม่แก้ engine.
//
// ทุก screen ของโหมดนี้ถูกสร้างแบบ dynamic ใน #blhRoot (overlay เต็มจอ) — ไม่ไป
// แตะ DOM ของเกมหลัก. การเข้า/ออกโหมดทำผ่าน window bridge ของเกมหลัก
// (showMainMenu / startGame / stopBGM).
//
// ภาษาในโค้ด/UI = ไทย (ตาม convention ของโปรเจกต์)
// ════════════════════════════════════════════════════════════════════════════

const LS_KEY = 'noctisak47_blh';

// ── helpers ──────────────────────────────────────────────────────────────────
const rnd  = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt  = n => {
  n = Math.round(n);
  if (n >= 1000) return n.toLocaleString();
  return String(n);
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

// ════════════════════════════════════════════════════════════════════════════
// CONFIG — DATA DRIVEN
// ════════════════════════════════════════════════════════════════════════════

// ── โหมดเล่น (Mode Select) ───────────────────────────────────────────────────
const MODES = [
  {
    id: 'classic',
    name: 'CLASSIC MODE',
    sub: 'NOCTISAK47: OVERDRIVE RAMPAGE',
    desc: 'โหมดต้นฉบับ — กดให้แรง กดให้เร็ว สาย Action Clicker + การ์ดสุ่ม',
    icon: '🥊',
    accent: '#ff2233',
    action: 'classic',
  },
  {
    id: 'blh',
    name: 'BOSS LOOP HERO',
    sub: 'AUTO-BATTLE LOOP',
    desc: 'วางแผน เดินวนแผนที่ เก็บลูท จัดเกียร์ วางเทอเรน แล้วล้มบอส',
    icon: '🗺️',
    accent: '#33ddff',
    action: 'blh',
  },
];

// ── ฮีโร่ที่เล่นได้ (ใช้ asset boss ตัวละครเดิม) ──────────────────────────────
const HEROES = [
  {
    id: 'noctisak47',
    name: 'NOCTISAK47',
    img: 'boxer.png',
    icon: 'boxer_icon.webp',
    role: 'BALANCED BOXER',
    blurb: 'ดาเมจสมดุล ทนทานพอตัว — เหมาะกับมือใหม่ของโหมดนี้',
    base: { hp: 110, atk: 13, def: 4 },
  },
  {
    id: 'toei',
    name: 'TOEI',
    img: 'toei_boxer.png',
    icon: 'toei_boxer_icon.webp',
    role: 'GLASS BRAWLER',
    blurb: 'ATK สูง HP ต่ำ — จบไวแต่ต้องพึ่งเกียร์/เทอเรนช่วยเอาตัวรอด',
    base: { hp: 90, atk: 16, def: 3 },
  },
  {
    id: 'apologize',
    name: 'APOLOGIZE',
    img: 'apologize.png',
    icon: 'apologize_icon.webp',
    role: 'IRON WALL',
    blurb: 'HP/DEF สูง ดาเมจกลาง — วนลูปได้นานเพื่อสะสมลูท',
    base: { hp: 140, atk: 11, def: 6 },
  },
];

// ── enemy roster (5 ตัว) — curate จาก standard/premium card assets เท่านั้น ──
// ตัด " CARD" ออกจากชื่อที่แสดง ตาม ASSET RULES
const ENEMIES = [
  { id: 'poporingo',   name: 'POPORINGO',    img: 'cards/poporingo.png',   role: 'basic',  base: { hp: 30, atk: 6,  def: 1 } },
  { id: 'pekopeko',    name: 'PEKO PEKO',    img: 'cards/peko_peko.png',   role: 'fast',   base: { hp: 24, atk: 9,  def: 0 } },
  { id: 'orcworrier',  name: 'ORC WORRIER',  img: 'cards/orc_worrier.png', role: 'tank',   base: { hp: 64, atk: 5,  def: 4 } },
  { id: 'mommy',       name: 'MOMMY',        img: 'cards/mommy.png',       role: 'cursed', base: { hp: 38, atk: 7,  def: 2 } },
  { id: 'skillworker', name: 'SKILL WORKER', img: 'cards/skill_worker.png',role: 'elite',  base: { hp: 82, atk: 11, def: 5 } },
];
const ENEMY_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

const ROLE_LABEL = {
  basic:  'BASIC',
  fast:   'FAST',
  tank:   'TANK',
  cursed: 'CURSED',
  elite:  'ELITE',
};

// ── minions (ใช้ card assets เช่นกัน) ────────────────────────────────────────
const MINIONS = {
  hungerfly: { id: 'hungerfly', name: 'HUNGER FLY', img: 'cards/hunger_fly.png', base: { hp: 60,  atk: 9,  def: 2 } },
  snore:     { id: 'snore',     name: 'SNORE',      img: 'cards/snore.png',      base: { hp: 75,  atk: 7,  def: 3 } },
  zoombie:   { id: 'zoombie',   name: 'ZOOMBIE',    img: 'cards/zoombie.png',    base: { hp: 90,  atk: 8,  def: 4 } },
};

// ── บอส (ใช้ boss skin assets + ชื่อเป๊ะตามเดิม) ─────────────────────────────
// future stage boss pool พร้อมต่อยอด — กำลังรวมใกล้เคียงกันแต่สไตล์/มินเนียนต่าง
const BOSSES = {
  suang: {
    id: 'suang', name: 'SUANG', img: 'suang.png', icon: 'suang_icon.webp',
    blurb: 'เจ้าแห่งสังเวียน Stage 1 — มาพร้อมลูกสมุน 2 ตัว',
    base: { hp: 420, atk: 16, def: 6 },
    minions: ['hungerfly', 'snore'],
  },
  // ── FUTURE BOSS HOOKS (ยังไม่เปิดใน MVP) ──
  xuang: {
    id: 'xuang', name: 'XUANG', img: 'xuang.png', icon: 'xuang_icon.webp',
    blurb: 'สายเลือดเดือด — ดาเมจสูง',
    base: { hp: 360, atk: 20, def: 5 },
    minions: ['hungerfly', 'hungerfly'],
  },
  morgan: {
    id: 'morgan', name: 'ARTHUR MORGAN', img: 'morgan.png', icon: 'morgan_icon.webp',
    blurb: 'มือปืนเก๋าเกม — สมดุลรอบด้าน',
    base: { hp: 440, atk: 15, def: 7 },
    minions: ['snore', 'snore'],
  },
  rukawa: {
    id: 'rukawa', name: 'RUKAWA', img: 'rukawa.png', icon: 'rukawa_icon.webp',
    blurb: 'จอมเทคนิค — สมุนอึด',
    base: { hp: 400, atk: 14, def: 8 },
    minions: ['zoombie', 'zoombie'],
  },
};

// ── stage definitions (data-driven; เพิ่ม stage ใหม่ได้ง่าย) ─────────────────
const STAGES = [
  {
    id: 'stage1',
    name: 'STAGE 1 — RAJADAMNERN',
    flavor: 'สังเวียนเปิดศึก เดินวนสะสมกำลังก่อนเรียกบอส',
    unlocked: true,
    bossDefault: 'suang',                       // MVP boss
    bossPool: ['suang'],                        // MVP: ใช้ตัวเดียว
    futureBossPool: ['xuang', 'morgan', 'rukawa'], // hook อนาคต (กำลังใกล้เคียงกัน)
  },
  // future stages: { id:'stage2', ..., bossPool:[...], unlocked:false }
];

// ── map / terrain cards (รวม 9 ใบ: 3 Road / 3 Adjacent / 3 Terrain) ──────────
// terrain ใช้ new assets → ใช้ emoji placeholder ชั่วคราว (ASSET RULES อนุญาต)
const MAP_CARDS = [
  // ── ROAD (เพิ่มความอันตราย/ของรางวัลบนถนน) ──
  { id: 'spawn_rift',  name: 'รอยแยกศัตรู', kind: 'road', icon: '🌀', accent: '#ff5577',
    desc: 'เสกศัตรูลงช่องถนนว่าง 1 ตัวทันที + ลูทดีขึ้นรอบนั้น' },
  { id: 'pack_howl',   name: 'เสียงหอนฝูง', kind: 'road', icon: '🐺', accent: '#ff5577',
    desc: 'ศัตรูบนถนนทุกตัวแกร่งขึ้น +20% แต่ดรอป Loop Zeny มากขึ้น' },
  { id: 'blood_track', name: 'รอยเลือด',    kind: 'road', icon: '🩸', accent: '#ff5577',
    desc: 'เพิ่มโอกาสดรอป Boss Signal บนถนนนี้' },
  // ── ADJACENT (วางข้างถนน เสริมบัฟ/รีวอร์ด) ──
  { id: 'campfire',    name: 'กองไฟ',       kind: 'adjacent', icon: '🔥', accent: '#ffcc44',
    desc: 'ฟื้น HP ฮีโร่ +6 ทุกครั้งที่เดินผ่านช่องติดกัน' },
  { id: 'shrine',      name: 'ศาลเจ้า',     kind: 'adjacent', icon: '⛩️', accent: '#ffcc44',
    desc: 'ATK +2 ถาวรตลอดรอบรัน' },
  { id: 'lucky_totem', name: 'โทเทมนำโชค',  kind: 'adjacent', icon: '🍀', accent: '#ffcc44',
    desc: 'โอกาสดรอปลูท +12% ตลอดรอบรัน' },
  // ── TERRAIN (วางช่องเทอเรน เปลี่ยนสนาม) ──
  { id: 'rock',        name: 'หินผา',       kind: 'terrain', icon: '🪨', accent: '#88ddaa',
    desc: 'DEF +3 ถาวรตลอดรอบรัน' },
  { id: 'thornfield',  name: 'ทุ่งหนาม',    kind: 'terrain', icon: '🌵', accent: '#88ddaa',
    desc: 'ศัตรูเสีย HP เริ่มต้น -15% แต่ฮีโร่ก็เจ็บ +1 ต่อตา' },
  { id: 'treasure',    name: 'ลานสมบัติ',   kind: 'terrain', icon: '💎', accent: '#88ddaa',
    desc: 'อัปเกรด tier ลูทขึ้น 1 ขั้นตลอดรอบรัน' },
];
const MAP_CARD_BY_ID = Object.fromEntries(MAP_CARDS.map(c => [c.id, c]));

// ── boss signal (การ์ดเป้าหมายรัน) ──────────────────────────────────────────
const BOSS_SIGNAL = { id: 'boss_signal', name: 'BOSS SIGNAL', icon: '📡', accent: '#ff2233' };

// ── gear: 4 ช่อง + 4 tier (Ragnarok parody / new assets → emoji placeholder) ─
const GEAR_SLOTS = [
  { id: 'glove',  name: 'GLOVE',  icon: '🥊' },
  { id: 'jacket', name: 'JACKET', icon: '🧥' },
  { id: 'boots',  name: 'BOOTS',  icon: '🥾' },
  { id: 'charm',  name: 'CHARM',  icon: '🔮' },
];
const GEAR_SLOT_IDS = GEAR_SLOTS.map(s => s.id);

// tier scale ตาม loop — ยิ่งวนนานยิ่งได้ของดี
const GEAR_TIERS = [
  { id: 'street',  name: 'STREET',  color: '#9aa0a6', statMin: 2,  statMax: 6,  rank: 0 },
  { id: 'veteran', name: 'VETERAN', color: '#4fc3f7', statMin: 5,  statMax: 12, rank: 1 },
  { id: 'elite',   name: 'ELITE',   color: '#b388ff', statMin: 10, statMax: 20, rank: 2 },
  { id: 'mythic',  name: 'MYTHIC',  color: '#ffd54f', statMin: 18, statMax: 32, rank: 3 },
];
const GEAR_TRAITS = [
  { id: 'crit',  label: '+5% โอกาสคริติคอล' },
  { id: 'lifesteal', label: 'ดูดเลือด 8% ของดาเมจ' },
  { id: 'thorns', label: 'สะท้อนดาเมจ 15%' },
  { id: 'guard', label: 'ลดดาเมจที่รับ 10%' },
  { id: 'greed', label: 'Loop Zeny ดรอป +10%' },
  { id: 'none',  label: '—' },
];

// gear-slot ไหนเอนเอียง stat ไหน (ให้ของมีคาแรกเตอร์)
const SLOT_STAT_BIAS = {
  glove:  'atk',
  jacket: 'hp',
  boots:  'def',
  charm:  'atk',
};

// ── Arena Training (permanent upgrades — ใช้ร่วมทุกฮีโร่, แยกจากเกมหลัก) ─────
const UPGRADES = [
  { id: 'startHp',    name: 'START HP',        icon: '❤️', desc: '+12 HP เริ่มต้น/เลเวล',         max: 5, costBase: 60,  costGrow: 1.6, per: 12 },
  { id: 'startAtk',   name: 'START ATK',       icon: '⚔️', desc: '+1 ATK เริ่มต้น/เลเวล',         max: 5, costBase: 80,  costGrow: 1.7, per: 1  },
  { id: 'startDef',   name: 'START DEF',       icon: '🛡️', desc: '+1 DEF เริ่มต้น/เลเวล',         max: 5, costBase: 70,  costGrow: 1.7, per: 1  },
  { id: 'lootChance', name: 'LOOT CHANCE',     icon: '🎁', desc: '+5% โอกาสดรอปลูท/เลเวล',        max: 5, costBase: 90,  costGrow: 1.7, per: 0.05 },
  { id: 'higherTier', name: 'HIGHER TIER',     icon: '✨', desc: '+8% โอกาสลูท tier สูงขึ้น/เลเวล', max: 5, costBase: 120, costGrow: 1.8, per: 0.08 },
  { id: 'extraCard',  name: 'EXTRA MAP CARD',  icon: '🃏', desc: '+1 การ์ดแผนที่เริ่มต้น/เลเวล',   max: 3, costBase: 150, costGrow: 2.0, per: 1  },
  { id: 'campHeal',   name: 'CAMP RECOVERY',   icon: '⛺', desc: 'ฟื้น HP +8%/เลเวล เมื่อถึง Camp', max: 5, costBase: 100, costGrow: 1.7, per: 0.08 },
  { id: 'safeDeath',  name: 'SAFER DEATH',     icon: '🪽', desc: 'ฟื้นคืนชีพ 1 ครั้ง/รัน ที่ HP +15%/เลเวล', max: 4, costBase: 200, costGrow: 2.1, per: 0.15 },
];
const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// ── balance constants ────────────────────────────────────────────────────────
const BAL = {
  TILES: 12,                 // ช่องถนนรวม (วงรี)
  TARGET_LOOPS: [6, 8],      // เป้าหมายความยาวรันโดยเฉลี่ย
  BASE_LOOT_CHANCE: 0.45,
  BASE_SPAWN_CHANCE: 0.30,   // โอกาสเสกศัตรูในช่องว่างต่อ loop
  ENEMY_LOOP_SCALE: 0.17,    // ศัตรูแกร่งขึ้นต่อ loop
  BOSS_SIGNAL_MIN_LOOP: 4,   // เริ่มดรอปได้จริงราว loop 4+
  WALK_MS: 820,
  BATTLE_MS: 620,
  BATTLE_MS_FAST: 120,
  CASHOUT_PER_LOOP: 40,
  BOSS_BONUS: 350,
};

// ════════════════════════════════════════════════════════════════════════════
// SAVE (แยก localStorage key, แยก currency = Loop Zeny)
// ════════════════════════════════════════════════════════════════════════════
function blhDefaultSave() {
  return {
    version: 1,
    loopZeny: 0,
    upgrades: {},      // { [upgradeId]: level }
    lastHero: 'noctisak47',
    stats: { runs: 0, bossKills: 0, bestLoops: 0 },
  };
}

function blhLoadSave() {
  let data;
  try { data = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { data = null; }
  const def = blhDefaultSave();
  if (!data || typeof data !== 'object') return def;
  // normalize (seed default ที่ขาด เพื่อรองรับ schema เปลี่ยนในอนาคต)
  data.version  = data.version || 1;
  data.loopZeny = Math.max(0, Math.floor(data.loopZeny || 0));
  data.upgrades = (data.upgrades && typeof data.upgrades === 'object') ? data.upgrades : {};
  data.lastHero = data.lastHero || def.lastHero;
  data.stats    = Object.assign({}, def.stats, data.stats || {});
  return data;
}

function blhSaveSave() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(BLH.save)); } catch (e) {}
}

// upgrade helpers
function upgLevel(id)  { return BLH.save.upgrades[id] | 0; }
function upgValue(id)  { return upgLevel(id) * (UPGRADE_BY_ID[id]?.per || 0); }
function upgCost(u, lvl) { return Math.round(u.costBase * Math.pow(u.costGrow, lvl)); }

// ════════════════════════════════════════════════════════════════════════════
// TOP-LEVEL STATE
// ════════════════════════════════════════════════════════════════════════════
const BLH = {
  save: blhDefaultSave(),
  sel: { heroId: null, stageId: null, bossId: null }, // pre-run selection
  run: null,        // active run state (run-only)
  screen: null,     // current screen id
  _walkTimer: null,
  _battle: null,    // active battle controller
};

const q = id => document.getElementById(id);
function root() { return q('blhRoot'); }

// ════════════════════════════════════════════════════════════════════════════
// SCREEN ROUTER
// ════════════════════════════════════════════════════════════════════════════
function blhEnter() {
  // ออกจากเมนูหลัก เข้าสู่ overlay ของโหมด
  BLH.save = blhLoadSave();
  const mm = q('mainMenu'); if (mm) mm.style.display = 'none';
  const dq = q('dailyQuestWidget'); if (dq) dq.classList.remove('visible');
  const r = root();
  r.style.display = 'flex';
}

function blhExitToMenu() {
  blhAbortTimers();
  BLH.run = null;
  const r = root();
  r.style.display = 'none';
  r.innerHTML = '';
  if (typeof window.showMainMenu === 'function') window.showMainMenu();
  else { const mm = q('mainMenu'); if (mm) mm.style.display = 'flex'; }
}

function blhAbortTimers() {
  if (BLH._walkTimer) { clearTimeout(BLH._walkTimer); BLH._walkTimer = null; }
  if (BLH._battle && BLH._battle.timer) { clearTimeout(BLH._battle.timer); }
  BLH._battle = null;
}

// render เปลี่ยนหน้า: เคลียร์ overlay ย่อย แล้ววาดใหม่
function setScreen(id, html) {
  BLH.screen = id;
  root().innerHTML = `<div class="blh-screen" id="blh-${id}">${html}</div>`;
  root().scrollTop = 0;
}

// ════════════════════════════════════════════════════════════════════════════
// 1) MODE SELECT
// ════════════════════════════════════════════════════════════════════════════
function blhOpenModeSelect() {
  blhEnter();
  renderModeSelect();
}

function renderModeSelect() {
  const cards = MODES.map(m => `
    <button class="blh-mode-card" style="--accent:${m.accent}" onclick="blh.pickMode('${m.id}')">
      <div class="blh-mode-icon">${m.icon}</div>
      <div class="blh-mode-text">
        <div class="blh-mode-name">${esc(m.name)}</div>
        <div class="blh-mode-sub">${esc(m.sub)}</div>
        <div class="blh-mode-desc">${esc(m.desc)}</div>
      </div>
      <div class="blh-mode-go">▶</div>
    </button>
  `).join('');
  setScreen('mode', `
    <div class="blh-head">
      <button class="blh-back" onclick="blh.backHome()">‹ HOME</button>
      <div class="blh-title">SELECT MODE</div>
      <div class="blh-head-spacer"></div>
    </div>
    <div class="blh-mode-list">${cards}</div>
  `);
}

function pickMode(id) {
  const m = MODES.find(x => x.id === id);
  if (!m) return;
  if (m.action === 'classic') {
    // ── เข้าสู่โหมดเดิมแบบไม่แตะ logic ใด ๆ ──
    const r = root();
    r.style.display = 'none';
    r.innerHTML = '';
    if (typeof window.startGame === 'function') window.startGame();
    return;
  }
  // ── Boss Loop Hero pre-run flow ──
  renderHeroSelect();
}

// ════════════════════════════════════════════════════════════════════════════
// 2) HERO SELECT
// ════════════════════════════════════════════════════════════════════════════
function renderHeroSelect() {
  const preselect = BLH.sel.heroId || BLH.save.lastHero;
  const cards = HEROES.map(h => `
    <button class="blh-hero-card ${h.id === preselect ? 'sel' : ''}" data-hero="${h.id}" onclick="blh.pickHero('${h.id}')">
      <div class="blh-hero-portrait"><img src="${h.img}" alt="${esc(h.name)}" decoding="async" onerror="this.style.opacity=0"></div>
      <div class="blh-hero-name">${esc(h.name)}</div>
      <div class="blh-hero-role">${esc(h.role)}</div>
      <div class="blh-hero-blurb">${esc(h.blurb)}</div>
      <div class="blh-hero-stats">
        <span>❤️ ${h.base.hp}</span><span>⚔️ ${h.base.atk}</span><span>🛡️ ${h.base.def}</span>
      </div>
    </button>
  `).join('');
  setScreen('hero', `
    <div class="blh-head">
      <button class="blh-back" onclick="blh.toModeSelect()">‹ MODE</button>
      <div class="blh-title">SELECT HERO</div>
      <div class="blh-head-spacer"></div>
    </div>
    <div class="blh-hero-list">${cards}</div>
    <div class="blh-foot">
      <button class="blh-primary" id="blh-hero-next" onclick="blh.heroNext()">เลือกฮีโร่ ▶</button>
    </div>
  `);
}

function pickHero(id) {
  BLH.sel.heroId = id;
  root().querySelectorAll('.blh-hero-card').forEach(c =>
    c.classList.toggle('sel', c.dataset.hero === id));
}

function heroNext() {
  if (!BLH.sel.heroId) BLH.sel.heroId = BLH.save.lastHero || HEROES[0].id;
  BLH.save.lastHero = BLH.sel.heroId;
  blhSaveSave();
  renderStageSelect();
}

// ════════════════════════════════════════════════════════════════════════════
// 3) STAGE SELECT
// ════════════════════════════════════════════════════════════════════════════
function renderStageSelect() {
  const cards = STAGES.map(s => {
    const boss = BOSSES[s.bossDefault];
    const locked = !s.unlocked;
    return `
      <button class="blh-stage-card ${locked ? 'locked' : ''}" ${locked ? 'disabled' : `onclick="blh.pickStage('${s.id}')"`}>
        <div class="blh-stage-name">${esc(s.name)}</div>
        <div class="blh-stage-flavor">${esc(s.flavor)}</div>
        <div class="blh-stage-boss">
          <img src="${boss.icon}" alt="${esc(boss.name)}" decoding="async" onerror="this.style.display='none'">
          <div>
            <div class="blh-stage-boss-label">บอสประจำด่าน</div>
            <div class="blh-stage-boss-name">${esc(boss.name)}</div>
          </div>
        </div>
        ${locked ? '<div class="blh-lock">🔒 เร็ว ๆ นี้</div>' : '<div class="blh-mode-go">▶</div>'}
      </button>`;
  }).join('');
  setScreen('stage', `
    <div class="blh-head">
      <button class="blh-back" onclick="blh.toHeroSelect()">‹ HERO</button>
      <div class="blh-title">SELECT STAGE</div>
      <div class="blh-head-spacer"></div>
    </div>
    <div class="blh-stage-list">${cards}</div>
  `);
}

function pickStage(id) {
  const s = STAGES.find(x => x.id === id);
  if (!s || !s.unlocked) return;
  BLH.sel.stageId = id;
  BLH.sel.bossId  = s.bossDefault;   // MVP: ใช้ boss เริ่มต้นของด่าน
  renderLobby();
}

// ════════════════════════════════════════════════════════════════════════════
// 4) LOBBY / READY (ที่เดียวที่อัปเกรดถาวรได้)
// ════════════════════════════════════════════════════════════════════════════
function renderLobby() {
  const hero  = HEROES.find(h => h.id === BLH.sel.heroId) || HEROES[0];
  const stage = STAGES.find(s => s.id === BLH.sel.stageId) || STAGES[0];
  const boss  = BOSSES[BLH.sel.bossId];
  setScreen('lobby', `
    <div class="blh-head">
      <button class="blh-back" onclick="blh.toStageSelect()">‹ STAGE</button>
      <div class="blh-title">READY</div>
      <div class="blh-zeny">🔷 ${fmt(BLH.save.loopZeny)}</div>
    </div>
    <div class="blh-lobby">
      <div class="blh-lobby-review">
        <div class="blh-review-col">
          <div class="blh-review-label">HERO</div>
          <div class="blh-review-portrait"><img src="${hero.img}" onerror="this.style.opacity=0"></div>
          <div class="blh-review-name">${esc(hero.name)}</div>
          <div class="blh-review-sub">${esc(hero.role)}</div>
        </div>
        <div class="blh-review-vs">VS</div>
        <div class="blh-review-col">
          <div class="blh-review-label">BOSS</div>
          <div class="blh-review-portrait boss"><img src="${boss.img}" onerror="this.style.opacity=0"></div>
          <div class="blh-review-name">${esc(boss.name)}</div>
          <div class="blh-review-sub">${esc(stage.name)}</div>
        </div>
      </div>
      <div class="blh-lobby-startstats" id="blh-startstats">${startStatsHtml(hero)}</div>
      <div class="blh-lobby-actions">
        <button class="blh-primary big" onclick="blh.startRun()">⚔️ START RUN</button>
        <button class="blh-secondary" onclick="blh.openTraining()">🏋️ ARENA TRAINING</button>
        <button class="blh-ghost" onclick="blh.toStageSelect()">‹ BACK</button>
      </div>
    </div>
  `);
}

function startStatsHtml(hero) {
  const s = computeStartStats(hero);
  return `
    <div class="blh-ss-title">สเตตัสเริ่มต้น (รวม Arena Training)</div>
    <div class="blh-ss-row">
      <span>❤️ HP ${s.maxhp}</span>
      <span>⚔️ ATK ${s.atk}</span>
      <span>🛡️ DEF ${s.def}</span>
      <span>🃏 การ์ด ${s.startCards}</span>
    </div>`;
}

// คำนวณสเตตัสเริ่มต้น = base hero + upgrades
function computeStartStats(hero) {
  const maxhp = hero.base.hp  + Math.round(upgValue('startHp'));
  const atk   = hero.base.atk + Math.round(upgValue('startAtk'));
  const def   = hero.base.def + Math.round(upgValue('startDef'));
  const startCards = 2 + upgLevel('extraCard');
  return { maxhp, atk, def, startCards };
}

// ── ARENA TRAINING (upgrades) ──
function openTraining() {
  renderTraining();
}

function renderTraining() {
  const z = BLH.save.loopZeny;
  const rows = UPGRADES.map(u => {
    const lvl = upgLevel(u.id);
    const maxed = lvl >= u.max;
    const cost = maxed ? 0 : upgCost(u, lvl);
    const afford = z >= cost;
    const pips = Array.from({ length: u.max }, (_, i) =>
      `<span class="blh-pip ${i < lvl ? 'on' : ''}"></span>`).join('');
    return `
      <div class="blh-upg">
        <div class="blh-upg-icon">${u.icon}</div>
        <div class="blh-upg-main">
          <div class="blh-upg-name">${esc(u.name)} <span class="blh-upg-lvl">Lv ${lvl}/${u.max}</span></div>
          <div class="blh-upg-desc">${esc(u.desc)}</div>
          <div class="blh-upg-pips">${pips}</div>
        </div>
        <button class="blh-upg-buy ${maxed ? 'maxed' : (afford ? '' : 'cant')}"
          ${maxed || !afford ? 'disabled' : ''} onclick="blh.buyUpg('${u.id}')">
          ${maxed ? 'MAX' : '🔷 ' + fmt(cost)}
        </button>
      </div>`;
  }).join('');
  setScreen('training', `
    <div class="blh-head">
      <button class="blh-back" onclick="blh.backToLobby()">‹ READY</button>
      <div class="blh-title">ARENA TRAINING</div>
      <div class="blh-zeny">🔷 ${fmt(z)}</div>
    </div>
    <div class="blh-train-note">อัปเกรดถาวร ใช้ร่วมกับทุกฮีโร่ในโหมดนี้ • ใช้ได้เฉพาะนอกรัน</div>
    <div class="blh-upg-list">${rows}</div>
  `);
}

function buyUpg(id) {
  const u = UPGRADE_BY_ID[id];
  if (!u) return;
  const lvl = upgLevel(id);
  if (lvl >= u.max) return;
  const cost = upgCost(u, lvl);
  if (BLH.save.loopZeny < cost) return;
  BLH.save.loopZeny -= cost;
  BLH.save.upgrades[id] = lvl + 1;
  blhSaveSave();
  renderTraining();
}

// ── window bridge namespace ──
const blh = {
  // navigation
  backHome: blhExitToMenu,
  toModeSelect: renderModeSelect,
  toHeroSelect: renderHeroSelect,
  toStageSelect: renderStageSelect,
  backToLobby: renderLobby,
  pickMode, pickHero, heroNext, pickStage,
  openTraining, buyUpg,
  // run lifecycle + interactions (gắn ở part 2)
};
window.blh = blh;
window.blhOpenModeSelect = blhOpenModeSelect;

// export internal refs ให้ part 2 ใช้ (รวมไฟล์เดียว จึง share scope)

// ════════════════════════════════════════════════════════════════════════════
// PART 2 — RUN ENGINE (auto-battle loop)
// ════════════════════════════════════════════════════════════════════════════

// ── board geometry (วงรี 12 ช่อง, camp = index 0 ด้านบน) ─────────────────────
function tilePos(i) {
  const a = -Math.PI / 2 + (i / BAL.TILES) * Math.PI * 2;
  return { x: 50 + 40 * Math.cos(a), y: 52 + 36 * Math.sin(a) };
}

// ── สร้าง run state ──────────────────────────────────────────────────────────
function startRun() {
  const hero  = HEROES.find(h => h.id === BLH.sel.heroId) || HEROES[0];
  const stage = STAGES.find(s => s.id === BLH.sel.stageId) || STAGES[0];
  const boss  = BOSSES[BLH.sel.bossId] || BOSSES.suang;
  const ss = computeStartStats(hero);

  const tiles = [];
  for (let i = 0; i < BAL.TILES; i++) {
    tiles.push({ kind: i === 0 ? 'camp' : 'road', enemy: null, terrain: null });
  }

  // เริ่มเกียร์/มอดิฟายเออร์
  const run = {
    hero, stage, boss,
    loop: 1,
    tileIndex: 0,
    phase: 'idle',
    base: { maxhp: ss.maxhp, atk: ss.atk, def: ss.def },
    stats: { hp: ss.maxhp, maxhp: ss.maxhp, atk: ss.atk, def: ss.def },
    gear: { glove: null, jacket: null, boots: null, charm: null },
    lootBag: [],
    hand: [],
    tiles,
    mods: {
      atk: 0, def: 0, maxhp: 0,
      lootBonus: 0, enemyHpMult: 1, enemyDmgBonus: 0,
      lootTierBump: 0, stepHeal: 0, thornSelf: 0,
      zenyBonus: 0, bossSignalDropBonus: 0,
    },
    bossSignalObtained: false,
    bossSignalPlaced: false,
    bossFought: false,
    reviveUsed: false,
    fastBattle: false,
    ended: false,
    _placing: null,
  };
  BLH.run = run;

  // การ์ดแผนที่เริ่มต้น (2 + extraCard upgrade) — สุ่มจากกองทั้งหมด
  const startCards = ss.startCards;
  for (let i = 0; i < startCards; i++) run.hand.push(pick(MAP_CARDS).id);

  // ปิดเพลงไตเติลของเกมหลักระหว่างเล่นรัน
  if (typeof window.stopBGM === 'function') window.stopBGM();

  spawnForLoop(run); // เสกศัตรูพื้นฐาน loop แรก
  renderRunScreen();
  applyMods(run);
  recomputeStats(run);
  updateHUD();
  setPhase('walking');
  scheduleStep(700);
}

// ── เสกศัตรูพื้นฐานในช่องว่างของ loop ปัจจุบัน ──────────────────────────────
function spawnForLoop(run) {
  const chance = BAL.BASE_SPAWN_CHANCE + Math.min(0.2, (run.loop - 1) * 0.03);
  for (let i = 1; i < BAL.TILES; i++) {
    const t = run.tiles[i];
    if (t.enemy) continue;
    if (Math.random() < chance) t.enemy = makeEnemy(pick(ENEMIES), run);
  }
  // กันลูปไม่มีอะไรเลย — การันตีอย่างน้อย 1 ตัว
  if (!run.tiles.some(t => t.enemy)) {
    const empties = run.tiles.map((t, i) => i).filter(i => i > 0 && !run.tiles[i].enemy);
    if (empties.length) run.tiles[pick(empties)].enemy = makeEnemy(pick(ENEMIES), run);
  }
}

// ── สร้าง enemy instance (scale ตาม loop + mods) ─────────────────────────────
function makeEnemy(def, run, opts = {}) {
  const mult = (1 + BAL.ENEMY_LOOP_SCALE * (run.loop - 1)) * (opts.power || 1);
  const maxhp = Math.max(1, Math.round(def.base.hp * mult * run.mods.enemyHpMult));
  return {
    id: def.id, name: def.name, img: def.img, role: def.role,
    maxhp, hp: maxhp,
    atk: Math.round(def.base.atk * mult) + run.mods.enemyDmgBonus,
    def: def.base.def,
  };
}

// ── apply mods (terrain/adjacent ผลถาวรในรัน) → recompute hero stats ─────────
function applyMods(run) {
  // shrine/rock ฯลฯ ถูกบวกเข้า mods ตอนวางแล้ว — ที่นี่แค่ recompute
  recomputeStats(run);
}

function recomputeStats(run) {
  let hp = run.base.maxhp + run.mods.maxhp;
  let atk = run.base.atk + run.mods.atk;
  let def = run.base.def + run.mods.def;
  for (const slot of GEAR_SLOT_IDS) {
    const g = run.gear[slot];
    if (!g) continue;
    if (g.stat.type === 'hp')  hp  += g.stat.amount;
    if (g.stat.type === 'atk') atk += g.stat.amount;
    if (g.stat.type === 'def') def += g.stat.amount;
  }
  const prevMax = run.stats.maxhp;
  run.stats.maxhp = hp;
  run.stats.atk = atk;
  run.stats.def = def;
  // เพิ่มเพดาน HP → เพิ่ม current ตามส่วนต่าง (ไม่เกิน max)
  if (run.stats.hp == null) run.stats.hp = hp;
  else if (hp > prevMax) run.stats.hp = Math.min(hp, run.stats.hp + (hp - prevMax));
  run.stats.hp = clamp(run.stats.hp, 0, hp);
}

// ════════════════════════════════════════════════════════════════════════════
// RUN SCREEN (board + HUD + overlays)
// ════════════════════════════════════════════════════════════════════════════
function renderRunScreen() {
  setScreen('run', `
    <div class="blh-run-hud" id="blh-hud"></div>
    <div class="blh-board" id="blh-board"></div>
    <div class="blh-run-bar" id="blh-runbar"></div>
    <div class="blh-overlay" id="blh-plan" style="display:none"></div>
    <div class="blh-overlay" id="blh-camp" style="display:none"></div>
    <div class="blh-overlay blh-battle-overlay" id="blh-battle" style="display:none"></div>
    <div class="blh-toast" id="blh-toast"></div>
  `);
  renderBoard();
  renderRunBar();
}

function setPhase(p) {
  if (BLH.run) BLH.run.phase = p;
  renderRunBar();
}

function updateHUD() {
  const run = BLH.run; if (!run) return;
  const el = q('blh-hud'); if (!el) return;
  const pct = clamp(run.stats.hp / run.stats.maxhp * 100, 0, 100);
  const sig = run.bossSignalPlaced ? '📡 วางแล้ว'
            : run.bossSignalObtained ? '📡 พร้อมวาง'
            : `📡 loop ${BAL.BOSS_SIGNAL_MIN_LOOP}+`;
  el.innerHTML = `
    <div class="blh-hud-top">
      <div class="blh-hud-loop">LOOP <b>${run.loop}</b></div>
      <div class="blh-hud-hero">${esc(run.hero.name)}</div>
      <div class="blh-hud-sig">${sig}</div>
    </div>
    <div class="blh-hpbar"><div class="blh-hpfill" style="width:${pct}%"></div>
      <span class="blh-hptext">❤️ ${Math.max(0, Math.round(run.stats.hp))}/${run.stats.maxhp}</span></div>
    <div class="blh-hud-stats">
      <span>⚔️ ${run.stats.atk}</span><span>🛡️ ${run.stats.def}</span>
      <span>🃏 ${run.hand.length}</span><span>🎒 ${run.lootBag.length}</span>
    </div>`;
}

function renderRunBar() {
  const run = BLH.run; if (!run) return;
  const el = q('blh-runbar'); if (!el) return;
  if (run.phase === 'walking') {
    el.innerHTML = `<button class="blh-primary" onclick="blh.pausePlan()">⏸ PAUSE / PLAN</button>`;
  } else {
    el.innerHTML = '';
  }
}

// ── วาด board ──
function renderBoard() {
  const run = BLH.run; if (!run) return;
  const el = q('blh-board'); if (!el) return;
  let html = '';
  for (let i = 0; i < BAL.TILES; i++) {
    const p = tilePos(i);
    const t = run.tiles[i];
    const isCamp = t.kind === 'camp';
    const placeable = run._placing != null && isPlaceable(i, run._placing);
    let badge = '';
    if (isCamp) badge = '<div class="blh-tile-camp">⛺</div>';
    else if (t.enemy) badge = `<div class="blh-tile-enemy"><img src="${t.enemy.img}" onerror="this.style.display='none'"></div>`;
    if (t.terrain) {
      const c = MAP_CARD_BY_ID[t.terrain];
      badge += `<div class="blh-tile-terrain" title="${esc(c.name)}">${c.icon}</div>`;
    }
    html += `<div class="blh-tile ${isCamp ? 'camp' : ''} ${placeable ? 'placeable' : ''}"
      style="left:${p.x}%;top:${p.y}%" ${placeable ? `onclick="blh.placeAt(${i})"` : ''}>
      ${badge}</div>`;
  }
  // hero token
  const hp = tilePos(run.tileIndex);
  html += `<div class="blh-token" id="blh-token" style="left:${hp.x}%;top:${hp.y}%">
    <img src="${run.hero.img}" onerror="this.style.opacity=0"></div>`;
  el.innerHTML = html;
}

function moveToken() {
  const run = BLH.run;
  const tok = q('blh-token'); if (!tok || !run) return;
  const p = tilePos(run.tileIndex);
  tok.style.left = p.x + '%';
  tok.style.top = p.y + '%';
}

// ── การเดินอัตโนมัติ ──
function scheduleStep(ms) {
  if (BLH._walkTimer) clearTimeout(BLH._walkTimer);
  BLH._walkTimer = setTimeout(stepWalk, ms == null ? BAL.WALK_MS : ms);
}

function stepWalk() {
  const run = BLH.run;
  if (!run || run.ended || run.phase !== 'walking') return;
  run.tileIndex = (run.tileIndex + 1) % BAL.TILES;
  moveToken();

  // step heal (campfire ฯลฯ)
  if (run.mods.stepHeal > 0 && run.stats.hp < run.stats.maxhp) {
    run.stats.hp = clamp(run.stats.hp + run.mods.stepHeal, 0, run.stats.maxhp);
    updateHUD();
  }

  if (run.tileIndex === 0) { arriveCamp(); return; }

  const t = run.tiles[run.tileIndex];
  if (t.enemy) {
    startBattle({ kind: 'normal', enemies: [t.enemy], tile: run.tileIndex });
  } else {
    scheduleStep();
  }
}

// ── ถึง Camp (auto-pause ทุก loop) ──
function arriveCamp() {
  const run = BLH.run;
  run.loop += 1;                              // จบ 1 loop (best อัปเดตตอนจบรัน)
  // ถ้าวาง Boss Signal ไว้ → บอสมาเลย
  if (run.bossSignalPlaced && !run.bossFought) {
    startBossFight();
    return;
  }
  // camp recovery (Arena Training: CAMP RECOVERY)
  const heal = upgValue('campHeal');
  if (heal > 0) {
    const amt = Math.round(run.stats.maxhp * heal);
    run.stats.hp = clamp(run.stats.hp + amt, 0, run.stats.maxhp);
  }
  spawnForLoop(run);   // เสกศัตรูสำหรับ loop ใหม่ (ผู้เล่นได้วางแผนก่อน)
  renderBoard();
  updateHUD();
  setPhase('camp');
  openCamp();
}

// ════════════════════════════════════════════════════════════════════════════
// CAMP
// ════════════════════════════════════════════════════════════════════════════
function openCamp() {
  const run = BLH.run;
  const el = q('blh-camp');
  const canPlace = run.bossSignalObtained && !run.bossSignalPlaced;
  const estZeny = estCashOut(run);
  el.innerHTML = `
    <div class="blh-sheet">
      <div class="blh-sheet-title">⛺ CAMP — LOOP ${run.loop}</div>
      <div class="blh-sheet-sub">พักเพื่อวางแผน • เดินต่อหรือถอนเงิน</div>
      <div class="blh-camp-grid">
        <button class="blh-primary" onclick="blh.continueLoop()">▶ CONTINUE LOOP</button>
        <button class="blh-secondary" onclick="blh.cashOut()">💰 CASH OUT (~🔷 ${fmt(estZeny)})</button>
        <button class="blh-secondary" onclick="blh.openPlanTab('gear')">🧤 MANAGE GEAR</button>
        <button class="blh-secondary" onclick="blh.openPlanTab('cards')">🗺️ VIEW / PLAN MAP</button>
        ${canPlace ? `<button class="blh-signal" onclick="blh.placeSignal()">📡 PLACE BOSS SIGNAL</button>` : ''}
        ${run.bossSignalPlaced ? `<div class="blh-signal-note">📡 Boss Signal พร้อม — กลับมา Camp รอบหน้าเจอ ${esc(run.boss.name)}!</div>` : ''}
      </div>
      <button class="blh-danger-link" onclick="blh.abandonRun()">ยอมแพ้ / ออกจากรัน</button>
    </div>`;
  el.style.display = 'flex';
}
function closeCamp() { const el = q('blh-camp'); if (el) el.style.display = 'none'; }

function continueLoop() {
  closeCamp();
  setPhase('walking');
  scheduleStep(450);
}

function placeSignal() {
  const run = BLH.run;
  run.bossSignalPlaced = true;
  blhToast('📡 วาง Boss Signal แล้ว — รอบหน้าที่ถึง Camp บอสจะปรากฏ!');
  openCamp(); // refresh
}

// ════════════════════════════════════════════════════════════════════════════
// PLANNING / PAUSE  (manage gear / loot / cards / map / stats)
// ════════════════════════════════════════════════════════════════════════════
function pausePlan() {
  const run = BLH.run;
  if (!run || run.phase !== 'walking') return;
  if (BLH._walkTimer) { clearTimeout(BLH._walkTimer); BLH._walkTimer = null; }
  setPhase('paused');
  openPlanTab('stats');
}

let _planTab = 'stats';
function openPlanTab(tab) {
  _planTab = tab || 'stats';
  // ถ้าเรียกจาก camp ให้ซ่อน camp ชั่วคราว
  closeCamp();
  renderPlan();
}

function renderPlan() {
  const run = BLH.run; if (!run) return;
  const el = q('blh-plan');
  const fromCamp = run.phase === 'camp' || run.phase === 'idle';
  const tabs = ['stats', 'gear', 'loot', 'cards', 'map'];
  const tabLabel = { stats: '📊 STATS', gear: '🧤 GEAR', loot: '🎒 LOOT', cards: '🃏 CARDS', map: '🗺️ MAP' };
  const tabBtns = tabs.map(t =>
    `<button class="blh-tab ${t === _planTab ? 'on' : ''}" onclick="blh.openPlanTab('${t}')">${tabLabel[t]}</button>`).join('');
  el.innerHTML = `
    <div class="blh-sheet tall">
      <div class="blh-sheet-title">⏸ PLANNING</div>
      <div class="blh-tabs">${tabBtns}</div>
      <div class="blh-tabbody" id="blh-tabbody">${renderPlanBody()}</div>
      <div class="blh-plan-foot">
        ${run._placing ? `<button class="blh-ghost" onclick="blh.cancelPlace()">✖ ยกเลิกการวาง</button>` : ''}
        ${fromCamp
          ? `<button class="blh-ghost" onclick="blh.backToCamp()">‹ กลับ Camp</button>`
          : `<button class="blh-primary" onclick="blh.resumeWalk()">▶ เดินต่อ</button>`}
        <button class="blh-danger-link" onclick="blh.abandonRun()">ยอมแพ้</button>
      </div>
    </div>`;
  el.style.display = 'flex';
}

function renderPlanBody() {
  const run = BLH.run;
  switch (_planTab) {
    case 'stats': return planStats(run);
    case 'gear':  return planGear(run);
    case 'loot':  return planLoot(run);
    case 'cards': return planCards(run);
    case 'map':   return planMap(run);
  }
  return '';
}

function planStats(run) {
  return `
    <div class="blh-statbox">
      <div class="blh-statbox-portrait"><img src="${run.hero.img}" onerror="this.style.opacity=0"></div>
      <div class="blh-statbox-info">
        <div class="blh-statbox-name">${esc(run.hero.name)} <span class="blh-statbox-role">${esc(run.hero.role)}</span></div>
        <div class="blh-statline">❤️ HP <b>${Math.round(run.stats.hp)}/${run.stats.maxhp}</b></div>
        <div class="blh-statline">⚔️ ATK <b>${run.stats.atk}</b></div>
        <div class="blh-statline">🛡️ DEF <b>${run.stats.def}</b></div>
        <div class="blh-statline">🔄 LOOP <b>${run.loop}</b> • 🎒 ลูท <b>${run.lootBag.length}</b> • 🃏 การ์ด <b>${run.hand.length}</b></div>
      </div>
    </div>
    <div class="blh-equip-strip">${GEAR_SLOTS.map(s => {
      const g = run.gear[s.id];
      return `<div class="blh-equip-mini">
        <div class="blh-equip-mini-icon">${s.icon}</div>
        <div class="blh-equip-mini-name">${g ? gearLabel(g) : '<span class="dim">ว่าง</span>'}</div>
      </div>`;
    }).join('')}</div>`;
}

function gearLabel(g) {
  const tier = GEAR_TIERS.find(t => t.id === g.tierId);
  const st = g.stat.type === 'hp' ? 'HP' : g.stat.type === 'atk' ? 'ATK' : 'DEF';
  return `<span style="color:${tier.color}">+${g.stat.amount} ${st}</span>`;
}
function gearFull(g) {
  const tier = GEAR_TIERS.find(t => t.id === g.tierId);
  const trait = GEAR_TRAITS.find(t => t.id === g.trait);
  const st = g.stat.type === 'hp' ? 'HP' : g.stat.type === 'atk' ? 'ATK' : 'DEF';
  return `<span class="blh-tier-tag" style="color:${tier.color};border-color:${tier.color}">${tier.name}</span>
    <b>+${g.stat.amount} ${st}</b>${trait && trait.id !== 'none' ? `<span class="blh-trait">• ${esc(trait.label)}</span>` : ''}`;
}

function planGear(run) {
  const slots = GEAR_SLOTS.map(s => {
    const g = run.gear[s.id];
    return `<div class="blh-gear-slot">
      <div class="blh-gear-slot-icon">${s.icon}</div>
      <div class="blh-gear-slot-main">
        <div class="blh-gear-slot-name">${s.name}</div>
        <div class="blh-gear-slot-val">${g ? gearFull(g) : '<span class="dim">— ว่าง —</span>'}</div>
      </div>
      ${g ? `<button class="blh-mini-btn" onclick="blh.unequip('${s.id}')">ถอด</button>` : ''}
    </div>`;
  }).join('');
  return `<div class="blh-gear-note">เกียร์ใช้ได้เฉพาะรอบรันนี้ — จบรันหายหมด</div>
    <div class="blh-gear-slots">${slots}</div>`;
}

function planLoot(run) {
  if (!run.lootBag.length)
    return `<div class="blh-empty">🎒 กระเป๋าลูทว่าง — ล้มศัตรูเพื่อเก็บเกียร์</div>`;
  const items = run.lootBag.map((g, i) => {
    const slot = GEAR_SLOTS.find(s => s.id === g.slot);
    return `<div class="blh-loot-item">
      <div class="blh-loot-icon">${slot.icon}</div>
      <div class="blh-loot-main">
        <div class="blh-loot-name">${slot.name}</div>
        <div class="blh-loot-val">${gearFull(g)}</div>
      </div>
      <button class="blh-mini-btn" onclick="blh.equipLoot(${i})">สวม</button>
    </div>`;
  }).join('');
  return `<div class="blh-loot-list">${items}</div>`;
}

function planCards(run) {
  if (!run.hand.length)
    return `<div class="blh-empty">🃏 ไม่มีการ์ดแผนที่ — เก็บได้จากการล้มศัตรู</div>`;
  const cards = run.hand.map((id, i) => {
    const c = MAP_CARD_BY_ID[id];
    const kindLabel = { road: 'ROAD', adjacent: 'ADJACENT', terrain: 'TERRAIN' }[c.kind];
    return `<div class="blh-mapcard" style="--accent:${c.accent}">
      <div class="blh-mapcard-icon">${c.icon}</div>
      <div class="blh-mapcard-main">
        <div class="blh-mapcard-name">${esc(c.name)} <span class="blh-mapcard-kind">${kindLabel}</span></div>
        <div class="blh-mapcard-desc">${esc(c.desc)}</div>
      </div>
      <button class="blh-mini-btn" onclick="blh.startPlace(${i})">วาง</button>
    </div>`;
  }).join('');
  return `<div class="blh-cards-note">เลือก “วาง” แล้วแตะช่องบนแผนที่ — เทอเรนคือหัวใจเสี่ยง/รางวัล</div>
    <div class="blh-mapcard-list">${cards}</div>`;
}

function planMap(run) {
  const enemies = run.tiles.filter(t => t.enemy).length;
  const terr = run.tiles.filter(t => t.terrain).length;
  return `<div class="blh-mapinfo">
      <div>🗺️ ช่องถนน: <b>${BAL.TILES - 1}</b> + Camp</div>
      <div>👾 ศัตรูบนแผนที่: <b>${enemies}</b></div>
      <div>🌵 เทอเรนที่วาง: <b>${terr}</b></div>
      <div class="dim">ปิดแผงนี้เพื่อดูแผนที่เต็ม แล้วแตะช่องเพื่อวางการ์ด</div>
    </div>`;
}

function resumeWalk() {
  const run = BLH.run;
  run._placing = null; run._placingHand = null; // เผื่อค้างสถานะวาง
  closePlan();
  renderBoard();
  setPhase('walking');
  scheduleStep(400);
}
function backToCamp() { closePlan(); openCamp(); }
function closePlan() { const el = q('blh-plan'); if (el) el.style.display = 'none'; }

// ── gear ──
function equipLoot(idx) {
  const run = BLH.run;
  const g = run.lootBag[idx];
  if (!g) return;
  const prev = run.gear[g.slot];
  run.gear[g.slot] = g;
  run.lootBag.splice(idx, 1);
  if (prev) run.lootBag.push(prev); // ของเก่ากลับลงกระเป๋า
  recomputeStats(run);
  updateHUD();
  renderPlan();
}
function unequip(slot) {
  const run = BLH.run;
  const g = run.gear[slot];
  if (!g) return;
  run.gear[slot] = null;
  run.lootBag.push(g);
  recomputeStats(run);
  updateHUD();
  renderPlan();
}

// ── terrain/map card placement ──
function startPlace(handIdx) {
  const run = BLH.run;
  const id = run.hand[handIdx];
  if (id == null) return;
  run._placing = id;
  run._placingHand = handIdx;
  closePlan();
  blhToast('แตะช่องบนแผนที่ที่ไฮไลต์เพื่อวาง');
  renderBoard();
}
function cancelPlace() {
  const run = BLH.run;
  run._placing = null; run._placingHand = null;
  renderBoard();
  reopenPlanContext();   // กลับเข้าแผงวางแผน — ไม่ทิ้งผู้เล่นค้างบนบอร์ด
}
// เปิดแผงวางแผนกลับมาหลังวาง/ยกเลิก โดยอิง phase ปัจจุบัน
function reopenPlanContext() {
  const run = BLH.run;
  if (!run) return;
  _planTab = 'cards';
  renderPlan();          // renderPlan แสดงปุ่ม “กลับ Camp” หรือ “เดินต่อ” ตาม phase
}
function isPlaceable(i, cardId) {
  const run = BLH.run;
  if (i === 0) return false;             // ไม่วางบน camp
  const t = run.tiles[i];
  if (t.terrain) return false;
  const c = MAP_CARD_BY_ID[cardId];
  if (c.kind === 'road') return !t.enemy; // road card เสกศัตรู → ต้องช่องว่าง
  return true;                            // adjacent/terrain วางช่องว่างจากเทอเรน
}
function placeAt(i) {
  const run = BLH.run;
  const cardId = run._placing;
  if (cardId == null || !isPlaceable(i, cardId)) return;
  const c = MAP_CARD_BY_ID[cardId];
  applyCardEffect(c, run, i);
  // เอาการ์ดออกจากมือ
  const hi = run.hand.indexOf(cardId);
  if (hi >= 0) run.hand.splice(hi, 1);
  run._placing = null; run._placingHand = null;
  recomputeStats(run);
  renderBoard();
  updateHUD();
  blhToast(`วาง ${c.name} แล้ว`);
  reopenPlanContext();   // กลับเข้าแผงวางแผน (cards) เพื่อวางต่อ หรือเดินต่อ/กลับ Camp
}

function applyCardEffect(c, run, tileIdx) {
  const t = run.tiles[tileIdx];
  switch (c.id) {
    // ROAD
    case 'spawn_rift':
      t.enemy = makeEnemy(pick(ENEMIES), run, { power: 1.15 });
      run.mods.lootBonus += 0.08;
      break;
    case 'pack_howl':
      run.mods.enemyDmgBonus += 2;
      run.mods.zenyBonus += 80;
      t.terrain = c.id;
      break;
    case 'blood_track':
      run.mods.bossSignalDropBonus += 0.20;
      t.terrain = c.id;
      break;
    // ADJACENT
    case 'campfire':  run.mods.stepHeal += 6; t.terrain = c.id; break;
    case 'shrine':    run.mods.atk += 2; t.terrain = c.id; break;
    case 'lucky_totem': run.mods.lootBonus += 0.12; t.terrain = c.id; break;
    // TERRAIN
    case 'rock':      run.mods.def += 3; t.terrain = c.id; break;
    case 'thornfield': run.mods.enemyHpMult *= 0.85; run.mods.thornSelf += 1; t.terrain = c.id; break;
    case 'treasure':  run.mods.lootTierBump += 1; t.terrain = c.id; break;
    default: t.terrain = c.id;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// BATTLE (auto, popup, text RPG log)
// ════════════════════════════════════════════════════════════════════════════
function startBattle(ctx) {
  const run = BLH.run;
  setPhase('battle');
  const battle = {
    kind: ctx.kind,            // 'normal' | 'boss'
    tile: ctx.tile,
    enemies: ctx.enemies,      // [{...}] alive list (boss: [minionL, minionR, boss])
    log: [],
    round: 0,
    timer: null,
    paused: false,
    done: false,
  };
  BLH._battle = battle;
  const title = ctx.kind === 'boss' ? `BOSS FIGHT — ${run.boss.name}` : 'BATTLE';
  q('blh-battle').style.display = 'flex';
  renderBattle(title);
  battleLog(ctx.kind === 'boss'
    ? `⚔️ ${run.boss.name} ปรากฏตัวพร้อมลูกสมุน 2 ตัว!`
    : `⚔️ เจอ ${ctx.enemies[0].name}!`);
  battle.timer = setTimeout(battleTick, 650);
}

function aliveEnemies() { return BLH._battle.enemies.filter(e => e.hp > 0); }

function chooseTarget(battle) {
  const run = BLH.run;
  if (battle.kind !== 'boss') {
    return aliveEnemies()[0];
  }
  // boss priority: 1) minion HP ต่ำสุด 2) ซ้าย 3) ขวา 4) boss
  const minions = battle.enemies.filter(e => e.role === 'minion' && e.hp > 0);
  if (minions.length) {
    minions.sort((a, b) => (a.hp - b.hp) || (a.slot - b.slot));
    return minions[0];
  }
  return battle.enemies.find(e => e.role === 'boss' && e.hp > 0);
}

function dealDamage(attacker, defender) {
  const variance = rnd(0.9, 1.1);
  let dmg = Math.max(1, Math.round(attacker.atk * variance) - (defender.def || 0));
  // crit จาก gear trait (เฉพาะฮีโร่)
  let crit = false;
  if (attacker.isHero) {
    const critChance = heroTraitValue('crit') * 0.05;
    if (Math.random() < critChance) { dmg = Math.round(dmg * 1.6); crit = true; }
  }
  // guard (ฮีโร่รับดาเมจ) / thorns
  if (defender.isHero) {
    const guard = heroTraitValue('guard');
    if (guard) dmg = Math.round(dmg * (1 - 0.10 * Math.min(1, guard)));
  }
  defender.hp = Math.max(0, defender.hp - dmg);
  return { dmg, crit };
}

function heroTraitValue(traitId) {
  const run = BLH.run; let n = 0;
  for (const slot of GEAR_SLOT_IDS) {
    const g = run.gear[slot];
    if (g && g.trait === traitId) n++;
  }
  return n;
}

function battleTick() {
  const battle = BLH._battle;
  const run = BLH.run;
  if (!battle || battle.done || battle.paused) return;
  battle.round++;

  // ── hero turn ──
  const hero = { isHero: true, atk: run.stats.atk };
  const target = chooseTarget(battle);
  if (target) {
    const r = dealDamage(hero, target);
    battleLog(`🥊 ${run.hero.name} โจมตี ${target.name} −${r.dmg}${r.crit ? ' 💥CRIT' : ''}`);
    // lifesteal trait
    const ls = heroTraitValue('lifesteal');
    if (ls) {
      const heal = Math.round(r.dmg * 0.08 * ls);
      run.stats.hp = clamp(run.stats.hp + heal, 0, run.stats.maxhp);
    }
    if (target.hp <= 0) battleLog(`☠️ ${target.name} ถูกล้ม!`);
  }

  // ── enemies turn (ทุกตัวที่ยังไม่ตายตี hero) ──
  if (aliveEnemies().length) {
    let totalDmg = 0;
    for (const e of aliveEnemies()) {
      const r = dealDamage({ atk: e.atk }, { isHero: true, def: run.stats.def });
      totalDmg += r.dmg;
      // thorns trait — สะท้อนกลับ
      const th = heroTraitValue('thorns');
      if (th) e.hp = Math.max(0, e.hp - Math.round(r.dmg * 0.15 * th));
    }
    // thornfield terrain — เจ็บเพิ่มต่อตา
    if (run.mods.thornSelf) totalDmg += run.mods.thornSelf;
    run.stats.hp = Math.max(0, run.stats.hp - totalDmg);
    if (totalDmg > 0) battleLog(`💢 ศัตรูตอบโต้ −${totalDmg} (HP ${Math.round(run.stats.hp)})`);
  }

  renderBattle();
  updateHUD();

  // ── ตรวจจบ ──
  if (run.stats.hp <= 0) { endBattle('dead'); return; }
  if (!aliveEnemies().length) { endBattle('win'); return; }

  const ms = run.fastBattle ? BAL.BATTLE_MS_FAST : BAL.BATTLE_MS;
  battle.timer = setTimeout(battleTick, ms);
}

function endBattle(result) {
  const battle = BLH._battle;
  const run = BLH.run;
  battle.done = true;
  if (battle.timer) clearTimeout(battle.timer);

  if (result === 'dead') {
    // safer death — ฟื้นคืนชีพ 1 ครั้ง/รัน ถ้ามี upgrade
    const reviveLv = upgLevel('safeDeath');
    if (reviveLv > 0 && !run.reviveUsed) {
      run.reviveUsed = true;
      run.stats.hp = Math.round(run.stats.maxhp * upgValue('safeDeath'));
      battleLog(`🪽 SAFER DEATH! ฟื้นคืนชีพที่ HP ${Math.round(run.stats.hp)}`);
      updateHUD();
      // เล่นต่อ
      const ms = run.fastBattle ? BAL.BATTLE_MS_FAST : BAL.BATTLE_MS;
      battle.done = false;
      battle.timer = setTimeout(battleTick, ms + 200);
      renderBattle();
      return;
    }
    battleLog('☠️ ฮีโร่ล้มลง...');
    renderBattle('DEFEAT', true);
    setTimeout(() => runEnd('dead'), 700);
    return;
  }

  // ── WIN ──
  if (battle.kind === 'boss') {
    battleLog(`🏆 ล้ม ${run.boss.name} สำเร็จ! RUN COMPLETE!`);
    run.bossFought = true;
    renderBattle('VICTORY', true);
    setTimeout(() => runEnd('boss'), 800);
    return;
  }

  // normal win — เคลียร์ศัตรูบนช่อง + ดรอป
  if (battle.tile != null) run.tiles[battle.tile].enemy = null;
  const drops = rollDrops(run);
  drops.forEach(d => battleLog(d));
  renderBattle('WIN', true, drops);
  setTimeout(() => {
    closeBattle();
    renderBoard();
    updateHUD();
    setPhase('walking');
    scheduleStep(350);
  }, drops.length ? 1100 : 700);
}

function rollDrops(run) {
  const out = [];
  // gear
  const chance = BAL.BASE_LOOT_CHANCE + upgValue('lootChance') + run.mods.lootBonus;
  if (Math.random() < chance) {
    const g = makeGear(run);
    run.lootBag.push(g);
    const slot = GEAR_SLOTS.find(s => s.id === g.slot);
    out.push(`🎁 ลูท: ${slot.name} ${gearLabelText(g)}`);
  }
  // map card (โอกาสเล็ก)
  if (Math.random() < 0.22 && run.hand.length < 6) {
    const id = pick(MAP_CARDS).id;
    run.hand.push(id);
    out.push(`🃏 ได้การ์ดแผนที่: ${MAP_CARD_BY_ID[id].name}`);
  }
  // boss signal
  if (!run.bossSignalObtained && run.loop >= BAL.BOSS_SIGNAL_MIN_LOOP) {
    const sigChance = 0.32 + run.mods.bossSignalDropBonus + (run.loop >= 7 ? 1 : 0);
    if (Math.random() < sigChance) {
      run.bossSignalObtained = true;
      out.push(`📡 ได้ BOSS SIGNAL! ไปวางที่ Camp เพื่อเรียกบอส`);
    }
  }
  return out;
}

function gearLabelText(g) {
  const st = g.stat.type === 'hp' ? 'HP' : g.stat.type === 'atk' ? 'ATK' : 'DEF';
  const tier = GEAR_TIERS.find(t => t.id === g.tierId);
  return `[${tier.name}] +${g.stat.amount} ${st}`;
}

// ── gear generation ──
function tierForLoop(run) {
  let rank = run.loop <= 2 ? 0 : run.loop <= 4 ? 1 : run.loop <= 6 ? 2 : 3;
  // higher-tier upgrade + treasure terrain
  const bumpChance = upgValue('higherTier');
  if (Math.random() < bumpChance) rank++;
  rank += run.mods.lootTierBump;
  return GEAR_TIERS[clamp(rank, 0, GEAR_TIERS.length - 1)];
}

function makeGear(run) {
  const slot = pick(GEAR_SLOT_IDS);
  const tier = tierForLoop(run);
  // stat type — เอนเอียงตาม slot
  let type = SLOT_STAT_BIAS[slot] || 'atk';
  if (Math.random() < 0.35) type = pick(['hp', 'atk', 'def']);
  let amount = Math.round(rnd(tier.statMin, tier.statMax));
  if (type === 'hp') amount *= 3; // HP สเกลใหญ่กว่า
  const trait = Math.random() < 0.5 ? pick(GEAR_TRAITS.filter(t => t.id !== 'none')).id : 'none';
  return { slot, tierId: tier.id, stat: { type, amount }, trait };
}

// ── boss fight ──
function startBossFight() {
  const run = BLH.run;
  const boss = run.boss;
  const mult = 1 + 0.10 * (run.loop - 1);
  const mk = (def, role, slot) => ({
    id: def.id, name: def.name, img: def.img, role,
    slot,
    maxhp: Math.round(def.base.hp * mult),
    hp: Math.round(def.base.hp * mult),
    atk: Math.round(def.base.atk * mult),
    def: def.base.def,
  });
  const mIds = boss.minions;
  const enemies = [
    mk(MINIONS[mIds[0]], 'minion', 0), // ซ้าย
    mk(MINIONS[mIds[1]], 'minion', 1), // ขวา
    mk(boss, 'boss', 2),
  ];
  closeCamp();
  startBattle({ kind: 'boss', enemies, tile: null });
}

// ── battle render ──
function renderBattle(banner, finished, drops) {
  const battle = BLH._battle;
  const run = BLH.run;
  const el = q('blh-battle'); if (!el || !battle) return;
  const hpPct = clamp(run.stats.hp / run.stats.maxhp * 100, 0, 100);

  const enemyCards = battle.enemies.map(e => {
    const pct = clamp(e.hp / e.maxhp * 100, 0, 100);
    const dead = e.hp <= 0;
    const tag = e.role === 'boss' ? 'BOSS' : e.role === 'minion' ? 'MINION' : (ROLE_LABEL[e.role] || '');
    return `<div class="blh-bt-enemy ${dead ? 'dead' : ''} ${e.role === 'boss' ? 'boss' : ''}">
      <div class="blh-bt-portrait"><img src="${e.img}" onerror="this.style.opacity=0">${dead ? '<div class="blh-bt-x">✖</div>' : ''}</div>
      <div class="blh-bt-name">${esc(e.name)} <span class="blh-bt-tag">${tag}</span></div>
      <div class="blh-bt-hpbar"><div class="blh-bt-hpfill enemy" style="width:${pct}%"></div></div>
      <div class="blh-bt-hptext">${Math.max(0, Math.round(e.hp))}/${e.maxhp}</div>
    </div>`;
  }).join('');

  const logHtml = battle.log.slice(-7).map(l => `<div class="blh-bt-logline">${l}</div>`).join('');

  let footer;
  if (finished) {
    footer = `<button class="blh-primary" onclick="blh.dismissBattle()">${banner === 'WIN' || banner === 'VICTORY' ? 'ดำเนินต่อ ▶' : 'ตกลง'}</button>`;
  } else {
    footer = `
      <button class="blh-secondary sm" onclick="blh.toggleFast()">${run.fastBattle ? '⏩ FAST: ON' : '⏩ FAST'}</button>
      <button class="blh-secondary sm" onclick="blh.battleInspect()">🔍 INSPECT</button>`;
  }

  el.innerHTML = `
    <div class="blh-bt-box">
      ${banner ? `<div class="blh-bt-banner ${banner === 'DEFEAT' ? 'lose' : 'win'}">${banner}</div>` : `<div class="blh-bt-title">⚔️ ${battle.kind === 'boss' ? esc(run.boss.name) : 'BATTLE'}</div>`}
      <div class="blh-bt-arena">
        <div class="blh-bt-hero">
          <div class="blh-bt-portrait hero"><img src="${run.hero.img}" onerror="this.style.opacity=0"></div>
          <div class="blh-bt-name">${esc(run.hero.name)}</div>
          <div class="blh-bt-hpbar"><div class="blh-bt-hpfill hero" style="width:${hpPct}%"></div></div>
          <div class="blh-bt-hptext">❤️ ${Math.max(0, Math.round(run.stats.hp))}/${run.stats.maxhp}</div>
          <div class="blh-bt-mini">⚔️${run.stats.atk} 🛡️${run.stats.def}</div>
        </div>
        <div class="blh-bt-vs">VS</div>
        <div class="blh-bt-enemies ${battle.enemies.length > 1 ? 'multi' : ''}">${enemyCards}</div>
      </div>
      <div class="blh-bt-log" id="blh-bt-log">${logHtml}</div>
      <div class="blh-bt-foot">${footer}</div>
    </div>`;
  const logEl = q('blh-bt-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
}

function battleLog(line) {
  const b = BLH._battle; if (!b) return;
  b.log.push(line);
  const logEl = q('blh-bt-log');
  if (logEl) {
    logEl.insertAdjacentHTML('beforeend', `<div class="blh-bt-logline">${line}</div>`);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function toggleFast() {
  const run = BLH.run; run.fastBattle = !run.fastBattle;
  renderBattle();
}

function battleInspect() {
  const b = BLH._battle; if (!b || b.done) return;
  b.paused = !b.paused;
  if (b.paused) {
    if (b.timer) clearTimeout(b.timer);
    blhToast('⏸ พักดูข้อมูล — แก้เกียร์/เทอเรนไม่ได้ระหว่างสู้');
    const foot = q('blh-battle').querySelector('.blh-bt-foot');
    if (foot) foot.innerHTML = `<button class="blh-primary sm" onclick="blh.battleInspect()">▶ สู้ต่อ</button>`;
  } else {
    renderBattle();
    b.timer = setTimeout(battleTick, 300);
  }
}

function dismissBattle() {
  // ใช้กับ finished banner ที่ไม่ใช่ continue อัตโนมัติ (dead/boss handled ผ่าน runEnd)
  closeBattle();
}
function closeBattle() {
  const el = q('blh-battle'); if (el) el.style.display = 'none';
  BLH._battle = null;
}

// ════════════════════════════════════════════════════════════════════════════
// RUN END / CASH OUT / ABANDON
// ════════════════════════════════════════════════════════════════════════════
function estCashOut(run) {
  return Math.floor(run.loop * BAL.CASHOUT_PER_LOOP + lootValue(run) + run.mods.zenyBonus);
}
function lootValue(run) {
  let v = 0;
  for (const slot of GEAR_SLOT_IDS) { const g = run.gear[slot]; if (g) v += g.stat.amount * 2; }
  run.lootBag.forEach(g => v += g.stat.amount);
  return v;
}

function cashOut() {
  const run = BLH.run;
  const zeny = estCashOut(run);
  finishRun(zeny, 'cashout');
}

function runEnd(reason) {
  const run = BLH.run;
  let zeny, label;
  if (reason === 'boss') {
    zeny = Math.floor(run.loop * BAL.CASHOUT_PER_LOOP + lootValue(run) + run.mods.zenyBonus + BAL.BOSS_BONUS);
    BLH.save.stats.bossKills += 1;
    label = 'boss';
  } else { // dead — death recovery (ได้ครึ่งเดียว)
    zeny = Math.floor((run.loop * BAL.CASHOUT_PER_LOOP + lootValue(run) + run.mods.zenyBonus) * 0.5);
    label = 'dead';
  }
  finishRun(zeny, label);
}

function finishRun(zeny, reason) {
  const run = BLH.run;
  blhAbortTimers();
  closeBattle(); closePlan(); closeCamp();
  BLH.save.loopZeny += zeny;
  BLH.save.stats.runs += 1;
  BLH.save.stats.bestLoops = Math.max(BLH.save.stats.bestLoops, run.loop);
  blhSaveSave();

  const titleMap = {
    boss:    { t: '🏆 RUN COMPLETE', c: 'win',  sub: `ล้ม ${esc(run.boss.name)} สำเร็จ!` },
    cashout: { t: '💰 CASHED OUT',   c: 'win',  sub: 'ถอนตัวพร้อมรางวัล' },
    dead:    { t: '☠️ HERO DOWN',    c: 'lose', sub: 'ฮีโร่ล้ม — ได้รางวัลส่วนหนึ่ง (death recovery)' },
  };
  const m = titleMap[reason] || titleMap.cashout;
  run.ended = true;

  setScreen('runend', `
    <div class="blh-runend">
      <div class="blh-runend-banner ${m.c}">${m.t}</div>
      <div class="blh-runend-sub">${m.sub}</div>
      <div class="blh-runend-stats">
        <div><span>วนทั้งหมด</span><b>${run.loop} loops</b></div>
        <div><span>เกียร์ที่เก็บ</span><b>${run.lootBag.length + GEAR_SLOT_IDS.filter(s => run.gear[s]).length}</b></div>
        <div class="zeny"><span>LOOP ZENY ที่ได้</span><b>🔷 +${fmt(zeny)}</b></div>
      </div>
      <div class="blh-runend-note">⚠️ เกียร์ทั้งหมดของรอบรันนี้หายไป (run-only)</div>
      <div class="blh-runend-total">คงเหลือ: 🔷 ${fmt(BLH.save.loopZeny)}</div>
      <div class="blh-runend-actions">
        <button class="blh-primary big" onclick="blh.backToLobby()">‹ กลับ LOBBY</button>
        <button class="blh-secondary" onclick="blh.openTraining()">🏋️ ARENA TRAINING</button>
      </div>
    </div>`);
  BLH.run = null;
}

function abandonRun() {
  if (!confirm('ยอมแพ้รอบรันนี้? เกียร์จะหายและได้ Loop Zeny เพียงเล็กน้อย')) return;
  const run = BLH.run;
  const zeny = Math.floor(run.loop * BAL.CASHOUT_PER_LOOP * 0.25);
  finishRun(zeny, 'dead');
}

// ── toast ──
let _toastTimer = null;
function blhToast(msg) {
  const el = q('blh-toast'); if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ── ลงทะเบียน method ของ run engine เข้า window bridge namespace ──
Object.assign(blh, {
  startRun,
  pausePlan, openPlanTab, resumeWalk, backToCamp,
  continueLoop, cashOut, placeSignal, abandonRun,
  equipLoot, unequip,
  startPlace, cancelPlace, placeAt,
  toggleFast, battleInspect, dismissBattle,
});
