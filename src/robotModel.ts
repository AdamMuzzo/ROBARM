import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { createGeneratedElectronicModel } from './electronicModels';
import { mechanicalPartIds, partById } from './robotData';
import { createRobotInternalDetails } from './robotInternals';
import type {
  ElectronicPartId,
  ExplodedPieceCategory,
  ExplodedPieceInfo,
  JointKey,
  JointState,
  MechanicalPartId,
  PartId,
  RobotCollisionReport,
  ViewMode
} from './types';

type Vec3 = [number, number, number];

interface JointDefinition {
  key: JointKey;
  partId: MechanicalPartId;
  origin: Vec3;
  rpy: Vec3;
  axisSign: 1 | -1;
}

const jointDefinitions: JointDefinition[] = [
  { key: 'j1', partId: 'link1', origin: [0, 0, 0], rpy: [0, 0, 0], axisSign: 1 },
  {
    key: 'j2',
    partId: 'link2',
    origin: [0.0234207210610375, 0, 0.1105],
    rpy: [-Math.PI / 2, 0, 0],
    axisSign: 1
  },
  {
    key: 'j3',
    partId: 'link3',
    origin: [0, -0.18, 0],
    rpy: [Math.PI, 0, -Math.PI / 2],
    axisSign: -1
  },
  {
    key: 'j4',
    partId: 'link4',
    origin: [0.0435, 0, 0],
    rpy: [Math.PI / 2, 0, Math.PI],
    axisSign: -1
  },
  {
    key: 'j5',
    partId: 'link5',
    origin: [0, 0, -0.17635],
    rpy: [-Math.PI / 2, 0, 0],
    axisSign: -1
  },
  {
    key: 'j6',
    partId: 'link6',
    origin: [0, 0, 0],
    rpy: [Math.PI / 2, 0, 0],
    axisSign: -1
  }
];

const meshMaterials: Record<MechanicalPartId, { roughness: number; metalness: number }> = {
  baseLink: { roughness: 0.68, metalness: 0.08 },
  link1: { roughness: 0.58, metalness: 0.16 },
  link2: { roughness: 0.6, metalness: 0.14 },
  link3: { roughness: 0.63, metalness: 0.1 },
  link4: { roughness: 0.58, metalness: 0.14 },
  link5: { roughness: 0.54, metalness: 0.2 },
  link6: { roughness: 0.43, metalness: 0.38 }
};

const mechanicalPalette = {
  petgWhite: 0xe7edef,
  petgSecondary: 0xc9d0d2,
  stepperBlack: 0x20262a,
  gearbox: 0x747e82,
  anodized: 0x3d474c,
  steel: 0xb8c0c2,
  darkSteel: 0x535e63,
  brass: 0xb58b43,
  rubber: 0x151a1d,
  controlRed: 0xc33b2f,
  controlGreen: 0x718d3f
} as const;

type MechanicalColor = keyof typeof mechanicalPalette;

const sectionNames = ['Base', 'J1 base drive', 'J2 shoulder', 'J3 elbow', 'J4 forearm roll', 'J5 wrist pitch', 'J6 tool flange', 'Control electronics'];

