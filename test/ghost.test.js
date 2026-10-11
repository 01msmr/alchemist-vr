import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG, DIFFICULTY } from '../src/config/index.js';
import { useDifficulty } from '../src/game/rules.js';
import { createGhost, stepGhost } from '../src/game/ghost.js';
import { createFinale, stepFinale } from '../src/game/finale.js';

const idle = { burning: false, ringClosed: false, bait: null, vialOver: false };
const run = (g, seconds, input, dt = 0.1) => { for (let t = 0; t < seconds; t += dt) stepGhost(g, dt, input); return g; };

test('burning herbs make smoke, enough smoke shows the ghost, without smoke it leaves', () => {
  const g = createGhost();
  run(g, 1, { ...idle, burning: true });
  assert.equal(g.phase, 'hidden');
  run(g, 2, { ...idle, burning: true });
  assert.equal(g.phase, 'visible');
  run(g, 15, idle);
  assert.equal(g.phase, 'hidden');
  assert.equal(g.smoke, 0);
});

test('real gold in a closed ring lures the ghost, the inverted vial catches it', () => {
  const g = createGhost();
  run(g, 3, { ...idle, burning: true });
  run(g, 0.5, { ...idle, burning: true, ringClosed: true, bait: 'gold' });
  assert.equal(g.phase, 'lured');
  run(g, 1, { ...idle, burning: true, ringClosed: true, bait: 'gold', vialOver: true });
  assert.equal(g.phase, 'lured', 'not yet: the vial must stay');
  run(g, 1, { ...idle, burning: true, ringClosed: true, bait: 'gold', vialOver: true });
  assert.equal(g.phase, 'trapped');
  run(g, 20, idle);
  assert.equal(g.phase, 'trapped', 'a trapped ghost stays');
});

test('lifting the vial early loses progress; an open ring or no gold does not lure', () => {
  const g = createGhost();
  const lure = { ...idle, burning: true, ringClosed: true, bait: 'dull' };
  run(g, 3, { ...idle, burning: true });
  run(g, 0.5, lure);
  run(g, 1.0, { ...lure, vialOver: true });
  run(g, 1.0, lure); // the vial is off again
  assert.equal(g.trap, 0);
  const h = createGhost();
  run(h, 3, { ...idle, burning: true });
  run(h, 2, { ...idle, burning: true, ringClosed: false, bait: 'gold' });
  assert.equal(h.phase, 'visible');
  run(h, 2, { ...idle, burning: true, ringClosed: true, bait: null });
  assert.equal(h.phase, 'visible');
});

test('fool\'s gold does not lure the ghost, it laughs', () => {
  const g = createGhost();
  run(g, 3, { ...idle, burning: true });
  run(g, 2, { ...idle, burning: true, ringClosed: true, bait: 'fools' });
  assert.equal(g.phase, 'visible');
  assert.equal(g.mocked, true);
});

test('a ghost that loses its smoke while lured goes back to hiding', () => {
  const g = createGhost();
  run(g, 3, { ...idle, burning: true });
  run(g, 0.3, { ...idle, burning: true, ringClosed: true, bait: 'gold' });
  assert.equal(g.phase, 'lured');
  run(g, 10, { ...idle, ringClosed: true, bait: 'gold' });
  assert.equal(g.phase, 'hidden');
});

test('the difficulty changes how long the catch takes', () => {
  const seconds = (name) => {
    useDifficulty(name);
    const g = createGhost();
    run(g, 5, { ...idle, burning: true });
    run(g, 0.2, { ...idle, burning: true, ringClosed: true, bait: 'gold' });
    let t = 0;
    while (g.phase !== 'trapped' && t < 10) { stepGhost(g, 0.05, { ...idle, burning: true, ringClosed: true, bait: 'gold', vialOver: true }); t += 0.05; }
    return t;
  };
  try {
    assert.ok(seconds('easy') < seconds('normal') && seconds('normal') < seconds('hard'));
    assert.ok(Math.abs(seconds('hard') - DIFFICULTY.hard.TRAP_HOLD) < 0.1);
  } finally {
    useDifficulty('normal');
  }
});

// ---- the cat ----
const trapped = 'trapped';
const play = (f, seconds, input, phase = trapped, dt = 0.1) => { for (let t = 0; t < seconds; t += dt) stepFinale(f, phase, dt, input); return f; };

test('nothing happens to the cat before the ghost is caught', () => {
  const f = createFinale();
  play(f, 5, { eyes: 'gold', opened: true }, 'visible');
  assert.equal(f.eyes, null);
});

test('the cat needs eyes first, then the open vial, then it wakes and runs to the cushion', () => {
  const f = createFinale();
  play(f, 3, { eyes: null, opened: true });
  assert.equal(f.released, false, 'no eyes: the ghost has nowhere to go');
  play(f, 0.2, { eyes: 'gold', opened: false });
  assert.equal(f.eyes, 'gold');
  play(f, 0.5, { eyes: 'gold', opened: true });
  assert.equal(f.released, true);
  assert.equal(f.alive, false);
  play(f, CFG.WAKE_TIME, { eyes: 'gold', opened: false });
  assert.equal(f.alive, true);
  play(f, CFG.RUN_TIME + 1, { eyes: 'gold', opened: false });
  assert.equal(f.done, true);
  assert.equal(f.run, 1);
});

test('the first eyes stay: other gold later does not replace them', () => {
  const f = createFinale();
  play(f, 0.2, { eyes: 'fools', opened: false });
  play(f, 0.2, { eyes: 'gold', opened: false });
  assert.equal(f.eyes, 'fools');
});
