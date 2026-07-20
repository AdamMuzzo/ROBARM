import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assemblyBreakdowns } from './assemblyData';
import { createPartModel } from './robotModel';
import type {
  AssemblyHardwareItem,
  MechanicalPartId,
  PartId,
  PrintedAssemblyComponent,
  ViewMode
} from './types';

const componentLoader = new GLTFLoader();
const componentDracoLoader = new DRACOLoader();
componentDracoLoader.setDecoderPath('/draco/');
componentLoader.setDRACOLoader(componentDracoLoader);

const previewCache = new Map<string, Promise<THREE.Group>>();
const printedPalette = {
  structure: 0xe5d9c7,
  cover: 0x6f8fa3,
  drive: 0xc56b3d,
  fixture: 0x84936c,
  safety: 0xb45449,
  utility: 0x4f817b
} as const;
const printedColor = printedPalette.structure;
const hardwareColor = 0x4f5a5e;
const steelColor = 0xaeb7b9;
const beltColor = 0x1d2326;
const accentColor = 0xf0a13a;

type NormalizedAnchor = { position: [number, number, number]; direction: [number, number, number] };

const assemblyAnchors: Partial<Record<MechanicalPartId, Record<string, NormalizedAnchor>>> = {
  baseLink: {
    'base-main': { position: [0, 0, 0], direction: [-1, 0.15, 0] },
    'base-controller-case': { position: [0.16, -0.08, 0.08], direction: [0.15, 0.05, 1] },
    'base-electronics-lid': { position: [0.08, 0.3, 0], direction: [0, 1, 0.2] },
    'base-fan-cover': { position: [0.28, 0.12, 0.24], direction: [0.35, 0.15, 1] },
    'base-bottom-lid': { position: [0, -0.38, 0], direction: [0, -1, 0] },
    'base-estop-bottom': { position: [-0.34, 0.04, 0.18], direction: [-1, 0, 0.5] },
    'base-estop-top': { position: [-0.34, 0.24, 0.18], direction: [-1, 0.3, 0.5] },
    'base-profile-connectors': { position: [0.36, -0.3, -0.2], direction: [1, -0.2, -0.4] }
  },
  link1: {
    'shoulder-motor-holder': { position: [-0.34, -0.05, 0], direction: [-1, 0, 0] },
    'shoulder-turret': { position: [0.04, 0, 0], direction: [0, 0.2, 1] },
    'shoulder-rotation-shaft': { position: [0, -0.34, 0], direction: [0, -1, 0] },
    'shoulder-j2-limit-cover': { position: [0.25, 0.16, 0.24], direction: [0.5, 0.2, 1] },
    'shoulder-j2-stopper': { position: [0.3, -0.04, 0.08], direction: [1, 0, 0.3] },
    'shoulder-j2-shaft': { position: [0.3, 0.22, 0], direction: [1, 0.15, 0] },
    'shoulder-j2-backplate': { position: [0.38, 0.24, 0], direction: [1, 0.2, 0] },
    'shoulder-j2-cover': { position: [0.43, 0.24, 0], direction: [1, 0.25, 0] },
    'shoulder-j1-belt-cover': { position: [0, 0.12, 0.28], direction: [0, 0.2, 1] },
    'shoulder-j1-wire-cover': { position: [0.16, -0.02, 0.32], direction: [0.2, 0, 1] },
    'shoulder-j1-backplate': { position: [0, -0.24, -0.24], direction: [0, -0.25, -1] }
  },
  link2: {
    'upper-main': { position: [0, 0, 0], direction: [-1, 0.1, 0] },
    'upper-j3-pulley': { position: [0.08, 0.35, 0], direction: [0.15, 1, 0] },
    'upper-motor-pulley': { position: [-0.14, -0.32, 0.06], direction: [-0.2, -1, 0.1] },
    'upper-limit-cover': { position: [-0.2, -0.24, 0.24], direction: [-0.3, -0.15, 1] },
    'upper-wire-cover': { position: [0.24, 0, 0.3], direction: [0.25, 0, 1] },
    'upper-cover': { position: [0.04, 0.08, 0.32], direction: [0, 0.1, 1] }
  },
  link3: {
    'elbow-main': { position: [0, 0, 0], direction: [-1, 0.1, 0] },
    'elbow-limiter': { position: [0.24, -0.1, 0.24], direction: [0.5, -0.1, 1] },
    'elbow-backplate': { position: [0.34, 0.08, 0], direction: [1, 0.1, 0] },
    'elbow-lid2': { position: [0.36, 0.08, 0.16], direction: [1, 0.15, 0.4] },
    'elbow-lid1': { position: [0, 0.05, 0.34], direction: [0, 0.1, 1] }
  },
  link4: {
    'forearm-main': { position: [0, 0, 0], direction: [-1, 0.1, 0] },
    'forearm-pulley48': { position: [0.34, 0.16, 0], direction: [1, 0.25, 0] },
    'forearm-j4-output': { position: [-0.34, 0, 0], direction: [-1, 0, 0] },
    'forearm-electronics-lid': { position: [0.1, -0.2, 0.32], direction: [0.1, -0.1, 1] },
    'forearm-belt-lid': { position: [0, 0.2, 0.34], direction: [0, 0.2, 1] }
  },
  link5: {
    'wrist-main': { position: [0, 0, 0], direction: [1, 0.2, 0.3] }
  },
  link6: {
    'tool-pneumatic-holder': { position: [0, 0, 0.24], direction: [0, 0, 1] },
    'tool-vacuum-holder': { position: [0, 0, 0.24], direction: [0.8, 0.2, 1] },
    'tool-gripper-arms': { position: [0, 0, 0.28], direction: [-0.8, 0.2, 1] },
    'tool-horizontal-custom': { position: [0, 0, 0.24], direction: [1, 0, 0.25] },
    'tool-horizontal-holder': { position: [0, 0, 0.24], direction: [-1, 0, 0.25] }
  }
};

