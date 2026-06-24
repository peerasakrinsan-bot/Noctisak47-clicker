# CARD SKILL GUIDE — Normal / Clicker Mode

> **Scope:** Normal/default clicker-mode cards only (`CARD_POOL` in `src/game.js`).
> This file does **NOT** cover RPG / Loop / Boss Loop Hero (`src/bossLoopHero.js`) — that mode has its own gear/perk system and never reads `CARD_POOL`.
>
> **Purpose:** Let a future Claude/Codex session understand the existing 90 cards *before* editing or adding one — so new cards don't duplicate an existing power, aren't accidentally too weak/too strong, and keep each rarity's power budget consistent.
>
> **This guide is documentation only.** It does not change balance or card logic. Trace live code (`src/game.js`) before trusting any number here — if code and this guide disagree, **the code wins** and this guide is stale and must be fixed.

Cards documented: **90** — Standard 23 · Premium 26 · Elite 22 · Mythic 19.
Last verified against `src/game.js` / `src/cardVfx.js`. Re-verify with `npm run card-audit` after any card change.

---

## 1. Card System Overview

### Where the data lives
- **`CARD_POOL`** — `src/game.js:2397` … `:3053`. A flat array; one object per card.
- Each card object: `{ id, name, img, rarity, effect, tradeoff, shortDescription, fullDescription, balanceNote, apply(s) }`.
  - `effect` / `tradeoff` / `*Description` are **player-facing HTML/Thai text** (UI only).
  - `balanceNote` is a dev-only audit trail of past rebalances.
  - `apply(s)` is the **only** thing that affects gameplay — it writes `cs_*` flags onto a state object.

### Card IDs
- Short, **lowercase alphanumeric**, usually 2–3 chars (`po`, `lu`, `dg`, `ghp`, `dsk`).
- Must be **globally unique** (enforced by `card-audit`).
- A legacy `_MIGRATE_ID` map (`game.js`, `_migrateIds`) converts old long IDs → short form on save load. Never re-use a retired id.

### Rarity labels (lowercase strings in code)
| Label | UI tier | Count | Gacha weight |
|-------|---------|-------|--------------|
| `standard` | Common | 23 | 65% |
| `premium`  | Uncommon | 26 | 20% |
| `elite`    | Rare | 22 | 13% |
| `mythic`   | Void | 19 | 2% |

### Obtain paths
Every card in `CARD_POOL` is **obtainable**. Two ways to *own* a card, one way to *equip* it:
1. **Gacha / OCA draw** — unlocks new cards into `save.unlockedCards` (`unlockCard`, `game.js:5273`).
2. **Starter set** — `DEFAULT_UNLOCKED = ['po','lu','fa','co','pp']` (`game.js:5240`) is always owned.
3. **Pre-run reroll** — pick one *owned* card per run from a 3-card offer (`generatePreRunCardOffers`, `game.js:3209`). This selects, it does not unlock.

### Gacha / drop weights & pity
- Base draw weights: `CARD_DROP_WEIGHTS = { standard:65, premium:20, elite:13, mythic:2 }` (`game.js:5243`).
- **Pity** (`_getPityType`, `game.js:5252`) on a 50-draw cycle keyed off `save.gamesCompleted`:
  - every **5th** draw → `CARD_DROP_WEIGHTS_PITY5` (premium+ guaranteed)
  - **25th** draw → `CARD_DROP_WEIGHTS_PITY25` (elite+ guaranteed)
  - **50th** draw → `CARD_DROP_WEIGHTS_PITY50` (mythic guaranteed)
- **Reroll** uses a *separate*, escalating weight table (`getRerollRarityWeights`, `game.js:3146`) — more rerolls → better odds — and an escalating zeny cost (`getRerollCost`, `game.js:3133`).
- Duplicate draws refund coins: `CARD_DUPE_COINS` (`game.js:5249`).

### Save / load fields
| Field | Meaning | Seeded in |
|-------|---------|-----------|
| `save.unlockedCards` | owned card IDs (array) | `defaultSave` `:416`, `normalizeSaveData` `:441` |
| `save.savedCards` | persisted pre-run slot selection `[id]` or `null` | `:415`, `:440` |
| `save.cardRuns` | `{[cardId]: runCount}` → drives mastery tier (cosmetic) | `:423`, `:462` |
| `save.preRunState` | live reroll offer/cost between screens, or `null` | reroll system |

