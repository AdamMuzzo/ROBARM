import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { armDimensions } from './robotData';
import type { JointState, PartId } from './types';

type Vec3 = [number, number, number];
type Axis = 'x' | 'y' | 'z';

const machined = new THREE.MeshPhysicalMaterial({
  color: 0xaeb8ba,
  metalness: 0.78,
  roughness: 0.24,
  clearcoat: 0.25,
  clearcoatRoughness: 0.35
});

const brushedEdge = new THREE.MeshPhysicalMaterial({
  color: 0xd5d9d6,
  metalness: 0.85,
  roughness: 0.18,
  clearcoat: 0.18
});

const darkAnodized = new THREE.MeshPhysicalMaterial({
  color: 0x171b1c,
  metalness: 0.72,
  roughness: 0.32,
  clearcoat: 0.18
});

const satinBlack = new THREE.MeshStandardMaterial({
  color: 0x0f1111,
  metalness: 0.28,
  roughness: 0.48
});

const tealAnodized = new THREE.MeshPhysicalMaterial({
  color: 0x008c91,
  metalness: 0.5,
  roughness: 0.28,
  clearcoat: 0.35
});

const amberAnodized = new THREE.MeshPhysicalMaterial({
  color: 0xd8a545,
  metalness: 0.55,
  roughness: 0.24,
  clearcoat: 0.2
});

const rubber = new THREE.MeshStandardMaterial({
  color: 0x1d1a18,
  metalness: 0.03,
  roughness: 0.84
});

const cable = new THREE.MeshStandardMaterial({
  color: 0x111111,
  metalness: 0.05,
  roughness: 0.58
});

const fastener = new THREE.MeshPhysicalMaterial({
  color: 0x545b5d,
  metalness: 0.86,
  roughness: 0.2
});

const pcb = new THREE.MeshStandardMaterial({
  color: 0x176b45,
  metalness: 0.08,
  roughness: 0.62
});

const copper = new THREE.MeshStandardMaterial({
  color: 0xc06f34,
  metalness: 0.72,
  roughness: 0.31
});

const brass = new THREE.MeshStandardMaterial({
  color: 0xc79a45,
  metalness: 0.75,
  roughness: 0.26
});

const plastic = new THREE.MeshStandardMaterial({
  color: 0x2d3233,
  metalness: 0.04,
  roughness: 0.54
});

const whiteSilk = new THREE.MeshStandardMaterial({
  color: 0xe7e8df,
  metalness: 0.02,
  roughness: 0.56
});

const translucentReach = new THREE.MeshStandardMaterial({
  color: 0x6fc7d2,
  metalness: 0.05,
  roughness: 0.12,
  transparent: true,
  opacity: 0.28
});

export interface RobotModel {
  root: THREE.Group;
  parts: Record<PartId, THREE.Group>;
  update: (joints: JointState) => void;
  getToolWorldPosition: (target?: THREE.Vector3) => THREE.Vector3;
}

const cast = <T extends THREE.Object3D>(object: T): T => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
};

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  position?: Vec3,
  rotation?: Vec3
) {
  const object = new THREE.Mesh(geometry, material);
  if (position) object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  return cast(object);
}

function roundedBox(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  position?: Vec3,
  rotation?: Vec3,
  radius = Math.min(width, height, depth) * 0.18,
  segments = 5
) {
  return mesh(new RoundedBoxGeometry(width, height, depth, segments, radius), material, position, rotation);
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: THREE.Material,
  radialSegments = 72,
  position?: Vec3,
  rotation?: Vec3,
  openEnded = false
) {
  return mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, openEnded),
    material,
    position,
    rotation
  );
}

function torus(radius: number, tube: number, material: THREE.Material, position?: Vec3, rotation?: Vec3) {
  return mesh(new THREE.TorusGeometry(radius, tube, 18, 120), material, position, rotation);
}

function axisRotation(axis: Axis): Vec3 {
  if (axis === 'x') return [0, 0, Math.PI / 2];
  if (axis === 'z') return [Math.PI / 2, 0, 0];
  return [0, 0, 0];
}

