// The hand tools a controller carries. Each one "operates" the loose things in a different way with the analog trigger.
// All hand tools start in the shelf (LAYOUT.shelf.slots); the grip button at a compartment takes one or puts it back (src/game/shelf.js).
// Meters. `tipZ` is how far in front of the controller's grip the working end is (where things are taken from).
// `can` lists what the tool may do: 'tool' = hold a loose tool (vial, rod, gold), 'match', 'nugget' = take the gold out
// of the crucible, 'wick' = pinch out the flame, 'grains' = scoop a source (the sulfur dish).
export const HANDTOOLS = {
  tongs: { tipZ: 0.2, open: 0.07, can: ['tool', 'match', 'nugget', 'wick'], color: 0x9aa0a8, rubber: 0x22252a }, // `open` = jaw gap with the trigger released
  spoon: { tipZ: 0.26, can: ['grains'], color: 0xb08a4a, load: 0xebd73c },
};
