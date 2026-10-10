import { CFG } from './config.js';

export const GRAVITY = 9.81;
export const MAX_DROPS = 256;

// Initial velocity of a drop leaving the lip: spills over the rim along the horizontal part of the
// vial's up vector (downward once it points down), plus the velocity of the hand.
export function spillVelocity(up, flowFraction, handVel) {
  const speed = CFG.SPILL_MIN + CFG.SPILL_RANGE * flowFraction;
  const h = Math.hypot(up.x, up.z);
  return {
    x: (h > 1e-6 ? (up.x / h) * speed : 0) + handVel.x,
    y: (up.y < 0 ? up.y * speed : 0) + handVel.y,
    z: (h > 1e-6 ? (up.z / h) * speed : 0) + handVel.z,
  };
}

// kind: what the drop is made of ('hg' mercury, 'sulfur' grains)
export function spawnDrop(list, p, v, amount, kind = 'hg') {
  if (list.length >= MAX_DROPS) return false;
  list.push({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, amount, kind });
  return true;
}

// Advances all drops under gravity. A drop that crosses the crucible's top plane inside the mouth
// lands in the crucible, on the rim ring it splashes off, anywhere else it falls to the table.
// target: { cx, cz, top, mouth, rim }; onLand(amount, 'crucible' | 'rim' | 'table', x, z, kind).
export function stepDrops(list, dt, target, onLand) {
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    const prevY = d.y;
    d.vy -= GRAVITY * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;

    // where the drop was when it crossed a horizontal plane at `level` during this step
    const crossing = (level) => {
      const t = prevY === d.y ? 1 : (prevY - level) / (prevY - d.y);
      return { x: d.x - d.vx * dt * (1 - t), z: d.z - d.vz * dt * (1 - t) };
    };
    let where = null;
    let at = null;
    if (prevY > target.top && d.y <= target.top) {
      at = crossing(target.top);
      const dist = Math.hypot(at.x - target.cx, at.z - target.cz);
      if (dist <= target.mouth) where = 'crucible';
      else if (dist <= target.rim) where = 'rim';
      else at = null;
    }
    if (!where && d.y <= 0) {
      where = 'table';
      at = prevY > 0 ? crossing(0) : { x: d.x, z: d.z };
    }
    if (where) {
      onLand(d.amount, where, at.x, at.z, d.kind);
      list.splice(i, 1);
    }
  }
}
