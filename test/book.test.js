import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../src/config/index.js';
import { createBook, turnTo, stepBook, spreadPosition, bookZones, hitBookZone, toBookLocal, clampSpread } from '../src/game/book.js';

const TIMES = { seconds: 0.7, fast: 0.3 };
const run = (book, seconds, dt = 0.05) => { for (let t = 0; t < seconds; t += dt) stepBook(book, dt, TIMES); };
const B = LAYOUT.book;
const toTable = (x, z) => ({ x: B.x + x * Math.cos(B.yaw) + z * Math.sin(B.yaw), z: B.z - x * Math.sin(B.yaw) + z * Math.cos(B.yaw) });

test('the target is clamped to the spreads that exist', () => {
  const book = createBook();
  turnTo(book, 9, 3);
  assert.equal(book.target, 2);
  turnTo(book, -4, 3);
  assert.equal(book.target, 0);
  assert.equal(clampSpread(1, 3), 1);
});

test('a leaf turns toward the target, one after the other, and the book ends open at the target', () => {
  const book = createBook();
  turnTo(book, 2, 3);
  stepBook(book, 0.05, TIMES);
  assert.deepEqual({ from: book.anim.from, to: book.anim.to }, { from: 0, to: 1 });
  run(book, 3);
  assert.equal(book.shown, 2);
  assert.equal(book.anim, null);
  turnTo(book, 1, 3);
  stepBook(book, 0.05, TIMES);
  assert.deepEqual({ from: book.anim.from, to: book.anim.to }, { from: 2, to: 1 }, 'back again');
  run(book, 3);
  assert.equal(book.shown, 1);
});

test('a single leaf takes the full time, several in a row are quicker', () => {
  const one = createBook();
  turnTo(one, 1, 3);
  let t = 0;
  while (one.shown !== 1 && t < 5) { stepBook(one, 0.01, TIMES); t += 0.01; }
  assert.ok(Math.abs(t - 0.7) < 0.03, `${t}`);
  const two = createBook();
  turnTo(two, 2, 3);
  t = 0;
  while (two.shown !== 1 && t < 5) { stepBook(two, 0.01, TIMES); t += 0.01; }
  assert.ok(t < 0.35, `the first of two: ${t}`);
});

test('the wish can change while a leaf is in the air; nothing is lost', () => {
  const book = createBook();
  turnTo(book, 2, 3);
  run(book, 0.2);
  turnTo(book, 0, 3);
  run(book, 3);
  assert.equal(book.shown, 0);
  assert.equal(book.anim, null);
});

test('the spread position moves smoothly from one spread to the next', () => {
  const book = createBook();
  assert.equal(spreadPosition(book), 0);
  turnTo(book, 1, 3);
  let last = 0;
  for (let i = 0; i < 20; i++) {
    stepBook(book, 0.03, TIMES);
    const p = spreadPosition(book);
    assert.ok(p >= last - 1e-12 && p <= 1);
    last = p;
  }
  run(book, 1);
  assert.equal(spreadPosition(book), 1);
});

test('the corners are on the book, at the lower outer corners, and a tap in them is found (the book is turned a little)', () => {
  const [next, prev] = bookZones();
  assert.ok(next.x > 0 && prev.x < 0 && next.z > 0 && prev.z > 0);
  assert.ok(Math.abs(next.x) + next.halfX <= B.pageW && Math.abs(next.z) + next.halfZ <= B.pageD / 2 + 1e-9);
  const n = toTable(next.x, next.z);
  assert.equal(hitBookZone(n.x, n.z)?.id, 'book:next');
  const p = toTable(prev.x, prev.z);
  assert.equal(hitBookZone(p.x, p.z)?.delta, -1);
  const middle = toTable(0, 0);
  assert.equal(hitBookZone(middle.x, middle.z), null);
  assert.equal(hitBookZone(0.3, 0.2), null, 'elsewhere on the table');
  const back = toBookLocal(n.x, n.z);
  assert.ok(Math.abs(back.x - next.x) < 1e-9 && Math.abs(back.z - next.z) < 1e-9);
});

test('the book lies on the table and does not reach the shelf or the cat', () => {
  const b = LAYOUT.tableBounds;
  const reach = Math.hypot(B.pageW + 0.01, B.pageD / 2 + 0.01);
  assert.ok(B.x - reach > b.minX - 0.05 && B.z + reach < b.maxZ);
  assert.ok(B.z - B.pageD / 2 - 0.01 > LAYOUT.shelf.z + LAYOUT.shelf.depth / 2, 'in front of the shelf');
});
