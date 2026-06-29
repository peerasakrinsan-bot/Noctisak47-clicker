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

// ── MOONLIGHT FEVER upgrade primitives ───────────────────────────────────────
// บุคลิก "ฟีเวอร์แสงจันทร์": surge / จังหวะฟีเวอร์ / คลื่นพลังจันทรา / สุริยุปราคา.
// canvas-first (เหมือน primitive อื่น) + DOM fallback ครบ. สีเงิน-ฟ้า-ม่วง-ไซแอน.

// moonPulse — พัลส์แสงจันทร์เป็นจังหวะฟีเวอร์ (variant 'peak' = ตอน OD ใหญ่กว่า)
function pMoonPulse(color, variant) {
  const c = _fighterCenter();
  if (_toCanvas('moonPulse', { color, variant, x: c.x, y: c.y })) return;
  const peak = (variant === 'peak');
  const dur = _dur(peak ? 0.62 : 0.5);
  const el = _take('cv-moonpulse' + (peak ? ' peak' : ''));
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#bcd0ff');
  el.style.setProperty('--md', dur + 's');
  el.innerHTML = '<i></i><i></i>';
  _emit(el, dur * 1000 + 180);
}

// crescentArc — จันทร์เสี้ยวกวาด/ลำแสงจันทร์ (รับพิกัด ctx.x/y เช่นจุด AK47)
function pCrescentArc(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('crescentArc', { color, count, x: p.x, y: p.y })) return;
  const dur = _dur(0.46);
  const el = _take('cv-crescent');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.setProperty('--cv', color || '#bcd0ff');
  el.style.animationDuration = dur + 's';
  _emit(el, dur * 1000 + 140);
}

// eclipseRing — วงสุริยุปราคา (แกนมืดจาง + โคโรนาสว่าง) สำหรับจังหวะ activate/burst
function pEclipseRing(color) {
  const c = _fighterCenter();
  if (_toCanvas('eclipseRing', { color, x: c.x, y: c.y })) return;
  const dur = _dur(0.6);
  const el = _take('cv-eclipse');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#cdd8ff');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i>';
  _emit(el, dur * 1000 + 160);
}

// lunarSpark — ประกายเงินถูกดูดเข้าเป้า (รับพิกัด ctx.x/y)
function pLunarSpark(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('lunarSpark', { color, count, x: p.x, y: p.y })) return;
  const dur = _dur(0.5);
  const n = _reduced ? 3 : (count || 8);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const rad = 50 + Math.random() * 40;
    const e = _take('cv-lunarspark');
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
    e.style.setProperty('--cv', color || '#eef3ff');
    e.style.setProperty('--dx', (Math.cos(ang) * rad) + 'px');
    e.style.setProperty('--dy', (Math.sin(ang) * rad) + 'px');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.02) + 's';
    _emit(e, dur * 1000 + i * 30 + 140);
  }
}

// feverWave — คลื่นแสงจันทร์นุ่ม ๆ แผ่ออก ขอบม่วง→ฟ้า
function pFeverWave(color) {
  const c = _fighterCenter();
  if (_toCanvas('feverWave', { color, x: c.x, y: c.y })) return;
  const dur = _dur(0.7);
  const el = _take('cv-feverwave');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#9a6cff');
  el.style.animationDuration = dur + 's';
  _emit(el, dur * 1000 + 180);
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

// ── DARK STAKE LORD primitives (cursed casino jackpot) ───────────────────────
// บุคลิก "เจ้าแห่งเดิมพันมืด": สล็อตคาสิโนต้องสาป / แจ็คพอต 777 / เหรียญทองต้องสาป /
// สะเก็ดดอกไพ่ / วงสัญญามืด / พัลส์เตือนเสี่ยง. สีดำ-แดงเข้ม-ทองต้องสาป-ม่วงเงา +
// เขียวนีออนนิด ๆ. canvas-first (เหมือน primitive อื่น) + DOM fallback ครบ.

// jackpotFlash — โมเมนต์ "แจ็คพอตแตก" 777 (วาบทอง-แดง + ก้านแสงสล็อต + ตัวเลข 777)
function pJackpotFlash(color) {
  const c = _fighterCenter();
  if (_toCanvas('jackpotFlash', { color: color || '#ffcc00', x: c.x, y: c.y })) return;
  const dur = _dur(0.7);
  const el = _take('cv-jackpot');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#ffcc00');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i><b>777</b>';
  _emit(el, dur * 1000 + 160);
}

// slotReel — วงล้อสล็อตหมุน (3 คอลัมน์ทอง/เขียว) — "เดิมพันกำลังหมุน"
function pSlotReel(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('slotReel', { color: color || '#d4af37', x: p.x, y: p.y })) return;
  const dur = _dur(0.5);
  const el = _take('cv-slotreel');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.setProperty('--cv', color || '#d4af37');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i><i></i><i></i>';
  _emit(el, dur * 1000 + 140);
}

// cursedCoin — เหรียญทองต้องสาปพุ่งขึ้นหา HUD (zeny) ขอบเขียวนีออน
function pCursedCoin(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('cursedCoin', { color: color || '#d4af37', x: p.x, y: p.y })) return;
  const dur = _dur(0.72);
  const n = _reduced ? 3 : 7;
  for (let i = 0; i < n; i++) {
    const el = _take('cv-ccoin');
    const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.3;
    const dist = 50 + Math.random() * 50;
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.style.setProperty('--cv', color || '#d4af37');
    el.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    el.style.setProperty('--dy', (Math.sin(ang) * dist - 40) + 'px');
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (i * 0.03) + 's';
    _emit(el, dur * 1000 + i * 40 + 120);
  }
}

// stakeRing — วงสัญญามืด/วงช็อกแดง-ดำ + ขอบทอง (red-black shock ring)
function pStakeRing(color) {
  const c = _fighterCenter();
  if (_toCanvas('stakeRing', { color: color || '#cc1133', x: c.x, y: c.y })) return;
  const dur = _dur(0.55);
  const el = _take('cv-stakering');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#cc1133');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i>';
  _emit(el, dur * 1000 + 120);
}

// suitSpark — สะเก็ดดอกไพ่ ♠♥♦♣ (poker chips / card-suit sparks)
function pSuitSpark(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('suitSpark', { color: color || '#39ff14', count, x: p.x, y: p.y })) return;
  const dur = _dur(0.55);
  const n = _reduced ? 3 : (count || 6);
  const SUITS = ['♠', '♥', '♦', '♣'];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 36 + Math.random() * 40;
    const el = _take('cv-suit');
    el.textContent = SUITS[i % 4];
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.style.setProperty('--cv', color || '#39ff14');
    el.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    el.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (i * 0.02) + 's';
    _emit(el, dur * 1000 + i * 30 + 120);
  }
}

// riskPulse — พัลส์เตือนเสี่ยง (red warning flicker) ตอนเดิมพันยังไม่จ่าย (odds ขึ้น)
function pRiskPulse(color) {
  const c = _fighterCenter();
  if (_toCanvas('riskPulse', { color: color || '#cc1133', x: c.x, y: c.y })) return;
  const dur = _dur(0.42);
  const el = _take('cv-riskpulse');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#cc1133');
  el.style.animationDuration = dur + 's';
  _emit(el, dur * 1000 + 100);
}

// ── BAPHOBET primitives (demon contract / devil bet) ─────────────────────────
// บุคลิก "สัญญาปีศาจ / เดิมพันต้องสาป": ยันต์ปีศาจ / วงสัญญานรก / สะเก็ดบาปดูดเข้า /
// แจ็คพอตนรกจ่าย / คลื่นไฟต้องสาป / วงช็อกเลือด-ดำ. ดำ-แดงเลือด-ส้มนรก-ทองต้องสาป-
// ม่วงเงา. canvas-first (เหมือน primitive อื่น) + DOM fallback ครบ.

// demonSigil — ยันต์/ตราสัญญาปีศาจวาบ (รับพิกัด ctx.x/y เช่นจุดศัตรู/AK47)
function pDemonSigil(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('demonSigil', { color: color || '#cc0011', x: p.x, y: p.y })) return;
  const dur = _dur(0.6);
  const el = _take('cv-demonsigil');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.setProperty('--cv', color || '#cc0011');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i><i></i>';
  _emit(el, dur * 1000 + 140);
}

// contractRing — วงสัญญานรก (แกนมืดยุบ + ขอบแดงแผ่ออก)
function pContractRing(color) {
  const c = _fighterCenter();
  if (_toCanvas('contractRing', { color: color || '#aa0000', x: c.x, y: c.y })) return;
  const dur = _dur(0.55);
  const el = _take('cv-contractring');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#aa0000');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i>';
  _emit(el, dur * 1000 + 120);
}

// sinEmber — สะเก็ดบาปถูกดูดเข้าหาเป้า (embers pulled inward; รับพิกัด ctx.x/y)
function pSinEmber(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('sinEmber', { color: color || '#ff5522', count, x: p.x, y: p.y })) return;
  const dur = _dur(0.5);
  const n = _reduced ? 3 : (count || 6);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const rad = 48 + Math.random() * 40;
    const e = _take('cv-sinember');
    e.style.left = (p.x + Math.cos(ang) * rad) + 'px';
    e.style.top = (p.y + Math.sin(ang) * rad) + 'px';
    e.style.setProperty('--cv', color || '#ff5522');
    e.style.setProperty('--dx', (-Math.cos(ang) * rad) + 'px');
    e.style.setProperty('--dy', (-Math.sin(ang) * rad) + 'px');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.02) + 's';
    _emit(e, dur * 1000 + i * 30 + 120);
  }
}

// devilBetBurst — DEVIL BET จ่าย: แกนระเบิดทองต้องสาป + สะเก็ดกระจาย (รับพิกัด ctx.x/y)
function pDevilBetBurst(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('devilBetBurst', { color: color || '#ffcc33', x: p.x, y: p.y })) return;
  const dur = _dur(0.62);
  const el = _take('cv-devilbet');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.setProperty('--cv', color || '#ffcc33');
  el.style.animationDuration = dur + 's';
  _emit(el, dur * 1000 + 120);
  const n = _reduced ? 3 : 8;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const dist = 40 + Math.random() * 44;
    const e = _take('cv-spark');
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
    e.style.setProperty('--cv', color || '#ffcc33');
    e.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    e.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    e.style.animationDuration = dur + 's';
    _emit(e, dur * 1000 + 100);
  }
}

