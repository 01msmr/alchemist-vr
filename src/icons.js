import * as THREE from 'three';
import { faMoon, faSun, faFlask, faHammer, faHorse, faFaceSmile, faFaceMeh, faSkull } from '@fortawesome/free-solid-svg-icons';

// Pictograms for the buttons: Font Awesome Free (CC BY 4.0) SVG paths, drawn onto a canvas at `size` pixels and used as
// a texture on a flat plane lying on the table (a picture, finer than the voxels around it; no image files).
const ICONS = { moon: faMoon, sun: faSun, flask: faFlask, hammer: faHammer, horse: faHorse, smile: faFaceSmile, meh: faFaceMeh, skull: faSkull };

const cache = new Map();

// the texture of a named icon in the given color (a CSS color string), transparent around it (needs a browser)
export function iconTexture(name, color, size = 128) {
  const key = `${name} ${color} ${size}`;
  if (cache.has(key)) return cache.get(key);
  const [width, height, , , path] = ICONS[name].icon;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const scale = size / Math.max(width, height);
  g.translate((size - width * scale) / 2, (size - height * scale) / 2);
  g.scale(scale, scale);
  g.fillStyle = color;
  g.fill(new Path2D(path));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4; // sharp when seen at a slant
  cache.set(key, texture);
  return texture;
}
