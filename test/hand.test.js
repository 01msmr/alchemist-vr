import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHand, TIP_Z } from '../src/hand.js';

test('thumb and index finger meet at the pinch point when the trigger is fully pressed', () => {
  const hand = createHand();
  hand.update(0, 0);
  const open = hand.indexTip.distanceTo(hand.thumbTip);
  assert.ok(open > 0.04, 'open: the fingertips are apart');
  hand.update(1, 0);
  assert.ok(hand.indexTip.distanceTo(hand.thumbTip) < 1e-9);
  assert.ok(Math.abs(hand.indexTip.z + TIP_Z) < 1e-9 && Math.abs(hand.indexTip.y) < 1e-9);
});

test('squeeze curls the other fingers', () => {
  const hand = createHand();
  hand.update(0, 0);
  assert.ok(Math.abs(hand.fingers.rotation.x) < 1e-12);
  hand.update(0, 1);
  assert.ok(hand.fingers.rotation.x < -1);
});