// cursedFlame — คลื่นไฟต้องสาป (แกนไฟ + embers ลอยขึ้น; รับพิกัด ctx.x/y)
function pCursedFlame(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('cursedFlame', { color: color || '#ff4400', x: p.x, y: p.y })) return;
  const dur = _dur(0.6);
  const el = _take('cv-cursedflame');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.setProperty('--cv', color || '#ff4400');
  el.style.animationDuration = dur + 's';
  _emit(el, dur * 1000 + 100);
  const n = _reduced ? 2 : 5;
  for (let i = 0; i < n; i++) {
    const e = _take('cv-ember');                 // reuse fireBurst ember class
    const dx = (Math.random() - 0.5) * 50;
    const rise = 40 + Math.random() * 44;
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
    e.style.setProperty('--cv', color || '#ff6622');
    e.style.setProperty('--dx', dx + 'px');
    e.style.setProperty('--dy', -rise + 'px');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.03) + 's';
    _emit(e, dur * 1000 + i * 40 + 100);
  }
}

// bloodShock — วงช็อกเลือด-ดำ (red-black shock ring)
function pBloodShock(color) {
  const c = _fighterCenter();
  if (_toCanvas('bloodShock', { color: color || '#cc0011', x: c.x, y: c.y })) return;
  const dur = _dur(0.5);
  const el = _take('cv-bloodshock');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#cc0011');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i>';
  _emit(el, dur * 1000 + 100);
}

// ── LORD OF DEBT primitives (debt contract / accumulating obligation) ────────
// บุคลิก "สัญญาหนี้ต้องสาป / ภาระสะสม / การทวงคืนที่หลีกเลี่ยงไม่ได้": ตราสัญญาหนี้
// ประทับลง / โซ่ผูกมัดรัดเข้า / ตัวเลขดอกเบี้ยลอยขึ้น / หลุมทวงหนี้ดูดเข้า / เหรียญ
// ต้องสาปถูกสูบจ่าย / ตราสัญญาแตก (ปลดหนี้). ม่วงต้องสาป-ทองบัญชี-ดำเหว.
// canvas-first (เหมือน primitive อื่น) + DOM fallback ครบ.

// debtSeal — ตราสัญญาหนี้ประทับลง (สีตามพลังต้องห้ามที่เพิ่งเซ็น ส่งผ่าน ctx.color → '$state')
function pDebtSeal(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('debtSeal', { color: color || '#b066dd', x: p.x, y: p.y })) return;
  const dur = _dur(0.62);
  const el = _take('cv-debtseal');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.setProperty('--cv', color || '#b066dd');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i><i></i><b></b>';
  _emit(el, dur * 1000 + 140);
}

// debtChain — โซ่เงาผูกมัด "รัดเข้า" หาเป้า (binding chains tighten inward; รับพิกัด ctx.x/y)
function pDebtChain(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('debtChain', { color: color || '#9944cc', count, x: p.x, y: p.y })) return;
  const dur = _dur(0.5);
  const n = _reduced ? 2 : (count || 3);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const rad = 52 + Math.random() * 30;
    const el = _take('cv-debtchain');
    el.style.left = (p.x + Math.cos(ang) * rad) + 'px';
    el.style.top = (p.y + Math.sin(ang) * rad) + 'px';
    el.style.setProperty('--cv', color || '#9944cc');
    el.style.setProperty('--dx', (-Math.cos(ang) * rad) + 'px');
    el.style.setProperty('--dy', (-Math.sin(ang) * rad) + 'px');
    el.style.setProperty('--rot', (ang * 180 / Math.PI) + 'deg');
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (i * 0.03) + 's';
    _emit(el, dur * 1000 + i * 40 + 120);
  }
}

// ledgerGlyph — ตัวเลข/สัญลักษณ์ดอกเบี้ยลอยขึ้น (rising debt/interest glyphs; รับพิกัด ctx.x/y)
function pLedgerGlyph(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('ledgerGlyph', { color: color || '#d4a017', count, x: p.x, y: p.y })) return;
  const dur = _dur(0.7);
  const n = _reduced ? 2 : (count || 4);
  const GLYPHS = ['฿', '¥', '%', '$', '↑'];
  for (let i = 0; i < n; i++) {
    const el = _take('cv-ledgerglyph');
    el.textContent = GLYPHS[i % GLYPHS.length];
    el.style.left = (p.x + (Math.random() - 0.5) * 60) + 'px';
    el.style.top = p.y + 'px';
    el.style.setProperty('--cv', color || '#d4a017');
    el.style.setProperty('--dy', -(40 + Math.random() * 44) + 'px');
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (i * 0.05) + 's';
    _emit(el, dur * 1000 + i * 60 + 140);
  }
}

// collectorPull — หลุมทวงหนี้ดูดเข้า (inevitable-collection gravity well; แกนเหว + สะเก็ดลู่เข้า)
function pCollectorPull(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('collectorPull', { color: color || '#aa33ff', x: p.x, y: p.y })) return;
  const dur = _dur(0.62);
  const el = _take('cv-collectorpull');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.setProperty('--cv', color || '#aa33ff');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i><i></i>';
  _emit(el, dur * 1000 + 140);
  const n = _reduced ? 3 : 7;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const rad = 56 + Math.random() * 40;
    const e = _take('cv-spark');
    e.style.left = (p.x + Math.cos(ang) * rad) + 'px';
    e.style.top = (p.y + Math.sin(ang) * rad) + 'px';
    e.style.setProperty('--cv', color || '#cc66ff');
    e.style.setProperty('--dx', (-Math.cos(ang) * rad) + 'px');
    e.style.setProperty('--dy', (-Math.sin(ang) * rad) + 'px');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.02) + 's';
    _emit(e, dur * 1000 + i * 30 + 120);
  }
}

// debtCoinDrain — เหรียญต้องสาปถูก "สูบจ่าย" ลงล่าง (cursed coins siphoned away; รับพิกัด ctx.x/y)
function pDebtCoinDrain(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('debtCoinDrain', { color: color || '#d4a017', x: p.x, y: p.y })) return;
  const dur = _dur(0.7);
  const n = _reduced ? 3 : 7;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const rad = 30 + Math.random() * 40;
    const el = _take('cv-debtcoin');
    el.style.left = (p.x + Math.cos(ang) * rad) + 'px';
    el.style.top = (p.y + Math.sin(ang) * rad - 10) + 'px';
    el.style.setProperty('--cv', color || '#d4a017');
    el.style.setProperty('--dx', (-Math.cos(ang) * rad * 0.7) + 'px');
    el.style.setProperty('--dy', (44 + Math.random() * 40) + 'px'); // siphon downward (paying debt)
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (i * 0.03) + 's';
    _emit(el, dur * 1000 + i * 40 + 120);
  }
}

// sealBreak — ตราสัญญาแตก + คลื่นปลดหนี้ (shattered contract seal + relief shockwave)
function pSealBreak(color) {
  const c = _fighterCenter();
  if (_toCanvas('sealBreak', { color: color || '#b066dd', x: c.x, y: c.y })) return;
  const dur = _dur(0.5);
  const el = _take('cv-sealbreak');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#b066dd');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i><span></span><span></span><span></span><span></span>';
  _emit(el, dur * 1000 + 120);
}

// ── THANABROS primitives (death / time-stop reaping) ─────────────────────────
// บุคลิก "ตัดเวลา / มือมรณะ / เก็บเกี่ยววิญญาณ": นาฬิกาหยุดเวลา / รอยแยกเหวมรณะ /
// เคียวมรณะกวาด / ระฆังมรณะกังวาน / วิญญาณถูกเก็บเข้า. ม่วงมรณะ-ดำเหว-ขาวสเปกตรัล.
// canvas-first (เหมือน primitive อื่น) + DOM fallback ครบ.

// timeStop — นาฬิกาหยุดเวลา (หน้าปัดหมุนเร็วแล้ว "หยุด")
function pTimeStop(color) {
  const c = _fighterCenter();
  if (_toCanvas('timeStop', { color: color || '#e0b3ff', x: c.x, y: c.y })) return;
  const dur = _dur(0.7);
  const el = _take('cv-tstop');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#e0b3ff');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i><i></i>';
  _emit(el, dur * 1000 + 140);
}

// voidRift — รอยแยกเหวมรณะ (death-gate void tear เปิดออก)
function pVoidRift(color) {
  const c = _fighterCenter();
  if (_toCanvas('voidRift', { color: color || '#660066', x: c.x, y: c.y })) return;
  const dur = _dur(0.6);
  const el = _take('cv-vrift');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#660066');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i>';
  _emit(el, dur * 1000 + 120);
}

// reaperScythe — เคียวมรณะกวาดข้าม (รับพิกัด ctx.x/y เช่นจุด AK47)
function pReaperScythe(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('reaperScythe', { color: color || '#cc44cc', count, x: p.x, y: p.y })) return;
  const dur = _dur(0.5);
  const n = _reduced ? 1 : (count || 2);
  for (let i = 0; i < n; i++) {
    const el = _take('cv-scythe');
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.style.setProperty('--cv', color || '#cc44cc');
    el.style.setProperty('--rot', (i * 180) + 'deg');
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (i * 0.06) + 's';
    _emit(el, dur * 1000 + i * 70 + 120);
  }
}

// deathKnell — ระฆังมรณะกังวาน (tolling shockwave วงซ้อน)
function pDeathKnell(color) {
  const c = _fighterCenter();
  if (_toCanvas('deathKnell', { color: color || '#cc00cc', x: c.x, y: c.y })) return;
  const dur = _dur(0.7);
  const el = _take('cv-knell');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#cc00cc');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i><i></i>';
  _emit(el, dur * 1000 + 140);
}

// soulReap — วิญญาณถูกเก็บเข้าหาศูนย์กลาง (souls pulled inward; รับพิกัด ctx.x/y)
function pSoulReap(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('soulReap', { color: color || '#dd99ff', count, x: p.x, y: p.y })) return;
  const dur = _dur(0.6);
  const n = _reduced ? 3 : (count || 8);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const rad = 56 + Math.random() * 46;
    const e = _take('cv-wisp');
    e.style.left = (p.x + Math.cos(ang) * rad) + 'px';
    e.style.top = (p.y + Math.sin(ang) * rad) + 'px';
    e.style.setProperty('--cv', color || '#dd99ff');
    e.style.setProperty('--dx', (-Math.cos(ang) * rad) + 'px');
    e.style.setProperty('--dy', (-Math.sin(ang) * rad) + 'px');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.02) + 's';
    _emit(e, dur * 1000 + i * 30 + 120);
  }
}

