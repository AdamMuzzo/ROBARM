import type { JointKey, JointLimit, JointState, MechanicalPartId, PartSpec } from './types';

export const jointLimits: Record<JointKey, JointLimit> = {
  j1: { min: -97, max: 97, label: 'Base rotation', shortLabel: 'J1', group: 'base' },
  j2: { min: -56, max: 57, label: 'Shoulder', shortLabel: 'J2', group: 'arm' },
  j3: { min: -115, max: 74, label: 'Elbow', shortLabel: 'J3', group: 'arm' },
  j4: { min: -115, max: 115, label: 'Forearm roll', shortLabel: 'J4', group: 'wrist' },
  j5: { min: -120, max: 120, label: 'Wrist pitch', shortLabel: 'J5', group: 'wrist' },
  j6: { min: -178, max: 178, label: 'Tool roll', shortLabel: 'J6', group: 'wrist' }
};

export const jointOrder: JointKey[] = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'];

export const homePose: JointState = {
  j1: 0,
  j2: 0,
  j3: 0,
  j4: 0,
  j5: 0,
  j6: 0
};

export const scriptedPoses: Array<{ name: string; joints: JointState }> = [
  { name: 'Home', joints: homePose },
  { name: 'Reach', joints: { j1: -32, j2: 28, j3: -58, j4: 18, j5: 34, j6: 0 } },
  { name: 'Inspect', joints: { j1: 42, j2: -22, j3: 52, j4: -48, j5: -36, j6: 72 } },
  { name: 'Service', joints: { j1: 0, j2: -44, j3: 18, j4: 88, j5: 12, j6: -45 } }
];

