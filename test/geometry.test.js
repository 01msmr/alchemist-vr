import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiltDirection, vialLip, tiltAngle, distanceToSegment, gripContact, holdStrength, createCrushMeter } from '../src/game/geometry.js';

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

// how well a tool is held, by where the hand closes on it
const VIAL = { grabRadius: 0.03, axisHalf: 0.055, radius: 0.025 };
const CONTACT = { offAxisPenalty: 0.1, palmSpan: 0.035, palmReach: 0.035 };

test('anywhere on the volume of a tool is held (almost) as well as on its axis', () => {
  for (const [dist, axial] of [[0, 0], [0.025, 0], [0, 0.05], [0.025, -0.05], [0, 0.055]]) {
    assert.ok(gripContact(dist, axial, VIAL, CONTACT, true) >= 0.9, `distance ${dist}, along ${axial}`);
  }
});

test('over the end of a tool the hand holds less and less, a pinch does not care about the ends', () => {
  const at = (axial) => gripContact(0, axial, VIAL, CONTACT, true);
  assert.ok(at(0.065) < at(0.055) && at(0.075) < at(0.065));
  assert.ok(at(0.055 + 0.035) < 1e-9, 'a palm a palm-reach beyond the end holds nothing');
  assert.ok(gripContact(0, 0.08, VIAL, CONTACT, false) > 0.9);
});

test('the grip strength is relative to how far the fingers closed around the tool', () => {
  assert.equal(holdStrength(0.75, 0.75, 0.3), 1, 'as closed as at the grab: a full hold');
  assert.equal(holdStrength(1, 0.75, 0.3), 1, 'closing further does not hold more');
  assert.ok(Math.abs(holdStrength(0.525, 0.75, 0.3) - 0.5) < 1e-9, 'half way to the weakest hold');
  assert.equal(holdStrength(0.2, 0.75, 0.3), 0);
  assert.equal(holdStrength(0.5, 0.3, 0.3), 1, 'no divide by zero when grabbed at the floor');
});

test('a hold crushes a fragile tool only when it is far too hard for long enough, and starts over when it eases', () => {
  const meter = createCrushMeter(0.2);
  let crushed = false;
  for (let i = 0; i < 10; i++) crushed = meter.update(false, 0.05) || crushed;
  assert.equal(crushed, false, 'a firm but sane hold never crushes');
  assert.equal(meter.update(true, 0.1), false);
  assert.equal(meter.update(false, 0.05), false, 'eased: starts over');
  assert.equal(meter.update(true, 0.1), false);
  assert.equal(meter.update(true, 0.1), true, 'too hard for 0.2 s');
  assert.equal(meter.update(true, 0.1), false, 'fires once');
});
