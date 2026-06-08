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
  // ── ROAD (วางบนช่องถนน — ผลเฉพาะช่องนั้น) ──
  { id: 'spawn_rift',  name: 'รอยแยกศัตรู', kind: 'road', icon: '🌀', accent: '#ff5577',
    desc: 'เสกศัตรูลงช่องถนนที่เลือกทันที + ลูทดีขึ้นบนช่องนั้น' },
  { id: 'pack_howl',   name: 'เสียงหอนฝูง', kind: 'road', icon: '🐺', accent: '#ff5577',
    desc: 'ศัตรูบนช่องถนนนี้แรงขึ้น แต่ดรอป Loop Zeny มากขึ้นเมื่อชนะบนช่องนี้' },
  { id: 'blood_track', name: 'รอยเลือด',    kind: 'road', icon: '🩸', accent: '#ff5577',
    desc: 'เพิ่มโอกาสดรอป Boss Signal เมื่อสู้บนช่องถนนนี้' },
  // ── ADJACENT (วางบนช่องเทอเรนติดถนน — ส่งผลเฉพาะช่องถนนข้างเคียง) ──
  { id: 'campfire',    name: 'กองไฟ',       kind: 'adjacent', icon: '🔥', accent: '#ffcc44',
    desc: 'ฟื้น HP +6 เมื่อเดินผ่านช่องถนนที่อยู่ติดกองไฟ' },
  { id: 'shrine',      name: 'ศาลเจ้า',     kind: 'adjacent', icon: '⛩️', accent: '#ffcc44',
    desc: 'ATK +2 ระหว่างสู้บนช่องถนนที่อยู่ติดศาลเจ้า' },
  { id: 'lucky_totem', name: 'โทเทมนำโชค',  kind: 'adjacent', icon: '🍀', accent: '#ffcc44',
    desc: 'โอกาสดรอปลูท +12% บนช่องถนนที่อยู่ติดโทเทม' },
  // ── TERRAIN (วางบนช่องเทอเรน — บัฟทั้งรอบรัน) ──
  { id: 'rock',        name: 'หินผา',       kind: 'terrain', icon: '🪨', accent: '#88ddaa',
    desc: 'DEF +3 ถาวรตลอดรอบรัน' },
  { id: 'thornfield',  name: 'ทุ่งหนาม',    kind: 'terrain', icon: '🌵', accent: '#88ddaa',
    desc: 'ศัตรูเสีย HP เริ่มต้น -15% แต่ฮีโร่ก็เจ็บ +1 ต่อตา' },
  { id: 'treasure',    name: 'ลานสมบัติ',   kind: 'terrain', icon: '💎', accent: '#88ddaa',
    desc: 'อัปเกรด tier ลูทขึ้น 1 ขั้นตลอดรอบรัน' },
];
const MAP_CARD_BY_ID = Object.fromEntries(MAP_CARDS.map(c => [c.id, c]));