// ── fire-clone differentiators (EDGEGA claw / ATROSUS resonance) ─────────────
// แยกบุคลิกการ์ดไฟสามใบให้ต่างกัน: IFRIED = ไฟ/อินเฟอร์โน (เจ้าของไฟ), EDGEGA =
// รอยเล็บเสือปะทุ (claw rake), ATROSUS = คลื่นเรโซแนนซ์อสูร (harmonic wave).

// clawRake — รอยเล็บกรงเล็บเสือ 3–4 เส้นโค้งขนาน + สะเก็ดคม (รับพิกัด ctx.x/y)
function pClawRake(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('clawRake', { color: color || '#ff7733', count, x: p.x, y: p.y })) return;
  const dur = _dur(0.42);
  const n = _reduced ? 2 : (count || 4);
  for (let i = 0; i < n; i++) {
    const el = _take('cv-claw');
    el.style.left = p.x + 'px'; el.style.top = (p.y + (i - (n - 1) / 2) * 16) + 'px';
    el.style.setProperty('--cv', color || '#ff7733');
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (i * 0.04) + 's';
    _emit(el, dur * 1000 + i * 50 + 100);
  }
}

// resonanceWave — คลื่นเรโซแนนซ์ขยายเป็นจังหวะซ้อน (harmonic resonance)
function pResonanceWave(color) {
  const c = _fighterCenter();
  if (_toCanvas('resonanceWave', { color: color || '#ee3333', x: c.x, y: c.y })) return;
  const dur = _dur(0.7);
  const n = _reduced ? 1 : 3;
  for (let i = 0; i < n; i++) {
    const el = _take('cv-rwave');
    el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
    el.style.setProperty('--cv', color || '#ee3333');
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (i * 0.13) + 's';
    _emit(el, dur * 1000 + i * 140 + 120);
  }
}

// ── unexpressed-fantasy primitives (swarm / lock / zero / corruption) ────────
// ให้การ์ดที่บุคลิกยังไม่ออกได้ "เป็นตัวเอง": ฝูงแมลง (BEELZEBRUH/MISSSTRESS) /
// คอมโบล็อก (CATULLANUX) / สุญญากาศศูนย์ (COKE ZERO) / ไวรัสคอร์รัปต์ (RSICK-0806).

// insectSwarm — ฝูงแมลงบินส่าย (buzz) แล้วกระจาย (รับพิกัด ctx.x/y). สีเขียว=แมลงวัน / ทอง=ผึ้ง
function pInsectSwarm(color, count, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('insectSwarm', { color: color || '#88cc00', count, x: p.x, y: p.y })) return;
  const dur = _dur(0.6);
  const n = _reduced ? 4 : (count || 10);
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 10 + Math.random() * 40;
    const e = _take('cv-swarm');
    e.style.left = (p.x + Math.cos(ang) * rad) + 'px';
    e.style.top = (p.y + Math.sin(ang) * rad) + 'px';
    e.style.setProperty('--cv', color || '#88cc00');
    e.style.setProperty('--dx', ((Math.random() - 0.5) * 50) + 'px');
    e.style.setProperty('--dy', (-20 + (Math.random() - 0.5) * 50) + 'px');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.015) + 's';
    _emit(e, dur * 1000 + i * 20 + 120);
  }
}

// comboLock — วงเล็บเป้าหมาย 4 มุมหุบเข้า "ล็อก" (combo lock)
function pComboLock(color) {
  const c = _fighterCenter();
  if (_toCanvas('comboLock', { color: color || '#ffaa44', x: c.x, y: c.y })) return;
  const dur = _dur(0.55);
  const el = _take('cv-lock');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#ffaa44');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i><i></i><i></i><i></i>';
  _emit(el, dur * 1000 + 120);
}

// voidZero — วงขาว + แกนดำสุญญากาศ หดยุบเข้าหา "ศูนย์" (ZERO annihilation)
function pVoidZero(color) {
  const c = _fighterCenter();
  if (_toCanvas('voidZero', { color: color || '#e8f4ff', x: c.x, y: c.y })) return;
  const dur = _dur(0.6);
  const el = _take('cv-vzero');
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  el.style.setProperty('--cv', color || '#e8f4ff');
  el.style.animationDuration = dur + 's';
  el.innerHTML = '<i></i>';
  _emit(el, dur * 1000 + 120);
}

// ── GOLDEN BRUH primitive (MIDAS GOLD RUSH treasure eruption) ────────────────
// บุคลิก "เจ้าแห่งทองคำ / รวยปะทุ": แกนทองกิลด์วาบ + วงช็อกทองแผ่ออก + น้ำพุทองคำแท่ง
// (gold ingot fountain — รูปแท่งทอง ไม่ใช่เหรียญ/สะเก็ดกลม) พุ่งขึ้นแล้วร่วงลงตามแรง
// โน้มถ่วง + เครื่องหมาย "$" ยักษ์ลอยขึ้น. ทองสุกใสล้วน (ทองสว่าง+ขาวอุ่น) — ต่างชัด
// จาก DARK STAKE LORD (ทองมืดคาสิโน/777/ดอกไพ่), MISSSTRESS (ผึ้ง+สายฟ้า+เหรียญ),
// DRAKE (น้ำพุเหรียญโจรสลัด). canvas-first + DOM fallback ครบ (reuse class เดิม).
function pGoldRush(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('goldRush', { color: color || '#ffcc00', x: p.x, y: p.y })) return;
  const dur = _dur(0.8);
  // แกนทองกิลด์ (gilded core glow)
  const core = _take('cv-odglow');
  core.style.left = p.x + 'px'; core.style.top = p.y + 'px';
  core.style.setProperty('--cv', color || '#ffd24a');
  core.style.animationDuration = _dur(0.5) + 's';
  _emit(core, _dur(0.5) * 1000 + 80);
  // น้ำพุทองคำแท่ง (gold ingot fountain — reuse cv-coin เป็น fallback)
  const n = _reduced ? 4 : 9;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.26;
    const dist = 46 + Math.random() * 52;
    const e = _take('cv-coin');
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
    e.style.setProperty('--cv', color || '#ffcc00');
    e.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    e.style.setProperty('--dy', (Math.sin(ang) * dist - 24) + 'px');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.03) + 's';
    _emit(e, dur * 1000 + i * 40 + 120);
  }
  // เครื่องหมาย "$" ยักษ์ลอยขึ้น (treasure mega-glyph — reuse cv-ledgerglyph)
  if (!_reduced) {
    const g = _take('cv-ledgerglyph');
    g.textContent = '$';
    g.style.left = p.x + 'px'; g.style.top = (p.y - 8) + 'px';
    g.style.setProperty('--cv', color || '#ffe680');
    g.style.setProperty('--dy', '-54px');
    g.style.fontSize = '40px';
    g.style.animationDuration = dur + 's';
    _emit(g, dur * 1000 + 140);
  }
}

// ── VALKYRIZZ primitive (celestial valkyrie descent / divine blessing) ───────
// บุคลิก "วาลคีรีแห่ง Randgris": ปีกขนนกศักดิ์สิทธิ์กางออก + หอกแสง (light lance) ทิ่ม
// ลงจากสวรรค์ + ขนนกร่วง + (peak) วงรูนทอง. ขาว-ทอง-ม่วงเทพ (celestial). silhouette
// "ปีก + หอก" ต่างชัดจาก NOSIRIS (holyBurst รัศมีก้าน soul/ทอง→ม่วง) และ LADY TRAINEE
// (สปอตไลต์/charge ring). variant 'peak' = VALKYRIE SWAP จังหวะเทพลง (ใหญ่/รูนวง).
// canvas-first + DOM fallback ครบ (reuse class เดิม).
function pValkyrieDescend(color, variant, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('valkyrieDescend', { color: color || '#cc88ff', variant, x: p.x, y: p.y })) return;
  const peak = (variant === 'peak');
  const dur = _dur(peak ? 0.85 : 0.6);
  // ปีกศักดิ์สิทธิ์ (reuse holyBurst-ish core) + หอกแสงทิ่มลง (reuse cv-slash แนวตั้ง)
  const wing = _take('cv-holyburst');
  wing.style.left = p.x + 'px'; wing.style.top = p.y + 'px';
  wing.style.setProperty('--cv', color || '#cc88ff');
  wing.style.animationDuration = dur + 's';
  wing.innerHTML = '<i class="cv-holy-core"></i><i class="cv-holy-rays"></i>';
  _emit(wing, dur * 1000 + 100);
  // หอกแสงทิ่มลง (descending light spear) — reuse cv-slash ตั้งตรง
  const spear = _take('cv-slash');
  spear.style.left = p.x + 'px'; spear.style.top = (p.y - 6) + 'px';
  spear.style.setProperty('--cv', '#ffe9ff');
  spear.style.setProperty('--rot', '90deg');
  spear.style.animationDuration = _dur(peak ? 0.5 : 0.4) + 's';
  _emit(spear, _dur(0.5) * 1000 + 90);
  // ขนนกร่วง (feathers) — reuse cv-spark โทนขาว-ม่วง
  const n = _reduced ? 3 : (peak ? 9 : 5);
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5;
    const dist = 34 + Math.random() * 42;
    const e = _take('cv-spark');
    e.style.left = p.x + 'px'; e.style.top = (p.y - 16) + 'px';
    e.style.setProperty('--cv', (i % 2) ? (color || '#cc88ff') : '#ffe9ff');
    e.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    e.style.setProperty('--dy', (Math.abs(Math.sin(ang)) * dist + 26) + 'px');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.02) + 's';
    _emit(e, dur * 1000 + i * 30 + 120);
  }
}

