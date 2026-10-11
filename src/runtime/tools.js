import * as THREE from 'three';
import { CFG, INPUT, LAYOUT, PHYSICS, TOOLS, VIEW } from '../config/index.js';
import { toGeometry } from '../voxel-mesh.js';
import { splitGlass, liquidModel, fillLayers, toolSpecFromModel } from '../img2vox/vessel.js';
import { splitShards } from '../shards.js';
import { rodModel, nuggetModel } from '../assets.js';
import { breakVial } from '../game/sim.js';
import { holdStrength, createCrushMeter } from '../game/geometry.js';
import { createVecFilter, createQuatFilter } from '../filters.js';
import { analog, pulse } from '../vr.js';
import { tipLocal } from './space.js';

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const { grip: GRIP } = PHYSICS;
const { motion, haptics: H } = INPUT;

// The loose tools the player takes: the vial (a voxelized potion bottle: see-through glass, opaque metal and the
// liquid inside), the stirring rod and the gold nugget. A tool is held by a mouse (rigidly) or by a hand (with a
// force-limited grip), or lies free as a rigid body. ctx.bottle.shell is the bottle's voxel model.
export function createTools(ctx) {
  const { view, physics } = ctx;
  const { world, part, remesh, refresh } = view;
  const mat = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const handPos = new THREE.Vector3();
  const handQuat = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const bottleLayers = fillLayers(ctx.bottle.shell); // layers the liquid can fill

  function makeTool(id, extra, spec = TOOLS[id]) {
    const group = new THREE.Group();
    group.visible = false;
    world.add(group);
    const mesh = part(group);
    mesh.position.y = -spec.half.y; // models have their origin at the bottom, the body at the center
    return {
      id, spec, group, mesh,
      ph: physics.addTool(spec, extra),
      pickMeshes: [mesh], // what a mouse click can hit
      active: false,
      holder: null, // null | 'mouse' | hand index
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      up: new THREE.Vector3(0, 1, 0),
      // motion of a mouse-held tool, handed to the physics when it is let go
      lin: new THREE.Vector3(),
      ang: new THREE.Vector3(),
      prevPos: new THREE.Vector3(),
      prevQuat: new THREE.Quaternion(),
      trackValid: false,
      // where a hand wants it, and how that target moves
      gripPos: new THREE.Vector3(),
      gripQuat: new THREE.Quaternion(),
      gripVel: new THREE.Vector3(),
      prevGripPos: new THREE.Vector3(),
      gripTrackValid: false,
      grabOffset: new THREE.Vector2(), // mouse: pointer to tool offset
      // smooths the pose a fist wants the tool at (reset when a hand takes the tool)
      crush: createCrushMeter(INPUT.crushSeconds), // a fragile tool breaks when squeezed too hard for too long
      fistFilter: { pos: createVecFilter(INPUT.filter.fist.pos), rot: createQuatFilter(INPUT.filter.fist.rot) },
    };
  }

  const vialSpec = { ...TOOLS.vial, ...toolSpecFromModel(ctx.bottle.shell, LAYOUT.voxel) };
  const tools = {
    vial: makeTool('vial', { onBreak: (pos, vel, quat) => onVialBreak(pos, vel, quat) }, vialSpec),
    rod: makeTool('rod'),
    nugget: makeTool('nugget'),
  };
  const list = Object.values(tools);
  remesh(tools.rod.mesh, rodModel());

  // the vial: metal (the tool's own mesh) and liquid are opaque, the glass is see-through and drawn after them
  const parts = splitGlass(ctx.bottle.shell);
  remesh(tools.vial.mesh, parts.metal);
  const glass = new THREE.Mesh(toGeometry(parts.glass, LAYOUT.voxel), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: VIEW.glass.opacity, depthWrite: false }));
  glass.position.y = -vialSpec.half.y;
  glass.renderOrder = 1;
  tools.vial.group.add(glass);
  tools.vial.pickMeshes.push(glass);
  const liquid = part(tools.vial.group);
  liquid.position.y = -vialSpec.half.y;

  // the pieces of the broken vial (voxels cut along two diagonals), cut once
  const shardParts = splitShards(ctx.bottle.shell, LAYOUT.voxel);
  const shardMetal = (obj) => new THREE.Mesh(toGeometry(obj, LAYOUT.voxel), view.material);
  const shardGlass = (obj) => new THREE.Mesh(toGeometry(obj, LAYOUT.voxel), glass.material);

  // Every piece starts where it was in the vial, bursts outward and up, and tumbles.
  function spawnShards(pos, vel, quat) {
    const q = tmpQuat.set(quat.x, quat.y, quat.z, quat.w);
    const S = PHYSICS.shard;
    shardParts.forEach((shard, i) => {
      const c = shard.center;
      const offset = new THREE.Vector3(c.x, c.y - vialSpec.half.y, c.z).applyQuaternion(q); // from the vial's center
      const out = Math.hypot(offset.x, offset.z) || 1;
      const lin = {
        x: vel.x * S.inherit + (offset.x / out) * S.burst,
        y: vel.y * S.inherit + S.lift * (0.6 + 0.4 * ((i * 0.618) % 1)),
        z: vel.z * S.inherit + (offset.z / out) * S.burst,
      };
      const angle = i * 2.4; // a different tumble for each piece
      const spin = { x: Math.cos(angle) * S.spin, y: Math.sin(angle * 1.7) * S.spin, z: Math.sin(angle) * S.spin };
      const group = new THREE.Group();
      const { metal, glass: glassPart } = splitGlass(shard.obj);
      for (const [obj, make] of [[metal, shardMetal], [glassPart, shardGlass]]) {
        if (!obj.data.some((v) => v)) continue;
        const mesh = make(obj);
        mesh.position.set(-c.x, -c.y, -c.z); // the group's origin is the piece's middle
        if (make === shardGlass) mesh.renderOrder = 1;
        group.add(mesh);
      }
      world.add(group);
      physics.addDebris(tmp.copy(offset).add(pos), q, lin, group, { half: shard.half, mass: S.mass, ttl: S.lifetime, spin });
    });
  }

  function onVialBreak(pos, vel, quat) {
    deactivate(tools.vial);
    spawnShards(pos, vel, quat);
    ctx.dropWorld.scatter(pos, vel, breakVial(ctx.state));
  }

  function spawn(t, pos, quat = new THREE.Quaternion()) {
    t.ph.spawn(pos, quat);
    t.pos.copy(pos);
    t.quat.copy(quat);
    t.up.copy(UP).applyQuaternion(quat);
    t.active = true;
    t.holder = null;
    t.trackValid = false;
    t.gripTrackValid = false;
    t.group.visible = true;
  }

  // put a tool where it starts: standing on the table, or lying along x
  function spawnAtRest(id) {
    const t = tools[id];
    const r = LAYOUT.rest[id];
    const pos = new THREE.Vector3(r.x, (r.y ?? 0) + (r.lying ? t.spec.half.x : t.spec.half.y), r.z);
    spawn(t, pos, r.lying ? new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.PI / 2) : new THREE.Quaternion());
  }

  // takes the tool out of the game (and out of any hand)
  function deactivate(t) {
    if (typeof t.holder === 'number') {
      const hand = ctx.hands[t.holder];
      if (hand) {
        hand.held = null;
        hand.tool = null;
        hand.holdMode = null;
      }
    }
    t.holder = null;
    t.active = false;
    t.ph.remove();
    t.group.visible = false;
  }

  // Velocity of a mouse-held tool (smoothed), so a release throws, drops or sets it down like the hand moved.
  function trackMouse(t, dt) {
    if (t.trackValid && dt > 0) {
      t.lin.lerp(tmp.subVectors(t.pos, t.prevPos).divideScalar(dt), motion.smoothing).clampLength(0, motion.maxSpeed);
      tmpQuat.copy(t.prevQuat).invert().premultiply(t.quat); // rotation since the last frame
      if (tmpQuat.w < 0) tmpQuat.set(-tmpQuat.x, -tmpQuat.y, -tmpQuat.z, -tmpQuat.w);
      const s = Math.sqrt(Math.max(0, 1 - tmpQuat.w * tmpQuat.w));
      const angle = 2 * Math.acos(Math.min(1, tmpQuat.w));
      tmp.set(tmpQuat.x, tmpQuat.y, tmpQuat.z).multiplyScalar(s > 1e-6 ? angle / s / dt : 0);
      t.ang.lerp(tmp, motion.smoothing).clampLength(0, motion.maxSpin);
    } else {
      t.lin.set(0, 0, 0);
      t.ang.set(0, 0, 0);
    }
    t.prevPos.copy(t.pos);
    t.prevQuat.copy(t.quat);
    t.trackValid = true;
  }

  // Motion of the target a hand wants the tool at (for the damping of the grip spring).
  function trackHand(t, dt) {
    if (t.gripTrackValid && dt > 0) t.gripVel.lerp(tmp.subVectors(t.gripPos, t.prevGripPos).divideScalar(dt), motion.smoothing).clampLength(0, motion.maxSpeed);
    else t.gripVel.set(0, 0, 0);
    t.prevGripPos.copy(t.gripPos);
    t.gripTrackValid = true;
  }

  function release(t) {
    if (t.holder === null) return;
    if (t.holder === 'mouse') {
      t.ph.release(t.lin, t.ang);
    } else {
      const hand = ctx.hands[t.holder];
      if (hand) {
        hand.held = null;
        hand.tool = null;
        hand.holdMode = null;
      }
      t.ph.endGrip(); // keeps the velocity the tool has: it drops, tips, rolls or breaks
    }
    t.holder = null;
    t.trackValid = false;
    t.gripTrackValid = false;
  }

  // A tool slipped out of the hand (grip too weak for the weight and motion, or pulled too far away).
  function lose(t, hand) {
    t.ph.endGrip();
    hand.held = null;
    hand.tool = null;
    hand.holdMode = null;
    t.holder = null;
    t.gripTrackValid = false;
    pulse(hand, H.slip.strength, H.slip.ms);
  }

  // Where each hand wants the tool it holds: a fist settles it into the natural hold, a pinch pulls the pinched point.
  function updateHandTargets(dt) {
    for (const hand of ctx.hands) {
      if (hand.held !== 'tool') continue;
      const t = hand.tool;
      const g = hand.grab;
      if (hand.holdMode === 'fist') {
        const k = Math.min(1, (ctx.clock.elapsedTime - g.t0) / INPUT.snapTime);
        const e = k * k * (3 - 2 * k);
        mat.compose(handPos.lerpVectors(g.fromPos, g.toPos, e), handQuat.slerpQuaternions(g.fromQuat, g.toQuat, e), ONE);
        mat.premultiply(hand.grip.matrixWorld).premultiply(view.worldInv).decompose(t.gripPos, t.gripQuat, scale);
        const p = t.fistFilter.pos.filter(t.gripPos, dt); // tracked joints jitter: calm it while slow
        const q = t.fistFilter.rot.filter(t.gripQuat, dt);
        t.gripPos.set(p.x, p.y, p.z);
        t.gripQuat.set(q.x, q.y, q.z, q.w);
      } else {
        tipLocal(view, hand, t.gripPos); // the fingertips pull the pinched point along
        mat.copy(hand.grip.matrixWorld).premultiply(view.worldInv).decompose(handPos, handQuat, scale);
        t.gripQuat.copy(handQuat).multiply(g.fromQuat);
      }
    }
  }

  // The physics for one frame: the mouse holds a tool rigidly, a hand holds it with a force-limited grip.
  function stepPhysics(dt) {
    for (const t of list) {
      if (!t.active) continue;
      if (t.holder === 'mouse') {
        t.ph.setPose(t.pos, t.quat);
        trackMouse(t, dt);
      } else if (t.holder !== null) {
        const hand = ctx.hands[t.holder];
        const { pinch, squeeze } = analog(hand);
        const floor = INPUT.gripStrengthFloor;
        trackHand(t, dt);
        const closed = hand.holdMode === 'fist' ? squeeze : pinch;
        hand.grab.closed = Math.max(hand.grab.closed, closed); // closing tighter than at the grab makes the hold firmer
        // only a full hand squeezes: two fingertips meet whatever the tool, and nothing stops them in VR
        if (t.spec.crush !== null && hand.holdMode === 'fist' && t.crush.update(closed >= t.spec.crush, dt)) {
          t.ph.breakNow();
          continue;
        }
        t.ph.setGrip(t.gripPos, t.gripVel, t.gripQuat, holdStrength(closed, hand.grab.closed, floor));
      }
    }
    physics.step(dt);
    for (const t of list) {
      if (!t.active) continue;
      if (typeof t.holder === 'number' && t.ph.gripSeparation() > GRIP[ctx.hands[t.holder].holdMode].lose) lose(t, ctx.hands[t.holder]);
      if (t.holder !== 'mouse') t.ph.readPose(t.pos, t.quat);
    }
    for (const t of list) {
      if (!t.active) continue;
      t.up.copy(UP).applyQuaternion(t.quat);
      t.group.position.copy(t.pos);
      t.group.quaternion.copy(t.quat);
    }
  }

  // The look that depends on the state: the liquid layers in the vial, the kind of gold in the nugget.
  function refreshLook(state) {
    if (tools.vial.active) {
      const lit = Math.ceil(Math.min(1, state.vial.fill / CFG.VIAL_CAPACITY) * bottleLayers - 1e-9); // layers with liquid
      refresh('vial', lit, liquid, () => liquidModel(ctx.bottle.shell, lit / bottleLayers));
    }
    if (tools.nugget.active && state.nugget) {
      const kind = state.nugget.kind;
      refresh('nugget', kind, tools.nugget.mesh, () => nuggetModel(kind));
    }
  }

  // The white outline around the tools a hint points at or a hand could take now: a slightly larger shell of the same model,
  // seen from inside, pulsing. `ids`: the tools to outline.
  const glows = new Map(); // id -> [mesh]
  function glowOf(t) {
    if (!glows.has(t.id)) {
      const shells = t.pickMeshes.map((source) => {
        const shell = new THREE.Mesh(source.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.BackSide, depthWrite: false }));
        shell.scale.setScalar(1.22);
        shell.position.copy(source.position);
        shell.position.y -= 0.11 * 2 * t.spec.half.y; // the model grows about its bottom: bring it back to the middle
        shell.renderOrder = 2;
        t.group.add(shell);
        return shell;
      });
      glows.set(t.id, shells);
    }
    return glows.get(t.id);
  }
  function refreshGlow(ids, time) {
    for (const t of list) {
      const on = ids.has(t.id) && t.active;
      if (!on && !glows.has(t.id)) continue;
      for (const shell of glowOf(t)) {
        shell.visible = on;
        shell.material.opacity = 0.35 + 0.25 * Math.sin(time * 6);
      }
    }
  }

  return { tools, list, spawn, spawnAtRest, deactivate, release, lose, updateHandTargets, stepPhysics, refreshLook, refreshGlow };
}
