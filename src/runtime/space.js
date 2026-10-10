import { tipWorld, indexWorld, palmWorld } from '../vr.js';

// A hand's pinch point and grasp point in world-local coordinates (the table's), written into `out`.
export const tipLocal = (view, hand, out) => view.world.worldToLocal(tipWorld(hand, out));
export const indexLocal = (view, hand, out) => view.world.worldToLocal(indexWorld(hand, out));
export const palmLocal = (view, hand, out) => view.world.worldToLocal(palmWorld(hand, out));
