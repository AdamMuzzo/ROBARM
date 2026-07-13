import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPartModel } from './robotModel';
import type { PartId, ViewMode } from './types';

interface PartViewportProps {
  partId: PartId;
  viewMode: ViewMode;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

export function PartViewport({ partId, viewMode }: PartViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    setStatus('loading');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb3b8b9);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.005, 8);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.08;
    controls.maxDistance = 2;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x4d5253, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.45);
    key.position.set(0.55, 0.85, 0.65);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x91aec2, 0.68);
    rim.position.set(-0.6, 0.35, -0.45);
    scene.add(rim);

    let model: THREE.Group | null = null;
    let floor: THREE.Mesh | null = null;
    let grid: THREE.GridHelper | null = null;

    createPartModel(partId, viewMode)
      .then((loadedModel) => {
        if (cancelled) {
          disposeObject(loadedModel);
          return;
        }
        model = loadedModel;
        scene.add(model);

        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 0.05);
        const floorY = bounds.min.y - maxDimension * 0.08;

        floor = new THREE.Mesh(
          new THREE.PlaneGeometry(maxDimension * 6, maxDimension * 6),
          new THREE.MeshStandardMaterial({ color: 0x989e9f, roughness: 0.86 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = floorY;
        floor.receiveShadow = true;
        scene.add(floor);

        grid = new THREE.GridHelper(maxDimension * 3.5, 14, 0x747a7a, 0x9ba0a0);
        grid.position.y = floorY + 0.0002;
        grid.material.opacity = 0.3;
        grid.material.transparent = true;
        scene.add(grid);

        controls.target.set(0, 0, 0);
        camera.position.set(maxDimension * 1.7, maxDimension * 1.15, maxDimension * 1.85);
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
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelled = true;
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
          <strong>{status === 'error' ? 'Part unavailable' : 'Loading source mesh'}</strong>
          <small>{status === 'error' ? 'The STL file could not be loaded.' : 'Official PAROL6 geometry'}</small>
        </div>
      ) : null}
    </div>
  );
}
