import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ComponentExtras, Vec3 } from '@/types';

/**
 * Small DSL used by every procedural archetype (and by the script that bakes the
 * sample GLB files). Each component becomes a named THREE.Group whose
 * `userData.holo` carries the component metadata, so it survives a GLB
 * round-trip as glTF node `extras`.
 */

export interface PartSpec {
  id: string;
  name: string;
  parent?: string | null;
  description: string;
  function?: string;
  location?: string;
  technical?: Record<string, string>;
  color: string;
  /** Direction of travel when exploded (model space, need not be normalised). */
  explode: Vec3;
  /** Travel at 100 % explode as a fraction of model radius. Default 0.55. */
  distance?: number;
  confidence?: number;
  explodeMode?: 'linear' | 'radial';
}

export interface GeoPlacement {
  geo: THREE.BufferGeometry;
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
}

export interface ArchetypeInfo {
  id: string;
  name: string;
  category: string;
  subtitle: string;
}

export class AssemblyBuilder {
  readonly root = new THREE.Group();
  private groups: ComponentExtras[] = [];
  private materials = new Map<string, THREE.MeshStandardMaterial>();

  constructor(private info: ArchetypeInfo) {
    this.root.name = info.id;
  }

  /** A virtual grouping node (no geometry) used for the component tree and hierarchical explosion. */
  group(id: string, name: string, description: string, explode: Vec3, distance = 0.25, parent: string | null = null) {
    this.groups.push({
      id,
      name,
      parentId: parent,
      description,
      explodeDirection: explode,
      explodeDistance: distance,
      confidence: 1,
      source: 'procedural',
      isGroup: true,
    });
    return this;
  }

  part(spec: PartSpec, ...geos: GeoPlacement[]) {
    const node = new THREE.Group();
    node.name = spec.id;
    const mat = this.material(spec.color);
    for (const g of geos) {
      const mesh = new THREE.Mesh(g.geo, mat);
      mesh.name = `${spec.id}_mesh`;
      if (g.pos) mesh.position.set(...g.pos);
      if (g.rot) mesh.rotation.set(...g.rot);
      if (g.scale) mesh.scale.set(...g.scale);
      node.add(mesh);
    }
    const extras: ComponentExtras = {
      id: spec.id,
      name: spec.name,
      parentId: spec.parent ?? null,
      description: spec.description,
      function: spec.function,
      location: spec.location,
      technical: spec.technical,
      explodeDirection: spec.explode,
      explodeDistance: spec.distance ?? 0.55,
      confidence: spec.confidence ?? 1,
      source: 'procedural',
      color: spec.color,
      explodeMode: spec.explodeMode,
    };
    node.userData.holo = stripUndefined(extras);
    this.root.add(node);
    return node;
  }

  build(): THREE.Group {
    this.root.userData.holoGroups = this.groups.map(stripUndefined);
    this.root.userData.holoModel = { ...this.info };
    return this.root;
  }

  private material(color: string) {
    let m = this.materials.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
      this.materials.set(color, m);
    }
    return m;
  }
}

function stripUndefined<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

// ------------------------------------------------------------------ geometry helpers

export const box = (w: number, h: number, d: number, r = 0) =>
  r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);

export const cyl = (rTop: number, rBottom: number, h: number, seg = 24) =>
  new THREE.CylinderGeometry(rTop, rBottom, h, seg);

export const sphere = (r: number, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);

export const torus = (r: number, tube: number, rs = 12, ts = 32, arc = Math.PI * 2) =>
  new THREE.TorusGeometry(r, tube, rs, ts, arc);

export const cone = (r: number, h: number, seg = 24) => new THREE.ConeGeometry(r, h, seg);

export const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 16);

/** Revolve a 2D profile [radius, y][] around the Y axis. */
export const lathe = (pts: [number, number][], seg = 40) =>
  new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

/** Extrude a closed 2D outline (in XY) along Z by `depth`, centred on Z. */
export function extrude(pts: [number, number][], depth: number, bevel = 0) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Tube along a polyline / smooth curve through points. */
export function tube(points: Vec3[], radius: number, closed = false, seg = 48) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(curve, seg, radius, 8, closed);
}

/** Wheel lying in the XY plane (axle along Z): tyre torus + rim disc + hub. */
export function wheelGeos(radius: number, width: number): GeoPlacement[] {
  const tyre = new THREE.TorusGeometry(radius - width * 0.35, width * 0.42, 12, 36);
  tyre.scale(1, 1, width / (width * 0.84));
  const rim = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.7, 24);
  rim.rotateX(Math.PI / 2);
  return [{ geo: tyre }, { geo: rim }];
}

/** Merge several placed geometries into one (useful for many small repeated parts). */
export function merged(parts: GeoPlacement[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()) as THREE.BufferGeometry;
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
    }
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
      new THREE.Vector3(...(p.scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(m);
    return g;
  });
  return mergeGeometries(geos, false) ?? geos[0];
}

/** Deterministic pseudo-noise used to add organic folds to biological models. */
export function wrinkle(geo: THREE.BufferGeometry, amp: number, freq: number, seed = 1) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * freq + seed) * Math.sin(v.y * freq * 1.3 + seed * 2) * Math.sin(v.z * freq * 0.9 + seed * 3) +
      0.5 * Math.sin(v.x * freq * 2.1 + v.z * freq * 1.7 + seed);
    const len = v.length() || 1;
    v.multiplyScalar(1 + (amp * n) / len);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Ellipsoid helper. */
export function ellipsoid(rx: number, ry: number, rz: number, w = 32, h = 20) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return g;
}
