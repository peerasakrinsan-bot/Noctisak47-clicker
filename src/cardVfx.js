// ── ELITE / MYTHIC CARD VFX LAYER (normal / clicker mode only) ───────────────
//
// A small, self-contained visual-feedback layer that gives every Elite and
// Mythic card a recognizable look when its real mechanic fires. It is purely
// cosmetic: it never reads or writes card logic, never changes balance, and is
// safe to call from anywhere — if a DOM target is missing it no-ops, and if the
// player asked for reduced motion it shortens or skips the animation entirely.
//
// game.js calls into this module through three public entry points only:
//   • CardVFX.setActiveCard(id, rarity)  — when a run starts (persistent aura)
//   • CardVFX.clearActive()              — when a run ends (clears the aura)
//   • CardVFX.trigger(id, context, ctx)  — when a card's mechanic activates
//
// Wiring lives at existing mechanic hooks (BREAK success, AK47 complete, OD
// start, Drake Take, Thanatos Phase, boss KO, combo-full GOLD RUSH / WEEB FOCUS,
// the Doppelganger / Lord-of-Debt shadow hits, the Abyssmell execute). Passive
// damage cards get only the aura; high-frequency contexts (per-hit) are throttled
// so there is no per-hit particle spam — per the lightweight/mobile-safe brief.
//
// Style note: comments are in Thai/English to match the surrounding codebase.

// ── reduced-motion (เคารพการตั้งค่าระดับ OS) ─────────────────────────────────
let _reduced = false;
try {
  const _mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  _reduced = _mq.matches;
  // อัปเดตแบบ live ถ้าผู้ใช้สลับค่าระหว่างเล่น
  const _onChange = (e) => { _reduced = e.matches; };
  if (_mq.addEventListener) _mq.addEventListener('change', _onChange);
  else if (_mq.addListener) _mq.addListener(_onChange);
} catch (e) { _reduced = false; }

// ── DOM helpers (ทุกตัว safe no-op ถ้า target หาย) ───────────────────────────
function _root() { return document.getElementById('gameRoot') || document.body || null; }
function _fighter() { return document.getElementById('fighter'); }

// dedicated full-screen layer (แยกจาก #fxLayer ของเกมหลัก เพื่อไม่ชน pool เดิม)
let _layerEl = null;
function _layer() {
  if (_layerEl && _layerEl.isConnected) return _layerEl;
  const root = _root();
  if (!root) return null;
  let el = document.getElementById('cardVfxLayer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cardVfxLayer';
    el.setAttribute('aria-hidden', 'true');
    root.appendChild(el);
  }
  _layerEl = el;
  return el;
}

// minimal node pool — รีไซเคิล div เพื่อเลี่ยง createElement ถี่ ๆ บนมือถือ
const _pool = [];
function _take(cls) {
  const el = _pool.pop() || document.createElement('div');
  el.className = cls;
  el.style.cssText = '';
  el.innerHTML = '';
  return el;
}
function _free(el, ms) {
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
    el.className = '';
    el.style.cssText = '';
    el.innerHTML = '';
    if (_pool.length < 16) _pool.push(el);
  }, ms);
}

// คืน {x,y} กลางตัวละคร (fallback กลางจอ) สำหรับเอฟเฟกต์ที่ไม่ได้ส่งพิกัดมา
function _fighterCenter() {
  const f = _fighter();
  if (f && f.getBoundingClientRect) {
    const r = f.getBoundingClientRect();
    if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height * 0.42 };
  }
  return { x: (window.innerWidth || 360) / 2, y: (window.innerHeight || 640) * 0.4 };
}

// แนบ element ลง layer พร้อม auto-recycle. dur หน่วยวินาที.
function _emit(el, ms) {
  const layer = _layer();
  if (!layer) return;
  layer.appendChild(el);
  _free(el, ms);
}

// reduced-motion → ย่นเวลาเหลือสั้นมาก (คงฟีดแบ็กแต่ไม่กวน)
function _dur(base) { return _reduced ? Math.min(base, 0.16) : base; }

// ── PRIMITIVES ───────────────────────────────────────────────────────────────
// แต่ละตัวเบา: 1 element + CSS class + ตัวแปรสี (--cv). reduced-motion ลดของ/เวลา.

function pFlash(color, dur = 0.34) {
  const el = _take('cv-flash');
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 60);
}

