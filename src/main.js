// ── NOCTISAK47: OVERDRIVE RAMPAGE — module entry ──────────────────────────
//
// จุดเข้า (entry) ของ ES module graph สำหรับเกม โหลดผ่าน
// <script type="module" src="/src/main.js"> ใน index.html.
//
// Stage 2A: ยกโค้ดเกมทั้งหมด (เดิมเป็น classic inline <script>) มาเป็น ES module
// เดียวที่ src/game.js แบบ verbatim แล้ว import ที่นี่. inline onclick= ใน
// index.html ยังทำงานได้ผ่าน window bridge ท้าย game.js.
//
// Phase 2B (ทำทีละส่วนพร้อมทดสอบบนเบราว์เซอร์): ค่อย ๆ แตก game.js เป็นโมดูลตาม
// หน้าที่ (constants, state/save, audio, effects, cards, breakSystem, overdrive,
// weakPoints, shop, skins, gameLoop, ui, events) ด้วย import/export — เป็นการ
// refactor ภายใน module graph ไม่กระทบ inline handler อีกต่อไป.
//
// CSS อยู่ที่ src/styles.css โหลดผ่าน <link> ใน index.html (render-blocking,
// ไม่เกิด FOUC) — ไม่ import ที่นี่เพื่อเลี่ยงการโหลดซ้ำ.
import './game.js';

// ── ELITE/MYTHIC CARD VFX LAYER (normal mode, cosmetic only) ────────────────
// โหลดหลัง game.js เพื่อให้ window.CardVFX พร้อมก่อนที่ hook ใน game.js จะเรียก.
// เป็น layer ภาพล้วน ไม่แตะ logic การ์ด/บาลานซ์.
import './cardVfx.js';

// ── BOSS LOOP HERO MODE (โหมดแยกอิสระ) ──────────────────────────────────────
// โหลดหลัง game.js เพื่อให้ window bridge ของเกมหลัก (startGame / showMainMenu /
// stopBGM) พร้อมใช้งานก่อน. โหมดนี้ผูกเข้ากับ flow ผ่านปุ่ม PLAY → Mode Select.
import './bossLoopHero.js';

// ── INTERACTION HARDENING ──────────────────────────────────────────────────
// Prevent drag-ghost images on game assets (desktop + Android).
document.addEventListener('dragstart', (e) => {
  if (e.target.closest('img, canvas, svg, #gameRoot')) {
    e.preventDefault();
  }
});

// Prevent long-press context menu / save-image dialog on game visuals.
// Dev-tools right-click on non-game elements (e.g. the page chrome) is unaffected.
document.addEventListener('contextmenu', (e) => {
  if (e.target.closest(
    'img, canvas, #weakPoint, #fighter, #tapZone, ' +
    '.cs-card, .cc-card, .break-target, ' +
    '#boxer, #gun, #cardDrawArea, #bossSkinModal, #cardModal'
  )) {
    e.preventDefault();
  }
});
