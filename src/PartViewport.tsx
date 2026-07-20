import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPartDiagramModel, type PartDiagramModel } from './partAssemblyModel';
import type { PartId, ViewMode } from './types';

interface PartViewportProps {
  partId: PartId;
  viewMode: ViewMode;
  explodedProgress?: number;
  selectedComponentId?: string | null;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Line)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

export function PartViewport({ partId, viewMode, explodedProgress = 0, selectedComponentId = null }: PartViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const diagramRef = useRef<PartDiagramModel | null>(null);
  const targetProgressRef = useRef(explodedProgress);
  const displayedProgressRef = useRef(explodedProgress);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    targetProgressRef.current = explodedProgress;
  }, [explodedProgress]);

  useEffect(() => {
    diagramRef.current?.setSelectedComponent(selectedComponentId);
  }, [selectedComponentId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    setStatus('loading');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa5adaf);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.005, 8);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.06;
    controls.maxDistance = 4;

    scene.add(new THREE.HemisphereLight(0xf8fbfb, 0x3d4548, 1.02));
    const key = new THREE.DirectionalLight(0xffffff, 2.15);
    key.position.set(0.55, 0.85, 0.65);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x9fc0d0, 0.78);
    rim.position.set(-0.6, 0.35, -0.45);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xffe3c7, 0.42);
    fill.position.set(0.25, 0.18, -0.72);
    scene.add(fill);

    let model: THREE.Group | null = null;
    let floor: THREE.Mesh | null = null;
    let grid: THREE.GridHelper | null = null;

    createPartDiagramModel(partId, viewMode)
      .then((diagram) => {
        if (cancelled) {
          disposeObject(diagram.root);
          return;
        }
        diagramRef.current = diagram;
        targetProgressRef.current = explodedProgress;
        displayedProgressRef.current = explodedProgress;
        diagram.setExplodedProgress(displayedProgressRef.current);
        diagram.setSelectedComponent(selectedComponentId);
        const loadedModel = diagram.root;
        model = loadedModel;
        scene.add(model);

        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, diagram.framingSize, 0.05);
        const floorY = Math.min(bounds.min.y - maxDimension * 0.06, -0.012);

        floor = new THREE.Mesh(
          new THREE.PlaneGeometry(maxDimension * 6, maxDimension * 6),
          new THREE.MeshStandardMaterial({ color: 0x858e91, roughness: 0.9 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = floorY;
        floor.receiveShadow = true;
        scene.add(floor);

        grid = new THREE.GridHelper(maxDimension * 3.5, 14, 0x626b6e, 0x929a9c);
        grid.position.y = floorY + 0.0002;
        grid.material.opacity = 0.42;
        grid.material.transparent = true;
        scene.add(grid);

        const initialFrame = THREE.MathUtils.lerp(
          diagram.assembledFramingSize,
          diagram.framingSize,
          THREE.MathUtils.smootherstep(displayedProgressRef.current, 0, 1)
        );
        controls.target.set(0, 0, 0);
        camera.position.set(initialFrame * 1.22, initialFrame * 0.92, initialFrame * 1.35);
        camera.near = Math.max(0.001, maxDimension / 100);
        camera.far = maxDimension * 20;
        camera.updateProjectionMatrix();
        controls.update();
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
    const clock = new THREE.Clock();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const render = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const targetProgress = targetProgressRef.current;
      let displayedProgress = reduceMotion
        ? targetProgress
        : THREE.MathUtils.damp(displayedProgressRef.current, targetProgress, 3, delta);
      if (Math.abs(displayedProgress - targetProgress) < 0.0005) displayedProgress = targetProgress;
      if (displayedProgress !== displayedProgressRef.current) {
        displayedProgressRef.current = displayedProgress;
        diagramRef.current?.setExplodedProgress(displayedProgress);
        const diagram = diagramRef.current;
        if (diagram) {
          const cameraFrame = THREE.MathUtils.lerp(
            diagram.assembledFramingSize,
            diagram.framingSize,
            THREE.MathUtils.smootherstep(displayedProgress, 0, 1)
          );
          const viewDirection = camera.position.clone().sub(controls.target);
          if (viewDirection.lengthSq() > 0.000001) {
            camera.position.copy(controls.target).add(viewDirection.setLength(cameraFrame * 2.05));
          }
        }
      }
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelled = true;
      diagramRef.current = null;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      controls.dispose();
      environment.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [partId, viewMode]);

  return (
    <div className="viewport part-viewport" ref={hostRef} data-model-status={status}>
      {status !== 'ready' ? (
        <div className="viewport-status" role="status">
          <span className="loader-mark" aria-hidden="true" />
          <strong>{status === 'error' ? 'Part unavailable' : 'Loading assembly diagram'}</strong>
          <small>{status === 'error' ? 'The component previews could not be loaded.' : 'Official PAROL6 geometry and build hardware'}</small>
        </div>
      ) : null}
    </div>
  );
}
