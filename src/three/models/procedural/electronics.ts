import type { Archetype } from './types';
import { AssemblyBuilder, box, cyl, merged, torus, tube, ellipsoid, lathe } from './builder';
import type { Vec3 } from '@/types';

const C = { white: '#f2f5ff', cyan: '#3ff0e0', teal: '#19c3b5', pink: '#ff8fc8', yellow: '#ffd84a', purple: '#a98bff', coral: '#ff6b7d', blue: '#6cb6ff' };
const INTERNAL = 'Internal part – not visible from outside; placement follows a typical design.';

export const smartphone: Archetype = {
  id: 'smartphone',
  name: 'Smartphone',
  category: 'Electronics',
  subtitle: 'Slab phone, exploded front to back',
  keywords: ['cell phone', 'cellular telephone', 'mobile phone', 'smartphone', 'phone', 'iphone', 'android phone', 'dial telephone', 'ipod'],
  build() {
    const b = new AssemblyBuilder(this);
    b.part({ id: 'glass', name: 'Cover glass', description: 'Toughened glass protecting the display.', function: 'Protection and touch surface.', location: 'Front', color: C.blue, explode: [0, 0, 1], distance: 1.1 }, { geo: box(1.0, 2.05, 0.02, 0.01), pos: [0, 0, 0.13] });
    b.part({ id: 'display', name: 'Display panel', description: 'OLED or LCD panel with touch digitiser.', function: 'Shows the image, senses touch.', location: 'Behind the glass', color: C.cyan, explode: [0, 0, 1], distance: 0.8 }, { geo: box(0.96, 2.0, 0.04, 0.01), pos: [0, 0, 0.09] });
    b.part({ id: 'frame', name: 'Mid-frame', description: 'Metal frame that forms the sides and stiffens the phone.', function: 'Structure, antenna bands.', location: 'Edges', color: C.white, explode: [0, 0, 0], distance: 0 }, { geo: box(1.04, 2.1, 0.18, 0.1) });
    b.part({ id: 'logic-board', name: 'Logic board', description: 'Main PCB with processor, memory and radios.', function: 'Computing and connectivity.', location: 'Upper interior', color: C.yellow, explode: [0.6, 0.3, 0.5], distance: 0.6, confidence: 0.55, technical: { Note: INTERNAL } }, { geo: box(0.8, 0.7, 0.04), pos: [0, 0.55, 0] }, { geo: box(0.2, 0.2, 0.05), pos: [0.15, 0.6, 0.03] });
    b.part({ id: 'battery', name: 'Battery', description: 'Lithium-ion pouch cell.', function: 'Energy storage.', location: 'Lower interior', color: C.coral, explode: [-0.6, -0.3, 0.4], distance: 0.6, confidence: 0.55, technical: { Note: INTERNAL } }, { geo: box(0.8, 1.05, 0.06, 0.03), pos: [0, -0.35, 0] });
    b.part({ id: 'camera', name: 'Camera module', description: 'Rear camera lenses and sensors.', function: 'Photography.', location: 'Rear top corner', color: C.pink, explode: [0.4, 0.4, -1], distance: 0.8 }, { geo: box(0.38, 0.38, 0.05, 0.08), pos: [-0.25, 0.75, -0.11] }, { geo: cyl(0.08, 0.08, 0.06, 18), pos: [-0.33, 0.83, -0.13], rot: [Math.PI / 2, 0, 0] }, { geo: cyl(0.08, 0.08, 0.06, 18), pos: [-0.33, 0.67, -0.13], rot: [Math.PI / 2, 0, 0] });
    b.part({ id: 'back', name: 'Back cover', description: 'Glass or plastic rear panel.', function: 'Enclosure; may allow wireless charging.', location: 'Rear', color: C.purple, explode: [0, 0, -1], distance: 0.6 }, { geo: box(1.0, 2.05, 0.02, 0.01), pos: [0, 0, -0.1] });
    return b.build();
  },
};

