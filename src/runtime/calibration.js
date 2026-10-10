import * as THREE from 'three';
import { INPUT, LAYOUT } from '../config/index.js';
import { createTapCounter, edgeFromPoints, validHeight, loadHeight, saveHeight, validEdge, loadEdge, saveEdge } from '../calibration.js';
import { indexLocal } from './space.js';

const C = INPUT.calibration;
const range = LAYOUT.table.heightRange;
const bounds = LAYOUT.tableBounds;

// Steps, each done by tapping three times with the index finger of a tracked hand: the table top (the lowest tap is the height), then the
// front edge at two places (the two points make a line: where the table stands and how it is turned). They repeat
// in a loop, so any step can be done again. Height and edge are remembered for the next session. Until then the table
// is at its default height and place (LAYOUT).
const STEPS = ['height', 'edge 1', 'edge 2'];
const NEXT = {
  height: 'tap the table top',
  'edge 1': 'tap the front edge, left part',
  'edge 2': 'tap the front edge, right part',
};

export function createCalibration(ctx) {
  const { view, physics } = ctx;
  const storage = typeof localStorage === 'undefined' ? undefined : localStorage;
  const counters = [createTapCounter(C.tap), createTapCounter(C.tap)];
  const tip = new THREE.Vector3();
  let height = LAYOUT.table.h;
  let origin = 'default';
  let edge = null;
  let step = 0;
  let first = null; // the first point of the edge (scene x, z)
  let taps = 0;
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

  const mean = (points) => ({ x: points.reduce((s, p) => s + p.x, 0) / points.length, z: points.reduce((s, p) => s + p.z, 0) / points.length });

  // a finished set of three taps does the current step; returns whether it worked
  function finish(r) {
    notice = '';
    if (STEPS[step] === 'height') return set(r.height - C.fingerThickness);
    const point = mean(r.points);
    if (STEPS[step] === 'edge 1') {
      first = point;
      return true;
    }
    const e = edgeFromPoints(first, point, { frontToOrigin: bounds.maxZ, minSpan: C.edge.minSpan });
    if (!e || !setEdge(e)) {
      notice = `the two edge points are too close (at least ${Math.round(C.edge.minSpan * 100)} cm apart)`;
      return false;
    }
    return true;
  }

  return {
    get height() { return height; },
    get edge() { return edge; },
    set,
    setEdge,

    // each frame: a tracked hand (not a controller) that taps three times with the index finger does the current step
    update(dt) {
      taps = 0;
      ctx.hands.forEach((hand, i) => {
        indexLocal(view, hand, tip);
        const worldY = hand.indexPoint.y;
        // the edge of the real table may lie outside the virtual one: only the height step stays on the table
        const onTable = STEPS[step] !== 'height'
          || (tip.x >= bounds.minX && tip.x <= bounds.maxX && tip.z >= bounds.minZ && tip.z <= bounds.maxZ);
        const over = hand.mode === 'tracked' && hand.held === null && Math.abs(worldY - height) <= C.band && onTable && !ctx.handInput.nearThing(tip);
        const r = counters[i].update(worldY, over, dt, { x: hand.indexPoint.x, z: hand.indexPoint.z });
        taps = Math.max(taps, r.taps);
        if (r.done && finish(r)) step = (step + 1) % STEPS.length;
      });
    },

    statusLine() {
      if (taps > 0) return `${STEPS[step]}: tap ${taps} of ${C.tap.count}`;
      const state = `table ${height.toFixed(2)} m (${origin}${edge ? ', edge set' : ''})`;
      return `${notice || state}; ${C.tap.count} index-finger taps: ${NEXT[STEPS[step]]}`;
    },
  };
}
