import type * as THREE from 'three';
import type { Archetype } from './types';
import { AssemblyBuilder, cyl, ellipsoid, sphere, torus, tube, wrinkle } from './builder';
import type { Vec3 } from '@/types';

const C = { white: '#f2f5ff', cyan: '#3ff0e0', teal: '#19c3b5', pink: '#ff8fc8', yellow: '#ffd84a', purple: '#b7a6ff', coral: '#ff6b7d', red: '#ff5a6e', blue: '#6cb6ff' };
const EDU = 'Educational, simplified anatomy – shapes and positions are schematic.';

export const brain: Archetype = {
  id: 'human-brain',
  name: 'Human Brain',
  category: 'Biology',
  subtitle: 'Lobes, cerebellum and the structures inside',
  keywords: ['brain', 'human brain', 'brain model', 'cerebrum', 'anatomical brain'],
  build() {
    const b = new AssemblyBuilder(this);
    const lobe = (rx: number, ry: number, rz: number, seed: number) => wrinkle(ellipsoid(rx, ry, rz, 48, 32), 0.05, 9, seed);
    const pair = (g: THREE.BufferGeometry, x: number, y: number, z: number) => [
      { geo: g, pos: [x, y, z] as Vec3 },
      { geo: g, pos: [x, y, -z] as Vec3 },
    ];
    b.part({ id: 'frontal', name: 'Frontal lobe', description: 'Front of the cerebrum: planning, decision-making, voluntary movement (motor cortex) and speech production (Broca’s area).', function: 'Executive function and movement.', location: 'Front of each hemisphere', technical: { Note: EDU }, color: C.purple, explode: [1, 0.5, 0], distance: 0.7 }, ...pair(lobe(0.85, 0.72, 0.48, 1), 0.85, 0.35, 0.5));
    b.part({ id: 'parietal', name: 'Parietal lobe', description: 'Top-rear cerebrum: integrates touch, temperature and spatial awareness (somatosensory cortex).', function: 'Sensation and spatial processing.', location: 'Top, behind the frontal lobe', technical: { Note: EDU }, color: C.pink, explode: [-0.2, 1, 0], distance: 0.75 }, ...pair(lobe(0.72, 0.52, 0.48, 2), -0.2, 0.72, 0.5));
    b.part({ id: 'occipital', name: 'Occipital lobe', description: 'Back of the cerebrum containing the primary visual cortex.', function: 'Vision.', location: 'Rear', technical: { Note: EDU }, color: C.coral, explode: [-1, 0.4, 0], distance: 0.75 }, ...pair(lobe(0.5, 0.5, 0.44, 3), -1.05, 0.25, 0.45));
    b.part({ id: 'temporal', name: 'Temporal lobe', description: 'Lower side of each hemisphere: hearing, language comprehension (Wernicke’s area) and memory.', function: 'Hearing, language and memory.', location: 'Sides, above the ears', technical: { Note: EDU }, color: C.yellow, explode: [0.3, -0.3, 1], distance: 0.75 }, ...pair(lobe(0.8, 0.36, 0.34, 4), 0.2, -0.3, 0.66));
    b.part({ id: 'cerebellum', name: 'Cerebellum', description: '“Little brain” under the occipital lobe that fine-tunes balance, posture and coordination.', function: 'Motor coordination.', location: 'Lower back', technical: { Note: EDU }, color: C.pink, explode: [-1, -0.8, 0], distance: 0.7 }, { geo: wrinkle(ellipsoid(0.6, 0.36, 0.88, 48, 32), 0.03, 22, 5), pos: [-0.95, -0.45, 0] });
    const stem = cyl(0.2, 0.13, 0.95, 20);
    b.part({ id: 'brainstem', name: 'Brainstem', description: 'Midbrain, pons and medulla – connects the brain to the spinal cord and controls breathing and heart rate.', function: 'Vital autonomic functions.', location: 'Base, continuing into the spinal cord', technical: { Note: EDU }, color: C.teal, explode: [0, -1, 0], distance: 0.8 }, { geo: stem, pos: [-0.35, -0.85, 0], rot: [0, 0, -0.25] });
    b.part({ id: 'corpus-callosum', name: 'Corpus callosum', description: 'Thick band of nerve fibres connecting the left and right hemispheres.', function: 'Inter-hemisphere communication.', location: 'Deep, along the midline', technical: { Note: EDU }, color: C.yellow, explode: [0.2, 1, 0], distance: 1.1 }, { geo: torus(0.62, 0.08, 10, 40, Math.PI), pos: [-0.05, 0.12, 0], scale: [1.2, 0.7, 1] });
    b.part({ id: 'thalamus', name: 'Thalamus', description: 'Paired relay station that routes sensory signals to the cortex.', function: 'Sensory relay, alertness.', location: 'Centre of the brain', technical: { Note: EDU }, color: C.yellow, explode: [0, 0.4, 1], distance: 1.0 }, ...pair(ellipsoid(0.22, 0.16, 0.13), -0.1, 0.0, 0.15));
    b.part({ id: 'hippocampus', name: 'Hippocampus', description: 'Seahorse-shaped structures in the temporal lobes, essential for forming new memories.', function: 'Memory formation, navigation.', location: 'Inner temporal lobes', technical: { Note: EDU }, color: C.cyan, explode: [0, -0.4, 1], distance: 1.2 },
      { geo: tube([[0.35, -0.3, 0.42], [0.0, -0.22, 0.46], [-0.35, -0.05, 0.4], [-0.45, 0.15, 0.3]], 0.06, false, 24) },
      { geo: tube([[0.35, -0.3, -0.42], [0.0, -0.22, -0.46], [-0.35, -0.05, -0.4], [-0.45, 0.15, -0.3]], 0.06, false, 24) });
    b.part({ id: 'amygdala', name: 'Amygdala', description: 'Almond-shaped nuclei involved in emotion – especially fear – and emotional memory.', function: 'Emotional processing.', location: 'In front of the hippocampus', technical: { Note: EDU }, color: C.pink, explode: [0.6, -0.4, 1], distance: 1.3 }, { geo: sphere(0.08, 14, 10), pos: [0.42, -0.32, 0.4] }, { geo: sphere(0.08, 14, 10), pos: [0.42, -0.32, -0.4] });
    b.part({ id: 'hypothalamus', name: 'Hypothalamus & pituitary', description: 'Hypothalamus regulates hunger, temperature and hormones via the pituitary gland hanging below it.', function: 'Hormonal and homeostatic control.', location: 'Below the thalamus', technical: { Note: EDU }, color: C.pink, explode: [1, -1, 0], distance: 1.0 }, { geo: ellipsoid(0.14, 0.09, 0.12), pos: [0.2, -0.18, 0] }, { geo: sphere(0.07, 12, 10), pos: [0.25, -0.42, 0] }, { geo: cyl(0.02, 0.02, 0.18, 6), pos: [0.23, -0.3, 0] });
    return b.build();
  },
};

