// The rules of the game: doses, temperatures, timings. Units: mercury in "doses" (1.0 = what one amalgam needs),
// temperature normalized 0 (cold) .. 1, quality 0..1. See ./index.js for the other config files.
export const CFG = {
  VIAL_CAPACITY: 2.0, // doses; the target is 1.0, so there is room for a second try
  // The tilt at which pouring starts depends on the fill level (see pourStartAngle): the vial is
  // approximated as a cylinder, and mercury spills once its level reaches the lip.
  VIAL_HEIGHT: 0.16, // m, inner height of the bottle
  VIAL_FILL_HEIGHT: 0.1, // m, level at VIAL_CAPACITY
  VIAL_INNER_DIAMETER: 0.05, // m, average over the body and the neck
  POUR_ANGLE_MIN_DEG: 10,
  POUR_ANGLE_MAX_DEG: 100,
  POUR_MAX_RATE: 0.35, // doses per second at full flow
  FLOW_SPAN_DEG: 50, // tilt beyond the start angle that gives full flow
  // the flow has inertia: it takes a moment to build up and a moment to stop
  FLOW_RISE_TAU: 0.25, // s
  FLOW_FALL_TAU: 0.12, // s

  // pouring: mercury leaves the lip as drops that fly ballistically
  DROP_AMOUNT: 0.01, // doses per drop
  // a broken vial scatters its mercury; sulfur grains scatter a little as the fingers open (m/s)
  SCATTER_SPEED: 0.9,
  SCATTER_LIFT: 0.4,
  SCATTER_LIFT_RANGE: 0.6,
  SCATTER_INHERIT: 0.3, // share of the vial's velocity at the break that the drops keep
  GRAIN_SPREAD: 0.02,
  GRAIN_SPREAD_RANGE: 0.03,
  // spilled substances stay on the table in cells of this size (m); a cell holds this much (doses) before the rest runs to the next
  PUDDLE_CELL: 0.0075, // the voxel grid
  PUDDLE_CELL_MAX: 0.016875, // a cell holds this much (was 0.03 at 1 cm: the same amount spreads over the same area)
  PUDDLE_RADIUS_CELLS: 53, // a puddle cannot grow wider than this (about 40 cm)
  SPILL_MIN: 0.1, // m/s along the spill direction at the start of pouring
  SPILL_RANGE: 0.4, // added at full flow

  MELT: 0.5, // lead is liquid (accepts mercury) from here
  CRITICAL: 0.85, // glow turns white-yellow: warning
  BURN: 0.95, // holding this long burns the lead
  HEAT_RATE: 0.12, // per second with burner on
  COOL_RATE: 0.025, // per second with burner off

  DOSE_MIN: 0.7,
  DOSE_MAX: 1.3,
  MATCHES: 3,
  MATCH_BURN: 8, // s a lit match lasts
  // striking: a quick stroke along the striker; too slow only scrapes, far too fast snaps the head off
  STRIKE_SPEED: 1.0, // m/s minimum
  STRIKE_MAX: 3.0, // m/s above this the match head breaks
  STRIKE_LENGTH: 0.03, // m of fast stroke needed to ignite

  // level 2: amalgam + sulfur + heat + stirring = gold
  GRAIN: 0.0075, // doses of sulfur per grain
  GRAINS_PER_PINCH: 8,
  SULFUR_MIN: 0.35,
  SULFUR_MAX: 0.75,
  SULFUR_GAUGE: 1.2, // the ring around the crucible covers 0 .. this many doses of sulfur
  STIR_MIN_SPEED: 0.12, // m/s the rod tip must move inside the crucible
  STIR_NEEDED: 3, // s of stirring
  STIR_DECAY: 0.5, // stirring progress lost per second while not stirring
  LUMP_HOLD: 10, // s of right conditions without stirring until it clumps (fool's gold)
  GOLD_MIN: 0.7, // result quality for real gold
  DULL_MIN: 0.4, // result quality for dull gold; below that, fool's gold
  TIDY_DELAY: 3, // s after the amalgam forms until the used objects are cleared away

  AMALGAM_HOLD: 1.5, // s of liquid lead + dose in window
  BURN_HOLD: 2.5,
};
