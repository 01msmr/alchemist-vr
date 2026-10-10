import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiltDirection, vialLip, tiltAngle, distanceToSegment } from '../src/game/geometry.js';

test('lip geometry and tilt from the up vector', () => {
  const pos = { x: 0, y: 0.2, z: 0 };
  assert.deepEqual(tiltDirection({ x: 0, z: 0 }, { x: 0, z: 0 }), { x: 1, z: 0 });
  const upright = vialLip(pos, { x: 0, y: 1, z: 0 }, 0.065);
  assert.ok(Math.abs(upright.y - 0.265) < 1e-12 && upright.x === 0);
  const sideways = vialLip(pos, { x: 1, y: 0, z: 0 }, 0.065);
  assert.ok(Math.abs(sideways.x - 0.065) < 1e-12 && Math.abs(sideways.y - 0.2) < 1e-12);
  assert.equal(tiltAngle({ x: 0, y: 1, z: 0 }), 0);
  assert.ok(Math.abs(tiltAngle({ x: 1, y: 0, z: 0 }) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(tiltAngle({ x: 0, y: -1, z: 0 }) - Math.PI) < 1e-12);
});

test('distance to a segment', () => {
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 0, y: 1, z: 0 };
  assert.equal(distanceToSegment({ x: 0.03, y: 0.5, z: 0 }, a, b), 0.03);
  assert.equal(distanceToSegment({ x: 0, y: 2, z: 0 }, a, b), 1);
  assert.equal(distanceToSegment({ x: 1, y: 1, z: 1 }, a, a), Math.hypot(1, 1, 1));
});
