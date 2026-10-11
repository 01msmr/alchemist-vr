import * as THREE from 'three';
import { CONSOLE as K, LAYOUT } from '../config/index.js';
import { controls, cordPosition, redSegments } from '../game/console.js';
import { VoxelObject } from '../voxel-object.js';
import { toGeometry } from '../voxel-mesh.js';
import { iconTexture } from '../icons.js';

const v = LAYOUT.voxel;
const depth = K.pocket.voxels * v;
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

// a solid ball of voxels, `r` voxels in radius
function ballGeometry(r, color) {
  const n = 2 * r + 1;
  const obj = VoxelObject.empty(n, n, n, [[0, 0, 0], rgb(color)]);
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x - r, y - r, z - r) <= r + 0.3) obj.set(x, y, z, 1);
  return toGeometry(obj, v);
}

// What you see of the console: the buttons in their pockets with their icons, the lamp and the pull cord above.
// update(settings, pulled, progress) draws the states; everything is added to the world group (table-local).
export function createConsoleView(view) {
  const flat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const solid = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const group = new THREE.Group();
  view.world.add(group);

  const buttons = {};
  const iconPlane = new THREE.PlaneGeometry(K.buttons.iconSize, K.buttons.iconSize).rotateX(-Math.PI / 2); // lying flat, the top of the picture away from the player
  for (const c of controls()) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2 * c.halfX - 0.004, depth, 2 * c.halfZ - 0.004), solid(K.colors.buttonPassive));
    body.position.y = -depth / 2;
    const button = new THREE.Group();
    button.position.set(c.x, 0, c.z);
    button.add(body);
    const icon = new THREE.Mesh(iconPlane, new THREE.MeshBasicMaterial({ map: iconTexture(c.icon, K.colors.icon), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); // a picture on the table, behind its button
    icon.position.set(c.x, 0.0004, c.iconZ);
    icon.renderOrder = 1;
    group.add(button, icon);
    buttons[c.id] = { button, body, c };
  }

  // the lamp hangs at the top of the cord, the bead at the bottom
  const cord = K.cord;
  const at = cordPosition();
  const bulb = new THREE.Mesh(ballGeometry(3, K.colors.lamp), view.material);
  bulb.position.set(at.x, cord.lampY - 7 * v, at.z);
  const socket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), solid(K.colors.socket));
  socket.position.set(at.x, cord.lampY + 0.02, at.z);
  const bead = new THREE.Mesh(new THREE.BoxGeometry(cord.bead, cord.bead, cord.bead), solid(K.colors.bead));
  const maxSegments = Math.ceil((cord.lampY - (cord.beadY - cord.pull)) / cord.segment);
  const segments = new THREE.InstancedMesh(new THREE.BoxGeometry(v, cord.segment, v), flat, maxSegments);
  segments.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxSegments * 3), 3);
  const m = new THREE.Matrix4();
  for (let i = 0; i < maxSegments; i++) segments.setMatrixAt(i, m.makeTranslation(at.x, cord.lampY - (i + 0.5) * cord.segment, at.z));
  segments.frustumCulled = false;
  group.add(bulb, socket, bead, segments);

  const white = new THREE.Color(K.colors.cordWhite);
  const red = new THREE.Color(K.colors.cordRed);
  const lit = new THREE.Color(K.colors.buttonActive);
  const dim = new THREE.Color(K.colors.buttonPassive);
  let drawnCord = '';

  return {
    update(settings, pulled, progress) {
      for (const { button, body, c } of Object.values(buttons)) {
        const chosen = settings[c.row] === c.value;
        button.position.y = chosen ? -K.push.voxels * v : 0;
        body.material.color.copy(chosen ? lit : dim);
      }

      const bottom = cord.beadY - pulled;
      const count = Math.min(maxSegments, Math.floor((cord.lampY - bottom) / cord.segment));
      const redCount = redSegments(progress, count);
      bead.position.set(at.x, bottom - cord.bead / 2, at.z);
      const key = `${count} ${redCount}`;
      if (key === drawnCord) return;
      drawnCord = key;
      segments.count = count;
      for (let i = 0; i < count; i++) segments.setColorAt(i, i < redCount ? red : white);
      segments.instanceColor.needsUpdate = true;
    },
  };
}
