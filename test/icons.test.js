import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverageRows } from '../src/icons.js';

// an RGBA image of size x size where `paint(x, y)` says whether the pixel is covered
const image = (size, paint) => {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data[(y * size + x) * 4 + 3] = paint(x, y) ? 255 : 0;
  return data;
};

test('a cell is set when enough of it is covered', () => {
  const size = 16; // 4 x 4 cells of 4 pixels
  const left = image(size, (x) => x < 8); // the left two columns
  assert.deepEqual(coverageRows(left, size, 4), ['##..', '##..', '##..', '##..']);
  const sliver = image(size, (x, y) => x === 0 && y < 16); // 1 pixel of 4: a quarter, below the threshold
  assert.deepEqual(coverageRows(sliver, size, 4), ['....', '....', '....', '....']);
  const half = image(size, (x) => x < 2); // exactly half of the first column
  assert.equal(coverageRows(half, size, 4)[0][0], '#');
});

test('the rows are n x n and row 0 is the top of the image', () => {
  const size = 14;
  const rows = coverageRows(image(size, (x, y) => y < 7), size, 7);
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => r.length === 7));
  assert.equal(rows[0], '#######');
  assert.equal(rows[6], '.......');
});
