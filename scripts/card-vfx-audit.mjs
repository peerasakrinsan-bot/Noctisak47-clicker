// ── Elite/Mythic card VFX integrity audit (no browser required) ──────────────
//
// Static + runtime guard over src/cardVfx.js. Confirms the cosmetic VFX layer
// added for normal/clicker mode is complete and safe:
//
//   1) every Elite/Mythic card in CARD_POOL has a VFX_MAP entry
//   2) every VFX_MAP key is a real Elite/Mythic card id (no orphan mappings)
//   3) every aura uses a known style, every `on` context uses a known primitive
//   4) the helper no-ops safely when DOM targets are missing
//   5) trigger / setActiveCard tolerate unknown ids without throwing
//   6) reduced-motion is honored (reducedMotion() reflects the media query)
//   7) the VFX module never touches card logic (no _csState / save / cs_ writes)
//
// Run with:  npm run card-vfx-audit
// Exits non-zero on the first failed assertion.

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let failures = 0;
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.error('❌ ' + m); failures++; };

// ── parse Elite/Mythic ids out of CARD_POOL (mirrors card-audit.mjs) ──────────
const src = readFileSync(join(root, 'src/game.js'), 'utf8');
const poolStart = src.indexOf('const CARD_POOL = [');
const poolEnd = src.indexOf('\n];', poolStart);
if (poolStart < 0 || poolEnd < 0) { bad('could not locate CARD_POOL block'); process.exit(1); }
const block = src.slice(poolStart, poolEnd);
const idRe = /id:\s*'([a-z0-9]+)'/g;
const positions = [];
let m;
while ((m = idRe.exec(block))) positions.push({ id: m[1], idx: m.index });
for (let i = 0; i < positions.length; i++) {
  positions[i].slice = block.slice(positions[i].idx, i + 1 < positions.length ? positions[i + 1].idx : block.length);
}
const emCards = positions
  .map((p) => ({ id: p.id, rarity: (p.slice.match(/rarity:\s*'([^']*)'/) || [])[1] }))
  .filter((c) => c.rarity === 'elite' || c.rarity === 'mythic');

if (emCards.length < 30) { bad(`only parsed ${emCards.length} Elite/Mythic cards — parse likely broke`); process.exit(1); }
ok(`parsed ${emCards.length} Elite/Mythic cards from CARD_POOL`);

// ── minimal DOM / window stubs so cardVfx.js can be imported ──────────────────
let _reducedStub = false; // flipped before a second import for the reduced-motion check
function mkEl() {
  const el = {
    id: '', className: '', innerHTML: '', isConnected: true,
    style: {
      cssText: '', _p: {},
      setProperty(k, v) { this._p[k] = v; },
      removeProperty(k) { delete this._p[k]; },
    },
    classList: { _s: new Set(),
      add(...a) { a.forEach((x) => this._s.add(x)); },
      remove(...a) { a.forEach((x) => this._s.delete(x)); },
      contains(x) { return this._s.has(x); } },
    children: [],
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    setAttribute() {},
    getBoundingClientRect() { return { left: 100, top: 100, width: 80, height: 120 }; },
  };
  return el;
}

function installDom({ hasRoot = true } = {}) {
  const els = {};
  global.window = {
    innerWidth: 360, innerHeight: 640,
    matchMedia: () => ({ matches: _reducedStub, addEventListener() {}, addListener() {} }),
  };
  global.document = {
    getElementById: (id) => {
      if (id === 'gameRoot' && !hasRoot) return null;
      return (els[id] ||= Object.assign(mkEl(), { id }));
    },
    createElement: () => mkEl(),
    body: mkEl(),
  };
  global.setTimeout = (fn) => { /* never fire — keep audit synchronous */ return 0; };
  return els;
}

// fresh import each time (bust ESM cache via query string)
async function freshImport() {
  return import(pathToFileURL(join(root, 'src/cardVfx.js')).href + '?t=' + Date.now() + Math.random());
}

// ── 1 + 2) mapping completeness + no orphans ─────────────────────────────────
installDom();
const mod = await freshImport();
const VFX_MAP = mod.VFX_MAP;
const mapped = new Set(Object.keys(VFX_MAP));
const emIds = new Set(emCards.map((c) => c.id));

let missing = 0;
for (const c of emCards) {
  if (!mapped.has(c.id)) { bad(`Elite/Mythic card "${c.id}" (${c.rarity}) has NO VFX_MAP entry`); missing++; }
}
if (!missing) ok(`all ${emCards.length} Elite/Mythic cards have a VFX_MAP entry`);

let orphan = 0;
for (const id of mapped) {
  if (!emIds.has(id)) { bad(`VFX_MAP has entry "${id}" but it is not an Elite/Mythic card`); orphan++; }
}
if (!orphan) ok('no orphan VFX_MAP entries');

// ── 3) every aura style known + every primitive name known ───────────────────
const AURA_STYLES = new Set(['glow', 'pulse', 'drain', 'holy', 'shadow', 'gold', 'frost', 'fire', 'tech', 'moon', 'stake', 'infernal', 'debt', 'valkyrie', 'gloom', 'mecha', 'sacred', 'void', 'analysis', 'hive',
  // Elite Legendary Pass auras
  'mirror', 'venom', 'ice', 'shell', 'plunder', 'abyss', 'funk', 'blood', 'storm', 'night', 'ore', 'phase']);
const PRIMS = new Set(['flash', 'pulse', 'slash', 'spark', 'shadowBurst', 'coinBurst',
  'breakCrack', 'odGlow', 'streak', 'drainPulse', 'comboRing', 'bossFlare', 'moonRing',
  'bolt', 'fireBurst', 'holyBurst', 'glitch',
  'moonPulse', 'crescentArc', 'eclipseRing', 'lunarSpark', 'feverWave',
  'jackpotFlash', 'slotReel', 'cursedCoin', 'stakeRing', 'suitSpark', 'riskPulse',
  'demonSigil', 'contractRing', 'sinEmber', 'devilBetBurst', 'cursedFlame', 'bloodShock',
  'debtSeal', 'debtChain', 'ledgerGlyph', 'collectorPull', 'debtCoinDrain', 'sealBreak',
  'timeStop', 'voidRift', 'reaperScythe', 'deathKnell', 'soulReap',
  'clawRake', 'resonanceWave',
  'insectSwarm', 'comboLock', 'voidZero', 'corruptGlitch', 'goldRush', 'valkyrieDescend', 'gloomSurge',
  'mechaCharge', 'mechaLaser', 'soulGather', 'judgmentSeal', 'gravityWell', 'scanSweep', 'analysisMap',
  'queenSwarm', 'honeycombBurst',
  // Elite Legendary Pass signature primitives
  'mirrorSplit', 'hydraHeads', 'frostShatter', 'shellGuard', 'plunderHaul', 'abyssReap',
  'guillotine', 'funkBeat', 'bloodDraw', 'talismanCut', 'stormStrike', 'nightVeil',
  'phaseDash', 'lagGlitch', 'focusManga', 'oreErupt', 'susWarp', 'darkAwaken', 'idolSpotlight']);
let badAura = 0, badPrim = 0, noEffect = 0;
for (const [id, e] of Object.entries(VFX_MAP)) {
  if (!e.aura || !AURA_STYLES.has(e.aura[0]) || typeof e.aura[1] !== 'string') {
    bad(`card "${id}" has invalid aura: ${JSON.stringify(e.aura)}`); badAura++;
  }
  const ctxs = e.on ? Object.keys(e.on) : [];
  if (ctxs.length === 0) { /* aura-only passive card is allowed */ }
  for (const ctx of ctxs) {
    let specs = e.on[ctx];
    if (Array.isArray(specs[0])) { /* multi */ } else specs = [specs];
    for (const s of specs) {
      if (!Array.isArray(s) || !PRIMS.has(s[0])) { bad(`card "${id}" context "${ctx}" uses unknown primitive: ${JSON.stringify(s)}`); badPrim++; }
    }
  }
}
if (!badAura) ok('every aura uses a known style + color');
if (!badPrim) ok('every `on` context uses a known primitive');

// ── 3b) gameplay metadata: theme + affects + stack (อัปเกรด in-game VFX) ──────
const THEMES  = new Set(['soul', 'idol', 'analysis', 'crit', 'zeny', 'break', 'time', 'moonFever', 'darkJackpot', 'demonContract', 'debtContract', 'thanatos']);
const TARGETS = new Set(['odBar', 'combo', 'timer', 'zeny', 'break', 'enemy', 'player', 'debt']);
let badTheme = 0, badAffects = 0, badStack = 0;
for (const [id, e] of Object.entries(VFX_MAP)) {
  if (!e.theme || !THEMES.has(e.theme)) { bad(`card "${id}" has invalid/missing theme: ${JSON.stringify(e.theme)}`); badTheme++; }
  if (!e.affects || !TARGETS.has(e.affects)) { bad(`card "${id}" has invalid/missing affects target: ${JSON.stringify(e.affects)}`); badAffects++; }
  if (e.stack) {
    const s = e.stack;
    const ctxs = e.on ? Object.keys(e.on) : [];
    if (!s.gain || !(s.max > 0)) { bad(`card "${id}" stack missing gain/max: ${JSON.stringify(s)}`); badStack++; }
    else if (!ctxs.includes(s.gain)) { bad(`card "${id}" stack.gain "${s.gain}" is not a real on-context`); badStack++; }
  }
}
if (!badTheme)   ok('every card has a known theme');
if (!badAffects) ok('every card targets a known gameplay element (affects)');
if (!badStack)   ok('every stack-card binds gain to a real on-context');

// ── 3c) the .game-vfx-* reusable class layer + reduced-motion exist in CSS ────
{
  const css2 = readFileSync(join(root, 'src/styles.css'), 'utf8');
  const needClasses = ['.game-vfx-trigger', '.game-vfx-stack', '.game-vfx-expire',
    '.game-vfx-active-card', '.game-vfx-theme-soul', '.game-vfx-charge', '.game-vfx-tier-1'];
  let missingCls = 0;
  for (const c of needClasses) if (!css2.includes(c)) { bad(`stylesheet missing reusable class ${c}`); missingCls++; }
  if (!missingCls) ok('stylesheet defines the .game-vfx-* reusable class layer');
  if (/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.game-vfx-trigger/.test(css2)) ok('reduced-motion shortens .game-vfx-* effects');
  else bad('stylesheet missing reduced-motion rule for .game-vfx-* effects');
}

// ── 4) safe no-op when DOM target missing (no gameRoot) ──────────────────────
installDom({ hasRoot: false });
const modNoRoot = await freshImport();
let threw = false;
try {
  modNoRoot.CardVFX.trigger('gb', 'break', {});
  modNoRoot.CardVFX.setActiveCard('gb', 'mythic');
  modNoRoot.CardVFX.clearActive();
} catch (e) { threw = true; bad('helper threw when DOM root missing: ' + e.message); }
if (!threw) ok('helper no-ops safely when DOM target missing');

// ── 5) unknown ids tolerated; valid trigger does not throw ───────────────────
installDom();
const modRun = await freshImport();
let threw2 = false;
try {
  modRun.CardVFX.trigger('___nope___', 'break', {});     // unknown id
  modRun.CardVFX.trigger('gb', '___nope___', {});         // unknown context
  modRun.CardVFX.setActiveCard('po', 'standard');         // non Elite/Mythic → clears
  modRun.CardVFX.setActiveCard('th', 'mythic');           // valid
  modRun.CardVFX.trigger('th', 'thanatos', {});           // valid effect
  modRun.CardVFX.trigger('dvl', 'ak47', { x: 10, y: 20 });// valid w/ coords
  modRun.CardVFX.clearCardAura('th');
} catch (e) { threw2 = true; bad('valid/unknown trigger path threw: ' + e.message); }
if (!threw2) ok('trigger/setActiveCard tolerate unknown ids + run valid effects without throwing');

// ── 5b) new gameplay-VFX API exists + stack/target paths don't throw ─────────
const api = modRun.CardVFX;
const needApi = ['targetPulse', 'setStack', 'clearStack', 'expireStack', 'setCharge', 'clearCharge', 'setAuraTier'];
let missApi = 0;
for (const m of needApi) if (typeof api[m] !== 'function') { bad(`CardVFX.${m} missing (gameplay-VFX API)`); missApi++; }
if (!missApi) ok('gameplay-VFX API present (targetPulse/setStack/clearStack/expireStack)');
let threw3 = false;
try {
  api.setActiveCard('mi', 'elite');                 // stack-card aura
  api.trigger('mi', 'oregain', { stack: 1, max: 3 });// stack gain with real value
  api.trigger('mi', 'oregain', { stack: 2, max: 3 });
  api.trigger('mi', 'break', {});                    // stack reset / expire
  api.setActiveCard('os', 'mythic');                 // NOSIRIS soul stack 0–5
  api.trigger('os', 'soulstack', { stack: 5, max: 5 });
  api.trigger('os', 'judgment', {});                 // expire at 5
  api.setActiveCard('bh', 'mythic');                 // BAPHOBET sin stack (no reset) — demonContract
  api.trigger('bh', 'break', {});                    // DEVIL BET wager: contract ring + cursed flame + claw
  api.trigger('bh', 'sinstack', { stack: 3, max: 5, tier: 2 }); // sin gained: ember pull + sigil + aura tier
  api.trigger('bh', 'sinmax', {});                   // CONTRACT SEALED payoff: sigil + blood shock + burst
  api.setActiveCard('dtl', 'mythic');                // DETAILED analysis stack 0–8
  api.trigger('dtl', 'analysis', { stack: 8, max: 8 });
  api.setStack('dtl', 6, 8);                          // WP-miss decrement path
  api.trigger('dtl', 'analysisreset', {});           // reset on BREAK end
  api.trigger('th', 'thanatos', {});                 // affects 'timer' target pulse
  api.setActiveCard('mf', 'elite');                  // MOONLIGHT FEVER — lunar-fever VFX
  api.trigger('mf', 'od', {});                       // eclipse burst (peak): eclipseRing+feverWave+moonPulse+lunarSpark
  api.trigger('mf', 'break', {});                    // moonFever pulse + crescent sweep
  api.trigger('mf', 'ak47', { x: 40, y: 60 });       // crescent sweep + lunar sparks at coord
  api.targetPulse('odBar', '#ffcc33', 'crit');       // direct target pulse
  api.setActiveCard('dsk', 'mythic');                // DARK STAKE LORD — cursed jackpot (darkJackpot)
  api.trigger('dsk', 'break', {});                   // slot-reel spin + dark contract ring (the gamble)
  api.trigger('dsk', 'jackpot', {});                 // 777 flash + cursed coins + suit sparks (payoff → zeny reacts)
  api.trigger('dsk', 'stakeup', {});                 // risk-reward red warning flicker (odds rising)
  // ── aura-only polish paths (GLOOM/IFRIED/LADY TRAINEE/LORD OF DEBT) ──
  api.setActiveCard('os', 'mythic');                 // NOSIRIS — 4-layer soul judgment (sacred aura + world)
  api.trigger('os', 'soulstack', { stack: 3, max: 5, tier: 2 }); // soul gather + tier growth
  api.trigger('os', 'judgment', { tier: 0 });        // JUDGMENT peak + decay
  api.setActiveCard('oh', 'mythic');                 // COKE ZERO — 4-layer void (void aura + world)
  api.trigger('oh', 'od', {});                       // gravity well collapse (OD release)
  api.setAuraTier('oh', 3);                          // void bend tier (DMG stack)
  api.trigger('oh', 'singularity', {});              // peak singularity
  api.setActiveCard('dtl', 'mythic');                // DETAILED — 4-layer analysis (analysis aura + world)
  api.trigger('dtl', 'analysis', { stack: 6, max: 8, tier: 2 }); // scan sweep + tier
  api.trigger('dtl', 'analysiscomplete', {});        // ANALYSIS COMPLETE map peak
  api.trigger('dtl', 'analysisreset', {});           // scan dissolves
  api.setActiveCard('mt', 'mythic');                 // MISSSTRESS — 4-layer hive (hive aura + world)
  api.trigger('mt', 'hive', {});                     // bees join
  api.setCharge('mt', 3, 4);                         // hive-expansion ring
  api.trigger('mt', 'od', {});                       // QUEEN COMMAND swarm
  api.setActiveCard('kl', 'mythic');                 // KILL-D01 — 4-layer war machine (drive tokens 0–8)
  api.trigger('kl', 'token', { stack: 3, max: 8 });  // L2: drive-core charge + pip
  api.trigger('kl', 'break', {});                    // small tech break
  api.trigger('kl', 'discharge', { stack: 0, max: 8 }); // tokens discharged: laser + pip reset
  api.trigger('kl', 'drivedischarge', {});           // L3 peak: DRIVE DISCHARGE laser cannon
  api.setActiveCard('gus', 'mythic');                // GLOOM — 4-layer obsession (aura + world tier)
  api.trigger('gus', 'gloom', { tier: 2 });          // L2: tendril surge scaled by real tier ($tier)
  api.trigger('gus', 'break', {});                   // BREAK gloom surge + shadow
  api.trigger('gus', 'gloommax', { tier: 3 });       // L3 peak: MAX OBSESSION devour (world tier 3)
  api.setActiveCard('if', 'mythic');                 // IFRIED — Inferno Stack lifecycle 0–15
  api.trigger('if', 'emberhit', {});                 // throttled ember (crit gain)
  api.setCharge('if', 12, 15, 10);                   // growth ring + peak-ready (≥10) state
  api.trigger('if', 'infernoready', {});             // crossed peak-ready threshold cue
  api.trigger('if', 'inferno', {});                  // Inferno Burst payoff (decay → idle)
  api.setActiveCard('ltn', 'elite');                 // LADY TRAINEE compact charge ring
  api.trigger('ltn', 'odlevel', { charge: 7, chargeMax: 15 });
  api.trigger('ltn', 'spotlight', {});               // Spotlight stage-light at 10
  api.setActiveCard('ld', 'mythic');                 // LORD OF DEBT — debt contract (debtContract)
  api.trigger('ld', 'debt', { color: '#ff4422', tier: 1, stack: 1 }); // seal ($state→ctx.color) + chains + ledger; aura tier
  api.trigger('ld', 'debtmax', {});                  // MAX DEBT — collector pull (inevitable collection)
  api.trigger('ld', 'break', {});                    // BREAK voids the contract — seal shatter
  api.trigger('ld', 'debtclear', { tier: 0, stacks: 5 }); // debt collected: coin siphon + aura reset
  api.trigger('ld', 'hit', { x: 30, y: 40 });        // BERSERK chained shadow slash
  api.setActiveCard('vr', 'mythic');                 // VALKYRIZZ — 4-layer (aura + persistent world)
  api.trigger('vr', 'break', {});                    // L2 trigger: wing flare + light spear + feathers
  api.trigger('vr', 'valkyrie', {});                 // L3 peak: VALKYRIE SWAP grand descent
  api.setCharge('ltn', 12, 15);                      // direct compact charge
  api.setAuraTier('gus', 3);                         // direct aura tier
  api.clearCharge();
  api.expireStack();
  api.clearStack();
  api.clearActive();
} catch (e) { threw3 = true; bad('gameplay-VFX stack/target path threw: ' + e.message); }
if (!threw3) ok('stack + gameplay-element targeting run without throwing');

// ── 6) reduced-motion honored ────────────────────────────────────────────────
_reducedStub = false;
installDom();
const modA = await freshImport();
const reducedOff = modA.CardVFX.reducedMotion();
_reducedStub = true;
installDom();
const modB = await freshImport();
const reducedOn = modB.CardVFX.reducedMotion();
if (reducedOff === false && reducedOn === true) ok('reduced-motion flag tracks prefers-reduced-motion media query');
else bad(`reduced-motion not honored (off=${reducedOff}, on=${reducedOn})`);
_reducedStub = false;
// reduced-motion CSS guard present in stylesheet
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
if (/@media \(prefers-reduced-motion: reduce\)[\s\S]*#cardVfxLayer/.test(css)) ok('stylesheet shortens VFX under reduced-motion');
else bad('stylesheet missing reduced-motion rule for #cardVfxLayer');

// ── 7) VFX module never touches card logic ───────────────────────────────────
const vfxSrc = readFileSync(join(root, 'src/cardVfx.js'), 'utf8');
// state-access patterns only — `comboRing` (a cosmetic primitive) and the word
// "combo" in comments are intentionally allowed.
const forbidden = [/_csState/, /\bsave\./, /roundCoins/, /\bcs_[a-z]/i, /applyDamage/, /applyBossDamage/];
let leaked = 0;
for (const re of forbidden) {
  if (re.test(vfxSrc)) { bad(`cardVfx.js references game logic symbol ${re} (must stay cosmetic)`); leaked++; }
}
if (!leaked) ok('cardVfx.js stays cosmetic — no card-logic / save / balance symbols');

// ── result ────────────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? '✅' : '❌'} card VFX audit: ${emCards.length} Elite/Mythic cards, ${mapped.size} mappings, ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
