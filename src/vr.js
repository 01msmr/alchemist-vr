import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// The interaction point of a controller: this far in front of the grip origin (-Z).
// Unverified for Quest controllers: if the tip sphere floats beside the real controller tip, tune this.
export const TIP_Z = 0.08;

const tipGeometry = new THREE.SphereGeometry(0.006, 12, 8);
const bodyGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.12);
const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x555a60 });
const tipMaterial = new THREE.MeshBasicMaterial({ color: 0xffd54f });

// Sets up the VR session button and two controllers. handlers: { squeezeStart, squeezeEnd, selectStart }(hand).
// A hand is { index, grip, gamepad, held, offset }; `held` and `offset` belong to the game code.
export function setupVR(renderer, scene, handlers) {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  document.body.appendChild(VRButton.createButton(renderer));

  return [0, 1].map((index) => {
    const controller = renderer.xr.getController(index);
    const grip = renderer.xr.getControllerGrip(index);
    scene.add(controller, grip);

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.z = -0.02;
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.z = -TIP_Z;
    grip.add(body, tip);

    const hand = { index, grip, gamepad: null, held: null, offset: null, resetWasPressed: false };
    controller.addEventListener('connected', (e) => { hand.gamepad = e.data.gamepad; });
    controller.addEventListener('disconnected', () => { hand.gamepad = null; });
    controller.addEventListener('squeezestart', () => handlers.squeezeStart(hand));
    controller.addEventListener('squeezeend', () => handlers.squeezeEnd(hand));
    controller.addEventListener('selectstart', () => handlers.selectStart(hand));
    return hand;
  });
}

// World-space position of the controller tip.
export function tipWorld(hand, out) {
  return out.set(0, 0, -TIP_Z).applyMatrix4(hand.grip.matrixWorld);
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
