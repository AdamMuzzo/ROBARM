import type { ArmDimensions, JointKey, JointLimit, JointState, PartSpec } from './types';

export const armDimensions: ArmDimensions = {
  baseRadius: 0.18,
  baseHeight: 0.14,
  shoulderHeight: 0.34,
  upperArmLength: 0.56,
  forearmLength: 0.46,
  wristLength: 0.18,
  gripperLength: 0.16,
  toolCenterOffset: 0.38,
  maxPayloadKg: 2.5
};

export const homePose: JointState = {
  base: 0,
  shoulder: 34,
  elbow: -42,
  wristPitch: 10,
  wristRoll: 0,
  gripper: 35
};

export const jointLimits: Record<JointKey, JointLimit> = {
  base: { min: -180, max: 180, label: 'Base yaw', unit: 'deg' },
  shoulder: { min: -40, max: 105, label: 'Shoulder pitch', unit: 'deg' },
  elbow: { min: -130, max: 115, label: 'Elbow pitch', unit: 'deg' },
  wristPitch: { min: -115, max: 115, label: 'Wrist pitch', unit: 'deg' },
  wristRoll: { min: -180, max: 180, label: 'Wrist roll', unit: 'deg' },
  gripper: { min: 0, max: 100, label: 'Gripper open', unit: '%' }
};

export const scriptedPoses: Array<{ name: string; joints: JointState }> = [
  {
    name: 'Home',
    joints: homePose
  },
  {
    name: 'Pick low',
    joints: { base: -35, shoulder: 8, elbow: -78, wristPitch: 54, wristRoll: 0, gripper: 88 }
  },
  {
    name: 'Lift',
    joints: { base: -20, shoulder: 62, elbow: -38, wristPitch: -20, wristRoll: 24, gripper: 22 }
  },
  {
    name: 'Inspect',
    joints: { base: 62, shoulder: 45, elbow: -12, wristPitch: -44, wristRoll: 110, gripper: 42 }
  },
  {
    name: 'Place',
    joints: { base: 118, shoulder: 18, elbow: -70, wristPitch: 48, wristRoll: -70, gripper: 92 }
  }
];

