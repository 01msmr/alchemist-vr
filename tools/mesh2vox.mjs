#!/usr/bin/env node
// Turns a 3D model (.obj with .mtl, or .glb) into a voxel model (.vox) in game size.
//   node tools/mesh2vox.mjs <model.obj|model.glb> <out.vox> --height 16 [--colors 24] [--hollow] [--up y|z] [--preview preview.png]
// --height: the model's height in voxels (1 voxel = LAYOUT.voxel = 0.75 cm in the game: a 12 cm tall object is 16 voxels); the width and depth follow its proportions.
// --colors: palette size (default 24). --hollow: only the one voxel thick surface (bottles, vases), else solid.
// --up z: the model is Z-up (Rhino and CAD exports often are). Textures: PNG only; others fall back to the material color.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { voxelize } from '../src/mesh2vox/voxelize.js';
import { parseObj, parseMtl } from '../src/mesh2vox/obj.js';
import { parseGlb } from '../src/mesh2vox/glb.js';
import { writeVox } from '../src/img2vox/voxwrite.js';
import { writePreview } from './preview.mjs';

const USAGE = 'usage: node tools/mesh2vox.mjs <model.obj|model.glb> <out.vox> --height 16 [--colors 24] [--hollow] [--up y|z] [--preview preview.png]';
const args = process.argv.slice(2);
const flags = new Set(['--hollow']);
const positional = args.filter((a, i) => !a.startsWith('--') && (i === 0 || flags.has(args[i - 1]) || !args[i - 1].startsWith('--')));
const [input, output] = positional;
const has = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!input || !output || !option('height', null)) fail(USAGE);
const height = Number(option('height'));
if (!(height >= 1)) fail(`--height must be a number of voxels, got ${option('height')}`);
const up = option('up', 'y');
if (up !== 'y' && up !== 'z') fail('--up is y or z');

const warned = new Set();
const warn = (message) => {
  if (!warned.has(message)) {
    warned.add(message);
    console.error(`warning: ${message}`);
  }
};
const pngTexture = (bytes) => {
  const png = PNG.sync.read(Buffer.from(bytes));
  return { width: png.width, height: png.height, data: png.data };
};

let triangles;
try {
  const extension = path.extname(input).toLowerCase();
  if (extension === '.obj') {
    const dir = path.dirname(input);
    const text = fs.readFileSync(input, 'utf8');
    const mtlFile = text.match(/^mtllib\s+(.+)$/m)?.[1].trim();
    const mtlPath = mtlFile ? path.join(dir, mtlFile) : null;
    const materials = mtlPath && fs.existsSync(mtlPath) ? parseMtl(fs.readFileSync(mtlPath, 'utf8')) : {};
    if (mtlFile && !mtlPath) warn(`material file ${mtlFile} not found, using grey`);
    const textures = new Map();
    triangles = parseObj(text, materials, (file) => {
      if (!textures.has(file)) {
        const full = path.join(dir, file);
        let texture = null;
        if (!file.toLowerCase().endsWith('.png')) warn(`texture ${file} is not a PNG, using the material color`);
        else if (!fs.existsSync(full)) warn(`texture ${file} not found, using the material color`);
        else texture = pngTexture(fs.readFileSync(full));
        textures.set(file, texture);
      }
      return textures.get(file);
    });
  } else if (extension === '.glb') {
    const file = fs.readFileSync(input);
    triangles = parseGlb(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), {
      decodeImage: (bytes, mime) => {
        if (mime === 'image/png') return pngTexture(bytes);
        warn(`a ${mime} texture is not supported (PNG only), using the material color`);
        return null;
      },
    });
  } else {
    fail(`${input}: this tool reads .obj or .glb files (convert others to one of these first)`);
  }
} catch (e) {
  fail(e.code === 'ENOENT' ? `${input}: file not found` : `${input}: ${e.message}`);
}

let obj;
try {
  obj = voxelize(triangles, { height, colors: Number(option('colors', 24)), hollow: has('hollow'), up });
} catch (e) {
  fail(`${input}: ${e.message}`);
}
fs.writeFileSync(output, Buffer.from(writeVox(obj)));
const count = obj.data.filter(Boolean).length;
console.log(`${output}: ${obj.size.join(' x ')} voxels, ${count} filled, ${obj.palette.length - 1} colors, from ${triangles.length} triangles`);
if (option('preview', null)) writePreview(obj, option('preview'));