export const partCatalog: PartSpec[] = [
  {
    id: 'baseLink',
    category: 'mechanical',
    modelType: 'stl',
    name: 'Base assembly',
    assemblyRole: 'Fixed structure',
    sourceFile: 'base_link.STL',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/PAROL6_URDF/PAROL6/meshes/base_link.STL',
    meshFile: 'base_link.stl',
    dimensionsMm: [227, 125, 71],
    quantity: 1,
    massKg: 0.813,
    summary: 'The fixed PAROL6 electronics enclosure and mounting structure beneath the rotating axis stack.',
    buildNote: 'Square and secure the base before establishing any joint zeros.'
  },
  {
    id: 'link1',
    category: 'mechanical',
    modelType: 'stl',
    name: 'J1 rotating base',
    assemblyRole: 'Base yaw assembly',
    sourceFile: 'L1.STL',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/PAROL6_URDF/PAROL6/meshes/L1.STL',
    meshFile: 'L1.stl',
    dimensionsMm: [122, 238, 86],
    quantity: 1,
    massKg: 0.645,
    joint: 'j1',
    summary: 'The complete yaw-stage link, including the real turret profile, motor clearances, bearing housings, and covers.',
    buildNote: 'Leave a controlled service loop for every cable crossing the J1 axis.'
  },
  {
    id: 'link2',
    category: 'mechanical',
    modelType: 'stl',
    name: 'J2 shoulder link',
    assemblyRole: 'Shoulder and upper arm',
    sourceFile: 'L2.STL',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/PAROL6_URDF/PAROL6/meshes/L2.STL',
    meshFile: 'L2.stl',
    dimensionsMm: [77, 240, 193],
    quantity: 1,
    massKg: 0.512,
    joint: 'j2',
    summary: 'The tall shoulder link that gives PAROL6 its narrow industrial silhouette and carries the elbow axis.',
    buildNote: 'This is a high-load printed structure; follow the official orientation and PETG settings.'
  },
  {
    id: 'link3',
    category: 'mechanical',
    modelType: 'stl',
    name: 'J3 elbow hub',
    assemblyRole: 'Elbow transmission',
    sourceFile: 'L3.STL',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/PAROL6_URDF/PAROL6/meshes/L3.STL',
    meshFile: 'L3.stl',
    dimensionsMm: [102, 107, 65],
    quantity: 1,
    massKg: 0.551,
    joint: 'j3',
    summary: 'The compact elbow transmission between the long upper arm and the wrist-side forearm assembly.',
    buildNote: 'Check pulley alignment and limit-switch actuation before closing the elbow covers.'
  },
  {
    id: 'link4',
    category: 'mechanical',
    modelType: 'stl',
    name: 'J4 forearm',
    assemblyRole: 'Forearm roll assembly',
    sourceFile: 'L4.STL',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/PAROL6_URDF/PAROL6/meshes/L4.STL',
    meshFile: 'L4.stl',
    dimensionsMm: [86, 92, 194],
    quantity: 1,
    massKg: 0.393,
    joint: 'j4',
    summary: 'The long enclosed forearm with the production PAROL6 belt-drive and electronics-cover geometry.',
    buildNote: 'Verify the internal belt path and wire clearance through the full roll range.'
  },
  {
    id: 'link5',
    category: 'mechanical',
    modelType: 'stl',
    name: 'J5 wrist pitch',
    assemblyRole: 'Wrist pitch assembly',
    sourceFile: 'L5.STL',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/PAROL6_URDF/PAROL6/meshes/L5.STL',
    meshFile: 'L5.stl',
    dimensionsMm: [57, 98, 54],
    quantity: 1,
    massKg: 0.185,
    joint: 'j5',
    summary: 'The compact pitch stage at the end of the forearm, represented with its actual housings and flange transition.',
    buildNote: 'Keep the wrist cable bend radius generous and check for pinching at both limits.'
  },
  {
    id: 'link6',
    category: 'mechanical',
    modelType: 'stl',
    name: 'J6 tool flange',
    assemblyRole: 'Tool roll and output flange',
    sourceFile: 'L6.STL',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/PAROL6_URDF/PAROL6/meshes/L6.STL',
    meshFile: 'L6.stl',
    dimensionsMm: [82, 58, 40],
    quantity: 1,
    massKg: 0.07,
    joint: 'j6',
    summary: 'The final roll link and mounting face where the ROBARM detachable end-effector adapter will attach.',
    buildNote: 'Preserve concentricity here; tool-center offsets are measured from this output axis.'
  },
  {
    id: 'controller',
    category: 'electronics',
    modelType: 'glb',
    name: 'BTT Octopus Pro',
    assemblyRole: 'Main motion controller',
    sourceFile: 'Octopus_Pro - beta.stp',
    sourceUrl: 'https://github.com/bigtreetech/BIGTREETECH-OCTOPUS-Pro/blob/master/3D/Octopus_Pro%20-%20beta.stp',
    meshFile: 'octopus-pro.glb',
    dimensionsMm: [162, 100, 19],
    quantity: 1,
    priceCad: '$300-$330 kit',
    summary: 'The planned central controller, shown from BIGTREETECH\'s populated STEP assembly with its real connectors, driver sockets, terminals, and board hardware.',
    buildNote: 'The Octopus Pro is an integration experiment, not a drop-in replacement for the official PAROL6 controller.',
    specifications: [
      { label: 'Driver sockets', value: '8' },
      { label: 'Robot axes used', value: '6' },
      { label: 'Interface', value: 'USB + step/dir/SPI' },
      { label: 'Main power', value: '12-24 VDC' }
    ]
  },
  {
    id: 'driver',
    category: 'electronics',
    modelType: 'glb',
    name: 'TMC5160 Pro driver',
    assemblyRole: 'Plug-in stepper driver',
    sourceFile: 'TMC5160_Pro V1.1.step',
    sourceUrl: 'https://github.com/bigtreetech/BIGTREETECH-Stepper-Motor-Driver/blob/master/TMC5160(T)%20Pro%20V1.1/3D/TMC5160_Pro%20V1.1.step',
    meshFile: 'tmc5160-pro.glb',
    dimensionsMm: [20.4, 15.3, 23.2],
    quantity: 6,
    priceCad: 'Included in controller kit',
    summary: 'One high-voltage SPI driver module per robot axis, rendered from BIGTREETECH\'s official populated board CAD.',
    buildNote: 'Confirm each driver voltage-select jumper before power-up; an incorrect motor-power selection can destroy a module.',
    specifications: [
      { label: 'Input', value: '8-56 VDC' },
      { label: 'Current', value: '3.1 A RMS' },
      { label: 'Control', value: 'SPI' },
      { label: 'Microsteps', value: 'Up to 256' }
    ]
  },
  {
    id: 'motor20',
    category: 'electronics',
    modelType: 'generated',
    name: 'NEMA 17 / 20 mm',
    assemblyRole: 'J6 compact stepper motor',
    sourceFile: '17HS08-1004S',
    sourceUrl: 'https://www.omc-stepperonline.com/nema-17-bipolar-1-8deg-16ncm-22-6oz-in-1a-3-7v-42x42x20mm-4-wires-17hs08-1004s',
    dimensionsMm: [42, 42, 44],
    quantity: 1,
    priceCad: '~$11',
    summary: 'The short NEMA 17 motor used where wrist mass and package length matter most.',
    buildNote: 'Check the shaft flat, connector direction, and wrist cover clearance before final assembly.',
    specifications: [
      { label: 'Body', value: '42 x 42 x 20 mm' },
      { label: 'Holding torque', value: '16 Ncm' },
      { label: 'Rated current', value: '1.0 A' },
      { label: 'Step angle', value: '1.8 deg' }
    ]
  },
  {
    id: 'motor40',
    category: 'electronics',
    modelType: 'generated',
    name: 'NEMA 17 / 40 mm',
    assemblyRole: 'Mid-load stepper motor',
    sourceFile: '17HS16-2004S1',
    sourceUrl: 'https://www.omc-stepperonline.com/nema-17-bipolar-45ncm-64oz-in-2a-42x42x40mm-4-wires-w-1m-cable-connector-17hs16-2004s1',
    dimensionsMm: [42, 42, 64],
    quantity: 3,
    priceCad: '~$38 total',
    summary: 'The medium-depth motor used across several PAROL6 belt-driven joints.',
    buildNote: 'Keep the one-metre lead strain-relieved and clear of rotating link edges.',
    specifications: [
      { label: 'Body', value: '42 x 42 x 40 mm' },
      { label: 'Holding torque', value: '45 Ncm' },
      { label: 'Rated current', value: '2.0 A' },
      { label: 'Step angle', value: '1.8 deg' }
    ]
  },
  {
    id: 'motor60',
    category: 'electronics',
    modelType: 'generated',
    name: 'NEMA 17 / 60 mm',
    assemblyRole: 'High-torque stepper motor',
    sourceFile: '17HS24-2104S',
    sourceUrl: 'https://www.omc-stepperonline.com/nema-17-bipolar-1-8deg-65ncm-92oz-in-2-1a-3-36v-42x42x60mm-4-wires-17hs24-2104s',
    dimensionsMm: [42, 42, 84],
    quantity: 2,
    priceCad: '~$37 total',
    summary: 'The long high-torque NEMA 17 motor used on the arm\'s most heavily loaded axes.',
    buildNote: 'Set current conservatively during first motion tests and confirm the motor case cannot contact printed covers.',
    specifications: [
      { label: 'Body', value: '42 x 42 x 60 mm' },
      { label: 'Holding torque', value: '65 Ncm' },
      { label: 'Rated current', value: '2.1 A' },
      { label: 'Step angle', value: '1.8 deg' }
    ]
  },
  {
    id: 'gearbox20',
    category: 'electronics',
    modelType: 'generated',
    name: '20:1 planetary gearbox',
    assemblyRole: 'J1/J2 reduction gearbox',
    sourceFile: 'EG17-G20',
    sourceUrl: 'https://www.omc-stepperonline.com/eg-series-planetary-gearbox-gear-ratio-20-1-backlash-20-arc-min-for-nema-17-stepper-motor-eg17-g20',
    dimensionsMm: [42, 42, 88.5],
    quantity: 2,
    priceCad: '~$100 total',
    summary: 'A NEMA 17 planetary reducer with square mounting flange, cylindrical gear housing, and keyed 8 mm output shaft.',
    buildNote: 'Check backlash and shaft runout before coupling the gearbox to a printed joint assembly.',
    specifications: [
      { label: 'Ratio', value: '20:1' },
      { label: 'Backlash', value: '<=20 arc-min' },
      { label: 'Body length', value: '67 mm' },
      { label: 'Output shaft', value: '8 x 21.5 mm' }
    ]
  },
  {
    id: 'gearbox10',
    category: 'electronics',
    modelType: 'generated',
    name: '10:1 planetary gearbox',
    assemblyRole: 'Reduced joint gearbox',
    sourceFile: 'EG17-G10',
    sourceUrl: 'https://www.omc-stepperonline.com/eg-series-planetary-gearbox-gear-ratio-10-1-backlash-15-arc-min-for-nema-17-stepper-motor-eg17-g10',
    dimensionsMm: [42, 42, 88.5],
    quantity: 1,
    priceCad: '~$40',
    summary: 'The lower-ratio version of the same compact planetary gearbox family.',
    buildNote: 'Mark the ratio on the installed gearbox so axis configuration cannot be mixed later.',
    specifications: [
      { label: 'Ratio', value: '10:1' },
      { label: 'Backlash', value: '<=15 arc-min' },
      { label: 'Frame', value: '42 x 42 mm' },
      { label: 'Output shaft', value: '8 mm keyed' }
    ]
  },
  {
    id: 'powerSupply',
    category: 'electronics',
    modelType: 'generated',
    name: 'Mean Well EDR-120-24',
    assemblyRole: 'DIN-rail 24 V supply',
    sourceFile: 'EDR-120-24',
    sourceUrl: 'https://www.meanwell.com/Upload/PDF/EDR-120/EDR-120-SPEC.PDF',
    dimensionsMm: [40, 125.2, 113.5],
    quantity: 1,
    priceCad: '~$26',
    summary: 'The enclosed DIN-rail power supply for the controller and six-axis motor system.',
    buildNote: 'Guard the mains terminals, bond protective earth, and fuse the 24 V output before distribution.',
    specifications: [
      { label: 'Output', value: '24 V / 5 A' },
      { label: 'Power', value: '120 W' },
      { label: 'AC input', value: '90-264 VAC' },
      { label: 'Mount', value: 'TS-35 DIN rail' }
    ]
  },
  {
    id: 'coolingFan',
    category: 'electronics',
    modelType: 'generated',
    name: 'Noctua NF-A4x20 5V',
    assemblyRole: 'Controller cooling fan',
    sourceFile: 'NF-A4x20 5V',
    sourceUrl: 'https://www.noctua.at/en/products/nf-a4x20-5v/specifications',
    dimensionsMm: [40, 40, 20],
    quantity: 1,
    priceCad: '~$20-$30',
    summary: 'A compact 40 mm fan with the real square frame, anti-vibration pads, seven-blade impeller, hub, and sleeved lead.',
    buildNote: 'Orient airflow through the driver heatsinks and keep the intake clear of loose wiring.',
    specifications: [
      { label: 'Supply', value: '5 VDC' },
      { label: 'Speed', value: '5000 rpm max' },
      { label: 'Airflow', value: '9.4 m3/h' },
      { label: 'Mount spacing', value: '32 x 32 mm' }
    ]
  },
  {
    id: 'limitSwitch',
    category: 'electronics',
    modelType: 'generated',
    name: 'ZW12-3 limit switch',
    assemblyRole: 'Mechanical homing switch',
    sourceFile: 'ZW12-3',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/BOM/BOM.md#electronics',
    dimensionsMm: [28, 20, 10],
    quantity: 3,
    priceCad: '~$10-$25 total',
    summary: 'A lever microswitch with roller, snap-action body, terminals, and adjustable mounting holes.',
    buildNote: 'Wire homing switches normally closed so a broken wire is detected as a fault.',
    specifications: [
      { label: 'Contact', value: 'NC preferred' },
      { label: 'Signal', value: 'Digital input' },
      { label: 'Axes', value: '3' }
    ]
  },
  {
    id: 'inductiveSensor',
    category: 'electronics',
    modelType: 'generated',
    name: 'Inductive homing sensor',
    assemblyRole: 'Non-contact position sensor',
    sourceFile: 'M4 / M5 / GX-F8A sensor set',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/BOM/BOM.md#electronics',
    dimensionsMm: [12, 12, 48],
    quantity: 3,
    priceCad: '~$30-$60 total',
    summary: 'A threaded cylindrical proximity sensor with lock nuts, sensing face, status indicator, and cable tail.',
    buildNote: 'Verify NPN/PNP type and controller input voltage before connecting any proximity sensor.',
    specifications: [
      { label: 'Type', value: 'NPN, normally open' },
      { label: 'Output', value: '3-wire' },
      { label: 'Mount', value: 'Threaded barrel' }
    ]
  },
  {
    id: 'emergencyStop',
    category: 'electronics',
    modelType: 'generated',
    name: 'Emergency stop',
    assemblyRole: 'Normally-closed safety switch',
    sourceFile: 'NC mushroom E-stop',
    sourceUrl: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/BOM/BOM.md#electronics',
    dimensionsMm: [40, 40, 78],
    quantity: 1,
    priceCad: '~$10-$25',
    summary: 'A latching red mushroom actuator with yellow collar, panel body, and normally-closed contact block.',
    buildNote: 'The E-stop must remove motor enable or motor power through a real hardware safety path, not software alone.',
    specifications: [
      { label: 'Contact', value: 'Normally closed' },
      { label: 'Action', value: 'Push-lock / twist-release' },
      { label: 'Circuit', value: 'Hardware enable loop' }
    ]
  }
];

export const mechanicalPartIds = partCatalog
  .filter((part): part is PartSpec & { id: MechanicalPartId } => part.category === 'mechanical')
  .map((part) => part.id);

export const partById = Object.fromEntries(partCatalog.map((part) => [part.id, part])) as Record<
  PartSpec['id'],
  PartSpec
>;

export const modelFacts = {
  source: 'Source Robotics PAROL6 URDF',
  meshCount: 7,
  triangleCount: 184_404,
  nominalReachMm: 400
};
