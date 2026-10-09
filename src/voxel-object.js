// Voxel data, Y-up. data[x + sx * (y + sy * z)] = palette index (0 = empty, 1..255).
// palette[i] = [r, g, b] in 0..255 for index i (palette[0] unused).
export class VoxelObject {
  constructor(size, data, palette) {
    this.size = size; // [sx, sy, sz]
    this.data = data;
    this.palette = palette;
  }

  static empty(sx, sy, sz, palette) {
    return new VoxelObject([sx, sy, sz], new Uint8Array(sx * sy * sz), palette);
  }

  get(x, y, z) {
    const [sx, sy, sz] = this.size;
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return 0;
    return this.data[x + sx * (y + sy * z)];
  }

  set(x, y, z, i) {
    const [sx, sy] = this.size;
    this.data[x + sx * (y + sy * z)] = i;
  }
}
