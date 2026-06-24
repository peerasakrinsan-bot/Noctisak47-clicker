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
// start, Drake Take, Thanatos Phase, boss interactions, the Doppelganger shadow
// strike, the Abyssmell execute). Passive damage cards get only the aura — no
// per-hit particle spam — per the lightweight/mobile-safe brief.
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

function pStreak(color, dur = 0.4) {
  const c = _fighterCenter();
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

// dispatcher: ชื่อ primitive → ฟังก์ชัน (ใช้ใน VFX_MAP แบบ data-driven)
const PRIM = {
  flash: pFlash, pulse: pPulse, slash: pSlash, spark: pSpark,
  shadowBurst: pShadowBurst, coinBurst: pCoinBurst, breakCrack: pBreakCrack,
  odGlow: pOdGlow, streak: pStreak, drainPulse: pDrainPulse,
  comboRing: pComboRing, bossFlare: pBossFlare,
};

// ── PER-CARD VFX MAPPING (Elite + Mythic) ────────────────────────────────────
// อ้างอิงทิศทางจาก task brief — ให้แต่ละใบ "รู้สึกต่างกัน" ด้วยสี/ไพรมิทีฟ/จังหวะ
// แม้จะใช้ primitive ร่วมกันได้. แต่ละ entry:
//   aura : [style, color]            — auraถาวรบนตัวละคร (passive indicator)
//   on   : { context: [prim, ...args] | [[prim, ...], ...] }  — เอฟเฟกต์ตอน mechanic ยิง
// ctx (เช่น {x,y}) ส่งจาก hook; primitive ที่รับพิกัดจะใช้ ctx.x/ctx.y ถ้ามี.

const VFX_MAP = {
  // ── ELITE ──
  dg:  { rarity: 'elite', aura: ['shadow', '#aa66ff'], on: { hit: ['slash', '#c9a3ff', 2] } },               // DOPPELGANGER — mirror/afterimage double slash
  hy:  { rarity: 'elite', aura: ['drain', '#44ff88'],  on: { break: [['breakCrack', '#44ff88', true], ['slash', '#7dffb0', 2]], ak47: ['spark', '#44ff88', 5] } }, // HYDRA — multi-head
  ph:  { rarity: 'elite', aura: ['frost', '#66ccff'],  on: { break: ['pulse', '#66ccff'], ak47: ['odGlow', '#9bdcff'] } }, // FREEONI — frost combo conversion
  tg:  { rarity: 'elite', aura: ['glow',  '#9bbb55'],  on: { break: ['breakCrack', '#bfe07a', true] } },      // TURTLE SHOGUN — heavy shell crack
  dk:  { rarity: 'elite', aura: ['gold',  '#66ccff'],  on: { drake: [['shadowBurst', '#ffcc00'], ['slash', '#ffd84a', 2]] } }, // DRAKE — golden dragon burst
  ak:  { rarity: 'elite', aura: ['shadow', '#cc3344'], on: { execute: [['slash', '#ff3355', 1], ['flash', '#3a0008']] } }, // ABYSMELL KNIGHT — dark execute slash
  tk:  { rarity: 'elite', aura: ['fire',  '#ff3322'],  on: { break: ['pulse', '#ff4422'] } },                 // TAO FUNKA — red rage aura/pulse
  dc:  { rarity: 'elite', aura: ['drain', '#cc2244'],  on: { break: ['drainPulse', '#cc2255'] } },            // DRUNKULA — blood-drain pulse
  ic:  { rarity: 'elite', aura: ['glow',  '#cc66ff'],  on: { break: [['breakCrack', '#d49bff'], ['flash', '#2a0a3a']] } }, // INCANTATION SCAMURAI — talisman glyph
  sk:  { rarity: 'elite', aura: ['tech',  '#66ddff'],  on: { od: [['flash', '#bff0ff'], ['spark', '#9be7ff', 6]] } }, // STORMYNITE — lightning strike
  dl:  { rarity: 'elite', aura: ['shadow', '#7744aa'], on: { break: ['breakCrack', '#9a66cc'] } },            // DORK LORD — dark break crack
  mf:  { rarity: 'elite', aura: ['holy',  '#ccccff'],  on: { break: ['pulse', '#d6d6ff'] } },                 // MOONLIGHT FEVER — silver moon glow
  mi:  { rarity: 'elite', aura: ['glow',  '#bb8844'],  on: { break: ['spark', '#d8a14e', 5] } },              // MINORAGE — mining hit spark
  ex:  { rarity: 'elite', aura: ['shadow', '#cc3333'], on: { break: ['slash', '#ff5544', 1] } },              // EXECUSIONER — axe chop
  wh:  { rarity: 'elite', aura: ['frost', '#aaffee'],  on: { ak47: ['streak', '#aaffee'] } },                 // WHIZPER — ghost fade speed streak
  gl:  { rarity: 'elite', aura: ['glow',  '#88cc44'],  on: { break: ['comboRing', '#9bdc55'] } },             // GOBLIN WEEBER — combo focus ring
  ar:  { rarity: 'elite', aura: ['fire',  '#ff7722'],  on: { break: ['shadowBurst', '#ff8833'] } },           // AMOG RA — suspicious red/orange burst
  mp:  { rarity: 'elite', aura: ['tech',  '#ff44aa'],  on: { break: ['pulse', '#ff55bb'], boss: ['bossFlare', '#ff44aa'] } }, // MAYA PROBLEM — glitch pulse + boss flare
  ed:  { rarity: 'elite', aura: ['shadow', '#aa66cc'], on: { break: ['pulse', '#bb77dd'] } },                 // WEEBVIL DUDE — cursed insect pulse
  ghp: { rarity: 'elite', aura: ['frost', '#aaddff'],  on: { break: [['pulse', '#aaddff'], ['breakCrack', '#cce8ff']] } }, // GHOSTPING — ghostly break progress
  dvl: { rarity: 'elite', aura: ['fire',  '#ff3322'],  on: { ak47: ['coinBurst', '#ff6644'], boss: ['bossFlare', '#ff3322'] } }, // DEVILINGO — devil coin + boss flare
  ltn: { rarity: 'elite', aura: ['holy',  '#ff99dd'],  on: { od: ['comboRing', '#ff99dd'] } },                // LADY TRAINEE — clean training combo glow

  // ── MYTHIC ──
  th:  { rarity: 'mythic', aura: ['shadow', '#cc00cc'], on: { thanatos: ['odGlow', '#dd33dd'], ak47: ['spark', '#dd55dd', 6] } }, // THANABROS — time-stop OD aura + purple AK47 pulse
  bh:  { rarity: 'mythic', aura: ['fire',  '#cc0000'],  on: { break: [['slash', '#ff2233', 2], ['shadowBurst', '#cc0000']] } }, // BAPHOBET — demonic red slash/burst
  eg:  { rarity: 'mythic', aura: ['fire',  '#ff6622'],  on: { od: ['slash', '#ff7a33', 2] } },                // EDGEGA — tiger claw hit flash
  os:  { rarity: 'mythic', aura: ['gold',  '#ffdd66'],  on: { break: ['pulse', '#ffe07a'] } },                // NOSIRIS — sand/gold divine pulse
  mt:  { rarity: 'mythic', aura: ['gold',  '#ffdd00'],  on: { od: [['spark', '#ffe21a', 7], ['pulse', '#ffe21a']] } }, // MISSSTRESS — queen bee yellow lightning
  gb:  { rarity: 'mythic', aura: ['gold',  '#ffcc00'],  on: { break: ['coinBurst', '#ffcc00'] } },            // GOLDEN BRUH — strong gold coin explosion
  oh:  { rarity: 'mythic', aura: ['frost', '#e8f4ff'],  on: { break: [['flash', '#ffffff'], ['shadowBurst', '#cfe8ff']] } }, // COKE ZERO — cold black-white zero burst
  ld:  { rarity: 'mythic', aura: ['drain', '#9944cc'],  on: { break: [['drainPulse', '#9944cc'], ['coinBurst', '#b066dd']], hit: ['slash', '#7744aa', 1] } }, // LORD OF DEBT — debt-chain shadow + coin
  kn:  { rarity: 'mythic', aura: ['glow',  '#ffaa44'],  on: { break: ['breakCrack', '#ffbf6a', true] } },     // CATULLANUX — cat king break aura
  bz:  { rarity: 'mythic', aura: ['drain', '#88cc00'],  on: { break: [['shadowBurst', '#88cc00'], ['spark', '#a4dd2a', 7]] } }, // BEELZEBRUH — fly swarm poison-green burst
  vr:  { rarity: 'mythic', aura: ['holy',  '#cc88ff'],  on: { break: [['slash', '#d6a3ff', 1], ['flash', '#eee0ff']] } }, // VALKYRIZZ — holy wing spear flash
  at:  { rarity: 'mythic', aura: ['fire',  '#ee3333'],  on: { break: ['slash', '#ff4444', 2] } },             // ATROSUS — beast rage red claw
  kl:  { rarity: 'mythic', aura: ['tech',  '#00ffee'],  on: { break: [['flash', '#aaffff'], ['streak', '#00ffee']] } }, // KILL-D01 — robotic scanline laser
  if:  { rarity: 'mythic', aura: ['fire',  '#ff4400'],  on: { break: ['shadowBurst', '#ff5511'] } },          // IFRIED — fire burst
  rx:  { rarity: 'mythic', aura: ['tech',  '#ff2233'],  on: { break: ['pulse', '#ff3344'] } },                // RSICK-0806 — cyber glitch pulse
  fwc: { rarity: 'mythic', aura: ['shadow', '#ff2233'], on: { break: [['flash', '#1a0008'], ['shadowBurst', '#ff2233']] } }, // FALLEN WECHAT — fallen angel dark-chat glitch
  dtl: { rarity: 'mythic', aura: ['tech',  '#00ffee'],  on: { break: [['flash', '#bfffff'], ['spark', '#00ffee', 6]] } }, // DETAILED — precision grid/scan
  gus: { rarity: 'mythic', aura: ['shadow', '#6633aa'], on: { break: ['shadowBurst', '#7d44c4'] } },          // GLOOM UNDER SIDE — shadow wave
  dsk: { rarity: 'mythic', aura: ['shadow', '#aa33ff'], on: { break: [['shadowBurst', '#aa33ff'], ['coinBurst', '#c266ff']] } }, // DARK STAKE LORD — dark spike/stake burst
};

// ── AURA STATE (persistent indicator for the active card) ────────────────────
// ใช้ child element เฉพาะ (#cvAuraEl) แทน ::before เพื่อไม่ชนกับ aura ของบอสสกิน
// (toei-enigma-aura ใช้ทั้ง ::before และ ::after บน #fighter อยู่แล้ว).
let _activeAuraId = null;
const _AURA_STYLES = ['glow', 'pulse', 'drain', 'holy', 'shadow', 'gold', 'frost', 'fire', 'tech'];

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
function clearActive() { clearCardAura(); }

// ── TRIGGER (เรียกตอน mechanic ยิงจริง) ──────────────────────────────────────
// แต่ละ arg ของ primitive ที่เป็นพิกัดจะถูกแทนด้วย ctx.x/ctx.y โดยอัตโนมัติสำหรับ
// primitive ที่รองรับ (spark/coinBurst).
function _runPrim(spec, ctx) {
  if (!Array.isArray(spec)) return;
  const name = spec[0];
  const fn = PRIM[name];
  if (typeof fn !== 'function') return;
  const args = spec.slice(1);
  // ฉีดพิกัดจาก ctx ให้ spark(color,count,x,y) และ coinBurst(color,x,y)
  if (ctx && (ctx.x !== undefined) && (ctx.y !== undefined)) {
    if (name === 'spark') { args[2] = ctx.x; args[3] = ctx.y; }
    else if (name === 'coinBurst') { args[1] = ctx.x; args[2] = ctx.y; }
  }
  try { fn.apply(null, args); } catch (e) { /* primitive ต้องไม่ทำเกมพัง */ }
}

function triggerCardVfx(id, context, ctx) {
  const entry = VFX_MAP[id];
  if (!entry || !entry.on) return;       // ไม่มี mapping → safe no-op
  const spec = entry.on[context];
  if (!spec) return;                     // การ์ดนี้ไม่มีเอฟเฟกต์สำหรับ context นี้
  if (!_layer()) return;                 // DOM ไม่พร้อม → no-op
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
