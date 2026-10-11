import { CFG } from '../../config/index.js';
import { rules } from '../rules.js';
import { goldQuality } from '../scoring.js';

const sulfur = (c) => c.amounts.sulfur ?? 0;
const sulfurOk = (c) => sulfur(c) >= rules().SULFUR_MIN && sulfur(c) <= rules().SULFUR_MAX;

// Level 2: amalgam + sulfur + heat + stirring = gold (or dull gold, or fool's gold, by quality).
export const level2 = {
  id: 2,
  title: 'Amalgam and sulfur',

  accepts: { sulfur: (c) => c.content === 'amalgam' },
  // what can be stirred: hot amalgam that has sulfur in it
  stirs: (c) => c.content === 'amalgam' && sulfur(c) > 0 && c.temp >= CFG.MELT,

  reactions: [
    {
      id: 'slag',
      when: (c) => c.content === 'amalgam' && sulfur(c) > rules().SULFUR_MAX,
      hold: 0,
      apply: (c) => { c.content = 'slag'; c.quality = 0; },
    },
    {
      id: 'burn2',
      when: (c) => c.content === 'amalgam' && sulfur(c) > 0 && c.temp >= rules().BURN,
      get hold() { return rules().BURN_HOLD; }, // read when it is checked: the difficulty can change
      apply: (c) => { c.content = 'burnt'; c.quality = 0; },
    },
    {
      id: 'gold',
      when: (c) => c.content === 'amalgam' && sulfurOk(c) && c.temp >= CFG.MELT && c.stir >= rules().STIR_NEEDED,
      hold: 0,
      apply: (c) => {
        c.quality = goldQuality(c);
        c.content = c.quality >= CFG.GOLD_MIN ? 'gold' : c.quality >= CFG.DULL_MIN ? 'dull' : 'fools';
      },
    },
    {
      id: 'lumps', // right dose, right heat, never stirred: it clumps into fool's gold
      when: (c) => c.content === 'amalgam' && sulfurOk(c) && c.temp >= CFG.MELT,
      get hold() { return rules().LUMP_HOLD; }, // read when it is checked: the difficulty can change
      apply: (c) => { c.content = 'fools'; c.quality = 0.2; },
    },
  ],

  complete: (s) => s.nugget !== null, // the gold has been taken out

  scene: { tools: ['rod'], props: ['dish'] },

  get gauge() {
    return {
      substance: 'sulfur',
      window: [rules().SULFUR_MIN, rules().SULFUR_MAX],
      scale: CFG.SULFUR_GAUGE,
      hold: { from: 'stir', seconds: rules().STIR_NEEDED },
      danger: { id: 'burn2', seconds: rules().BURN_HOLD },
    };
  },

  status(s, info) {
    const c = s.crucible;
    return [
      `sulfur ${sulfur(c).toFixed(2)} (window ${rules().SULFUR_MIN}-${rules().SULFUR_MAX})  stir ${c.stir.toFixed(1)}/${rules().STIR_NEEDED}s  mess ${info.puddleTotal.toFixed(2)}`,
      `crucible: ${c.content}${s.nugget ? `  you hold the ${s.nugget.kind}` : ''}`,
    ];
  },
};
