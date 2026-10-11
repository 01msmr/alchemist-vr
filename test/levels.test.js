import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, stirCrucible, advanceLevel, landSubstance, levelOf } from '../src/game/sim.js';
import { LEVELS } from '../src/game/levels/index.js';
import { amalgamQuality, goldQuality } from '../src/game/scoring.js';
import { CFG, TOOLS } from '../src/config/index.js';

const DT = 0.05;
function run(s, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += DT) step(s, DT);
}
const mid = (a, b) => (a + b) / 2;
// a state in the given level with the crucible set up
function stateIn(level, content, { amounts = {}, ...fields } = {}) {
  const s = createState();
  s.level = level;
  Object.assign(s.crucible, { content, ...fields, amounts });
  return s;
}

// ---- the level table itself ----
test('levels are numbered in order and each carries what the engine and the view need', () => {
  assert.ok(LEVELS.length >= 2);
  LEVELS.forEach((level, i) => {
    assert.equal(level.id, i + 1);
    assert.ok(Array.isArray(level.reactions) && (level.reactions.length > 0 || typeof level.tick === 'function'), `level ${level.id} has reactions or its own tick`);
    assert.equal(typeof level.complete, 'function');
    assert.equal(typeof level.status, 'function');
    assert.ok(level.gauge.substance in level.accepts, 'the gauge shows a substance the crucible accepts');
    assert.ok(level.scene.tools.every((id) => id in TOOLS), 'only known tools');
    const ids = level.reactions.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, 'reaction ids are unique');
  });
});

test('every level starts with its own objects and the status lines have the shape the panel expects', () => {
  const s = createState();
  for (const level of LEVELS) {
    s.level = level.id;
    const lines = levelOf(s).status(s, { puddleTotal: 0 });
    assert.ok(Array.isArray(lines) && lines.length >= 1 && lines.every((l) => typeof l === 'string'));
  }
});

// ---- level 1: lead + mercury -> amalgam ----
test('cold lead refuses mercury: it is wasted', () => {
  const s = createState();
  landSubstance(s, 'hg', 0.5);
  assert.equal(s.crucible.amounts.hg ?? 0, 0);
  assert.equal(s.wasted, 0.5);
  s.crucible.temp = 0.7;
  landSubstance(s, 'hg', 0.25);
  assert.equal(s.crucible.amounts.hg, 0.25);
});

test('dose in window on liquid lead becomes amalgam after the hold', () => {
  const s = stateIn(1, 'lead', { temp: 0.7, amounts: { hg: 1.0 } });
  run(s, CFG.AMALGAM_HOLD - 0.2);
  assert.equal(s.crucible.content, 'lead');
  run(s, 0.4);
  assert.equal(s.crucible.content, 'amalgam');
  assert.ok(s.crucible.quality > 0.7 && s.crucible.quality <= 1);
});

test('too much mercury makes sludge immediately', () => {
  const s = stateIn(1, 'lead', { temp: 0.7, amounts: { hg: CFG.DOSE_MAX + 0.1 } });
  run(s, DT);
  assert.equal(s.crucible.content, 'sludge');
});

test('lead cooling below melt mid-hold resets the progress', () => {
  const s = stateIn(1, 'lead', { temp: 0.52, amounts: { hg: 1.0 } });
  run(s, 1);
  assert.equal(s.crucible.content, 'lead');
  assert.equal(s.progress.amalgam, 0);
});

test('overheating burns the lead', () => {
  const s = stateIn(1, 'lead', { temp: 0.95 });
  s.candleLit = true;
  run(s, CFG.BURN_HOLD + 0.2);
  assert.equal(s.crucible.content, 'burnt');
});

test('quality peaks at the middle of dose and heat windows', () => {
  const best = amalgamQuality({ amounts: { hg: mid(CFG.DOSE_MIN, CFG.DOSE_MAX) }, temp: mid(CFG.MELT, CFG.BURN) });
  assert.ok(Math.abs(best - 1) < 1e-9);
  assert.ok(amalgamQuality({ amounts: { hg: CFG.DOSE_MAX - 0.01 }, temp: CFG.MELT + 0.02 }) < 0.3);
});

// ---- level 2: amalgam + sulfur + heat + stirring -> gold ----
test('sulfur is only taken by the amalgam in level 2; otherwise it is wasted', () => {
  const s = createState();
  landSubstance(s, 'sulfur', 0.1);
  assert.equal(s.crucible.amounts.sulfur ?? 0, 0);
  assert.equal(s.wasted, 0.1);
  const a = stateIn(2, 'amalgam', { quality: 0.9, temp: 0.72 });
  landSubstance(a, 'sulfur', 0.1);
  assert.ok(Math.abs(a.crucible.amounts.sulfur - 0.1) < 1e-12);
  landSubstance(a, 'hg', 0.1);
  assert.equal(a.wasted, 0.1, 'level 2 takes no more mercury');
});

