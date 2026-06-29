// ── CANVAS VFX LAYER (normal / clicker mode only) ────────────────────────────
//
// A small, self-contained Canvas 2D engine that renders the *transient* card
// VFX (sparks, slashes, coin bursts, glow pulses, break cracks, …) into one
// pooled <canvas> instead of spawning a fresh DOM node per particle. The goal
// is purely a performance one: under rapid Elite/Mythic triggers the old DOM
// path could push dozens of short-lived <div>s per second onto mobile; this
// layer caps everything to a single canvas + a bounded particle pool.
//
// It is cosmetic and isolated, exactly like cardVfx.js:
//   • never reads or writes card logic / save / balance / cs_* flags
//   • safe no-op when canvas is unsupported or no DOM host exists
//   • honors prefers-reduced-motion (fewer particles, shorter life)
//   • pauses (and clears) while the tab is hidden
//   • the rAF loop only runs while particles exist, and stops when idle
//
// Public API (the only entry points cardVfx.js / game.js use):
//   • spawnCanvasVfx(type, options)          — emit one primitive's particles
//   • spawnCardCanvasVfx(cardId, ctx, coord) — replay a card's VFX_MAP entry
//   • clearCanvasVfx()                        — drop all live particles
//   • resizeCanvasVfx()                       — re-fit canvas to host + DPR
//   • supported()                             — is Canvas 2D usable here?
//
// Comments mix Thai/English to match the surrounding codebase.

// ── caps (กันไม่ให้ particle/หน่วยความจำพุ่งบนมือถือ) ────────────────────────
const MAX_PARTICLES = 340;   // global hard pool ceiling — array/pool never exceed this
const MAX_DPR       = 2.5;   // cap devicePixelRatio (เลี่ยง buffer ใหญ่เกินบนจอ 3x+)
const MAX_DT        = 0.05;  // clamp dt (กันกระโดดหลังสลับแท็บ/เฟรมหล่น)

// ── dynamic particle budget (heavy-combat detection) ─────────────────────────
// MAX_PARTICLES is the absolute ceiling; the *effective* cap tightens when many
// bursts land in a short window (worst case: OD Lv3 + Mythic payoff + boss-skill
// VFX + BREAK firing together). We never drop an effect — under load we just
// retire the OLDEST particles sooner (older = already-fading earlier bursts;
// the freshest, most gameplay-relevant burst always survives). Mirrors how a
// commercial mobile title scales its particle budget by scene pressure.
const SOFT_CAP_NORMAL    = 320;  // normal combat
const SOFT_CAP_HEAVY     = 220;  // ≥ HEAVY_BURST_COUNT bursts inside the window
const SOFT_CAP_LOW       = 140;  // in-game Low VFX (intensity ≤ 0.5)
const HEAVY_BURST_WINDOW = 520;  // ms window used to sense burst pressure
const HEAVY_BURST_COUNT  = 6;    // bursts within the window ⇒ "heavy combat"
let _burstTimes = [];            // recent spawnCanvasVfx timestamps (trimmed to window)
function _noteBurst(now) {
  _burstTimes.push(now);
  const cut = now - HEAVY_BURST_WINDOW;
  if (_burstTimes[0] < cut) {
    let i = 0;
    while (i < _burstTimes.length && _burstTimes[i] < cut) i++;
    if (i) _burstTimes.splice(0, i);
  }
}
function _effectiveCap() {
  if (_intensity <= 0.5) return SOFT_CAP_LOW;
  return (_burstTimes.length >= HEAVY_BURST_COUNT) ? SOFT_CAP_HEAVY : SOFT_CAP_NORMAL;
}

// ── reduced-motion (เคารพการตั้งค่าระดับ OS) ────────────────────────────────
let _reduced = false;
try {
  const _mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  _reduced = _mq.matches;
  const _on = (e) => { _reduced = e.matches; };
  if (_mq.addEventListener) _mq.addEventListener('change', _on);
  else if (_mq.addListener) _mq.addListener(_on);
} catch (e) { _reduced = false; }

// ── VFX intensity level (in-game Flash Effect: on=1.0, low=0.5, off=0.0) ────
// ตั้งค่าโดย applyFlashEffectSetting() ใน game.js ผ่าน setVFXLevel() public API
let _intensity      = 1.0;   // default: full
let _autoDownscaled = false;  // set true ครั้งเดียวหลัง auto-reduce จาก FPS ต่ำ
let _smoothFps      = 60;     // EMA FPS (อัปเดตเฉพาะช่วงมี particle ใน rAF)
let _lowFpsStart    = 0;      // timestamp เมื่อ FPS เริ่มตำกว่า 30 ต่อเนื่อง

// ── canvas / context state ───────────────────────────────────────────────────
let _canvas = null, _ctx = null;
let _cw = 0, _ch = 0;           // CSS-pixel size of the layer
let _ox = 0, _oy = 0;           // host offset (เผื่อ gameRoot ไม่ได้อยู่มุม 0,0)
let _dpr = 1;
let _supportedCache = null;     // null = unknown, true/false once probed
let _bound = false;             // global listeners attached once
let _hidden = false;

// ── particle pool + live list ────────────────────────────────────────────────
const _parts = [];
const _pool = [];
let _raf = 0, _last = 0;

// ── feature probe (เรียกครั้งเดียว, cache ผล) ───────────────────────────────
function supported() {
  if (_supportedCache !== null) return _supportedCache;
  try {
    if (typeof document === 'undefined' || !document.createElement) { _supportedCache = false; return false; }
    const c = document.createElement('canvas');
    _supportedCache = !!(c.getContext && c.getContext('2d'));
  } catch (e) { _supportedCache = false; }
  return _supportedCache;
}

function _host() { return document.getElementById('gameRoot') || document.body || null; }

// lazily create #vfxCanvas inside the game host (เหมือน #cardVfxLayer)
function _ensure() {
  if (_ctx) return _ctx;
  if (!supported()) return null;
  const host = _host();
  if (!host) return null;
  let cv = document.getElementById('vfxCanvas');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'vfxCanvas';
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
  }
  _canvas = cv;
  _ctx = cv.getContext('2d');
  resizeCanvasVfx();
  _bindGlobal();
  return _ctx;
}

// re-fit the backing store to the host box + devicePixelRatio.
// อ่าน layout ที่นี่เท่านั้น (นอก rAF loop) เพื่อเลี่ยง layout thrash ระหว่างวาด.
function resizeCanvasVfx() {
  if (!_canvas) return;
  const host = _host();
  let w = 0, h = 0;
  if (host && host.getBoundingClientRect) {
    const r = host.getBoundingClientRect();
    w = r.width; h = r.height; _ox = r.left; _oy = r.top;
  }
  _cw = w || (typeof window !== 'undefined' ? window.innerWidth : 360) || 360;
  _ch = h || (typeof window !== 'undefined' ? window.innerHeight : 640) || 640;
  _dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, MAX_DPR);
  _canvas.width = Math.max(1, Math.round(_cw * _dpr));
  _canvas.height = Math.max(1, Math.round(_ch * _dpr));
  _canvas.style.width = _cw + 'px';
  _canvas.style.height = _ch + 'px';
  if (_ctx) _ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
}

// resize / orientation / visibility listeners — attached once
function _bindGlobal() {
  if (_bound || typeof window === 'undefined') return;
  _bound = true;
  let t = 0;
  const onResize = () => {
    if (t) return;
    t = setTimeout(() => { t = 0; resizeCanvasVfx(); }, 150);
  };
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      _hidden = !!document.hidden;
      if (_hidden) {
        // ซ่อนอยู่ → หยุด loop + ล้าง particle (กัน burst ค้างตอนกลับมา)
        if (_raf) { cancelAnimationFrame(_raf); _raf = 0; }
        clearCanvasVfx();
      }
    });
  }
}

