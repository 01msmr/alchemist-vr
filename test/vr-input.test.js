import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateInput, tipWorld, palmWorld, analog } from '../src/vr.js';
import { INPUT } from '../src/config/index.js';

const PINCH = INPUT.hand.pinch;

const joint = (x, y, z) => ({ visible: true, position: new THREE.Vector3(x, y, z) });
function trackedHand({ pinchGap = 0.1, curl = 0 } = {}) {
  const tipZ = -0.17 + 0.12 * curl;
  return {
    visible: true,
    joints: {
      wrist: joint(0, 0, 0),
      'index-finger-metacarpal': joint(0, 0.03, -0.02),
      'pinky-finger-metacarpal': joint(0, -0.03, -0.02),
      'middle-finger-phalanx-proximal': joint(0, 0, -0.09),
      'index-finger-tip': joint(-0.02, 0, -0.1 - 0.1 * (1 - curl)),
      'thumb-tip': joint(-0.02, pinchGap, -0.1 - 0.1 * (1 - curl)),
      'middle-finger-tip': joint(-0.02 * curl, 0, tipZ),
      'ring-finger-tip': joint(-0.02 * curl, -0.02, tipZ),
      'pinky-finger-tip': joint(-0.02 * curl, -0.04, tipZ),
    },
  };
}
function makeHand(overrides = {}) {
  const grip = new THREE.Object3D();
  grip.matrixAutoUpdate = false;
  grip.visible = false;
  return {
    handedness: 'right', grip, gamepad: null, trackedHand: { visible: false, joints: {} },
    mode: 'none', pinch: 0, squeeze: 0,
    tipPoint: new THREE.Vector3(), indexPoint: new THREE.Vector3(), graspPoint: new THREE.Vector3(), tipInGrip: new THREE.Vector3(),
    ...overrides,
  };
}

test('a tracked hand fills the grip frame, the fingertip point and both strengths', () => {
  const hand = makeHand({ trackedHand: trackedHand({ pinchGap: PINCH.closed, curl: 1 }) });
  updateInput(hand);
  assert.equal(hand.mode, 'tracked');
  assert.equal(hand.pinch, 1);
  assert.equal(hand.squeeze, 1);
  const tip = tipWorld(hand, new THREE.Vector3());
  assert.ok(tip.distanceTo(new THREE.Vector3(-0.02, PINCH.closed / 2, -0.1)) < 1e-9);
  assert.ok(hand.indexPoint.distanceTo(new THREE.Vector3(-0.02, 0, -0.1)) < 1e-9, 'the index fingertip itself, not the pinch point');
  // the pinch point expressed in the grip frame, turned back, is the same point
  const back = hand.tipInGrip.clone().applyMatrix4(hand.grip.matrixWorld);
  assert.ok(back.distanceTo(tip) < 1e-9);
  // the grasp point is in front of the palm, on the right hand's palm side
  assert.ok(palmWorld(hand, new THREE.Vector3()).x < -0.03);
});

test('an open tracked hand reads zero strength', () => {
  const hand = makeHand({ trackedHand: trackedHand({ pinchGap: 0.1, curl: 0 }) });
  updateInput(hand);
  assert.deepEqual(analog(hand), { pinch: 0, squeeze: 0 });
});

test('a controller is the fallback: analog values from the trigger and the grip button', () => {
  const hand = makeHand({ gamepad: { buttons: [{ value: 0.8 }, { value: 0.4 }] } });
  hand.grip.visible = true;
  hand.grip.matrixWorld.makeTranslation(1, 2, 3);
  updateInput(hand);
  assert.equal(hand.mode, 'controller');
  assert.deepEqual(analog(hand), { pinch: 0.8, squeeze: 0.4 });
  assert.ok(Math.abs(tipWorld(hand, new THREE.Vector3()).x - 1) < 1e-9);
});

test('a tracked hand wins over a controller; nothing tracked and no pose gives zeros', () => {
  const both = makeHand({ trackedHand: trackedHand({ pinchGap: PINCH.closed }), gamepad: { buttons: [{ value: 1 }, { value: 1 }] } });
  both.grip.visible = true;
  updateInput(both);
  assert.equal(both.mode, 'tracked');
  assert.equal(both.squeeze, 0, 'the strengths come from the fingers, not the controller');

  const none = makeHand({ pinch: 0.7, squeeze: 0.7 });
  updateInput(none);
  assert.equal(none.mode, 'none');
  assert.deepEqual(analog(none), { pinch: 0, squeeze: 0 });
});

test('a tracked hand with a joint missing counts as not tracked', () => {
  const t = trackedHand();
  t.joints['thumb-tip'].visible = false;
  const hand = makeHand({ trackedHand: t });
  updateInput(hand);
  assert.equal(hand.mode, 'none');
});
