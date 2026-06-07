# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NOCTISAK47: OVERDRIVE RAMPAGE** is a single-player action clicker game (PWA) targeting mobile browsers. It is written in vanilla JavaScript with Vite as the build tool. There are no external runtime frameworks.

Deployed at: `https://peerasakrinsan-bot.github.io/Noctisak47-clicker/`

## Local Development

```bash
npm install          # first time only
npm run dev          # Vite dev server with HMR at http://localhost:5173
npm run build        # production build → dist/
npm run preview      # serve dist/ locally
```

For mobile testing, use browser DevTools device emulation or connect a real device on the same local network.

There are no automated tests or linters. All verification is manual.

## Architecture

### File layout

```
index.html              # HTML shell; loads src/styles.css and src/main.js
src/
  main.js               # ES module entry point; imports game.js
  game.js               # All game logic (~10,310 lines) — Stage 2A verbatim lift
  styles.css            # All game styles (~6,000 lines)
public/
  sw.js                 # Service Worker (copied verbatim to dist/)
  manifest.json         # PWA manifest
  cards/                # 72 card artwork PNGs
  *.png / *.mp3 / ...   # ~300 other static assets (sprites, audio, icons)
scripts/
  postbuild-sw.js       # Post-build: injects hashed bundle paths into dist/sw.js
vite.config.js          # base: './', outDir: 'dist/', minify: false (Stage 2A)
```

### Migration stage

The project recently migrated from a single monolithic `index.html` to a Vite + ES module structure. It is currently in **Stage 2A**: the game code was lifted verbatim from inline `<script>` blocks into `src/game.js` — no logic was changed. Stage 2B will gradually split `game.js` into focused modules (constants, state/save, audio, effects, cards, overdrive, shop, ui, events, etc.) with proper `import`/`export`, while keeping a `window.*` bridge for inline `onclick` attributes that still exist in `index.html`.

Minification is **disabled** (`minify: false`) during the migration to make production diffs readable.

### Build pipeline

```
npm run build
  1. vite build          → dist/ (hashed bundles, e.g. main-abc123.js)
  2. node scripts/postbuild-sw.js
       reads dist/assets/*.js and *.css
       injects their hashed filenames into PRECACHE_ASSETS in dist/sw.js
       appends a build tag to CACHE_NAME (e.g. noctisak47-2026.05.18.1-abc123)
```

The post-build step is required for the service worker to cache the hashed Vite bundles correctly; skipping it breaks offline mode.

### Service Worker (`public/sw.js`)

- Cache name: `noctisak47-{APP_VERSION}` (extended with build tag after production build).
- **HTML/JS/CSS/JSON**: network-first (prevents pinning stale code).
- **Images/audio**: cache-first (treated as immutable assets).
- Offline fallback: serves `index.html` for navigation requests.
- Message `SKIP_WAITING` triggers immediate activation of a waiting worker.
- `postbuild-sw.js` patches the precache list in `dist/sw.js` at build time.

### JavaScript structure (inside `src/game.js`)

| Area | Description |
|------|-------------|
| `SHOP_DEF` | 7 shop items (OCA, RNGESUS, DE-SO-LATER, METH SHARD, BUFF STICK, TIME SKIP CORE, STONKS HAND), each with 5 upgrade levels |
| Sound system | Web Audio API (`AudioContext`) for SFX; `<audio>` elements for BGM (`fight1-4.mp3`) |
| `save` object | All player state — coins, cards, items, mastery, skins, arenas — persisted to `localStorage` and synced to cloud (Vercel KV) |
| Hit/damage loop | Tap zones, weak-point detection, crit/overdrive multipliers, card bonuses |
| Card system | 90 cards across 4 rarities. Mastery tier 0–3 tracked per card. |
| Particle system | Object-pooled particles, rings, and break impacts — do not increase per-hit particle counts |

### Game screen IDs

All screens are children of `#gameRoot` (position: fixed, 100vw/100vh):

| ID | Purpose |
|----|---------|
| `mainMenu` | Title / main menu |
| `shopScreen` | Shop / upgrades |
| `bossScreen` | Boss fight |
| `arenaScreen` | Arena / multi-enemy mode |
| `cardCollectionScreen` | Card collection / dex |
| `cardSlotScreen` | Active card slot selection |
| `cardDrawScreen` | Card draw / gacha animation |
| `resultScreen` | Round-end results |
| `pauseScreen` | Pause menu |
| `rewardsModal` | End-of-round rewards |
| `saveModal` | Save / cloud sync UI |
| `bossSkinModal` | Boss skin purchase / select |
| `cardModal` | Card detail / mastery popup |
| `ocaConfirmModal` | Confirm card draw |
| `rerollConfirmModal` | Confirm card slot reroll |

