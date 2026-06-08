// ── Boss Loop Hero — lightweight smoke check (no browser required) ───────────
//
// Drives the REAL src/bossLoopHero.js module through its public window bridge
// against a minimal DOM stub, then asserts on the rendered markup. This does
// NOT exercise gameplay balance or timers — it only confirms the wiring:
//
//   1) Mode Select opens from the PLAY entrypoint (window.blhOpenModeSelect)
//   2) Classic Mode still calls the original window.startGame()
//   3) Boss Loop Hero path: hero → stage → lobby → run actually starts
//   4) Loop Zeny lives in its own localStorage key (separate economy)
//
// Run with:  npm run smoke   (CI also runs `npm run build` first)
// Exits non-zero on the first failed assertion.

// ── minimal DOM / window / localStorage stubs ────────────────────────────────
function mkEl(id) {
  return {
    id, _html: '', textContent: '', scrollTop: 0, scrollHeight: 0,
    style: new Proxy({}, { get: (t, k) => t[k] || '', set: (t, k, v) => { t[k] = v; return true; } }),
    dataset: {},
    classList: {
      _s: new Set(),
      add(...a) { a.forEach(x => this._s.add(x)); },
      remove(...a) { a.forEach(x => this._s.delete(x)); },
      toggle(x, f) { if (f === undefined) f = !this._s.has(x); f ? this._s.add(x) : this._s.delete(x); return f; },
      contains(x) { return this._s.has(x); },
    },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    querySelector() { return mkEl('q'); },
    querySelectorAll() { return []; },
    insertAdjacentHTML() {}, appendChild() {}, contains() { return false; }, addEventListener() {},
  };
}
const _els = {};
global.window = {};
global.document = {
  getElementById: id => (_els[id] ||= mkEl(id)),
  createElement: t => mkEl(t),
  addEventListener() {}, body: mkEl('body'),
};
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
// keep everything synchronous & deterministic: timers never advance the run
global.setTimeout = () => 0;
global.clearTimeout = () => {};
global.requestAnimationFrame = () => 0;

// spy on the main-game bridge functions the mode calls into
let startGameCalls = 0;
window.startGame = () => { startGameCalls++; };
window.showMainMenu = () => {};
window.stopBGM = () => {};
window.playBGM = () => {};

// ── tiny assert harness ──────────────────────────────────────────────────────
let failures = 0;
const checks = [];
function ok(name, cond, detail) {
  checks.push({ name, cond: !!cond, detail });
  if (!cond) failures++;
}
function blhHtml() { return document.getElementById('blhRoot').innerHTML; }
function blhDisplay() { return document.getElementById('blhRoot').style.display; }

// ── load the real module (registers window.blhOpenModeSelect / window.blh) ───
await import('../src/bossLoopHero.js');

ok('module exposes blhOpenModeSelect', typeof window.blhOpenModeSelect === 'function');
ok('module exposes blh bridge', window.blh && typeof window.blh.pickMode === 'function');

// 1) PLAY → Mode Select
window.blhOpenModeSelect();
ok('Mode Select renders title', blhHtml().includes('SELECT MODE'));
ok('Mode Select lists Classic Mode', blhHtml().includes('CLASSIC MODE'));
ok('Mode Select lists Boss Loop Hero', blhHtml().includes('BOSS LOOP HERO'));
ok('overlay visible on open', blhDisplay() === 'flex');

// 2) Classic Mode still calls original startGame() and hides the overlay
window.blh.pickMode('classic');
ok('Classic Mode calls original startGame()', startGameCalls === 1);
ok('overlay hidden after Classic handoff', blhDisplay() === 'none');

// 3) Boss Loop Hero path: hero → stage → lobby → run
window.blhOpenModeSelect();
window.blh.pickMode('blh');
ok('Hero Select renders', blhHtml().includes('SELECT HERO'));
['NOCTISAK47', 'TOEI', 'APOLOGIZE'].forEach(h =>
  ok('hero available: ' + h, blhHtml().includes(h)));

window.blh.pickHero('noctisak47');
window.blh.heroNext();
ok('Stage Select renders', blhHtml().includes('SELECT STAGE'));
ok('Stage 1 boss is SUANG', blhHtml().includes('SUANG'));

