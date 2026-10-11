import { VIEW } from '../config/index.js';
import { LEVELS } from '../game/levels/index.js';
import { commitLevel } from '../game/sim.js';
import { createTransition, beginTransition, stepTransition, cancelTransition } from '../game/transition.js';

// The change between experiments at work: when a level is done, the picture fades to black, in the dark the next level is set
// up and a title card shows, then it brightens. Also at the start of the game (black, the card of the first experiment, bright)
// and at the very end (the card "Das Ende", then back to the finished table).
export function createTransitionRuntime(ctx, fade) {
  const tr = createTransition();
  let pending = null; // { next, before }: the level to enter when it is black
  let card = null; // { title, subtitle }
  let ended = false;

  const begin = (options) => beginTransition(tr, options);

  return {
    get active() { return tr.phase !== 'idle'; },
    get frame() { return fade.frame; },

    // the start of the game: black with the card of the first experiment
    intro() {
      const guide = LEVELS[0].guide;
      card = { title: guide.title, subtitle: guide.motto };
      pending = null;
      begin({ startDark: true });
    },

    // a level is done (or the perfect preconditions of a level are wanted): fade out, set up `next` in the dark; `preset`: from a clean table, in the perfect state of that level
    go(next, before, { preset = false } = {}) {
      if (!preset) ctx.audio?.chime(false); // an experiment is done
      pending = { next, before, preset };
      card = { title: next.guide.title, subtitle: next.guide.motto };
      begin();
    },

    // the game starts over (restart): no fade, and the ending can come again
    cancel() {
      cancelTransition(tr);
      pending = null;
      ended = false;
      fade.update({ dark: 0, card: 0 });
    },

    update(dt) {
      const s = ctx.state;
      const last = LEVELS[LEVELS.length - 1];
      if (!ended && tr.phase === 'idle' && s.level === last.id && last.complete(s)) { // the last experiment is done
        ended = true;
        card = { title: last.guide.end.title, subtitle: last.guide.end.motto };
        pending = null;
        begin();
      }
      const f = stepTransition(tr, dt, VIEW.transition);
      if (f.swap && pending) {
        if (pending.preset) {
          ended = false;
          ctx.runner.begin(pending.next, { preset: true }); // a clean table in the perfect state of that level
        } else {
          commitLevel(ctx.state, pending.next);
          ctx.runner.enter(pending.next, pending.before);
        }
        pending = null;
      }
      if (f.cardStart && card) {
        fade.showCard(card.title, card.subtitle);
        if (ended && !pending) ctx.audio?.chime(true); // the card of the very end
      }
      fade.update(f);
    },
  };
}