function addBolt(parent: THREE.Group, position: Vec3, axis: Axis, radius = 0.008) {
  parent.add(cylinder(radius, radius * 0.94, radius * 0.55, fastener, 24, position, axisRotation(axis)));
  parent.add(cylinder(radius * 0.46, radius * 0.46, radius * 0.58, satinBlack, 18, position, axisRotation(axis)));
}

function boltCircle(parent: THREE.Group, radius: number, count: number, center: Vec3, axis: Axis, boltRadius = 0.007) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const c = Math.cos(angle) * radius;
    const s = Math.sin(angle) * radius;
    if (axis === 'y') addBolt(parent, [center[0] + c, center[1], center[2] + s], axis, boltRadius);
    if (axis === 'z') addBolt(parent, [center[0] + c, center[1] + s, center[2]], axis, boltRadius);
    if (axis === 'x') addBolt(parent, [center[0], center[1] + c, center[2] + s], axis, boltRadius);
  }
}

function addGearTeeth(parent: THREE.Group, radius: number, count: number, y: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const tooth = roundedBox(0.018, 0.024, 0.012, darkAnodized, [
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius
    ]);
    tooth.rotation.y = -angle;
    parent.add(tooth);
  }
}

function sidePlate(
  length: number,
  height: number,
  depth: number,
  material: THREE.Material,
  holes: Array<{ x: number; y?: number; r: number }>,
  position?: Vec3
) {
  const r = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(0, -r);
  shape.lineTo(length, -r);
  shape.absarc(length, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(0, r);
  shape.absarc(0, 0, r, Math.PI / 2, Math.PI * 1.5, false);

  holes.forEach((holeDef) => {
    const hole = new THREE.Path();
    hole.absarc(holeDef.x, holeDef.y ?? 0, holeDef.r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  });

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.0035,
    bevelThickness: 0.0035,
    bevelSegments: 3,
    curveSegments: 32
  });
  geometry.translate(0, 0, -depth / 2);
  return mesh(geometry, material, position);
}

function wireCurve(points: THREE.Vector3[], radius = 0.006, material = cable) {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(new THREE.TubeGeometry(curve, 72, radius, 10, false), material);
}

function addCableChain(parent: THREE.Group, length: number, z: number, y = 0.082) {
  const segmentCount = 16;
  for (let i = 0; i < segmentCount; i += 1) {
    const x = 0.07 + (length - 0.14) * (i / (segmentCount - 1));
    const segment = roundedBox(0.024, 0.025, 0.06, plastic, [x, y, z], [0, 0, Math.sin(i) * 0.02], 0.004);
    parent.add(segment);
    parent.add(roundedBox(0.01, 0.032, 0.064, satinBlack, [x, y, z], undefined, 0.003));
  }
}

function addStandoffs(parent: THREE.Group, xs: number[], span: number, radius = 0.012) {
  xs.forEach((x) => {
    parent.add(cylinder(radius, radius, span, fastener, 28, [x, 0, 0], axisRotation('z')));
    parent.add(cylinder(radius * 1.35, radius * 1.35, 0.008, machined, 28, [x, 0, -span / 2 - 0.004], axisRotation('z')));
    parent.add(cylinder(radius * 1.35, radius * 1.35, 0.008, machined, 28, [x, 0, span / 2 + 0.004], axisRotation('z')));
  });
}

function addBoardComponents(parent: THREE.Group, y = 0.011) {
  parent.add(roundedBox(0.035, 0.012, 0.026, satinBlack, [-0.028, y, -0.018], undefined, 0.003));
  parent.add(roundedBox(0.045, 0.01, 0.022, plastic, [0.027, y, -0.02], undefined, 0.002));
  parent.add(roundedBox(0.07, 0.013, 0.014, brass, [0.022, y, 0.036], undefined, 0.002));
  for (let i = 0; i < 5; i += 1) {
    parent.add(cylinder(0.004, 0.004, 0.018, copper, 16, [-0.058 + i * 0.018, y + 0.002, 0.038], axisRotation('z')));
  }
}

