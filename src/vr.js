import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createPincer, createFistWrap, createPinchGrip, TIP_Z, PALM_Z } from './hand.js';

export { TIP_Z, PALM_Z };


// Sets up the VR session button and two controllers. A hand is
// { index, grip, gamepad, held, holdMode, grab, pinchOn, squeezeOn, ... }; the grip state belongs to the game code.
// `model` is the fingertip pincer on the controller; `fist` and `pinchGrip` are hands drawn on a held vial
// (their groups are added to the game world by the caller).
export function setupVR(renderer, scene) {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  document.body.appendChild(VRButton.createButton(renderer));

  return [0, 1].map((index) => {
    const controller = renderer.xr.getController(index);
    const grip = renderer.xr.getControllerGrip(index);
    scene.add(controller, grip);

    const model = createPincer();
    grip.add(model.group);

    const hand = {
      index, grip, gamepad: null, held: null, holdMode: null,
      // pose of the held vial relative to the hand: blends from where it was grabbed to the natural hold
      grab: { fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion(), toPos: new THREE.Vector3(), toQuat: new THREE.Quaternion(), t0: 0, axial: 0 },
      pinchOn: false, squeezeOn: false, resetWasPressed: false,
      model, fist: createFistWrap(), pinchGrip: createPinchGrip(),
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

// Visual feedback: the fingertips close with the trigger.
export function showGrip(hand, pinch) {
  hand.model.update(pinch);
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
