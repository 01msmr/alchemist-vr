import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latheShell } from '../src/img2vox/lathe.js';
import { relatheShell } from '../src/img2vox/relathe.js';
import { bodyLayers, fillLayers } from '../src/img2vox/vessel.js';

// a bottle cut-out: a narrow neck on a wide body, colors changing across the width
function bottleImage() {
  const width = 60;
  const height = 100;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const half = y < 30 ? 10 : 30; // neck, then body
    for (let x = 30 - half; x < 30 + half; x++) {
      data.set([x * 4, 120, 255 - x * 4, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const old = latheShell(bottleImage(), { height: 16, colors: 6 }).obj;
const used = (o) => new Set(Array.from(o.data).filter(Boolean));
const rowWidth = (o, y) => {
  let min = Infinity;
  let max = -1;
  for (let z = 0; z < o.size[2]; z++) for (let x = 0; x < o.size[0]; x++) if (o.get(x, y, z)) { min = Math.min(min, x); max = Math.max(max, x); }
  return max < 0 ? 0 : max - min + 1;
};

test('the shell is drawn again at 4/3 the resolution: the same bottle, finer', () => {
  const shell = relatheShell(old, { factor: 4 / 3 });
  assert.equal(shell.size[0], Math.round(old.size[0] * 4 / 3));
  assert.equal(shell.size[1], Math.round(old.size[1] * 4 / 3));
  assert.equal(shell.size[0], shell.size[2]);
  // the widest row and the narrowest are as much wider as the factor says (within a voxel)
  const widths = (o) => Array.from({ length: o.size[1] }, (_, y) => rowWidth(o, y));
  assert.ok(Math.abs(Math.max(...widths(shell)) - Math.max(...widths(old)) * 4 / 3) <= 1);
  assert.ok(Math.abs(Math.min(...widths(shell).filter(Boolean)) - Math.min(...widths(old).filter(Boolean)) * 4 / 3) <= 1.5);
  // the neck is on top and narrower than the body
  assert.ok(rowWidth(shell, shell.size[1] - 1) < rowWidth(shell, 3));
});

test('it keeps the palette and uses only the colors the old shell had', () => {
  const shell = relatheShell(old, { factor: 4 / 3 });
  assert.deepEqual(shell.palette, old.palette);
  for (const index of used(shell)) assert.ok(used(old).has(index), `color ${index} was in the old shell`);
  assert.ok(used(shell).size >= used(old).size - 1, 'the colors are all still there');
});

test('the wall is one voxel, closed all around, and the bottom is a full disk; the top is open', () => {
  const shell = relatheShell(old, { factor: 4 / 3 });
  const [sx, sy, sz] = shell.size;
  const cx = (sx - 1) / 2;
  assert.ok(shell.get(Math.floor(cx), 0, Math.floor(cx)) > 0 && shell.get(Math.ceil(cx), 0, Math.ceil(cx)) > 0, 'a closed bottom');
  for (let y = 1; y < sy; y++) {
    const seen = new Set();
    const stack = [[Math.floor(cx), Math.floor(cx)]];
    let leaks = false;
    while (stack.length) {
      const [x, z] = stack.pop();
      if (x < 0 || z < 0 || x >= sx || z >= sz) { leaks = true; continue; }
      if (seen.has(`${x},${z}`) || shell.get(x, y, z)) continue;
      seen.add(`${x},${z}`);
      stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }
    assert.equal(leaks, false, `layer ${y} has a hole in its wall`);
  }
  assert.equal(shell.get(Math.floor(cx), sy - 1, Math.floor(cx)), 0, 'hollow at the top');
});

test('the body (where the liquid goes) is still the wide part, not the neck', () => {
  const shell = relatheShell(old, { factor: 4 / 3 });
  const widest = Math.max(...Array.from({ length: shell.size[1] }, (_, y) => rowWidth(shell, y)));
  for (const y of bodyLayers(shell)) assert.ok(rowWidth(shell, y) >= 0.7 * widest);
  assert.ok(fillLayers(shell) >= fillLayers(old), 'at least as many layers');
  assert.ok(fillLayers(shell) < shell.size[1] - 3, 'the neck stays empty');
});

test('the body layers are found with an even width too (the axis between two voxel columns)', () => {
  const shell = relatheShell(old, { factor: 2 }); // an odd width doubled is even
  assert.equal(shell.size[0] % 2, 0, 'an even width');
  const layers = bodyLayers(shell);
  assert.ok(layers.length >= 6, `the body has ${layers.length} layers`);
  assert.equal(layers[0], 1);
  assert.ok(layers.every((y, i) => i === 0 || y === layers[i - 1] + 1), 'one block of layers');
});
