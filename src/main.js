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
