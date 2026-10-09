import { CFG } from './config.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createState() {
  return {
    vial: { fill: CFG.VIAL_CAPACITY },
    flow: 0, // current pour rate, for the stream visual
    crucible: { content: 'lead', temp: 0, mercury: 0, quality: null },
    progress: {}, // reaction id -> seconds the condition has held
    wasted: 0,
    vialBroken: false,
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

const rad = (deg) => (deg * Math.PI) / 180;

// Tilt angle (radians) at which mercury starts to spill, for a given fill. A full vial spills
// at a small angle, a nearly empty one needs a steep tilt.
export function pourStartAngle(fill) {
  const level = (fill / CFG.VIAL_CAPACITY) * CFG.VIAL_FILL_HEIGHT;
  const angle = Math.atan2(CFG.VIAL_HEIGHT - level, CFG.VIAL_INNER_DIAMETER);
  return Math.min(rad(CFG.POUR_ANGLE_MAX_DEG), Math.max(rad(CFG.POUR_ANGLE_MIN_DEG), angle));
}

// Pour from the vial for dt seconds with the vial tilted by `angle` radians from upright.
// The flow eases toward its target (inertia). Returns the amount that left the vial; it becomes drops.
export function pour(s, dt, angle) {
  const { vial } = s;
  const start = pourStartAngle(vial.fill);
  const target = vial.fill > 0 ? CFG.POUR_MAX_RATE * Math.min(1, Math.max(0, (angle - start) / rad(CFG.FLOW_SPAN_DEG))) : 0;
  const tau = target > s.flow ? CFG.FLOW_RISE_TAU : CFG.FLOW_FALL_TAU;
  s.flow += (target - s.flow) * (1 - Math.exp(-dt / tau));
  if (vial.fill <= 0 || (target === 0 && s.flow < 0.005)) s.flow = 0;
  const poured = Math.min(vial.fill, s.flow * dt);
  vial.fill -= poured;
  return poured;
}

// The vial broke: its mercury is gone from the vial (the caller spills it as drops). Returns the amount.
export function breakVial(s) {
  const spilled = s.vial.fill;
  s.vial.fill = 0;
  s.vialBroken = true;
  s.flow = 0;
  return spilled;
}

// A drop of mercury reached the crucible mouth. Only liquid lead takes it; otherwise it beads off.
export function landMercury(s, amount) {
  const c = s.crucible;
  if (c.content === 'lead' && c.temp >= CFG.MELT) c.mercury += amount;
  else s.wasted += amount;
}

export function step(s, dt) {
  const c = s.crucible;

  if (s.match && s.match.lit > 0) {
    s.match.lit -= dt;
    if (s.match.lit <= 0) s.match = null; // burnt out
  }

  c.temp = s.candleLit ? Math.min(1, c.temp + CFG.HEAT_RATE * dt) : Math.max(0, c.temp - CFG.COOL_RATE * dt);

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
