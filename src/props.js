import { LAYOUT, INPUT, CFG } from './config/index.js';
import { dishModel } from './assets.js';

// Static things on the table that a level can show. A prop with a `source` gives out a substance:
// a pinch within `reach` of its `center` takes `count` grains of `amount` doses each.
const { dish } = LAYOUT;

export const PROPS = {
  dish: {
    build: dishModel,
    at: dish, // origin = bottom center
    collider: { x: dish.x, y: dish.height / 2, z: dish.z, hx: dish.half, hy: dish.height / 2, hz: dish.half },
    source: {
      substance: 'sulfur',
      count: CFG.GRAINS_PER_PINCH,
      amount: CFG.GRAIN,
      reach: INPUT.reach.dish,
      center: { x: dish.x, y: dish.centerY, z: dish.z },
    },
  },
};
