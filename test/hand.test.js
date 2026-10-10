import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPincer, createFistWrap, createPinchGrip } from '../src/hand.js';
import { INPUT } from '../src/config/index.js';

const TIP_Z = INPUT.controller.tipZ;

const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('thumb and index finger meet at the pinch point when the trigger is fully pressed', () => {
  const pincer = createPincer();
  pincer.update(0);
  assert.ok(pincer.indexTip.distanceTo(pincer.thumbTip) > 0.04, 'open: the fingertips are apart');
  pincer.update(1);
  assert.ok(pincer.indexTip.distanceTo(pincer.thumbTip) < 1e-9);
  assert.ok(Math.abs(pincer.indexTip.z + TIP_Z) < 1e-9 && Math.abs(pincer.indexTip.y) < 1e-9);
});

test('the fist wraps the vial with the palm on the side where the hand is', () => {
  const fist = createFistWrap();
  fist.place(V(0, 0.1, 0), V(0, 1, 0), V(0.3, 0.1, 0)); // hand to the right
  fist.group.updateMatrixWorld(true);
  const palm = fist.palm.getWorldPosition(V(0, 0, 0));
  assert.ok(palm.x > 0.03 && Math.abs(palm.y - 0.1) < 1e-9 && Math.abs(palm.z) < 1e-9);
  fist.place(V(0, 0.1, 0), V(0, 1, 0), V(0, 0.1, -0.3)); // hand behind
  fist.group.updateMatrixWorld(true);
  assert.ok(fist.palm.getWorldPosition(V(0, 0, 0)).z < -0.03);
});

test('the fist also works for a tilted vial and a hand right on the axis', () => {
  const fist = createFistWrap();
  const axis = V(1, 1, 0).normalize();
  fist.place(V(0, 0, 0), axis, V(0, 0, 0.2));
  fist.group.updateMatrixWorld(true);
  const palm = fist.palm.getWorldPosition(V(0, 0, 0));
  assert.ok(Math.abs(palm.dot(axis)) < 1e-9, 'palm is across the axis, not along it');
  fist.place(V(0, 0, 0), axis, V(0, 0, 0)); // degenerate
  assert.ok(Number.isFinite(fist.group.quaternion.x));
});

test('the pinch grips the vial from two opposite sides, perpendicular to the axis', () => {
  const grip = createPinchGrip();
  const anchor = V(0, 0.1, 0);
  grip.place(anchor, V(0, 1, 0), V(0.3, 0.12, 0.1));
  const a = grip.padA.position;
  const b = grip.padB.position;
  assert.ok(Math.abs(a.distanceTo(b) - 0.057) < 1e-9);
  assert.ok(Math.abs(a.clone().add(b).multiplyScalar(0.5).distanceTo(anchor)) < 1e-9);
  assert.ok(Math.abs(a.clone().sub(b).dot(V(0, 1, 0))) < 1e-9);
});
