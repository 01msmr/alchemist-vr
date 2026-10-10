import * as THREE from 'three';
import { LAYOUT, VIEW } from '../config/index.js';
import { MAX_DROPS } from '../game/drops.js';
import { CELL, MAX_CELL } from '../game/puddles.js';

// Things that are not objects: the rings around the crucible mouth, drops in flight, spilled puddles,
// the grains between the fingertips.
export function createEffects(view, puddles) {
  const { world } = view;
  const voxel = LAYOUT.voxel;
  const c = LAYOUT.crucible;
  const matrix = new THREE.Matrix4();
  const snap = (v) => Math.round(v / voxel) * voxel;

  // ---- rings: dose gauge (fill + target window) and hold progress ----
  function makeArc(inner, outer, color, y) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(c.x, y, c.z);
    mesh.visible = false;
    world.add(mesh);
    let last = '';
    // from/to are fractions 0..1 of a 270 degree sweep
    return (from, to) => {
      const key = `${from}|${to}`;
      if (key === last) return; // unchanged: keep the geometry
      last = key;
      mesh.visible = to > from;
      if (!mesh.visible) return;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.RingGeometry(inner, outer, 48, 1, Math.PI * 0.75 + from * 1.5 * Math.PI, (to - from) * 1.5 * Math.PI);
    };
  }
  const r = VIEW.rings;
  const gaugeBack = makeArc(r.gauge.inner, r.gauge.outer, r.gauge.back, c.top + 0.001);
  const gaugeWindow = makeArc(r.window.inner, r.window.outer, r.window.color, c.top + 0.002);
  const gaugeFill = makeArc(r.gauge.inner, r.gauge.outer, r.gauge.fill, c.top + 0.003);
  const holdGood = makeArc(r.hold.inner, r.hold.outer, r.hold.good, c.top + 0.002);
  const holdBad = makeArc(r.hold.inner, r.hold.outer, r.hold.bad, c.top + 0.002);
  gaugeBack(0, 1);
  const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * r.steps) / r.steps;

  // ---- drops in flight: one voxel big, drawn on the voxel grid ----
  const dropColors = { hg: new THREE.Color(VIEW.drops.hg), sulfur: new THREE.Color(VIEW.drops.sulfur) };
  const stream = new THREE.InstancedMesh(new THREE.BoxGeometry(voxel, voxel, voxel), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_DROPS);
  stream.setColorAt(0, dropColors.hg);
  stream.frustumCulled = false;
  stream.count = 0;
  world.add(stream);

  // ---- spilled mercury and sulfur stay on the table as flat 1 cm patches until reset ----
  const puddleColors = { hg: new THREE.Color(VIEW.puddles.hg), sulfur: new THREE.Color(VIEW.puddles.sulfur) };
  const puddleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), VIEW.puddles.max);
  puddleMesh.setColorAt(0, puddleColors.hg);
  puddleMesh.frustumCulled = false;
  puddleMesh.count = 0;
  world.add(puddleMesh);
  let puddleVersion = -1;

  // ---- a pinch of sulfur between the fingertips ----
  const grains = [0, 1, 2].map(() => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(VIEW.drops.grain, VIEW.drops.grain, VIEW.drops.grain), new THREE.MeshBasicMaterial({ color: dropColors.sulfur }));
    mesh.visible = false;
    world.add(mesh);
    return mesh;
  });

  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const none = new THREE.Quaternion();

  return {
    // The rings for a level's gauge spec: the window of good doses, the fill, the hold progress, the danger.
    updateGauge(state, level) {
      const g = level.gauge;
      const [min, max] = g.window;
      gaugeWindow(min / g.scale, max / g.scale);
      gaugeFill(0, q((state.crucible.amounts[g.substance] ?? 0) / g.scale));
      const held = g.hold.from === 'stir' ? state.crucible.stir : state.progress[g.hold.id] || 0;
      holdGood(0, q(held / g.hold.seconds));
      holdBad(0, q((state.progress[g.danger.id] || 0) / g.danger.seconds));
    },

    updateDrops(drops) {
      drops.forEach((d, i) => {
        matrix.setPosition(snap(d.x), snap(d.y), snap(d.z));
        stream.setMatrixAt(i, matrix);
        stream.setColorAt(i, dropColors[d.kind] ?? dropColors.hg);
      });
      stream.instanceMatrix.needsUpdate = true;
      stream.instanceColor.needsUpdate = true;
      stream.count = drops.length;
    },

    updatePuddles() {
      if (puddleVersion === puddles.version) return;
      puddleVersion = puddles.version;
      let i = 0;
      for (const [cell, amount] of puddles.cells) {
        if (i >= VIEW.puddles.max) break;
        const [ix, iz] = cell.split(',').map(Number);
        const h = VIEW.puddles.thin + (VIEW.puddles.thick - VIEW.puddles.thin) * Math.min(1, amount / MAX_CELL); // thicker where there is more
        matrix.compose(pos.set(ix * CELL, h / 2 + 0.0003, iz * CELL), none, scale.set(CELL * 0.98, h, CELL * 0.98));
        puddleMesh.setMatrixAt(i, matrix);
        puddleMesh.setColorAt(i, puddleColors[puddles.kinds.get(cell)] ?? puddleColors.hg);
        i++;
      }
      puddleMesh.count = i;
      puddleMesh.instanceMatrix.needsUpdate = true;
      puddleMesh.instanceColor.needsUpdate = true;
    },

    // positions (world-local) of the pinches of sulfur to draw, up to three
    updateGrains(positions) {
      grains.forEach((m, i) => {
        m.visible = i < positions.length;
        if (m.visible) m.position.copy(positions[i]);
      });
    },
  };
}
