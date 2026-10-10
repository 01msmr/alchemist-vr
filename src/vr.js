import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { createPincer, createFistWrap, createPinchGrip, TIP_Z, PALM_Z } from './hand.js';
import { handFrame, pinchPoint, pinchStrength, gripStrength, graspPoint, chooseMode } from './tracking.js';

export { TIP_Z, PALM_Z };

// The joints the recognition needs (WebXR names).
const JOINTS = [
  'wrist', 'index-finger-metacarpal', 'pinky-finger-metacarpal', 'middle-finger-phalanx-proximal',
  'thumb-tip', 'index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip',
];

// Sets up the VR session button (asking for hand tracking) and two hands. A hand is
// { index, handedness, mode: 'tracked' | 'controller' | 'none', pinch, squeeze, tipPoint, graspPoint, tipInGrip, grip, ... }.
// Hand tracking is the main input; a controller is the fallback. updateInput() fills the same fields from
// either, so the game does not care which one is in use. `grip` is an object whose matrixWorld is the grip frame
// (origin at the palm or the controller grip, -Z forward, +Y toward the thumb side).
// `model` is the controller's fingertip pincer; `fist` and `pinchGrip` are hands drawn on a tool held with a
// controller (their groups are added to the game world by the caller); tracked hands draw themselves.
export function setupVR(renderer, scene) {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ['hand-tracking'] }));
  const handModels = new XRHandModelFactory();

  return [0, 1].map((index) => {
    const controller = renderer.xr.getController(index);
    const grip = renderer.xr.getControllerGrip(index);
    scene.add(controller, grip);
    const trackedHand = renderer.xr.getHand(index);
    trackedHand.add(handModels.createHandModel(trackedHand, 'boxes')); // blocky joints, no downloads
    scene.add(trackedHand);

    const model = createPincer();
    grip.add(model.group);

    const hand = {
      index, handedness: index === 0 ? 'left' : 'right', grip, trackedHand, gamepad: null,
      mode: 'none', pinch: 0, squeeze: 0,
      tipPoint: new THREE.Vector3(), // where the fingertips pinch, in the scene
      graspPoint: new THREE.Vector3(), // where a fist closes, in the scene
      tipInGrip: new THREE.Vector3(0, 0, -TIP_Z), // tipPoint in the grip frame
      held: null, holdMode: null,
      // pose of the held tool relative to the hand: blends from where it was grabbed to the natural hold
      grab: { fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion(), toPos: new THREE.Vector3(), toQuat: new THREE.Quaternion(), t0: 0, axial: 0 },
      pinchOn: false, squeezeOn: false, resetWasPressed: false,
      model, fist: createFistWrap(), pinchGrip: createPinchGrip(),
    };
    controller.addEventListener('connected', (e) => {
      hand.gamepad = e.data.gamepad;
      if (e.data.handedness === 'left' || e.data.handedness === 'right') hand.handedness = e.data.handedness;
    });
    controller.addEventListener('disconnected', () => { hand.gamepad = null; });
    trackedHand.addEventListener('connected', (e) => {
      if (e.data.handedness === 'left' || e.data.handedness === 'right') hand.handedness = e.data.handedness;
    });
    return hand;
  });
}

// The needed joints of a tracked hand, or null while it has no valid pose.
function readJoints(trackedHand) {
  if (!trackedHand.visible) return null;
  const joints = {};
  for (const name of JOINTS) {
    const joint = trackedHand.joints[name];
    if (!joint || !joint.visible) return null;
    joints[name] = joint.position; // the hand object sits at the origin of the reference space
  }
  return joints;
}

const inverse = new THREE.Matrix4();
const rest = new THREE.Vector3();

// Once per frame, before anything reads the hand: choose tracked hand or controller and fill in the hand.
export function updateInput(hand) {
  const joints = readJoints(hand.trackedHand);
  hand.mode = chooseMode({ trackedVisible: !!joints, gamepad: !!hand.gamepad, controllerVisible: hand.grip.visible });

  if (hand.mode === 'tracked') {
    const frame = handFrame(joints);
    hand.grip.matrix.copy(frame);
    hand.grip.matrixWorld.copy(frame);
    hand.pinch = pinchStrength(joints);
    hand.squeeze = gripStrength(joints);
    hand.tipPoint.copy(pinchPoint(joints));
    hand.graspPoint.copy(graspPoint(joints, hand.handedness));
    hand.tipInGrip.copy(hand.tipPoint).applyMatrix4(inverse.copy(frame).invert());
  } else if (hand.mode === 'controller') {
    const buttons = hand.gamepad.buttons;
    hand.pinch = buttons[0]?.value ?? 0; // index finger on the trigger
    hand.squeeze = buttons[1]?.value ?? 0; // the other fingers on the grip button
    hand.tipInGrip.set(0, 0, -TIP_Z);
    hand.tipPoint.copy(hand.tipInGrip).applyMatrix4(hand.grip.matrixWorld);
    hand.graspPoint.copy(rest.set(0, 0, -PALM_Z)).applyMatrix4(hand.grip.matrixWorld);
  } else {
    hand.pinch = 0;
    hand.squeeze = 0;
  }
}

// World-space point where the index finger and thumb pinch.
export function tipWorld(hand, out) {
  return out.copy(hand.tipPoint);
}

// World-space center of the closed hand.
export function palmWorld(hand, out) {
  return out.copy(hand.graspPoint);
}

// Analog finger values 0..1: pinch = index finger and thumb, squeeze = the other fingers.
export function analog(hand) {
  return { pinch: hand.pinch, squeeze: hand.squeeze };
}

// Visual feedback for a controller: the fingertips close with the trigger.
export function showGrip(hand, pinch) {
  hand.model.update(pinch);
}

// Haptics exist on controllers only.
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
