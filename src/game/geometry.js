// Horizontal unit direction from one point to another; +x if they coincide.
export function tiltDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  return len < 1e-6 ? { x: 1, z: 0 } : { x: dx / len, z: dz / len };
}

// Position of the vial's lip, given the vial's center, its unit up vector and half its height.
export function vialLip(pos, up, halfHeight) {
  return { x: pos.x + up.x * halfHeight, y: pos.y + up.y * halfHeight, z: pos.z + up.z * halfHeight };
}

// Angle (radians) between the vial's up vector and straight up: 0 = upright, PI = upside down.
export function tiltAngle(up) {
  return Math.acos(Math.min(1, Math.max(-1, up.y)));
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
