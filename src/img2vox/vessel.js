import { VoxelObject } from '../voxel-object.js';

const LIQUID = [215, 225, 235]; // mercury

// y layers that belong to the body of the vessel: where it is at least 70 % as wide as at its widest (the neck is
// narrower; the base layer is excluded).
export function bodyLayers(shell) {
  const [sx, sy, sz] = shell.size;
  const width = [];
  for (let y = 1; y < sy; y++) {
    let minX = sx;
    let maxX = -1;
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) {
        if (!shell.get(x, y, z)) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    width.push(maxX >= minX ? maxX - minX + 1 : 0); // extent, not count: the shell is hollow
  }
  const widest = Math.max(0, ...width);
  const layers = [];
  width.forEach((w, i) => { if (w >= 0.7 * widest && w > 0) layers.push(i + 1); });
  return layers;
}

// Glass is the bluish part of the shell (blue wins over red), the rest (bronze collar, base ring) is metal.
const isGlass = (c) => c[2] > c[0] + 15 && c[2] >= c[1];

// The shell split by material: { metal, glass }, two VoxelObjects of the same size and palette.
export function splitGlass(shell) {
  const metal = new VoxelObject(shell.size, new Uint8Array(shell.data.length), shell.palette);
  const glass = new VoxelObject(shell.size, new Uint8Array(shell.data.length), shell.palette);
  shell.data.forEach((index, i) => {
    if (!index) return;
    (isGlass(shell.palette[index]) ? glass : metal).data[i] = index;
  });
  return { metal, glass };
}

// How many layers the liquid can fill: up to the top of the body (the neck stays empty).
export function fillLayers(shell) {
  return Math.max(0, ...bodyLayers(shell));
}

// The liquid inside the shell, filled from the bottom: `fraction` (0..1) of the layers from the base up to the
// top of the body. A voxel is inside when there is a wall to its left, right, front and back on its layer. The
// result has its own palette: index 1 is the liquid.
export function liquidModel(shell, fraction) {
  const [sx, sy, sz] = shell.size;
  const liquid = new VoxelObject(shell.size, new Uint8Array(shell.data.length), [[0, 0, 0], LIQUID]);
  const top = fillLayers(shell);
  const lit = Math.round(Math.min(1, Math.max(0, fraction)) * top);
  const wallBeside = (x, y, z, dx, dz) => {
    for (let k = 1; k < Math.max(sx, sz); k++) if (shell.get(x + dx * k, y, z + dz * k)) return true;
    return false;
  };
  for (let y = 1; y <= Math.min(lit, sy - 1); y++) {
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) {
        if (shell.get(x, y, z)) continue;
        if (wallBeside(x, y, z, 1, 0) && wallBeside(x, y, z, -1, 0) && wallBeside(x, y, z, 0, 1) && wallBeside(x, y, z, 0, -1)) liquid.set(x, y, z, 1);
      }
    }
  }
  return liquid;
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
