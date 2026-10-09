import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createHand, TIP_Z, PALM_Z } from './hand.js';

export { TIP_Z, PALM_Z };

const palmGeometry = new THREE.SphereGeometry(0.025, 12, 8);
const IDLE_PALM = new THREE.Color(0x777b80);
const ACTIVE_PALM = new THREE.Color(0x4caf50);

// Sets up the VR session button and two controllers. A hand is
// { index, grip, gamepad, held, offset, pinchOn, squeezeOn, ... }; the grip state belongs to the game code.
export function setupVR(renderer, scene) {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  document.body.appendChild(VRButton.createButton(renderer));

  return [0, 1].map((index) => {
    const controller = renderer.xr.getController(index);
    const grip = renderer.xr.getControllerGrip(index);
    scene.add(controller, grip);

    const model = createHand();
    const palmMaterial = new THREE.MeshBasicMaterial({ color: IDLE_PALM, wireframe: true });
    const palm = new THREE.Mesh(palmGeometry, palmMaterial);
    palm.position.z = -PALM_Z;
    grip.add(model.group, palm);

    const hand = {
      index, grip, gamepad: null, held: null, offset: null,
      pinchOn: false, squeezeOn: false, resetWasPressed: false, model, palmMaterial,
    };
    controller.addEventListener('connected', (e) => { hand.gamepad = e.data.gamepad; });
    controller.addEventListener('disconnected', () => { hand.gamepad = null; });
    return hand;
  });
}

// World-space point where the index finger / thumb pinch happens.
export function tipWorld(hand, out) {
  return out.set(0, 0, -TIP_Z).applyMatrix4(hand.grip.matrixWorld);
}

// World-space center of the closed hand.
export function palmWorld(hand, out) {
  return out.set(0, 0, -PALM_Z).applyMatrix4(hand.grip.matrixWorld);
}

// Analog finger values 0..1: index finger on the trigger (pinch), other fingers on the grip button (full hand).
export function analog(hand) {
  const b = hand.gamepad?.buttons;
  return { pinch: b?.[0]?.value ?? 0, squeeze: b?.[1]?.value ?? 0 };
}

// Visual feedback: the hand closes with the finger values; the grab zone (palm sphere) turns green while gripping.
export function showGrip(hand, pinch, squeeze) {
  hand.model.update(pinch, squeeze);
  hand.palmMaterial.color.copy(IDLE_PALM).lerp(ACTIVE_PALM, squeeze);
}

export function pulse(hand, intensity, ms) {
  const actuator = hand.gamepad?.hapticActuators?.[0];
  try {
    if (actuator) actuator.pulse(Math.min(1, intensity), ms);
    else hand.gamepad?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: intensity, weakMagnitude: intensity });
  } catch {
    // haptics are optional
  }
}

// True once per press of the B / Y face button (button 5 on Quest Touch controllers).
export function resetPressed(hand) {
  const down = !!hand.gamepad?.buttons[5]?.pressed;
  const edge = down && !hand.resetWasPressed;
  hand.resetWasPressed = down;
  return edge;
}
