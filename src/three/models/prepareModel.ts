import * as THREE from 'three';
import type { ComponentExtras, ComponentMeta, ModelDescriptor, Vec3 } from '@/types';
import { prettifyName } from '@/utils/text';

/** Runtime state for one explodable component. */
export interface PartRuntime {
  meta: ComponentMeta;
  /** Direct child of the model content group. */
  node: THREE.Object3D;
  rest: THREE.Vector3;
  /** Centre of the part's bounds in node-local space (label anchor). */
  anchorLocal: THREE.Vector3;
  meshes: THREE.Mesh[];
  /** For explodeMode = 'radial': children that move individually. */
  radial?: { obj: THREE.Object3D; rest: THREE.Vector3; dir: THREE.Vector3 }[];
  /** User drag offset (model space). */
  drag: THREE.Vector3;
  /** Approximate size (bounding radius, normalised units). */
  size: number;
}

export interface LoadedModel {
  descriptor: ModelDescriptor;
  /** Normalised content: centred at origin, bounding radius = 1. Parts are direct children. */
  content: THREE.Group;
  parts: PartRuntime[];
  groups: ComponentMeta[];
  /** For disposal. */
  dispose(): void;
}

const PALETTE = ['#f2f5ff', '#3ff0e0', '#ffd84a', '#ff8fc8', '#a98bff', '#6cb6ff', '#ff6b7d', '#19c3b5'];

function findHoloNodes(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const walk = (o: THREE.Object3D) => {
    if (o !== root && o.userData?.holo) {
      out.push(o);
      return;
    }
    o.children.forEach(walk);
  };
  walk(root);
  return out;
}

function findGroupsMeta(root: THREE.Object3D): ComponentExtras[] {
  let groups: ComponentExtras[] = [];
  root.traverse((o) => {
    if (Array.isArray(o.userData?.holoGroups) && groups.length === 0) groups = o.userData.holoGroups;
  });
  return groups;
}

/** For models without metadata: descend through single-child wrappers and use the first level with several children. */
function findAutoComponents(root: THREE.Object3D): THREE.Object3D[] {
  let level: THREE.Object3D = root;
  for (let depth = 0; depth < 8; depth++) {
    const kids = level.children.filter((c) => hasMesh(c));
    if (kids.length === 1 && kids[0].children.length > 0 && !(kids[0] as THREE.Mesh).isMesh) {
      level = kids[0];
      continue;
    }
    if (kids.length >= 1) {
      // If one child holds almost everything and is itself a group with many children, go deeper.
      return kids;
    }
    break;
  }
  const meshes: THREE.Object3D[] = [];
  root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o));
  return meshes;
}

function hasMesh(o: THREE.Object3D) {
  let found = false;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) found = true;
  });
  return found;
}

function materialColor(o: THREE.Object3D): string | undefined {
  let col: string | undefined;
  o.traverse((c) => {
    const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!col && m && !Array.isArray(m) && m.color) col = '#' + m.color.getHexString();
  });
  return col;
}

export interface PrepareOptions {
  descriptor: Omit<ModelDescriptor, 'components'>;
  /** Default source for components without metadata. */
  autoSource?: ComponentMeta['source'];
  autoConfidence?: number;
  /** Use original material colours when no metadata colour exists (user models). */
  keepMaterialColors?: boolean;
}

/**
 * Normalises any Object3D (procedural group or loaded glTF scene) into the
 * structure the explosion engine and hologram renderer expect.
 */
