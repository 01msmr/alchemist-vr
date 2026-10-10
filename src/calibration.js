// Pure helpers for setting the height of the real table: when taps on it count, which heights are plausible, and remembering the height between sessions.

// Counts taps of a fingertip on the table: a drop of at least `drop`, then a lift of at least `lift` above the lowest
// point. Taps must follow each other within `maxGap` seconds and lie within `tolerance` of each other in height.
// update(y, active, dt, data) returns { taps, done, height, points }; on done (once), `height` is the lowest of the taps
// and `points` the `data` given at the lowest sample of each tap.
export function createTapCounter({ count, drop, lift, maxGap, tolerance }) {
  let taps = [];
  let points = [];
  let top = null;
  let low = 0;
  let lowData;
  let falling = false;
  let sinceTap = 0;
  const reset = () => { taps = []; points = []; top = null; falling = false; sinceTap = 0; };
  return {
    update(y, active, dt, data) {
      if (!active) {
        reset();
        return { taps: 0, done: false };
      }
      if (top === null) top = y;
      if (taps.length > 0 && (sinceTap += dt) > maxGap) { taps = []; points = []; sinceTap = 0; }
      if (!falling) {
        top = Math.max(top, y);
        if (top - y >= drop) { falling = true; low = y; lowData = data; }
      } else {
        if (y < low) { low = y; lowData = data; }
        if (y - low >= lift) {
          falling = false;
          top = y;
          sinceTap = 0;
          taps.push(low);
          points.push(lowData);
          if (Math.max(...taps) - Math.min(...taps) > tolerance) { taps = [low]; points = [lowData]; }
          if (taps.length >= count) {
            const done = { taps: 0, done: true, height: Math.min(...taps), points };
            taps = [];
            points = [];
            return done;
          }
        }
      }
      return { taps: taps.length, done: false };
    },
  };
}

export const validHeight = (h, [min, max]) => typeof h === 'number' && Number.isFinite(h) && h >= min && h <= max;

// storage is anything like localStorage; it may be missing or throw (private window, blocked site data)
export function loadHeight(storage, key, range) {
  try {
    const h = Number(storage?.getItem(key));
    return storage?.getItem(key) !== null && validHeight(h, range) ? h : null;
  } catch {
    return null;
  }
}

export function saveHeight(storage, key, h, range = [-Infinity, Infinity]) {
  if (!validHeight(h, range)) return false;
  try {
    storage.setItem(key, String(h));
    return true;
  } catch {
    return false;
  }
}

// The front edge of the table from two points on it (scene x, z; the player faces -z, the table lies beyond the edge).
// The table's frame sits `frontToOrigin` behind the middle of the edge and turns so that its -z axis points away
// from the edge. Returns { x, z, yaw } for the world group, or null when the points are too close for a line.
export function edgeFromPoints(a, b, { frontToOrigin, minSpan }) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const span = Math.hypot(dx, dz);
  if (span < minSpan) return null;
  let nx = -dz / span; // perpendicular to the edge, pointing away from the player (-z)
  let nz = dx / span;
  if (nz > 0) { nx = -nx; nz = -nz; }
  return {
    x: (a.x + b.x) / 2 + nx * frontToOrigin,
    z: (a.z + b.z) / 2 + nz * frontToOrigin,
    yaw: Math.atan2(-nx, -nz),
  };
}

const MAX_REACH = 5; // m: a table edge farther from the start point than this is not plausible
export const validEdge = (e) => !!e && [e.x, e.z, e.yaw].every((v) => typeof v === 'number' && Number.isFinite(v))
  && Math.hypot(e.x, e.z) <= MAX_REACH && Math.abs(e.yaw) <= Math.PI / 2;

export function loadEdge(storage, key) {
  try {
    const e = JSON.parse(storage?.getItem(key));
    return validEdge(e) ? { x: e.x, z: e.z, yaw: e.yaw } : null;
  } catch {
    return null;
  }
}

export function saveEdge(storage, key, e) {
  if (!validEdge(e)) return false;
  try {
    storage.setItem(key, JSON.stringify({ x: e.x, z: e.z, yaw: e.yaw }));
    return true;
  } catch {
    return false;
  }
}
