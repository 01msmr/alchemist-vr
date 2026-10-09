import * as CANNON from 'cannon-es';

// Rigid-body physics for the loose objects: the vial and a dropped match. The table, the stand with the
// crucible, the matchbox and the floor are static. While the vial is held it is a kinematic body that
// follows the hand; on release it becomes dynamic with the hand's velocity.
export const BREAK_SPEED = 2.2; // m/s impact speed along the contact normal (a drop of about 25 cm)
export const VIAL_HALF = { x: 0.025, y: 0.055, z: 0.025 };
const VIAL_MASS = 0.05;
const MATCH_HALF = { x: 0.005, y: 0.025, z: 0.005 };
const MATCH_MASS = 0.002;
const SUBSTEP = 1 / 180;

// A hand holds the vial with a spring that pulls the gripped point to the hand, limited in force:
// capacity = max force x contact (how much of the vial is in the hand) x strength (how hard it is pressed).
// Beyond its capacity the grip slips. A fist also steers the vial's orientation; a pinch only weakly
// (the vial pivots between the fingertips).
export const GRIP = {
  fist: { force: 1.4, torque: 0.05, kr: 0.19, kw: 0.0063, lose: 0.05 },
  pinch: { force: 0.9, torque: 0.01, kr: 0.02, kw: 0.003, lose: 0.04 },
};
const KP = 250; // N/m
const KD = 8; // N s/m