const mechanicalRoleInfo: Record<MechanicalColor, {
  name: string;
  category: ExplodedPieceCategory;
  material: string;
  description: string;
}> = {
  petgWhite: {
    name: 'printed structural shell',
    category: 'printed structure',
    material: 'White PETG',
    description: 'A load-carrying printed shell from the official PAROL6 link assembly. Its ribs, bearing seats, cable passages, and fastener bosses locate the surrounding drive hardware while keeping the arm lightweight.'
  },
  petgSecondary: {
    name: 'printed cover or spacer',
    category: 'printed structure',
    material: 'Natural-gray PETG',
    description: 'A secondary printed cover, motor holder, or spacing feature. It closes the link around the transmission and keeps wiring clear of rotating shafts and timing belts.'
  },
  stepperBlack: {
    name: 'stepper motor body',
    category: 'drive component',
    material: 'Black-coated steel and copper windings',
    description: 'Part of the axis stepper motor assembly. The square laminated stator produces controlled angular motion, while the motor shaft couples into a gearbox or timing-pulley stage.'
  },
  gearbox: {
    name: 'planetary gearbox',
    category: 'drive component',
    material: 'Machined aluminum and hardened steel gears',
    description: 'A compact planetary reduction gearbox that multiplies motor torque and improves joint holding force. Its output carrier is centered on the joint axis and bolted to the adjoining link hardware.'
  },
  anodized: {
    name: 'machined hub or mounting plate',
    category: 'drive component',
    material: 'Anodized aluminum',
    description: 'A machined alignment and torque-transfer part used around a joint output, pulley, or tool flange. The rigid aluminum interface keeps the rotating axis concentric under load.'
  },
  steel: {
    name: 'bearing, shaft, or fastener',
    category: 'bearing and hardware',
    material: 'Zinc-plated or bearing steel',
    description: 'Precision metal hardware from the official link mesh. Depending on its position this solid represents a bearing race, shoulder shaft, spacer, washer, or metric fastener that supports and clamps the joint assembly.'
  },
  darkSteel: {
    name: 'steel bracket or coupler',
    category: 'bearing and hardware',
    material: 'Dark-finished steel',
    description: 'A rigid steel coupler, bracket, or retained shaft component. It carries torque between adjacent transmission parts and maintains their alignment inside the printed structure.'
  },
  brass: {
    name: 'pneumatic fitting',
    category: 'pneumatics',
    material: 'Machined brass',
    description: 'A threaded push-fit pneumatic connector at the wrist. It seals and retains the blue polyurethane tube while allowing the line to be serviced independently from the printed link.'
  },
  rubber: {
    name: 'belt, seal, or resilient insert',
    category: 'drive component',
    material: 'Reinforced elastomer',
    description: 'A compliant transmission or isolation part. In the drive train it provides positive belt engagement; around covers and the tool end it can provide grip, strain relief, or vibration isolation.'
  },
  controlRed: {
    name: 'emergency-stop control',
    category: 'controls',
    material: 'Red molded polymer and metal contacts',
    description: 'The prominent safety control on the base. Pressing it interrupts the enabled motion system so the arm cannot continue commanded movement until the safety circuit is deliberately reset.'
  },
  controlGreen: {
    name: 'illuminated power control',
    category: 'controls',
    material: 'Green translucent polymer and metal contacts',
    description: 'The base power/status control connected to the controller board. Its illuminated cap gives a clear local indication of the robot electronics state.'
  }
};

// Components are ranked by triangle count. The official STLs contain disconnected
// solids for motors, reducers, fasteners, fittings, and printed shells, but no color data.
const componentColorMap: Record<MechanicalPartId, MechanicalColor[]> = {
  baseLink: [
    'controlRed', 'controlGreen', 'petgWhite', 'anodized', 'steel', 'darkSteel',
    'darkSteel', 'steel', 'steel', 'rubber', 'steel', 'steel'
  ],
  link1: [
    'steel', 'steel', 'steel', 'steel', 'petgWhite', 'stepperBlack', 'stepperBlack',
    'steel', 'steel', 'steel', 'steel', 'steel', 'steel', 'steel', 'steel', 'gearbox',
    'petgSecondary', 'petgWhite', 'petgSecondary', 'petgSecondary', 'steel', 'steel',
    'steel', 'steel', 'steel', 'steel', 'steel', 'steel', 'steel', 'steel', 'steel',
    'steel', 'steel'
  ],
  link2: [
    'steel', 'steel', 'petgWhite', 'anodized', 'stepperBlack', 'steel', 'steel',
    'steel', 'steel', 'gearbox', 'darkSteel', 'petgSecondary', 'steel', 'steel',
    'steel', 'steel', 'petgWhite', 'steel'
  ],
  link3: [
    'petgWhite', 'gearbox', 'steel', 'steel', 'steel', 'steel', 'steel', 'steel',
    'steel', 'steel', 'steel', 'darkSteel'
  ],
  link4: [
    'petgWhite', 'brass', 'brass', 'darkSteel', 'petgSecondary', 'petgWhite',
    'steel', 'steel', 'rubber'
  ],
  link5: [
    'petgWhite', 'rubber', 'rubber', 'anodized', 'darkSteel', 'steel', 'steel',
    'steel', 'steel', 'gearbox', 'steel'
  ],
  link6: ['anodized', 'darkSteel', 'darkSteel', 'anodized', 'anodized', 'rubber', 'rubber']
};

