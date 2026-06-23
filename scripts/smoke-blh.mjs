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

// 1) Boss Loop / RPG mode is DISABLED → PLAY bypasses Mode Select into Classic
ok('BOSS_LOOP_ENABLED flag is false', window.blh.__test.BOSS_LOOP_ENABLED === false);
window.blhOpenModeSelect();
ok('disabled: PLAY does not render Mode Select', !blhHtml().includes('SELECT MODE'));
ok('disabled: PLAY starts Classic directly (startGame called)', startGameCalls === 1);
ok('disabled: overlay hidden after bypass', blhDisplay() === 'none');

// 2) Mode Select (forced open, dev only) no longer lists the RPG card; Classic still works
window.blh.__test.blhEnter();
window.blh.toModeSelect();
ok('disabled: Mode Select hides Loop RPG card', !blhHtml().includes('LOOP RPG MODE'));
ok('disabled: Mode Select still lists Classic Mode', blhHtml().includes('CLASSIC MODE'));
startGameCalls = 0; // reset to isolate the explicit classic-path assertion
window.blh.pickMode('classic');
ok('Classic Mode calls original startGame()', startGameCalls === 1);
ok('overlay hidden after Classic handoff', blhDisplay() === 'none');

// 3) Boss Loop Hero engine path (driven via dev bridge): hero → stage → lobby → run
window.blh.__test.blhEnter();
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

// 3b) persistent compact dock panel (new UI) + speed control + stable layout ──
const panelHtml = document.getElementById('blh-panel').innerHTML;
ok('persistent panel renders dock rows', panelHtml.includes('blh-dock-ctrl') && panelHtml.includes('blh-dock-equip'));
ok('board sits in fixed board-wrap', blhHtml().includes('blh-board-wrap'));
ok('panel has persistent speed row', panelHtml.includes('blh-dock-speed'));
ok('panel has tab: STATS', panelHtml.includes('blh-dock-hint-stats'));
ok('panel has tab: GEAR', panelHtml.includes('blh-dock-equip'));
ok('panel has tab: LOOT', panelHtml.includes('blh-dock-bag'));
ok('panel has tab: MAP', panelHtml.includes('blh-dock-cards'));
ok('Plan tab removed', !panelHtml.includes('>PLAN<'));
ok('panel has status/camp bar', panelHtml.includes('blh-dock-status'));
// dock rows must persist after every panelTab() call (backward-compat shim)
['stats', 'gear', 'loot', 'map'].forEach(tab => {
  window.blh.panelTab(tab);
  const h = document.getElementById('blh-panel').innerHTML;
  ok(`tab "${tab}" keeps speed row + status + tabs`,
    h.includes('blh-dock-speed') && h.includes('blh-dock-status') && h.includes('blh-dock-equip') && h.includes('blh-dock-bag'));
});
window.blh.panelTab('stats');
ok('default speed is 1x (slow)', window.blh.__test.BLH.run.speed === 1, 'speed=' + window.blh.__test.BLH.run.speed);
window.blh.cycleSpeed(); ok('cycle → 2x', window.blh.__test.BLH.run.speed === 2);
window.blh.cycleSpeed(); ok('cycle → Pause', window.blh.__test.BLH.run.speed === 0);
window.blh.cycleSpeed(); ok('cycle → 1x', window.blh.__test.BLH.run.speed === 1);
window.blh.setSpeed(1);

// 4) GRID MAP MODEL (locked spec 7×7) ────────────────────────────────────────
const T = window.blh.__test;
const MAP = T.BLH_MAP;
const cells = MAP.cells;
const roadCells = cells.filter(c => c.type === 'road');
const terrainCells = cells.filter(c => c.type === 'terrain');
const expTerrain = MAP.gridWidth * MAP.gridHeight - MAP.route.length; // ทุกช่องที่เหลือ = terrain
const adjTerrainCount = terrainCells.filter(c => T.getAdjacentRoadCells(c.id).length > 0).length;
ok('gridWidth === 7', MAP.gridWidth === 7, 'w=' + MAP.gridWidth);
ok('gridHeight === 7', MAP.gridHeight === 7, 'h=' + MAP.gridHeight);
ok('route length === 16 (Camp + 15 Road)', MAP.route.length === 16, 'route=' + MAP.route.length);
ok('Camp cell exists', cells.some(c => c.type === 'camp') && MAP.route[0] === 'camp');
ok('first route cell is Camp (routeIndex 0)', T.BLH_CELL_BY_ID[MAP.route[0]].type === 'camp');
ok('hero spawns at Camp (routePos 0)', T.BLH.run.routePos === 0 && T.BLH.run.route[0] === 'camp');
ok('Camp is at row 5, col 3 (reference image)', T.BLH_CELL_BY_ID['camp'].row === 5 && T.BLH_CELL_BY_ID['camp'].col === 3);
ok('15 road cells exist', roadCells.length === 15, 'road=' + roadCells.length);
ok('all remaining cells are terrain', terrainCells.length === expTerrain, `terrain=${terrainCells.length} exp=${expTerrain}`);
ok('no empty/blocked gap cells (camp+road+terrain == grid)',
  cells.length === MAP.gridWidth * MAP.gridHeight, 'cells=' + cells.length);

// route cells must all be road/camp (hero only walks these)
ok('route is only road/camp cells', MAP.route.every(id => {
  const t = T.BLH_CELL_BY_ID[id].type; return t === 'road' || t === 'camp';
}));

// board renders every cell from grid config
const nRoadDom = (boardHtml.match(/data-celltype="road"/g) || []).length;
const nCampDom = (boardHtml.match(/data-celltype="camp"/g) || []).length;
const nTerrDom = (boardHtml.match(/data-celltype="terrain"/g) || []).length;
ok('board draws 15 road + 1 camp = 16 route cells', nRoadDom + nCampDom === 16, `${nRoadDom}road+${nCampDom}camp`);
ok('board draws all terrain cells', nTerrDom === expTerrain, 'terrainDom=' + nTerrDom);

// at least some terrain cells touch road (adjacent cards placeable); helper returns only road/camp
const adjTerr = terrainCells.find(c => T.getAdjacentRoadCells(c.id).length > 0);
ok('some terrain cells touch ≥1 road cell', !!adjTerr && adjTerrainCount > 0, 'adjTerrain=' + adjTerrainCount);
const adjSample = T.getAdjacentRoadCells(adjTerr.id);
ok('getAdjacentRoadCells returns only road/camp', adjSample.length > 0 && adjSample.every(n => n.type === 'road' || n.type === 'camp'));

// 5) PLACEMENT RULES ─────────────────────────────────────────────────────────
const roadTargets = T.validPlacementTargets('spawn_rift'); // road card
const adjTargets  = T.validPlacementTargets('shrine');     // adjacent card
const terrTargets = T.validPlacementTargets('rock');       // terrain card
ok('Road card → only road cells', roadTargets.length === 15 &&
  roadTargets.every(id => T.BLH_CELL_BY_ID[id].type === 'road'), 'n=' + roadTargets.length);
ok('Adjacent card → only terrain cells adjacent to road', adjTargets.length === adjTerrainCount &&
  adjTargets.every(id => T.BLH_CELL_BY_ID[id].type === 'terrain' && T.getAdjacentRoadCells(id).length > 0), 'n=' + adjTargets.length);
ok('Terrain card → all terrain cells', terrTargets.length === expTerrain &&
  terrTargets.every(id => T.BLH_CELL_BY_ID[id].type === 'terrain'), 'n=' + terrTargets.length);
ok('Road/Adjacent/Terrain never target Camp', ![...roadTargets, ...adjTargets, ...terrTargets].includes('camp'));

// 6) ADJACENT EFFECT is cell-local (only adjacent road cells) ─────────────────
const run = T.BLH.run;
const terrId = adjTerr.id;                                  // terrain cell touching a road
const adjRoad = T.getAdjacentRoadCells(terrId)[0].id;        // road touching it
const farRoad = roadCells.find(c => !T.getAdjacentRoadCells(terrId).some(a => a.id === c.id)).id;
run.cells[terrId].placedCardId = 'shrine';                   // simulate placing shrine
ok('shrine buffs ADJACENT road cell only', T.getCellEffectsForRoad(adjRoad).atkBonus === 2, 'adj=' + T.getCellEffectsForRoad(adjRoad).atkBonus);
ok('shrine does NOT buff a far road cell', T.getCellEffectsForRoad(farRoad).atkBonus === 0, 'far=' + T.getCellEffectsForRoad(farRoad).atkBonus);
run.cells[terrId].placedCardId = null;                        // reset

// 6b) Camp auto-pause + HP recovery + 1x = Continue (Plan via Pause, no Plan tab) ─
for (const id of T.roadCellIds()) run.cells[id].enemy = null; // unobstructed loop
if (run.monsterTiles) for (const id of Object.keys(run.monsterTiles)) run.monsterTiles[id] = []; // clear natural monsters
run.bossTerrainCell = null; // no boss terrain
run.bossSignalObtained = false; run.bossSignalPlaced = false; // no boss yet
run.stats.hp = Math.floor(run.stats.maxhp * 0.3); // ลด HP ให้ต่ำก่อนถึง Camp
const hpBeforeCamp = run.stats.hp;
run.phase = 'walking'; run.speed = 1;
let cg = 0; while (run.phase === 'walking' && cg++ < 40) T.stepWalk();
ok('Camp arrival auto-pauses (speed = Pause/0)', run.phase === 'camp' && run.speed === 0, `phase=${run.phase} speed=${run.speed}`);
ok('Camp arrival recovers HP (base 15%)', run.stats.hp > hpBeforeCamp, `hp:${hpBeforeCamp}→${run.stats.hp}`);
window.blh.setSpeed(1);  // tap ▶1x at Camp
ok('1x at Camp = Continue Loop (walking, speed 1)', run.phase === 'walking' && run.speed === 1, `phase=${run.phase} speed=${run.speed}`);

// 7) BOSS SIGNAL still summons SUANG at Camp ──────────────────────────────────
for (const id of T.roadCellIds()) run.cells[id].enemy = null; // clear encounters so loop is unobstructed
if (run.monsterTiles) for (const id of Object.keys(run.monsterTiles)) run.monsterTiles[id] = []; // clear natural monsters
run.bossTerrainCell = null; // no boss terrain interference
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

// 7c) MONSTER SPAWN + CYCLE TIMER + BOSS TERRAIN (new systems) ───────────────
// Start a fresh run so state is clean
window.blh.__test.blhEnter();
window.blh.pickMode('blh');
window.blh.pickHero('noctisak47'); window.blh.heroNext();
window.blh.pickStage('stage1'); window.blh.startRun();
const NS = window.blh.__test;
const nsRun = NS.BLH.run;
window.blh.setSpeed(1);

// Route direction: first road step must be r15 (left of Camp, col 2)
ok('route[1] = r15 (left-first clockwise)', NS.BLH_MAP.route[1] === 'r15');
ok('r15 is at col 2 (left of Camp col 3)', NS.BLH_CELL_BY_ID['r15'].col === 2);
ok('route still 16 cells after reversal', NS.BLH_MAP.route.length === 16);
ok('route[0] is still camp', NS.BLH_MAP.route[0] === 'camp');

