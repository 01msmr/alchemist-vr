// The pieces of the old paper that need no browser: a seeded random, the frayed outline, word wrapping.

// a small deterministic random generator (0..1), so the paper looks the same every time
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The outline of a w x h sheet with torn edges: points around the sheet (clockwise from the top left), each pushed inward
// by a random amount up to `fray`; every corner is cut off by a tear of up to `chip`. [{ x, y }]
export function frayedOutline(w, h, { seed = 1, step = 9, fray = 7, chip = 38 } = {}) {
  const rand = mulberry32(seed);
  const points = [];
  const edge = (x0, y0, x1, y1, nx, ny) => {
    const length = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(length / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const d = rand() * fray * (rand() < 0.15 ? 2.2 : 1); // now and then a deeper bite
      points.push({ x: x0 + (x1 - x0) * t + nx * d, y: y0 + (y1 - y0) * t + ny * d });
    }
  };
  const cut = () => 0.35 * chip + rand() * 0.65 * chip;
  const [a, b, c, d] = [cut(), cut(), cut(), cut()]; // the four tears: top left, top right, bottom right, bottom left
  edge(a, 0, w - b, 0, 0, 1);
  edge(w - b, 0, w, b, -0.7, 0.7);
  edge(w, b, w, h - c, -1, 0);
  edge(w, h - c, w - c, h, -0.7, -0.7);
  edge(w - c, h, d, h, 0, -1);
  edge(d, h, 0, h - d, 0.7, -0.7);
  edge(0, h - d, 0, a, 1, 0);
  edge(0, a, a, 0, 0.7, 0.7);
  return points;
}

// Breaks `text` into lines no wider than `maxWidth`; `measure(string)` gives a width. A word wider than a line stays on its own.
export function wrapText(text, maxWidth, measure) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