function createServicePanel() {
  const group = new THREE.Group();
  group.add(roundedBox(0.12, 0.07, 0.014, darkAnodized, [0, 0, 0], undefined, 0.004));
  group.add(roundedBox(0.032, 0.018, 0.006, satinBlack, [-0.032, 0.008, -0.01], undefined, 0.002));
  group.add(roundedBox(0.018, 0.018, 0.006, tealAnodized, [0.013, 0.008, -0.01], undefined, 0.002));
  group.add(roundedBox(0.024, 0.014, 0.006, amberAnodized, [0.044, 0.006, -0.01], undefined, 0.002));
  addBolt(group, [-0.052, 0.026, -0.01], 'z', 0.004);
  addBolt(group, [0.052, 0.026, -0.01], 'z', 0.004);
  addBolt(group, [-0.052, -0.026, -0.01], 'z', 0.004);
  addBolt(group, [0.052, -0.026, -0.01], 'z', 0.004);
  return cast(group);
}

function createBaseGroup() {
  const group = new THREE.Group();
  group.add(cylinder(0.24, 0.255, 0.025, darkAnodized, 112, [0, 0.012, 0]));
  group.add(torus(0.213, 0.012, satinBlack, [0, 0.028, 0], [Math.PI / 2, 0, 0]));
  group.add(cylinder(armDimensions.baseRadius, armDimensions.baseRadius * 0.96, 0.096, machined, 112, [0, 0.082, 0]));
  group.add(cylinder(0.166, 0.18, 0.034, brushedEdge, 112, [0, 0.148, 0]));
  group.add(cylinder(0.135, 0.148, 0.045, darkAnodized, 112, [0, 0.187, 0]));
  group.add(torus(0.145, 0.007, tealAnodized, [0, 0.213, 0], [Math.PI / 2, 0, 0]));
  boltCircle(group, 0.207, 12, [0, 0.032, 0], 'y', 0.008);
  boltCircle(group, 0.135, 10, [0, 0.174, 0], 'y', 0.006);

  const panel = createServicePanel();
  panel.position.set(0, 0.102, -0.183);
  panel.rotation.x = -0.18;
  group.add(panel);

  for (let i = 0; i < 4; i += 1) {
    const angle = Math.PI / 4 + i * (Math.PI / 2);
    group.add(cylinder(0.02, 0.026, 0.018, rubber, 32, [Math.cos(angle) * 0.218, -0.003, Math.sin(angle) * 0.218]));
  }

  return cast(group);
}

function createTurntableGroup() {
  const group = new THREE.Group();
  group.add(cylinder(0.155, 0.165, 0.05, darkAnodized, 112, [0, -0.006, 0]));
  group.add(torus(0.141, 0.012, machined, [0, 0.018, 0], [Math.PI / 2, 0, 0]));
  addGearTeeth(group, 0.165, 72, 0.02);
  group.add(cylinder(0.108, 0.112, 0.044, machined, 96, [0, 0.046, 0]));
  group.add(cylinder(0.074, 0.08, 0.052, darkAnodized, 96, [0, 0.087, 0]));
  group.add(roundedBox(0.242, 0.034, 0.105, satinBlack, [0, 0.099, 0], undefined, 0.011));
  boltCircle(group, 0.109, 12, [0, 0.075, 0], 'y', 0.0055);

  const cableGland = cylinder(0.021, 0.024, 0.04, satinBlack, 32, [-0.127, 0.07, -0.057], [Math.PI / 2, 0, 0]);
  group.add(cableGland);
  group.add(wireCurve([new THREE.Vector3(-0.13, 0.07, -0.08), new THREE.Vector3(-0.18, 0.12, -0.16), new THREE.Vector3(-0.07, 0.18, -0.19)], 0.006));
  return cast(group);
}

