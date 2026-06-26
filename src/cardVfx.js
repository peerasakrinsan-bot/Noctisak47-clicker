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

// ── canvas routing ───────────────────────────────────────────────────────────
// ถ้า canvas VFX layer (src/canvasVfx.js) พร้อม ให้มันรับเอฟเฟกต์ transient แทน
// การ spawn DOM node — ลดจำนวน DOM node ตอนยิงถี่บนมือถือ. ถ้า canvas ไม่รองรับ
// (เช่น สภาพแวดล้อม audit/Node หรือเบราว์เซอร์เก่า) → คืน false แล้วใช้ DOM เดิม
// เป็น fallback ครบทุก primitive (พฤติกรรมเดิม 100%).
function _toCanvas(type, opts) {
  const C = (typeof window !== 'undefined') && window.CanvasVFX;
  if (C && C.supported && C.supported()) { C.spawnCanvasVfx(type, opts); return true; }
  return false;
}

// ── PRIMITIVES ───────────────────────────────────────────────────────────────
// แต่ละตัวเบา: 1 element + CSS class + ตัวแปรสี (--cv). reduced-motion ลดของ/เวลา.

function pFlash(color, dur = 0.34) {
  if (_toCanvas('flash', { color, dur })) return;
  const el = _take('cv-flash');
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 60);
}

function pPulse(color, dur = 0.5) {
  const c = _fighterCenter();
  if (_toCanvas('pulse', { color, dur, x: c.x, y: c.y })) return;
  const el = _take('cv-pulse');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

function pSlash(color, count = 1, dur = 0.32) {
  const c = _fighterCenter();
  if (_toCanvas('slash', { color, count, dur, x: c.x, y: c.y })) return;
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
  if (_toCanvas('spark', { color, count, dur, x: p.x, y: p.y })) return;
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
  if (_toCanvas('shadowBurst', { color, dur, x: c.x, y: c.y })) return;
  const el = _take('cv-shadowburst');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

function pCoinBurst(color, x, y, dur = 0.7) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('coinBurst', { color, dur, x: p.x, y: p.y })) return;
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
  if (_toCanvas('breakCrack', { color, heavy, dur, x: c.x, y: c.y })) return;
  const el = _take('cv-crack' + (heavy ? ' heavy' : ''));
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 100);
}

function pOdGlow(color, dur = 0.6) {
  const c = _fighterCenter();
  if (_toCanvas('odGlow', { color, dur, x: c.x, y: c.y })) return;
  const el = _take('cv-odglow');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

function pStreak(color, x, y, dur = 0.4) {
  const c = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('streak', { color, dur, x: c.x, y: c.y })) return;
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
  if (_toCanvas('drainPulse', { color, dur, x: c.x, y: c.y })) return;
  const el = _take('cv-drain');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color);
  el.style.animationDuration = _dur(dur) + 's';
  _emit(el, _dur(dur) * 1000 + 80);
}