// ── color helper (#rgb / #rrggbb → rgba()) ───────────────────────────────────
function _rgba(hex, a) {
  if (!hex || hex[0] !== '#') return hex || ('rgba(255,255,255,' + a + ')');
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (isNaN(n)) return 'rgba(255,255,255,' + a + ')';
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

// ── particle alloc / recycle (pool เพื่อเลี่ยง GC ระหว่างยิงถี่) ─────────────
function _alloc() { return _pool.pop() || {}; }
function _recycle(p) { if (_pool.length < MAX_PARTICLES) { p.pts = null; p.draw = ''; _pool.push(p); } }
function _push(p) {
  // retire oldest until under the (possibly tightened) effective cap — keeps the
  // freshest burst alive while transient pileups stay mobile-safe.
  const cap = _effectiveCap();
  while (_parts.length >= cap) { _recycle(_parts.shift()); }
  _parts.push(p);
}

// base particle factory — ตั้งค่า field ร่วมไว้ ส่วน builder เติมที่เหลือ
function _mk(kind, x, y, life, color) {
  const p = _alloc();
  p.kind = kind; p.x = x; p.y = y; p.age = 0; p.life = life; p.color = color;
  p.vx = 0; p.vy = 0; p.size = 6; p.rot = 0; p.seed = Math.random();
  p.pts = null; p.data = 0; p.c2 = 0;
  return p;
}

function _rmLife(base) { return _reduced ? Math.min(base, 0.2) : base; }

// คำนวณจำนวน particle ตาม OS reduced-motion + in-game intensity
// คงพฤติกรรม _reduced เดิมไว้ ต่อยอดด้วย intensity scalar
function _nParts(n) {
  n = n | 0;
  if (_reduced) return Math.min(n, 3);
  if (_intensity <= 0.5) return Math.max(1, Math.ceil(n * 0.55));
  return n;
}

// resolve spawn origin → layer-local coords (หัก host offset)
function _ox0(o) { return (o.x !== undefined && o.x !== null) ? (o.x - _ox) : _cw / 2; }
function _oy0(o) { return (o.y !== undefined && o.y !== null) ? (o.y - _oy) : _ch * 0.42; }

// ── BUILDERS: each mirrors a cardVfx primitive's look/identity ───────────────
const BUILD = {
  // วาบเต็มจอ (สีต่อใบ) — particle เดียว, fade เร็ว
  flash(o) {
    const p = _mk('flash', 0, 0, _rmLife(o.dur || 0.34), o.color || '#ffffff');
    p.size = 0.26; _push(p);
  },
  // อนุภาคกระจายรอบทิศ
  spark(o) {
    let n = _nParts(o.count || 6);
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.36);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 90 + Math.random() * 150;
      const p = _mk('spark', x, y, life, o.color || '#ffffff');
      p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
      p.size = 2.5 + Math.random() * 2.5;
      _push(p);
    }
  },
  // รอยฟันเฉียง (gradient streak ที่ยืดออก)
  slash(o) {
    let n = (o.count || 1) | 0;
    if (_reduced) n = 1;
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.32);
    for (let i = 0; i < n; i++) {
      const p = _mk('slash', x, y + (i - (n - 1) / 2) * 22, life, o.color || '#ffffff');
      p.rot = (o.rot !== undefined ? o.rot : (-32 + (i % 2) * 64)) * Math.PI / 180;
      p.size = 132; p.data = i * 0.05; // delay
      _push(p);
    }
  },
  // เหรียญพุ่งขึ้นโค้งตามแรงโน้มถ่วง
  coinBurst(o) {
    let n = _nParts(7);
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.7);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.32;
      const sp = 150 + Math.random() * 130;
      const p = _mk('coin', x, y, life, o.color || '#ffcc00');
      p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp - 60;
      p.size = 5 + Math.random() * 2; p.rot = Math.random() * 6;
      p.data = 6 + Math.random() * 6; // spin speed
      _push(p);
    }
  },
  // คลื่นมืดแผ่ออกเป็นวงกลม
  shadowBurst(o) {
    const p = _mk('shadow', _ox0(o), _oy0(o), _rmLife(o.dur || 0.55), o.color || '#000000');
    p.size = 40; _push(p);
  },
  // ไฟพุ่ง + สะเก็ดลอยขึ้น
  fireBurst(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.55), col = o.color || '#ff5511';
    const core = _mk('fire', x, y, life, col); core.size = 26; _push(core);
    let n = _nParts(5);
    for (let i = 0; i < n; i++) {
      const p = _mk('spark', x, y, life, col);
      p.vx = (Math.random() - 0.5) * 90; p.vy = -(120 + Math.random() * 130);
      p.size = 2.5 + Math.random() * 2; p.data = 1; // ember = drift up, no gravity flip
      _push(p);
    }
  },
  // สายฟ้าซิกแซกฟาดลง
  bolt(o) {
    const x = _ox0(o), y = _oy0(o);
    const p = _mk('bolt', x, y, _rmLife(o.dur || 0.34), o.color || '#9be7ff');
    const pts = []; const segs = 6; let px = x, py = y - 50;
    for (let i = 0; i <= segs; i++) {
      pts.push(px, py);
      px = x + (Math.random() - 0.5) * 26;
      py += (50 + 110) / segs;
    }
    p.pts = pts; p.size = 3; _push(p);
  },
  // รอยร้าวแผ่ออกจากจุดศูนย์กลาง
  breakCrack(o) {
    const x = _ox0(o), y = _oy0(o), heavy = !!o.heavy;
    let n = _nParts(heavy ? 7 : 5);
    const life = _rmLife(o.dur || 0.42), col = o.color || '#ffffff';
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const p = _mk('crack', x, y, life, col);
      p.rot = ang; p.size = (heavy ? 70 : 50) + Math.random() * 30;
      p.data = heavy ? 3 : 2; // line width
      _push(p);
    }
  },
  // เส้นความเร็วแนวนอน
  streak(o) {
    let n = _nParts(4);
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.4);
    for (let i = 0; i < n; i++) {
      const p = _mk('streak', x, (y - 30 + i * 20), life, o.color || '#ffffff');
      p.vx = 220 + Math.random() * 120; p.size = 46; p.data = i * 0.04;
      _push(p);
    }
  },
  // วงพลังดูดเข้าด้านใน
  drainPulse(o) {
    const p = _mk('drain', _ox0(o), _oy0(o), _rmLife(o.dur || 0.55), o.color || '#cc2255');
    p.size = 70; _push(p);
  },
  // แสง OD เรืองพอง
  odGlow(o) {
    const p = _mk('glow', _ox0(o), _oy0(o), _rmLife(o.dur || 0.6), o.color || '#ffcc33');
    p.size = 80; _push(p);
  },
  // แสงบอสวาบ (ตำแหน่งบอสส่งมาทาง x/y)
  bossFlare(o) {
    const g = _mk('glow', _ox0(o), _oy0(o), _rmLife(o.dur || 0.5), o.color || '#ffffff');
    g.size = 70; _push(g);
    const r = _mk('ring', _ox0(o), _oy0(o), _rmLife(o.dur || 0.5), o.color || '#ffffff');
    r.size = 30; _push(r);
  },
  // วงแหวนขยาย (pulse)
  pulse(o) {
    const p = _mk('ring', _ox0(o), _oy0(o), _rmLife(o.dur || 0.5), o.color || '#ffffff');
    p.size = 30; _push(p);
  },
  // วงคอมโบ (ring คู่)
  comboRing(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.5), col = o.color || '#ffffff';
    const a = _mk('ring', x, y, life, col); a.size = 34; _push(a);
    if (!_reduced && _intensity > 0.4) { const b = _mk('ring', x, y, life * 0.86, col); b.size = 22; b.data = 1; _push(b); }
  },
  // พระจันทร์เสี้ยว + วงแหวนพัลส์
  moonRing(o) {
    const x = _ox0(o), y = _oy0(o), peak = (o.variant === 'peak');
    const life = _rmLife(o.dur || (peak ? 0.95 : 0.7)), col = o.color || '#cfd8ff';
    const disc = _mk('moon', x, y, life, col); disc.size = peak ? 46 : 36; _push(disc);
    const r1 = _mk('ring', x, y, life, col); r1.size = peak ? 40 : 32; _push(r1);
    if (!_reduced && _intensity > 0.4) { const r2 = _mk('ring', x, y, life * 0.85, col); r2.size = peak ? 26 : 20; r2.data = 1; _push(r2); }
  },
  // ── MOONLIGHT FEVER primitives (lunar surge / fever rhythm) ─────────────────
  // ใช้สองโทน (--color หลัก + c2 = ม่วง/ฟ้า) เพื่อบุคลิก "ราตรี-เรฟ-สุริยุปราคา".
  // ทั้งหมด event-driven, particle จำกัด, เคารพ reduced-motion/intensity ผ่าน _nParts.

  // พัลส์แสงจันทร์เป็น "จังหวะฟีเวอร์" — วงซ้อนเหลื่อมจังหวะ (beat) ขอบสองโทน
  moonPulse(o) {
    const x = _ox0(o), y = _oy0(o), peak = (o.variant === 'peak');
    const life = _rmLife(o.dur || (peak ? 0.62 : 0.5)), col = o.color || '#bcd0ff';
    const beats = (_reduced || _intensity <= 0.4) ? 1 : (peak ? 3 : 2);
    for (let i = 0; i < beats; i++) {
      const p = _mk('mpulse', x, y, life, col);
      p.size = (peak ? 30 : 22) + i * 8;
      p.c2 = o.color2 || '#9a6cff';
      p.data = i * 0.12;                 // beat stagger (จังหวะ)
      _push(p);
    }
  },
  // จันทร์เสี้ยวกวาด (moonbeam sweep) — อาร์คสว่างที่หมุนกวาดรอบเป้า
  crescentArc(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#bcd0ff';
    let n = _nParts(o.count || 2);
    const life = _rmLife(o.dur || 0.46);
    for (let i = 0; i < n; i++) {
      const p = _mk('crescent', x, y, life, col);
      p.size = 44 + i * 14;
      p.rot = (Math.random() - 0.5) * Math.PI + i * Math.PI;   // มุมเริ่ม กระจาย
      p.c2 = o.color2 || '#8fe9ff';
      p.data = i * 0.06;                 // stagger
      _push(p);
    }
  },
  // วงสุริยุปราคา — แกนมืดจาง + โคโรนาสว่างขยายออก (ใช้ตอน activate/burst)
  eclipseRing(o) {
    const p = _mk('eclipse', _ox0(o), _oy0(o), _rmLife(o.dur || 0.6), o.color || '#cdd8ff');
    p.size = 38; p.c2 = o.color2 || '#9a6cff'; _push(p);
  },
  // ประกายเงินถูก "ดูดเข้า" หาเป้า (silver sparks pulled inward)
  lunarSpark(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#eef3ff';
    let n = _nParts(o.count || 8);
    const life = _rmLife(o.dur || 0.5);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const rad = 58 + Math.random() * 46;
      const p = _mk('lspark', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, life, col);
      const sp = rad / life;             // ถึงศูนย์กลางราว ๆ ตอนจบ
      p.vx = -Math.cos(ang) * sp; p.vy = -Math.sin(ang) * sp;
      p.size = 1.6 + Math.random() * 1.8;
      _push(p);
    }
  },
  // คลื่นแสงจันทร์นุ่ม ๆ แผ่ออก ขอบม่วง→ฟ้า (lunar fever wave)
  feverWave(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#9a6cff', c2 = o.color2 || '#8fe9ff';
    const life = _rmLife(o.dur || 0.7);
    const p = _mk('fwave', x, y, life, col); p.size = 30; p.c2 = c2; _push(p);
    if (!_reduced && _intensity > 0.4) {
      const q = _mk('fwave', x, y, life * 0.85, col); q.size = 20; q.c2 = c2; q.data = 0.1; _push(q);
    }
  },
  // แสงศักดิ์สิทธิ์ก้านแสง (core + rays)
  holyBurst(o) {
    const p = _mk('holy', _ox0(o), _oy0(o), _rmLife(o.dur || 0.6), o.color || '#ffe9a8');
    p.size = 70; _push(p);
  },
  // แถบ scanline กระตุก
  glitch(o) {
    let n = _nParts(3);
    const life = _rmLife(o.dur || 0.36), col = o.color || '#00ffee';
    for (let i = 0; i < n; i++) {
      const top = (0.18 + Math.random() * 0.64) * _ch;
      const p = _mk('scan', 0, top, life, col);
      p.size = 4 + Math.random() * 14;
      p.vx = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 26);
      p.data = i * 0.04;
      _push(p);
    }
  },

  // ── DARK STAKE LORD primitives (cursed casino jackpot) ─────────────────────
  // เจ้าแห่งเดิมพันมืด — สล็อต/777/เหรียญต้องสาป/ดอกไพ่/วงสัญญา/เตือนเสี่ยง.
  // event-driven, particle จำกัด, เคารพ reduced-motion/intensity ผ่าน _nParts.

  // แจ็คพอตแตก: วาบทอง-แดง + ก้านแสงสล็อต + ตัวเลข 777 (overlay สั้น, centered บนบอส)
  jackpotFlash(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.7);
    const p = _mk('jflash', x, y, life, o.color || '#ffcc00');
    p.size = 70; p.c2 = o.color2 || '#cc1133'; _push(p);
  },
  // วงล้อสล็อตหมุน: 3 คอลัมน์ทอง/เขียว (เดิมพันกำลังหมุน)
  slotReel(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.5), col = o.color || '#d4af37';
    let n = _nParts(3);
    for (let i = 0; i < n; i++) {
      const p = _mk('sreel', x + (i - (n - 1) / 2) * 22, y, life, col);
      p.size = 16; p.data = i * 0.05; p.c2 = o.color2 || '#39ff14';
      _push(p);
    }
  },
  // เหรียญต้องสาปพุ่งขึ้นหา HUD (zeny) — ทองมืด + ขอบเขียวนีออน
  cursedCoin(o) {
    let n = _nParts(7);
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.72), col = o.color || '#d4af37';
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.3;
      const sp = 140 + Math.random() * 120;
      const p = _mk('ccoin', x, y, life, col);
      p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp - 80;
      p.size = 5 + Math.random() * 2.5; p.rot = Math.random() * 6;
      p.data = 6 + Math.random() * 6; p.c2 = o.color2 || '#39ff14';
      _push(p);
    }
  },
  // วงสัญญามืด / วงช็อกแดง-ดำ + ขอบทอง (reuse ring kind)
  stakeRing(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.55);
    const col = o.color || '#cc1133', col2 = o.color2 || '#d4af37';
    const a = _mk('ring', x, y, life, col); a.size = 34; _push(a);
    if (!_reduced && _intensity > 0.4) { const b = _mk('ring', x, y, life * 0.9, col2); b.size = 20; b.data = 1; _push(b); }
  },
  // สะเก็ดดอกไพ่ ♠♥♦♣ กระจายออก
  suitSpark(o) {
    let n = _nParts(o.count || 6);
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.55), col = o.color || '#39ff14';
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 70 + Math.random() * 90;
      const p = _mk('suit', x, y, life, col);
      p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
      p.size = 12 + Math.random() * 4; p.data = i % 4; p.rot = (Math.random() - 0.5) * 0.6;
      _push(p);
    }
  },
  // พัลส์เตือนเสี่ยงแดง (warning flicker) — วงแดง + สะเก็ดแดงสั้น
  riskPulse(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.42), col = o.color || '#cc1133';
    const r = _mk('ring', x, y, life, col); r.size = 26; _push(r);
    let n = _nParts(4);
    for (let i = 0; i < n; i++) {
      const ang = (i / Math.max(1, n)) * Math.PI * 2;
      const sp = 70 + Math.random() * 60;
      const p = _mk('spark', x, y, life, col);
      p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp; p.size = 2.4 + Math.random() * 1.6;
      _push(p);
    }
  },

  // ── BAPHOBET primitives (demon contract / devil bet) ───────────────────────
  // "สัญญาปีศาจ / เดิมพันต้องสาป": ยันต์ปีศาจ / วงสัญญานรก / สะเก็ดบาปดูดเข้า /
  // แจ็คพอตนรกจ่าย / คลื่นไฟต้องสาป / วงช็อกเลือด-ดำ. ดำ-แดงเลือด-ส้มนรก-ทองต้องสาป-
  // ม่วงเงา. event-driven, particle จำกัด, เคารพ reduced-motion/intensity ผ่าน _nParts.

  // ยันต์/ตราสัญญาปีศาจวาบ — วงยันต์หมุน (reuse 'rune') + แกนสว่างสั้น (รับพิกัด ctx.x/y)
  demonSigil(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.6), col = o.color || '#cc0011';
    const p = _mk('rune', x, y, life, col);
    p.size = o.size || 30; p.data = 5;       // 5 ticks = sin contract 0–5
    _push(p);
    const core = _mk('glow', x, y, life * 0.7, col); core.size = 20; _push(core);
  },
  // วงสัญญานรก — แกนมืดยุบ (reuse 'void') + วงแหวนแดงแผ่ออก (reuse 'ring')
  contractRing(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.55), col = o.color || '#aa0000';
    const v = _mk('void', x, y, life, '#1a0000'); v.size = 40; _push(v);
    const r = _mk('ring', x, y, life, col); r.size = 32; _push(r);
    if (!_reduced && _intensity > 0.4) { const r2 = _mk('ring', x, y, life * 0.9, '#ff4400'); r2.size = 20; r2.data = 1; _push(r2); }
  },
  // สะเก็ดบาป "ถูกดูดเข้า" หาเป้า (sin embers pulled inward) — reuse 'spark' ไหลเข้า
  sinEmber(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#ff5522';
    let n = _nParts(o.count || 6);
    const life = _rmLife(o.dur || 0.5);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const rad = 48 + Math.random() * 40;
      const p = _mk('spark', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, life, col);
      const sp = rad / life;                 // ถึงศูนย์กลางราว ๆ ตอนจบ
      p.vx = -Math.cos(ang) * sp; p.vy = -Math.sin(ang) * sp;
      p.size = 2 + Math.random() * 2; p.data = 1; // ember = ไม่โดนโน้มถ่วง
      _push(p);
    }
  },
  // DEVIL BET จ่าย — แกนระเบิดทองต้องสาป (reuse 'bcore') + สะเก็ดทองกระจาย
  devilBetBurst(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.6), col = o.color || '#ffcc33';
    const core = _mk('bcore', x, y, life, col); core.size = o.size || 56; _push(core);
    let n = _nParts(8);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const sp = 120 + Math.random() * 120;
      const p = _mk('spark', x, y, life, col);
      p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp; p.size = 2.5 + Math.random() * 2;
      _push(p);
    }
  },
  // คลื่นไฟต้องสาป — แกนไฟ (reuse 'fire') + embers ลอยขึ้น (รับพิกัด ctx.x/y)
  cursedFlame(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.6), col = o.color || '#ff4400';
    const core = _mk('fire', x, y, life, col); core.size = 28; _push(core);
    let n = _nParts(5);
    for (let i = 0; i < n; i++) {
      const p = _mk('spark', x, y, life, col);
      p.vx = (Math.random() - 0.5) * 100; p.vy = -(130 + Math.random() * 130);
      p.size = 2.5 + Math.random() * 2; p.data = 1; // ember = ลอยขึ้น ไม่ตก
      _push(p);
    }
  },
  // วงช็อกเลือด-ดำ — คลื่นกระแทกวงหนา (reuse 'bwave') แดงเลือด + แกนดำ
  bloodShock(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.5), col = o.color || '#cc0011';
    const w = _mk('bwave', x, y, life, col); w.size = 22; w.data = 3; _push(w);
    if (!_reduced && _intensity > 0.4) { const w2 = _mk('bwave', x, y, life * 0.85, '#1a0000'); w2.size = 16; w2.data = 2; _push(w2); }
  },

  // ── LORD OF DEBT primitives (debt contract / accumulating obligation) ──────
  // "สัญญาหนี้ต้องสาป": ตราสัญญาประทับ / โซ่ผูกมัดรัดเข้า / ตัวเลขดอกเบี้ยลอยขึ้น /
  // หลุมทวงหนี้ดูดเข้า / เหรียญต้องสาปถูกสูบจ่าย / ตราสัญญาแตก. ม่วงต้องสาป-ทองบัญชี-ดำเหว.
  // event-driven, particle จำกัด, เคารพ reduced-motion/intensity ผ่าน _nParts.

  // ตราสัญญาหนี้ประทับลง — วงสัญญาสองชั้น + ขีดบัญชีทอง + ยันต์หกเหลี่ยม (สีตามพลังต้องห้าม)
  debtSeal(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.62), col = o.color || '#b066dd';
    const p = _mk('dseal', x, y, life, col); p.size = o.size || 40; p.c2 = o.color2 || '#d4a017'; _push(p);
    const g = _mk('glow', x, y, life * 0.6, col); g.size = 22; _push(g);
  },
  // โซ่เงาผูกมัด "รัดเข้า" หาเป้า — ลิงก์โซ่ไล่จากวงนอกเข้าศูนย์กลาง (รับพิกัด ctx.x/y)
  debtChain(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#9944cc';
    let n = _nParts(o.count || 3);
    const life = _rmLife(o.dur || 0.5);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const rad = 52 + Math.random() * 30;
      const p = _mk('dchain', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, life, col);
      p.rot = ang; p.size = rad; p.data = i * 0.03; // delay + reach length
      _push(p);
    }
  },
  // ตัวเลข/สัญลักษณ์ดอกเบี้ยลอยขึ้น (rising debt/interest glyphs; รับพิกัด ctx.x/y)
  ledgerGlyph(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#d4a017';
    let n = _nParts(o.count || 4);
    const life = _rmLife(o.dur || 0.7);
    const G = ['฿', '¥', '%', '$', '↑'];
    for (let i = 0; i < n; i++) {
      const p = _mk('dglyph', x + (Math.random() - 0.5) * 60, y, life, col);
      p.vy = -(60 + Math.random() * 70); p.size = 13 + Math.random() * 5;
      p.data = i * 0.05; p.txt = G[i % G.length];
      _push(p);
    }
  },
  // หลุมทวงหนี้ดูดเข้า — แกนเหว (reuse 'void') + วงแหวน + สะเก็ดลู่เข้า (collection gravity well)
  collectorPull(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.62), col = o.color || '#aa33ff';
    const v = _mk('void', x, y, life, '#1a0022'); v.size = 46; _push(v);
    const r = _mk('ring', x, y, life, col); r.size = 30; _push(r);
    let n = _nParts(o.count || 8);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const rad = 56 + Math.random() * 44;
      const p = _mk('spark', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, life, col);
      const sp = rad / life;                 // ถึงศูนย์กลางราว ๆ ตอนจบ
      p.vx = -Math.cos(ang) * sp; p.vy = -Math.sin(ang) * sp;
      p.size = 2 + Math.random() * 2; p.data = 1; // ember = ไม่โดนโน้มถ่วง, ถูกดูดเข้า
      _push(p);
    }
  },
  // เหรียญต้องสาปถูก "สูบจ่าย" ลงล่าง (cursed coins siphoned away; รับพิกัด ctx.x/y)
  debtCoinDrain(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.7), col = o.color || '#d4a017';
    let n = _nParts(7);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const rad = 30 + Math.random() * 40;
      const p = _mk('dcoin', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad - 10, life, col);
      p.vx = -Math.cos(ang) * rad * 0.8;     // ลู่เข้าศูนย์กลาง
      p.vy = 40 + Math.random() * 40;        // จมลง (สูบจ่ายหนี้)
      p.size = 5 + Math.random() * 2; p.rot = Math.random() * 6; p.data = 6 + Math.random() * 6;
      _push(p);
    }
  },
  // ตราสัญญาแตก + คลื่นปลดหนี้ — คลื่นกระแทก (reuse 'bwave') + เศษตราแตกกระจาย (reuse 'crack')
  sealBreak(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.5), col = o.color || '#b066dd';
    const w = _mk('bwave', x, y, life, col); w.size = 24; w.data = 4; _push(w);
    let n = _nParts(o.count || 5);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const p = _mk('crack', x, y, life, col);
      p.rot = ang; p.size = 46 + Math.random() * 28; p.data = 2.5;
      _push(p);
    }
  },

  // ── THANABROS primitives (death / time-stop reaping) ───────────────────────
  // "ตัดเวลา / มือมรณะ / เก็บเกี่ยววิญญาณ": นาฬิกาหยุดเวลา / รอยแยกเหวมรณะ / เคียวมรณะ
  // กวาด / ระฆังมรณะกังวาน / วิญญาณถูกเก็บเข้า. ม่วงมรณะ-ดำเหว-ขาวสเปกตรัล.
  // event-driven, particle จำกัด, เคารพ reduced-motion/intensity ผ่าน _nParts.

  // นาฬิกาหยุดเวลา — หน้าปัดหมุนเร็วแล้ว "หยุด" + วาบซีดสั้น ๆ
  timeStop(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.7), col = o.color || '#e0b3ff';
    const c = _mk('tclock', x, y, life, col); c.size = o.size || 52; _push(c);
    const f = _mk('flash', 0, 0, _rmLife(0.22), col); f.size = 0.18; _push(f);
  },
  // รอยแยกเหวมรณะ — แกนเหว (reuse 'void') + วงแหวนมรณะ (death gate opens)
  voidRift(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.6);
    const v = _mk('void', x, y, life, o.color || '#660066'); v.size = o.size || 52; _push(v);
    const r = _mk('ring', x, y, life, o.color2 || '#cc44cc'); r.size = 30; _push(r);
  },
  // เคียวมรณะกวาดข้าม — อาร์คเคียวกวาดเป็นวง (รับพิกัด ctx.x/y)
  reaperScythe(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#cc44cc';
    let n = _reduced ? 1 : (o.count || 2);
    const life = _rmLife(o.dur || 0.5);
    for (let i = 0; i < n; i++) {
      const p = _mk('scythe', x, y, life, col);
      p.rot = (o.rot !== undefined ? o.rot : 0) + (i - (n - 1) / 2) * Math.PI; // เคียวฝั่งตรงข้าม
      p.size = (o.len || 70) + i * 10; p.data = i * 0.06; p.seed = Math.random();
      _push(p);
    }
  },
  // ระฆังมรณะกังวาน — คลื่นกระแทกวงซ้อน (reuse 'bwave') + แกนเรืองมรณะ
  deathKnell(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.7), col = o.color || '#cc00cc';
    const g = _mk('glow', x, y, life * 0.6, col); g.size = 44; _push(g);
    const w = _mk('bwave', x, y, life, col); w.size = 26; w.data = 4; _push(w);
    if (!_reduced && _intensity > 0.4) { const w2 = _mk('bwave', x, y, life * 0.82, '#e0b3ff'); w2.size = 16; w2.data = 2.5; _push(w2); }
  },
  // วิญญาณถูกเก็บเข้าหาศูนย์กลาง — สายวิญญาณลู่เข้า (รับพิกัด ctx.x/y)
  soulReap(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#dd99ff';
    let n = _nParts(o.count || 8);
    const life = _rmLife(o.dur || 0.6);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const rad = 56 + Math.random() * 46;
      const p = _mk('wisp', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, life, col);
      const sp = rad / life;                 // ถึงศูนย์กลางราว ๆ ตอนจบ
      p.vx = -Math.cos(ang) * sp; p.vy = -Math.sin(ang) * sp;
      p.size = 2.4 + Math.random() * 1.8;
      _push(p);
    }
  },

  // ── fire-clone differentiators (EDGEGA claw / ATROSUS resonance) ────────────
  // แยกบุคลิกการ์ดไฟ: EDGEGA = รอยเล็บเสือปะทุ, ATROSUS = คลื่นเรโซแนนซ์อสูร
  // (IFRIED ยังครองไฟ/อินเฟอร์โนผ่าน fireBurst). event-driven, particle จำกัด.

  // รอยเล็บกรงเล็บเสือ — เส้นโค้งคมขนาน 3–4 เส้น + สะเก็ดคม (รับพิกัด ctx.x/y)
  clawRake(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#ff7733';
    let n = _reduced ? 2 : (o.count || 4);
    const life = _rmLife(o.dur || 0.42);
    const baseRot = (o.rot !== undefined ? o.rot : -0.5);
    for (let i = 0; i < n; i++) {
      const p = _mk('claw', x, y + (i - (n - 1) / 2) * 16, life, col);
      p.rot = baseRot; p.size = o.len || 130; p.data = i * 0.04; p.seed = Math.random();
      _push(p);
    }
    let s = _nParts(5);
    for (let i = 0; i < s; i++) {
      const ang = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 120;
      const e = _mk('spark', x, y, life, '#ffd08a');
      e.vx = Math.cos(ang) * sp; e.vy = Math.sin(ang) * sp; e.size = 2 + Math.random() * 2; e.data = 1;
      _push(e);
    }
  },
  // คลื่นเรโซแนนซ์อสูร — วงฮาร์มอนิกขยายเป็นจังหวะซ้อน (sustained resonance) + แกนสั่น
  resonanceWave(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#ee3333';
    const life = _rmLife(o.dur || 0.7);
    const waves = (_reduced || _intensity <= 0.4) ? 1 : (o.count || 3);
    for (let i = 0; i < waves; i++) {
      const p = _mk('rwave', x, y, life, col);
      p.size = 30 + i * 6; p.data = i * 0.13;   // จังหวะเรโซแนนซ์ซ้อน
      _push(p);
    }
    const g = _mk('glow', x, y, life * 0.5, col); g.size = 40; _push(g);
  },

  // ── unexpressed-fantasy primitives (swarm / lock / zero / corruption) ──────
  // ฝูงแมลง (BEELZEBRUH/MISSSTRESS) / คอมโบล็อก (CATULLANUX) / สุญญากาศศูนย์ (COKE ZERO) /
  // ไวรัสคอร์รัปต์ (RSICK-0806). event-driven, particle จำกัด, เคารพ reduced-motion/intensity.

  // ฝูงแมลงบินส่าย (buzz) แล้วกระจาย (รับพิกัด ctx.x/y)
  insectSwarm(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#88cc00';
    let n = _nParts(o.count || 10);
    const life = _rmLife(o.dur || 0.6);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, rad = 10 + Math.random() * 40;
      const p = _mk('swarm', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, life * (0.7 + Math.random() * 0.3), col);
      p.vx = (Math.random() - 0.5) * 60; p.vy = (Math.random() - 0.5) * 60 - 20;
      p.size = 1.6 + Math.random() * 1.8; p.seed = Math.random() * 6.28; p.data = 2 + Math.random() * 3; // buzz freq
      _push(p);
    }
  },
  // คอมโบล็อก — วงเล็บเป้าหมาย 4 มุมหุบเข้า + วงแหวน
  comboLock(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#ffaa44', life = _rmLife(o.dur || 0.55);
    const p = _mk('lock', x, y, life, col); p.size = o.size || 52; _push(p);
    const r = _mk('ring', x, y, life, col); r.size = 26; _push(r);
  },
  // สุญญากาศศูนย์ — วงขาว + แกนดำ หดยุบเข้าหา "ศูนย์" (ZERO annihilation)
  voidZero(o) {
    const x = _ox0(o), y = _oy0(o), life = _rmLife(o.dur || 0.6);
    const p = _mk('vzero', x, y, life, o.color || '#e8f4ff'); p.size = o.size || 54; _push(p);
  },
  // MIDAS GOLD RUSH — แกนทองกิลด์ + วงช็อกทอง + น้ำพุทองคำแท่ง (ingot) + "$" ยักษ์
  // (GOLDEN BRUH). ทองสุกใสล้วน — silhouette แท่งทอง ต่างจากเหรียญกลม/สะเก็ด.
  goldRush(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#ffcc00', life = _rmLife(o.dur || 0.82);
    // แกนทองกิลด์ (gilded core) + วงช็อกทอง (shockwave ring)
    const core = _mk('glow', x, y, _rmLife(0.5), '#fff0a0'); core.size = 90; _push(core);
    const ring = _mk('ring', x, y, _rmLife(0.6), '#ffd24a'); ring.size = 30; _push(ring);
    // น้ำพุทองคำแท่ง — พุ่งขึ้นเป็นพัด แล้วร่วงลงตามแรงโน้มถ่วง + หมุน
    let n = _nParts(o.count || 9);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.26;
      const sp = 200 + Math.random() * 190;
      const p = _mk('gbar', x, y, life, col);
      p.vx = Math.cos(ang) * sp * 0.62; p.vy = Math.sin(ang) * sp - 90;
      p.size = 13 + Math.random() * 9; p.rot = (Math.random() - 0.5) * 2;
      p.data = (Math.random() - 0.5) * 9; // spin speed
      _push(p);
    }
    // "$" ยักษ์ลอยขึ้น (treasure mega-glyph) — reuse dglyph kind, สีทอง
    if (!_reduced) {
      const g = _mk('dglyph', x, y - 8, _rmLife(0.78), '#ffe680');
      g.txt = '$'; g.size = 40; g.vy = -78; g.data = 0.03;
      _push(g);
    }
  },
  // VALKYRIE DESCENT — ปีกขนนกศักดิ์สิทธิ์กางออก + หอกแสงทิ่มลง + ขนนกร่วง + (peak) วงรูน
  // (VALKYRIZZ). silhouette "ปีก+หอก" celestial ขาว-ทอง-ม่วง — ต่างจาก holyBurst รัศมีก้าน.
  valkyrieDescend(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#cc88ff';
    const peak = o.variant === 'peak';
    const life = _rmLife(peak ? 0.85 : 0.6);
    // ปีกวาลคีรี (ทั้งสองข้างในอนุภาคเดียว)
    const w = _mk('vwing', x, y, life, col); w.size = peak ? 122 : 84; _push(w);
    // หอกแสงทิ่มลงจากเบื้องบน
    const s = _mk('vspear', x, y, _rmLife(peak ? 0.6 : 0.46), '#ffe9ff');
    s.size = peak ? 150 : 112; s.data = peak ? 190 : 140; _push(s);
    // แกนแสงเทพ
    const g = _mk('glow', x, y, _rmLife(0.5), '#ffe9ff'); g.size = peak ? 72 : 48; _push(g);
    // ขนนกร่วง (feathers drifting down)
    let n = _nParts(peak ? 9 : 5);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5;
      const sp = 70 + Math.random() * 95;
      const p = _mk('vfeather', x + (Math.random() - 0.5) * 44, y - 18, life, (i % 2) ? col : '#ffe9ff');
      p.vx = Math.cos(ang) * sp * 0.5; p.vy = Math.abs(Math.sin(ang)) * sp * 0.4 + 26;
      p.size = 5 + Math.random() * 5; p.rot = Math.random() * 6; p.data = (Math.random() - 0.5) * 4;
      _push(p);
    }
    // peak: วงรูนทอง (rune ring)
    if (peak) { const r = _mk('ring', x, y, _rmLife(0.72), '#ffd96b'); r.size = 34; _push(r); }
  },
  // GLOOM SURGE — ดวงตา GLOOM จ้อง + หนวดเงาทะยานคว้าจากด้านล่าง + (peak) ดูดกลืนเข้า
  // (GLOOM UNDER SIDE). silhouette "ตา+หนวดเงา" ม่วงเข้ม-ดำเหว. tier ขับความสูง/จำนวน.
  gloomSurge(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#6633aa';
    const max = o.tier === 'max';
    const tier = max ? 4 : Math.max(1, (o.tier | 0) || 1);
    const life = _rmLife(max ? 0.85 : 0.6);
    // ดวงตา GLOOM (obsession watching)
    const eye = _mk('geye', x, y - 6, life, col);
    eye.size = max ? 64 : (32 + tier * 8); eye.data = max ? 1 : 0; _push(eye);
    // หนวดเงาทะยานจากด้านล่าง (count/height ตาม tier — progressive)
    let n = _nParts(max ? 9 : (2 + tier * 2));
    const baseY = y + (max ? 66 : 48);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * (max ? 24 : 28);
      const p = _mk('gtendril', x + off, baseY, life * (0.8 + Math.random() * 0.3), col);
      p.data = (max ? 120 : 56 + tier * 22) + Math.random() * 30; // ความสูง
      p.size = 5 + Math.random() * 4 + tier;                       // ความหนา
      p.vx = (Math.random() - 0.5) * 22;                           // โค้งเอน
      _push(p);
    }
    // แอ่งเงาเหวใต้ตัว (dark undertone pool)
    const sh = _mk('shadow', x, y + (max ? 40 : 28), _rmLife(max ? 0.7 : 0.5), '#1a0030');
    sh.size = max ? 52 : 34; _push(sh);
    // peak: เวลา/วิญญาณถูกดูดกลืนเข้า (devoured inward)
    if (max) {
      let s = _nParts(8);
      for (let i = 0; i < s; i++) {
        const ang = (i / s) * Math.PI * 2, rad = 60 + Math.random() * 40;
        const e = _mk('spark', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, _rmLife(0.6), '#b388ff');
        e.vx = -Math.cos(ang) * rad * 1.7; e.vy = -Math.sin(ang) * rad * 1.7; // ลู่เข้า (กลืน)
        e.size = 2 + Math.random() * 2; e.data = 1; // ไม่มีโน้มถ่วง
        _push(e);
      }
    }
  },
  // MECHA CHARGE — แกนขับเคลื่อนหกเหลี่ยมเรือง + วงจรไฟฟ้าลู่เข้าชาร์จ (KILL-D01 DRIVE TOKEN)
  mechaCharge(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#00ffee', life = _rmLife(0.5);
    const core = _mk('mcore', x, y, life, col); core.size = 26; core.data = 0; _push(core); // data 0 = charging (grow)
    let n = _nParts(6);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, rad = 40 + Math.random() * 26;
      const e = _mk('spark', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, _rmLife(0.45), col);
      e.vx = -Math.cos(ang) * rad * 1.9; e.vy = -Math.sin(ang) * rad * 1.9; // ลู่เข้า (ชาร์จ)
      e.size = 2 + Math.random() * 1.6; e.data = 1; _push(e); // data 1 = no gravity
    }
  },
  // MECHA LASER — ปืนเลเซอร์ฟาดลง + reticle ล็อกเป้า + แกนปากกระบอก (KILL-D01 DRIVE DISCHARGE)
  mechaLaser(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#00ffee';
    const max = o.variant === 'max';
    const core = _mk('mcore', x, y, _rmLife(max ? 0.5 : 0.4), col); core.size = max ? 40 : 24; core.data = 1; _push(core); // data 1 = fire (shrink)
    const beam = _mk('mbeam', x, y, _rmLife(max ? 0.6 : 0.42), col); beam.size = max ? 175 : 120; beam.data = max ? 15 : 9; _push(beam);
    if (max && !_reduced) { const b2 = _mk('mbeam', x, y, _rmLife(0.6), '#aaffff'); b2.size = 150; b2.data = 8; b2.rot = 0.22; _push(b2); }
    let n = _nParts(max ? 9 : 5);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.4, sp = 120 + Math.random() * 120;
      const e = _mk('spark', x, y, _rmLife(0.45), max ? '#aaffff' : col);
      e.vx = Math.cos(ang) * sp; e.vy = Math.sin(ang) * sp * 0.5; e.size = 2 + Math.random() * 2; e.data = 1; _push(e);
    }
  },
  // NOSIRIS — วิญญาณทองหมุนเข้า (soul wisps) + แกนเรืองทอง (soul collection)
  soulGather(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#ffdd66', life = _rmLife(0.62);
    const g = _mk('glow', x, y, _rmLife(0.5), col); g.size = 40; _push(g);
    let n = _nParts(6);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5, rad = 52 + Math.random() * 36;
      const p = _mk('soul', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, life, col);
      p.vx = -Math.cos(ang) * rad * 1.5; p.vy = -Math.sin(ang) * rad * 1.5; p.size = 3 + Math.random() * 2; _push(p);
    }
  },
  // NOSIRIS peak — ตราหิน hieroglyph + ลำแสงพิพากษา + วิญญาณปะทุออก (JUDGMENT)
  judgmentSeal(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#ffdd66';
    const seal = _mk('runeseal', x, y, _rmLife(0.85), col); seal.size = 70; _push(seal);
    const g = _mk('glow', x, y, _rmLife(0.6), '#fff6d0'); g.size = 80; _push(g);
    let n = _nParts(9);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, sp = 120 + Math.random() * 120;
      const p = _mk('soul', x, y, _rmLife(0.7), col);
      p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp; p.size = 3 + Math.random() * 2.5; _push(p);
    }
  },
  // COKE ZERO — หลุมดำดูดยุบ: แกน void + วงเลนส์โน้มถ่วงหดเข้า + เศษบิดลู่เข้า (+singularity ระเบิด)
  gravityWell(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#e8f4ff';
    const sing = o.variant === 'singularity';
    const core = _mk('vzero', x, y, _rmLife(sing ? 0.7 : 0.55), col); core.size = sing ? 60 : 44; _push(core);
    let rN = _nParts(sing ? 4 : 3);
    for (let i = 0; i < rN; i++) { const g = _mk('glens', x, y, _rmLife(sing ? 0.6 : 0.5), col); g.size = 70 + i * 26; _push(g); }
    let n = _nParts(sing ? 9 : 6);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4, rad = 70 + Math.random() * 50;
      const p = _mk('vfrag', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, _rmLife(0.6), col);
      p.vx = -Math.cos(ang) * rad * 1.8; p.vy = -Math.sin(ang) * rad * 1.8; p.size = 4 + Math.random() * 4;
      p.rot = Math.random() * 6; p.data = (Math.random() - 0.5) * 8; _push(p);
    }
    if (sing) {
      let s = _nParts(10);
      for (let i = 0; i < s; i++) {
        const ang = (i / s) * Math.PI * 2, sp = 160 + Math.random() * 130;
        const e = _mk('spark', x, y, _rmLife(0.5), '#cfe4ff');
        e.vx = Math.cos(ang) * sp; e.vy = Math.sin(ang) * sp; e.size = 2 + Math.random() * 2; e.data = 1; _push(e);
      }
    }
  },
  // DETAILED — ลำสแกนแนวนอนกวาด + data ticks (analysis scan)
  scanSweep(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#00ffcc';
    const s = _mk('dscan', x, y, _rmLife(0.5), col); s.size = 120; s.data = 70; _push(s);
  },
  // DETAILED peak — แผนที่วิเคราะห์ทั้งสนาม: สแกนใหญ่ + crosshair ล็อกหลายจุด + วงล็อก (ANALYSIS COMPLETE)
  analysisMap(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#00ffcc';
    const s = _mk('dscan', x, y, _rmLife(0.7), col); s.size = 200; s.data = 130; _push(s);
    const c0 = _mk('dcross', x, y, _rmLife(0.7), col); c0.size = 46; _push(c0);
    if (!_reduced) {
      const pts = [[-70, -40], [80, -20], [0, 60]];
      for (let i = 0; i < pts.length; i++) { const c = _mk('dcross', x + pts[i][0], y + pts[i][1], _rmLife(0.7), '#39ffaa'); c.size = 22; _push(c); }
    }
    const r = _mk('ring', x, y, _rmLife(0.7), col); r.size = 30; _push(r);
  },
  // MISSSTRESS — ฝูงผึ้งทอง (gold bees) + (command) เซลล์รังผึ้งปะทุ (queen swarm)
  queenSwarm(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#ffd24a';
    const cmd = o.variant === 'command';
    let n = _nParts(cmd ? 14 : 5);
    const life = _rmLife(cmd ? 0.7 : 0.55);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, rad = 10 + Math.random() * (cmd ? 52 : 34);
      const p = _mk('swarm', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, life * (0.7 + Math.random() * 0.3), col);
      p.vx = (Math.random() - 0.5) * (cmd ? 90 : 60); p.vy = (Math.random() - 0.5) * (cmd ? 90 : 60) - 20;
      p.size = 1.8 + Math.random() * 1.8; p.seed = Math.random() * 6.28; p.data = 2 + Math.random() * 3; _push(p);
    }
    if (cmd) { for (let i = 0; i < _nParts(3); i++) { const h = _mk('hexcell', x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 40, _rmLife(0.6), '#ffcf4a'); h.size = 14 + Math.random() * 8; _push(h); } }
  },
  // MISSSTRESS — กลุ่มเซลล์รังผึ้งหกเหลี่ยมแผ่ออก (honeycomb burst)
  honeycombBurst(o) {
    const x = _ox0(o), y = _oy0(o), col = o.color || '#ffcf4a';
    const offs = [[0, 0], [-26, -14], [26, -14], [-26, 16], [26, 16], [0, -30]];
    let k = _reduced ? 2 : offs.length;
    for (let i = 0; i < k; i++) { const h = _mk('hexcell', x + offs[i][0], y + offs[i][1], _rmLife(0.6), col); h.size = 12 + Math.random() * 6; _push(h); }
  },
  // ไวรัสคอร์รัปต์ — บล็อกดิจิทัลกระตุก/เลื่อน (ต่างจาก scanline glitch)
  corruptGlitch(o) {
    const col = o.color || '#ff2233', life = _rmLife(o.dur || 0.4);
    let n = _nParts(o.count || 7);
    for (let i = 0; i < n; i++) {
      const p = _mk('cglitch', Math.random() * _cw, (0.15 + Math.random() * 0.7) * _ch, life, col);
      p.size = 10 + Math.random() * 40; p.data = 3 + Math.random() * 10; // block w/h
      p.vx = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 40); p.seed = Math.random();
      _push(p);
    }
  },

  // ── BOSS SKILL PRIMITIVES ──────────────────────────────────────────────────
  // "ท่าไม้ตาย" ของบอสแต่ละตัว — ยิงเฉพาะตอน skill activate (Overdrive) เท่านั้น
  // ไม่มี loop ถาวร, particle ต่อครั้งจำกัด, เคารพ reduced-motion/intensity ผ่าน _nParts.

  // หมัดอิมแพกต์: แกนสว่างพอง + สะเก็ดกระจายรอบทิศ + (ออปชั่น) ดาวกระเด็น
  bossImpactBurst(o) {
    const x = _ox0(o), y = _oy0(o), dur = o.dur || 0.5;
    const col = o.color || '#ffd24a', col2 = o.color2 || '#fff3c0';
    const core = _mk('bcore', x, y, _rmLife(dur * 0.72), col2); core.size = o.size || 60; _push(core);
    let n = _nParts(o.count || 9);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 140 + Math.random() * 170;
      const p = _mk('spark', x, y, _rmLife(dur), col);
      p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
      p.size = 2.5 + Math.random() * 2.5; p.data = 1; // ไม่มีโน้มถ่วง (หมัดกระจายรัศมี)
      _push(p);
    }
    if (o.stars && !_reduced) {
      let s = _nParts(o.stars);
      for (let i = 0; i < s; i++) {
        const ang = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 120;
        const st = _mk('star', x, y, _rmLife(dur), col2);
        st.vx = Math.cos(ang) * sp; st.vy = Math.sin(ang) * sp - 40;
        st.size = 7 + Math.random() * 5; st.rot = Math.random() * 6; st.data = 5 + Math.random() * 5;
        _push(st);
      }
    }
  },
  // คลื่นกระแทก: วงหนาแผ่ออก + (ออปชั่น) รอยร้าวพื้น (สายบรูตโบราณ)
  bossShockwave(o) {
    const x = _ox0(o), y = _oy0(o), dur = o.dur || 0.6, col = o.color || '#ff7a1e';
    const w = _mk('bwave', x, y, _rmLife(dur), col); w.size = o.size || 36; w.data = o.thick || 7; _push(w);
    if (!_reduced && _intensity > 0.4) {
      const w2 = _mk('bwave', x, y, _rmLife(dur * 0.82), col); w2.size = (o.size || 36) * 0.6; w2.data = (o.thick || 7) * 0.6; _push(w2);
    }
    if (o.cracks) {
      let n = _nParts(o.cracks), gy = y + (o.groundOffset || 0);
      for (let i = 0; i < n; i++) {
        const ang = Math.PI * (0.12 + Math.random() * 0.76); // พัดลงล่าง
        const p = _mk('crack', x, gy, _rmLife(dur), col);
        p.rot = ang; p.size = 48 + Math.random() * 42; p.data = 3;
        _push(p);
      }
    }
  },
  // เส้นพลังเหวี่ยง: อาร์คโค้งกวาดหลายเส้น (ดนตรี/พระจันทร์)
  bossEnergyTrail(o) {
    const x = _ox0(o), y = _oy0(o), dur = o.dur || 0.55;
    const col = o.color || '#8fb4ff', col2 = o.color2 || '#ffd24a';
    let n = _nParts(o.count || 4);
    for (let i = 0; i < n; i++) {
      const p = _mk('btrail', x, y, _rmLife(dur), (i % 2) ? col2 : col);
      p.rot = (o.angle !== undefined ? o.angle : -0.5) + (i - (n - 1) / 2) * 0.5;
      p.size = 118 + Math.random() * 44; p.data = i * 0.05; p.seed = Math.random();
      _push(p);
    }
  },
  // สายฟ้า/พลาสมา: แกนเรือง + สายฟ้าแตกแขนงหลายเส้น (สปิริต)
  bossLightningArc(o) {
    const x = _ox0(o), y = _oy0(o), dur = o.dur || 0.4, col = o.color || '#3fa9ff';
    const g = _mk('glow', x, y, _rmLife(dur), o.color2 || '#aef0ff'); g.size = o.size || 56; _push(g);
    let n = _reduced ? 1 : _nParts(o.count || 3);
    for (let i = 0; i < n; i++) {
      const ang = (i / Math.max(1, n)) * Math.PI * 2 + Math.random();
      const len = 70 + Math.random() * 60;
      const p = _mk('bolt', x, y, _rmLife(dur), col);
      const pts = []; const segs = 5;
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      for (let s = 0; s <= segs; s++) {
        const tt = s / segs;
        pts.push(x + (ex - x) * tt + (Math.random() - 0.5) * 18,
                 y + (ey - y) * tt + (Math.random() - 0.5) * 18);
      }
      p.pts = pts; p.size = 2.5; _push(p);
    }
  },
  // ฟันดาบ: รอยเฉือนไขว้ + สะเก็ดจุดตัด (สายมีดเร็ว)
  bossSlash(o) {
    const x = _ox0(o), y = _oy0(o), dur = o.dur || 0.36, col = o.color || '#ff2a3a';
    let n = _reduced ? 1 : (o.count || 2);
    for (let i = 0; i < n; i++) {
      const p = _mk('slash', x, y + (i - (n - 1) / 2) * 14, _rmLife(dur), col);
      p.rot = (o.rot !== undefined ? o.rot : (-40 + i * 80)) * Math.PI / 180;
      p.size = o.len || 150; p.data = i * 0.06;
      _push(p);
    }
    if (!_reduced && o.spark) {
      let s = _nParts(o.spark);
      for (let i = 0; i < s; i++) {
        const ang = Math.random() * Math.PI * 2, sp = 100 + Math.random() * 120;
        const sk = _mk('spark', x, y, _rmLife(dur * 1.1), col);
        sk.vx = Math.cos(ang) * sp; sk.vy = Math.sin(ang) * sp; sk.size = 2 + Math.random() * 2; sk.data = 1;
        _push(sk);
      }
    }
  },
  // ออร่าพอง: แสงเรือง + วงแหวนซ้อน (สายพลังสะอาด)
  bossAuraPulse(o) {
    const x = _ox0(o), y = _oy0(o), dur = o.dur || 0.6;
    const col = o.color || '#3ad0ff', col2 = o.color2 || '#2a6cff';
    const g = _mk('glow', x, y, _rmLife(dur), col); g.size = o.size || 80; _push(g);
    const r = _mk('ring', x, y, _rmLife(dur), col2); r.size = 30; _push(r);
    if (!_reduced && _intensity > 0.4) { const r2 = _mk('ring', x, y, _rmLife(dur * 0.85), col); r2.size = 20; r2.data = 1; _push(r2); }
  },
  // วงเวทย์: วงสองชั้นหมุน + ก้านรูน + แกนเรือง (สายศักดิ์สิทธิ์)
  bossRuneCircle(o) {
    const x = _ox0(o), y = _oy0(o), dur = o.dur || 0.8, col = o.color || '#ffe28a';
    const ru = _mk('rune', x, y, _rmLife(dur), col); ru.size = o.size || 64; ru.data = o.runes || 8; _push(ru);
    const g = _mk('glow', x, y, _rmLife(dur * 0.7), o.color2 || '#fff3c0'); g.size = (o.size || 64) * 0.7; _push(g);
  },
  // พัลส์มืด/บิดเบือน: void ยุบเข้า + วงแหวน + แถบ glitch (สายปริศนา)
  bossGlitchPulse(o) {
    const x = _ox0(o), y = _oy0(o), dur = o.dur || 0.5;
    const col = o.color || '#b46cff', col2 = o.color2 || '#6a18d0';
    const v = _mk('void', x, y, _rmLife(dur), col2); v.size = o.size || 70; _push(v);
    const r = _mk('ring', x, y, _rmLife(dur), col); r.size = 30; _push(r);
    let n = _nParts(o.glitch || 3);
    for (let i = 0; i < n; i++) {
      const top = (0.2 + Math.random() * 0.6) * _ch;
      const p = _mk('scan', 0, top, _rmLife(dur * 0.7), col);
      p.size = 4 + Math.random() * 12; p.vx = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 24); p.data = i * 0.04;
      _push(p);
    }
  },
};

