# Game Feel Review — Playthrough Notes (2026-07-02)

Method: played the deployed classic mode end-to-end in a mobile-viewport browser
(fresh save → preloader → menu → 6 runs at different skill levels → shop →
gacha/tickets → collection → boss/arena shops → rewards hub → pause → fail
state). Evaluated only the player experience: pacing, feedback, UI clarity,
impact. Implementation details ignored except to size the fix. Loop RPG mode is
feature-flagged off (`BOSS_LOOP_ENABLED = false`), so it was excluded — this
review covers what players actually receive.

## What already feels good (don't touch)

- **Core tap loop** — layered feedback (damage numbers, boss hit poses, coin
  popups, combo counter, WP/AK47/BREAK camera shakes) reads clearly and runs at
  a solid 60 FPS during normal combat.
- **Overdrive splash** — logo slam + rifle overlay + ×5 CHAOS MULTI is a real
  signature moment.
- **Card reveal** (post-run drop and OCA/ticket draw) — the charge → tier-hint
  glow → flip → burst sequence has genuine tension; duplicate compensation
  ("DUPLICATE +100 ZENY") is honest and clear.
- **Menus/shop layout** — readable, stylish, consistent; pause screen with
  inline settings is exactly right.

## Ranked improvements (player impact ÷ effort, small polish only)

### 1. OD countdown renders raw floating point — "8.999800000000047s"
**Impact: every player, every Overdrive · Effort: one line**
`godSecondsLeft` drains by 0.1 and accumulates float error; `game.js:9474`
renders it raw (`godSecondsLeft+'s'`). The game's flagship power moment
displays debug garbage mid-screen. Fix: `godSecondsLeft.toFixed(1)+'s'`
(guarding the `>0` check against the same error).

### 2. Rage-death shows "GAME OVER" with zero explanation
**Impact: first-session retention · Effort: small**
A failed BREAK adds +32–65 rage (`PRESSURE_FAIL_RAGE_TABLE`); two misses end
the run. An idle or fumbling new player is cut to the result screen in well
under a minute with CHAOS SCORE 0 and no cause shown. Add one line to the
GAME OVER result ("RAGE เต็ม 100 — กด BREAK ให้ทันครั้งหน้า!") and ideally a
short "RAGE MAX — KO!" splash before the cut. The death is fine; the silence
is not.

### 3. Can't-afford BUY gives no feedback at all
**Impact: every shop visit early game · Effort: small**
Tapping the dimmed OCA BUY (`cant-afford`) does nothing — no shake, no toast,
and the 1500 price is nearly invisible in the dim state. The card-slot reroll
already has the right pattern (`cs-reroll-shake` + inline no-zeny note);
reuse it: shake the button and flash the price/"ZENY ไม่พอ".

### 4. Result screen hides the run's story
**Impact: every run's payoff moment · Effort: small-medium**
BATTLE RESULT shows only score + zeny + card. KOs, max combo, BREAK successes,
AK47 completes are all tracked (stats + weekly challenge counters) but never
shown, so the mini-games don't get reinforced and weekly-challenge progress is
invisible at the exact moment it advanced. Add 3–4 stat rows (KO / MAX COMBO /
BREAK / AK47) with the weekly tally next to BREAK and AK47.

### 5. Stale HUD leaks into the next run's countdown
**Impact: polish credibility · Effort: small**
Abandon a run via pause → MAIN MENU, start a new one: through the whole
GET READY → GO! countdown the HUD shows the dead run's timer (e.g. 54.71) and
combo (47), snapping to fresh values only when play starts. Reset the HUD
elements before the countdown overlay shows.

### 6. BREAK phase drops frames exactly when timing matters
**Impact: the one timing-critical moment, on the target (mobile) platform · Effort: medium**
During the BREAK aura the frame time spiked to 53–150 ms (60 → ~19 FPS) in my
environment. Headless software rendering exaggerates this, but the direction
is real: the heaviest visual in the game plays during the only 2.75–3.1 s
window where a precise tap is mandatory, and a dropped frame there feels like
an unfair fail. Trim the aura cost (fewer layers / smaller blur radius /
pre-rasterized frames) — keep the drama, cap the cost.

### 7. Card slot re-pick friction on every run
**Impact: per-run friction in a replay-driven game · Effort: small**
RETRY returns to CARD SLOT with nothing selected; CONFIRM only appears after
re-tapping a card, so every rematch costs 3 taps + a think. `save.savedCards`
already persists the selection — pre-highlight the last-used card so RETRY is
one CONFIRM tap (keep reroll for players who want variety).

### 8. No audio stinger on Overdrive start or BREAK-window open
**Impact: juice + a functional safety net · Effort: small**
Per-hit audio upgrades during OD (punch → AK), but the two biggest state
changes are silent: `activateGodLevel` plays nothing, and the BREAK orb spawns
with no alarm. The BREAK one is functional, not just juice — an audio cue
rescues players whose eyes are on the weak-point chain (and pairs with #2).
Assets/synth path already exist (`_playSfx`, countdown `<audio>` pattern).

### 9. CONFIRM button uses an "×" icon
**Impact: minor but recurring confusion · Effort: trivial**
The card-slot CONFIRM shows an × glyph (`cs-confirm-icon`) — universally read
as "cancel/close". Swap to a ✓.

### 10. Daily reward is claimed invisibly
**Impact: a wasted delight moment · Effort: small-medium**
`tryClaimDailyReward` auto-claims on menu load with a small bottom toast; I
received two tickets across the session and only discovered them by opening
the CARD screen. Either make the toast a proper center-screen moment on menu
entry, or leave the pip unclaimed in the REWARDS modal for a satisfying tap.

### Minor notes (cheap, take or leave)
- The OD status text ("NOCTIS OVERDRIVE" + countdown) floats mid-screen over
  the boss in small grey type; anchoring it to the OD bar would read better.
- Small damage numbers ("20") at run start are near-invisible at arm's length
  on a phone; a slightly larger floor size would help early-game feel.
- OCA panel: show the price prominently even when unaffordable (see #3).

### Observation (not small polish — logged only)
Within a run, every KO respawns the same boss photo; "BOSS INCOMING" waves
don't visibly change the opponent, so minute 1 and minute 60 of the game look
identical except for numbers. Any visible escalation (tint/pose/name change on
wave milestones) is the highest-leverage *larger* change, but it exceeds the
small-polish scope of this list.
