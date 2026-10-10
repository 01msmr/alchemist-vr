// Spilled mercury that stays on the table: a grid of voxel sized cells (0.75 cm), each holding some amount. A full cell
// passes the surplus to the nearest cell with room, so a spill grows into a round, thin puddle.
// The sizes are in config/game.js.
import { CFG } from '../config/index.js';

export const CELL = CFG.PUDDLE_CELL;
export const MAX_CELL = CFG.PUDDLE_CELL_MAX;
const RADIUS = CFG.PUDDLE_RADIUS_CELLS;

// cell offsets within RADIUS, nearest first
const OFFSETS = [];
for (let dz = -RADIUS; dz <= RADIUS; dz++) {
  for (let dx = -RADIUS; dx <= RADIUS; dx++) {
    if (dx * dx + dz * dz <= RADIUS * RADIUS) OFFSETS.push([dx, dz, dx * dx + dz * dz, Math.atan2(dz, dx)]);
  }
}
OFFSETS.sort((a, b) => a[2] - b[2] || a[3] - b[3]);

export function createPuddles(bounds) {
  const cells = new Map(); // "ix,iz" -> amount
  const kinds = new Map(); // "ix,iz" -> what it is (the latest to land there wins)
  const inside = (ix, iz) => ix * CELL >= bounds.minX && ix * CELL <= bounds.maxX && iz * CELL >= bounds.minZ && iz * CELL <= bounds.maxZ;
  const key = (ix, iz) => `${ix},${iz}`;

  const puddles = {
    cells,
    kinds,
    version: 0, // changes whenever the puddles do, so the renderer knows when to rebuild

    add(x, z, amount, kind = 'hg') {
      const ix = Math.round(x / CELL);
      const iz = Math.round(z / CELL);
      if (!inside(ix, iz)) return false; // off the table
      let remaining = amount;
      for (const [dx, dz] of OFFSETS) {
        if (remaining <= 1e-12) break;
        const cx = ix + dx;
        const cz = iz + dz;
        if (!inside(cx, cz)) continue;
        const k = key(cx, cz);
        const room = MAX_CELL - (cells.get(k) || 0);
        if (room <= 0) continue;
        const put = Math.min(room, remaining);
        cells.set(k, (cells.get(k) || 0) + put);
        kinds.set(k, kind);
        remaining -= put;
      }
      puddles.version++;
      return true;
    },

    total() {
      let sum = 0;
      for (const v of cells.values()) sum += v;
      return sum;
    },

    clear() {
      cells.clear();
      kinds.clear();
      puddles.version++;
    },
  };
  return puddles;
}