function createShoulderGroup() {
  const group = new THREE.Group();
  const plateHoles = [
    { x: 0.012, y: 0.02, r: 0.028 },
    { x: 0.088, y: -0.05, r: 0.018 }
  ];

  const left = sidePlate(0.14, 0.23, 0.016, machined, plateHoles, [-0.06, -0.03, -0.083]);
  left.rotation.z = Math.PI / 2;
  const right = sidePlate(0.14, 0.23, 0.016, machined, plateHoles, [-0.06, -0.03, 0.083]);
  right.rotation.z = Math.PI / 2;
  group.add(left, right);

  group.add(cylinder(0.078, 0.078, 0.195, darkAnodized, 96, [0, 0, 0], axisRotation('z')));
  group.add(cylinder(0.054, 0.054, 0.214, tealAnodized, 96, [0, 0, 0], axisRotation('z')));
  group.add(torus(0.065, 0.006, brushedEdge, [0, 0, -0.102], [0, 0, 0]));
  group.add(torus(0.065, 0.006, brushedEdge, [0, 0, 0.102], [0, 0, 0]));
  boltCircle(group, 0.064, 8, [0, 0, -0.108], 'z', 0.005);
  boltCircle(group, 0.064, 8, [0, 0, 0.108], 'z', 0.005);

  group.add(roundedBox(0.118, 0.138, 0.105, satinBlack, [-0.083, -0.004, 0], undefined, 0.018));
  group.add(cylinder(0.049, 0.049, 0.116, darkAnodized, 64, [-0.144, -0.004, 0], axisRotation('x')));
  group.add(cylinder(0.039, 0.039, 0.124, tealAnodized, 64, [-0.144, -0.004, 0], axisRotation('x')));

  group.add(roundedBox(0.11, 0.022, 0.142, machined, [-0.014, -0.142, 0], undefined, 0.005));
  return cast(group);
}

function createUpperArmGroup() {
  const group = new THREE.Group();
  const length = armDimensions.upperArmLength;
  const holes = [
    { x: 0, r: 0.039 },
    { x: length, r: 0.039 },
    { x: length * 0.34, r: 0.03 },
    { x: length * 0.66, r: 0.03 }
  ];
  const left = sidePlate(length, 0.092, 0.018, machined, holes, [0, 0, -0.064]);
  const right = sidePlate(length, 0.092, 0.018, machined, holes, [0, 0, 0.064]);
  group.add(left, right);
  addStandoffs(group, [0.095, 0.235, 0.375, 0.505], 0.128, 0.011);
  group.add(cylinder(0.041, 0.041, 0.156, darkAnodized, 72, [0, 0, 0], axisRotation('z')));
  group.add(cylinder(0.06, 0.06, 0.152, amberAnodized, 80, [length, 0, 0], axisRotation('z')));
  group.add(cylinder(0.032, 0.032, 0.17, satinBlack, 56, [length, 0, 0], axisRotation('z')));
  group.add(roundedBox(length - 0.145, 0.026, 0.034, tealAnodized, [length / 2, 0.057, 0], undefined, 0.007));
  addCableChain(group, length, -0.092, 0.078);
  group.add(wireCurve([
    new THREE.Vector3(0.02, 0.055, -0.095),
    new THREE.Vector3(length * 0.35, 0.13, -0.13),
    new THREE.Vector3(length * 0.75, 0.105, -0.11),
    new THREE.Vector3(length - 0.015, 0.035, -0.085)
  ], 0.0065));
  return cast(group);
}

function createElbowGroup() {
  const group = new THREE.Group();
  group.add(cylinder(0.082, 0.082, 0.17, darkAnodized, 96, [0, 0, 0], axisRotation('z')));
  group.add(cylinder(0.058, 0.058, 0.19, amberAnodized, 96, [0, 0, 0], axisRotation('z')));
  group.add(torus(0.071, 0.006, brushedEdge, [0, 0, -0.096], [0, 0, 0]));
  group.add(torus(0.071, 0.006, brushedEdge, [0, 0, 0.096], [0, 0, 0]));
  boltCircle(group, 0.064, 10, [0, 0, -0.102], 'z', 0.005);
  boltCircle(group, 0.064, 10, [0, 0, 0.102], 'z', 0.005);
  group.add(roundedBox(0.122, 0.074, 0.126, satinBlack, [0.046, -0.002, 0], undefined, 0.02));
  group.add(cylinder(0.034, 0.034, 0.13, tealAnodized, 64, [0.109, -0.002, 0], axisRotation('x')));
  return cast(group);
}

