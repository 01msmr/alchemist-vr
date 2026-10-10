import { CFG } from '../config/index.js';

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