export const laptop: Archetype = {
  id: 'laptop',
  name: 'Laptop',
  category: 'Electronics',
  subtitle: 'Clamshell notebook computer',
  keywords: ['laptop', 'notebook', 'notebook computer', 'macbook', 'chromebook', 'computer'],
  build() {
    const b = new AssemblyBuilder(this);
    b.group('lid', 'Lid assembly', 'Display half of the clamshell.', [0, 0.5, -1], 0.2);
    const tilt: Vec3 = [-0.25, 0, 0];
    b.part({ id: 'display', name: 'Display', description: 'LCD/OLED panel.', function: 'Visual output.', location: 'Lid, front', parent: 'lid', color: C.cyan, explode: [0, 0.3, 1], distance: 0.4 }, { geo: box(2.3, 1.45, 0.02), pos: [0, 0.85, -0.88], rot: tilt });
    b.part({ id: 'lid-shell', name: 'Lid shell', description: 'Back cover of the display.', function: 'Protects the panel.', location: 'Lid, back', parent: 'lid', color: C.white, explode: [0, 0.3, -1], distance: 0.4 }, { geo: box(2.4, 1.55, 0.05, 0.03), pos: [0, 0.85, -0.93], rot: tilt });
    b.part({ id: 'keyboard', name: 'Keyboard', description: 'Key switches and keycaps.', function: 'Text input.', location: 'Top deck', color: C.yellow, explode: [0, 1, 0.2], distance: 0.45 }, { geo: merged(Array.from({ length: 5 * 13 }, (_, i) => ({ geo: box(0.13, 0.03, 0.13, 0.015), pos: [-0.96 + (i % 13) * 0.16, 0.12, -0.6 + Math.floor(i / 13) * 0.16] as Vec3 }))) });
    b.part({ id: 'trackpad', name: 'Trackpad', description: 'Touch-sensitive pointing surface.', function: 'Pointer input.', location: 'Palm rest', color: C.pink, explode: [0, 1, 0.6], distance: 0.45 }, { geo: box(0.8, 0.02, 0.45, 0.02), pos: [0, 0.11, 0.45] });
    b.part({ id: 'base', name: 'Base / top case', description: 'Lower half housing the electronics.', function: 'Structure.', location: 'Bottom half', color: C.white, explode: [0, 0, 0], distance: 0 }, { geo: box(2.4, 0.16, 1.7, 0.05), pos: [0, 0, 0] });
    b.part({ id: 'mainboard', name: 'Mainboard', description: 'CPU, memory, storage and power circuitry.', function: 'Computing.', location: 'Inside base, rear', color: C.purple, explode: [0, -1, -0.3], distance: 0.5, confidence: 0.5, technical: { Note: INTERNAL } }, { geo: box(1.8, 0.03, 0.6), pos: [0, -0.02, -0.45] });
    b.part({ id: 'battery', name: 'Battery', description: 'Lithium-ion battery pack.', function: 'Portable power.', location: 'Inside base, front', color: C.coral, explode: [0, -1, 0.5], distance: 0.5, confidence: 0.5, technical: { Note: INTERNAL } }, { geo: box(1.6, 0.05, 0.55, 0.02), pos: [0, -0.03, 0.35] });
    return b.build();
  },
};

export const mouse: Archetype = {
  id: 'computer-mouse',
  name: 'Computer Mouse',
  category: 'Electronics',
  subtitle: 'Optical mouse',
  keywords: ['mouse', 'computer mouse', 'optical mouse', 'wireless mouse'],
  build() {
    const b = new AssemblyBuilder(this);
    b.part({ id: 'shell', name: 'Top shell', description: 'Ergonomic upper housing.', function: 'Grip and enclosure.', location: 'Top', color: C.white, explode: [0, 1, 0], distance: 0.6 }, { geo: ellipsoid(0.6, 0.35, 1.0, 32, 16), pos: [0, 0.05, 0], scale: [1, 1, 1] });
    b.part({ id: 'buttons', name: 'Buttons', description: 'Left and right click buttons.', function: 'Click input.', location: 'Front top', color: C.cyan, explode: [0, 1, 0.6], distance: 0.9 }, { geo: box(0.26, 0.04, 0.6, 0.02), pos: [0.15, 0.38, 0.45], rot: [0.3, 0, 0] }, { geo: box(0.26, 0.04, 0.6, 0.02), pos: [-0.15, 0.38, 0.45], rot: [0.3, 0, 0] });
    b.part({ id: 'wheel', name: 'Scroll wheel', description: 'Rotary encoder wheel.', function: 'Scrolling.', location: 'Between buttons', color: C.yellow, explode: [0, 1, 0.2], distance: 1.2 }, { geo: cyl(0.1, 0.1, 0.06, 18), pos: [0, 0.4, 0.55], rot: [0, 0, Math.PI / 2] });
    b.part({ id: 'pcb', name: 'Circuit board & sensor', description: 'PCB with optical sensor and switches.', function: 'Tracks motion.', location: 'Inside', color: C.purple, explode: [0, -0.3, 0], distance: 0.3, confidence: 0.55, technical: { Note: INTERNAL } }, { geo: box(0.7, 0.03, 1.2), pos: [0, -0.1, 0] });
    b.part({ id: 'base', name: 'Base plate', description: 'Bottom with skates and sensor window.', function: 'Glides on the surface.', location: 'Bottom', color: C.pink, explode: [0, -1, 0], distance: 0.6 }, { geo: box(1.0, 0.05, 1.8, 0.02), pos: [0, -0.25, 0] });
    return b.build();
  },
};

