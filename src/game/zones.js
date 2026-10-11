// The protected areas on the table (pure): around everything a finger could pick up or press, a tap does not count as a calibration
// of the table. A zone is a circle { x, z, r } or a rectangle { x, z, hx, hz } (half sizes), already grown by the keep-away distance.

// How far a point (px, pz) is from the nearest zone's border: { margin, dx, dz, zone }.
//   margin > 0: that far outside every zone; margin < 0: inside one, by that much (the distance still missing to be clear);
//   (dx, dz): the direction to move away from the nearest zone (unit), zone: which one (or null when there are none)
export function clearance(zones, px, pz) {
  let best = { margin: Infinity, dx: 0, dz: 0, zone: null };
  for (const zone of zones) {
    let margin;
    let dx;
    let dz;
    if (zone.r !== undefined) {
      const ox = px - zone.x;
      const oz = pz - zone.z;
      const d = Math.hypot(ox, oz);
      margin = d - zone.r;
      dx = d > 1e-9 ? ox / d : 1;
      dz = d > 1e-9 ? oz / d : 0;
    } else {
      const ox = px - zone.x;
      const oz = pz - zone.z;
      const outX = Math.abs(ox) - zone.hx;
      const outZ = Math.abs(oz) - zone.hz;
      if (outX > 0 || outZ > 0) {
        margin = Math.hypot(Math.max(outX, 0), Math.max(outZ, 0));
        const len = margin || 1;
        dx = (Math.max(outX, 0) * Math.sign(ox)) / len;
        dz = (Math.max(outZ, 0) * Math.sign(oz)) / len;
      } else if (outX > outZ) { // inside: the nearest side is the way out
        margin = outX;
        dx = Math.sign(ox) || 1;
        dz = 0;
      } else {
        margin = outZ;
        dx = 0;
        dz = Math.sign(oz) || 1;
      }
    }
    if (margin < best.margin) best = { margin, dx, dz, zone };
  }
  return best;
}
