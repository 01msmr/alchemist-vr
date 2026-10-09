// All tuning knobs in one place. Units: mercury in "doses" (1.0 = what one amalgam needs),
// temperature normalized 0 (cold) .. 1.
export const CFG = {
  VIAL_CAPACITY: 1.5,
  POUR_MIN_TILT: 0.4, // tilt (0..1) at which pouring starts
  POUR_MAX_RATE: 0.5, // doses per second at full tilt
  STREAM_TAU: 0.35, // s, stream lag: mercury in the air lands after you stop tilting

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
