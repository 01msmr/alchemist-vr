import fs from 'node:fs';
import { PNG } from 'pngjs';

// A front view of a voxel model as a PNG, 40 px per voxel, for a quick look: the voxel nearest to the viewer on every column.
export function writePreview(obj, path) {
  const scale = 40;
  const [sx, sy, sz] = obj.size;
  const out = new PNG({ width: sx * scale, height: sy * scale });
  for (let y = 0; y < sy; y++) {
    for (let x = 0; x < sx; x++) {
      let index = 0;
      for (let z = sz - 1; z >= 0 && !index; z--) index = obj.get(x, y, z);
      const color = index ? obj.palette[index] : [40, 44, 48];
      for (let py = 0; py < scale; py++) {
        for (let px = 0; px < scale; px++) {
          out.data.set([...color, 255], (((sy - 1 - y) * scale + py) * out.width + x * scale + px) * 4);
        }
      }
    }
  }
  fs.writeFileSync(path, PNG.sync.write(out));
}
