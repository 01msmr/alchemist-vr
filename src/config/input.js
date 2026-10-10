// Hands, controllers, mouse: thresholds, reach distances and how a grab is judged. Meters unless noted.
// Everything about tracked fingers and the controller offsets is unverified on a real Quest: tune with the
// status panel, which shows per hand `mode pinch grip`.
export const INPUT = {
  // points in the controller's grip space (-Z is forward out of the controller)
  controller: {
    tipZ: 0.08, // the pinch point, where thumb and index fingertip would meet
    palmZ: 0.02, // the center of the closed hand
    // how the game's hand is turned against the real controller, in quarter turns (90 degrees) about the controller's
    // own axes (-z forward out of the controller, +y up): held tools and the drawn hand turn, the points stay where they are
    turn: { x: 0, y: 0, z: 0 },
  },
  // a tracked hand (WebXR hand-tracking joints)
  hand: {
    pinch: { open: 0.08, closed: 0.02 }, // thumb tip to index tip distance: 0 strength at `open`, 1 at `closed`
    gripCurl: { open: 0.12, closed: 0.055 }, // fingertip to palm distance of middle, ring and little finger
    graspOffset: 0.045, // a held object sits this far in front of the palm
    holdMargin: 0.01, // a fist holds a tool at its radius plus this in front of the palm
    // how the game's hand is turned against the real hand, in quarter turns (90 degrees) about the grip frame's axes
    // (-z along the fingers, +y toward the thumb side): held tools turn, the points stay where they are
    turn: { x: 0, y: 0, z: 0 },
  },
  // analog finger values (0..1) with hysteresis, so letting go is a deliberate loosening
  analog: { squeezeOn: 0.7, squeezeOff: 0.3, pinchOn: 0.6, pinchOff: 0.25 },
  // a grip's strength 0..1 runs from `floor` (weakest still holding) to 1
  gripStrengthFloor: 0.3,

  // how far the hand may be from what it touches
  reach: {
    matchbox: 0.045, // pinch to take a match
    dish: 0.045, // pinch to take sulfur
    nugget: 0.045, // pinch above the crucible's mouth to take the gold
    snuff: 0.05, // pinch at the wick to put the candle out
    light: 0.035, // a lit match head this close to the wick lights the candle
    reset: 0.15, // pinch this close to the status panel to start over
    nuggetBand: { yMin: 0.08, yMax: 0.22 }, // the height above the table where a pinch over the crucible takes the gold
  },
  striker: { yMin: 0.02, yMax: 0.065 }, // height band of the match head above the striker (its top is at 0.03)

  // the match: held near its bottom, the head sticks out beyond the fingers
  match: { headDy: 0.045, pinchDy: 0.01 },

  // how well a tool is held: 1 at the axis, less off it; a fist over the end of a tool only half closes on it
  contact: { offAxisPenalty: 0.6, palmSpan: 0.07, palmReach: 0.035 },
  snapTime: 0.15, // s, a vial settles into the natural hold in the fist

  // how fast things move when handed over: the velocity of a hand or a held tool is smoothed and capped, so a
  // release throws, drops or sets down like the hand moved
  motion: { smoothing: 0.5, maxSpeed: 5, maxSpin: 30, lipSmoothing: 0.4, lipMaxSpeed: 4 }, // m/s, rad/s

  // Smoothing of the pose a fist wants a held tool at (One-Euro: calm while slow, quick while fast; cutoffs in Hz):
  // tracked joints jitter, and the jitter would shake the tool. A pinch is not filtered: it needs precision.
  filter: {
    fist: {
      pos: { minCutoff: 1.5, beta: 6, dCutoff: 1 }, // beta: extra cutoff per m/s
      rot: { minCutoff: 1.2, beta: 0.8, dCutoff: 1 }, // beta: extra cutoff per rad/s
    },
  },

  // controller haptic pulses: strength 0..1 and duration in ms
  haptics: {
    grab: { strength: 0.3, ms: 20 },
    slip: { strength: 0.6, ms: 90 }, // a tool slipped out of the hand
    pinchSource: { strength: 0.2, ms: 20 }, // a pinch of sulfur
    snuff: { strength: 0.2, ms: 30 },
    strike: { strength: 0.7, ms: 50 }, // the match lights
    snap: { strength: 1, ms: 120 }, // the match head snaps off
    candle: { strength: 0.8, ms: 80 }, // the candle lights
    pour: { base: 0.1, range: 0.5, ms: 60, every: 0.08 }, // strength grows with the flow; every = seconds between pulses
  },

  // setting the real table, with the index finger of a tracked hand: two sets of three quick taps on its top at the front
  // edge (the lowest tap is the table top; the two places are a line: where the table is and how it is turned)
  calibration: {
    tap: { count: 3, drop: 0.02, lift: 0.015, maxGap: 0.75, tolerance: 0.05 }, // m, s: a tap drops 2 cm then lifts 1.5 cm; taps at most 0.75 s apart and within 5 cm height of each other (a finger may slip over the rim)
    band: 0.25, // m above or below the current virtual table top where a touch counts
    keepAway: 0.08, // m: not within this of anything you could pick up (a missed grab is not a calibration)
    fingerThickness: 0.01, // m: the fingertip joint is this far above the surface it touches
    storageKey: 'alchemist.tableHeight',
    edge: { minSpan: 0.3, storageKey: 'alchemist.tableEdge' }, // the two places of the two tap sets must be at least minSpan m apart
  },

  // desktop fallback
  mouse: {
    holdY: { vial: 0.2, rod: 0.2, nugget: 0.16, grains: 0.16 }, // height of a held thing's center
    matchY: 0.012, // bottom of the held match
    tiltPixels: 150, // Shift + vertical drag range for tilt 0..1
    maxTiltDeg: 130,
  },
};
