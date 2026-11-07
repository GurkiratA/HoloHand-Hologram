import * as THREE from 'three';
import type { Archetype } from './types';
import { AssemblyBuilder, box, cone, cyl, extrude, merged, sphere, torus, tube, wheelGeos, capsule, ellipsoid } from './builder';
import type { Vec3 } from '@/types';

const C = {
  white: '#f2f5ff',
  cyan: '#3ff0e0',
  teal: '#19c3b5',
  pink: '#ff8fc8',
  yellow: '#ffd84a',
  purple: '#a98bff',
  coral: '#ff6b7d',
  blue: '#6cb6ff',
};

const TOY_NOTE =
  'On a die-cast miniature this region is usually moulded into the body rather than being a separate part.';

// ------------------------------------------------------------------ Formula car

export const formulaCar: Archetype = {
  id: 'formula-car',
  name: 'Formula 1 Car',
  category: 'Vehicles',
  subtitle: 'Open-wheel single-seater, front wing to diffuser',
  keywords: ['formula 1', 'formula one', 'f1', 'race car', 'racer', 'racing car', 'open wheel', 'single seater', 'go-kart', 'hot wheels f1', 'indycar'],
  build() {
    const b = new AssemblyBuilder(this);
    b.group('front', 'Front assembly', 'Everything ahead of the survival cell: wing, nose, front corners.', [1, 0, 0], 0.35)
      .group('rear', 'Rear assembly', 'Rear wing, rear corners, gearbox area and diffuser.', [-1, 0, 0], 0.35)
      .group('body', 'Body', 'Aerodynamic bodywork around the chassis.', [0, 1, 0], 0.12);

    b.part(
      {
        id: 'chassis', name: 'Chassis', description: 'Carbon-fibre survival cell (monocoque) that the driver sits in and every other part bolts to.',
        function: 'Carries loads from suspension, engine and aero; protects the driver.', location: 'Centre of the car',
        technical: { 'Full-size material': 'Carbon-fibre composite', 'Toy material': 'Usually die-cast zinc alloy' },
        color: C.white, explode: [0, -0.2, 0], distance: 0.1,
      },
      { geo: box(2.3, 0.42, 0.72, 0.12), pos: [0.15, 0.46, 0] },
      { geo: box(1.2, 0.3, 0.5, 0.1), pos: [1.1, 0.42, 0] },
    );
    const nose = cone(0.24, 1.3, 20);
    nose.rotateZ(-Math.PI / 2);
    nose.scale(1, 0.7, 1);
    b.part(
      {
        id: 'nose', name: 'Nose cone', parent: 'front', description: 'Crash structure at the front of the monocoque that also feeds clean air under the car.',
        function: 'Absorbs frontal impacts; mounts the front wing.', location: 'Front, ahead of the cockpit',
        technical: { 'Crash test': 'Homologated impact structure (full-size)' }, color: C.cyan, explode: [1, 0.15, 0], distance: 0.35,
      },
      { geo: nose, pos: [2.25, 0.36, 0] },
    );
    b.part(
      {
        id: 'front-wing', name: 'Front wing', parent: 'front', description: 'Multi-element wing that generates front downforce and steers airflow around the front tyres.',
        function: 'Front downforce and airflow management.', location: 'Very front, close to the ground',
        technical: { Elements: 'Main plane + adjustable flaps', 'Typical ride height': 'A few cm (full-size)' }, color: C.yellow, explode: [1, -0.1, 0], distance: 0.7,
      },
      { geo: box(0.42, 0.04, 2.05, 0.02), pos: [2.75, 0.12, 0] },
      { geo: box(0.3, 0.035, 1.9, 0.015), pos: [2.6, 0.2, 0], rot: [0, 0, 0.25] },
      { geo: box(0.55, 0.26, 0.03), pos: [2.7, 0.2, 1.03] },
      { geo: box(0.55, 0.26, 0.03), pos: [2.7, 0.2, -1.03] },
    );
    const wheel = (id: string, name: string, parent: string, x: number, z: number, r: number, w: number) =>
      b.part(
        {
          id, name, parent, description: `${name.replace(/^(Left|Right) /, '')}: slick or treaded tyre on a lightweight wheel rim.`,
          function: 'Mechanical grip, braking and steering (front) or traction (rear).', location: `${z > 0 ? 'Left' : 'Right'} ${x > 0 ? 'front' : 'rear'} corner`,
          technical: { 'Rim (full-size)': '18-inch forged magnesium/aluminium', Note: TOY_NOTE.replace('this region', 'the axle') }, color: C.white,
          explode: [0, 0, Math.sign(z)], distance: 0.55,
        },
        ...wheelGeos(r, w).map((g) => ({ ...g, pos: [x, r, z] as Vec3 })),
      );
    wheel('wheel-fl', 'Left front wheel', 'front', 1.55, 0.88, 0.34, 0.32);
    wheel('wheel-fr', 'Right front wheel', 'front', 1.55, -0.88, 0.34, 0.32);
    wheel('wheel-rl', 'Left rear wheel', 'rear', -1.45, 0.86, 0.37, 0.42);
    wheel('wheel-rr', 'Right rear wheel', 'rear', -1.45, -0.86, 0.37, 0.42);

    const susp = (x: number, r: number): THREE.BufferGeometry => {
      const arms: Vec3[][] = [];
      for (const s of [1, -1]) {
        arms.push([[x + 0.25, 0.48, 0.3 * s], [x, r + 0.08, 0.72 * s]], [[x - 0.25, 0.48, 0.3 * s], [x, r + 0.08, 0.72 * s]]);
        arms.push([[x + 0.25, 0.3, 0.3 * s], [x, r - 0.1, 0.72 * s]], [[x - 0.25, 0.3, 0.3 * s], [x, r - 0.1, 0.72 * s]]);
      }
      return merged(arms.map((a) => ({ geo: tube(a, 0.022, false, 4) })));
    };
    b.part(
      { id: 'susp-front', name: 'Front suspension', parent: 'front', description: 'Double-wishbone arms (and push/pull rods) linking the front wheels to the chassis.', function: 'Controls wheel movement, ride height and steering geometry.', location: 'Between chassis and front wheels', color: C.teal, explode: [0.4, 0.6, 0], distance: 0.35 },
      { geo: susp(1.55, 0.34) },
    );
    b.part(
      { id: 'susp-rear', name: 'Rear suspension', parent: 'rear', description: 'Wishbones and links locating the rear wheels on the gearbox casing.', function: 'Transfers traction and braking loads.', location: 'Between gearbox and rear wheels', color: C.teal, explode: [-0.4, 0.6, 0], distance: 0.35 },
      { geo: susp(-1.45, 0.37) },
    );
    b.part(
      {
        id: 'rear-wing', name: 'Rear wing', parent: 'rear', description: 'Two-element wing with endplates; the upper flap opens for DRS on full-size cars.',
        function: 'Rear downforce and stability.', location: 'Top rear', technical: { DRS: 'Drag Reduction System flap (full-size)' }, color: C.pink,
        explode: [-1, 0.6, 0], distance: 0.6,
      },
      { geo: box(0.45, 0.05, 1.35, 0.02), pos: [-2.25, 1.02, 0] },
      { geo: box(0.3, 0.04, 1.3, 0.015), pos: [-2.05, 1.14, 0], rot: [0, 0, -0.35] },
      { geo: box(0.65, 0.6, 0.03), pos: [-2.2, 0.88, 0.69] },
      { geo: box(0.65, 0.6, 0.03), pos: [-2.2, 0.88, -0.69] },
      { geo: box(0.08, 0.5, 0.06), pos: [-2.1, 0.72, 0] },
    );
    b.part(
      { id: 'diffuser', name: 'Diffuser', parent: 'rear', description: 'Upswept tunnels at the back of the floor that expand the underbody airflow.', function: 'Generates downforce from the underfloor.', location: 'Rear, under the gearbox', color: C.purple, explode: [-1, -0.5, 0], distance: 0.4 },
      { geo: box(0.5, 0.05, 1.2), pos: [-2.1, 0.26, 0], rot: [0, 0, -0.35] },
      { geo: merged([-0.4, 0, 0.4].map((z) => ({ geo: box(0.5, 0.18, 0.02), pos: [-2.1, 0.3, z] as Vec3, rot: [0, 0, -0.35] as Vec3 }))) },
    );
    const rim = torus(0.32, 0.06, 8, 32);
    rim.rotateX(Math.PI / 2);
    rim.scale(1.4, 1, 0.85);
    b.part(
      { id: 'cockpit', name: 'Cockpit', description: 'Driver opening in the survival cell with seat, steering wheel and padding.', function: 'Houses and protects the driver.', location: 'Centre, above the chassis', technical: { Note: TOY_NOTE }, color: C.cyan, explode: [0, 1, 0], distance: 0.35, confidence: 0.9 },
      { geo: rim, pos: [0.35, 0.68, 0] },
      { geo: torus(0.11, 0.02, 6, 20), pos: [0.75, 0.74, 0], rot: [0, Math.PI / 2, 0] },
    );
    const haloPts: Vec3[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * Math.PI;
      haloPts.push([0.3 + Math.cos(a) * 0.42, 0.98, Math.sin(a) * 0.3]);
    }
    b.part(
      { id: 'halo', name: 'Halo', parent: 'cockpit', description: 'Titanium hoop above the cockpit that deflects debris and protects the driver’s head.', function: 'Head protection.', location: 'Above the cockpit', technical: { 'Material (full-size)': 'Grade 5 titanium' }, color: C.yellow, explode: [0, 1, 0], distance: 0.4 },
      { geo: tube(haloPts, 0.035, false, 32) },
      { geo: tube([[0.92, 0.6, 0], [0.8, 0.85, 0], [0.72, 0.98, 0]], 0.035, false, 8) },
    );
    for (const s of [1, -1]) {
      b.part(
        { id: s > 0 ? 'sidepod-l' : 'sidepod-r', name: s > 0 ? 'Left side pod' : 'Right side pod', parent: 'body', description: 'Bodywork housing the radiators; its shape steers air towards the rear of the car.', function: 'Cooling and airflow management.', location: `${s > 0 ? 'Left' : 'Right'} of the chassis`, color: C.blue, explode: [0, 0.15, s], distance: 0.45 },
        { geo: box(1.5, 0.38, 0.42, 0.14), pos: [-0.15, 0.42, 0.56 * s] },
      );
    }
    b.part(
      { id: 'floor', name: 'Floor', parent: 'body', description: 'Flat/venturi floor that seals the underbody and works with the diffuser.', function: 'Underbody downforce.', location: 'Underneath the whole car', color: C.purple, explode: [0, -1, 0], distance: 0.4 },
      { geo: box(3.6, 0.04, 1.45, 0.02), pos: [-0.25, 0.17, 0] },
    );
    b.part(
      { id: 'engine-cover', name: 'Engine cover & airbox', parent: 'body', description: 'Shark-fin bodywork over the power unit with the roll-hoop air intake.', function: 'Feeds air to the engine; protects the power unit.', location: 'Behind the cockpit', color: C.coral, explode: [-0.3, 1, 0], distance: 0.45 },
      { geo: box(1.7, 0.4, 0.5, 0.14), pos: [-0.85, 0.74, 0] },
      { geo: box(0.35, 0.32, 0.26, 0.1), pos: [-0.15, 1.02, 0] },
      { geo: box(1.2, 0.3, 0.03), pos: [-1.2, 1.0, 0] },
    );
    return b.build();
  },
};

