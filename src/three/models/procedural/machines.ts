import type { Archetype } from './types';
import { AssemblyBuilder, box, cone, cyl, extrude, merged, sphere, torus, tube, lathe, ellipsoid, type GeoPlacement } from './builder';
import type { Vec3 } from '@/types';

const C = { white: '#f2f5ff', cyan: '#3ff0e0', teal: '#19c3b5', pink: '#ff8fc8', yellow: '#ffd84a', purple: '#a98bff', coral: '#ff6b7d', blue: '#6cb6ff' };

// ------------------------------------------------------------------ Radial aircraft engine

export const radialEngine: Archetype = {
  id: 'radial-engine',
  name: 'Radial Aircraft Engine',
  category: 'Machines',
  subtitle: 'Nine cylinders around one crankshaft',
  keywords: ['radial engine', 'aircraft engine', 'piston engine', 'engine', 'motor', 'radial motor', 'propeller engine'],
  build() {
    const b = new AssemblyBuilder(this);
    const N = 9;
    const at = (r: number, i: number): Vec3 => {
      const a = (i / N) * Math.PI * 2 + Math.PI / 2;
      return [Math.cos(a) * r, Math.sin(a) * r, 0];
    };
    const rotFor = (i: number): Vec3 => [0, 0, (i / N) * Math.PI * 2];
    // finned cylinder pointing up (+Y) – rotated per position
    const finned = merged([
      { geo: cyl(0.2, 0.2, 0.62, 16) },
      ...Array.from({ length: 7 }, (_, k) => ({ geo: cyl(0.28, 0.28, 0.025, 16), pos: [0, -0.25 + k * 0.08, 0] as Vec3 })),
      { geo: cyl(0.16, 0.22, 0.14, 16), pos: [0, 0.38, 0] as Vec3 },
    ]);
    b.part(
      { id: 'cylinders', name: 'Cylinders', description: 'Nine air-cooled cylinders with cooling fins, arranged in a star around the crankcase.', function: 'Combustion chambers – each houses a piston.', location: 'Outer ring', technical: { Count: '9 (single row)', Cooling: 'Air, via fins' }, color: C.white, explode: [0, 0, 0], distance: 0.55, explodeMode: 'radial' },
      ...Array.from({ length: N }, (_, i): GeoPlacement => ({ geo: finned, pos: at(0.95, i), rot: rotFor(i) })),
    );
    b.part(
      { id: 'pistons', name: 'Pistons', description: 'Pistons slide inside the cylinders, driven by combustion pressure.', function: 'Convert gas pressure into linear motion.', location: 'Inside each cylinder', color: C.yellow, explode: [0, 0, 0], distance: 0.42, explodeMode: 'radial' },
      ...Array.from({ length: N }, (_, i): GeoPlacement => ({ geo: box(0.17, 0.15, 0.17, 0.03), pos: at(0.78, i), rot: rotFor(i) })),
    );
    b.part(
      { id: 'rods', name: 'Connecting rods', description: 'One master rod plus eight articulated rods linking the pistons to a single crank pin.', function: 'Transmit piston force to the crankshaft.', location: 'Between pistons and crankshaft', technical: { Arrangement: 'Master-and-articulating rod' }, color: C.yellow, explode: [0, 0, 0], distance: 0.3, explodeMode: 'radial' },
      ...Array.from({ length: N }, (_, i): GeoPlacement => ({ geo: torus(0.06, 0.018, 6, 16), pos: at(0.55, i), rot: rotFor(i) })),
    );
    b.part(
      { id: 'crankcase', name: 'Crankcase', description: 'Central housing that holds the crankshaft and anchors every cylinder.', function: 'Structural core and oil containment.', location: 'Centre', color: C.cyan, explode: [0, 0, 0], distance: 0 },
      { geo: ellipsoid(0.48, 0.48, 0.36) },
      ...Array.from({ length: N }, (_, i): GeoPlacement => ({ geo: cyl(0.015, 0.015, 0.35, 4), pos: at(0.6, i), rot: rotFor(i) })),
    );
    const shaft = cyl(0.07, 0.07, 1.4, 14);
    shaft.rotateX(Math.PI / 2);
    b.part(
      { id: 'crankshaft', name: 'Crankshaft', description: 'Single-throw shaft turned by the connecting rods; drives the propeller.', function: 'Converts reciprocating motion into rotation.', location: 'Through the centre, front to back', color: C.white, explode: [0.6, 1, 0.2], distance: 0.9 },
      { geo: shaft },
      { geo: box(0.5, 0.12, 0.1, 0.03), pos: [0.12, 0, 0] },
    );
    b.part(
      { id: 'prop-hub', name: 'Propeller hub', description: 'Hub and spinner where the propeller blades attach (blades shortened here).', function: 'Transfers engine torque to the propeller.', location: 'Front', color: C.coral, explode: [0.9, 1, 1], distance: 1.3 },
      { geo: (() => { const g = cone(0.22, 0.4, 20); g.rotateX(Math.PI / 2); return g; })(), pos: [0, 0, 0.85] },
      { geo: box(1.5, 0.12, 0.05, 0.03), pos: [0, 0, 0.7] },
    );
    b.part(
      { id: 'exhaust', name: 'Exhaust ring', description: 'Collector ring gathering exhaust from every cylinder.', function: 'Routes hot exhaust gases away.', location: 'Behind the cylinders', color: C.yellow, explode: [-0.6, -0.3, -1], distance: 0.6 },
      { geo: torus(0.9, 0.05, 8, 48), pos: [0, 0, -0.3] },
    );
    b.part(
      { id: 'supercharger', name: 'Supercharger', description: 'Gear-driven impeller that compresses intake air.', function: 'Increases power at altitude.', location: 'Rear accessory section', color: C.coral, explode: [-0.4, -1, -1], distance: 0.8 },
      { geo: cyl(0.36, 0.36, 0.3, 24), pos: [0, 0, -0.55], rot: [Math.PI / 2, 0, 0] },
    );
    return b.build();
  },
};

