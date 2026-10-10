import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDwell, validHeight, loadHeight, saveHeight } from '../src/calibration.js';

const DT = 0.1;
const RANGE = [0.4, 1.4];

test('a pinch held still on the table counts up and fires exactly once', () => {
  const dwell = createDwell({ seconds: 1, maxSpeed: 0.03 });
  let fired = 0;
  let progress = 0;
  for (let i = 0; i < 25; i++) {
    const r = dwell.update(true, 0.005, DT);
    progress = r.progress;
    if (r.done) fired++;
  }
  assert.equal(fired, 1, 'once, not on every frame while the pinch goes on');
  assert.equal(progress, 1);
});

test('progress rises with time and resets when the pinch opens or the hand moves', () => {
  const dwell = createDwell({ seconds: 1, maxSpeed: 0.03 });
  assert.ok(Math.abs(dwell.update(true, 0, 0.5).progress - 0.5) < 1e-9);
  assert.equal(dwell.update(true, 0.2, DT).progress, 0, 'moving: starts over');
  assert.ok(dwell.update(true, 0, 0.5).progress > 0);
  assert.equal(dwell.update(false, 0, DT).progress, 0, 'pinch open: starts over');
});

test('after letting go it can fire again', () => {
  const dwell = createDwell({ seconds: 1, maxSpeed: 0.03 });
  const run = () => {
    let done = false;
    for (let i = 0; i < 15; i++) done = dwell.update(true, 0, DT).done || done;
    return done;
  };
  assert.equal(run(), true);
  dwell.update(false, 0, DT);
  assert.equal(run(), true);
});

test('only plausible table heights are accepted', () => {
  assert.equal(validHeight(0.75, RANGE), true);
  assert.equal(validHeight(0.4, RANGE), true);
  assert.equal(validHeight(0.39, RANGE), false);
  assert.equal(validHeight(1.5, RANGE), false);
  for (const bad of [NaN, Infinity, undefined, null, '0.8']) assert.equal(validHeight(bad, RANGE), false, String(bad));
});

// a storage like localStorage
const memory = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
};

test('the height survives a round trip through the storage', () => {
  const storage = memory();
  assert.equal(loadHeight(storage, 'k', RANGE), null, 'nothing stored yet');
  assert.equal(saveHeight(storage, 'k', 0.72), true);
  assert.equal(loadHeight(storage, 'k', RANGE), 0.72);
});

test('a missing, garbled or implausible stored value is ignored', () => {
  for (const stored of ['abc', '', '9', '-1', 'NaN']) assert.equal(loadHeight(memory({ k: stored }), 'k', RANGE), null, stored);
  assert.equal(saveHeight(memory(), 'k', 9, RANGE), false, 'an implausible height is not stored');
});

test('a storage that is not there or throws never breaks the game', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadHeight(broken, 'k', RANGE), null);
  assert.equal(saveHeight(broken, 'k', 0.8), false);
  assert.equal(loadHeight(undefined, 'k', RANGE), null);
  assert.equal(saveHeight(undefined, 'k', 0.8), false);
});
