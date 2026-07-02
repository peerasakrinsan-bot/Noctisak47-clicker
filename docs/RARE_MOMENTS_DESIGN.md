# RARE MOMENTS — Design Document

**Game:** NOCTISAK47: OVERDRIVE RAMPAGE
**Role:** Lead Arcade Game Designer
**Status:** Design (no code in this document is final; `src/game.js` is authoritative once implemented)

---

## 1. Design Philosophy

NOCTISAK47 is a 60-second score attack. A player defeats hundreds — sometimes thousands — of enemies per run. The core loop is already fast, flashy, chaotic, and satisfying. Rare Moments do **not** add gameplay; they add **memory**.

The target emotion is the arcade "OH!" — the moment a player grabs the phone tighter, laughs, or shows the screen to a friend. Every Rare Moment must:

- **Happen naturally** — triggered by things the player is already doing (KOs, BREAKs, AK47 chains, combos, crits, the clock).
- **Be unexpected** — rare enough that seeing one feels like an event, common enough that most players see one within a handful of runs.
- **Read instantly** — one splash line + one visual beat. No tutorial, no explanation, no menu.
- **Last seconds** — 0.5–5 s. Never pauses, never blocks input, never interrupts the tap loop.
- **Reuse what exists** — `showBigSplash`, `triggerFlash`, `cameraClaim` shake, the Canvas VFX primitives (`coinBurst`, `jackpotFlash`, `glitch`, `moonRing`, `bolt`, `breakCrack`, …), the Golden Enemy pipeline, the Web-Audio SFX synth (pitch is free), the boss death/skill VFX layer, and the result screen. **Zero new art/audio assets in Phase 1.**

### What already exists (and what we build on)

The codebase already ships three proto-Rare-Moments — proof the pattern fits the game:

| Existing feature | Location | Lesson |
|---|---|---|
| **Golden Enemy** (3% roll, ×4 coins, +300 score, `.golden-enemy` tint, `GOLDEN KO!` splash) | `game.js:1857`, `_rollGoldenEnemy` at `game.js:9273` | Players already understand "gold = lucky". We extend this language upward (Golden Boss, Golden Streak, Golden Magazine) instead of inventing a second luck vocabulary. |
| **KO Rampage Milestones** (per-run thresholds → splash + flash + shake + ding) | `_checkKoMilestone` at `game.js:9288` | The safe celebration template: `try/catch`-wrapped, `cameraClaim(2,…)` so it never steals a climactic beat, reuses existing SFX. Every new Rare Moment copies this skeleton. |
| **Boss death VFX + boss skill VFX** (per-skin signature moments) | `_triggerBossDeathVfx` at `game.js:9494`, `BOSS_VFX` in `canvasVfx.js` | The metadata-driven cosmetic-layer pattern (`VFX_MAP` / `BOSS_VFX`) is the right shape for a `RARE_MOMENTS` table. |

### Global rules (apply to every moment below)

1. **One headline moment at a time.** All Rare Moments route through a single `rareMoment(id)` dispatcher with a global cooldown (~4 s) and `cameraClaim` priority 2 (below prio-3 climaxes: boss death, AK47 bomb, NEW RECORD). If two fire on the same tick, the higher-ranked one wins; the loser is silently dropped — never queued.
2. **Per-run caps.** Every rolled (chance-based) moment fires **at most once per run**. Skill/threshold moments (Buzzer Beater, Flawless Reload) are naturally self-limiting.
3. **Hot-path safety.** No Rare Moment condition is evaluated inside the per-tap hit handler. All checks live at existing low-frequency events: `normalKO`/`bossKO`, BREAK resolve, AK47 chain complete, OD activation, run end. No allocations, no DOM queries beyond the cached nodes those paths already touch.
4. **Cosmetic isolation.** Phase 1 moments never write `save`, never touch `cs_*` flags, never alter score/coins/timers. Wrapped in `try/catch` like `_checkKoMilestone` — a cosmetic must never break the game.
5. **Accessibility.** Everything respects the existing `prefers-reduced-motion` and `reduce-flash` paths; audio gags respect the SFX mute setting.
6. **Rarity tuning assumption:** a typical run ≈ 200–1000 KOs ≈ 20–100 bosses. All percentages below are tuned so a headline moment appears roughly **once every 3–8 runs**, and small moments roughly **once per 1–3 runs**. All rates live in one `RARE_MOMENTS` constants table for one-line tuning.

