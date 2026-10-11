import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTriggerLog } from '../src/triggertest.js';

test('an analog trigger gives many values and small jumps', () => {
  const log = createTriggerLog();
  for (let i = 0; i <= 20; i++) log.record('t', i / 20);
  assert.match(log.summary('t', 'T'), /n21 0\.00-1\.00 jump0\.05$/);
});

test('an on/off trigger is flagged', () => {
  const log = createTriggerLog();
  for (const v of [0, 0, 1, 1, 0, 1]) log.record('t', v);
  assert.match(log.summary('t', 'T'), /n2 .*jump1\.00 ON\/OFF\?/);
});

test('the line shows a bar and keeps only the latest history', () => {
  const log = createTriggerLog(5);
  for (let i = 0; i < 20; i++) log.record('t', i < 19 ? 0 : 0.5);
  const line = log.line('t', 'L');
  assert.match(line, /^L 0\.50 \[#####-----\] /);
  assert.equal(line.split('] ')[1].length, 5);
  assert.equal(log.line('x', 'R'), 'R -');
});

test('lines() reports hands without a controller and reads the gamepad buttons', () => {
  const log = createTriggerLog();
  const hands = [
    { handedness: 'left', mode: 'tracked', gamepad: null },
    { handedness: 'right', mode: 'controller', gamepad: { buttons: [{ value: 0.4 }, { value: 0.9 }] } },
  ];
  const lines = log.lines(hands);
  assert.match(lines[0], /^L: no controller/);
  assert.match(lines[1], /^R trigger 0\.40/);
  assert.match(lines[2], /^R grip\s+0\.90/);
});
