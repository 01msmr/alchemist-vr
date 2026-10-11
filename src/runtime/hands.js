import * as THREE from 'three';
import { INPUT, LAYOUT } from '../config/index.js';
import { takeNugget, snuffCandle, levelOf } from '../game/sim.js';
import { distanceToSegment, gripContact } from '../game/geometry.js';
import { PROPS } from '../props.js';
import { holdOffset } from '../tracking.js';
import { analog, showGrip, pulse } from '../vr.js';
import { tipLocal, palmLocal } from './space.js';
import { canDo } from '../handtools.js';
import { clearance } from '../game/zones.js';

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
    hand.grab.closed = mode === 'fist' ? analog(hand).squeeze : analog(hand).pinch; // how far the fingers closed around it
    t.gripTrackValid = false;
    t.crush.reset();
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
    const grabContact = gripContact(bestD, axial, best.spec, contact, mode === 'fist');
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

  // Things a pinch can do other than holding a tool. A controller's hand tool says which of them it may do
  // (`handTool`); a tracked hand may do all of them (null).
  function tryPinchAction(hand, handTool = null) {
    const state = ctx.state;
    const can = (action) => handTool === null || canDo(handTool, action);
    tipLocal(view, hand, tip);
    const source = can('grains') ? sourceNear(tip) : null;
    if (handTool === null && tip.distanceTo(ctx.hud.panel.position) <= reach.reset) {
      ctx.runner.reset(); // pinching the status panel starts over (a tracked hand has no reset button)
      hand.pinchOn = true; // still pinching: not a new press
    } else if (can('match') && tip.distanceTo(ctx.matches.boxCenter) <= reach.matchbox && ctx.matches.tryTake(hand.index)) {
      hand.held = 'match';
      pulse(hand, H.grab.strength, H.grab.ms);
    } else if (source) {
      hand.held = 'grains'; // a pinch of the substance between the fingertips
      hand.grains = source;
      hand.carry = ctx.dropWorld.newCarry(source);
      pulse(hand, H.pinchSource.strength, H.pinchSource.ms);
    } else if (can('nugget') && !state.nugget && Math.hypot(tip.x - c.x, tip.z - c.z) <= reach.nugget && tip.y > reach.nuggetBand.yMin && tip.y < reach.nuggetBand.yMax && takeNugget(state)) {
      ctx.tools.spawn(ctx.tools.tools.nugget, tip);
      beginGrip(hand, ctx.tools.tools.nugget, 'pinch', tip, 1);
    } else if (can('wick') && state.candleLit && tip.distanceTo(wick) <= reach.snuff) {
      snuffCandle(state); // pinch out the flame
      pulse(hand, H.snuff.strength, H.snuff.ms);
    }
  }

  return {
    // The protected areas on the table right now: around everything a pinch could pick up or press (grown by the keep-away
    // distance). A tap inside one is a missed grab, not a calibration of the table. [{ x, z, r } | { x, z, hx, hz }]
    zones() {
      const away = INPUT.calibration.keepAway;
      const list = [];
      for (const t of ctx.tools.list) {
        if (!t.active) continue;
        const flat = Math.hypot(t.up.x, t.up.z); // a tool lying down covers more of the table
        list.push({ x: t.pos.x, z: t.pos.z, r: t.spec.axisHalf * flat + t.spec.grabRadius + away });
      }
      list.push({ x: ctx.matches.boxCenter.x, z: ctx.matches.boxCenter.z, r: reach.matchbox + away });
      for (const name of levelOf(ctx.state).scene.props) {
        const source = PROPS[name].source;
        if (source) list.push({ x: source.center.x, z: source.center.z, r: source.reach + away });
      }
      list.push({ x: c.x, z: c.z, r: Math.max(reach.nugget, reach.snuff) + away }); // the crucible and its flame
      list.push(...(ctx.console?.zones(away) ?? []));
      return list;
    },

    // how far a table point is from the protected areas: { margin, dx, dz, zone } (margin < 0: still too close by that much)
    clearance(x, z) {
      return clearance(this.zones(), x, z);
    },

    nearThing(point) {
      return clearance(this.zones(), point.x, point.z).margin < 0;
    },

    update(dt) {
      ctx.hover.clear(); // the tools a hand could take right now (they get an outline)
      for (const hand of ctx.hands) {
        const { pinch, squeeze } = analog(hand);
        showGrip(hand, pinch);
        if (hand.held === null && (hand.mode === 'tracked' || (hand.mode === 'controller' && canDo(hand.handTool, 'tool')))) { // a hand that can take a tool: outline the one in reach
          tipLocal(view, hand, tmp);
          for (const t of ctx.tools.list) {
            if (!t.active || t.holder !== null) continue;
            const a = t.pos.clone().addScaledVector(t.up, -t.spec.axisHalf);
            const b = t.pos.clone().addScaledVector(t.up, t.spec.axisHalf);
            if (distanceToSegment(tmp, a, b) <= t.spec.grabRadius) ctx.hover.add(t.id);
          }
        }
        // fingertip velocity: grains and thrown things carry it
        tipLocal(view, hand, tmp);
        if (hand.tipValid && dt > 0) hand.tipVel.lerp(new THREE.Vector3().subVectors(tmp, hand.tipPos).divideScalar(dt), motion.smoothing).clampLength(0, motion.maxSpeed);
        else hand.tipVel.set(0, 0, 0);
        hand.tipPos.copy(tmp);
        hand.tipValid = true;

        const controller = hand.mode === 'controller';
        if (!hand.squeezeOn && squeeze >= A.squeezeOn) {
          hand.squeezeOn = true;
          if (!hand.held) {
            if (controller) ctx.handTools.grip(hand); // the grip button changes the hand tool
            else tryGrabTool(hand, 'fist');
          }
        } else if (hand.squeezeOn && squeeze < A.squeezeOff) {
          hand.squeezeOn = false;
          if (hand.held === 'tool' && hand.holdMode === 'fist') ctx.tools.release(hand.tool);
        }

        if (!hand.pinchOn && pinch >= A.pinchOn) {
          hand.pinchOn = true;
          if (!hand.held) {
            if (!controller) {
              if (!tryGrabTool(hand, 'pinch')) tryPinchAction(hand);
            } else if (hand.handTool && !(canDo(hand.handTool, 'tool') && tryGrabTool(hand, 'pinch'))) {
              tryPinchAction(hand, hand.handTool); // the trigger: the tongs hold, the spoon scoops
            }
          }
        } else if (hand.pinchOn && pinch < A.pinchOff) {
          hand.pinchOn = false;
          if (hand.held === 'tool' && hand.holdMode === 'pinch') ctx.tools.release(hand.tool);
          else if (hand.held === 'match') ctx.matches.release();
          else if (hand.held === 'grains') {
            ctx.dropWorld.releaseGrains(hand.grains, hand.tipPos, hand.tipVel, Math.round(hand.carry.load)); // the fingers open: what is left falls
            hand.grains = null;
            hand.carry = null;
            hand.held = null;
          }
        }
        if (hand.held === 'grains' && hand.grains.sprinkle) ctx.dropWorld.trickle(hand.grains, hand.carry, hand.tipPos); // a spoonful of salt spills as the spoon moves
      }
    },

    // A controller carries its hand tool (always drawn); a tracked hand draws itself and its fingertips wrap a held tool.
    updateVisuals() {
      const handPos = new THREE.Vector3();
      for (const hand of ctx.hands) {
        const holding = hand.held === 'tool';
        const controller = hand.mode === 'controller';
        hand.model.group.visible = controller;
        hand.fist.group.visible = false;
        hand.pinchGrip.group.visible = !controller && holding && hand.holdMode === 'pinch';
        hand.fist.group.visible = !controller && holding && hand.holdMode === 'fist';
        if (!holding || controller) continue;
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
