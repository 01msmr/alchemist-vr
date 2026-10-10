import { VoxelObject } from '../voxel-object.js';
import { boundingBox, crop, resizeArea } from './image.js';
import { quantize } from './quantize.js';

// Revolves the silhouette of a picture (a transparent-background cut-out of a round object: bottle, vase,
// flask) into a hollow voxel shell with a 1 voxel wall, a closed bottom and an open top. The picture
// is projected onto the shell by column, so the front and back look the same.
// opts: { height (voxels), colors (palette size), cropTop (fraction of the height to cut off, e.g. a stopper),
//         stretch (makes it taller by this factor, the width stays: height x stretch rows) }
export function latheShell(img, { height, colors = 8, cropTop = 0, stretch = 1 }) {
  const box = boundingBox(img);
  box.minY += Math.round((box.maxY - box.minY + 1) * cropTop);
  const cut = crop(img, box);
  const scale = height / cut.height;
  const widthVox = Math.max(1, Math.round(cut.width * scale));
  const rows = Math.round(height * stretch);
  const small = resizeArea(cut, widthVox, rows);
  const rgba = (c, r) => small.data.subarray((r * widthVox + c) * 4, (r * widthVox + c) * 4 + 4);

  // opaque extent of every row, from the top (row 0) down
  const extents = [];
  for (let r = 0; r < rows; r++) {
    let minC = -1;
    let maxC = -1;
    for (let c = 0; c < widthVox; c++) {
      if (rgba(c, r)[3] >= 128) {
        if (minC < 0) minC = c;
        maxC = c;
      }
    }
    extents.push(minC < 0 ? null : { minC, maxC });
  }

  const widest = Math.max(...extents.filter(Boolean).map((e) => e.maxC - e.minC + 1));
  const n = widest % 2 === 1 ? widest : widest + 1; // odd: the axis sits on a voxel column
  const cx = (n - 1) / 2;
  const imgCenter = (widthVox - 1) / 2;
  const obj = VoxelObject.empty(n, rows, n, [[0, 0, 0]]);

  const samples = []; // [x, y, z, [r, g, b]]
  for (let y = 0; y < rows; y++) {
    const r = rows - 1 - y;
    const e = extents[r];
    if (!e) continue;
    const radius = (e.maxC - e.minC + 1) / 2;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const d = Math.hypot(x - cx, z - cx);
        if (d > radius) continue;
        const wall = y === 0 || d > radius - 1; // hollow inside, closed bottom
        if (!wall) continue;
        const c = Math.min(e.maxC, Math.max(e.minC, Math.round(imgCenter + (x - cx))));
        samples.push([x, y, z, [...rgba(c, r).subarray(0, 3)]]);
      }
    }
  }

  const { palette, map } = quantize(samples.map((s) => s[3]), colors);
  obj.palette = [[0, 0, 0], ...palette];
  samples.forEach(([x, y, z], i) => obj.set(x, y, z, map[i] + 1));
  return { obj };
}
