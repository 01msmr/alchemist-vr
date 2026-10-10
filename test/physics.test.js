import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics, GRIP } from '../src/physics.js';
import { TOOLS } from '../src/tools.js';

const REST = { x: 0.22, y: TOOLS.vial.half.y, z: 0.08 };

function make(extra = {}) {
  const events = { breaks: [], gone: [] };
  const physics = createPhysics({
    table: { minX: -1, maxX: 1, minZ: -0.7, maxZ: 0.3 },
    floorY: -0.85,
    stack: { x: 0, z: 0, h: 0.14, halfW: 0.045, baseH: 0.07, innerHalf: 0.033 },
    matchbox: { x: -0.18, y: 0.015, z: 0.07, hx: 0.03, hy: 0.015, hz: 0.02 },
    onDebrisGone: (entry) => events.gone.push(entry),
    ...extra,
  });
  const vial = physics.addTool(TOOLS.vial, { onBreak: (pos, vel) => events.breaks.push({ pos, vel }) });
  vial.spawn(REST);
  // the old tests talk to the vial directly
  physics.vial = vial.body;
  physics.hold = () => vial.hold();
  physics.setPose = (p, q) => vial.setPose(p, q);
  physics.release = (l, a) => vial.release(l, a);
  physics.startGrip = (m, a, c) => vial.startGrip(m, a, c);
  physics.setGrip = (p, v, q, st) => vial.setGrip(p, v, q, st);
  physics.endGrip = () => vial.endGrip();
  physics.isGripped = () => vial.isGripped();
  physics.gripSeparation = () => vial.gripSeparation();
  physics.isAlive = () => vial.isAlive();
  physics.tool = vial;
  return { physics, events };
}
const run = (physics, seconds) => { for (let t = 0; t < seconds; t += 1 / 72) physics.step(1 / 72); };
const up = (body) => {
  const v = body.quaternion.vmult(new body.position.constructor(0, 1, 0));
  return v.y;
};
const speed = (body) => body.velocity.length();

test('a vial standing on the table stays put and does not break', () => {
  const { physics, events } = make();
  run(physics, 3);
  assert.equal(events.breaks.length, 0);
  assert.ok(physics.isAlive());
  assert.ok(up(physics.vial) > 0.99);
  assert.ok(Math.abs(physics.vial.position.y - TOOLS.vial.half.y) < 0.003);
});

test('set down from a few centimeters it survives and comes to rest', () => {
  const { physics, events } = make();
  physics.vial.position.y = TOOLS.vial.half.y + 0.06;
  run(physics, 3);
  assert.equal(events.breaks.length, 0);
  assert.ok(speed(physics.vial) < 0.05);
});

test('dropped from a meter it breaks, once, and reports the impact', () => {
  const { physics, events } = make();
  physics.vial.position.y = 1;
  run(physics, 2);
  assert.equal(events.breaks.length, 1);
  assert.ok(events.breaks[0].vel.y < -3);
  assert.equal(physics.isAlive(), false);
});

test('thrown tumbling from a low height it lands lying down or standing, not in between', () => {
  const { physics, events } = make();
  physics.vial.position.set(0.3, 0.15, 0.1);
  physics.vial.angularVelocity.set(4, 0, 2);
  run(physics, 4);
  if (events.breaks.length === 0) {
    assert.ok(speed(physics.vial) < 0.05, 'settled');
    const u = Math.abs(up(physics.vial));
    assert.ok(u > 0.95 || u < 0.1, `rests on a face (up=${u.toFixed(2)})`);
  }
});

