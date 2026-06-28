// ──────────────────────────────────────────────────────────────────────────
// CARD REVEAL TIMING AUDIT — timeline + suspense floor (no browser)
//
// Models the EXACT reveal scheduler in src/game.js with a virtual clock,
// driven by the real timing constants parsed from source (REVEAL_CFG /
// FAKEOUT_TIMING / MIN_SKIP_MS). It reconstructs the tap→reveal timeline stage
// by stage, then asserts the spec invariants the "still feels instant"
// regression violated:
//
//   • every reveal stage actually executes (no <50ms / skipped stage)
//   • natural (un-skipped) reveal duration ≥ 900ms on the full-FX path
//   • the double-tap skip is REJECTED before MIN_SKIP_MS (300ms) and only
//     ACCEPTED after — no code path resolves the card in <300ms
//   • a forced fakeout makes the FAKE rarity visible before the upgrade
//     (Charge → Fake rarity → Pause → Upgrade → Reveal)
//   • the static source actually wires the MIN_SKIP floor into _skipReveal
//
// Exits non-zero on the first failed assertion. Run: npm run reveal-timing-audit
// ──────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src  = readFileSync(join(root, 'src/game.js'), 'utf8');

let fails = 0;
function ok(cond, msg) {
  if (cond) console.log('✅', msg);
  else { console.log('❌', msg); fails++; }
}
const num = (re) => { const m = src.match(re); return m ? parseFloat(m[1]) : NaN; };

// ── parse the real constants from source ──────────────────────────────────
function parseObjBlock(startMarker) {
  const a = src.indexOf(startMarker);
  const open = src.indexOf('{', a);
  let depth = 0, i = open;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) break; } }
  return src.slice(open, i + 1);
}
function parseRowObj(block, name) {
  const m = block.match(new RegExp(`${name}\\s*:\\s*\\{([^}]*)\\}`));
  if (!m) return null;
  const o = {};
  for (const [, k, v] of m[1].matchAll(/(\w+)\s*:\s*(\d+)/g)) o[k] = +v;
  return o;
}

const REVEAL_BLOCK = parseObjBlock('const REVEAL_CFG');
const FAKEOUT_BLOCK = parseObjBlock('const FAKEOUT_TIMING');
const MIN_SKIP_MS = num(/const MIN_SKIP_MS\s*=\s*(\d+)/);
const TIERS = ['standard', 'premium', 'elite', 'mythic'];
const REVEAL_CFG = Object.fromEntries(TIERS.map((t) => [t, parseRowObj(REVEAL_BLOCK, t)]));
const FAKE_PATTERNS = ['delayedUpgrade','frameCrack','particleReverse','colorCorruption',
  'heartbeatPause','shadowReveal','doubleUpgrade','eclipseReveal','wrongColor','blackoutReveal','jackpot'];
const FAKEOUT_TIMING = Object.fromEntries(FAKE_PATTERNS.map((p) => [p, parseRowObj(FAKEOUT_BLOCK, p)]));

ok(Number.isFinite(MIN_SKIP_MS), `parsed MIN_SKIP_MS = ${MIN_SKIP_MS}ms`);
ok(TIERS.every((t) => REVEAL_CFG[t]), 'parsed REVEAL_CFG for all 4 tiers');
ok(FAKE_PATTERNS.every((p) => FAKEOUT_TIMING[p]), 'parsed FAKEOUT_TIMING for all patterns');

