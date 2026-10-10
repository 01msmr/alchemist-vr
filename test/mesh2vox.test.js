import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voxelize } from '../src/mesh2vox/voxelize.js';

// the 12 triangles of an axis-aligned box; `colors` has one [r, g, b] per face (+x -x +y -y +z -z)
function box(min, max, colors = Array(6).fill([200, 200, 200])) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const quad = (p, q, r, s, color) => [{ a: p, b: q, c: r, color }, { a: p, b: r, c: s, color }];
  return [
    ...quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], colors[0]),
    ...quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], colors[1]),
    ...quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], colors[2]),
    ...quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], colors[3]),
    ...quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], colors[4]),
    ...quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], colors[5]),
  ];
}
const filled = (o) => o.data.reduce((n, i) => n + (i ? 1 : 0), 0);

test('a box scaled to height 4 is 4 x 4 x 4 voxels, solid by default', () => {
  const o = voxelize(box([0, 0, 0], [1, 1, 1]), { height: 4 });
  assert.deepEqual(o.size, [4, 4, 4]);
  assert.equal(filled(o), 64);
});

test('hollow makes a one voxel thick shell', () => {
  const o = voxelize(box([0, 0, 0], [1, 1, 1]), { height: 4, hollow: true });
  assert.equal(filled(o), 64 - 8);
  assert.equal(o.get(1, 1, 1), 0);
  assert.equal(o.get(0, 1, 1) > 0, true);
});

test('height is the y extent; the other sides keep the proportions and are centered', () => {
  const o = voxelize(box([5, 10, -3], [6, 12, -2]), { height: 8 }); // 1 x 2 x 1
  assert.deepEqual(o.size, [4, 8, 4]);
  assert.equal(o.get(0, 0, 0) > 0 && o.get(3, 7, 3) > 0, true, 'the box fills the grid');
});

test('a model that does not fill its grid is centered in x and z and rests on y = 0', () => {
  // a 1 x 2 x 1.5 box at height 4 is 1 x 4 x 3 voxels... made odd on purpose: width 0.75 -> 1.5 voxels -> 2 cells
  const o = voxelize(box([0, 0, 0], [0.75, 2, 1]), { height: 4 });
  assert.equal(o.size[1], 4);
  for (let x = 0; x < o.size[0]; x++) assert.ok(o.get(x, 0, 0) > 0 || o.get(x, 0, 1) > 0 || o.get(x, 0, 2) > 0, `column ${x} is not empty`);
  assert.ok(o.get(0, 0, Math.floor(o.size[2] / 2)) > 0);
});

test('every voxel takes the color of the surface it belongs to, down to the palette', () => {
  const red = [255, 0, 0];
  const blue = [0, 0, 255];
  const o = voxelize(box([0, 0, 0], [1, 1, 1], [red, red, red, blue, red, red]), { height: 4, hollow: true, colors: 2 });
  assert.equal(o.palette.length, 3, 'index 0 is empty, then two colors');
  const colorAt = (x, y, z) => o.palette[o.get(x, y, z)];
  // cells on a shared edge mix both colors, the middle of a face does not (and the 2 palette colors are averages)
  assert.ok(colorAt(1, 0, 1)[2] > 150 && colorAt(1, 0, 1)[0] < 100, 'the bottom (-y) face is blue');
  assert.ok(colorAt(1, 3, 1)[0] > 200 && colorAt(1, 3, 1)[2] < 50, 'the top is red');
});

test('a color can vary over a triangle: colorAt gets the barycentric weights', () => {
  const triangles = [{ a: [0, 0, 0], b: [1, 0, 0], c: [0, 1, 0], colorAt: (wa, wb, wc) => [255 * wa, 0, 255 * wc] }];
  const o = voxelize(triangles, { height: 4, hollow: true, colors: 8 });
  const near = (x, y) => o.palette[o.get(x, y, 0)];
  assert.ok(near(0, 0)[0] > 100, 'near the first corner (a) it is red');
  assert.ok(near(0, 3)[2] > 100, 'near the third corner (c) it is blue');
});

test('a Z-up model is turned upright: up "z" makes z the height', () => {
  const o = voxelize(box([0, 0, 0], [1, 1, 2]), { height: 8, up: 'z' }); // 1 wide, 1 deep, 2 high
  assert.equal(o.size[1], 8);
  assert.equal(o.size[0], 4);
  assert.equal(o.size[2], 4);
});

test('an empty model or a flat one cannot be scaled to a height', () => {
  assert.throws(() => voxelize([], { height: 4 }), /no triangles/);
  assert.throws(() => voxelize([{ a: [0, 0, 0], b: [1, 0, 0], c: [0, 0, 1], color: [1, 1, 1] }], { height: 4 }), /flat/);
});

// ---- OBJ ----
import { parseObj, parseMtl } from '../src/mesh2vox/obj.js';

