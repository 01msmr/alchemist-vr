import * as THREE from 'three';
import { VIEW } from '../config/index.js';
import { wrapText } from '../paper.js';

// The fade to black and the title card. A black sphere around the head darkens the picture (it follows the head, so it works in the
// headset); the card (a Fraktur title with a line under it) floats in front of where you look when it appears and stays there.
export function createFade(view) {
  const T = VIEW.transition;
  const dark = new THREE.Mesh(new THREE.SphereGeometry(T.radius, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  dark.renderOrder = 1000;
  dark.frustumCulled = false;
  dark.visible = false;
  view.scene.add(dark);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round(1024 * (T.cardH / T.cardW));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(T.cardW, T.cardH), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  card.renderOrder = 1001;
  card.frustumCulled = false;
  card.visible = false;
  view.scene.add(card);

  const head = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const camera = () => (view.renderer.xr.isPresenting ? view.renderer.xr.getCamera() : view.camera);
  const frame = { dark: 0, card: 0 };

  function draw(title, subtitle) {
    const g = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = T.ink;
    g.font = `700 150px ${VIEW.book.font}`;
    g.fillText(title, w / 2, h * 0.4);
    g.fillRect(w * 0.3, h * 0.47, w * 0.4, 3); // a rule with a diamond in the middle
    g.beginPath();
    g.moveTo(w / 2, h * 0.47 - 11);
    g.lineTo(w / 2 + 11, h * 0.47 + 1.5);
    g.lineTo(w / 2, h * 0.47 + 14);
    g.lineTo(w / 2 - 11, h * 0.47 + 1.5);
    g.closePath();
    g.fill();
    g.fillStyle = T.inkSoft;
    g.font = `700 54px ${VIEW.book.font}`;
    wrapText(subtitle ?? '', w * 0.86, (s) => g.measureText(s).width).forEach((line, i) => g.fillText(line, w / 2, h * 0.64 + i * 66));
    texture.needsUpdate = true;
  }

  return {
    frame,

    // the card appears in front of where the player looks now
    showCard(title, subtitle) {
      draw(title, subtitle);
      const cam = camera();
      cam.getWorldPosition(head);
      cam.getWorldDirection(forward);
      card.position.copy(head).addScaledVector(forward, T.distance); // exactly where the player looks
      card.lookAt(head);
    },

    // f: { dark, card } from game/transition.js
    update(f) {
      frame.dark = f.dark;
      frame.card = f.card;
      dark.visible = f.dark > 0.001;
      if (dark.visible) {
        camera().getWorldPosition(head);
        dark.position.copy(head);
        dark.material.opacity = f.dark;
      }
      card.visible = f.card > 0.001;
      card.material.opacity = f.card;
    },
  };
}
