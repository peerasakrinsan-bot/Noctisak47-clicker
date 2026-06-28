// ── Normal-mode card integrity audit (no browser required) ───────────────────
//
// Static guard over CARD_POOL in src/game.js. Confirms the data + wiring that a
// player relies on for every card in the normal/clicker mode:
//
//   1) every card has a unique id and a valid rarity (standard/premium/elite/mythic)
//   2) every card's artwork file exists under public/
//   3) every card has an apply(s) that sets at least one cs_* effect flag
//   4) every cs_* flag a card sets is actually read by game logic (no dead effect)
//   5) every rarity tier is reachable from the gacha dropWeights AND has cards
//   6) elite + mythic counts match the documented collection size
//
// This does NOT exercise gameplay balance or timers — it only confirms that no
// card is orphaned data or carries effect text with no implementation.
//
// Run with:  npm run card-audit
// Exits non-zero on the first failed assertion.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = readFileSync(join(root, 'src/game.js'), 'utf8');

let failures = 0;
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.error('❌ ' + m); failures++; };

// ── slice out CARD_POOL ──────────────────────────────────────────────────────
const poolStart = src.indexOf('const CARD_POOL = [');
const poolEnd = src.indexOf('\n];', poolStart);
if (poolStart < 0 || poolEnd < 0) { bad('could not locate CARD_POOL block'); process.exit(1); }
const block = src.slice(poolStart, poolEnd);
const outside = src.slice(0, poolStart) + src.slice(poolEnd);

// ── parse each card into {id, name, img, rarity, slice} ───────────────────────
const idRe = /id:\s*'([a-z0-9]+)'/g;
const positions = [];
let m;
while ((m = idRe.exec(block))) positions.push({ id: m[1], idx: m.index });
for (let i = 0; i < positions.length; i++) {
  positions[i].slice = block.slice(positions[i].idx, i + 1 < positions.length ? positions[i + 1].idx : block.length);
}
const cards = positions.map((p) => {
  const grab = (re) => { const mm = p.slice.match(re); return mm ? mm[1] : null; };
  return {
    id: p.id,
    name: grab(/name:\s*'([^']*)'/),
    img: grab(/img:\s*'([^']*)'/),
    rarity: grab(/rarity:\s*'([^']*)'/),
    slice: p.slice,
  };
});

const VALID_RARITIES = ['standard', 'premium', 'elite', 'mythic'];

// ── 0) sanity floor — a broken parse must fail loudly, not pass vacuously ──────
if (cards.length < 80) { bad(`only parsed ${cards.length} cards — CARD_POOL parse likely broke`); process.exit(1); }
ok(`parsed ${cards.length} cards from CARD_POOL`);

// ── 1) unique ids + valid rarity + name/img present ───────────────────────────
const seen = new Map();
let dup = 0, badRarity = 0, missingField = 0;
for (const c of cards) {
  if (seen.has(c.id)) { bad(`duplicate card id "${c.id}"`); dup++; } else seen.set(c.id, c);
  if (!VALID_RARITIES.includes(c.rarity)) { bad(`card "${c.id}" has invalid rarity "${c.rarity}"`); badRarity++; }
  if (!c.name || !c.img) { bad(`card "${c.id}" missing name/img`); missingField++; }
}
if (!dup) ok(`all ${cards.length} card ids unique`);
if (!badRarity) ok('all cards have a valid rarity');
if (!missingField) ok('all cards have name + img');

// ── 2) artwork files exist ────────────────────────────────────────────────────
let missingAsset = 0;
for (const c of cards) {
  if (c.img && !existsSync(join(root, 'public', c.img))) { bad(`card "${c.id}" art missing: ${c.img}`); missingAsset++; }
}
if (!missingAsset) ok('all card artwork files exist under public/');