// ── GLOOM UNDER SIDE primitive (creeping obsession / devouring gloom) ────────
// บุคลิก "ความหมกมุ่นจากเบื้องล่าง / ถูกกลืนกินทีละน้อย": ดวงตา GLOOM จ้องเขม็ง (obsession)
// + หนวดเงาทะยานคว้าจากด้านล่าง (grasping tendrils) + (peak) ดูดกลืนเข้า. ม่วงเข้ม-ดำเหว.
// silhouette "ดวงตา + หนวดเงา" จำได้แม้เป็นเงาดำล้วน — อารมณ์ กดดัน/หวาดหวั่น. tier ('$tier'
// 0–3 จาก obsession จริง) ขับความสูง/จำนวนหนวด (progressive). variant 'max' = MAX OBSESSION
// (signature moment: ตาเบิกเต็ม + กลืนเวลา). canvas-first + DOM fallback ครบ.
function pGloomSurge(color, tier, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('gloomSurge', { color: color || '#6633aa', tier, x: p.x, y: p.y })) return;
  const max = (tier === 'max');
  const tl = max ? 4 : Math.max(1, (tier | 0) || 1);
  const dur = _dur(max ? 0.85 : 0.6);
  // ดวงตา GLOOM (reuse cv-pulse เป็นวงตา fallback)
  const eye = _take('cv-pulse');
  eye.style.left = p.x + 'px'; eye.style.top = (p.y - 6) + 'px';
  eye.style.setProperty('--cv', color || '#6633aa');
  eye.style.animationDuration = dur + 's';
  _emit(eye, dur * 1000 + 90);
  // หนวดเงาทะยานจากด้านล่าง (reuse cv-streak โทนม่วงเข้ม) — จำนวนตาม tier
  const n = _reduced ? 2 : (max ? 9 : (2 + tl * 2));
  const baseY = p.y + (max ? 60 : 44);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * (max ? 24 : 28);
    const e = _take('cv-streak');
    e.style.left = (p.x + off) + 'px'; e.style.top = baseY + 'px';
    e.style.setProperty('--cv', color || '#7d44c4');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.02) + 's';
    _emit(e, dur * 1000 + i * 30 + 120);
  }
}

// ── KILL-D01 primitives (war-machine drive core / laser cannon) ──────────────
// บุคลิก "หุ่นรบจักรกล / แกนขับเคลื่อนชาร์จพลัง / ปืนเลเซอร์ประหาร": แกนพลังงานหกเหลี่ยม
// หมุน (drive core) + วงจรไฟฟ้าลู่เข้าชาร์จ (mechaCharge) → ลำเลเซอร์ปืนใหญ่ฟาดลง + reticle
// ล็อกเป้า (mechaLaser). ไซแอน-ขาว เครื่องจักรเย็นชา. silhouette "หกเหลี่ยม+ลำเลเซอร์+reticle"
// ต่างจาก DETAILED (สแกนไลน์วิเคราะห์) และ RSICK (บล็อกไวรัสแดง). canvas-first + DOM fallback.
function pMechaCharge(color, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('mechaCharge', { color: color || '#00ffee', x: p.x, y: p.y })) return;
  const dur = _dur(0.5);
  const core = _take('cv-odglow');
  core.style.left = p.x + 'px'; core.style.top = p.y + 'px';
  core.style.setProperty('--cv', color || '#00ffee');
  core.style.animationDuration = dur + 's';
  _emit(core, dur * 1000 + 80);
  // วงจรลู่เข้า (charging circuit sparks pulled inward)
  const n = _reduced ? 3 : 6;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const rad = 40 + Math.random() * 26;
    const e = _take('cv-spark');
    e.style.left = (p.x + Math.cos(ang) * rad) + 'px';
    e.style.top = (p.y + Math.sin(ang) * rad) + 'px';
    e.style.setProperty('--cv', color || '#00ffee');
    e.style.setProperty('--dx', (-Math.cos(ang) * rad) + 'px');
    e.style.setProperty('--dy', (-Math.sin(ang) * rad) + 'px');
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = (i * 0.02) + 's';
    _emit(e, dur * 1000 + i * 30 + 100);
  }
}
function pMechaLaser(color, variant, x, y) {
  const p = (x === undefined) ? _fighterCenter() : { x, y };
  if (_toCanvas('mechaLaser', { color: color || '#00ffee', variant, x: p.x, y: p.y })) return;
  const max = (variant === 'max');
  const dur = _dur(max ? 0.6 : 0.45);
  // ลำเลเซอร์ (vertical beam — reuse cv-slash ตั้งตรง)
  const beam = _take('cv-slash');
  beam.style.left = p.x + 'px'; beam.style.top = p.y + 'px';
  beam.style.setProperty('--cv', color || '#00ffee');
  beam.style.setProperty('--rot', '90deg');
  beam.style.animationDuration = dur + 's';
  _emit(beam, dur * 1000 + 90);
  // reticle ล็อกเป้า (reuse cv-pulse)
  const ret = _take('cv-pulse');
  ret.style.left = p.x + 'px'; ret.style.top = p.y + 'px';
  ret.style.setProperty('--cv', color || '#00ffee');
  ret.style.animationDuration = dur + 's';
  _emit(ret, dur * 1000 + 90);
  // สะเก็ดอิมแพกต์
  const n = _reduced ? 3 : (max ? 9 : 5);
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.4;
    const dist = 30 + Math.random() * 40;
    const e = _take('cv-spark');
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
    e.style.setProperty('--cv', max ? '#aaffff' : (color || '#00ffee'));
    e.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    e.style.setProperty('--dy', (Math.sin(ang) * dist * 0.5) + 'px');
    e.style.animationDuration = dur + 's';
    _emit(e, dur * 1000 + i * 24 + 100);
  }
}

// corruptGlitch — บล็อกดิจิทัลคอร์รัปต์กระตุก (viral corruption; ต่างจาก scanline glitch)
function pCorruptGlitch(color) {
  if (_toCanvas('corruptGlitch', { color: color || '#ff2233' })) return;
  const dur = _dur(0.4);
  const el = _take('cv-cglitch');
  el.style.setProperty('--cv', color || '#ff2233');
  el.style.animationDuration = dur + 's';
  const n = _reduced ? 2 : 7;
  let html = '';
  for (let i = 0; i < n; i++) {
    const top = 12 + Math.random() * 70, left = Math.random() * 78;
    const w = 8 + Math.random() * 34, h = 3 + Math.random() * 10;
    html += `<i style="top:${top}%;left:${left}%;width:${w}px;height:${h}px;animation-delay:${(i * 0.03).toFixed(2)}s"></i>`;
  }
  el.innerHTML = html;
  _emit(el, dur * 1000 + 120);
}

// dispatcher: ชื่อ primitive → ฟังก์ชัน (ใช้ใน VFX_MAP แบบ data-driven)
const PRIM = {
  flash: pFlash, pulse: pPulse, slash: pSlash, spark: pSpark,
  shadowBurst: pShadowBurst, coinBurst: pCoinBurst, breakCrack: pBreakCrack,
  odGlow: pOdGlow, streak: pStreak, drainPulse: pDrainPulse,
  comboRing: pComboRing, bossFlare: pBossFlare, moonRing: pMoonRing,
  bolt: pBolt, fireBurst: pFireBurst, holyBurst: pHolyBurst, glitch: pGlitch,
  moonPulse: pMoonPulse, crescentArc: pCrescentArc, eclipseRing: pEclipseRing,
  lunarSpark: pLunarSpark, feverWave: pFeverWave,
  jackpotFlash: pJackpotFlash, slotReel: pSlotReel, cursedCoin: pCursedCoin,
  stakeRing: pStakeRing, suitSpark: pSuitSpark, riskPulse: pRiskPulse,
  demonSigil: pDemonSigil, contractRing: pContractRing, sinEmber: pSinEmber,
  devilBetBurst: pDevilBetBurst, cursedFlame: pCursedFlame, bloodShock: pBloodShock,
  debtSeal: pDebtSeal, debtChain: pDebtChain, ledgerGlyph: pLedgerGlyph,
  collectorPull: pCollectorPull, debtCoinDrain: pDebtCoinDrain, sealBreak: pSealBreak,
  timeStop: pTimeStop, voidRift: pVoidRift, reaperScythe: pReaperScythe,
  deathKnell: pDeathKnell, soulReap: pSoulReap,
  clawRake: pClawRake, resonanceWave: pResonanceWave,
  insectSwarm: pInsectSwarm, comboLock: pComboLock, voidZero: pVoidZero, corruptGlitch: pCorruptGlitch,
  goldRush: pGoldRush, valkyrieDescend: pValkyrieDescend, gloomSurge: pGloomSurge,
  mechaCharge: pMechaCharge, mechaLaser: pMechaLaser,
};

