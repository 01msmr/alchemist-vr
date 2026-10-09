import { VoxelObject } from './voxel-object.js';

const FALLBACK_COLOR = [200, 200, 200];

// Parses a MagicaVoxel .vox file (first model only, no scene graph).
// MagicaVoxel is Z-up; the result is converted to Y-up: (x, y, z) -> (x, z, sizeY - 1 - y).
export function parseVox(buffer) {
  const view = new DataView(buffer);
  const tag = (o) => String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));

  if (tag(0) !== 'VOX ') throw new Error('not a .vox file');
  if (tag(8) !== 'MAIN') throw new Error('missing MAIN chunk');

  let size = null;
  let voxels = null;
  let rgba = null;

  let offset = 20 + view.getUint32(12, true); // skip MAIN content (normally 0)
  while (offset + 12 <= view.byteLength) {
    const id = tag(offset);
    const content = view.getUint32(offset + 4, true);
    const body = offset + 12;
    if (id === 'SIZE' && !size) {
      size = [view.getInt32(body, true), view.getInt32(body + 4, true), view.getInt32(body + 8, true)];
    } else if (id === 'XYZI' && !voxels) {
      const n = view.getUint32(body, true);
      voxels = new Uint8Array(buffer, body + 4, n * 4);
    } else if (id === 'RGBA') {
      rgba = new Uint8Array(buffer, body, 256 * 4);
    }
    offset = body + content + view.getUint32(offset + 8, true);
  }
  if (!size || !voxels) throw new Error('no model found');

  // File palette index i (1..255) is stored at rgba[i - 1].
  const palette = [FALLBACK_COLOR];
  for (let i = 1; i < 256; i++) {
    palette.push(rgba ? [rgba[(i - 1) * 4], rgba[(i - 1) * 4 + 1], rgba[(i - 1) * 4 + 2]] : FALLBACK_COLOR);
  }

  const [vx, vy, vz] = size;
  const obj = VoxelObject.empty(vx, vz, vy, palette);
  for (let k = 0; k < voxels.length; k += 4) {
    obj.set(voxels[k], voxels[k + 2], vy - 1 - voxels[k + 1], voxels[k + 3]);
  }
  return obj;
}
