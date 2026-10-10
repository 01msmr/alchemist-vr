import * as THREE from 'three';
import { CONSOLE as K, LAYOUT } from '../config/index.js';
import { controls, cordPosition, redSegments } from '../game/console.js';
import { VoxelObject } from '../voxel-object.js';
import { toGeometry } from '../voxel-mesh.js';

const v = LAYOUT.voxel;
const depth = K.pocket.voxels * v;
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

// a flat pictogram (one voxel thick) from an ASCII bitmap
function iconGeometry(rows, color) {
  const obj = VoxelObject.empty(rows[0].length, 1, rows.length, [[0, 0, 0], rgb(color)]);
  rows.forEach((row, z) => [...row].forEach((ch, x) => { if (ch === '#') obj.set(x, 0, z, 1); }));
  return toGeometry(obj, v);
}

// a solid ball of voxels, `r` voxels in radius
function ballGeometry(r, color) {
  const n = 2 * r + 1;
  const obj = VoxelObject.empty(n, n, n, [[0, 0, 0], rgb(color)]);
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x - r, y - r, z - r) <= r + 0.3) obj.set(x, y, z, 1);
  return toGeometry(obj, v);
}

// What you see of the console: the lever and the buttons in their pockets, the lamp and the pull cord above.
// update(settings, pulled, progress) draws the states; everything is added to the world group (table-local).
export function createConsoleView(view) {
  const flat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const solid = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const group = new THREE.Group();
  view.world.add(group);

  const buttons = {};
  let lever = null;
  for (const c of controls()) {
    const pocketFloor = -depth;
    if (c.kind === 'lever') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(K.lever.handle.w * 3, v, K.lever.handle.w * 2), solid(K.colors.leverBase));
      base.position.set(c.x, pocketFloor + v / 2, c.z);
      lever = new THREE.Group();
      lever.position.set(c.x, pocketFloor + v, c.z);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(K.lever.handle.w, K.lever.handle.h, K.lever.handle.w), solid(K.colors.lever));
      handle.position.y = K.lever.handle.h / 2;
      lever.add(handle);
      for (const [name, side] of [['moon', -1], ['sun', 1]]) {
        const icon = new THREE.Mesh(iconGeometry(K.icons[name], K.colors.icon), view.material);
        icon.position.set(c.x + side * c.halfX * 0.55, pocketFloor + v, c.z);
        group.add(icon);
      }
      group.add(base, lever);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2 * c.halfX - 0.004, depth, 2 * c.halfZ - 0.004), solid(K.colors.buttonDim));
      body.position.y = -depth / 2;
      const icon = new THREE.Mesh(iconGeometry(K.icons[c.value], K.colors.icon), view.material);
      icon.position.y = 0.0002;
      const button = new THREE.Group();
      button.position.set(c.x, 0, c.z);
      button.add(body, icon);
      group.add(button);
      buttons[c.value] = { button, body };
    }
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
  const lit = new THREE.Color(K.colors.buttonLit);
  const dim = new THREE.Color(K.colors.buttonDim);
  let drawnCord = '';

  return {
    update(settings, pulled, progress) {
      for (const [name, { button, body }] of Object.entries(buttons)) {
        const chosen = settings.background === name;
        button.position.y = chosen ? -K.push.voxels * v : 0;
        body.material.color.copy(chosen ? lit : dim);
      }
      lever.rotation.z = THREE.MathUtils.degToRad(K.lever.tiltDeg) * (settings.theme === 'light' ? -1 : 1);

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
