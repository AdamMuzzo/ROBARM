import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createParol6Model, createReachEnvelope } from './robotModel';
import type {
  AssemblyPhase,
  CameraRequest,
  ExplodedPieceInfo,
  JointState,
  RobotCollisionReport,
  ToolPose,
  ViewMode
} from './types';

interface RobotViewportProps {
  joints: JointState;
  showEnvelope: boolean;
  viewMode: ViewMode;
  assemblyTarget: 'assembled' | 'disassembled';
  inspectedPieceId: string | null;
  focusedPieceIds: string[] | null;
  showExplodedLabels: boolean;
  showCableRoutes: boolean;
  cameraRequest: CameraRequest;
  onToolPose: (pose: ToolPose) => void;
  onCollisionReport: (report: RobotCollisionReport) => void;
  onExplodedCatalogReady: (pieces: ExplodedPieceInfo[]) => void;
  onAssemblyPhaseChange: (phase: AssemblyPhase) => void;
  onExplodedPieceHover: (piece: ExplodedPieceInfo | null) => void;
  onExplodedPieceSelect: (piece: ExplodedPieceInfo | null) => void;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

export function RobotViewport({
  joints,
  showEnvelope,
  viewMode,
  assemblyTarget,
  inspectedPieceId,
  focusedPieceIds,
  showExplodedLabels,
  showCableRoutes,
  cameraRequest,
  onToolPose,
  onCollisionReport,
  onExplodedCatalogReady,
  onAssemblyPhaseChange,
  onExplodedPieceHover,
  onExplodedPieceSelect
}: RobotViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const jointsRef = useRef(joints);
  const envelopeRef = useRef(showEnvelope);
  const viewModeRef = useRef(viewMode);
  const assemblyTargetRef = useRef(assemblyTarget);
  const callbackRef = useRef(onToolPose);
  const assemblyCallbackRef = useRef(onAssemblyPhaseChange);
  const hoverCallbackRef = useRef(onExplodedPieceHover);
  const selectCallbackRef = useRef(onExplodedPieceSelect);
  const inspectedPieceIdRef = useRef(inspectedPieceId);
  const focusedPieceIdsRef = useRef(focusedPieceIds);
  const showExplodedLabelsRef = useRef(showExplodedLabels);
  const showCableRoutesRef = useRef(showCableRoutes);
  const cameraRequestRef = useRef(cameraRequest);
  const collisionCallbackRef = useRef(onCollisionReport);
  const catalogCallbackRef = useRef(onExplodedCatalogReady);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [assemblyPhase, setAssemblyPhase] = useState<AssemblyPhase>('assembled');

  jointsRef.current = joints;
  envelopeRef.current = showEnvelope;
  viewModeRef.current = viewMode;
  assemblyTargetRef.current = assemblyTarget;
  callbackRef.current = onToolPose;
  assemblyCallbackRef.current = onAssemblyPhaseChange;
  hoverCallbackRef.current = onExplodedPieceHover;
  selectCallbackRef.current = onExplodedPieceSelect;
  inspectedPieceIdRef.current = inspectedPieceId;
  focusedPieceIdsRef.current = focusedPieceIds;
  showExplodedLabelsRef.current = showExplodedLabels;
  showCableRoutesRef.current = showCableRoutes;
  cameraRequestRef.current = cameraRequest;
  collisionCallbackRef.current = onCollisionReport;
  catalogCallbackRef.current = onExplodedCatalogReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    setStatus('loading');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa6adae);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 12);
    camera.position.set(0.72, 0.48, 0.78);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const labelLayer = document.createElement('div');
    labelLayer.className = 'exploded-label-layer';
    labelLayer.setAttribute('aria-hidden', 'true');
    host.appendChild(labelLayer);

    const environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-0.03, 0.22, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.35;
    controls.maxDistance = 3.2;
    controls.maxPolarAngle = Math.PI * 0.92;

    scene.add(new THREE.HemisphereLight(0xf6fbff, 0x4d5253, 1.15));

    const key = new THREE.DirectionalLight(0xffffff, 2.45);
    key.position.set(0.65, 1.2, 0.72);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -0.7;
    key.shadow.camera.right = 0.7;
    key.shadow.camera.top = 0.8;
    key.shadow.camera.bottom = -0.35;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 3;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x8fb6ce, 0.72);
    rim.position.set(-0.75, 0.45, -0.65);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 2.8),
      new THREE.MeshStandardMaterial({ color: 0x858d8e, roughness: 0.84, metalness: 0.02 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(2.2, 22, 0x626a6c, 0x8b9293);
    grid.position.y = 0.001;
    grid.material.opacity = 0.36;
    grid.material.transparent = true;
    scene.add(grid);

    const envelope = createReachEnvelope();
    scene.add(envelope);

    const hoverBounds = new THREE.Box3();
    const selectionBounds = new THREE.Box3();
    const hoverOutline = new THREE.Box3Helper(hoverBounds, 0xff7a21);
    const selectionOutline = new THREE.Box3Helper(selectionBounds, 0xf4f7f5);
    hoverOutline.visible = false;
    selectionOutline.visible = false;
    hoverOutline.renderOrder = 20;
    selectionOutline.renderOrder = 19;
    scene.add(hoverOutline, selectionOutline);

    let robot: Awaited<ReturnType<typeof createParol6Model>> | null = null;
    let hoveredPiece: THREE.Object3D | null = null;
    let selectedPiece: THREE.Object3D | null = null;
    let currentAssemblyPhase: AssemblyPhase = 'assembled';
    let pointerDown: { x: number; y: number } | null = null;
    let lastJointSignature = '';
    let lastViewMode = viewModeRef.current;
    let lastAssemblyTarget: 'assembled' | 'disassembled' = 'assembled';
    let lastFocusSignature = '';
    let lastCableRoutes = false;
    let lastCameraRequestId = cameraRequestRef.current.id;
    let assemblyProgress = 0;
    let transitionStartedAt = 0;
    let transitionDuration = 0;
    let transitionFrom = 0;
    let transitionTo = 0;
    let transitionActive = false;
    const cameraFrom = new THREE.Vector3();
    const cameraTo = new THREE.Vector3();
    const targetFrom = new THREE.Vector3();
    const targetTo = new THREE.Vector3();
    const assembledCamera = new THREE.Vector3();
    const assembledTarget = new THREE.Vector3();
    const explodedCamera = new THREE.Vector3(1.62, 1.38, 1.7);
    const explodedTarget = new THREE.Vector3(0, 0.025, 0);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const projectedLabelPosition = new THREE.Vector3();
    const labelElements = new Map<string, HTMLSpanElement>();
    let cameraMoveActive = false;
    let cameraMoveStartedAt = 0;
    const cameraMoveFrom = new THREE.Vector3();
    const cameraMoveTo = new THREE.Vector3();
    const cameraTargetFrom = new THREE.Vector3();
    const cameraTargetTo = new THREE.Vector3();

    const pieceInfo = (object: THREE.Object3D | null) => object?.userData.explodedPieceInfo as ExplodedPieceInfo | undefined;

    const findPieceRoot = (object: THREE.Object3D) => {
      let current: THREE.Object3D | null = object;
      while (current && current !== robot?.root) {
        if (pieceInfo(current)) return current;
        current = current.parent;
      }
      return null;
    };

    const clearHover = () => {
      if (!hoveredPiece) return;
      hoveredPiece = null;
      hoverOutline.visible = false;
      renderer.domElement.style.cursor = 'grab';
      hoverCallbackRef.current(null);
    };

    const clearSelection = () => {
      if (!selectedPiece && !inspectedPieceIdRef.current) return;
      selectedPiece = null;
      selectionOutline.visible = false;
      selectCallbackRef.current(null);
    };

    const clearPicking = () => {
      clearHover();
      clearSelection();
    };

    const pickFromPointer = (event: PointerEvent) => {
      if (!robot || currentAssemblyPhase !== 'disassembled') return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(robot.getExplodedPickables(), true)[0];
      return hit ? findPieceRoot(hit.object) : null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const picked = pickFromPointer(event);
      if (picked === hoveredPiece) return;
      hoveredPiece = picked;
      hoverOutline.visible = Boolean(picked);
      renderer.domElement.style.cursor = picked ? 'pointer' : 'grab';
      hoverCallbackRef.current(pieceInfo(picked) ?? null);
    };

    const handlePointerLeave = () => clearHover();
    const handlePointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerDown || currentAssemblyPhase !== 'disassembled') {
        pointerDown = null;
        return;
      }
      const movement = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      pointerDown = null;
      if (movement > 5) return;
      selectedPiece = pickFromPointer(event);
      selectionOutline.visible = Boolean(selectedPiece);
      selectCallbackRef.current(pieceInfo(selectedPiece) ?? null);
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const reportAssemblyPhase = (phase: AssemblyPhase) => {
      currentAssemblyPhase = phase;
      if (phase !== 'disassembled') clearPicking();
      setAssemblyPhase(phase);
      assemblyCallbackRef.current(phase);
    };

    createParol6Model()
      .then((loadedRobot) => {
        if (cancelled) {
          disposeObject(loadedRobot.root);
          return;
        }
        robot = loadedRobot;
        robot.update(jointsRef.current);
        robot.setViewMode(viewModeRef.current);
        robot.setCableRoutesVisible(showCableRoutesRef.current);
        scene.add(robot.root);
        catalogCallbackRef.current(robot.getExplodedPieceInfos());

        const bounds = new THREE.Box3().setFromObject(robot.root);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) * 1.55;
        controls.target.set(center.x, Math.max(0.16, center.y), center.z);
        camera.position.set(center.x + radius, center.y + radius * 0.72, center.z + radius * 1.18);
        controls.update();
        assembledCamera.copy(camera.position);
        assembledTarget.copy(controls.target);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let animationFrame = 0;
    const toolPosition = new THREE.Vector3();
    const updateExplodedLabels = () => {
      if (!robot || currentAssemblyPhase !== 'disassembled' || !showExplodedLabelsRef.current) {
        labelElements.forEach((element) => { element.hidden = true; });
        return;
      }
      const focusSet = focusedPieceIdsRef.current?.length ? new Set(focusedPieceIdsRef.current) : null;
      const representatives = new Map<string, THREE.Object3D>();
      robot.getExplodedPickables().forEach((object) => {
        const info = pieceInfo(object);
        if (!info || representatives.has(info.section) || (focusSet && !focusSet.has(info.id))) return;
        representatives.set(info.section, object);
      });
      labelElements.forEach((element, section) => { element.hidden = !representatives.has(section); });
      representatives.forEach((object, section) => {
        let element = labelElements.get(section);
        if (!element) {
          element = document.createElement('span');
          element.className = 'exploded-callout';
          element.textContent = section;
          labelLayer.appendChild(element);
          labelElements.set(section, element);
        }
        new THREE.Box3().setFromObject(object).getCenter(projectedLabelPosition);
        projectedLabelPosition.y += 0.035;
        projectedLabelPosition.project(camera);
        const visible = projectedLabelPosition.z > -1 && projectedLabelPosition.z < 1;
        element.hidden = !visible;
        if (visible) {
          const x = THREE.MathUtils.clamp((projectedLabelPosition.x * 0.5 + 0.5) * host.clientWidth, 8, Math.max(8, host.clientWidth - 120));
          const y = THREE.MathUtils.clamp((-projectedLabelPosition.y * 0.5 + 0.5) * host.clientHeight, 8, Math.max(8, host.clientHeight - 30));
          element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
      });
    };

    const startCameraMove = (request: CameraRequest) => {
      if (!robot || transitionActive) return;
      const exploded = currentAssemblyPhase === 'disassembled';
      const targetY = exploded ? 0.025 : 0.22;
      const distance = exploded ? 2.15 : 1.05;
      cameraMoveFrom.copy(camera.position);
      cameraTargetFrom.copy(controls.target);
      if (request.preset === 'tool') {
        robot.getToolWorldPosition(cameraTargetTo);
        cameraMoveTo.copy(cameraTargetTo).add(new THREE.Vector3(0.34, 0.24, 0.38));
      } else {
        cameraTargetTo.set(0, targetY, 0);
        if (request.preset === 'front') cameraMoveTo.set(0, targetY + 0.18, distance);
        if (request.preset === 'side') cameraMoveTo.set(distance, targetY + 0.18, 0);
        if (request.preset === 'top') cameraMoveTo.set(0.001, distance, 0.001);
        if (request.preset === 'isometric') cameraMoveTo.set(distance * 0.7, targetY + distance * 0.48, distance * 0.78);
      }
      cameraMoveStartedAt = performance.now();
      cameraMoveActive = true;
      controls.enabled = false;
    };

    const render = (now = performance.now()) => {
      if (robot) {
        const signature = Object.values(jointsRef.current).join(':');
        if (signature !== lastJointSignature) {
          robot.update(jointsRef.current);
          robot.getToolWorldPosition(toolPosition);
          callbackRef.current({
            x: toolPosition.x,
            y: toolPosition.y,
            z: toolPosition.z,
            reach: Math.hypot(toolPosition.x, toolPosition.z)
          });
          if (currentAssemblyPhase === 'assembled') collisionCallbackRef.current(robot.getCollisionReport());
          lastJointSignature = signature;
        }

        const focusSignature = focusedPieceIdsRef.current?.slice().sort().join('|') ?? '';
        if (focusSignature !== lastFocusSignature) {
          robot.setExplodedFocus(focusedPieceIdsRef.current);
          lastFocusSignature = focusSignature;
        }
        if (showCableRoutesRef.current !== lastCableRoutes) {
          robot.setCableRoutesVisible(showCableRoutesRef.current);
          lastCableRoutes = showCableRoutesRef.current;
        }

        if (cameraRequestRef.current.id !== lastCameraRequestId) {
          lastCameraRequestId = cameraRequestRef.current.id;
          startCameraMove(cameraRequestRef.current);
        }
        if (viewModeRef.current !== lastViewMode) {
          robot.setViewMode(viewModeRef.current);
          lastViewMode = viewModeRef.current;
        }

        if (assemblyTargetRef.current !== lastAssemblyTarget) {
          lastAssemblyTarget = assemblyTargetRef.current;
          transitionFrom = assemblyProgress;
          transitionTo = lastAssemblyTarget === 'disassembled' ? 1 : 0;
          transitionStartedAt = now;
          transitionDuration = reduceMotion ? 1 : 4200 * Math.max(0.2, Math.abs(transitionTo - transitionFrom));
          transitionActive = true;
          cameraFrom.copy(camera.position);
          targetFrom.copy(controls.target);
          if (transitionTo === 1) {
            if (transitionFrom <= 0.001) {
              assembledCamera.copy(camera.position);
              assembledTarget.copy(controls.target);
            }
            cameraTo.copy(explodedCamera);
            targetTo.copy(explodedTarget);
            reportAssemblyPhase('disassembling');
          } else {
            cameraTo.copy(assembledCamera);
            targetTo.copy(assembledTarget);
            reportAssemblyPhase('reassembling');
          }
          controls.enabled = false;
        }

        if (transitionActive) {
          const linear = THREE.MathUtils.clamp((now - transitionStartedAt) / transitionDuration, 0, 1);
          const eased = 1 - Math.pow(1 - linear, 3);
          assemblyProgress = THREE.MathUtils.lerp(transitionFrom, transitionTo, eased);
          robot.setExplodedProgress(assemblyProgress);
          camera.position.lerpVectors(cameraFrom, cameraTo, eased);
          controls.target.lerpVectors(targetFrom, targetTo, eased);
          if (linear >= 1) {
            transitionActive = false;
            assemblyProgress = transitionTo;
            controls.enabled = true;
            reportAssemblyPhase(transitionTo === 1 ? 'disassembled' : 'assembled');
          }
        }

        if (cameraMoveActive && !transitionActive) {
          const linear = THREE.MathUtils.clamp((now - cameraMoveStartedAt) / (reduceMotion ? 1 : 180), 0, 1);
          const eased = 1 - Math.pow(1 - linear, 3);
          camera.position.lerpVectors(cameraMoveFrom, cameraMoveTo, eased);
          controls.target.lerpVectors(cameraTargetFrom, cameraTargetTo, eased);
          if (linear >= 1) {
            cameraMoveActive = false;
            controls.enabled = true;
          }
        }

        const requestedPieceId = inspectedPieceIdRef.current;
        if (currentAssemblyPhase === 'disassembled' && requestedPieceId && pieceInfo(selectedPiece)?.id !== requestedPieceId) {
          selectedPiece = robot.getExplodedPickables().find((object) => pieceInfo(object)?.id === requestedPieceId) ?? null;
          selectionOutline.visible = Boolean(selectedPiece);
        } else if (!requestedPieceId && selectedPiece) {
          selectedPiece = null;
          selectionOutline.visible = false;
        }
        if (hoveredPiece) hoverBounds.setFromObject(hoveredPiece);
        if (selectedPiece) selectionBounds.setFromObject(selectedPiece);
      }
      envelope.visible = envelopeRef.current;
      controls.update();
      updateExplodedLabels();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      labelLayer.remove();
      controls.dispose();
      environment.dispose();
      hoverOutline.geometry.dispose();
      (Array.isArray(hoverOutline.material) ? hoverOutline.material : [hoverOutline.material]).forEach((material) => material.dispose());
      selectionOutline.geometry.dispose();
      (Array.isArray(selectionOutline.material) ? selectionOutline.material : [selectionOutline.material]).forEach((material) => material.dispose());
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      className="viewport robot-viewport"
      ref={hostRef}
      data-model-status={status}
      data-assembly-phase={assemblyPhase}
    >
      {status !== 'ready' ? (
        <div className="viewport-status" role="status">
          <span className="loader-mark" aria-hidden="true" />
          <strong>{status === 'error' ? 'Model unavailable' : 'Loading PAROL6 geometry'}</strong>
          <small>{status === 'error' ? 'The official STL files could not be loaded.' : '7 source meshes / 184,404 triangles'}</small>
        </div>
      ) : null}
    </div>
  );
}
