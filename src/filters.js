// Smoothing for tracked input, no dependencies. The One-Euro filter (Casiez et al.) smooths a lot while the
// hand is slow (jitter is most visible then) and hardly at all while it is fast (lag is most visible then): its
// cutoff frequency grows with the speed, cutoff = minCutoff + beta x speed.

const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);

// One-Euro filter for a position { x, y, z }. Returns its own object each time.
export function createVecFilter({ minCutoff, beta, dCutoff }) {
  let x = null;
  const dx = { x: 0, y: 0, z: 0 };
  return {
    filter(v, dt) {
      if (x === null || dt <= 0) {
        if (x === null) x = { x: v.x, y: v.y, z: v.z };
        return { ...x };
      }
      const ad = alpha(dCutoff, dt);
      for (const k of ['x', 'y', 'z']) dx[k] += ((v[k] - x[k]) / dt - dx[k]) * ad;
      const a = alpha(minCutoff + beta * Math.hypot(dx.x, dx.y, dx.z), dt);
      for (const k of ['x', 'y', 'z']) x[k] += (v[k] - x[k]) * a;
      return { ...x };
    },
    reset() {
      x = null;
      dx.x = dx.y = dx.z = 0;
    },
  };
}

// One-Euro filter for an orientation { x, y, z, w }: the speed is the angular speed (rad/s), and the filtered
// orientation moves toward the input by spherical interpolation, always the short way round.
export function createQuatFilter({ minCutoff, beta, dCutoff }) {
  let q = null;
  let speed = 0;
  return {
    filter(input, dt) {
      if (q === null) {
        q = { ...input };
        return { ...q };
      }
      if (dt <= 0) return { ...q };
      let target = input;
      let dot = q.x * input.x + q.y * input.y + q.z * input.z + q.w * input.w;
      if (dot < 0) { // the same rotation with the other sign: take the short way
        target = { x: -input.x, y: -input.y, z: -input.z, w: -input.w };
        dot = -dot;
      }
      const angle = 2 * Math.acos(Math.min(1, dot));
      speed += (angle / dt - speed) * alpha(dCutoff, dt);
      const t = alpha(minCutoff + beta * speed, dt);
      // spherical interpolation from q toward target by t
      const theta = Math.acos(Math.min(1, dot));
      let wa;
      let wb;
      if (theta < 1e-6) {
        wa = 1 - t;
        wb = t;
      } else {
        wa = Math.sin((1 - t) * theta) / Math.sin(theta);
        wb = Math.sin(t * theta) / Math.sin(theta);
      }
      const out = { x: wa * q.x + wb * target.x, y: wa * q.y + wb * target.y, z: wa * q.z + wb * target.z, w: wa * q.w + wb * target.w };
      const length = Math.hypot(out.x, out.y, out.z, out.w);
      q = { x: out.x / length, y: out.y / length, z: out.z / length, w: out.w / length };
      return { ...q };
    },
    reset() {
      q = null;
      speed = 0;
    },
  };
}
