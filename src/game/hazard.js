import { HAZARD } from '../config/index.js';

// What is going wrong in the crucible, pure.
const clamp = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

// the outcomes that count as a failure (the content of the crucible after a reaction)
export const FAILED = ['sludge', 'burnt', 'slag', 'fools', 'dull'];
export const failureOf = (content) => (FAILED.includes(content) ? content : null);

// How badly it is going wrong: { level 0..1, kind: 'heat' | 'lump' | null }. `r` = rules().
//   heat: from the critical glow up to the burn temperature (0..0.5), then the time held there until it burns (0.5..1)
//   lump: the right conditions without stirring, until it clumps
export function hazard(s, r) {
  const c = s.crucible;
  let heat = 0;
  if (c.content === 'lead' || c.content === 'amalgam') {
    const burning = Math.max(s.progress.burn ?? 0, s.progress.burn2 ?? 0) / r.BURN_HOLD;
    heat = c.temp >= r.BURN ? 0.5 + 0.5 * clamp(burning) : 0.5 * clamp((c.temp - r.CRITICAL) / (r.BURN - r.CRITICAL));
  }
  const lump = (s.progress.lumps ?? 0) > 0 ? 0.3 + 0.7 * clamp(s.progress.lumps / r.LUMP_HOLD) : 0;
  if (heat <= 0 && lump <= 0) return { level: 0, kind: null };
  return heat >= lump ? { level: heat, kind: 'heat' } : { level: lump, kind: 'lump' };
}

// the controller pulse for a hazard level: { gap (s between pulses), strength 0..1 }, or null below the haptic threshold
export function pulseFor(level, cfg = HAZARD) {
  const h = cfg.haptic;
  if (level < cfg.warnFrom) return null;
  const t = clamp((level - cfg.warnFrom) / (1 - cfg.warnFrom));
  return { gap: lerp(h.gapSlow, h.gapFast, t), strength: lerp(h.strengthLow, h.strengthHigh, t) };
}

// crackles per second for a hazard level (0 below the threshold)
export function crackleRate(level, cfg = HAZARD) {
  if (level < cfg.warnFrom) return 0;
  return lerp(cfg.sound.crackleMin, cfg.sound.crackleMax, clamp((level - cfg.warnFrom) / (1 - cfg.warnFrom)));
}