function pPulse(color, dur = 0.5) {
  const c = _fighterCenter();
  const el = _take('cv-pulse');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

function pSlash(color, count = 1, dur = 0.32) {
  const c = _fighterCenter();
  const n = _reduced ? 1 : count;
  for (let i = 0; i < n; i++) {
    const el = _take('cv-slash');
    el.style.left = c.x + 'px';
    el.style.top = (c.y + (i - (n - 1) / 2) * 22) + 'px';
    el.style.setProperty('--cv', color);
    el.style.setProperty('--rot', (-32 + (i % 2) * 64) + 'deg');
    el.style.animationDuration = _dur(dur) + 's';
    el.style.animationDelay = (i * 0.05) + 's';
    _emit(el, _dur(dur) * 1000 + i * 60 + 80);
  }
}

function pSpark(color, count = 6, x, y, dur = 0.36) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  const n = _reduced ? Math.min(count, 3) : count;
  for (let i = 0; i < n; i++) {
    const el = _take('cv-spark');
    const ang = (i / n) * Math.PI * 2;
    const dist = 26 + Math.random() * 40;
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.style.setProperty('--cv', color);
    el.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    el.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    el.style.animationDuration = _dur(dur) + 's';
    _emit(el, _dur(dur) * 1000 + 80);
  }
}

function pShadowBurst(color, dur = 0.55) {
  const c = _fighterCenter();
  const el = _take('cv-shadowburst');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

function pCoinBurst(color, x, y, dur = 0.7) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  const n = _reduced ? 3 : 7;
  for (let i = 0; i < n; i++) {
    const el = _take('cv-coin');
    const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.32;
    const dist = 40 + Math.random() * 46;
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.style.setProperty('--cv', color || '#ffcc00');
    el.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    el.style.setProperty('--dy', (Math.sin(ang) * dist - 20) + 'px');
    el.style.animationDuration = _dur(dur) + 's';
    el.style.animationDelay = (i * 0.03) + 's';
    _emit(el, _dur(dur) * 1000 + i * 40 + 100);
  }
}

function pBreakCrack(color, heavy = false, dur = 0.42) {
  const c = _fighterCenter();
  const el = _take('cv-crack' + (heavy ? ' heavy' : ''));
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 100);
}

