import * as THREE from 'three';
import { INPUT, LAYOUT } from '../config/index.js';
import { takeNugget, snuffCandle, levelOf } from '../game/sim.js';
import { distanceToSegment } from '../game/geometry.js';
import { PROPS } from '../props.js';
import { clamp01 } from '../util.js';
import { holdOffset } from '../tracking.js';
import { analog, showGrip, pulse } from '../vr.js';
import { tipLocal, palmLocal } from './space.js';

const ONE = new THREE.Vector3(1, 1, 1);
const { reach, contact, analog: A, motion, haptics: H } = INPUT;
const c = LAYOUT.crucible;

// What the hands (tracked or controllers) can do. Two grips, like two kinds of fingers:
//   full hand (closed fist / grip button): a tool, the palm on it as the hand closes;
//   pinch (thumb and index finger / trigger): a tool by two fingertips, the match, a pinch of sulfur, the gold,
//   the wick, or the status panel (to start over), the tip on it as the fingers close.
// A grab only starts while the hand is closing; releasing is a deliberate loosening (hysteresis).
export function createHandInput(ctx) {
  const { view } = ctx;
  const mat = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const palm = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const wick = new THREE.Vector3(LAYOUT.wick.x, LAYOUT.wick.y, LAYOUT.wick.z);

  // A hand starts holding a tool at `point` (palm for a fist, fingertips for a pinch). How well it is held depends
  // on how much of the tool is in the hand: a grab at the edge or over the end is weak and slips.
  function beginGrip(hand, t, mode, point, grabContact) {
    t.holder = hand.index;
    hand.held = 'tool';
    hand.tool = t;
    hand.holdMode = mode;
    hand.grab.axial = Math.max(-t.spec.axisHalf, Math.min(t.spec.axisHalf, tmp.copy(point).sub(t.pos).dot(t.up)));
    hand.grab.t0 = ctx.clock.elapsedTime;
    t.gripTrackValid = false;
    t.fistFilter.pos.reset();
    t.fistFilter.rot.reset();
    // the tool's pose relative to the hand at the moment of grabbing
    mat.compose(t.pos, t.quat, ONE).premultiply(view.world.matrixWorld);
    mat.premultiply(hand.grip.matrixWorld.clone().invert()).decompose(hand.grab.fromPos, hand.grab.fromQuat, scale);
    if (mode === 'fist' && t.spec.snap === 'upright') {
      // settles into a natural hold: standing through the fist, thumb side up
      const o = holdOffset(hand.mode, hand.handedness, t.spec.radius);
      hand.grab.toPos.set(o.x, o.y, o.z);
      hand.grab.toQuat.identity();
    } else {
      // keeps the pose it had; a pinch pivots between the fingertips
      hand.grab.toPos.copy(hand.grab.fromPos);
      hand.grab.toQuat.copy(hand.grab.fromQuat);
    }
    t.ph.startGrip(mode, mode === 'fist' ? t.pos : point, grabContact);
    pulse(hand, H.grab.strength, H.grab.ms);
  }

  function tryGrabTool(hand, mode) {
    const point = mode === 'fist' ? palmLocal(view, hand, palm) : tipLocal(view, hand, tip);
    let best = null;
    let bestD = Infinity;
    for (const t of ctx.tools.list) {
      if (!t.active || t.holder !== null) continue;
      const a = t.pos.clone().addScaledVector(t.up, -t.spec.axisHalf);
      const b = t.pos.clone().addScaledVector(t.up, t.spec.axisHalf);
      const d = distanceToSegment(point, a, b);
      if (d <= t.spec.grabRadius && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    if (!best) return false;
    const axial = point.clone().sub(best.pos).dot(best.up);
    let grabContact = 1 - contact.offAxisPenalty * Math.min(1, bestD / best.spec.grabRadius); // off the axis: only the edge is caught
    if (mode === 'fist') grabContact *= clamp01((best.spec.axisHalf - Math.abs(axial) + contact.palmReach) / contact.palmSpan); // palm over the end: half in the hand
    beginGrip(hand, best, mode, point, grabContact);
    return true;
  }

  // the sources of substances (a dish of sulfur) among the props of the current level
  function sourceNear(point) {
    for (const name of levelOf(ctx.state).scene.props) {
      const source = PROPS[name].source;
      if (source && tmp.set(source.center.x, source.center.y, source.center.z).distanceTo(point) <= source.reach) return source;
    }
    return null;
  }

  // Things a pinch can do other than holding a tool.
  function tryPinchAction(hand) {
    const state = ctx.state;
    tipLocal(view, hand, tip);
    const source = sourceNear(tip);
    if (tip.distanceTo(ctx.hud.panel.position) <= reach.reset) {
      ctx.runner.reset(); // pinching the status panel starts over (a tracked hand has no reset button)
      hand.pinchOn = true; // still pinching: not a new press
    } else if (tip.distanceTo(ctx.matches.boxCenter) <= reach.matchbox && ctx.matches.tryTake(hand.index)) {
      hand.held = 'match';
      pulse(hand, H.grab.strength, H.grab.ms);
    } else if (source) {
      hand.held = 'grains'; // a pinch of the substance between the fingertips
      hand.grains = source;
      pulse(hand, H.pinchSource.strength, H.pinchSource.ms);
    } else if (!state.nugget && Math.hypot(tip.x - c.x, tip.z - c.z) <= reach.nugget && tip.y > reach.nuggetBand.yMin && tip.y < reach.nuggetBand.yMax && takeNugget(state)) {
      ctx.tools.spawn(ctx.tools.tools.nugget, tip);
      beginGrip(hand, ctx.tools.tools.nugget, 'pinch', tip, 1);
    } else if (state.candleLit && tip.distanceTo(wick) <= reach.snuff) {
      snuffCandle(state); // pinch out the flame
      pulse(hand, H.snuff.strength, H.snuff.ms);
    }
  }

  return {
    // Is this point (world-local) near anything a pinch could pick up or press? A pinch held still next to
    // such a thing is a missed grab, not a calibration of the table.
    nearThing(point) {
      const away = INPUT.calibration.keepAway;
      for (const t of ctx.tools.list) {
        if (!t.active) continue;
        const a = t.pos.clone().addScaledVector(t.up, -t.spec.axisHalf);
        const b = t.pos.clone().addScaledVector(t.up, t.spec.axisHalf);
        if (distanceToSegment(point, a, b) < t.spec.grabRadius + away) return true;
      }
      if (point.distanceTo(ctx.matches.boxCenter) < reach.matchbox + away) return true;
      if (levelOf(ctx.state).scene.props.some((name) => PROPS[name].source && tmp.set(PROPS[name].source.center.x, PROPS[name].source.center.y, PROPS[name].source.center.z).distanceTo(point) < PROPS[name].source.reach + away)) return true;
      if (point.distanceTo(wick) < reach.snuff + away) return true;
      if (Math.hypot(point.x - c.x, point.z - c.z) < reach.nugget + away) return true;
      return point.distanceTo(ctx.hud.panel.position) < reach.reset + away;
    },

    update(dt) {
      for (const hand of ctx.hands) {
        const { pinch, squeeze } = analog(hand);
        showGrip(hand, pinch);
        // fingertip velocity: grains and thrown things carry it
        tipLocal(view, hand, tmp);
        if (hand.tipValid && dt > 0) hand.tipVel.lerp(new THREE.Vector3().subVectors(tmp, hand.tipPos).divideScalar(dt), motion.smoothing).clampLength(0, motion.maxSpeed);
        else hand.tipVel.set(0, 0, 0);
        hand.tipPos.copy(tmp);
        hand.tipValid = true;

        if (!hand.squeezeOn && squeeze >= A.squeezeOn) {
          hand.squeezeOn = true;
          if (!hand.held) tryGrabTool(hand, 'fist');
        } else if (hand.squeezeOn && squeeze < A.squeezeOff) {
          hand.squeezeOn = false;
          if (hand.held === 'tool' && hand.holdMode === 'fist') ctx.tools.release(hand.tool);
        }

        if (!hand.pinchOn && pinch >= A.pinchOn) {
          hand.pinchOn = true;
          if (!hand.held && !tryGrabTool(hand, 'pinch')) tryPinchAction(hand);
        } else if (hand.pinchOn && pinch < A.pinchOff) {
          hand.pinchOn = false;
          if (hand.held === 'tool' && hand.holdMode === 'pinch') ctx.tools.release(hand.tool);
          else if (hand.held === 'match') ctx.matches.release();
          else if (hand.held === 'grains') {
            ctx.dropWorld.releaseGrains(hand.grains, hand.tipPos, hand.tipVel); // the fingers open: the grains fall
            hand.grains = null;
            hand.held = null;
          }
        }
      }
    },

    // A controller's hand is drawn on the tool it holds; a tracked hand draws itself.
    updateVisuals() {
      const handPos = new THREE.Vector3();
      for (const hand of ctx.hands) {
        const holding = hand.held === 'tool';
        const drawn = hand.mode === 'controller';
        hand.model.group.visible = drawn && !holding;
        hand.fist.group.visible = drawn && holding && hand.holdMode === 'fist';
        hand.pinchGrip.group.visible = drawn && holding && hand.holdMode === 'pinch';
        if (!holding || !drawn) continue;
        const t = hand.tool;
        view.world.worldToLocal(tmp.setFromMatrixPosition(hand.grip.matrixWorld));
        if (hand.holdMode === 'fist') {
          hand.fist.place(handPos.copy(t.pos).addScaledVector(t.up, hand.grab.axial), t.up, tmp, t.spec.radius);
        } else {
          t.ph.gripAnchor(handPos);
          hand.pinchGrip.place(handPos, t.up, tmp, t.spec.radius);
        }
      }
    },
  };
}