### How `apply(s)` → `cs_*` flags → game logic works (the read path)
This is the single most important pipeline. **All cards follow it:**

1. On run start, the engine builds a fresh state object and calls the card's `apply`:
   ```js
   const cs = {};
   card.apply(cs);          // writes cs_* flags onto cs
   window._csState = cs;    // game.js:3695
   ```
2. `apply(s)` only ever does `s.cs_xxx = value` (additive accumulators like `s.cs_dmgBonus = (s.cs_dmgBonus||0)+0.12`, or boolean markers like `s.cs_thanatos = true`).
3. **Game logic reads `window._csState.cs_xxx`** at the relevant mechanic. There is no central switch — each system reads the flags it cares about. Trace any flag with a plain text search of `src/game.js`.
4. **Complex cards** (booleans like `cs_thanatos`, `cs_eddga`, `cs_orcBaddy`, `cs_gloomUnderSide`) start timers/intervals at run start via a dispatch block around `game.js:3761` (`_csStartThanatosTimer`, `_csStartEddga`, …) and keep per-run sub-state on `window._csState` (e.g. `_thanatosPhaseEndTime`, `_hydraHeads`).

**Shared "simple stat" read sites** (most Standard/Premium cards funnel through these):

| Flag | Effect | Example read site |
|------|--------|-------------------|
| `cs_dmgBonus` | flat % damage | `game.js:4353` |
| `cs_bossDmgBonus` | % damage vs boss | `game.js:4354` |
| `cs_coinPct` | % zeny | `game.js:4469` |
| `cs_bossCoinPct` | % zeny on boss KO | A-LIST card logic |
| `cs_critChanceBonus` | crit chance | `game.js:7455` |
| `cs_critDmgBonus` | crit damage | `game.js:7482` |
| `cs_comboMilestoneCoin` | zeny per 10 combo | `game.js:4530` |
| `cs_comboDecaySlow` / `cs_comboDecayFast` | combo decay rate | `game.js:7288` |
| `cs_extraTime` / `cs_timePenalty` | round start time | `game.js:5764` |
| `cs_enemyHpReduce` | enemy start HP (neg = harder) | `game.js:5768` |
| `cs_odChargeBonus` / `cs_odChargePenalty` | OD charge per click | `game.js:7359` |
| `cs_breakPower` / `cs_breakDuration` | BREAK gauge / window | `game.js:6515` / `:6160` |
| `cs_ak47DuplicateChance` / `cs_wpDuration` | AK47 spawn behaviour | `game.js:1874` / `:2022` |

> `card-audit` (`scripts/card-audit.mjs`) **guarantees every `cs_*` a card sets is read somewhere** — there are no dead effects. If you add a flag, you must add a reader or the audit fails.

### Card VFX mapping
- Cosmetic only — `src/cardVfx.js`, `VFX_MAP` (`cardVfx.js:268`). Guarded by `npm run card-vfx-audit`.
- **Every Elite and Mythic card has a VFX entry; Standard/Premium have none** (by design).
- VFX is fired from existing mechanic hooks via `CardVFX.trigger(id, context, ctx)` and a run-start aura via `CardVFX.setActiveCard` (called at `game.js:3700`).
- It **never** reads/writes `cs_*`, `save`, or balance. Adding/removing an Elite/Mythic card **requires** a matching `VFX_MAP` change or the VFX audit fails.

---

## 2. Card Index Table

Legend — **Cat** = primary power category (see §3). **VFX** = has `VFX_MAP` entry. All 90 cards are **obtainable** (gacha/reroll), so the column is omitted; starters are `po lu fa co pp`. Read path for every card is the §1 pipeline (`window._csState.<flags>`); special read sites noted where relevant.

