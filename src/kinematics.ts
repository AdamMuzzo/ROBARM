import { jointLimits } from './robotData';
import type { JointKey, JointState } from './types';

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampJoint(key: JointKey, value: number) {
  const limit = jointLimits[key];
  return clamp(value, limit.min, limit.max);
}

export function clampPose(pose: JointState): JointState {
  return {
    j1: clampJoint('j1', pose.j1),
    j2: clampJoint('j2', pose.j2),
    j3: clampJoint('j3', pose.j3),
    j4: clampJoint('j4', pose.j4),
    j5: clampJoint('j5', pose.j5),
    j6: clampJoint('j6', pose.j6)
  };
}

export function interpolatePose(from: JointState, to: JointState, t: number): JointState {
  const eased = 0.5 - Math.cos(clamp(t, 0, 1) * Math.PI) / 2;
  return {
    j1: from.j1 + (to.j1 - from.j1) * eased,
    j2: from.j2 + (to.j2 - from.j2) * eased,
    j3: from.j3 + (to.j3 - from.j3) * eased,
    j4: from.j4 + (to.j4 - from.j4) * eased,
    j5: from.j5 + (to.j5 - from.j5) * eased,
    j6: from.j6 + (to.j6 - from.j6) * eased
  };
}

export function formatMillimeters(valueInMeters: number) {
  return `${Math.round(valueInMeters * 1000)} mm`;
}
