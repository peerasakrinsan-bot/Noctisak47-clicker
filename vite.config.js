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
    // Production hardening (Phase 2): minify + dead-code elimination is now enabled.
    // Stage 2A/2B kept this off so early production diffs stayed readable; the
    // card-audit / card-vfx-audit / smoke scripts plus manual regression passes now
    // give enough coverage to ship minified output. This project runs on
    // rolldown-vite (Vite 8), whose bundled minifier is "oxc" (a native Rust
    // minifier) — the plain esbuild/terser npm packages are not installed, so
    // "oxc" is the correct built-in value here (not "esbuild"). Source maps stay on
    // so a production stack trace or devtools breakpoint still resolves back to the
    // original (unminified, commented) source — they are separate .js.map/.css.map
    // files the service worker never precaches (postbuild-sw.js only matches bundle
    // files ending in .js/.css) and ordinary players never fetch.
    minify: 'oxc',
    sourcemap: true,
  },
});
