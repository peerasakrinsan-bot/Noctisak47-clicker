// ════════════════════════════════════════════════════════════════════════════
// TEMPORARY PERFORMANCE PROFILING OVERLAY  —  on-device frame diagnostics
// ----------------------------------------------------------------------------
// A self-contained, removable HUD for measuring real performance on actual
// devices (the only place that matters for a mobile PWA). It reads frame timing
// from its own lightweight rAF loop and pulls cosmetic-layer counters from the
// already-exposed window.CanvasVFX debug introspection (_count/_draws/_cap/…).
//
// It NEVER reads or writes game state, `save`, balance, or `cs_*` flags. It only
// observes. When hidden it cancels its own rAF so it costs nothing for players.
//
// Shows:
//   • FPS (instant) + avg (rolling ~1s) + worst frame (ms) over the window
//   • frame time (ms, smoothed)
//   • live particle count + particles drawn last frame + dynamic budget cap
//   • heavy-combat flag + VFX intensity tier + DPR
//   • DOM node count (throttled — getElementsByTagName is O(n))
//   • JS heap estimate (Chrome performance.memory, when available)
//
// GATED OFF by default — never shows for normal players. It appears only when:
//   • the URL contains  ?perf=1   (or #perf), or
//   • localStorage 'noctisPerf' === '1'  (set once: NoctisPerf.enable()), or
//   • running on localhost / 127.0.0.1 / file:
//
// REMOVAL (single-feature, fully reversible): delete this file + its import line
// in src/main.js. Nothing else references it. The window.CanvasVFX._draws/_fps/
// _dpr getters added alongside it are harmless debug-only no-cost getters.
// ════════════════════════════════════════════════════════════════════════════

function _gateOpen() {
  try {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:') return true;
    if (/[?&#]perf=1\b/.test(location.href)) return true;
    if (/#perf\b/.test(location.href)) return true;
    if (localStorage.getItem('noctisPerf') === '1') return true;
  } catch (e) {}
  return false;
}

// ── rolling frame-time stats ─────────────────────────────────────────────────
const WINDOW_MS = 1000;        // rolling window for avg / worst
let _frames = [];              // [{ t, dt }] within the window
let _smoothDt = 16.7;          // EMA frame time (ms)
let _raf = 0;
let _last = 0;
let _el = null;
let _bodyEl = null;
let _domCount = 0;
let _domTick = 0;              // throttle counter for the O(n) DOM walk

function _cvfx() {
  return (typeof window !== 'undefined' && window.CanvasVFX) || null;
}

function _num(fn, fallback) {
  try { const v = fn(); return (typeof v === 'number' && isFinite(v)) ? v : fallback; }
  catch (e) { return fallback; }
}

function _mem() {
  try {
    const m = performance && performance.memory;
    if (m && m.usedJSHeapSize) return (m.usedJSHeapSize / 1048576).toFixed(1) + ' MB';
  } catch (e) {}
  return 'n/a';
}

function _ensureEl() {
  if (_el) return _el;
  if (typeof document === 'undefined' || !document.body) return null;
  _el = document.createElement('div');
  _el.id = '__noctisPerfOverlay';
  _el.style.cssText =
    'position:fixed;right:4px;top:4px;z-index:2147483646;pointer-events:none;' +
    'background:rgba(0,0,0,.78);color:#9fef00;font:10px/1.35 ui-monospace,monospace;' +
    'padding:5px 7px;border:1px solid rgba(159,239,0,.5);border-radius:5px;' +
    'white-space:pre;min-width:148px;text-shadow:0 0 2px #000';
  document.body.appendChild(_el);
  return _el;
}

function _tick(ts) {
  _raf = 0;
  if (!_el) return;

  if (_last) {
    const dt = ts - _last;
    _smoothDt = _smoothDt * 0.9 + dt * 0.1;
    _frames.push({ t: ts, dt });
  }
  _last = ts;

  // trim window
  const cut = ts - WINDOW_MS;
  while (_frames.length && _frames[0].t < cut) _frames.shift();

  // avg / worst across the window
  let worst = 0, sum = 0;
  for (let i = 0; i < _frames.length; i++) {
    const d = _frames[i].dt;
    sum += d;
    if (d > worst) worst = d;
  }
  const avgDt = _frames.length ? sum / _frames.length : _smoothDt;
  const avgFps = avgDt > 0 ? Math.round(1000 / avgDt) : 0;
  const instFps = _smoothDt > 0 ? Math.round(1000 / _smoothDt) : 0;

  // DOM node count is an O(n) tree walk — sample ~3×/sec, not every frame
  if ((_domTick++ % 20) === 0) {
    try { _domCount = document.getElementsByTagName('*').length; } catch (e) {}
  }

  const cv = _cvfx();
  const parts = cv ? _num(cv._count, 0) : 0;
  const draws = cv ? _num(cv._draws, 0) : 0;
  const cap   = cv ? _num(cv._cap, 0) : 0;
  const heavy = cv && cv._heavy ? (cv._heavy() ? 'HEAVY' : 'norm') : '—';
  const inten = cv ? _num(cv.vfxIntensity, 1) : 1;
  const dpr   = cv ? _num(cv._dpr, (window.devicePixelRatio || 1)) : (window.devicePixelRatio || 1);

  // colour the FPS line by health (60→green, 45→amber, <30→red)
  const fpsColor = avgFps >= 55 ? '#9fef00' : (avgFps >= 40 ? '#ffcc33' : '#ff5555');

  _el.innerHTML =
    '<span style="color:' + fpsColor + '">FPS ' + instFps + ' / avg ' + avgFps + '</span>\n' +
    'frame  ' + _smoothDt.toFixed(1) + ' ms\n' +
    'worst  ' + worst.toFixed(1) + ' ms\n' +
    'parts  ' + parts + ' / cap ' + cap + '\n' +
    'draws  ' + draws + '/f  [' + heavy + ']\n' +
    'vfx    ' + inten.toFixed(1) + '  dpr ' + dpr.toFixed(1) + '\n' +
    'DOM    ' + _domCount + ' nodes\n' +
    'heap   ' + _mem();

  _raf = requestAnimationFrame(_tick);
}

function show() {
  if (!_ensureEl()) {
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', show, { once: true });
    }
    return;
  }
  _el.style.display = '';
  if (!_raf) { _last = 0; _raf = requestAnimationFrame(_tick); }
}

function hide() {
  if (_raf) { cancelAnimationFrame(_raf); _raf = 0; }
  if (_el) _el.remove();
  _el = null;
  _frames = [];
  _last = 0;
}

export const NoctisPerf = {
  show,
  hide,
  enable() { try { localStorage.setItem('noctisPerf', '1'); } catch (e) {} show(); },
  disable() { try { localStorage.removeItem('noctisPerf'); } catch (e) {} hide(); },
  toggle() { _raf ? hide() : show(); },
};

try { if (typeof window !== 'undefined') window.NoctisPerf = NoctisPerf; } catch (e) {}

// pause the overlay rAF while the tab is hidden (battery; never fight the game loop)
try {
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (_raf) { cancelAnimationFrame(_raf); _raf = 0; } }
      else if (_el) { _last = 0; _raf = requestAnimationFrame(_tick); }
    });
  }
} catch (e) {}

if (_gateOpen()) {
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show, { once: true });
  } else {
    show();
  }
}
