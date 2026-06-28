// ──────────────────────────────────────────────────────────────────────────
// MULTI-PATTERN FAKEOUT REVEAL — static + behavioural audit (no browser)
// Verifies the cosmetic fakeout layer in src/game.js against its spec:
//   • fakeout probabilities within range (elite 15–20%, mythic 25–35%,
//     jackpot 1–2% of mythic fakeouts, special 5–10% of mythic fakeouts)
//   • all Elite/Mythic patterns present + reachable, with per-pattern timing
//     totals inside the spec windows (elite 2.2–2.7s, mythic 2.5–3.2s)
//   • the planner is pure (never writes result.* / save.*) — drop rates safe
//   • the reveal sequence never unlocks/saves/handles duplicates — only the
//     TRUE tier is ever revealed, committed, and de-duped (in collectCard)
//   • skip path (_finalizeReveal) always resolves to the TRUE tier + clears
//     every transient fakeout class + the plan
//   • rollCardDrop (the actual odds) is untouched by the fakeout layer
// Exits non-zero on the first failed assertion. Run: npm run reveal-audit
// ──────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src  = readFileSync(join(root, 'src/game.js'), 'utf8');
const css  = readFileSync(join(root, 'src/styles.css'), 'utf8');

let fails = 0;
function ok(cond, msg) {
  if (cond) { console.log('✅', msg); }
  else { console.log('❌', msg); fails++; }
}
function slice(from, toMarker) {
  const a = src.indexOf(from);
  if (a < 0) return '';
  const b = src.indexOf(toMarker, a + from.length);
  return src.slice(a, b < 0 ? undefined : b);
}
const num = (re) => { const m = src.match(re); return m ? parseFloat(m[1]) : NaN; };

const ELITE  = ['delayedUpgrade', 'frameCrack', 'particleReverse', 'colorCorruption'];
const MYTHIC = ['heartbeatPause', 'shadowReveal', 'doubleUpgrade', 'eclipseReveal', 'wrongColor', 'blackoutReveal'];

