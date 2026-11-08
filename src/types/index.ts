// Shared domain types for HoloHand AI.

export type Vec3 = [number, number, number];

/**
 * How trustworthy the 3D geometry is.
 *  - catalog:      Level 1 – a catalog GLB with named component meshes + metadata.
 *  - approximate:  Level 2 – procedural archetype or AI-generated primitive layout.
 *  - recognition:  Level 3 – object identified, no reliable component-level model.
 *  - user:         A user-uploaded GLB/GLTF; meshes become components.
 */
export type ModelLevel = 'catalog' | 'approximate' | 'recognition' | 'user';

export type ComponentSource = 'catalog' | 'procedural' | 'ai' | 'mesh-name' | 'user';

export interface ComponentMeta {
  id: string;
  name: string;
  parentId: string | null;
  description: string;
  /** What the part does. */
  function?: string;
  /** Short human-readable location inside the assembly. */
  location?: string;
  technical?: Record<string, string>;
  /** Unit vector (model space) the part travels along when exploded. */
  explodeDirection: Vec3;
  /** Travel distance at 100 % explode, in normalised model units (model radius = 1). */
  explodeDistance: number;
  /** Rest position (model space), filled in at load time. */
  originalPosition: Vec3;
  /** 0..1 – how confident we are that this part exists as described on the real object. */
  confidence: number;
  source: ComponentSource;
  color?: string;
  /** Virtual grouping node with no geometry of its own (e.g. "Front assembly"). */
  isGroup?: boolean;
  /**
   * linear: the whole part travels along explodeDirection.
   * radial: each child mesh travels outward from the part's centre (e.g. 9 cylinders of a radial engine).
   */
  explodeMode?: 'linear' | 'radial';
  /** Set when an AI provider supplied or confirmed this component's description. */
  aiNote?: string;
}

/** Metadata stored in GLB node extras (userData.holo) by our generators. */
export type ComponentExtras = Omit<ComponentMeta, 'originalPosition'> & { originalPosition?: Vec3 };

export interface ModelDescriptor {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  level: ModelLevel;
  /** Human readable origin, e.g. "Local catalog", "Procedural archetype: car". */
  sourceLabel: string;
  /** Shown prominently – why this model may differ from the real object. */
  disclaimer?: string;
  license?: string;
  attribution?: string;
  components: ComponentMeta[];
  /** Components the recogniser reported that have no geometry in this model. */
  unmodelledComponents?: { name: string; description: string }[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  /** URL (relative to site root or absolute) of a .glb file. */
  file: string;
  keywords: string[];
  license: string;
  attribution: string;
  /** e.g. "Illustrative test asset" – shown to the user. */
  note?: string;
  source?: string;
  /** Procedural archetype this catalog model supersedes (hidden from the playlist). */
  archetype?: string;
}

// ---------------------------------------------------------------- recognition

export type RecognitionProviderId = 'local' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'manual';

export interface RecognizedComponent {
  name: string;
  description: string;
  parent?: string | null;
  /** 0..1 – visibility / likelihood estimated by the provider. */
  confidence?: number;
}

export type PrimitiveShape = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'capsule';

/** AI-generated rough geometry: one primitive per component. */
export interface PrimitivePart {
  component: string;
  shape: PrimitiveShape;
  /** Size in the object's own units (x, y, z); normalised client side. */
  size: Vec3;
  position: Vec3;
  rotation?: Vec3;
  color?: string;
}

export interface RecognitionResult {
  objectName: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  characteristics: string[];
  components: RecognizedComponent[];
  /** 0..1 */
  confidence: number;
  searchTerms: string[];
  /** Optional hint for a local archetype id (see knowledge base). */
  archetype?: string | null;
  primitiveModel?: PrimitivePart[] | null;
  orientation?: string | null;
  provider: RecognitionProviderId;
  /** Raw local labels that led to the result (for transparency). */
  evidence?: { label: string; score: number; source: string }[];
  notes?: string | null;
  /** Cloud only: false when the AI saw no object in the hand. */
  holdingObject?: boolean;
}

export type ConfidenceBand = 'high' | 'medium' | 'low';

// ---------------------------------------------------------------- gestures

export type GestureId =
  | 'open'
  | 'fist'
  | 'point'
  | 'pinch'
  | 'thumbsUp'
  | 'twoHands'
  | 'swipe'
  | 'move'
  | 'clear';

export type HandPose = 'open' | 'fist' | 'point' | 'pinch' | 'thumbsUp' | 'clear' | 'neutral';

export interface ScreenPoint {
  /** Normalised viewport coordinates (0..1), already mirrored for selfie view. */
  x: number;
  y: number;
}

export type RenderMode = 'hologram' | 'wireframe' | 'points' | 'solid' | 'xray';

export type AppMode = 'live' | 'explore' | 'exploded' | 'assembly' | 'library' | 'manual';