// ------------------------------------------------------------------ Road / sports car

export const car: Archetype = {
  id: 'car',
  name: 'Sports Car',
  category: 'Vehicles',
  subtitle: 'Generic two-door road car layout',
  keywords: ['car', 'sports car', 'convertible', 'toy car', 'model car', 'die-cast car', 'cab', 'taxi', 'sedan', 'coupe', 'racing car toy', 'minivan', 'limousine', 'jeep', 'beach wagon', 'station wagon'],
  build() {
    const b = new AssemblyBuilder(this);
    b.group('running-gear', 'Running gear', 'Wheels, brakes and suspension.', [0, -1, 0], 0.15);
    const side = extrude([[-2.1, 0.35], [2.1, 0.35], [2.15, 0.75], [1.2, 0.85], [0.55, 1.35], [-0.9, 1.38], [-1.9, 0.95], [-2.15, 0.8]], 1.7, 0.06);
    b.part({ id: 'body', name: 'Body shell', description: 'Pressed panels forming the outer skin of the car.', function: 'Aerodynamics, styling and weather protection.', location: 'Outer shell', color: C.white, explode: [0, 0.4, 0], distance: 0.15, confidence: 0.85 }, { geo: side });
    b.part({ id: 'chassis', name: 'Chassis / floor pan', description: 'Structural floor the body, suspension and drivetrain mount to.', function: 'Primary load-bearing structure.', location: 'Underneath', color: C.purple, explode: [0, -1, 0], distance: 0.45, confidence: 0.8 }, { geo: box(4.0, 0.12, 1.6, 0.04), pos: [0, 0.3, 0] });
    b.part({ id: 'glass', name: 'Glasshouse', description: 'Windscreen, side and rear windows.', function: 'Visibility and cabin enclosure.', location: 'Upper body', color: C.cyan, explode: [0, 1, 0], distance: 0.55, confidence: 0.85 }, { geo: extrude([[1.15, 0.88], [0.55, 1.3], [-0.85, 1.33], [-1.75, 0.95]], 1.5) });
    b.part({ id: 'engine', name: 'Engine', description: 'Internal-combustion engine or electric drive unit (not visible – placement assumed).', function: 'Propulsion.', location: 'Front, under the bonnet', color: C.coral, explode: [1, 0.6, 0], distance: 0.6, confidence: 0.5 }, { geo: box(0.9, 0.45, 0.9, 0.08), pos: [1.45, 0.62, 0] });
    b.part({ id: 'interior', name: 'Seats & interior', description: 'Seats, dashboard and steering wheel.', function: 'Occupant accommodation.', location: 'Cabin', color: C.yellow, explode: [0, 1, 0], distance: 0.3, confidence: 0.7 }, { geo: box(0.4, 0.55, 0.5, 0.08), pos: [-0.3, 0.7, 0.4] }, { geo: box(0.4, 0.55, 0.5, 0.08), pos: [-0.3, 0.7, -0.4] }, { geo: box(0.3, 0.25, 1.4, 0.05), pos: [0.7, 0.85, 0] });
    for (const [id, name, x, z] of [['wheel-fl', 'Left front wheel', 1.35, 0.85], ['wheel-fr', 'Right front wheel', 1.35, -0.85], ['wheel-rl', 'Left rear wheel', -1.35, 0.85], ['wheel-rr', 'Right rear wheel', -1.35, -0.85]] as const) {
      b.part({ id, name, parent: 'running-gear', description: 'Tyre mounted on an alloy or steel rim.', function: 'Grip, braking and ride comfort.', location: name, color: C.white, explode: [0, -0.2, Math.sign(z)], distance: 0.55 }, ...wheelGeos(0.42, 0.3).map((g) => ({ ...g, pos: [x, 0.42, z] as Vec3 })));
    }
    b.part({ id: 'lights', name: 'Lights', description: 'Headlamps and tail lamps.', function: 'Illumination and signalling.', location: 'Front and rear corners', color: C.yellow, explode: [0, 0.2, 0], distance: 0.2, confidence: 0.8 }, { geo: box(0.08, 0.12, 0.4), pos: [2.13, 0.65, 0.55] }, { geo: box(0.08, 0.12, 0.4), pos: [2.13, 0.65, -0.55] }, { geo: box(0.08, 0.12, 0.4), pos: [-2.13, 0.8, 0.55] }, { geo: box(0.08, 0.12, 0.4), pos: [-2.13, 0.8, -0.55] });
    return b.build();
  },
};

