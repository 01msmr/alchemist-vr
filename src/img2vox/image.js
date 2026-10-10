// Minimal RGBA image helpers: { width, height, data: Uint8Array(w * h * 4) }, no dependencies.

// The smallest rectangle containing all pixels with alpha >= threshold (inclusive bounds).
export function boundingBox(img, threshold = 128) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] < threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('the image has no opaque pixels');
  return { minX, minY, maxX, maxY };
}

export function crop(img, box) {
  const width = box.maxX - box.minX + 1;
  const height = box.maxY - box.minY + 1;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const from = ((box.minY + y) * img.width + box.minX) * 4;
    data.set(img.data.subarray(from, from + width * 4), y * width * 4);
  }
  return { width, height, data };
}

// Box-filter downscale. The color is the average of the covered pixels weighted by their alpha, so
// transparent areas do not darken it; the alpha is the covered fraction.
export function resizeArea(img, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let dy = 0; dy < height; dy++) {
    const y0 = Math.floor((dy * img.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * img.height) / height));
    for (let dx = 0; dx < width; dx++) {
      const x0 = Math.floor((dx * img.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * img.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * img.width + x) * 4;
          const w = img.data[i + 3];
          r += img.data[i] * w;
          g += img.data[i + 1] * w;
          b += img.data[i + 2] * w;
          a += w;
          n++;
        }
      }
      const o = (dy * width + dx) * 4;
      if (a > 0) {
        data[o] = Math.round(r / a);
        data[o + 1] = Math.round(g / a);
        data[o + 2] = Math.round(b / a);
      }
      data[o + 3] = Math.round(a / n);
    }
  }
  return { width, height, data };
}
