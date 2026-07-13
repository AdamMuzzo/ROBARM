import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createGeneratedElectronicModel } from './electronicModels';
import type { ExplodedPieceCategory, MechanicalPartId } from './types';

type Vec3 = [number, number, number];

export interface InternalDetail {
  object: THREE.Object3D;
  label: string;
  section: number;
  category: ExplodedPieceCategory;
  material: string;
  description: string;
  visibleWhenAssembled: boolean;
}

const internalMaterials = {
  pcb: new THREE.MeshStandardMaterial({ color: 0x174e3c, roughness: 0.68, metalness: 0.04 }),
  driverPcb: new THREE.MeshStandardMaterial({ color: 0x7c2828, roughness: 0.62, metalness: 0.05 }),
  chip: new THREE.MeshStandardMaterial({ color: 0x171b1d, roughness: 0.68, metalness: 0.12 }),
  aluminum: new THREE.MeshStandardMaterial({ color: 0xa7afb1, roughness: 0.3, metalness: 0.84 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc5cbcc, roughness: 0.24, metalness: 0.9 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x4f595d, roughness: 0.34, metalness: 0.78 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb56d3e, roughness: 0.34, metalness: 0.7 }),
  terminal: new THREE.MeshStandardMaterial({ color: 0x326b56, roughness: 0.65, metalness: 0.02 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xd3a72e, roughness: 0.55, metalness: 0.03 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x171b1d, roughness: 0.92, metalness: 0 }),
  pulley: new THREE.MeshStandardMaterial({ color: 0x9aa2a4, roughness: 0.32, metalness: 0.76 }),
  wireRed: new THREE.MeshStandardMaterial({ color: 0xb63229, roughness: 0.8, metalness: 0 }),
  wireBlue: new THREE.MeshStandardMaterial({ color: 0x1768b7, roughness: 0.76, metalness: 0 }),
  wireYellow: new THREE.MeshStandardMaterial({ color: 0xd0a51f, roughness: 0.78, metalness: 0 }),
  wireBlack: new THREE.MeshStandardMaterial({ color: 0x171a1b, roughness: 0.88, metalness: 0 }),
  pneumaticBlue: new THREE.MeshPhysicalMaterial({
    color: 0x0c70d8,
    roughness: 0.32,
    metalness: 0.02,
    clearcoat: 0.3
  })
};

