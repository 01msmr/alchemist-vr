import { CONSOLE as K, LAYOUT } from '../config/index.js';

// The settings console, pure: where the controls are, which one a point is over, the pockets in the table, the cord.
const { maxX } = LAYOUT.tableBounds;

// every button: { id: 'row:value', row (the setting), value, icon, x, z, halfX, halfZ, iconZ }; per row the first option is on the left
export function controls() {
  const { buttons, rows } = K;
  const half = (buttons.sizeVoxels * LAYOUT.voxel) / 2;
  return rows.flatMap((row) => row.options.map((option, i) => ({
    id: `${row.key}:${option.value}`,
    row: row.key,
    value: option.value,
    icon: option.icon,
    x: maxX - buttons.inset - buttons.pitch * (row.options.length - 1 - i),
    z: row.z,
    halfX: half,
    halfZ: half,
    iconZ: row.z - buttons.iconGap,
  })));
}

// the button a point (x, z) lies over, `margin` m outside its edge still counts; null when none
export function hitControl(x, z, margin = 0) {
  return controls().find((c) => Math.abs(x - c.x) <= c.halfX + margin && Math.abs(z - c.z) <= c.halfZ + margin) ?? null;
}

// the pockets as rectangles of whole voxels: { x0, x1, z0, z1 }
export function pockets() {
  const snap = (v) => Math.round(v / LAYOUT.voxel) * LAYOUT.voxel;
  return controls().map((c) => ({ x0: snap(c.x - c.halfX), x1: snap(c.x + c.halfX), z0: snap(c.z - c.halfZ), z1: snap(c.z + c.halfZ) }));
}

export const cordPosition = () => ({ x: maxX - K.cord.inset, z: K.cord.z });

// the pull cord: grab the bead, drag it down, at the full pull the cord fires once, let go and it springs back up.
// `y` values are heights of the fingertip (any frame, only differences count).
export function createCord({ pull, springTime }) {
  let pulled = 0;
  let anchor = 0;
  let grabbed = false;
  let fired = false;
  return {
    get pulled() { return pulled; },
    get progress() { return pulled / pull; },
    get grabbed() { return grabbed; },
    grab(y) {
      if (fired) return; // still returning from a restart
      grabbed = true;
      anchor = y + pulled;
    },
    drag(y) {
      if (grabbed) pulled = Math.min(pull, Math.max(0, anchor - y));
    },
    release() { grabbed = false; },
    // each frame; true exactly once when the pull is complete
    step(dt) {
      let fire = false;
      if (grabbed && pulled >= pull && !fired) {
        fired = true;
        fire = true;
        grabbed = false;
      }
      if (!grabbed) {
        pulled *= Math.exp(-dt / springTime);
        if (pulled < 1e-4) pulled = 0;
      }
      if (fired && pulled < pull * 0.05) fired = false;
      return fire;
    },
  };
}

// how many of `count` segments, counted from the top, are red at a progress 0..1
export const redSegments = (progress, count) => Math.round(Math.min(1, Math.max(0, progress)) * count);
