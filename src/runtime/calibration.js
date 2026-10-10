import * as THREE from 'three';
import { INPUT, LAYOUT } from '../config/index.js';
import { createTapCounter, edgeFromPoints, validHeight, loadHeight, saveHeight, validEdge, loadEdge, saveEdge } from '../calibration.js';
import { indexLocal } from './space.js';

const C = INPUT.calibration;
const range = LAYOUT.table.heightRange;

// The virtual table stands where the real one does. Two sets of three quick taps on the table top at its front edge,
// with the index finger of a tracked hand (not a controller), not next to anything you could pick up: the lowest tap
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
    get edge() { return edge; },
    set,
    setEdge,

    // each frame: a tracked hand's index finger taps
    update(dt) {
      taps = 0;
      blocked = '';
      live = '';
      ctx.hands.forEach((hand, i) => {
        indexLocal(view, hand, tip);
        const worldY = hand.indexPoint.y;
        const nearTable = hand.mode === 'tracked' && Math.abs(worldY - height) <= C.band;
        if (nearTable) blocked = blocked || (hand.held !== null ? 'the hand holds something' : ctx.handInput.nearThing(tip) ? 'too close to an object' : '');
        const over = nearTable && hand.held === null && !ctx.handInput.nearThing(tip);
        const r = counters[i].update(worldY, over, dt, { x: hand.indexPoint.x, z: hand.indexPoint.z });
        taps = Math.max(taps, r.taps);
        if (hand.mode === 'tracked') live = `${hand.handedness[0]}${((worldY - height) * 100).toFixed(0)} d${(r.dip * 100).toFixed(1)}${over ? '' : ' off'}`; // finger cm above the table top, dip cm below its peak
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
