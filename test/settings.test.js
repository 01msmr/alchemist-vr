import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettings } from '../src/settings.js';

const memory = (initial) => {
  const data = new Map(initial === undefined ? [] : [['k', initial]]);
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
};

test('defaults are dark, lab, normal', () => {
  assert.deepEqual(createSettings(memory(), 'k').get(), { theme: 'dark', background: 'lab', difficulty: 'normal' });
});

test('set validates, reports changes and refuses unknown names and values', () => {
  const s = createSettings(memory(), 'k');
  assert.equal(s.set('theme', 'light'), true);
  assert.equal(s.set('theme', 'light'), false);
  assert.equal(s.set('theme', 'pink'), false);
  assert.equal(s.set('volume', 'loud'), false);
  assert.equal(s.get().theme, 'light');
});

test('a choice survives a round trip through the storage', () => {
  const storage = memory();
  const a = createSettings(storage, 'k');
  a.set('background', 'stable');
  assert.equal(createSettings(storage, 'k').get().background, 'stable');
});

test('a broken value gives the defaults, a partly valid one keeps its valid keys', () => {
  assert.equal(createSettings(memory('{nope'), 'k').get().theme, 'dark');
  assert.equal(createSettings(memory('42'), 'k').get().theme, 'dark');
  const part = createSettings(memory(JSON.stringify({ theme: 'light', background: 'moon', difficulty: 'hard' })), 'k').get();
  assert.deepEqual(part, { theme: 'light', background: 'lab', difficulty: 'hard' });
});

test('blocked or missing storage does not throw', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = createSettings(blocked, 'k');
  assert.equal(s.set('theme', 'light'), true);
  assert.equal(createSettings(undefined, 'k').set('theme', 'light'), true);
});

test('subscribers hear changes (and can stop listening)', () => {
  const s = createSettings(memory(), 'k');
  const heard = [];
  const stop = s.subscribe((values, name) => heard.push([name, values[name]]));
  s.set('theme', 'light');
  s.set('theme', 'light');
  stop();
  s.set('theme', 'dark');
  assert.deepEqual(heard, [['theme', 'light']]);
});