function pOdGlow(color, dur = 0.6) {
  const c = _fighterCenter();
  const el = _take('cv-odglow');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

function pStreak(color, x, y, dur = 0.4) {
  const c = (x === undefined) ? _fighterCenter() : { x, y };
  const n = _reduced ? 2 : 4;
  for (let i = 0; i < n; i++) {
    const el = _take('cv-streak');
    el.style.left = c.x + 'px';
    el.style.top = (c.y - 30 + i * 20) + 'px';
    el.style.setProperty('--cv', color);
    el.style.animationDuration = _dur(dur) + 's';
    el.style.animationDelay = (i * 0.04) + 's';
    _emit(el, _dur(dur) * 1000 + i * 50 + 80);
  }
}

function pDrainPulse(color, dur = 0.55) {
  const c = _fighterCenter();
  const el = _take('cv-drain');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

function pComboRing(color, dur = 0.5) {
  const c = _fighterCenter();
  const el = _take('cv-comboring');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

// MOONLIGHT FEVER — silver/blue moon: crescent disc + circular ring pulse + night-fever shimmer.
// variant 'peak' (ยิงตอน OD ซึ่งการ์ดบูสต์ OD charge ×2) ใหญ่/สว่างกว่าเล็กน้อย.
// ตั้งใจให้ "ไม่จ้าแต่เห็นชัดบนมือถือ" — ใช้ mix-blend screen + opacity ปานกลาง.
// รูปทรงพระจันทร์เสี้ยวทำให้ต่างจาก frost(FREEONI/GHOSTPING) / dark(THANABROS) / holy(VALKYRIZZ).
function pMoonRing(color, variant) {
  const c = _fighterCenter();
  const peak = (variant === 'peak');
  const base = peak ? 0.95 : 0.7;
  const dur = _dur(base);
  const el = _take('cv-moonring' + (peak ? ' peak' : ''));
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#cfd8ff');
  el.style.setProperty('--md', dur + 's'); // children อ่านค่า duration จากตัวแปรนี้
  el.innerHTML = '<i class="cv-moon-disc"></i><i class="cv-moon-ring"></i><i class="cv-moon-ring cv-moon-ring2"></i>';
  _emit(el, dur * 1000 + 160);
}

function pBossFlare(color, dur = 0.5) {
  // หา target ของบอส (bossBar/boxer) ถ้าไม่มีก็ fallback กลางตัวละคร
  const boss = document.getElementById('boxer') || document.getElementById('bossBar') || _fighter();
  let cx, cy;
  if (boss && boss.getBoundingClientRect) {
    const r = boss.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
  }
  if (!cx) { const c = _fighterCenter(); cx = c.x; cy = c.y; }
  const el = _take('cv-bossflare');
  el.style.left = cx + 'px'; el.style.top = cy + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

// BOLT — สายฟ้าซิกแซกฟาดลงจุดที่กระทบ (STORMYNITE / MISSSTRESS). รับพิกัด ctx.x/y.
// 1 element + glow flash สั้น ๆ; รูปทรงต่างจาก slash (ตรง) และ spark (จุดกระจาย).
function pBolt(color, x, y, dur = 0.34) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  const el = _take('cv-bolt');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.setProperty('--cv', color || '#9be7ff');
  el.style.animationDuration = _dur(dur) + 's';
  // ปรับมุมเล็กน้อยให้แต่ละครั้งไม่ซ้ำเป๊ะ (ดูเป็นธรรมชาติ)
  el.style.setProperty('--rot', (-8 + Math.random() * 16) + 'deg');
  el.innerHTML = '<i></i><i></i>';
  _emit(el, _dur(dur) * 1000 + 80);
}

// FIRE BURST — เปลวไฟ/สะเก็ดลอยขึ้น (IFRIED / EDGEGA / ATROSUS / BAPHOBET / TAO FUNKA).
// แกนเปลว 1 ตัว + embers ลอยขึ้นไม่กี่จุด → ต่างจาก shadowBurst (คลื่นมืดแผ่ออกแนวกลม).
function pFireBurst(color, x, y, dur = 0.55) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  const el = _take('cv-fireburst');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.setProperty('--cv', color || '#ff5511');
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
  // embers — เบา ๆ บนมือถือ
  const n = _reduced ? 2 : 5;
  for (let i = 0; i < n; i++) {
    const e = _take('cv-ember');
    const dx = (Math.random() - 0.5) * 46;
    const rise = 38 + Math.random() * 40;
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
    e.style.setProperty('--cv', color || '#ff7722');
    e.style.setProperty('--dx', dx + 'px');
    e.style.setProperty('--dy', -rise + 'px');
    e.style.animationDuration = _dur(dur) + 's';
    e.style.animationDelay = (i * 0.03) + 's';
    _emit(e, _dur(dur) * 1000 + i * 40 + 100);
  }
}

// HOLY BURST — แสงศักดิ์สิทธิ์แผ่เป็นรัศมีก้าน (VALKYRIZZ / NOSIRIS / LADY TRAINEE).
// วงแกนสว่าง + ก้านแสง 8 ทิศ (conic-ish) → ความรู้สึก "divine/spotlight" ชัดเจน.
function pHolyBurst(color, dur = 0.6) {
  const c = _fighterCenter();
  const el = _take('cv-holyburst');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#ffe9a8');
  el.style.animationDuration = _dur(dur) + 's';
  el.innerHTML = '<i class="cv-holy-core"></i><i class="cv-holy-rays"></i>';
  _emit(el, _dur(dur) * 1000 + 100);
}

// GLITCH — แถบ scanline เลื่อน/สั่น (KILL-D01 / RSICK / DETAILED / FALLEN WECHAT / MAYA / RSICK).
// 3 แถบแนวนอนเหลื่อมกัน — สื่อ "ข้อมูลรวน/ไซเบอร์" ต่างจากทุก primitive อื่น.
function pGlitch(color, dur = 0.36) {
  const el = _take('cv-glitch');
  el.style.setProperty('--cv', color || '#00ffee');
  el.style.animationDuration = _dur(dur) + 's';
  const n = _reduced ? 1 : 3;
  let html = '';
  for (let i = 0; i < n; i++) {
    const top = 18 + Math.random() * 64;       // % ของความสูงจอ
    const h = 4 + Math.random() * 14;           // px
    const sx = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 26);
    html += `<i style="top:${top}%;height:${h}px;--gx:${sx}px;animation-delay:${(i * 0.04).toFixed(2)}s"></i>`;
  }
  el.innerHTML = html;
  _emit(el, _dur(dur) * 1000 + 120);
}

// dispatcher: ชื่อ primitive → ฟังก์ชัน (ใช้ใน VFX_MAP แบบ data-driven)
const PRIM = {
  flash: pFlash, pulse: pPulse, slash: pSlash, spark: pSpark,
  shadowBurst: pShadowBurst, coinBurst: pCoinBurst, breakCrack: pBreakCrack,
  odGlow: pOdGlow, streak: pStreak, drainPulse: pDrainPulse,
  comboRing: pComboRing, bossFlare: pBossFlare, moonRing: pMoonRing,
  bolt: pBolt, fireBurst: pFireBurst, holyBurst: pHolyBurst, glitch: pGlitch,
};

// primitive ไหนรับพิกัด (x,y) → ใช้ map นี้ฉีดค่า ctx.x/ctx.y เข้า args ตำแหน่งที่ถูกต้อง
const COORD_ARG = {
  spark: [2, 3], coinBurst: [1, 2], streak: [1, 2], bolt: [1, 2], fireBurst: [1, 2],
};

// context ที่ยิงถี่ (ทุกคลิก) → throttle เพื่อไม่ให้ particle spam บนมือถือ
const _THROTTLE = { hit: 110 };
let _lastFire = {};

// ── PER-CARD VFX MAPPING (Elite + Mythic) ────────────────────────────────────
// อ้างอิงทิศทางจาก task brief — ให้แต่ละใบ "รู้สึกต่างกัน" ด้วยสี/ไพรมิทีฟ/จังหวะ
// แม้จะใช้ primitive ร่วมกันได้. แต่ละ entry:
//   aura : [style, color]            — auraถาวรบนตัวละคร (passive indicator)
//   on   : { context: [prim, ...args] | [[prim, ...], ...] }  — เอฟเฟกต์ตอน mechanic ยิง
// ctx (เช่น {x,y}) ส่งจาก hook; primitive ที่รับพิกัดจะใช้ ctx.x/ctx.y ถ้ามี.

const VFX_MAP = {
  // ── ELITE ──
  // DOPPELGANGER — มิเรอร์ฟันคู่ + เงาตามหลัง (ยิงต่อ hit แต่ throttle ที่ context 'hit')
  dg:  { rarity: 'elite', aura: ['shadow', '#aa66ff'], on: { hit: [['slash', '#c9a3ff', 2], ['shadowBurst', '#aa66ff', 0.4]] } },
  // HYDRA — หลายหัวงูเขียว: รอยร้าวหนัก + ฟันคู่ตอน BREAK, สะเก็ดพิษตอน AK47
  hy:  { rarity: 'elite', aura: ['drain', '#44ff88'],  on: { break: [['breakCrack', '#44ff88', true], ['slash', '#7dffb0', 2]], ak47: ['spark', '#44ff88', 6] } },
  // FREEONI — แปลง combo เป็นน้ำแข็ง: พัลส์ฟ้า + สะเก็ดเย็นตอน BREAK, OD glow เย็นตอน AK47→OD
  ph:  { rarity: 'elite', aura: ['frost', '#66ccff'],  on: { break: [['pulse', '#66ccff'], ['spark', '#aaf0ff', 6]], ak47: ['odGlow', '#9bdcff'] } },
  // TURTLE SHOGUN — กระดองแตก (heavy shell crack) ตอนเข้า SHOGUN STANCE
  tg:  { rarity: 'elite', aura: ['glow',  '#9bbb55'],  on: { break: ['breakCrack', '#bfe07a', true] } },
  // DRAKE — DRAKE TAKE คือหน้าต่างพลังใหญ่: วาบ + OD glow ทอง + ฟันคู่ + สะเก็ดทองเยอะ
  dk:  { rarity: 'elite', aura: ['gold',  '#ffcc33'],  on: { drake: [['flash', '#3a2a00'], ['odGlow', '#ffcc33'], ['slash', '#ffd84a', 2], ['spark', '#ffe680', 8]] } },
  // ABYSMELL KNIGHT — execute มืด: วาบดำ + ฟันแดง + คลื่นมืดดูดเข้า
  ak:  { rarity: 'elite', aura: ['shadow', '#cc3344'], on: { execute: [['flash', '#2a0008'], ['slash', '#ff2244', 1], ['shadowBurst', '#440011', 0.5]] } },
  // TAO FUNKA — FUNK FEVER เกรี้ยวแดง: ไฟพุ่ง + พัลส์แดง
  tk:  { rarity: 'elite', aura: ['fire',  '#ff3322'],  on: { break: [['fireBurst', '#ff4422'], ['pulse', '#ff6633']] } },
  // DRUNKULA — BLOOD DRINK: พัลส์ดูดเลือด + สะเก็ดแดง
  dc:  { rarity: 'elite', aura: ['drain', '#cc2244'],  on: { break: [['drainPulse', '#cc2255'], ['spark', '#ff3366', 5]] } },
  // INCANTATION SCAMURAI — ยันต์/CONTRACT: วงยันต์ + รอยร้าวม่วง + วาบ
  ic:  { rarity: 'elite', aura: ['glow',  '#cc66ff'],  on: { break: [['comboRing', '#cc66ff'], ['breakCrack', '#d49bff'], ['flash', '#1a0a2a']] } },
  // STORMYNITE — STORM CHARGE: สายฟ้าฟาด + วาบ + สะเก็ดไฟฟ้า
  sk:  { rarity: 'elite', aura: ['tech',  '#66ddff'],  on: { od: [['flash', '#bff0ff'], ['bolt', '#9be7ff'], ['spark', '#cdf4ff', 6]] } },
  // DORK LORD — NIGHT STACK (passive scaling): รอยร้าวมืดตอน BREAK
  dl:  { rarity: 'elite', aura: ['shadow', '#7744aa'], on: { break: ['breakCrack', '#9a66cc'] } },
  // MOONLIGHT FEVER — พระจันทร์เสี้ยวเงิน + วงแหวนพัลส์; ยิงตามบูสต์จริง (OD ×2 = peak, BREAK, AK47)
  mf:  { rarity: 'elite', aura: ['moon',  '#cfd8ff'],  on: { od: ['moonRing', '#dbe4ff', 'peak'], break: ['moonRing', '#cfd8ff'], ak47: ['moonRing', '#bcd0ff'] } },
  // MINORAGE — ORE RAGE (ขุดแร่/เกรี้ยว): aura เรืองส้มจาง ๆ; เก็บแร่ = สะเก็ดเหมือง,
  // ใช้แร่ตอน BREAK = หินแตก, ครบ 3 (RAGE RUSH) = พัลส์แดง-ส้ม + ไฟ + สะเก็ดแรงขึ้น
  mi:  { rarity: 'elite', aura: ['glow', '#cc7733'], on: {
           oregain: ['spark', '#ffb733', 5],
           break:   [['breakCrack', '#d8a14e', true], ['spark', '#ffaa44', 6]],
           rage:    [['pulse', '#ff3322'], ['fireBurst', '#ff5522'], ['spark', '#ff8844', 7]],
         } },
  // EXECUSIONER — ฟันขวาน: รอยฟัน + รอยร้าวหนัก (chop impact)
  ex:  { rarity: 'elite', aura: ['shadow', '#cc3333'], on: { break: [['slash', '#ff5544', 1], ['breakCrack', '#ff7755', true]] } },
  // WHIZPER — GHOST PROTOCOL: เส้นความเร็วที่จุด AK47 + เงาจาง (ghost fade)
  wh:  { rarity: 'elite', aura: ['frost', '#aaffee'],  on: { ak47: [['streak', '#aaffee'], ['shadowBurst', '#cceeff', 0.45]] } },
  // GOBLIN WEEBER — WEEB FOCUS ตอน combo เต็ม: วงโฟกัส (ยิงที่ context 'combo' จริง)
  gl:  { rarity: 'elite', aura: ['glow',  '#88cc44'],  on: { combo: [['comboRing', '#9bdc55'], ['flash', '#16240a']] } },
  // AMOG RA — น่าสงสัยส้ม-แดง: คลื่นมืดส้ม + สะเก็ด
  ar:  { rarity: 'elite', aura: ['fire',  '#ff7722'],  on: { break: [['shadowBurst', '#ff8833'], ['spark', '#ffaa44', 6]] } },
  // MAYA PROBLEM — bug/glitch + บอส: scanline glitch + พัลส์ตอน BREAK, boss flare ตอนล้มบอส
  mp:  { rarity: 'elite', aura: ['tech',  '#ff44aa'],  on: { break: [['glitch', '#ff44aa'], ['pulse', '#ff55bb']], boss: ['bossFlare', '#ff44aa'] } },
  // WEEBVIL DUDE — OTAKU AWAKENING (สาปแมลง): คลื่นมืด + พัลส์ม่วง
  ed:  { rarity: 'elite', aura: ['shadow', '#aa66cc'], on: { break: [['shadowBurst', '#bb77dd'], ['pulse', '#cc88ee']] } },
  // GHOSTPING — เกจ BREAK ผี: พัลส์จาง + รอยร้าวฟ้าซีด
  ghp: { rarity: 'elite', aura: ['frost', '#aaddff'],  on: { break: [['pulse', '#aaddff'], ['breakCrack', '#cce8ff']] } },
  // DEVILINGO — ปีศาจ + โลภ + โฟกัสบอส: เหรียญแดง + เส้นความเร็วตอน AK47, boss flare + ไฟตอนล้มบอส
  dvl: { rarity: 'elite', aura: ['fire',  '#ff3322'],  on: { ak47: [['coinBurst', '#ff6644'], ['streak', '#ff5533']], boss: [['bossFlare', '#ff2233'], ['fireBurst', '#ff4422']] } },
  // LADY TRAINEE — Spotlight ฝึกซ้อมสะอาด: แสง holy + วงคอมโบตอนเข้า OD
  ltn: { rarity: 'elite', aura: ['holy',  '#ff99dd'],  on: { od: [['holyBurst', '#ff99dd'], ['comboRing', '#ffaae0']] } },

  // ── MYTHIC ──
  // THANABROS — Thanatos Phase (หยุดเวลา/มืด): วาบดำ + OD glow + คลื่นมืด + glitch บิดเวลา; AK47 ม่วงพัลส์
  th:  { rarity: 'mythic', aura: ['shadow', '#cc00cc'], on: { thanatos: [['flash', '#1a0022'], ['odGlow', '#dd33dd'], ['shadowBurst', '#660066', 0.6], ['glitch', '#cc44cc']], ak47: [['spark', '#dd55dd', 6], ['pulse', '#cc33cc']] } },
  // BAPHOBET — DEVIL BET ปีศาจแดง: ไฟพุ่ง + ฟันสาม + คลื่นมืด
  bh:  { rarity: 'mythic', aura: ['fire',  '#cc0000'],  on: { break: [['fireBurst', '#cc0000'], ['slash', '#ff2233', 3], ['shadowBurst', '#660000', 0.5]] } },
  // EDGEGA — Lv2 Burst เสือ: ไฟพุ่ง + เล็บสามรอย
  eg:  { rarity: 'mythic', aura: ['fire',  '#ff6622'],  on: { od: [['fireBurst', '#ff6622'], ['slash', '#ff8844', 3]] } },
  // NOSIRIS — JUDGMENT ทราย/ทองศักดิ์สิทธิ์: แสง holy ทอง + พัลส์
  os:  { rarity: 'mythic', aura: ['gold',  '#ffdd66'],  on: { break: [['holyBurst', '#ffe07a'], ['pulse', '#ffd84a']] } },
  // MISSSTRESS — ราชินีผึ้งสายฟ้าเหลือง: สายฟ้า + สะเก็ด + เหรียญ (zeny ตอน OD)
  mt:  { rarity: 'mythic', aura: ['gold',  '#ffdd00'],  on: { od: [['bolt', '#ffe21a'], ['spark', '#ffe85a', 6], ['coinBurst', '#ffe21a']] } },
  // GOLDEN BRUH — GOLD RUSH ระเบิดทองใหญ่ (ยิงที่ context 'combo' จริง ตอน combo เต็ม)
  gb:  { rarity: 'mythic', aura: ['gold',  '#ffcc00'],  on: { combo: [['flash', '#3a2e00'], ['coinBurst', '#ffcc00'], ['spark', '#ffe680', 8]] } },
  // COKE ZERO — ศูนย์ดำ-ขาวเย็น: วาบขาว + วงพัลส์ + คลื่นมืด (คอนทราสต์ดำ-ขาว)
  oh:  { rarity: 'mythic', aura: ['frost', '#e8f4ff'],  on: { break: [['flash', '#ffffff'], ['pulse', '#cfe8ff'], ['shadowBurst', '#0a0a0a', 0.5]] } },
  // LORD OF DEBT — DEBT CONTRACT โซ่เงา + เหรียญ (clear ตอน BREAK), เงาฟันตอน berserk hit
  ld:  { rarity: 'mythic', aura: ['drain', '#9944cc'],  on: { break: [['drainPulse', '#9944cc'], ['coinBurst', '#b066dd']], hit: ['slash', '#7744aa', 1] } },
  // CATULLANUX — ราชาแมว combo lock: รอยร้าวหนัก + วง lock
  kn:  { rarity: 'mythic', aura: ['glow',  '#ffaa44'],  on: { break: [['breakCrack', '#ffbf6a', true], ['comboRing', '#ffcf8a']] } },
  // BEELZEBRUH — ฝูงแมลงพิษเขียว: คลื่นมืดเขียว + สะเก็ดฝูง
  bz:  { rarity: 'mythic', aura: ['drain', '#88cc00'],  on: { break: [['shadowBurst', '#88cc00'], ['spark', '#a4dd2a', 7]] } },
  // VALKYRIZZ — ปีกศักดิ์สิทธิ์ + หอก: แสง holy + ฟันสว่าง
  vr:  { rarity: 'mythic', aura: ['holy',  '#cc88ff'],  on: { break: [['holyBurst', '#d6a3ff'], ['slash', '#e0b8ff', 1]] } },
  // ATROSUS — Resonance อสูรเกรี้ยว: ไฟพุ่ง + เล็บสามรอยแดง
  at:  { rarity: 'mythic', aura: ['fire',  '#ee3333'],  on: { break: [['fireBurst', '#ee3333'], ['slash', '#ff4444', 3]] } },
  // KILL-D01 — เลเซอร์หุ่นยนต์: glitch scanline + เส้นเลเซอร์ + วาบ
  kl:  { rarity: 'mythic', aura: ['tech',  '#00ffee'],  on: { break: [['glitch', '#00ffee'], ['streak', '#aaffff'], ['flash', '#003333']] } },
  // IFRIED — Inferno Burst: ไฟพุ่ง + สะเก็ดไฟ
  if:  { rarity: 'mythic', aura: ['fire',  '#ff4400'],  on: { break: [['fireBurst', '#ff4400'], ['spark', '#ff7722', 7]] } },
  // RSICK-0806 — ไซเบอร์ Execution: glitch + พัลส์แดง
  rx:  { rarity: 'mythic', aura: ['tech',  '#ff2233'],  on: { break: [['glitch', '#ff2233'], ['pulse', '#ff4455']] } },
  // FALLEN WECHAT — Overloaded BREAK เทวดาตก: glitch + คลื่นมืด + วาบดำ
  fwc: { rarity: 'mythic', aura: ['shadow', '#ff2233'], on: { break: [['glitch', '#ff2233'], ['shadowBurst', '#330008', 0.5], ['flash', '#1a0008']] } },
  // DETAILED — ANALYZED BREAK กริด/สแกนแม่นยำ: glitch + สะเก็ดกริด + วาบ
  dtl: { rarity: 'mythic', aura: ['tech',  '#00ffee'],  on: { break: [['glitch', '#00ffee'], ['spark', '#00ffee', 8], ['flash', '#003a3a']] } },
  // GLOOM UNDER SIDE — OBSESSION (passive scaling): คลื่นเงาซ้อนสองชั้น
  gus: { rarity: 'mythic', aura: ['shadow', '#6633aa'], on: { break: [['shadowBurst', '#7d44c4', 0.6], ['shadowBurst', '#5522aa', 0.45]] } },
  // DARK STAKE LORD — Jackpot มืด: คลื่นมืด + เหรียญ + สะเก็ดหนาม (sinister jackpot)
  dsk: { rarity: 'mythic', aura: ['shadow', '#aa33ff'], on: { break: [['shadowBurst', '#aa33ff'], ['coinBurst', '#c266ff'], ['spark', '#cc77ff', 6]] } },
};

// ── AURA STATE (persistent indicator for the active card) ────────────────────
// ใช้ child element เฉพาะ (#cvAuraEl) แทน ::before เพื่อไม่ชนกับ aura ของบอสสกิน
// (toei-enigma-aura ใช้ทั้ง ::before และ ::after บน #fighter อยู่แล้ว).
let _activeAuraId = null;
const _AURA_STYLES = ['glow', 'pulse', 'drain', 'holy', 'shadow', 'gold', 'frost', 'fire', 'tech', 'moon'];

function _auraEl(create) {
  const f = _fighter();
  if (!f) return null;
  let el = document.getElementById('cvAuraEl');
  if (!el && create) {
    el = document.createElement('div');
    el.id = 'cvAuraEl';
    el.setAttribute('aria-hidden', 'true');
    f.appendChild(el);
  }
  return el;
}

function _applyAura(id) {
  const entry = VFX_MAP[id];
  if (!entry || !entry.aura) { clearCardAura(); return; }
  const el = _auraEl(true);
  if (!el) return;
  const [style, color] = entry.aura;
  el.className = 'cv-aura cv-aura--' + style;
  el.style.setProperty('--cv-aura', color);
  _activeAuraId = id;
}

function setCardAura(id, active) {
  if (active === false) { clearCardAura(id); return; }
  if (!VFX_MAP[id]) return;          // ไม่ใช่ Elite/Mythic → ไม่ทำอะไร
  _applyAura(id);
}

function clearCardAura(id) {
  // ถ้าระบุ id แล้วไม่ตรงกับ aura ปัจจุบัน → ไม่ต้องเคลียร์ (กันลบของใบอื่น)
  if (id && _activeAuraId && id !== _activeAuraId) return;
  const el = _auraEl(false);
  if (el) { el.className = ''; el.style.removeProperty('--cv-aura'); }
  _activeAuraId = null;
}

// run-start: ตั้ง aura ให้เฉพาะการ์ด Elite/Mythic
function setActiveCard(id, rarity) {
  if (rarity && rarity !== 'elite' && rarity !== 'mythic') { clearCardAura(); return; }
  if (!VFX_MAP[id]) { clearCardAura(); return; }
  setCardAura(id, true);
}
function clearActive() { clearCardAura(); _lastFire = {}; }

// ── TRIGGER (เรียกตอน mechanic ยิงจริง) ──────────────────────────────────────
// แต่ละ arg ของ primitive ที่เป็นพิกัดจะถูกแทนด้วย ctx.x/ctx.y โดยอัตโนมัติสำหรับ
// primitive ที่รองรับ (spark/coinBurst).
function _runPrim(spec, ctx) {
  if (!Array.isArray(spec)) return;
  const name = spec[0];
  const fn = PRIM[name];
  if (typeof fn !== 'function') return;
  const args = spec.slice(1);
  // ฉีดพิกัดจาก ctx เข้า args ตามตำแหน่งของแต่ละ primitive (COORD_ARG)
  if (ctx && (ctx.x !== undefined) && (ctx.y !== undefined)) {
    const idx = COORD_ARG[name];
    if (idx) { args[idx[0]] = ctx.x; args[idx[1]] = ctx.y; }
  }
  try { fn.apply(null, args); } catch (e) { /* primitive ต้องไม่ทำเกมพัง */ }
}

function triggerCardVfx(id, context, ctx) {
  const entry = VFX_MAP[id];
  if (!entry || !entry.on) return;       // ไม่มี mapping → safe no-op
  const spec = entry.on[context];
  if (!spec) return;                     // การ์ดนี้ไม่มีเอฟเฟกต์สำหรับ context นี้
  if (!_layer()) return;                 // DOM ไม่พร้อม → no-op
  // throttle context ที่ยิงถี่ (เช่น hit ทุกคลิก) เพื่อกัน particle spam
  const thr = _THROTTLE[context];
  if (thr) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const key = id + ':' + context;
    if (_lastFire[key] && (now - _lastFire[key]) < thr) return;
    _lastFire[key] = now;
  }
  // spec อาจเป็น primitive เดี่ยว ['flash', ...] หรือหลายตัว [['flash',...],['slash',...]]
  if (Array.isArray(spec[0])) spec.forEach((s) => _runPrim(s, ctx));
  else _runPrim(spec, ctx);
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────
const CardVFX = {
  trigger: triggerCardVfx,
  triggerCardVfx,
  setCardAura,
  clearCardAura,
  setActiveCard,
  clearActive,
  VFX_MAP,
  reducedMotion: () => _reduced,
};

if (typeof window !== 'undefined') window.CardVFX = CardVFX;

export { CardVFX, VFX_MAP };