export const keyboard: Archetype = {
  id: 'keyboard',
  name: 'Keyboard',
  category: 'Electronics',
  subtitle: 'Mechanical-style keyboard',
  keywords: ['keyboard', 'computer keyboard', 'typewriter keyboard', 'mechanical keyboard', 'keypad'],
  build() {
    const b = new AssemblyBuilder(this);
    b.part({ id: 'keycaps', name: 'Keycaps', description: 'Printed caps on top of each switch.', function: 'Finger contact surface.', location: 'Top', color: C.white, explode: [0, 1, 0], distance: 0.6 }, { geo: merged(Array.from({ length: 5 * 15 }, (_, i) => ({ geo: box(0.17, 0.08, 0.17, 0.03), pos: [-1.26 + (i % 15) * 0.18, 0.25, -0.38 + Math.floor(i / 15) * 0.19] as Vec3 }))) });
    b.part({ id: 'switches', name: 'Switches', description: 'Key switch mechanisms (mechanical or membrane).', function: 'Register key presses.', location: 'Under keycaps', color: C.yellow, explode: [0, 0.5, 0], distance: 0.35, confidence: 0.6 }, { geo: merged(Array.from({ length: 5 * 15 }, (_, i) => ({ geo: box(0.1, 0.06, 0.1), pos: [-1.26 + (i % 15) * 0.18, 0.15, -0.38 + Math.floor(i / 15) * 0.19] as Vec3 }))) });
    b.part({ id: 'plate', name: 'Plate & PCB', description: 'Mounting plate and circuit board.', function: 'Holds switches; scans the key matrix.', location: 'Middle layer', color: C.cyan, explode: [0, 0, 0], distance: 0, confidence: 0.6 }, { geo: box(2.8, 0.04, 1.0), pos: [0, 0.08, 0] });
    b.part({ id: 'case', name: 'Case', description: 'Bottom housing.', function: 'Enclosure.', location: 'Bottom', color: C.purple, explode: [0, -1, 0], distance: 0.5 }, { geo: box(2.95, 0.12, 1.12, 0.04), pos: [0, 0, 0] });
    b.part({ id: 'cable', name: 'Cable / connector', description: 'USB cable or wireless receiver.', function: 'Connection to the computer.', location: 'Rear', color: C.pink, explode: [0, 0, -1], distance: 0.5, confidence: 0.6 }, { geo: tube([[0, 0.03, -0.56], [0, 0.03, -0.9], [0.4, 0.03, -1.2]], 0.025, false, 16) });
    return b.build();
  },
};

