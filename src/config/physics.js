// Rigid bodies of the loose objects and how a hand holds them.
export const PHYSICS = {
  gravity: 9.81, // m/s^2
  substep: 1 / 180, // s
  maxSubsteps: 12,
  friction: 0.5,
  restitution: 0.2,
  // a hand pulls the gripped point with a spring; the force is limited:
  // capacity = forceG x weight x contact x strength. wn = natural frequency of the orientation spring (rad/s),
  // lose = how far (m) the hand may pull away before the tool counts as slipped out (a brisk lift lags a few cm for a
  // moment; a grip that really lets go falls behind without bound). A pinch steers the
  // orientation only weakly: the tool pivots between the fingertips.
  grip: {
    fist: { forceG: 2.85, torqueG: 0.1, wn: 60, lose: 0.07 },
    pinch: { forceG: 1.85, torqueG: 0.02, wn: 25, lose: 0.04 },
  },
  spring: { kpPerMass: 5000, kdPerMass: 160 }, // N/m and N s/m per kg
  match: { half: { x: 0.005, y: 0.025, z: 0.005 }, mass: 0.002, lifetime: 5 }, // a dropped match, lifetime in s
  slab: 0.3, // thickness of the table slab (m), thick so nothing falls through
};
