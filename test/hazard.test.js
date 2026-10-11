import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG, HAZARD } from '../src/config/index.js';
import { hazard, failureOf, pulseFor, crackleRate } from '../src/game/hazard.js';
import { rulesFor } from '../src/game/rules.js';
import { createState, step } from '../src/game/sim.js';

const r = rulesFor('normal');
const state = (crucible, progress = {}) => ({ crucible: { content: 'lead', temp: 0, amounts: {}, ...crucible }, progress });

test('a cool crucible is all well', () => {
  assert.deepEqual(hazard(state({ temp: 0.3 }), r), { level: 0, kind: null });
  assert.deepEqual(hazard(state({ temp: r.CRITICAL }), r), { level: 0, kind: null }, 'glowing but not yet in danger');
});

test('the heat warning grows toward the burn temperature, then with the time held there', () => {
  const warm = hazard(state({ temp: (r.CRITICAL + r.BURN) / 2 }), r);
  assert.equal(warm.kind, 'heat');
  assert.ok(Math.abs(warm.level - 0.25) < 1e-9);
  const atBurn = hazard(state({ temp: r.BURN }, { burn: 0 }), r);
  assert.ok(Math.abs(atBurn.level - 0.5) < 1e-9);
  const long = hazard(state({ temp: r.BURN }, { burn: r.BURN_HOLD / 2 }), r);
  assert.ok(Math.abs(long.level - 0.75) < 1e-9);
  assert.equal(hazard(state({ content: 'amalgam', temp: r.BURN }, { burn2: r.BURN_HOLD }), r).level, 1);
});

test('right conditions without stirring become a lump warning', () => {
  const h = hazard(state({ content: 'amalgam', temp: 0.6 }, { lumps: r.LUMP_HOLD / 2 }), r);
  assert.equal(h.kind, 'lump');
  assert.ok(Math.abs(h.level - 0.65) < 1e-9);
  assert.equal(hazard(state({ content: 'amalgam', temp: 0.6 }, { lumps: 0 }), r).level, 0);
});

test('a finished or failed crucible shows no hazard, only its outcome counts', () => {
  assert.equal(hazard(state({ content: 'burnt', temp: 1 }, { burn: 5 }), r).level, 0);
  for (const content of ['sludge', 'burnt', 'slag', 'fools', 'dull']) assert.equal(failureOf(content), content);
  for (const content of ['lead', 'amalgam', 'gold', 'empty']) assert.equal(failureOf(content), null);
});

test('the controller pulses and the crackle begin at the threshold and get faster and stronger', () => {
  assert.equal(pulseFor(HAZARD.warnFrom - 0.01), null);
  assert.equal(crackleRate(HAZARD.warnFrom - 0.01), 0);
  const low = pulseFor(HAZARD.warnFrom + 0.01);
  const high = pulseFor(1);
  assert.ok(high.gap < low.gap && high.strength > low.strength);
  assert.ok(high.strength <= 1 && low.strength > 0);
  assert.ok(crackleRate(1) > crackleRate(0.5) && crackleRate(0.5) > 0);
});

test('real play: heating lead past the burn temperature raises the hazard until it burns, which is a failure', () => {
  const s = createState();
  s.candleLit = true;
  const levels = [];
  for (let i = 0; i < 4000 && s.crucible.content === 'lead'; i++) {
    step(s, 0.05);
    levels.push(hazard(s, r).level);
  }
  assert.equal(failureOf(s.crucible.content), 'burnt');
  assert.ok(Math.max(...levels) > 0.9, 'the hazard got high before it burnt');
  const rising = levels.slice(0, -1); // (the last one is after it burnt: no hazard left)
  assert.ok(rising.every((v, i, a) => i === 0 || v >= a[i - 1] - 1e-9), 'and only rose while heating');
  assert.ok(CFG.BURN > CFG.CRITICAL);
});
