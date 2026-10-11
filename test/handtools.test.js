import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANDTOOLS, LAYOUT } from '../src/config/index.js';
import { canDo } from '../src/handtools.js';

test('the tongs hold things, the spoon only scoops', () => {
  for (const action of ['tool', 'match', 'nugget', 'wick']) assert.equal(canDo('tongs', action), true, action);
  assert.equal(canDo('tongs', 'grains'), false);
  assert.equal(canDo('spoon', 'grains'), true);
  for (const action of ['tool', 'match', 'nugget', 'wick', 'panel']) assert.equal(canDo('spoon', action), false, action);
  assert.equal(canDo('nonsense', 'tool'), false);
  assert.equal(canDo(null, 'tool'), false, 'an empty hand does nothing');
});

test('every hand tool has a compartment in the shelf and reaches in front of the controller', () => {
  for (const slot of LAYOUT.shelf.slots) assert.ok(HANDTOOLS[slot.id].tipZ > 0.05 && HANDTOOLS[slot.id].can.length > 0, slot.id);
  assert.equal(LAYOUT.shelf.slots.length, 2);
});