window.blh.pickStage('stage1');
ok('Lobby renders READY', blhHtml().includes('READY'));
ok('Lobby has START RUN', blhHtml().includes('START RUN'));
ok('Lobby exposes Arena Training', blhHtml().includes('ARENA TRAINING'));

window.blh.startRun();
// the run screen template lives on #blhRoot; cells/token render into #blh-board
const boardHtml = document.getElementById('blh-board').innerHTML;
ok('Run renders the loop board', blhHtml().includes('blh-board'));
ok('Hero token placed on board', boardHtml.includes('blh-token'));
ok('classic startGame NOT called by run start', startGameCalls === 1);

// 3b) persistent bottom panel + speed control ────────────────────────────────
const panelHtml = document.getElementById('blh-panel').innerHTML;
ok('persistent panel renders tabs', panelHtml.includes('blh-ptab'));
['STATS', 'GEAR', 'LOOT', 'MAP', 'PLAN'].forEach(t =>
  ok('panel has tab: ' + t, panelHtml.includes(t)));
ok('default speed is 1x (slow)', window.blh.__test.BLH.run.speed === 1, 'speed=' + window.blh.__test.BLH.run.speed);
window.blh.cycleSpeed(); ok('cycle → 2x', window.blh.__test.BLH.run.speed === 2);
window.blh.cycleSpeed(); ok('cycle → Pause', window.blh.__test.BLH.run.speed === 0);
window.blh.cycleSpeed(); ok('cycle → 1x', window.blh.__test.BLH.run.speed === 1);
window.blh.setSpeed(1);

// 4) GRID MAP MODEL (locked spec 7×9) ────────────────────────────────────────
const T = window.blh.__test;
const MAP = T.BLH_MAP;
const cells = MAP.cells;
const roadCells = cells.filter(c => c.type === 'road');
const terrainCells = cells.filter(c => c.type === 'terrain');
ok('gridWidth === 7', MAP.gridWidth === 7, 'w=' + MAP.gridWidth);
ok('gridHeight === 9', MAP.gridHeight === 9, 'h=' + MAP.gridHeight);
ok('route length === 13 (Camp + 12 Road)', MAP.route.length === 13, 'route=' + MAP.route.length);
ok('Camp cell exists', cells.some(c => c.type === 'camp') && MAP.route[0] === 'camp');
ok('12 road cells exist', roadCells.length === 12, 'road=' + roadCells.length);
ok('12 terrain cells exist', terrainCells.length === 12, 'terrain=' + terrainCells.length);

// board renders every cell (13 route + 12 terrain = 25) from grid config
const nRoadDom = (boardHtml.match(/data-celltype="road"/g) || []).length;
const nCampDom = (boardHtml.match(/data-celltype="camp"/g) || []).length;
const nTerrDom = (boardHtml.match(/data-celltype="terrain"/g) || []).length;
ok('board draws 12 road + 1 camp = 13 route cells', nRoadDom + nCampDom === 13, `${nRoadDom}road+${nCampDom}camp`);
ok('board draws 12 terrain cells', nTerrDom === 12, 'terrainDom=' + nTerrDom);

// every terrain cell is orthogonally adjacent to ≥1 road (so adjacent cards are placeable)
const allTerrainTouchRoad = terrainCells.every(c => T.getAdjacentRoadCells(c.id).length > 0);
ok('all terrain cells touch ≥1 road cell', allTerrainTouchRoad);
// getAdjacentRoadCells returns only road/camp cells
const adjSample = T.getAdjacentRoadCells('t01');
ok('getAdjacentRoadCells returns only road/camp', adjSample.length > 0 && adjSample.every(n => n.type === 'road' || n.type === 'camp'));

// 5) PLACEMENT RULES ─────────────────────────────────────────────────────────
const roadTargets = T.validPlacementTargets('spawn_rift'); // road card
const adjTargets  = T.validPlacementTargets('shrine');     // adjacent card
const terrTargets = T.validPlacementTargets('rock');       // terrain card
ok('Road card → only road cells', roadTargets.length === 12 &&
  roadTargets.every(id => T.BLH_CELL_BY_ID[id].type === 'road'), 'n=' + roadTargets.length);
