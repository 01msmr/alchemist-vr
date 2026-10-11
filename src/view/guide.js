import * as THREE from 'three';
import '@fontsource/unifrakturcook/700.css';
import { LAYOUT, VIEW } from '../config/index.js';
import { LEVELS } from '../game/levels/index.js';
import { frayedOutline, mulberry32, wrapText } from '../paper.js';

// The instructions of the current level on a sheet of old, beige paper with torn edges, written in Fraktur, lying on the
// table left of the experiment: a picture (canvas texture) on a flat plane. The font is bundled (OFL).
export function createGuide(view) {
  const P = VIEW.paper;
  const G = LAYOUT.guide;
  const canvas = document.createElement('canvas');
  canvas.width = P.width;
  canvas.height = P.height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(G.w, G.d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  // a small soft shadow under the sheet, a little toward the player and to the right
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 160;
  const sg = shadowCanvas.getContext('2d');
  sg.filter = 'blur(7px)';
  sg.fillStyle = 'rgba(30,18,6,0.55)';
  sg.fillRect(22, 22, 84, 116);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  shadowTexture.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(G.w * 1.25, G.d * 1.25).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  shadow.position.set(G.x + 0.008, P.lift * 0.5, G.z + 0.01);
  shadow.rotation.y = G.yaw;
  shadow.renderOrder = 0;
  view.world.add(shadow);
  mesh.position.set(G.x, P.lift, G.z);
  mesh.rotation.y = G.yaw;
  mesh.renderOrder = 1;
  view.world.add(mesh);

  const outline = frayedOutline(P.width - 24, P.height - 24, { seed: 11 }).map((p) => ({ x: p.x + 12, y: p.y + 12 }));
  const path = () => {
    const p = new Path2D();
    outline.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
    p.closePath();
    return p;
  };

  // the paper itself, without text: torn outline, a stained beige, dark worn edges
  function paper(g) {
    const rand = mulberry32(3);
    g.clearRect(0, 0, P.width, P.height);
    const shape = path();
    g.save();
    g.clip(shape);
    const fill = g.createRadialGradient(P.width * 0.45, P.height * 0.4, 60, P.width / 2, P.height / 2, P.height * 0.75);
    fill.addColorStop(0, P.light);
    fill.addColorStop(1, P.dark);
    g.fillStyle = fill;
    g.fillRect(0, 0, P.width, P.height);
    for (let i = 0; i < 9; i++) { // stains
      const x = rand() * P.width;
      const y = rand() * P.height;
      const r = 50 + rand() * 130;
      const stain = g.createRadialGradient(x, y, 0, x, y, r);
      stain.addColorStop(0, P.stain);
      stain.addColorStop(1, 'rgba(120,85,40,0)');
      g.fillStyle = stain;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.strokeStyle = 'rgba(120,90,50,0.10)'; // fibers
    g.lineWidth = 1;
    for (let i = 0; i < 380; i++) {
      const x = rand() * P.width;
      const y = rand() * P.height;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 26, y + (rand() - 0.5) * 26);
      g.stroke();
    }
    g.strokeStyle = P.edge; // the worn edge: wide and soft, darkening toward the border
    for (const width of [34, 20, 10]) {
      g.lineWidth = width;
      g.stroke(shape);
    }
    g.restore();
    g.strokeStyle = 'rgba(80,55,25,0.6)';
    g.lineWidth = 2;
    g.stroke(shape);
  }

  let drawn = null; // what the paper shows now: the level and whether the font was ready
  function draw(level, fontReady) {
    const g = canvas.getContext('2d');
    paper(g);
    const guide = LEVELS[level - 1]?.guide;
    if (!guide) return;
    const width = P.width - 2 * P.margin;
    g.fillStyle = P.ink;
    g.textBaseline = 'alphabetic';
    g.font = `700 ${P.titlePx}px ${P.font}`;
    g.textAlign = 'center';
    let y = P.margin + P.titlePx;
    g.fillText(guide.title, P.width / 2, y);
    y += P.titlePx * 0.45;
    g.fillRect(P.margin + 40, y, width - 80, 2); // a rule under the title
    y += P.bodyPx * 1.4;
    g.font = `700 ${P.bodyPx}px ${P.font}`;
    g.textAlign = 'left';
    guide.steps.forEach((step, i) => {
      const lines = wrapText(step, width - 78, (s) => g.measureText(s).width);
      g.fillText(`${i + 1}.`, P.margin - 6, y); // (Roman numerals look like "JJJ" in Fraktur)
      for (const line of lines) {
        g.fillText(line, P.margin + 78, y);
        y += P.bodyPx * P.lineHeight;
      }
      y += P.bodyPx * 0.35;
    });
    texture.needsUpdate = true;
    drawn = { level, fontReady };
  }

  let fontReady = false;
  document.fonts?.load(`700 40px "UnifrakturCook"`).then(() => { fontReady = true; }).catch(() => { fontReady = true; }); // draw again when the font is there

  return {
    // each frame: shows the instructions of `level` (redrawn only when it or the font changes)
    update(level) {
      if (!drawn || drawn.level !== level || drawn.fontReady !== fontReady) draw(level, fontReady);
    },
  };
}
