import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { JOINTS, stepsToDegrees } from '../core/hardware';

interface Parol6ViewportProps {
  positions: readonly number[];
  sensorStates?: readonly number[] | null;
  selectedJoint?: number | null;
  onModelStatus?: (status: 'loading' | 'ready' | 'error') => void;
  onCollisionChange?: (collision: boolean) => void;
}

type Vec3 = [number, number, number];

const JOINT_DEFINITIONS: Array<{ origin: Vec3; rpy: Vec3; axisSign: 1 | -1 }> = [
  { origin: [0, 0, 0], rpy: [0, 0, 0], axisSign: 1 },
  { origin: [0.0234207210610375, 0, 0.1105], rpy: [-Math.PI / 2, 0, 0], axisSign: 1 },
  { origin: [0, -0.18, 0], rpy: [Math.PI, 0, -Math.PI / 2], axisSign: -1 },
  { origin: [0.0435, 0, 0], rpy: [Math.PI / 2, 0, Math.PI], axisSign: -1 },
  { origin: [0, 0, -0.17635], rpy: [-Math.PI / 2, 0, 0], axisSign: -1 },
  { origin: [0, 0, 0], rpy: [Math.PI / 2, 0, 0], axisSign: -1 }
];

function setUrdfOrigin(group: THREE.Group, position: Vec3, rpy: Vec3) {
  group.position.set(...position);
  const [roll, pitch, yaw] = rpy;
  const matrix = new THREE.Matrix4()
    .makeRotationZ(yaw)
    .multiply(new THREE.Matrix4().makeRotationY(pitch))
    .multiply(new THREE.Matrix4().makeRotationX(roll));
  group.quaternion.setFromRotationMatrix(matrix);
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

export function Parol6Viewport({ positions, sensorStates, selectedJoint, onModelStatus, onCollisionChange }: Parol6ViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef(positions);
  const sensorsRef = useRef(sensorStates);
  const selectedJointRef = useRef(selectedJoint);
  const statusCallbackRef = useRef(onModelStatus);
  const collisionCallbackRef = useRef(onCollisionChange);
  positionsRef.current = positions;
  sensorsRef.current = sensorStates;
  selectedJointRef.current = selectedJoint;
  statusCallbackRef.current = onModelStatus;
  collisionCallbackRef.current = onCollisionChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let frameId = 0;
    statusCallbackRef.current?.('loading');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101210);
    scene.fog = new THREE.Fog(0x101210, 0.8, 1.5);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 10);
    camera.position.set(0.7, 0.5, 0.55);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.21, 0);
    controls.enableDamping = true;
    controls.minDistance = 0.28;
    controls.maxDistance = 1.4;
    controls.maxPolarAngle = Math.PI * 0.9;

    scene.add(new THREE.HemisphereLight(0xf4f0e5, 0x30352f, 2.1));
    const key = new THREE.DirectionalLight(0xfff4d6, 3.2);
    key.position.set(0.45, 0.8, 0.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x181b18, roughness: 0.94, metalness: 0.02 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.56, 64), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(1.1, 22, 0x454b44, 0x292d29);
    grid.position.y = 0.0005;
    scene.add(grid);

    const robotRoot = new THREE.Group();
    robotRoot.rotation.x = -Math.PI / 2;
    scene.add(robotRoot);
    const pivots: THREE.Group[] = [];
    const linkMeshes: THREE.Mesh[] = [];
    const sensorMarkers: THREE.Mesh[] = [];
    const loader = new STLLoader();
    let parent = robotRoot;

    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xd7d8d1, roughness: 0.66, metalness: 0.12 });
    const linkMaterials = Array.from({ length: 6 }, () => new THREE.MeshStandardMaterial({ color: 0xc5c8c1, roughness: 0.58, metalness: 0.16 }));
    const sensorOffMaterial = new THREE.MeshBasicMaterial({ color: 0x5f665e });
    const sensorOnMaterial = new THREE.MeshBasicMaterial({ color: 0xe8a72c });
    const collisionMaterial = new THREE.MeshBasicMaterial({ color: 0xd94a3a, transparent: true, opacity: 0.72 });

    const modelBase = `${import.meta.env.BASE_URL}models/parol6/`;
    Promise.all(['base_link.stl', 'L1.stl', 'L2.stl', 'L3.stl', 'L4.stl', 'L5.stl', 'L6.stl'].map((file) => loader.loadAsync(`${modelBase}${file}`)))
      .then((geometries) => {
        if (cancelled) return;
        geometries.forEach((geometry) => geometry.computeVertexNormals());
        const base = new THREE.Mesh(geometries[0], baseMaterial);
        base.castShadow = true;
        base.receiveShadow = true;
        robotRoot.add(base);
        linkMeshes.push(base);

        JOINT_DEFINITIONS.forEach((definition, index) => {
          const origin = new THREE.Group();
          setUrdfOrigin(origin, definition.origin, definition.rpy);
          parent.add(origin);
          const pivot = new THREE.Group();
          origin.add(pivot);
          const mesh = new THREE.Mesh(geometries[index + 1], linkMaterials[index]);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          pivot.add(mesh);
          const marker = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), sensorOffMaterial);
          marker.position.set(0.014, 0.014, 0.014);
          origin.add(marker);
          pivots.push(pivot);
          linkMeshes.push(mesh);
          sensorMarkers.push(marker);
          parent = pivot;
        });
        statusCallbackRef.current?.('ready');
      })
      .catch(() => statusCallbackRef.current?.('error'));

    const collisionPlate = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.175, 64), collisionMaterial);
    collisionPlate.rotation.x = -Math.PI / 2;
    collisionPlate.position.y = 0.002;
    collisionPlate.visible = false;
    scene.add(collisionPlate);

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    observer.observe(host);

    let lastSignature = '';
    let lastCollision = false;
    const render = () => {
      const signature = `${positionsRef.current.join(',')}|${sensorsRef.current?.join(',') ?? ''}|${selectedJointRef.current ?? ''}`;
      if (signature !== lastSignature && pivots.length === 6) {
        lastSignature = signature;
        pivots.forEach((pivot, index) => {
          pivot.rotation.z = THREE.MathUtils.degToRad(stepsToDegrees(positionsRef.current[index] ?? 0, JOINTS[index])) * JOINT_DEFINITIONS[index].axisSign;
          linkMaterials[index].color.setHex(selectedJointRef.current === index ? 0xe8a72c : 0xc5c8c1);
          sensorMarkers[index].material = sensorsRef.current?.[JOINTS[index].stopPort] ? sensorOnMaterial : sensorOffMaterial;
        });
        scene.updateMatrixWorld(true);
        const boxes = linkMeshes.map((mesh) => new THREE.Box3().setFromObject(mesh).expandByScalar(-0.006));
        let collision = boxes.some((box, index) => index >= 3 && box.min.y < -0.01);
        for (let first = 1; first < boxes.length && !collision; first += 1) {
          for (let second = first + 3; second < boxes.length; second += 1) {
            if (boxes[first].intersectsBox(boxes[second])) {
              collision = true;
              break;
            }
          }
        }
        collisionPlate.visible = collision;
        if (collision !== lastCollision) {
          lastCollision = collision;
          collisionCallbackRef.current?.(collision);
        }
      }
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="size-full min-h-72 overflow-hidden bg-canvas" role="img" aria-label="Interactive 3D PAROL6 robot simulator" />;
}