// ------------------------------------------------------------------ Bicycle

export const bicycle: Archetype = {
  id: 'bicycle',
  name: 'Bicycle',
  category: 'Vehicles',
  subtitle: 'Diamond-frame bicycle',
  keywords: ['bicycle', 'bike', 'mountain bike', 'road bike', 'bicycle-built-for-two', 'tandem', 'cycle'],
  build() {
    const b = new AssemblyBuilder(this);
    const wheel = (x: number) => {
      const t = torus(0.68, 0.045, 8, 48);
      const spokes = merged(Array.from({ length: 12 }, (_, i) => ({ geo: cyl(0.006, 0.006, 1.3, 4), rot: [0, 0, (i / 12) * Math.PI] as Vec3 })));
      return [{ geo: t, pos: [x, 0.7, 0] as Vec3 }, { geo: spokes, pos: [x, 0.7, 0] as Vec3 }, { geo: cyl(0.05, 0.05, 0.12, 12), pos: [x, 0.7, 0] as Vec3, rot: [Math.PI / 2, 0, 0] as Vec3 }];
    };
    b.part({ id: 'front-wheel', name: 'Front wheel', description: 'Rim, spokes, hub and tyre.', function: 'Rolling, steering.', location: 'Front', color: C.white, explode: [1, 0, 0.4], distance: 0.5 }, ...wheel(1.05));
    b.part({ id: 'rear-wheel', name: 'Rear wheel', description: 'Rim, spokes, hub with cassette and tyre.', function: 'Rolling, drive.', location: 'Rear', color: C.white, explode: [-1, 0, 0.4], distance: 0.5 }, ...wheel(-1.05));
    b.part({ id: 'frame', name: 'Frame', description: 'Top tube, down tube, seat tube and stays forming two triangles.', function: 'Main structure.', location: 'Centre', color: C.cyan, explode: [0, 0, 0], distance: 0 },
      { geo: merged([
        { geo: tube([[-0.1, 0.65, 0], [0.75, 1.3, 0]], 0.035, false, 4) },
        { geo: tube([[-0.25, 1.38, 0], [0.75, 1.32, 0]], 0.03, false, 4) },
        { geo: tube([[-0.1, 0.65, 0], [-0.25, 1.38, 0]], 0.03, false, 4) },
        { geo: tube([[-0.1, 0.65, 0], [-1.05, 0.7, 0]], 0.022, false, 4) },
        { geo: tube([[-0.25, 1.38, 0], [-1.05, 0.7, 0]], 0.022, false, 4) },
      ]) });
    b.part({ id: 'fork', name: 'Fork & headset', description: 'Steerer tube and fork legs holding the front wheel.', function: 'Steering, front suspension (on some bikes).', location: 'Front', color: C.teal, explode: [1, 0.4, 0], distance: 0.4 }, { geo: tube([[0.78, 1.42, 0], [0.88, 1.1, 0], [1.05, 0.7, 0]], 0.03, false, 8) });
    b.part({ id: 'handlebar', name: 'Handlebar & stem', description: 'Bar and stem for steering, braking and shifting controls.', function: 'Steering input.', location: 'Front top', color: C.yellow, explode: [0.6, 1, 0], distance: 0.45 }, { geo: cyl(0.025, 0.025, 0.7, 10), pos: [0.72, 1.55, 0], rot: [Math.PI / 2, 0, 0] }, { geo: cyl(0.025, 0.025, 0.2, 8), pos: [0.76, 1.47, 0] });
    b.part({ id: 'saddle', name: 'Saddle & seatpost', description: 'Seat and adjustable post.', function: 'Rider support.', location: 'Top rear', color: C.pink, explode: [-0.3, 1, 0], distance: 0.45 }, { geo: box(0.4, 0.07, 0.18, 0.03), pos: [-0.3, 1.58, 0] }, { geo: cyl(0.02, 0.02, 0.2, 8), pos: [-0.27, 1.48, 0] });
    b.part({ id: 'drivetrain', name: 'Drivetrain', description: 'Cranks, chainring, chain and rear sprockets.', function: 'Transfers pedalling power to the rear wheel.', location: 'Lower centre/right', color: C.purple, explode: [0, -0.4, 1], distance: 0.5 }, { geo: torus(0.16, 0.02, 6, 28), pos: [-0.1, 0.65, 0.08] }, { geo: tube([[-0.1, 0.81, 0.08], [-1.05, 0.78, 0.08], [-1.05, 0.62, 0.08], [-0.1, 0.49, 0.08]], 0.008, true, 40) }, { geo: box(0.04, 0.4, 0.03), pos: [-0.1, 0.55, 0.14], rot: [0, 0, 0.6] });
    return b.build();
  },
};