test('released with the hand velocity it keeps moving', () => {
  const { physics } = make();
  physics.hold();
  physics.setPose({ x: 0.5, y: 0.3, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
  physics.release({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  physics.step(1 / 72);
  assert.ok(physics.vial.velocity.x > 0.9);
  assert.ok(physics.vial.position.x > 0.5);
});

test('a held vial follows the pose exactly and ignores gravity', () => {
  const { physics } = make();
  physics.hold();
  for (let i = 0; i < 60; i++) {
    physics.setPose({ x: 0.1, y: 0.4, z: 0.1 }, { x: 0, y: 0, z: 0, w: 1 });
    physics.step(1 / 72);
  }
  assert.ok(Math.abs(physics.vial.position.y - 0.4) < 1e-9);
});

test('off the table edge it falls to the floor and breaks', () => {
  const { physics, events } = make();
  physics.vial.position.set(1.2, 0.2, 0);
  run(physics, 2);
  assert.equal(events.breaks.length, 1);
});

test('reset brings a broken vial back', () => {
  const { physics, events } = make();
  physics.vial.position.y = 1;
  run(physics, 2);
  assert.equal(physics.isAlive(), false);
  physics.tool.spawn(REST);
  assert.ok(physics.isAlive());
  run(physics, 1);
  assert.equal(events.breaks.length, 1);
});

test('debris falls, rests and expires', () => {
  const { physics, events } = make();
  const entry = physics.addDebris({ x: 0.3, y: 0.3, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0 }, 'match');
  run(physics, 1);
  assert.ok(entry.body.position.y < 0.1);
  run(physics, 5);
  assert.equal(events.gone.length, 1);
  assert.equal(events.gone[0].data, 'match');
});

// a hand holding the vial at a fixed target for a while; returns how it went
function holdFor(physics, { mode, contact, strength, seconds = 1.5, target = { x: 0.4, y: 0.3, z: 0 }, lift = 0 }) {
  physics.vial.position.set(target.x, target.y, target.z);
  physics.vial.velocity.setZero();
  const anchor = { x: target.x, y: target.y, z: target.z };
  physics.startGrip(mode, anchor, contact);
  let y = target.y;
  for (let t = 0; t < seconds; t += 1 / 72) {
    y += lift / 72;
    physics.setGrip({ x: target.x, y, z: target.z }, { x: 0, y: lift, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, strength);
    physics.step(1 / 72);
  }
  return { y, sep: physics.gripSeparation() };
}

test('a firm fist grip carries the vial and keeps it at the hand', () => {
  const { physics } = make();
  const r = holdFor(physics, { mode: 'fist', contact: 1, strength: 1 });
  assert.ok(r.sep < 0.01, `separation ${r.sep}`);
  assert.ok(Math.abs(physics.vial.position.y - 0.3) < 0.01);
});

test('a firm pinch carries the vial too', () => {
  const { physics } = make();
  const r = holdFor(physics, { mode: 'pinch', contact: 1, strength: 1 });
  assert.ok(r.sep < 0.01);
  assert.ok(Math.abs(physics.vial.position.y - 0.3) < 0.01);
});

test('a half grab (small contact) cannot carry the vial: it slips away', () => {
  const { physics } = make();
  const r = holdFor(physics, { mode: 'fist', contact: 0.3, strength: 1, seconds: 1 });
  assert.ok(r.sep > GRIP_LOSE('fist'), `slipped by ${r.sep}`);
});

test('loosening the fingers makes the grip slip', () => {
  const { physics } = make();
  const r = holdFor(physics, { mode: 'pinch', contact: 1, strength: 0.3, seconds: 1 });
  assert.ok(r.sep > GRIP_LOSE('pinch'));
});

test('letting go of a grip drops the vial', () => {
  const { physics } = make();
  holdFor(physics, { mode: 'fist', contact: 1, strength: 1, seconds: 0.5 });
  physics.endGrip();
  assert.equal(physics.isGripped(), false);
  run(physics, 0.3);
  assert.ok(physics.vial.position.y < 0.25);
});

function GRIP_LOSE(mode) {
  return mode === 'fist' ? 0.05 : 0.04;
}

test('a rod dropped over the crucible falls inside it, stirring depth reachable', () => {
  const { physics } = make();
  const rod = physics.addTool(TOOLS.rod);
  rod.spawn({ x: 0, y: 0.3, z: 0 });
  run(physics, 2);
  assert.ok(rod.body.position.y < 0.17, `rod center at ${rod.body.position.y}`);
  assert.ok(Math.abs(rod.body.position.x) < 0.04 && Math.abs(rod.body.position.z) < 0.04);
});

test('a rod gripped by a firm fist is carried and does not break; a nugget can be pinched', () => {
  const { physics, events } = make();
  const rod = physics.addTool(TOOLS.rod);
  rod.spawn({ x: 0.4, y: 0.3, z: 0 });
  rod.startGrip('fist', { x: 0.4, y: 0.3, z: 0 }, 1);
  for (let t = 0; t < 1; t += 1 / 72) {
    rod.setGrip({ x: 0.4, y: 0.3, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, 1);
    physics.step(1 / 72);
  }
  assert.ok(rod.gripSeparation() < 0.01);
  assert.equal(events.breaks.length, 0);

  const nugget = physics.addTool(TOOLS.nugget);
  nugget.spawn({ x: -0.5, y: 0.2, z: 0 });
  nugget.startGrip('pinch', { x: -0.5, y: 0.2, z: 0 }, 1);
  for (let t = 0; t < 1; t += 1 / 72) {
    nugget.setGrip({ x: -0.5, y: 0.2, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, 1);
    physics.step(1 / 72);
  }
  assert.ok(nugget.gripSeparation() < 0.01);
  assert.ok(Math.abs(nugget.body.position.y - 0.2) < 0.01);
});

test('reset takes every tool out of the world', () => {
  const { physics } = make();
  const rod = physics.addTool(TOOLS.rod);
  rod.spawn({ x: 0.4, y: 0.3, z: 0 });
  physics.reset();
  assert.equal(physics.tool.isAlive(), false);
  assert.equal(rod.isAlive(), false);
});
