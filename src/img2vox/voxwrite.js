// Writes a MagicaVoxel .vox file (version 150, one model) from a Y-up VoxelObject: the inverse of parseVox.
// MagicaVoxel is Z-up: game (x, y, z) -> vox (x, sizeZ - 1 - z, y), size [sx, sz, sy].
export function writeVox(obj) {
  const [sx, sy, sz] = obj.size;
  const voxels = [];
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const i = obj.get(x, y, z);
        if (i) voxels.push([x, sz - 1 - z, y, i]);
      }
    }
  }
  const palette = new Uint8Array(256 * 4);
  for (let i = 1; i < 256; i++) {
    const c = obj.palette[i] ?? [0, 0, 0];
    palette.set([c[0], c[1], c[2], 255], (i - 1) * 4);
  }

  const chunk = (id, content, children = 0) => ({ id, content, children });
  const sizeData = new DataView(new ArrayBuffer(12));
  sizeData.setInt32(0, sx, true);
  sizeData.setInt32(4, sz, true);
  sizeData.setInt32(8, sy, true);
  const xyzi = new Uint8Array(4 + voxels.length * 4);
  new DataView(xyzi.buffer).setUint32(0, voxels.length, true);
  voxels.forEach((v, i) => xyzi.set(v, 4 + i * 4));
  const chunks = [chunk('SIZE', new Uint8Array(sizeData.buffer)), chunk('XYZI', xyzi), chunk('RGBA', palette)];

  const childBytes = chunks.reduce((sum, c) => sum + 12 + c.content.length, 0);
  const out = new Uint8Array(8 + 12 + childBytes);
  const view = new DataView(out.buffer);
  const tag = (offset, s) => [...s].forEach((ch, i) => { out[offset + i] = ch.charCodeAt(0); });
  tag(0, 'VOX ');
  view.setUint32(4, 150, true);
  tag(8, 'MAIN');
  view.setUint32(12, 0, true);
  view.setUint32(16, childBytes, true);
  let o = 20;
  for (const c of chunks) {
    tag(o, c.id);
    view.setUint32(o + 4, c.content.length, true);
    view.setUint32(o + 8, 0, true);
    out.set(c.content, o + 12);
    o += 12 + c.content.length;
  }
  return out.buffer;
}
