import * as THREE from 'three';
import { HAZARD, LAYOUT } from '../config/index.js';
import { iconTexture } from '../icons.js';

// The signs over the crucible: sparks and smoke that grow with the hazard (smoke from grey to black), a burst of smoke when
// it fails, and a symbol that hovers over the crucible (a flame when it gets too hot, arrows when it must be stirred, a skull
// after a failure).
export function createHazardView(view) {
  const H = HAZARD;
  const c = LAYOUT.crucible;
  const voxel = LAYOUT.voxel;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), H.maxParticles);
  mesh.setColorAt(0, new THREE.Color(0xffffff));
  mesh.frustumCulled = false;
  mesh.count = 0;
  view.world.add(mesh);

  const spark = new THREE.Color(H.sparks.color);
  const grey = new THREE.Color(H.smoke.grey);
  const black = new THREE.Color(H.smoke.black);
  const parts = []; // { x, y, z, vx, vy, vz, life, max, size, color }
  let smokeAcc = 0;
  let sparkAcc = 0;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const none = new THREE.Quaternion();
  const color = new THREE.Color();

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  sprite.visible = false;
  sprite.renderOrder = 5;
  view.world.add(sprite);
  let iconKey = '';

  function emit(kind, tint) {
    if (parts.length >= H.maxParticles) return;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.03;
    const isSpark = kind === 'spark';
    parts.push({
      x: c.x + Math.cos(a) * r, y: c.top + 0.01, z: c.z + Math.sin(a) * r,
      vx: (Math.random() - 0.5) * (isSpark ? 0.25 : 0.06), vy: isSpark ? H.sparks.speed * (0.6 + Math.random() * 0.8) : H.smoke.rise * (0.7 + Math.random() * 0.6), vz: (Math.random() - 0.5) * (isSpark ? 0.25 : 0.06),
      life: 0, max: (isSpark ? H.sparks.life : H.smoke.life) * (0.7 + Math.random() * 0.6), size: (isSpark ? H.sparks.size : H.smoke.size) * voxel,
      color: isSpark ? spark.clone() : tint.clone(),
      gravity: isSpark ? 0.5 : 0,
    });
  }

  return {
    // a failure: a burst of smoke (black when it burnt, grey otherwise)
    burst(kind) {
      const tint = kind === 'burnt' ? black : kind === 'slag' ? new THREE.Color(0x3b3a3a) : grey;
      for (let i = 0; i < H.burst.count; i++) emit('smoke', tint);
    },

    // level: the hazard 0..1; icon: { name, color } or null; time: seconds
    update(dt, level, icon, time) {
      if (level >= H.warnFrom) {
        const t = (level - H.warnFrom) / (1 - H.warnFrom);
        smokeAcc += H.smoke.perSecondMax * t * dt;
        sparkAcc += (4 + 20 * t) * dt;
        const tint = color.copy(grey).lerp(black, t);
        for (; smokeAcc >= 1; smokeAcc -= 1) emit('smoke', tint);
        for (; sparkAcc >= 1; sparkAcc -= 1) emit('spark', spark);
      } else {
        smokeAcc = 0;
        sparkAcc = 0;
      }
      let n = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life >= p.max) {
          parts.splice(i, 1);
          continue;
        }
        p.vy -= p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
      for (const p of parts) {
        const k = p.life / p.max;
        const size = p.size * (p.gravity ? 1 - k * 0.5 : 0.8 + k * 1.4); // sparks shrink, smoke puffs up
        mesh.setMatrixAt(n, matrix.compose(position.set(p.x, p.y, p.z), none, scale.set(size, size, size)));
        mesh.setColorAt(n, p.color);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

      sprite.visible = !!icon;
      if (icon) {
        const key = `${icon.name} ${icon.color}`;
        if (key !== iconKey) {
          iconKey = key;
          sprite.material.map = iconTexture(icon.name, icon.color, H.icon.rim);
          sprite.material.needsUpdate = true;
        }
        const pulse = 1 + 0.12 * Math.sin(time * 9);
        sprite.scale.setScalar(H.icon.size * pulse);
        sprite.position.set(c.x, c.top + H.icon.height + Math.sin(time * 3) * H.icon.bob, c.z);
      }
    },
  };
}