function pComboRing(color, dur = 0.5) {
  const c = _fighterCenter();
  if (_toCanvas('comboRing', { color, dur, x: c.x, y: c.y })) return;
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
  if (_toCanvas('moonRing', { color, variant, x: c.x, y: c.y })) return;
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
  if (_toCanvas('bossFlare', { color, dur, x: cx, y: cy })) return;
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
  if (_toCanvas('bolt', { color, dur, x: p.x, y: p.y })) return;
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
  if (_toCanvas('fireBurst', { color, dur, x: p.x, y: p.y })) return;
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
  if (_toCanvas('holyBurst', { color, dur, x: c.x, y: c.y })) return;
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
  if (_toCanvas('glitch', { color, dur })) return;
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

// context ที่ยิงถี่ → throttle เพื่อไม่ให้ particle spam บนมือถือ (คอสเมติกล้วน):
//   hit      — DOPPELGANGER/LORD OF DEBT มิเรอร์ฟันต่อคลิก
//   emberhit — IFRIED ember ตอนสะสม Inferno Stack (ติดเฉพาะตอนคริ แต่กันถี่อีกชั้น)
const _THROTTLE = { hit: 110, emberhit: 420 };
let _lastFire = {};

// ── GAMEPLAY-ELEMENT TARGETING ───────────────────────────────────────────────
// หัวใจของอัปเกรดนี้: "อิลิเมนต์ของเกมที่ได้รับผลจริง" ต้องตอบสนองด้วย ไม่ใช่แค่
// ไอคอนการ์ด. แต่ละการ์ดประกาศ `affects` (odBar / combo / timer / zeny / break /
// enemy / player) แล้วตอน trigger เราหา HUD element ตัวแรกที่มีจริงในหน้าจอ ใส่
// คลาส transient สั้น ๆ (transform/opacity/box-shadow ไม่วน) ที่ถอดออกเอง.
// คอสเมติกล้วน + safe no-op ถ้าไม่เจอ element.
const TARGET_EL = {
  odBar:  ['godLevelWrap', 'godFill'],
  combo:  ['comboWrap'],
  timer:  ['timerDisplay'],
  zeny:   ['scoreDisplay', 'inlineCoin'],
  break:  ['rageMeter'],
  enemy:  ['boxer', 'fighter'],
  player: ['fighter'],
  // debt: ทำให้ตัวนับ DEBT เดิม (#debtStackCounter) ตอบสนอง — ไม่สร้าง UI ซ้ำ
  debt:   ['debtStackCounter'],
};
const _targetTimers = new WeakMap();
function _resolveTarget(key) {
  const ids = TARGET_EL[key];
  if (!ids) return null;
  for (let i = 0; i < ids.length; i++) {
    const el = document.getElementById(ids[i]);
    if (el) return el;
  }
  return null;
}
function targetPulse(key, color, theme) {
  const el = _resolveTarget(key);
  if (!el || !el.classList) return;        // ไม่เจอ element → no-op
  if (color) el.style.setProperty('--gv', color);
  // restart animation บนการยิงถี่: ถอดคลาส → force reflow → ใส่ใหม่
  el.classList.remove('game-vfx-trigger');
  if (theme) el.classList.add('game-vfx-theme-' + theme);
  void el.offsetWidth;
  el.classList.add('game-vfx-trigger');
  const prev = _targetTimers.get(el);
  if (prev) clearTimeout(prev);
  const dur = _reduced ? 200 : 640;
  _targetTimers.set(el, setTimeout(() => {
    el.classList.remove('game-vfx-trigger');
    _targetTimers.delete(el);
  }, dur));
}

// ── STACK / CHARGE INDICATOR (pips เหนือตัวละคร) ─────────────────────────────
// การ์ดที่มีสแต็ก/ชาร์จจริง (เช่น MINORAGE ORE RAGE 0–3) โชว์ pips บอกความคืบหน้า.
// ค่าจริงส่งมาจาก game.js ผ่าน ctx.stack/ctx.max → layer แค่ "วาด" ความคืบหน้า
// (ยังคงคอสเมติกล้วน ไม่อ่าน/เขียน logic หรือ save).
let _stack = { id: null, cur: 0, max: 0 };
function _stackEl(create) {
  const f = _fighter();
  if (!f) return null;
  let el = document.getElementById('cvStackEl');
  if (!el && create) {
    el = document.createElement('div');
    el.id = 'cvStackEl';
    el.setAttribute('aria-hidden', 'true');
    f.appendChild(el);
  }
  return el;
}
function setStack(id, cur, max, theme, color) {
  const e = VFX_MAP[id];
  if (!e) return;
  max = max || (e.stack && e.stack.max) || 0;
  if (max <= 0) return;
  const el = _stackEl(true);
  if (!el) return;
  const col = color || (e.aura && e.aura[1]) || '#fff';
  const th  = theme || e.theme || '';
  el.className = 'game-vfx-stack' + (th ? ' game-vfx-theme-' + th : '');
  el.style.setProperty('--gv', col);
  el.style.display = 'flex';
  // (re)build pips เฉพาะเมื่อจำนวนสูงสุดเปลี่ยน
  if (el.childElementCount !== max) {
    let html = '';
    for (let i = 0; i < max; i++) html += '<i class="game-vfx-stack-pip"></i>';
    el.innerHTML = html;
  }
  cur = Math.max(0, Math.min(max, cur | 0));
  const pips = el.children || [];
  for (let i = 0; i < pips.length; i++) {
    const pip = pips[i];
    if (!pip.classList) continue;
    const on = i < cur, was = pip.classList.contains('on');
    if (on) pip.classList.add('on'); else pip.classList.remove('on');
    if (on && !was && !_reduced) {        // pip ที่เพิ่งเติม → เด้งสั้น ๆ
      pip.classList.remove('pop'); void pip.offsetWidth; pip.classList.add('pop');
    }
  }
  _stack = { id: id, cur: cur, max: max };
}
function expireStack() {
  const el = _stackEl(false);
  if (el && el.classList) {
    el.classList.add('game-vfx-expire');
    const dur = _reduced ? 160 : 450;
    setTimeout(() => { try { el.classList.remove('game-vfx-expire'); } catch (e) {} clearStack(); }, dur);
  } else { clearStack(); }
}
function clearStack() {
  const el = _stackEl(false);
  if (el) { el.className = ''; el.style.display = 'none'; el.innerHTML = ''; el.style.removeProperty('--gv'); }
  _stack = { id: null, cur: 0, max: 0 };
}

// ── COMPACT CHARGE RING (วงแหวนชาร์จวงเดียว) ─────────────────────────────────
// สำหรับการ์ดที่มี count จริงแต่ "กว้างเกินจะทำ pips" (เช่น LADY TRAINEE 0–15).
// แสดงเป็นวงแหวน conic วงเดียวเหนือตัวละคร — compact, ใช้ค่าจริง (ไม่ใช่ fake),
// ไม่กินพื้นที่จอ. ค่า % มาจาก ctx.charge/ctx.chargeMax ที่ส่งจาก game.js.
let _charge = { id: null, cur: 0, max: 0 };
function _chargeEl(create) {
  const f = _fighter();
  if (!f) return null;
  let el = document.getElementById('cvChargeEl');
  if (!el && create) {
    el = document.createElement('div');
    el.id = 'cvChargeEl';
    el.setAttribute('aria-hidden', 'true');
    f.appendChild(el);
  }
  return el;
}
function setCharge(id, cur, max) {
  const e = VFX_MAP[id];
  if (!e) return;
  max = max || 0;
  if (max <= 0) return;
  const el = _chargeEl(true);
  if (!el) return;
  cur = Math.max(0, Math.min(max, cur | 0));
  const pct = Math.round((cur / max) * 100);
  const th = e.theme || '';
  el.className = 'game-vfx-charge' + (th ? ' game-vfx-theme-' + th : '');
  el.style.setProperty('--gv', (e.aura && e.aura[1]) || '#fff');
  el.style.setProperty('--pct', pct + '%');
  el.style.display = 'block';
  _charge = { id: id, cur: cur, max: max };
}
function clearCharge() {
  const el = _chargeEl(false);
  if (el) { el.className = ''; el.style.display = 'none'; el.style.removeProperty('--pct'); el.style.removeProperty('--gv'); }
  _charge = { id: null, cur: 0, max: 0 };
}

// ── AURA INTENSITY TIER (passive build-up) ───────────────────────────────────
// ไม่ใช่ตัวนับ/ตัวเลข — แค่ทำให้ aura "หนักขึ้น" ตาม tier จริงที่ส่งมา (เช่น GLOOM
// obsession 0–20 → tier 0–3). คอสเมติกล้วน: เพิ่ม class บน #cvAuraEl เท่านั้น.
let _auraTier = 0;
function setAuraTier(id, level) {
  level = Math.max(0, Math.min(3, level | 0));
  _auraTier = level;
  const el = _auraEl(false);
  if (!el || !el.classList) return;
  el.classList.remove('game-vfx-tier-1', 'game-vfx-tier-2', 'game-vfx-tier-3');
  if (level > 0) el.classList.add('game-vfx-tier-' + level);
}

// ── PER-CARD VFX MAPPING (Elite + Mythic) ────────────────────────────────────
// อ้างอิงทิศทางจาก task brief — ให้แต่ละใบ "รู้สึกต่างกัน" ด้วยสี/ไพรมิทีฟ/จังหวะ
// แม้จะใช้ primitive ร่วมกันได้. แต่ละ entry:
//   aura : [style, color]            — auraถาวรบนตัวละคร (passive indicator)
//   on   : { context: [prim, ...args] | [[prim, ...], ...] }  — เอฟเฟกต์ตอน mechanic ยิง
// ctx (เช่น {x,y}) ส่งจาก hook; primitive ที่รับพิกัดจะใช้ ctx.x/ctx.y ถ้ามี.

// แต่ละ entry เพิ่ม metadata เชิงความหมาย (data-driven, ขยายได้ด้วยการเติมฟิลด์):
//   theme   : กลุ่มธีม VFX (soul/idol/analysis/crit/zeny/break/time) — ขับสีคลาส
//             .game-vfx-theme-* และบุคลิกของเอฟเฟกต์
//   affects : อิลิเมนต์ของเกมที่ "ได้รับผลจริง" → จะถูก targetPulse ตอน trigger
//   stack   : (ถ้ามีสแต็ก/ชาร์จ) { gain, reset, max } ผูกกับ context ที่ยิงจริง
const VFX_MAP = {
  // ── ELITE ──
  // DOPPELGANGER — มิเรอร์ฟันคู่ + เงาตามหลัง (ยิงต่อ hit แต่ throttle ที่ context 'hit')
  dg:  { rarity: 'elite', theme: 'soul', affects: 'enemy', aura: ['shadow', '#aa66ff'], on: { hit: [['slash', '#c9a3ff', 2], ['shadowBurst', '#aa66ff', 0.4]] } },
  // HYDRA — หลายหัวงูเขียว: รอยร้าวหนัก + ฟันคู่ตอน BREAK, สะเก็ดพิษตอน AK47
  hy:  { rarity: 'elite', theme: 'break', affects: 'break', aura: ['drain', '#44ff88'],  on: { break: [['breakCrack', '#44ff88', true], ['slash', '#7dffb0', 2]], ak47: ['spark', '#44ff88', 6] } },
  // FREEONI — แปลง combo เป็นน้ำแข็ง: พัลส์ฟ้า + สะเก็ดเย็นตอน BREAK, OD glow เย็นตอน AK47→OD
  ph:  { rarity: 'elite', theme: 'time', affects: 'break', aura: ['frost', '#66ccff'],  on: { break: [['pulse', '#66ccff'], ['spark', '#aaf0ff', 6]], ak47: ['odGlow', '#9bdcff'] } },
  // TURTLE SHOGUN — กระดองแตก (heavy shell crack) ตอนเข้า SHOGUN STANCE
  tg:  { rarity: 'elite', theme: 'break', affects: 'break', aura: ['glow',  '#9bbb55'],  on: { break: ['breakCrack', '#bfe07a', true] } },
  // DRAKE — DRAKE TAKE คือหน้าต่างพลังใหญ่: วาบ + OD glow ทอง + ฟันคู่ + สะเก็ดทองเยอะ
  dk:  { rarity: 'elite', theme: 'crit', affects: 'odBar', aura: ['gold',  '#ffcc33'],  on: { drake: [['flash', '#3a2a00'], ['odGlow', '#ffcc33'], ['slash', '#ffd84a', 2], ['spark', '#ffe680', 8]] } },
  // ABYSMELL KNIGHT — execute มืด: วาบดำ + ฟันแดง + คลื่นมืดดูดเข้า
  ak:  { rarity: 'elite', theme: 'soul', affects: 'enemy', aura: ['shadow', '#cc3344'], on: { execute: [['flash', '#2a0008'], ['slash', '#ff2244', 1], ['shadowBurst', '#440011', 0.5]] } },
  // TAO FUNKA — FUNK FEVER เกรี้ยวแดง: ไฟพุ่ง + พัลส์แดง
  tk:  { rarity: 'elite', theme: 'crit', affects: 'break', aura: ['fire',  '#ff3322'],  on: { break: [['fireBurst', '#ff4422'], ['pulse', '#ff6633']] } },
  // DRUNKULA — BLOOD DRINK: พัลส์ดูดเลือด + สะเก็ดแดง
  dc:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['drain', '#cc2244'],  on: { break: [['drainPulse', '#cc2255'], ['spark', '#ff3366', 5]] } },
  // INCANTATION SCAMURAI — ยันต์/CONTRACT: วงยันต์ + รอยร้าวม่วง + วาบ
  ic:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['glow',  '#cc66ff'],  on: { break: [['comboRing', '#cc66ff'], ['breakCrack', '#d49bff'], ['flash', '#1a0a2a']] } },
  // STORMYNITE — STORM CHARGE: สายฟ้าฟาด + วาบ + สะเก็ดไฟฟ้า
  sk:  { rarity: 'elite', theme: 'crit', affects: 'odBar', aura: ['tech',  '#66ddff'],  on: { od: [['flash', '#bff0ff'], ['bolt', '#9be7ff'], ['spark', '#cdf4ff', 6]] } },
  // DORK LORD — NIGHT STACK (passive scaling): รอยร้าวมืดตอน BREAK
  dl:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['shadow', '#7744aa'], on: { break: ['breakCrack', '#9a66cc'] } },
  // MOONLIGHT FEVER — พระจันทร์เสี้ยวเงิน + วงแหวนพัลส์; ยิงตามบูสต์จริง (OD ×2 = peak, BREAK, AK47)
  mf:  { rarity: 'elite', theme: 'time', affects: 'odBar', aura: ['moon',  '#cfd8ff'],  on: { od: ['moonRing', '#dbe4ff', 'peak'], break: ['moonRing', '#cfd8ff'], ak47: ['moonRing', '#bcd0ff'] } },
  // MINORAGE — ORE RAGE (ขุดแร่/เกรี้ยว): aura เรืองส้มจาง ๆ; เก็บแร่ = สะเก็ดเหมือง + pip,
  // ใช้แร่ตอน BREAK = หินแตก (reset stack), ครบ 3 (RAGE RUSH) = พัลส์แดง-ส้ม + ไฟ + สะเก็ดแรงขึ้น
  mi:  { rarity: 'elite', theme: 'break', affects: 'break', stack: { gain: 'oregain', reset: 'break', max: 3 }, aura: ['glow', '#cc7733'], on: {
           oregain: ['spark', '#ffb733', 5],
           break:   [['breakCrack', '#d8a14e', true], ['spark', '#ffaa44', 6]],
           rage:    [['pulse', '#ff3322'], ['fireBurst', '#ff5522'], ['spark', '#ff8844', 7]],
         } },
  // EXECUSIONER — ฟันขวาน: รอยฟัน + รอยร้าวหนัก (chop impact)
  ex:  { rarity: 'elite', theme: 'crit', affects: 'break', aura: ['shadow', '#cc3333'], on: { break: [['slash', '#ff5544', 1], ['breakCrack', '#ff7755', true]] } },
  // WHIZPER — GHOST PROTOCOL: เส้นความเร็วที่จุด AK47 + เงาจาง (ghost fade)
  wh:  { rarity: 'elite', theme: 'time', affects: 'break', aura: ['frost', '#aaffee'],  on: { ak47: [['streak', '#aaffee'], ['shadowBurst', '#cceeff', 0.45]] } },
  // GOBLIN WEEBER — WEEB FOCUS ตอน combo เต็ม: วงโฟกัส (ยิงที่ context 'combo' จริง)
  gl:  { rarity: 'elite', theme: 'analysis', affects: 'combo', aura: ['glow',  '#88cc44'],  on: { combo: [['comboRing', '#9bdc55'], ['flash', '#16240a']] } },
  // AMOG RA — น่าสงสัยส้ม-แดง: คลื่นมืดส้ม + สะเก็ด
  ar:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['fire',  '#ff7722'],  on: { break: [['shadowBurst', '#ff8833'], ['spark', '#ffaa44', 6]] } },
  // MAYA PROBLEM — bug/glitch + บอส: scanline glitch + พัลส์ตอน BREAK, boss flare ตอนล้มบอส
  mp:  { rarity: 'elite', theme: 'analysis', affects: 'enemy', aura: ['tech',  '#ff44aa'],  on: { break: [['glitch', '#ff44aa'], ['pulse', '#ff55bb']], boss: ['bossFlare', '#ff44aa'] } },
  // WEEBVIL DUDE — OTAKU AWAKENING (สาปแมลง): คลื่นมืด + พัลส์ม่วง
  ed:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['shadow', '#aa66cc'], on: { break: [['shadowBurst', '#bb77dd'], ['pulse', '#cc88ee']] } },
  // GHOSTPING — เกจ BREAK ผี: พัลส์จาง + รอยร้าวฟ้าซีด
  ghp: { rarity: 'elite', theme: 'time', affects: 'break', aura: ['frost', '#aaddff'],  on: { break: [['pulse', '#aaddff'], ['breakCrack', '#cce8ff']] } },
  // DEVILINGO — ปีศาจ + โลภ + โฟกัสบอส: เหรียญแดง + เส้นความเร็วตอน AK47, boss flare + ไฟตอนล้มบอส
  dvl: { rarity: 'elite', theme: 'zeny', affects: 'zeny', aura: ['fire',  '#ff3322'],  on: { ak47: [['coinBurst', '#ff6644'], ['streak', '#ff5533']], boss: [['bossFlare', '#ff2233'], ['fireBurst', '#ff4422']] } },
  // LADY TRAINEE — Spotlight ฝึกซ้อม (stack 0–15, ไม่มี pip): วงแหวนชาร์จ compact ตาม count
  // จริง (charge ring) ตอน OD Level Up, แสง holy ตอนเข้า OD, stage-light ตอนครบ Spotlight (10)
  ltn: { rarity: 'elite', theme: 'idol', affects: 'odBar', aura: ['holy',  '#ff99dd'],  on: { od: [['holyBurst', '#ff99dd'], ['comboRing', '#ffaae0']], odlevel: ['spark', '#ffaae0', 4], spotlight: [['holyBurst', '#ff99dd'], ['flash', '#2a1024']] } },

  // ── MYTHIC ──
  // THANABROS — Thanatos Phase (หยุดเวลา/มืด): วาบดำ + OD glow + คลื่นมืด + glitch บิดเวลา; AK47 ม่วงพัลส์
  th:  { rarity: 'mythic', theme: 'time', affects: 'timer', aura: ['shadow', '#cc00cc'], on: { thanatos: [['flash', '#1a0022'], ['odGlow', '#dd33dd'], ['shadowBurst', '#660066', 0.6], ['glitch', '#cc44cc']], ak47: [['spark', '#dd55dd', 6], ['pulse', '#cc33cc']] } },
  // BAPHOBET — DEVIL BET ปีศาจแดง: ไฟพุ่ง + ฟันสาม + คลื่นมืด; SIN Stack 0–5 (สะสมตอน AK47,
  // ไม่รีเซ็ตกลางรัน = buildup ดาเมจ) → pip ต่อ sin จริง; affects=enemy (สาปลงศัตรู)
  bh:  { rarity: 'mythic', theme: 'crit', affects: 'enemy', stack: { gain: 'sinstack', max: 5 }, aura: ['fire',  '#cc0000'],  on: { break: [['fireBurst', '#cc0000'], ['slash', '#ff2233', 3], ['shadowBurst', '#660000', 0.5]], sinstack: ['spark', '#ff3322', 4] } },
  // EDGEGA — Lv2 Burst เสือ: ไฟพุ่ง + เล็บสามรอย
  eg:  { rarity: 'mythic', theme: 'crit', affects: 'odBar', aura: ['fire',  '#ff6622'],  on: { od: [['fireBurst', '#ff6622'], ['slash', '#ff8844', 3]] } },
  // NOSIRIS — Soul Stack 0–5 (สะสมตอน BREAK) → JUDGMENT ตอนเต็ม 5: แสง holy ทอง + พัลส์,
  // pip ต่อ soul stack จริง (ctx.stack), เต็ม 5 = expire flourish (JUDGMENT/ปฏิเสธความตาย)
  os:  { rarity: 'mythic', theme: 'soul', affects: 'break', stack: { gain: 'soulstack', reset: 'judgment', max: 5 }, aura: ['gold',  '#ffdd66'],  on: { break: [['holyBurst', '#ffe07a'], ['pulse', '#ffd84a']], soulstack: ['spark', '#ffe07a', 4] } },
  // MISSSTRESS — ราชินีผึ้งสายฟ้าเหลือง: สายฟ้า + สะเก็ด + เหรียญ (zeny ตอน OD)
  mt:  { rarity: 'mythic', theme: 'zeny', affects: 'zeny', aura: ['gold',  '#ffdd00'],  on: { od: [['bolt', '#ffe21a'], ['spark', '#ffe85a', 6], ['coinBurst', '#ffe21a']] } },
  // GOLDEN BRUH — GOLD RUSH ระเบิดทองใหญ่ (ยิงที่ context 'combo' จริง ตอน combo เต็ม)
  gb:  { rarity: 'mythic', theme: 'zeny', affects: 'zeny', aura: ['gold',  '#ffcc00'],  on: { combo: [['flash', '#3a2e00'], ['coinBurst', '#ffcc00'], ['spark', '#ffe680', 8]] } },
  // COKE ZERO — ศูนย์ดำ-ขาวเย็น: วาบขาว + วงพัลส์ + คลื่นมืด (คอนทราสต์ดำ-ขาว)
  oh:  { rarity: 'mythic', theme: 'time', affects: 'break', aura: ['frost', '#e8f4ff'],  on: { break: [['flash', '#ffffff'], ['pulse', '#cfe8ff'], ['shadowBurst', '#0a0a0a', 0.5]] } },
  // LORD OF DEBT — DEBT CONTRACT โซ่เงา + เหรียญ (clear ตอน BREAK), เงาฟันตอน berserk hit;
  // affects=debt → ตัวนับ DEBT เดิม (#debtStackCounter) เรืองตอบสนองตอนหนี้เปลี่ยน (ไม่สร้าง UI ซ้ำ)
  ld:  { rarity: 'mythic', theme: 'zeny', affects: 'debt', aura: ['drain', '#9944cc'],  on: { break: [['drainPulse', '#9944cc'], ['coinBurst', '#b066dd']], hit: ['slash', '#7744aa', 1], debt: [['drainPulse', '#9944cc'], ['coinBurst', '#b066dd']] } },
  // CATULLANUX — ราชาแมว combo lock: รอยร้าวหนัก + วง lock
  kn:  { rarity: 'mythic', theme: 'analysis', affects: 'combo', aura: ['glow',  '#ffaa44'],  on: { break: [['breakCrack', '#ffbf6a', true], ['comboRing', '#ffcf8a']] } },
  // BEELZEBRUH — ฝูงแมลงพิษเขียว: คลื่นมืดเขียว + สะเก็ดฝูง
  bz:  { rarity: 'mythic', theme: 'soul', affects: 'break', aura: ['drain', '#88cc00'],  on: { break: [['shadowBurst', '#88cc00'], ['spark', '#a4dd2a', 7]] } },
  // VALKYRIZZ — ปีกศักดิ์สิทธิ์ + หอก: แสง holy + ฟันสว่าง
  vr:  { rarity: 'mythic', theme: 'idol', affects: 'break', aura: ['holy',  '#cc88ff'],  on: { break: [['holyBurst', '#d6a3ff'], ['slash', '#e0b8ff', 1]] } },
  // ATROSUS — Resonance อสูรเกรี้ยว: ไฟพุ่ง + เล็บสามรอยแดง
  at:  { rarity: 'mythic', theme: 'crit', affects: 'break', aura: ['fire',  '#ee3333'],  on: { break: [['fireBurst', '#ee3333'], ['slash', '#ff4444', 3]] } },
  // KILL-D01 — เลเซอร์หุ่นยนต์: glitch scanline + เส้นเลเซอร์ + วาบ
  kl:  { rarity: 'mythic', theme: 'analysis', affects: 'break', aura: ['tech',  '#00ffee'],  on: { break: [['glitch', '#00ffee'], ['streak', '#aaffff'], ['flash', '#003333']] } },
  // IFRIED — Inferno Stack สะสมตอนคริ (aura-only, ไม่มี pip): ember ตอนสะสม (throttle),
  // Inferno Burst ตอนครบ 10 = ไฟพุ่งใหญ่ + วาบ; affects=enemy (ไฟลงศัตรู)
  if:  { rarity: 'mythic', theme: 'crit', affects: 'enemy', aura: ['fire',  '#ff4400'],  on: { break: [['fireBurst', '#ff4400'], ['spark', '#ff7722', 7]], emberhit: ['spark', '#ff6622', 4], inferno: [['fireBurst', '#ff4400'], ['spark', '#ff8844', 8], ['flash', '#2a0a00']] } },
  // RSICK-0806 — ไซเบอร์ Execution: glitch + พัลส์แดง
  rx:  { rarity: 'mythic', theme: 'analysis', affects: 'enemy', aura: ['tech',  '#ff2233'],  on: { break: [['glitch', '#ff2233'], ['pulse', '#ff4455']] } },
  // FALLEN WECHAT — Overloaded BREAK เทวดาตก: glitch + คลื่นมืด + วาบดำ
  fwc: { rarity: 'mythic', theme: 'break', affects: 'break', aura: ['shadow', '#ff2233'], on: { break: [['glitch', '#ff2233'], ['shadowBurst', '#330008', 0.5], ['flash', '#1a0008']] } },
  // DETAILED — ANALYZED BREAK กริด/สแกนแม่นยำ: glitch + สะเก็ดกริด + วาบ; Analysis Stack 0–8
  // (สะสมตอนเก็บ WP, −2 ตอนพลาด, รีเซ็ตเมื่อ BREAK จบ) → pip ต่อ stack จริง, เต็ม 8 = ANALYSIS COMPLETE
  dtl: { rarity: 'mythic', theme: 'analysis', affects: 'break', stack: { gain: 'analysis', reset: 'analysisreset', max: 8 }, aura: ['tech',  '#00ffee'],  on: { break: [['glitch', '#00ffee'], ['spark', '#00ffee', 8], ['flash', '#003a3a']], analysis: ['spark', '#00ffee', 3] } },
  // GLOOM UNDER SIDE — OBSESSION (passive scaling 0–20, ไม่มี pip): aura "หนักขึ้น" ตาม tier
  // จริง (0–3) + พัลส์เงาตอนขึ้น tier; affects=timer (obsession กินเวลา) → นาฬิกาตอบสนอง
  gus: { rarity: 'mythic', theme: 'soul', affects: 'timer', aura: ['shadow', '#6633aa'], on: { break: [['shadowBurst', '#7d44c4', 0.6], ['shadowBurst', '#5522aa', 0.45]], gloom: ['shadowBurst', '#7d44c4', 0.5] } },
  // DARK STAKE LORD — Jackpot มืด: คลื่นมืด + เหรียญ + สะเก็ดหนาม (sinister jackpot)
  dsk: { rarity: 'mythic', theme: 'zeny', affects: 'zeny', aura: ['shadow', '#aa33ff'], on: { break: [['shadowBurst', '#aa33ff'], ['coinBurst', '#c266ff'], ['spark', '#cc77ff', 6]] } },
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
  const rarity = entry.rarity || '';
  const theme = entry.theme || '';
  // คลาส cv-aura เดิม (ขับ texture/จังหวะ) + คลาส .game-vfx-* สำหรับ passive-active
  // indicator แบบ data-driven (rarity/theme) ตาม spec ของระบบ.
  el.className = 'cv-aura cv-aura--' + style + ' game-vfx-active-card'
    + (rarity ? ' game-vfx-' + rarity : '')
    + (theme ? ' game-vfx-theme-' + theme : '');
  el.style.setProperty('--cv-aura', color);
  el.style.setProperty('--gv', color);
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
function clearActive() {
  clearCardAura(); clearStack(); clearCharge(); _auraTier = 0; _lastFire = {};
  // เคลียร์ particle ที่ค้างบน canvas layer ด้วย (จบรัน → ไม่ค้างข้ามรอบ)
  try { if (typeof window !== 'undefined' && window.CanvasVFX) window.CanvasVFX.clearCanvasVfx(); } catch (e) {}
}

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
  if (!entry) return;                    // ไม่ใช่ Elite/Mythic → safe no-op
  // throttle context ที่ยิงถี่ (เช่น hit ทุกคลิก) เพื่อกัน particle spam
  const thr = _THROTTLE[context];
  if (thr) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const key = id + ':' + context;
    if (_lastFire[key] && (now - _lastFire[key]) < thr) return;
    _lastFire[key] = now;
  }
  // 1) transient primitives (ถ้าการ์ดนี้มี mapping สำหรับ context นี้)
  if (entry.on && _layer()) {
    const spec = entry.on[context];
    if (spec) {
      // spec อาจเป็น primitive เดี่ยว ['flash', ...] หรือหลายตัว [['flash',...],['slash',...]]
      if (Array.isArray(spec[0])) spec.forEach((s) => _runPrim(s, ctx));
      else _runPrim(spec, ctx);
    }
  }
  // 2) stack / charge progress — ใช้ค่าจริงจาก ctx.stack (ส่งมาจาก game.js)
  const st = entry.stack;
  if (st) {
    if (context === st.gain) {
      const cur = (ctx && ctx.stack != null) ? ctx.stack
                : (_stack.id === id ? _stack.cur + 1 : 1);
      setStack(id, cur, (ctx && ctx.max) || st.max);
    } else if (context === st.reset) {
      if (_stack.id === id && _stack.cur > 0) expireStack();
    }
  }
  // 3) compact charge ring (ค่าจริงจาก ctx.charge — เช่น LADY TRAINEE OD charge)
  if (ctx && ctx.charge != null) setCharge(id, ctx.charge, ctx.chargeMax || ctx.max || 0);
  // 4) aura intensity build-up (ค่าจริงจาก ctx.tier — เช่น GLOOM obsession)
  if (ctx && ctx.tier != null) setAuraTier(id, ctx.tier);
  // 5) อิลิเมนต์ของเกมที่ได้รับผลจริงต้องตอบสนอง (ข้าม per-hit เพื่อกัน spam)
  if (entry.affects && context !== 'hit') {
    targetPulse(entry.affects, (entry.aura && entry.aura[1]), entry.theme);
  }
}

