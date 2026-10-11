import * as THREE from 'three';
import { HANDTOOLS as H } from './config/index.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const solid = (color) => new THREE.MeshBasicMaterial({ color });
const box = (x, y, z, color) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), solid(color));

// stretches a unit-length bar (along Z) between two points
function stretch(mesh, a, b) {
  mesh.scale.z = Math.max(a.distanceTo(b), 1e-4);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Z_AXIS, b.clone().sub(a).normalize());
}

// What a controller carries: the tongs with rubber pads (jaws close with the trigger, never through the thing they
// hold) and the long spoon (shows its load). Attached to the controller's grip; -Z is forward.
export function createHandToolRig() {
  const group = new THREE.Group();
  const baseY = 0.012;
  const base = [new THREE.Vector3(0, baseY, -0.03), new THREE.Vector3(0, -baseY, -0.03)];
  const tip = [new THREE.Vector3(), new THREE.Vector3()];

  const tongs = new THREE.Group();
  const arms = [box(0.008, 0.008, 1, H.tongs.color), box(0.008, 0.008, 1, H.tongs.color)];
  const pads = [box(0.014, 0.014, 0.03, H.tongs.rubber), box(0.014, 0.014, 0.03, H.tongs.rubber)];
  tongs.add(...arms, ...pads);

  const spoon = new THREE.Group();
  const stem = box(0.006, 0.006, H.spoon.tipZ - 0.02, H.spoon.color);
  stem.position.z = -(0.02 + (H.spoon.tipZ - 0.02) / 2);
  const bowl = box(0.034, 0.006, 0.034, H.spoon.color);
  bowl.position.set(0, 0, -H.spoon.tipZ);
  const load = box(0.026, 0.012, 0.026, H.spoon.load);
  load.position.set(0, 0.008, -H.spoon.tipZ);
  spoon.add(stem, bowl, load);

  group.add(tongs, spoon);
  const tools = { tongs, spoon };
  let current = 'tongs';

  // `id` is a hand tool, or null for an empty hand
  function setTool(id) {
    current = id;
    for (const [name, g] of Object.entries(tools)) g.visible = name === id;
  }
  setTool('tongs');

  // trigger 0..1; `loaded`: the spoon holds sulfur; `holdWidth`: the tongs hold something this wide (m)
  function update(trigger, { loaded = false, holdWidth = 0 } = {}) {
    if (current === 'tongs') {
      const gap = Math.max(holdWidth, H.tongs.open * (1 - trigger));
      for (const [i, side] of [1, -1].entries()) {
        tip[i].set(0, (side * gap) / 2, -H.tongs.tipZ);
        stretch(arms[i], base[i], tip[i]);
        pads[i].position.copy(tip[i]);
      }
    } else if (current === 'spoon') {
      load.visible = loaded;
    }
  }
  update(0);
  return { group, setTool, update, get tool() { return current; } };
}