export const partCatalog: PartSpec[] = [
  {
    id: 'base',
    category: 'mechanical',
    name: 'Anchored base plate',
    summary: 'Layered circular foundation with leveling feet, anchor bolts, access cover, and cable pass-throughs.',
    material: 'Machined aluminum tooling plate, dark anodized lower ring, steel fasteners',
    dimensions: '360 mm diameter footprint, 24 mm plate, 140 mm base stack, 4 leveling feet',
    motion: 'Static. All simulated coordinates are measured from this origin.',
    serviceNote: 'Level this assembly first; every joint zero and reach measurement depends on the base plane.'
  },
  {
    id: 'turntable',
    category: 'mechanical',
    name: 'J1 yaw turntable',
    summary: 'Bearing-ring yaw stage with visible gear teeth, harmonic reducer cover, wire gland, and bolt pattern.',
    material: 'Machined aluminum table, hardened bearing ring, polymer cable guard',
    dimensions: '220 mm rotating table, 180 deg/s simulated no-load limit, 72-tooth visual ring',
    motion: '-180 deg to +180 deg yaw around the vertical Y axis.',
    serviceNote: 'Cable slack is represented in the model; real wiring needs a controlled loop or slip ring.'
  },
  {
    id: 'shoulder',
    category: 'mechanical',
    name: 'J2 shoulder bracket',
    summary: 'Contoured double-shear shoulder yoke with bearing caps, through shaft, motor housing, and lightening pockets.',
    material: '6 mm aluminum side plates, steel shoulder shaft, black anodized motor cover',
    dimensions: '340 mm pivot height, 126 mm bracket width, 96 mm bearing cap',
    motion: '-40 deg to +105 deg pitch in the vertical plane.',
    serviceNote: 'This joint sees the highest torque when the arm is fully extended.'
  },
  {
    id: 'upperArm',
    category: 'mechanical',
    name: 'Upper arm link',
    summary: 'Twin waterjet-style link plates with round pivot bosses, spacers, cable clips, and a segmented wire chain.',
    material: 'Brushed aluminum link plates, black polymer cable chain, stainless spacer tubes',
    dimensions: '560 mm pivot-to-pivot length',
    motion: 'Follows J2 shoulder pitch and carries the elbow pivot at its distal end.',
    serviceNote: 'Use matched spacers so both rails share load instead of twisting the elbow joint.'
  },
  {
    id: 'elbow',
    category: 'mechanical',
    name: 'J3 elbow hub',
    summary: 'Compact elbow joint with a black servo can, amber harmonic-drive cover, bearing cap, and bolt circle.',
    material: 'Aluminum hub, steel shaft, composite motor cover, brass-toned reducer cap',
    dimensions: '120 mm hub diameter with 90 mm bearing cap',
    motion: '-130 deg to +115 deg relative pitch.',
    serviceNote: 'Route wires through the neutral side of the bend to avoid repeated compression.'
  },
  {
    id: 'forearm',
    category: 'mechanical',
    name: 'Forearm link',
    summary: 'Tapered secondary link with pocketed side plates, slim cross tubes, belt cover, and protected wire run.',
    material: 'Aluminum box spar, pocketed side plates, teal anodized service cover',
    dimensions: '460 mm pivot-to-pivot length',
    motion: 'Rotates from the elbow and carries the wrist assembly.',
    serviceNote: 'The forearm is where exact mass matters most for realistic acceleration tuning.'
  },
  {
    id: 'wrist',
    category: 'mechanical',
    name: 'J4/J5 wrist assembly',
    summary: 'Small pitch yoke and coaxial roll module with bearing rings, wire relief, and tool flange.',
    material: 'Machined aluminum yoke, compact radial bearings, black roll motor, printed wire guard',
    dimensions: '180 mm wrist stack before gripper mount',
    motion: 'Pitch -115 deg to +115 deg, roll -180 deg to +180 deg.',
    serviceNote: 'Keep end-effector wiring concentric around the roll axis where possible.'
  },
  {
    id: 'gripper',
    category: 'mechanical',
    name: 'Parallel gripper',
    summary: 'Linear-rail gripper with screw drive, sliding jaw carriages, replaceable pads, and visible guide rods.',
    material: 'Aluminum jaw carriage, hardened guide rods, black rubber pads',
    dimensions: '160 mm jaw length, 12 mm to 86 mm simulated opening',
    motion: '0% closed to 100% open, driven symmetrically about tool centerline.',
    serviceNote: 'Jaw pads are intentionally separate so different contact materials can be swapped later.'
  },
  {
    id: 'controllerStack',
    category: 'electronics',
    name: 'Main controller stack',
    summary: 'Stacked control bay with microcontroller board, breakout terminals, fan, USB, emergency-stop loop, and status LEDs.',
    material: 'FR-4 PCB, aluminum standoffs, ABS enclosure frame, copper terminal blocks',
    dimensions: '145 mm x 105 mm controller tray, 38 mm stack height',
    motion: 'Static electronics assembly mounted inside or beside the base enclosure.',
    serviceNote: 'Keep logic ground star-connected and separate high-current motor return paths until the power entry point.',
    diagram: ['24 V in -> fused distribution', 'USB/CAN -> motion controller', 'GPIO -> limit switches + E-stop', 'Step/Dir or CAN -> motor drivers']
  },
  {
    id: 'motorDriver',
    category: 'electronics',
    name: 'Smart motor driver board',
    summary: 'Single-axis driver with MOSFET bank, heatsink, bulk capacitors, encoder input, and motor phase terminals.',
    material: 'FR-4 PCB, aluminum heatsink, copper bus bars, polymer terminal housings',
    dimensions: '92 mm x 64 mm board, 28 mm heatsink height',
    motion: 'Static. One board controls one motor axis in the electronics model.',
    serviceNote: 'Mount drivers to an aluminum thermal path and leave clearance above the heatsink fins.',
    diagram: ['VMOT/GND -> power supply', 'U/V/W or A/B -> motor phases', 'ENC A/B/Z -> encoder board', 'CTRL -> controller stack']
  },
  {
    id: 'powerSupply',
    category: 'electronics',
    name: '24 V power supply',
    summary: 'Perforated metal supply block with screw terminals, fan vents, mains guard, and DC output bus.',
    material: 'Perforated steel cover, copper terminals, molded terminal barrier',
    dimensions: '160 mm x 98 mm x 42 mm supply body',
    motion: 'Static power component.',
    serviceNote: 'Keep mains wiring guarded and route 24 V output through a fuse before the distribution bus.',
    diagram: ['AC L/N/PE -> guarded input', '24 V out -> fuse block', '0 V out -> star ground', 'Chassis -> protective earth']
  },
  {
    id: 'wiringHarness',
    category: 'electronics',
    name: 'Robot wiring harness',
    summary: 'Bundled joint wiring with drag-chain links, strain reliefs, motor leads, encoder pairs, and sensor branch-outs.',
    material: 'Silicone wire bundle, braided sleeve, nylon drag chain, keyed connectors',
    dimensions: 'Modeled as routed bundles from base to wrist with 9 mm main sleeve diameter',
    motion: 'Flexes with the joints in the main simulation through cable-loop geometry.',
    serviceNote: 'Add strain relief at every moving transition; never let solder joints carry cable motion.',
    diagram: ['Base bay -> J1 service loop', 'J1 -> shoulder drag chain', 'Elbow branch -> J3 motor + encoder', 'Wrist branch -> gripper + tool I/O']
  },
  {
    id: 'limitSwitch',
    category: 'electronics',
    name: 'Limit switch and homing sensor',
    summary: 'Microswitch assembly with roller lever, bracket, two-pin signal connector, and adjustable stop screw.',
    material: 'Black polymer switch body, spring steel lever, aluminum bracket',
    dimensions: '28 mm x 16 mm x 10 mm switch body, 42 mm lever',
    motion: 'Triggered by an axis cam during homing or over-travel protection.',
    serviceNote: 'Use normally-closed wiring for fail-safe homing and fault detection.',
    diagram: ['NC -> controller input', 'COM -> signal ground', 'Shield -> chassis at controller end', 'Axis cam -> roller lever']
  },
  {
    id: 'encoder',
    category: 'electronics',
    name: 'Magnetic encoder module',
    summary: 'Small sensor PCB and magnet disk used for joint angle feedback.',
    material: 'FR-4 PCB, diametric magnet, brass inserts, JST connector',
    dimensions: '32 mm round magnet carrier, 24 mm x 18 mm sensor PCB',
    motion: 'Magnet rotates with the joint shaft; sensor PCB remains fixed.',
    serviceNote: 'Keep axial magnet spacing consistent before tuning closed-loop position control.',
    diagram: ['VCC/GND -> controller 5 V rail', 'A/B/Z or SPI -> controller', 'Magnet -> joint shaft', 'PCB -> fixed bracket']
  }
];

export const jointOrder: JointKey[] = [
  'base',
  'shoulder',
  'elbow',
  'wristPitch',
  'wristRoll',
  'gripper'
];
