// Is the gold inside a closed ring of salt? The salt is a set of cells (voxel sized); a flood from the gold's cell must
// stay inside. Cells are blocked by salt, or by salt within `gapTol` cells (so a small gap still counts as closed).
// salt: Set of 'ix,iz'; center: { ix, iz }; options: { maxRadius (cells), minArea (cells), gapTol (cells) }.
// Returns { closed, area }.
export function ringClosed(salt, center, { maxRadius, minArea, gapTol = 0 }) {
  const key = (ix, iz) => `${ix},${iz}`;
  const blocked = (ix, iz) => {
    for (let dz = -gapTol; dz <= gapTol; dz++) for (let dx = -gapTol; dx <= gapTol; dx++) if (salt.has(key(ix + dx, iz + dz))) return true;
    return false;
  };
  if (blocked(center.ix, center.iz)) return { closed: false, area: 0 };

  const seen = new Set([key(center.ix, center.iz)]);
  const queue = [[center.ix, center.iz]];
  for (let i = 0; i < queue.length; i++) {
    const [ix, iz] = queue[i];
    if (Math.hypot(ix - center.ix, iz - center.iz) > maxRadius) return { closed: false, area: seen.size }; // it got out
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // four neighbors: a diagonal line of salt is a wall
      const next = key(ix + dx, iz + dz);
      if (seen.has(next) || blocked(ix + dx, iz + dz)) continue;
      seen.add(next);
      queue.push([ix + dx, iz + dz]);
    }
  }
  return { closed: seen.size >= minArea, area: seen.size };
}

// the salt cells of a puddle map: cells whose latest substance is salt
export function saltCells(cells, kinds) {
  const salt = new Set();
  for (const [cell, amount] of cells) if (amount > 0 && kinds.get(cell) === 'salt') salt.add(cell);
  return salt;
}