// ════════════════════════════════════════════════════════════════════════════
// GRID MAP MODEL (data-driven, locked spec 7×9) — เส้นทางลูป + ช่องเทอเรน
// (source of truth = cell id)
// ────────────────────────────────────────────────────────────────────────────
// • grid 7 คอลัมน์ × 9 แถว
// • route = Camp + Road 16 = 17 ช่อง (วงรีเชื่อมต่อเต็มกว่าเดิม, camp ล่างกลาง)
// • ช่องที่เหลือทั้งหมด (non-road/non-camp) = terrain placement cell → ไม่มี
//   ช่องว่างเปล่า; เป็น "กระดานแผนที่" เต็มผืน
// • ฮีโร่เดินตาม route order เท่านั้น (เฉพาะ road/camp) — ไม่เหยียบ terrain
// ────────────────────────────────────────────────────────────────────────────
const BLH_GRID_W = 7, BLH_GRID_H = 9;
// route: Camp + 16 road (ทุกช่องติดกันแบบ orthogonal/diagonal → วงต่อเนื่อง)
const BLH_ROUTE_DEF = [
  { id: 'camp', row: 8, col: 3, type: 'camp', routeIndex: 0 },  // ล่างกลาง
  { id: 'r01',  row: 7, col: 4, type: 'road', routeIndex: 1 },
  { id: 'r02',  row: 6, col: 5, type: 'road', routeIndex: 2 },
  { id: 'r03',  row: 5, col: 5, type: 'road', routeIndex: 3 },
  { id: 'r04',  row: 4, col: 5, type: 'road', routeIndex: 4 },
  { id: 'r05',  row: 3, col: 5, type: 'road', routeIndex: 5 },
  { id: 'r06',  row: 2, col: 5, type: 'road', routeIndex: 6 },
  { id: 'r07',  row: 1, col: 4, type: 'road', routeIndex: 7 },
  { id: 'r08',  row: 1, col: 3, type: 'road', routeIndex: 8 },   // บนกลาง
  { id: 'r09',  row: 1, col: 2, type: 'road', routeIndex: 9 },
  { id: 'r10',  row: 2, col: 1, type: 'road', routeIndex: 10 },
  { id: 'r11',  row: 3, col: 1, type: 'road', routeIndex: 11 },
  { id: 'r12',  row: 4, col: 1, type: 'road', routeIndex: 12 },
  { id: 'r13',  row: 5, col: 1, type: 'road', routeIndex: 13 },
  { id: 'r14',  row: 6, col: 1, type: 'road', routeIndex: 14 },
  { id: 'r15',  row: 7, col: 2, type: 'road', routeIndex: 15 },
  { id: 'r16',  row: 7, col: 3, type: 'road', routeIndex: 16 },  // ล่างกลางซ้าย-camp
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
  return { gridWidth: BLH_GRID_W, gridHeight: BLH_GRID_H, cells, route: BLH_ROUTE_DEF.map(c => c.id) };
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
  // หมายเหตุ: ความยาวลูป = BLH_MAP.route.length (Camp + Road 12 = 13 ช่อง)
  BASE_LOOT_CHANCE: 0.45,
  BASE_SPAWN_CHANCE: 0.30,   // โอกาสเสกศัตรูในช่องว่างต่อ loop
  ENEMY_LOOP_SCALE: 0.17,    // ศัตรูแกร่งขึ้นต่อ loop
  BOSS_SIGNAL_MIN_LOOP: 4,   // เริ่มดรอปได้จริงราว loop 4+
  // pacing (1x = ช้า อ่านง่าย); 2x หาร 2; Pause = ไม่เดิน. ดู speedFactor()
  WALK_MS: 1150,             // ก้าวเดินต่อช่องที่ 1x (ช้าให้วางแผนทัน)
  BATTLE_MS: 950,            // จังหวะต่อรอบการสู้ที่ 1x (log อ่านทัน)
  BATTLE_OPEN_MS: 700,       // หน่วงก่อนรอบแรกหลังเปิด popup
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
  _finishTimer: null, // หน่วงเวลาเปลี่ยนหน้า/จบรันหลังการสู้ (cancel ได้ผ่าน blhAbortTimers)
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
    base: { maxhp: ss.maxhp, atk: ss.atk, def: ss.def },
    stats: { hp: ss.maxhp, maxhp: ss.maxhp, atk: ss.atk, def: ss.def },
    gear: { glove: null, jacket: null, boots: null, charm: null },
    lootBag: [],
    hand: [],
    cells,                  // { [cellId]: { id, type, enemy, placedCardId } }
    placedCells: {},        // { [cellId]: { cardId, cardType, placedLoop } } — บันทึกการวาง
    mods: {
      // global run buffs (เฉพาะ terrain card + upgrade) — adjacent/road card เป็น cell-based
      atk: 0, def: 0, maxhp: 0,
      lootBonus: 0, enemyHpMult: 1, enemyDmgBonus: 0,
      lootTierBump: 0, stepHeal: 0, thornSelf: 0,
      zenyBonus: 0, bossSignalDropBonus: 0,
    },
    bossSignalObtained: false,
    bossSignalPlaced: false,
    bossFought: false,
    reviveUsed: false,
    speed: 1,               // 0 = Pause, 1 = 1x (ช้า, default), 2 = 2x
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
  };
}

