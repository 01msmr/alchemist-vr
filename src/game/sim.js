import { CFG } from '../config/index.js';
import { LEVELS } from './levels/index.js';

// The state of the game and its rules, as plain functions on a plain object (no rendering, no input).
// Everything level specific (what the crucible accepts, the reactions) is in ./levels/.

export function createState() {
  return {
    vial: { fill: CFG.VIAL_CAPACITY },
    flow: 0, // current pour rate, for the stream visual
    vialBroken: false,
    crucible: { content: 'lead', temp: 0, amounts: {}, quality: null, stir: 0 }, // amounts: substance -> doses in it
    progress: {}, // reaction id -> seconds the condition has held
    wasted: 0,
    level: 1,
    tidyIn: null, // seconds until the finished level's objects are cleared away
    nugget: null, // the gold taken out of the crucible: { kind, quality }
    candleLit: false,
    matches: CFG.MATCHES, // left in the box
    match: null, // match in hand: { lit: seconds left burning (0 = unlit), stroke: m of fast stroke so far, broken: head snapped off }
  };
}

export const levelOf = (s) => LEVELS[s.level - 1];

// ---- matches and the candle ----
export function takeMatch(s) {
  if (s.match || s.matches <= 0) return false;
  s.matches--;
  s.match = { lit: 0, stroke: 0, broken: false };
  return true;
}

export function strikeMatch(s) {
  if (s.match && s.match.lit === 0 && !s.match.broken) s.match.lit = CFG.MATCH_BURN;
}

// The match head moved `dist` meters at `speed` m/s this frame. Only a fast stroke along the striker
// lights it. Returns 'lit', 'broken' or null.
export function strokeMatch(s, onStriker, speed, dist) {
  const m = s.match;
  if (!m || m.lit > 0 || m.broken) return null;
  if (!onStriker || speed < CFG.STRIKE_SPEED) {
    m.stroke = 0; // scraping slowly does nothing
    return null;
  }
  if (speed > CFG.STRIKE_MAX) {
    m.broken = true;
    return 'broken';
  }
  m.stroke += dist;
  if (m.stroke >= CFG.STRIKE_LENGTH) {
    m.lit = CFG.MATCH_BURN;
    return 'lit';
  }
  return null;
}

export function dropMatch(s) {
  s.match = null;
}

// The lit match in hand lights the candle.
export function lightCandle(s) {
  if (s.match && s.match.lit > 0) s.candleLit = true;
}

export function snuffCandle(s) {
  s.candleLit = false;
}

// ---- the vial ----
// The vial broke: its mercury is gone from the vial (the caller spills it as drops). Returns the amount.
export function breakVial(s) {
  const spilled = s.vial.fill;
  s.vial.fill = 0;
  s.vialBroken = true;
  s.flow = 0;
  return spilled;
}

// ---- the crucible ----
// A drop of `kind` reached the crucible mouth. The level decides whether the crucible takes it; otherwise it is wasted.
export function landSubstance(s, kind, amount) {
  const c = s.crucible;
  if (levelOf(s).accepts[kind]?.(c)) c.amounts[kind] = (c.amounts[kind] ?? 0) + amount;
  else s.wasted += amount;
}

// The rod tip moved inside the crucible (stirring) or not: stirring builds up, standing still lets it fade.
export function stirCrucible(s, dt, stirring) {
  const c = s.crucible;
  if (stirring && levelOf(s).stirs?.(c)) c.stir += dt;
  else c.stir = Math.max(0, c.stir - CFG.STIR_DECAY * dt);
}

// Take the finished gold out of the crucible. Returns { kind, quality } or null.
export function takeNugget(s) {
  const c = s.crucible;
  if (!['gold', 'dull', 'fools'].includes(c.content) || s.nugget) return null;
  s.nugget = { kind: c.content, quality: c.quality };
  c.content = 'empty';
  c.amounts = {};
  c.stir = 0;
  return s.nugget;
}

// A level ends a moment after it is complete (the countdown waits while `held`, e.g. the vial is in a hand).
// Returns the next level, once, when it is time to move on; null otherwise.
export function advanceLevel(s, dt, held) {
  const next = LEVELS[s.level];
  if (!next || !levelOf(s).complete(s)) return null;
  if (s.tidyIn === null) s.tidyIn = CFG.TIDY_DELAY;
  if (!held) s.tidyIn -= dt;
  if (s.tidyIn > 0) return null;
  s.level = next.id;
  s.tidyIn = null;
  s.progress = {};
  return next;
}

// Advance the world by dt: the match burns, the candle heats the crucible, the level's reactions run.
export function step(s, dt) {
  const c = s.crucible;

  if (s.match && s.match.lit > 0) {
    s.match.lit -= dt;
    if (s.match.lit <= 0) s.match = null; // burnt out
  }

  c.temp = s.candleLit ? Math.min(1, c.temp + CFG.HEAT_RATE * dt) : Math.max(0, c.temp - CFG.COOL_RATE * dt);

  for (const r of levelOf(s).reactions) {
    if (!r.when(c)) {
      s.progress[r.id] = 0;
      continue;
    }
    s.progress[r.id] = (s.progress[r.id] || 0) + dt;
    if (s.progress[r.id] >= r.hold) {
      r.apply(c);
      s.progress = {};
      break;
    }
  }
}
