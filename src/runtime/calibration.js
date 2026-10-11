import * as THREE from 'three';
import { INPUT, LAYOUT } from '../config/index.js';
import { createTapCounter, edgeFromPoints, validHeight, loadHeight, saveHeight, validEdge, loadEdge, saveEdge } from '../calibration.js';
import { indexLocal } from './space.js';

const C = INPUT.calibration;
const range = LAYOUT.table.heightRange;

// The virtual table stands where the real one does. Two sets of three quick taps on the table top at its front edge,
// with the index finger of a tracked hand or the working end of a controller's tool, not next to anything you could pick up: the lowest tap
// of all six is the height of the table top, the two places are a line (the front edge) and the table's middle lies
// exactly between them, so the taps can go out to the far ends. Height and edge are remembered for the next session.
// Until then the table is at its default height and place (LAYOUT).
export function createCalibration(ctx) {
  const { view, physics } = ctx;
  const storage = typeof localStorage === 'undefined' ? undefined : localStorage;
  const makeCounters = () => [0, 1].map(() => createTapCounter(C.tap));
  let counters = makeCounters();
  const tip = new THREE.Vector3();
  let height = LAYOUT.table.h;
  let origin = 'default';
  let edge = null;
  let first = null; // after the first set: { x, z, low } (place on the scene floor plane, lowest tap)
  let taps = 0;
  let live = ''; // what the tracked finger does, for the status panel while the numbers are tuned
  let blocked = ''; // why a hand at table height is not counted
  let notice = '';
  const attempting = [false, false]; // per hand: a tap too close to an object is going on (for counting the attempts)
  let spot = null; // the place of the last blocked tap: { x, z, count, age }; the help shows from the 2nd try there
  const top = [0, 0]; // per hand: how high the finger was a moment ago (it falls off slowly), to see a finger going down for a tap
  let fingers = []; // the fingers that are over a protected area: { x, z, missing (m still to move), dx, dz (the way out) }
  let helpLeft = 0; // seconds the protected areas stay drawn after a blocked tap

  function apply(h) {
    height = h;
    view.setTableHeight(h);
    physics.setFloorY(-h); // the floor stays where the real floor is
  }

  const remembered = loadHeight(storage, C.storageKey, range);
  if (remembered !== null) {
    apply(remembered);
    origin = 'remembered';
  }
  const rememberedEdge = loadEdge(storage, C.edge.storageKey);
  if (rememberedEdge) {
    edge = rememberedEdge;
    view.setTableEdge(edge);
  }

  function set(h) {
    if (!validHeight(h, range)) return false;
    apply(h);
    saveHeight(storage, C.storageKey, h, range);
    origin = 'set';
    return true;
  }

  function setEdge(e) {
    if (!validEdge(e)) return false;
    edge = e;
    view.setTableEdge(e);
    saveEdge(storage, C.edge.storageKey, e);
    return true;
  }

  const place = (points) => ({ x: points.reduce((s, p) => s + p.x, 0) / points.length, z: points.reduce((s, p) => s + p.z, 0) / points.length });

  // a set of three taps is done: the first one only sets the height, the second one also makes the line
  function finish(r) {
    notice = '';
    const here = place(r.points);
    if (!first) {
      if (!set(r.height - C.fingerThickness)) return;
      first = { ...here, low: r.height };
      return;
    }
    const line = edgeFromPoints(first, here, { frontToOrigin: LAYOUT.tableBounds.maxZ, minSpan: C.edge.minSpan });
    if (!line) {
      notice = `points < ${Math.round(C.edge.minSpan * 100)} cm apart, tap the 2nd set farther away`;
      return;
    }
    set(Math.min(first.low, r.height) - C.fingerThickness);
    setEdge(line);
    first = null;
  }

  return {
    get height() { return height; },
    get fingers() { return fingers; },
    // are the protected areas drawn? only while a finger on the table at the front edge is too close to an object (and a moment after)
    get help() { return helpLeft > 0; },
    get edge() { return edge; },
    set,
    setEdge,

    // each frame: a tracked hand's index finger taps
    update(dt) {
      taps = 0;
      blocked = '';
      live = '';
      fingers = [];
      helpLeft = Math.max(0, helpLeft - dt);
      if (spot) spot.age += dt;
      ctx.hands.forEach((hand, i) => {
        indexLocal(view, hand, tip);
        const worldY = hand.indexPoint.y;
        const nearTable = (hand.mode === 'tracked' || hand.mode === 'controller') && Math.abs(worldY - height) <= C.band; // a fingertip, or the working end of a controller's tool
        top[i] = Math.max(worldY, top[i] - dt * C.help.fall);
        let attemptNow = false;
        if (nearTable && hand.held === null) {
          // The help only when it is needed: a tap too close to an object, tried a second time at about the same place. While the
          // real table is unknown (the virtual one may be anywhere) a finger going down is a tap; once the table is set it must also
          // be on the table at its front edge.
          const c = ctx.handInput.clearance(tip.x, tip.z);
          const tableKnown = origin !== 'default' && edge !== null;
          const going = top[i] - worldY >= C.help.dip;
          attemptNow = c.margin < 0 && going && (!tableKnown || (Math.abs(tip.y) <= C.help.height && tip.z >= LAYOUT.tableBounds.maxZ - C.help.edge));
          if (attemptNow && !attempting[i]) { // a new try
            const same = spot && spot.age <= C.help.within && Math.hypot(spot.x - tip.x, spot.z - tip.z) <= C.help.sameSpot;
            spot = { x: tip.x, z: tip.z, count: same ? spot.count + 1 : 1, age: 0 };
          }
          if (attemptNow && spot && spot.count >= 2) {
            fingers.push({ x: tip.x, z: tip.z, missing: -c.margin, dx: c.dx, dz: c.dz });
            helpLeft = C.help.seconds;
          }
        }
        attempting[i] = attemptNow;
        if (nearTable) blocked = blocked || (hand.held !== null ? 'the hand holds something' : ctx.handInput.nearThing(tip) ? `too close to an object (${Math.ceil((fingers.at(-1)?.missing ?? 0) * 100)} cm more)` : '');
        const over = nearTable && hand.held === null && !ctx.handInput.nearThing(tip);
        const r = counters[i].update(worldY, over, dt, { x: hand.indexPoint.x, z: hand.indexPoint.z });
        taps = Math.max(taps, r.taps);
        if (hand.mode !== 'none') live = `${hand.handedness[0]}${((worldY - height) * 100).toFixed(0)} d${(r.dip * 100).toFixed(1)}${over ? '' : ' off'}`; // finger cm above the table top, dip cm below its peak
        if (r.done) {
          finish(r);
          counters = makeCounters();
        }
      });
    },

    // one short line for the panel (it holds about 60 characters)
    statusLine() {
      const tag = live ? ` [${live}]` : '';
      if (taps > 0) return `tap ${taps}/${C.tap.count} (set ${first ? 2 : 1} of 2)${tag}`;
      if (notice) return notice;
      if (blocked) return `not counted: ${blocked}${tag}`;
      return `${height.toFixed(2)}m ${edge ? 'edge ok' : 'no edge'} | 3 taps x2 at the front edge${first ? ' (1 of 2 done)' : ''}${tag}`;
    },
  };
}