### Standard (23) — simple passive boosts
| ID | Name | Cat | Core mechanic | Flags | VFX |
|----|------|-----|---------------|-------|-----|
| po | BORING | coin | Zeny +12% | cs_coinPct | — |
| lu | LOONEYTIC | raw dmg | Crit DMG +15% | cs_critDmgBonus | — |
| fa | FA-BRRR | combo | Combo decay −20% | cs_comboDecaySlow | — |
| co | CONBRO | combo | 10% combo no-reset | cs_comboNoReset | — |
| pp | PEKO PEKO | raw dmg | Enemy HP −15% | cs_enemyHpReduce | — |
| sp | SNORE | time | +3s round time | cs_extraTime | — |
| pr | POPORINGO | coin | +12 zeny / 10 combo | cs_comboMilestoneCoin | — |
| dr | DRIPZ | coin | Zeny +8% & Crit +5% | cs_coinPct, cs_critChanceBonus | — |
| st | STAYNOR | combo | decay −20% & +6 zeny/10 combo | cs_comboDecaySlow, cs_comboMilestoneCoin | — |
| ro | BROCKER | coin | +10 zeny / 10 combo | cs_comboMilestoneCoin | — |
| ca | CARAMEME | raw dmg | Enemy HP −10% & +1s | cs_enemyHpReduce, cs_extraTime | — |
| rf | BRODA FROG | raw dmg | DMG +7% | cs_dmgBonus | — |
| me | METALOL | OD | Combo≥10 → OD +4%/click | cs_odChargeBonus, cs_metalolComboGate | — |
| ma | MANGAGORA | time | +2s round time | cs_extraTime | — |
| wi | WEEBLOW | raw dmg | Crit DMG +10% & Zeny +3% | cs_critDmgBonus, cs_coinPct | — |
| an | ANDRUH | raw dmg | DMG +6% & Zeny +5% | cs_dmgBonus, cs_coinPct | — |
| ku | COOKRE | raw dmg | Crit +4% & Crit DMG +8% | cs_critChanceBonus, cs_critDmgBonus | — |
| fm | FAMILIARUTO | coin | Zeny +6% & +8/10 combo | cs_coinPct, cs_comboMilestoneCoin | — |
| pi | PICK-CHU | time | +2s & Enemy HP −8% | cs_extraTime, cs_enemyHpReduce | — |
| yy | JOJOYO | combo | 5% no-reset & decay −10% | cs_comboNoReset, cs_comboDecaySlow | — |
| ho | HORNYET | raw dmg | Crit +6% | cs_critChanceBonus | — |
| tb | THUG BUG | OD | OD +7%/click | cs_odChargeBonus | — |
| ms | MASTER BLING | coin | +15 zeny & +0.3s / 10 combo (cap +3s) | cs_comboMilestoneCoin, cs_comboTimeBonus | — |

### Premium (26) — stronger / conditional, may combine 1–2 simple effects
| ID | Name | Cat | Core mechanic | Flags | VFX |
|----|------|-----|---------------|-------|-----|
| zo | ZOOMBIE | time | KO → +0.05s (cap +5s) | cs_koTimeBonus | — |
| sa | SALVAGE | break dmg | DMG +12%, BREAK +15% / **OD charge −15%** | cs_dmgBonus, cs_odChargePenalty, cs_salvageBreak | — |
| oc | ORC WORRIER | OD | Crit → OD +3% | cs_critOdCharge | — |
| mu | MOMMY | combo cond | Combo≥20 → DMG +15% | cs_combo20Dmg | — |
| sw | SKILL WORKER | combo cond | +8% DMG / 10 combo (cap +24%) | cs_skelWorker | — |
| hf | HUNGER FLY | coin/OD | OD used → +60 zeny/round | cs_odCoinBonus | — |
| ew | ELDER WEEBLOW | OD | Combo≥25 → OD charge ×1.5 | cs_elderWillow | — |
| si | STONK | break dmg | DMG +8%, BREAK +20% / decay +20% | cs_dmgBonus, cs_comboDecayFast, cs_stonkBreak | — |
| nm | NIGHTMAYOR | OD | KO → OD +3% | cs_koOdCharge | — |
| ze | XENORC | raw dmg | OD-use DMG stack +6% (cap +18%), resets on BREAK | cs_zenorc, cs_zenorcResetOnBreak | — |
| hg | WRONG | phase/window | time<15s → DMG +20% / decay +15% | cs_horong, cs_horongTradeoff | — |
| ry | RAYTRICK | execute/thresh | enemy HP≤60% → DMG +15% (reset on KO) | cs_raydric, cs_raydricResetOnKO | — |
| gg | GENERAL GRIEVOUS | break dmg | DMG +8%, BREAK +22% / −5s | cs_dmgBonus, cs_timePenalty, cs_ggBreak | — |
| jk | JACKED | OD/crit | OD: Crit +20% & CritDMG +15%; BREAK Crit +8% | cs_jakkCrit | — |
| mn | MARINAH | AK47 | AK47 spawn +15%, BREAK window +0.35s, +8% | cs_marinaSpawn, cs_breakDuration, cs_breakPower | — |
| dp | DEMON FUNGUS | OD | every 5 KO → OD +8% | cs_demonPungus | — |
| vi | VITAMOE | OD | Combo≥15 → OD ×1.25 / DMG −5% | cs_vitata, cs_dmgBonus | — |
| al | ALLEYGATOR | coin | 6-KO zeny stack (cap +15%) & BREAK ×2 KO count | cs_alligator | — |
| ss | SOLDIER SKELLYTON | raw dmg | CritDMG +25% & Crit +4% & AK47 Crit +10% | cs_critDmgBonus, cs_critChanceBonus, cs_skellytonWp | — |
| mc | MARVELC | time | +4s, decay −15%, time<15s DMG +8% | cs_extraTime, cs_comboDecaySlow, cs_marvelcLowTime | — |
| sd | SIDEWHINER | raw dmg | DMG +16% / OD charge −20% | cs_dmgBonus, cs_odChargePenalty | — |
| zr | ZERO SENPAI | coin | Crit +10% & Zeny +8% | cs_critChanceBonus, cs_coinPct | — |
| my | MADTYR | OD | OD +10%/click / decay +15% | cs_odChargeBonus, cs_comboDecayFast | — |
| als | A-LIST | coin/boss | Boss KO Zeny +12%; BREAK Sponsor Rush +25% (CD 20s) | cs_bossCoinPct, cs_aListCard | — |
| rzw | RIZZWORD | AK47 | AK47 +0.5s on-screen; collect → OD +3% (cap 10/8s) | cs_rizzword, cs_wpDuration | — |
| orb | ORC BADDY | OD cond | OD≥70% → DMG +12% / OD drains faster | cs_orcBaddy, cs_orcBaddyDrain | — |

