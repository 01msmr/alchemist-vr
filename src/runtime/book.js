import { VIEW } from '../config/index.js';
import { createBook, turnTo, stepBook } from '../game/book.js';
import { LEVELS } from '../game/levels/index.js';

// The book at work: it opens at the page of the level and turns the leaves when the level changes; the player can turn
// the pages by hand (tap the lower corners, or the arrow keys on the desktop).
export function createBookWorld(ctx) {
  const book = createBook();
  const count = LEVELS.length;
  let level = 1;
  const times = { seconds: VIEW.book.leafSeconds, fast: VIEW.book.leafFastSeconds };

  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') turnTo(book, book.target + 1, count);
    if (e.key === 'ArrowLeft') turnTo(book, book.target - 1, count);
  });

  return {
    book,
    // delta +1 forward, -1 back (a tap on a corner)
    turn(delta) { turnTo(book, book.target + delta, count); },
    update(dt, currentLevel) {
      if (currentLevel !== level) { // the level changed: the book opens at its page
        level = currentLevel;
        turnTo(book, level - 1, count);
      }
      stepBook(book, dt, times);
    },
  };
}
