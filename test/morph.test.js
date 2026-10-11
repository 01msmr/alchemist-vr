import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelObject } from '../src/voxel-object.js';
import { voxelsOf, morton, matchSets, morphPoint, morphColor } from '../src/game/morph.js';
import { catModel } from '../src/assets.js';
import { mulberry32 } from '../src/paper.js';

const PALETTE = [[0, 0, 0], [255, 0, 0], [0, 0, 255]];
const model = (size, cells) => {
  const o = VoxelObject.empty(...size, PALETTE);
  for (const [x, y, z, i] of cells) o.set(x, y, z, i);
  return o;
};
const key = (v) => `${v.x},${v.y},${v.z}`;

test('the voxels of a model are listed with their colors', () => {
  const list = voxelsOf(model([3, 3, 3], [[0, 0, 0, 1], [2, 1, 0, 2]]));
  assert.deepEqual(list.map((v) => [v.x, v.y, v.z, v.rgb[0]]), [[0, 0, 0, 255], [2, 1, 0, 0]]);
});

test('Morton keys keep neighbors close and are distinct for distinct cells', () => {
  assert.equal(morton(0, 0, 0), 0);
  assert.equal(morton(1, 0, 0), 1);
  assert.equal(morton(0, 1, 0), 2);
  assert.equal(morton(0, 0, 1), 4);
  const keys = new Set();
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) keys.add(morton(x, y, z));
  assert.equal(keys.size, 512);
  assert.ok(morton(1, 1, 1) < morton(2, 0, 0), 'a block of 2x2x2 comes before the next block');
});

test('matching makes both sets the same size and uses every voxel of both', () => {
  const small = voxelsOf(model([4, 4, 4], [[0, 0, 0, 1], [1, 0, 0, 1], [2, 0, 0, 1]]));
  const large = voxelsOf(model([4, 4, 4], [[0, 1, 0, 2], [1, 1, 0, 2], [2, 1, 0, 2], [3, 1, 0, 2], [0, 2, 0, 2], [1, 2, 0, 2], [2, 2, 0, 2]]));
  const pairs = matchSets(small, large);
  assert.equal(pairs.length, 7);
  assert.deepEqual(new Set(pairs.map((p) => key(p.from))), new Set(small.map(key)), 'every start voxel walks');
  assert.deepEqual(new Set(pairs.map((p) => key(p.to))), new Set(large.map(key)), 'every goal voxel is reached');
  const reverse = matchSets(large, small);
  assert.equal(reverse.length, 7);
  assert.deepEqual(new Set(reverse.map((p) => key(p.from))), new Set(large.map(key)));
});

test('a voxel stays at the start at t = 0 and arrives at t = 1, whatever the jitter', () => {
  const pair = { from: { x: 1, y: 2, z: 3, rgb: [255, 0, 0] }, to: { x: 7, y: 5, z: 0, rgb: [0, 0, 255] } };
  const jitter = { lift: 4, swirlX: 3, swirlZ: -2 };
  assert.deepEqual(morphPoint(pair, 0, jitter), { x: 1, y: 2, z: 3 });
  const end = morphPoint(pair, 1, jitter);
  assert.ok(Math.abs(end.x - 7) < 1e-9 && Math.abs(end.y - 5) < 1e-9 && Math.abs(end.z - 0) < 1e-9);
  const mid = morphPoint(pair, 0.5, jitter);
  assert.ok(mid.y > (2 + 5) / 2, 'it lifts on the way');
  assert.deepEqual(morphColor(pair, 0), [255, 0, 0]);
  assert.deepEqual(morphColor(pair, 1), [0, 0, 255]);
  const half = morphColor(pair, 0.5);
  assert.ok(Math.abs(half[0] - 127.5) < 1e-9 && Math.abs(half[2] - 127.5) < 1e-9);
});

test('the straw cat morphs into the living cat: every voxel of the cat is built, nothing is left over', () => {
  const straw = voxelsOf(catModel('straw', 'gold'));
  const alive = voxelsOf(catModel('alive', 'gold'));
  assert.ok(straw.length > 100 && alive.length > 100, `${straw.length} and ${alive.length} voxels`);
  const pairs = matchSets(straw, alive);
  assert.equal(pairs.length, Math.max(straw.length, alive.length));
  assert.deepEqual(new Set(pairs.map((p) => key(p.to))), new Set(alive.map(key)));
  assert.deepEqual(new Set(pairs.map((p) => key(p.from))), new Set(straw.map(key)));
  // neighbors stay neighbors: the average way a voxel walks is much shorter than across the whole cat
  const average = pairs.reduce((sum, p) => sum + Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y, p.to.z - p.from.z), 0) / pairs.length;
  assert.ok(average < 6, `the average walk is ${average.toFixed(1)} voxels`);
  const rand = mulberry32(1);
  assert.ok(Number.isFinite(rand()));
});