interface RankedComponents {
  rankByTriangle: Int32Array;
  componentCount: number;
}

function rankGeometryComponents(geometry: THREE.BufferGeometry): RankedComponents {
  const positions = geometry.getAttribute('position');
  const triangleCount = positions.count / 3;
  const parents = new Int32Array(triangleCount);
  for (let index = 0; index < triangleCount; index += 1) parents[index] = index;

  const find = (value: number) => {
    let root = value;
    while (parents[root] !== root) root = parents[root];
    while (parents[value] !== value) {
      const next = parents[value];
      parents[value] = root;
      value = next;
    }
    return root;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parents[rootB] = rootA;
  };

  const firstTriangleByVertex = new Map<string, number>();
  for (let index = 0; index < positions.count; index += 1) {
    const key = `${Math.round(positions.getX(index) * 100_000)},${Math.round(positions.getY(index) * 100_000)},${Math.round(positions.getZ(index) * 100_000)}`;
    const triangle = Math.floor(index / 3);
    const existing = firstTriangleByVertex.get(key);
    if (existing === undefined) firstTriangleByVertex.set(key, triangle);
    else union(triangle, existing);
  }

  const sizes = new Map<number, number>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = find(triangle);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  const rankedRoots = [...sizes.keys()].sort((a, b) => (sizes.get(b) ?? 0) - (sizes.get(a) ?? 0));
  const rankByRoot = new Map(rankedRoots.map((root, rank) => [root, rank]));
  const rankByTriangle = new Int32Array(triangleCount);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    rankByTriangle[triangle] = rankByRoot.get(find(triangle)) ?? 0;
  }
  return { rankByTriangle, componentCount: rankedRoots.length };
}