---

## 2. Top 20 Rare Moments (ranked)

Format per entry: **Name** · Trigger · Rarity · Duration · Reaction · Reuses · New code · Risk · Affects gameplay.

---

### #1 — GOLDEN BOSS (บอสทองคำ)
- **Trigger:** On `spawnBoss()`, roll 0.5% (hard cap: once per run). Boss spawns with the existing `.golden-enemy` gold tint + a gold `bossArrival` banner ("GOLDEN BOSS INCOMING").
- **Rarity:** ~1 in 200 boss spawns → roughly 1 in every 4–8 runs.
- **Duration:** The boss fight itself (a few seconds); KO payoff beat ~1.5 s.
- **Player reaction:** "GOLD BOSS?! KILL IT KILL IT" — instant greed spike, frantic tapping.
- **Reuses:** `.golden-enemy` CSS class, `bossArrival` banner, `GOLDEN KO!` splash language, `coinBurst` canvas primitive, `playWpBall` ding, `spawnCoinPopup`.
- **New code:** Low (one roll in `spawnBoss`, one flag read in `bossKO`).
- **Risk:** Low. Phase 2 reward variant needs one balance pass (see roadmap).
- **Affects gameplay:** No in Phase 1 (pure spectacle + score confetti). Phase 2 variant: boss KO coins ×3 on this boss only — reward-quantity only, same enemy, same HP.

### #2 — BUZZER BEATER (KO เสียงระฆัง)
- **Trigger:** Boss KO lands with ≤ 0.7 s left on the run timer.
- **Rarity:** Natural (no roll) — pure timing luck; a few percent of runs.
- **Duration:** ~1.2 s, overlapping the run-end transition into the result screen.
- **Player reaction:** "NOOO— YES!!" — the basketball buzzer-beater feeling; the single most screenshot-able beat in the game.
- **Reuses:** `showBigSplash('BUZZER BEATER!', …, '#ffcc00', true)`, `triggerFlash('flash-boss')`, `cameraClaim(2,…)` shake, `playWpBall`; result screen shows a small "BUZZER BEATER" line (existing result-screen text nodes).
- **New code:** Low (one timestamp comparison in `bossKO`, one string on the result screen).
- **Risk:** Very low.
- **Affects gameplay:** No.

### #3 — FLAWLESS RELOAD (โหลดแม็กเทพ)
- **Trigger:** AK47 5-round weak-point chain completed with zero misses **and** total chain time under a tight threshold (~2.5 s, tuned from live WP timing).
- **Rarity:** Natural skill+luck; rare early, a badge of mastery late. No roll.
- **Duration:** ~1.5 s layered on top of the existing AK47 BOMB explosion.
- **Player reaction:** "I'm HIM." — pride moment; makes the AK47 chain feel like an execution rather than a collection task.
- **Reuses:** `triggerBombExplosion` (already the climax), `showBigSplash('FLAWLESS RELOAD', 'AK47 PERFECT CHAIN', gold)`, `bolt` + `streak` canvas primitives, existing AK47 SFX (`playAK`) fired as a fast triple-tap flourish.
- **New code:** Low (chain-start timestamp + miss flag already implied by `wpRound`/`wpCollected` state).
- **Risk:** Low. Tune the time threshold so it's genuinely rare (< 5% of chains).
- **Affects gameplay:** No.

### #4 — SQUEAKY GLOVE (นวมบีบเสียงเป็ด)
- **Trigger:** On a normal KO, roll 0.15% (cap: once per run). For the next ~2.5 s every punch SFX plays pitched up ~1.7× (chipmunk register) and hit numbers render in a bubbly pastel style.
- **Rarity:** ~1 in 700 KOs → roughly 1 in every 2–5 runs.
- **Duration:** 2.5 s.
- **Player reaction:** Laughter. The pure "I didn't expect THAT" comedy beat — breaks the intensity for two seconds, then the game snaps back.
- **Reuses:** The Web Audio SFX synth (`playPunch` etc. — pitch/rate is a free parameter, **zero new audio assets**), the pooled hit-number nodes (one extra CSS class).
- **New code:** Low (a global pitch-multiplier variable read by the existing SFX functions + one timeout).
- **Risk:** Low-medium: must respect SFX mute; must never stack with itself; comedy must stay ≤ 3 s so it can't wear out.
- **Affects gameplay:** No.

