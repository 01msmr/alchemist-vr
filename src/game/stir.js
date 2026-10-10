import { CFG } from './config.js';

// Is the rod tip stirring? It must be inside the crucible (below the rim, above the bottom) and moving
// across at STIR_MIN_SPEED or more. Call once per frame with the tip position (world-local); the tracker
// remembers the previous one. target: { cx, cz, top, bottom, radius }.
export function createStirTracker() {
  let prev = null;
  return {
    update(tip, dt, target) {
      const inside = tip.y <= target.top && tip.y >= target.bottom && Math.hypot(tip.x - target.cx, tip.z - target.cz) <= target.radius;
      let speed = 0;
      if (prev && dt > 0) speed = Math.hypot(tip.x - prev.x, tip.z - prev.z) / dt;
      prev = { x: tip.x, z: tip.z };
      return inside && speed >= CFG.STIR_MIN_SPEED;
    },
    reset() {
      prev = null;
    },
  };
}
