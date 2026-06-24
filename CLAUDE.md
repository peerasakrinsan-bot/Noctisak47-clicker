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
npm run smoke        # headless smoke check (mode-select + Boss Loop Hero wiring)
npm run card-audit   # static integrity audit of normal-mode CARD_POOL (no browser)
npm run card-vfx-audit # integrity audit of the Elite/Mythic card VFX layer (no browser)
```

For mobile testing, use browser DevTools device emulation or connect a real device on the same local network.

There are no automated browser tests or linters. CI runs `npm run card-audit && npm run build && npm run smoke` (see `.github/workflows/smoke.yml`).

## Architecture

### File layout

```
index.html              # HTML shell; loads src/styles.css and src/main.js
src/
  main.js               # ES module entry point; imports game.js → cardVfx.js → bossLoopHero.js
  game.js               # All core game logic (~10,385 lines) — Stage 2A verbatim lift
  bossLoopHero.js       # Boss Loop Hero / Loop RPG mode (~3,656 lines) — independent module
  cardVfx.js            # Elite/Mythic card VFX layer (~392 lines) — cosmetic, normal mode only
  styles.css            # All game styles (~4,617 lines)
public/
  sw.js                 # Service Worker (copied verbatim to dist/)
  manifest.json         # PWA manifest
  cards/                # 90 card artwork PNGs
  *.png / *.mp3 / ...   # ~94 other static assets (sprites, audio, icons)
scripts/
  postbuild-sw.js       # Post-build: injects hashed bundle paths into dist/sw.js
  smoke-blh.mjs         # Headless smoke test for mode-select + BLH wiring (Node only)
  card-audit.mjs        # Static CARD_POOL integrity audit (npm run card-audit)
  card-vfx-audit.mjs    # Elite/Mythic VFX layer integrity audit (npm run card-vfx-audit)
vite.config.js          # base: './', outDir: 'dist/', minify: false (Stage 2A)
.github/workflows/
  smoke.yml             # CI: card-audit + build + smoke on every push / PR
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
       appends a build tag to CACHE_NAME (e.g. noctisak47-2026.06.24.2-abc123)