export function prepareModel(source: THREE.Object3D, opts: PrepareOptions): LoadedModel {
  source.updateMatrixWorld(true);
  let nodes = findHoloNodes(source);
  const hasMeta = nodes.length > 0;
  if (!hasMeta) nodes = findAutoComponents(source);
  if (nodes.length > 160) nodes = nodes.slice(0, 160);

  const content = new THREE.Group();
  content.name = 'holo-content';
  for (const n of nodes) content.attach(n);
  content.updateMatrixWorld(true);

  // Normalise: centre and scale so the bounding sphere radius is 1.
  const box = new THREE.Box3().setFromObject(content);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const s = sphere.radius > 0 ? 1 / sphere.radius : 1;
  for (const n of nodes) {
    n.position.sub(sphere.center).multiplyScalar(s);
    n.scale.multiplyScalar(s);
  }
  content.updateMatrixWorld(true);

  const usedIds = new Set<string>();
  const parts: PartRuntime[] = nodes.map((node, i) => {
    const extras = node.userData.holo as ComponentExtras | undefined;
    const nb = new THREE.Box3().setFromObject(node);
    const centerWorld = nb.getCenter(new THREE.Vector3());
    const size = nb.getBoundingSphere(new THREE.Sphere()).radius;
    const anchorLocal = node.worldToLocal(centerWorld.clone());

    let id = extras?.id ?? slug(node.name || `part-${i + 1}`);
    while (usedIds.has(id)) id = `${id}-${i}`;
    usedIds.add(id);

    let dir: THREE.Vector3;
    let distance: number;
    if (extras) {
      dir = new THREE.Vector3(...extras.explodeDirection);
      distance = extras.explodeDistance;
    } else {
      dir = centerWorld.clone();
      distance = 0.25 + Math.min(0.6, dir.length() * 0.7);
      if (dir.length() < 0.06) {
        dir.set(0, 0, 0);
        distance = 0;
      }
    }
    if (dir.lengthSq() > 0) dir.normalize();

    const meta: ComponentMeta = {
      id,
      name: extras?.name ?? prettifyName(node.name || `Part ${i + 1}`),
      parentId: extras?.parentId ?? null,
      description:
        extras?.description ??
        'Mesh from the model file. No component metadata was provided, so this name comes from the file itself.',
      function: extras?.function,
      location: extras?.location,
      technical: extras?.technical,
      explodeDirection: dir.toArray() as Vec3,
      explodeDistance: distance,
      originalPosition: node.position.toArray() as Vec3,
      confidence: extras?.confidence ?? opts.autoConfidence ?? 0.5,
      source: extras?.source ?? opts.autoSource ?? 'mesh-name',
      color: extras?.color ?? (opts.keepMaterialColors ? materialColor(node) : undefined) ?? PALETTE[i % PALETTE.length],
      explodeMode: extras?.explodeMode,
      aiNote: extras?.aiNote,
    };

    const meshes: THREE.Mesh[] = [];
    node.traverse((c) => (c as THREE.Mesh).isMesh && meshes.push(c as THREE.Mesh));

    let radial: PartRuntime['radial'];
    if (meta.explodeMode === 'radial') {
      radial = node.children.map((c) => {
        const cb = new THREE.Box3().setFromObject(c);
        const cc = node.worldToLocal(cb.getCenter(new THREE.Vector3()));
        const d = cc.clone().sub(anchorLocal);
        d.z *= 0.2;
        if (d.lengthSq() < 1e-8) d.set(0, 1, 0);
        // direction expressed in node-local space but scaled to model units at runtime
        return { obj: c, rest: c.position.clone(), dir: d.normalize() };
      });
    }

    return { meta, node, rest: node.position.clone(), anchorLocal, meshes, radial, drag: new THREE.Vector3(), size };
  });

  const groups: ComponentMeta[] = findGroupsMeta(source).map((g) => {
    const d = new THREE.Vector3(...g.explodeDirection);
    if (d.lengthSq() > 0) d.normalize();
    return { ...g, explodeDirection: d.toArray() as Vec3, originalPosition: [0, 0, 0], isGroup: true };
  });
  // Drop parent references to groups that don't exist.
  const known = new Set([...parts.map((p) => p.meta.id), ...groups.map((g) => g.id)]);
  for (const p of parts) if (p.meta.parentId && !known.has(p.meta.parentId)) p.meta.parentId = null;

  const descriptor: ModelDescriptor = { ...opts.descriptor, components: [...groups, ...parts.map((p) => p.meta)] };

  return {
    descriptor,
    content,
    parts,
    groups,
    dispose() {
      content.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mm) => mm.dispose());
      });
    },
  };
}

export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'part'
  );
}
