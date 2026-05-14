'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, AdaptiveDpr } from '@react-three/drei';
import { Suspense, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';

/* ============================
   RADAR Hero Scene
   R3F + GSAP scroll-parallax
   Inspired by nk10nikhil/hotel-3d-threejs
   ============================ */

function RadarOrb() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15;
  });
  return (
    <mesh ref={meshRef} position={[0, 0.5, 0]}>
      <icosahedronGeometry args={[1.8, 4]} />
      <meshStandardMaterial
        color="#A67B5B"
        metalness={0.6}
        roughness={0.25}
        wireframe
      />
    </mesh>
  );
}

function FloatingGems() {
  return (
    <>
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.5}>
        <mesh position={[-3.2, 1.8, -1]}>
          <octahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color="#C4A882" metalness={0.8} roughness={0.15} />
        </mesh>
      </Float>
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
        <mesh position={[3.0, 2.2, 0.5]}>
          <dodecahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial color="#E8E2DC" metalness={0.5} roughness={0.3} />
        </mesh>
      </Float>
      <Float speed={0.8} rotationIntensity={0.15} floatIntensity={0.6}>
        <mesh position={[-2.5, -0.8, 1.5]}>
          <tetrahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color="#A67B5B" metalness={0.7} roughness={0.2} />
        </mesh>
      </Float>
      <Float speed={1.0} rotationIntensity={0.25} floatIntensity={0.35}>
        <mesh position={[2.8, -0.5, -1.2]}>
          <icosahedronGeometry args={[0.25, 0]} />
          <meshStandardMaterial color="#D6D3D1" metalness={0.6} roughness={0.25} />
        </mesh>
      </Float>
    </>
  );
}

function ScrollCamera() {
  const scrollProgress = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const max = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      scrollProgress.current = window.scrollY / max;
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useFrame((state, delta) => {
    const p = scrollProgress.current;
    const targetY = 2.0 + p * 2.5;
    const targetZ = 8 - p * 4;
    const targetX = Math.sin(p * Math.PI * 0.5) * 1.5;

    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, delta * 1.8);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, delta * 2.0);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, delta * 2.0);
    state.camera.lookAt(0, 0.5, 0);
  });

  return null;
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.4} color="#FAF7F5" />
      <directionalLight position={[5, 8, 5]} intensity={1.2} color="#C4A882" />
      <pointLight position={[-4, 3, -2]} intensity={0.5} color="#E8E2DC" />
      <spotLight position={[0, 6, 0]} intensity={0.4} angle={0.6} penumbra={1} color="#A67B5B" />
    </>
  );
}

export default function RadarHeroScene({ children }: { children?: React.ReactNode }) {
  const cameraConfig = useMemo(() => ({
    fov: 50,
    near: 0.1,
    far: 100,
    position: [0, 2, 8] as [number, number, number],
  }), []);

  return (
    <div className="relative w-full" style={{ minHeight: '100vh', background: '#FAF7F5' }}>
      {/* R3F Canvas */}
      <div className="absolute inset-0" style={{ opacity: 0.3, mixBlendMode: 'multiply' }}>
        <Canvas dpr={[1, 1.5]} camera={cameraConfig} style={{ background: 'transparent' }}>
          <color attach="background" args={['#FAF7F5']} />
          <SceneLights />
          <Suspense fallback={null}>
            <ScrollCamera />
            <RadarOrb />
            <FloatingGems />
            <Sparkles
              count={60}
              scale={[12, 6, 10]}
              size={1.5}
              speed={0.15}
              color="#A67B5B"
            />
          </Suspense>
          <AdaptiveDpr pixelated />
        </Canvas>
      </div>
      {/* Content overlay */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