test('stirring builds up while stirring hot amalgam with sulfur and fades otherwise', () => {
  const s = stateIn(2, 'amalgam', { temp: 0.72, amounts: { sulfur: 0.5 } });
  stirCrucible(s, 1, true);
  assert.equal(s.crucible.stir, 1);
  stirCrucible(s, 1, false);
  assert.ok(Math.abs(s.crucible.stir - (1 - CFG.STIR_DECAY)) < 1e-12);
  const cold = stateIn(2, 'amalgam', { temp: 0.2, amounts: { sulfur: 0.5 } });
  stirCrucible(cold, 1, true);
  assert.equal(cold.crucible.stir, 0);
  const none = stateIn(2, 'amalgam', { temp: 0.72 });
  stirCrucible(none, 1, true);
  assert.equal(none.crucible.stir, 0);
  const level1 = stateIn(1, 'amalgam', { temp: 0.72, amounts: { sulfur: 0.5 } });
  stirCrucible(level1, 1, true);
  assert.equal(level1.crucible.stir, 0, 'level 1 has no stirring');
});

test('amalgam + sulfur in window + heat + enough stirring makes gold', () => {
  const s = stateIn(2, 'amalgam', { quality: 0.9, temp: mid(CFG.MELT, CFG.BURN), amounts: { sulfur: mid(CFG.SULFUR_MIN, CFG.SULFUR_MAX) } });
  run(s, 1);
  assert.equal(s.crucible.content, 'amalgam', 'not stirred yet');
  stirCrucible(s, CFG.STIR_NEEDED, true);
  run(s, DT);
  assert.equal(s.crucible.content, 'gold');
  assert.ok(s.crucible.quality > 0.85);
});

test('a poor amalgam and sloppy dose give dull gold or fool\'s gold', () => {
  const dull = stateIn(2, 'amalgam', { quality: 0.3, temp: CFG.MELT + 0.05, stir: CFG.STIR_NEEDED, amounts: { sulfur: CFG.SULFUR_MIN + 0.01 } });
  run(dull, DT);
  assert.ok(['dull', 'fools'].includes(dull.crucible.content));
  assert.ok(dull.crucible.quality < CFG.GOLD_MIN);
  assert.ok(goldQuality({ quality: 0, amounts: { sulfur: 0.5 }, temp: 0.72 }) < 0.7);
});

test('too much sulfur makes slag at once; overheating with sulfur burns it', () => {
  const slag = stateIn(2, 'amalgam', { temp: 0.72, amounts: { sulfur: CFG.SULFUR_MAX + 0.1 } });
  run(slag, DT);
  assert.equal(slag.crucible.content, 'slag');
  const burnt = stateIn(2, 'amalgam', { temp: 0.99, amounts: { sulfur: 0.5 } });
  burnt.candleLit = true;
  run(burnt, CFG.BURN_HOLD + 0.2);
  assert.equal(burnt.crucible.content, 'burnt');
});

test('overheating plain amalgam does not burn it (only once sulfur is in)', () => {
  const s = stateIn(2, 'amalgam', { temp: 0.99 });
  s.candleLit = true;
  run(s, CFG.BURN_HOLD + 1);
  assert.equal(s.crucible.content, 'amalgam');
});

test('right sulfur and heat but never stirred clumps into fool\'s gold', () => {
  const s = stateIn(2, 'amalgam', { temp: 0.72, amounts: { sulfur: mid(CFG.SULFUR_MIN, CFG.SULFUR_MAX) } });
  s.candleLit = true;
  for (let t = 0; t < CFG.LUMP_HOLD + 1; t += DT) {
    step(s, DT);
    s.crucible.temp = 0.72; // held steady
  }
  assert.equal(s.crucible.content, 'fools');
});

// ---- moving between levels ----
test('a level ends a moment after it is complete, paused while the vial is held, and returns the next level once', () => {
  const s = createState();
  assert.equal(advanceLevel(s, 1, false), null, 'not complete yet');
  s.crucible.content = 'amalgam';
  assert.equal(advanceLevel(s, 0.1, false), null);
  assert.equal(advanceLevel(s, CFG.TIDY_DELAY, true), null, 'held: the countdown waits');
  const next = advanceLevel(s, CFG.TIDY_DELAY, false);
  assert.equal(next.id, 2);
  assert.equal(s.level, 2);
  assert.deepEqual(s.progress, {}, 'the new level starts without leftover progress');
  assert.equal(advanceLevel(s, 10, false), null, 'only once');
});

test('the last level has no next level to move to', () => {
  const s = createState();
  s.level = LEVELS.length;
  s.nugget = { kind: 'gold', quality: 1 };
  assert.equal(advanceLevel(s, 10, false), null);
  assert.equal(s.level, LEVELS.length);
});
