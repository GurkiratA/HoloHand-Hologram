import { ARCHETYPES, type Archetype } from '@/three/models/procedural';
import type { CatalogEntry, RecognitionResult } from '@/types';
import { similarity, titleCase } from '@/utils/text';

export interface LabelEvidence {
  label: string;
  score: number;
  source: string;
}

export interface ArchetypeMatch {
  archetype: Archetype;
  score: number;
  keyword: string;
  label: string;
}

/** ImageNet labels come as "racer, race car, racing car" – split into synonyms. */
const variants = (label: string) =>
  label
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function keywordMatch(text: string, keyword: string): number {
  if (text === keyword) return 1;
  const re = new RegExp(`(^|\\b)${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`);
  if (re.test(text)) return 0.85;
  if (keyword.length > 3 && new RegExp(`(^|\\b)${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`).test(keyword)) return 0.7;
  const s = similarity(text, keyword);
  return s >= 0.5 ? s * 0.6 : 0;
}

/** Best archetype for a set of weighted labels / free-text names. */
export function matchArchetype(evidence: LabelEvidence[], archetypes: Archetype[] = ARCHETYPES): ArchetypeMatch | null {
  let best: ArchetypeMatch | null = null;
  for (const ev of evidence) {
    for (const v of variants(ev.label)) {
      for (const a of archetypes) {
        for (const k of a.keywords) {
          const m = keywordMatch(v, k);
          if (!m) continue;
          const score = m * ev.score;
          if (!best || score > best.score) best = { archetype: a, score, keyword: k, label: ev.label };
        }
      }
    }
  }
  return best;
}

export function searchArchetypes(query: string, limit = 8): ArchetypeMatch[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return ARCHETYPES.map((a) => {
    const s = Math.max(similarity(q, a.name), ...a.keywords.map((k) => keywordMatch(q, k)), a.category.toLowerCase().includes(q) ? 0.4 : 0);
    return { archetype: a, score: s, keyword: '', label: q };
  })
    .filter((m) => m.score > 0.3)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

export function searchCatalog(entries: CatalogEntry[], terms: string[]): { entry: CatalogEntry; score: number } | null {
  let best: { entry: CatalogEntry; score: number } | null = null;
  for (const e of entries) {
    for (const t of terms) {
      const tl = t.toLowerCase();
      const s = Math.max(similarity(tl, e.name), ...e.keywords.map((k) => keywordMatch(tl, k.toLowerCase())));
      if (!best || s > best.score) best = { entry: e, score: s };
    }
  }
  return best && best.score >= 0.6 ? best : null;
}

/** Coarse categories for COCO labels that have no archetype (used for Level 3 results). */
const COCO_CATEGORY: Record<string, string> = {
  'teddy bear': 'Toys', kite: 'Toys', frisbee: 'Sports', 'sports ball': 'Sports', 'baseball bat': 'Sports', 'baseball glove': 'Sports',
  skateboard: 'Sports', surfboard: 'Sports', 'tennis racket': 'Sports', skis: 'Sports', snowboard: 'Sports',
  remote: 'Electronics', 'cell phone': 'Electronics', laptop: 'Electronics', mouse: 'Electronics', keyboard: 'Electronics', tv: 'Electronics',
  microwave: 'Appliances', oven: 'Appliances', toaster: 'Appliances', refrigerator: 'Appliances', 'hair drier': 'Appliances',
  toothbrush: 'Household', vase: 'Household', book: 'Household', clock: 'Household', scissors: 'Tools', umbrella: 'Household',
  handbag: 'Accessories', backpack: 'Accessories', suitcase: 'Accessories', tie: 'Accessories',
  bottle: 'Household', 'wine glass': 'Household', cup: 'Household', fork: 'Kitchen', knife: 'Kitchen', spoon: 'Kitchen', bowl: 'Kitchen',
  banana: 'Food', apple: 'Food', sandwich: 'Food', orange: 'Food', broccoli: 'Food', carrot: 'Food', 'hot dog': 'Food', pizza: 'Food', donut: 'Food', cake: 'Food',
  bicycle: 'Vehicles', car: 'Vehicles', motorcycle: 'Vehicles', airplane: 'Vehicles', bus: 'Vehicles', train: 'Vehicles', truck: 'Vehicles', boat: 'Vehicles',
  chair: 'Furniture', bench: 'Furniture',
  bird: 'Animals', cat: 'Animals', dog: 'Animals', horse: 'Animals', sheep: 'Animals', cow: 'Animals', elephant: 'Animals', bear: 'Animals', zebra: 'Animals', giraffe: 'Animals',
};

export function categoryForLabel(label: string): string {
  return COCO_CATEGORY[label.toLowerCase()] ?? 'Everyday objects';
}

/**
 * Builds a RecognitionResult from on-device evidence only. Components listed
 * are the archetype's *typical* parts and are flagged as such – they are not
 * claimed to be verified on the user's specific object.
 */
export function localResult(evidence: LabelEvidence[], match: ArchetypeMatch | null): RecognitionResult {
  const top = [...evidence].sort((a, b) => b.score - a.score)[0];
  const confidence = match ? Math.min(0.92, match.score) : top ? Math.min(0.6, top.score) : 0;
  const objectName = match ? match.archetype.name : top ? titleCase(variants(top.label)[0]) : 'Unknown object';
  const model = match?.archetype.build();
  const components =
    model?.children
      .map((c) => c.userData.holo)
      .filter(Boolean)
      .map((h: { name: string; description: string; parentId: string | null }) => ({ name: h.name, description: h.description, parent: h.parentId, confidence: 0.5 })) ?? [];
  return {
    objectName,
    category: match ? match.archetype.category : top ? categoryForLabel(top.label) : 'Unknown',
    brand: null,
    model: null,
    characteristics: top ? [`On-device label: “${variants(top.label)[0]}” (${Math.round(top.score * 100)}%)`] : [],
    components,
    confidence,
    searchTerms: match ? [match.archetype.name, ...match.archetype.keywords.slice(0, 3)] : top ? [variants(top.label)[0]] : [],
    archetype: match?.archetype.id ?? null,
    primitiveModel: null,
    provider: 'local',
    evidence,
    notes: match
      ? 'Identified on-device. Brand and exact model cannot be determined locally; components shown are typical for this kind of object.'
      : 'Identified on-device, but no component template exists for this object type.',
  };
}
