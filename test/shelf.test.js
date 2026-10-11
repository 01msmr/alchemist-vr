import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../src/config/index.js';
import { slotNear, gripAtSlot } from '../src/game/shelf.js';

const S = LAYOUT.shelf;
const [tongs, spoon] = S.slots;
const at = (slot, dy = 0.06) => ({ x: slot.x, y: S.y + dy, z: S.z });

test('a working end at a compartment finds it, far away or at the wrong height finds none', () => {
  assert.equal(slotNear(at(tongs))?.id, 'tongs');
  assert.equal(slotNear(at(spoon))?.id, 'spoon');
  assert.equal(slotNear({ x: 0, y: 0.05, z: 0.1 }), null, 'the middle of the table');
  assert.equal(slotNear({ x: tongs.x, y: S.y + 0.5, z: S.z }), null, 'far above the shelf');
  assert.equal(slotNear({ x: (tongs.x + spoon.x) / 2 + 0.2, y: S.y + 0.05, z: S.z + 0.3 }), null);
});

test('the nearest compartment wins', () => {
  assert.equal(slotNear({ x: tongs.x + 0.03, y: S.y + 0.05, z: S.z })?.id, 'tongs');
  assert.equal(slotNear({ x: spoon.x - 0.03, y: S.y + 0.05, z: S.z })?.id, 'spoon');
});

test('putting the tool back and taking it again', () => {
  const inShelf = new Set();
  let r = gripAtSlot(inShelf, 'tongs', tongs);
  assert.deepEqual(r, { held: null, changed: true });
  assert.ok(inShelf.has('tongs'));
  r = gripAtSlot(inShelf, null, tongs);
  assert.deepEqual(r, { held: 'tongs', changed: true });
  assert.equal(inShelf.size, 0);
});

test('a tool in hand is swapped for the one lying there', () => {
  const inShelf = new Set(['tongs']);
  const r = gripAtSlot(inShelf, 'spoon', tongs);
  assert.deepEqual(r, { held: 'tongs', changed: true });
  assert.deepEqual([...inShelf], ['spoon']);
});

test('a tool does not go into the wrong compartment, and an empty hand at an empty compartment does nothing', () => {
  const inShelf = new Set();
  assert.deepEqual(gripAtSlot(inShelf, 'spoon', tongs), { held: 'spoon', changed: false });
  assert.deepEqual(gripAtSlot(inShelf, null, tongs), { held: null, changed: false });
  assert.equal(inShelf.size, 0);
});

test('two hands never carry the same tool', () => {
  const inShelf = new Set(['tongs']);
  const left = gripAtSlot(inShelf, null, tongs);
  const right = gripAtSlot(inShelf, null, tongs);
  assert.equal(left.held, 'tongs');
  assert.equal(right.held, null, 'it is not there any more');
});

test('the compartments and the shelf are on the table, the hand tools in the right half', () => {
  const b = LAYOUT.tableBounds;
  for (const slot of S.slots) assert.ok(slot.x > 0 && slot.x < b.maxX);
  assert.ok(S.z > b.minZ && S.z < b.maxZ);
  assert.ok(S.dividers.every((x) => x > b.minX && x < b.maxX));
  assert.ok(LAYOUT.rest.vial.x < 0 && LAYOUT.rest.rod.x < 0, 'the main tools start in the left half');
});
