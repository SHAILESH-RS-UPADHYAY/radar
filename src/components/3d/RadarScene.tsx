'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Stars, AdaptiveDpr } from '@react-three/drei';
import * as THREE from 'three';

// ===== OPTIMIZED: Mouse-reactive globe (lower poly, fewer objects) =====
function RadarGlobe() {
  const globeRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const pulseRef1 = useRef<THREE.Mesh>(null);
  const pulseRef2 = useRef<THREE.Mesh>(null);
  const { pointer } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (globeRef.current) {
      globeRef.current.rotation.y = t * 0.1;
      globeRef.current.rotation.x = THREE.MathUtils.lerp(globeRef.current.rotation.x, pointer.y * 0.12, 0.02);
      globeRef.current.rotation.z = THREE.MathUtils.lerp(globeRef.current.rotation.z, -pointer.x * 0.06, 0.02);
    }
    if (scanRef.current) scanRef.current.rotation.z = t * 0.5;
    // Sonar pulse — only 2 rings
    [pulseRef1, pulseRef2].forEach((ref, i) => {
      if (!ref.current) return;
      const phase = ((t * 0.35 + i * 1.8) % 3.6) / 3.6;
      ref.current.scale.setScalar(2 + phase * 3);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.12;
    });
  });

  return (
    <group ref={globeRef}>
      {/* Main sphere — LOW POLY for performance */}
      <mesh>
        <sphereGeometry args={[2, 28, 28]} />
        <meshBasicMaterial color="#0d3d35" wireframe transparent opacity={0.12} />
      </mesh>
      {/* Core glow */}
      <mesh>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshBasicMaterial color="#00FFD4" transparent opacity={0.5} />
      </mesh>
      {/* Scan wedge */}
      <mesh ref={scanRef} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2, 32, 0, Math.PI / 4]} />
        <meshBasicMaterial color="#00FFD4" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
      {/* Equator ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.01, 8, 80]} />
        <meshBasicMaterial color="#00FFD4" transparent opacity={0.5} />
      </mesh>
      {/* Tilted ring */}
      <mesh rotation={[Math.PI / 3, 0.5, 0]}>
        <torusGeometry args={[2.35, 0.005, 8, 80]} />
        <meshBasicMaterial color="#8B5CF6" transparent opacity={0.3} />
      </mesh>
      {/* Outer ring */}
      <mesh rotation={[Math.PI / 2, Math.PI / 3, 0.3]}>
        <torusGeometry args={[2.6, 0.004, 8, 80]} />
        <meshBasicMaterial color="#00FF88" transparent opacity={0.15} />
      </mesh>
      {/* Pulse rings */}
      <mesh ref={pulseRef1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.012, 6, 48]} />
        <meshBasicMaterial color="#00FFD4" transparent opacity={0.12} />
      </mesh>
      <mesh ref={pulseRef2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.008, 6, 48]} />
        <meshBasicMaterial color="#00FFD4" transparent opacity={0.08} />
      </mesh>
      {/* Data dots — reduced count */}
      <OrbitingDots count={18} radius={2.1} color="#00FFD4" size={0.022} />
      <OrbitingDots count={12} radius={2.45} color="#8B5CF6" size={0.018} />
      <OrbitingDots count={8} radius={2.75} color="#00FF88" size={0.015} />
    </group>
  );
}

function OrbitingDots({ count, radius, color, size }: { count: number; radius: number; color: string; size: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        phi: Math.acos(2 * Math.random() - 1),
        theta: Math.random() * Math.PI * 2,
        speed: 0.12 + Math.random() * 0.2,
        offset: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    data.forEach((p, i) => {
      const angle = t * p.speed + p.offset;
      dummy.position.set(
        radius * Math.sin(p.phi) * Math.cos(p.theta + angle),
        radius * Math.cos(p.phi),
        radius * Math.sin(p.phi) * Math.sin(p.theta + angle)
      );
      dummy.scale.setScalar(0.6 + Math.sin(t * 1.5 + p.offset) * 0.4);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[size, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} />
    </instancedMesh>
  );
}

function FloatingShapes() {
  return (
    <group>
      {[
        { pos: [-5, 2.5, -5] as [number, number, number], color: '#00FFD4', s: 0.13, sp: 1 },
        { pos: [5.5, -1.5, -6] as [number, number, number], color: '#8B5CF6', s: 0.17, sp: 0.6 },
        { pos: [-4.5, -3, -4] as [number, number, number], color: '#00FF88', s: 0.1, sp: 1.2 },
        { pos: [6, 3.5, -7] as [number, number, number], color: '#FF3D71', s: 0.14, sp: 0.8 },
      ].map((s, i) => (
        <Float key={i} speed={s.sp} rotationIntensity={2} floatIntensity={1.5}>
          <mesh position={s.pos} scale={s.s}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={s.color} wireframe transparent opacity={0.25} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

// ===== MAIN SCENE — NO BLOOM, NO POSTPROCESSING = FAST =====
// Using CSS glow effects instead for the "neon" look
export default function RadarScene() {
  return (
    <div className="absolute inset-0 z-0" style={{ filter: 'contrast(1.1) brightness(1.05)' }}>
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 55 }}
        dpr={1}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
      >
        <color attach="background" args={['#080b1a']} />
        <AdaptiveDpr pixelated />
        <Stars radius={50} depth={60} count={1500} factor={2.5} saturation={0.2} fade speed={0.2} />
        <RadarGlobe />
        <FloatingShapes />
        <ambientLight intensity={0.15} />
      </Canvas>
    </div>
  );
}
