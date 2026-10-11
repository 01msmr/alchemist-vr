// Where everything is. Meters, world-local coordinates unless noted: the origin is on the table top, 45 cm in
// front of the player (who stands at the XR origin, facing -z); y is up.
// 2 x 1 m, 0.85 m high until the player sets the real table's height (heightRange = plausible heights);
// z = center in the scene (not world-local)
const table = { w: 1.6, d: 0.8, h: 0.85, heightRange: [0.4, 1.4], z: -0.65 };
const worldOrigin = { x: 0, y: table.h, z: -0.45 }; // in the scene

const backEdge = table.z - worldOrigin.z - table.d / 2; // the table's far edge (world-local z)
const shelfZ = backEdge + 0.22; // the shelf stands this far in front of the far edge (15 cm nearer than it was, to be within reach)

export const LAYOUT = {
  voxel: 0.0075, // 1 voxel = 0.75 cm (was 1 cm: more detail at the same size; the models in assets.js are described in cm)
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
  // level 3: the herb and salt dishes, the straw cat and its cushion
  herbs: { x: -0.32, y: 0, z: 0.1, half: 0.035, height: 0.03, centerY: 0.02 },
  salt: { x: -0.42, y: 0, z: 0.1, half: 0.035, height: 0.03, centerY: 0.02 },
  cat: { x: -0.25, z: -0.28, eyeY: 0.03 }, // where the cat lies; its eyes are at this height
  cushion: { x: -0.55, z: -0.36, half: 0.05 },
  // the old book with the instructions, open, lying left of the experiment (yaw in rad; a page is pageW x pageD m)
  book: { x: -0.55, z: -0.12, pageW: 0.2, pageD: 0.28, yaw: 0.1, zone: 0.07 },
  // where the tools start: x, z on the table; `lying` = on its side with its axis along x, else standing up
  // (y = where it stands: the shelf's top; the main tools start in the left half of the shelf)
  rest: { vial: { x: -0.425, y: 0.12, z: shelfZ, lying: false }, rod: { x: -0.2, y: 0.12, z: shelfZ, lying: true } },
  // the shelf along the far edge: main tools in the left half, hand tools in the right; the hand tools are `slots`
  // (x = the middle of the compartment, `reach` = how close a controller's working end must be to put a tool back or take it)
  shelf: {
    y: 0.12, z: shelfZ, depth: 0.1, thickness: 0.012, post: 0.02,
    dividers: [-0.7, -0.55, -0.3, 0, 0.31, 0.69], // x of the thin walls between compartments (0 = between main and hand tools)
    slots: [{ id: 'tongs', x: 0.17 }, { id: 'spoon', x: 0.5 }],
    spare: { x: -0.625 }, // the compartment of the spare vial (easy only)
    reach: 0.12,
  },

  // status panel behind the table (the only readable text in the headset)
  statusPanel: { y: 0.45, fromBack: 0.1, width: 0.64, height: 0.2 },
};
