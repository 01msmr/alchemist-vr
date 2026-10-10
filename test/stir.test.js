import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStirTracker } from '../src/game/stir.js';
import { CFG } from '../src/game/config.js';

const TARGET = { cx: 0, cz: 0, top: 0.14, bottom: 0.08, radius: 0.035 };

test('moving across inside the crucible stirs; standing still or outside does not', () => {
  const tracker = createStirTracker();
  const dt = 1 / 72;
  assert.equal(tracker.update({ x: 0, y: 0.12, z: 0 }, dt, TARGET), false, 'first frame has no speed');
  const speed = CFG.STIR_MIN_SPEED * 2;
  assert.equal(tracker.update({ x: speed * dt, y: 0.12, z: 0 }, dt, TARGET), true);
  assert.equal(tracker.update({ x: speed * dt, y: 0.12, z: 0 }, dt, TARGET), false, 'standing still');
  assert.equal(tracker.update({ x: 0.2, y: 0.12, z: 0 }, dt, TARGET), false, 'outside the crucible');
  tracker.update({ x: 0, y: 0.2, z: 0 }, dt, TARGET);
  assert.equal(tracker.update({ x: 0.01, y: 0.2, z: 0 }, dt, TARGET), false, 'above the rim');
  tracker.update({ x: 0, y: 0.1, z: 0 }, dt, TARGET);
  assert.equal(tracker.update({ x: 0.01, y: 0.1, z: 0 }, dt, TARGET), true, 'fast enough sideways motion');
  tracker.reset();
  assert.equal(tracker.update({ x: 0, y: 0.1, z: 0 }, dt, TARGET), false);
});
