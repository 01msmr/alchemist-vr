import { CFG } from '../../config/index.js';
import { rules } from '../rules.js';
import { amalgamQuality } from '../scoring.js';
import { pourStartAngle } from '../pouring.js';

const mercury = (c) => c.amounts.hg ?? 0;

// Level 1: lead + mercury (+ heat) = amalgam. A level is data: what the crucible accepts, the reactions,
// when it is complete, which objects it brings, what the gauge and the status lines show.
export const level1 = {
  id: 1,
  title: 'Lead and mercury',

  // substances the crucible takes from falling drops (everything else is wasted)
  // the instructions on the paper next to the table (old German, in the player's language)
  guide: {
    icon: 'flask', // the picture on the left page
    motto: 'Aus Blei und Quecksilber entstehe Amalgam.', // under the title on the card between the experiments
    title: 'Das erste Werk',
    steps: [
      'Entzünde ein Streichholz am Reibeisen der Schachtel und halte es an den Docht der Kerze.',
      'Erhitze das Blei im Tiegel, bis es schmilzt.',
      'Gieße das Quecksilber aus der Phiole in den Tiegel: ein Maß, nicht mehr und nicht weniger. Der grüne Bogen zeigt es.',
      'Halte es eine Weile, so wird Amalgam daraus. Wird es zu heiß, verbrennt das Blei.',
    ],
  },

  // what the book writes in red when it goes wrong: the outcome, the step that was struck through (index) and the words
  failures: {
    sludge: { step: 2, text: 'Zu viel Quecksilber: der Tiegel ist zur Brühe geworden. Beginne von vorn.' },
    burnt: { step: 1, text: 'Zu heiß, zu lange: das Blei ist verbrannt. Beginne von vorn.' },
  },

  accepts: { hg: (c) => c.content === 'lead' && c.temp >= CFG.MELT },

  // One row per reaction: when the condition has held for `hold` seconds, apply the outcome.
  // Failures are rows too; they do something, they never block.
  reactions: [
    {
      id: 'sludge',
      when: (c) => c.content === 'lead' && mercury(c) > rules().DOSE_MAX,
      hold: 0,
      apply: (c) => { c.content = 'sludge'; c.quality = 0; },
    },
    {
      id: 'burn',
      when: (c) => c.content === 'lead' && c.temp >= rules().BURN,
      get hold() { return rules().BURN_HOLD; }, // read when it is checked: the difficulty can change
      apply: (c) => { c.content = 'burnt'; c.quality = 0; },
    },
    {
      id: 'amalgam',
      when: (c) => c.content === 'lead' && c.temp >= CFG.MELT && mercury(c) >= rules().DOSE_MIN && mercury(c) <= rules().DOSE_MAX,
      hold: CFG.AMALGAM_HOLD,
      apply: (c) => { c.content = 'amalgam'; c.quality = amalgamQuality(c); },
    },
  ],

  // the symbol for the next step: { icon, at } (at = a place, see runtime/hints.js), or null
  // `urgent`: the lead is heating, there is not much time (the hint shows at once on normal)
  hint(s, info) {
    const c = s.crucible;
    const r = rules();
    if (s.vialBroken || c.content !== 'lead') return null;
    if (!s.candleLit) return s.match && s.match.lit > 0 ? { icon: 'fire', at: 'wick' } : { icon: 'strike', at: 'matchbox' };
    // the flame is lit: take the vial now, so that it is ready when the lead melts
    if (mercury(c) >= r.DOSE_MIN) return { icon: 'wait', at: 'crucible', urgent: true };
    if (!info.vialHeld) return { icon: 'vial', at: 'vial', urgent: true, target: 'vial' };
    return c.temp < r.MELT ? { icon: 'wait', at: 'crucible', urgent: true } : { icon: 'pour', at: 'crucible', urgent: true };
  },

  complete: (s) => s.crucible.content === 'amalgam',

  // the objects of this level; the ones that were there before and are not here any more are cleared away
  scene: { tools: ['vial'], props: [] },

  // the rings around the crucible mouth: the dose window, the fill, and two progress arcs
  get gauge() {
    return {
      substance: 'hg',
      window: [rules().DOSE_MIN, rules().DOSE_MAX],
      scale: CFG.VIAL_CAPACITY, // the ring covers 0 .. scale doses
      hold: { from: 'progress', id: 'amalgam', seconds: CFG.AMALGAM_HOLD },
      danger: { id: 'burn', seconds: rules().BURN_HOLD },
    };
  },

  // the level's lines of the status panel; info: { puddleTotal }
  status(s, info) {
    const c = s.crucible;
    return [
      s.vialBroken
        ? `vial BROKEN (R or B/Y resets)  mess ${info.puddleTotal.toFixed(2)}`
        : `vial ${s.vial.fill.toFixed(2)} pours from ${Math.round((pourStartAngle(s.vial.fill) * 180) / Math.PI)} deg  wasted ${s.wasted.toFixed(2)} (on the table ${info.puddleTotal.toFixed(2)})`,
      `crucible: ${c.content}  Hg ${mercury(c).toFixed(2)} (window ${rules().DOSE_MIN}-${rules().DOSE_MAX})`,
    ];
  },
};