function createForearmGroup() {
  const group = new THREE.Group();
  const length = armDimensions.forearmLength;
  const holes = [
    { x: 0, r: 0.034 },
    { x: length, r: 0.028 },
    { x: length * 0.44, r: 0.025 }
  ];
  const left = sidePlate(length, 0.078, 0.016, machined, holes, [0, 0, -0.052]);
  const right = sidePlate(length, 0.078, 0.016, machined, holes, [0, 0, 0.052]);
  group.add(left, right);
  addStandoffs(group, [0.085, 0.22, 0.35], 0.104, 0.0095);
  group.add(cylinder(0.037, 0.037, 0.128, darkAnodized, 72, [0, 0, 0], axisRotation('z')));
  group.add(cylinder(0.047, 0.047, 0.13, darkAnodized, 72, [length, 0, 0], axisRotation('z')));
  group.add(roundedBox(length - 0.12, 0.028, 0.033, tealAnodized, [length / 2, -0.057, 0], undefined, 0.007));
  group.add(roundedBox(0.22, 0.019, 0.033, satinBlack, [length * 0.46, 0.056, -0.066], undefined, 0.006));
  group.add(wireCurve([
    new THREE.Vector3(0.015, 0.05, -0.071),
    new THREE.Vector3(0.18, 0.092, -0.09),
    new THREE.Vector3(length - 0.055, 0.065, -0.076)
  ], 0.0058));
  return cast(group);
}

function createWristGroup() {
  const group = new THREE.Group();
  group.add(cylinder(0.05, 0.05, 0.126, darkAnodized, 72, [0, 0, 0], axisRotation('z')));
  boltCircle(group, 0.039, 6, [0, 0, -0.069], 'z', 0.0045);
  boltCircle(group, 0.039, 6, [0, 0, 0.069], 'z', 0.0045);
  group.add(roundedBox(0.13, 0.08, 0.028, machined, [0.068, 0, -0.061], undefined, 0.008));
  group.add(roundedBox(0.13, 0.08, 0.028, machined, [0.068, 0, 0.061], undefined, 0.008));
  group.add(cylinder(0.04, 0.04, 0.142, tealAnodized, 72, [0.14, 0, 0], axisRotation('z')));
  group.add(cylinder(0.037, 0.037, 0.064, satinBlack, 72, [0.191, 0, 0], axisRotation('x')));
  group.add(torus(0.042, 0.004, brushedEdge, [0.181, 0, 0], [0, Math.PI / 2, 0]));
  group.add(wireCurve([
    new THREE.Vector3(-0.01, 0.045, -0.058),
    new THREE.Vector3(0.082, 0.086, -0.081),
    new THREE.Vector3(0.18, 0.042, -0.055)
  ], 0.0048));
  return cast(group);
}

