export type JointKey = 'j1' | 'j2' | 'j3' | 'j4' | 'j5' | 'j6';

export type MechanicalPartId =
  | 'baseLink'
  | 'link1'
  | 'link2'
  | 'link3'
  | 'link4'
  | 'link5'
  | 'link6';

export type ElectronicPartId =
  | 'controller'
  | 'driver'
  | 'motor20'
  | 'motor40'
  | 'motor60'
  | 'gearbox20'
  | 'gearbox10'
  | 'powerSupply'
  | 'coolingFan'
  | 'limitSwitch'
  | 'inductiveSensor'
  | 'emergencyStop';

export type PartId = MechanicalPartId | ElectronicPartId;
export type PartCategory = 'mechanical' | 'electronics';
export type PartModelType = 'stl' | 'glb' | 'generated';
export type TabId = 'simulation' | 'parts';
export type ViewMode = 'solid' | 'xray';
export type CameraPreset = 'isometric' | 'front' | 'side' | 'top' | 'tool';
export type AssemblyPhase = 'assembled' | 'disassembling' | 'disassembled' | 'reassembling';

export type ExplodedPieceCategory =
  | 'printed structure'
  | 'drive component'
  | 'bearing and hardware'
  | 'electronics'
  | 'sensor'
  | 'pneumatics'
  | 'controls';

export interface ExplodedPieceInfo {
  id: string;
  name: string;
  section: string;
  category: ExplodedPieceCategory;
  material: string;
  description: string;
  source: string;
}

export interface JointState {
  j1: number;
  j2: number;
  j3: number;
  j4: number;
  j5: number;
  j6: number;
}

export interface JointLimit {
  min: number;
  max: number;
  label: string;
  shortLabel: string;
  group: 'base' | 'arm' | 'wrist';
}

export interface ToolPose {
  x: number;
  y: number;
  z: number;
  reach: number;
}

export interface RobotCollisionReport {
  collisions: string[];
  minimumFloorClearanceMm: number;
}

export interface CameraRequest {
  id: number;
  preset: CameraPreset;
}

export interface PartSpecification {
  label: string;
  value: string;
}

export interface PartSpec {
  id: PartId;
  category: PartCategory;
  modelType: PartModelType;
  name: string;
  assemblyRole: string;
  sourceFile: string;
  sourceUrl: string;
  meshFile?: string;
  dimensionsMm: [number, number, number];
  quantity: number;
  massKg?: number;
  priceCad?: string;
  joint?: JointKey;
  summary: string;
  buildNote: string;
  specifications?: PartSpecification[];
}
