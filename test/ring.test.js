import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringClosed, saltCells } from '../src/game/ring.js';

const OPTIONS = { maxRadius: 24, minArea: 40, gapTol: 0 };

// a ring of salt: cells on a circle, sampled finely so the chain is connected; `skip` leaves out cells near an angle
function ring(radius, { cx = 0, cz = 0, gapAt = null, gapHalfWidth = 0 } = {}) {
  const cells = new Set();
  for (let a = 0; a < 2 * Math.PI; a += 0.005) {
    if (gapAt !== null && Math.abs(Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt))) <= gapHalfWidth) continue;
    cells.add(`${cx + Math.round(radius * Math.cos(a))},${cz + Math.round(radius * Math.sin(a))}`);
  }
  return cells;
}

test('gold in the middle of a closed ring is closed in', () => {
  const result = ringClosed(ring(10), { ix: 0, iz: 0 }, OPTIONS);
  assert.equal(result.closed, true);
  assert.ok(result.area > 250 && result.area < 330, `area ${result.area}`);
});

test('a ring with a gap is open, a gap tolerance closes a small one', () => {
  const gapped = ring(10, { gapAt: 0, gapHalfWidth: 0.12 }); // a gap of about 2.4 cells
  assert.equal(ringClosed(gapped, { ix: 0, iz: 0 }, OPTIONS).closed, false);
  assert.equal(ringClosed(gapped, { ix: 0, iz: 0 }, { ...OPTIONS, gapTol: 2 }).closed, true);
  const pin = ring(10);
  assert.ok(pin.delete('10,0')); // one missing cell
  assert.equal(ringClosed(pin, { ix: 0, iz: 0 }, OPTIONS).closed, false, 'one cell is enough to get out');
  assert.equal(ringClosed(pin, { ix: 0, iz: 0 }, { ...OPTIONS, gapTol: 1 }).closed, true);
});

test('a diagonal line of salt is a wall', () => {
  const salt = new Set();
  for (let i = -6; i <= 6; i++) { // a diamond: only diagonal neighbors
    salt.add(`${i},${6 - Math.abs(i)}`);
    salt.add(`${i},${-6 + Math.abs(i)}`);
  }
  assert.equal(ringClosed(salt, { ix: 0, iz: 0 }, OPTIONS).closed, true);
});

test('gold outside the ring, or in a ring that is too small, is not closed in', () => {
  const salt = ring(10);
  assert.equal(ringClosed(salt, { ix: 30, iz: 0 }, OPTIONS).closed, false, 'outside');
  assert.equal(ringClosed(ring(3), { ix: 0, iz: 0 }, OPTIONS).closed, false, 'too small to cover');
  assert.equal(ringClosed(new Set(), { ix: 0, iz: 0 }, OPTIONS).closed, false, 'no salt');
});

test('two rings: the gold is closed in only if its own ring closes', () => {
  const salt = new Set([...ring(8), ...ring(8, { cx: 30 })]);
  assert.equal(ringClosed(salt, { ix: 30, iz: 0 }, OPTIONS).closed, true);
});

test('saltCells keeps only cells whose latest substance is salt', () => {
  const cells = new Map([['0,0', 0.01], ['1,0', 0.01], ['2,0', 0]]);
  const kinds = new Map([['0,0', 'salt'], ['1,0', 'hg'], ['2,0', 'salt']]);
  assert.deepEqual([...saltCells(cells, kinds)], ['0,0']);
});

test('gold lying on or right next to the salt line still counts as inside when the ring is closed around it', () => {
  const salt = ring(10);
  const result = ringClosed(salt, { ix: 9, iz: 0 }, { ...OPTIONS, gapTol: 0 }); // one cell from the line, inside
  assert.equal(result.closed, true);
  assert.equal(ringClosed(salt, { ix: 10, iz: 0 }, { ...OPTIONS, gapTol: 0 }).closed, true, 'on the line: the nearest free cell is inside or outside; inside here');
});

test('a wider search for a start cell does not make an open ring closed', () => {
  const open = ring(10, { gapAt: 0, gapHalfWidth: 0.3 });
  assert.equal(ringClosed(open, { ix: 0, iz: 0 }, OPTIONS).closed, false);
});