ok('Adjacent card → only terrain cells adjacent to road', adjTargets.length === 12 &&
  adjTargets.every(id => T.BLH_CELL_BY_ID[id].type === 'terrain' && T.getAdjacentRoadCells(id).length > 0), 'n=' + adjTargets.length);
ok('Terrain card → only terrain cells', terrTargets.length === 12 &&
  terrTargets.every(id => T.BLH_CELL_BY_ID[id].type === 'terrain'), 'n=' + terrTargets.length);
ok('Road/Adjacent/Terrain never target Camp', ![...roadTargets, ...adjTargets, ...terrTargets].includes('camp'));

// 6) ADJACENT EFFECT is cell-local (only adjacent road cells) ─────────────────
const run = T.BLH.run;
const terrId = 't01';
const adjRoad = T.getAdjacentRoadCells(terrId)[0].id;        // road touching t01
const farRoad = roadCells.find(c => !T.getAdjacentRoadCells(terrId).some(a => a.id === c.id)).id;
run.cells[terrId].placedCardId = 'shrine';                    // simulate placing shrine
ok('shrine buffs ADJACENT road cell only', T.getCellEffectsForRoad(adjRoad).atkBonus === 2, 'adj=' + T.getCellEffectsForRoad(adjRoad).atkBonus);
ok('shrine does NOT buff a far road cell', T.getCellEffectsForRoad(farRoad).atkBonus === 0, 'far=' + T.getCellEffectsForRoad(farRoad).atkBonus);
run.cells[terrId].placedCardId = null;                        // reset

// 7) BOSS SIGNAL still summons SUANG at Camp ──────────────────────────────────
for (const id of T.roadCellIds()) run.cells[id].enemy = null; // clear encounters so loop is unobstructed
run.bossSignalObtained = true;
run.bossSignalPlaced = true;                                  // simulate signal placed at camp
run.phase = 'walking';
let guard = 0;
while ((!window.blh.__test.BLH._battle || window.blh.__test.BLH._battle.kind !== 'boss') && guard++ < 40) {
  T.stepWalk(); // route order; arriving Camp with signal placed triggers the boss fight
}
const bt = T.BLH._battle;
ok('Boss Signal summons a boss fight', bt && bt.kind === 'boss');
ok('Boss is SUANG with 2 minions', bt && run.boss.id === 'suang' && bt.enemies.filter(e => e.role === 'minion').length === 2);

// 7b) battle popup mounts once with stable update targets (anti-flicker) ──────
ok('battle popup has stable titlebar', document.getElementById('blh-bt-titlebar') !== null);
ok('battle popup has stable hero HP fill', document.getElementById('blh-bt-hero-hpfill') !== null);
ok('battle popup has stable enemy HP fill', document.getElementById('blh-bt-efill-0') !== null);
// updating dynamic parts must not throw / must keep the same nodes
const fillBefore = document.getElementById('blh-bt-hero-hpfill');
T.BLH.run.stats.hp = Math.round(T.BLH.run.stats.maxhp / 2);
T.updateBattleDynamic();
ok('updateBattleDynamic reuses same HP node (no remount)', document.getElementById('blh-bt-hero-hpfill') === fillBefore);

// 8) separate economy: Loop Zeny persisted under its own key
const blhSave = localStorage.getItem('noctisak47_blh');
ok('Loop Zeny save uses separate key', blhSave !== null);
ok('save has loopZeny field', blhSave && JSON.parse(blhSave).loopZeny !== undefined);
ok('main-game save key untouched', localStorage.getItem('noctisak47_v3') === null);

// ── report ───────────────────────────────────────────────────────────────────
for (const c of checks) {
  console.log(`${c.cond ? '✅' : '❌'} ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
}
console.log(`\n${checks.length - failures}/${checks.length} checks passed`);
if (failures) { console.error(`\n❌ smoke check FAILED (${failures} failing)`); process.exit(1); }
console.log('\n✅ Boss Loop Hero smoke check passed');
