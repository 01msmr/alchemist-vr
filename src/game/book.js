import { LAYOUT } from '../config/index.js';

// The book of instructions, pure: which page spread is shown, the leaf that is turning, where the corners are that turn it.
const B = LAYOUT.book;

// where a point on the table (x, z) lies in the book's own frame (x across the pages, z along the spine)
export function toBookLocal(x, z) {
  const dx = x - B.x;
  const dz = z - B.z;
  const c = Math.cos(B.yaw);
  const s = Math.sin(B.yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

// the two corners to tap: the lower right one turns forward, the lower left one back (book frame)
export function bookZones() {
  const half = B.zone / 2;
  return [
    { id: 'book:next', book: true, delta: 1, x: B.pageW - half - 0.008, z: B.pageD / 2 - half - 0.004, halfX: half, halfZ: half },
    { id: 'book:prev', book: true, delta: -1, x: -B.pageW + half + 0.008, z: B.pageD / 2 - half - 0.004, halfX: half, halfZ: half },
  ];
}

// the corner a table point (x, z) lies at, `margin` m outside still counts; null when none
export function hitBookZone(x, z, margin = 0) {
  const p = toBookLocal(x, z);
  return bookZones().find((c) => Math.abs(p.x - c.x) <= c.halfX + margin && Math.abs(p.z - c.z) <= c.halfZ + margin) ?? null;
}

// the book's state: `shown` the spread lying open, `target` the one wanted, `anim` the leaf in the air
export const createBook = () => ({ shown: 0, target: 0, anim: null });

export const clampSpread = (n, count) => Math.max(0, Math.min(count - 1, n));

// wish for another spread (clamped); the leaves turn one after the other
export function turnTo(book, target, count) {
  book.target = clampSpread(target, count);
}

// Advance the turning leaf by dt seconds: starts one leaf toward the target, quicker while more leaves are to follow.
export function stepBook(book, dt, { seconds, fast }) {
  if (!book.anim && book.shown !== book.target) book.anim = { from: book.shown, to: book.shown + Math.sign(book.target - book.shown), t: 0 };
  if (!book.anim) return;
  book.anim.t += dt / (book.target !== book.anim.to ? fast : seconds);
  if (book.anim.t >= 1) {
    book.shown = book.anim.to;
    book.anim = null;
  }
}

// how far the book is open between spreads: shown, or between two spreads while a leaf turns (smooth start and end)
export function spreadPosition(book) {
  if (!book.anim) return book.shown;
  const k = Math.min(1, book.anim.t);
  return book.anim.from + (book.anim.to - book.anim.from) * k * k * (3 - 2 * k);
}

// the axis-aligned box around the book on the table (seen from above), for the physics: { x, z, hx, hz }
export function bookBounds(extra) {
  const c = Math.abs(Math.cos(B.yaw));
  const s = Math.abs(Math.sin(B.yaw));
  const hw = B.pageW + extra;
  const hd = B.pageD / 2 + extra;
  return { x: B.x, z: B.z, hx: hw * c + hd * s, hz: hw * s + hd * c };
}
