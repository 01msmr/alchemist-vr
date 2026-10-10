#!/usr/bin/env node
// Draws a round shell model made by img2vox (a bottle, a vase) again at another resolution, keeping its size, colors
// and palette. Used when the voxel size of the game changes (1 cm -> 0.75 cm: factor 1.3333333).
//   node tools/relathe-vox.mjs <in.vox> <out.vox> --factor 1.3333333 [--rows 21] [--preview preview.png]
// Not idempotent: every run scales again, so always start from the model at the old resolution.
import fs from 'node:fs';
import { parseVox } from '../src/vox.js';
import { relatheShell } from '../src/img2vox/relathe.js';
import { writeVox } from '../src/img2vox/voxwrite.js';
import { writePreview } from './preview.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const [input, output] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
if (!input || !output || !option('factor', null)) {
  console.error('usage: node tools/relathe-vox.mjs <in.vox> <out.vox> --factor 1.3333333 [--rows 21] [--preview preview.png]');
  process.exit(1);
}
const file = fs.readFileSync(input);
const shell = parseVox(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const factor = Number(option('factor'));
const result = relatheShell(shell, { factor, ...(option('rows', null) ? { rows: Number(option('rows')) } : {}) });
fs.writeFileSync(output, Buffer.from(writeVox(result)));
console.log(`${output}: ${shell.size.join(' x ')} -> ${result.size.join(' x ')} voxels, ${result.data.filter(Boolean).length} filled`);
if (option('preview', null)) writePreview(result, option('preview'));
