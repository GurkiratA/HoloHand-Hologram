import * as THREE from 'three';

/**
 * Shared uniforms driven once per frame by the scene controller.
 * All holographic materials reference the same objects, so updating them is O(1).
 */
export const globalUniforms = {
  uTime: { value: 0 },
  uScanY: { value: 0 },
  uPixelRatio: { value: 1 },
  uReveal: { value: 1 },
};

export interface PartUniforms {
  uColor: { value: THREE.Color };
  uOpacity: { value: number };
  uHighlight: { value: number };
  uDim: { value: number };
}

export function makePartUniforms(color: string): PartUniforms {
  return {
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 1 },
    uHighlight: { value: 0 },
    uDim: { value: 1 },
  };
}

const revealChunk = /* glsl */ `
  float revealMask(vec3 wp) {
    // bottom-to-top materialise sweep (world space, model radius ~1 * scale)
    float edge = mix(-2.5, 2.5, uReveal);
    return smoothstep(edge + 0.05, edge - 0.25, wp.y);
  }
`;

// ------------------------------------------------------------------ point cloud

export function createPointsMaterial(part: PartUniforms, layer: { uLayer: { value: number }; uSize: { value: number } }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...globalUniforms, ...part, ...layer },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPixelRatio; uniform float uSize; uniform float uScanY;
      uniform float uHighlight;
      attribute float aRand;
      varying float vRand; varying float vScan; varying vec3 vWorld;
      void main() {
        vec3 p = position;
        // subtle shimmer / distortion
        p += normal * 0.004 * sin(uTime * 2.0 + aRand * 40.0);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vRand = aRand;
        vScan = 1.0 - smoothstep(0.0, 0.12, abs(wp.y - uScanY));
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        float s = uSize * (0.65 + aRand * 0.7) * (1.0 + 0.6 * vScan + 0.5 * uHighlight);
        gl_PointSize = s * uPixelRatio * (6.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uHighlight; uniform float uDim; uniform float uLayer;
      uniform float uTime; uniform float uReveal;
      varying float vRand; varying float vScan; varying vec3 vWorld;
      ${revealChunk}
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.0, d);
        float twinkle = 0.75 + 0.25 * sin(uTime * 3.0 + vRand * 60.0);
        vec3 col = mix(uColor, vec3(1.0), 0.25 * vScan + 0.35 * uHighlight);
        float a = core * core * twinkle * uOpacity * uLayer * uDim * revealMask(vWorld);
        a *= 0.85 + 0.9 * vScan;
        gl_FragColor = vec4(col * (1.0 + 0.6 * uHighlight), a);
      }
    `,
  });
}

// ------------------------------------------------------------------ fresnel shell (hologram / x-ray)

export function createShellMaterial(part: PartUniforms, layer: { uLayer: { value: number }; uFill: { value: number } }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...globalUniforms, ...part, ...layer },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uHighlight; uniform float uDim; uniform float uLayer;
      uniform float uFill; uniform float uTime; uniform float uScanY; uniform float uReveal;
      varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
      ${revealChunk}
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);
        float lines = 0.5 + 0.5 * sin(vWorld.y * 140.0 - uTime * 4.0);
        float scan = 1.0 - smoothstep(0.0, 0.1, abs(vWorld.y - uScanY));
        float a = (f * 0.9 + uFill + lines * 0.04 + scan * 0.25) * uOpacity * uLayer * uDim * revealMask(vWorld);
        a *= 1.0 + uHighlight * 1.2;
        vec3 col = mix(uColor, vec3(1.0), f * 0.35 + uHighlight * 0.3);
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `,
  });
}

// ------------------------------------------------------------------ glowing edges

export function createEdgeMaterial(part: PartUniforms, layer: { uLayer: { value: number } }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...globalUniforms, ...part, ...layer },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uHighlight; uniform float uDim; uniform float uLayer;
      uniform float uScanY; uniform float uReveal;
      varying vec3 vWorld;
      ${revealChunk}
      void main() {
        float scan = 1.0 - smoothstep(0.0, 0.1, abs(vWorld.y - uScanY));
        vec3 col = mix(uColor, vec3(1.0), 0.4 + 0.4 * scan);
        gl_FragColor = vec4(col, (0.85 + scan) * uOpacity * uLayer * uDim * (1.0 + uHighlight) * revealMask(vWorld));
      }
    `,
  });
}
