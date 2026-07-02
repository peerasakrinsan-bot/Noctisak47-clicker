# NOCTISAK47: OVERDRIVE RAMPAGE — Production-Readiness Architecture Audit

**Date:** 2026-07-02 · **Auditor:** Lead Architect / Senior Performance Engineer review
**Scope:** entire codebase — `index.html`, `src/*` (game.js 11,984 ln · bossLoopHero.js 3,656 ln · canvasVfx.js 3,201 ln · cardVfx.js 2,084 ln · installPrompt.js · debugOverlay.js · perfOverlay.js · main.js · styles.css 7,417 ln), `public/sw.js`, `scripts/*`, CI workflows, asset tree (~66 MB).

> Note: the audit request referenced "Ant Keeper Idle"; this repository is **NOCTISAK47: OVERDRIVE RAMPAGE** (action clicker PWA). The same audit framework was applied to the actual code. The game has **no offline-progression simulation** (it is a session-based clicker, not an idle game), so the "Offline simulation" category is assessed as N/A.

---

# Executive Summary

| Dimension | Score (0–10) |
|---|---|
| Overall architecture | **6.5** |
| Production readiness | **5.5** |
| Performance | **7.5** |
| Maintainability | **5** |
| Mobile optimization | **7** |

**Strengths.** This codebase shows unusually strong *performance discipline* for a vanilla-JS game: pooled hit numbers/particles/toasts, a buffered 33 ms input loop with per-tick visual flush, throttled FX gates, an idle-stopping canvas rAF loop with dynamic particle budgets and alpha-gated `shadowBlur`, a cache-then-network SW, a well-designed debounced/deduped cloud-sync engine with conflict guards, and clean isolation contracts between the core game, Loop RPG mode, install prompt, and the cosmetic VFX layers. CI runs four static audits plus a wiring smoke test on every push.

**Blockers.** Four issues must be fixed before a Google Play (TWA) release: (1) the in-page cache cleanup **deletes the live service-worker cache on every load** (cache-name mismatch with the postbuild build-tag), silently breaking offline mode and re-downloading media; (2) the cloud-save flow **reads `secret_key` from Supabase filtered by `player_id` alone**, meaning the anon key can read any player's secret → account takeover by ID; (3) the Stage-2A window bridge is **missing two functions referenced by inline handlers** (cloud panel is partially broken); (4) the production bundle ships **~1.1 MB of unminified JS including the entire disabled Loop RPG mode**.

---

# Top 20 Highest-Priority Issues (ranked by impact)

### 1. Every page load deletes the active SW cache — offline mode is broken in production
- **Severity:** Critical · **Category:** PWA / Save-of-assets · **Risk of fix:** Low
- **Location:** `index.html:866–870` (SW registration block) vs `scripts/postbuild-sw.js:52–55` and `public/sw.js:3`.
- **Evidence:** The registration script runs on **every** load and deletes all Cache Storage keys `k !== APP_CACHE_NAME`, where `APP_CACHE_NAME = 'noctisak47-' + APP_VERSION` (untagged). But `postbuild-sw.js` rewrites the deployed SW's `CACHE_NAME` to `'noctisak47-' + APP_VERSION + '-<buildTag>'`. The tagged name never equals the untagged name, so the page wipes the SW's precache + runtime media cache on every visit. `dist/` is what Pages serves (`pages.yml`), so this is live behavior.
- **Impact:** Offline launch fails after any revisit; every image/audio is re-fetched from network each session (data + battery on mobile); the ~40-asset precache work and the entire cache-first media strategy are nullified.
- **Recommendation (smallest safe fix):** change the filter to prefix matching that keeps the current tagged cache, e.g. delete only keys that match `/^noctisak47-/` **and** do not start with `APP_CACHE_NAME`; or drop this block entirely — the SW's own `activate` handler plus the version-guard (which already uses `/^noctisak47[-_]/` and runs only on version change) make it redundant.
- **Estimated gain:** working offline mode; multi-MB less network traffic per session.

### 2. Cloud-save `secret_key` is readable by anyone with the anon key
- **Severity:** Critical · **Category:** Security · **Risk of fix:** Medium (backend + client)
- **Location:** `src/game.js:10893` (`svCloudUpload` → `select=secret_key,save_data,uploaded_at` filtered by `player_id` only), `game.js:10113–10122` (`_cloudUploadCore` conflict check), `game.js:10430–10432` (`startupCloudRestore`). Anon key embedded at `game.js:436–437`.
- **Evidence:** These queries request the `secret_key` column filtered **only by `player_id`**. For the flows to work (ID-taken check, startup restore), RLS must allow the anon role to select `secret_key`. Any user can therefore fetch `?player_id=eq.SOMEID&select=secret_key`, obtain the secret, then `svCloudDownload`/PATCH that player's save — full account takeover with a guessable/known PLAYER ID (IDs are user-chosen, short, and shown publicly by players sharing screenshots).
- **Impact:** save theft/overwrite for any player; also invalidates the "🔒 1 PLAYER ID" trust promise in the UI.
- **Recommendation:** never select `secret_key` client-side. Replace the "ID exists / secret matches" checks with a Postgres RPC (or edge function) that takes `(player_id, secret)` and returns booleans, with RLS denying column read. The existing PATCH-filtered-by-secret write path is fine.
- **Estimated gain:** closes the only user-data security hole found.