export const heart: Archetype = {
  id: 'human-heart',
  name: 'Human Heart',
  category: 'Biology',
  subtitle: 'Four chambers and the great vessels',
  keywords: ['heart', 'human heart', 'heart model', 'anatomical heart'],
  build() {
    const b = new AssemblyBuilder(this);
    b.group('ventricles', 'Ventricles', 'Lower pumping chambers.', [0, -1, 0], 0.2).group('atria', 'Atria', 'Upper receiving chambers.', [0, 1, 0], 0.2).group('vessels', 'Great vessels', 'Arteries and veins at the top of the heart.', [0, 1, 0], 0.3);
    b.part({ id: 'lv', name: 'Left ventricle', parent: 'ventricles', description: 'Thick-walled chamber that pumps oxygenated blood into the aorta.', function: 'Systemic circulation pump.', location: 'Lower left (patient’s left)', technical: { Note: EDU }, color: C.red, explode: [-0.6, -0.4, 0.3], distance: 0.6 }, { geo: wrinkle(ellipsoid(0.62, 0.95, 0.6, 40, 28), 0.02, 6, 2), pos: [-0.3, -0.35, -0.05], rot: [0, 0, 0.35] });
    b.part({ id: 'rv', name: 'Right ventricle', parent: 'ventricles', description: 'Pumps deoxygenated blood to the lungs via the pulmonary artery.', function: 'Pulmonary circulation pump.', location: 'Lower right, front', technical: { Note: EDU }, color: C.pink, explode: [0.6, -0.4, 0.4], distance: 0.6 }, { geo: ellipsoid(0.55, 0.8, 0.45, 40, 28), pos: [0.3, -0.3, 0.2], rot: [0, 0, 0.2] });
    b.part({ id: 'la', name: 'Left atrium', parent: 'atria', description: 'Receives oxygenated blood from the pulmonary veins.', function: 'Collects blood from the lungs.', location: 'Upper left, back', technical: { Note: EDU }, color: C.coral, explode: [-0.8, 0.5, -0.4], distance: 0.6 }, { geo: ellipsoid(0.4, 0.35, 0.4), pos: [-0.35, 0.55, -0.2] });
    b.part({ id: 'ra', name: 'Right atrium', parent: 'atria', description: 'Receives deoxygenated blood from the venae cavae; contains the sinoatrial (pacemaker) node.', function: 'Collects blood from the body.', location: 'Upper right', technical: { Note: EDU }, color: C.purple, explode: [0.8, 0.5, 0], distance: 0.6 }, { geo: ellipsoid(0.42, 0.38, 0.4), pos: [0.45, 0.45, 0.05] });
    b.part({ id: 'aorta', name: 'Aorta', parent: 'vessels', description: 'Largest artery, arching over the heart to supply the body.', function: 'Carries oxygenated blood to the body.', location: 'Top centre, arching left', technical: { Note: EDU }, color: C.red, explode: [-0.3, 1, 0], distance: 0.7 }, { geo: tube([[-0.05, 0.4, 0], [0.0, 1.1, 0.05], [-0.25, 1.45, 0], [-0.6, 1.35, -0.1], [-0.7, 0.9, -0.2], [-0.7, 0.3, -0.3]], 0.14, false, 48) });
    b.part({ id: 'pulmonary', name: 'Pulmonary trunk', parent: 'vessels', description: 'Carries deoxygenated blood from the right ventricle to the lungs.', function: 'Route to the lungs.', location: 'Front, top', technical: { Note: EDU }, color: C.blue, explode: [0.3, 1, 0.6], distance: 0.8 }, { geo: tube([[0.15, 0.3, 0.3], [0.05, 0.95, 0.35], [-0.35, 1.1, 0.3], [-0.75, 1.0, 0.25]], 0.11, false, 32) });
    b.part({ id: 'vena-cava', name: 'Superior vena cava', parent: 'vessels', description: 'Large vein returning blood from the upper body to the right atrium.', function: 'Venous return.', location: 'Upper right', technical: { Note: EDU }, color: C.cyan, explode: [1, 1, 0], distance: 0.8 }, { geo: cyl(0.12, 0.12, 0.8, 18), pos: [0.55, 1.05, -0.05] });
    b.part({ id: 'coronary', name: 'Coronary arteries', description: 'Small arteries on the surface of the heart supplying the heart muscle itself.', function: 'Feed the myocardium.', location: 'Surface', technical: { Note: EDU }, color: C.yellow, explode: [0, 0, 1], distance: 0.9, confidence: 0.8 }, { geo: tube([[-0.1, 0.35, 0.45], [0.05, -0.1, 0.62], [0.0, -0.6, 0.55], [-0.15, -1.1, 0.3]], 0.03, false, 24) }, { geo: tube([[-0.25, 0.35, 0.4], [-0.6, 0.0, 0.45], [-0.8, -0.5, 0.2]], 0.03, false, 24) });
    return b.build();
  },
};

export const biologyArchetypes: Archetype[] = [brain, heart];