```

The post-build step is required for the service worker to cache the hashed Vite bundles correctly; skipping it breaks offline mode.

### CI / Smoke testing

`.github/workflows/smoke.yml` runs on every push and pull request:

1. Checkout → Node 20 → `npm ci`
2. `npm run card-audit` — static `CARD_POOL` integrity audit (`scripts/card-audit.mjs`)
3. `npm run build` (Vite + postbuild-sw)
4. `npm run smoke` — executes `scripts/smoke-blh.mjs` against a minimal DOM stub

The smoke script verifies:
- Mode Select opens from the PLAY entrypoint (`window.blhOpenModeSelect`)
- Classic Mode still calls the original `window.startGame()`
- Boss Loop Hero path: hero → stage → lobby → run actually starts
- Loop Zeny lives in its own localStorage key (economy isolation)

The smoke script does **not** exercise gameplay timers or balance — it only confirms wiring.

The **card audit** (`npm run card-audit`) is a static guard over `CARD_POOL` in `src/game.js` (no browser). It asserts: every card has a unique id + valid rarity; every artwork file exists under `public/`; every card's `apply(s)` sets ≥1 `cs_*` effect flag; every `cs_*` flag a card sets is actually read by game logic (no dead effects); every rarity tier is reachable from the gacha drop weights; and Elite/Mythic counts match the documented collection size. It exits non-zero on the first failed assertion.

The **card VFX audit** (`npm run card-vfx-audit`, not yet wired into CI) guards `src/cardVfx.js`: every Elite/Mythic card has a `VFX_MAP` entry (and no orphan mappings), auras/contexts use known primitives, the helper no-ops when DOM targets are missing, unknown ids don't throw, reduced-motion is honored, and the layer never touches card logic (`save` / `cs_*` writes).

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
| `SHOP_DEF` (line 56) | 7 shop items (OCA, RNGESUS, DE-SO-LATER, METH SHARD, BUFF STICK, TIME SKIP CORE, STONKS HAND), each with 5 upgrade levels |
| `GOD_LEVELS` (line 1143) | 4 entries (index 0 = idle; 1–3 = active tiers): NOCTIS OVERDRIVE (5× dmg, 10 s), OVERDRIVE BURST (8× dmg, 6 s), ANNIHILATION MODE (12× dmg, 4 s) |
| `BOSS_SKINS` (line 1397) | 10 purchasable boss skins |
| `ARENA_SKINS` (line 1633) | 3 purchasable arena backgrounds |
| `CARD_POOL` (line 2396) | 90-card definitions across 4 rarities |
| Sound system | Web Audio API (`AudioContext`) for SFX; `<audio>` elements for BGM (`fight1-4.mp3`) |
| `save` object | All player state — coins, cards, items, skins, arenas — persisted to `localStorage` and synced to cloud (Supabase) |
| Hit/damage loop | Tap zones, weak-point detection, crit/overdrive multipliers, card bonuses |
| Card system | 90 cards across 4 rarities. Mastery tracked via `save.cardRuns` (run count per card). |
| Particle system | Object-pooled particles, rings, and break impacts — do not increase per-hit particle counts |
| PRESSURE/BREAK (line 5963) | Rage-meter survival system: buildup → BREAK target mini-game → rewards/fail-rage |
| AK47 system (line ~1808) | Sequential 5-round weak-point chain with safe-spawn layout algorithm (`wpRound`/`wpCollected` state) |
| Daily reward system | 7-day streak with 06:00 rollover; state in `save.dailyQuest` |
| Weekly challenge | 3 progressive tiers reset every Monday 06:00; state in `save.weeklyChallenge` |
| Supabase cloud save (line 406) | Cloud save URL and anon key; upsert/download against `cloud_saves` table |
| Card mastery (line 10261) | `CM_TIER` constants, `cmRecordRun`, `cmShowEvolutionReveal` |
| Card VFX hooks | `CardVFX.setActiveCard` / `clearActive` / `trigger` calls fired from existing mechanic hooks (BREAK, AK47, OD, etc.) — see `src/cardVfx.js` |
| Window bridge (line 10359) | `Object.assign(window, {...})` — exposes game functions for inline `onclick` in index.html |

### Loop RPG Mode (`src/bossLoopHero.js`)

An **independent** auto-battle mode (user-facing name: **LOOP RPG MODE**; internal code/state still uses the `blh` / `BLH` prefix for stability). It shares the same host page but is fully isolated from the core game:

- **State**: `BLH.run` / `BLH.save` (not the core `save` object)
- **Economy**: Loop Zeny — stored separately, does **not** touch `save.coins`
- **Storage key**: `noctisak47_blh` (separate from `noctisak47_v3`)
- **DOM**: all screens created dynamically inside `#blhRoot` (full-screen overlay) — never touches core game DOM
- **Entry**: PLAY → Mode Select screen (`window.blhOpenModeSelect`); exiting returns to `window.showMainMenu()`
- **Architecture**: fully data-driven configs (stage pool, boss pool, enemy pool, gear, Arena Training upgrades, perk pools) — add content by extending config arrays, not engine code
- `BLH_DEV` flag: exposes `blh.__test` debug hook on `localhost`/`127.0.0.1`/`file:` only; hidden in production

**Style labels (no class/job names shown):** NOCTISAK47 = *Shadow Striker*, TOEI = *Holy Guard*, APOLOGIZE = *Iron Fist*.