function printedComponentColor(component: PrintedAssemblyComponent) {
  const name = `${component.name} ${component.sourceFile}`.toLowerCase();
  if (name.includes('estop')) return printedPalette.safety;
  if (component.optional) return printedPalette.utility;
  if (/pulley|shaft|backplate/.test(name)) return printedPalette.drive;
  if (/cover|lid/.test(name)) return printedPalette.cover;
  if (/holder|block|limiter|connector/.test(name)) return printedPalette.fixture;
  return printedPalette.structure;
}

function cloneObject(source: THREE.Group) {
  const clone = source.clone(true);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = new THREE.MeshPhysicalMaterial({
      color: printedColor,
      roughness: 0.68,
      metalness: 0.08,
      clearcoat: 0.08,
      clearcoatRoughness: 0.8
    });
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return clone;
}

function loadComponentPreview(file: string) {
  const cached = previewCache.get(file);
  if (cached) return cached.then(cloneObject);
  const request = componentLoader
    .loadAsync(`/models/parol6/components/${file}`)
    .then((gltf) => gltf.scene);
  previewCache.set(file, request);
  return request.then(cloneObject);
}

function createAssemblyReference(partId: MechanicalPartId, mode: ViewMode) {
  return createPartModel(partId, mode).then((root) => {
    const remaps = [
      [new THREE.Color(0xe7edef), new THREE.Color(printedPalette.structure)],
      [new THREE.Color(0xc9d0d2), new THREE.Color(printedPalette.cover)],
      [new THREE.Color(0x747e82), new THREE.Color(printedPalette.drive)],
      [new THREE.Color(0x3d474c), new THREE.Color(printedPalette.fixture)]
    ] as const;
    const source = new THREE.Color();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const colors = object.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
      if (!colors) return;
      for (let index = 0; index < colors.count; index += 1) {
        source.setRGB(colors.getX(index), colors.getY(index), colors.getZ(index));
        const match = remaps.find(([from]) => {
          const red = source.r - from.r;
          const green = source.g - from.g;
          const blue = source.b - from.b;
          return red * red + green * green + blue * blue < 0.00001;
        });
        if (match) colors.setXYZ(index, match[1].r, match[1].g, match[1].b);
      }
      colors.needsUpdate = true;
    });
    return root;
  });
}

