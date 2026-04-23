'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

// Mouse-reactive globe
function RadarGlobe() {
  const globeRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const pulseRef1 = useRef<THREE.Mesh>(null);
  const pulseRef2 = useRef<THREE.Mesh>(null);
  const pulseRef3 = useRef<THREE.Mesh>(null);
  const { pointer } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (globeRef.current) {
      globeRef.current.rotation.y = t * 0.12;
      // Mouse reactivity
      globeRef.current.rotation.x = THREE.MathUtils.lerp(
        globeRef.current.rotation.x,
        pointer.y * 0.15,
        0.03
      );
      globeRef.current.rotation.z = THREE.MathUtils.lerp(
        globeRef.current.rotation.z,
        -pointer.x * 0.08,
        0.03
      );
    }
    if (scanRef.current) scanRef.current.rotation.z = t * 0.6;
    // Sonar pulse rings
    const pulses = [pulseRef1, pulseRef2, pulseRef3];
    pulses.forEach((ref, i) => {
      if (!ref.current) return;
      const phase = ((t * 0.4 + i * 1.2) % 3.6) / 3.6;
      const scale = 2 + phase * 3;
      ref.current.scale.setScalar(scale);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.15;
    });
  });

  return (
    <group ref={globeRef}>
      {/* Main wireframe sphere â€” emissive for bloom */}
      <mesh>
        <sphereGeometry args={[2, 48, 48]} />
        <meshBasicMaterial color={[0, 2, 1.6]} wireframe transparent opacity={0.08} toneMapped={false} />
      </mesh>
      {/* Inner core glow */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color={[0, 5, 3]} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      {/* Core glow sphere */}
      <mesh>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial color={[0.2, 0.5, 2]} transparent opacity={0.04} toneMapped={false} />
      </mesh>

      {/* Radar scan wedge */}
      <mesh ref={scanRef} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2, 64, 0, Math.PI / 4]} />
        <meshBasicMaterial color={[0, 4, 2.5]} transparent opacity={0.12} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* Equator ring â€” GLOWING */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.012, 16, 128]} />
        <meshBasicMaterial color={[0, 6, 4]} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      {/* Tilted ring 1 */}
      <mesh rotation={[Math.PI / 3, 0.5, 0]}>
        <torusGeometry args={[2.4, 0.006, 16, 128]} />
        <meshBasicMaterial color={[2, 1, 5]} transparent opacity={0.4} toneMapped={false} />
      </mesh>
      {/* Tilted ring 2 */}
      <mesh rotation={[Math.PI / 2, Math.PI / 3, 0.3]}>
        <torusGeometry args={[2.7, 0.004, 16, 128]} />
        <meshBasicMaterial color={[0, 4, 1.5]} transparent opacity={0.25} toneMapped={false} />
      </mesh>

      {/* Sonar pulse rings */}
      <mesh ref={pulseRef1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.015, 8, 64]} />
        <meshBasicMaterial color={[0, 3, 2]} transparent opacity={0.15} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.01, 8, 64]} />
        <meshBasicMaterial color={[0, 3, 2]} transparent opacity={0.1} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef3} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.008, 8, 64]} />
        <meshBasicMaterial color={[0, 3, 2]} transparent opacity={0.08} toneMapped={false} />
      </mesh>

      {/* Data points */}
      <OrbitingDots count={30} radius={2.15} color={[0, 5, 3]} size={0.025} />
      <OrbitingDots count={20} radius={2.5} color={[2, 1.2, 6]} size={0.02} />
      <OrbitingDots count={15} radius={2.85} color={[0, 4, 1.5]} size={0.018} />

      {/* Connection lines between dots */}
      <ConnectionLines />
    </group>
  );
}

function OrbitingDots({ count, radius, color, size }: { count: number; radius: number; color: [number, number, number]; size: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      arr.push({ phi, theta, speed: 0.15 + Math.random() * 0.25, offset: Math.random() * Math.PI * 2, pulseSpeed: 1 + Math.random() * 2 });
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      const angle = t * p.speed + p.offset;
      const r = radius + Math.sin(t * 0.5 + p.offset) * 0.05;
      dummy.position.set(
        r * Math.sin(p.phi) * Math.cos(p.theta + angle),
        r * Math.cos(p.phi),
        r * Math.sin(p.phi) * Math.sin(p.theta + angle)
      );
      const pulse = 0.6 + Math.sin(t * p.pulseSpeed + p.offset) * 0.5;
      dummy.scale.setScalar(pulse);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
    </instancedMesh>
  );
}

