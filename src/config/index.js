// All tunable values of the game, in one place. One file per domain; everything is read-only.
//   game.js     the rules: doses, temperatures, timings, result thresholds   (CFG)
//   layout.js   where things are: table, crucible, matchbox, dish, panel      (LAYOUT)
//   input.js    hands, controllers, mouse: thresholds, reach, how a grab is judged (INPUT)
//   physics.js  gravity, grip forces, contact                                  (PHYSICS)
//   tools.js    the loose tools: size, mass, grab radius, breaking speed       (TOOLS)
//   view.js     colors, ring and effect sizes, the glass, the status panel     (VIEW)
//   difficulty.js what easy and hard change in the rules                       (DIFFICULTY)
//   handtools.js the tongs and the spoon on a controller                        (HANDTOOLS)
//   hazard.js   warning signs and failure effects: sparks, smoke, haptics, sound  (HAZARD)
//   console.js  the settings console: tap buttons, pull cord               (CONSOLE)
// Colors of the voxel models are the shared palette in ../palette.js.
import { CFG as game } from './game.js';
import { LAYOUT as layout } from './layout.js';
import { INPUT as input } from './input.js';
import { PHYSICS as physics } from './physics.js';
import { TOOLS as tools } from './tools.js';
import { VIEW as view } from './view.js';
import { CONSOLE as console_ } from './console.js';
import { DIFFICULTY as difficulty } from './difficulty.js';
import { HANDTOOLS as handtools } from './handtools.js';
import { HAZARD as hazard } from './hazard.js';

// freezes an object and everything inside it, so nothing changes a value by accident
function deepFreeze(object) {
  for (const value of Object.values(object)) if (value && typeof value === 'object') deepFreeze(value);
  return Object.freeze(object);
}

export const CFG = deepFreeze(game);
export const LAYOUT = deepFreeze(layout);
export const INPUT = deepFreeze(input);
export const PHYSICS = deepFreeze(physics);
export const TOOLS = deepFreeze(tools);
export const VIEW = deepFreeze(view);
export const CONSOLE = deepFreeze(console_);
export const DIFFICULTY = deepFreeze(difficulty);
export const HANDTOOLS = deepFreeze(handtools);
export const HAZARD = deepFreeze(hazard);
