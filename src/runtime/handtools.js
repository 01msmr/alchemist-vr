import { HANDTOOLS } from '../config/index.js';
import { nextTool } from '../handtools.js';
import { pulse } from '../vr.js';

// Which hand tool each controller carries. At the start the right hand has the tongs and the left the spoon; the grip
// button goes through the tools in HANDTOOLS.order.
export function createHandTools(ctx) {
  function equip(hand, id) {
    hand.handTool = id;
    hand.tipZ = HANDTOOLS[id].tipZ;
    hand.model.setTool(id);
  }
  for (const hand of ctx.hands) equip(hand, HANDTOOLS.start[hand.handedness] ?? HANDTOOLS.order[0]);

  return {
    equip,
    // the grip button was pressed with nothing in the hand
    grip(hand) {
      equip(hand, nextTool(hand.handTool));
      pulse(hand, 0.3, 40);
    },
  };
}
