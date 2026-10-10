import { VoxelObject } from './voxel-object.js';

// Breaks a voxel model into three or four pieces, for a broken vessel: two diagonal cuts (neither is horizontal or
// vertical: both planes lean) make up to four jagged pieces. Every voxel lands in exactly one piece.
// Returns [{ obj, center, half }]: `obj` has the size and palette of the original (so it meshes at the same place),
// `center` is the piece's middle and `half` its half extent as a physics box, both in meters in the model's frame
// (x, z centered, y up from the bottom, like the mesher).
const CUT_SLOPE = 0.9; // layers of rise of the first cut per voxel to the right (about 42 degrees)
const SIDE_ANGLE = 0.6; // rad: the second cut is turned off the x axis ...
const SIDE_TILT = 0.5; // ... and leans: per layer above the middle it moves this many voxels
const MIN_HALF = 0.005; // m: no piece is thinner than a physics body can be

export function splitShards(model, voxelSize) {
  const [sx, sy, sz] = model.size;
  const cos = Math.cos(SIDE_ANGLE);
  const sin = Math.sin(SIDE_ANGLE);
  const parts = [0, 1, 2, 3].map(() => ({ obj: new VoxelObject(model.size, new Uint8Array(model.data.length), model.palette), n: 0, sum: [0, 0, 0], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const index = model.get(x, y, z);
        if (!index) continue;
        const dx = x + 0.5 - sx / 2;
        const dz = z + 0.5 - sz / 2;
        const side = dx * cos + dz * sin + (y + 0.5 - sy / 2) * SIDE_TILT >= 0 ? 1 : 0;
        const band = y + 0.5 >= sy / 2 + dx * CUT_SLOPE ? 1 : 0;
        const part = parts[side + 2 * band];
        part.obj.set(x, y, z, index);
        part.n++;
        const at = [dx, y + 0.5, dz];
        for (let a = 0; a < 3; a++) {
          part.sum[a] += at[a];
          part.min[a] = Math.min(part.min[a], at[a] - 0.5);
          part.max[a] = Math.max(part.max[a], at[a] + 0.5);
        }
      }
    }
  }
  return parts.filter((p) => p.n > 0).map((p) => ({
    obj: p.obj,
    center: { x: (p.sum[0] / p.n) * voxelSize, y: (p.sum[1] / p.n) * voxelSize, z: (p.sum[2] / p.n) * voxelSize },
    half: {
      x: Math.max(MIN_HALF, ((p.max[0] - p.min[0]) / 2) * voxelSize),
      y: Math.max(MIN_HALF, ((p.max[1] - p.min[1]) / 2) * voxelSize),
      z: Math.max(MIN_HALF, ((p.max[2] - p.min[2]) / 2) * voxelSize),
    },
  }));
}
