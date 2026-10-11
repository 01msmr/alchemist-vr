import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANDTOOLS } from '../src/config/index.js';
import { canDo, nextTool } from '../src/handtools.js';

test('the tongs hold things, the spoon only scoops', () => {
  for (const action of ['tool', 'match', 'nugget', 'wick']) assert.equal(canDo('tongs', action), true, action);
  assert.equal(canDo('tongs', 'grains'), false);
  assert.equal(canDo('spoon', 'grains'), true);
  for (const action of ['tool', 'match', 'nugget', 'wick', 'panel']) assert.equal(canDo('spoon', action), false, action);
  assert.equal(canDo('nonsense', 'tool'), false);
});

test('the grip button goes through the hand tools and starts over', () => {
  assert.equal(nextTool('tongs', ['tongs', 'spoon']), 'spoon');
  assert.equal(nextTool('spoon', ['tongs', 'spoon']), 'tongs');
  assert.equal(nextTool('unknown', ['tongs', 'spoon']), 'tongs');
  const seen = new Set();
  let tool = HANDTOOLS.order[0];
  for (let i = 0; i < HANDTOOLS.order.length; i++) { seen.add(tool); tool = nextTool(tool); }
  assert.equal(seen.size, HANDTOOLS.order.length, 'every tool in the order is reached');
});

test('every hand tool in the order and at the start exists and reaches in front of the controller', () => {
  for (const id of HANDTOOLS.order) assert.ok(HANDTOOLS[id].tipZ > 0.05 && HANDTOOLS[id].can.length > 0, id);
  assert.ok(HANDTOOLS.order.includes(HANDTOOLS.start.left) && HANDTOOLS.order.includes(HANDTOOLS.start.right));
  assert.notEqual(HANDTOOLS.start.left, HANDTOOLS.start.right, 'the two hands start with different tools');
});