// ── PUBLIC: set intensity from in-game Flash Effect setting ──────────────────
function setVFXLevel(level) {
  if (level === 'off')      { _intensity = 0.0; }
  else if (level === 'low') { _intensity = 0.5; _autoDownscaled = false; }
  else                      { _intensity = 1.0; _autoDownscaled = false; }
  _smoothFps   = 60;
  _lowFpsStart = 0;
}

// ── auto-downscale เมื่อ FPS ตำกว่า 30 ต่อเนื่อง 3 วินาที ─────────────────
function _autoDownscaleFps() {
  _autoDownscaled = true;
  _intensity   = Math.max(0.0, _intensity - 0.5);
  _lowFpsStart = 0;
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('noctis:vfx-auto-downscale', {
        detail: { level: _intensity <= 0.0 ? 'off' : 'low' }
      }));
    }
  } catch(e) {}
}

// ── PUBLIC: spawn one primitive's particles ──────────────────────────────────
function spawnCanvasVfx(type, options) {
  if (!_ensure()) return;            // unsupported / no host → no-op
  if (_hidden) return;               // แท็บถูกซ่อน → ไม่ปล่อยของ
  if (_intensity <= 0.0) return;     // 'off' mode → ข้าม transient ทั้งหมด
  const b = BUILD[type];
  if (!b) return;                    // unknown primitive → safe no-op
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  _noteBurst(now);                   // feed heavy-combat detection (dynamic budget)
  try { b(options || {}); } catch (e) { /* คอสเมติกต้องไม่ทำเกมพัง */ }
  _start();
}