export const camera: Archetype = {
  id: 'camera',
  name: 'Camera',
  category: 'Electronics',
  subtitle: 'Interchangeable-lens camera',
  keywords: ['camera', 'reflex camera', 'polaroid camera', 'digital camera', 'dslr', 'mirrorless camera', 'lens', 'camera lens', 'lens cap'],
  build() {
    const b = new AssemblyBuilder(this);
    b.part({ id: 'body', name: 'Camera body', description: 'Housing with grip and controls.', function: 'Structure, controls.', location: 'Centre', color: C.white, explode: [0, 0, -0.3], distance: 0.15 }, { geo: box(1.8, 1.1, 0.7, 0.12) }, { geo: box(0.4, 1.0, 0.35, 0.12), pos: [0.75, -0.03, 0.35] });
    b.part({ id: 'lens', name: 'Lens', description: 'Optical glass elements in a barrel.', function: 'Focuses light on the sensor.', location: 'Front', color: C.cyan, explode: [0, 0, 1], distance: 0.9 }, ...[0, 1, 2].map((k) => ({ geo: (() => { const g = cyl(0.42 - k * 0.02, 0.42 - k * 0.02, 0.28, 32); g.rotateX(Math.PI / 2); return g; })(), pos: [-0.1, 0, 0.5 + k * 0.28] as Vec3 })));
    b.part({ id: 'mount', name: 'Lens mount', description: 'Bayonet ring the lens locks into.', function: 'Lens attachment and alignment.', location: 'Front of body', color: C.yellow, explode: [0, 0, 1], distance: 0.45 }, { geo: torus(0.45, 0.04, 8, 36), pos: [-0.1, 0, 0.37] });
    b.part({ id: 'sensor', name: 'Image sensor', description: 'CMOS sensor capturing the image.', function: 'Converts light to data.', location: 'Inside body', color: C.purple, explode: [0, 0.4, 0.5], distance: 0.4, confidence: 0.55, technical: { Note: INTERNAL } }, { geo: box(0.5, 0.36, 0.03), pos: [-0.1, 0, 0.1] });
    b.part({ id: 'viewfinder', name: 'Viewfinder', description: 'Optical or electronic eye-level finder.', function: 'Framing.', location: 'Top', color: C.pink, explode: [0, 1, 0], distance: 0.5 }, { geo: box(0.5, 0.35, 0.6, 0.08), pos: [-0.1, 0.68, -0.05] });
    b.part({ id: 'screen', name: 'Rear screen', description: 'LCD for menus and review.', function: 'Display.', location: 'Back', color: C.blue, explode: [0, 0, -1], distance: 0.5 }, { geo: box(1.1, 0.75, 0.04, 0.03), pos: [-0.2, -0.05, -0.37] });
    b.part({ id: 'battery', name: 'Battery', description: 'Removable lithium-ion pack.', function: 'Power.', location: 'In the grip', color: C.coral, explode: [1, -1, 0], distance: 0.5, confidence: 0.55, technical: { Note: INTERNAL } }, { geo: box(0.25, 0.7, 0.3, 0.04), pos: [0.75, -0.1, 0.1] });
    return b.build();
  },
};

export const headphones: Archetype = {
  id: 'headphones',
  name: 'Headphones',
  category: 'Electronics',
  subtitle: 'Over-ear headphones',
  keywords: ['headphones', 'headphone', 'headset', 'earphones', 'earphone', 'earmuffs'],
  build() {
    const b = new AssemblyBuilder(this);
    const arc: Vec3[] = Array.from({ length: 21 }, (_, i) => { const a = Math.PI * (i / 20); return [Math.cos(a) * 1.0, Math.sin(a) * 1.1 + 0.2, 0]; });
    b.part({ id: 'headband', name: 'Headband', description: 'Adjustable band over the head.', function: 'Clamping and support.', location: 'Top', color: C.white, explode: [0, 1, 0], distance: 0.4 }, { geo: tube(arc, 0.07, false, 40) });
    for (const s of [1, -1]) {
      const side = s > 0 ? 'Right' : 'Left';
      b.part({ id: `cup-${s > 0 ? 'r' : 'l'}`, name: `${side} ear cup`, description: 'Housing for the driver.', function: 'Holds driver; passive isolation.', location: side, color: C.cyan, explode: [s, 0, 0], distance: 0.35 }, { geo: (() => { const g = cyl(0.42, 0.42, 0.25, 32); g.rotateZ(Math.PI / 2); return g; })(), pos: [1.05 * s, -0.05, 0] });
      b.part({ id: `cushion-${s > 0 ? 'r' : 'l'}`, name: `${side} cushion`, description: 'Foam ear pad.', function: 'Comfort and seal.', location: `${side}, inner`, color: C.pink, explode: [-s, -0.2, 0], distance: 0.35 }, { geo: torus(0.33, 0.1, 10, 28), pos: [0.85 * s, -0.05, 0], rot: [0, Math.PI / 2, 0] });
      b.part({ id: `driver-${s > 0 ? 'r' : 'l'}`, name: `${side} driver`, description: 'Dynamic speaker that produces sound.', function: 'Sound output.', location: `Inside ${side.toLowerCase()} cup`, color: C.yellow, explode: [s * 0.3, 1, 0.6], distance: 0.5, confidence: 0.6, technical: { Note: INTERNAL } }, { geo: lathe([[0.02, 0], [0.3, 0.06], [0.32, 0.08]], 24), pos: [0.95 * s, -0.05, 0], rot: [0, 0, (-Math.PI / 2) * s] });
    }
    return b.build();
  },
};

export const electronicsArchetypes: Archetype[] = [smartphone, laptop, mouse, keyboard, camera, headphones];
