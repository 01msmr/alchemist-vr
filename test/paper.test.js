import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, frayedOutline, wrapText } from '../src/paper.js';

test('the random generator is deterministic and stays in 0..1', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('the torn outline stays inside the sheet, goes all the way around and is the same every time', () => {
  const w = 700;
  const h = 900;
  const outline = frayedOutline(w, h, { seed: 5 });
  assert.deepEqual(outline, frayedOutline(w, h, { seed: 5 }));
  assert.notDeepEqual(outline, frayedOutline(w, h, { seed: 6 }));
  assert.ok(outline.length > 2 * (w + h) / 9 * 0.9, `${outline.length} points`);
  for (const p of outline) assert.ok(p.x >= -1e-9 && p.x <= w + 1e-9 && p.y >= -1e-9 && p.y <= h + 1e-9, `${p.x}, ${p.y}`);
  // the corners are torn off: nothing near the four corners of the rectangle
  for (const [cx, cy] of [[0, 0], [w, 0], [w, h], [0, h]]) assert.ok(outline.every((p) => Math.hypot(p.x - cx, p.y - cy) > 8), `corner ${cx},${cy}`);
  // and it reaches every side
  assert.ok(outline.some((p) => p.y < 10) && outline.some((p) => p.y > h - 10) && outline.some((p) => p.x < 10) && outline.some((p) => p.x > w - 10));
});

test('words are wrapped to the width, a long word stays whole, empty text gives no lines', () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(wrapText('aa bb cc dd', 50, measure), ['aa bb', 'cc dd']);
  assert.deepEqual(wrapText('aaaaaaaaaaaa b', 50, measure), ['aaaaaaaaaaaa', 'b']);
  assert.deepEqual(wrapText('   ', 50, measure), []);
  assert.deepEqual(wrapText('one', 5, measure), ['one']);
});
