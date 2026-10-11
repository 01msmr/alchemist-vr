import * as THREE from 'three';
import { HAZARD } from '../config/index.js';
import { iconTexture } from '../icons.js';

// The symbol for the next step: one small picture that floats over the thing the player needs next, fades in and out.
export function createHintView(view) {
  const H = HAZARD.hint;
  const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  sprite.renderOrder = 5;
  view.world.add(sprite);
  // the salt ring hint also shows where to draw the ring: a thin white circle on the table around the gold
  const guide = new THREE.Mesh(new THREE.RingGeometry(0.068, 0.072, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  guide.visible = false;
  guide.renderOrder = 4;
  view.world.add(guide);
  let icon = '';
  let alpha = 0;
  const at = new THREE.Vector3();
  let placed = false;

  return {
    get alpha() { return alpha; },

    // hint: { icon } or null; where: Vector3 (table-local) or null; time: seconds
    update(dt, hint, where, time) {
      if (hint && hint.icon !== icon) {
        icon = hint.icon;
        material.map = iconTexture(icon, H.color, H.rim);
        material.needsUpdate = true;
        placed = false; // a new place: appear there, do not fly across the table
      }
      if (hint && where) {
        if (!placed) {
          at.copy(where);
          placed = true;
        } else {
          at.lerp(where, Math.min(1, dt * 6));
        }
      }
      alpha += ((hint ? 1 : 0) - alpha) * Math.min(1, dt * H.fade);
      if (alpha < 0.01 && !hint) alpha = 0;
      const showGuide = hint?.icon === 'ring' && alpha > 0.01;
      guide.visible = showGuide;
      if (showGuide) {
        guide.position.set(at.x, 0.0012, at.z);
        guide.material.opacity = alpha * 0.7;
      }
      sprite.visible = alpha > 0.01 && !showGuide; // the salt ring step is only a circle, no symbol over it
      material.opacity = alpha;
      sprite.scale.setScalar(H.size * (1 + 0.1 * Math.sin(time * 5)));
      sprite.position.set(at.x, at.y + Math.sin(time * 3) * H.bob, at.z);
    },
  };
}
