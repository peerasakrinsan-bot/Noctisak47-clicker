// ── NOCTISAK47: OVERDRIVE RAMPAGE — module entry ──────────────────────────
//
// Phase 1 ของการย้ายมาใช้ Vite: ไฟล์นี้คือ "จุดเข้า" (entry) ของ ES module
// graph สำหรับเกม. ตอนนี้ตัวเกมทั้งหมดยังทำงานเป็น classic inline <script>
// ใน index.html เหมือนเดิม (global scope + inline onclick handlers) เพื่อ
// คงพฤติกรรมเกมไว้ 100% ระหว่างการย้าย.
//
// Phase ถัดไป (ทำทีละส่วนพร้อมทดสอบบนเบราว์เซอร์): ค่อย ๆ ย้ายโค้ดเกมเข้ามา
// เป็น native modules ที่ import จากไฟล์นี้ — constants, state/save, gameLoop,
// ui, events, audio, effects, cards, breakSystem, overdrive, weakPoints,
// shop, skins. ระหว่างย้ายให้ผูกฟังก์ชันที่ inline handler เรียกใช้ไว้บน
// window (temporary globals) จนกว่าจะแปลง handler เป็น addEventListener ครบ.
//
// CSS ถูกย้ายไป src/styles.css แล้ว และโหลดผ่าน <link> ใน index.html
// (render-blocking, ไม่เกิด FOUC) — ไม่ import ที่นี่เพื่อเลี่ยงการโหลดซ้ำ.