### 3. Window bridge missing `svCloudOnIdChange` / `svSecretKeydown`
- **Severity:** High · **Category:** Bug / Architecture (Stage-2A bridge) · **Risk:** Low
- **Location:** bridge `src/game.js:11958–11984`; handlers `index.html:342` (`oninput="…; svCloudOnIdChange()"`) and `index.html:345` (`onkeydown="svSecretKeydown(event)"`); definitions `game.js:10838`, `game.js:10790`.
- **Evidence:** Both functions live in module scope and are not in the `Object.assign(window, {...})` bridge. Every keystroke in the PLAYER ID field throws `ReferenceError: svCloudOnIdChange is not defined` (the uppercase filter still runs, but the secret display never refreshes), and keyboard activation (Enter/Space) of the secret box is dead.
- **Impact:** broken cloud-panel UX + console error spam; accessibility regression on the secret toggle.
- **Recommendation:** add both names to the bridge (2-line change).
- **Estimated gain:** restores intended cloud UX.

### 4. ~1.1 MB unminified JS shipped, including the entire disabled Loop RPG mode
- **Severity:** High · **Category:** Performance / Bundle · **Risk:** Low–Medium
- **Location:** `vite.config.js:25` (`minify: false`); `src/bossLoopHero.js:29` (`BOSS_LOOP_ENABLED = false`, 213 KB module still imported by `main.js:37`).
- **Evidence:** Source JS totals ~1.13 MB; minification is disabled ("Stage 2A safety"), and the Loop RPG mode is feature-flagged off for players but fully parsed/executed on every load (it registers listeners, builds config tables, etc.).
- **Impact:** slower first load & parse on low-end Android (main-thread parse of ~1 MB), larger SW precache, more memory.
- **Recommendation:** (a) enable `minify: 'esbuild'` — the four CI audits + smoke give reasonable regression cover, and hashed bundles make rollback trivial; (b) while the flag is false, load `bossLoopHero.js` via dynamic `import()` behind the flag so it drops from the initial bundle.
- **Estimated gain:** ~60–70 % JS size reduction (minify) + ~19 % fewer shipped lines (BLH gating); measurably faster TTI on low-end devices.

### 5. `pauseGoMainMenu` destroys the pause-button image permanently
- **Severity:** High (visible UI break) · **Category:** UI / Bug · **Risk:** Low
- **Location:** `src/game.js:7250` (`$('pauseBtn').textContent = '⏸'`); `index.html:645` (button contains an `<img>`).
- **Evidence:** Setting `textContent` replaces the button's `<img>` child with the text "⏸". The HTML is static and never re-rendered, so after the first "Pause → MAIN MENU" the styled image button is gone for the rest of the session (and `⏸` renders unstyled).
- **Recommendation:** delete the line (leftover from a pre-image emoji button).
- **Estimated gain:** removes a permanent visual regression in a common flow.

### 6. `collect.mp3` decoded into a permanently-held ~20 MB PCM AudioBuffer
- **Severity:** Medium-High · **Category:** Memory / Audio · **Risk:** Low
- **Location:** `src/game.js:291` (`warmUpAudio` pre-decodes into `window._collectBuf`), `game.js:5759–5790` (`_playCollectBGM`).
- **Evidence:** `collect.mp3` is 948 KB (~60 s music). `decodeAudioData` expands it to raw PCM (~40 K samples/s × 2ch × 4 B ≈ 20 MB) which is cached in `window._collectBuf` forever — on top of 13 SFX buffers. This is a music track, not a latency-critical SFX.
- **Impact:** ~20 MB baseline heap on 1–2 GB Android devices; increases background-kill probability of the PWA/TWA.
- **Recommendation:** play the collect BGM through an `<audio>` element (like the fight/title BGM) or release `_collectBuf` when the collect screen closes; keep Web Audio only for short SFX.
- **Estimated gain:** ~20 MB steady-state memory reduction.

### 7. Game timer is tick-count based, not wall-clock — drifts under load/throttling
- **Severity:** Medium · **Category:** Game Loop / Determinism · **Risk:** Medium (gameplay-adjacent; change carefully)
- **Location:** `src/game.js:8158–8190` (`startTimer`: `setInterval(…, 50)` assumes exactly 50 ms per tick, `timeLeft -= 0.05 * rate`); `game.js:9367–9379` (`godInterval` 1 s decrement).
- **Evidence:** `setInterval` cadence is not guaranteed; under GC pauses, heavy VFX, or browser timer throttling, ticks arrive late but each still subtracts a fixed 0.05 s. A "60-second" round runs long on exactly the devices that struggle — effectively giving janky devices more play time and skewing score/economy comparability. `pressureUpdate(50)` inherits the same fixed-dt assumption.
- **Recommendation:** compute real elapsed time (`performance.now()` delta, clamped to e.g. ≤250 ms) per tick and subtract `delta * rate`. Keep the 50 ms interval as the render cadence. Same for the OD countdown.
- **Estimated gain:** consistent round length across devices; fairer leaderboard scores. *(Flagging despite the "don't change gameplay" rule because current behavior already differs per device; ship behind a verification pass.)*