### Elite (22) — signature mechanic, changes playstyle, has windows/conditions
| ID | Name | Cat | Core mechanic | Flags | VFX ctx |
|----|------|-----|---------------|-------|---------|
| dg | DOPPELGANGER | multi-hit | every hit → SHADOW STRIKE (45% dmg, +0.08s) | cs_doppelShadow | hit |
| hy | HYDRA | AK47/break | AK47 sets → Hydra Heads (≤3) → Hydra Burst on BREAK | cs_hydra | break, ak47 |
| ph | FREEONI | OD/combo | AK47→OD; BREAK→FREE MODE 5s (CD 3s) | cs_freeoni | break, ak47 |
| tg | TURTLE SHOGUN | combo/risk | Combo≥25 → SHOGUN STANCE 6s (DMG+45%) / decay +35% | cs_turtleShogun | break |
| dk | DRAKE | phase/window | HP 75/50/25 phase bursts → DRAKE TAKE 6s (DMG×2, BREAK×2) | cs_drakeIgnoreThreshold | drake |
| ak | ABYSMELL KNIGHT | execute | Combo≥30 → EXECUTION READY; boss HP≤5% → instant KO | cs_aknightExecute | execute |
| tk | TAO FUNKA | break→buff | BREAK → FUNK FEVER 5s (DMG+45%/Crit+20%/+1 combo) / decay +25% | cs_taoFunka | break |
| dc | DRUNKULA | drain/crit | CritDMG +35%; Crit 25% → BLOOD DRINK (OD+3%, +8 zeny, ICD 0.8s) | cs_drunkula, cs_critDmgBonus | break |
| ic | INCANTATION SCAMURAI | combo/window | Combo≥35 → CONTRACT 6s (DMG+70%) / combo cut to 15 | cs_incantation | break |
| sk | STORMYNITE | OD/window | OD → STORM CHARGE; 12 clicks → +1s (cap +3s) + burst | cs_stormyKnight | od |
| dl | DORK LORD | passive scaling | 15s → NIGHT STACK (≤5): DMG+6%/stack / timer +3%, KO zeny −15% | cs_dorkLord | break |
| mf | MOONLIGHT FEVER | special | DMG/Zeny/OD ×2, AK47 3+×2, BREAK+0.5s / **time halved** | cs_moonlightflower, cs_breakDuration | od, break, ak47 |
| mi | MINORAGE | build/burst | ORE RAGE: 18 clicks → +1 Ore Crack (max 3, DMG+8%/stack); BREAK consumes all → BREAK DMG+20%/stack; 3 used → RAGE RUSH 4s (Combo+2/click, Crit+25%, DMG+25%); HP≤30% gains every 12 clicks | cs_minorous | oregain, break, rage |
| ex | EXECUSIONER | execute/thresh | HP<30% → EXECUTION MODE 5s (DMG+60%, CD 18s) | cs_executioner | break |
| wh | WHIZPER | AK47/combo | BREAK → GHOST PROTOCOL 4s (combo pause, CD 10s); AK47 dup +35% | cs_whisper, cs_whizperGhostProtocol, cs_ak47DuplicateChance | ak47 |
| gl | GOBLIN WEEBER | combo gain | click → Combo +2; full(47) → WEEB FOCUS 5s | cs_goblinLeader | combo |
| ar | AMOG RA | risk/reward | Combo hits 20 → 70% buff / 30% SUS (CD 8s) | cs_amogRa | break |
| mp | MAYA PROBLEM | boss dmg | Boss DMG +30%, Crit +10%; BREAK → +40%/+25% 6s | cs_bossDmgBonus, cs_critChanceBonus, cs_mayaProblem | break, boss |
| ed | WEEBVIL DUDE | risk/reward | −6s start; first BREAK → OTAKU AWAKENING (rest of round) | cs_timePenalty, cs_weebvilDude | break |
| ghp | GHOSTPING | break gauge | missed AK47 speeds BREAK (≤6); BREAK DMG +55%, gauge +15% | cs_ghostping | break |
| dvl | DEVILINGO | boss/risk | first 15s Boss+70%/Zeny+30%/AK47+20% → then CURSED PANIC all round | cs_devilingo | ak47, boss |
| ltn | LADY TRAINEE | OD scaling | each OD entry → DMG stack +4% (cap +60%); 10 → Spotlight | cs_ladyTrainee | od |

