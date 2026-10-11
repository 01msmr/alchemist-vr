import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, takeMatch, strikeMatch, strokeMatch, lightCandle, snuffCandle, dropMatch, takeNugget } from '../src/game/sim.js';
import { CFG } from '../src/config/index.js';

const DT = 0.05;
function run(s, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += DT) step(s, DT);
}

test('the candle heats only after a lit match lights it', () => {
  const s = createState();
  run(s, 2);
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
  run(s, 1);
  assert.ok(Math.abs(s.crucible.temp - CFG.HEAT_RATE) < 0.01, 'one second of flame heats by the heat rate');

  snuffCandle(s);
  const t = s.crucible.temp;
  run(s, 1);
  assert.ok(s.crucible.temp < t);
});

test('a lit match burns out and a dropped match is gone', () => {
  const s = createState();
  takeMatch(s);
  strikeMatch(s);
  run(s, CFG.MATCH_BURN + 0.2);
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

test('a match lights only with a fast stroke along the striker', () => {
  const s = createState();
  takeMatch(s);
  assert.equal(strokeMatch(s, true, CFG.STRIKE_SPEED * 0.5, 0.05), null, 'slow scraping does nothing');
  assert.equal(s.match.lit, 0);
  assert.equal(strokeMatch(s, false, 2, 0.05), null, 'off the striker does nothing');
  assert.equal(strokeMatch(s, true, 2, 0.015), null, 'short so far');
  assert.equal(strokeMatch(s, true, CFG.STRIKE_SPEED * 0.5, 0.015), null, 'slowing down resets the stroke');
  assert.equal(s.match.stroke, 0);
  assert.equal(strokeMatch(s, true, 2, 0.02), null);
  assert.equal(strokeMatch(s, true, 2, 0.02), 'lit');
  assert.equal(s.match.lit, CFG.MATCH_BURN);
});

test('a stroke that is far too fast snaps the match head off for good', () => {
  const s = createState();
  takeMatch(s);
  assert.equal(strokeMatch(s, true, CFG.STRIKE_MAX + 1, 0.02), 'broken');
  assert.equal(s.match.broken, true);
  assert.equal(strokeMatch(s, true, 2, 0.1), null);
  strikeMatch(s);
  assert.equal(s.match.lit, 0);
});

test('the finished gold can be taken out once', () => {
  const s = createState();
  assert.equal(takeNugget(s), null);
  Object.assign(s.crucible, { content: 'gold', quality: 0.9, amounts: { sulfur: 0.5 } });
  assert.deepEqual(takeNugget(s), { kind: 'gold', quality: 0.9 });
  assert.equal(s.crucible.content, 'empty');
  assert.deepEqual(s.crucible.amounts, {});
  assert.equal(takeNugget(s), null);
});