function centerAndScale(object: THREE.Object3D, scale = 0.001) {
  object.scale.setScalar(scale);
  object.rotation.x = -Math.PI / 2;
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  object.position.sub(center);
  object.updateMatrixWorld(true);
}

function material(color: number, metalness = 0.62, roughness = 0.42) {
  return new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: 0.08 });
}

function addBolt(group: THREE.Group, index: number) {
  const boltMaterial = material(steelColor, 0.86, 0.24);
  const bolt = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.026, 12), boltMaterial);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.004, 6), boltMaterial.clone());
  head.position.y = 0.015;
  bolt.add(shaft, head);
  bolt.position.x = index * 0.011;
  group.add(bolt);
}

function addBearing(group: THREE.Group, index: number) {
  const bearing = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 10, 28), material(steelColor, 0.9, 0.2));
  bearing.rotation.x = Math.PI / 2;
  bearing.position.x = index * 0.031;
  group.add(bearing);
}

function addCylinder(group: THREE.Group, index: number, color = hardwareColor, radius = 0.01, length = 0.024) {
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), material(color));
  cylinder.rotation.z = Math.PI / 2;
  cylinder.position.x = index * (length + 0.008);
  group.add(cylinder);
}

function createHardwareRepresentative(item: AssemblyHardwareItem) {
  const group = new THREE.Group();
  group.name = item.name;
  const count = Math.min(item.quantity, 4);
  for (let index = 0; index < count; index += 1) {
    if (item.kind === 'bolt') addBolt(group, index);
    else if (item.kind === 'nut' || item.kind === 'insert') {
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 6), material(item.kind === 'insert' ? 0xb18846 : steelColor));
      nut.position.x = index * 0.016;
      group.add(nut);
    } else if (item.kind === 'bearing') addBearing(group, index);
    else if (item.kind === 'belt') {
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0022, 8, 40), material(beltColor, 0.02, 0.84));
      belt.scale.x = 1.55;
      belt.rotation.x = Math.PI / 2;
      belt.position.x = index * 0.06;
      group.add(belt);
    } else if (item.kind === 'pulley') {
      addCylinder(group, index, hardwareColor, 0.013, 0.009);
    } else if (item.kind === 'motor') {
      const motor = new THREE.Group();
      motor.add(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.044), material(0x232a2d, 0.58, 0.46)));
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.014, 16), material(steelColor));
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = 0.029;
      motor.add(shaft);
      motor.position.x = index * 0.045;
      group.add(motor);
    } else if (item.kind === 'gearbox') {
      const gearbox = new THREE.Group();
      gearbox.add(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.034, 0.025), material(0x778185)));
      const output = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.018, 20), material(steelColor));
      output.rotation.x = Math.PI / 2;
      output.position.z = 0.021;
      gearbox.add(output);
      gearbox.position.x = index * 0.05;
      group.add(gearbox);
    } else if (item.kind === 'coupler') addCylinder(group, index, 0x667175, 0.011, 0.026);
    else if (item.kind === 'sensor') addCylinder(group, index, 0x31393c, 0.005, 0.034);
    else if (item.kind === 'switch') {
      const switchBody = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.018), material(0x252c2f, 0.12, 0.7));
      switchBody.position.x = index * 0.035;
      group.add(switchBody);
    } else if (item.kind === 'fan') {
      const fan = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.009, 0.038), material(0x252b2d, 0.08, 0.72));
      fan.position.x = index * 0.05;
      group.add(fan);
    } else if (item.kind === 'controller') {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.006, 0.045), material(0x355c47, 0.16, 0.68));
      board.position.x = index * 0.08;
      group.add(board);
    } else if (item.kind === 'tool') {
      const tool = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.052, 0.025), material(0x727c80));
      tool.position.x = index * 0.04;
      group.add(tool);
    } else addCylinder(group, index, item.kind === 'pneumatic' ? 0xb18846 : hardwareColor, 0.006, 0.022);
  }
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  centerAndScale(group, 1);
  return group;
}

