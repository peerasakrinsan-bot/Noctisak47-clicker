// ════════════════════════════════════════════════════════════════════════════
// TEMPORARY PWA DEBUG OVERLAY  —  reveal-regression diagnostics
// ----------------------------------------------------------------------------
// Shows, on-screen (no console needed), exactly what code the INSTALLED PWA is
// running: app version, JS/CSS bundle hash, service-worker version + state,
// build timestamp, and the reveal-build marker. It also does a live no-store
// fetch of the deployed index.html / sw.js to compare RUNNING vs DEPLOYED and
// name which layer (SW cache vs Pages deployment) is stale.
//
// GATED OFF by default — it never shows for normal players. It appears only when:
//   • the URL contains  ?diag=1   (or #diag), or
//   • localStorage 'noctisDiag' === '1'  (set once: NoctisDiag.enable()), or
//   • running on localhost / 127.0.0.1 / file:
// Self-contained: reads nothing from gameplay/save, writes no game state.
// REMOVE this file + its import in main.js + the __BUILD_TIME__ define in
// vite.config.js + the window.NOCTIS_REVEAL_BUILD marker in game.js once the
// cache/deploy issue is confirmed resolved.
// ════════════════════════════════════════════════════════════════════════════

const BUILD_TIME = (typeof __BUILD_TIME__ !== 'undefined') ? __BUILD_TIME__ : '(unknown)';

function _gateOpen() {
  try {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:') return true;
    if (/[?&#]diag=1\b/.test(location.href)) return true;
    if (localStorage.getItem('noctisDiag') === '1') return true;
  } catch (e) {}
  return false;
}

// numeric per-segment version compare (lexicographic breaks: ".9" > ".13")
function _cmpVer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function _runningBundles() {
  const js = [...document.querySelectorAll('script[type=module][src]')]
    .map(s => s.getAttribute('src'))
    .map(s => (s.match(/index-[A-Za-z0-9_-]+\.js/) || [])[0])
    .filter(Boolean)[0] || '(inline / unhashed — pre-Vite build)';
  const css = [...document.querySelectorAll('link[rel=stylesheet][href]')]
    .map(l => (l.getAttribute('href').match(/index-[A-Za-z0-9_-]+\.css/) || [])[0])
    .filter(Boolean)[0] || '(unhashed)';
  return { js, css };
}

async function _swStatus() {
  if (!('serviceWorker' in navigator)) return { supported: false, lines: ['unsupported'] };
  const lines = [];
  const ctrl = navigator.serviceWorker.controller;
  lines.push('controller: ' + (ctrl ? ctrl.scriptURL.split('/').pop() : '(none — not SW-controlled)'));
  let waiting = false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    lines.push('registrations: ' + regs.length);
    regs.forEach((r, i) => {
      const tag = w => w ? (w.scriptURL.split('/').pop() + ' [' + w.state + ']') : '—';
      if (r.waiting) waiting = true;
      lines.push('  #' + i + ' active=' + tag(r.active) + ' waiting=' + tag(r.waiting) + ' installing=' + tag(r.installing));
    });
  } catch (e) { lines.push('regs error: ' + e.message); }
  return { supported: true, lines, waiting };
}

async function _cacheKeys() {
  if (!('caches' in window)) return [];
  try { return await caches.keys(); } catch (e) { return ['(error: ' + e.message + ')']; }
}

// Live network probe: what does the SERVER currently serve? Names the stale layer.
async function _deployed() {
  const out = { reachable: false, htmlVer: '?', swVer: '?', js: '?' };
  try {
    const r = await fetch('./index.html?cb=' + Date.now(), { cache: 'no-store' });
    if (r.ok) {
      out.reachable = true;
      const t = await r.text();
      out.htmlVer = (t.match(/NOCTISAK47_APP_VERSION = '([^']+)'/) || [])[1] || '?';
      out.js = (t.match(/index-[A-Za-z0-9_-]+\.js/) || ['(unhashed)'])[0];
    } else { out.httpStatus = r.status; }
  } catch (e) { out.fetchError = e.message; }
  try {
    const r2 = await fetch('./sw.js?cb=' + Date.now(), { cache: 'no-store' });
    if (r2.ok) out.swVer = (await r2.text()).match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1] || '?';
  } catch (e) {}
  return out;
}

