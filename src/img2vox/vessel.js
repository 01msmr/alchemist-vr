import { VoxelObject } from '../voxel-object.js';

const LIQUID = [215, 225, 235]; // mercury
const EMPTY_GLASS = [60, 80, 90];

// y layers that belong to the body of the vessel: where it is at least 7 voxels wide,
// which is where there is room for a liquid window. Lowest layer first, the base layer excluded.
export function bodyLayers(shell) {
  const [sx, sy, sz] = shell.size;
  const cz = (sz - 1) / 2;
  const layers = [];
  for (let y = 1; y < sy; y++) {
    let minX = sx;
    let maxX = -1;
    for (let x = 0; x < sx; x++) {
      if (!shell.get(x, y, cz)) continue;
      minX = Math.min(minX, x);
      maxX = x;
    }
    if (maxX - minX + 1 >= 7) layers.push(y); // extent, not count: the shell is hollow
  }
  return layers;
}

// The shell with a 3 voxel wide window down its front where the liquid shows. `fraction` of the window
// (0..1) is filled from the bottom with liquid, the rest shows empty glass. Returns a new VoxelObject.
export function vesselModel(shell, fraction) {
  const [sx, , sz] = shell.size;
  const cx = (sx - 1) / 2;
  const liquid = shell.palette.length;
  const empty = shell.palette.length + 1;
  const model = new VoxelObject(shell.size, Uint8Array.from(shell.data), [...shell.palette, LIQUID, EMPTY_GLASS]);
  const layers = bodyLayers(shell);
  const lit = Math.round(Math.min(1, Math.max(0, fraction)) * layers.length);
  layers.forEach((y, i) => {
    for (let x = cx - 1; x <= cx + 1; x++) {
      let z = sz - 1;
      while (z >= 0 && !model.get(x, y, z)) z--;
      if (z >= 0) model.set(x, y, z, i < lit ? liquid : empty);
    }
  });
  return model;
}

// Collision box, grab size and axis of a tool from its voxel model (origin at the bottom center).
export function toolSpecFromModel(obj, voxelSize) {
  const half = { x: (obj.size[0] * voxelSize) / 2, y: (obj.size[1] * voxelSize) / 2, z: (obj.size[2] * voxelSize) / 2 };
  return {
    half,
    axisHalf: half.y,
    radius: Math.min(half.x, half.z),
    grabRadius: Math.max(0.03, Math.min(half.x, half.z) + 0.01),
  };
}
