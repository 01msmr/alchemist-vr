import * as THREE from 'three';
import { LAYOUT } from '../config/index.js';

// The protected areas on the table in white (where a tap does not count as a calibration), and at a finger inside one a white
// bar that shows how far it still has to move, and in which direction, to be clear.
const MAX_ZONES = 48;

export function createZonesView(view) {
  const flat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const discs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), flat, MAX_ZONES);
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 0.0006, 2), flat, MAX_ZONES); // a box of half size 1: scaled to the zone
  for (const mesh of [discs, boxes]) {
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.renderOrder = 3;
    view.world.add(mesh);
  }
  const bars = [0, 1].map(() => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.0012, 0.008), new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false }));
    bar.visible = false;
    bar.renderOrder = 4;
    view.world.add(bar);
    return bar;
  });
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const none = new THREE.Quaternion();
  const y = 0.0009;

  return {
    // zones: from runtime/hands.js; show: whether to draw them; fingers: from runtime/calibration.js
    update(zones, show, fingers) {
      let d = 0;
      let b = 0;
      if (show) {
        for (const zone of zones) {
          if (zone.r !== undefined && d < MAX_ZONES) discs.setMatrixAt(d++, matrix.compose(position.set(zone.x, y, zone.z), none, scale.set(zone.r, 1, zone.r)));
          else if (zone.hx !== undefined && b < MAX_ZONES) boxes.setMatrixAt(b++, matrix.compose(position.set(zone.x, y, zone.z), none, scale.set(zone.hx, 1, zone.hz)));
        }
      }
      discs.count = d;
      boxes.count = b;
      discs.instanceMatrix.needsUpdate = true;
      boxes.instanceMatrix.needsUpdate = true;
      bars.forEach((bar, i) => {
        const f = fingers[i];
        bar.visible = !!f;
        if (!f) return;
        bar.scale.x = Math.max(f.missing, 0.004);
        bar.position.set(f.x + (f.dx * f.missing) / 2, y + 0.0004, f.z + (f.dz * f.missing) / 2);
        bar.rotation.y = Math.atan2(-f.dz, f.dx);
      });
    },
  };
}
