import { defineConfig } from 'vite';

// NOCTISAK47 ถูก deploy บน GitHub Pages ใต้ subpath
// (https://peerasakrinsan-bot.github.io/Noctisak47-clicker/) และตัว PWA
// (manifest scope "./", sw.js, asset paths) อิงพาธแบบ relative.
// ใช้ base: './' เพื่อให้ build ออกมาเป็นพาธ relative ที่ทำงานได้ทั้งบน
// root และ subpath โดยไม่ต้องแก้ logic เกม.
export default defineConfig({
  base: './',
  // ไฟล์ static ทั้งหมด (รูป/เสียง/cards/, manifest.json, sw.js) อยู่ใน public/
  // และถูกคัดลอกลง dist/ ตามชื่อเดิมเป๊ะ ๆ — runtime string paths ในเกมจึงใช้ได้เหมือนเดิม.
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