**Stat model (spec, Ragnarok-inspired):** each hero has base stats `STR/VIT/AGI/DEX/LUK/INT` (`HEROES[].base`). `deriveCombat(base, addCombat)` maps them to combat stats `ATK/DEF/HP/ASPD/CRI/CRIDMG/EVA/LS/PEN` (+`hitBonus`, `healEffect`, `terrainEffect`, `damageReduction`, `extraHit`), then applies `STAT_CAPS` (crit 50%, crit dmg 250%, eva 35%, lifesteal 20%, armorPen 40 flat). Spec stat rules: STR +1 ATK & +5% crit dmg/5; VIT +8 HP & +1 DEF/5; AGI +1.5% ASPD & +2% dodge/5; DEX +1% hit & +3 PEN/5; LUK +0.8% crit & +1% dodge/5; INT +1% terrain & +3% heal/5. **Lifesteal is gear-only** (no stat grants it). Combat `resolveAttack(att, def)`: **unified hit/miss** (`hitChance = clamp(0.90 + hitBonus − targetDodge, 0.75, 0.98)`; specials set `noMiss`) → `effectiveDef = max(0, def − armorPen)` → `baseDamage = max(1, atk − effectiveDef)` → crit → execute → `capDmg` (special final-damage cap) → mitigations → lifesteal (heal-cap 15% HP normal / 20% special).

**Hero passives (spec, run/battle-only — `HERO_PASSIVES`):** auto-fire in combat off a per-battle `hitStreak` (only landed normal hits count). NOCTISAK47 **Overdrive Shot** (every 5 hits, never-miss special), TOEI **Power Punch** (every 4 hits charges the next attack into a special + small shield), APOLOGIZE **Apology Counter** (base +18% dodge; on a dodge, never-miss counter). All specials can crit and obey per-hero final-damage caps.

**Perk system (run-only):** `HERO_PERKS[heroId]` = 8 perks/hero; effects live only in `run.perkMods` and vanish when the run ends. Triggered by loop count (`PERK_LOOP_TRIGGERS` = 3/6/9/12/15/18) and placement milestones (`PERK_BUILD_TRIGGERS` = 5/10/15 placed cards), stored as `run.perkPending`, resolved at Camp via a perk-choice overlay (3 random options, no repeats; the run pauses until chosen).

**Gear (5 slots): tier × rarity × traits (run-only).** `makeGear(run, ctx)` produces `{ slot, tier:1–4, rarity, mainStat, subStat, traits:[0–2] }` for Weapon/Glove/Jacket/Boots/Charm. **Tier** comes from loop depth + enemy influence (`rollGearTier`: Fighter/`fast` small boost, Elite strong boost, Treasure tier+rarity boost; Arena Training `higherTier` + treasure terrain bump). **Rarity** (Common/Rare/Epic/Legendary — *not* "Mythic") is weighted per tier (`RARITY_WEIGHTS`) and drives stat-roll quality (`rollMin/rollMax` % of tier range: Common 40–65% → Legendary 90–100%) plus trait chance. **Main** stat (1) is rolled at full quality; **sub** stat (1, never the same key) at ~40–60%. **Traits** (`GEAR_TRAITS`, 10 MVP: Blood Taste, Clean Escape, Heavy Grip, Quick Step, Lucky Find, Card Sense, Counter Guard, Last Stand, Iron Skin, Sharp Rhythm) roll per `TRAIT_CHANCE[tier][rarity]` — T1–2 max 1, T3–4 up to 2 distinct; Cursed enemies bias toward Charm + trait chance. Traits stack across gear and are capped per-trait in `aggregateTraits` → `run.traitMods`. Main/sub pools are `GEAR_MAIN_POOLS` / `GEAR_SUB_POOLS`; **Lifesteal is Charm-only** (still gear-only, no stat grants it). Run-only — all gear vanishes on run end / Cash Out.

**Economy (spec):** Camp heals base 20% max HP (cap 50% with bonuses, incl. Clean Escape trait); death keeps 30% Loop Zeny (Safe Retreat raises to max 50%); Cash Out auto-sells equipped + bag gear (trait shards add value) and converts leftover map cards to small Loop Zeny. Centralized in `SPEC_BAL`.