### 8. Full-screen `backdrop-filter` during the PRESSURE/BREAK sequence
- **Severity:** Medium · **Category:** Rendering / Mobile · **Risk:** Low
- **Location:** `src/styles.css:3304–3316` (`#pressureOverlay.buildup/.lockin/.break` use `backdrop-filter: saturate(…) brightness(…)` over the whole viewport, transitioned).
- **Evidence:** `backdrop-filter` forces a full-screen readback + filter pass every frame while active — during BREAK, the most VFX- and input-intensive moment. The project's own CSS conventions ban `backdrop-filter` in the VFX layer for exactly this reason.
- **Impact:** frame drops on low-end Android GPUs precisely when tap-timing matters (BREAK has a 2.75–3.1 s window).
- **Recommendation:** replace with a plain rgba background + `box-shadow: inset` (already partially present) — the saturate/brightness dim can be approximated with a semi-transparent black/desaturating overlay (`background` + `mix-blend-mode: saturation` on a cheap layer, or just the darkening).
- **Estimated gain:** noticeably smoother BREAK phase on low-end devices.

### 9. XUANG skin aura: 9 permanently-animated blurred layers during combat
- **Severity:** Medium · **Category:** Rendering / VFX · **Risk:** Low
- **Location:** `index.html:701–707` (`#xuangAura`: core, smoke, ripple + 6 particles), `src/styles.css:2827–2864` (each with `filter: blur(5–14px)` + `infinite` animations); similarly `#pressureBossAura` (`styles.css:3347–3356`, 3 blurred layers) active through every buildup.
- **Evidence:** Multiple large blurred elements animating forever while the skin is equipped/rage builds — blur on animated elements re-rasterizes per frame; this stacks with canvas VFX + hit FX.
- **Recommendation:** cap blur radii, pre-bake the glow into a static PNG/webp sprite with an opacity-only pulse, or pause the aura (`animation-play-state`) except at rage thresholds.
- **Estimated gain:** several ms/frame on low-end GPUs for XUANG owners (a purchasable skin should not be a perf downgrade).

### 10. Pause/resume during Overdrive silently changes OD drain semantics
- **Severity:** Medium · **Category:** Game Loop / Duplicate logic · **Risk:** Low
- **Location:** `src/game.js:7222–7233` (`resumeGame` recreates a plain 1 s `godSecondsLeft--` interval) vs `game.js:9367–9379` (`activateGodLevel` interval applies LORD OF DEBT overload ×2 and ORC BADDY ×1.2 drain).
- **Evidence:** The interval body is duplicated in two places and has already diverged: after pause→resume, the card-specific drain multipliers stop applying for the rest of that OD.
- **Recommendation:** extract one `_startOdInterval()` used by both call sites.
- **Estimated gain:** removes a live behavioral inconsistency + future divergence risk.

### 11. Stable save hash uses non-existent settings keys — settings changes never sync
- **Severity:** Medium · **Category:** Save / Cloud · **Risk:** Low
- **Location:** `src/game.js:857–862` (`computeStableSaveHash`: `['sfxVol','bgmVol','sfxMuted','bgmMuted','flashEffect']`).
- **Evidence:** Actual settings keys are `musicOn`, `musicVolume`, `sfxOn`, `sfxVolume`, `flashEffect` (`normalizeSettings`, `game.js:172–186`). Four of the five hashed keys are always `undefined`, so volume/mute changes produce an identical hash → `_cloudUploadCore` hash-skip (`game.js:10094–10101`) drops the upload and even clears the dirty flag. Only `flashEffect` changes sync.
- **Recommendation:** correct the key list.
- **Estimated gain:** settings actually roam across devices; dirty-flag correctness.

### 12. `activeArena` not validated against `ownedArenas` on load
- **Severity:** Medium · **Category:** Save integrity · **Risk:** Low
- **Location:** `src/game.js:467–469` (`normalizeSaveData` validates `activeSkin` against `ownedSkins` but only checks `activeArena` truthiness; `ownedArenas` contents are also not string/dedup-sanitized like `ownedSkins`).
- **Impact:** a tampered/corrupt save can equip an unowned arena (minor), or carry junk entries in `ownedArenas` into the cloud payload forever.
- **Recommendation:** mirror the skin logic: sanitize the array, force-include `'default'`, reset `activeArena` if not owned.

### 13. Overdrive charge state lives in a DOM style string
- **Severity:** Medium · **Category:** Architecture / Hot path · **Risk:** Medium (many call sites)
- **Location:** `src/game.js:8714–8799` and ~15 other sites (`parseFloat(_el.godFill.style.width)` read-modify-write per card effect, per tap).
- **Evidence:** The OD gauge's source of truth is the CSS `width` string of `#godFill`; every card effect parses it back with `parseFloat` and rewrites it — up to ~10 read/写 cycles per tap when several card flags are active. It also means game state is silently reset by any DOM manipulation and is invisible to save/debug tooling.
- **Recommendation (incremental):** introduce a single `odCharge` number variable + one `_renderOdFill()` write per tick (the tick loop already exists); keep behavior identical.
- **Estimated gain:** fewer string allocations per tap; state becomes testable; unlocks Stage-2B extraction of the OD module.

