// What the three difficulty levels change in the rules (CFG in game.js is "normal"). Only values the player can see
// and judge: the windows of the rings, how long a mistake takes, how fast the heat rises, how hard a match must be
// struck, how roughly the vial may be handled. Easier = wider windows, more time; harder = narrow windows, less time.
export const DIFFICULTY = {
  easy: {
    DOSE_MIN: 0.55, DOSE_MAX: 1.45, // mercury window
    SULFUR_MIN: 0.25, SULFUR_MAX: 0.85,
    BURN: 0.98, BURN_HOLD: 4, // temperature where the lead burns, and how long it can stay there
    HEAT_RATE: 0.09, // slower heating is easier to control
    STIR_NEEDED: 2,
    LUMP_HOLD: 14, // s of right conditions without stirring until it clumps
    STRIKE_SPEED: 0.7, STRIKE_MAX: 4.0,
    BREAK_SPEED_FACTOR: 1.35, // the vial breaks at this times the normal impact speed
    SPARE_VIALS: 1,
    SMOKE_RATE: 0.5, SMOKE_DECAY: 0.06, // the ghost shows sooner and stays
    RING_GAP_TOL: 1,
    TRAP_HOLD: 1,
  },
  normal: {},
  hard: {
    DOSE_MIN: 0.85, DOSE_MAX: 1.15,
    SULFUR_MIN: 0.45, SULFUR_MAX: 0.65,
    BURN: 0.9, BURN_HOLD: 1.5,
    HEAT_RATE: 0.16,
    STIR_NEEDED: 4.5,
    LUMP_HOLD: 6,
    STRIKE_SPEED: 1.3, STRIKE_MAX: 2.4,
    BREAK_SPEED_FACTOR: 0.75,
    SPARE_VIALS: 0,
    SMOKE_RATE: 0.25, SMOKE_DECAY: 0.15,
    TRAP_HOLD: 2.2,
    RING_MIN_CELLS: 60,
  },
};
