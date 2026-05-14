'use client';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Float, Sparkles, AdaptiveDpr, Stars, Html } from '@react-three/drei';
import { Suspense, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { TextureLoader } from 'three';

function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  
  // Use high-resolution textures for a perfect earth look
  const earthTexture = useLoader(TextureLoader, 'https://unpkg.com/three-globe@2.35.0/example/img/earth-blue-marble.jpg');
  const bumpTexture = useLoader(TextureLoader, 'https://unpkg.com/three-globe@2.35.0/example/img/earth-topology.png');
  const waterTexture = useLoader(TextureLoader, 'https://unpkg.com/three-globe@2.35.0/example/img/earth-water.png');

  useFrame((_, delta) => {
    // Continuous aesthetic rotation
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.1;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.12;
  });

  return (
    <group>
      {/* Main Solid Earth */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <sphereGeometry args={[2.5, 64, 64]} />
        <meshStandardMaterial
          map={earthTexture}
          bumpMap={bumpTexture}
          bumpScale={0.05}
          roughnessMap={waterTexture}
          roughness={0.4}
          metalness={0.1}
          emissive="#112244"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Atmospheric Glow Layer */}
      <mesh ref={cloudsRef} position={[0, 0, 0]}>
        <sphereGeometry args={[2.55, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.15}
          roughness={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      
      {/* Outer Halo */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[2.8, 32, 32]} />
        <meshBasicMaterial
          color="#4488ff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>


    </group>
  );
}
function FloatingGems() {
  return (
    <>
      <Float speed={1.0} rotationIntensity={0.3} floatIntensity={0.5}>
        <mesh position={[-4.5, 2.0, -2]}>
          <octahedronGeometry args={[0.25, 0]} />
          <meshStandardMaterial color="#A67B5B" metalness={0.9} roughness={0.1} emissive="#A67B5B" emissiveIntensity={0.3} />
        </mesh>
      </Float>
      <Float speed={1.3} rotationIntensity={0.2} floatIntensity={0.4}>
        <mesh position={[4.2, 1.5, -1]}>
          <dodecahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color="#C4A882" metalness={0.8} roughness={0.15} emissive="#C4A882" emissiveIntensity={0.2} />
        </mesh>
      </Float>
      <Float speed={0.7} rotationIntensity={0.15} floatIntensity={0.6}>
        <mesh position={[-3.8, -1.5, 1]}>
          <tetrahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial color="#D4A574" metalness={0.85} roughness={0.12} emissive="#D4A574" emissiveIntensity={0.15} />
        </mesh>
      </Float>
    </>
  );
}

function ScrollCamera() {
  const scrollProgress = useRef(0);
  useEffect(() => {
    const h = () => {
      const max = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      scrollProgress.current = window.scrollY / max;
    };
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useFrame((state, delta) => {
    const p = scrollProgress.current;
    const tx = Math.sin(p * Math.PI * 0.6) * 2;
    const ty = 1.0 + p * 3;
    const tz = 7.5 - p * 4;
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, tx, delta * 1.5);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, ty, delta * 1.8);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, tz, delta * 1.8);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function EarthHeroScene({ children }: { children?: React.ReactNode }) {
  const cam = useMemo(() => ({
    fov: 50, near: 0.1, far: 200,
    position: [0, 1.0, 7.5] as [number, number, number],
  }), []);

  return (
    <div className="relative w-full" style={{ minHeight: '100vh', background: '#050505' }}>
      <div className="absolute inset-0">
        <Canvas dpr={[1, 2]} camera={cam} style={{ background: 'transparent' }}>
          <color attach="background" args={['#050505']} />
          <fog attach="fog" args={['#050505', 18, 50]} />
          
          {/* Much brighter lighting so the earth is visible but moody */}
          <ambientLight intensity={1.5} color="#ffffff" />
          <directionalLight position={[5, 3, 5]} intensity={3.5} color="#ffffff" />
          <directionalLight position={[-3, 2, 4]} intensity={2.0} color="#5599DD" />
          <pointLight position={[-5, 2, -3]} intensity={1.5} color="#A67B5B" />
          
          <Suspense fallback={null}>
            <ScrollCamera />
            <Earth />
            <FloatingGems />
            <Stars radius={80} depth={60} count={3000} factor={4} saturation={0.5} fade speed={1.5} />
            <Sparkles count={100} scale={[14, 8, 12]} size={2} speed={0.2} color="#ffffff" />
            <Sparkles count={50} scale={[10, 8, 10]} size={1.5} speed={0.1} color="#4488ff" />
          </Suspense>
          <AdaptiveDpr pixelated />
        </Canvas>
      </div>
      <div className="relative z-10 w-full pointer-events-none">{children}</div>
    </div>
  );
}
