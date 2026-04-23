'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

// ============================
// RADAR GLOBE — The central 3D radar sphere
// A wireframe sphere with a sweeping scan line
// ============================
function RadarGlobe() {
  const globeRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (globeRef.current) {
      globeRef.current.rotation.y = t * 0.15;
      globeRef.current.rotation.x = Math.sin(t * 0.1) * 0.1;
    }
    if (scanRef.current) {
      scanRef.current.rotation.z = t * 0.8;
    }
    if (ringsRef.current) {
      ringsRef.current.rotation.z = -t * 0.05;
      ringsRef.current.rotation.x = Math.sin(t * 0.2) * 0.05;
    }
  });

  return (
    <group ref={globeRef}>
      {/* Main wireframe sphere */}
      <mesh>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial
          color="#00D4FF"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>

      {/* Inner glow sphere */}
      <mesh>
        <sphereGeometry args={[1.95, 32, 32]} />
        <meshBasicMaterial
          color="#6C63FF"
          transparent
          opacity={0.03}
        />
      </mesh>

      {/* Radar scan line (rotating plane) */}
      <mesh ref={scanRef} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2, 64, 0, Math.PI / 3]} />
        <meshBasicMaterial
          color="#00D4FF"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Equator ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.008, 16, 100]} />
        <meshBasicMaterial color="#00D4FF" transparent opacity={0.5} />
      </mesh>

      {/* Tilted ring 1 */}
      <group ref={ringsRef}>
        <mesh rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[2.3, 0.005, 16, 100]} />
          <meshBasicMaterial color="#6C63FF" transparent opacity={0.3} />
        </mesh>

        {/* Tilted ring 2 */}
        <mesh rotation={[Math.PI / 2, Math.PI / 4, 0]}>
          <torusGeometry args={[2.5, 0.004, 16, 100]} />
          <meshBasicMaterial color="#00FF88" transparent opacity={0.2} />
        </mesh>
      </group>

      {/* Data points orbiting the sphere */}
      <OrbitingDots count={20} radius={2.1} color="#00D4FF" />
      <OrbitingDots count={15} radius={2.4} color="#00FF88" />
      <OrbitingDots count={10} radius={2.7} color="#6C63FF" />
    </group>
  );
}

// ============================
// ORBITING DOTS — Data points circling the globe
// ============================
function OrbitingDots({ count, radius, color }: { count: number; radius: number; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      arr.push({
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
        speed: 0.2 + Math.random() * 0.3,
        offset: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [count, radius]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      const angle = t * p.speed + p.offset;
      dummy.position.set(
        p.x * Math.cos(angle) - p.z * Math.sin(angle),
        p.y + Math.sin(t * 0.5 + p.offset) * 0.1,
        p.x * Math.sin(angle) + p.z * Math.cos(angle)
      );
      const scale = 0.8 + Math.sin(t * 2 + p.offset) * 0.4;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.02, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </instancedMesh>
  );
}

// ============================
// FLOATING SHAPES — Ambient geometric decorations
// ============================
function FloatingShapes() {
  return (
    <group>
      {/* Floating octahedrons */}
      {[
        { pos: [-5, 2, -3] as [number, number, number], color: '#00D4FF', scale: 0.15, speed: 1.2 },
        { pos: [5, -1, -4] as [number, number, number], color: '#6C63FF', scale: 0.2, speed: 0.8 },
        { pos: [-4, -3, -2] as [number, number, number], color: '#00FF88', scale: 0.12, speed: 1.5 },
        { pos: [6, 3, -5] as [number, number, number], color: '#FF6B9D', scale: 0.18, speed: 1.0 },
        { pos: [-6, 0, -6] as [number, number, number], color: '#00D4FF', scale: 0.1, speed: 1.8 },
        { pos: [3, -4, -3] as [number, number, number], color: '#6C63FF', scale: 0.14, speed: 0.9 },
      ].map((shape, i) => (
        <Float key={i} speed={shape.speed} rotationIntensity={2} floatIntensity={1.5}>
          <mesh position={shape.pos} scale={shape.scale}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial
              color={shape.color}
              wireframe
              transparent
              opacity={0.4}
            />
          </mesh>
        </Float>
      ))}

      {/* Floating torus knots */}
      {[
        { pos: [4, 2, -8] as [number, number, number], color: '#00D4FF', scale: 0.08 },
        { pos: [-5, -2, -7] as [number, number, number], color: '#6C63FF', scale: 0.06 },
      ].map((shape, i) => (
        <Float key={100 + i} speed={0.6} rotationIntensity={3} floatIntensity={2}>
          <mesh position={shape.pos} scale={shape.scale}>
            <torusKnotGeometry args={[1, 0.3, 64, 8]} />
            <meshBasicMaterial
              color={shape.color}
              wireframe
              transparent
              opacity={0.25}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

// ============================
// MAIN RADAR SCENE
// ============================
export default function RadarScene() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
      >
        {/* Ambient star field */}
        <Stars
          radius={50}
          depth={80}
          count={3000}
          factor={3}
          saturation={0.5}
          fade
          speed={0.5}
        />

        {/* The radar globe */}
        <RadarGlobe />

        {/* Floating geometric decorations */}
        <FloatingShapes />

        {/* Subtle ambient light */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.2} color="#00D4FF" />
        <pointLight position={[-10, -10, -5]} intensity={0.15} color="#6C63FF" />
      </Canvas>
    </div>
  );
}
