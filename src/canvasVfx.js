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
const MAX_PARTICLES = 340;   // global hard cap — drop oldest when exceeded
const MAX_DPR       = 2.5;   // cap devicePixelRatio (เลี่ยง buffer ใหญ่เกินบนจอ 3x+)
const MAX_DT        = 0.05;  // clamp dt (กันกระโดดหลังสลับแท็บ/เฟรมหล่น)

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
  if (_parts.length >= MAX_PARTICLES) { _recycle(_parts.shift()); } // drop oldest
  _parts.push(p);
}

// base particle factory — ตั้งค่า field ร่วมไว้ ส่วน builder เติมที่เหลือ
function _mk(kind, x, y, life, color) {
  const p = _alloc();
  p.kind = kind; p.x = x; p.y = y; p.age = 0; p.life = life; p.color = color;
  p.vx = 0; p.vy = 0; p.size = 6; p.rot = 0; p.seed = Math.random();
  p.pts = null; p.data = 0;
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
    const opts = { color: s[1] };
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
    if (p.age >= p.life) { _recycle(p); continue; }
    _draw(p, dt);
    _parts[n++] = p;
  }
  _parts.length = n;
  if (n > 0) _raf = requestAnimationFrame(_tick);   // ยังมีของ → วาดต่อ
  else _last = 0;                                     // ว่าง → หยุด (ประหยัดแบต)
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
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = 8;
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
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = 10;
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
      ctx.shadowColor = _rgba(p.color, 1); ctx.shadowBlur = 6;
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
};

if (typeof window !== 'undefined') window.CanvasVFX = CanvasVFX;

export {
  CanvasVFX, spawnCanvasVfx, spawnCardCanvasVfx, clearCanvasVfx, resizeCanvasVfx, supported,
  spawnBossSkillVfx, spawnBossImpactBurst, spawnBossShockwave, spawnBossEnergyTrail,
  spawnBossLightningArc, spawnBossSlash, spawnBossAuraPulse, spawnBossRuneCircle, spawnBossGlitchPulse,
};
