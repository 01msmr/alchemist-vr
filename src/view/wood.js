import * as THREE from 'three';
import { mulberry32 } from '../paper.js';

// An oak table top as a picture: planks across the table with long grain along x, rings, a few knots, pores. Drawn once
// onto a canvas (seeded, so it is the same every time); mapped by the caller (the top of a 1.6 x 0.8 m table).
export function oakTexture({ width = 1024, height = 512, planks = 4, seed = 21 } = {}) {
  const rand = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const plankHeight = height / planks;
  const base = [[186, 140, 84], [176, 130, 76], [192, 148, 92], [180, 134, 80]]; // each plank a little different

  for (let p = 0; p < planks; p++) {
    const [r, gr, b] = base[p % base.length];
    g.save();
    g.beginPath();
    g.rect(0, p * plankHeight, width, plankHeight);
    g.clip();
    g.fillStyle = `rgb(${r},${gr},${b})`;
    g.fillRect(0, p * plankHeight, width, plankHeight);
    // long grain lines, bending slowly
    for (let i = 0; i < 70; i++) {
      const y0 = p * plankHeight + rand() * plankHeight;
      const amplitude = 1 + rand() * 4;
      const wave = 0.004 + rand() * 0.01;
      const phase = rand() * 6.28;
      g.strokeStyle = rand() < 0.6 ? `rgba(95,60,28,${0.08 + rand() * 0.14})` : `rgba(235,195,140,${0.06 + rand() * 0.1})`;
      g.lineWidth = 0.6 + rand() * 1.8;
      g.beginPath();
      for (let x = 0; x <= width; x += 16) {
        const y = y0 + Math.sin(x * wave + phase) * amplitude + Math.sin(x * wave * 3.1 + phase * 2) * amplitude * 0.3;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    // a knot: rings that the grain bends around
    if (p % 2 === 0) {
      const kx = width * (0.15 + rand() * 0.7);
      const ky = p * plankHeight + plankHeight * (0.3 + rand() * 0.4);
      for (let ring = 6; ring >= 1; ring--) {
        g.strokeStyle = `rgba(80,48,20,${0.12 + 0.05 * (6 - ring)})`;
        g.lineWidth = 1.4;
        g.beginPath();
        g.ellipse(kx, ky, ring * 7 + 5, ring * 2.6 + 2, 0, 0, 2 * Math.PI);
        g.stroke();
      }
      g.fillStyle = 'rgba(70,40,16,0.65)';
      g.beginPath();
      g.ellipse(kx, ky, 6, 3, 0, 0, 2 * Math.PI);
      g.fill();
    }
    // pores: short dark dashes along the grain
    g.fillStyle = 'rgba(70,42,20,0.35)';
    for (let i = 0; i < 260; i++) g.fillRect(rand() * width, p * plankHeight + rand() * plankHeight, 3 + rand() * 9, 1);
    g.restore();
    if (p > 0) { // the seam between two planks
      g.fillStyle = 'rgba(55,32,14,0.75)';
      g.fillRect(0, p * plankHeight - 1, width, 2.5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
