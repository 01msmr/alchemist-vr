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

// How well a hand holds a tool where it closes on it, 0..1. `dist` is the distance of the closing point from the
// tool's axis, `axial` its position along the axis (0 = center). Anywhere in the tool's volume holds (almost) fully; a
// bit less toward the edge of the grab radius. A full hand over the end of a tool (`ends`) only half closes on it.
export function gripContact(dist, axial, spec, { offAxisPenalty, palmSpan, palmReach }, ends) {
  const radial = 1 - offAxisPenalty * Math.min(1, dist / spec.grabRadius);
  if (!ends) return radial;
  return radial * Math.min(1, Math.max(0, (spec.axisHalf - Math.abs(axial) + palmReach) / palmSpan));
}

// A hand closed around a tool cannot close as far as around nothing: how firmly it holds is measured against how far
// the fingers had closed (`atGrab`, 0..1), so a hand that closes around the tool holds it fully. `floor` is the
// weakest closure that still holds.
export function holdStrength(current, atGrab, floor) {
  return Math.min(1, Math.max(0, (current - floor) / Math.max(atGrab - floor, 0.05)));
}

// Too hard a hold for too long crushes a fragile tool: update(tooHard, dt) is true once, after `seconds` of
// being too hard in a row; easing resets it.
export function createCrushMeter(seconds) {
  let held = 0;
  let fired = false;
  return {
    update(tooHard, dt) {
      if (!tooHard) {
        held = 0;
        fired = false;
        return false;
      }
      held += dt;
      if (held < seconds || fired) return false;
      fired = true;
      return true;
    },
    reset() {
      held = 0;
      fired = false;
    },
  };
}
