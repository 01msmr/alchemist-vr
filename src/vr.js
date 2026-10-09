import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Interaction points in the grip space (-Z is forward out of the controller). Both are unverified for
// Quest controllers: if the spheres sit off the real controller, tune them.
export const TIP_Z = 0.08; // pinch point, where the index finger would be
export const PALM_Z = 0.02; // center of the closed hand

const tipGeometry = new THREE.SphereGeometry(0.006, 12, 8);
const palmGeometry = new THREE.SphereGeometry(0.025, 12, 8);
const bodyGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.12);
const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x555a60 });
const IDLE_TIP = new THREE.Color(0xffd54f);
const ACTIVE_TIP = new THREE.Color(0xe53935);
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

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.z = -0.02;
    const tipMaterial = new THREE.MeshBasicMaterial({ color: IDLE_TIP });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.z = -TIP_Z;
    const palmMaterial = new THREE.MeshBasicMaterial({ color: IDLE_PALM, wireframe: true });
    const palm = new THREE.Mesh(palmGeometry, palmMaterial);
    palm.position.z = -PALM_Z;
    grip.add(body, tip, palm);

    const hand = {
      index, grip, gamepad: null, held: null, offset: null,
      pinchOn: false, squeezeOn: false, resetWasPressed: false, tipMaterial, palmMaterial,
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

// Visual feedback: the tip turns red while pinching, the palm sphere green while gripping.
export function showGrip(hand, pinch, squeeze) {
  hand.tipMaterial.color.copy(IDLE_TIP).lerp(ACTIVE_TIP, pinch);
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
