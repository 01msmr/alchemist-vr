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

export function spawnDrop(list, p, v, amount) {
  if (list.length >= MAX_DROPS) return false;
  list.push({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, amount });
  return true;
}

// Advances all drops under gravity. A drop that crosses the crucible's top plane inside the mouth
// lands in the crucible, on the rim ring it splashes off, anywhere else it falls to the table.
// target: { cx, cz, top, mouth, rim }; onLand(amount, 'crucible' | 'rim' | 'table').
export function stepDrops(list, dt, target, onLand) {
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    const prevY = d.y;
    d.vy -= GRAVITY * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;

    let where = null;
    if (prevY > target.top && d.y <= target.top) {
      const t = (prevY - target.top) / (prevY - d.y); // fraction of this step before the crossing
      const dist = Math.hypot(d.x - d.vx * dt * (1 - t) - target.cx, d.z - d.vz * dt * (1 - t) - target.cz);
      if (dist <= target.mouth) where = 'crucible';
      else if (dist <= target.rim) where = 'rim';
    }
    if (!where && d.y <= 0) where = 'table';
    if (where) {
      onLand(d.amount, where);
      list.splice(i, 1);
    }
  }
}
