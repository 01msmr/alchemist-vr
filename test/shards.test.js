import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseVox } from '../src/vox.js';
import { VoxelObject } from '../src/voxel-object.js';
import { splitShards } from '../src/shards.js';

const V = 0.01;

// a hollow cylinder shell, 9 wide and 16 high
function shell() {
  const o = VoxelObject.empty(9, 16, 9, [[0, 0, 0], [120, 160, 220]]);
  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 9; z++) {
      for (let x = 0; x < 9; x++) {
        const r = Math.hypot(x - 4, z - 4);
        if (r <= 4 && r > 3) o.set(x, y, z, 1);
      }
    }
  }
  return o;
}

const count = (o) => o.data.reduce((n, i) => n + (i ? 1 : 0), 0);

test('a shell breaks into three or four pieces that together are all of it, each voxel in exactly one', () => {
  const whole = shell();
  const shards = splitShards(whole, V);
  assert.ok(shards.length >= 3 && shards.length <= 4, `${shards.length} pieces`);
  assert.equal(shards.reduce((n, s) => n + count(s.obj), 0), count(whole));
  const seen = new Set();
  for (const s of shards) {
    s.obj.data.forEach((i, at) => {
      if (!i) return;
      assert.equal(whole.data[at], i, 'same voxel, same color');
      assert.ok(!seen.has(at), 'in one piece only');
      seen.add(at);
    });
  }
});

test('each piece knows its center (in the model, meters) and its size', () => {
  for (const s of splitShards(shell(), V)) {
    assert.ok(s.half.x >= 0.005 && s.half.y >= 0.005 && s.half.z >= 0.005, 'a box a physics body can have');
    assert.ok(s.center.y > 0 && s.center.y < 16 * V);
    assert.ok(Math.abs(s.center.x) < 0.045 && Math.abs(s.center.z) < 0.045);
  }
  // the pieces lie apart: not all at the same place
  const ys = splitShards(shell(), V).map((s) => s.center.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.02);
});

test('the real potion bottle breaks too', () => {
  const file = readFileSync(new URL('../src/assets/bottle.vox', import.meta.url));
  const bottle = parseVox(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  const shards = splitShards(bottle, V);
  assert.ok(shards.length >= 3 && shards.length <= 4);
  assert.equal(shards.reduce((n, s) => n + count(s.obj), 0), count(bottle));
});
