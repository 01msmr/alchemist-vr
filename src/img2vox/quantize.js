// Deterministic k-means color quantization (farthest-point start, no randomness). colors: array of [r, g, b].
// Returns { palette: [[r, g, b], ...] (at most k, fewer if there are fewer distinct colors),
//           map: palette index for each input color }.
export function quantize(colors, k) {
  if (colors.length === 0) return { palette: [], map: [] };
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  // start: the first color, then repeatedly the color farthest from all chosen ones
  let centers = [colors[0].slice()];
  while (centers.length < k) {
    let far = -1;
    let farD = 0;
    colors.forEach((c, i) => {
      const d = Math.min(...centers.map((p) => dist(p, c)));
      if (d > farD) {
        farD = d;
        far = i;
      }
    });
    if (far < 0) break; // every color is already a center
    centers.push(colors[far].slice());
  }

  let map = new Array(colors.length).fill(0);
  for (let iteration = 0; iteration < 12; iteration++) {
    map = colors.map((c) => {
      let best = 0;
      let bd = Infinity;
      centers.forEach((p, pi) => {
        const d = dist(p, c);
        if (d < bd) {
          bd = d;
          best = pi;
        }
      });
      return best;
    });
    const sum = centers.map(() => [0, 0, 0, 0]);
    colors.forEach((c, i) => {
      const s = sum[map[i]];
      s[0] += c[0];
      s[1] += c[1];
      s[2] += c[2];
      s[3]++;
    });
    centers = centers.map((p, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : p));
  }
  return { palette: centers.map((p) => p.map(Math.round)), map };
}
