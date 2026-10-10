import { VoxelObject } from '../voxel-object.js';
import { quantize } from '../img2vox/quantize.js';

// Triangles in, a voxel model out. A triangle is { a, b, c } (points [x, y, z]) plus its color: `color` [r, g, b] or
// `colorAt(wa, wb, wc)` (barycentric weights of the point on the triangle). The model is scaled so its height (the y
// extent) is `height` voxels, centered in x and z and resting on y = 0, and its colors are reduced to `colors`.
// `hollow` keeps only the one voxel thick surface; otherwise the inside is filled (a surface with holes cannot be
// filled: the fill leaks out). `up: 'z'` first turns a Z-up model upright.
// Returns a VoxelObject (palette index 0 = empty).

const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];

// does the triangle (points relative to the box center) touch the box of half size `h`? (Akenine-Moller)
function triangleTouchesBox(v0, v1, v2, h) {
  const verts = [v0, v1, v2];
  const edges = [sub(v1, v0), sub(v2, v1), sub(v0, v2)];
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (const e of edges) {
    for (const ax of axes) {
      const axis = cross(ax, e);
      if (axis[0] === 0 && axis[1] === 0 && axis[2] === 0) continue;
      const p = verts.map((v) => dot(v, axis));
      const r = h * (Math.abs(axis[0]) + Math.abs(axis[1]) + Math.abs(axis[2]));
      if (Math.min(...p) > r || Math.max(...p) < -r) return false;
    }
  }
  for (let a = 0; a < 3; a++) {
    if (Math.min(v0[a], v1[a], v2[a]) > h || Math.max(v0[a], v1[a], v2[a]) < -h) return false;
  }
  const n = cross(edges[0], edges[1]);
  const r = h * (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]));
  const d = dot(n, v0);
  return Math.abs(d) <= r;
}

// barycentric weights of the point on the triangle plane nearest to p, kept inside the triangle
function weightsAt(p, a, b, c) {
  const v0 = sub(b, a);
  const v1 = sub(c, a);
  const v2 = sub(p, a);
  const d00 = dot(v0, v0);
  const d01 = dot(v0, v1);
  const d11 = dot(v1, v1);
  const d20 = dot(v2, v0);
  const d21 = dot(v2, v1);
  const den = d00 * d11 - d01 * d01;
  if (Math.abs(den) < 1e-12) return [1, 0, 0];
  let v = (d11 * d20 - d01 * d21) / den;
  let w = (d00 * d21 - d01 * d20) / den;
  v = Math.max(0, v);
  w = Math.max(0, w);
  const sum = v + w;
  if (sum > 1) {
    v /= sum;
    w /= sum;
  }
  return [1 - v - w, v, w];
}

