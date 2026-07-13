export type JointKey =
  | 'base'
  | 'shoulder'
  | 'elbow'
  | 'wristPitch'
  | 'wristRoll'
  | 'gripper';

export type PartId =
  | 'base'
  | 'turntable'
  | 'shoulder'
  | 'upperArm'
  | 'elbow'
  | 'forearm'
  | 'wrist'
  | 'gripper'
  | 'controllerStack'
  | 'motorDriver'
  | 'powerSupply'
  | 'wiringHarness'
  | 'limitSwitch'
  | 'encoder';

export type TabId = 'simulation' | 'parts';

export interface JointState {
  base: number;
  shoulder: number;
  elbow: number;
  wristPitch: number;
  wristRoll: number;
  gripper: number;
}

export interface JointLimit {
  min: number;
  max: number;
  label: string;
  unit: string;
}

export interface ArmDimensions {
  baseRadius: number;
  baseHeight: number;
  shoulderHeight: number;
  upperArmLength: number;
  forearmLength: number;
  wristLength: number;
  gripperLength: number;
  toolCenterOffset: number;
  maxPayloadKg: number;
}

export interface EndEffectorPose {
  x: number;
  y: number;
  z: number;
  reach: number;
}

export interface PartSpec {
  id: PartId;
  category: 'mechanical' | 'electronics';
  name: string;
  summary: string;
  material: string;
  dimensions: string;
  motion: string;
  serviceNote: string;
  diagram?: string[];
}
