import { tipWorld, palmWorld } from '../vr.js';

// A hand's pinch point and grasp point in world-local coordinates (the table's), written into `out`.
export const tipLocal = (view, hand, out) => view.world.worldToLocal(tipWorld(hand, out));
export const palmLocal = (view, hand, out) => view.world.worldToLocal(palmWorld(hand, out));