// ── recompute hero stats (terrain card → run.mods global; adjacent/road → cell-based) ──
function applyMods(run) {
  // terrain card (rock/thornfield/treasure) บวกเข้า run.mods ตอนวางแล้ว — ที่นี่แค่ recompute
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
    <div class="blh-board-wrap"><div class="blh-board" id="blh-board"></div></div>
    <div class="blh-panel" id="blh-panel"></div>
    <div class="blh-overlay blh-battle-overlay" id="blh-battle" style="display:none"></div>
    <div class="blh-toast" id="blh-toast"></div>
  `);
  renderBoard();
  renderPanel();
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
    // Pause: หยุดทั้ง walking + battle
    if (BLH._walkTimer) { clearTimeout(BLH._walkTimer); BLH._walkTimer = null; BLH._walkPendingMs = BLH._walkPendingMs ?? BAL.WALK_MS; }
    if (battle && battle.timer) { clearTimeout(battle.timer); battle.timer = null; battle._pending = !battle.done; }
  } else {
    // resume เฉพาะลูปที่กำลัง active
    if (battle && !battle.done && battle._pending) { battle._pending = false; scheduleBattleTick(60); }
    else if (run.phase === 'walking' && BLH._walkPendingMs != null) { const ms = BLH._walkPendingMs; BLH._walkPendingMs = null; scheduleStep(ms); }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PERSISTENT BOTTOM PANEL (Stats / Gear / Loot / Map / Plan) — มองเห็นตลอดรัน
// ════════════════════════════════════════════════════════════════════════════
let _panelTab = 'stats';
const PANEL_TABS = [
  ['stats', '📊', 'STATS'], ['gear', '🧤', 'GEAR'], ['loot', '🎒', 'LOOT'],
  ['map', '🗺️', 'MAP'],
];
function panelTab(tab) { _panelTab = tab || 'stats'; renderPanel(); }
// segmented Pause / 1x / 2x — Pause=วางแผน, 1x=ต่อ, 2x=เร็ว (ถาวรเหนือแท็บ)
function speedSegHtml() {
  const s = BLH.run ? BLH.run.speed : 1;
  return [[0, '⏸ Pause'], [1, '▶ 1x'], [2, '⏩ 2x']].map(([v, l]) =>
    `<button class="blh-seg ${s === v ? 'on' : ''} ${v === 0 ? 'pause' : ''}" onclick="blh.setSpeed(${v})">${l}</button>`).join('');
}
// แถบสถานะ/แอ็กชัน (สูงคงที่) — ที่ Camp โชว์ Cash Out/Signal; เดิน=สถานะ; +Abandon เล็ก
function panelStatusBar(run) {
  const aband = `<button class="blh-aband" onclick="blh.abandonRun()" title="ยอมแพ้ / ออกจากรัน">✕</button>`;
  if (run.phase === 'camp') {
    const canSignal = run.bossSignalObtained && !run.bossSignalPlaced;
    return `
      <button class="blh-status-btn cash" onclick="blh.cashOut()">💰 CASH OUT ~🔷${fmt(estCashOut(run))}</button>
      ${canSignal ? `<button class="blh-status-btn sig" onclick="blh.placeSignal()">📡 SIGNAL</button>` : ''}
      ${aband}`;
  }
  const sig = run.bossSignalPlaced ? '📡 บอสพร้อม'
            : run.bossSignalObtained ? '📡 มี Signal'
            : `📡 loop ${BAL.BOSS_SIGNAL_MIN_LOOP}+`;
  const state = run.speed === 0 ? '⏸ วางแผน' : '🚶 เดิน';
  return `<div class="blh-status-text">${state} • LOOP ${run.loop} • 🔷~${fmt(estCashOut(run))} • ${sig}</div>${aband}`;
}
function renderPanel() {
  const run = BLH.run; if (!run) return;
  const el = q('blh-panel'); if (!el) return;
  const tabBtns = PANEL_TABS.map(([id, icon, label]) =>
    `<button class="blh-ptab ${id === _panelTab ? 'on' : ''}" onclick="blh.panelTab('${id}')">
      <span class="blh-ptab-icon">${icon}</span><span class="blh-ptab-label">${label}</span></button>`).join('');
  // โครงสูงคงที่: speed row → status/camp bar → tab row → body (เลื่อนภายใน)
  el.innerHTML = `
    <div class="blh-panel-speed">${speedSegHtml()}</div>
    <div class="blh-panel-status ${run.phase === 'camp' ? 'camp' : ''}">${panelStatusBar(run)}</div>
    <div class="blh-panel-tabs">${tabBtns}</div>
    <div class="blh-panel-body" id="blh-panel-body">${renderPanelBody()}</div>`;
}
function renderPanelBody() {
  const run = BLH.run;
  const locked = run.phase === 'battle';   // gear/terrain ใช้ไม่ได้ระหว่างสู้
  switch (_panelTab) {
    case 'stats': return panelStats(run);
    case 'gear':  return planGear(run, locked);
    case 'loot':  return planLoot(run, locked);
    case 'map':   return panelMap(run, locked);
  }
  return '';
}

// แผง STATS — สรุปฮีโร่ + เกียร์ย่อ + traits + speed/loop
function panelStats(run) {
  const traits = ['crit', 'lifesteal', 'thorns', 'guard'].map(t => ({ t, n: heroTraitValue(t) })).filter(x => x.n > 0);
  const traitLabel = { crit: 'คริต', lifesteal: 'ดูดเลือด', thorns: 'สะท้อน', guard: 'การ์ด' };
  const traitLine = traits.length
    ? `<div class="blh-statline dim">${traits.map(x => `${traitLabel[x.t]}×${x.n}`).join(' • ')}</div>` : '';
  return `
    <div class="blh-statbox">
      <div class="blh-statbox-portrait"><img src="${run.hero.img}" onerror="this.style.opacity=0"></div>
      <div class="blh-statbox-info">
        <div class="blh-statbox-name">${esc(run.hero.name)} <span class="blh-statbox-role">${esc(run.hero.role)}</span></div>
        <div class="blh-statline">❤️ HP <b>${Math.round(run.stats.hp)}/${run.stats.maxhp}</b> &nbsp; ⚔️ ATK <b>${run.stats.atk}</b> &nbsp; 🛡️ DEF <b>${run.stats.def}</b></div>
        <div class="blh-statline">🔄 LOOP <b>${run.loop}</b> • 🎒 <b>${run.lootBag.length}</b> • 🃏 <b>${run.hand.length}</b> • ${speedLabel()}</div>
        ${traitLine}
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

// แผง MAP — การ์ดแผนที่/เทอเรน + สถานะการวาง + ข้อมูลแผนที่
function panelMap(run, locked) {
  const placing = run._placing != null;
  const head = placing
    ? `<div class="blh-cards-note hi">เลือกช่องที่ไฮไลต์บนแผนที่ • <button class="blh-mini-btn ghost" onclick="blh.cancelPlace()">✖ ยกเลิก</button></div>`
    : locked
      ? `<div class="blh-cards-note dim">🔒 วางการ์ดไม่ได้ระหว่างสู้</div>`
      : `<div class="blh-cards-note">แตะ “วาง” แล้วเลือกช่องที่ไฮไลต์ — เทอเรนคือหัวใจเสี่ยง/รางวัล</div>`;
  return head + planCards(run, locked) + planMap(run);
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
    if (def.type === 'camp') inner = '<div class="blh-cell-icon">⛺</div>';
    else if (rc.enemy) inner = `<div class="blh-cell-enemy"><img src="${rc.enemy.img}" onerror="this.style.display='none'"></div>`;
    if (occupied) {
      const c = MAP_CARD_BY_ID[rc.placedCardId];
      inner += `<div class="blh-cell-marker" title="${esc(c.name)}">${c.icon}</div>`;
    }
    const cls = ['blh-tile', def.type];     // เช่น "blh-tile road" / "blh-tile terrain"
    if (placeable) cls.push('placeable');
    if (occupied) cls.push('occupied');
    if (def.type === 'terrain' && !occupied) cls.push('empty');
    html += `<div class="${cls.join(' ')}" data-celltype="${def.type}" data-cellid="${def.id}"
      style="grid-column:${def.col + 1};grid-row:${def.row + 1}"
      ${placeable ? `onclick="blh.placeAt('${def.id}')"` : ''}>${inner}</div>`;
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
  run.speed = 0;       // auto-pause: เข้าโหมดวางแผน (Pause highlight) — กด ▶1x เพื่อ Continue
  renderBoard();
  updateHUD();
  _panelTab = 'map';   // ถึง Camp → เปิดแท็บ MAP เพื่อวางเทอเรน; Cash Out/Signal อยู่ในแถบสถานะ
  setPhase('camp');    // setPhase → renderPanel (auto-pause: ไม่ scheduleStep จนกด ▶1x)
  blhToast(`⛺ ถึง Camp — LOOP ${run.loop} • กด ▶1x เพื่อเดินต่อ`);
}

function continueLoop() {
  const run = BLH.run; if (!run) return;
  if (run.speed === 0) run.speed = 1;        // ถ้าค้าง Pause ไว้ ให้กลับมาเดิน
  _panelTab = 'map';
  setPhase('walking');                        // renderPanel
  scheduleStep(450);
}

function placeSignal() {
  const run = BLH.run;
  run.bossSignalPlaced = true;
  blhToast('📡 วาง Boss Signal แล้ว — รอบหน้าที่ถึง Camp บอสจะปรากฏ!');
  updateHUD();
  renderPanel();
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

function planGear(run, locked) {
  const slots = GEAR_SLOTS.map(s => {
    const g = run.gear[s.id];
    const btn = g
      ? (locked ? '<span class="blh-mini-lock">🔒</span>' : `<button class="blh-mini-btn" onclick="blh.unequip('${s.id}')">ถอด</button>`)
      : '';
    return `<div class="blh-gear-slot">
      <div class="blh-gear-slot-icon">${s.icon}</div>
      <div class="blh-gear-slot-main">
        <div class="blh-gear-slot-name">${s.name}</div>
        <div class="blh-gear-slot-val">${g ? gearFull(g) : '<span class="dim">— ว่าง —</span>'}</div>
      </div>
      ${btn}
    </div>`;
  }).join('');
  const note = locked ? '🔒 เปลี่ยนเกียร์ไม่ได้ระหว่างสู้' : 'เกียร์ใช้ได้เฉพาะรอบรันนี้ — จบรันหายหมด';
  return `<div class="blh-gear-note">${note}</div>
    <div class="blh-gear-slots">${slots}</div>`;
}

function planLoot(run, locked) {
  if (!run.lootBag.length)
    return `<div class="blh-empty">🎒 กระเป๋าลูทว่าง — ล้มศัตรูเพื่อเก็บเกียร์</div>`;
  const items = run.lootBag.map((g, i) => {
    const slot = GEAR_SLOTS.find(s => s.id === g.slot);
    const btn = locked ? '<span class="blh-mini-lock">🔒</span>' : `<button class="blh-mini-btn" onclick="blh.equipLoot(${i})">สวม</button>`;
    return `<div class="blh-loot-item">
      <div class="blh-loot-icon">${slot.icon}</div>
      <div class="blh-loot-main">
        <div class="blh-loot-name">${slot.name}</div>
        <div class="blh-loot-val">${gearFull(g)}</div>
      </div>
      ${btn}
    </div>`;
  }).join('');
  return `${locked ? '<div class="blh-gear-note">🔒 สวมเกียร์ไม่ได้ระหว่างสู้</div>' : ''}<div class="blh-loot-list">${items}</div>`;
}

function planCards(run, locked) {
  if (!run.hand.length)
    return `<div class="blh-empty">🃏 ไม่มีการ์ดแผนที่ — เก็บได้จากการล้มศัตรู</div>`;
  const cards = run.hand.map((id, i) => {
    const c = MAP_CARD_BY_ID[id];
    const kindLabel = { road: 'ROAD', adjacent: 'ADJACENT', terrain: 'TERRAIN' }[c.kind];
    const btn = locked ? '<span class="blh-mini-lock">🔒</span>' : `<button class="blh-mini-btn" onclick="blh.startPlace(${i})">วาง</button>`;
    return `<div class="blh-mapcard" style="--accent:${c.accent}">
      <div class="blh-mapcard-icon">${c.icon}</div>
      <div class="blh-mapcard-main">
        <div class="blh-mapcard-name">${esc(c.name)} <span class="blh-mapcard-kind">${kindLabel}</span></div>
        <div class="blh-mapcard-desc">${esc(c.desc)}</div>
      </div>
      ${btn}
    </div>`;
  }).join('');
  return `<div class="blh-mapcard-list">${cards}</div>`;
}

function planMap(run) {
  const roadCount = BLH_MAP.cells.filter(c => c.type === 'road').length;
  const enemies = BLH_MAP.cells.filter(c => c.type === 'road' && run.cells[c.id].enemy).length;
  const placed = Object.keys(run.placedCells).length;
  return `<div class="blh-mapinfo">
      <span>🗺️ ถนน <b>${roadCount}</b>+Camp</span>
      <span>👾 ศัตรู <b>${enemies}</b></span>
      <span>🌵 วางแล้ว <b>${placed}</b></span>
    </div>`;
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
  updateHUD();
  renderPanel();
}
function unequip(slot) {
  const run = BLH.run;
  if (run.phase === 'battle') { blhToast('🔒 เปลี่ยนเกียร์ไม่ได้ระหว่างสู้'); return; }
  const g = run.gear[slot];
  if (!g) return;
  run.gear[slot] = null;
  run.lootBag.push(g);
  recomputeStats(run);
  updateHUD();
  renderPanel();
}

// ── map card placement (grid-cell based) ──
// คืน cell id ที่วางการ์ดใบนี้ได้ (ใช้ทั้ง highlight และ validation)
function validPlacementTargets(cardId) {
  return BLH_MAP.cells.filter(c => isPlaceable(c.id, cardId)).map(c => c.id);
}
function startPlace(handIdx) {
  const run = BLH.run;
  if (run.phase === 'battle') { blhToast('🔒 วางการ์ดไม่ได้ระหว่างสู้'); return; }
  const id = run.hand[handIdx];
  if (id == null) return;
  const targets = validPlacementTargets(id);
  if (!targets.length) {
    // feedback ชัดเจนเมื่อไม่มีช่องที่วางได้
    const c = MAP_CARD_BY_ID[id];
    const where = c.kind === 'road' ? 'ช่องถนนว่าง'
                : c.kind === 'adjacent' ? 'ช่องเทอเรนที่ติดถนนและยังว่าง'
                : 'ช่องเทอเรนที่ว่าง';
    blhToast(`ไม่มี${where}ให้วาง ${c.name}`);
    return;
  }
  run._placing = id;
  run._placingHand = handIdx;
  _panelTab = 'map';
  blhToast('แตะช่องที่ไฮไลต์บนแผนที่เพื่อวาง');
  renderBoard();
  renderPanel();         // panel แสดงปุ่มยกเลิก + ไฮไลต์ช่องบน board
}
function cancelPlace() {
  const run = BLH.run;
  run._placing = null; run._placingHand = null;
  _panelTab = 'map';
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
  if (cardId == null || !isPlaceable(cellId, cardId)) return;
  const c = MAP_CARD_BY_ID[cardId];
  applyCardEffect(c, run, cellId);
  // บันทึกการวาง (source of truth ตาม cell id)
  run.cells[cellId].placedCardId = c.id;
  run.placedCells[cellId] = { cardId: c.id, cardType: c.kind, placedLoop: run.loop };
  // เอาการ์ดออกจากมือ
  const hi = run.hand.indexOf(cardId);
  if (hi >= 0) run.hand.splice(hi, 1);
  run._placing = null; run._placingHand = null;
  recomputeStats(run);
  renderBoard();
  updateHUD();
  blhToast(`วาง ${c.name} แล้ว`);
  _panelTab = 'map';
  renderPanel();         // อยู่แท็บ MAP เพื่อวางต่อ
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
}

// ════════════════════════════════════════════════════════════════════════════
// BATTLE (auto, popup, text RPG log)
// ════════════════════════════════════════════════════════════════════════════
function startBattle(ctx) {
  const run = BLH.run;
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
  };
  // pack_howl: ศัตรูบนช่องนี้แรงขึ้น (apply ครั้งเดียวตอนเริ่มสู้)
  if (cellFx.enemyDmgBonus) ctx.enemies.forEach(e => { e.atk += cellFx.enemyDmgBonus; });
  BLH._battle = battle;
  q('blh-battle').style.display = 'flex';
  buildBattleDOM();             // สร้าง popup ครั้งเดียว — entrance animation เล่นรอบเดียว
  battleLog(ctx.kind === 'boss'
    ? `⚔️ ${run.boss.name} ปรากฏตัวพร้อมลูกสมุน 2 ตัว!`
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
  if (!battle || battle.done || battle.paused || !run || run.speed === 0) return;
  battle.round++;

  // ── hero turn ── (+ATK เฉพาะช่อง เช่น shrine ที่ติดช่องถนนนี้)
  const hero = { isHero: true, atk: run.stats.atk + (battle.cellFx ? battle.cellFx.atkBonus : 0) };
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
    // safer death — ฟื้นคืนชีพ 1 ครั้ง/รัน ถ้ามี upgrade
    const reviveLv = upgLevel('safeDeath');
    if (reviveLv > 0 && !run.reviveUsed) {
      run.reviveUsed = true;
      run.stats.hp = Math.round(run.stats.maxhp * upgValue('safeDeath'));
      battleLog(`🪽 SAFER DEATH! ฟื้นคืนชีพที่ HP ${Math.round(run.stats.hp)}`);
      updateBattleDynamic();
      updateHUD();
      battle.done = false;
      scheduleBattleTick(BAL.BATTLE_MS + 200);
      return;
    }
    battleLog('☠️ ฮีโร่ล้มลง...');
    finishBattleBanner('DEFEAT');
    BLH._finishTimer = setTimeout(() => runEnd('dead'), 800);
    return;
  }

  // ── WIN ──
  if (battle.kind === 'boss') {
    battleLog(`🏆 ล้ม ${run.boss.name} สำเร็จ! RUN COMPLETE!`);
    run.bossFought = true;
    finishBattleBanner('VICTORY');
    BLH._finishTimer = setTimeout(() => runEnd('boss'), 900);
    return;
  }

  // normal win — เคลียร์ศัตรูบนช่อง + ดรอป (รวมเอฟเฟกต์เฉพาะช่อง)
  if (battle.cellId && run.cells[battle.cellId]) run.cells[battle.cellId].enemy = null;
  const drops = rollDrops(run, battle.cellFx);
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
  }, drops.length ? 1100 : 700);
}

