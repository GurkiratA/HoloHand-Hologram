import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { prepareModel } from '../src/three/models/prepareModel';
import { applyExplosion, computeDisplacements } from '../src/three/explosion/explosionEngine';
import { formulaCar } from '../src/three/models/procedural/vehicles';
import { radialEngine } from '../src/three/models/procedural/machines';
import { ARCHETYPES } from '../src/three/models/procedural';

const desc = { id: 't', name: 't', category: 'c', subtitle: '', level: 'approximate' as const, sourceLabel: 'test' };

describe('prepareModel', () => {
  it('normalises to unit radius and keeps component metadata', () => {
    const m = prepareModel(formulaCar.build(), { descriptor: desc });
    const sphere = new THREE.Box3().setFromObject(m.content).getBoundingSphere(new THREE.Sphere());
    expect(sphere.radius).toBeCloseTo(1, 1);
    expect(m.parts.map((p) => p.meta.id)).toContain('front-wing');
    expect(m.groups.map((g) => g.id)).toEqual(['front', 'rear', 'body']);
    expect(m.parts.find((p) => p.meta.id === 'halo')!.meta.parentId).toBe('cockpit');
  });
  it('auto-generates components for models without metadata', () => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); a.name = 'left_door'; a.position.x = -2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); b.name = 'right_door'; b.position.x = 2;
    const wrapper = new THREE.Group(); wrapper.add(a, b); g.add(wrapper);
    const m = prepareModel(g, { descriptor: desc });
    expect(m.parts.map((p) => p.meta.name)).toEqual(['Left door', 'Right door']);
    expect(m.parts[0].meta.explodeDirection[0]).toBeLessThan(0);
    expect(m.parts[1].meta.explodeDirection[0]).toBeGreaterThan(0);
  });
  it('every archetype builds and prepares', () => {
    for (const a of ARCHETYPES) {
      const m = prepareModel(a.build(), { descriptor: desc });
      expect(m.parts.length, a.id).toBeGreaterThan(2);
      for (const p of m.parts) expect(p.meshes.length, `${a.id}/${p.meta.id}`).toBeGreaterThan(0);
    }
  });
});

describe('explosion engine', () => {
  const m = prepareModel(formulaCar.build(), { descriptor: desc });
  it('0 % is fully assembled', () => {
    const d = computeDisplacements(m, 0, 1.4);
    for (const v of d.values()) expect(v.length()).toBeCloseTo(0, 6);
  });
  it('moves parts along their own vectors (not all the same way)', () => {
    const d = computeDisplacements(m, 1, 1);
    expect(d.get('front-wing')!.x).toBeGreaterThan(0.5);
    expect(d.get('rear-wing')!.x).toBeLessThan(-0.5);
    expect(d.get('wheel-fl')!.z).toBeGreaterThan(0.3);
    expect(d.get('wheel-fr')!.z).toBeLessThan(-0.3);
  });
  it('children inherit parent displacement (halo rides with cockpit)', () => {
    const d = computeDisplacements(m, 1, 1);
    expect(d.get('halo')!.y).toBeGreaterThan(d.get('cockpit')!.y);
  });
  it('is monotonic in the explode amount and scales with intensity', () => {
    const at = (e: number, k = 1) => computeDisplacements(m, e, k).get('front-wing')!.length();
    expect(at(0.25)).toBeLessThan(at(0.5));
    expect(at(0.5)).toBeLessThan(at(1));
    expect(at(1, 2)).toBeCloseTo(at(1, 1) * 2, 5);
  });
  it('applyExplosion moves nodes and reassembles exactly', () => {
    const scratch = new Map();
    const wing = m.parts.find((p) => p.meta.id === 'front-wing')!;
    applyExplosion(m, 1, 1.4, scratch);
    expect(wing.node.position.distanceTo(wing.rest)).toBeGreaterThan(0.5);
    applyExplosion(m, 0, 1.4, scratch);
    expect(wing.node.position.distanceTo(wing.rest)).toBeCloseTo(0, 6);
  });
  it('radial parts spread each child outward', () => {
    const e = prepareModel(radialEngine.build(), { descriptor: desc });
    const cyl = e.parts.find((p) => p.meta.id === 'cylinders')!;
    const before = cyl.radial!.map((r) => r.obj.position.length());
    applyExplosion(e, 1, 1, new Map());
    cyl.radial!.forEach((r, i) => expect(r.obj.position.length()).toBeGreaterThan(before[i]));
  });
});