function applyRealisticComponentColors(partId: MechanicalPartId, geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute('position');
  const triangleCount = positions.count / 3;
  const { rankByTriangle } = rankGeometryComponents(geometry);
  const colorRoles = componentColorMap[partId];
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const rank = rankByTriangle[triangle];
    const role = colorRoles[rank] ?? 'petgWhite';
    color.setHex(mechanicalPalette[role]);
    for (let corner = 0; corner < 3; corner += 1) color.toArray(colors, (triangle * 3 + corner) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

const geometryCache = new Map<MechanicalPartId, Promise<THREE.BufferGeometry>>();
const gltfCache = new Map<PartId, Promise<THREE.Group>>();
const stlLoader = new STLLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

function meshUrl(partId: MechanicalPartId) {
  return `/models/parol6/${partById[partId].meshFile}`;
}

export function loadPartGeometry(partId: MechanicalPartId) {
  const existing = geometryCache.get(partId);
  if (existing) return existing;

  const request = stlLoader.loadAsync(meshUrl(partId)).then((geometry) => {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    applyRealisticComponentColors(partId, geometry);
    return geometry;
  });
  geometryCache.set(partId, request);
  return request;
}

function createMaterial(partId: MechanicalPartId, mode: ViewMode = 'solid', colorRole?: MechanicalColor) {
  const definition = meshMaterials[partId];
  return new THREE.MeshPhysicalMaterial({
    color: colorRole ? mechanicalPalette[colorRole] : 0xffffff,
    roughness: mode === 'xray' ? 0.34 : definition.roughness,
    metalness: definition.metalness,
    clearcoat: 0.12,
    clearcoatRoughness: 0.72,
    envMapIntensity: 0.72,
    vertexColors: colorRole === undefined,
    transparent: mode === 'xray',
    opacity: mode === 'xray' ? 0.34 : 1,
    side: mode === 'xray' ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: mode !== 'xray'
  });
}

interface ExplodedPiece {
  object: THREE.Object3D;
  originalParent: THREE.Object3D;
  originalPosition: THREE.Vector3;
  originalQuaternion: THREE.Quaternion;
  originalScale: THREE.Vector3;
  startPosition: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
  targetPosition: THREE.Vector3;
  targetQuaternion: THREE.Quaternion;
  label: string;
  section: number;
  rank: number;
  displayWhenAssembled: boolean;
  kind: 'stl' | 'internal';
  info: ExplodedPieceInfo;
}

function createExplodedComponents(
  partId: MechanicalPartId,
  geometry: THREE.BufferGeometry,
  parent: THREE.Object3D,
  section: number
) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const { rankByTriangle, componentCount } = rankGeometryComponents(geometry);
  const componentPositions = Array.from({ length: componentCount }, () => [] as number[]);
  const componentNormals = Array.from({ length: componentCount }, () => [] as number[]);
  const minimums = Array.from({ length: componentCount }, () => new THREE.Vector3(Infinity, Infinity, Infinity));
  const maximums = Array.from({ length: componentCount }, () => new THREE.Vector3(-Infinity, -Infinity, -Infinity));

  for (let triangle = 0; triangle < rankByTriangle.length; triangle += 1) {
    const rank = rankByTriangle[triangle];
    for (let corner = 0; corner < 3; corner += 1) {
      const index = triangle * 3 + corner;
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      componentPositions[rank].push(x, y, z);
      componentNormals[rank].push(normals.getX(index), normals.getY(index), normals.getZ(index));
      minimums[rank].min(new THREE.Vector3(x, y, z));
      maximums[rank].max(new THREE.Vector3(x, y, z));
    }
  }

  return componentPositions.map((values, rank) => {
    const center = minimums[rank].clone().add(maximums[rank]).multiplyScalar(0.5);
    const centered = new Float32Array(values.length);
    for (let index = 0; index < values.length; index += 3) {
      centered[index] = values[index] - center.x;
      centered[index + 1] = values[index + 1] - center.y;
      centered[index + 2] = values[index + 2] - center.z;
    }
    const componentGeometry = new THREE.BufferGeometry();
    componentGeometry.setAttribute('position', new THREE.BufferAttribute(centered, 3));
    componentGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(componentNormals[rank], 3));
    componentGeometry.computeBoundingBox();
    componentGeometry.computeBoundingSphere();
    const role = componentColorMap[partId][rank] ?? 'petgWhite';
    const object = new THREE.Mesh(componentGeometry, createMaterial(partId, 'solid', role));
    object.name = `${partId} component ${rank + 1}`;
    object.position.copy(center);
    object.visible = false;
    object.receiveShadow = true;
    parent.add(object);
    return { object, rank, role };
  });
}

function createMesh(partId: MechanicalPartId, geometry: THREE.BufferGeometry, mode: ViewMode = 'solid') {
  const object = new THREE.Mesh(geometry.clone(), createMaterial(partId, mode));
  object.name = partId;
  object.castShadow = mode === 'solid';
  object.receiveShadow = true;
  return object;
}

function setUrdfOrigin(group: THREE.Group, position: Vec3, rpy: Vec3) {
  group.position.set(...position);
  const [roll, pitch, yaw] = rpy;
  const rotation = new THREE.Matrix4()
    .makeRotationZ(yaw)
    .multiply(new THREE.Matrix4().makeRotationY(pitch))
    .multiply(new THREE.Matrix4().makeRotationX(roll));
  group.quaternion.setFromRotationMatrix(rotation);
}