// ── PUBLIC: replay a card's whole VFX_MAP entry for a context (convenience) ──
// อ่าน map จาก window.CardVFX แบบ runtime (เลี่ยง circular import).
function spawnCardCanvasVfx(cardId, context, coord) {
  const C = (typeof window !== 'undefined') && window.CardVFX;
  const map = C && C.VFX_MAP;
  if (!map) return;
  const e = map[cardId];
  if (!e || !e.on) return;
  let spec = e.on[context];
  if (!spec) return;
  const list = Array.isArray(spec[0]) ? spec : [spec];
  for (const s of list) {
    if (!Array.isArray(s)) continue;
    const name = s[0];
    // '$state' sentinel (เช่น LORD OF DEBT seal สีพลังต้องห้าม) → fallback ใน convenience path
    const opts = { color: (s[1] === '$state' ? '#b066dd' : s[1]) };
    if (coord) { opts.x = coord.x; opts.y = coord.y; }
    // เดา arg ที่สอง: ตัวเลข = count, สตริง = variant (พอเพียงสำหรับ convenience API)
    if (typeof s[2] === 'number') opts.count = s[2];
    else if (typeof s[2] === 'string') opts.variant = s[2];
    if (name === 'breakCrack' && s[2] === true) opts.heavy = true;
    spawnCanvasVfx(name, opts);
  }
}