### Mythic (19) — game-changers; all carry a cap / cooldown / condition / tradeoff
| ID | Name | Cat | Core mechanic | Limit / tradeoff | Flags | VFX ctx |
|----|------|-----|---------------|------------------|-------|---------|
| th | THANABROS | special | AK47 DMG×2.5; BREAK → Thanatos Phase 5s + OD full | combo reset every 10s | cs_thanatos | thanatos, ak47 |
| bh | BAPHOBET | multi-hit | click → TRIPLE STRIKE; BREAK → 3× AK47 + DEVIL BET | **OD cursed: no OD gain** | cs_baphomet | break |
| eg | EDGEGA | OD/special | OD Lv1 permanent; every 15s → Lv2 Burst 5s | locked at Lv1 | cs_eddga | od |
| os | NOSIRIS | break/special | BREAK → Soul Stack (≤5); 5 → JUDGMENT 8s; death-deny once | once/round | cs_osiris | break |
| mt | MISSSTRESS | OD/coin | OD click → +12 zeny (ICD 0.3s) & OD +0.35s (cap +4s) & Crit +10% | OD-only, capped | cs_mistress | od |
| gb | GOLDEN BRUH | coin/special | click → Combo+1, Zeny×3; full(47) → GOLD RUSH 12s ×9 | **no OD charge**, CD 14s | cs_goldenbug | combo |
| oh | COKE ZERO | OD scaling | OD charge ×4; OD-end DMG +15% stack (cap +90%) | start −5s | cs_orchero | break |
| ld | LORD OF DEBT | risk/reward | 10s → DEBT CONTRACT (random forbidden power 8s); BREAK clears debt | stacking decay pressure | cs_lordofdeath | break, hit |
| kn | CATULLANUX | AK47 | AK47 DMG×4; AK47/BREAK → combo lock 5s, BREAK +20% | **enemy HP +50%** | cs_ktullanux, cs_breakPower, cs_enemyHpReduce | break |
| bz | BEELZEBRUH | risk/reward | click → Corruption (≤50%); MAX+BREAK → Zeny×1.5 & OCA+50% 8s | **enemy HP ×2** | cs_beelzebub | break |
| vr | VALKYRIZZ | special | AK47/BREAK → random ELITE effect (until next swap) | excl. mf/vr | cs_valkyrieRandgris | break |
| at | ATROSUS | break→buff | BREAK → Resonance 6s ×1.6; crit extends (cap +4s); 3 → Mastery ×2 | resonance gated | cs_atrosusBreak | break |
| kl | KILL-D01 | OD/break | OD click → +0.05s (cap +5s); OD 3-click → Drive Token (≤8) → BREAK discharge | token gated | cs_killD01, cs_odChargeBonus, cs_odTimerOnClick | break |
| if | IFRIED | break→buff | Crit → Inferno Stack (≤15); 10+BREAK → Inferno Burst ×2.5 5s | **enemy HP +20%** | cs_critDmgBonus, cs_enemyHpReduce, cs_ifriedBreak | break |
| rx | RSICK-0806 | break/special | DMG×2.5, BREAK +30%/tap, Execution stacks (cap +60%) | **no OD, no AK47** | cs_rsx0806, cs_breakPower | break |
| fwc | FALLEN WECHAT | OD/break | OD full → Overloaded BREAK (DMG+60%, +0.6s window) | CD 24s, OD reset | cs_fallenWechat | break |
| dtl | DETAILED | AK47/break | AK47 → Analysis Stack (≤8); 8 → ANALYZED BREAK ×2 | miss AK47: stack−2, combo−3 | cs_detailed | break |
| gus | GLOOM UNDER SIDE | passive scaling | 2s → OBSESSION (≤20): DMG/Zeny/BREAK +3%/stack | timer +1%/stack | cs_gloomUnderSide | break |
| dsk | DARK STAKE LORD | risk/reward | BREAK → Jackpot (15%→75%): Zeny×2.5, OCA×10 | Zeny −10% | cs_darkStakeLord | break |

