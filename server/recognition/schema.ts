import { z } from 'zod';

/**
 * Shape every provider must return. Kept free of min/max/tuple constraints so it
 * can be used directly as a structured-output JSON schema; values are clamped
 * afterwards in `normalize()`.
 */
export const RecognitionSchema = z.object({
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
    .describe('Rough 3D layout: one primitive per major visible component (max 24). null if not meaningful.'),
  notes: z.string().nullable().describe('Uncertainty, what the user could do to improve recognition'),
});

export type RawRecognition = z.infer<typeof RecognitionSchema>;

const clamp01 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);
const vec3 = (v: unknown, d: number): [number, number, number] => {
  const a = Array.isArray(v) ? v.map(Number) : [];
  return [0, 1, 2].map((i) => (Number.isFinite(a[i]) ? a[i] : d)) as [number, number, number];
};

/** Validates arbitrary provider JSON and clamps values into range. */
export function normalize(raw: unknown, provider: string) {
  const parsed = RecognitionSchema.partial().passthrough().parse(raw);
  return {
    objectName: String(parsed.objectName ?? 'Unknown object'),
    category: String(parsed.category ?? 'Unknown'),
    brand: parsed.brand || null,
    model: parsed.model || null,
    characteristics: (parsed.characteristics ?? []).slice(0, 12),
    components: (parsed.components ?? []).slice(0, 40).map((c) => ({ ...c, confidence: clamp01(c.confidence) })),
    confidence: clamp01(parsed.confidence),
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
