import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPuddles, MAX_CELL, CELL } from '../src/game/puddles.js';

const BOUNDS = { minX: -1, maxX: 1, minZ: -0.7, maxZ: 0.3 };

test('spilled mercury stays where it landed', () => {
  const p = createPuddles(BOUNDS);
  assert.ok(p.add(0.2, -0.1, 0.01));
  assert.ok(Math.abs(p.total() - 0.01) < 1e-12);
  assert.equal(p.cells.size, 1);
  assert.ok(p.cells.has(`${Math.round(0.2 / CELL)},${Math.round(-0.1 / CELL)}`), 'in the cell of that place, whatever its size');
});

test('a big spill spreads into a wide thin puddle and keeps all its mercury', () => {
  const p = createPuddles(BOUNDS);
  for (let i = 0; i < 100; i++) p.add(0, 0, 0.01);
  assert.ok(Math.abs(p.total() - 1) < 1e-9);
  assert.ok(p.cells.size > 25);
  for (const v of p.cells.values()) assert.ok(v <= MAX_CELL + 1e-9);
  const xs = [...p.cells.keys()].map((k) => Number(k.split(',')[0]) * CELL);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.05);
});

test('mercury landing off the table is not kept, and clear wipes the table', () => {
  const p = createPuddles(BOUNDS);
  assert.equal(p.add(1.5, 0, 0.01), false);
  assert.equal(p.total(), 0);
  const v = p.version;
  p.add(0, 0, 0.02);
  assert.ok(p.version > v);
  p.clear();
  assert.equal(p.total(), 0);
});
