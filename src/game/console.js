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

// The pull cord: grab the bead; pull it down (`pull` m) and the game starts over, push it up (`push` m) and the level shown in the book
// starts with its perfect preconditions (to try a level without the ones before). Either fires once; let go early and it springs back to the middle.
// `y` values are heights of the fingertip (any frame, only differences count).
export function createCord({ pull, push, springTime }) {
  let pulled = 0; // positive: down, negative: up
  let anchor = 0;
  let grabbed = false;
  let fired = false;
  return {
    get pulled() { return pulled; },
    get progress() { return pulled >= 0 ? pulled / pull : pulled / push; }, // 0..1 pulling down, 0..-1 pushing up
    get grabbed() { return grabbed; },
    get canGrab() { return !fired; }, // not while it is still returning
    grab(y) {
      if (fired) return;
      grabbed = true;
      anchor = y + pulled;
    },
    drag(y) {
      if (grabbed) pulled = Math.min(pull, Math.max(-push, anchor - y));
    },
    release() { grabbed = false; },
    // each frame; 'restart' or 'preset' exactly once when the pull or the push is complete, else null
    step(dt) {
      let result = null;
      if (grabbed && !fired && (pulled >= pull || pulled <= -push)) {
        fired = true;
        result = pulled >= pull ? 'restart' : 'preset';
        grabbed = false;
      }
      if (!grabbed) {
        pulled *= Math.exp(-dt / springTime);
        if (Math.abs(pulled) < 1e-4) pulled = 0;
      }
      if (fired && Math.abs(pulled) < Math.min(pull, push) * 0.05) fired = false;
      return result;
    },
  };
}

// how many of `count` segments, counted from the top, are red at a progress 0..1
export const redSegments = (progress, count) => Math.round(Math.min(1, Math.max(0, progress)) * count);