test('an OBJ quad becomes two triangles; faces may use v/vt/vn and negative indices', () => {
  const text = `v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nvt 0 0\nvn 0 0 1\nf 1/1/1 2/1/1 3/1/1 4/1/1\nf -4 -3 -2\n`;
  const triangles = parseObj(text);
  assert.equal(triangles.length, 3);
  assert.deepEqual(triangles[0].a, [0, 0, 0]);
  assert.deepEqual(triangles[1].c, [0, 1, 0]);
  assert.deepEqual(triangles[2].b, [1, 0, 0], 'negative: relative to the end of the vertices');
});

test('materials give the color of their faces (Kd, 0..1), the default is a light grey', () => {
  const materials = parseMtl('newmtl red\nKd 1 0 0\nnewmtl half\nKd 0.5 0.5 0.5\n');
  const text = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\nusemtl red\nf 1 2 3\nusemtl half\nf 1 2 3\nusemtl missing\nf 1 2 3\n';
  const triangles = parseObj(text, materials);
  assert.deepEqual(triangles.map((t) => t.color), [[200, 200, 200], [255, 0, 0], [128, 128, 128], [200, 200, 200]]);
});

test('an MTL names the texture of a material', () => {
  assert.equal(parseMtl('newmtl skin\nKd 1 1 1\nmap_Kd textures/skin.png\n').skin.map, 'textures/skin.png');
});

test('a texture colors a triangle by its UVs (v is up in OBJ, down in the image)', () => {
  // a 2 x 1 image: left pixel red, right pixel blue
  const texture = { width: 2, height: 1, data: Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 255]) };
  const materials = { skin: { color: [255, 255, 255], map: 'skin.png' } };
  const text = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nusemtl skin\nf 1/1 2/2 3/3\n';
  const [t] = parseObj(text, materials, (file) => (file === 'skin.png' ? texture : null));
  assert.deepEqual(t.colorAt(1, 0, 0), [255, 0, 0], 'at the first corner (u = 0): the left pixel');
  assert.deepEqual(t.colorAt(0, 1, 0), [0, 0, 255], 'at the second corner (u = 1): the right pixel');
});

// ---- GLB ----
import { parseGlb } from '../src/mesh2vox/glb.js';

// builds a binary glTF: json object + one binary buffer (Uint8Array)
function makeGlb(json, bin) {
  const pad = (bytes, fill) => {
    const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(fill);
    out.set(bytes);
    return out;
  };
  const jsonBytes = pad(new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, ...json, buffers: [{ byteLength: bin.length }] })), 0x20);
  const binBytes = pad(bin, 0);
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, jsonBytes.length).set(jsonBytes);
  view.setUint32(20 + jsonBytes.length, binBytes.length, true);
  view.setUint32(24 + jsonBytes.length, 0x004e4942, true);
  new Uint8Array(buffer, 28 + jsonBytes.length, binBytes.length).set(binBytes);
  return buffer;
}
const floats = (...v) => new Uint8Array(new Float32Array(v).buffer);
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

// one triangle (0,0,0) (1,0,0) (0,1,0), material and node as given
function triangleGlb({ material = {}, node = {}, extraAttributes = {}, extraViews = [], extraBytes = new Uint8Array(0), extraAccessors = [], images, textures } = {}) {
  const bin = concat(floats(0, 0, 0, 1, 0, 0, 0, 1, 0), extraBytes);
  return makeGlb({
    scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, ...node }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, ...extraAttributes }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: material }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, ...extraAccessors],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, ...extraViews],
    ...(images ? { images } : {}),
    ...(textures ? { textures } : {}),
  }, bin);
}