export interface Parol6Model {
  root: THREE.Group;
  parts: Record<MechanicalPartId, THREE.Object3D>;
  explodedPieceCount: number;
  update: (joints: JointState) => void;
  getToolWorldPosition: (target?: THREE.Vector3) => THREE.Vector3;
  setViewMode: (mode: ViewMode) => void;
  setExplodedProgress: (progress: number) => void;
  setExplodedFocus: (pieceIds: string[] | null) => void;
  setCableRoutesVisible: (visible: boolean) => void;
  getExplodedPickables: () => THREE.Object3D[];
  getExplodedPieceInfos: () => ExplodedPieceInfo[];
  getCollisionReport: () => RobotCollisionReport;
}

function createCableBundle(parent: THREE.Object3D, points: Vec3[]) {
  const group = new THREE.Group();
  group.name = 'service-cable-route';
  group.visible = false;
  const wireColors = [0xd65b22, 0x2d77a5, 0x202426, 0x6d8d44];
  wireColors.forEach((color, index) => {
    const offset = (index - 1.5) * 0.0024;
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x + offset, y, z + Math.sin(index * 1.7) * 0.0012))
    );
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), 0.00125, 6, false),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.02 })
    );
    mesh.castShadow = true;
    group.add(mesh);
  });
  parent.add(group);
  return group;
}