interface DiagramItem {
  object: THREE.Group;
  id: string;
  type: 'printed' | 'hardware';
  origin: THREE.Vector3;
  intermediate: THREE.Vector3;
  target: THREE.Vector3;
  baseScale: number;
  guide: THREE.Line;
  guideColor: number;
  motionOpacity: number;
  order: number;
  baseColors: Map<THREE.Material, THREE.Color>;
}

export interface PartDiagramModel {
  root: THREE.Group;
  assembledFramingSize: number;
  framingSize: number;
  setExplodedProgress: (progress: number) => void;
  setSelectedComponent: (componentId: string | null) => void;
}

function collectBaseColors(object: THREE.Object3D) {
  const colors = new Map<THREE.Material, THREE.Color>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((entry) => {
      const meshMaterial = entry as THREE.MeshStandardMaterial;
      if (meshMaterial.color) colors.set(entry, meshMaterial.color.clone());
    });
  });
  return colors;
}

function setObjectOpacity(object: THREE.Object3D, opacity: number) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((entry) => {
      entry.transparent = opacity < 0.999;
      entry.opacity = opacity;
      entry.depthWrite = opacity > 0.4;
      entry.needsUpdate = true;
    });
    child.castShadow = opacity > 0.75;
  });
}

function createGuideLine(color: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthTest: false
  });
  const line = new THREE.Line(geometry, lineMaterial);
  line.renderOrder = 3;
  return line;
}

function updateGuideLine(line: THREE.Line, start: THREE.Vector3, end: THREE.Vector3) {
  const position = line.geometry.getAttribute('position') as THREE.BufferAttribute;
  position.setXYZ(0, start.x, start.y, start.z);
  position.setXYZ(1, end.x, end.y, end.z);
  position.needsUpdate = true;
}

function applySelection(items: DiagramItem[], selected: PrintedAssemblyComponent | null, mode: ViewMode) {
  const relatedHardware = new Set(selected?.hardwareIds ?? []);
  items.forEach((item) => {
    const selectedPrinted = selected?.id === item.id;
    const related = item.type === 'hardware' && relatedHardware.has(item.id);
    const dimmed = Boolean(selected) && !selectedPrinted && !related;
    item.baseColors.forEach((color, entry) => {
      const meshMaterial = entry as THREE.MeshStandardMaterial;
      meshMaterial.color.copy(selectedPrinted ? new THREE.Color(accentColor) : color);
    });
    const selectionOpacity = dimmed ? 0.08 : mode === 'xray' ? 0.48 : 1;
    setObjectOpacity(item.object, item.motionOpacity * selectionOpacity);
    const guideMaterial = item.guide.material as THREE.LineBasicMaterial;
    guideMaterial.color.setHex(selectedPrinted ? accentColor : item.guideColor);
    guideMaterial.opacity = item.motionOpacity * (dimmed ? 0.04 : item.type === 'printed' ? 0.62 : 0.14);
    guideMaterial.needsUpdate = true;
  });
}

