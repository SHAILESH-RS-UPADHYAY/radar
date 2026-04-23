'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Stars, AdaptiveDpr } from '@react-three/drei';
import * as THREE from 'three';

// High-detail Earth-like wireframe structure (Restored)
function RadarGlobe() {
  const globeRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const pulseRef1 = useRef<THREE.Mesh>(null);
  const pulseRef2 = useRef<THREE.Mesh>(null);
  const { pointer } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (globeRef.current) {
      globeRef.current.rotation.y = t * 0.15;
      globeRef.current.rotation.x = THREE.MathUtils.lerp(globeRef.current.rotation.x, pointer.y * 0.15, 0.05);
      globeRef.current.rotation.z = THREE.MathUtils.lerp(globeRef.current.rotation.z, -pointer.x * 0.08, 0.05);
    }
    if (scanRef.current) scanRef.current.rotation.z = t * 0.5;
    
    // Sonar pulses
    [pulseRef1, pulseRef2].forEach((ref, i) => {
      if (!ref.current) return;
      const phase = ((t * 0.4 + i * 1.5) % 3) / 3;
      ref.current.scale.setScalar(1.5 + phase * 2);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.25;
    });
  });

  return (
    <group ref={globeRef}>
      {/* High-detail wireframe earth structure */}
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshBasicMaterial color="#333333" wireframe transparent opacity={0.3} />
      </mesh>
      
      {/* Secondary wireframe offset for glitchy/complex look */}
      <mesh scale={1.01}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial color="#00FFD4" wireframe transparent opacity={0.1} />
      </mesh>
      
      {/* Inner dark core to hide back-faces slightly */}
      <mesh>
        <sphereGeometry args={[1.95, 32, 32]} />
        <meshBasicMaterial color="#050505" transparent opacity={0.9} />
      </mesh>
      
      {/* Scan Wedge */}
      <mesh ref={scanRef} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.2, 64, 0, Math.PI / 4]} />
        <meshBasicMaterial color="#00FFD4" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Orbit Rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.3, 0.005, 16, 100]} />
        <meshBasicMaterial color="#00FFD4" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 3, 0.5, 0]}>
        <torusGeometry args={[2.6, 0.005, 16, 100]} />
        <meshBasicMaterial color="#444444" transparent opacity={0.6} />
      </mesh>

      {/* Pulse Rings */}
      <mesh ref={pulseRef1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.01, 16, 100]} />
        <meshBasicMaterial color="#00FFD4" transparent opacity={0.2} />
      </mesh>
      <mesh ref={pulseRef2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.01, 16, 100]} />
        <meshBasicMaterial color="#00FFD4" transparent opacity={0.15} />
      </mesh>

      {/* Data Dots */}
      <OrbitingDots count={40} radius={2.4} color="#00FFD4" size={0.02} />
      <OrbitingDots count={25} radius={2.7} color="#ffffff" size={0.015} />
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
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </instancedMesh>
  );
}

function FloatingShapes() {
  return (
    <group>
      {[
        { pos: [-5, 2.5, -5] as [number, number, number], color: '#00FFD4', s: 0.13, sp: 1 },
        { pos: [5.5, -1.5, -6] as [number, number, number], color: '#444444', s: 0.17, sp: 0.6 },
        { pos: [-4.5, -3, -4] as [number, number, number], color: '#ffffff', s: 0.1, sp: 1.2 },
      ].map((s, i) => (
        <Float key={i} speed={s.sp} rotationIntensity={2} floatIntensity={1.5}>
          <mesh position={s.pos} scale={s.s}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={s.color} wireframe transparent opacity={0.3} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

// MAIN SCENE — NO BLOOM, NO POSTPROCESSING = FAST
export default function RadarScene() {
  return (
    <div className="absolute inset-0 z-0" style={{ filter: 'contrast(1.1) brightness(1.05)' }}>
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 55 }}
        dpr={1}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
      >
        <color attach="background" args={['#000000']} />
        <AdaptiveDpr pixelated />
        <Stars radius={50} depth={60} count={2000} factor={2.5} saturation={0} fade speed={0.2} />
        <RadarGlobe />
        <FloatingShapes />
        <ambientLight intensity={0.15} />
      </Canvas>
    </div>
  );
}