function createGripperGroup() {
  const group = new THREE.Group();
  const carriage = new THREE.Group();
  carriage.name = 'carriage';
  carriage.add(roundedBox(0.08, 0.06, 0.165, darkAnodized, [0.035, 0, 0], undefined, 0.009));
  carriage.add(roundedBox(0.028, 0.09, 0.19, machined, [0.084, 0, 0], undefined, 0.006));
  carriage.add(cylinder(0.007, 0.007, 0.178, brushedEdge, 24, [0.119, 0.032, 0], axisRotation('z')));
  carriage.add(cylinder(0.007, 0.007, 0.178, brushedEdge, 24, [0.119, -0.032, 0], axisRotation('z')));
  carriage.add(cylinder(0.005, 0.005, 0.186, satinBlack, 24, [0.147, 0, 0], axisRotation('z')));

  const leftJaw = new THREE.Group();
  leftJaw.name = 'leftJaw';
  leftJaw.add(roundedBox(0.08, 0.036, 0.038, machined, [0.118, 0.027, 0], undefined, 0.005));
  leftJaw.add(sidePlate(armDimensions.gripperLength, 0.032, 0.014, amberAnodized, [
    { x: 0.032, r: 0.006 },
    { x: 0.094, r: 0.006 }
  ], [0.136, 0.028, 0]));
  leftJaw.add(roundedBox(0.074, 0.022, 0.032, rubber, [armDimensions.gripperLength + 0.176, 0.016, 0], undefined, 0.004));

  const rightJaw = new THREE.Group();
  rightJaw.name = 'rightJaw';
  rightJaw.add(roundedBox(0.08, 0.036, 0.038, machined, [0.118, -0.027, 0], undefined, 0.005));
  rightJaw.add(sidePlate(armDimensions.gripperLength, 0.032, 0.014, amberAnodized, [
    { x: 0.032, r: 0.006 },
    { x: 0.094, r: 0.006 }
  ], [0.136, -0.028, 0]));
  rightJaw.add(roundedBox(0.074, 0.022, 0.032, rubber, [armDimensions.gripperLength + 0.176, -0.016, 0], undefined, 0.004));

  group.add(carriage, leftJaw, rightJaw);
  return cast(group);
}

function createControllerStackGroup() {
  const group = new THREE.Group();
  group.add(roundedBox(0.165, 0.012, 0.125, darkAnodized, [0, -0.01, 0], undefined, 0.006));
  group.add(roundedBox(0.145, 0.006, 0.105, pcb, [0, 0.004, 0], undefined, 0.003));
  addBoardComponents(group, 0.017);
  group.add(roundedBox(0.046, 0.014, 0.036, satinBlack, [-0.041, 0.024, -0.012], undefined, 0.004));
  group.add(roundedBox(0.072, 0.018, 0.021, brass, [0.026, 0.025, 0.043], undefined, 0.003));
  group.add(cylinder(0.026, 0.026, 0.014, satinBlack, 48, [0.054, 0.027, -0.028]));
  for (let i = 0; i < 4; i += 1) {
    group.add(roundedBox(0.007, 0.004, 0.007, i % 2 ? tealAnodized : amberAnodized, [-0.065 + i * 0.012, 0.026, 0.044], undefined, 0.002));
  }
  addStandoffs(group, [-0.062, 0.062], 0.087, 0.0045);
  return cast(group);
}

function createMotorDriverGroup() {
  const group = new THREE.Group();
  group.add(roundedBox(0.108, 0.006, 0.074, pcb, [0, 0, 0], undefined, 0.003));
  group.add(roundedBox(0.083, 0.031, 0.022, tealAnodized, [0.006, 0.021, -0.018], undefined, 0.003));
  for (let i = 0; i < 6; i += 1) {
    group.add(roundedBox(0.008, 0.041, 0.024, darkAnodized, [-0.03 + i * 0.012, 0.04, -0.018], undefined, 0.002));
  }
  for (let i = 0; i < 3; i += 1) {
    group.add(cylinder(0.008, 0.008, 0.022, satinBlack, 32, [-0.036 + i * 0.022, 0.02, 0.026]));
    group.add(roundedBox(0.017, 0.012, 0.015, brass, [0.034 + i * 0.017, 0.012, 0.028], undefined, 0.002));
  }
  group.add(roundedBox(0.028, 0.012, 0.018, plastic, [-0.041, 0.012, -0.032], undefined, 0.002));
  return cast(group);
}