export async function createPartDiagramModel(partId: PartId, mode: ViewMode): Promise<PartDiagramModel> {
  const breakdown = assemblyBreakdowns[partId as MechanicalPartId];
  if (!breakdown) {
    const root = await createPartModel(partId, mode);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    return {
      root,
      assembledFramingSize: Math.max(size.x, size.y, size.z, 0.05),
      framingSize: Math.max(size.x, size.y, size.z, 0.05),
      setExplodedProgress: () => undefined,
      setSelectedComponent: () => undefined
    };
  }

  const root = new THREE.Group();
  const assembled = await createAssemblyReference(partId as MechanicalPartId, mode);
  root.add(assembled);
  const assembledMaterials: THREE.Material[] = [];
  assembled.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    assembledMaterials.push(...(Array.isArray(object.material) ? object.material : [object.material]));
  });

  const printedObjects = await Promise.all(breakdown.components.map(async (entry) => {
    const preview = await loadComponentPreview(entry.previewFile);
    centerAndScale(preview);
    const object = new THREE.Group();
    object.add(preview);
    object.name = entry.name;
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const meshMaterial = child.material as THREE.MeshPhysicalMaterial;
      meshMaterial.color.setHex(printedComponentColor(entry));
      meshMaterial.roughness = 0.56;
      meshMaterial.metalness = 0.05;
      meshMaterial.clearcoat = 0.16;
      meshMaterial.clearcoatRoughness = 0.72;
    });
    root.add(object);
    return { entry, object };
  }));

  const hardwareObjects = breakdown.hardware.map((entry) => {
    const preview = createHardwareRepresentative(entry);
    const object = new THREE.Group();
    object.add(preview);
    object.name = entry.name;
    root.add(object);
    return { entry, object };
  });

  const allObjects = [...printedObjects.map(({ object }) => object), ...hardwareObjects.map(({ object }) => object)];
  assembled.updateMatrixWorld(true);
  const assemblyBounds = new THREE.Box3().setFromObject(assembled);
  const assemblySize = assemblyBounds.getSize(new THREE.Vector3());
  const assemblyMax = Math.max(assemblySize.x, assemblySize.y, assemblySize.z, 0.08);
  const maxObjectSize = allObjects.reduce((maximum, object) => {
    const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    return Math.max(maximum, size.x, size.y, size.z);
  }, 0.07);
  const cell = THREE.MathUtils.clamp(maxObjectSize * 1.2, 0.08, 0.19);
  const columns = Math.min(7, Math.max(4, Math.ceil(Math.sqrt(allObjects.length * 1.45))));
  const rows = Math.ceil(allObjects.length / columns);
  const items: DiagramItem[] = [];
  const anchorDefinitions = assemblyAnchors[partId as MechanicalPartId] ?? {};
  const componentOrigins = new Map<string, THREE.Vector3>();
  const componentDirections = new Map<string, THREE.Vector3>();

  const resolveAnchor = (id: string, index: number) => {
    const fallbackAngle = (index / Math.max(1, printedObjects.length)) * Math.PI * 2;
    const definition = anchorDefinitions[id] ?? {
      position: [0, 0, 0] as [number, number, number],
      direction: [Math.cos(fallbackAngle), 0.25, Math.sin(fallbackAngle)] as [number, number, number]
    };
    const origin = new THREE.Vector3(
      definition.position[0] * assemblySize.x,
      definition.position[1] * assemblySize.y,
      definition.position[2] * assemblySize.z
    );
    const direction = new THREE.Vector3(...definition.direction).normalize();
    return { origin, direction };
  };

  printedObjects.forEach(({ entry, object }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const objectHeight = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).y;
    const { origin, direction } = resolveAnchor(entry.id, index);
    const guideColor = printedComponentColor(entry);
    const guide = createGuideLine(guideColor);
    root.add(guide);
    componentOrigins.set(entry.id, origin);
    componentDirections.set(entry.id, direction);
    items.push({
      object,
      id: entry.id,
      type: 'printed',
      origin,
      intermediate: origin.clone().addScaledVector(direction, Math.max(assemblyMax * 0.58, cell * 0.72)),
      target: new THREE.Vector3((column - (columns - 1) / 2) * cell, objectHeight / 2 + 0.006, (row - (rows - 1) / 2) * cell),
      baseScale: 1,
      guide,
      guideColor,
      motionOpacity: 0,
      order: index,
      baseColors: collectBaseColors(object)
    });
  });
  hardwareObjects.forEach(({ entry, object }, hardwareIndex) => {
    const index = printedObjects.length + hardwareIndex;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const objectHeight = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).y;
    const relatedComponents = breakdown.components.filter((component) => component.hardwareIds.includes(entry.id));
    const origin = relatedComponents.reduce(
      (sum, component) => sum.add(componentOrigins.get(component.id) ?? new THREE.Vector3()),
      new THREE.Vector3()
    ).multiplyScalar(1 / Math.max(1, relatedComponents.length));
    const direction = relatedComponents.reduce(
      (sum, component) => sum.add(componentDirections.get(component.id) ?? new THREE.Vector3(0, 1, 0)),
      new THREE.Vector3()
    ).normalize();
    if (direction.lengthSq() < 0.01) direction.set(0, 1, 0);
    const guide = createGuideLine(hardwareColor);
    root.add(guide);
    items.push({
      object,
      id: entry.id,
      type: 'hardware',
      origin,
      intermediate: origin.clone().addScaledVector(direction, Math.max(assemblyMax * 0.72, cell * 0.86)),
      target: new THREE.Vector3((column - (columns - 1) / 2) * cell, objectHeight / 2 + 0.006, (row - (rows - 1) / 2) * cell),
      baseScale: 1,
      guide,
      guideColor: hardwareColor,
      motionOpacity: 0,
      order: index,
      baseColors: collectBaseColors(object)
    });
  });

  let currentSelection: PrintedAssemblyComponent | null = null;
  let currentProgress = 0;
  const setExplodedProgress = (value: number) => {
    currentProgress = THREE.MathUtils.clamp(value, 0, 1);
    const eased = THREE.MathUtils.smootherstep(currentProgress, 0, 1);
    assembled.visible = true;
    assembledMaterials.forEach((entry) => {
      entry.transparent = currentProgress > 0.001 || mode === 'xray';
      entry.opacity = mode === 'xray' ? 0.12 : 1 - eased * 0.86;
      entry.depthWrite = currentProgress < 0.28 && mode !== 'xray';
      entry.needsUpdate = true;
    });
    items.forEach((item) => {
      const delay = item.type === 'hardware' ? 0.075 + item.order * 0.0025 : item.order * 0.008;
      const localProgress = THREE.MathUtils.clamp((currentProgress - delay) / Math.max(0.01, 1 - delay), 0, 1);
      const emergence = THREE.MathUtils.smoothstep(localProgress, 0, 0.14);
      const release = THREE.MathUtils.smootherstep(localProgress, 0, 0.58);
      const staging = THREE.MathUtils.smootherstep(localProgress, 0.36, 1);
      item.object.visible = emergence > 0.001;
      item.object.position.lerpVectors(item.origin, item.intermediate, release).lerp(item.target, staging);
      item.object.scale.setScalar(item.baseScale * (0.82 + emergence * 0.18));
      item.motionOpacity = emergence;
      item.guide.visible = emergence > 0.02;
      updateGuideLine(item.guide, item.origin, item.object.position);
    });
    applySelection(items, currentSelection, mode);
  };

  setExplodedProgress(0);
  return {
    root,
    assembledFramingSize: Math.max(assemblyMax * 1.48, 0.16),
    framingSize: Math.max(columns * cell, rows * cell, 0.25),
    setExplodedProgress,
    setSelectedComponent: (componentId) => {
      currentSelection = breakdown.components.find((entry) => entry.id === componentId) ?? null;
      applySelection(items, currentSelection, mode);
      setExplodedProgress(currentProgress);
    }
  };
}
