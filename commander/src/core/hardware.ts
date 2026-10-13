export type JointId = 'j1' | 'j2' | 'j3' | 'j4' | 'j5' | 'j6';

export interface JointHardware {
  id: JointId;
  number: number;
  name: string;
  motorPort: number;
  stopPort: number;
  stopPin: string;
  stopActiveLow: boolean;
  directionLabelNegative: string;
  directionLabelPositive: string;
  homingDirection: string | null;
  homingAvailable: boolean;
  homingValidated: boolean;
  gearReduction: number;
  currentMa: number;
  minSteps: number;
  maxSteps: number;
  maxSpeedStepsPerSecond: number;
  accelerationStepsPerSecondSquared: number;
}

export const MICROSTEPS = 32;
export const FULL_STEPS_PER_REVOLUTION = 200;

export const JOINTS: readonly JointHardware[] = [
  {
    id: 'j1', number: 1, name: 'Base rotation', motorPort: 0, stopPort: 0,
    stopPin: 'PG6', stopActiveLow: true, directionLabelNegative: 'Counterclockwise',
    directionLabelPositive: 'Clockwise', homingDirection: 'Clockwise',
    homingAvailable: true, homingValidated: true, gearReduction: 6.4,
    currentMa: 2100, minSteps: -14000, maxSteps: 14000,
    maxSpeedStepsPerSecond: 19200, accelerationStepsPerSecondSquared: 8000
  },
  {
    id: 'j2', number: 2, name: 'Shoulder', motorPort: 1, stopPort: 2,
    stopPin: 'PG10', stopActiveLow: false, directionLabelNegative: 'Down',
    directionLabelPositive: 'Up', homingDirection: 'Up', homingAvailable: true,
    homingValidated: true, gearReduction: 20, currentMa: 2100,
    minSteps: 1200, maxSteps: 51558, maxSpeedStepsPerSecond: 32000,
    accelerationStepsPerSecondSquared: 12000
  },
  {
    id: 'j3', number: 3, name: 'Elbow', motorPort: 2, stopPort: 1,
    stopPin: 'PG9', stopActiveLow: false, directionLabelNegative: 'Down',
    directionLabelPositive: 'Up', homingDirection: 'Down', homingAvailable: true,
    homingValidated: true, gearReduction: 18.0952381, currentMa: 2000,
    minSteps: -17300, maxSteps: 17300, maxSpeedStepsPerSecond: 32000,
    accelerationStepsPerSecondSquared: 12000
  },
  {
    id: 'j4', number: 4, name: 'Forearm roll', motorPort: 5, stopPort: 3,
    stopPin: 'PG11', stopActiveLow: true, directionLabelNegative: 'Counterclockwise',
    directionLabelPositive: 'Clockwise', homingDirection: 'Clockwise',
    homingAvailable: true, homingValidated: true, gearReduction: 4,
    currentMa: 2000, minSteps: -7500, maxSteps: 7500,
    maxSpeedStepsPerSecond: 32000, accelerationStepsPerSecondSquared: 18000
  },
  {
    id: 'j5', number: 5, name: 'Wrist pitch', motorPort: 4, stopPort: 4,
    stopPin: 'PG12', stopActiveLow: false, directionLabelNegative: 'Up',
    directionLabelPositive: 'Down', homingDirection: null, homingAvailable: false,
    homingValidated: false, gearReduction: 4, currentMa: 2000,
    minSteps: -6400, maxSteps: 6400, maxSpeedStepsPerSecond: 32000,
    accelerationStepsPerSecondSquared: 18000
  },
  {
    id: 'j6', number: 6, name: 'Tool roll', motorPort: 3, stopPort: 5,
    stopPin: 'PG13', stopActiveLow: true, directionLabelNegative: 'Counterclockwise',
    directionLabelPositive: 'Clockwise', homingDirection: null,
    homingAvailable: false, homingValidated: false, gearReduction: 10,
    currentMa: 965, minSteps: -64000, maxSteps: 0,
    maxSpeedStepsPerSecond: 32000, accelerationStepsPerSecondSquared: 18000
  }
] as const;

export function stepsToDegrees(steps: number, joint: JointHardware) {
  return steps * 360 / (FULL_STEPS_PER_REVOLUTION * MICROSTEPS * joint.gearReduction);
}

export function degreesToSteps(degrees: number, joint: JointHardware) {
  return Math.round(degrees * FULL_STEPS_PER_REVOLUTION * MICROSTEPS * joint.gearReduction / 360);
}

export const INITIAL_SIMULATION_STEPS = JOINTS.map((joint) =>
  Math.round((joint.minSteps + joint.maxSteps) / 2)
);

export const STARTUP_CALIBRATION_JOINTS = [1, 2, 3] as const;
export const STARTUP_CALIBRATION_REQUIRED_MASK = 0x70;
export const STARTUP_CALIBRATION_HOME_STEPS = [0, 32_000, 0, 0, 0, 0] as const;
