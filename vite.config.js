import { defineConfig } from 'vite';

// NOCTISAK47 ถูก deploy บน GitHub Pages ใต้ subpath
// (https://peerasakrinsan-bot.github.io/Noctisak47-clicker/) และตัว PWA
// (manifest scope "./", sw.js, asset paths) อิงพาธแบบ relative.
// ใช้ base: './' เพื่อให้ build ออกมาเป็นพาธ relative ที่ทำงานได้ทั้งบน
// root และ subpath โดยไม่ต้องแก้ logic เกม.
export default defineConfig({
  base: './',
  // TEMP (reveal regression diagnostics): inject build timestamp so the dev-only
  // debug overlay (src/debugOverlay.js) can show exactly when the running bundle
  // was built. Remove together with debugOverlay.js once cache/deploy is resolved.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // ไฟล์ static ทั้งหมด (รูป/เสียง/cards/, manifest.json, sw.js) อยู่ใน public/
  // และถูกคัดลอกลง dist/ ตามชื่อเดิมเป๊ะ ๆ — runtime string paths ในเกมจึงใช้ได้เหมือนเดิม.
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // ปิด minify ชั่วคราวระหว่างย้ายโค้ด (Stage 2A/2B) เพื่อให้ production รันโค้ดเกม
    // verbatim เหมือนเดิมเป๊ะ ๆ — ตัด minifier ออกจากตัวแปรเสี่ยงจนกว่าจะมี regression
    // test บนเบราว์เซอร์ครบ แล้วค่อยเปิด minify เพื่อลดขนาด.
    minify: false,
  },
});
