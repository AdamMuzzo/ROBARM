import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ElectronicPartId } from './types';

type Vec3 = [number, number, number];

function materials() {
  return {
    blackPaint: new THREE.MeshPhysicalMaterial({ color: 0x1d2021, roughness: 0.46, metalness: 0.42, clearcoat: 0.08 }),
    darkPlastic: new THREE.MeshStandardMaterial({ color: 0x202426, roughness: 0.72, metalness: 0.03 }),
    zinc: new THREE.MeshStandardMaterial({ color: 0xaeb4b5, roughness: 0.34, metalness: 0.82 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xd1d5d4, roughness: 0.22, metalness: 0.9, clearcoat: 0.08 }),
    aluminum: new THREE.MeshStandardMaterial({ color: 0x92999a, roughness: 0.38, metalness: 0.76 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb66b38, roughness: 0.32, metalness: 0.72 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb79750, roughness: 0.31, metalness: 0.75 }),
    terminalGreen: new THREE.MeshStandardMaterial({ color: 0x277154, roughness: 0.62, metalness: 0.02 }),
    terminalBlue: new THREE.MeshStandardMaterial({ color: 0x285d86, roughness: 0.58, metalness: 0.03 }),
    offWhite: new THREE.MeshStandardMaterial({ color: 0xd9ddda, roughness: 0.65, metalness: 0.04 }),
    noctuaBeige: new THREE.MeshStandardMaterial({ color: 0xb7a286, roughness: 0.72, metalness: 0.02 }),
    noctuaBrown: new THREE.MeshStandardMaterial({ color: 0x5a382c, roughness: 0.68, metalness: 0.02 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xb6241c, roughness: 0.4, metalness: 0.08, clearcoat: 0.28 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xd8a719, roughness: 0.54, metalness: 0.04 }),
    sensorBlue: new THREE.MeshPhysicalMaterial({ color: 0x176295, roughness: 0.36, metalness: 0.28, clearcoat: 0.18 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.92, metalness: 0 })
  };
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3 = [0, 0, 0],
  rotation: Vec3 = [0, 0, 0]
) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position.map((value) => value * 0.001) as Vec3);
  object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function box(width: number, height: number, depth: number, material: THREE.Material, position?: Vec3, radius = 1.4) {
  return mesh(
    new RoundedBoxGeometry(width * 0.001, height * 0.001, depth * 0.001, 3, Math.min(radius, width / 3, height / 3, depth / 3) * 0.001),
    material,
    position
  );
}

function cylinder(radius: number, length: number, material: THREE.Material, position?: Vec3, axis: 'x' | 'y' | 'z' = 'z', segments = 48) {
  const rotation: Vec3 = axis === 'z' ? [Math.PI / 2, 0, 0] : axis === 'x' ? [0, 0, Math.PI / 2] : [0, 0, 0];
  return mesh(new THREE.CylinderGeometry(radius * 0.001, radius * 0.001, length * 0.001, segments), material, position, rotation);
}

function torus(radius: number, tube: number, material: THREE.Material, position?: Vec3, rotation: Vec3 = [0, 0, 0]) {
  return mesh(new THREE.TorusGeometry(radius * 0.001, tube * 0.001, 14, 64), material, position, rotation);
}

function bolt(parent: THREE.Group, x: number, y: number, z: number, material: THREE.Material, radius = 1.7) {
  parent.add(cylinder(radius, 1.2, material, [x, y, z], 'z', 20));
}

function cable(points: Vec3[], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z).multiplyScalar(0.001)));
  const object = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius * 0.001, 10, false), material);
  object.castShadow = true;
  return object;
}

function labelPlane(text: string, width: number, height: number, position: Vec3, color = '#283033') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Group();
  context.fillStyle = '#e6e8e4';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#777e7f';
  context.lineWidth = 8;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = color;
  context.font = '700 42px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const object = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.001, height * 0.001),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  );
  object.position.set(...position.map((value) => value * 0.001) as Vec3);
  return object;
}

function createNemaMotor(depth: number) {
  const m = materials();
  const group = new THREE.Group();
  group.add(box(40.2, 40.2, depth, m.blackPaint, [0, 0, 0], 3.1));
  group.add(box(42, 42, 3.4, m.zinc, [0, 0, depth / 2 - 1.7], 2.4));
  group.add(box(42, 42, 3.4, m.zinc, [0, 0, -depth / 2 + 1.7], 2.4));
  group.add(cylinder(11, 2.2, m.aluminum, [0, 0, depth / 2 + 1.1], 'z'));
  group.add(cylinder(2.5, 20, m.steel, [0, 0, depth / 2 + 11], 'z', 36));
  group.add(box(6, 2.4, 10, m.blackPaint, [2.3, 0, depth / 2 + 11]));
  for (const x of [-15.5, 15.5]) {
    for (const y of [-15.5, 15.5]) bolt(group, x, y, depth / 2 + 0.7, m.darkPlastic, 1.5);
  }
  group.add(box(12, 7, 5, m.darkPlastic, [0, -18, -depth / 2 - 1.5], 1));
  group.add(cable([[0, -19, -depth / 2 - 3], [-8, -28, -depth / 2 - 10], [-24, -34, -depth / 2 - 18]], 1.6, m.rubber));
  return group;
}