test('a GLB triangle: positions, and the base color factor as sRGB', () => {
  const [t] = parseGlb(triangleGlb({ material: { baseColorFactor: [1, 0, 0, 1] } }));
  assert.deepEqual([t.a, t.b, t.c], [[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
  assert.deepEqual(t.color, [255, 0, 0]);
  // linear 0.2159 is sRGB 128 (the sRGB of a linear grey is lighter than the number)
  assert.equal(parseGlb(triangleGlb({ material: { baseColorFactor: [0.2159, 0.2159, 0.2159, 1] } }))[0].color[0], 128);
  assert.deepEqual(parseGlb(triangleGlb())[0].color, [255, 255, 255], 'no material color: white');
});

test('a node transform moves the mesh (translation and scale, in glTF order)', () => {
  const [t] = parseGlb(triangleGlb({ node: { translation: [0, 5, 0], scale: [2, 2, 2] } }));
  assert.deepEqual(t.b, [2, 5, 0]);
  assert.deepEqual(t.c, [0, 7, 0]);
});

test('indexed meshes: a quad of 4 vertices and 6 uint16 indices is two triangles', () => {
  const positions = floats(0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0);
  const indices = new Uint8Array(new Uint16Array([0, 1, 2, 0, 2, 3]).buffer);
  const glb = makeGlb({
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: 'VEC3' }, { bufferView: 1, componentType: 5123, count: 6, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 48 }, { buffer: 0, byteOffset: 48, byteLength: 12 }],
  }, concat(positions, indices));
  const triangles = parseGlb(glb);
  assert.equal(triangles.length, 2);
  assert.deepEqual(triangles[1].c, [0, 1, 0]);
});

test('vertex colors are interpolated over the triangle', () => {
  const [t] = parseGlb(triangleGlb({
    extraBytes: floats(1, 0, 0, 0, 1, 0, 0, 0, 1),
    extraAttributes: { COLOR_0: 1 },
    extraAccessors: [{ bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' }],
    extraViews: [{ buffer: 0, byteOffset: 36, byteLength: 36 }],
  }));
  assert.deepEqual(t.colorAt(1, 0, 0), [255, 0, 0]);
  assert.deepEqual(t.colorAt(0, 0, 1), [0, 0, 255]);
});

test('a base color texture colors the triangle by its UVs', () => {
  const png = new Uint8Array([1, 2, 3]); // the decoder is injected, the bytes are only passed through
  const texture = { width: 2, height: 1, data: Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 255]) };
  let decoded = null;
  const [t] = parseGlb(triangleGlb({
    material: { baseColorTexture: { index: 0 } },
    textures: [{ source: 0 }],
    images: [{ bufferView: 2, mimeType: 'image/png' }],
    extraBytes: concat(floats(0, 0, 1, 0, 0, 1), png),
    extraAttributes: { TEXCOORD_0: 1 },
    extraAccessors: [{ bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' }],
    extraViews: [{ buffer: 0, byteOffset: 36, byteLength: 24 }, { buffer: 0, byteOffset: 60, byteLength: 3 }],
  }), { decodeImage: (bytes, mime) => { decoded = [Array.from(bytes), mime]; return texture; } });
  assert.deepEqual(decoded, [[1, 2, 3], 'image/png']);
  assert.deepEqual(t.colorAt(1, 0, 0), [255, 0, 0]);
  assert.deepEqual(t.colorAt(0, 1, 0), [0, 0, 255]);
});

test('anything but a binary glTF is refused', () => {
  assert.throws(() => parseGlb(new ArrayBuffer(40)), /not a binary glTF/);
});

// ---- the command line ----
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVox } from '../src/vox.js';

const tool = fileURLToPath(new URL('../tools/mesh2vox.mjs', import.meta.url));
const run = (...args) => spawnSync('node', [tool, ...args], { encoding: 'utf8' });
const readVox = (path) => {
  const file = readFileSync(path);
  return parseVox(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
};

test('mesh2vox turns an OBJ cube with a material into a .vox of the asked size', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mesh2vox-'));
  const cube = box([0, 0, 0], [1, 1, 1]);
  const vertices = [];
  const faces = [];
  for (const t of cube) {
    const base = vertices.length;
    vertices.push(t.a, t.b, t.c);
    faces.push(`f ${base + 1} ${base + 2} ${base + 3}`);
  }
  writeFileSync(join(dir, 'cube.obj'), `mtllib cube.mtl\nusemtl gold\n${vertices.map((v) => `v ${v.join(' ')}`).join('\n')}\n${faces.join('\n')}\n`);
  writeFileSync(join(dir, 'cube.mtl'), 'newmtl gold\nKd 0.8 0.6 0.1\n');
  const result = run(join(dir, 'cube.obj'), join(dir, 'cube.vox'), '--height', '4', '--colors', '4', '--preview', join(dir, 'preview.png'));
  assert.equal(result.status, 0, result.stderr);
  const model = readVox(join(dir, 'cube.vox'));
  assert.deepEqual(model.size, [4, 4, 4]);
  assert.equal(filled(model), 64);
  assert.deepEqual(model.palette[1], [204, 153, 26], 'the color of the material');
  assert.ok(existsSync(join(dir, 'preview.png')));
  assert.match(result.stdout, /4 x 4 x 4/);
});

test('mesh2vox reads a GLB and --hollow keeps the shell', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mesh2vox-'));
  const cube = box([0, 0, 0], [1, 1, 1]);
  const positions = [];
  for (const t of cube) positions.push(...t.a, ...t.b, ...t.c);
  const glb = makeGlb({
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length * 4 }],
  }, floats(...positions));
  writeFileSync(join(dir, 'cube.glb'), Buffer.from(glb));
  const result = run(join(dir, 'cube.glb'), join(dir, 'cube.vox'), '--height', '4', '--hollow');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(filled(readVox(join(dir, 'cube.vox'))), 56);
});

test('mesh2vox says what is wrong: no arguments, an unknown file type, a missing file', () => {
  assert.notEqual(run().status, 0);
  assert.match(run().stderr, /usage/);
  const dir = mkdtempSync(join(tmpdir(), 'mesh2vox-'));
  writeFileSync(join(dir, 'x.stl'), '');
  assert.match(run(join(dir, 'x.stl'), join(dir, 'x.vox'), '--height', '4').stderr, /\.obj or \.glb/);
  assert.match(run(join(dir, 'missing.obj'), join(dir, 'x.vox'), '--height', '4').stderr, /missing\.obj/);
});
