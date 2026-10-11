import { LAYOUT } from '../config/index.js';

// The shelf's hand tool compartments (pure). A controller puts the tool it carries back, or takes one, with the grip
// button while its working end is at a compartment.

// the compartment whose middle `point` (table-local) is nearest, within the reach, or null
export function slotNear(point, slots = LAYOUT.shelf.slots) {
  const { y, z, reach } = LAYOUT.shelf;
  let best = null;
  let bestD = reach;
  for (const slot of slots) {
    const d = Math.hypot(point.x - slot.x, point.z - z, Math.max(0, Math.abs(point.y - (y + 0.05)) - 0.08)); // anywhere in a band above the board
    if (d <= bestD) {
      best = slot;
      bestD = d;
    }
  }
  return best;
}

// The grip button at a compartment. `inShelf`: Set of the hand tool ids lying in the shelf; `held`: the hand tool the
// controller carries (id or null). Changes `inShelf` and returns what the hand carries afterwards (`changed` false: nothing happened).
//   the tool is lying there: take it (a tool in hand goes back to its own compartment first)
//   the compartment is empty: put the tool back, if it is the one that belongs there
export function gripAtSlot(inShelf, held, slot) {
  if (inShelf.has(slot.id)) {
    if (held) inShelf.add(held);
    inShelf.delete(slot.id);
    return { held: slot.id, changed: true };
  }
  if (held === slot.id) {
    inShelf.add(held);
    return { held: null, changed: true };
  }
  return { held, changed: false };
}