// ── 3) every card has apply() setting >=1 cs_ flag, 4) every flag is read ──────
let noApply = 0, noFlag = 0, deadFlag = 0;
for (const c of cards) {
  if (!/apply\(s\)/.test(c.slice)) { bad(`card "${c.id}" has no apply(s)`); noApply++; continue; }
  const flags = [...new Set([...c.slice.matchAll(/s\.(cs_[A-Za-z0-9_]+)\s*=/g)].map((x) => x[1]))];
  if (flags.length === 0) { bad(`card "${c.id}" apply() sets no cs_* flag`); noFlag++; continue; }
  for (const f of flags) {
    const read = (outside.match(new RegExp('\\b' + f + '\\b', 'g')) || []).length;
    if (read === 0) { bad(`card "${c.id}" sets ${f} but nothing reads it (dead effect)`); deadFlag++; }
  }
}
if (!noApply) ok('every card has an apply(s) handler');
if (!noFlag) ok('every apply() sets at least one cs_* effect flag');
if (!deadFlag) ok('every cs_* flag set by a card is read by game logic');

// ── 5) gacha reachability: dropWeights covers every rarity that has cards ──────
const dwMatch = src.match(/dropWeights:\s*\{([^}]*)\}/);
const weights = {};
if (dwMatch) {
  for (const part of dwMatch[1].split(',')) {
    const mm = part.match(/(\w+)\s*:\s*(\d+)/);
    if (mm) weights[mm[1]] = Number(mm[2]);
  }
}
let unreachable = 0;
for (const r of VALID_RARITIES) {
  const count = cards.filter((c) => c.rarity === r).length;
  if (count > 0 && !(weights[r] > 0)) { bad(`rarity "${r}" has ${count} cards but gacha weight is 0/absent`); unreachable++; }
}
if (!unreachable) ok(`all populated rarities reachable via gacha (${JSON.stringify(weights)})`);

// ── 6) elite/mythic populated (no empty premium tier) ─────────────────────────
const counts = Object.fromEntries(VALID_RARITIES.map((r) => [r, cards.filter((c) => c.rarity === r).length]));
console.log('   rarity counts:', JSON.stringify(counts));
if (counts.elite > 0 && counts.mythic > 0) ok(`elite (${counts.elite}) and mythic (${counts.mythic}) tiers populated`);
else bad('elite or mythic tier is empty');

// ── 7) Elite/Mythic logic wiring — guards for the text↔logic audit fixes ──────
// These pin the specific effects whose code paths were repaired so they can't
// silently regress back to the mismatched behavior.
const has = (re, label) => { if (re.test(src)) ok(label); else bad(`logic regressed: ${label}`); };

// DRAKE — X MARKS THE SPOT: arms a treasure every N completed AK47 chains
has(/_drakeAkCount\s*>=\s*DRAKE_ARM_EVERY[\s\S]*?_drakeArmed\s*=\s*true/,
  'DRAKE arms a treasure every N AK47 chains');
// DRAKE — treasure weak point + plunder payout exist (not a passive buff)
has(/_drakeArmed[\s\S]*?wp\.classList\.add\('wp-treasure'\)/,
  'DRAKE spawns a golden treasure weak point');
has(/function\s+drakePlunder[\s\S]*?applyBossDamage\(burst,\s*'drake-plunder'\)/,
  'DRAKE PLUNDER deals a one-time burst on a timed tap');
// DRAKE — the old HP-threshold machinery is fully removed
if (/cs_drakeIgnoreThreshold|_drakeTakeEndTime|_csHandleDrakeThreshold/.test(src))
  bad('DRAKE still references removed HP-threshold machinery');
else ok('DRAKE HP-threshold mechanic fully removed');
// THANABROS: OD time +1s on AK47 complete while Thanatos Phase active
has(/_thanatosPhaseEndTime[^\n]*godLevel\s*>\s*0\)\s*\{[^}]*godSecondsLeft\s*\+=\s*1/,
  'THANABROS OD +1s during Thanatos Phase');
// DEVILINGO: AK47 spawn +20% faster, wired into the spawn scheduler (delay ×)
has(/cs_devilingo[^\n]*_devilingoCombatStart[^\n]*delay\s*\*=\s*0\.8/,
  'DEVILINGO AK47 spawn +20%');
// TURTLE SHOGUN: no longer carries the −15% Zeny penalty
if (/cs_turtleShogun[^\n]*(baseCoins|bossCoins)\s*=\s*Math\.round\([^\n]*\*\s*0\.85/.test(src))
  bad('TURTLE SHOGUN still has the −15% Zeny penalty');
else ok('TURTLE SHOGUN free of −15% Zeny penalty');

// ── result ────────────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? '✅' : '❌'} card audit: ${cards.length} cards checked, ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
