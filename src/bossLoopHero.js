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

// dev/test เท่านั้น: ใช้กำหนดว่าจะเปิด debug hook (blh.__test) หรือไม่
// จริง = รันใน Node smoke (ไม่มี location) หรือ localhost dev → เปิด
// production (github.io ฯลฯ) → ปิด ไม่ expose internal state ออก window
const BLH_DEV = (() => {
  try {
    const h = (typeof location !== 'undefined' && location.hostname) || '';
    return !h || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(h)
      || (typeof location !== 'undefined' && location.protocol === 'file:');
  } catch (e) { return false; }
})();

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
    name: 'LOOP RPG MODE',
    sub: 'STAT-BUILD AUTO LOOP',
    desc: 'สร้างสเตตัสสาย RPG เดินวนแผนที่ เก็บลูท เลือกเพิร์กที่ Camp แล้วล้มบอส',
    icon: '🗺️',
    accent: '#33ddff',
    action: 'blh',
  },
];

// ── ฮีโร่ที่เล่นได้ (ใช้ asset boss ตัวละครเดิม) ──────────────────────────────
// แต่ละฮีโร่มี "สไตล์" (style label) แทนชื่อคลาส/อาชีพตรง ๆ + base stat สาย RPG
//   STR / AGI / VIT / DEX / INT / LUK → แปลงเป็น combat stat ใน deriveStats()
// หมายเหตุ: base stat ล็อกตามสเปก Boss Loop Mode (คลาสไลก์/distinct)
//   role = style label (ตาม CLAUDE.md — ห้ามโชว์ชื่อคลาส/อาชีพตรง ๆ)
//   passive = id ของพาสซีฟประจำฮีโร่ (ดู HERO_PASSIVES) — ทำงานในไฟต์อัตโนมัติ
const HEROES = [
  {
    id: 'noctisak47',
    name: 'NOCTISAK47',
    img: 'boxer.png',
    icon: 'boxer_icon.webp',
    role: 'SHADOW STRIKER',         // style label (ไม่ใช่ชื่อคลาส)
    passive: 'overdrive_shot',
    blurb: 'สายปืนสมดุล–แม่นยำ–คริต • ทุก 5 หมัดที่เข้า ยิง Overdrive Shot ที่ไม่พลาด',
    base: { str: 6, vit: 6, agi: 6, dex: 8, luk: 5, int: 4 },
  },
  {
    id: 'toei',
    name: 'TOEI',
    img: 'toei_boxer.png',
    icon: 'toei_boxer_icon.webp',
    role: 'HOLY GUARD',             // style label
    passive: 'power_punch',
    blurb: 'สายหนัก–อึด–เจาะเกราะ • ทุก 4 หมัดที่เข้า หมัดถัดไปกลายเป็น Power Punch',
    base: { str: 10, vit: 8, agi: 3, dex: 5, luk: 4, int: 2 },
  },
  {
    id: 'apologize',
    name: 'APOLOGIZE',
    img: 'apologize.png',
    icon: 'apologize_icon.webp',
    role: 'IRON FIST',              // style label
    passive: 'apology_counter',
    blurb: 'สายลื่นไหล–หลบ–สวนกลับ • หลบสำเร็จแล้วสวน Apology Counter ที่ไม่พลาด',
    base: { str: 4, vit: 4, agi: 10, dex: 5, luk: 8, int: 3 },
  },
];
const BASE_STAT_KEYS = ['str', 'agi', 'vit', 'dex', 'int', 'luk'];

// ── enemy roster (4 ตัว) — curate จาก standard/premium card assets เท่านั้น ──
// ตัด " CARD" ออกจากชื่อที่แสดง ตาม ASSET RULES
// หมายเหตุ: pekopeko ถูกนำออกจาก normal pool — ไม่ spawn เป็น normal monster บนแผนที่
const ENEMIES = [
  { id: 'poporingo',   name: 'POPORINGO',    img: 'cards/poporingo.png',   role: 'basic',  base: { hp: 30, atk: 6,  def: 1 } },
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
  elite_event:  '⭐ ELITE',   // Elite Event encounter
  mythic_event: '💎 MYTHIC',  // Mythic Event mini-boss
};

// ── minions (ใช้ card assets เช่นกัน) ────────────────────────────────────────
const MINIONS = {
  hungerfly: { id: 'hungerfly', name: 'HUNGER FLY', img: 'cards/hunger_fly.png', base: { hp: 60,  atk: 9,  def: 2 } },
  snore:     { id: 'snore',     name: 'SNORE',      img: 'cards/snore.png',      base: { hp: 75,  atk: 7,  def: 3 } },
  zoombie:   { id: 'zoombie',   name: 'ZOOMBIE',    img: 'cards/zoombie.png',    base: { hp: 90,  atk: 8,  def: 4 } },
};

// ── natural monsters (spawn อัตโนมัติบนแผนที่ — ไม่ใช่จาก spawnForLoop) ──────────
// อยู่ใน NATURAL_MONSTERS pool แยกต่างหาก; stats ต่ำกว่า ENEMIES เพื่อความปลอดภัยช่วง loop 1–3
const NATURAL_MONSTERS = [
  { id: 'boring',     name: 'BORING',     img: 'cards/boring.png',     role: 'basic', base: { hp: 20, atk: 4, def: 0 } },
  { id: 'faburr',     name: 'FABURR',     img: 'cards/fa-brrr.png',    role: 'fast',  base: { hp: 16, atk: 5, def: 0 } },
  { id: 'looney_tic', name: 'LOONEY TIC', img: 'cards/looneytic.png',  role: 'basic', base: { hp: 24, atk: 4, def: 1 } },
  { id: 'poporingo',  name: 'POPORINGO',  img: 'cards/poporingo.png',  role: 'basic', base: { hp: 30, atk: 6, def: 1 } },
  { id: 'dripz',      name: 'DRIPZ',      img: 'cards/dripz.png',      role: 'fast',  base: { hp: 18, atk: 5, def: 0 } },
];

// ── Pixel-sprite patterns (10 × 10; '1' = filled 3×3 block, '0' = transparent) ──────────
// Each block renders at 3 × 3 px via CSS box-shadow on a single 3×3 px <span>.
// Sprites are centered in map tiles at 30 × 30 px total. See buildPixelSprite().
const PIXEL_SPRITES = {
  // Natural monsters — distinct silhouettes
  boring:     ["0001111000","0011111100","0111111110","1111111111","1111111111","0111111110","0011111100","0001111000","0000000000","0000000000"],
  faburr:     ["0110000110","1111111111","1111111111","1111111111","0111111110","0011111100","0001111000","0000000000","0000000000","0000000000"],
  looney_tic: ["0010001000","0111111100","1111111111","0111111110","0011111100","0001111000","0100000010","0000000000","0000000000","0000000000"],
  poporingo:  ["0000110000","0001111000","0111111110","1111111111","1111111111","1111111111","0111111110","0011111100","0000000000","0000000000"],
  dripz:      ["0011111100","0111111110","1111111111","1111111111","0111111110","0011111100","0001111000","0000110000","0000010000","0000000000"],
  // spawnForLoop enemies — distinct silhouettes per role
  orcworrier: ["0011111100","0111111110","1111111111","1111111111","1111111111","1111111111","0110000110","0000000000","0000000000","0000000000"],
  mommy:      ["0001111000","0111111110","1111111111","1111111111","0111111110","1011101101","0000000000","0000000000","0000000000","0000000000"],
  skillworker:["0001111000","0011111100","0001111000","0011111100","0111111110","1111111111","0110000110","0000000000","0000000000","0000000000"],
  // Event sprites — special shapes
  elite:      ["0000110000","0001111000","0011111100","0111111110","1111111111","0111111110","0011111100","0001111000","0000110000","0000000000"],
  mythic:     ["1000000001","1100000011","0111111110","1111111111","1111111111","1111111111","0111111110","0011111100","0001111000","0000110000"],
};
const RANK_COLORS = {
  'blh-mob-weak':   '#44cc66',
  'blh-mob-normal': '#ddcc00',
  'blh-mob-elite':  '#ff8800',
  'blh-mob-mythic': '#dd1133',
};

// ── Elite Event enemies (card assets จาก Elite rarity — ไม่ซ้ำกับ ENEMIES/NATURAL_MONSTERS) ──
// spawn บน road tile, run-only, ใช้ role 'elite_event' เพื่อแสดง badge ต่าง + vsElite trait ทำงาน
const ELITE_EVENT_ENEMIES = [
  { id: 'hydra',       name: 'HYDRA',       img: 'cards/hydra.png',       role: 'elite_event', base: { hp: 120, atk: 16, def: 5 } },
  { id: 'execusioner', name: 'EXECUSIONER', img: 'cards/execusioner.png', role: 'elite_event', base: { hp: 110, atk: 20, def: 4 } },
  { id: 'freeoni',     name: 'FREEONI',     img: 'cards/freeoni.png',     role: 'elite_event', base: { hp: 140, atk: 13, def: 7 } },
];

// ── Mythic Event mini-boss pool (card assets จาก Mythic rarity) ──
// สู้คนเดียว, แข็งแกร่งกว่า Elite, เริ่มปรากฏ loop >= 6 AND terrainPower >= 12
const MYTHIC_EVENT_ENEMIES = [
  { id: 'beelzebruh',  name: 'BEELZEBRUH',  img: 'cards/beelzebruh.png',  role: 'mythic_event', base: { hp: 280, atk: 24, def: 8 } },
  { id: 'drunkula',    name: 'DRUNKULA',    img: 'cards/drunkula.png',    role: 'mythic_event', base: { hp: 260, atk: 27, def: 6 } },
  { id: 'nightmayor',  name: 'NIGHTMAYOR',  img: 'cards/nightmayor.png',  role: 'mythic_event', base: { hp: 310, atk: 21, def: 10 } },
];

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
// หมายเหตุ: ฟิลด์ `danger` = ค่าความเสี่ยงเฉพาะที่ (local danger) ของไทล์
//   map ตาม archetype ในสเปก (ชื่อ archetype อยู่ในคอมเมนต์):
//   Street Clinic +0, Boxing Gym/Street Thug +1, Treasure Fight/Dark Alley/Neon District +2,
//   Elite Fighter/Blood Shrine/Cursed Billboard +3
const MAP_CARDS = [
  // ── ROAD (วางบนช่องถนน — ผลเฉพาะช่องนั้น) ──
  { id: 'spawn_rift',  name: 'รอยแยกศัตรู', kind: 'road', icon: '🌀', accent: '#ff5577', danger: 3, // Blood Shrine
    desc: 'เสกศัตรูลงช่องถนนที่เลือกทันที + ลูทดีขึ้นบนช่องนั้น • Danger +3' },
  { id: 'pack_howl',   name: 'เสียงหอนฝูง', kind: 'road', icon: '🐺', accent: '#ff5577', danger: 3, // Elite Fighter
    desc: 'ศัตรูบนช่องถนนนี้แรงขึ้น แต่ดรอป Loop Zeny มากขึ้นเมื่อชนะบนช่องนี้ • Danger +3' },
  { id: 'blood_track', name: 'รอยเลือด',    kind: 'road', icon: '🩸', accent: '#ff5577', danger: 2, // Dark Alley
    desc: 'เพิ่มโอกาสดรอป Boss Signal เมื่อสู้บนช่องถนนนี้ • Danger +2' },
  // ── ADJACENT (วางบนช่องเทอเรนติดถนน — ส่งผลเฉพาะช่องถนนข้างเคียง) ──
  { id: 'campfire',    name: 'กองไฟ',       kind: 'adjacent', icon: '🔥', accent: '#ffcc44', danger: 0, // Street Clinic
    desc: 'ฟื้น HP +6 เมื่อเดินผ่านช่องถนนที่อยู่ติดกองไฟ • Danger +0' },
  { id: 'shrine',      name: 'ศาลเจ้า',     kind: 'adjacent', icon: '⛩️', accent: '#ffcc44', danger: 1, // Boxing Gym
    desc: 'ATK +2 ระหว่างสู้บนช่องถนนที่อยู่ติดศาลเจ้า • Danger +1' },
  { id: 'lucky_totem', name: 'โทเทมนำโชค',  kind: 'adjacent', icon: '🍀', accent: '#ffcc44', danger: 2, // Neon District
    desc: 'โอกาสดรอปลูท +12% บนช่องถนนที่อยู่ติดโทเทม • Danger +2' },
  // ── TERRAIN (วางบนช่องเทอเรน — บัฟทั้งรอบรัน + danger เฉพาะที่กับถนนข้างเคียง) ──
  { id: 'rock',        name: 'หินผา',       kind: 'terrain', icon: '🪨', accent: '#88ddaa', danger: 1, // Street Thug
    desc: 'DEF +3 ถาวรตลอดรอบรัน • Danger +1 ให้ถนนข้างเคียง' },
  { id: 'thornfield',  name: 'ทุ่งหนาม',    kind: 'terrain', icon: '🌵', accent: '#88ddaa', danger: 2, // Treasure Fight
    desc: 'ศัตรูเสีย HP เริ่มต้น -15% แต่ฮีโร่ก็เจ็บ +1 ต่อตา • Danger +2 ให้ถนนข้างเคียง' },
  { id: 'treasure',    name: 'ลานสมบัติ',   kind: 'terrain', icon: '💎', accent: '#88ddaa', danger: 2, // Treasure Fight
    desc: 'อัปเกรด tier ลูทขึ้น 1 ขั้นตลอดรอบรัน • Danger +2 ให้ถนนข้างเคียง' },
];
const MAP_CARD_BY_ID = Object.fromEntries(MAP_CARDS.map(c => [c.id, c]));

// ════════════════════════════════════════════════════════════════════════════
// GRID MAP MODEL (data-driven, locked spec 7×7) — เส้นทางลูป + ช่องเทอเรน
// (source of truth = cell id)
// ────────────────────────────────────────────────────────────────────────────
// • grid 7 คอลัมน์ × 7 แถว
// • route = Camp + Road 15 = 16 ช่อง (วงสี่เหลี่ยมเต็ม rows 1–5, cols 1–5)
// • ช่องที่เหลือทั้งหมด (non-road/non-camp) = terrain placement cell → ไม่มี
//   ช่องว่างเปล่า; เป็น "กระดานแผนที่" เต็มผืน
// • ฮีโร่เดินตาม route order เท่านั้น (เฉพาะ road/camp) — ไม่เหยียบ terrain
// ────────────────────────────────────────────────────────────────────────────
const BLH_GRID_W = 7, BLH_GRID_H = 7;
// route: Camp + 15 road — วงสี่เหลี่ยม (rows 1–5, cols 1–5), camp = ช่องแรก (ล่างกลาง, 5,3)
// • routeIndex 0 = Camp = hero spawn / cash out / boss signal / auto-pause + ฟื้น HP
// • ทุกช่องนอก route = terrain
const BLH_ROUTE_DEF = [
  { id: 'camp', row: 5, col: 3, type: 'camp', routeIndex: 0 },   // Camp ล่างกลาง
  { id: 'r01',  row: 5, col: 4, type: 'road', routeIndex: 1 },
  { id: 'r02',  row: 5, col: 5, type: 'road', routeIndex: 2 },   // มุมขวาล่าง
  { id: 'r03',  row: 4, col: 5, type: 'road', routeIndex: 3 },
  { id: 'r04',  row: 3, col: 5, type: 'road', routeIndex: 4 },
  { id: 'r05',  row: 2, col: 5, type: 'road', routeIndex: 5 },
  { id: 'r06',  row: 1, col: 5, type: 'road', routeIndex: 6 },   // มุมขวาบน
  { id: 'r07',  row: 1, col: 4, type: 'road', routeIndex: 7 },
  { id: 'r08',  row: 1, col: 3, type: 'road', routeIndex: 8 },   // บนกลาง
  { id: 'r09',  row: 1, col: 2, type: 'road', routeIndex: 9 },
  { id: 'r10',  row: 1, col: 1, type: 'road', routeIndex: 10 },  // มุมซ้ายบน
  { id: 'r11',  row: 2, col: 1, type: 'road', routeIndex: 11 },
  { id: 'r12',  row: 3, col: 1, type: 'road', routeIndex: 12 },
  { id: 'r13',  row: 4, col: 1, type: 'road', routeIndex: 13 },
  { id: 'r14',  row: 5, col: 1, type: 'road', routeIndex: 14 },  // มุมซ้ายล่าง
  { id: 'r15',  row: 5, col: 2, type: 'road', routeIndex: 15 },  // ล่างซ้าย → กลับ camp
];
// สร้าง cells: route ก่อน แล้วเติม "ทุกช่องที่เหลือ" เป็น terrain
const BLH_MAP = (() => {
  const cells = BLH_ROUTE_DEF.map(c => ({ ...c }));
  const used = new Set(cells.map(c => c.row + ',' + c.col));
  for (let row = 0; row < BLH_GRID_H; row++) {
    for (let col = 0; col < BLH_GRID_W; col++) {
      if (used.has(row + ',' + col)) continue;
      cells.push({ id: `t_${row}_${col}`, row, col, type: 'terrain' });
    }
  }
  // ฮีโร่เริ่มเดินไปซ้ายก่อน (clockwise: ซ้าย → บน-ซ้าย → บน → บน-ขวา → ขวา → กลับ)
  const campId = BLH_ROUTE_DEF[0].id;
  const roads = BLH_ROUTE_DEF.slice(1).reverse().map(c => c.id); // r15→r14→...→r01
  return { gridWidth: BLH_GRID_W, gridHeight: BLH_GRID_H, cells, route: [campId, ...roads] };
})();
const BLH_CELL_BY_ID = Object.fromEntries(BLH_MAP.cells.map(c => [c.id, c]));

// ── adjacency helpers (อิง grid row/col; static ไม่ขึ้นกับ run) ──────────────
// orthogonal neighbors: บน/ล่าง/ซ้าย/ขวา
function getNeighborCells(cellId) {
  const c = BLH_CELL_BY_ID[cellId];
  if (!c) return [];
  const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const out = [];
  for (const [dr, dc] of deltas) {
    const n = BLH_MAP.cells.find(x => x.row === c.row + dr && x.col === c.col + dc);
    if (n) out.push(n);
  }
  return out;
}
// ช่องถนน/camp ที่อยู่ติดกับ cell หนึ่ง (ใช้กับ adjacent card)
function getAdjacentRoadCells(cellId) {
  return getNeighborCells(cellId).filter(n => n.type === 'road' || n.type === 'camp');
}

// fx ว่าง (ใช้กับ boss fight / cell ที่ไม่มีผล)
const EMPTY_CELL_FX = Object.freeze({
  atkBonus: 0, lootBonus: 0, enemyDmgBonus: 0, zenyBonus: 0, bossSignalDropBonus: 0, stepHeal: 0,
});

// ผลรวมเอฟเฟกต์ "เฉพาะที่" สำหรับช่องถนนหนึ่ง:
//   1) road card ที่วางบนช่องถนนนั้นเอง
//   2) adjacent card บนช่องเทอเรนที่ติดกัน (orthogonal)
// terrain card เป็นบัฟทั้งรัน (run.mods) จึงไม่นับที่นี่
function getCellEffectsForRoad(roadCellId) {
  const run = BLH.run;
  const fx = { atkBonus: 0, lootBonus: 0, enemyDmgBonus: 0, zenyBonus: 0, bossSignalDropBonus: 0, stepHeal: 0 };
  if (!run || !run.cells) return fx;
  const self = run.cells[roadCellId];
  if (self && self.placedCardId) applyRoadCardFx(self.placedCardId, fx);
  for (const n of getNeighborCells(roadCellId)) {
    if (n.type !== 'terrain') continue;
    const tc = run.cells[n.id];
    if (tc && tc.placedCardId) applyAdjacentCardFx(tc.placedCardId, fx);
  }
  return fx;
}
function applyRoadCardFx(id, fx) {
  switch (id) {
    case 'spawn_rift':  fx.lootBonus += 0.08; break;           // ลูทดีขึ้นบนช่องนี้
    case 'pack_howl':   fx.enemyDmgBonus += 2; fx.zenyBonus += 40; break; // ศัตรูแรงขึ้น/ซีนี่มากขึ้น (ต่อชัยชนะบนช่องนี้)
    case 'blood_track': fx.bossSignalDropBonus += 0.20; break; // โอกาส Boss Signal บนช่องนี้
  }
}
function applyAdjacentCardFx(id, fx) {
  switch (id) {
    case 'campfire':    fx.stepHeal += 6; break;   // ฟื้นเมื่อเดินผ่านช่องถนนข้างๆ
    case 'shrine':      fx.atkBonus += 2; break;   // ATK ระหว่างสู้บนช่องถนนข้างๆ
    case 'lucky_totem': fx.lootBonus += 0.12; break; // โอกาสลูทบนช่องถนนข้างๆ
  }
}