// primitive ไหนรับพิกัด (x,y) → ใช้ map นี้ฉีดค่า ctx.x/ctx.y เข้า args ตำแหน่งที่ถูกต้อง
const COORD_ARG = {
  spark: [2, 3], coinBurst: [1, 2], streak: [1, 2], bolt: [1, 2], fireBurst: [1, 2],
  crescentArc: [2, 3], lunarSpark: [2, 3],
  slotReel: [1, 2], cursedCoin: [1, 2], suitSpark: [2, 3],
  demonSigil: [1, 2], sinEmber: [2, 3], devilBetBurst: [1, 2], cursedFlame: [1, 2],
  debtSeal: [1, 2], debtChain: [2, 3], ledgerGlyph: [2, 3],
  collectorPull: [1, 2], debtCoinDrain: [1, 2],
  reaperScythe: [2, 3], soulReap: [2, 3],
  clawRake: [2, 3], insectSwarm: [2, 3],
  goldRush: [1, 2], valkyrieDescend: [2, 3], gloomSurge: [2, 3],
  mechaCharge: [1, 2], mechaLaser: [2, 3],
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
// HUD-pulse throttle — กัน score/combo/timer/OD pulse กระพริบรัวทุกเฟรมตอน damage
// spam หรือหลายเอฟเฟกต์ยิงพร้อมกัน (worst case: OD + boss skill + card payoff).
// คอสเมติกล้วน: pulse ที่ถี่เกินถูกข้าม (อันแรกในหน้าต่างยังเล่นครบ).
const _PULSE_THROTTLE = 90; // ms ต่อ target element
const _lastPulse = {};
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
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (_lastPulse[key] && (now - _lastPulse[key]) < _PULSE_THROTTLE) return;
  _lastPulse[key] = now;
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
// readyAt (optional): เมื่อ cur ถึงระดับนี้ → ใส่คลาส .charge-ready (สถานะ "พร้อมปลด peak"
// เช่น IFRIED ครบ 10/15 = Inferno พร้อมปะทุ) — ผู้เล่นรู้ว่า "ใกล้สุด/พร้อมแล้ว" โดยไม่ต้องอ่านเลข.
function setCharge(id, cur, max, readyAt) {
  const e = VFX_MAP[id];
  if (!e) return;
  max = max || 0;
  if (max <= 0) return;
  const el = _chargeEl(true);
  if (!el) return;
  cur = Math.max(0, Math.min(max, cur | 0));
  const pct = Math.round((cur / max) * 100);
  const th = e.theme || '';
  const ready = (readyAt != null && cur >= readyAt);
  el.className = 'game-vfx-charge' + (th ? ' game-vfx-theme-' + th : '') + (ready ? ' charge-ready' : '');
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
  // Layer-4 escalation: ถ้าการ์ดนี้มี persistent world layer ให้บรรยากาศทั้งฉาก "ปิดเข้ามา"
  // ตาม tier จริงด้วย (เช่น GLOOM: ยิ่ง obsession สูง โลกยิ่งมืดบีบเข้า). คอสเมติกล้วน.
  const w = _worldEl(false);
  if (w && w.classList && w.classList.contains('cv-world')) {
    w.classList.remove('gv-world-tier-1', 'gv-world-tier-2', 'gv-world-tier-3');
    if (level > 0) w.classList.add('gv-world-tier-' + level);
  }
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
  // HYDRA — หลายหัวงูพิษเขียว (Hydra Head 0–3 จาก AK47): ทุกหัวที่งอก = ฟันงูฟาด + สะเก็ดพิษ
  // + pip ต่อหัวจริง (ctx.stack), ครบ 3 + BREAK = HYDRA BURST (คลื่นพิษ + ฟันสามรอย + พิษพุ่ง),
  // reset pip ตอน burst. BREAK ปกติ = กระดองแตก.
  hy:  { rarity: 'elite', theme: 'break', affects: 'break', stack: { gain: 'head', reset: 'burst', max: 3 }, aura: ['drain', '#44ff88'],  on: {
           head:  [['slash', '#7dffb0', 2], ['spark', '#44ff88', 5]],
           break: [['breakCrack', '#44ff88', true]],
           burst: [['shadowBurst', '#2a6a00', 0.6], ['slash', '#7dffb0', 3], ['spark', '#7dffb0', 9], ['drainPulse', '#44ff88']],
         } },
  // FREEONI — FREE MODE น้ำแข็ง: วาบเย็น + พัลส์ฟ้า + สะเก็ดน้ำแข็งตอน BREAK, OD glow + สะเก็ดเย็นตอน AK47→OD
  ph:  { rarity: 'elite', theme: 'time', affects: 'break', aura: ['frost', '#66ccff'],  on: { break: [['flash', '#0a2230'], ['pulse', '#66ccff'], ['spark', '#aaf0ff', 7]], ak47: [['odGlow', '#9bdcff'], ['spark', '#cdeaff', 4]] } },
  // TURTLE SHOGUN — SHOGUN STANCE = กระดองตั้งการ์ด: วงเกราะกระดองหุบเข้า + กระดองทุบพื้น
  // (heavy shell slam) + ออร่าสแตนซ์ ตอนเปิด STANCE (จังหวะจริงของการ์ด ไม่ใช่แค่ BREAK).
  // BREAK ยังคงกระดองแตกหนักไว้ตามเดิม.
  tg:  { rarity: 'elite', theme: 'break', affects: 'break', aura: ['glow',  '#9bbb55'],  on: {
           break:  ['breakCrack', '#bfe07a', true],
           stance: [['flash', '#16240a'], ['comboRing', '#bfe07a'], ['breakCrack', '#9bbb55', true], ['pulse', '#bfe07a']],
         } },
  // DRAKE — DRAKE PLUNDER ("X MARKS THE SPOT"): ปล้นครั้งใหญ่ตอนแตะจุดสมบัติทอง
  // วาบ + เบิร์สต์ทอง + ฟันคู่ + สะเก็ดทองเยอะ. affects:'zeny' เพราะปล้น Zeny → HUD โซนคะแนนเด้ง
  dk:  { rarity: 'elite', theme: 'crit', affects: 'zeny', aura: ['gold',  '#ffcc33'],  on: { drake: [['flash', '#3a2a00'], ['odGlow', '#ffcc33'], ['slash', '#ffd84a', 2], ['spark', '#ffe680', 8]] } },
  // ABYSMELL KNIGHT — execute มืด: วาบดำ + ฟันแดงคู่ + คลื่นมืดดูดเข้า + ดูดวิญญาณ (drainPulse) ตอนประหาร
  ak:  { rarity: 'elite', theme: 'soul', affects: 'enemy', aura: ['shadow', '#cc3344'], on: { execute: [['flash', '#2a0008'], ['slash', '#ff2244', 2], ['shadowBurst', '#440011', 0.55], ['drainPulse', '#cc3344']] } },
  // TAO FUNKA — FUNK FEVER จังหวะฟังก์: วาบ + วงจังหวะฟังก์ (comboRing) + พัลส์ + สะเก็ดสีสด ตอน BREAK
  // (ย้ายออกจาก fireBurst แล้ว — ไฟเป็นของ IFRIED; ฟังก์ = จังหวะ/บีต ไม่ใช่ไฟกลาง).
  tk:  { rarity: 'elite', theme: 'crit', affects: 'break', aura: ['fire',  '#ff3322'],  on: { break: [['flash', '#2a0010'], ['comboRing', '#ff4466'], ['pulse', '#ff6633'], ['spark', '#ff88aa', 6]] } },
  // DRUNKULA — BLOOD DRINK: พัลส์ดูดเลือด + สะเก็ดแดง
  dc:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['drain', '#cc2244'],  on: { break: [['drainPulse', '#cc2255'], ['spark', '#ff3366', 5]] } },
  // INCANTATION SCAMURAI — SCAMURAI CONTRACT (combo ≥35): ยันต์สัญญาวาบ + วงสัญญา + ดาบซามูไรฟัน
  // + วาบ ตอนเปิดสัญญา (reuse ยันต์/วงสัญญาจาก BAPHOBET โทนม่วง). BREAK = รอยร้าวม่วง + ฟันดาบ.
  ic:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['glow',  '#cc66ff'],  on: {
           contract: [['demonSigil', '#cc66ff'], ['contractRing', '#aa55ee'], ['slash', '#e0b8ff', 2], ['flash', '#1a0a2a']],
           break:    [['breakCrack', '#d49bff'], ['slash', '#e0b8ff', 1]],
         } },
  // STORMYNITE — STORM CHARGE: สายฟ้าฟาด + วาบ + สะเก็ดไฟฟ้า
  sk:  { rarity: 'elite', theme: 'crit', affects: 'odBar', aura: ['tech',  '#66ddff'],  on: { od: [['flash', '#bff0ff'], ['bolt', '#9be7ff'], ['spark', '#cdf4ff', 6]] } },
  // DORK LORD — NIGHT STACK (passive scaling 0–5): aura เงา "หนักขึ้น" ตาม tier จริง (0–3)
  // + พัลส์เงาตอนขึ้น tier (ค่ำคืนสะสมพลัง, เห็นได้ตลอดระหว่างเล่น); รอยร้าวมืดตอน BREAK ตามเดิม.
  dl:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['shadow', '#7744aa'], on: {
           break:      ['breakCrack', '#9a66cc'],
           nightstack: ['shadowBurst', '#9a66cc', 0.5],
         } },
  // MOONLIGHT FEVER — โหมดฟีเวอร์แสงจันทร์: ออร่าจันทราหายใจ (passive) → จังหวะพัลส์ +
  // จันทร์เสี้ยวกวาด (trigger) → สุริยุปราคา + คลื่นฟีเวอร์ + ประกายเงินดูดเข้า (burst).
  // ยิงตามบูสต์จริงของการ์ด: OD ×2 = eclipse burst (peak), BREAK = pulse+sweep, AK47 = sweep+sparks.
  mf:  { rarity: 'elite', theme: 'moonFever', affects: 'odBar', aura: ['moon', '#cdd8ff'], on: {
           od:    [['eclipseRing', '#cdd8ff'], ['feverWave', '#9a6cff'], ['moonPulse', '#bcd0ff', 'peak'], ['lunarSpark', '#eef3ff', 10]],
           break: [['moonPulse', '#bcd0ff'], ['crescentArc', '#8fe9ff', 2]],
           ak47:  [['crescentArc', '#bcd0ff', 2], ['lunarSpark', '#eef3ff', 8]],
         } },
  // MINORAGE — ORE RAGE (ขุดแร่/เกรี้ยว): aura เรืองส้มจาง ๆ; เก็บแร่ = สะเก็ดเหมือง + pip,
  // ใช้แร่ตอน BREAK = หินแตก (reset stack), ครบ 3 (RAGE RUSH) = พัลส์แดง-ส้ม + ไฟ + สะเก็ดแรงขึ้น
  mi:  { rarity: 'elite', theme: 'break', affects: 'break', stack: { gain: 'oregain', reset: 'break', max: 3 }, aura: ['glow', '#cc7733'], on: {
           oregain: ['spark', '#ffb733', 5],
           break:   [['breakCrack', '#d8a14e', true], ['spark', '#ffaa44', 6]],
           rage:    [['pulse', '#ff3322'], ['fireBurst', '#ff5522'], ['spark', '#ff8844', 7]],
         } },
  // EXECUSIONER — EXECUTION MODE ฟันขวานประหาร: วาบดำ + รอยฟันหนัก + รอยร้าวหนัก + คลื่นมืด (chop impact)
  ex:  { rarity: 'elite', theme: 'crit', affects: 'break', aura: ['shadow', '#cc3333'], on: { break: [['flash', '#1a0000'], ['slash', '#ff5544', 1], ['breakCrack', '#ff7755', true], ['shadowBurst', '#330000', 0.5]] } },
  // WHIZPER — GHOST PROTOCOL: เส้นความเร็วที่จุด AK47 + เงาจาง (ghost fade)
  wh:  { rarity: 'elite', theme: 'time', affects: 'break', aura: ['frost', '#aaffee'],  on: { ak47: [['streak', '#aaffee'], ['shadowBurst', '#cceeff', 0.45]] } },
  // GOBLIN WEEBER — WEEB FOCUS ตอน combo เต็ม (47): เส้นโฟกัสมังงะ (streak) ลู่เข้า + วงโฟกัส + วาบ
  gl:  { rarity: 'elite', theme: 'analysis', affects: 'combo', aura: ['glow',  '#88cc44'],  on: { combo: [['streak', '#9bdc55'], ['comboRing', '#9bdc55'], ['flash', '#16240a']] } },
  // AMOG RA — SUS EVENT สุ่มผล (น่าสงสัยส้ม-แดง): คลื่นมืดส้ม + พัลส์เตือนเสี่ยงแดง (riskPulse) +
  // สะเก็ด — โทน "เดิมพัน/น่าสงสัย" ตามกลไกสุ่ม 70/30 ของการ์ด.
  ar:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['fire',  '#ff7722'],  on: { break: [['shadowBurst', '#ff8833', 0.5], ['riskPulse', '#ff5522'], ['spark', '#ffaa44', 6]] } },
  // MAYA PROBLEM — bug/glitch + บอส: scanline glitch + พัลส์ตอน BREAK, boss flare ตอนล้มบอส
  mp:  { rarity: 'elite', theme: 'analysis', affects: 'enemy', aura: ['tech',  '#ff44aa'],  on: { break: [['glitch', '#ff44aa'], ['pulse', '#ff55bb']], boss: ['bossFlare', '#ff44aa'] } },
  // WEEBVIL DUDE — OTAKU AWAKENING (ปลุกร่างมืด): วาบม่วงมืด + คลื่นมืดปลุกร่าง + พัลส์ + สะเก็ดม่วง
  ed:  { rarity: 'elite', theme: 'soul', affects: 'break', aura: ['shadow', '#aa66cc'], on: { break: [['flash', '#160a22'], ['shadowBurst', '#bb77dd', 0.55], ['pulse', '#cc88ee'], ['spark', '#cc88ee', 6]] } },
  // GHOSTPING — ผี/ปิง/แล็ก: glitch แล็ก (ping/lag) + พัลส์ผีจาง + คลื่นจาง ตอน BREAK — ฟีล "ผีดีเลย์"
  ghp: { rarity: 'elite', theme: 'time', affects: 'break', aura: ['frost', '#aaddff'],  on: { break: [['glitch', '#aaddff'], ['pulse', '#aaddff'], ['shadowBurst', '#cce8ff', 0.4]] } },
  // DEVILINGO — ปีศาจ + โลภ + โฟกัสบอส: เหรียญแดง + เส้นความเร็วตอน AK47, boss flare + ไฟตอนล้มบอส
  dvl: { rarity: 'elite', theme: 'zeny', affects: 'zeny', aura: ['fire',  '#ff3322'],  on: { ak47: [['coinBurst', '#ff6644'], ['streak', '#ff5533']], boss: [['bossFlare', '#ff2233'], ['fireBurst', '#ff4422']] } },
  // LADY TRAINEE — Spotlight ฝึกซ้อม (stack 0–15, ไม่มี pip): วงแหวนชาร์จ compact ตาม count
  // จริง (charge ring) ตอน OD Level Up, แสง holy ตอนเข้า OD, stage-light ตอนครบ Spotlight (10)
  ltn: { rarity: 'elite', theme: 'idol', affects: 'odBar', aura: ['holy',  '#ff99dd'],  on: { od: [['holyBurst', '#ff99dd'], ['comboRing', '#ffaae0']], odlevel: ['spark', '#ffaae0', 4], spotlight: [['holyBurst', '#ff99dd'], ['flash', '#2a1024']] } },

  // ── MYTHIC ──
  // THANABROS — THANATOS PHASE / มือมรณะตัดเวลา (thanatos): ออร่าเงามรณะ (passive) →
  // เข้า Phase = นาฬิกาหยุดเวลา (timeStop) + รอยแยกเหวมรณะเปิด (voidRift) + เคียวมรณะกวาด
  // (reaperScythe) + ระฆังมรณะกังวาน (deathKnell) + วิญญาณถูกเก็บเข้า (soulReap) — บุคลิก
  // "หยุดเวลา/เก็บเกี่ยวความตาย" เฉพาะตัว (ไม่ใช่ glitch/shadowBurst กลางอีกต่อไป).
  // AK47 ระหว่าง Phase (ต่อ OD timer) = เคียวกวาด + วิญญาณถูกเก็บที่จุด WP. affects=timer
  // → นาฬิกาตอบสนอง (เวลาถูกตัด).
  th:  { rarity: 'mythic', theme: 'thanatos', affects: 'timer', aura: ['shadow', '#cc00cc'], on: {
           thanatos: [['timeStop', '#e0b3ff'], ['voidRift', '#660066'], ['reaperScythe', '#cc44cc', 2], ['deathKnell', '#cc00cc'], ['soulReap', '#dd99ff', 8]],
           ak47:     [['reaperScythe', '#dd55dd', 1], ['soulReap', '#e0b3ff', 6]],
         } },
  // BAPHOBET — DEVIL BET / สัญญาปีศาจ (demonContract): ออร่านรกแดง-ดำหายใจ (passive) →
  // BREAK = เดิมพัน: วงสัญญานรก + คลื่นไฟต้องสาป + เล็บปีศาจ → แต่ละ SIN ที่ได้ = พัลส์สัญญา:
  // สะเก็ดบาปดูดเข้า + ยันต์ปีศาจ (ความเข้ม aura ไต่ตาม tier จริงจาก _baphometSinStacks 0–5)
  // → ครบ 5 (CONTRACT SEALED) = DEVIL BET จ่าย: ยันต์ทอง + วงช็อกเลือด-ดำ + ระเบิดทองต้องสาป
  // + ไฟนรก. SIN Stack 0–5 (สะสมตอน DEVIL BET, ไม่รีเซ็ตกลางรัน = buildup ดาเมจ) → pip ต่อ sin
  // จริง; affects=enemy (สาปดาเมจลงศัตรู).
  bh:  { rarity: 'mythic', theme: 'demonContract', affects: 'enemy', stack: { gain: 'sinstack', max: 5 }, aura: ['infernal', '#cc0000'], on: {
           break:    [['contractRing', '#aa0000'], ['cursedFlame', '#ff4400'], ['slash', '#ff2233', 3]],
           sinstack: [['sinEmber', '#ff5522', 6], ['demonSigil', '#cc0011']],
           sinmax:   [['demonSigil', '#ffcc33'], ['bloodShock', '#cc0011'], ['devilBetBurst', '#ffcc33'], ['cursedFlame', '#ff3300']],
         } },
  // EDGEGA — Lv2 Burst เสือ (claw rake): ไม่ใช่ไฟพุ่งกลางแล้ว — เป็น "รอยเล็บเสือปะทุ"
  // (วาบ + กรงเล็บ 4 รอยขนานราดข้าม + สะเก็ดคม) ตอน Lv2 Burst เปิด ทุก 15 วิ. ต่างชัด
  // จาก IFRIED (ไฟ/อินเฟอร์โน) และ ATROSUS (คลื่นเรโซแนนซ์).
  eg:  { rarity: 'mythic', theme: 'crit', affects: 'odBar', aura: ['fire',  '#ff6622'],  on: { od: [['flash', '#2a1000'], ['clawRake', '#ff7733', 4], ['spark', '#ffd08a', 6]] } },
  // NOSIRIS — Soul Stack 0–5 (สะสมตอน BREAK) → JUDGMENT ตอนเต็ม 5: แสง holy ทอง + พัลส์,
  // pip ต่อ soul stack จริง (ctx.stack), เต็ม 5 = expire flourish (JUDGMENT/ปฏิเสธความตาย)
  // JUDGMENT (เต็ม 5 = ปฏิเสธความตาย) ได้ payoff เฉพาะของตัวเอง: วาบทอง + แสง holy ทอง→ม่วงคู่ +
  // พัลส์ม่วง + ฝนประกายทอง (ใหญ่/ต่างจาก BREAK ปกติ) พร้อม stack expire flourish (reset='judgment').
  os:  { rarity: 'mythic', theme: 'soul', affects: 'break', stack: { gain: 'soulstack', reset: 'judgment', max: 5 }, aura: ['gold',  '#ffdd66'],  on: {
           break:    [['holyBurst', '#ffe07a'], ['pulse', '#ffd84a']],
           soulstack: ['spark', '#ffe07a', 4],
           judgment: [['flash', '#fff4d0'], ['holyBurst', '#ffe07a'], ['holyBurst', '#cc88ff'], ['pulse', '#cc88ff'], ['spark', '#ffe680', 8]],
         } },
  // MISSSTRESS — ราชินีผึ้งสายฟ้าเหลือง (bee queen): ฝูงผึ้งทองรุมบิน + สายฟ้า + เหรียญทอง
  // (zeny ตอน OD). ฝูงผึ้งทำให้ "ราชินีผึ้ง" ออกชัด ไม่ใช่แค่สายฟ้า+เหรียญกลาง.
  mt:  { rarity: 'mythic', theme: 'zeny', affects: 'zeny', aura: ['gold',  '#ffdd00'],  on: { od: [['insectSwarm', '#ffd24a', 10], ['bolt', '#ffe21a'], ['spark', '#ffe85a', 6], ['coinBurst', '#ffe21a']] } },
  // GOLDEN BRUH — MIDAS GOLD RUSH (goldRush): ยิงที่ context 'combo' จริง ตอน combo เต็ม
  // (GOLD RUSH เปิด). บุคลิก "เจ้าแห่งทองคำ/รวยปะทุ" เฉพาะตัว: แกนทองกิลด์ + วงช็อกทอง +
  // น้ำพุทองคำแท่ง (gold ingot fountain — แท่งทอง ไม่ใช่เหรียญกลม) + "$" ยักษ์ลอยขึ้น +
  // วาบทอง. ทองสุกใสล้วน — ต่างชัดจาก DARK STAKE LORD (ทองมืดคาสิโน), MISSSTRESS (ผึ้ง),
  // DRAKE (น้ำพุเหรียญ). affects=zeny → HUD โซน Zeny/score ตอบสนอง (การ์ดทำ Zeny ×9).
  gb:  { rarity: 'mythic', theme: 'zeny', affects: 'zeny', aura: ['gold',  '#ffcc00'],  on: { combo: [['flash', '#3a2e00'], ['goldRush', '#ffcc00']] } },
  // COKE ZERO — "ZERO" สุญญากาศดำ-ขาว (OD charge ×4): วาบขาว + วงสุญญากาศหดยุบเข้าหา "ศูนย์"
  // (annihilation) ตอนเข้า OD — บุคลิก "ศูนย์/ความว่าง" ออกจริง (ไม่ใช่ flash+pulse กลาง). affects=odBar
  // เพราะการ์ดเร่ง OD charge ×4 (OD คือหัวใจ).
  oh:  { rarity: 'mythic', theme: 'time', affects: 'odBar', aura: ['frost', '#e8f4ff'],  on: { od: [['flash', '#ffffff'], ['voidZero', '#e8f4ff']] } },
  // LORD OF DEBT — DEBT CONTRACT (debtContract): ออร่าหนี้ม่วง-ทองบัญชี "หายใจ" (passive) ที่
  // ความเข้มไต่ตาม DEBT STACK จริง 0–5 → 0–3 (ภาระสะสมเห็นได้ตลอด, ตัวนับ #debtStackCounter ยัง
  // เป็นแหล่งความจริง ไม่สร้าง UI ซ้ำ). ทุกสัญญา (debt) = ตราสัญญาหนี้ประทับ (สีตามพลังต้องห้ามที่
  // เพิ่งเซ็น ผ่าน '$state') + โซ่เงารัดเข้า + ตัวเลขดอกเบี้ยลอยขึ้น. ครบ 5 (debtmax / MAX DEBT) =
  // หลุมทวงหนี้ดูดเข้า + โซ่รัดแน่น + วาบมืด (การทวงคืนที่หลีกเลี่ยงไม่ได้). BREAK = ตราสัญญาแตก
  // (sealBreak) ปลดหนี้; ถ้ามีหนี้ค้างจริง (debtclear) = เหรียญต้องสาปถูกสูบจ่าย + รีเซ็ตความเข้มออร่า.
  // BERSERK hit = ฟันเงาผูกโซ่ (throttle ที่ context 'hit'). affects=debt → ตัวนับ DEBT ตอบสนอง
  // ด้วยสีของพลังต้องห้ามที่เพิ่งเซ็น (ctx.color).
  ld:  { rarity: 'mythic', theme: 'debtContract', affects: 'debt', aura: ['debt', '#9944cc'],  on: {
           debt:      [['debtSeal', '$state'], ['debtChain', '#b066dd', 3], ['ledgerGlyph', '#d4a017', 4]],
           debtmax:   [['collectorPull', '#aa33ff'], ['debtChain', '#cc44ff', 5], ['ledgerGlyph', '#ff3366', 5], ['flash', '#1a0022']],
           break:     [['sealBreak', '#b066dd']],
           debtclear: [['debtCoinDrain', '#d4a017'], ['ledgerGlyph', '#ff6688', 4]],
           hit:       [['slash', '#7744aa', 1], ['debtChain', '#9944cc', 2]],
         } },
  // CATULLANUX — ราชาแมว COMBO LOCK: วงเล็บเป้าหมาย 4 มุมหุบเข้า "ล็อกคอมโบ" (combo lock) ตอน
  // AK47 ครบ/BREAK สำเร็จ + รอยร้าวหนัก. affects=combo → กรอบคอมโบตอบสนอง (คอมโบถูกล็อก).
  kn:  { rarity: 'mythic', theme: 'analysis', affects: 'combo', aura: ['glow',  '#ffaa44'],  on: {
           break: [['comboLock', '#ffaa44'], ['breakCrack', '#ffbf6a', true]],
           ak47:  [['comboLock', '#ffcf8a']],
         } },
  // BEELZEBRUH — เจ้าแห่งแมลงวัน/CORRUPTION: ฝูงแมลงวันเขียวรุมบิน (buzz) + คลื่นมืดเขียวสาป
  // ตอน BREAK — บุคลิก "ฝูงแมลง" ออกจริง (ไม่ใช่ shadowBurst+spark กลาง).
  bz:  { rarity: 'mythic', theme: 'soul', affects: 'break', aura: ['drain', '#88cc00'],  on: { break: [['insectSwarm', '#88cc00', 12], ['shadowBurst', '#5a7a00', 0.5]] } },
  // VALKYRIZZ — VALKYRIE OF RANDGRIS / สลับพรเทพ (4-layer Mythic):
  //  L1 Passive: ออร่าปีกวาลคีรี (cv-aura--valkyrie) — ปีกขนนก + วงรัศมีเทพ "หายใจ" ตลอด
  //     ที่ active → จำใบได้ทันทีก่อนยิง.
  //  L2 Trigger (break): BREAK สำเร็จ = วาลคีรีร่ายปีก + หอกแสง + ขนนกร่วง (signal activate).
  //  L3 Peak (valkyrie): VALKYRIE SWAP จริง (AK47 ครบ/BREAK → สุ่มพร ELITE) = เทพลงเต็มขั้น:
  //     วาบเทพ + ปีกใหญ่ + หอกแสงทิ่ม + วงรูนทอง + รัศมี holy ขาว→ทอง + พัลส์ม่วง.
  //  L4 World: world:'valkyrie' → ทั้งฉากเรืองแสงสวรรค์จาง ๆ (ขอบจอ) ตลอดที่การ์ด active.
  //  silhouette "ปีก+หอก" + จาน palette ขาว-ทอง-ม่วงเทพ → ไม่ซ้ำ Mythic ใบใด.
  vr:  { rarity: 'mythic', theme: 'idol', affects: 'break', world: 'valkyrie', aura: ['valkyrie', '#cc88ff'], on: {
           break:    [['valkyrieDescend', '#cc88ff'], ['pulse', '#d6a3ff']],
           valkyrie: [['flash', '#2a1840'], ['valkyrieDescend', '#cc88ff', 'peak'], ['holyBurst', '#ffe9ff'], ['holyBurst', '#ffd96b'], ['pulse', '#cc88ff']],
         } },
  // ATROSUS — RESONANCE อสูรเกรี้ยว (resonance wave): ไม่ใช่ไฟพุ่งแล้ว — เป็น "คลื่นเรโซแนนซ์"
  // (วงคลื่นฮาร์มอนิกขยายเป็นจังหวะซ้อน + พัลส์แดงสั่น) ตอน BREAK เปิด Resonance. ต่างชัดจาก
  // IFRIED (ไฟ) และ EDGEGA (กรงเล็บ).
  at:  { rarity: 'mythic', theme: 'crit', affects: 'break', aura: ['fire',  '#ee3333'],  on: { break: [['resonanceWave', '#ee3333'], ['pulse', '#ff5544']] } },
  // KILL-D01 — WAR MACHINE / DRIVE CORE (4-layer Mythic, อารมณ์ "จักรกลเย็นชา/พลังประจุล้น"):
  //  L1 Character: ออร่าแกนขับเคลื่อนหกเหลี่ยมหมุน (cv-aura--mecha) + pip ของ DRIVE TOKEN จริง 0–8.
  //  L2 Trigger (token = ทุก 3 คลิกใน OD): แกนพลังงานวาบ + วงจรลู่เข้าชาร์จ (mechaCharge) + pip +1;
  //     BREAK = glitch สั้น ๆ. affects=odBar → แถบ OD ตอบสนอง (แกนกำลังประจุ).
  //  L3 Peak (drivedischarge = 8 Token + BREAK): DRIVE DISCHARGE — ปืนเลเซอร์ใหญ่ฟาดลง 2 ลำ +
  //     reticle ล็อกเป้า + วาบ + วงประจุ → ต่างจาก passive สุดขั้ว (peak contrast). discharge =
  //     ปล่อย Token ตอน BREAK = ลำเลเซอร์ + reset pip.
  //  L4 World: world:'mecha' → กริดเล็งเป้า/วงจรไซแอนจาง ๆ สแกนทั้งฉาก (หายใจ). silhouette
  //     "หกเหลี่ยม+ลำเลเซอร์+reticle" ต่างจาก DETAILED (สแกนไลน์) และ RSICK (บล็อกไวรัสแดง).
  kl:  { rarity: 'mythic', theme: 'analysis', affects: 'odBar', world: 'mecha',
         stack: { gain: 'token', reset: 'discharge', max: 8 }, aura: ['mecha', '#00ffee'], on: {
           token:          [['mechaCharge', '#00ffee']],
           break:          [['glitch', '#00ffee'], ['flash', '#003333']],
           discharge:      [['mechaLaser', '#00ffee']],
           drivedischarge: [['flash', '#003a3a'], ['mechaLaser', '#aaffff', 'max'], ['mechaCharge', '#00ffee'], ['comboRing', '#00ffee']],
         } },
  // IFRIED — INFERNO STACK 0–15 (4-layer Mythic, lifecycle อ่านออกโดยไม่ต้องดูเลข):
  //  Idle: ออร่าไฟสงบ. Growth (คริสะสม): วงแหวนชาร์จไฟเติม 0–15 (charge ring) + ออร่าไฟ
  //   เข้มขึ้นตาม tier จริง 0–3 (จังหวะเปลวเร็วขึ้น) + โลกร้อนขึ้น (world tier) — เห็น "กำลัง
  //   ชาร์จ/ใกล้สุด" ชัด. Peak-ready (≥10): วงแหวนเปลี่ยนเป็นสถานะ ".charge-ready" (เต้นทอง-แดง)
  //   + คิว infernoready — "พร้อมปะทุ". Peak (Inferno Burst, ≥10 + BREAK): ไฟพุ่งสองชั้น
  //   แดง→ทอง + วาบ. Decay: หลังปะทุ stack รีเซ็ต → วงแหวนหาย + ออร่าสงบ → กลับ Idle.
  //  affects=enemy (ไฟลงศัตรู). world:'inferno' = ไอความร้อน+ถ่านลุกที่ขอบล่างฉาก หายใจ + ไต่ tier.
  //  ไฟ = IFRIED แต่ผู้เดียว (EDGEGA/ATROSUS ไม่ใช้ fireBurst).
  if:  { rarity: 'mythic', theme: 'crit', affects: 'enemy', world: 'inferno', aura: ['fire',  '#ff4400'],  on: {
           break:        [['fireBurst', '#ff4400'], ['spark', '#ff7722', 7]],
           emberhit:     ['spark', '#ff6622', 4],
           infernoready: [['pulse', '#ffcc33'], ['fireBurst', '#ffaa22']],
           inferno:      [['flash', '#2a0a00'], ['fireBurst', '#ff4400'], ['fireBurst', '#ffaa22'], ['spark', '#ff8844', 10], ['pulse', '#ff6622']],
         } },
  // RSICK-0806 — ไวรัส EXECUTION ไซเบอร์: บล็อกดิจิทัลคอร์รัปต์กระตุก (viral corruption) + สะเก็ด
  // แดง + พัลส์ — ต่างจาก scanline glitch ของ KILL-D01/DETAILED/MAYA และจาก FALLEN WECHAT (crash).
  rx:  { rarity: 'mythic', theme: 'analysis', affects: 'enemy', aura: ['tech',  '#ff2233'],  on: { break: [['corruptGlitch', '#ff2233'], ['spark', '#ff4455', 6], ['pulse', '#ff2233']] } },
  // FALLEN WECHAT — OVERLOADED BREAK เทวดาตก (system crash/overload): วาบมืด + glitch โหลดเกิน +
  // กระดอง BREAK แตกหนัก (overload shatter) + คลื่นมืดเทวดาตก + สายฟ้าระบบลัด — "ระบบล่ม/พลังล้น"
  // ต่างชัดจาก RSICK (viral corruption blocks).
  fwc: { rarity: 'mythic', theme: 'break', affects: 'break', aura: ['shadow', '#ff2233'], on: { break: [['flash', '#1a0008'], ['glitch', '#ff2233'], ['breakCrack', '#ff3344', true], ['shadowBurst', '#330008', 0.5], ['bolt', '#ff5566']] } },
  // DETAILED — ANALYZED BREAK กริด/สแกนแม่นยำ: glitch + สะเก็ดกริด + วาบ; Analysis Stack 0–8
  // (สะสมตอนเก็บ WP, −2 ตอนพลาด, รีเซ็ตเมื่อ BREAK จบ) → pip ต่อ stack จริง, เต็ม 8 = ANALYSIS COMPLETE
  // ANALYSIS COMPLETE (เต็ม 8/8) ได้ payoff เฉพาะ: วาบไซแอน + glitch + วงล็อกเป้า (comboRing) +
  // ลำสแกนกวาด (streak) + สะเก็ดกริด — "ล็อกเป้าสำเร็จ" ต่างจาก break ปกติ; pip ยังเต็ม 8 ระหว่างเล่นพายอฟ.
  dtl: { rarity: 'mythic', theme: 'analysis', affects: 'break', stack: { gain: 'analysis', reset: 'analysisreset', max: 8 }, aura: ['tech',  '#00ffee'],  on: {
           break:    [['glitch', '#00ffee'], ['spark', '#00ffee', 8], ['flash', '#003a3a']],
           analysis: ['spark', '#00ffee', 3],
           analysiscomplete: [['flash', '#0a5a5a'], ['glitch', '#00ffee'], ['comboRing', '#00ffee'], ['streak', '#aaffff'], ['spark', '#00ffee', 8]],
         } },
  // GLOOM UNDER SIDE — OBSESSION (4-layer Mythic, อารมณ์ "กดดัน/หวาดหวั่น/ถูกกลืน"):
  //  L1 Passive: ออร่า GLOOM (cv-aura--gloom) — แอ่งเงาเหวใต้ตัว + ดวงตาจ้องจาง ๆ ตลอดที่ active.
  //  L2 Trigger (gloom = ขึ้น tier ทุก 5 stack): หนวดเงาทะยานคว้า + ดวงตาวาบ สเกลตาม '$tier'
  //     จริง (progressive — ยิ่ง obsession สูง หนวดยิ่งสูง/เยอะ). BREAK = gloom surge + เงาแผ่.
  //  L3 Peak (gloommax = ครบ 20 stack ครั้งแรก): MAX OBSESSION — ตาเบิกเต็ม + หนวดกลืนรอบตัว +
  //     เวลาถูกดูดกลืนเข้า (drainPulse) + วาบมืด → ต่างจาก passive แบบสุดขั้ว (peak contrast).
  //  L4 World: world:'gloom' → ทั้งฉากมืดบีบเข้าจากขอบ/ด้านล่าง และ "ปิดเข้ามา" ตาม tier จริง
  //     (gv-world-tier-*) — โลกถูก obsession กลืนทีละน้อย. affects=timer → นาฬิกาตอบสนอง (กินเวลา).
  gus: { rarity: 'mythic', theme: 'soul', affects: 'timer', world: 'gloom', aura: ['gloom', '#6633aa'], on: {
           break:    [['gloomSurge', '#6633aa'], ['shadowBurst', '#1a0030', 0.5]],
           gloom:    [['gloomSurge', '#7d44c4', '$tier']],
           gloommax: [['flash', '#0a0010'], ['gloomSurge', '#9966ff', 'max'], ['drainPulse', '#6633aa'], ['shadowBurst', '#1a0030', 0.6]],
         } },
  // DARK STAKE LORD — Cursed casino jackpot (darkJackpot): ออร่าทองมืดต้องสาป (passive),
  // BREAK = วงล้อสล็อตหมุน + วงสัญญามืด ("เดิมพัน"); JACKPOT แตก = แฟลช 777 + เหรียญ
  // ต้องสาปพุ่งหา zeny + วงช็อกแดง-ดำ + สะเก็ดดอกไพ่ ("เดิมพันจ่าย"); พลาด = พัลส์เตือน
  // เสี่ยงแดง (odds ขึ้น). affects=zeny → เลข Zeny/score ตอบสนองจริง (ไม่ใช่แค่ไอคอนการ์ด).
  dsk: { rarity: 'mythic', theme: 'darkJackpot', affects: 'zeny', aura: ['stake', '#d4af37'],
    on: {
      break:   [['slotReel', '#d4af37'], ['stakeRing', '#cc1133']],
      jackpot: [['jackpotFlash', '#ffcc00'], ['cursedCoin', '#d4af37'], ['stakeRing', '#cc1133'], ['suitSpark', '#39ff14', 6]],
      stakeup: [['riskPulse', '#cc1133']],
    } },
};

