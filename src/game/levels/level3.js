import { rules } from '../rules.js';
import { stepGhost } from '../ghost.js';
import { stepFinale } from '../finale.js';

// Level 3: the ghost, then the cat. Herbs burn on the flame (smoke shows the ghost), a closed ring of salt around the
// gold holds it, the inverted vial over the ring catches it. Then the straw cat: gold on its eyes, the open vial over it,
// it wakes and runs to the cushion. Fool's gold does not lure the ghost; as the cat's eyes it makes the cat squint.
export const level3 = {
  id: 3,
  title: 'The ghost and the cat',

  accepts: { herb: () => true },
  reactions: [],

  // continuous rules each frame (the runtime sets s.ring and s.finaleInput before)
  tick(s, dt) {
    const c = s.crucible;
    const herb = c.amounts.herb ?? 0;
    const burning = s.candleLit && herb > 0;
    if (burning) c.amounts.herb = Math.max(0, herb - rules().HERB_BURN_RATE * dt);
    stepGhost(s.ghost, dt, { burning, ringClosed: s.ring.closed, bait: s.ring.bait, vialOver: s.ring.vialOver });
    stepFinale(s.finale, s.ghost.phase, dt, s.finaleInput);
    s.progress.smoke = Math.min(1, s.ghost.smoke / rules().GHOST_VISIBLE); // the ring around the crucible fills with the smoke
  },

  // the vial starts empty: it is for the ghost
  onEnter(s) {
    s.vial.fill = 0;
    s.vialBroken = false;
  },

  complete: (s) => s.finale.done,

  scene: { tools: ['vial'], props: ['herbs', 'salt'] },

  get gauge() {
    return {
      substance: 'herb',
      window: [0, 0.001],
      scale: 0.5,
      hold: { from: 'progress', id: 'smoke', seconds: 1 },
      danger: { id: 'none', seconds: 1 },
    };
  },

  status(s) {
    const g = s.ghost;
    const f = s.finale;
    const herb = (s.crucible.amounts.herb ?? 0).toFixed(2);
    let hint;
    if (f.done) hint = f.eyes === 'fools' ? 'THE END: the cat squints, runs in circles, but it lives' : 'THE END: the cat lives and runs to its cushion';
    else if (f.alive) hint = 'the cat wakes and runs to its cushion';
    else if (f.released) hint = 'the ghost goes into the cat';
    else if (g.phase === 'trapped') hint = f.eyes ? 'open the vial over the cat' : 'caught! lay the gold on the cat\'s eyes';
    else if (g.mocked) hint = 'fool\'s gold! the ghost laughs. restart: pull the cord';
    else if (g.phase === 'lured') hint = `hold the vial upside down over the ring ${g.trap.toFixed(1)}/${rules().TRAP_HOLD}s`;
    else if (g.phase === 'visible') hint = 'the ghost is here: lay a closed salt ring around the gold';
    else hint = 'light the candle, put herbs in the crucible: smoke shows the ghost';
    return [`smoke ${g.smoke.toFixed(2)}/${rules().GHOST_VISIBLE}  herb ${herb}  ring ${s.ring.closed ? 'closed' : 'open'}`, hint];
  },
};
