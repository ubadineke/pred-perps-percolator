"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Line, PerspectiveCamera, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function Field() {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.PlaneGeometry(16, 11, 60, 40), []);
  const basePositions = useMemo(() => Float32Array.from(geometry.attributes.position.array as ArrayLike<number>), [geometry]);

  useFrame(({ clock, pointer }) => {
    if (!mesh.current) return;
    const positions = mesh.current.geometry.attributes.position;
    const t = clock.elapsedTime * 0.22;
    for (let i = 0; i < positions.count; i += 1) {
      const x = basePositions[i * 3];
      const y = basePositions[i * 3 + 1];
      const wave = Math.sin(x * 0.78 + t) * 0.18 + Math.cos(y * 0.92 - t * 1.3) * 0.12;
      const wellA = -0.86 * Math.exp(-((x - 2.7) ** 2 + (y - 1.2) ** 2) / 3.4);
      const wellB = 0.62 * Math.exp(-((x + 2.6) ** 2 + (y + 1.1) ** 2) / 2.2);
      positions.setZ(i, wave + wellA + wellB);
    }
    positions.needsUpdate = true;
    mesh.current.rotation.x = -1.02 + pointer.y * 0.025;
    mesh.current.rotation.z = pointer.x * 0.018;
  });

  return (
    <mesh ref={mesh} geometry={geometry} rotation={[-1.02, 0, 0]} position={[0, -0.55, -1.2]}>
      <meshBasicMaterial color="#a9d83f" wireframe transparent opacity={0.52} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function Node({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  return (
    <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.32}>
      <mesh position={position} scale={scale}>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={position} scale={scale * 2.5}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} />
      </mesh>
      <mesh position={position} rotation={[Math.PI / 2, 0, 0]} scale={scale}>
        <torusGeometry args={[0.42, 0.008, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.42} />
      </mesh>
    </Float>
  );
}

function CameraRig() {
  const { camera, pointer } = useThree();
  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.28, 0.035);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 2.45 + pointer.y * 0.12, 0.035);
    camera.lookAt(0, -0.55, -1.3);
  });
  return null;
}

export function ProbabilityField() {
  return (
    <div className="probability-canvas" aria-hidden="true">
      <div className="probability-fallback"><i /><i /><i /><i /><i /></div>
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} fallback={<div className="webgl-fallback" />}>
        <PerspectiveCamera makeDefault position={[0, 2.4, 7.8]} fov={48} />
        <CameraRig />
        <fog attach="fog" args={["#080a0c", 7, 16]} />
        <Sparkles count={80} scale={[11, 5, 6]} size={1.15} speed={0.12} color="#c7ff4a" opacity={0.32} />
        <Field />
        <Line points={[[-5.8, -0.15, 0.1], [5.8, -0.15, 0.1]]} color="#c7ff4a" transparent opacity={0.5} lineWidth={0.9} />
        <Node position={[2.7, 0.55, 0.05]} color="#c7ff4a" scale={1.25} />
        <Node position={[-2.6, -0.42, 0.3]} color="#5ae6a8" />
        <Node position={[0.45, -0.7, -0.2]} color="#ebe8df" scale={0.72} />
      </Canvas>
    </div>
  );
}
