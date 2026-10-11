import * as THREE from 'three';
import { LAYOUT } from '../config/index.js';
import { toGeometry } from '../voxel-mesh.js';
import { createHandToolRig } from '../handtoolview.js';
import { HANDTOOLS } from '../config/index.js';

const BOARD = 0xb08a5a;
const WALL = 0x8a6a42;

// The shelf along the far edge: a board on two posts, thin walls between the compartments, the hand tools lying in
// their compartments (while no controller carries them) and the spare vials of the easy level.
export function createShelfView(view, bottleShell) {
  const S = LAYOUT.shelf;
  const half = LAYOUT.tableBounds.maxX - 0.02;
  const solid = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const box = (w, h, d, hex, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), solid(hex));
    mesh.position.set(x, y, z);
    view.world.add(mesh);
    return mesh;
  };
  box(2 * half, S.thickness, S.depth, BOARD, 0, S.y - S.thickness / 2, S.z);
  for (const side of [-1, 1]) box(S.post, S.y - S.thickness, S.post, WALL, side * (half - S.post / 2), (S.y - S.thickness) / 2, S.z);
  for (const x of S.dividers) box(0.006, 0.1, S.depth, WALL, x, S.y + 0.05, S.z);

  const rigs = S.slots.map((slot) => {
    const rig = createHandToolRig();
    rig.setTool(slot.id);
    rig.update(0);
    rig.group.rotation.y = -Math.PI / 2; // lying along x, the working end to the right
    rig.group.position.set(slot.x - HANDTOOLS[slot.id].tipZ / 2, S.y + 0.012, S.z);
    view.world.add(rig.group);
    return { id: slot.id, rig };
  });

  const spare = new THREE.Mesh(toGeometry(bottleShell, LAYOUT.voxel), view.material);
  spare.position.set(S.spare.x, S.y, S.z);
  spare.visible = false;
  view.world.add(spare);

  return {
    // inShelf: ids of the hand tools lying there; spares: number of spare vials left
    update(inShelf, spares) {
      for (const { id, rig } of rigs) rig.group.visible = inShelf.has(id);
      spare.visible = spares > 0;
    },
  };
}
