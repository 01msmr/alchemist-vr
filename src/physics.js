import * as CANNON from 'cannon-es';

// Rigid-body physics for the loose objects (tools: the vial, the stirring rod, the gold nugget) and dropped
// matches. The table, the stand with the crucible, the matchbox, the dish and the floor are static.
// A mouse holds a tool rigidly (kinematic); a hand holds it with a force-limited spring (see GRIP).
const SUBSTEP = 1 / 180;
const MATCH_HALF = { x: 0.005, y: 0.025, z: 0.005 };
const MATCH_MASS = 0.002;
const G = 9.81;

// A hand pulls the gripped point to where it wants it with a spring. The force is limited:
// capacity = forceG x weight x contact (how much of the tool is in the hand) x strength (how hard it is pressed).
// Beyond its capacity the grip slips. A fist also steers the orientation; a pinch only weakly
// (the tool pivots between the fingertips). wn = natural frequency of the orientation spring (rad/s).
export const GRIP = {
  fist: { forceG: 2.85, torqueG: 0.1, wn: 60, lose: 0.05 },
  pinch: { forceG: 1.85, torqueG: 0.02, wn: 25, lose: 0.04 },
};
const KP_PER_MASS = 5000; // N/m per kg
const KD_PER_MASS = 160; // N s/m per kg