// Cycle timer: BLH has dedicated _cycleTimer separate from loop counter
ok('BLH has _cycleTimer property', '_cycleTimer' in NS.BLH);
// After run start (walking), cycle timer is set (non-null in real env; 0 in mock but !== null)
ok('cycle timer set (non-null) at run start', NS.BLH._cycleTimer !== null, 'timer=' + NS.BLH._cycleTimer);
// stopCycleTimer sets to null
NS.stopCycleTimer();
ok('stopCycleTimer sets _cycleTimer to null', NS.BLH._cycleTimer === null);
// startCycleTimer while speed>0 sets it back
nsRun.speed = 1;
NS.startCycleTimer();
ok('startCycleTimer sets timer to non-null', NS.BLH._cycleTimer !== null);
// Paused state: speed=0 should stop cycle (applySpeedChange path)
nsRun.speed = 0;
NS.stopCycleTimer();
ok('cycle stopped when paused (null)', NS.BLH._cycleTimer === null);
nsRun.speed = 1; NS.startCycleTimer(); // restore for later tests

// Initial natural monster spawn: 3 on road tiles, none on camp, max 1/tile at start
const initNatural = NS.naturalMonsterCount(nsRun);
ok('initial 3 natural monsters spawned', initNatural === 3, 'n=' + initNatural);
const campMobs = nsRun.monsterTiles && nsRun.monsterTiles['camp'];
ok('no natural monsters on camp tile', !campMobs || campMobs.length === 0);
const nsRoadSet = new Set(NS.roadCellIds());
const nsAllOnRoads = Object.entries(nsRun.monsterTiles || {}).every(([id, stk]) => stk.length === 0 || nsRoadSet.has(id));
ok('all natural monsters on road tiles only', nsAllOnRoads);
const nsAnyOver1 = Object.values(nsRun.monsterTiles || {}).some(stk => stk.length > 1);
ok('initial spawn: no tile has >1 monster (loop 1-2 safety)', !nsAnyOver1);

// Natural cap formula: 3 + floor(loop/2), max 8
ok('naturalCap at loop 1 = 3', NS.naturalCap(nsRun) === 3, 'cap=' + NS.naturalCap(nsRun));
ok('naturalCap at loop 4 = 5', NS.naturalCap({ loop: 4 }) === 5);
ok('naturalCap at loop 20 = 8 (max)', NS.naturalCap({ loop: 20 }) === 8);

// Max 3 monsters per tile (enforce at cap)
const nsTestRoad = NS.roadCellIds()[0];
nsRun.monsterTiles[nsTestRoad] = [
  NS.makeEnemy(NS.NATURAL_MONSTERS[0], nsRun),
  NS.makeEnemy(NS.NATURAL_MONSTERS[1], nsRun),
  NS.makeEnemy(NS.NATURAL_MONSTERS[2], nsRun),
];
ok('tile can hold 3 natural monsters (MONSTER_STACK_MAX)', nsRun.monsterTiles[nsTestRoad].length === 3);

// Stepping on tile with N monsters starts battle with N enemies
nsRun.monsterTiles[nsTestRoad] = [
  NS.makeEnemy(NS.NATURAL_MONSTERS[0], nsRun),
  NS.makeEnemy(NS.NATURAL_MONSTERS[1], nsRun),
];
for (const id of NS.roadCellIds()) { nsRun.cells[id].enemy = null; }
nsRun.bossTerrainCell = null;
const nsRoadIdx = nsRun.route.indexOf(nsTestRoad);
if (nsRoadIdx >= 0) {
  nsRun.routePos = (nsRoadIdx - 1 + nsRun.route.length) % nsRun.route.length;
  nsRun.phase = 'walking'; nsRun.speed = 1;
  NS.stepWalk();
  const nsbt = NS.BLH._battle;
  ok('tile with 2 natural monsters → battle with 2 enemies', !!nsbt && nsbt.enemies.length === 2, 'e=' + (nsbt ? nsbt.enemies.length : 'none'));
  ok('monster tile cleared when battle starts', !nsRun.monsterTiles[nsTestRoad] || nsRun.monsterTiles[nsTestRoad].length === 0);
  NS.BLH._battle = null; nsRun.phase = 'walking';
}

// Boss terrain: triggers at terrain power threshold (10)
nsRun.terrainPower = 0;
nsRun.bossTerrainCell = null;
nsRun.nextBossTerrainThreshold = NS.BAL.BOSS_TERRAIN_THRESHOLD_BASE;
NS.checkBossTerrainSpawn(nsRun);
ok('boss terrain NOT spawned below threshold', nsRun.bossTerrainCell === null);
nsRun.terrainPower = NS.BAL.BOSS_TERRAIN_THRESHOLD_BASE; // exactly 10
NS.checkBossTerrainSpawn(nsRun);
ok('boss terrain spawns at threshold 10', nsRun.bossTerrainCell !== null, 'cell=' + nsRun.bossTerrainCell);
const nsBossCell = nsRun.bossTerrainCell;
ok('boss terrain on terrain cell (not road/camp)',
  !!NS.BLH_CELL_BY_ID[nsBossCell] && NS.BLH_CELL_BY_ID[nsBossCell].type === 'terrain',
  'type=' + (NS.BLH_CELL_BY_ID[nsBossCell] || {}).type);

// Boss terrain spawns near Camp (Manhattan distance ≤ 3)
const nsCampC = NS.BLH_CELL_BY_ID['camp'];
const nsBTC = NS.BLH_CELL_BY_ID[nsBossCell];
const nsMDist = Math.abs(nsBTC.row - nsCampC.row) + Math.abs(nsBTC.col - nsCampC.col);
ok('boss terrain spawns near Camp (dist ≤ 3)', nsMDist <= 3, 'dist=' + nsMDist);

// Adjacent road tile triggers terrain_boss fight
const nsBossAdjRoads = NS.getNeighborCells(nsBossCell).filter(n => n.type === 'road');
if (nsBossAdjRoads.length > 0) {
  const nsAdjRId = nsBossAdjRoads[0].id;
  const nsAdjRIdx = nsRun.route.indexOf(nsAdjRId);
  if (nsAdjRIdx >= 0) {
    nsRun.routePos = (nsAdjRIdx - 1 + nsRun.route.length) % nsRun.route.length;
    for (const id of NS.roadCellIds()) { nsRun.cells[id].enemy = null; }
    nsRun.monsterTiles = {};
    nsRun.phase = 'walking'; nsRun.speed = 1;
    NS.stepWalk();
    const nstbt = NS.BLH._battle;
    ok('adjacent road to boss terrain triggers terrain_boss', !!nstbt && nstbt.kind === 'terrain_boss', 'kind=' + (nstbt ? nstbt.kind : 'null'));
    ok('terrain_boss has 3 enemies (2 minion + 1 boss)', !!nstbt && nstbt.enemies.length === 3, 'n=' + (nstbt ? nstbt.enemies.length : 0));

    // Drive terrain_boss victory via real endBattle — verifies synchronous state mutations
    if (nstbt) {
      const nsVictCell = nsAdjRId;
      nstbt.enemies.forEach(e => { e.hp = 0; });
      NS.endBattle('win');
      ok('terrain_boss victory: bossTerrainCell cleared', nsRun.bossTerrainCell === null);
      ok('terrain_boss victory: threshold advances by 10',
        nsRun.nextBossTerrainThreshold === NS.BAL.BOSS_TERRAIN_THRESHOLD_BASE * 2,
        'thresh=' + nsRun.nextBossTerrainThreshold);
      ok('terrain_boss victory: trigger cell rc.enemy cleared',
        !nsRun.cells[nsVictCell] || !nsRun.cells[nsVictCell].enemy);
      ok('terrain_boss victory: trigger cell monsterTiles cleared',
        !nsRun.monsterTiles[nsVictCell] || nsRun.monsterTiles[nsVictCell].length === 0);
    }
    NS.BLH._battle = null; nsRun.phase = 'camp';
  }
}

// main clicker untouched (startGameCalls still 1 from section 2)
ok('main clicker startGame not called by new systems', startGameCalls === 1);

// new functions exposed on __test
ok('naturalMonsterCount/naturalCap/NATURAL_MONSTERS exposed',
  typeof NS.naturalMonsterCount === 'function' && typeof NS.naturalCap === 'function' && Array.isArray(NS.NATURAL_MONSTERS));
ok('NATURAL_MONSTERS has 5 entries', NS.NATURAL_MONSTERS.length === 5, 'n=' + NS.NATURAL_MONSTERS.length);
ok('checkBossTerrainSpawn/findBossTerrainCell exposed',
  typeof NS.checkBossTerrainSpawn === 'function' && typeof NS.findBossTerrainCell === 'function');
ok('startCycleTimer/stopCycleTimer exposed',
  typeof NS.startCycleTimer === 'function' && typeof NS.stopCycleTimer === 'function');
ok('BAL.CYCLE_MS = 12000', NS.BAL.CYCLE_MS === 12000);
ok('BAL.BOSS_TERRAIN_THRESHOLD_BASE = 10', NS.BAL.BOSS_TERRAIN_THRESHOLD_BASE === 10);
window.blh.setSpeed(1);

// 7d) ELITE/MYTHIC ROAD EVENTS ──────────────────────────────────────────────
// Use a fresh run for clean event state
window.blh.__test.blhEnter();
window.blh.pickMode('blh');
window.blh.pickHero('noctisak47'); window.blh.heroNext();
window.blh.pickStage('stage1'); window.blh.startRun();
const EV = window.blh.__test;
const evRun = EV.BLH.run;
window.blh.setSpeed(1);

// Event pool sizes
ok('ELITE_EVENT_ENEMIES has 3 entries', Array.isArray(EV.ELITE_EVENT_ENEMIES) && EV.ELITE_EVENT_ENEMIES.length === 3);
ok('MYTHIC_EVENT_ENEMIES has 3 entries', Array.isArray(EV.MYTHIC_EVENT_ENEMIES) && EV.MYTHIC_EVENT_ENEMIES.length === 3);
ok('all ELITE_EVENT_ENEMIES have role elite_event',
  EV.ELITE_EVENT_ENEMIES.every(e => e.role === 'elite_event'));
ok('all MYTHIC_EVENT_ENEMIES have role mythic_event',
  EV.MYTHIC_EVENT_ENEMIES.every(e => e.role === 'mythic_event'));

// Unlock conditions
// Elite: loop >= 3 OR terrainPower >= 6
evRun.loop = 1; evRun.terrainPower = 0;
ok('Elite NOT unlocked at loop 1, power 0', !EV.eliteEventUnlocked(evRun));
evRun.loop = 3; evRun.terrainPower = 0;
ok('Elite unlocked at loop >= 3', EV.eliteEventUnlocked(evRun));
evRun.loop = 1; evRun.terrainPower = 6;
ok('Elite unlocked at terrainPower >= 6', EV.eliteEventUnlocked(evRun));
evRun.loop = 2; evRun.terrainPower = 5;
ok('Elite NOT unlocked at loop 2, power 5 (both below threshold)', !EV.eliteEventUnlocked(evRun));

