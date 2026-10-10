import * as THREE from 'three';
import { INPUT } from './config/index.js';
import { clamp01 } from './util.js';

// Recognition of a tracked hand (WebXR hand-tracking joints) in the same terms the game uses for a controller:
// a grip frame (origin at the palm, -Z along the fingers, +Y toward the thumb side), a pinch point, a grasp point
// and two strengths 0..1 (pinch = thumb and index fingertip, grip = the other three fingers). Joints are plain
// { x, y, z } positions keyed by the WebXR joint name. All distances are meters and unverified on a real Quest.
// The thresholds are in config/input.js (INPUT.hand).
const { pinch: PINCH, gripCurl: GRIP_CURL, graspOffset: GRASP_OFFSET, holdMargin } = INPUT.hand;

const vec = (p) => new THREE.Vector3(p.x, p.y, p.z);
const strength = (distance, { open, closed }) => clamp01((open - distance) / (open - closed));

// Between the wrist and the middle finger's knuckle.
export function palmPoint(j) {
  return vec(j.wrist).lerp(vec(j['middle-finger-phalanx-proximal']), 0.5);
}

// The grip frame as a matrix. It is built from bones that do not move relative to each other (the wrist,
// the knuckle of the middle finger and the bases of index and little finger), so it stays steady while the
// fingers open and close.
export function handFrame(j) {
  const forward = vec(j['middle-finger-phalanx-proximal']).sub(vec(j.wrist)).normalize();
  const across = vec(j['index-finger-metacarpal']).sub(vec(j['pinky-finger-metacarpal'])); // toward the thumb side
  const y = across.addScaledVector(forward, -across.dot(forward)).normalize();
  const z = forward.clone().negate();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(palmPoint(j));
}

// Where thumb and index fingertip meet.
export function pinchPoint(j) {
  return vec(j['thumb-tip']).lerp(vec(j['index-finger-tip']), 0.5);
}

export function pinchStrength(j) {
  return strength(vec(j['thumb-tip']).distanceTo(vec(j['index-finger-tip'])), PINCH);
}

// How far the middle, ring and little finger are curled toward the palm.
export function gripStrength(j) {
  const palm = palmPoint(j);
  const names = ['middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'];
  return names.reduce((sum, name) => sum + strength(vec(j[name]).distanceTo(palm), GRIP_CURL), 0) / names.length;
}

// +1 where a right hand's palm is not (its palm faces the frame's -x side when the thumb is up and the fingers
// point forward), so a hand holds things on the side its palm faces.
const palmSide = (handedness) => (handedness === 'right' ? -1 : 1);

// The point a fist closes around: in front of the palm, on the palm side.
export function graspPoint(j, handedness) {
  const frame = handFrame(j);
  const x = new THREE.Vector3().setFromMatrixColumn(frame, 0);
  return palmPoint(j).addScaledVector(x, palmSide(handedness) * GRASP_OFFSET);
}

// Where a tool's center sits in the grip frame when held in a fist. A controller's handle is in the palm; a
// tracked hand wraps around the tool, so the tool sits its radius (plus a little) in front of the palm.
export function holdOffset(mode, handedness, radius) {
  if (mode === 'tracked') return { x: palmSide(handedness) * (radius + holdMargin), y: 0, z: 0 };
  return { x: 0, y: 0, z: -INPUT.controller.palmZ };
}

// Which input a hand uses this frame: a tracked hand is the main input, a controller with a pose the fallback.
export function chooseMode({ trackedVisible, gamepad, controllerVisible }) {
  if (trackedVisible) return 'tracked';
  if (gamepad && controllerVisible) return 'controller';
  return 'none';
}