export function voxelize(input, { height, colors = 24, hollow = false, up = 'y' }) {
  if (input.length === 0) throw new Error('no triangles in the model');
  const turn = up === 'z' ? ([x, y, z]) => [x, z, -y] : (p) => p;
  const triangles = input.map((t) => ({ ...t, a: turn(t.a), b: turn(t.b), c: turn(t.c) }));

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const t of triangles) {
    for (const p of [t.a, t.b, t.c]) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i]);
        max[i] = Math.max(max[i], p[i]);
      }
    }
  }
  const extent = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (extent[1] <= 1e-9) throw new Error('the model is flat: it has no height to scale to');
  const scale = height / extent[1];
  const size = [Math.max(1, Math.ceil(extent[0] * scale - 1e-9)), height, Math.max(1, Math.ceil(extent[2] * scale - 1e-9))];
  const shift = [(size[0] - extent[0] * scale) / 2, 0, (size[2] - extent[2] * scale) / 2];
  const toGrid = (p) => [(p[0] - min[0]) * scale + shift[0], (p[1] - min[1]) * scale, (p[2] - min[2]) * scale + shift[2]];

  const [sx, sy, sz] = size;
  const at = (x, y, z) => x + sx * (y + sy * z);
  const sum = new Float64Array(sx * sy * sz * 3);
  const count = new Uint16Array(sx * sy * sz);

  // the surface: every cell a triangle touches takes the average color of the triangles there
  for (const t of triangles) {
    const a = toGrid(t.a);
    const b = toGrid(t.b);
    const c = toGrid(t.c);
    const cell = (v, i) => Math.min(size[i] - 1, Math.max(0, Math.floor(v))); // a face on the far edge of the grid belongs to the last cell
    const lo = [0, 1, 2].map((i) => cell(Math.min(a[i], b[i], c[i]), i));
    const hi = [0, 1, 2].map((i) => cell(Math.max(a[i], b[i], c[i]), i));
    for (let z = lo[2]; z <= hi[2]; z++) {
      for (let y = lo[1]; y <= hi[1]; y++) {
        for (let x = lo[0]; x <= hi[0]; x++) {
          const center = [x + 0.5, y + 0.5, z + 0.5];
          if (!triangleTouchesBox(sub(a, center), sub(b, center), sub(c, center), 0.5)) continue;
          const color = t.colorAt ? t.colorAt(...weightsAt(center, a, b, c)) : t.color;
          const i = at(x, y, z);
          sum[i * 3] += color[0];
          sum[i * 3 + 1] += color[1];
          sum[i * 3 + 2] += color[2];
          count[i]++;
        }
      }
    }
  }
  const voxelColor = new Array(sx * sy * sz).fill(null);
  for (let i = 0; i < count.length; i++) {
    if (count[i]) voxelColor[i] = [sum[i * 3] / count[i], sum[i * 3 + 1] / count[i], sum[i * 3 + 2] / count[i]];
  }
  if (!hollow) fillInside(voxelColor, size);

  // the palette: the colors of the voxels, reduced
  const cells = [];
  const list = [];
  voxelColor.forEach((color, i) => {
    if (color) {
      cells.push(i);
      list.push(color);
    }
  });
  const { palette, map } = quantize(list, colors);
  const obj = new VoxelObject(size, new Uint8Array(sx * sy * sz), [[0, 0, 0], ...palette]);
  cells.forEach((cell, n) => { obj.data[cell] = map[n] + 1; });
  return obj;
}

// Fills the inside of a closed surface: the cells the outside cannot reach. They take the color of the nearest surface
// voxel (spread inward layer by layer).
function fillInside(voxelColor, [sx, sy, sz]) {
  const at = (x, y, z) => x + sx * (y + sy * z);
  const outside = new Uint8Array(sx * sy * sz);
  const stack = [];
  const visit = (x, y, z) => {
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return;
    const i = at(x, y, z);
    if (outside[i] || voxelColor[i]) return;
    outside[i] = 1;
    stack.push([x, y, z]);
  };
  for (let a = 0; a < sx; a++) for (let b = 0; b < sy; b++) { visit(a, b, 0); visit(a, b, sz - 1); }
  for (let a = 0; a < sx; a++) for (let b = 0; b < sz; b++) { visit(a, 0, b); visit(a, sy - 1, b); }
  for (let a = 0; a < sy; a++) for (let b = 0; b < sz; b++) { visit(0, a, b); visit(sx - 1, a, b); }
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  while (stack.length) {
    const [x, y, z] = stack.pop();
    for (const [dx, dy, dz] of dirs) visit(x + dx, y + dy, z + dz);
  }
  let front = [];
  voxelColor.forEach((color, i) => { if (color) front.push(i); });
  while (front.length) {
    const next = [];
    for (const i of front) {
      const x = i % sx;
      const y = Math.floor(i / sx) % sy;
      const z = Math.floor(i / (sx * sy));
      for (const [dx, dy, dz] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
        const j = at(nx, ny, nz);
        if (voxelColor[j] || outside[j]) continue;
        voxelColor[j] = voxelColor[i];
        next.push(j);
      }
    }
    front = next;
  }
}
