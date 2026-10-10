import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  palmPoint, handFrame, pinchPoint, pinchStrength, gripStrength, graspPoint, holdOffset, chooseMode,
} from '../src/tracking.js';
import { INPUT } from '../src/config/index.js';

const PINCH = INPUT.hand.pinch;
const GRIP_CURL = INPUT.hand.gripCurl;

// A synthetic right hand in the grip convention: fingers along -z, thumb side +y, palm facing -x.
// Joint positions are given as plain {x, y, z}.
const v = (x, y, z) => ({ x, y, z });
function hand({ pinchGap = 0.1, curl = 0, at = v(0, 0, 0) } = {}) {
  // curl 0 = open, 1 = fist: the fingertips move from far in front of the palm to close to it
  const tipZ = -0.17 + 0.12 * curl; // middle fingertip z (palm center is at z = -0.045)
  const tipX = -0.02 * curl; // toward the palm side
  const j = {
    wrist: v(0, 0, 0),
    'index-finger-metacarpal': v(0, 0.03, -0.02),
    'pinky-finger-metacarpal': v(0, -0.03, -0.02),
    'middle-finger-phalanx-proximal': v(0, 0, -0.09),
    'thumb-metacarpal': v(0, 0.035, -0.015),
    'index-finger-tip': v(-0.02, 0.0, -0.1 - 0.1 * (1 - curl)),
    'thumb-tip': v(-0.02, pinchGap, -0.1 - 0.1 * (1 - curl)),
    'middle-finger-tip': v(tipX, 0, tipZ),
    'ring-finger-tip': v(tipX, -0.02, tipZ),
    'pinky-finger-tip': v(tipX, -0.04, tipZ),
  };
  for (const key of Object.keys(j)) {
    j[key] = v(j[key].x + at.x, j[key].y + at.y, j[key].z + at.z);
  }
  return j;
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('palm point lies between the wrist and the middle knuckle', () => {
  const p = palmPoint(hand());
  assert.ok(near(p.z, -0.045) && near(p.x, 0) && near(p.y, 0));
});

test('the hand frame follows the grip convention: -Z along the fingers, +Y toward the thumb side', () => {
  const m = handFrame(hand());
  const axis = (x, y, z) => new THREE.Vector3(x, y, z).transformDirection(m);
  assert.ok(axis(0, 0, -1).distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9, 'forward = along the fingers');
  assert.ok(axis(0, 1, 0).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9, 'up = thumb side');
  assert.ok(near(new THREE.Vector3().setFromMatrixPosition(m).z, -0.045), 'origin at the palm');
  // orthonormal and right handed
  assert.ok(near(m.determinant(), 1));
});

test('the hand frame turns with the hand and keeps its meaning', () => {
  const rot = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const j = hand();
  for (const key of Object.keys(j)) {
    const p = new THREE.Vector3(j[key].x, j[key].y, j[key].z).applyMatrix4(rot);
    j[key] = v(p.x, p.y, p.z);
  }
  const m = handFrame(j);
  const forward = new THREE.Vector3(0, 0, -1).transformDirection(m);
  assert.ok(forward.distanceTo(new THREE.Vector3(-1, 0, 0)) < 1e-9, 'fingers now point along -x');
  assert.ok(new THREE.Vector3(0, 1, 0).transformDirection(m).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9);
});

test('the pinch point is halfway between thumb tip and index fingertip', () => {
  const p = pinchPoint(hand({ pinchGap: 0.04 }));
  assert.ok(near(p.y, 0.02) && near(p.x, -0.02));
});

test('pinch strength: open hand 0, touching fingertips 1, in between proportional', () => {
  assert.equal(pinchStrength(hand({ pinchGap: 0.12 })), 0);
  assert.equal(pinchStrength(hand({ pinchGap: PINCH.closed })), 1);
  assert.equal(pinchStrength(hand({ pinchGap: 0.005 })), 1, 'closer than touching is still 1');
  const half = pinchStrength(hand({ pinchGap: (PINCH.open + PINCH.closed) / 2 }));
  assert.ok(near(half, 0.5, 1e-9));
  assert.ok(pinchStrength(hand({ pinchGap: 0.03 })) > pinchStrength(hand({ pinchGap: 0.05 })));
});

test('grip strength: open hand 0, fist 1, a half-closed hand in between', () => {
  assert.equal(gripStrength(hand({ curl: 0 })), 0);
  assert.equal(gripStrength(hand({ curl: 1 })), 1);
  const half = gripStrength(hand({ curl: 0.5 }));
  assert.ok(half > 0.2 && half < 0.9, `half closed hand: ${half}`);
  assert.ok(GRIP_CURL.open > GRIP_CURL.closed);
});

test('strengths do not depend on where the hand is', () => {
  const far = { x: 3, y: 1.2, z: -4 };
  assert.ok(near(pinchStrength(hand({ pinchGap: 0.03, at: far })), pinchStrength(hand({ pinchGap: 0.03 })), 1e-9));
  assert.ok(near(gripStrength(hand({ curl: 0.7, at: far })), gripStrength(hand({ curl: 0.7 })), 1e-9));
});

test('the grasp point is in front of the palm, on the palm side, per handedness', () => {
  const right = graspPoint(hand(), 'right');
  const left = graspPoint(hand(), 'left');
  assert.ok(right.x < palmPoint(hand()).x - 0.02, 'a right hand holds things on its -x side in this frame');
  assert.ok(left.x > palmPoint(hand()).x + 0.02, 'a left hand holds on the other side');
  assert.ok(near(right.x, -left.x, 1e-9));
});

test('a tool is held in the fist at its radius in front of the palm, per handedness', () => {
  assert.deepEqual(holdOffset('controller', 'right', 0.025), { x: 0, y: 0, z: -0.02 });
  const r = holdOffset('tracked', 'right', 0.025);
  const l = holdOffset('tracked', 'left', 0.025);
  assert.ok(r.x < 0 && l.x > 0 && near(r.x, -l.x) && r.y === 0 && r.z === 0);
  assert.ok(Math.abs(holdOffset('tracked', 'right', 0.05).x) > Math.abs(r.x), 'a thicker tool sits farther out');
});

test('input mode: tracked hand wins, then a controller with a pose, else none', () => {
  assert.equal(chooseMode({ trackedVisible: true, gamepad: true, controllerVisible: true }), 'tracked');
  assert.equal(chooseMode({ trackedVisible: false, gamepad: true, controllerVisible: true }), 'controller');
  assert.equal(chooseMode({ trackedVisible: false, gamepad: true, controllerVisible: false }), 'none');
  assert.equal(chooseMode({ trackedVisible: false, gamepad: false, controllerVisible: true }), 'none');
});
