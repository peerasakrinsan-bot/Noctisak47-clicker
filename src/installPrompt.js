// ── Soft PWA install prompt for NOCTISAK47 ────────────────────────────────
// Isolated from gameplay: listens to menu/result lifecycle events and shows a
// dismissible custom prompt only when the browser/PWA context allows it.
const KEYS = {
  seenMain: 'installPromptSeenMain',
  seenFirstRun: 'installPromptSeenFirstRun',
  lastDismissedAt: 'installPromptLastDismissedAt',
  installed: 'installPromptInstalled',
};

const COOLDOWN_ANDROID_MS = 7 * 24 * 60 * 60 * 1000;
const COOLDOWN_IOS_MS = 14 * 24 * 60 * 60 * 1000;

let deferredPrompt = null;
let promptShownThisSession = false;
let promptOpen = false;
let dom = null;

function read(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function write(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) {}
}

function now() { return Date.now(); }

function hasManifest() {
  return !!document.querySelector('link[rel="manifest"][href]');
}

function hasServiceWorkerSupport() {
  return 'serviceWorker' in navigator;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
    ((navigator.platform === 'MacIntel') && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  const standaloneDisplay = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const fullscreenDisplay = window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches;
  const iosStandalone = typeof navigator.standalone === 'boolean' && navigator.standalone;
  return !!(standaloneDisplay || fullscreenDisplay || iosStandalone);
}

function isInstalled() {
  return read(KEYS.installed) === 'true' || isStandalone();
}

function cooldownAllows(platform) {
  const last = Number(read(KEYS.lastDismissedAt) || 0);
  if (!last) return true;
  const cooldown = platform === 'ios' ? COOLDOWN_IOS_MS : COOLDOWN_ANDROID_MS;
  return (now() - last) >= cooldown;
}

function canShowForPlatform(platform) {
  if (!hasManifest() || !hasServiceWorkerSupport() || isInstalled()) return false;
  if (promptShownThisSession || promptOpen) return false;
  if (platform === 'ios') return isIos();
  return !!deferredPrompt;
}

function markDismissed() {
  write(KEYS.lastDismissedAt, now());
}

function markInstalled() {
  write(KEYS.installed, 'true');
  hidePrompt(false);
}

function ensureDom() {
  if (dom) return dom;
  const overlay = document.createElement('div');
  overlay.id = 'installPromptOverlay';
  overlay.className = 'install-prompt-overlay';
  overlay.setAttribute('hidden', '');
  overlay.innerHTML = `
    <section class="install-prompt-card" role="dialog" aria-modal="true" aria-labelledby="installPromptTitle" aria-describedby="installPromptBody">
      <button type="button" class="install-prompt-close" aria-label="Close install prompt">×</button>
      <div class="install-prompt-kicker">PWA READY</div>
      <h2 id="installPromptTitle">Install NOCTISAK47?</h2>
      <p id="installPromptBody">เล่นง่ายขึ้น เปิดจากหน้าโฮมได้เลย</p>
      <div class="install-prompt-actions">
        <button type="button" class="install-prompt-primary">Install</button>
        <button type="button" class="install-prompt-secondary">Later</button>
      </div>
    </section>`;
  document.body.appendChild(overlay);

  dom = {
    overlay,
    card: overlay.querySelector('.install-prompt-card'),
    title: overlay.querySelector('#installPromptTitle'),
    body: overlay.querySelector('#installPromptBody'),
    primary: overlay.querySelector('.install-prompt-primary'),
    secondary: overlay.querySelector('.install-prompt-secondary'),
    close: overlay.querySelector('.install-prompt-close'),
  };

  dom.primary.addEventListener('click', onInstallClick);
  dom.secondary.addEventListener('click', () => hidePrompt(true));
  dom.close.addEventListener('click', () => hidePrompt(true));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) hidePrompt(true); });
  document.addEventListener('keydown', (e) => { if (promptOpen && e.key === 'Escape') hidePrompt(true); });
  return dom;
}

async function onInstallClick() {
  if (dom) dom.primary.disabled = true;
  try {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice && choice.outcome === 'accepted') {
        markInstalled();
        return;
      }
    }
    markDismissed();
  } catch (e) {
    markDismissed();
  } finally {
    if (!isInstalled()) hidePrompt(false);
    if (dom) dom.primary.disabled = false;
  }
}

function showPrompt({ platform, placement, trigger }) {
  const ui = ensureDom();
  promptShownThisSession = true;
  promptOpen = true;
  ui.overlay.classList.toggle('install-prompt-result', placement === 'result');
  ui.overlay.classList.toggle('install-prompt-ios', platform === 'ios');
  ui.title.textContent = 'Install NOCTISAK47?';
  ui.body.textContent = platform === 'ios'
    ? 'กด Share แล้วเลือก Add to Home Screen'
    : 'เล่นง่ายขึ้น เปิดจากหน้าโฮมได้เลย';
  ui.primary.textContent = platform === 'ios' ? 'Got it' : 'Install';
  ui.secondary.textContent = 'Later';
  ui.primary.disabled = false;
  ui.overlay.dataset.trigger = trigger || '';
  ui.overlay.removeAttribute('hidden');
  requestAnimationFrame(() => ui.overlay.classList.add('show'));
}

function hidePrompt(setCooldown) {
  if (!dom || !promptOpen) return;
  promptOpen = false;
  if (setCooldown) markDismissed();
  dom.overlay.classList.remove('show');
  window.setTimeout(() => {
    if (!promptOpen && dom) dom.overlay.setAttribute('hidden', '');
  }, 180);
}

function maybeShow(trigger) {
  const platform = isIos() ? 'ios' : 'browser';
  if (!canShowForPlatform(platform)) return;

  const isMain = trigger === 'main-menu';
  const isFirstRun = trigger === 'first-run-complete';
  const firstTimeMain = isMain && read(KEYS.seenMain) !== 'true';
  const firstRunPrompt = isFirstRun && read(KEYS.seenFirstRun) !== 'true' && cooldownAllows(platform);
  const rarePrompt = !firstTimeMain && !firstRunPrompt && cooldownAllows(platform);

  if (!firstTimeMain && !firstRunPrompt && !rarePrompt) return;
  if (firstTimeMain) write(KEYS.seenMain, 'true');
  if (firstRunPrompt) write(KEYS.seenFirstRun, 'true');
  showPrompt({ platform, placement: isFirstRun ? 'result' : 'menu', trigger });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  const mainMenu = document.getElementById('mainMenu');
  if (mainMenu && getComputedStyle(mainMenu).display !== 'none') {
    window.setTimeout(() => maybeShow('main-menu'), 250);
  }
});

window.addEventListener('appinstalled', markInstalled);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isStandalone()) markInstalled();
});

window.addEventListener('noctis:main-menu-shown', () => {
  window.setTimeout(() => maybeShow('main-menu'), 450);
});

window.addEventListener('noctis:first-run-complete', () => {
  window.setTimeout(() => maybeShow('first-run-complete'), 650);
});

window.NoctisInstallPrompt = {
  maybeShow,
  isStandalone,
  keys: KEYS,
};
