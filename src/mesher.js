// Visible-face mesher with per-vertex ambient occlusion. Pure data, no three.js.
// Output is in world units (voxelSize per voxel), centered on x/z, y starting at 0.

const AO_BRIGHTNESS = [0.5, 0.7, 0.85, 1];
// Corner order (du, dv); with U x V = normal this winds counter-clockwise.
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
// Per axis: [U axis, V axis] such that U x V = +axis.
const TANGENTS = [[1, 2], [2, 0], [0, 1]];

const srgbToLinear = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function meshVoxelObject(obj, voxelSize = 0.01) {
  const [sx, sy, sz] = obj.size;
  const offset = [-sx / 2, 0, -sz / 2];
  const linear = obj.palette.map((c) => c.map(srgbToLinear));
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];

  const solid = (x, y, z) => (obj.get(x, y, z) ? 1 : 0);

  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const index = obj.get(x, y, z);
        if (!index) continue;
        const p = [x, y, z];

        for (let axis = 0; axis < 3; axis++) {
          for (const sign of [1, -1]) {
            const n = [0, 0, 0];
            n[axis] = sign;
            if (solid(x + n[0], y + n[1], z + n[2])) continue;

            const [ua, va] = TANGENTS[axis];
            const base = positions.length / 3;
            const ao = [];

            for (const [du, dv] of CORNERS) {
              const at = (a, b) => {
                const q = [p[0] + n[0], p[1] + n[1], p[2] + n[2]];
                q[ua] += a * du;
                q[va] += b * dv;
                return solid(q[0], q[1], q[2]);
              };
              const side1 = at(1, 0);
              const side2 = at(0, 1);
              const corner = at(1, 1);
              ao.push(side1 && side2 ? 0 : 3 - (side1 + side2 + corner));

              const v = [p[0] + 0.5 + n[0] * 0.5, p[1] + 0.5 + n[1] * 0.5, p[2] + 0.5 + n[2] * 0.5];
              v[ua] += du * 0.5;
              v[va] += dv * 0.5;
              positions.push((v[0] + offset[0]) * voxelSize, (v[1] + offset[1]) * voxelSize, (v[2] + offset[2]) * voxelSize);
              normals.push(n[0], n[1], n[2]);
              const b = AO_BRIGHTNESS[ao[ao.length - 1]];
              const c = linear[index];
              colors.push(c[0] * b, c[1] * b, c[2] * b);
            }

            // Split along the diagonal that avoids AO interpolation artifacts.
            const flip = ao[0] + ao[2] < ao[1] + ao[3];
            const tris = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
            if (sign < 0) tris.reverse();
            for (const t of tris) indices.push(base + t);
          }
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  };
}
