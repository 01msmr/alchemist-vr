import { HAZARD } from '../config/index.js';
import { hazard, failureOf, pulseFor, crackleRate } from '../game/hazard.js';
import { rules } from '../game/rules.js';
import { levelOf } from '../game/sim.js';
import { pulse } from '../vr.js';

// What goes wrong, shown three ways: sparks, smoke and a symbol at the crucible (view/hazard.js); the controllers pulse and
// crackle faster as it gets worse, a long hiss when it fails (no thud); the book writes the reason in red ink on the page.
export function createHazardWorld(ctx, hazardView, bookView, audio) {
  let last = 'lead'; // the crucible's content in the last frame
  let failure = null; // { kind } while the failure symbol shows
  let failureLeft = 0;
  let hapticLeft = 0;
  let time = 0;
  let crackleAcc = 0;

  function fail(kind) {
    failure = kind;
    failureLeft = HAZARD.failureSeconds;
    hazardView.burst(kind);
    audio.hiss();
    const h = HAZARD.haptic;
    ctx.hands.forEach((hand) => { // a few light ticks, not a thump
      for (let i = 0; i < h.failTicks; i++) setTimeout(() => pulse(hand, h.failStrength, h.ms), i * h.failGap * 1000);
    });
    const note = levelOf(ctx.state).failures?.[kind];
    if (note) bookView.setNote(ctx.state.level - 1, note);
  }

  return {
    // a restart wipes the notes and the signs
    reset() {
      last = 'lead';
      failure = null;
      failureLeft = 0;
      for (let k = 0; k < 3; k++) bookView.setNote(k, null);
    },

    update(dt) {
      time += dt;
      const s = ctx.state;
      if (s.crucible.content !== last) {
        last = s.crucible.content;
        const kind = failureOf(last);
        if (kind) fail(kind);
      }
      const h = hazard(s, rules());
      failureLeft = Math.max(0, failureLeft - dt);
      if (failureLeft === 0) failure = null;

      const icon = failure ? { name: 'skull', color: HAZARD.icon.fail } : h.level >= HAZARD.iconFrom ? { name: h.kind === 'lump' ? 'stir' : 'fire', color: h.kind === 'lump' ? HAZARD.icon.stir : HAZARD.icon.warn } : null;
      hazardView.update(dt, h.level, icon, time);

      hapticLeft -= dt;
      const p = pulseFor(h.level);
      if (p && hapticLeft <= 0) {
        hapticLeft = p.gap;
        for (const hand of ctx.hands) pulse(hand, p.strength, HAZARD.haptic.ms);
      }

      crackleAcc += crackleRate(h.level) * dt;
      for (; crackleAcc >= 1; crackleAcc -= 1) audio.crackle(h.level);
    },
  };
}
