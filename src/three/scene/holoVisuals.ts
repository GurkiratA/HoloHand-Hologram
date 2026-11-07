import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import type { LoadedModel, PartRuntime } from '../models/prepareModel';
import type { RenderMode } from '@/types';
import { createEdgeMaterial, createPointsMaterial, createShellMaterial, makePartUniforms, type PartUniforms } from '../shaders/holoMaterials';

export type Quality = 'low' | 'medium' | 'high';
const POINT_BUDGET: Record<Quality, number> = { low: 22000, medium: 45000, high: 85000 };

interface LayerTargets {
  points: number;
  shell: number;
  fill: number;
  edges: number;
  solid: number;
  size: number;
}

const MODE_TARGETS: Record<RenderMode, LayerTargets> = {
  hologram: { points: 1, shell: 0.55, fill: 0.02, edges: 0.12, solid: 0, size: 2.2 },
  wireframe: { points: 0.12, shell: 0.08, fill: 0, edges: 1, solid: 0, size: 1.8 },
  points: { points: 1, shell: 0, fill: 0, edges: 0, solid: 0, size: 2.8 },
  solid: { points: 0, shell: 0, fill: 0, edges: 0.08, solid: 1, size: 2 },
  xray: { points: 0.18, shell: 1, fill: 0.06, edges: 0.35, solid: 0, size: 1.8 },
};

interface PartVisual {
  part: PartRuntime;
  uniforms: PartUniforms;
  solidMat: THREE.MeshStandardMaterial;
  hl: number;
  dim: number;
}

function triangleArea(geo: THREE.BufferGeometry, scale: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const idx = geo.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const tri = idx ? idx.count / 3 : pos.count / 3;
  const step = Math.max(1, Math.floor(tri / 20000)); // sample huge meshes
  let area = 0;
  for (let t = 0; t < tri; t += step) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    area += b.sub(a).cross(c.sub(a)).length() * 0.5;
  }
  return area * step * scale * scale;
}

/**
 * Builds and animates the holographic render layers (point cloud, fresnel shell,
 * glowing edges, solid) for a prepared model. Everything is imperative so the
 * per-frame update never triggers React renders.
 */
export class HoloVisuals {
  readonly layer = {
    points: { uLayer: { value: 0 }, uSize: { value: 2.2 } },
    shell: { uLayer: { value: 0 }, uFill: { value: 0 } },
    edges: { uLayer: { value: 0 } },
    solid: 0,
  };
  private visuals: PartVisual[] = [];
  private disposables: { dispose(): void }[] = [];

  constructor(model: LoadedModel, quality: Quality) {
    const budget = POINT_BUDGET[quality];
    const meshInfo: { mesh: THREE.Mesh; area: number }[] = [];
    const wp = new THREE.Vector3();
    for (const part of model.parts) {
      for (const mesh of part.meshes) {
        mesh.updateWorldMatrix(true, false);
        mesh.getWorldScale(wp);
        meshInfo.push({ mesh, area: triangleArea(mesh.geometry, (wp.x + wp.y + wp.z) / 3) });
      }
    }
    const totalArea = meshInfo.reduce((s, m) => s + m.area, 0) || 1;
    const areaOf = new Map(meshInfo.map((m) => [m.mesh, m.area]));

    for (const part of model.parts) {
      const uniforms = makePartUniforms(part.meta.color ?? '#3ff0e0');
      const pointsMat = createPointsMaterial(uniforms, this.layer.points);
      const shellMat = createShellMaterial(uniforms, this.layer.shell);
      const edgeMat = createEdgeMaterial(uniforms, this.layer.edges);
      const solidMat = new THREE.MeshStandardMaterial({
        color: part.meta.color,
        emissive: new THREE.Color(part.meta.color).multiplyScalar(0.18),
        roughness: 0.45,
        metalness: 0.25,
        transparent: true,
        opacity: 0,
      });
      this.disposables.push(pointsMat, shellMat, edgeMat, solidMat);

      for (const mesh of part.meshes) {
        const geo = mesh.geometry;
        if (!geo.attributes.normal) geo.computeVertexNormals();
        // point cloud
        const count = Math.max(60, Math.round((budget * (areaOf.get(mesh) ?? 0)) / totalArea));
        const pg = samplePoints(mesh, count);
        if (pg) {
          const pts = new THREE.Points(pg, pointsMat);
          pts.name = '__holo_points';
          pts.raycast = () => {};
          pts.frustumCulled = false;
          mesh.add(pts);
          this.disposables.push(pg);
        }
        // glowing edges (skip very dense meshes)
        const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
        if (tris < 150000) {
          const eg = new THREE.EdgesGeometry(geo, 28);
          const lines = new THREE.LineSegments(eg, edgeMat);
          lines.name = '__holo_edges';
          lines.raycast = () => {};
          mesh.add(lines);
          this.disposables.push(eg);
        }
        // solid clone sharing geometry
        const solid = new THREE.Mesh(geo, solidMat);
        solid.name = '__holo_solid';
        solid.raycast = () => {};
        mesh.add(solid);
        // the original mesh renders the fresnel shell and is the raycast target
        mesh.material = shellMat;
        mesh.renderOrder = 1;
      }
      this.visuals.push({ part, uniforms, solidMat, hl: 0, dim: 1 });
    }
  }

  update(
    dt: number,
    mode: RenderMode,
    sel: { selectedId: string | null; hoveredId: string | null; isolatedId: string | null },
  ) {
    const t = MODE_TARGETS[mode];
    const k = 1 - Math.exp(-dt * 5);
    const L = this.layer;
    L.points.uLayer.value += (t.points - L.points.uLayer.value) * k;
    L.points.uSize.value += (t.size - L.points.uSize.value) * k;
    L.shell.uLayer.value += (t.shell - L.shell.uLayer.value) * k;
    L.shell.uFill.value += (t.fill - L.shell.uFill.value) * k;
    L.edges.uLayer.value += (t.edges - L.edges.uLayer.value) * k;
    L.solid += (t.solid - L.solid) * k;

    const k2 = 1 - Math.exp(-dt * 8);
    for (const v of this.visuals) {
      const id = v.part.meta.id;
      const hlT = id === sel.selectedId ? 1 : id === sel.hoveredId ? 0.7 : 0;
      const dimT = sel.isolatedId ? (id === sel.isolatedId ? 1 : 0) : sel.selectedId ? (id === sel.selectedId ? 1 : 0.28) : 1;
      v.hl += (hlT - v.hl) * k2;
      v.dim += (dimT - v.dim) * k2;
      v.uniforms.uHighlight.value = v.hl;
      v.uniforms.uDim.value = v.dim;
      v.solidMat.opacity = L.solid * v.dim;
      v.solidMat.emissiveIntensity = 1 + v.hl * 2.5;
      v.solidMat.visible = v.solidMat.opacity > 0.01;
      v.part.node.visible = v.dim > 0.02;
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.visuals = [];
  }
}

function samplePoints(mesh: THREE.Mesh, count: number): THREE.BufferGeometry | null {
  try {
    const tmp = new THREE.Mesh(mesh.geometry);
    const sampler = new MeshSurfaceSampler(tmp).build();
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      sampler.sample(p, n);
      pos.set([p.x, p.y, p.z], i * 3);
      nor.set([n.x, n.y, n.z], i * 3);
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    return g;
  } catch {
    return null;
  }
}