export async function createParol6Model(): Promise<Parol6Model> {
  const loaded = await Promise.all(mechanicalPartIds.map(async (partId) => [partId, await loadPartGeometry(partId)] as const));
  const geometries = Object.fromEntries(loaded) as Record<MechanicalPartId, THREE.BufferGeometry>;

  const root = new THREE.Group();
  root.name = 'PAROL6';

  const urdfFrame = new THREE.Group();
  urdfFrame.name = 'URDF_Z_UP';
  urdfFrame.rotation.x = -Math.PI / 2;
  root.add(urdfFrame);

  const parts = {} as Record<MechanicalPartId, THREE.Object3D>;
  const linkFrames = {} as Record<MechanicalPartId, THREE.Object3D>;
  const base = createMesh('baseLink', geometries.baseLink);
  urdfFrame.add(base);
  parts.baseLink = base;
  linkFrames.baseLink = urdfFrame;

  const pivots = {} as Record<JointKey, THREE.Group>;
  const axisSigns = {} as Record<JointKey, 1 | -1>;
  let parent: THREE.Group = urdfFrame;

  for (const definition of jointDefinitions) {
    const origin = new THREE.Group();
    origin.name = `${definition.key}_origin`;
    setUrdfOrigin(origin, definition.origin, definition.rpy);
    parent.add(origin);

    const pivot = new THREE.Group();
    pivot.name = definition.key;
    origin.add(pivot);

    const link = createMesh(definition.partId, geometries[definition.partId]);
    pivot.add(link);
    parts[definition.partId] = link;
    linkFrames[definition.partId] = pivot;
    pivots[definition.key] = pivot;
    axisSigns[definition.key] = definition.axisSign;
    parent = pivot;
  }

  const explodedPieces: ExplodedPiece[] = [];
  const registerPiece = (
    object: THREE.Object3D,
    label: string,
    section: number,
    rank: number,
    displayWhenAssembled: boolean,
    kind: ExplodedPiece['kind'],
    info: ExplodedPieceInfo
  ) => {
    if (!object.parent) throw new Error(`${label} must be parented before it can be registered.`);
    object.userData.explodedPieceInfo = info;
    explodedPieces.push({
      object,
      originalParent: object.parent,
      originalPosition: object.position.clone(),
      originalQuaternion: object.quaternion.clone(),
      originalScale: object.scale.clone(),
      startPosition: new THREE.Vector3(),
      startQuaternion: new THREE.Quaternion(),
      targetPosition: new THREE.Vector3(),
      targetQuaternion: new THREE.Quaternion(),
      label,
      section,
      rank,
      displayWhenAssembled,
      kind,
      info
    });
  };

  mechanicalPartIds.forEach((partId, section) => {
    createExplodedComponents(partId, geometries[partId], linkFrames[partId], section).forEach(({ object, rank, role }) => {
      const roleInfo = mechanicalRoleInfo[role];
      const label = `${partById[partId].name} — ${roleInfo.name} ${rank + 1}`;
      registerPiece(object, label, section, rank, false, 'stl', {
        id: `${partId}-${rank + 1}`,
        name: label,
        section: sectionNames[section],
        category: roleInfo.category,
        material: roleInfo.material,
        description: roleInfo.description,
        source: partById[partId].sourceFile
      });
    });
  });

  createRobotInternalDetails(linkFrames).forEach((detail, index) => {
    registerPiece(detail.object, detail.label, detail.section, index, detail.visibleWhenAssembled, 'internal', {
      id: `internal-${index + 1}`,
      name: detail.label,
      section: sectionNames[detail.section],
      category: detail.category,
      material: detail.material,
      description: detail.description,
      source: 'PAROL6 build instructions and control-board documentation'
    });
  });

  const cableRoutes = [
    createCableBundle(linkFrames.baseLink, [[-0.055, 0.018, 0.018], [-0.018, 0.014, 0.055], [0.018, 0.006, 0.102]]),
    createCableBundle(linkFrames.link1, [[0.016, 0.018, 0.02], [0.026, 0.01, 0.068], [0.023, 0, 0.108]]),
    createCableBundle(linkFrames.link2, [[0.006, -0.018, 0.012], [0.003, -0.09, 0.015], [0, -0.175, 0.005]]),
    createCableBundle(linkFrames.link3, [[0.002, 0.01, 0.008], [0.021, 0.008, 0.012], [0.041, 0, 0.004]]),
    createCableBundle(linkFrames.link4, [[0.008, 0.01, -0.012], [0.009, 0.008, -0.088], [0.003, 0, -0.171]]),
    createCableBundle(linkFrames.link5, [[0.005, 0.012, 0.018], [0.006, 0.008, -0.018], [0, 0.002, -0.052]]),
    createCableBundle(linkFrames.link6, [[0.006, 0.012, -0.004], [0.008, 0.005, -0.046], [0, 0, -0.094]])
  ];

  const toolPoint = new THREE.Object3D();
  toolPoint.name = 'toolCenterPoint';
  toolPoint.position.set(0, 0, -0.105);
  pivots.j6.add(toolPoint);

  const update = (joints: JointState) => {
    (Object.keys(pivots) as JointKey[]).forEach((key) => {
      pivots[key].rotation.z = THREE.MathUtils.degToRad(joints[key]) * axisSigns[key];
    });
    root.updateMatrixWorld(true);
  };

  let currentViewMode: ViewMode = 'solid';
  let focusedPieceIds: Set<string> | null = null;

  const applyExplodedPresentation = () => {
    explodedPieces.forEach((piece) => {
      applyViewMode(piece.object, currentViewMode);
      const isMatch = !focusedPieceIds || focusedPieceIds.has(piece.info.id);
      if (isMatch) return;
      piece.object.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material.transparent = true;
          material.opacity = 0.08;
          material.depthWrite = false;
          material.needsUpdate = true;
        });
        object.castShadow = false;
      });
    });
  };

  const setViewMode = (mode: ViewMode) => {
    currentViewMode = mode;
    (Object.keys(parts) as MechanicalPartId[]).forEach((partId) => {
      const part = parts[partId];
      if (!(part instanceof THREE.Mesh)) return;
      part.material.dispose();
      part.material = createMaterial(partId, mode);
      part.castShadow = mode === 'solid';
    });
    applyExplodedPresentation();
  };

  let piecesDetached = false;
  const sortedPieces = [...explodedPieces].sort((a, b) => a.section - b.section || a.rank - b.rank);

  const prepareExplosion = () => {
    if (piecesDetached) return;
    root.updateMatrixWorld(true);
    (Object.values(parts) as THREE.Object3D[]).forEach((part) => { part.visible = false; });

    sortedPieces.forEach((piece) => {
      root.attach(piece.object);
      piece.object.visible = true;
      piece.object.castShadow = true;
      piece.startPosition.copy(piece.object.position);
      piece.startQuaternion.copy(piece.object.quaternion);
    });

    const columns = 14;
    const spacingX = 0.115;
    const spacingZ = 0.115;
    let cell = 0;
    let previousSection = -1;
    const cells = sortedPieces.map((piece) => {
      if (previousSection !== -1 && piece.section !== previousSection) cell += 2;
      const assigned = cell;
      cell += 1;
      previousSection = piece.section;
      return assigned;
    });
    const rows = Math.ceil(cell / columns);
    const layoutCenterZ = (rows - 1) * spacingZ * 0.5;
    const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const qYaw = new THREE.Quaternion();

    sortedPieces.forEach((piece, index) => {
      const assigned = cells[index];
      const column = assigned % columns;
      const row = Math.floor(assigned / columns);
      const yaw = ((piece.rank % 5) - 2) * 0.075;
      qYaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      piece.targetQuaternion.copy(qYaw);
      if (piece.kind === 'stl') piece.targetQuaternion.multiply(qFlat);

      const savedPosition = piece.object.position.clone();
      const savedQuaternion = piece.object.quaternion.clone();
      piece.object.position.set(0, 0, 0);
      piece.object.quaternion.copy(piece.targetQuaternion);
      piece.object.updateMatrixWorld(true);
      const targetBounds = new THREE.Box3().setFromObject(piece.object);
      const floorOffset = Number.isFinite(targetBounds.min.y) ? -targetBounds.min.y + 0.006 : 0.02;
      piece.object.position.copy(savedPosition);
      piece.object.quaternion.copy(savedQuaternion);
      piece.targetPosition.set(
        (column - (columns - 1) / 2) * spacingX,
        floorOffset,
        row * spacingZ - layoutCenterZ
      );
    });
    piecesDetached = true;
  };

  const finishReassembly = () => {
    if (!piecesDetached) return;
    sortedPieces.forEach((piece) => {
      piece.originalParent.add(piece.object);
      piece.object.position.copy(piece.originalPosition);
      piece.object.quaternion.copy(piece.originalQuaternion);
      piece.object.scale.copy(piece.originalScale);
      piece.object.visible = piece.displayWhenAssembled;
      piece.object.castShadow = piece.displayWhenAssembled;
    });
    (Object.values(parts) as THREE.Object3D[]).forEach((part) => { part.visible = true; });
    root.updateMatrixWorld(true);
    piecesDetached = false;
  };

  const setExplodedProgress = (value: number) => {
    const progress = THREE.MathUtils.clamp(value, 0, 1);
    if (progress <= 0.0001) {
      finishReassembly();
      return;
    }
    prepareExplosion();
    sortedPieces.forEach((piece, index) => {
      const delay = Math.min(0.6, (index / sortedPieces.length) * 0.54 + piece.section * 0.008);
      const local = THREE.MathUtils.smoothstep(progress, delay, 1);
      piece.object.position.lerpVectors(piece.startPosition, piece.targetPosition, local);
      piece.object.position.y += Math.sin(local * Math.PI) * (0.08 + (piece.section % 3) * 0.018);
      piece.object.quaternion.slerpQuaternions(piece.startQuaternion, piece.targetQuaternion, local);
    });
    root.updateMatrixWorld(true);
  };

  const getCollisionReport = (): RobotCollisionReport => {
    root.updateMatrixWorld(true);
    const boxes = mechanicalPartIds.map((partId) => {
      const box = new THREE.Box3().setFromObject(parts[partId]);
      const size = box.getSize(new THREE.Vector3());
      const inset = new THREE.Vector3(
        Math.min(0.014, size.x * 0.12),
        Math.min(0.014, size.y * 0.12),
        Math.min(0.014, size.z * 0.12)
      );
      box.min.add(inset);
      box.max.sub(inset);
      return box;
    });
    const collisions: string[] = [];
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 2; second < boxes.length; second += 1) {
        if (boxes[first].intersectsBox(boxes[second])) {
          collisions.push(`${partById[mechanicalPartIds[first]].name} / ${partById[mechanicalPartIds[second]].name}`);
        }
      }
    }
    const movingClearances = boxes.slice(2).map((box) => box.min.y * 1000);
    return {
      collisions,
      minimumFloorClearanceMm: movingClearances.length ? Math.min(...movingClearances) : 0
    };
  };

  return {
    root,
    parts,
    explodedPieceCount: explodedPieces.length,
    update,
    setViewMode,
    setExplodedProgress,
    setExplodedFocus: (pieceIds) => {
      focusedPieceIds = pieceIds?.length ? new Set(pieceIds) : null;
      applyExplodedPresentation();
    },
    setCableRoutesVisible: (visible) => cableRoutes.forEach((route) => { route.visible = visible; }),
    getExplodedPickables: () => sortedPieces.map((piece) => piece.object),
    getExplodedPieceInfos: () => sortedPieces.map((piece) => piece.info),
    getCollisionReport,
    getToolWorldPosition: (target = new THREE.Vector3()) => toolPoint.getWorldPosition(target)
  };
}

