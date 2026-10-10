import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from '../src/physics.js';
import { PHYSICS, TOOLS } from '../src/config/index.js';

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
  return PHYSICS.grip[mode].lose;
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

test('the floor can be moved: an unbreakable tool off the table lands on the new floor', () => {
  const { physics } = make();
  const nugget = physics.addTool(TOOLS.nugget);
  physics.setFloorY(-1.2);
  nugget.spawn({ x: 1.5, y: 0.1, z: 0 }); // past the table's edge
  run(physics, 3);
  assert.ok(Math.abs(nugget.body.position.y - (-1.2 + TOOLS.nugget.half.y)) < 0.01, `at ${nugget.body.position.y}`);
  physics.setFloorY(-0.5);
  nugget.spawn({ x: 1.5, y: 0.1, z: 0 });
  run(physics, 3);
  assert.ok(Math.abs(nugget.body.position.y - (-0.5 + TOOLS.nugget.half.y)) < 0.01, 'and on the next one');
});

// ---- how steady a fist holds the vial under tracking noise ----
import { createVecFilter, createQuatFilter } from '../src/filters.js';
import { INPUT } from '../src/config/index.js';

const noise = (i, k = 1) => Math.sin(i * 12.9898 * k) * 0.5 + Math.sin(i * 78.233 * k + 1.3) * 0.5;
const quatOf = (angle, axis) => {
  const n = Math.hypot(...axis);
  const s = Math.sin(angle / 2) / n;
  return { x: axis[0] * s, y: axis[1] * s, z: axis[2] * s, w: Math.cos(angle / 2) };
};
const std = (values) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
};

// A fist holds the vial for `seconds` while the hand's pose jitters like tracked joints do. `filtered` runs the target
// through the same filters the game uses. Returns how much the vial shook and whether the hold survived.
function holdWithTrackingNoise({ filtered, seconds = 4, posNoise = 0.004, rotNoise = 0.05, contact = 1, moveAt = null }) {
  const { physics } = make();
  const vial = physics.tool;
  const f = INPUT.filter.fist;
  const pos = createVecFilter(f.pos);
  const rot = createQuatFilter(f.rot);
  const center = { x: 0.4, y: 0.4, z: 0 };
  vial.spawn(center);
  vial.startGrip('fist', center, contact);
  const dt = 1 / 72;
  const xs = [];
  const ys = [];
  const tilt = [];
  let lost = false;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    const shift = moveAt !== null && i * dt >= moveAt ? Math.min(0.2, (i * dt - moveAt) * 0.4) : 0; // a deliberate move of 20 cm
    let p = { x: center.x + shift + posNoise * noise(i), y: center.y + posNoise * noise(i, 2), z: center.z + posNoise * noise(i, 3) };
    let q = quatOf(rotNoise * noise(i, 4), [noise(i, 5) + 2, noise(i, 6), noise(i, 7)]);
    if (filtered) {
      p = pos.filter(p, dt);
      q = rot.filter(q, dt);
    }
    vial.setGrip(p, { x: 0, y: 0, z: 0 }, q, 1);
    physics.step(dt);
    if (vial.gripSeparation() > PHYSICS.grip.fist.lose) lost = true;
    if (i * dt > seconds / 2) {
      xs.push(vial.body.position.x);
      ys.push(vial.body.position.y);
      const up = vial.body.quaternion.vmult(new vial.body.position.constructor(0, 1, 0));
      tilt.push(Math.acos(Math.min(1, up.y)));
    }
  }
  return { shake: Math.hypot(std(xs), std(ys)), tiltShake: std(tilt), lost, x: vial.body.position.x };
}

test('a fist holds the vial steadier with the filtered target than with the raw one', () => {
  const raw = holdWithTrackingNoise({ filtered: false });
  const smooth = holdWithTrackingNoise({ filtered: true });
  assert.equal(smooth.lost, false);
  assert.ok(smooth.shake < raw.shake * 0.7, `position shake ${raw.shake.toFixed(5)} -> ${smooth.shake.toFixed(5)}`);
  assert.ok(smooth.tiltShake < raw.tiltShake * 0.7, `tilt shake ${raw.tiltShake.toFixed(4)} -> ${smooth.tiltShake.toFixed(4)}`);
});

test('the filtered fist still follows a deliberate move of the hand', () => {
  const r = holdWithTrackingNoise({ filtered: true, seconds: 4, moveAt: 1 });
  assert.equal(r.lost, false);
  assert.ok(Math.abs(r.x - 0.6) < 0.02, `ended at x=${r.x.toFixed(3)}, the hand is at 0.6`);
});