function box(size: Vec3, material: THREE.Material, position: Vec3 = [0, 0, 0], radius = 0.001) {
  const [x, y, z] = size;
  const object = new THREE.Mesh(new RoundedBoxGeometry(x, y, z, 3, Math.min(radius, x / 4, y / 4, z / 4)), material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function cylinder(radius: number, length: number, material: THREE.Material, position: Vec3, segments = 32) {
  const object = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  object.position.set(...position);
  object.rotation.x = Math.PI / 2;
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function tube(points: Vec3[], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const object = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 10, false), material);
  object.castShadow = true;
  return object;
}

function createControllerBoard() {
  const board = new THREE.Group();
  board.name = 'PAROL6 controller PCB';
  board.add(box([0.105, 0.064, 0.0022], internalMaterials.pcb, [0, 0, 0]));
  board.add(box([0.023, 0.012, 0.009], internalMaterials.terminal, [-0.037, 0.025, 0.006]));
  board.add(box([0.016, 0.013, 0.011], internalMaterials.yellow, [0.038, 0.025, 0.007]));
  board.add(box([0.018, 0.014, 0.009], internalMaterials.aluminum, [0.043, -0.024, 0.006]));
  board.add(box([0.014, 0.014, 0.003], internalMaterials.chip, [0, -0.021, 0.003]));
  board.add(box([0.021, 0.008, 0.006], internalMaterials.chip, [-0.034, -0.023, 0.005]));
  for (const x of [-0.044, -0.032, 0.024, 0.036]) {
    board.add(cylinder(0.0033, 0.009, internalMaterials.chip, [x, 0.005, 0.006]));
  }
  for (const x of [-0.047, 0.047]) {
    for (const y of [-0.027, 0.027]) {
      board.add(cylinder(0.0017, 0.003, internalMaterials.steel, [x, y, 0.002]));
    }
  }
  board.position.set(-0.104, 0, 0.028);
  return board;
}

function createDriver(index: number) {
  const driver = new THREE.Group();
  driver.name = `TMC5160 driver ${index + 1}`;
  driver.add(box([0.018, 0.014, 0.0016], internalMaterials.driverPcb));
  driver.add(box([0.008, 0.008, 0.0025], internalMaterials.chip, [0, 0, 0.002]));
  const heatsink = box([0.012, 0.011, 0.006], internalMaterials.aluminum, [0, 0, 0.006]);
  driver.add(heatsink);
  for (let fin = -2; fin <= 2; fin += 1) {
    driver.add(box([0.001, 0.011, 0.003], internalMaterials.aluminum, [fin * 0.0023, 0, 0.0102], 0.0002));
  }
  for (const side of [-1, 1]) {
    for (let pin = -3; pin <= 3; pin += 1) {
      driver.add(cylinder(0.00035, 0.004, internalMaterials.copper, [side * 0.0085, pin * 0.0017, -0.002]));
    }
  }
  const column = index % 3;
  const row = Math.floor(index / 3);
  driver.position.set(-0.022 + column * 0.022, -0.008 + row * 0.019, 0.0105);
  return driver;
}

function createWiringHarness() {
  const harness = new THREE.Group();
  harness.name = 'Base wiring harness';
  const materials = [internalMaterials.wireRed, internalMaterials.wireBlack, internalMaterials.wireBlue, internalMaterials.wireYellow];
  for (let index = 0; index < materials.length; index += 1) {
    const offset = (index - 1.5) * 0.003;
    harness.add(tube([
      [-0.16, offset, 0.018],
      [-0.12, 0.018 + offset, 0.025],
      [-0.075, 0.012 + offset, 0.042],
      [-0.035, 0.032 + offset, 0.058]
    ], 0.00115, materials[index]));
  }
  return harness;
}

function createPneumaticLines() {
  const lines = new THREE.Group();
  lines.name = 'Pneumatic tube pair';
  for (const offset of [-0.009, 0.009]) {
    lines.add(tube([
      [-0.032, 0.021 + offset, -0.105],
      [-0.075, 0.06 + offset, -0.14],
      [-0.082, 0.09 + offset, -0.2],
      [-0.048, 0.075 + offset, -0.25],
      [-0.002, 0.03 + offset, -0.276]
    ], 0.0021, internalMaterials.pneumaticBlue));
  }
  return lines;
}

function createBeltDrive(spacing: number, pulleyRadius: number) {
  const drive = new THREE.Group();
  drive.name = 'HTD timing belt transmission';
  const leftX = -spacing / 2;
  const rightX = spacing / 2;
  const rightRadius = pulleyRadius * 0.72;
  const width = 0.012;
  const beltThickness = 0.0023;

  const createTimingPulley = (radius: number, x: number, toothCount: number) => {
    const pulley = new THREE.Group();
    pulley.position.x = x;
    pulley.add(cylinder(radius * 0.82, width, internalMaterials.pulley, [0, 0, 0], 64));
    pulley.add(cylinder(radius * 0.34, width + 0.006, internalMaterials.steel, [0, 0, 0], 48));
    pulley.add(cylinder(radius * 0.12, width + 0.007, internalMaterials.belt, [0, 0, 0], 32));
    for (const z of [-width / 2 - 0.0012, width / 2 + 0.0012]) {
      pulley.add(cylinder(radius * 1.06, 0.0012, internalMaterials.aluminum, [0, 0, z], 64));
    }
    for (let tooth = 0; tooth < toothCount; tooth += 1) {
      const angle = tooth / toothCount * Math.PI * 2;
      const block = box(
        [Math.max(0.0015, radius * 0.16), Math.max(0.0015, radius * 0.12), width],
        internalMaterials.pulley,
        [Math.cos(angle) * radius * 0.9, Math.sin(angle) * radius * 0.9, 0],
        0.00025
      );
      block.rotation.z = angle;
      pulley.add(block);
    }
    return pulley;
  };

  const addBeltBlock = (x: number, y: number, angle: number, length: number, tooth = false) => {
    const block = box(
      [length, tooth ? beltThickness * 0.55 : beltThickness, tooth ? width * 0.78 : width * 0.86],
      internalMaterials.belt,
      [x, y, 0],
      tooth ? 0.00018 : 0.00045
    );
    block.rotation.z = angle;
    drive.add(block);
  };

  drive.add(createTimingPulley(pulleyRadius, leftX, 32));
  drive.add(createTimingPulley(rightRadius, rightX, 24));

  const deltaRadius = pulleyRadius - rightRadius;
  const spanLength = Math.hypot(spacing, deltaRadius);
  const spanAngle = Math.atan2(deltaRadius, spacing);
  for (const side of [-1, 1]) {
    const yLeft = side * (pulleyRadius + beltThickness * 0.55);
    const yRight = side * (rightRadius + beltThickness * 0.55);
    addBeltBlock((leftX + rightX) / 2, (yLeft + yRight) / 2, side > 0 ? -spanAngle : spanAngle, spanLength);
    const toothCount = Math.max(5, Math.floor(spanLength / 0.004));
    for (let tooth = 1; tooth < toothCount; tooth += 1) {
      const t = tooth / toothCount;
      addBeltBlock(
        THREE.MathUtils.lerp(leftX, rightX, t),
        THREE.MathUtils.lerp(yLeft - side * beltThickness * 0.7, yRight - side * beltThickness * 0.7, t),
        side > 0 ? -spanAngle : spanAngle,
        0.002
      );
    }
  }

  const addWrappedBelt = (centerX: number, radius: number, startAngle: number) => {
    const segments = 18;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = startAngle + (segment + 0.5) / segments * Math.PI;
      const arcLength = Math.PI * (radius + beltThickness * 0.55) / segments * 1.08;
      addBeltBlock(
        centerX + Math.cos(angle) * (radius + beltThickness * 0.55),
        Math.sin(angle) * (radius + beltThickness * 0.55),
        angle + Math.PI / 2,
        arcLength
      );
    }
  };
  addWrappedBelt(leftX, pulleyRadius, Math.PI / 2);
  addWrappedBelt(rightX, rightRadius, -Math.PI / 2);

  const tensioner = new THREE.Group();
  tensioner.position.set(spacing * 0.12, -(Math.max(pulleyRadius, rightRadius) + 0.008), 0);
  tensioner.add(cylinder(0.0065, width + 0.004, internalMaterials.steel, [0, 0, 0], 40));
  tensioner.add(cylinder(0.0022, width + 0.006, internalMaterials.darkSteel, [0, 0, 0], 32));
  tensioner.add(box([0.004, 0.019, 0.004], internalMaterials.darkSteel, [0, -0.011, 0], 0.0005));
  drive.add(tensioner);
  return drive;
}

