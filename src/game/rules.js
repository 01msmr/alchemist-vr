import { CFG, DIFFICULTY } from '../config/index.js';

// The rules the game plays by right now: CFG with what the difficulty changes. `rules()` is read where the game checks
// a window or a time (levels, scoring, heat, matches, the vial's break speed), so the choice on the console counts at once.
export function rulesFor(difficulty) {
  return Object.freeze({ ...CFG, ...(DIFFICULTY[difficulty] ?? {}) });
}

let current = rulesFor('normal');
export const rules = () => current;

// choose the difficulty; returns the new rules
export function useDifficulty(difficulty) {
  current = rulesFor(difficulty);
  return current;
}
