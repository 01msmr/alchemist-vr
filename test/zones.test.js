import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearance } from '../src/game/zones.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('with no zones every point is clear', () => {
  const c = clearance([], 0, 0);
  assert.equal(c.margin, Infinity);
  assert.equal(c.zone, null);
});

test('a point outside a circle is clear by the distance to its border, inside it is short by the way out', () => {
  const zones = [{ x: 0, z: 0, r: 0.1 }];
  const out = clearance(zones, 0.15, 0);
  assert.ok(near(out.margin, 0.05) && near(out.dx, 1) && near(out.dz, 0));
  const inside = clearance(zones, 0, 0.06);
  assert.ok(near(inside.margin, -0.04), `${inside.margin}`);
  assert.ok(near(inside.dz, 1), 'move away from the middle');
});

test('a rectangle: outside beside it, outside at a corner, inside near a side', () => {
  const zones = [{ x: 0, z: 0, hx: 0.1, hz: 0.05 }];
  assert.ok(near(clearance(zones, 0.14, 0).margin, 0.04));
  const corner = clearance(zones, 0.13, 0.09);
  assert.ok(near(corner.margin, 0.05), `${corner.margin}`);
  assert.ok(corner.dx > 0 && corner.dz > 0);
  const inside = clearance(zones, 0.09, 0);
  assert.ok(near(inside.margin, -0.01), 'the right side is the nearest way out');
  assert.ok(near(inside.dx, 1) && near(inside.dz, 0));
  const top = clearance(zones, 0, -0.03);
  assert.ok(near(top.margin, -0.02) && near(top.dz, -1));
});

test('the nearest of several zones counts', () => {
  const zones = [{ x: 0, z: 0, r: 0.05 }, { x: 0.3, z: 0, r: 0.05 }];
  const c = clearance(zones, 0.22, 0);
  assert.equal(c.zone, zones[1]);
  assert.ok(near(c.margin, 0.03));
});

test('moving the missing distance in the given direction gets a blocked point clear', () => {
  const zones = [{ x: 0, z: 0, r: 0.12 }, { x: 0.2, z: 0.1, hx: 0.06, hz: 0.04 }];
  for (const [px, pz] of [[0.05, 0.02], [0.18, 0.09], [0.1, 0.1]]) {
    const c = clearance(zones, px, pz);
    if (c.margin >= 0) continue;
    const after = clearance(zones, px + c.dx * (-c.margin + 1e-6), pz + c.dz * (-c.margin + 1e-6));
    assert.ok(after.margin >= -1e-6, `${px},${pz}: ${after.margin}`);
  }
});
