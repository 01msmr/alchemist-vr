import * as THREE from 'three';
import { INPUT, LAYOUT, PHYSICS } from '../config/index.js';
import { toGeometry } from '../voxel-mesh.js';
import { matchModel, matchboxModel } from '../assets.js';
import { takeMatch, strokeMatch, dropMatch, lightCandle } from '../game/sim.js';
import { pulse } from '../vr.js';

const { matchbox, wick } = LAYOUT;
const { match: M, striker: STRIKER, reach, motion, haptics: H } = INPUT;
const ROTATION = new THREE.Matrix4().makeRotationX(-Math.PI / 2); // the model's +y -> the grip's -Z

// The match in hand: taken from the box, struck on the striker with a fast stroke, held to the wick. A dropped
// match falls as a loose object and disappears. Held by the mouse or by a hand (index).
export function createMatches(ctx) {
  const { view, physics } = ctx;
  const mesh = view.meshes.match;
  const wickPoint = new THREE.Vector3(wick.x, wick.y, wick.z);
  let holder = null; // null | 'mouse' | hand index
  const mousePos = new THREE.Vector3(); // mouse: bottom of the match
  const head = new THREE.Vector3(); // the match head, world-local
  const prevHead = new THREE.Vector3();
  const headVel = new THREE.Vector3();
  let prevHeadValid = false;
  const mat = new THREE.Matrix4();
  const mat2 = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const boxCenter = new THREE.Vector3(matchbox.x, matchbox.y + matchbox.height / 2, matchbox.z);

  // Held near its bottom, the head sticking out beyond the fingers. The pinch point is wherever the fingertips are
  // in the grip frame (a fixed point for a controller).
  const attach = (hand, out) => out.makeTranslation(hand.tipInGrip.x, hand.tipInGrip.y, hand.tipInGrip.z + M.pinchDy).multiply(ROTATION);
  const headOf = (hand, out) => {
    out.set(hand.tipInGrip.x, hand.tipInGrip.y, hand.tipInGrip.z + M.pinchDy - M.headDy);
    return view.world.worldToLocal(out.applyMatrix4(hand.grip.matrixWorld));
  };

  function release() {
    if (holder === null) return;
    const hand = ctx.hands[holder];
    if (hand) hand.held = null;
    holder = null;
    const m = ctx.state.match;
    if (m) { // a loose match falls from the hand
      const half = PHYSICS.match.half.y;
      const group = new THREE.Group();
      group.add(new THREE.Mesh(toGeometry(matchModel(m.lit > 0, m.broken), LAYOUT.voxel), view.material));
      group.children[0].position.y = -half;
      view.world.add(group);
      tmp.set(0, half, 0).applyQuaternion(mesh.quaternion).add(mesh.position);
      physics.addDebris(tmp, mesh.quaternion, headVel, group);
    }
    dropMatch(ctx.state);
  }

  return {
    get holder() { return holder; },
    boxCenter,

    // a hand or the mouse takes a match from the box; false if the hand is full or the box is empty
    tryTake(who) {
      if (holder !== null || !takeMatch(ctx.state)) return false;
      holder = who;
      return true;
    },
    moveMouse(x, z) {
      mousePos.set(x, INPUT.mouse.matchY, z);
    },
    release,

    // where the match is this frame, from the hand or the mouse
    updatePose() {
      if (holder === 'mouse') {
        mesh.position.copy(mousePos);
        mesh.quaternion.identity();
        head.set(mousePos.x, mousePos.y + M.headDy, mousePos.z);
      } else if (holder !== null) {
        const hand = ctx.hands[holder];
        mat.copy(hand.grip.matrixWorld).multiply(attach(hand, mat2)).premultiply(view.worldInv);
        mat.decompose(mesh.position, mesh.quaternion, scale);
        headOf(hand, head);
      }
    },

    // Strike on the matchbox (fast sideways motion over the striker), light the candle at the wick.
    update(dt) {
      const state = ctx.state;
      if (holder !== null && !state.match) { // burnt out in the hand
        const hand = ctx.hands[holder];
        if (hand) hand.held = null;
        holder = null;
      }
      if (holder === null || !state.match || dt <= 0) {
        prevHeadValid = false;
        headVel.set(0, 0, 0);
        return;
      }
      const hand = holder === 'mouse' ? null : ctx.hands[holder];
      if (prevHeadValid) {
        headVel.lerp(tmp.subVectors(head, prevHead).divideScalar(dt), motion.smoothing).clampLength(0, motion.maxSpeed);
        const dist = Math.hypot(head.x - prevHead.x, head.z - prevHead.z);
        const onBox = Math.abs(head.x - matchbox.x) <= matchbox.halfX && Math.abs(head.z - matchbox.z) <= matchbox.halfZ && head.y >= STRIKER.yMin && head.y <= STRIKER.yMax;
        const result = strokeMatch(state, onBox, dist / dt, dist);
        if (hand && result === 'lit') pulse(hand, H.strike.strength, H.strike.ms);
        else if (hand && result === 'broken') pulse(hand, H.snap.strength, H.snap.ms);
      }
      prevHead.copy(head);
      prevHeadValid = true;
      if (!state.candleLit && state.match.lit > 0 && head.distanceTo(wickPoint) <= reach.light) {
        lightCandle(state);
        if (hand) pulse(hand, H.candle.strength, H.candle.ms);
      }
    },

    // the look of the match in hand and of the box (one red head per match left)
    refreshLook(state) {
      mesh.visible = !!state.match;
      if (state.match) {
        const lit = state.match.lit > 0;
        const broken = state.match.broken;
        view.refresh('match', `${lit}|${broken}`, mesh, () => matchModel(lit, broken));
      }
      view.refresh('box', state.matches, view.meshes.box, () => matchboxModel(state.matches));
    },

    reset() {
      holder = null;
      prevHeadValid = false;
    },
  };
}
