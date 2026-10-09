export const VIAL_HALF = 0.055; // pivot at the vial's middle, lip half a vial height above it

// Horizontal unit direction from one point to another; +x if they coincide.
export function tiltDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  return len < 1e-6 ? { x: 1, z: 0 } : { x: dx / len, z: dz / len };
}

// Position of the vial's lip, given the vial's center and its unit up vector.
export function vialLip(pos, up) {
  return { x: pos.x + up.x * VIAL_HALF, y: pos.y + up.y * VIAL_HALF, z: pos.z + up.z * VIAL_HALF };
}

// Tilt 0..1 from the vial's up vector: 0 = upright, 1 = maxAngle (radians) or more.
export function tiltOf(up, maxAngle) {
  return Math.min(1, Math.acos(Math.min(1, Math.max(-1, up.y))) / maxAngle);
}

// Distance from point p to the segment a-b (all {x, y, z}).
export function distanceToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t), p.z - (a.z + abz * t));
}
