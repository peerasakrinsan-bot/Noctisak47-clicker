// ── postbuild-sw.js ───────────────────────────────────────────────────────
// รันหลัง `vite build`. Vite ดึง CSS/JS (เดิม inline ใน index.html) ออกมาเป็น
// ไฟล์ hashed ใต้ dist/assets/ ซึ่ง public/sw.js (precache list) ไม่รู้จัก —
// ทำให้ PWA เปิดแบบ offline แล้วหน้าเพี้ยน/JS ไม่รัน (ต่างจากของเดิมที่ CSS/JS
// อยู่ใน index.html ที่ถูก precache อยู่แล้ว).
//
// สคริปต์นี้ฉีดชื่อไฟล์ bundle ที่ Vite สร้างเข้าไปใน PRECACHE_ASSETS ของ
// dist/sw.js และต่อท้าย CACHE_NAME ด้วย build tag เพื่อให้เบราว์เซอร์ตรวจเจอ SW
// ใหม่และล้าง cache เก่า — คง offline-first behavior เดิมไว้ครบ.
// source public/sw.js ถูกปล่อยให้เป็นเวอร์ชัน generic ไม่ถูกแก้.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const swPath = join(dist, 'sw.js');
const assetsDir = join(dist, 'assets');

if (!existsSync(swPath)) {
  console.error('[postbuild-sw] dist/sw.js not found — skip');
  process.exit(1);
}

const bundles = existsSync(assetsDir)
  ? readdirSync(assetsDir)
      .filter((f) => /\.(?:js|css)$/i.test(f))
      .sort()
      .map((f) => './assets/' + f)
  : [];

let sw = readFileSync(swPath, 'utf8');

// 1) ฉีด bundle เข้า PRECACHE_ASSETS array (หลังวงเล็บเปิด)
const marker = 'const PRECACHE_ASSETS = [';
const idx = sw.indexOf(marker);
if (idx === -1) {
  console.error('[postbuild-sw] PRECACHE_ASSETS not found in dist/sw.js');
  process.exit(1);
}
const insertAt = idx + marker.length;
const injection =
  '\n  // ── injected by postbuild-sw.js: Vite-hashed bundles ──\n' +
  bundles.map((b) => `  ${JSON.stringify(b)},`).join('\n') +
  (bundles.length ? '\n' : '');
sw = sw.slice(0, insertAt) + injection + sw.slice(insertAt);

// 2) ต่อท้าย CACHE_NAME ด้วย build tag จาก hash ของ bundle เพื่อบังคับ SW update
const buildTag =
  bundles
    .map((b) => (b.match(/-([A-Za-z0-9_]+)\.(?:js|css)$/) || [])[1])
    .filter(Boolean)
    .join('') || Date.now().toString(36);
sw = sw.replace(
  /(const CACHE_NAME\s*=\s*'noctisak47-'\s*\+\s*APP_VERSION)\s*;/,
  `$1 + '-${buildTag}';`,
);

writeFileSync(swPath, sw);
console.log(`[postbuild-sw] precached ${bundles.length} bundle(s); cache tag "${buildTag}"`);
