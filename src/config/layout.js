// Where everything is. Meters, world-local coordinates unless noted: the origin is on the table top, 45 cm in
// front of the player (who stands at the XR origin, facing -z); y is up.
const table = { w: 2, d: 1, h: 0.85, z: -0.65 }; // 2 x 1 m, 0.85 m high; z = center in the scene (not world-local)
const worldOrigin = { x: 0, y: table.h, z: -0.45 }; // in the scene

export const LAYOUT = {
  voxel: 0.01, // 1 voxel = 1 cm
  table,
  worldOrigin,
  // the table's extent in world-local coordinates
  tableBounds: {
    minX: -table.w / 2,
    maxX: table.w / 2,
    minZ: table.z - worldOrigin.z - table.d / 2,
    maxZ: table.z - worldOrigin.z + table.d / 2,
  },

  // the stand with the crucible on it; `crucible` is the crucible's origin (bottom center)
  stand: { halfW: 0.045 }, // footprint half width, also the collider of the crucible walls
  crucible: { x: 0, y: 0.07, z: 0, top: 0.14, innerHalf: 0.033, floor: 0.08 },
  // falling drops: inside `mouth` they land in the crucible, between `mouth` and `rim` they splash off
  landing: { mouth: 0.035, rim: 0.047, splashRadius: 0.06 },
  stir: { radius: 0.035 }, // the rod tip counts as stirring inside this radius, between the floor and the top
  wick: { x: 0, y: 0.045, z: 0 },

  matchbox: { x: -0.18, y: 0, z: 0.07, halfX: 0.03, halfZ: 0.02, height: 0.03 }, // origin = bottom center
  dish: { x: 0.24, y: 0, z: 0.11, half: 0.035, height: 0.03, centerY: 0.02 }, // level 2; centerY = the powder
  // where the tools start: x, z on the table; `lying` = on its side with its axis along x, else standing up
  rest: { vial: { x: 0.22, z: 0.08, lying: false }, rod: { x: 0.3, z: -0.06, lying: true } },

  // status panel behind the table (the only readable text in the headset)
  statusPanel: { y: 0.3, fromBack: 0.1, width: 0.64, height: 0.2 },
};
