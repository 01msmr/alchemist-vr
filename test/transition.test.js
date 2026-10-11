import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransition, beginTransition, stepTransition, cancelTransition } from '../src/game/transition.js';

const CFG = { out: 1, card: 2.4, in: 1, cardFade: 0.5 };
const run = (tr, seconds, dt = 0.05) => {
  const frames = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) frames.push(stepTransition(tr, dt, CFG));
  return frames;
};

test('nothing happens while idle', () => {
  const tr = createTransition();
  assert.deepEqual(stepTransition(tr, 1, CFG), { dark: 0, card: 0, swap: false, cardStart: false });
});

test('the picture darkens, the scene swaps once at black, the card shows, then it brightens and ends', () => {
  const tr = createTransition();
  beginTransition(tr);
  const frames = run(tr, 5);
  assert.equal(frames.filter((f) => f.swap).length, 1, 'one swap');
  assert.equal(frames.filter((f) => f.cardStart).length, 1, 'one card');
  const swapAt = frames.findIndex((f) => f.swap);
  assert.ok(frames[swapAt].dark > 0.99, 'the swap happens in the dark');
  assert.ok(frames.slice(0, swapAt).every((f, i, a) => i === 0 || f.dark >= a[i - 1].dark), 'darkening only');
  assert.ok(frames.some((f) => f.card > 0.99), 'the card gets fully visible');
  assert.ok(frames.filter((f) => f.card > 0).every((f) => f.dark === 1), 'only in the dark');
  assert.equal(tr.phase, 'idle');
  assert.equal(frames.at(-1).dark, 0);
});

test('the card fades in and out', () => {
  const tr = createTransition();
  beginTransition(tr);
  const cards = run(tr, 5).map((f) => f.card).filter((c) => c > 0);
  const peak = cards.indexOf(Math.max(...cards));
  assert.ok(cards[0] < 0.2 && cards.at(-1) < 0.2);
  assert.ok(cards.slice(0, peak).every((c, i, a) => i === 0 || c >= a[i - 1]) && cards.slice(peak).every((c, i, a) => i === 0 || c <= a[i - 1]));
});

test('at the start of the game it begins black with the card, and brightens after it', () => {
  const tr = createTransition();
  beginTransition(tr, { startDark: true });
  const first = stepTransition(tr, 0.05, CFG);
  assert.equal(first.dark, 1);
  assert.equal(first.cardStart, true);
  assert.equal(first.swap, false, 'no scene to swap');
  const rest = run(tr, 5);
  assert.equal(rest.filter((f) => f.cardStart).length, 0);
  assert.equal(tr.phase, 'idle');
});

test('a very long frame carries the transition through without skipping the swap', () => {
  const tr = createTransition();
  beginTransition(tr);
  const f = stepTransition(tr, 10, CFG);
  assert.equal(f.swap, true);
  assert.equal(tr.phase, 'idle');
});

test('cancelling stops it at once', () => {
  const tr = createTransition();
  beginTransition(tr);
  run(tr, 0.5);
  cancelTransition(tr);
  assert.deepEqual(stepTransition(tr, 0.1, CFG), { dark: 0, card: 0, swap: false, cardStart: false });
});