// ════════════════════════════════════════════════════════════════════════════
// LOCAL DANGER — ความเสี่ยงเฉพาะที่ของช่องถนน (จากไทล์ที่วาง) — local ไม่ใช่ global
// ────────────────────────────────────────────────────────────────────────────
// danger รวมจาก: (1) การ์ดบนช่องถนนนั้นเอง + (2) การ์ดบนช่องเทอเรนที่ "ติดกัน"
//   (orthogonal) — ทั้ง adjacent และ terrain ส่ง danger ให้ถนนข้างเคียง
// ช่องถนนที่อยู่ไกล (ไม่ติดกับไทล์) = danger 0 (local เท่านั้น)
const DANGER_BAL = {
  STEP: 5,                 // ทุก 5 danger = 1 step
  HP_PER_STEP: 0.05,       // Enemy HP +5%/step
  ATK_PER_STEP: 0.04,      // Enemy ATK +4%/step
  ZENY_PER_STEP: 0.05,     // Loop Zeny +5%/step
  GEAR_DROP_PER_STEP: 0.04,// Gear drop chance +4%/step (ปริมาณ/โอกาส — ไม่แตะ tier/rarity)
};
function cardDanger(cardId) {
  const c = MAP_CARD_BY_ID[cardId];
  return c ? (c.danger || 0) : 0;
}
// local danger ของช่องถนนหนึ่ง (self road card + neighbor terrain cards)
function localDangerForRoad(roadCellId) {
  const run = BLH.run;
  if (!run || !run.cells) return 0;
  let d = 0;
  const self = run.cells[roadCellId];
  if (self && self.placedCardId) d += cardDanger(self.placedCardId);
  for (const n of getNeighborCells(roadCellId)) {
    if (n.type !== 'terrain') continue;          // เฉพาะเทอเรนที่ติดกัน (adjacent/terrain การ์ด)
    const tc = run.cells[n.id];
    if (tc && tc.placedCardId) d += cardDanger(tc.placedCardId);
  }
  return d;
}
// แปลง local danger → ตัวคูณ/โบนัส (ปริมาณ+รางวัล เท่านั้น; ไม่แตะ tier/rarity)
function localDangerScaling(localDanger) {
  const steps = Math.floor((localDanger || 0) / DANGER_BAL.STEP);
  return {
    steps,
    hpMult: 1 + steps * DANGER_BAL.HP_PER_STEP,
    atkMult: 1 + steps * DANGER_BAL.ATK_PER_STEP,
    zenyMult: 1 + steps * DANGER_BAL.ZENY_PER_STEP,
    gearDropBonus: steps * DANGER_BAL.GEAR_DROP_PER_STEP,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MAP CARD HAND — stack ตาม "ชนิด" (run-only)
// ────────────────────────────────────────────────────────────────────────────
// hand = [{ cardId, count, order }] เรียงตามลำดับที่ได้มา (order น้อย = เก่าสุด)
// จำกัด "จำนวนชนิด" ไม่เกิน MAX_CARD_TYPES (ไม่ใช่จำนวนใบรวม):
//   • ได้ใบซ้ำ → count++ (ไม่ overflow)
//   • ชนิดใหม่ & ยังไม่เต็ม → เพิ่ม stack x1
//   • ชนิดใหม่ & เต็ม 8/8 → เอา stack เก่าสุดออก แปลงเป็น Loop Zeny แล้วเพิ่มชนิดใหม่ x1
// ════════════════════════════════════════════════════════════════════════════
const MAX_CARD_TYPES = 8;
// มูลค่าแปลงเป็น Loop Zeny ต่อใบ (เล็กน้อย): road = พื้นฐาน (1–2); adjacent/terrain = utility/special (2–5)
const CARD_KIND_ZENY = { road: 2, adjacent: 3, terrain: 4 };
function cardZenyValue(cardId) {
  const c = MAP_CARD_BY_ID[cardId];
  return c ? (CARD_KIND_ZENY[c.kind] || 2) : 2;
}
function stackZeny(stack) { return cardZenyValue(stack.cardId) * stack.count; }
function handZeny(run) { return run.hand.reduce((s, st) => s + stackZeny(st), 0); }
function findHandStack(run, cardId) { return run.hand.find(s => s.cardId === cardId); }
// เพิ่มการ์ด 1 ใบเข้ามือ (จัดการ stack + overflow). ไม่มี failure — มือเต็ม → แปลงเก่าสุดทิ้ง
function addCardToHand(run, cardId) {
  const existing = findHandStack(run, cardId);
  if (existing) { existing.count += 1; return; }            // ซ้ำ → stack เพิ่ม (ไม่ overflow)
  if (run.hand.length >= MAX_CARD_TYPES) {                  // เต็ม → เอาเก่าสุดออก แปลงเป็น Zeny
    let oldest = 0;
    for (let i = 1; i < run.hand.length; i++) if (run.hand[i].order < run.hand[oldest].order) oldest = i;
    const removed = run.hand.splice(oldest, 1)[0];
    const zeny = stackZeny(removed);
    run.mods.zenyBonus += zeny;
    const rc = MAP_CARD_BY_ID[removed.cardId], nc = MAP_CARD_BY_ID[cardId];
    blhToast(`🃏 มือเต็ม! แปลง ${rc ? rc.name : removed.cardId} x${removed.count} → +${zeny} Zeny • เพิ่ม ${nc ? nc.name : cardId}`);
  }
  run.hand.push({ cardId, count: 1, order: run._handOrderSeq++ });
}
// ใช้การ์ด 1 ใบจาก stack (วางสำเร็จ) — stack เหลือ 0 = ลบชนิดนั้น; คืน true ถ้าใช้ได้
function consumeCardFromHand(run, cardId) {
  const st = findHandStack(run, cardId);
  if (!st || st.count <= 0) return false;
  st.count -= 1;
  if (st.count <= 0) run.hand.splice(run.hand.indexOf(st), 1);
  return true;
}
// stack เก่าสุด (order น้อยสุด) — ใช้มาร์ก UI
function oldestHandCardId(run) {
  if (!run.hand.length) return null;
  let oldest = run.hand[0];
  for (const s of run.hand) if (s.order < oldest.order) oldest = s;
  return oldest.cardId;
}

// ── จุดกึ่งกลาง (%) ของ cell บน CSS grid (ใช้วาง hero token แบบ absolute) ──
function cellCenterPct(cell) {
  return {
    x: ((cell.col + 0.5) / BLH_MAP.gridWidth) * 100,
    y: ((cell.row + 0.5) / BLH_MAP.gridHeight) * 100,
  };
}

// ── boss signal (การ์ดเป้าหมายรัน) ──────────────────────────────────────────
const BOSS_SIGNAL = { id: 'boss_signal', name: 'BOSS SIGNAL', icon: '📡', accent: '#ff2233' };

// ── gear: 4 ช่อง + 4 tier (Ragnarok parody / new assets → emoji placeholder) ─
// 5 ช่อง (สเปก Boss Loop Mode): Weapon เป็นช่องดาเมจหลัก + เป็นแหล่ง Lifesteal เดียว
const GEAR_SLOTS = [
  { id: 'weapon', name: 'WEAPON', icon: '🔫' },
  { id: 'glove',  name: 'GLOVE',  icon: '🥊' },
  { id: 'jacket', name: 'JACKET', icon: '🧥' },
  { id: 'boots',  name: 'BOOTS',  icon: '🥾' },
  { id: 'charm',  name: 'CHARM',  icon: '🔮' },
];
const GEAR_SLOT_IDS = GEAR_SLOTS.map(s => s.id);

// ── GEAR QUALITY: tier (1–4) × rarity (Common→Legendary) × traits (0–2) ──────
// tier = ความลึกของลูป + ชนิดศัตรู; rarity = คุณภาพการ roll + โอกาส trait
// tier stat range (ฐานช่วงค่าของ roll ก่อนคูณ rarity quality % และ stat scale)
const GEAR_TIER_DEFS = [
  { tier: 1, statMin: 2,  statMax: 8  },
  { tier: 2, statMin: 6,  statMax: 16 },
  { tier: 3, statMin: 12, statMax: 26 },
  { tier: 4, statMin: 20, statMax: 38 },
];
const GEAR_TIER_BY_N = Object.fromEntries(GEAR_TIER_DEFS.map(t => [t.tier, t]));

// rarity → คุณภาพ roll (สัดส่วนของ tier range) + สี (อ่านง่ายบนมือถือ)
const GEAR_RARITIES = [
  { id: 'common',    name: 'COMMON',    color: '#b6bcc6', rollMin: 0.40, rollMax: 0.65, rank: 0 },
  { id: 'rare',      name: 'RARE',      color: '#4fc3f7', rollMin: 0.60, rollMax: 0.80, rank: 1 },
  { id: 'epic',      name: 'EPIC',      color: '#b388ff', rollMin: 0.75, rollMax: 0.92, rank: 2 },
  { id: 'legendary', name: 'LEGENDARY', color: '#ffd54f', rollMin: 0.90, rollMax: 1.00, rank: 3 },
];
const GEAR_RARITY_BY_ID = Object.fromEntries(GEAR_RARITIES.map(r => [r.id, r]));

// base rarity weight ต่อ tier (ลึกขึ้น = โอกาส rarity สูงขึ้น)
const RARITY_WEIGHTS = {
  1: { common: 70, rare: 25, epic: 5,  legendary: 0  },
  2: { common: 50, rare: 33, epic: 14, legendary: 3  },
  3: { common: 32, rare: 36, epic: 24, legendary: 8  },
  4: { common: 18, rare: 34, epic: 33, legendary: 15 },
};

// trait chance ต่อ tier→rarity (ตามสเปก): t = โอกาสมี trait ≥1, tt = โอกาส trait ที่ 2
const TRAIT_CHANCE = {
  1: { common:{t:0.10,tt:0},    rare:{t:0.20,tt:0},    epic:{t:0.35,tt:0},    legendary:{t:0.50,tt:0}    },
  2: { common:{t:0.20,tt:0},    rare:{t:0.35,tt:0},    epic:{t:0.55,tt:0},    legendary:{t:0.75,tt:0}    },
  3: { common:{t:0.45,tt:0.05}, rare:{t:0.60,tt:0.15}, epic:{t:0.80,tt:0.30}, legendary:{t:0.95,tt:0.45} },
  4: { common:{t:0.65,tt:0.15}, rare:{t:0.80,tt:0.30}, epic:{t:0.95,tt:0.50}, legendary:{t:1.00,tt:0.70} },
};
// tier 1–2 = สูงสุด 1 trait, tier 3–4 = ได้ถึง 2 trait (ต้องต่างกัน)
const MAX_TRAITS_BY_TIER = { 1: 1, 2: 1, 3: 2, 4: 2 };

// ── 10 TRAITS (run-only) ── key = ฟิลด์ใน run.traitMods, per = ต่อชิ้น, cap = เพดานรวม
// traits stack ข้ามชิ้นได้ (รวมแล้ว clamp ที่ cap); ห้าม trait ซ้ำบนชิ้นเดียวกัน
const GEAR_TRAITS = [
  { id: 'blood_taste',   name: 'Blood Taste',   key: 'bloodTaste',   per: 0.04, cap: 0.10, desc: 'ฟื้น HP เมื่อสังหาร (เพดาน 10% maxHP/ตัว)' },
  { id: 'clean_escape',  name: 'Clean Escape',  key: 'cleanEscape',  per: 0.15, cap: 0.40, desc: 'ฟื้น HP ที่ Camp เพิ่ม (เพดาน +40%)' },
  { id: 'heavy_grip',    name: 'Heavy Grip',    key: 'heavyGrip',    per: 0.20, cap: 0.60, desc: 'ดาเมจใส่ Elite เพิ่ม (เพดาน +60%)' },
  { id: 'quick_step',    name: 'Quick Step',    key: 'quickStep',    per: 0.15, cap: 0.40, desc: 'ชนะไฟต์แล้ว ASPD เพิ่มจนจบลูป (เพดาน +40%)' },
  { id: 'lucky_find',    name: 'Lucky Find',    key: 'luckyFind',    per: 0.15, cap: 0.45, desc: 'โอกาสดรอปเกียร์เพิ่ม (เพดาน +45%)' },
  { id: 'card_sense',    name: 'Card Sense',    key: 'cardSense',    per: 0.15, cap: 0.45, desc: 'โอกาสดรอปการ์ดแผนที่เพิ่ม (เพดาน +45%)' },
  { id: 'counter_guard', name: 'Counter Guard', key: 'counterGuard', per: 0.12, cap: 0.30, desc: 'โอกาสสวนกลับเมื่อโดนตี (เพดาน 30%)' },
  { id: 'last_stand',    name: 'Last Stand',    key: 'lastStand',    per: 0.20, cap: 0.60, desc: 'ATK เพิ่มเมื่อ HP < 30% (เพดาน +60%)' },
  { id: 'iron_skin',     name: 'Iron Skin',     key: 'ironSkin',     per: 0.12, cap: 0.35, desc: 'ลดดาเมจจากศัตรูธรรมดา (เพดาน 35%)' },
  { id: 'sharp_rhythm',  name: 'Sharp Rhythm',  key: 'sharpRhythm',  per: 0.10, cap: 0.25, desc: 'หลังคริต โอกาสคริตเพิ่มจนจบไฟต์ (เพดาน +25%)' },
];
const GEAR_TRAIT_BY_ID = Object.fromEntries(GEAR_TRAITS.map(t => [t.id, t]));
const GEAR_TRAIT_KEYS = GEAR_TRAITS.map(t => t.key);

// ศัตรู "ธรรมดา" (สำหรับ Iron Skin / influence) — ไม่นับ elite/boss/minion
const NORMAL_ENEMY_ROLES = ['basic', 'fast', 'tank', 'cursed'];
// ── stat roll catalogue (ใช้กับ gear rolls + display) ─────────────────────────
// key → { label, pct?:true (เป็น %), scale:ตัวคูณจาก tier statRange, combat?:true }
//   base stat (STR..LUK) = ปั้นเลขจริง ๆ; combat stat = ผลลัพธ์ตรง (ATK/CRI/PEN ฯลฯ)
const STAT_ROLLS = {
  // base stats (แปลงผ่าน deriveStats)
  STR: { label: 'STR', scale: 0.5 },
  AGI: { label: 'AGI', scale: 0.5 },
  VIT: { label: 'VIT', scale: 0.5 },
  DEX: { label: 'DEX', scale: 0.5 },
  INT: { label: 'INT', scale: 0.5 },
  LUK: { label: 'LUK', scale: 0.5 },
  // combat stats (บวกตรงเข้า derived)
  ATK:    { label: 'ATK', scale: 1.0,  combat: true },
  HP:     { label: 'HP',  scale: 4.0,  combat: true },
  DEF:    { label: 'DEF', scale: 0.6,  combat: true },
  CRI:    { label: 'CRI', pct: true, scale: 0.6,  combat: true }, // % คริต
  CRIDMG: { label: 'CDMG', pct: true, scale: 2.0, combat: true }, // % คริตดาเมจ
  EVA:    { label: 'EVA', pct: true, scale: 0.5,  combat: true }, // % หลบ
  LS:     { label: 'LS',  pct: true, scale: 0.4,  combat: true }, // % ดูดเลือด
  PEN:    { label: 'PEN', scale: 0.5, combat: true },             // เจาะเกราะ flat
  ASPD:   { label: 'ASPD', scale: 0.8, combat: true },            // attack speed flat
  HIT:    { label: 'HIT', pct: true, scale: 0.5, combat: true },  // % แม่นยำ (เข้า hitBonus)
  DR:     { label: 'DR',  pct: true, scale: 0.4,  combat: true }, // % ลดดาเมจ
  DROP:   { label: 'DROP', pct: true, scale: 0.5, combat: true }, // % ดรอป/ซีนี่
};

// gear-slot → main/sub stat pool (สเปก Boss Loop Mode)
//   main stat แรงกว่า sub stat; Lifesteal มาจาก Charm เท่านั้น (ยัง gear-only)
const GEAR_MAIN_POOLS = {
  weapon: ['ATK', 'CRIDMG', 'PEN'],
  glove:  ['ASPD', 'HIT', 'CRI'],
  jacket: ['HP', 'DEF', 'DR'],
  boots:  ['AGI', 'EVA', 'ASPD'],
  charm:  ['LS', 'LUK', 'INT', 'DROP'],
};
const GEAR_SUB_POOLS = {
  weapon: ['STR', 'DEX', 'CRI', 'HIT'],
  glove:  ['DEX', 'LUK', 'CRIDMG', 'EVA'],
  jacket: ['VIT', 'HP', 'DEF', 'DR'],
  boots:  ['AGI', 'EVA', 'HIT', 'ASPD'],
  charm:  ['LUK', 'INT', 'LS', 'CRI', 'DROP'],
};

// ── Arena Training (permanent upgrades — ใช้ร่วมทุกฮีโร่, แยกจากเกมหลัก) ─────
const UPGRADES = [
  { id: 'startHp',    name: 'START HP',        icon: '❤️', desc: '+12 HP เริ่มต้น/เลเวล',         max: 5, costBase: 60,  costGrow: 1.6, per: 12 },
  { id: 'startAtk',   name: 'START ATK',       icon: '⚔️', desc: '+1 ATK เริ่มต้น/เลเวล',         max: 5, costBase: 80,  costGrow: 1.7, per: 1  },
  { id: 'startDef',   name: 'START DEF',       icon: '🛡️', desc: '+1 DEF เริ่มต้น/เลเวล',         max: 5, costBase: 70,  costGrow: 1.7, per: 1  },
  { id: 'lootChance', name: 'LOOT CHANCE',     icon: '🎁', desc: '+5% โอกาสดรอปลูท/เลเวล',        max: 5, costBase: 90,  costGrow: 1.7, per: 0.05 },
  { id: 'higherTier', name: 'HIGHER TIER',     icon: '✨', desc: '+8% โอกาสลูท tier สูงขึ้น/เลเวล', max: 5, costBase: 120, costGrow: 1.8, per: 0.08 },
  { id: 'extraCard',  name: 'EXTRA MAP CARD',  icon: '🃏', desc: '+1 การ์ดแผนที่เริ่มต้น/เลเวล',   max: 3, costBase: 150, costGrow: 2.0, per: 1  },
  { id: 'campHeal',   name: 'CAMP RECOVERY',   icon: '⛺', desc: 'ฟื้น HP +5%/เลเวล เมื่อถึง Camp (ฐาน 20%, เพดาน 50%)', max: 3, costBase: 100, costGrow: 1.7, per: 0.05 },
  // SAFE RETREAT (สเปก): เพิ่ม % Loop Zeny ที่เก็บได้เมื่อตาย (ฐาน 30% → เพดาน 50%)
  { id: 'safeDeath',  name: 'SAFE RETREAT',    icon: '🪽', desc: 'เก็บ Loop Zeny ตอนตาย +5%/เลเวล (ฐาน 30%, เพดาน 50%)', max: 4, costBase: 200, costGrow: 2.1, per: 0.05 },
  // LOOT BAG EXPANSION (สเปก): +2 ช่องกระเป๋าลูท/เลเวล (ฐาน 12 → สูงสุด 18)
  { id: 'bagExpand',  name: 'LOOT BAG',        icon: '🎒', desc: '+2 ช่องกระเป๋าลูท/เลเวล (ฐาน 12, สูงสุด 18)', max: 3, costBase: 130, costGrow: 1.8, per: 2 },
];
const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// ── balance constants ────────────────────────────────────────────────────────
const BAL = {
  // หมายเหตุ: ความยาวลูป = BLH_MAP.route.length (Camp + Road 15 = 16 ช่อง)
  BASE_LOOT_CHANCE: 0.45,
  BASE_SPAWN_CHANCE: 0.30,   // โอกาสเสกศัตรูในช่องว่างต่อ loop
  ENEMY_LOOP_SCALE: 0.17,    // ศัตรูแกร่งขึ้นต่อ loop
  // pacing เป้าหมาย: รันสำเร็จ ~15–30 นาที; Boss Signal เริ่มจริงราว loop 8+
  // ปกติพร้อมสู้บอสราว loop 12–18 (ดู rollDrops sigChance)
  BOSS_SIGNAL_MIN_LOOP: 8,   // เริ่มดรอปได้จริงราว loop 8+
  BOSS_SIGNAL_RAMP: 0.06,    // โอกาส Signal เพิ่ม/loop หลังถึง min (gradual)
  // pacing (1x = ช้า อ่านง่าย); 2x หาร 2; Pause = ไม่เดิน. ดู speedFactor()
  WALK_MS: 1150,             // ก้าวเดินต่อช่องที่ 1x (ช้าให้วางแผนทัน)
  BATTLE_MS: 950,            // จังหวะต่อรอบการสู้ที่ 1x (log อ่านทัน)
  BATTLE_OPEN_MS: 700,       // หน่วงก่อนรอบแรกหลังเปิด popup
  CASHOUT_PER_LOOP: 40,
  BOSS_BONUS: 350,
  // ── Natural monster spawning ──
  CYCLE_MS: 12000,            // รอบสปอว์นทุก 12 วินาที (นับเฉพาะระหว่างเดิน)
  MONSTER_STACK_MAX: 3,       // สูงสุด 3 ตัว/ช่องถนน
  NATURAL_CAP_BASE: 3,        // จำนวนสูงสุดพื้นฐาน (จะเพิ่มตาม loop)
  NATURAL_CAP_MAX: 8,         // เพดานสูงสุด
  NATURAL_INITIAL_SPAWN: 3,   // เสก natural monster ตอนเริ่มรัน
  NATURAL_CYCLE_CHANCE: 0.35, // โอกาสสปอว์นต่อรอบ 12 วินาที
  // ── Boss terrain ──
  BOSS_TERRAIN_THRESHOLD_BASE: 10,  // terrain power ที่เรียก boss terrain ครั้งแรก
  TERRAIN_BOSS_ZENY: 100,           // Loop Zeny โบนัสจาก terrain boss victory
  // หมายเหตุ: การแปลงการ์ดแผนที่เหลือเป็น Loop Zeny ใช้ handZeny() (per-kind) — ดู CARD_KIND_ZENY
  // ── Elite/Mythic Road Events — spawn บน road tile, max 1 active ──
  ELITE_EVENT_UNLOCK_LOOP:   3,     // ปลดล็อก loop >= 3
  ELITE_EVENT_UNLOCK_POWER:  6,     // หรือ terrainPower >= 6 (OR condition)
  ELITE_EVENT_BASE_CHANCE:   0.06,  // 6% ต่อรอบ cycle
  ELITE_EVENT_POWER_BONUS:   0.01,  // +1% ทุก 5 terrainPower
  ELITE_EVENT_CHANCE_CAP:    0.12,  // เพดาน 12%
  ELITE_EVENT_ZENY:          40,    // Loop Zeny รางวัล Elite
  MYTHIC_EVENT_UNLOCK_LOOP:  6,     // ปลดล็อก loop >= 6
  MYTHIC_EVENT_UNLOCK_POWER: 12,    // AND terrainPower >= 12 (AND condition)
  MYTHIC_EVENT_BASE_CHANCE:  0.02,  // 2% ต่อรอบ cycle
  MYTHIC_EVENT_POWER_BONUS:  0.01,  // +1% ทุก 10 terrainPower
  MYTHIC_EVENT_CHANCE_CAP:   0.06,  // เพดาน 6%
  MYTHIC_EVENT_ZENY:         120,   // Loop Zeny รางวัล Mythic
};

// ════════════════════════════════════════════════════════════════════════════
// SPEC_BAL — ค่าบาลานซ์หลักตามสเปก Boss Loop Mode (รวมไว้ที่เดียวเพื่อปรับง่าย)
// ════════════════════════════════════════════════════════════════════════════
const SPEC_BAL = {
  // ── HIT / MISS (สเปก: ทั้งฮีโร่และศัตรูพลาดได้) ──
  BASE_HIT: 0.90,            // โอกาสเข้าฐาน
  MIN_HIT: 0.75,            // เพดานล่างหลังหัก dodge เป้าหมาย
  MAX_HIT: 0.98,            // เพดานบน
  // ── LIFESTEAL (สเปก: มาจากเกียร์เท่านั้น + เพดานฟื้นต่อหมัด) ──
  LS_HEAL_NORMAL: 0.15,      // ฟื้นได้สูงสุด 15% maxHP ต่อหมัดปกติ
  LS_HEAL_SPECIAL: 0.20,     // ฟื้นได้สูงสุด 20% maxHP ต่อสกิลพิเศษ
  // ── CAMP / DEATH economy (สเปก) ──
  CAMP_HEAL_BASE: 0.20,      // ฟื้นฐาน 20% maxHP เมื่อถึง Camp
  CAMP_HEAL_CAP: 0.50,       // เพดานฟื้นรวมโบนัส 50%
  DEATH_RECOVERY_BASE: 0.30, // เก็บ Loop Zeny 30% เมื่อตาย
  DEATH_RECOVERY_CAP: 0.50,  // เพดานรวม Safe Retreat 50%
};

// ════════════════════════════════════════════════════════════════════════════
// HERO PASSIVES — พาสซีฟประจำฮีโร่ (สเปก) ทำงานอัตโนมัติในไฟต์
//   • นับเฉพาะ "หมัดปกติที่เข้า" (miss ไม่นับ) → battle.hitStreak
//   • สกิลพิเศษ: ไม่พลาด, คริตได้, ยังถูกลด DEF/มิทิเกชัน, มีเพดานดาเมจสุดท้ายหลังคริต
//   เปอร์เซ็นต์เป็นสัดส่วนของ ATK ฮีโร่ ณ ขณะนั้น
// ════════════════════════════════════════════════════════════════════════════
const HERO_PASSIVES = {
  noctisak47: {
    id: 'overdrive_shot', name: 'Overdrive Shot', mode: 'every', everyHits: 5,
    basePct: 1.40, capPct: 2.20, dexPer5: 0.05, strPer5: 0.03,
    lukZenyPer5: 0.03, zenyOnHit: 20, finalCapAfterCrit: 3.30,
  },
  toei: {
    id: 'power_punch', name: 'Power Punch', mode: 'charge', everyHits: 4,
    basePct: 1.90, vsElitePct: 2.20, capPct: 3.20, strPer5: 0.08,
    dexPenPer5: 1, vitShieldPer5: 3, finalCapAfterCrit: 4.50,
  },
  apologize: {
    id: 'apology_counter', name: 'Apology Counter', mode: 'counter',
    baseDodge: 0.18, counterPct: 0.80, capPct: 1.40, strPer5: 0.04,
    lukCritPer5: 0.05, finalCapAfterCrit: 2.50,
  },
};

// ════════════════════════════════════════════════════════════════════════════
// RUN EXP / LEVEL — run-only (รีเซ็ตเมื่อรันจบ ไม่บันทึกถาวร)
// ════════════════════════════════════════════════════════════════════════════
// EXP ที่ศัตรูแต่ละ role ให้เมื่อถูกฆ่า (สเปก)
const ENEMY_EXP = { basic: 8, fast: 12, tank: 14, cursed: 16, elite: 35, elite_event: 35, mythic_event: 60 };
// EXP ที่ต้องการขึ้น level ถัดไป (สเปก: 30 + (level-1)² × 18)
function expToNext(level) { return 30 + Math.pow(level - 1, 2) * 18; }
// แผนเติบโต 4 แบบ — deterministic repeating pattern (cursor หมุนต่อเนื่องข้ามการ level-up)
// 'default' = hero-specific pattern จาก HERO_DEFAULT_ORDERS; order:null = resolve ตอน runtime
const EXP_PRESETS = [
  { id: 'default', name: 'DEFAULT', icon: '⭐', order: null },
  { id: 'balance', name: 'BALANCE', icon: '⚖️', order: ['str','vit','agi','dex','luk','vit'] },
  { id: 'tank',    name: 'TANK',    icon: '🛡️', order: ['vit','str','dex'] },
  { id: 'speed',   name: 'SPEED',   icon: '⚡', order: ['agi','str','dex','agi','luk','str'] },
];
// default pattern per hero (ใช้เมื่อ growthPlan === 'default')
const HERO_DEFAULT_ORDERS = {
  noctisak47: ['agi', 'str', 'luk'],
  toei:       ['str', 'vit', 'dex'],
  apologize:  ['agi', 'str', 'dex'],
};
// ทุก hero เริ่มที่ 'default' plan (pattern เฉพาะตัวแต่ละฮีโร่)
const HERO_DEFAULT_PLAN = { noctisak47: 'default', toei: 'default', apologize: 'default' };

// ════════════════════════════════════════════════════════════════════════════
// SPEC STATUS — Boss Loop Mode backlog ครบแล้ว (ไม่มี deferred เหลือ)
//   ทำครบ: gear tier/rarity/traits, run EXP/level/stat allocation (draft→confirm),
//          Local Danger (per-road), Map-card hand stacking (8 ชนิด + overflow → Zeny),
//          Gear Bag cap (12→18) + overflow auto-salvage (40%) + manual sell (100%)
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// STAT MODEL — base stat (STR..LUK) → derived combat stat + caps
// ════════════════════════════════════════════════════════════════════════════
// เพดาน combat stat (กันบิลด์พังบาลานซ์) ตามสเปก
const STAT_CAPS = {
  critRate: 0.50,    // 50%
  critDamage: 2.50,  // 250%
  evasion: 0.35,     // 35% (dodge)
  lifesteal: 0.20,   // 20%
  damageReduction: 0.60,
  armorPen: 40,      // flat cap ตามสเกล DEF (คงเดิมเพื่อรักษาบาลานซ์)
  dropBonus: 0.40,   // gear/card drop bonus +40% (สเปก)
  attackSpeedAdd: 60,// attack speed บวกจากเกียร์/trait สูงสุด +60 (สเปก +60%)
};

// perkMods เปล่า (run-only) — ทั้ง stat-bonus และ behavior flag
function emptyPerkMods() {
  return {
    // base stat adds
    str: 0, agi: 0, vit: 0, dex: 0, int: 0, luk: 0,
    // combat stat adds
    atk: 0, def: 0, hp: 0, aspd: 0,
    critRate: 0, critDamage: 0, evasion: 0, lifesteal: 0, armorPen: 0, damageReduction: 0,
    // behavior flags / values
    execLowHp: 0,        // backstab: +dmg vs target <50% hp
    doubleStrike: 0,     // โอกาสตีเบาเพิ่ม 1 ครั้ง
    dotChance: 0,        // venom: โอกาสติดพิษ
    dodgeCounter: 0,     // counter หลังหลบ (สัดส่วนดาเมจ)
    critKillBonus: false,// crit kill → zeny/drop พิเศษ
    killBuffAtk: 0,      // หลังฆ่า → ATK ชั่วคราว
    lowHpGuard: 0,       // HP<40% → ลดดาเมจรับ
    campRecov: 0,        // ฟื้นที่ Camp เพิ่ม
    retaliate: 0,        // โอกาสสวนกลับเมื่อโดนตี
    armorBreak: 0,       // ตีแล้วลด DEF ศัตรูชั่วคราว
    burstReduce: 0,      // ลดดาเมจคริต/เบิร์สที่รับ
    postCampAtk: 0,      // หลังผ่าน Camp → ATK 1 loop
    comboFlow: 0,        // ตีต่อเนื่อง → ดาเมจสะสมในไฟต์
    thirdHit: 0,         // ทุกหมัดที่ 3 → ดาเมจพิเศษ
    lowHpAtk: 0,         // HP<30% → +ATK
    lowHpEva: 0,         // HP<30% → +EVA
    winHeal: 0,          // ชนะไฟต์ → ฟื้น HP (สัดส่วน maxhp)
  };
}

// derive combat stat จาก base stat (+ gear + perk + terrain mod)
// คืน object combat stat พร้อม cap แล้ว (ไม่รวม current hp)
// ── stat → combat ตามสเปก Boss Loop Mode ──
//   STR: +1 ATK; ทุก 5 STR → คริตดาเมจ +5%
//   VIT: +8 maxHP; ทุก 5 VIT → DEF +1
//   AGI: +1.5% ความเร็วโจมตี; ทุก 5 AGI → หลบ +2%
//   DEX: +1% hit; ทุก 5 DEX → เจาะเกราะ +3 (flat ในโมเดลนี้)
//   LUK: +0.8% คริต; ทุก 5 LUK → หลบ +1%
//   INT: +1% terrain effect; ทุก 5 INT → heal effect +3%
//   หมายเหตุสเปก: Lifesteal มาจากเกียร์เท่านั้น (ไม่มาจาก stat/terrain/upgrade)
function deriveCombat(b, addCombat) {
  const a = addCombat || {};
  let atk = 5 + b.str * 1.0;
  let maxhp = 60 + b.vit * 8;
  let def = 1 + Math.floor(b.vit / 5);
  let aspd = 100 + b.agi * 1.5;
  let critRate = 0.05 + b.luk * 0.008;
  let critDamage = 1.5 + Math.floor(b.str / 5) * 0.05;
  let evasion = Math.floor(b.agi / 5) * 0.02 + Math.floor(b.luk / 5) * 0.01;
  let lifesteal = 0;                                  // สเปก: gear-only
  let armorPen = Math.floor(b.dex / 5) * 3 + Math.floor(b.str / 5) * 1;
  let hitBonus = b.dex * 0.01;                        // +1% hit ต่อ DEX
  let healEffect = Math.floor(b.int / 5) * 0.03;      // ทุก 5 INT → +3% heal
  let terrainEffect = b.int * 0.01;                   // +1% terrain effect ต่อ INT
  let damageReduction = 0;
  let dropBonus = 0;
  // + combat adds (gear/perk/upgrade)
  atk += a.atk || 0;  maxhp += a.hp || 0;  def += a.def || 0;  aspd += a.aspd || 0;
  critRate += a.critRate || 0;  critDamage += a.critDamage || 0;  evasion += a.evasion || 0;
  lifesteal += a.lifesteal || 0;  armorPen += a.armorPen || 0;  damageReduction += a.damageReduction || 0;
  dropBonus += a.dropBonus || 0;  hitBonus += a.hitBonus || 0;   // HIT gear stat
  // round + caps
  return {
    atk: Math.max(1, Math.round(atk)),
    maxhp: Math.max(1, Math.round(maxhp)),
    def: Math.max(0, Math.round(def)),
    aspd: Math.round(aspd),
    hitBonus: clamp(hitBonus, 0, 0.5),
    healEffect: clamp(healEffect, 0, 0.40),           // เพดาน heal effect 40%
    terrainEffect: clamp(terrainEffect, 0, 0.35),     // เพดาน terrain effect 35%
    critRate: clamp(critRate, 0, STAT_CAPS.critRate),
    critDamage: clamp(critDamage, 1.0, STAT_CAPS.critDamage),
    evasion: clamp(evasion, 0, STAT_CAPS.evasion),
    lifesteal: clamp(lifesteal, 0, STAT_CAPS.lifesteal),
    armorPen: clamp(Math.round(armorPen), 0, STAT_CAPS.armorPen),
    damageReduction: clamp(damageReduction, 0, STAT_CAPS.damageReduction),
    dropBonus: clamp(dropBonus, 0, STAT_CAPS.dropBonus),
    // extra-attack chance จาก ASPD (>100) — cap 0.40
    extraHit: clamp((aspd - 100) / 100 * 0.4, 0, 0.40),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// PERK SYSTEM — run-only, 8 perks/ฮีโร่, เลือกที่ Camp
// ════════════════════════════════════════════════════════════════════════════
// perk: { id, name, desc, tags:[...], mod:(m)=>void }  (mod แก้ perkMods in-place)
const HERO_PERKS = {
  noctisak47: [
    { id: 'backstab', name: 'Backstab Rhythm', desc: 'ดาเมจ +30% ต่อศัตรูที่ HP ต่ำกว่า 50%', tags: ['ATK', 'EXECUTE'], mod: m => { m.execLowHp += 0.30; } },
    { id: 'shadowstep', name: 'Shadow Step', desc: 'EVA +8%', tags: ['EVA'], mod: m => { m.evasion += 0.08; } },
    { id: 'doublestrike', name: 'Double Strike', desc: '15% โอกาสตีเบาเพิ่ม 1 ครั้ง', tags: ['ASPD'], mod: m => { m.doubleStrike += 0.15; } },
    { id: 'critinstinct', name: 'Crit Instinct', desc: 'CRI +10%', tags: ['CRI'], mod: m => { m.critRate += 0.10; } },
    { id: 'venomedge', name: 'Venom Edge', desc: 'หมัดมีโอกาสติดพิษ (DoT)', tags: ['DOT'], mod: m => { m.dotChance += 0.35; } },
    { id: 'vanishcounter', name: 'Vanish Counter', desc: 'หลังหลบสำเร็จ สวนกลับเบา ๆ', tags: ['EVA', 'COUNTER'], mod: m => { m.dodgeCounter += 0.5; } },
    { id: 'luckycut', name: 'Lucky Cut', desc: 'คริตสังหาร → Loop Zeny/ลูทพิเศษ', tags: ['LUK'], mod: m => { m.critKillBonus = true; } },
    { id: 'silentexec', name: 'Silent Execution', desc: 'หลังฆ่าศัตรู ได้ ATK ชั่วคราวจนถึง loop ถัดไป', tags: ['ATK'], mod: m => { m.killBuffAtk += 4; } },
  ],
  toei: [
    { id: 'shieldwall', name: 'Shield Wall', desc: 'DEF +5', tags: ['DEF'], mod: m => { m.def += 5; } },
    { id: 'guardstance', name: 'Guard Stance', desc: 'HP ต่ำกว่า 40% ลดดาเมจรับ 25%', tags: ['DEF'], mod: m => { m.lowHpGuard += 0.25; } },
    { id: 'holyresolve', name: 'Holy Resolve', desc: 'ฟื้น HP ที่ Camp เพิ่ม +12%', tags: ['HEAL'], mod: m => { m.campRecov += 0.12; } },
    { id: 'retaliate', name: 'Retaliate', desc: 'โอกาส 25% สวนกลับเมื่อโดนตี', tags: ['COUNTER'], mod: m => { m.retaliate += 0.25; } },
    { id: 'ironfaith', name: 'Iron Faith', desc: 'Max HP +40', tags: ['HP'], mod: m => { m.hp += 40; } },
    { id: 'armorbreak', name: 'Armor Break', desc: 'หมัดลด DEF ศัตรูชั่วคราว', tags: ['DEBUFF'], mod: m => { m.armorBreak += 2; } },
    { id: 'standground', name: 'Stand Ground', desc: 'ลดดาเมจคริต/เบิร์สที่รับ 30%', tags: ['DEF'], mod: m => { m.burstReduce += 0.30; } },
    { id: 'sacredcharge', name: 'Sacred Charge', desc: 'หลังผ่าน Camp ได้ ATK เพิ่ม 1 loop', tags: ['ATK'], mod: m => { m.postCampAtk += 0.20; } },
  ],
  apologize: [
    { id: 'comboflow', name: 'Combo Flow', desc: 'ตีต่อเนื่องในไฟต์ ดาเมจค่อย ๆ เพิ่ม', tags: ['ATK', 'COMBO'], mod: m => { m.comboFlow += 0.05; } },
    { id: 'spiritfist', name: 'Spirit Fist', desc: 'ทุกหมัดที่ 3 ดาเมจพิเศษ', tags: ['ATK', 'COMBO'], mod: m => { m.thirdHit += 0.5; } },
    { id: 'innerfocus', name: 'Inner Focus', desc: 'CRI DMG +30%', tags: ['CRIDMG'], mod: m => { m.critDamage += 0.30; } },
    { id: 'lifepulse', name: 'Life Pulse', desc: 'LS +5%', tags: ['LS'], mod: m => { m.lifesteal += 0.05; } },
    { id: 'counterpalm', name: 'Counter Palm', desc: 'โอกาส 25% สวนกลับเมื่อโดนตี', tags: ['COUNTER'], mod: m => { m.retaliate += 0.25; } },
    { id: 'breakguard', name: 'Break Guard', desc: 'PEN +5', tags: ['PEN'], mod: m => { m.armorPen += 5; } },
    { id: 'finalbreath', name: 'Final Breath', desc: 'HP ต่ำกว่า 30% ได้ ATK และ EVA เพิ่ม', tags: ['ATK', 'EVA'], mod: m => { m.lowHpAtk += 0.25; m.lowHpEva += 0.10; } },
    { id: 'calmstrike', name: 'Calm Strike', desc: 'หลังชนะไฟต์ ฟื้น HP เล็กน้อย', tags: ['HEAL'], mod: m => { m.winHeal += 0.08; } },
  ],
};

// perk trigger schedule
const PERK_LOOP_TRIGGERS  = [3, 6, 9, 12, 15, 18];  // ครบ loop เหล่านี้ → +1 pending
const PERK_BUILD_TRIGGERS = [5, 10, 15];            // วางการ์ด/สิ่งก่อสร้างครบ → +1 pending

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
  _finishTimer: null, // หน่วงเวลาเปลี่ยนหน้า/จบรันหลังการสู้ (cancel ได้ผ่าน blhAbortTimers)
  _cycleTimer: null,  // รอบสปอว์น natural monster (12 วินาที; รันเฉพาะระหว่างเดิน)
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
  if (BLH._finishTimer) { clearTimeout(BLH._finishTimer); BLH._finishTimer = null; }
  stopCycleTimer();
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
      <div class="blh-hero-stats">${baseStatChips(h.base)}</div>
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
    <div class="blh-ss-base">${baseStatChips(s.base)}</div>
    <div class="blh-ss-row">${combatStatChips(s.combat)}</div>
    <div class="blh-ss-row dim"><span>🃏 การ์ดเริ่มต้น ${s.startCards}</span></div>`;
}

// แถวชิป base stat (STR/AGI/VIT/DEX/INT/LUK) — สั้น กระชับ มือถือ
function baseStatChips(b) {
  return BASE_STAT_KEYS.map(k =>
    `<span class="blh-bstat"><b>${k.toUpperCase()}</b> ${b[k]}</span>`).join('');
}
// แถวชิป combat stat (ATK/DEF/HP/ASPD/CRI/CDMG/EVA/LS/PEN) — label สั้น
function combatStatChips(c) {
  return [
    `⚔️ATK ${c.atk}`, `🛡️DEF ${c.def}`, `❤️HP ${c.maxhp}`, `⚡ASPD ${c.aspd}`,
    `CRI ${Math.round(c.critRate * 100)}%`, `CDMG ${Math.round(c.critDamage * 100)}%`,
    `EVA ${Math.round(c.evasion * 100)}%`, `LS ${Math.round(c.lifesteal * 100)}%`, `PEN ${c.armorPen}`,
  ].map(t => `<span>${t}</span>`).join('');
}

// คำนวณสเตตัสเริ่มต้น = base stat ฮีโร่ + Arena Training (combat adds) → derive
function computeStartStats(hero) {
  const b = { ...hero.base };
  const adds = {
    atk: Math.round(upgValue('startAtk')),
    hp:  Math.round(upgValue('startHp')),
    def: Math.round(upgValue('startDef')),
  };
  const combat = deriveCombat(b, adds);
  const startCards = 2 + upgLevel('extraCard');
  return { base: b, combat, startCards };
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
// ── สร้าง run state ──────────────────────────────────────────────────────────
function startRun() {
  const hero  = HEROES.find(h => h.id === BLH.sel.heroId) || HEROES[0];
  const stage = STAGES.find(s => s.id === BLH.sel.stageId) || STAGES[0];
  const boss  = BOSSES[BLH.sel.bossId] || BOSSES.suang;
  const ss = computeStartStats(hero);

  // runtime cell state ต่อ run — อ้างด้วย cell id (source of truth = grid config)
  const cells = {};
  for (const def of BLH_MAP.cells) {
    cells[def.id] = { id: def.id, type: def.type, enemy: null, placedCardId: null };
  }

  // เริ่มเกียร์/มอดิฟายเออร์
  const run = {
    hero, stage, boss,
    loop: 1,
    route: BLH_MAP.route,   // ลำดับ cell id ที่ฮีโร่เดิน (source of truth ของการเดิน)
    routePos: 0,            // index ใน route (0 = camp เริ่มต้น)
    phase: 'idle',
    base: { ...hero.base },             // base stat สาย RPG (str..luk)
    statBase: { ...hero.base },         // base stat หลังรวม perk/gear (สำหรับแสดงผล)
    stats: { hp: null, maxhp: ss.combat.maxhp },  // derived combat — เติมใน recomputeStats
    gear: { weapon: null, glove: null, jacket: null, boots: null, charm: null },
    lootBag: [],
    hand: [],               // [{ cardId, count, order }] — stack ตามชนิด (≤ MAX_CARD_TYPES)
    _handOrderSeq: 0,       // ตัวนับลำดับการได้การ์ด (order ของ stack)
    cells,                  // { [cellId]: { id, type, enemy, placedCardId } }
    placedCells: {},        // { [cellId]: { cardId, cardType, placedLoop } } — บันทึกการวาง
    placedCount: 0,         // จำนวนการ์ด/สิ่งก่อสร้างที่วางแล้ว (trigger เพิร์ก)
    mods: {
      // global run buffs (เฉพาะ terrain card + upgrade) — adjacent/road card เป็น cell-based
      atk: 0, def: 0, maxhp: 0,
      lootBonus: 0, enemyHpMult: 1, enemyDmgBonus: 0,
      lootTierBump: 0, stepHeal: 0, thornSelf: 0,
      zenyBonus: 0, bossSignalDropBonus: 0,
    },
    // ── perk system (run-only) ──
    perks: [],              // perk id ที่เลือกแล้ว (ไม่ซ้ำในรันเดียว)
    perkMods: emptyPerkMods(),
    perkPending: 0,         // จำนวนสิทธิ์เลือกเพิร์กค้างอยู่ (แสดงตอนถึง Camp)
    perkOffer: null,        // [perkId×3] ตัวเลือกปัจจุบัน
    perkLoopFired: [],      // loop trigger ที่ยิงแล้ว
    perkBuildFired: [],     // building milestone ที่ยิงแล้ว
    bossSignalObtained: false,
    bossSignalPlaced: false,
    bossFought: false,
    // ── Natural monster stacks (run-only) ──────────────────────────────────────
    // { [cellId]: [enemy, ...] } — สูงสุด MONSTER_STACK_MAX ตัว/ช่อง; ล้างเมื่อจบรัน
    monsterTiles: {},
    // ── Boss terrain (run-only) ─────────────────────────────────────────────────
    terrainPower: 0,                                    // พลังเทอเรนสะสมจากการ์ดที่วาง
    nextBossTerrainThreshold: BAL.BOSS_TERRAIN_THRESHOLD_BASE, // เกณฑ์ต่อไป
    bossTerrainCell: null,                              // cellId ของ boss terrain ที่ active
    // ── Elite/Mythic Road Events (run-only, max 1 active each) ────────────────
    eliteEventTile: null,   // cellId ของ Elite Event marker ที่ active บนถนน
    mythicEventTile: null,  // cellId ของ Mythic Event marker ที่ active บนถนน
    speed: 1,               // 0 = Pause, 1 = 1x (ช้า, default), 2 = 2x
    ended: false,
    _placing: null,
    // ── gear traits (run-only) ──
    traitMods: null,        // เซ็ตใน recomputeStats (aggregateTraits)
    _quickStepActive: false,// Quick Step trait: ASPD บัฟหลังชนะไฟต์จนจบลูป
    // ── run EXP / level / Auto Growth Plan (run-only — รีเซ็ตเมื่อรันจบ) ──
    // Level-up จัดสรร +2 แต้มอัตโนมัติตาม growthPlan ทันที (ไม่มี draft/confirm)
    level: 1,
    exp: 0,
    expToNext: expToNext(1),  // = 30
    growthPlan: HERO_DEFAULT_PLAN[hero.id] || 'default',       // แผนเติบโตอัตโนมัติ
    planCursor: 0,                                              // ตำแหน่ง pattern ปัจจุบัน (ต่อเนื่องข้ามการ level-up)
    runStats: { str: 0, vit: 0, agi: 0, dex: 0, luk: 0, int: 0 }, // stat ที่ได้จาก level-up รันนี้
  };
  BLH.run = run;

  // การ์ดแผนที่เริ่มต้น (2 + extraCard upgrade) — สุ่มจากกองทั้งหมด (stack ตามชนิด)
  const startCards = ss.startCards;
  for (let i = 0; i < startCards; i++) addCardToHand(run, pick(MAP_CARDS).id);

  // ปิดเพลงไตเติลของเกมหลักระหว่างเล่นรัน
  if (typeof window.stopBGM === 'function') window.stopBGM();

  spawnForLoop(run); // เสกศัตรูพื้นฐาน loop แรก
  spawnNaturalMonsters(run, BAL.NATURAL_INITIAL_SPAWN); // เสก natural monster เริ่มต้น
  renderRunScreen();
  applyMods(run);
  recomputeStats(run);
  updateHUD();
  setPhase('walking');
  scheduleStep(700);
  startCycleTimer();
}

// ── road cell ids (helper) ──
function roadCellIds() { return BLH_MAP.cells.filter(c => c.type === 'road').map(c => c.id); }

// ── เสกศัตรูพื้นฐานในช่องถนนว่างของ loop ปัจจุบัน ──────────────────────────────
function spawnForLoop(run) {
  const chance = BAL.BASE_SPAWN_CHANCE + Math.min(0.2, (run.loop - 1) * 0.03);
  const roads = roadCellIds();
  for (const id of roads) {
    const rc = run.cells[id];
    if (rc.enemy) continue;
    if (Math.random() < chance) rc.enemy = makeEnemy(pick(ENEMIES), run);
  }
  // กันลูปไม่มีอะไรเลย — การันตีอย่างน้อย 1 ตัว
  if (!roads.some(id => run.cells[id].enemy)) {
    const empties = roads.filter(id => !run.cells[id].enemy);
    if (empties.length) run.cells[pick(empties)].enemy = makeEnemy(pick(ENEMIES), run);
  }
}

// ── สร้าง enemy instance (scale ตาม loop + terrain hp mult) ──────────────────
// หมายเหตุ: enemyDmgBonus (pack_howl) เป็น cell-based แล้ว จึงไม่บวกตอน spawn
function makeEnemy(def, run, opts = {}) {
  const mult = (1 + BAL.ENEMY_LOOP_SCALE * (run.loop - 1)) * (opts.power || 1);
  const maxhp = Math.max(1, Math.round(def.base.hp * mult * run.mods.enemyHpMult));
  return {
    id: def.id, name: def.name, img: def.img, role: def.role,
    maxhp, hp: maxhp,
    atk: Math.round(def.base.atk * mult),
    def: def.base.def,
    evasion: def.role === 'fast' ? 0.05 : 0,  // ศัตรูสาย fast หลบได้นิดหน่อย
    defDebuff: 0,                              // armor-break stack (run-only)
  };
}

// ════════════════════════════════════════════════════════════════════════════
// NATURAL MONSTER SYSTEM — สปอว์นอัตโนมัติ, run-only, ไม่ผ่าน spawnForLoop
// ════════════════════════════════════════════════════════════════════════════

// นับ natural monster ทั้งหมดที่ active อยู่บนแผนที่
function naturalMonsterCount(run) {
  return Object.values(run.monsterTiles || {}).reduce((s, stk) => s + stk.length, 0);
}

// เพดาน natural monster: 3 + floor(loop/2), สูงสุด 8
function naturalCap(run) {
  return Math.min(BAL.NATURAL_CAP_BASE + Math.floor(run.loop / 2), BAL.NATURAL_CAP_MAX);
}

// สร้าง natural enemy instance (ใช้ NATURAL_MONSTERS pool)
function makeNaturalEnemy(run) {
  return makeEnemy(pick(NATURAL_MONSTERS), run);
}

// เสก natural monster เริ่มต้น: count ตัว บนถนนสุ่ม (ไม่ทับ camp, ไม่เกิน 1 ตัว/ช่อง)
function spawnNaturalMonsters(run, count) {
  const roads = roadCellIds().filter(id => id !== 'camp');
  const shuffled = [...roads].sort(() => Math.random() - 0.5);
  let spawned = 0;
  for (const id of shuffled) {
    if (spawned >= count) break;
    if (naturalMonsterCount(run) >= naturalCap(run)) break;
    const stk = run.monsterTiles[id] || [];
    if (stk.length === 0) { // initial spawn: max 1 per tile (loop 1–2 safe)
      run.monsterTiles[id] = [makeNaturalEnemy(run)];
      spawned++;
    }
  }
}

// รอบ 12 วินาที: ลองสปอว์น natural monster + Elite/Mythic events
function cycleSpawnAttempt(run) {
  // natural monster spawn (ตัวหลัก)
  if (naturalMonsterCount(run) < naturalCap(run) && Math.random() <= BAL.NATURAL_CYCLE_CHANCE) {
    const valid = roadCellIds().filter(id => {
      if (id === 'camp') return false;
      const stk = run.monsterTiles[id] || [];
      return stk.length < BAL.MONSTER_STACK_MAX;
    });
    if (valid.length) {
      const id = pick(valid);
      if (!run.monsterTiles[id]) run.monsterTiles[id] = [];
      run.monsterTiles[id].push(makeNaturalEnemy(run));
      renderBoard();
    }
  }
  // Elite/Mythic events (rare, unlock-gated)
  trySpawnEliteEvent(run);
  trySpawnMythicEvent(run);
}

// ════════════════════════════════════════════════════════════════════════════
// CYCLE TIMER — นับแยกจาก loop; รันเฉพาะระหว่าง phase='walking' + speed>0
// ════════════════════════════════════════════════════════════════════════════

function startCycleTimer() {
  stopCycleTimer();
  const run = BLH.run;
  if (!run || run.speed === 0 || run.ended) return;
  const ms = Math.round(BAL.CYCLE_MS / run.speed);
  BLH._cycleTimer = setTimeout(onCycleTick, ms);
}

function stopCycleTimer() {
  if (BLH._cycleTimer != null) { clearTimeout(BLH._cycleTimer); }
  BLH._cycleTimer = null;
}

function onCycleTick() {
  BLH._cycleTimer = null;
  const run = BLH.run;
  if (!run || run.ended || run.phase !== 'walking') return;
  cycleSpawnAttempt(run);
  startCycleTimer(); // ตั้งรอบถัดไป
}

// ════════════════════════════════════════════════════════════════════════════
// BOSS TERRAIN — terrain power จากการ์ดที่วาง → spawn boss terrain ใกล้ Camp
// ════════════════════════════════════════════════════════════════════════════

// ตรวจว่าถึง threshold → spawn boss terrain ถ้ายังไม่มี active
function checkBossTerrainSpawn(run) {
  if (run.bossTerrainCell) return; // มี active อยู่แล้ว
  if (run.terrainPower < run.nextBossTerrainThreshold) return;
  const cell = findBossTerrainCell(run);
  if (!cell) return;
  run.bossTerrainCell = cell.id;
  renderBoard();
  blhToast(`👹 Boss Terrain โผล่ใกล้ Camp! เหยียบถนนติดกันเพื่อสู้`);
}

// หาช่องเทอเรนว่างที่ใกล้ Camp และมีถนนติดกัน (เพื่อให้ terrain_boss trigger ได้จริง)
function findBossTerrainCell(run) {
  const campDef = BLH_CELL_BY_ID['camp'];
  const empties = BLH_MAP.cells.filter(c =>
    c.type === 'terrain' && !run.cells[c.id].placedCardId && c.id !== run.bossTerrainCell
  );
  if (!empties.length) return null;
  // sort by Manhattan distance to camp (ใกล้ camp = ท้าทาย แต่ผู้เล่นเข้าถึงได้)
  empties.sort((a, b) => {
    const dA = Math.abs(a.row - campDef.row) + Math.abs(a.col - campDef.col);
    const dB = Math.abs(b.row - campDef.row) + Math.abs(b.col - campDef.col);
    return dA - dB;
  });
  // ต้องมีถนนติดกัน — ไม่งั้น terrain_boss ไม่สามารถถูก trigger ได้เลย
  const withRoad = empties.find(c => getNeighborCells(c.id).some(n => n.type === 'road'));
  return withRoad || empties[0];
}

// สร้าง enemy list สำหรับ terrain boss fight (boss + 2 minion — structure เหมือน boss signal)
function makeTerrainBossEnemies(run) {
  const boss = run.boss;
  const mult = 1 + 0.10 * (run.loop - 1);
  const mk = (def, role, slot) => {
    const hp = Math.max(1, Math.round(def.base.hp * mult * run.mods.enemyHpMult));
    return { id: def.id, name: def.name, img: def.img, role, slot, maxhp: hp, hp,
      atk: Math.round(def.base.atk * mult), def: def.base.def, evasion: 0, defDebuff: 0 };
  };
  return [
    mk(MINIONS[boss.minions[0]], 'minion', 0),
    mk(MINIONS[boss.minions[1]], 'minion', 1),
    mk(boss, 'boss', 2),
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// ELITE/MYTHIC ROAD EVENTS — spawn บน road tile (run-only, max 1 active each)
// ════════════════════════════════════════════════════════════════════════════

// เงื่อนไขปลดล็อก (OR สำหรับ Elite; AND สำหรับ Mythic ตามสเปก)
function eliteEventUnlocked(run) {
  return run.loop >= BAL.ELITE_EVENT_UNLOCK_LOOP || run.terrainPower >= BAL.ELITE_EVENT_UNLOCK_POWER;
}
function mythicEventUnlocked(run) {
  return run.loop >= BAL.MYTHIC_EVENT_UNLOCK_LOOP && run.terrainPower >= BAL.MYTHIC_EVENT_UNLOCK_POWER;
}

// ลองสปอว์น Elite Event (เรียกจาก cycleSpawnAttempt)
function trySpawnEliteEvent(run) {
  if (run.eliteEventTile) return;                     // max 1 active
  if (!eliteEventUnlocked(run)) return;
  const chance = clamp(
    BAL.ELITE_EVENT_BASE_CHANCE + Math.floor(run.terrainPower / 5) * BAL.ELITE_EVENT_POWER_BONUS,
    0, BAL.ELITE_EVENT_CHANCE_CAP
  );
  if (Math.random() > chance) return;
  const valid = roadCellIds().filter(id => {
    if (id === 'camp') return false;
    const stk = run.monsterTiles[id] || [];
    return stk.length < BAL.MONSTER_STACK_MAX;
  });
  if (!valid.length) return;
  run.eliteEventTile = pick(valid);
  renderBoard();
  blhToast(`⭐ Elite Event โผล่บนถนน! — สู้เพื่อรางวัลพิเศษ`);
}

// ลองสปอว์น Mythic Event (เรียกจาก cycleSpawnAttempt)
function trySpawnMythicEvent(run) {
  if (run.mythicEventTile) return;                    // max 1 active
  if (!mythicEventUnlocked(run)) return;
  const chance = clamp(
    BAL.MYTHIC_EVENT_BASE_CHANCE + Math.floor(run.terrainPower / 10) * BAL.MYTHIC_EVENT_POWER_BONUS,
    0, BAL.MYTHIC_EVENT_CHANCE_CAP
  );
  if (Math.random() > chance) return;
  const valid = roadCellIds().filter(id => {
    if (id === 'camp') return false;
    if (id === run.eliteEventTile) return false;       // ไม่ทับ Elite Event
    const stk = run.monsterTiles[id] || [];
    return stk.length < BAL.MONSTER_STACK_MAX;
  });
  if (!valid.length) return;
  run.mythicEventTile = pick(valid);
  renderBoard();
  blhToast(`💎 Mythic Event โผล่บนถนน! — Mini-Boss อันตราย!`);
}

// สร้าง enemy สำหรับ Elite Event (ใช้ makeEnemy ปกติเพื่อ scale ตาม loop)
function makeEliteEventEnemy(run) {
  return makeEnemy(pick(ELITE_EVENT_ENEMIES), run);
}

// สร้าง enemy สำหรับ Mythic Event (power boost เพิ่มเพื่อให้หนักกว่า Elite Event ชัดเจน)
function makeMythicEventEnemy(run) {
  return makeEnemy(pick(MYTHIC_EVENT_ENEMIES), run, { power: 1.15 });
}

// ── recompute hero stats (terrain card → run.mods global; adjacent/road → cell-based) ──
function applyMods(run) {
  // terrain card (rock/thornfield/treasure) บวกเข้า run.mods ตอนวางแล้ว — ที่นี่แค่ recompute
  recomputeStats(run);
}

// รวม main/sub stat ของเกียร์ที่สวมอยู่ → { base:{str..luk}, combat:{ATK,HP,DEF,CRI,...} }
function aggregateGear(run) {
  const base = {}, combat = {};
  const addRoll = r => {
    if (!r) return;
    const lk = r.k.toLowerCase();
    if (BASE_STAT_KEYS.includes(lk)) base[lk] = (base[lk] || 0) + r.v;
    else combat[r.k] = (combat[r.k] || 0) + r.v;
  };
  for (const slot of GEAR_SLOT_IDS) {
    const g = run.gear[slot];
    if (!g) continue;
    addRoll(g.mainStat);
    addRoll(g.subStat);
  }
  return { base, combat };
}

// รวม trait ของเกียร์ที่สวมอยู่ → run.traitMods (stack ข้ามชิ้น, clamp ที่ cap ต่อ trait)
function aggregateTraits(run) {
  const t = {};
  for (const k of GEAR_TRAIT_KEYS) t[k] = 0;
  for (const slot of GEAR_SLOT_IDS) {
    const g = run.gear[slot];
    if (!g || !g.traits) continue;
    for (const id of g.traits) {
      const def = GEAR_TRAIT_BY_ID[id];
      if (!def) continue;
      t[def.key] = Math.min(def.cap, (t[def.key] || 0) + def.per);
    }
  }
  return t;
}

// derive combat stat: base stat ฮีโร่ + perk + gear + terrain mod + Arena Training
function recomputeStats(run) {
  const gear = aggregateGear(run);
  run.traitMods = aggregateTraits(run);          // trait stacks (capped) — ใช้ในคอมแบต/เศรษฐกิจ
  const m = run.perkMods;
  const tr = run.traitMods;
  const gb = gear.base, gc = gear.combat;
  // 1) base stat (str..luk) — auto-growth allocations applied immediately on level-up
  const rs = run.runStats || {};
  const b = {};
  for (const k of BASE_STAT_KEYS) b[k] = (run.base[k] || 0) + (m[k] || 0) + (gb[k] || 0) + (rs[k] || 0);
  run.statBase = b;
  // Quick Step (trait): หลังชนะไฟต์ ASPD เพิ่มจนจบลูป (แปลงสัดส่วน → flat aspd)
  const qsAspd = run._quickStepActive ? (tr.quickStep || 0) * 100 : 0;
  // 2) combat adds (Arena Training + gear main/sub + perk + terrain) — cap aspd add ที่ +60
  const adds = {
    atk:  Math.round(upgValue('startAtk')) + (gc.ATK || 0) + m.atk + run.mods.atk,
    hp:   Math.round(upgValue('startHp'))  + (gc.HP  || 0) + m.hp  + run.mods.maxhp,
    def:  Math.round(upgValue('startDef')) + (gc.DEF || 0) + m.def + run.mods.def,
    aspd: clamp((gc.ASPD || 0) + m.aspd + qsAspd, 0, STAT_CAPS.attackSpeedAdd),
    hitBonus:   (gc.HIT    || 0) / 100,
    critRate:   (gc.CRI    || 0) / 100 + m.critRate,
    critDamage: (gc.CRIDMG || 0) / 100 + m.critDamage,
    evasion:    (gc.EVA    || 0) / 100 + m.evasion,
    lifesteal:  (gc.LS     || 0) / 100 + m.lifesteal,
    armorPen:   (gc.PEN    || 0)       + m.armorPen,
    damageReduction: (gc.DR || 0) / 100 + m.damageReduction,
    dropBonus:  (gc.DROP   || 0) / 100,
  };
  const c = deriveCombat(b, adds);
  // 3) เก็บลง run.stats (รักษา current hp + เพิ่มตามเพดานใหม่)
  const prevMax = run.stats.maxhp || c.maxhp;
  const curHp = run.stats.hp;
  Object.assign(run.stats, c);          // set maxhp/atk/def/aspd/crit../pen.. (ไม่มี hp ใน c)
  if (curHp == null) run.stats.hp = c.maxhp;
  else if (c.maxhp > prevMax) run.stats.hp = Math.min(c.maxhp, curHp + (c.maxhp - prevMax));
  else run.stats.hp = curHp;
  run.stats.hp = clamp(run.stats.hp, 0, c.maxhp);
}

// ════════════════════════════════════════════════════════════════════════════
// EXP / LEVEL / AUTO GROWTH PLAN — run-only (รีเซ็ตเมื่อรันจบ)
// ════════════════════════════════════════════════════════════════════════════
// Level-up → autoAllocatePoints() จัดสรร +2 แต้มตาม growthPlan ทันที
// ไม่มี draft/confirm/pending — stats ออกฤทธิ์ใน combat ทันที

// resolve pattern array สำหรับ plan ปัจจุบัน ('default' → hero-specific)
function getPlanOrder(run) {
  if (run.growthPlan === 'default') {
    return HERO_DEFAULT_ORDERS[(run.hero && run.hero.id)] || ['str', 'vit', 'agi'];
  }
  const preset = EXP_PRESETS.find(p => p.id === run.growthPlan);
  return (preset && preset.order) || ['str', 'vit', 'agi'];
}

// cycle ผ่าน plan order ต่อจาก cursor และจัดสรร points เข้า runStats; คืน summary ของที่จัดสรรไป
function autoAllocatePoints(run, points) {
  const order = getPlanOrder(run);
  const rs = run.runStats;
  const gained = {};
  const cursor = run.planCursor || 0;
  for (let i = 0; i < points; i++) {
    const k = order[(cursor + i) % order.length];
    rs[k] = (rs[k] || 0) + 1;
    gained[k] = (gained[k] || 0) + 1;
  }
  run.planCursor = (cursor + points) % order.length;
  return gained;
}

// ให้ EXP + auto-allocate stat points บน level-up (ไม่มี pause, ไม่มี pending)
function grantExp(amount) {
  const run = BLH.run; if (!run || run.ended || amount <= 0) return;
  run.exp += amount;
  let totalGained = 0;
  while (run.exp >= run.expToNext) {
    run.exp -= run.expToNext;
    run.level += 1;
    totalGained += 2;
    run.expToNext = expToNext(run.level);
  }
  if (totalGained > 0) {
    const gained = autoAllocatePoints(run, totalGained);
    recomputeStats(run);
    const preset = EXP_PRESETS.find(p => p.id === run.growthPlan) || EXP_PRESETS[0];
    const statLine = Object.entries(gained).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ');
    blhToast(`⬆️ Lv.${run.level} ${preset.icon}${preset.name}: ${statLine}`);
    updateHUD();
    if (_selection && (_selection.type === 'hero' || _selection.type === 'plan')) renderPanel();
  }
}

// เปลี่ยน Growth Plan (block ระหว่างสู้; cursor รีเซ็ต; เปลี่ยนแค่ level-up ในอนาคต)
function setGrowthPlan(planId) {
  const run = BLH.run; if (!run) return;
  if (run.phase === 'battle') { blhToast('🔒 เปลี่ยนแผนไม่ได้ระหว่างสู้'); return; }
  const preset = EXP_PRESETS.find(p => p.id === planId);
  if (!preset) return;
  run.growthPlan = planId;
  run.planCursor = 0;
  blhToast(`📈 เปลี่ยนแผน: ${preset.icon} ${preset.name}`);
  updateHUD();
  renderPanel();
}

// ════════════════════════════════════════════════════════════════════════════
// RUN SCREEN (board + HUD + overlays)
// ════════════════════════════════════════════════════════════════════════════
function renderRunScreen() {
  setScreen('run', `
    <div class="blh-run-hud" id="blh-hud"></div>
    <div class="blh-board-wrap"><div class="blh-board" id="blh-board"></div></div>
    <div class="blh-panel" id="blh-panel"></div>
    <div class="blh-overlay blh-battle-overlay" id="blh-battle" style="display:none"></div>
    <div class="blh-overlay blh-perk-overlay" id="blh-perk" style="display:none"></div>
    <div class="blh-toast" id="blh-toast"></div>
  `);
  renderBoard();
  renderPanel();
}

// ── PERK CHOICE overlay (ที่ Camp; เกมหยุดจนเลือกเสร็จ) ──────────────────────
function renderPerkChoice() {
  const run = BLH.run; if (!run) return;
  const el = q('blh-perk'); if (!el) return;
  const pool = HERO_PERKS[run.hero.id] || [];
  const offer = run.perkOffer || [];
  const cards = offer.map(id => {
    const p = pool.find(x => x.id === id); if (!p) return '';
    const tags = (p.tags || []).map(t => `<span class="blh-perk-tag">${esc(t)}</span>`).join('');
    return `<button class="blh-perk-card" onclick="blh.choosePerk('${p.id}')">
        <div class="blh-perk-name">${esc(p.name)}</div>
        <div class="blh-perk-desc">${esc(p.desc)}</div>
        <div class="blh-perk-tags">${tags}</div>
      </button>`;
  }).join('');
  el.innerHTML = `
    <div class="blh-perk-box">
      <div class="blh-perk-head">✨ เลือกเพิร์ก <span class="blh-perk-style">${esc(run.hero.role)}</span></div>
      <div class="blh-perk-sub">เลือก 1 — มีผลเฉพาะรอบรันนี้ ${run.perkPending > 1 ? `(เหลือ ${run.perkPending} สิทธิ์)` : ''}</div>
      <div class="blh-perk-list">${cards}</div>
    </div>`;
  el.style.display = 'flex';
}

function setPhase(p) {
  if (BLH.run) BLH.run.phase = p;
  renderPanel();
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
      <div class="blh-hud-hero blh-hud-hero-tap" onclick="blh.selectItem({type:'hero'})">${esc(run.hero.name)}</div>
      <div class="blh-hud-sig">${sig}</div>
    </div>
    <div class="blh-hpbar"><div class="blh-hpfill" style="width:${pct}%"></div>
      <span class="blh-hptext">❤️ ${Math.max(0, Math.round(run.stats.hp))}/${run.stats.maxhp}</span></div>
    <div class="blh-hud-stats">
      <span>⚔️ ${run.stats.atk}</span><span>🛡️ ${run.stats.def}</span>
      <span>⬆️ Lv.<b>${run.level}</b><span class="blh-plan-hud"> ${(EXP_PRESETS.find(p => p.id === run.growthPlan) || EXP_PRESETS[0]).icon}</span></span>
      <span>🃏 ${run.hand.length}/${MAX_CARD_TYPES}</span><span>🎒 ${run.lootBag.length}/${bagCap()}</span>
    </div>`;
}

// ── speed control (Pause / 1x / 2x) ──
function speedLabel() {
  const s = BLH.run ? BLH.run.speed : 1;
  return s === 0 ? '⏸ Pause' : s === 1 ? '▶ 1x' : '⏩ 2x';
}
function speedBtnHtml(extraClass = '') {
  const s = BLH.run ? BLH.run.speed : 1;
  const cls = s === 0 ? 'paused' : '';
  return `<button class="blh-speed-btn ${cls} ${extraClass}" onclick="blh.cycleSpeed()">${speedLabel()}</button>`;
}
// วน 1x → 2x → Pause → 1x (ใช้กับปุ่มเดี่ยวในแบตเทิล)
function cycleSpeed() {
  const run = BLH.run; if (!run) return;
  const next = run.speed === 1 ? 2 : run.speed === 2 ? 0 : 1;
  setSpeed(next);
}
// Pause = หยุด/วางแผน • 1x = ต่อ/เดินต่อ • 2x = เร็ว
// ที่ Camp: กด 1x/2x = Continue Loop (ออกเดินด้วยความเร็วนั้น)
function setSpeed(s) {
  const run = BLH.run; if (!run) return;
  if (run.phase === 'camp' && s > 0) { run.speed = s; continueLoop(); return; }
  run.speed = s;
  applySpeedChange();
  renderPanel();
  setBattleFooter();
}
// ปรับ timer ให้ตรงกับความเร็วปัจจุบัน (resume/freeze ทั้ง walking และ battle)
function applySpeedChange() {
  const run = BLH.run; if (!run) return;
  const battle = BLH._battle;
  if (run.speed === 0) {
    // Pause: หยุดทั้ง walking + battle + cycle
    if (BLH._walkTimer) { clearTimeout(BLH._walkTimer); BLH._walkTimer = null; BLH._walkPendingMs = BLH._walkPendingMs ?? BAL.WALK_MS; }
    if (battle && battle.timer) { clearTimeout(battle.timer); battle.timer = null; battle._pending = !battle.done; }
    stopCycleTimer();
  } else {
    // resume เฉพาะลูปที่กำลัง active
    if (battle && !battle.done && battle._pending) { battle._pending = false; scheduleBattleTick(60); }
    else if (run.phase === 'walking' && BLH._walkPendingMs != null) { const ms = BLH._walkPendingMs; BLH._walkPendingMs = null; scheduleStep(ms); }
    // restart cycle timer ถ้ากำลังเดินอยู่ (ไม่ใช่ระหว่างแบตเทิล)
    if (run.phase === 'walking' && !(battle && !battle.done)) startCycleTimer();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// COMPACT DOCK PANEL — replaces tab-based Stats/Gear/Loot/Map UI
// Always-visible rows: Equipped (A) · Cards (B) · Bag (C) + contextual detail
// ════════════════════════════════════════════════════════════════════════════
let _selection = null; // { type:'hero'|'plan'|'gear'|'loot'|'card'|'tile', slot?,idx?,cardId?,cellId? }

function selectItem(sel)   { _selection = sel; renderPanel(); }
function clearSelection()  { _selection = null; renderPanel(); }
function selectGear(slot)  {
  if (_selection && _selection.type === 'gear' && _selection.slot === slot) { clearSelection(); return; }
  _selection = { type: 'gear', slot }; renderPanel();
}
function selectLoot(idx)   {
  if (_selection && _selection.type === 'loot' && _selection.idx === idx) { clearSelection(); return; }
  _selection = { type: 'loot', idx }; renderPanel();
}
function selectCard(cardId) {
  const run = BLH.run; if (!run) return;
  if (run.phase === 'battle') { _selection = { type: 'card', cardId }; renderPanel(); return; }
  startPlace(cardId);
}
function selectTile(cellId) {
  if (_selection && _selection.type === 'tile' && _selection.cellId === cellId) { clearSelection(); return; }
  _selection = { type: 'tile', cellId }; renderPanel();
}
function panelTab(tab) {
  _selection = (tab === 'stats') ? { type: 'hero' } : null;
  renderPanel();
}
// segmented Pause / 1x / 2x — Pause=วางแผน, 1x=ต่อ, 2x=เร็ว (ถาวรเหนือแท็บ)
function speedSegHtml() {
  const s = BLH.run ? BLH.run.speed : 1;
  return [[0, '⏸ Pause'], [1, '▶ 1x'], [2, '⏩ 2x']].map(([v, l]) =>
    `<button class="blh-seg ${s === v ? 'on' : ''} ${v === 0 ? 'pause' : ''}" onclick="blh.setSpeed(${v})">${l}</button>`).join('');
}
// ── dock control row (speed segs + status/camp + abandon button) ──
function dockCtrlRow(run) {
  const aband = `<button class="blh-aband" onclick="blh.abandonRun()" title="ยอมแพ้ / ออกจากรัน">✕</button>`;
  let status;
  if (run.phase === 'camp') {
    const canSignal = run.bossSignalObtained && !run.bossSignalPlaced;
    status = `<div class="blh-dock-status camp">
      <button class="blh-status-btn cash" onclick="blh.cashOut()">💰 CASH OUT</button>
      ${canSignal ? `<button class="blh-status-btn sig" onclick="blh.placeSignal()">📡 SIGNAL</button>` : ''}
    </div>`;
  } else {
    const sig = run.bossSignalPlaced ? '📡 บอสพร้อม' : run.bossSignalObtained ? '📡 มี Signal' : `📡 loop ${BAL.BOSS_SIGNAL_MIN_LOOP}+`;
    const state = run.speed === 0 ? '⏸ วางแผน' : '🚶 เดิน';
    status = `<div class="blh-dock-status"><span class="blh-status-text">${state} • ${sig}</span></div>`;
  }
  return `<div class="blh-dock-ctrl"><div class="blh-dock-speed">${speedSegHtml()}</div>${status}${aband}</div>`;
}
function renderPanel() {
  const run = BLH.run; if (!run) return;
  const el = q('blh-panel'); if (!el) return;
  const locked = run.phase === 'battle';
  el.innerHTML = `
    ${dockCtrlRow(run)}
    ${dockAutoStatRow(run)}
    ${dockEquipRow(run)}
    ${dockCardRow(run, locked)}
    ${dockBagRow(run, locked)}
    <div class="blh-dock-detail" id="blh-dock-detail">${dockDetail(run, locked)}</div>`;
}

// ── Auto Stat row (always visible, 24-28px tall, outside detail panel) ──
function dockAutoStatRow(run) {
  const preset = EXP_PRESETS.find(p => p.id === run.growthPlan) || EXP_PRESETS[0];
  const battle = run.phase === 'battle';
  const isSel = _selection && _selection.type === 'plan';
  return `<div class="blh-autostat-row">
    <span class="blh-autostat-label">Auto Stat:</span>
    <button class="blh-autostat-chip${isSel ? ' sel' : ''}${battle ? ' locked' : ''}"
      onclick="blh.selectItem({type:'plan'})">
      ${preset.icon} ${esc(preset.name)}${battle ? ' 🔒' : ''}
    </button>
  </div>`;
}

// ── Row A: 5 equipped gear chips (always visible, tap → detail) ──
function dockEquipRow(run) {
  const slots = GEAR_SLOTS.map(sl => {
    const g = run.gear[sl.id];
    const isSel = _selection && _selection.type === 'gear' && _selection.slot === sl.id;
    const label = g ? gearLabel(g) : `<span class="dim">ว่าง</span>`;
    return `<button class="blh-equip-chip${isSel ? ' sel' : ''}${g ? '' : ' empty'}"
      onclick="blh.selectGear('${sl.id}')">
      <span class="blh-equip-chip-icon">${sl.icon}</span>
      <span class="blh-equip-chip-label">${label}</span>
    </button>`;
  }).join('');
  return `<div class="blh-dock-equip">${slots}</div>`;
}

// ── Row B: card hand as ultra-compact chips (tap → select + placement mode) ──
function dockCardRow(run, locked) {
  const cap = run.hand.length >= MAX_CARD_TYPES;
  const oldest = cap ? oldestHandCardId(run) : null;
  const warn = cap ? ' warn' : '';
  const label = `<span class="blh-dock-row-label${warn}">🃏 ${run.hand.length}/${MAX_CARD_TYPES}</span>`;
  if (!run.hand.length)
    return `<div class="blh-dock-cards">${label}<span class="dim blh-dock-empty-note">ไม่มีการ์ด</span></div>`;
  const chips = run.hand.map(st => {
    const c = MAP_CARD_BY_ID[st.cardId];
    const isSel = _selection && _selection.type === 'card' && _selection.cardId === st.cardId;
    const isOld = st.cardId === oldest;
    return `<button class="blh-card-chip${isSel ? ' sel' : ''}${isOld ? ' oldest' : ''}"
      style="--accent:${c.accent}" onclick="blh.selectCard('${st.cardId}')"
      title="${esc(c.name)} × ${st.count}">${c.icon}<span class="blh-card-chip-badge">×${st.count}</span></button>`;
  }).join('');
  const overflow = cap && oldest
    ? `<span class="blh-dock-overflow">⚠ แปลงต่อไป: ${esc((MAP_CARD_BY_ID[oldest] || {}).name || oldest)}</span>` : '';
  return `<div class="blh-dock-cards">${label}<div class="blh-card-chips">${chips}</div>${overflow}</div>`;
}

// ── Row C: gear bag preview — newest 3–4 chips + overflow warning ──
function dockBagRow(run, locked) {
  const cap = bagCap();
  const full = run.lootBag.length >= cap;
  const warn = full ? ' warn' : '';
  const label = `<span class="blh-dock-row-label${warn}">🎒 ${run.lootBag.length}/${cap}</span>`;
  if (!run.lootBag.length)
    return `<div class="blh-dock-bag">${label}<span class="dim blh-dock-empty-note">กระเป๋าว่าง</span></div>`;
  const preview = run.lootBag.slice(-4).reverse(); // newest first
  const chips = preview.map((g, i) => {
    const actualIdx = run.lootBag.length - 1 - i;
    const sl = GEAR_SLOTS.find(s => s.id === g.slot) || GEAR_SLOTS[0];
    const rar = rarityOf(g);
    const isSel = _selection && _selection.type === 'loot' && _selection.idx === actualIdx;
    return `<button class="blh-bag-chip${isSel ? ' sel' : ''}" style="--rar-color:${rar.color}"
      onclick="blh.selectLoot(${actualIdx})" title="${sl.name} T${g.tier} ${rar.name}">
      ${sl.icon}<span class="blh-bag-chip-tier">T${g.tier}</span>
    </button>`;
  }).join('');
  let overflow = '';
  if (full) {
    const og = run.lootBag[0]; const osl = GEAR_SLOTS.find(s => s.id === og.slot) || GEAR_SLOTS[0];
    const hiVal = ['epic', 'legendary'].includes(og.rarity);
    overflow = `<span class="blh-dock-overflow${hiVal ? ' warn-strong' : ''}">⚠ salvage: ${osl.icon}T${og.tier}</span>`;
  }
  const more = run.lootBag.length > 4
    ? `<span class="blh-dock-row-label">+${run.lootBag.length - 4}</span>` : '';
  return `<div class="blh-dock-bag">${label}<div class="blh-bag-chips">${chips}</div>${overflow}${more}</div>`;
}

// ── Contextual detail panel dispatcher ──────────────────────────────────────
function dockDetail(run, locked) {
  if (!_selection) return dockDetailDefault(run, locked);
  switch (_selection.type) {
    case 'hero': return dockDetailHero(run, locked);
    case 'plan': return dockDetailGrowthPlan(run, locked);
    case 'gear': return dockDetailGear(run, locked, _selection.slot);
    case 'loot': return dockDetailLoot(run, locked, _selection.idx);
    case 'card': return dockDetailCard(run, locked, _selection.cardId);
    case 'tile': return dockDetailTile(run, _selection.cellId);
  }
  return dockDetailDefault(run, locked);
}

// Default: hero mini-card + key stats + EXP bar
function dockDetailDefault(run, locked) {
  const s = run.stats;
  const expPct = run.expToNext > 0 ? clamp(run.exp / run.expToNext * 100, 0, 100) : 100;
  const curPlan = EXP_PRESETS.find(p => p.id === run.growthPlan) || EXP_PRESETS[0];
  const campLine = run.phase === 'camp'
    ? `<div class="blh-dock-cashout-hint">💰 ~🔷${fmt(estCashOut(run))} เมื่อ Cash Out</div>` : '';
  return `<div class="blh-dock-hint">
    <div class="blh-dock-hint-row">
      <button class="blh-hero-tap-btn" onclick="blh.selectItem({type:'hero'})">
        <img src="${run.hero.img}" onerror="this.style.opacity=0">
        <span class="blh-hero-tap-name">${esc(run.hero.name)}</span>
      </button>
      <div class="blh-dock-hint-stats">
        <span>⚔️ ${s.atk}</span><span>🛡️ ${s.def}</span>
        <span>❤️ ${Math.round(s.hp)}/${s.maxhp}</span>
        <span>⚡ ${s.aspd}</span><span>🎯 ${Math.round(s.critRate * 100)}%</span>
      </div>
    </div>
    <div class="blh-level-row" style="margin-top:4px">
      <span class="blh-lvl-tag">Lv.<b>${run.level}</b> ${curPlan.icon}</span>
      <div class="blh-expbar"><div class="blh-expfill" style="width:${expPct.toFixed(1)}%"></div>
        <span class="blh-exptext">${run.exp}/${run.expToNext} EXP</span></div>
    </div>
    ${campLine}
    ${run._placing ? `<div class="blh-detail-placing">🗺️ เลือกช่องที่ไฮไลต์ <button class="blh-mini-btn ghost" onclick="blh.cancelPlace()">✖ ยกเลิก</button></div>` : ''}
  </div>`;
}

// Hero detail: base/combat stats + perks + level/EXP (growth plan → tap Auto Stat chip)
function dockDetailHero(run, locked) {
  const s = run.stats, b = run.statBase || run.base;
  const c = { atk: s.atk, def: s.def, maxhp: s.maxhp, aspd: s.aspd,
    critRate: s.critRate, critDamage: s.critDamage, evasion: s.evasion, lifesteal: s.lifesteal, armorPen: s.armorPen };
  const pool = HERO_PERKS[run.hero.id] || [];
  const perkLine = run.perks.length
    ? `<div class="blh-perk-active">${run.perks.map(id => {
        const p = pool.find(x => x.id === id); return p ? `<span class="blh-perk-chip">✨ ${esc(p.name)}</span>` : '';
      }).join('')}</div>` : '';
  const expPct = run.expToNext > 0 ? clamp(run.exp / run.expToNext * 100, 0, 100) : 100;
  const curPlan = EXP_PRESETS.find(p => p.id === run.growthPlan) || EXP_PRESETS[0];
  return `<div class="blh-dock-detail-hero">
    <div class="blh-detail-close-row">
      <span class="blh-statbox-name">${esc(run.hero.name)} <span class="blh-statbox-role">${esc(run.hero.role)}</span></span>
      <button class="blh-mini-btn ghost" onclick="blh.clearSelection()">✕</button>
    </div>
    <div class="blh-ss-base">${baseStatChips(b)}</div>
    <div class="blh-ss-row">${combatStatChips(c)}</div>
    ${perkLine}
    <div class="blh-level-row">
      <span class="blh-lvl-tag">Lv.<b>${run.level}</b> ${curPlan.icon}</span>
      <div class="blh-expbar"><div class="blh-expfill" style="width:${expPct.toFixed(1)}%"></div>
        <span class="blh-exptext">${run.exp}/${run.expToNext} EXP</span></div>
    </div>
  </div>`;
}

// Growth Plan detail (opens when Auto Stat chip is tapped)
function dockDetailGrowthPlan(run, locked) {
  const battle = run.phase === 'battle';
  const rs = run.runStats || {};
  const statSummary = BASE_STAT_KEYS.filter(k => (rs[k] || 0) > 0)
    .map(k => `<span class="blh-rs-chip">${k.toUpperCase()}+${rs[k]}</span>`).join('');
  const order = getPlanOrder(run);
  const patternStr = order.map(k => k.toUpperCase()).join(' › ');
  const close = `<button class="blh-mini-btn ghost" onclick="blh.clearSelection()">✕</button>`;
  return `<div class="blh-dock-detail-plan">
    <div class="blh-detail-close-row">
      <span>📈 Growth Plan${battle ? ' <span class="blh-alloc-lock">🔒</span>' : ''}</span>
      ${close}
    </div>
    <div class="blh-preset-row">${EXP_PRESETS.map(p =>
      `<button class="blh-preset-btn${p.id === run.growthPlan ? ' on' : ''}" ${battle ? 'disabled' : ''}
        onclick="blh.setGrowthPlan('${p.id}')">${p.icon} ${esc(p.name)}</button>`).join('')}
    </div>
    <div class="blh-growth-note">Auto-applies on level up</div>
    <div class="blh-growth-pattern">Pattern: ${esc(patternStr)}</div>
    ${statSummary ? `<div class="blh-growth-stats">${statSummary}</div>` : ''}
  </div>`;
}

// Equipped gear slot detail (tap equip chip)
function dockDetailGear(run, locked, slot) {
  const sl = GEAR_SLOTS.find(s => s.id === slot);
  if (!sl) return dockDetailDefault(run, locked);
  const g = run.gear[slot];
  const close = `<button class="blh-mini-btn ghost" onclick="blh.clearSelection()">✕</button>`;
  if (!g) return `<div class="blh-dock-detail-gear">
    <div class="blh-detail-close-row"><span>${sl.icon} ${sl.name} — <span class="dim">ว่าง</span></span>${close}</div>
  </div>`;
  const btn = locked ? '<span class="blh-mini-lock">🔒</span>'
    : `<button class="blh-mini-btn" onclick="blh.unequip('${slot}')">ถอด</button>`;
  return `<div class="blh-dock-detail-gear">
    <div class="blh-detail-close-row"><span>${sl.icon} ${sl.name}</span>${close}</div>
    <div style="margin-top:4px">${gearFull(g)}</div>
    <div style="margin-top:6px">${btn}</div>
  </div>`;
}

// Loot bag item: compare vs equipped same-slot item
function dockDetailLoot(run, locked, idx) {
  const g = run.lootBag[idx];
  if (!g) return dockDetailDefault(run, locked);
  const sl = GEAR_SLOTS.find(s => s.id === g.slot) || GEAR_SLOTS[0];
  const equipped = run.gear[g.slot];
  const close = `<button class="blh-mini-btn ghost" onclick="blh.clearSelection()">✕</button>`;
  function rollVal(gear, key) {
    if (!gear) return 0;
    let v = 0;
    [gear.mainStat, gear.subStat].filter(Boolean).forEach(r => { if (r.k === key) v += r.v; });
    return v;
  }
  const KEYS = ['ATK', 'DEF', 'HP', 'ASPD', 'CRI', 'CRIDMG', 'EVA', 'PEN', 'LS', 'HIT', 'DR', 'DROP'];
  const deltaRows = KEYS.map(k => {
    const nv = rollVal(g, k), ev = rollVal(equipped, k);
    if (nv === 0 && ev === 0) return '';
    const d = nv - ev;
    const isPct = !!(STAT_ROLLS[k] || {}).pct;
    const lbl = (STAT_ROLLS[k] || {}).label || k;
    const dStr = d === 0 ? '—' : `${d > 0 ? '+' : ''}${d}${isPct ? '%' : ''}`;
    const cls = d > 0 ? 'blh-delta-pos' : d < 0 ? 'blh-delta-neg' : 'blh-delta-neu';
    return `<div class="blh-delta-row"><span>${lbl}</span><span class="${cls}">${dStr}</span></div>`;
  }).filter(Boolean).join('');
  const td = (g.traits || []).length - ((equipped && equipped.traits) || []).length;
  const traitRow = td !== 0
    ? `<div class="blh-delta-row"><span>✦ Traits</span><span class="${td > 0 ? 'blh-delta-pos' : 'blh-delta-neg'}">${td > 0 ? '+' : ''}${td}</span></div>` : '';
  const btns = locked ? '<span class="blh-mini-lock">🔒</span>'
    : `<div class="blh-compare-actions">
        <button class="blh-alloc-confirm" style="flex:2" onclick="blh.equipLoot(${idx});blh.clearSelection()">สวม</button>
        <button class="blh-mini-btn sell" onclick="blh.sellLoot(${idx});blh.clearSelection()">ขาย 🔷${gearWorth(g)}</button>
      </div>`;
  return `<div class="blh-dock-detail-loot">
    <div class="blh-detail-close-row"><span>${sl.icon} ${sl.name} — เปรียบเทียบ</span>${close}</div>
    <div class="blh-compare">
      <div class="blh-compare-col new"><div class="blh-compare-label new">▶ ใหม่</div>${gearFull(g)}</div>
      <div class="blh-compare-col"><div class="blh-compare-label">สวมอยู่</div>${equipped ? gearFull(equipped) : '<span class="dim">— ว่าง —</span>'}</div>
    </div>
    ${(deltaRows || traitRow) ? `<div class="blh-compare-delta">${deltaRows}${traitRow}</div>` : ''}
    ${btns}
  </div>`;
}

// Card detail + placement state
function dockDetailCard(run, locked, cardId) {
  const st = findHandStack(run, cardId);
  const c = MAP_CARD_BY_ID[cardId];
  if (!c) return dockDetailDefault(run, locked);
  const kindLabel = { road: 'ROAD', adjacent: 'ADJACENT', terrain: 'TERRAIN' }[c.kind] || c.kind;
  const placing = run._placing === cardId;
  const validTargets = !locked ? validPlacementTargets(cardId) : [];
  const close = `<button class="blh-mini-btn ghost" onclick="blh.cancelPlace()">✕</button>`;
  return `<div class="blh-dock-detail-card">
    <div class="blh-detail-head">
      <span class="blh-detail-icon" style="color:${c.accent}">${c.icon}</span>
      <div style="flex:1;min-width:0">
        <div class="blh-detail-name">${esc(c.name)}</div>
        <div class="blh-detail-sub">
          <span class="blh-mapcard-kind">${kindLabel}</span>
          ${st ? `<span class="blh-detail-count">×${st.count}</span>` : ''}
          ${c.danger ? `<span class="blh-detail-danger">⚠ Danger ${c.danger}</span>` : ''}
        </div>
      </div>${close}
    </div>
    <div class="blh-detail-desc">${esc(c.desc)}</div>
    ${placing
      ? `<div class="blh-detail-placing">🗺️ ไฮไลต์ ${validTargets.length} ช่อง — แตะแผนที่เพื่อวาง</div>`
      : locked
        ? `<div class="blh-detail-placing dim">🔒 วางไม่ได้ระหว่างสู้</div>`
        : `<button class="blh-mini-btn" style="width:100%;margin-top:6px" onclick="blh.selectCard('${cardId}')">🗺️ เลือกวาง (${validTargets.length} ช่อง)</button>`}
  </div>`;
}

// Map tile detail: type + placed card + local danger + enemy
function dockDetailTile(run, cellId) {
  const def = BLH_CELL_BY_ID[cellId];
  if (!def) return dockDetailDefault(run, false);
  const rc = run.cells[cellId];
  const typeLabel = { road: 'ถนน', terrain: 'เทอเรน', camp: 'แคมป์' }[def.type] || def.type;
  const close = `<button class="blh-mini-btn ghost" onclick="blh.clearSelection()">✕</button>`;
  let body = '';
  if (rc.placedCardId) {
    const cd = MAP_CARD_BY_ID[rc.placedCardId];
    body += `<div style="font-size:12px;margin-top:4px">${cd ? `${cd.icon} <b>${esc(cd.name)}</b> — ${esc(cd.desc)}` : rc.placedCardId}</div>`;
  } else if (def.type !== 'camp') {
    body += `<div class="dim" style="font-size:11px;margin-top:4px;font-family:'Sarabun',sans-serif">ว่าง — ยังไม่มีการ์ดวาง</div>`;
  }
  if (def.type === 'road') {
    const ld = localDangerForRoad(cellId), sc = localDangerScaling(ld);
    body += ld > 0
      ? `<div class="blh-danger-info" style="margin-top:6px">
           <span class="blh-danger-tag">⚠️ Danger <b>${ld}</b></span>
           <span>👹 HP +${Math.round((sc.hpMult-1)*100)}% ATK +${Math.round((sc.atkMult-1)*100)}%</span>
           <span>💰 +${Math.round((sc.zenyMult-1)*100)}% 🎁 +${Math.round(sc.gearDropBonus*100)}%</span>
         </div>`
      : `<div class="blh-danger-info dim" style="margin-top:5px">⚠️ Danger 0</div>`;
    if (rc.enemy) body += `<div style="font-size:12px;margin-top:4px">👾 ${esc(rc.enemy.name)}</div>`;
    const mobStk = run.monsterTiles && run.monsterTiles[cellId];
    if (mobStk && mobStk.length > 0) {
      const mobList = mobStk.map(e => {
        const rankCls = monsterRankClass(e);
        return `<span class="blh-mob-rank-dot ${rankCls}"></span>${esc(e.name)}`;
      }).join('&nbsp; ');
      body += `<div style="font-size:11px;margin-top:4px;display:flex;flex-wrap:wrap;align-items:center;gap:3px">🐾 ×${mobStk.length}: ${mobList}</div>`;
    }
    if (run.eliteEventTile === cellId) {
      body += `<div style="font-size:12px;margin-top:5px;color:#ff9944;font-weight:700">◆ Elite Event</div><div style="font-size:10px;color:#ffcc88">รับ gear+Zeny ${BAL.ELITE_EVENT_ZENY} — สู้เพื่อรับรางวัล</div>`;
    }
    if (run.mythicEventTile === cellId) {
      body += `<div style="font-size:12px;margin-top:5px;color:#ff4466;font-weight:700">◆ Mythic Event</div><div style="font-size:10px;color:#ff99aa">Mini-Boss! gear (Epic+)+${BAL.MYTHIC_EVENT_ZENY} Zeny — อันตรายสูง</div>`;
    }
  }
  if (def.type === 'terrain' && run.bossTerrainCell === cellId) {
    body += `<div style="font-size:12px;margin-top:4px;color:#ff5577">👹 Boss Terrain — เดินถนนข้างๆ เพื่อสู้!</div>`;
  }
  return `<div class="blh-dock-detail-tile">
    <div class="blh-detail-close-row">
      <span style="font-size:12px">[${def.col+1},${def.row+1}] ${typeLabel}</span>${close}
    </div>${body}
  </div>`;
}


// ── Map pixel-sprite helpers (map display only; battle keeps card assets) ──

function monsterRankClass(e) {
  if (!e) return 'blh-mob-weak';
  if (e.role === 'mythic_event') return 'blh-mob-mythic';
  if (e.role === 'elite_event')  return 'blh-mob-elite';
  if (e.role === 'fast') return 'blh-mob-normal';
  // real enemies (from makeEnemy) carry id but not base — boring is the only weak natural
  if (e.id) return e.id === 'boring' ? 'blh-mob-weak' : 'blh-mob-normal';
  // bare test objects without id: fall back to base.hp threshold
  if (e.base && e.base.hp >= 24) return 'blh-mob-normal';
  return 'blh-mob-weak';
}
// Legacy class helper kept for backward compat (dock detail rank dots, smoke tests)
function monsterSpeciesClass(e) {
  const map = { boring: 'blh-mob-boring', faburr: 'blh-mob-faburr',
    looney_tic: 'blh-mob-looney', poporingo: 'blh-mob-poporingo', dripz: 'blh-mob-dripz' };
  return map[e && e.id] || 'blh-mob-boring';
}
function monsterSpeciesPattern(e) {
  return (e && PIXEL_SPRITES[e.id]) || PIXEL_SPRITES.boring;
}
// Render one pixel-art sprite as a single <span> whose box-shadow paints a 30×30 px grid.
function buildPixelSprite(pattern, rankCls) {
  const color = RANK_COLORS[rankCls] || '#44cc66';
  const sh = [];
  pattern.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '1') sh.push(`${x * 3}px ${y * 3}px 0 0 ${color}`);
    }
  });
  return `<span class="blh-px-c" style="box-shadow:${sh.join(',')}"></span>`;
}
// Full map markup for one monster slot: centered anchor + pixel sprite + optional stack dots.
function monsterMapMarkup(e, stackLen, title) {
  const sprite = buildPixelSprite(monsterSpeciesPattern(e), monsterRankClass(e));
  const cnt = stackLen ? Math.min(stackLen, 3) : 0;
  const dots = cnt >= 2
    ? `<div class="blh-mob-dots">${Array(cnt).fill('<span class="blh-mob-dot"></span>').join('')}</div>`
    : '';
  const tip = title != null ? title : (e ? esc(e.name) : '');
  return `<div class="blh-mob-anchor" title="${tip}">${sprite}</div>${dots}`;
}
function strongestMonsterOnTile(monsters) {
  if (!monsters || !monsters.length) return null;
  return monsters.reduce((best, e) => {
    const pw = e.base ? e.base.hp + e.base.atk * 2 : e.maxhp + e.atk * 2;
    const bw = best.base ? best.base.hp + best.base.atk * 2 : best.maxhp + best.atk * 2;
    return pw > bw ? e : best;
  });
}

// ── วาด board จาก grid config (CSS grid 7×9) — full-cell map tiles ──
function renderBoard() {
  const run = BLH.run; if (!run) return;
  const el = q('blh-board'); if (!el) return;
  // คอลัมน์ = 1fr ตาม gridWidth; แถวปล่อยเป็น implicit (auto) ให้ aspect-ratio:1/1
  // ของ cell กำหนดความสูง → cell สี่เหลี่ยมจัตุรัสจริง
  el.style.gridTemplateColumns = `repeat(${BLH_MAP.gridWidth}, 1fr)`;
  let html = '';
  for (const def of BLH_MAP.cells) {
    const rc = run.cells[def.id];
    const occupied = !!rc.placedCardId;
    const placeable = run._placing != null && isPlaceable(def.id, run._placing);
    // เนื้อหาในไทล์ (เต็มช่อง) — camp / enemy / marker
    let inner = '';
    if (def.type === 'camp') {
      inner = '<div class="blh-cell-icon">⛺</div>';
    } else if (def.type === 'road') {
      // All monster/event map visuals → pixel-art sprites via monsterMapMarkup()
      const mobStk = run.monsterTiles && run.monsterTiles[def.id];
      const hasMobs = mobStk && mobStk.length > 0;
      if (run.eliteEventTile === def.id) {
        inner = monsterMapMarkup({ id: 'elite', role: 'elite_event' }, 0,
          'Elite Event — ชนะเพื่อรับ gear+Zeny พิเศษ');
      } else if (run.mythicEventTile === def.id) {
        inner = monsterMapMarkup({ id: 'mythic', role: 'mythic_event' }, 0,
          'Mythic Event — Mini-Boss อันตราย! รางวัลสูงมาก');
      } else if (hasMobs) {
        inner = monsterMapMarkup(strongestMonsterOnTile(mobStk), mobStk.length);
      } else if (rc.enemy) {
        inner = monsterMapMarkup(rc.enemy, 0);
      }
    } else if (rc.enemy) {
      inner = monsterMapMarkup(rc.enemy, 0);
    }
    if (occupied) {
      const c = MAP_CARD_BY_ID[rc.placedCardId];
      inner += `<div class="blh-cell-marker" title="${esc(c.name)}">${c.icon}</div>`;
    }
    // local danger badge เฉพาะช่องถนนที่มี danger > 0 (แสดงความเป็น local)
    if (def.type === 'road') {
      const ld = localDangerForRoad(def.id);
      if (ld > 0) inner += `<div class="blh-cell-danger" title="Local Danger ${ld}">⚠${ld}</div>`;
    }
    // Boss terrain marker บนช่องเทอเรน
    if (def.type === 'terrain' && run.bossTerrainCell === def.id) {
      inner += `<div class="blh-cell-boss-terrain" title="Boss Terrain — เดินถนนข้างๆ เพื่อสู้">👹</div>`;
    }
    // (elite/mythic event sprites handled in main road tile block above)
    const cls = ['blh-tile', def.type];     // เช่น "blh-tile road" / "blh-tile terrain"
    if (placeable) cls.push('placeable');
    if (occupied) cls.push('occupied');
    if (def.type === 'terrain' && !occupied) cls.push('empty');
    if (_selection && _selection.type === 'tile' && _selection.cellId === def.id) cls.push('tile-sel');
    const handler = placeable ? `blh.placeAt('${def.id}')` : `blh.selectTile('${def.id}')`;
    html += `<div class="${cls.join(' ')}" data-celltype="${def.type}" data-cellid="${def.id}"
      style="grid-column:${def.col + 1};grid-row:${def.row + 1}"
      onclick="${handler}">${inner}</div>`;
  }
  // hero token (absolute overlay บนกึ่งกลาง cell — ไม่ทับ visual ของไทล์)
  const tp = cellCenterPct(BLH_CELL_BY_ID[run.route[run.routePos]]);
  html += `<div class="blh-token" id="blh-token" style="left:${tp.x}%;top:${tp.y}%">
    <img src="${run.hero.img}" onerror="this.style.opacity=0"></div>`;
  el.innerHTML = html;
}

function moveToken() {
  const run = BLH.run;
  const tok = q('blh-token'); if (!tok || !run) return;
  const p = cellCenterPct(BLH_CELL_BY_ID[run.route[run.routePos]]);
  tok.style.left = p.x + '%';
  tok.style.top = p.y + '%';
}

// ── การเดินอัตโนมัติ (speed-aware: Pause = ค้างไว้, 2x = หาร 2) ──
function scheduleStep(ms) {
  if (BLH._walkTimer) { clearTimeout(BLH._walkTimer); BLH._walkTimer = null; }
  const run = BLH.run; if (!run || run.ended) return;
  const base = ms == null ? BAL.WALK_MS : ms;
  if (run.speed === 0) { BLH._walkPendingMs = base; return; }   // Pause: รอ resume
  BLH._walkPendingMs = null;
  BLH._walkTimer = setTimeout(stepWalk, Math.round(base / run.speed));
}

function stepWalk() {
  const run = BLH.run;
  if (!run || run.ended || run.phase !== 'walking') return;
  run.routePos = (run.routePos + 1) % run.route.length;
  const cellId = run.route[run.routePos];
  moveToken();

  // ถึง Camp → auto-pause ทุก loop
  if (cellId === 'camp' || run.cells[cellId].type === 'camp') { arriveCamp(); return; }

  // step heal เฉพาะที่ (campfire ที่ติดช่องถนนนี้)
  const fx = getCellEffectsForRoad(cellId);
  if (fx.stepHeal > 0 && run.stats.hp < run.stats.maxhp) {
    run.stats.hp = clamp(run.stats.hp + fx.stepHeal, 0, run.stats.maxhp);
    updateHUD();
  }

  // Boss terrain adjacent trigger (ตรวจก่อนสิ่งอื่น — priority สูงสุด)
  if (run.bossTerrainCell) {
    const neighbors = getNeighborCells(cellId);
    if (neighbors.some(n => n.id === run.bossTerrainCell)) {
      startBattle({ kind: 'terrain_boss', enemies: makeTerrainBossEnemies(run), cellId });
      return;
    }
  }

  // Natural monster stack (ตรวจก่อน rc.enemy)
  const mobStack = run.monsterTiles[cellId];
  if (mobStack && mobStack.length > 0) {
    const enemies = [...mobStack];
    run.monsterTiles[cellId] = []; // เคลียร์ก่อน startBattle (เพื่อกัน re-trigger)
    startBattle({ kind: 'normal', enemies, cellId });
    return;
  }

  // Elite Event trigger
  if (run.eliteEventTile === cellId) {
    run.eliteEventTile = null; // เคลียร์ marker ก่อน startBattle (กัน re-trigger)
    startBattle({ kind: 'elite_event', enemies: [makeEliteEventEnemy(run)], cellId });
    return;
  }

  // Mythic Event trigger
  if (run.mythicEventTile === cellId) {
    run.mythicEventTile = null; // เคลียร์ marker ก่อน startBattle (กัน re-trigger)
    startBattle({ kind: 'mythic_event', enemies: [makeMythicEventEnemy(run)], cellId });
    return;
  }

  // Existing spawnForLoop enemy (single enemy บน rc)
  const rc = run.cells[cellId];
  if (rc.enemy) {
    startBattle({ kind: 'normal', enemies: [rc.enemy], cellId });
  } else {
    scheduleStep();
  }
}

// ── ถึง Camp (auto-pause ทุก loop) ──
function arriveCamp() {
  const run = BLH.run;
  run.loop += 1;                              // จบ 1 loop (best อัปเดตตอนจบรัน)
  // หมดผลบัฟชั่วคราว 1-loop (sacredCharge / silentExec) เมื่อเริ่ม loop ใหม่
  run._campAtkBuff = 0;
  run._killAtkBuff = 0;
  // Quick Step (trait): บัฟ ASPD "จนจบลูป" → หมดผลเมื่อถึง Camp
  if (run._quickStepActive) { run._quickStepActive = false; recomputeStats(run); }
  // ถ้าวาง Boss Signal ไว้ → บอสมาเลย
  if (run.bossSignalPlaced && !run.bossFought) {
    startBossFight();
    return;
  }
  // perk trigger จาก loop count (เก็บเป็น pending แสดงตอนถึง Camp)
  checkPerkLoopTrigger(run);
  // camp recovery (สเปก: ฐาน 20% [always heals] + Arena Training + perk + Clean Escape trait + INT heal effect, เพดานรวม 50%)
  //   หมายเหตุ merge: รวมเจตนา PR#134 "Camp always heals" — ฐาน 20% > 0 จึงฟื้นทุกครั้ง
  let healPct = (SPEC_BAL.CAMP_HEAL_BASE + upgValue('campHeal') + (run.perkMods.campRecov || 0) + ((run.traitMods && run.traitMods.cleanEscape) || 0))
    * (1 + (run.stats.healEffect || 0));
  healPct = clamp(healPct, 0, SPEC_BAL.CAMP_HEAL_CAP);
  const amt = Math.round(run.stats.maxhp * healPct);
  if (amt > 0) run.stats.hp = clamp(run.stats.hp + amt, 0, run.stats.maxhp);
  spawnForLoop(run);   // เสกศัตรูสำหรับ loop ใหม่ (ผู้เล่นได้วางแผนก่อน)
  stopCycleTimer();    // หยุด cycle timer ขณะอยู่ Camp
  run.speed = 0;       // auto-pause: เข้าโหมดวางแผน (Pause highlight) — กด ▶1x เพื่อ Continue
  renderBoard();
  updateHUD();
  _selection = null;   // ถึง Camp → reset selection; dock always visible
  setPhase('camp');    // setPhase → renderPanel (auto-pause: ไม่ scheduleStep จนกด ▶1x)
  // ถ้ามีสิทธิ์เลือกเพิร์กค้าง → แสดงหน้าเลือกก่อน Continue/Cash Out
  if (run.perkPending > 0) { openPerkChoice(); return; }
  blhToast(`⛺ ถึง Camp — LOOP ${run.loop} • กด ▶1x เพื่อเดินต่อ`);
}

function continueLoop() {
  const run = BLH.run; if (!run) return;
  if (run.perkPending > 0) { openPerkChoice(); return; }  // ต้องเลือกเพิร์กก่อน
  if (run.speed === 0) run.speed = 1;        // ถ้าค้าง Pause ไว้ ให้กลับมาเดิน
  // sacred charge — ATK เพิ่ม 1 loop หลังออกจาก Camp
  if (run.perkMods.postCampAtk > 0) run._campAtkBuff = Math.round(run.stats.atk * run.perkMods.postCampAtk);
  _selection = null;
  setPhase('walking');                        // renderPanel
  scheduleStep(450);
  startCycleTimer();                          // เริ่ม cycle timer เมื่อออกจาก Camp
}

// ── PERK TRIGGERS ───────────────────────────────────────────────────────────
// loop count ครบเป้า → +1 pending (ยิงครั้งเดียวต่อค่า)
function checkPerkLoopTrigger(run) {
  for (const L of PERK_LOOP_TRIGGERS) {
    if (run.loop >= L && !run.perkLoopFired.includes(L)) {
      run.perkLoopFired.push(L);
      grantPerkChoice(run);
    }
  }
}
// วางการ์ด/สิ่งก่อสร้างครบเป้า → +1 pending
function checkPerkBuildTrigger(run) {
  for (const N of PERK_BUILD_TRIGGERS) {
    if (run.placedCount >= N && !run.perkBuildFired.includes(N)) {
      run.perkBuildFired.push(N);
      grantPerkChoice(run);
    }
  }
}
// เพิ่มสิทธิ์เลือก 1 ครั้ง — ถ้ายังมีเพิร์กเหลือให้เลือก
function grantPerkChoice(run) {
  if (remainingPerks(run).length > 0) run.perkPending += 1;
}
function remainingPerks(run) {
  const pool = HERO_PERKS[run.hero.id] || [];
  return pool.filter(p => !run.perks.includes(p.id));
}
// สุ่ม 3 ตัวเลือกจาก pool (ไม่ซ้ำที่เลือกไปแล้ว)
function generatePerkOffer(run) {
  const avail = remainingPerks(run).map(p => p.id);
  const offer = [];
  while (offer.length < 3 && avail.length) {
    const i = Math.floor(Math.random() * avail.length);
    offer.push(avail.splice(i, 1)[0]);
  }
  run.perkOffer = offer;
  return offer;
}
// แสดงหน้าเลือกเพิร์ก (overlay ที่ Camp) — เกม "หยุด" จนเลือกเสร็จ
function openPerkChoice() {
  const run = BLH.run; if (!run) return;
  run.speed = 0;
  if (!run.perkOffer || !run.perkOffer.length) generatePerkOffer(run);
  renderPerkChoice();
}
function choosePerk(id) {
  const run = BLH.run; if (!run) return;
  if (!run.perkOffer || !run.perkOffer.includes(id)) return;
  if (run.perks.includes(id)) return;
  const pool = HERO_PERKS[run.hero.id] || [];
  const perk = pool.find(p => p.id === id);
  if (!perk) return;
  run.perks.push(id);
  perk.mod(run.perkMods);          // apply effect (run-only)
  recomputeStats(run);             // perk บางตัวแก้ stat → คำนวณใหม่
  run.perkPending = Math.max(0, run.perkPending - 1);
  run.perkOffer = null;
  blhToast(`✨ ได้เพิร์ก: ${perk.name}`);
  if (run.perkPending > 0) { openPerkChoice(); return; }  // ยังมีค้าง → เลือกต่อ
  // เสร็จแล้ว → ปิด overlay กลับสู่ตัวเลือก Camp
  const el = q('blh-perk'); if (el) el.style.display = 'none';
  renderBoard(); updateHUD(); renderPanel();
}

function placeSignal() {
  const run = BLH.run;
  run.bossSignalPlaced = true;
  blhToast('📡 วาง Boss Signal แล้ว — รอบหน้าที่ถึง Camp บอสจะปรากฏ!');
  updateHUD();
  renderPanel();
}

// แสดง roll เดียวเป็นข้อความ: "+3 STR" / "+5% CRI" / "+4 PEN"
function rollText(r) {
  if (!r) return '';
  const def = STAT_ROLLS[r.k];
  const label = def ? def.label : r.k;
  return def && def.pct ? `+${r.v}% ${label}` : `+${r.v} ${label}`;
}
function rarityOf(g) { return GEAR_RARITY_BY_ID[g.rarity] || GEAR_RARITIES[0]; }
function gearStatsText(g) {
  return [g.mainStat, g.subStat].filter(Boolean).map(rollText).join(' · ');
}
function gearTraitsText(g) {
  if (!g.traits || !g.traits.length) return '';
  return g.traits.map(id => (GEAR_TRAIT_BY_ID[id] || {}).name || id).join(', ');
}
// ย่อ (equip strip): tier + main/sub สีตาม rarity
function gearLabel(g) {
  const rar = rarityOf(g);
  const tr = (g.traits && g.traits.length) ? ` ✦${g.traits.length}` : '';
  return `<span style="color:${rar.color}">T${g.tier} ${gearStatsText(g)}${tr}</span>`;
}
// เต็ม (loot/gear panel): แท็ก tier+rarity, main เด่น + sub จาง, ชิป trait
function gearFull(g) {
  const rar = rarityOf(g);
  const main = g.mainStat ? `<b>${rollText(g.mainStat)}</b>` : '';
  const sub  = g.subStat ? `<span class="blh-substat">${rollText(g.subStat)}</span>` : '';
  const stats = `${main}${main && sub ? ' <span class="blh-roll-sep">·</span> ' : ''}${sub}`;
  const traits = (g.traits && g.traits.length)
    ? `<div class="blh-gear-traits">${g.traits.map(id =>
        `<span class="blh-trait-chip" title="${esc((GEAR_TRAIT_BY_ID[id] || {}).desc || '')}">✦ ${esc((GEAR_TRAIT_BY_ID[id] || {}).name || id)}</span>`).join('')}</div>`
    : '';
  return `<span class="blh-rar-tag" style="color:${rar.color};border-color:${rar.color}">T${g.tier} ${rar.name}</span> ${stats}${traits}`;
}


// ── gear (เปลี่ยนได้เฉพาะนอกการสู้) ──
function equipLoot(idx) {
  const run = BLH.run;
  if (run.phase === 'battle') { blhToast('🔒 เปลี่ยนเกียร์ไม่ได้ระหว่างสู้'); return; }
  const g = run.lootBag[idx];
  if (!g) return;
  const prev = run.gear[g.slot];
  run.gear[g.slot] = g;
  run.lootBag.splice(idx, 1);
  if (prev) run.lootBag.push(prev); // ของเก่ากลับลงกระเป๋า
  recomputeStats(run);
  _selection = null; // bag index changed; clear before re-render
  updateHUD();
  renderPanel();
}
function unequip(slot) {
  const run = BLH.run;
  if (run.phase === 'battle') { blhToast('🔒 เปลี่ยนเกียร์ไม่ได้ระหว่างสู้'); return; }
  const g = run.gear[slot];
  if (!g) return;
  run.gear[slot] = null;
  run.lootBag.push(g);            // กลับเข้ากระเป๋า (player action — ไม่ auto-salvage)
  recomputeStats(run);
  updateHUD();
  renderPanel();
}
// ขายเกียร์จากกระเป๋าด้วยมือ → ได้ 100% ของมูลค่าขาย เป็น Loop Zeny (สะสมใน zenyBonus)
function sellLoot(idx) {
  const run = BLH.run;
  if (run.phase === 'battle') { blhToast('🔒 ขายเกียร์ไม่ได้ระหว่างสู้'); return; }
  const g = run.lootBag[idx];
  if (!g) return;
  const val = gearWorth(g);                 // 100% manual salvage value
  run.lootBag.splice(idx, 1);
  run.mods.zenyBonus += val;
  const slot = GEAR_SLOTS.find(s => s.id === g.slot);
  blhToast(`💰 ขาย ${slot ? slot.name : ''} → +${val} Zeny`);
  _selection = null; // bag index changed; clear before re-render
  updateHUD();
  renderPanel();
}

// ── map card placement (grid-cell based) ──
// คืน cell id ที่วางการ์ดใบนี้ได้ (ใช้ทั้ง highlight และ validation)
function validPlacementTargets(cardId) {
  return BLH_MAP.cells.filter(c => isPlaceable(c.id, cardId)).map(c => c.id);
}
function startPlace(cardId) {
  const run = BLH.run;
  if (run.phase === 'battle') { blhToast('🔒 วางการ์ดไม่ได้ระหว่างสู้'); return; }
  if (cardId == null || !findHandStack(run, cardId)) return;   // ต้องมี stack ของชนิดนี้ในมือ
  const targets = validPlacementTargets(cardId);
  if (!targets.length) {
    // feedback ชัดเจนเมื่อไม่มีช่องที่วางได้
    const c = MAP_CARD_BY_ID[cardId];
    const where = c.kind === 'road' ? 'ช่องถนนว่าง'
                : c.kind === 'adjacent' ? 'ช่องเทอเรนที่ติดถนนและยังว่าง'
                : 'ช่องเทอเรนที่ว่าง';
    blhToast(`ไม่มี${where}ให้วาง ${c.name}`);
    return;
  }
  run._placing = cardId;
  _selection = { type: 'card', cardId };
  blhToast('แตะช่องที่ไฮไลต์บนแผนที่เพื่อวาง');
  renderBoard();
  renderPanel();
}
function cancelPlace() {
  const run = BLH.run;
  run._placing = null;
  _selection = null;
  renderBoard();
  renderPanel();
}
// กฎการวาง (locked spec):
//   road card     → ช่อง road เท่านั้น (วางบนช่องที่มีศัตรูได้ = แทนที่ encounter)
//   adjacent card → ช่อง terrain ที่ติด road (orthogonal) อย่างน้อย 1 ช่อง
//   terrain card  → ช่อง terrain ใดก็ได้
//   ช่องที่วางการ์ดแล้ว = occupied → วางซ้ำไม่ได้ (placement ถาวรจนจบรัน)
//   camp/blocked  → วางการ์ดไม่ได้ (Boss Signal วางที่ Camp ผ่านปุ่มแยก)
function isPlaceable(cellId, cardId) {
  const run = BLH.run;
  const def = BLH_CELL_BY_ID[cellId];
  if (!run || !def) return false;
  const rc = run.cells[cellId];
  if (rc.placedCardId) return false;               // occupied แล้ว
  const c = MAP_CARD_BY_ID[cardId];
  if (!c) return false;
  if (c.kind === 'road')     return def.type === 'road';
  if (c.kind === 'adjacent') return def.type === 'terrain' && getAdjacentRoadCells(cellId).length > 0;
  if (c.kind === 'terrain')  return def.type === 'terrain';
  return false;
}
function placeAt(cellId) {
  const run = BLH.run;
  const cardId = run._placing;
  // วางไม่สำเร็จ (ช่องไม่ valid หรือไม่มี stack) → ไม่กินการ์ด
  if (cardId == null || !isPlaceable(cellId, cardId)) return;
  if (!findHandStack(run, cardId)) { run._placing = null; return; }
  const c = MAP_CARD_BY_ID[cardId];
  applyCardEffect(c, run, cellId);
  // บันทึกการวาง (source of truth ตาม cell id)
  run.cells[cellId].placedCardId = c.id;
  run.placedCells[cellId] = { cardId: c.id, cardType: c.kind, placedLoop: run.loop };
  // วางสำเร็จ → กินการ์ด 1 ใบจาก stack (stack 0 = ลบชนิดนั้น)
  consumeCardFromHand(run, cardId);
  run._placing = null;
  // นับการวางถาวร 1 ครั้ง → trigger เพิร์กจากจำนวนสิ่งก่อสร้าง
  run.placedCount += 1;
  checkPerkBuildTrigger(run);
  recomputeStats(run);
  renderBoard();
  updateHUD();
  blhToast(`วาง ${c.name} แล้ว`);
  _selection = null;
  if (run.perkPending > 0 && run.phase === 'camp') { openPerkChoice(); return; }
  renderPanel();
}

// ผลของการ์ด:
//   • terrain card → global run buff (run.mods) — คงค่าตัวเลขเดิม
//   • road / adjacent card → cell-based (เก็บที่ placedCardId, ผลคิดใน
//     getCellEffectsForRoad ตอนสู้/เดิน) ยกเว้น spawn_rift ที่เสกศัตรูทันที
function applyCardEffect(c, run, cellId) {
  const rc = run.cells[cellId];
  switch (c.id) {
    // ROAD (cell-based) — spawn_rift แทนที่ encounter ด้วยศัตรูที่แรงขึ้น
    case 'spawn_rift':
      rc.enemy = makeEnemy(pick(ENEMIES), run, { power: 1.15 });
      break;
    case 'pack_howl':
    case 'blood_track':
      break; // ผลคิดแบบ cell-based ใน getCellEffectsForRoad
    // ADJACENT (cell-based) — ส่งผลเฉพาะช่องถนนข้างเคียง
    case 'campfire':
    case 'shrine':
    case 'lucky_totem':
      break;
    // TERRAIN (global run buff) — คงตัวเลขเดิม
    case 'rock':       run.mods.def += 3; break;
    case 'thornfield': run.mods.enemyHpMult *= 0.85; run.mods.thornSelf += 1; break;
    case 'treasure':   run.mods.lootTierBump += 1; break;
  }
  // อัปเดต terrain power (สะสม danger ของการ์ดที่วาง → อาจ trigger boss terrain)
  run.terrainPower += (c.danger || 0);
  checkBossTerrainSpawn(run);
}

// ════════════════════════════════════════════════════════════════════════════
// BATTLE (auto, popup, text RPG log)
// ════════════════════════════════════════════════════════════════════════════
function startBattle(ctx) {
  const run = BLH.run;
  stopCycleTimer(); // หยุด cycle timer ตลอด battle
  setPhase('battle');
  // เอฟเฟกต์เฉพาะช่อง (road/adjacent card) — boss ไม่มี cell จึงใช้ EMPTY
  const cellFx = ctx.cellId ? getCellEffectsForRoad(ctx.cellId) : EMPTY_CELL_FX;
  const battle = {
    kind: ctx.kind,            // 'normal' | 'boss'
    cellId: ctx.cellId || null,
    cellFx,
    enemies: ctx.enemies,      // [{...}] alive list (boss: [minionL, minionR, boss])
    log: [],
    round: 0,
    timer: null,
    paused: false,
    done: false,
    // ── hero passive state (run/battle-only) ──
    heroHits: 0,               // หมัดที่เข้าทั้งหมด (perk thirdHit/comboFlow)
    hitStreak: 0,              // หมัดปกติที่เข้าต่อเนื่อง (พาสซีฟ — miss ไม่นับ)
    toeiCharged: false,        // TOEI ชาร์จ Power Punch ไว้แล้วหรือยัง
    heroShield: 0,             // โล่จาก Power Punch
    // ── local danger (เฉพาะ road encounter; รวมกับ loop scaling ที่ baked ไว้ใน makeEnemy) ──
    localDanger: 0, dangerSteps: 0, zenyMult: 1, gearDropBonus: 0,
  };
  // LOCAL DANGER: road encounter → scale enemy HP/ATK (ปริมาณ) ตามไทล์รอบช่องนี้
  //   loop scaling ถูก bake ไว้ใน makeEnemy แล้ว → danger คูณทับ (สองสเกลซ้อนกัน)
  //   ไม่แตะ gear tier/rarity — เฉพาะ HP/ATK + (zeny/gear-drop เก็บไว้ใช้ตอน reward)
  if (ctx.kind === 'normal' && ctx.cellId) {
    const ld = localDangerForRoad(ctx.cellId);
    const sc = localDangerScaling(ld);
    battle.localDanger = ld;
    battle.dangerSteps = sc.steps;
    battle.zenyMult = sc.zenyMult;
    battle.gearDropBonus = sc.gearDropBonus;
    if (sc.steps > 0) {
      for (const e of ctx.enemies) {
        e.maxhp = Math.max(1, Math.round(e.maxhp * sc.hpMult));
        e.hp = e.maxhp;
        e.atk = Math.round(e.atk * sc.atkMult);
      }
    }
  }
  // pack_howl: ศัตรูบนช่องนี้แรงขึ้น (apply ครั้งเดียวตอนเริ่มสู้)
  if (cellFx.enemyDmgBonus) ctx.enemies.forEach(e => { e.atk += cellFx.enemyDmgBonus; });
  BLH._battle = battle;
  q('blh-battle').style.display = 'flex';
  buildBattleDOM();             // สร้าง popup ครั้งเดียว — entrance animation เล่นรอบเดียว
  battleLog(ctx.kind === 'boss'
    ? `⚔️ ${run.boss.name} ปรากฏตัวพร้อมลูกสมุน 2 ตัว!`
    : ctx.kind === 'terrain_boss'
    ? `👹 Terrain Boss โจมตี! ${run.boss.name} กับลูกสมุน!`
    : ctx.kind === 'elite_event'
    ? `⭐ Elite Event! ${ctx.enemies[0].name} ปรากฏ! — รางวัลพิเศษรอคุณอยู่!`
    : ctx.kind === 'mythic_event'
    ? `💎 Mythic Mini-Boss! ${ctx.enemies[0].name} ปรากฏ! — อันตรายสูง!`
    : ctx.enemies.length > 1
    ? `⚔️ Monster Stack ${ctx.enemies.length} ตัว!`
    : `⚔️ เจอ ${ctx.enemies[0].name}!`);
  scheduleBattleTick(BAL.BATTLE_OPEN_MS);
}

// ตั้งเวลา tick ถัดไป (speed-aware: Pause = ค้าง, 2x = หาร 2)
function scheduleBattleTick(initialMs) {
  const battle = BLH._battle, run = BLH.run;
  if (!battle || battle.done || !run) return;
  if (battle.timer) { clearTimeout(battle.timer); battle.timer = null; }
  if (run.speed === 0 || battle.paused) { battle._pending = true; return; }   // Pause: รอ resume
  battle._pending = false;
  const base = initialMs == null ? BAL.BATTLE_MS : initialMs;
  battle.timer = setTimeout(battleTick, Math.round(base / run.speed));
}

function aliveEnemies() { return BLH._battle.enemies.filter(e => e.hp > 0); }

function chooseTarget(battle) {
  const run = BLH.run;
  if (battle.kind !== 'boss' && battle.kind !== 'terrain_boss') {
    return aliveEnemies()[0];
  }
  // boss / terrain_boss priority: 1) minion HP ต่ำสุด 2) ซ้าย 3) ขวา 4) boss
  const minions = battle.enemies.filter(e => e.role === 'minion' && e.hp > 0);
  if (minions.length) {
    minions.sort((a, b) => (a.hp - b.hp) || (a.slot - b.slot));
    return minions[0];
  }
  return battle.enemies.find(e => e.role === 'boss' && e.hp > 0);
}

// ── combat core (สเปกใหม่: PEN/EVA/CRIT/LS + perk) ──────────────────────────
//   effectiveDef = max(0, def - armorPen)
//   baseDamage   = max(1, atk - effectiveDef)
//   dodge → critRate → critDamage → mitigations → apply
function resolveAttack(att, def) {
  // 1) HIT / MISS (สเปก): hitChance = 90% + hitBonus ผู้ตี − dodge เป้าหมาย, clamp 75–98%
  //    การหลบของเป้าหมายถูกรวมเข้า hit roll เดียว (miss = โดนหลบ)
  //    สกิลพิเศษ/พาสซีฟ (att.noMiss) ข้ามการ roll นี้ — ไม่มีวันพลาด
  if (!att.noMiss) {
    const hitChance = clamp(
      SPEC_BAL.BASE_HIT + (att.hitBonus || 0) - (def.evasion || 0),
      SPEC_BAL.MIN_HIT, SPEC_BAL.MAX_HIT);
    if (Math.random() > hitChance) return { missed: true, dmg: 0, crit: false };
  }
  // 2) เกราะ/ดาเมจฐาน
  const effDef = Math.max(0, (def.def || 0) - (att.armorPen || 0));
  let dmg = Math.max(1, Math.round(att.atk * rnd(0.9, 1.1)) - effDef);
  // 3) คริต (สกิลพิเศษคริตได้)
  let crit = false;
  if (att.critRate && Math.random() < att.critRate) { dmg = Math.round(dmg * (att.critDamage || 1.5)); crit = true; }
  // 4) execute (backstab vs เป้าหมาย HP ต่ำ)
  if (att.execLowHp && def.maxhp && def.hp / def.maxhp < 0.5) dmg = Math.round(dmg * (1 + att.execLowHp));
  // 4b) Heavy Grip (trait): ดาเมจใส่ Elite / Elite Event / Mythic Event เพิ่ม
  if (att.vsElite && (def.role === 'elite' || def.role === 'elite_event' || def.role === 'mythic_event'))
    dmg = Math.round(dmg * (1 + att.vsElite));
  // 5) เพดานดาเมจสุดท้ายของสกิลพิเศษ (หลังคริต) — สเปกกำหนดต่อฮีโร่
  if (att.capDmg) dmg = Math.min(dmg, att.capDmg);
  // 6) มิทิเกชันของผู้รับ (guard ตอน HP ต่ำ / กันคริต / ลดดาเมจรวม)
  if (def.lowHpGuard && def.maxhp && def.hp / def.maxhp < 0.4) dmg = Math.round(dmg * (1 - def.lowHpGuard));
  if (crit && def.burstReduce) dmg = Math.round(dmg * (1 - def.burstReduce));
  // Iron Skin (trait): ลดดาเมจจากศัตรู "ธรรมดา" เท่านั้น (ไม่กับ elite/boss/minion)
  if (def.ironSkin && att.role && NORMAL_ENEMY_ROLES.includes(att.role)) dmg = Math.round(dmg * (1 - def.ironSkin));
  if (def.dr) dmg = Math.round(dmg * (1 - def.dr));
  dmg = Math.max(1, dmg);
  def.hp = Math.max(0, def.hp - dmg);
  return { missed: false, dmg, crit };
}

// descriptor ฮีโร่ฝั่งโจมตี (รวม cellFx + perk buff + combo/low-hp + trait)
function heroAttacker(run, battle, isExtra) {
  const m = run.perkMods, s = run.stats, tr = run.traitMods || {};
  let atk = s.atk + (battle.cellFx ? battle.cellFx.atkBonus : 0) + (run._campAtkBuff || 0) + (run._killAtkBuff || 0);
  if (m.comboFlow) atk = Math.round(atk * (1 + Math.min(0.5, m.comboFlow * (battle.heroHits || 0))));
  // low-HP ATK: perk lowHpAtk + trait Last Stand (stack)
  if (s.hp / s.maxhp < 0.3) {
    const lowMul = (m.lowHpAtk || 0) + (tr.lastStand || 0);
    if (lowMul) atk = Math.round(atk * (1 + lowMul));
  }
  if (isExtra) atk = Math.max(1, Math.round(atk * 0.5));   // หมัดเสริมเบากว่า
  // Sharp Rhythm (trait): หลังคริต โอกาสคริตเพิ่มจนจบไฟต์ (battle._sharpRhythm)
  const critRate = clamp(s.critRate + (battle._sharpRhythm || 0), 0, STAT_CAPS.critRate);
  return { isHero: true, atk, critRate, critDamage: s.critDamage, armorPen: s.armorPen,
    execLowHp: m.execLowHp, hitBonus: s.hitBonus, vsElite: tr.heavyGrip || 0 };
}

// descriptor ฮีโร่ฝั่งรับ (mutate .hp ระหว่างศัตรูตี)
function heroDefender(run) {
  const m = run.perkMods, s = run.stats;
  let eva = s.evasion;
  // APOLOGIZE — พาสซีฟ Apology Counter ให้ base dodge เพิ่ม
  const pas = HERO_PASSIVES[run.hero.id];
  if (pas && pas.mode === 'counter') eva = clamp(eva + pas.baseDodge, 0, STAT_CAPS.evasion);
  if (m.lowHpEva && s.hp / s.maxhp < 0.3) eva = clamp(eva + m.lowHpEva, 0, STAT_CAPS.evasion);
  const tr = run.traitMods || {};
  return { isHero: true, def: s.def, evasion: eva, dr: s.damageReduction,
    lowHpGuard: m.lowHpGuard, burstReduce: m.burstReduce, hp: s.hp, maxhp: s.maxhp,
    ironSkin: tr.ironSkin || 0 };   // Iron Skin (trait): ลดดาเมจจากศัตรูธรรมดา
}

// ฮีโร่ตี target 1 ครั้ง (รวม spirit-fist / lifesteal / venom / kill)
// lifesteal: ฟื้น = floor(dmg × LS) แต่ไม่เกินเพดานต่อหมัด (สเปก: ปกติ 15%, สกิล 20% maxHP)
function applyLifesteal(run, dmg, healCapPct) {
  if (run.stats.lifesteal <= 0 || dmg <= 0) return;
  const raw = Math.floor(dmg * run.stats.lifesteal);
  const cap = Math.round(run.stats.maxhp * healCapPct);
  const heal = Math.min(raw, cap);
  if (heal > 0) run.stats.hp = clamp(run.stats.hp + heal, 0, run.stats.maxhp);
}

// คืน true ถ้าหมัดเข้า (ใช้เป็นเงื่อนไขนับ hit streak ของพาสซีฟ) / false ถ้าพลาด
function heroStrike(target, battle, run, isExtra) {
  const m = run.perkMods;
  const att = heroAttacker(run, battle, isExtra);
  const r = resolveAttack(att, target);
  if (r.missed) { battleLog(`💨 ${run.hero.name} ชกพลาด ${target.name}!`); return false; }
  battle.heroHits = (battle.heroHits || 0) + 1;
  if (r.crit && run.traitMods && run.traitMods.sharpRhythm) battle._sharpRhythm = run.traitMods.sharpRhythm; // Sharp Rhythm
  let extra = '';
  // spirit fist — ทุกหมัดที่ 3
  if (m.thirdHit && battle.heroHits % 3 === 0 && target.hp > 0) {
    const bonus = Math.max(1, Math.round(r.dmg * m.thirdHit));
    target.hp = Math.max(0, target.hp - bonus);
    extra += ` +${bonus}🌟`;
  }
  // armor break — ลด DEF เป้าหมายชั่วคราว (ภายในไฟต์)
  if (m.armorBreak) { target.def = Math.max(0, (target.def || 0) - m.armorBreak); }
  battleLog(`${isExtra ? '⚡' : '🥊'} ${run.hero.name} → ${target.name} −${r.dmg}${r.crit ? ' 💥CRIT' : ''}${extra}`);
  applyLifesteal(run, r.dmg, SPEC_BAL.LS_HEAL_NORMAL);
  // venom — ติดพิษ
  if (m.dotChance && target.hp > 0 && Math.random() < m.dotChance && !target._dot) {
    target._dot = { dmg: Math.max(1, Math.round(att.atk * 0.10)), turns: 3 };
    battleLog(`🟢 ${target.name} ติดพิษ!`);
  }
  if (target.hp <= 0) onEnemyKilled(target, run, r.crit);
  return true;
}

// ── HERO PASSIVES — สกิลพิเศษ (ไม่พลาด, คริตได้, มีเพดานดาเมจสุดท้าย) ──────────
// ยิงสกิลพิเศษประจำฮีโร่ใส่เป้าหมาย (Overdrive Shot / Power Punch / Apology Counter)
function fireSpecial(target, battle, run, kind) {
  if (!target || target.hp <= 0) return;
  const pas = HERO_PASSIVES[run.hero.id];
  if (!pas) return;
  const b = run.statBase || run.base, s = run.stats;
  const baseAtk = heroAttacker(run, battle, false).atk;   // atk ฮีโร่รวมบัฟ (ไม่ลดแบบหมัดเสริม)
  let pct, critRate = s.critRate, critDamage = s.critDamage, armorPen = s.armorPen;
  if (kind === 'overdrive_shot') {
    pct = Math.min(pas.capPct, pas.basePct + Math.floor(b.dex / 5) * pas.dexPer5 + Math.floor(b.str / 5) * pas.strPer5);
  } else if (kind === 'power_punch') {
    const base = (target.role === 'elite') ? pas.vsElitePct : pas.basePct;
    pct = Math.min(pas.capPct, base + Math.floor(b.str / 5) * pas.strPer5);
    armorPen += Math.floor(b.dex / 5) * pas.dexPenPer5;     // เจาะเกราะพิเศษ
  } else { // apology_counter
    pct = Math.min(pas.capPct, pas.counterPct + Math.floor(b.str / 5) * pas.strPer5);
    critRate = clamp(critRate + Math.floor(b.luk / 5) * pas.lukCritPer5, 0, STAT_CAPS.critRate);
  }
  const att = {
    atk: Math.max(1, Math.round(baseAtk * pct)),
    noMiss: true, critRate, critDamage, armorPen,
    capDmg: Math.round(baseAtk * pas.finalCapAfterCrit),   // เพดานดาเมจสุดท้ายหลังคริต
  };
  const r = resolveAttack(att, target);
  if (r.crit && run.traitMods && run.traitMods.sharpRhythm) battle._sharpRhythm = run.traitMods.sharpRhythm; // Sharp Rhythm
  battleLog(`✨ ${run.hero.name} ใช้ ${pas.name} → ${target.name} −${r.dmg}${r.crit ? ' 💥CRIT' : ''}`);
  applyLifesteal(run, r.dmg, SPEC_BAL.LS_HEAL_SPECIAL);
  // NOCTISAK47 — โอกาส Loop Zeny พิเศษจาก LUK
  if (kind === 'overdrive_shot') {
    const chance = Math.floor(b.luk / 5) * pas.lukZenyPer5;
    if (chance > 0 && Math.random() < chance) {
      run.mods.zenyBonus += pas.zenyOnHit;
      battleLog(`🍀 Overdrive โบนัส +${pas.zenyOnHit} Zeny`);
    }
  }
  // TOEI — โล่เล็กหลัง Power Punch (ดูดซับดาเมจตาถัดไป)
  if (kind === 'power_punch') {
    const sh = Math.floor(b.vit / 5) * pas.vitShieldPer5;
    if (sh > 0) { battle.heroShield = (battle.heroShield || 0) + sh; battleLog(`🛡️ ได้โล่ ${sh}`); }
  }
  if (target.hp <= 0) onEnemyKilled(target, run, r.crit);
}

// หมัดหลักของฮีโร่ต่อ 1 เทิร์น — จัดการพาสซีฟ (streak / charge / special)
function heroAct(target, battle, run) {
  const pas = HERO_PASSIVES[run.hero.id];
  // TOEI — หมัดถัดไปถูกชาร์จเป็น Power Punch
  if (pas && pas.mode === 'charge' && battle.toeiCharged) {
    battle.toeiCharged = false;
    fireSpecial(target, battle, run, pas.id);
    return;
  }
  const landed = heroStrike(target, battle, run, false);
  if (!landed) return;                       // miss ไม่นับ streak (สเปก)
  battle.hitStreak = (battle.hitStreak || 0) + 1;
  if (!pas) return;
  if (pas.mode === 'every' && battle.hitStreak % pas.everyHits === 0) {
    const t2 = chooseTarget(battle);          // ยิงสกิลทันที (อาจใส่เป้าใหม่ถ้าตัวเดิมตาย)
    if (t2) fireSpecial(t2, battle, run, pas.id);
  } else if (pas.mode === 'charge' && battle.hitStreak % pas.everyHits === 0) {
    battle.toeiCharged = true;
    battleLog(`🔱 ${run.hero.name} ชาร์จ ${pas.name}!`);
  }
}

function onEnemyKilled(target, run, wasCrit) {
  const m = run.perkMods, tr = run.traitMods || {};
  battleLog(`☠️ ${target.name} ถูกล้ม!`);
  grantExp(ENEMY_EXP[target.role] || ENEMY_EXP.basic);
  // Blood Taste (trait): ฟื้น HP เมื่อสังหาร (cap 10% maxHP ต่อตัว — รวมไว้ใน traitMods แล้ว)
  if (tr.bloodTaste > 0) {
    const heal = Math.round(run.stats.maxhp * tr.bloodTaste);
    if (heal > 0) { run.stats.hp = clamp(run.stats.hp + heal, 0, run.stats.maxhp); battleLog(`🩸 Blood Taste +${heal} HP`); }
  }
  if (m.killBuffAtk) run._killAtkBuff = (run._killAtkBuff || 0) + m.killBuffAtk;  // จนถึง loop ถัดไป
  if (m.critKillBonus && wasCrit) { run.mods.zenyBonus += 15; battleLog('🍀 Lucky Cut! +15 Zeny'); }
}

// DoT ทุกตัวที่ติดพิษ (ทำงานหลังเทิร์นฮีโร่)
function applyDots(battle, run) {
  for (const e of battle.enemies) {
    if (e.hp > 0 && e._dot && e._dot.turns > 0) {
      e.hp = Math.max(0, e.hp - e._dot.dmg);
      e._dot.turns--;
      battleLog(`🟢 พิษกัด ${e.name} −${e._dot.dmg}`);
      if (e.hp <= 0) { battleLog(`☠️ ${e.name} ตายจากพิษ!`); onEnemyKilled(e, run, false); }
    }
  }
}

function battleTick() {
  const battle = BLH._battle;
  const run = BLH.run;
  if (!battle || battle.done || battle.paused || !run || run.speed === 0) return;
  battle.round++;
  const m = run.perkMods;

  // ── HERO TURN (heroAct จัดการพาสซีฟ streak/charge/special) ──
  const target = chooseTarget(battle);
  if (target) {
    heroAct(target, battle, run);
    // double strike (perk) หรือ extra-hit จาก ASPD — หมัดเสริม (ไม่นับ streak พาสซีฟ)
    if (m.doubleStrike && Math.random() < m.doubleStrike) {
      const t2 = chooseTarget(battle); if (t2) heroStrike(t2, battle, run, true);
    } else if (run.stats.extraHit && Math.random() < run.stats.extraHit) {
      const t2 = chooseTarget(battle); if (t2) heroStrike(t2, battle, run, true);
    }
  }
  applyDots(battle, run);

  // ฆ่าหมดแล้วจบเลย (ไม่ต้องโดนสวน)
  if (!aliveEnemies().length) { updateBattleDynamic(); updateHUD(); endBattle('win'); return; }

  // ── ENEMY TURN ──
  const heroDef = heroDefender(run);
  let totalDmg = 0, anyHit = false;
  for (const e of aliveEnemies()) {
    const before = heroDef.hp;
    const r = resolveAttack({ atk: e.atk, hitBonus: 0, role: e.role }, heroDef);
    if (r.missed) {
      battleLog(`💨 ${run.hero.name} หลบ ${e.name}!`);
      // APOLOGIZE — Apology Counter: หลบสำเร็จแล้วสวนกลับ (ไม่พลาด, คริตได้)
      const pas = HERO_PASSIVES[run.hero.id];
      if (pas && pas.mode === 'counter' && e.hp > 0) fireSpecial(e, battle, run, pas.id);
      // vanish counter — perk สวนหลังหลบ
      if (m.dodgeCounter && e.hp > 0) {
        const dmg = Math.max(1, Math.round(run.stats.atk * m.dodgeCounter));
        e.hp = Math.max(0, e.hp - dmg);
        battleLog(`🌀 สวนกลับ ${e.name} −${dmg}`);
        if (e.hp <= 0) onEnemyKilled(e, run, false);
      }
      continue;
    }
    // TOEI — โล่จาก Power Punch ดูดซับดาเมจตาถัดไป
    if (battle.heroShield > 0 && r.dmg > 0) {
      const absorb = Math.min(battle.heroShield, r.dmg);
      battle.heroShield -= absorb;
      heroDef.hp = Math.min(heroDef.maxhp, heroDef.hp + absorb);
      if (absorb > 0) battleLog(`🛡️ โล่กัน ${absorb}`);
    }
    totalDmg += before - heroDef.hp; anyHit = true;
    // thorns gear-roll หายไปแล้ว — ใช้ retaliate perk แทน
    if (m.retaliate && e.hp > 0 && Math.random() < m.retaliate) {
      const dmg = Math.max(1, Math.round(run.stats.atk * 0.4));
      e.hp = Math.max(0, e.hp - dmg);
      battleLog(`↩️ สวนกลับ ${e.name} −${dmg}`);
      if (e.hp <= 0) onEnemyKilled(e, run, false);
    }
    // Counter Guard (trait): โอกาสสวนกลับเมื่อโดนตี
    const cg = run.traitMods ? run.traitMods.counterGuard : 0;
    if (cg && e.hp > 0 && Math.random() < cg) {
      const dmg = Math.max(1, Math.round(run.stats.atk * 0.4));
      e.hp = Math.max(0, e.hp - dmg);
      battleLog(`🛡️↩️ Counter Guard ${e.name} −${dmg}`);
      if (e.hp <= 0) onEnemyKilled(e, run, false);
    }
  }
  // thornfield terrain — เจ็บเพิ่มต่อตา
  if (anyHit && run.mods.thornSelf) { heroDef.hp = Math.max(0, heroDef.hp - run.mods.thornSelf); totalDmg += run.mods.thornSelf; }
  // หักดาเมจสุทธิจาก run.stats.hp ปัจจุบัน (ไม่ overwrite ด้วย snapshot) — รักษา
  // heal ที่เกิดกลางตาศัตรู เช่น Blood Taste จาก counter-kill / Apology Counter lifesteal
  run.stats.hp = clamp(run.stats.hp - totalDmg, 0, run.stats.maxhp);
  if (totalDmg > 0) battleLog(`💢 ศัตรูตอบโต้ −${totalDmg} (HP ${Math.round(run.stats.hp)})`);

  updateBattleDynamic();      // อัปเดตเฉพาะ HP/log/dead — ไม่ rebuild popup (กัน flicker)
  updateHUD();

  // ── ตรวจจบ ──
  if (run.stats.hp <= 0) { endBattle('dead'); return; }
  if (!aliveEnemies().length) { endBattle('win'); return; }

  scheduleBattleTick();
}

function endBattle(result) {
  const battle = BLH._battle;
  const run = BLH.run;
  battle.done = true;
  if (battle.timer) clearTimeout(battle.timer);

  if (result === 'dead') {
    // สเปก: HP<=0 จบรันทันที — Safe Retreat ช่วยเรื่อง "เก็บ Loop Zeny" ตอนตาย (ดู runEnd)
    battleLog('☠️ ฮีโร่ล้มลง...');
    finishBattleBanner('DEFEAT');
    BLH._finishTimer = setTimeout(() => runEnd('dead'), 800);
    return;
  }

  // ── WIN ──
  // calm strike — ฟื้น HP เล็กน้อยหลังชนะไฟต์
  if (run.perkMods.winHeal > 0) {
    const heal = Math.round(run.stats.maxhp * run.perkMods.winHeal);
    if (heal > 0) { run.stats.hp = clamp(run.stats.hp + heal, 0, run.stats.maxhp); updateBattleDynamic(); }
  }
  if (battle.kind === 'boss') {
    battleLog(`🏆 ล้ม ${run.boss.name} สำเร็จ! RUN COMPLETE!`);
    run.bossFought = true;
    finishBattleBanner('VICTORY');
    BLH._finishTimer = setTimeout(() => runEnd('boss'), 900);
    return;
  }

  if (battle.kind === 'elite_event') {
    // Elite Event victory — รันต่อ + รางวัล gear (elite context) + Loop Zeny
    battleLog(`⭐ Elite Event ชนะ! ยอดเยี่ยม!`);
    if (battle.cellId && run.cells[battle.cellId]) run.cells[battle.cellId].enemy = null;
    if (battle.cellId && run.monsterTiles && run.monsterTiles[battle.cellId]) {
      run.monsterTiles[battle.cellId] = [];
    }
    if (run.traitMods && run.traitMods.quickStep > 0 && !run._quickStepActive) {
      run._quickStepActive = true; recomputeStats(run);
    }
    const eg = makeGear(run, { enemyRole: 'elite' });
    run.lootBag.push(eg);
    const eSalvLogs = enforceBagCap(run);
    const eslot = GEAR_SLOTS.find(s => s.id === eg.slot);
    battleLog(`🎁 Elite ลูท: ${eslot ? eslot.name : ''} ${gearLabelText(eg)}`);
    eSalvLogs.forEach(l => battleLog(l));
    run.mods.zenyBonus += BAL.ELITE_EVENT_ZENY;
    battleLog(`⭐ +${BAL.ELITE_EVENT_ZENY} Loop Zeny โบนัส Elite Event!`);
    finishBattleBanner('VICTORY');
    BLH._finishTimer = setTimeout(() => {
      BLH._finishTimer = null;
      if (!BLH.run || BLH.run.ended) return;
      closeBattle(); renderBoard(); updateHUD(); setPhase('walking'); scheduleStep(350); startCycleTimer();
    }, 1100);
    return;
  }

  if (battle.kind === 'mythic_event') {
    // Mythic Event victory — รันต่อ + รางวัล gear คุณภาพสูง (elite+treasure) + Loop Zeny สูง
    battleLog(`💎 Mythic Event ชนะ! น่าทึ่งมาก!`);
    if (battle.cellId && run.cells[battle.cellId]) run.cells[battle.cellId].enemy = null;
    if (battle.cellId && run.monsterTiles && run.monsterTiles[battle.cellId]) {
      run.monsterTiles[battle.cellId] = [];
    }
    if (run.traitMods && run.traitMods.quickStep > 0 && !run._quickStepActive) {
      run._quickStepActive = true; recomputeStats(run);
    }
    const mg = makeGear(run, { enemyRole: 'elite', treasure: true }); // Elite+Treasure = prefer Epic+
    run.lootBag.push(mg);
    const mSalvLogs = enforceBagCap(run);
    const mslot = GEAR_SLOTS.find(s => s.id === mg.slot);
    battleLog(`💎 Mythic ลูท: ${mslot ? mslot.name : ''} ${gearLabelText(mg)}`);
    mSalvLogs.forEach(l => battleLog(l));
    run.mods.zenyBonus += BAL.MYTHIC_EVENT_ZENY;
    battleLog(`💎 +${BAL.MYTHIC_EVENT_ZENY} Loop Zeny โบนัส Mythic Event!`);
    finishBattleBanner('VICTORY');
    BLH._finishTimer = setTimeout(() => {
      BLH._finishTimer = null;
      if (!BLH.run || BLH.run.ended) return;
      closeBattle(); renderBoard(); updateHUD(); setPhase('walking'); scheduleStep(350); startCycleTimer();
    }, 1100);
    return;
  }

  if (battle.kind === 'terrain_boss') {
    // Terrain boss defeated — รันต่อ (ไม่ runEnd) + ลบ boss terrain + รางวัลอย่างดี
    battleLog(`🏆 Terrain Boss ล้มลง! ดินแดนอันตรายสงบแล้ว`);
    run.bossTerrainCell = null;
    run.nextBossTerrainThreshold += BAL.BOSS_TERRAIN_THRESHOLD_BASE;
    // เคลียร์ศัตรูบนช่อง trigger — กันต่อสู้ซ้ำถ้า rc.enemy หรือ natural monster ยังอยู่
    if (battle.cellId && run.cells[battle.cellId]) run.cells[battle.cellId].enemy = null;
    if (battle.cellId && run.monsterTiles && run.monsterTiles[battle.cellId]) {
      run.monsterTiles[battle.cellId] = [];
    }
    BLH.save.stats.bossKills = (BLH.save.stats.bossKills || 0) + 1;
    // รางวัล: gear อย่างดี (guaranteed) + Loop Zeny
    const tg = makeGear(run, { enemyRole: 'elite', treasure: true });
    run.lootBag.push(tg);
    const salvLogs = enforceBagCap(run);
    const tslot = GEAR_SLOTS.find(s => s.id === tg.slot);
    battleLog(`🎁 ลูทอย่างดี: ${tslot ? tslot.name : ''} ${gearLabelText(tg)}`);
    salvLogs.forEach(l => battleLog(l));
    const tBonus = BAL.TERRAIN_BOSS_ZENY;
    run.mods.zenyBonus += tBonus;
    battleLog(`💰 +${tBonus} Loop Zeny โบนัส Boss Terrain!`);
    finishBattleBanner('VICTORY');
    BLH._finishTimer = setTimeout(() => {
      BLH._finishTimer = null;
      if (!BLH.run || BLH.run.ended) return;
      closeBattle();
      renderBoard();
      updateHUD();
      setPhase('walking');
      scheduleStep(350);
      startCycleTimer();
    }, 1100);
    return;
  }

  // normal win — เคลียร์ศัตรูบนช่อง + ดรอป (รวมเอฟเฟกต์เฉพาะช่อง)
  if (battle.cellId && run.cells[battle.cellId]) run.cells[battle.cellId].enemy = null;
  // เคลียร์ natural monster stack (ป้องกัน re-trigger ถ้ายังมีเหลือจากการ merge)
  if (battle.cellId && run.monsterTiles && run.monsterTiles[battle.cellId]) {
    run.monsterTiles[battle.cellId] = [];
  }
  // Quick Step (trait): ชนะไฟต์แล้ว ASPD เพิ่มจนจบลูป
  if (run.traitMods && run.traitMods.quickStep > 0 && !run._quickStepActive) {
    run._quickStepActive = true; recomputeStats(run);
  }
  // LOCAL DANGER reward: Loop Zeny โบนัส (ปริมาณ) ตาม danger ของช่องนี้
  if (battle.zenyMult > 1) {
    const bonus = Math.round(BAL.CASHOUT_PER_LOOP * (battle.zenyMult - 1));
    if (bonus > 0) { run.mods.zenyBonus += bonus; battleLog(`⚠️ Danger โบนัส +${bonus} Zeny`); }
  }
  const enemyRole = battle.enemies[0] && battle.enemies[0].role;
  // danger gear-drop bonus = โอกาสดรอป (ปริมาณ) เท่านั้น — ไม่ส่งต่อให้ tier/rarity
  const drops = rollDrops(run, battle.cellFx, { enemyRole, gearDropBonus: battle.gearDropBonus || 0 });
  drops.forEach(d => battleLog(d));
  finishBattleBanner('WIN');
  BLH._finishTimer = setTimeout(() => {
    BLH._finishTimer = null;
    if (!BLH.run || BLH.run.ended) return;   // กันกรณีออกจากรันระหว่างหน่วงเวลา
    closeBattle();
    renderBoard();
    updateHUD();
    setPhase('walking');
    scheduleStep(350);
    startCycleTimer();   // เริ่ม cycle timer ต่อหลังชนะ
  }, drops.length ? 1100 : 700);
}

function rollDrops(run, fx = EMPTY_CELL_FX, ctx = {}) {
  const out = [];
  const tr = run.traitMods || {};
  // pack_howl: ซีนี่โบนัสเมื่อชนะบนช่องนี้ (สะสมเข้า run.mods.zenyBonus)
  if (fx.zenyBonus) run.mods.zenyBonus += fx.zenyBonus;
  // gear DROP roll (charm DROP stat) → โอกาสลูท/ซีนี่เพิ่ม
  const dropBonus = run.stats.dropBonus || 0;
  // gear (+lootBonus เฉพาะช่อง + Lucky Find trait + local danger gear-drop bonus)
  //   danger เพิ่ม "โอกาสดรอป" เท่านั้น — ไม่ส่งต่อให้ makeGear (tier/rarity คงเดิม)
  const chance = BAL.BASE_LOOT_CHANCE + upgValue('lootChance') + run.mods.lootBonus + (fx.lootBonus || 0) + dropBonus + (tr.luckyFind || 0) + (ctx.gearDropBonus || 0);
  if (Math.random() < chance) {
    const g = makeGear(run, { enemyRole: ctx.enemyRole, treasure: ctx.treasure });
    run.lootBag.push(g);                                // เพิ่มของใหม่ก่อน
    const slot = GEAR_SLOTS.find(s => s.id === g.slot);
    out.push(`🎁 ลูท: ${slot.name} ${gearLabelText(g)}`);
    enforceBagCap(run).forEach(l => out.push(l));       // กระเป๋าเต็ม → salvage ตัวเก่าสุด (40%)
  }
  // map card (โอกาสเล็ก + Card Sense trait) — stack ตามชนิด; มือเต็มจะ overflow → Zeny เอง
  if (Math.random() < 0.22 + (tr.cardSense || 0)) {
    const id = pick(MAP_CARDS).id;
    addCardToHand(run, id);
    out.push(`🃏 ได้การ์ดแผนที่: ${MAP_CARD_BY_ID[id].name}`);
  }
  // boss signal (+bossSignalDropBonus เฉพาะช่อง เช่น blood_track)
  // pacing: เริ่ม loop 8+ แล้วค่อย ๆ เพิ่มโอกาส → ปกติได้ราว loop 12–18
  if (!run.bossSignalObtained && run.loop >= BAL.BOSS_SIGNAL_MIN_LOOP) {
    const ramp = BAL.BOSS_SIGNAL_RAMP * (run.loop - BAL.BOSS_SIGNAL_MIN_LOOP + 1);
    const sigChance = ramp + run.mods.bossSignalDropBonus + (fx.bossSignalDropBonus || 0);
    if (Math.random() < sigChance) {
      run.bossSignalObtained = true;
      out.push(`📡 ได้ BOSS SIGNAL! ไปวางที่ Camp เพื่อเรียกบอส`);
    }
  }
  return out;
}

function gearLabelText(g) {
  const rar = rarityOf(g);
  const tr = gearTraitsText(g);
  return `[T${g.tier} ${rar.name}] ${gearStatsText(g)}${tr ? ' ✦' + tr : ''}`;
}

// ── gear generation (tier × rarity × traits, run-only) ──
// weighted pick จาก map { key: weight }
function weightedPick(weights) {
  const entries = Object.entries(weights).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return entries.length ? entries[0][0] : null;
  let r = Math.random() * total;
  for (const [k, v] of entries) { if ((r -= v) < 0) return k; }
  return entries[entries.length - 1][0];
}
function upgradeRarity(id) {
  const cur = GEAR_RARITY_BY_ID[id];
  const next = GEAR_RARITIES.find(r => r.rank === cur.rank + 1);
  return next ? next.id : id;
}

// tier = ความลึกลูป + อิทธิพลศัตรู + Arena Training higher-tier + treasure terrain
function rollGearTier(run, ctx = {}) {
  let tier = run.loop <= 3 ? 1 : run.loop <= 7 ? 2 : run.loop <= 12 ? 3 : 4;
  let bump = 0;
  const role = ctx.enemyRole;
  if (role === 'fast')       { if (Math.random() < 0.25) bump += 1; }  // Fighter: small tier boost
  else if (role === 'elite') { if (Math.random() < 0.70) bump += 1; }  // Elite: strong tier boost
  if (ctx.treasure) bump += 1;                                          // Treasure Fight: strong tier boost
  if (Math.random() < upgValue('higherTier')) bump += 1;               // Arena Training
  bump += run.mods.lootTierBump || 0;                                  // treasure terrain card
  return clamp(tier + bump, 1, 4);
}

// rarity = น้ำหนักตาม tier + boost ของ Elite/Treasure (เลื่อนขึ้น 1 ขั้นแบบมีโอกาส)
function rollGearRarity(tier, ctx = {}) {
  let id = weightedPick(RARITY_WEIGHTS[tier] || RARITY_WEIGHTS[1]);
  let upChance = 0;
  if (ctx.enemyRole === 'elite') upChance = 0.35;
  if (ctx.treasure) upChance = Math.max(upChance, 0.60);               // Treasure Fight: rarity boost
  if (upChance && Math.random() < upChance) id = upgradeRarity(id);
  return GEAR_RARITY_BY_ID[id] || GEAR_RARITIES[0];
}

// slot = สุ่ม + bias ของศัตรู (Guard→defensive jacket/boots, Cursed→charm)
function rollGearSlot(ctx = {}) {
  const role = ctx.enemyRole;
  if (role === 'tank'   && Math.random() < 0.55) return pick(['jacket', 'boots']);
  if (role === 'cursed' && Math.random() < 0.55) return 'charm';
  return pick(GEAR_SLOT_IDS);
}

// traits ตามตาราง tier→rarity (+ Cursed bias) — ไม่ซ้ำ trait บนชิ้นเดียว, จำกัดตาม tier
function rollGearTraits(tier, rarityId, ctx = {}) {
  const table = (TRAIT_CHANCE[tier] || {})[rarityId] || { t: 0, tt: 0 };
  const maxTraits = MAX_TRAITS_BY_TIER[tier] || 1;
  const cursedBonus = ctx.enemyRole === 'cursed' ? 0.15 : 0;   // Cursed → trait bias
  const pool = GEAR_TRAITS.map(t => t.id);
  const out = [];
  const pickDistinct = () => {
    const avail = pool.filter(id => !out.includes(id));
    return avail.length ? pick(avail) : null;
  };
  if (Math.random() < clamp(table.t + cursedBonus, 0, 1)) {
    const first = pickDistinct(); if (first) out.push(first);
    if (maxTraits >= 2 && Math.random() < clamp(table.tt + cursedBonus, 0, 1)) {
      const second = pickDistinct(); if (second) out.push(second);
    }
  }
  return out;
}

// ค่า roll ของ stat: tier range × (สัดส่วนคุณภาพตาม rarity) × scale; sub ใช้ factor 0.4–0.6
function rollStatValue(statKey, tierDef, rarity, factor) {
  const def = STAT_ROLLS[statKey] || { scale: 1 };
  const frac = clamp(rnd(rarity.rollMin, rarity.rollMax) * (factor || 1), 0, 1);
  const raw = (tierDef.statMin + frac * (tierDef.statMax - tierDef.statMin)) * (def.scale || 1);
  return Math.max(1, Math.round(raw));
}

// gear ใหม่: slot → tier → rarity → main(1) + sub(1) + traits(0–2)
function makeGear(run, ctx = {}) {
  const slot = rollGearSlot(ctx);
  const tier = rollGearTier(run, ctx);
  const tierDef = GEAR_TIER_BY_N[tier];
  const rarity = rollGearRarity(tier, ctx);
  const mainPool = GEAR_MAIN_POOLS[slot] || ['ATK'];
  const subPool  = GEAR_SUB_POOLS[slot]  || ['STR'];
  const mainKey = pick(mainPool);
  const subAvail = subPool.filter(k => k !== mainKey);   // sub ต้องไม่ซ้ำ main
  const subKey = pick(subAvail.length ? subAvail : subPool);
  const mk = (k, factor) => ({ k, v: rollStatValue(k, tierDef, rarity, factor), pct: !!(STAT_ROLLS[k] && STAT_ROLLS[k].pct) });
  const mainStat = mk(mainKey, 1);
  const subStat  = mk(subKey, rnd(0.40, 0.60));          // sub ~40–60% ของ tier fraction (อ่อนกว่า main)
  const traits = rollGearTraits(tier, rarity.id, ctx);
  return { slot, tier, rarity: rarity.id, mainStat, subStat, traits };
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
  startBattle({ kind: 'boss', enemies, cellId: null });
}

// ── battle popup: build DOM ครั้งเดียวต่อการสู้ (กัน flicker) ──
function buildBattleDOM() {
  const battle = BLH._battle, run = BLH.run;
  const el = q('blh-battle'); if (!el || !battle) return;
  const enemyCards = battle.enemies.map((e, i) => {
    const tag = e.role === 'boss' ? 'BOSS' : e.role === 'minion' ? 'MINION' : (ROLE_LABEL[e.role] || '');
    return `<div class="blh-bt-enemy ${e.role === 'boss' ? 'boss' : ''}" id="blh-bt-enemy-${i}">
      <div class="blh-bt-portrait"><img src="${e.img}" onerror="this.style.opacity=0"><div class="blh-bt-x">✖</div></div>
      <div class="blh-bt-name">${esc(e.name)} <span class="blh-bt-tag">${tag}</span></div>
      <div class="blh-bt-hpbar"><div class="blh-bt-hpfill enemy" id="blh-bt-efill-${i}"></div></div>
      <div class="blh-bt-hptext" id="blh-bt-etext-${i}"></div>
    </div>`;
  }).join('');
  // หมายเหตุ: innerHTML ถูกตั้งครั้งเดียวที่นี่ → entrance animation ของ .blh-bt-box เล่นรอบเดียว
  el.innerHTML = `
    <div class="blh-bt-box">
      <div class="blh-bt-titlebar" id="blh-bt-titlebar"></div>
      <div class="blh-bt-arena">
        <div class="blh-bt-hero">
          <div class="blh-bt-portrait hero"><img src="${run.hero.img}" onerror="this.style.opacity=0"></div>
          <div class="blh-bt-name">${esc(run.hero.name)}</div>
          <div class="blh-bt-hpbar"><div class="blh-bt-hpfill hero" id="blh-bt-hero-hpfill"></div></div>
          <div class="blh-bt-hptext" id="blh-bt-hero-hptext"></div>
          <div class="blh-bt-mini" id="blh-bt-hero-mini"></div>
        </div>
        <div class="blh-bt-vs">VS</div>
        <div class="blh-bt-enemies ${battle.enemies.length > 1 ? 'multi' : ''}">${enemyCards}</div>
      </div>
      <div class="blh-bt-log" id="blh-bt-log"></div>
      <div class="blh-bt-foot" id="blh-bt-foot"></div>
    </div>`;
  setBattleTitle();
  updateBattleDynamic();
  setBattleFooter();
}

function setBattleTitle() {
  const battle = BLH._battle, run = BLH.run; const tb = q('blh-bt-titlebar'); if (!tb || !battle) return;
  tb.className = 'blh-bt-titlebar';
  tb.textContent = `⚔️ ${battle.kind === 'boss' ? run.boss.name : battle.kind === 'terrain_boss' ? `👹 ${run.boss.name}` : 'BATTLE'}`;
}

// อัปเดตเฉพาะส่วนที่เปลี่ยน (HP bar/text + dead state) — ไม่แตะ DOM โครงสร้าง/animation
function updateBattleDynamic() {
  const battle = BLH._battle, run = BLH.run; if (!battle || !run) return;
  const hf = q('blh-bt-hero-hpfill'); if (hf) hf.style.width = clamp(run.stats.hp / run.stats.maxhp * 100, 0, 100) + '%';
  const ht = q('blh-bt-hero-hptext'); if (ht) ht.textContent = `❤️ ${Math.max(0, Math.round(run.stats.hp))}/${run.stats.maxhp}`;
  const hm = q('blh-bt-hero-mini'); if (hm) hm.textContent = `⚔️${run.stats.atk + (battle.cellFx ? battle.cellFx.atkBonus : 0)} 🛡️${run.stats.def}`;
  battle.enemies.forEach((e, i) => {
    const ef = q(`blh-bt-efill-${i}`); if (ef) ef.style.width = clamp(e.hp / e.maxhp * 100, 0, 100) + '%';
    const et = q(`blh-bt-etext-${i}`); if (et) et.textContent = `${Math.max(0, Math.round(e.hp))}/${e.maxhp}`;
    const card = q(`blh-bt-enemy-${i}`); if (card) card.classList.toggle('dead', e.hp <= 0);
  });
}

function setBattleFooter() {
  const battle = BLH._battle; const foot = q('blh-bt-foot'); if (!foot || !battle) return;
  if (battle.done) {
    const cont = battle._banner === 'WIN' || battle._banner === 'VICTORY';
    foot.innerHTML = `<button class="blh-primary" onclick="blh.dismissBattle()">${cont ? 'ดำเนินต่อ ▶' : 'ตกลง'}</button>`;
  } else {
    // ปุ่มความเร็ว (Pause/1x/2x) — ไม่ remount popup เมื่อกด
    foot.innerHTML = speedBtnHtml('wide') +
      (BLH.run && BLH.run.speed === 0 ? '<span class="blh-bt-paused">⏸ หยุดชั่วคราว</span>' : '');
  }
}

// จบการสู้: ตั้ง banner + footer (ครั้งเดียว) — ไม่ rebuild ทั้ง popup
function finishBattleBanner(banner) {
  const battle = BLH._battle; if (!battle) return;
  battle.done = true; battle._banner = banner;
  if (battle.timer) { clearTimeout(battle.timer); battle.timer = null; }
  updateBattleDynamic();
  const tb = q('blh-bt-titlebar');
  if (tb) { tb.className = 'blh-bt-titlebar banner ' + (banner === 'DEFEAT' ? 'lose' : 'win'); tb.textContent = banner; }
  setBattleFooter();
}

function battleLog(line) {
  const b = BLH._battle; if (!b) return;
  b.log.push(line);
  const logEl = q('blh-bt-log');
  if (logEl) {
    // append เท่านั้น (ไม่ rebuild log ทั้งก้อน) — กัน flicker/scroll reset
    logEl.insertAdjacentHTML('beforeend', `<div class="blh-bt-logline">${line}</div>`);
    while (logEl.childElementCount > 12) logEl.removeChild(logEl.firstElementChild);
    logEl.scrollTop = logEl.scrollHeight;
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
  // สเปก Cash Out: รวม loop + ขายเกียร์อัตโนมัติ (lootValue = สวม×2 + กระเป๋า) +
  //   แปลงการ์ดแผนที่ที่เหลือเป็น Loop Zeny เล็กน้อย + zeny โบนัสสะสม
  return Math.floor(
    run.loop * BAL.CASHOUT_PER_LOOP + lootValue(run) +
    handZeny(run) + run.mods.zenyBonus);
}
function gearWorth(g) {
  let v = 0;
  for (const r of [g.mainStat, g.subStat]) if (r) v += Math.abs(r.v);
  if (g.traits) v += g.traits.length * 6;   // trait เพิ่มมูลค่า cash out เล็กน้อย
  return v;
}
function lootValue(run) {
  let v = 0;
  for (const slot of GEAR_SLOT_IDS) { const g = run.gear[slot]; if (g) v += gearWorth(g) * 2; }
  run.lootBag.forEach(g => v += gearWorth(g));
  return v;
}

// ── GEAR BAG cap + overflow auto-salvage (run-only; ห้ามแตะเกียร์ที่สวมอยู่) ──
const BASE_BAG = 12;                                   // ช่องกระเป๋าลูทเริ่มต้น
const AUTO_SALVAGE_PCT = 0.40;                         // overflow คืน 40% ของมูลค่าขายมือ
function bagCap() { return BASE_BAG + upgValue('bagExpand'); }   // +2/level, สูงสุด 18
function autoSalvageValue(g) { return Math.floor(gearWorth(g) * AUTO_SALVAGE_PCT); }
// เมื่อกระเป๋าลูทเกิน cap → salvage ตัวเก่าสุด (index 0) ทีละชิ้น คืน 40% เป็น Loop Zeny
//   เฉพาะ lootBag เท่านั้น — เกียร์ที่สวม (run.gear) ไม่ยุ่ง
//   คืน array ของ log line (ให้ rollDrops เก็บ) + toast (เตือนแรงขึ้นถ้า Epic/Legendary)
function enforceBagCap(run) {
  const out = [];
  const cap = bagCap();
  while (run.lootBag.length > cap) {
    const removed = run.lootBag.shift();               // เก่าสุด (oldest → newest)
    const val = autoSalvageValue(removed);
    run.mods.zenyBonus += val;
    const slot = GEAR_SLOTS.find(s => s.id === removed.slot);
    const rar = rarityOf(removed);
    const high = rar.id === 'epic' || rar.id === 'legendary';
    const line = `${high ? '⚠️ เสียของหายาก!' : '🗑️ กระเป๋าเต็ม!'} แปลง T${removed.tier} ${rar.name} ${slot ? slot.name : ''} → +${val} Zeny`;
    out.push(line);
    blhToast(line);
  }
  return out;
}

function cashOut() {
  const run = BLH.run;
  if (run.perkPending > 0) { openPerkChoice(); return; }  // เลือกเพิร์กให้เสร็จก่อน
  const zeny = estCashOut(run);
  finishRun(zeny, 'cashout');
}

function runEnd(reason) {
  BLH._finishTimer = null;
  const run = BLH.run;
  if (!run || run.ended) return;             // กันรันถูกปิดไปแล้ว (ออกจากรัน/จบรันซ้ำ)
  let zeny, label;
  if (reason === 'boss') {
    zeny = Math.floor(run.loop * BAL.CASHOUT_PER_LOOP + lootValue(run) + run.mods.zenyBonus + BAL.BOSS_BONUS);
    BLH.save.stats.bossKills += 1;
    label = 'boss';
  } else { // dead — death recovery (สเปก: เก็บ 30% + Safe Retreat สูงสุด 50%)
    const recov = clamp(SPEC_BAL.DEATH_RECOVERY_BASE + upgValue('safeDeath'), 0, SPEC_BAL.DEATH_RECOVERY_CAP);
    zeny = Math.floor((run.loop * BAL.CASHOUT_PER_LOOP + lootValue(run) + run.mods.zenyBonus) * recov);
    label = 'dead';
  }
  finishRun(zeny, label);
}

function finishRun(zeny, reason) {
  const run = BLH.run;
  blhAbortTimers();
  closeBattle();
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
  panelTab, selectItem, clearSelection, selectGear, selectLoot, selectCard, selectTile,
  cycleSpeed, setSpeed,
  continueLoop, cashOut, placeSignal, abandonRun,
  equipLoot, unequip, sellLoot,
  startPlace, cancelPlace, placeAt,
  dismissBattle,
  choosePerk,
  setGrowthPlan,
});

// ── debug/test hooks — เปิดเฉพาะ dev/test (smoke) ไม่ expose ใน production ──
if (BLH_DEV) {
  blh.__test = {
    BLH, BLH_MAP, BLH_CELL_BY_ID,
    getNeighborCells, getAdjacentRoadCells, getCellEffectsForRoad,
    isPlaceable, validPlacementTargets, startBossFight, stepWalk,
    roadCellIds, updateBattleDynamic,
    // stat model + perks (Loop RPG Mode)
    HEROES, HERO_PERKS, STAT_CAPS, BASE_STAT_KEYS,
    deriveCombat, recomputeStats, makeGear, resolveAttack,
    checkPerkLoopTrigger, checkPerkBuildTrigger, grantPerkChoice,
    generatePerkOffer, openPerkChoice, choosePerk, remainingPerks,
    // hero passives + spec balance (Boss Loop Mode core)
    HERO_PASSIVES, SPEC_BAL, GEAR_SLOTS, fireSpecial, heroAct,
    // run EXP / level / auto-growth plan
    ENEMY_EXP, EXP_PRESETS, HERO_DEFAULT_ORDERS, HERO_DEFAULT_PLAN,
    expToNext, grantExp, getPlanOrder, autoAllocatePoints, setGrowthPlan,
    // gear tier + rarity + traits (run-only)
    GEAR_TIER_DEFS, GEAR_RARITIES, GEAR_RARITY_BY_ID, RARITY_WEIGHTS,
    GEAR_TRAITS, GEAR_TRAIT_BY_ID, TRAIT_CHANCE, MAX_TRAITS_BY_TIER,
    GEAR_MAIN_POOLS, GEAR_SUB_POOLS, STAT_ROLLS,
    rollGearTier, rollGearRarity, rollGearTraits, aggregateGear, aggregateTraits,
    // local danger (per-road, derived from placed tiles)
    MAP_CARDS, MAP_CARD_BY_ID, DANGER_BAL,
    cardDanger, localDangerForRoad, localDangerScaling,
    startBattle, makeEnemy,
    // map-card hand stacking (run-only)
    MAX_CARD_TYPES, CARD_KIND_ZENY, cardZenyValue, stackZeny, handZeny,
    addCardToHand, consumeCardFromHand, findHandStack, oldestHandCardId,
    // gear bag cap + overflow auto-salvage (run-only)
    BASE_BAG, AUTO_SALVAGE_PCT, bagCap, gearWorth, autoSalvageValue, enforceBagCap, lootValue,
    // natural monster spawn + cycle timer + boss terrain (new systems)
    BAL, NATURAL_MONSTERS,
    naturalMonsterCount, naturalCap, makeNaturalEnemy, spawnNaturalMonsters, cycleSpawnAttempt,
    startCycleTimer, stopCycleTimer, onCycleTick,
    checkBossTerrainSpawn, findBossTerrainCell, makeTerrainBossEnemies,
    // Elite/Mythic Road Events
    ELITE_EVENT_ENEMIES, MYTHIC_EVENT_ENEMIES,
    eliteEventUnlocked, mythicEventUnlocked,
    trySpawnEliteEvent, trySpawnMythicEvent,
    makeEliteEventEnemy, makeMythicEventEnemy,
    endBattle,
    // Monster map pixel sprites
    PIXEL_SPRITES, RANK_COLORS,
    monsterRankClass, monsterSpeciesClass, monsterSpeciesPattern,
    buildPixelSprite, monsterMapMarkup,
    strongestMonsterOnTile, renderBoard,
  };
}