// ── PUBLIC: clear all live particles ─────────────────────────────────────────
function clearCanvasVfx() {
  for (let i = 0; i < _parts.length; i++) _recycle(_parts[i]);
  _parts.length = 0;
  if (_ctx) _ctx.clearRect(0, 0, _cw, _ch);
}

// ── render loop (เริ่มเมื่อมี particle, หยุดเมื่อว่าง) ────────────────────────
function _start() {
  if (_raf || _hidden || !_ctx) return;
  _last = 0;
  _raf = requestAnimationFrame(_tick);
}

function _tick(ts) {
  _raf = 0;
  if (_hidden || !_ctx) return;
  const dt = _last ? Math.min((ts - _last) / 1000, MAX_DT) : 0.016;
  _last = ts;

  // ── FPS auto-downscale: ตรวจ FPS เฉลี่ยผ่าน EMA; ถ้าตำกว่า 30 ติดต่อ 3 วิ → ลด level อัตโนมัติ
  if (dt > 0 && !_autoDownscaled && _intensity > 0.4) {
    _smoothFps = _smoothFps * 0.92 + (1 / dt) * 0.08;
    if (_smoothFps < 30) {
      if (!_lowFpsStart) _lowFpsStart = ts;
      else if (ts - _lowFpsStart > 3000) _autoDownscaleFps();
    } else {
      _lowFpsStart = 0;
    }
  }

  _ctx.clearRect(0, 0, _cw, _ch);
  let n = 0;
  for (let i = 0; i < _parts.length; i++) {
    const p = _parts[i];
    p.age += dt;
    // R3: retire once the fade has dropped below ~0.12 alpha (visually dead
    // frames that still cost a draw + hold a pool slot). Per-kind because the
    // safe cutoff depends on the fade curve — only monotonic (1−t)/(1−t²) kinds
    // are trimmed; sin-fade, delayed-stagger, and gradient-fill kinds keep full
    // life (trimming those early WOULD be visible), so this never regresses.
    const trim = _LIFE_TRIM[p.kind];
    if (p.age >= (trim ? p.life * trim : p.life)) { _recycle(p); continue; }
    _draw(p, dt);
    _parts[n++] = p;
  }
  _parts.length = n;
  if (n > 0) _raf = requestAnimationFrame(_tick);   // ยังมีของ → วาดต่อ
  else _last = 0;                                     // ว่าง → หยุด (ประหยัดแบต)
}

// ── R3: per-kind lifetime trim (retire when alpha < ~0.12) ───────────────────
// Only kinds whose alpha is a monotonic (1−t) or (1−t²) fade computed from the
// GLOBAL t (no delay/stagger phase, no mid-life sin) are listed — the fraction
// is exactly where that curve crosses ~0.12. Everything else keeps full life.
const _LIFE_TRIM = {
  spark: 0.88, crack: 0.88, ring: 0.88, suit: 0.88, streak: 0.88,
  shadow: 0.86, drain: 0.87, dcoin: 0.88,
  coin: 0.93, ccoin: 0.93, gbar: 0.92, vfeather: 0.9,
};

// ── R1 + R5: alpha-aware shadowBlur ──────────────────────────────────────────
// shadowBlur is the most expensive canvas op on mobile (one offscreen blur pass
// per draw). It is set right after ctx.globalAlpha in every blurred kind, so we
// read that alpha here: skip the pass entirely once the glow is imperceptible
// (R1, alpha < _SB_GATE) and otherwise scale the radius with alpha so the halo
// fades out with the stroke instead of paying full cost on a near-gone particle
// (R5). Result clamped to [0, base]; identical look at full alpha.
const _SB_GATE = 0.25;
function _sb(base) {
  const a = _ctx ? _ctx.globalAlpha : 1;
  if (a < _SB_GATE) return 0;        // R1: no offscreen blur pass at all
  const b = base * a;                // R5: blur ∝ alpha
  return b > base ? base : b;        // clamp ≤ base
}

