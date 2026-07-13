import { armDimensions, jointLimits } from './robotData';
import type { EndEffectorPose, JointKey, JointState } from './types';

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const toDeg = (radians: number) => (radians * 180) / Math.PI;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampJoint(key: JointKey, value: number) {
  const limit = jointLimits[key];
  return clamp(value, limit.min, limit.max);
}

export function clampPose(pose: JointState): JointState {
  return {
    base: clampJoint('base', pose.base),
    shoulder: clampJoint('shoulder', pose.shoulder),
    elbow: clampJoint('elbow', pose.elbow),
    wristPitch: clampJoint('wristPitch', pose.wristPitch),
    wristRoll: clampJoint('wristRoll', pose.wristRoll),
    gripper: clampJoint('gripper', pose.gripper)
  };
}

export function interpolatePose(from: JointState, to: JointState, t: number): JointState {
  const eased = 0.5 - Math.cos(clamp(t, 0, 1) * Math.PI) / 2;
  return {
    base: from.base + (to.base - from.base) * eased,
    shoulder: from.shoulder + (to.shoulder - from.shoulder) * eased,
    elbow: from.elbow + (to.elbow - from.elbow) * eased,
    wristPitch: from.wristPitch + (to.wristPitch - from.wristPitch) * eased,
    wristRoll: from.wristRoll + (to.wristRoll - from.wristRoll) * eased,
    gripper: from.gripper + (to.gripper - from.gripper) * eased
  };
}

export function getEndEffectorPose(joints: JointState): EndEffectorPose {
  const shoulder = toRad(joints.shoulder);
  const elbow = shoulder + toRad(joints.elbow);
  const wrist = elbow + toRad(joints.wristPitch);
  const base = toRad(joints.base);
  const planarReach =
    armDimensions.upperArmLength * Math.cos(shoulder) +
    armDimensions.forearmLength * Math.cos(elbow) +
    (armDimensions.wristLength + armDimensions.toolCenterOffset) * Math.cos(wrist);
  const y =
    armDimensions.shoulderHeight +
    armDimensions.upperArmLength * Math.sin(shoulder) +
    armDimensions.forearmLength * Math.sin(elbow) +
    (armDimensions.wristLength + armDimensions.toolCenterOffset) * Math.sin(wrist);

  return {
    x: planarReach * Math.cos(base),
    y,
    z: -planarReach * Math.sin(base),
    reach: Math.hypot(planarReach, y - armDimensions.shoulderHeight)
  };
}

export function solvePlanarTarget(
  target: { x: number; y: number; z: number },
  current: JointState
): JointState {
  const base = toDeg(Math.atan2(-target.z, target.x));
  const requestedRadius = Math.hypot(target.x, target.z);
  const toolOffset = armDimensions.wristLength + armDimensions.toolCenterOffset;
  const radius = clamp(requestedRadius - toolOffset, 0.08, armDimensions.upperArmLength + armDimensions.forearmLength - 0.02);
  const height = clamp(
    target.y - armDimensions.shoulderHeight,
    -armDimensions.upperArmLength - armDimensions.forearmLength + 0.02,
    armDimensions.upperArmLength + armDimensions.forearmLength - 0.02
  );

  const l1 = armDimensions.upperArmLength;
  const l2 = armDimensions.forearmLength;
  const distance = clamp(Math.hypot(radius, height), 0.12, l1 + l2 - 0.02);
  const normalizedRadius = radius * (distance / Math.max(Math.hypot(radius, height), 0.001));
  const normalizedHeight = height * (distance / Math.max(Math.hypot(radius, height), 0.001));
  const cosElbow = clamp((distance * distance - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
  const elbow = -Math.acos(cosElbow);
  const shoulder =
    Math.atan2(normalizedHeight, normalizedRadius) -
    Math.atan2(l2 * Math.sin(elbow), l1 + l2 * Math.cos(elbow));

  return clampPose({
    ...current,
    base,
    shoulder: toDeg(shoulder),
    elbow: toDeg(elbow),
    wristPitch: clampJoint('wristPitch', -(toDeg(shoulder) + toDeg(elbow)) * 0.75),
    gripper: current.gripper
  });
}

export function formatMeters(value: number) {
  return `${value.toFixed(3)} m`;
}
