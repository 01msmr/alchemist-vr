import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, breakVial } from '../src/game/sim.js';
import { pour, pourStartAngle } from '../src/game/pouring.js';
import { CFG } from '../src/config/index.js';

const deg = (d) => (d * Math.PI) / 180;

test('a full vial starts pouring at a smaller angle than a half or nearly empty one', () => {
  const full = pourStartAngle(CFG.VIAL_CAPACITY);
  const half = pourStartAngle(CFG.VIAL_CAPACITY / 2);
  const low = pourStartAngle(0.05);
  assert.ok(full < half && half < low);
  assert.ok(full >= deg(CFG.POUR_ANGLE_MIN_DEG) && low <= deg(CFG.POUR_ANGLE_MAX_DEG));
  const empty = Math.atan2(CFG.VIAL_HEIGHT, CFG.VIAL_INNER_DIAMETER);
  assert.equal(pourStartAngle(0), Math.min(deg(CFG.POUR_ANGLE_MAX_DEG), empty));
});

test('no pouring below the start angle', () => {
  const s = createState();
  assert.equal(pour(s, 1, pourStartAngle(s.vial.fill) - 0.01), 0);
  assert.equal(s.flow, 0);
  assert.equal(s.vial.fill, CFG.VIAL_CAPACITY);
});

test('the flow has inertia: builds up slowly, keeps running briefly after righting the vial', () => {
  const s = createState();
  const tilted = deg(170); // far past the start angle even as the vial drains
  pour(s, 0.05, tilted);
  assert.ok(s.flow > 0 && s.flow < CFG.POUR_MAX_RATE * 0.5, 'not at full flow after one step');
  for (let t = 0; t < 2; t += 0.05) pour(s, 0.05, tilted);
  assert.ok(Math.abs(s.flow - CFG.POUR_MAX_RATE) < 0.01, 'reaches full flow');
  const amount = pour(s, 0.05, 0); // vial righted
  assert.ok(amount > 0 && s.flow > 0, 'still flows right after righting');
  for (let t = 0; t < 1; t += 0.05) pour(s, 0.05, 0);
  assert.equal(s.flow, 0, 'stops after a moment');
});

test('pouring conserves mercury and empties the vial', () => {
  const s = createState();
  let poured = 0;
  for (let i = 0; i < 400; i++) poured += pour(s, 0.05, Math.PI * 0.9);
  assert.ok(Math.abs(poured - CFG.VIAL_CAPACITY) < 1e-9);
  assert.equal(s.vial.fill, 0);
  assert.equal(s.flow, 0);
});

test('a broken vial hands its mercury to the caller and stops pouring', () => {
  const s = createState();
  assert.equal(breakVial(s), CFG.VIAL_CAPACITY);
  assert.equal(s.vial.fill, 0);
  assert.equal(s.vialBroken, true);
  assert.equal(pour(s, 1, Math.PI), 0);
});
