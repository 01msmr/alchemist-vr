import * as THREE from 'three';
import { LAYOUT, VIEW } from '../config/index.js';
import { ghostModel, catModel, cushionModel } from '../assets.js';
import { rules } from '../game/rules.js';
import { voxelsOf, matchSets, morphPoint, morphColor } from '../game/morph.js';
import { mulberry32 } from '../paper.js';

// Level 3 to look at: smoke over the crucible, the ghost, the straw cat that wakes, the cushion.
export function createGhostView(view) {
  const { world, part, refresh } = view;
  const G = VIEW.ghost;
  const c = LAYOUT.crucible;
  const ghostMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: G.opacity, depthWrite: false }));
  ghostMesh.renderOrder = 2;
  ghostMesh.visible = false;
  world.add(ghostMesh);
  const cat = part();
  cat.visible = false;
  const cushion = part();
  cushion.position.set(LAYOUT.cushion.x, 0, LAYOUT.cushion.z);
  cushion.visible = false;
  view.remesh(cushion, cushionModel());

  // the morph: the straw cat's voxels walk to their places in the living cat (cubes, drawn as one instanced mesh)
  let morph = null; // { eyes, pairs, jitters, size, mesh }
  const morphColor3 = new THREE.Color();
  function prepareMorph(eyes) {
    if (morph?.eyes === eyes) return;
    if (morph) {
      view.world.remove(morph.mesh);
      morph.mesh.dispose();
    }
    const straw = catModel('straw', eyes);
    const pairs = matchSets(voxelsOf(straw), voxelsOf(catModel('alive', eyes, 0)));
    const rand = mulberry32(5);
    const jitters = pairs.map(() => ({ lift: 2 + rand() * 7, swirlX: (rand() - 0.5) * 10, swirlZ: (rand() - 0.5) * 8 }));
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(LAYOUT.voxel, LAYOUT.voxel, LAYOUT.voxel), new THREE.MeshBasicMaterial({ color: 0xffffff }), pairs.length);
    mesh.setColorAt(0, morphColor3.setRGB(1, 1, 1));
    mesh.frustumCulled = false;
    mesh.visible = false;
    view.world.add(mesh);
    morph = { eyes, pairs, jitters, size: straw.size, mesh };
  }
  function drawMorph(t) {
    const { pairs, jitters, size, mesh } = morph;
    const v = LAYOUT.voxel;
    pairs.forEach((pair, i) => {
      const p = morphPoint(pair, t, jitters[i]);
      matrix.setPosition(LAYOUT.cat.x + (p.x - size[0] / 2 + 0.5) * v, (p.y + 0.5) * v, LAYOUT.cat.z + (p.z - size[2] / 2 + 0.5) * v);
      mesh.setMatrixAt(i, matrix);
      const [r, g, b] = morphColor(pair, t);
      mesh.setColorAt(i, morphColor3.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  const smoke = new THREE.InstancedMesh(new THREE.BoxGeometry(LAYOUT.voxel * 2, LAYOUT.voxel * 2, LAYOUT.voxel * 2), new THREE.MeshBasicMaterial({ color: G.smokeColor }), G.smokeCubes);
  smoke.frustumCulled = false;
  smoke.count = 0;
  world.add(smoke);

  const ghostAt = new THREE.Vector3(c.x + 0.12, 0.2, c.z);
  const target = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const none = new THREE.Quaternion();
  const at = new THREE.Vector3();
  let ghostFrame = '';

  return {
    // state: the game state; time: seconds; vialPos: where the vial is
    update(state, time, vialPos) {
      const level3 = state.level === 3;
      cushion.visible = level3;
      const g = state.ghost;
      const f = state.finale;

      // smoke rises from the crucible mouth while there is any
      const cubes = level3 ? Math.round(Math.min(1, g.smoke) * G.smokeCubes) : 0;
      for (let i = 0; i < cubes; i++) {
        const phase = (time * 0.35 + i / G.smokeCubes) % 1;
        const s = (1 - phase) * 1;
        at.set(c.x + Math.sin(i * 7.1 + time * 0.8) * 0.015 * (1 + phase * 3), c.top + phase * G.smokeHeight, c.z + Math.cos(i * 5.3 + time * 0.7) * 0.015 * (1 + phase * 3));
        matrix.compose(at, none, scale.set(s, s, s));
        smoke.setMatrixAt(i, matrix);
      }
      smoke.count = cubes;
      smoke.instanceMatrix.needsUpdate = true;

      // the cat: straw until the ghost is caught, alive after; it runs to the cushion (in circles with fool's gold eyes)
      const morphing = level3 && f.released && !f.alive && g.phase === 'trapped'; // the voxels of the straw cat walk to the living cat
      if (morphing) {
        prepareMorph(f.eyes);
        drawMorph(Math.min(1, f.wake / rules().WAKE_TIME));
      }
      if (morph) morph.mesh.visible = morphing;
      cat.visible = level3 && g.phase === 'trapped' && !morphing;
      if (cat.visible) {
        const look = f.alive ? 'alive' : 'straw';
        const frame = f.alive && f.run < 1 ? Math.floor(time * 6) % 2 : 0;
        refresh('cat', `${look} ${f.eyes} ${frame}`, cat, () => catModel(look, f.eyes, frame));
        const run = f.alive ? f.run : 0;
        const squint = f.eyes === 'fools';
        const x = LAYOUT.cat.x + (LAYOUT.cushion.x - LAYOUT.cat.x) * run;
        const z = LAYOUT.cat.z + (LAYOUT.cushion.z - LAYOUT.cat.z) * run;
        const a = squint && f.alive && f.run < 1 ? time * 4 : 0;
        const radius = squint && f.alive && f.run < 1 ? 0.05 : 0;
        cat.position.set(x + Math.cos(a) * radius, 0, z + Math.sin(a) * radius);
        const heading = f.alive && f.run < 1 ? Math.atan2(-(LAYOUT.cushion.z - LAYOUT.cat.z), LAYOUT.cushion.x - LAYOUT.cat.x) + (squint ? a : 0) : 0;
        cat.rotation.y = heading;
      }

      // the ghost: circles the smoke, comes to the gold in the ring, sits in the vial, flies into the cat
      let shown = level3 && (g.phase === 'visible' || g.phase === 'lured');
      let size = 1;
      if (g.phase === 'visible') {
        const outward = g.mocked ? 0.24 : 0.13;
        target.set(c.x + Math.cos(time * 0.8) * outward, 0.2 + Math.sin(time * 2) * 0.015, c.z + Math.sin(time * 0.8) * outward);
      } else if (g.phase === 'lured') {
        target.set(state.ring.x + Math.cos(time * 1.5) * 0.02, 0.09 + Math.sin(time * 3) * 0.01, state.ring.z + Math.sin(time * 1.5) * 0.02);
      } else if (level3 && g.phase === 'trapped' && !f.released) {
        shown = true;
        size = 0.4;
        target.copy(vialPos).add(at.set(0, 0.0, 0));
      } else if (level3 && g.phase === 'trapped' && f.released && !f.alive) {
        shown = true;
        size = 0.4 * (1 - f.wake / rules().WAKE_TIME);
        target.set(LAYOUT.cat.x, 0.04, LAYOUT.cat.z);
      }
      ghostMesh.visible = shown && size > 0.02;
      if (ghostMesh.visible) {
        ghostAt.lerp(target, g.phase === 'trapped' ? 0.3 : 0.06);
        ghostMesh.position.copy(ghostAt);
        ghostMesh.scale.setScalar(size);
        ghostMesh.rotation.y = Math.sin(time) * 0.4;
        const frame = `${Math.floor(time * 3) % 2}`;
        if (frame !== ghostFrame || !ghostMesh.geometry.attributes.position) {
          ghostFrame = frame;
          view.remesh(ghostMesh, ghostModel(Number(frame)));
        }
      }
    },
  };
}
