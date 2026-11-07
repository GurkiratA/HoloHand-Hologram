import type { Archetype } from './types';
import { AssemblyBuilder, cyl, lathe, torus } from './builder';

const C = { white: '#f2f5ff', cyan: '#3ff0e0', teal: '#19c3b5', pink: '#ff8fc8', yellow: '#ffd84a', purple: '#a98bff', coral: '#ff6b7d', blue: '#6cb6ff' };

export const bottle: Archetype = {
  id: 'bottle',
  name: 'Bottle',
  category: 'Household',
  subtitle: 'Screw-cap drinks bottle',
  keywords: ['bottle', 'water bottle', 'pop bottle', 'soda bottle', 'beer bottle', 'wine bottle', 'water jug', 'pill bottle', 'flask', 'thermos', 'vase'],
  build() {
    const b = new AssemblyBuilder(this);
    b.part({ id: 'body', name: 'Bottle body', description: 'Moulded container (PET plastic, glass or metal).', function: 'Holds the liquid.', location: 'Main volume', color: C.cyan, explode: [0, 0, 0], distance: 0 }, { geo: lathe([[0.001, 0], [0.5, 0], [0.55, 0.1], [0.55, 1.7], [0.4, 2.1], [0.2, 2.35], [0.18, 2.5]], 40) });
    b.part({ id: 'label', name: 'Label', description: 'Printed sleeve or sticker.', function: 'Branding and information.', location: 'Around the middle', color: C.yellow, explode: [0, 0, 1], distance: 0.5, confidence: 0.7 }, { geo: cyl(0.565, 0.565, 0.7, 40), pos: [0, 0.9, 0] });
    b.part({ id: 'neck', name: 'Neck finish', description: 'Threaded neck the cap screws onto.', function: 'Seal interface.', location: 'Top', color: C.white, explode: [0, 1, 0], distance: 0.3 }, { geo: cyl(0.2, 0.2, 0.15, 24), pos: [0, 2.55, 0] }, { geo: torus(0.21, 0.025, 6, 24), pos: [0, 2.48, 0], rot: [Math.PI / 2, 0, 0] });
    b.part({ id: 'cap', name: 'Cap', description: 'Screw cap with tamper ring.', function: 'Seals the bottle.', location: 'Very top', color: C.pink, explode: [0, 1, 0], distance: 0.7 }, { geo: cyl(0.24, 0.24, 0.25, 24), pos: [0, 2.72, 0] });
    b.part({ id: 'base', name: 'Base', description: 'Reinforced (often petaloid) bottom.', function: 'Stability and pressure resistance.', location: 'Bottom', color: C.purple, explode: [0, -1, 0], distance: 0.45 }, { geo: cyl(0.5, 0.45, 0.12, 40), pos: [0, 0.06, 0] });
    return b.build();
  },
};

export const mug: Archetype = {
  id: 'mug',
  name: 'Mug',
  category: 'Household',
  subtitle: 'Ceramic cup with handle',
  keywords: ['cup', 'mug', 'coffee mug', 'coffee cup', 'teacup', 'tea cup', 'beaker', 'espresso', 'measuring cup'],
  build() {
    const b = new AssemblyBuilder(this);
    b.part({ id: 'body', name: 'Cup body', description: 'Ceramic or glass vessel.', function: 'Holds the drink.', location: 'Main', color: C.white, explode: [0, 0, 0], distance: 0 }, { geo: lathe([[0.001, 0.05], [0.62, 0.05], [0.66, 1.3], [0.6, 1.3], [0.56, 0.12], [0.001, 0.12]], 48) });
    b.part({ id: 'handle', name: 'Handle', description: 'Loop for holding a hot drink.', function: 'Grip, heat isolation.', location: 'Side', color: C.cyan, explode: [1, 0, 0], distance: 0.6 }, { geo: torus(0.32, 0.07, 10, 28, Math.PI), pos: [0.66, 0.7, 0], rot: [0, 0, -Math.PI / 2] });
    b.part({ id: 'rim', name: 'Rim', description: 'Rounded lip.', function: 'Comfortable drinking edge.', location: 'Top', color: C.yellow, explode: [0, 1, 0], distance: 0.5 }, { geo: torus(0.63, 0.03, 6, 48), pos: [0, 1.3, 0], rot: [Math.PI / 2, 0, 0] });
    b.part({ id: 'foot', name: 'Foot ring', description: 'Unglazed base ring.', function: 'Stable footing.', location: 'Bottom', color: C.purple, explode: [0, -1, 0], distance: 0.5 }, { geo: torus(0.5, 0.04, 6, 40), pos: [0, 0.04, 0], rot: [Math.PI / 2, 0, 0] });
    return b.build();
  },
};

export const householdArchetypes: Archetype[] = [bottle, mug];