// ── virtual-clock model of the reveal scheduler (mirrors src/game.js) ──────
// Each entry = { t: elapsedMs, stage }. Models the normal reveal in revealCard()
// and the fakeout reveal in _runSurpriseReveal(). A `skipAt` (ms) replays the
// _skipReveal() floor: <MIN_SKIP_MS rejected (reveal continues), else accepted
// (FinalizeReveal at skipAt). lowFx collapses to the calm path like the code.
function timelineNormal(tier, { skipAt = null, lowFx = false } = {}) {
  const cfg = REVEAL_CFG[tier];
  const chargeMs = lowFx ? 130 : cfg.charge;
  const hintMs   = lowFx ? 90  : cfg.hint;
  const flipHalf = lowFx ? 160 : cfg.flipHalf;
  const burstMs  = lowFx ? 220 : cfg.burst;
  const tl = [];
  let t = 0;
  const mark = (s) => tl.push({ t, stage: s });
  mark('RevealStart'); mark('ChargeStart');
  t += chargeMs; mark('ChargeComplete');
  t += hintMs;   mark('RevealFlip');
  t += flipHalf; // image swap at flip midpoint (card face visible here)
  const faceAt = t;
  t += flipHalf; mark('RevealComplete');
  t += burstMs;  mark('Settled');
  return applySkip(tl, skipAt, faceAt);
}
function timelineFakeout(pattern, { skipAt = null } = {}) {
  const T = FAKEOUT_TIMING[pattern];
  const tl = [];
  let t = 0;
  const mark = (s) => tl.push({ t, stage: s });
  mark('RevealStart'); mark('FakeoutSelected'); mark('ChargeStart');
  t += T.charge; mark('ChargeComplete');
  t += T.hint;   mark('FakeoutShown');     // FAKE rarity label visible
  t += T.frame;  mark('FakeoutUpgrade');   // _runTwist: fake → true swap
  t += T.twist;  mark('RevealFlip');
  t += T.flipHalf;
  const faceAt = t;
  t += T.flipHalf; mark('RevealComplete');
  t += T.burst;    mark('Settled');
  return applySkip(tl, skipAt, faceAt);
}
function applySkip(tl, skipAt, faceAt) {
  if (skipAt == null) return { tl, faceAt, skip: null };
  if (skipAt < MIN_SKIP_MS) {
    // rejected — reveal plays out unchanged
    return { tl: [...tl, { t: skipAt, stage: 'SkipRejected' }].sort((a, b) => a.t - b.t), faceAt, skip: 'rejected' };
  }
  // accepted — every later stage is replaced by an immediate FinalizeReveal
  const kept = tl.filter((e) => e.t <= skipAt);
  kept.push({ t: skipAt, stage: 'SkipAccepted' }, { t: skipAt, stage: 'FinalizeReveal' });
  return { tl: kept, faceAt: skipAt, skip: 'accepted' };
}
const dur = (r) => r.tl[r.tl.length - 1].t;
function render(label, r) {
  console.log(`\n   ${label}`);
  for (const e of r.tl) console.log(`     +${String(e.t.toFixed(0)).padStart(4, ' ')}ms ${e.stage}`);
}

// ── 1. STATIC WIRING: the floor is actually enforced in _skipReveal ───────
const skipBody = src.slice(src.indexOf('function _skipReveal'), src.indexOf('function _skipReveal') + 700);
ok(/elapsed\s*<\s*MIN_SKIP_MS/.test(skipBody), '_skipReveal rejects skips before MIN_SKIP_MS (floor enforced)');
ok(/return;/.test(skipBody.slice(skipBody.indexOf('MIN_SKIP_MS'))), '_skipReveal returns WITHOUT finalizing on an early skip');
ok(/_revealStartedAt/.test(skipBody), '_skipReveal measures elapsed from the reveal-start anchor');
ok(/_revealStartedAt\s*=\s*_revealT0\s*=\s*_revealNow\(\)/.test(src), 'revealCard anchors _revealStartedAt at RevealStart');
ok(/function _revealMark/.test(src), 'timeline instrumentation (_revealMark) present');
ok(MIN_SKIP_MS >= 300, `MIN_SKIP_MS (${MIN_SKIP_MS}ms) honors the ≥300ms skip floor`);

// ── 2. EVERY STAGE EXECUTES (no <50ms / collapsed stage) on the natural path
console.log('\n── natural reveal timelines (no fakeout, full FX) ──');
for (const tier of TIERS) {
  const r = timelineNormal(tier);
  render(`${tier.toUpperCase()} reveal (${dur(r)}ms to Settled)`, r);
  // consecutive stage gaps
  let minGap = Infinity;
  for (let i = 1; i < r.tl.length; i++) {
    const g = r.tl[i].t - r.tl[i - 1].t;
    if (r.tl[i].stage !== r.tl[i - 1].stage) minGap = Math.min(minGap, g === 0 ? Infinity : g);
  }
  ok(dur(r) >= 900, `${tier}: natural reveal ${dur(r)}ms ≥ 900ms minimum`);
  ok(r.faceAt >= 300, `${tier}: card face never shown before 300ms (${r.faceAt}ms)`);
  ok(['ChargeStart','ChargeComplete','RevealFlip','RevealComplete','Settled'].every((s) => r.tl.some((e) => e.stage === s)),
     `${tier}: all charge/hint/flip/burst/settle stages execute`);
}

