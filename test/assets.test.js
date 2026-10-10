import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/game/sim.js';
import { LAYOUT } from '../src/config/index.js';
import { P } from '../src/palette.js';
import { crucibleContents, crucibleModel, standModel, matchModel, matchboxModel, dishModel, rodModel, nuggetModel } from '../src/assets.js';

const count = (o) => o.data.filter(Boolean).length;

test('models are non-empty and the contents match the state', () => {
  assert.ok(count(standModel(2)) > count(standModel(-1)));
  const empty = count(crucibleModel([]));
  const s = createState();
  assert.ok(count(crucibleModel(crucibleContents(s.crucible))) > empty);
});

test('the crucible shows a layer of each substance in it', () => {
  const c = { content: 'amalgam', quality: 0.9, temp: 0.7, amounts: { sulfur: 0.4 } };
  assert.equal(crucibleContents(c).length, 2, 'amalgam and sulfur on top');
  assert.equal(crucibleContents({ ...c, amounts: {} }).length, 1);
  const lead = { content: 'lead', temp: 0.7, amounts: { hg: 1.0 } };
  assert.equal(crucibleContents(lead).length, 2, 'lead and mercury on top');
});

test('matchbox shows one head per match left', () => {
  const heads = (o) => o.data.filter((v) => v === P.MATCH_HEAD).length;
  assert.equal(heads(matchboxModel(0)), 0);
  assert.ok(heads(matchboxModel(1)) > 0);
  assert.ok(heads(matchboxModel(2)) > heads(matchboxModel(1)) && heads(matchboxModel(3)) > heads(matchboxModel(2)), 'one more head per match');
});

// The models are described in cm and sampled on the voxel grid: at any voxel size they are as big as they were drawn.
test('the models keep their physical size at the voxel size of the game (the old 1 cm grid, within a voxel)', () => {
  const v = LAYOUT.voxel;
  const old = [[crucibleModel([]), [9, 7, 9]], [standModel(-1), [9, 7, 9]], [matchModel(false), [1, 7, 1]], [matchboxModel(3), [6, 3, 4]], [dishModel(), [7, 3, 7]], [rodModel(), [2, 15, 2]], [nuggetModel('gold'), [3, 2, 2]]];
  for (const [model, cm] of old) {
    model.size.forEach((n, axis) => assert.ok(Math.abs(n * v - cm[axis] * 0.01) <= v, `axis ${axis}: ${n} voxels vs ${cm[axis]} cm`));
  }
});

test('the crucible is a bowl: closed bottom, hollow inside, a wall all around', () => {
  const o = crucibleModel([]);
  const [sx, sy, sz] = o.size;
  const cx = Math.floor(sx / 2);
  const cz = Math.floor(sz / 2);
  assert.ok(o.get(cx, 0, cz) > 0 && o.get(cx - 1, 0, cz - 1) > 0, 'the bottom is closed');
  assert.equal(o.get(cx, 2, cz), 0, 'hollow inside');
  for (const y of [2, 3]) {
    let leaks = false;
    const seen = new Set();
    const stack = [[cx, cz]];
    while (stack.length) {
      const [x, z] = stack.pop();
      if (x < 0 || z < 0 || x >= sx || z >= sz) { leaks = true; continue; }
      if (seen.has(`${x},${z}`) || o.get(x, y, z)) continue;
      seen.add(`${x},${z}`);
      stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }
    assert.equal(leaks, false, `the wall is closed on layer ${y}`);
  }
  assert.ok(sy > 0);
});

test('what is in the crucible fills it layer by layer, each layer as tall as one old voxel', () => {
  const height = (contents) => {
    const o = crucibleModel(contents);
    const cx = Math.floor(o.size[0] / 2);
    let top = 0;
    for (let y = 1; y < o.size[1]; y++) if (o.get(cx, y, cx)) top = y;
    return top;
  };
  assert.equal(height([]), 0);
  assert.ok(height([{ color: P.GOLD, layers: 3 }]) > height([{ color: P.GOLD, layers: 1 }]));
  const o = crucibleModel([{ color: P.GOLD, layers: 2 }, { color: P.MERCURY, layers: 1 }]);
  const colors = new Set();
  for (let y = 1; y < o.size[1]; y++) colors.add(o.get(Math.floor(o.size[0] / 2), y, Math.floor(o.size[2] / 2)));
  assert.ok(colors.has(P.GOLD) && colors.has(P.MERCURY));
});

test('the match shows its head until it breaks off and a flame while lit', () => {
  const has = (o, color) => o.data.includes(color);
  assert.ok(has(matchModel(false), P.MATCH_WOOD) && has(matchModel(false), P.MATCH_HEAD));
  assert.ok(!has(matchModel(false, true), P.MATCH_HEAD));
  assert.ok(!has(matchModel(false), P.FLAME_A) && has(matchModel(true), P.FLAME_A) && has(matchModel(true), P.FLAME_B));
});

test('the dish holds sulfur powder; the nugget has the color of its kind', () => {
  assert.ok(dishModel().data.includes(P.SULFUR) && dishModel().data.includes(P.DISH));
  assert.ok(nuggetModel('gold').data.every((i) => i === 0 || i === P.GOLD));
  assert.ok(nuggetModel('fools').data.includes(P.FOOLS));
});