// ── AURA STATE (persistent indicator for the active card) ────────────────────
// ใช้ child element เฉพาะ (#cvAuraEl) แทน ::before เพื่อไม่ชนกับ aura ของบอสสกิน
// (toei-enigma-aura ใช้ทั้ง ::before และ ::after บน #fighter อยู่แล้ว).
let _activeAuraId = null;
const _AURA_STYLES = ['glow', 'pulse', 'drain', 'holy', 'shadow', 'gold', 'frost', 'fire', 'tech', 'moon', 'stake', 'infernal', 'debt', 'valkyrie', 'gloom', 'mecha'];

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

// ── PERSISTENT WORLD LAYER (Layer 4 — atmosphere ที่เปลี่ยนตลอดที่การ์ด active) ─
// บางการ์ด Mythic ประกาศ `world` ใน VFX_MAP → ระหว่างที่การ์ดใบนั้น active เราเปิด
// ออร่าบรรยากาศทั้งฉาก (#cvWorldEl) แบบ subtle (vignette/tint ขอบจอ ไม่บัง gameplay
// กลางจอ) ขับด้วย CSS ล้วน (transform/opacity, ไม่มี particle loop). ปิดเองตอนจบรัน
// และถูกลดทอน/ตัดทิ้งใต้ reduced-motion / Low VFX / Flash OFF (gate ใน CSS).
let _worldEl_ = null;
function _worldEl(create) {
  if (_worldEl_ && _worldEl_.isConnected) return _worldEl_;
  const root = _root();
  if (!root) return null;
  let el = document.getElementById('cvWorldEl');
  if (!el && create) {
    el = document.createElement('div');
    el.id = 'cvWorldEl';
    el.setAttribute('aria-hidden', 'true');
    root.appendChild(el);
  }
  _worldEl_ = el;
  return el;
}
function _applyWorld(id) {
  const entry = VFX_MAP[id];
  const world = entry && entry.world;
  if (!world) { _clearWorld(); return; }
  const el = _worldEl(true);
  if (!el) return;
  el.className = 'cv-world cv-world-' + world;
  if (entry.aura && entry.aura[1]) el.style.setProperty('--gv', entry.aura[1]);
}
function _clearWorld() {
  const el = _worldEl(false);
  if (el) { el.className = ''; el.style.removeProperty('--gv'); }
}