function cloneScene(source: THREE.Group) {
  const clone = source.clone(true);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return clone;
}

function loadGltfModel(partId: PartId) {
  const existing = gltfCache.get(partId);
  if (existing) return existing;
  const file = partById[partId].meshFile;
  if (!file) throw new Error(`No GLB file is registered for ${partId}.`);
  const request = gltfLoader.loadAsync(`/models/electronics/${file}`).then((gltf) => gltf.scene);
  gltfCache.set(partId, request);
  return request;
}

function applyViewMode(root: THREE.Object3D, mode: ViewMode) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.transparent = mode === 'xray';
      material.opacity = mode === 'xray' ? 0.32 : 1;
      material.depthWrite = mode !== 'xray';
      material.side = mode === 'xray' ? THREE.DoubleSide : THREE.FrontSide;
      material.needsUpdate = true;
    });
    object.castShadow = mode === 'solid';
  });
}

export async function createPartModel(partId: PartId, mode: ViewMode = 'solid') {
  const spec = partById[partId];
  const root = new THREE.Group();
  if (spec.modelType === 'stl') {
    const geometry = await loadPartGeometry(partId as MechanicalPartId);
    const zUpFrame = new THREE.Group();
    zUpFrame.rotation.x = -Math.PI / 2;
    zUpFrame.add(createMesh(partId as MechanicalPartId, geometry, mode));
    root.add(zUpFrame);
  } else if (spec.modelType === 'glb') {
    const zUpFrame = new THREE.Group();
    zUpFrame.rotation.x = -Math.PI / 2;
    zUpFrame.add(cloneScene(await loadGltfModel(partId)));
    root.add(zUpFrame);
  } else {
    root.add(createGeneratedElectronicModel(partId as ElectronicPartId));
  }
  applyViewMode(root, mode);
  root.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.sub(center);
  root.updateMatrixWorld(true);
  return root;
}

export function createReachEnvelope() {
  const geometry = new THREE.SphereGeometry(0.41, 64, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xd45a21,
    transparent: true,
    opacity: 0.08,
    wireframe: true,
    depthWrite: false
  });
  const reach = new THREE.Mesh(geometry, material);
  reach.position.set(0.023, 0.111, 0);
  return reach;
}