// ------------------------------------------------------------------ Airplane

export const airplane: Archetype = {
  id: 'airplane',
  name: 'Airliner',
  category: 'Vehicles',
  subtitle: 'Twin-engine passenger jet layout',
  keywords: ['airplane', 'aeroplane', 'airliner', 'plane', 'jet', 'aircraft', 'warplane', 'model plane', 'toy plane'],
  build() {
    const b = new AssemblyBuilder(this);
    const fus = capsule(0.32, 4.2);
    fus.rotateZ(Math.PI / 2);
    b.part({ id: 'fuselage', name: 'Fuselage', description: 'Pressurised tube carrying passengers and cargo.', function: 'Main body / payload.', location: 'Centre', color: C.white, explode: [0, 0, 0], distance: 0 }, { geo: fus });
    const wing = extrude([[0, 0], [0.9, 0], [0.4, 2.6], [0.05, 2.6]], 0.06);
    wing.rotateX(Math.PI / 2);
    for (const s of [1, -1]) {
      const w = wing.clone();
      if (s < 0) w.scale(1, 1, -1);
      b.part({ id: s > 0 ? 'wing-l' : 'wing-r', name: s > 0 ? 'Left wing' : 'Right wing', description: 'Swept wing with fuel tanks, flaps and ailerons.', function: 'Lift and roll control.', location: `${s > 0 ? 'Left' : 'Right'} side`, color: C.cyan, explode: [0, 0, s], distance: 0.5 }, { geo: w, pos: [-0.3, -0.1, 0.25 * s] });
      b.part({ id: s > 0 ? 'engine-l' : 'engine-r', name: s > 0 ? 'Left engine' : 'Right engine', description: 'High-bypass turbofan in a nacelle under the wing.', function: 'Thrust.', location: `Under the ${s > 0 ? 'left' : 'right'} wing`, color: C.yellow, explode: [0, -1, s * 0.6], distance: 0.6 }, { geo: cyl(0.2, 0.17, 0.75, 20), pos: [0.1, -0.35, 1.0 * s], rot: [0, 0, Math.PI / 2] });
    }
    const vfin = extrude([[0, 0], [0.8, 0], [0.4, 0.95], [0.15, 0.95]], 0.05);
    b.part({ id: 'tail-fin', name: 'Vertical stabiliser', description: 'Tail fin with rudder.', function: 'Yaw stability and control.', location: 'Tail', color: C.pink, explode: [-0.6, 1, 0], distance: 0.5 }, { geo: vfin, pos: [-2.5, 0.2, 0] });
    const hst = extrude([[0, 0], [0.55, 0], [0.25, 1.0], [0.05, 1.0]], 0.04);
    hst.rotateX(Math.PI / 2);
    const hst2 = hst.clone();
    hst2.scale(1, 1, -1);
    b.part({ id: 'tailplane', name: 'Horizontal stabiliser', description: 'Tailplane with elevators.', function: 'Pitch stability and control.', location: 'Tail', color: C.purple, explode: [-1, 0, 0], distance: 0.45 }, { geo: hst, pos: [-2.4, 0.1, 0.1] }, { geo: hst2, pos: [-2.4, 0.1, -0.1] });
    b.part({ id: 'landing-gear', name: 'Landing gear', description: 'Retractable nose and main undercarriage.', function: 'Ground support, taxi, take-off and landing.', location: 'Underside', color: C.teal, explode: [0, -1, 0], distance: 0.45 }, { geo: cyl(0.025, 0.025, 0.4, 6), pos: [1.7, -0.45, 0] }, { geo: cyl(0.025, 0.025, 0.4, 6), pos: [-0.2, -0.45, 0.35] }, { geo: cyl(0.025, 0.025, 0.4, 6), pos: [-0.2, -0.45, -0.35] }, { geo: sphere(0.09, 10, 8), pos: [1.7, -0.66, 0] });
    b.part({ id: 'cockpit', name: 'Flight deck', description: 'Nose section with cockpit windows and avionics.', function: 'Pilot station.', location: 'Nose', color: C.coral, explode: [1, 0.3, 0], distance: 0.4, confidence: 0.85 }, { geo: ellipsoid(0.4, 0.2, 0.28), pos: [2.25, 0.12, 0] });
    return b.build();
  },
};