### 14. `checkWeakPointHit` does a forced-layout read per tap inside the batch loop
- **Severity:** Medium · **Category:** Performance / Layout thrash · **Risk:** Low
- **Location:** `src/game.js:2100–2109` (`getBoundingClientRect` per `processHit`), called from the batched loop at `game.js:8472`.
- **Evidence:** Within one 33 ms tick, multiple buffered taps each call `processHit` → `checkWeakPointHit` → `getBoundingClientRect()`, interleaved with the style writes the previous iteration made (god bar width, HP fill) — classic write→read→write layout thrash in the hottest path.
- **Recommendation:** cache the WP center/radius once in `showWeakPoint()` (position is fixed for the WP's lifetime; only `transform: scale` varies and is known) and invalidate on `resize`/`visualViewport` change.
- **Estimated gain:** removes up to N forced reflows per tick during multi-touch play.

### 15. First-load network waste: 1.8 MB audio preload, eager purchasable-skin preloads, unused webp variants
- **Severity:** Medium · **Category:** Mobile / Assets · **Risk:** Low
- **Location:** `index.html:111` (`<link rel="preload" … 47title.mp3>` 1.8 MB); `src/game.js:929–945` (ASSETS eagerly preloads XUANG/JAKKADUN/SORNSIT skins — 15 images — regardless of ownership, while the other six skins load lazily); `src/game.js:1662–1687` + `public/` (`colosseum_bg.png` 1.1 MB used as arena bg while `colosseum_bg.webp` 504 KB sits unused; `one_bg.png` 308 KB vs unused `one_bg.webp` 161 KB); `public/toei_hit*.png` ~600 KB each.
- **Impact:** slower, data-hungrier first load; preloader's 5 s fallback often fires on 3G because it waits on skins the player may not own.
- **Recommendation:** preload only owned/active skin images (ownership is known from `save` at preload time); use the `.webp` arena files; convert the heaviest boss sprites to webp; drop the mp3 preload (the `<audio preload="auto">` element already fetches it).
- **Estimated gain:** ~3–5 MB less first-load transfer; faster TTI.

### 16. `game.js` is a 12 k-line god module; card effects are an if-forest in the hot path
- **Severity:** Medium (compounding) · **Category:** Maintainability / Architecture · **Risk:** n/a (roadmap)
- **Location:** whole of `src/game.js`; hot-path examples `processHit` (`game.js:8652–9077`, ~425 lines, ~40 `window._csState.cs_*` branch checks per tap), `csApplyDmgMod` (`game.js:4457–4565`, ~60 sequential multipliers), `startTimer` rate expression (`game.js:8162–8168`).
- **Evidence:** Every new card adds another branch to 3–5 hot functions; effects are keyed by ad-hoc `cs_*`/`_xxxEndTime` fields on a window global. The card audit script mitigates dead flags, but the pattern is O(cards) per tap and the file is beyond safe human review size. `startGame`/`retryGame` also duplicate ~30 lines of card-time setup (`game.js:7065–7085` vs `7108–7128`).
- **Recommendation:** proceed with the already-planned Stage 2B split, and within it convert per-tap card effects to a **precompiled pipeline**: at run start (card known), build an array of active modifier closures once; `processHit`/`csApplyDmgMod` then iterate 2–5 active entries instead of testing ~90 flags.
- **Estimated gain:** large maintainability win; small but real hot-path win.

### 17. Document-level non-passive `touchmove` handlers do per-move DOM queries
- **Severity:** Low-Medium · **Category:** UI / Input latency · **Risk:** Low
- **Location:** `src/game.js:14–35` (two separate non-passive `touchmove` listeners; the second runs `closest()` plus a 6-item loop of `getElementById` + `style.display === 'flex'` + `contains()` on every move event).
- **Evidence:** Non-passive move handlers put every touch-scroll on the main-thread critical path; the whitelist check also depends brittlely on inline `display:flex` styles.
- **Recommendation:** merge into one listener; cache the six elements; prefer CSS `touch-action` (already used elsewhere) so most of this handler becomes unnecessary.

### 18. Dead code & dead writes in the render path
- **Severity:** Low · **Category:** Code quality · **Risk:** Low
- **Locations / items:**
  - `_el.bossHpFill/bossName/bossPhaseTag` are stub objects (`game.js:1108–1111`) but still written on **every boss hit** (`applyBossDamage`, `game.js:9090`; `spawnBoss`; `bossKO`) — dead per-hit property writes and misleading code.
  - `toggleSound` (`game.js:389`), `applyMute` (`game.js:383`) — no callers/bridge entries.
  - `initVolumes()` stub called 3×.
  - `['akSound','punchSound',…]` element IDs don't exist in `index.html` (`game.js:10623`).
  - `sound_on.png` / `sound_off.png` preloaded + SW-precached (`game.js:940`, `sw.js:47–48`) but never rendered.
  - `public/sw.js:1` header comment says version `2026.06.07.1` (actual `2026.07.01.5`).
  - `Object.defineProperty(window,'WP_MAX',…)` (`game.js:1843`) — module code then reads bare `WP_MAX` via the global getter; works, but is a hidden global dependency.
- **Recommendation:** delete stubs/writes and unused assets; replace `WP_MAX` global reads with `getWpMax()`.

### 19. `INPUT.fingerTimestamps` map grows for the whole run; minor per-tap allocations
- **Severity:** Low · **Category:** Memory / GC · **Risk:** Low
- **Location:** `src/game.js:8398`, `8456–8461` (entries keyed by ever-increasing Android touch identifiers, cleared only at `INPUT.start()`); `game.js:8452` (`recentTimestamps.filter(...)` allocates a new array per accepted tap; the array was already trimmed at `game.js:8413–8415`).
- **Recommendation:** prune map entries older than ~2 s inside `checkBot`'s trim pass; replace the `.filter().length` with `recentTimestamps.length` (equivalent post-trim).

### 20. Coin displays inconsistently formatted (overflow risk)
- **Severity:** Low · **Category:** UI · **Risk:** Low
- **Location:** `src/game.js:1245–1247`, `1251`, `1560`, `1733` set `shopCoinNum`/`bossCoinNum`/`arenaCoinNum` to the raw integer while `menuCoinNum` uses `formatNum`.
- **Impact:** ≥7-digit balances overflow the shop header layout; inconsistent presentation.
- **Recommendation:** route all four through `formatNum` (or none, consistently).

---

# Detailed Findings by Category

## 1. Architecture
- **Module boundaries (good):** `installPrompt.js`, `canvasVfx.js`, `cardVfx.js`, `perfOverlay.js`, `debugOverlay.js`, `bossLoopHero.js` are genuinely self-contained; isolation contracts (no `save`/`cs_*` writes from VFX; separate `noctisak47_blh` key; window-bridge-only coupling) are documented and mostly honored. Dependency direction is one-way (game → window bridge ← consumers). No circular imports.
- **God module:** `src/game.js` (574 KB) holds constants, save, audio, cards, combat, VFX glue, cloud sync, UI, daily/weekly, mastery. See Top-20 #16. Stage 2B is the right plan; it is now the biggest single risk to velocity.
- **Global state:** ~60 module-level mutable `let`s (combo, hp, godLevel, …) plus `window._csState`, `window._wqRun*`, `window._bossesDefeated`, `window._collectBuf`. Runtime card state on `window` (`_csState`) is effectively a public API that BLH/inspectors could clobber. Move to module scope during Stage 2B (keep a dev-only window mirror).
- **Initialization order:** import order in `main.js` is documented and correct (game → canvasVfx → cardVfx → installPrompt → bossLoopHero). One footgun: `_cpInit()` is deferred via `setTimeout(0)` because it references functions declared ~10 k lines later (`game.js:896–899`) — a symptom of file ordering, fixed for free by 2B.
- **Window bridge gaps:** Top-20 #3. Also note the bridge deliberately exposes `playBGM/stopBGM/showMainMenu` for BLH — fine, but `blh` reaching into `startGame` means the bridge is now a *bidirectional* contract; document required members and assert them in the smoke test (the smoke already covers most).
- **Event flow:** custom events (`noctis:main-menu-shown`, `noctis:first-run-complete`, `noctis:vfx-auto-downscale`) are a clean pattern — extend it during 2B instead of direct calls.

## 2. Rendering
- **Strong points:** batched input tick (`INPUT`, 33 ms) with one `updateUI`/`updateComboUI`/`_flushTickVisuals` per tick; frequency governor (`FX_GATE`) for recoil/flash/rim; hit-number aggregation window (140 ms); class-flip animation restarts avoiding `offsetWidth` reflows in the per-hit path (`_hnShow`, `updateUI` a/b classes); boxer drawn on a DPR-aware canvas with rAF-coalesced draws; canvas VFX loop stops at zero particles and clears on `hidden`.
- **Remaining reflow triggers:** deliberate `void el.offsetWidth` restarts remain in *non-hot* paths (splashes, bomb flash, countdown, OD badge) — acceptable; the per-tap WP rect read is the one hot offender (Top-20 #14).
- **CSS:** 113 `infinite` animations, but nearly all are gated behind state classes on hidden/occasional elements. The exceptions that run during combat: XUANG aura (#9), pressure boss aura, `#weakPoint` pulse (cheap transform), OD label pulses (cheap). `backdrop-filter` appears 6× — pressure overlay (#8) is the only in-combat one; save modal/install prompt uses are fine.
- **BLH:** `renderBoard()` rebuilds the 7×7 board as an innerHTML string every walk step / spawn tick (`bossLoopHero.js:2249`, callers ~12 sites). At ≤4× speed that's ~3–4 rebuilds/s of ~49 nodes — acceptable for the mode, but a cell-diff would cut GC churn if the mode is re-enabled. Low priority while `BOSS_LOOP_ENABLED=false`.

## 3. Performance
- Hot path (`processHit`) issues covered in #13/#14/#16. Additional notes:
  - `getActiveSkin()` cached; `_imgObjCache` prevents sprite re-decode — good.
  - `csApplyDmgMod` calls `pressureIsBreak()` ~12 times per invocation via repeated `typeof` guards — hoist to one local at function top (micro, free).
  - `renderTimer` caches nodes and diffs text — good.
  - `buildSavePayload` runs full `normalizeSaveData` + envelope stringify on every `doSave` — called on each purchase/settings change, not per-frame; fine.
- **Allocation spikes:** per-tap `[...e.changedTouches].slice(0,3)` + object literals — small and bounded by the 35 taps/s cap; acceptable.

## 4. Memory
- `_collectBuf` (~20 MB PCM) — Top-20 #6. SFX buffers (~13 short clips) are appropriate Web Audio use.
- Pools are bounded (`_pPool` grows to max concurrency only; hit numbers fixed 36+8; coin popups cap 10; canvas pool ≤340). No detached-DOM leaks found: all transient nodes are removed on timeout and pooled; `setScreen` in BLH replaces innerHTML wholesale (listeners are inline `onclick` strings → no closure leaks).
- Timers: every gameplay timer is cleared in `endGame`/`pauseGame`/`pauseGoMainMenu`/`_csStopAllTimers`/`blhAbortTimers` — this is done carefully. The 5-min cloud interval and toast timers are singletons.
- `fingerTimestamps` growth — Top-20 #19.

## 5. Game Loop
- Tick/update separation exists (input buffered → logic batch → single visual flush) — good design.
- Delta-time correctness: Top-20 #7 (round timer + OD countdown are tick-counted). Canvas VFX *does* use real dt with `MAX_DT` clamp — the pattern already exists in the repo to copy.
- Background behavior: `visibilitychange`/`pagehide`/`blur` all pause the run, commit the save, and pause audio with re-entrancy guards (`game.js:10636–10691`) — solid. Note `blur` fires on desktop when clicking devtools → pause; acceptable tradeoff, documented behavior recommended.
- Edge case: `endGame` can fire while `document.hidden` (timer clamped to 1 Hz in background still decrements 0.05/tick → a hidden round drains ~20× slower; combined with the auto-pause this is mostly moot).

## 6. Save System
- **Good:** envelope + version field, `normalizeSaveData` clamps every numeric, legacy payload backup on migrate, corrupt-save detection with user-visible repair message, ID migration map, pending-sync queue with newer-of(live, queued) flush, hash-based dedupe, exponential backoff, PATCH-matched-0-rows → INSERT with 409 propagation (correct!), weekly-claims merge on cloud load (`game.js:11014–11025`) — this is one of the more robust localStorage+cloud stacks I've audited at this scale.
- Gaps: #11 (stale hash keys), #12 (arena validation), and: `saveVersion` increments on every local `doSave` (`buildSavePayload`, `game.js:539`) including settings toggles — harmless but makes version deltas meaningless for debugging; consider bumping only when the stable hash changes.
- `_onAppHide` fires a normal `fetch` during page hide — may be killed by the browser. Use `fetch(..., { keepalive: true })` for the app-hide sync (body ≪ 64 KB limit applies; the save payload should fit, verify).

## 7. UI
- Screens are display-toggled static DOM + a few innerHTML-rendered grids (shop/collection) — re-rendered only on open/purchase; fine.
- Accessibility: modest but present (`role=status` toast, `aria-live` reward slot, `aria-hidden` on decorative layers, `role=button` + keyboard on the secret box — currently broken by #3). Game field itself is inherently visual; for Play-store quality add `aria-label`s to icon-only buttons (pause, save/transfer) and ensure focus isn't trapped under overlays.
- Touch responsiveness: `touchstart`-driven with `preventDefault`, ghost-click guard on reveal, per-finger rate limit — good. `maximum-scale=1, user-scalable=no` hurts low-vision users but is the norm for action games.
- Inconsistent coin formatting — Top-20 #20.

## 8. VFX
- The two-layer design (persistent DOM aura/pips + transient canvas particles with DOM fallback) is sound and audit-guarded. Dynamic budget, `_LIFE_TRIM`, `_sb()` alpha-gated blur, reduced-motion scaling, hidden-tab clear — all present.
- Duplicate-effect risk is handled via throttles (`_THROTTLE`, `_PULSE_THROTTLE`, aura-react throttle).
- Reduced-motion: honored in canvasVfx (`_reduced`), cardVfx `_dur`, CSS fallbacks; `flash-low/off` classes map to a user setting *and* auto-downscale on sustained <30 FPS with a persisted toast — genuinely good mobile citizenship.
- Residual: CSS auras in #9; `#odScreenAura` uses class-gated layers (fine).

## 9. Audio
- Web Audio for SFX with per-play gain, overlap caps, and 1 s AK throttle; HTMLAudio for BGM with on-demand `preload` switch — correct split except the collect BGM (#6).
- Unlock handling: `warmUpAudio` on first gesture + suspended-context resume; iOS `webkitAudioContext` fallback — good.
- Lifecycle: full pause/resume matrix for title/fight/collect on background with was-playing snapshots — good. Dead IDs in the SFX-silence loop (#18).

## 10. Balance Systems
- Constants are centralized per system (`SHOP_DEF`, `GOD_LEVELS`, `PRESSURE_*_TABLE`, `WP_ROUND_MULT`, `BAPH_*`, `DRAKE_*`, BLH `BAL`/`SPEC_BAL`/`DANGER_BAL`) — better than typical. Remaining magic numbers live inline in `processHit` (combo window 220 ms, ramp 0.02, upgrade-at 30/25, milestone tables) — acceptable, but move beside `GOD_LEVELS` during 2B.
- Formula duplication: KO coin pipeline is duplicated between `normalKO` and `bossKO` (both apply coinMult → csApplyCoinMod → getZenyKoMultiplier in the same order) — extract one `applyCoinPipeline(base)`; divergence here would be an economy bug.
- Economy coupling is documented (≈250 coins/round) and enforced culturally, not in code — fine at this scale.

## 11. Code Quality
- Dead code: see #18 and Dead Code Report below. Duplicate logic: see Duplicate Logic Report.
- Naming: consistent `_private` / `csXxx` / `pressureXxx` prefixes; Thai comments per convention — maintained.
- Function size: `processHit` (~425 ln), `csOnBreakSuccess` (~215 ln), `endGame` (~160 ln), `renderShop` — the usual suspects for 2B extraction.
- The four Node audit scripts (card, card-vfx, reveal ×2) + smoke are a real asset; add a bridge-completeness assertion (scan `index.html` inline handlers vs `Object.assign(window,…)` keys) — it would have caught #3 mechanically.

## 12. Security
- #2 is the material issue. Others:
  - `innerHTML` sinks receiving dynamic content: `showSaveToast(msgOverride)` ← `_cloudFriendlyError(e.message)` (server-influenced), `svShowMsg` (contains user `id`, but the input filter strips non-`[A-Z0-9_]`). Low actual risk (own backend, filtered input) — still, prefer `textContent` for message bodies. No `eval`/`Function` anywhere.
  - localStorage values are parsed defensively everywhere (`try/catch` + normalize) — good.
  - Anon Supabase key in source is expected; RLS is the boundary (see #2).
  - External resources: fonts preconnect (unused? `fonts.googleapis.com` dns-prefetch but no stylesheet link — remove), `@vercel/analytics` script 404s on Pages (harmless request each load; consider gating by hostname).

## 13. Mobile Optimization
- Battery: canvas loop idles at zero particles; overlays cancel rAF when hidden; timers cleared on pause; SW cache-first media (once #1 is fixed). Good.
- The 50 ms game `setInterval` + 33 ms input loop run only in-game — appropriate.
- Resize/orientation: `resize` re-sizes boxer canvas; canvasVfx re-measures only in `resizeCanvasVfx`; visualViewport used for coordinates (`vvW/vvH/vvOffY`) — good. No orientation lock in manifest was verified — for a portrait game, ensure `"orientation": "portrait"` in `manifest.json` (not audited here — verify).
- 66 MB asset tree with on-demand caching is fine *if* #1 is fixed; otherwise every skin/track re-downloads.

## 14. PWA
- #1 is the blocker. Beyond it:
  - Update flow (skipWaiting + controllerchange reload guarded by `hadController`) is correct and avoids first-load reload loops.
  - `updateViaCache: 'none'` + `sw.js?v=` — good.
  - Version tripling (index/manifest/sw) is documented; consider a build-time injection to remove the human step (postbuild already patches sw — extend it to check the three values match and fail CI on mismatch).
  - Offline fallback serves `index.html` for documents — fine; note code assets are network-first with cache fallback, so offline works only with an intact cache (again #1).

## 15. Maintainability
- Stage 2B module split is the core need (#16). Second: promote the informal contracts (bridge members, custom events, `cs_*` flag registry) into checked artifacts — the audit scripts show the team already knows how.
- `CLAUDE.md` + `docs/CARD_SKILL_GUIDE.md` are excellent living docs; keep them in the definition of done.

---

# Dead Code Report

| Item | Location | Action |
|---|---|---|
| `_el.bossHpFill/bossName/bossPhaseTag` stubs + all writes to them | `game.js:1108–1111`, `9090`, `9168–9171`, `9025–9027` etc. | Remove stubs and the dead writes (boss bar UI was deleted) |
| `toggleSound`, `applyMute` | `game.js:383–395` | Delete (settings panel replaced them) |
| `initVolumes()` stub + 3 call sites | `game.js:281, 1012, 7054, 7102` | Delete |
| `'akSound','punchSound'` in background-silence loop | `game.js:10623` | Remove ids (elements don't exist) |
| `sound_on.png`, `sound_off.png` preload + precache | `game.js:940`, `sw.js:47–48` | Remove entries + assets if truly unreferenced |
| `fonts.googleapis.com` dns-prefetch / gstatic preconnect with no font link | `index.html:122–123` | Remove |
| Stale SW header version comment | `sw.js:1` | Fix or delete comment |
| `debugOverlay.js`, `perfOverlay.js`, `__BUILD_TIME__` define | `main.js:51,58`, `vite.config.js:13–15` | Marked TEMP by design — schedule removal (or keep perf overlay, it's gated & useful) |
| Unused webp variants vs used png | `public/colosseum_bg.webp`, `public/one_bg.webp` | Switch code to webp, delete png (inverse of dead-asset: dead *better* asset) |
| BLH mode behind `BOSS_LOOP_ENABLED=false` | `bossLoopHero.js` (whole module) | Not dead-delete (planned feature) — but gate behind dynamic import until re-enabled |
| Legacy `noctis_sound` key still written every persist | `game.js:333` | Keep read-migration, drop the write after a version or two |

# Duplicate Logic Report

1. **`startGame` vs `retryGame`** — card-time/HP setup + countdown block duplicated (~30 lines each, `game.js:7065–7085` / `7108–7128`). Extract `_beginRunWithCards()`.
2. **OD countdown interval** — `activateGodLevel` vs `resumeGame` (already diverged — Top-20 #10).
3. **KO coin pipeline** — `normalKO` vs `bossKO` ordering of coinMult → card mod → zeny-KO multiplier (`game.js:9135–9142` / `9196–9207`).
4. **Manual cloud upload vs `_cloudUploadCore`** — `svCloudUpload` re-implements read-check + PATCH/POST with slightly different semantics (no timeout wrapper, no hash update path divergence). Route the manual path through `_cloudUploadCore({forceConflictCheck:true})`.
5. **`_wpMissPool` node factory** — duplicated in `_getWpMissEl` and `_hnPrewarm` (`game.js:2355–2362` vs `9627–9632`); one factory function.
6. **Coin-display refresh** — `updateShopCoinUI` exists but `buyItem`/`buyArena`/`buyBossSkin` each hand-update subsets (`game.js:1418–1421`, `1793–1797`, `1621`). Use `updateShopCoinUI()` everywhere.
7. **Menu/endGame screen-hiding blocks** — `_hideAllScreens` + repeated manual hide lists in `showMainMenu`/`endGame`/`startGame`; consolidate.

# Performance Opportunities (ranked)

1. Enable minification + gate BLH behind dynamic import (#4) — largest TTI win.
2. Fix SW cache wipe (#1) — largest repeat-visit win (network → cache).
3. Kill full-screen `backdrop-filter` in BREAK (#8) — largest in-combat frame win on low-end.
4. Static-sprite XUANG/pressure auras (#9).
5. Cache WP hit-test rect (#14).
6. Precompiled card-modifier pipeline (#16) + hoist `pressureIsBreak()` in `csApplyDmgMod`.
7. Trim preloads (audio + unowned skins) + webp arenas/boss sprites (#15).
8. Single merged `touchmove` handler with cached elements (#17).

# Memory Optimization Opportunities (ranked)

1. Stop caching decoded `collect.mp3` PCM (~20 MB) (#6).
2. Convert 600 KB-class boss PNGs to webp (also decode-memory: decoded size ∝ pixels, so also cap sprite dimensions).
3. Prune `fingerTimestamps` (#19).
4. Release `_imgObjCache` entries for skins the player unequips (optional; bounded anyway).

# Rendering Optimization Opportunities (ranked)

1. #8 backdrop-filter removal (BREAK phase FPS).
2. #9 aura debluring (steady-state combat FPS for those skins).
3. #14 WP rect caching (multi-touch tick smoothness).
4. BLH board cell-diff instead of innerHTML rebuild (only when mode re-enabled).
5. Consider `contain: strict` on `#fxLayer` and the pooled-number container (they already avoid layout reads; containment cheaply insulates the rest of the tree).

# Technical Debt Report

- Stage 2A "verbatim lift" debt: 12 k-line module, window bridge, inline onclick handlers, `minify:false` — all acknowledged in CLAUDE.md; #3 shows the bridge is now actively decaying. **Add a CI assertion that every inline-handler symbol exists on `window` after import** (Node + the existing DOM stub can do this).
- `window._csState` as the card-effect substrate: ad-hoc field registry, only guarded by the card-audit script.
- DOM-as-state for OD charge (#13) and reliance on `style.display` string comparisons for screen state (`game.js:29–33`).
- Version string in 3 places with manual bump discipline; make CI verify equality.
- TEMP diagnostics (debug overlay, build-time define, reveal markers) awaiting removal.
- Two divergent cloud upload implementations (Duplicate #4).
- No browser-level automated test; the Node audits are good but cannot catch DOM regressions like #3/#5.

# Refactoring Roadmap

**Phase 1 — Safe (days, no behavior change intended)**
1. Fix #1 (cache filter), #3 (bridge entries), #5 (pauseBtn line), #11 (hash keys), #12 (arena normalize), #18/#19/#20 (dead code, map prune, formatNum).
2. Add CI checks: bridge completeness; version-string equality across index/manifest/sw.
3. Switch arena bgs to existing webp files; drop dead preloads.
4. Extract duplicate blocks (Duplicate Logic 1–3, 5–7).

**Phase 2 — Medium (1–2 weeks, verified on device)**
1. Enable `minify: 'esbuild'`; dynamic-import BLH behind its flag (#4).
2. Backend: move secret verification to an RPC; deny `secret_key` selects (#2). Client: route manual upload through `_cloudUploadCore`.
3. Release collect-BGM buffer / move to `<audio>` (#6).
4. Replace BREAK backdrop-filter; static-sprite the XUANG aura (#8, #9).
5. Wall-clock the round timer + OD countdown with clamped dt (#7) and unify the OD interval (#10) — behind a focused manual test pass since it touches feel.
6. WP rect caching (#14); owned-skin-only preloading (#15).

**Phase 3 — Large (Stage 2B, incremental over releases)**
1. Split `game.js` into modules (constants, save/cloud, audio, combat, cards, pressure, ui, events) with `import`/`export`, keeping the window bridge as a thin generated shim.
2. Card-effect pipeline: per-run precompiled modifier list; `cs_*` registry as data (the card-audit script already knows every flag — reuse it as the registry source).
3. Replace inline onclick with delegated listeners; delete the bridge.
4. Re-enable minification-dependent niceties (code splitting: reveal screen, card collection, BLH as separate chunks); webp/sprite-sheet asset pass for the 26 MB card art (serve 2× only on high-DPR).

# Final Verdict

**Not approved for production release yet — approve after four fixes.**

The engineering quality in the hot paths, VFX budgeting, and save/sync engine is above the bar for this class of game, and nothing here requires a rewrite. But I cannot sign off a Google Play release while:

1. **Offline mode is silently broken** by the cache-name mismatch (#1) — this defeats the PWA's core promise and burns user data allowances;
2. **Any player's cloud save can be hijacked by PLAYER ID** (#2) — a user-data security issue;
3. **The cloud-save panel throws on every keystroke** (#3) and the pause button self-destructs (#5) — visible correctness bugs in shipped flows;
4. **~1.1 MB of unminified JS (including a disabled game mode)** ships to low-end devices (#4).

Items 1, 3, 4(minify), 5 are each ≤1-day, low-risk fixes; item 2 needs a small backend change. With those merged and one on-device regression pass (BREAK phase, pause/resume during OD, cloud save/load, offline relaunch), this project is production-ready. The Stage 2B split should then proceed on schedule — the current god-module is the main long-term threat to a healthy production lifecycle, not performance.