// run-start: ตั้ง aura ให้เฉพาะการ์ด Elite/Mythic
function setActiveCard(id, rarity) {
  if (rarity && rarity !== 'elite' && rarity !== 'mythic') { clearCardAura(); _clearWorld(); return; }
  if (!VFX_MAP[id]) { clearCardAura(); _clearWorld(); return; }
  setCardAura(id, true);
  _applyWorld(id);
}
function clearActive() {
  clearCardAura(); _clearWorld(); clearStack(); clearCharge(); _auraTier = 0; _lastFire = {};
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
  // '$state' sentinel → สีของสถานะ/พลังที่เพิ่งเกิดจริง (เช่น LORD OF DEBT สีพลังต้องห้าม
  // ที่เพิ่งเซ็นสัญญา) ส่งผ่าน ctx.color — ทำให้ตราสัญญาเปลี่ยนสีตามหนี้ที่เซ็นจริง.
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '$state') args[i] = (ctx && ctx.color) || '#b066dd';
    // '$tier' sentinel → ระดับความเข้มจริงที่ส่งมา (เช่น GLOOM obsession tier 0–3) →
    // ทำให้ primitive เติบโตตามความคืบหน้าจริง (progressive escalation, ไม่ใช่แค่ "ใหญ่ขึ้น").
    else if (args[i] === '$tier') args[i] = (ctx && ctx.tier != null) ? ctx.tier : 1;
  }
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
  // 5) อิลิเมนต์ของเกมที่ได้รับผลจริงต้องตอบสนอง (ข้าม per-hit เพื่อกัน spam).
  //    ctx.color (ถ้ามี) ชนะ aura color — เช่น ตัวนับ DEBT เรืองด้วยสีพลังต้องห้ามที่เพิ่งเซ็น.
  if (entry.affects && context !== 'hit') {
    targetPulse(entry.affects, (ctx && ctx.color) || (entry.aura && entry.aura[1]), entry.theme);
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