async function _render() {
  const running = window.NOCTISAK47_APP_VERSION || '(undefined)';
  const cacheName = window.NOCTISAK47_APP_CACHE_NAME || '(undefined)';
  const revealBuild = window.NOCTIS_REVEAL_BUILD || '(ABSENT → pre-2026-06-25 reveal: no state machine)';
  const { js, css } = _runningBundles();
  const sw = await _swStatus();
  const keys = await _cacheKeys();
  const dep = await _deployed();

  // verdict
  let stale = 'NO', why = 'running version matches deployed';
  if (!dep.reachable) {
    stale = 'CANNOT REACH SERVER'; why = 'Pages deployment ' + (dep.httpStatus ? ('HTTP ' + dep.httpStatus) : (dep.fetchError || 'unreachable')) + ' — running cached copy';
  } else if (dep.htmlVer !== '?' && _cmpVer(running, dep.htmlVer) < 0) {
    stale = 'YES'; why = 'deployed ' + dep.htmlVer + ' > running ' + running + (sw.waiting ? ' — SW update WAITING (not activated)' : ' — SW serving old cache');
  } else if (js !== dep.js && dep.js !== '(unhashed)') {
    stale = 'YES'; why = 'running bundle ' + js + ' ≠ deployed ' + dep.js;
  } else if (sw.waiting) {
    stale = 'UPDATE PENDING'; why = 'newer SW downloaded, waiting to activate (tap UPDATE)';
  }

  const L = [
    'Version      : ' + running,
    'Bundle       : ' + js,
    'CSS          : ' + css,
    'SW cache     : ' + cacheName,
    'Reveal Build : ' + revealBuild,
    'Built        : ' + BUILD_TIME,
    '── service worker ──',
    ...sw.lines,
    'caches       : ' + JSON.stringify(keys),
    '── deployed (live no-store fetch) ──',
    'server html  : ' + (dep.reachable ? (dep.htmlVer + '  js=' + dep.js) : ('UNREACHABLE ' + (dep.httpStatus ? 'HTTP ' + dep.httpStatus : dep.fetchError || ''))),
    'server sw    : ' + dep.swVer,
    '──────────────────────',
    'STALE PWA?   : ' + stale,
    '  ' + why,
  ];

  let p = document.getElementById('__noctisDebugOverlay');
  if (!p) {
    p = document.createElement('div');
    p.id = '__noctisDebugOverlay';
    p.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:2147483647;max-width:96vw;' +
      'background:rgba(0,0,0,.9);color:#7CFC00;font:11px/1.4 ui-monospace,monospace;' +
      'padding:8px 10px;border:1px solid #7CFC00;border-radius:6px;white-space:pre;' +
      'overflow:auto;max-height:70vh;box-shadow:0 0 0 9999px rgba(0,0,0,0)';
    document.body.appendChild(p);
  }
  const badge = (stale === 'NO') ? '#7CFC00' : (stale === 'UPDATE PENDING' ? '#ffcc33' : '#ff5555');
  p.style.borderColor = badge; p.style.color = badge;
  p.innerHTML = '';
  const pre = document.createElement('div'); pre.textContent = L.join('\n'); p.appendChild(pre);
  const row = document.createElement('div');
  row.style.cssText = 'margin-top:6px;display:flex;gap:8px';
  const mk = (label, fn) => { const b = document.createElement('button');
    b.textContent = label; b.style.cssText = 'flex:1;padding:5px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;font:11px monospace';
    b.onclick = fn; return b; };
  row.appendChild(mk('UPDATE+RELOAD', async () => {
    try { const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => { r.update(); if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' }); })); } catch (e) {}
    location.reload(true);
  }));
  row.appendChild(mk('NUKE CACHE', async () => {
    try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k)));
      const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); } catch (e) {}
    location.reload(true);
  }));
  row.appendChild(mk('×', () => p.remove()));
  p.appendChild(row);
}

export function show() { _render(); }
export const NoctisDiag = {
  show: _render,
  enable() { try { localStorage.setItem('noctisDiag', '1'); } catch (e) {} _render(); },
  disable() { try { localStorage.removeItem('noctisDiag'); } catch (e) {} const p = document.getElementById('__noctisDebugOverlay'); if (p) p.remove(); },
};
try { window.NoctisDiag = NoctisDiag; } catch (e) {}

if (_gateOpen()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _render);
  else _render();
}