> **Needs human review:** none. `card-audit` confirms every flag above is read by live logic (no dead effects), and `card-vfx-audit` confirms every Elite/Mythic VFX context resolves. Mechanic summaries are condensed from `effect`/`fullDescription` text — for exact numbers/timers, trace the flag in `src/game.js`.

---

## 3. Power Category Map

Group existing cards by mechanic so new cards don't duplicate an effect. **Crowded** = hard to add to without "same card, bigger number"; **Open** = design space available.

| Category | Existing cards (id) | What they cover | Saturation |
|----------|--------------------|-----------------|------------|
| **Raw damage** (flat % / crit) | lu pp ca rf wi an ku ho ze ss sd, +crit sub-stats everywhere | flat DMG%, crit chance/dmg, enemy-HP shave | **Crowded** (Std/Prem) — only add with a real condition |
| **Boss damage** | mp (passive+BREAK), dvl (early-window), als (boss zeny) | extra damage/zeny specifically vs the boss | **Open** — only 1 true boss-DMG card (mp) |
| **BREAK gauge / progress** | mn ghp + `cs_breakPower` sub on kn rx; `cs_breakDuration` on mf mn | fill BREAK faster / widen window | Moderate |
| **BREAK damage** (during BREAK) | sa si gg (the "+X% during BREAK" trio) | bonus DMG while BREAK active | Moderate — trio already near-identical, differentiate the tradeoff |
| **Combo gain / cap / no-reset** | co yy (no-reset); fa st yy mc (decay slow); si gg my (decay fast); gl (combo +2); cs_combo gates mu sw | combo generation, decay tuning, reset protection | **Crowded** for decay-slow; **Open** for combo-cap raises |
| **Coin / zeny gain** | po dr wi an fm zr pr ro st fm ms (milestone); hf al als | flat % zeny, per-10-combo zeny, KO/boss zeny | **Crowded** — needs a distinct trigger |
| **Overdrive — charge / duration / trigger** | me tb oc nm dp ew vi my orb sk (charge/gate); mt kl (timer extend); eg (lock Lv1); oh (×4 charge); ltn (stack) | OD charge rate, OD time extend, OD-state buffs | **Crowded** for "+%/click"; **Open** for novel OD *triggers* |
| **AK47 spawn / speed / collect** | mn rzw wh (spawn/dup/duration); hy dtl kn (collect→effect); ss (AK47 crit) | spawn rate, on-screen time, duplicate, collect rewards | Moderate |
| **Drain / lifesteal** | dc (BLOOD DRINK), ld (DEBT) | crit/contract → resource gain | **Open** — only 2; note there is **no HP/lifesteal stat in normal mode** |
| **Execute / threshold** | ak (boss ≤5%), ex mi (HP<30%), ry (HP≤60%) | low-HP burst / instant-KO windows | Moderate |
| **Phase / time-window** | dk (HP phases), hg (time<15s), mc (time<15s), ed dvl (round-time gates) | effects gated by HP phase or clock | Moderate |
| **Passive aura / scaling stacks** | dl gus (timed stacks), ze ltn oh if (event stacks), sw (combo scale) | slow ramp-up that grows over the round | Moderate — keep a cap on every stacker |
| **Risk / reward tradeoff** | tg ar ed dvl ld bz dsk (explicit downside for big upside) | gamble / penalty-for-power | **Open** at Elite; healthy at Mythic |
| **Reset / cooldown gated** | ph tk wh ic ar als fwc gb (CD-gated windows) | repeatable burst windows behind a CD | Moderate |
| **Multi-hit / shadow strike** | dg (shadow strike), bh (triple strike) | extra hits per click | **Open** — only 2; recursion risk, design carefully |
| **Special / game-changer** | th eg os vr rx gb mf (rule-bending) | rewrite a core rule for the round | Mythic-only; **near-saturated** — new Mythic must own a *new* fantasy |

