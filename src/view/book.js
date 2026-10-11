import * as THREE from 'three';
import '@fontsource/unifrakturcook/700.css';
import { LAYOUT, VIEW } from '../config/index.js';
import { LEVELS } from '../game/levels/index.js';
import { frayedOutline, mulberry32, wrapText } from '../paper.js';
import { spreadPosition } from '../game/book.js';
import { drawIcon, iconTexture } from '../icons.js';

// The instructions as a thick, old book lying open on the table: a leather cover with brass corners, stacks of pages on both
// sides (the more pages are on one side, the thicker it is), a leaf that turns when the page changes, a ribbon with a wax seal.
// Every level has a spread: the picture and the title on the left page, the steps on the right. A note in red ink can be
// written on a spread (what went wrong). The pages are pictures (canvas textures); the Fraktur font is bundled (OFL).
export function createBookView(view) {
  const V = VIEW.book;
  const B = LAYOUT.book;
  const W = B.pageW;
  const D = B.pageD;
  const count = LEVELS.length;
  const { width: PW, height: PH } = V.page;
  const roman = ['1.', '2.', '3.', '4.', '5.']; // (Roman numerals look like "JJJ" in Fraktur)
  const notes = Array(count).fill(null); // a red note per spread: { step (struck through), text } or null
  let fontReady = false;

  // ---- the pages as pictures ----
  const pages = LEVELS.map((_, k) => ({ L: makePage(), R: makePage() }));
  function makePage() {
    const canvas = document.createElement('canvas');
    canvas.width = PW;
    canvas.height = PH;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture };
  }

  function paper(g, k, side) {
    const rand = mulberry32((side === 'L' ? 5 : 50) + k);
    const outline = frayedOutline(PW - 8, PH - 8, { seed: 7 + 2 * k + (side === 'L' ? 0 : 1), fray: 3, chip: 12, step: 7 }).map((p) => ({ x: p.x + 4, y: p.y + 4 }));
    const shape = new Path2D();
    outline.forEach((q, i) => (i ? shape.lineTo(q.x, q.y) : shape.moveTo(q.x, q.y)));
    shape.closePath();
    g.clearRect(0, 0, PW, PH);
    g.save();
    g.clip(shape);
    const spineX = side === 'L' ? PW : 0; // darker toward the spine, where the pages curve down
    const fill = g.createLinearGradient(spineX, 0, PW - spineX, 0);
    fill.addColorStop(0, V.dark);
    fill.addColorStop(0.35, V.light);
    fill.addColorStop(1, V.light);
    g.fillStyle = fill;
    g.fillRect(0, 0, PW, PH);
    for (let i = 0; i < 7; i++) {
      const x = rand() * PW;
      const y = rand() * PH;
      const r = 40 + rand() * 100;
      const stain = g.createRadialGradient(x, y, 0, x, y, r);
      stain.addColorStop(0, V.stain);
      stain.addColorStop(1, 'rgba(120,85,40,0)');
      g.fillStyle = stain;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.strokeStyle = 'rgba(120,90,50,0.10)';
    g.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      const x = rand() * PW;
      const y = rand() * PH;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 22, y + (rand() - 0.5) * 22);
      g.stroke();
    }
    g.strokeStyle = 'rgba(110,80,40,0.45)'; // worn, darker edge
    for (const width of [22, 12, 6]) {
      g.lineWidth = width;
      g.stroke(shape);
    }
    g.restore();
  }

  function frame(g) { // a double rule around the page with small diamonds in the corners
    g.strokeStyle = V.ink;
    g.globalAlpha = 0.55;
    g.lineWidth = 2;
    g.strokeRect(26, 26, PW - 52, PH - 52);
    g.lineWidth = 1;
    g.strokeRect(33, 33, PW - 66, PH - 66);
    g.fillStyle = V.ink;
    for (const [x, y] of [[26, 26], [PW - 26, 26], [PW - 26, PH - 26], [26, PH - 26]]) {
      g.beginPath();
      g.moveTo(x, y - 7);
      g.lineTo(x + 7, y);
      g.lineTo(x, y + 7);
      g.lineTo(x - 7, y);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function drawPage(k, side) {
    const { canvas, texture } = pages[k][side];
    const g = canvas.getContext('2d');
    const guide = LEVELS[k].guide;
    paper(g, k, side);
    frame(g);
    g.fillStyle = V.ink;
    g.textBaseline = 'alphabetic';
    g.font = `700 ${V.bodyPx}px ${V.font}`;
    const number = 2 * k + (side === 'L' ? 2 : 3);
    g.textAlign = 'center';
    g.fillText(`— ${number} —`, PW / 2, PH - 54); // the page number
    if (side === 'L') {
      drawIcon(g, guide.icon, PW / 2, PH * 0.47, PW * 0.58, V.inkSoft); // a large faint picture
      g.font = `700 ${V.titlePx}px ${V.font}`;
      g.fillStyle = V.ink;
      const lines = wrapText(guide.title, PW - 2 * V.margin, (s) => g.measureText(s).width);
      lines.forEach((line, i) => g.fillText(line, PW / 2, V.margin + V.titlePx + i * V.titlePx * 1.1));
      const y = V.margin + V.titlePx * (1.1 * lines.length + 0.2);
      g.fillRect(V.margin + 30, y, PW - 2 * V.margin - 60, 2);
    } else {
      g.textAlign = 'left';
      g.font = `700 ${V.bodyPx}px ${V.font}`;
      let y = V.margin + V.bodyPx;
      const width = PW - 2 * V.margin;
      guide.steps.forEach((step, i) => {
        const lines = wrapText(step, width - 44, (s) => g.measureText(s).width);
        g.fillText(roman[i], V.margin - 4, y);
        lines.forEach((line) => {
          g.fillText(line, V.margin + 44, y);
          y += V.bodyPx * V.lineHeight;
        });
        if (notes[k]?.step === i) { // struck through, with a quick ink line
          g.strokeStyle = V.note;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(V.margin + 40, y - lines.length * V.bodyPx * V.lineHeight + V.bodyPx * 0.3);
          g.lineTo(V.margin + 44 + width * 0.8, y - V.bodyPx * 0.45);
          g.stroke();
        }
        y += V.bodyPx * 0.4;
      });
      if (notes[k]) { // a note in red ink under the steps
        g.fillStyle = V.note;
        g.save();
        g.translate(V.margin, y + V.bodyPx * 0.6);
        g.rotate(-0.03);
        wrapText(notes[k].text, width, (s) => g.measureText(s).width).forEach((line, i) => g.fillText(line, 0, i * V.bodyPx * V.lineHeight));
        g.restore();
      }
    }
    // the corner that turns the page: an arrow, faint where there is no page to turn to
    const arrow = side === 'L' ? 'left' : 'right';
    const none = side === 'L' ? k === 0 : k === count - 1;
    drawIcon(g, arrow, side === 'L' ? 70 : PW - 70, PH - 82, 38, none ? V.inkSoft : V.ink);
    drawIcon(g, arrow, side === 'L' ? 98 : PW - 98, PH - 82, 38, none ? V.inkSoft : V.ink);
    texture.needsUpdate = true;
  }
  const drawAll = () => pages.forEach((_, k) => { drawPage(k, 'L'); drawPage(k, 'R'); });
  drawAll();
  document.fonts?.load('700 40px "UnifrakturCook"').then(() => { fontReady = true; drawAll(); }).catch(() => {});

  // ---- the book ----
  const group = new THREE.Group();
  group.position.set(B.x, 0, B.z);
  group.rotation.y = B.yaw;
  view.world.add(group);
  const solid = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const m = V.margin3d;
  const T = V.coverThickness;

  const cover = new THREE.Mesh(new THREE.BoxGeometry(2 * W + 2 * m, T, D + 2 * m), solid(V.cover));
  cover.position.y = T / 2;
  group.add(cover);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const fitting = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.003, 0.016), solid(V.fitting));
      fitting.position.set(sx * (W + m - 0.006), T + 0.0015, sz * (D / 2 + m - 0.006));
      group.add(fitting);
    }
  }

  // the edges of a stack of pages: fine lines
  const edge = document.createElement('canvas');
  edge.width = 8;
  edge.height = 64;
  const eg = edge.getContext('2d');
  for (let y = 0; y < 64; y++) {
    eg.fillStyle = y % 4 === 0 ? '#b79c68' : y % 2 === 0 ? '#e6d6a8' : '#d8c590';
    eg.fillRect(0, y, 8, 1);
  }
  const edgeTexture = new THREE.CanvasTexture(edge);
  edgeTexture.colorSpace = THREE.SRGBColorSpace;
  const edgeMaterial = new THREE.MeshBasicMaterial({ map: edgeTexture });
  const cream = solid(0xe6d6a8);
  const stack = (sx) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, 1, D), [edgeMaterial, edgeMaterial, cream, cream, edgeMaterial, edgeMaterial]);
    mesh.position.x = sx * (W / 2);
    group.add(mesh);
    return mesh;
  };
  const stacks = { L: stack(-1), R: stack(1) };

  const pageMaterial = () => new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.FrontSide });
  const flat = (cx) => new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2).translate(cx, 0, 0);
  const leftPage = new THREE.Mesh(flat(-W / 2), pageMaterial());
  const rightPage = new THREE.Mesh(flat(W / 2), pageMaterial());
  group.add(leftPage, rightPage);

  // the turning leaf: hinged at the spine, the front is the right page it was, the back the left page it becomes
  const leaf = new THREE.Group();
  const front = new THREE.Mesh(flat(W / 2), pageMaterial());
  const backGeometry = flat(W / 2);
  const uv = backGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); // seen from above after the turn, the picture must read left to right
  const back = new THREE.Mesh(backGeometry, Object.assign(pageMaterial(), { side: THREE.BackSide }));
  leaf.add(front, back);
  leaf.visible = false;
  group.add(leaf);

  // a ribbon from the spine over the front edge, with a wax seal at its end
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.13).rotateX(-Math.PI / 2), solid(V.ribbon));
  ribbon.position.set(0.04, 0.0008, D / 2 + m + 0.045);
  group.add(ribbon);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.006, 14), solid(V.wax));
  seal.position.set(0.04, 0.003, D / 2 + m + 0.11);
  group.add(seal);
  const sealIcon = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: iconTexture(V.sealIcon, V.waxIcon, V.waxRim), transparent: true, depthWrite: false }));
  sealIcon.position.set(0.04, 0.0066, D / 2 + m + 0.11);
  group.add(sealIcon);

  // a small soft shadow under the whole book
  const sc = document.createElement('canvas');
  sc.width = 192;
  sc.height = 128;
  const sg = sc.getContext('2d');
  sg.filter = 'blur(8px)';
  sg.fillStyle = 'rgba(30,18,6,0.55)';
  sg.fillRect(24, 22, 144, 84);
  const shadowTexture = new THREE.CanvasTexture(sc);
  shadowTexture.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry((2 * W + 2 * m) * 1.3, (D + 2 * m) * 1.35).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  shadow.position.set(0.008, 0.0003, 0.012);
  shadow.renderOrder = 0;
  group.add(shadow);
  cover.renderOrder = 1;

  const set = (mesh, texture) => { if (mesh.material.map !== texture) { mesh.material.map = texture; mesh.material.needsUpdate = true; } };

  return {
    get notes() { return notes; },

    // a note in red ink on a spread (`step` is struck through), or null to wipe it
    setNote(k, note) {
      if (JSON.stringify(notes[k]) === JSON.stringify(note)) return;
      notes[k] = note;
      drawPage(k, 'R');
    },

    // book: { shown, anim } from game/book.js
    update(book) {
      const pos = spreadPosition(book);
      const hL = V.block.base + V.block.perPage * pos;
      const hR = V.block.base + V.block.perPage * (count - 1 - pos);
      stacks.L.scale.y = hL;
      stacks.L.position.y = T + hL / 2;
      stacks.R.scale.y = hR;
      stacks.R.position.y = T + hR / 2;
      leftPage.position.y = T + hL + 0.0004;
      rightPage.position.y = T + hR + 0.0004;
      const a = book.anim;
      if (!a) {
        set(leftPage, pages[book.shown].L.texture);
        set(rightPage, pages[book.shown].R.texture);
        leaf.visible = false;
        return;
      }
      const forward = a.to > a.from;
      const k = Math.min(1, a.t);
      const eased = k * k * (3 - 2 * k);
      const angle = forward ? eased * Math.PI : Math.PI - eased * Math.PI;
      set(front, pages[forward ? a.from : a.to].R.texture);
      set(back, pages[forward ? a.to : a.from].L.texture);
      set(leftPage, pages[forward ? a.from : a.to].L.texture);
      set(rightPage, pages[forward ? a.to : a.from].R.texture);
      leaf.visible = true;
      leaf.rotation.z = angle;
      leaf.position.y = T + hR + (hL - hR) * (angle / Math.PI) + 0.0014;
    },
  };
}