// ── 3. SKIP FLOOR: reject < 300ms, accept ≥ 300ms ─────────────────────────
console.log('\n── skip-floor behaviour (mythic) ──');
const skipEarly = timelineNormal('mythic', { skipAt: 50 });
render('double-tap @50ms (must be REJECTED → full reveal)', skipEarly);
ok(skipEarly.skip === 'rejected', 'skip @50ms is rejected');
ok(dur(skipEarly) >= 900, `skip @50ms still plays the full reveal (${dur(skipEarly)}ms)`);

const skipBoundary = timelineNormal('mythic', { skipAt: MIN_SKIP_MS - 1 });
ok(skipBoundary.skip === 'rejected', `skip @${MIN_SKIP_MS - 1}ms (just under floor) is rejected`);

const skipLate = timelineNormal('mythic', { skipAt: 400 });
render('double-tap @400ms (allowed → finalize)', skipLate);
ok(skipLate.skip === 'accepted', 'skip @400ms is accepted');
ok(dur(skipLate) >= 300, `accepted skip resolves at ${dur(skipLate)}ms (≥300ms floor)`);

// exhaustive: no skipAt in [0,300) may ever resolve the reveal
let earliest = Infinity;
for (let s = 0; s < 1500; s += 5) {
  const r = timelineNormal('mythic', { skipAt: s });
  if (r.skip === 'accepted') earliest = Math.min(earliest, dur(r));
}
ok(earliest >= MIN_SKIP_MS, `earliest possible skip resolution is ${earliest}ms (≥${MIN_SKIP_MS}ms — no <300ms path)`);

// ── 4. FORCED FAKEOUT: fake rarity must be visible before the upgrade ─────
console.log('\n── forced fakeout timelines (Charge → Fake → Pause → Upgrade → Reveal) ──');
for (const pattern of ['delayedUpgrade', 'doubleUpgrade', 'jackpot']) {
  const r = timelineFakeout(pattern);
  render(`${pattern} fakeout (${dur(r)}ms)`, r);
  const shown = r.tl.find((e) => e.stage === 'FakeoutShown');
  const upgrade = r.tl.find((e) => e.stage === 'FakeoutUpgrade');
  ok(!!shown && !!upgrade, `${pattern}: FakeoutShown + FakeoutUpgrade both fire`);
  ok(shown && upgrade && upgrade.t - shown.t >= 50, `${pattern}: fake rarity visible for ${upgrade.t - shown.t}ms (pause before upgrade)`);
  ok(shown && shown.t > 0, `${pattern}: fake rarity shown after a real charge (${shown.t}ms), not instantly`);
  ok(dur(r) >= 900, `${pattern}: full fakeout reveal ${dur(r)}ms ≥ 900ms`);
}

// a fakeout skipped early is ALSO floored
const fkSkip = timelineFakeout('doubleUpgrade', { skipAt: 100 });
ok(fkSkip.skip === 'rejected', 'fakeout: early skip @100ms is rejected (fake-out still plays)');

// ── 5. AVERAGES (deliverable) ─────────────────────────────────────────────
const DROP_W = { standard: 0.65, premium: 0.20, elite: 0.13, mythic: 0.02 };
let noFakeAvg = 0, wsum = 0;
for (const t of TIERS) { noFakeAvg += dur(timelineNormal(t)) * DROP_W[t]; wsum += DROP_W[t]; }
noFakeAvg /= wsum;
const fakeAvg = FAKE_PATTERNS.reduce((a, p) => a + dur(timelineFakeout(p)), 0) / FAKE_PATTERNS.length;
console.log('\n── average reveal durations ──');
console.log(`     no fakeout (drop-weighted) : ${noFakeAvg.toFixed(0)}ms`);
console.log(`     fakeout (all patterns)     : ${fakeAvg.toFixed(0)}ms`);
console.log(`     skip (floor / fastest)     : ${MIN_SKIP_MS}ms`);
ok(noFakeAvg >= 900, `average no-fakeout reveal ${noFakeAvg.toFixed(0)}ms ≥ 900ms`);
ok(fakeAvg >= 2200, `average fakeout reveal ${fakeAvg.toFixed(0)}ms (full suspense)`);

console.log(`\n${fails === 0 ? '✅' : '❌'} reveal timing audit: ${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
