import type { ComponentMeta, RecognizedComponent } from '@/types';
import { similarity } from '@/utils/text';

export interface MappingResult {
  /** component id -> recognised component that matched it */
  mapped: Map<string, RecognizedComponent>;
  /** recognised components with no matching geometry */
  unmodelled: RecognizedComponent[];
}

/**
 * Maps components reported by a recogniser onto the meshes of a model by name
 * similarity (with synonyms, e.g. tyre/tire, screen/display). Greedy best-first.
 */
export function mapComponents(model: ComponentMeta[], recognized: RecognizedComponent[], threshold = 0.45): MappingResult {
  const pairs: { id: string; r: number; s: number }[] = [];
  recognized.forEach((rc, ri) => {
    for (const c of model) {
      if (c.isGroup) continue;
      const s = Math.max(similarity(rc.name, c.name), similarity(rc.name, c.id.replace(/-/g, ' ')));
      if (s >= threshold) pairs.push({ id: c.id, r: ri, s });
    }
  });
  pairs.sort((a, b) => b.s - a.s);
  const mapped = new Map<string, RecognizedComponent>();
  const usedR = new Set<number>();
  for (const p of pairs) {
    if (mapped.has(p.id) || usedR.has(p.r)) continue;
    mapped.set(p.id, recognized[p.r]);
    usedR.add(p.r);
  }
  // A recognised plural ("wheels") may cover several parts ("Left front wheel", ...)
  recognized.forEach((rc, ri) => {
    if (!usedR.has(ri)) return;
    for (const c of model) {
      if (c.isGroup || mapped.has(c.id)) continue;
      if (similarity(rc.name, c.name) >= 0.66) mapped.set(c.id, rc);
    }
  });
  const unmodelled = recognized.filter((_, i) => !usedR.has(i));
  return { mapped, unmodelled };
}
