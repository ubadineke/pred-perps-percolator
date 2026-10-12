"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer } from "@react-three/drei";
import type { Group } from "three";
import type { CoinColors } from "./landing-stage";


/** One straight arm of a chevron, as a raised bar from p1 to p2 on the coin face. */
function Arm({ from, to, color }: { from: [number, number]; to: [number, number]; color: string }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const thickness = 0.17;
  return (
    <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0]} rotation={[0, 0, Math.atan2(dy, dx)]}>
      <boxGeometry args={[Math.hypot(dx, dy) + thickness * 0.5, thickness, 0.05]} />
      <meshPhysicalMaterial color={color} metalness={0.2} roughness={0.35} clearcoat={1} />
    </mesh>
  );
}

/** The Moxie mark on a coin face: an ink-side ∨ (down) above an ∧ (up). */
function FaceMark({ up, down }: { up: string; down: string }) {
  return (
    <>
      <Arm from={[-0.44, 0.46]} to={[0, 0.17]} color={down} />
      <Arm from={[0.44, 0.46]} to={[0, 0.17]} color={down} />
      <Arm from={[-0.44, -0.46]} to={[0, -0.17]} color={up} />
      <Arm from={[0.44, -0.46]} to={[0, -0.17]} color={up} />
    </>
  );
}

/** A Moxie coin: a beveled disc with the Moxie mark raised on each face. */
function Coin({ color, up, down, position, rotation, scale = 1 }: { color: string; up: string; down: string; position: [number, number, number]; rotation: [number, number, number]; scale?: number }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 0.2, 96]} />
        <meshPhysicalMaterial color={color} metalness={0.15} roughness={0.28} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.98, 0.06, 24, 96]} />
        <meshPhysicalMaterial color={color} metalness={0.3} roughness={0.2} clearcoat={1} />
      </mesh>
      <group position={[0, 0, 0.11]}>
        <FaceMark up={up} down={down} />
      </group>
      {/* The back face, mirrored so the mark reads correctly from behind. */}
      <group position={[0, 0, -0.11]} rotation={[0, Math.PI, 0]}>
        <FaceMark up={up} down={down} />
      </group>
    </group>
  );
}

/** Tilts the whole cluster toward the pointer, eased. */
function Parallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    const ease = 1 - Math.pow(0.001, delta);
    ref.current.rotation.y += (state.pointer.x * 0.35 - ref.current.rotation.y) * ease;
    ref.current.rotation.x += (-state.pointer.y * 0.2 - ref.current.rotation.x) * ease;
  });
  return <group ref={ref}>{children}</group>;
}

export default function CoinScene({ reducedMotion = false, colors }: { reducedMotion?: boolean; colors: CoinColors }) {
  const { a, aUp, aDown, b, bUp, bDown } = colors;
  const speed = reducedMotion ? 0 : 1.4;
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} frameloop={reducedMotion ? "demand" : "always"}>
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} />
      <Parallax>
        <Float speed={speed} rotationIntensity={0.8} floatIntensity={1.2}>
          <Coin color={a} up={aUp} down={aDown} position={[-5.0, 2.0, 0]} rotation={[0.35, 0.6, -0.25]} scale={0.95} />
        </Float>
        <Float speed={speed * 0.8} rotationIntensity={1} floatIntensity={1.4}>
          <Coin color={b} up={bUp} down={bDown} position={[5.6, 2.3, -1]} rotation={[-0.4, -0.7, 0.3]} scale={0.8} />
        </Float>
        <Float speed={speed * 1.1} rotationIntensity={1.2} floatIntensity={1}>
          <Coin color={a} up={aUp} down={aDown} position={[3.6, -1.2, 1]} rotation={[0.9, -0.3, 0.5]} scale={0.42} />
        </Float>
        <Float speed={speed * 0.9} rotationIntensity={1} floatIntensity={1.6}>
          <Coin color={b} up={bUp} down={bDown} position={[-3.5, -0.9, -0.5]} rotation={[-0.8, 0.4, -0.6]} scale={0.36} />
        </Float>
      </Parallax>
      {/* Studio lighting built from light panels: no external HDR download. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={4} position={[0, 4, 3]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={2} color={a} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[5, -1, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="ring" intensity={3} position={[0, 0, -6]} scale={6} />
      </Environment>
    </Canvas>
  );
}
