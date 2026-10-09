import * as THREE from 'three';

// Interaction points in the grip space (-Z is forward out of the controller). Both are unverified for
// Quest controllers: if the hand sits off the real controller, tune them.
export const TIP_Z = 0.08; // pinch point, where thumb and index fingertip meet
export const PALM_Z = 0.02; // center of the closed hand

const SKIN = new THREE.Color(0xe0b08c);
const PAD_IDLE = new THREE.Color(0xf0c8a8);
const PAD_ACTIVE = new THREE.Color(0xe53935);
const BONE = 0.012;
const PAD = 0.016;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// Fist around a held rod: the fingers curl about the hand's X axis, so the rod runs along X.
// Rotating the hand by 90 degrees about Z turns that rod axis to the grip's +Y (thumb side up).
const HOLD_ROTATION = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.PI / 2);
const NO_ROTATION = new THREE.Quaternion();

// Thumb sits on top (+y), index finger below (-y), like on a Touch controller. Both reach the pinch point.
const TIP = new THREE.Vector3(0, 0, -TIP_Z);
const INDEX_BASE = new THREE.Vector3(0, -0.012, -0.04);
const INDEX_OPEN = new THREE.Vector3(0, -0.02, -0.11);
const THUMB_BASE = new THREE.Vector3(0, 0.018, -0.005);
const THUMB_OPEN = new THREE.Vector3(0, 0.05, -0.07);
const KNUCKLES = new THREE.Vector3(0, -0.012, -0.04);

const skinMaterial = new THREE.MeshBasicMaterial({ color: SKIN });

function box(x, y, z) {
  return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), skinMaterial);
}

// Stretches a unit-length bone (along Z) between two points, in the parent's space.
function setBone(mesh, a, b) {
  mesh.scale.z = Math.max(a.distanceTo(b), 1e-4);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Z_AXIS, b.clone().sub(a).normalize());
}

// A blocky hand in grip space. update(pinch, squeeze): trigger 0..1 closes thumb and index finger,
// grip button 0..1 curls the other three fingers around the palm.
export function createHand() {
  const group = new THREE.Group();
  const padMaterial = new THREE.MeshBasicMaterial({ color: PAD_IDLE });

  const palm = box(0.07, 0.03, 0.06);
  palm.position.z = -0.01;
  group.add(palm);

  // middle, ring and little finger as one slab hinged at the knuckles
  const fingers = new THREE.Group();
  fingers.position.copy(KNUCKLES);
  const slab = box(0.05, 0.014, 0.05);
  slab.position.z = -0.025;
  fingers.add(slab);
  group.add(fingers);

  const indexBone = new THREE.Mesh(new THREE.BoxGeometry(BONE, BONE, 1), skinMaterial);
  const thumbBone = new THREE.Mesh(new THREE.BoxGeometry(BONE * 1.2, BONE * 1.2, 1), skinMaterial);
  const indexPad = new THREE.Mesh(new THREE.BoxGeometry(PAD, PAD, PAD), padMaterial);
  const thumbPad = new THREE.Mesh(new THREE.BoxGeometry(PAD, PAD, PAD), padMaterial);
  group.add(indexBone, thumbBone, indexPad, thumbPad);

  const indexTip = new THREE.Vector3();
  const thumbTip = new THREE.Vector3();

  function update(pinch, squeeze) {
    indexTip.lerpVectors(INDEX_OPEN, TIP, pinch);
    thumbTip.lerpVectors(THUMB_OPEN, TIP, pinch);
    setBone(indexBone, INDEX_BASE, indexTip);
    setBone(thumbBone, THUMB_BASE, thumbTip);
    indexPad.position.copy(indexTip);
    thumbPad.position.copy(thumbTip);
    padMaterial.color.copy(PAD_IDLE).lerp(PAD_ACTIVE, pinch);
    fingers.rotation.x = -squeeze * 1.6; // curl down and back toward the palm
  }
  update(0, 0);

  // 0 = neutral hand, 1 = fist wrapped around an object standing along the grip's +Y
  function setHold(t) {
    group.quaternion.slerpQuaternions(NO_ROTATION, HOLD_ROTATION, t);
  }

  return { group, update, setHold, indexTip, thumbTip, fingers };
}
