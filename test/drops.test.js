import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spillVelocity, spawnDrop, stepDrops, MAX_DROPS, GRAVITY } from '../src/game/drops.js';
import { CFG } from '../src/config/index.js';

const TARGET = { cx: 0, cz: 0, top: 0.14, mouth: 0.035, rim: 0.047 };
const still = { x: 0, y: 0, z: 0 };

function fly(drop, p, v, maxSeconds = 2) {
  const list = [];
  spawnDrop(list, p, v, 0.01);
  const landed = [];
  let t = 0;
  for (; t < maxSeconds && list.length; t += 0.005) stepDrops(list, 0.005, TARGET, (a, w, x, z) => landed.push({ a, w, t, x, z }));
  return landed[0];
}

test('a drop above the mouth lands in the crucible after a flight time, not instantly', () => {
  const hit = fly(null, { x: 0.01, y: 0.2, z: 0 }, still);
  assert.equal(hit.w, 'crucible');
  const expected = Math.sqrt((2 * 0.06) / GRAVITY); // fall of 6 cm
  assert.ok(Math.abs(hit.t - expected) < 0.02);
});

test('hand and spill velocity carry the drop: aiming matters', () => {
  const p = { x: 0.03, y: 0.2, z: 0 };
  assert.equal(fly(null, p, still).w, 'crucible'); // falls straight down inside the mouth
  assert.equal(fly(null, p, { x: 0.6, y: 0, z: 0 }).w, 'table'); // thrown clear past the crucible
  assert.equal(fly(null, { x: 0.06, y: 0.2, z: 0 }, { x: -0.3, y: 0, z: 0 }).w, 'crucible'); // moving toward it
});

test('landing on the rim ring splashes off', () => {
  assert.equal(fly(null, { x: 0.04, y: 0.2, z: 0 }, still).w, 'rim');
});

test('a drop that starts below the crucible top falls to the table', () => {
  assert.equal(fly(null, { x: 0, y: 0.1, z: 0 }, still).w, 'table');
});

test('every drop lands exactly once and the amount is conserved', () => {
  const list = [];
  for (let i = 0; i < 20; i++) spawnDrop(list, { x: i * 0.004, y: 0.25, z: 0 }, still, 0.01);
  let sum = 0;
  let n = 0;
  for (let t = 0; t < 2 && list.length; t += 0.01) stepDrops(list, 0.01, TARGET, (a) => { sum += a; n++; });
  assert.equal(n, 20);
  assert.ok(Math.abs(sum - 0.2) < 1e-12);
});

test('the drop pool is capped', () => {
  const list = [];
  for (let i = 0; i < MAX_DROPS; i++) assert.ok(spawnDrop(list, still, still, 0.01));
  assert.equal(spawnDrop(list, still, still, 0.01), false);
});

test('spill velocity: along the horizontal tilt, plus the hand; downward once the vial points down', () => {
  const side = spillVelocity({ x: 1, y: 0, z: 0 }, 0, still);
  assert.ok(Math.abs(side.x - CFG.SPILL_MIN) < 1e-12 && side.y === 0 && side.z === 0);
  const fast = spillVelocity({ x: 0, y: 0.5, z: 1 }, 1, { x: 0.2, y: 0.1, z: 0 });
  assert.ok(Math.abs(fast.z - (CFG.SPILL_MIN + CFG.SPILL_RANGE)) < 1e-12);
  assert.ok(Math.abs(fast.x - 0.2) < 1e-12 && Math.abs(fast.y - 0.1) < 1e-12);
  const down = spillVelocity({ x: 0, y: -1, z: 0 }, 1, still);
  assert.ok(down.y < 0 && down.x === 0 && down.z === 0);
});

test('landing reports where the drop hit', () => {
  const miss = fly(null, { x: 0.2, y: 0.1, z: -0.1 }, still);
  assert.equal(miss.w, 'table');
  assert.ok(Math.abs(miss.x - 0.2) < 1e-6 && Math.abs(miss.z + 0.1) < 1e-6);
  const thrown = fly(null, { x: 0.2, y: 0.1, z: 0 }, { x: 1, y: 0, z: 0 });
  assert.ok(thrown.x > 0.2 + 0.05, 'carried by its velocity');
});

// ---- a loaded spoon spills while it moves low over the table ----
import { trickle as trickleGrains } from '../src/game/drops.js';

const SPILL = { perMeter: 170, maxHeight: 0.2 };

test('a loaded spoon spills grains in proportion to the way it moves, and nothing when it stands still', () => {
  const carry = { load: 100, acc: 0, prev: null };
  assert.equal(trickleGrains(carry, { x: 0, y: 0.05, z: 0 }, SPILL).length, 0, 'the first position only starts the trail');
  assert.equal(trickleGrains(carry, { x: 0, y: 0.05, z: 0 }, SPILL).length, 0, 'standing still');
  let total = 0;
  for (let i = 1; i <= 100; i++) total += trickleGrains(carry, { x: i * 0.001, y: 0.05, z: 0 }, SPILL).length; // 10 cm
  assert.equal(total, 17);
  assert.equal(carry.load, 83);
});

test('the grains of one frame are spread along the way the spoon moved, so a fast stroke leaves no gap', () => {
  const carry = { load: 100, acc: 0, prev: null };
  trickleGrains(carry, { x: 0, y: 0.05, z: 0 }, SPILL);
  const grains = trickleGrains(carry, { x: 0.1, y: 0.05, z: 0.02 }, SPILL); // 10 cm in one frame
  assert.ok(grains.length >= 16);
  const xs = grains.map((g) => g.x);
  assert.ok(xs.every((x, i) => i === 0 || x > xs[i - 1]), 'from the old place to the new one');
  assert.ok(Math.abs(xs.at(-1) - 0.1) < 1e-9 && Math.abs(grains.at(-1).z - 0.02) < 1e-9, 'the last one is where the spoon is now');
  assert.ok(xs.every((x, i) => i === 0 || x - xs[i - 1] < 0.0075), 'less than a cell between two grains');
});

test('higher than the limit nothing spills, and an empty spoon spills nothing', () => {
  const carry = { load: 100, acc: 0, prev: null };
  trickleGrains(carry, { x: 0, y: 0.5, z: 0 }, SPILL);
  assert.equal(trickleGrains(carry, { x: 1, y: 0.5, z: 0 }, SPILL).length, 0);
  const empty = { load: 0, acc: 0, prev: null };
  trickleGrains(empty, { x: 0, y: 0.05, z: 0 }, SPILL);
  assert.equal(trickleGrains(empty, { x: 1, y: 0.05, z: 0 }, SPILL).length, 0);
});

test('a fast move never spills more than the load', () => {
  const carry = { load: 5, acc: 0, prev: null };
  trickleGrains(carry, { x: 0, y: 0.05, z: 0 }, SPILL);
  assert.equal(trickleGrains(carry, { x: 10, y: 0.05, z: 0 }, SPILL).length, 5);
  assert.equal(carry.load, 0);
});
