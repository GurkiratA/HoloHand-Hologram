import { describe, expect, it } from 'vitest';
import { matchArchetype, localResult, searchArchetypes, searchCatalog } from '../src/ai/knowledge/resolver';
import { mapComponents } from '../src/ai/componentAnalysis/mapComponents';
import { prepareModel } from '../src/three/models/prepareModel';
import { formulaCar } from '../src/three/models/procedural/vehicles';
import { buildPrimitiveModel } from '../src/three/models/primitiveModel';
import catalog from '../public/models/catalog.json';

describe('knowledge resolver', () => {
  it('maps ImageNet labels to archetypes', () => {
    expect(matchArchetype([{ label: 'racer, race car, racing car', score: 0.8, source: 'classifier' }])?.archetype.id).toBe('formula-car');
    expect(matchArchetype([{ label: 'cellular telephone, cellular phone, cellphone, cell, mobile phone', score: 0.7, source: 'classifier' }])?.archetype.id).toBe('smartphone');
    expect(matchArchetype([{ label: 'coffee mug', score: 0.7, source: 'classifier' }])?.archetype.id).toBe('mug');
  });
  it('maps COCO labels to archetypes', () => {
    expect(matchArchetype([{ label: 'laptop', score: 0.9, source: 'detector' }])?.archetype.id).toBe('laptop');
    expect(matchArchetype([{ label: 'cell phone', score: 0.9, source: 'detector' }])?.archetype.id).toBe('smartphone');
    expect(matchArchetype([{ label: 'bottle', score: 0.9, source: 'detector' }])?.archetype.id).toBe('bottle');
  });
  it('returns null for unrelated labels', () => {
    expect(matchArchetype([{ label: 'banana', score: 0.9, source: 'detector' }])).toBeNull();
  });
  it('builds an honest local result', () => {
    const r = localResult([{ label: 'racer, race car', score: 0.7, source: 'classifier' }], matchArchetype([{ label: 'racer, race car', score: 0.7, source: 'classifier' }]));
    expect(r.brand).toBeNull();
    expect(r.model).toBeNull();
    expect(r.provider).toBe('local');
    expect(r.components.length).toBeGreaterThan(5);
  });
  it('level-3 local result for objects without a template', () => {
    const r = localResult([{ label: 'banana', score: 0.8, source: 'detector' }], null);
    expect(r.objectName).toBe('Banana');
    expect(r.category).toBe('Food');
    expect(r.archetype).toBeNull();
  });
  it('searches the catalog and archetypes', () => {
    expect(searchCatalog(catalog.models, ['Toy Formula 1 car'])?.entry.id).toBe('f1-car');
    expect(searchCatalog(catalog.models, ['banana'])).toBeNull();
    expect(searchArchetypes('phone')[0].archetype.id).toBe('smartphone');
  });
});

describe('component mapping', () => {
  it('matches recognised parts to meshes with synonyms', () => {
    const m = prepareModel(formulaCar.build(), { descriptor: { id: 'x', name: 'x', category: 'x', subtitle: '', level: 'approximate', sourceLabel: '' } });
    const r = mapComponents(m.descriptor.components, [
      { name: 'Front wing', description: 'a' },
      { name: 'Tires', description: 'b' },
      { name: 'Driver helmet', description: 'c' },
    ]);
    expect(r.mapped.get('front-wing')?.name).toBe('Front wing');
    expect(r.unmodelled.map((u) => u.name)).toEqual(['Driver helmet']);
  });
});

describe('AI primitive models', () => {
  it('builds one component per primitive', () => {
    const g = buildPrimitiveModel('Stapler', 'Office', [
      { component: 'Base', shape: 'box', size: [4, 0.5, 1], position: [0, 0, 0] },
      { component: 'Arm', shape: 'box', size: [4, 0.6, 1], position: [0, 1, 0] },
      { component: 'Spring', shape: 'cylinder', size: [0.3, 1, 0.3], position: [-1.5, 0.5, 0] },
    ], new Map([['arm', 'Top lever']]));
    const m = prepareModel(g, { descriptor: { id: 'x', name: 'x', category: 'x', subtitle: '', level: 'approximate', sourceLabel: '' } });
    expect(m.parts.map((p) => p.meta.name)).toEqual(['Base', 'Arm', 'Spring']);
    expect(m.parts[1].meta.description).toBe('Top lever');
  });
});
