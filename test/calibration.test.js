import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTapCounter, edgeFromPoints, validEdge, loadEdge, saveEdge, validHeight, loadHeight, saveHeight } from '../src/calibration.js';

const DT = 0.1;
const RANGE = [0.4, 1.4];

const TAP = { count: 3, drop: 0.02, lift: 0.015, maxGap: 1.5, tolerance: 0.03 };

test('the taps also hand back where the lowest point of each tap was', () => {
  const counter = createTapCounter(TAP);
  let r;
  [0.74, 0.72, 0.73].forEach((low, i) => {
    for (const y of tap(low)) {
      const result = counter.update(y, true, DT, { x: i, z: -low });
      if (result.done) r = result;
    }
  });
  assert.equal(r.done, true);
  assert.deepEqual(r.points, [{ x: 0, z: -0.74 }, { x: 1, z: -0.72 }, { x: 2, z: -0.73 }]);
});

// feeds a fingertip height path, one sample per DT; returns the last result that was done (or the last result)
function feed(counter, path, active = true) {
  let last;
  let doneResult = null;
  for (const y of path) {
    last = counter.update(y, active, DT);
    if (last.done) doneResult = last;
  }
  return doneResult ?? last;
}

// down to `low` and back up to `top` in four samples
const tap = (low, top = 0.9) => [top, (top + low) / 2, low, (top + low) / 2, top];

test('three taps fire once with the lowest of the three heights', () => {
  const counter = createTapCounter(TAP);
  const r = feed(counter, [...tap(0.74), ...tap(0.72), ...tap(0.73)]);
  assert.equal(r.done, true);
  assert.equal(r.height, 0.72);
});

test('two taps are not enough, and the taps are counted', () => {
  const counter = createTapCounter(TAP);
  const r = feed(counter, [...tap(0.74), ...tap(0.73)]);
  assert.equal(r.done, false);
  assert.equal(r.taps, 2);
});

test('jitter of a few millimetres is not a tap', () => {
  const counter = createTapCounter(TAP);
  const path = Array.from({ length: 200 }, (_, i) => 0.8 + (i % 2 ? 0.003 : -0.003));
  const r = feed(counter, path);
  assert.equal(r.done, false);
  assert.equal(r.taps, 0);
});

test('a slow third tap starts over', () => {
  const counter = createTapCounter(TAP);
  const wait = Array(20).fill(0.9); // 2 s at DT 0.1
  const r = feed(counter, [...tap(0.74), ...tap(0.73), ...wait, ...tap(0.73)]);
  assert.equal(r.done, false);
  assert.equal(r.taps, 1);
});

test('taps at clearly different heights are not one table', () => {
  const counter = createTapCounter(TAP);
  const r = feed(counter, [...tap(0.74), ...tap(0.6), ...tap(0.74)]);
  assert.equal(r.done, false);
});

test('leaving the table area starts over', () => {
  const counter = createTapCounter(TAP);
  feed(counter, [...tap(0.74), ...tap(0.73)]);
  counter.update(0.9, false, DT);
  const r = feed(counter, tap(0.73));
  assert.equal(r.taps, 1);
});

test('it can fire again after a success', () => {
  const counter = createTapCounter(TAP);
  const go = () => feed(counter, [...tap(0.74), ...tap(0.74), ...tap(0.74)]).done;
  assert.equal(go(), true);
  assert.equal(go(), true);
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

// The front edge of the table from two points on it (scene x, z). The player faces -z; the table lies behind the edge.
const EDGE = { frontToOrigin: 0.3, minSpan: 0.3 };
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('a straight edge puts the origin behind its middle, the table facing away', () => {
  const e = edgeFromPoints({ x: -0.5, z: -0.15 }, { x: 0.5, z: -0.15 }, EDGE);
  assert.ok(close(e.x, 0) && close(e.z, -0.45) && close(e.yaw, 0));
});

test('the order of the two points does not matter', () => {
  const a = edgeFromPoints({ x: -0.5, z: -0.15 }, { x: 0.5, z: -0.15 }, EDGE);
  const b = edgeFromPoints({ x: 0.5, z: -0.15 }, { x: -0.5, z: -0.15 }, EDGE);
  assert.ok(close(a.x, b.x) && close(a.z, b.z) && close(a.yaw, b.yaw));
});

test('a slanted edge turns the table: the local -z axis ends up perpendicular to it', () => {
  // the right end is nearer to the player (z larger): the table turns clockwise seen from above (negative yaw)
  const e = edgeFromPoints({ x: -0.5, z: -0.4 }, { x: 0.5, z: -0.2 }, EDGE);
  assert.ok(e.yaw < 0 && e.yaw > -Math.PI / 2);
  const along = { x: Math.cos(e.yaw), z: -Math.sin(e.yaw) }; // local +x in the scene
  const dir = { x: 1 / Math.hypot(1, 0.2), z: 0.2 / Math.hypot(1, 0.2) }; // from the first to the second point
  assert.ok(close(along.x, dir.x) && close(along.z, dir.z));
});

test('two points too close together make no line', () => {
  assert.equal(edgeFromPoints({ x: 0, z: -0.15 }, { x: 0.1, z: -0.15 }, EDGE), null);
});

test('only plausible edges are accepted, and stored and loaded', () => {
  assert.equal(validEdge({ x: 0, z: -0.45, yaw: 0.2 }), true);
  for (const bad of [null, {}, { x: 0, z: 0 }, { x: NaN, z: 0, yaw: 0 }, { x: 0, z: 0, yaw: 3 }, { x: 9, z: 0, yaw: 0 }]) assert.equal(validEdge(bad), false);
  const storage = memory();
  assert.equal(loadEdge(storage, 'e'), null);
  assert.equal(saveEdge(storage, 'e', { x: 0.1, z: -0.5, yaw: 0.1 }), true);
  assert.deepEqual(loadEdge(storage, 'e'), { x: 0.1, z: -0.5, yaw: 0.1 });
  assert.equal(saveEdge(storage, 'e', { x: 0, z: 0, yaw: 4 }), false);
  assert.equal(loadEdge(memory({ e: 'not json' }), 'e'), null);
});
