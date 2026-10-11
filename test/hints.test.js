import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHintTimer, stepHintTimer } from '../src/game/hints.js';
import { createState } from '../src/game/sim.js';
import { LEVELS } from '../src/game/levels/index.js';
import { rulesFor } from '../src/game/rules.js';

const hint = (level, s, info = { vialHeld: false }) => LEVELS[level - 1].hint(s, info);
const R = rulesFor('normal');

test('the symbol shows after the delay without progress, and starts again when the step changes', () => {
  const timer = createHintTimer();
  const a = { icon: 'strike', at: 'matchbox' };
  const b = { icon: 'fire', at: 'wick' };
  assert.equal(stepHintTimer(timer, a, 5, 12), false, 'the step starts');
  assert.equal(stepHintTimer(timer, a, 5, 12), false);
  assert.equal(stepHintTimer(timer, a, 5, 12), false, '10 s idle');
  assert.equal(stepHintTimer(timer, a, 5, 12), true, '15 s idle');
  assert.equal(stepHintTimer(timer, b, 0.1, 12), false, 'a new step: the clock starts again');
  assert.equal(stepHintTimer(timer, null, 1, 0), false, 'nothing to show');
});

test('easy shows the symbol at once, hard never', () => {
  const t1 = createHintTimer();
  stepHintTimer(t1, { icon: 'fire', at: 'wick' }, 0, 0);
  assert.equal(stepHintTimer(t1, { icon: 'fire', at: 'wick' }, 0.01, rulesFor('easy').HINT_DELAY), true);
  const t2 = createHintTimer();
  stepHintTimer(t2, { icon: 'fire', at: 'wick' }, 0, 1e9);
  assert.equal(stepHintTimer(t2, { icon: 'fire', at: 'wick' }, 3600, rulesFor('hard').HINT_DELAY), false);
});

test('level 1 points at the next step: match, flame, wait for heat, the vial, the pour, wait', () => {
  const s = createState();
  assert.deepEqual(hint(1, s), { icon: 'strike', at: 'matchbox' });
  s.match = { lit: 5, stroke: 0, broken: false };
  assert.deepEqual(hint(1, s), { icon: 'fire', at: 'wick' });
  s.candleLit = true;
  s.match = null;
  assert.deepEqual(hint(1, s), { icon: 'wait', at: 'crucible' }, 'heating');
  s.crucible.temp = R.MELT + 0.1;
  assert.deepEqual(hint(1, s), { icon: 'vial', at: 'vial' });
  assert.deepEqual(hint(1, s, { vialHeld: true }), { icon: 'pour', at: 'crucible' });
  s.crucible.amounts.hg = (R.DOSE_MIN + R.DOSE_MAX) / 2;
  assert.deepEqual(hint(1, s), { icon: 'wait', at: 'crucible' }, 'hold it');
  s.crucible.content = 'amalgam';
  assert.equal(hint(1, s), null, 'done');
});

test('level 1 gives no symbol for a broken vial', () => {
  const s = createState();
  s.vialBroken = true;
  assert.equal(hint(1, s), null);
});

test('level 2: sulfur from the dish, wait for the heat, stir, take the gold', () => {
  const s = createState();
  s.level = 2;
  s.candleLit = true;
  s.crucible.content = 'amalgam';
  s.crucible.temp = 0.2;
  assert.deepEqual(hint(2, s), { icon: 'spoon', at: 'dish' });
  s.crucible.amounts.sulfur = 0.5;
  assert.deepEqual(hint(2, s), { icon: 'wait', at: 'crucible' });
  s.crucible.temp = R.MELT + 0.1;
  assert.deepEqual(hint(2, s), { icon: 'stir', at: 'crucible' });
  s.crucible.content = 'gold';
  assert.deepEqual(hint(2, s), { icon: 'gem', at: 'crucible' });
  s.nugget = { kind: 'gold', quality: 0.9 };
  assert.equal(hint(2, s), null);
});

test('level 3: match, herbs, smoke, a salt ring, the vial over it, eyes, the open vial', () => {
  const s = createState();
  s.level = 3;
  assert.deepEqual(hint(3, s), { icon: 'strike', at: 'matchbox' });
  s.candleLit = true;
  assert.deepEqual(hint(3, s), { icon: 'herb', at: 'herbs' });
  s.crucible.amounts.herb = 0.3;
  assert.deepEqual(hint(3, s), { icon: 'wait', at: 'crucible' });
  s.ghost.phase = 'visible';
  assert.deepEqual(hint(3, s), { icon: 'ring', at: 'ring' });
  s.ring.closed = true;
  assert.equal(hint(3, s), null, 'the ghost decides next');
  s.ghost.phase = 'lured';
  assert.deepEqual(hint(3, s), { icon: 'vial', at: 'ring' });
  s.ghost.phase = 'trapped';
  assert.deepEqual(hint(3, s), { icon: 'eye', at: 'cat' });
  s.finale.eyes = 'gold';
  assert.deepEqual(hint(3, s), { icon: 'vial', at: 'cat' });
  s.finale.released = true;
  assert.equal(hint(3, s), null);
});

test('fool\'s gold in the ring gives no symbol (the book says what is wrong)', () => {
  const s = createState();
  s.level = 3;
  s.ghost.phase = 'visible';
  s.ghost.mocked = true;
  s.ring.closed = true;
  assert.equal(hint(3, s), null);
});