function placeGenerated(partId: 'limitSwitch' | 'inductiveSensor', position: Vec3, rotation: Vec3) {
  const object = createGeneratedElectronicModel(partId);
  object.position.set(...position);
  object.rotation.set(...rotation);
  return object;
}

export function createRobotInternalDetails(frames: Record<MechanicalPartId, THREE.Object3D>) {
  const details: InternalDetail[] = [];
  const add = (
    parent: THREE.Object3D,
    object: THREE.Object3D,
    label: string,
    section: number,
    category: ExplodedPieceCategory,
    material: string,
    description: string,
    visibleWhenAssembled = false
  ) => {
    parent.add(object);
    object.visible = visibleWhenAssembled;
    details.push({ object, label, section, category, material, description, visibleWhenAssembled });
    return object;
  };

  const controller = add(
    frames.baseLink,
    createControllerBoard(),
    'PAROL6 controller PCB',
    7,
    'electronics',
    'FR-4 circuit board, copper, aluminum heat sinks',
    'The compact STM32-based six-axis controller mounts inside the lower electronics bay. It distributes 24 V power, reads the limit and inductive sensors, and commands all six stepper-driver modules.'
  );
  for (let index = 0; index < 6; index += 1) {
    add(
      controller,
      createDriver(index),
      `TMC5160 stepper driver ${index + 1}`,
      7,
      'electronics',
      'FR-4 module with aluminum heat sink',
      'A removable TMC5160 motion-control module for one robot axis. Its heat sink faces the fan airflow because the drivers require active cooling at the PAROL6 operating current.'
    );
  }

  const fan = createGeneratedElectronicModel('coolingFan');
  fan.position.set(-0.145, -0.069, 0.038);
  fan.rotation.x = Math.PI / 2;
  add(
    frames.baseLink,
    fan,
    '40 mm electronics cooling fan',
    7,
    'electronics',
    'Glass-fiber-reinforced plastic, copper motor windings',
    'The 40 × 40 × 20 mm 5 V fan is fixed directly behind the circular base vent and fan cover. It pulls air across the six stepper-driver heat sinks in the enclosed controller bay.',
    true
  );
  add(
    frames.baseLink,
    createWiringHarness(),
    'Motor and sensor wiring harness',
    7,
    'electronics',
    'Stranded copper with PVC insulation',
    'The color-coded low-voltage harness links the controller to the six stepper motors, home sensors, fan, emergency-stop circuit, and front-panel controls.'
  );

  const beltSpecs: Array<[MechanicalPartId, string, number, number, Vec3, Vec3]> = [
    ['link1', 'J1 HTD belt drive', 1, 0.024, [0.005, 0.02, 0.09], [0, 0, 0]],
    ['link2', 'J3 HTD belt drive', 2, 0.021, [-0.005, -0.115, 0.054], [0, 0, Math.PI / 2]],
    ['link3', 'J4 HTD belt drive', 3, 0.018, [0.018, -0.018, 0], [0, 0, 0]],
    ['link4', 'J5 HTD belt drive', 4, 0.017, [0.004, -0.018, -0.135], [0, Math.PI / 2, 0]]
  ];
  beltSpecs.forEach(([partId, label, section, radius, position, rotation]) => {
    const drive = createBeltDrive(radius * 2.3, radius);
    drive.position.set(...position);
    drive.rotation.set(...rotation);
    add(
      frames[partId],
      drive,
      label,
      section,
      'drive component',
      'Aluminum timing pulleys, steel bearings, reinforced rubber belt',
      'A compact timing-belt reduction stage with flanged toothed pulleys, keyed hubs, an HTD-profile belt, and an adjustable tension bearing. It transfers stepper torque while keeping the motor packaged inside the printed link.'
    );
  });

  add(
    frames.link4,
    createPneumaticLines(),
    'Blue pneumatic tube pair',
    4,
    'pneumatics',
    'Polyurethane pneumatic tubing',
    'Two flexible air lines route through the forearm and wrist to a pneumatic end effector. The paired lines support pressure and return/vacuum paths while preserving wrist motion.'
  );

  const sensorSpecs: Array<[MechanicalPartId, 'limitSwitch' | 'inductiveSensor', string, number, Vec3, Vec3]> = [
    ['link1', 'inductiveSensor', 'J1 inductive home sensor', 1, [0.035, 0.045, 0.07], [0, Math.PI / 2, 0]],
    ['link1', 'limitSwitch', 'J2 limit switch', 1, [0.028, -0.052, 0.093], [Math.PI / 2, 0, 0]],
    ['link2', 'limitSwitch', 'J3 limit switch', 2, [-0.018, -0.18, 0.047], [Math.PI / 2, 0, 0]],
    ['link3', 'inductiveSensor', 'J4 inductive home sensor', 3, [0.042, -0.035, 0], [0, Math.PI / 2, 0]],
    ['link4', 'limitSwitch', 'J5 limit switch', 4, [0.028, -0.026, -0.16], [Math.PI / 2, 0, 0]],
    ['link5', 'inductiveSensor', 'J6 inductive home sensor', 5, [0, -0.018, 0], [Math.PI / 2, 0, 0]]
  ];
  sensorSpecs.forEach(([partId, type, label, section, position, rotation]) => {
    add(
      frames[partId],
      placeGenerated(type, position, rotation),
      label,
      section,
      'sensor',
      type === 'limitSwitch' ? 'Engineering plastic, spring steel, copper contacts' : 'Nickel-plated brass and polymer',
      type === 'limitSwitch'
        ? 'A mechanical home/limit switch whose lever is contacted by the moving link. It gives the controller a repeatable reference during the homing sequence.'
        : 'A threaded inductive proximity sensor that detects a metal target without physical contact, establishing a repeatable angular home reference for the joint.'
    );
  });

  return details;
}
