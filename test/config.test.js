import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG, CONSOLE, LAYOUT, INPUT, PHYSICS, TOOLS, VIEW } from '../src/config/index.js';

// every number in the config, however deep
function numbers(object, path = '') {
  return Object.entries(object).flatMap(([key, value]) => {
    if (typeof value === 'number') return [[`${path}${key}`, value]];
    if (value && typeof value === 'object') return numbers(value, `${path}${key}.`);
    return [];
  });
}

test('all config objects are frozen, so nothing changes a value by accident', () => {
  const deeplyFrozen = (object) => Object.isFrozen(object) && Object.values(object).every((v) => !v || typeof v !== 'object' || deeplyFrozen(v));
  for (const config of [CFG, CONSOLE, LAYOUT, INPUT, PHYSICS, TOOLS, VIEW]) assert.ok(deeplyFrozen(config));
  assert.throws(() => { 'use strict'; CFG.MELT = 0; }, TypeError);
});

test('every number in the config is a real number', () => {
  for (const config of [CFG, CONSOLE, LAYOUT, INPUT, PHYSICS, TOOLS, VIEW]) {
    for (const [name, value] of numbers(config)) assert.ok(Number.isFinite(value), `${name} is ${value}`);
  }
});

test('windows and thresholds are in the right order', () => {
  assert.ok(CFG.DOSE_MIN < CFG.DOSE_MAX && CFG.SULFUR_MIN < CFG.SULFUR_MAX);
  assert.ok(CFG.MELT < CFG.CRITICAL && CFG.CRITICAL < CFG.BURN && CFG.BURN <= 1);
  assert.ok(CFG.DULL_MIN < CFG.GOLD_MIN);
  assert.ok(CFG.STRIKE_SPEED < CFG.STRIKE_MAX);
  assert.ok(CFG.POUR_ANGLE_MIN_DEG < CFG.POUR_ANGLE_MAX_DEG);
  assert.ok(INPUT.analog.squeezeOff < INPUT.analog.squeezeOn && INPUT.analog.pinchOff < INPUT.analog.pinchOn, 'hysteresis');
  assert.ok(INPUT.hand.pinch.closed < INPUT.hand.pinch.open && INPUT.hand.gripCurl.closed < INPUT.hand.gripCurl.open);
  assert.ok(INPUT.striker.yMin < INPUT.striker.yMax && INPUT.reach.nuggetBand.yMin < INPUT.reach.nuggetBand.yMax);
  assert.ok(PHYSICS.grip.fist.forceG > PHYSICS.grip.pinch.forceG, 'a fist holds stronger than a pinch');
});

test('the filter and calibration settings make sense', () => {
  for (const f of [INPUT.filter.fist.pos, INPUT.filter.fist.rot]) assert.ok(f.minCutoff > 0 && f.beta >= 0 && f.dCutoff > 0);
  assert.ok(LAYOUT.table.heightRange[0] < LAYOUT.table.h && LAYOUT.table.h < LAYOUT.table.heightRange[1], 'the default table height is plausible');
  assert.ok(INPUT.calibration.tap.count > 0 && INPUT.calibration.tap.maxGap > 0 && typeof INPUT.calibration.storageKey === 'string');
  for (const turn of [INPUT.controller.turn, INPUT.hand.turn]) assert.ok(['x', 'y', 'z'].every((a) => Number.isInteger(turn[a])), 'turns are whole quarter turns');
  assert.ok(INPUT.calibration.keepAway > 0 && INPUT.calibration.band > 0);
});

test('every tool has what the physics and the hands need', () => {
  for (const [id, spec] of Object.entries(TOOLS)) {
    for (const key of ['half', 'mass', 'axisHalf', 'radius', 'grabRadius', 'snap']) assert.ok(key in spec, `${id}.${key}`);
    assert.ok(['upright', 'keep'].includes(spec.snap));
    assert.ok(spec.axisHalf <= Math.max(spec.half.x, spec.half.y, spec.half.z));
  }
  for (const id of Object.keys(LAYOUT.rest)) assert.ok(id in TOOLS, `a rest pose for the unknown tool ${id}`);
});

test('the table bounds are derived from the table and the world origin', () => {
  const b = LAYOUT.tableBounds;
  assert.equal(b.maxX - b.minX, LAYOUT.table.w);
  assert.ok(Math.abs(b.maxZ - b.minZ - LAYOUT.table.d) < 1e-12);
  assert.ok(b.minX < LAYOUT.crucible.x && LAYOUT.crucible.x < b.maxX && b.minZ < LAYOUT.crucible.z && LAYOUT.crucible.z < b.maxZ, 'the crucible is on the table');
});
