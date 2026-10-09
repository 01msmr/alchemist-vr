import { CFG } from './config.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createState() {
  return {
    vial: { fill: CFG.VIAL_CAPACITY },
    inflight: 0, // mercury in the air, not landed yet
    flow: 0, // current pour rate, for the stream visual
    crucible: { content: 'lead', temp: 0, mercury: 0, quality: null },
    progress: {}, // reaction id -> seconds the condition has held
    wasted: 0,
    candleLit: false,
    matches: CFG.MATCHES, // left in the box
    match: null, // match in hand: { lit: seconds left burning, 0 = unlit }
  };
}

export function takeMatch(s) {
  if (s.match || s.matches <= 0) return false;
  s.matches--;
  s.match = { lit: 0 };
  return true;
}

export function strikeMatch(s) {
  if (s.match && s.match.lit === 0) s.match.lit = CFG.MATCH_BURN;
}

export function dropMatch(s) {
  s.match = null;
}

// The lit match in hand lights the candle.
export function lightCandle(s) {
  if (s.match && s.match.lit > 0) s.candleLit = true;
}

export function snuffCandle(s) {
  s.candleLit = false;
}

// Hidden quality of the amalgam: how close the dose and the heat were to the middle of their windows.
export function amalgamQuality(c) {
  const doseMid = (CFG.DOSE_MIN + CFG.DOSE_MAX) / 2;
  const doseHalf = (CFG.DOSE_MAX - CFG.DOSE_MIN) / 2;
  const heatMid = (CFG.MELT + CFG.BURN) / 2;
  const heatHalf = (CFG.BURN - CFG.MELT) / 2;
  const dose = clamp01(1 - Math.abs(c.mercury - doseMid) / doseHalf);
  const heat = clamp01(1 - Math.abs(c.temp - heatMid) / heatHalf);
  return 0.5 * dose + 0.5 * heat;
}

// One row per reaction: when the condition has held for `hold` seconds, apply the outcome.
// Failures are rows too; they do something, they never block.
export const REACTIONS = [
  {
    id: 'sludge',
    when: (c) => c.content === 'lead' && c.mercury > CFG.DOSE_MAX,
    hold: 0,
    apply: (c) => { c.content = 'sludge'; c.quality = 0; },
  },
  {
    id: 'burn',
    when: (c) => c.content === 'lead' && c.temp >= CFG.BURN,
    hold: CFG.BURN_HOLD,
    apply: (c) => { c.content = 'burnt'; c.quality = 0; },
  },
  {
    id: 'amalgam',
    when: (c) => c.content === 'lead' && c.temp >= CFG.MELT && c.mercury >= CFG.DOSE_MIN && c.mercury <= CFG.DOSE_MAX,
    hold: CFG.AMALGAM_HOLD,
    apply: (c) => { c.content = 'amalgam'; c.quality = amalgamQuality(c); },
  },
];

// input: { tilt: 0..1, overCrucible: bool }
export function step(s, dt, input) {
  const { vial, crucible: c } = s;

  if (s.match && s.match.lit > 0) {
    s.match.lit -= dt;
    if (s.match.lit <= 0) s.match = null; // burnt out
  }

  c.temp = s.candleLit ? Math.min(1, c.temp + CFG.HEAT_RATE * dt) : Math.max(0, c.temp - CFG.COOL_RATE * dt);

  const tilted = input.tilt > CFG.POUR_MIN_TILT;
  s.flow = vial.fill > 0 && tilted ? CFG.POUR_MAX_RATE * (input.tilt - CFG.POUR_MIN_TILT) / (1 - CFG.POUR_MIN_TILT) : 0;
  const poured = Math.min(vial.fill, s.flow * dt);
  vial.fill -= poured;
  if (input.overCrucible) s.inflight += poured;
  else s.wasted += poured;

  const landed = s.inflight * (1 - Math.exp(-dt / CFG.STREAM_TAU));
  s.inflight -= landed;
  // Only liquid lead takes mercury; everything else beads off the crucible.
  if (c.content === 'lead' && c.temp >= CFG.MELT) c.mercury += landed;
  else s.wasted += landed;

  for (const r of REACTIONS) {
    if (!r.when(c)) {
      s.progress[r.id] = 0;
      continue;
    }
    s.progress[r.id] = (s.progress[r.id] || 0) + dt;
    if (s.progress[r.id] >= r.hold) {
      r.apply(c);
      s.progress = {};
      break;
    }
  }
}
