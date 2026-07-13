import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createPartModel } from './robotModel';
import type { PartId } from './types';

interface PartViewportProps {
  partId: PartId;
}

export function PartViewport({ partId }: PartViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const partIdRef = useRef(partId);
  partIdRef.current = partId;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f5ef);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 25);
    camera.position.set(0.55, 0.38, 0.7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.22;
    controls.maxDistance = 2.4;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd0ba93, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    key.position.set(1.5, 2, 1.2);
    key.castShadow = true;
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshStandardMaterial({ color: 0xe7e0d6, roughness: 0.76 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.16;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(1.4, 14, 0x6f7472, 0xc2b8aa);
    grid.position.y = -0.158;
    scene.add(grid);

    let currentPart = createPartModel(partIdRef.current);
    scene.add(currentPart);

    const framePart = (object: THREE.Object3D) => {
      const bounds = new THREE.Box3().setFromObject(object);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      controls.target.copy(center);
      const max = Math.max(size.x, size.y, size.z, 0.2);
      camera.position.set(max * 2.1, max * 1.25, max * 2.35);
      camera.near = 0.01;
      camera.far = Math.max(10, max * 12);
      camera.updateProjectionMatrix();
      controls.update();
    };
    framePart(currentPart);

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

    let previousPart = partIdRef.current;
    let animationFrame = 0;

    const render = () => {
      if (previousPart !== partIdRef.current) {
        scene.remove(currentPart);
        currentPart.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          }
        });
        currentPart = createPartModel(partIdRef.current);
        scene.add(currentPart);
        framePart(currentPart);
        previousPart = partIdRef.current;
      }
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };
  }, []);

  return <div className="viewport part-viewport" ref={hostRef} />;
}
