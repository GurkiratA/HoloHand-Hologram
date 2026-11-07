import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARCHETYPES, getArchetype, type Archetype } from '@/three/models/procedural';
import { prepareModel, type LoadedModel } from '@/three/models/prepareModel';
import { buildPrimitiveModel } from '@/three/models/primitiveModel';
import { mapComponents } from '@/ai/componentAnalysis/mapComponents';
import { matchArchetype, searchCatalog } from '@/ai/knowledge/resolver';
import type { CatalogEntry, ModelDescriptor, RecognitionResult } from '@/types';
import { storage } from './storageService';

// ------------------------------------------------------------------ catalog

let catalogPromise: Promise<CatalogEntry[]> | null = null;

/** Local catalog (public/models/catalog.json) merged with remote catalogs served by the API. */
export function loadCatalog(): Promise<CatalogEntry[]> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const local = await fetch('/models/catalog.json')
        .then((r) => (r.ok ? (r.json() as Promise<{ models: CatalogEntry[] }>) : { models: [] }))
        .then((j) => j.models.map((m) => ({ ...m, source: m.source ?? 'Local catalog' })))
        .catch(() => [] as CatalogEntry[]);
      const remote = await fetch('/api/catalog')
        .then((r) => (r.ok ? (r.json() as Promise<{ models: CatalogEntry[] }>) : { models: [] }))
        .then((j) => j.models)
        .catch(() => [] as CatalogEntry[]);
      const seen = new Set<string>();
      return [...local, ...remote].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
    })();
  }
  return catalogPromise;
}

// ------------------------------------------------------------------ loaders

const loader = new GLTFLoader();

export async function parseGLB(data: ArrayBuffer): Promise<THREE.Group> {
  const gltf = await loader.parseAsync(data, '');
  return gltf.scene;
}

export async function modelFromCatalog(entry: CatalogEntry): Promise<LoadedModel> {
  const data = await storage.fetchModel(entry.file);
  const scene = await parseGLB(data);
  return prepareModel(scene, {
    descriptor: {
      id: `catalog:${entry.id}`,
      name: entry.name,
      category: entry.category,
      subtitle: entry.subtitle,
      level: 'catalog',
      sourceLabel: entry.source ?? 'Model catalog',
      license: entry.license,
      attribution: entry.attribution,
      disclaimer: entry.note,
    },
    autoSource: 'catalog',
  });
}

export function modelFromArchetype(a: Archetype): LoadedModel {
  return prepareModel(a.build(), {
    descriptor: {
      id: `archetype:${a.id}`,
      name: a.name,
      category: a.category,
      subtitle: a.subtitle,
      level: 'approximate',
      sourceLabel: `Procedural archetype · ${a.id}`,
      disclaimer:
        'APPROXIMATE MODEL – a generic template for this kind of object, not a scan of the item in front of the camera. Proportions, colours and internal parts may differ.',
    },
  });
}

export async function modelFromUpload(name: string, data: ArrayBuffer, id: string): Promise<LoadedModel> {
  const scene = await parseGLB(data);
  return prepareModel(scene, {
    descriptor: {
      id: `upload:${id}`,
      name: name.replace(/\.(glb|gltf)$/i, ''),
      category: 'Your models',
      subtitle: 'Uploaded GLB/GLTF – meshes shown as components',
      level: 'user',
      sourceLabel: 'User upload (stored in this browser)',
      disclaimer: 'Component names come from the mesh/node names in the file. Descriptions are not verified.',
    },
    autoSource: 'mesh-name',
    autoConfidence: 0.5,
    keepMaterialColors: false,
  });
}

// ------------------------------------------------------------------ resolution pipeline

export interface Resolution {
  model: LoadedModel | null;
  descriptor: ModelDescriptor;
  steps: string[];
}

/**
 * STEP 3–5 of the pipeline: find a 3D model for a recognition result.
 *   Level 1 – catalog GLB with component meshes
 *   Level 2 – procedural archetype, or AI-generated primitive approximation
 *   Level 3 – recognition only (no geometry)
 */
