// The loose objects the player picks up. Sizes in meters, y is the tool's long axis; the origin of each
// physics body is its center, the voxel models have their origin at the bottom center.
//   axisHalf: half length along the axis (grab test, palm coverage); grabRadius: how close a hand must be
//   snap: 'upright' = a fist turns it upright through the hand, 'keep' = keeps the orientation it was grabbed in
//   breakSpeed: impact speed along the contact normal that breaks it (null = unbreakable)
//   direct: true = a controller takes it with its own grip, without tongs (the stirring rod)
//   crush: how tightly a full hand (0..1 closure of the fingers) squeezes it before it breaks (null = never)
export const TOOLS = {
  vial: { half: { x: 0.025, y: 0.055, z: 0.025 }, mass: 0.05, axisHalf: 0.055, radius: 0.025, grabRadius: 0.03, snap: 'upright', breakSpeed: 2.2, crush: 0.97 },
  rod: { half: { x: 0.0075, y: 0.075, z: 0.0075 }, mass: 0.02, axisHalf: 0.075, radius: 0.009, grabRadius: 0.045, snap: 'keep', breakSpeed: null, crush: null, direct: true },
  nugget: { half: { x: 0.015, y: 0.01, z: 0.01 }, mass: 0.03, axisHalf: 0.01, radius: 0.015, grabRadius: 0.025, snap: 'keep', breakSpeed: null, crush: null },
};