### #5 — INSTANT BREAK (สวนกลับสายฟ้า)
- **Trigger:** Player hits `#breakTarget` within the first 150 ms of the BREAK window.
- **Rarity:** Natural — reaction-time luck; a few percent of BREAKs.
- **Duration:** ~1 s layered on the normal BREAK success payoff.
- **Player reaction:** "Did you SEE that reaction time?!" — turns an already-good moment into a personal highlight.
- **Reuses:** `spawnBreakFX`, `breakCrack` + `bwave` canvas primitives (double-strength), `showBigSplash('INSTANT BREAK', 'REFLEX GOD', '#00ffee')`, existing BREAK success SFX.
- **New code:** Low (compare tap time vs. window-open timestamp already tracked by PRESSURE).
- **Risk:** Very low.
- **Affects gameplay:** No.

### #6 — RARE SPLASH LINES (สแปลชลับ)
- **Trigger:** 1% of the time, a common splash ("BOSS KO", "KO!", "GOLDEN KO!", KO milestones) swaps its text for a line from a small hidden pool — trash talk, Thai memes, fourth-wall winks (e.g. "BOSS KO" → "ไปนอนไป๊", "GET OUT OF MY RING", "แม่เรียกกินข้าว").
- **Rarity:** 1% per eligible splash → several sightings per session, but each *specific line* stays rare.
- **Duration:** Same as the splash it replaces (~1 s). Zero added screen time.
- **Player reaction:** "Wait— what did that just say?" — players start *reading* splashes again; lines get quoted in chat.
- **Reuses:** `showBigSplash` verbatim. Literally a string-pool lookup.
- **New code:** Low (a const array + one function wrapping the text choice).
- **Risk:** Very low. Keep the pool small (10–15 lines), tonally on-brand, in Thai per project convention.
- **Affects gameplay:** No.

### #7 — SHADOW BOSS (บอสกลิตช์)
- **Trigger:** On `spawnBoss()`, roll 0.4% (cap once per run, mutually exclusive with Golden Boss). Boss renders with the existing `corruptGlitch`/`glitch` canvas treatment + inverted-ish CSS filter; arrival banner shows "??? INCOMING" with glitched characters.
- **Rarity:** ~1 in 250 boss spawns → ~1 in 5–10 runs.
- **Duration:** The boss fight; glitch pulse fires on spawn and on its KO.
- **Player reaction:** "What IS that?!" — mystery variant; players screenshot it and ask each other if it means something.
- **Reuses:** `corruptGlitch`/`glitch` canvas primitives, `spawnBossGlitchPulse` from the Boss VFX layer, `bossArrival` banner, CSS filter on `#boxer`.
- **New code:** Low-medium (a spawn-variant flag + name scramble).
- **Risk:** Medium: CSS `filter` on the boss sprite must be cheap on low-end phones (use the same technique as `.golden-enemy`; test). Must respect `reduce-flash`.
- **Affects gameplay:** No (Phase 2 option: +small flat score on its KO).

### #8 — LUCKY 7s (แจ็คพอตคอมโบ)
- **Trigger:** Combo counter lands **exactly** on 77 (small beat) or 777 (headline beat) at the moment a hit registers.
- **Rarity:** 77 is common-ish (most decent runs); 777 is genuinely rare (deep combo runs only).
- **Duration:** 0.8 s (77) / 2 s (777).
- **Player reaction:** "777!!!" — slot-machine dopamine; retroactively makes the combo counter itself a thing to watch.
- **Reuses:** DARK STAKE LORD's `slotReel` + `jackpotFlash` + `suitSpark` canvas primitives (already built, currently card-exclusive), `bigCombo` DOM pulse, `playWpBall`.
- **New code:** Low (equality check where combo increments — already touched at milestone checks, not in the raw tap path).
- **Risk:** Low. Check must piggyback on the existing combo-milestone code path (`combo % 10` logic at `game.js:4677`), not add work per tap.
- **Affects gameplay:** No.

### #9 — GOLDEN STREAK (ทองซ้อนทอง)
- **Trigger:** Two Golden Enemies rolled back-to-back (existing 3% roll squared ≈ 0.09%).
- **Rarity:** ~1 in 1,100 KOs → about 1 in every 2–5 runs (long runs see it more — feels "earned").
- **Duration:** 3 s gold screen-edge aura while the second golden is alive.
- **Player reaction:** "TWO IN A ROW?!" — compounding luck; the moment the run starts feeling *blessed*.
- **Reuses:** The Golden Enemy roll (zero new randomness — just detect the sequence), `updateOdScreenAura`-style edge glow (gold recolor), `showBigSplash('GOLDEN STREAK!', 'ดวงเฮงซ้อนเฮง', '#ffd700')`, `coinBurst`.
- **New code:** Low (one "previous roll" boolean).
- **Risk:** Very low.
- **Affects gameplay:** No.

