// The pixel of an RGBA texture ({ width, height, data }) at (u, v): v is up (0 at the bottom of the image; glTF's v is
// down, its callers pass 1 - v), u and v repeat, and exactly 1 is the last pixel.
export function sampleTexture(texture, u, v) {
  const wrap = (t) => (t > 0 && t % 1 === 0 ? 1 : t - Math.floor(t));
  const x = Math.min(texture.width - 1, Math.floor(wrap(u) * texture.width));
  const y = Math.min(texture.height - 1, Math.floor((1 - wrap(v)) * texture.height));
  const i = (y * texture.width + x) * 4;
  return [texture.data[i], texture.data[i + 1], texture.data[i + 2]];
}
