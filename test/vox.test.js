import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVox } from '../src/vox.js';
import { meshVoxelObject } from '../src/mesher.js';
import { VoxelObject } from '../src/voxel-object.js';

function chunk(id, content, children = new Uint8Array(0)) {
  const out = new Uint8Array(12 + content.length + children.length);
  const v = new DataView(out.buffer);
  out.set([...id].map((c) => c.charCodeAt(0)), 0);
  v.setUint32(4, content.length, true);
  v.setUint32(8, children.length, true);
  out.set(content, 12);
  out.set(children, 12 + content.length);
  return out;
}

function makeVox(size, voxels, rgbaFirst) {
  const sizeC = new Uint8Array(12);
  new DataView(sizeC.buffer).setInt32(0, size[0], true);
  new DataView(sizeC.buffer).setInt32(4, size[1], true);
  new DataView(sizeC.buffer).setInt32(8, size[2], true);
  const xyzi = new Uint8Array(4 + voxels.length * 4);
  new DataView(xyzi.buffer).setUint32(0, voxels.length, true);
  voxels.forEach((v, i) => xyzi.set(v, 4 + i * 4));
  const rgba = new Uint8Array(1024);
  rgba.set(rgbaFirst, 0);
  const children = [chunk('SIZE', sizeC), chunk('XYZI', xyzi), chunk('RGBA', rgba)];
  const childBytes = new Uint8Array(children.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of children) { childBytes.set(c, o); o += c.length; }
  const main = chunk('MAIN', new Uint8Array(0), childBytes);
  const out = new Uint8Array(8 + main.length);
  out.set([...'VOX '].map((c) => c.charCodeAt(0)), 0);
  new DataView(out.buffer).setUint32(4, 150, true);
  out.set(main, 8);
  return out.buffer;
}

test('parses size, palette and converts Z-up to Y-up', () => {
  // vox size 2x3x4 (x, y-depth, z-up); voxel at vox (1, 0, 3) with palette index 1
  const obj = parseVox(makeVox([2, 3, 4], [[1, 0, 3, 1]], [10, 20, 30, 255]));
  assert.deepEqual(obj.size, [2, 4, 3]);
  assert.deepEqual(obj.palette[1], [10, 20, 30]);
  // (x, y, z) -> (x, z, sizeY - 1 - y) = (1, 3, 2)
  assert.equal(obj.get(1, 3, 2), 1);
  assert.equal(obj.data.filter(Boolean).length, 1);
});

test('rejects non-vox data', () => {
  assert.throws(() => parseVox(new ArrayBuffer(32)), /not a .vox/);
});

test('single voxel meshes to 6 quads with outward CCW winding', () => {
  const obj = VoxelObject.empty(1, 1, 1, [[0, 0, 0], [255, 255, 255]]);
  obj.set(0, 0, 0, 1);
  const m = meshVoxelObject(obj, 1);
  assert.equal(m.indices.length, 36);
  assert.equal(m.positions.length / 3, 24);
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => m.indices[t + k] * 3);
    const P = (i) => [m.positions[i], m.positions[i + 1], m.positions[i + 2]];
    const [pa, pb, pc] = [P(a), P(b), P(c)];
    const e1 = pb.map((v, i) => v - pa[i]);
    const e2 = pc.map((v, i) => v - pa[i]);
    const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const n = [m.normals[a], m.normals[a + 1], m.normals[a + 2]];
    assert.ok(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] > 0, 'triangle faces outward');
  }
});

test('hidden faces between neighbours are culled', () => {
  const obj = VoxelObject.empty(2, 1, 1, [[0, 0, 0], [255, 255, 255]]);
  obj.set(0, 0, 0, 1);
  obj.set(1, 0, 0, 1);
  assert.equal(meshVoxelObject(obj, 1).indices.length / 6, 10);
});
