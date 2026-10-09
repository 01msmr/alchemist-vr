import * as THREE from 'three';

// Interaction points in the grip space (-Z is forward out of the controller). Both are unverified for
// Quest controllers: if the fingertips sit off the real controller, tune them.
export const TIP_Z = 0.08; // pinch point, where thumb and index fingertip meet
export const PALM_Z = 0.02; // center of the closed hand

const PAD_IDLE = new THREE.Color(0xf0c8a8);
const PAD_ACTIVE = new THREE.Color(0xe53935);
const BONE = 0.012;
const PAD = 0.016;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const skin = new THREE.MeshBasicMaterial({ color: 0xe0b08c });
const box = (x, y, z, material = skin) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material);

// Stretches a unit-length bone (along Z) between two points, in the parent's space.
function setBone(mesh, a, b) {
  mesh.scale.z = Math.max(a.distanceTo(b), 1e-4);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Z_AXIS, b.clone().sub(a).normalize());
}
const bone = (thickness) => new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, 1), skin);

// Thumb and index finger only, attached to the controller (grip space): they close toward the pinch
// point as the trigger is pressed. Nothing else of the hand is drawn.
const TIP = new THREE.Vector3(0, 0, -TIP_Z);
const INDEX_BASE = new THREE.Vector3(0, -0.012, -0.03);
const INDEX_OPEN = new THREE.Vector3(0, -0.02, -0.11);
const THUMB_BASE = new THREE.Vector3(0, 0.018, -0.01);
const THUMB_OPEN = new THREE.Vector3(0, 0.05, -0.07);

export function createPincer() {
  const group = new THREE.Group();
  const padMaterial = new THREE.MeshBasicMaterial({ color: PAD_IDLE });
  const indexBone = bone(BONE);
  const thumbBone = bone(BONE * 1.2);
  const indexPad = box(PAD, PAD, PAD, padMaterial);
  const thumbPad = box(PAD, PAD, PAD, padMaterial);
  group.add(indexBone, thumbBone, indexPad, thumbPad);
  const indexTip = new THREE.Vector3();
  const thumbTip = new THREE.Vector3();

  function update(pinch) {
    indexTip.lerpVectors(INDEX_OPEN, TIP, pinch);
    thumbTip.lerpVectors(THUMB_OPEN, TIP, pinch);
    setBone(indexBone, INDEX_BASE, indexTip);
    setBone(thumbBone, THUMB_BASE, thumbTip);
    indexPad.position.copy(indexTip);
    thumbPad.position.copy(thumbTip);
    padMaterial.color.copy(PAD_IDLE).lerp(PAD_ACTIVE, pinch);
  }
  update(0);
  return { group, update, indexTip, thumbTip };
}

// The hands holding the vial are drawn from the vial and from where the hand is, not from the
// controller's orientation, so they always wrap the right way round. Both live in world-local space.
const AXIS = new THREE.Vector3();
const U = new THREE.Vector3();
const B = new THREE.Vector3();
const D = new THREE.Vector3();
const BASIS = new THREE.Matrix4();

// Fist around the vial: palm on the side of the hand, fingers wrapping across the front.
// place(center, axis, handPos): center = where the hand grips on the vial's axis.
export function createFistWrap() {
  const group = new THREE.Group();
  const palm = box(0.07, 0.05, 0.012);
  palm.position.set(0, 0, 0.034);
  group.add(palm);
  for (const sx of [-1, 1]) {
    const side = box(0.012, 0.05, 0.068);
    side.position.set(sx * 0.034, 0, 0);
    group.add(side);
  }
  for (let i = 0; i < 4; i++) { // index .. little finger
    const finger = box(0.056, 0.011, 0.012);
    finger.position.set(0, (i - 1.5) * 0.0115, -0.034);
    group.add(finger);
  }
  const thumb = box(0.03, 0.012, 0.012);
  thumb.position.set(0, 0.032, -0.034);
  group.add(thumb);
  group.visible = false;

  function place(center, axis, handPos) {
    AXIS.copy(axis).normalize();
    D.subVectors(handPos, center);
    B.copy(D).addScaledVector(AXIS, -D.dot(AXIS)); // toward the hand, across the vial
    if (B.lengthSq() < 1e-8) B.set(0, 0, 1).addScaledVector(AXIS, -AXIS.z);
    B.normalize();
    U.crossVectors(AXIS, B).normalize();
    group.position.copy(center);
    group.quaternion.setFromRotationMatrix(BASIS.makeBasis(U, AXIS, B));
  }
  return { group, place, palm };
}

// Two fingertips pinching the vial from opposite sides, with the fingers coming from the hand.
export function createPinchGrip() {
  const group = new THREE.Group();
  const padMaterial = new THREE.MeshBasicMaterial({ color: PAD_ACTIVE });
  const boneA = bone(BONE);
  const boneB = bone(BONE * 1.2);
  const padA = box(PAD, PAD, PAD, padMaterial);
  const padB = box(PAD, PAD, PAD, padMaterial);
  group.add(boneA, boneB, padA, padB);
  group.visible = false;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const baseA = new THREE.Vector3();
  const baseB = new THREE.Vector3();

  function place(anchor, axis, handPos) {
    D.subVectors(handPos, anchor);
    U.crossVectors(axis, D);
    if (U.lengthSq() < 1e-10) U.set(1, 0, 0);
    U.normalize();
    a.copy(anchor).addScaledVector(U, 0.0285);
    b.copy(anchor).addScaledVector(U, -0.0285);
    baseA.copy(handPos).addScaledVector(U, 0.012);
    baseB.copy(handPos).addScaledVector(U, -0.012);
    setBone(boneA, baseA, a);
    setBone(boneB, baseB, b);
    padA.position.copy(a);
    padB.position.copy(b);
  }
  return { group, place, padA, padB };
}
