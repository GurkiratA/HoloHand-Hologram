import { z } from 'zod';

/**
 * Shape every provider must return. Kept free of min/max/tuple constraints so it
 * can be used directly as a structured-output JSON schema; values are clamped
 * afterwards in `normalize()`.
 */
export const RecognitionSchema = z.object({
  holdingObject: z.boolean().describe('true if the person is clearly holding or presenting an object; false for an empty hand or no object'),
  objectName: z.string().describe('Specific but honest name, e.g. "Toy Formula 1 car". Never invent a brand.'),
  category: z.string().describe('e.g. Toy / Motorsport, Electronics, Biology model'),
  brand: z.string().nullable().describe('Only if clearly visible (logo/text); otherwise null'),
  model: z.string().nullable().describe('Only if clearly identifiable; otherwise null'),
  characteristics: z.array(z.string()).describe('Visible physical characteristics: colours, materials, scale, markings'),
  components: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().describe('What it is / does. Say "typically" for parts not directly visible.'),
        parent: z.string().nullable(),
        confidence: z.number().describe('0..1 – how sure you are this part exists on THIS object'),
      }),
    )
    .describe('Identifiable components, outer to inner. Do not present hidden internals as verified.'),
  confidence: z.number().describe('0..1 overall identification confidence'),
  searchTerms: z.array(z.string()).describe('3–6 terms to search a 3D model catalog'),
  archetype: z.string().nullable().describe('Closest id from the provided archetype list, or null'),
  orientation: z.string().nullable().describe('How the object is held / facing, e.g. "side view, nose pointing left"'),
  primitiveModel: z
    .array(
      z.object({
        component: z.string(),
        shape: z.enum(['box', 'cylinder', 'sphere', 'cone', 'torus', 'capsule']),
        size: z.array(z.number()).describe('[x, y, z] in arbitrary consistent units'),
        position: z.array(z.number()).describe('[x, y, z] centre, y up, object centred near origin'),
        rotation: z.array(z.number()).nullable().describe('[x, y, z] Euler radians, or null'),
        color: z.string().nullable().describe('#rrggbb'),
      }),
    )
    .nullable()
    .describe('3D approximation of THIS object built from primitives: one or more per visible part (max 32), real proportions and colours.'),
  notes: z.string().nullable().describe('Uncertainty, what the user could do to improve recognition'),
});

export type RawRecognition = z.infer<typeof RecognitionSchema>;

const clamp01 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);
const vec3 = (v: unknown, d: number): [number, number, number] => {
  const a = Array.isArray(v) ? v.map(Number) : [];
  return [0, 1, 2].map((i) => (Number.isFinite(a[i]) ? a[i] : d)) as [number, number, number];
};

const SHAPES = new Set(['box', 'cylinder', 'sphere', 'cone', 'torus', 'capsule']);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : v == null ? d : String(v));

/**
 * Smaller models often send null or the wrong type for fields they have nothing to say about
 * (e.g. objectName: null for an empty hand). Coerce those into shape instead of rejecting the reply.
 */
function tidy(raw: unknown): Record<string, unknown> {
  if (!isObj(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (v !== null) out[k] = v;
  if (typeof out.confidence !== 'number') delete out.confidence;
  if (typeof out.holdingObject !== 'boolean') delete out.holdingObject;
  for (const k of ['objectName', 'category', 'brand', 'model', 'archetype', 'orientation', 'notes']) if (k in out) out[k] = str(out[k], '');
  for (const k of ['characteristics', 'searchTerms']) out[k] = Array.isArray(out[k]) ? (out[k] as unknown[]).filter((x) => typeof x === 'string') : [];
  out.components = Array.isArray(out.components)
    ? (out.components as unknown[]).filter(isObj).map((c) => ({
        name: str(c.name, 'Part'),
        description: str(c.description, ''),
        parent: typeof c.parent === 'string' ? c.parent : null,
        confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
      }))
    : [];
  if (Array.isArray(out.primitiveModel)) {
    out.primitiveModel = (out.primitiveModel as unknown[]).filter(isObj).map((p) => ({
      component: str(p.component, 'Part'),
      shape: SHAPES.has(p.shape as string) ? p.shape : 'box',
      size: Array.isArray(p.size) ? p.size : [1, 1, 1],
      position: Array.isArray(p.position) ? p.position : [0, 0, 0],
      rotation: Array.isArray(p.rotation) ? p.rotation : null,
      color: typeof p.color === 'string' ? p.color : null,
    }));
  } else delete out.primitiveModel;
  return out;
}

/** Validates arbitrary provider JSON and clamps values into range. */
export function normalize(raw: unknown, provider: string) {
  const parsed = RecognitionSchema.partial().passthrough().parse(tidy(raw));
  const holding = parsed.holdingObject !== false;
  return {
    holdingObject: holding,
    objectName: holding ? String(parsed.objectName ?? 'Unknown object') : '',
    category: String(parsed.category ?? 'Unknown'),
    brand: parsed.brand || null,
    model: parsed.model || null,
    characteristics: (parsed.characteristics ?? []).slice(0, 12),
    components: (parsed.components ?? []).slice(0, 40).map((c) => ({ ...c, confidence: clamp01(c.confidence) })),
    confidence: holding ? clamp01(parsed.confidence) : 0,
    searchTerms: (parsed.searchTerms ?? []).slice(0, 8),
    archetype: parsed.archetype || null,
    orientation: parsed.orientation || null,
    primitiveModel:
      parsed.primitiveModel?.slice(0, 32).map((p) => ({
        component: p.component,
        shape: p.shape,
        size: vec3(p.size, 1),
        position: vec3(p.position, 0),
        rotation: p.rotation ? vec3(p.rotation, 0) : undefined,
        color: p.color ?? undefined,
      })) ?? null,
    notes: parsed.notes || null,
    provider,
  };
}

export type NormalizedRecognition = ReturnType<typeof normalize>;

export const RecognizeRequest = z.object({
  /** base64 JPEG/PNG, optionally a data URL */
  image: z.string().min(100).max(8_000_000),
  hints: z.array(z.object({ label: z.string(), score: z.number(), source: z.string() })).max(20).optional(),
  archetypes: z.array(z.string()).max(100).optional(),
});

export const DescribeRequest = z.object({
  query: z.string().min(1).max(200),
  archetypes: z.array(z.string()).max(100).optional(),
});

export const MeshDescribeRequest = z.object({
  objectName: z.string().min(1).max(200),
  meshNames: z.array(z.string().max(120)).min(1).max(160),
});

export const MeshDescriptionsSchema = z.object({
  components: z.array(z.object({ meshName: z.string(), name: z.string(), description: z.string(), confidence: z.number() })),
});
