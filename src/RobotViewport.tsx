import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { armDimensions } from './robotData';
import { createReachEnvelope, createRobotArm } from './robotModel';
import type { JointState } from './types';

interface RobotViewportProps {
  joints: JointState;
  showEnvelope: boolean;
}

export function RobotViewport({ joints, showEnvelope }: RobotViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const jointsRef = useRef(joints);
  const envelopeRef = useRef(showEnvelope);

  jointsRef.current = joints;
  envelopeRef.current = showEnvelope;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6f3ee);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 50);
    camera.position.set(2.05, 1.28, 2.15);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.52, 0.45, 0);
    controls.enableDamping = true;
    controls.minDistance = 0.55;
    controls.maxDistance = 4.3;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xc9b991, 1.8);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 3.6);
    key.position.set(2.4, 3.6, 1.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 7;
    key.shadow.camera.left = -2.4;
    key.shadow.camera.right = 2.4;
    key.shadow.camera.top = 2.4;
    key.shadow.camera.bottom = -2.4;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8dd8d0, 0.7);
    fill.position.set(-1.6, 1.4, -2);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshStandardMaterial({ color: 0xe7e0d4, metalness: 0, roughness: 0.72 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(3.2, 32, 0x62676a, 0xb5aaa0);
    grid.position.y = 0.002;
    scene.add(grid);

    const axes = new THREE.AxesHelper(0.35);
    axes.position.set(-1.25, 0.015, -1.25);
    scene.add(axes);

    const robot = createRobotArm();
    robot.root.position.y = 0.002;
    scene.add(robot.root);

    const envelope = createReachEnvelope();
    envelope.visible = envelopeRef.current;
    scene.add(envelope);

    const targetMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 24, 12),
      new THREE.MeshStandardMaterial({ color: 0xef7b45, emissive: 0x5a1f0d, emissiveIntensity: 0.15 })
    );
    scene.add(targetMarker);

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
    const target = new THREE.Vector3();
    const render = () => {
      robot.update(jointsRef.current);
      robot.getToolWorldPosition(target);
      targetMarker.position.copy(target);
      envelope.visible = envelopeRef.current;
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

  return (
    <div className="viewport robot-viewport" ref={hostRef}>
      <div className="viewport-badge">1 grid square = 10 cm</div>
      <div className="scale-ruler" aria-hidden="true">
        <span />
        <strong>{armDimensions.upperArmLength.toFixed(2)} m upper link</strong>
      </div>
    </div>
  );
}
