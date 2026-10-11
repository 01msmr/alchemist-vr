import { rules } from './rules.js';

// The cat, after the ghost is caught: gold eyes, the open vial over it, it wakes and runs to the cushion.
// Fool's gold eyes make it squint and run in circles (it works, but not well).
export function createFinale() {
  return { eyes: null, released: false, wake: 0, alive: false, run: 0, done: false };
}

// input: { eyes: 'gold' | 'dull' | 'fools' | null (gold lying at the cat's eyes), opened (the vial open over the cat) }
export function stepFinale(f, ghostPhase, dt, input) {
  if (ghostPhase !== 'trapped' || f.done) return f;
  const r = rules();
  if (!f.eyes && input.eyes) f.eyes = input.eyes;
  if (f.eyes && !f.released && input.opened) f.released = true;
  if (f.released && !f.alive) {
    f.wake += dt;
    if (f.wake >= r.WAKE_TIME) f.alive = true;
  }
  if (f.alive) {
    f.run = Math.min(1, f.run + dt / r.RUN_TIME);
    if (f.run >= 1) f.done = true;
  }
  return f;
}