// Mythic: loop >= 6 AND terrainPower >= 12
evRun.loop = 1; evRun.terrainPower = 0;
ok('Mythic NOT unlocked at loop 1, power 0', !EV.mythicEventUnlocked(evRun));
evRun.loop = 6; evRun.terrainPower = 0;
ok('Mythic NOT unlocked at loop 6, power 0 (missing power)', !EV.mythicEventUnlocked(evRun));
evRun.loop = 1; evRun.terrainPower = 12;
ok('Mythic NOT unlocked at loop 1, power 12 (missing loop)', !EV.mythicEventUnlocked(evRun));
evRun.loop = 6; evRun.terrainPower = 12;
ok('Mythic unlocked at loop >= 6 AND terrainPower >= 12', EV.mythicEventUnlocked(evRun));

// Reset to locked state and verify trySpawn does nothing before unlock
evRun.loop = 1; evRun.terrainPower = 0;
evRun.eliteEventTile = null; evRun.mythicEventTile = null;
evRun.monsterTiles = {};
EV.trySpawnEliteEvent(evRun);
ok('Elite does not spawn before unlock (loop 1, power 0)', evRun.eliteEventTile === null);
EV.trySpawnMythicEvent(evRun);
ok('Mythic does not spawn before unlock (loop 1, power 0)', evRun.mythicEventTile === null);

// Max 1 active Elite
evRun.loop = 3; evRun.terrainPower = 0;
evRun.eliteEventTile = 'r01'; // already has an active elite event
EV.trySpawnEliteEvent(evRun);
ok('Elite: no second spawn when one is already active', evRun.eliteEventTile === 'r01');
evRun.eliteEventTile = null; // reset

// Max 1 active Mythic
evRun.loop = 6; evRun.terrainPower = 12;
evRun.mythicEventTile = 'r05'; // already active
EV.trySpawnMythicEvent(evRun);
ok('Mythic: no second spawn when one is already active', evRun.mythicEventTile === 'r05');
evRun.mythicEventTile = null; // reset

// Event spawn respects tile monster stack cap = 3
evRun.loop = 3; evRun.terrainPower = 0;
evRun.eliteEventTile = null;
const evRoads = EV.roadCellIds();
evRoads.forEach(id => { evRun.monsterTiles[id] = [
  EV.makeEnemy(EV.NATURAL_MONSTERS[0], evRun),
  EV.makeEnemy(EV.NATURAL_MONSTERS[1], evRun),
  EV.makeEnemy(EV.NATURAL_MONSTERS[2], evRun),
]; }); // fill all tiles to cap
// force 100% chance to remove randomness
const origEliteChance = EV.BAL.ELITE_EVENT_BASE_CHANCE;
EV.BAL.ELITE_EVENT_BASE_CHANCE = 1.0;
EV.trySpawnEliteEvent(evRun);
ok('Elite does not spawn when all tiles are at stack cap', evRun.eliteEventTile === null,
  'tile=' + evRun.eliteEventTile);
EV.BAL.ELITE_EVENT_BASE_CHANCE = origEliteChance; // restore
evRoads.forEach(id => { evRun.monsterTiles[id] = []; }); // clear

// Elite spawn CAN happen on a tile with < 3 monsters
evRun.loop = 3; evRun.terrainPower = 0;
evRun.eliteEventTile = null;
evRoads.forEach(id => { evRun.monsterTiles[id] = []; });
// Override both base AND cap so the clamp cannot suppress the guaranteed spawn
EV.BAL.ELITE_EVENT_BASE_CHANCE = 1.0;
EV.BAL.ELITE_EVENT_CHANCE_CAP = 1.0; // prevent cap from reducing the override
EV.trySpawnEliteEvent(evRun);
ok('Elite spawns on a valid road tile when unlocked (loop >= 3)',
  evRun.eliteEventTile !== null && evRoads.includes(evRun.eliteEventTile),
  'tile=' + evRun.eliteEventTile);
EV.BAL.ELITE_EVENT_BASE_CHANCE = origEliteChance; // restore
EV.BAL.ELITE_EVENT_CHANCE_CAP = 0.12; // restore

// Stepping on Elite tile starts elite_event battle
const evEliteTile = evRun.eliteEventTile || evRoads[0];
evRun.eliteEventTile = evEliteTile;
for (const id of evRoads) { evRun.cells[id].enemy = null; }
evRun.bossTerrainCell = null;
evRoads.forEach(id => { evRun.monsterTiles[id] = []; });
const evEliteIdx = evRun.route.indexOf(evEliteTile);
if (evEliteIdx >= 0) {
  evRun.routePos = (evEliteIdx - 1 + evRun.route.length) % evRun.route.length;
  evRun.phase = 'walking'; evRun.speed = 1;
  EV.stepWalk();
  const evBt = EV.BLH._battle;
  ok('stepping on Elite tile starts elite_event battle', !!evBt && evBt.kind === 'elite_event',
    'kind=' + (evBt ? evBt.kind : 'none'));
  ok('elite_event battle has 1 enemy', !!evBt && evBt.enemies.length === 1, 'n=' + (evBt ? evBt.enemies.length : 0));
  ok('elite_event marker cleared on battle start', evRun.eliteEventTile === null);

  // Elite victory grants gear + Loop Zeny
  if (evBt) {
    const zenyBefore = evRun.mods.zenyBonus;
    const bagBefore = evRun.lootBag.length;
    evBt.enemies.forEach(e => { e.hp = 0; });
    EV.endBattle('win');
    ok('elite_event victory: Loop Zeny bonus granted',
      evRun.mods.zenyBonus >= zenyBefore + EV.BAL.ELITE_EVENT_ZENY,
      'bonus=' + (evRun.mods.zenyBonus - zenyBefore));
    ok('elite_event victory: gear dropped (loot bag grew)',
      evRun.lootBag.length > bagBefore, 'bag=' + evRun.lootBag.length);
  }
  EV.BLH._battle = null; evRun.phase = 'walking';
}

// Stepping on Mythic tile starts mythic_event battle
evRun.loop = 6; evRun.terrainPower = 12;
evRun.mythicEventTile = null;
EV.BAL.MYTHIC_EVENT_BASE_CHANCE = 1.0; // guarantee spawn
evRoads.forEach(id => { evRun.monsterTiles[id] = []; });
EV.trySpawnMythicEvent(evRun);
EV.BAL.MYTHIC_EVENT_BASE_CHANCE = EV.BAL.MYTHIC_EVENT_BASE_CHANCE; // restore (it's still modified)
EV.BAL.MYTHIC_EVENT_BASE_CHANCE = 0.02; // restore properly
const evMythicTile = evRun.mythicEventTile || evRoads[1];
evRun.mythicEventTile = evMythicTile;
for (const id of evRoads) { evRun.cells[id].enemy = null; }
evRun.bossTerrainCell = null;
evRoads.forEach(id => { evRun.monsterTiles[id] = []; });
evRun.eliteEventTile = null;
const evMythicIdx = evRun.route.indexOf(evMythicTile);
if (evMythicIdx >= 0) {
  evRun.routePos = (evMythicIdx - 1 + evRun.route.length) % evRun.route.length;
  evRun.phase = 'walking'; evRun.speed = 1;
  EV.stepWalk();
  const evMbt = EV.BLH._battle;
  ok('stepping on Mythic tile starts mythic_event battle', !!evMbt && evMbt.kind === 'mythic_event',
    'kind=' + (evMbt ? evMbt.kind : 'none'));
  ok('mythic_event battle has 1 enemy', !!evMbt && evMbt.enemies.length === 1, 'n=' + (evMbt ? evMbt.enemies.length : 0));
  ok('mythic_event marker cleared on battle start', evRun.mythicEventTile === null);

  // Mythic victory grants higher gear + Loop Zeny
  if (evMbt) {
    const mZenyBefore = evRun.mods.zenyBonus;
    const mBagBefore = evRun.lootBag.length;
    evMbt.enemies.forEach(e => { e.hp = 0; });
    EV.endBattle('win');
    ok('mythic_event victory: Loop Zeny bonus granted (>= MYTHIC_EVENT_ZENY)',
      evRun.mods.zenyBonus >= mZenyBefore + EV.BAL.MYTHIC_EVENT_ZENY,
      'bonus=' + (evRun.mods.zenyBonus - mZenyBefore));
    ok('mythic_event victory: gear dropped (loot bag grew)',
      evRun.lootBag.length > mBagBefore, 'bag=' + evRun.lootBag.length);
  }
  EV.BLH._battle = null; evRun.phase = 'camp';
}

// Main clicker still untouched after event section
ok('main clicker untouched after elite/mythic events', startGameCalls === 1);

// New symbols exposed on __test
ok('ELITE_EVENT_ENEMIES/MYTHIC_EVENT_ENEMIES exposed',
  Array.isArray(EV.ELITE_EVENT_ENEMIES) && Array.isArray(EV.MYTHIC_EVENT_ENEMIES));
ok('eliteEventUnlocked/mythicEventUnlocked exposed',
  typeof EV.eliteEventUnlocked === 'function' && typeof EV.mythicEventUnlocked === 'function');
ok('trySpawnEliteEvent/trySpawnMythicEvent exposed',
  typeof EV.trySpawnEliteEvent === 'function' && typeof EV.trySpawnMythicEvent === 'function');
ok('BAL has Elite/Mythic event constants',
  EV.BAL.ELITE_EVENT_BASE_CHANCE === 0.06 && EV.BAL.MYTHIC_EVENT_BASE_CHANCE === 0.02);

// 7e) MONSTER MAP PIXEL SPRITES ──────────────────────────────────────────────
// helper functions / data exposed
ok('monsterRankClass exposed',       typeof EV.monsterRankClass === 'function');
ok('monsterSpeciesClass exposed',    typeof EV.monsterSpeciesClass === 'function');
ok('monsterSpeciesPattern exposed',  typeof EV.monsterSpeciesPattern === 'function');
ok('buildPixelSprite exposed',       typeof EV.buildPixelSprite === 'function');
ok('monsterMapMarkup exposed',       typeof EV.monsterMapMarkup === 'function');
ok('strongestMonsterOnTile exposed', typeof EV.strongestMonsterOnTile === 'function');
ok('PIXEL_SPRITES exposed',          typeof EV.PIXEL_SPRITES === 'object' && EV.PIXEL_SPRITES !== null);

// monsterRankClass returns correct rank-color CSS class names
ok('rank: mythic_event → blh-mob-mythic', EV.monsterRankClass({ role: 'mythic_event' }) === 'blh-mob-mythic');
ok('rank: elite_event → blh-mob-elite',   EV.monsterRankClass({ role: 'elite_event' }) === 'blh-mob-elite');
ok('rank: fast → blh-mob-normal',         EV.monsterRankClass({ role: 'fast', base: { hp: 16, atk: 5 } }) === 'blh-mob-normal');
ok('rank: basic low-HP → blh-mob-weak',   EV.monsterRankClass({ role: 'basic', base: { hp: 20, atk: 4 } }) === 'blh-mob-weak');
ok('rank: basic high-HP → blh-mob-normal',EV.monsterRankClass({ role: 'basic', base: { hp: 30, atk: 6 } }) === 'blh-mob-normal');

