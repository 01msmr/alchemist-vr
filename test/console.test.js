import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONSOLE, LAYOUT } from '../src/config/index.js';
import { controls, hitControl, pockets, createCord, redSegments, cordPosition } from '../src/game/console.js';

const B = LAYOUT.tableBounds;

test('a point on a control hits it, between controls and outside hit nothing', () => {
  for (const c of controls()) assert.equal(hitControl(c.x, c.z)?.id, c.id);
  const [a, b] = controls().filter((c) => c.row === 'background');
  assert.equal(hitControl((a.x + b.x) / 2, a.z), null, 'in the 2 cm gap');
  assert.equal(hitControl(0, 0), null);
  assert.equal(hitControl(a.x + a.halfX + 0.005, a.z)?.id, undefined);
  assert.equal(hitControl(a.x + a.halfX + 0.005, a.z, 0.01)?.id, a.id, 'a margin widens the footprint');
});

test('every option of every row is a button, side by side with the first on the left, rows apart', () => {
  const list = controls();
  assert.deepEqual(list.map((c) => c.id), ['theme:dark', 'theme:light', 'background:lab', 'background:bench', 'background:stable', 'difficulty:easy', 'difficulty:normal', 'difficulty:hard']);
  for (const row of ['theme', 'background', 'difficulty']) {
    const cells = list.filter((c) => c.row === row);
    assert.ok(cells.every((c) => c.z === cells[0].z), 'one z per row');
    assert.ok(cells.every((c, i) => i === 0 || c.x > cells[i - 1].x), 'the first option is on the left');
  }
  assert.equal(new Set(list.map((c) => c.z)).size, 3);
});

test('icons lie behind their buttons and do not reach the next row\'s buttons', () => {
  const half = CONSOLE.buttons.iconSize / 2;
  for (const c of controls()) {
    assert.ok(c.iconZ < c.z);
    for (const other of controls().filter((o) => o.z !== c.z)) {
      assert.ok(Math.abs(c.x - other.x) >= half + other.halfX || c.iconZ + half <= other.z - other.halfZ || c.iconZ - half >= other.z + other.halfZ, `${c.id} icon / ${other.id}`);
    }
  }
});

test('controls stay on the table and do not overlap', () => {
  const list = controls();
  for (const c of list) {
    assert.ok(c.x - c.halfX > B.minX && c.x + c.halfX < B.maxX && c.z - c.halfZ > B.minZ && c.z + c.halfZ < B.maxZ, c.id);
  }
  for (const [i, a] of list.entries()) {
    for (const b of list.slice(i + 1)) {
      assert.ok(Math.abs(a.x - b.x) >= a.halfX + b.halfX || Math.abs(a.z - b.z) >= a.halfZ + b.halfZ, `${a.id} / ${b.id}`);
    }
  }
});

test('pockets are whole voxels, inside the table, and do not overlap', () => {
  const v = LAYOUT.voxel;
  const list = pockets();
  for (const p of list) {
    for (const edge of [p.x0, p.x1, p.z0, p.z1]) assert.ok(Math.abs(edge / v - Math.round(edge / v)) < 1e-9);
    assert.ok(p.x0 > B.minX && p.x1 < B.maxX && p.z0 > B.minZ && p.z1 < B.maxZ && p.x0 < p.x1 && p.z0 < p.z1);
  }
  for (const [i, a] of list.entries()) {
    for (const b of list.slice(i + 1)) assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0);
  }
});

const cfg = CONSOLE.cord;

test('the cord follows the finger down, clamped to 0..pull', () => {
  const cord = createCord(cfg);
  cord.grab(1);
  cord.drag(0.95);
  assert.ok(Math.abs(cord.pulled - 0.05) < 1e-12);
  cord.drag(1.2);
  assert.equal(cord.pulled, 0, 'up past the start stays at 0');
  cord.drag(0);
  assert.equal(cord.pulled, cfg.pull);
});

test('the cord fires once at full pull, then returns and can be pulled again', () => {
  const cord = createCord(cfg);
  cord.grab(1);
  cord.drag(1 - cfg.pull);
  assert.equal(cord.step(0.01), true);
  cord.grab(1 - cfg.pull); // still returning: refused
  assert.equal(cord.grabbed, false);
  for (let i = 0; i < 100; i++) assert.equal(cord.step(0.02), false);
  assert.equal(cord.pulled, 0);
  cord.grab(1);
  cord.drag(1 - cfg.pull);
  assert.equal(cord.step(0.01), true);
});

test('a pull let go early springs back and never fires', () => {
  const cord = createCord(cfg);
  cord.grab(1);
  cord.drag(1 - cfg.pull / 2);
  assert.equal(cord.step(0.01), false);
  assert.ok(Math.abs(cord.progress - 0.5) < 1e-9);
  cord.release();
  let fired = false;
  for (let i = 0; i < 100; i++) fired = cord.step(0.02) || fired;
  assert.equal(fired, false);
  assert.equal(cord.pulled, 0);
});

test('the red part of the cord grows from the top with the progress', () => {
  assert.equal(redSegments(0, 100), 0);
  assert.equal(redSegments(0.5, 100), 50);
  assert.equal(redSegments(1, 100), 100);
  assert.equal(redSegments(2, 100), 100);
  assert.ok(cordPosition().x > B.minX && cordPosition().x < B.maxX);
});

test('the cord cannot be grabbed while it is still returning from a restart, and can be again after', () => {
  const cord = createCord(cfg);
  assert.equal(cord.canGrab, true);
  cord.grab(1);
  cord.drag(1 - cfg.pull);
  cord.step(0.01);
  assert.equal(cord.canGrab, false);
  for (let i = 0; i < 100; i++) cord.step(0.02);
  assert.equal(cord.canGrab, true);
});

test('the grab radius is generous enough for a shaky hand and smaller than the distance to the buttons', () => {
  assert.ok(cfg.grabRadius >= 0.07, 'at least 7 cm');
  assert.ok(cfg.grabRadius < cfg.beadY, 'and not as big as the way to the table');
});
