import * as THREE from 'three';
import { HANDTOOLS, INPUT, LAYOUT } from '../config/index.js';
import { slotNear, gripAtSlot } from '../game/shelf.js';
import { pulse } from '../vr.js';
import { tipLocal } from './space.js';

// Which hand tool each controller carries. At the start both lie in the shelf and the hands are empty. The grip button
// at a compartment of the shelf takes the tool that lies there or puts the one in hand back (src/game/shelf.js).
export function createHandTools(ctx) {
  const inShelf = new Set(LAYOUT.shelf.slots.map((slot) => slot.id)); // the hand tools lying in the shelf
  const tip = new THREE.Vector3();

  function equip(hand, id) {
    hand.handTool = id;
    hand.tipZ = id ? HANDTOOLS[id].tipZ : INPUT.controller.tipZ;
    hand.model.setTool(id);
  }
  for (const hand of ctx.hands) equip(hand, null);

  return {
    equip,
    inShelf,
    // the grip button was pressed with nothing in the hand
    grip(hand) {
      const slot = slotNear(tipLocal(ctx.view, hand, tip));
      if (!slot) return;
      const result = gripAtSlot(inShelf, hand.handTool, slot);
      if (!result.changed) return;
      equip(hand, result.held);
      pulse(hand, 0.3, 40);
    },
  };
}
