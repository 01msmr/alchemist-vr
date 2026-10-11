// The voxel morph, pure: a figure turns into another one by every voxel walking from its place in the first model to a place in
// the second. Both sets of voxels are put in the same order along a space-filling curve (so neighbors stay neighbors), the
// smaller one is stretched to the size of the larger one (a voxel splits into several), and voxel i walks to voxel i.

// the filled voxels of a model: [{ x, y, z, rgb }]
export function voxelsOf(obj) {
  const [sx, sy, sz] = obj.size;
  const list = [];
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const index = obj.get(x, y, z);
        if (index) list.push({ x, y, z, rgb: obj.palette[index] });
      }
    }
  }
  return list;
}

// the Z-order (Morton) key of a cell: the bits of x, y and z interleaved (cells up to 1023)
export function morton(x, y, z) {
  let key = 0;
  for (let bit = 0; bit < 10; bit++) {
    key += ((x >> bit) & 1) * 2 ** (3 * bit) + ((y >> bit) & 1) * 2 ** (3 * bit + 1) + ((z >> bit) & 1) * 2 ** (3 * bit + 2);
  }
  return key;
}

const sorted = (list) => [...list].sort((a, b) => morton(a.x, a.y, a.z) - morton(b.x, b.y, b.z) || a.y - b.y || a.x - b.x || a.z - b.z);

// Pairs of voxels, one from each model: { from, to } of the same length (the larger set's size), every voxel of both sets used.
export function matchSets(a, b) {
  const [fa, fb] = [sorted(a), sorted(b)];
  const n = Math.max(fa.length, fb.length);
  const stretch = (list) => Array.from({ length: n }, (_, i) => list[Math.min(list.length - 1, Math.floor((i * list.length) / n))]);
  const [from, to] = [stretch(fa), stretch(fb)];
  return from.map((f, i) => ({ from: f, to: to[i] }));
}

const smooth = (t) => t * t * (3 - 2 * t);

// where a pair is at time t (0..1), in grid units: straight from the start to the goal, with a lift and a swirl in between
// (`jitter`: { lift, swirlX, swirlZ }, a random per voxel, so the figure comes apart and builds up again)
export function morphPoint(pair, t, jitter) {
  const k = smooth(Math.max(0, Math.min(1, t)));
  const arc = Math.sin(Math.PI * k);
  return {
    x: pair.from.x + (pair.to.x - pair.from.x) * k + jitter.swirlX * arc,
    y: pair.from.y + (pair.to.y - pair.from.y) * k + jitter.lift * arc,
    z: pair.from.z + (pair.to.z - pair.from.z) * k + jitter.swirlZ * arc,
  };
}

// the color of a pair at time t: [r, g, b] 0..255
export function morphColor(pair, t) {
  const k = smooth(Math.max(0, Math.min(1, t)));
  return pair.from.rgb.map((c, i) => c + (pair.to.rgb[i] - c) * k);
}