function createPowerSupplyGroup() {
  const group = new THREE.Group();
  group.add(roundedBox(0.16, 0.042, 0.098, machined, [0, 0, 0], undefined, 0.006));
  group.add(roundedBox(0.148, 0.008, 0.086, brushedEdge, [0, 0.026, 0], undefined, 0.004));
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      group.add(cylinder(0.0035, 0.0035, 0.004, satinBlack, 14, [-0.056 + col * 0.016, 0.032, -0.028 + row * 0.018]));
    }
  }
  group.add(roundedBox(0.044, 0.022, 0.028, plastic, [-0.049, 0.035, 0.038], undefined, 0.003));
  group.add(roundedBox(0.05, 0.018, 0.028, brass, [0.044, 0.034, 0.038], undefined, 0.003));
  group.add(cylinder(0.022, 0.022, 0.006, satinBlack, 44, [0.052, 0.035, -0.034]));
  return cast(group);
}

function createWiringHarnessGroup() {
  const group = new THREE.Group();
  const bundle = wireCurve([
    new THREE.Vector3(-0.18, 0, -0.03),
    new THREE.Vector3(-0.08, 0.065, 0.038),
    new THREE.Vector3(0.06, 0.035, 0.032),
    new THREE.Vector3(0.17, 0.075, -0.02)
  ], 0.012, cable);
  group.add(bundle);
  for (let i = 0; i < 9; i += 1) {
    group.add(roundedBox(0.026, 0.025, 0.055, plastic, [-0.145 + i * 0.036, 0.012 + Math.sin(i) * 0.006, 0], [0, 0, 0.1 * Math.sin(i)], 0.004));
  }
  group.add(roundedBox(0.043, 0.028, 0.038, brass, [-0.22, 0, -0.034], undefined, 0.004));
  group.add(roundedBox(0.043, 0.028, 0.038, tealAnodized, [0.212, 0.07, -0.024], undefined, 0.004));
  return cast(group);
}

function createLimitSwitchGroup() {
  const group = new THREE.Group();
  group.add(roundedBox(0.052, 0.022, 0.032, satinBlack, [0, 0, 0], undefined, 0.004));
  group.add(roundedBox(0.07, 0.008, 0.018, machined, [-0.006, -0.018, 0], [0, 0, -0.28], 0.003));
  group.add(cylinder(0.01, 0.01, 0.01, brushedEdge, 28, [-0.046, -0.033, 0], axisRotation('z')));
  group.add(roundedBox(0.068, 0.01, 0.046, machined, [0, -0.038, 0], undefined, 0.003));
  group.add(roundedBox(0.026, 0.016, 0.02, brass, [0.041, 0.002, 0], undefined, 0.002));
  return cast(group);
}

function createEncoderGroup() {
  const group = new THREE.Group();
  group.add(cylinder(0.033, 0.033, 0.008, amberAnodized, 64, [-0.035, 0, 0], axisRotation('z')));
  group.add(cylinder(0.021, 0.021, 0.012, satinBlack, 64, [-0.035, 0, 0], axisRotation('z')));
  group.add(roundedBox(0.055, 0.006, 0.035, pcb, [0.035, 0, 0], undefined, 0.003));
  group.add(roundedBox(0.015, 0.011, 0.014, satinBlack, [0.028, 0.008, 0], undefined, 0.002));
  group.add(roundedBox(0.022, 0.012, 0.014, brass, [0.061, 0.008, 0], undefined, 0.002));
  addBolt(group, [0.012, 0.007, -0.012], 'y', 0.0035);
  addBolt(group, [0.012, 0.007, 0.012], 'y', 0.0035);
  return cast(group);
}