function ConnectionLines() {
  const ref = useRef<THREE.LineSegments>(null);
  const lineCount = 12;
  const positions = useMemo(() => new Float32Array(lineCount * 6), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    for (let i = 0; i < lineCount; i++) {
      const a1 = t * 0.2 + i * 0.5;
      const a2 = t * 0.15 + i * 0.7 + 1;
      const r1 = 2.1, r2 = 2.5;
      positions[i * 6] = r1 * Math.sin(a1) * Math.cos(a1 * 0.7);
      positions[i * 6 + 1] = r1 * Math.cos(a1);
      positions[i * 6 + 2] = r1 * Math.sin(a1) * Math.sin(a1 * 0.7);
      positions[i * 6 + 3] = r2 * Math.sin(a2) * Math.cos(a2 * 0.6);
      positions[i * 6 + 4] = r2 * Math.cos(a2);
      positions[i * 6 + 5] = r2 * Math.sin(a2) * Math.sin(a2 * 0.6);
    }
    (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={lineCount * 2} />
      </bufferGeometry>
      <lineBasicMaterial color={[0, 2, 1.2]} transparent opacity={0.15} toneMapped={false} />
    </lineSegments>
  );
}

function FloatingShapes() {
  return (
    <group>
      {[
        { pos: [-5, 2.5, -4] as [number, number, number], color: [0, 3, 2] as [number, number, number], s: 0.15, sp: 1.2 },
        { pos: [5.5, -1.5, -5] as [number, number, number], color: [2, 1, 5] as [number, number, number], s: 0.2, sp: 0.7 },
        { pos: [-4.5, -3, -3] as [number, number, number], color: [0, 4, 1] as [number, number, number], s: 0.12, sp: 1.5 },
        { pos: [6.5, 3.5, -6] as [number, number, number], color: [4, 0.5, 1] as [number, number, number], s: 0.18, sp: 0.9 },
        { pos: [-7, 0.5, -7] as [number, number, number], color: [0, 2.5, 3] as [number, number, number], s: 0.1, sp: 1.6 },
        { pos: [3.5, -4.5, -4] as [number, number, number], color: [1.5, 0.8, 4] as [number, number, number], s: 0.14, sp: 1.1 },
        { pos: [0, 5, -8] as [number, number, number], color: [0, 3, 1.5] as [number, number, number], s: 0.08, sp: 2.0 },
        { pos: [-3, 4, -5] as [number, number, number], color: [3, 0, 2] as [number, number, number], s: 0.11, sp: 1.3 },
      ].map((shape, i) => (
        <Float key={i} speed={shape.sp} rotationIntensity={2.5} floatIntensity={2}>
          <mesh position={shape.pos} scale={shape.s}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={shape.color} wireframe transparent opacity={0.35} toneMapped={false} />
          </mesh>
        </Float>
      ))}
      {[
        { pos: [4.5, 2.5, -9] as [number, number, number], color: [0, 2, 3] as [number, number, number], s: 0.07 },
        { pos: [-6, -2.5, -8] as [number, number, number], color: [1.5, 0.5, 4] as [number, number, number], s: 0.05 },
      ].map((shape, i) => (
        <Float key={100 + i} speed={0.5} rotationIntensity={3} floatIntensity={2.5}>
          <mesh position={shape.pos} scale={shape.s}>
            <torusKnotGeometry args={[1, 0.3, 64, 8]} />
            <meshBasicMaterial color={shape.color} wireframe transparent opacity={0.2} toneMapped={false} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

// HEX data rain (faint background)
function DataRain() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 60;
  const data = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({ x: (Math.random() - 0.5) * 20, y: Math.random() * 15, z: -5 - Math.random() * 15, speed: 0.3 + Math.random() * 0.5 });
    }
    return arr;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    data.forEach((d, i) => {
      const y = ((d.y - t * d.speed) % 15 + 15) % 15 - 7.5;
      dummy.position.set(d.x, y, d.z);
      dummy.scale.set(0.02, 0.06, 0.02);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry />
      <meshBasicMaterial color={[0, 1.5, 1]} transparent opacity={0.08} toneMapped={false} />
    </instancedMesh>
  );
}

export default function RadarScene() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 6.5], fov: 55 }} style={{ background: 'transparent' }} dpr={[1, 1.5]}>
        <color attach="background" args={['#050816']} />
        <Stars radius={60} depth={80} count={4000} factor={3} saturation={0.3} fade speed={0.3} />
        <DataRain />
        <RadarGlobe />
        <FloatingShapes />
        <ambientLight intensity={0.1} />
        <pointLight position={[8, 8, 8]} intensity={0.15} color="#00FFD4" />
        <pointLight position={[-8, -5, -5]} intensity={0.1} color="#8B5CF6" />
        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.8} mipmapBlur intensity={1.2} radius={0.7} />
          <Noise opacity={0.04} />
          <Vignette eskil={false} offset={0.1} darkness={0.8} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