**Quick gaps worth filling (open design space):** boss-damage Elites, novel OD *triggers* (not "+%/click"), combo-cap raisers, a controlled drain/economy card, more multi-hit identities.

---

## 4. Rarity Power Budget

Design rules per tier. Compare any new card to its tier first (§6).

### Standard (Common) — *small, legible, no rules*
- One simple numeric boost (≤ ~+15% on a single stat) or a tiny QoL (+2–3s, enemy HP −8–15%).
- May combine **two** trivial stats (e.g. DMG +6% & Zeny +5%) at *reduced* magnitudes.
- **No** windows, phases, stacks-with-cap, CDs, or playstyle changes. No tradeoffs.
- If it changes *how you play*, it's not Standard.

### Premium (Uncommon) — *stronger or conditional*
- A bigger boost **or** a conditional one (combo/HP/time gate), or a small downside for more power (`sa si gg sd`).
- May combine 1–2 simple mechanics. Light stacks with a hard cap are OK (`ze` +18%, `al` +15%).
- **Must not outshine Elite.** A Premium that meaningfully reshapes the run is mis-tiered → push to Elite.

### Elite (Rare) — *signature mechanic*
- One named mechanic with a **window/condition/CD** that changes playstyle (`tk` FUNK FEVER, `dk` phases, `wh` GHOST PROTOCOL).
- Stronger than Premium; may have a tradeoff. Burst should be *temporary*, not permanent uptime.
- **Should not rewrite the whole run by itself** — that's Mythic territory.

### Mythic (Void) — *controlled game-changer*
- Allowed to bend a rule or create a unique phase (`th` time-stop, `eg` permanent OD Lv1, `rx` no-OD/no-AK47 brawler).
- **Must carry at least one explicit limit** — duration, cooldown, condition, cap, tradeoff, or limited trigger frequency. Every current Mythic does (see §2 "Limit / tradeoff" column).
- **Must not make other cards irrelevant** — strong but build-defining, not strictly-dominant. A Mythic that's the correct pick in every situation is over-budget.

---

## 5. Anti-Duplicate Rules

Before adding a new card:
1. **Search this guide first** — match the intended effect against §2 and §3.
2. **Identify the 1–3 closest existing cards** by category and trigger.
3. The new effect must **not be "same card, bigger number."** A flat `cs_dmgBonus` at a higher value than an existing card of the same tier is a reject.
4. If it lands in the same category, give it a **different trigger / condition / tradeoff** (e.g. another OD card must not be "+%/click" again — saturated; find a new trigger).
5. **Do not duplicate a Mythic identity** — each Mythic owns a unique fantasy (time-stop, debt, jackpot, no-OD brawler, …). New Mythic = new identity.
6. **Don't pile effects onto one card** unless it's Mythic. Standard = 1 (maybe 2 tiny) stats; Premium ≤ 2 mechanics; Elite = 1 signature; Mythic may be richer but stays capped.

---

## 6. Balance Guardrails

