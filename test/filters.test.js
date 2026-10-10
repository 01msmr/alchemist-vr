import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVecFilter, createQuatFilter } from '../src/filters.js';

const DT = 1 / 72;
// deterministic "noise" in -1..1
const noise = (i, k = 1) => Math.sin(i * 12.9898 * k) * 0.5 + Math.sin(i * 78.233 * k + 1.3) * 0.5;
const std = (values) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
};

test('the vector filter calms jitter of a hand that holds still', () => {
  const f = createVecFilter({ minCutoff: 1.5, beta: 6, dCutoff: 1 });
  const raw = [];
  const out = [];
  for (let i = 0; i < 300; i++) {
    const v = { x: 0.3 + 0.004 * noise(i), y: 1.1 + 0.004 * noise(i, 2), z: -0.4 + 0.004 * noise(i, 3) };
    const r = f.filter(v, DT);
    if (i > 50) {
      raw.push(v.x);
      out.push(r.x);
    }
  }
  assert.ok(std(out) < std(raw) * 0.5, `jitter ${std(raw).toFixed(5)} -> ${std(out).toFixed(5)}`);
  assert.ok(Math.abs(out[out.length - 1] - 0.3) < 0.004, 'and stays where the hand is');
});

test('the vector filter keeps up with a fast hand: the lag is small', () => {
  const adaptive = createVecFilter({ minCutoff: 1.5, beta: 6, dCutoff: 1 });
  const slowOnly = createVecFilter({ minCutoff: 1.5, beta: 0, dCutoff: 1 });
  let lagAdaptive = 0;
  let lagSlow = 0;
  for (let i = 0; i < 200; i++) {
    const x = i * DT * 1.0; // 1 m/s
    const a = adaptive.filter({ x, y: 0, z: 0 }, DT);
    const s = slowOnly.filter({ x, y: 0, z: 0 }, DT);
    lagAdaptive = x - a.x;
    lagSlow = x - s.x;
  }
  assert.ok(lagAdaptive < 0.03, `lag at 1 m/s: ${lagAdaptive.toFixed(4)} m`);
  assert.ok(lagAdaptive < lagSlow * 0.5, 'much less lag than a plain low-pass with the same resting smoothness');
});

test('the vector filter forgets its history on reset and never returns the input object', () => {
  const f = createVecFilter({ minCutoff: 1.5, beta: 6, dCutoff: 1 });
  f.filter({ x: 1, y: 2, z: 3 }, DT);
  f.reset();
  const input = { x: 9, y: 8, z: 7 };
  const out = f.filter(input, DT);
  assert.deepEqual({ x: out.x, y: out.y, z: out.z }, input);
  input.x = 0;
  assert.equal(out.x, 9, 'the result is its own object');
});

const quat = (angle, axis = [0, 1, 0]) => {
  const s = Math.sin(angle / 2);
  return { x: axis[0] * s, y: axis[1] * s, z: axis[2] * s, w: Math.cos(angle / 2) };
};
const angleBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));

test('the quaternion filter calms a wobbling wrist and follows a fast turn', () => {
  const f = createQuatFilter({ minCutoff: 1.2, beta: 0.8, dCutoff: 1 });
  let rawErr = 0;
  let outErr = 0;
  const still = quat(0.5);
  for (let i = 0; i < 300; i++) {
    const q = quat(0.5 + 0.03 * noise(i));
    const out = f.filter(q, DT);
    if (i > 50) {
      rawErr += angleBetween(q, still);
      outErr += angleBetween(out, still);
    }
  }
  assert.ok(outErr < rawErr * 0.5, `wobble ${rawErr.toFixed(3)} -> ${outErr.toFixed(3)}`);

  const turn = createQuatFilter({ minCutoff: 1.2, beta: 0.8, dCutoff: 1 });
  let lag = 0;
  for (let i = 0; i < 200; i++) {
    const target = quat(i * DT * 3); // 3 rad/s
    lag = angleBetween(turn.filter(target, DT), target);
  }
  assert.ok(lag < 0.2, `lag at 3 rad/s: ${lag.toFixed(3)} rad`);
});

test('the quaternion filter takes the short way round and returns unit quaternions', () => {
  const f = createQuatFilter({ minCutoff: 1.2, beta: 0.8, dCutoff: 1 });
  f.filter(quat(0.1), DT);
  const q = quat(0.1);
  const flipped = { x: -q.x, y: -q.y, z: -q.z, w: -q.w }; // the same rotation, the other sign
  const out = f.filter(flipped, DT);
  assert.ok(angleBetween(out, q) < 1e-6, 'no spin through the long way');
  assert.ok(Math.abs(Math.hypot(out.x, out.y, out.z, out.w) - 1) < 1e-9);
});
