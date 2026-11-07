import * as THREE from 'three';
import type { PrimitivePart, Vec3 } from '@/types';
import { AssemblyBuilder, box, capsule, cone, cyl, sphere, torus } from './procedural/builder';
import { slug } from './prepareModel';

const PALETTE = ['#f2f5ff', '#3ff0e0', '#ffd84a', '#ff8fc8', '#a98bff', '#6cb6ff', '#ff6b7d', '#19c3b5'];

/**
 * Builds a rough model from an AI-provided list of primitives (one per
 * component). Always presented as an APPROXIMATE model.
 */
export function buildPrimitiveModel(name: string, category: string, parts: PrimitivePart[], descriptions: Map<string, string>): THREE.Group {
  const b = new AssemblyBuilder({ id: `ai-${slug(name)}`, name, category, subtitle: 'AI-generated primitive approximation' });
  const centre = new THREE.Vector3();
  parts.forEach((p) => centre.add(new THREE.Vector3(...p.position)));
  centre.divideScalar(Math.max(1, parts.length));
  const used = new Set<string>();
  parts.slice(0, 40).forEach((p, i) => {
    const [sx, sy, sz] = p.size.map((v) => Math.max(0.01, Math.abs(v))) as Vec3;
    let geo: THREE.BufferGeometry;
    switch (p.shape) {
      case 'cylinder': geo = cyl(sx / 2, sx / 2, sy, 24); geo.scale(1, 1, sz / sx); break;
      case 'sphere': geo = sphere(0.5); geo.scale(sx, sy, sz); break;
      case 'cone': geo = cone(sx / 2, sy); geo.scale(1, 1, sz / sx); break;
      case 'torus': geo = torus(sx / 2 - sy / 4, sy / 4, 10, 32); geo.scale(1, 1, sz / Math.max(0.01, sy / 2)); break;
      case 'capsule': geo = capsule(sx / 2, Math.max(0.01, sy - sx)); geo.scale(1, 1, sz / sx); break;
      default: geo = box(sx, sy, sz, Math.min(sx, sy, sz) * 0.1);
    }
    let id = slug(p.component) || `part-${i}`;
    while (used.has(id)) id += `-${i}`;
    used.add(id);
    const dir = new THREE.Vector3(...p.position).sub(centre);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    b.part(
      {
        id,
        name: p.component,
        description: descriptions.get(p.component.toLowerCase()) ?? 'Component reported by the AI recogniser.',
        color: /^#[0-9a-f]{6}$/i.test(p.color ?? '') ? p.color! : PALETTE[i % PALETTE.length],
        explode: dir.toArray() as Vec3,
        distance: 0.5,
        confidence: 0.4,
      },
      { geo, pos: p.position, rot: p.rotation },
    );
  });
  return b.build();
}