// ------------------------------------------------------------------ Desk lamp

export const deskLamp: Archetype = {
  id: 'desk-lamp',
  name: 'Desk Lamp',
  category: 'Household',
  subtitle: 'Balanced-arm task lamp',
  keywords: ['lamp', 'desk lamp', 'table lamp', 'lampshade', 'reading lamp', 'spotlight'],
  build() {
    const b = new AssemblyBuilder(this);
    b.part({ id: 'base', name: 'Weighted base', description: 'Heavy base that keeps the lamp stable.', function: 'Stability.', location: 'Bottom', color: C.white, explode: [0, -1, 0], distance: 0.4 }, { geo: cyl(0.55, 0.6, 0.12, 32), pos: [0, 0.06, 0] });
    b.part({ id: 'switch', name: 'Switch', description: 'On/off or dimmer control.', function: 'Power control.', location: 'On the base', color: C.yellow, explode: [1, 0, 0.5], distance: 0.4, confidence: 0.7 }, { geo: cyl(0.06, 0.06, 0.06, 12), pos: [0.35, 0.15, 0.1] });
    b.part({ id: 'lower-arm', name: 'Lower arm', description: 'First arm segment with a hinged joint at the base.', function: 'Reach and height.', location: 'Lower', color: C.cyan, explode: [-1, 0.3, 0], distance: 0.4 }, { geo: tube([[0, 0.15, 0], [-0.3, 1.2, 0]], 0.035, false, 4) }, { geo: sphere(0.07), pos: [0, 0.15, 0] });
    b.part({ id: 'upper-arm', name: 'Upper arm', description: 'Second arm segment.', function: 'Positions the head.', location: 'Upper', color: C.teal, explode: [0, 1, 0], distance: 0.4 }, { geo: tube([[-0.3, 1.2, 0], [0.75, 1.75, 0]], 0.035, false, 4) }, { geo: sphere(0.07), pos: [-0.3, 1.2, 0] });
    const coil = Array.from({ length: 60 }, (_, i): Vec3 => { const t = i / 59; const a = t * Math.PI * 16; return [-0.15 - t * 0.35 + Math.cos(a) * 0.03, 0.5 + t * 0.55, Math.sin(a) * 0.03]; });
    b.part({ id: 'springs', name: 'Balance springs', description: 'Tension springs that counterbalance the arms.', function: 'Hold the arm in any position.', location: 'Alongside the lower arm', color: C.purple, explode: [-1, 0, 0.6], distance: 0.4, confidence: 0.75 }, { geo: tube(coil, 0.008, false, 200) });
    b.part({ id: 'shade', name: 'Shade / head', description: 'Reflector housing that directs the light.', function: 'Light direction.', location: 'End of the arm', color: C.pink, explode: [1, 0.6, 0], distance: 0.45 }, { geo: lathe([[0.04, 0.3], [0.12, 0.25], [0.3, 0.02], [0.34, 0]], 32), pos: [0.85, 1.55, 0], rot: [0, 0, -0.6] });
    b.part({ id: 'bulb', name: 'Bulb / LED', description: 'Light source inside the shade.', function: 'Emits light.', location: 'Inside the shade', color: C.yellow, explode: [0.6, -1, 0], distance: 0.45 }, { geo: sphere(0.1), pos: [0.85, 1.55, 0] });
    return b.build();
  },
};

