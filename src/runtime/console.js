import * as THREE from 'three';
import { CONSOLE as K, INPUT } from '../config/index.js';
import { createTapCounter } from '../calibration.js';
import { controls, hitControl, createCord, cordPosition } from '../game/console.js';
import { createConsoleView } from '../view/console.js';
import { indexLocal, tipLocal } from './space.js';

const C = INPUT.calibration;
const at = cordPosition();

// The settings console at work. Tracked hands: one tap of the index finger on the table at a control presses it;
// a pinch near the bead takes the pull cord. Controllers do not operate it. Desktop: a click on a control, or a drag
// of the bead. A full pull of the cord starts the level over.
export function createConsole(ctx) {
  const { view, settings } = ctx;
  const { renderer, camera, worldInv } = view;
  const cord = createCord(K.cord);
  const look = createConsoleView(view);
  const counters = [0, 1].map(() => createTapCounter({ ...C.tap, count: 1 }));
  const pinching = [false, false];
  const holder = { hand: null, mouse: false }; // who holds the bead
  const tip = new THREE.Vector3();
  const bead = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const cordPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -at.z);
  const beadAt = () => bead.set(at.x, K.cord.beadY - cord.pulled, at.z);

  const press = (control) => settings.set(control.row, control.value);

  const rayFrom = (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return ray.copy(raycaster.ray).applyMatrix4(worldInv);
  };

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || renderer.xr.isPresenting) return;
    const r = rayFrom(e);
    if (r.distanceToPoint(beadAt()) <= K.cord.grabRadius && r.intersectPlane(cordPlane, hit)) {
      holder.mouse = true;
      cord.grab(hit.y);
      e.stopImmediatePropagation();
      return;
    }
    const control = r.intersectPlane(tablePlane, hit) && hitControl(hit.x, hit.z);
    if (control) {
      press(control);
      e.stopImmediatePropagation();
    }
  });
  addEventListener('pointermove', (e) => {
    if (holder.mouse && rayFrom(e).intersectPlane(cordPlane, hit)) cord.drag(hit.y);
  });
  const letGo = () => {
    holder.mouse = false;
    if (holder.hand === null) cord.release();
  };
  addEventListener('pointerup', letGo);
  addEventListener('blur', letGo);

  return {
    cord,
    get bead() { return beadAt(); },

    // Is this point (table-local) at a control or at the bead? Calibration taps stay away from them.
    near(point) {
      return hitControl(point.x, point.z, C.keepAway) !== null || point.distanceTo(beadAt()) < K.cord.grabRadius + C.keepAway;
    },

    // the center of a control (or of the bead) on the table, for the smoke test
    centerOf(id) {
      if (id === 'bead') return beadAt().clone();
      const c = controls().find((control) => control.id === id);
      return new THREE.Vector3(c.x, 0, c.z);
    },

    update(dt) {
      ctx.hands.forEach((hand, i) => {
        const tracked = hand.mode === 'tracked';
        const pinch = tracked && hand.pinchOn;
        if (holder.hand === i) {
          if (pinch) {
            cord.drag(tipLocal(view, hand, tip).y);
          } else {
            holder.hand = null;
            if (!holder.mouse) cord.release();
          }
        } else if (pinch && !pinching[i] && hand.held === null && holder.hand === null && !holder.mouse) {
          if (tipLocal(view, hand, tip).distanceTo(beadAt()) <= K.cord.grabRadius) {
            holder.hand = i;
            cord.grab(tip.y);
          }
        }
        pinching[i] = pinch;

        indexLocal(view, hand, tip);
        const over = tracked && hand.held === null && holder.hand !== i && Math.abs(tip.y) <= C.band && hitControl(tip.x, tip.z, K.tapMargin) !== null;
        const r = counters[i].update(tip.y, over, dt, { x: tip.x, z: tip.z });
        if (r.done) {
          const control = hitControl(r.points[0].x, r.points[0].z);
          if (control) press(control);
        }
      });
      if (cord.step(dt)) {
        holder.hand = null;
        holder.mouse = false;
        ctx.runner.reset();
      }
      look.update(settings.get(), cord.pulled, cord.progress);
    },
  };
}