## Releasing / Version Bumping

When making any change that players will receive, update the version string in **three places** to bust the Service Worker cache:

1. `index.html` (~line 19): `window.NOCTISAK47_APP_VERSION = '2026.05.18.1'`
2. `index.html` manifest link: `<link rel="manifest" href="/manifest.json?v=2026.05.18.1">`
3. `public/sw.js` (~line 2): `const APP_VERSION = '2026.05.18.1'`

Version format: `YYYY.MM.DD.n` (n = daily increment, starting at 1).

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `noctisak47_v3` | Main save data (coins, stats, cards, items, mastery) |
| `noctis_settings` | Settings: music/SFX on/off, volumes, reduceFlash, flashEffect |
| `noctisak47_device_id` | Unique device UUID |
| `noctisak47_pending_sync` | Cloud sync payload queued for upload |
| `noctisak47_cloud` | Cloud player `{id, key}` |
| `noctisak47_cloud_lock` | Lock token preventing concurrent cloud sync |
| `noctisak47_app_version` | Cached version string for update detection |
| `noctisak47_version_reload_done` | Flag preventing reload loops on version change |

Schema changes to the save object require a migration guard on load to avoid wiping existing saves. The key `noctisak47_v3` already implies two prior schema migrations.

## Save Object Shape

```
save.coins                    current currency
save.stats                    {highScore, totalKO, maxCombo, ...}
save.gamesCompleted           total run count
save.ownedSkins / activeSkin  unlocked + selected boss skin IDs
save.ownedArenas / activeArena
save.items                    {oca, daedalus, desolator, moonshard, aghanims, octarine, midas}
save.cardSlots                active card IDs [slot0, slot1, slot2]
save.cardCollection           ownership/rarity per card ID
save.cardMastery              {cardId: {tier, runs, maxCombo, ...}}
save.ocaTickets               {standard, premium, elite} free pull counts
save.cloudPlayerId
```

## Shop Items (`SHOP_DEF`)

Economy target: ~250 coins per 60-second round. Lv1 ≈ 15–20 rounds to afford; Lv5 ≈ 4–8.5 hours total.

| Item | Effect |
|------|--------|
| **OCA** | Gacha token (consumable) |
| **RNGESUS** | Crit chance & multiplier (Lv5: 50% crit, 5× mult) |
| **DE-SO-LATER** | Flat damage bonus (Lv5: +200%) |
| **METH SHARD** | Multi-hit chance (Lv5: 65% triple hit) |
| **BUFF STICK** | Overdrive damage (Lv5: +250%) |
| **TIME SKIP CORE** | Overdrive duration (Lv5: +22 s) |
| **STONKS HAND** | Coin multiplier (Lv5: +75%) |

## Card System

**90 cards** across 4 rarities:

| Rarity | Count | Gacha weight |
|--------|-------|-------------|
| Standard | 23 | 65% |
| Premium | 26 | 20% |
| Elite | 22 | 13% |
| Mythic | 19 | 2% |

**Mastery tiers:** 0 (base) → 1 → 2 → 3 (max), tracked in `save.cardMastery[cardId].tier`. Advancement is based on runs completed and max combo achieved with that card.

## Key Conventions

- **Language**: UI strings and in-code comments are in Thai. Maintain this.
- **No runtime dependencies**: Do not introduce npm packages beyond Vite (devDependency only), CDN imports, or external frameworks.
- **Performance-sensitive paths**: The tap/hit handler runs on every touch event. Avoid DOM queries, allocations, or layout-triggering reads inside it. Use the existing object pools for particles.
- **Shop balancing**: Keep new items within the ~250 coins/round economy described above.
- **CSS**: Lives in `src/styles.css`. Use CSS custom properties and `transform`/`opacity` for animations. The layout uses `contain: layout paint` and `will-change` on animated elements.
- **window bridge**: During Stage 2A/2B, globals that inline `onclick` attributes reference must remain on `window`. Do not remove `window.X = X` exports without updating all callers in `index.html`.
- **Vite base path**: `vite.config.js` sets `base: './'` for GitHub Pages subpath compatibility. All asset references in code must be relative or use the Vite asset import system.