function createGearbox(ratio: 10 | 20) {
  const m = materials();
  const group = new THREE.Group();
  group.add(box(42, 42, 8, m.blackPaint, [0, 0, -29.5], 2.5));
  group.add(cylinder(18.2, 59, m.aluminum, [0, 0, 4], 'z', 72));
  group.add(cylinder(20.5, 7, m.zinc, [0, 0, 37], 'z', 72));
  group.add(cylinder(8, 21.5, m.steel, [0, 0, 51.2], 'z', 48));
  group.add(box(3.2, 1.5, 13, m.blackPaint, [7, 0, 53.8], 0.4));
  for (const x of [-15.5, 15.5]) {
    for (const y of [-15.5, 15.5]) bolt(group, x, y, 41, m.darkPlastic, 1.8);
  }
  group.add(torus(18, 1.2, m.darkPlastic, [0, 0, 40.4]));
  group.add(labelPlane(`${ratio}:1`, 22, 10, [0, 0, 41.2]));
  return group;
}

function createPowerSupply() {
  const m = materials();
  const group = new THREE.Group();
  const frontZ = 57.6;

  // Folded galvanized enclosure with separate front and rear seams.
  group.add(box(40, 125.2, 113.5, m.zinc, [0, 0, 0], 0.9));
  group.add(box(38.6, 122.5, 1.2, m.aluminum, [0, 0, 56.8], 0.35));
  group.add(box(34, 116, 1.2, m.aluminum, [0, 0, -56.8], 0.35));
  for (const x of [-19.4, 19.4]) {
    group.add(box(1.2, 119, 108, m.steel, [x, 0, -1.5], 0.25));
  }

  // Recessed side ventilation appears as two staggered banks on both flanks.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 8; row += 1) {
      const y = -43 + row * 12;
      for (const z of [-28, 3, 34]) {
        const vent = box(1.35, 5.4, 22, m.darkPlastic, [side * 20.15, y, z + (row % 2 === 0 ? 0 : 3)], 0.9);
        group.add(vent);
      }
    }
  }

  // Input and output terminal blocks occupy the narrow front face.
  const addTerminalBank = (count: number, y: number, labels: string) => {
    const bankWidth = count === 3 ? 32 : 35;
    group.add(box(bankWidth, 18, 8.5, m.darkPlastic, [0, y, 59.6], 0.8));
    const spacing = bankWidth / count;
    for (let index = 0; index < count; index += 1) {
      const x = -bankWidth / 2 + spacing * (index + 0.5);
      group.add(box(spacing - 0.7, 13.2, 1, m.offWhite, [x, y - 0.2, 64.3], 0.25));
      group.add(cylinder(2.25, 1.25, m.steel, [x, y + 2.1, 65], 'z', 28));
      group.add(box(3.2, 0.55, 0.8, m.darkPlastic, [x, y + 2.1, 65.8], 0.15));
    }
    group.add(labelPlane(labels, bankWidth - 2, 4.4, [0, y - 7.2, 64.9], '#202426'));
  };
  addTerminalBank(3, 49.5, 'FG     L      N');
  addTerminalBank(4, -49.5, '-V    -V    +V    +V');

  group.add(labelPlane('MEAN WELL  EDR-120-24', 31.5, 31, [0, 2, frontZ]));
  group.add(box(8.5, 6, 3.2, m.darkPlastic, [-8, -25, 59], 0.5));
  group.add(cylinder(2.1, 2.1, m.terminalGreen, [-8, -25, 61], 'z', 28));
  group.add(box(8.5, 6, 3.2, m.darkPlastic, [8, -25, 59], 0.5));
  group.add(cylinder(2.15, 2.1, m.copper, [8, -25, 61], 'z', 28));
  group.add(labelPlane('DC OK       +V ADJ', 25, 4.6, [0, -31, frontZ + 0.3], '#202426'));

  // Rear TS35 clip and lower spring latch make the mounting method legible.
  group.add(box(30, 6, 9, m.steel, [0, 18, -59], 0.6));
  group.add(box(30, 6, 9, m.steel, [0, -18, -59], 0.6));
  group.add(box(13, 12, 6, m.darkPlastic, [0, -36, -60], 0.8));
  group.add(box(6, 15, 3, m.darkPlastic, [0, -45, -62], 0.5));
  return group;
}

