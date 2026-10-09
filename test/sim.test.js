import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, amalgamQuality, takeMatch, strikeMatch, lightCandle, snuffCandle, dropMatch } from '../src/game/sim.js';
import { CFG } from '../src/game/config.js';
import { tiltDirection, vialLip, tiltOf, distanceToSegment, VIAL_HALF } from '../src/game/geometry.js';
import { crucibleContents, crucibleModel, standModel, vialModel, vialLayers, matchboxModel } from '../src/assets.js';

const DT = 0.05;
function run(s, seconds, input) {
  for (let t = 0; t < seconds - 1e-9; t += DT) step(s, DT, input);
}
const idle = { tilt: 0, overCrucible: false };
const total = (s) => s.vial.fill + s.inflight + s.crucible.mercury + s.wasted;

test('cold lead refuses mercury: it is wasted', () => {
  const s = createState();
  run(s, 2, { ...idle, tilt: 1, overCrucible: true });
  run(s, 1, idle);
  assert.equal(s.crucible.mercury, 0);
  assert.ok(s.wasted > 0.5);
  assert.equal(s.crucible.content, 'lead');
});

test('mercury is conserved and lags behind the tilt', () => {
  const s = createState();
  s.crucible.temp = 0.7;
  run(s, 1, { ...idle, tilt: 1, overCrucible: true });
  const atStop = s.crucible.mercury;
  run(s, 0.2, idle);
  assert.ok(s.crucible.mercury > atStop, 'stream keeps landing after the tilt stops');
  assert.ok(Math.abs(total(s) - CFG.VIAL_CAPACITY) < 1e-9);
});

test('dose in window on liquid lead becomes amalgam after the hold', () => {
  const s = createState();
  Object.assign(s.crucible, { temp: 0.7, mercury: 1.0 });
  run(s, CFG.AMALGAM_HOLD - 0.2, idle);
  assert.equal(s.crucible.content, 'lead');
  run(s, 0.4, idle);
  assert.equal(s.crucible.content, 'amalgam');
  assert.ok(s.crucible.quality > 0.7 && s.crucible.quality <= 1);
});

test('too much mercury makes sludge immediately', () => {
  const s = createState();
  Object.assign(s.crucible, { temp: 0.7, mercury: 1.3 });
  run(s, DT, idle);
  assert.equal(s.crucible.content, 'sludge');
});

test('lead cooling below melt mid-hold resets the progress', () => {
  const s = createState();
  Object.assign(s.crucible, { temp: 0.52, mercury: 1.0 });
  run(s, 1, idle);
  assert.equal(s.crucible.content, 'lead');
  assert.equal(s.progress.amalgam, 0);
});

test('overheating burns the lead', () => {
  const s = createState();
  s.crucible.temp = 0.95;
  s.candleLit = true;
  run(s, CFG.BURN_HOLD + 0.2, idle);
  assert.equal(s.crucible.content, 'burnt');
});

test('quality peaks at the middle of dose and heat windows', () => {
  const best = amalgamQuality({ mercury: 1.0, temp: (CFG.MELT + CFG.BURN) / 2 });
  assert.ok(Math.abs(best - 1) < 1e-9);
  assert.ok(amalgamQuality({ mercury: 1.14, temp: 0.52 }) < 0.3);
});

test('lip geometry and tilt from the up vector', () => {
  const pos = { x: 0, y: 0.2, z: 0 };
  assert.deepEqual(tiltDirection({ x: 0, z: 0 }, { x: 0, z: 0 }), { x: 1, z: 0 });
  const upright = vialLip(pos, { x: 0, y: 1, z: 0 });
  assert.ok(Math.abs(upright.y - (0.2 + VIAL_HALF)) < 1e-12 && upright.x === 0);
  const sideways = vialLip(pos, { x: 1, y: 0, z: 0 });
  assert.ok(Math.abs(sideways.x - VIAL_HALF) < 1e-12 && Math.abs(sideways.y - 0.2) < 1e-12);
  const max = Math.PI * 110 / 180;
  assert.equal(tiltOf({ x: 0, y: 1, z: 0 }, max), 0);
  assert.equal(tiltOf({ x: 0, y: -1, z: 0 }, max), 1);
  assert.ok(Math.abs(tiltOf({ x: Math.sin(max / 2), y: Math.cos(max / 2), z: 0 }, max) - 0.5) < 1e-9);
});

test('distance to a segment', () => {
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 0, y: 1, z: 0 };
  assert.equal(distanceToSegment({ x: 0.03, y: 0.5, z: 0 }, a, b), 0.03);
  assert.equal(distanceToSegment({ x: 0, y: 2, z: 0 }, a, b), 1);
  assert.equal(distanceToSegment({ x: 1, y: 1, z: 1 }, a, a), Math.hypot(1, 1, 1));
});

test('placeholder models are non-empty and contents match state', () => {
  const count = (o) => o.data.filter(Boolean).length;
  assert.ok(count(vialModel(vialLayers(1.5))) > count(vialModel(0)) - 1);
  assert.ok(count(standModel(2)) > count(standModel(-1)));
  const empty = count(crucibleModel([]));
  const s = createState();
  assert.ok(count(crucibleModel(crucibleContents(s.crucible))) > empty);
});

test('the candle heats only after a lit match lights it', () => {
  const s = createState();
  run(s, 2, idle);
  assert.equal(s.crucible.temp, 0);

  lightCandle(s); // no match in hand
  assert.equal(s.candleLit, false);

  assert.ok(takeMatch(s));
  assert.equal(s.matches, CFG.MATCHES - 1);
  assert.equal(takeMatch(s), false, 'only one match in hand');
  lightCandle(s); // unlit match
  assert.equal(s.candleLit, false);

  strikeMatch(s);
  lightCandle(s);
  assert.equal(s.candleLit, true);
  run(s, 1, idle);
  assert.ok(s.crucible.temp > 0.09);

  snuffCandle(s);
  const t = s.crucible.temp;
  run(s, 1, idle);
  assert.ok(s.crucible.temp < t);
});

test('a lit match burns out and a dropped match is gone', () => {
  const s = createState();
  takeMatch(s);
  strikeMatch(s);
  run(s, CFG.MATCH_BURN + 0.2, idle);
  assert.equal(s.match, null);
  assert.equal(s.matches, CFG.MATCHES - 1);

  takeMatch(s);
  dropMatch(s);
  assert.equal(s.match, null);
  assert.equal(s.matches, CFG.MATCHES - 2);
});

test('the match supply runs out', () => {
  const s = createState();
  for (let i = 0; i < CFG.MATCHES; i++) {
    assert.ok(takeMatch(s));
    dropMatch(s);
  }
  assert.equal(takeMatch(s), false);
});

test('matchbox shows one head per match left', () => {
  const heads = (o) => o.data.filter((v) => v === 18).length;
  assert.equal(heads(matchboxModel(3)), 3);
  assert.equal(heads(matchboxModel(0)), 0);
});