export function createRobotArm(): RobotModel {
  const root = new THREE.Group();
  const base = createBaseGroup();
  const turntablePivot = new THREE.Group();
  const turntable = createTurntableGroup();
  const shoulderMount = new THREE.Group();
  const shoulder = createShoulderGroup();
  const shoulderPivot = new THREE.Group();
  const upperArm = createUpperArmGroup();
  const elbowPivot = new THREE.Group();
  const elbow = createElbowGroup();
  const forearm = createForearmGroup();
  const wristPitchPivot = new THREE.Group();
  const wrist = createWristGroup();
  const wristRollPivot = new THREE.Group();
  const gripper = createGripperGroup();
  const toolPoint = new THREE.Object3D();

  const controllerStack = createControllerStackGroup();
  const motorDriver = createMotorDriverGroup();
  const powerSupply = createPowerSupplyGroup();
  const wiringHarness = createWiringHarnessGroup();
  const limitSwitch = createLimitSwitchGroup();
  const encoder = createEncoderGroup();

  const parts: Record<PartId, THREE.Group> = {
    base,
    turntable,
    shoulder,
    upperArm,
    elbow,
    forearm,
    wrist,
    gripper,
    controllerStack,
    motorDriver,
    powerSupply,
    wiringHarness,
    limitSwitch,
    encoder
  };

  root.add(base);
  turntablePivot.position.y = armDimensions.baseHeight + 0.08;
  root.add(turntablePivot);
  turntablePivot.add(turntable);

  shoulderMount.position.y = armDimensions.shoulderHeight - turntablePivot.position.y;
  turntablePivot.add(shoulderMount);
  shoulderMount.add(shoulder);
  shoulderMount.add(shoulderPivot);
  shoulderPivot.add(upperArm);

  elbowPivot.position.x = armDimensions.upperArmLength;
  shoulderPivot.add(elbowPivot);
  elbowPivot.add(elbow);
  elbowPivot.add(forearm);

  wristPitchPivot.position.x = armDimensions.forearmLength;
  elbowPivot.add(wristPitchPivot);
  wristPitchPivot.add(wrist);

  wristRollPivot.position.x = armDimensions.wristLength;
  wristPitchPivot.add(wristRollPivot);
  wristRollPivot.add(gripper);

  toolPoint.position.x = armDimensions.toolCenterOffset;
  wristRollPivot.add(toolPoint);

  const update = (joints: JointState) => {
    turntablePivot.rotation.y = THREE.MathUtils.degToRad(joints.base);
    shoulderPivot.rotation.z = THREE.MathUtils.degToRad(joints.shoulder);
    elbowPivot.rotation.z = THREE.MathUtils.degToRad(joints.elbow);
    wristPitchPivot.rotation.z = THREE.MathUtils.degToRad(joints.wristPitch);
    wristRollPivot.rotation.x = THREE.MathUtils.degToRad(joints.wristRoll);

    const spread = THREE.MathUtils.lerp(0.015, 0.073, joints.gripper / 100);
    const leftJaw = gripper.getObjectByName('leftJaw');
    const rightJaw = gripper.getObjectByName('rightJaw');
    if (leftJaw && rightJaw) {
      leftJaw.position.z = spread;
      rightJaw.position.z = -spread;
    }
  };

  update({
    base: 0,
    shoulder: 0,
    elbow: 0,
    wristPitch: 0,
    wristRoll: 0,
    gripper: 40
  });

  return {
    root,
    parts,
    update,
    getToolWorldPosition: (target = new THREE.Vector3()) => toolPoint.getWorldPosition(target)
  };
}

function cloneOnly(part: THREE.Group) {
  const clone = part.clone(true);
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone();
    }
  });
  return clone;
}

export function createPartModel(partId: PartId) {
  const robot = createRobotArm();
  const group = cloneOnly(robot.parts[partId]);
  const box3 = new THREE.Box3().setFromObject(group);
  const center = box3.getCenter(new THREE.Vector3());
  group.position.sub(center);

  if (partId === 'base') group.rotation.y = Math.PI / 8;
  if (partId === 'controllerStack' || partId === 'motorDriver' || partId === 'powerSupply') group.rotation.y = -Math.PI / 8;

  return group;
}

export function createReachEnvelope() {
  const radius = armDimensions.upperArmLength + armDimensions.forearmLength + armDimensions.wristLength;
  const geometry = new THREE.SphereGeometry(radius, 80, 28, 0, Math.PI * 2, 0, Math.PI / 2);
  const reach = new THREE.Mesh(geometry, translucentReach);
  reach.position.y = armDimensions.shoulderHeight;
  reach.renderOrder = -1;
  return reach;
}
