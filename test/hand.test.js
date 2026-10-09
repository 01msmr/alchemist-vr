import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
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

test('holding turns the fist so the rod axis runs along the grip\'s up (thumb) direction', () => {
  const hand = createHand();
  hand.setHold(0);
  const neutral = new THREE.Vector3(1, 0, 0).applyQuaternion(hand.group.quaternion);
  assert.ok(neutral.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-9);
  hand.setHold(1);
  const held = new THREE.Vector3(1, 0, 0).applyQuaternion(hand.group.quaternion);
  assert.ok(held.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9);
});
