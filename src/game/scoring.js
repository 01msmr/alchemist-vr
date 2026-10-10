import { CFG } from '../config/index.js';
import { clamp01 } from '../util.js';


// 1 in the middle of a window, 0 at its edges
export const windowScore = (value, min, max) => clamp01(1 - Math.abs(value - (min + max) / 2) / ((max - min) / 2));
export const heatScore = (temp) => windowScore(temp, CFG.MELT, CFG.BURN);

// Hidden quality of the amalgam: how close the dose and the heat were to the middle of their windows.
export function amalgamQuality(c) {
  return 0.5 * windowScore(c.amounts.hg ?? 0, CFG.DOSE_MIN, CFG.DOSE_MAX) + 0.5 * heatScore(c.temp);
}

// Hidden quality of the gold: the amalgam it came from, the sulfur dose and the heat.
export function goldQuality(c) {
  return 0.4 * (c.quality ?? 0) + 0.3 * windowScore(c.amounts.sulfur ?? 0, CFG.SULFUR_MIN, CFG.SULFUR_MAX) + 0.3 * heatScore(c.temp);
}