// ------------------------------------------------------------------ Quadcopter drone

export const drone: Archetype = {
  id: 'drone',
  name: 'Quadcopter Drone',
  category: 'Electronics',
  subtitle: 'Four-rotor camera drone',
  keywords: ['drone', 'quadcopter', 'quadrotor', 'uav', 'multicopter'],
  build() {
    const b = new AssemblyBuilder(this);
    b.group('rotors', 'Rotor arms', 'Four motor/propeller assemblies.', [0, 0.3, 0], 0.1);
    b.part({ id: 'body', name: 'Main body', description: 'Shell housing the flight controller and battery bay.', function: 'Structure and electronics enclosure.', location: 'Centre', color: C.white, explode: [0, 0, 0], distance: 0 }, { geo: box(1.0, 0.35, 0.65, 0.12) });
    b.part({ id: 'battery', name: 'Battery', description: 'Lithium-polymer flight battery.', function: 'Power.', location: 'Top/rear bay', color: C.yellow, explode: [0, 1, 0], distance: 0.6 }, { geo: box(0.6, 0.14, 0.4, 0.04), pos: [-0.05, 0.25, 0] });
    b.part({ id: 'camera', name: 'Gimbal camera', description: 'Stabilised camera on a 3-axis gimbal.', function: 'Imaging.', location: 'Front underside', color: C.cyan, explode: [1, -0.6, 0], distance: 0.6 }, { geo: sphere(0.13, 16, 12), pos: [0.5, -0.25, 0] }, { geo: box(0.1, 0.12, 0.2), pos: [0.45, -0.15, 0] });
    b.part({ id: 'fc', name: 'Flight controller', description: 'Main board with IMU, GPS and ESCs (internal – typical layout assumed).', function: 'Stabilisation and navigation.', location: 'Inside body', color: C.purple, explode: [0, -1, 0], distance: 0.5, confidence: 0.5 }, { geo: box(0.5, 0.04, 0.4), pos: [0, 0, 0] });
    let i = 0;
    for (const [x, z] of [[0.75, 0.75], [0.75, -0.75], [-0.75, 0.75], [-0.75, -0.75]]) {
      i++;
      b.part({ id: `rotor-${i}`, name: `Rotor ${i}`, parent: 'rotors', description: 'Arm, brushless motor and two-blade propeller.', function: 'Lift and attitude control.', location: `${x > 0 ? 'Front' : 'Rear'} ${z > 0 ? 'left' : 'right'}`, color: i % 2 ? C.pink : C.teal, explode: [x, 0.2, z], distance: 0.45 },
        { geo: tube([[x * 0.3, 0, z * 0.3], [x, 0.05, z]], 0.04, false, 4) },
        { geo: cyl(0.08, 0.08, 0.14, 14), pos: [x, 0.1, z] },
        { geo: box(0.75, 0.01, 0.07), pos: [x, 0.19, z], rot: [0, i * 0.7, 0] });
    }
    return b.build();
  },
};

export const vehicleArchetypes: Archetype[] = [formulaCar, car, bicycle, airplane, drone];
