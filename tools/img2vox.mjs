#!/usr/bin/env node
// Turns a cut-out PNG (transparent background) of a round object into a voxel shell (.vox).
//   node tools/img2vox.mjs <in.png> <out.vox> [--height 13] [--colors 8] [--crop-top 0.155] [--stretch 1.2] [--preview preview.png]
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { latheShell } from '../src/img2vox/lathe.js';
import { writeVox } from '../src/img2vox/voxwrite.js';

const args = process.argv.slice(2);
const [input, output] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
if (!input || !output) {
  console.error('usage: node tools/img2vox.mjs <in.png> <out.vox> [--height 13] [--colors 8] [--crop-top 0.155] [--stretch 1.2] [--preview preview.png]');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(input));
const { obj } = latheShell(
  { width: png.width, height: png.height, data: png.data },
  { height: Number(option('height', 13)), colors: Number(option('colors', 8)), cropTop: Number(option('crop-top', 0)), stretch: Number(option('stretch', 1)) },
);
fs.writeFileSync(output, Buffer.from(writeVox(obj)));
const count = obj.data.filter(Boolean).length;
console.log(`${output}: ${obj.size.join(' x ')} voxels, ${count} filled, ${obj.palette.length - 1} colors`);

const previewPath = option('preview', null);
if (previewPath) {
  // front view, 40 px per voxel, for a quick look: nearest voxel to the viewer on every column
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
  fs.writeFileSync(previewPath, PNG.sync.write(out));
}
