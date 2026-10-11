import { faMoon, faSun, faFlask, faHammer, faHorse, faFaceSmile, faFaceMeh, faSkull } from '@fortawesome/free-solid-svg-icons';

// Pictograms for the voxel buttons: Font Awesome Free (CC BY 4.0) paths drawn straight onto a small canvas and cut
// down to an n x n bitmap of '#' and '.' rows (row 0 is the back). No image files.
const ICONS = { moon: faMoon, sun: faSun, flask: faFlask, hammer: faHammer, horse: faHorse, smile: faFaceSmile, meh: faFaceMeh, skull: faSkull };
const SAMPLES = 8; // canvas pixels per bitmap cell along one side

// pure: n x n rows from the alpha values of a (n * SAMPLES)^2 RGBA image; a cell is set when it is at least `threshold` covered
export function coverageRows(rgba, size, n, threshold = 0.45) {
  const cell = size / n;
  const rows = [];
  for (let row = 0; row < n; row++) {
    let line = '';
    for (let col = 0; col < n; col++) {
      let sum = 0;
      for (let y = Math.floor(row * cell); y < Math.floor((row + 1) * cell); y++) {
        for (let x = Math.floor(col * cell); x < Math.floor((col + 1) * cell); x++) sum += rgba[(y * size + x) * 4 + 3];
      }
      line += sum / (255 * cell * cell) >= threshold ? '#' : '.';
    }
    rows.push(line);
  }
  return rows;
}

const cache = new Map();

// the bitmap of a named icon (needs a browser: canvas and Path2D)
export function iconRows(name, n) {
  const key = `${name}${n}`;
  if (cache.has(key)) return cache.get(key);
  const [width, height, , , path] = ICONS[name].icon;
  const size = n * SAMPLES;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const scale = size / Math.max(width, height);
  g.translate((size - width * scale) / 2, (size - height * scale) / 2);
  g.scale(scale, scale);
  g.fill(new Path2D(path));
  const rows = coverageRows(g.getImageData(0, 0, size, size).data, size, n);
  cache.set(key, rows);
  return rows;
}