// the hand moves the vial by (dx, dy) over `seconds`, eased, through the filter; returns the largest the grip stretched
function moveWithHand(dx, dy, seconds) {
  const { physics } = make();
  const vial = physics.tool;
  const f = INPUT.filter.fist;
  const pos = createVecFilter(f.pos);
  const rot = createQuatFilter(f.rot);
  const center = { x: 0.4, y: 0.4, z: 0 };
  vial.spawn(center);
  vial.startGrip('fist', center, 1);
  const dt = 1 / 72;
  const vel = { x: 0, y: 0, z: 0 };
  let prev = null;
  let max = 0;
  for (let i = 0; i < Math.round(3 / dt); i++) {
    const t = i * dt;
    const k = Math.min(1, Math.max(0, (t - 0.5) / seconds));
    const ease = k * k * (3 - 2 * k);
    const p = pos.filter({ x: center.x + dx * ease, y: center.y + dy * ease, z: center.z }, dt);
    if (prev) for (const a of ['x', 'y', 'z']) vel[a] += ((p[a] - prev[a]) / dt - vel[a]) * INPUT.motion.smoothing;
    prev = p;
    vial.setGrip(p, vel, rot.filter({ x: 0, y: 0, z: 0, w: 1 }, dt), 1);
    physics.step(dt);
    max = Math.max(max, vial.gripSeparation());
  }
  return max;
}

test('a brisk move or lift does not make a firm fist let go', () => {
  assert.ok(moveWithHand(0.4, 0, 0.3) < PHYSICS.grip.fist.lose, 'a 40 cm swing in 0.3 s');
  assert.ok(moveWithHand(0, 0.3, 0.25) < PHYSICS.grip.fist.lose, 'a 30 cm lift in 0.25 s');
});

test('a very fast flick is more than a grip can accelerate: the vial is let go', () => {
  assert.ok(moveWithHand(0.4, 0, 0.12) > PHYSICS.grip.fist.lose);
});

test('a half grab still slips even with the smoothing (the filters only calm noise)', () => {
  const r = holdWithTrackingNoise({ filtered: true, contact: 0.3, posNoise: 0, rotNoise: 0, seconds: 2 });
  assert.equal(r.lost, true);
});

// The hand turns about the horizontal axis through the gripped point; returns how far (degrees) the vial really tilts.
function tiltWithHand(mode, dy, contact, targetDeg) {
  const { physics } = make();
  physics.vial.position.set(0.2, 0.3, 0);
  physics.vial.velocity.set(0, 0, 0);
  const anchor = { x: 0.2, y: 0.3 + dy, z: 0 }; // dy above the vial's center
  physics.startGrip(mode, anchor, contact);
  const dt = 1 / 72;
  const zero = { x: 0, y: 0, z: 0 };
  for (let t = 0; t < 2.5; t += dt) {
    const a = (Math.min(1, t / 0.5) * targetDeg * Math.PI) / 180;
    physics.setGrip(anchor, zero, { x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) }, 1);
    physics.step(dt);
  }
  const v = physics.vial.quaternion.vmult(new physics.vial.position.constructor(0, 1, 0));
  return Math.abs((Math.atan2(v.x, v.y) * 180) / Math.PI);
}

test('a vial held at one point follows the turn of the hand instead of hanging from that point', () => {
  for (const dy of [0, 0.03, -0.03, 0.045]) {
    const tilt = tiltWithHand('pinch', dy, 1, 70);
    assert.ok(Math.abs(tilt - 70) < 8, `pinched ${dy * 100} cm from the center: ${tilt.toFixed(0)} degrees instead of 70`);
  }
  assert.ok(Math.abs(tiltWithHand('fist', 0, 1, 70) - 70) < 5, 'a fist');
});

test('the whole hand holds the turn better than two fingers; a weak pinch lets the vial hang', () => {
  const error = (mode, contact) => Math.abs(tiltWithHand(mode, 0.045, contact, 70) - 70);
  assert.ok(error('fist', 0.15) < 8, 'a fist with a weak hold still follows');
  assert.ok(error('pinch', 0.15) > 15, 'a pinch with the same hold hangs');
  assert.ok(error('fist', 1) <= error('pinch', 1), 'at full strength the fist is at least as steady');
});
