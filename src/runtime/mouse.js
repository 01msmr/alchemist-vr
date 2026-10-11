import * as THREE from 'three';
import { INPUT, LAYOUT } from '../config/index.js';
import { takeNugget, snuffCandle } from '../game/sim.js';
import { tiltDirection } from '../game/geometry.js';
import { PROPS } from '../props.js';

const UP = new THREE.Vector3(0, 1, 0);
const { mouse: M } = INPUT;
const c = LAYOUT.crucible;

// The desktop fallback: pick things up with the left mouse button and drag them over the table. A held tool follows
// the pointer rigidly; the vial tilts toward the crucible with Shift + drag. Let go and it falls like any loose object.
export function createMouse(ctx) {
  const { view } = ctx;
  const { renderer, camera, worldInv, meshes, props } = view;
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const flat = new THREE.Vector3();
  const plane = (y) => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y); // a horizontal plane at height y
  const planes = { vial: plane(M.holdY.vial), rod: plane(M.holdY.rod), nugget: plane(M.holdY.nugget), grains: plane(M.holdY.grains), match: plane(M.matchY) };

  let tilt = 0; // the vial's tilt, Shift + drag: 0..1
  let shiftHeld = false;
  let tiltOriginY = 0;
  let lastPointerY = 0;
  let grains = null; // a pinch of a substance held by the mouse: the source it came from
  let carry = null; // what is left of it (a spoonful of salt trickles while Space is held and the mouse moves)
  let sprinkling = false;
  const grainsPos = new THREE.Vector3();
  let capturing = false; // a pick is going on: the camera must not orbit

  const pointOn = (name) => {
    raycaster.setFromCamera(pointer, camera);
    ray.copy(raycaster.ray).applyMatrix4(worldInv);
    return ray.intersectPlane(planes[name], hit);
  };
  const updatePointer = (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    lastPointerY = e.clientY;
  };

  function hold(t) {
    t.ph.hold();
    t.holder = 'mouse';
    t.trackValid = false;
    t.pos.y = M.holdY[t.id];
    const p = pointOn(t.id);
    t.grabOffset.set(t.pos.x - p.x, t.pos.z - p.z);
  }

  function capture() {
    capturing = true;
    view.controls.enabled = false;
  }

  function release() {
    for (const t of ctx.tools.list) {
      if (t.holder !== 'mouse') continue;
      ctx.tools.release(t);
      if (t.id === 'vial') tilt = 0;
    }
    if (ctx.matches.holder === 'mouse') ctx.matches.release();
    if (grains) {
      ctx.dropWorld.releaseGrains(grains, grainsPos, { x: 0, y: 0, z: 0 }, Math.round(carry.load));
      grains = null;
      carry = null;
    }
    if (capturing) {
      capturing = false;
      view.controls.enabled = !renderer.xr.isPresenting;
    }
  }

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || renderer.xr.isPresenting) return;
    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);
    const pickables = [meshes.box, meshes.stand, meshes.crucible];
    for (const mesh of Object.values(props)) if (mesh.visible) pickables.push(mesh);
    for (const t of ctx.tools.list) if (t.active && t.holder === null) pickables.push(...t.pickMeshes);
    const [first] = raycaster.intersectObjects(pickables);
    if (!first) return; // empty space: orbit the camera
    const state = ctx.state;
    const picked = ctx.tools.list.find((t) => t.pickMeshes.includes(first.object));
    const propName = Object.keys(props).find((name) => props[name] === first.object);

    if (first.object === meshes.crucible) {
      if (!takeNugget(state)) return; // nothing to take: orbit
      ctx.tools.spawn(ctx.tools.tools.nugget, new THREE.Vector3(c.x, M.holdY.nugget, c.z));
      capture();
      hold(ctx.tools.tools.nugget);
      return;
    }
    capture();
    if (first.object === meshes.stand) {
      snuffCandle(state);
    } else if (first.object === meshes.box) {
      if (ctx.matches.tryTake('mouse')) {
        const p = pointOn('match');
        ctx.matches.moveMouse(p.x, p.z);
      }
    } else if (propName && PROPS[propName].source) {
      if (!grains) {
        grains = PROPS[propName].source;
        carry = ctx.dropWorld.newCarry(grains);
        const p = pointOn('grains');
        grainsPos.set(p.x, M.holdY.grains, p.z);
      }
    } else if (picked) {
      hold(picked);
    }
  });

  renderer.domElement.addEventListener('pointermove', (e) => {
    updatePointer(e);
    for (const t of ctx.tools.list) {
      if (t.holder !== 'mouse') continue;
      if (t.id === 'vial' && shiftHeld) {
        tilt = Math.min(1, Math.max(0, (e.clientY - tiltOriginY) / M.tiltPixels));
      } else {
        const p = pointOn(t.id);
        if (p) t.pos.set(p.x + t.grabOffset.x, M.holdY[t.id], p.z + t.grabOffset.y);
      }
    }
    if (ctx.matches.holder === 'mouse') {
      const p = pointOn('match');
      if (p) ctx.matches.moveMouse(p.x, p.z);
    }
    if (grains) {
      const p = pointOn('grains');
      if (p) grainsPos.set(p.x, M.holdY.grains, p.z);
      if (grains.sprinkle && sprinkling) ctx.dropWorld.trickle(grains, carry, grainsPos);
      else if (carry) carry.prev = null;
    }
  });

  addEventListener('pointerup', (e) => { if (e.button === 0) release(); });
  addEventListener('blur', release);
  addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      sprinkling = true; // Space + drag: spill the spoonful of salt
      e.preventDefault();
    }
    if (e.key === 'Shift' && !shiftHeld) {
      shiftHeld = true;
      tiltOriginY = lastPointerY - tilt * M.tiltPixels;
    }
    if (e.key === 'r' || e.key === 'R') ctx.runner.reset();
  });
  addEventListener('keyup', (e) => {
    if (e.key === ' ') sprinkling = false;
    if (e.key !== 'Shift') return;
    shiftHeld = false;
    tilt = 0;
    const t = ctx.tools.tools.vial;
    if (t.holder === 'mouse') { // resume the position drag without a jump
      const p = pointOn('vial');
      if (p) t.grabOffset.set(t.pos.x - p.x, t.pos.z - p.z);
    }
  });

  return {
    get grains() { return grains; },
    grainsPos,

    // the pose of what the mouse holds: the vial tilts toward the crucible, the rest stays upright
    updatePoses() {
      for (const t of ctx.tools.list) {
        if (t.holder !== 'mouse') continue;
        if (t.id === 'vial') {
          const dir = tiltDirection(t.pos, c);
          t.quat.setFromAxisAngle(axis.crossVectors(UP, flat.set(dir.x, 0, dir.z)), tilt * THREE.MathUtils.degToRad(M.maxTiltDeg));
        } else {
          t.quat.identity();
        }
      }
    },

    reset() {
      tilt = 0;
      grains = null;
      carry = null;
    },
  };
}