function createCoolingFan() {
  const m = materials();
  const group = new THREE.Group();
  const frameDepth = 20;
  group.add(box(40, 5, frameDepth, m.noctuaBeige, [0, 17.5, 0], 2.5));
  group.add(box(40, 5, frameDepth, m.noctuaBeige, [0, -17.5, 0], 2.5));
  group.add(box(5, 30, frameDepth, m.noctuaBeige, [17.5, 0, 0], 2.5));
  group.add(box(5, 30, frameDepth, m.noctuaBeige, [-17.5, 0, 0], 2.5));
  group.add(torus(15.7, 1.9, m.noctuaBeige, [0, 0, 0]));
  group.add(cylinder(5.4, 9, m.noctuaBrown, [0, 0, 0], 'z', 64));

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(3.5, 1.2);
  bladeShape.quadraticCurveTo(10, 0, 15, 5.4);
  bladeShape.quadraticCurveTo(11, 8.2, 4.2, 4.8);
  bladeShape.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: 2.8, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 2 });
  bladeGeometry.scale(0.001, 0.001, 0.001);
  bladeGeometry.translate(0, 0, -0.0014);
  for (let index = 0; index < 7; index += 1) {
    const blade = new THREE.Mesh(bladeGeometry, m.noctuaBrown);
    blade.rotation.z = (index / 7) * Math.PI * 2;
    blade.castShadow = true;
    group.add(blade);
  }
  for (const x of [-16, 16]) {
    for (const y of [-16, 16]) {
      group.add(cylinder(2.1, 21, m.darkPlastic, [x, y, 0], 'z', 28));
      group.add(torus(3.1, 1.1, m.noctuaBrown, [x, y, 10.2]));
    }
  }
  group.add(cable([[18, -13, -5], [28, -20, -8], [38, -22, -12]], 1.4, m.rubber));
  return group;
}

function createLimitSwitch() {
  const m = materials();
  const group = new THREE.Group();
  group.add(box(20, 10, 6.5, m.darkPlastic, [0, 0, 0], 1));
  group.add(box(24, 1.4, 3.6, m.steel, [-1, 7.5, 0], 0.4));
  group.children[group.children.length - 1].rotation.z = -0.2;
  group.add(cylinder(3.2, 3.8, m.darkPlastic, [-13, 10.2, 0], 'z', 32));
  for (const x of [-6.5, 6.5]) group.add(cylinder(1.7, 7, m.zinc, [x, 0, 0], 'z', 24));
  for (const x of [-7, 0, 7]) group.add(box(2.5, 8, 1.2, m.brass, [x, -8.4, 0], 0.3));
  return group;
}

function createInductiveSensor() {
  const m = materials();
  const group = new THREE.Group();
  group.add(cylinder(4, 36, m.sensorBlue, [0, 0, 0], 'z', 48));
  group.add(cylinder(4.3, 4, m.darkPlastic, [0, 0, 20], 'z', 48));
  group.add(cylinder(5.8, 3, m.brass, [0, 0, -10], 'z', 6));
  group.add(cylinder(5.8, 3, m.brass, [0, 0, 6], 'z', 6));
  for (let index = 0; index < 15; index += 1) group.add(torus(4.05, 0.12, m.steel, [0, 0, -15 + index * 2]));
  group.add(cylinder(1.3, 3, m.red, [0, 0, 20.6], 'z', 24));
  group.add(cable([[0, 0, -18], [3, -7, -29], [10, -12, -42]], 1.6, m.rubber));
  return group;
}

function createEmergencyStop() {
  const m = materials();
  const group = new THREE.Group();
  group.add(box(34, 25, 34, m.darkPlastic, [0, -25, 0], 2.2));
  group.add(box(30, 14, 30, m.yellow, [0, -6, 0], 2.4));
  group.add(cylinder(16, 5, m.yellow, [0, 3, 0], 'y', 64));
  group.add(cylinder(13, 9, m.red, [0, 10, 0], 'y', 64));
  group.add(cylinder(19, 8, m.red, [0, 18, 0], 'y', 64));
  group.add(torus(15.8, 1.2, m.darkPlastic, [0, 3.2, 0], [Math.PI / 2, 0, 0]));
  for (const x of [-8, 8]) group.add(box(5, 9, 3, m.copper, [x, -40, 0], 0.5));
  return group;
}

export function createGeneratedElectronicModel(partId: ElectronicPartId) {
  if (partId === 'motor20') return createNemaMotor(20);
  if (partId === 'motor40') return createNemaMotor(40);
  if (partId === 'motor60') return createNemaMotor(60);
  if (partId === 'gearbox20') return createGearbox(20);
  if (partId === 'gearbox10') return createGearbox(10);
  if (partId === 'powerSupply') return createPowerSupply();
  if (partId === 'coolingFan') return createCoolingFan();
  if (partId === 'limitSwitch') return createLimitSwitch();
  if (partId === 'inductiveSensor') return createInductiveSensor();
  if (partId === 'emergencyStop') return createEmergencyStop();
  throw new Error(`No generated electronic model is registered for ${partId}.`);
}