### #10 — CRIT STORM (พายุคริ)
- **Trigger:** 10 critical hits in a row (with RNGESUS Lv5's 50% crit ≈ 1/1024 per sequence start; cap once per run).
- **Rarity:** ~1 in 1–4 runs for maxed players; near-mythical for new players (their crit chance is lower — that's fine, it scales with investment).
- **Duration:** 1.5 s.
- **Player reaction:** "The RNG gods have chosen me."
- **Reuses:** `bolt` canvas primitive (red storm burst), the existing crit rim-light on the boss (brief intensified state), `showBigSplash('CRIT STORM', '10 CRITS IN A ROW', '#ff2233')`.
- **New code:** Low (a crit-streak counter incremented where crits already resolve).
- **Risk:** Low. Counter update is one integer op in an already-executing branch — acceptable in the hit path.
- **Affects gameplay:** No.

### #11 — RECORD OBLITERATED (ทำลายสถิติยับ)
- **Trigger:** Run ends with final score ≥ 2× previous high score (and previous high score ≥ some floor so first runs don't trivially fire it).
- **Rarity:** Natural — a handful of times across a player's life; most likely right after a big shop/card power-up.
- **Duration:** ~2.5 s on the result screen.
- **Player reaction:** "I didn't beat it. I *destroyed* it." — the NEW RECORD moment, but mythic.
- **Reuses:** The existing `NEW RECORD!` splash slot (`game.js:9522`) upgraded: `showBigSplash('OBLITERATED!', …)`, ANNIHILATION-tier flash + `cameraClaim(3,…)` shake, `holyBurst` canvas primitive on the score line.
- **New code:** Low (one comparison where NEW RECORD already resolves).
- **Risk:** Very low.
- **Affects gameplay:** No.

### #12 — FLAWLESS RAMPAGE (จบเกมไร้ตำหนิ)
- **Trigger:** Run ends with **zero** WP misses and **zero** BREAK fails (min. 3 BREAKs + 3 AK47 chains attempted, so it can't fire on passive runs).
- **Rarity:** Natural mastery gate — rare for everyone, chased by good players.
- **Duration:** Result-screen stamp + 1.5 s shine sweep. Never touches live gameplay.
- **Player reaction:** "Perfect game." — the moment gets screenshotted next to the score.
- **Reuses:** Result screen DOM, `holyBurst`, the card-mastery `.cm-glossy-wrap` shine CSS technique for the stamp.
- **New code:** Low-medium (two per-run fail counters — WP miss is already surfaced via `showWpMissPenalty`, BREAK fail via PRESSURE fail path — plus result-screen node).
- **Risk:** Low.
- **Affects gameplay:** No.

### #13 — INSTANT DELETE (ลบทิ้งไม่ถึงวิ)
- **Trigger:** A boss dies within 1.5 s of spawning.
- **Rarity:** Natural — needs OD Lv3 + crit luck lined up with a boss spawn; late-run mostly.
- **Duration:** ~1 s.
- **Player reaction:** "He didn't even get to exist." — power-fantasy punctuation.
- **Reuses:** `glitch` canvas primitive on the boss death, `showBigSplash('DELETED', 'BOSS ERASED IN ' + t + 's', '#ff3355')`, existing `_triggerBossDeathVfx` (this rides on top).
- **New code:** Low (boss-spawn timestamp already implied by DEVILINGO's `_devilingoCombatStart` pattern at `game.js:9362` — same technique, cosmetic-only).
- **Risk:** Very low.
- **Affects gameplay:** No.

### #14 — BLOOD MOON RUN (คืนจันทร์เลือด)
- **Trigger:** At run start, roll 1.5%. The whole 60 s run gets a subtle crimson-night grade: dark vignette, `moonRing`/`eclipseRing` rises behind the boss on spawn, BGM plays slightly detuned/darker (playbackRate ~0.96 on the existing `<audio>` fight track).
- **Rarity:** ~1 in 67 runs.
- **Duration:** The full run (mood, not effect spam — one grade + one moon, then it stays out of the way).
- **Player reaction:** "…the vibe is different this run." → "OH it's a blood moon run!" — the *run itself* becomes the rare event; players start runs hoping for it.
- **Reuses:** MOONLIGHT FEVER's `moonRing`/`eclipseRing`/`moonPulse` primitives, a CSS overlay in the same spirit as `odScreenAura`, existing BGM element (`playbackRate` is free).
- **New code:** Medium (run-scoped cosmetic state + enter/exit cleanup on run end/pause).
- **Risk:** Medium: a full-run tint must not hurt readability of WPs/BREAK target — keep the grade subtle and test on OLED-dim phones. `playbackRate` on `<audio>` is safe but must reset on run end.
- **Affects gameplay:** No in Phase 1. **Phase 2 variant:** Golden Enemy chance ×3 for this run only (luck-quantity, no new mechanic — the moon *causes* gold, a clean fantasy).

### #15 — COMBO INFERNO (คอมโบลุกไหม้)
- **Trigger:** Per-run combo reaches 500.
- **Rarity:** Natural — deep, decay-protected combo runs only.
- **Duration:** Edge-of-screen flame aura pulses for 3 s, then a calm ember tint on the combo counter while combo stays ≥ 500.
- **Player reaction:** "My combo counter is on FIRE." — makes protecting the combo an emotional stake, not just a multiplier.
- **Reuses:** `odScreenAura` technique (fire recolor), IFRIED's `fireBurst` primitive (one burst, no loop), `bigCombo` CSS state class.
- **New code:** Low (threshold check inside the existing combo milestone path).
- **Risk:** Low — the persistent state must be a static CSS class (no animation loop) per the performance conventions.
- **Affects gameplay:** No.

### #16 — GOLDEN MAGAZINE (แม็กกาซีนทองคำ)
- **Trigger:** On AK47 chain start, roll 1% (cap once per run): all 5 WPs render gold this chain.
- **Rarity:** ~1 in 100 chains → ~1 in 3–10 runs.
- **Duration:** One AK47 chain (~a few seconds).
- **Player reaction:** "Golden bullets?! Don't miss, don't miss—" — instant self-imposed stakes.
- **Reuses:** `.golden-enemy` gold-tint technique on WP nodes, `coinBurst` on completion, `GOLDEN` splash language, existing AK47 SFX.
- **New code:** Low-medium (chain-scoped flag + WP style variant).
- **Risk:** Low. WPs must stay clearly visible — gold on dark arenas reads fine (already proven by golden enemies).
- **Affects gameplay:** No in Phase 1. Phase 2 variant: completing the golden chain doubles the AK47 bomb's *coin* payout (quantity-only).

### #17 — THE DROP (เพลงดรอป)
- **Trigger:** On Overdrive Lv3 (ANNIHILATION MODE) activation, roll 8%: BGM ducks to near-silence for ~400 ms, then slams back at full volume exactly as the annihilation flash lands.
- **Rarity:** OD Lv3 is already rare; ×8% ≈ a few times per session for strong players.
- **Duration:** ~1.2 s total.
- **Player reaction:** Full-body chills — the game "conducts" the music for one beat.
- **Reuses:** Existing `<audio>` BGM element (volume ramp only — **no** Web Audio graph surgery, no MediaElementSource), existing OD activation flash timing.
- **New code:** Medium (a small volume-envelope helper with correct restore on pause/mute/run-end).
- **Risk:** Medium: audio state machines have edge cases (pause during duck, mute during duck, run end during duck). Must be bulletproof-restorable → Phase 3.
- **Affects gameplay:** No.

### #18 — DIMENSION SLIP (มิติซ้อน)
- **Trigger:** On boss spawn, roll 0.3%: the arena background flickers (2 fast glitch frames) into a *different owned/known arena skin* for the duration of that one boss fight, then flickers back on KO.
- **Rarity:** ~1 in 300 boss spawns.
- **Duration:** One boss fight.
- **Player reaction:** "Did the ARENA just change?!" — reality-glitch surprise; also quietly advertises arena skins.
- **Reuses:** `ARENA_SKINS` background assets (already shipped), `glitch` canvas primitive for the transition, existing arena bg swap code from the arena shop.
- **New code:** Medium (temporary bg swap + guaranteed restore on every exit path: KO, run end, pause→quit).
- **Risk:** Medium: full-screen background swaps mid-combat can jank on low-end devices (decode hitch). Needs preloaded/decoded images → Phase 3.
- **Affects gameplay:** No.

### #19 — MIDNIGHT RAMPAGE (ตีหนึ่งยังไม่นอน)
- **Trigger:** Run started between 00:00–00:59 local time, 25% roll: night-owl grade (deep blue tint) + one-off splash "ตีหนึ่งแล้วยังไม่นอนอีก?" at run start.
- **Rarity:** Time-gated — only night players ever see it; those players see it *sometimes*.
- **Duration:** Splash 1.5 s; subtle tint for the run.
- **Player reaction:** "The game KNOWS." — personal, creepy-funny, extremely shareable.
- **Reuses:** `showBigSplash`, the Blood Moon tint infrastructure (same overlay, different color), `Date` (free).
- **New code:** Low *after* Blood Moon ships (shares its run-grade system).
- **Risk:** Low, but it's a novelty with a narrow audience → Phase 3, only if Blood Moon's overlay proves itself.
- **Affects gameplay:** No.

### #20 — DOPPEL SPAWN (เงาแฝด)
- **Trigger:** On normal enemy spawn, roll 0.2%: the enemy spawns with a dark mirrored silhouette flickering behind it for ~2 s (visual only — one enemy, one hitbox).
- **Rarity:** ~1 in 500 spawns.
- **Duration:** 2 s.
- **Player reaction:** "Was that… two of them?" — an unsettling blink-and-miss-it sighting; fuels "did you know about…" conversations.
- **Reuses:** `shadowBurst` canvas primitive + the Doppelganger card's shadow-strike visual language, CSS transform mirror on a cloned sprite node.
- **New code:** Medium (a pooled silhouette node + spawn hook).
- **Risk:** Medium: extra sprite node near the boss must not confuse tap targeting perception (it's cosmetic, but *players* may aim at it). Lowest priority for a reason.
- **Affects gameplay:** No.

---

## 3. The Best 5

Chosen to cover **five distinct emotions** with maximum memorability per line of code — not the five most complex:

| # | Moment | Emotion | Why it makes the cut |
|---|--------|---------|----------------------|
| 1 | **GOLDEN BOSS** | Greed | Extends the game's *proven* luck language (Golden Enemy) to its biggest stage. Zero new vocabulary to teach — players already know gold = jackpot. The single highest "OH!"-per-effort in the list, and the natural Phase 2 flagship. |
| 2 | **BUZZER BEATER** | Drama | A 60-second timer game that has no last-second celebration is leaving its best moment on the table. Costs one `if`. Every player who gets one will retell it. |
| 3 | **FLAWLESS RELOAD** | Pride | The AK47 chain is the game's skill-expression centerpiece; this gives mastery a face. Rare Moments shouldn't all be dice rolls — one must say "*you* did that." |
| 4 | **SQUEAKY GLOVE** | Comedy | The purest "I didn't expect that!" in the document. Zero assets (the SFX are synthesized — pitch is a parameter). Two seconds of chipmunk punches in the middle of ANNIHILATION MODE is the moment players hand the phone to a friend. |
| 5 | **BLOOD MOON RUN** | Mystery | The only moment where the *run itself* is the rarity. Creates start-of-run anticipation ("maybe this one's a blood moon") — which is exactly what a replayable score attack wants — and its Phase 2 hook (golden chance ×3) deepens the existing luck economy without a single new mechanic. |

Runner-up: **INSTANT BREAK** (#5) — ships in Phase 1 anyway because it's nearly free.

---

## 4. Implementation Roadmap

### Phase 0 — Shared plumbing (half a day, prerequisite)
- `RARE_MOMENTS` constants table (id, chance, per-run cap, splash text, color) — one place to tune everything, mirroring `BOSS_VFX`/`VFX_MAP` metadata style.
- `rareMoment(id, ctx)` dispatcher: global 4 s cooldown, `cameraClaim(2,…)`, `try/catch` (copy the `_checkKoMilestone` skeleton at `game.js:9288`), reduced-motion/`reduce-flash`/mute respect.
- Per-run reset of all rare-moment state in the existing run-start reset block.
- **No save writes. No new localStorage keys. No `cs_*` flags.**

### Phase 1 — Pure cosmetic (each ≤ 1 day, zero gameplay impact)
Ship order (value ÷ effort):

| Order | Moment | Est. | Notes |
|-------|--------|------|-------|
| 1 | RARE SPLASH LINES (#6) | 0.25 d | String pool + wrapper. Instant personality. |
| 2 | BUZZER BEATER (#2) | 0.25 d | One condition in `bossKO` + result line. |
| 3 | INSTANT BREAK (#5) | 0.25 d | Timestamp diff in PRESSURE resolve. |
| 4 | INSTANT DELETE (#13) | 0.25 d | Boss-spawn timestamp (DEVILINGO pattern). |
| 5 | FLAWLESS RELOAD (#3) | 0.5 d | Chain timer + miss flag on `wpRound` state. |
| 6 | SQUEAKY GLOVE (#4) | 0.5 d | SFX pitch multiplier + timed reset. |
| 7 | GOLDEN STREAK (#9) | 0.5 d | Previous-roll boolean + gold edge aura. |
| 8 | CRIT STORM (#10) | 0.5 d | Crit-streak counter. |
| 9 | RECORD OBLITERATED (#11) | 0.5 d | Upgrade the existing NEW RECORD branch. |
| 10 | LUCKY 7s (#8) | 0.5 d | Piggyback the combo-milestone path; reuse slot-reel primitives. |
| 11 | COMBO INFERNO (#15) | 0.5 d | Threshold + static CSS state. |
| 12 | FLAWLESS RAMPAGE (#12) | 1 d | Two fail counters + result-screen stamp. |
| 13 | GOLDEN BOSS — *cosmetic tier* (#1) | 1 d | Spawn roll + gold tint + KO confetti. **No reward change yet.** |

Phase 1 exit criteria: `npm run build` + `npm run smoke` green; no measurable frame cost during a spam-tap session on a low-end device; version bump in all three locations per release convention.

### Phase 2 — Slight reward impact (quantity only, no new systems)
Gate: Phase 1 telemetry-by-feel (player feedback) confirms the moments land. Each change is a **multiplier on an existing reward at an existing payout point** — nothing new to balance structurally, but each needs one pass against the ~250 coins/round economy target.

| Moment | Reward hook | Guardrail |
|--------|-------------|-----------|
| GOLDEN BOSS (#1) | Boss KO coins ×3 (that boss only) | Once per run; rides the existing `getZenyKoMultiplier` late-game damping so it can't inflate the economy. |
| BLOOD MOON RUN (#14) | Ships here (cosmetic grade + Golden Enemy chance ×3 for the run) | Expected value ≈ +6–7% run coins on 1.5% of runs — negligible economy-wide, enormous emotionally. |
| GOLDEN MAGAZINE (#16) | Golden AK47 chain completion: bomb *coin* payout ×2 | Once per run; score untouched so leaderboard integrity is unaffected. |
| SHADOW BOSS (#7) | Optional: +flat score on KO (small) | Keep score bonus below one boss KO's worth; it's a sighting, not a strategy. |

Explicit non-goals for Phase 2: no drop-rate changes to OCA/cards, no permanent bonuses, no currency types, nothing written to `save` beyond the coins/score already flowing through existing paths.

### Phase 3 — Only if absolutely justified
Each item here has real engineering risk; it ships **only if** Phase 1–2 demonstrably increased session length / player chatter, and only one at a time:

| Moment | Why it waits | Justification bar |
|--------|--------------|-------------------|
| THE DROP (#17) | Audio state-machine edge cases (pause/mute/run-end during the duck). | Players specifically praise the OD Lv3 moment; music is cited in feedback. |
| DIMENSION SLIP (#18) | Full-screen bg swap mid-combat = decode-jank risk on low-end devices; needs preload/decode work. | Arena skins need more visibility AND perf testing proves the swap is hitch-free. |
| MIDNIGHT RAMPAGE (#19) | Narrow audience; depends on Blood Moon's run-grade overlay shipping cleanly. | Blood Moon overlay proves readable + popular. |
| DOPPEL SPAWN (#20) | Cosmetic sprite near the tap target risks *perceived* mis-targeting. | Only if playtests show zero aim confusion. |

### What we will never build (restating the brief as a contract)
No prestige, no quests, no achievements, no currencies, no permanent buffs, no new combat or boss mechanics, no RPG progression, no monetization hooks. If a proposed Rare Moment needs a tutorial, a menu, or a save-schema migration, it is not a Rare Moment — cut it.

---

*The success metric is not a number. It's a player finishing a run and saying: "เมื่อกี้มันอะไรน่ะ?! เล่นอีกรอบ" — "What WAS that?! One more run."*