export async function resolveModel(rec: RecognitionResult): Promise<Resolution> {
  const steps: string[] = [];
  const terms = [rec.objectName, ...(rec.searchTerms ?? []), rec.category].filter(Boolean) as string[];

  // Level 1
  try {
    const catalog = await loadCatalog();
    const hit = searchCatalog(catalog, terms);
    if (hit) {
      steps.push(`Catalog match: ${hit.entry.name} (${Math.round(hit.score * 100)}%)`);
      const model = await modelFromCatalog(hit.entry);
      annotate(model, rec);
      return { model, descriptor: model.descriptor, steps };
    }
    steps.push('No catalog model matched');
  } catch (e) {
    steps.push(`Catalog unavailable: ${(e as Error).message}`);
  }

  // Level 2a – archetype
  const nameTerms = [rec.objectName, ...(rec.searchTerms ?? [])].filter(Boolean);
  const byName = matchArchetype(nameTerms.map((t, i) => ({ label: t, score: i === 0 ? 1 : 0.85, source: 'name' })));
  const arch = getArchetype(rec.archetype ?? undefined) ?? (byName && byName.score >= 0.55 ? byName.archetype : undefined);
  if (arch) {
    steps.push(`Approximate archetype: ${arch.name}`);
    const model = modelFromArchetype(arch);
    model.descriptor.name = rec.provider === 'local' ? arch.name : rec.objectName;
    annotate(model, rec);
    return { model, descriptor: model.descriptor, steps };
  }

  // Level 2b – AI primitive approximation
  if (rec.primitiveModel && rec.primitiveModel.length >= 2) {
    steps.push('Built AI-generated primitive approximation');
    const desc = new Map(rec.components.map((c) => [c.name.toLowerCase(), c.description]));
    const group = buildPrimitiveModel(rec.objectName, rec.category, rec.primitiveModel, desc);
    const model = prepareModel(group, {
      descriptor: {
        id: `ai:${rec.objectName}`,
        name: rec.objectName,
        category: rec.category,
        subtitle: 'AI-generated primitive approximation',
        level: 'approximate',
        sourceLabel: `AI primitives · ${rec.provider}`,
        disclaimer: 'APPROXIMATE MODEL – boxes, cylinders and spheres laid out by an AI model from the photo. Not an accurate reconstruction.',
      },
    });
    annotate(model, rec);
    return { model, descriptor: model.descriptor, steps };
  }

  // Level 3
  steps.push('No reliable component-level model available');
  const descriptor: ModelDescriptor = {
    id: `recognition:${rec.objectName}`,
    name: rec.objectName,
    category: rec.category,
    subtitle: 'Recognition only',
    level: 'recognition',
    sourceLabel: `Recognition · ${rec.provider}`,
    disclaimer: 'The object was identified, but no reliable component-level 3D model is available. Upload a GLB, or configure a cloud AI provider for a primitive approximation.',
    components: [],
    unmodelledComponents: rec.components.map((c) => ({ name: c.name, description: c.description })),
  };
  return { model: null, descriptor, steps };
}

/** Attach recognised component info (STEP 4: component mapping). */
function annotate(model: LoadedModel, rec: RecognitionResult) {
  if (rec.provider === 'local' || rec.provider === 'manual' || !rec.components.length) return;
  const { mapped, unmodelled } = mapComponents(model.descriptor.components, rec.components);
  for (const p of model.parts) {
    const r = mapped.get(p.meta.id);
    if (r) {
      p.meta.aiNote = r.description;
      p.meta.confidence = Math.max(p.meta.confidence * 0.5, Math.min(1, (r.confidence ?? rec.confidence) * 0.9 + 0.1));
    } else if (model.descriptor.level === 'approximate') {
      p.meta.confidence = Math.min(p.meta.confidence, 0.35);
    }
  }
  model.descriptor.unmodelledComponents = unmodelled.map((u) => ({ name: u.name, description: u.description }));
}

// ------------------------------------------------------------------ playlist ("Next model")

export interface PlaylistItem {
  key: string;
  name: string;
  category: string;
  kind: 'catalog' | 'archetype' | 'upload';
}

export async function playlist(): Promise<PlaylistItem[]> {
  const catalog = await loadCatalog();
  const uploads = await storage.listUploads();
  const covered = new Set(catalog.map((c) => c.archetype).filter(Boolean));
  return [
    ...catalog.map((c) => ({ key: `catalog:${c.id}`, name: c.name, category: c.category, kind: 'catalog' as const })),
    ...ARCHETYPES.filter((a) => !covered.has(a.id)).map((a) => ({ key: `archetype:${a.id}`, name: a.name, category: a.category, kind: 'archetype' as const })),
    ...uploads.map((u) => ({ key: `upload:${u.id}`, name: u.name, category: 'Your models', kind: 'upload' as const })),
  ];
}

export async function loadByKey(key: string): Promise<LoadedModel> {
  const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (kind === 'catalog') {
    const entry = (await loadCatalog()).find((c) => c.id === id);
    if (!entry) throw new Error(`Catalog model ${id} not found`);
    return modelFromCatalog(entry);
  }
  if (kind === 'archetype') {
    const a = getArchetype(id);
    if (!a) throw new Error(`Unknown archetype ${id}`);
    return modelFromArchetype(a);
  }
  if (kind === 'upload') {
    const u = await storage.getUpload(id);
    if (!u) throw new Error('Upload not found');
    return modelFromUpload(u.name, u.data, u.id);
  }
  throw new Error(`Unknown model key ${key}`);
}
