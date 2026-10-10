// Pure helpers for setting the height of the real table: when a pinch counts as "held still on the table",
// which heights are plausible, and remembering the height between sessions.

// A pinch held still for `seconds` (the fingertip slower than `maxSpeed`). update() returns { progress 0..1, done };
// done is true once, then again only after the pinch was let go or moved.
export function createDwell({ seconds, maxSpeed }) {
  let held = 0;
  let fired = false;
  return {
    update(active, speed, dt) {
      if (!active || speed > maxSpeed) {
        held = 0;
        fired = false;
        return { progress: 0, done: false };
      }
      held += dt;
      const progress = Math.min(1, held / seconds);
      if (held >= seconds && !fired) {
        fired = true;
        return { progress, done: true };
      }
      return { progress, done: false };
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
