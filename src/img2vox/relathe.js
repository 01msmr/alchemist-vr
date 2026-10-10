import { VoxelObject } from '../voxel-object.js';

// Draws a shell made by latheShell() again on a finer (or coarser) grid: the same bottle, `factor` times as many
// voxels per side. latheShell() makes a round shell from a profile (the width of every row) and a color per column,
// so both are read back from the old shell and revolved again: a one voxel wall, a closed bottom, an open top, the
// same palette (no new colors). `rows`: the new height in voxels (default: the old height times the factor).
export function relatheShell(shell, { factor, rows = Math.round(shell.size[1] * factor) }) {
  const [sx, sy, sz] = shell.size;
  const n = Math.max(1, Math.round(sx * factor));
  const profile = [];
  for (let y = 0; y < sy; y++) {
    let min = Infinity;
    let max = -1;
    const colors = new Array(sx).fill(0);
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) {
        const index = shell.get(x, y, z);
        if (!index) continue;
        min = Math.min(min, x);
        max = Math.max(max, x);
        if (!colors[x]) colors[x] = index;
      }
    }
    profile.push(max < 0 ? null : { min, max, radius: (max - min + 1) / 2, colors });
  }
  const filledRows = profile.map((p, y) => (p ? y : -1)).filter((y) => y >= 0);
  const nearestRow = (y) => filledRows.reduce((best, r) => (Math.abs(r - y) < Math.abs(best - y) ? r : best), filledRows[0]);

  const out = new VoxelObject([n, rows, n], new Uint8Array(n * rows * n), shell.palette);
  const cxOld = (sx - 1) / 2;
  const cx = (n - 1) / 2;
  const scale = n / sx;
  for (let y = 0; y < rows; y++) {
    const yo = Math.min(sy - 1, Math.max(0, ((y + 0.5) * sy) / rows - 0.5)); // this row in old rows
    const lo = profile[nearestRow(Math.floor(yo))];
    const hi = profile[nearestRow(Math.ceil(yo))];
    const t = yo - Math.floor(yo);
    const radius = (lo.radius * (1 - t) + hi.radius * t) * scale;
    const near = profile[nearestRow(Math.round(yo))];
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const d = Math.hypot(x - cx, z - cx);
        if (d > radius || (y > 0 && d <= radius - 1)) continue; // a one voxel wall, a closed bottom
        const column = Math.min(near.max, Math.max(near.min, Math.round(cxOld + (x - cx) / scale)));
        let index = near.colors[column];
        for (let step = 1; !index && step < sx; step++) index = near.colors[column - step] || near.colors[column + step];
        out.set(x, y, z, index);
      }
    }
  }
  return out;
}
