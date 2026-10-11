import { rules } from './rules.js';

// The ghost of level 3: herbs burning on the flame give smoke, smoke makes the ghost visible, gold inside a closed
// salt ring lures it, the inverted vial over the ring catches it.
//   phase: 'hidden' | 'visible' | 'lured' | 'trapped'
export function createGhost() {
  return { smoke: 0, phase: 'hidden', trap: 0, mocked: false };
}

// input: { burning, ringClosed, bait: 'gold' | 'dull' | 'fools' | null (what lies in the ring), vialOver (inverted over the ring) }
export function stepGhost(g, dt, input) {
  const r = rules();
  if (g.phase === 'trapped') return g;
  g.smoke = Math.min(1.2, Math.max(0, g.smoke + (input.burning ? r.SMOKE_RATE : -r.SMOKE_DECAY) * dt));

  if (g.phase === 'hidden' && g.smoke >= r.GHOST_VISIBLE) g.phase = 'visible';
  if (g.phase !== 'hidden' && g.smoke < r.GHOST_FADE) {
    g.phase = 'hidden';
    g.trap = 0;
  }

  const real = input.bait === 'gold' || input.bait === 'dull';
  g.mocked = g.phase === 'visible' && input.ringClosed && input.bait === 'fools'; // fool's gold: it laughs and stays out
  if (g.phase === 'visible' && input.ringClosed && real) g.phase = 'lured';
  else if (g.phase === 'lured' && !(input.ringClosed && real)) {
    g.phase = 'visible';
    g.trap = 0;
  }

  if (g.phase === 'lured') {
    g.trap = input.vialOver ? g.trap + dt : Math.max(0, g.trap - 2 * dt);
    if (g.trap >= r.TRAP_HOLD) g.phase = 'trapped';
  }
  return g;
}