// opts: { table: {minX, maxX, minZ, maxZ} (top surface at y = 0), floorY,
//         stack: {x, z, h, halfW, baseH, innerHalf} (the stand up to baseH, then a hollow crucible up to h),
//         matchbox: {x, y, z, hx, hy, hz}, onDebrisGone(entry) }
export function createPhysics(opts) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -G, 0) });
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.5;
  world.defaultContactMaterial.restitution = 0.2;

  function staticBox(cx, cy, cz, hx, hy, hz) {
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
    body.position.set(cx, cy, cz);
    world.addBody(body);
    return body;
  }
  const { table, stack, matchbox } = opts;
  // thick slabs, so a fast small object can't get through
  staticBox((table.minX + table.maxX) / 2, -0.15, (table.minZ + table.maxZ) / 2, (table.maxX - table.minX) / 2, 0.15, (table.maxZ - table.minZ) / 2);
  // the stand is solid, the crucible on it is a hollow square ring around an opening a rod or a vial can enter
  staticBox(stack.x, stack.baseH / 2, stack.z, stack.halfW, stack.baseH / 2, stack.halfW);
  staticBox(stack.x, stack.baseH + 0.005, stack.z, stack.halfW, 0.005, stack.halfW); // crucible floor
  const wall = (stack.halfW - stack.innerHalf) / 2;
  const wallBottom = stack.baseH + 0.01;
  const wallHalfH = (stack.h - wallBottom) / 2;
  const wallY = wallBottom + wallHalfH;
  const wallOffset = stack.innerHalf + wall;
  for (const s of [-1, 1]) {
    staticBox(stack.x, wallY, stack.z + s * wallOffset, stack.halfW, wallHalfH, wall); // front and back, full width
    staticBox(stack.x + s * wallOffset, wallY, stack.z, wall, wallHalfH, stack.innerHalf); // the sides between them
  }
  staticBox(matchbox.x, matchbox.y, matchbox.z, matchbox.hx, matchbox.hy, matchbox.hz);
  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // normal up
  floor.position.set(0, opts.floorY, 0);
  world.addBody(floor);

  const tools = [];
  const debris = [];
  const extras = []; // static boxes added later (the dish)

  // A tool: spec is an entry of TOOLS, extra: { onBreak(pos, vel) }. It starts out of the world; spawn() puts it in.
  function addTool(spec, extra = {}) {
    const body = new CANNON.Body({
      mass: spec.mass,
      shape: new CANNON.Box(new CANNON.Vec3(spec.half.x, spec.half.y, spec.half.z)),
      linearDamping: 0.01,
      angularDamping: 0.05,
    });
    let alive = false;
    let grip = null;
    let contactNormal = null;
    body.addEventListener('collide', (e) => { contactNormal = e.contact.ni.clone(); });
    const pre = new CANNON.Vec3();

    function makeDynamic() {
      body.type = CANNON.Body.DYNAMIC;
      body.mass = spec.mass;
      body.updateMassProperties();
    }

    const tool = {
      spec,
      body,
      isAlive: () => alive,
      isGripped: () => grip !== null,
      gripSeparation: () => (grip ? grip.separation : 0),

      spawn(pos, quat = { x: 0, y: 0, z: 0, w: 1 }) {
        grip = null;
        if (!alive) world.addBody(body);
        alive = true;
        makeDynamic();
        body.position.set(pos.x, pos.y, pos.z);
        body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.wakeUp();
      },

      remove() {
        grip = null;
        if (alive) world.removeBody(body);
        alive = false;
      },

      // a mouse takes the tool: it follows setPose() exactly
      hold() {
        grip = null;
        body.type = CANNON.Body.KINEMATIC;
        body.mass = 0;
        body.updateMassProperties();
        body.velocity.setZero();
        body.angularVelocity.setZero();
      },

      setPose(p, q) {
        body.position.set(p.x, p.y, p.z);
        body.quaternion.set(q.x, q.y, q.z, q.w);
      },

      // the mouse lets go: the tool keeps the hand's velocity
      release(lin, ang) {
        makeDynamic();
        body.velocity.set(lin.x, lin.y, lin.z);
        body.angularVelocity.set(ang.x, ang.y, ang.z);
        body.wakeUp();
      },

      // A hand starts gripping at a world point (the center for a fist, the fingertips for a pinch).
      startGrip(mode, anchor, contact) {
        makeDynamic();
        body.wakeUp();
        const local = new CANNON.Vec3();
        body.pointToLocalFrame(new CANNON.Vec3(anchor.x, anchor.y, anchor.z), local);
        grip = {
          mode, local, contact, strength: 1, separation: 0,
          target: new CANNON.Vec3(anchor.x, anchor.y, anchor.z),
          targetVel: new CANNON.Vec3(),
          targetQuat: new CANNON.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w),
        };
      },

      // where the hand wants the gripped point (position, velocity, orientation) and how hard it presses (0..1)
      setGrip(pos, vel, quat, strength) {
        if (!grip) return;
        grip.target.set(pos.x, pos.y, pos.z);
        grip.targetVel.set(vel.x, vel.y, vel.z);
        grip.targetQuat.set(quat.x, quat.y, quat.z, quat.w);
        grip.strength = strength;
      },

      endGrip() {
        grip = null;
      },

      // world position of the gripped point on the tool
      gripAnchor(out) {
        const v = new CANNON.Vec3();
        body.pointToWorldFrame(grip.local, v);
        return out.set(v.x, v.y, v.z);
      },

      readPose(p, q) {
        p.set(body.position.x, body.position.y, body.position.z);
        q.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
      },

      applyGrip() {
        if (!grip || !alive) return;
        const p = GRIP[grip.mode];
        const m = spec.mass;
        const capacity = grip.contact * grip.strength;
        const anchor = new CANNON.Vec3();
        body.pointToWorldFrame(grip.local, anchor);
        const r = anchor.vsub(body.position);
        const vAnchor = body.velocity.vadd(body.angularVelocity.cross(r));
        const delta = grip.target.vsub(anchor);
        grip.separation = delta.length();
        const force = delta.scale(KP_PER_MASS * m).vsub(vAnchor.vsub(grip.targetVel).scale(KD_PER_MASS * m));
        const maxF = p.forceG * m * G * capacity;
        if (force.length() > maxF) force.scale(maxF / force.length(), force);
        body.applyForce(force, r);

        const inertia = (body.inertia.x + body.inertia.y + body.inertia.z) / 3;
        const qe = grip.targetQuat.mult(body.quaternion.inverse());
        const [axis, angle0] = qe.toAxisAngle();
        const angle = angle0 > Math.PI ? angle0 - 2 * Math.PI : angle0;
        const torque = axis.scale(inertia * p.wn * p.wn * angle).vsub(body.angularVelocity.scale(2 * inertia * p.wn));
        const maxT = p.torqueG * m * G * capacity; // scaled with the weight like the force
        if (torque.length() > maxT) torque.scale(maxT / torque.length(), torque);
        body.torque.vadd(torque, body.torque);
      },

      snapshot() {
        pre.copy(body.velocity);
        contactNormal = null;
      },

      // impact speed along the contact normal, from the velocity before the solver slowed the tool
      checkBreak() {
        if (!alive || spec.breakSpeed === null || body.type !== CANNON.Body.DYNAMIC || !contactNormal) return;
        if (Math.abs(pre.dot(contactNormal)) <= spec.breakSpeed) return;
        const pos = { x: body.position.x, y: body.position.y, z: body.position.z };
        const vel = { x: pre.x, y: pre.y, z: pre.z };
        tool.remove();
        extra.onBreak?.(pos, vel);
      },
    };
    tools.push(tool);
    return tool;
  }

  function addStaticBox(cx, cy, cz, hx, hy, hz) {
    const body = staticBox(cx, cy, cz, hx, hy, hz);
    extras.push(body);
    return body;
  }

  function removeExtras() {
    for (const body of extras.splice(0)) world.removeBody(body);
  }

  function addDebris(pos, quat, lin, data) {
    const body = new CANNON.Body({ mass: MATCH_MASS, shape: new CANNON.Box(new CANNON.Vec3(MATCH_HALF.x, MATCH_HALF.y, MATCH_HALF.z)) });
    body.position.set(pos.x, pos.y, pos.z);
    body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    body.velocity.set(lin.x, lin.y, lin.z);
    world.addBody(body);
    const entry = { body, ttl: 5, data };
    debris.push(entry);
    return entry;
  }

  function clearDebris() {
    for (const entry of debris.splice(0)) {
      world.removeBody(entry.body);
      opts.onDebrisGone?.(entry);
    }
  }

  // everything back to the start: no tools in the world, no extra statics, no debris
  function reset() {
    clearDebris();
    removeExtras();
    for (const tool of tools) tool.remove();
  }

  function step(dt) {
    if (dt <= 0) return;
    const n = Math.min(12, Math.max(1, Math.ceil(dt / SUBSTEP)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      for (const tool of tools) {
        tool.snapshot();
        tool.applyGrip();
      }
      world.step(h);
      for (const tool of tools) tool.checkBreak();
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      debris[i].ttl -= dt;
      if (debris[i].ttl <= 0) {
        const [entry] = debris.splice(i, 1);
        world.removeBody(entry.body);
        opts.onDebrisGone?.(entry);
      }
    }
  }

  return { world, tools, debris, addTool, addStaticBox, removeExtras, addDebris, clearDebris, reset, step };
}