**Run EXP / level / stat allocation (run-only):** kills grant `ENEMY_EXP[role]`; `expToNext(lvl)=30+(lvl-1)²·18`; +2 points/level into `pendingStatPoints`. Allocation uses a **draft → confirm → locked** model (`draftRunStats` reversible, `confirmStats` commits into `confirmedRunStats` which alone affects combat and can't be refunded; `resetDraft`/presets operate on pending only). All reset on run end.

**Combat caps** (`STAT_CAPS`): crit 50%, crit dmg 250%, dodge 35%, lifesteal 20%, armorPen 40 (flat, unchanged), drop bonus +40%, attack-speed add +60. New `HIT` gear stat feeds `hitBonus` in `deriveCombat`.

**Local Danger (per-road, run-only):** each placed map tile carries a `danger` value (`MAP_CARDS[].danger`: 0–3, mapped to spec archetypes). `localDangerForRoad(cellId)` sums the road cell's own card + orthogonally-adjacent terrain cells' cards — danger is *local* (distant roads = 0). `localDangerScaling(d)` → `{steps:floor(d/5), hpMult:+5%/step, atkMult:+4%/step, zenyMult:+5%/step, gearDropBonus:+4%/step}` (`DANGER_BAL`). Applied at `startBattle` for normal encounters (scales enemy HP/ATK on top of the loop-depth scaling already baked into `makeEnemy`); `endBattle` grants the Zeny bonus and passes `gearDropBonus` into `rollDrops`' drop *chance*. **Danger raises quantity/reward only — never gear tier or rarity** (those stay loop-depth + enemy-type via `rollGearTier`/`rollGearRarity`, which ignore the danger fields). Shown in the MAP panel (peak danger + scaling) and as a per-road `⚠N` badge.

**Map-card hand stacking (run-only):** `run.hand` is ordered stack entries `[{cardId, count, order}]` limited by **card-type count** (`MAX_CARD_TYPES = 8`), not total cards. `addCardToHand` stacks duplicates (no overflow), adds new types under the cap, and at 8/8 evicts the oldest stack (lowest `order`) — converting it to Loop Zeny (`CARD_KIND_ZENY`: road 2 / adjacent 3 / terrain 4 per card) via `run.mods.zenyBonus`, with a toast. Placing consumes one via `consumeCardFromHand` (stack 0 removes the type); failed placement consumes nothing. `handZeny(run)` (folded into `estCashOut`) converts remaining stacks on Cash Out. All run-only — hand clears on run end.

**Gear bag cap + overflow auto-salvage (run-only):** `run.lootBag` is capped at `bagCap()` = `BASE_BAG (12)` + Arena Training `bagExpand` (+2/level, max 3 → 18). On a gear drop (`rollDrops`), the new piece is pushed, then `enforceBagCap` salvages the **oldest** bag piece(s) (index 0, oldest→newest) at `AUTO_SALVAGE_PCT` (40%) of `gearWorth` into `run.mods.zenyBonus`, with a toast (stronger warning for Epic/Legendary). Equipped gear (`run.gear`) is never auto-salvaged. Manual `sellLoot(idx)` pays 100% of `gearWorth`. Cash Out still values bag ×1 + equipped ×2 (`lootValue`). All run-only.

**Deferred to follow-up:** none — the original Boss Loop Mode spec backlog is complete.

`src/main.js` imports in order: `game.js` → `cardVfx.js` → `bossLoopHero.js`. `cardVfx.js` loads after `game.js` so `window.CardVFX` exists before the game's hooks call it; `bossLoopHero.js` loads last so the window bridge (`startGame`, `showMainMenu`, `stopBGM`) is populated before BLH binds its entry points.

### Elite/Mythic Card VFX (`src/cardVfx.js`)

A small, **self-contained, purely cosmetic** visual-feedback layer for normal/clicker mode only. It gives every Elite and Mythic card a recognizable look when its real mechanic fires. It **never reads or writes card logic, `save`, `cs_*` flags, or balance**, and is safe to call from anywhere (no-ops if a DOM target is missing or `prefers-reduced-motion` is set).

- **Public API (the only entry points `game.js` uses):**
  - `CardVFX.setActiveCard(id, rarity)` — on run start; sets a persistent card aura
  - `CardVFX.clearActive()` — on run end; clears the aura
  - `CardVFX.trigger(id, context, ctx)` — when a card's mechanic activates
- **Wiring** lives at existing mechanic hooks (BREAK success, AK47 complete, Overdrive start, Drake Take, Thanatos Phase, boss interactions, Doppelganger shadow strike, Abyssmell execute). Passive-damage cards get the aura only — **no per-hit particle spam** (mobile-safe brief).
- **DOM**: renders into its own `#cardVfxLayer` (separate from the game's `#fxLayer`) with a minimal node pool; never touches the core particle pools.
- Guarded by `scripts/card-vfx-audit.mjs` (`npm run card-vfx-audit`).

### Game screen IDs

All screens are children of `#gameRoot` (position: fixed, 100vw/100vh):

| ID | Purpose |
|----|---------|
| `mainMenu` | Title / main menu (includes Mode Select button) |
| `shopScreen` | Shop / upgrades |
| `bossScreen` | Boss skin shop |
| `arenaScreen` | Arena skin shop |
| `cardCollectionScreen` | Card collection / dex + OCA tickets |
| `cardSlotScreen` | Active card slot selection (pre-run) |
| `cardDrawScreen` | Card draw / gacha animation |
| `resultScreen` | Round-end results |
| `pauseScreen` | Pause menu + settings |
| `rewardsModal` | Daily + weekly rewards hub |
| `dailyQuestWidget` | Persistent HUD widget (opens rewardsModal) |
| `saveModal` | Cloud save / load / reset |
| `bossSkinModal` | Boss skin preview popup |
| `cardModal` | Card detail popup |
| `ocaConfirmModal` | Confirm card draw |
| `rerollConfirmModal` | Confirm card slot reroll |
| `#blhRoot` | Boss Loop Hero mode overlay (created by `bossLoopHero.js`) |

## Releasing / Version Bumping

When making any change that players will receive, update the version string in **three places** to bust the Service Worker cache:

1. `index.html` (~line 19): `window.NOCTISAK47_APP_VERSION = '2026.06.24.2'`
2. `index.html` manifest link: `<link rel="manifest" href="/manifest.json?v=2026.06.24.2">`
3. `public/sw.js` (~line 2): `const APP_VERSION = '2026.06.24.2'`

Version format: `YYYY.MM.DD.n` (n = daily increment, starting at 1).

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `noctisak47_v3` | Main save data (coins, stats, cards, items, mastery) |
| `noctis_settings` | Settings: music/SFX on/off, volumes, flashEffect |
| `noctisak47_device_id` | Unique device UUID |
| `noctisak47_pending_sync` | Cloud sync payload queued for upload |
| `noctisak47_cloud` | Cloud player `{id, key}` |
| `noctisak47_cloud_lock` | Lock token preventing concurrent cloud sync |
| `noctisak47_app_version` | Cached version string for update detection |
| `noctisak47_version_reload_done` | Flag preventing reload loops on version change |
| `noctisak47_blh` | Boss Loop Hero mode save (BLH economy + progress, isolated) |

Schema changes to the save object require a migration guard on load to avoid wiping existing saves. The key `noctisak47_v3` already implies two prior schema migrations.

## Save Object Shape

```
save.coins                    current currency
save.stats                    {highScore, totalKO, maxCombo}
save.gamesCompleted           total run count
save.ownedSkins / activeSkin  unlocked + selected boss skin IDs
save.ownedArenas / activeArena
save.items                    {oca, daedalus, desolator, moonshard, aghanims, octarine, midas}
save.unlockedCards            array of owned card IDs
save.savedCards               persisted pre-run card slot selection [id, id, id] | null
save.cardRuns                 {[cardId]: runCount} — drives card mastery tier
save.ocaTickets               {standard, premium, elite} free pull ticket counts
save.dailyQuest               {weekKey, streak, lastClaimDate, claimed:[]} — daily reward state
save.weeklyChallenge          {weekId, runsCompleted, totalKO, breakSuccess, ak47Complete, claimed:{tier1,tier2,tier3}}
save.preRunState              {sessionId, rerollCount} | null — persists reroll cost between screens
save.cloudPlayerId
save.saveVersion              schema version integer
save.updatedAt / deviceId / lastRunId   metadata for cloud sync conflict resolution
```

## Card Mastery System

Mastery is tracked via `save.cardRuns[cardId]` (integer run count, incremented by `cmRecordRun` at end of each run, `game.js:10250`).

| Tier | Constant | Threshold | Visual |
|------|----------|-----------|--------|
| Normal | `CM_TIER.NORMAL` | < 10 runs | no effect |
| Glossy | `CM_TIER.GLOSSY` | ≥ 10 runs | `.cm-glossy-wrap` CSS class |
| Prismatic | `CM_TIER.PRISMATIC` | ≥ 30 runs | `.cm-prismatic-wrap` CSS class |

`cmShowEvolutionReveal()` (`game.js:10303`) fires a toast overlay when a card evolves tier at the end of a run.

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

Card IDs use a short 2-letter abbreviation (e.g. `po`, `lu`). A legacy `_MIGRATE_ID` map converts old long IDs to the short form on save load.

## Boss Skins (`BOSS_SKINS`)

10 purchasable skins — each has `id`, `name`, `icon`, `cost`, and `files: {idle, hits[]}`:

| ID | Name | Cost |
|----|------|------|
| `default` | NOCTISAK47 | 0 |
| `toei_boxer` | TOEI | 1,500 |
| `apologize` | APOLOGIZE | 1,500 |
| `xuang` | XUANG | 3,000 |
| `jakkadun` | JAKKADUN | varies |
| `sornsit_spirit` | SORNSIT SPIRIT | varies |
| `rukawa` | RUKAWA | varies |
| `suang` | SUANG | varies |
| `morgan` | ARTHUR MORGAN | varies |
| `toei` | TOEI (ENIGMA) | varies |

## Arena Skins (`ARENA_SKINS`)

3 purchasable arenas — each has `id`, `name`, `preview`, `bg`, `cost`:

| ID | Name | Cost |
|----|------|------|
| `default` | RAJADAMNERN STADIUM | 0 |
| `one_championship` | ONE CHAMPIONSHIP | 500 |
| `colosseum` | COLOSSEUM | 500 |

## Overdrive (`GOD_LEVELS`)

3 overdrive tiers triggered by filling the OD bar (index 0 is idle/off):

| Level | Name | Damage Mult | Duration |
|-------|------|-------------|----------|
| 1 | NOCTIS OVERDRIVE | 5× | 10 s |
| 2 | OVERDRIVE BURST | 8× | 6 s |
| 3 | ANNIHILATION MODE | 12× | 4 s |

## PRESSURE / BREAK System

Rage-meter mini-game that activates during combat (`PRESSURE` object, `game.js:5946`):

- **Buildup phase**: rage meter fills over time; escalating aura FX
- **BREAK phase**: a tappable `#breakTarget` appears with a short window (2.75–3.1 s scaled by `PRESSURE_BREAK_TABLE` at `game.js:5973`); player must hit it to succeed
- **Success**: grants score/coin rewards + clears rage; `save.weeklyChallenge.breakSuccess` incremented
- **Fail**: rage spikes via `PRESSURE_FAIL_RAGE_TABLE` (`game.js:5981`); subsequent BREAKs harder

## AK47 System

Sequential 5-round weak-point chain (`game.js:1883`):

- Rounds spawn in order WP 1 → 5; position chosen by a safe-spawn algorithm that avoids overlapping the previous position
- Collecting all 5 triggers **AK47 BOMB** with coin/score bonuses; `save.weeklyChallenge.ak47Complete` incremented
- Several cards modify spawn speed, visible time, duplicate chance, and reward size

## Daily & Weekly Rewards

- **Daily**: 7-day streak; day rolls over at 06:00 (not midnight). State in `save.dailyQuest`. Widget: `#dailyQuestWidget` → opens `#rewardsModal`.
- **Weekly challenge** (3 tiers, resets Monday 06:00):
  - Tier I: 5 runs → PREMIUM OCA ×2 + 1,000 ZENY
  - Tier II: 3,000 total KO → PREMIUM OCA ×3 + 3,000 ZENY
  - Tier III: 40 BREAK successes + 60 AK47 completes → ELITE OCA ×1 + PREMIUM OCA ×3 + 5,000 ZENY

## Cloud Save (Supabase)

The cloud save backend is **Supabase** (table `cloud_saves`, columns `player_id`, `secret_key`, `save_data`, `uploaded_at`). The anon key and URL are embedded in `src/game.js:406`. Save/load flow:

- Player sets a custom `PLAYER_ID` (A-Z, 0-9, `_`); system auto-generates an 8-char alphanumeric `secret_key`
- Upload: upsert to Supabase; lock via `noctisak47_cloud_lock` to prevent concurrent writes
- Download: match `player_id` + `secret_key`; overwrites local save after confirmation
- Pending uploads are queued in `noctisak47_pending_sync` and retried on next `window.online` event

## Key Conventions

- **Language**: UI strings and in-code comments are in Thai. Maintain this.
- **Minimal dependencies**: The only build dependency is Vite (devDependency). The only runtime dependency is `@vercel/analytics` (declared in `package.json`; not a gameplay framework). Do not introduce additional npm packages, CDN imports, or external game frameworks — keep the game itself vanilla JS.
- **Performance-sensitive paths**: The tap/hit handler runs on every touch event. Avoid DOM queries, allocations, or layout-triggering reads inside it. Use the existing object pools for particles.
- **Shop balancing**: Keep new items within the ~250 coins/round economy described above.
- **CSS**: Lives in `src/styles.css`. Use CSS custom properties and `transform`/`opacity` for animations. The layout uses `contain: layout paint` and `will-change` on animated elements.
- **window bridge**: During Stage 2A/2B, globals that inline `onclick` attributes reference must remain on `window`. The bridge is the `Object.assign(window, {...})` block at `game.js:10328`. Do not remove entries without updating all callers in `index.html`.
- **Vite base path**: `vite.config.js` sets `base: './'` for GitHub Pages subpath compatibility. All asset references in code must be relative or use the Vite asset import system.
- **Save schema migrations**: Any new field added to the save object must be seeded in both `defaultSave()` and `normalizeSaveData()` with a safe default, so existing saves load without breakage.
- **Version bumps required**: Every deploy that changes game behavior must update the version string in all three locations (see Releasing section above).
- **Boss Loop Hero isolation**: `bossLoopHero.js` must never read or write `save` (core save object) or `noctisak47_v3`. Its own persistence key is `noctisak47_blh`. It interacts with the core only through the `window` bridge (`showMainMenu`, `startGame`, `stopBGM`).
- **Smoke test**: `npm run smoke` must stay green after any change that touches mode-select wiring, BLH entry/exit flow, or the window bridge. Run it locally before pushing.
- **Interaction hardening** (`src/main.js`): `dragstart` and `contextmenu` are suppressed on game visual elements to prevent drag-ghost and long-press save-image dialogs on mobile/desktop. Do not remove these listeners.