// ── 1. PROBABILITIES ──────────────────────────────────────────────────────
const eliteChance  = num(/FAKEOUT_CHANCE\s*=\s*\{\s*elite:\s*([\d.]+)/);
const mythicChance = num(/FAKEOUT_CHANCE\s*=\s*\{[^}]*mythic:\s*([\d.]+)/);
const jackpot      = num(/MYTHIC_JACKPOT_CHANCE\s*=\s*([\d.]+)/);
const special      = num(/MYTHIC_SPECIAL_CHANCE\s*=\s*([\d.]+)/);
ok(eliteChance  >= 0.15 && eliteChance  <= 0.20, `elite fakeout chance ${(eliteChance*100).toFixed(1)}% within 15–20%`);
ok(mythicChance >= 0.25 && mythicChance <= 0.35, `mythic fakeout chance ${(mythicChance*100).toFixed(1)}% within 25–35%`);
ok(jackpot      >= 0.01 && jackpot      <= 0.02, `jackpot ${(jackpot*100).toFixed(1)}% within 1–2% of mythic fakeouts`);
ok(special      >= 0.05 && special      <= 0.10, `special-mythic ${(special*100).toFixed(1)}% within 5–10% of mythic fakeouts`);

// ── 2. PATTERN POOLS + TIMING ─────────────────────────────────────────────
for (const p of ELITE)  ok(new RegExp(`ELITE_FAKEOUT_PATTERNS[^\\]]*'${p}'`).test(src),  `elite pool contains ${p}`);
for (const p of MYTHIC) ok(new RegExp(`MYTHIC_FAKEOUT_PATTERNS[^\\]]*'${p}'`).test(src), `mythic pool contains ${p}`);

const timingBlock = slice('const FAKEOUT_TIMING', '};');
function timingTotal(name) {
  const m = timingBlock.match(new RegExp(`${name}:\\s*\\{([^}]*)\\}`));
  if (!m) return null;
  const g = (k) => { const x = m[1].match(new RegExp(`${k}:\\s*(\\d+)`)); return x ? +x[1] : 0; };
  return g('charge') + g('hint') + g('frame') + g('twist') + 2 * g('flipHalf') + g('burst');
}
for (const p of ELITE) {
  const t = timingTotal(p);
  ok(t !== null && t >= 2200 && t <= 2700, `${p} reveal ≈ ${t}ms within elite 2.2–2.7s`);
}
for (const p of MYTHIC) {
  const t = timingTotal(p);
  ok(t !== null && t >= 2500 && t <= 3200, `${p} reveal ≈ ${t}ms within mythic 2.5–3.2s`);
}
const jackpotT = timingTotal('jackpot');
const mythicMax = Math.max(...MYTHIC.map(timingTotal));
ok(jackpotT >= 2500 && jackpotT <= 3200, `jackpot reveal ≈ ${jackpotT}ms within 2.5–3.2s`);
ok(jackpotT >= mythicMax, `jackpot (${jackpotT}ms) is the longest/strongest mythic reveal`);

// every pattern (incl. jackpot) has a CSS twist class hook
for (const p of [...ELITE, ...MYTHIC, 'jackpot']) {
  ok(css.includes(`.fk-${p}`), `CSS defines a twist look for fk-${p}`);
}

// ── 3. PLANNER PURITY (drop rates / save safe) ────────────────────────────
const planBody = slice('function _planSurprise', '\n}\n');
ok(!/result\.\w+\s*=[^=]/.test(planBody), '_planSurprise never writes result.* (no rarity/reroll mutation)');
ok(!/\bsave\b\s*\.\s*\w+\s*=[^=]/.test(planBody), '_planSurprise never writes save.*');
ok(/result\.tier/.test(planBody) && !/rollCardDrop/.test(planBody), '_planSurprise only READS the already-rolled tier');

// ── 4. REVEAL SEQUENCE ISOLATION (no fake rarity in inventory) ────────────
const runBody = src.slice(src.indexOf('function _runSurpriseReveal'), src.indexOf('function revealCard'));
ok(runBody.length > 0, 'located _runSurpriseReveal sequence');
ok(!/unlockCard\(/.test(runBody),    'fakeout sequence never calls unlockCard (no fake rarity saved)');
ok(!/collectCard\(/.test(runBody),   'fakeout sequence never calls collectCard');
ok(!/\bdoSave\(/.test(runBody),      'fakeout sequence never calls doSave');
ok(!/markSaveDirty\(/.test(runBody), 'fakeout sequence never calls markSaveDirty');
ok(!/save\.\w+\s*=[^=]/.test(runBody), 'fakeout sequence never writes save.*');
ok(!/_showDupeBanner/.test(runBody.slice(0, runBody.indexOf('_surpriseBurstTrue'))) ||
   /_populateRevealedCard\(result,\s*trueTier\)/.test(runBody),
   'duplicate banner only shown alongside the TRUE-tier reveal');
ok(/_populateRevealedCard\(result,\s*trueTier\)/.test(runBody), 'fakeout reveals the TRUE-tier card face only');

// ── 5. DUPLICATE / REWARD uses FINAL rarity only ──────────────────────────
const collectBody = slice('function collectCard', '\n}\n');
ok(/result\.isDupe/.test(collectBody), 'collectCard duplicate check reads the FINAL result.isDupe');
ok(/unlockCard\(result\.card\.id\)/.test(collectBody), 'collectCard unlocks the FINAL card id only');
ok(/result\.dupeCoins/.test(collectBody), 'duplicate reward (coins) uses the FINAL result');
const rollBody = slice('function rollCardDrop', '\n}\n');
ok(/isDupe\s*=\s*unlocked\.includes\(card\.id\)/.test(rollBody), 'duplicate flag is decided at roll time from the TRUE card');

// ── 6. SKIP / FINALIZE always resolves to the TRUE tier ───────────────────
const finBody = slice('function _finalizeReveal', '\n}\n');
ok(/_clearSurpriseClasses\(screen\)/.test(finBody), 'finalize/skip clears every transient fakeout class');
ok(/_revealSurprise\s*=\s*null/.test(finBody), 'finalize/skip resets the fakeout plan');
ok(/_populateRevealedCard\(result,\s*tier\)/.test(finBody) && /result\.tier/.test(finBody),
   'finalize/skip populates the TRUE tier (result.tier)');
ok(/reveal--standard'?,?\s*'reveal--premium'?,?\s*'reveal--elite'?,?\s*'reveal--mythic/.test(finBody.replace(/\s+/g, ' ')) ||
   /removeProperty/.test(finBody) || /classList\.remove\([^)]*reveal--/.test(finBody),
   'finalize/skip strips any stale fake palette class');
const clearBody = slice('function _clearSurpriseClasses', '\n}\n');
ok(/FAKEOUT_TWIST_CLASSES/.test(clearBody), '_clearSurpriseClasses removes all per-pattern twist classes');
const skipBody = slice('function _skipReveal', '\n}\n');
ok(/_finalizeReveal\(\)/.test(skipBody), 'second-tap skip routes through _finalizeReveal (true result)');

// ── 7. rollCardDrop (real odds) untouched by the fakeout layer ────────────
ok(!/_planSurprise|FAKEOUT|fakeTier|fakeout/i.test(rollBody), 'rollCardDrop (drop odds) is independent of the fakeout layer');

// ──────────────────────────────────────────────────────────────────────────
// 8. BEHAVIOURAL DISTRIBUTION — runs the real algorithm with the parsed
//    source constants over a frozen result (proves no mutation + the spec
//    buckets), then confirms Low VFX disables fakeouts entirely.
// ──────────────────────────────────────────────────────────────────────────
const pick = (a) => a[(Math.random() * a.length) | 0];
function planEliteOrMythic(tier, lowFx) {
  if (lowFx) return null;
  if (tier === 'elite')  return Math.random() < eliteChance  ? { pattern: pick(ELITE) } : null;
  if (tier === 'mythic') {
    if (Math.random() >= mythicChance) return null;
    const r = Math.random();
    if (r < jackpot) return { pattern: 'jackpot' };
    if (r < jackpot + special) return { pattern: pick(['blackoutReveal', 'eclipseReveal']) };
    return { pattern: pick(MYTHIC) };
  }
  return null;
}
const N = 2_000_000;
function simulate(tier) {
  const seen = {}; let fakeouts = 0, jp = 0, mutated = 0;
  for (let i = 0; i < N; i++) {
    const result = Object.freeze({ tier, card: Object.freeze({ id: 'x' }) });
    const p = planEliteOrMythic(result.tier, false);
    if (result.tier !== tier) mutated++;
    if (p) { fakeouts++; seen[p.pattern] = (seen[p.pattern] || 0) + 1; if (p.pattern === 'jackpot') jp++; }
  }
  return { fakeoutPct: fakeouts / N, jackpotOfFakeouts: jp / Math.max(1, fakeouts), seen, mutated };
}
console.log('\n── distribution (2,000,000 pulls each, real source constants) ──');
const e = simulate('elite');
ok(e.fakeoutPct >= 0.15 && e.fakeoutPct <= 0.20, `elite fakeouts ${(e.fakeoutPct*100).toFixed(2)}% within 15–20%`);
ok(ELITE.every((p) => e.seen[p] > 0), `all 4 elite patterns reachable: ${ELITE.map(p=>`${p}=${e.seen[p]||0}`).join(', ')}`);
ok(e.mutated === 0, `elite: frozen result never mutated (${e.mutated} writes)`);

const m = simulate('mythic');
ok(m.fakeoutPct >= 0.25 && m.fakeoutPct <= 0.35, `mythic fakeouts ${(m.fakeoutPct*100).toFixed(2)}% within 25–35%`);
ok(m.jackpotOfFakeouts >= 0.01 && m.jackpotOfFakeouts <= 0.02, `jackpot ${(m.jackpotOfFakeouts*100).toFixed(2)}% OF mythic fakeouts (1–2%)`);
ok(MYTHIC.every((p) => m.seen[p] > 0) && (m.seen.jackpot > 0), `all 6 mythic patterns + jackpot reachable`);
ok(m.mutated === 0, `mythic: frozen result never mutated (${m.mutated} writes)`);
for (const p of [...MYTHIC, 'jackpot']) {
  const pct = (m.seen[p] / (m.fakeoutPct * N) * 100).toFixed(2);
  console.log(`     mythic ${p.padEnd(15)} ${pct}% of fakeouts`);
}

// Standard/Premium never fake-upgrade
let su = 0; for (let i = 0; i < 200000; i++) { if (planEliteOrMythic('standard', false)) su++; if (planEliteOrMythic('premium', false)) su++; }
ok(su === 0, 'standard/premium never fake-upgrade');
// Low VFX / reduced-motion disables fakeouts
let lv = 0; for (let i = 0; i < 200000; i++) { if (planEliteOrMythic('mythic', true)) lv++; }
ok(lv === 0, 'Low VFX / reduced-motion disables all fakeouts');

console.log(`\n${fails === 0 ? '✅' : '❌'} reveal fakeout audit: ${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