Practical sanity checks — apply in order:
- **Compare against same rarity first.** If it's clearly the new best-in-tier with no downside, cut its numbers.
- **Compare one tier up and one tier down.**
  - New **Elite** stronger than several **Mythics** → reduce it (or it was meant to be Mythic).
  - New **Premium** stronger than an **Elite** → reduce it.
  - New **Standard** that changes playstyle → move it to Premium/Elite.
- **Mythic with permanent uptime** → add a cap / cooldown / condition / tradeoff. (See `gb` CD>duration to block chain-loops, `mt` ICD on zeny, `oh` start-time cost.)
- **Hidden penalties are not allowed.** If a card has a downside, it must be in `tradeoff` / `fullDescription`. The text must match the logic **exactly** — past audit fixes existed precisely because text and code drifted (`balanceNote` history). Update text and `apply()` together.
- **No recursion / overflow.** Multi-hit and proc cards (`dg bh gl`) must have ICDs/caps so a click can't cascade. New stackers need a hard cap read by logic.
- **Respect the economy.** Normal mode targets ~250 coins / 60s round; zeny multipliers should fit that.

---

## 7. New Card Checklist (copy-paste)

```
NEW CARD — <name>

BEFORE CODING
[ ] Card fantasy (one line):
[ ] Rarity chosen + why (vs §4 budget):
[ ] Category (§3):
[ ] Closest existing cards (2–3 ids):
[ ] Why NOT a duplicate (different trigger/condition/tradeoff):
[ ] Trigger (click / combo / HP / time / BREAK / AK47 / OD / KO):
[ ] Cap / cooldown / duration / condition:
[ ] Expected power level (vs same-tier benchmark card):
[ ] VFX idea (Elite/Mythic only — aura style + on-contexts):
[ ] Player-facing text (effect / tradeoff / short / full) — Thai, matches logic:

AFTER CODING
[ ] Unique lowercase id (not a retired one)
[ ] Valid rarity string (standard/premium/elite/mythic)
[ ] Artwork exists under public/cards/
[ ] apply(s) sets >= 1 cs_* flag
[ ] Every cs_* flag it sets is READ by game logic (no dead effect)
[ ] save/load OK (no new save field, or seeded in defaultSave + normalizeSaveData)
[ ] Elite/Mythic: VFX_MAP entry added in src/cardVfx.js
[ ] Player text matches actual effect EXACTLY (incl. tradeoff)
[ ] No RPG / Boss Loop references or coupling
[ ] No hidden downside
[ ] Updated docs/CARD_SKILL_GUIDE.md (this file) in the same PR
[ ] npm run card-audit  → pass
[ ] npm run card-vfx-audit  → pass (if VFX touched)
[ ] npm run smoke  → pass
[ ] npm run build  → pass
[ ] Bump version in 3 places if players will receive it (see CLAUDE.md "Releasing")
```

---

## 8. How Claude should use this file

- **Always read this file before editing or adding cards.**
- **Never add a card without checking duplicate mechanics** (§3, §5) first.
- **Never buff/judge a card from text impression alone** — trace the live `cs_*` flag in `src/game.js` first. Text can be stale; code is truth.
- **When adding a new card, update this guide in the same PR** (index table §2 + category map §3).
- **When changing card logic, update the guide *and* the player-facing card text together** so all three stay in sync.
- **When adding/changing VFX, update the VFX notes** (§1 + §2 VFX column) and `src/cardVfx.js`.
- **Always run, in this order:**
  ```bash
  npm run card-audit
  npm run card-vfx-audit   # if VFX touched
  npm run smoke
  npm run build
  ```
- If you can't confirm a card's behaviour from code, **mark it "Needs human review" here rather than guessing.**

---

## 9. Optional helper audit

A guide-vs-pool consistency script (`scripts/card-skill-guide-audit.mjs`) was **considered but not added** in this task, to avoid fragile markdown parsing and ongoing maintenance churn (the doc would have to match an exact table format forever).

The existing audits already cover the load-bearing invariants:
- `npm run card-audit` — every card id/rarity/asset/flag is valid and every flag is read.
- `npm run card-vfx-audit` — every Elite/Mythic card has a VFX entry and no orphans.

**The cheap, non-fragile guard that matters** is human discipline: when you add/remove a card, update §2 here in the same PR (checklist §7 enforces it). If a future maintainer wants automation, the minimal safe check is: parse card ids from `CARD_POOL` and assert each appears verbatim in this file's §2 — but only add it if the table format is frozen first.
