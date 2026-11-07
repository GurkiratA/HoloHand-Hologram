import * as THREE from 'three';
import type { LoadedModel, PartRuntime } from '../models/prepareModel';
import type { ComponentMeta } from '@/types';

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const STAGGER = 0.3;

/**
 * Per-part progress so parts peel away in sequence instead of all at once.
 * Parts with larger travel and deeper hierarchy start slightly later.
 */
export function partProgress(explode: number, index: number, count: number): number {
  if (count <= 1) return easeInOutCubic(explode);
  const delay = (index / (count - 1)) * STAGGER;
  const t = THREE.MathUtils.clamp((explode * (1 + STAGGER) - delay) / 1, 0, 1);
  return easeInOutCubic(t);
}

/**
 * Computes each component's displacement (model space) for a given explode
 * amount. A part inherits the displacement of every ancestor group/part, so
 * sub-assemblies stay together while they separate from the rest.
 */
export function computeDisplacements(
  model: Pick<LoadedModel, 'parts' | 'groups'>,
  explode: number,
  intensity: number,
  out = new Map<string, THREE.Vector3>(),
): Map<string, THREE.Vector3> {
  const metas = new Map<string, ComponentMeta>();
  model.groups.forEach((g) => metas.set(g.id, g));
  model.parts.forEach((p) => metas.set(p.meta.id, p.meta));

  const own = new Map<string, THREE.Vector3>();
  const ordered = [...model.parts].sort((a, b) => a.meta.explodeDistance - b.meta.explodeDistance);
  const order = new Map(ordered.map((p, i) => [p.meta.id, i]));
  const n = model.parts.length;
  for (const g of model.groups) {
    const t = easeInOutCubic(THREE.MathUtils.clamp(explode * 1.15, 0, 1));
    own.set(g.id, new THREE.Vector3(...g.explodeDirection).multiplyScalar(g.explodeDistance * t * intensity));
  }
  for (const p of model.parts) {
    const t = partProgress(explode, order.get(p.meta.id) ?? 0, n);
    const v = p.meta.explodeMode === 'radial' ? new THREE.Vector3() : new THREE.Vector3(...p.meta.explodeDirection);
    own.set(p.meta.id, v.multiplyScalar(p.meta.explodeDistance * t * intensity));
  }
  for (const p of model.parts) {
    const total = (out.get(p.meta.id) ?? new THREE.Vector3()).set(0, 0, 0);
    let cur: string | null = p.meta.id;
    let guard = 0;
    while (cur && guard++ < 16) {
      const d = own.get(cur);
      if (d) total.add(d);
      cur = metas.get(cur)?.parentId ?? null;
    }
    out.set(p.meta.id, total);
  }
  return out;
}

/** Radial parts: how far each child travels outward (model units). */
export function radialAmount(part: PartRuntime, explode: number, intensity: number, index: number, count: number) {
  return part.meta.explodeDistance * partProgress(explode, index, count) * intensity;
}

/** Apply displacements to the scene graph. */
export function applyExplosion(model: LoadedModel, explode: number, intensity: number, scratch: Map<string, THREE.Vector3>) {
  computeDisplacements(model, explode, intensity, scratch);
  const n = model.parts.length;
  model.parts.forEach((p, i) => {
    const d = scratch.get(p.meta.id)!;
    p.node.position.copy(p.rest).add(d).add(p.drag);
    if (p.radial) {
      const amt = radialAmount(p, explode, intensity, i, n) / (p.node.scale.x || 1);
      for (const r of p.radial) r.obj.position.copy(r.rest).addScaledVector(r.dir, amt);
    }
  });
}
