import { LAYOUT, INPUT, CFG } from './config/index.js';
import { dishModel } from './assets.js';
import { P } from './palette.js';

// Static things on the table that a level can show. A prop with a `source` gives out a substance:
// a pinch within `reach` of its `center` takes `count` grains of `amount` doses each.
const { dish, herbs, salt } = LAYOUT;

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
  // level 3: a dish of herbs (burn them on the flame for smoke) and a dish of salt (a spoonful trickles out as the spoon moves low over the table)
  herbs: {
    build: () => dishModel(P.HERB),
    at: herbs,
    collider: { x: herbs.x, y: herbs.height / 2, z: herbs.z, hx: herbs.half, hy: herbs.height / 2, hz: herbs.half },
    source: { substance: 'herb', count: CFG.HERB_GRAINS_PER_PINCH, amount: CFG.HERB_GRAIN, reach: INPUT.reach.dish, center: { x: herbs.x, y: herbs.centerY, z: herbs.z } },
  },
  salt: {
    build: () => dishModel(P.SALT),
    at: salt,
    collider: { x: salt.x, y: salt.height / 2, z: salt.z, hx: salt.half, hy: salt.height / 2, hz: salt.half },
    source: { substance: 'salt', count: CFG.SALT_GRAINS_PER_SCOOP, amount: CFG.GRAIN, sprinkle: true, reach: INPUT.reach.dish, center: { x: salt.x, y: salt.centerY, z: salt.z } },
  },
};
