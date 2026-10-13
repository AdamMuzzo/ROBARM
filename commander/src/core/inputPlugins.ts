import { z } from 'zod';

export interface NormalizedMotionInput {
  source: 'controller' | 'hand';
  joint: number;
  value: number;
  deadman: boolean;
  timestamp: number;
}

export interface InputPlugin {
  readonly id: string;
  readonly name: string;
  start(onMotion: (input: NormalizedMotionInput) => void, onLost: (reason: string) => void): Promise<void>;
  stop(): Promise<void>;
}

export const STANDARD_GAMEPAD_BUTTONS = [
  'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu',
  'Left stick click', 'Right stick click', 'D-pad up', 'D-pad down',
  'D-pad left', 'D-pad right', 'Xbox / Guide'
] as const;

export const STANDARD_GAMEPAD_AXES = [
  'Left stick X', 'Left stick Y', 'Right stick X', 'Right stick Y'
] as const;

export function gamepadButtonLabel(index: number) {
  return `${STANDARD_GAMEPAD_BUTTONS[index] ?? 'Button'} · B${index}`;
}

export function gamepadAxisLabel(index: number) {
  return `${STANDARD_GAMEPAD_AXES[index] ?? 'Axis'} · A${index}`;
}

export const controllerMappingSchema = z.object({
  axis: z.number().int().min(0).max(31),
  joint: z.number().int().min(0).max(5),
  deadZone: z.number().min(0).max(0.95),
  sensitivity: z.number().min(0.1).max(4),
  invert: z.boolean(),
  speedScale: z.number().positive().max(1)
});

export const controllerButtonMappingSchema = z.object({
  button: z.number().int().min(0).max(31),
  joint: z.number().int().min(0).max(5),
  direction: z.enum(['negative', 'positive']),
  activationThreshold: z.number().min(0).max(1),
  speedScale: z.number().positive().max(1)
});

export const controllerProfileSchema = z.object({
  schemaVersion: z.literal(2),
  name: z.string().min(1).max(100),
  deadmanButton: z.number().int().min(0).max(31),
  disableButton: z.number().int().min(0).max(31),
  stopChord: z.array(z.number().int().min(0).max(31)).min(2).max(8),
  accelerationScale: z.number().min(0.1).max(1),
  mappings: z.array(controllerMappingSchema).max(64),
  buttonMappings: z.array(controllerButtonMappingSchema).max(64)
});

const legacyControllerProfileSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1).max(100),
  deadmanButton: z.number().int().min(0).max(31),
  disableButton: z.number().int().min(0).max(31),
  stopChord: z.array(z.number().int().min(0).max(31)).min(2).max(4),
  accelerationScale: z.number().min(0.1).max(1),
  mappings: z.array(controllerMappingSchema).min(1).max(16)
});

export type ControllerProfile = z.infer<typeof controllerProfileSchema>;
export type ControllerButtonState = Pick<GamepadButton, 'pressed' | 'value'>;

function controllerCurve(value: number, sensitivity: number) {
  return Math.sign(value) * Math.pow(Math.abs(value), sensitivity);
}

function preferStrongest(jointScales: number[], joint: number, scale: number) {
  if (Math.abs(scale) > Math.abs(jointScales[joint])) jointScales[joint] = scale;
}

export function mapControllerInput(
  axes: readonly number[],
  buttons: readonly ControllerButtonState[],
  profile: ControllerProfile
) {
  const jointScales = [0, 0, 0, 0, 0, 0];
  for (const mapping of profile.mappings) {
    const raw = (axes[mapping.axis] ?? 0) * (mapping.invert ? -1 : 1);
    if (Math.abs(raw) <= mapping.deadZone) continue;
    const normalized = (Math.abs(raw) - mapping.deadZone) / (1 - mapping.deadZone);
    const curved = controllerCurve(normalized, mapping.sensitivity) * Math.sign(raw);
    const scaled = Math.sign(curved) * Math.max(0.05, Math.min(1, Math.abs(curved) * mapping.speedScale));
    preferStrongest(jointScales, mapping.joint, scaled);
  }
  for (const mapping of profile.buttonMappings) {
    const button = buttons[mapping.button];
    const value = button?.value ?? (button?.pressed ? 1 : 0);
    if (!button || value <= mapping.activationThreshold) continue;
    const normalized = mapping.activationThreshold >= 1
      ? 1
      : (value - mapping.activationThreshold) / (1 - mapping.activationThreshold);
    const direction = mapping.direction === 'positive' ? 1 : -1;
    preferStrongest(jointScales, mapping.joint, direction * Math.max(0.05, normalized * mapping.speedScale));
  }
  return jointScales;
}

export function mapControllerAxes(axes: readonly number[], profile: ControllerProfile) {
  return mapControllerInput(axes, [], profile);
}

export const DEFAULT_CONTROLLER_PROFILE: ControllerProfile = {
  schemaVersion: 2,
  name: 'Xbox fully assignable',
  deadmanButton: 4,
  disableButton: 1,
  stopChord: [4, 5, 1],
  accelerationScale: 0.35,
  mappings: [
    { axis: 0, joint: 0, deadZone: 0.18, sensitivity: 1.4, invert: false, speedScale: 0.25 },
    { axis: 1, joint: 1, deadZone: 0.18, sensitivity: 1.4, invert: true, speedScale: 0.2 },
    { axis: 2, joint: 3, deadZone: 0.2, sensitivity: 1.2, invert: false, speedScale: 0.2 },
    { axis: 3, joint: 2, deadZone: 0.18, sensitivity: 1.4, invert: true, speedScale: 0.2 }
  ],
  buttonMappings: []
};

export function loadControllerProfile(value: unknown): ControllerProfile {
  const current = controllerProfileSchema.safeParse(value);
  if (current.success) return current.data;
  const legacy = legacyControllerProfileSchema.safeParse(value);
  if (legacy.success) return { ...legacy.data, schemaVersion: 2, buttonMappings: [] };
  return DEFAULT_CONTROLLER_PROFILE;
}

export interface HandControlConfiguration {
  provider: 'disabled' | 'mediapipe' | 'openxr';
  deadmanGesture: 'pinch-hold' | 'open-palm' | 'physical-enable';
  positionMapping: 'cartesian' | 'joint';
  pinchAction: 'none' | 'gripper';
  wristRotationAction: 'none' | 'tool-roll';
  deadZone: number;
  motionScale: number;
  smoothing: number;
  timeoutMs: number;
}
