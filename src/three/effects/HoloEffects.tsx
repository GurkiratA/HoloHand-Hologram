import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { globalUniforms } from '../shaders/holoMaterials';
import { useHolo } from '@/state/store';

/** Ambient energy particles and a holographic projector ring under the model. */
export function HoloEffects({ rootRef }: { rootRef: RefObject<THREE.Group | null> }) {
  const hasModel = useHolo((s) => !!s.model);
  const group = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);

  const dust = useMemo(() => {
    const n = 420;
    const pos = new Float32Array(n * 3);
    const rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 0.6 + Math.random() * 1.6;
      const a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * r, (Math.random() - 0.5) * 2.6, Math.sin(a) * r], i * 3);
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: globalUniforms.uTime, uPixelRatio: globalUniforms.uPixelRatio },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uPixelRatio; attribute float aRand; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.05 + aRand * 0.12) + 1.3, 2.6) - 1.3;
          float a = uTime * (0.05 + aRand * 0.1);
          p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
          vA = (1.0 - abs(p.y) / 1.3) * (0.3 + 0.7 * aRand);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.5 + aRand * 2.5) * uPixelRatio * (6.0 / -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(0.55, 0.95, 1.0, (0.5 - d) * vA * 0.9); }`,
    });
    return new THREE.Points(g, m);
  }, []);

  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#7ff6ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    [],
  );

  useFrame((_, dt) => {
    const root = rootRef.current;
    if (!root || !group.current) return;
    group.current.position.copy(root.position);
    group.current.scale.setScalar(root.scale.x);
    if (rings.current) {
      rings.current.children.forEach((c, i) => (c.rotation.z += dt * (i % 2 ? -0.4 : 0.6) * (1 + i * 0.3)));
      ringMat.opacity = 0.22 + 0.08 * Math.sin(globalUniforms.uTime.value * 2);
    }
  });

  return (
    <group ref={group} visible={hasModel}>
      <primitive object={dust} />
      <group ref={rings} position={[0, -1.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh material={ringMat}>
          <ringGeometry args={[1.05, 1.08, 96]} />
        </mesh>
        <mesh material={ringMat}>
          <ringGeometry args={[0.8, 0.83, 96, 1, 0, Math.PI * 1.4]} />
        </mesh>
        <mesh material={ringMat}>
          <ringGeometry args={[1.18, 1.2, 96, 1, 0.5, Math.PI * 0.6]} />
        </mesh>
        <mesh material={ringMat}>
          <ringGeometry args={[1.18, 1.2, 96, 1, Math.PI + 0.5, Math.PI * 0.6]} />
        </mesh>
      </group>
    </group>
  );
}