// monsterSpeciesClass (legacy, kept for backward compat) returns CSS class strings
ok('species: boring → blh-mob-boring',       EV.monsterSpeciesClass({ id: 'boring' }) === 'blh-mob-boring');
ok('species: faburr → blh-mob-faburr',       EV.monsterSpeciesClass({ id: 'faburr' }) === 'blh-mob-faburr');
ok('species: looney_tic → blh-mob-looney',   EV.monsterSpeciesClass({ id: 'looney_tic' }) === 'blh-mob-looney');
ok('species: poporingo → blh-mob-poporingo', EV.monsterSpeciesClass({ id: 'poporingo' }) === 'blh-mob-poporingo');
ok('species: dripz → blh-mob-dripz',         EV.monsterSpeciesClass({ id: 'dripz' }) === 'blh-mob-dripz');
ok('species: unknown → blh-mob-boring',      EV.monsterSpeciesClass({ id: 'unknown' }) === 'blh-mob-boring');

// monsterSpeciesPattern returns a 10-row pixel pattern array
ok('speciesPattern: boring is 10-row array',
  Array.isArray(EV.monsterSpeciesPattern({ id: 'boring' })) &&
  EV.monsterSpeciesPattern({ id: 'boring' }).length === 10);
ok('speciesPattern: all rows are 10-char strings',
  EV.monsterSpeciesPattern({ id: 'boring' }).every(r => r.length === 10));
ok('speciesPattern: faburr first row has two ear bumps',
  EV.monsterSpeciesPattern({ id: 'faburr' })[0] === '0110000110');
ok('speciesPattern: unknown id → boring fallback',
  EV.monsterSpeciesPattern({ id: 'zzz_unknown' }) === EV.PIXEL_SPRITES.boring);
ok('PIXEL_SPRITES.elite has 10 rows',
  Array.isArray(EV.PIXEL_SPRITES.elite) && EV.PIXEL_SPRITES.elite.length === 10);
ok('PIXEL_SPRITES.mythic has corner horns in row 0',
  EV.PIXEL_SPRITES.mythic[0] === '1000000001');

// buildPixelSprite produces blh-px-c with inline box-shadow color
{
  const html = EV.buildPixelSprite(EV.PIXEL_SPRITES.boring, 'blh-mob-normal');
  ok('buildPixelSprite produces blh-px-c element',      html.includes('blh-px-c'));
  ok('buildPixelSprite embeds yellow color (normal)',    html.includes('#ddcc00'));
  ok('buildPixelSprite has box-shadow property',         html.includes('box-shadow'));
  ok('buildPixelSprite embeds orange color (elite)',
    EV.buildPixelSprite(EV.PIXEL_SPRITES.elite, 'blh-mob-elite').includes('#ff8800'));
  ok('buildPixelSprite embeds red color (mythic)',
    EV.buildPixelSprite(EV.PIXEL_SPRITES.mythic, 'blh-mob-mythic').includes('#dd1133'));
}

// strongestMonsterOnTile: returns monster with highest power (hp + atk*2)
// use evRun (real run) so makeEnemy has access to run.mods
{
  const boring  = EV.makeEnemy(EV.NATURAL_MONSTERS.find(m => m.id === 'boring'),     evRun);
  const popo    = EV.makeEnemy(EV.NATURAL_MONSTERS.find(m => m.id === 'poporingo'), evRun);
  const best    = EV.strongestMonsterOnTile([boring, popo]);
  ok('strongestMonsterOnTile picks poporingo over boring', best && best.id === 'poporingo',
    'id=' + (best && best.id));
  ok('strongestMonsterOnTile([single]) = that monster', EV.strongestMonsterOnTile([boring]) === boring);
  ok('strongestMonsterOnTile([]) = null', EV.strongestMonsterOnTile([]) === null);
}