// ── per-kind update + draw ───────────────────────────────────────────────────
function _draw(p, dt) {
  const t = p.age / p.life;          // 0→1 progress
  const ctx = _ctx;
  switch (p.kind) {
    case 'flash': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = p.size * (1 - t);
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.fillRect(0, 0, _cw, _ch);
      break;
    }
    case 'spark': {
      if (!p.data) p.vy += 320 * dt;   // ember (data=1) ไม่ต้องโดนโน้มถ่วง
      p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, 6.283);
      ctx.fill();
      break;
    }
    case 'slash': {
      if (p.age < p.data) break;       // honor stagger delay
      const lt = (p.age - p.data) / (p.life - p.data);
      const sx = lt < 0.35 ? (0.2 + lt / 0.35 * 0.85) : (1.05 + (lt - 0.35) * 0.15);
      const a = lt < 0.35 ? lt / 0.35 : (1 - (lt - 0.35) / 0.65);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const w = p.size * sx, h = 7;
      const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      grad.addColorStop(0, _rgba(p.color, 0)); grad.addColorStop(0.5, _rgba('#ffffff', 1));
      grad.addColorStop(1, _rgba(p.color, 0));
      ctx.fillStyle = grad; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
      break;
    }
    case 'coin': {
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.data * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * Math.abs(Math.cos(p.rot)) + 1, p.size, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'shadow': {
      ctx.globalCompositeOperation = 'source-over';
      const r = p.size * (0.3 + t * 3);
      const a = (1 - t) * 0.85;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, _rgba(p.color, a)); g.addColorStop(0.7, _rgba(p.color, a * 0.5));
      g.addColorStop(1, _rgba(p.color, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      break;
    }
    case 'fire': {
      p.y -= 70 * dt;
      ctx.globalCompositeOperation = 'lighter';
      const r = p.size * (1 - t * 0.6);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, _rgba('#ffee88', (1 - t) * 0.9));
      g.addColorStop(0.5, _rgba(p.color, (1 - t) * 0.7));
      g.addColorStop(1, _rgba(p.color, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      break;
    }
    case 'bolt': {
      const a = t < 0.25 ? 1 : (1 - (t - 0.25) / 0.75);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1);
      ctx.lineWidth = p.size; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(8);
      ctx.beginPath();
      const pts = p.pts;
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke(); ctx.shadowBlur = 0;
      break;
    }
    case 'crack': {
      const len = p.size * Math.min(1, t * 3);
      const a = 1 - t;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = p.data; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(len * 0.6, len * 0.12 * (p.seed - 0.5) * 4); // เยื้องเล็กน้อยให้ดูแตก
      ctx.lineTo(len, 0); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'streak': {
      if (p.age < p.data) break;
      p.x += p.vx * dt;
      const a = 1 - t;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const grad = ctx.createLinearGradient(p.x - p.size, p.y, p.x, p.y);
      grad.addColorStop(0, _rgba(p.color, 0)); grad.addColorStop(1, _rgba(p.color, 1));
      ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x - p.size, p.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      break;
    }
    case 'drain': {
      const r = p.size * (3 * (1 - t) + 0.2);   // หดเข้า
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.stroke();
      break;
    }
    case 'glow': {
      ctx.globalCompositeOperation = 'lighter';
      const r = p.size * (0.6 + t * 0.8);
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, _rgba(p.color, a * 0.85)); g.addColorStop(0.6, _rgba(p.color, a * 0.35));
      g.addColorStop(1, _rgba(p.color, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      break;
    }
    case 'ring': {
      const r = p.size * (0.4 + t * 3) * (p.data ? 0.8 : 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - t);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 3;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(10);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'moon': {
      // จันทร์เสี้ยว: ดิสก์เต็ม ลบดิสก์เยื้อง → เสี้ยว (mix-blend screen feel)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.sin(Math.min(1, t) * Math.PI) * 0.8;
      const r = p.size * (0.7 + t * 0.5);
      ctx.fillStyle = _rgba('#ffffff', 0.9);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x + r * 0.5, p.y - r * 0.2, r * 0.95, 0, 6.283); ctx.fill();
      ctx.restore();
      break;
    }
    // ── MOONLIGHT FEVER kinds ─────────────────────────────────────────────
    case 'mpulse': {
      // จังหวะฟีเวอร์: วงพัลส์ขยาย แกนเรืองนุ่ม + ขอบสองโทนคม
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      const r = p.size * (0.4 + lt * 3);
      const a = (1 - lt);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, r * 0.35, p.x, p.y, r);
      g.addColorStop(0, _rgba(p.color, 0));
      g.addColorStop(0.78, _rgba(p.color, a * 0.5));
      g.addColorStop(1, _rgba(p.c2 || p.color, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      ctx.globalAlpha = Math.max(0, a);
      ctx.lineWidth = 2.4; ctx.strokeStyle = _rgba(p.color, 1);
      ctx.shadowColor = _rgba(p.c2 || p.color, 1); ctx.shadowBlur = _sb(8);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'crescent': {
      // จันทร์เสี้ยวกวาด: อาร์คสว่างที่หมุนกวาด + แกนขาว
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      const r = p.size * (0.7 + lt * 0.7);
      const a = Math.sin(Math.min(1, lt) * Math.PI);
      const sweep = Math.PI * 0.9;
      const start = p.rot + lt * Math.PI * 0.8;       // กวาดไปตามอายุ
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.lineCap = 'round';
      ctx.strokeStyle = _rgba(p.c2 || p.color, 1); ctx.lineWidth = 5;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(10);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, start, start + sweep); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = _rgba('#ffffff', a); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, start + sweep * 0.15, start + sweep * 0.85); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'eclipse': {
      // สุริยุปราคา: แกนมืดจาง (subtle, fade เร็ว ไม่บังเกม) + โคโรนาสว่างขยาย
      const lt = Math.min(1, t);
      const r = p.size * (0.5 + t * 2.4);
      const a = Math.sin(lt * Math.PI);
      const da = a * 0.22 * (1 - t);
      ctx.globalCompositeOperation = 'source-over';
      const dg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 0.8);
      dg.addColorStop(0, _rgba('#0a0e1f', da));
      dg.addColorStop(0.7, _rgba('#0a0e1f', da * 0.5));
      dg.addColorStop(1, _rgba('#0a0e1f', 0));
      ctx.globalAlpha = 1; ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.8, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.lineWidth = 3 * (1 - t * 0.5); ctx.strokeStyle = _rgba(p.color, 1);
      ctx.shadowColor = _rgba(p.c2 || p.color, 1); ctx.shadowBlur = _sb(10); // R4: 14→10
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'lspark': {
      // ประกายเงินถูกดูดเข้าศูนย์กลาง — เกิด→ลู่เข้า→จางหายใกล้เป้า
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = Math.sin(Math.min(1, t) * Math.PI);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(6);
      const s = p.size * (0.6 + (1 - t) * 0.8);
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case 'fwave': {
      // คลื่นฟีเวอร์นุ่ม ๆ แผ่ออก ขอบม่วง→ฟ้า (alpha ต่ำ ไม่บังเกม)
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      const r = p.size * (0.4 + lt * 4.2);
      const a = (1 - lt) * 0.7;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r);
      g.addColorStop(0, _rgba(p.color, 0));
      g.addColorStop(0.7, _rgba(p.color, a * 0.5));
      g.addColorStop(0.9, _rgba(p.c2 || p.color, a * 0.7));
      g.addColorStop(1, _rgba(p.c2 || p.color, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      break;
    }
    case 'holy': {
      const a = Math.sin(Math.min(1, t) * Math.PI);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      // core
      const r = p.size * (0.5 + t * 0.7);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, _rgba('#ffffff', a)); g.addColorStop(0.5, _rgba(p.color, a * 0.6));
      g.addColorStop(1, _rgba(p.color, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
      // rays (8 ก้าน)
      ctx.globalAlpha = a * 0.7; ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2;
      const rl = p.size * (0.8 + t * 1.4);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + t * 0.5;
        ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r * 0.6, Math.sin(ang) * r * 0.6);
        ctx.lineTo(Math.cos(ang) * rl, Math.sin(ang) * rl); ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'scan': {
      if (p.age < p.data) break;
      const a = 1 - t;
      const jx = p.vx * (0.5 + 0.5 * Math.sin(p.age * 60));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a) * 0.5;
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.fillRect(jx, p.y, _cw, p.size);
      break;
    }
    // ── DARK STAKE LORD kinds (cursed casino jackpot) ─────────────────────
    case 'jflash': {
      // แจ็คพอตแตก: แกนทอง-แดงพอง + ก้านแสงสล็อต 8 ทิศ + ตัวเลข 777 (overlay สั้น)
      const a = Math.sin(Math.min(1, t) * Math.PI);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      const r = p.size * (0.5 + t * 0.9);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, _rgba('#fff6c0', a));
      g.addColorStop(0.45, _rgba(p.color, a * 0.7));
      g.addColorStop(0.8, _rgba(p.c2 || '#cc1133', a * 0.32));
      g.addColorStop(1, _rgba(p.color, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
      ctx.globalAlpha = a * 0.7; ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2;
      const rl = p.size * (1 + t * 1.6);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + t * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * 0.5, Math.sin(ang) * r * 0.5);
        ctx.lineTo(Math.cos(ang) * rl, Math.sin(ang) * rl);
        ctx.stroke();
      }
      // 777 — overlay-only, centered บนบอส, ไม่บัง HUD/เลข/ปุ่ม
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = 'bold ' + Math.round(26 + t * 8) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.shadowColor = _rgba(p.c2 || '#cc1133', 1); ctx.shadowBlur = _sb(12);
      ctx.fillText('777', 0, -p.size * 0.1);
      ctx.shadowBlur = 0;
      ctx.restore();
      break;
    }
    case 'sreel': {
      // วงล้อสล็อตหมุน: แท่งสว่างกระพริบ (spin) แล้ว "หยุด" วาบ
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      const spin = lt < 0.7;
      const a = spin ? (0.55 + 0.45 * Math.sin(p.age * 50)) : Math.max(0, 1 - (lt - 0.7) / 0.3);
      const h = spin ? 52 : 22;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const grad = ctx.createLinearGradient(0, -h, 0, h);
      grad.addColorStop(0, _rgba(p.color, 0));
      grad.addColorStop(0.5, _rgba(p.color, 1));
      grad.addColorStop(0.5, _rgba(p.c2 || '#39ff14', 1));
      grad.addColorStop(1, _rgba(p.color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(-p.size / 2, -h, p.size, h * 2);
      ctx.restore();
      break;
    }
    case 'ccoin': {
      // เหรียญต้องสาป: หมุนพุ่งขึ้นหา HUD + ขอบเขียวนีออน
      p.vy += 760 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.data * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t * t;
      const rx = p.size * Math.abs(Math.cos(p.rot)) + 1, ry = p.size;
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 6.283); ctx.fill();
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = _rgba(p.c2 || '#39ff14', 1); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 6.283); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'suit': {
      // สะเก็ดดอกไพ่ ♠♥♦♣ กระจายออกแล้วตก
      p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - t;
      const SUITS = ['♠', '♥', '♦', '♣'];
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = 'bold ' + Math.round(p.size * (1 - t * 0.3)) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = _rgba(p.color, 1);
      // R2: no shadowBlur on suit glyphs — the additive `lighter` fill already
      // pops at glyph scale, so the blur was redundant (6 blurred glyphs/frame
      // in the jackpot burst). Crisper and cheaper, visually unchanged.
      ctx.fillText(SUITS[(p.data | 0) % 4], 0, 0);
      ctx.restore();
      break;
    }
    // ── LORD OF DEBT kinds (debt contract) ────────────────────────────────
    case 'dseal': {
      // ตราสัญญาหนี้ประทับลง: วง 2 ชั้น + ขีดบัญชีทอง + ยันต์หกเหลี่ยม + จังหวะ "ตอก" ลงมา
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const stamp = t < 0.2 ? (1.55 - t / 0.2 * 0.55) : 1; // ตอกลงแล้วนิ่ง
      const r = p.size * stamp;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(t * 0.6);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2.4;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(10);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, 6.283); ctx.stroke();
      // ขีดบัญชี (ทอง) 6 ขีด — เหมือนตราสัญญา
      ctx.shadowBlur = 0;
      ctx.strokeStyle = _rgba(p.c2 || '#d4a017', 1); ctx.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * 0.66, Math.sin(ang) * r * 0.66);
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        ctx.stroke();
      }
      // ยันต์หกเหลี่ยมด้านใน (contract sigil)
      ctx.strokeStyle = _rgba('#ffffff', a * 0.8); ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const ang = (k / 6) * Math.PI * 2;
        const px = Math.cos(ang) * r * 0.42, py = Math.sin(ang) * r * 0.42;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'dchain': {
      // โซ่ผูกมัด "รัดเข้า": ลิงก์โซ่ไล่จากวงนอก (p.x,p.y) เข้าศูนย์กลาง ตามอายุ
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      const a = Math.sin(Math.min(1, lt) * Math.PI);
      const reach = Math.min(1, lt * 2.2);   // รัดเข้าเร็ว
      const cx = p.x - Math.cos(p.rot) * p.size; // ศูนย์กลาง
      const cy = p.y - Math.sin(p.rot) * p.size;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2.2;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(6);
      const links = 4;
      for (let k = 0; k < links; k++) {
        const f = ((k + 0.5) / links) * reach;
        const mx = p.x + (cx - p.x) * f, my = p.y + (cy - p.y) * f;
        ctx.beginPath(); ctx.ellipse(mx, my, 5.5, 3, p.rot, 0, 6.283); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      break;
    }
    case 'dglyph': {
      // ตัวเลข/สัญลักษณ์ดอกเบี้ยลอยขึ้น (mounting interest)
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      p.y += p.vy * dt; p.vy *= 0.96;        // ลอยขึ้นแล้วชะลอ
      const a = lt < 0.2 ? lt / 0.2 : (1 - (lt - 0.2) / 0.8);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = 'bold ' + Math.round(p.size) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(6);
      ctx.fillText(p.txt || '%', p.x, p.y);
      ctx.shadowBlur = 0;
      break;
    }
    case 'dcoin': {
      // เหรียญต้องสาปถูกสูบจ่าย: ลู่เข้า + จมลง + จาง + ขอบม่วงหนี้
      p.vy += 240 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.data * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - t) * 0.9;
      const rx = p.size * Math.abs(Math.cos(p.rot)) + 1, ry = p.size;
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 6.283); ctx.fill();
      ctx.globalAlpha = (1 - t) * 0.7;
      ctx.strokeStyle = _rgba('#6a1b9a', 1); ctx.lineWidth = 1.4; // ขอบม่วง (หนี้)
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 6.283); ctx.stroke();
      ctx.restore();
      break;
    }
    // ── boss-skill kinds ──────────────────────────────────────────────────
    case 'bcore': {
      // แกนอิมแพกต์สว่าง — พองเร็วแล้วยุบ
      ctx.globalCompositeOperation = 'lighter';
      const r = p.size * (0.3 + t * 1.1);
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, _rgba('#ffffff', a));
      g.addColorStop(0.4, _rgba(p.color, a * 0.8));
      g.addColorStop(1, _rgba(p.color, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      break;
    }
    case 'bwave': {
      // คลื่นกระแทกวงหนา — รัศมีโต ความหนาเรียวลง
      const r = p.size * (0.3 + t * 4);
      const lw = Math.max(0.5, p.data * (1 - t));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = lw;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(6);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'btrail': {
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.sin(Math.min(1, lt) * Math.PI) * 0.9;
      const w = p.size, bend = (p.seed - 0.5) * 70;
      const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      grad.addColorStop(0, _rgba(p.color, 0));
      grad.addColorStop(0.5, _rgba('#ffffff', 1));
      grad.addColorStop(1, _rgba(p.color, 0));
      ctx.strokeStyle = grad; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.quadraticCurveTo(0, bend, w / 2, 0);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'star': {
      p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.data * dt;
      const a = 1 - t * t;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = _rgba(p.color, 1);
      const s = p.size * (1 - t * 0.4);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a1 = k * Math.PI / 2;
        ctx.lineTo(Math.cos(a1) * s, Math.sin(a1) * s);
        ctx.lineTo(Math.cos(a1 + Math.PI / 4) * s * 0.34, Math.sin(a1 + Math.PI / 4) * s * 0.34);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'rune': {
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const r = p.size * (0.7 + t * 0.4);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(t * 1.2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, 6.283); ctx.stroke();
      const ticks = p.data | 0;
      for (let k = 0; k < ticks; k++) {
        const ang = (k / ticks) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * 0.7, Math.sin(ang) * r * 0.7);
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'void': {
      // void ยุบเข้าเล็กน้อย + ขอบสว่าง (สายปริศนา/เงา)
      const r = p.size * (1.1 - t * 0.5);
      const a = Math.sin(Math.min(1, t) * Math.PI);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, _rgba(p.color, a * 0.85));
      g.addColorStop(0.65, _rgba(p.color, a * 0.4));
      g.addColorStop(1, _rgba(p.color, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.strokeStyle = _rgba('#e9c8ff', 1); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.92, 0, 6.283); ctx.stroke();
      break;
    }
    // ── THANABROS kinds ──────────────────────────────────────────────────
    case 'tclock': {
      // นาฬิกาหยุดเวลา: หน้าปัด + ขีดเวลา + เข็มหมุนเร็วช่วงแรกแล้ว "หยุด" (เวลาถูกตัด)
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const r = p.size * (0.85 + t * 0.15);
      const sweep = t < 0.35 ? (t / 0.35) : 1;     // เข็มกวาดเร็วแล้วค้าง
      const hand = sweep * Math.PI * 3.2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2.2;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(10);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke();         // หน้าปัด
      ctx.shadowBlur = 0; ctx.lineWidth = 2;
      for (let k = 0; k < 12; k++) {                                     // ขีดชั่วโมง
        const ang = (k / 12) * Math.PI * 2, inner = (k % 3 === 0) ? 0.78 : 0.88;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * inner, Math.sin(ang) * r * inner);
        ctx.lineTo(Math.cos(ang) * r * 0.97, Math.sin(ang) * r * 0.97);
        ctx.stroke();
      }
      ctx.strokeStyle = _rgba('#ffffff', a); ctx.lineCap = 'round';
      ctx.lineWidth = 2.8;                                              // เข็มสั้น
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(hand - Math.PI / 2) * r * 0.5, Math.sin(hand - Math.PI / 2) * r * 0.5); ctx.stroke();
      ctx.lineWidth = 1.8;                                              // เข็มยาว
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(hand * 1.7 - Math.PI / 2) * r * 0.72, Math.sin(hand * 1.7 - Math.PI / 2) * r * 0.72); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'scythe': {
      // เคียวมรณะกวาด: อาร์คเคียวสองชั้น (คม) กวาดเป็นวงตามอายุ (รับ p.data = delay)
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      const a = Math.sin(Math.min(1, lt) * Math.PI);
      const dir = p.seed < 0.5 ? -1 : 1;
      const sweep = (lt * 1.6 - 0.8) * dir;          // กวาด -0.8..0.8 rad
      const R = p.size * (0.9 + lt * 0.3);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot + sweep);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineCap = 'round';
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(12);
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, R, -0.9, 0.9); ctx.stroke();        // คมนอก
      ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.globalAlpha = a * 0.7;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.82, -0.7, 0.7); ctx.stroke(); // คมใน
      ctx.restore();
      break;
    }
    case 'wisp': {
      // วิญญาณถูกเก็บ: หัวเรือง + หางลู่ตามทิศตรงข้ามการเคลื่อน, ถูกดูดเข้าศูนย์กลาง
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98;
      const a = (t < 0.2) ? (t / 0.2) : (1 - (t - 0.2) / 0.8);
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const tx = -p.vx / sp, ty = -p.vy / sp;
      const tail = p.size * 4;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const grad = ctx.createLinearGradient(p.x, p.y, p.x + tx * tail, p.y + ty * tail);
      grad.addColorStop(0, _rgba(p.color, 1));
      grad.addColorStop(1, _rgba(p.color, 0));
      ctx.strokeStyle = grad; ctx.lineWidth = p.size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + tx * tail, p.y + ty * tail); ctx.stroke();
      ctx.fillStyle = _rgba('#ffffff', a);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.7, 0, 6.283); ctx.fill();
      ctx.restore();
      break;
    }
    // ── fire-clone differentiator kinds ──────────────────────────────────
    case 'claw': {
      // รอยเล็บเสือ: เส้นโค้งคม แกนขาว ขอบสี ลากออกเร็วแล้วจาง (honor p.data delay)
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      const grow = lt < 0.4 ? (lt / 0.4) : 1;
      const a = lt < 0.4 ? (lt / 0.4) : (1 - (lt - 0.4) / 0.6);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const w = p.size * grow, bend = (p.seed - 0.5) * 36 - 28; // โค้งเหมือนรอยเล็บ
      const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      grad.addColorStop(0, _rgba(p.color, 0));
      grad.addColorStop(0.5, _rgba('#ffffff', 1));
      grad.addColorStop(1, _rgba(p.color, 0));
      ctx.strokeStyle = grad; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(8);
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, bend, w / 2, 0); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'rwave': {
      // คลื่นเรโซแนนซ์: วงขยาย + ความหนา "สั่น" เป็นจังหวะฮาร์มอนิก + วงในจาง (honor p.data delay)
      if (p.age < p.data) break;
      const lt = (p.age - p.data) / (p.life - p.data);
      const r = p.size * (0.4 + lt * 3.2);
      const a = (1 - lt);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1);
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(10);
      ctx.lineWidth = 2 + Math.abs(Math.sin(lt * Math.PI * 4)) * 2.5; // สั่นฮาร์มอนิก
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = a * 0.5; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.78, 0, 6.283); ctx.stroke();
      break;
    }
    // ── unexpressed-fantasy kinds ────────────────────────────────────────
    case 'swarm': {
      // แมลงบินส่าย: เคลื่อนตาม v + สั่น (buzz) + ปีกสั้น + จาง
      p.x += p.vx * dt; p.y += p.vy * dt;
      const bx = Math.sin(p.age * p.data * 12 + p.seed) * 3;
      const by = Math.cos(p.age * p.data * 9 + p.seed) * 3;
      const a = (t < 0.2) ? (t / 0.2) : (1 - (t - 0.2) / 0.8);
      const px = p.x + bx, py = p.y + by;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.beginPath(); ctx.arc(px, py, p.size, 0, 6.283); ctx.fill();
      ctx.globalAlpha = a * 0.45; ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(px - p.size * 1.7, py); ctx.lineTo(px + p.size * 1.7, py); ctx.stroke();
      break;
    }
    case 'lock': {
      // คอมโบล็อก: วงเล็บ L 4 มุม เริ่มกาง→หุบเข้า "ล็อก"
      const snap = t < 0.4 ? (1 - t / 0.4) : 0;
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const sp = p.size * (0.5 + snap * 0.85), arm = p.size * 0.4;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(8);
      for (let cx = -1; cx <= 1; cx += 2) for (let cy = -1; cy <= 1; cy += 2) {
        const ox = cx * sp, oy = cy * sp;
        ctx.beginPath();
        ctx.moveTo(ox - cx * arm, oy); ctx.lineTo(ox, oy); ctx.lineTo(ox, oy - cy * arm);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'vzero': {
      // ZERO: แกนดำสุญญากาศ + วงขาวสว่าง หดยุบเข้าหาศูนย์ (annihilation)
      const collapse = 1 - Math.min(1, t * 1.1);
      const r = p.size * (0.3 + collapse);
      const a = Math.sin(Math.min(1, t) * Math.PI);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, _rgba('#000000', a));
      g.addColorStop(0.7, _rgba('#0a0a12', a * 0.7));
      g.addColorStop(1, _rgba('#0a0a12', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2.6;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(12);
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.04, 0, 6.283); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'soul': {
      // วิญญาณทอง: orb เรือง + กากบาทอังค์ ลอยตาม v (เข้า/ออก) กระพริบ — Egyptian soul wisp
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = Math.sin(Math.min(1, t) * Math.PI);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const r = p.size * (0.8 + 0.4 * Math.sin(p.age * 8 + p.seed * 6));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
      g.addColorStop(0, _rgba('#fff6d0', 1)); g.addColorStop(0.4, _rgba(p.color, 0.8)); g.addColorStop(1, _rgba(p.color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, 6.283); ctx.fill();
      ctx.strokeStyle = _rgba('#fff6d0', a); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r * 1.4); ctx.moveTo(-r * 0.7, 0); ctx.lineTo(r * 0.7, 0); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'runeseal': {
      // ตราหิน hieroglyph พิพากษา: ลำแสงทองดิ่ง + วงรูนหมุน + ขีดอักขระ 12 จุด
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const r = p.size * (0.5 + t * 0.8);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const pl = ctx.createLinearGradient(0, -p.size * 2, 0, p.size * 0.5);
      pl.addColorStop(0, _rgba(p.color, 0)); pl.addColorStop(0.7, _rgba(p.color, 0.5)); pl.addColorStop(1, _rgba('#fff6d0', 0.9));
      ctx.fillStyle = pl; ctx.fillRect(-p.size * 0.16, -p.size * 2, p.size * 0.32, p.size * 2.5);
      ctx.rotate(p.age * 1.2);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2.4;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(8);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke();
      ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const ang = i / 12 * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * 0.86, Math.sin(ang) * r * 0.86);
        ctx.lineTo(Math.cos(ang) * r * 1.02, Math.sin(ang) * r * 1.02);
        ctx.stroke();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = a * 0.6; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, 6.283); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'glens': {
      // เลนส์โน้มถ่วง: วงสว่างหดเข้าหาศูนย์ (gravity lensing — ต่างจาก ring ที่ขยายออก)
      const r = p.size * (1.1 - Math.min(1, t) * 0.9);
      const a = (t < 0.8) ? 1 : (1 - (t - 0.8) / 0.2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2.2;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(8);
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r), 0, 6.283); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'vfrag': {
      // เศษอวกาศบิด: ลู่เข้าศูนย์ (gravity) + หมุน + สี่เหลี่ยมข้าวหลามตัด
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.rot += p.data * dt;
      const a = Math.sin(Math.min(1, t) * Math.PI);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = _rgba(p.color, 1);
      const s = p.size;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.5, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.5, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'dscan': {
      // ลำสแกนแนวนอนกวาดลง + data ticks (analysis scan line)
      const sweep = Math.min(1, t);
      const yy = p.y - p.size * 0.5 + p.size * sweep;
      const a = Math.sin(Math.min(1, t) * Math.PI);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const w = p.data;
      const grad = ctx.createLinearGradient(p.x - w, yy, p.x + w, yy);
      grad.addColorStop(0, _rgba(p.color, 0)); grad.addColorStop(0.5, _rgba(p.color, 1)); grad.addColorStop(1, _rgba(p.color, 0));
      ctx.strokeStyle = grad; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - w, yy); ctx.lineTo(p.x + w, yy); ctx.stroke();
      ctx.fillStyle = _rgba('#ffffff', a);
      for (let i = -2; i <= 2; i++) ctx.fillRect(p.x + i * w * 0.4 - 1, yy - 3, 2, 6);
      break;
    }
    case 'dcross': {
      // crosshair วิเคราะห์: กรอบเล็งหมุน→สแนปล็อก + กากบาท (target lock — ต่างจาก mbeam reticle)
      const snap = t < 0.5 ? (1 - t / 0.5) : 0;
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const r = p.size * (0.7 + snap * 0.6);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(snap * 0.8);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(6);
      for (let cx = -1; cx <= 1; cx += 2) for (let cy = -1; cy <= 1; cy += 2) {
        ctx.beginPath();
        ctx.moveTo(cx * r - cx * r * 0.4, cy * r); ctx.lineTo(cx * r, cy * r); ctx.lineTo(cx * r, cy * r - cy * r * 0.4);
        ctx.stroke();
      }
      ctx.lineWidth = 1; ctx.globalAlpha = a * 0.7;
      ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      break;
    }
    case 'hexcell': {
      // เซลล์รังผึ้งหกเหลี่ยม: ขยาย+เรือง+เติมจาง (honeycomb cell pop)
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const r = p.size * (0.6 + t * 0.7);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(0.52);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(8);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2, px = Math.cos(ang) * r, py = Math.sin(ang) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = a * 0.4; ctx.fillStyle = _rgba(p.color, 1); ctx.fill();
      ctx.restore();
      break;
    }
    case 'mcore': {
      // แกนขับเคลื่อนหกเหลี่ยม (mech drive core): หมุน + เรือง. charge(data 0)=พอง / fire(data 1)=ยุบ
      const a = Math.sin(Math.min(1, t) * Math.PI);
      const rot = p.age * (p.data ? 6 : 3) + p.seed * 6;
      const r = p.size * (p.data ? (1 - t * 0.4) : (0.7 + t * 0.5));
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(10);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = i / 6 * Math.PI * 2, px = Math.cos(ang) * r, py = Math.sin(ang) * r;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = _rgba('#ffffff', a * 0.9);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, 6.283); ctx.fill();
      ctx.restore();
      break;
    }
    case 'mbeam': {
      // ลำเลเซอร์ปืนใหญ่: ยิงพุ่ง (snap-on) → ค้าง → จาง. แกนขาวกลาง + reticle bracket ล็อกเป้า
      const on = t < 0.15 ? t / 0.15 : (1 - (t - 0.15) / 0.85);
      const a = Math.max(0, on);
      const len = p.size, w = p.data;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      const grad = ctx.createLinearGradient(0, -len, 0, 0);
      grad.addColorStop(0, _rgba(p.color, 0)); grad.addColorStop(0.5, _rgba(p.color, 0.85)); grad.addColorStop(1, _rgba('#ffffff', 1));
      ctx.fillStyle = grad; ctx.fillRect(-w / 2, -len, w, len);
      ctx.fillStyle = _rgba('#ffffff', a); ctx.fillRect(-w * 0.2, -len, w * 0.4, len);
      // reticle ล็อกเป้า (target-lock brackets)
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2; ctx.lineCap = 'round';
      const rs = w * 1.2 + 14;
      for (let cx = -1; cx <= 1; cx += 2) for (let cy = -1; cy <= 1; cy += 2) {
        ctx.beginPath();
        ctx.moveTo(cx * rs - cx * 8, cy * rs); ctx.lineTo(cx * rs, cy * rs); ctx.lineTo(cx * rs, cy * rs - cy * 8);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'geye': {
      // ดวงตา GLOOM: เปลือกตา (almond) เบิกขึ้น → ม่านตา/รูม่านตาหดจ้อง → หรี่ลง. obsession watching.
      const open = Math.sin(Math.min(1, t) * Math.PI);
      const a = open;
      const w = p.size, h = p.size * (0.18 + open * 0.42);
      ctx.save();
      ctx.translate(p.x, p.y);
      // เบ้าตามืด (dark sclera) — source-over ให้เป็นเงาทึบบนฉาก
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = _rgba('#0a0014', 1);
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.quadraticCurveTo(0, -h, w, 0);
      ctx.quadraticCurveTo(0, h, -w, 0);
      ctx.closePath(); ctx.fill();
      // ขอบตาเรืองม่วง (glowing lid rim)
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineWidth = 2;
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(8);
      ctx.stroke(); ctx.shadowBlur = 0;
      // ม่านตา/รูม่านตา (iris + constricting pupil) — จ้องเขม็ง
      const ir = h * 0.82 * (p.data ? 1.05 : 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.beginPath(); ctx.arc(0, 0, ir, 0, 6.283); ctx.fill();
      ctx.fillStyle = _rgba('#000000', 1);
      ctx.beginPath(); ctx.arc(0, 0, ir * (0.62 - open * 0.22), 0, 6.283); ctx.fill();
      // ประกายม่านตา (cold glint)
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = _rgba('#d8b3ff', a);
      ctx.beginPath(); ctx.arc(-ir * 0.3, -ir * 0.3, ir * 0.16, 0, 6.283); ctx.fill();
      ctx.restore();
      break;
    }
    case 'gtendril': {
      // หนวดเงาคว้า: ทะยานขึ้นจากฐาน (rise then recede) โค้งเอน + ปลายเรียว. grasping shadow.
      const grow = Math.sin(Math.min(1, t) * Math.PI);
      const a = grow;
      const hgt = p.data * grow;
      ctx.save();
      ctx.translate(p.x, p.y);
      // ลำหนวดเงาทึบ (source-over dark body)
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = _rgba('#0a0014', 1);
      ctx.lineWidth = p.size; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(p.vx, -hgt * 0.55, p.vx * 1.6, -hgt);
      ctx.stroke();
      // ขอบเรืองม่วง (purple rim glow)
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.6;
      ctx.strokeStyle = _rgba(p.color, 1);
      ctx.lineWidth = Math.max(1, p.size * 0.4);
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(p.vx, -hgt * 0.55, p.vx * 1.6, -hgt);
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.restore();
      break;
    }
    case 'vwing': {
      // ปีกวาลคีรี: ก้านขนนกกางออกจากกลาง (สองข้างสมมาตร) แล้วจาง — silhouette ปีกเทพ
      const spread = Math.min(1, t * 1.6);
      const a = Math.sin(Math.min(1, t) * Math.PI);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = _rgba(p.color, 1); ctx.lineCap = 'round';
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(8);
      const span = p.size * (0.4 + spread * 0.95), rise = p.size * 0.5 * spread;
      for (let side = -1; side <= 1; side += 2) {
        for (let f = 0; f < 4; f++) {
          const fr = f / 3;
          const len = span * (0.5 + fr * 0.55);
          ctx.lineWidth = 3 - fr * 1.4;
          ctx.beginPath();
          ctx.moveTo(side * p.size * 0.06, 0);
          ctx.quadraticCurveTo(side * len * 0.5, -rise * 0.45, side * len, -rise - len * 0.18 * fr);
          ctx.stroke();
        }
      }
      ctx.restore(); ctx.shadowBlur = 0;
      break;
    }
    case 'vspear': {
      // หอกแสง: ทิ่มลงจากเบื้องบน (descend) → กระทบกลาง แล้วจาง. แกน gradient + หัวหอกเพชร
      const desc = Math.min(1, t * 1.5);
      const headY = p.y - p.data * (1 - desc);
      const len = p.size * (0.6 + 0.4 * desc);
      const a = t < 0.7 ? 1 : (1 - (t - 0.7) / 0.3);
      ctx.save();
      ctx.translate(p.x, headY);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const grad = ctx.createLinearGradient(0, -len, 0, 0);
      grad.addColorStop(0, _rgba(p.color, 0)); grad.addColorStop(1, _rgba('#ffffff', 1));
      ctx.strokeStyle = grad; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = _sb(10);
      ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(0, 0); ctx.stroke();
      ctx.fillStyle = _rgba('#ffffff', 1);
      ctx.beginPath();
      ctx.moveTo(0, 11); ctx.lineTo(5, 0); ctx.lineTo(0, -11); ctx.lineTo(-5, 0); ctx.closePath();
      ctx.fill();
      ctx.restore(); ctx.shadowBlur = 0;
      break;
    }
    case 'vfeather': {
      // ขนนกร่วง: ลอยลง + แกว่ง (sway) + หมุน + จาง. รูปขนนก (วงรีบาง + ก้าน)
      p.x += p.vx * dt; p.vy += 40 * dt; p.y += p.vy * dt; p.rot += p.data * dt;
      const sway = Math.sin(p.age * 4 + p.seed * 6) * 0.4;
      const a = (t < 0.2) ? (t / 0.2) : (1 - (t - 0.2) / 0.8);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot + sway);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.4, p.size, 0, 0, 6.283); ctx.fill();
      ctx.globalAlpha = Math.max(0, a * 0.6);
      ctx.strokeStyle = _rgba('#ffffff', 1); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(0, p.size); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'gbar': {
      // ทองคำแท่ง (gold ingot): พุ่งขึ้น → ร่วงตามแรงโน้มถ่วง + หมุน. รูปสี่เหลี่ยมคางหมู
      // + ไฮไลต์ขอบบน → อ่านเป็น "แท่งทอง" ชัด (ไม่ใช่เหรียญ/สะเก็ดกลม).
      p.vy += 760 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.data * dt;
      const a = 1 - t * t;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      const w = p.size, h = p.size * 0.52;
      ctx.fillStyle = _rgba(p.color, 1);
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, h * 0.5); ctx.lineTo(w * 0.5, h * 0.5);
      ctx.lineTo(w * 0.36, -h * 0.5); ctx.lineTo(-w * 0.36, -h * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = Math.max(0, a * 0.7);
      ctx.fillStyle = _rgba('#fff6c0', 1);
      ctx.fillRect(-w * 0.3, -h * 0.5, w * 0.6, h * 0.18);
      ctx.restore();
      break;
    }
    case 'cglitch': {
      // ไวรัสคอร์รัปต์: บล็อกดิจิทัลกระตุก (flicker) + เลื่อนข้าง + ขอบขาว
      p.x += p.vx * dt;
      const flick = (Math.sin(p.age * 60 + p.seed * 30) > 0) ? 1 : 0.3;
      const a = (1 - t) * flick;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = _rgba(p.color, 0.5);
      ctx.fillRect(p.x, p.y, p.size, p.data);
      ctx.globalAlpha = Math.max(0, a * 0.8);
      ctx.strokeStyle = _rgba('#ffffff', 1); ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.size, p.data);
      break;
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ── BOSS SKILL VFX (metadata-driven, cosmetic only) ──────────────────────────
// แมปบอสแต่ละสกิน → ธีม/สี/ชุดเอฟเฟกต์ canvas เฉพาะตัว (ยิงตอน skill activate).
// อยู่ในเลเยอร์ VFX ล้วน ๆ — ไม่อ่าน/เขียน save, balance, cs_* ใด ๆ. game.js แค่ส่ง
// id สกินบอส + พิกัด + ระดับ OD มาให้ ส่วนหน้าตา/สี ตัดสินใจที่นี่.
const BOSS_VFX = {
  default:        { id:'default',        theme:'goldBoxing',   skillEffect:'Golden Overdrive Punch', canvasEffect:'bossImpactBurst+bossShockwave', colorPrimary:'#ffd24a', colorSecondary:'#ff9d2e', affectedTarget:'boss'  },
  toei_boxer:     { id:'toei_boxer',     theme:'redPressure',  skillEffect:'Pressure Flare',         canvasEffect:'bossImpactBurst+bossShockwave', colorPrimary:'#ff3a3a', colorSecondary:'#1a0008', affectedTarget:'boss'  },
  apologize:      { id:'apologize',      theme:'holyMask',     skillEffect:'Holy Apology Ring',      canvasEffect:'bossRuneCircle+bossAuraPulse',  colorPrimary:'#ffe28a', colorSecondary:'#fff3c0', affectedTarget:'boss'  },
  xuang:          { id:'xuang',          theme:'ancientBrute', skillEffect:'Ancient Ground Smash',   canvasEffect:'bossShockwave+bossImpactBurst', colorPrimary:'#ff7a1e', colorSecondary:'#5a2a0a', affectedTarget:'arena' },
  jakkadun:       { id:'jakkadun',       theme:'moonRocker',   skillEffect:'Moonlight Slash',        canvasEffect:'bossSlash+bossEnergyTrail',     colorPrimary:'#8fb4ff', colorSecondary:'#ffd24a', affectedTarget:'boss'  },
  sornsit_spirit: { id:'sornsit_spirit', theme:'blueSpirit',   skillEffect:'Spirit Surge',           canvasEffect:'bossLightningArc+bossAuraPulse',colorPrimary:'#3fa9ff', colorSecondary:'#aef0ff', affectedTarget:'boss'  },
  rukawa:         { id:'rukawa',         theme:'redSlash',     skillEffect:'Assassin Slash',         canvasEffect:'bossSlash+bossImpactBurst',     colorPrimary:'#ff2a3a', colorSecondary:'#7a0010', affectedTarget:'boss'  },
  suang:          { id:'suang',          theme:'animalBoxer',  skillEffect:'Paw Combo Burst',        canvasEffect:'bossImpactBurst',               colorPrimary:'#ffcf4a', colorSecondary:'#fff0b0', affectedTarget:'boss'  },
  morgan:         { id:'morgan',         theme:'blueStreet',   skillEffect:'Street Power Wave',      canvasEffect:'bossAuraPulse+bossShockwave',   colorPrimary:'#3ad0ff', colorSecondary:'#2a6cff', affectedTarget:'boss'  },
  toei:           { id:'toei',           theme:'purpleEnigma', skillEffect:'Void Distortion',        canvasEffect:'bossGlitchPulse',               colorPrimary:'#b46cff', colorSecondary:'#6a18d0', affectedTarget:'boss'  },
};

// thin public wrappers — แต่ละ primitive ตามสเปก (เรียกตรงได้ถ้าต้องการ)
function spawnBossImpactBurst(o)  { spawnCanvasVfx('bossImpactBurst', o);  }
function spawnBossShockwave(o)     { spawnCanvasVfx('bossShockwave', o);    }
function spawnBossEnergyTrail(o)   { spawnCanvasVfx('bossEnergyTrail', o);  }
function spawnBossLightningArc(o)  { spawnCanvasVfx('bossLightningArc', o); }
function spawnBossSlash(o)         { spawnCanvasVfx('bossSlash', o);        }
function spawnBossAuraPulse(o)     { spawnCanvasVfx('bossAuraPulse', o);    }
function spawnBossRuneCircle(o)    { spawnCanvasVfx('bossRuneCircle', o);   }
function spawnBossGlitchPulse(o)   { spawnCanvasVfx('bossGlitchPulse', o);  }

// ── PUBLIC: compose a boss's signature skill VFX at a coord ───────────────────
// skinId = boss skin id (จาก getActiveSkinId() ใน game.js); opts.{x,y,level}.
// level 1–3 (ระดับ OD) → ปรับขนาด/ความเข้มขึ้นเล็กน้อย (บอสภัยสูง = แรงขึ้น แต่ยังเซฟมือถือ).
function spawnBossSkillVfx(skinId, opts) {
  if (!_ensure()) return;            // unsupported / no host → no-op
  if (_intensity <= 0.0) return;     // 'off' mode → ข้ามทั้งหมด
  const meta = BOSS_VFX[skinId] || BOSS_VFX.default;
  opts = opts || {};
  const lv = Math.max(1, Math.min(3, opts.level || 1));
  const scale = 1 + (lv - 1) * 0.18; // OD สูง → ใหญ่ขึ้น (มากสุด ~1.36x)
  const C = meta.colorPrimary, C2 = meta.colorSecondary;
  const base = { x: opts.x, y: opts.y, color: C, color2: C2 };
  switch (meta.theme) {
    case 'goldBoxing':
      spawnBossImpactBurst({ ...base, count: 10, stars: lv >= 2 ? 4 : 2, size: 64 * scale });
      spawnBossShockwave({ ...base, size: 38 * scale, thick: 8 });
      break;
    case 'redPressure':
      spawnBossImpactBurst({ ...base, count: 9, size: 60 * scale });
      spawnBossShockwave({ ...base, color: C2, size: 34 * scale, thick: 9 });
      break;
    case 'holyMask':
      spawnBossRuneCircle({ ...base, runes: 8, size: 66 * scale });
      spawnBossAuraPulse({ ...base, size: 78 * scale });
      break;
    case 'ancientBrute':
      spawnBossShockwave({ ...base, size: 40 * scale, thick: 10, cracks: lv >= 2 ? 5 : 3, groundOffset: 30 });
      spawnBossImpactBurst({ ...base, count: 7, size: 50 * scale });
      break;
    case 'moonRocker':
      spawnBossSlash({ ...base, count: 2, len: 160 * scale, rot: -38 });
      spawnBossEnergyTrail({ ...base, count: lv >= 2 ? 5 : 4, angle: -0.4 });
      break;
    case 'blueSpirit':
      spawnBossLightningArc({ ...base, count: lv >= 2 ? 4 : 3, size: 56 * scale });
      spawnBossAuraPulse({ ...base, size: 74 * scale });
      break;
    case 'redSlash':
      spawnBossSlash({ ...base, count: 2, len: 150 * scale, spark: 6 });
      spawnBossImpactBurst({ ...base, count: 6, size: 44 * scale });
      break;
    case 'animalBoxer':
      spawnBossImpactBurst({ ...base, count: 8, stars: lv >= 2 ? 5 : 3, size: 56 * scale });
      break;
    case 'blueStreet':
      spawnBossAuraPulse({ ...base, size: 82 * scale });
      spawnBossShockwave({ ...base, color: C, size: 34 * scale, thick: 7 });
      break;
    case 'purpleEnigma':
      spawnBossGlitchPulse({ ...base, glitch: lv >= 2 ? 4 : 3, size: 70 * scale });
      break;
    default:
      spawnBossImpactBurst({ ...base, count: 9, size: 58 * scale });
  }
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────
const CanvasVFX = {
  spawnCanvasVfx,
  spawnCardCanvasVfx,
  clearCanvasVfx,
  resizeCanvasVfx,
  supported,
  setVFXLevel,                        // ← รับ 'on'|'low'|'off' จาก applyFlashEffectSetting
  reducedMotion: () => _reduced,
  vfxIntensity:  () => _intensity,    // debug / audit
  // boss skill VFX (cosmetic) — dispatcher + primitives ตามสเปก
  spawnBossSkillVfx,
  spawnBossImpactBurst,
  spawnBossShockwave,
  spawnBossEnergyTrail,
  spawnBossLightningArc,
  spawnBossSlash,
  spawnBossAuraPulse,
  spawnBossRuneCircle,
  spawnBossGlitchPulse,
  BOSS_VFX,                           // metadata map (debug / audit)
  // debug-only introspection (ไม่ใช่ส่วนหนึ่งของ logic เกม)
  _count: () => _parts.length,
  _running: () => !!_raf,
  _cap: () => _effectiveCap(),        // current dynamic particle budget
  _heavy: () => _burstTimes.length >= HEAVY_BURST_COUNT,
};

if (typeof window !== 'undefined') window.CanvasVFX = CanvasVFX;

export {
  CanvasVFX, spawnCanvasVfx, spawnCardCanvasVfx, clearCanvasVfx, resizeCanvasVfx, supported,
  spawnBossSkillVfx, spawnBossImpactBurst, spawnBossShockwave, spawnBossEnergyTrail,
  spawnBossLightningArc, spawnBossSlash, spawnBossAuraPulse, spawnBossRuneCircle, spawnBossGlitchPulse,
};
