import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG, DIFFICULTY } from '../src/config/index.js';
import { rulesFor, rules, useDifficulty } from '../src/game/rules.js';
import { level1 } from '../src/game/levels/level1.js';
import { level2 } from '../src/game/levels/level2.js';
import { createState, step } from '../src/game/sim.js';

const levels = ['easy', 'normal', 'hard'];

test('normal is the plain config, the others change only keys that exist in it', () => {
  assert.deepEqual({ ...rulesFor('normal') }, { ...CFG });
  assert.deepEqual({ ...rulesFor('nonsense') }, { ...CFG });
  for (const name of levels) for (const key of Object.keys(DIFFICULTY[name])) assert.ok(key in CFG, `${name}.${key}`);
});

test('every difficulty keeps its windows and thresholds in order', () => {
  for (const name of levels) {
    const r = rulesFor(name);
    assert.ok(r.DOSE_MIN < r.DOSE_MAX && r.SULFUR_MIN < r.SULFUR_MAX, name);
    assert.ok(r.MELT < r.CRITICAL && r.CRITICAL < r.BURN && r.BURN <= 1, name);
    assert.ok(r.STRIKE_SPEED < r.STRIKE_MAX && r.BURN_HOLD > 0 && r.STIR_NEEDED > 0, name);
    assert.ok(r.DOSE_MIN < 1 && 1 < r.DOSE_MAX, 'the target dose of 1.0 stays inside the window');
  }
});

test('easier is more forgiving in every direction', () => {
  const [easy, normal, hard] = levels.map(rulesFor);
  const width = (r, a, b) => r[b] - r[a];
  for (const [a, b] of [['DOSE_MIN', 'DOSE_MAX'], ['SULFUR_MIN', 'SULFUR_MAX'], ['STRIKE_SPEED', 'STRIKE_MAX']]) {
    assert.ok(width(easy, a, b) > width(normal, a, b) && width(normal, a, b) > width(hard, a, b), `${a}..${b}`);
  }
  for (const key of ['BURN', 'BURN_HOLD', 'LUMP_HOLD', 'BREAK_SPEED_FACTOR', 'SPARE_VIALS']) assert.ok(easy[key] > normal[key] && normal[key] > hard[key] || key === 'SPARE_VIALS' && easy[key] > hard[key], key);
  assert.ok(easy.STIR_NEEDED < normal.STIR_NEEDED && normal.STIR_NEEDED < hard.STIR_NEEDED, 'less stirring is easier');
  assert.ok(easy.HEAT_RATE < normal.HEAT_RATE && normal.HEAT_RATE < hard.HEAT_RATE, 'slower heating is easier to control');
});

test('the levels read the rules of the chosen difficulty when they are checked', () => {
  const c = { content: 'lead', temp: 0.7, amounts: { hg: 1.2 }, stir: 0, quality: null };
  const amalgam = level1.reactions.find((r) => r.id === 'amalgam');
  const sludge = level1.reactions.find((r) => r.id === 'sludge');
  try {
    useDifficulty('hard');
    assert.equal(amalgam.when(c), false, '1.2 doses is outside the narrow window');
    assert.equal(sludge.when(c), true, 'and too much');
    assert.deepEqual(level1.gauge.window, [DIFFICULTY.hard.DOSE_MIN, DIFFICULTY.hard.DOSE_MAX]);
    assert.equal(level1.reactions.find((r) => r.id === 'burn').hold, DIFFICULTY.hard.BURN_HOLD);
    useDifficulty('easy');
    assert.equal(amalgam.when(c), true, 'the same mercury is fine on easy');
    assert.equal(sludge.when(c), false);
    assert.equal(level2.gauge.hold.seconds, DIFFICULTY.easy.STIR_NEEDED);
  } finally {
    useDifficulty('normal');
  }
  assert.equal(rules().DOSE_MAX, CFG.DOSE_MAX);
});

test('the heat rises at the chosen rate', () => {
  const heat = (name) => {
    useDifficulty(name);
    const s = createState();
    s.candleLit = true;
    step(s, 1);
    return s.crucible.temp;
  };
  try {
    assert.ok(Math.abs(heat('hard') - DIFFICULTY.hard.HEAT_RATE) < 1e-9);
    assert.ok(Math.abs(heat('easy') - DIFFICULTY.easy.HEAT_RATE) < 1e-9);
  } finally {
    useDifficulty('normal');
  }
});