// map renders true pixel-art sprites (blh-px-c canvas + blh-mob-anchor)
// Use a fresh run so state is clean; renderBoard() is exposed for explicit re-renders
{
  window.blh.__test.blhEnter();
  window.blh.pickMode('blh');
  window.blh.pickHero('noctisak47'); window.blh.heroNext();
  window.blh.pickStage('stage1'); window.blh.startRun();
  const SP = window.blh.__test;
  const spRun = SP.BLH.run;
  const spRoad = SP.roadCellIds()[0];

  // 1 monster → pixel canvas rendered, no dots
  SP.roadCellIds().forEach(id => { spRun.monsterTiles[id] = []; });
  spRun.eliteEventTile = null; spRun.mythicEventTile = null;
  spRun.monsterTiles[spRoad] = [SP.makeEnemy(SP.NATURAL_MONSTERS[0], spRun)];
  SP.renderBoard();
  const spBoard = document.getElementById('blh-board').innerHTML;
  ok('map renders pixel-art canvas (blh-px-c)', spBoard.includes('blh-px-c'),
    'board snippet: ' + spBoard.slice(0, 300));
  ok('map renders mob anchor wrapper', spBoard.includes('blh-mob-anchor'));

  // stack 2 monsters → dots appear
  spRun.monsterTiles[spRoad] = [
    SP.makeEnemy(SP.NATURAL_MONSTERS[0], spRun),
    SP.makeEnemy(SP.NATURAL_MONSTERS[1], spRun),
  ];
  SP.renderBoard();
  const sp2Board = document.getElementById('blh-board').innerHTML;
  ok('stack 2 monsters → blh-mob-dots rendered', sp2Board.includes('blh-mob-dots'));
  ok('stack 2 monsters → 2 dot spans', (sp2Board.match(/blh-mob-dot/g) || []).length >= 2);

  // stack 3 monsters → 3 dots
  spRun.monsterTiles[spRoad] = [
    SP.makeEnemy(SP.NATURAL_MONSTERS[0], spRun),
    SP.makeEnemy(SP.NATURAL_MONSTERS[1], spRun),
    SP.makeEnemy(SP.NATURAL_MONSTERS[2], spRun),
  ];
  SP.renderBoard();
  const sp3Board = document.getElementById('blh-board').innerHTML;
  ok('stack 3 monsters → 3 dot spans', (sp3Board.match(/blh-mob-dot/g) || []).length >= 3);

  // strongest monster (poporingo) encodes yellow color in sprite
  spRun.monsterTiles[spRoad] = [
    SP.makeEnemy(SP.NATURAL_MONSTERS.find(m => m.id === 'boring'),     spRun),
    SP.makeEnemy(SP.NATURAL_MONSTERS.find(m => m.id === 'poporingo'), spRun),
  ];
  SP.renderBoard();
  const spStrBoard = document.getElementById('blh-board').innerHTML;
  ok('strongest (poporingo) encodes yellow color in sprite', spStrBoard.includes('#ddcc00'));

  // elite event → orange pixel sprite (no card art)
  spRun.monsterTiles[spRoad] = [];
  spRun.eliteEventTile = spRoad;
  SP.renderBoard();
  const spEliteBoard = document.getElementById('blh-board').innerHTML;
  ok('elite event tile renders orange pixel sprite', spEliteBoard.includes('#ff8800'));
  ok('elite event uses blh-mob-anchor', spEliteBoard.includes('blh-mob-anchor'));
  ok('elite event uses blh-px-c canvas', spEliteBoard.includes('blh-px-c'));

  // mythic event → red pixel sprite (no card art)
  spRun.eliteEventTile = null;
  spRun.mythicEventTile = spRoad;
  SP.renderBoard();
  const spMythicBoard = document.getElementById('blh-board').innerHTML;
  ok('mythic event tile renders red pixel sprite', spMythicBoard.includes('#dd1133'));
  ok('mythic event uses blh-px-c canvas', spMythicBoard.includes('blh-px-c'));
  spRun.mythicEventTile = null;

  // board must NOT contain card-art <img> tags for monsters
  SP.roadCellIds().forEach(id => {
    spRun.monsterTiles[id] = [SP.makeEnemy(SP.NATURAL_MONSTERS[0], spRun)];
  });
  SP.renderBoard();
  const spNoImgBoard = document.getElementById('blh-board').innerHTML;
  ok('map board has no card-art <img> for monsters',
    !spNoImgBoard.match(/<img[^>]+cards\//));

  // battle still uses card assets (<img> inside blh-battle innerHTML), not pixel sprites
  // buildBattleDOM sets innerHTML on #blh-battle; check the last rendered battle HTML
  // (populated by section 7d's elite/mythic_event battles)
  const btHtml = document.getElementById('blh-battle')._html;
  ok('battle enemy card uses <img> (card asset), not pixel sprite',
    btHtml.includes('<img'), 'btHtml snippet: ' + btHtml.slice(0, 200));
}

// 8) separate economy: Loop Zeny persisted under its own key
const blhSave = localStorage.getItem('noctisak47_blh');
ok('Loop Zeny save uses separate key', blhSave !== null);
ok('save has loopZeny field', blhSave && JSON.parse(blhSave).loopZeny !== undefined);
ok('main-game save key untouched', localStorage.getItem('noctisak47_v3') === null);

// 9) LOOP RPG MODE — base stats, derived combat, perks, caps ─────────────────
const HEROES = T.HEROES;
const HERO_PERKS = T.HERO_PERKS;
const BSK = T.BASE_STAT_KEYS;
// 9a) every hero has the full base stat model
ok('heroes have STR/AGI/VIT/DEX/INT/LUK base stats', HEROES.every(h =>
  BSK.every(k => typeof h.base[k] === 'number')), 'keys=' + BSK.join(','));
// 9b) derived combat stats exist on the live run
const rs = T.BLH.run.stats;
['atk', 'def', 'maxhp', 'aspd', 'critRate', 'critDamage', 'evasion', 'lifesteal', 'armorPen'].forEach(k =>
  ok('combat stat exists: ' + k, typeof rs[k] === 'number', k + '=' + rs[k]));
// 9c) perk pools: exactly 8 per hero, unique ids, mod is a function
HEROES.forEach(h => {
  const pool = HERO_PERKS[h.id] || [];
  ok(`perk pool 8 for ${h.id}`, pool.length === 8, 'n=' + pool.length);
  ok(`perk pool ${h.id} ids unique + mod fn`, new Set(pool.map(p => p.id)).size === 8 &&
    pool.every(p => typeof p.mod === 'function'));
});
// 9d) perk offer = 3 distinct options from the hero's pool
const pr = T.BLH.run;
pr.perks = []; pr.perkOffer = null;
const offer = T.generatePerkOffer(pr);
ok('perk offer presents 3 options', offer.length === 3, 'n=' + offer.length);
ok('perk offer has no duplicates', new Set(offer).size === offer.length);
ok('perk offer all from hero pool', offer.every(id => (HERO_PERKS[pr.hero.id] || []).some(p => p.id === id)));
// 9e) loop trigger creates a pending perk choice
pr.perkPending = 0; pr.perkLoopFired = []; pr.perks = [];
pr.loop = 3; T.checkPerkLoopTrigger(pr);
ok('loop-3 trigger creates a pending perk choice', pr.perkPending >= 1, 'pending=' + pr.perkPending);
const firedAgain = pr.perkPending; pr.loop = 3; T.checkPerkLoopTrigger(pr);
ok('loop trigger does not re-fire the same milestone', pr.perkPending === firedAgain);
// 9f) building placement milestone creates a pending perk choice
pr.perkPending = 0; pr.perkBuildFired = [];
pr.placedCount = 5; T.checkPerkBuildTrigger(pr);
ok('placement-5 milestone creates a pending perk choice', pr.perkPending >= 1, 'pending=' + pr.perkPending);
// 9g) choosing a perk applies its effect (run-only) without error, and is not re-offered
pr.perkPending = 1; pr.perks = []; pr.perkMods = Object.assign({}, pr.perkMods);
const chosen = T.generatePerkOffer(pr)[0];
const before = JSON.stringify(pr.perkMods);
window.blh.choosePerk(chosen);
ok('chosen perk recorded on run', pr.perks.includes(chosen));
ok('chosen perk mutated perkMods (effect applied)', JSON.stringify(pr.perkMods) !== before);
const reoffer = T.generatePerkOffer(pr);
ok('chosen perk not offered again this run', !reoffer.includes(chosen));
// 9h) stat caps are enforced in deriveCombat
const capped = T.deriveCombat(
  { str: 0, agi: 0, vit: 0, dex: 0, int: 0, luk: 999 },
  { critRate: 9, critDamage: 9, evasion: 9, lifesteal: 9, armorPen: 999 });
ok('critRate cap 50%', capped.critRate <= T.STAT_CAPS.critRate + 1e-9, 'crit=' + capped.critRate);
ok('critDamage cap 250%', capped.critDamage <= T.STAT_CAPS.critDamage + 1e-9, 'cdmg=' + capped.critDamage);
ok('evasion cap 35%', capped.evasion <= T.STAT_CAPS.evasion + 1e-9, 'eva=' + capped.evasion);
ok('lifesteal cap 20%', capped.lifesteal <= T.STAT_CAPS.lifesteal + 1e-9, 'ls=' + capped.lifesteal);
ok('armorPen cap', capped.armorPen <= T.STAT_CAPS.armorPen, 'pen=' + capped.armorPen);
// 9i) gear carries tier/rarity/main/sub (new quality shape)
const sampleGear = T.makeGear(pr);
ok('gear has slot + numeric tier (1–4)', typeof sampleGear.slot === 'string' &&
  sampleGear.tier >= 1 && sampleGear.tier <= 4, 'tier=' + sampleGear.tier);
ok('gear has rarity id', typeof sampleGear.rarity === 'string' && !!T.GEAR_RARITY_BY_ID[sampleGear.rarity]);
ok('gear main stat has key+value', sampleGear.mainStat && typeof sampleGear.mainStat.k === 'string' && typeof sampleGear.mainStat.v === 'number');
ok('gear sub stat has key+value', sampleGear.subStat && typeof sampleGear.subStat.k === 'string' && typeof sampleGear.subStat.v === 'number');
// 9j) perks are run-only — a fresh run starts with an empty perk list
window.blh.__test.blhEnter();
window.blh.pickMode('blh');
window.blh.pickHero('apologize'); window.blh.heroNext();
window.blh.pickStage('stage1'); window.blh.startRun();
ok('fresh run starts with no perks (run-only)', T.BLH.run.perks.length === 0);
ok('fresh run starts with empty perkMods triggers', T.BLH.run.perkPending === 0);
window.blh.setSpeed(1);

// 10) RUN EXP / LEVEL / AUTO-GROWTH PLAN ────────────────────────────────────
// ใช้ run จาก 9j (APOLOGIZE hero, fresh run)
const expT = window.blh.__test;
const expRun = expT.BLH.run;
const BSK2 = expT.BASE_STAT_KEYS;
const rsSum = obj => BSK2.reduce((s, k) => s + (obj[k] || 0), 0);

// 10a) fresh run has correct initial EXP/level/growth-plan state
ok('fresh run level is 1', expRun.level === 1, 'lv=' + expRun.level);
ok('fresh run exp is 0', expRun.exp === 0, 'exp=' + expRun.exp);
ok('fresh run planCursor is 0', (expRun.planCursor || 0) === 0, 'cursor=' + expRun.planCursor);
ok('fresh run runStats all zero', BSK2.every(k => (expRun.runStats[k] || 0) === 0));
ok('apologize hero defaults to default plan', expRun.growthPlan === 'default',
  'plan=' + expRun.growthPlan);

// 10b) expToNext formula: 30 + (level-1)² × 18
ok('expToNext(1) = 30', expT.expToNext(1) === 30, 'got=' + expT.expToNext(1));
ok('expToNext(2) = 48', expT.expToNext(2) === 48, 'got=' + expT.expToNext(2));
ok('expToNext(5) = 318', expT.expToNext(5) === 318, 'got=' + expT.expToNext(5));

// 10c) grantExp auto-allocates +2 points per level-up (no pending)
expT.grantExp(25);
ok('25 EXP: level still 1, exp = 25', expRun.level === 1 && expRun.exp === 25,
  `lv=${expRun.level} exp=${expRun.exp}`);
expT.grantExp(10); // total 35 ≥ expToNext(1)=30 → level up; overflow = 5
ok('35 total EXP → level 2', expRun.level === 2, 'lv=' + expRun.level);
ok('EXP overflow preserved after level up', expRun.exp === 5, 'exp=' + expRun.exp);
ok('no pending stat points after level-up (auto-allocated)',
  !expRun.pendingStatPoints || expRun.pendingStatPoints === 0);
ok('+2 runStats points allocated on level-up', rsSum(expRun.runStats) === 2,
  'sum=' + rsSum(expRun.runStats));
ok('expToNext updates to level 2 value', expRun.expToNext === expT.expToNext(2),
  `expToNext=${expRun.expToNext}`);
// APOLOGIZE DEFAULT plan order: ['agi','str','dex'] → 2 pts = agi+1, str+1
ok('apologize default plan level-up: agi+1 str+1',
  (expRun.runStats.agi || 0) === 1 && (expRun.runStats.str || 0) === 1,
  `agi=${expRun.runStats.agi} str=${expRun.runStats.str}`);
ok('level-up immediately affects combat (ATK recomputed)',
  typeof expRun.stats.atk === 'number' && expRun.stats.atk > 0);

// 10d) ENEMY_EXP: every role has a positive numeric value
['basic', 'fast', 'tank', 'cursed', 'elite'].forEach(role =>
  ok(`ENEMY_EXP[${role}] > 0`, typeof expT.ENEMY_EXP[role] === 'number' && expT.ENEMY_EXP[role] > 0,
    'val=' + expT.ENEMY_EXP[role]));
ok('elite EXP > basic EXP', expT.ENEMY_EXP.elite > expT.ENEMY_EXP.basic);

// 10e) autoAllocatePoints: cursor continues across calls (new deterministic behavior)
// SPEED plan new order: ['agi','str','dex','agi','luk','str'] (6-element)
const testRs = { str: 0, vit: 0, agi: 0, dex: 0, luk: 0, int: 0 };
const speedTestRun = { growthPlan: 'speed', runStats: testRs, planCursor: 0,
  hero: { id: 'noctisak47' } };
expT.autoAllocatePoints(speedTestRun, 3); // cursor 0: agi+1, str+1, dex+1 → cursor=3
ok('speed plan +3 pts: agi+1 str+1 dex+1',
  testRs.agi === 1 && testRs.str === 1 && testRs.dex === 1,
  `agi=${testRs.agi} str=${testRs.str} dex=${testRs.dex}`);
ok('cursor advanced to 3 after first call', speedTestRun.planCursor === 3);
expT.autoAllocatePoints(speedTestRun, 3); // cursor 3: agi+1, luk+1, str+1 → cursor=6%6=0
ok('speed plan +3 more (cursor 3): agi=2 luk=1 str=2',
  testRs.agi === 2 && testRs.luk === 1 && testRs.str === 2,
  `agi=${testRs.agi} luk=${testRs.luk} str=${testRs.str}`);
ok('cursor wraps to 0 after full pattern', speedTestRun.planCursor === 0);

// TANK plan order: ['vit','str','dex'] → verify
const tankRs = { str: 0, vit: 0, agi: 0, dex: 0, luk: 0, int: 0 };
const tankTestRun = { growthPlan: 'tank', runStats: tankRs, planCursor: 0,
  hero: { id: 'noctisak47' } };
expT.autoAllocatePoints(tankTestRun, 2); // vit+1, str+1
ok('tank plan +2 pts: vit+1 str+1',
  tankRs.vit === 1 && tankRs.str === 1,
  `vit=${tankRs.vit} str=${tankRs.str}`);

// 10e2) cursor continues correctly across multiple level-ups (NOCTISAK47 default: ['agi','str','luk'])
const cursorRs = { str: 0, vit: 0, agi: 0, dex: 0, luk: 0, int: 0 };
const cursorRun = { growthPlan: 'default', runStats: cursorRs, planCursor: 0,
  hero: { id: 'noctisak47' } };
expT.autoAllocatePoints(cursorRun, 2); // cursor 0: agi+1, str+1 → cursor=2
ok('cursor level-up 1: agi+1 str+1', cursorRs.agi === 1 && cursorRs.str === 1,
  `agi=${cursorRs.agi} str=${cursorRs.str}`);
ok('cursor advanced to 2', cursorRun.planCursor === 2);
expT.autoAllocatePoints(cursorRun, 2); // cursor 2: luk+1, agi+1 → cursor=4%3=1
ok('cursor level-up 2 (continues from cursor 2): luk+1 agi+1',
  cursorRs.luk === 1 && cursorRs.agi === 2,
  `luk=${cursorRs.luk} agi=${cursorRs.agi}`);
ok('cursor wraps correctly across pattern', cursorRun.planCursor === 1);

// 10f) setGrowthPlan: changes plan outside battle + resets cursor
expRun.phase = 'camp';
expT.setGrowthPlan('tank');
ok('can change plan in camp phase', expRun.growthPlan === 'tank', 'plan=' + expRun.growthPlan);
ok('cursor resets to 0 on plan change', expRun.planCursor === 0, 'cursor=' + expRun.planCursor);
expT.setGrowthPlan('balance');
ok('change to balance plan', expRun.growthPlan === 'balance', 'plan=' + expRun.growthPlan);

// 10g) setGrowthPlan: blocked during battle; plan stays unchanged
expRun.phase = 'battle';
expT.setGrowthPlan('speed');
ok('plan change blocked during battle', expRun.growthPlan === 'balance', 'plan=' + expRun.growthPlan);
expRun.phase = 'camp';

// 10h) plan change does NOT retroactively alter already-allocated runStats
const rsBefore = { ...expRun.runStats };
expT.setGrowthPlan('speed');
ok('changing plan does not alter already-allocated runStats',
  BSK2.every(k => (expRun.runStats[k] || 0) === (rsBefore[k] || 0)));

// 10i) grantExp after plan change uses the new plan
expRun.phase = 'camp'; expT.setGrowthPlan('balance'); // BALANCE order: str>vit>agi>dex>luk>vit
const strBeforeChange = expRun.runStats.str || 0;
expT.grantExp(expRun.expToNext - expRun.exp); // exactly level up once
ok('after plan change level-up allocates to balance plan (STR increases)',
  (expRun.runStats.str || 0) > strBeforeChange,
  `str=${expRun.runStats.str} before=${strBeforeChange}`);
expT.setGrowthPlan('default'); // restore default for hero

// 10j) RUN END resets runStats/level/exp/planCursor; new run gets hero default plan
window.blh.__test.blhEnter();
window.blh.pickMode('blh');
window.blh.pickHero('noctisak47'); window.blh.heroNext();
window.blh.pickStage('stage1'); window.blh.startRun();
const freshRun = expT.BLH.run;
ok('run end resets level to 1', freshRun.level === 1, 'lv=' + freshRun.level);
ok('run end resets exp to 0', freshRun.exp === 0, 'exp=' + freshRun.exp);
ok('run end resets planCursor to 0', (freshRun.planCursor || 0) === 0, 'cursor=' + freshRun.planCursor);
ok('run end resets runStats to all zero', BSK2.every(k => (freshRun.runStats[k] || 0) === 0),
  'sum=' + rsSum(freshRun.runStats));
ok('noctisak47 defaults to default plan', freshRun.growthPlan === 'default',
  'plan=' + freshRun.growthPlan);
window.blh.setSpeed(1);

// 10k) HERO_DEFAULT_PLAN: all heroes start on 'default'
ok('HERO_DEFAULT_PLAN.noctisak47 = default', expT.HERO_DEFAULT_PLAN.noctisak47 === 'default');
ok('HERO_DEFAULT_PLAN.toei = default', expT.HERO_DEFAULT_PLAN.toei === 'default');
ok('HERO_DEFAULT_PLAN.apologize = default', expT.HERO_DEFAULT_PLAN.apologize === 'default');

// 10k2) HERO_DEFAULT_ORDERS: each hero has a distinct pattern
ok('HERO_DEFAULT_ORDERS exposed', !!expT.HERO_DEFAULT_ORDERS);
ok('noctisak47 default order: agi>str>luk',
  (expT.HERO_DEFAULT_ORDERS.noctisak47 || []).join(',') === 'agi,str,luk');
ok('toei default order: str>vit>dex',
  (expT.HERO_DEFAULT_ORDERS.toei || []).join(',') === 'str,vit,dex');
ok('apologize default order: agi>str>dex',
  (expT.HERO_DEFAULT_ORDERS.apologize || []).join(',') === 'agi,str,dex');

// 10k3) getPlanOrder resolves default per hero correctly
ok('getPlanOrder exposed', typeof expT.getPlanOrder === 'function');
const noct = expT.getPlanOrder({ growthPlan: 'default', hero: { id: 'noctisak47' } });
const toei = expT.getPlanOrder({ growthPlan: 'default', hero: { id: 'toei' } });
const apol = expT.getPlanOrder({ growthPlan: 'default', hero: { id: 'apologize' } });
ok('getPlanOrder noctisak47 default → agi,str,luk', noct.join(',') === 'agi,str,luk');
ok('getPlanOrder toei default → str,vit,dex', toei.join(',') === 'str,vit,dex');
ok('getPlanOrder apologize default → agi,str,dex', apol.join(',') === 'agi,str,dex');
const balOrder = expT.getPlanOrder({ growthPlan: 'balance', hero: { id: 'noctisak47' } });
ok('getPlanOrder balance returns shared pattern',
  balOrder.join(',') === 'str,vit,agi,dex,luk,vit');
ok('default pattern differs by hero', noct.join(',') !== toei.join(','));

// 10l) module exports + preset config sanity
ok('BLH exposes grantExp/setGrowthPlan/autoAllocatePoints',
  ['grantExp', 'setGrowthPlan', 'autoAllocatePoints'].every(f => typeof expT[f] === 'function'));
ok('EXP_PRESETS has 4 presets', expT.EXP_PRESETS.length === 4, 'n=' + expT.EXP_PRESETS.length);
ok('all presets have id/name/icon', expT.EXP_PRESETS.every(p => p.id && p.name && p.icon));
ok('non-default presets have order array', expT.EXP_PRESETS.filter(p => p.id !== 'default').every(p =>
  Array.isArray(p.order) && p.order.length >= 2));
ok('default preset has order null (resolved per hero)', expT.EXP_PRESETS[0].id === 'default' && expT.EXP_PRESETS[0].order === null);
ok('old plan ids removed: power/luck/mystic not in presets',
  !expT.EXP_PRESETS.some(p => ['power','luck','mystic'].includes(p.id)));

// 10m) Auto Stat chip rendered outside detail panel (always-visible row)
{
  const ph = document.getElementById('blh-panel').innerHTML;
  ok('Auto Stat chip row rendered in panel', ph.includes('blh-autostat-row') && ph.includes('blh-autostat-chip'));
  ok('Auto Stat chip shows plan name outside detail', ph.includes('DEFAULT') || ph.includes('BALANCE') || ph.includes('TANK') || ph.includes('SPEED'));
  ok('old plan labels not rendered', !ph.includes('>POWER<') && !ph.includes('>LUCK<') && !ph.includes('>MYSTIC<'));
}

// 10n) tapping chip opens growth plan detail; battle disables buttons but still allows viewing
expT.BLH.run.phase = 'camp';
window.blh.selectItem({type: 'plan'});
{
  const ph = document.getElementById('blh-panel').innerHTML;
  ok('tapping chip opens plan detail', ph.includes('blh-dock-detail-plan'));
  ok('plan detail has 4 preset buttons', (ph.match(/blh-preset-btn/g) || []).length === 4);
  ok('plan detail shows pattern', ph.includes('Pattern:'));
  ok('plan detail notes auto-apply', ph.includes('Auto-applies on level up'));
}
expT.BLH.run.phase = 'battle';
window.blh.selectItem({type: 'plan'});
{
  const ph = document.getElementById('blh-panel').innerHTML;
  ok('plan detail still visible during battle', ph.includes('blh-dock-detail-plan'));
  ok('plan buttons disabled during battle', ph.includes('disabled'));
}
expT.BLH.run.phase = 'camp';
window.blh.clearSelection();

// 11) GEAR TIER + RARITY + TRAITS ────────────────────────────────────────────
const G = window.blh.__test;
const gRun = G.BLH.run;          // fresh run from 10k (noctisak47)

// 11a) every generated gear has the full quality shape
let allShapeOK = true, allTierOK = true, allRarityOK = true, mainStrongerCount = 0, sameStatSamples = 0;
for (let i = 0; i < 400; i++) {
  gRun.loop = 1 + (i % 16);                            // sweep loop depth → all tiers
  const g = G.makeGear(gRun, {});
  if (!(g.slot && g.tier >= 1 && g.tier <= 4 && g.rarity && g.mainStat && g.subStat && Array.isArray(g.traits))) allShapeOK = false;
  if (g.tier < 1 || g.tier > 4) allTierOK = false;
  if (!G.GEAR_RARITY_BY_ID[g.rarity]) allRarityOK = false;
  if (g.mainStat.k === g.subStat.k) { sameStatSamples++; if (g.mainStat.v >= g.subStat.v) mainStrongerCount++; }
}
ok('gear always has slot/tier/rarity/main/sub/traits', allShapeOK);
ok('gear tier always 1–4', allTierOK);
ok('gear rarity always valid id', allRarityOK);
ok('main stat ≥ sub stat when same stat type', sameStatSamples === 0 || mainStrongerCount === sameStatSamples,
  `${mainStrongerCount}/${sameStatSamples}`);

// 11b) no duplicate stat key within one gear (main ≠ sub) and no duplicate traits
let noDupStat = true, noDupTrait = true, maxTraitsOK = true;
for (let i = 0; i < 400; i++) {
  gRun.loop = 1 + (i % 16);
  const g = G.makeGear(gRun, { enemyRole: 'cursed' });   // cursed boosts trait chance
  if (g.mainStat.k === g.subStat.k) noDupStat = false;
  if (g.traits.length !== new Set(g.traits).size) noDupTrait = false;
  if (g.traits.length > (G.MAX_TRAITS_BY_TIER[g.tier] || 1)) maxTraitsOK = false;
  if (g.tier <= 2 && g.traits.length > 1) maxTraitsOK = false;
}
ok('main and sub stat keys never duplicate', noDupStat);
ok('no duplicate traits within one gear', noDupTrait);
ok('trait count respects tier cap (T1–2 ≤1, T3–4 ≤2)', maxTraitsOK);

// 11c) rarity affects stat roll quality (Legendary rolls higher than Common, same tier)
// Direct quality check: rarity rollMin/rollMax bands match spec & are monotonic
const RB = Object.fromEntries(G.GEAR_RARITIES.map(r => [r.id, r]));
ok('Common quality band 40–65%', Math.abs(RB.common.rollMin - 0.40) < 1e-9 && Math.abs(RB.common.rollMax - 0.65) < 1e-9);
ok('Rare quality band 60–80%', Math.abs(RB.rare.rollMin - 0.60) < 1e-9 && Math.abs(RB.rare.rollMax - 0.80) < 1e-9);
ok('Epic quality band 75–92%', Math.abs(RB.epic.rollMin - 0.75) < 1e-9 && Math.abs(RB.epic.rollMax - 0.92) < 1e-9);
ok('Legendary quality band 90–100%', Math.abs(RB.legendary.rollMin - 0.90) < 1e-9 && Math.abs(RB.legendary.rollMax - 1.00) < 1e-9);
ok('rarity bands are monotonically increasing', RB.common.rollMin < RB.rare.rollMin &&
  RB.rare.rollMin < RB.epic.rollMin && RB.epic.rollMin < RB.legendary.rollMin);
// empirical: avg main-stat value of Legendary > Common at the same tier (build gear directly via traits table is internal;
// instead generate many and bucket by rarity)
const buckets = { common: [], rare: [], epic: [], legendary: [] };
for (let i = 0; i < 4000; i++) {
  gRun.loop = 16;                          // force T4 base
  const g = G.makeGear(gRun, {});
  if (g.tier === 4) buckets[g.rarity].push(g.mainStat.v);
}
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
if (buckets.common.length > 20 && buckets.legendary.length > 20) {
  ok('Legendary avg main-roll > Common avg main-roll (same tier)',
    mean(buckets.legendary) > mean(buckets.common),
    `leg=${mean(buckets.legendary).toFixed(1)} com=${mean(buckets.common).toFixed(1)}`);
} else {
  ok('Legendary avg main-roll > Common avg main-roll (same tier)', true, 'insufficient samples — skipped');
}

// 11d) trait chance table matches spec exactly
const TC = G.TRAIT_CHANCE;
ok('T1 Common trait 10%, 2-trait 0%', TC[1].common.t === 0.10 && TC[1].common.tt === 0);
ok('T1 Legendary trait 50%, 2-trait 0%', TC[1].legendary.t === 0.50 && TC[1].legendary.tt === 0);
ok('T3 Epic trait 80%, 2-trait 30%', TC[3].epic.t === 0.80 && TC[3].epic.tt === 0.30);
ok('T4 Legendary trait 100%, 2-trait 70%', TC[4].legendary.t === 1.00 && TC[4].legendary.tt === 0.70);
ok('T1–2 allow max 1 trait', G.MAX_TRAITS_BY_TIER[1] === 1 && G.MAX_TRAITS_BY_TIER[2] === 1);
ok('T3–4 allow max 2 traits', G.MAX_TRAITS_BY_TIER[3] === 2 && G.MAX_TRAITS_BY_TIER[4] === 2);
// empirical: T4 Legendary always rolls ≥1 trait (t=100%)
let t4LegAlways = true;
for (let i = 0; i < 200; i++) { if (G.rollGearTraits(4, 'legendary', {}).length < 1) t4LegAlways = false; }
ok('T4 Legendary always has ≥1 trait (t=100%)', t4LegAlways);
// empirical: T1 Common rarely 2 traits (tt=0 → never)
let t1Never2 = true;
for (let i = 0; i < 200; i++) { if (G.rollGearTraits(1, 'common', {}).length > 1) t1Never2 = false; }
ok('T1 never rolls 2 traits', t1Never2);

// 11e) MVP = 10 traits, each with key + cap
ok('exactly 10 traits implemented', G.GEAR_TRAITS.length === 10, 'n=' + G.GEAR_TRAITS.length);
ok('every trait has key + numeric cap', G.GEAR_TRAITS.every(t => typeof t.key === 'string' && typeof t.cap === 'number' && t.cap > 0));
const TRAIT_NAMES = G.GEAR_TRAITS.map(t => t.name);
['Blood Taste','Clean Escape','Heavy Grip','Quick Step','Lucky Find','Card Sense','Counter Guard','Last Stand','Iron Skin','Sharp Rhythm']
  .forEach(n => ok('trait present: ' + n, TRAIT_NAMES.includes(n)));

// 11f) traits stack across gear AND apply caps (aggregateTraits)
const trDef = Object.fromEntries(G.GEAR_TRAITS.map(t => [t.id, t]));
function gearWith(traits) { return { slot: 'charm', tier: 4, rarity: 'legendary', mainStat: { k: 'LUK', v: 5 }, subStat: { k: 'INT', v: 3 }, traits }; }
// equip 3 Blood Taste copies → 3×0.04 = 0.12 but capped at 0.10
gRun.gear = { weapon: gearWith(['blood_taste']), glove: gearWith(['blood_taste']), jacket: gearWith(['blood_taste']), boots: null, charm: null };
let agg = G.aggregateTraits(gRun);
ok('trait stacks across gear', agg.bloodTaste > trDef.blood_taste.per - 1e-9, 'bt=' + agg.bloodTaste);
ok('trait stack respects cap (Blood Taste ≤ 0.10)', agg.bloodTaste <= trDef.blood_taste.cap + 1e-9, 'bt=' + agg.bloodTaste);
ok('Blood Taste 3× hits the cap exactly', Math.abs(agg.bloodTaste - 0.10) < 1e-9, 'bt=' + agg.bloodTaste);
// different traits coexist
gRun.gear = { weapon: gearWith(['heavy_grip', 'last_stand']), glove: gearWith(['iron_skin']), jacket: null, boots: null, charm: null };
agg = G.aggregateTraits(gRun);
ok('multiple distinct traits aggregate independently',
  agg.heavyGrip > 0 && agg.lastStand > 0 && agg.ironSkin > 0,
  `hg=${agg.heavyGrip} ls=${agg.lastStand} is=${agg.ironSkin}`);

// 11g) lifesteal STILL comes only from gear (no base/stat source) + caps hold
// hero base with huge LUK/STR etc. but no gear → lifesteal must be 0
const noGearLS = G.deriveCombat({ str: 99, agi: 99, vit: 99, dex: 99, int: 99, luk: 99 }, {});
ok('lifesteal is 0 without gear (gear-only rule preserved)', noGearLS.lifesteal === 0, 'ls=' + noGearLS.lifesteal);
const gearLS = G.deriveCombat({ str: 0, agi: 0, vit: 0, dex: 0, int: 0, luk: 0 }, { lifesteal: 0.5 });
ok('gear lifesteal applies and is capped at 20%', Math.abs(gearLS.lifesteal - 0.20) < 1e-9, 'ls=' + gearLS.lifesteal);

// 11h) gear remains run-only — equipped/loot gear vanishes on run end (BLH.run = null → fresh init)
window.blh.__test.blhEnter();
window.blh.pickMode('blh');
window.blh.pickHero('toei'); window.blh.heroNext();
window.blh.pickStage('stage1'); window.blh.startRun();
const gFresh = window.blh.__test.BLH.run;
ok('fresh run starts with empty gear slots', G.GEAR_MAIN_POOLS && Object.keys(gFresh.gear).every(s => gFresh.gear[s] === null));
ok('fresh run starts with empty loot bag', gFresh.lootBag.length === 0);
ok('fresh run traitMods reset (all zero after recompute)',
  Object.values(gFresh.traitMods || {}).every(v => v === 0));
window.blh.setSpeed(1);

// 11i) new combat stats wired: HIT gear stat raises hitBonus; ASPD add capped at +60
const hitGear = G.deriveCombat({ str: 0, agi: 0, vit: 0, dex: 0, int: 0, luk: 0 }, { hitBonus: 0.10 });
ok('HIT gear stat raises hitBonus', hitGear.hitBonus >= 0.10 - 1e-9, 'hit=' + hitGear.hitBonus);
const aspdCap = G.deriveCombat({ str: 0, agi: 0, vit: 0, dex: 0, int: 0, luk: 0 }, { aspd: 999 });
ok('attack-speed add capped (+60 → extraHit ≤ 0.40)', aspdCap.extraHit <= 0.40 + 1e-9, 'eh=' + aspdCap.extraHit);
const dropCap = G.deriveCombat({ str: 0, agi: 0, vit: 0, dex: 0, int: 0, luk: 0 }, { dropBonus: 9 });
ok('drop bonus capped at +40%', Math.abs(dropCap.dropBonus - 0.40) < 1e-9, 'drop=' + dropCap.dropBonus);

// 12) LOCAL DANGER (per-road, derived from placed tiles) ─────────────────────
const D = window.blh.__test;
// fresh run for controlled danger tests
window.blh.__test.blhEnter();
window.blh.pickMode('blh');
window.blh.pickHero('noctisak47'); window.blh.heroNext();
window.blh.pickStage('stage1'); window.blh.startRun();
const dRun = D.BLH.run;
// clean board: clear placements + enemies
for (const id in dRun.cells) { dRun.cells[id].placedCardId = null; dRun.cells[id].enemy = null; }

const dRoadIds = D.roadCellIds();
// find a road cell with an adjacent terrain neighbor
let roadA = null, terrAdj = null;
for (const id of dRoadIds) {
  const t = D.getNeighborCells(id).find(n => n.type === 'terrain');
  if (t) { roadA = id; terrAdj = t.id; break; }
}
ok('found a road cell with adjacent terrain', !!roadA && !!terrAdj);

// 12a) road card danger applies to its own road slot
dRun.cells[roadA].placedCardId = 'blood_track';        // danger 2 (road)
ok('local danger from road tile on its own slot', D.localDangerForRoad(roadA) === 2, 'ld=' + D.localDangerForRoad(roadA));

// 12b) roadside/terrain tile on adjacent cell adds to the nearby road slot
dRun.cells[terrAdj].placedCardId = 'thornfield';        // danger 2 (terrain) on adjacent cell
ok('adjacent tile adds local danger to nearby road', D.localDangerForRoad(roadA) === 4, 'ld=' + D.localDangerForRoad(roadA));

// 12c) danger does not reach a distant (non-adjacent) road slot
const roadFar = dRoadIds.find(id => id !== roadA && !D.getNeighborCells(id).some(n => n.id === terrAdj));
ok('distant road slot has danger 0', D.localDangerForRoad(roadFar) === 0, 'ld=' + D.localDangerForRoad(roadFar));

// 12d) scaling math (every 5 danger = 1 step)
const s10 = D.localDangerScaling(10);
ok('danger 10 → 2 steps', s10.steps === 2, 'steps=' + s10.steps);
ok('HP mult 1.10 at 10 danger', Math.abs(s10.hpMult - 1.10) < 1e-9, 'hp=' + s10.hpMult);
ok('ATK mult 1.08 at 10 danger', Math.abs(s10.atkMult - 1.08) < 1e-9, 'atk=' + s10.atkMult);
ok('Zeny mult 1.10 at 10 danger', Math.abs(s10.zenyMult - 1.10) < 1e-9, 'z=' + s10.zenyMult);
ok('gear-drop +0.08 at 10 danger', Math.abs(s10.gearDropBonus - 0.08) < 1e-9, 'g=' + s10.gearDropBonus);
const s4 = D.localDangerScaling(4);
ok('danger 4 → 0 steps (no scaling under threshold)', s4.steps === 0 && s4.hpMult === 1 && s4.gearDropBonus === 0);

// 12e) per-card danger values (Street Clinic = campfire = 0)
ok('Street Clinic (campfire) danger is 0', D.cardDanger('campfire') === 0);
ok('danger values match archetypes',
  D.cardDanger('spawn_rift') === 3 && D.cardDanger('shrine') === 1 && D.cardDanger('blood_track') === 2);

// 12f) startBattle applies danger to enemy HP/ATK + sets reward mults (need ≥5 local danger)
dRun.cells[roadA].placedCardId = 'spawn_rift';          // danger 3 (self) + thornfield 2 (adj) = 5
ok('local danger reaches 5 (1 step)', D.localDangerForRoad(roadA) === 5, 'ld=' + D.localDangerForRoad(roadA));
const dEnemy = { id: 't', name: 'T', img: '', role: 'basic', maxhp: 100, hp: 100, atk: 50, def: 0, evasion: 0 };
D.startBattle({ kind: 'normal', enemies: [dEnemy], cellId: roadA });
const dbt = D.BLH._battle;
ok('battle computes danger steps', dbt.dangerSteps === 1, 'steps=' + dbt.dangerSteps);
ok('local danger scales enemy HP (+5%)', dEnemy.maxhp === 105, 'hp=' + dEnemy.maxhp);
ok('local danger scales enemy ATK (+4%)', dEnemy.atk === 52, 'atk=' + dEnemy.atk);  // round(50*1.04)=52
ok('local danger sets Loop Zeny reward mult (+5%)', Math.abs(dbt.zenyMult - 1.05) < 1e-9, 'z=' + dbt.zenyMult);
ok('local danger sets gear-drop reward bonus (+4%)', Math.abs(dbt.gearDropBonus - 0.04) < 1e-9, 'g=' + dbt.gearDropBonus);
D.BLH._battle = null; dRun.phase = 'camp';               // cleanup battle state

// 12g) loop scaling and danger scaling stack
dRun.loop = 1; dRun.mods.enemyHpMult = 1;
const eLoop1 = D.makeEnemy({ id: 'x', name: 'X', role: 'basic', base: { hp: 100, atk: 10, def: 0 } }, dRun);
dRun.loop = 11;
const eLoop11 = D.makeEnemy({ id: 'x', name: 'X', role: 'basic', base: { hp: 100, atk: 10, def: 0 } }, dRun);
ok('loop depth scaling raises base enemy HP', eLoop11.maxhp > eLoop1.maxhp, `l1=${eLoop1.maxhp} l11=${eLoop11.maxhp}`);
const stacked = Math.round(eLoop11.maxhp * D.localDangerScaling(5).hpMult);
ok('danger scaling stacks on top of loop scaling', stacked > eLoop11.maxhp, `stacked=${stacked} loopOnly=${eLoop11.maxhp}`);

// 12h) danger must NOT alter gear tier/rarity roll inputs
dRun.loop = 1; dRun.mods.lootTierBump = 0;
let tierStable = true;
for (let i = 0; i < 80; i++) { if (D.rollGearTier(dRun, { enemyRole: 'basic', gearDropBonus: 100 }) !== 1) tierStable = false; }
ok('danger/gearDropBonus never raises gear tier (loop1+basic → T1)', tierStable);
let noLeg = true;
for (let i = 0; i < 300; i++) { if (D.rollGearRarity(1, { enemyRole: 'basic', gearDropBonus: 100 }).id === 'legendary') noLeg = false; }
ok('danger never unlocks higher rarity (T1 basic → never Legendary)', noLeg);

// 12i) module exports
ok('BLH exposes localDangerForRoad/localDangerScaling/cardDanger',
  ['localDangerForRoad', 'localDangerScaling', 'cardDanger'].every(f => typeof D[f] === 'function'));

// 13) MAP CARD HAND — stacking by type (8 max) + overflow → Loop Zeny ─────────
const H = window.blh.__test;
// fresh run, empty the hand for controlled tests
window.blh.__test.blhEnter();
window.blh.pickMode('blh');
window.blh.pickHero('apologize'); window.blh.heroNext();
window.blh.pickStage('stage1'); window.blh.startRun();
const hRun = H.BLH.run;
hRun.hand = []; hRun._handOrderSeq = 0; hRun.mods.zenyBonus = 0;

// 13a) new type adds a x1 stack
H.addCardToHand(hRun, 'spawn_rift');
ok('new card type adds a x1 stack', hRun.hand.length === 1 && hRun.hand[0].cardId === 'spawn_rift' && hRun.hand[0].count === 1);

// 13b) duplicate increments the same stack (no new type, no overflow)
H.addCardToHand(hRun, 'spawn_rift');
H.addCardToHand(hRun, 'spawn_rift');
ok('duplicate drop increments stack (still 1 type)', hRun.hand.length === 1 && H.findHandStack(hRun, 'spawn_rift').count === 3);

// 13c) hand fills to 8 distinct types (all 9 cards exist; use 8 distinct)
const eightTypes = H.MAP_CARDS.map(c => c.id).slice(0, H.MAX_CARD_TYPES); // 8 distinct ids
hRun.hand = []; hRun._handOrderSeq = 0; hRun.mods.zenyBonus = 0;
for (const id of eightTypes) H.addCardToHand(hRun, id);
ok('hand holds exactly 8 card types', hRun.hand.length === H.MAX_CARD_TYPES, 'types=' + hRun.hand.length);
const oldestId = eightTypes[0];
const oldestStack = H.findHandStack(hRun, oldestId);
// give the oldest a stack of 3 so overflow conversion is deterministic
oldestStack.count = 3;
ok('oldest stack identified', H.oldestHandCardId(hRun) === oldestId);

// 13d) new type at 8/8 → removes oldest, converts to Loop Zeny, adds new type
const zenyBefore = hRun.mods.zenyBonus;
const newType = H.MAP_CARDS.map(c => c.id).find(id => !eightTypes.includes(id)); // the 9th card id
const expectConv = H.cardZenyValue(oldestId) * 3;   // oldest stack value
H.addCardToHand(hRun, newType);
ok('overflow keeps type count at 8', hRun.hand.length === H.MAX_CARD_TYPES, 'types=' + hRun.hand.length);
ok('overflow removes the oldest type', !H.findHandStack(hRun, oldestId));
ok('overflow adds the new type x1', H.findHandStack(hRun, newType) && H.findHandStack(hRun, newType).count === 1);
ok('overflow converts removed stack → Loop Zeny', hRun.mods.zenyBonus === zenyBefore + expectConv,
  `got=${hRun.mods.zenyBonus - zenyBefore} exp=${expectConv}`);

// 13e) placing consumes 1 from the stack (stack 0 removes the type)
hRun.hand = []; hRun._handOrderSeq = 0;
H.addCardToHand(hRun, 'rock'); H.addCardToHand(hRun, 'rock');   // rock x2 (terrain)
ok('consume decrements stack', H.consumeCardFromHand(hRun, 'rock') === true && H.findHandStack(hRun, 'rock').count === 1);
ok('consume to 0 removes the type', H.consumeCardFromHand(hRun, 'rock') === true && !H.findHandStack(hRun, 'rock'));
ok('consume on missing type returns false', H.consumeCardFromHand(hRun, 'rock') === false);

// 13f) failed placement consumes nothing (placeAt on invalid cell)
hRun.hand = []; hRun._handOrderSeq = 0;
H.addCardToHand(hRun, 'shrine');   // adjacent card (needs terrain-adjacent-to-road cell)
hRun._placing = 'shrine';
const campId = H.BLH_MAP.route[0];                 // camp cell — never a valid placement
window.blh.placeAt(campId);
ok('failed placement does not consume the card', H.findHandStack(hRun, 'shrine') && H.findHandStack(hRun, 'shrine').count === 1);

// 13g) Cash Out converts remaining stacks to Loop Zeny (handZeny folded into estCashOut)
hRun.hand = []; hRun._handOrderSeq = 0;
H.addCardToHand(hRun, 'spawn_rift');                          // road = 2
H.addCardToHand(hRun, 'rock'); H.addCardToHand(hRun, 'rock'); // terrain = 4 each → 8
const expHandZeny = H.cardZenyValue('spawn_rift') * 1 + H.cardZenyValue('rock') * 2;
ok('handZeny sums per-kind stack values', H.handZeny(hRun) === expHandZeny, `got=${H.handZeny(hRun)} exp=${expHandZeny}`);
ok('Cash Out conversion values are small (per-kind 2–4)',
  H.cardZenyValue('spawn_rift') === 2 && H.cardZenyValue('shrine') === 3 && H.cardZenyValue('rock') === 4);

// 13h) cards are run-only — fresh run starts with a stacked-shape hand (entries, not raw ids)
window.blh.__test.blhEnter();
window.blh.pickMode('blh');
window.blh.pickHero('toei'); window.blh.heroNext();
window.blh.pickStage('stage1'); window.blh.startRun();
const hFresh = H.BLH.run;
ok('fresh hand uses stack entries {cardId,count,order}', hFresh.hand.every(s =>
  typeof s.cardId === 'string' && typeof s.count === 'number' && typeof s.order === 'number'));
ok('fresh hand within 8-type limit', hFresh.hand.length <= H.MAX_CARD_TYPES);
window.blh.setSpeed(1);

// 14) GEAR BAG cap + overflow auto-salvage ───────────────────────────────────
const B = window.blh.__test;
// fresh run for controlled bag tests
window.blh.__test.blhEnter();
window.blh.pickMode('blh');
window.blh.pickHero('noctisak47'); window.blh.heroNext();
window.blh.pickStage('stage1'); window.blh.startRun();
const oRun = B.BLH.run;
const mkG = (slot, mv) => ({ slot, tier: 1, rarity: 'common', mainStat: { k: 'ATK', v: mv }, subStat: { k: 'STR', v: 1 }, traits: [] });
// gearWorth(mkG(slot,mv)) = mv + 1

// 14a) bag cap = 12 base; Arena Training expansion raises it (+2/level, max 18)
B.BLH.save.upgrades.bagExpand = 0;
ok('bag cap base = 12', B.bagCap() === 12, 'cap=' + B.bagCap());
B.BLH.save.upgrades.bagExpand = 2;
ok('bag expansion raises cap (+2/level)', B.bagCap() === 16, 'cap=' + B.bagCap());
B.BLH.save.upgrades.bagExpand = 3;
ok('bag expansion max cap = 18', B.bagCap() === 18, 'cap=' + B.bagCap());
B.BLH.save.upgrades.bagExpand = 0;   // back to base for overflow test

// 14b) overflow: new gear stays, OLDEST loot gear auto-salvaged, equipped untouched, 40% paid
oRun.lootBag = []; oRun.mods.zenyBonus = 0;
oRun.gear = { weapon: mkG('weapon', 50), glove: null, jacket: null, boots: null, charm: null }; // equipped (worth 51)
for (let i = 0; i < 12; i++) oRun.lootBag.push(mkG('glove', 10 + i));  // fill to cap; oldest = v10 (worth 11)
const bagZenyBefore = oRun.mods.zenyBonus;
const newGear = mkG('boots', 99);                                       // worth 100
oRun.lootBag.push(newGear);                                            // 13 > cap 12
const salvaged = B.enforceBagCap(oRun);
ok('overflow brings bag back to cap (12)', oRun.lootBag.length === 12, 'len=' + oRun.lootBag.length);
ok('overflow salvages exactly one', salvaged.length === 1, 'n=' + salvaged.length);
ok('overflow keeps the new gear', oRun.lootBag.includes(newGear));
ok('overflow removes the OLDEST loot gear (v10 gone)', !oRun.lootBag.some(g => g.mainStat.v === 10));
ok('auto-salvage pays 40% of manual value', oRun.mods.zenyBonus - bagZenyBefore === Math.floor(11 * 0.40),
  `got=${oRun.mods.zenyBonus - bagZenyBefore} exp=${Math.floor(11 * 0.40)}`);
ok('equipped gear is never auto-salvaged', oRun.gear.weapon && oRun.gear.weapon.mainStat.v === 50);

// 14c) auto-salvage value helper = floor(gearWorth * 0.40)
const sample = mkG('charm', 24);                  // worth 25 → floor(25*0.4)=10
ok('autoSalvageValue = floor(worth × 0.40)', B.autoSalvageValue(sample) === 10, 'v=' + B.autoSalvageValue(sample));

// 14d) manual sell keeps 100% of salvage value and removes the gear
oRun.lootBag = [mkG('glove', 20)]; oRun.mods.zenyBonus = 0;  // worth 21
window.blh.sellLoot(0);
ok('manual sell pays 100% (worth 21)', oRun.mods.zenyBonus === 21, 'z=' + oRun.mods.zenyBonus);
ok('manual sell removes gear from bag', oRun.lootBag.length === 0);

// 14e) Cash Out still converts remaining loot + equipped gear (lootValue)
oRun.gear = { weapon: null, glove: null, jacket: null, boots: null, charm: null };
oRun.lootBag = [mkG('charm', 5)];                 // bag worth 6 ×1
ok('cash out counts remaining bag gear ×1', B.lootValue(oRun) === 6, 'lv=' + B.lootValue(oRun));
oRun.gear.weapon = mkG('weapon', 9);              // equipped worth 10 ×2 = 20
ok('cash out counts equipped gear ×2', B.lootValue(oRun) === 6 + 20, 'lv=' + B.lootValue(oRun));

// 14f) module exports
ok('BLH exposes bagCap/enforceBagCap/autoSalvageValue',
  ['bagCap', 'enforceBagCap', 'autoSalvageValue'].every(f => typeof B[f] === 'function'));
ok('manual sell exposed on bridge', typeof window.blh.sellLoot === 'function');
B.BLH.save.upgrades.bagExpand = 0;   // cleanup

// ── report ───────────────────────────────────────────────────────────────────
for (const c of checks) {
  console.log(`${c.cond ? '✅' : '❌'} ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
}
console.log(`\n${checks.length - failures}/${checks.length} checks passed`);
if (failures) { console.error(`\n❌ smoke check FAILED (${failures} failing)`); process.exit(1); }
console.log('\n✅ Boss Loop Hero smoke check passed');
