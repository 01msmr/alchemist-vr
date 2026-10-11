import * as THREE from 'three';
import { CONSOLE as K, INPUT, LAYOUT } from '../config/index.js';
import { createTapCounter } from '../calibration.js';
import { controls, hitControl, createCord, cordPosition } from '../game/console.js';
import { hitBookZone, bookZones } from '../game/book.js';
import { createConsoleView } from '../view/console.js';
import { indexLocal, tipLocal, palmLocal } from './space.js';
import { pulse } from '../vr.js';

const C = INPUT.calibration;
const at = cordPosition();

// The settings console at work. Tracked hands (the index finger) and controllers (the working end of the hand tool): one
// tap on the table at a button presses it; a pinch (the trigger) near the bead takes the pull cord. Desktop: a click on a control, or a drag
// of the bead. A full pull of the cord starts the level over.
export function createConsole(ctx) {
  const { view, settings } = ctx;
  const { renderer, camera, worldInv } = view;
  const cord = createCord(K.cord);
  const look = createConsoleView(view);
  const counters = [0, 1].map(() => createTapCounter({ ...C.tap, count: 1 }));
  const palm = new THREE.Vector3();
  // how far a hand is from the bead: the working end or the hand itself, whichever is nearer (either may reach for it)
  const reachTo = (hand) => Math.min(tipLocal(view, hand, tip).distanceTo(beadAt()), palmLocal(view, hand, palm).distanceTo(beadAt()));
  const holder = { hand: null, mouse: false }; // who holds the bead
  const tip = new THREE.Vector3();
  const bead = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const bookPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.03); // the book's pages are a few centimeters above the table
  const cordPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -at.z);
  const beadAt = () => bead.set(at.x, K.cord.beadY - cord.pulled, at.z);

  // a press: a button of the console, or a corner of the book
  const press = (control) => (control.book ? ctx.book.turn(control.delta) : settings.set(control.row, control.value));
  const hitAny = (x, z, margin = 0) => hitControl(x, z, margin) ?? hitBookZone(x, z, margin);

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
    const control = (r.intersectPlane(tablePlane, hit) && hitControl(hit.x, hit.z)) || (r.intersectPlane(bookPlane, hit) && hitBookZone(hit.x, hit.z));
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

    // the protected areas of the buttons and the book's corners, grown by `away` (see runtime/hands.js)
    zones(away) {
      const list = controls().map((c) => ({ x: c.x, z: c.z, hx: c.halfX + away, hz: c.halfZ + away }));
      for (const zone of bookZones()) { // the corners are in the book's frame: turn them to the table
        const B = LAYOUT.book;
        list.push({ x: B.x + zone.x * Math.cos(B.yaw) + zone.z * Math.sin(B.yaw), z: B.z - zone.x * Math.sin(B.yaw) + zone.z * Math.cos(B.yaw), r: Math.hypot(zone.halfX, zone.halfZ) + away });
      }
      return list;
    },

    // the center of a control (or of the bead) on the table, for the smoke test
    centerOf(id) {
      if (id === 'bead') return beadAt().clone();
      const c = controls().find((control) => control.id === id);
      return new THREE.Vector3(c.x, 0, c.z);
    },

    update(dt) {
      let near = false; // a hand is in reach of the bead
      ctx.hands.forEach((hand, i) => {
        const tracked = hand.mode === 'tracked' || hand.mode === 'controller'; // a controller taps and pinches with its working end (the hand tool's tip)
        const pinch = tracked && hand.pinchOn;
        if (holder.hand === i) {
          if (pinch) {
            cord.drag(tipLocal(view, hand, tip).y);
          } else {
            holder.hand = null;
            if (!holder.mouse) cord.release();
          }
        } else if (pinch && hand.held === null && holder.hand === null && !holder.mouse && cord.canGrab && reachTo(hand) <= K.cord.grabRadius) {
          // the trigger is pressed and the bead is in reach: it does not matter which came first
          holder.hand = i;
          tipLocal(view, hand, tip);
          cord.grab(tip.y);
          pulse(hand, 0.4, 40);
        }
        if (tracked && holder.hand !== i && cord.canGrab && holder.hand === null && reachTo(hand) <= K.cord.grabRadius * 1.3) near = true;

        indexLocal(view, hand, tip);
        const over = tracked && hand.held === null && holder.hand !== i && Math.abs(tip.y) <= C.band && hitAny(tip.x, tip.z, K.tapMargin) !== null;
        const r = counters[i].update(tip.y, over, dt, { x: tip.x, z: tip.z });
        if (r.done) {
          const control = hitAny(r.points[0].x, r.points[0].z);
          if (control) press(control);
        }
      });
      if (cord.step(dt)) {
        holder.hand = null;
        holder.mouse = false;
        ctx.runner.reset();
      }
      look.update(settings.get(), cord.pulled, cord.progress, near || cord.grabbed);
    },
  };
}
