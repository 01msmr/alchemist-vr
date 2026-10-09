// All tuning knobs in one place. Units: mercury in "doses" (1.0 = what one amalgam needs),
// temperature normalized 0 (cold) .. 1.
export const CFG = {
  VIAL_CAPACITY: 1.5,
  // The tilt at which pouring starts depends on the fill level (see pourStartAngle): the vial is
  // approximated as a cylinder, and mercury spills once its level reaches the lip.
  VIAL_HEIGHT: 0.1, // m, inner height
  VIAL_FILL_HEIGHT: 0.09, // m, level at VIAL_CAPACITY
  VIAL_INNER_DIAMETER: 0.03, // m
  POUR_ANGLE_MIN_DEG: 10,
  POUR_ANGLE_MAX_DEG: 100,
  POUR_MAX_RATE: 0.5, // doses per second at full flow
  FLOW_SPAN_DEG: 50, // tilt beyond the start angle that gives full flow
  // the flow has inertia: it takes a moment to build up and a moment to stop
  FLOW_RISE_TAU: 0.25, // s
  FLOW_FALL_TAU: 0.12, // s

  // pouring: mercury leaves the lip as drops that fly ballistically
  DROP_AMOUNT: 0.01, // doses per drop
  SPILL_MIN: 0.1, // m/s along the spill direction at the start of pouring
  SPILL_RANGE: 0.4, // added at full flow

  // controller analog inputs (0..1), with hysteresis so release is a deliberate loosening
  SQUEEZE_ON: 0.7,
  SQUEEZE_OFF: 0.3,
  PINCH_ON: 0.6,
  PINCH_OFF: 0.25,

  MELT: 0.5, // lead is liquid (accepts mercury) from here
  CRITICAL: 0.8, // glow turns white-yellow: warning
  BURN: 0.9, // holding this long burns the lead
  HEAT_RATE: 0.1, // per second with burner on
  COOL_RATE: 0.04, // per second with burner off

  DOSE_MIN: 0.85,
  DOSE_MAX: 1.15,
  MATCHES: 3,
  MATCH_BURN: 8, // s a lit match lasts
  STRIKE_SPEED: 0.5, // m/s the match head must move over the matchbox to light

  AMALGAM_HOLD: 2, // s of liquid lead + dose in window
  BURN_HOLD: 1.5,
};