function rollDrops(run, fx = EMPTY_CELL_FX) {
  const out = [];
  // pack_howl: ซีนี่โบนัสเมื่อชนะบนช่องนี้ (สะสมเข้า run.mods.zenyBonus)
  if (fx.zenyBonus) run.mods.zenyBonus += fx.zenyBonus;
  // gear (+lootBonus เฉพาะช่อง เช่น lucky_totem ข้างเคียง / spawn_rift บนช่อง)
  const chance = BAL.BASE_LOOT_CHANCE + upgValue('lootChance') + run.mods.lootBonus + (fx.lootBonus || 0);
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
  // boss signal (+bossSignalDropBonus เฉพาะช่อง เช่น blood_track)
  if (!run.bossSignalObtained && run.loop >= BAL.BOSS_SIGNAL_MIN_LOOP) {
    const sigChance = 0.32 + run.mods.bossSignalDropBonus + (fx.bossSignalDropBonus || 0) + (run.loop >= 7 ? 1 : 0);
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
  tb.textContent = `⚔️ ${battle.kind === 'boss' ? run.boss.name : 'BATTLE'}`;
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
  BLH._finishTimer = null;
  const run = BLH.run;
  if (!run || run.ended) return;             // กันรันถูกปิดไปแล้ว (ออกจากรัน/จบรันซ้ำ)
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
  panelTab, cycleSpeed, setSpeed,
  continueLoop, cashOut, placeSignal, abandonRun,
  equipLoot, unequip,
  startPlace, cancelPlace, placeAt,
  dismissBattle,
});

// ── debug/test hooks — เปิดเฉพาะ dev/test (smoke) ไม่ expose ใน production ──
if (BLH_DEV) {
  blh.__test = {
    BLH, BLH_MAP, BLH_CELL_BY_ID,
    getNeighborCells, getAdjacentRoadCells, getCellEffectsForRoad,
    isPlaceable, validPlacementTargets, startBossFight, stepWalk,
    roadCellIds, updateBattleDynamic,
  };
}
