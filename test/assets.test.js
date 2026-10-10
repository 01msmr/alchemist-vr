import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/game/sim.js';
import { crucibleContents, crucibleModel, standModel, matchboxModel } from '../src/assets.js';

const count = (o) => o.data.filter(Boolean).length;

test('models are non-empty and the contents match the state', () => {
  assert.ok(count(standModel(2)) > count(standModel(-1)));
  const empty = count(crucibleModel([]));
  const s = createState();
  assert.ok(count(crucibleModel(crucibleContents(s.crucible))) > empty);
});

test('the crucible shows a layer of each substance in it', () => {
  const c = { content: 'amalgam', quality: 0.9, temp: 0.7, amounts: { sulfur: 0.4 } };
  assert.equal(crucibleContents(c).length, 2, 'amalgam and sulfur on top');
  assert.equal(crucibleContents({ ...c, amounts: {} }).length, 1);
  const lead = { content: 'lead', temp: 0.7, amounts: { hg: 1.0 } };
  assert.equal(crucibleContents(lead).length, 2, 'lead and mercury on top');
});

test('matchbox shows one head per match left', () => {
  const heads = (o) => o.data.filter((v) => v === 18).length;
  assert.equal(heads(matchboxModel(3)), 3);
  assert.equal(heads(matchboxModel(0)), 0);
});
