import * as THREE from 'three';
import { INPUT, LAYOUT } from '../config/index.js';
import { createDwell, validHeight, loadHeight, saveHeight } from '../calibration.js';
import { pulse } from '../vr.js';
import { tipLocal } from './space.js';

const C = INPUT.calibration;
const range = LAYOUT.table.heightRange;
const bounds = LAYOUT.tableBounds;

// The virtual table stands at the height of the real one. Rest a fingertip on the real table and hold a pinch still
// for a second (not next to anything you could pick up): the height of the fingertip is the table top. It is remembered
// for the next session. Until then the table is at its default height (LAYOUT.table.h).
export function createCalibration(ctx) {
  const { view, physics } = ctx;
  const storage = typeof localStorage === 'undefined' ? undefined : localStorage;
  const dwells = [createDwell({ seconds: C.holdSeconds, maxSpeed: C.maxSpeed }), createDwell({ seconds: C.holdSeconds, maxSpeed: C.maxSpeed })];
  const tip = new THREE.Vector3();
  let height = LAYOUT.table.h;
  let origin = 'default';
  let progress = 0;

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

  function set(h) {
    if (!validHeight(h, range)) return false;
    apply(h);
    saveHeight(storage, C.storageKey, h, range);
    origin = 'set';
    return true;
  }

  return {
    get height() { return height; },
    set,

    // each frame: a hand that holds a pinch still on the table sets its height
    update(dt) {
      progress = 0;
      ctx.hands.forEach((hand, i) => {
        tipLocal(view, hand, tip);
        const worldY = hand.tipPoint.y;
        const onTable = hand.mode !== 'none' && hand.pinchOn && hand.held === null
          && Math.abs(worldY - height) <= C.band
          && tip.x >= bounds.minX && tip.x <= bounds.maxX && tip.z >= bounds.minZ && tip.z <= bounds.maxZ
          && !ctx.handInput.nearThing(tip);
        const r = dwells[i].update(onTable, hand.tipVel.length(), dt);
        progress = Math.max(progress, r.progress);
        if (r.done && set(worldY - C.fingerThickness)) pulse(hand, 0.5, 80);
      });
    },

    statusLine() {
      if (progress > 0) return `setting the table height... ${Math.round(progress * 100)}%`;
      return `table ${height.toFixed(2)} m (${origin}; rest a finger on your table and hold a pinch to set it)`;
    },
  };
}