// opts: { table: {minX, maxX, minZ, maxZ} (top surface at y = 0), floorY, stack: {x, z, h, halfW},
//         matchbox: {x, y, z, hx, hy, hz}, vialRest: {x, y, z}, onBreak(pos, vel), onDebrisGone(entry) }
export function createPhysics(opts) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.5;
  world.defaultContactMaterial.restitution = 0.2;

  function staticBox(cx, cy, cz, hx, hy, hz) {
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
    body.position.set(cx, cy, cz);
    world.addBody(body);
  }
  const { table, stack, matchbox } = opts;
  // thick slabs, so a fast small object can't get through
  staticBox((table.minX + table.maxX) / 2, -0.15, (table.minZ + table.maxZ) / 2, (table.maxX - table.minX) / 2, 0.15, (table.maxZ - table.minZ) / 2);
  staticBox(stack.x, stack.h / 2, stack.z, stack.halfW, stack.h / 2, stack.halfW);
  staticBox(matchbox.x, matchbox.y, matchbox.z, matchbox.hx, matchbox.hy, matchbox.hz);
  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // normal up
  floor.position.set(0, opts.floorY, 0);
  world.addBody(floor);

  const vial = new CANNON.Body({
    mass: VIAL_MASS,
    shape: new CANNON.Box(new CANNON.Vec3(VIAL_HALF.x, VIAL_HALF.y, VIAL_HALF.z)),
    linearDamping: 0.01,
    angularDamping: 0.05,
  });
  let alive = false;
  let contactNormal = null;
  vial.addEventListener('collide', (e) => { contactNormal = e.contact.ni.clone(); });

  const debris = [];
  let grip = null;

  function reset() {
    grip = null;
    for (const entry of debris.splice(0)) {
      world.removeBody(entry.body);
      opts.onDebrisGone?.(entry);
    }
    if (!alive) world.addBody(vial);
    alive = true;
    vial.type = CANNON.Body.DYNAMIC;
    vial.mass = VIAL_MASS;
    vial.updateMassProperties();
    vial.position.set(opts.vialRest.x, opts.vialRest.y, opts.vialRest.z);
    vial.quaternion.set(0, 0, 0, 1);
    vial.velocity.setZero();
    vial.angularVelocity.setZero();
    vial.wakeUp();
  }

  // the hand takes the vial: it follows setPose() exactly
  function hold() {
    vial.type = CANNON.Body.KINEMATIC;
    vial.mass = 0;
    vial.updateMassProperties();
    vial.velocity.setZero();
    vial.angularVelocity.setZero();
  }

  function setPose(p, q) {
    vial.position.set(p.x, p.y, p.z);
    vial.quaternion.set(q.x, q.y, q.z, q.w);
  }

  // the hand lets go: the vial keeps the hand's velocity
  function release(lin, ang) {
    vial.type = CANNON.Body.DYNAMIC;
    vial.mass = VIAL_MASS;
    vial.updateMassProperties();
    vial.velocity.set(lin.x, lin.y, lin.z);
    vial.angularVelocity.set(ang.x, ang.y, ang.z);
    vial.wakeUp();
  }

  // Start gripping at a world point (the vial's center for a fist, the fingertips for a pinch).
  function startGrip(mode, anchor, contact) {
    vial.type = CANNON.Body.DYNAMIC;
    vial.mass = VIAL_MASS;
    vial.updateMassProperties();
    vial.wakeUp();
    const local = new CANNON.Vec3();
    vial.pointToLocalFrame(new CANNON.Vec3(anchor.x, anchor.y, anchor.z), local);
    grip = {
      mode, local, contact, strength: 1, separation: 0,
      target: new CANNON.Vec3(anchor.x, anchor.y, anchor.z),
      targetVel: new CANNON.Vec3(),
      targetQuat: new CANNON.Quaternion(vial.quaternion.x, vial.quaternion.y, vial.quaternion.z, vial.quaternion.w),
    };
  }

  // Where the hand wants the gripped point (position, velocity, orientation) and how hard it presses (0..1).
  function setGrip(pos, vel, quat, strength) {
    if (!grip) return;
    grip.target.set(pos.x, pos.y, pos.z);
    grip.targetVel.set(vel.x, vel.y, vel.z);
    grip.targetQuat.set(quat.x, quat.y, quat.z, quat.w);
    grip.strength = strength;
  }

  function endGrip() {
    grip = null;
  }

  function applyGrip() {
    if (!grip || !alive) return;
    const p = GRIP[grip.mode];
    const maxF = p.force * grip.contact * grip.strength;
    const anchor = new CANNON.Vec3();
    vial.pointToWorldFrame(grip.local, anchor);
    const r = anchor.vsub(vial.position);
    const vAnchor = vial.velocity.vadd(vial.angularVelocity.cross(r));
    const delta = grip.target.vsub(anchor);
    grip.separation = delta.length();
    const force = delta.scale(KP).vsub(vAnchor.vsub(grip.targetVel).scale(KD));
    if (force.length() > maxF) force.scale(maxF / force.length(), force);
    vial.applyForce(force, r);

    const qe = grip.targetQuat.mult(vial.quaternion.inverse());
    const [axis, angle0] = qe.toAxisAngle();
    const angle = angle0 > Math.PI ? angle0 - 2 * Math.PI : angle0;
    const torque = axis.scale(p.kr * angle).vsub(vial.angularVelocity.scale(p.kw));
    const maxT = p.torque * grip.contact * grip.strength;
    if (torque.length() > maxT) torque.scale(maxT / torque.length(), torque);
    vial.torque.vadd(torque, vial.torque);
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

  const pre = new CANNON.Vec3();
  function step(dt) {
    if (dt <= 0) return;
    const n = Math.min(12, Math.max(1, Math.ceil(dt / SUBSTEP)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      pre.copy(vial.velocity);
      contactNormal = null;
      applyGrip();
      world.step(h);
      // impact speed along the contact normal, from the velocity before the solver slowed the vial
      if (alive && vial.type === CANNON.Body.DYNAMIC && contactNormal && Math.abs(pre.dot(contactNormal)) > BREAK_SPEED) {
        const pos = { x: vial.position.x, y: vial.position.y, z: vial.position.z };
        const vel = { x: pre.x, y: pre.y, z: pre.z };
        alive = false;
        grip = null;
        world.removeBody(vial);
        opts.onBreak?.(pos, vel);
      }
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

  function readPose(p, q) {
    p.set(vial.position.x, vial.position.y, vial.position.z);
    q.set(vial.quaternion.x, vial.quaternion.y, vial.quaternion.z, vial.quaternion.w);
  }

  reset();
  // world position of the gripped point on the vial, and how far the hand has pulled away from it
  function gripAnchor(out) {
    const v = new CANNON.Vec3();
    vial.pointToWorldFrame(grip.local, v);
    return out.set(v.x, v.y, v.z);
  }

  return {
    vial, debris, reset, hold, setPose, release, startGrip, setGrip, endGrip, gripAnchor, addDebris, step, readPose,
    isAlive: () => alive,
    isGripped: () => grip !== null,
    gripSeparation: () => (grip ? grip.separation : 0),
  };
}