// ------------------------------------------------------------------ Clock

export const clock: Archetype = {
  id: 'clock',
  name: 'Analog Clock',
  category: 'Household',
  subtitle: 'Wall clock with quartz movement',
  keywords: ['clock', 'wall clock', 'analog clock', 'alarm clock', 'watch', 'wristwatch', 'analog watch', 'stopwatch'],
  build() {
    const b = new AssemblyBuilder(this);
    const face = cyl(1, 1, 0.04, 48); face.rotateX(Math.PI / 2);
    b.part({ id: 'case', name: 'Case / bezel', description: 'Outer ring that holds the glass and dial.', function: 'Housing.', location: 'Rim', color: C.white, explode: [0, 0, -1], distance: 0.3 }, { geo: torus(1.05, 0.08, 10, 64) });
    b.part({ id: 'dial', name: 'Dial', description: 'Face printed with hour markers.', function: 'Time scale.', location: 'Behind the hands', color: C.cyan, explode: [0, 0, -1], distance: 0.55 }, { geo: face, pos: [0, 0, -0.05] }, { geo: merged(Array.from({ length: 12 }, (_, i) => ({ geo: box(0.04, 0.16, 0.02), pos: [Math.sin((i / 12) * Math.PI * 2) * 0.85, Math.cos((i / 12) * Math.PI * 2) * 0.85, -0.01] as Vec3, rot: [0, 0, -(i / 12) * Math.PI * 2] as Vec3 }))) });
    b.part({ id: 'hour-hand', name: 'Hour hand', description: 'Short hand indicating hours.', function: 'Hour display.', location: 'Front centre', color: C.yellow, explode: [0, 0, 1], distance: 0.4 }, { geo: box(0.07, 0.5, 0.02), pos: [0.15, 0.2, 0.03], rot: [0, 0, -0.6] });
    b.part({ id: 'minute-hand', name: 'Minute hand', description: 'Long hand indicating minutes.', function: 'Minute display.', location: 'Front centre', color: C.pink, explode: [0, 0, 1], distance: 0.65 }, { geo: box(0.05, 0.8, 0.02), pos: [-0.3, 0.27, 0.05], rot: [0, 0, 0.85] });
    b.part({ id: 'second-hand', name: 'Second hand', description: 'Thin sweeping hand.', function: 'Seconds display.', location: 'Front centre', color: C.coral, explode: [0, 0, 1], distance: 0.9, confidence: 0.8 }, { geo: box(0.015, 0.9, 0.01), pos: [0, -0.3, 0.07], rot: [0, 0, 0.3] });
    b.part({ id: 'movement', name: 'Movement', description: 'Quartz or mechanical mechanism that drives the hands (internal – typical layout assumed).', function: 'Timekeeping.', location: 'Behind the dial', color: C.purple, explode: [0, 0, -1], distance: 0.9, confidence: 0.5 }, { geo: box(0.55, 0.55, 0.18, 0.04), pos: [0, 0, -0.18] });
    b.part({ id: 'glass', name: 'Glass cover', description: 'Clear protective lens.', function: 'Protects the hands and dial.', location: 'Front', color: C.blue, explode: [0, 0, 1], distance: 1.2, confidence: 0.8 }, { geo: (() => { const g = cyl(1.02, 1.02, 0.01, 48); g.rotateX(Math.PI / 2); return g; })(), pos: [0, 0, 0.12] });
    return b.build();
  },
};

// ------------------------------------------------------------------ Scissors