// ── signature colour (สำหรับ selection-moment accent บนหน้าจอเลือกการ์ด) ──────
// คืนสี aura ของการ์ด Elite/Mythic เพื่อให้ "ตอนเลือก" ใช้สีประจำใบเดียวกับตอนเล่น
// จริง (fire→ส้ม, frost→ฟ้า, …) — VFX_MAP เป็นแหล่งความจริงเดียว. คืน null ถ้า
// ไม่ใช่ Elite/Mythic. คอสเมติกล้วน ไม่อ่าน/เขียน logic การ์ด.
function pickColor(id) {
  const e = VFX_MAP[id];
  return (e && e.aura && typeof e.aura[1] === 'string') ? e.aura[1] : null;
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────
const CardVFX = {
  trigger: triggerCardVfx,
  triggerCardVfx,
  setCardAura,
  clearCardAura,
  setActiveCard,
  clearActive,
  pickColor,
  // ── gameplay-element reaction + stack/expire (อัปเกรดใหม่) ──
  targetPulse,          // ทำให้ HUD element ที่ได้รับผลจริงตอบสนอง
  setStack,             // วาดความคืบหน้าสแต็ก/ชาร์จ (ค่าจริงจาก game.js)
  clearStack,
  expireStack,          // เอฟเฟกต์จบ/รีเซ็ตสแต็ก
  setCharge,            // วงแหวนชาร์จ compact (เช่น LADY TRAINEE 0–15)
  clearCharge,
  setAuraTier,          // ความเข้ม aura แบบ build-up (เช่น GLOOM obsession)
  VFX_MAP,
  reducedMotion: () => _reduced,
};

if (typeof window !== 'undefined') window.CardVFX = CardVFX;

export { CardVFX, VFX_MAP };
