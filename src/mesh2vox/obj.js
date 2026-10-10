import { sampleTexture } from './texture.js';

// A Wavefront OBJ (and its MTL) as triangles for voxelize(): positions, a polygon is a fan of triangles, the color
// comes from the material (Kd) or, when the material has a texture and the faces have UVs, from the texture.
const DEFAULT_COLOR = [200, 200, 200];

// MTL text -> { name: { color: [r, g, b] (0..255), map: file or null } }
export function parseMtl(text) {
  const materials = {};
  let current = null;
  for (const raw of text.split('\n')) {
    const [word, ...rest] = raw.trim().split(/\s+/);
    if (word === 'newmtl') {
      current = { color: DEFAULT_COLOR, map: null };
      materials[rest.join(' ')] = current;
    } else if (current && word === 'Kd') {
      current.color = rest.slice(0, 3).map((v) => Math.round(Number(v) * 255));
    } else if (current && word === 'map_Kd') {
      current.map = rest[rest.length - 1];
    }
  }
  return materials;
}

// text -> triangles. materials: from parseMtl(); textureFor(file) -> { width, height, data: RGBA } or null.
export function parseObj(text, materials = {}, textureFor = () => null) {
  const positions = [];
  const uvs = [];
  const triangles = [];
  let material = null;
  const index = (token, count) => {
    const n = Number(token);
    return n < 0 ? count + n : n - 1;
  };
  for (const raw of text.split('\n')) {
    const [word, ...rest] = raw.trim().split(/\s+/);
    if (word === 'v') positions.push(rest.slice(0, 3).map(Number));
    else if (word === 'vt') uvs.push(rest.slice(0, 2).map(Number));
    else if (word === 'usemtl') material = materials[rest.join(' ')] ?? null;
    else if (word === 'f') {
      const corners = rest.map((token) => {
        const [v, vt] = token.split('/');
        return { p: positions[index(v, positions.length)], uv: vt ? uvs[index(vt, uvs.length)] : null };
      });
      const texture = material?.map ? textureFor(material.map) : null;
      for (let i = 1; i + 1 < corners.length; i++) {
        const [a, b, c] = [corners[0], corners[i], corners[i + 1]];
        const triangle = { a: a.p, b: b.p, c: c.p, color: material ? material.color : DEFAULT_COLOR };
        if (texture && a.uv && b.uv && c.uv) {
          triangle.colorAt = (wa, wb, wc) => sampleTexture(texture, wa * a.uv[0] + wb * b.uv[0] + wc * c.uv[0], wa * a.uv[1] + wb * b.uv[1] + wc * c.uv[1]);
        }
        triangles.push(triangle);
      }
    }
  }
  return triangles;
}