export const scissors: Archetype = {
  id: 'scissors',
  name: 'Scissors',
  category: 'Tools',
  subtitle: 'Two levers on a pivot',
  keywords: ['scissors', 'shears', 'pair of scissors'],
  build() {
    const b = new AssemblyBuilder(this);
    const blade = extrude([[0, -0.08], [1.6, -0.01], [1.65, 0.02], [0, 0.1]], 0.03);
    for (const s of [1, -1]) {
      b.part({ id: s > 0 ? 'blade-a' : 'blade-b', name: s > 0 ? 'Upper blade' : 'Lower blade', description: 'Sharpened steel blade; the two edges shear past each other.', function: 'Cutting.', location: s > 0 ? 'Top' : 'Bottom', color: s > 0 ? C.white : C.cyan, explode: [0.3, s, s * 0.4], distance: 0.45 }, { geo: blade, pos: [0, 0, 0.02 * s], rot: [0, 0, 0.18 * s] });
      b.part({ id: s > 0 ? 'handle-a' : 'handle-b', name: s > 0 ? 'Upper handle' : 'Lower handle', description: 'Finger loop moulded around the blade tang.', function: 'Grip and leverage.', location: s > 0 ? 'Top left' : 'Bottom left', color: s > 0 ? C.pink : C.yellow, explode: [-1, s, 0], distance: 0.5 }, { geo: torus(0.3, 0.07, 8, 28), pos: [-0.55, 0.32 * s, 0.02 * s], rot: [0, 0, 0] }, { geo: box(0.35, 0.09, 0.05), pos: [-0.18, 0.12 * s, 0.02 * s], rot: [0, 0, -0.5 * s] });
    }
    b.part({ id: 'pivot', name: 'Pivot screw', description: 'Fastener the blades rotate around; sets blade tension.', function: 'Fulcrum.', location: 'Centre joint', color: C.coral, explode: [0, 0, 1], distance: 0.6 }, { geo: (() => { const g = cyl(0.07, 0.07, 0.14, 16); g.rotateX(Math.PI / 2); return g; })() });
    return b.build();
  },
};

// ------------------------------------------------------------------ Chair

export const chair: Archetype = {
  id: 'chair',
  name: 'Chair',
  category: 'Furniture',
  subtitle: 'Four-legged chair',
  keywords: ['chair', 'folding chair', 'rocking chair', 'barber chair', 'throne', 'stool', 'seat', 'dining chair', 'office chair'],
  build() {
    const b = new AssemblyBuilder(this);
    b.group('legs', 'Legs', 'Four legs.', [0, -1, 0], 0.25);
    b.part({ id: 'seat', name: 'Seat', description: 'Horizontal panel you sit on.', function: 'Supports the sitter.', location: 'Middle', color: C.white, explode: [0, 0, 0], distance: 0 }, { geo: box(1.1, 0.1, 1.0, 0.04), pos: [0, 1.0, 0] });
    b.part({ id: 'backrest', name: 'Backrest', description: 'Upright back support with rails.', function: 'Back support.', location: 'Rear top', color: C.cyan, explode: [0, 0.6, -1], distance: 0.5 }, { geo: box(1.05, 0.5, 0.06, 0.03), pos: [0, 1.85, -0.47] }, { geo: box(0.07, 0.85, 0.07), pos: [0.48, 1.45, -0.47] }, { geo: box(0.07, 0.85, 0.07), pos: [-0.48, 1.45, -0.47] });
    let n = 0;
    for (const [x, z] of [[0.48, 0.42], [-0.48, 0.42], [0.48, -0.42], [-0.48, -0.42]]) {
      n++;
      b.part({ id: `leg-${n}`, name: `Leg ${n}`, parent: 'legs', description: 'Load-bearing leg.', function: 'Transfers weight to the floor.', location: `${z > 0 ? 'Front' : 'Back'} ${x > 0 ? 'right' : 'left'}`, color: C.yellow, explode: [x, -0.4, z], distance: 0.45 }, { geo: box(0.08, 0.95, 0.08, 0.02), pos: [x, 0.47, z] });
    }
    b.part({ id: 'stretchers', name: 'Stretchers', description: 'Cross rails bracing the legs.', function: 'Rigidity.', location: 'Between legs', color: C.purple, explode: [0, -1, 0], distance: 0.6, confidence: 0.7 }, { geo: box(0.9, 0.05, 0.04), pos: [0, 0.3, 0.42] }, { geo: box(0.9, 0.05, 0.04), pos: [0, 0.3, -0.42] }, { geo: box(0.04, 0.05, 0.8), pos: [0.48, 0.3, 0] }, { geo: box(0.04, 0.05, 0.8), pos: [-0.48, 0.3, 0] });
    return b.build();
  },
};

export const machineArchetypes: Archetype[] = [radialEngine, deskLamp, clock, scissors, chair];
